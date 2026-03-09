// /website slash command handler — Quick link to the web app
import { InteractionResponseType, jsonResponse } from './utils.ts';

export async function handleWebsite(_body: any): Promise<Response> {
  return jsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '🌽 The Corn Field',
        description: 'Your guild portal — leaderboard, tournaments, profile, and more.',
        color: 0xD6A615,
        url: 'https://thecornfield.figma.site/',
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 5,
          label: 'Open Website',
          url: 'https://thecornfield.figma.site/',
          emoji: { name: '🌐' },
        }],
      }],
      flags: 64, // Ephemeral
    },
  });
}