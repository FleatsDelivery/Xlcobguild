// Run this script ONCE to register all Discord slash commands
// Usage: deno run --allow-net --allow-env register-all-commands.ts
//
// Alternatively, use the web endpoint:
//   GET/POST https://zizrvkkuqzwzxgwpuvxb.supabase.co/functions/v1/make-server-4789f4af/admin/discord/register-commands

import { DISCORD_COMMANDS } from './discord-commands.ts';

const DISCORD_APPLICATION_ID = Deno.env.get('DISCORD_APPLICATION_ID');
const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');

if (!DISCORD_APPLICATION_ID || !DISCORD_BOT_TOKEN) {
  console.error('❌ Missing environment variables!');
  console.error('Please set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN');
  Deno.exit(1);
}

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
        body: JSON.stringify(DISCORD_COMMANDS),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to register commands:', error);
      Deno.exit(1);
    }

    const data = await response.json();
    console.log('✅ Commands registered successfully!');
    console.log(`\n🎉 ${data.length} commands available:`);
    for (const cmd of data) {
      console.log(`  /${cmd.name} — ${cmd.description}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    Deno.exit(1);
  }
}

registerCommands();
