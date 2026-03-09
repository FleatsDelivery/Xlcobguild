// /help slash command handler — Context-aware command list and community info
import { InteractionResponseType, jsonResponse } from './utils.ts';

export async function handleHelp(body: any, supabase: any): Promise<Response> {
  try {
    const discordUser = body.member?.user || body.user;
    const discordId = discordUser?.id;

    // Check if user is a registered TCF member for personalized footer
    let footerText = 'The Corn Field Dota 2 Community';
    let isRegistered = false;

    if (discordId) {
      const { data: tcfUser } = await supabase
        .from('users')
        .select('discord_username, rank_id, prestige_level, ranks(name)')
        .eq('discord_id', discordId)
        .maybeSingle();

      if (tcfUser && tcfUser.ranks?.name) {
        isRegistered = true;
        const prestige = tcfUser.prestige_level || 0;
        footerText = `${tcfUser.discord_username} • ${tcfUser.ranks.name}${prestige > 0 ? ` • ⭐×${prestige}` : ''}`;
      }
    }

    const commandList = [
      '🌽 **Getting Started**',
      '`/help` — You are here! List of commands and community info',
      '`/website` — Quick link to The Corn Field web app',
      '',
      '🎮 **Play**',
      '`/createparty` — Find a Dota 2 party — pick a mode, fill 5 players + 1 coach',
      '`/guildwars` — View top guilds and top players on the leaderboard',
      '',
      '👑 **Kernel Kup Tournaments**',
      '`/register` — Register for the current Kernel Kup (player, coach, or caster)',
      '`/kkup` — Look up historical Kernel Kup results and standings',
      '`/hof` — Hall of Fame — top players, teams, coaches, and staff of all time',
      '',
      '⬆️ **Progression**',
      '`/mvp` — Submit an MVP request to rank up or rank down a player',
      '`/joingiveaway` — Browse and enter active community giveaways',
      '',
      '💬 **Feedback**',
      '`/suggestion` — Send a suggestion straight to the officers',
      '`/report` — Report a bug, player issue, or other concern',
    ].join('\n');

    const gettingStarted = isRegistered
      ? "You're already part of the guild — thanks for being here! 🌽"
      : "**New here?** Visit the website to sign in with Discord and create your account. No approval needed — jump right in!";

    const embed = {
      title: '🌽 The Corn Field — Command Guide',
      description: `${gettingStarted}\n\n${commandList}`,
      color: 0xD6A615, // harvest gold
      fields: [
        {
          name: '🔗 Quick Links',
          value: [
            '[🌐 Website](https://thecornfield.figma.site/)',
            '[📋 Leaderboard](https://thecornfield.figma.site/#leaderboard)',
            '[👑 Kernel Kup](https://thecornfield.figma.site/#kkup)',
            '[🏛️ Hall of Fame](https://thecornfield.figma.site/#hall-of-fame)',
          ].join(' • '),
          inline: false,
        },
      ],
      footer: {
        text: footerText,
      },
      timestamp: new Date().toISOString(),
    };

    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [embed],
        components: [{
          type: 1,
          components: [{
            type: 2,
            style: 5,
            label: 'Visit The Corn Field',
            url: 'https://thecornfield.figma.site/',
            emoji: { name: '🌽' },
          }],
        }],
        flags: 64, // Ephemeral — only the user sees it
      },
    });
  } catch (error) {
    console.error('Error handling /help command:', error);
    return jsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: 'Error',
          description: 'Failed to load help. Please try again later.',
          color: 0xEF4444,
        }],
        flags: 64,
      },
    });
  }
}