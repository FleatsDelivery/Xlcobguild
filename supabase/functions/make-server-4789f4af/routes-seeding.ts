/**
 * Seeding Routes — Officer-only
 *
 * Handles rank fetching from OpenDota and team seeding calculations
 * for use in the Bracket Builder before roster lock.
 *
 * Routes:
 *   GET  /kkup/tournaments/:id/seeding              — compute + return seeded team list
 *   POST /kkup/tournaments/:id/seeding/fetch-ranks  — fetch ranks for unranked players via OpenDota, save to DB
 *   POST /kkup/tournaments/:id/seeding/apply        — write computed seed numbers to kkup_teams.seeding
 */

import { Hono } from "npm:hono";
import { PREFIX } from "./helpers.ts";
import { isOfficer } from "./roles.ts";
import { fetchOpenDotaPlayerRank } from "./opendota-helpers.ts";

async function requireOfficer(c: any, supabase: any, anonSupabase: any) {
  const token = c.req.header('Authorization')?.split(' ')[1];
  if (!token) return { ok: false, response: c.json({ error: 'No access token' }, 401) };
  const { data: { user: authUser }, error } = await anonSupabase.auth.getUser(token);
  if (error || !authUser) return { ok: false, response: c.json({ error: 'Unauthorized' }, 401) };
  const { data: dbUser } = await supabase.from('users').select('*').eq('supabase_id', authUser.id).single();
  if (!dbUser || !isOfficer(dbUser.role)) return { ok: false, response: c.json({ error: 'Officer access required' }, 403) };
  return { ok: true, dbUser };
}

/** Convert OpenDota rank_tier integer to numeric 1–36 scale for averaging */
function rankTierToNumeric(rankTier: number | null): number {
  if (!rankTier || rankTier === 0) return 0;
  if (rankTier >= 80) return 36; // Immortal
  const medalNum = Math.floor(rankTier / 10); // 1=Herald … 7=Divine
  const stars = rankTier % 10; // 1–5
  // Medal order: Herald(0) Guardian(1) Crusader(2) Archon(3) Legend(4) Ancient(5) Divine(6)
  const tierIndex = medalNum - 1;
  if (tierIndex < 0 || tierIndex > 6) return 0;
  return tierIndex * 5 + Math.max(1, Math.min(5, stars));
}

/** Convert OpenDota rank_tier integer to display string */
function rankTierToLabel(rankTier: number | null): string {
  if (!rankTier || rankTier === 0) return 'Unranked';
  if (rankTier >= 80) return 'Immortal';
  const medals = ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine'];
  const medalNum = Math.floor(rankTier / 10) - 1;
  const stars = rankTier % 10;
  const medal = medals[medalNum];
  return medal ? `${medal} ${stars}` : 'Unranked';
}

/** Get a safe steam account_id — filters out synthetic TCF IDs (tcf_user_*) */
function getSteamAccountId(steamId: string | null): string | null {
  if (!steamId) return null;
  // Synthetic IDs start with 'tcf_user_' — these are not real Steam accounts
  if (steamId.startsWith('tcf_user_')) return null;
  // If somehow a 64-bit SteamID slipped in (> 4.3B), convert to 32-bit
  try {
    const n = BigInt(steamId);
    const STEAM_BASE = BigInt('76561197960265728');
    if (n > BigInt('10000000000')) {
      return String(n - STEAM_BASE);
    }
    return steamId;
  } catch {
    return null; // non-numeric — skip
  }
}

