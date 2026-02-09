import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { X, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '/utils/supabase/info';
import { TeamLogo } from '@/app/components/team-logo';

interface Team {
  id: string;
  name: string;
  tag: string;
  logo_url: string | null;
}

interface CreateMatchModalProps {
  tournamentId: string;
  availableTeams: Team[];
  onClose: () => void;
  onSave: () => void;
}

export function CreateMatchModal({ tournamentId, availableTeams, onClose, onSave }: CreateMatchModalProps) {
  const [formData, setFormData] = useState({
    team1_id: '',
    team2_id: '',
    team1_score: '0',
    team2_score: '0',
    stage: 'group_stage',
    status: 'scheduled',
    scheduled_time: '',
  });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!formData.team1_id || !formData.team2_id) {
      toast.error('Both teams are required');
      return;
    }

    if (formData.team1_id === formData.team2_id) {
      toast.error('Teams must be different');
      return;
    }

    try {
      setCreating(true);
      const token = localStorage.getItem('supabase_token');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/tournament/${tournamentId}/match`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            team1_id: formData.team1_id,
            team2_id: formData.team2_id,
            team1_score: parseInt(formData.team1_score) || 0,
            team2_score: parseInt(formData.team2_score) || 0,
            stage: formData.stage,
            status: formData.status,
            scheduled_time: formData.scheduled_time ? new Date(formData.scheduled_time).toISOString() : new Date().toISOString(),
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create match');
      }

      toast.success('✅ Match created successfully!');
      onSave();
      onClose();
    } catch (error: any) {
      console.error('Create match error:', error);
      toast.error(error.message || 'Failed to create match');
    } finally {
      setCreating(false);
    }
  };

  const selectedTeam1 = availableTeams.find(t => t.id === formData.team1_id);
  const selectedTeam2 = availableTeams.find(t => t.id === formData.team2_id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#0f172a]">Create Manual Match</h2>
          <button
            onClick={onClose}
            className="text-[#0f172a]/60 hover:text-[#0f172a]"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Match Preview */}
          {(selectedTeam1 || selectedTeam2) && (
            <div className="p-4 bg-[#fdf5e9] rounded-xl border-2 border-[#0f172a]/10">
              <div className="flex items-center justify-between mb-3">
                {selectedTeam1 ? (
                  <div className="flex items-center gap-2">
                    <TeamLogo logoUrl={selectedTeam1.logo_url} teamName={selectedTeam1.name} size="md" />
                    <span className="font-bold text-[#0f172a]">{selectedTeam1.name}</span>
                  </div>
                ) : (
                  <span className="text-[#0f172a]/40">Select Team 1</span>
                )}
                <span className="text-2xl font-black text-[#0f172a]">
                  {formData.team1_score} - {formData.team2_score}
                </span>
                {selectedTeam2 ? (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#0f172a]">{selectedTeam2.name}</span>
                    <TeamLogo logoUrl={selectedTeam2.logo_url} teamName={selectedTeam2.name} size="md" />
                  </div>
                ) : (
                  <span className="text-[#0f172a]/40">Select Team 2</span>
                )}
              </div>
              <p className="text-xs text-center text-[#0f172a]/60">
                {formData.stage.replace('_', ' ').toUpperCase()} • {formData.status.toUpperCase()}
              </p>
            </div>
          )}

          {/* Teams Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#0f172a] mb-2">
                Team 1 *
              </label>
              <select
                value={formData.team1_id}
                onChange={(e) => setFormData({ ...formData, team1_id: e.target.value })}
                className="w-full px-4 py-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-[#0f172a]"
              >
                <option value="">Select Team 1</option>
                {availableTeams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#0f172a] mb-2">
                Team 2 *
              </label>
              <select
                value={formData.team2_id}
                onChange={(e) => setFormData({ ...formData, team2_id: e.target.value })}
                className="w-full px-4 py-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-[#0f172a]"
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
              <label className="block text-sm font-semibold text-[#0f172a] mb-2">
                Team 1 Score
              </label>
              <input
                type="number"
                value={formData.team1_score}
                onChange={(e) => setFormData({ ...formData, team1_score: e.target.value })}
                min="0"
                className="w-full px-4 py-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-[#0f172a]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#0f172a] mb-2">
                Team 2 Score
              </label>
              <input
                type="number"
                value={formData.team2_score}
                onChange={(e) => setFormData({ ...formData, team2_score: e.target.value })}
                min="0"
                className="w-full px-4 py-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-[#0f172a]"
              />
            </div>
          </div>

          {/* Stage & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#0f172a] mb-2">
                Stage
              </label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                className="w-full px-4 py-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-[#0f172a]"
              >
                <option value="group_stage">Group Stage</option>
                <option value="playoffs">Playoffs</option>
                <option value="semifinals">Semifinals</option>
                <option value="finals">Finals</option>
                <option value="grand_finals">Grand Finals</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#0f172a] mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-[#0f172a]"
              >
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Scheduled Time */}
          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-2">
              Scheduled Time
            </label>
            <input
              type="datetime-local"
              value={formData.scheduled_time}
              onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
              className="w-full px-4 py-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-[#0f172a]"
            />
            <p className="text-xs text-[#0f172a]/60 mt-1">
              Leave empty to use current date/time
            </p>
          </div>

          {/* Info Box */}
          <div className="p-4 bg-[#f97316]/10 rounded-xl border-2 border-[#f97316]/20">
            <p className="text-sm text-[#0f172a] font-semibold mb-1">💡 Pro Tip</p>
            <p className="text-xs text-[#0f172a]/70">
              This creates a match without OpenDota data. You can add VOD links and edit details later. For matches with stats, use "Add Match Manually" with a Match ID.
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
              onClick={handleCreate}
              disabled={creating || !formData.team1_id || !formData.team2_id}
              className="flex-1 bg-[#f97316] hover:bg-[#ea580c] text-white"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Match
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
