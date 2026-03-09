/**
 * Giveaway State Configuration — Single source of truth
 *
 * Maps every giveaway status to a complete visual + behavioral config.
 * Used by GiveawayCard and GiveawayDetailPage.
 *
 * ADDING A NEW STATUS:
 *   1. Add the key to GiveawayPhase
 *   2. Add a full GiveawayPhaseConfig entry in PHASE_CONFIGS
 *   3. That's it — all cards and pages will pick it up automatically
 */

// ═══════════════════════════════════════════════════════
// DATABASE TYPES (mirror the SQL schema)
// ═══════════════════════════════════════════════════════

export type GiveawayPhase = 'draft' | 'open' | 'closed' | 'drawn' | 'completed';

export type GiveawaySource = 'web' | 'discord' | 'twitch';

export type PrizeType = 'cash' | 'dota_plus' | 'discount_code' | 'physical' | 'other';

export type GiveawayVisibility = 'members' | 'public';

export interface Giveaway {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  visibility: GiveawayVisibility;
  status: GiveawayPhase;
  source: GiveawaySource;
  winner_count: number;
  created_by: string;           // users.id (uuid)
  created_at: string;
  updated_at: string;
  opens_at: string | null;
  closes_at: string | null;
  drawn_at: string | null;
}

export interface GiveawayPrize {
  id: string;
  giveaway_id: string;
  rank: number | null;          // null = all winners get this
  type: PrizeType;
  title: string;
  description: string | null;

  // Type-specific fields
  cash_amount: number | null;
  cash_currency: string;
  dota_plus_months: number | null;
  discount_percent: number | null;
  discount_code: string | null;

  // Fulfillment
  winner_user_id: string | null;
  fulfilled: boolean;
  fulfilled_at: string | null;
  stripe_transfer_id: string | null;

  sort_order: number;
}

export interface GiveawayEntry {
  id: string;
  giveaway_id: string;
  user_id: string;
  discord_username: string;
  discord_avatar: string | null;
  entered_at: string;
  source: GiveawaySource;
  winner_rank: number | null;   // null = didn't win, 1+ = winner
}

/** Enriched giveaway with related data (returned from detail endpoint) */
export interface GiveawayDetail extends Giveaway {
  prizes: GiveawayPrize[];
  entries: GiveawayEntry[];
  entry_count: number;
  user_entered: boolean;        // whether the current user has entered
  user_entry_id: string | null; // the current user's entry ID (for leave)
  creator_username: string | null;
}

/** Enriched giveaway for listing cards (lighter than detail) */
export interface GiveawayListItem extends Giveaway {
  entry_count: number;
  prize_summary: string[];      // ["$5 Cash", "1mo Dota Plus"]
  winners: GiveawayEntry[];     // only populated for drawn/completed
}

// ═══════════════════════════════════════════════════════
// PHASE CONFIG TYPES
// ═══════════════════════════════════════════════════════

export interface GiveawayPhaseConfig {
  // ── Identity ──
  key: GiveawayPhase;
  label: string;
  icon: string;
  tagline: string;

  // ── Visual Theme ──
  accentColor: string;          // Tailwind text class
  accentBg: string;             // Tailwind bg class
  accentBgLight: string;        // Lighter accent bg
  accentHex: string;            // Raw hex for shadows/glows
  statusPillBg: string;
  statusPillText: string;
  cardBorderHover: string;
  cardGlow: string;             // box-shadow value or empty

  // ── Animations ──
  pulseStatus: boolean;
  pingDot: boolean;

  // ── Behavioral Flags ──
  canEnter: boolean;
  canLeave: boolean;
  canEdit: boolean;
  canDraw: boolean;
  canComplete: boolean;
  canDelete: boolean;
  canOpen: boolean;
  canClose: boolean;
  showCountdown: boolean;
  showEntrants: boolean;
  showWinners: boolean;
  isFinished: boolean;
}

// ═══════════════════════════════════════════════════════
// PHASE CONFIGURATIONS
// ═══════════════════════════════════════════════════════

