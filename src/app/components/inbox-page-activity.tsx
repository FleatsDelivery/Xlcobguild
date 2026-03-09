/**
 * Activity Tab — Personal audit trail
 *
 * Shows everything the user has done: actions they initiated, inbox responses,
 * and admin actions performed on them. Read-only timeline.
 *
 * Receives all data via props from the orchestrator (inbox-page.tsx).
 */
import { useMemo, useState } from 'react';
import {
  Activity, Bell, Loader2, Filter, ChevronDown,
  UserPlus, UserMinus, CheckCircle, XCircle, Star, Gift, Trophy, Shield,
  Archive, Link, Users, Send, LogOut, Undo2, ShieldAlert, Wrench,
  TrendingUp, ShoppingBag, CreditCard, UserCog, ExternalLink, Snowflake,
  Info, X, DollarSign, Banknote,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { timeAgo } from '@/lib/date-utils';
import { getActivityConfig, type TypeDisplayConfig } from '@/app/components/inbox-activity-config';

// ── Types ────────────────────────────────────────────────────────────

export interface UserActivityEntry {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description: string;
  related_id?: string;
  related_url?: string;
  actor_name?: string;
  actor_avatar?: string;
  metadata?: Record<string, any>;
  frozen?: boolean;
  created_at: string;
}

// ── Icon map ───────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Activity, Bell, UserPlus, UserMinus, CheckCircle, XCircle, Star, Gift,
  Trophy, Shield, Archive, Link, Users, Send, LogOut, Undo2, ShieldAlert,
  Wrench, TrendingUp, ShoppingBag, CreditCard, UserCog, ExternalLink, Filter,
  Snowflake, DollarSign, Banknote,
};

function getIcon(iconName: string): React.ElementType {
  return ICON_MAP[iconName] || Bell;
}

// ── Props ────────────────────────────────────────────────────────────

