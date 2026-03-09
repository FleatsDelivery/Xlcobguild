/**
 * Role Configuration — Single source of truth for the TCF permission system.
 *
 * IMPORTANT: As of Guild Wars migration, `role` is PURELY a permission tier.
 * Guild affiliation is stored in `users.guild_id` → `guild_wars_guilds`.
 *
 * PERMISSION TIERS (highest → lowest):
 *   owner    → Colonel Kernel (site owner, full access)
 *   officer  → Cob Officer, Queen Of Hog (can approve requests, admin panels)
 *   member   → Member (generic onboarded user — guild affiliation is separate)
 *   guest    → Guest (authenticated user not yet onboarded — full app access)
 *
 * ALL authenticated users (including guests) have full app access.
 * Guests are simply users who haven't completed onboarding yet.
 *
 * CUSTOM ROLES: Additional roles can be created via Admin Tools and are stored
 * in the `roles` database table (is_builtin = false). They are loaded at runtime
 * via loadCustomRoles() and merged into all display/badge/option functions automatically.
 *
 * RANKS (Earwig → Pop'd Kernel) are a completely separate progression
 * system. GUILDS (XLCOB, EAFD, FTHOG, etc.) are a separate affiliation system.
 * Roles = what you can DO. Guilds = who you're WITH. Ranks = your progression.
 */

// ── Custom Role Type ────────────────────────────────────────────────

export interface CustomRole {
  value: string;
  displayName: string;
  badgeTag: string;
  hex: string;
  tier: 'member' | 'officer';
}

// ── Custom Roles State ──────────────────────────────────────────────
// Loaded from server at app startup, merged into all lookup functions.

let _customRoles: CustomRole[] = [];

/** Load custom roles from server response — call once at app boot */
export function loadCustomRoles(roles: CustomRole[]): void {
  _customRoles = roles;
  // Rebuild caches
  _rebuildCustomCaches();
}

/** Get current custom roles (read-only) */
export function getCustomRoles(): readonly CustomRole[] {
  return _customRoles;
}

// Internal caches rebuilt when custom roles change
let _customDisplayNames: Record<string, string> = {};
let _customBadgeTags: Record<string, string> = {};
let _customBadgeStyles: Record<string, RoleBadgeStyle> = {};
let _customOfficerValues: Set<string> = new Set();

function _rebuildCustomCaches(): void {
  _customDisplayNames = {};
  _customBadgeTags = {};
  _customBadgeStyles = {};
  _customOfficerValues = new Set();

  for (const r of _customRoles) {
    _customDisplayNames[r.value] = r.displayName;
    _customBadgeTags[r.value] = r.badgeTag;
    _customBadgeStyles[r.value] = {
      badge: '', // not used for custom — we use inline styles via hex
      hex: r.hex,
      bgFull: '', // not used for custom — we use inline styles via hex
    };
    if (r.tier === 'officer') {
      _customOfficerValues.add(r.value);
    }
  }
}

// ── Role Groups ─────────────────────────────────────────────────────

/** Alias roles that grant officer-level access */
export const OFFICER_ROLES = ['admin', 'queen_of_hog'] as const;

/** The standard member permission role */
export const MEMBER_ROLE = 'member' as const;

/** Every valid built-in role value */
export const ALL_ROLES = ['owner', ...OFFICER_ROLES, MEMBER_ROLE, 'guest'] as const;

export type RoleValue = (typeof ALL_ROLES)[number];

// ── Permission Helpers ──────────────────────────────────────────────

/** Is this the site owner? (highest tier) */
export function isOwner(role: string | undefined | null): boolean {
  return role === 'owner';
}

/** Has officer powers? (officer + owner tier — can approve requests, admin panels) */
export function isOfficer(role: string | undefined | null): boolean {
  if (!role) return false;
  return role === 'owner'
    || (OFFICER_ROLES as readonly string[]).includes(role)
    || _customOfficerValues.has(role);
}

/** Is an onboarded member? (generic member tier — not officer, not owner) */
export function isMember(role: string | undefined | null): boolean {
  if (!role) return false;
  if (role === 'member') return true;
  // Custom roles with tier 'member'
  const custom = _customRoles.find(r => r.value === role);
  return custom?.tier === 'member';
}

/** Is a guest? (authenticated user without onboarding complete — NOT an access gate) */
export function isGuest(role: string | undefined | null): boolean {
  return role === 'guest';
}

/** Is authenticated? (any user with a valid role — ALL roles including guest and custom) */
export function isAuthenticated(role: string | undefined | null): boolean {
  if (!role) return false;
  if ((ALL_ROLES as readonly string[]).includes(role)) return true;
  return _customRoles.some(r => r.value === role);
}

