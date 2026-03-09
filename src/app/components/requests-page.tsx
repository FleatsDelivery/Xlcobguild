import { isOfficer } from '@/lib/roles';
import { Footer } from '@/app/components/footer';
import { Clock, CheckCircle, XCircle, Loader2, ExternalLink, Image as ImageIcon, Shield, User, Trash2, ChevronUp, ChevronDown, Star, ArrowRight, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { Button } from '@/app/components/ui/button';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { SuccessModal } from '@/app/components/success-modal';

interface RankUpRequest {
  id: string;
  user_id: string;
  target_user_id?: string;
  action?: 'rank_up' | 'rank_down' | 'prestige';
  type: string;
  screenshot_url: string;
  match_id: string | null;
  status: 'pending' | 'approved' | 'denied';
  current_rank_id: number;
  current_prestige_level: number;
  created_at: string;
  updated_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  // Discord metadata for unregistered users
  submitter_discord_id?: string;
  submitter_discord_username?: string;
  target_discord_id?: string;
  target_discord_username?: string;
  discord_message_id?: string;
  discord_channel_id?: string;
  users?: {
    id: string;
    discord_username: string;
    discord_avatar: string | null;
    email: string | null;
    rank_id?: number;
    prestige_level?: number;
  };
  target_user?: {
    id: string;
    discord_username: string;
    discord_avatar: string | null;
    email: string | null;
    rank_id?: number;
    prestige_level?: number;
  };
  reviewed_by_user?: {
    id: string;
    discord_username: string;
    discord_avatar: string | null;
  };
}

type AnyRequest = RankUpRequest & { request_type: 'mvp' };

const RANK_NAMES = [
  '', // 0 index unused
  'Earwig', // 1
  'Ugandan Kob', // 2
  'Private Maize', // 3
  'Specialist Ingredient', // 4
  'Corporal Corn Bread', // 5
  'Sergeant Husk', // 6
  'Sergeant Major Fields', // 7
  'Captain Cornhole', // 8
  'Major Cob', // 9
  'Corn Star', // 10
  'Pop\'d Kernel', // 11
];

// Cache config
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for non-admin
const HISTORY_PAGE_SIZE = 10;

export function RequestsPage({ user, onBadgeRefresh }: { user: any; onBadgeRefresh?: () => void }) {
  const isAdmin = isOfficer(user?.role);
  const isOwner = user?.role === 'owner';
  
  // Tab state for admins
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'kkup'>('all');
  
  const [pendingRequests, setPendingRequests] = useState<AnyRequest[]>([]);
  const [historyRequests, setHistoryRequests] = useState<AnyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [historyOffset, setHistoryOffset] = useState(0);

  // KKup requests
  const [kkupRequests, setKkupRequests] = useState<any[]>([]);
  const [myKkupRequests, setMyKkupRequests] = useState<any[]>([]);
  const [kkupLoading, setKkupLoading] = useState(false);

  // Lazy image loading - track which request screenshots are expanded
  const [expandedImages, setExpandedImages] = useState<Set<string>>(new Set());

  // Cache tracking
  const cacheTimestamp = useRef<number>(0);

  // Modal states
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    confirmVariant?: 'danger' | 'primary' | 'success';
    onConfirm: () => void;
  } | null>(null);

  const [successModal, setSuccessModal] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    helpText?: string;
  } | null>(null);

  const toggleImage = useCallback((requestId: string) => {
    setExpandedImages(prev => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  }, []);

  // Fetch with cache awareness
  const fetchRequests = useCallback(async (forceRefresh = false) => {
    // For non-admin users, use cached data if fresh enough
    if (!forceRefresh && !isAdmin && cacheTimestamp.current > 0) {
      const age = Date.now() - cacheTimestamp.current;
      if (age < CACHE_TTL_MS) {
        console.log(`📦 Using cached requests (${Math.round(age / 1000)}s old, TTL: ${CACHE_TTL_MS / 1000}s)`);
        setLoading(false);
        return;
      }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoading(false);
        return;
      }

      let allRequests: AnyRequest[] = [];

      // Fetch MVP requests
      const mvpEndpoint = isAdmin 
        ? `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/mvp-requests`
        : `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/requests/mvp/my`;

      const mvpResponse = await fetch(mvpEndpoint, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (mvpResponse.ok) {
        const mvpData = await mvpResponse.json();
        const mvpRequests = (mvpData.requests || []).map((r: RankUpRequest) => ({
          ...r,
          request_type: 'mvp' as const,
        }));
        allRequests = [...allRequests, ...mvpRequests];
      }

      // Sort by created_at (newest first)
      allRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setPendingRequests(allRequests.filter((r: AnyRequest) => r.status === 'pending'));
      setHistoryRequests(allRequests.filter((r: AnyRequest) => r.status !== 'pending'));
      cacheTimestamp.current = Date.now();
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  const fetchKkupRequests = useCallback(async () => {
    setKkupLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/requests`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setKkupRequests(data.requests || []);
        setMyKkupRequests(data.my_requests || []);
      }
    } catch (err) {
      console.error('Error fetching KKup requests:', err);
    } finally {
      setKkupLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests(true); // Always fresh on mount
    fetchKkupRequests();
  }, [isAdmin]);

  // Auto-refresh when tab regains focus (keeps requests page feeling live)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchRequests(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchRequests]);

  // Invalidate cache and refetch after any mutation
  const invalidateAndRefetch = useCallback(() => {
    cacheTimestamp.current = 0;
    fetchRequests(true);
    if (onBadgeRefresh) {
      onBadgeRefresh();
    }
  }, [fetchRequests, onBadgeRefresh]);

  const handleApproveMVP = async (request: RankUpRequest & { request_type: 'mvp' }) => {
    const action = request.action || 'rank_up';
    const targetUsername = request.target_user?.discord_username || request.target_discord_username || 'the user';
    const actionText = action === 'rank_up' ? 'rank up' : action === 'rank_down' ? 'rank down' : 'prestige';
    
    setConfirmModal({
      title: 'Approve MVP Request',
      message: `Approve this MVP request and ${actionText} ${targetUsername}?`,
      confirmText: 'Approve',
      confirmVariant: 'success',
      onConfirm: async () => {
        setActionLoading(request.id);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            alert('Please sign in first');
            setActionLoading(null);
            return;
          }

          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/mvp-requests/${request.id}/approve`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
            }
          );

          if (!response.ok) {
            const error = await response.json();
            setSuccessModal({
              type: 'error',
              title: 'Cannot Approve Request',
              message: error.error || 'Failed to approve request',
              helpText: 'Please check if the target user is registered and try again.'
            });
            setActionLoading(null);
            return;
          }

          const successMessage = action === 'rank_up' ? 'User has been ranked up!' :
                                 action === 'rank_down' ? 'User has been ranked down!' :
                                 'User has been prestiged!';

          setSuccessModal({
            type: 'success',
            title: 'Request Approved',
            message: successMessage,
            helpText: 'You can view the updated rank in the history section.'
          });
          invalidateAndRefetch();
        } catch (error) {
          console.error('Error approving request:', error);
          alert('Failed to approve request. Please try again.');
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  const handleDenyMVP = async (requestId: string) => {
    setConfirmModal({
      title: 'Deny MVP Request',
      message: 'Deny this MVP request? The request will be marked as denied and the Discord message will be updated. The record stays in history.',
      confirmText: 'Deny',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setActionLoading(requestId);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            alert('Please sign in first');
            setActionLoading(null);
            return;
          }

          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/mvp-requests/${requestId}/deny`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
            }
          );

          if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Failed to deny request');
            setActionLoading(null);
            return;
          }

          setSuccessModal({
            type: 'info',
            title: 'Request Denied',
            message: 'The request has been denied. It will appear in the history section.',
          });
          invalidateAndRefetch();
        } catch (error) {
          console.error('Error denying request:', error);
          alert('Failed to deny request. Please try again.');
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  const handleDismissMVP = async (requestId: string) => {
    setConfirmModal({
      title: 'Dismiss MVP Request',
      message: 'Dismiss this request? This will PERMANENTLY delete the request, its screenshot, and the Discord message. This cannot be undone.',
      confirmText: 'Dismiss Forever',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setActionLoading(requestId);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            alert('Please sign in first');
            setActionLoading(null);
            return;
          }

          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/mvp-requests/${requestId}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
            }
          );

          if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Failed to dismiss request');
            setActionLoading(null);
            return;
          }

          setSuccessModal({
            type: 'success',
            title: 'Request Dismissed',
            message: 'Request and all associated data have been permanently deleted.',
          });
          invalidateAndRefetch();
        } catch (error) {
          console.error('Error dismissing request:', error);
          alert('Failed to dismiss request. Please try again.');
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  const handleCancel = async (requestId: string) => {
    setConfirmModal({
      title: 'Cancel MVP Request',
      message: 'Cancel this MVP request? This will permanently delete the request, its screenshot, and the Discord message.',
      confirmText: 'Cancel & Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setActionLoading(requestId);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            alert('Please sign in first');
            setActionLoading(null);
            return;
          }

          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/mvp-requests/${requestId}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
            }
          );

          if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Failed to cancel request');
            setActionLoading(null);
            return;
          }

          setSuccessModal({
            type: 'success',
            title: 'Request Cancelled',
            message: 'Request and all associated data have been permanently deleted.',
          });
          invalidateAndRefetch();
        } catch (error) {
          console.error('Error cancelling request:', error);
          alert('Failed to cancel request. Please try again.');
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  // ═══════════════════════════════════════════════════════
  // KKUP ACTION HANDLERS
  // ═══════════════════════════════════════════════════════

  const handleKkupTeamAction = (req: any, action: 'approved' | 'denied') => {
    const verb = action === 'approved' ? 'Approve' : 'Deny';
    setConfirmModal({
      title: `${verb} Team "${req.data?.team_name}"?`,
      message: action === 'denied'
        ? 'Denying this team will prevent them from participating. This can be reversed later from the tournament hub.'
        : `Approving this team allows them to send invites and build their roster.`,
      confirmText: verb,
      confirmVariant: action === 'approved' ? 'success' : 'danger',
      onConfirm: async () => {
        setActionLoading(req.id);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) { setActionLoading(null); return; }

          const teamId = req.data?.id || req.raw_id;
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${req.tournament_id}/teams/${teamId}/approval`,
            {
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ approval_status: action }),
            }
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `Failed to ${verb.toLowerCase()} team`);

          setSuccessModal({
            type: action === 'approved' ? 'success' : 'info',
            title: `Team ${action === 'approved' ? 'Approved' : 'Denied'}`,
            message: data.message || `Team "${req.data?.team_name}" has been ${action}.`,
          });
          fetchKkupRequests();
        } catch (err: any) {
          setSuccessModal({ type: 'error', title: 'Action Failed', message: err.message });
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleKkupStaffAction = (req: any, action: 'approved' | 'denied') => {
    const verb = action === 'approved' ? 'Approve' : 'Deny';
    setConfirmModal({
      title: `${verb} Staff Application`,
      message: `${verb} ${req.data?.discord_username}'s application as ${req.data?.role_preference}?`,
      confirmText: verb,
      confirmVariant: action === 'approved' ? 'success' : 'danger',
      onConfirm: async () => {
        setActionLoading(req.id);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) { setActionLoading(null); return; }

          const userId = req.data?.user_id;
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${req.tournament_id}/staff/${userId}`,
            {
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: action }),
            }
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `Failed to ${verb.toLowerCase()} application`);

          setSuccessModal({
            type: action === 'approved' ? 'success' : 'info',
            title: `Application ${action === 'approved' ? 'Approved' : 'Denied'}`,
            message: data.message || `${req.data?.discord_username}'s application has been ${action}.`,
          });
          fetchKkupRequests();
        } catch (err: any) {
          setSuccessModal({ type: 'error', title: 'Action Failed', message: err.message });
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  // Render functions instead of component functions to avoid unmount/remount on parent re-renders
  const renderMVPCard = (request: RankUpRequest & { request_type: 'mvp' }, isPendingSection?: boolean) => {
    const isPending = request.status === 'pending';
    const isApproved = request.status === 'approved';
    const isDenied = request.status === 'denied';
    
    // Submitter info - fallback to Discord metadata if user not registered
    const submitterUser = request.users;
    const submitterUsername = submitterUser?.discord_username || request.submitter_discord_username || 'Unregistered User';
    const submitterAvatar = submitterUser?.discord_avatar;
    
    // Target info - fallback to Discord metadata if user not registered
    const targetUser = request.target_user;
    const targetUsername = targetUser?.discord_username || request.target_discord_username || 'Unregistered User';
    const targetAvatar = targetUser?.discord_avatar;
    
    const action = request.action || 'rank_up';
    const fromDiscord = !!request.discord_message_id;

    // Pending: images shown by default (expanded unless user toggled OFF)
    // History: images collapsed by default (collapsed unless user toggled ON)
    const isImageExpanded = isPendingSection
      ? !expandedImages.has(request.id)
      : expandedImages.has(request.id);

    // Compute rank transition for the target user
    const currentRankId = request.current_rank_id || 0;
    const currentPrestige = request.current_prestige_level || 0;
    const currentRankName = RANK_NAMES[currentRankId] || `Rank ${currentRankId}`;
    
    let newRankId = currentRankId;
    let newPrestige = currentPrestige;
    if (action === 'rank_up') {
      newRankId = Math.min(currentRankId + 1, 11);
    } else if (action === 'rank_down') {
      newRankId = Math.max(currentRankId - 1, 1);
    } else if (action === 'prestige') {
      newPrestige = currentPrestige + 1;
      newRankId = 1;
    }
    const newRankName = RANK_NAMES[newRankId] || `Rank ${newRankId}`;

    // Submitter rank info
    const submitterRankId = submitterUser?.rank_id || 0;
    const submitterPrestige = submitterUser?.prestige_level || 0;
    const submitterRankName = RANK_NAMES[submitterRankId] || `Rank ${submitterRankId}`;

    // Get action display info
    const getActionInfo = () => {
      switch (action) {
        case 'rank_up':
          return { icon: ChevronUp, label: 'Rank Up', color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10', borderColor: 'border-[#22c55e]/20' };
        case 'rank_down':
          return { icon: ChevronDown, label: 'Rank Down', color: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10', borderColor: 'border-[#ef4444]/20' };
        case 'prestige':
          return { icon: Star, label: 'Prestige', color: 'text-[#fbbf24]', bg: 'bg-[#fbbf24]/10', borderColor: 'border-[#fbbf24]/20' };
      }
    };

    const actionInfo = getActionInfo();

    // Fallback corn avatar component
    const CornAvatar = () => (
      <div className="w-10 h-10 rounded-full bg-harvest flex items-center justify-center">
        <span className="text-2xl">🌽</span>
      </div>
    );
    
    const handleToggleImage = () => {
      setExpandedImages(prev => {
        const next = new Set(prev);
        if (next.has(request.id)) {
          next.delete(request.id);
        } else {
          next.add(request.id);
        }
        return next;
      });
    };

    return (
      <div key={request.id} className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden ${
        isPending ? 'border-[#f59e0b]/30' : isApproved ? 'border-[#10b981]/20' : 'border-field-dark/10'
      }`}>
        {/* Header Bar */}
        <div className={`flex items-center justify-between px-4 sm:px-6 py-2.5 border-b ${
          isPending ? 'bg-[#f59e0b]/5 border-[#f59e0b]/20' : isApproved ? 'bg-[#10b981]/5 border-[#10b981]/15' : 'bg-field-dark/5 border-field-dark/10'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {fromDiscord ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#5865F2] text-white flex items-center gap-1 flex-shrink-0">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.074.074 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-harvest text-white flex-shrink-0">
                Web
              </span>
            )}
            <span className="text-xs text-field-dark/60 flex-shrink-0">
              {new Date(request.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
            {/* Request ID — desktop only */}
            <span className="hidden md:inline text-[10px] text-field-dark/30 font-mono truncate" title={request.id}>
              {request.id}
            </span>
          </div>
          
          {/* Status Badge */}
          {isPending ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#f59e0b]/10 text-[#f59e0b] flex-shrink-0">
              Pending
            </span>
          ) : (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
              isApproved ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#ef4444]/10 text-[#ef4444]'
            }`}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
              {request.reviewed_by_user?.discord_username && ` by ${request.reviewed_by_user.discord_username}`}
            </span>
          )}
        </div>

        {/* Main Content */}
        <div className="p-4 sm:p-6">
          {/* Submitter → Action → Target flow */}
          <div className="flex items-start gap-3 flex-wrap">
            {/* Submitter */}
            <div className="flex items-center gap-2">
              {submitterAvatar ? (
                <img 
                  src={submitterAvatar} 
                  alt={submitterUsername}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <CornAvatar />
              )}
              <div>
                <p className="text-sm font-semibold text-field-dark">{submitterUsername}</p>
                {submitterUser && submitterRankId > 0 ? (
                  <p className="text-[11px] text-field-dark/50">
                    {submitterRankName}{submitterPrestige > 0 ? ` · P${submitterPrestige}` : ''}
                  </p>
                ) : !submitterUser ? (
                  <p className="text-[10px] text-[#f59e0b]">Unregistered</p>
                ) : null}
              </div>
            </div>

            {/* Action Arrow */}
            <ArrowRight className="w-4 h-4 text-field-dark/30 flex-shrink-0 mt-3" />

            {/* Action Badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${actionInfo.bg} border ${actionInfo.borderColor} mt-1.5`}>
              <actionInfo.icon className={`w-4 h-4 ${actionInfo.color}`} />
              <span className={`text-sm font-semibold ${actionInfo.color}`}>{actionInfo.label}</span>
            </div>

            {/* Arrow */}
            <ArrowRight className="w-4 h-4 text-field-dark/30 flex-shrink-0 mt-3" />

            {/* Target */}
            <div className="flex items-center gap-2">
              {targetAvatar ? (
                <img 
                  src={targetAvatar} 
                  alt={targetUsername}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <CornAvatar />
              )}
              <div>
                <p className="text-sm font-semibold text-field-dark">{targetUsername}</p>
                {currentRankId > 0 ? (
                  <p className="text-[11px] text-field-dark/50 flex items-center gap-1">
                    <span>{currentRankName}{currentPrestige > 0 ? ` P${currentPrestige}` : ''}</span>
                    <ArrowRight className={`w-3 h-3 ${actionInfo.color} inline`} />
                    <span className={`font-semibold ${actionInfo.color}`}>{newRankName}{newPrestige > 0 ? ` P${newPrestige}` : ''}</span>
                  </p>
                ) : !targetUser ? (
                  <p className="text-[10px] text-[#f59e0b]">Unregistered</p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Match ID Link */}
          {request.match_id && (
            <div className="mt-3">
              <a 
                href={`https://www.opendota.com/matches/${request.match_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-harvest hover:text-harvest/80 flex items-center gap-1.5 font-semibold"
              >
                <ExternalLink className="w-4 h-4" />
                Match {request.match_id}
              </a>
            </div>
          )}

          {/* Screenshot Toggle */}
          <div className="mt-4">
            <button
              type="button"
              onClick={handleToggleImage}
              className="flex items-center gap-2 text-sm text-field-dark/60 hover:text-field-dark transition-colors"
            >
              {isImageExpanded ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  Hide Screenshot
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  View Screenshot
                </>
              )}
            </button>
            
            {isImageExpanded && (
              <div className="mt-3">
                <a 
                  href={request.screenshot_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block relative group"
                >
                  <img 
                    src={request.screenshot_url} 
                    alt="MVP Screenshot" 
                    className="w-full max-h-96 object-contain rounded-lg border-2 border-field-dark/10 group-hover:border-harvest/50 transition-all bg-field-dark/5"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = 'https://placehold.co/1280x720/f97316/ffffff?text=Screenshot+Unavailable';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-white" />
                  </div>
                </a>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-4">
            {isPending ? (
              <div className="flex gap-2 flex-wrap">
                {isAdmin ? (
                  <>
                    <Button
                      onClick={() => handleApproveMVP(request)}
                      disabled={actionLoading === request.id}
                      className="flex-1 min-w-[100px] bg-[#10b981] hover:bg-[#10b981]/90"
                    >
                      {actionLoading === request.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleDenyMVP(request.id)}
                      disabled={actionLoading === request.id}
                      variant="outline"
                      className="flex-1 min-w-[100px] border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444]/10"
                    >
                      {actionLoading === request.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-2" />
                          Deny
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleDismissMVP(request.id)}
                      disabled={actionLoading === request.id}
                      variant="outline"
                      className="flex-shrink-0 border-field-dark/20 text-field-dark/50 hover:bg-field-dark/5 hover:text-[#ef4444]"
                    >
                      {actionLoading === request.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => handleCancel(request.id)}
                    disabled={actionLoading === request.id}
                    variant="outline"
                    className="w-full"
                  >
                    {actionLoading === request.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Cancel Request'
                    )}
                  </Button>
                )}
              </div>
            ) : (
              // History section - show delete button for admins/owners
              isAdmin && (
                <Button
                  onClick={() => {
                    setConfirmModal({
                      title: 'Delete Request',
                      message: 'This will PERMANENTLY delete this request, its screenshot, and the associated Discord message. This action cannot be undone.',
                      confirmText: 'Delete Forever',
                      confirmVariant: 'danger',
                      onConfirm: async () => {
                        setActionLoading(request.id);
                        try {
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!session) { alert('Please sign in first'); setActionLoading(null); return; }
                          const response = await fetch(
                            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/mvp-requests/${request.id}`,
                            { method: 'DELETE', headers: { 'Authorization': `Bearer ${session.access_token}` } }
                          );
                          if (!response.ok) {
                            const error = await response.json();
                            alert(error.error || 'Failed to delete request');
                            setActionLoading(null);
                            return;
                          }
                          setSuccessModal({ type: 'success', title: 'Request Deleted', message: 'The request has been permanently deleted.' });
                          invalidateAndRefetch();
                        } catch (error) {
                          console.error('Error deleting request:', error);
                          alert('Failed to delete request. Please try again.');
                        } finally {
                          setActionLoading(null);
                        }
                      }
                    });
                  }}
                  disabled={actionLoading === request.id}
                  variant="outline"
                  className="w-full border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444]/10"
                >
                  {actionLoading === request.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Request
                    </>
                  )}
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header Card */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border-2 border-field-dark/10 mb-4 sm:mb-6">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-xl sm:text-2xl font-bold text-field-dark">
              {isAdmin ? '📋 Admin Requests Panel' : '📄 My Requests'}
            </h2>
            <Button
              onClick={() => {
                setLoading(true);
                fetchRequests(true);
                fetchKkupRequests();
              }}
              disabled={loading || kkupLoading}
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 h-9"
            >
              <RefreshCw className={`w-4 h-4 ${(loading || kkupLoading) ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
          <p className="text-field-dark/70 text-xs sm:text-sm mb-4">
            {isAdmin 
              ? 'Review and approve rank-up requests from all guild members.' 
              : 'Track your rank-up requests and view your submission history.'}
          </p>

          {/* Cache indicator for non-admins */}
          {!isAdmin && cacheTimestamp.current > 0 && !loading && (
            <p className="text-[10px] text-field-dark/40">
              Last updated: {new Date(cacheTimestamp.current).toLocaleTimeString()}
            </p>
          )}

          {/* Tabs — All users get tabs now */}
          <div className="flex items-center gap-2 sm:gap-3 pt-4 border-t border-field-dark/10">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`flex-1 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'all'
                    ? 'bg-harvest text-white'
                    : 'bg-field-dark/5 text-field-dark/70 hover:bg-field-dark/10'
                }`}
              >
                <Shield className="w-4 h-4 inline mr-1" />
                All
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab(isAdmin ? 'my' : 'all')}
              className={`flex-1 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                (isAdmin ? activeTab === 'my' : activeTab === 'all')
                  ? 'bg-harvest text-white'
                  : 'bg-field-dark/5 text-field-dark/70 hover:bg-field-dark/10'
              }`}
            >
              <User className="w-4 h-4 inline mr-1" />
              My Requests
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('kkup')}
              className={`flex-1 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'kkup'
                  ? 'bg-[#8b5cf6] text-white'
                  : 'bg-field-dark/5 text-field-dark/70 hover:bg-field-dark/10'
              }`}
            >
              🌽 {isAdmin ? 'KKup' : 'My KKup'}
              {(isAdmin ? kkupRequests : myKkupRequests).filter(r => r.status === 'pending').length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20">
                  {(isAdmin ? kkupRequests : myKkupRequests).filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Member/Admin View — MVP requests */}
        {activeTab !== 'kkup' && (
        <>
          {loading ? (
            <div className="bg-white rounded-2xl shadow-sm p-6 border-2 border-field-dark/10 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-field-dark/50 mx-auto" />
              <p className="text-sm text-field-dark/70 mt-2">Loading requests...</p>
            </div>
          ) : (
            <>
              {(() => {
                // Filter requests based on active tab
                const filteredPending = isAdmin && activeTab === 'my'
                  ? pendingRequests.filter(r => r.user_id === user.id)
                  : pendingRequests;
                
                const filteredHistory = isAdmin && activeTab === 'my'
                  ? historyRequests.filter(r => r.user_id === user.id)
                  : historyRequests;

                return (
                  <>
                    {/* Pending Requests Section */}
                    <div className="mb-8">
                      <h3 className="text-xl font-bold text-field-dark mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-[#f59e0b]" />
                        Pending Requests
                        <span className="text-sm font-normal text-field-dark/60">({filteredPending.length})</span>
                      </h3>
                      
                      {filteredPending.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-field-dark/10 text-center">
                          <p className="text-sm text-field-dark/70">No pending requests.</p>
                        </div>
                      ) : (
                        <div className="grid gap-4">
                          {filteredPending.map(request => (
                              request.request_type === 'mvp' ? (
                                renderMVPCard(request as RankUpRequest & { request_type: 'mvp' }, true)
                              ) : null
                          ))}
                        </div>
                      )}
                    </div>

                    {/* History Section */}
                    <div>
                      <h3 className="text-xl font-bold text-field-dark mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-[#10b981]" />
                        History
                        <span className="text-sm font-normal text-field-dark/60">({filteredHistory.length})</span>
                      </h3>
                      
                      {filteredHistory.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-field-dark/10 text-center">
                          <p className="text-sm text-field-dark/70">No request history yet.</p>
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-4">
                            {filteredHistory.slice(0, historyOffset + HISTORY_PAGE_SIZE).map(request => (
                              request.request_type === 'mvp' ? (
                                renderMVPCard(request as RankUpRequest & { request_type: 'mvp' })
                              ) : null
                            ))}
                          </div>

                          {/* Load More Button */}
                          {filteredHistory.length > historyOffset + HISTORY_PAGE_SIZE && (
                            <div className="mt-6 text-center">
                              <Button
                                onClick={() => setHistoryOffset(historyOffset + HISTORY_PAGE_SIZE)}
                                className="bg-harvest hover:bg-amber text-white px-8 h-12 rounded-xl font-semibold"
                              >
                                {`Load More (${Math.min(HISTORY_PAGE_SIZE, filteredHistory.length - (historyOffset + HISTORY_PAGE_SIZE))} more)`}
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </>
        )}

        {/* KKup Requests Tab */}
        {activeTab === 'kkup' && (
          <div className="space-y-6">
            {kkupLoading ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 border-2 border-field-dark/10 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-[#8b5cf6] mx-auto" />
                <p className="text-sm text-field-dark/70 mt-2">Loading Kernel Kup requests...</p>
              </div>
            ) : (isAdmin ? kkupRequests : myKkupRequests).length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-8 border-2 border-field-dark/10 text-center">
                <span className="text-4xl mb-3 block">🌽</span>
                <p className="text-field-dark/50 font-semibold">{isAdmin ? 'No Kernel Kup requests' : 'No Kernel Kup activity yet'}</p>
                <p className="text-field-dark/30 text-sm mt-1">{isAdmin ? 'Team approvals and staff applications will appear here.' : 'Your team invites, registrations, and staff applications will show up here.'}</p>
              </div>
            ) : (
              <>
                {/* Pending KKup */}
                {kkupRequests.filter(r => r.status === 'pending').length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-field-dark mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-[#f59e0b]" />
                      Pending
                      <span className="text-sm font-normal text-field-dark/60">({kkupRequests.filter(r => r.status === 'pending').length})</span>
                    </h3>
                    <div className="grid gap-3">
                      {kkupRequests.filter(r => r.status === 'pending').map((req: any) => (
                        <div key={req.id} className={`bg-white rounded-xl border-2 p-4 ${
                          req.request_type === 'kkup_team_approval' ? 'border-[#8b5cf6]/20' : 'border-[#f59e0b]/20'
                        }`}>
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                req.request_type === 'kkup_team_approval' ? 'bg-[#8b5cf6]/10' : 'bg-[#f59e0b]/10'
                              }`}>
                                {req.request_type === 'kkup_team_approval' ? (
                                  <Shield className="w-5 h-5 text-[#8b5cf6]" />
                                ) : (
                                  <User className="w-5 h-5 text-[#f59e0b]" />
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-field-dark text-sm">
                                  {req.request_type === 'kkup_team_approval'
                                    ? `Team "${req.data?.team_name}" — approval needed`
                                    : `Staff: ${req.data?.discord_username} (${req.data?.role_preference})`}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-field-dark/50">
                                  <span className={`font-semibold ${req.request_type === 'kkup_team_approval' ? 'text-[#8b5cf6]' : 'text-[#f59e0b]'}`}>
                                    {req.request_type === 'kkup_team_approval' ? 'Team Approval' : 'Staff Application'}
                                  </span>
                                  <span>·</span>
                                  <span>{req.tournament_name}</span>
                                  <span>·</span>
                                  <span>{new Date(req.created_at).toLocaleDateString()}</span>
                                </div>
                                {req.data?.message && (
                                  <p className="text-xs text-field-dark/60 mt-1 italic">"{req.data.message}"</p>
                                )}
                                {req.request_type === 'kkup_team_approval' && req.data?.captain?.display_name && (
                                  <p className="text-xs text-field-dark/50 mt-0.5">Captain: {req.data.captain.display_name}</p>
                                )}
                              </div>
                            </div>
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#f59e0b]/10 text-[#f59e0b]">
                              Pending
                            </span>
                          </div>
                          {/* Admin action buttons */}
                          {isAdmin && (
                            <div className="flex gap-2 mt-3 pt-3 border-t border-field-dark/10">
                              <Button
                                onClick={() => req.request_type === 'kkup_team_approval'
                                  ? handleKkupTeamAction(req, 'approved')
                                  : handleKkupStaffAction(req, 'approved')}
                                disabled={actionLoading === req.id}
                                className="flex-1 bg-[#10b981] hover:bg-[#10b981]/90 text-white h-9 rounded-lg text-sm font-bold"
                              >
                                {actionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4 mr-1.5" />Approve</>}
                              </Button>
                              <Button
                                onClick={() => req.request_type === 'kkup_team_approval'
                                  ? handleKkupTeamAction(req, 'denied')
                                  : handleKkupStaffAction(req, 'denied')}
                                disabled={actionLoading === req.id}
                                variant="outline"
                                className="flex-1 border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444]/10 h-9 rounded-lg text-sm font-bold"
                              >
                                {actionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4 mr-1.5" />Deny</>}
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resolved KKup */}
                {kkupRequests.filter(r => r.status !== 'pending').length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-field-dark mb-4 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-[#10b981]" />
                      Resolved
                      <span className="text-sm font-normal text-field-dark/60">({kkupRequests.filter(r => r.status !== 'pending').length})</span>
                    </h3>
                    <div className="grid gap-3">
                      {kkupRequests.filter(r => r.status !== 'pending').slice(0, historyOffset + HISTORY_PAGE_SIZE).map((req: any) => (
                        <div key={req.id} className="bg-white rounded-xl border-2 border-field-dark/10 p-4 opacity-70">
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-field-dark/5 flex items-center justify-center">
                                {req.request_type === 'kkup_team_approval' ? (
                                  <Shield className="w-5 h-5 text-field-dark/30" />
                                ) : (
                                  <User className="w-5 h-5 text-field-dark/30" />
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-field-dark text-sm">
                                  {req.request_type === 'kkup_team_approval'
                                    ? `Team "${req.data?.team_name}"`
                                    : `Staff: ${req.data?.discord_username}`}
                                </p>
                                <p className="text-xs text-field-dark/40">{req.tournament_name}</p>
                              </div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              req.status === 'approved' ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#ef4444]/10 text-[#ef4444]'
                            }`}>
                              {req.status === 'approved' ? '✓ Approved' : '✗ Denied'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* My KKup — for non-admin users */}
            {!isAdmin && myKkupRequests.length > 0 && (
              <div className="space-y-4">
                {myKkupRequests.map((req: any) => {
                  const typeConfig: Record<string, { icon: string; label: string; color: string }> = {
                    kkup_my_team: { icon: '🛡️', label: 'Team Created', color: 'border-[#8b5cf6]/20' },
                    kkup_my_registration: { icon: '✅', label: 'Registered', color: 'border-[#3b82f6]/20' },
                    kkup_my_invite: { icon: '📩', label: 'Team Invite', color: 'border-[#f59e0b]/20' },
                    kkup_my_staff: { icon: '📋', label: 'Staff Application', color: 'border-[#10b981]/20' },
                  };
                  const cfg = typeConfig[req.request_type] || { icon: '🌽', label: 'KKup', color: 'border-field-dark/10' };
                  const statusColor = req.status === 'pending' || req.status === 'pending_approval'
                    ? 'bg-[#f59e0b]/10 text-[#f59e0b]'
                    : req.status === 'approved' || req.status === 'registered' || req.status === 'accepted'
                      ? 'bg-[#10b981]/10 text-[#10b981]'
                      : 'bg-[#ef4444]/10 text-[#ef4444]';
                  const statusLabel = req.status === 'pending_approval' ? 'Pending Approval'
                    : req.status?.charAt(0).toUpperCase() + req.status?.slice(1);

                  let subtitle = '';
                  if (req.request_type === 'kkup_my_team') subtitle = `Team "${req.data?.team_name}"`;
                  else if (req.request_type === 'kkup_my_invite') subtitle = `From "${req.data?.team?.team_name || 'a team'}"`;
                  else if (req.request_type === 'kkup_my_staff') subtitle = `Role: ${req.data?.role_preference}`;
                  else if (req.request_type === 'kkup_my_registration') subtitle = 'Player registration';

                  return (
                    <div key={req.id} className={`bg-white rounded-xl border-2 p-4 ${cfg.color}`}>
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{cfg.icon}</span>
                          <div>
                            <p className="font-bold text-field-dark text-sm">{cfg.label}</p>
                            <p className="text-xs text-field-dark/50">{subtitle}</p>
                            <p className="text-[10px] text-field-dark/40 mt-0.5">{req.tournament_name} · {new Date(req.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />

      {/* Modals */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          confirmVariant={confirmModal.confirmVariant}
          onConfirm={() => {
            setConfirmModal(null);
            confirmModal.onConfirm();
          }}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {successModal && (
        <SuccessModal
          type={successModal.type}
          title={successModal.title}
          message={successModal.message}
          helpText={successModal.helpText}
          onClose={() => setSuccessModal(null)}
        />
      )}
    </div>
  );
}