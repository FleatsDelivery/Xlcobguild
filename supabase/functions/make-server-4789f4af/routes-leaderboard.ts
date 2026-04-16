/**
 * Leaderboard Route -- ranked member listing with KKUP stats
 * 1 route: GET /leaderboard
 */
import type { Hono } from "npm:hono";
import { PREFIX } from "./helpers.ts";

export function registerLeaderboardRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // Get leaderboard (all authenticated users)
  app.get(`${PREFIX}/leaderboard`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('role').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser) return c.json({ error: 'User not found' }, 404);

      // Get all active guilds
      const { data: guilds, error: guildsError } = await supabase
        .from('guild_wars_guilds')
        .select('id, name, tag, color, logo_url, member_limit, current_rank');

      if (guildsError) {
          console.error('Error fetching guilds:', guildsError);
      }

      // Get all users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select(`
          id, discord_username, discord_avatar, discord_id, rank_id, prestige_level, mvp_count,
          role, created_at, steam_id, opendota_data, tcf_plus_active, twitch_username, twitch_avatar,
          guild_id,
          ranks ( id, name, display_order ),
          guild:guild_wars_guilds!users_guild_id_fkey ( id, name, tag, color, logo_url, member_limit, current_rank )
        `);

      if (usersError) {
        console.error('Error fetching leaderboard users:', usersError);
        return c.json({ error: 'Failed to fetch leaderboard' }, 500);
      }

      // 1. Calculate Guild Stats
      const guildStatsMap: Record<string, { kernels: number; member_count: number; total_rank: number; total_prestige: number; total_mvp_count: number }> = {};
      (guilds || []).forEach((g: any) => {
        guildStatsMap[g.id] = { kernels: g.current_rank || 0, member_count: 0, total_rank: 0, total_prestige: 0, total_mvp_count: 0 };
      });

      (users || []).forEach((u: any) => {
        if (u.guild_id && guildStatsMap[u.guild_id]) {
          guildStatsMap[u.guild_id].member_count++;
          guildStatsMap[u.guild_id].total_rank += (u.rank_id || 1);
          guildStatsMap[u.guild_id].total_prestige += (u.prestige_level || 0);
          guildStatsMap[u.guild_id].total_mvp_count += Number(u.mvp_count || 0);
          
          const rankPoints = u.rank_id || 1;
          guildStatsMap[u.guild_id].kernels += rankPoints;
        }
      });

      const rankedGuilds = (guilds || [])
        .map((g: any) => ({
          ...g,
          kernels: guildStatsMap[g.id]?.kernels || 0,
          member_count: guildStatsMap[g.id]?.member_count || 0,
          total_mvp_count: guildStatsMap[g.id]?.total_mvp_count || 0,
          avg_rank_id: guildStatsMap[g.id]?.member_count > 0 
            ? Math.round(guildStatsMap[g.id].total_rank / guildStatsMap[g.id].member_count) 
            : 0,
          avg_prestige: guildStatsMap[g.id]?.member_count > 0
            ? Math.round(guildStatsMap[g.id].total_prestige / guildStatsMap[g.id].member_count)
            : 0
        }))
        .sort((a: any, b: any) => {
          // Rank Score > MVP Count > Guild Capacity (Member Count)
          if (b.kernels !== a.kernels) return b.kernels - a.kernels;
          if (b.total_mvp_count !== a.total_mvp_count) return b.total_mvp_count - a.total_mvp_count;
          return b.member_count - a.member_count;
        });

      // 2. Compute KKUP stats for each user (Existing logic)
      const steamIds = (users || []).map((u: any) => u.steam_id).filter(Boolean);
      const userStatsMap: Record<string, { linked: boolean; championships: number; popdKernels: number }> = {};

      if (steamIds.length > 0) {
        const { data: persons } = await supabase
          .from('kkup_persons')
          .select('id, steam_id')
          .in('steam_id', steamIds);

        if (persons && persons.length > 0) {
          const personBySteamId = new Map<string, string>();
          const personIds: string[] = [];
          for (const p of persons) {
            personBySteamId.set(p.steam_id, p.id);
            personIds.push(p.id);
          }

          const { data: rosters } = await supabase
            .from('kkup_team_rosters')
            .select('person_id, team_id')
            .in('person_id', personIds);

          const personTeams = new Map<string, string[]>();
          (rosters || []).forEach((r: any) => {
            if (!personTeams.has(r.person_id)) personTeams.set(r.person_id, []);
            personTeams.get(r.person_id)!.push(r.team_id);
          });

          const { data: tournaments } = await supabase
            .from('kkup_tournaments')
            .select('id, winning_team_id, tournament_type, popd_kernel_1_person_id, popd_kernel_2_person_id');

          for (const u of (users || [])) {
            if (!u.steam_id || !personBySteamId.has(u.steam_id)) {
              userStatsMap[u.id] = { linked: false, championships: 0, popdKernels: 0 };
              continue;
            }

            const personId = personBySteamId.get(u.steam_id)!;
            const teamIds = personTeams.get(personId) || [];

            let champs = 0;
            let popdK = 0;

            (tournaments || []).forEach((t: any) => {
              if (t.winning_team_id && teamIds.includes(t.winning_team_id)) champs++;
              if (t.popd_kernel_1_person_id === personId) popdK++;
              if (t.popd_kernel_2_person_id === personId) popdK++;
            });

            userStatsMap[u.id] = { linked: true, championships: champs, popdKernels: popdK };
          }
        }
      }

      for (const u of (users || [])) {
        if (!userStatsMap[u.id]) {
          userStatsMap[u.id] = { linked: false, championships: 0, popdKernels: 0 };
        }
      }

      // Sort Users (Existing logic)
      const sortedUsers = [...(users || [])].sort((a: any, b: any) => {
        const prestigeDiff = (b.prestige_level || 0) - (a.prestige_level || 0);
        if (prestigeDiff !== 0) return prestigeDiff;

        const rankDiff = (b.rank_id || 0) - (a.rank_id || 0);
        if (rankDiff !== 0) return rankDiff;

        const mvpDiff = (b.mvp_count || 0) - (a.mvp_count || 0);
        if (mvpDiff !== 0) return mvpDiff;

        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const usersWithStats = sortedUsers.map((u: any) => ({
        ...u,
        kkup_stats: {
          linked: userStatsMap[u.id]?.linked || false,
          championships: userStatsMap[u.id]?.championships || 0,
          popd_kernels: userStatsMap[u.id]?.popdKernels || 0,
        }
      }));

      return c.json({
        users: usersWithStats,
        guilds: rankedGuilds
      });
    } catch (error) {
      console.error('Get leaderboard error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });
}