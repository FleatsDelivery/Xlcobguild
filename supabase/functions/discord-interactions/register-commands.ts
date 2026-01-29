// Run this script ONCE to register the /mvp command with Discord
// Usage: deno run --allow-net --allow-env register-commands.ts

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
    console.log('\n🎉 /mvp command is now available in your Discord server!');
  } catch (error) {
    console.error('❌ Error:', error);
    Deno.exit(1);
  }
}

registerCommands();