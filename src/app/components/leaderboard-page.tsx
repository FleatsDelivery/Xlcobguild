import { Footer } from '@/app/components/footer';
import { Trophy, Medal, Crown, Loader2, TrendingUp, Search, Eye, Star, Popcorn } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { UserProfileModal } from '@/app/components/user-profile-modal';

interface LeaderboardUser {
  id: string;
  discord_username: string;
  discord_avatar: string | null;
  rank_id: number;
  prestige_level: number;
  role: string;
  created_at: string;
  opendota_id?: string | null;
  opendota_data?: {
    badge_rank?: {
      medal: string;
      stars: number;
      rank_tier: number;
      leaderboard_rank: number | null;
    };
    top_3_heroes?: any[];
    primary_role?: string | null;
  };
  ranks: {
    id: number;
    name: string;
    display_order: number;
    description: string;
  };
}

// Rank emojis mapping (same as home page)
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

export function LeaderboardPage({ user }: { user: any }) {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [kkupStatsMap, setKkupStatsMap] = useState<Record<string, any>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoading(false);
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/leaderboard`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        // Fetch KKUP stats for all users
        fetchAllKkupStats(data.users || []);
      } else {
        console.error('Failed to fetch leaderboard');
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllKkupStats = async (usersList: LeaderboardUser[]) => {
    try {
      // Fetch KKUP stats for all users in parallel
      const statsPromises = usersList.map(async (u) => {
        try {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/users/${u.id}/kkup-stats`,
            {
              headers: {
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
              },
            }
          );
          if (response.ok) {
            const data = await response.json();
            return { userId: u.id, stats: data };
          }
        } catch (err) {
          console.error(`Failed to fetch KKUP stats for user ${u.id}`, err);
        }
        return null;
      });

      const results = await Promise.all(statsPromises);
      const statsMap: Record<string, any> = {};
      results.forEach((result) => {
        if (result) {
          statsMap[result.userId] = result.stats;
        }
      });
      setKkupStatsMap(statsMap);
    } catch (error) {
      console.error('Error fetching KKUP stats:', error);
    }
  };

  const getRankIcon = (position: number) => {
    if (position === 1) return <Crown className="w-6 h-6 text-[#fbbf24]" />;
    if (position === 2) return <Medal className="w-6 h-6 text-[#9ca3af]" />;
    if (position === 3) return <Medal className="w-6 h-6 text-[#d97706]" />;
    return null;
  };

  const getRankBadgeColor = (position: number) => {
    if (position === 1) return 'bg-gradient-to-br from-[#fbbf24] to-[#f59e0b] text-white';
    if (position === 2) return 'bg-gradient-to-br from-[#9ca3af] to-[#6b7280] text-white';
    if (position === 3) return 'bg-gradient-to-br from-[#d97706] to-[#b45309] text-white';
    return 'bg-[#0f172a]/5 text-[#0f172a]/70';
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const scrollToCurrentUser = () => {
    if (!user) return;
    
    const currentUserIndex = users.findIndex(u => u.id === user.id);
    if (currentUserIndex === -1) return;

    // Find the user card element and scroll to it
    const userCard = document.querySelector(`[data-user-id="${user.id}"]`);
    if (userCard) {
      userCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a brief highlight effect
      userCard.classList.add('ring-4', 'ring-[#f97316]/50');
      setTimeout(() => {
        userCard.classList.remove('ring-4', 'ring-[#f97316]/50');
      }, 2000);
    }
  };

  const handleDropdownClick = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleDropdownClose = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsDropdownOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleDropdownClose);
    return () => {
      document.removeEventListener('mousedown', handleDropdownClose);
    };
  }, []);

  const filteredUsers = users.filter(u =>
    u.discord_username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header Card */}
        <div className="bg-gradient-to-br from-[#f97316]/10 to-[#f97316]/5 rounded-3xl p-4 sm:p-8 border-2 border-[#f97316]/20 mb-4 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-4 mb-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#f97316] flex items-center justify-center flex-shrink-0">
              <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#0f172a]">Guild Leaderboard</h2>
              <p className="text-[#0f172a]/70 text-xs sm:text-sm">
                Top ranked members of The Corn Field 🌽
              </p>
            </div>
          </div>

          {/* Search Bar and Jump Button */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0f172a]/40" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-2 text-sm border-2 border-[#0f172a]/10 rounded-xl focus:outline-none focus:border-[#f97316] transition-all bg-white"
              />
            </div>
            <button
              onClick={scrollToCurrentUser}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#f97316] hover:bg-[#ea580c] text-white text-sm font-semibold rounded-xl transition-all whitespace-nowrap"
            >
              Jump to You
              <Eye className="w-4 h-4" />
            </button>
          </div>

          {(user?.role === 'owner' || user?.role === 'admin') && (
            <div className="pt-3 border-t border-[#f97316]/20">
              <p className="text-xs text-[#0f172a]/60 text-center">
                💡 Click on any user to view their profile
              </p>
            </div>
          )}
        </div>

        {/* Leaderboard Content */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 border-2 border-[#0f172a]/10 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-[#f97316] mx-auto mb-4" />
            <p className="text-sm text-[#0f172a]/70">Loading leaderboard...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 border-2 border-[#0f172a]/10 text-center">
            <Trophy className="w-16 h-16 text-[#0f172a]/20 mx-auto mb-4" />
            <p className="text-lg font-semibold text-[#0f172a] mb-2">No members yet!</p>
            <p className="text-sm text-[#0f172a]/70">
              Be the first to join the guild and climb the ranks.
            </p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {filteredUsers.map((user, index) => {
              const position = index + 1;
              const isTopThree = position <= 3;
              const emoji = rankEmojis[user.rank_id - 1];
              const isPopdKernel = user.rank_id === 11;

              return (
                <div
                  key={user.id}
                  data-user-id={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`bg-white rounded-2xl shadow-sm p-3 sm:p-6 border-2 transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer ${
                    isTopThree 
                      ? 'border-[#f97316]/30 bg-gradient-to-r from-[#f97316]/5 to-transparent' 
                      : 'border-[#0f172a]/10'
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-4">
                    {/* Position Badge - Hidden on mobile */}
                    <div className={`hidden sm:flex w-12 h-12 rounded-xl ${getRankBadgeColor(position)} items-center justify-center flex-shrink-0 font-bold text-lg shadow-sm`}>
                      {getRankIcon(position) || `#${position}`}
                    </div>

                    {/* User Avatar */}
                    {user.discord_avatar ? (
                      <img 
                        src={user.discord_avatar} 
                        alt={user.discord_username}
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-[#f97316]/20 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#f97316]/10 flex items-center justify-center border-2 border-[#f97316]/20 flex-shrink-0">
                        <span className="text-[#f97316] font-bold text-lg sm:text-xl">
                          {user.discord_username[0].toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                        <p className="font-bold text-[#0f172a] text-base sm:text-lg truncate">
                          {user.discord_username}
                        </p>
                        {user.role === 'owner' && (
                          <span className="px-1.5 py-0.5 sm:px-2 bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white text-[10px] sm:text-xs font-semibold rounded-full">
                            OWNER
                          </span>
                        )}
                        {user.role === 'queen_of_hog' && (
                          <span className="px-1.5 py-0.5 sm:px-2 bg-[#ec4899] text-white text-[10px] sm:text-xs font-semibold rounded-full flex items-center gap-1">
                            🐷 QUEEN OF HOG
                          </span>
                        )}
                        {user.role === 'admin' && (
                          <span className="px-1.5 py-0.5 sm:px-2 bg-[#3b82f6] text-white text-[10px] sm:text-xs font-semibold rounded-full">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-[#0f172a]/60">
                        {isPopdKernel ? (
                          <Popcorn className="w-5 h-5 sm:w-6 sm:h-6 text-[#f97316]" />
                        ) : (
                          <span className="text-xl sm:text-2xl">{emoji}</span>
                        )}
                        <span className="font-semibold text-[#f97316] text-xs sm:text-sm truncate">{user.ranks.name}</span>
                      </div>
                    </div>

                    {/* Right Side: OpenDota Badge + Prestige */}
                    <div className="flex-shrink-0">
                      <div className="flex items-center gap-2 sm:gap-3">
                        {/* OpenDota Badge Rank */}
                        {user.opendota_data?.badge_rank && user.opendota_data.badge_rank.medal !== 'Unranked' && (
                          <div className="flex flex-col items-center">
                            <span className="text-base sm:text-xl mb-0.5">🏅</span>
                            <p className="text-[10px] sm:text-xs font-bold text-[#f97316] text-center leading-tight">
                              {user.opendota_data.badge_rank.medal}
                            </p>
                            <p className="text-[10px] sm:text-xs text-[#0f172a]/60">
                              [{user.opendota_data.badge_rank.stars}]
                            </p>
                          </div>
                        )}

                        {/* Championship Badge */}
                        {kkupStatsMap[user.id]?.linked && kkupStatsMap[user.id]?.championships?.total > 0 && (
                          <div className="flex flex-col items-center">
                            <span className="text-base sm:text-xl mb-0.5">🏆</span>
                            <p className="text-[10px] sm:text-xs font-bold text-[#f97316] text-center leading-tight">
                              {kkupStatsMap[user.id].championships.total}x
                            </p>
                            <p className="text-[10px] sm:text-xs text-[#0f172a]/60">
                              Champ
                            </p>
                          </div>
                        )}

                        {/* Pop'd Kernel MVP Award */}
                        {kkupStatsMap[user.id]?.linked && kkupStatsMap[user.id]?.popd_kernels > 0 && (
                          <div className="flex flex-col items-center">
                            <span className="text-base sm:text-xl mb-0.5">🍿</span>
                            <p className="text-[10px] sm:text-xs font-bold text-[#dc2626] text-center leading-tight">
                              {kkupStatsMap[user.id].popd_kernels}x
                            </p>
                            <p className="text-[10px] sm:text-xs text-[#0f172a]/60">
                              MVP
                            </p>
                          </div>
                        )}

                        {/* Prestige Badge */}
                        <div className="flex flex-col items-center">
                          {user.prestige_level === 0 ? (
                            <Star className="w-4 h-4 sm:w-5 sm:h-5 text-[#fbbf24] fill-[#fbbf24] mb-0.5" />
                          ) : user.prestige_level === 5 ? (
                            <span className="text-2xl sm:text-3xl mb-0.5">🌟</span>
                          ) : (
                            <span className="text-2xl sm:text-3xl mb-0.5">🌟</span>
                          )}
                          <p className="text-[10px] sm:text-xs font-bold text-[#fbbf24] text-center leading-tight">
                            <span className="sm:hidden">Lvl {user.prestige_level}</span>
                            <span className="hidden sm:inline">Prestige Level {user.prestige_level}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info Card */}
        {!loading && users.length > 0 && (
          <div className="mt-4 sm:mt-6 bg-[#3b82f6]/5 rounded-2xl p-4 sm:p-6 border-2 border-[#3b82f6]/20">
            <p className="text-xs sm:text-sm text-[#0f172a]/70 text-center">
              🌽 Rankings are updated automatically when members are promoted, demoted, or prestiged.
            </p>
          </div>
        )}
      </div>

      {/* User Profile Modal */}
      {selectedUser && (
        <UserProfileModal
          user={selectedUser}
          currentUser={user}
          onClose={() => setSelectedUser(null)}
          onUpdate={fetchLeaderboard}
        />
      )}

      <Footer />
    </div>
  );
}