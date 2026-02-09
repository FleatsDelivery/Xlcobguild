// ============================================================================
// NON-LEAGUE TOURNAMENT BUILDER - Helper Functions
// ============================================================================

/**
 * Helper function to convert Steam32 to Steam64
 */
export const steam32ToSteam64 = (steam32: string): string => {
  const accountId = BigInt(steam32);
  const steam64 = accountId + BigInt('76561197960265728');
  return steam64.toString();
};

/**
 * Helper function to normalize player ID (handle both Steam32 and Steam64)
 */
export const normalizePlayerId = (playerId: string): { steam32: string; steam64: string } => {
  const id = playerId.trim();
  
  // If it's a Steam64 ID (17 digits starting with 765...)
  if (id.length === 17 && id.startsWith('765')) {
    const steam64 = BigInt(id);
    const steam32 = (steam64 - BigInt('76561197960265728')).toString();
    return { steam32, steam64: id };
  }
  
  // Otherwise assume Steam32
  return {
    steam32: id,
    steam64: steam32ToSteam64(id)
  };
};

/**
 * Search for a match using player histories and date range
 */
export async function searchMatchViaPlayerHistory(
  allTeamPlayerIds: Array<{ steam32: string; steam64: string }>,
  team1: any,
  team2: any,
  startTimestamp: number,
  endTimestamp: number,
  baseDate: Date,
  startDate: Date,
  endDate: Date
) {
  if (allTeamPlayerIds.length === 0) {
    return {
      type: 'missing',
      data: {
        searchCriteria: `Teams: ${team1.name} vs ${team2.name} (no player IDs)`,
        dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
      }
    };
  }

  // Pick a player to search (preferably from team 1)
  const searchPlayerId = allTeamPlayerIds[0];
  
  console.log(`   Using player ${searchPlayerId.steam32} for history search`);
  
  try {
    // Use OpenDota player matches endpoint
    const playerMatchesUrl = `https://api.opendota.com/api/players/${searchPlayerId.steam32}/matches?date=${Math.floor(baseDate.getTime() / 1000)}&limit=50`;
    
    console.log(`   Fetching: ${playerMatchesUrl}`);
    
    const playerMatchesResponse = await fetch(playerMatchesUrl);
    
    if (!playerMatchesResponse.ok) {
      throw new Error('Failed to fetch player matches');
    }
    
    const playerMatches = await playerMatchesResponse.json();
    
    console.log(`   Found ${playerMatches.length} matches in player history`);
    
    // Filter matches by date range
    const matchesInRange = playerMatches.filter((m: any) => {
      const matchTime = m.start_time;
      return matchTime >= startTimestamp && matchTime <= endTimestamp;
    });
    
    console.log(`   ${matchesInRange.length} matches within date range`);
    
    if (matchesInRange.length === 0) {
      return {
        type: 'missing',
        data: {
          searchCriteria: `Teams: ${team1.name} vs ${team2.name}, Players: ${allTeamPlayerIds.length}`,
          dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
        }
      };
    }
    
    // For each potential match, fetch full details and calculate confidence
    const potentialMatches = [];
    
    for (const potentialMatch of matchesInRange.slice(0, 10)) { // Limit to top 10
      try {
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const matchDetailResponse = await fetch(`https://api.opendota.com/api/matches/${potentialMatch.match_id}`);
        
        if (!matchDetailResponse.ok) continue;
        
        const matchDetail = await matchDetailResponse.json();
        
        if (matchDetail.error) continue;
        
        // Calculate how many expected players are in this match
        const expectedPlayerIds = allTeamPlayerIds.map(p => p.steam32);
        const matchPlayerIds = matchDetail.players?.map((p: any) => 
          p.account_id?.toString() || ''
        ) || [];
        
        const matchingPlayers = expectedPlayerIds.filter((id: string) => 
          matchPlayerIds.includes(id)
        );
        
        let confidence = (matchingPlayers.length / expectedPlayerIds.length) * 100;
        
        // Bonus points if team IDs match
        if (team1.teamId && team2.teamId) {
          const radiantTeamId = matchDetail.radiant_team_id?.toString();
          const direTeamId = matchDetail.dire_team_id?.toString();
          
          const teamIdsMatch = (
            (radiantTeamId === team1.teamId && direTeamId === team2.teamId) ||
            (radiantTeamId === team2.teamId && direTeamId === team1.teamId)
          );
          
          if (teamIdsMatch) {
            confidence = Math.min(100, confidence + 20);
          }
        }
        
        potentialMatches.push({
          matchId: potentialMatch.match_id,
          matchData: matchDetail,
          radiantName: matchDetail.radiant_name || team1.name || 'Team 1',
          direName: matchDetail.dire_name || team2.name || 'Team 2',
          confidence: Math.round(confidence),
          matchingPlayers: matchingPlayers.length,
          totalExpected: expectedPlayerIds.length,
          startTime: potentialMatch.start_time
        });
        
      } catch (error) {
        console.error(`   Error fetching match detail:`, error);
      }
    }
    
    // Sort by confidence
    potentialMatches.sort((a, b) => b.confidence - a.confidence);
    
    if (potentialMatches.length === 0) {
      console.log(`   ❌ No matches found with player overlap`);
      return {
        type: 'missing',
        data: {
          searchCriteria: `Teams: ${team1.name} vs ${team2.name}, Players: ${allTeamPlayerIds.length}`,
          dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
        }
      };
    } else {
      const topMatch = potentialMatches[0];
      
      // New confidence thresholds:
      // 80-100% = excellent (found)
      // 50-79% = great (found)
      // 20-49% = partial (uncertain)
      // 0-19% = low (uncertain)
      
      if (topMatch.confidence >= 50) {
        // High confidence (50%+) - add to found
        const confidenceLabel = topMatch.confidence >= 80 ? 'excellent' : 'great';
        console.log(`   ✅ Found match ${topMatch.matchId} (${topMatch.confidence}% confidence - ${confidenceLabel})`);
        
        return {
          type: 'found',
          data: {
            ...topMatch,
            source: 'Player history search (OpenDota)'
          }
        };
      } else {
        // Low confidence (0-49%) - uncertain
        console.log(`   ⚠️  Found ${potentialMatches.length} potential matches`);
        
        return {
          type: 'uncertain',
          data: {
            matches: potentialMatches.slice(0, 3), // Top 3
            searchCriteria: `Teams: ${team1.name} vs ${team2.name}`,
            dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
          }
        };
      }
    }
    
  } catch (error) {
    console.error(`   ❌ Error searching player matches:`, error);
    return {
      type: 'missing',
      data: {
        searchCriteria: `Teams: ${team1.name} vs ${team2.name} (search error)`,
        dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
      }
    };
  }
}