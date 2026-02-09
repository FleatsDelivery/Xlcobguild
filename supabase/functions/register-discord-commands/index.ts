// Edge function to register Discord slash commands via browser
// Just visit: https://[project].supabase.co/functions/v1/register-discord-commands

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const DISCORD_APPLICATION_ID = Deno.env.get('DISCORD_APPLICATION_ID');
const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');

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
    name: 'joinguild',
    description: 'Join The Corn Field guild and get your XLCOB account',
  },
  {
    name: 'leaderboard',
    description: 'View the XLCOB leaderboard',
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
];

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    if (!DISCORD_APPLICATION_ID || !DISCORD_BOT_TOKEN) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing Discord credentials',
          message: 'DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN not set in environment variables',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    console.log('🚀 Registering Discord slash commands...');

    const response = await fetch(
      `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/commands`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        },
        body: JSON.stringify(commands),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to register commands:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Discord API error',
          details: error,
        }),
        {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const data = await response.json();
    console.log('✅ Commands registered successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        message: '✅ All Discord commands registered successfully!',
        commands: [
          '/mvp - Submit MVP requests for rank changes',
          '/joinguild - Join the guild (renamed from /signup)',
          '/leaderboard - View the leaderboard',
          '/register - Register for Kernel Kup tournament',
        ],
        registeredCommands: data,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});