/** Is onboarded? (any role except guest — member, officer, or owner) */
export function isOnboarded(role: string | undefined | null): boolean {
  if (!role) return false;
  return role !== 'guest' && isAuthenticated(role);
}

// ── Display Names ───────────────────────────────────────────────────

const DISPLAY_NAMES: Record<string, string> = {
  owner: 'Colonel Kernel',
  queen_of_hog: 'Queen Of Hog',
  admin: 'Cob Officer',
  member: 'Member',
  guest: 'Guest',
};

/** Full display name for a role (e.g. "Cob Officer") */
export function getRoleDisplayName(role: string): string {
  return DISPLAY_NAMES[role] || _customDisplayNames[role] || role.toUpperCase();
}

// ── Badge Tags (short labels for pills/badges) ─────────────────────

const BADGE_TAGS: Record<string, string> = {
  owner: 'OWN',
  queen_of_hog: 'QOH',
  admin: 'COB',
  member: 'MBR',
  guest: 'GUEST',
};

/** Short tag for role badges (e.g. "COB" for Cob Officer) */
export function getRoleBadgeTag(role: string): string {
  return BADGE_TAGS[role] || _customBadgeTags[role] || role.toUpperCase();
}

// ── Badge Colors ────────────────────────────────────────────────────

export interface RoleBadgeStyle {
  /** Tailwind classes for pill/badge background, text, border */
  badge: string;
  /** Hex color for the role (used in inline icon coloring) */
  hex: string;
  /** Tailwind gradient or solid bg for full-width badges */
  bgFull: string;
}

const BADGE_STYLES: Record<string, RoleBadgeStyle> = {
  owner: {
    badge: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30',
    hex: '#f59e0b',
    bgFull: 'bg-gradient-to-r from-harvest to-amber',
  },
  queen_of_hog: {
    badge: 'bg-[#ec4899]/10 text-[#ec4899] border-[#ec4899]/30',
    hex: '#ec4899',
    bgFull: 'bg-[#ec4899]',
  },
  admin: {
    badge: 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30',
    hex: '#3b82f6',
    bgFull: 'bg-[#3b82f6]',
  },
  member: {
    badge: 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30',
    hex: '#10b981',
    bgFull: 'bg-[#10b981]',
  },
  guest: {
    badge: 'bg-field-dark/5 text-field-dark/40 border-field-dark/10',
    hex: '#6b7280',
    bgFull: 'bg-field-dark/10',
  },
};

const DEFAULT_STYLE: RoleBadgeStyle = {
  badge: 'bg-[#6b7280]/10 text-[#6b7280] border-[#6b7280]/30',
  hex: '#6b7280',
  bgFull: 'bg-[#6b7280]',
};

export function getRoleBadgeStyle(role: string): RoleBadgeStyle {
  if (BADGE_STYLES[role]) return BADGE_STYLES[role];
  // For custom roles, return a style built from their hex color
  const custom = _customBadgeStyles[role];
  if (custom) return custom;
  return DEFAULT_STYLE;
}

/** Get the hex color for any role — works for built-in + custom + unknown */
export function getRoleHex(role: string): string {
  return BADGE_STYLES[role]?.hex || _customBadgeStyles[role]?.hex || '#6b7280';
}

// ── Dropdown Options (for admin role-change selects) ────────────────

export interface RoleOption {
  value: string;
  label: string;
}

/** Built-in ordered list of roles for dropdown selects */
const BUILT_IN_ROLE_OPTIONS: RoleOption[] = [
  { value: 'guest', label: 'Guest' },
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Cob Officer' },
  { value: 'queen_of_hog', label: 'Queen Of Hog' },
  { value: 'owner', label: 'Colonel Kernel' },
];

/** Full ordered list of roles for dropdown selects (built-in + custom) */
export function getRoleOptions(): RoleOption[] {
  const customs: RoleOption[] = _customRoles.map(r => ({
    value: r.value,
    label: `${r.displayName} (${r.tier === 'officer' ? 'Officer' : 'Member'})`,
  }));
  // Insert custom member roles after built-in member but before officers
  const memberIndex = BUILT_IN_ROLE_OPTIONS.findIndex(o => o.value === 'member');
  const result = [...BUILT_IN_ROLE_OPTIONS];
  result.splice(memberIndex + 1, 0, ...customs);
  return result;
}

/** Ordered list of roles for filter dropdowns (includes "All") */
export function getRoleFilterOptions(): RoleOption[] {
  return [
    { value: 'all', label: 'All Roles' },
    ...getRoleOptions(),
  ];
}

// Keep legacy exports for backward compat (static snapshot — prefer functions above)
export const ROLE_OPTIONS = BUILT_IN_ROLE_OPTIONS;
export const ROLE_FILTER_OPTIONS: RoleOption[] = [
  { value: 'all', label: 'All Roles' },
  ...BUILT_IN_ROLE_OPTIONS,
];
