import { useState, useEffect } from 'react';
import { Headphones, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '/utils/supabase/info';
import { useTournament } from '@/app/contexts/tournament-context';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { Button } from '@/app/components/ui/button';

export function StaffApplicationModal({
  isOpen,
  onClose,
  tournamentId,
  tournamentName,
}: {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  tournamentName: string;
}) {
  const { accessToken, refetch } = useTournament();
  const [rolePreference, setRolePreference] = useState('caster');
  const [plansToPlay, setPlansToPlay] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) {
      toast.error('You need to log in to apply.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournamentId}/apply-staff`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role_preference: rolePreference, plans_to_play: plansToPlay, message }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to apply as staff');
      }

      toast.success(result.message || 'Staff application submitted!');
      if (refetch) await refetch();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error occurred during staff application.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-lg">
      <BottomSheetModal.Header gradient="from-[#f59e0b]/20 to-[#f59e0b]/5" borderColor="border-[#f59e0b]/30">
        <div className="flex items-center gap-3 pr-8">
          <div className="w-10 h-10 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#f59e0b]">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Apply as Staff</h2>
            <p className="text-xs font-semibold text-muted-foreground leading-tight">{tournamentName}</p>
          </div>
        </div>
      </BottomSheetModal.Header>

      <BottomSheetModal.Body>
        <form id="staff-form" onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-xl p-3 text-sm text-[#ef4444] font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-foreground mb-1">What role are you applying for?</label>
            <p className="text-xs text-muted-foreground mb-3">Staff roles are exclusive; you cannot play or coach unless you are the Tournament Director.</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'caster', label: 'Caster' },
                { id: 'producer', label: 'Producer' },
                { id: 'helper', label: 'Helper' },
                { id: 'tournament_director', label: 'Tournament Director' },
                { id: 'other', label: 'Other/Not Sure' }
              ].map(opt => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setRolePreference(opt.id)}
                  className={`p-3 text-sm font-semibold rounded-xl border-2 transition-all ${
                    rolePreference === opt.id ? 'border-[#f59e0b] bg-[#f59e0b]/10 text-[#f59e0b]' : 'border-border bg-muted/50 hover:border-border/80 text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {rolePreference === 'tournament_director' && (
            <label className="flex items-center gap-3 p-3 rounded-xl border-2 border-border bg-muted/30 cursor-pointer hover:border-border/80 transition-colors">
              <input 
                type="checkbox" 
                checked={plansToPlay} 
                onChange={e => setPlansToPlay(e.target.checked)}
                className="w-5 h-5 accent-harvest shrink-0"
              />
              <span className="text-sm font-semibold text-foreground">I also plan to play in this tournament.</span>
            </label>
          )}

          <div>
            <label className="block text-sm font-bold text-foreground mb-1">Anything else we should know?</label>
            <p className="text-xs text-muted-foreground mb-2">If you have previous experience, preferred co-casters, or specific availability, let us know.</p>
            <textarea
              className="w-full h-24 p-3 bg-muted/50 border-2 border-border rounded-xl text-sm text-foreground focus:border-[#f59e0b]/60 focus:ring-1 focus:ring-[#f59e0b]/30 outline-none transition-all resize-none"
              placeholder="Your application note..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </form>
      </BottomSheetModal.Body>

      <BottomSheetModal.Footer>
        <Button
          type="submit"
          form="staff-form"
          disabled={isSubmitting}
          className="w-full py-6 rounded-xl font-bold bg-[#f59e0b] hover:bg-[#d97706] text-white shadow-lg shadow-[#f59e0b]/20 transition-all disabled:opacity-60 flex justify-center items-center gap-2"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Application'}
        </Button>
      </BottomSheetModal.Footer>
    </BottomSheetModal>
  );
}
