/**
 * Transparency Page — "Where The Money Goes"
 *
 * Full financial transparency for The Corn Field community.
 * Covers the 95/5 rule, revenue breakdown, operating costs,
 * prize pools, giveaways, refund policy, and community wishlist.
 */

import {
  DollarSign, PieChart, Server, Ticket, Crown, Heart,
  Package, Gift, Shield, RefreshCw, Lightbulb, User,
  ExternalLink, ArrowRight, Percent, CreditCard, Globe,
  Gamepad2, MessageSquare, Monitor, Database, Palette,
  HelpCircle, Sparkles, Scale, Wallet, Trophy,
  Clock, Banknote, UserCheck,
} from 'lucide-react';
import { Footer } from '@/app/components/footer';
import { PRIZE_POOL_CONFIG, BASE_POOL_TOTAL } from '@/app/components/tournament-hub-prizes';

// ═══════════════════════════════════════════════════════
// SECTION WRAPPER
// ═══════════════════════════════════════════════════════

function Section({
  id,
  icon: Icon,
  iconColor,
  title,
  subtitle,
  children,
}: {
  id?: string;
  icon: typeof DollarSign;
  iconColor: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="bg-card rounded-2xl border-2 border-border p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4 sm:mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${iconColor}15`, border: `1.5px solid ${iconColor}25` }}
        >
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

// ═══════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════

const REVENUE_BREAKDOWN = [
  {
    product: 'Kernel Kup Ticket',
    price: '$5.00',
    stripeFee: '~$0.45',
    tcfGets: '~$4.55',
    poolShare: '~$4.32',
    opsShare: '~$0.23',
  },
  {
    product: '5 Tickets (bulk)',
    price: '$24.00',
    stripeFee: '~$1.00',
    tcfGets: '~$23.00',
    poolShare: '~$21.85',
    opsShare: '~$1.15',
  },
  {
    product: '10 Tickets (bulk)',
    price: '$48.00',
    stripeFee: '~$1.69',
    tcfGets: '~$46.31',
    poolShare: '~$44.00',
    opsShare: '~$2.32',
  },
  {
    product: 'TCF+ Membership',
    price: '$20.00/yr',
    stripeFee: '~$0.88',
    tcfGets: '~$19.12',
    poolShare: '~$18.16',
    opsShare: '~$0.96',
  },
  {
    product: 'Donation ($10 example)',
    price: '$10.00',
    stripeFee: '~$0.59',
    tcfGets: '~$9.41',
    poolShare: '~$8.94',
    opsShare: '~$0.47',
  },
  {
    product: 'Merch (any item)',
    price: 'Base + $2.50',
    stripeFee: 'varies',
    tcfGets: '$2.50 margin',
    poolShare: '~$2.38',
    opsShare: '~$0.12',
  },
];

const OPERATING_COSTS = [
  {
    service: 'Figma Make',
    cost: '$10/mo',
    note: 'TCF\'s share of a $20/mo plan shared across projects',
    icon: Palette,
    color: '#a855f7',
  },
  {
    service: 'Supabase',
    cost: '$0/mo',
    note: 'Free tier — database, auth, edge functions, storage',
    icon: Database,
    color: '#10b981',
  },
  {
    service: 'Stripe',
    cost: 'Per-transaction',
    note: '2.9% + $0.30 per charge. No monthly fee.',
    icon: CreditCard,
    color: '#6366f1',
  },
  {
    service: 'Printful',
    cost: 'Per-order',
    note: 'Production + shipping charged per item. No monthly fee.',
    icon: Package,
    color: '#f59e0b',
  },
  {
    service: 'OpenDota API',
    cost: '~$0.02 total',
    note: 'Essentially free at our scale. Haven\'t been billed yet.',
    icon: Gamepad2,
    color: '#ef4444',
  },
  {
    service: 'Steam Web API',
    cost: 'Free',
    note: 'Player data, match history, rank lookups',
    icon: Monitor,
    color: '#3b82f6',
  },
  {
    service: 'Discord API',
    cost: 'Free',
    note: 'Auth, bot commands, webhooks, role sync',
    icon: MessageSquare,
    color: '#5865F2',
  },
  {
    service: 'Domain',
    cost: 'TBD',
    note: 'Still securing the right domain. Cost will be listed once finalized.',
    icon: Globe,
    color: '#8b5cf6',
  },
];

const WISHLIST_ITEMS = [
  {
    item: 'Annual Figma Plan',
    why: 'Switching from monthly ($20/mo) to annual would save money long-term, reducing TCF\'s share.',
    priority: 'nice-to-have',
  },
  {
    item: 'Supabase Pro Tier',
    why: 'More database space, better performance, daily backups. Currently on free tier which works but has limits as we grow.',
    priority: 'future',
  },
  {
    item: 'Custom Domain',
    why: 'A proper .gg domain for the community. Still shopping for the right one.',
    priority: 'active',
  },
  {
    item: 'Dedicated Bot Hosting',
    why: 'More reliable uptime for Discord and Twitch bot commands instead of relying on edge functions.',
    priority: 'future',
  },
];

const PRIORITY_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  'active': { label: 'Looking Into', bg: 'bg-[#3b82f6]/10', text: 'text-[#3b82f6]' },
  'nice-to-have': { label: 'Nice to Have', bg: 'bg-[#f59e0b]/10', text: 'text-[#f59e0b]' },
  'future': { label: 'Down the Road', bg: 'bg-[#8b5cf6]/10', text: 'text-[#8b5cf6]' },
};

// ══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════

export function TransparencyPage() {
  return (
    <div className="px-3 sm:px-4 py-4 min-h-screen bg-background">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">

        {/* Hero */}
        <div className="relative bg-gradient-to-br from-harvest/15 via-kernel-gold/8 to-husk/10 rounded-2xl sm:rounded-3xl p-6 sm:p-10 border-2 border-harvest/15 overflow-hidden">
          <div className="relative z-10 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-harvest/15 border-2 border-harvest/25 flex items-center justify-center mx-auto mb-4">
              <Scale className="w-7 h-7 sm:w-8 sm:h-8 text-harvest" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-2">
              Where The Money Goes
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
              The Corn Field is community-funded for the first time ever.
              This page exists because you deserve to know exactly what happens with every dollar.
              No fine print. No surprises.
            </p>
          </div>
        </div>

        {/* ═══ Section 1: The 95/5 Rule ═══ */}
        <Section
          id="the-rule"
          icon={PieChart}
          iconColor="#d6a615"
          title="The 95/5 Rule"
          subtitle="One rule for everything"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every dollar that enters The Corn Field follows the same split, no matter the source &mdash;
              tickets, subscriptions, donations, or merch margins. No exceptions.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 95% block */}
              <div className="rounded-xl border-2 border-harvest/20 bg-harvest/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-harvest/15 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-harvest" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-harvest">95%</p>
                  </div>
                </div>
                <p className="text-xs font-bold text-foreground mb-1">Community Pool</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Stays in the TCF Stripe balance. Used for prize pool payouts,
                  giveaway prizes, refunds, and reinvesting in the community.
                  This money doesn't get withdrawn &mdash; it exists to serve players.
                </p>
              </div>

              {/* 5% block */}
              <div className="rounded-xl border-2 border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <Server className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-foreground">5%</p>
                  </div>
                </div>
                <p className="text-xs font-bold text-foreground mb-1">Operations Fund</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Withdrawn roughly once a month to TCF's business checking account.
                  Covers platform costs &mdash; Figma, hosting, APIs, domain, and any
                  other infrastructure that keeps the lights on.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-muted/50 border border-border">
              <HelpCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">What about Stripe fees?</span>{' '}
                Stripe takes its processing fee (2.9% + $0.30) from the total before TCF receives anything.
                The 95/5 split applies to what's left after Stripe's cut. TCF doesn't add any hidden fees on top.
              </p>
            </div>
          </div>
        </Section>

        {/* ═══ Section 2: Revenue Breakdown ═══ */}
        <Section
          id="revenue"
          icon={DollarSign}
          iconColor="#10b981"
          title="Revenue Breakdown"
          subtitle="Real numbers on every product"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Here's exactly what happens when you buy something. These are real numbers, not estimates &mdash;
              Stripe's fee is calculated per transaction.
            </p>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="text-left py-2.5 pr-3 font-bold text-muted-foreground uppercase tracking-wide">Product</th>
                    <th className="text-right py-2.5 px-3 font-bold text-muted-foreground uppercase tracking-wide">Price</th>
                    <th className="text-right py-2.5 px-3 font-bold text-muted-foreground uppercase tracking-wide">Stripe Fee</th>
                    <th className="text-right py-2.5 px-3 font-bold text-muted-foreground uppercase tracking-wide">TCF Gets</th>
                    <th className="text-right py-2.5 px-3 font-bold text-harvest uppercase tracking-wide">95% Pool</th>
                    <th className="text-right py-2.5 pl-3 font-bold text-muted-foreground uppercase tracking-wide">5% Ops</th>
                  </tr>
                </thead>
                <tbody>
                  {REVENUE_BREAKDOWN.map((row) => (
                    <tr key={row.product} className="border-b border-border/50">
                      <td className="py-2.5 pr-3 font-semibold text-foreground">{row.product}</td>
                      <td className="py-2.5 px-3 text-right text-foreground font-bold">{row.price}</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">{row.stripeFee}</td>
                      <td className="py-2.5 px-3 text-right text-foreground font-semibold">{row.tcfGets}</td>
                      <td className="py-2.5 px-3 text-right text-harvest font-bold">{row.poolShare}</td>
                      <td className="py-2.5 pl-3 text-right text-muted-foreground">{row.opsShare}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {REVENUE_BREAKDOWN.map((row) => (
                <div key={row.product} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{row.product}</span>
                    <span className="text-xs font-black text-foreground">{row.price}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stripe fee</span>
                      <span className="text-muted-foreground font-medium">{row.stripeFee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">TCF gets</span>
                      <span className="text-foreground font-semibold">{row.tcfGets}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-harvest">95% pool</span>
                      <span className="text-harvest font-bold">{row.poolShare}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">5% ops</span>
                      <span className="text-muted-foreground font-medium">{row.opsShare}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Merch note */}
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-[#a855f7]/5 border border-[#a855f7]/15">
              <Package className="w-4 h-4 text-[#a855f7] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">About merch pricing:</span>{' '}
                Every merch item has a flat $2.50 markup over Printful's base production cost.
                That $2.50 is TCF's total revenue per item &mdash; the 95/5 split applies to that margin only.
                We're not trying to make money on merch. We just want to make it available
                without losing money on every sale.
              </p>
            </div>
          </div>
        </Section>

        {/* ═══ Section 3: Operating Costs ═══ */}
        <Section
          id="costs"
          icon={Server}
          iconColor="#6366f1"
          title="What We Pay For"
          subtitle="Every platform and API powering TCF"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Corn Field lives in an ecosystem of projects that share some subscriptions.
              TCF pays its proportional share of shared plans. Here's every cost, including the free ones &mdash;
              because knowing what's free is just as useful as knowing what isn't.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {OPERATING_COSTS.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <div key={item.service} className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${item.color}12` }}
                    >
                      <ItemIcon className="w-4 h-4" style={{ color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground">{item.service}</span>
                        <span className="text-xs font-black text-foreground whitespace-nowrap">{item.cost}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{item.note}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-muted/50 border border-border">
              <HelpCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Shared cost model:</span>{' '}
                Figma and Supabase are shared with Tate's other projects. TCF pays its fair share &mdash;
                currently $10/mo of the $20/mo Figma plan. If/when Supabase upgrades to a paid tier,
                TCF will pay its portion of that too. The exact splits are always documented here.
              </p>
            </div>
          </div>
        </Section>

        {/* ═══ Section 4: Prize Pools & Giveaways ═══ */}
        <Section
          id="prizes"
          icon={Trophy}
          iconColor="#f59e0b"
          title="Prize Pools & Giveaways"
          subtitle="How winnings are funded and distributed"
        >
          <div className="space-y-4">
            {/* Prize pools */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-kernel-gold" />
                Tournament Prize Pools
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                Prize pools are funded by the 95% community pool &mdash; that means every ticket sale, every TCF+ subscription,
                every donation, and every merch margin contributes. On top of that, you can donate directly to
                an upcoming Kernel Kup's prize pool from the tournament page or the Secret Shop.
                The prize pool amount for each tournament is set by Kernel based on the community pool balance
                and expected event revenue.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="rounded-xl bg-harvest/5 border border-harvest/15 p-3 text-center">
                  <Wallet className="w-4 h-4 text-harvest mx-auto mb-1" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">95% Pool</p>
                  <p className="text-xs text-foreground font-semibold mt-1">All revenue builds it</p>
                </div>
                <div className="rounded-xl bg-kernel-gold/5 border border-kernel-gold/15 p-3 text-center">
                  <Heart className="w-4 h-4 text-kernel-gold mx-auto mb-1" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Direct Donations</p>
                  <p className="text-xs text-foreground font-semibold mt-1">Boost a specific KKup</p>
                </div>
                <div className="rounded-xl bg-husk/5 border border-husk/15 p-3 text-center">
                  <DollarSign className="w-4 h-4 text-husk mx-auto mb-1" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Payouts</p>
                  <p className="text-xs text-foreground font-semibold mt-1">Disbursed to winners</p>
                </div>
              </div>
            </div>

            {/* Prize Pool Structure */}
            <div className="pt-2">
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <Percent className="w-3.5 h-3.5 text-[#f59e0b]" />
                Prize Pool Structure
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                Every Kernel Kup has a <span className="font-semibold text-foreground">base prize pool of ${(BASE_POOL_TOTAL / 100).toFixed(2)}</span>.
                Community donations can increase the pool &mdash; when they do, every prize category grows proportionally.
                Here's how the base pool is split:
              </p>
              <div className="space-y-2">
                {PRIZE_POOL_CONFIG.map((prize) => {
                  const PrizeIcon = prize.icon;
                  return (
                    <div key={prize.key} className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${prize.color}15` }}
                      >
                        <PrizeIcon className="w-4 h-4" style={{ color: prize.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-foreground">{prize.label}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs font-black text-foreground">${(prize.baseAmount / 100).toFixed(2)}</span>
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: `${prize.color}15`, color: prize.color }}
                            >
                              {prize.percent}%
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {prize.description} · {prize.splitNote}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-[#f59e0b]/5 border border-[#f59e0b]/15 mt-3">
                <Heart className="w-4 h-4 text-[#f59e0b] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">How donations scale prizes:</span>{' '}
                  If the base pool is $150 and $10 is donated, the new total is $160 and every prize
                  grows by the same proportion. Staff pay becomes $80, Champions prize becomes $53.33,
                  and so on. You can see the exact breakdown on each tournament's Prizes tab.
                </p>
              </div>
            </div>

            {/* Prize Disbursement */}
            <div className="pt-2">
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <Banknote className="w-3.5 h-3.5 text-[#10b981]" />
                Prize Money Disbursement
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                After a tournament ends, prize money is disbursed to winners through Stripe Connect.
                Our goal is to complete all payouts within <span className="font-semibold text-foreground">7 days</span> of the event's conclusion,
                though it may take longer in some cases. We'll keep winners updated on Discord.
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3">
                  <div className="w-8 h-8 rounded-lg bg-[#6366f1]/10 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-4 h-4 text-[#6366f1]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground">Stripe Connect</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      Prize payouts are processed through Stripe Connect. Winners will need a connected Stripe account to receive funds.
                      If you don't have one, you'll be guided through setup when it's time to claim your prize.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3">
                  <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-[#f59e0b]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground">Timeline</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      Target: within 7 days of event completion. There's no hard deadline &mdash;
                      sometimes logistics take a bit longer &mdash; but we'll always communicate delays
                      and prioritize getting your winnings to you ASAP.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3">
                  <div className="w-8 h-8 rounded-lg bg-[#10b981]/10 flex items-center justify-center flex-shrink-0">
                    <UserCheck className="w-4 h-4 text-[#10b981]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground">Admin Disbursement</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      All prize disbursements are initiated manually by an owner through the admin tools &mdash;
                      separate from trophy/award buttons to prevent accidental payouts. Every disbursement is logged.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Giveaways */}
            <div className="pt-2">
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <Gift className="w-3.5 h-3.5 text-[#a855f7]" />
                Monthly Giveaways
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                We run a monthly Dota+ giveaway funded from the 95% community pool.
                Winners get to choose their prize:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                  <Gamepad2 className="w-4 h-4 text-[#ef4444] mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-foreground">1 Month Dota+</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Gifted to your Steam account</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                  <DollarSign className="w-4 h-4 text-[#10b981] mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-foreground">$5 Cash</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Sent to you directly</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                  <Crown className="w-4 h-4 text-harvest mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-foreground">20% Off TCF+</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Discount code for membership</p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ═══ Section 5: Ticket System & Refund Policy ═══ */}
        <Section
          id="refunds"
          icon={Shield}
          iconColor="#3b82f6"
          title="Tickets & Refund Policy"
          subtitle="How purchases, tickets, and refunds work"
        >
          <div className="space-y-4">
            {/* Ticket system */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-2">How Tickets Work</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                Think of it like Dota's BattleCup system. Tickets live in your wallet &mdash; buy as many as you want, they never expire.
                When your team is ready to compete in a Kernel Kup, the team pools tickets together and locks in.
                Players can contribute as many tickets as they want toward entry &mdash; one person can cover the whole team
                or everyone can chip in. Once the team locks in (either manually or when the tournament enters Roster Lock phase),
                the contributed tickets are consumed.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                Unused tickets stay in your wallet forever, ready for the next event.
              </p>
              <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-harvest/5 border border-harvest/15">
                <Crown className="w-4 h-4 text-harvest flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">TCF+ members get free entry.</span>{' '}
                  Your membership includes tournament entry at no additional ticket cost &mdash;
                  one of the perks of supporting TCF on an ongoing basis.
                </p>
              </div>
            </div>

            {/* Bulk discounts */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#10b981]" />
                Bulk Discounts
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                Buying tickets in bulk is cheaper per ticket &mdash; and thanks to how Stripe's transaction fees work,
                TCF actually nets <span className="font-semibold text-foreground">more</span> per ticket on bulk purchases because the $0.30 flat fee
                is only charged once instead of per-ticket. Win-win.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                  <p className="text-xs font-bold text-foreground">1–4 Tickets</p>
                  <p className="text-lg font-black text-foreground mt-1">$5.00<span className="text-xs font-semibold text-muted-foreground">/ea</span></p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Standard price</p>
                </div>
                <div className="rounded-xl border border-[#10b981]/20 bg-[#10b981]/5 p-3 text-center">
                  <p className="text-xs font-bold text-foreground">5+ Tickets</p>
                  <p className="text-lg font-black text-[#10b981] mt-1">$24.00<span className="text-xs font-semibold text-[#10b981]/60"> total</span></p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Save $1.00</p>
                </div>
                <div className="rounded-xl border border-[#10b981]/20 bg-[#10b981]/5 p-3 text-center">
                  <p className="text-xs font-bold text-foreground">10 Tickets</p>
                  <p className="text-lg font-black text-[#10b981] mt-1">$48.00<span className="text-xs font-semibold text-[#10b981]/60"> total</span></p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Save $2.00</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">
                Maximum purchase: 10 tickets at a time. The discount is applied automatically at checkout via Stripe &mdash;
                you'll see the discount reflected on the Stripe checkout page before you pay.
              </p>
            </div>

            {/* Punchcard */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <Gift className="w-3.5 h-3.5 text-harvest" />
                Ticket Punchcard
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                For every <span className="font-semibold text-foreground">10 tickets you purchase</span> (lifetime, not per transaction),
                we add <span className="font-semibold text-foreground">1 free bonus ticket</span> to your wallet. Think of it like a coffee shop punchcard &mdash;
                buy 10, get 1 free.
              </p>
              <div className="rounded-xl border border-harvest/20 bg-harvest/5 p-3 sm:p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full border-2 ${
                          i < 7
                            ? 'bg-harvest border-harvest'
                            : 'bg-transparent border-harvest/30'
                        }`}
                      />
                    ))}
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-harvest flex-shrink-0" />
                  <div className="flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5 text-harvest" />
                    <span className="text-xs font-bold text-harvest">FREE</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Example: 7 of 10 punches filled. 3 more purchases until your next free ticket.
                </p>
              </div>
              <div className="space-y-1.5 mt-3">
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="text-harvest font-bold mt-px">•</span>
                  <p className="text-muted-foreground">
                    Tracked by your <span className="font-semibold text-foreground">lifetime tickets purchased</span> count &mdash; not per-transaction.
                    Buy 3 today and 7 tomorrow? That's 10, you get a bonus.
                  </p>
                </div>
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="text-harvest font-bold mt-px">•</span>
                  <p className="text-muted-foreground">
                    The bonus ticket goes straight into your <span className="font-semibold text-foreground">wallet balance</span> but
                    does <span className="font-semibold text-foreground">not</span> increment your "all-time purchased" count (because you didn't buy it).
                  </p>
                </div>
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="text-harvest font-bold mt-px">•</span>
                  <p className="text-muted-foreground">
                    If a single purchase crosses multiple milestones (e.g., lifetime goes from 8 to 22),
                    you get all the bonus tickets you earned &mdash; in that case, 2.
                  </p>
                </div>
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="text-harvest font-bold mt-px">•</span>
                  <p className="text-muted-foreground">
                    You'll get a special <span className="font-semibold text-foreground">Punchcard Bonus</span> notification in your inbox
                    every time you hit a milestone.
                  </p>
                </div>
              </div>
            </div>

            {/* Refund policy */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-2">Refund Policy</h3>
              <div className="space-y-2.5">
                {/* Tickets */}
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Ticket className="w-3.5 h-3.5 text-[#10b981]" />
                    <span className="text-xs font-bold text-foreground">Kernel Kup Tickets</span>
                  </div>
                  <ul className="space-y-1 ml-5.5 text-[11px] text-muted-foreground leading-relaxed list-disc list-outside pl-1">
                    <li>
                      <span className="font-semibold text-foreground">Unused tickets</span> &mdash; stay in your wallet indefinitely. No refund needed because nothing was consumed. They're yours until you use them.
                    </li>
                    <li>
                      <span className="font-semibold text-foreground">Used tickets</span> &mdash; non-refundable. Tickets are consumed when your team locks into a tournament, whether that's a manual lock-in or the automatic Roster Lock phase.
                    </li>
                    <li>
                      <span className="font-semibold text-foreground">Bug-related consumption</span> &mdash; if a bug consumed tickets when it shouldn't have, or consumed more tickets than it should, contact us immediately. We'll issue replacement tickets directly to your wallet. No questions asked.
                    </li>
                  </ul>
                </div>

                {/* TCF+ */}
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Crown className="w-3.5 h-3.5 text-harvest" />
                    <span className="text-xs font-bold text-foreground">TCF+ Membership</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Full refund available within <span className="font-semibold text-foreground">7 days</span> of purchase.
                    After that, you can cancel anytime and your membership continues until its expiration date.
                    No partial refunds after the 7-day window.
                  </p>
                </div>

                {/* Donations */}
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Heart className="w-3.5 h-3.5 text-[#ef4444]" />
                    <span className="text-xs font-bold text-foreground">Donations</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Non-refundable &mdash; they're donations. However, if you accidentally donated the wrong amount
                    (e.g., $500 instead of $50) or suspect fraud on your account, reach out and we'll handle it
                    in good faith on a case-by-case basis.
                  </p>
                </div>

                {/* Merch */}
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-3.5 h-3.5 text-[#a855f7]" />
                    <span className="text-xs font-bold text-foreground">Merch</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Merch is print-on-demand through Printful, which means items are made to order and can't be restocked or returned.
                    If your order arrives damaged or defective, Printful covers replacements under their own policy.
                    If Printful messes something up, TCF eats the cost and gets you a new one. Let us know and we'll sort it out.
                  </p>
                </div>
              </div>
            </div>

            {/* Contact note */}
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-[#3b82f6]/5 border border-[#3b82f6]/15">
              <MessageSquare className="w-4 h-4 text-[#3b82f6] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Need help with a purchase?</span>{' '}
                Reach out on Discord or contact an officer. We're a community first &mdash;
                if something went wrong, we'll make it right.
              </p>
            </div>
          </div>
        </Section>

        {/* ═══ Section 6: Community Wishlist ═══ */}
        <Section
          id="wishlist"
          icon={Lightbulb}
          iconColor="#f59e0b"
          title="Community Wishlist"
          subtitle="Things we'd love to have down the road"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              These are things that would make TCF better but aren't urgent.
              No call to action here &mdash; just an open look at what we're thinking about.
              If seeing these costs inspires you to contribute, that's awesome.
              If not, that's cool too. The community runs fine without them.
            </p>

            <div className="space-y-2.5">
              {WISHLIST_ITEMS.map((item) => {
                const style = PRIORITY_STYLES[item.priority];
                return (
                  <div key={item.item} className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-foreground">{item.item}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${style.bg} ${style.text} uppercase tracking-wide`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{item.why}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>

        {/* ═══ Section 7: The Human Behind It ═══ */}
        <Section
          id="about"
          icon={User}
          iconColor="#d6a615"
          title="Who's Behind This"
          subtitle="One person, one community, full honesty"
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Corn Field is built and run by one person &mdash; Tate (Kernel). Every line of code, every design decision,
              every Discord bot command, every tournament bracket. It started as a passion project and it still is.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nobody takes a salary. There's no company behind this &mdash; just a sole proprietorship with a
              secondary checking account to keep the books clean. The 5% operations fund
              covers real costs (Figma, hosting, APIs) and nothing more.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Charging money for the first time is a big step for a community that's always been free.
              That's exactly why this page exists. If something doesn't look right, call it out.
              If you have ideas for how to make this more transparent, I'm all ears.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you're reading this and thinking <em>"I could build something like this"</em> &mdash;
              you absolutely can. The tools are more accessible than ever. The hardest part isn't the code.
              It's showing up every day for the people who use it.
            </p>
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-harvest/5 border border-harvest/15">
              <Sparkles className="w-4 h-4 text-harvest flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">The promise:</span>{' '}
                If TCF ever messes up with your money &mdash; a bad charge, a lost order, a bug that eats tickets &mdash;
                we fix it. Period. The community's trust is worth more than any dollar amount.
              </p>
            </div>
          </div>
        </Section>

        <Footer />
      </div>
    </div>
  );
}