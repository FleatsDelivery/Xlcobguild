/**
 * Live Match Stats — Team comparison widgets for live games.
 *
 * Displays:
 * - Team net worth difference (tug-of-war bar)
 * - Team XP difference (tug-of-war bar)
 * - Highest net worth player (both sides)
 * - Most CS player (both sides)
 *
 * Receives LiveGame data — no data fetching.
 */

import { useMemo } from 'react';
import { getHeroImageUrl } from '@/utils/dota-constants';
import type { LiveGame } from './live-match-panel';

// ═══════════════════════════════════════════════════════
// COLORS — consistent with live-match-panel
// ═══════════════════════════════════════════════════════

const RADIANT = '#10b981';
const DIRE = '#ef4444';

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function formatGold(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

interface LiveMatchStatsProps {
  game: LiveGame;
  /** When true, renders in a single column (for sidebar layout) */
  compact?: boolean;
}

export function LiveMatchStats({ game, compact }: LiveMatchStatsProps) {
  const stats = useMemo(() => {
    let radiantNW = 0;
    let direNW = 0;
    let radiantXP = 0;
    let direXP = 0;

    let topRadiantNW = { name: '', heroName: '', heroId: 0, value: 0 };
    let topDireNW = { name: '', heroName: '', heroId: 0, value: 0 };
    let topRadiantCS = { name: '', heroName: '', heroId: 0, lh: 0, dn: 0 };
    let topDireCS = { name: '', heroName: '', heroId: 0, lh: 0, dn: 0 };

    game.radiant_players.forEach(p => {
      radiantNW += p.net_worth;
      radiantXP += p.xpm;
      if (p.net_worth > topRadiantNW.value) {
        topRadiantNW = { name: p.name || p.hero_name, heroName: p.hero_name, heroId: p.hero_id, value: p.net_worth };
      }
      if (p.last_hits > topRadiantCS.lh) {
        topRadiantCS = { name: p.name || p.hero_name, heroName: p.hero_name, heroId: p.hero_id, lh: p.last_hits, dn: p.denies };
      }
    });

    game.dire_players.forEach(p => {
      direNW += p.net_worth;
      direXP += p.xpm;
      if (p.net_worth > topDireNW.value) {
        topDireNW = { name: p.name || p.hero_name, heroName: p.hero_name, heroId: p.hero_id, value: p.net_worth };
      }
      if (p.last_hits > topDireCS.lh) {
        topDireCS = { name: p.name || p.hero_name, heroName: p.hero_name, heroId: p.hero_id, lh: p.last_hits, dn: p.denies };
      }
    });

    const totalNW = radiantNW + direNW || 1;
    const totalXP = radiantXP + direXP || 1;
    const nwDiff = radiantNW - direNW;
    const xpDiff = radiantXP - direXP;
    const nwPct = radiantNW / totalNW;
    const xpPct = radiantXP / totalXP;

    return {
      radiantNW, direNW, nwDiff, nwPct,
      radiantXP, direXP, xpDiff, xpPct,
      topRadiantNW, topDireNW,
      topRadiantCS, topDireCS,
    };
  }, [game.radiant_players, game.dire_players]);

  return (
    <div className={compact ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'}>
      {/* Net Worth Comparison */}
      <StatBar
        label="Net Worth"
        leftValue={formatGold(stats.radiantNW)}
        rightValue={formatGold(stats.direNW)}
        leftPct={stats.nwPct}
        diff={stats.nwDiff}
        diffLabel={`${stats.nwDiff > 0 ? '+' : ''}${formatGold(stats.nwDiff)}`}
      />

      {/* XP Comparison (using total XPM as proxy) */}
      <StatBar
        label="XPM Total"
        leftValue={String(stats.radiantXP)}
        rightValue={String(stats.direXP)}
        leftPct={stats.xpPct}
        diff={stats.xpDiff}
        diffLabel={`${stats.xpDiff > 0 ? '+' : ''}${stats.xpDiff}`}
      />

      {/* Top Net Worth */}
      <TopPlayerCard
        label="Highest Net Worth"
        left={stats.topRadiantNW.heroId ? {
          heroId: stats.topRadiantNW.heroId,
          name: stats.topRadiantNW.name,
          value: formatGold(stats.topRadiantNW.value),
        } : null}
        right={stats.topDireNW.heroId ? {
          heroId: stats.topDireNW.heroId,
          name: stats.topDireNW.name,
          value: formatGold(stats.topDireNW.value),
        } : null}
      />

      {/* Top CS */}
      <TopPlayerCard
        label="Most Last Hits"
        left={stats.topRadiantCS.heroId ? {
          heroId: stats.topRadiantCS.heroId,
          name: stats.topRadiantCS.name,
          value: `${stats.topRadiantCS.lh}/${stats.topRadiantCS.dn}`,
        } : null}
        right={stats.topDireCS.heroId ? {
          heroId: stats.topDireCS.heroId,
          name: stats.topDireCS.name,
          value: `${stats.topDireCS.lh}/${stats.topDireCS.dn}`,
        } : null}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

/** Tug-of-war comparison bar */
function StatBar({
  label,
  leftValue,
  rightValue,
  leftPct,
  diff,
  diffLabel,
}: {
  label: string;
  leftValue: string;
  rightValue: string;
  leftPct: number;
  diff: number;
  diffLabel: string;
}) {
  const clampedPct = Math.max(0.1, Math.min(0.9, leftPct));

  return (
    <div className="bg-muted/50 rounded-lg p-2.5 sm:p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        <span
          className="text-[10px] font-black"
          style={{ color: diff > 0 ? RADIANT : diff < 0 ? DIRE : '#9ca3af' }}
        >
          {diffLabel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold w-10 text-right tabular-nums" style={{ color: RADIANT }}>{leftValue}</span>
        <div className="flex-1 h-2 sm:h-2.5 rounded-full bg-border/30 overflow-hidden flex">
          <div
            className="h-full rounded-l-full transition-all duration-700"
            style={{ width: `${clampedPct * 100}%`, backgroundColor: RADIANT }}
          />
          <div
            className="h-full rounded-r-full transition-all duration-700"
            style={{ width: `${(1 - clampedPct) * 100}%`, backgroundColor: DIRE }}
          />
        </div>
        <span className="text-xs font-bold w-10 tabular-nums" style={{ color: DIRE }}>{rightValue}</span>
      </div>
    </div>
  );
}

/** Top player comparison card — hero portrait + stat */
function TopPlayerCard({
  label,
  left,
  right,
}: {
  label: string;
  left: { heroId: number; name: string; value: string } | null;
  right: { heroId: number; name: string; value: string } | null;
}) {
  if (!left && !right) return null;

  return (
    <div className="bg-muted/50 rounded-lg p-2.5 sm:p-3">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-center justify-between gap-2">
        {/* Radiant side */}
        {left ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <img
              src={getHeroImageUrl(left.heroId)}
              alt={left.name}
              className="w-7 h-7 rounded-full object-cover border-2 scale-125"
              style={{ borderColor: RADIANT }}
              width={28}
              height={28}
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{left.name}</p>
              <p className="text-[10px] font-black" style={{ color: RADIANT }}>{left.value}</p>
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground">--</div>
        )}

        <span className="text-[10px] text-muted-foreground font-bold">vs</span>

        {/* Dire side */}
        {right ? (
          <div className="flex items-center gap-1.5 min-w-0 flex-row-reverse">
            <img
              src={getHeroImageUrl(right.heroId)}
              alt={right.name}
              className="w-7 h-7 rounded-full object-cover border-2 scale-125"
              style={{ borderColor: DIRE }}
              width={28}
              height={28}
            />
            <div className="min-w-0 text-right">
              <p className="text-xs font-bold text-foreground truncate">{right.name}</p>
              <p className="text-[10px] font-black" style={{ color: DIRE }}>{right.value}</p>
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground">--</div>
        )}
      </div>
    </div>
  );
}