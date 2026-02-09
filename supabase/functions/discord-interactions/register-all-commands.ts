// Run this script ONCE to register all Discord slash commands
// Usage: deno run --allow-net --allow-env register-all-commands.ts

const DISCORD_APPLICATION_ID = Deno.env.get('DISCORD_APPLICATION_ID');
const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');

if (!DISCORD_APPLICATION_ID || !DISCORD_BOT_TOKEN) {
  console.error('❌ Missing environment variables!');
  console.error('Please set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN');
  Deno.exit(1);
}

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
        name: 'match_id',
        description: 'Dota 2 Match ID (optional)',
        type: 3, // STRING type
        required: false,
      },
      {
        name: 'screenshot',
        description: 'MVP screenshot from Dota 2',
        type: 11, // ATTACHMENT type
        required: true,
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

async function registerCommands() {
  try {
    console.log('🚀 Registering Discord slash commands...');
    
    const response = await fetch(
      `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/commands`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        },
        body: JSON.stringify(commands),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to register commands:', error);
      Deno.exit(1);
    }

    const data = await response.json();
    console.log('✅ Commands registered successfully!');
    console.log(JSON.stringify(data, null, 2));
    console.log('\n🎉 Available commands:');
    console.log('  - /mvp: Submit MVP requests for rank changes');
    console.log('  - /joinguild: Join the guild (renamed from /signup)');
    console.log('  - /leaderboard: View the leaderboard');
    console.log('  - /register: Register for Kernel Kup');
    console.log('  - /kkup: View Kernel Kup tournament standings');
    console.log('  - /hof: View the Hall of Fame');
    console.log('  - /derba: Find a Dota 2 party (dos, turba, bcup)');
  } catch (error) {
    console.error('❌ Error:', error);
    Deno.exit(1);
  }
}

registerCommands();