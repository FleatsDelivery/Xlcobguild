// One-time function to register the /mvp Discord slash command
// Visit this URL once: https://zizrvkkuqzwzxgwpuvxb.supabase.co/functions/v1/register-discord-command

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

    // Command payload
    const commands = [
      {
        name: 'mvp',
        description: 'Submit an MVP request for rank up/down or prestige',
        options: [
          {
            name: 'user',
            description: 'The user to rank up/down or prestige',
            type: 6, // USER type
            required: true,
          },
          {
            name: 'action',
            description: 'Action to perform',
            type: 3, // STRING type
            required: true,
            choices: [
              { name: 'Rank Up', value: 'rank_up' },
              { name: 'Rank Down', value: 'rank_down' },
              { name: 'Prestige', value: 'prestige' },
            ],
          },
          {
            name: 'screenshot',
            description: 'MVP screenshot from Dota 2',
            type: 11, // ATTACHMENT type
            required: true,
          },
          {
            name: 'match_id',
            description: 'Dota 2 Match ID (optional)',
            type: 3, // STRING type
            required: false,
          },
        ],
      },
      {
        name: 'leaderboard',
        description: 'Display the current XLCOB leaderboard rankings',
      },
      {
        name: 'joinguild',
        description: 'Join The Corn Field guild and get your XLCOB account',
      },
      {
        name: 'register',
        description: 'Register for the upcoming Kernel Kup tournament',
        options: [
          {
            name: 'role',
            description: 'Your role in the tournament',
            type: 3, // STRING type
            required: true,
            choices: [
              { name: 'Player', value: 'player' },
              { name: 'Coach', value: 'coach' },
              { name: 'Caster', value: 'caster' },
              { name: 'Spectator', value: 'spectator' },
            ],
          },
        ],
      },
      {
        name: 'kkup',
        description: 'View Kernel Kup tournament standings and stats',
        options: [
          {
            name: 'tournament',
            description: 'Which Kernel Kup tournament',
            type: 4, // INTEGER type
            required: true,
            choices: [
              { name: 'Kernel Kup 1', value: 1 },
              { name: 'Kernel Kup 2', value: 2 },
              { name: 'Kernel Kup 3', value: 3 },
              { name: 'Kernel Kup 4', value: 4 },
              { name: 'Kernel Kup 5', value: 5 },
              { name: 'Kernel Kup 6', value: 6 },
              { name: 'Kernel Kup 7', value: 7 },
              { name: 'Kernel Kup 8', value: 8 },
              { name: 'Kernel Kup 9', value: 9 },
            ],
          },
        ],
      },
      {
        name: 'hof',
        description: 'View the Kernel Kup Hall of Fame — top players and teams of all time',
      },
      {
        name: 'derba',
        description: 'Find a Dota 2 party — creates a lobby with slots for 5 players and 1 coach',
        options: [
          {
            name: 'mode',
            description: 'Which game mode / role to ping',
            type: 3, // STRING type
            required: true,
            choices: [
              { name: 'DERBA-DOS', value: 'dos' },
              { name: 'turba-durbs', value: 'turba' },
              { name: 'bcup-bummers', value: 'bcup' },
            ],
          },
        ],
      },
    ];

    // Register command with Discord
    const response = await fetch(
      `https://discord.com/api/v10/applications/${applicationId}/commands`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${botToken}`,
        },
        body: JSON.stringify(commands),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Discord API error:', data);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to register command with Discord',
          details: data,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ Successfully registered commands:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: '✅ Successfully registered all Discord commands: /mvp, /leaderboard, /joinguild, /register, /kkup, /hof, /derba',
        commands: data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error registering Discord command:', error);
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