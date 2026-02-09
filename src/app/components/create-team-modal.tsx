import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { X, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '/utils/supabase/info';
import { TeamLogo } from '@/app/components/team-logo';
import { ImageUpload } from '@/app/components/image-upload';

interface CreateTeamModalProps {
  tournamentId: string;
  onClose: () => void;
  onSave: () => void;
}

export function CreateTeamModal({ tournamentId, onClose, onSave }: CreateTeamModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    tag: '',
    logo_url: '',
    valve_team_id: '',
  });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Team name is required');
      return;
    }

    try {
      setCreating(true);
      const token = localStorage.getItem('supabase_token');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/tournament/${tournamentId}/team`,
        {
          method: 'POST',
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
        throw new Error(error.error || 'Failed to create team');
      }

      toast.success('✅ Team created successfully!');
      onSave();
      onClose();
    } catch (error: any) {
      console.error('Create team error:', error);
      toast.error(error.message || 'Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#0f172a]">Create New Team</h2>
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
            label="Team Logo (Optional)"
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
              Short abbreviation (auto-generated from name if left empty)
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

          {/* Info Box */}
          <div className="p-4 bg-[#f97316]/10 rounded-xl border-2 border-[#f97316]/20">
            <p className="text-sm text-[#0f172a] font-semibold mb-1">💡 Pro Tip</p>
            <p className="text-xs text-[#0f172a]/70">
              You can create teams manually now and add players later. Teams start with a 0-0 record.
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
              disabled={creating || !formData.name.trim()}
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
                  Create Team
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}