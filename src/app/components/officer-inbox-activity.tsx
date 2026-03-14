/**
 * Officer Inbox — Admin Activity Tab
 *
 * Shows the admin activity log: actions taken by officers/owners.
 * Receives all data via props from the orchestrator (officer-inbox-page.tsx).
 */
import { useMemo } from 'react';
import {
  Shield, AlertTriangle, CheckCircle, XCircle, UserCog, Crown, Trophy,
  Gift, FileText, LogIn, Users, DollarSign, Sparkles, Filter, Trash2,
  UserMinus, Lock, Star, ShieldAlert, Settings, TrendingUp, Upload, Wrench,
  Ticket, CalendarClock, Package, Banknote, Lightbulb, Bug,
  MessageSquare, GitBranch, Activity, Clock, Loader2, ArrowRight, UserPlus,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { timeAgo } from '@/lib/date-utils';

// ── Types ────────────────────────────────────────────────────────────

export interface AdminLogEntry {
  id: string;
  type: string;
  actor_id?: string;
  actor_name?: string;
  actor_avatar?: string;
  action: string;
  details?: Record<string, any>;
  created_at: string;
}

// ── Type display config ──────────────────────────────────────────────

const ADMIN_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  team_approved:      { label: 'Team Approved',      icon: CheckCircle, color: '#10b981' },
  team_denied:        { label: 'Team Denied',        icon: XCircle,     color: '#ef4444' },
  team_deleted:       { label: 'Team Deleted',       icon: Trash2,      color: '#ef4444' },
  team_dismissed:     { label: 'Team Dismissed',     icon: XCircle,     color: '#6b7280' },
  team_captain_promoted: { label: 'Captain Promoted', icon: Crown,      color: '#f59e0b' },
  team_withdrawn:     { label: 'Team Withdrawn',     icon: UserMinus,   color: '#ef4444' },
  team_disbanded:     { label: 'Team Disbanded',     icon: Users,       color: '#ef4444' },
  team_ready:         { label: 'Team Locked In',     icon: Lock,        color: '#d6a615' },
  staff_approved:     { label: 'Staff Approved',     icon: Shield,      color: '#10b981' },
  staff_denied:       { label: 'Staff Denied',       icon: Shield,      color: '#ef4444' },
  staff_dismissed:    { label: 'Staff Dismissed',    icon: Shield,      color: '#6b7280' },
  mvp_approved:       { label: 'MVP Approved',       icon: Star,        color: '#10b981' },
  mvp_denied:         { label: 'MVP Denied',         icon: Star,        color: '#ef4444' },
  mvp_dismissed:      { label: 'MVP Dismissed',      icon: Star,        color: '#6b7280' },
  role_change:        { label: 'Role Change',        icon: ShieldAlert, color: '#6366f1' },
  user_role_changed:  { label: 'Role Change',        icon: ShieldAlert, color: '#6366f1' },
  role_created:       { label: 'Role Created',       icon: Shield,      color: '#10b981' },
  role_updated:       { label: 'Role Updated',       icon: Settings,    color: '#3b82f6' },
  role_deleted:       { label: 'Role Deleted',       icon: Trash2,      color: '#ef4444' },
  rank_change:        { label: 'Rank Change',        icon: TrendingUp,  color: '#f59e0b' },
  direct_rank_change: { label: 'Direct Rank Change', icon: TrendingUp,  color: '#f59e0b' },
  tournament_created: { label: 'Tournament Created', icon: Trophy,      color: '#3b82f6' },
  tournament_config_updated: { label: 'Config Updated', icon: Settings, color: '#3b82f6' },
  tournament_status_changed: { label: 'Status Changed', icon: Trophy,   color: '#f59e0b' },
  tournament_deleted: { label: 'Tournament Deleted', icon: Trash2,      color: '#ef4444' },
  tournament_updated: { label: 'Tournament Updated', icon: Settings,    color: '#3b82f6' },
  giveaway_created:   { label: 'Giveaway Created',   icon: Gift,        color: '#d6a615' },
  giveaway_updated:   { label: 'Giveaway Updated',   icon: Gift,        color: '#3b82f6' },
  giveaway_deleted:   { label: 'Giveaway Deleted',   icon: Trash2,      color: '#ef4444' },
  giveaway_phase_changed: { label: 'Giveaway Phase', icon: Gift,        color: '#f59e0b' },
  giveaway_drawn:     { label: 'Giveaway Drawn',     icon: Gift,        color: '#10b981' },
  prize_fulfilled:    { label: 'Prize Fulfilled',    icon: Gift,        color: '#10b981' },
  giveaway_config_created: { label: 'Prize Type Created', icon: Gift,   color: '#10b981' },
  giveaway_config_updated: { label: 'Prize Type Updated', icon: Gift,   color: '#3b82f6' },
  giveaway_config_deleted: { label: 'Prize Type Deleted', icon: Trash2,  color: '#ef4444' },
  master_team_edited: { label: 'Team Edited',        icon: Settings,    color: '#3b82f6' },
  master_team_captain_transferred: { label: 'Captain Transfer', icon: Crown, color: '#f59e0b' },
  // Legacy KKup admin tools
  kkup_tournament_updated: { label: 'KKup Updated',    icon: Trophy,    color: '#3b82f6' },
  championship_awarded: { label: 'Championship',      icon: Trophy,      color: '#d6a615' },
  popd_kernel_awarded: { label: "Pop'd Kernel",       icon: Star,        color: '#d6a615' },
  // Data tools & imports
  data_enrich:        { label: 'Data Enrichment',     icon: Upload,      color: '#6366f1' },
  data_sync:          { label: 'Data Sync',           icon: Upload,      color: '#6366f1' },
  data_fix:           { label: 'Data Fix',            icon: Wrench,      color: '#f59e0b' },
  logo_update:        { label: 'Logo Update',         icon: Upload,      color: '#3b82f6' },
  match_imported:     { label: 'Match Imported',      icon: Upload,      color: '#6366f1' },
  tournament_imported: { label: 'Tournament Imported', icon: Upload,     color: '#6366f1' },
  csv_imported:       { label: 'CSV Import',          icon: Upload,      color: '#6366f1' },
  test_data_seeded:   { label: 'Test Data Seeded',    icon: Upload,      color: '#f59e0b' },
  test_data_cleaned:  { label: 'Test Data Cleaned',   icon: Trash2,      color: '#6b7280' },
  opendota_refresh_all: { label: 'OpenDota Refresh',  icon: Upload,      color: '#3b82f6' },
  rank_self_reported: { label: 'Rank Self-Reported', icon: TrendingUp,  color: '#f59e0b' },
  rank_officer_override: { label: 'Rank Override', icon: TrendingUp,  color: '#f59e0b' },
  // CRUD for legacy tournament data
  kkup_team_created:  { label: 'Team Created',        icon: Users,       color: '#10b981' },
  kkup_team_updated:  { label: 'Team Updated',        icon: Settings,    color: '#3b82f6' },
  kkup_team_deleted:  { label: 'Team Deleted',        icon: Trash2,      color: '#ef4444' },
  kkup_match_created: { label: 'Match Created',       icon: Trophy,      color: '#10b981' },
  kkup_match_updated: { label: 'Match Updated',       icon: Settings,    color: '#3b82f6' },
  kkup_match_deleted: { label: 'Match Deleted',       icon: Trash2,      color: '#ef4444' },
  kkup_player_created: { label: 'Player Created',     icon: UserPlus,    color: '#10b981' },
  kkup_roster_added:  { label: 'Roster Updated',      icon: UserPlus,    color: '#3b82f6' },
  kkup_roster_removed: { label: 'Roster Updated',     icon: UserMinus,   color: '#ef4444' },
  user_joined:        { label: 'User Joined',        icon: UserPlus,    color: '#3b82f6' },
  data_import:        { label: 'Data Import',        icon: Upload,      color: '#6366f1' },
  manual_action:      { label: 'Manual Action',      icon: Wrench,      color: '#f59e0b' },
  // Stripe / Secret Shop
  ticket_purchased:   { label: 'Ticket Purchased',    icon: Ticket,      color: '#10b981' },
  tcf_plus_new_subscriber: { label: 'New TCF+ Sub',  icon: Crown,       color: '#d6a615' },
  tcf_plus_cancellation_scheduled: { label: 'TCF+ Cancelling', icon: CalendarClock, color: '#f59e0b' },
  donation_received:  { label: 'Donation',            icon: Gift,        color: '#10b981' },
  prize_pool_donation: { label: 'Prize Pool Donation', icon: Trophy,     color: '#f59e0b' },
  merch_order:        { label: 'Merch Order',          icon: Package,     color: '#a855f7' },
  // Stripe Connect / Prize Awards (Money OUT)
  prize_awarded:      { label: 'Prize Awarded',        icon: DollarSign,  color: '#d6a615' },
  prize_accepted:     { label: 'Prize Accepted',       icon: CheckCircle, color: '#10b981' },
  prize_declined:     { label: 'Prize Declined',       icon: XCircle,     color: '#ef4444' },
  prize_disbursed:    { label: 'Prize Disbursed',      icon: Banknote,    color: '#10b981' },
  prize_revoked:      { label: 'Prize Revoked',        icon: XCircle,     color: '#ef4444' },
  // Cooks n Cobs recipes (officer actions)
  recipe_deleted:     { label: 'Recipe Deleted',       icon: Lightbulb,     color: '#ef4444' },
  recipe_featured:    { label: 'Recipe Featured',      icon: Lightbulb,     color: '#d6a615' },
  // Discord feedback commands
  suggestion:         { label: 'Suggestion',           icon: Lightbulb,   color: '#d6a615' },
  report_bug:         { label: 'Bug Report',           icon: Bug,         color: '#f59e0b' },
  report_player:      { label: 'Player Report',        icon: AlertTriangle, color: '#ef4444' },
  report_officer:     { label: 'Officer Report',       icon: ShieldAlert, color: '#ef4444' },
  report_other:       { label: 'Report',               icon: MessageSquare, color: '#6b7280' },
  // Bracket system
  bracket_generated:  { label: 'Bracket Generated',    icon: GitBranch,   color: '#10b981' },
  bracket_deleted:    { label: 'Bracket Deleted',      icon: GitBranch,   color: '#ef4444' },
  series_result_recorded: { label: 'Series Result',    icon: GitBranch,   color: '#d6a615' },
};

