import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { X, Loader2, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '/utils/supabase/info';
import { TeamLogo } from '@/app/components/team-logo';
import { ImageUpload } from '@/app/components/image-upload';
import { slugifyTournamentName } from '@/lib/slugify';

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
          <h2 className="text-2xl font-bold text-field-dark">Edit Team</h2>
          <button
            onClick={onClose}
            className="text-field-dark/60 hover:text-field-dark"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Team Logo Upload */}
          <ImageUpload
            currentUrl={formData.logo_url}
            onUploadComplete={(url) => setFormData({ ...formData, logo_url: url })}
            label="Team Logo"
            folder="team-logos"
            filename={formData.name?.trim() ? `${slugifyTournamentName(formData.name)}.png` : undefined}
          />

          {/* Team Name */}
          <div>
            <label className="block text-sm font-semibold text-field-dark mb-2">
              Team Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Team Liquid"
              className="w-full px-4 py-3 border-2 border-field-dark/10 rounded-lg focus:outline-none focus:border-harvest text-field-dark"
            />
          </div>

          {/* Team Tag */}
          <div>
            <label className="block text-sm font-semibold text-field-dark mb-2">
              Team Tag
            </label>
            <input
              type="text"
              value={formData.tag}
              onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
              placeholder="e.g., TL"
              maxLength={10}
              className="w-full px-4 py-3 border-2 border-field-dark/10 rounded-lg focus:outline-none focus:border-harvest text-field-dark"
            />
            <p className="text-xs text-field-dark/60 mt-1">
              Short abbreviation (auto-generated if left empty)
            </p>
          </div>

          {/* Valve Team ID */}
          <div>
            <label className="block text-sm font-semibold text-field-dark mb-2">
              Valve Team ID (Optional)
            </label>
            <input
              type="text"
              value={formData.valve_team_id}
              onChange={(e) => setFormData({ ...formData, valve_team_id: e.target.value })}
              placeholder="e.g., 2163"
              className="w-full px-4 py-3 border-2 border-field-dark/10 rounded-lg focus:outline-none focus:border-harvest text-field-dark"
            />
            <p className="text-xs text-field-dark/60 mt-1">
              Used for matching teams during OpenDota scraping
            </p>
          </div>



          {/* Stats Display */}
          <div className="p-4 bg-silk rounded-xl border-2 border-field-dark/10">
            <p className="text-sm font-semibold text-field-dark/60 mb-2">Current Record</p>
            <p className="text-2xl font-black text-harvest">
              {team.wins}W - {team.losses}L
            </p>
            <p className="text-xs text-field-dark/60 mt-1">
              Win rate: {((team.wins / (team.wins + team.losses || 1)) * 100).toFixed(0)}%
            </p>
          </div>

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