const PHASE_CONFIGS: Record<string, GiveawayPhaseConfig> = {

  // ── DRAFT ─────────────────────────────────────────────
  draft: {
    key: 'draft',
    label: 'Draft',
    icon: '📝',
    tagline: 'Setting up — not visible to members yet',

    accentColor: 'text-muted-foreground',
    accentBg: 'bg-muted',
    accentBgLight: 'bg-muted/50',
    accentHex: '#6b6545',
    statusPillBg: 'bg-muted',
    statusPillText: 'text-muted-foreground',
    cardBorderHover: 'hover:border-muted-foreground/30',
    cardGlow: '',

    pulseStatus: false,
    pingDot: false,

    canEnter: false,
    canLeave: false,
    canEdit: true,
    canDraw: false,
    canComplete: false,
    canDelete: true,
    canOpen: true,
    canClose: false,
    showCountdown: false,
    showEntrants: false,
    showWinners: false,
    isFinished: false,
  },

  // ── OPEN ──────────────────────────────────────────────
  open: {
    key: 'open',
    label: 'Open',
    icon: '🎉',
    tagline: 'Enter now — drawing soon!',

    accentColor: 'text-[#10b981]',
    accentBg: 'bg-[#10b981]',
    accentBgLight: 'bg-[#10b981]/10',
    accentHex: '#10b981',
    statusPillBg: 'bg-[#10b981]',
    statusPillText: 'text-white',
    cardBorderHover: 'hover:border-[#10b981]',
    cardGlow: '0 0 20px rgba(16, 185, 129, 0.15)',

    pulseStatus: true,
    pingDot: true,

    canEnter: true,
    canLeave: true,
    canEdit: true,
    canDraw: false,
    canComplete: false,
    canDelete: false,
    canOpen: false,
    canClose: true,
    showCountdown: true,
    showEntrants: true,
    showWinners: false,
    isFinished: false,
  },

  // ── CLOSED ────────────────────────────────────────────
  closed: {
    key: 'closed',
    label: 'Closed',
    icon: '🔒',
    tagline: 'Entries locked — draw incoming',

    accentColor: 'text-[#f59e0b]',
    accentBg: 'bg-[#f59e0b]',
    accentBgLight: 'bg-[#f59e0b]/10',
    accentHex: '#f59e0b',
    statusPillBg: 'bg-[#f59e0b]',
    statusPillText: 'text-white',
    cardBorderHover: 'hover:border-[#f59e0b]',
    cardGlow: '',

    pulseStatus: false,
    pingDot: false,

    canEnter: false,
    canLeave: false,
    canEdit: false,
    canDraw: true,
    canComplete: false,
    canDelete: false,
    canOpen: false,
    canClose: false,
    showCountdown: false,
    showEntrants: true,
    showWinners: false,
    isFinished: false,
  },

  // ── DRAWN ─────────────────────────────────────────────
  drawn: {
    key: 'drawn',
    label: 'Winners Drawn',
    icon: '🎰',
    tagline: 'Winners selected — prizes being fulfilled',

    accentColor: 'text-harvest',
    accentBg: 'bg-harvest',
    accentBgLight: 'bg-harvest/10',
    accentHex: '#d6a615',
    statusPillBg: 'bg-harvest',
    statusPillText: 'text-white',
    cardBorderHover: 'hover:border-harvest',
    cardGlow: '0 0 24px rgba(214, 166, 21, 0.2)',

    pulseStatus: true,
    pingDot: false,

    canEnter: false,
    canLeave: false,
    canEdit: false,
    canDraw: false,
    canComplete: true,
    canDelete: false,
    canOpen: false,
    canClose: false,
    showCountdown: false,
    showEntrants: true,
    showWinners: true,
    isFinished: false,
  },

  // ── COMPLETED ─────────────────────────────────────────
  completed: {
    key: 'completed',
    label: 'Completed',
    icon: '🏆',
    tagline: 'All prizes fulfilled — thanks for entering!',

    accentColor: 'text-[#8b5cf6]',
    accentBg: 'bg-[#8b5cf6]',
    accentBgLight: 'bg-[#8b5cf6]/10',
    accentHex: '#8b5cf6',
    statusPillBg: 'bg-[#8b5cf6]',
    statusPillText: 'text-white',
    cardBorderHover: 'hover:border-[#8b5cf6]',
    cardGlow: '',

    pulseStatus: false,
    pingDot: false,

    canEnter: false,
    canLeave: false,
    canEdit: false,
    canDraw: false,
    canComplete: false,
    canDelete: false,
    canOpen: false,
    canClose: false,
    showCountdown: false,
    showEntrants: true,
    showWinners: true,
    isFinished: true,
  },
};

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

