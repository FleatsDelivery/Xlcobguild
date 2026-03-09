/**
 * Tournament Hub — Staff Application Modal
 *
 * Lets a registered user apply as a caster or staff member for a tournament.
 * Uses the BottomSheetModal pattern for consistent UX.
 */
import { useState } from 'react';
import { Briefcase, Send, Loader2 } from '@/lib/icons';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { projectId } from '/utils/supabase/info';

interface StaffModalProps {
  tournamentId: string;
  tournamentName: string;
  accessToken: string;
  onClose: () => void;
  onApplied: () => void;
  setResultModal: (modal: { type: 'success' | 'error' | 'info'; title: string; message: string; helpText?: string }) => void;
}

export function StaffModal({ tournamentId, tournamentName, accessToken, onClose, onApplied, setResultModal }: StaffModalProps) {
  const [rolePref, setRolePref] = useState<'caster' | 'producer' | 'helper' | 'tournament_director' | 'other'>('other');
  const [plansToPlay, setPlansToPlay] = useState(false);
  const [message, setMessage] = useState('');
  const [applying, setApplying] = useState(false);

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;
  const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` };

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/apply-staff`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ role_preference: rolePref, message, plans_to_play: plansToPlay }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.role_conflict) {
          setResultModal({
            type: 'error',
            title: 'Role Conflict',
            message: data.error,
            helpText: `You're currently a ${data.current_role}. Withdraw from that role first, then come back to apply as staff.`,
          });
          onClose();
          return;
        }
        throw new Error(data.error || 'Failed to apply');
      }
      setResultModal({ type: 'success', title: 'Application Sent!', message: data.message, helpText: 'The tournament owner will review your application.' });
      onApplied();
    } catch (err: any) {
      setResultModal({ type: 'error', title: 'Application Failed', message: err.message });
    } finally {
      setApplying(false);
    }
  };

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-lg">
      <BottomSheetModal.Header
        gradient="from-[#f59e0b]/10 to-[#f59e0b]/5"
        borderColor="border-[#f59e0b]/20"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#f59e0b]/20 flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-[#f59e0b]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Apply as Staff</h3>
            <p className="text-sm text-muted-foreground">Help run {tournamentName}</p>
          </div>
        </div>
      </BottomSheetModal.Header>

      <BottomSheetModal.Body className="space-y-5">
        <div>
          <Label className="text-sm font-bold text-foreground">I'd like to help as...</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {([
              ['caster', '🎙️ Caster'],
              ['producer', '🎬 Producer'],
              ['helper', '🤝 Helper'],
              ['tournament_director', '👑 Tournament Director'],
              ['other', '🔄 Other'],
            ] as const).map(([val, lbl]) => (
              <button key={val} type="button" onClick={() => { setRolePref(val); if (val !== 'tournament_director') setPlansToPlay(false); }}
                className={`px-3 py-3 rounded-xl border-2 text-sm font-bold transition-all ${rolePref === val ? 'border-[#f59e0b] bg-[#f59e0b]/10 text-[#f59e0b]' : 'border-border text-muted-foreground hover:border-border/80'}`}
              >{lbl}</button>
            ))}
          </div>

          {/* Plans to play toggle — only for Tournament Director */}
          {rolePref === 'tournament_director' && (
            <div className="mt-3 p-3 rounded-xl border-2 border-[#f59e0b]/20 bg-[#f59e0b]/5">
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setPlansToPlay(!plansToPlay)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    plansToPlay ? 'bg-[#10b981]' : 'bg-muted'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                    plansToPlay ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
                <div>
                  <p className="text-sm font-bold text-foreground">I also want to play</p>
                  <p className="text-xs text-muted-foreground">
                    {plansToPlay
                      ? 'You\'ll be added to the free agent pool when approved so you can join or create a team.'
                      : 'You\'ll be pure event staff — no playing in this tournament.'}
                  </p>
                </div>
              </label>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-2">
            {rolePref === 'tournament_director'
              ? plansToPlay
                ? 'As a playing TD, you can also join or create a team once approved.'
                : 'Tournament Directors who don\'t play focus on organizing and managing the event.'
              : rolePref === 'other'
                ? 'We\'ll place you where we need you most.'
                : 'Staff roles are exclusive — you can\'t also be a player in this tournament.'}
          </p>
        </div>
        <div>
          <Label className="text-sm font-bold text-foreground">Message (optional)</Label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Any experience casting, streaming, or organizing you want to mention..." maxLength={500}
            className="w-full h-24 mt-1 rounded-xl border-2 border-border focus:border-[#f59e0b] bg-input-background text-foreground px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-[#f59e0b]/15" />
          <p className="text-xs text-muted-foreground mt-1 text-right">{message.length}/500</p>
        </div>
      </BottomSheetModal.Body>

      <BottomSheetModal.Footer>
        <div className="flex gap-3">
          <Button onClick={onClose} className="flex-1 bg-muted hover:bg-muted/80 text-foreground h-12 rounded-xl font-semibold">Cancel</Button>
          <Button onClick={handleApply} disabled={applying} className="flex-1 bg-[#f59e0b] hover:bg-[#d97706] text-white h-12 rounded-xl font-bold">
            {applying ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />} Apply
          </Button>
        </div>
      </BottomSheetModal.Footer>
    </BottomSheetModal>
  );
}