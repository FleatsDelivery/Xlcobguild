/**
 * Prize Pool Donation Modal
 *
 * Lets users donate to the Kernel Kup prize pool via Stripe Checkout.
 * 95% goes directly to the prize pool, 5% platform fee for backend costs.
 *
 * Users can now leave an optional note specifying how they'd like their donation used.
 */
import { useState } from 'react';
import { Heart, DollarSign, Trophy, Sparkles, Loader2, Info, Scale } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { createCheckoutSession } from '@/lib/stripe';
import { saveCheckoutContext, clearCheckoutContext } from '@/lib/checkout-context';
import { toast } from 'sonner';

interface DonatePrizePoolModalProps {
  onClose: () => void;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

export function DonatePrizePoolModal({
  onClose,
}: DonatePrizePoolModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

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
      });
      const url = await createCheckoutSession({
        type: 'donation',
        amount: amountCents,
        note: note.trim() || undefined,
      });
      window.location.href = url;
    } catch (err: any) {
      console.error('Donation checkout error:', err);
      toast.error(err.message || 'Failed to start checkout. Please try again.');
      clearCheckoutContext();
      setLoading(false);
    }
  };

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
            Fuel the competition
          </p>
        </div>
      </BottomSheetModal.Header>

      <BottomSheetModal.Body className="space-y-5">
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

        {/* Note (Optional) */}
        <div>
          <p className="text-sm font-bold text-foreground mb-1">Note (Optional)</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Let us know how you'd like this used (e.g., 'Kernel Kup 10', 'Infrastructure', etc.)"
            rows={2}
            className="w-full p-3 rounded-xl border-2 border-border focus:border-kernel-gold bg-input-background text-foreground text-sm outline-none focus:ring-2 focus:ring-kernel-gold/15 transition-all resize-none"
            maxLength={300}
          />
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
                      Prize Pool (95%)
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
            95% of every donation goes directly to the prize pool or your requested target. 5% covers platform and payment processing costs. You'll be redirected to Stripe for secure checkout.
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
