/**
 * Tournament State Configuration — Single source of truth
 *
 * Maps every tournament status to a complete visual + behavioral config.
 * Used by TournamentCard (kkup-page) and TournamentHubPage.
 *
 * ADDING A NEW STATUS:
 *   1. Add the key to TournamentPhase
 *   2. Add a full PhaseConfig entry in PHASE_CONFIGS
 *   3. That's it — all cards and hub pages will pick it up automatically
 */

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export type TournamentPhase =
  | 'upcoming'
  | 'registration_open'
  | 'registration_closed'
  | 'roster_lock'
  | 'live'
  | 'completed'
  | 'archived'
  // Backward-compat aliases (old DB values)
  | 'registration'
  | 'active';

export interface PhaseConfig {
  // ── Identity ──
  key: string;
  label: string;
  icon: string;
  tagline: string;              // Short CTA or description for players

  // ── Visual Theme ──
  headerGradient: string;       // Hero header bg gradient
  accentColor: string;          // Primary accent tailwind text class
  accentBg: string;             // Accent background class
  accentBgLight: string;        // Lighter accent bg
  accentHex: string;            // Raw hex for shadows/glows
  statusPillBg: string;         // Status badge bg
  statusPillText: string;       // Status badge text
  cardBorderHover: string;      // Card border on hover
  cardGlow: string;             // Box-shadow glow on card (CSS value or empty)

  // ── Animations ──
  pulseStatus: boolean;         // Status badge pulses
  pingDot: boolean;             // Animated ping dot in status badge
  cardHoverLift: boolean;       // Card lifts on hover (translate-y)
  bannerZoom: boolean;          // Banner image zooms on hover
  headerBreathing: boolean;     // Header border does breathing glow

  // ── Behavioral Flags ──
  canRegister: boolean;
  canCreateTeam: boolean;
  canSendInvites: boolean;
  canWithdraw: boolean;
  canEditRoster: boolean;
  showBroadcast: boolean;
  showFreeAgentPool: boolean;
  showTeamPreview: boolean;
  showStaffApply: boolean;
  showRegistrationCTA: boolean;
  showWinnerBanner: boolean;
  isMutable: boolean;           // Teams/rosters can be modified
  isFinished: boolean;          // Tournament is over
  tcfPlusEarlyAccess: boolean;  // TCF+ members can register during this phase

  // ── Section Ordering (overview tab) ──
  overviewSections: OverviewSection[];
  availableTabs: TabKey[];
}

export type OverviewSection =
  | 'countdown'
  | 'winner_banner'
  | 'urgency_bar'
  | 'progress_cards'
  | 'registration_hero_cta'
  | 'registration_cta'
  | 'your_status'
  | 'my_staff_status'
  | 'live_broadcast'
  | 'live_matches'
  | 'all_registrants';

export type TabKey = 'overview' | 'players' | 'teams' | 'staff' | 'matches' | 'gallery' | 'bracket' | 'prizes';

// ═══════════════════════════════════════════════════════
// PHASE CONFIGURATIONS
// ═══════════════════════════════════════════════════════

