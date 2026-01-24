import { UserManagement } from '@/app/components/user-management';
import { MvpSubmissionForm } from '@/app/components/mvp-submission-form';
import { Footer } from '@/app/components/footer';
import { Button } from '@/app/components/ui/button';
import { UserPlus, AlertCircle, Loader2, CheckCircle, ExternalLink, Gamepad2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId, publicAnonKey } from '/utils/supabase/info';

export function HomePage({ user }: { user: any }) {
  const isGuest = user?.role === 'guest';
  const isOwner = user?.role === 'owner';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRequest, setHasRequest] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(true);

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

  // Get display name based on role
  const getDisplayRank = () => {
    if (user?.role === 'guest') return 'Not Yet Ranked';
    return user?.ranks?.name || 'Earwig';
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
          /* Member: Welcome + Rank Progress Section */
          <div className="bg-gradient-to-br from-[#f97316]/10 to-[#f97316]/5 rounded-3xl p-8 border-2 border-[#f97316]/20">
            {/* Welcome Header with Rank */}
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-[#0f172a] mb-2">
                  Welcome back, {user?.discord_username}! 🌽
                </h2>
                <div className="flex items-center gap-3">
                  <div className="text-4xl">
                    {rankEmojis[currentRankId - 1]}
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#f97316]">{getDisplayRank()}</p>
                    {prestigeLevel > 0 && (
                      <p className="text-sm text-[#0f172a]/60 font-semibold">
                        ⭐ Prestige Level {prestigeLevel}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-[#0f172a]/60 mb-1">Rank Progress</p>
                <p className="text-3xl font-bold text-[#0f172a]">
                  {currentRankId}/{maxRanks}
                </p>
              </div>
            </div>

            {/* Rank Progression Bar */}
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-xs text-[#0f172a]/60">
                <span>
                  {currentRankId < maxRanks 
                    ? `Next rank: ${currentRankId + 1}/${maxRanks}` 
                    : prestigeLevel < 5 
                      ? '🎉 Max rank! Ready for prestige?' 
                      : '👑 Ultimate rank achieved!'}
                </span>
                <span>{Math.round((currentRankId / maxRanks) * 100)}%</span>
              </div>
              <div className="h-3 bg-[#0f172a]/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#f97316] to-[#ea580c] transition-all duration-500 rounded-full"
                  style={{ width: `${(currentRankId / maxRanks) * 100}%` }}
                />
              </div>
            </div>

            {/* All Ranks Visual */}
            <div className="flex items-center justify-between gap-1 flex-wrap">
              {Array.from({ length: displayRanks }).map((_, index) => {
                const rankNumber = index + 1;
                const isUnlocked = rankNumber <= currentRankId;
                const isCurrent = rankNumber === currentRankId;
                const emoji = rankEmojis[index];
                
                return (
                  <div
                    key={rankNumber}
                    className={`flex flex-col items-center transition-all ${
                      isUnlocked ? 'opacity-100 scale-100' : 'opacity-30 scale-90'
                    }`}
                  >
                    <div
                      className={`text-2xl mb-1 transition-transform ${
                        isCurrent ? 'scale-125 animate-pulse' : ''
                      }`}
                    >
                      {emoji}
                    </div>
                    <div
                      className={`h-1 w-6 rounded-full ${
                        isUnlocked ? 'bg-[#f97316]' : 'bg-[#0f172a]/10'
                      }`}
                    />
                    {isCurrent && (
                      <div className="text-[10px] text-[#f97316] font-bold mt-1">YOU</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Owner: User Management Section */}
        {isOwner && <UserManagement />}
        
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

      <Footer />
    </div>
  );
}