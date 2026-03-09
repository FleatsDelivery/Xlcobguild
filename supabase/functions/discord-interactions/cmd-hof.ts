// /hof slash command handler — Hall of Fame (uses real Postgres tables, not KV)
import { errorResponse, InteractionResponseType, jsonResponse } from './utils.ts';

export async function handleHof(body: any, supabase: any): Promise<Response> {
  try {
    // Parallel fetch all data needed
    const [tournamentsResult, personsResult, rostersResult, teamsResult] = await Promise.all([
      supabase
        .from('kkup_tournaments')
        .select('id, name, winning_team_id, popd_kernel_1_person_id, popd_kernel_2_person_id'),
      supabase
        .from('kkup_persons')
        .select('id, display_name'),
      supabase
        .from('kkup_team_rosters')
        .select('person_id, team_id'),
      supabase
        .from('kkup_teams')
        .select('id, team_name, tournament_id'),
    ]);

    const tournaments = tournamentsResult.data || [];
    const persons = personsResult.data || [];
    const rosters = rostersResult.data || [];
    const teams = teamsResult.data || [];

    // Build lookup maps
    const personNameMap: Record<string, string> = {};
    persons.forEach((p: any) => { personNameMap[p.id] = p.display_name; });

    const teamNameMap: Record<string, string> = {};
    teams.forEach((t: any) => { teamNameMap[t.id] = t.team_name; });

    // ── Championships ──
    // A championship = a tournament with a winning_team_id
    const winningTeamIds = new Set(
      tournaments.map((t: any) => t.winning_team_id).filter(Boolean)
    );

    // Count championships per team
    const teamChampionships: Record<string, number> = {};
    for (const t of tournaments) {
      if (t.winning_team_id) {
        teamChampionships[t.winning_team_id] = (teamChampionships[t.winning_team_id] || 0) + 1;
      }
    }

    // Count championships per player (player was on a winning roster)
    const playerChampionships: Record<string, number> = {};
    for (const roster of rosters) {
      if (winningTeamIds.has(roster.team_id)) {
        playerChampionships[roster.person_id] = (playerChampionships[roster.person_id] || 0) + 1;
      }
    }

    // ── Pop'd Kernels ──
    // From kkup_tournaments.popd_kernel_1_person_id and popd_kernel_2_person_id
    const playerPopdKernels: Record<string, number> = {};
    for (const t of tournaments) {
      if (t.popd_kernel_1_person_id) {
        playerPopdKernels[t.popd_kernel_1_person_id] = (playerPopdKernels[t.popd_kernel_1_person_id] || 0) + 1;
      }
      if (t.popd_kernel_2_person_id) {
        playerPopdKernels[t.popd_kernel_2_person_id] = (playerPopdKernels[t.popd_kernel_2_person_id] || 0) + 1;
      }
    }

    // Sort and get top 5 for each category
    const topChampionPlayers = Object.entries(playerChampionships)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, count], i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
        return `${medal} ${personNameMap[id] || 'Unknown'} — ${'🏆'.repeat(Math.min(count, 5))} (${count})`;
      });

    const topPopdKernelPlayers = Object.entries(playerPopdKernels)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, count], i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
        return `${medal} ${personNameMap[id] || 'Unknown'} — ${'🍿'.repeat(Math.min(count, 5))} (${count})`;
      });

    const topTeams = Object.entries(teamChampionships)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, count], i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
        return `${medal} ${teamNameMap[id] || 'Unknown'} — ${'🏆'.repeat(Math.min(count, 5))} (${count})`;
      });

    // Build embed fields
    const fields: any[] = [];

    if (topChampionPlayers.length > 0) {
      fields.push({
        name: '🏆 Most Championships (Players)',
        value: topChampionPlayers.join('\n'),
        inline: false,
      });
    }

    if (topPopdKernelPlayers.length > 0) {
      fields.push({
        name: "🍿 Most Pop'd Kernels",
        value: topPopdKernelPlayers.join('\n'),
        inline: false,
      });
    }

    if (topTeams.length > 0) {
      fields.push({
        name: '👑 Most Championships (Teams)',
        value: topTeams.join('\n'),
        inline: false,
      });
    }

    if (fields.length === 0) {
      fields.push({
        name: 'No Data Yet',
        value: 'Championship and Pop\'d Kernel awards will appear here once tournaments are completed.',
        inline: false,
      });
    }

    const totalTournaments = tournaments.filter((t: any) => t.winning_team_id).length;

    const embed = {
      title: '🏛️ Kernel Kup Hall of Fame',
      description: `All-time greats across ${totalTournaments} tournament${totalTournaments !== 1 ? 's' : ''}`,
      fields,
      color: 0xF97316,
      footer: {
        text: `The Corn Field Dota 2 • Today at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
      },
    };

    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [embed],
        components: [{
          type: 1,
          components: [{
            type: 2,
            style: 5,
            label: 'View Full Hall of Fame',
            url: 'https://thecornfield.figma.site/#hall-of-fame',
            emoji: { name: '🏛️' },
          }],
        }],
      },
    });
  } catch (error) {
    console.error('Error handling /hof command:', error);
    return jsonResponse(errorResponse('An unexpected error occurred. Please try again later.'));
  }
}
