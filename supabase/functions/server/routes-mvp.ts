/**
 * MVP / Rank Routes -- submit screenshots, admin approve/deny, rank up/down, prestige
 * 7 routes + 3 Discord helper functions
 */
import type { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { buildPendingMVPEmbed, buildResolvedMVPEmbed } from "./discord-embeds.tsx";
import { PREFIX } from "./helpers.ts";
import { isOfficer } from "./roles.ts";
import { createNotification, createAdminLog, createUserActivity } from "./routes-notifications.ts";
import { DISCORD_WEBHOOKS } from "./discord-config.ts";

export function registerMVPRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // ── Discord helper: update bot-submitted message on approve/deny ──
  async function updateDiscordMVPMessage(requestId: string, status: 'approved' | 'denied', reviewerUsername: string) {
    try {
      const { data: request, error: requestError } = await supabase
        .from('rank_up_requests')
        .select(`discord_message_id, discord_channel_id, action, match_id, screenshot_url,
          users!rank_up_requests_user_id_fkey(discord_id, discord_username, rank_id, prestige_level),
          target_user:users!rank_up_requests_target_user_id_fkey(discord_id, discord_username, rank_id, prestige_level)`)
        .eq('id', requestId).single();

      if (requestError || !request || !request.discord_message_id || !request.discord_channel_id) return;

      const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
      if (!botToken) return;

      const submitter = request.users;
      const targetUser = request.target_user || request.users;

      let imageUrl = '';
      if (request.screenshot_url) {
        const { data: signedUrlData } = await supabase.storage
          .from('make-4789f4af-mvp-screenshots').createSignedUrl(request.screenshot_url, 60 * 60 * 24 * 7);
        imageUrl = signedUrlData?.signedUrl || '';
      }

      const { embed: updatedEmbed } = buildResolvedMVPEmbed(
        submitter?.discord_id || null, submitter?.discord_username || 'Unknown User',
        targetUser?.discord_id || null, targetUser?.discord_username || 'Unknown User',
        request.action || 'rank_up', request.match_id || null, imageUrl, status, reviewerUsername,
      );

      const response = await fetch(
        `https://discord.com/api/v10/channels/${request.discord_channel_id}/messages/${request.discord_message_id}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bot ${botToken}` },
          body: JSON.stringify({ embeds: [updatedEmbed] }) }
      );
      if (!response.ok) console.error('Failed to update Discord message:', await response.text());
    } catch (error) {
      console.error('Error updating Discord message:', error);
    }
  }

  // ── Discord helper: update webhook-submitted message on approve/deny ──
  async function updateWebhookMVPMessage(requestId: string, status: 'approved' | 'denied', reviewerUsername: string) {
    try {
      const { data: request, error: requestError } = await supabase
        .from('rank_up_requests')
        .select(`discord_message_id, action, match_id, screenshot_url,
          users!rank_up_requests_user_id_fkey(discord_id, discord_username, discord_avatar, ranks!inner(name), rank_id, prestige_level),
          target_user:users!rank_up_requests_target_user_id_fkey(discord_id, discord_username, discord_avatar, ranks!inner(name), rank_id, prestige_level)`)
        .eq('id', requestId).single();

      if (requestError || !request) return;

      const webhookUrl = DISCORD_WEBHOOKS.MVP_SUBMISSION;
      if (!webhookUrl || !request.discord_message_id) return;

      const submittingUser = request.users;
      const targetUser = request.target_user;

      const { data: signedUrlData } = await supabase.storage
        .from('make-4789f4af-mvp-screenshots').createSignedUrl(request.screenshot_url, 60 * 60 * 24 * 7);
      const fullScreenshotUrl = signedUrlData?.signedUrl || request.screenshot_url;

      const { embed: updatedEmbed } = buildResolvedMVPEmbed(
        submittingUser?.discord_id || null, submittingUser?.discord_username || 'Unknown User',
        targetUser?.discord_id || null, targetUser?.discord_username || 'Unknown User',
        request.action || 'rank_up', request.match_id || null, fullScreenshotUrl, status, reviewerUsername,
      );

      const response = await fetch(`${webhookUrl}/messages/${request.discord_message_id}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [updatedEmbed] }) });
      if (!response.ok) console.error('Failed to update webhook message:', await response.text());
    } catch (error) {
      console.error('Error updating webhook message:', error);
    }
  }

  // ── Discord helper: warn when target not in guild ──
  async function updateDiscordMVPMessageBlocked(
    messageId: string, channelId: string, targetDiscordId: string, targetUsername: string, reviewerUsername: string
  ) {
    try {
      const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
      if (!botToken) return;

      const warningEmbed = {
        title: `⚠️ MVP Request - Awaiting Guild Join`,
        color: 0xF97316,
        description: `<@${targetDiscordId}> is not in The Corn Field guild yet!\n\n **Action Required:** Please use the \`/joinguild\` command to join The Corn Field before this request can be approved.`,
        fields: [
          { name: '📊 Status', value: `⏳ Pending - Waiting for <@${targetDiscordId}> to join the guild`, inline: false },
          { name: '👤 Attempted Reviewer', value: reviewerUsername, inline: true },
        ],
        timestamp: new Date().toISOString(),
      };

      await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bot ${botToken}` },
          body: JSON.stringify({ embeds: [warningEmbed], content: `<@${targetDiscordId}> Please use \`/joinguild\` to join the guild!` }) });
    } catch (error) {
      console.error('Error sending Discord guild join warning:', error);
    }
  }

  // ════════════════════════════════════════════════════
  // ROUTES
  // ════════════════════════════════════════════════════

  // Submit MVP screenshot for rank-up (Members only)
  app.post(`${PREFIX}/requests/mvp`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: submittingUser, error: userError } = await supabase
        .from('users').select('id, role, rank_id, prestige_level').eq('supabase_id', authUser.id).single();
      if (userError || !submittingUser) return c.json({ error: 'User not found' }, 404);

      const { screenshot_url, match_id, user_id, action, notify_discord } = await c.req.json();
      if (!screenshot_url) return c.json({ error: 'Screenshot URL is required' }, 400);
      if (!user_id) return c.json({ error: 'User ID is required' }, 400);
      if (!action || !['rank_up', 'rank_down', 'prestige'].includes(action)) {
        return c.json({ error: 'Valid action is required (rank_up, rank_down, or prestige)' }, 400);
      }

      const { data: targetUser, error: targetError } = await supabase
        .from('users').select('id, rank_id, prestige_level, role').eq('id', user_id).single();
      if (targetError || !targetUser) return c.json({ error: 'Target user not found' }, 404);

      // Validate action permissions
      const isSelf = submittingUser.id === targetUser.id;
      const targetMaxRank = targetUser.prestige_level === 5 ? 11 : 10;
      const targetIsAtMaxRank = targetUser.rank_id >= targetMaxRank;
      const targetCanPrestige = targetUser.prestige_level < 5 && targetIsAtMaxRank;

      // ── Smart action resolution ──
      // If the user sends rank_up but the target is at max rank and eligible to prestige,
      // auto-upgrade the action to prestige. This powers the "2-button" UI where the
      // frontend only shows Rank Up / Rank Down and the system figures out prestige.
      let resolvedAction = action;
      if (action === 'rank_up' && targetCanPrestige) {
        resolvedAction = 'prestige';
        console.log(`Smart action: auto-upgraded rank_up → prestige for target rank ${targetUser.rank_id}, prestige ${targetUser.prestige_level}`);
      }

      if (resolvedAction === 'rank_up') {
        if (targetIsAtMaxRank) return c.json({ error: 'User is already at maximum rank and prestige level' }, 400);
      }
      if (resolvedAction === 'rank_down') {
        if (isSelf) return c.json({ error: 'You cannot rank yourself down' }, 403);
        // Only Corn Star (rank 10) can rank down others — Pop'd Kernel (rank 11) is protected
        // and per guild rules may no longer de-rank anyone else
        if (submittingUser.rank_id !== 10) return c.json({ error: 'Only Corn Star (Rank 10) members can rank down others' }, 403);
        if (targetUser.rank_id <= 1) return c.json({ error: 'User is already at minimum rank' }, 400);
        // Pop'd Kernel (rank 11, prestige 5) cannot be ranked down — they are protected
        if (targetUser.rank_id === 11 && targetUser.prestige_level === 5) {
          return c.json({ error: "Pop'd Kernel members are protected and cannot be ranked down" }, 400);
        }
      }
      if (resolvedAction === 'prestige') {
        // No submitter rank check — anyone can submit an MVP request; officers control the approval gate.
        // This enables the smart rank_up→prestige upgrade path for all members.
        if (targetUser.prestige_level >= 5) return c.json({ error: 'User is already at maximum prestige level' }, 400);
        if (!targetIsAtMaxRank) return c.json({ error: 'User must be at maximum rank to prestige' }, 400);
      }

      // Check for duplicates
      const { data: duplicates } = await supabase
        .from('rank_up_requests').select('*').eq('user_id', submittingUser.id)
        .or(`screenshot_url.eq.${screenshot_url}${match_id ? `,match_id.eq.${match_id}` : ''}`);
      if (duplicates && duplicates.length > 0) return c.json({ error: 'You have already submitted this screenshot or match' }, 400);

      // Insert request
      const { data: request, error: insertError } = await supabase
        .from('rank_up_requests')
        .insert({
          user_id: submittingUser.id, target_user_id: user_id, action: resolvedAction, type: 'mvp',
          screenshot_url, match_id: match_id || null,
          current_rank_id: targetUser.rank_id, current_prestige_level: targetUser.prestige_level,
          status: 'pending',
        }).select().single();
      if (insertError) { console.error('Error creating MVP request:', insertError); return c.json({ error: 'Failed to create MVP request' }, 500); }

      // Log activity for the submitter (non-critical)
      try {
        const isSelfSubmission = submittingUser.id === user_id;
        const actionLabel = resolvedAction === 'prestige' ? 'Prestige' : resolvedAction === 'rank_down' ? 'Rank Down' : 'Rank Up';
        await createUserActivity({
          user_id: submittingUser.id,
          type: 'mvp_submitted',
          title: `Submitted MVP Request: ${actionLabel}`,
          description: isSelfSubmission
            ? `You submitted a ${actionLabel.toLowerCase()} request for yourself${match_id ? ` (Match ${match_id})` : ''}`
            : `You submitted a ${actionLabel.toLowerCase()} request for another player${match_id ? ` (Match ${match_id})` : ''}`,
          related_id: request.id,
          metadata: { action: resolvedAction, match_id, target_user_id: user_id, is_self: isSelfSubmission },
        });
      } catch (_) { /* activity logging is non-critical */ }

      // Send Discord webhook notification
      if (notify_discord !== false) {
        try {
          const webhookUrl = DISCORD_WEBHOOKS.MVP_SUBMISSION;
          if (webhookUrl) {
            const { data: submitterDetails } = await supabase
              .from('users').select('discord_username, discord_avatar, discord_id, ranks!inner(name), rank_id, prestige_level')
              .eq('id', submittingUser.id).single();
            const { data: targetDetails } = await supabase
              .from('users').select('discord_username, discord_id, ranks!inner(name), rank_id, prestige_level')
              .eq('id', user_id).single();

            const { data: signedUrlData } = await supabase.storage
              .from('make-4789f4af-mvp-screenshots').createSignedUrl(screenshot_url, 60 * 60 * 24 * 7);
            const fullScreenshotUrl = signedUrlData?.signedUrl || screenshot_url;

            const { embed } = buildPendingMVPEmbed(
              submitterDetails?.discord_id || null, submitterDetails?.discord_username || 'Unknown User',
              targetDetails?.discord_id || null, targetDetails?.discord_username || 'Unknown User',
              resolvedAction, match_id || null, fullScreenshotUrl,
            );

            const webhookResponse = await fetch(webhookUrl + '?wait=true', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ embeds: [embed] }),
            });

            if (webhookResponse.ok) {
              const responseText = await webhookResponse.text();
              if (responseText && responseText.trim().length > 0) {
                try {
                  const discordMessage = JSON.parse(responseText);
                  if (discordMessage.id) {
                    await supabase.from('rank_up_requests').update({ discord_message_id: discordMessage.id }).eq('id', request.id);
                  }
                } catch (_) { /* ignore parse errors */ }
              }
            } else {
              console.error('Discord webhook failed:', webhookResponse.status);
            }
          }
        } catch (webhookError) {
          console.error('Failed to send Discord notification:', webhookError);
        }
      }

      return c.json({ request });
    } catch (error) {
      console.error('Submit MVP request error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Update user rank directly (Owner only)
  app.patch(`${PREFIX}/admin/users/:userId/rank`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('id, role').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser) return c.json({ error: 'User not found' }, 404);
      if (dbUser.role !== 'owner') return c.json({ error: 'Only owners can update user ranks' }, 403);

      const userId = c.req.param('userId');
      const { action } = await c.req.json();
      if (!['rank_up', 'rank_down', 'prestige', 'rank_to_max', 'rank_to_min', 'reset_prestige'].includes(action)) {
        return c.json({ error: 'Invalid action' }, 400);
      }

      const { data: targetUser, error: targetError } = await supabase
        .from('users').select('rank_id, prestige_level').eq('id', userId).single();
      if (targetError || !targetUser) return c.json({ error: 'Target user not found' }, 404);

      let newRankId = targetUser.rank_id;
      let newPrestigeLevel = targetUser.prestige_level;
      const oldRankId = targetUser.rank_id;
      const oldPrestigeLevel = targetUser.prestige_level;

      if (action === 'rank_up') {
        const maxRank = newPrestigeLevel === 5 ? 11 : 10;
        if (newRankId >= maxRank) return c.json({ error: `User is already at max rank for prestige level ${newPrestigeLevel}` }, 400);
        newRankId++;
      } else if (action === 'rank_down') {
        if (newRankId <= 1) return c.json({ error: 'User is already at minimum rank' }, 400);
        newRankId--;
      } else if (action === 'prestige') {
        if (newPrestigeLevel >= 5) return c.json({ error: 'User is already at max prestige level' }, 400);
        const maxRank = 10;
        if (newRankId < maxRank) return c.json({ error: 'User must be at max rank to prestige' }, 400);
        newPrestigeLevel++;
        newRankId = 1;
      } else if (action === 'rank_to_max') {
        newRankId = newPrestigeLevel === 5 ? 11 : 10;
      } else if (action === 'rank_to_min') {
        newRankId = 1;
      } else if (action === 'reset_prestige') {
        newPrestigeLevel = 0;
        newRankId = 1;
      }

      const { data: updatedUser, error: updateError } = await supabase
        .from('users').update({ rank_id: newRankId, prestige_level: newPrestigeLevel, updated_at: new Date().toISOString() })
        .eq('id', userId).select().single();
      if (updateError) { console.error('Error updating user rank:', updateError); return c.json({ error: 'Failed to update user rank' }, 500); }

      // ── Activity logging (non-critical) ──
      try {
        const { data: targetUsername } = await supabase
          .from('users').select('discord_username').eq('id', userId).single();
        const { data: actorUser } = await supabase
          .from('users').select('discord_username, discord_avatar').eq('id', dbUser.id).single();
        const targetName = targetUsername?.discord_username || 'Unknown';
        const actorName = actorUser?.discord_username || 'Owner';
        const actorAvatar = actorUser?.discord_avatar || undefined;

        // Look up rank names for human-readable log messages
        const [oldRankData, newRankData] = await Promise.all([
          supabase.from('ranks').select('name').eq('id', oldRankId).single(),
          supabase.from('ranks').select('name').eq('id', newRankId).single(),
        ]);
        const oldRankName = oldRankData?.data?.name || `Rank ${oldRankId}`;
        const newRankName = newRankData?.data?.name || `Rank ${newRankId}`;

        const actionDesc = action === 'prestige' ? 'Prestige' :
          action === 'rank_to_max' ? 'Rank to Max' :
          action === 'rank_to_min' ? 'Rank to Min' :
          action === 'reset_prestige' ? 'Reset Prestige' :
          action === 'rank_up' ? 'Rank Up' : 'Rank Down';

        await createAdminLog({
          type: 'direct_rank_change',
          action: `Direct rank change on ${targetName}: ${actionDesc} (${oldRankName} → ${newRankName}, prestige ${oldPrestigeLevel} → ${newPrestigeLevel})`,
          actor_id: dbUser.id,
          actor_name: actorName,
          actor_avatar: actorAvatar,
          details: { target_user_id: userId, action, old_rank_id: oldRankId, new_rank_id: newRankId, old_prestige_level: oldPrestigeLevel, new_prestige_level: newPrestigeLevel },
        });

        await createUserActivity({
          user_id: userId,
          type: 'admin_rank_change',
          title: `Rank ${actionDesc}`,
          description: `Your rank was changed by ${actorName}: ${oldRankName} → ${newRankName} (prestige ${oldPrestigeLevel} → ${newPrestigeLevel}).`,
          actor_name: actorName,
          actor_avatar: actorAvatar,
        });

        await createNotification({
          user_id: userId,
          type: 'rank_changed',
          title: `Rank ${actionDesc}`,
          body: `Your rank was changed to ${newRankName} by ${actorName}.`,
          actor_name: actorName,
          actor_avatar: actorAvatar,
        });
      } catch (logErr) {
        console.error('Non-critical: activity logging for direct rank change failed:', logErr);
      }

      try {
        await kv.set(`rank_action:${userId}:${Date.now()}`, {
          action, performed_by_user_id: dbUser.id, target_user_id: userId,
          old_rank_id: oldRankId, new_rank_id: newRankId,
          old_prestige_level: oldPrestigeLevel, new_prestige_level: newPrestigeLevel,
          timestamp: new Date().toISOString()
        });
      } catch (_) { /* history logging is non-critical */ }

      return c.json({ user: updatedUser });
    } catch (error) {
      console.error('Update user rank error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Get user's own MVP requests
  app.get(`${PREFIX}/requests/mvp/my`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('id').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser) return c.json({ error: 'User not found' }, 404);

      const { data: requests, error: requestsError } = await supabase
        .from('rank_up_requests')
        .select(`*, users!rank_up_requests_user_id_fkey(id, discord_username, discord_avatar, email, rank_id, prestige_level),
          target_user:users!rank_up_requests_target_user_id_fkey(id, discord_username, discord_avatar, email, rank_id, prestige_level),
          reviewed_by_user:users!rank_up_requests_reviewed_by_fkey(id, discord_username, discord_avatar)`)
        .eq('user_id', dbUser.id).order('created_at', { ascending: false });
      if (requestsError) return c.json({ error: 'Failed to fetch MVP requests' }, 500);

      const requestsWithSignedUrls = await Promise.all((requests || []).map(async (request: any) => {
        if (request.screenshot_url && !request.screenshot_url.startsWith('http')) {
          const { data: urlData } = await supabase.storage.from('make-4789f4af-mvp-screenshots')
            .createSignedUrl(request.screenshot_url, 60 * 60 * 24);
          return { ...request, screenshot_url: urlData?.signedUrl || request.screenshot_url };
        }
        return request;
      }));

      return c.json({ requests: requestsWithSignedUrls });
    } catch (error) {
      console.error('Get MVP requests error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Get all MVP requests (Admin/Owner only)
  app.get(`${PREFIX}/admin/mvp-requests`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('role').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser) return c.json({ error: 'User not found' }, 404);
      if (!isOfficer(dbUser.role)) {
        return c.json({ error: 'Only owners and officers can access this endpoint' }, 403);
      }

      const { data: requests, error: requestsError } = await supabase
        .from('rank_up_requests')
        .select(`*, users!rank_up_requests_user_id_fkey(id, discord_username, discord_avatar, email, rank_id, prestige_level),
          target_user:users!rank_up_requests_target_user_id_fkey(id, discord_username, discord_avatar, email, rank_id, prestige_level),
          reviewed_by_user:users!rank_up_requests_reviewed_by_fkey(id, discord_username, discord_avatar)`)
        .order('created_at', { ascending: false });
      if (requestsError) return c.json({ error: 'Failed to fetch MVP requests' }, 500);

      const requestsWithSignedUrls = await Promise.all((requests || []).map(async (request: any) => {
        if (request.screenshot_url && !request.screenshot_url.startsWith('http')) {
          const { data: urlData } = await supabase.storage.from('make-4789f4af-mvp-screenshots')
            .createSignedUrl(request.screenshot_url, 60 * 60 * 24);
          return { ...request, screenshot_url: urlData?.signedUrl || request.screenshot_url };
        }
        return request;
      }));

      return c.json({ requests: requestsWithSignedUrls });
    } catch (error) {
      console.error('Get MVP requests error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Approve MVP request and rank up user (Admin/Owner only)
  app.post(`${PREFIX}/admin/mvp-requests/:requestId/approve`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('id, role, discord_username').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser) return c.json({ error: 'User not found' }, 404);
      if (!isOfficer(dbUser.role)) {
        return c.json({ error: 'Only owners and officers can approve requests' }, 403);
      }

      const requestId = c.req.param('requestId');
      const { data: request, error: fetchError } = await supabase
        .from('rank_up_requests')
        .select('user_id, target_user_id, action, status, current_rank_id, current_prestige_level, target_discord_id, target_discord_username, discord_message_id, discord_channel_id')
        .eq('id', requestId).single();
      if (fetchError || !request) return c.json({ error: 'Request not found' }, 404);
      if (request.status !== 'pending') return c.json({ error: 'Request has already been processed' }, 400);

      // Block if target user not registered
      if (!request.target_user_id) {
        if (request.discord_message_id && request.discord_channel_id && request.target_discord_id) {
          updateDiscordMVPMessageBlocked(request.discord_message_id, request.discord_channel_id,
            request.target_discord_id, request.target_discord_username || 'Unknown', dbUser.discord_username || 'Unknown');
        }
        return c.json({ error: 'Target user is not in The Corn Field guild.', requiresGuildJoin: true }, 400);
      }

      const userToRankUp = request.target_user_id;
      const action = request.action || 'rank_up';

      const { data: targetUser, error: targetError } = await supabase
        .from('users').select('rank_id, prestige_level, guild_id').eq('id', userToRankUp).single();
      if (targetError || !targetUser) return c.json({ error: 'User not found' }, 404);

      const maxRank = targetUser.prestige_level === 5 ? 11 : 10;
      let newRankId = targetUser.rank_id;
      let newPrestigeLevel = targetUser.prestige_level;

      if (action === 'rank_up') {
        if (targetUser.rank_id < maxRank) newRankId++;
        else return c.json({ error: 'User is already at max rank' }, 400);
      } else if (action === 'rank_down') {
        if (targetUser.rank_id > 1) newRankId--;
        else return c.json({ error: 'User is already at minimum rank' }, 400);
      } else if (action === 'prestige') {
        if (targetUser.prestige_level < 5) { newRankId = 1; newPrestigeLevel++; }
        else return c.json({ error: 'User is already at max prestige level' }, 400);
      }

      // Look up active season for Guild Wars stamping
      const { data: activeSeason } = await supabase
        .from('guild_wars_seasons')
        .select('id')
        .eq('status', 'active')
        .maybeSingle();

      // Stamp guild_id + season_id on the request for Guild Wars scoring
      const { error: updateRequestError } = await supabase
        .from('rank_up_requests').update({
          status: 'approved',
          reviewed_by: dbUser.id,
          reviewed_at: new Date().toISOString(),
          guild_id: targetUser.guild_id || null,
          season_id: activeSeason?.id || null,
        })
        .eq('id', requestId);
      if (updateRequestError) return c.json({ error: 'Failed to approve request' }, 500);

      const { error: updateUserError } = await supabase
        .from('users').update({ rank_id: newRankId, prestige_level: newPrestigeLevel, updated_at: new Date().toISOString() })
        .eq('id', userToRankUp);
      if (updateUserError) return c.json({ error: 'Failed to rank up user' }, 500);

      try {
        await kv.set(`rank_action:${userToRankUp}:${Date.now()}`, {
          target_user_id: userToRankUp, performed_by_user_id: request.user_id, action,
          old_rank_id: targetUser.rank_id, new_rank_id: newRankId,
          old_prestige_level: targetUser.prestige_level, new_prestige_level: newPrestigeLevel,
          timestamp: new Date().toISOString()
        });
      } catch (_) { /* non-critical */ }

      updateDiscordMVPMessage(requestId, 'approved', dbUser.discord_username || 'Unknown');
      updateWebhookMVPMessage(requestId, 'approved', dbUser.discord_username || 'Unknown');

      // Notify the target user and log admin action (non-critical)
      try {
        // Look up human-readable names for log messages
        const { data: targetUserInfo } = await supabase
          .from('users').select('discord_username').eq('id', userToRankUp).single();
        const targetName = targetUserInfo?.discord_username || request.target_discord_username || 'Unknown';
        const [oldRankData, newRankData] = await Promise.all([
          supabase.from('ranks').select('name').eq('id', targetUser.rank_id).single(),
          supabase.from('ranks').select('name').eq('id', newRankId).single(),
        ]);
        const oldRankName = oldRankData?.data?.name || `Rank ${targetUser.rank_id}`;
        const newRankName = newRankData?.data?.name || `Rank ${newRankId}`;
        const actionLabel = action === 'rank_down' ? 'rank down' : action === 'prestige' ? 'prestige' : 'rank up';

        await createNotification({
          user_id: userToRankUp,
          type: 'mvp_reviewed',
          title: 'MVP Request Approved',
          body: `Your ${actionLabel} request was approved by ${dbUser.discord_username}. You are now ${newRankName}.`,
          related_id: requestId,
          actor_name: dbUser.discord_username,
        });
        await createAdminLog({
          type: 'mvp_approved',
          action: `Approved ${actionLabel} request for ${targetName} (${oldRankName} → ${newRankName})`,
          actor_id: dbUser.id,
          actor_name: dbUser.discord_username,
          details: { request_id: requestId, action, target_name: targetName, old_rank: targetUser.rank_id, new_rank: newRankId },
        });
        await createUserActivity({
          user_id: userToRankUp,
          type: 'admin_rank_change',
          title: `${action === 'rank_down' ? 'Rank Down' : action === 'prestige' ? 'Prestige' : 'Rank Up'}: Now ${newRankName}`,
          description: `Your ${actionLabel} request was approved by ${dbUser.discord_username}. You went from ${oldRankName} to ${newRankName}.`,
          related_id: requestId,
          actor_name: dbUser.discord_username,
          metadata: { action, old_rank: targetUser.rank_id, new_rank: newRankId, old_prestige: targetUser.prestige_level, new_prestige: newPrestigeLevel },
        });
      } catch (_) { /* notification/log is non-critical */ }

      return c.json({ success: true, new_rank_id: newRankId });
    } catch (error) {
      console.error('Approve MVP request error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Deny MVP request (Admin/Owner only)
  app.post(`${PREFIX}/admin/mvp-requests/:requestId/deny`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('id, role, discord_username').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser) return c.json({ error: 'User not found' }, 404);
      if (!isOfficer(dbUser.role)) {
        return c.json({ error: 'Only owners and officers can deny requests' }, 403);
      }

      const requestId = c.req.param('requestId');
      const { data: request, error: fetchError } = await supabase
        .from('rank_up_requests').select('status, user_id, target_user_id, action, target_discord_username').eq('id', requestId).single();
      if (fetchError || !request) return c.json({ error: 'Request not found' }, 404);
      if (request.status !== 'pending') return c.json({ error: 'Request has already been processed' }, 400);

      const { error: updateError } = await supabase
        .from('rank_up_requests').update({ status: 'denied', reviewed_by: dbUser.id, reviewed_at: new Date().toISOString() })
        .eq('id', requestId);
      if (updateError) return c.json({ error: 'Failed to deny request' }, 500);

      updateDiscordMVPMessage(requestId, 'denied', dbUser.discord_username || 'Unknown');
      updateWebhookMVPMessage(requestId, 'denied', dbUser.discord_username || 'Unknown');

      // Notify submitter and target, log admin action (non-critical)
      try {
        const notifyUserId = request.target_user_id || request.user_id;
        // Look up the target user's name for human-readable logs
        let targetName = request.target_discord_username || 'Unknown';
        if (notifyUserId) {
          const { data: targetUserInfo } = await supabase
            .from('users').select('discord_username').eq('id', notifyUserId).single();
          targetName = targetUserInfo?.discord_username || targetName;

          await createNotification({
            user_id: notifyUserId,
            type: 'mvp_reviewed',
            title: 'MVP Request Denied',
            body: `Your MVP ${request.action || 'rank up'} request was denied by ${dbUser.discord_username}.`,
            related_id: requestId,
            actor_name: dbUser.discord_username,
          });
          // Dual-log: target user sees it in their Activity tab too
          await createUserActivity({
            user_id: notifyUserId,
            type: 'admin_rank_change',
            title: 'MVP Request Denied',
            description: `Your ${request.action || 'rank up'} request was denied by ${dbUser.discord_username}.`,
            related_id: requestId,
            actor_name: dbUser.discord_username,
            metadata: { action: 'denied', request_id: requestId },
          });
        }
        const actionLabel = request.action === 'rank_down' ? 'rank down' : request.action === 'prestige' ? 'prestige' : 'rank up';
        await createAdminLog({
          type: 'mvp_denied',
          action: `Denied ${actionLabel} request from ${targetName}`,
          actor_id: dbUser.id,
          actor_name: dbUser.discord_username,
          details: { request_id: requestId, target_name: targetName, action: request.action },
        });
      } catch (_) { /* non-critical */ }

      return c.json({ success: true });
    } catch (error) {
      console.error('Deny MVP request error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Hard-delete (dismiss) an MVP request (Admin/Owner or request owner)
  app.delete(`${PREFIX}/admin/mvp-requests/:requestId`, async (c) => {
    try {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      if (!accessToken) return c.json({ error: 'No access token provided' }, 401);

      const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
      if (authError || !authUser) return c.json({ error: 'Unauthorized' }, 401);

      const { data: dbUser, error: userError } = await supabase
        .from('users').select('id, role, discord_username').eq('supabase_id', authUser.id).single();
      if (userError || !dbUser) return c.json({ error: 'User not found' }, 404);

      const isAdmin = isOfficer(dbUser.role);
      const requestId = c.req.param('requestId');

      const { data: request, error: fetchError } = await supabase
        .from('rank_up_requests').select('screenshot_url, discord_message_id, discord_channel_id, user_id, target_user_id, action')
        .eq('id', requestId).single();
      if (fetchError || !request) return c.json({ error: 'Request not found' }, 404);
      if (!isAdmin && request.user_id !== dbUser.id) return c.json({ error: 'Only admins or the request owner can delete requests' }, 403);

      // Delete screenshot from storage
      if (request.screenshot_url && !request.screenshot_url.startsWith('http')) {
        await supabase.storage.from('make-4789f4af-mvp-screenshots').remove([request.screenshot_url]);
      }

      // Delete Discord messages (both bot and webhook)
      if (request.discord_message_id) {
        if (request.discord_channel_id) {
          const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
          if (botToken) {
            try {
              await fetch(`https://discord.com/api/v10/channels/${request.discord_channel_id}/messages/${request.discord_message_id}`,
                { method: 'DELETE', headers: { 'Authorization': `Bot ${botToken}` } });
            } catch (_) { /* ignore */ }
          }
        }
        const webhookUrl = DISCORD_WEBHOOKS.MVP_SUBMISSION;
        if (webhookUrl) {
          try {
            await fetch(`${webhookUrl}/messages/${request.discord_message_id}`, { method: 'DELETE' });
          } catch (_) { /* ignore */ }
        }
      }

      // Delete request record
      const { error: deleteError } = await supabase.from('rank_up_requests').delete().eq('id', requestId);
      if (deleteError) return c.json({ error: 'Failed to delete request record' }, 500);

      // Log activity for the target user (non-critical — dismissed, not denied)
      try {
        const targetUserId = request.target_user_id || request.user_id;
        if (targetUserId && isAdmin) {
          const { data: targetUser } = await supabase
            .from('users').select('discord_username').eq('id', targetUserId).maybeSingle();
          await createUserActivity({
            user_id: targetUserId,
            type: 'mvp_dismissed',
            title: 'MVP Request Dismissed',
            description: `Your ${request.action || 'rank up'} request was dismissed by ${dbUser.discord_username || 'an officer'}. No rank changes were made.`,
            actor_name: dbUser.discord_username,
          });
          await createAdminLog({
            type: 'mvp_dismissed',
            action: `Dismissed MVP ${request.action || 'rank up'} request for ${targetUser?.discord_username || 'unknown user'}`,
            actor_id: dbUser.id,
            actor_name: dbUser.discord_username,
          });
        }
      } catch (_) { /* non-critical */ }

      return c.json({ success: true });
    } catch (error) {
      console.error('Delete MVP request error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

}