/**
 * Legal Modal — Condensed TOS / Privacy Policy popup
 *
 * Shows a shortened version of the Terms of Service or Privacy Policy
 * in a BottomSheetModal. Used on the login page so users can review
 * without navigating away. Links to the full version for deep reading.
 */

import { FileText, Shield, ShieldCheck, Users, Trophy, ShoppingBag, Scale,
  Database, Eye, Cookie, UserX, RefreshCw, ExternalLink } from 'lucide-react';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';

type LegalType = 'terms' | 'privacy';

interface LegalModalProps {
  type: LegalType;
  onClose: () => void;
}

const EFFECTIVE_DATE = 'March 2, 2026';

// ═══════════════════════════════════════════════════════
// CONDENSED CONTENT
// ═══════════════════════════════════════════════════════

interface SummaryItem {
  icon: typeof Shield;
  title: string;
  points: string[];
}

const TOS_SUMMARY: SummaryItem[] = [
  {
    icon: ShieldCheck,
    title: 'Eligibility & Accounts',
    points: [
      'You must be at least 13 years old to use The Corn Field.',
      'You sign in via Discord OAuth — no separate password needed.',
      'One account per person. Alt accounts are prohibited.',
    ],
  },
  {
    icon: Users,
    title: 'The Guild System',
    points: [
      'Officers and owners manage roles, moderation, and events.',
      'Roles can be changed or revoked at any time by guild leadership.',
      'Abuse of rank or permissions will result in demotion or removal.',
    ],
  },
  {
    icon: Trophy,
    title: 'Tournaments (Kernel Kup)',
    points: [
      'Tickets are consumed at lock-in and are non-refundable once used.',
      'Unsportsmanlike conduct can result in disqualification and forfeiture.',
      'Prize pools are funded by the community pool and paid out via Stripe Connect.',
    ],
  },
  {
    icon: ShoppingBag,
    title: 'Secret Shop & Payments',
    points: [
      'All payments are processed by Stripe. TCF never sees your full card number.',
      'Unused tickets stay in your wallet forever — no expiration.',
      'TCF+ membership is refundable within 7 days; after that, cancel anytime.',
      'Merch is print-on-demand via Printful — no returns, but defects are replaced.',
    ],
  },
  {
    icon: Scale,
    title: 'Community Conduct',
    points: [
      'No harassment, hate speech, cheating, or match-fixing.',
      'Violations may result in temporary or permanent suspension.',
      'All enforcement decisions are at the discretion of guild leadership.',
    ],
  },
];

