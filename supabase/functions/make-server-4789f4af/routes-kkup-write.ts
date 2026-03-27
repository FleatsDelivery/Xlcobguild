/**
 * KKUP Write Routes -- mutations for tournaments
 * 
 * Legacy award routes (award-championship, award-popd-kernel) are deprecated.
 * All prize/award operations now go through POST /connect/award-batch in routes-connect.ts.
 */
import type { Hono } from "npm:hono";
import { PREFIX } from "./helpers.ts";
import { isOfficer } from "./roles.ts";
import * as kv from "./kv_store.tsx";

export function registerKkupWriteRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // Update tournament details (Owner only)
  app.patch(`${PREFIX}/kkup/:kkup_id/update`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('role').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser) return c.json({ error: 'User not found' }, 404);
      if (dbUser.role !== 'owner') return c.json({ error: 'Only owners can update tournaments' }, 403);

      const kkupId = c.req.param('kkup_id');
      const body = await c.req.json();

      const { data: tournament, error: updateError } = await supabase
        .from('kkup_tournaments')
        .update({
          cover_photo_url: body.cover_photo_url,
          prize_pool: body.prize_pool,
          description: body.description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', kkupId).select().single();

      if (updateError) {
        console.error('Update error:', updateError);
        return c.json({ error: 'Failed to update tournament' }, 500);
      }

      return c.json({ success: true, tournament, message: 'Tournament updated successfully' });
    } catch (error: any) {
      console.error('Update tournament error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // DEPRECATED — use POST /connect/award-batch with role='champion' instead
  app.post(`${PREFIX}/kkup/award-championship`, async (c) => {
    return c.json({ error: 'Deprecated: Use POST /connect/award-batch with role="champion" instead.' }, 410);
  });

  // DEPRECATED — use POST /connect/award-batch with role='popd_kernel' instead
  app.post(`${PREFIX}/kkup/award-popd-kernel`, async (c) => {
    return c.json({ error: 'Deprecated: Use POST /connect/award-batch with role="popd_kernel" instead.' }, 410);
  });

  // DEPRECATED — achievements system removed
  app.post(`${PREFIX}/kkup/achievements/award`, async (c) => {
    return c.json({ error: 'Achievements are deprecated. Use POST /connect/award-batch instead.' }, 410);
  });

  // DEPRECATED — achievements system removed
  app.delete(`${PREFIX}/kkup/achievements/:achievement_id`, async (c) => {
    return c.json({ error: 'Achievements are deprecated. Use POST /connect/award-batch instead.' }, 410);
  });

  // ═══════════════════════════════════════════════════════
  // PRIZE CONFIG — per-tournament prize pool structure
  // Stored in KV: tournament_prize_config:{tournament_id}
  // ═══════════════════════════════════════════════════════

  // GET prize config for a tournament (public)
  app.get(`${PREFIX}/kkup/:kkup_id/prize-config`, async (c) => {
    try {
      const kkupId = c.req.param('kkup_id');
      const kvKey = `tournament_prize_config:${kkupId}`;
      const stored = await kv.get(kvKey);
      if (!stored) return c.json({ config: null });
      const config = typeof stored === 'string' ? JSON.parse(stored) : stored;
      return c.json({ config });
    } catch (error: any) {
      console.error('Get prize config error:', error);
      return c.json({ error: 'Failed to fetch prize config: ' + error.message }, 500);
    }
  });

  // PUT prize config for a tournament (officer-only)
  app.put(`${PREFIX}/kkup/:kkup_id/prize-config`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: dbUser } = await supabase
        .from('users').select('role').eq('supabase_id', authUser.id).single();
      if (!dbUser || !isOfficer(dbUser.role)) return c.json({ error: 'Officer access required' }, 403);

      const kkupId = c.req.param('kkup_id');
      const body = await c.req.json();

      if (!body.categories || !Array.isArray(body.categories)) {
        return c.json({ error: 'Invalid config: categories array required' }, 400);
      }

      // Validate each category
      for (const cat of body.categories) {
        if (!cat.key || !cat.label || typeof cat.amount_cents !== 'number') {
          return c.json({ error: `Invalid category: key, label, and amount_cents required. Got: ${JSON.stringify(cat)}` }, 400);
        }
      }

      const kvKey = `tournament_prize_config:${kkupId}`;
      await kv.set(kvKey, JSON.stringify(body));

      // Also update the tournament's prize_pool total (in dollars) for display
      const totalCents = body.categories.reduce((sum: number, c: any) => sum + (c.amount_cents || 0), 0);
      await supabase
        .from('kkup_tournaments')
        .update({ prize_pool: (totalCents / 100).toFixed(2) })
        .eq('id', kkupId);

      console.log(`Prize config saved for tournament ${kkupId}: ${body.categories.length} categories, total $${(totalCents / 100).toFixed(2)}`);
      return c.json({ success: true, message: 'Prize config saved' });
    } catch (error: any) {
      console.error('Save prize config error:', error);
      return c.json({ error: 'Failed to save prize config: ' + error.message }, 500);
    }
  });

}