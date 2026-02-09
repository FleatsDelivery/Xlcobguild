import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Discord Interaction Types
const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
};

const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  UPDATE_MESSAGE: 7,
};

// Verify Discord request signature
async function verifyDiscordRequest(request: Request): Promise<boolean> {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const publicKey = Deno.env.get('DISCORD_PUBLIC_KEY');

  console.log('🔍 Verifying Discord request...');
  console.log('  Signature present:', !!signature);
  console.log('  Timestamp present:', !!timestamp);
  console.log('  Public Key present:', !!publicKey);
  console.log('  Public Key length:', publicKey?.length || 0);

  if (!signature || !timestamp || !publicKey) {
    console.error('❌ Missing required headers or environment variable');
    return false;
  }

  const body = await request.clone().text();
  console.log('  Request body:', body);
  
  try {
    const encoder = new TextEncoder();
    const message = encoder.encode(timestamp + body);
    const signatureBytes = hexToBytes(signature);
    const publicKeyBytes = hexToBytes(publicKey);

    console.log('  Message to verify length:', message.length);
    console.log('  Signature bytes length:', signatureBytes.length);
    console.log('  Public key bytes length:', publicKeyBytes.length);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      publicKeyBytes,
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false,
      ['verify']
    );

    const isValid = await crypto.subtle.verify(
      'Ed25519',
      cryptoKey,
      signatureBytes,
      message
    );
    
    console.log('  ✅ Signature valid:', isValid);
    return isValid;
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Error response helper
function errorResponse(message: string) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '❌ Error',
        description: message,
        color: 0xEF4444, // Red color
        timestamp: new Date().toISOString(),
      }],
      flags: 64, // Ephemeral (only visible to user)
    },
  };
}

// Public success announcement (everyone can see)
function publicSuccessResponse(submitterDiscordId: string, submitterUsername: string, targetDiscordId: string, targetUsername: string, action: string, matchId: string | null, imageUrl: string) {
  const actionEmoji = action === 'rank_up' ? '⬆️' : action === 'rank_down' ? '⬇️' : '⭐';
  const actionText = action === 'rank_up' ? 'Rank Up' : action === 'rank_down' ? 'Rank Down' : 'Prestige';
  
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: `🌽 New MVP Request Submitted!`,
        color: 0xF97316, // Orange
        fields: [
          {
            name: '👤 Requested By',
            value: `<@${submitterDiscordId}>`,
            inline: true,
          },
          {
            name: '🎯 Target Player',
            value: `<@${targetDiscordId}>`,
            inline: true,
          },
          {
            name: `⚡ Action`,
            value: `${actionEmoji} ${actionText}${matchId ? `\n🎮 Match ID: \`${matchId}\`` : ''}`,
            inline: true,
          },
          {
            name: '📊 Status',
            value: '⏳ Pending officer review',
            inline: true,
          },
        ],
        image: {
          url: imageUrl, // Display the uploaded screenshot
        },
        timestamp: new Date().toISOString(),
      }],
      components: [{
        type: 1, // Action Row
        components: [{
          type: 2, // Button
          style: 5, // Link button
          label: 'View on Web App',
          url: 'https://kernelkup.figma.site/#requests',
          emoji: {
            name: '🌐'
          }
        }]
      }],
    },
  };
}

// Processing/deferred response (shows "Bot is thinking...")
function deferredResponse() {
  return {
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: 0, // Public response
    },
  };
}

// Rank names for display
const RANK_NAMES = [
  '', // 0 index unused
  'Earwig',
  'Ugandan Kob',
  'Private Maize',
  'Specialist Ingredient',
  'Corporal Corn Bread',
  'Sergeant Husk',
  'Sergeant Major Fields',
  'Captain Cornhole',
  'Major Cob',
  'Corn Star',
  "Pop'd Kernel",
];

// Role IDs for party finder modes
const DERBA_MODES: Record<string, { role_id: string; name: string }> = {
  dos: { role_id: '1138890000528855070', name: 'DERBA-DOS' },
  turba: { role_id: '1303799483028476046', name: 'turba-durbs' },
  bcup: { role_id: '1387894719161303141', name: 'bcup-bummers' },
};

// Helper to build party finder lobby embed and components
function buildDerbaEmbed(lobby: any): { embeds: any[]; components: any[] } {
  const playerCount = lobby.players.filter((p: any) => p !== null).length;
  const hasCoach = lobby.coach !== null;
  const isFull = playerCount === 5 && hasCoach;
  const isExpired = Date.now() > lobby.expires_at;
  const isCancelled = lobby.status === 'cancelled';
  const isClosed = lobby.status === 'closed' || isCancelled || isExpired || isFull;

  const mode = DERBA_MODES[lobby.mode] || DERBA_MODES.dos;

  // Compact tombstone for expired/cancelled lobbies (not full — full lobbies keep their glory)
  if (isClosed && !isFull) {
    const statusText = isCancelled ? 'cancelled ❌' : 'ended ⏰';
    return {
      embeds: [{
        description: `🌽 ~~It's time for some Dota...~~ **Party ${statusText}** — <@${lobby.creator_id}> • ${mode.name}`,
        color: 0x4B5563, // muted grey
      }],
      components: [],
    };
  }

  const title = "🌽 It's time for some Dota...";

  let description = '';
  if (isFull) {
    description = `<@${lobby.creator_id}>'s party is **FULL**! 🎉\n\n🎮 **GL HF!**`;
  } else {
    description = `<@${lobby.creator_id}> is lookin to play some <@&${mode.role_id}> who's in?`;
  }

  const playerLines = lobby.players.map((p: any, i: number) => {
    if (p) return `\`${i + 1}.\` ✅ <@${p.discord_id}>`;
    return `\`${i + 1}.\` 🔲 *Empty*`;
  });

  const coachLine = hasCoach
    ? `✅ <@${lobby.coach.discord_id}>`
    : '🔲 *Empty*';

  const fields: any[] = [
    {
      name: `—— Players (${playerCount}/5) ——`,
      value: playerLines.join('\n'),
      inline: false,
    },
    {
      name: `—— Coach (${hasCoach ? '1' : '0'}/1) ——`,
      value: coachLine,
      inline: false,
    },
  ];

  // Add timer field at the bottom for active lobbies
  if (!isClosed) {
    fields.push({
      name: '\u200b',
      value: `⏰ Lobby closes <t:${Math.floor(lobby.expires_at / 1000)}:R>`,
      inline: false,
    });
  }

  const components: any[] = [];
  if (!isClosed) {
    const buttons: any[] = [];
    if (playerCount < 5) {
      buttons.push({
        type: 2,
        style: 3, // Green (Success)
        label: "I'll Play",
        custom_id: `derba_play:${lobby.id}`,
        emoji: { name: '🎮' },
      });
    }
    if (!hasCoach) {
      buttons.push({
        type: 2,
        style: 1, // Blue (Primary)
        label: "I'll Coach",
        custom_id: `derba_coach:${lobby.id}`,
        emoji: { name: '📋' },
      });
    }
    buttons.push({
      type: 2,
      style: 4, // Red (Danger)
      label: 'Leave',
      custom_id: `derba_leave:${lobby.id}`,
      emoji: { name: '🚪' },
    });
    buttons.push({
      type: 2,
      style: 2, // Grey (Secondary)
      label: 'Cancel',
      custom_id: `derba_cancel:${lobby.id}`,
      emoji: { name: '✖️' },
    });
    components.push({ type: 1, components: buttons });
  }

  return {
    embeds: [{
      title,
      description,
      fields,
      color: 0xDC2626,
      footer: {
        text: `The Corn Field • ${mode.name}`,
      },
    }],
    components,
  };
}

