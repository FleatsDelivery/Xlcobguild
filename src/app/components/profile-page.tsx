import { User, LogOut, Shield, Gamepad2, Link as LinkIcon, RefreshCw, Settings, Trophy, Image, Award, Database, Loader2, Crown, Swords, Target, TrendingUp } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Footer } from '@/app/components/footer';
import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { ConnectOpenDotaModal } from '@/app/components/connect-opendota-modal';
import { SuccessModal } from '@/app/components/success-modal';
import { ConnectAccountModal } from '@/app/components/connect-account-modal';
import { AwardChampionshipModal } from '@/app/components/award-championship-modal';
import { AwardPopdKernelModal } from '@/app/components/award-popd-kernel-modal';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { SeedKernelKupModal } from '@/app/components/seed-kernel-kup-modal';
import { TournamentBuilderModal } from '@/app/components/tournament-builder-modal';
import { UserManagement } from '@/app/components/user-management';
import { toast } from 'sonner';

interface ProfilePageProps {
  user: any;
  onRefresh?: () => void;
}

export function ProfilePage({ user, onRefresh }: ProfilePageProps) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  // Rank emojis mapping
  const rankEmojis = [
    '🐛', // 1. Earwig
    '🦌', // 2. Ugandan Kob
    '🌽', // 3. Private Maize
    '🥄', // 4. Specialist Ingredient
    '🍞', // 5. Corporal Corn Bread
    '🌾', // 6. Sergeant Husk
    '🌻', // 7. Sergeant Major Fields
    '', // 8. Captain Cornhole
    '⭐', // 9. Major Cob
    '🌟', // 10. Corn Star
    '💥', // 11. Pop'd Kernel (prestige 5 only)
  ];

  // Get display name based on role
  const getDisplayRank = () => {
    if (user?.role === 'owner') return 'Colonel Kernel';
    if (user?.role === 'queen_of_hog') return 'Queen Of Hog';
    if (user?.role === 'admin') return 'Cob Officer';
    if (user?.role === 'guest') return 'Not Yet Ranked';
    return user?.ranks?.name || 'Earwig';
  };

  // Calculate rank progression
  const currentRankId = user?.rank_id || 1;
  const prestigeLevel = user?.prestige_level || 0;
  const maxRanks = prestigeLevel === 5 ? 11 : 10;
  
  // Calculate which ranks to show
  const displayRanks = prestigeLevel === 5 ? 11 : 10;

  // State for OpenDota connection
  const [openDotaModalOpen, setOpenDotaModalOpen] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);

  // State for Twitch/Chess.com connection
  const [connectAccountModal, setConnectAccountModal] = useState<{
    type: 'twitch' | 'chesscom';
    currentUsername?: string;
  } | null>(null);

  // State for award achievement
  const [showAwardChampionshipModal, setShowAwardChampionshipModal] = useState(false);
  const [showAwardPopdKernelModal, setShowAwardPopdKernelModal] = useState(false);

  // State for admin buttons
  const [isSeedingKK1, setIsSeedingKK1] = useState(false);
  const [isSeedingKK2, setIsSeedingKK2] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedKernelKup, setSelectedKernelKup] = useState<number>(1);
  const [seededKernelKups, setSeededKernelKups] = useState<Set<number>>(new Set());
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [showTournamentBuilder, setShowTournamentBuilder] = useState(false);

  // State for KKUP stats
  const [kkupStats, setKkupStats] = useState<any>(null);
  const [loadingKkupStats, setLoadingKkupStats] = useState(false);

  // State for OpenDota refresh
  const [refreshingOpenDota, setRefreshingOpenDota] = useState(false);

  // Fetch KKUP stats for linked users
  useEffect(() => {
    if (user?.kkup_player_profile_id) {
      const fetchKkupStats = async () => {
        setLoadingKkupStats(true);
        try {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/users/${user.id}/kkup-stats`,
            {
              headers: {
                Authorization: `Bearer ${publicAnonKey}`,
              },
            }
          );

          if (!response.ok) {
            console.error('Failed to fetch KKUP stats');
            setLoadingKkupStats(false);
            return;
          }

          const data = await response.json();
          setKkupStats(data);
        } catch (error) {
          console.error('Error fetching KKUP stats:', error);
        } finally {
          setLoadingKkupStats(false);
        }
      };

      fetchKkupStats();
    }
  }, [user?.id, user?.kkup_player_profile_id]);

  // Handler for seeding Kernel Kup 1
  const handleSeedKK1 = async () => {
    setIsSeedingKK1(true);
    
    try {
      const token = localStorage.getItem('supabase_token');
      
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/seed-kk1`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      toast.success(`✅ Seeded Kernel Kup 1! Created ${data.matchCount} matches.`);
    } catch (error) {
      console.error('Seed error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to seed Kernel Kup 1';
      toast.error(`Seed failed: ${errorMessage}`);
    } finally {
      setIsSeedingKK1(false);
    }
  };

  // Handler for seeding Kernel Kup 2
  const handleSeedKK2 = async () => {
    setIsSeedingKK2(true);
    
    try {
      const token = localStorage.getItem('supabase_token');
      
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/seed-kernel-kup-2`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      toast.success(`✅ Seeded Kernel Kup 2! Tournament created successfully.`);
      
      // Navigate to the newly created tournament
      if (data.tournament?.id) {
        window.location.hash = `#/kernel-kup/${data.tournament.id}`;
      }
    } catch (error) {
      console.error('Seed error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to seed Kernel Kup 2';
      toast.error(`Seed failed: ${errorMessage}`);
    } finally {
      setIsSeedingKK2(false);
    }
  };

  // Handler for seeding Kernel Kup
  const handleSeedKernelKup = async () => {
    setIsSeeding(true);
    
    try {
      const token = localStorage.getItem('supabase_token');
      
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/seed-kernel-kup`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ kup_id: selectedKernelKup }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      toast.success(`✅ Seeded Kernel Kup ${selectedKernelKup}! Created ${data.matchCount} matches.`);
      setSeededKernelKups(new Set([...seededKernelKups, selectedKernelKup]));
    } catch (error) {
      console.error('Seed error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to seed Kernel Kup';
      toast.error(`Seed failed: ${errorMessage}`);
    } finally {
      setIsSeeding(false);
    }
  };

  // Handler for syncing names and logos
  const handleSyncNamesAndLogos = async () => {
    setIsSyncing(true);
    
    try {
      const token = localStorage.getItem('supabase_token');
      
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/sync-names-logos`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      toast.success(`✅ Synced ${data.playersUpdated} players and ${data.teamsUpdated} teams!`);
    } catch (error) {
      console.error('Sync error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync names & logos';
      toast.error(`Sync failed: ${errorMessage}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handler for refreshing all OpenDota stats
  const handleRefreshOpenDota = async () => {
    setRefreshingOpenDota(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to refresh OpenDota data.');
        setRefreshingOpenDota(false);
        return;
      }
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/refresh-opendota`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to refresh OpenDota data.');
        setRefreshingOpenDota(false);
        return;
      }
      const data = await response.json();
      toast.success(`Synced ${data.updatedCount || 0} user(s) with OpenDota!`);
    } catch (error) {
      console.error('Error refreshing OpenDota data:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setRefreshingOpenDota(false);
    }
  };

  // Handle OpenDota connection
  const handleConnectOpenDota = async (opendotaId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Please sign in first');
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/users/me/opendota`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ opendota_id: opendotaId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect OpenDota account');
      }

      // Now sync the data
      setSyncing(true);
      const syncResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/users/me/opendota/sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!syncResponse.ok) {
        console.error('Failed to sync OpenDota data');
      }

      setSyncing(false);
      
      setResult({
        type: 'success',
        title: 'Connected! 🎮',
        message: 'Your OpenDota account has been connected and synced successfully!',
      });

      if (onRefresh) {
        setTimeout(() => {
          onRefresh();
        }, 1000);
      }
    } catch (error: any) {
      setSyncing(false);
      throw error;
    }
  };

  // Handle Twitch/Chess.com account connection
  const handleConnectAccount = async (accountType: 'twitch' | 'chesscom', username: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Please sign in first');
      }

      const field = accountType === 'twitch' ? 'twitch_username' : 'chesscom_username';

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/users/me/account`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ [field]: username }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update account');
      }

      setResult({
        type: 'success',
        title: 'Connected! 🎉',
        message: `Your ${accountType === 'twitch' ? 'Twitch' : 'Chess.com'} account has been connected successfully!`,
      });

      if (onRefresh) {
        setTimeout(() => {
          onRefresh();
        }, 1000);
      }
    } catch (error: any) {
      throw error;
    }
  };

  // Handle account disconnection
  const handleDisconnectAccount = async (accountType: 'twitch' | 'chesscom') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Please sign in first');
      }

      const field = accountType === 'twitch' ? 'twitch_username' : 'chesscom_username';

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/users/me/account`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ [field]: null }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disconnect account');
      }

      setResult({
        type: 'success',
        title: 'Disconnected! ✅',
        message: `Your ${accountType === 'twitch' ? 'Twitch' : 'Chess.com'} account has been disconnected.`,
      });

      if (onRefresh) {
        setTimeout(() => {
          onRefresh();
        }, 1000);
      }
    } catch (error: any) {
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-[#fdf5e9] px-3 sm:px-4 py-6 sm:py-8">
      <div className="max-w-2xl mx-auto">
        {/* Profile Header Card */}
        <div className="bg-white rounded-3xl p-4 sm:p-8 shadow-sm border-2 border-[#0f172a]/10 mb-4 sm:mb-6">
          <div className="flex flex-col items-center text-center">
            {/* Avatar */}
            {user?.discord_avatar ? (
              <img
                src={user.discord_avatar.startsWith('http') 
                  ? user.discord_avatar 
                  : `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png?size=256`}
                alt={user.discord_username || 'User'}
                className="w-32 h-32 rounded-full border-4 border-[#f97316] mb-4"
                onError={(e) => {
                  console.error('Failed to load avatar:', user.discord_avatar);
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-[#0f172a] flex items-center justify-center mb-4">
                <User className="w-16 h-16 text-white" />
              </div>
            )}

            {/* Username */}
            <h1 className="text-3xl font-bold text-[#0f172a] mb-2">
              {user?.discord_username || 'Guest User'}
            </h1>

            {/* Role Badge */}
            <div className="flex items-center gap-2 px-4 py-2 bg-[#f97316]/10 rounded-full mb-4">
              <Shield className="w-4 h-4 text-[#f97316]" />
              <span className="text-sm font-semibold text-[#f97316] uppercase">
                {user?.role === 'queen_of_hog' ? (
                  <span className="flex items-center gap-1.5">
                    <span>🐷</span>
                    <span className="text-[#ec4899]">Queen Of Hog</span>
                  </span>
                ) : (
                  user?.role || 'guest'
                )}
              </span>
            </div>

            {/* Rank Info */}
            <div className="text-center mb-6">
              <p className="text-sm text-[#0f172a]/60 mb-1">Current Rank</p>
              <p className="text-2xl font-bold text-[#0f172a]">
                {getDisplayRank()}
              </p>
              {user?.prestige_level > 0 && (
                <p className="text-sm text-[#f97316] font-semibold">
                  Prestige Level {user.prestige_level}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Your Progress Card */}
        {user?.role !== 'guest' && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border-2 border-[#0f172a]/10 mb-6">
            <h2 className="text-xl font-bold text-[#0f172a] mb-2">Your Progress</h2>
            <p className="text-sm text-[#0f172a]/60 mb-6">
              Rank {currentRankId}/{maxRanks}
            </p>
            
            {/* Rank Progression */}
            <div className="flex items-center justify-between gap-2">
              {Array.from({ length: displayRanks }).map((_, index) => {
                const rankNumber = index + 1;
                const isUnlocked = rankNumber <= currentRankId;
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
                        rankNumber === currentRankId ? 'scale-125 animate-pulse' : ''
                      }`}
                    >
                      {emoji}
                    </div>
                    <div
                      className={`h-1 w-8 rounded-full ${
                        isUnlocked ? 'bg-[#f97316]' : 'bg-[#0f172a]/10'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* OpenDota Connection Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border-2 border-[#0f172a]/10 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#0f172a]">OpenDota Connection</h2>
            <Gamepad2 className="w-6 h-6 text-[#f97316]" />
          </div>
          
          {user?.opendota_id ? (
            <div>
              <div className="bg-[#10b981]/5 rounded-2xl p-4 border-2 border-[#10b981]/20 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <LinkIcon className="w-4 h-4 text-[#10b981]" />
                  <span className="text-sm font-semibold text-[#10b981]">Connected</span>
                </div>
                <p className="text-xs text-[#0f172a]/60">
                  Steam32 ID: <span className="font-mono">{user.opendota_id}</span>
                </p>
                {user?.opendota_last_synced && (
                  <p className="text-xs text-[#0f172a]/60 mt-1">
                    Last synced: {new Date(user.opendota_last_synced).toLocaleString()}
                  </p>
                )}
              </div>
              
              {user?.opendota_data && (
                <div className="space-y-3">
                  {/* Badge Rank */}
                  {user.opendota_data.badge_rank && user.opendota_data.badge_rank.medal !== 'Unranked' && (
                    <div className="bg-[#f97316]/5 rounded-2xl p-4 border-2 border-[#f97316]/20">
                      <p className="text-xs text-[#0f172a]/60 mb-2 font-semibold">Badge Rank</p>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🏅</span>
                        <span className="text-lg font-bold text-[#f97316]">
                          {user.opendota_data.badge_rank.medal} [{user.opendota_data.badge_rank.stars}]
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm text-[#0f172a]/60 mb-4">
                Connect your OpenDota account to display your Dota 2 stats on your profile
              </p>
              <Button
                onClick={() => setOpenDotaModalOpen(true)}
                className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white h-12 rounded-xl font-semibold"
              >
                <LinkIcon className="mr-2 h-5 w-5" />
                Connect OpenDota
              </Button>
            </div>
          )}
        </div>

        {/* Kernel Kup Stats Card - For linked KKUP users */}
        {loadingKkupStats && (
          <div className="bg-gradient-to-br from-[#fbbf24]/10 to-[#f97316]/10 rounded-3xl p-8 shadow-sm border-2 border-[#f97316]/20 mb-6 flex justify-center">
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-[#f97316]" />
              <p className="text-sm text-[#0f172a]/60">Loading Kernel Kup stats...</p>
            </div>
          </div>
        )}

        {kkupStats && kkupStats.linked && (
          <div className="bg-gradient-to-br from-[#fbbf24]/10 to-[#f97316]/10 rounded-3xl p-6 sm:p-8 shadow-sm border-2 border-[#f97316]/20 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#fbbf24] to-[#f97316] flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#0f172a]">Kernel Kup Stats</h2>
                  {kkupStats.profile?.name && (
                    <p className="text-xs text-[#0f172a]/60">Profile: {kkupStats.profile.name}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Achievements Row */}
            {(kkupStats.championships?.total > 0 || kkupStats.popd_kernels > 0) && (
              <div className="flex gap-3 mb-5">
                {kkupStats.championships?.kernel_kup > 0 && (
                  <div className="flex-1 bg-white/80 rounded-2xl p-4 border border-[#f97316]/20 text-center">
                    <span className="text-3xl block mb-1">🏆</span>
                    <p className="text-2xl font-black text-[#f97316]">{kkupStats.championships.kernel_kup}x</p>
                    <p className="text-[10px] font-semibold text-[#0f172a]/60 uppercase tracking-wide">KK Champ</p>
                  </div>
                )}
                {kkupStats.championships?.heaps_n_hooks > 0 && (
                  <div className="flex-1 bg-white/80 rounded-2xl p-4 border border-[#10b981]/20 text-center">
                    <span className="text-3xl block mb-1">⚓</span>
                    <p className="text-2xl font-black text-[#10b981]">{kkupStats.championships.heaps_n_hooks}x</p>
                    <p className="text-[10px] font-semibold text-[#0f172a]/60 uppercase tracking-wide">H&H Champ</p>
                  </div>
                )}
                {kkupStats.popd_kernels > 0 && (
                  <div className="flex-1 bg-white/80 rounded-2xl p-4 border border-[#dc2626]/20 text-center">
                    <span className="text-3xl block mb-1">💥</span>
                    <p className="text-2xl font-black text-[#dc2626]">{kkupStats.popd_kernels}x</p>
                    <p className="text-[10px] font-semibold text-[#0f172a]/60 uppercase tracking-wide">Pop'd Kernel</p>
                  </div>
                )}
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              <div className="bg-white/80 rounded-xl p-3 border border-[#0f172a]/10 text-center">
                <p className="text-xs text-[#0f172a]/50 font-medium mb-1">Tournaments</p>
                <p className="text-xl font-black text-[#0f172a]">{kkupStats.tournaments_played}</p>
              </div>
              <div className="bg-white/80 rounded-xl p-3 border border-[#0f172a]/10 text-center">
                <p className="text-xs text-[#0f172a]/50 font-medium mb-1">Win Rate</p>
                <p className={`text-xl font-black ${kkupStats.total_games > 0 && ((kkupStats.wins / kkupStats.total_games) * 100) >= 50 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                  {kkupStats.total_games > 0 ? `${((kkupStats.wins / kkupStats.total_games) * 100).toFixed(1)}%` : '-'}
                </p>
              </div>
              <div className="bg-white/80 rounded-xl p-3 border border-[#0f172a]/10 text-center">
                <p className="text-xs text-[#0f172a]/50 font-medium mb-1">Record</p>
                <p className="text-xl font-black">
                  <span className="text-[#10b981]">{kkupStats.wins}W</span>
                  <span className="text-[#0f172a]/30"> / </span>
                  <span className="text-[#ef4444]">{kkupStats.losses}L</span>
                </p>
              </div>
              <div className="bg-white/80 rounded-xl p-3 border border-[#0f172a]/10 text-center">
                <p className="text-xs text-[#0f172a]/50 font-medium mb-1">Total Kills</p>
                <p className="text-xl font-black text-[#ef4444]">{kkupStats.total_kills?.toLocaleString() || 0}</p>
              </div>
              <div className="bg-white/80 rounded-xl p-3 border border-[#0f172a]/10 text-center">
                <p className="text-xs text-[#0f172a]/50 font-medium mb-1">Total Deaths</p>
                <p className="text-xl font-black text-[#0f172a]/60">{kkupStats.total_deaths?.toLocaleString() || 0}</p>
              </div>
              <div className="bg-white/80 rounded-xl p-3 border border-[#0f172a]/10 text-center">
                <p className="text-xs text-[#0f172a]/50 font-medium mb-1">Total Assists</p>
                <p className="text-xl font-black text-[#3b82f6]">{kkupStats.total_assists?.toLocaleString() || 0}</p>
              </div>
            </div>

            {/* KDA Average */}
            {kkupStats.total_games > 0 && (
              <div className="bg-white/80 rounded-xl p-3 border border-[#0f172a]/10 mb-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#0f172a]/50 font-medium">Avg KDA per Game</p>
                  <p className="text-sm font-black text-[#0f172a]">
                    <span className="text-[#ef4444]">{(kkupStats.total_kills / kkupStats.total_games).toFixed(1)}</span>
                    <span className="text-[#0f172a]/30"> / </span>
                    <span className="text-[#0f172a]/60">{(kkupStats.total_deaths / kkupStats.total_games).toFixed(1)}</span>
                    <span className="text-[#0f172a]/30"> / </span>
                    <span className="text-[#3b82f6]">{(kkupStats.total_assists / kkupStats.total_games).toFixed(1)}</span>
                  </p>
                </div>
              </div>
            )}

            {/* View Kernel Kups Button */}
            <button
              type="button"
              onClick={() => { window.location.hash = '#/kernel-kup'; }}
              className="w-full flex items-center justify-between p-4 bg-white hover:bg-[#f97316]/5 border-2 border-[#f97316]/20 hover:border-[#f97316]/40 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#fbbf24] to-[#f97316] flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-[#0f172a]">View Kernel Kups</p>
                  <p className="text-xs text-[#0f172a]/60">Browse all tournaments</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-[#f97316] group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* No Stats State */}
            {kkupStats.championships?.total === 0 && kkupStats.popd_kernels === 0 && kkupStats.tournaments_played === 0 && (
              <p className="text-xs text-[#0f172a]/60 text-center mt-4">
                Linked to Kernel Kup profile but no tournament history yet
              </p>
            )}
          </div>
        )}

        {/* Connected Accounts Card */}
        {user?.opendota_id && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border-2 border-[#0f172a]/10 mb-6">
            <h2 className="text-xl font-bold text-[#0f172a] mb-4">Connected Accounts</h2>
            
            <div className="space-y-3">
              {/* OpenDota Button */}
              <button
                onClick={() => window.open(`https://www.opendota.com/players/${user.opendota_id}`, '_blank')}
                className="w-full flex items-center justify-between p-4 bg-[#6366f1]/5 hover:bg-[#6366f1]/10 border-2 border-[#6366f1]/20 rounded-2xl transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#6366f1] flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-[#0f172a]">OpenDota Profile</p>
                    <p className="text-xs text-[#0f172a]/60">View OpenDota statistics</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-[#6366f1] group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Dotabuff Button */}
              <button
                onClick={() => window.open(`https://www.dotabuff.com/players/${user.opendota_id}`, '_blank')}
                className="w-full flex items-center justify-between p-4 bg-[#3b82f6]/5 hover:bg-[#3b82f6]/10 border-2 border-[#3b82f6]/20 rounded-2xl transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#3b82f6] flex items-center justify-center">
                    <Gamepad2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-[#0f172a]">Dotabuff Profile</p>
                    <p className="text-xs text-[#0f172a]/60">View detailed Dota 2 stats</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-[#3b82f6] group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Steam Button */}
              <button
                onClick={() => {
                  // Convert 32-bit account ID to 64-bit Steam ID
                  const steamId64 = (BigInt(user.opendota_id) + BigInt('76561197960265728')).toString();
                  window.open(`https://steamcommunity.com/profiles/${steamId64}`, '_blank');
                }}
                className="w-full flex items-center justify-between p-4 bg-[#0f172a]/5 hover:bg-[#0f172a]/10 border-2 border-[#0f172a]/20 rounded-2xl transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0f172a] flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-[#0f172a]">Steam Profile</p>
                    <p className="text-xs text-[#0f172a]/60">View Steam community profile</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-[#0f172a] group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Discord Button */}
              <button
                onClick={() => {
                  if (user?.discord_id) {
                    window.open(`https://discord.com/users/${user.discord_id}`, '_blank');
                  }
                }}
                className="w-full flex items-center justify-between p-4 bg-[#5865f2]/5 hover:bg-[#5865f2]/10 border-2 border-[#5865f2]/20 rounded-2xl transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-[#0f172a]">Discord Profile</p>
                    <p className="text-xs text-[#0f172a]/60">View Discord profile</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-[#5865f2] group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Twitch Button - Clickable to Manage */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (user?.twitch_username) {
                    // If connected, open a menu to view or disconnect
                    // For now, let's open the manage modal
                    setConnectAccountModal({ 
                      type: 'twitch', 
                      currentUsername: user.twitch_username 
                    });
                  } else {
                    // Open connect modal
                    setConnectAccountModal({ type: 'twitch' });
                  }
                }}
                className="w-full flex items-center justify-between p-4 bg-[#9146ff]/5 hover:bg-[#9146ff]/10 border-2 border-[#9146ff]/20 rounded-2xl transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#9146ff] flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                    </svg>
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-[#0f172a]">Twitch Profile</p>
                    <p className="text-xs text-[#0f172a]/60">
                      {user?.twitch_username ? `twitch.tv/${user.twitch_username}` : 'Click to connect'}
                    </p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-[#9146ff] group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Chess.com Button - Clickable to Manage */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (user?.chesscom_username) {
                    // If connected, open manage modal
                    setConnectAccountModal({ 
                      type: 'chesscom', 
                      currentUsername: user.chesscom_username 
                    });
                  } else {
                    // Open connect modal
                    setConnectAccountModal({ type: 'chesscom' });
                  }
                }}
                className="w-full flex items-center justify-between p-4 bg-[#22c55e]/5 hover:bg-[#22c55e]/10 border-2 border-[#22c55e]/20 rounded-2xl transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#22c55e] flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.11 1.11L8.45 7.55h2.66L8.45 22.89l8.44-11.11h-2.66l2.66-10.67z"/>
                    </svg>
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-[#0f172a]">Chess.com Profile</p>
                    <p className="text-xs text-[#0f172a]/60">
                      {user?.chesscom_username ? `chess.com/member/${user.chesscom_username}` : 'Click to connect'}
                    </p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-[#22c55e] group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Account Details Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border-2 border-[#0f172a]/10 mb-6">
          <h2 className="text-xl font-bold text-[#0f172a] mb-4">Account Details</h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-[#0f172a]/10">
              <span className="text-[#0f172a]/60">Discord ID</span>
              <span className="font-mono text-sm text-[#0f172a]">
                {user?.discord_id || 'N/A'}
              </span>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-[#0f172a]/10">
              <span className="text-[#0f172a]/60">Member Since</span>
              <span className="text-sm text-[#0f172a]">
                {user?.created_at 
                  ? new Date(user.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : 'N/A'
                }
              </span>
            </div>

            <div className="flex justify-between items-center py-3">
              <span className="text-[#0f172a]/60">Last Updated</span>
              <span className="text-sm text-[#0f172a]">
                {user?.updated_at 
                  ? new Date(user.updated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : 'N/A'
                }
              </span>
            </div>
          </div>
        </div>

        {/* Actions Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border-2 border-[#0f172a]/10 mb-6">
          <h2 className="text-xl font-bold text-[#0f172a] mb-4">Actions</h2>
          
          <div className="space-y-3">
            <Button
              onClick={handleSignOut}
              className="w-full bg-red-500 hover:bg-red-600 text-white h-12 rounded-xl font-semibold"
            >
              <LogOut className="mr-2 h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Admin Tools Card - Only for Owner and Queen of Hog */}
        {(user?.role === 'owner' || user?.role === 'queen_of_hog') && (
          <div className="bg-gradient-to-br from-[#f97316]/5 to-[#ea580c]/5 rounded-3xl p-8 shadow-sm border-2 border-[#f97316]/20 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#0f172a]">Admin Tools</h2>
              <Settings className="w-6 h-6 text-[#f97316]" />
            </div>
            
            <p className="text-sm text-[#0f172a]/60 mb-6">
              Manage tournaments, teams, and community assets
            </p>

            <div className="space-y-3">
              {/* Tournament Builder */}
              <button
                onClick={() => setShowTournamentBuilder(true)}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-[#f97316]/5 border-2 border-[#f97316]/20 hover:border-[#f97316]/40 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center shadow-md">
                    <Trophy className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-[#0f172a]">Create Regular Tournament</p>
                    <p className="text-xs text-[#0f172a]/60">For tournaments with League IDs</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-[#f97316] group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Seed Kernel Kup Selector */}
              <div className="bg-white p-4 border-2 border-[#f97316]/20 rounded-2xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center shadow-md">
                    <Database className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-bold text-[#0f172a]">Seed Historical Kernel Kup</p>
                    <p className="text-xs text-[#0f172a]/60">Import tournament data</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <select
                    value={selectedKernelKup}
                    onChange={(e) => setSelectedKernelKup(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-[#fdf5e9] border-2 border-[#0f172a]/20 rounded-xl text-[#0f172a] font-medium focus:outline-none focus:border-[#f97316] transition-colors"
                  >
                    <option value={1}>Kernel Kup 1 {seededKernelKups.has(1) ? '(Seeded ✓)' : ''}</option>
                    <option value={2}>Kernel Kup 2 {seededKernelKups.has(2) ? '(Seeded ✓)' : ''}</option>
                    <option value={3}>Kernel Kup 3 {seededKernelKups.has(3) ? '(Seeded ✓)' : ''}</option>
                    <option value={8}>Kernel Kup 8 {seededKernelKups.has(8) ? '(Seeded ✓)' : ''}</option>
                    <option value={9}>Kernel Kup 9 {seededKernelKups.has(9) ? '(Seeded ✓)' : ''}</option>
                  </select>
                  
                  <button
                    onClick={() => setShowSeedConfirm(true)}
                    disabled={isSeeding || seededKernelKups.has(selectedKernelKup)}
                    className="w-full px-4 py-3 bg-gradient-to-br from-[#f97316] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSeeding ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Seeding Kernel Kup {selectedKernelKup}...
                      </>
                    ) : seededKernelKups.has(selectedKernelKup) ? (
                      <>
                        ✓ Already Seeded
                      </>
                    ) : (
                      <>
                        <Database className="w-5 h-5" />
                        Seed Kernel Kup {selectedKernelKup}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Award Championship */}
              <button
                onClick={() => setShowAwardChampionshipModal(true)}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-[#f97316]/5 border-2 border-[#f97316]/20 hover:border-[#f97316]/40 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-md">
                    <Trophy className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-[#0f172a]">🏆 Award Championship</p>
                    <p className="text-xs text-[#0f172a]/60">Award winning team for a Kernel Kup</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-[#f97316] group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Award Pop'd Kernel */}
              <button
                onClick={() => setShowAwardPopdKernelModal(true)}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-[#f97316]/5 border-2 border-[#f97316]/20 hover:border-[#f97316]/40 rounded-2xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                    <Crown className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-[#0f172a]">👑 Award Pop'd Kernel</p>
                    <p className="text-xs text-[#0f172a]/60">Award MVP player for a Kernel Kup</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-[#f97316] group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Sync Names and Logos */}
              <button
                onClick={() => setShowSyncConfirm(true)}
                disabled={isSyncing}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-[#f97316]/5 border-2 border-[#f97316]/20 hover:border-[#f97316]/40 rounded-2xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center shadow-md">
                    {isSyncing ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <RefreshCw className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-[#0f172a]">{isSyncing ? 'Syncing...' : 'Sync Names & Logos'}</p>
                    <p className="text-xs text-[#0f172a]/60">Update player and team names/logos</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-[#f97316] group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Refresh All OpenDota Stats */}
              <button
                onClick={handleRefreshOpenDota}
                disabled={refreshingOpenDota}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-[#3b82f6]/5 border-2 border-[#3b82f6]/20 hover:border-[#3b82f6]/40 rounded-2xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#2563eb] flex items-center justify-center shadow-md">
                    {refreshingOpenDota ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Gamepad2 className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-[#0f172a]">{refreshingOpenDota ? 'Syncing with OpenDota...' : 'Refresh All User Stats'}</p>
                    <p className="text-xs text-[#0f172a]/60">Sync MMR, medals & match history for all members</p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-[#3b82f6] group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Owner: User Management Section */}
        {user?.role === 'owner' && (
          <div className="mb-24">
            <UserManagement onRefresh={onRefresh ? async () => { onRefresh(); } : undefined} />
          </div>
        )}
      </div>

      <Footer />

      {/* OpenDota Connection Modal */}
      {openDotaModalOpen && (
        <ConnectOpenDotaModal
          onConnect={handleConnectOpenDota}
          onClose={() => setOpenDotaModalOpen(false)}
        />
      )}

      {/* Success/Error Modal */}
      {result && (
        <SuccessModal
          type={result.type}
          title={result.title}
          message={result.message}
          onClose={() => setResult(null)}
        />
      )}

      {/* Connect Account Modal */}
      {connectAccountModal && (
        <ConnectAccountModal
          accountType={connectAccountModal.type}
          currentUsername={connectAccountModal.currentUsername}
          onConnect={(username) => handleConnectAccount(connectAccountModal.type, username)}
          onDisconnect={() => handleDisconnectAccount(connectAccountModal.type)}
          onClose={() => setConnectAccountModal(null)}
        />
      )}

      {/* Award Championship Modal */}
      {showAwardChampionshipModal && (
        <AwardChampionshipModal
          onClose={() => setShowAwardChampionshipModal(false)}
          onSuccess={() => {
            setShowAwardChampionshipModal(false);
            toast.success('Championship awarded successfully!');
          }}
        />
      )}

      {/* Award Pop'd Kernel Modal */}
      {showAwardPopdKernelModal && (
        <AwardPopdKernelModal
          onClose={() => setShowAwardPopdKernelModal(false)}
          onSuccess={() => {
            setShowAwardPopdKernelModal(false);
            toast.success('Pop\'d Kernel awarded successfully!');
          }}
        />
      )}

      {/* Sync Confirm Modal */}
      {showSyncConfirm && (
        <ConfirmModal
          title="Confirm Sync"
          message="This will update all player names and avatars from Steam, and all team logos from the kkupassets bucket. Existing data will be overwritten. Are you sure?"
          confirmText="Sync Now"
          confirmVariant="primary"
          onConfirm={() => {
            setShowSyncConfirm(false);
            handleSyncNamesAndLogos();
          }}
          onCancel={() => setShowSyncConfirm(false)}
        />
      )}

      {/* Seed Confirm Modal */}
      {showSeedConfirm && (
        <SeedKernelKupModal
          kernelKupId={selectedKernelKup}
          onConfirm={() => {
            setShowSeedConfirm(false);
            handleSeedKernelKup();
          }}
          onCancel={() => setShowSeedConfirm(false)}
        />
      )}

      {/* Tournament Builder Modal */}
      {showTournamentBuilder && (
        <TournamentBuilderModal
          onClose={() => setShowTournamentBuilder(false)}
        />
      )}
    </div>
  );
}