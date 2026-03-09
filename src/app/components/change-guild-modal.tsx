import { useState, useEffect } from 'react';
import { X, Loader2, RefreshCw, Shield, ArrowRight, AlertTriangle } from '@/lib/icons';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { toast } from 'sonner';
import { isGuest } from '@/lib/roles';

interface Guild {
  id: string;
  name: string;
  tag: string;
  color: string;
  logo_url: string | null;
  is_default: boolean;
  member_count: number;
}

interface ChangeGuildModalProps {
  open: boolean;
  onClose: () => void;
  user: any;
  onRefresh?: () => void;
}

export function ChangeGuildModal({ open, onClose, user, onRefresh }: ChangeGuildModalProps) {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState<string | null>(null);

  const userRole = user?.role || 'guest';
  const currentGuildId = user?.guild_id;
  const currentGuild = user?.guild;

  // Determine if this is a real switch (has a non-Unaffiliated guild)
  const isRealSwitch = currentGuild && currentGuild.name !== 'Unaffiliated' && !isGuest(userRole);

  useEffect(() => {
    if (open) {
      setSelectedGuild(null);
      fetchGuilds();
    }
  }, [open]);

  // Close on escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  const fetchGuilds = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/guilds`
      );
      if (res.ok) {
        const data = await res.json();
        // Filter out Unaffiliated — not a real choice
        setGuilds((data.guilds || []).filter((g: Guild) => g.name !== 'Unaffiliated'));
      }
    } catch (e) {
      console.error('Error fetching guilds:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedGuild) return;
    setSwitching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/guilds/${selectedGuild}/join`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        const guildName = data.guild?.name || 'your new guild';
        toast.success(
          data.was_switch
            ? `Switched to ${guildName}! Rank and prestige have been reset.`
            : `Welcome to ${guildName}!`
        );
        onClose();
        if (onRefresh) setTimeout(() => onRefresh(), 500);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to change guild');
      }
    } catch (e) {
      console.error('Error changing guild:', e);
      toast.error('Failed to change guild');
    } finally {
      setSwitching(false);
    }
  };

  if (!open) return null;

  const selectedGuildData = guilds.find(g => g.id === selectedGuild);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-card rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md border-2 border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-harvest/15 to-amber/10 px-5 py-4 border-b border-harvest/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-harvest flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {isGuest(userRole) ? 'Join a Guild' : 'Change Guild'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isGuest(userRole)
                    ? 'Choose your guild affiliation'
                    : 'Switch to a different guild'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Current guild indicator */}
        {currentGuild && !isGuest(userRole) && currentGuild.name !== 'Unaffiliated' && (
          <div className="px-5 pt-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Current Guild</p>
            <div
              className="flex items-center gap-3 p-3 rounded-xl border-2 opacity-70"
              style={{
                borderColor: currentGuild.color + '40',
                backgroundColor: currentGuild.color + '08',
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: currentGuild.color }}
              >
                {currentGuild.tag || currentGuild.name.slice(0, 3).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{currentGuild.name}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{
                  color: currentGuild.color,
                  backgroundColor: currentGuild.color + '15',
                }}
              >
                Active
              </span>
            </div>
          </div>
        )}

        {/* Guild options */}
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {isGuest(userRole) ? 'Available Guilds' : 'Switch To'}
          </p>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-5 h-5 animate-spin text-harvest" />
              <span className="text-sm text-muted-foreground">Loading guilds...</span>
            </div>
          ) : guilds.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No guilds available</p>
            </div>
          ) : (
            <div className="space-y-2">
              {guilds.map((guild) => {
                const isCurrent = guild.id === currentGuildId;
                const isSelected = selectedGuild === guild.id;
                if (isCurrent) return null;

                return (
                  <button
                    key={guild.id}
                    onClick={() => setSelectedGuild(isSelected ? null : guild.id)}
                    disabled={switching}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'shadow-md scale-[1.02]'
                        : 'border-border hover:border-border/80 hover:shadow-sm'
                    } disabled:opacity-60`}
                    style={isSelected ? {
                      borderColor: guild.color,
                      backgroundColor: guild.color + '0A',
                    } : {}}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 transition-all ${
                        isSelected ? 'scale-110' : ''
                      }`}
                      style={{ backgroundColor: guild.color }}
                    >
                      {guild.tag || guild.name.slice(0, 3).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{guild.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {guild.member_count} {guild.member_count === 1 ? 'member' : 'members'}
                        {isSelected ? ' · Selected' : ''}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: guild.color }}
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Switch warning */}
        {isRealSwitch && selectedGuild && (
          <div className="px-5 pb-2">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/20">
              <AlertTriangle className="w-4 h-4 text-[#f59e0b] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#f59e0b]">
                Switching guilds will <strong>reset your rank to Earwig</strong> and <strong>prestige to 0</strong>. Your historical MVPs stay attributed to {currentGuild?.name}.
              </p>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-muted-foreground bg-muted rounded-xl hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedGuild || switching}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-harvest rounded-xl hover:bg-amber transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {switching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Switching...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                {isGuest(userRole) ? 'Join Guild' : 'Confirm Switch'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
