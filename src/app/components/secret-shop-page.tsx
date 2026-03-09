/**
 * Secret Shop Page — The Corn Field's store.
 *
 * Sections:
 *   1. Memberships  — Free vs TCF+ ($20/yr) comparison
 *   2. Kernel Kup   — Tournament ticket purchasing
 *   3. Donations    — General + KK-specific prize pool donations
 *   4. Merch        — Printful products
 *   5. Transparency — Where the money goes
 *
 * Stripe Checkout Sessions are created via the server for tickets, TCF+, and donations.
 */

import { useState, useEffect } from 'react';
import {
  ShoppingBag, Check, X, Crown, Ticket,
  Heart, Trophy, ChevronRight, Sparkles,
  ExternalLink, Lock, Users, Loader2, Package,
  Minus, Plus, CreditCard, Wallet, CalendarClock, ArrowRight,
  Clock, Gift, TrendingUp, ShoppingCart, Scale, PieChart,
} from 'lucide-react';
import { Footer } from '@/app/components/footer';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { createCheckoutSession, openCustomerPortal, fetchSubscriptionStatus } from '@/lib/stripe';
import type { SubscriptionStatus } from '@/lib/stripe';
import { DonatePrizePoolModal } from '@/app/components/donate-prize-pool-modal';
import { saveCheckoutContext, loadCheckoutContext, clearCheckoutContext } from '@/lib/checkout-context';
import type { CheckoutContext } from '@/lib/checkout-context';
import { loadCheckoutResult, clearCheckoutResult } from '@/lib/checkout-context';
import { CheckoutCelebrationModal } from '@/app/components/checkout-celebration-modal';
import { MembershipFarewellModal, hasFarewellBeenSeen, clearFarewellSeen } from '@/app/components/membership-farewell-modal';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { timeAgo } from '@/lib/date-utils';
import { MerchProductModal } from '@/app/components/merch-product-modal';

// ═══════════════════════════════════════════════════════
// CHECKOUT RESULT DETECTION
// ═══════════════════════════════════════════════════════

/**
 * Check whether a checkout result is waiting in localStorage.
 * Written by App.tsx when Stripe redirects back with ?checkout= query params.
 * This replaces the old hash-based detection which was unreliable because
 * URL fragments don't survive Stripe's redirect chain.
 */
function shouldShowCheckoutResult(): boolean {
  const result = loadCheckoutResult();
  return result !== null;
}

// ═══════════════════════════════════════════════════════
// MEMBERSHIP TIER CONFIG
// ═══════════════════════════════════════════════════════

interface PerkItem {
  label: string;
  included: boolean;
  highlight?: boolean;
}

interface MembershipTier {
  id: string;
  name: string;
  price: string;
  priceNote: string;
  description: string;
  featured: boolean;
  includesFreeNote?: boolean;
  perks: PerkItem[];
}

const MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    priceNote: 'forever',
    description: 'Everything you need to participate in the community and compete in Kernel Kups.',
    featured: false,
    perks: [
      { label: 'Kernel Kup registration (ticket required)', included: true },
      { label: 'Create & manage up to 3 teams', included: true },
      { label: 'Join a guild or play solo in Guild Wars', included: true },
      { label: 'Enter public giveaways', included: true },
      { label: 'Play as player, coach, or staff', included: true },
      { label: 'Custom game GitHub repos', included: true },
      { label: 'Most Discord & Twitch bot commands', included: true },
    ],
  },
  {
    id: 'tcf-plus',
    name: 'TCF+',
    price: '$20',
    priceNote: '/ year',
    description: 'The elevated experience. Skip the ticket line, lead your own guild, and unlock exclusive perks.',
    featured: true,
    includesFreeNote: true,
    perks: [
      { label: 'Free KKup registration (no ticket needed)', included: true, highlight: true },
      { label: 'Early KKup registration window', included: true, highlight: true },
      { label: 'Create & manage up to 20 teams', included: true, highlight: true },
      { label: 'Members-only giveaway eligibility', included: true, highlight: true },
      { label: 'Exclusive Discord & Twitch roles (TCF+)', included: true, highlight: true },
      { label: '/mvp Discord command', included: true, highlight: true },
      { label: '/mystats Twitch command', included: true, highlight: true },
      { label: 'Free birthday present (opt-in)', included: true, highlight: true },
      { label: '1 bonus KKup ticket on signup', included: true, highlight: true },
    ],
  },
];

