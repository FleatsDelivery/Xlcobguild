/**
 * Officer Team Manager — Master team registry CRUD for the Officer Panel
 *
 * Lists all kkup_master_teams with search, edit, delete, and captaincy transfer.
 * Officers can manage any team regardless of captain status.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Search, Pencil, Trash2, Trophy, Users, Crown,
  AlertCircle, ArrowRightLeft, ChevronDown, Check, Plus, Shield,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { TeamLogo } from '@/app/components/team-logo';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { ImageUpload } from '@/app/components/image-upload';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { slugifyTournamentName } from '@/lib/slugify';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface MasterTeam {
  id: string;
  current_name: string;
  current_tag: string;
  current_logo_url: string | null;
  description: string | null;
  valve_team_id: number | null;
  current_captain_person_id: string | null;
  tournament_count: number;
  name_history?: any[];
  created_at: string;
}

interface TeamDetail {
  master_team: MasterTeam;
  captain: { id: string; display_name: string; steam_id: string; avatar_url: string | null } | null;
  appearances: any[];
  tournament_count: number;
  championships: number;
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function OfficerTeamManager() {
  const [teams, setTeams] = useState<MasterTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [editingTeam, setEditingTeam] = useState<MasterTeam | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<MasterTeam | null>(null);
  const [transferringTeam, setTransferringTeam] = useState<MasterTeam | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;

  const getAccessToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  // ── Fetch all master teams ──
  const fetchTeams = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch(`${apiBase}/master-teams`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error('Failed to fetch master teams');
        return;
      }
      const data = await res.json();
      setTeams(data.master_teams || []);
    } catch (err) {
      console.error('Error fetching master teams:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const handleRefresh = () => {
    setLoading(true);
    fetchTeams();
  };

  // ── Filtered teams ──
  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return teams;
    const q = searchQuery.toLowerCase();
    return teams.filter(
      t => t.current_name.toLowerCase().includes(q) || t.current_tag.toLowerCase().includes(q)
    );
  }, [teams, searchQuery]);

  // ── Delete handler ──
  const handleDelete = async (team: MasterTeam) => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch(`${apiBase}/master-teams/${team.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete team');

      toast.success(`Team "${team.current_name}" deleted.`);
      setDeletingTeam(null);
      handleRefresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-harvest" />
      </div>
    );
  }

  return (
    <div>
      {/* Search + Create */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search teams..."
            className="w-full pl-9 pr-4 py-2.5 bg-input-background border-2 border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-harvest"
          />
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-harvest hover:bg-harvest/90 text-white rounded-xl text-sm font-bold transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
        <span className="font-semibold">{teams.length} total teams</span>
        {searchQuery && (
          <span>{filteredTeams.length} match{filteredTeams.length !== 1 ? 'es' : ''}</span>
        )}
      </div>

      {/* Team List */}
      {filteredTeams.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-semibold">{searchQuery ? 'No teams match your search' : 'No teams registered yet'}</p>
        </div>
      ) : (
        <div className="max-h-[520px] overflow-y-auto scrollbar-visible space-y-2 pr-1">
          {filteredTeams.map((team) => (
            <div
              key={team.id}
              className="flex items-center gap-3 p-3 bg-card hover:bg-muted/50 rounded-xl border border-border hover:border-harvest/30 transition-all group"
            >
              <TeamLogo logoUrl={team.current_logo_url} teamName={team.current_name} size="sm" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground truncate">{team.current_name}</span>
                  <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">
                    {team.current_tag}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {team.tournament_count > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-harvest">
                      <Trophy className="w-3 h-3" />
                      {team.tournament_count}
                    </span>
                  )}
                  {team.valve_team_id && (
                    <span className="text-[10px] text-muted-foreground">
                      Valve #{team.valve_team_id}
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setTransferringTeam(team)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#f59e0b]/10 text-muted-foreground hover:text-[#f59e0b] transition-colors"
                  title="Transfer captaincy"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setEditingTeam(team)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-harvest/10 text-muted-foreground hover:text-harvest transition-colors"
                  title="Edit team"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {team.tournament_count === 0 && (
                  <button
                    onClick={() => setDeletingTeam(team)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#ef4444]/10 text-muted-foreground hover:text-[#ef4444] transition-colors"
                    title="Delete team"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editingTeam && (
        <OfficerEditTeamModal
          team={editingTeam}
          onClose={() => setEditingTeam(null)}
          onSaved={() => { setEditingTeam(null); handleRefresh(); }}
        />
      )}

      {/* ── Create Modal ── */}
      {showCreateModal && (
        <OfficerCreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); handleRefresh(); }}
        />
      )}

      {/* ── Transfer Captaincy Modal ── */}
      {transferringTeam && (
        <TransferCaptainModal
          team={transferringTeam}
          onClose={() => setTransferringTeam(null)}
          onTransferred={() => { setTransferringTeam(null); handleRefresh(); }}
        />
      )}

      {/* ── Delete Confirm ── */}
      {deletingTeam && (
        <ConfirmModal
          title="Delete Team"
          message={`Permanently delete "${deletingTeam.current_name}" [${deletingTeam.current_tag}]? This cannot be undone.`}
          confirmText="Delete Team"
          confirmVariant="danger"
          onConfirm={() => handleDelete(deletingTeam)}
          onCancel={() => setDeletingTeam(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// OFFICER EDIT TEAM MODAL
// ═══════════════════════════════════════════════════════

function OfficerEditTeamModal({
  team, onClose, onSaved,
}: { team: MasterTeam; onClose: () => void; onSaved: () => void }) {
  const [formData, setFormData] = useState({
    name: team.current_name,
    tag: team.current_tag,
    description: team.description || '',
    logo_url: team.current_logo_url || '',
    valve_team_id: team.valve_team_id?.toString() || '',
  });
  const [saving, setSaving] = useState(false);

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.tag.trim()) {
      toast.error('Team name and tag are required');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');

      const res = await fetch(`${apiBase}/master-teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          tag: formData.tag.trim(),
          description: formData.description.trim() || null,
          logo_url: formData.logo_url.trim() || null,
          valve_team_id: formData.valve_team_id ? parseInt(formData.valve_team_id) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');

      toast.success(`Team "${formData.name.trim()}" updated.`);
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-2xl">
      <BottomSheetModal.Header gradient="from-harvest/10 to-harvest/5" borderColor="border-harvest/20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-harvest/20 flex items-center justify-center">
            <Pencil className="w-6 h-6 text-harvest" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Edit Team (Officer)</h3>
            <p className="text-sm text-muted-foreground">
              {team.tournament_count > 0
                ? `${team.tournament_count} tournament${team.tournament_count !== 1 ? 's' : ''} played`
                : 'No tournament history'}
            </p>
          </div>
        </div>
      </BottomSheetModal.Header>

      <BottomSheetModal.Body className="space-y-5">
        <div>
          <Label className="text-sm font-bold text-foreground">Team Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Corn Dawgs"
            className="mt-1 h-12 rounded-xl border-2 border-border focus:border-harvest bg-input-background text-foreground"
          />
        </div>
        <div>
          <Label className="text-sm font-bold text-foreground">Team Tag *</Label>
          <Input
            value={formData.tag}
            onChange={(e) => setFormData({ ...formData, tag: e.target.value.toUpperCase().slice(0, 10) })}
            placeholder="e.g. CDGS"
            maxLength={10}
            className="mt-1 h-12 rounded-xl border-2 border-border focus:border-harvest font-mono uppercase bg-input-background text-foreground"
          />
        </div>
        <div>
          <Label className="text-sm font-bold text-foreground">Description</Label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional team description..."
            rows={2}
            maxLength={500}
            className="w-full px-4 py-3 bg-input-background border-2 border-border rounded-xl focus:outline-none focus:border-harvest text-foreground placeholder:text-muted-foreground resize-none"
          />
        </div>
        <div>
          <Label className="text-sm font-bold text-foreground">Dota Team ID</Label>
          <Input
            value={formData.valve_team_id}
            onChange={(e) => setFormData({ ...formData, valve_team_id: e.target.value })}
            placeholder="e.g. 9255031"
            className="mt-1 h-12 rounded-xl border-2 border-border focus:border-harvest font-mono bg-input-background text-foreground"
          />
        </div>
        <div>
          <ImageUpload
            currentUrl={formData.logo_url || null}
            onUploadComplete={(url) => setFormData({ ...formData, logo_url: url })}
            label="Team Logo"
            folder="team-logos"
            filename={formData.name.trim() ? `${slugifyTournamentName(formData.name)}.png` : undefined}
          />
        </div>
      </BottomSheetModal.Body>

      <BottomSheetModal.Footer>
        <div className="flex gap-3">
          <Button onClick={onClose} className="flex-1 bg-muted hover:bg-muted/80 text-foreground h-12 rounded-xl font-semibold">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !formData.name.trim() || !formData.tag.trim()}
            className="flex-1 bg-harvest hover:bg-harvest/90 text-white h-12 rounded-xl font-bold disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </div>
      </BottomSheetModal.Footer>
    </BottomSheetModal>
  );
}

// ═══════════════════════════════════════════════════════
// OFFICER CREATE TEAM MODAL
// ═══════════════════════════════════════════════════════

function OfficerCreateTeamModal({
  onClose, onCreated,
}: { onClose: () => void; onCreated: () => void }) {
  const [formData, setFormData] = useState({
    name: '', tag: '', description: '', logo_url: '', valve_team_id: '',
  });
  const [creating, setCreating] = useState(false);

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.tag.trim()) {
      toast.error('Team name and tag are required');
      return;
    }
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');

      const res = await fetch(`${apiBase}/master-teams`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          tag: formData.tag.trim(),
          description: formData.description.trim() || null,
          logo_url: formData.logo_url.trim() || null,
          valve_team_id: formData.valve_team_id ? parseInt(formData.valve_team_id) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create team');

      toast.success(`Team "${formData.name.trim()}" created!`);
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-2xl">
      <BottomSheetModal.Header gradient="from-[#8b5cf6]/10 to-[#8b5cf6]/5" borderColor="border-[#8b5cf6]/20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#8b5cf6]/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-[#8b5cf6]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Create Team (Officer)</h3>
            <p className="text-sm text-muted-foreground">You'll be captain — transfer captaincy after</p>
          </div>
        </div>
      </BottomSheetModal.Header>

      <BottomSheetModal.Body className="space-y-5">
        <div>
          <Label className="text-sm font-bold text-foreground">Team Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Corn Dawgs"
            className="mt-1 h-12 rounded-xl border-2 border-border focus:border-[#8b5cf6] bg-input-background text-foreground"
          />
        </div>
        <div>
          <Label className="text-sm font-bold text-foreground">Team Tag *</Label>
          <Input
            value={formData.tag}
            onChange={(e) => setFormData({ ...formData, tag: e.target.value.toUpperCase().slice(0, 10) })}
            placeholder="e.g. CDGS"
            maxLength={10}
            className="mt-1 h-12 rounded-xl border-2 border-border focus:border-[#8b5cf6] font-mono uppercase bg-input-background text-foreground"
          />
        </div>
        <div>
          <Label className="text-sm font-bold text-foreground">Description</Label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional..."
            rows={2}
            maxLength={500}
            className="w-full px-4 py-3 bg-input-background border-2 border-border rounded-xl focus:outline-none focus:border-[#8b5cf6] text-foreground placeholder:text-muted-foreground resize-none"
          />
        </div>
        <div>
          <Label className="text-sm font-bold text-foreground">Dota Team ID</Label>
          <Input
            value={formData.valve_team_id}
            onChange={(e) => setFormData({ ...formData, valve_team_id: e.target.value })}
            placeholder="e.g. 9255031"
            className="mt-1 h-12 rounded-xl border-2 border-border focus:border-[#8b5cf6] font-mono bg-input-background text-foreground"
          />
        </div>
        <div>
          <ImageUpload
            currentUrl={formData.logo_url || null}
            onUploadComplete={(url) => setFormData({ ...formData, logo_url: url })}
            label="Team Logo"
            folder="team-logos"
            filename={formData.name.trim() ? `${slugifyTournamentName(formData.name)}.png` : undefined}
          />
        </div>
      </BottomSheetModal.Body>

      <BottomSheetModal.Footer>
        <div className="flex gap-3">
          <Button onClick={onClose} className="flex-1 bg-muted hover:bg-muted/80 text-foreground h-12 rounded-xl font-semibold">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !formData.name.trim() || !formData.tag.trim()}
            className="flex-1 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white h-12 rounded-xl font-bold disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
            Create Team
          </Button>
        </div>
      </BottomSheetModal.Footer>
    </BottomSheetModal>
  );
}

// ═══════════════════════════════════════════════════════
// TRANSFER CAPTAINCY MODAL
// ═══════════════════════════════════════════════════════

function TransferCaptainModal({
  team, onClose, onTransferred,
}: { team: MasterTeam; onClose: () => void; onTransferred: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [persons, setPersons] = useState<any[]>([]);
  const [loadingPersons, setLoadingPersons] = useState(true);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;

  // Fetch persons list (all kkup_persons) for selection
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Use the leaderboard or users endpoint to get people with display names
        // We'll query supabase directly via the master teams detail endpoint to get persons
        // Actually, let's just fetch users who have steam_ids linked
        const res = await fetch(`${apiBase}/admin/users?limit=500`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Map users to person-like objects
          const usersWithSteam = (data.users || []).filter((u: any) => u.steam_id);
          setPersons(usersWithSteam);
        }
      } catch (err) {
        console.error('Error fetching users for transfer:', err);
      } finally {
        setLoadingPersons(false);
      }
    })();
  }, []);

  const filteredPersons = useMemo(() => {
    if (!searchQuery.trim()) return persons.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return persons.filter(
      (p: any) => p.discord_username?.toLowerCase().includes(q) || p.steam_id?.includes(q)
    ).slice(0, 20);
  }, [persons, searchQuery]);

  const handleTransfer = async () => {
    if (!selectedPersonId) return;
    setTransferring(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');

      // First resolve the user's steam_id to a kkup_persons ID
      const selectedUser = persons.find((p: any) => p.id === selectedPersonId);
      if (!selectedUser?.steam_id) throw new Error('Selected user has no Steam ID');

      // Look up the person by steam_id
      const personLookupRes = await fetch(`${apiBase}/master-teams/${team.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const teamDetail = await personLookupRes.json();

      // We need the person_id, not user_id. Query persons by steam_id via a different approach.
      // Use the tournament read endpoint or query directly.
      // Let's just use the kkup-read persons approach
      const personsRes = await fetch(`${apiBase}/kkup/persons/by-steam/${selectedUser.steam_id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      let personId: string;
      if (personsRes.ok) {
        const personData = await personsRes.json();
        personId = personData.person?.id;
      } else {
        // Fallback: try to find in existing data
        throw new Error('Could not resolve Steam ID to a Kernel Kup person. They may need to be linked first.');
      }

      if (!personId) throw new Error('Person not found for this Steam ID');

      const res = await fetch(`${apiBase}/master-teams/${team.id}/transfer`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_captain_person_id: personId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transfer failed');

      toast.success(`Captaincy transferred to ${selectedUser.discord_username}!`);
      onTransferred();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTransferring(false);
    }
  };

  const selectedUser = persons.find((p: any) => p.id === selectedPersonId);

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-2xl">
      <BottomSheetModal.Header gradient="from-[#f59e0b]/10 to-[#f59e0b]/5" borderColor="border-[#f59e0b]/20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#f59e0b]/20 flex items-center justify-center">
            <Crown className="w-6 h-6 text-[#f59e0b]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Transfer Captaincy</h3>
            <p className="text-sm text-muted-foreground">
              {team.current_name} [{team.current_tag}]
            </p>
          </div>
        </div>
      </BottomSheetModal.Header>

      <BottomSheetModal.Body className="space-y-4 min-h-[40vh]">
        <div>
          <Label className="text-sm font-bold text-foreground mb-2 block">Search for new captain</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Discord name or Steam ID..."
              className="w-full pl-9 pr-4 py-3 bg-input-background border-2 border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#f59e0b]"
            />
          </div>
        </div>

        {loadingPersons ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-[#f59e0b]" />
          </div>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {filteredPersons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {searchQuery ? 'No users found' : 'No users with Steam accounts'}
              </p>
            ) : (
              filteredPersons.map((person: any) => {
                const isSelected = person.id === selectedPersonId;
                return (
                  <button
                    key={person.id}
                    onClick={() => setSelectedPersonId(person.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'bg-[#f59e0b]/5 border-[#f59e0b]/30'
                        : 'bg-card border-border hover:border-[#f59e0b]/20'
                    }`}
                  >
                    {person.discord_avatar ? (
                      <img
                        src={person.discord_avatar.startsWith('http') ? person.discord_avatar : `https://cdn.discordapp.com/avatars/${person.discord_id}/${person.discord_avatar}.png?size=64`}
                        alt={person.discord_username}
                        className="w-9 h-9 rounded-full border border-border flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-sm font-bold text-muted-foreground">
                        {person.discord_username?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm text-foreground truncate block">
                        {person.discord_username || 'Unknown'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Steam: {person.steam_id}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#f59e0b] flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}

        {selectedUser && (
          <div className="p-3 bg-[#f59e0b]/5 rounded-xl border border-[#f59e0b]/20">
            <p className="text-xs text-muted-foreground">
              Captaincy will transfer from the current captain to <strong className="text-foreground">{selectedUser.discord_username}</strong>.
              The new captain will receive a notification.
            </p>
          </div>
        )}
      </BottomSheetModal.Body>

      <BottomSheetModal.Footer>
        <div className="flex gap-3">
          <Button onClick={onClose} className="flex-1 bg-muted hover:bg-muted/80 text-foreground h-12 rounded-xl font-semibold">
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={transferring || !selectedPersonId}
            className="flex-1 bg-[#f59e0b] hover:bg-[#d97706] text-white h-12 rounded-xl font-bold disabled:opacity-50"
          >
            {transferring ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowRightLeft className="w-5 h-5 mr-2" />}
            Transfer Captain
          </Button>
        </div>
      </BottomSheetModal.Footer>
    </BottomSheetModal>
  );
}