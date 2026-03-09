// GET handler — sweep expired party lobbies (hit URL in browser to trigger)
import { PARTY_MODES } from './createparty-utils.ts';

export async function handleSweep(supabase: any): Promise<Response> {
  const { data: lobbyRows, error } = await supabase
    .from('kv_store_4789f4af')
    .select('key, value')
    .like('key', 'party_lobby:%');

  if (error) {
    return new Response(JSON.stringify({ error: 'Failed to query lobbies' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = Date.now();
  let sweptCount = 0;
  const results: string[] = [];

  for (const row of lobbyRows || []) {
    const lobby = row.value;
    if (!lobby || !lobby.id) continue;

    const isExpired = now > lobby.expires_at;
    const isOpen = lobby.status === 'open';

    if (isExpired && isOpen) {
      lobby.status = 'closed';
      await supabase.from('kv_store_4789f4af').upsert({ key: `party_lobby:${lobby.id}`, value: lobby });
      await supabase.from('kv_store_4789f4af').delete().eq('key', `party_active:${lobby.creator_id}`);

      // Build tombstone embed
      const mode = PARTY_MODES[lobby.mode] || PARTY_MODES.dos;
      const tombstone = {
        embeds: [{
          description: `🌽 ~~It's time for some Dota...~~ **Party ended ⏰** — <@${lobby.creator_id}> • ${mode.name}`,
          color: 0x4B5563,
        }],
        components: [],
      };

      let edited = false;

      // Strategy 1: bot token + message_id
      if (lobby.channel_id && lobby.message_id) {
        try {
          const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
          const res = await fetch(
            `https://discord.com/api/v10/channels/${lobby.channel_id}/messages/${lobby.message_id}`,
            {
              method: 'PATCH',
              headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ embeds: tombstone.embeds, components: tombstone.components }),
            }
          );
          if (res.ok) {
            edited = true;
            results.push(`swept ${lobby.id} (bot API)`);
          } else {
            console.error(`Bot API edit failed: ${res.status} ${await res.text()}`);
          }
        } catch (e) {
          console.error('Bot API error:', e);
        }
      }

      // Strategy 2: interaction webhook token (valid ~15 min)
      if (!edited && lobby.interaction_token && lobby.application_id) {
        try {
          const res = await fetch(
            `https://discord.com/api/v10/webhooks/${lobby.application_id}/${lobby.interaction_token}/messages/@original`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ embeds: tombstone.embeds, components: tombstone.components }),
            }
          );
          if (res.ok) {
            const msgData = await res.json();
            if (msgData.id) {
              lobby.message_id = msgData.id;
              await supabase.from('kv_store_4789f4af').upsert({ key: `party_lobby:${lobby.id}`, value: lobby });
            }
            edited = true;
            results.push(`swept ${lobby.id} (webhook)`);
          } else {
            console.error(`Webhook edit failed: ${res.status} ${await res.text()}`);
            results.push(`swept ${lobby.id} (webhook failed: ${res.status})`);
          }
        } catch (e) {
          console.error('Webhook error:', e);
          results.push(`swept ${lobby.id} (webhook error)`);
        }
      }

      if (!edited) {
        results.push(`swept ${lobby.id} (KV only)`);
      }
      sweptCount++;
    }
  }

  return new Response(JSON.stringify({
    success: true,
    swept: sweptCount,
    total_lobbies: (lobbyRows || []).length,
    details: results,
  }, null, 2), { headers: { 'Content-Type': 'application/json' } });
}
