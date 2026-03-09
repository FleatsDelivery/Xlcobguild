/**
 * Slugify a tournament name into a clean folder name for storage.
 *
 * Examples:
 *   "Kernel Kup 11"     → "kernel-kup-11"
 *   "Heaps n Hooks 3"   → "heaps-n-hooks-3"
 *   "My Cool Tournament" → "my-cool-tournament"
 *   "  Kernel   Kup  10 " → "kernel-kup-10"
 */
export function slugifyTournamentName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')  // strip non-alphanumeric (keep spaces & hyphens)
    .replace(/\s+/g, '-')           // spaces → hyphens
    .replace(/-+/g, '-')            // collapse multiple hyphens
    .replace(/^-|-$/g, '');         // trim leading/trailing hyphens
}

/**
 * Get the storage folder path for a tournament's images.
 * Uses slugified name, with a safe fallback.
 */
export function getTournamentImageFolder(name: string, fallbackId?: string): string {
  const slug = slugifyTournamentName(name);
  if (slug.length >= 3) return slug;
  // Fallback for very short or empty names
  return fallbackId ? `tournament-${fallbackId}` : `tournament-${Date.now()}`;
}
