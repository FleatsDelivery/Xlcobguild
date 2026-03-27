// Discord Interactions — Thin Router
// All command logic lives in separate modules; this file only verifies, routes, and dispatches.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { 
  InteractionType, 
  InteractionResponseType, 
  verifyDiscordRequest, 
  errorResponse, 
  jsonResponse,
  deferredResponse,
  patchInteractionResponse
} from './utils.ts';
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
import { handleSetupReactRoles } from './cmd-setup-react-roles.ts';
import { handleRoleSelect } from './cmp-role-select.ts';

console.log('--- DISCORD INTERACTIONS LIVE (V3 - CONFIG SYNCED) ---');

Deno.serve(async (req) => {
  try {
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

    // ── Verify Discord signature (Synchronous Path - KEEP LEAN) ──
    const isValid = await verifyDiscordRequest(req);
    if (!isValid) {
      console.error('Invalid Discord signature');
      return new Response('Invalid request signature', { status: 401 });
    }

    const body = await req.json();

    // ── PING (Discord verification handshake) ──
    if (body.type === InteractionType.PING) {
      return jsonResponse({ type: InteractionResponseType.PONG });
    }

    // Helper to handle background execution and patching
    const dispatchCommand = (handler: any) => {
      // Send deferred response immediately to avoid 3s timeout
      const response = jsonResponse(deferredResponse());
      
      // Perform actual work in the background and ensure isolate stays alive
      // @ts-ignore: EdgeRuntime is a global in Supabase
      EdgeRuntime.waitUntil((async () => {
        try {
          console.log(`Executing background task for: ${body.data?.name || 'unknown'}`);
          
          // Initialize Supabase Client in the background to shave time off initial handshake
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          );

          // Capture result (handlers return the interaction data object)
          const result = await handler(body, supabase);
          
          if (result) {
            await patchInteractionResponse(
              Deno.env.get('DISCORD_APPLICATION_ID') || '',
              body.token,
              result.data || result
            );
            console.log(`Successfully patched response for: ${body.data?.name}`);
          }
        } catch (err: any) {
          console.error(`Background task failed for ${body.data?.name}:`, err);
          try {
            await patchInteractionResponse(
              Deno.env.get('DISCORD_APPLICATION_ID') || '',
              body.token,
              errorResponse(`An unexpected error occurred: ${err.message}`).data
            );
          } catch (patchErr) {
            console.error('Failed to send error patch:', patchErr);
          }
        }
      })());

      return response;
    };

    // ── Slash commands ──
    if (body.type === InteractionType.APPLICATION_COMMAND) {
      switch (body.data.name) {
        case 'help':
          return dispatchCommand(handleHelp);
        case 'website':
          return dispatchCommand(handleWebsite);
        case 'suggestion':
          return dispatchCommand(handleSuggestion);
        case 'mvp':
          return dispatchCommand(handleMvp);
        case 'guildwars':
          return dispatchCommand(handleGuildWars);
        case 'register':
          return dispatchCommand(handleRegister);
        case 'kkup':
          return dispatchCommand(handleKkup);
        case 'hof':
          return dispatchCommand(handleHof);
        case 'createparty':
          return dispatchCommand(handleCreateParty);
        case 'report':
          return dispatchCommand(handleReport);
        case 'setup-react-roles':
          return dispatchCommand(handleSetupReactRoles);
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
                  url: 'https://kernelkup.com/#giveaways',
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
      if (customId.startsWith('party_')) {
        // Buttons still need a client
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );
        return handlePartyButton(body, supabase);
      }
      if (customId === 'roles_select') {
        return handleRoleSelect(body, null);
      }
      return jsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'Unknown interaction.', flags: 64 },
      });
    }

    // ── Fallback ──
    return jsonResponse(errorResponse('Unknown command'));
  } catch (err: any) {
    console.error('Global Switchboard Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});