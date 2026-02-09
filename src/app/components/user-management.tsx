import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { Users, Shield, Crown, UserX, Loader2, ChevronDown, ChevronUp, Star, Link, Unlink, ChevronsUp, ChevronsDown, RotateCcw, SquareCheck, Square, Search } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { SuccessModal } from '@/app/components/success-modal';
import { LinkKKupProfileModal } from '@/app/components/link-kkup-profile-modal';

type ActionType = 'rank_up' | 'rank_down' | 'prestige' | 'rank_to_max' | 'rank_to_min' | 'reset_prestige' | 'link_kkup' | 'unlink_kkup';

const ACTION_CONFIG: Record<ActionType, { label: string; shortLabel: string; color: string; hoverColor: string; icon: any; description: string; destructive?: boolean }> = {
  rank_up: {
    label: 'Rank Up',
    shortLabel: 'Rank Up',
    color: 'bg-[#10b981]',
    hoverColor: 'hover:bg-[#059669]',
    icon: ChevronUp,
    description: 'Increase rank by 1',
  },
  rank_down: {
    label: 'Rank Down',
    shortLabel: 'Rank Down',
    color: 'bg-[#ef4444]',
    hoverColor: 'hover:bg-[#dc2626]',
    icon: ChevronDown,
    description: 'Decrease rank by 1',
  },
  prestige: {
    label: 'Prestige',
    shortLabel: 'Prestige',
    color: 'bg-[#f59e0b]',
    hoverColor: 'hover:bg-[#d97706]',
    icon: Star,
    description: 'Prestige up (resets rank to 1)',
  },
  link_kkup: {
    label: 'Link KKUP',
    shortLabel: 'Link',
    color: 'bg-[#6366f1]',
    hoverColor: 'hover:bg-[#4f46e5]',
    icon: Link,
    description: 'Link to KKUP player profile',
  },
  rank_to_max: {
    label: 'Max Rank',
    shortLabel: 'Max',
    color: 'bg-gradient-to-r from-[#f59e0b] to-[#f97316]',
    hoverColor: 'hover:brightness-110',
    icon: ChevronsUp,
    description: 'Set to max rank for current prestige',
  },
  rank_to_min: {
    label: 'To Earwig',
    shortLabel: 'Min',
    color: 'bg-[#78716c]',
    hoverColor: 'hover:bg-[#57534e]',
    icon: ChevronsDown,
    description: 'Reset rank to Earwig (rank 1)',
    destructive: true,
  },
  reset_prestige: {
    label: 'Reset Prestige',
    shortLabel: 'Reset P',
    color: 'bg-[#64748b]',
    hoverColor: 'hover:bg-[#475569]',
    icon: RotateCcw,
    description: 'Reset prestige to 0 and rank to 1',
    destructive: true,
  },
  unlink_kkup: {
    label: 'Unlink KKUP',
    shortLabel: 'Unlink',
    color: 'bg-[#dc2626]',
    hoverColor: 'hover:bg-[#b91c1c]',
    icon: Unlink,
    description: 'Remove KKUP profile link',
    destructive: true,
  },
};

