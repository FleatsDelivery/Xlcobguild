import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { X, Loader2, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '/utils/supabase/info';
import { TeamLogo } from '@/app/components/team-logo';

interface Team {
  id: string;
  name: string;
  tag: string;
  logo_url: string | null;
  valve_team_id: number | null;
  wins: number;
  losses: number;
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
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
          {/* Logo Preview */}
          <div className="flex items-center gap-4 p-4 bg-[#fdf5e9] rounded-xl">
            <TeamLogo logoUrl={formData.logo_url} teamName={formData.name} size="xl" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#0f172a]/60 mb-1">Current Logo</p>
              <p className="text-xs text-[#0f172a]/40">
                {formData.logo_url ? 'Custom logo URL provided' : '🌽 Using default corn logo'}
              </p>
            </div>
          </div>

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

          {/* Logo URL */}
          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-2">
              Logo URL
            </label>
            <input
              type="url"
              value={formData.logo_url}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              placeholder="https://example.com/team-logo.png"
              className="w-full px-4 py-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-[#0f172a]"
            />
            <p className="text-xs text-[#0f172a]/60 mt-1">
              Leave empty to use the 🌽 corn logo
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
