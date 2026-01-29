import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Discord Interaction Types
const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
};

const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
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

// Success response helper (ephemeral)
function successResponse(content: string) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '✅ Request Submitted',
        description: content,
        color: 0xF97316, // Orange (Fleats brand color)
        timestamp: new Date().toISOString(),
      }],
      flags: 64, // Ephemeral
    },
  };
}

// Public success announcement (everyone can see)
function publicSuccessResponse(submitter: any, targetUser: any, action: string, matchId: string | null) {
  const actionEmoji = action === 'rank_up' ? '⬆️' : action === 'rank_down' ? '⬇️' : '⭐';
  const actionText = action === 'rank_up' ? 'Rank Up' : action === 'rank_down' ? 'Rank Down' : 'Prestige';
  
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: `${actionEmoji} New MVP Request Submitted!`,
        description: `**<@${submitter.discord_id}>** submitted a **${actionText}** request for **<@${targetUser.discord_id}>**`,
        color: 0xF97316, // Orange
        fields: [
          {
            name: '👤 Target Player',
            value: `<@${targetUser.discord_id}>\n${RANK_NAMES[targetUser.rank_id]} (Prestige ${targetUser.prestige_level})`,
            inline: true,
          },
          {
            name: '⚡ Action',
            value: actionText,
            inline: true,
          },
          ...(matchId ? [{
            name: '🎮 Match ID',
            value: `\`${matchId}\``,
            inline: true,
          }] : []),
          {
            name: '📊 Status',
            value: '⏳ Pending officer review',
            inline: false,
          },
        ],
        footer: {
          text: 'View all requests at xlcob.com/requests',
        },
        timestamp: new Date().toISOString(),
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

      // Get submitter's Discord ID
      const submitterDiscordId = body.member?.user?.id || body.user?.id;

      if (!submitterDiscordId) {
        return new Response(JSON.stringify(errorResponse('Could not identify your Discord account.')), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get the actual attachment data from resolved attachments
      const screenshotAttachment = body.data.resolved?.attachments?.[screenshotAttachmentId];
      
      console.log('Screenshot attachment ID:', screenshotAttachmentId);
      console.log('Resolved attachments:', body.data.resolved?.attachments);
      console.log('Screenshot attachment data:', screenshotAttachment);

      // Step 1: Lookup submitter in database
      const { data: submitter, error: submitterError } = await supabase
        .from('users')
        .select('*')
        .eq('discord_id', submitterDiscordId)
        .single();

      if (submitterError || !submitter) {
        console.error('Submitter not found:', submitterError);
        return new Response(
          JSON.stringify(errorResponse('You must be registered at https://xlcob.com first! Sign in with Discord to create your account.')),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check if submitter is at least a member
      if (submitter.role === 'guest') {
        return new Response(
          JSON.stringify(errorResponse('You must be an XLCOB member to submit MVP requests. Please request membership first.')),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Step 2: Lookup target user
      const { data: targetUser, error: targetError } = await supabase
        .from('users')
        .select('*')
        .eq('discord_id', targetDiscordUser)
        .single();

      if (targetError || !targetUser) {
        console.error('Target user not found:', targetError);
        return new Response(
          JSON.stringify(errorResponse('Target user is not registered in XLCOB! They must sign in at https://xlcob.com first.')),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Step 3: Validate permissions
      const isRankingSelf = submitter.id === targetUser.id;
      const actionLower = action.toLowerCase().replace(' ', '_'); // "Rank Up" -> "rank_up"

      // If ranking someone else, must be Corn Star (10) or Pop'd Kernel (11)
      if (!isRankingSelf && submitter.rank_id < 10) {
        return new Response(
          JSON.stringify(
            errorResponse(
              `You must be **Corn Star** or **Pop'd Kernel** to submit MVP requests for other users!\n\nYour current rank: ${RANK_NAMES[submitter.rank_id]} (Prestige ${submitter.prestige_level})`
            )
          ),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Prestige validation: target must be Corn Star or Pop'd Kernel
      if (actionLower === 'prestige' && targetUser.rank_id < 10) {
        return new Response(
          JSON.stringify(
            errorResponse(
              `Target user must be **Corn Star** or **Pop'd Kernel** to prestige!\n\nTarget rank: ${RANK_NAMES[targetUser.rank_id]}`
            )
          ),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Rank down validation: can't rank down below Earwig
      if (actionLower === 'rank_down' && targetUser.rank_id <= 1) {
        return new Response(
          JSON.stringify(errorResponse('Cannot rank down below Earwig!')),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Rank up validation: can't rank up above Pop'd Kernel (unless prestiging)
      if (actionLower === 'rank_up' && targetUser.rank_id >= 11) {
        return new Response(
          JSON.stringify(errorResponse('User is already at max rank (Pop\'d Kernel)! Consider prestiging instead.')),
          { headers: { 'Content-Type': 'application/json' } }
        );
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
      const fileName = `${Date.now()}_${submitter.discord_id}_${targetUser.discord_id}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('mvp-screenshots')
        .upload(fileName, imageBuffer, {
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

      // Get public URL
      const { data: urlData } = supabase.storage.from('mvp-screenshots').getPublicUrl(fileName);
      const permanentUrl = urlData.publicUrl;

      console.log('Screenshot uploaded successfully:', permanentUrl);

      // Step 5: Insert request into database
      const { error: insertError } = await supabase.from('rank_up_requests').insert({
        user_id: submitter.id,
        target_user_id: targetUser.id,
        action: actionLower,
        screenshot_url: permanentUrl,
        match_id: matchId || null,
        status: 'pending',
        current_rank_id: targetUser.rank_id,
        current_prestige_level: targetUser.prestige_level,
      });

      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(
          JSON.stringify(errorResponse('Failed to submit request to database!')),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.log('MVP request created successfully');

      // Step 6: Send success response
      const successMessage = `✅ **MVP Request Submitted!**

🎯 **Target:** ${targetUser.discord_username} (${RANK_NAMES[targetUser.rank_id]} - Prestige ${targetUser.prestige_level})
📸 **Screenshot:** Uploaded successfully
${matchId ? `🎮 **Match ID:** ${matchId}\n` : ''}⚡ **Action:** ${action}
⏳ **Status:** Pending officer review

Check status at **https://xlcob.com/requests**`;

      return new Response(JSON.stringify(publicSuccessResponse(submitter, targetUser, actionLower, matchId)), {
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

  // Unknown command
  return new Response(
    JSON.stringify(errorResponse('Unknown command')),
    { headers: { 'Content-Type': 'application/json' } }
  );
});