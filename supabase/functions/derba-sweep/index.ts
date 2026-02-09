import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Role IDs for party finder modes (must stay in sync with discord-interactions)
const DERBA_MODES: Record<string, { role_id: string; name: string }> = {
  dos: { role_id: '1138890000528855070', name: 'DERBA-DOS' },
  turba: { role_id: '1303799483028476046', name: 'turba-durbs' },
  bcup: { role_id: '1387894719161303141', name: 'bcup-bummers' },
};

// Build compact tombstone embed for expired/cancelled lobbies
function buildTombstoneEmbed(lobby: any): { embeds: any[]; components: any[] } {
  const mode = DERBA_MODES[lobby.mode] || DERBA_MODES.dos;
  const isCancelled = lobby.status === 'cancelled';
  const statusText = isCancelled ? 'cancelled ❌' : 'ended ⏰';

  return {
    embeds: [{
      description: `🌽 ~~It's time for some Dota...~~ **Party ${statusText}** — <@${lobby.creator_id}> • ${mode.name}`,
      color: 0x4B5563, // muted grey
    }],
    components: [],
  };
}

serve(async (req) => {
  // Allow GET (browser/cron) and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
  if (!botToken) {
    console.error('❌ DISCORD_BOT_TOKEN not set');
    return new Response(JSON.stringify({ error: 'DISCORD_BOT_TOKEN not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch all derba lobby keys
  const { data: lobbyRows, error } = await supabase
    .from('kv_store_4789f4af')
    .select('key, value')
    .like('key', 'derba_lobby:%');

  if (error) {
    console.error('❌ Error fetching lobby rows:', error);
    return new Response(JSON.stringify({ error: 'Failed to query lobbies' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = Date.now();
  let sweptCount = 0;
  let cleanedCount = 0;
  const results: string[] = [];

  for (const row of lobbyRows || []) {
    const lobby = row.value;
    if (!lobby || !lobby.id) continue;

    const isExpired = now > lobby.expires_at;
    const isOpen = lobby.status === 'open';

    // Sweep: expired lobbies that are still marked 'open'
    if (isExpired && isOpen) {
      lobby.status = 'closed';

      // Update KV
      await supabase.from('kv_store_4789f4af').upsert({ key: `derba_lobby:${lobby.id}`, value: lobby });
      await supabase.from('kv_store_4789f4af').delete().eq('key', `derba_active:${lobby.creator_id}`);

      // Edit the Discord message to compact tombstone
      const tombstone = buildTombstoneEmbed(lobby);
      let edited = false;

      // Strategy 1: Use bot token + message_id (works forever)
      if (lobby.channel_id && lobby.message_id) {
        try {
          const res = await fetch(
            `https://discord.com/api/v10/channels/${lobby.channel_id}/messages/${lobby.message_id}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                embeds: tombstone.embeds,
                components: tombstone.components,
              }),
            }
          );

          if (res.ok) {
            console.log(`🧹 Swept lobby ${lobby.id} — edited via bot API (message ${lobby.message_id})`);
            results.push(`swept ${lobby.id} (bot API edit)`);
            edited = true;
          } else {
            const errText = await res.text();
            console.error(`⚠️ Bot API edit failed for lobby ${lobby.id}: ${res.status} ${errText}`);
          }
        } catch (fetchErr) {
          console.error(`⚠️ Network error (bot API) for lobby ${lobby.id}:`, fetchErr);
        }
      }

      // Strategy 2: Fallback to interaction webhook token (valid ~15 min)
      if (!edited && lobby.interaction_token && lobby.application_id) {
        try {
          const res = await fetch(
            `https://discord.com/api/v10/webhooks/${lobby.application_id}/${lobby.interaction_token}/messages/@original`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                embeds: tombstone.embeds,
                components: tombstone.components,
              }),
            }
          );

          if (res.ok) {
            // Bonus: extract message_id from response for future use
            const msgData = await res.json();
            if (msgData.id && !lobby.message_id) {
              lobby.message_id = msgData.id;
              await supabase.from('kv_store_4789f4af').upsert({ key: `derba_lobby:${lobby.id}`, value: lobby });
            }
            console.log(`🧹 Swept lobby ${lobby.id} — edited via webhook token`);
            results.push(`swept ${lobby.id} (webhook edit)`);
            edited = true;
          } else {
            const errText = await res.text();
            console.error(`⚠️ Webhook edit failed for lobby ${lobby.id}: ${res.status} ${errText}`);
            results.push(`swept ${lobby.id} (webhook failed: ${res.status})`);
          }
        } catch (fetchErr) {
          console.error(`⚠️ Network error (webhook) for lobby ${lobby.id}:`, fetchErr);
          results.push(`swept ${lobby.id} (webhook network error)`);
        }
      }

      if (!edited) {
        console.log(`🧹 Swept lobby ${lobby.id} — KV only (no Discord edit possible)`);
        results.push(`swept ${lobby.id} (KV only)`);
      }

      sweptCount++;
    }

    // Cleanup: delete KV entries for lobbies closed/cancelled more than 1 hour ago
    const isClosed = lobby.status === 'closed' || lobby.status === 'cancelled';
    const closedOverOneHour = isExpired && (now - lobby.expires_at > 60 * 60 * 1000);
    if (isClosed && closedOverOneHour) {
      await supabase.from('kv_store_4789f4af').delete().eq('key', `derba_lobby:${lobby.id}`);
      await supabase.from('kv_store_4789f4af').delete().eq('key', `derba_active:${lobby.creator_id}`);
      console.log(`🗑️ Cleaned up old lobby ${lobby.id}`);
      results.push(`cleaned ${lobby.id}`);
      cleanedCount++;
    }
  }

  const summary = {
    success: true,
    timestamp: new Date().toISOString(),
    total_lobbies: (lobbyRows || []).length,
    swept: sweptCount,
    cleaned: cleanedCount,
    details: results,
  };

  console.log(`🧹 Derba sweep complete: ${sweptCount} swept, ${cleanedCount} cleaned out of ${(lobbyRows || []).length} total`);

  return new Response(JSON.stringify(summary, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
});