const PHASE_CONFIGS: Record<string, PhaseConfig> = {

  // ── UPCOMING ──────────────────────────────────────────
  upcoming: {
    key: 'upcoming',
    label: 'Upcoming',
    icon: '📅',
    tagline: 'Tournament announced — TCF+ members can register early!',

    headerGradient: 'from-field-dark to-[#1e293b]',
    accentColor: 'text-field-dark',
    accentBg: 'bg-field-dark',
    accentBgLight: 'bg-field-dark/10',
    accentHex: '#262d01',
    statusPillBg: 'bg-field-dark/80',
    statusPillText: 'text-white',
    cardBorderHover: 'hover:border-field-dark/30',
    cardGlow: '',

    pulseStatus: false,
    pingDot: false,
    cardHoverLift: true,
    bannerZoom: true,
    headerBreathing: false,

    canRegister: false,
    canCreateTeam: false,
    canSendInvites: false,
    canWithdraw: true,
    canEditRoster: false,
    showBroadcast: false,
    showFreeAgentPool: false,
    showTeamPreview: false,
    showStaffApply: false,
    showRegistrationCTA: false,
    showWinnerBanner: false,
    isMutable: true,
    isFinished: false,
    tcfPlusEarlyAccess: true,

    overviewSections: ['countdown', 'registration_hero_cta', 'registration_cta', 'progress_cards', 'your_status', 'my_staff_status', 'all_registrants'],
    availableTabs: ['overview'],
  },

  // ── REGISTRATION OPEN ─────────────────────────────────
  registration_open: {
    key: 'registration_open',
    label: 'Registration Open',
    icon: '🎉',
    tagline: 'Sign up now — spots are filling fast!',

    headerGradient: 'from-[#10b981] to-[#059669]',
    accentColor: 'text-[#10b981]',
    accentBg: 'bg-[#10b981]',
    accentBgLight: 'bg-[#10b981]/10',
    accentHex: '#10b981',
    statusPillBg: 'bg-[#10b981]',
    statusPillText: 'text-white',
    cardBorderHover: 'hover:border-[#10b981]',
    cardGlow: '0 0 20px rgba(16, 185, 129, 0.15)',

    pulseStatus: true,
    pingDot: false,
    cardHoverLift: true,
    bannerZoom: true,
    headerBreathing: true,

    canRegister: true,
    canCreateTeam: true,
    canSendInvites: true,
    canWithdraw: true,
    canEditRoster: true,
    showBroadcast: false,
    showFreeAgentPool: true,
    showTeamPreview: true,
    showStaffApply: true,
    showRegistrationCTA: true,
    showWinnerBanner: false,
    isMutable: true,
    isFinished: false,
    tcfPlusEarlyAccess: false,

    overviewSections: [
      'countdown',
      'progress_cards',
      'registration_hero_cta',
      'registration_cta',
      'your_status',
      'my_staff_status',
      'all_registrants',
    ],
    availableTabs: ['overview', 'players', 'teams', 'staff'],
  },

  // ── REGISTRATION CLOSED ───────────────────────────────
  registration_closed: {
    key: 'registration_closed',
    label: 'Registration Closed',
    icon: '🔒',
    tagline: 'Registration closed — finalize your rosters',

    headerGradient: 'from-[#f59e0b] to-[#d97706]',
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
    cardHoverLift: true,
    bannerZoom: true,
    headerBreathing: false,

    canRegister: false,
    canCreateTeam: false,
    canSendInvites: false,
    canWithdraw: true,
    canEditRoster: true,
    showBroadcast: false,
    showFreeAgentPool: true,
    showTeamPreview: true,
    showStaffApply: true,
    showRegistrationCTA: false,
    showWinnerBanner: false,
    isMutable: true,
    isFinished: false,
    tcfPlusEarlyAccess: false,

    overviewSections: [
      'countdown',
      'progress_cards',
      'your_status',
      'my_staff_status',
      'all_registrants',
    ],
    availableTabs: ['overview', 'players', 'teams', 'staff'],
  },

  // ── ROSTER LOCK ───────────────────────────────────────
  roster_lock: {
    key: 'roster_lock',
    label: 'Rosters Locked',
    icon: '🔐',
    tagline: 'Rosters are locked — tournament starts soon',

    headerGradient: 'from-[#d97706] to-[#b45309]',
    accentColor: 'text-[#d97706]',
    accentBg: 'bg-[#d97706]',
    accentBgLight: 'bg-[#d97706]/10',
    accentHex: '#d97706',
    statusPillBg: 'bg-[#d97706]',
    statusPillText: 'text-white',
    cardBorderHover: 'hover:border-[#d97706]',
    cardGlow: '',

    pulseStatus: false,
    pingDot: false,
    cardHoverLift: true,
    bannerZoom: true,
    headerBreathing: false,

    canRegister: false,
    canCreateTeam: false,
    canSendInvites: false,
    canWithdraw: false,
    canEditRoster: false,
    showBroadcast: false,
    showFreeAgentPool: false,
    showTeamPreview: true,
    showStaffApply: false,
    showRegistrationCTA: false,
    showWinnerBanner: false,
    isMutable: false,
    isFinished: false,
    tcfPlusEarlyAccess: false,

    overviewSections: [
      'countdown',
      'progress_cards',
      'your_status',
      'my_staff_status',
      'all_registrants',
    ],
    availableTabs: ['overview', 'players', 'teams', 'staff'],
  },

  // ── LIVE ──
  live: {
    key: 'live',
    label: 'LIVE',
    icon: '⚡',
    tagline: 'Matches are happening now!',

    headerGradient: 'from-[#ef4444] to-[#dc2626]',
    accentColor: 'text-[#ef4444]',
    accentBg: 'bg-[#ef4444]',
    accentBgLight: 'bg-[#ef4444]/10',
    accentHex: '#ef4444',
    statusPillBg: 'bg-[#ef4444]',
    statusPillText: 'text-white',
    cardBorderHover: 'hover:border-[#ef4444]',
    cardGlow: '0 0 24px rgba(239, 68, 68, 0.2)',

    pulseStatus: true,
    pingDot: true,
    cardHoverLift: true,
    bannerZoom: false,
    headerBreathing: true,

    canRegister: false,
    canCreateTeam: false,
    canSendInvites: false,
    canWithdraw: false,
    canEditRoster: false,
    showBroadcast: true,
    showFreeAgentPool: false,
    showTeamPreview: true,
    showStaffApply: false,
    showRegistrationCTA: false,
    showWinnerBanner: false,
    isMutable: false,
    isFinished: false,
    tcfPlusEarlyAccess: false,

    overviewSections: [
      'live_broadcast',
      'progress_cards',
      'your_status',
      'my_staff_status',
      'all_registrants',
    ],
    availableTabs: ['overview', 'players', 'teams', 'staff', 'matches'],
  },

  // ── COMPLETED ──
  completed: {
    key: 'completed',
    label: 'Completed',
    icon: '🏆',
    tagline: 'Tournament finished — view results',

    headerGradient: 'from-[#8b5cf6] to-[#7c3aed]',
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
    cardHoverLift: true,
    bannerZoom: true,
    headerBreathing: false,

    canRegister: false,
    canCreateTeam: false,
    canSendInvites: false,
    canWithdraw: false,
    canEditRoster: false,
    showBroadcast: false,
    showFreeAgentPool: false,
    showTeamPreview: true,
    showStaffApply: false,
    showRegistrationCTA: false,
    showWinnerBanner: true,
    isMutable: false,
    isFinished: true,
    tcfPlusEarlyAccess: false,

    overviewSections: [
      'winner_banner',
      'progress_cards',
      'your_status',
      'my_staff_status',
      'all_registrants',
    ],
    availableTabs: ['overview', 'teams', 'players', 'matches', 'staff', 'gallery'],
  },

  // ── ARCHIVED ──
  archived: {
    key: 'archived',
    label: 'Archived',
    icon: '📦',
    tagline: 'Historical record',

    headerGradient: 'from-[#8b5cf6] to-[#7c3aed]',
    accentColor: 'text-[#8b5cf6]',
    accentBg: 'bg-[#8b5cf6]',
    accentBgLight: 'bg-[#8b5cf6]/10',
    accentHex: '#8b5cf6',
    statusPillBg: 'bg-field-dark/40',
    statusPillText: 'text-white/80',
    cardBorderHover: 'hover:border-[#8b5cf6]',
    cardGlow: '',

    pulseStatus: false,
    pingDot: false,
    cardHoverLift: true,
    bannerZoom: true,
    headerBreathing: false,

    canRegister: false,
    canCreateTeam: false,
    canSendInvites: false,
    canWithdraw: false,
    canEditRoster: false,
    showBroadcast: false,
    showFreeAgentPool: false,
    showTeamPreview: true,
    showStaffApply: false,
    showRegistrationCTA: false,
    showWinnerBanner: true,
    isMutable: false,
    isFinished: true,
    tcfPlusEarlyAccess: false,

    overviewSections: [
      'winner_banner',
      'progress_cards',
      'your_status',
      'my_staff_status',
      'all_registrants',
    ],
    availableTabs: ['overview', 'teams', 'players', 'matches', 'staff', 'gallery'],
  },
};

