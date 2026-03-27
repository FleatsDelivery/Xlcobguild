/**
 * Practice Tournament Routes — KV-backed ephemeral tournament system
 * 
 * Lets officers spin up a throwaway tournament from a Steam league_id,
 * test the live match UI with real data, and nuke it when done.
 * Zero contamination of kkup_* tables.
 * 
 * KV key patterns:
 *   practice:{league_id}:meta              → tournament metadata
 *   practice:{league_id}:teams             → teams derived from match data
 *   practice:{league_id}:matches           → array of completed match summaries
 *   practice:{league_id}:match:{match_id}  → detailed match data + player stats
 * 
 * 7 routes registered under /practice/*
 */

import type { Hono } from "npm:hono";
import { PREFIX, getHeroName as getStaticHeroName, getSteamLogoUrl } from "./helpers.ts";
import { isOfficer } from "./roles.ts";
import * as kv from "./kv_store.tsx";

const STEAM_API_BASE = 'https://api.steampowered.com';
const DOTA2_APP_ID = 570;
const OPENDOTA_API_BASE = 'https://api.opendota.com/api';

// ═══════════════════════════════════════════════════════
// HERO DATA CACHE — fetch once from OpenDota, cache in memory
// ══════════════════════════════════════════════════════

/** Dynamic hero cache: hero_id → { name, internal_name } */
let heroCache: Record<number, { name: string; internal_name: string }> | null = null;
let heroCacheFetchPromise: Promise<void> | null = null;

/** Populate hero cache from OpenDota /api/heroes */
async function ensureHeroCache(): Promise<void> {
  if (heroCache) return;
  if (heroCacheFetchPromise) { await heroCacheFetchPromise; return; }

  heroCacheFetchPromise = (async () => {
    try {
      const apiKey = Deno.env.get('OPENDOTA_API_KEY') ?? '';
      const separator = apiKey ? '?api_key=' + apiKey : '';
      const res = await fetch(`https://api.opendota.com/api/heroes${separator}`);
      if (res.ok) {
        const heroes = await res.json();
        const cache: Record<number, { name: string; internal_name: string }> = {};
        for (const hero of heroes) {
          if (hero.id && hero.localized_name) {
            // hero.name is like "npc_dota_hero_antimage" → strip prefix for CDN name
            const internal = (hero.name || '').replace(/^npc_dota_hero_/, '');
            cache[hero.id] = { name: hero.localized_name, internal_name: internal };
          }
        }
        if (Object.keys(cache).length > 50) {
          heroCache = cache;
          console.log(`Hero cache loaded: ${Object.keys(cache).length} heroes from OpenDota`);
          return;
        }
      }
    } catch (err) {
      console.log('OpenDota hero fetch failed:', err);
    }
    heroCache = {}; // empty cache so we don't retry every request
  })();

  await heroCacheFetchPromise;
}

/** Get hero display name — tries dynamic cache first, falls back to static map */
function getHeroName(heroId: number): string {
  if (heroCache && heroCache[heroId]) return heroCache[heroId].name;
  return getStaticHeroName(heroId);
}

// ═══════════════════════════════════════════════════════
// ITEM DATA CACHE — fetch once from Steam, cache in memory
// ═══════════════════════════════════════════════════════

/** Cached map of item_id → internal_name (e.g. 1 → "blink", 63 → "power_treads") */
let itemNameCache: Record<number, string> | null = null;
let itemCacheFetchPromise: Promise<void> | null = null;

/** Populate item cache from Steam GetGameItems or OpenDota constants */
async function ensureItemCache(): Promise<void> {
  if (itemNameCache) return;
  if (itemCacheFetchPromise) { await itemCacheFetchPromise; return; }

  itemCacheFetchPromise = (async () => {
    try {
      // Try OpenDota constants first (no API key needed, reliable)
      const res = await fetch('https://api.opendota.com/api/constants/items');
      if (res.ok) {
        const data = await res.json();
        const cache: Record<number, string> = {};
        // OpenDota returns { "blink": { id: 1, img: "/apps/...", ... }, ... }
        for (const [name, item] of Object.entries(data)) {
          if ((item as any)?.id) {
            cache[(item as any).id] = name;
          }
        }
        if (Object.keys(cache).length > 50) {
          itemNameCache = cache;
          console.log(`Item cache loaded: ${Object.keys(cache).length} items from OpenDota`);
          return;
        }
      }
    } catch (err) {
      console.log('OpenDota item fetch failed, trying Steam:', err);
    }

    try {
      // Steam fallback
      const data = await steamFetch(`/IEconDOTA2_${DOTA2_APP_ID}/GetGameItems/v1/`);
      const items = data?.result?.items || [];
      const cache: Record<number, string> = {};
      for (const item of items) {
        // Steam returns name as "item_blink" → strip "item_" prefix
        const name = (item.name || '').replace(/^item_/, '');
        if (item.id && name) cache[item.id] = name;
      }
      itemNameCache = cache;
      console.log(`Item cache loaded: ${Object.keys(cache).length} items from Steam`);
    } catch (err) {
      console.log('Steam item fetch also failed:', err);
      itemNameCache = {}; // empty cache so we don't retry every request
    }
  })();

  await itemCacheFetchPromise;
}

/** Get item internal name from cached data */
function getItemName(itemId: number): string {
  if (!itemId || !itemNameCache) return '';
  return itemNameCache[itemId] || '';
}

// ═══════════════════════════════════════════════════════
// PLAYER RANK CACHE — fetch from OpenDota, cache in memory
// ═══════════════════════════════════════════════════════

/**
 * In-memory cache: account_id → rank_tier (e.g. 53 = Ancient 3, 71 = Immortal 1)
 * null value = "we tried but couldn't get rank" (avoids refetching)
 */
const rankCache: Record<number, number | null> = {};

/** Fetch rank for a single account from OpenDota. Returns rank_tier or null. */
async function fetchPlayerRank(accountId: number): Promise<number | null> {
  if (!accountId || accountId === 0) return null;

  // Check cache first
  if (accountId in rankCache) return rankCache[accountId];

  try {
    const apiKey = Deno.env.get('OPENDOTA_API_KEY') ?? '';
    const separator = apiKey ? '?api_key=' + apiKey : '';
    const res = await fetch(`https://api.opendota.com/api/players/${accountId}${separator}`);
    if (!res.ok) {
      rankCache[accountId] = null;
      return null;
    }
    const data = await res.json();
    const rankTier = data?.rank_tier || null;
    rankCache[accountId] = rankTier;
    return rankTier;
  } catch (err) {
    console.log(`Non-critical: rank fetch failed for ${accountId}:`, err);
    rankCache[accountId] = null;
    return null;
  }
}