const FALLBACK_CONFIG = { label: 'Action', icon: Activity, color: '#6b7280' };

// ── Props ────────────────────────────────────────────────────────────

interface OfficerActivityTabProps {
  entries: AdminLogEntry[];
  typeCounts: Record<string, number>;
  typeFilter: string | null;
  onTypeFilter: (type: string | null) => void;
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function OfficerActivityTab({
  entries,
  typeCounts,
  typeFilter,
  onTypeFilter,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
}: OfficerActivityTabProps) {

  const filtered = useMemo(() => {
    let result = typeFilter ? entries.filter(e => e.type === typeFilter) : [...entries];
    // Ensure newest-first chronological order
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
  }, [entries, typeFilter]);

  // ── Render ──

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-harvest" />
        <p className="font-semibold">Loading admin activity...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Type filter pills */}
      {Object.keys(typeCounts).length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => onTypeFilter(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              !typeFilter
                ? 'bg-harvest/15 border-harvest/30 text-harvest'
                : 'bg-muted border-border text-muted-foreground hover:text-foreground hover:border-harvest/20'
            }`}
          >
            All ({entries.length})
          </button>
          {Object.entries(typeCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8)
            .map(([type, count]) => {
              const config = ADMIN_TYPE_CONFIG[type] || FALLBACK_CONFIG;
              return (
                <button
                  key={type}
                  onClick={() => onTypeFilter(typeFilter === type ? null : type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
                    typeFilter === type
                      ? 'bg-harvest/15 border-harvest/30 text-harvest'
                      : 'bg-muted border-border text-muted-foreground hover:text-foreground hover:border-harvest/20'
                  }`}
                >
                  <config.icon className="w-3 h-3" />
                  {config.label} ({count})
                </button>
              );
          })}
        </div>
      )}

      {/* Activity timeline */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Activity className="w-12 h-12 mb-3 opacity-40" />
          <p className="font-bold text-lg">No admin activity yet</p>
          <p className="text-sm mt-1">Officer actions will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry, index) => (
            <div key={entry.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}>
              <AdminActivityCard entry={entry} />
            </div>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={onLoadMore}
                disabled={loadingMore}
                className="bg-muted hover:bg-muted/80 text-muted-foreground font-bold text-xs rounded-xl h-9 px-6"
              >
                {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                {loadingMore ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── Individual Activity Card ─────────────────────────────────────────

function AdminActivityCard({ entry }: { entry: AdminLogEntry }) {
  const config = ADMIN_TYPE_CONFIG[entry.type] || FALLBACK_CONFIG;
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 bg-card rounded-xl border border-border p-3 hover:border-harvest/20 transition-all group">
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${config.color}15` }}
      >
        <Icon className="w-4 h-4" style={{ color: config.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug">
          {entry.action}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          {entry.actor_name && (
            <span className="flex items-center gap-1">
              {entry.actor_avatar && (
                <img src={entry.actor_avatar} alt="" className="w-3.5 h-3.5 rounded-full" />
              )}
              <span className="font-semibold">{entry.actor_name}</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(entry.created_at)}
          </span>
        </div>
      </div>

      {/* Type badge */}
      <span
        className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 self-center"
        style={{ backgroundColor: `${config.color}15`, color: config.color }}
      >
        {config.label}
      </span>
    </div>
  );
}