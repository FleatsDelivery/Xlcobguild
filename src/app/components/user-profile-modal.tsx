import { X, TrendingUp, ArrowUp, ArrowDown, Sparkles, Shield, Crown, Calendar } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { SuccessModal } from '@/app/components/success-modal';

interface UserProfileModalProps {
  user: {
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
  '🌾', // 6. Sergeant Husk
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
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          {/* Header with Close Button */}
          <div className="relative bg-gradient-to-br from-[#f97316]/10 to-[#f97316]/5 rounded-t-3xl p-6 border-b-2 border-[#f97316]/20">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center transition-all hover:scale-110"
            >
              <X className="w-5 h-5 text-[#0f172a]" />
            </button>

            {/* User Avatar & Basic Info */}
            <div className="flex flex-col items-center">
              {user.discord_avatar ? (
                <img 
                  src={user.discord_avatar} 
                  alt={user.discord_username}
                  className="w-24 h-24 rounded-full border-4 border-white shadow-lg mb-4"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#f97316]/20 flex items-center justify-center border-4 border-white shadow-lg mb-4">
                  <span className="text-[#f97316] font-bold text-4xl">
                    {user.discord_username[0].toUpperCase()}
                  </span>
                </div>
              )}

              <h3 className="text-2xl font-bold text-[#0f172a] mb-2">{user.discord_username}</h3>
              
              {/* Role Badge */}
              <div className="flex items-center gap-2 mb-4">
                {user.role === 'owner' && (
                  <span className="px-3 py-1 bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white text-sm font-semibold rounded-full flex items-center gap-1.5 shadow-md">
                    <Crown className="w-4 h-4" />
                    OWNER
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

          {/* Profile Details */}
          <div className="p-6 space-y-4">
            {/* Current Rank Card */}
            <div className="bg-gradient-to-br from-[#f97316]/10 to-[#f97316]/5 rounded-2xl p-4 border-2 border-[#f97316]/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#0f172a]/60 mb-1 font-semibold">Current Rank</p>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-[#fbbf24]/20 text-[#d97706] text-xs font-semibold rounded-full flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Prestige {user.prestige_level}
                    </span>
                    <span className="text-3xl">{rankEmojis[user.rank_id - 1]}</span>
                    <span className="text-xl font-bold text-[#f97316]">{user.ranks.name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#0f172a]/60 mb-1 font-semibold">Progress</p>
                  <p className="text-2xl font-bold text-[#0f172a]">{user.rank_id}/{maxRank}</p>
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

                {/* Top 3 Heroes */}
                {user.opendota_data.top_3_heroes && user.opendota_data.top_3_heroes.length > 0 && (
                  <div className="mb-3 pb-3 border-b border-[#3b82f6]/20">
                    <p className="text-xs text-[#0f172a]/60 font-semibold mb-2">Top 3 Heroes</p>
                    <div className="space-y-1">
                      {user.opendota_data.top_3_heroes.slice(0, 3).map((hero: any, index: number) => (
                        <div key={hero.hero_id} className="flex items-center justify-between text-xs">
                          <span className="text-[#0f172a]/70">
                            {index + 1}. Hero #{hero.hero_id}
                          </span>
                          <span className="text-[#0f172a]/60 font-mono">
                            {hero.games} games
                          </span>
                        </div>
                      ))}
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
          </div>

          {/* Action Bar - Officers & Owners Only */}
          {canManageUser && user.role !== 'owner' && (
            <div className="border-t-2 border-[#0f172a]/10 p-6 bg-[#0f172a]/5 rounded-b-3xl">
              <p className="text-xs text-[#0f172a]/60 font-semibold mb-3 text-center">OFFICER ACTIONS</p>
              
              {/* Rank Actions */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <Button
                  onClick={() => handleRankAction('rank_up')}
                  disabled={!canRankUp || loading}
                  className={`flex flex-col items-center gap-1 h-auto py-3 ${
                    canRankUp
                      ? 'bg-[#10b981] hover:bg-[#059669] text-white'
                      : 'bg-[#0f172a]/10 text-[#0f172a]/30 cursor-not-allowed'
                  }`}
                >
                  <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
                  <span className="text-xs font-semibold">Rank Up</span>
                </Button>

                <Button
                  onClick={() => handleRankAction('rank_down')}
                  disabled={!canRankDown || loading}
                  className={`flex flex-col items-center gap-1 h-auto py-3 ${
                    canRankDown
                      ? 'bg-[#ef4444] hover:bg-[#dc2626] text-white'
                      : 'bg-[#0f172a]/10 text-[#0f172a]/30 cursor-not-allowed'
                  }`}
                >
                  <ArrowDown className="w-5 h-5" strokeWidth={2.5} />
                  <span className="text-xs font-semibold">Rank Down</span>
                </Button>

                <Button
                  onClick={() => handleRankAction('prestige')}
                  disabled={!canPrestige || loading}
                  className={`flex flex-col items-center gap-1 h-auto py-3 ${
                    canPrestige
                      ? 'bg-gradient-to-br from-[#fbbf24] to-[#f59e0b] hover:from-[#f59e0b] hover:to-[#d97706] text-white'
                      : 'bg-[#0f172a]/10 text-[#0f172a]/30 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                  <span className="text-xs font-semibold">Prestige</span>
                </Button>
              </div>

              {/* Role Management - Owner Only */}
              {isOwner && (
                <div className="pt-3 border-t border-[#0f172a]/10">
                  <p className="text-xs text-[#0f172a]/60 font-semibold mb-2">Change Role</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      onClick={() => handleRoleChange('guest')}
                      disabled={loading || user.role === 'guest'}
                      className="text-xs bg-[#0f172a]/10 hover:bg-[#0f172a]/20 text-[#0f172a] disabled:opacity-50"
                    >
                      Guest
                    </Button>
                    <Button
                      onClick={() => handleRoleChange('member')}
                      disabled={loading || user.role === 'member'}
                      className="text-xs bg-[#10b981]/20 hover:bg-[#10b981]/30 text-[#10b981] disabled:opacity-50"
                    >
                      Member
                    </Button>
                    <Button
                      onClick={() => handleRoleChange('admin')}
                      disabled={loading || user.role === 'admin'}
                      className="text-xs bg-[#3b82f6]/20 hover:bg-[#3b82f6]/30 text-[#3b82f6] disabled:opacity-50"
                    >
                      Admin
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Non-officer view */}
          {!canManageUser && (
            <div className="p-4 text-center">
              <p className="text-sm text-[#0f172a]/60">
                Only officers can manage user ranks
              </p>
            </div>
          )}
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