/**
 * Team Logo Utilities
 *
 * Naming convention: team_logos/{tag_lowercase}.{ext}
 * Bucket: make-4789f4af-kkup-assets (public)
 *
 * Since logos can be .png or .jpg, this helper tries both.
 * Use `resolveTeamLogoUrl()` to get the best available logo URL
 * for a team, falling back to a tag-derived URL when logo_url is missing.
 */

import { projectId } from '/utils/supabase/info';

const BUCKET = 'make-4789f4af-kkup-assets';
const FOLDER = 'team_logos';

/** Build the public URL for a team logo given a tag and extension. */
export function buildTeamLogoUrl(tag: string, ext: string = 'png'): string {
  const slug = tag.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `https://${projectId}.supabase.co/storage/v1/object/public/${BUCKET}/${FOLDER}/${slug}.${ext}`;
}

/**
 * Resolve the best logo URL for a team.
 *  1. If logo_url is set (from DB), use it directly.
 *  2. If only team_tag is available, derive the URL (assumes .png — TeamLogo's
 *     onError fallback handles the case where it's actually .jpg or missing).
 *  3. Returns null if neither is available.
 */
export function resolveTeamLogoUrl(
  logoUrl?: string | null,
  teamTag?: string | null,
): string | null {
  if (logoUrl) return logoUrl;
  if (teamTag?.trim()) return buildTeamLogoUrl(teamTag);
  return null;
}
