import { Hono } from "npm:hono";
import { PREFIX, requireOwner, requireAuth } from "./helpers.ts";
import { createAdminLog, createNotification, createUserActivity } from "./routes-notifications.ts";

export function registerPrizeRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // 1. LIST PRIZES FOR A TOURNAMENT (Public)
  app.get(`${PREFIX}/kkup/tournaments/:id/prizes`, async (c) => {
    try {
      const tournamentId = c.req.param('id');
      const { data: prizes, error } = await supabase
        .from('kkup_prizes')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('List prizes error:', error);
        return c.json({ error: `Failed to fetch prizes: ${error.message}` }, 500);
      }

      // Also fetch awards to show winners
      const { data: awards, error: awardError } = await supabase
        .from('prize_awards')
        .select(`
          id, prize_id, amount_cents, recipient_user_id, team_id,
          recipient:users!recipient_user_id(id, discord_username, discord_avatar),
          team:kkup_teams!team_id(id, team_name, team_tag, logo_url)
        `)
        .eq('tournament_id', tournamentId);

      if (awardError) {
        console.error('Fetch awards error:', awardError);
      }

      return c.json({ prizes: prizes || [], awards: awards || [] });
    } catch (error: any) {
      console.error('List prizes unexpected error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // 2. CREATE PRIZE (Owner only)
  app.post(`${PREFIX}/kkup/tournaments/:id/prizes`, async (c) => {
    try {
      const auth = await requireOwner(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('id');
      const body = await c.req.json();

      if (!body.title?.trim()) {
        return c.json({ error: 'Prize title is required' }, 400);
      }

      const { data: prize, error } = await supabase
        .from('kkup_prizes')
        .insert({
          tournament_id: tournamentId,
          title: body.title.trim(),
          description: body.description?.trim() || null,
          value_type: body.value_type || 'fixed',
          value: body.value ?? 0,
          sort_order: body.sort_order ?? 0
        })
        .select()
        .single();

      if (error) {
        console.error('Create prize error:', error);
        return c.json({ error: `Failed to create prize: ${error.message}` }, 500);
      }

      await createAdminLog({
        type: 'prize_created',
        action: `Created prize "${prize.title}" for tournament ${tournamentId}`,
        actor_id: auth.dbUser.id,
        actor_name: auth.dbUser.discord_username,
        details: { tournament_id: tournamentId, prize_id: prize.id, title: prize.title }
      });

      return c.json({ success: true, prize });
    } catch (error: any) {
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // 3. UPDATE PRIZE (Owner only)
  app.patch(`${PREFIX}/kkup/tournaments/:id/prizes/:prizeId`, async (c) => {
    try {
      const auth = await requireOwner(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;

      const prizeId = c.req.param('prizeId');
      const body = await c.req.json();

      const updateData: any = {};
      const allowed = ['title', 'description', 'value_type', 'value', 'sort_order'];
      for (const field of allowed) {
        if (body[field] !== undefined) updateData[field] = body[field];
      }

      if (Object.keys(updateData).length === 0) {
        return c.json({ error: 'No fields to update' }, 400);
      }

      const { data: prize, error } = await supabase
        .from('kkup_prizes')
        .update(updateData)
        .eq('id', prizeId)
        .select()
        .single();

      if (error) {
        console.error('Update prize error:', error);
        return c.json({ error: `Failed to update prize: ${error.message}` }, 500);
      }

      return c.json({ success: true, prize });
    } catch (error: any) {
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // 4. DELETE PRIZE (Owner only)
  app.delete(`${PREFIX}/kkup/tournaments/:id/prizes/:prizeId`, async (c) => {
    try {
      const auth = await requireOwner(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;

      const prizeId = c.req.param('prizeId');
      const { error } = await supabase
        .from('kkup_prizes')
        .delete()
        .eq('id', prizeId);

      if (error) {
        console.error('Delete prize error:', error);
        return c.json({ error: `Failed to delete prize: ${error.message}` }, 500);
      }

      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // 5. AWARD PRIZE (Owner only)
  app.post(`${PREFIX}/kkup/tournaments/:id/prizes/:prizeId/award`, async (c) => {
    try {
      const auth = await requireOwner(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('id');
      const prizeId = c.req.param('prizeId');
      const body = await c.req.json(); // { team_id, recipient_user_id, amount_cents, reason }

      const { data: prize } = await supabase.from('kkup_prizes').select('*').eq('id', prizeId).single();
      if (!prize) return c.json({ error: 'Prize NOT found' }, 404);

      // Create award record
      const insertData: any = {
        tournament_id: tournamentId,
        prize_id: prizeId,
        awarded_by_user_id: auth.dbUser.id,
        amount_cents: body.amount_cents || 0,
        reason: body.reason || prize.title,
        status: 'honorary', // Default as per plan for retroactive support
      };

      if (body.team_id) insertData.team_id = body.team_id;
      if (body.recipient_user_id) insertData.recipient_user_id = body.recipient_user_id;

      const { data: award, error } = await supabase
        .from('prize_awards')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Create award error:', error);
        return c.json({ error: `Failed to create award: ${error.message}` }, 500);
      }

      await createAdminLog({
        type: 'prize_awarded',
        action: `Awarded prize "${prize.title}" to ${body.team_id ? 'team ' + body.team_id : 'user ' + body.recipient_user_id}`,
        actor_id: auth.dbUser.id,
        actor_name: auth.dbUser.discord_username,
        details: { tournament_id: tournamentId, prize_id: prizeId, award_id: award.id }
      });

      return c.json({ success: true, award });
    } catch (error: any) {
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // 6. DELETE AWARD (Owner only)
  app.delete(`${PREFIX}/kkup/tournaments/:id/awards/:awardId`, async (c) => {
    try {
      const auth = await requireOwner(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;

      const awardId = c.req.param('awardId');
      const { error } = await supabase
        .from('prize_awards')
        .delete()
        .eq('id', awardId);

      if (error) {
        console.error('Delete award error:', error);
        return c.json({ error: `Failed to delete award: ${error.message}` }, 500);
      }

      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });
}