/**
 * Batch-fetch ranks for multiple account IDs.
 * Fetches in parallel with a concurrency limit to avoid hammering OpenDota.
 */
async function fetchPlayerRanks(accountIds: number[]): Promise<void> {
  // Filter to only IDs we haven't cached yet
  const uncached = accountIds.filter(id => id > 0 && !(id in rankCache));
  if (uncached.length === 0) return;

  // Fetch in batches of 5 to be gentle on OpenDota rate limits
  const BATCH_SIZE = 5;
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(id => fetchPlayerRank(id)));
  }
}

/** Get cached rank_tier for an account. Returns null if unknown. */
function getCachedRank(accountId: number): number | null {
  if (!accountId || accountId === 0) return null;
  return rankCache[accountId] ?? null;
}

// ═══════════════════════════════════════════════════════
// STEAM API HELPERS
// ═══════════════════════════════════════════════════════

async function steamFetch(path: string, params: Record<string, string | number> = {}) {
  const key = Deno.env.get('STEAM_WEB_API_KEY') ?? '';
  const qs = new URLSearchParams({ key, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const url = `${STEAM_API_BASE}${path}?${qs}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Steam API ${res.status}: ${path}`);
  return res.json();
}

/** Fetch from OpenDota API (used as fallback when Steam 500s) */
async function opendotaFetch(path: string) {
  const apiKey = Deno.env.get('OPENDOTA_API_KEY') ?? '';
  const separator = path.includes('?') ? '&' : '?';
  const url = `${OPENDOTA_API_BASE}${path}${apiKey ? `${separator}api_key=${apiKey}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenDota API ${res.status}: ${path}`);
  return res.json();
}

/** Pull league info — try OpenDota first (reliable), Steam as fallback */
async function getLeagueInfo(leagueId: number) {
  // OpenDota has league info at /leagues/{id}
  try {
    const data = await opendotaFetch(`/leagues/${leagueId}`);
    if (data?.name) return { leagueid: leagueId, name: data.name, tier: data.tier };
  } catch (err) {
    console.log(`OpenDota league lookup failed, trying Steam: ${err}`);
  }
  // Steam fallback (often deprecated/broken)
  try {
    const data = await steamFetch(`/IDOTA2Match_${DOTA2_APP_ID}/GetLeagueListing/v1/`);
    return data?.result?.leagues?.find((l: any) => l.leagueid === leagueId) || null;
  } catch (err) {
    console.log(`Steam GetLeagueListing also failed: ${err}`);
    return null;
  }
}

/** Pull match history for a league */
async function getLeagueMatches(leagueId: number): Promise<any[]> {
  const allMatches: any[] = [];
  let startAtMatchId: number | undefined;

  // Steam returns max 100 per request; paginate
  for (let i = 0; i < 10; i++) {
    const params: Record<string, string | number> = {
      league_id: leagueId,
      matches_requested: 100,
    };
    if (startAtMatchId) params.start_at_match_id = startAtMatchId;

    const data = await steamFetch(`/IDOTA2Match_${DOTA2_APP_ID}/GetMatchHistory/v1/`, params);
    const matches = data?.result?.matches || [];
    if (matches.length === 0) break;

    allMatches.push(...matches);

    // If fewer than requested, no more pages
    if (matches.length < 100 || data?.result?.results_remaining === 0) break;

    // Next page starts after the last match
    startAtMatchId = matches[matches.length - 1].match_id - 1;
  }

  return allMatches;
}

/** Pull detailed match data — Steam first, OpenDota fallback */
async function getMatchDetails(matchId: number) {
  // Try Steam first
  try {
    const data = await steamFetch(`/IDOTA2Match_${DOTA2_APP_ID}/GetMatchDetails/v1/`, { match_id: matchId });
    if (data?.result) return data.result;
  } catch (err) {
    console.log(`Steam GetMatchDetails failed for ${matchId}, trying OpenDota...`);
  }

  // Fallback to OpenDota
  try {
    const od = await opendotaFetch(`/matches/${matchId}`);
    if (!od || !od.match_id) return null;

    // Normalize OpenDota shape → Steam-compatible shape
    return {
      match_id: od.match_id,
      match_seq_num: od.match_seq_num,
      radiant_win: od.radiant_win,
      duration: od.duration,
      start_time: od.start_time,
      radiant_team_id: od.radiant_team_id || od.radiant_team?.team_id || 0,
      dire_team_id: od.dire_team_id || od.dire_team?.team_id || 0,
      radiant_name: od.radiant_team?.name || null,
      dire_name: od.dire_team?.name || null,
      radiant_tag: od.radiant_team?.tag || null,
      dire_tag: od.dire_team?.tag || null,
      radiant_logo: od.radiant_team?.logo_url || null,
      dire_logo: od.dire_team?.logo_url || null,
      players: (od.players || []).map((p: any) => ({
        account_id: p.account_id || 0,
        player_slot: p.player_slot,
        hero_id: p.hero_id,
        kills: p.kills || 0,
        deaths: p.deaths || 0,
        assists: p.assists || 0,
        last_hits: p.last_hits || 0,
        denies: p.denies || 0,
        gold_per_min: p.gold_per_min || 0,
        xp_per_min: p.xp_per_min || 0,
        hero_damage: p.hero_damage || 0,
        tower_damage: p.tower_damage || 0,
        hero_healing: p.hero_healing || 0,
        net_worth: p.net_worth || p.total_gold || 0,
        gold: p.total_gold || 0,
        level: p.level || 0,
        persona: p.personaname || p.name || `Player ${p.player_slot}`,
      })),
      _source: 'opendota',
    };
  } catch (odErr) {
    console.error(`OpenDota also failed for match ${matchId}: ${odErr}`);
    return null;
  }
}

/** Pull live games for a league from GetLiveLeagueGames */
async function getLiveLeagueGames(leagueId: number) {
  // Steam's league_id filter is unreliable — sometimes returns empty even when games exist.
  // Strategy: try filtered first (fast), fallback to fetching ALL games and filtering client-side.
  try {
    const data = await steamFetch(`/IDOTA2Match_${DOTA2_APP_ID}/GetLiveLeagueGames/v1/`, { league_id: leagueId });
    const filtered = data?.result?.games || [];
    if (filtered.length > 0) {
      console.log(`GetLiveLeagueGames (filtered): found ${filtered.length} games for league ${leagueId}`);
      return filtered;
    }
  } catch (err) {
    console.log(`GetLiveLeagueGames filtered call failed for league ${leagueId}, trying unfiltered:`, err);
  }

  // Fallback: fetch ALL live league games, filter by league_id manually
  try {
    const allData = await steamFetch(`/IDOTA2Match_${DOTA2_APP_ID}/GetLiveLeagueGames/v1/`);
    const allGames = allData?.result?.games || [];
    
    // Debug: log all unique league IDs so we can identify mismatches
    const uniqueLeagueIds = [...new Set(allGames.map((g: any) => g.league_id))].sort((a: any, b: any) => a - b);
    console.log(`GetLiveLeagueGames (unfiltered): ${allGames.length} total live games across ${uniqueLeagueIds.length} leagues`);
    console.log(`  Looking for league_id=${leagueId} (type: ${typeof leagueId})`);
    console.log(`  All live league IDs: ${JSON.stringify(uniqueLeagueIds)}`);
    
    // Try both strict and loose matching (in case of string/number mismatch)
    let matched = allGames.filter((g: any) => g.league_id === leagueId);
    if (matched.length === 0) {
      // Try string comparison as fallback
      matched = allGames.filter((g: any) => String(g.league_id) === String(leagueId));
      if (matched.length > 0) {
        console.log(`  ⚠️ Found ${matched.length} games via STRING match (type coercion issue)`);
      }
    }
    
    console.log(`  Matched: ${matched.length} games for league ${leagueId}`);
    return matched;
  } catch (err) {
    console.error(`GetLiveLeagueGames unfiltered call also failed:`, err);
    return [];
  }
}

/** Pull team info by team ID — Steam first, OpenDota fallback */
async function getTeamInfo(teamId: number) {
  // Try Steam first
  try {
    const data = await steamFetch(`/IDOTA2Match_${DOTA2_APP_ID}/GetTeamInfoByTeamID/v1/`, {
      start_at_team_id: teamId,
      teams_requested: 1,
    });
    const team = data?.result?.teams?.[0];
    if (team && team.team_id === teamId) return team;
  } catch (err) {
    console.log(`Steam GetTeamInfoByTeamID failed for ${teamId}, trying OpenDota...`);
  }

  // Fallback to OpenDota /teams/{id}
  try {
    const od = await opendotaFetch(`/teams/${teamId}`);
    if (od && od.team_id) {
      return {
        team_id: od.team_id,
        name: od.name || `Team ${teamId}`,
        tag: od.tag || '???',
        logo: null, // OpenDota returns logo_url directly, not a Steam logo ID
        logo_url: od.logo_url || null, // direct URL
      };
    }
  } catch (odErr) {
    console.log(`OpenDota team lookup also failed for ${teamId}: ${odErr}`);
  }

  return null;
}

// ═══════════════════════════════════════════════════════
// TRANSFORM HELPERS — Steam data → our normalized shapes
// ═══════════════════════════════════════════════════════

/**
 * Transform Steam GetMatchDetails into our Match + PlayerStat shapes.
 * Keeps only the stats we already track: KDA, LH, denies, GPM, XPM,
 * hero_damage, tower_damage, hero_healing, net_worth, level.
 */
function transformMatchDetails(steam: any, teamLookup: Record<number, { name: string; tag: string; logo_url: string | null }>) {
  const radiantTeamId = steam.radiant_team_id || 0;
  const direTeamId = steam.dire_team_id || 0;

  const radiantTeam = teamLookup[radiantTeamId] || { name: `Team ${radiantTeamId}`, tag: 'RAD', logo_url: null };
  const direTeam = teamLookup[direTeamId] || { name: `Team ${direTeamId}`, tag: 'DIR', logo_url: null };

  // Compute team kill totals from player stats
  const players = steam.players || [];
  let radiantKills = 0;
  let direKills = 0;
  players.forEach((p: any) => {
    if (p.player_slot < 128) radiantKills += p.kills || 0;
    else direKills += p.kills || 0;
  });

  const winnerId = steam.radiant_win ? radiantTeamId : direTeamId;
  const winnerTeam = steam.radiant_win ? radiantTeam : direTeam;

  const match = {
    id: String(steam.match_id),
    match_id: steam.match_id,
    series_id: steam.match_seq_num || null,
    team1_id: String(radiantTeamId),
    team2_id: String(direTeamId),
    team1: { id: String(radiantTeamId), name: radiantTeam.name, tag: radiantTeam.tag, logo_url: radiantTeam.logo_url },
    team2: { id: String(direTeamId), name: direTeam.name, tag: direTeam.tag, logo_url: direTeam.logo_url },
    winner: { id: String(winnerId), name: winnerTeam.name, tag: winnerTeam.tag, logo_url: winnerTeam.logo_url },
    winner_team_id: String(winnerId),
    team1_score: radiantKills,
    team2_score: direKills,
    stage: 'group_stage',
    status: 'completed',
    scheduled_time: new Date(steam.start_time * 1000).toISOString(),
    duration: steam.duration || 0,
    dotabuff_url: `https://www.dotabuff.com/matches/${steam.match_id}`,
    youtube_url: null,
    twitch_vod_url: null,
    youtube_vod_url: null,
  };

  const playerStats = players.map((p: any) => {
    const isRadiant = p.player_slot < 128;
    const teamId = isRadiant ? radiantTeamId : direTeamId;
    const team = isRadiant ? radiantTeam : direTeam;

    return {
      id: `${steam.match_id}-${p.account_id || p.player_slot}`,
      match_id: String(steam.match_id),
      team_id: String(teamId),
      player_name: p.persona || `Player ${p.player_slot}`,
      steam_id: String(p.account_id || 0),
      account_id: p.account_id || 0,
      hero_id: p.hero_id || 0,
      hero_name: getHeroName(p.hero_id || 0),
      kills: p.kills || 0,
      deaths: p.deaths || 0,
      assists: p.assists || 0,
      last_hits: p.last_hits || 0,
      denies: p.denies || 0,
      gpm: p.gold_per_min || 0,
      xpm: p.xp_per_min || 0,
      hero_damage: p.hero_damage || 0,
      tower_damage: p.tower_damage || 0,
      hero_healing: p.hero_healing || 0,
      net_worth: p.net_worth || p.gold || 0,
      gold: p.gold || 0,
      level: p.level || 0,
      is_winner: isRadiant ? steam.radiant_win : !steam.radiant_win,
      player: {
        steam_id: String(p.account_id || 0),
        name: p.persona || `Player ${p.player_slot}`,
        avatar_url: null,
        dotabuff_url: p.account_id ? `https://www.dotabuff.com/players/${p.account_id}` : null,
        opendota_url: p.account_id ? `https://www.opendota.com/players/${p.account_id}` : null,
      },
      team: { id: String(teamId), name: team.name, tag: team.tag, logo_url: team.logo_url },
    };
  });

  return { match, playerStats };
}

