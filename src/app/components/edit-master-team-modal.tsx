/**
 * Edit Master Team Modal — BottomSheetModal pattern
 *
 * Edit or delete a canonical team identity in kkup_master_teams.
 * Delete only allowed if zero tournament appearances.
 */
import { useState } from 'react';
import { Pencil, Loader2, Trash2, Save, AlertTriangle, Trophy } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { ImageUpload } from '@/app/components/image-upload';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { slugifyTournamentName } from '@/lib/slugify';

interface MasterTeam {
  id: string;
  current_name: string;
  current_tag: string;
  current_logo_url: string | null;
  description: string | null;
  valve_team_id: number | null;
  tournament_count: number;
  name_history?: any[];
}

interface EditMasterTeamModalProps {
  team: MasterTeam;
  onClose: () => void;
  onSaved: () => void;
}

export function EditMasterTeamModal({ team, onClose, onSaved }: EditMasterTeamModalProps) {
  const [formData, setFormData] = useState({
    name: team.current_name,
    tag: team.current_tag,
    description: team.description || '',
    logo_url: team.current_logo_url || '',
    valve_team_id: team.valve_team_id?.toString() || '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const canDelete = team.tournament_count === 0;

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Team name is required');
      return;
    }
    if (!formData.tag.trim()) {
      toast.error('Team tag is required');
      return;
    }

    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in first');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/master-teams/${team.id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name.trim(),
            tag: formData.tag.trim(),
            description: formData.description.trim() || null,
            logo_url: formData.logo_url.trim() || null,
            valve_team_id: formData.valve_team_id ? parseInt(formData.valve_team_id) : null,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update team');
      }

      toast.success(`Team "${formData.name.trim()}" updated!`);
      onSaved();
      onClose();
    } catch (error: any) {
      console.error('Edit master team error:', error);
      toast.error(error.message || 'Failed to update team');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in first');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/master-teams/${team.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete team');
      }

      toast.success(`Team "${team.current_name}" deleted.`);
      onSaved();
      onClose();
    } catch (error: any) {
      console.error('Delete master team error:', error);
      toast.error(error.message || 'Failed to delete team');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-2xl" zIndex="z-50">
      <BottomSheetModal.Header
        gradient="from-harvest/10 to-harvest/5"
        borderColor="border-harvest/20"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-harvest/20 flex items-center justify-center">
            <Pencil className="w-6 h-6 text-harvest" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Edit Team</h3>
            <p className="text-sm text-muted-foreground">
              {team.tournament_count > 0
                ? `${team.tournament_count} tournament${team.tournament_count !== 1 ? 's' : ''} played`
                : 'No tournament history yet'}
            </p>
          </div>
        </div>
      </BottomSheetModal.Header>

      <BottomSheetModal.Body className="space-y-5">
        {/* Team Name */}
        <div>
          <Label className="text-sm font-bold text-foreground">Team Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Nebraska Cornhuskers"
            className="mt-1 h-12 rounded-xl border-2 border-border focus:border-harvest bg-input-background text-foreground"
          />
        </div>

        {/* Team Tag */}
        <div>
          <Label className="text-sm font-bold text-foreground">Team Tag *</Label>
          <Input
            value={formData.tag}
            onChange={(e) => setFormData({ ...formData, tag: e.target.value.toUpperCase().slice(0, 10) })}
            placeholder="e.g. NCORN"
            maxLength={10}
            className="mt-1 h-12 rounded-xl border-2 border-border focus:border-harvest font-mono uppercase bg-input-background text-foreground"
          />
        </div>

        {/* Description */}
        <div>
          <Label className="text-sm font-bold text-foreground">Description</Label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="A brief description of your team..."
            rows={3}
            maxLength={500}
            className="w-full px-4 py-3 bg-input-background border-2 border-border rounded-xl focus:outline-none focus:border-harvest text-foreground placeholder:text-muted-foreground resize-none"
          />
        </div>

        {/* Valve Team ID */}
        <div>
          <Label className="text-sm font-bold text-foreground">Dota Team ID</Label>
          <p className="text-xs text-muted-foreground mb-1">Optional — from your in-game Dota 2 team</p>
          <Input
            value={formData.valve_team_id}
            onChange={(e) => setFormData({ ...formData, valve_team_id: e.target.value })}
            placeholder="e.g. 9255031"
            className="mt-1 h-12 rounded-xl border-2 border-border focus:border-harvest font-mono bg-input-background text-foreground"
          />
        </div>

        {/* Logo Upload */}
        <div>
          <ImageUpload
            currentUrl={formData.logo_url || null}
            onUploadComplete={(url) => setFormData({ ...formData, logo_url: url })}
            label="Team Logo"
            folder="team-logos"
            filename={formData.name.trim() ? `${slugifyTournamentName(formData.name)}.png` : undefined}
          />
        </div>

        {/* Name History */}
        {team.name_history && team.name_history.length > 0 && (
          <div className="p-4 bg-muted rounded-xl border border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Name History</p>
            <div className="space-y-1.5">
              {team.name_history.slice(-3).map((entry: any, i: number) => (
                <p key={i} className="text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">{entry.from_name}</span>
                  <span className="text-muted-foreground"> [{entry.from_tag}]</span>
                  <span className="text-muted-foreground"> {'\u2192'} </span>
                  <span className="text-foreground font-medium">{entry.to_name}</span>
                  <span className="text-muted-foreground"> [{entry.to_tag}]</span>
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Delete Warning */}
        {!canDelete && (
          <div className="p-3 bg-[#f59e0b]/10 rounded-xl border border-[#f59e0b]/20 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#f59e0b] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">Cannot delete this team</p>
              <p className="text-xs text-muted-foreground">
                Teams with tournament history are preserved for the record books. You can edit the name, tag, or logo instead.
              </p>
            </div>
          </div>
        )}
      </BottomSheetModal.Body>

      <BottomSheetModal.Footer>
        <div className="flex gap-3">
          {canDelete && (
            <Button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting || saving}
              className="bg-[#ef4444] hover:bg-[#dc2626] text-white h-12 rounded-xl px-4"
            >
              {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
            </Button>
          )}
          <Button onClick={onClose} className="flex-1 bg-muted hover:bg-muted/80 text-foreground h-12 rounded-xl font-semibold">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || deleting || !formData.name.trim() || !formData.tag.trim()}
            className="flex-1 bg-harvest hover:bg-harvest/90 text-white h-12 rounded-xl font-bold disabled:opacity-50"
          >
            {saving ? (
              <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Saving...</>
            ) : (
              <><Save className="w-5 h-5 mr-2" /> Save Changes</>
            )}
          </Button>
        </div>
      </BottomSheetModal.Footer>

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Team"
          message={`Are you sure you want to permanently delete "${team.current_name}" [${team.current_tag}]? This cannot be undone.`}
          confirmText={deleting ? 'Deleting...' : 'Delete Team'}
          confirmVariant="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </BottomSheetModal>
  );
}
