import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { Users, Shield, Crown, UserX, Loader2, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { SuccessModal } from '@/app/components/success-modal';

export function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [rankActionUserId, setRankActionUserId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'role_change' | 'rank_up' | 'rank_down' | 'prestige';
    userId: string;
    newRole?: string;
    userName?: string;
  } | null>(null);
  const [result, setResult] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
    helpText?: string;
  } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoading(false);
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/users`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();
      
      if (response.ok) {
        setUsers(data.users || []);
      } else {
        console.error('Failed to fetch users:', data.error);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const user = users.find(u => u.id === userId);
    const roleLabels: any = { guest: 'Guest', member: 'Member', admin: 'Admin', owner: 'Owner' };
    
    setConfirmAction({
      type: 'role_change',
      userId,
      newRole,
      userName: user?.discord_username || 'User',
    });
  };

  const handleRankAction = async (userId: string, action: 'rank_up' | 'rank_down' | 'prestige') => {
    const user = users.find(u => u.id === userId);
    
    setConfirmAction({
      type: action,
      userId,
      userName: user?.discord_username || 'User',
    });
  };

  const executeAction = async () => {
    if (!confirmAction) return;

    const { type, userId, newRole, userName } = confirmAction;
    
    // Set loading state based on action type
    if (type === 'role_change') {
      setUpdatingUserId(userId);
    } else {
      setRankActionUserId(userId);
    }
    
    setConfirmAction(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setResult({
          type: 'error',
          title: 'Authentication Error',
          message: 'Please sign in first',
        });
        setUpdatingUserId(null);
        setRankActionUserId(null);
        return;
      }

      let response;

      if (type === 'role_change') {
        response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/users/${userId}/role`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ role: newRole }),
          }
        );
      } else {
        response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/users/${userId}/rank`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: type }),
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
        setUpdatingUserId(null);
        setRankActionUserId(null);
        return;
      }

      // Refresh users list
      await fetchUsers();

      const successMessages: any = {
        role_change: {
          title: 'Role Updated! ✅',
          message: `${userName}'s role has been changed to ${newRole}.`,
          helpText: 'Their permissions have been updated immediately.',
        },
        rank_up: {
          title: 'Ranked Up! ✨',
          message: `${userName} has been ranked up successfully!`,
          helpText: 'The leaderboard will update automatically.',
        },
        rank_down: {
          title: 'Ranked Down 📉',
          message: `${userName} has been ranked down.`,
          helpText: 'The leaderboard will update automatically.',
        },
        prestige: {
          title: 'Prestiged! 🌟',
          message: `${userName} has prestiged!`,
          helpText: 'They have been reset to Rank 1 with increased prestige level.',
        },
      };

      setResult({
        type: 'success',
        ...successMessages[type],
      });

      setUpdatingUserId(null);
      setRankActionUserId(null);

      // Auto-close success modal after 2 seconds
      setTimeout(() => {
        setResult(null);
      }, 2000);
    } catch (error) {
      console.error('Error updating user:', error);
      setResult({
        type: 'error',
        title: 'Update Failed',
        message: 'An unexpected error occurred. Please try again.',
      });
      setUpdatingUserId(null);
      setRankActionUserId(null);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-[#f59e0b]" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-[#3b82f6]" />;
      case 'member':
        return <Users className="w-4 h-4 text-[#10b981]" />;
      default:
        return <UserX className="w-4 h-4 text-[#6b7280]" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30';
      case 'admin':
        return 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30';
      case 'member':
        return 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30';
      default:
        return 'bg-[#6b7280]/10 text-[#6b7280] border-[#6b7280]/30';
    }
  };

  const filteredUsers = filterRole === 'all' 
    ? users 
    : users.filter(u => u.role === filterRole);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 border-2 border-[#0f172a]/10 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#f97316] mx-auto mb-2" />
        <p className="text-sm text-[#0f172a]/70">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border-2 border-[#0f172a]/10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#f97316]/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-[#f97316]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#0f172a]">User Management</h3>
            <p className="text-sm text-[#0f172a]/60">{users.length} total users</p>
          </div>
        </div>

        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 rounded-lg border-2 border-[#0f172a]/10 bg-white text-sm text-[#0f172a] cursor-pointer hover:border-[#f97316]/30 transition-colors"
        >
          <option value="all">All Roles</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="guest">Guest</option>
        </select>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <p className="text-center text-[#0f172a]/60 py-8">No users found for this filter.</p>
        ) : (
          filteredUsers.map((user) => (
            <div
              key={user.id}
              className="p-4 rounded-xl border-2 border-[#0f172a]/10 hover:border-[#f97316]/20 transition-colors bg-[#fdf5e9]/30"
            >
              {/* User Info Row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  {user.discord_avatar ? (
                    <img
                      src={user.discord_avatar}
                      alt={user.discord_username}
                      className="w-10 h-10 rounded-full border-2 border-[#f97316]/20"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#f97316]/20 flex items-center justify-center">
                      <span className="text-[#f97316] font-bold">
                        {user.discord_username?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-[#0f172a]">{user.discord_username}</p>
                      {(user.role === 'owner' || user.role === 'admin') && (
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${getRoleBadgeColor(user.role)}`}>
                          {getRoleIcon(user.role)}
                          {user.role === 'owner' ? 'OWNER' : 'ADMIN'}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#0f172a]/60">
                      <span>{user.ranks?.name || 'No Rank'}</span>
                      <span>•</span>
                      <span>Prestige {user.prestige_level}</span>
                    </div>
                  </div>
                </div>

                {/* Role Dropdown - Hidden for Owners */}
                <div className="ml-4">
                  {user.role === 'owner' ? (
                    <div className="text-xs text-[#0f172a]/40 italic">Protected</div>
                  ) : updatingUserId === user.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-[#f97316]" />
                  ) : (
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="px-2 py-1 rounded-lg border-2 border-[#0f172a]/10 bg-white text-xs text-[#0f172a] cursor-pointer hover:border-[#f97316]/30 transition-colors"
                      disabled={updatingUserId !== null}
                    >
                      <option value="guest">Guest</option>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Rank Action Buttons - Only for Members */}
              {user.role !== 'guest' && (
                <div className="flex items-center gap-2 pt-3 border-t border-[#0f172a]/10">
                  <Button
                    size="sm"
                    className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white text-xs h-8"
                    onClick={() => handleRankAction(user.id, 'rank_up')}
                    disabled={rankActionUserId === user.id}
                  >
                    {rankActionUserId === user.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <ChevronUp className="w-3 h-3 mr-1" />
                        Rank Up
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white text-xs h-8"
                    onClick={() => handleRankAction(user.id, 'rank_down')}
                    disabled={rankActionUserId === user.id}
                  >
                    {rankActionUserId === user.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3 mr-1" />
                        Rank Down
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-[#f59e0b] hover:bg-[#d97706] text-white text-xs h-8"
                    onClick={() => handleRankAction(user.id, 'prestige')}
                    disabled={rankActionUserId === user.id}
                  >
                    {rankActionUserId === user.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Star className="w-3 h-3 mr-1" />
                        Prestige
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Confirm Modal */}
      {confirmAction && (
        <ConfirmModal
          title={`Confirm ${confirmAction.type === 'role_change' ? 'Role Change' : 'Rank Action'}`}
          message={
            confirmAction.type === 'role_change'
              ? `Are you sure you want to change ${confirmAction.userName}'s role to ${confirmAction.newRole}?`
              : `Are you sure you want to ${confirmAction.type === 'rank_up' ? 'rank up' : confirmAction.type === 'rank_down' ? 'rank down' : 'prestige'} ${confirmAction.userName}?`
          }
          onConfirm={executeAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Success Modal */}
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