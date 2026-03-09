/**
 * Inbox & Activity Type Configs — Config-driven display mapping
 *
 * Maps type slugs to display properties (icon, label, color).
 * Two separate configs:
 *   - NOTIFICATION_TYPE_CONFIG: for inbox notifications (things sent TO user)
 *   - ACTIVITY_TYPE_CONFIG: for user activity entries (things user DID or done TO user)
 *
 * To add a new type: add an entry here. The UI picks it up automatically.
 */

// ── Notification type display config (inbox items) ───────────────────

export interface TypeDisplayConfig {
  label: string;
  icon: string;   // lucide icon name
  color: string;  // hex color
}

export const NOTIFICATION_TYPE_CONFIG: Record<string, TypeDisplayConfig> = {
  team_invite:       { label: 'Team Invite',       icon: 'UserPlus',    color: '#8b5cf6' },
  coach_invite:      { label: 'Coaching Invite',   icon: 'GraduationCap', color: '#10b981' },
  coach_invite_accepted: { label: 'Coach Accepted', icon: 'CheckCircle', color: '#10b981' },
  team_approved:     { label: 'Team Approved',      icon: 'CheckCircle', color: '#10b981' },
  team_denied:       { label: 'Team Denied',        icon: 'XCircle',     color: '#ef4444' },
  team_disbanded:    { label: 'Team Disbanded',     icon: 'Users',       color: '#ef4444' },
  mvp_reviewed:      { label: 'MVP Review',         icon: 'Star',        color: '#f59e0b' },
  giveaway_prize:    { label: 'Giveaway Prize',     icon: 'Gift',        color: '#d6a615' },
  prize_fulfilled:   { label: 'Prize Fulfilled',    icon: 'PackageCheck', color: '#10b981' },
  rank_changed:      { label: 'Rank Changed',       icon: 'TrendingUp',  color: '#f59e0b' },
  role_removed:      { label: 'Role Removed',       icon: 'ShieldAlert', color: '#ef4444' },
  tournament_update: { label: 'Tournament',         icon: 'Trophy',      color: '#3b82f6' },
  staff_app_result:  { label: 'Staff App',          icon: 'Shield',      color: '#6366f1' },
  staff_removed:     { label: 'Removed from Staff', icon: 'UserMinus',   color: '#ef4444' },
  staff_app_dismissed: { label: 'Staff Dismissed',  icon: 'ShieldAlert', color: '#ef4444' },
  admin_action:      { label: 'Admin Action',       icon: 'ShieldAlert', color: '#f59e0b' },
  system:            { label: 'System',             icon: 'Bell',        color: '#6b7280' },
  master_team_captain_received: { label: 'Captain Received', icon: 'Crown', color: '#f59e0b' },
  purchase_confirmed:   { label: 'Purchase Confirmed', icon: 'ShoppingBag', color: '#10b981' },
  punchcard_bonus:      { label: 'Punchcard Bonus',    icon: 'Gift',        color: '#d6a615' },
  tcf_plus_activated:   { label: 'TCF+ Activated',     icon: 'Crown',       color: '#d6a615' },
  tcf_plus_cancelled:   { label: 'TCF+ Cancelled',     icon: 'Crown',       color: '#ef4444' },
  tcf_plus_cancellation_scheduled: { label: 'TCF+ Cancelling', icon: 'Clock', color: '#f59e0b' },
  tcf_plus_reactivated: { label: 'TCF+ Reactivated',   icon: 'Crown',       color: '#10b981' },
  payment_failed:       { label: 'Payment Failed',     icon: 'AlertCircle', color: '#ef4444' },
  prize_awarded:        { label: 'Prize Awarded',      icon: 'DollarSign',  color: '#d6a615' },
  prize_paid:           { label: 'Prize Paid',         icon: 'Banknote',    color: '#10b981' },
  prize_revoked:        { label: 'Prize Revoked',      icon: 'XCircle',     color: '#ef4444' },
};

// ── Activity type display config (personal audit trail) ──────────────

