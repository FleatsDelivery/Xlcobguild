/**
 * Officer Inbox Page — Orchestrator
 *
 * Two tabs:
 *   - Requests: Pending items requiring officer action (team approvals, staff apps, MVP requests)
 *   - Admin Activity: Log of all officer/admin actions
 *
 * Loading strategy:
 *   - On mount: only fetch requests (the default tab) 
 *   - Activity: lazy-loaded on first tab switch, refreshed on every subsequent switch
 *   - Tab switch respects cache freshness (5s debounce to prevent rapid-toggle spam)
 *   - Browser tab focus: only refreshes the currently active tab
 *
 * This file owns state, data fetching, and layout.
 * Tab content is rendered by officer-inbox-requests.tsx and officer-inbox-activity.tsx.
 *
 * Follows the "One Tab = One File" rule from Guidelines.md.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldAlert, Activity, Loader2, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, Shield,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Footer } from '@/app/components/footer';
import { OfficerRequestsTab, type OfficerRequest } from '@/app/components/officer-inbox-requests';
import { OfficerActivityTab, type AdminLogEntry } from '@/app/components/officer-inbox-activity';
import { projectId } from '/utils/supabase/info';
import { supabase } from '@/lib/supabase';
import { isOfficer } from '@/lib/roles';
import { toast } from 'sonner';

// ── Constants ────────────────────────────────────────────────────────

const PAGE_SIZE = 25;
const TAB_SWITCH_DEBOUNCE = 5_000; // 5s — prevents re-fetching on rapid tab toggling

// ═══════════════════════════════════════════════════════
// SKELETON COMPONENTS
// ═══════════════════════════════════════════════════════

function RequestSkeleton() {
  return (
    <div className="bg-card rounded-2xl border-2 border-border p-4 flex items-start gap-3.5">
      <div className="w-10 h-10 rounded-xl bg-muted animate-pulse flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="h-5 w-20 bg-muted rounded-full animate-pulse" />
          <div className="h-4 w-1/3 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="h-3.5 w-full bg-muted rounded-lg animate-pulse" />
        <div className="h-3 w-2/3 bg-muted rounded-lg animate-pulse" />
        <div className="flex gap-2 pt-1">
          <div className="h-8 w-20 bg-muted rounded-lg animate-pulse" />
          <div className="h-8 w-20 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function OfficerSkeletonList() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map(i => (
        <RequestSkeleton key={i} />
      ))}
    </div>
  );
}

// ── Confirmation modal types ─────────────────────────────────────────

interface ConfirmAction {
  title: string;
  description: string;
  variant: 'approve' | 'deny';
  confirmLabel?: string;
  onConfirm: () => void;
}

// ══════════════════════════════════════════════════════════════════════

interface OfficerInboxPageProps {
  user: any;
  onBadgeRefresh?: (directCount?: number) => void;
}

export function OfficerInboxPage({ user, onBadgeRefresh }: OfficerInboxPageProps) {
  const [activeTab, setActiveTab] = useState<'requests' | 'activity'>('requests');

  // ── Requests state ──
  const [requests, setRequests] = useState<OfficerRequest[]>([]);
  const [mvpRequests, setMvpRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsTypeFilter, setRequestsTypeFilter] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [resolvedCards, setResolvedCards] = useState<Record<string, 'approved' | 'denied' | 'dismissed' | 'error'>>({});
  const requestsCacheRef = useRef<number>(0);

  // ── Confirmation modal state ──
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  // ── Activity state ──
  const [adminEntries, setAdminEntries] = useState<AdminLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityRefreshing, setActivityRefreshing] = useState(false);
  const [activityTypeCounts, setActivityTypeCounts] = useState<Record<string, number>>({});
  const [activityTypeFilter, setActivityTypeFilter] = useState<string | null>(null);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const activityCacheRef = useRef<number>(0);
  const activityInvalidatedRef = useRef(false); // true when a request action should cause activity to refetch

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
  // REQUESTS DATA FETCHING
  // ═══════════════════════════════════════════════════════

  const fetchRequests = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && Date.now() - requestsCacheRef.current < TAB_SWITCH_DEBOUNCE) {
      setRequestsLoading(false);
      return;
    }

    try {
      const headers = await getHeaders();

      // Fetch KKup requests (team approvals + staff apps) and MVP requests in parallel
      const [kkupRes, mvpRes] = await Promise.all([
        fetch(`${apiBase}/kkup/requests`, { headers }),
        fetch(`${apiBase}/admin/mvp-requests`, { headers }),
      ]);

      if (kkupRes.ok) {
        const kkupData = await kkupRes.json();
        setRequests((kkupData.requests || []).filter((r: any) => r.status === 'pending'));
      } else {
        console.error('Failed to fetch KKup requests:', await kkupRes.text());
      }

      if (mvpRes.ok) {
        const mvpData = await mvpRes.json();
        setMvpRequests((mvpData.requests || []).filter((r: any) => r.status === 'pending'));
      } else {
        console.error('Failed to fetch MVP requests:', await mvpRes.text());
      }

      requestsCacheRef.current = Date.now();
    } catch (err) {
      console.error('Error fetching officer requests:', err);
    } finally {
      setRequestsLoading(false);
    }
  }, [getHeaders, apiBase]);

  // ═══════════════════════════════════════════════════════
  // ADMIN ACTIVITY DATA FETCHING
  // ═══════════════════════════════════════════════════════

  const fetchAdminActivity = useCallback(async (opts?: { force?: boolean; silent?: boolean }) => {
    const force = opts?.force ?? false;
    const silent = opts?.silent ?? false;

    // Debounce unless forced or invalidated by a request action
    if (!force && !activityInvalidatedRef.current && Date.now() - activityCacheRef.current < TAB_SWITCH_DEBOUNCE) {
      setActivityLoading(false);
      return;
    }

    if (!silent) {
      // Only show full skeleton if we have no data yet. Otherwise use the refreshing spinner.
      if (adminEntries.length === 0) {
        setActivityLoading(true);
      } else {
        setActivityRefreshing(true);
      }
    }

    try {
      const headers = await getHeaders();
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: '0' });
      const res = await fetch(`${apiBase}/admin/activity-log?${params}`, { headers });
      if (!res.ok) {
        console.error('Failed to fetch admin activity:', await res.text());
        return;
      }
      const data = await res.json();
      setAdminEntries(data.entries || []);
      setActivityHasMore(data.has_more || false);
      setActivityTypeCounts(data.type_counts || {});
      activityCacheRef.current = Date.now();
      activityInvalidatedRef.current = false;
    } catch (err) {
      console.error('Error fetching admin activity:', err);
    } finally {
      setActivityLoading(false);
      setActivityRefreshing(false);
    }
  }, [getHeaders, apiBase, adminEntries.length]);

  // ═══════════════════════════════════════════════════════
  // DATA FETCHING EFFECTS
  // ═══════════════════════════════════════════════════════

  // On mount: only fetch requests (the default tab). Activity is lazy.
  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On tab switch: fetch fresh data for the target tab
  useEffect(() => {
    if (activeTab === 'requests') {
      fetchRequests();
    } else {
      fetchAdminActivity();
    }
  }, [activeTab]); // intentionally only depend on activeTab

  // Auto-refresh active tab on browser tab focus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (activeTab === 'requests') {
          fetchRequests(true);
        } else {
          fetchAdminActivity({ force: true, silent: true });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [activeTab, fetchRequests, fetchAdminActivity]);

  // Periodic polling (60s for requests, no poll for activity — it refreshes on tab switch)
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'requests') {
        fetchRequests(true);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [activeTab, fetchRequests]);

  // Load more activity
  const loadMoreActivity = async () => {
    setActivityLoadingMore(true);
    try {
      const headers = await getHeaders();
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(adminEntries.length),
      });
      const res = await fetch(`${apiBase}/admin/activity-log?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAdminEntries(prev => [...prev, ...(data.entries || [])]);
        setActivityHasMore(data.has_more || false);
      }
    } catch (err) {
      console.error('Load more admin activity error:', err);
    } finally {
      setActivityLoadingMore(false);
    }
  };

  // ── Helper: invalidate activity cache so next tab switch refetches ──
  const invalidateActivity = () => {
    activityInvalidatedRef.current = true;
    activityCacheRef.current = 0;
  };

  // ═══════════════════════════════════════════════════════
  // OFFICER ACTIONS
  // ══════════════════════════════════════════════════════

  // Helper: compute remaining pending count after an action removes one item
  // Uses current state refs to avoid stale closures — the setRequests/setMvpRequests
  // updater callbacks below will run first, then this computes from the new state.
  const computeNewBadge = (removedFrom: 'requests' | 'mvp', removedId: string) => {
    const remainingReqs = removedFrom === 'requests'
      ? requests.filter(r => r.raw_id !== removedId).length
      : requests.length;
    const remainingMvp = removedFrom === 'mvp'
      ? mvpRequests.filter(r => String(r.id) !== String(removedId) && r.status === 'pending').length
      : mvpRequests.filter(r => r.status === 'pending').length;
    return remainingReqs + remainingMvp;
  };

  // Same for staff removal (matches on composite key)
  const computeNewBadgeAfterStaffRemoval = (userId: string, tournamentId: string) => {
    const remainingReqs = requests.filter(r =>
      !(r.request_type === 'kkup_staff_application' && r.data?.user_id === userId && r.tournament_id === tournamentId)
    ).length;
    const remainingMvp = mvpRequests.filter(r => r.status === 'pending').length;
    return remainingReqs + remainingMvp;
  };

  const approveTeam = async (tournamentId: string, teamId: string) => {
    setActioningId(`team_${teamId}`);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams/${teamId}/approval`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ approval_status: 'approved' }),
      });
      if (res.ok) {
        const newBadge = computeNewBadge('requests', teamId);
        setResolvedCards(prev => ({ ...prev, [`team_${teamId}`]: 'approved' }));
        setActioningId(null);
        setTimeout(() => {
          setRequests(prev => prev.filter(r => r.raw_id !== teamId));
          setResolvedCards(prev => { const n = { ...prev }; delete n[`team_${teamId}`]; return n; });
        }, 700);
        invalidateActivity();
        onBadgeRefresh?.(newBadge);
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(err.error || 'Failed to approve team');
        setResolvedCards(prev => ({ ...prev, [`team_${teamId}`]: 'error' }));
        setTimeout(() => setResolvedCards(prev => { const n = { ...prev }; delete n[`team_${teamId}`]; return n; }), 2000);
      }
    } catch (err) {
      console.error('Approve team error:', err);
      toast.error('Something went wrong');
      setResolvedCards(prev => ({ ...prev, [`team_${teamId}`]: 'error' }));
      setTimeout(() => setResolvedCards(prev => { const n = { ...prev }; delete n[`team_${teamId}`]; return n; }), 2000);
    } finally {
      setActioningId(null);
    }
  };

  const denyTeam = async (tournamentId: string, teamId: string) => {
    setActioningId(`team_${teamId}`);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams/${teamId}/approval`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ approval_status: 'denied' }),
      });
      if (res.ok) {
        const newBadge = computeNewBadge('requests', teamId);
        setResolvedCards(prev => ({ ...prev, [`team_${teamId}`]: 'denied' }));
        setActioningId(null);
        setTimeout(() => {
          setRequests(prev => prev.filter(r => r.raw_id !== teamId));
          setResolvedCards(prev => { const n = { ...prev }; delete n[`team_${teamId}`]; return n; });
        }, 700);
        invalidateActivity();
        onBadgeRefresh?.(newBadge);
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(err.error || 'Failed to deny team');
        setResolvedCards(prev => ({ ...prev, [`team_${teamId}`]: 'error' }));
        setTimeout(() => setResolvedCards(prev => { const n = { ...prev }; delete n[`team_${teamId}`]; return n; }), 2000);
      }
    } catch (err) {
      console.error('Deny team error:', err);
      toast.error('Something went wrong');
      setResolvedCards(prev => ({ ...prev, [`team_${teamId}`]: 'error' }));
      setTimeout(() => setResolvedCards(prev => { const n = { ...prev }; delete n[`team_${teamId}`]; return n; }), 2000);
    } finally {
      setActioningId(null);
    }
  };

  const reviewStaff = async (tournamentId: string, userId: string, status: 'approved' | 'denied') => {
    const reqId = `staff_${userId}_${tournamentId}`;
    setActioningId(reqId);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/staff/${userId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const newBadge = computeNewBadgeAfterStaffRemoval(userId, tournamentId);
        setResolvedCards(prev => ({ ...prev, [reqId]: status }));
        setActioningId(null);
        setTimeout(() => {
          setRequests(prev => prev.filter(r => !(r.request_type === 'kkup_staff_application' && r.data?.user_id === userId && r.tournament_id === tournamentId)));
          setResolvedCards(prev => { const n = { ...prev }; delete n[reqId]; return n; });
        }, 700);
        invalidateActivity();
        onBadgeRefresh?.(newBadge);
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(err.error || `Failed to ${status} staff application`);
        setResolvedCards(prev => ({ ...prev, [reqId]: 'error' }));
        setTimeout(() => setResolvedCards(prev => { const n = { ...prev }; delete n[reqId]; return n; }), 2000);
      }
    } catch (err) {
      console.error('Review staff error:', err);
      toast.error('Something went wrong');
      setResolvedCards(prev => ({ ...prev, [reqId]: 'error' }));
      setTimeout(() => setResolvedCards(prev => { const n = { ...prev }; delete n[reqId]; return n; }), 2000);
    } finally {
      setActioningId(null);
    }
  };

  const approveMVP = async (requestId: string) => {
    setActioningId(`mvp_${requestId}`);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiBase}/admin/mvp-requests/${requestId}/approve`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`MVP request approved! New rank: ${data.new_rank_id}`);
        const newBadge = computeNewBadge('mvp', requestId);
        setResolvedCards(prev => ({ ...prev, [`mvp_${requestId}`]: 'approved' }));
        setActioningId(null);
        setTimeout(() => {
          setMvpRequests(prev => prev.filter(r => String(r.id) !== String(requestId)));
          setResolvedCards(prev => { const n = { ...prev }; delete n[`mvp_${requestId}`]; return n; });
        }, 700);
        invalidateActivity();
        onBadgeRefresh?.(newBadge);
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(err.error || 'Failed to approve MVP request');
        setResolvedCards(prev => ({ ...prev, [`mvp_${requestId}`]: 'error' }));
        setTimeout(() => setResolvedCards(prev => { const n = { ...prev }; delete n[`mvp_${requestId}`]; return n; }), 2000);
      }
    } catch (err) {
      console.error('Approve MVP error:', err);
      toast.error('Something went wrong');
      setResolvedCards(prev => ({ ...prev, [`mvp_${requestId}`]: 'error' }));
      setTimeout(() => setResolvedCards(prev => { const n = { ...prev }; delete n[`mvp_${requestId}`]; return n; }), 2000);
    } finally {
      setActioningId(null);
    }
  };

  const denyMVP = async (requestId: string) => {
    setActioningId(`mvp_${requestId}`);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiBase}/admin/mvp-requests/${requestId}/deny`, {
        method: 'POST',
        headers,
      });
      if (res.ok) {
        const newBadge = computeNewBadge('mvp', requestId);
        setResolvedCards(prev => ({ ...prev, [`mvp_${requestId}`]: 'denied' }));
        setActioningId(null);
        setTimeout(() => {
          setMvpRequests(prev => prev.filter(r => String(r.id) !== String(requestId)));
          setResolvedCards(prev => { const n = { ...prev }; delete n[`mvp_${requestId}`]; return n; });
        }, 700);
        invalidateActivity();
        onBadgeRefresh?.(newBadge);
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(err.error || 'Failed to deny MVP request');
        setResolvedCards(prev => ({ ...prev, [`mvp_${requestId}`]: 'error' }));
        setTimeout(() => setResolvedCards(prev => { const n = { ...prev }; delete n[`mvp_${requestId}`]; return n; }), 2000);
      }
    } catch (err) {
      console.error('Deny MVP error:', err);
      toast.error('Something went wrong');
      setResolvedCards(prev => ({ ...prev, [`mvp_${requestId}`]: 'error' }));
      setTimeout(() => setResolvedCards(prev => { const n = { ...prev }; delete n[`mvp_${requestId}`]; return n; }), 2000);
    } finally {
      setActioningId(null);
    }
  };

  const dismissMVP = async (requestId: string) => {
    setActioningId(`mvp_${requestId}`);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiBase}/admin/mvp-requests/${requestId}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        const newBadge = computeNewBadge('mvp', requestId);
        setResolvedCards(prev => ({ ...prev, [`mvp_${requestId}`]: 'dismissed' }));
        setActioningId(null);
        setTimeout(() => {
          setMvpRequests(prev => prev.filter(r => String(r.id) !== String(requestId)));
          setResolvedCards(prev => { const n = { ...prev }; delete n[`mvp_${requestId}`]; return n; });
        }, 700);
        onBadgeRefresh?.(newBadge);
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(err.error || 'Failed to dismiss MVP request');
        setResolvedCards(prev => ({ ...prev, [`mvp_${requestId}`]: 'error' }));
        setTimeout(() => setResolvedCards(prev => { const n = { ...prev }; delete n[`mvp_${requestId}`]; return n; }), 2000);
      }
    } catch (err) {
      console.error('Dismiss MVP error:', err);
      toast.error('Something went wrong');
      setResolvedCards(prev => ({ ...prev, [`mvp_${requestId}`]: 'error' }));
      setTimeout(() => setResolvedCards(prev => { const n = { ...prev }; delete n[`mvp_${requestId}`]; return n; }), 2000);
    } finally {
      setActioningId(null);
    }
  };

  const dismissTeam = async (tournamentId: string, teamId: string) => {
    setActioningId(`team_${teamId}`);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams/${teamId}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        const newBadge = computeNewBadge('requests', teamId);
        setResolvedCards(prev => ({ ...prev, [`team_${teamId}`]: 'dismissed' }));
        setActioningId(null);
        setTimeout(() => {
          setRequests(prev => prev.filter(r => r.raw_id !== teamId));
          setResolvedCards(prev => { const n = { ...prev }; delete n[`team_${teamId}`]; return n; });
        }, 700);
        invalidateActivity();
        onBadgeRefresh?.(newBadge);
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(err.error || 'Failed to dismiss team');
        setResolvedCards(prev => ({ ...prev, [`team_${teamId}`]: 'error' }));
        setTimeout(() => setResolvedCards(prev => { const n = { ...prev }; delete n[`team_${teamId}`]; return n; }), 2000);
      }
    } catch (err) {
      console.error('Dismiss team error:', err);
      toast.error('Something went wrong');
      setResolvedCards(prev => ({ ...prev, [`team_${teamId}`]: 'error' }));
      setTimeout(() => setResolvedCards(prev => { const n = { ...prev }; delete n[`team_${teamId}`]; return n; }), 2000);
    } finally {
      setActioningId(null);
    }
  };

  const dismissStaff = async (tournamentId: string, userId: string) => {
    const reqId = `staff_${userId}_${tournamentId}`;
    setActioningId(reqId);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/staff/${userId}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        const newBadge = computeNewBadgeAfterStaffRemoval(userId, tournamentId);
        setResolvedCards(prev => ({ ...prev, [reqId]: 'dismissed' }));
        setActioningId(null);
        setTimeout(() => {
          setRequests(prev => prev.filter(r => !(r.request_type === 'kkup_staff_application' && r.data?.user_id === userId && r.tournament_id === tournamentId)));
          setResolvedCards(prev => { const n = { ...prev }; delete n[reqId]; return n; });
        }, 700);
        invalidateActivity();
        onBadgeRefresh?.(newBadge);
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(err.error || 'Failed to dismiss staff application');
        setResolvedCards(prev => ({ ...prev, [reqId]: 'error' }));
        setTimeout(() => setResolvedCards(prev => { const n = { ...prev }; delete n[reqId]; return n; }), 2000);
      }
    } catch (err) {
      console.error('Dismiss staff error:', err);
      toast.error('Something went wrong');
      setResolvedCards(prev => ({ ...prev, [reqId]: 'error' }));
      setTimeout(() => setResolvedCards(prev => { const n = { ...prev }; delete n[reqId]; return n; }), 2000);
    } finally {
      setActioningId(null);
    }
  };

  // Refresh handler
  const handleRefresh = () => {
    if (activeTab === 'requests') {
      setRequestsLoading(true);
      fetchRequests(true);
    } else {
      fetchAdminActivity({ force: true });
    }
  };

  // ═══════════════════════════════════════════════════════
  // CONFIRMATION WRAPPERS
  // ═══════════════════════════════════════════════════════

  const confirmApproveTeam = (tournamentId: string, teamId: string) => {
    const req = requests.find(r => r.raw_id === teamId);
    const teamName = req?.data?.team_name || 'this team';
    setConfirmAction({
      title: `Approve "${teamName}"?`,
      description: `This team will be confirmed for ${req?.tournament_name || 'the tournament'}. The captain will be notified.`,
      variant: 'approve',
      onConfirm: () => { setConfirmAction(null); approveTeam(tournamentId, teamId); },
    });
  };

  const confirmDenyTeam = (tournamentId: string, teamId: string) => {
    const req = requests.find(r => r.raw_id === teamId);
    const teamName = req?.data?.team_name || 'this team';
    setConfirmAction({
      title: `Deny "${teamName}"?`,
      description: `This team will be rejected from ${req?.tournament_name || 'the tournament'}. The captain will be notified.`,
      variant: 'deny',
      confirmLabel: 'Deny',
      onConfirm: () => { setConfirmAction(null); denyTeam(tournamentId, teamId); },
    });
  };

  const confirmReviewStaff = (tournamentId: string, userId: string, status: 'approved' | 'denied') => {
    const req = requests.find(r => r.request_type === 'kkup_staff_application' && r.data?.user_id === userId && r.tournament_id === tournamentId);
    const name = req?.data?.discord_username || 'this applicant';
    const isApprove = status === 'approved';
    setConfirmAction({
      title: `${isApprove ? 'Approve' : 'Deny'} staff application from "${name}"?`,
      description: isApprove
        ? `They will be added as staff for ${req?.tournament_name || 'the tournament'} and notified.`
        : `Their application for ${req?.tournament_name || 'the tournament'} will be denied and they'll be notified.`,
      variant: isApprove ? 'approve' : 'deny',
      onConfirm: () => { setConfirmAction(null); reviewStaff(tournamentId, userId, status); },
    });
  };

  const confirmApproveMVP = (requestId: string) => {
    const mvp = mvpRequests.find(r => String(r.id) === String(requestId));
    const target = mvp?.target_user;
    const targetName = target?.discord_username || mvp?.target_discord_username || 'Unknown';
    const action = mvp?.action || 'rank_up';
    const currentRank = target?.rank_id || mvp?.current_rank_id;
    const currentPrestige = target?.prestige_level || mvp?.current_prestige_level || 0;

    let rankChange = '';
    if (currentRank != null) {
      if (action === 'rank_up') rankChange = ` from Rank ${currentRank} to Rank ${currentRank + 1}`;
      else if (action === 'rank_down') rankChange = ` from Rank ${currentRank} to Rank ${currentRank - 1}`;
      else if (action === 'prestige') rankChange = ` to Rank 1 P${currentPrestige + 1}`;
    }

    setConfirmAction({
      title: `Approve ${action === 'prestige' ? 'prestige' : action === 'rank_down' ? 'rank down' : 'rank up'} for "${targetName}"?`,
      description: `This will change their rank${rankChange}. They'll be notified and it'll be logged in admin activity.`,
      variant: 'approve',
      onConfirm: () => { setConfirmAction(null); approveMVP(requestId); },
    });
  };

  const confirmDenyMVP = (requestId: string) => {
    const mvp = mvpRequests.find(r => String(r.id) === String(requestId));
    const target = mvp?.target_user;
    const targetName = target?.discord_username || mvp?.target_discord_username || 'Unknown';
    setConfirmAction({
      title: `Deny MVP request for "${targetName}"?`,
      description: 'The request will be marked as denied and they\'ll be notified. No rank changes will be made.',
      variant: 'deny',
      onConfirm: () => { setConfirmAction(null); denyMVP(requestId); },
    });
  };

  const confirmDismissMVP = (requestId: string) => {
    const mvp = mvpRequests.find(r => String(r.id) === String(requestId));
    const target = mvp?.target_user;
    const targetName = target?.discord_username || mvp?.target_discord_username || 'Unknown';
    setConfirmAction({
      title: `Dismiss MVP request for "${targetName}"?`,
      description: 'This permanently deletes the request without approving or denying. No rank changes will be made and no notification will be sent. Use this for spam, duplicates, or invalid requests.',
      variant: 'deny',
      confirmLabel: 'Dismiss',
      onConfirm: () => { setConfirmAction(null); dismissMVP(requestId); },
    });
  };

  const confirmDismissTeam = (tournamentId: string, teamId: string) => {
    const req = requests.find(r => r.raw_id === teamId);
    const teamName = req?.data?.team_name || 'this team';
    setConfirmAction({
      title: `Dismiss team "${teamName}"?`,
      description: 'This permanently removes the team and returns all players to the free agent pool. No denial notification will be sent — just an activity log for the captain. Use this for duplicates, test teams, or abandoned requests.',
      variant: 'deny',
      confirmLabel: 'Dismiss',
      onConfirm: () => { setConfirmAction(null); dismissTeam(tournamentId, teamId); },
    });
  };

  const confirmDismissStaff = (tournamentId: string, userId: string) => {
    const req = requests.find(r => r.request_type === 'kkup_staff_application' && r.data?.user_id === userId && r.tournament_id === tournamentId);
    const applicantName = req?.data?.discord_username || 'this applicant';
    setConfirmAction({
      title: `Dismiss staff application from "${applicantName}"?`,
      description: 'This permanently removes the application without sending a denial notification. The applicant will only see an activity log entry. Use this for duplicates or spam.',
      variant: 'deny',
      confirmLabel: 'Dismiss',
      onConfirm: () => { setConfirmAction(null); dismissStaff(tournamentId, userId); },
    });
  };

  // ═══════════════════════════════════════════════════════
  // AUTH GATE
  // ═══════════════════════════════════════════════════════

  if (!isOfficer(user?.role)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h2 className="text-xl font-bold text-foreground">Officer Access Required</h2>
        <p className="text-sm text-muted-foreground mt-2">
          This page is restricted to officers and owners.
        </p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  const pendingCount = requests.length + mvpRequests.filter(r => r.status === 'pending').length;
  const isRefreshing = activeTab === 'requests' ? requestsLoading : activityLoading;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-amber-400" />
            Officer Inbox
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeTab === 'requests'
              ? (pendingCount > 0
                ? `${pendingCount} pending request${pendingCount !== 1 ? 's' : ''}`
                : 'No pending requests')
              : `${adminEntries.length} admin action${adminEntries.length !== 1 ? 's' : ''} logged`
            }
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => { window.location.hash = '#officer'; }}
            className="bg-muted hover:bg-muted/80 text-muted-foreground font-semibold text-xs rounded-xl h-9 px-3 gap-1.5"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Officer Panel</span>
          </Button>
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
          onClick={() => { setActiveTab('requests'); setRequestsTypeFilter(null); }}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'requests'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Requests
          {pendingCount > 0 && (
            <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {pendingCount}
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
          Admin Activity
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'requests' ? (
        requestsLoading ? (
          <OfficerSkeletonList />
        ) : (
          <OfficerRequestsTab
            requests={requests}
            mvpRequests={mvpRequests}
            typeFilter={requestsTypeFilter}
            onTypeFilter={setRequestsTypeFilter}
            onApproveTeam={confirmApproveTeam}
            onDenyTeam={confirmDenyTeam}
            onDismissTeam={confirmDismissTeam}
            onReviewStaff={confirmReviewStaff}
            onDismissStaff={confirmDismissStaff}
            onApproveMVP={confirmApproveMVP}
            onDenyMVP={confirmDenyMVP}
            onDismissMVP={confirmDismissMVP}
            actioningId={actioningId}
            resolvedCards={resolvedCards}
            loading={false}
          />
        )
      ) : (
        activityLoading ? (
          <OfficerSkeletonList />
        ) : (
          <OfficerActivityTab
            entries={adminEntries}
            typeCounts={activityTypeCounts}
            typeFilter={activityTypeFilter}
            onTypeFilter={setActivityTypeFilter}
            loading={false}
            hasMore={activityHasMore}
            loadingMore={activityLoadingMore}
            onLoadMore={loadMoreActivity}
          />
        )
      )}

      {/* Confirmation modal */}
      {confirmAction && (
        <ConfirmModal
          action={confirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      <Footer />
    </div>
  );
}

// ── Confirmation Modal ────────────────────────────────────────────

function ConfirmModal({
  action,
  onCancel,
}: {
  action: ConfirmAction;
  onCancel: () => void;
}) {
  const isApprove = action.variant === 'approve';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl border-2 border-border shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: isApprove ? '#10b98115' : '#ef444415' }}
          >
            {isApprove
              ? <CheckCircle className="w-6 h-6 text-[#10b981]" />
              : <AlertTriangle className="w-6 h-6 text-[#ef4444]" />
            }
          </div>
        </div>

        {/* Title */}
        <h3 className="text-center text-lg font-bold text-foreground mb-2">
          {action.title}
        </h3>

        {/* Description */}
        <p className="text-center text-sm text-muted-foreground leading-relaxed mb-6">
          {action.description}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={onCancel}
            className="flex-1 bg-muted hover:bg-muted/80 text-muted-foreground font-bold text-sm rounded-xl h-10"
          >
            Cancel
          </Button>
          <Button
            onClick={action.onConfirm}
            className={`flex-1 font-bold text-sm rounded-xl h-10 text-white ${
              isApprove
                ? 'bg-[#10b981] hover:bg-[#10b981]/90'
                : 'bg-[#ef4444] hover:bg-[#ef4444]/90'
            }`}
          >
            {isApprove ? (
              <><CheckCircle className="w-4 h-4 mr-1.5" /> {action.confirmLabel || 'Approve'}</>
            ) : (
              <><XCircle className="w-4 h-4 mr-1.5" /> {action.confirmLabel || 'Confirm'}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}