import { X, TrendingUp, ArrowUp, ArrowDown, Sparkles, Shield, Crown, Calendar, Gamepad2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { SuccessModal } from '@/app/components/success-modal';
import { getHeroName } from '@/lib/dota-heroes';

interface UserProfileModalProps {
  user: {
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
  };
  currentUser: any;
  onClose: () => void;
  onUpdate: () => void;
}

// Rank emojis mapping
const rankEmojis = [
  '🐛', // 1. Earwig
  '🦌', // 2. Ugandan Kob
  '🌽', // 3. Private Maize
  '🥄', // 4. Specialist Ingredient
  '🍞', // 5. Corporal Corn Bread
  '', // 6. Sergeant Husk
  '🌻', // 7. Sergeant Major Fields
  '🎯', // 8. Captain Cornhole
  '⭐', // 9. Major Cob
  '🌟', // 10. Corn Star
  '💥', // 11. Pop'd Kernel (prestige 5 only)
];

export function UserProfileModal({ user, currentUser, onClose, onUpdate }: UserProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'rank_up' | 'rank_down' | 'prestige' | 'role_change';
    title: string;
    message: string;
    newRole?: string;
  } | null>(null);
  const [result, setResult] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
    helpText?: string;
  } | null>(null);

  const canManageUser = currentUser?.role === 'owner' || currentUser?.role === 'admin';
  const isOwner = currentUser?.role === 'owner';
  const maxRank = user.prestige_level === 5 ? 11 : 10;
  const canRankUp = user.rank_id < maxRank;
  const canRankDown = user.rank_id > 1;
  const canPrestige = user.prestige_level < 5 && user.rank_id >= maxRank;

  const handleRankAction = (action: 'rank_up' | 'rank_down' | 'prestige') => {
    const confirmData = {
      rank_up: {
        title: 'Rank Up User',
        message: `Rank up ${user.discord_username} from ${user.ranks.name} to the next rank?`,
      },
      rank_down: {
        title: 'Rank Down User',
        message: `Rank down ${user.discord_username} from ${user.ranks.name} to the previous rank?`,
      },
      prestige: {
        title: 'Prestige User',
        message: `Prestige ${user.discord_username}? This will reset them to Rank 1 and increase their prestige level to ${user.prestige_level + 1}.`,
      },
    };

    setConfirmAction({ type: action, ...confirmData[action] });
  };

  const handleRoleChange = (newRole: 'guest' | 'member' | 'admin') => {
    const roleLabels = { guest: 'Guest', member: 'Member', admin: 'Admin' };
    setConfirmAction({
      type: 'role_change',
      title: 'Change User Role',
      message: `Change ${user.discord_username}'s role to ${roleLabels[newRole]}?`,
      newRole,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const executeAction = async () => {
    if (!confirmAction) return;

    setLoading(true);
    setConfirmAction(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setResult({
          type: 'error',
          title: 'Authentication Error',
          message: 'Please sign in first',
        });
        setLoading(false);
        return;
      }

      let response;

      if (confirmAction.type === 'role_change') {
        response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/users/${user.id}/role`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ role: confirmAction.newRole }),
          }
        );
      } else {
        response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/users/${user.id}/rank`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: confirmAction.type }),
          }
        );
      }

      if (!response.ok) {
        const data = await response.json();
        setResult({
          type: 'error',
          title: 'Update Failed',
          message: data.error || 'Failed to update user. Please try again.',
        });
        setLoading(false);
        return;
      }

      const successMessages = {
        rank_up: {
          title: 'Ranked Up! ✨',
          message: `${user.discord_username} has been ranked up successfully!`,
          helpText: 'The leaderboard will update automatically to reflect this change.',
        },
        rank_down: {
          title: 'Ranked Down 📉',
          message: `${user.discord_username} has been ranked down.`,
          helpText: 'The leaderboard will update automatically to reflect this change.',
        },
        prestige: {
          title: 'Prestiged! 🌟',
          message: `${user.discord_username} has prestiged to level ${user.prestige_level + 1}!`,
          helpText: 'They have been reset to Rank 1 with increased prestige level.',
        },
        role_change: {
          title: 'Role Updated! ✅',
          message: `${user.discord_username}'s role has been changed to ${confirmAction.newRole}.`,
          helpText: 'Their permissions have been updated immediately.',
        },
      };

      setResult({
        type: 'success',
        ...successMessages[confirmAction.type],
      });

      setLoading(false);
      onUpdate();
      
      // Close after showing success
      setTimeout(() => {
        setResult(null);
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error updating user:', error);
      setResult({
        type: 'error',
        title: 'Update Failed',
        message: 'An unexpected error occurred. Please try again.',
      });
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Header with Close Button */}
          <div className="relative bg-gradient-to-br from-[#f97316]/10 to-[#f97316]/5 rounded-t-3xl p-4 border-b-2 border-[#f97316]/20 flex-shrink-0">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center transition-all hover:scale-110"
            >
              <X className="w-5 h-5 text-[#0f172a]" />
            </button>

            {/* User Avatar & Basic Info */}
            <div className="flex flex-col items-center">
              {user.discord_avatar ? (
                <img 
                  src={user.discord_avatar} 
                  alt={user.discord_username}
                  className="w-20 h-20 rounded-full border-4 border-white shadow-lg mb-3"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#f97316]/20 flex items-center justify-center border-4 border-white shadow-lg mb-3">
                  <span className="text-[#f97316] font-bold text-3xl">
                    {user.discord_username[0].toUpperCase()}
                  </span>
                </div>
              )}

              <h3 className="text-xl font-bold text-[#0f172a] mb-2">{user.discord_username}</h3>
              
              {/* Role Badge */}
              <div className="flex items-center gap-2">
                {user.role === 'owner' && (
                  <span className="px-3 py-1 bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white text-sm font-semibold rounded-full flex items-center gap-1.5 shadow-md">
                    <Crown className="w-4 h-4" />
                    OWNER
                  </span>
                )}
                {user.role === 'queen_of_hog' && (
                  <span className="px-3 py-1 bg-[#ec4899] text-white text-sm font-semibold rounded-full flex items-center gap-1.5 shadow-md">
                    🐷 QUEEN OF HOG
                  </span>
                )}
                {user.role === 'admin' && (
                  <span className="px-3 py-1 bg-[#3b82f6] text-white text-sm font-semibold rounded-full flex items-center gap-1.5 shadow-md">
                    <Shield className="w-4 h-4" />
                    ADMIN
                  </span>
                )}
                {user.role === 'member' && (
                  <span className="px-3 py-1 bg-[#10b981] text-white text-sm font-semibold rounded-full shadow-md">
                    MEMBER
                  </span>
                )}
                {user.role === 'guest' && (
                  <span className="px-3 py-1 bg-[#0f172a]/10 text-[#0f172a]/60 text-sm font-semibold rounded-full">
                    GUEST
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable Profile Details */}
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* Current Rank Card - More mobile friendly */}
            <div className="bg-gradient-to-br from-[#f97316]/10 to-[#f97316]/5 rounded-2xl p-4 border-2 border-[#f97316]/20">
              <p className="text-xs text-[#0f172a]/60 mb-3 font-semibold">Current Rank</p>
              <div className="flex flex-col gap-3">
                {/* Rank Info */}
                <div className="flex items-center gap-3">
                  <span className="text-4xl sm:text-5xl">{rankEmojis[user.rank_id - 1]}</span>
                  <div className="flex-1">
                    <p className="text-lg sm:text-xl font-bold text-[#f97316]">{user.ranks.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 bg-[#fbbf24]/20 text-[#d97706] text-xs font-semibold rounded-full flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Prestige {user.prestige_level}
                      </span>
                      <span className="text-sm font-semibold text-[#0f172a]/60">
                        {user.rank_id}/{maxRank}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Prestige Level */}
            {user.prestige_level > 0 && (
              <div className="bg-gradient-to-br from-[#fbbf24]/10 to-[#fbbf24]/5 rounded-2xl p-4 border-2 border-[#fbbf24]/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#fbbf24] flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-[#0f172a]/60 font-semibold">Prestige Level</p>
                    <p className="text-xl font-bold text-[#d97706]">Level {user.prestige_level}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Connected Accounts */}
            {user.opendota_id && (
              <div className="bg-[#0f172a]/5 rounded-2xl p-4 border-2 border-[#0f172a]/10">
                <p className="text-xs text-[#0f172a]/60 mb-3 font-semibold">🔗 CONNECTED ACCOUNTS</p>
                <div className="space-y-2">
                  {/* OpenDota */}
                  <button
                    onClick={() => window.open(`https://www.opendota.com/players/${user.opendota_id}`, '_blank')}
                    className="w-full flex items-center justify-between p-2 bg-[#6366f1]/5 hover:bg-[#6366f1]/10 border border-[#6366f1]/20 rounded-xl transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#6366f1] flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-[#0f172a]">OpenDota</span>
                    </div>
                    <svg className="w-4 h-4 text-[#6366f1] group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Dotabuff */}
                  <button
                    onClick={() => window.open(`https://www.dotabuff.com/players/${user.opendota_id}`, '_blank')}
                    className="w-full flex items-center justify-between p-2 bg-[#3b82f6]/5 hover:bg-[#3b82f6]/10 border border-[#3b82f6]/20 rounded-xl transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#3b82f6] flex items-center justify-center flex-shrink-0">
                        <Gamepad2 className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-[#0f172a]">Dotabuff</span>
                    </div>
                    <svg className="w-4 h-4 text-[#3b82f6] group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Steam */}
                  <button
                    onClick={() => {
                      const steamId64 = (BigInt(user.opendota_id!) + BigInt('76561197960265728')).toString();
                      window.open(`https://steamcommunity.com/profiles/${steamId64}`, '_blank');
                    }}
                    className="w-full flex items-center justify-between p-2 bg-[#0f172a]/5 hover:bg-[#0f172a]/10 border border-[#0f172a]/20 rounded-xl transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#0f172a] flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"/>
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-[#0f172a]">Steam</span>
                    </div>
                    <svg className="w-4 h-4 text-[#0f172a] group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* OpenDota Stats */}
            {user.opendota_data && (
              <div className="bg-gradient-to-br from-[#3b82f6]/10 to-[#3b82f6]/5 rounded-2xl p-4 border-2 border-[#3b82f6]/20">
                <p className="text-xs text-[#0f172a]/60 font-semibold mb-3">🎮 DOTA 2 STATS</p>
                
                {/* Badge Rank */}
                {user.opendota_data.badge_rank && user.opendota_data.badge_rank.medal !== 'Unranked' && (
                  <div className="mb-3 pb-3 border-b border-[#3b82f6]/20">
                    <p className="text-xs text-[#0f172a]/60 font-semibold mb-2">Badge Rank</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🏅</span>
                      <div>
                        <p className="text-lg font-bold text-[#f97316]">
                          {user.opendota_data.badge_rank.medal}
                        </p>
                        <p className="text-xs text-[#0f172a]/60">
                          Stars: {user.opendota_data.badge_rank.stars}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Top 3 Most Played Heroes */}
                {user.opendota_data.top_3_heroes && user.opendota_data.top_3_heroes.length > 0 && (
                  <div className="mb-3 pb-3 border-b border-[#3b82f6]/20">
                    <p className="text-xs text-[#0f172a]/60 font-semibold mb-2">Top 3 Most Played Heroes</p>
                    <div className="space-y-1.5">
                      {user.opendota_data.top_3_heroes.slice(0, 3).map((hero: any, index: number) => {
                        const winrate = hero.games > 0 ? ((hero.win / hero.games) * 100).toFixed(1) : '0.0';
                        return (
                          <div key={hero.hero_id} className="flex items-center justify-between text-xs">
                            <span className="text-[#0f172a]/70 flex-1">
                              {index + 1}. {getHeroName(hero.hero_id)}
                            </span>
                            <div className="flex items-center gap-2 text-[#0f172a]/60 font-mono text-[10px]">
                              <span>{hero.games} games</span>
                              <span className={`font-semibold ${parseFloat(winrate) >= 50 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                                {winrate}% WR
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Primary Role */}
                {user.opendota_data.primary_role && (
                  <div>
                    <p className="text-xs text-[#0f172a]/60 font-semibold mb-1">Primary Role</p>
                    <p className="text-sm font-semibold text-[#3b82f6]">
                      {user.opendota_data.primary_role}
                    </p>
                  </div>
                )}

                {/* No stats available */}
                {!user.opendota_data.badge_rank && !user.opendota_data.top_3_heroes?.length && !user.opendota_data.primary_role && (
                  <p className="text-xs text-[#0f172a]/60 text-center">
                    OpenDota stats unavailable
                  </p>
                )}
              </div>
            )}

            {/* Member Since */}
            <div className="bg-[#0f172a]/5 rounded-2xl p-4 border-2 border-[#0f172a]/10">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-[#0f172a]/60" />
                <div>
                  <p className="text-xs text-[#0f172a]/60 font-semibold">Member Since</p>
                  <p className="text-sm font-semibold text-[#0f172a]">{formatDate(user.created_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Officer actions removed - home page user management is sufficient */}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && !loading && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText="Confirm"
          cancelText="Cancel"
          confirmVariant={confirmAction.type === 'rank_down' ? 'danger' : confirmAction.type === 'rank_up' ? 'success' : 'primary'}
          onConfirm={executeAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Result Modal */}
      {result && (
        <SuccessModal
          type={result.type}
          title={result.title}
          message={result.message}
          helpText={result.helpText}
          onClose={() => {
            setResult(null);
            if (result.type === 'success') {
              onClose();
            }
          }}
        />
      )}
    </>
  );
}