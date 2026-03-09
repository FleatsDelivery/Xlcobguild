/**
 * Inbox Page — Orchestrator
 *
 * Two tabs:
 *   - Inbox: Pending notifications requiring attention (action or dismiss → moves to Activity)
 *   - Activity: Personal audit trail of everything you've done in the app
 *
 * Loading strategy:
 *   - On mount: only fetch inbox (the default tab) with a small page size (25)
 *   - Activity: lazy-loaded on first tab switch, refreshed on every subsequent switch
 *   - Tab switch always checks cache freshness (5s debounce to prevent rapid-toggle spam)
 *   - Badge count updated directly from inbox data — no extra round-trip
 *   - Browser tab focus: only refreshes the currently active tab
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Inbox, Activity, Loader2, CheckCheck, RefreshCw,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Footer } from '@/app/components/footer';
import { InboxTab, type Notification } from '@/app/components/inbox-page-inbox';
import { ActivityTab, type UserActivityEntry } from '@/app/components/inbox-page-activity';
import { projectId } from '/utils/supabase/info';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { acceptAward, declineAward, getConnectStatus } from '@/lib/connect-api';
import { fireMoneyConfetti } from '@/lib/confetti';

// ── Constants ────────────────────────────────────────────────────────

const PAGE_SIZE = 25;
const TAB_SWITCH_DEBOUNCE = 5_000; // 5s — prevents re-fetching on rapid tab toggling

// ═══════════════════════════════════════════════════════
// SKELETON COMPONENTS
// ═══════════════════════════════════════════════════════

function NotificationSkeleton() {
  return (
    <div className="bg-card rounded-2xl border-2 border-border p-4 flex items-start gap-3.5">
      <div className="w-10 h-10 rounded-xl bg-muted animate-pulse flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-2/3 bg-muted rounded-lg animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-muted animate-pulse flex-shrink-0" />
        </div>
        <div className="h-3.5 w-full bg-muted rounded-lg animate-pulse" />
        <div className="h-3 w-24 bg-muted rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

function InboxSkeletonList() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map(i => (
        <NotificationSkeleton key={i} />
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════

interface InboxPageProps {
  user: any;
  onBadgeRefresh?: (directCount?: number) => void;
}

export function InboxPage({ user, onBadgeRefresh }: InboxPageProps) {
  const [activeTab, setActiveTab] = useState<'inbox' | 'activity'>('inbox');

  // ── Inbox state ──
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxRefreshing, setInboxRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadTypeCounts, setUnreadTypeCounts] = useState<Record<string, number>>({});
  const [inboxHasMore, setInboxHasMore] = useState(false);
  const [inboxLoadingMore, setInboxLoadingMore] = useState(false);
  const [inboxTypeFilter, setInboxTypeFilter] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionResults, setActionResults] = useState<Map<string, { status: 'accepted' | 'declined' | 'stale' | 'error'; message: string }>>(new Map());
  const inboxLastFetchRef = useRef<number>(0);

  // ── Activity state ──
  const [activities, setActivities] = useState<UserActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityRefreshing, setActivityRefreshing] = useState(false);
  const [activityTypeCounts, setActivityTypeCounts] = useState<Record<string, number>>({});
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [activityTypeFilter, setActivityTypeFilter] = useState<string | null>(null);
  const activityLastFetchRef = useRef<number>(0);
  const activityInvalidatedRef = useRef(false); // true when an inbox action should cause activity to refetch
  const [freezingIds, setFreezingIds] = useState<Set<string>>(new Set());

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;

  // ── Auth headers (cached per mount) ──
  const headersRef = useRef<Record<string, string> | null>(null);
  const getHeaders = useCallback(async () => {
    if (headersRef.current) return headersRef.current;
    const { data: { session } } = await supabase.auth.getSession();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`,
    };
    headersRef.current = headers;
    return headers;
  }, []);

  // ═══════════════════════════════════════════════════════
  // INBOX DATA FETCHING
  // ═══════════════════════════════════════════════════════

  const fetchNotifications = useCallback(async (opts?: { force?: boolean; silent?: boolean }) => {
    const force = opts?.force ?? false;
    const silent = opts?.silent ?? false; // silent = no loading spinner (background refresh)

    // Debounce: skip if fetched recently and not forced
    if (!force && Date.now() - inboxLastFetchRef.current < TAB_SWITCH_DEBOUNCE) {
      setInboxLoading(false);
      return;
    }

    if (!silent) setInboxLoading(true);
    try {
      const headers = await getHeaders();
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: '0', pending: 'true' });
      const res = await fetch(`${apiBase}/notifications?${params}`, { headers });
      if (!res.ok) {
        console.error('Failed to fetch notifications:', await res.text());
        return;
      }
      const data = await res.json();
      setNotifications(data.notifications || []);
      const newUnreadCount = data.unread_count || 0;
      setUnreadCount(newUnreadCount);
      setUnreadTypeCounts(data.unread_type_counts || {});
      setInboxHasMore(data.has_more || false);
      inboxLastFetchRef.current = Date.now();

      // Update badge directly from the response — skip the extra /unread-count round-trip
      onBadgeRefresh?.(newUnreadCount);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setInboxLoading(false);
      setInboxRefreshing(false);
    }
  }, [getHeaders, apiBase, onBadgeRefresh]);

  // Load more inbox
  const loadMoreInbox = async () => {
    setInboxLoadingMore(true);
    try {
      const headers = await getHeaders();
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(notifications.length),
        pending: 'true',
      });
      const res = await fetch(`${apiBase}/notifications?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setNotifications(prev => [...prev, ...(data.notifications || [])]);
        setInboxHasMore(data.has_more || false);
      }
    } catch (err) {
      console.error('Load more inbox error:', err);
    } finally {
      setInboxLoadingMore(false);
    }
  };

  // ═══════════════════════════════════════════════════════
  // ACTIVITY DATA FETCHING
  // ═══════════════════════════════════════════════════════

  const fetchActivities = useCallback(async (opts?: { force?: boolean; silent?: boolean }) => {
    const force = opts?.force ?? false;
    const silent = opts?.silent ?? false;

    // Debounce unless forced or explicitly invalidated by an inbox action
    if (!force && !activityInvalidatedRef.current && Date.now() - activityLastFetchRef.current < TAB_SWITCH_DEBOUNCE) {
      setActivityLoading(false);
      return;
    }

    if (!silent) {
      // Only show full skeleton if we have no data yet. Otherwise use the refreshing spinner.
      if (activities.length === 0) {
        setActivityLoading(true);
      } else {
        setActivityRefreshing(true);
      }
    }

    try {
      const headers = await getHeaders();
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: '0' });
      const res = await fetch(`${apiBase}/user-activity?${params}`, { headers });
      if (!res.ok) {
        console.error('Failed to fetch activity:', await res.text());
        return;
      }
      const data = await res.json();
      setActivities(data.activities || []);
      setActivityTypeCounts(data.type_counts || {});
      setActivityHasMore(data.has_more || false);
      activityLastFetchRef.current = Date.now();
      activityInvalidatedRef.current = false;
    } catch (err) {
      console.error('Error fetching activity:', err);
    } finally {
      setActivityLoading(false);
      setActivityRefreshing(false);
    }
  }, [getHeaders, apiBase, activities.length]);

  // ═══════════════════════════════════════════════════════
  // MOUNT & TAB SWITCH EFFECTS
  // ═══════════════════════════════════════════════════════

  // On mount: only fetch inbox (the default tab). Activity is lazy.
  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On tab switch: fetch fresh data for the target tab
  useEffect(() => {
    if (activeTab === 'inbox') {
      fetchNotifications();
    } else {
      fetchActivities();
    }
  }, [activeTab]); // intentionally only depend on activeTab — fetch functions are stable enough

  // Auto-refresh active tab on browser tab focus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (activeTab === 'inbox') {
          fetchNotifications({ force: true, silent: true });
        } else {
          fetchActivities({ force: true, silent: true });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [activeTab, fetchNotifications, fetchActivities]);

  // Load more activity
  const loadMoreActivity = async () => {
    setActivityLoadingMore(true);
    try {
      const headers = await getHeaders();
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(activities.length),
      });
      const res = await fetch(`${apiBase}/user-activity?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setActivities(prev => [...prev, ...(data.activities || [])]);
        setActivityHasMore(data.has_more || false);
      }
    } catch (err) {
      console.error('Load more activity error:', err);
    } finally {
      setActivityLoadingMore(false);
    }
  };

  // ── Helper: invalidate activity cache so next tab switch refetches ──
  const invalidateActivity = () => {
    activityInvalidatedRef.current = true;
    activityLastFetchRef.current = 0;
  };

  // ═══════════════════════════════════════════════════════
  // INBOX ACTIONS
  // ══════════════════════════════════════════════════════

  // Mark all read
  const markAllRead = async () => {
    setMarkingRead(true);
    try {
      const headers = await getHeaders();
      await fetch(`${apiBase}/notifications/read`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ all: true }),
      });
      setNotifications(prev => prev.map(n =>
        n.status === 'unread' ? { ...n, status: 'read' as const, read_at: new Date().toISOString() } : n
      ));
      setUnreadCount(0);
      setUnreadTypeCounts({});
      onBadgeRefresh?.(0);
    } catch (err) {
      console.error('Mark all read error:', err);
    } finally {
      setMarkingRead(false);
    }
  };

  // Mark single read (optimistic badge update)
  const markRead = async (notifId: string) => {
    // Optimistic local update
    const wasUnread = notifications.find(n => n.id === notifId)?.status === 'unread';
    setNotifications(prev => prev.map(n =>
      n.id === notifId ? { ...n, status: 'read' as const, read_at: new Date().toISOString() } : n
    ));
    if (wasUnread) {
      const newCount = Math.max(0, unreadCount - 1);
      setUnreadCount(newCount);
      onBadgeRefresh?.(newCount);
    }

    // Fire-and-forget server call
    try {
      const headers = await getHeaders();
      await fetch(`${apiBase}/notifications/read`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ ids: [notifId] }),
      });
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  // Dismiss — optimistic removal, Motion handles exit animation, server call in background
  const dismissNotif = async (notifId: string) => {
    // Optimistic badge update
    const wasUnread = notifications.find(n => n.id === notifId)?.status === 'unread';
    setNotifications(prev => prev.filter(n => n.id !== notifId));
    if (wasUnread) {
      const newCount = Math.max(0, unreadCount - 1);
      setUnreadCount(newCount);
      onBadgeRefresh?.(newCount);
    }
    invalidateActivity();

    // Server call in background
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiBase}/notifications/${notifId}/dismiss`, {
        method: 'PATCH', headers,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Dismiss server error:', err);
      }
    } catch (err) {
      console.error('Dismiss error:', err);
    }
  };

  // Navigate to action URL
  const handleActionClick = (notif: Notification) => {
    if (notif.status === 'unread') markRead(notif.id);
    if (notif.action_url) {
      window.location.hash = notif.action_url.replace('#', '');
    }
  };

  // ── Helper: mark notification as actioned in KV (fire-and-forget) ──
  const markNotifActioned = async (notifId: string) => {
    try {
      const headers = await getHeaders();
      await fetch(`${apiBase}/notifications/${notifId}/action`, {
        method: 'PATCH', headers,
      });
    } catch (err) {
      console.error('Non-critical: failed to mark notification actioned in KV:', err);
    }
  };

  // ── Helper: show result on card, then animate out and remove ──
  const showResultAndRemove = (notifId: string, result: { status: 'accepted' | 'declined' | 'stale'; message: string }) => {
    setActionResults(prev => new Map(prev).set(notifId, result));

    setTimeout(() => {
      // Optimistic badge update — check if this was unread before removing
      setNotifications(prev => {
        const notif = prev.find(n => n.id === notifId);
        if (notif?.status === 'unread') {
          const newCount = Math.max(0, unreadCount - 1);
          setUnreadCount(newCount);
          onBadgeRefresh?.(newCount);
        }
        return prev.filter(n => n.id !== notifId);
      });
      setActionResults(prev => {
        const next = new Map(prev);
        next.delete(notifId);
        return next;
      });
    }, 1200);
  };

  // Team / coach invite inline actions
  const handleInviteAction = async (notif: Notification, action: 'accepted' | 'declined') => {
    const meta = notif.metadata;
    if (!meta?.tournament_id || !meta?.invite_id) {
      if (notif.action_url) {
        window.location.hash = notif.action_url.replace('#', '');
      }
      return;
    }

    setActioningId(notif.id);
    try {
      const headers = await getHeaders();
      const res = await fetch(
        `${apiBase}/kkup/tournaments/${meta.tournament_id}/invites/${meta.invite_id}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: action }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));

        // Rank ineligible — show error inline but don't remove the card
        if (err.rank_ineligible) {
          setActionResults(prev => new Map(prev).set(notif.id, {
            status: 'error' as const,
            message: err.error || 'Your rank is above the eligibility range.',
          }));
          setTimeout(() => {
            setActionResults(prev => {
              const next = new Map(prev);
              next.delete(notif.id);
              return next;
            });
          }, 4000);
          return;
        }

        // 404 — invite no longer exists
        if (res.status === 404) {
          showResultAndRemove(notif.id, {
            status: 'stale',
            message: 'This invite is no longer valid.',
          });
          markNotifActioned(notif.id);
          invalidateActivity();
          return;
        }

        // 409 — already on roster
        if (res.status === 409) {
          showResultAndRemove(notif.id, {
            status: 'stale',
            message: err.error || "You're already on this team's roster.",
          });
          markNotifActioned(notif.id);
          invalidateActivity();
          return;
        }

        // Generic error — show inline
        setActionResults(prev => new Map(prev).set(notif.id, {
          status: 'error' as const,
          message: err.error || `Failed to ${action === 'accepted' ? 'accept' : 'decline'} invite`,
        }));
        setTimeout(() => {
          setActionResults(prev => {
            const next = new Map(prev);
            next.delete(notif.id);
            return next;
          });
        }, 4000);
        return;
      }

      const data = await res.json();

      // ── Success! ──

      // 1. Mark this notification as actioned in KV (fire-and-forget)
      markNotifActioned(notif.id);

      // 2. Show inline result, then animate out
      showResultAndRemove(notif.id, {
        status: action,
        message: data.message || (action === 'accepted' ? 'Invite accepted!' : 'Invite declined.'),
      });

      // 3. Invalidate activity cache so next tab switch refetches
      invalidateActivity();

      // 4. If accepted, also clean up other invite notifications for same tournament
      if (action === 'accepted') {
        const otherInvites = notifications.filter(n =>
          (n.type === 'team_invite' || n.type === 'coach_invite') &&
          n.id !== notif.id &&
          n.metadata?.tournament_id === meta.tournament_id
        );
        for (const other of otherInvites) {
          markNotifActioned(other.id);
          setTimeout(() => {
            showResultAndRemove(other.id, {
              status: 'stale',
              message: 'Auto-declined — you joined another team.',
            });
          }, 300);
        }
      }
    } catch (err) {
      console.error('Invite action error:', err);
      setActionResults(prev => new Map(prev).set(notif.id, {
        status: 'error' as const,
        message: 'Something went wrong. Please try again.',
      }));
      setTimeout(() => {
        setActionResults(prev => {
          const next = new Map(prev);
          next.delete(notif.id);
          return next;
        });
      }, 4000);
    } finally {
      setActioningId(null);
    }
  };

  // Prize award inline actions (Accept / Decline)
  const handlePrizeAction = async (notif: Notification, action: 'accepted' | 'declined') => {
    const meta = notif.metadata;
    const awardId = meta?.award_id || notif.related_id;

    if (!awardId) {
      toast.error('Prize award ID not found in notification.');
      return;
    }

    setActioningId(notif.id);
    try {
      if (action === 'accepted') {
        // Check Stripe Connect status before accepting
        let connectStatus: string = 'not_connected';
        try {
          const status = await getConnectStatus();
          connectStatus = status.status;
        } catch (err) {
          console.error('Failed to check Connect status:', err);
          // Don't block — let them accept anyway, they can connect later
        }

        // Call accept endpoint
        const result = await acceptAward(awardId);

        // Mark notification as actioned
        markNotifActioned(notif.id);
        invalidateActivity();

        if (connectStatus !== 'active') {
          // Accepted but no Stripe — show success with nudge to connect
          showResultAndRemove(notif.id, {
            status: 'accepted',
            message: 'Prize accepted! Connect Stripe on your Profile to get paid.',
          });
          toast.success('Prize accepted! Head to your Profile to connect Stripe and receive your payout.', {
            duration: 6000,
          });
        } else {
          // Accepted and has Stripe — clean success
          showResultAndRemove(notif.id, {
            status: 'accepted',
            message: result.message || 'Prize accepted! Payout coming soon.',
          });
          fireMoneyConfetti();
        }
      } else {
        // Decline
        await declineAward(awardId);
        markNotifActioned(notif.id);
        invalidateActivity();

        showResultAndRemove(notif.id, {
          status: 'declined',
          message: 'Prize declined.',
        });
      }
    } catch (err: any) {
      console.error('Prize action error:', err);
      setActionResults(prev => new Map(prev).set(notif.id, {
        status: 'error' as const,
        message: err.message || 'Something went wrong. Please try again.',
      }));
      setTimeout(() => {
        setActionResults(prev => {
          const next = new Map(prev);
          next.delete(notif.id);
          return next;
        });
      }, 4000);
    } finally {
      setActioningId(null);
    }
  };

  // Refresh handler (manual refresh button)
  const handleRefresh = () => {
    if (activeTab === 'inbox') {
      setInboxRefreshing(true);
      fetchNotifications({ force: true });
    } else {
      fetchActivities({ force: true });
    }
  };

  // Toggle freeze on an activity entry
  const toggleFreeze = async (activityId: string) => {
    setFreezingIds(prev => new Set(prev).add(activityId));
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiBase}/user-activity/${activityId}/freeze`, {
        method: 'PATCH', headers,
      });
      if (res.ok) {
        const data = await res.json();
        setActivities(prev => prev.map(a =>
          a.id === activityId ? { ...a, frozen: data.frozen } : a
        ));
        toast.success(data.frozen ? 'Frozen — this entry won\'t be auto-cleaned' : 'Unfrozen — will be cleaned up normally');
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(err.error || 'Failed to toggle freeze');
      }
    } catch (err) {
      console.error('Toggle freeze error:', err);
      toast.error('Something went wrong');
    } finally {
      setFreezingIds(prev => {
        const next = new Set(prev);
        next.delete(activityId);
        return next;
      });
    }
  };

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  const isRefreshing = activeTab === 'inbox' ? inboxRefreshing : activityRefreshing;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-3">
            <Inbox className="w-7 h-7 text-harvest" />
            Inbox
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeTab === 'inbox'
              ? (unreadCount > 0
                ? `${unreadCount} pending notification${unreadCount !== 1 ? 's' : ''}`
                : 'You\u2019re all caught up')
              : `${activities.length} activit${activities.length !== 1 ? 'ies' : 'y'} logged`
            }
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'inbox' && unreadCount > 0 && (
            <Button
              onClick={markAllRead}
              disabled={markingRead}
              className="bg-harvest/10 hover:bg-harvest/20 text-harvest font-semibold text-xs rounded-xl h-9 px-3"
            >
              {markingRead
                ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                : <CheckCheck className="w-3.5 h-3.5 mr-1.5" />}
              Mark all read
            </Button>
          )}
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="bg-muted hover:bg-muted/80 text-muted-foreground font-semibold text-xs rounded-xl h-9 w-9 p-0"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 mb-5">
        <button
          onClick={() => { setActiveTab('inbox'); setInboxTypeFilter(null); }}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'inbox'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Inbox className="w-4 h-4" />
          Inbox
          {unreadCount > 0 && (
            <span className="bg-harvest text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('activity'); setActivityTypeFilter(null); }}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'activity'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Activity className="w-4 h-4" />
          Activity
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'inbox' ? (
        inboxLoading ? (
          <InboxSkeletonList />
        ) : (
          <InboxTab
            notifications={notifications}
            unreadCount={unreadCount}
            unreadTypeCounts={unreadTypeCounts}
            typeFilter={inboxTypeFilter}
            onTypeFilter={setInboxTypeFilter}
            onMarkRead={markRead}
            onDismiss={dismissNotif}
            onAction={handleActionClick}
            onInviteAction={handleInviteAction}
            onPrizeAction={handlePrizeAction}
            actioningId={actioningId}
            actionResults={actionResults}
            hasMore={inboxHasMore}
            loadingMore={inboxLoadingMore}
            onLoadMore={loadMoreInbox}
          />
        )
      ) : (
        activityLoading ? (
          <InboxSkeletonList />
        ) : (
          <ActivityTab
            activities={activities}
            typeCounts={activityTypeCounts}
            typeFilter={activityTypeFilter}
            onTypeFilter={setActivityTypeFilter}
            loading={false}
            refreshing={activityRefreshing}
            hasMore={activityHasMore}
            loadingMore={activityLoadingMore}
            onLoadMore={loadMoreActivity}
            onToggleFreeze={toggleFreeze}
            freezingIds={freezingIds}
          />
        )
      )}

      <Footer />
    </div>
  );
}

export default InboxPage;