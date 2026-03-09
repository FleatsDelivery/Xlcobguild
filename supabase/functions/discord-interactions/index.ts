// Discord Interactions — Thin Router
// All command logic lives in separate modules; this file only verifies, routes, and dispatches.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { InteractionType, InteractionResponseType, verifyDiscordRequest, errorResponse, jsonResponse } from './utils.ts';
import { handleSweep } from './sweep.ts';
import { handleHelp } from './cmd-help.ts';
import { handleWebsite } from './cmd-website.ts';
import { handleSuggestion } from './cmd-suggestion.ts';
import { handleMvp } from './cmd-mvp.ts';
import { handleGuildWars } from './cmd-guildwars.ts';
import { handleRegister } from './cmd-register.ts';
import { handleKkup } from './cmd-kkup.ts';
import { handleHof } from './cmd-hof.ts';
import { handleCreateParty } from './cmd-createparty.ts';
import { handlePartyButton } from './cmp-createparty-buttons.ts';
import { handleReport } from './cmd-report.ts';

serve(async (req) => {
  // ── GET = sweep expired party lobbies (paste URL in browser to trigger) ──
  if (req.method === 'GET') {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    return handleSweep(supabase);
  }

  // ── Only allow POST for Discord interactions ──
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // ── Verify Discord signature ──
  const isValid = await verifyDiscordRequest(req);
  if (!isValid) {
    console.error('Invalid Discord signature');
    return new Response('Invalid request signature', { status: 401 });
  }

  const body = await req.json();
  console.log('Discord interaction received:', JSON.stringify(body, null, 2));

  // ── PING (Discord verification handshake) ──
  if (body.type === InteractionType.PING) {
    return jsonResponse({ type: InteractionResponseType.PONG });
  }

  // ── Create shared Supabase client for all handlers ──
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // ── Slash commands ──
  if (body.type === InteractionType.APPLICATION_COMMAND) {
    switch (body.data.name) {
      case 'help':
        return handleHelp(body, supabase);
      case 'website':
        return handleWebsite(body);
      case 'suggestion':
        return handleSuggestion(body, supabase);
      case 'mvp':
        return handleMvp(body, supabase);
      case 'guildwars':
        return handleGuildWars(body, supabase);
      case 'register':
        return handleRegister(body, supabase);
      case 'kkup':
        return handleKkup(body, supabase);
      case 'hof':
        return handleHof(body, supabase);
      case 'createparty':
        return handleCreateParty(body, supabase);
      case 'report':
        return handleReport(body, supabase);
      case 'joingiveaway':
        return jsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [{
              title: '🎁 Giveaways — Coming Soon!',
              description: 'The `/joingiveaway` command is being built! In the meantime, check the website for active giveaways.',
              color: 0xD6A615,
              footer: { text: 'The Corn Field' },
            }],
            components: [{
              type: 1,
              components: [{
                type: 2,
                style: 5,
                label: 'View Giveaways',
                url: 'https://thecornfield.figma.site/#giveaways',
                emoji: { name: '🎁' },
              }],
            }],
            flags: 64,
          },
        });
    }
  }

  // ── Message component interactions (buttons, selects) ──
  if (body.type === InteractionType.MESSAGE_COMPONENT) {
    const customId = body.data?.custom_id || '';

    // Party finder buttons
    if (customId.startsWith('party_')) {
      return handlePartyButton(body, supabase);
    }

    // Unknown component
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'Unknown interaction.', flags: 64 },
    });
  }

  // ── Fallback ──
  return jsonResponse(errorResponse('Unknown command'));
});