// ── Backward-compat aliases ──
PHASE_CONFIGS.registration = { ...PHASE_CONFIGS.registration_open, key: 'registration' };
PHASE_CONFIGS.active = { ...PHASE_CONFIGS.live, key: 'active' };

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

const FALLBACK = PHASE_CONFIGS.upcoming;

/** Get the full phase config for a tournament status string */
export function getPhaseConfig(status: string | null | undefined): PhaseConfig {
  if (!status) return FALLBACK;
  return PHASE_CONFIGS[status] || FALLBACK;
}

/** Quick boolean checks used frequently */
export function isRegistrationOpen(status: string | null | undefined): boolean {
  return ['registration_open', 'registration'].includes(status || '');
}

export function isLive(status: string | null | undefined): boolean {
  return ['live', 'active'].includes(status || '');
}

export function isFinished(status: string | null | undefined): boolean {
  return ['completed', 'archived'].includes(status || '');
}

export function isMutable(status: string | null | undefined): boolean {
  return ['upcoming', 'registration_open', 'registration_closed'].includes(status || '');
}

/** All valid phase keys (for iteration / selectors) */
export const ALL_PHASES: TournamentPhase[] = [
  'upcoming', 'registration_open', 'registration_closed', 'roster_lock', 'live', 'completed', 'archived',
];

