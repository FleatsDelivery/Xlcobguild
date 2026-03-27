/**
 * Steam API Research Routes -- dev/debug endpoints for exploring Steam APIs
 * 4 routes for testing, fetching league data, and comparing API sources
 */
import type { Hono } from "npm:hono";
import * as steamResearch from "./steam-api-research.tsx";
import { PREFIX } from "./helpers.ts";

export function registerSteamResearchRoutes(app: Hono) {

  // Test all Steam API endpoints with real Kernel Kup data
  app.get(`${PREFIX}/steam-research/test-all`, async (c) => {
    console.log('Testing all Steam API endpoints...');
    
    const results = await steamResearch.testAllSteamEndpoints({
      leagueId: 16273,      // Kernel Kup 5
      seriesId: 2520166,    // C.DAWGS vs FOOP
      matchId: 7616356796,  // C.DAWGS victory
      teamId: 9359693,      // FOOP
      playerId: 108977424   // Sneetch
    });

    return c.json({
      message: 'Steam API Research Complete',
      timestamp: new Date().toISOString(),
      results
    });
  });

  // Get comprehensive league data
  app.get(`${PREFIX}/steam-research/league/:leagueId`, async (c) => {
    const leagueId = parseInt(c.req.param('leagueId'));
    const data = await steamResearch.getLeagueComprehensiveData(leagueId);
    
    return c.json({
      message: `League ${leagueId} Research`,
      timestamp: new Date().toISOString(),
      data
    });
  });

  // Compare OpenDota vs Steam API for a league
  app.get(`${PREFIX}/steam-research/compare/:leagueId`, async (c) => {
    const leagueId = parseInt(c.req.param('leagueId'));
    
    const [steamData, openDotaData] = await Promise.all([
      steamResearch.getLeagueComprehensiveData(leagueId),
      steamResearch.checkOpenDotaLeagueData(leagueId)
    ]);
    
    return c.json({
      message: `League ${leagueId} Comparison`,
      timestamp: new Date().toISOString(),
      steam: steamData,
      openDota: openDotaData,
      recommendation: 'Check which API provides better data for your use case'
    });
  });

  // Compare Steam vs OpenDota for a specific match
  app.get(`${PREFIX}/steam-research/compare-match/:matchId`, async (c) => {
    const matchId = parseInt(c.req.param('matchId'));
    const comparison = await steamResearch.compareSteamVsOpenDota(matchId);
    return c.json(comparison);
  });

}
