/**
 * Add Existing Team Modal — register a team you captain for a tournament.
 *
 * Flow:
 *  1. Fetches user's master teams from GET /master-teams/mine
 *  2. User selects a team from the dropdown -> fields pre-populate (read-only identity)
 *  3. On submit: creates kkup_teams entry linked to master_team_id
 *
 * Creator role (playing/coaching) is determined by the user's registration role
 * and passed in as a prop — no in-modal role selection needed.
 */
import { useState, useEffect, useMemo } from 'react';
import { Shield, Loader2, ChevronDown, Check, Info, Trophy } from '@/lib/icons';
import { Button } from '@/app/components/ui/button';
import { TeamLogo } from '@/app/components/team-logo';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';

interface MasterTeam {
  id: string;
  current_name: string;
  current_tag: string;
  current_logo_url: string | null;
  description: string | null;
  valve_team_id: number | null;
  tournament_count: number;
}

type CreatorRole = 'playing_captain' | 'coaching_captain' | 'captain_only';

interface AddExistingTeamModalProps {
  tournamentId: string;
  tournamentName: string;
  accessToken: string;
  isOwner: boolean;
  creatorRole: CreatorRole;
  onClose: () => void;
  onCreated: () => void;
  setResultModal: (modal: { type: 'success' | 'error' | 'info'; title: string; message: string; helpText?: string }) => void;
}