// ═══════════════════════════════════════════════════════
// STRIPE CHECKOUT BUTTON
// ═══════════════════════════════════════════════════════

function StripeCheckoutButton({ type, quantity, amount, label }: {
  type: string;
  quantity?: number;
  amount?: number;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      // Save checkout context to localStorage before redirecting
      saveCheckoutContext({
        type: type as CheckoutContext['type'],
        quantity,
        amount: amount ? amount / 100 : type === 'ticket' ? (quantity || 1) * TICKET_PRICE : undefined,
        discount: type === 'ticket' ? (getBulkDiscount(quantity || 1)?.discountDollars ?? undefined) : undefined,
      });
      const url = await createCheckoutSession({ type, quantity, amount });
      window.location.href = url;
    } catch (err: any) {
      console.error('Failed to create Stripe Checkout session:', err);
      setError(err.message);
      clearCheckoutContext();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-harvest text-silk hover:bg-deep-corn transition-colors disabled:opacity-50"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <>
            {label || (type === 'ticket' ? 'Buy' : type === 'tcf_plus' ? 'Subscribe' : 'Donate')}
            <ChevronRight className="w-3 h-3" />
          </>
        )}
      </button>
      {error && (
        <p className="text-[10px] text-error mt-1">{error}</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MEMBERSHIP CARD
// ═══════════════════════════════════════════════════════

function MembershipCard({ tier, user, subscriptionStatus }: { tier: MembershipTier; user: any; subscriptionStatus: SubscriptionStatus | null }) {
  const isTcfPlus = tier.featured;
  const isSubscribed = user?.tcf_plus_active === true;
  const isCancelling = subscriptionStatus?.cancel_at_period_end === true;
  const [portalLoading, setPortalLoading] = useState(false);

  const handleManage = async () => {
    setPortalLoading(true);
    try {
      const url = await openCustomerPortal();
      window.location.href = url;
    } catch (err: any) {
      console.error('Failed to open customer portal:', err);
    } finally {
      setPortalLoading(false);
    }
  };

  // Format cancellation end date
  const cancelEndDate = isCancelling && subscriptionStatus?.current_period_end
    ? new Date(subscriptionStatus.current_period_end * 1000)
    : null;
  const cancelEndStr = cancelEndDate
    ? cancelEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const cancelDaysLeft = cancelEndDate
    ? Math.max(0, Math.ceil((cancelEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div
      className={`relative rounded-2xl border-2 overflow-hidden transition-all ${
        isTcfPlus
          ? isCancelling
            ? 'border-harvest/40 bg-card shadow-lg'
            : 'border-harvest bg-card shadow-lg'
          : 'border-border bg-card'
      }`}
    >
      {/* Featured badge */}
      {isTcfPlus && !isCancelling && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-harvest via-kernel-gold to-harvest" />
      )}
      {isTcfPlus && isCancelling && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-harvest/40 via-harvest/60 to-harvest/40" />
      )}

      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          {isTcfPlus ? (
            <Crown className={`w-5 h-5 ${isCancelling ? 'text-harvest/60' : 'text-harvest'}`} />
          ) : (
            <Users className="w-5 h-5 text-muted-foreground" />
          )}
          <h3 className={`text-lg sm:text-xl font-black ${isTcfPlus ? (isCancelling ? 'text-harvest/70' : 'text-harvest') : 'text-foreground'}`}>
            {tier.name}
          </h3>
          {isTcfPlus && isSubscribed && !isCancelling && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-husk/15 text-husk">
              ACTIVE
            </span>
          )}
          {isTcfPlus && isCancelling && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f59e0b]/15 text-[#f59e0b]">
              CANCELLING
            </span>
          )}
          {isTcfPlus && !isSubscribed && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-harvest/15 text-harvest">
              RECOMMENDED
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-3xl sm:text-4xl font-black text-foreground">{tier.price}</span>
          <span className="text-sm text-muted-foreground font-medium">{tier.priceNote}</span>
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-4 sm:mb-5">
          {tier.description}
        </p>

        {/* Cancellation Banner */}
        {isTcfPlus && isCancelling && cancelEndStr && (
          <div className="mb-4 rounded-xl p-3 sm:p-4 bg-[#f59e0b]/8 border border-[#f59e0b]/15">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#f59e0b]/12">
                <CalendarClock className="w-4.5 h-4.5 text-[#f59e0b]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground mb-0.5">
                  Active until {cancelEndStr}
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {cancelDaysLeft === 0
                    ? 'Your membership ends today.'
                    : `${cancelDaysLeft} day${cancelDaysLeft !== 1 ? 's' : ''} remaining. All perks stay active until then.`}
                </p>
              </div>
            </div>
            <button
              onClick={handleManage}
              disabled={portalLoading}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-harvest text-silk hover:bg-deep-corn transition-colors disabled:opacity-50"
            >
              {portalLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <ArrowRight className="w-3 h-3" />
                  Resubscribe
                </>
              )}
            </button>
          </div>
        )}

        {/* CTA */}
        {isTcfPlus ? (
          isSubscribed && !isCancelling ? (
            <div className="flex flex-col sm:flex-row items-start gap-2">
              <div className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-husk/10 text-sm font-bold text-husk">
                <Check className="w-4 h-4" />
                Active Member
              </div>
              <button
                onClick={handleManage}
                disabled={portalLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                {portalLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />}
                Manage Subscription
              </button>
            </div>
          ) : isCancelling ? (
            // Already shown resubscribe button above in the banner
            null
          ) : (
            <StripeCheckoutButton type="tcf_plus" label="Subscribe" />
          )
        ) : (
          <div className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-muted text-sm font-bold text-muted-foreground">
            <Check className="w-4 h-4" />
            {isSubscribed ? 'Included' : 'Your Current Plan'}
          </div>
        )}

        {/* Perks list */}
        <div className="mt-5 sm:mt-6 space-y-2.5">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">What's included</p>

          {/* "All Free Tier Benefits" note for TCF+ */}
          {tier.includesFreeNote && (
            <div className="flex items-center gap-2.5 pb-1 mb-1 border-b border-border">
              <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 bg-husk/15">
                <Check className="w-2.5 h-2.5 text-husk" />
              </div>
              <span className="text-xs sm:text-sm leading-snug text-foreground font-medium italic">
                All Free Tier benefits, plus:
              </span>
            </div>
          )}

          {tier.perks.map((perk) => (
            <div key={perk.label} className="flex items-start gap-2.5">
              {perk.included ? (
                <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  perk.highlight ? 'bg-harvest/15' : 'bg-husk/15'
                }`}>
                  <Check className={`w-2.5 h-2.5 ${perk.highlight ? 'text-harvest' : 'text-husk'}`} />
                </div>
              ) : (
                <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-muted">
                  <X className="w-2.5 h-2.5 text-muted-foreground/50" />
                </div>
              )}
              <span className={`text-xs sm:text-sm leading-snug ${
                perk.included
                  ? perk.highlight
                    ? 'text-foreground font-semibold'
                    : 'text-foreground'
                  : 'text-muted-foreground/60 line-through'
              }`}>
                {perk.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════���═══
// SECTION HEADER
// ═══════════════════════════════════════════════════════

function SectionHeader({
  icon: Icon,
  iconColor,
  title,
  subtitle,
}: {
  icon: typeof ShoppingBag;
  iconColor: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4 sm:mb-5">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${iconColor}15`, border: `1.5px solid ${iconColor}25` }}
      >
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
      </div>
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-foreground">{title}</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TICKET PRICE
// ═══════════════════════════════════════════════════════

const TICKET_PRICE = 5; // $5 per ticket

// Bulk discount tiers — mirrors server-side BULK_DISCOUNTS config
const BULK_DISCOUNT_TIERS = [
  { minQty: 10, discountDollars: 2 },
  { minQty: 5,  discountDollars: 1 },
] as const; // ordered high-to-low so first match wins

/** Returns the bulk discount for a given quantity, or null if none applies. */
function getBulkDiscount(qty: number): { discountDollars: number; totalBefore: number; totalAfter: number } | null {
  const tier = BULK_DISCOUNT_TIERS.find(t => qty >= t.minQty);
  if (!tier) return null;
  const totalBefore = qty * TICKET_PRICE;
  return {
    discountDollars: tier.discountDollars,
    totalBefore,
    totalAfter: totalBefore - tier.discountDollars,
  };
}

// ═══════════════════════════════════════════════════════
// PRINTFUL PRODUCT TYPES
// ═══════════════════════════════════════════════════════

interface PrintfulProduct {
  id: number;
  name: string;
  thumbnail_url: string;
  variants: {
    id: number;
    name: string;
    retail_price: string;
    preview_url: string | null;
  }[];
  retail_price_range: { min: string; max: string };
}

// ═══════════════════════════════════════════════════════
// MERCH PRODUCT CARD
// ═══════════════════════════════════════════════════════

function MerchProductCard({ product, onSelect }: { product: PrintfulProduct; onSelect: (product: PrintfulProduct) => void }) {
  const minPrice = parseFloat(product.retail_price_range.min);
  const maxPrice = parseFloat(product.retail_price_range.max);
  const priceStr = minPrice > 0
    ? minPrice === maxPrice
      ? `$${minPrice.toFixed(2)}`
      : `$${minPrice.toFixed(2)} – $${maxPrice.toFixed(2)}`
    : 'TBD';

  // Find best preview image: first variant with a preview_url, or thumbnail
  const previewImage = product.variants.find(v => v.preview_url)?.preview_url || product.thumbnail_url;
  const variantCount = product.variants.length;

  return (
    <div
      className="bg-card rounded-xl border-2 border-border overflow-hidden transition-all hover:border-harvest/30 hover:shadow-lg cursor-pointer group"
      onClick={() => onSelect(product)}
    >
      {previewImage && (
        <div className="w-full aspect-square bg-muted overflow-hidden relative">
          <ImageWithFallback
            src={previewImage}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            width={400}
            height={400}
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-harvest text-silk px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-lg">
              <ShoppingCart className="w-3.5 h-3.5" />
              View Details
            </div>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <h4 className="text-sm sm:text-base font-bold text-foreground">{product.name}</h4>
          {variantCount > 1 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#a855f7]/10 text-[#a855f7]">
              {variantCount} options
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-base sm:text-lg font-black text-foreground">{priceStr}</span>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-harvest text-silk hover:bg-deep-corn transition-colors"
            onClick={(e) => { e.stopPropagation(); onSelect(product); }}
          >
            <ShoppingCart className="w-3 h-3" />
            Buy
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════

export function SecretShopPage({ user }: { user: any }) {
  const [ticketQty, setTicketQty] = useState(1);
  const [showCheckoutResult, setShowCheckoutResult] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [showFarewellModal, setShowFarewellModal] = useState(false);
  const [nextTournament, setNextTournament] = useState<{ id: string; name: string; start_date: string; prize_pool: number; prize_pool_donations: number } | null>(null);
  const [merchProducts, setMerchProducts] = useState<PrintfulProduct[]>([]);
  const [merchLoading, setMerchLoading] = useState(true);
  const [merchError, setMerchError] = useState<string | null>(null);
  const [selectedMerchProduct, setSelectedMerchProduct] = useState<PrintfulProduct | null>(null);

  // Fetch next upcoming tournament for donation context
  useEffect(() => {
    const fetchNext = async () => {
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/next-upcoming`,
          { headers: { 'Authorization': `Bearer ${publicAnonKey}` } },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.tournament) setNextTournament(data.tournament);
      } catch (err) {
        console.error('Failed to fetch next upcoming tournament:', err);
      }
    };
    fetchNext();
  }, []);

  // Check for checkout result on mount
  useEffect(() => {
    if (shouldShowCheckoutResult()) {
      setShowCheckoutResult(true);
    }
  }, []);

  const handleCloseCheckoutResult = () => {
    setShowCheckoutResult(false);
    clearCheckoutContext();
    clearCheckoutResult();
    // Clean the hash — strip query params, keep just #secret-shop
    window.location.hash = '#secret-shop';
  };

  // Fetch Printful products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/printful/products`,
          { headers: { 'Authorization': `Bearer ${publicAnonKey}` } },
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setMerchProducts(data.products || []);
      } catch (err: any) {
        console.error('Failed to fetch Printful products:', err);
        setMerchError(err.message);
      } finally {
        setMerchLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Fetch subscription status on mount (if user is TCF+)
  useEffect(() => {
    if (!user?.tcf_plus_active) return;

    const fetchStatus = async () => {
      try {
        const status = await fetchSubscriptionStatus();
        setSubscriptionStatus(status);

        // Show farewell modal if cancelling and not previously dismissed
        if (status?.cancel_at_period_end && !hasFarewellBeenSeen()) {
          setShowFarewellModal(true);
        }
      } catch (err) {
        console.error('Failed to fetch subscription status:', err);
      }
    };
    fetchStatus();
  }, [user?.tcf_plus_active]);

  return (
    <div className="px-3 sm:px-4 py-4 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">

        {/* Hero Banner */}
        <div className="relative bg-gradient-to-br from-harvest/20 to-kernel-gold/10 rounded-2xl sm:rounded-3xl p-6 sm:p-10 border-2 border-harvest/20 overflow-hidden">
          <div className="relative z-10 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-harvest/15 border-2 border-harvest/25 flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-7 h-7 sm:w-8 sm:h-8 text-harvest" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-2">
              The Secret Shop
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Memberships, tournament tickets, merch, and more.
              Support The Corn Field and gear up for the next Kernel Kup.
            </p>
          </div>
        </div>

        {/* Checkout celebration modal */}
        {showCheckoutResult && (() => {
          const parsed = loadCheckoutResult();
          if (!parsed) return null;
          return (
            <CheckoutCelebrationModal
              onClose={handleCloseCheckoutResult}
              checkoutStatus={parsed.status}
              checkoutType={parsed.type}
              checkoutQty={parsed.qty}
            />
          );
        })()}

        {/* Farewell modal */}
        {showFarewellModal && (
          <MembershipFarewellModal onClose={() => { setShowFarewellModal(false); }} />
        )}

        {/* Section 1: Memberships */}
        <div>
          <SectionHeader
            icon={Crown}
            iconColor="#d6a615"
            title="Memberships"
            subtitle="Free vs TCF+ — choose your tier"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {MEMBERSHIP_TIERS.map((tier) => (
              <MembershipCard key={tier.id} tier={tier} user={user} subscriptionStatus={subscriptionStatus} />
            ))}
          </div>
        </div>

        {/* Section 2: Tournament Tickets */}
        <div>
          <SectionHeader
            icon={Ticket}
            iconColor="#10b981"
            title="Kernel Kup Tickets"
            subtitle="Your entry into the next tournament"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* Purchase Tickets Card */}
            <div className="bg-card rounded-2xl border-2 border-border p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#10b981]/10 flex items-center justify-center flex-shrink-0">
                  <Ticket className="w-4 h-4 text-[#10b981]" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">Purchase Tickets</h3>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-4">
                Each ticket grants entry into one Kernel Kup tournament.
                {user?.tcf_plus_active && (
                  <span className="text-harvest font-semibold"> TCF+ members get free entry — you don't need tickets!</span>
                )}
              </p>

              <div className="flex items-center gap-3">
                {/* Quantity selector */}
                <div className="flex items-center gap-1 bg-muted rounded-xl px-1 py-1">
                  <button
                    onClick={() => setTicketQty(Math.max(1, ticketQty - 1))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-foreground">{ticketQty}</span>
                  <button
                    onClick={() => setTicketQty(Math.min(10, ticketQty + 1))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Price — with discount display */}
                {(() => {
                  const discount = getBulkDiscount(ticketQty);
                  if (discount) {
                    return (
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="text-sm text-muted-foreground line-through font-semibold">
                          ${discount.totalBefore.toFixed(2)}
                        </span>
                        <span className="text-lg sm:text-xl font-black text-[#10b981]">
                          ${discount.totalAfter.toFixed(2)}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <span className="text-lg sm:text-xl font-black text-foreground whitespace-nowrap">
                      ${(ticketQty * TICKET_PRICE).toFixed(2)}
                    </span>
                  );
                })()}

                {/* Buy button */}
                <StripeCheckoutButton
                  type="ticket"
                  quantity={ticketQty}
                  label={`Buy ${ticketQty > 1 ? `${ticketQty} Tickets` : 'Ticket'}`}
                />
              </div>

              {/* Bulk discount hint */}
              {(() => {
                const discount = getBulkDiscount(ticketQty);
                if (discount) {
                  return (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#10b981]/8 border border-[#10b981]/15">
                      <Sparkles className="w-3.5 h-3.5 text-[#10b981] flex-shrink-0" />
                      <p className="text-[10px] sm:text-xs text-[#10b981] font-semibold">
                        Bulk discount — saving ${discount.discountDollars.toFixed(2)}!
                      </p>
                    </div>
                  );
                }
                // Show the next discount tier as a nudge
                const nextTier = BULK_DISCOUNT_TIERS.slice().reverse().find(t => ticketQty < t.minQty);
                if (nextTier && ticketQty >= 2) {
                  return (
                    <p className="mt-2 text-[10px] sm:text-xs text-muted-foreground">
                      Buy {nextTier.minQty}+ at once to save ${nextTier.discountDollars.toFixed(2)}
                    </p>
                  );
                }
                return null;
              })()}
            </div>

            {/* Ticket Wallet Card */}
            <div className="bg-card rounded-2xl border-2 border-border p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#10b981]/10 flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-4 h-4 text-[#10b981]" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">Ticket Wallet</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* Current Balance */}
                <div className="bg-[#10b981]/5 border border-[#10b981]/15 rounded-xl p-3 sm:p-4 text-center">
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Current Balance</p>
                  <p className="text-2xl sm:text-3xl font-black text-[#10b981]">
                    {user?.kkup_tickets ?? 0}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                    ticket{(user?.kkup_tickets ?? 0) !== 1 ? 's' : ''} available
                  </p>
                </div>

                {/* Lifetime Purchased */}
                <div className="bg-muted/50 border border-border rounded-xl p-3 sm:p-4 text-center">
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">All-Time</p>
                  <p className="text-2xl sm:text-3xl font-black text-foreground">
                    {user?.total_tickets_purchased ?? 0}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                    ticket{(user?.total_tickets_purchased ?? 0) !== 1 ? 's' : ''} purchased
                  </p>
                </div>
              </div>

              {/* Punchcard Progress */}
              {(() => {
                const lifetime = user?.total_tickets_purchased ?? 0;
                const progressInCurrentCycle = lifetime % 10;
                const nextMilestone = (Math.floor(lifetime / 10) + 1) * 10;
                const bonusEarned = Math.floor(lifetime / 10);
                return (
                  <div className="mt-3 px-3 py-2.5 rounded-xl bg-harvest/5 border border-harvest/15">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5 text-harvest flex-shrink-0" />
                        <span className="text-[10px] sm:text-xs font-bold text-foreground">Ticket Punchcard</span>
                      </div>
                      <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold">
                        {progressInCurrentCycle}/10 → free ticket
                      </span>
                    </div>
                    {/* Dot-based punchcard */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div
                          key={i}
                          className={`flex-1 h-2 rounded-full transition-colors ${
                            i < progressInCurrentCycle
                              ? 'bg-harvest'
                              : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    {bonusEarned > 0 && (
                      <p className="text-[10px] text-harvest font-semibold mt-1.5">
                        {bonusEarned} bonus ticket{bonusEarned !== 1 ? 's' : ''} earned so far!
                      </p>
                    )}
                  </div>
                );
              })()}

              {user?.tcf_plus_active && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-harvest/8 border border-harvest/15">
                  <Crown className="w-3.5 h-3.5 text-harvest flex-shrink-0" />
                  <p className="text-[10px] sm:text-xs text-harvest font-semibold">
                    TCF+ — free entry to every Kernel Kup
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Donations */}
        <div>
          <SectionHeader
            icon={Heart}
            iconColor="#ef4444"
            title="Fuel the Prize Pool"
            subtitle="Every dollar goes further than you think"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* Donate Card */}
            <div className="bg-card rounded-2xl border-2 border-border p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#ef4444]/10 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-4 h-4 text-[#ef4444]" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">Prize Pool Donation</h3>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-4">
                95% of your donation goes directly to the tournament prize pool. 5% helps cover platform costs.
                {nextTournament && (
                  <span className="block mt-1 text-harvest font-semibold">
                    Next up: {nextTournament.name}
                  </span>
                )}
              </p>
              <button
                onClick={() => setShowDonateModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-harvest text-silk hover:bg-deep-corn transition-colors"
              >
                <Heart className="w-4 h-4" />
                Donate
              </button>
            </div>

            {/* Donation Summary Card */}
            <div className="bg-card rounded-2xl border-2 border-border p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#ef4444]/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-[#ef4444]" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground">Your Contributions</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* Total Donated */}
                <div className="bg-[#10b981]/5 border border-[#10b981]/15 rounded-xl p-3 sm:p-4 text-center">
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Total Donated</p>
                  <p className="text-2xl sm:text-3xl font-black text-[#10b981]">
                    ${((user?.total_donations_amount ?? 0) as number).toFixed(2)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                    lifetime
                  </p>
                </div>

                {/* Most Recent Donation */}
                <div className="bg-muted/50 border border-border rounded-xl p-3 sm:p-4 text-center">
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Last Donation</p>
                  {user?.most_recent_donation ? (
                    <>
                      <p className="text-lg sm:text-xl font-black text-foreground">
                        {timeAgo(user.most_recent_donation)}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                        {new Date(user.most_recent_donation).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg sm:text-xl font-black text-muted-foreground/40">—</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                        no donations yet
                      </p>
                    </>
                  )}
                </div>
              </div>

              {(user?.total_donations_amount ?? 0) > 0 && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#ef4444]/5 border border-[#ef4444]/10">
                  <Gift className="w-3.5 h-3.5 text-[#ef4444] flex-shrink-0" />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">${((user.total_donations_amount ?? 0) * 0.95).toFixed(2)}</span> went directly to prize pools
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Donate Modal */}
        {showDonateModal && (
          <DonatePrizePoolModal onClose={() => setShowDonateModal(false)} />
        )}

        {/* Section 4: Merch (Printful products) */}
        <div>
          <SectionHeader
            icon={Package}
            iconColor="#a855f7"
            title="Merch"
            subtitle="Rep The Corn Field IRL"
          />

          {merchLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Loading merch...</span>
            </div>
          ) : merchError ? (
            <div className="bg-card rounded-xl border-2 border-border p-6 text-center">
              <Package className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Couldn't load merch right now. Check back soon!
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">{merchError}</p>
            </div>
          ) : merchProducts.length === 0 ? (
            <div className="bg-card rounded-xl border-2 border-border p-6 text-center">
              <Package className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No merch available yet — products are coming soon!
              </p>
            </div>
          ) : (
            <div className={`grid gap-3 ${
              merchProducts.length === 1
                ? 'grid-cols-1 max-w-md'
                : merchProducts.length === 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            }`}>
              {merchProducts.map((product) => (
                <MerchProductCard key={product.id} product={product} onSelect={(product) => { setSelectedMerchProduct(product); }} />
              ))}
            </div>
          )}

          <p className="text-[10px] sm:text-xs text-muted-foreground mt-2.5 pl-1 italic">
            All merch is printed and shipped via Printful. More products coming soon.
          </p>
        </div>

        {/* Merch Product Modal */}
        {selectedMerchProduct && (
          <MerchProductModal
            product={selectedMerchProduct}
            onClose={() => setSelectedMerchProduct(null)}
          />
        )}

        {/* Section 5: Where The Money Goes — Summary */}
        <div className="bg-card rounded-2xl border-2 border-border p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-harvest/10 border border-harvest/20">
              <Scale className="w-5 h-5 text-harvest" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">Where The Money Goes</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Full financial transparency</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-harvest/15 bg-harvest/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <PieChart className="w-3.5 h-3.5 text-harvest" />
                <span className="text-sm font-black text-harvest">95%</span>
                <span className="text-xs font-bold text-foreground">Community Pool</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Prize pools, giveaway prizes, refunds, and reinvesting in the community. Lives in the Stripe balance.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2 mb-1">
                <PieChart className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm font-black text-foreground">5%</span>
                <span className="text-xs font-bold text-foreground">Operations</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Figma, hosting, APIs, domain — the infrastructure that keeps TCF running.
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Every dollar follows the same 95/5 split — tickets, memberships, donations, and merch margins.
            No hidden fees. No salaries. Just a community-funded project run by one person.
          </p>

          <a
            href="#transparency"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-harvest hover:text-deep-corn transition-colors"
          >
            Read the full breakdown
            <ChevronRight className="w-3 h-3" />
          </a>
        </div>

        {/* Bottom CTA */}
        <div className="bg-card rounded-2xl border-2 border-border p-6 sm:p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-harvest/10 border-2 border-harvest/20 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-harvest" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2">More Coming Soon</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4 leading-relaxed">
            We're always cooking up new ways to support and reward the community.
            Check back regularly for new offerings.
          </p>
        </div>

        <Footer />
      </div>
    </div>
  );
}