import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { X, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { TeamLogo } from '@/app/components/team-logo';

interface Team {
  id: string;
  name: string;
  tag: string;
  logo_url: string | null;
}

interface Match {
  id: string;
  team1_id: string;
  team2_id: string;
  team1: Team;
  team2: Team;
  team1_score: number;
  team2_score: number;
  winner_team_id: string | null;
  stage: string;
  status: string;
  scheduled_time: string;
  match_id: number | null;
  dotabuff_url: string | null;
  twitch_vod_url: string | null;
  youtube_vod_url: string | null;
}

interface EditMatchModalProps {
  match: Match;
  tournamentId: string;
  availableTeams: Team[];
  onClose: () => void;
  onSave: () => void;
}

export function EditMatchModal({ match, tournamentId, availableTeams, onClose, onSave }: EditMatchModalProps) {
  const [formData, setFormData] = useState({
    team1_id: match.team1_id,
    team2_id: match.team2_id,
    team1_score: match.team1_score.toString(),
    team2_score: match.team2_score.toString(),
    winner_team_id: match.winner_team_id || '',
    stage: match.stage,
    status: match.status,
    scheduled_time: match.scheduled_time ? new Date(match.scheduled_time).toISOString().slice(0, 16) : '',
    twitch_vod_url: match.twitch_vod_url || '',
    youtube_vod_url: match.youtube_vod_url || '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (!formData.team1_id || !formData.team2_id) {
      toast.error('Both teams are required');
      return;
    }

    if (formData.team1_id === formData.team2_id) {
      toast.error('Teams must be different');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('supabase_token');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/tournament/${tournamentId}/match/${match.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            team1_id: formData.team1_id,
            team2_id: formData.team2_id,
            team1_score: parseInt(formData.team1_score) || 0,
            team2_score: parseInt(formData.team2_score) || 0,
            winner_team_id: formData.winner_team_id || null,
            stage: formData.stage,
            status: formData.status,
            scheduled_time: formData.scheduled_time ? new Date(formData.scheduled_time).toISOString() : new Date().toISOString(),
            twitch_vod_url: formData.twitch_vod_url.trim() || null,
            youtube_vod_url: formData.youtube_vod_url.trim() || null,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update match');
      }

      toast.success('✅ Match updated successfully!');
      onSave();
      onClose();
    } catch (error: any) {
      console.error('Update match error:', error);
      toast.error(error.message || 'Failed to update match');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this match? This will also delete all associated player stats.')) {
      return;
    }

    try {
      setDeleting(true);
      const token = localStorage.getItem('supabase_token');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/tournament/${tournamentId}/match/${match.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete match');
      }

      toast.success('✅ Match deleted successfully!');
      onSave();
      onClose();
    } catch (error: any) {
      console.error('Delete match error:', error);
      toast.error(error.message || 'Failed to delete match');
    } finally {
      setDeleting(false);
    }
  };

  const selectedTeam1 = availableTeams.find(t => t.id === formData.team1_id);
  const selectedTeam2 = availableTeams.find(t => t.id === formData.team2_id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-field-dark">Edit Match</h2>
          <button
            onClick={onClose}
            className="text-field-dark/60 hover:text-field-dark"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Match Preview */}
          <div className="p-4 bg-silk rounded-xl border-2 border-field-dark/10">
            <div className="flex items-center justify-between mb-3">
              {selectedTeam1 && (
                <div className="flex items-center gap-2">
                  <TeamLogo logoUrl={selectedTeam1.logo_url} teamName={selectedTeam1.name} size="md" />
                  <span className="font-bold text-field-dark">{selectedTeam1.name}</span>
                </div>
              )}
              <span className="text-2xl font-black text-field-dark">
                {formData.team1_score} - {formData.team2_score}
              </span>
              {selectedTeam2 && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-field-dark">{selectedTeam2.name}</span>
                  <TeamLogo logoUrl={selectedTeam2.logo_url} teamName={selectedTeam2.name} size="md" />
                </div>
              )}
            </div>
            <p className="text-xs text-center text-field-dark/60">
              {formData.stage.replace('_', ' ').toUpperCase()} • {formData.status.toUpperCase()}
            </p>
          </div>

          {/* Teams Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-field-dark mb-2">
                Team 1 *
              </label>
              <select
                value={formData.team1_id}
                onChange={(e) => setFormData({ ...formData, team1_id: e.target.value })}
                className="w-full px-4 py-3 border-2 border-field-dark/10 rounded-lg focus:outline-none focus:border-harvest text-field-dark"
              >
                <option value="">Select Team 1</option>
                {availableTeams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-field-dark mb-2">
                Team 2 *
              </label>
              <select
                value={formData.team2_id}
                onChange={(e) => setFormData({ ...formData, team2_id: e.target.value })}
                className="w-full px-4 py-3 border-2 border-field-dark/10 rounded-lg focus:outline-none focus:border-harvest text-field-dark"
              >
                <option value="">Select Team 2</option>
                {availableTeams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Scores */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-field-dark mb-2">
                Team 1 Score *
              </label>
              <input
                type="number"
                value={formData.team1_score}
                onChange={(e) => setFormData({ ...formData, team1_score: e.target.value })}
                min="0"
                className="w-full px-4 py-3 border-2 border-field-dark/10 rounded-lg focus:outline-none focus:border-harvest text-field-dark"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-field-dark mb-2">
                Team 2 Score *
              </label>
              <input
                type="number"
                value={formData.team2_score}
                onChange={(e) => setFormData({ ...formData, team2_score: e.target.value })}
                min="0"
                className="w-full px-4 py-3 border-2 border-field-dark/10 rounded-lg focus:outline-none focus:border-harvest text-field-dark"
              />
            </div>
          </div>

          {/* Winner */}
          <div>
            <label className="block text-sm font-semibold text-field-dark mb-2">
              Winner
            </label>
            <select
              value={formData.winner_team_id}
              onChange={(e) => setFormData({ ...formData, winner_team_id: e.target.value })}
              className="w-full px-4 py-3 border-2 border-field-dark/10 rounded-lg focus:outline-none focus:border-harvest text-field-dark"
            >
              <option value="">No winner yet</option>
              {formData.team1_id && selectedTeam1 && (
                <option value={formData.team1_id}>{selectedTeam1.name}</option>
              )}
              {formData.team2_id && selectedTeam2 && (
                <option value={formData.team2_id}>{selectedTeam2.name}</option>
              )}
            </select>
          </div>

          {/* Stage & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-field-dark mb-2">
                Stage
              </label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                className="w-full px-4 py-3 border-2 border-field-dark/10 rounded-lg focus:outline-none focus:border-harvest text-field-dark"
              >
                <option value="group_stage">Group Stage</option>
                <option value="playoffs">Playoffs</option>
                <option value="semifinals">Semifinals</option>
                <option value="finals">Finals</option>
                <option value="grand_finals">Grand Finals</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-field-dark mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-3 border-2 border-field-dark/10 rounded-lg focus:outline-none focus:border-harvest text-field-dark"
              >
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Scheduled Time */}
          <div>
            <label className="block text-sm font-semibold text-field-dark mb-2">
              Scheduled Time
            </label>
            <input
              type="datetime-local"
              value={formData.scheduled_time}
              onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
              className="w-full px-4 py-3 border-2 border-field-dark/10 rounded-lg focus:outline-none focus:border-harvest text-field-dark"
            />
          </div>

          {/* VOD URLs */}
          <div>
            <label className="block text-sm font-semibold text-field-dark mb-2">
              Twitch VOD URL
            </label>
            <input
              type="url"
              value={formData.twitch_vod_url}
              onChange={(e) => setFormData({ ...formData, twitch_vod_url: e.target.value })}
              placeholder="https://twitch.tv/videos/..."
              className="w-full px-4 py-3 border-2 border-field-dark/10 rounded-lg focus:outline-none focus:border-harvest text-field-dark"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-field-dark mb-2">
              YouTube VOD URL
            </label>
            <input
              type="url"
              value={formData.youtube_vod_url}
              onChange={(e) => setFormData({ ...formData, youtube_vod_url: e.target.value })}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full px-4 py-3 border-2 border-field-dark/10 rounded-lg focus:outline-none focus:border-harvest text-field-dark"
            />
          </div>

          {/* Dotabuff Link (Read-only) */}
          {match.dotabuff_url && (
            <div className="p-4 bg-[#3b82f6]/10 rounded-xl border-2 border-[#3b82f6]/20">
              <p className="text-sm font-semibold text-field-dark mb-2">Match Data</p>
              <a
                href={match.dotabuff_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3b82f6] hover:text-[#2563eb] text-sm flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View on Dotabuff (Match ID: {match.match_id})
              </a>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              className="flex-1 bg-white hover:bg-field-dark/5 text-field-dark border-2 border-field-dark/10"
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
              className="flex-1 bg-harvest hover:bg-amber text-white"
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