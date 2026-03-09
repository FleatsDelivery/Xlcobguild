/**
 * Dota Lookup Routes -- fetch team/player data from Steam + OpenDota
 * 2 routes: GET /dota/team/:teamId, GET /dota/player/:steamId
 */
import type { Hono } from "npm:hono";
import { normalizePlayerId, PREFIX } from "./helpers.ts";

export function registerDotaLookupRoutes(app: Hono) {

  // Fetch team data (Steam API with OpenDota fallback)
  app.get(`${PREFIX}/dota/team/:teamId`, async (c) => {
    try {
      const teamId = c.req.param('teamId');
      const steamKey = Deno.env.get('STEAM_WEB_API_KEY');
      
      // Try Steam API first
      if (steamKey) {
        try {
          const url = `https://api.steampowered.com/IDOTA2Match_570/GetTeamInfoByTeamID/v1/?key=${steamKey}&start_at_team_id=${teamId}&teams_requested=1`;
          const response = await fetch(url);
          
          if (response.ok) {
            const data = await response.json();
            if (data.result?.teams && data.result.teams.length > 0) {
              const teamData = data.result.teams[0];
              return c.json({
                name: teamData.name || 'Unknown Team',
                tag: teamData.tag || null,
                logo_url: teamData.logo || teamData.url_logo || null,
                team_id: teamData.team_id || parseInt(teamId),
                source: 'steam'
              });
            }
          }
        } catch (steamError) {
          console.log('Steam API error, falling back to OpenDota:', steamError);
        }
      }
      
      // Fallback to OpenDota
      const odResponse = await fetch(`https://api.opendota.com/api/teams/${teamId}`);
      if (!odResponse.ok) {
        return c.json({ error: 'Team not found in Steam or OpenDota' }, 404);
      }

      const text = await odResponse.text();
      if (!text) return c.json({ error: 'Empty response from OpenDota' }, 404);

      const teamData = JSON.parse(text);
      return c.json({
        name: teamData.name || 'Unknown Team',
        tag: teamData.tag || null,
        logo_url: teamData.logo_url || null,
        team_id: parseInt(teamId),
        source: 'opendota'
      });
    } catch (error) {
      console.error('Failed to fetch team:', error);
      return c.json({ error: `Failed to fetch team data: ${error.message}` }, 500);
    }
  });

  // Fetch player data by Steam ID (Steam API with OpenDota fallback)
  app.get(`${PREFIX}/dota/player/:steamId`, async (c) => {
    try {
      const steamId = c.req.param('steamId');
      const steamKey = Deno.env.get('STEAM_WEB_API_KEY');
      
      const normalized = normalizePlayerId(steamId);
      const steam64 = normalized.steam64;
      const accountId = normalized.steam32;
      
      // Try Steam API first
      if (steamKey) {
        try {
          const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamKey}&steamids=${steam64}`;
          const response = await fetch(url);
          
          if (response.ok) {
            const data = await response.json();
            if (data.response?.players && data.response.players.length > 0) {
              const playerData = data.response.players[0];
              return c.json({
                accountId: accountId,
                name: playerData.personaname || 'Unknown Player',
                avatar: playerData.avatarfull || playerData.avatarmedium || playerData.avatar || null,
                source: 'steam'
              });
            }
          }
        } catch (steamError) {
          console.log('Steam API error, falling back to OpenDota:', steamError);
        }
      }
      
      // Fallback to OpenDota
      const odResponse = await fetch(`https://api.opendota.com/api/players/${accountId}`);
      if (!odResponse.ok) {
        return c.json({ error: 'Player not found in Steam or OpenDota' }, 404);
      }

      const text = await odResponse.text();
      if (!text) return c.json({ error: 'Empty response from OpenDota' }, 404);

      const playerData = JSON.parse(text);
      return c.json({
        accountId: accountId,
        name: playerData.profile?.personaname || 'Unknown Player',
        avatar: playerData.profile?.avatarfull || playerData.profile?.avatar || null,
        source: 'opendota'
      });
    } catch (error) {
      console.error('Failed to fetch player:', error);
      return c.json({ error: `Failed to fetch player data: ${error.message}` }, 500);
    }
  });

}
