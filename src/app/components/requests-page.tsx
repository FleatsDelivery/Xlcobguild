import { Footer } from '@/app/components/footer';
import { Clock, CheckCircle, XCircle, Loader2, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { Button } from '@/app/components/ui/button';

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

const RANK_NAMES = [
  '', // 0 index unused
  'Earwig', 'Seedling', 'Sprout', 'Young Stalk', 'Corn Stalk',
  'Ear of Corn', 'Golden Ear', 'Corn Cob', 'Buttered Cob', 'Pop\'d Kernel'
];

export function RequestsPage({ user }: { user: any }) {
  const isGuest = user?.role === 'guest';
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isMember = !isGuest && !isAdmin;
  
  const [pendingRequests, setPendingRequests] = useState<RankUpRequest[]>([]);
  const [historyRequests, setHistoryRequests] = useState<RankUpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

      const endpoint = isAdmin 
        ? `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/mvp-requests`
        : `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/requests/mvp/my`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        const requests = data.requests || [];
        setPendingRequests(requests.filter((r: RankUpRequest) => r.status === 'pending'));
        setHistoryRequests(requests.filter((r: RankUpRequest) => r.status !== 'pending'));
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    if (!confirm('Approve this MVP request and rank up the user?')) return;

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

      alert('🌽 Request approved and user ranked up!');
      fetchRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Failed to approve request. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeny = async (requestId: string) => {
    if (!confirm('Deny this MVP request? The request will remain in history.')) return;

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

      alert('Request denied.');
      fetchRequests();
    } catch (error) {
      console.error('Error denying request:', error);
      alert('Failed to deny request. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    if (!confirm('Cancel this MVP request?')) return;

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

      alert('🌽 Request cancelled.');
      fetchRequests();
    } catch (error) {
      console.error('Error cancelling request:', error);
      alert('Failed to cancel request. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const RequestCard = ({ request }: { request: RankUpRequest }) => {
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
                  onClick={() => handleApprove(request.id)}
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
                  onClick={() => handleDeny(request.id)}
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

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header Card */}
        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-[#0f172a]/10 mb-6">
          <h2 className="text-2xl font-bold text-[#0f172a] mb-2">
            {isAdmin ? 'Manage MVP Requests' : 'My MVP Requests'}
          </h2>
          <p className="text-[#0f172a]/70 text-sm">
            {isAdmin 
              ? 'Review and approve MVP screenshots from guild members.' 
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
                        <RequestCard key={request.id} request={request} />
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
                    <div className="grid gap-4">
                      {historyRequests.map(request => (
                        <RequestCard key={request.id} request={request} />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}
