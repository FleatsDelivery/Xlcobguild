/**
 * Trophy Assets — Single source of truth for trophy images
 *
 * All trophy artwork lives in Supabase Storage under:
 *   make-4789f4af-kkup-assets/trophies/
 *
 * To add a new trophy:
 *   1. Upload the PNG to the trophies/ folder in Supabase Storage
 *   2. Add a new entry to TROPHY_CONFIGS below
 *   3. Done — TrophyImage component picks it up automatically
 */

const TROPHY_BASE_URL =
  'https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/make-4789f4af-kkup-assets/trophies';

// ── Config per trophy type ─────────────────────────────────────────────

export interface TrophyConfig {
  /** Public URL to the trophy image */
  url: string;
  /** Short display label */
  label: string;
  /** Full descriptive label (tooltips, modals) */
  fullLabel: string;
  /** Accent color for borders, tinted backgrounds, label text */
  color: string;
}

export const TROPHY_CONFIGS: Record<string, TrophyConfig> = {
  kernel_kup_champion: {
    url: `${TROPHY_BASE_URL}/kernel_kup_trophy.png`,
    label: 'KK Champ',
    fullLabel: 'Kernel Kup Champion',
    color: '#f1c60f', // kernel-gold
  },
  popd_kernel_mvp: {
    url: `${TROPHY_BASE_URL}/popd_kernel_trophy.png`,
    label: "Pop'd Kernel",
    fullLabel: "Pop'd Kernel MVP",
    color: '#dc2626', // red
  },
  // ── Future trophies ──
  // heaps_n_hooks_champion: {
  //   url: `${TROPHY_BASE_URL}/heaps_n_hooks_trophy.png`,
  //   label: "H&H Champ",
  //   fullLabel: "Heaps n' Hooks Champion",
  //   color: '#10b981',
  // },
  // runner_up: {
  //   url: `${TROPHY_BASE_URL}/runner_up_trophy.png`,
  //   label: "Runner-Up",
  //   fullLabel: "Tournament Runner-Up",
  //   color: '#C0C0C0',
  // },
};

// ── Helpers ────────────────────────────────────────────────────────────

/** Get trophy config by type key. Returns undefined for unknown types. */
export function getTrophyConfig(type: string): TrophyConfig | undefined {
  return TROPHY_CONFIGS[type];
}

/** Get the image URL for a trophy type. Falls back to empty string. */
export function getTrophyUrl(type: string): string {
  return TROPHY_CONFIGS[type]?.url || '';
}

/**
 * Convenience: get the two "main" trophy URLs directly.
 * Useful when you just need the image and don't care about the full config.
 */
export const KERNEL_KUP_TROPHY_URL = TROPHY_CONFIGS.kernel_kup_champion.url;
export const POPD_KERNEL_TROPHY_URL = TROPHY_CONFIGS.popd_kernel_mvp.url;