export function UserManagement({ onRefresh }: { onRefresh?: () => Promise<void> }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [linkingUser, setLinkingUser] = useState<any | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'role_change' | ActionType;
    userIds: string[];
    newRole?: string;
    userNames: string[];
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
    setConfirmAction({
      type: 'role_change',
      userIds: [userId],
      newRole,
      userNames: [user?.discord_username || 'User'],
    });
  };

  const handleBatchAction = (action: ActionType) => {
    const selectedUsers = users.filter(u => selectedUserIds.has(u.id));
    
    if (selectedUsers.length === 0) return;

    // Link KKUP only works for single selection
    if (action === 'link_kkup') {
      if (selectedUsers.length !== 1) return;
      setLinkingUser(selectedUsers[0]);
      return;
    }

    setConfirmAction({
      type: action,
      userIds: selectedUsers.map(u => u.id),
      userNames: selectedUsers.map(u => u.discord_username || 'User'),
    });
  };

  const executeAction = async () => {
    if (!confirmAction) return;

    const { type, userIds, newRole } = confirmAction;
    setConfirmAction(null);
    setActionLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setResult({
          type: 'error',
          title: 'Authentication Error',
          message: 'Please sign in first',
        });
        setActionLoading(false);
        return;
      }

      let successCount = 0;
      let errorMessages: string[] = [];

      for (const userId of userIds) {
        try {
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
          } else if (type === 'unlink_kkup') {
            response = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/unlink-user-kkup-profile`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ user_id: userId }),
              }
            );
          } else {
            // rank actions: rank_up, rank_down, prestige, rank_to_max, rank_to_min, reset_prestige
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
            const userName = users.find(u => u.id === userId)?.discord_username || 'User';
            errorMessages.push(`${userName}: ${data.error || 'Failed'}`);
          } else {
            successCount++;
          }
        } catch (err) {
          const userName = users.find(u => u.id === userId)?.discord_username || 'User';
          errorMessages.push(`${userName}: Network error`);
        }
      }

      // Refresh users list
      await fetchUsers();

      const actionLabel = type === 'role_change' 
        ? `Role Change to ${newRole}` 
        : ACTION_CONFIG[type as ActionType]?.label || type;

      if (errorMessages.length > 0 && successCount > 0) {
        setResult({
          type: 'error',
          title: 'Partial Success',
          message: `${successCount} succeeded, ${errorMessages.length} failed.`,
          helpText: errorMessages.join('\n'),
        });
      } else if (errorMessages.length > 0) {
        setResult({
          type: 'error',
          title: `${actionLabel} Failed`,
          message: errorMessages.join('; '),
        });
      } else {
        setResult({
          type: 'success',
          title: `${actionLabel} Complete!`,
          message: `Successfully applied to ${successCount} user${successCount > 1 ? 's' : ''}.`,
        });
      }

      setSelectedUserIds(new Set());

      if (onRefresh) {
        await onRefresh();
      }

      setTimeout(() => setResult(null), 3000);
    } catch (error) {
      console.error('Error executing action:', error);
      setResult({
        type: 'error',
        title: 'Action Failed',
        message: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-3.5 h-3.5 text-[#f59e0b]" />;
      case 'queen_of_hog': return <span className="text-xs">🐗</span>;
      case 'admin': return <Shield className="w-3.5 h-3.5 text-[#3b82f6]" />;
      case 'member': return <Users className="w-3.5 h-3.5 text-[#10b981]" />;
      default: return <UserX className="w-3.5 h-3.5 text-[#6b7280]" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30';
      case 'queen_of_hog': return 'bg-[#ec4899]/10 text-[#ec4899] border-[#ec4899]/30';
      case 'admin': return 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30';
      case 'member': return 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30';
      default: return 'bg-[#6b7280]/10 text-[#6b7280] border-[#6b7280]/30';
    }
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const filteredUsers = users
    .filter(u => filterRole === 'all' || u.role === filterRole)
    .filter(u => !searchTerm || u.discord_username?.toLowerCase().includes(searchTerm.toLowerCase()));

  const toggleSelectAll = () => {
    if (selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const allSelected = filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length;
  const someSelected = selectedUserIds.size > 0;
  const selectedUsers = users.filter(u => selectedUserIds.has(u.id));
  const selectedNonGuests = selectedUsers.filter(u => u.role !== 'guest');

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 border-2 border-[#0f172a]/10 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#f97316] mx-auto mb-2" />
        <p className="text-sm text-[#0f172a]/70">Loading users...</p>
      </div>
    );
  }

  const getConfirmMessage = () => {
    if (!confirmAction) return '';
    const { type, userNames } = confirmAction;
    const config = type !== 'role_change' ? ACTION_CONFIG[type as ActionType] : null;
    const actionLabel = type === 'role_change' ? `change role to ${confirmAction.newRole}` : config?.label?.toLowerCase() || type;
    
    if (userNames.length === 1) {
      return `Are you sure you want to ${actionLabel} for ${userNames[0]}?`;
    }
    return `Are you sure you want to ${actionLabel} for ${userNames.length} users?\n\n${userNames.join(', ')}`;
  };

  const getConfirmVariant = (): 'danger' | 'primary' | 'success' => {
    if (!confirmAction || confirmAction.type === 'role_change') return 'primary';
    const config = ACTION_CONFIG[confirmAction.type as ActionType];
    if (config?.destructive) return 'danger';
    if (confirmAction.type === 'rank_up' || confirmAction.type === 'rank_to_max') return 'success';
    return 'primary';
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border-2 border-[#0f172a]/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-[#0f172a]/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#f97316]/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#f97316]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#0f172a]">User Management</h3>
              <p className="text-sm text-[#0f172a]/60">{users.length} total users</p>
            </div>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0f172a]/40" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border-2 border-[#0f172a]/10 bg-white text-sm text-[#0f172a] focus:outline-none focus:border-[#f97316]/40 transition-colors"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 rounded-lg border-2 border-[#0f172a]/10 bg-white text-sm text-[#0f172a] cursor-pointer hover:border-[#f97316]/30 transition-colors"
          >
            <option value="all">All Roles</option>
            <option value="owner">Owner</option>
            <option value="queen_of_hog">Queen Of Hog</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="guest">Guest</option>
          </select>
        </div>

        {/* Select All + Selection Count */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#0f172a]/5">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm text-[#0f172a]/70 hover:text-[#0f172a] transition-colors"
          >
            {allSelected ? (
              <SquareCheck className="w-4 h-4 text-[#f97316]" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span className="font-medium">
              {allSelected ? 'Deselect All' : 'Select All'}
            </span>
          </button>
          {someSelected && (
            <span className="text-xs font-semibold text-[#f97316] bg-[#f97316]/10 px-2.5 py-1 rounded-full">
              {selectedUserIds.size} selected
            </span>
          )}
        </div>
      </div>

      {/* Action Bar — shown when users are selected */}
      {someSelected && (
        <div className="bg-gradient-to-r from-[#0f172a] to-[#1e293b] px-4 sm:px-6 py-4 border-b border-[#0f172a]/10">
          <p className="text-xs text-white/60 font-medium mb-3">
            Actions for {selectedUserIds.size} selected user{selectedUserIds.size > 1 ? 's' : ''}:
          </p>
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {(Object.keys(ACTION_CONFIG) as ActionType[]).map((action) => {
              const config = ACTION_CONFIG[action];
              const Icon = config.icon;
              const disabled = actionLoading || 
                (action === 'link_kkup' && selectedUserIds.size !== 1) ||
                (action !== 'link_kkup' && action !== 'unlink_kkup' && selectedNonGuests.length === 0);

              return (
                <button
                  key={action}
                  type="button"
                  onClick={() => handleBatchAction(action)}
                  disabled={disabled}
                  title={config.description}
                  className={`${config.color} ${config.hoverColor} text-white rounded-lg px-2 py-2 sm:py-2.5 text-[10px] sm:text-xs font-semibold flex items-center justify-center gap-1 sm:gap-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:brightness-100`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">{config.label}</span>
                  <span className="sm:hidden">{config.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* User List */}
      <div className="divide-y divide-[#0f172a]/5 max-h-[500px] overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <p className="text-center text-[#0f172a]/60 py-8">No users found.</p>
        ) : (
          filteredUsers.map((user) => {
            const isSelected = selectedUserIds.has(user.id);
            return (
              <div
                key={user.id}
                className={`flex items-center gap-3 px-4 sm:px-6 py-3 transition-colors cursor-pointer ${
                  isSelected 
                    ? 'bg-[#f97316]/5' 
                    : 'hover:bg-[#fdf5e9]/50'
                }`}
                onClick={() => toggleSelectUser(user.id)}
              >
                {/* Checkbox */}
                <div className="flex-shrink-0">
                  {isSelected ? (
                    <SquareCheck className="w-5 h-5 text-[#f97316]" />
                  ) : (
                    <Square className="w-5 h-5 text-[#0f172a]/20" />
                  )}
                </div>

                {/* Avatar */}
                {user.discord_avatar ? (
                  <img
                    src={user.discord_avatar}
                    alt={user.discord_username}
                    className="w-9 h-9 rounded-full border-2 border-[#0f172a]/10 flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#f97316]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#f97316] font-bold text-sm">
                      {user.discord_username?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-[#0f172a] truncate">{user.discord_username}</p>
                    {(user.role === 'owner' || user.role === 'queen_of_hog' || user.role === 'admin') && (
                      <div className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold border flex items-center gap-0.5 ${getRoleBadgeColor(user.role)}`}>
                        {getRoleIcon(user.role)}
                        {user.role === 'owner' ? 'OWNER' : user.role === 'queen_of_hog' ? 'QOH' : 'ADMIN'}
                      </div>
                    )}
                    {user.kkup_player_profile_id && (
                      <div className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/30 flex items-center gap-0.5">
                        <Link className="w-2.5 h-2.5" />
                        KKUP
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#0f172a]/50">
                    <span>{user.ranks?.name || 'No Rank'}</span>
                    <span>-</span>
                    <span>P{user.prestige_level || 0}</span>
                  </div>
                </div>

                {/* Role Dropdown */}
                <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {user.role === 'owner' ? (
                    <div className="text-[10px] text-[#0f172a]/30 italic">Protected</div>
                  ) : updatingUserId === user.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#f97316]" />
                  ) : (
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="px-2 py-1 rounded-lg border border-[#0f172a]/10 bg-white text-xs text-[#0f172a] cursor-pointer hover:border-[#f97316]/30 transition-colors"
                      disabled={updatingUserId !== null}
                    >
                      <option value="guest">Guest</option>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="queen_of_hog">Queen Of Hog</option>
                      <option value="owner">Owner</option>
                    </select>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Loading overlay */}
      {actionLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 shadow-xl flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#f97316]" />
            <p className="text-sm font-semibold text-[#0f172a]">Applying action...</p>
          </div>
        </div>
      )}

      {/* Link KKUP Profile Modal */}
      {linkingUser && (
        <LinkKKupProfileModal
          user={linkingUser}
          onClose={() => setLinkingUser(null)}
          onLinked={() => {
            fetchUsers();
            setSelectedUserIds(new Set());
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <ConfirmModal
          title={
            confirmAction.type === 'role_change'
              ? 'Confirm Role Change'
              : `Confirm ${ACTION_CONFIG[confirmAction.type as ActionType]?.label || confirmAction.type}`
          }
          message={getConfirmMessage()}
          confirmText={confirmAction.userIds.length > 1 ? `Apply to ${confirmAction.userIds.length} Users` : 'Confirm'}
          confirmVariant={getConfirmVariant()}
          onConfirm={executeAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Success/Error Modal */}
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