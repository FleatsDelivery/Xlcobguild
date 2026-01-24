import { Footer } from '@/app/components/footer';
import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { Button } from '@/app/components/ui/button';

export function RequestsPage({ user }: { user: any }) {
  const isGuest = user?.role === 'guest';
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (isGuest) {
      fetchRequest();
    } else {
      setLoading(false);
    }
  }, [isGuest]);

  const fetchRequest = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoading(false);
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/requests/membership`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();
      
      if (response.ok) {
        setRequest(data.request);
      }
    } catch (error) {
      console.error('Error fetching request:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!request) return;

    if (!confirm('Are you sure you want to cancel your membership request?')) {
      return;
    }

    setCancelling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert('Please sign in first');
        setCancelling(false);
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/requests/membership/${request.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        alert('Failed to cancel request');
        setCancelling(false);
        return;
      }

      alert('🌽 Request cancelled successfully!');
      window.location.reload();
    } catch (error) {
      console.error('Error cancelling request:', error);
      alert('Failed to cancel request. Please try again.');
      setCancelling(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header Card */}
        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-[#0f172a]/10 mb-6">
          <h2 className="text-2xl font-bold text-[#0f172a] mb-2">
            {isAdmin ? 'Admin Requests' : isGuest ? 'My Membership Request' : 'My Requests'}
          </h2>
          <p className="text-[#0f172a]/70 text-sm">
            {isAdmin 
              ? 'View and manage all pending requests from guild members.' 
              : isGuest 
              ? 'Track the status of your membership application.'
              : 'View your submitted requests and their status.'}
          </p>
        </div>

        {/* Guest View: Membership Request Status */}
        {isGuest && (
          <div className="space-y-4">
            {loading ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 border-2 border-[#0f172a]/10 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-[#0f172a]/50" />
                <p className="text-sm text-[#0f172a]/70 mt-2">Loading request...</p>
              </div>
            ) : request ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 border-2 border-[#0f172a]/10">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#f59e0b]/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-[#f59e0b]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-[#0f172a]">Membership Request</h3>
                      <span className="px-3 py-1 rounded-full bg-[#f59e0b]/10 text-[#f59e0b] text-xs font-semibold">
                        Pending
                      </span>
                    </div>
                    <p className="text-sm text-[#0f172a]/60 mb-3">
                      Submitted on {new Date(request.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                    <p className="text-sm text-[#0f172a]/70 leading-relaxed">
                      Your membership request is being reviewed by guild officers. You'll be notified once a decision is made. This usually takes 1-3,000 business days.
                    </p>
                    <Button
                      className="mt-4"
                      onClick={handleCancelRequest}
                      disabled={cancelling}
                    >
                      {cancelling ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Cancel Request'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-6 border-2 border-[#0f172a]/10 text-center">
                <p className="text-sm text-[#0f172a]/70">No active membership request found.</p>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-[#f97316]/5 rounded-xl p-5 border-2 border-[#f97316]/20">
              <p className="text-sm text-[#0f172a]/70 leading-relaxed">
                <span className="font-semibold text-[#0f172a]">Tip:</span> Make sure you're active in our Discord server! Officers often check Discord activity when reviewing membership requests.
              </p>
            </div>
          </div>
        )}

        {/* Non-Guest, Non-Admin View */}
        {!isGuest && !isAdmin && (
          <div className="bg-white rounded-xl shadow-md p-8 border-2 border-[#0f172a]/10 text-center">
            <p className="text-[#0f172a]/70">
              No active requests. Check back later!
            </p>
          </div>
        )}

        {/* Admin View */}
        {isAdmin && (
          <div className="bg-white rounded-xl shadow-md p-8 border-2 border-[#0f172a]/10 text-center">
            <p className="text-[#0f172a]/70">
              Admin request management coming soon!
            </p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}