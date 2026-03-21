/**
 * Tournament Assets -- Standardized Storage Utilities
 * 
 * All tournament and team assets follow a strict naming convention:
 * 
 * TOURNAMENT ASSETS (per tournament):
 *   kernel-kup-{N}/league_banner.png       - Hero banner for tournament pages
 *   kernel-kup-{N}/league_large_icon.png   - Large icon for tournament cards
 *   kernel-kup-{N}/league_square_icon.png  - Square icon (gallery only)
 *   kernel-kup-{N}/*.png                    - Gallery images (team logos included)
 * 
 * TEAM LOGOS (double-stored):
 *   team_logos/{team-tag}.png              - Master location (persists across tournaments)
 *   kernel-kup-{N}/{team-tag}.png          - Tournament gallery copy
 * 
 * Storage bucket: make-4789f4af-kkup-assets (public)
 * Base URL: https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/make-4789f4af-kkup-assets
 */

const STORAGE_BASE = 'https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/make-4789f4af-kkup-assets';

// ═══════════════════════════════════════════════════════
// TOURNAMENT FOLDER NAMING
// ═══════════════════════════════════════════════════════

/**
 * Extract tournament folder from name
 * "Kernel Kup 10" → "kernel-kup-10"
 * "Heaps n Hooks 2" → "heaps-n-hooks-2"
 */
export function getTournamentFolder(tournamentName: string): string {
  // Match "Kernel Kup 10" or "Heaps n Hooks 2"
  const kernelMatch = tournamentName.match(/kernel\s+kup\s+(\d+)/i);
  if (kernelMatch) {
    return `kernel-kup-${kernelMatch[1]}`;
  }

  const heapsMatch = tournamentName.match(/heaps\s+n\s+hooks\s+(\d+)/i);
  if (heapsMatch) {
    return `heaps-n-hooks-${heapsMatch[1]}`;
  }

  // Fallback: slugify the name
  return tournamentName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ═══════════════════════════════════════════════════════
// TOURNAMENT ASSET URLS
// ═══════════════════════════════════════════════════════

export function getTournamentBanner(tournamentName: string): string {
  const folder = getTournamentFolder(tournamentName);
  return `${STORAGE_BASE}/${folder}/league_banner.png`;
}

export function getTournamentLargeIcon(tournamentName: string): string {
  const folder = getTournamentFolder(tournamentName);
  return `${STORAGE_BASE}/${folder}/league_large_icon.png`;
}

export function getTournamentSquareIcon(tournamentName: string): string {
  const folder = getTournamentFolder(tournamentName);
  return `${STORAGE_BASE}/${folder}/league_square_icon.png`;
}

/**
 * Get all assets in a tournament folder (for gallery tab)
 * Note: This requires a server-side list operation, not a static URL
 */
export function getTournamentGalleryPath(tournamentName: string): string {
  return getTournamentFolder(tournamentName);
}

// ═══════════════════════════════════════════════════════
// TEAM LOGO URLS
// ═══════════════════════════════════════════════════════

/**
 * Normalize team tag to filename slug
 * "FT HOG" → "fthog"
 * "Shuck" → "shuck"
 */
export function slugifyTeamTag(teamTag: string): string {
  return teamTag.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Get master team logo URL (primary location)
 * Tries .png first, falls back to .jpg
 */
export function getTeamLogoUrl(teamTag: string, extension: 'png' | 'jpg' = 'png'): string {
  const slug = slugifyTeamTag(teamTag);
  return `${STORAGE_BASE}/team_logos/${slug}.${extension}`;
}

/**
 * Get tournament-specific team logo URL (gallery copy)
 */
export function getTournamentTeamLogoUrl(
  tournamentName: string,
  teamTag: string,
  extension: 'png' | 'jpg' = 'png'
): string {
  const folder = getTournamentFolder(tournamentName);
  const slug = slugifyTeamTag(teamTag);
  return `${STORAGE_BASE}/${folder}/${slug}.${extension}`;
}

// ═══════════════════════════════════════════════════════
// STORAGE PATHS (for server-side uploads)
// ═══════════════════════════════════════════════════════

/**
 * Get master team logo storage path
 */
export function getTeamLogoStoragePath(teamTag: string, extension: 'png' | 'jpg' = 'png'): string {
  const slug = slugifyTeamTag(teamTag);
  return `team_logos/${slug}.${extension}`;
}

/**
 * Get tournament team logo storage path (for gallery)
 */
export function getTournamentTeamLogoStoragePath(
  tournamentName: string,
  teamTag: string,
  extension: 'png' | 'jpg' = 'png'
): string {
  const folder = getTournamentFolder(tournamentName);
  const slug = slugifyTeamTag(teamTag);
  return `${folder}/${slug}.${extension}`;
}

/**
 * Get tournament asset storage path
 */
export function getTournamentAssetStoragePath(
  tournamentName: string,
  filename: 'league_banner.png' | 'league_large_icon.png' | 'league_square_icon.png'
): string {
  const folder = getTournamentFolder(tournamentName);
  return `${folder}/${filename}`;
}

// ═══════════════════════════════════════════════════════
// EXTENSION DETECTION
// ═══════════════════════════════════════════════════════

/**
 * Determine file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): 'png' | 'jpg' {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg';
  return 'png'; // default
}
