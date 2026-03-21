/**
 * Tournament Players Tab - Phase-Agnostic
 *
 * Completed/Archived: Full stat leaderboard with hero pool, K/D/A, GPM/XPM, LH, DN, NW.
 * Active phases: Registered player grid.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, Target, Swords, Loader2, Sword, ChevronUp, ChevronDown, Search, UserPlus, Check, Clock, Send } from 'lucide-react';
import { useTournament } from '@/app/contexts/tournament-context';
import { toast } from 'sonner';
import { isFinished } from '../tournament-state-config';
import { RankBadge } from '../rank-badge';
import { TcfPlusAvatarRing } from '../tcf-plus-avatar-ring';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { getHeroImageByName } from '@/lib/dota-heroes';
import { getItemImageUrl, getItemName } from '@/lib/dota-items';
import { Footer } from '@/app/components/footer';
import { numericToRank, rankToNumeric } from '@/lib/rank-utils';
import { TabNoData } from '../tab-no-data';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

type SortKey = 'team_tag' | 'badge_rank' | 'total_matches' | 'kda' | 'win_rate' | 'kills' | 'deaths' | 'assists' | 'gpm' | 'xpm' | 'avg_last_hits' | 'avg_denies' | 'avg_net_worth' | 'avg_hero_damage' | 'avg_tower_damage' | 'avg_hero_healing' | 'avg_level';

// ═══════════════════════════════════════════════════════
// HERO POOL CHIPS — uses hero name → image via getHeroImageByName
// ═══════════════════════════════════════════════════════

function HeroChips({ heroes }: { heroes: Array<{ name: string; count: number }> }) {
  if (!heroes || heroes.length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {heroes.map((hero) => {
        const imgUrl = getHeroImageByName(hero.name);
        return (
          <div
            key={hero.name}
            className="relative group flex-shrink-0"
            title={`${hero.name} (${hero.count}x)`}
          >
            {imgUrl ? (
              <img
                src={imgUrl}
                alt={hero.name}
                className="w-7 h-7 rounded object-cover border border-border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-7 h-7 rounded bg-muted border border-border flex items-center justify-center">
                <Sword className="w-3 h-3 text-muted-foreground" />
              </div>
            )}
            {/* Count badge if played more than once */}
            {hero.count > 1 && (
              <span className="absolute -bottom-1 -right-1 bg-harvest text-field-dark text-[9px] font-black rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
                {hero.count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// KDA DISPLAY
// ═══════════════════════════════════════════════════════

function KdaDisplay({ kda }: { kda: number }) {
  const kdaColor = kda >= 5 ? '#10b981' : kda >= 3 ? '#f59e0b' : kda >= 2 ? '#d6a615' : 'inherit';
  return (
    <div className="text-sm font-bold" style={{ color: kdaColor }}>
      {kda.toFixed(2)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ITEM SLOT — shows item image with orange bg + corn emoji fallback
// ═══════════════════════════════════════════════════════

function ItemSlot({ itemId, size = 'md' }: { itemId: number | null | undefined; size?: 'sm' | 'md' }) {
  const imgUrl = itemId ? getItemImageUrl(itemId) : '';
  const itemName = itemId ? getItemName(itemId) : '';
  const sizeClass = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';

  if (!itemId || itemId === 0) {
    // Empty slot — dashes to signal "not tracked / empty"
    return (
      <div className={`${sizeClass} rounded bg-muted border border-border flex-shrink-0 flex items-center justify-center`}>
        <span className="text-[10px] font-bold text-muted-foreground/50">--</span>
      </div>
    );
  }

  if (!imgUrl) {
    // Known ID but not in our lookup — orange corn fallback
    return (
      <div
        className={`${sizeClass} rounded bg-harvest/80 border border-harvest flex items-center justify-center flex-shrink-0 text-base`}
        title={`Item #${itemId}`}
      >
        🌽
      </div>
    );
  }

  return (
    <img
      src={imgUrl}
      alt={itemName || `Item ${itemId}`}
      title={itemName || `Item ${itemId}`}
      className={`${sizeClass} rounded object-cover border border-border flex-shrink-0`}
      onError={(e) => {
        // Image failed to load — swap to corn fallback
        const el = e.currentTarget;
        el.style.display = 'none';
        const fallback = el.nextElementSibling as HTMLElement;
        if (fallback) fallback.style.display = 'flex';
      }}
    />
  );
}

function ItemSlotWithFallback({ itemId, size = 'md' }: { itemId: number | null | undefined; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  return (
    <div className="relative">
      <ItemSlot itemId={itemId} size={size} />
      {/* Hidden fallback that shows if img fails onError */}
      <div
        className={`${sizeClass} rounded bg-harvest/80 border border-harvest items-center justify-center text-base hidden absolute inset-0`}
        title={`Item #${itemId}`}
      >
        🌽
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PLAYER STATS HEADER
// ═══════════════════════════════════════════════════════

function PlayerStatsHeader({
  tournament,
  playerCount,
  players,
}: {
  tournament: any;
  playerCount: number;
  players: any[];
}) {
  const finished = isFinished(tournament.status);
  const isRosterLock = tournament.status === 'roster_lock';

  // Compute average rank from badge_rank data
  const avgRankDisplay = useMemo(() => {
    if (players.length === 0) return null;
    const numerics: number[] = [];
    for (const p of players) {
      if (p.badge_rank?.medal && p.badge_rank.medal !== 'Unranked') {
        const n = rankToNumeric(p.badge_rank.medal, p.badge_rank.stars || 0);
        if (n > 0) numerics.push(n);
      }
    }
    if (numerics.length === 0) return null;
    const avg = numerics.reduce((s, v) => s + v, 0) / numerics.length;
    return numericToRank(avg);
  }, [players]);

  // Compute highest rank from badge_rank data
  const highestRankDisplay = useMemo(() => {
    if (players.length === 0) return null;
    let highest = 0;
    for (const p of players) {
      if (p.badge_rank?.medal && p.badge_rank.medal !== 'Unranked') {
        const n = rankToNumeric(p.badge_rank.medal, p.badge_rank.stars || 0);
        if (n > highest) highest = n;
      }
    }
    if (highest === 0) return null;
    return numericToRank(highest);
  }, [players]);

  // Compute aggregate K/D/A averages across all players
  const avgKills = useMemo(() => {
    if (players.length === 0) return null;
    return players.reduce((s, p) => s + (p.kills ?? 0), 0) / players.length;
  }, [players]);

  const avgDeaths = useMemo(() => {
    if (players.length === 0) return null;
    return players.reduce((s, p) => s + (p.deaths ?? 0), 0) / players.length;
  }, [players]);

  const avgAssists = useMemo(() => {
    if (players.length === 0) return null;
    return players.reduce((s, p) => s + (p.assists ?? 0), 0) / players.length;
  }, [players]);

  // KDA = (kills + assists) / deaths — computed from aggregates, not averaged from individual KDAs
  const avgKda = useMemo(() => {
    if (avgKills == null || avgDeaths == null || avgAssists == null) return null;
    if (avgDeaths === 0) return null;
    return (avgKills + avgAssists) / avgDeaths;
  }, [avgKills, avgDeaths, avgAssists]);

  return (
    <div className="bg-card rounded-2xl border-2 border-border p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4">Player Statistics</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Card 1 — Registered count (no cap, no progress bar) */}
        <div className="bg-muted rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Users className="w-4 h-4 text-[#3b82f6]" />
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
              {finished ? 'Total Players' : 'Registered'}
            </span>
          </div>
          <div className="text-3xl font-black text-foreground">
            {playerCount}
          </div>
          {!finished && (
            <div className="text-xs text-muted-foreground mt-1">players signed up</div>
          )}
        </div>

        {/* Card 2 — Average Rank (unchanged) */}
        <div className="bg-muted rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Target className="w-4 h-4 text-[#10b981]" />
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
              Average Rank
            </span>
          </div>
          {avgRankDisplay ? (
            <div className="flex items-center gap-3">
              <RankBadge medal={avgRankDisplay.medal} stars={avgRankDisplay.stars} size="xl" />
              <div className="text-2xl font-black text-foreground leading-none">
                {avgRankDisplay.medal}
                {avgRankDisplay.stars > 0 && (
                  <span className="text-muted-foreground font-semibold"> {avgRankDisplay.stars}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No rank data</div>
          )}
        </div>

        {/* Card 3 — Highest Rank (roster_lock) | Avg KDA (finished) | Registration Opens (other active) */}
        {finished ? (
          <div className="bg-muted rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Swords className="w-4 h-4 text-[#f59e0b]" />
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                Average KDA
              </span>
            </div>
            {avgKda != null ? (
              <div>
                <div className="flex items-baseline gap-3">
                  <span
                    className="text-3xl font-black leading-none"
                    style={{
                      color: avgKda >= 5 ? '#10b981' : avgKda >= 3 ? '#f59e0b' : avgKda >= 2 ? '#d6a615' : '#ef4444',
                    }}
                  >
                    {avgKda.toFixed(2)}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-bold text-foreground">
                      {avgKills != null ? avgKills.toFixed(1) : '—'}
                      <span className="text-muted-foreground font-normal"> K</span>
                    </span>
                    <span className="text-muted-foreground/40">/</span>
                    <span className="font-bold text-[#ef4444]">
                      {avgDeaths != null ? avgDeaths.toFixed(1) : '—'}
                      <span className="text-muted-foreground font-normal"> D</span>
                    </span>
                    <span className="text-muted-foreground/40">/</span>
                    <span className="font-bold text-foreground">
                      {avgAssists != null ? avgAssists.toFixed(1) : '—'}
                      <span className="text-muted-foreground font-normal"> A</span>
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">across {players.length} players</div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No data</div>
            )}
          </div>
        ) : isRosterLock ? (
          <div className="bg-muted rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Target className="w-4 h-4 text-[#f59e0b]" />
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                Highest Rank
              </span>
            </div>
            {highestRankDisplay ? (
              <div className="flex items-center gap-3">
                <RankBadge medal={highestRankDisplay.medal} stars={highestRankDisplay.stars} size="xl" />
                <div className="text-2xl font-black text-foreground leading-none">
                  {highestRankDisplay.medal}
                  {highestRankDisplay.stars > 0 && (
                    <span className="text-muted-foreground font-semibold"> {highestRankDisplay.stars}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No rank data</div>
            )}
          </div>
        ) : (
          <div className="bg-muted rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Swords className="w-4 h-4 text-[#f59e0b]" />
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                Registration Opens
              </span>
            </div>
            <div className="text-sm font-bold text-foreground">
              {tournament.registration_start_date
                ? new Date(tournament.registration_start_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'TBA'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SORT COLUMNS CONFIG
// ═══════════════════════════════════════════════════════

const SORT_COLUMNS: Array<{ key: SortKey; label: string; title: string; color?: string; mobileHidden?: boolean }> = [
  { key: 'win_rate',        label: 'W%',    title: 'Win Rate'                    },
  { key: 'kda',             label: 'KDA',   title: 'Kill/Death/Assist Ratio'     },
  { key: 'kills',           label: 'K',     title: 'Total Kills'                 },
  { key: 'deaths',          label: 'D',     title: 'Total Deaths'                },
  { key: 'assists',         label: 'A',     title: 'Total Assists'               },
  { key: 'gpm',             label: 'GPM',   title: 'Avg Gold Per Minute',   mobileHidden: true },
  { key: 'xpm',             label: 'XPM',   title: 'Avg XP Per Minute',     mobileHidden: true },
  { key: 'avg_last_hits',   label: 'LH',    title: 'Avg Last Hits',         mobileHidden: true },
  { key: 'avg_denies',      label: 'DN',    title: 'Avg Denies',            mobileHidden: true },
  { key: 'avg_net_worth',   label: 'NW',    title: 'Avg Net Worth',         mobileHidden: true },
  { key: 'avg_hero_damage', label: 'HDmg',  title: 'Avg Hero Damage',       mobileHidden: true },
  { key: 'avg_tower_damage',label: 'TDmg',  title: 'Avg Tower Damage',      mobileHidden: true },
  { key: 'avg_hero_healing',label: 'Heal',  title: 'Avg Hero Healing',      mobileHidden: true },
  { key: 'avg_level',       label: 'Lvl',   title: 'Avg End Level',         mobileHidden: true },
];

// ═══════════════════════════════════════════════════════
// PLAYER LEADERBOARD (Completed/Archived)
// ═══════════════════════════════════════════════════════

function PlayerLeaderboard({ players }: { players: any[] }) {
  const [sortBy, setSortBy] = useState<SortKey>('team_tag');
  const [sortDesc, setSortDesc] = useState(false);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const handleSort = (column: SortKey) => {
    if (sortBy === column) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(column);
      // team_tag: default A→Z (asc). deaths: default low→high (asc). everything else: desc.
      setSortDesc(column !== 'team_tag' && column !== 'deaths');
    }
  };

  const sortedPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? players.filter(
          (p) =>
            (p.player_name || '').toLowerCase().includes(query) ||
            (p.team_tag || '').toLowerCase().includes(query) ||
            (p.team_name || '').toLowerCase().includes(query),
        )
      : players;

    return [...filtered].sort((a, b) => {
      // String sort for team_tag
      if (sortBy === 'team_tag') {
        const aVal = (a.team_tag || '').toLowerCase();
        const bVal = (b.team_tag || '').toLowerCase();
        if (aVal < bVal) return sortDesc ? 1 : -1;
        if (aVal > bVal) return sortDesc ? -1 : 1;
        return (a.player_name || '').toLowerCase().localeCompare((b.player_name || '').toLowerCase());
      }
      // Numeric sort for badge_rank — convert { medal, stars } to a comparable number
      if (sortBy === 'badge_rank') {
        const aRank = a.badge_rank ? rankToNumeric(a.badge_rank.medal, a.badge_rank.stars ?? 0) : 0;
        const bRank = b.badge_rank ? rankToNumeric(b.badge_rank.medal, b.badge_rank.stars ?? 0) : 0;
        return sortDesc ? bRank - aRank : aRank - bRank;
      }
      // Default numeric sort
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      return sortDesc ? bVal - aVal : aVal - bVal;
    });
  }, [players, sortBy, sortDesc, search]);

  function SortTh({ col }: { col: typeof SORT_COLUMNS[number] }) {
    const isActive = sortBy === col.key;
    return (
      <th
        className={`text-center p-3 sm:p-4 text-xs font-bold uppercase cursor-pointer hover:bg-harvest/10 transition-colors select-none whitespace-nowrap ${col.mobileHidden ? 'hidden lg:table-cell' : ''}`}
        onClick={() => handleSort(col.key)}
        title={col.title}
      >
        <div className={`flex items-center justify-center gap-1 ${isActive ? 'text-harvest' : 'text-muted-foreground'}`}>
          <span>{col.label}</span>
          {isActive && (sortDesc ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
        </div>
      </th>
    );
  }

  return (
    <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b-2 border-border flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Player Leaderboard</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click any column to sort · Click a row to expand full stats
          </p>
        </div>
        {/* Search bar */}
        <div className="sm:ml-auto relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search player or team…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-harvest/60 focus:ring-1 focus:ring-harvest/30 transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead className="bg-muted border-b-2 border-border">
            <tr>
              <th className="text-left p-3 sm:p-4 text-xs font-bold text-muted-foreground uppercase w-8">#</th>
              <th className="text-left p-3 sm:p-4 text-xs font-bold text-muted-foreground uppercase">Player</th>
              {/* Team — sortable A→Z / Z→A */}
              <th
                className="text-left p-3 sm:p-4 text-xs font-bold uppercase cursor-pointer hover:bg-harvest/10 transition-colors select-none hidden sm:table-cell"
                onClick={() => handleSort('team_tag')}
                title="Team (sort A→Z / Z→A)"
              >
                <div className={`flex items-center gap-1 ${sortBy === 'team_tag' ? 'text-harvest' : 'text-muted-foreground'}`}>
                  <span>Team</span>
                  {sortBy === 'team_tag' && (sortDesc ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                </div>
              </th>
              {/* Badge Rank — sortable, hidden on mobile */}
              <th
                className="text-center p-3 sm:p-4 text-xs font-bold uppercase cursor-pointer hover:bg-harvest/10 transition-colors select-none hidden sm:table-cell"
                onClick={() => handleSort('badge_rank')}
                title="Dota 2 Rank (sort high→low)"
              >
                <div className={`flex items-center justify-center gap-1 ${sortBy === 'badge_rank' ? 'text-harvest' : 'text-muted-foreground'}`}>
                  <span>Rank</span>
                  {sortBy === 'badge_rank' && (sortDesc ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                </div>
              </th>
              {/* GP sortable */}
              <th
                className="text-center p-3 sm:p-4 text-xs font-bold uppercase cursor-pointer hover:bg-harvest/10 transition-colors select-none"
                onClick={() => handleSort('total_matches')}
                title="Games Played"
              >
                <div className={`flex items-center justify-center gap-1 ${sortBy === 'total_matches' ? 'text-harvest' : 'text-muted-foreground'}`}>
                  <span>GP</span>
                  {sortBy === 'total_matches' && (sortDesc ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                </div>
              </th>
              {SORT_COLUMNS.map((col) => <SortTh key={col.key} col={col} />)}
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((player, idx) => {
              const isExpanded = expandedPlayer === player.id;
              const rankNum = idx + 1;
              return (
                <React.Fragment key={player.id}>
                  <tr
                    className={`border-b border-border hover:bg-muted/40 transition-colors cursor-pointer ${isExpanded ? 'bg-muted/50' : ''}`}
                    onClick={() => setExpandedPlayer(isExpanded ? null : player.id)}
                  >
                    {/* Rank */}
                    <td className="p-3 sm:p-4">
                      <span className={`text-sm font-black ${
                        rankNum === 1 ? 'text-[#ffd700]' :
                        rankNum === 2 ? 'text-[#c0c0c0]' :
                        rankNum === 3 ? 'text-[#cd7f32]' :
                        'text-muted-foreground'
                      }`}>
                        {rankNum}
                      </span>
                    </td>

                    {/* Player */}
                    <td className="p-3 sm:p-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        {/* Avatar → OpenDota link */}
                        <a
                          href={player.opendota_url || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={player.opendota_url ? 'hover:opacity-80 transition-opacity flex-shrink-0' : 'flex-shrink-0 cursor-default'}
                          title={player.opendota_url ? 'View on OpenDota' : undefined}
                        >
                          <TcfPlusAvatarRing active={player.tcf_plus_active} size="xs">
                            {player.avatar_url ? (
                              <img
                                src={player.avatar_url}
                                alt={player.player_name}
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-harvest/20 flex items-center justify-center">
                                <span className="text-sm font-bold text-harvest">
                                  {player.player_name?.charAt(0).toUpperCase() || '?'}
                                </span>
                              </div>
                            )}
                          </TcfPlusAvatarRing>
                        </a>
                        <div className="min-w-0">
                          {/* Name → Dotabuff link */}
                          <a
                            href={player.dotabuff_url || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={`font-semibold text-sm truncate block max-w-[100px] sm:max-w-[160px] ${player.dotabuff_url ? 'text-foreground hover:text-harvest transition-colors' : 'text-foreground cursor-default'}`}
                            title={player.dotabuff_url ? 'View on Dotabuff' : undefined}
                          >
                            {player.player_name || 'Unknown'}
                          </a>
                          {/* Hero chips under name */}
                          {player.most_played_heroes?.length > 0 && (
                            <div className="mt-1">
                              <HeroChips heroes={player.most_played_heroes} />
                            </div>
                          )}
                          {/* Team tag — mobile only */}
                          {player.team_tag && (
                            <div className="sm:hidden text-[10px] text-muted-foreground mt-0.5">
                              {player.team_tag}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Team */}
                    <td className="p-3 sm:p-4 hidden sm:table-cell">
                      {player.team_tag ? (
                        <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {player.team_tag}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>

                    {/* Badge Rank */}
                    <td className="p-3 sm:p-4 text-center hidden sm:table-cell">
                      {player.badge_rank?.medal ? (
                        <div className="flex items-center justify-center">
                          <RankBadge
                            medal={player.badge_rank.medal}
                            stars={player.badge_rank.stars ?? 0}
                            size="sm"
                            showLabel
                            showStars
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>

                    {/* GP */}
                    <td className="p-3 sm:p-4 text-center">
                      <span className="text-sm font-semibold text-foreground">{player.total_matches || 0}</span>
                    </td>

                    {/* Win% */}
                    <td className="p-3 sm:p-4 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-sm font-bold ${
                          player.win_rate >= 60 ? 'text-[#10b981]' :
                          player.win_rate >= 50 ? 'text-[#f59e0b]' :
                          'text-[#ef4444]'
                        }`}>
                          {player.win_rate ?? '—'}
                          {player.win_rate != null ? '%' : ''}
                        </span>
                        {player.total_matches > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {player.wins ?? 0}W {player.losses ?? 0}L
                          </span>
                        )}
                      </div>
                    </td>

                    {/* KDA */}
                    <td className="p-3 sm:p-4 text-center">
                      <KdaDisplay kda={player.kda || 0} />
                    </td>

                    {/* K */}
                    <td className="p-3 sm:p-4 text-center">
                      <span className="text-sm font-semibold text-foreground">{player.kills || 0}</span>
                    </td>

                    {/* D */}
                    <td className="p-3 sm:p-4 text-center">
                      <span className="text-sm font-semibold text-[#ef4444]">{player.deaths || 0}</span>
                    </td>

                    {/* A */}
                    <td className="p-3 sm:p-4 text-center">
                      <span className="text-sm font-semibold text-foreground">{player.assists || 0}</span>
                    </td>

                    {/* GPM */}
                    <td className="p-3 sm:p-4 text-center hidden lg:table-cell">
                      <span className="text-sm font-semibold text-[#f59e0b]">{player.gpm || 0}</span>
                    </td>

                    {/* XPM */}
                    <td className="p-3 sm:p-4 text-center hidden lg:table-cell">
                      <span className="text-sm font-semibold text-[#8b5cf6]">{player.xpm || 0}</span>
                    </td>

                    {/* LH */}
                    <td className="p-3 sm:p-4 text-center hidden lg:table-cell">
                      <span className="text-sm font-semibold text-foreground">{player.avg_last_hits || 0}</span>
                    </td>

                    {/* DN */}
                    <td className="p-3 sm:p-4 text-center hidden lg:table-cell">
                      <span className="text-sm font-semibold text-foreground">{player.avg_denies || 0}</span>
                    </td>

                    {/* NW */}
                    <td className="p-3 sm:p-4 text-center hidden lg:table-cell">
                      <span className="text-sm font-semibold text-[#10b981]">
                        {player.avg_net_worth ? player.avg_net_worth.toLocaleString() : '--'}
                      </span>
                    </td>

                    {/* HDmg */}
                    <td className="p-3 sm:p-4 text-center hidden lg:table-cell">
                      <span className="text-sm font-semibold text-[#ef4444]">
                        {player.avg_hero_damage ? player.avg_hero_damage.toLocaleString() : '--'}
                      </span>
                    </td>

                    {/* TDmg */}
                    <td className="p-3 sm:p-4 text-center hidden lg:table-cell">
                      <span className="text-sm font-semibold text-[#f59e0b]">
                        {player.avg_tower_damage ? player.avg_tower_damage.toLocaleString() : '--'}
                      </span>
                    </td>

                    {/* Heal */}
                    <td className="p-3 sm:p-4 text-center hidden lg:table-cell">
                      <span className="text-sm font-semibold text-[#10b981]">
                        {player.avg_hero_healing ? player.avg_hero_healing.toLocaleString() : '--'}
                      </span>
                    </td>

                    {/* Lvl */}
                    <td className="p-3 sm:p-4 text-center hidden lg:table-cell">
                      <span className="text-sm font-semibold text-[#8b5cf6]">
                        {player.avg_level ? player.avg_level : '--'}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <tr className="bg-muted/30 border-b border-border">
                      <td colSpan={19} className="p-4 sm:p-5">
                        <PlayerDetailPanel player={player} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// EXPANDED PLAYER DETAIL PANEL
// ══════════════════════════════════════════════════════

function PlayerDetailPanel({ player }: { player: any }) {
  const itemSlots = [
    player.item_0, player.item_1, player.item_2,
    player.item_3, player.item_4, player.item_5,
  ];
  const neutralItem = player.item_neutral;

  return (
    // Single scrollable row: items on the left, hero pool on the right
    <div className="overflow-x-auto">
      <div className="flex items-center gap-4 min-w-max py-1">
        {/* End-of-Game Items */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-semibold mr-1 whitespace-nowrap">Items:</span>
          {itemSlots.map((itemId: number, idx: number) => (
            <ItemSlotWithFallback key={idx} itemId={itemId} size="md" />
          ))}
          {/* Divider before neutral */}
          <div className="w-px h-9 bg-border mx-0.5" />
          <ItemSlotWithFallback itemId={neutralItem} size="md" />
        </div>

        {/* Vertical divider between sections */}
        {player.most_played_heroes?.length > 0 && (
          <div className="w-px h-9 bg-border" />
        )}

        {/* Hero Pool */}
        {player.most_played_heroes?.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-semibold whitespace-nowrap">Hero Pool:</span>
            {player.most_played_heroes.map((hero: any) => {
              const imgUrl = getHeroImageByName(hero.name);
              return (
                <div key={hero.name} className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-lg whitespace-nowrap">
                  {imgUrl && (
                    <img
                      src={imgUrl}
                      alt={hero.name}
                      className="w-5 h-5 rounded object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <span className="text-xs font-semibold text-foreground">{hero.name}</span>
                  <span className="text-[10px] text-muted-foreground">×{hero.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// REGISTRATION PLAYER CARD — shared by all three sections
// ═══════════════════════════════════════════════════════

interface InviteContextProps {
  /** The captain's team ID, if the current user is a captain on an approved team */
  captainTeamId: string | null;
  /** Already-sent invite IDs (person_id → invite status) */
  pendingInvites: Record<string, 'pending' | 'sending'>;
  /** Trigger an invite send */
  onInvite: (personId: string, isCoach: boolean) => void;
  /** Tournament status — we only show invite button during certain phases */
  tournamentStatus: string;
}

function RegistrationCard({
  player,
  inviteCtx,
}: {
  player: any;
  inviteCtx?: InviteContextProps;
}) {
  const isCoach = player.registration_type === 'coach';
  const isFreeAgent = !player.team_tag && !isCoach;

  const canInvite =
    inviteCtx?.captainTeamId &&
    isFreeAgent &&
    ['registration_closed', 'roster_lock'].includes(inviteCtx.tournamentStatus);

  const inviteState = inviteCtx?.pendingInvites[player.person_id];
  const isSending = inviteState === 'sending';
  const alreadyInvited = inviteState === 'pending';

  return (
    <div className="bg-muted rounded-lg border-2 border-border p-3 hover:border-harvest/30 transition-all">
      <div className="flex items-center gap-3">
        {/* Avatar → OpenDota link */}
        <a
          href={player.opendota_url || undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={player.opendota_url ? 'hover:opacity-80 transition-opacity flex-shrink-0' : 'flex-shrink-0 cursor-default'}
          title={player.opendota_url ? 'View on OpenDota' : undefined}
        >
          <TcfPlusAvatarRing active={player.tcf_plus_active} size="sm">
            {player.avatar_url ? (
              <img
                src={player.avatar_url}
                alt={player.player_name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-harvest/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-harvest">
                  {player.player_name?.charAt(0).toUpperCase() || '?'}
                </span>
              </div>
            )}
          </TcfPlusAvatarRing>
        </a>

        {/* Name + team — truncates to give room for rank badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Name → Dotabuff link */}
            <a
              href={player.dotabuff_url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`font-semibold text-sm truncate ${player.dotabuff_url ? 'text-foreground hover:text-harvest transition-colors' : 'text-foreground cursor-default'}`}
              title={player.dotabuff_url ? 'View on Dotabuff' : undefined}
            >
              {player.player_name}
            </a>
            {isCoach && (
              <span className="flex-shrink-0 text-[10px] font-bold bg-[#8b5cf6]/15 text-[#8b5cf6] px-1.5 py-0.5 rounded uppercase tracking-wide">
                Coach
              </span>
            )}
          </div>

          {/* Sub-line: team or status */}
          {player.team_tag ? (
            <div className="text-xs text-muted-foreground truncate mt-0.5">
              {isCoach ? 'Coaching' : ''} <span className="font-semibold">{player.team_tag}</span>
              {player.team_name && player.team_name !== player.team_tag && (
                <span className="text-muted-foreground/60"> · {player.team_name}</span>
              )}
            </div>
          ) : (
            <div className="text-xs mt-0.5" style={{ color: isCoach ? '#8b5cf6' : '#10b981' }}>
              {isCoach ? 'Unassigned' : 'Free Agent'}
            </div>
          )}
        </div>

        {/* Right side: rank badge + optional invite button */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <div className="flex flex-col items-center gap-0.5">
            {player.badge_rank?.medal ? (
              <>
                <RankBadge
                  medal={player.badge_rank.medal}
                  stars={player.badge_rank.stars || 0}
                  size="sm"
                />
                <span className="text-[10px] text-muted-foreground font-semibold leading-none">
                  {player.badge_rank.medal}{(player.badge_rank.stars || 0) > 0 ? ` ${player.badge_rank.stars}` : ''}
                </span>
              </>
            ) : (
              <span className="text-[10px] text-muted-foreground/40 leading-none">—</span>
            )}
          </div>

          {/* Invite button — only for captains inviting free agents */}
          {canInvite && (
            <button
              onClick={() => inviteCtx?.onInvite(player.person_id, isCoach)}
              disabled={isSending || alreadyInvited}
              className={`mt-1 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all ${
                alreadyInvited
                  ? 'bg-[#10b981]/10 text-[#10b981] cursor-default'
                  : isSending
                  ? 'bg-harvest/10 text-harvest/60 cursor-not-allowed'
                  : 'bg-harvest/10 text-harvest hover:bg-harvest/20 active:scale-95'
              }`}
            >
              {alreadyInvited ? (
                <><Check className="w-3 h-3" />Invited</>
              ) : isSending ? (
                <><Loader2 className="w-3 h-3 animate-spin" />Sending</>
              ) : (
                <><UserPlus className="w-3 h-3" />Invite</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// REGISTRATION SECTION BLOCK
// ═══════════════════════════════════════════════════════

function RegistrationSection({
  title,
  players,
  accentColor,
  icon: Icon,
  inviteCtx,
}: {
  title: string;
  players: any[];
  accentColor: string;
  icon: React.ElementType;
  inviteCtx?: InviteContextProps;
}) {
  if (players.length === 0) return null;
  return (
    <div className="bg-card rounded-2xl border-2 border-border p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 flex-shrink-0" style={{ color: accentColor }} />
        <h3 className="text-lg sm:text-xl font-bold text-foreground">
          {title}
        </h3>
        <span
          className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${accentColor}20`, color: accentColor }}
        >
          {players.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {players.map((player: any) => (
          <RegistrationCard key={player.id} player={player} inviteCtx={inviteCtx} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// REGISTRATION PLAYER LIST (Active Phases C2-C4)
// ═══════════════════════════════════════════════════════

function RegistrationPlayerList({
  players,
  inviteCtx,
}: {
  players: any[];
  inviteCtx?: InviteContextProps;
}) {
  // Bucket by type
  const coaches    = players.filter(p => p.registration_type === 'coach');
  const rostered   = players.filter(p => p.registration_type !== 'coach' && p.team_tag);
  const freeAgents = players.filter(p => p.registration_type !== 'coach' && !p.team_tag);

  if (players.length === 0) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-8 text-center">
        <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">No Players Registered Yet</h3>
        <p className="text-muted-foreground">Be the first to register when registration opens!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Coaches — sorted: assigned first, then alpha */}
      <RegistrationSection
        title="Coaches"
        players={[...coaches].sort((a, b) => {
          if (!!a.team_tag !== !!b.team_tag) return a.team_tag ? -1 : 1;
          return (a.player_name || '').localeCompare(b.player_name || '');
        })}
        accentColor="#8b5cf6"
        icon={Users}
        inviteCtx={inviteCtx}
      />

      {/* Rostered players — sorted by team_tag then name */}
      <RegistrationSection
        title="Rostered Players"
        players={[...rostered].sort((a, b) => {
          const tagCmp = (a.team_tag || '').localeCompare(b.team_tag || '');
          return tagCmp !== 0 ? tagCmp : (a.player_name || '').localeCompare(b.player_name || '');
        })}
        accentColor="#3b82f6"
        icon={Users}
      />

      {/* Free Agents — sorted by rank desc (highest first), then alpha */}
      <RegistrationSection
        title={`Free Agents${inviteCtx?.captainTeamId ? ' — Click Invite to add to your roster' : ''}`}
        players={[...freeAgents].sort((a, b) => {
          const aRank = a.badge_rank?.medal ? rankToNumeric(a.badge_rank.medal, a.badge_rank.stars || 0) : 0;
          const bRank = b.badge_rank?.medal ? rankToNumeric(b.badge_rank.medal, b.badge_rank.stars || 0) : 0;
          if (bRank !== aRank) return bRank - aRank;
          return (a.player_name || '').localeCompare(b.player_name || '');
        })}
        accentColor="#10b981"
        icon={Users}
        inviteCtx={inviteCtx}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN TAB COMPONENT
// ═══════════════════════════════════════════════════════

export function TournamentPlayersTab() {
  const { tournament, myRegistration, accessToken } = useTournament();
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Captain invite state: person_id → 'pending' | 'sending'
  const [pendingInvites, setPendingInvites] = useState<Record<string, 'pending' | 'sending'>>({});
  // My team as captain (if applicable)
  const [captainTeamId, setCaptainTeamId] = useState<string | null>(null);

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;
  const token = accessToken || localStorage.getItem('supabase_token') || publicAnonKey;

  useEffect(() => {
    if (!tournament) return;
    // C1 — Upcoming: no player data yet, skip fetch entirely
    if (tournament.status === 'upcoming') return;
    fetchPlayers();
  }, [tournament]);

  // If the user is a registered captain with an approved team, load their team + existing invites
  useEffect(() => {
    if (!tournament || !myRegistration) return;
    if (!['registration_closed', 'roster_lock'].includes(tournament.status)) return;
    loadCaptainContext();
  }, [tournament, myRegistration]);

  const loadCaptainContext = async () => {
    if (!tournament) return;
    try {
      // Fetch teams for this tournament to see if the user captains one
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournament.id}/teams`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const { teams } = await res.json();

      // Find a team where this user's person is the captain
      // The registrations endpoint sets person_id, but we need to match via myRegistration.person_id
      // The teams endpoint returns captain_person_id
      const myPersonId = (myRegistration as any)?.person_id;
      if (!myPersonId) return;

      const myTeam = (teams || []).find(
        (t: any) => t.captain_person_id === myPersonId && t.approval_status === 'approved'
      );

      if (!myTeam) return;
      setCaptainTeamId(myTeam.id);

      // Fetch existing pending invites for this team to pre-populate state
      const invRes = await fetch(`${apiBase}/kkup/tournaments/${tournament.id}/teams/${myTeam.id}/invites?status=pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!invRes.ok) return;
      const { invites } = await invRes.json();
      const invMap: Record<string, 'pending'> = {};
      for (const inv of (invites || [])) {
        if (inv.invitee?.id) invMap[inv.invitee.id] = 'pending';
      }
      setPendingInvites(invMap);
    } catch (err) {
      console.error('Non-critical: failed to load captain context:', err);
    }
  };

  const fetchPlayers = async () => {
    if (!tournament) return;
    setLoading(true);
    try {
      const finished = isFinished(tournament.status);

      const endpoint = finished
        ? `${apiBase}/kkup/tournaments/${tournament.id}/stats/players`
        : `${apiBase}/kkup/tournaments/${tournament.id}/registrations`;

      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setPlayers(data.players || data.registrations || []);
      }
    } catch (err) {
      console.error('Failed to fetch players:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = useCallback(async (personId: string, _isCoach: boolean) => {
    if (!tournament || !captainTeamId) return;
    setPendingInvites(prev => ({ ...prev, [personId]: 'sending' }));
    try {
      const res = await fetch(
        `${apiBase}/kkup/tournaments/${tournament.id}/teams/${captainTeamId}/invites`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ person_id: personId }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Invite sent!');
        setPendingInvites(prev => ({ ...prev, [personId]: 'pending' }));
      } else {
        toast.error(data.error || 'Failed to send invite.');
        setPendingInvites(prev => {
          const next = { ...prev };
          delete next[personId];
          return next;
        });
      }
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
      setPendingInvites(prev => {
        const next = { ...prev };
        delete next[personId];
        return next;
      });
    }
  }, [tournament, captainTeamId, token, apiBase]);

  if (!tournament) return null;

  // C1 — Upcoming phase: no players registered, nothing to show
  if (tournament.status === 'upcoming') {
    return (
      <>
        <TabNoData
          icon={Users}
          title="No Player Data Available"
          subtitle="Player registrations haven't opened yet. This tab will populate once players start signing up."
          hint="Available from: Registration Open"
        />
        <Footer />
      </>
    );
  }

  const finished = isFinished(tournament.status);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-harvest" />
          <div className="text-muted-foreground">Loading players...</div>
        </div>
      </div>
    );
  }

  // For header stats: only count players (not coaches) — coaches don't count against capacity
  const playerOnlyList = finished ? players : players.filter(p => p.registration_type !== 'coach');

  const inviteCtx: InviteContextProps | undefined = (!finished && captainTeamId)
    ? {
        captainTeamId,
        pendingInvites,
        onInvite: handleInvite,
        tournamentStatus: tournament.status,
      }
    : undefined;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PlayerStatsHeader
        tournament={tournament}
        playerCount={playerOnlyList.length}
        players={playerOnlyList}
      />

      {finished ? (
        <PlayerLeaderboard players={players} />
      ) : (
        <RegistrationPlayerList players={players} inviteCtx={inviteCtx} />
      )}

      <Footer />
    </div>
  );
}