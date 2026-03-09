// /createparty slash command handler — Party Finder (dos, turba, bcup modes)
import { errorResponse, InteractionResponseType, jsonResponse } from './utils.ts';
import { PARTY_MODES, buildPartyEmbed } from './createparty-utils.ts';

export async function handleCreateParty(body: any, supabase: any): Promise<Response> {
  try {
    const discordUser = body.member?.user || body.user;
    const discordId = discordUser?.id;
    const username = discordUser?.username || discordUser?.global_name || 'Unknown';

    if (!discordId) {
      return jsonResponse(errorResponse('Could not identify your Discord account.'));
    }

    // Get the mode option (dos, turba, or bcup)
    const options = body.data.options || [];
    const mode = options.find((opt: any) => opt.name === 'mode')?.value || 'dos';
    const timerMinutes = options.find((opt: any) => opt.name === 'timer')?.value || 10;
    // Clamp to 5–60 minutes
    const clampedTimer = Math.max(5, Math.min(60, timerMinutes));

    if (!PARTY_MODES[mode]) {
      return jsonResponse(errorResponse('Invalid mode! Choose dos, turba, or bcup.'));
    }

    // Check if user already has an active lobby
    const { data: activeRow } = await supabase
      .from('kv_store_4789f4af')
      .select('value')
      .eq('key', `party_active:${discordId}`)
      .maybeSingle();

    if (activeRow?.value?.lobby_id) {
      // Check if that lobby is actually still active
      const { data: lobbyRow } = await supabase
        .from('kv_store_4789f4af')
        .select('value')
        .eq('key', `party_lobby:${activeRow.value.lobby_id}`)
        .maybeSingle();

      const existingLobby = lobbyRow?.value;
      if (existingLobby && existingLobby.status !== 'closed' && Date.now() <= existingLobby.expires_at) {
        return jsonResponse(
          errorResponse('You already have an active lobby! Wait for it to expire or fill up before creating a new one.')
        );
      }

      // Old lobby expired/closed — clean up
      await supabase.from('kv_store_4789f4af').delete().eq('key', `party_active:${discordId}`);
      if (existingLobby) {
        await supabase.from('kv_store_4789f4af').delete().eq('key', `party_lobby:${activeRow.value.lobby_id}`);
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
      expires_at: now + clampedTimer * 60 * 1000, // User-set timer (default 10 min)
      channel_id: body.channel_id,
      message_id: null,
      interaction_token: body.token,
      application_id: Deno.env.get('DISCORD_APPLICATION_ID'),
      status: 'open',
    };

    // Store lobby and active marker
    await supabase.from('kv_store_4789f4af').upsert({ key: `party_lobby:${lobbyId}`, value: lobby });
    await supabase.from('kv_store_4789f4af').upsert({ key: `party_active:${discordId}`, value: { lobby_id: lobbyId } });

    const { embeds, components } = buildPartyEmbed(lobby);

    const modeName = PARTY_MODES[mode].name;
    console.log(`${modeName} lobby created: ${lobbyId} by ${username} (${discordId})`);

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
          await supabase.from('kv_store_4789f4af').upsert({ key: `party_lobby:${lobbyId}`, value: lobby });
          console.log(`${modeName} lobby ${lobbyId} message ID: ${msgData.id}`);
        }
      } catch (err) {
        console.error(`Error fetching ${modeName} message ID:`, err);
      }
    })();

    return jsonResponse(response);
  } catch (error) {
    console.error('Error handling /createparty command:', error);
    return jsonResponse(errorResponse('An unexpected error occurred. Please try again later.'));
  }
}