export function AddExistingTeamModal({
  tournamentId, tournamentName, accessToken, isOwner, creatorRole,
  onClose, onCreated, setResultModal,
}: AddExistingTeamModalProps) {
  const [masterTeams, setMasterTeams] = useState<MasterTeam[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;

  const selectedTeam = useMemo(() => masterTeams.find(t => t.id === selectedTeamId), [masterTeams, selectedTeamId]);

  // Fetch user's master teams on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setLoadingTeams(false);
          return;
        }

        const res = await fetch(`${apiBase}/master-teams/mine`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          const err = await res.json();
          console.error('Failed to fetch master teams:', err);
          setMasterTeams([]);
          return;
        }
        const data = await res.json();
        setMasterTeams(data.master_teams || []);
      } catch (err) {
        console.error('Error fetching master teams:', err);
        setMasterTeams([]);
      } finally {
        setLoadingTeams(false);
      }
    })();
  }, []);

  const handleSelectTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    setDropdownOpen(false);
  };

  // Create tournament team linked to master team
  const handleSubmit = async () => {
    if (!selectedTeam) return;
    setCreating(true);
    try {
      const createRes = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          team_name: selectedTeam.current_name,
          team_tag: selectedTeam.current_tag,
          valve_team_id: selectedTeam.valve_team_id || undefined,
          logo_url: selectedTeam.current_logo_url || undefined,
          master_team_id: selectedTeam.id,
          creator_role: creatorRole,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Failed to register team');

      setResultModal({
        type: 'success',
        title: 'Team Registered!',
        message: createData.message || `Team "${selectedTeam.current_name}" has been registered for ${tournamentName}.`,
        helpText: 'Your team has been auto-approved since it\'s already in your team roster. You can start inviting players right away!',
      });

      onCreated();
    } catch (err: any) {
      console.error('Add existing team error:', err);
      setResultModal({ type: 'error', title: 'Registration Failed', message: err.message });
    } finally {
      setCreating(false);
    }
  };

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-2xl">
      <BottomSheetModal.Header
        gradient="from-harvest/10 to-harvest/5"
        borderColor="border-harvest/20"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-harvest/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-harvest" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Add Existing Team</h3>
            <p className="text-sm text-muted-foreground">Register one of your teams for {tournamentName}</p>
          </div>
        </div>
      </BottomSheetModal.Header>

      <BottomSheetModal.Body className="space-y-5 min-h-[40vh]">
        {/* Team Dropdown */}
        <div>
          <p className="text-sm font-bold text-foreground mb-1">Select a Team</p>
          <p className="text-xs text-muted-foreground mb-3">Choose from teams you captain</p>

          {loadingTeams ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 bg-muted rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading your teams...
            </div>
          ) : masterTeams.length === 0 ? (
            <div className="p-5 bg-muted rounded-xl border-2 border-dashed border-border text-center">
              <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground mb-1">No teams found</p>
              <p className="text-xs text-muted-foreground">
                Create a team from your profile page first, then come back to register it here.
              </p>
            </div>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between h-14 px-4 rounded-xl border-2 border-border hover:border-harvest/40 bg-input-background transition-all text-left"
              >
                {selectedTeam ? (
                  <div className="flex items-center gap-3">
                    <TeamLogo logoUrl={selectedTeam.current_logo_url} teamName={selectedTeam.current_name} size="sm" />
                    <div>
                      <span className="font-semibold text-foreground">{selectedTeam.current_name}</span>
                      <span className="text-xs text-muted-foreground ml-2 font-mono">[{selectedTeam.current_tag}]</span>
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Choose a team...</span>
                )}
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover rounded-xl border-2 border-border shadow-xl z-20 max-h-64 overflow-y-auto">
                  {masterTeams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => handleSelectTeam(team.id)}
                      className={`w-full flex items-center gap-3 p-3 hover:bg-harvest/5 transition-colors text-left ${
                        team.id === selectedTeamId ? 'bg-harvest/10' : ''
                      }`}
                    >
                      <TeamLogo logoUrl={team.current_logo_url} teamName={team.current_name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground truncate">{team.current_name}</span>
                          <span className="text-xs text-muted-foreground font-mono">[{team.current_tag}]</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {team.tournament_count > 0 ? (
                            <span className="flex items-center gap-1">
                              <Trophy className="w-3 h-3 text-harvest" />
                              {team.tournament_count} tournament{team.tournament_count !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span>New team</span>
                          )}
                        </div>
                      </div>
                      {team.id === selectedTeamId && <Check className="w-4 h-4 text-harvest flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected team details */}
        {selectedTeam && (
          <div className="border-t-2 border-border pt-5 space-y-4">
            <div className="bg-[#3b82f6]/5 rounded-xl p-3 border border-[#3b82f6]/20">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-[#3b82f6] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Team identity is shared.</span> The team name, tag, and logo come from your team profile. To make changes, edit the team from your profile page.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-2xl border border-border">
              <TeamLogo logoUrl={selectedTeam.current_logo_url} teamName={selectedTeam.current_name} size="md" />
              <div>
                <h4 className="text-lg font-bold text-foreground">{selectedTeam.current_name}</h4>
                <p className="text-sm text-muted-foreground font-mono">[{selectedTeam.current_tag}]</p>
                {selectedTeam.description && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedTeam.description}</p>
                )}
              </div>
            </div>

            {/* Auto-approved notice — existing teams skip approval */}
            <div className="bg-[#10b981]/5 rounded-xl p-4 border border-[#10b981]/20">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-[#10b981] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  Existing teams are <strong className="text-[#10b981]">auto-approved</strong> — you can start inviting players immediately.
                </p>
              </div>
            </div>
          </div>
        )}
      </BottomSheetModal.Body>

      <BottomSheetModal.Footer>
        <div className="flex gap-3">
          <Button onClick={onClose} className="flex-1 bg-muted hover:bg-muted/80 text-foreground h-12 rounded-xl font-semibold">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={creating || !selectedTeam}
            className="flex-1 bg-harvest hover:bg-harvest/90 text-white h-12 rounded-xl font-bold disabled:opacity-50"
          >
            {creating ? (
              <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Registering...</>
            ) : (
              <><Shield className="w-5 h-5 mr-2" /> Register Team</>
            )}
          </Button>
        </div>
      </BottomSheetModal.Footer>
    </BottomSheetModal>
  );
}