export const ACTIVITY_TYPE_CONFIG: Record<string, TypeDisplayConfig> = {
  // User-initiated actions
  team_created:             { label: 'Team Created',           icon: 'Users',        color: '#8b5cf6' },
  team_joined:              { label: 'Joined Team',            icon: 'UserPlus',     color: '#10b981' },
  team_left:                { label: 'Left Team',              icon: 'UserMinus',    color: '#ef4444' },
  team_disbanded:           { label: 'Team Disbanded',         icon: 'Users',        color: '#ef4444' },
  team_invite_sent:         { label: 'Invite Sent',            icon: 'Send',         color: '#8b5cf6' },
  team_invite_accepted:     { label: 'Invite Accepted',        icon: 'CheckCircle',  color: '#10b981' },
  team_invite_declined:     { label: 'Invite Declined',        icon: 'XCircle',      color: '#ef4444' },
  team_invite_cancelled:    { label: 'Invite Cancelled',       icon: 'XCircle',      color: '#6b7280' },
  coach_invite_sent:        { label: 'Coach Invite Sent',      icon: 'GraduationCap', color: '#10b981' },
  coach_invite_accepted:    { label: 'Coach Accepted',         icon: 'GraduationCap', color: '#10b981' },
  coach_invite_declined:    { label: 'Coach Declined',         icon: 'XCircle',      color: '#ef4444' },
  tournament_registered:    { label: 'Registered',             icon: 'Trophy',       color: '#3b82f6' },
  tournament_unregistered:  { label: 'Unregistered',           icon: 'LogOut',       color: '#ef4444' },
  tournament_role_chosen:   { label: 'Path Chosen',            icon: 'Compass',      color: '#d6a615' },
  early_access_registered:  { label: 'Early Access Registered', icon: 'Crown',       color: '#d6a615' },
  giveaway_entered:         { label: 'Entered Giveaway',       icon: 'Gift',         color: '#d6a615' },
  giveaway_withdrawn:       { label: 'Withdrew from Giveaway', icon: 'Undo2',        color: '#ef4444' },
  mvp_submitted:            { label: 'MVP Submitted',          icon: 'Star',         color: '#f59e0b' },
  mvp_cancelled:            { label: 'MVP Cancelled',          icon: 'XCircle',      color: '#ef4444' },
  staff_applied:            { label: 'Staff Applied',          icon: 'Shield',       color: '#6366f1' },
  staff_app_withdrawn:      { label: 'Staff App Withdrawn',    icon: 'Undo2',        color: '#ef4444' },
  steam_linked:             { label: 'Steam Linked',           icon: 'Link',         color: '#3b82f6' },
  rank_self_reported:       { label: 'Rank Self-Reported',     icon: 'Shield',       color: '#3b82f6' },
  rank_officer_override:    { label: 'Rank Set by Officer',   icon: 'ShieldCheck',  color: '#f59e0b' },
  profile_updated:          { label: 'Profile Updated',        icon: 'UserCog',      color: '#6b7280' },

  // User lifecycle milestones
  account_created:          { label: 'Joined The Corn Field',  icon: 'Sprout',       color: '#10b981' },
  guild_joined:             { label: 'Joined Guild',           icon: 'Flag',         color: '#8b5cf6' },
  onboarding_reward:        { label: 'Onboarding Rank-Up',     icon: 'Gift',         color: '#d6a615' },

  // Inbox responses (created when user actions/dismisses inbox items)
  notification_dismissed:   { label: 'Dismissed',              icon: 'Archive',      color: '#6b7280' },

  // Admin actions done TO user
  admin_rank_change:        { label: 'Rank Changed',           icon: 'TrendingUp',   color: '#f59e0b' },
  admin_role_change:        { label: 'Role Changed',           icon: 'ShieldAlert',  color: '#6366f1' },
  admin_role_removed:       { label: 'Role Removed',           icon: 'ShieldOff',    color: '#ef4444' },
  admin_manual_action:      { label: 'Admin Action',           icon: 'Wrench',       color: '#f59e0b' },
  admin_team_approved:      { label: 'Team Approved',          icon: 'CheckCircle',  color: '#10b981' },
  admin_team_denied:        { label: 'Team Denied',            icon: 'XCircle',      color: '#ef4444' },
  admin_staff_approved:     { label: 'Staff Approved',         icon: 'ShieldCheck',  color: '#10b981' },
  admin_staff_denied:       { label: 'Staff Denied',           icon: 'ShieldX',      color: '#ef4444' },

  // Dismiss actions (silently removed, no denial notification)
  team_dismissed:           { label: 'Team Dismissed',         icon: 'Trash2',       color: '#6b7280' },
  team_deleted:             { label: 'Team Deleted',           icon: 'Trash2',       color: '#ef4444' },
  staff_app_dismissed:      { label: 'Staff App Dismissed',    icon: 'Trash2',       color: '#6b7280' },
  mvp_dismissed:            { label: 'MVP Dismissed',          icon: 'Trash2',       color: '#6b7280' },

  // Captain promotion (auto-promoted when previous captain withdraws)
  captain_promoted:         { label: 'Captain Promoted',       icon: 'Crown',        color: '#f59e0b' },

  // Team ticket / ready system
  team_ready:               { label: 'Team Locked In',         icon: 'Lock',         color: '#d6a615' },

  // Master team management
  master_team_created:              { label: 'Team Created',           icon: 'Shield',       color: '#8b5cf6' },
  master_team_edited:               { label: 'Team Edited',            icon: 'Pencil',       color: '#3b82f6' },
  master_team_deleted:              { label: 'Team Deleted',           icon: 'Trash2',       color: '#ef4444' },
  master_team_captain_transferred:  { label: 'Captain Transferred',    icon: 'ArrowRightLeft', color: '#f59e0b' },

  // Stripe / Secret Shop purchases
  tickets_purchased:            { label: 'Tickets Purchased',      icon: 'Ticket',       color: '#3b82f6' },
  tcf_plus_subscribed:          { label: 'Subscribed to TCF+',     icon: 'Crown',        color: '#d6a615' },
  tcf_plus_renewed:             { label: 'TCF+ Renewed',           icon: 'Crown',        color: '#d6a615' },
  tcf_plus_cancelled:           { label: 'TCF+ Cancelled',         icon: 'Crown',        color: '#ef4444' },
  tcf_plus_cancellation_scheduled: { label: 'TCF+ Cancelling',     icon: 'Clock',        color: '#f59e0b' },
  tcf_plus_reactivated:         { label: 'TCF+ Reactivated',       icon: 'Crown',        color: '#10b981' },
  donation_made:                { label: 'Donation',               icon: 'Heart',        color: '#10b981' },
  prize_pool_donated:           { label: 'Prize Pool Donation',    icon: 'Trophy',       color: '#f59e0b' },

  // Future — ready to go when integrations land
  shop_order_placed:        { label: 'Order Placed',           icon: 'ShoppingBag',  color: '#10b981' },
  payment_completed:        { label: 'Payment',                icon: 'CreditCard',   color: '#10b981' },

  // Cooks n Cobs recipes
  recipe_created:           { label: 'Recipe Published',       icon: 'ChefHat',      color: '#d6a615' },
  recipe_updated:           { label: 'Recipe Updated',         icon: 'ChefHat',      color: '#3b82f6' },
  recipe_deleted:           { label: 'Recipe Deleted',         icon: 'ChefHat',      color: '#ef4444' },

  // Prize awards (Money OUT)
  prize_awarded:            { label: 'Prize Awarded',          icon: 'DollarSign',   color: '#d6a615' },
  prize_accepted:           { label: 'Prize Accepted',         icon: 'CheckCircle',  color: '#10b981' },
  prize_declined:           { label: 'Prize Declined',         icon: 'XCircle',      color: '#ef4444' },
  prize_paid:               { label: 'Prize Paid',             icon: 'Banknote',     color: '#10b981' },
  prize_revoked:            { label: 'Prize Revoked',          icon: 'XCircle',      color: '#ef4444' },
};

// ── Fallback config ──────────────────────────────────────────────────

const FALLBACK_CONFIG: TypeDisplayConfig = {
  label: 'Activity',
  icon: 'Bell',
  color: '#6b7280',
};

export function getNotificationConfig(type: string): TypeDisplayConfig {
  return NOTIFICATION_TYPE_CONFIG[type] || FALLBACK_CONFIG;
}

export function getActivityConfig(type: string): TypeDisplayConfig {
  return ACTIVITY_TYPE_CONFIG[type] || FALLBACK_CONFIG;
}