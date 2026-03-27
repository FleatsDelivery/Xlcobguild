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

      // Get all users (all authenticated roles)
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select(`
          id, discord_username, discord_avatar, discord_id, rank_id, prestige_level,
          role, created_at, steam_id, opendota_data, tcf_plus_active, twitch_username, twitch_avatar,
          guild_id,
          ranks ( id, name, display_order ),
          guild:guild_wars_guilds!users_guild_id_fkey ( id, name, tag, color, logo_url )
        `);

      if (usersError) {
        console.error('Error fetching leaderboard:', usersError);
        return c.json({ error: 'Failed to fetch leaderboard' }, 500);
      }

      // Compute KKUP stats for each user via steam_id → kkup_persons join
      const steamIds = (users || []).map((u: any) => u.steam_id).filter(Boolean);
      const userStatsMap: Record<string, { linked: boolean; championships: number; popdKernels: number }> = {};

      if (steamIds.length > 0) {
        // Find all kkup_persons matched by steam_id
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

          // Get all team rosters for matched persons
          const { data: rosters } = await supabase
            .from('kkup_team_rosters')
            .select('person_id, team_id')
            .in('person_id', personIds);

          // Build person_id → team_ids map
          const personTeams = new Map<string, string[]>();
          (rosters || []).forEach((r: any) => {
            if (!personTeams.has(r.person_id)) personTeams.set(r.person_id, []);
            personTeams.get(r.person_id)!.push(r.team_id);
          });

          // Get all tournaments for championship & MVP lookups
          const { data: tournaments } = await supabase
            .from('kkup_tournaments')
            .select('id, winning_team_id, tournament_type, popd_kernel_1_person_id, popd_kernel_2_person_id');

          // For each user, compute stats
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

      // Fill in any users not yet in the map
      for (const u of (users || [])) {
        if (!userStatsMap[u.id]) {
          userStatsMap[u.id] = { linked: false, championships: 0, popdKernels: 0 };
        }
      }

      // Sort: prestige DESC > rank DESC > championships DESC > pop'd kernels DESC > badge DESC > created ASC
      const sortedUsers = [...(users || [])].sort((a: any, b: any) => {
        const prestigeDiff = (b.prestige_level || 0) - (a.prestige_level || 0);
        if (prestigeDiff !== 0) return prestigeDiff;

        const rankDiff = (b.rank_id || 0) - (a.rank_id || 0);
        if (rankDiff !== 0) return rankDiff;

        const champDiff = (userStatsMap[b.id]?.championships || 0) - (userStatsMap[a.id]?.championships || 0);
        if (champDiff !== 0) return champDiff;

        const popdDiff = (userStatsMap[b.id]?.popdKernels || 0) - (userStatsMap[a.id]?.popdKernels || 0);
        if (popdDiff !== 0) return popdDiff;

        const badgeDiff = (b.opendota_data?.badge_rank?.rank_tier || 0) - (a.opendota_data?.badge_rank?.rank_tier || 0);
        if (badgeDiff !== 0) return badgeDiff;

        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      // Attach KKUP stats to each user
      const usersWithStats = sortedUsers.map((u: any) => ({
        ...u,
        kkup_stats: {
          linked: userStatsMap[u.id]?.linked || false,
          championships: userStatsMap[u.id]?.championships || 0,
          popd_kernels: userStatsMap[u.id]?.popdKernels || 0,
        }
      }));

      return c.json({ users: usersWithStats });
    } catch (error) {
      console.error('Get leaderboard error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

}