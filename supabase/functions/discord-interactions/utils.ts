// Shared constants and utility functions for Discord interactions

// Discord Interaction Types
export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
};

export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
};

// Rank names for display
export const RANK_NAMES = [
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

// Global cache for the Discord public key to speed up handshakes
let cachedCryptoKey: CryptoKey | null = null;

// Verify Discord request signature
export async function verifyDiscordRequest(request: Request): Promise<boolean> {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const publicKey = Deno.env.get('DISCORD_PUBLIC_KEY');

  if (!signature || !timestamp || !publicKey) {
    console.error('Missing required headers or environment variable');
    return false;
  }

  const body = await request.clone().text();

  try {
    const encoder = new TextEncoder();
    const message = encoder.encode(timestamp + body);
    const signatureBytes = hexToBytes(signature);

    // Use cached key if available, otherwise import it
    if (!cachedCryptoKey) {
      const publicKeyBytes = hexToBytes(publicKey);
      cachedCryptoKey = await crypto.subtle.importKey(
        'raw',
        publicKeyBytes,
        { name: 'Ed25519' },
        false,
        ['verify']
      );
      console.log('Discord public key imported and cached');
    }

    const isValid = await crypto.subtle.verify(
      'Ed25519',
      cachedCryptoKey,
      signatureBytes,
      message
    );

    return isValid;
  } catch (error) {
    console.error('Signature verification error:', error);
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

// JSON response helper
export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Error response helper — ephemeral embed
export function errorResponse(message: string) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: 'Error',
        description: message,
        color: 0xEF4444,
        timestamp: new Date().toISOString(),
      }],
      flags: 64, // Ephemeral
    },
  };
}

// Public success announcement for MVP requests
export function publicSuccessResponse(
  submitterDiscordId: string,
  submitterUsername: string,
  targetDiscordId: string,
  targetUsername: string,
  action: string,
  matchId: string | null,
  imageUrl: string,
) {
  const actionEmoji = action === 'rank_up' ? '⬆️' : action === 'rank_down' ? '⬇️' : '⭐';
  const actionText = action === 'rank_up' ? 'Rank Up' : action === 'rank_down' ? 'Rank Down' : 'Prestige';

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '🌽 New MVP Request Submitted!',
        color: 0xF97316,
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
            name: '⚡ Action',
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
          url: imageUrl,
        },
        timestamp: new Date().toISOString(),
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 5,
          label: 'View on Web App',
          url: 'https://kernelkup.com/#requests',
          emoji: { name: '🌐' },
        }],
      }],
    },
  };
}

// Processing/deferred response (shows "Bot is thinking...")
export function deferredResponse() {
  return {
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: 0, // Public response
    },
  };
}

// Helper to patch a deferred response
export async function patchInteractionResponse(applicationId: string, interactionToken: string, body: any) {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to patch interaction response:', error);
  }
  
  return response;
}