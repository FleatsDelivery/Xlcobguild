/**
 * Tournament Hub — Prizes Tab (Unified)
 *
 * Shows the prize pool breakdown and award recipients for a tournament.
 * Works for both active and finished tournaments - shows pool in all phases,
 * awards when completed.
 */

import { Trophy, Crown, Star, Swords, Users, Gift, DollarSign } from '@/lib/icons';
import type { Award } from './kkup-detail-types';
import { TournamentHubEmptyState } from './tournament-hub-empty-state';

// ═══════════════════════════════════════════════════════
// PRIZE POOL CONFIGURATION
// ═══════════════════════════════════════════════════════

export const PRIZE_POOL_CONFIG = [
  {
    key: 'champion',
    label: 'Champions',
    description: '1st Place Team',
    splitNote: 'Split among 5 roster members',
    baseAmount: 5000, // $50.00 in cents
    percent: 50,
    icon: Crown,
    color: '#d6a615',
  },
  {
    key: 'popd_kernel',
    label: "Pop'd Kernel Award",
    description: 'Highest KDA',
    splitNote: 'Up to 2 players',
    baseAmount: 1500, // $15.00 in cents
    percent: 15,
    icon: Star,
    color: '#f59e0b',
  },
  {
    key: 'match_of_the_night',
    label: 'Match of the Night',
    description: 'Most exciting match',
    splitNote: 'All players in the match',
    baseAmount: 1500, // $15.00 in cents
    percent: 15,
    icon: Swords,
    color: '#ef4444',
  },
  {
    key: 'staff',
    label: 'Staff Pay',
    description: 'Casters, Observers, Production',
    splitNote: '$5 per person per day',
    baseAmount: 2000, // $20.00 in cents
    percent: 20,
    icon: Users,
    color: '#6366f1',
  },
] as const;

export const BASE_POOL_TOTAL = PRIZE_POOL_CONFIG.reduce((sum, p) => sum + p.baseAmount, 0);

/**
 * Calculate actual prize pool values based on donations
 * If donations > 0, each prize grows proportionally
 */
export function calculatePrizePool(donationsCents: number = 0) {
  const total = BASE_POOL_TOTAL + donationsCents;
  const multiplier = total / BASE_POOL_TOTAL;
  
  return PRIZE_POOL_CONFIG.map(prize => ({
    ...prize,
    actualAmount: Math.floor(prize.baseAmount * multiplier),
  }));
}

// ═══════════════════════════════════════════════════════
// COMPONENT TYPES
// ═══════════════════════════════════════════════════════

export interface TournamentHubPrizesProps {
  tournament: any;
  awards: Award[];
  isFinished: boolean;
  isOwner: boolean;
  isRelevant?: boolean;
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function TournamentHubPrizes({
  tournament,
  awards,
  isFinished,
  isOwner,
  isRelevant,
}: TournamentHubPrizesProps) {
  // Parse donations from tournament or default to 0
  const donationsCents = tournament?.donated_prize_pool_cents || 0;
  const prizeBreakdown = calculatePrizePool(donationsCents);
  const totalPool = BASE_POOL_TOTAL + donationsCents;

  // Group awards by type
  const awardsByType = awards.reduce((acc, award) => {
    if (!acc[award.award_type]) {
      acc[award.award_type] = [];
    }
    acc[award.award_type].push(award);
    return acc;
  }, {} as Record<string, Award[]>);

  return (
    <div className="space-y-6">
      {/* ── Prize Pool Breakdown ── */}
      <div className="bg-card rounded-2xl border-2 border-border p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-6 h-6 text-harvest" />
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Prize Pool</h2>
            <p className="text-sm text-muted-foreground">
              {donationsCents > 0
                ? `Base $${(BASE_POOL_TOTAL / 100).toFixed(2)} + $${(donationsCents / 100).toFixed(2)} donations`
                : `Base pool of $${(BASE_POOL_TOTAL / 100).toFixed(2)}`}
            </p>
          </div>
        </div>

        {/* Total */}
        <div className="bg-harvest/10 border-2 border-harvest/30 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Total Prize Pool</span>
            <span className="text-2xl sm:text-3xl font-black text-harvest">
              ${(totalPool / 100).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-3">
          {prizeBreakdown.map((prize) => {
            const Icon = prize.icon;
            const prizeAwards = awardsByType[prize.key] || [];
            const hasAwarded = isFinished && prizeAwards.length > 0;

            return (
              <div
                key={prize.key}
                className="bg-muted/30 border border-border rounded-xl p-3 sm:p-4"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${prize.color}15`, border: `1.5px solid ${prize.color}30` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: prize.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-foreground">{prize.label}</h3>
                        <p className="text-xs text-muted-foreground">{prize.description}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg sm:text-xl font-black text-foreground">
                          ${(prize.actualAmount / 100).toFixed(2)}
                        </div>
                        <div
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block"
                          style={{ backgroundColor: `${prize.color}15`, color: prize.color }}
                        >
                          {prize.percent}%
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{prize.splitNote}</p>

                    {/* Show awarded recipients if finished */}
                    {hasAwarded && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <Gift className="w-4 h-4 text-green-500" />
                          <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                            Awarded to:
                          </span>
                        </div>
                        <div className="space-y-1">
                          {prizeAwards.map((award, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              <span className="text-foreground font-medium">
                                {award.recipient_display_name}
                              </span>
                              {award.amount_cents > 0 && (
                                <span className="text-muted-foreground">
                                  • ${(award.amount_cents / 100).toFixed(2)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Empty state for unfinished tournaments ── */}
      {!isFinished && (
        <div className="bg-card rounded-2xl border-2 border-border p-8 text-center">
          <DollarSign className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-xl font-bold text-foreground mb-2">Prizes Pending</h3>
          <p className="text-muted-foreground">
            Prize distribution will happen after the tournament concludes.
          </p>
        </div>
      )}

      {/* ── Custom/bonus awards (if any) ── */}
      {isFinished && awardsByType['custom'] && awardsByType['custom'].length > 0 && (
        <div className="bg-card rounded-2xl border-2 border-border p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <Gift className="w-6 h-6 text-purple-500" />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">Bonus Awards</h2>
              <p className="text-sm text-muted-foreground">
                Additional prizes and recognitions
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {awardsByType['custom'].map((award, idx) => (
              <div
                key={idx}
                className="bg-muted/30 border border-border rounded-xl p-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-foreground">{award.recipient_display_name}</div>
                  {award.notes && (
                    <div className="text-xs text-muted-foreground">{award.notes}</div>
                  )}
                </div>
                {award.amount_cents > 0 && (
                  <div className="text-lg font-black text-harvest">
                    ${(award.amount_cents / 100).toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}