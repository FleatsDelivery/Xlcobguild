// /createparty slash command handler — Party Finder (dos, turba, bcup modes)
import { errorResponse, InteractionResponseType, patchInteractionResponse } from './utils.ts';
import { PARTY_MODES, buildPartyEmbed } from './createparty-utils.ts';

export async function handleCreateParty(body: any, supabase: any): Promise<any> {
  try {
    const discordUser = body.member?.user || body.user;
    const discordId = discordUser?.id;
    const username = discordUser?.username || discordUser?.global_name || 'Unknown';

    if (!discordId) return errorResponse('Could not identify your Discord account.');

    const options = body.data.options || [];
    const mode = options.find((opt: any) => opt.name === 'mode')?.value || 'dos';
    const timerMinutes = options.find((opt: any) => opt.name === 'timer')?.value || 10;
    const clampedTimer = Math.max(5, Math.min(60, timerMinutes));

    if (!PARTY_MODES[mode]) return errorResponse('Invalid mode!');

    const { data: activeRow } = await supabase
      .from('kv_store_4789f4af')
      .select('value')
      .eq('key', `party_active:${discordId}`)
      .maybeSingle();

    if (activeRow?.value?.lobby_id) {
      const { data: lobbyRow } = await supabase
        .from('kv_store_4789f4af')
        .select('value')
        .eq('key', `party_lobby:${activeRow.value.lobby_id}`)
        .maybeSingle();

      const existingLobby = lobbyRow?.value;
      if (existingLobby && existingLobby.status !== 'closed' && Date.now() <= existingLobby.expires_at) {
        return errorResponse('You already have an active lobby!');
      }
      await supabase.from('kv_store_4789f4af').delete().eq('key', `party_active:${discordId}`);
    }

    const lobbyId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const lobby = {
      id: lobbyId,
      mode,
      creator_id: discordId,
      creator_username: username,
      players: [{ discord_id: discordId, username }, null, null, null, null],
      coach: null,
      created_at: now,
      expires_at: now + clampedTimer * 60 * 1000,
      channel_id: body.channel_id,
      message_id: null,
      interaction_token: body.token,
      application_id: Deno.env.get('DISCORD_APPLICATION_ID'),
      status: 'open',
    };

    await supabase.from('kv_store_4789f4af').upsert({ key: `party_lobby:${lobbyId}`, value: lobby });
    await supabase.from('kv_store_4789f4af').upsert({ key: `party_active:${discordId}`, value: { lobby_id: lobbyId } });

    const { embeds, components } = buildPartyEmbed(lobby);

    // We return the interaction data. The router will patch it.
    // However, we ALSO need to snatch the message_id after patching.
    // We can do this by performing a second patch (or just a fetch) after a small delay.
    (async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const res = await fetch(`https://discord.com/api/v10/webhooks/${Deno.env.get('DISCORD_APPLICATION_ID')}/${body.token}/messages/@original`);
        if (res.ok) {
          const msgData = await res.json();
          lobby.message_id = msgData.id;
          await supabase.from('kv_store_4789f4af').upsert({ key: `party_lobby:${lobbyId}`, value: lobby });
          console.log(`Lobby ${lobbyId} message ID stored: ${msgData.id}`);
        }
      } catch (e) {
        console.error('Failed to capture lobby message ID:', e);
      }
    })();

    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { embeds, components }
    };
  } catch (error: any) {
    console.error('Error handling /createparty command:', error);
    return errorResponse(`An unexpected error occurred: ${error.message || 'Unknown error'}`);
  }
}