const FALLBACK = PHASE_CONFIGS.draft;

/** Get the full phase config for a giveaway status string */
export function getGiveawayPhaseConfig(status: string | null | undefined): GiveawayPhaseConfig {
  if (!status) return FALLBACK;
  return PHASE_CONFIGS[status] || FALLBACK;
}

/** Quick boolean checks */
export function isGiveawayOpen(status: string | null | undefined): boolean {
  return status === 'open';
}

export function isGiveawayFinished(status: string | null | undefined): boolean {
  return ['drawn', 'completed'].includes(status || '');
}

export function hasWinners(status: string | null | undefined): boolean {
  return ['drawn', 'completed'].includes(status || '');
}

/** All valid giveaway phases (for iteration / selectors) */
export const ALL_GIVEAWAY_PHASES: GiveawayPhase[] = [
  'draft', 'open', 'closed', 'drawn', 'completed',
];

/** Valid phase transitions — what status can move to what */
export const PHASE_TRANSITIONS: Record<GiveawayPhase, GiveawayPhase[]> = {
  draft:     ['open'],
  open:      ['closed'],
  closed:    ['drawn'],
  drawn:     ['completed'],
  completed: [],
};

// ═══════════════════════════════════════════════════════
// PRIZE TYPE CONFIG
// ═══════════════════════════════════════════════════════

export interface PrizeTypeConfig {
  label: string;
  icon: string;
  color: string;      // Tailwind text class
  bgColor: string;    // Tailwind bg class
}

export const PRIZE_TYPE_CONFIGS: Record<PrizeType, PrizeTypeConfig> = {
  cash: {
    label: 'Cash',
    icon: '💵',
    color: 'text-[#10b981]',
    bgColor: 'bg-[#10b981]/10',
  },
  dota_plus: {
    label: 'Dota Plus',
    icon: '⭐',
    color: 'text-harvest',
    bgColor: 'bg-harvest/10',
  },
  discount_code: {
    label: 'Discount Code',
    icon: '🏷️',
    color: 'text-[#3b82f6]',
    bgColor: 'bg-[#3b82f6]/10',
  },
  physical: {
    label: 'Physical Item',
    icon: '📦',
    color: 'text-[#8b5cf6]',
    bgColor: 'bg-[#8b5cf6]/10',
  },
  other: {
    label: 'Other',
    icon: '🎁',
    color: 'text-[#f59e0b]',
    bgColor: 'bg-[#f59e0b]/10',
  },
};

/** Get display info for a prize type */
export function getPrizeTypeConfig(type: string | null | undefined): PrizeTypeConfig {
  if (!type) return PRIZE_TYPE_CONFIGS.other;
  return PRIZE_TYPE_CONFIGS[type as PrizeType] || PRIZE_TYPE_CONFIGS.other;
}

/** Format a prize into a short display string (for card summaries) */
export function formatPrizeSummary(prize: GiveawayPrize): string {
  switch (prize.type) {
    case 'cash':
      return prize.cash_amount
        ? `$${Number(prize.cash_amount).toFixed(0)} ${prize.cash_currency || 'USD'}`
        : prize.title;
    case 'dota_plus':
      return prize.dota_plus_months
        ? `${prize.dota_plus_months}mo Dota Plus`
        : prize.title;
    case 'discount_code':
      return prize.discount_percent
        ? `${Number(prize.discount_percent).toFixed(0)}% Off`
        : prize.title;
    default:
      return prize.title;
  }
}