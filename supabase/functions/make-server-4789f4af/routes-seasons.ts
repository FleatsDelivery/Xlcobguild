/**
 * Guild Wars — Season Routes
 * Season management + manual reset trigger for officers.
 *
 * 5 routes:
 *   GET    /seasons              — list all seasons
 *   GET    /seasons/active       — get the current active season
 *   POST   /seasons              — create a new season (officer only)
 *   POST   /seasons/:id/complete — mark season as completed + set winner (officer only)
 *   POST   /seasons/:id/reset    — trigger full rank + prestige reset (officer only)
 */
import type { Hono } from "npm:hono";
import { PREFIX, requireAuth } from "./helpers.ts";
import { isOfficer } from "./roles.ts";
import { createAdminLog, createUserActivity } from "./routes-notifications.ts";

export function registerSeasonRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // ── GET /seasons — List all seasons ───────────────────────────────
  app.get(`${PREFIX}/seasons`, async (c) => {
    try {
      const { data: seasons, error } = await supabase
        .from('guild_wars_seasons')
        .select(`
          *,
          winning_guild:guild_wars_guilds!guild_wars_seasons_winning_guild_id_fkey (
            id, name, tag, color, logo_url
          )
        `)
        .order('year', { ascending: false });

      if (error) return c.json({ error: `Failed to fetch seasons: ${error.message}` }, 500);
      return c.json({ seasons: seasons || [] });
    } catch (error: any) {
      console.error('List seasons error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // ── GET /seasons/active — Current active season ───────────────────
  app.get(`${PREFIX}/seasons/active`, async (c) => {
    try {
      const { data: season, error } = await supabase
        .from('guild_wars_seasons')
        .select('*')
        .eq('status', 'active')
        .maybeSingle();

      if (error) return c.json({ error: `Failed to fetch active season: ${error.message}` }, 500);
      if (!season) return c.json({ error: 'No active season found' }, 404);

      // Get guild leaderboard for this season
      const { data: guilds } = await supabase
        .from('guild_wars_guilds')
        .select('id, name, tag, color, logo_url, is_default');

      // Count approved MVPs per guild for this season
      const { data: mvpCounts } = await supabase
        .from('rank_up_requests')
        .select('guild_id')
        .eq('season_id', season.id)
        .eq('status', 'approved');

      const guildMvpMap: Record<string, number> = {};
      for (const r of (mvpCounts || [])) {
        if (r.guild_id) guildMvpMap[r.guild_id] = (guildMvpMap[r.guild_id] || 0) + 1;
      }

      // Count members per guild
      const { data: memberCounts } = await supabase
        .from('users')
        .select('guild_id')
        .not('guild_id', 'is', null);

      const guildMemberMap: Record<string, number> = {};
      for (const u of (memberCounts || [])) {
        guildMemberMap[u.guild_id] = (guildMemberMap[u.guild_id] || 0) + 1;
      }

      const leaderboard = (guilds || []).map((g: any) => ({
        ...g,
        mvp_count: guildMvpMap[g.id] || 0,
        member_count: guildMemberMap[g.id] || 0,
      })).sort((a: any, b: any) => b.mvp_count - a.mvp_count);

      return c.json({ season, leaderboard });
    } catch (error: any) {
      console.error('Get active season error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // ── POST /seasons — Create a new season (officer only) ────────────
  app.post(`${PREFIX}/seasons`, async (c) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      if (!isOfficer(dbUser.role)) {
        return c.json({ error: 'Only officers can create seasons' }, 403);
      }

      const { name, year, starts_at, ends_at } = await c.req.json();
      if (!name || !year) return c.json({ error: 'name and year are required' }, 400);

      // Check for duplicate year
      const { data: existing } = await supabase
        .from('guild_wars_seasons')
        .select('id')
        .eq('year', year)
        .maybeSingle();
      if (existing) return c.json({ error: `A season for year ${year} already exists` }, 409);

      const { data: season, error } = await supabase
        .from('guild_wars_seasons')
        .insert({
          name: name.trim(),
          year,
          starts_at: starts_at || `${year}-01-01T00:00:00Z`,
          ends_at: ends_at || `${year}-12-31T23:59:59Z`,
          status: 'upcoming',
        })
        .select()
        .single();

      if (error) return c.json({ error: `Failed to create season: ${error.message}` }, 500);

      try {
        await createAdminLog({
          type: 'season_created',
          action: `${dbUser.discord_username} created Guild Wars season "${name}" (${year})`,
          actor_id: dbUser.id,
          actor_name: dbUser.discord_username,
          details: { season_id: season.id, year },
        });
      } catch (_) { /* non-critical */ }

      return c.json({ season });
    } catch (error: any) {
      console.error('Create season error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // ── POST /seasons/:id/complete — End a season + set winner ────────
  app.post(`${PREFIX}/seasons/:id/complete`, async (c) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      if (!isOfficer(dbUser.role)) {
        return c.json({ error: 'Only officers can complete seasons' }, 403);
      }

      const seasonId = c.req.param('id');
      const { winning_guild_id } = await c.req.json();

      const { data: season, error: fetchError } = await supabase
        .from('guild_wars_seasons')
        .select('*')
        .eq('id', seasonId)
        .single();

      if (fetchError || !season) return c.json({ error: 'Season not found' }, 404);
      if (season.status === 'completed') return c.json({ error: 'Season is already completed' }, 400);

      // If no winning guild specified, auto-detect from MVP counts
      let winnerGuildId = winning_guild_id;
      if (!winnerGuildId) {
        const { data: mvpCounts } = await supabase
          .from('rank_up_requests')
          .select('guild_id')
          .eq('season_id', seasonId)
          .eq('status', 'approved');

        const counts: Record<string, number> = {};
        for (const r of (mvpCounts || [])) {
          if (r.guild_id) counts[r.guild_id] = (counts[r.guild_id] || 0) + 1;
        }
        const sorted = Object.entries(counts).sort(([, a], [, b]) => (b as number) - (a as number));
        winnerGuildId = sorted[0]?.[0] || null;
      }

      const { data: updatedSeason, error: updateError } = await supabase
        .from('guild_wars_seasons')
        .update({ status: 'completed', winning_guild_id: winnerGuildId })
        .eq('id', seasonId)
        .select()
        .single();

      if (updateError) return c.json({ error: `Failed to complete season: ${updateError.message}` }, 500);

      // Get winner guild name for logging
      let winnerName = 'Unknown';
      if (winnerGuildId) {
        const { data: winnerGuild } = await supabase
          .from('guild_wars_guilds')
          .select('name')
          .eq('id', winnerGuildId)
          .single();
        winnerName = winnerGuild?.name || 'Unknown';
      }

      try {
        await createAdminLog({
          type: 'season_completed',
          action: `${dbUser.discord_username} completed Guild Wars season "${season.name}" — winner: ${winnerName}`,
          actor_id: dbUser.id,
          actor_name: dbUser.discord_username,
          details: { season_id: seasonId, winner_guild_id: winnerGuildId, winner_name: winnerName },
        });
      } catch (_) { /* non-critical */ }

      return c.json({ season: updatedSeason, winner_name: winnerName });
    } catch (error: any) {
      console.error('Complete season error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // ── POST /seasons/:id/reset — Full rank + prestige reset ──────────
  // This is the "start new year" action — resets ALL users to Earwig rank 1, prestige 0.
  // Historical data is preserved (membership records, rank_up_requests stay untouched).
  app.post(`${PREFIX}/seasons/:id/reset`, async (c) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      if (!isOfficer(dbUser.role)) {
        return c.json({ error: 'Only officers can trigger season resets' }, 403);
      }

      const seasonId = c.req.param('id');

      const { data: season, error: fetchError } = await supabase
        .from('guild_wars_seasons')
        .select('*')
        .eq('id', seasonId)
        .single();

      if (fetchError || !season) return c.json({ error: 'Season not found' }, 404);

      // Count affected users before reset
      const { count: affectedCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .neq('role', 'guest');

      // Reset all non-guest users to rank 1, prestige 0
      const { error: resetError } = await supabase
        .from('users')
        .update({ rank_id: 1, prestige_level: 0, updated_at: new Date().toISOString() })
        .neq('role', 'guest');

      if (resetError) return c.json({ error: `Failed to reset ranks: ${resetError.message}` }, 500);

      // If the season was upcoming, activate it
      if (season.status === 'upcoming') {
        // Deactivate any currently active season first
        await supabase
          .from('guild_wars_seasons')
          .update({ status: 'completed' })
          .eq('status', 'active');

        await supabase
          .from('guild_wars_seasons')
          .update({ status: 'active' })
          .eq('id', seasonId);
      }

      try {
        await createAdminLog({
          type: 'season_reset',
          action: `${dbUser.discord_username} triggered season reset for "${season.name}" — ${affectedCount || 0} users reset to Earwig rank 1, prestige 0`,
          actor_id: dbUser.id,
          actor_name: dbUser.discord_username,
          details: { season_id: seasonId, affected_users: affectedCount || 0 },
        });
      } catch (_) { /* non-critical */ }

      console.log(`Season reset triggered by ${dbUser.discord_username}: ${affectedCount || 0} users reset`);
      return c.json({ success: true, affected_users: affectedCount || 0 });
    } catch (error: any) {
      console.error('Season reset error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

}
