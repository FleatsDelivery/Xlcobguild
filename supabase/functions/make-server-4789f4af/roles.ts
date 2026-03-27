/**
 * Role Configuration — Server-side built-in role helpers.
 *
 * These hardcoded arrays provide fast, synchronous permission checks for
 * the built-in roles. Custom roles are managed via the `roles` database
 * table and validated dynamically in routes-admin-roles.ts.
 *
 * Keep in sync with /src/lib/roles.ts on the frontend.
 *
 * Permission tiers: owner > officer > member > guest
 * ALL authenticated users (including guests) have full app access.
 * Guests are simply users without guild affiliation.
 *
 * IMPORTANT: As of Guild Wars migration, `role` is PURELY a permission tier.
 * Guild affiliation is stored in `users.guild_id` → `guild_wars_guilds`.
 *   owner         → Colonel Kernel   → owner tier
 *   admin         → Cob Officer      → officer tier
 *   queen_of_hog  → Queen Of Hog     → officer tier
 *   member        → Member           → member tier (generic onboarded user)
 *   guest         → Guest            → guest tier (not yet onboarded)
 */

/** Alias roles that grant officer-level access */
export const OFFICER_ROLES = ['admin', 'queen_of_hog'] as const;

/** The standard member permission role (onboarded user) */
export const MEMBER_ROLE = 'member' as const;

/** Every valid role value that can exist in the database */
export const ALL_ROLES = ['owner', ...OFFICER_ROLES, MEMBER_ROLE, 'guest'] as const;

/** Is this the site owner? */
export function isOwner(role: string | undefined | null): boolean {
  return role === 'owner';
}

/** Has officer powers? (officer + owner tier) */
export function isOfficer(role: string | undefined | null): boolean {
  if (!role) return false;
  return role === 'owner' || (OFFICER_ROLES as readonly string[]).includes(role);
}

/** Is an onboarded member? (not guest, not officer, not owner — the generic member tier) */
export function isMember(role: string | undefined | null): boolean {
  return role === 'member';
}

/** Is a guest? (identification only — NOT an access gate) */
export function isGuest(role: string): boolean {
  return role === 'guest';
}

/** Is authenticated? (any user with a valid role — ALL roles including guest) */
export function isAuthenticated(role: string): boolean {
  return (ALL_ROLES as readonly string[]).includes(role);
}

/** Is this a valid role value for the database? */
export function isValidRole(role: string): boolean {
  return (ALL_ROLES as readonly string[]).includes(role);
}