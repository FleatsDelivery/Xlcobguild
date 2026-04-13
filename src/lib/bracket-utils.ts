export interface BracketMatch {
  id: string;
  series_id?: string;
  team1_id?: string;
  team2_id?: string;
  winner_team_id?: string;
  team1?: { id: string; team_name: string; team_tag: string; logo_url?: string | null } | null;
  team2?: { id: string; team_name: string; team_tag: string; logo_url?: string | null } | null;
  team1_score?: number;
  team2_score?: number;
  game_number?: number;
  [key: string]: any;
}

export interface BracketSeries {
  series_id: string;
  team1: BracketMatch['team1'];
  team2: BracketMatch['team2'];
  team1_id: string;
  team2_id: string;
  team1_wins: number;
  team2_wins: number;
  winner_team_id?: string;
  matches: BracketMatch[];
}

/**
 * Aggregates an array of individual BracketMatches into a list of consolidated BracketSeries.
 * Resolves teams swapping sides (Radiant/Dire) across different games in the same series.
 */
export function groupMatchesIntoSeries(matches: BracketMatch[]): BracketSeries[] {
  const seriesMap = new Map<string, BracketSeries>();

  // Ensure matches are sorted by game_number or ID so chronological flow is somewhat preserved
  const sortedMatches = [...matches].sort((a, b) => (a.game_number || 0) - (b.game_number || 0));

  for (const match of sortedMatches) {
    const t1 = match.team1_id || 'tbd1';
    const t2 = match.team2_id || 'tbd2';
    
    // Sort team pairs so that team A vs Team B is identical to Team B vs Team A
    const teamPairId = [t1, t2].sort().join('-vs-');
    
    // Use explicit series_id if available, otherwise fallback to the unique team pair ID.
    // If it's literally a TBD vs TBD placeholder, isolate it by Match ID so they don't incorrectly merge.
    const computedSeriesId =
      match.series_id ||
      (t1 !== 'tbd1' && t2 !== 'tbd2' ? teamPairId : match.id);

    if (!seriesMap.has(computedSeriesId)) {
      // The first chronological match dictates who is "Team 1" (Top) and "Team 2" (Bottom)
      // This ensures visual consistency across the series even if side selection changes later.
      seriesMap.set(computedSeriesId, {
        series_id: computedSeriesId,
        team1: match.team1,
        team2: match.team2,
        team1_id: t1,
        team2_id: t2,
        team1_wins: 0,
        team2_wins: 0,
        matches: [],
      });
    }

    const series = seriesMap.get(computedSeriesId)!;
    series.matches.push(match);

    // Safely tally wins/scores against the "canonical" teams for this series
    // Since Radiant/Dire (team1/team2 in Match data) can swap, we check real team IDs.
    const matchWinnerId = match.winner_team_id;
    if (matchWinnerId === series.team1_id) {
      series.team1_wins++;
    } else if (matchWinnerId === series.team2_id) {
      series.team2_wins++;
    } else if (!matchWinnerId) {
      // If there's no defined winner but scores exist (maybe an incomplete match or raw data)
      // We could add the scores up, but esports BO3 sets generally just tally games won.
      // E.g. team1_score = 1 means they won 1 game.
      if (match.team1_id === series.team1_id && (match.team1_score || 0) > 0) series.team1_wins += match.team1_score!;
      else if (match.team2_id === series.team1_id && (match.team2_score || 0) > 0) series.team1_wins += match.team2_score!;

      if (match.team1_id === series.team2_id && (match.team1_score || 0) > 0) series.team2_wins += match.team1_score!;
      else if (match.team2_id === series.team2_id && (match.team2_score || 0) > 0) series.team2_wins += match.team2_score!;
    }
  }

  const result: BracketSeries[] = [];
  for (const series of seriesMap.values()) {
    // Basic completion heuristic: Whoever has more wins gets marked as winner.
    if (series.team1_wins > series.team2_wins) series.winner_team_id = series.team1_id;
    else if (series.team2_wins > series.team1_wins) series.winner_team_id = series.team2_id;
    
    result.push(series);
  }

  return result;
}
