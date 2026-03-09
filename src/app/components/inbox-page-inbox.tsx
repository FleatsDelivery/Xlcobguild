/**
 * Inbox Tab — Pending notifications requiring user attention
 *
 * Receives all data via props from the orchestrator (inbox-page.tsx).
 * Uses Motion for smooth card exit/layout animations.
 */
import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Inbox, Bell, Loader2, CheckCircle, XCircle, Filter,
  UserPlus, Star, Gift, Trophy, Shield, ExternalLink,
  Archive, Eye, Trash2, ArrowRight, ShieldAlert, Activity,
  GraduationCap, AlertTriangle, DollarSign, Banknote,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { timeAgo } from '@/lib/date-utils';
import { getNotificationConfig, type TypeDisplayConfig } from '@/app/components/inbox-activity-config';

// ── Types (shared with orchestrator) ─────────────────────────────────

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  status: 'unread' | 'read' | 'actioned' | 'dismissed';
  related_id?: string;
  action_url?: string;
  actor_name?: string;
  actor_avatar?: string;
  metadata?: Record<string, any>;
  created_at: string;
  read_at?: string;
}

// ── Types for action results (shared with orchestrator) ─────────────

export interface ActionResult {
  status: 'accepted' | 'declined' | 'stale' | 'error';
  message: string;
}

// ── Icon map ─────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  UserPlus, CheckCircle, XCircle, Star, Gift, Trophy, Shield, Bell,
  Activity, Inbox, Archive, Eye, Filter, ExternalLink, ShieldAlert,
  GraduationCap, DollarSign, Banknote,
};

function getIcon(iconName: string): React.ElementType {
  return ICON_MAP[iconName] || Bell;
}

// ── Result overlay config ────────────────────────────────────────────

const RESULT_CONFIGS = {
  accepted: { icon: CheckCircle, color: '#10b981', bg: '#10b98118', border: '#10b98140' },
  declined: { icon: XCircle, color: '#6b7280', bg: '#6b728018', border: '#6b728040' },
  stale:    { icon: AlertTriangle, color: '#f59e0b', bg: '#f59e0b18', border: '#f59e0b40' },
  error:    { icon: AlertTriangle, color: '#ef4444', bg: '#ef444418', border: '#ef444440' },
} as const;

// ── Props ────────────────────────────────────────────────────────────

