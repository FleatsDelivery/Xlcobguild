/**
 * Steam Workshop Stats Route
 * 1 route: GET /workshop-stats
 */
import type { Hono } from "npm:hono";
import { PREFIX } from "./helpers.ts";

export function registerWorkshopRoutes(app: Hono) {

  // Get Steam Workshop stats for custom games
  app.get(`${PREFIX}/workshop-stats`, async (c) => {
    try {
      const steamApiKey = Deno.env.get('STEAM_WEB_API_KEY');
      if (!steamApiKey) {
        return c.json({ error: 'Steam API key not configured' }, 500);
      }

      const workshopIds = ['3592388680', '3585929337', '3580844386'];

      const params = new URLSearchParams();
      params.append('key', steamApiKey);
      workshopIds.forEach((id, i) => {
        params.append(`publishedfileids[${i}]`, id);
      });
      params.append('includevotes', '1');
      params.append('includetags', '1');
      params.append('includeadditionalpreviews', '0');
      params.append('includeforsaledata', '0');
      params.append('includemetadata', '1');
      params.append('strip_description_bbcode', '1');

      const url = `https://api.steampowered.com/IPublishedFileService/GetDetails/v1/?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error('Steam API error:', response.status, await response.text());
        return c.json({ error: 'Failed to fetch from Steam API' }, 502);
      }

      const data = await response.json();
      const files = data?.response?.publishedfiledetails || [];

      const stats: Record<string, any> = {};
      for (const file of files) {
        const id = String(file.publishedfileid);
        stats[id] = {
          publishedfileid: id,
          title: file.title || '',
          views: file.views || 0,
          subscriptions: file.subscriptions || 0,
          favorited: file.favorited || 0,
          lifetime_subscriptions: file.lifetime_subscriptions || 0,
          lifetime_favorited: file.lifetime_favorited || 0,
          votes_up: file.vote_data?.votes_up || 0,
          votes_down: file.vote_data?.votes_down || 0,
          score: file.vote_data?.score || 0,
          num_comments_public: file.num_comments_public || 0,
          time_created: file.time_created || 0,
          time_updated: file.time_updated || 0,
          file_size: file.file_size || 0,
        };
      }

      return c.json({ stats });
    } catch (error) {
      console.error('Workshop stats error:', error);
      return c.json({ error: 'Internal server error: ' + String(error) }, 500);
    }
  });

}