serve(async (req) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Verify Discord signature
  const isValid = await verifyDiscordRequest(req);
  if (!isValid) {
    console.error('Invalid Discord signature');
    return new Response('Invalid request signature', { status: 401 });
  }

  const body = await req.json();
  console.log('Discord interaction received:', JSON.stringify(body, null, 2));

  // Handle PING (Discord verification)
  if (body.type === InteractionType.PING) {
    return new Response(JSON.stringify({ type: InteractionResponseType.PONG }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Handle /mvp command
  if (body.type === InteractionType.APPLICATION_COMMAND && body.data.name === 'mvp') {
    try {
      // Initialize Supabase client
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get command options
      const options = body.data.options || [];
      const getOption = (name: string) => options.find((opt: any) => opt.name === name)?.value;
      
      const targetDiscordUser = options.find((opt: any) => opt.name === 'user')?.value; // Discord user ID
      const screenshotAttachmentId = getOption('screenshot'); // This is the attachment ID
      const action = getOption('action');
      const matchId = getOption('match_id');

      // Get submitter's Discord ID and username
      const submitterDiscordId = body.member?.user?.id || body.user?.id;
      const submitterDiscordUser = body.member?.user || body.user;
      const submitterUsername = submitterDiscordUser?.username || submitterDiscordUser?.global_name || 'Unknown';

      if (!submitterDiscordId) {
        return new Response(JSON.stringify(errorResponse('Could not identify your Discord account.')), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get target Discord user info from resolved data
      const targetDiscordUserData = body.data.resolved?.users?.[targetDiscordUser];
      const targetUsername = targetDiscordUserData?.username || targetDiscordUserData?.global_name || 'Unknown';

      // Get the actual attachment data from resolved attachments
      const screenshotAttachment = body.data.resolved?.attachments?.[screenshotAttachmentId];
      
      console.log('Screenshot attachment ID:', screenshotAttachmentId);
      console.log('Resolved attachments:', body.data.resolved?.attachments);
      console.log('Screenshot attachment data:', screenshotAttachment);
      console.log('Submitter Discord ID:', submitterDiscordId);
      console.log('Submitter Username:', submitterUsername);
      console.log('Target Discord ID:', targetDiscordUser);
      console.log('Target Username:', targetUsername);

      // Step 1: Lookup submitter in database (OPTIONAL - anyone can submit)
      const { data: submitter } = await supabase
        .from('users')
        .select('*')
        .eq('discord_id', submitterDiscordId)
        .maybeSingle();

      // Step 2: Lookup target user (OPTIONAL - we'll store Discord info regardless)
      const { data: targetUser } = await supabase
        .from('users')
        .select('*')
        .eq('discord_id', targetDiscordUser)
        .maybeSingle();

      // Step 3: Validate permissions based on action
      const actionLower = action.toLowerCase().replace(' ', '_'); // "Rank Up" -> "rank_up"

      // NEW PERMISSION RULES:
      // - Rank Up: Anyone can submit (even non-registered)
      // - Rank Down: Only Corn Star (rank 10) can submit - NOT Pop'd Kernel
      // - Prestige: Only Corn Star (rank 10) OR Pop'd Kernel (rank 11) can submit
      
      if (actionLower === 'rank_down') {
        // Only Corn Star (rank 10) can rank down - NOT Pop'd Kernel
        if (!submitter || submitter.rank_id !== 10) {
          return new Response(
            JSON.stringify(
              errorResponse(
                `Only **Corn Star** members can submit rank down requests!${submitter ? `\n\nYour current rank: ${RANK_NAMES[submitter.rank_id]} (Prestige ${submitter.prestige_level})` : '\n\nYou must be registered and achieve Corn Star rank first.'}`
              )
            ),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      if (actionLower === 'prestige') {
        // Only Corn Star (rank 10) OR Pop'd Kernel (rank 11) can submit prestige
        if (!submitter || (submitter.rank_id !== 10 && submitter.rank_id !== 11)) {
          return new Response(
            JSON.stringify(
              errorResponse(
                `Only **Corn Star** or **Popd Kernel** members can submit prestige requests!${submitter ? `\n\nYour current rank: ${RANK_NAMES[submitter.rank_id]} (Prestige ${submitter.prestige_level})` : '\n\nYou must be registered and achieve Corn Star or Popd Kernel rank first.'}`
              )
            ),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // Validation: If target is registered, check rank limits
      if (targetUser) {
        // Rank down validation: can't rank down below Earwig or Pop'd Kernel
        if (actionLower === 'rank_down') {
          if (targetUser.rank_id <= 1) {
            return new Response(
              JSON.stringify(errorResponse('Cannot rank down below Earwig!')),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }
          // CANNOT rank down Pop'd Kernel (rank 11)
          if (targetUser.rank_id === 11) {
            return new Response(
              JSON.stringify(errorResponse('Cannot rank down Popd Kernel! Only Corn Star can be ranked down.')),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }
        }

        // Rank up validation: can't rank up above Pop'd Kernel (unless prestiging)
        if (actionLower === 'rank_up' && targetUser.rank_id >= 11) {
          return new Response(
            JSON.stringify(errorResponse('User is already at max rank (Popd Kernel)! Consider prestiging instead.')),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Prestige validation: target must be Corn Star or Pop'd Kernel
        if (actionLower === 'prestige' && targetUser.rank_id < 10) {
          return new Response(
            JSON.stringify(
              errorResponse(
                `Target user must be **Corn Star** or **Popd Kernel** to prestige!\n\nTarget rank: ${RANK_NAMES[targetUser.rank_id]}`
              )
            ),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // Step 4: Download and upload screenshot
      if (!screenshotAttachment || !screenshotAttachment.url) {
        return new Response(
          JSON.stringify(errorResponse('Screenshot attachment is missing!')),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      const screenshotUrl = screenshotAttachment.url;
      const screenshotContentType = screenshotAttachment.content_type;

      // Validate image type
      if (!screenshotContentType?.startsWith('image/')) {
        return new Response(
          JSON.stringify(errorResponse('Screenshot must be an image file (PNG, JPG, JPEG, etc.)!')),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.log('Downloading screenshot from Discord:', screenshotUrl);

      // Download screenshot from Discord
      const imageResponse = await fetch(screenshotUrl);
      if (!imageResponse.ok) {
        throw new Error('Failed to download screenshot from Discord');
      }
      const imageBuffer = await imageResponse.arrayBuffer();

      // Upload to Supabase Storage
      const fileName = `${Date.now()}_${submitterDiscordId}_${targetDiscordUser}.png`;
      const filePath = `mvp-screenshots/${fileName}`; // Store in folder to match web app
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('make-4789f4af-mvp-screenshots')
        .upload(filePath, imageBuffer, {
          contentType: screenshotContentType,
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return new Response(
          JSON.stringify(errorResponse('Failed to upload screenshot to storage!')),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.log('Screenshot uploaded successfully to:', filePath);

      // Step 5: Create MVP request in database
      // Store Discord info as metadata since user_id/target_user_id may be null
      const requestData: any = {
        user_id: submitter?.id || null,  // May be null if submitter not registered
        target_user_id: targetUser?.id || null,  // May be null if target not registered
        action: actionLower,
        match_id: matchId,
        screenshot_url: filePath,
        status: 'pending',
        type: 'mvp',
        // Store Discord metadata for display purposes
        submitter_discord_id: submitterDiscordId,
        submitter_discord_username: submitterUsername,
        target_discord_id: targetDiscordUser,
        target_discord_username: targetUsername,
      };

      const { data: mvpRequest, error: insertError } = await supabase
        .from('rank_up_requests')
        .insert(requestData)
        .select()
        .single();

      if (insertError || !mvpRequest) {
        console.error('Failed to create MVP request:', insertError);
        return new Response(JSON.stringify(errorResponse('Failed to create MVP request in database')), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      console.log('MVP request created successfully');

      // Step 6: Generate signed URL for Discord embed (7 days expiry)
      const { data: signedUrlData } = await supabase.storage
        .from('make-4789f4af-mvp-screenshots')
        .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days

      const imageUrl = signedUrlData?.signedUrl || '';

      console.log('Generated signed URL for Discord:', imageUrl);

      // Step 7: Send success response with image (this posts the message to Discord)
      const response = publicSuccessResponse(submitterDiscordId, submitterUsername, targetDiscordUser, targetUsername, actionLower, matchId, imageUrl);

      // Step 8: Asynchronously fetch the posted message to get its ID and update database
      // We need to do this AFTER responding to Discord, so we don't block the response
      const interactionToken = body.token;
      const applicationId = Deno.env.get('DISCORD_APPLICATION_ID');
      const channelId = body.channel_id;

      // Don't await this - let it run in background
      (async () => {
        try {
          // Wait a moment for Discord to process the message
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Fetch the original message using the interaction token
          const messageResponse = await fetch(
            `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
            {
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );

          if (messageResponse.ok) {
            const messageData = await messageResponse.json();
            const messageId = messageData.id;

            console.log('Fetched Discord message ID:', messageId);

            // Update the MVP request with Discord message info
            await supabase
              .from('rank_up_requests')
              .update({
                discord_message_id: messageId,
                discord_channel_id: channelId,
              })
              .eq('id', mvpRequest.id);

            console.log('Updated MVP request with Discord message info');
          } else {
            console.error('Failed to fetch Discord message:', await messageResponse.text());
          }
        } catch (error) {
          console.error('Error fetching Discord message ID:', error);
        }
      })();

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error handling /mvp command:', error);
      return new Response(
        JSON.stringify(errorResponse('An unexpected error occurred. Please try again later.')),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Handle /joinguild command (renamed from /signup)
  if (body.type === InteractionType.APPLICATION_COMMAND && (body.data.name === 'joinguild' || body.data.name === 'signup')) {
    try {
      // Get user's Discord info
      const discordUser = body.member?.user || body.user;
      const discordId = discordUser.id;

      if (!discordId) {
        return new Response(
          JSON.stringify(errorResponse('Could not identify your Discord account.')),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Initialize Supabase client to check if user exists
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('role')
        .eq('discord_id', discordId)
        .maybeSingle();

      if (existingUser) {
        // If they're already a member or higher, they don't need to sign up
        if (existingUser.role !== 'guest') {
          return new Response(
            JSON.stringify(errorResponse(`You're already a member of XLCOB! Your role: **${existingUser.role}**`)),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // Send ephemeral response with signup link
      const response = {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [{
            title: '🌽 Welcome to XLCOB!',
            description: `Hey <@${discordId}>!\n\nTo complete your guild registration and create your account, click the button below to sign in with Discord:\n\n👉 **This will create your authenticated account and automatically submit your membership request!**\n\nOfficers will review your request after you complete signup.`,
            color: 0xF97316, // Orange
            timestamp: new Date().toISOString(),
          }],
          components: [{
            type: 1, // Action Row
            components: [{
              type: 2, // Button
              style: 5, // Link button
              label: 'Complete Guild Registration',
              url: 'https://kernelkup.figma.site/',
              emoji: {
                name: '🌽'
              }
            }]
          }],
          flags: 64, // Ephemeral (only visible to user)
        },
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error handling /joinguild command:', error);
      return new Response(
        JSON.stringify(errorResponse('An unexpected error occurred. Please try again later.')),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Handle /leaderboard command
  if (body.type === InteractionType.APPLICATION_COMMAND && body.data.name === 'leaderboard') {
    try {
      // Initialize Supabase client
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Fetch all users sorted by rank (highest first) and prestige level
      const { data: users, error } = await supabase
        .from('users')
        .select('id, discord_username, discord_id, rank_id, prestige_level, role, kkup_player_profile_id, opendota_data, ranks(name)')
        .order('rank_id', { ascending: false })
        .order('prestige_level', { ascending: false })
        .order('discord_username', { ascending: true });

      if (error || !users) {
        console.error('Failed to fetch leaderboard:', error);
        return new Response(
          JSON.stringify(errorResponse('Failed to load leaderboard data!')),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Fetch KKUP stats from KV store in batch
      const { data: championshipRows } = await supabase
        .from('kv_store_4789f4af')
        .select('key, value')
        .like('key', 'kkup_championship:%');

      const championshipAwards = (championshipRows || []).map((r: any) => ({ key: r.key, ...r.value }));

      const { data: popdKernelRows } = await supabase
        .from('kv_store_4789f4af')
        .select('key, value')
        .like('key', 'kkup_popdkernel:%');

      const popdKernelAwards = (popdKernelRows || []).map((r: any) => ({ key: r.key, ...r.value }));

      // Deduplicate Pop'd Kernel awards by kernel_kup_id + player_id
      // (old single-key format and new multi-key format may both exist for the same award)
      const deduplicatedPopdKernels: any[] = [];
      const seenPopdKernelKeys = new Set<string>();
      for (const award of popdKernelAwards) {
        if (!award.player_id || !award.kernel_kup_id) continue;
        const dedupeKey = `${award.kernel_kup_id}:${award.player_id}`;
        if (!seenPopdKernelKeys.has(dedupeKey)) {
          seenPopdKernelKeys.add(dedupeKey);
          deduplicatedPopdKernels.push(award);
        }
      }

      // Get all team memberships for users with linked KKUP profiles
      const profileIds = users.filter((u: any) => u.kkup_player_profile_id).map((u: any) => u.kkup_player_profile_id);
      let allTeamMemberships: any[] = [];
      if (profileIds.length > 0) {
        const { data: memberships } = await supabase
          .from('kkup_team_players')
          .select('player_profile_id, team_id')
          .in('player_profile_id', profileIds);
        allTeamMemberships = memberships || [];
      }

      // Build per-user KKUP stats map
      const userStatsMap: Record<string, { championships: number; popdKernels: number }> = {};
      for (const user of users) {
        if (!user.kkup_player_profile_id) continue;
        const profileId = user.kkup_player_profile_id;
        const teamIds = allTeamMemberships
          .filter((tm: any) => tm.player_profile_id === profileId)
          .map((tm: any) => tm.team_id);

        let championships = 0;
        for (const award of championshipAwards) {
          if (teamIds.includes(award.team_id)) {
            championships++;
          }
        }

        const popdKernels = deduplicatedPopdKernels.filter((award: any) => award.player_id === profileId).length;
        userStatsMap[user.id] = { championships, popdKernels };
      }

      // Format a user line: # - @user - rank - prestige - championships - pop'd kernels
      // Only include fields that have values (except prestige which always shows)
      const formatLine = (user: any, position: number) => {
        let medal = '';
        if (position === 1) medal = '🥇';
        else if (position === 2) medal = '🥈';
        else if (position === 3) medal = '🥉';
        else medal = `**#${position}**`;

        const rankName = user.ranks?.name || 'Unknown';
        const parts: string[] = [rankName];

        parts.push(`⭐×${user.prestige_level || 0}`);

        const stats = userStatsMap[user.id];
        if (stats?.championships > 0) {
          parts.push(`🏆×${stats.championships}`);
        }
        if (stats?.popdKernels > 0) {
          parts.push(`🍿×${stats.popdKernels}`);
        }

        return `${medal} <@${user.discord_id}> - ${parts.join(' - ')}`;
      };

      // Build leaderboard display
      const topUsers = users.slice(0, 3);
      const restUsers = users.slice(3, 15);

      const topUserLines = topUsers.map((user: any, index: number) => formatLine(user, index + 1));
      const restUserLines = restUsers.map((user: any, index: number) => formatLine(user, index + 4));

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [{
              title: '🌽 Guild Leaderboard',
              description: `—— Top 3 Ranked Cobs ——\n${topUserLines.join('\n')}`,
              fields: restUserLines.length > 0 ? [{
                name: '——————————————————',
                value: restUserLines.join('\n'),
                inline: false
              }] : [],
              color: 0xF97316,
              footer: {
                text: `Total Members: ${users.length} • Today at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
              },
            }],
            components: [{
              type: 1,
              components: [{
                type: 2,
                style: 5,
                label: 'View Full Leaderboard',
                url: 'https://kernelkup.figma.site/#leaderboard',
                emoji: {
                  name: '🏆'
                }
              }]
            }],
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Error handling /leaderboard command:', error);
      return new Response(
        JSON.stringify(errorResponse('An unexpected error occurred. Please try again later.')),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Handle /register command for Kernel Kup
  if (body.type === InteractionType.APPLICATION_COMMAND && body.data.name === 'register') {
    try {
      // Get user's Discord info
      const discordUser = body.member?.user || body.user;
      const discordId = discordUser.id;
      const discordUsername = discordUser.username || discordUser.global_name || 'Unknown';

      if (!discordId) {
        return new Response(
          JSON.stringify(errorResponse('Could not identify your Discord account.')),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get the role option
      const options = body.data.options || [];
      const role = options.find((opt: any) => opt.name === 'role')?.value;

      if (!role) {
        return new Response(
          JSON.stringify(errorResponse('Please select a role!')),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Initialize Supabase client
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Check if user exists in XLCOB
      const { data: xlcobUser } = await supabase
        .from('users')
        .select('id, discord_username, role')
        .eq('discord_id', discordId)
        .maybeSingle();

      // Check if there's an active tournament with registration open
      const { data: tournaments } = await supabase
        .from('kkup_tournaments')
        .select('id, name, status')
        .eq('status', 'registration_open')
        .maybeSingle();

      if (!tournaments) {
        return new Response(
          JSON.stringify(errorResponse('No tournament is currently accepting registrations! Check back later.')),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check if user has already registered for this tournament
      const { data: existingRegistration } = await supabase
        .from('kkup_registrations')
        .select('id, role')
        .eq('tournament_id', tournaments.id)
        .eq('discord_id', discordId)
        .maybeSingle();

      if (existingRegistration) {
        return new Response(
          JSON.stringify(errorResponse(`You're already registered for ${tournaments.name} as a **${existingRegistration.role}**!`)),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Create registration
      const registrationData = {
        tournament_id: tournaments.id,
        user_id: xlcobUser?.id || null,
        discord_id: discordId,
        discord_username: discordUsername,
        role: role,
        status: 'pending',
      };

      const { data: registration, error: insertError } = await supabase
        .from('kkup_registrations')
        .insert(registrationData)
        .select()
        .single();

      if (insertError || !registration) {
        console.error('Failed to create registration:', insertError);
        return new Response(
          JSON.stringify(errorResponse('Failed to register. Please try again later.')),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.log('✅ KKUP registration created:', registration.id);

      // Role-specific emoji
      const roleEmoji = role === 'player' ? '🎮' : role === 'coach' ? '📋' : role === 'caster' ? '🎙️' : '👁️';

      // Send success response
      const response = {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [{
            title: '👑 Kernel Kup Registration Successful!',
            description: `<@${discordId}>, you've successfully registered for **${tournaments.name}**!\n\n${roleEmoji} **Role:** ${role.charAt(0).toUpperCase() + role.slice(1)}\n\n✅ Your registration is confirmed!${role === 'player' ? '\n\n👉 Visit the KKUP portal to create or join a team!' : ''}`,
            color: 0xF97316, // Orange
            timestamp: new Date().toISOString(),
          }],
          components: [{
            type: 1, // Action Row
            components: [{
              type: 2, // Button
              style: 5, // Link button
              label: 'View KKUP Portal',
              url: 'https://kernelkup.figma.site/#kkup',
              emoji: {
                name: '👑'
              }
            }]
          }],
          flags: 64, // Ephemeral (only visible to user)
        },
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error handling /register command:', error);
      return new Response(
        JSON.stringify(errorResponse('An unexpected error occurred. Please try again later.')),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Handle /kkup command — View Kernel Kup tournament standings
  if (body.type === InteractionType.APPLICATION_COMMAND && body.data.name === 'kkup') {
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const options = body.data.options || [];
      const tournamentNumber = options.find((opt: any) => opt.name === 'tournament')?.value;

      if (!tournamentNumber) {
        return new Response(
          JSON.stringify(errorResponse('Please select a tournament number!')),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Look up the tournament by name
      const { data: tournament, error: tournamentError } = await supabase
        .from('kernel_kups')
        .select('*')
        .ilike('name', `Kernel Kup ${tournamentNumber}`)
        .maybeSingle();

      if (tournamentError || !tournament) {
        console.error('Tournament lookup error:', tournamentError);
        return new Response(
          JSON.stringify(errorResponse(`Kernel Kup ${tournamentNumber} not found in the database!`)),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.log(`🌽 /kkup command: Found tournament "${tournament.name}" (${tournament.id})`);

      // Fetch teams for this tournament
      const { data: teams } = await supabase
        .from('kkup_teams')
        .select('id, name, tag, logo_url, wins, losses')
        .eq('kernel_kup_id', tournament.id)
        .order('wins', { ascending: false });

      // Fetch matches to compute series records
      const { data: matches } = await supabase
        .from('kkup_matches')
        .select('id, team1_id, team2_id, winner_team_id, series_id, team1_score, team2_score')
        .eq('kernel_kup_id', tournament.id);

      // Compute series records and game records for each team
      const teamRecords: Record<string, { series_wins: number; series_losses: number; game_wins: number; game_losses: number; total_kills: number }> = {};
      (teams || []).forEach((t: any) => {
        teamRecords[t.id] = { series_wins: 0, series_losses: 0, game_wins: 0, game_losses: 0, total_kills: 0 };
      });

      if (matches && matches.length > 0) {
        // Infer series_id for matches without one
        let inferredCounter = 1000000;
        const seriesKeyMap = new Map<string, number>();
        const sortedMatches = [...matches].sort((a: any, b: any) =>
          (a.scheduled_time || '').localeCompare(b.scheduled_time || '')
        );
        for (const m of sortedMatches) {
          if (!m.series_id) {
            const key = [m.team1_id, m.team2_id].sort().join('-');
            if (!seriesKeyMap.has(key)) seriesKeyMap.set(key, inferredCounter++);
            m.series_id = seriesKeyMap.get(key);
          }
        }

        // Game wins
        for (const m of matches) {
          if (m.winner_team_id) {
            if (m.team1_id === m.winner_team_id) {
              if (teamRecords[m.team1_id]) teamRecords[m.team1_id].game_wins++;
              if (teamRecords[m.team2_id]) teamRecords[m.team2_id].game_losses++;
            } else if (m.team2_id === m.winner_team_id) {
              if (teamRecords[m.team2_id]) teamRecords[m.team2_id].game_wins++;
              if (teamRecords[m.team1_id]) teamRecords[m.team1_id].game_losses++;
            }
          }
        }

        // Series wins
        const seriesMap = new Map<number, { team1_id: string; team2_id: string; team1_wins: number; team2_wins: number }>();
        for (const m of matches) {
          if (!m.series_id) continue;
          if (!seriesMap.has(m.series_id)) {
            seriesMap.set(m.series_id, { team1_id: m.team1_id, team2_id: m.team2_id, team1_wins: 0, team2_wins: 0 });
          }
          const s = seriesMap.get(m.series_id)!;
          if (m.winner_team_id === s.team1_id) s.team1_wins++;
          else if (m.winner_team_id === s.team2_id) s.team2_wins++;
        }
        seriesMap.forEach((s) => {
          if (s.team1_wins > s.team2_wins) {
            if (teamRecords[s.team1_id]) teamRecords[s.team1_id].series_wins++;
            if (teamRecords[s.team2_id]) teamRecords[s.team2_id].series_losses++;
          } else if (s.team2_wins > s.team1_wins) {
            if (teamRecords[s.team2_id]) teamRecords[s.team2_id].series_wins++;
            if (teamRecords[s.team1_id]) teamRecords[s.team1_id].series_losses++;
          }
        });
      }

      // Sort teams by series wins, then game wins
      const sortedTeams = (teams || []).map((t: any) => ({
        ...t,
        ...teamRecords[t.id],
      })).sort((a: any, b: any) => {
        if (b.series_wins !== a.series_wins) return b.series_wins - a.series_wins;
        return b.game_wins - a.game_wins;
      });

      // Fetch player stats to find the top performer (best KDA)
      const matchIds = (matches || []).map((m: any) => m.id);
      let topPlayerLine = '';

      if (matchIds.length > 0) {
        const { data: playerStats } = await supabase
          .from('kkup_match_player_stats')
          .select('player_name, kills, deaths, assists, player_profile_id, is_winner')
          .in('match_id', matchIds);

        if (playerStats && playerStats.length > 0) {
          // Aggregate stats per player
          const playerAgg: Record<string, { name: string; kills: number; deaths: number; assists: number; games: number }> = {};
          for (const stat of playerStats) {
            const key = stat.player_profile_id || stat.player_name;
            if (!playerAgg[key]) {
              playerAgg[key] = { name: stat.player_name, kills: 0, deaths: 0, assists: 0, games: 0 };
            }
            playerAgg[key].kills += stat.kills || 0;
            playerAgg[key].deaths += stat.deaths || 0;
            playerAgg[key].assists += stat.assists || 0;
            playerAgg[key].games++;
          }

          // Find best KDA (minimum 2 games)
          let bestKDA = -1;
          let bestPlayer: any = null;
          for (const p of Object.values(playerAgg)) {
            if (p.games < 2) continue;
            const kda = p.deaths === 0 ? p.kills + p.assists : (p.kills + p.assists) / p.deaths;
            if (kda > bestKDA) {
              bestKDA = kda;
              bestPlayer = p;
            }
          }

          if (bestPlayer) {
            topPlayerLine = `⭐ **${bestPlayer.name}** — ${bestKDA.toFixed(2)} KDA (${bestPlayer.kills}/${bestPlayer.deaths}/${bestPlayer.assists} across ${bestPlayer.games} games)`;
          }
        }
      }

      // Check for Pop'd Kernel award for this tournament
      const { data: popdKernelRows } = await supabase
        .from('kv_store_4789f4af')
        .select('key, value')
        .like('key', 'kkup_popdkernel:%');

      const popdKernelAwards = (popdKernelRows || []).map((r: any) => ({ key: r.key, ...r.value }));

      // Deduplicate by kernel_kup_id + player_id
      const deduped: any[] = [];
      const seen = new Set<string>();
      for (const award of popdKernelAwards) {
        if (!award.player_id || !award.kernel_kup_id) continue;
        const dk = `${award.kernel_kup_id}:${award.player_id}`;
        if (!seen.has(dk)) {
          seen.add(dk);
          deduped.push(award);
        }
      }

      const thisPopdKernels = deduped.filter((a: any) => a.kernel_kup_id === tournament.id);
      let popdKernelLine = '';
      if (thisPopdKernels.length > 0) {
        const names = thisPopdKernels.map((a: any) => a.player_name || 'Unknown').join(', ');
        popdKernelLine = `🍿 **Pop'd Kernel:** ${names}`;
      }

      // Format dates
      const formatDate = (dateStr: string) => {
        if (!dateStr) return 'TBA';
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      };

      // Build standings lines
      const standingsLines = sortedTeams.map((team: any, i: number) => {
        let medal = '';
        if (i === 0) medal = '🥇';
        else if (i === 1) medal = '🥈';
        else if (i === 2) medal = '🥉';
        else medal = `**#${i + 1}**`;

        const gameRecord = `${team.game_wins}-${team.game_losses}`;
        const seriesRecord = `${team.series_wins}-${team.series_losses} series`;
        return `${medal} **${team.name}** — ${gameRecord} (${seriesRecord})`;
      });

      // Status badge
      const statusText = tournament.status === 'completed' ? '🏆 Completed'
        : tournament.status === 'in_progress' || tournament.status === 'live' ? '⚡ In Progress'
        : tournament.status === 'registration_open' ? '📝 Registration Open'
        : tournament.status || 'Unknown';

      // Build embed fields
      const fields: any[] = [];

      if (standingsLines.length > 0) {
        fields.push({
          name: '━━━━ Final Standings ━━━━',
          value: standingsLines.join('\n'),
          inline: false,
        });
      }

      if (topPlayerLine || popdKernelLine) {
        const mvpLines = [topPlayerLine, popdKernelLine].filter(Boolean).join('\n');
        fields.push({
          name: '━━━━ Tournament Highlights ━━━━',
          value: mvpLines,
          inline: false,
        });
      }

      const embed = {
        title: `🌽 ${tournament.name}`,
        description: `📅 ${formatDate(tournament.tournament_start_date)} — ${formatDate(tournament.tournament_end_date)}\n${statusText} • ${sortedTeams.length} Teams • ${(matches || []).length} Games`,
        fields,
        color: 0xF97316,
        footer: {
          text: tournament.description || 'The Corn Field Dota 2 Championship',
        },
      };

      // Add league icon as thumbnail if available
      const leagueIconUrl = `https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/make-4789f4af-kkup-assets/kkup${tournamentNumber}/league_square_icon.png`;
      embed['thumbnail'] = { url: leagueIconUrl };

      const response = {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed],
          components: [{
            type: 1,
            components: [{
              type: 2,
              style: 5,
              label: `View ${tournament.name}`,
              url: `https://kernelkup.figma.site/#kernel-kup/${tournament.id}`,
              emoji: { name: '🌽' },
            }],
          }],
        },
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error handling /kkup command:', error);
      return new Response(
        JSON.stringify(errorResponse('An unexpected error occurred. Please try again later.')),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Handle /hof command — View the Hall of Fame
  if (body.type === InteractionType.APPLICATION_COMMAND && body.data.name === 'hof') {
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Fetch all championship awards from KV store
      const { data: championshipRows } = await supabase
        .from('kv_store_4789f4af')
        .select('key, value')
        .like('key', 'kkup_championship:%');
      const championshipAwards = (championshipRows || []).map((r: any) => ({ key: r.key, ...r.value }));

      // Fetch all Pop'd Kernel awards from KV store
      const { data: popdKernelRows } = await supabase
        .from('kv_store_4789f4af')
        .select('key, value')
        .like('key', 'kkup_popdkernel:%');
      const popdKernelAwards = (popdKernelRows || []).map((r: any) => ({ key: r.key, ...r.value }));

      // Deduplicate Pop'd Kernel awards by kernel_kup_id + player_id
      const deduplicatedPopdKernels: any[] = [];
      const seenPK = new Set<string>();
      for (const award of popdKernelAwards) {
        if (!award.player_id || !award.kernel_kup_id) continue;
        const dk = `${award.kernel_kup_id}:${award.player_id}`;
        if (!seenPK.has(dk)) {
          seenPK.add(dk);
          deduplicatedPopdKernels.push(award);
        }
      }

      // Fetch all player profiles
      const { data: players } = await supabase
        .from('kkup_player_profiles')
        .select('id, name, avatar_url');

      const playerNameMap: Record<string, string> = {};
      (players || []).forEach((p: any) => { playerNameMap[p.id] = p.name; });

      // Fetch all team memberships to link players to championship teams
      const { data: teamMemberships } = await supabase
        .from('kkup_team_players')
        .select('player_profile_id, team_id');

      // Build player -> team_ids map
      const playerTeams: Record<string, string[]> = {};
      (teamMemberships || []).forEach((tm: any) => {
        if (!playerTeams[tm.player_profile_id]) playerTeams[tm.player_profile_id] = [];
        playerTeams[tm.player_profile_id].push(tm.team_id);
      });

      // Count championships per player (player was on a team that won a championship)
      const playerChampionships: Record<string, number> = {};
      for (const playerId of Object.keys(playerTeams)) {
        const teamIds = playerTeams[playerId];
        let count = 0;
        for (const award of championshipAwards) {
          if (teamIds.includes(award.team_id)) count++;
        }
        if (count > 0) playerChampionships[playerId] = count;
      }

      // Count Pop'd Kernels per player
      const playerPopdKernels: Record<string, number> = {};
      for (const award of deduplicatedPopdKernels) {
        playerPopdKernels[award.player_id] = (playerPopdKernels[award.player_id] || 0) + 1;
      }

      // Count championships per team
      const teamChampionships: Record<string, number> = {};
      const teamNameMap: Record<string, string> = {};
      for (const award of championshipAwards) {
        if (award.team_id) {
          teamChampionships[award.team_id] = (teamChampionships[award.team_id] || 0) + 1;
          if (award.team_name) teamNameMap[award.team_id] = award.team_name;
        }
      }

      // If we're missing team names, fetch them
      const missingTeamIds = Object.keys(teamChampionships).filter(id => !teamNameMap[id]);
      if (missingTeamIds.length > 0) {
        const { data: teamsData } = await supabase
          .from('kkup_teams')
          .select('id, name')
          .in('id', missingTeamIds);
        (teamsData || []).forEach((t: any) => { teamNameMap[t.id] = t.name; });
      }

      // Sort and get top 5 for each category
      const topChampionPlayers = Object.entries(playerChampionships)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id, count], i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
          return `${medal} ${playerNameMap[id] || 'Unknown'} — ${'🏆'.repeat(count)} (${count})`;
        });

      const topPopdKernelPlayers = Object.entries(playerPopdKernels)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id, count], i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
          return `${medal} ${playerNameMap[id] || 'Unknown'} — ${'🍿'.repeat(count)} (${count})`;
        });

      const topTeams = Object.entries(teamChampionships)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id, count], i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
          return `${medal} ${teamNameMap[id] || 'Unknown'} — ${'🏆'.repeat(count)} (${count})`;
        });

      // Build embed fields
      const fields: any[] = [];

      if (topChampionPlayers.length > 0) {
        fields.push({
          name: '🏆 Most Championships (Players)',
          value: topChampionPlayers.join('\n'),
          inline: false,
        });
      }

      if (topPopdKernelPlayers.length > 0) {
        fields.push({
          name: "🍿 Most Pop'd Kernels",
          value: topPopdKernelPlayers.join('\n'),
          inline: false,
        });
      }

      if (topTeams.length > 0) {
        fields.push({
          name: '👑 Most Championships (Teams)',
          value: topTeams.join('\n'),
          inline: false,
        });
      }

      if (fields.length === 0) {
        fields.push({
          name: 'No Data Yet',
          value: 'Championship and Pop\'d Kernel awards will appear here once tournaments are completed.',
          inline: false,
        });
      }

      const totalTournaments = new Set(championshipAwards.map((a: any) => a.kernel_kup_id).filter(Boolean)).size;

      const embed = {
        title: '🏛️ Kernel Kup Hall of Fame',
        description: `All-time greats across ${totalTournaments} tournaments`,
        fields,
        color: 0xF97316,
        footer: {
          text: `The Corn Field Dota 2 • Today at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
        },
      };

      const response = {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed],
          components: [{
            type: 1,
            components: [{
              type: 2,
              style: 5,
              label: 'View Full Hall of Fame',
              url: 'https://kernelkup.figma.site/#hall-of-fame',
              emoji: { name: '🏛️' },
            }],
          }],
        },
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error handling /hof command:', error);
      return new Response(
        JSON.stringify(errorResponse('An unexpected error occurred. Please try again later.')),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Handle /derba command — Party Finder (dos, turba, bcup modes)
  if (body.type === InteractionType.APPLICATION_COMMAND && body.data.name === 'derba') {
    try {
      const discordUser = body.member?.user || body.user;
      const discordId = discordUser?.id;
      const username = discordUser?.username || discordUser?.global_name || 'Unknown';

      if (!discordId) {
        return new Response(
          JSON.stringify(errorResponse('Could not identify your Discord account.')),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get the mode option (dos, turba, or bcup)
      const options = body.data.options || [];
      const mode = options.find((opt: any) => opt.name === 'mode')?.value || 'dos';

      if (!DERBA_MODES[mode]) {
        return new Response(
          JSON.stringify(errorResponse('Invalid mode! Choose dos, turba, or bcup.')),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Check if user already has an active lobby
      const { data: activeRow } = await supabase
        .from('kv_store_4789f4af')
        .select('value')
        .eq('key', `derba_active:${discordId}`)
        .maybeSingle();

      if (activeRow?.value?.lobby_id) {
        // Check if that lobby is actually still active
        const { data: lobbyRow } = await supabase
          .from('kv_store_4789f4af')
          .select('value')
          .eq('key', `derba_lobby:${activeRow.value.lobby_id}`)
          .maybeSingle();

        const existingLobby = lobbyRow?.value;
        if (existingLobby && existingLobby.status !== 'closed' && Date.now() <= existingLobby.expires_at) {
          return new Response(
            JSON.stringify(errorResponse('You already have an active lobby! Wait for it to expire or fill up before creating a new one.')),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Old lobby expired/closed — clean up
        await supabase.from('kv_store_4789f4af').delete().eq('key', `derba_active:${discordId}`);
        if (existingLobby) {
          await supabase.from('kv_store_4789f4af').delete().eq('key', `derba_lobby:${activeRow.value.lobby_id}`);
        }
      }

      // Create new lobby — creator auto-joins as Player 1
      const lobbyId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const now = Date.now();
      const lobby = {
        id: lobbyId,
        mode,
        creator_id: discordId,
        creator_username: username,
        players: [
          { discord_id: discordId, username },
          null,
          null,
          null,
          null,
        ],
        coach: null,
        created_at: now,
        expires_at: now + 60 * 1000, // 60 seconds (TEMP — change back to 15 * 60 * 1000 after testing)
        channel_id: body.channel_id,
        message_id: null,
        interaction_token: body.token,
        application_id: Deno.env.get('DISCORD_APPLICATION_ID'),
        status: 'open',
      };

      // Store lobby and active marker
      await supabase.from('kv_store_4789f4af').upsert({ key: `derba_lobby:${lobbyId}`, value: lobby });
      await supabase.from('kv_store_4789f4af').upsert({ key: `derba_active:${discordId}`, value: { lobby_id: lobbyId } });

      const { embeds, components } = buildDerbaEmbed(lobby);

      const modeName = DERBA_MODES[mode].name;
      console.log(`🎮 ${modeName} lobby created: ${lobbyId} by ${username} (${discordId})`);

      const response = {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { embeds, components },
      };

      // Background: fetch message ID and store it
      const interactionToken = body.token;
      const applicationId = Deno.env.get('DISCORD_APPLICATION_ID');
      (async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const msgRes = await fetch(
            `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
            { headers: { 'Content-Type': 'application/json' } }
          );
          if (msgRes.ok) {
            const msgData = await msgRes.json();
            lobby.message_id = msgData.id;
            await supabase.from('kv_store_4789f4af').upsert({ key: `derba_lobby:${lobbyId}`, value: lobby });
            console.log(`🎮 ${modeName} lobby ${lobbyId} message ID: ${msgData.id}`);
          }
        } catch (err) {
          console.error(`Error fetching ${modeName} message ID:`, err);
        }
      })();

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error handling /derba command:', error);
      return new Response(
        JSON.stringify(errorResponse('An unexpected error occurred. Please try again later.')),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Handle button interactions (MESSAGE_COMPONENT)
  if (body.type === InteractionType.MESSAGE_COMPONENT) {
    const customId = body.data?.custom_id || '';

    // Party finder button interactions (derba_play, derba_coach, derba_leave)
    if (customId.startsWith('derba_')) {
      try {
        const colonIndex = customId.indexOf(':');
        const action = customId.substring(0, colonIndex);
        const lobbyId = customId.substring(colonIndex + 1);
        const discordUser = body.member?.user || body.user;
        const discordId = discordUser?.id;
        const username = discordUser?.username || discordUser?.global_name || 'Unknown';

        if (!discordId || !lobbyId) {
          return new Response(
            JSON.stringify({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: '❌ Invalid interaction.', flags: 64 },
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }

        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Fetch lobby state
        const { data: lobbyRow } = await supabase
          .from('kv_store_4789f4af')
          .select('value')
          .eq('key', `derba_lobby:${lobbyId}`)
          .maybeSingle();

        if (!lobbyRow?.value) {
          return new Response(
            JSON.stringify({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: '❌ This lobby no longer exists.', flags: 64 },
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }

        const lobby = lobbyRow.value;

        // Check if expired — close it and update the message
        if (Date.now() > lobby.expires_at && lobby.status !== 'closed') {
          lobby.status = 'closed';
          await supabase.from('kv_store_4789f4af').upsert({ key: `derba_lobby:${lobbyId}`, value: lobby });
          await supabase.from('kv_store_4789f4af').delete().eq('key', `derba_active:${lobby.creator_id}`);

          const { embeds, components } = buildDerbaEmbed(lobby);
          return new Response(
            JSON.stringify({ type: InteractionResponseType.UPDATE_MESSAGE, data: { embeds, components } }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (lobby.status === 'closed') {
          return new Response(
            JSON.stringify({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: '⏰ This lobby has already closed.', flags: 64 },
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Check if user is already in the lobby
        const isPlayer = lobby.players.some((p: any) => p && p.discord_id === discordId);
        const isCoach = lobby.coach && lobby.coach.discord_id === discordId;
        const isInLobby = isPlayer || isCoach;

        if (action === 'derba_play') {
          if (isInLobby) {
            return new Response(
              JSON.stringify({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ You\'re already in this lobby! Use **Leave** first if you want to switch roles.', flags: 64 },
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }

          const emptySlot = lobby.players.findIndex((p: any) => p === null);
          if (emptySlot === -1) {
            return new Response(
              JSON.stringify({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ All player slots are full!', flags: 64 },
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }

          lobby.players[emptySlot] = { discord_id: discordId, username };
          console.log(`🎮 Party finder: ${username} joined lobby ${lobbyId} as Player ${emptySlot + 1}`);
        } else if (action === 'derba_coach') {
          if (isInLobby) {
            return new Response(
              JSON.stringify({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ You\'re already in this lobby! Use **Leave** first if you want to switch roles.', flags: 64 },
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }

          if (lobby.coach) {
            return new Response(
              JSON.stringify({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ The coach slot is already taken!', flags: 64 },
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }

          lobby.coach = { discord_id: discordId, username };
          console.log(`🎮 Party finder: ${username} joined lobby ${lobbyId} as Coach`);
        } else if (action === 'derba_leave') {
          if (!isInLobby) {
            return new Response(
              JSON.stringify({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ You\'re not in this lobby!', flags: 64 },
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }

          if (isPlayer) {
            const playerIndex = lobby.players.findIndex((p: any) => p && p.discord_id === discordId);
            lobby.players[playerIndex] = null;
            // Compact: shift players up to fill gaps
            const activePlayers = lobby.players.filter((p: any) => p !== null);
            lobby.players = [...activePlayers, ...Array(5 - activePlayers.length).fill(null)];
          }
          if (isCoach) {
            lobby.coach = null;
          }
          console.log(`🎮 Party finder: ${username} left lobby ${lobbyId}`);
        } else if (action === 'derba_cancel') {
          // Only the lobby creator can cancel
          if (discordId !== lobby.creator_id) {
            return new Response(
              JSON.stringify({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ Only the lobby creator can cancel this lobby!', flags: 64 },
              }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          }

          lobby.status = 'cancelled';
          await supabase.from('kv_store_4789f4af').delete().eq('key', `derba_active:${lobby.creator_id}`);
          await supabase.from('kv_store_4789f4af').upsert({ key: `derba_lobby:${lobbyId}`, value: lobby });

          const { embeds, components } = buildDerbaEmbed(lobby);
          console.log(`🎮 Party finder: Lobby ${lobbyId} cancelled by creator ${username}`);
          return new Response(
            JSON.stringify({ type: InteractionResponseType.UPDATE_MESSAGE, data: { embeds, components } }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Check if lobby is now full (all 5 players + coach)
        const playerCount = lobby.players.filter((p: any) => p !== null).length;
        const isFull = playerCount === 5 && lobby.coach !== null;
        if (isFull) {
          lobby.status = 'closed';
          await supabase.from('kv_store_4789f4af').delete().eq('key', `derba_active:${lobby.creator_id}`);
          console.log(`🎮 Party finder: Lobby ${lobbyId} is FULL! Party ready!`);
        }

        // Save updated lobby
        await supabase.from('kv_store_4789f4af').upsert({ key: `derba_lobby:${lobbyId}`, value: lobby });

        const { embeds, components } = buildDerbaEmbed(lobby);
        return new Response(
          JSON.stringify({ type: InteractionResponseType.UPDATE_MESSAGE, data: { embeds, components } }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('Error handling party finder button interaction:', error);
        return new Response(
          JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: '❌ An error occurred. Please try again.', flags: 64 },
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Unknown component interaction
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '❌ Unknown interaction.', flags: 64 },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Unknown command
  return new Response(
    JSON.stringify(errorResponse('Unknown command')),
    { headers: { 'Content-Type': 'application/json' } }
  );
});