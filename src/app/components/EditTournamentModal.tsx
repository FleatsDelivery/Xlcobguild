import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { X, Loader2 } from 'lucide-react';
import { projectId } from '/utils/supabase/info';
import { toast } from 'sonner';

interface EditTournamentModalProps {
  tournament: {
    id: string;
    name: string;
    prize_pool: string;
    description: string;
  };
  onClose: () => void;
  onSave: () => void;
}

export function EditTournamentModal({ tournament, onClose, onSave }: EditTournamentModalProps) {
  const [prizePool, setPrizePool] = useState(tournament.prize_pool || '');
  const [description, setDescription] = useState(tournament.description || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('supabase_token');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/${tournament.id}/update`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prize_pool: prizePool,
            description: description,
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update tournament');
      }

      toast.success('Tournament updated successfully!');
      onSave();
      onClose();
    } catch (error: any) {
      console.error('Update error:', error);
      toast.error(error.message || 'Failed to update tournament');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b-2 border-[#0f172a]/10 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#0f172a]">Edit Tournament</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#0f172a]/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[#0f172a]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Prize Pool */}
          <div>
            <label className="block text-sm font-bold text-[#0f172a] mb-2">
              Prize Pool
            </label>
            <input
              type="text"
              value={prizePool}
              onChange={(e) => setPrizePool(e.target.value)}
              placeholder="e.g., $500 + Discord Nitro"
              className="w-full px-4 py-3 border-2 border-[#0f172a]/10 rounded-xl focus:border-[#f97316] focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-[#0f172a] mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this tournament..."
              rows={4}
              className="w-full px-4 py-3 border-2 border-[#0f172a]/10 rounded-xl focus:border-[#f97316] focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t-2 border-[#0f172a]/10 p-6 flex gap-3 justify-end">
          <Button
            onClick={onClose}
            className="bg-white hover:bg-[#0f172a]/5 text-[#0f172a] border-2 border-[#0f172a]/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#f97316] hover:bg-[#ea580c] text-white"
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
  );
}