export function registerSeedingRoutes(app: Hono, supabase: any, anonSupabase: any) {

  /**
   * GET /kkup/tournaments/:id/seeding
   * Returns teams sorted by computed seed (best rank = seed 1).
   */
  app.get(`${PREFIX}/kkup/tournaments/:id/seeding`, async (c) => {
    const auth = await requireOfficer(c, supabase, anonSupabase);
    if (!auth.ok) return auth.response;

    const tournamentId = c.req.param('id');

    // Fetch approved teams with their rosters + person rank data
    const { data: teams, error: teamsErr } = await supabase
      .from('kkup_teams')
      .select(`
        id, team_name, team_tag, logo_url, seeding,
        kkup_team_rosters (
          person_id,
          kkup_persons ( id, display_name, steam_id, rank_tier )
        )
      `)
      .eq('tournament_id', tournamentId)
      .eq('approval_status', 'approved');

    if (teamsErr) {
      console.error('[Seeding] Error fetching teams:', teamsErr);
      return c.json({ error: 'Failed to fetch teams' }, 500);
    }

    if (!teams || teams.length === 0) {
      return c.json([]);
    }

    // Compute per-team average rank numeric (unranked = 0)
    const seeded = teams.map((team: any) => {
      const roster = team.kkup_team_rosters || [];
      const numericValues = roster.map((r: any) => rankTierToNumeric(r.kkup_persons?.rank_tier ?? null));
      const total = numericValues.reduce((s: number, v: number) => s + v, 0);
      const avg = numericValues.length > 0 ? total / numericValues.length : 0;

      return {
        team_id: team.id,
        team_name: team.team_name,
        team_tag: team.team_tag,
        logo_url: team.logo_url,
        avg_rank_numeric: avg,
        avg_rank_label: (() => {
          // Convert numeric back to label for display
          if (avg === 0) return 'Unranked';
          if (avg >= 36) return 'Immortal';
          const medals = ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'];
          const tierIndex = Math.floor((Math.round(avg) - 1) / 5);
          const stars = ((Math.round(avg) - 1) % 5) + 1;
          return `${medals[tierIndex] || 'Unranked'} ${stars}`;
        })(),
        roster: roster.map((r: any) => ({
          person_id: r.kkup_persons?.id,
          display_name: r.kkup_persons?.display_name || 'Unknown',
          rank_tier: r.kkup_persons?.rank_tier ?? null,
          rank_label: rankTierToLabel(r.kkup_persons?.rank_tier ?? null),
        })),
      };
    });

    // Sort descending by avg numeric (highest rank = seed 1), then add seed numbers
    seeded.sort((a: any, b: any) => b.avg_rank_numeric - a.avg_rank_numeric);
    seeded.forEach((t: any, i: number) => { t.seed = i + 1; });

    return c.json(seeded);
  });


  /**
   * POST /kkup/tournaments/:id/seeding/fetch-ranks
   * Fetches Dota 2 rank_tier from OpenDota for roster members without one.
   * Saves results back to kkup_persons.rank_tier.
   */
  app.post(`${PREFIX}/kkup/tournaments/:id/seeding/fetch-ranks`, async (c) => {
    const auth = await requireOfficer(c, supabase, anonSupabase);
    if (!auth.ok) return auth.response;

    const tournamentId = c.req.param('id');

    // Get all persons on approved teams without a rank_tier
    const { data: rosters, error: rostersErr } = await supabase
      .from('kkup_teams')
      .select(`
        kkup_team_rosters (
          kkup_persons ( id, steam_id, rank_tier )
        )
      `)
      .eq('tournament_id', tournamentId)
      .eq('approval_status', 'approved');

    if (rostersErr || !rosters) {
      return c.json({ error: 'Failed to fetch rosters' }, 500);
    }

    // Flatten + filter to persons needing a lookup
    const personsMap = new Map<string, { id: string; steam_id: string }>();
    for (const team of rosters) {
      for (const r of (team.kkup_team_rosters || [])) {
        const p = r.kkup_persons;
        if (!p || p.rank_tier !== null) continue; // already has rank
        const accountId = getSteamAccountId(p.steam_id);
        if (!accountId) continue; // synthetic ID or invalid
        personsMap.set(p.id, { id: p.id, steam_id: accountId });
      }
    }

    const toFetch = Array.from(personsMap.values());
    console.log(`[Seeding] Need to fetch ranks for ${toFetch.length} persons`);

    let saved = 0;
    let skipped_private = 0;
    const already_had_rank = 0;

    // Batch: 5 concurrent, 300ms delay between batches
    const BATCH_SIZE = 5;
    for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
      const batch = toFetch.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (person) => {
          const rankTier = await fetchOpenDotaPlayerRank(person.steam_id);
          return { id: person.id, rank_tier: rankTier };
        })
      );

      for (const r of results) {
        if (r.rank_tier === null) {
          skipped_private++;
          continue;
        }
        const { error: updateErr } = await supabase
          .from('kkup_persons')
          .update({ rank_tier: r.rank_tier })
          .eq('id', r.id);
        if (!updateErr) saved++;
      }

      if (i + BATCH_SIZE < toFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`[Seeding] fetch-ranks done: saved=${saved} skipped_private=${skipped_private}`);
    return c.json({
      fetched: toFetch.length,
      saved,
      skipped_private,
      already_had_rank,
    });
  });


  /**
   * POST /kkup/tournaments/:id/seeding/apply
   * Writes the computed seed order to kkup_teams.seeding for each team.
   * Body: { seeds: [{ team_id: string, seed: number }] }
   */
  app.post(`${PREFIX}/kkup/tournaments/:id/seeding/apply`, async (c) => {
    const auth = await requireOfficer(c, supabase, anonSupabase);
    if (!auth.ok) return auth.response;

    const { seeds } = await c.req.json();
    if (!Array.isArray(seeds)) return c.json({ error: 'seeds array required' }, 400);

    let updated = 0;
    for (const { team_id, seed } of seeds) {
      const { error } = await supabase
        .from('kkup_teams')
        .update({ seeding: seed })
        .eq('id', team_id);
      if (!error) updated++;
    }

    return c.json({ updated });
  });
}
