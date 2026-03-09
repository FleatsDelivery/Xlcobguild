/**
 * Tournament Hub — Create Team Modal
 *
 * Allows a user to create a new team. Includes:
 *   - Free plan 3-team limit (fetches master team count on mount)
 *   - Limit-reached state with upgrade/delete messaging
 *   - Team name, tag, logo, Dota Team ID fields
 *   - Auto-creates a master team in My KKUP Teams
 *   - Creator role (playing/coaching) determined by registration, passed as prop
 */
import { useState, useEffect } from 'react';
import {
  Shield, Plus, Loader2, AlertCircle,
  Lock, Sparkles,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { ImageUpload } from '@/app/components/image-upload';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';

const FREE_TEAM_LIMIT = 3;

type CreatorRole = 'playing_captain' | 'coaching_captain' | 'captain_only';

interface CreateTeamModalProps {
  tournamentId: string;
  tournamentName: string;
  tournamentType: string; // 'kernel_kup' | 'heaps_n_hooks'
  accessToken: string;
  user: any;
  isOwner: boolean;
  creatorRole: CreatorRole;
  onClose: () => void;
  onCreated: () => void;
  setResultModal: (modal: { type: 'success' | 'error' | 'info'; title: string; message: string; helpText?: string }) => void;
}

export function TournamentHubCreateTeamModal({
  tournamentId, tournamentName, tournamentType, accessToken, user, isOwner,
  creatorRole,
  onClose, onCreated, setResultModal,
}: CreateTeamModalProps) {
  const [newTeam, setNewTeam] = useState({ team_name: '', team_tag: '', valve_team_id: '', logo_url: '' });
  const [creating, setCreating] = useState(false);

  // Master team count for free plan limit
  const [masterTeamCount, setMasterTeamCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(true);

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;
  const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` };

  // Fetch master team count on mount
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setLoadingCount(false); return; }

        const res = await fetch(
          `${apiBase}/master-teams/mine`,
          { headers: { 'Authorization': `Bearer ${session.access_token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setMasterTeamCount((data.master_teams || []).length);
        } else {
          // If fetch fails (e.g. no Steam link), assume 0 so the form still works
          // The server-side will enforce the real limit anyway
          setMasterTeamCount(0);
        }
      } catch (err) {
        console.error('Error fetching master team count:', err);
        setMasterTeamCount(0);
      } finally {
        setLoadingCount(false);
      }
    };
    fetchCount();
  }, []);

  const atLimit = masterTeamCount !== null && masterTeamCount >= FREE_TEAM_LIMIT && !isOwner;
  const slotsRemaining = masterTeamCount !== null ? FREE_TEAM_LIMIT - masterTeamCount : null;

  const handleCreate = async () => {
    if (!newTeam.team_name.trim() || !creatorRole) return;
    setCreating(true);
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({
          team_name: newTeam.team_name.trim(),
          team_tag: newTeam.team_tag.trim() || undefined,
          valve_team_id: newTeam.valve_team_id.trim() || undefined,
          logo_url: newTeam.logo_url || undefined,
          creator_role: creatorRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create team');

      const ROLE_LABELS: Record<CreatorRole, string> = {
        playing_captain: 'playing captain',
        coaching_captain: 'coaching captain',
        captain_only: 'team organizer',
      };
      const roleLabel = ROLE_LABELS[creatorRole];
      setResultModal({
        type: 'success', title: 'Team Created!',
        message: data.message || `Team "${newTeam.team_name}" has been created.`,
        helpText: `Your team is pending approval. Once approved, you'll be the ${roleLabel} and can invite players. This team has also been added to your My KKUP Teams on your profile.`,
      });
      onCreated();
    } catch (err: any) {
      setResultModal({ type: 'error', title: 'Team Creation Failed', message: err.message });
    } finally {
      setCreating(false);
    }
  };

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-2xl">
      <BottomSheetModal.Header
        gradient="from-[#8b5cf6]/10 to-[#8b5cf6]/5"
        borderColor="border-[#8b5cf6]/20"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#8b5cf6]/20 flex items-center justify-center">
            {atLimit ? <Lock className="w-6 h-6 text-[#8b5cf6]" /> : <Shield className="w-6 h-6 text-[#8b5cf6]" />}
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">
              {atLimit ? 'Team Limit Reached' : 'Create New Team'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {loadingCount
                ? 'Checking team slots...'
                : atLimit
                  ? `${FREE_TEAM_LIMIT}/${FREE_TEAM_LIMIT} team slots used (free plan)`
                  : slotsRemaining !== null
                    ? `${slotsRemaining} of ${FREE_TEAM_LIMIT} team slot${slotsRemaining !== 1 ? 's' : ''} remaining — for ${tournamentName}`
                    : `Build your squad for ${tournamentName}`
              }
            </p>
          </div>
        </div>
      </BottomSheetModal.Header>

      {/* Loading state */}
      {loadingCount && (
        <BottomSheetModal.Body>
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#8b5cf6]" />
          </div>
        </BottomSheetModal.Body>
      )}

      {/* Limit reached state */}
      {!loadingCount && atLimit && (
        <>
          <BottomSheetModal.Body className="space-y-5">
            <div className="text-center py-4">
              <div className="w-20 h-20 rounded-full bg-[#f59e0b]/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-10 h-10 text-[#f59e0b]" />
              </div>
              <h4 className="text-lg font-bold text-foreground mb-2">
                You've reached the free plan limit
              </h4>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Free members can create up to {FREE_TEAM_LIMIT} teams. You currently have {masterTeamCount} team{masterTeamCount !== 1 ? 's' : ''}.
              </p>
            </div>

            <div className="bg-muted rounded-2xl p-5 space-y-3">
              <p className="text-sm font-bold text-foreground">Here's what you can do:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-[#8b5cf6]">1</span>
                  </span>
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Delete an existing team</strong> from your profile's My KKUP Teams section to free up a slot.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-[#8b5cf6]">2</span>
                  </span>
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Use an existing team</strong> — go back and tap "Add Existing Team" to register one of your current teams for this tournament.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-harvest/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-harvest">3</span>
                  </span>
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Upgrade your membership</strong> to remove all limitations on team creation.
                  </p>
                </div>
              </div>
            </div>

            {/* Upgrade teaser */}
            <div className="bg-gradient-to-br from-harvest/5 to-kernel-gold/5 rounded-2xl p-5 border border-harvest/20">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-harvest/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-harvest" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">TCF Membership</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Unlimited teams, priority registration, exclusive cosmetics, and more. Coming soon!
                  </p>
                </div>
              </div>
            </div>
          </BottomSheetModal.Body>

          <BottomSheetModal.Footer>
            <div className="flex gap-3">
              <Button
                onClick={onClose}
                className="flex-1 bg-muted hover:bg-muted/80 text-foreground h-12 rounded-xl font-semibold"
              >
                Close
              </Button>
              <Button
                onClick={() => { onClose(); window.location.hash = '#profile'; }}
                className="flex-1 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white h-12 rounded-xl font-bold"
              >
                Manage My Teams
              </Button>
            </div>
          </BottomSheetModal.Footer>
        </>
      )}

      {/* Normal create form */}
      {!loadingCount && !atLimit && (
        <>
          <BottomSheetModal.Body className="space-y-5">
            {/* Team Details */}
            <div>
              <Label className="text-sm font-bold text-foreground">Team Name *</Label>
              <Input
                value={newTeam.team_name}
                onChange={(e) => setNewTeam(prev => ({ ...prev, team_name: e.target.value }))}
                placeholder="e.g. Corn Dawgs"
                className="mt-1 h-12 rounded-xl border-2 border-border focus:border-[#8b5cf6] bg-input-background text-foreground"
              />
            </div>

            <div>
              <Label className="text-sm font-bold text-foreground">Team Tag</Label>
              <p className="text-xs text-muted-foreground mb-1">Short abbreviation (3-5 characters)</p>
              <Input
                value={newTeam.team_tag}
                onChange={(e) => setNewTeam(prev => ({ ...prev, team_tag: e.target.value.toUpperCase().slice(0, 5) }))}
                placeholder="e.g. CDGS"
                maxLength={5}
                className="mt-1 h-12 rounded-xl border-2 border-border focus:border-[#8b5cf6] font-mono uppercase bg-input-background text-foreground"
              />
            </div>

            <div>
              <Label className="text-sm font-bold text-foreground">Dota Team ID</Label>
              <p className="text-xs text-muted-foreground mb-1">Optional -- from your in-game Dota 2 team</p>
              <Input
                value={newTeam.valve_team_id}
                onChange={(e) => setNewTeam(prev => ({ ...prev, valve_team_id: e.target.value }))}
                placeholder="e.g. 9255031"
                className="mt-1 h-12 rounded-xl border-2 border-border focus:border-[#8b5cf6] font-mono bg-input-background text-foreground"
              />
            </div>

            <div>
              <ImageUpload
                currentUrl={newTeam.logo_url || null}
                onUploadComplete={(url) => setNewTeam(prev => ({ ...prev, logo_url: url }))}
                label="Team Logo"
                folder="team_logos"
                filename={newTeam.team_tag.trim() ? newTeam.team_tag.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : undefined}
              />
              {!newTeam.team_tag.trim() && (
                <p className="text-[10px] text-muted-foreground mt-1">Tip: enter your team tag first — logos are named after your tag for easy lookup.</p>
              )}
            </div>

            {/* Pending approval notice */}
            <div className="bg-[#f59e0b]/5 rounded-xl p-4 border border-[#f59e0b]/20">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-[#f59e0b] flex-shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p>Your team will need approval before you can start inviting players.</p>
                  <p className="mt-1 text-xs">This team will also appear in your <strong>My KKUP Teams</strong> on your profile.</p>
                </div>
              </div>
            </div>
          </BottomSheetModal.Body>

          <BottomSheetModal.Footer>
            <div className="flex gap-3">
              <Button
                onClick={onClose}
                className="flex-1 bg-muted hover:bg-muted/80 text-foreground h-12 rounded-xl font-semibold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !newTeam.team_name.trim() || !creatorRole}
                className="flex-1 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white h-12 rounded-xl font-bold disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
                Create Team
              </Button>
            </div>
          </BottomSheetModal.Footer>
        </>
      )}
    </BottomSheetModal>
  );
}