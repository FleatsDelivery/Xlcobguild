/**
 * Create Master Team Modal — BottomSheetModal pattern
 *
 * Creates a new canonical team identity in kkup_master_teams.
 * Enforces team limit: Free = 1, TCF+ = 20.
 */
import { useState } from 'react';
import { Shield, Plus, Loader2 } from '@/lib/icons';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { ImageUpload } from '@/app/components/image-upload';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { slugifyTournamentName } from '@/lib/slugify';

interface CreateMasterTeamModalProps {
  onClose: () => void;
  onCreated: () => void;
  currentTeamCount: number;
  teamLimit: number;
}

export function CreateMasterTeamModal({ onClose, onCreated, currentTeamCount, teamLimit }: CreateMasterTeamModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    tag: '',
    description: '',
    logo_url: '',
    valve_team_id: '',
  });
  const [creating, setCreating] = useState(false);

  const slotsRemaining = teamLimit - currentTeamCount;

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Team name is required');
      return;
    }
    if (!formData.tag.trim()) {
      toast.error('Team tag is required');
      return;
    }

    try {
      setCreating(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in first');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/master-teams`,
        {
          method: 'POST',
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
        throw new Error(data.error || 'Failed to create team');
      }

      toast.success(`Team "${formData.name.trim()}" created!`);
      onCreated();
      onClose();
    } catch (error: any) {
      console.error('Create master team error:', error);
      toast.error(error.message || 'Failed to create team');
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
            <Shield className="w-6 h-6 text-[#8b5cf6]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Create New Team</h3>
            <p className="text-sm text-muted-foreground">
              {slotsRemaining} of {teamLimit} team slot{slotsRemaining !== 1 ? 's' : ''} remaining
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
            className="mt-1 h-12 rounded-xl border-2 border-border focus:border-[#8b5cf6] bg-input-background text-foreground"
          />
        </div>

        {/* Team Tag */}
        <div>
          <Label className="text-sm font-bold text-foreground">Team Tag *</Label>
          <p className="text-xs text-muted-foreground mb-1">Short abbreviation shown in match results and brackets</p>
          <Input
            value={formData.tag}
            onChange={(e) => setFormData({ ...formData, tag: e.target.value.toUpperCase().slice(0, 10) })}
            placeholder="e.g. NCORN"
            maxLength={10}
            className="mt-1 h-12 rounded-xl border-2 border-border focus:border-[#8b5cf6] font-mono uppercase bg-input-background text-foreground"
          />
        </div>

        {/* Description */}
        <div>
          <Label className="text-sm font-bold text-foreground">Description</Label>
          <p className="text-xs text-muted-foreground mb-1">Optional — a brief description of your team</p>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="A brief description of your team..."
            rows={3}
            maxLength={500}
            className="w-full px-4 py-3 bg-input-background border-2 border-border rounded-xl focus:outline-none focus:border-[#8b5cf6] text-foreground placeholder:text-muted-foreground resize-none"
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
            className="mt-1 h-12 rounded-xl border-2 border-border focus:border-[#8b5cf6] font-mono bg-input-background text-foreground"
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
            {creating ? (
              <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Creating...</>
            ) : (
              <><Plus className="w-5 h-5 mr-2" /> Create Team</>
            )}
          </Button>
        </div>
      </BottomSheetModal.Footer>
    </BottomSheetModal>
  );
}