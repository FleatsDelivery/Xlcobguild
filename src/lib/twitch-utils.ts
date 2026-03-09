/** Extract Twitch channel name from a URL like "https://twitch.tv/channelname" */
export function extractTwitchChannel(url: string): string | null {
  if (!url) return null;
  try {
    if (!url.includes('/')) return url.trim();
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts[0] || null;
  } catch {
    return url.trim() || null;
  }
}
