/**
 * Discord Slash Command Definitions — Single Source of Truth
 *
 * Used by both:
 *   - register-all-commands.ts (CLI script)
 *   - routes-discord-register.ts (web endpoint)
 *
 * When adding/modifying commands, update this file only.
 * Then re-register by hitting the web endpoint or running the CLI script.
 */

export const DISCORD_COMMANDS = [
  // ── Getting Started ────────────────────────────────────────────────
  {
    name: 'help',
    description: 'List of commands, community info, and how to get started',
  },
  {
    name: 'website',
    description: 'Quick link to The Corn Field web app',
  },

  // ── Play ────────────────────────────────────────────────────────────
  {
    name: 'createparty',
    description: 'Find a Dota 2 party — pick a mode, fill 5 players + 1 coach',
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
      {
        name: 'timer',
        description: 'How many minutes before the lobby expires (5–60, default 10)',
        type: 4, // INTEGER type
        required: false,
        min_value: 5,
        max_value: 60,
      },
    ],
  },
  {
    name: 'guildwars',
    description: 'View the guild leaderboard — top guilds and top players',
  },

  // ── Kernel Kup Tournaments ─────────────────────────────────────────
  {
    name: 'register',
    description: 'Register for the current Kernel Kup tournament',
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
    description: 'Hall of Fame — top players, teams, coaches, and staff of all time',
  },

  // ── Progression ────────────────────────────────────────────────────
  {
    name: 'mvp',
    description: 'Submit an MVP request for rank up or rank down',
    options: [
      {
        name: 'user',
        description: 'The user to rank up or rank down',
        type: 6, // USER type
        required: true,
      },
      {
        name: 'action',
        description: 'Action to perform (prestige is auto-detected from Rank Up)',
        type: 3, // STRING type
        required: true,
        choices: [
          { name: 'Rank Up', value: 'rank_up' },
          { name: 'Rank Down', value: 'rank_down' },
        ],
      },
      {
        name: 'screenshot',
        description: 'Paste (Ctrl+V) or drag & drop your MVP screenshot',
        type: 11, // ATTACHMENT type
        required: true,
      },
    ],
  },
  {
    name: 'joingiveaway',
    description: 'Browse and enter active community giveaways',
  },

  // ── Feedback ───────────────────────────────────────────────────────
  {
    name: 'suggestion',
    description: 'Send a suggestion to the officers',
    options: [
      {
        name: 'text',
        description: 'Your suggestion (max 1000 characters)',
        type: 3, // STRING type
        required: true,
      },
    ],
  },
  {
    name: 'report',
    description: 'Report a bug, player issue, or other concern',
    options: [
      {
        name: 'type',
        description: 'What kind of report',
        type: 3, // STRING type
        required: true,
        choices: [
          { name: 'Bug Report', value: 'bug' },
          { name: 'Player Report', value: 'player' },
          { name: 'Officer Report', value: 'officer' },
          { name: 'Other', value: 'other' },
        ],
      },
      {
        name: 'description',
        description: 'Describe the issue in detail',
        type: 3, // STRING type
        required: true,
      },
      {
        name: 'screenshot',
        description: 'Optional screenshot or evidence',
        type: 11, // ATTACHMENT type
        required: false,
      },
    ],
  },
];