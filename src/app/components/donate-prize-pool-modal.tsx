/**
 * Prize Pool Donation Modal
 *
 * Lets users donate to the Kernel Kup prize pool via Stripe Checkout.
 * 95% goes directly to the prize pool, 5% platform fee for backend costs.
 *
 * When opened from the Secret Shop (no tournament props), it auto-fetches
 * the next upcoming tournament so the user knows exactly where their
 * donation is going.
 */
import { useState, useEffect } from 'react';
import { Heart, DollarSign, Trophy, Sparkles, Loader2, Info, CalendarDays, Scale } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { createCheckoutSession } from '@/lib/stripe';
import { saveCheckoutContext, clearCheckoutContext } from '@/lib/checkout-context';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface DonatePrizePoolModalProps {
  tournamentName?: string;
  currentPrizePool?: number;
  currentDonations?: number;
  tournamentId?: string;
  onClose: () => void;
}

interface NextTournament {
  id: string;
  name: string;
  start_date: string;
  status: string;
  prize_pool: number;
  prize_pool_donations: number;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

export function DonatePrizePoolModal({
  tournamentName,
  currentPrizePool,
  currentDonations,
  tournamentId,
  onClose,
}: DonatePrizePoolModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-fetch next upcoming tournament when no explicit tournament is provided
  const [nextTournament, setNextTournament] = useState<NextTournament | null>(null);
  const [fetchingTournament, setFetchingTournament] = useState(!tournamentId);

  useEffect(() => {
    // If a tournament was explicitly provided, no need to fetch
    if (tournamentId) return;

    const fetchNext = async () => {
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/next-upcoming`,
          { headers: { 'Authorization': `Bearer ${publicAnonKey}` } },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.tournament) {
          setNextTournament(data.tournament);
        }
      } catch (err) {
        console.error('Failed to fetch next upcoming tournament for donation modal:', err);
      } finally {
        setFetchingTournament(false);
      }
    };
    fetchNext();
  }, [tournamentId]);

  // Resolve which tournament we're donating to
  const resolvedId = tournamentId || nextTournament?.id;
  const resolvedName = tournamentName || nextTournament?.name;
  const resolvedPool = currentPrizePool ?? (nextTournament?.prize_pool || 0);
  const resolvedDonations = currentDonations ?? (nextTournament?.prize_pool_donations || 0);
  const totalPool = resolvedPool + resolvedDonations;

  const effectiveAmount = selectedAmount ?? (customAmount ? parseFloat(customAmount) : 0);
  const isValidAmount = effectiveAmount >= 1 && effectiveAmount <= 500;
  const prizePoolShare = effectiveAmount * 0.95;
  const platformShare = effectiveAmount * 0.05;

  const handleSelectPreset = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomChange = (value: string) => {
    // Only allow numbers and one decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
    setCustomAmount(formatted);
    setSelectedAmount(null);
  };

  const handleDonate = async () => {
    if (!isValidAmount) return;
    setLoading(true);
    try {
      const amountCents = Math.round(effectiveAmount * 100);
      // Save checkout context before redirecting to Stripe
      saveCheckoutContext({
        type: 'donation',
        amount: effectiveAmount,
        tournamentName: resolvedName,
        tournamentId: resolvedId,
      });
      const url = await createCheckoutSession({
        type: 'donation',
        amount: amountCents,
        ...(resolvedId ? { tournament_id: resolvedId } : {}),
      });
      window.location.href = url;
    } catch (err: any) {
      console.error('Donation checkout error:', err);
      toast.error(err.message || 'Failed to start checkout. Please try again.');
      clearCheckoutContext();
      setLoading(false);
    }
  };

  // Format the start date nicely
  const startDateStr = nextTournament?.start_date
    ? new Date(nextTournament.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-lg">
      <BottomSheetModal.Header
        gradient="from-kernel-gold/15 to-harvest/10"
        borderColor="border-kernel-gold/25"
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-kernel-gold/20 flex items-center justify-center mb-3">
            <Trophy className="w-7 h-7 text-kernel-gold" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Prize Pool Donation</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {resolvedName ? `Support ${resolvedName}` : 'Fuel the competition'}
          </p>

          {/* Tournament target badge */}
          {fetchingTournament ? (
            <div className="mt-3 px-4 py-1.5 rounded-full bg-muted border border-border">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Finding next tournament...
              </span>
            </div>
          ) : resolvedName ? (
            <div className="mt-3 flex flex-col items-center gap-1.5">
              {/* Prize pool total */}
              {totalPool > 0 && (
                <div className="px-4 py-1.5 rounded-full bg-kernel-gold/10 border border-kernel-gold/20">
                  <span className="text-sm font-bold text-kernel-gold flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4" />
                    Current Pool: ${totalPool.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {/* Donation breakdown if there are donations */}
              {resolvedPool > 0 && resolvedDonations > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  ${resolvedPool.toFixed(0)} base + ${resolvedDonations.toFixed(2)} from donations
                </span>
              )}
            </div>
          ) : (
            <div className="mt-3 px-4 py-1.5 rounded-full bg-muted border border-border">
              <span className="text-xs font-medium text-muted-foreground">
                No upcoming tournament found — donation will be applied when one is created
              </span>
            </div>
          )}
        </div>
      </BottomSheetModal.Header>

      <BottomSheetModal.Body className="space-y-5">
        {/* Target tournament callout (only when auto-resolved from Secret Shop) */}
        {!tournamentId && resolvedName && startDateStr && (
          <div className="flex items-center gap-3 rounded-xl bg-harvest/6 border border-harvest/12 p-3">
            <div className="w-9 h-9 rounded-lg bg-harvest/12 flex items-center justify-center flex-shrink-0">
              <CalendarDays className="w-4.5 h-4.5 text-harvest" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground">Donating to {resolvedName}</p>
              <p className="text-[11px] text-muted-foreground">
                Starting {startDateStr} · Your donation goes directly to this prize pool
              </p>
            </div>
          </div>
        )}

        {/* Preset Amounts */}
        <div>
          <p className="text-sm font-bold text-foreground mb-2">Select an Amount</p>
          <div className="grid grid-cols-5 gap-2">
            {PRESET_AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => handleSelectPreset(amount)}
                className={`py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                  selectedAmount === amount
                    ? 'border-kernel-gold bg-kernel-gold/10 text-kernel-gold ring-2 ring-kernel-gold/20'
                    : 'border-border text-muted-foreground hover:border-kernel-gold/40'
                }`}
              >
                ${amount}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Amount */}
        <div>
          <p className="text-sm font-bold text-foreground mb-1">Or Enter Custom Amount</p>
          <div className="relative">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              inputMode="decimal"
              value={customAmount}
              onChange={(e) => handleCustomChange(e.target.value)}
              placeholder="0.00"
              className="w-full h-12 pl-10 pr-4 rounded-xl border-2 border-border focus:border-kernel-gold bg-input-background text-foreground text-lg font-bold outline-none focus:ring-2 focus:ring-kernel-gold/15 transition-all"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Minimum $1 · Maximum $500</p>
        </div>

        {/* Split Breakdown */}
        {isValidAmount && (
          <div className="bg-kernel-gold/5 rounded-xl p-4 border border-kernel-gold/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-kernel-gold/15 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-kernel-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">
                  ${effectiveAmount.toFixed(2)} Donation
                </p>
                <div className="mt-1.5 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Prize Pool (95%){resolvedName ? ` → ${resolvedName}` : ''}
                    </span>
                    <span className="font-bold text-kernel-gold">${prizePoolShare.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Platform Fee (5%)</span>
                    <span className="font-semibold text-muted-foreground">${platformShare.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Note */}
        <div className="flex items-start gap-2 px-1">
          <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            95% of every donation goes directly to the {resolvedName || 'Kernel Kup'} prize pool. 5% covers platform and payment processing costs. You'll be redirected to Stripe for secure checkout.
          </p>
        </div>

        {/* Transparency link */}
        <div className="flex items-center gap-1.5 px-1">
          <Scale className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
          <a
            href="#transparency"
            onClick={onClose}
            className="text-[10px] text-muted-foreground/60 hover:text-harvest transition-colors"
          >
            See the full financial breakdown
          </a>
        </div>
      </BottomSheetModal.Body>

      <BottomSheetModal.Footer>
        <div className="flex gap-3">
          <Button
            onClick={onClose}
            className="flex-1 bg-muted hover:bg-muted/80 text-foreground h-12 rounded-xl font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDonate}
            disabled={!isValidAmount || loading}
            className="flex-1 bg-kernel-gold hover:bg-kernel-gold/90 text-white h-12 rounded-xl font-bold disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Heart className="w-5 h-5 mr-2" />
                Donate {isValidAmount ? `$${effectiveAmount.toFixed(2)}` : ''}
              </>
            )}
          </Button>
        </div>
      </BottomSheetModal.Footer>
    </BottomSheetModal>
  );
}