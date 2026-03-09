/**
 * Discord Command Registration Route
 *
 * POST|GET /admin/discord/register-commands
 *
 * Registers all Discord slash commands via the Discord API.
 * Hit the URL after deploying to push command updates.
 *
 * NOTE: Command definitions are duplicated here because Supabase deploys each
 * edge function independently — we can't import from ../discord-interactions/.
 * The canonical source is /discord-interactions/discord-commands.ts.
 * Keep both in sync when adding/removing commands.
 */
import { Hono } from "npm:hono";
import { PREFIX } from "./helpers.ts";

// ── Command definitions (mirrors discord-commands.ts) ────────────────

const DISCORD_COMMANDS = [
  { name: 'help', description: 'List of commands, community info, and how to get started' },
  { name: 'website', description: 'Quick link to The Corn Field web app' },
  {
    name: 'createparty',
    description: 'Find a Dota 2 party — pick a mode, fill 5 players + 1 coach',
    options: [{
      name: 'mode', description: 'Which game mode / role to ping', type: 3, required: true,
      choices: [
        { name: 'DERBA-DOS', value: 'dos' },
        { name: 'turba-durbs', value: 'turba' },
        { name: 'bcup-bummers', value: 'bcup' },
      ],
    }, {
      name: 'timer', description: 'How many minutes before the lobby expires (5–60, default 10)', type: 4, required: false,
      min_value: 5, max_value: 60,
    }],
  },
  { name: 'guildwars', description: 'View the guild leaderboard — top guilds and top players' },
  {
    name: 'register',
    description: 'Register for the current Kernel Kup tournament',
    options: [{
      name: 'role', description: 'Your role in the tournament', type: 3, required: true,
      choices: [
        { name: 'Player', value: 'player' },
        { name: 'Coach', value: 'coach' },
        { name: 'Caster', value: 'caster' },
      ],
    }],
  },
  {
    name: 'kkup',
    description: 'View Kernel Kup tournament standings and stats',
    options: [{
      name: 'tournament', description: 'Which Kernel Kup tournament', type: 4, required: true,
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
    }],
  },
  { name: 'hof', description: 'Hall of Fame — top players, teams, coaches, and staff of all time' },
  {
    name: 'mvp',
    description: 'Submit an MVP request for rank up or rank down',
    options: [
      { name: 'user', description: 'The user to rank up or rank down', type: 6, required: true },
      {
        name: 'action', description: 'Action to perform (prestige is auto-detected from Rank Up)', type: 3, required: true,
        choices: [{ name: 'Rank Up', value: 'rank_up' }, { name: 'Rank Down', value: 'rank_down' }],
      },
      { name: 'screenshot', description: 'Paste (Ctrl+V) or drag & drop your MVP screenshot', type: 11, required: true },
    ],
  },
  { name: 'joingiveaway', description: 'Browse and enter active community giveaways' },
  {
    name: 'suggestion',
    description: 'Send a suggestion to the officers',
    options: [{ name: 'text', description: 'Your suggestion (max 1000 characters)', type: 3, required: true }],
  },
  {
    name: 'report',
    description: 'Report a bug, player issue, or other concern',
    options: [
      {
        name: 'type', description: 'What kind of report', type: 3, required: true,
        choices: [
          { name: 'Bug Report', value: 'bug' },
          { name: 'Player Report', value: 'player' },
          { name: 'Officer Report', value: 'officer' },
          { name: 'Other', value: 'other' },
        ],
      },
      { name: 'description', description: 'Describe the issue in detail', type: 3, required: true },
      { name: 'screenshot', description: 'Optional screenshot or evidence', type: 11, required: false },
    ],
  },
];

// ── Route registration ───────────────────────────────────────────────

export function registerDiscordCommandsRoute(app: Hono) {
  const handler = async (c: any) => {
    try {
      const applicationId = Deno.env.get('DISCORD_APPLICATION_ID');
      const botToken = Deno.env.get('DISCORD_BOT_TOKEN');

      if (!applicationId || !botToken) {
        return c.json({ error: 'Missing DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN env vars' }, 500);
      }

      console.log('Registering Discord slash commands via API...');

      const response = await fetch(
        `https://discord.com/api/v10/applications/${applicationId}/commands`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bot ${botToken}`,
          },
          body: JSON.stringify(DISCORD_COMMANDS),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Discord command registration failed:', errorText);
        return c.json({ error: 'Discord API error', details: errorText, status: response.status }, 500);
      }

      const data = await response.json();
      const commandNames = data.map((cmd: any) => `/${cmd.name}`);
      console.log('Discord commands registered successfully:', commandNames.join(', '));

      return c.json({
        success: true,
        message: 'Discord commands registered successfully!',
        commands: commandNames,
        count: data.length,
      });
    } catch (error) {
      console.error('Error registering Discord commands:', error);
      return c.json({ error: 'Failed to register Discord commands', details: String(error) }, 500);
    }
  };

  // Support both POST and GET for convenience (browser = GET, API = POST)
  app.post(`${PREFIX}/admin/discord/register-commands`, handler);
  app.get(`${PREFIX}/admin/discord/register-commands`, handler);
}