/** Transform live game data into a clean shape for the frontend */
function transformLiveGame(game: any) {
  const scoreboard = game.scoreboard || {};
  const radiantSb = scoreboard.radiant || {};
  const direSb = scoreboard.dire || {};

  // ── DEBUG: log raw structure during draft/early game to diagnose missing picks ──
  const duration = scoreboard.duration || 0;
  const hasScoreboard = Object.keys(scoreboard).length > 0;
  const radPicks = radiantSb.picks || [];
  const dirPicks = direSb.picks || [];
  const radBans = radiantSb.bans || [];
  const dirBans = direSb.bans || [];

  if (duration <= 5) {
    console.log(`[LIVE DEBUG] match_id=${game.match_id} | hasScoreboard=${hasScoreboard} | duration=${duration}`);
    console.log(`[LIVE DEBUG]   scoreboard keys: ${JSON.stringify(Object.keys(scoreboard))}`);
    console.log(`[LIVE DEBUG]   radiantSb keys: ${JSON.stringify(Object.keys(radiantSb))}`);
    console.log(`[LIVE DEBUG]   radiant picks: ${JSON.stringify(radPicks)} | bans: ${JSON.stringify(radBans)}`);
    console.log(`[LIVE DEBUG]   dire picks: ${JSON.stringify(dirPicks)} | bans: ${JSON.stringify(dirBans)}`);
    // Check if picks/bans are at game level instead of inside scoreboard
    if (game.radiant_picks || game.dire_picks || game.radiant_bans || game.dire_bans) {
      console.log(`[LIVE DEBUG]   *** FOUND GAME-LEVEL DRAFT DATA ***`);
      console.log(`[LIVE DEBUG]   game.radiant_picks: ${JSON.stringify(game.radiant_picks)}`);
      console.log(`[LIVE DEBUG]   game.dire_picks: ${JSON.stringify(game.dire_picks)}`);
      console.log(`[LIVE DEBUG]   game.radiant_bans: ${JSON.stringify(game.radiant_bans)}`);
      console.log(`[LIVE DEBUG]   game.dire_bans: ${JSON.stringify(game.dire_bans)}`);
    }
    // Log top-level game keys so we can see the full shape
    console.log(`[LIVE DEBUG]   game top-level keys: ${JSON.stringify(Object.keys(game))}`);
  }

  // Build player name lookup from game.players (top-level has names; scoreboard does NOT)
  // Steam puts real player names in game.players[].name, keyed by account_id
  // game.players[].team: 0 = radiant, 1 = dire (or 2/3/4 for other slots)
  const playerNameByAccount: Record<number, string> = {};
  const playerNameByHero: Record<number, string> = {};
  (game.players || []).forEach((p: any) => {
    if (p.account_id && p.name) playerNameByAccount[p.account_id] = p.name;
    if (p.hero_id && p.name) playerNameByHero[p.hero_id] = p.name;
  });

  // Extract picks and bans — check both scoreboard and game-level locations
  const radiantPicks = (radiantSb.picks || game.radiant_picks || []).map((p: any) => ({ hero_id: p.hero_id, hero_name: getHeroName(p.hero_id) }));
  const direPicks = (direSb.picks || game.dire_picks || []).map((p: any) => ({ hero_id: p.hero_id, hero_name: getHeroName(p.hero_id) }));
  const radiantBans = (radiantSb.bans || game.radiant_bans || []).map((b: any) => ({ hero_id: b.hero_id, hero_name: getHeroName(b.hero_id) }));
  const direBans = (direSb.bans || game.dire_bans || []).map((b: any) => ({ hero_id: b.hero_id, hero_name: getHeroName(b.hero_id) }));

  const totalPicks = radiantPicks.length + direPicks.length;
  const totalBans = radiantBans.length + direBans.length;
  const hasDraftData = totalPicks > 0 || totalBans > 0;

  // Infer match phase from data shape
  // - No scoreboard → waiting (lobby exists but game hasn't loaded)
  // - Scoreboard exists, duration ~0, picks < 10 → drafting
  // - Scoreboard exists, duration ~0, picks = 10 → strategy (post-draft, pre-horn)  
  // - Scoreboard exists, duration > 0 → playing
  let phase: 'waiting' | 'drafting' | 'strategy' | 'playing' = 'waiting';
  if (hasScoreboard) {
    if (duration > 5) {
      phase = 'playing';
    } else if (totalPicks >= 10) {
      phase = 'strategy';
    } else if (hasDraftData) {
      phase = 'drafting';
    } else {
      // Scoreboard exists but no picks yet — could be early draft or waiting
      phase = hasScoreboard && (radiantSb.score !== undefined) ? 'drafting' : 'waiting';
    }
  }

  const result = {
    match_id: game.match_id,
    lobby_id: game.lobby_id,
    game_number: game.game_number || 1,
    spectators: game.spectators || 0,
    stream_delay_s: game.stream_delay_s || 0,
    duration,
    phase,

    // Series info
    series_type: game.series_type || 0, // 0=none, 1=bo3, 2=bo5
    radiant_series_wins: game.radiant_series_wins || 0,
    dire_series_wins: game.dire_series_wins || 0,

    // Team info
    radiant_team: {
      id: game.radiant_team?.team_id || 0,
      name: game.radiant_team?.team_name || 'Radiant',
      tag: game.radiant_team?.team_tag || 'RAD',
      logo_url: game.radiant_team?.team_logo ? getSteamLogoUrl(game.radiant_team.team_logo) : null,
    },
    dire_team: {
      id: game.dire_team?.team_id || 0,
      name: game.dire_team?.team_name || 'Dire',
      tag: game.dire_team?.team_tag || 'DIR',
      logo_url: game.dire_team?.team_logo ? getSteamLogoUrl(game.dire_team.team_logo) : null,
    },

    // Team scores
    radiant_score: radiantSb.score || 0,
    dire_score: direSb.score || 0,

    // Tower & barracks state (bitmasks)
    radiant_tower_state: radiantSb.tower_state || 0,
    dire_tower_state: direSb.tower_state || 0,
    radiant_barracks_state: radiantSb.barracks_state || 0,
    dire_barracks_state: direSb.barracks_state || 0,

    // Draft data
    radiant_picks: radiantPicks,
    dire_picks: direPicks,
    radiant_bans: radiantBans,
    dire_bans: direBans,

    // Player data — keep to our tracked stats
    // Cross-reference with game.players for real names (scoreboard.players.name is usually empty)
    radiant_players: (radiantSb.players || []).map((p: any) => {
      const realName = (p.account_id && playerNameByAccount[p.account_id]) ||
                       (p.hero_id && playerNameByHero[p.hero_id]) ||
                       p.name || '';
      return {
        account_id: p.account_id || 0,
        name: realName,
        hero_id: p.hero_id || 0,
        hero_name: getHeroName(p.hero_id || 0),
        kills: p.kills || 0,
        deaths: p.deaths || 0,
        assists: p.assists || 0,
        last_hits: p.last_hits || 0,
        denies: p.denies || 0,
        gpm: p.gold_per_min || 0,
        xpm: p.xp_per_min || 0,
        net_worth: p.net_worth || p.gold || 0,
        level: p.level || 0,
        // Phase 2: rich live data — positions, items, ult/respawn status
        position_x: p.position_x ?? 0,
        position_y: p.position_y ?? 0,
        items: [p.item0 || 0, p.item1 || 0, p.item2 || 0, p.item3 || 0, p.item4 || 0, p.item5 || 0].map(
          (id: number) => ({ id, name: getItemName(id) })
        ),
        respawn_timer: p.respawn_timer || 0,
        ultimate_state: p.ultimate_state ?? 0, // 0=not learned, 1=cooldown, 2=no mana, 3=ready
        ultimate_cooldown: p.ultimate_cooldown || 0,
      };
    }),
    dire_players: (direSb.players || []).map((p: any) => {
      const realName = (p.account_id && playerNameByAccount[p.account_id]) ||
                       (p.hero_id && playerNameByHero[p.hero_id]) ||
                       p.name || '';
      return {
        account_id: p.account_id || 0,
        name: realName,
        hero_id: p.hero_id || 0,
        hero_name: getHeroName(p.hero_id || 0),
        kills: p.kills || 0,
        deaths: p.deaths || 0,
        assists: p.assists || 0,
        last_hits: p.last_hits || 0,
        denies: p.denies || 0,
        gpm: p.gold_per_min || 0,
        xpm: p.xp_per_min || 0,
        net_worth: p.net_worth || p.gold || 0,
        level: p.level || 0,
        // Phase 2: rich live data — positions, items, ult/respawn status
        position_x: p.position_x ?? 0,
        position_y: p.position_y ?? 0,
        items: [p.item0 || 0, p.item1 || 0, p.item2 || 0, p.item3 || 0, p.item4 || 0, p.item5 || 0].map(
          (id: number) => ({ id, name: getItemName(id) })
        ),
        respawn_timer: p.respawn_timer || 0,
        ultimate_state: p.ultimate_state ?? 0,
        ultimate_cooldown: p.ultimate_cooldown || 0,
      };
    }),
  };

  // Debug: log coordinate ranges so we can validate WORLD_MIN/MAX mapping
  const allPositions = [
    ...(result.radiant_players || []),
    ...(result.dire_players || []),
  ].filter((p: any) => p.position_x !== 0 || p.position_y !== 0);
  if (allPositions.length > 0) {
    const xs = allPositions.map((p: any) => p.position_x);
    const ys = allPositions.map((p: any) => p.position_y);
    console.log(`  [Minimap debug] Position ranges — X: [${Math.min(...xs)}, ${Math.max(...xs)}], Y: [${Math.min(...ys)}, ${Math.max(...ys)}] (${allPositions.length} heroes with positions)`);
  }

  return result;
}

