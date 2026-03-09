/**
 * Membership Farewell Modal — shown once when a user's TCF+ cancellation is first detected.
 *
 * "Sorry to see you go! Your membership will remain active until [date].
 *  Until then, you can use your account like normal."
 *
 * Uses localStorage flag `tcf_cancel_farewell_seen` to ensure it only shows once
 * per cancellation cycle (cleared when subscription reactivates or fully expires).
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Crown, CalendarClock, Heart, CreditCard, ArrowRight } from 'lucide-react';
import { openCustomerPortal } from '@/lib/stripe';

const FAREWELL_SEEN_KEY = 'tcf_cancel_farewell_seen';

/** Call this when the subscription is reactivated or fully expired to reset the flag. */
export function clearFarewellSeen() {
  try { localStorage.removeItem(FAREWELL_SEEN_KEY); } catch { /* noop */ }
}

/** Check whether the farewell has already been dismissed. */
export function hasFarewellBeenSeen(): boolean {
  try { return localStorage.getItem(FAREWELL_SEEN_KEY) === 'true'; } catch { return false; }
}

/** Mark farewell as seen so it doesn't show again. */
function markFarewellSeen() {
  try { localStorage.setItem(FAREWELL_SEEN_KEY, 'true'); } catch { /* noop */ }
}

interface Props {
  /** Unix timestamp (seconds) — when the membership ends */
  periodEnd: number;
  onClose: () => void;
}

export function MembershipFarewellModal({ periodEnd, onClose }: Props) {
  const [visible, setVisible] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  const endDate = new Date(periodEnd * 1000);
  const endDateStr = endDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Calculate days remaining
  const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  useEffect(() => {
    markFarewellSeen();
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  const handleResubscribe = async () => {
    setPortalLoading(true);
    try {
      const url = await openCustomerPortal();
      window.location.href = url;
    } catch (err: any) {
      console.error('Failed to open customer portal:', err);
      setPortalLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            className="relative bg-card rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Amber gradient bar */}
            <motion.div
              className="h-1.5 bg-gradient-to-r from-harvest/60 via-harvest to-harvest/60"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            />

            {/* Close */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-muted hover:bg-border flex items-center justify-center transition-all z-10"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Hero */}
            <div className="relative px-6 pt-8 pb-5 text-center">
              {/* Soft glow */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 50% 40%, rgba(214,166,21,0.08) 0%, transparent 60%)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
              />

              <motion.div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{
                  backgroundColor: 'rgba(214,166,21,0.1)',
                  border: '2px solid rgba(214,166,21,0.2)',
                }}
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 14, stiffness: 200, delay: 0.15 }}
              >
                <Crown className="w-10 h-10 text-harvest" />
              </motion.div>

              <motion.h3
                className="text-2xl sm:text-3xl font-black text-foreground mb-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                Sorry to See You Go
              </motion.h3>

              <motion.p
                className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                Your TCF+ cancellation has been scheduled. You can still enjoy all your perks until it ends.
              </motion.p>
            </div>

            {/* End-date card */}
            <motion.div
              className="mx-6 mb-4 rounded-xl p-4 flex items-center gap-4"
              style={{ backgroundColor: 'rgba(214,166,21,0.06)', border: '1px solid rgba(214,166,21,0.15)' }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(214,166,21,0.12)' }}
              >
                <CalendarClock className="w-6 h-6 text-harvest" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">
                  Active Until
                </p>
                <p className="text-lg font-black text-foreground">{endDateStr}</p>
                <p className="text-xs text-muted-foreground">
                  {daysLeft === 0 ? 'Ends today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`}
                </p>
              </div>
            </motion.div>

            {/* Reassurance */}
            <motion.div
              className="mx-6 mb-4 rounded-xl p-3 flex items-start gap-2.5"
              style={{ backgroundColor: 'rgba(127,156,0,0.06)', border: '1px solid rgba(127,156,0,0.12)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
            >
              <Heart className="w-4 h-4 text-husk flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                All your TCF+ perks — free registration, exclusive giveaways, bonus commands — remain active
                until {endDateStr}. Nothing changes until then.
              </p>
            </motion.div>

            {/* CTAs */}
            <motion.div
              className="px-6 pb-6 pt-1 space-y-2.5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              {/* Re-subscribe via portal */}
              <button
                onClick={handleResubscribe}
                disabled={portalLoading}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-harvest hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {portalLoading ? (
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 animate-pulse" />
                    Opening portal...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" />
                    Changed My Mind — Resubscribe
                  </span>
                )}
              </button>

              {/* Dismiss */}
              <button
                onClick={handleClose}
                className="w-full py-2.5 rounded-xl font-semibold text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                Got It
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
