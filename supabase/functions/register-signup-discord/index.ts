// One-time function to register the /signup Discord slash command
// Visit this URL once: https://zizrvkkuqzwzxgwpuvxb.supabase.co/functions/v1/register-signup-discord

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    const applicationId = Deno.env.get('DISCORD_APPLICATION_ID');

    if (!botToken || !applicationId) {
      throw new Error('Missing DISCORD_BOT_TOKEN or DISCORD_APPLICATION_ID in environment variables');
    }

    // /signup command payload
    const signupCommand = {
      name: 'signup',
      description: 'Create a guest account and submit a membership request to join XLCOB',
    };

    // Register /signup command with Discord (append to existing commands)
    const response = await fetch(
      `https://discord.com/api/v10/applications/${applicationId}/commands`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${botToken}`,
        },
        body: JSON.stringify(signupCommand),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Discord API error:', data);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to register /signup command with Discord',
          details: data,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Successfully registered /signup command:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: '✅ Successfully registered /signup command with Discord!',
        command: data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error registering /signup command:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
