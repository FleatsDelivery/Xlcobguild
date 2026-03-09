import { useState } from 'react';
import { X, Shield, UserPlus, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

interface RankModalProps {
  /** Whether the submit action is in progress */
  loading?: boolean;
  /** @deprecated Use `loading` instead */
  registering?: boolean;
  onClose: () => void;
  onSubmit: (rank: string) => void;
  /** Customize the modal title */
  title?: string;
  /** Customize the subtitle under the title */
  subtitle?: string;
  /** Customize the submit button label */
  submitLabel?: string;
  /** Icon for the submit button (defaults to UserPlus) */
  submitIcon?: React.ReactNode;
  /** Whether to show the Divine/Immortal ineligibility warning */
  showIneligibleWarning?: boolean;
  /** Whether to block Divine/Immortal selection */
  blockHighRanks?: boolean;
}

export function RankModal({
  loading: loadingProp,
  registering,
  onClose,
  onSubmit,
  title = "What's Your Rank?",
  subtitle = "We couldn't find your Dota 2 rank automatically",
  submitLabel = 'Confirm',
  submitIcon,
  showIneligibleWarning = true,
  blockHighRanks = true,
}: RankModalProps) {
  const [selectedRank, setSelectedRank] = useState<string | null>(null);

  // Support both `loading` and legacy `registering` prop
  const isLoading = loadingProp ?? registering ?? false;

  const handleClose = () => {
    onClose();
  };

  const isHighRank = (rank: string) => ['Divine', 'Immortal'].includes(rank);
  const isBlocked = blockHighRanks && selectedRank && isHighRank(selectedRank);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div className="bg-card rounded-3xl shadow-2xl max-w-md w-full border-2 border-border" onClick={e => e.stopPropagation()}>
        <div className="relative bg-gradient-to-br from-[#3b82f6]/10 to-[#3b82f6]/5 rounded-t-3xl p-6 border-b-2 border-[#3b82f6]/20">
          <button onClick={handleClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-card/80 hover:bg-card flex items-center justify-center z-10">
            <X className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#3b82f6]/20 flex items-center justify-center"><Shield className="w-6 h-6 text-[#3b82f6]" /></div>
            <div>
              <h3 className="text-xl font-bold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">Please select your current or most recent Dota 2 medal. Be honest — officers may review your selection.</p>
          <div className="grid grid-cols-2 gap-2">
            {['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'].map(rank => {
              const isIneligible = blockHighRanks && isHighRank(rank);
              const isSelected = selectedRank === rank;
              return (
                <button key={rank} onClick={() => setSelectedRank(rank)}
                  className={`px-3 py-3 rounded-xl border-2 text-sm font-bold transition-all ${isSelected ? isIneligible ? 'border-[#ef4444] bg-[#ef4444]/10 text-[#ef4444]' : 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]' : isIneligible ? 'border-border text-muted-foreground hover:border-[#ef4444]/30' : 'border-border text-muted-foreground hover:border-[#3b82f6]/30'}`}
                >
                  {rank}
                  {isIneligible && showIneligibleWarning && <span className="block text-[10px] font-normal mt-0.5 opacity-60">Captain/Coach only</span>}
                </button>
              );
            })}
          </div>
          {showIneligibleWarning && selectedRank && isHighRank(selectedRank) && (
            <div className="bg-[#ef4444]/5 rounded-xl p-3 border border-[#ef4444]/20">
              <p className="text-sm text-[#ef4444] font-semibold">{selectedRank} players can't register as players, but you can create a team and coach!</p>
            </div>
          )}
          <div className="bg-[#f59e0b]/5 rounded-xl p-3 border border-[#f59e0b]/20">
            <p className="text-xs text-muted-foreground"><strong className="text-[#f59e0b]">Honesty note:</strong> Officers review registrations. Misrepresenting your rank may result in disqualification.</p>
          </div>
        </div>
        <div className="p-6 pt-0 flex gap-3">
          <Button onClick={handleClose} className="flex-1 bg-muted hover:bg-muted/80 text-foreground h-12 rounded-xl font-semibold">Cancel</Button>
          <Button onClick={() => selectedRank && onSubmit(selectedRank)} disabled={!selectedRank || isLoading || !!isBlocked} className="flex-1 bg-[#3b82f6] hover:bg-[#2563eb] text-white h-12 rounded-xl font-bold">
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : (submitIcon || <CheckCircle className="w-5 h-5 mr-2" />)} {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}