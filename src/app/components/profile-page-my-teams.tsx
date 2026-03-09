/**
 * Profile Page — My KKUP Teams Section
 *
 * Displays the user's master teams (teams they captain).
 * Supports create, edit, delete actions.
 * Free: 1 team. TCF+: 20 teams.
 */
import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Pencil, Trophy, Loader2, Shield, AlertCircle, Crown, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { TeamLogo } from '@/app/components/team-logo';
import { CreateMasterTeamModal } from '@/app/components/create-master-team-modal';
import { EditMasterTeamModal } from '@/app/components/edit-master-team-modal';

const FREE_TEAM_LIMIT = 1;
const TCF_PLUS_TEAM_LIMIT = 20;

interface MasterTeam {
  id: string;
  current_name: string;
  current_tag: string;
  current_logo_url: string | null;
  description: string | null;
  valve_team_id: number | null;
  tournament_count: number;
  name_history?: any[];
  created_at: string;
}

interface ProfilePageMyTeamsProps {
  user: any;
}

export function ProfilePageMyTeams({ user }: ProfilePageMyTeamsProps) {
  const [teams, setTeams] = useState<MasterTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<MasterTeam | null>(null);

  const fetchMyTeams = useCallback(async () => {
    try {
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not signed in');
        setLoading(false);
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/master-teams/mine`,
        {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        // If no Steam link, show a specific message instead of an error
        if (response.status === 400 && data.error?.includes('Steam')) {
          setError('steam_not_linked');
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Failed to fetch teams');
      }

      const data = await response.json();
      setTeams(data.master_teams || []);
    } catch (err: any) {
      console.error('Error fetching my teams:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyTeams();
  }, [fetchMyTeams]);

  const handleRefresh = () => {
    setLoading(true);
    fetchMyTeams();
  };

  const isTcfPlus = !!user?.tcf_plus_active;
  const teamLimit = isTcfPlus ? TCF_PLUS_TEAM_LIMIT : FREE_TEAM_LIMIT;
  const canCreateMore = teams.length < teamLimit;

  // ── Loading state ──
  if (loading) {
    return (
      <div className="bg-card rounded-3xl p-6 sm:p-8 shadow-sm border-2 border-border mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-harvest/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-harvest" />
          </div>
          <h2 className="text-xl font-bold text-foreground">My KKUP Teams</h2>
        </div>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-harvest" />
        </div>
      </div>
    );
  }

  // ── Steam not linked state ──
  if (error === 'steam_not_linked') {
    return (
      <div className="bg-card rounded-3xl p-6 sm:p-8 shadow-sm border-2 border-border mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-harvest/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-harvest" />
          </div>
          <h2 className="text-xl font-bold text-foreground">My KKUP Teams</h2>
        </div>
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground mb-1">Connect your Steam account to manage teams</p>
          <p className="text-xs text-muted-foreground">Link your Steam / OpenDota profile above to get started</p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="bg-card rounded-3xl p-6 sm:p-8 shadow-sm border-2 border-border mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-harvest/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-harvest" />
          </div>
          <h2 className="text-xl font-bold text-foreground">My KKUP Teams</h2>
        </div>
        <div className="flex items-center gap-2 p-3 bg-[#ef4444]/10 rounded-xl border border-[#ef4444]/20">
          <AlertCircle className="w-4 h-4 text-[#ef4444] flex-shrink-0" />
          <p className="text-xs text-[#ef4444]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-3xl p-6 sm:p-8 shadow-sm border-2 border-border mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-harvest/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-harvest" />
          </div>
          <h2 className="text-xl font-bold text-foreground">My KKUP Teams</h2>
        </div>
        {canCreateMore && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-harvest bg-harvest/10 hover:bg-harvest/20 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Team
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-5 ml-[52px]">
        {teams.length}/{teamLimit} teams ({isTcfPlus ? 'TCF+' : 'free'} plan)
      </p>

      {/* Empty state */}
      {teams.length === 0 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Shield className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">No teams yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Create a team to register for Kernel Kup tournaments
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-harvest hover:bg-harvest/90 px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Your First Team
          </button>
        </div>
      )}

      {/* Team Cards */}
      {teams.length > 0 && (
        <div className="space-y-3">
          {teams.map((team) => (
            <div
              key={team.id}
              className="flex items-center gap-4 p-4 bg-muted/50 hover:bg-muted rounded-2xl border border-border hover:border-harvest/30 transition-all group cursor-pointer"
              onClick={() => setEditingTeam(team)}
            >
              <TeamLogo
                logoUrl={team.current_logo_url}
                teamName={team.current_name}
                size="sm"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground truncate">{team.current_name}</h3>
                  <span className="text-xs font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                    {team.current_tag}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {team.tournament_count > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-harvest">
                      <Trophy className="w-3 h-3" />
                      {team.tournament_count} tournament{team.tournament_count !== 1 ? 's' : ''}
                    </span>
                  )}
                  {team.description && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      {team.description}
                    </span>
                  )}
                  {team.tournament_count === 0 && !team.description && (
                    <span className="text-[10px] text-muted-foreground">
                      Ready for tournament registration
                    </span>
                  )}
                </div>
              </div>

              <Pencil className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Team limit reached banner */}
      {!canCreateMore && teams.length > 0 && (
        isTcfPlus ? (
          <div className="mt-4 p-3 bg-harvest/10 rounded-xl border border-harvest/20 text-center">
            <p className="text-xs font-semibold text-foreground flex items-center justify-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-harvest" />
              TCF+ limit reached ({TCF_PLUS_TEAM_LIMIT}/{TCF_PLUS_TEAM_LIMIT})
            </p>
          </div>
        ) : (
          <div className="mt-4 p-3 bg-[#f59e0b]/10 rounded-xl border border-[#f59e0b]/20 text-center">
            <p className="text-xs font-semibold text-foreground">Free plan limit reached ({FREE_TEAM_LIMIT}/{FREE_TEAM_LIMIT})</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3 text-harvest" />
              Upgrade to TCF+ for up to {TCF_PLUS_TEAM_LIMIT} teams
            </p>
          </div>
        )
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateMasterTeamModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleRefresh}
          currentTeamCount={teams.length}
          teamLimit={teamLimit}
        />
      )}

      {editingTeam && (
        <EditMasterTeamModal
          team={editingTeam}
          onClose={() => setEditingTeam(null)}
          onSaved={handleRefresh}
        />
      )}
    </div>
  );
}