interface ActivityTabProps {
  activities: UserActivityEntry[];
  typeCounts: Record<string, number>;
  typeFilter: string | null;
  onTypeFilter: (type: string | null) => void;
  onToggleFreeze: (activityId: string) => void;
  freezingIds: Set<string>;
  loading: boolean;
  refreshing?: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function ActivityTab({
  activities,
  typeCounts,
  typeFilter,
  onTypeFilter,
  onToggleFreeze,
  freezingIds,
  loading,
  refreshing,
  hasMore,
  loadingMore,
  onLoadMore,
}: ActivityTabProps) {
  const [showInfoBanner, setShowInfoBanner] = useState(() => {
    return localStorage.getItem('tcf_activity_info_dismissed') !== 'true';
  });

  const dismissInfoBanner = () => {
    setShowInfoBanner(false);
    localStorage.setItem('tcf_activity_info_dismissed', 'true');
  };

  // Filter by type if active
  const filteredActivities = useMemo(() => {
    let result = typeFilter ? activities.filter(a => a.type === typeFilter) : [...activities];
    // Ensure newest-first chronological order
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
  }, [activities, typeFilter]);

  // Available types for pills
  const presentTypes = useMemo(() => {
    return Object.keys(typeCounts).sort();
  }, [typeCounts]);

  // Group activities by date for the timeline
  const groupedActivities = useMemo(() => {
    const groups: { label: string; items: UserActivityEntry[] }[] = [];
    let currentLabel = '';

    for (const activity of filteredActivities) {
      const date = new Date(activity.created_at);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

      let label: string;
      if (diffDays === 0) label = 'Today';
      else if (diffDays === 1) label = 'Yesterday';
      else if (diffDays < 7) label = 'This Week';
      else if (diffDays < 30) label = 'This Month';
      else label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      if (label !== currentLabel) {
        groups.push({ label, items: [] });
        currentLabel = label;
      }
      groups[groups.length - 1].items.push(activity);
    }

    return groups;
  }, [filteredActivities]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-harvest" />
        <p className="font-semibold">Loading activity...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Pruning & freeze info banner */}
      {showInfoBanner && filteredActivities.length > 0 && (
        <div className="flex items-start gap-3 bg-[#38bdf8]/8 border border-[#38bdf8]/20 rounded-xl px-4 py-3 mb-5">
          <Snowflake className="w-4 h-4 text-[#38bdf8] mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">Your activity auto-cleans</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Entries older than 90 days or beyond your last 500 are automatically removed.
              Hover any entry and click the <Snowflake className="w-3 h-3 inline-block text-[#38bdf8] -mt-0.5" /> to freeze it — frozen entries are kept forever.
            </p>
          </div>
          <button
            onClick={dismissInfoBanner}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Type filter pills */}
      {presentTypes.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          <button
            onClick={() => onTypeFilter(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              !typeFilter
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            All
          </button>
          {presentTypes.map(type => {
            const cfg = getActivityConfig(type);
            const count = typeCounts[type] || 0;
            return (
              <button
                key={type}
                onClick={() => onTypeFilter(typeFilter === type ? null : type)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  typeFilter === type
                    ? 'text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                style={typeFilter === type ? { backgroundColor: cfg.color } : undefined}
              >
                {cfg.label}
                {count > 0 && (
                  <span className={`text-[10px] px-1 py-0 rounded-full min-w-[14px] text-center ${
                    typeFilter === type ? 'bg-white/25' : 'bg-foreground/10'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {filteredActivities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          {typeFilter ? (
            <>
              <Filter className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-bold text-foreground/60">No matching activity</p>
              <p className="text-sm mt-1">Try removing the filter to see all activity.</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Activity className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="font-bold text-foreground/60 text-lg">No activity yet</p>
              <p className="text-sm mt-1 max-w-xs text-center">
                Your activity log will build up as you join teams, enter giveaways, register for tournaments, and interact with the guild.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedActivities.map(group => (
            <div key={group.label}>
              {/* Date section header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Timeline entries */}
              <div className="space-y-1">
                {group.items.map(activity => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onToggleFreeze={onToggleFreeze}
                    isFreezing={freezingIds.has(activity.id)}
                  />
                ))}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="pt-4 text-center">
              <Button
                onClick={onLoadMore}
                disabled={loadingMore}
                className="bg-muted hover:bg-muted/80 text-muted-foreground font-semibold rounded-xl"
              >
                {loadingMore
                  ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  : <ChevronDown className="w-4 h-4 mr-2" />}
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Activity Card ──────────────────────────────────────────────────

function ActivityCard({
  activity,
  onToggleFreeze,
  isFreezing,
}: {
  activity: UserActivityEntry;
  onToggleFreeze: (activityId: string) => void;
  isFreezing: boolean;
}) {
  const config = getActivityConfig(activity.type);
  const Icon = getIcon(config.icon);
  const hasLink = !!activity.related_url;
  const isFrozen = !!activity.frozen;

  const handleClick = () => {
    if (hasLink) {
      window.location.hash = activity.related_url!.replace('#', '');
    }
  };

  const handleFreeze = (e: React.MouseEvent) => {
    e.stopPropagation(); // don't navigate when clicking freeze
    onToggleFreeze(activity.id);
  };

  return (
    <div
      className={`group flex items-start gap-3 p-3 rounded-xl transition-colors ${
        hasLink ? 'cursor-pointer hover:bg-muted/50' : 'hover:bg-muted/30'
      }`}
      onClick={handleClick}
    >
      {/* Timeline dot + icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${config.color}15` }}
      >
        <Icon className="w-4 h-4" style={{ color: config.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {isFrozen && <Snowflake className="w-3.5 h-3.5 inline-block mr-1 text-[#38bdf8] -mt-0.5" />}
              {activity.title}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {activity.description}
            </p>
          </div>

          {/* Timestamp + freeze + link icons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {timeAgo(activity.created_at)}
            </span>
            <button
              onClick={handleFreeze}
              disabled={isFreezing}
              title={isFrozen ? 'Unfreeze — allow auto-cleanup' : 'Freeze — keep forever'}
              className={`p-1 rounded-md transition-all ${
                isFreezing
                  ? 'opacity-50 cursor-not-allowed'
                  : isFrozen
                    ? 'text-[#38bdf8] hover:bg-[#38bdf8]/10'
                    : 'text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-[#38bdf8] hover:bg-[#38bdf8]/10'
              }`}
            >
              {isFreezing
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Snowflake className="w-3.5 h-3.5" />
              }
            </button>
            {hasLink && (
              <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </div>

        {/* Actor badge (for admin actions) */}
        {activity.actor_name && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {activity.actor_avatar && (
              <img src={activity.actor_avatar} className="w-4 h-4 rounded-full" alt="" />
            )}
            <span className="text-[11px] text-muted-foreground">
              by {activity.actor_name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}