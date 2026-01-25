import { Footer } from '@/app/components/footer';
import { Clock, CheckCircle, XCircle, Loader2, ExternalLink, Image as ImageIcon, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { Button } from '@/app/components/ui/button';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { SuccessModal } from '@/app/components/success-modal';

interface RankUpRequest {
  id: string;
  user_id: string;
  type: string;
  screenshot_url: string;
  match_id: string | null;
  opendota_link: string | null;
  status: 'pending' | 'approved' | 'denied';
  current_rank_id: number;
  current_prestige_level: number;
  created_at: string;
  updated_at: string;
  users?: {
    id: string;
    discord_username: string;
    discord_avatar: string | null;
    email: string | null;
    rank_id: number;
    prestige_level: number;
  };
}

interface MembershipRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  updated_at: string;
  users?: {
    id: string;
    discord_username: string;
    discord_avatar: string | null;
    email: string | null;
  };
}

type AnyRequest = (RankUpRequest | MembershipRequest) & { request_type: 'mvp' | 'membership' };

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

export function RequestsPage({ user }: { user: any }) {
  const isGuest = user?.role === 'guest';
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isMember = !isGuest && !isAdmin;
  
  const [pendingRequests, setPendingRequests] = useState<AnyRequest[]>([]);
  const [historyRequests, setHistoryRequests] = useState<AnyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [totalHistoryCount, setTotalHistoryCount] = useState(0);
  const HISTORY_PAGE_SIZE = 10;

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

  useEffect(() => {
    fetchRequests();
  }, [isAdmin]);

  const fetchRequests = async () => {
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

      // Fetch membership requests (only for admins)
      if (isAdmin) {
        const membershipResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/membership-requests`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );

        if (membershipResponse.ok) {
          const membershipData = await membershipResponse.json();
          const membershipRequests = (membershipData.requests || []).map((r: MembershipRequest) => ({
            ...r,
            request_type: 'membership' as const,
          }));
          allRequests = [...allRequests, ...membershipRequests];
        }
      }

      // Sort by created_at (newest first)
      allRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setPendingRequests(allRequests.filter((r: AnyRequest) => r.status === 'pending'));
      setHistoryRequests(allRequests.filter((r: AnyRequest) => r.status !== 'pending'));
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveMVP = async (requestId: string) => {
    setConfirmModal({
      title: 'Approve MVP Request',
      message: 'Approve this MVP request and rank up the user?',
      confirmText: 'Approve',
      confirmVariant: 'success',
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
            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/mvp-requests/${requestId}/approve`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
            }
          );

          if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Failed to approve request');
            setActionLoading(null);
            return;
          }

          setSuccessModal({
            type: 'success',
            title: 'Request Approved',
            message: 'User has been ranked up!',
            helpText: 'You can view the updated rank in the history section.'
          });
          fetchRequests();
        } catch (error) {
          console.error('Error approving request:', error);
          alert('Failed to approve request. Please try again.');
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  const handleApproveMembership = async (requestId: string) => {
    setConfirmModal({
      title: 'Approve Membership Request',
      message: 'Approve this membership request and grant member access?',
      confirmText: 'Approve',
      confirmVariant: 'success',
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
            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/membership-requests/${requestId}/approve`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
            }
          );

          if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Failed to approve membership request');
            setActionLoading(null);
            return;
          }

          setSuccessModal({
            type: 'success',
            title: 'Membership Approved',
            message: 'User is now a member!',
            helpText: 'You can view the updated status in the history section.'
          });
          fetchRequests();
        } catch (error) {
          console.error('Error approving membership request:', error);
          alert('Failed to approve membership request. Please try again.');
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  const handleDenyMVP = async (requestId: string) => {
    setConfirmModal({
      title: 'Deny MVP Request',
      message: 'Deny this MVP request? The request will remain in history.',
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
            type: 'success',
            title: 'Request Denied',
            message: 'Request has been denied.',
            helpText: 'You can view the updated status in the history section.'
          });
          fetchRequests();
        } catch (error) {
          console.error('Error denying request:', error);
          alert('Failed to deny request. Please try again.');
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  const handleDenyMembership = async (requestId: string) => {
    setConfirmModal({
      title: 'Deny Membership Request',
      message: 'Deny this membership request?',
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
            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/membership-requests/${requestId}/deny`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
            }
          );

          if (!response.ok) {
            const error = await response.json();
            alert(error.error || 'Failed to deny membership request');
            setActionLoading(null);
            return;
          }

          setSuccessModal({
            type: 'success',
            title: 'Membership Request Denied',
            message: 'Request has been denied.',
            helpText: 'You can view the updated status in the history section.'
          });
          fetchRequests();
        } catch (error) {
          console.error('Error denying membership request:', error);
          alert('Failed to deny membership request. Please try again.');
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  const handleCancel = async (requestId: string) => {
    setConfirmModal({
      title: 'Cancel MVP Request',
      message: 'Cancel this MVP request?',
      confirmText: 'Cancel',
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

          // For now, use the deny endpoint to cancel (sets status to denied)
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
            alert(error.error || 'Failed to cancel request');
            setActionLoading(null);
            return;
          }

          setSuccessModal({
            type: 'success',
            title: 'Request Cancelled',
            message: 'Request has been cancelled.',
            helpText: 'You can view the updated status in the history section.'
          });
          fetchRequests();
        } catch (error) {
          console.error('Error cancelling request:', error);
          alert('Failed to cancel request. Please try again.');
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  const MVPRequestCard = ({ request }: { request: RankUpRequest & { request_type: 'mvp' } }) => {
    const isPending = request.status === 'pending';
    const isApproved = request.status === 'approved';
    const isDenied = request.status === 'denied';
    const requestUser = request.users;

    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-[#0f172a]/10">
        {/* Header with User Info (for admins) */}
        {isAdmin && requestUser && (
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#0f172a]/10">
            {requestUser.discord_avatar ? (
              <img 
                src={requestUser.discord_avatar} 
                alt={requestUser.discord_username}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#f97316]/10 flex items-center justify-center">
                <span className="text-[#f97316] font-bold text-sm">
                  {requestUser.discord_username[0].toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1">
              <p className="font-semibold text-[#0f172a]">{requestUser.discord_username}</p>
              <p className="text-xs text-[#0f172a]/60">
                {RANK_NAMES[request.current_rank_id]} (Prestige {request.current_prestige_level})
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              isPending ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
              isApproved ? 'bg-[#10b981]/10 text-[#10b981]' :
              'bg-[#ef4444]/10 text-[#ef4444]'
            }`}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </span>
          </div>
        )}

        {/* Status Badge for Non-Admins */}
        {!isAdmin && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {isPending && <Clock className="w-5 h-5 text-[#f59e0b]" />}
              {isApproved && <CheckCircle className="w-5 h-5 text-[#10b981]" />}
              {isDenied && <XCircle className="w-5 h-5 text-[#ef4444]" />}
              <span className="font-semibold text-[#0f172a]">MVP Screenshot</span>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              isPending ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
              isApproved ? 'bg-[#10b981]/10 text-[#10b981]' :
              'bg-[#ef4444]/10 text-[#ef4444]'
            }`}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </span>
          </div>
        )}

        {/* Screenshot Preview */}
        <div className="mb-4">
          <a 
            href={request.screenshot_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block relative group"
          >
            <img 
              src={request.screenshot_url} 
              alt="MVP Screenshot" 
              className="w-full h-48 object-cover rounded-lg border-2 border-[#0f172a]/10 group-hover:border-[#f97316]/50 transition-all"
              onError={(e) => {
                e.currentTarget.src = 'https://placehold.co/800x400/f97316/ffffff?text=Screenshot+Unavailable';
              }}
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-white" />
            </div>
          </a>
        </div>

        {/* Match Info */}
        {(request.match_id || request.opendota_link) && (
          <div className="mb-4 space-y-2">
            {request.match_id && (
              <p className="text-sm text-[#0f172a]/70">
                <span className="font-semibold">Match ID:</span> {request.match_id}
              </p>
            )}
            {request.opendota_link && (
              <a 
                href={request.opendota_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#f97316] hover:text-[#f97316]/80 flex items-center gap-1"
              >
                View on OpenDota <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Submission Date */}
        <p className="text-xs text-[#0f172a]/60 mb-4">
          Submitted {new Date(request.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>

        {/* Action Buttons */}
        {isPending && (
          <div className="flex gap-2">
            {isAdmin ? (
              <>
                <Button
                  onClick={() => handleApproveMVP(request.id)}
                  disabled={actionLoading === request.id}
                  className="flex-1 bg-[#10b981] hover:bg-[#10b981]/90"
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
                  className="flex-1 border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444]/10"
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
        )}
      </div>
    );
  };

  const MembershipRequestCard = ({ request }: { request: MembershipRequest & { request_type: 'membership' } }) => {
    const isPending = request.status === 'pending';
    const isApproved = request.status === 'approved';
    const isDenied = request.status === 'denied';
    const requestUser = request.users;

    return (
      <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-[#f97316]/20">
        {/* Header with User Info */}
        {requestUser && (
          <div className="flex items-center gap-3 mb-4">
            {requestUser.discord_avatar ? (
              <img 
                src={requestUser.discord_avatar} 
                alt={requestUser.discord_username}
                className="w-12 h-12 rounded-full"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#f97316]/10 flex items-center justify-center">
                <span className="text-[#f97316] font-bold">
                  {requestUser.discord_username[0].toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#f97316]" />
                <p className="font-semibold text-[#0f172a]">Membership Request</p>
              </div>
              <p className="text-sm text-[#0f172a]">{requestUser.discord_username}</p>
              {requestUser.email && (
                <p className="text-xs text-[#0f172a]/60">{requestUser.email}</p>
              )}
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              isPending ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
              isApproved ? 'bg-[#10b981]/10 text-[#10b981]' :
              'bg-[#ef4444]/10 text-[#ef4444]'
            }`}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </span>
          </div>
        )}

        {/* Submission Date */}
        <p className="text-xs text-[#0f172a]/60 mb-4">
          Submitted {new Date(request.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>

        {/* Action Buttons */}
        {isPending && isAdmin && (
          <div className="flex gap-2">
            <Button
              onClick={() => handleApproveMembership(request.id)}
              disabled={actionLoading === request.id}
              className="flex-1 bg-[#10b981] hover:bg-[#10b981]/90"
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
              onClick={() => handleDenyMembership(request.id)}
              disabled={actionLoading === request.id}
              variant="outline"
              className="flex-1 border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444]/10"
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
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header Card */}
        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-[#0f172a]/10 mb-6">
          <h2 className="text-2xl font-bold text-[#0f172a] mb-2">
            {isAdmin ? 'Manage Requests' : 'My Requests'}
          </h2>
          <p className="text-[#0f172a]/70 text-sm">
            {isAdmin 
              ? 'Review and approve membership applications and rank-up requests from guild members.' 
              : 'Track your rank-up requests and view your submission history.'}
          </p>
        </div>

        {/* Guest View */}
        {isGuest && (
          <div className="bg-white rounded-xl shadow-md p-8 border-2 border-[#0f172a]/10 text-center">
            <p className="text-[#0f172a]/70">
              You must be a member to submit MVP requests for rank-ups.
            </p>
          </div>
        )}

        {/* Member/Admin View */}
        {!isGuest && (
          <>
            {loading ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 border-2 border-[#0f172a]/10 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-[#0f172a]/50 mx-auto" />
                <p className="text-sm text-[#0f172a]/70 mt-2">Loading requests...</p>
              </div>
            ) : (
              <>
                {/* Pending Requests Section */}
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-[#0f172a] mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#f59e0b]" />
                    Pending Requests
                    <span className="text-sm font-normal text-[#0f172a]/60">({pendingRequests.length})</span>
                  </h3>
                  
                  {pendingRequests.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-[#0f172a]/10 text-center">
                      <p className="text-sm text-[#0f172a]/70">No pending requests.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {pendingRequests.map(request => (
                        request.request_type === 'mvp' ? (
                          <MVPRequestCard key={request.id} request={request as RankUpRequest & { request_type: 'mvp' }} />
                        ) : (
                          <MembershipRequestCard key={request.id} request={request as MembershipRequest & { request_type: 'membership' }} />
                        )
                      ))}
                    </div>
                  )}
                </div>

                {/* History Section */}
                <div>
                  <h3 className="text-xl font-bold text-[#0f172a] mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-[#10b981]" />
                    History
                    <span className="text-sm font-normal text-[#0f172a]/60">({historyRequests.length})</span>
                  </h3>
                  
                  {historyRequests.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-6 border-2 border-[#0f172a]/10 text-center">
                      <p className="text-sm text-[#0f172a]/70">No request history yet.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-4">
                        {historyRequests.slice(0, historyOffset + HISTORY_PAGE_SIZE).map(request => (
                          request.request_type === 'mvp' ? (
                            <MVPRequestCard key={request.id} request={request as RankUpRequest & { request_type: 'mvp' }} />
                          ) : (
                            <MembershipRequestCard key={request.id} request={request as MembershipRequest & { request_type: 'membership' }} />
                          )
                        ))}
                      </div>

                      {/* Load More Button */}
                      {historyRequests.length > historyOffset + HISTORY_PAGE_SIZE && (
                        <div className="mt-6 text-center">
                          <Button
                            onClick={() => setHistoryOffset(historyOffset + HISTORY_PAGE_SIZE)}
                            disabled={loadingMore}
                            className="bg-[#f97316] hover:bg-[#ea580c] text-white px-8 h-12 rounded-xl font-semibold"
                          >
                            {loadingMore ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              `Load More (${Math.min(HISTORY_PAGE_SIZE, historyRequests.length - (historyOffset + HISTORY_PAGE_SIZE))} more)`
                            )}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </>
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