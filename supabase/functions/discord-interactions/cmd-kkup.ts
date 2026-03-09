// /kkup slash command handler — View Kernel Kup tournament standings
import { errorResponse, InteractionResponseType, jsonResponse } from './utils.ts';

export async function handleKkup(body: any, supabase: any): Promise<Response> {
  try {
    const options = body.data.options || [];
    const tournamentNumber = options.find((opt: any) => opt.name === 'tournament')?.value;

    if (!tournamentNumber) {
      return jsonResponse(errorResponse('Please select a tournament number!'));
    }

    // Look up the tournament by name
    const { data: tournament, error: tournamentError } = await supabase
      .from('kkup_tournaments')
      .select('*')
      .ilike('name', `Kernel Kup ${tournamentNumber}`)
      .maybeSingle();

    if (tournamentError || !tournament) {
      console.error('Tournament lookup error:', tournamentError);
      return jsonResponse(errorResponse(`Kernel Kup ${tournamentNumber} not found in the database!`));
    }

    console.log(`/kkup command: Found tournament "${tournament.name}" (${tournament.id})`);

    // Fetch teams for this tournament
    const { data: teams } = await supabase
      .from('kkup_teams')
      .select('id, team_name, team_tag, logo_url, wins, losses')
      .eq('tournament_id', tournament.id)
      .order('wins', { ascending: false });

    // Fetch matches to compute series records
    const { data: matches } = await supabase
      .from('kkup_matches')
      .select('id, team1_id, team2_id, winner_team_id, series_id, team1_score, team2_score')
      .eq('tournament_id', tournament.id);

    // Compute series records and game records for each team
    const teamRecords: Record<string, { series_wins: number; series_losses: number; game_wins: number; game_losses: number; total_kills: number }> = {};
    (teams || []).forEach((t: any) => {
      teamRecords[t.id] = { series_wins: 0, series_losses: 0, game_wins: 0, game_losses: 0, total_kills: 0 };
    });

    if (matches && matches.length > 0) {
      // Infer series_id for matches without one
      let inferredCounter = 1000000;
      const seriesKeyMap = new Map<string, number>();
      const sortedMatches = [...matches].sort((a: any, b: any) =>
        (a.scheduled_time || '').localeCompare(b.scheduled_time || '')
      );
      for (const m of sortedMatches) {
        if (!m.series_id) {
          const key = [m.team1_id, m.team2_id].sort().join('-');
          if (!seriesKeyMap.has(key)) seriesKeyMap.set(key, inferredCounter++);
          m.series_id = seriesKeyMap.get(key);
        }
      }

      // Game wins
      for (const m of matches) {
        if (m.winner_team_id) {
          if (m.team1_id === m.winner_team_id) {
            if (teamRecords[m.team1_id]) teamRecords[m.team1_id].game_wins++;
            if (teamRecords[m.team2_id]) teamRecords[m.team2_id].game_losses++;
          } else if (m.team2_id === m.winner_team_id) {
            if (teamRecords[m.team2_id]) teamRecords[m.team2_id].game_wins++;
            if (teamRecords[m.team1_id]) teamRecords[m.team1_id].game_losses++;
          }
        }
      }

      // Series wins
      const seriesMap = new Map<number, { team1_id: string; team2_id: string; team1_wins: number; team2_wins: number }>();
      for (const m of matches) {
        if (!m.series_id) continue;
        if (!seriesMap.has(m.series_id)) {
          seriesMap.set(m.series_id, { team1_id: m.team1_id, team2_id: m.team2_id, team1_wins: 0, team2_wins: 0 });
        }
        const s = seriesMap.get(m.series_id)!;
        if (m.winner_team_id === s.team1_id) s.team1_wins++;
        else if (m.winner_team_id === s.team2_id) s.team2_wins++;
      }
      seriesMap.forEach((s) => {
        if (s.team1_wins > s.team2_wins) {
          if (teamRecords[s.team1_id]) teamRecords[s.team1_id].series_wins++;
          if (teamRecords[s.team2_id]) teamRecords[s.team2_id].series_losses++;
        } else if (s.team2_wins > s.team1_wins) {
          if (teamRecords[s.team2_id]) teamRecords[s.team2_id].series_wins++;
          if (teamRecords[s.team1_id]) teamRecords[s.team1_id].series_losses++;
        }
      });
    }

    // Sort teams by series wins, then game wins
    const sortedTeams = (teams || []).map((t: any) => ({
      ...t,
      ...teamRecords[t.id],
    })).sort((a: any, b: any) => {
      if (b.series_wins !== a.series_wins) return b.series_wins - a.series_wins;
      return b.game_wins - a.game_wins;
    });

    // Fetch player stats to find the top performer (best KDA)
    const matchIds = (matches || []).map((m: any) => m.id);
    let topPlayerLine = '';

    if (matchIds.length > 0) {
      const { data: playerStats } = await supabase
        .from('kkup_player_match_stats')
        .select('person_id, hero, kills, deaths, assists')
        .in('match_id', matchIds);

      if (playerStats && playerStats.length > 0) {
        // Need to look up person names
        const personIds = [...new Set(playerStats.map((s: any) => s.person_id).filter(Boolean))];
        let personNameMap: Record<string, string> = {};
        if (personIds.length > 0) {
          const { data: persons } = await supabase
            .from('kkup_persons')
            .select('id, display_name')
            .in('id', personIds);
          (persons || []).forEach((p: any) => { personNameMap[p.id] = p.display_name; });
        }

        // Aggregate stats per player
        const playerAgg: Record<string, { name: string; kills: number; deaths: number; assists: number; games: number }> = {};
        for (const stat of playerStats) {
          const key = stat.person_id || 'unknown';
          if (!playerAgg[key]) {
            playerAgg[key] = { name: personNameMap[stat.person_id] || 'Unknown', kills: 0, deaths: 0, assists: 0, games: 0 };
          }
          playerAgg[key].kills += stat.kills || 0;
          playerAgg[key].deaths += stat.deaths || 0;
          playerAgg[key].assists += stat.assists || 0;
          playerAgg[key].games++;
        }

        // Find best KDA (minimum 2 games)
        let bestKDA = -1;
        let bestPlayer: any = null;
        for (const p of Object.values(playerAgg)) {
          if (p.games < 2) continue;
          const kda = p.deaths === 0 ? p.kills + p.assists : (p.kills + p.assists) / p.deaths;
          if (kda > bestKDA) {
            bestKDA = kda;
            bestPlayer = p;
          }
        }

        if (bestPlayer) {
          topPlayerLine = `⭐ **${bestPlayer.name}** — ${bestKDA.toFixed(2)} KDA (${bestPlayer.kills}/${bestPlayer.deaths}/${bestPlayer.assists} across ${bestPlayer.games} games)`;
        }
      }
    }

    // Check for Pop'd Kernel award for this tournament (from real table columns)
    let popdKernelLine = '';
    const popdPersonIds = [tournament.popd_kernel_1_person_id, tournament.popd_kernel_2_person_id].filter(Boolean);
    if (popdPersonIds.length > 0) {
      const { data: popdPersons } = await supabase
        .from('kkup_persons')
        .select('id, display_name')
        .in('id', popdPersonIds);

      if (popdPersons && popdPersons.length > 0) {
        const names = popdPersons.map((p: any) => p.display_name || 'Unknown').join(', ');
        popdKernelLine = `🍿 **Pop'd Kernel:** ${names}`;
      }
    }

    // Format dates
    const formatDate = (dateStr: string) => {
      if (!dateStr) return 'TBA';
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Build standings lines
    const standingsLines = sortedTeams.map((team: any, i: number) => {
      let medal = '';
      if (i === 0) medal = '🥇';
      else if (i === 1) medal = '🥈';
      else if (i === 2) medal = '🥉';
      else medal = `**#${i + 1}**`;

      const gameRecord = `${team.game_wins}-${team.game_losses}`;
      const seriesRecord = `${team.series_wins}-${team.series_losses} series`;
      return `${medal} **${team.team_name}** — ${gameRecord} (${seriesRecord})`;
    });

    // Status badge
    const statusText = tournament.status === 'completed' ? '🏆 Completed'
      : tournament.status === 'in_progress' || tournament.status === 'live' ? '⚡ In Progress'
      : tournament.status === 'registration_open' ? '📝 Registration Open'
      : tournament.status || 'Unknown';

    // Build embed fields
    const fields: any[] = [];

    if (standingsLines.length > 0) {
      fields.push({
        name: '━━━━ Final Standings ━━━━',
        value: standingsLines.join('\n'),
        inline: false,
      });
    }

    if (topPlayerLine || popdKernelLine) {
      const mvpLines = [topPlayerLine, popdKernelLine].filter(Boolean).join('\n');
      fields.push({
        name: '━━━━ Tournament Highlights ━━━━',
        value: mvpLines,
        inline: false,
      });
    }

    const embed: any = {
      title: `🌽 ${tournament.name}`,
      description: `📅 ${formatDate(tournament.tournament_start_date)} — ${formatDate(tournament.tournament_end_date)}\n${statusText} • ${sortedTeams.length} Teams • ${(matches || []).length} Games`,
      fields,
      color: 0xF97316,
      footer: {
        text: tournament.description || 'The Corn Field Dota 2 Championship',
      },
    };

    // Add league icon as thumbnail if available
    const slug = tournament.name
      .toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const leagueIconUrl = `https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/make-4789f4af-kkup-assets/${slug}/league_square_icon.png`;
    embed.thumbnail = { url: leagueIconUrl };

    const response = {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [embed],
        components: [{
          type: 1,
          components: [{
            type: 2,
            style: 5,
            label: `View ${tournament.name}`,
            url: `https://thecornfield.figma.site/#kkup/${tournament.id}`,
            emoji: { name: '🌽' },
          }],
        }],
      },
    };

    return jsonResponse(response);
  } catch (error) {
    console.error('Error handling /kkup command:', error);
    return jsonResponse(errorResponse('An unexpected error occurred. Please try again later.'));
  }
}