import { UserManagement } from '@/app/components/user-management';
import { MvpSubmissionForm } from '@/app/components/mvp-submission-form';
import { Footer } from '@/app/components/footer';
import { Button } from '@/app/components/ui/button';
import { UserPlus, AlertCircle, Loader2, CheckCircle, ExternalLink, Gamepad2, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { SuccessModal } from '@/app/components/success-modal';

export function HomePage({ user }: { user: any }) {
  const isGuest = user?.role === 'guest';
  const isOwner = user?.role === 'owner';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRequest, setHasRequest] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [refreshingOpenDota, setRefreshingOpenDota] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    helpText?: string;
  } | null>(null);

  // Rank emojis mapping
  const rankEmojis = [
    '🐛', // 1. Earwig
    '🦌', // 2. Ugandan Kob
    '🌽', // 3. Private Maize
    '🥄', // 4. Specialist Ingredient
    '🍞', // 5. Corporal Corn Bread
    '🌾', // 6. Sergeant Husk
    '🌻', // 7. Sergeant Major Fields
    '🎯', // 8. Captain Cornhole
    '⭐', // 9. Major Cob
    '🌟', // 10. Corn Star
    '💥', // 11. Pop'd Kernel (prestige 5 only)
  ];

  // Rank names mapping
  const rankNames = [
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

  // Get display name based on role
  const getDisplayRank = () => {
    if (user?.role === 'guest') return 'Not Yet Ranked';
    return user?.ranks?.name || 'Earwig';
  };

  // Get next rank name
  const getNextRankName = () => {
    if (currentRankId >= maxRanks) {
      if (prestigeLevel < 5) return 'Ready for Prestige!';
      return 'Max Rank Achieved!';
    }
    return rankNames[currentRankId]; // currentRankId is the next rank (index is currentRankId - 1 + 1)
  };

  // Calculate rank progression
  const currentRankId = user?.rank_id || 1;
  const prestigeLevel = user?.prestige_level || 0;
  const maxRanks = prestigeLevel === 5 ? 11 : 10;
  const displayRanks = prestigeLevel === 5 ? 11 : 10;

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
    setShowConfirm(false);
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setResult({
          type: 'error',
          title: 'Authentication Error',
          message: 'Please sign in first',
        });
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
        setResult({
          type: 'error',
          title: 'Request Failed',
          message: data.error || 'Failed to submit membership request. Please try again.',
        });
        setIsSubmitting(false);
        return;
      }

      setResult({
        type: 'success',
        title: 'Request Submitted! 🌽',
        message: 'Your membership request has been submitted successfully.',
        helpText: 'Navigate to the Requests page to track the status of your request. Guild officers will review it shortly!',
      });

      setIsSubmitting(false);
      
      // Reload after showing success
      setTimeout(() => {
        window.location.reload();
      }, 2500);
    } catch (error) {
      console.error('Error submitting request:', error);
      setResult({
        type: 'error',
        title: 'Request Failed',
        message: 'An unexpected error occurred. Please try again.',
      });
      setIsSubmitting(false);
    }
  };

  const handleRefreshAllOpenDota = async () => {
    setRefreshingOpenDota(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setResult({
          type: 'error',
          title: 'Authentication Error',
          message: 'Please sign in first',
        });
        setRefreshingOpenDota(false);
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/opendota/refresh-all`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setResult({
          type: 'error',
          title: 'Refresh Failed',
          message: data.error || 'Failed to refresh OpenDota accounts. Please try again.',
        });
        setRefreshingOpenDota(false);
        return;
      }

      setResult({
        type: 'success',
        title: 'OpenDota Refresh Complete! 🎮',
        message: `Successfully refreshed ${data.refreshed} accounts${data.failed > 0 ? `. ${data.failed} failed.` : '.'}`,
        helpText: 'All connected OpenDota accounts have been synced with the latest data.',
      });

      setRefreshingOpenDota(false);
    } catch (error) {
      console.error('Error refreshing OpenDota accounts:', error);
      setResult({
        type: 'error',
        title: 'Refresh Failed',
        message: 'An unexpected error occurred. Please try again.',
      });
      setRefreshingOpenDota(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {isGuest ? (
          /* Guest: Welcome Card */
          <>
            <div className="bg-gradient-to-br from-[#f97316]/10 to-[#f97316]/5 rounded-3xl p-8 border-2 border-[#f97316]/20">
              <h2 className="text-3xl font-bold text-[#0f172a] mb-2">
                Welcome, {user?.discord_username || 'Corny Friend'}! 🌽
              </h2>
              <p className="text-[#0f172a]/70">
                You're currently a guest. Submit a membership request below to join The Corn Field guild!
              </p>
            </div>

            {/* Guest: Membership Request Section */}
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

                  <Button className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white h-12 rounded-xl font-semibold" onClick={() => setShowConfirm(true)} disabled={isSubmitting}>
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
          /* Member: Welcome + Rank Progress Section */
          <div className="bg-gradient-to-br from-[#f97316]/10 to-[#f97316]/5 rounded-3xl p-8 border-2 border-[#f97316]/20">
            {/* Header Section */}
            <div className="flex items-center justify-between pb-6 border-b-2 border-[#f97316]/20 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#0f172a]">
                  Welcome back, {user?.discord_username}!
                </h2>
              </div>
              <div className="text-right">
                <p className="text-sm text-[#0f172a]/60 mb-1">Rank Progress</p>
                <p className="text-2xl font-bold text-[#0f172a]">
                  {currentRankId}/{maxRanks}
                </p>
              </div>
            </div>

            {/* Current Rank Display */}
            <div className="flex items-center gap-4 mb-6">
              <div className="text-5xl">
                {rankEmojis[currentRankId - 1]}
              </div>
              <div>
                <p className="text-3xl font-bold text-[#f97316]">{getDisplayRank()}</p>
                {prestigeLevel > 0 && (
                  <p className="text-sm text-[#0f172a]/60 font-semibold">
                    ⭐ Prestige Level {prestigeLevel}
                  </p>
                )}
              </div>
            </div>

            {/* Rank Progression Bar */}
            <div className="space-y-2 mb-6">
              <div className="h-3 bg-[#0f172a]/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#f97316] to-[#ea580c] transition-all duration-500 rounded-full"
                  style={{ width: `${(currentRankId / maxRanks) * 100}%` }}
                />
              </div>
            </div>

            {/* All Ranks Visual with Hover Effects */}
            <div className="flex items-center justify-between gap-1 flex-wrap mb-4">
              {Array.from({ length: displayRanks }).map((_, index) => {
                const rankNumber = index + 1;
                const isUnlocked = rankNumber <= currentRankId;
                const isCurrent = rankNumber === currentRankId;
                const emoji = rankEmojis[index];
                const rankName = rankNames[index];
                
                return (
                  <div
                    key={rankNumber}
                    className="group relative flex flex-col items-center transition-all"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <div className="bg-[#0f172a] text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap shadow-lg">
                        {rankName}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-[#0f172a] rotate-45"></div>
                      </div>
                    </div>

                    {/* Emoji with hover effects */}
                    <div
                      className={`text-2xl mb-1 transition-all duration-300 cursor-pointer ${
                        isUnlocked ? 'opacity-100' : 'opacity-30 grayscale'
                      } ${
                        isCurrent ? 'scale-125 animate-pulse' : ''
                      } group-hover:scale-150 group-hover:drop-shadow-[0_0_12px_rgba(249,115,22,0.8)]`}
                    >
                      {emoji}
                    </div>
                    
                    {/* Progress indicator */}
                    <div
                      className={`h-1 w-6 rounded-full transition-all ${
                        isUnlocked ? 'bg-[#f97316]' : 'bg-[#0f172a]/10'
                      }`}
                    />
                    
                    {/* Current rank label */}
                    {isCurrent && (
                      <div className="text-[10px] text-[#f97316] font-bold mt-1">YOU</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Next Rank Display - Bottom Right */}
            <div className="text-right">
              <p className="text-sm text-[#0f172a]/60">
                Next Rank: <span className="font-semibold text-[#f97316]">{getNextRankName()}</span>
              </p>
            </div>
          </div>
        )}

        {/* Owner: User Management Section */}
        {isOwner && <UserManagement />}

        {/* Owner: OpenDota Refresh Section */}
        {isOwner && (
          <div className="bg-gradient-to-br from-[#3b82f6]/10 to-[#3b82f6]/5 rounded-3xl p-8 border-2 border-[#3b82f6]/20">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-[#3b82f6] flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#0f172a] mb-2">OpenDota Sync Control</h3>
                <p className="text-[#0f172a]/70 text-sm leading-relaxed">
                  Manually refresh all connected OpenDota accounts to sync the latest Dota 2 stats. This will update badge ranks, top heroes, and player data for all guild members.
                </p>
              </div>
            </div>

            <Button 
              className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white h-12 rounded-xl font-semibold" 
              onClick={handleRefreshAllOpenDota}
              disabled={refreshingOpenDota}
            >
              {refreshingOpenDota ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Refreshing All Accounts...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Refresh All OpenDota Accounts
                </>
              )}
            </Button>

            <div className="mt-4 bg-[#3b82f6]/10 rounded-xl p-4 border-2 border-[#3b82f6]/20">
              <p className="text-xs text-[#0f172a]/70 leading-relaxed">
                💡 <span className="font-semibold">Owner Tip:</span> OpenDota accounts are automatically synced when users log in (if 2+ hours have passed). Use this manual refresh if you need to update stats immediately for all members at once.
              </p>
            </div>
          </div>
        )}
        
        {/* Test Forms Section (for testing MVP submissions) */}
        {!isGuest && <MvpSubmissionForm />}

        {/* Custom Games Section - All Logged In Users */}
        <div className="bg-white rounded-3xl p-8 border-2 border-[#0f172a]/10 mt-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-[#f97316] flex items-center justify-center">
              <Gamepad2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-[#0f172a]">Custom Dota 2 Games</h3>
              <p className="text-sm text-[#0f172a]/60">Vibe coded with love by jeffwonderpouch 🌽</p>
            </div>
          </div>

          {/* Game Cards - Responsive Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Heaps N' Reaps */}
            <a
              href="https://steamcommunity.com/sharedfiles/filedetails/?id=3585929337"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-gradient-to-br from-[#f97316]/10 to-[#f97316]/5 rounded-2xl p-6 border-2 border-[#f97316]/20 hover:border-[#f97316]/50 transition-all hover:shadow-lg hover:scale-105"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-3xl">🌾</div>
                <ExternalLink className="w-5 h-5 text-[#0f172a]/40 group-hover:text-[#f97316] transition-colors" />
              </div>
              <h4 className="text-xl font-bold text-[#0f172a] mb-2 group-hover:text-[#f97316] transition-colors">
                Heaps N' Reaps
              </h4>
              <p className="text-sm text-[#0f172a]/70 leading-relaxed mb-4">
                A farming frenzy where you collect resources and build your agricultural empire in Dota 2!
              </p>
              <div className="flex items-center gap-2 text-xs text-[#0f172a]/60">
                <span className="px-2 py-1 bg-[#f97316]/10 rounded-full">Solo Project</span>
              </div>
            </a>

            {/* Hide & Heap */}
            <a
              href="https://steamcommunity.com/sharedfiles/filedetails/?id=3580844386"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-gradient-to-br from-[#10b981]/10 to-[#10b981]/5 rounded-2xl p-6 border-2 border-[#10b981]/20 hover:border-[#10b981]/50 transition-all hover:shadow-lg hover:scale-105"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-3xl">👁️</div>
                <ExternalLink className="w-5 h-5 text-[#0f172a]/40 group-hover:text-[#10b981] transition-colors" />
              </div>
              <h4 className="text-xl font-bold text-[#0f172a] mb-2 group-hover:text-[#10b981] transition-colors">
                Hide & Heap
              </h4>
              <p className="text-sm text-[#0f172a]/70 leading-relaxed mb-4">
                A thrilling hide-and-seek experience with unique Dota mechanics. Can you outsmart your friends?
              </p>
              <div className="flex items-center gap-2 text-xs text-[#0f172a]/60">
                <span className="px-2 py-1 bg-[#10b981]/10 rounded-full">w/ @businessCasual</span>
              </div>
            </a>

            {/* Axe's Dunk Contest */}
            <a
              href="https://steamcommunity.com/sharedfiles/filedetails/?id=3592388680"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-gradient-to-br from-[#ef4444]/10 to-[#ef4444]/5 rounded-2xl p-6 border-2 border-[#ef4444]/20 hover:border-[#ef4444]/50 transition-all hover:shadow-lg hover:scale-105"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-3xl">🏀</div>
                <ExternalLink className="w-5 h-5 text-[#0f172a]/40 group-hover:text-[#ef4444] transition-colors" />
              </div>
              <h4 className="text-xl font-bold text-[#0f172a] mb-2 group-hover:text-[#ef4444] transition-colors">
                Axe's Dunk Contest
              </h4>
              <p className="text-sm text-[#0f172a]/70 leading-relaxed mb-4">
                Show off your dunking skills as Axe! Compete for the highest score in this action-packed mini-game.
              </p>
              <div className="flex items-center gap-2 text-xs text-[#0f172a]/60">
                <span className="px-2 py-1 bg-[#ef4444]/10 rounded-full">Solo Project</span>
              </div>
            </a>
          </div>

          {/* Footer note */}
          <div className="mt-6 pt-6 border-t border-[#0f172a]/10">
            <p className="text-sm text-[#0f172a]/60 text-center">
              Click any game card to view it on the Steam Workshop! 🎮
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <ConfirmModal
          title="Submit Membership Request"
          message="Ready to join The Corn Field guild? Submit your membership request to gain full access to all features!"
          confirmText="Submit Request"
          cancelText="Cancel"
          confirmVariant="primary"
          onConfirm={handleSubmitRequest}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Result Modal */}
      {result && (
        <SuccessModal
          type={result.type}
          title={result.title}
          message={result.message}
          helpText={result.helpText}
          onClose={() => setResult(null)}
        />
      )}

      <Footer />
    </div>
  );
}