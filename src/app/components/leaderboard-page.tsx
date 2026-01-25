import { Footer } from '@/app/components/footer';
import { Trophy, Medal, Crown, Loader2, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
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
      } else {
        console.error('Failed to fetch leaderboard');
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
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

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header Card */}
        <div className="bg-gradient-to-br from-[#f97316]/10 to-[#f97316]/5 rounded-3xl p-8 border-2 border-[#f97316]/20 mb-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-full bg-[#f97316] flex items-center justify-center">
              <Trophy className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-[#0f172a]">Leaderboard</h2>
              <p className="text-[#0f172a]/70 text-sm">
                Top ranked members of The Corn Field 🌽
              </p>
            </div>
          </div>
          {(user?.role === 'owner' || user?.role === 'admin') && (
            <div className="mt-4 pt-4 border-t border-[#f97316]/20">
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
          <div className="space-y-3">
            {users.map((user, index) => {
              const position = index + 1;
              const isTopThree = position <= 3;
              const emoji = rankEmojis[user.rank_id - 1];

              return (
                <div
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`bg-white rounded-2xl shadow-sm p-6 border-2 transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer ${
                    isTopThree 
                      ? 'border-[#f97316]/30 bg-gradient-to-r from-[#f97316]/5 to-transparent' 
                      : 'border-[#0f172a]/10'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Position Badge */}
                    <div className={`w-12 h-12 rounded-xl ${getRankBadgeColor(position)} flex items-center justify-center flex-shrink-0 font-bold text-lg shadow-sm`}>
                      {getRankIcon(position) || `#${position}`}
                    </div>

                    {/* User Avatar */}
                    {user.discord_avatar ? (
                      <img 
                        src={user.discord_avatar} 
                        alt={user.discord_username}
                        className="w-14 h-14 rounded-full border-2 border-[#f97316]/20"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-[#f97316]/10 flex items-center justify-center border-2 border-[#f97316]/20">
                        <span className="text-[#f97316] font-bold text-xl">
                          {user.discord_username[0].toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-[#0f172a] text-lg truncate">
                          {user.discord_username}
                        </p>
                        {user.role === 'owner' && (
                          <span className="px-2 py-0.5 bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white text-xs font-semibold rounded-full">
                            OWNER
                          </span>
                        )}
                        {user.role === 'admin' && (
                          <span className="px-2 py-0.5 bg-[#3b82f6] text-white text-xs font-semibold rounded-full">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#0f172a]/60">
                        <span className="px-2 py-0.5 bg-[#fbbf24]/20 text-[#d97706] text-xs font-semibold rounded-full flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Prestige {user.prestige_level}
                        </span>
                        <span className="text-2xl">{emoji}</span>
                        <span className="font-semibold text-[#f97316]">{user.ranks.name}</span>
                      </div>
                    </div>

                    {/* Leaderboard Position + OpenDota Badge */}
                    <div className="text-right flex-shrink-0">
                      {/* OpenDota Badge Rank */}
                      {user.opendota_data?.badge_rank && user.opendota_data.badge_rank.medal !== 'Unranked' && (
                        <div className="mb-3">
                          <div className="flex flex-col items-center">
                            <span className="text-2xl mb-0.5">🏅</span>
                            <p className="text-xs font-bold text-[#f97316]">
                              {user.opendota_data.badge_rank.medal}
                            </p>
                            <p className="text-xs text-[#0f172a]/60">
                              [{user.opendota_data.badge_rank.stars}]
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Leaderboard Position */}
                      <div>
                        <p className="text-sm text-[#0f172a]/60 mb-1">Rank</p>
                        <p className="text-2xl font-bold text-[#0f172a]">
                          #{position}
                        </p>
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
          <div className="mt-6 bg-[#3b82f6]/5 rounded-2xl p-6 border-2 border-[#3b82f6]/20">
            <p className="text-sm text-[#0f172a]/70 text-center">
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