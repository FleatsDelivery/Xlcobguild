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

// Verify Discord request signature using official Ed25519 logic for Deno
export async function verifyDiscordRequest(request: Request): Promise<boolean> {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const publicKey = Deno.env.get('DISCORD_PUBLIC_KEY');

  if (!signature || !timestamp || !publicKey) {
    console.error('Missing signature headers or DISCORD_PUBLIC_KEY secret');
    return false;
  }

  try {
    // Clone the request to read body without consuming the original
    const body = await request.clone().arrayBuffer();
    
    // Import the public key
    const publicKeyBytes = hexToUint8Array(publicKey);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      publicKeyBytes,
      { name: 'Ed25519' },
      false,
      ['verify']
    );

    // Prepare message bytes (timestamp + body)
    const timestampBytes = new TextEncoder().encode(timestamp);
    const message = new Uint8Array(timestampBytes.length + body.byteLength);
    message.set(timestampBytes);
    message.set(new Uint8Array(body), timestampBytes.length);

    // Verify
    const signatureBytes = hexToUint8Array(signature);
    const isValid = await crypto.subtle.verify(
      'Ed25519',
      cryptoKey,
      signatureBytes,
      message
    );

    if (!isValid) {
      console.warn('Discord signature verification failed.');
    }

    return isValid;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Faster hex to bytes implementation
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
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