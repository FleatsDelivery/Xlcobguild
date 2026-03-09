/**
 * Checkout Celebration Modal — a fun, animated success/cancel modal
 * shown when the user returns from Stripe Checkout.
 *
 * - Tickets & Donations: single-card celebration with receipt
 * - TCF+: multi-step onboarding wizard that walks users through every
 *   benefit they just unlocked. Can't dismiss until the final slide.
 * - Confetti is corn/popcorn themed 🌽
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Crown, Ticket, Trophy, Heart, ShoppingBag,
  Check, ChevronRight, ChevronLeft,
  Swords, Users, Gift, MessageCircle, Cake, TicketPlus, Package,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { loadCheckoutContext } from '@/lib/checkout-context';
import type { CheckoutContext } from '@/lib/checkout-context';

// ─── Config per product type ───────────────────────────

interface CelebrationConfig {
  title: string;
  subtitle: string;
  icon: typeof Crown;
  accentColor: string;
}

const SUCCESS_CONFIGS: Record<string, CelebrationConfig> = {
  tcf_plus: {
    title: 'Welcome to TCF+!',
    subtitle: "You're officially part of the inner circle.",
    icon: Crown,
    accentColor: '#d6a615',
  },
  ticket: {
    title: 'Tickets Secured!',
    subtitle: 'Locked, loaded, and ready for battle.',
    icon: Ticket,
    accentColor: '#3b82f6',
  },
  donation: {
    title: 'Prize Pool Boosted!',
    subtitle: "You just made someone's win even sweeter.",
    icon: Trophy,
    accentColor: '#f59e0b',
  },
  merch: {
    title: 'Order Placed!',
    subtitle: 'Your merch is on its way — check your email for shipping updates.',
    icon: Package,
    accentColor: '#a855f7',
  },
};

const CANCEL_CONFIG: CelebrationConfig = {
  title: 'No Worries',
  subtitle: 'Checkout cancelled — nothing was charged.',
  icon: ShoppingBag,
  accentColor: '#6b7280',
};

// ─── TCF+ Onboarding Steps ────────────────────────────

interface OnboardingStep {
  title: string;
  subtitle: string;
  icon: typeof Crown;
  iconColor: string;
  benefits?: { icon: typeof Crown; label: string; description: string }[];
  tip?: string;
}

const TCF_PLUS_STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to TCF+!',
    subtitle: "Here's everything you just unlocked. Let's walk through it.",
    icon: Crown,
    iconColor: '#d6a615',
    benefits: [
      { icon: Swords, label: 'Free KKup Registration', description: 'No ticket needed' },
      { icon: TicketPlus, label: 'Early Registration Window', description: 'Sign up before everyone else' },
      { icon: Users, label: 'Manage Up to 20 Teams', description: 'Up from 3 on the free tier' },
      { icon: Gift, label: 'Members-Only Giveaways', description: 'Exclusive prize pools' },
      { icon: MessageCircle, label: 'Discord & Twitch Perks', description: '/mvp, /mystats, TCF+ role' },
      { icon: Cake, label: 'Birthday Present', description: 'Free gift on your birthday' },
      { icon: Ticket, label: 'Bonus Ticket', description: '1 free ticket added to your wallet' },
    ],
  },
  {
    title: 'Free Registration',
    subtitle: 'Skip the ticket line entirely.',
    icon: Swords,
    iconColor: '#3b82f6',
    tip: "When a Kernel Kup opens for registration, you'll see a \"Register\" button instead of needing a ticket. Just click and you're in — no tickets consumed. You also get an early registration window before free-tier players, so you can lock in your spot first.",
  },
  {
    title: 'Teams & Giveaways',
    subtitle: 'Lead more teams, win more prizes.',
    icon: Users,
    iconColor: '#7f9c00',
    tip: "You can now create and manage up to 20 teams (free tier caps at 3). Perfect for running multiple rosters across tournaments. You're also eligible for members-only giveaways — these are separate from public giveaways and have better odds since only TCF+ members can enter.",
  },
  {
    title: 'Discord & Twitch',
    subtitle: 'Exclusive commands and roles.',
    icon: MessageCircle,
    iconColor: '#5865F2',
    tip: "You now have the TCF+ role on Discord and Twitch, unlocking exclusive channels and commands. Use /mvp in Discord to nominate standout players after matches. Use /mystats in Twitch chat to show off your Dota stats live on stream. These commands are TCF+ exclusive.",
  },
  {
    title: 'The Little Things',
    subtitle: 'Because details matter.',
    icon: Gift,
    iconColor: '#f59e0b',
    tip: "Opt in for a free birthday present — we'll send you something special on your day. You also got 1 bonus Kernel Kup ticket added to your wallet right now (even though you don't need tickets anymore, you can gift it to a friend). Keep an eye on the Secret Shop for more TCF+ perks as we add them.",
  },
];

// ─── Receipt builder ───────────────────────────────────

function buildReceiptLines(ctx: CheckoutContext | null, type: string | null, qty: number | null) {
  const lines: { label: string; value: string; highlight?: boolean }[] = [];
  if (!ctx) return lines;

  if (ctx.type === 'ticket') {
    const ticketQty = ctx.quantity || qty || 1;
    const subtotal = ticketQty * 5;
    const discount = ctx.discount || 0;
    const total = subtotal - discount;
    lines.push({ label: 'Tickets', value: `${ticketQty} × $5.00`, highlight: true });
    if (discount > 0) {
      lines.push({ label: 'Bulk Discount', value: `-$${discount.toFixed(2)}` });
    }
    lines.push({ label: 'Total', value: `$${total.toFixed(2)}` });
  }
  if (ctx.type === 'donation' && ctx.amount) {
    const prizePoolAmt = ctx.amount * 0.95;
    lines.push({ label: 'Donation', value: `$${ctx.amount.toFixed(2)}`, highlight: true });
    lines.push({ label: 'To Prize Pool (95%)', value: `$${prizePoolAmt.toFixed(2)}` });
    lines.push({ label: 'Platform Fee (5%)', value: `$${(ctx.amount * 0.05).toFixed(2)}` });
    if (ctx.tournamentName) {
      lines.push({ label: 'Tournament', value: ctx.tournamentName });
    }
  }
  if (ctx.type === 'tcf_plus') {
    lines.push({ label: 'Plan', value: 'TCF+ Membership', highlight: true });
    lines.push({ label: 'Billing', value: '$20.00 / year' });
  }
  if (ctx.type === 'merch') {
    const merchQty = ctx.quantity || 1;
    lines.push({ label: 'Item', value: ctx.productName || 'Merch', highlight: true });
    if (merchQty > 1) {
      lines.push({ label: 'Quantity', value: `${merchQty}` });
    }
    if (ctx.amount) {
      lines.push({ label: 'Total', value: `$${ctx.amount.toFixed(2)}` });
    }
  }

  return lines;
}

// ─── Corn Confetti 🌽 ─────────────────────────────────

function fireCornConfetti() {
  // canvas-confetti's shapeFromText creates emoji-shaped particles
  const corn = confetti.shapeFromText({ text: '🌽', scalar: 2 });
  const popcorn = confetti.shapeFromText({ text: '🍿', scalar: 2 });

  const defaults = {
    gravity: 0.85,
    ticks: 250,
    shapes: [corn, popcorn],
    scalar: 2,
    flat: true,
  };

  // Center burst
  confetti({
    ...defaults,
    particleCount: 35,
    spread: 80,
    origin: { y: 0.55 },
  });

  // Side cannons
  setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: 20,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
    });
    confetti({
      ...defaults,
      particleCount: 20,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
    });
  }, 150);

  // Follow-up rain
  setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: 15,
      spread: 120,
      origin: { y: 0.35 },
      gravity: 0.7,
    });
  }, 400);
}

// Regular confetti for tickets/donations
function fireRegularConfetti(colors: string[]) {
  if (!colors.length) return;

  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.55 },
    colors,
    gravity: 0.8,
    scalar: 1.1,
    ticks: 200,
  });

  setTimeout(() => {
    confetti({
      particleCount: 40,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors,
      gravity: 0.9,
      ticks: 180,
    });
    confetti({
      particleCount: 40,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors,
      gravity: 0.9,
      ticks: 180,
    });
  }, 150);
}

// ─── Helper to parse hash params ───────────────────────

function parseHashParams(): { status: 'success' | 'cancelled' | null; type: string | null; qty: number | null } {
  const hash = window.location.hash;
  if (!hash.includes('?')) return { status: null, type: null, qty: null };
  const queryPart = hash.split('?')[1] || '';
  const params = new URLSearchParams(queryPart);
  return {
    status: params.get('checkout') as 'success' | 'cancelled' | null,
    type: params.get('type'),
    qty: params.get('qty') ? parseInt(params.get('qty')!) : null,
  };
}

// ─── TCF+ Onboarding Wizard ───────────────────────────

function TcfPlusOnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const hasFired = useRef(false);
  const totalSteps = TCF_PLUS_STEPS.length;
  const current = TCF_PLUS_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === totalSteps - 1;

  // Fire corn confetti on first step
  useEffect(() => {
    if (!hasFired.current) {
      hasFired.current = true;
      setTimeout(() => fireCornConfetti(), 300);
    }
  }, []);

  const goNext = () => {
    if (isLast) {
      onComplete();
      return;
    }
    setDirection(1);
    setStep(s => s + 1);
  };

  const goBack = () => {
    if (isFirst) return;
    setDirection(-1);
    setStep(s => s - 1);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Backdrop — NOT clickable since we force them through */}
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />

      {/* Modal */}
      <motion.div
        className="relative bg-card rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 300, mass: 0.8 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="h-1.5 bg-muted">
          <motion.div
            className="h-full bg-gradient-to-r from-harvest via-kernel-gold to-harvest"
            initial={{ width: 0 }}
            animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          />
        </div>

        {/* Step counter */}
        <div className="flex items-center justify-between px-6 pt-4">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Step {step + 1} of {totalSteps}
          </span>
          {!isFirst && (
            <button
              onClick={goBack}
              className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-3 h-3" />
              Back
            </button>
          )}
        </div>

        {/* Animated step content */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {/* Hero */}
            <div className="relative px-6 pt-5 pb-4 text-center">
              {/* Glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 50% 40%, ${current.iconColor}12 0%, transparent 60%)`,
                }}
              />

              <motion.div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{
                  backgroundColor: `${current.iconColor}12`,
                  border: `2px solid ${current.iconColor}25`,
                }}
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 14, stiffness: 200 }}
              >
                <current.icon className="w-8 h-8" style={{ color: current.iconColor }} />
              </motion.div>

              <h3 className="text-xl sm:text-2xl font-black text-foreground mb-1">
                {current.title}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {current.subtitle}
              </p>
            </div>

            {/* Content area */}
            <div className="px-6 pb-2">
              {/* Step 1: benefit list */}
              {current.benefits && (
                <div className="space-y-2 mb-2">
                  {current.benefits.map((b, i) => (
                    <motion.div
                      key={b.label}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-harvest/5 border border-harvest/10"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${current.iconColor}10` }}
                      >
                        <b.icon className="w-4 h-4 text-harvest" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground leading-tight">{b.label}</p>
                        <p className="text-[10px] text-muted-foreground">{b.description}</p>
                      </div>
                      <Check className="w-3.5 h-3.5 text-husk flex-shrink-0" />
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Steps 2+: detailed tip */}
              {current.tip && (
                <motion.div
                  className="rounded-xl p-4 mb-2"
                  style={{
                    backgroundColor: `${current.iconColor}06`,
                    border: `1px solid ${current.iconColor}15`,
                  }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {current.tip}
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* CTA */}
        <div className="px-6 pb-6 pt-2">
          <button
            onClick={goNext}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-harvest hover:brightness-110 active:scale-[0.98] transition-all"
          >
            {isLast ? (
              <span className="flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                Let's Go!
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Continue
                <ChevronRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Simple Celebration Modal (tickets, donations, cancel) ──

function SimpleCelebrationModal({
  config,
  isSuccess,
  resolvedType,
  receiptLines,
  qty,
  onClose,
}: {
  config: CelebrationConfig;
  isSuccess: boolean;
  resolvedType: string | null;
  receiptLines: { label: string; value: string; highlight?: boolean }[];
  qty: number | null;
  onClose: () => void;
}) {
  const hasFired = useRef(false);
  const [visible, setVisible] = useState(true);

  const confettiColors: Record<string, string[]> = {
    ticket: ['#3b82f6', '#60a5fa', '#2563eb', '#93c5fd'],
    donation: ['#f59e0b', '#f1c60f', '#d6a615', '#fbbf24'],
    merch: ['#a855f7', '#c084fc', '#7c3aed', '#e9d5ff'],
  };

  useEffect(() => {
    if (isSuccess && !hasFired.current) {
      hasFired.current = true;
      const colors = confettiColors[resolvedType || ''] || [];
      setTimeout(() => fireRegularConfetti(colors), 250);
    }
  }, [isSuccess, resolvedType]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />

          {/* Modal card */}
          <motion.div
            className="relative bg-card rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradient bar */}
            <motion.div
              className="h-1.5"
              style={{
                background: `linear-gradient(90deg, ${config.accentColor}66, ${config.accentColor}, ${config.accentColor}66)`,
              }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            />

            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-muted hover:bg-border flex items-center justify-center transition-all z-10"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Hero */}
            <div className="relative px-6 pt-8 pb-5 text-center overflow-hidden">
              {isSuccess && (
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at 50% 40%, ${config.accentColor}15 0%, transparent 60%)`,
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8 }}
                />
              )}

              <motion.div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{
                  backgroundColor: `${config.accentColor}15`,
                  border: `2px solid ${config.accentColor}30`,
                }}
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.15 }}
              >
                <config.icon className="w-10 h-10" style={{ color: config.accentColor }} />
              </motion.div>

              <motion.h3
                className="text-2xl sm:text-3xl font-black text-foreground mb-1.5"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
              >
                {config.title}
              </motion.h3>

              <motion.p
                className="text-sm text-muted-foreground"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.4 }}
              >
                {config.subtitle}
              </motion.p>
            </div>

            {/* Receipt */}
            {receiptLines.length > 0 && (
              <motion.div
                className="mx-6 mb-4 rounded-xl p-4 space-y-2.5"
                style={{
                  backgroundColor: `${config.accentColor}08`,
                  border: `1px solid ${config.accentColor}20`,
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.4 }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Receipt
                </p>
                {receiptLines.map((line, i) => (
                  <motion.div
                    key={line.label}
                    className="flex items-center justify-between text-xs"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.06 }}
                  >
                    <span className="text-muted-foreground">{line.label}</span>
                    <span className={line.highlight
                      ? 'font-bold text-foreground'
                      : 'font-semibold text-muted-foreground'
                    }>
                      {line.value}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Contextual help text */}
            {isSuccess && resolvedType === 'ticket' && (
              <motion.div
                className="mx-6 mb-4 rounded-xl p-3"
                style={{
                  backgroundColor: `${config.accentColor}06`,
                  border: `1px solid ${config.accentColor}12`,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
              >
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tickets will appear in your wallet once the payment is confirmed. This usually takes a few seconds.
                </p>
              </motion.div>
            )}

            {isSuccess && resolvedType === 'donation' && (
              <motion.div
                className="mx-6 mb-4 flex items-center gap-2.5 rounded-xl p-3"
                style={{
                  backgroundColor: `${config.accentColor}06`,
                  border: `1px solid ${config.accentColor}12`,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.65 }}
              >
                <Heart className="w-4 h-4 flex-shrink-0" style={{ color: config.accentColor }} />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  95% goes directly to the prize pool. The competitors thank you for fueling the competition.
                </p>
              </motion.div>
            )}

            {/* CTA */}
            <motion.div
              className="px-6 pb-6 pt-1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.3 }}
            >
              <button
                onClick={handleClose}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ backgroundColor: config.accentColor }}
              >
                {isSuccess ? (
                  <span className="flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" />
                    Let's Go!
                  </span>
                ) : (
                  'Back to the Shop'
                )}
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main exported component ───────────────────────────

interface Props {
  onClose: () => void;
  /** Pre-parsed checkout status from the parent (uses initialHash fallback) */
  checkoutStatus?: 'success' | 'cancelled' | null;
  /** Pre-parsed checkout type from the parent */
  checkoutType?: string | null;
  /** Pre-parsed quantity from the parent */
  checkoutQty?: number | null;
}

export function CheckoutCelebrationModal({ onClose, checkoutStatus, checkoutType, checkoutQty }: Props) {
  // Use props if provided (preferred — parent already parsed with initialHash fallback),
  // otherwise fall back to own hash parsing for backwards compatibility.
  const hashParsed = parseHashParams();
  const status = checkoutStatus ?? hashParsed.status;
  const type = checkoutType ?? hashParsed.type;
  const qty = checkoutQty ?? hashParsed.qty;
  const ctx = loadCheckoutContext();

  const resolvedType = type || ctx?.type || null;
  const isSuccess = status === 'success';
  const config = isSuccess
    ? (SUCCESS_CONFIGS[resolvedType || ''] || SUCCESS_CONFIGS.ticket)
    : CANCEL_CONFIG;

  const receiptLines = isSuccess ? buildReceiptLines(ctx, resolvedType, qty) : [];

  if (!status) return null;

  // TCF+ success → multi-step onboarding wizard
  if (isSuccess && resolvedType === 'tcf_plus') {
    return <TcfPlusOnboardingWizard onComplete={onClose} />;
  }

  // Everything else → simple single-card modal
  return (
    <SimpleCelebrationModal
      config={config}
      isSuccess={isSuccess}
      resolvedType={resolvedType}
      receiptLines={receiptLines}
      qty={qty}
      onClose={onClose}
    />
  );
}