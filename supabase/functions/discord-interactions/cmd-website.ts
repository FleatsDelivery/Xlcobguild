// /website slash command handler — Quick link to the web app
import { InteractionResponseType } from './utils.ts';

export async function handleWebsite(_body: any): Promise<any> {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '🌽 The Corn Field',
        description: 'Your guild portal — leaderboard, tournaments, profile, and more.',
        color: 0xD6A615,
        url: 'https://kernelkup.com/',
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 5,
          label: 'Open Website',
          url: 'https://kernelkup.com/',
          emoji: { name: '🌐' },
        }],
      }],
      flags: 64, // Ephemeral
    },
  };
}