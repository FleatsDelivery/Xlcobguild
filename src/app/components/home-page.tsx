import { MvpSubmissionForm } from '@/app/components/mvp-submission-form';
import { Footer } from '@/app/components/footer';
import { Button } from '@/app/components/ui/button';
import { UserPlus, AlertCircle, Loader2, CheckCircle, ExternalLink, Gamepad2, RefreshCw, Popcorn, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { SuccessModal } from '@/app/components/success-modal';

export function HomePage({ user, onRefresh }: { user: any; onRefresh?: () => Promise<void> }) {
  const isGuest = user?.role === 'guest';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRequest, setHasRequest] = useState(false);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [rankActions, setRankActions] = useState<any[]>([]);
  const [loadingActions, setLoadingActions] = useState(true);
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
      fetchRankActions();
    }
  }, [isGuest, user?.id]);

  const fetchRankActions = async () => {
    if (!user?.id) {
      setLoadingActions(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoadingActions(false);
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/rank-actions/${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRankActions(data.actions || []);
      }
    } catch (error) {
      console.error('Error fetching rank actions:', error);
    } finally {
      setLoadingActions(false);
    }
  };

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

      if (response.ok) {
        const data = await response.json();
        setHasRequest(data.hasRequest);
      }
    } catch (error) {
      console.error('Error checking membership request:', error);
    } finally {
      setLoadingRequest(false);
    }
  };

  const handleMembershipRequest = async () => {
    if (isSubmitting) return;

    setShowConfirm(true);
  };

  const submitMembershipRequest = async () => {
    setIsSubmitting(true);
    setShowConfirm(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setResult({
          type: 'error',
          title: 'Not Signed In',
          message: 'Please sign in to submit a membership request.',
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

      if (!response.ok) {
        const error = await response.json();
        setResult({
          type: 'error',
          title: 'Submission Failed',
          message: error.error || 'Failed to submit membership request. Please try again.',
        });
        setIsSubmitting(false);
        return;
      }

      setResult({
        type: 'success',
        title: 'Request Submitted!',
        message: 'Your membership request has been submitted successfully.',
        helpText: 'An admin will review your request soon. Check the Requests tab to track your progress.',
      });
      setHasRequest(true);
    } catch (error) {
      console.error('Error submitting membership request:', error);
      setResult({
        type: 'error',
        title: 'Submission Failed',
        message: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Wrapper function to refresh both user data and rank actions
  const handleRefreshWithActions = async () => {
    if (onRefresh) {
      await onRefresh();
    }
    await fetchRankActions();
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Combined Welcome & Rank Progress Card - Members Only */}
        {!isGuest && (
          <div className="bg-gradient-to-br from-[#f97316]/20 to-[#ea580c]/10 rounded-3xl p-6 sm:p-8 border-2 border-[#f97316]/20 shadow-xl">
            {/* User Info Header */}
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-6">
              {user?.discord_avatar ? (
                <img 
                  src={user.discord_avatar} 
                  alt={user.discord_username}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#f97316] flex items-center justify-center border-4 border-white shadow-lg">
                  <span className="text-white font-bold text-2xl sm:text-3xl">
                    {user?.discord_username?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-2xl sm:text-3xl font-bold text-[#0f172a] mb-2">
                  Welcome back, {user?.discord_username || 'Player'}! 🌽
                </h2>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4">
                  <div className="text-center sm:text-left">
                    <p className="text-xs text-[#0f172a]/60 mb-0.5">Current Rank</p>
                    <p className="text-lg font-bold text-[#0f172a] flex items-center gap-2 justify-center sm:justify-start">
                      {currentRankId === 11 ? (
                        <Popcorn className="w-7 h-7 text-[#f97316]" />
                      ) : (
                        <span className="text-2xl">{rankEmojis[currentRankId - 1]}</span>
                      )}
                      {getDisplayRank()}
                    </p>
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-xs text-[#0f172a]/60 mb-0.5">Next Rank</p>
                    <p className="text-lg font-bold text-[#f97316] flex items-center gap-2 justify-center sm:justify-start">
                      {currentRankId >= maxRanks ? (
                        <span className="text-2xl">
                          {prestigeLevel < 5 ? '⬆️' : '👑'}
                        </span>
                      ) : currentRankId === 10 && prestigeLevel === 5 ? (
                        <Popcorn className="w-7 h-7 text-[#f97316]" />
                      ) : (
                        <span className="text-2xl">{rankEmojis[currentRankId]}</span>
                      )}
                      {getNextRankName()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Rank Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-[#0f172a]">
                  Rank {currentRankId} / {displayRanks}
                </span>
                <span className="text-xs text-[#0f172a]/60">
                  {Math.round((currentRankId / displayRanks) * 100)}% Complete
                </span>
              </div>
              <div className="h-3 bg-white/60 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-[#f97316] to-[#ea580c] transition-all duration-500 rounded-full"
                  style={{ width: `${(currentRankId / displayRanks) * 100}%` }}
                />
              </div>
            </div>

            {/* Visual Rank Progression */}
            <div className="space-y-5">
              {/* Rank Emojis Row */}
              <div>
                <p className="text-xs text-[#0f172a]/70 mb-3 font-semibold">Rank Progression:</p>
                <div className="flex items-center justify-between gap-1 sm:gap-2">
                  {rankEmojis.slice(0, displayRanks).map((emoji, index) => {
                    const rankNum = index + 1;
                    const isCompleted = currentRankId > rankNum;
                    const isCurrent = currentRankId === rankNum;
                    const isLocked = currentRankId < rankNum;
                    const isPopdKernel = rankNum === 11; // Pop'd Kernel
                    
                    return (
                      <div
                        key={rankNum}
                        className={`group relative flex-1 flex items-center justify-center transition-all duration-300 ${
                          isCurrent ? 'scale-125' : 'hover:scale-110'
                        }`}
                      >
                        {isPopdKernel ? (
                          <Popcorn
                            className={`w-7 h-7 sm:w-8 sm:h-8 transition-all duration-300 cursor-pointer ${
                              isCompleted ? 'opacity-100 text-[#f97316] hover:scale-110' :
                              isCurrent ? 'opacity-100 text-[#f97316] animate-pulse drop-shadow-lg' :
                              'opacity-30 text-[#0f172a]/40 hover:opacity-50 hover:text-[#f97316]/60'
                            }`}
                          />
                        ) : (
                          <div
                            className={`text-2xl sm:text-3xl transition-all duration-300 cursor-pointer ${
                              isCompleted ? 'opacity-100 grayscale-0 hover:scale-110' :
                              isCurrent ? 'opacity-100 grayscale-0 animate-pulse drop-shadow-lg' :
                              'opacity-30 grayscale hover:opacity-50 hover:grayscale-0'
                            }`}
                          >
                            {emoji}
                          </div>
                        )}
                        
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 pointer-events-none">
                          <div className="bg-[#0f172a] text-white text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                            <span className="font-semibold">{rankNames[index]}</span>
                            {isCurrent && <span className="text-[#f97316]"> (Current)</span>}
                            {isCompleted && <span className="text-[#22c55e]"> ✓</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Prestige Level Stars */}
              <div>
                <p className="text-xs text-[#0f172a]/70 mb-3 font-semibold">Prestige Level:</p>
                <div className="flex items-center justify-center gap-3 sm:gap-4">
                  {[1, 2, 3, 4, 5].map((level) => {
                    const isAchieved = prestigeLevel >= level;
                    const isCurrent = prestigeLevel === level;
                    const emoji = level === 5 ? '💥' : '🌟';
                    
                    return (
                      <div
                        key={level}
                        className={`group relative transition-all duration-300 cursor-pointer ${
                          isCurrent ? 'scale-125' : 'hover:scale-110'
                        }`}
                      >
                        <div
                          className={`text-3xl sm:text-4xl transition-all duration-300 ${
                            isAchieved ? 'opacity-100 grayscale-0 hover:scale-110 drop-shadow-lg' : 
                            'opacity-20 grayscale hover:opacity-40 hover:grayscale-0'
                          } ${isCurrent ? 'animate-pulse' : ''}`}
                        >
                          {emoji}
                        </div>
                        
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 left-1/2 -translate-x-1/2 pointer-events-none">
                          <div className="bg-[#0f172a] text-white text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                            <span className="font-semibold">Prestige {level}</span>
                            {isCurrent && <span className="text-[#f97316]"> (Current)</span>}
                            {isAchieved && !isCurrent && <span className="text-[#22c55e]"> ✓</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Guest: Welcome & Membership Request Section */}
        {isGuest && (
          <div className="bg-gradient-to-br from-[#f97316]/20 to-[#ea580c]/10 rounded-3xl p-6 sm:p-8 border-2 border-[#f97316]/20 shadow-xl">
            {/* User Info Header */}
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-6">
              {user?.discord_avatar ? (
                <img 
                  src={user.discord_avatar} 
                  alt={user.discord_username}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#f97316] flex items-center justify-center border-4 border-white shadow-lg">
                  <span className="text-white font-bold text-2xl sm:text-3xl">
                    {user?.discord_username?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-2xl sm:text-3xl font-bold text-[#0f172a] mb-2">
                  Welcome, {user?.discord_username || 'Player'}! 🌽
                </h2>
                <p className="text-[#0f172a]/70 text-sm sm:text-base">
                  Submit a membership request to join The Corn Field and start your journey through the ranks!
                </p>
              </div>
            </div>

            {/* Membership Request Action */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-white/80">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#f97316] flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0f172a] mb-1">Join The Corn Field</h3>
                  <p className="text-[#0f172a]/70 text-xs sm:text-sm">
                    Submit your membership application to become part of our community!
                  </p>
                </div>
              </div>

              {loadingRequest ? (
                <div className="text-center py-4">
                  <Loader2 className="w-8 h-8 animate-spin text-[#f97316] mx-auto mb-2" />
                  <p className="text-sm text-[#0f172a]/60">Checking request status...</p>
                </div>
              ) : hasRequest ? (
                <div className="bg-[#f59e0b]/10 border-2 border-[#f59e0b]/20 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[#f59e0b] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#0f172a] mb-1">Request Pending</p>
                    <p className="text-sm text-[#0f172a]/70">
                      Your membership request is being reviewed. Check the Requests tab for updates.
                    </p>
                  </div>
                </div>
              ) : (
                <Button 
                  onClick={handleMembershipRequest}
                  disabled={isSubmitting}
                  className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white h-12 rounded-xl font-semibold text-base transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5 mr-2" />
                      Submit Membership Request
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* MVP Submission Form - Members Only */}
        {!isGuest && <MvpSubmissionForm user={user} onRefresh={handleRefreshWithActions} />}

        {/* Recent Actions - Members Only */}
        {!isGuest && (
          <div className="bg-white rounded-3xl p-4 sm:p-6 border-2 border-[#0f172a]/10 shadow-md">
            <h3 className="text-lg font-bold text-[#0f172a] mb-4">⚔️ Your Recent Actions</h3>
            
            {loadingActions ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-[#f97316] mx-auto mb-2" />
                <p className="text-sm text-[#0f172a]/60">Loading your action history...</p>
              </div>
            ) : rankActions.length === 0 ? (
              <div className="text-center py-8 bg-[#0f172a]/5 rounded-2xl">
                <div className="text-4xl mb-3">🌽</div>
                <p className="text-sm text-[#0f172a]/70 font-medium">No rank actions yet</p>
                <p className="text-xs text-[#0f172a]/50 mt-1">Your rank changes will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex gap-3 sm:gap-4 pb-2">
                  {rankActions.slice(0, 10).map((action, index) => {
                    const actionIcon = action.action === 'rank_up' ? (
                      <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 text-[#10b981]" />
                    ) : action.action === 'rank_down' ? (
                      <ArrowDown className="w-4 h-4 sm:w-5 sm:h-5 text-[#ef4444]" />
                    ) : (
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-[#fbbf24]" />
                    );

                    return (
                      <div
                        key={index}
                        className="flex-shrink-0 flex items-center gap-2 sm:gap-3 bg-[#0f172a]/5 rounded-2xl p-3 border-2 border-[#0f172a]/10"
                      >
                        {/* Performer Profile Pic */}
                        {action.performer?.discord_avatar ? (
                          <img
                            src={action.performer.discord_avatar}
                            alt={action.performer.discord_username}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-white shadow-sm"
                          />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#f97316] flex items-center justify-center border-2 border-white shadow-sm">
                            <span className="text-white font-bold text-sm">
                              {action.performer?.discord_username?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                        )}

                        {/* Action Icon */}
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-sm ${
                          action.action === 'rank_up' ? 'bg-[#10b981]/10 border-2 border-[#10b981]/20' :
                          action.action === 'rank_down' ? 'bg-[#ef4444]/10 border-2 border-[#ef4444]/20' :
                          'bg-[#fbbf24]/10 border-2 border-[#fbbf24]/20'
                        }`}>
                          {actionIcon}
                        </div>

                        {/* Recipient Profile Pic */}
                        {action.recipient?.discord_avatar ? (
                          <img
                            src={action.recipient.discord_avatar}
                            alt={action.recipient.discord_username}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-white shadow-sm"
                          />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#f97316] flex items-center justify-center border-2 border-white shadow-sm">
                            <span className="text-white font-bold text-sm">
                              {action.recipient?.discord_username?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Custom Games Section */}
        <div className="bg-white rounded-3xl p-4 sm:p-6 border-2 border-[#0f172a]/10 shadow-md">
          <h3 className="text-lg font-bold text-[#0f172a] mb-4">🎮 Custom Games</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                title: "Axe's Dunk Contest",
                workshopId: '3592388680',
                cover: 'https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/custom-game-modes/cover-photos/axes_dunk_contest.png',
              },
              {
                title: "Heaps n' Reaps",
                workshopId: '3585929337',
                cover: 'https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/custom-game-modes/cover-photos/heaps_n_reaps.png',
              },
              {
                title: 'Hide & Heap',
                workshopId: '3580844386',
                cover: 'https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/custom-game-modes/cover-photos/hide_n_heap.png',
              },
            ].map((game) => (
              <a
                key={game.workshopId}
                href={`https://steamcommunity.com/sharedfiles/filedetails/?id=${game.workshopId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative rounded-2xl overflow-hidden border-2 border-[#0f172a]/10 hover:border-[#f97316]/40 transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="aspect-[16/9] overflow-hidden">
                  <img
                    src={game.cover}
                    alt={game.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between">
                  <p className="text-white font-bold text-sm drop-shadow-lg">{game.title}</p>
                  <ExternalLink className="w-4 h-4 text-white/70 group-hover:text-white flex-shrink-0 transition-colors" />
                </div>
              </a>
            ))}
          </div>
        </div>

      </div>

      <Footer />

      {/* Modals */}
      {showConfirm && (
        <ConfirmModal
          title="Submit Membership Request?"
          message="Are you sure you want to submit a membership request to join The Corn Field?"
          confirmText="Submit Request"
          confirmVariant="primary"
          onConfirm={submitMembershipRequest}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {result && (
        <SuccessModal
          type={result.type}
          title={result.title}
          message={result.message}
          helpText={result.helpText}
          onClose={() => setResult(null)}
        />
      )}
    </div>
  );
}