import { Footer } from '@/app/components/footer';
import { Button } from '@/app/components/ui/button';
import { UserPlus, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId, publicAnonKey } from '/utils/supabase/info';

export function HomePage({ user }: { user: any }) {
  const isGuest = user?.role === 'guest';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRequest, setHasRequest] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(true);

  useEffect(() => {
    if (isGuest) {
      checkExistingRequest();
    } else {
      setLoadingRequest(false);
    }
  }, [isGuest]);

  const checkExistingRequest = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoadingRequest(false);
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
      
      if (response.ok && data.request) {
        setHasRequest(true);
      }
    } catch (error) {
      console.error('Error checking request:', error);
    } finally {
      setLoadingRequest(false);
    }
  };

  const handleSubmitRequest = async () => {
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert('Please sign in first');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/requests/membership`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to submit request');
        setIsSubmitting(false);
        return;
      }

      alert('🌽 Membership request submitted! Check the Requests tab to track its status.');
      window.location.reload();
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('Failed to submit request. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Welcome Card */}
        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-[#0f172a]/10">
          <h2 className="text-2xl font-bold text-[#0f172a] mb-4">
            Welcome, {user?.discord_username || 'Corny Friend'}!
          </h2>
          <p className="text-[#0f172a]/70">
            {isGuest 
              ? "You're currently a guest. Submit a membership request to join The Corn Field guild!" 
              : "This is your guild home. Features coming soon!"}
          </p>
        </div>

        {isGuest ? (
          /* Guest: Membership Request Section */
          <>
            {loadingRequest ? (
              <div className="bg-white rounded-2xl shadow-sm p-8 border-2 border-[#0f172a]/10 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-[#f97316] mx-auto mb-2" />
                <p className="text-sm text-[#0f172a]/70">Checking request status...</p>
              </div>
            ) : hasRequest ? (
              <div className="bg-gradient-to-br from-[#10b981]/10 to-[#10b981]/5 rounded-3xl p-8 border-2 border-[#10b981]/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#10b981] flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0f172a] mb-2">Request Submitted! 🌽</h3>
                    <p className="text-[#0f172a]/70 text-sm leading-relaxed">
                      Your membership request is being reviewed. Check the <span className="font-medium text-[#f97316]">Requests</span> tab to track its status and manage your request.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-gradient-to-br from-[#f97316]/10 to-[#f97316]/5 rounded-3xl p-8 border-2 border-[#f97316]/20">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-[#f97316] flex items-center justify-center flex-shrink-0">
                      <UserPlus className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[#0f172a] mb-2">Request Membership</h3>
                      <p className="text-[#0f172a]/70 text-sm leading-relaxed">
                        Ready to become a member of The Corn Field? Submit a membership request to gain full access to the guild, leaderboard, and all features.
                      </p>
                    </div>
                  </div>

                  <Button className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white h-12 rounded-xl font-semibold" onClick={handleSubmitRequest} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Membership Request'}
                  </Button>
                </div>

                <div className="bg-[#3b82f6]/5 rounded-2xl p-6 border-2 border-[#3b82f6]/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-[#3b82f6] flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-[#0f172a] mb-1">What happens next?</h4>
                      <p className="text-sm text-[#0f172a]/70 leading-relaxed">
                        Your request will be reviewed by guild officers. You can check the status of your request in the <span className="font-medium text-[#f97316]">Requests</span> tab. Once approved, you'll gain full access to all guild features!
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          /* Member: Progress Card */
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-[#0f172a]/10">
            <h3 className="text-lg font-bold text-[#0f172a] mb-2">Your Progress</h3>
            <div className="space-y-2">
              <p className="text-[#0f172a]/70">
                <span className="font-medium">Rank:</span> {user?.ranks?.name || 'Earwig'}
              </p>
              <p className="text-[#0f172a]/70">
                <span className="font-medium">Prestige Level:</span> {user?.prestige_level || 0}
              </p>
              <p className="text-[#0f172a]/70">
                <span className="font-medium">Role:</span> {user?.role || 'guest'}
              </p>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}