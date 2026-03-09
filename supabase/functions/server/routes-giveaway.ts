/**
 * Giveaway Routes — CRUD, entry, draw, lifecycle
 *
 * 10 routes:
 *   GET    /giveaways                      — List all giveaways (public; drafts visible to officers only)
 *   GET    /giveaways/:id                  — Get giveaway detail with prizes, entries, user status
 *   POST   /giveaways                      — Create giveaway (officer+)
 *   PATCH  /giveaways/:id                  — Update giveaway + prizes (officer+)
 *   DELETE /giveaways/:id                  — Delete giveaway (officer+, draft only)
 *   PATCH  /giveaways/:id/status           — Advance phase (officer+)
 *   POST   /giveaways/:id/enter            — Enter giveaway (any authenticated user)
 *   DELETE /giveaways/:id/enter            — Leave giveaway (any authenticated user)
 *   POST   /giveaways/:id/draw             — Draw winners (officer+, closed only)
 *   PATCH  /giveaways/:id/prizes/:prize_id — Mark prize fulfilled (officer+)
 *
 * Tables: giveaways, giveaway_prizes, giveaway_entries, users
 */
import type { Hono } from "npm:hono";
import { PREFIX } from "./helpers.ts";
import { createNotification, createAdminLog, createUserActivity } from "./routes-notifications.ts";
import { isOfficer } from "./roles.ts";

// ── Valid phase transitions (mirrors giveaway-state-config.ts) ──
const PHASE_TRANSITIONS: Record<string, string[]> = {
  draft:     ['open'],
  open:      ['closed'],
  closed:    ['drawn'],
  drawn:     ['completed'],
  completed: [],
};

