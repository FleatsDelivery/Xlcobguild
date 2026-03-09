// Button interaction handler for party finder (party_play, party_coach, party_leave, party_cancel)
import { InteractionResponseType, jsonResponse } from './utils.ts';
import { buildPartyEmbed } from './createparty-utils.ts';

export async function handlePartyButton(body: any, supabase: any): Promise<Response> {
  try {
    const customId = body.data?.custom_id || '';
    const colonIndex = customId.indexOf(':');
    const action = customId.substring(0, colonIndex);
    const lobbyId = customId.substring(colonIndex + 1);
    const discordUser = body.member?.user || body.user;
    const discordId = discordUser?.id;
    const username = discordUser?.username || discordUser?.global_name || 'Unknown';

    if (!discordId || !lobbyId) {
      return jsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'Invalid interaction.', flags: 64 },
      });
    }

    // Fetch lobby state
    const { data: lobbyRow } = await supabase
      .from('kv_store_4789f4af')
      .select('value')
      .eq('key', `party_lobby:${lobbyId}`)
      .maybeSingle();

    if (!lobbyRow?.value) {
      return jsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'This lobby no longer exists.', flags: 64 },
      });
    }

    const lobby = lobbyRow.value;

    // Check if expired — close it and update the message
    if (Date.now() > lobby.expires_at && lobby.status !== 'closed') {
      lobby.status = 'closed';
      await supabase.from('kv_store_4789f4af').upsert({ key: `party_lobby:${lobbyId}`, value: lobby });
      await supabase.from('kv_store_4789f4af').delete().eq('key', `party_active:${lobby.creator_id}`);

      const { embeds, components } = buildPartyEmbed(lobby);
      return jsonResponse({ type: InteractionResponseType.UPDATE_MESSAGE, data: { embeds, components } });
    }

    if (lobby.status === 'closed') {
      return jsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'This lobby has already closed.', flags: 64 },
      });
    }

    // Check if user is already in the lobby
    const isPlayer = lobby.players.some((p: any) => p && p.discord_id === discordId);
    const isCoach = lobby.coach && lobby.coach.discord_id === discordId;
    const isInLobby = isPlayer || isCoach;

    if (action === 'party_play') {
      if (isInLobby) {
        return jsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "You're already in this lobby! Use **Leave** first if you want to switch roles.", flags: 64 },
        });
      }

      const emptySlot = lobby.players.findIndex((p: any) => p === null);
      if (emptySlot === -1) {
        return jsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: 'All player slots are full!', flags: 64 },
        });
      }

      lobby.players[emptySlot] = { discord_id: discordId, username };
      console.log(`Party finder: ${username} joined lobby ${lobbyId} as Player ${emptySlot + 1}`);
    } else if (action === 'party_coach') {
      if (isInLobby) {
        return jsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "You're already in this lobby! Use **Leave** first if you want to switch roles.", flags: 64 },
        });
      }

      if (lobby.coach) {
        return jsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: 'The coach slot is already taken!', flags: 64 },
        });
      }

      lobby.coach = { discord_id: discordId, username };
      console.log(`Party finder: ${username} joined lobby ${lobbyId} as Coach`);
    } else if (action === 'party_leave') {
      if (!isInLobby) {
        return jsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: "You're not in this lobby!", flags: 64 },
        });
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
      console.log(`Party finder: ${username} left lobby ${lobbyId}`);
    } else if (action === 'party_cancel') {
      // Only the lobby creator can cancel
      if (discordId !== lobby.creator_id) {
        return jsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: 'Only the lobby creator can cancel this lobby!', flags: 64 },
        });
      }

      lobby.status = 'cancelled';
      await supabase.from('kv_store_4789f4af').delete().eq('key', `party_active:${lobby.creator_id}`);
      await supabase.from('kv_store_4789f4af').upsert({ key: `party_lobby:${lobbyId}`, value: lobby });

      const { embeds, components } = buildPartyEmbed(lobby);
      console.log(`Party finder: Lobby ${lobbyId} cancelled by creator ${username}`);
      return jsonResponse({ type: InteractionResponseType.UPDATE_MESSAGE, data: { embeds, components } });
    }

    // Check if lobby is now full (all 5 players + coach)
    const playerCount = lobby.players.filter((p: any) => p !== null).length;
    const isFull = playerCount === 5 && lobby.coach !== null;
    if (isFull) {
      console.log(`Party finder: Lobby ${lobbyId} is FULL! Party ready! (stays open — leave reverts)`);
    }

    // Save updated lobby
    await supabase.from('kv_store_4789f4af').upsert({ key: `party_lobby:${lobbyId}`, value: lobby });

    const { embeds, components } = buildPartyEmbed(lobby);
    return jsonResponse({ type: InteractionResponseType.UPDATE_MESSAGE, data: { embeds, components } });
  } catch (error) {
    console.error('Error handling party finder button interaction:', error);
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'An error occurred. Please try again.', flags: 64 },
    });
  }
}