const PRIVACY_SUMMARY: SummaryItem[] = [
  {
    icon: Database,
    title: 'What We Collect',
    points: [
      'Discord profile (username, avatar, user ID) via OAuth.',
      'Optional: Steam ID, OpenDota stats, Dota 2 rank — only if you link them.',
      'Payment info is handled entirely by Stripe — we never see full card details.',
      'Basic usage data: theme preference, navigation state (localStorage only).',
    ],
  },
  {
    icon: Eye,
    title: 'How We Use It',
    points: [
      'To identify you in the guild, tournaments, and leaderboards.',
      'To process ticket purchases, subscriptions, and merch orders.',
      'To send you notifications about teams, events, and giveaways.',
      'We do NOT sell your data. We do NOT run ads. We do NOT track you across sites.',
    ],
  },
  {
    icon: Shield,
    title: 'Who We Share With',
    points: [
      'Stripe — payment processing only.',
      'Discord — authentication only.',
      'Steam/OpenDota — public game data lookups (no private data shared).',
      'Printful — shipping address for merch orders only.',
      'No one else. No analytics platforms, no ad networks, no data brokers.',
    ],
  },
  {
    icon: Cookie,
    title: 'Cookies & Storage',
    points: [
      'We use localStorage (not cookies) for theme preference and session state.',
      'Supabase sets an auth token cookie for session management.',
      'No third-party tracking cookies. No fingerprinting.',
    ],
  },
  {
    icon: UserX,
    title: 'Your Rights',
    points: [
      'You can request a full export of your data at any time.',
      'You can request full deletion of your account and all associated data.',
      'Reach out on Discord and we\'ll handle it — no bureaucratic process.',
    ],
  },
  {
    icon: RefreshCw,
    title: 'Data Retention',
    points: [
      'Account data is kept as long as your account exists.',
      'Tournament stats are retained for historical leaderboards.',
      'Activity logs are auto-pruned after 90 days.',
      'Delete your account and we delete everything — no shadow profiles.',
    ],
  },
];

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export function LegalModal({ type, onClose }: LegalModalProps) {
  const isTerms = type === 'terms';
  const summary = isTerms ? TOS_SUMMARY : PRIVACY_SUMMARY;
  const fullPageHash = isTerms ? '#terms' : '#privacy';
  const accentColor = isTerms ? 'harvest' : '[#3b82f6]';

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-2xl">
      <BottomSheetModal.Header
        gradient={isTerms ? 'from-harvest/10 to-harvest/5' : 'from-[#3b82f6]/10 to-[#3b82f6]/5'}
        borderColor={isTerms ? 'border-harvest/20' : 'border-[#3b82f6]/20'}
      >
        <div className="flex items-center gap-3 pr-8">
          <div className={`w-10 h-10 rounded-full bg-${accentColor}/15 flex items-center justify-center flex-shrink-0`}>
            {isTerms
              ? <FileText className="w-5 h-5 text-harvest" />
              : <Shield className="w-5 h-5 text-[#3b82f6]" />
            }
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              {isTerms ? 'Terms of Service' : 'Privacy Policy'}
            </h2>
            <p className="text-xs text-muted-foreground">
              Effective: {EFFECTIVE_DATE} · Summary version
            </p>
          </div>
        </div>
      </BottomSheetModal.Header>

      <BottomSheetModal.Body>
        <div className="space-y-4">
          {/* TL;DR */}
          <div className={`rounded-xl p-3 border ${isTerms ? 'bg-harvest/5 border-harvest/15' : 'bg-[#3b82f6]/5 border-[#3b82f6]/15'}`}>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground">TL;DR: </span>
              {isTerms
                ? 'Sign in with Discord, play fair, don\'t cheat, one account per person. Tickets are yours until you use them. We can suspend accounts that violate community standards. Everything is funded by the community and we\'re transparent about where the money goes.'
                : 'We collect what we need to run the platform (Discord profile, optional gaming stats, payment info via Stripe). We don\'t sell your data. We don\'t track you across the internet. You can ask us to delete your data anytime.'
              }
            </p>
          </div>

          {/* Sections */}
          {summary.map((section) => {
            const SectionIcon = section.icon;
            return (
              <div key={section.title} className="rounded-xl border border-border bg-muted/20 p-3 sm:p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: isTerms ? 'rgba(214,166,21,0.1)' : 'rgba(59,130,246,0.1)',
                    }}
                  >
                    <SectionIcon
                      className="w-3.5 h-3.5"
                      style={{ color: isTerms ? '#d6a615' : '#3b82f6' }}
                    />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">{section.title}</h3>
                </div>
                <ul className="space-y-1.5 ml-9.5">
                  {section.points.map((point, i) => (
                    <li key={i} className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                      <span
                        className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0"
                        style={{ backgroundColor: isTerms ? '#d6a615' : '#3b82f6' }}
                      />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </BottomSheetModal.Body>

      <BottomSheetModal.Footer>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <a
            href={fullPageHash}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
              isTerms
                ? 'border-harvest/20 text-harvest hover:bg-harvest/5'
                : 'border-[#3b82f6]/20 text-[#3b82f6] hover:bg-[#3b82f6]/5'
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            Read Full Version
          </a>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-all"
          >
            Got It
          </button>
        </div>
      </BottomSheetModal.Footer>
    </BottomSheetModal>
  );
}