// ═══════════════════════════════════════════════════════
// ROUTE REGISTRATION
// ══════════════════════════════════════════════════════

export function registerPracticeTourneyRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // ── Inline auth helper — verifies token + officer role ──
  async function requireOfficerAuth(c: any): Promise<{ ok: true; authUser: any; dbUser: any } | { ok: false; response: any }> {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return { ok: false, response: c.json({ error: 'No access token provided' }, 401) };
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    if (authError || !authUser) return { ok: false, response: c.json({ error: 'Unauthorized — invalid or expired token' }, 401) };
    const { data: dbUser } = await supabase.from('users').select('*').eq('supabase_id', authUser.id).single();
    if (!dbUser) return { ok: false, response: c.json({ error: 'User not found in database' }, 404) };
    if (!isOfficer(dbUser.role)) return { ok: false, response: c.json({ error: 'Forbidden — only officers can manage practice tournaments' }, 403) };
    return { ok: true, authUser, dbUser };
  }

  // ── POST /practice/create — Create practice tournament from league_id ──
  app.post(`${PREFIX}/practice/create`, async (c) => {
    try {
      // Auth: officer only
      const authResult = await requireOfficerAuth(c);
      if (!authResult.ok) return authResult.response;

      const { league_id } = await c.req.json();
      if (!league_id || typeof league_id !== 'number') {
        return c.json({ error: 'league_id (number) is required' }, 400);
      }

      // Check if already exists
      const existing = await kv.get(`practice:${league_id}:meta`);
      if (existing) {
        return c.json({ error: `Practice tournament for league ${league_id} already exists`, existing }, 409);
      }

      console.log(`Creating practice tournament for league ${league_id}...`);

      // Ensure hero cache is loaded before transforming match data
      await ensureHeroCache();

      // 1. Get league info
      const leagueInfo = await getLeagueInfo(league_id);
      const leagueName = leagueInfo?.name || `League ${league_id}`;

      // 2. Get match history
      const matchHistory = await getLeagueMatches(league_id);
      console.log(`Found ${matchHistory.length} matches for league ${league_id}`);

      // 3. Collect unique team IDs from match history
      const teamIds = new Set<number>();
      matchHistory.forEach((m: any) => {
        m.players?.forEach((p: any) => {
          // team_id is not always in match history, but radiant/dire team info might be
        });
      });

      // 4. Pull detailed data for first few completed matches to build team roster
      const teamLookup: Record<number, { name: string; tag: string; logo_url: string | null }> = {};
      const matchDetails: any[] = [];
      const allPlayerStats: any[] = [];

      // Pull details for up to 20 most recent matches
      const matchesToDetail = matchHistory.slice(0, 20);
      for (const m of matchesToDetail) {
        try {
          const details = await getMatchDetails(m.match_id);
          if (!details) continue;

          // Discover teams from match details
          if (details.radiant_team_id && !teamLookup[details.radiant_team_id]) {
            // Try team API (Steam → OpenDota fallback), then use embedded match data
            try {
              const tInfo = await getTeamInfo(details.radiant_team_id);
              teamLookup[details.radiant_team_id] = {
                name: tInfo?.name || details.radiant_name || `Team ${details.radiant_team_id}`,
                tag: tInfo?.tag || details.radiant_tag || 'RAD',
                logo_url: tInfo?.logo_url || (tInfo?.logo ? getSteamLogoUrl(tInfo.logo) : null) || details.radiant_logo || null,
              };
            } catch {
              teamLookup[details.radiant_team_id] = {
                name: details.radiant_name || `Team ${details.radiant_team_id}`,
                tag: details.radiant_tag || 'RAD',
                logo_url: details.radiant_logo || null,
              };
            }
          }
          if (details.dire_team_id && !teamLookup[details.dire_team_id]) {
            try {
              const tInfo = await getTeamInfo(details.dire_team_id);
              teamLookup[details.dire_team_id] = {
                name: tInfo?.name || details.dire_name || `Team ${details.dire_team_id}`,
                tag: tInfo?.tag || details.dire_tag || 'DIR',
                logo_url: tInfo?.logo_url || (tInfo?.logo ? getSteamLogoUrl(tInfo.logo) : null) || details.dire_logo || null,
              };
            } catch {
              teamLookup[details.dire_team_id] = {
                name: details.dire_name || `Team ${details.dire_team_id}`,
                tag: details.dire_tag || 'DIR',
                logo_url: details.dire_logo || null,
              };
            }
          }

          const { match, playerStats } = transformMatchDetails(details, teamLookup);
          matchDetails.push(match);
          allPlayerStats.push(...playerStats);

          // Store individual match detail in KV
          await kv.set(`practice:${league_id}:match:${m.match_id}`, { match, playerStats });
        } catch (err) {
          console.error(`Failed to get details for match ${m.match_id}:`, err);
        }
      }

      // 5. Build team standings from match results
      const teamStandings: Record<string, { wins: number; losses: number; kills: number }> = {};
      matchDetails.forEach((m: any) => {
        const t1 = m.team1_id;
        const t2 = m.team2_id;
        if (!teamStandings[t1]) teamStandings[t1] = { wins: 0, losses: 0, kills: 0 };
        if (!teamStandings[t2]) teamStandings[t2] = { wins: 0, losses: 0, kills: 0 };

        if (m.winner_team_id === t1) {
          teamStandings[t1].wins++;
          teamStandings[t2].losses++;
        } else {
          teamStandings[t2].wins++;
          teamStandings[t1].losses++;
        }
        teamStandings[t1].kills += m.team1_score;
        teamStandings[t2].kills += m.team2_score;
      });

      // Build teams array matching our Team type
      const teams = Object.entries(teamLookup).map(([idStr, info]) => {
        const standing = teamStandings[idStr] || { wins: 0, losses: 0, kills: 0 };
        return {
          id: idStr,
          name: info.name,
          tag: info.tag,
          logo_url: info.logo_url,
          wins: standing.wins,
          losses: standing.losses,
          total_kills: standing.kills,
        };
      });

      // 6. Store everything in KV
      const meta = {
        league_id,
        name: leagueName,
        status: 'live',
        created_at: new Date().toISOString(),
        created_by: authResult.dbUser.discord_username,
        last_refreshed: new Date().toISOString(),
        total_matches: matchHistory.length,
        detailed_matches: matchDetails.length,
        team_count: teams.length,
      };

      await kv.set(`practice:${league_id}:meta`, meta);
      await kv.set(`practice:${league_id}:teams`, teams);
      await kv.set(`practice:${league_id}:matches`, matchDetails);

      console.log(`Practice tournament created: ${leagueName} (${league_id}) — ${matchDetails.length} matches, ${teams.length} teams`);

      return c.json({
        success: true,
        message: `Created practice tournament: ${leagueName}`,
        meta,
        teams: teams.length,
        matches: matchDetails.length,
      });
    } catch (err: any) {
      console.error('Practice tournament creation failed:', err);
      return c.json({ error: `Failed to create practice tournament: ${err.message}` }, 500);
    }
  });

  // ── GET /practice/list — List all practice tournaments ──
  app.get(`${PREFIX}/practice/list`, async (c) => {
    try {
      const metas = await kv.getByPrefix('practice:');
      // Filter to only :meta keys
      const tournaments = metas
        .filter((m: any) => m.key?.endsWith(':meta'))
        .map((m: any) => ({ ...m, key: undefined }));

      return c.json({ tournaments });
    } catch (err: any) {
      console.error('Failed to list practice tournaments:', err);
      return c.json({ error: `Failed to list practice tournaments: ${err.message}` }, 500);
    }
  });

  // ── GET /practice/:id — Get full practice tournament data ──
  app.get(`${PREFIX}/practice/:id`, async (c) => {
    try {
      const leagueId = c.req.param('id');

      const [meta, teams, matches] = await Promise.all([
        kv.get(`practice:${leagueId}:meta`),
        kv.get(`practice:${leagueId}:teams`),
        kv.get(`practice:${leagueId}:matches`),
      ]);

      if (!meta) {
        return c.json({ error: `Practice tournament ${leagueId} not found` }, 404);
      }

      return c.json({ meta, teams: teams || [], matches: matches || [] });
    } catch (err: any) {
      console.error(`Failed to get practice tournament ${c.req.param('id')}:`, err);
      return c.json({ error: `Failed to get practice tournament: ${err.message}` }, 500);
    }
  });

  // ── GET /practice/:id/match/:matchId — Get detailed match data ──
  app.get(`${PREFIX}/practice/:id/match/:matchId`, async (c) => {
    try {
      const leagueId = c.req.param('id');
      const matchId = c.req.param('matchId');

      let data = await kv.get(`practice:${leagueId}:match:${matchId}`);

      // If not cached, try to pull from Steam and cache
      if (!data) {
        const teamLookup: Record<number, { name: string; tag: string; logo_url: string | null }> = {};
        // Rebuild team lookup from stored teams
        const teams = await kv.get(`practice:${leagueId}:teams`) || [];
        teams.forEach((t: any) => {
          teamLookup[Number(t.id)] = { name: t.name, tag: t.tag, logo_url: t.logo_url };
        });

        const details = await getMatchDetails(Number(matchId));
        if (!details) return c.json({ error: `Match ${matchId} not found on Steam` }, 404);

        // Discover any new teams
        if (details.radiant_team_id && !teamLookup[details.radiant_team_id]) {
          teamLookup[details.radiant_team_id] = { name: details.radiant_name || 'Radiant', tag: 'RAD', logo_url: null };
        }
        if (details.dire_team_id && !teamLookup[details.dire_team_id]) {
          teamLookup[details.dire_team_id] = { name: details.dire_name || 'Dire', tag: 'DIR', logo_url: null };
        }

        data = transformMatchDetails(details, teamLookup);
        await kv.set(`practice:${leagueId}:match:${matchId}`, data);
      }

      return c.json(data);
    } catch (err: any) {
      console.error(`Failed to get match ${c.req.param('matchId')}:`, err);
      return c.json({ error: `Failed to get match details: ${err.message}` }, 500);
    }
  });

  // ── GET /practice/:id/live — Poll live games for this league ──
  app.get(`${PREFIX}/practice/:id/live`, async (c) => {
    try {
      const leagueId = Number(c.req.param('id'));

      const meta = await kv.get(`practice:${leagueId}:meta`);
      if (!meta) return c.json({ error: `Practice tournament ${leagueId} not found` }, 404);

      // Load stored teams for enrichment (Steam live data often lacks names/logos)
      const storedTeams: any[] = await kv.get(`practice:${leagueId}:teams`) || [];
      const teamById: Record<number, any> = {};
      storedTeams.forEach((t: any) => { teamById[Number(t.id)] = t; });

      // Ensure item name cache is populated (fetches once, then cached in memory)
      await ensureItemCache();
      // Ensure hero name cache is populated (fetches once, covers newly added heroes)
      await ensureHeroCache();

      const games = await getLiveLeagueGames(leagueId);
      const liveGames = games.map((game: any) => {
        const transformed = transformLiveGame(game);

        // Enrich team names/logos from stored data if Steam didn't provide them
        const radId = transformed.radiant_team.id;
        const dirId = transformed.dire_team.id;

        if (radId && teamById[radId]) {
          if (transformed.radiant_team.name === 'Radiant' || !transformed.radiant_team.name) {
            transformed.radiant_team.name = teamById[radId].name;
          }
          if (!transformed.radiant_team.tag || transformed.radiant_team.tag === 'RAD') {
            transformed.radiant_team.tag = teamById[radId].tag || transformed.radiant_team.tag;
          }
          if (!transformed.radiant_team.logo_url && teamById[radId].logo_url) {
            transformed.radiant_team.logo_url = teamById[radId].logo_url;
          }
        }

        if (dirId && teamById[dirId]) {
          if (transformed.dire_team.name === 'Dire' || !transformed.dire_team.name) {
            transformed.dire_team.name = teamById[dirId].name;
          }
          if (!transformed.dire_team.tag || transformed.dire_team.tag === 'DIR') {
            transformed.dire_team.tag = teamById[dirId].tag || transformed.dire_team.tag;
          }
          if (!transformed.dire_team.logo_url && teamById[dirId].logo_url) {
            transformed.dire_team.logo_url = teamById[dirId].logo_url;
          }
        }

        return transformed;
      });

      // Enrich player ranks from OpenDota (non-blocking, cached after first fetch)
      try {
        const allAccountIds = liveGames.flatMap((g: any) => [
          ...g.radiant_players.map((p: any) => p.account_id),
          ...g.dire_players.map((p: any) => p.account_id),
        ]).filter((id: number) => id > 0);

        if (allAccountIds.length > 0) {
          await fetchPlayerRanks(allAccountIds);

          // Attach rank_tier to each player
          for (const game of liveGames) {
            for (const p of game.radiant_players) {
              p.rank_tier = getCachedRank(p.account_id);
            }
            for (const p of game.dire_players) {
              p.rank_tier = getCachedRank(p.account_id);
            }
          }
        }
      } catch (rankErr) {
        console.log('Non-critical: rank enrichment failed:', rankErr);
      }

      // Cache latest live state
      if (liveGames.length > 0) {
        await kv.set(`practice:${leagueId}:live`, {
          games: liveGames,
          polled_at: new Date().toISOString(),
        });
      }

      return c.json({
        league_id: leagueId,
        league_name: meta.name,
        live_count: liveGames.length,
        games: liveGames,
        polled_at: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error(`Failed to poll live games for league ${c.req.param('id')}:`, err);
      return c.json({ error: `Failed to poll live games: ${err.message}` }, 500);
    }
  });

  // ── POST /practice/:id/refresh — Re-pull match data from Steam ──
  app.post(`${PREFIX}/practice/:id/refresh`, async (c) => {
    try {
      const authResult = await requireOfficerAuth(c);
      if (!authResult.ok) return authResult.response;

      const leagueId = Number(c.req.param('id'));
      const meta = await kv.get(`practice:${leagueId}:meta`);
      if (!meta) return c.json({ error: `Practice tournament ${leagueId} not found` }, 404);

      console.log(`Refreshing practice tournament ${leagueId}...`);

      // Re-pull match history
      const matchHistory = await getLeagueMatches(leagueId);

      // Get existing cached match IDs
      const existingMatches: any[] = await kv.get(`practice:${leagueId}:matches`) || [];
      const existingIds = new Set(existingMatches.map((m: any) => String(m.match_id || m.id)));

      // Find new matches
      const newMatchIds = matchHistory
        .filter((m: any) => !existingIds.has(String(m.match_id)))
        .slice(0, 20); // Limit new pulls

      // Build team lookup from existing teams
      const teamLookup: Record<number, { name: string; tag: string; logo_url: string | null }> = {};
      const existingTeams = await kv.get(`practice:${leagueId}:teams`) || [];
      existingTeams.forEach((t: any) => {
        teamLookup[Number(t.id)] = { name: t.name, tag: t.tag, logo_url: t.logo_url };
      });

      const newMatches: any[] = [];
      for (const m of newMatchIds) {
        try {
          const details = await getMatchDetails(m.match_id);
          if (!details) continue;

          // Discover new teams (same enrichment pattern as create)
          if (details.radiant_team_id && !teamLookup[details.radiant_team_id]) {
            try {
              const tInfo = await getTeamInfo(details.radiant_team_id);
              teamLookup[details.radiant_team_id] = {
                name: tInfo?.name || details.radiant_name || `Team ${details.radiant_team_id}`,
                tag: tInfo?.tag || details.radiant_tag || 'RAD',
                logo_url: tInfo?.logo_url || (tInfo?.logo ? getSteamLogoUrl(tInfo.logo) : null) || details.radiant_logo || null,
              };
            } catch {
              teamLookup[details.radiant_team_id] = {
                name: details.radiant_name || `Team ${details.radiant_team_id}`,
                tag: details.radiant_tag || 'RAD',
                logo_url: details.radiant_logo || null,
              };
            }
          }
          if (details.dire_team_id && !teamLookup[details.dire_team_id]) {
            try {
              const tInfo = await getTeamInfo(details.dire_team_id);
              teamLookup[details.dire_team_id] = {
                name: tInfo?.name || details.dire_name || `Team ${details.dire_team_id}`,
                tag: tInfo?.tag || details.dire_tag || 'DIR',
                logo_url: tInfo?.logo_url || (tInfo?.logo ? getSteamLogoUrl(tInfo.logo) : null) || details.dire_logo || null,
              };
            } catch {
              teamLookup[details.dire_team_id] = {
                name: details.dire_name || `Team ${details.dire_team_id}`,
                tag: details.dire_tag || 'DIR',
                logo_url: details.dire_logo || null,
              };
            }
          }

          const { match, playerStats } = transformMatchDetails(details, teamLookup);
          newMatches.push(match);
          await kv.set(`practice:${leagueId}:match:${m.match_id}`, { match, playerStats });
        } catch (err) {
          console.error(`Failed to refresh match ${m.match_id}:`, err);
        }
      }

      // Merge and re-store
      const allMatches = [...existingMatches, ...newMatches]
        .sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime());

      // Rebuild team standings
      const teamStandings: Record<string, { wins: number; losses: number; kills: number }> = {};
      allMatches.forEach((m: any) => {
        const t1 = m.team1_id;
        const t2 = m.team2_id;
        if (!teamStandings[t1]) teamStandings[t1] = { wins: 0, losses: 0, kills: 0 };
        if (!teamStandings[t2]) teamStandings[t2] = { wins: 0, losses: 0, kills: 0 };
        if (m.winner_team_id === t1) { teamStandings[t1].wins++; teamStandings[t2].losses++; }
        else { teamStandings[t2].wins++; teamStandings[t1].losses++; }
        teamStandings[t1].kills += m.team1_score || 0;
        teamStandings[t2].kills += m.team2_score || 0;
      });

      const updatedTeams = Object.entries(teamLookup).map(([idStr, info]) => {
        const s = teamStandings[idStr] || { wins: 0, losses: 0, kills: 0 };
        return { id: idStr, name: info.name, tag: info.tag, logo_url: info.logo_url, wins: s.wins, losses: s.losses, total_kills: s.kills };
      });

      await kv.set(`practice:${leagueId}:matches`, allMatches);
      await kv.set(`practice:${leagueId}:teams`, updatedTeams);
      await kv.set(`practice:${leagueId}:meta`, {
        ...meta,
        last_refreshed: new Date().toISOString(),
        total_matches: allMatches.length,
        detailed_matches: allMatches.length,
        team_count: updatedTeams.length,
      });

      console.log(`Refreshed: +${newMatches.length} new matches, ${updatedTeams.length} teams`);

      return c.json({
        success: true,
        new_matches: newMatches.length,
        total_matches: allMatches.length,
        teams: updatedTeams.length,
      });
    } catch (err: any) {
      console.error(`Failed to refresh practice tournament:`, err);
      return c.json({ error: `Failed to refresh: ${err.message}` }, 500);
    }
  });

  // ── DELETE /practice/:id — Nuke all KV entries for this league ─
  app.delete(`${PREFIX}/practice/:id`, async (c) => {
    try {
      const authResult = await requireOfficerAuth(c);
      if (!authResult.ok) return authResult.response;

      const leagueId = c.req.param('id');
      const meta = await kv.get(`practice:${leagueId}:meta`);
      if (!meta) return c.json({ error: `Practice tournament ${leagueId} not found` }, 404);

      // Get all keys for this practice tournament
      const allEntries = await kv.getByPrefix(`practice:${leagueId}:`);
      const allKeys = allEntries.map((e: any) => e.key).filter(Boolean);

      if (allKeys.length > 0) {
        // mdel in batches of 50 to avoid oversized queries
        for (let i = 0; i < allKeys.length; i += 50) {
          await kv.mdel(allKeys.slice(i, i + 50));
        }
      }

      console.log(`Deleted practice tournament ${leagueId}: ${allKeys.length} KV entries removed`);

      return c.json({
        success: true,
        message: `Practice tournament "${meta.name}" deleted`,
        keys_removed: allKeys.length,
      });
    } catch (err: any) {
      console.error(`Failed to delete practice tournament:`, err);
      return c.json({ error: `Failed to delete: ${err.message}` }, 500);
    }
  });
}