export function registerGiveawayRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // ═══════════════════════════════════════════════════════
  // AUTH HELPERS
  // ═══════════════════════════════════════════════════════

  /** Verify token + return user (any authenticated role) */
  async function requireAuth(c: any): Promise<{ ok: true; authUser: any; dbUser: any } | { ok: false; response: any }> {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return { ok: false, response: c.json({ error: 'No access token provided' }, 401) };
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    if (authError || !authUser) return { ok: false, response: c.json({ error: 'Unauthorized — invalid or expired token' }, 401) };
    const { data: dbUser } = await supabase.from('users').select('*').eq('supabase_id', authUser.id).single();
    if (!dbUser) return { ok: false, response: c.json({ error: 'User not found in database' }, 404) };
    return { ok: true, authUser, dbUser };
  }

  /** Verify token + require officer-level role */
  async function requireOfficer(c: any): Promise<{ ok: true; authUser: any; dbUser: any } | { ok: false; response: any }> {
    const result = await requireAuth(c);
    if (!result.ok) return result;
    if (!isOfficer(result.dbUser.role)) {
      return { ok: false, response: c.json({ error: 'Forbidden — only officers and owner can manage giveaways' }, 403) };
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════
  // LIST GIVEAWAYS
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/giveaways`, async (c) => {
    try {
      // Check if requester is officer (optional — no auth required for public)
      let isAdmin = false;
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (accessToken) {
        const { data: { user: authUser } } = await anonSupabase.auth.getUser(accessToken);
        if (authUser) {
          const { data: dbUser } = await supabase.from('users').select('role').eq('supabase_id', authUser.id).single();
          if (dbUser && isOfficer(dbUser.role)) isAdmin = true;
        }
      }

      // Fetch giveaways — hide drafts from non-officers
      let query = supabase.from('giveaways').select('*').order('created_at', { ascending: false });
      if (!isAdmin) {
        query = query.neq('status', 'draft');
      }
      const { data: giveaways, error } = await query;
      if (error) {
        console.error('Failed to fetch giveaways:', error);
        return c.json({ error: `Failed to fetch giveaways: ${error.message}` }, 500);
      }

      if (!giveaways || giveaways.length === 0) {
        return c.json({ giveaways: [] });
      }

      // Batch-fetch entry counts and prizes for all giveaways
      const giveawayIds = giveaways.map((g: any) => g.id);

      const [
        { data: allPrizes },
        { data: allEntries },
        { data: allWinners },
      ] = await Promise.all([
        supabase.from('giveaway_prizes').select('id, giveaway_id, type, title, cash_amount, cash_currency, dota_plus_months, discount_percent, sort_order').in('giveaway_id', giveawayIds).order('sort_order'),
        supabase.from('giveaway_entries').select('giveaway_id').in('giveaway_id', giveawayIds),
        supabase.from('giveaway_entries').select('id, giveaway_id, user_id, discord_username, discord_avatar, winner_rank').in('giveaway_id', giveawayIds).not('winner_rank', 'is', null),
      ]);

      // Build lookup maps
      const entryCountMap = new Map<string, number>();
      (allEntries || []).forEach((e: any) => {
        entryCountMap.set(e.giveaway_id, (entryCountMap.get(e.giveaway_id) || 0) + 1);
      });

      const prizesMap = new Map<string, any[]>();
      (allPrizes || []).forEach((p: any) => {
        if (!prizesMap.has(p.giveaway_id)) prizesMap.set(p.giveaway_id, []);
        prizesMap.get(p.giveaway_id)!.push(p);
      });

      const winnersMap = new Map<string, any[]>();
      (allWinners || []).forEach((w: any) => {
        if (!winnersMap.has(w.giveaway_id)) winnersMap.set(w.giveaway_id, []);
        winnersMap.get(w.giveaway_id)!.push(w);
      });

      // Build response with prize_summary and entry_count
      const enriched = giveaways.map((g: any) => {
        const prizes = prizesMap.get(g.id) || [];
        const prizeSummary = prizes.map((p: any) => {
          if (p.type === 'cash' && p.cash_amount) return `$${Number(p.cash_amount).toFixed(0)} ${p.cash_currency || 'USD'}`;
          if (p.type === 'dota_plus' && p.dota_plus_months) return `${p.dota_plus_months}mo Dota Plus`;
          if (p.type === 'discount_code' && p.discount_percent) return `${Number(p.discount_percent).toFixed(0)}% Off`;
          return p.title;
        });

        return {
          ...g,
          entry_count: entryCountMap.get(g.id) || 0,
          prize_summary: prizeSummary,
          winners: winnersMap.get(g.id) || [],
        };
      });

      return c.json({ giveaways: enriched });
    } catch (error: any) {
      console.error('List giveaways error:', error);
      return c.json({ error: `Internal server error listing giveaways: ${error.message}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // GET GIVEAWAY DETAIL
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/giveaways/:id`, async (c) => {
    try {
      const id = c.req.param('id');

      // Fetch giveaway
      const { data: giveaway, error } = await supabase.from('giveaways').select('*').eq('id', id).single();
      if (error || !giveaway) {
        return c.json({ error: `Giveaway not found: ${id}` }, 404);
      }

      // If draft, only officers can see it
      if (giveaway.status === 'draft') {
        const accessToken = c.req.header('Authorization')?.split(' ')[1];
        if (!accessToken) return c.json({ error: 'Giveaway not found' }, 404);
        const { data: { user: authUser } } = await anonSupabase.auth.getUser(accessToken);
        if (!authUser) return c.json({ error: 'Giveaway not found' }, 404);
        const { data: dbUser } = await supabase.from('users').select('role').eq('supabase_id', authUser.id).single();
        if (!dbUser || !isOfficer(dbUser.role)) return c.json({ error: 'Giveaway not found' }, 404);
      }

      // Fetch prizes, entries, creator username
      const [
        { data: prizes },
        { data: entries },
        { data: creator },
      ] = await Promise.all([
        supabase.from('giveaway_prizes').select('*').eq('giveaway_id', id).order('sort_order'),
        supabase.from('giveaway_entries').select('*').eq('giveaway_id', id).order('entered_at'),
        supabase.from('users').select('discord_username').eq('id', giveaway.created_by).single(),
      ]);

      // Check if current user has entered
      let userEntered = false;
      let userEntryId: string | null = null;
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (accessToken) {
        const { data: { user: authUser } } = await anonSupabase.auth.getUser(accessToken);
        if (authUser) {
          const { data: dbUser } = await supabase.from('users').select('id').eq('supabase_id', authUser.id).single();
          if (dbUser) {
            const entry = (entries || []).find((e: any) => e.user_id === dbUser.id);
            if (entry) {
              userEntered = true;
              userEntryId = entry.id;
            }
          }
        }
      }

      return c.json({
        giveaway: {
          ...giveaway,
          prizes: prizes || [],
          entries: entries || [],
          entry_count: (entries || []).length,
          user_entered: userEntered,
          user_entry_id: userEntryId,
          creator_username: creator?.discord_username || null,
        },
      });
    } catch (error: any) {
      console.error('Get giveaway detail error:', error);
      return c.json({ error: `Internal server error fetching giveaway: ${error.message}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // CREATE GIVEAWAY
  // ═══════════════════════════════════════════════════════

  app.post(`${PREFIX}/giveaways`, async (c) => {
    try {
      const auth = await requireOfficer(c);
      if (!auth.ok) return auth.response;

      const body = await c.req.json();
      const { title, description, image_url, winner_count, opens_at, closes_at, prizes, visibility } = body;

      if (!title || !title.trim()) {
        return c.json({ error: 'Title is required' }, 400);
      }

      // Insert giveaway
      const { data: giveaway, error: insertError } = await supabase
        .from('giveaways')
        .insert({
          title: title.trim(),
          description: description?.trim() || null,
          image_url: image_url || null,
          visibility: visibility || 'members',
          status: 'draft',
          source: 'web',
          winner_count: winner_count || 1,
          created_by: auth.dbUser.id,
          opens_at: opens_at || null,
          closes_at: closes_at || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Failed to create giveaway:', insertError);
        return c.json({ error: `Failed to create giveaway: ${insertError.message}` }, 500);
      }

      // Insert prizes if provided
      if (prizes && Array.isArray(prizes) && prizes.length > 0) {
        const prizeRows = prizes.map((p: any, i: number) => ({
          giveaway_id: giveaway.id,
          rank: p.rank ?? null,
          type: p.type || 'other',
          title: p.title || 'Prize',
          description: p.description || null,
          cash_amount: p.cash_amount || null,
          cash_currency: p.cash_currency || 'USD',
          dota_plus_months: p.dota_plus_months || null,
          discount_percent: p.discount_percent || null,
          discount_code: p.discount_code || null,
          sort_order: p.sort_order ?? i,
        }));

        const { error: prizeError } = await supabase
          .from('giveaway_prizes')
          .insert(prizeRows);

        if (prizeError) {
          console.error('Failed to create prizes (giveaway created but prizes failed):', prizeError);
          // Don't fail the whole request — giveaway was created
        }
      }

      console.log(`Giveaway created: "${giveaway.title}" (${giveaway.id}) by ${auth.dbUser.discord_username}`);

      // Admin log (non-critical)
      try {
        await createAdminLog({
          type: 'giveaway_created',
          action: `Created giveaway "${giveaway.title}"`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          actor_avatar: auth.dbUser.discord_avatar,
          details: { giveaway_id: giveaway.id, title: giveaway.title, winner_count: giveaway.winner_count },
        });
      } catch (logErr) {
        console.error('Non-critical: admin log for giveaway creation failed:', logErr);
      }

      return c.json({ success: true, giveaway });
    } catch (error: any) {
      console.error('Create giveaway error:', error);
      return c.json({ error: `Internal server error creating giveaway: ${error.message}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // UPDATE GIVEAWAY
  // ═══════════════════════════════════════════════════════

  app.patch(`${PREFIX}/giveaways/:id`, async (c) => {
    try {
      const auth = await requireOfficer(c);
      if (!auth.ok) return auth.response;

      const id = c.req.param('id');
      const body = await c.req.json();

      // Fetch current giveaway to check mutability
      const { data: existing, error: fetchError } = await supabase
        .from('giveaways').select('status').eq('id', id).single();
      if (fetchError || !existing) return c.json({ error: `Giveaway not found: ${id}` }, 404);

      // Only draft and open giveaways can be edited
      if (!['draft', 'open'].includes(existing.status)) {
        return c.json({ error: `Cannot edit giveaway in "${existing.status}" phase` }, 400);
      }

      // Build update object (only allowed fields)
      const updateData: any = {};
      if (body.title !== undefined) updateData.title = body.title.trim();
      if (body.description !== undefined) updateData.description = body.description?.trim() || null;
      if (body.image_url !== undefined) updateData.image_url = body.image_url || null;
      if (body.visibility !== undefined) updateData.visibility = body.visibility || 'members';
      if (body.winner_count !== undefined) updateData.winner_count = body.winner_count;
      if (body.opens_at !== undefined) updateData.opens_at = body.opens_at || null;
      if (body.closes_at !== undefined) updateData.closes_at = body.closes_at || null;

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('giveaways').update(updateData).eq('id', id);
        if (updateError) {
          return c.json({ error: `Failed to update giveaway: ${updateError.message}` }, 500);
        }
      }

      // Replace prizes if provided
      if (body.prizes !== undefined && Array.isArray(body.prizes)) {
        // Delete existing prizes
        await supabase.from('giveaway_prizes').delete().eq('giveaway_id', id);

        // Insert new prizes
        if (body.prizes.length > 0) {
          const prizeRows = body.prizes.map((p: any, i: number) => ({
            giveaway_id: id,
            rank: p.rank ?? null,
            type: p.type || 'other',
            title: p.title || 'Prize',
            description: p.description || null,
            cash_amount: p.cash_amount || null,
            cash_currency: p.cash_currency || 'USD',
            dota_plus_months: p.dota_plus_months || null,
            discount_percent: p.discount_percent || null,
            discount_code: p.discount_code || null,
            sort_order: p.sort_order ?? i,
          }));

          const { error: prizeError } = await supabase
            .from('giveaway_prizes').insert(prizeRows);
          if (prizeError) {
            console.error('Failed to replace prizes:', prizeError);
          }
        }
      }

      // Return updated giveaway
      const { data: updated } = await supabase.from('giveaways').select('*').eq('id', id).single();
      console.log(`Giveaway updated: "${updated?.title}" (${id}) by ${auth.dbUser.discord_username}`);

      // Admin log (non-critical)
      try {
        await createAdminLog({
          type: 'giveaway_updated',
          action: `Updated giveaway "${updated?.title || id}"`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          actor_avatar: auth.dbUser.discord_avatar,
          details: { giveaway_id: id },
        });
      } catch (logErr) {
        console.error('Non-critical: admin log for giveaway update failed:', logErr);
      }

      return c.json({ success: true, giveaway: updated });
    } catch (error: any) {
      console.error('Update giveaway error:', error);
      return c.json({ error: `Internal server error updating giveaway: ${error.message}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // DELETE GIVEAWAY
  // ═══════════════════════════════════════════════════════

  app.delete(`${PREFIX}/giveaways/:id`, async (c) => {
    try {
      const auth = await requireOfficer(c);
      if (!auth.ok) return auth.response;

      const id = c.req.param('id');

      // Officers can delete any giveaway in any phase
      const { data: existing } = await supabase.from('giveaways').select('status, title').eq('id', id).single();
      if (!existing) return c.json({ error: `Giveaway not found: ${id}` }, 404);

      // Delete related data first (entries, prizes), then giveaway
      await supabase.from('giveaway_entries').delete().eq('giveaway_id', id);
      await supabase.from('giveaway_prizes').delete().eq('giveaway_id', id);
      const { error: deleteError } = await supabase.from('giveaways').delete().eq('id', id);
      if (deleteError) {
        return c.json({ error: `Failed to delete giveaway: ${deleteError.message}` }, 500);
      }

      console.log(`Giveaway deleted: "${existing.title}" (${id}, was ${existing.status}) by ${auth.dbUser.discord_username}`);

      // Admin log (non-critical)
      try {
        await createAdminLog({
          type: 'giveaway_deleted',
          action: `Deleted giveaway "${existing.title}" (was ${existing.status})`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          actor_avatar: auth.dbUser.discord_avatar,
          details: { giveaway_id: id, title: existing.title, previous_status: existing.status },
        });
      } catch (logErr) {
        console.error('Non-critical: admin log for giveaway deletion failed:', logErr);
      }

      return c.json({ success: true, message: 'Giveaway deleted' });
    } catch (error: any) {
      console.error('Delete giveaway error:', error);
      return c.json({ error: `Internal server error deleting giveaway: ${error.message}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // ADVANCE PHASE (STATUS TRANSITION)
  // ═══════════════════════════════════════════════════════

  app.patch(`${PREFIX}/giveaways/:id/status`, async (c) => {
    try {
      const auth = await requireOfficer(c);
      if (!auth.ok) return auth.response;

      const id = c.req.param('id');
      const { status: newStatus } = await c.req.json();

      if (!newStatus) return c.json({ error: 'New status is required' }, 400);

      // Fetch current status
      const { data: existing } = await supabase.from('giveaways').select('status, title').eq('id', id).single();
      if (!existing) return c.json({ error: `Giveaway not found: ${id}` }, 404);

      // Validate transition
      const allowed = PHASE_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(newStatus)) {
        return c.json({
          error: `Invalid transition: "${existing.status}" → "${newStatus}". Allowed: [${allowed.join(', ')}]`,
        }, 400);
      }

      // Build update
      const updateData: any = { status: newStatus };
      if (newStatus === 'drawn') {
        updateData.drawn_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase.from('giveaways').update(updateData).eq('id', id);
      if (updateError) {
        return c.json({ error: `Failed to update status: ${updateError.message}` }, 500);
      }

      console.log(`Giveaway "${existing.title}" phase: ${existing.status} → ${newStatus} (by ${auth.dbUser.discord_username})`);

      // Admin log (non-critical)
      try {
        await createAdminLog({
          type: 'giveaway_phase_changed',
          action: `Advanced giveaway "${existing.title}" phase: ${existing.status} → ${newStatus}`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          actor_avatar: auth.dbUser.discord_avatar,
          details: { giveaway_id: id, title: existing.title, previous_status: existing.status, new_status: newStatus },
        });
      } catch (logErr) {
        console.error('Non-critical: admin log for giveaway phase change failed:', logErr);
      }

      return c.json({ success: true, previous_status: existing.status, new_status: newStatus });
    } catch (error: any) {
      console.error('Advance giveaway phase error:', error);
      return c.json({ error: `Internal server error advancing giveaway phase: ${error.message}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // ENTER GIVEAWAY
  // ═══════════════════════════════════════════════════════

  app.post(`${PREFIX}/giveaways/:id/enter`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const id = c.req.param('id');

      // Check giveaway is open
      const { data: giveaway } = await supabase.from('giveaways').select('status, title, closes_at').eq('id', id).single();
      if (!giveaway) return c.json({ error: `Giveaway not found: ${id}` }, 404);
      if (giveaway.status !== 'open') {
        return c.json({ error: `Giveaway is not open for entries (current status: ${giveaway.status})` }, 400);
      }

      // Check if closes_at has passed
      if (giveaway.closes_at && new Date(giveaway.closes_at) < new Date()) {
        return c.json({ error: 'Entry period has ended' }, 400);
      }

      // Insert entry (UNIQUE constraint handles duplicates)
      const { data: entry, error: insertError } = await supabase
        .from('giveaway_entries')
        .insert({
          giveaway_id: id,
          user_id: auth.dbUser.id,
          discord_username: auth.dbUser.discord_username || 'Unknown',
          discord_avatar: auth.dbUser.discord_avatar || null,
          source: 'web',
        })
        .select()
        .single();

      if (insertError) {
        // Check for unique constraint violation (already entered)
        if (insertError.code === '23505') {
          return c.json({ error: 'You have already entered this giveaway' }, 409);
        }
        return c.json({ error: `Failed to enter giveaway: ${insertError.message}` }, 500);
      }

      console.log(`${auth.dbUser.discord_username} entered giveaway "${giveaway.title}" (${id})`);

      // Log activity
      try {
        await createUserActivity({
          user_id: auth.dbUser.id,
          type: 'giveaway_entered',
          title: `Entered: ${giveaway.title}`,
          description: `You entered the giveaway "${giveaway.title}".`,
          related_id: id,
          related_url: `#giveaways/${id}`,
        });
      } catch (actErr) { console.error('Non-critical: activity log for giveaway entry failed:', actErr); }

      return c.json({ success: true, entry });
    } catch (error: any) {
      console.error('Enter giveaway error:', error);
      return c.json({ error: `Internal server error entering giveaway: ${error.message}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // LEAVE GIVEAWAY
  // ═══════════════════════════════════════════════════════

  app.delete(`${PREFIX}/giveaways/:id/enter`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const id = c.req.param('id');

      // Check giveaway is still open (can't leave after closed)
      const { data: giveaway } = await supabase.from('giveaways').select('status, title').eq('id', id).single();
      if (!giveaway) return c.json({ error: `Giveaway not found: ${id}` }, 404);
      if (giveaway.status !== 'open') {
        return c.json({ error: `Cannot leave giveaway in "${giveaway.status}" phase` }, 400);
      }

      const { error: deleteError } = await supabase
        .from('giveaway_entries')
        .delete()
        .eq('giveaway_id', id)
        .eq('user_id', auth.dbUser.id);

      if (deleteError) {
        return c.json({ error: `Failed to leave giveaway: ${deleteError.message}` }, 500);
      }

      console.log(`${auth.dbUser.discord_username} left giveaway "${giveaway.title}" (${id})`);

      // Log activity
      try {
        await createUserActivity({
          user_id: auth.dbUser.id,
          type: 'giveaway_withdrawn',
          title: `Left: ${giveaway.title}`,
          description: `You withdrew from the giveaway "${giveaway.title}".`,
          related_id: id,
          related_url: `#giveaways/${id}`,
        });
      } catch (actErr) { console.error('Non-critical: activity log for giveaway leave failed:', actErr); }

      return c.json({ success: true, message: 'Entry removed' });
    } catch (error: any) {
      console.error('Leave giveaway error:', error);
      return c.json({ error: `Internal server error leaving giveaway: ${error.message}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // DRAW WINNERS
  // ═══════════════════════════════════════════════════════

  app.post(`${PREFIX}/giveaways/:id/draw`, async (c) => {
    try {
      const auth = await requireOfficer(c);
      if (!auth.ok) return auth.response;

      const id = c.req.param('id');

      // Fetch giveaway
      const { data: giveaway } = await supabase
        .from('giveaways').select('status, title, winner_count').eq('id', id).single();
      if (!giveaway) return c.json({ error: `Giveaway not found: ${id}` }, 404);

      if (giveaway.status !== 'closed') {
        return c.json({ error: `Cannot draw winners — giveaway must be in "closed" phase (current: ${giveaway.status})` }, 400);
      }

      // Fetch all entries
      const { data: entries, error: entriesError } = await supabase
        .from('giveaway_entries').select('*').eq('giveaway_id', id);
      if (entriesError) {
        return c.json({ error: `Failed to fetch entries for draw: ${entriesError.message}` }, 500);
      }

      if (!entries || entries.length === 0) {
        return c.json({ error: 'Cannot draw — no entries in this giveaway' }, 400);
      }

      // Shuffle using Fisher-Yates
      const shuffled = [...entries];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Pick winners (min of winner_count and total entries)
      const winnerCount = Math.min(giveaway.winner_count || 1, shuffled.length);
      const winners = shuffled.slice(0, winnerCount);

      // Update winner_rank on winning entries
      for (let i = 0; i < winners.length; i++) {
        await supabase
          .from('giveaway_entries')
          .update({ winner_rank: i + 1 })
          .eq('id', winners[i].id);
      }

      // Assign winners to prizes (by rank order)
      const { data: prizes } = await supabase
        .from('giveaway_prizes').select('*').eq('giveaway_id', id).order('sort_order');

      if (prizes && prizes.length > 0) {
        for (let i = 0; i < Math.min(winners.length, prizes.length); i++) {
          await supabase
            .from('giveaway_prizes')
            .update({ winner_user_id: winners[i].user_id })
            .eq('id', prizes[i].id);
        }
      }

      // Advance to drawn status
      await supabase.from('giveaways').update({
        status: 'drawn',
        drawn_at: new Date().toISOString(),
      }).eq('id', id);

      const winnerNames = winners.map((w: any) => w.discord_username).join(', ');
      console.log(`Giveaway "${giveaway.title}" drawn! Winners: ${winnerNames} (drawn by ${auth.dbUser.discord_username})`);

      // Notify each winner and log admin action (non-critical)
      try {
        for (let i = 0; i < winners.length; i++) {
          const w = winners[i];
          const prizeName = prizes && prizes[i] ? prizes[i].title : `Prize #${i + 1}`;
          await createNotification({
            user_id: w.user_id,
            type: 'giveaway_prize',
            title: `You won: ${giveaway.title}!`,
            body: `Congratulations! You won "${prizeName}" in the ${giveaway.title} giveaway.`,
            related_id: id,
            action_url: `#giveaway/${id}`,
            actor_name: auth.dbUser.discord_username,
          });
        }
        await createAdminLog({
          type: 'giveaway_drawn',
          action: `Drew ${winners.length} winner(s) for "${giveaway.title}"`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          details: { giveaway_id: id, winner_count: winners.length, winners: winnerNames },
        });
      } catch (_) { /* non-critical */ }

      return c.json({
        success: true,
        winners: winners.map((w: any, i: number) => ({
          rank: i + 1,
          user_id: w.user_id,
          discord_username: w.discord_username,
          discord_avatar: w.discord_avatar,
          entry_id: w.id,
        })),
      });
    } catch (error: any) {
      console.error('Draw giveaway error:', error);
      return c.json({ error: `Internal server error drawing giveaway winners: ${error.message}` }, 500);
    }
  });

  // ═══════════════════════════════════════════════════════
  // MARK PRIZE FULFILLED
  // ═══════════════════════════════════════════════════════

  app.patch(`${PREFIX}/giveaways/:id/prizes/:prize_id`, async (c) => {
    try {
      const auth = await requireOfficer(c);
      if (!auth.ok) return auth.response;

      const prizeId = c.req.param('prize_id');
      const body = await c.req.json();

      const updateData: any = {};
      if (body.fulfilled !== undefined) {
        updateData.fulfilled = body.fulfilled;
        updateData.fulfilled_at = body.fulfilled ? new Date().toISOString() : null;
      }
      if (body.stripe_transfer_id !== undefined) {
        updateData.stripe_transfer_id = body.stripe_transfer_id;
      }

      const { data: prize, error: updateError } = await supabase
        .from('giveaway_prizes')
        .update(updateData)
        .eq('id', prizeId)
        .select()
        .single();

      if (updateError) {
        return c.json({ error: `Failed to update prize: ${updateError.message}` }, 500);
      }

      console.log(`Prize ${prizeId} updated (fulfilled=${prize?.fulfilled}) by ${auth.dbUser.discord_username}`);

      // Admin log + notify winner (non-critical)
      try {
        const giveawayId = c.req.param('id');
        const { data: giveaway } = await supabase.from('giveaways').select('title').eq('id', giveawayId).single();

        await createAdminLog({
          type: 'prize_fulfilled',
          action: `${body.fulfilled ? 'Fulfilled' : 'Unfulfilled'} prize "${prize?.title || prizeId}" for "${giveaway?.title || giveawayId}"`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          actor_avatar: auth.dbUser.discord_avatar,
          details: { giveaway_id: giveawayId, prize_id: prizeId, fulfilled: prize?.fulfilled, prize_title: prize?.title },
        });

        // Notify the winner when their prize is fulfilled
        if (body.fulfilled && prize?.winner_user_id) {
          await createNotification({
            user_id: prize.winner_user_id,
            type: 'prize_fulfilled',
            title: `Prize Fulfilled: ${prize.title || 'Your Prize'}`,
            body: `Your prize "${prize.title}" from "${giveaway?.title || 'a giveaway'}" has been fulfilled!`,
            related_id: giveawayId,
            actor_name: auth.dbUser.discord_username,
          });
        }
      } catch (logErr) {
        console.error('Non-critical: admin log for prize fulfillment failed:', logErr);
      }

      return c.json({ success: true, prize });
    } catch (error: any) {
      console.error('Update prize error:', error);
      return c.json({ error: `Internal server error updating prize: ${error.message}` }, 500);
    }
  });

}