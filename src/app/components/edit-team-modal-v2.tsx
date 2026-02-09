import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { X, Loader2, Trash2, Plus, UserPlus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '/utils/supabase/info';
import { TeamLogo } from '@/app/components/team-logo';
import { ImageUpload } from '@/app/components/image-upload';

interface Team {
  id: string;
  name: string;
  tag: string;
  logo_url: string | null;
  valve_team_id: number | null;
  wins: number;
  losses: number;
}

interface PlayerProfile {
  id: string;
  player_name: string;
  steam_id: string | null;
  opendota_id: string | null;
  dotabuff_url: string | null;
}

interface RosterPlayer {
  id: string;
  player_profile_id: string;
  player: PlayerProfile;
}

interface EditTeamModalProps {
  team: Team;
  tournamentId: string;
  onClose: () => void;
  onSave: () => void;
}

export function EditTeamModal({ team, tournamentId, onClose, onSave }: EditTeamModalProps) {
  const [formData, setFormData] = useState({
    name: team.name,
    tag: team.tag,
    logo_url: team.logo_url || '',
    valve_team_id: team.valve_team_id?.toString() || '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<PlayerProfile[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [showCreatePlayer, setShowCreatePlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [creatingPlayer, setCreatingPlayer] = useState(false);

  useEffect(() => {
    fetchRoster();
    fetchAvailablePlayers();
  }, []);

  const fetchRoster = async () => {
    try {
      setLoadingRoster(true);
      const token = localStorage.getItem('supabase_token');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/tournament/${tournamentId}/team/${team.id}/roster`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRoster(data.roster || []);
      }
    } catch (error) {
      console.error('Fetch roster error:', error);
    } finally {
      setLoadingRoster(false);
    }
  };

  const fetchAvailablePlayers = async () => {
    try {
      const token = localStorage.getItem('supabase_token');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/tournament/${tournamentId}/players`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAvailablePlayers(data.players || []);
      }
    } catch (error) {
      console.error('Fetch players error:', error);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Team name is required');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('supabase_token');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/tournament/${tournamentId}/team/${team.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name.trim(),
            tag: formData.tag.trim() || formData.name.substring(0, 4).toUpperCase(),
            logo_url: formData.logo_url.trim() || null,
            valve_team_id: formData.valve_team_id ? parseInt(formData.valve_team_id) : null,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update team');
      }

      toast.success('✅ Team updated successfully!');
      onSave();
      onClose();
    } catch (error: any) {
      console.error('Update team error:', error);
      toast.error(error.message || 'Failed to update team');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${team.name}"? This will also delete all associated matches and stats.`)) {
      return;
    }

    try {
      setDeleting(true);
      const token = localStorage.getItem('supabase_token');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/tournament/${tournamentId}/team/${team.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete team');
      }

      toast.success('✅ Team deleted successfully!');
      onSave();
      onClose();
    } catch (error: any) {
      console.error('Delete team error:', error);
      toast.error(error.message || 'Failed to delete team');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!selectedPlayerId) {
      toast.error('Please select a player');
      return;
    }

    try {
      setAddingPlayer(true);
      const token = localStorage.getItem('supabase_token');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/tournament/${tournamentId}/team/${team.id}/player`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ player_profile_id: selectedPlayerId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add player');
      }

      toast.success('✅ Player added to team!');
      fetchRoster();
      setShowAddPlayer(false);
      setSelectedPlayerId('');
    } catch (error: any) {
      console.error('Add player error:', error);
      toast.error(error.message || 'Failed to add player');
    } finally {
      setAddingPlayer(false);
    }
  };

  const handleRemovePlayer = async (playerId: string, playerName: string) => {
    if (!confirm(`Remove ${playerName} from this team?`)) return;

    try {
      const token = localStorage.getItem('supabase_token');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/tournament/${tournamentId}/team/${team.id}/player/${playerId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove player');
      }

      toast.success('✅ Player removed from team');
      fetchRoster();
    } catch (error: any) {
      console.error('Remove player error:', error);
      toast.error(error.message || 'Failed to remove player');
    }
  };

  const handleCreatePlayer = async () => {
    if (!newPlayerName.trim()) {
      toast.error('Player name is required');
      return;
    }

    try {
      setCreatingPlayer(true);
      const token = localStorage.getItem('supabase_token');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/tournament/${tournamentId}/player`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ player_name: newPlayerName.trim() }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create player');
      }

      const data = await response.json();
      toast.success('✅ Player created!');
      fetchAvailablePlayers();
      setShowCreatePlayer(false);
      setNewPlayerName('');
      
      // Auto-select newly created player
      setSelectedPlayerId(data.player.id);
      setShowAddPlayer(true);
    } catch (error: any) {
      console.error('Create player error:', error);
      toast.error(error.message || 'Failed to create player');
    } finally {
      setCreatingPlayer(false);
    }
  };

  const rosterPlayerIds = roster.map(r => r.player_profile_id);
  const playersNotOnTeam = availablePlayers.filter(p => !rosterPlayerIds.includes(p.id));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#0f172a]">Edit Team</h2>
          <button
            onClick={onClose}
            className="text-[#0f172a]/60 hover:text-[#0f172a]"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Logo Upload */}
          <ImageUpload
            currentUrl={formData.logo_url}
            onUploadComplete={(url) => setFormData({ ...formData, logo_url: url })}
            label="Team Logo"
          />

          {/* Team Name */}
          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-2">
              Team Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Team Liquid"
              className="w-full px-4 py-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-[#0f172a]"
            />
          </div>

          {/* Team Tag */}
          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-2">
              Team Tag
            </label>
            <input
              type="text"
              value={formData.tag}
              onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
              placeholder="e.g., TL"
              maxLength={10}
              className="w-full px-4 py-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-[#0f172a]"
            />
            <p className="text-xs text-[#0f172a]/60 mt-1">
              Short abbreviation (auto-generated if left empty)
            </p>
          </div>

          {/* Valve Team ID */}
          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-2">
              Valve Team ID (Optional)
            </label>
            <input
              type="text"
              value={formData.valve_team_id}
              onChange={(e) => setFormData({ ...formData, valve_team_id: e.target.value })}
              placeholder="e.g., 2163"
              className="w-full px-4 py-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-[#0f172a]"
            />
            <p className="text-xs text-[#0f172a]/60 mt-1">
              Used for matching teams during OpenDota scraping
            </p>
          </div>

          {/* Team Roster */}
          <div className="border-2 border-[#0f172a]/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#0f172a]">Team Roster ({roster.length} players)</h3>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowCreatePlayer(true)}
                  size="sm"
                  className="bg-[#10b981] hover:bg-[#059669] text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  New Player
                </Button>
                <Button
                  onClick={() => setShowAddPlayer(true)}
                  size="sm"
                  className="bg-[#f97316] hover:bg-[#ea580c] text-white"
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  Add Player
                </Button>
              </div>
            </div>

            {loadingRoster ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-[#f97316] animate-spin" />
              </div>
            ) : roster.length === 0 ? (
              <p className="text-center text-[#0f172a]/60 py-8">
                No players on this team yet
              </p>
            ) : (
              <div className="space-y-2">
                {roster.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-[#fdf5e9] rounded-lg"
                  >
                    <span className="font-semibold text-[#0f172a]">
                      {member.player.player_name}
                    </span>
                    <Button
                      onClick={() => handleRemovePlayer(member.player.id, member.player.player_name)}
                      size="sm"
                      className="bg-[#ef4444] hover:bg-[#dc2626] text-white"
                    >
                      <UserMinus className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Player Modal */}
          {showAddPlayer && (
            <div className="border-2 border-[#f97316] rounded-xl p-4 bg-[#f97316]/5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-[#0f172a]">Add Player to Team</h4>
                <button onClick={() => setShowAddPlayer(false)}>
                  <X className="w-5 h-5 text-[#0f172a]/60" />
                </button>
              </div>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full px-4 py-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-[#0f172a] mb-3"
              >
                <option value="">Select a player...</option>
                {playersNotOnTeam.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.player_name}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleAddPlayer}
                disabled={addingPlayer || !selectedPlayerId}
                className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white"
              >
                {addingPlayer ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add to Team
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Create Player Modal */}
          {showCreatePlayer && (
            <div className="border-2 border-[#10b981] rounded-xl p-4 bg-[#10b981]/5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-[#0f172a]">Create New Player</h4>
                <button onClick={() => setShowCreatePlayer(false)}>
                  <X className="w-5 h-5 text-[#0f172a]/60" />
                </button>
              </div>
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Player name"
                className="w-full px-4 py-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#10b981] text-[#0f172a] mb-3"
              />
              <Button
                onClick={handleCreatePlayer}
                disabled={creatingPlayer || !newPlayerName.trim()}
                className="w-full bg-[#10b981] hover:bg-[#059669] text-white"
              >
                {creatingPlayer ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Player
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Stats Display */}
          <div className="p-4 bg-[#fdf5e9] rounded-xl border-2 border-[#0f172a]/10">
            <p className="text-sm font-semibold text-[#0f172a]/60 mb-2">Current Record</p>
            <p className="text-2xl font-black text-[#f97316]">
              {team.wins}W - {team.losses}L
            </p>
            <p className="text-xs text-[#0f172a]/60 mt-1">
              Win rate: {((team.wins / (team.wins + team.losses || 1)) * 100).toFixed(0)}%
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              className="flex-1 bg-white hover:bg-[#0f172a]/5 text-[#0f172a] border-2 border-[#0f172a]/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting || saving}
              className="bg-[#ef4444] hover:bg-[#dc2626] text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || deleting}
              className="flex-1 bg-[#f97316] hover:bg-[#ea580c] text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
