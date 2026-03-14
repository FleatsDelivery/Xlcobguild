// /guildwars slash command handler — Guild leaderboard (top players)
// Uses real Postgres tables for championship/pop'd kernel data
import { errorResponse, InteractionResponseType, jsonResponse } from './utils.ts';

export async function handleGuildWars(body: any, supabase: any): Promise<Response> {
  try {
    // Parallel fetch: users, tournaments (for championships/pop'd kernels), persons, rosters
    const [usersResult, tournamentsResult] = await Promise.all([
      supabase
        .from('users')
        .select('id, discord_username, discord_id, rank_id, prestige_level, role, created_at, steam_id, opendota_data, ranks(name)')
        .neq('role', 'guest')
        .order('prestige_level', { ascending: false })
        .order('rank_id', { ascending: false })
        .order('created_at', { ascending: true }),
      supabase
        .from('kkup_tournaments')
        .select('id, winning_team_id, popd_kernel_1_person_id, popd_kernel_2_person_id'),
    ]);

    const { data: users, error } = usersResult;
    const tournaments = tournamentsResult.data || [];

    if (error || !users) {
      console.error('Failed to fetch guildwars leaderboard:', error);
      return jsonResponse(errorResponse('Failed to load leaderboard data!'));
    }

    // Build winning team set and pop'd kernel set from tournaments table
    const winningTeamIds = new Set(
      tournaments.map((t: any) => t.winning_team_id).filter(Boolean)
    );

    // Pop'd kernel count per person_id (from tournament columns)
    const popdKernelByPerson = new Map<string, number>();
    for (const t of tournaments) {
      if (t.popd_kernel_1_person_id) {
        popdKernelByPerson.set(t.popd_kernel_1_person_id, (popdKernelByPerson.get(t.popd_kernel_1_person_id) || 0) + 1);
      }
      if (t.popd_kernel_2_person_id) {
        popdKernelByPerson.set(t.popd_kernel_2_person_id, (popdKernelByPerson.get(t.popd_kernel_2_person_id) || 0) + 1);
      }
    }

    // Resolve steam_id → kkup_persons → roster → championships
    const steamIds = users.filter((u: any) => u.steam_id).map((u: any) => u.steam_id);
    let personBySteamId = new Map<string, string>();
    let personTeamsMap = new Map<string, string[]>();

    if (steamIds.length > 0) {
      const { data: persons } = await supabase
        .from('kkup_persons')
        .select('id, steam_id')
        .in('steam_id', steamIds);

      if (persons && persons.length > 0) {
        for (const p of persons) personBySteamId.set(p.steam_id, p.id);

        const personIds = persons.map((p: any) => p.id);
        const { data: rosters } = await supabase
          .from('kkup_team_rosters')
          .select('person_id, team_id')
          .in('person_id', personIds);

        (rosters || []).forEach((r: any) => {
          if (!personTeamsMap.has(r.person_id)) personTeamsMap.set(r.person_id, []);
          personTeamsMap.get(r.person_id)!.push(r.team_id);
        });
      }
    }

    // Build per-user stats map
    const userStatsMap: Record<string, { championships: number; popdKernels: number }> = {};
    for (const user of users) {
      if (!user.steam_id || !personBySteamId.has(user.steam_id)) continue;
      const personId = personBySteamId.get(user.steam_id)!;
      const teamIds = personTeamsMap.get(personId) || [];

      // Championships: count how many of their teams are in the winning set
      let championships = 0;
      for (const teamId of teamIds) {
        if (winningTeamIds.has(teamId)) championships++;
      }

      // Pop'd Kernels from tournament columns
      const popdKernels = popdKernelByPerson.get(personId) || 0;

      userStatsMap[user.id] = { championships, popdKernels };
    }

    // Sort: prestige DESC > rank DESC > championships DESC > pop'd kernels DESC > badge rank DESC > created_at ASC
    users.sort((a: any, b: any) => {
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

    // Format a user line
    const formatLine = (user: any, position: number) => {
      let medal = '';
      if (position === 1) medal = '🥇';
      else if (position === 2) medal = '🥈';
      else if (position === 3) medal = '🥉';
      else medal = `**#${position}**`;

      const rankName = user.ranks?.name || 'Unknown';
      const parts: string[] = [];

      // 1. Prestige (always shown)
      parts.push(`⭐×${user.prestige_level || 0}`);

      // 2. Guild Rank (always shown)
      parts.push(rankName);

      // 3. Championships (only if > 0)
      const stats = userStatsMap[user.id];
      if (stats?.championships > 0) {
        parts.push(`🏆×${stats.championships}`);
      }

      // 4. Pop'd Kernels (only if > 0)
      if (stats?.popdKernels > 0) {
        parts.push(`🍿×${stats.popdKernels}`);
      }

      // 5. Badge Rank (only if ranked)
      const badgeMedal = user.opendota_data?.badge_rank?.medal;
      const badgeStars = user.opendota_data?.badge_rank?.stars;
      if (badgeMedal && badgeMedal !== 'Unranked') {
        parts.push(`🏅${badgeMedal} [${badgeStars}]`);
      }

      return `${medal} <@${user.discord_id}> - ${parts.join(' - ')}`;
    };

    // Build leaderboard display
    const topUsers = users.slice(0, 3);
    const restUsers = users.slice(3, 15);

    const topUserLines = topUsers.map((user: any, index: number) => formatLine(user, index + 1));
    const restUserLines = restUsers.map((user: any, index: number) => formatLine(user, index + 4));

    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: '⚔️ Guild Wars Leaderboard',
          description: `—— Top 3 Ranked Members ——\n${topUserLines.join('\n')}`,
          fields: restUserLines.length > 0 ? [{
            name: '——————————————————',
            value: restUserLines.join('\n'),
            inline: false,
          }] : [],
          color: 0xD6A615,
          footer: {
            text: `Total Members: ${users.length} • Today at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
          },
        }],
        components: [{
          type: 1,
          components: [{
            type: 2,
            style: 5,
            label: 'View Full Leaderboard',
            url: 'https://thecornfield.figma.site/#leaderboard',
            emoji: { name: '⚔️' },
          }],
        }],
      },
    });
  } catch (error) {
    console.error('Error handling /guildwars command:', error);
    return jsonResponse(errorResponse('An unexpected error occurred. Please try again later.'));
  }
}