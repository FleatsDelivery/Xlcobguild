import { InteractionResponseType } from './utils.ts';

export async function handleSyncMyRoles(body: any, _supabase: any) {
  const discordUserId = body.member?.user?.id || body.user?.id;
  if (!discordUserId) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '❌ Could not identify your Discord ID.',
        flags: 64, // Ephemeral
      },
    };
  }

  // We need to trigger the sync. 
  // Since this bot is in a separate edge function, we call the make-server sync terminal.
  // BUT, we can actually just call the syncDiscordUserRoles logic from here if we have access to it, 
  // or use a webhook/API call to make-server.
  
  // For now, the most reliable way is to call the internal sync endpoint on make-server.
  const makeServerUrl = Deno.env.get('MAKE_SERVER_URL') || 'https://zizrvkkuqzwzxgwpuvxb.supabase.co/functions/v1/make-server-4789f4af';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  try {
    const res = await fetch(`${makeServerUrl}/sync-discord-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ discord_id: discordUserId }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Manual sync failed:', res.status, errText);
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ Failed to trigger role synchronization. Please try again later.',
          flags: 64, // Ephemeral
        },
      };
    }

    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '🔄 Your roles are being synchronized with kernelkup.com! This should take a few seconds. 🌽',
        flags: 64, // Ephemeral
      },
    };
  } catch (err) {
    console.error('Manual sync error:', err);
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '❌ An error occurred while syncing roles.',
        flags: 64, // Ephemeral
      },
    };
  }
}