interface InboxTabProps {
  notifications: Notification[];
  unreadCount: number;
  unreadTypeCounts: Record<string, number>;
  typeFilter: string | null;
  onTypeFilter: (type: string | null) => void;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onAction: (n: Notification) => void;
  onInviteAction: (n: Notification, action: 'accepted' | 'declined') => void;
  onPrizeAction: (n: Notification, action: 'accepted' | 'declined') => void;
  actioningId: string | null;
  actionResults: Map<string, ActionResult>;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function InboxTab({
  notifications,
  unreadCount,
  unreadTypeCounts,
  typeFilter,
  onTypeFilter,
  onMarkRead,
  onDismiss,
  onAction,
  onInviteAction,
  onPrizeAction,
  actioningId,
  actionResults,
  hasMore,
  loadingMore,
  onLoadMore,
}: InboxTabProps) {
  // Only show pending items (unread + read, not dismissed/actioned)
  const pendingNotifs = useMemo(() => {
    let filtered = notifications.filter(n => n.status === 'unread' || n.status === 'read');
    if (typeFilter) {
      filtered = filtered.filter(n => n.type === typeFilter);
    }
    // Ensure newest-first chronological order
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return filtered;
  }, [notifications, typeFilter]);

  // Available types for filter pills
  const presentTypes = useMemo(() => {
    const types = new Set(
      notifications
        .filter(n => n.status === 'unread' || n.status === 'read')
        .map(n => n.type)
    );
    return Array.from(types).sort();
  }, [notifications]);

  return (
    <div>
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
            const cfg = getNotificationConfig(type);
            const count = unreadTypeCounts[type] || 0;
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
      {pendingNotifs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-20 text-muted-foreground"
        >
          {typeFilter ? (
            <>
              <Filter className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-bold text-foreground/60">No matching notifications</p>
              <p className="text-sm mt-1">Try removing the filter to see all notifications.</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-harvest/10 flex items-center justify-center mb-4">
                <Inbox className="w-8 h-8 text-harvest" />
              </div>
              <p className="font-bold text-foreground/60 text-lg">All caught up!</p>
              <p className="text-sm mt-1 max-w-xs text-center">
                When you receive team invites, MVP results, giveaway wins, or other notifications, they'll appear here.
              </p>
            </>
          )}
        </motion.div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {pendingNotifs.map(notif => (
              <motion.div
                key={notif.id}
                layout
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  x: -30,
                  scale: 0.95,
                  height: 0,
                  marginBottom: 0,
                  transition: {
                    opacity: { duration: 0.2 },
                    x: { duration: 0.25, ease: 'easeIn' },
                    scale: { duration: 0.25 },
                    height: { duration: 0.3, delay: 0.05, ease: [0.32, 0, 0.67, 0] },
                    marginBottom: { duration: 0.3, delay: 0.05 },
                  },
                }}
                transition={{
                  layout: { type: 'spring', stiffness: 500, damping: 35 },
                  opacity: { duration: 0.2 },
                  y: { duration: 0.25 },
                  scale: { duration: 0.2 },
                }}
                style={{ overflow: 'hidden' }}
              >
                <NotificationCard
                  notification={notif}
                  config={getNotificationConfig(notif.type)}
                  onMarkRead={onMarkRead}
                  onDismiss={onDismiss}
                  onAction={onAction}
                  onInviteAction={onInviteAction}
                  onPrizeAction={onPrizeAction}
                  actioningId={actioningId}
                  actionResult={actionResults.get(notif.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {hasMore && (
            <div className="pt-4 text-center">
              <Button
                onClick={onLoadMore}
                disabled={loadingMore}
                className="bg-muted hover:bg-muted/80 text-muted-foreground font-semibold rounded-xl"
              >
                {loadingMore
                  ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  : <ArrowRight className="w-4 h-4 mr-2" />}
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Notification Card ──────────────────────────────────────────────

function NotificationCard({
  notification: n,
  config,
  onMarkRead,
  onDismiss,
  onAction,
  onInviteAction,
  onPrizeAction,
  actioningId,
  actionResult,
}: {
  notification: Notification;
  config: TypeDisplayConfig;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onAction: (n: Notification) => void;
  onInviteAction: (n: Notification, action: 'accepted' | 'declined') => void;
  onPrizeAction: (n: Notification, action: 'accepted' | 'declined') => void;
  actioningId: string | null;
  actionResult?: ActionResult;
}) {
  const Icon = getIcon(config.icon);
  const isUnread = n.status === 'unread';
  const isActioned = n.status === 'actioned';
  const hasAction = !!n.action_url;
  const isTeamInvite = (n.type === 'team_invite' || n.type === 'coach_invite') && !isActioned;
  const isPrizeAward = n.type === 'prize_awarded' && !isActioned;
  const hasInlineActions = isTeamInvite || isPrizeAward;
  const isActioning = actioningId === n.id;
  const hasResult = !!actionResult;

  const resultCfg = actionResult ? RESULT_CONFIGS[actionResult.status] : null;

  return (
    <div className="relative">
      {/* ── Result overlay (cross-fades in over the card) ── */}
      <AnimatePresence>
        {hasResult && resultCfg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-10 rounded-2xl border-2 flex items-center"
            style={{
              backgroundColor: resultCfg.bg,
              borderColor: resultCfg.border,
            }}
          >
            <div className="p-4 flex items-center gap-3 w-full">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.05 }}
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${resultCfg.color}20` }}
              >
                <resultCfg.icon className="w-5 h-5" style={{ color: resultCfg.color }} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: 0.08 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-bold text-foreground truncate">{actionResult!.message}</p>
                {actionResult!.status !== 'error' && (
                  <p className="text-xs text-muted-foreground mt-0.5">Moved to Activity</p>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Normal card content ── */}
      <div
        className={`group bg-card rounded-2xl border-2 transition-colors duration-200 ${
          isUnread
            ? 'border-harvest/30 shadow-sm'
            : 'border-border hover:border-border/80'
        } ${hasAction && !hasInlineActions ? 'cursor-pointer hover:border-harvest/40' : ''} ${
          hasResult ? 'invisible' : ''
        }`}
        onClick={() => hasAction && !hasInlineActions && onAction(n)}
      >
        <div className="p-4 flex items-start gap-3.5">
          {/* Icon badge */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${config.color}15` }}
          >
            <Icon className="w-5 h-5" style={{ color: config.color }} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className={`text-sm truncate ${isUnread ? 'font-bold text-foreground' : 'font-semibold text-foreground/80'}`}>
                    {n.title}
                  </h4>
                  {isUnread && (
                    <div className="w-2 h-2 rounded-full bg-harvest flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm leading-relaxed line-clamp-2 text-muted-foreground">
                  {n.body}
                </p>
              </div>
            </div>

            {/* Inline team invite actions */}
            {isTeamInvite && (
              <div className="flex items-center gap-2 mt-3" onClick={e => e.stopPropagation()}>
                <Button
                  onClick={() => onInviteAction(n, 'accepted')}
                  disabled={isActioning}
                  className="bg-[#10b981] hover:bg-[#10b981]/90 text-white font-bold text-xs rounded-xl h-8 px-4"
                >
                  {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                  Accept
                </Button>
                <Button
                  onClick={() => onInviteAction(n, 'declined')}
                  disabled={isActioning}
                  className="bg-muted hover:bg-muted/80 text-muted-foreground font-bold text-xs rounded-xl h-8 px-4"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Decline
                </Button>
                {hasAction && (
                  <button
                    onClick={() => onAction(n)}
                    className="p-1.5 rounded-lg hover:bg-harvest/10 text-muted-foreground hover:text-harvest transition-colors ml-auto"
                    title="View tournament"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Inline prize award actions */}
            {isPrizeAward && (
              <div className="flex items-center gap-2 mt-3" onClick={e => e.stopPropagation()}>
                <Button
                  onClick={() => onPrizeAction(n, 'accepted')}
                  disabled={isActioning}
                  className="bg-[#10b981] hover:bg-[#10b981]/90 text-white font-bold text-xs rounded-xl h-8 px-4"
                >
                  {isActioning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <DollarSign className="w-3.5 h-3.5 mr-1" />}
                  Accept Prize
                </Button>
                <Button
                  onClick={() => onPrizeAction(n, 'declined')}
                  disabled={isActioning}
                  className="bg-muted hover:bg-muted/80 text-muted-foreground font-bold text-xs rounded-xl h-8 px-4"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Decline
                </Button>
              </div>
            )}

            {/* Footer row */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {n.actor_name && (
                  <span className="flex items-center gap-1">
                    {n.actor_avatar ? (
                      <img src={n.actor_avatar} className="w-3.5 h-3.5 rounded-full" alt="" />
                    ) : null}
                    {n.actor_name}
                  </span>
                )}
                <span>{timeAgo(n.created_at)}</span>
                <span
                  className="px-1.5 py-0.5 rounded-full font-bold"
                  style={{ backgroundColor: `${config.color}15`, color: config.color }}
                >
                  {config.label}
                </span>
              </div>

              {/* Actions — always visible on mobile, hover on desktop */}
              <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                {isUnread && !hasInlineActions && (
                  <button
                    onClick={() => onMarkRead(n.id)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Mark as read"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onDismiss(n.id)}
                  className="p-1.5 rounded-lg hover:bg-[#ef4444]/10 text-muted-foreground hover:text-[#ef4444] transition-colors"
                  title="Dismiss (moves to Activity)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {hasAction && !hasInlineActions && (
                  <button
                    onClick={() => onAction(n)}
                    className="p-1.5 rounded-lg hover:bg-harvest/10 text-muted-foreground hover:text-harvest transition-colors"
                    title="Go to"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}