// ═══════════════════════════════════════════════════════
// APPROVAL STATUS STYLES
// ═══════════════════════════════════════════════════════

/** Visual config for player/team approval statuses */
export const APPROVAL_STYLES: Record<string, { bg: string; text: string; label: string; dotColor: string }> = {
  pending_approval: { bg: 'bg-amber/10',      text: 'text-amber',      label: 'Pending Approval',  dotColor: 'bg-amber' },
  approved:         { bg: 'bg-[#10b981]/10',  text: 'text-[#10b981]',  label: 'Approved',          dotColor: 'bg-[#10b981]' },
  denied:           { bg: 'bg-[#ef4444]/10',  text: 'text-[#ef4444]',  label: 'Denied',            dotColor: 'bg-[#ef4444]' },
};

/**
 * Determine which date field to count down to for a given phase.
 * Returns { label, dateField } or null if no countdown applies.
 */
export function getCountdownTarget(status: string | null | undefined): { label: string; dateField: string } | null {
  switch (status) {
    case 'upcoming':
      return { label: 'Registration Opens In', dateField: 'registration_start_date' };
    case 'registration_open':
    case 'registration':
      return { label: 'Registration Closes In', dateField: 'registration_end_date' };
    case 'registration_closed':
    case 'roster_lock':
      return { label: 'Tournament Starts In', dateField: 'tournament_start_date' };
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════
// DYNAMIC TAB VISIBILITY
// ═══════════════════════════════════════════════════════

/**
 * Get which tabs should be visible for a tournament based on its phase and state.
 * 
 * Philosophy: Tabs appear progressively as tournaments move through their lifecycle.
 * - Early phases (anticipation): Overview, Players, Staff
 * - Preparation phase (roster_lock without teams): Same as early
 * - Competition phase (roster_lock with teams, live): Add Teams, Matches, Bracket
 * - Legacy phase (finished): All tabs including Gallery, Prizes
 * 
 * @param tournament - Tournament object with status and team count
 * @param teamCount - Number of teams that have locked in (optional, derived from tournament)
 */
export function getVisibleTabs(
  tournament: any,
  teamCount: number = 0
): TabKey[] {
  const status = tournament?.status;
  
  // Base tabs - always visible
  const baseTabs: TabKey[] = ['overview', 'players', 'staff'];
  
  // Competition tabs - visible during active play
  const competitionTabs: TabKey[] = ['teams', 'matches', 'bracket'];
  
  // Legacy tabs - only visible when finished
  const legacyTabs: TabKey[] = ['gallery', 'prizes'];
  
  // ── Early phases: only base tabs ──
  if (
    status === 'upcoming' ||
    status === 'registration_open' ||
    status === 'registration' ||
    status === 'registration_closed'
  ) {
    return baseTabs;
  }
  
  // ── Roster lock: add competition tabs only if teams exist ──
  if (status === 'roster_lock') {
    return teamCount > 0
      ? [...baseTabs, ...competitionTabs]
      : baseTabs;
  }
  
  // ── Live/active: show competition tabs ──
  if (status === 'live' || status === 'active') {
    return [...baseTabs, ...competitionTabs];
  }
  
  // ── Finished/completed/archived: show everything ──
  if (status === 'completed' || status === 'archived' || status === 'finished') {
    return [...baseTabs, ...competitionTabs, ...legacyTabs];
  }
  
  // ── Default fallback: show all tabs (safety net) ──
  return [...baseTabs, ...competitionTabs, ...legacyTabs];
}