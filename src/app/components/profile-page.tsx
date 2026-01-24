import { User, LogOut, Shield } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Footer } from '@/app/components/footer';

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
    '🎯', // 8. Captain Cornhole
    '⭐', // 9. Major Cob
    '🌟', // 10. Corn Star
    '💥', // 11. Pop'd Kernel (prestige 5 only)
  ];

  // Get display name based on role
  const getDisplayRank = () => {
    if (user?.role === 'owner') return 'Colonel Kernel';
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

  return (
    <div className="min-h-screen bg-[#fdf5e9] px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Profile Header Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border-2 border-[#0f172a]/10 mb-6">
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
                {user?.role || 'guest'}
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

        {/* Actions Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border-2 border-[#0f172a]/10 mb-24">
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
      </div>

      <Footer />
    </div>
  );
}