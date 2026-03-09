/**
 * Live Match Panel — Real-time scoreboard for active Dota 2 league games.
 * 
 * Data-source agnostic: accepts normalized LiveGame data and renders it.
 * Used by both practice-tournament-page and tournament-hub-page (when live).
 * 
 * Supports match phases: waiting, drafting, strategy, playing
 * Shows pick/ban data during draft and in-game phases.
 */

import { useState, useEffect, useRef } from 'react';
import { Radio, Clock, Eye, ChevronDown, ChevronUp, Swords, Ban, Shield, RefreshCw } from 'lucide-react';
import { getHeroImageUrl } from '@/utils/dota-constants';
import { TeamLogo } from '@/app/components/team-logo';
import { LiveMinimap } from '@/app/components/live-match-minimap';
import { LiveMatchStats } from '@/app/components/live-match-stats';
import { RANK_MEDALS, getRankBadgeUrl, numericToRank } from '@/lib/rank-utils';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface LiveItem {
  id: number;
  name: string;
}

interface LivePlayer {
  account_id: number;
  name: string;
  hero_id: number;
  hero_name: string;
  kills: number;
  deaths: number;
  assists: number;
  last_hits: number;
  denies: number;
  gpm: number;
  xpm: number;
  net_worth: number;
  level: number;
  // Rich live data
  position_x?: number;
  position_y?: number;
  items?: LiveItem[];
  respawn_timer?: number;
  ultimate_state?: number; // 0=not learned, 1=cooldown, 2=no mana, 3=ready
  ultimate_cooldown?: number;
  // Rank data from OpenDota
  rank_tier?: number | null; // e.g. 53 = Ancient 3, 71 = Immortal
}

export type GamePhase = 'waiting' | 'drafting' | 'strategy' | 'playing';

export interface LiveGame {
  match_id: number;
  lobby_id?: number;
  game_number?: number;
  spectators: number;
  stream_delay_s: number;
  duration: number;
  phase?: GamePhase;
  series_type: number;
  radiant_series_wins: number;
  dire_series_wins: number;
  radiant_team: {
    id: number;
    name: string;
    tag: string;
    logo_url: string | null;
  };
  dire_team: {
    id: number;
    name: string;
    tag: string;
    logo_url: string | null;
  };
  radiant_score: number;
  dire_score: number;
  radiant_tower_state: number;
  dire_tower_state: number;
  radiant_barracks_state?: number;
  dire_barracks_state?: number;
  radiant_picks?: HeroPick[];
  dire_picks?: HeroPick[];
  radiant_bans?: HeroPick[];
  dire_bans?: HeroPick[];
  radiant_players: LivePlayer[];
  dire_players: LivePlayer[];
}

interface LiveMatchPanelProps {
  games: LiveGame[];
  polledAt?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** If provided, shows a countdown to next auto-refresh */
  pollIntervalMs?: number;
  /** If true, shows TCF+ badge on the progress bar; if false, shows subtle upsell */
  isTcfPlus?: boolean;
}

// ═══════════════════════════════════════════════════════
// PHASE CONFIG — UI driven by config, not conditionals
// ═══════════════════════════════════════════════════════

const PHASE_CONFIG: Record<GamePhase, { label: string; color: string; bgColor: string; borderColor: string; glowColor: string; pulse: boolean }> = {
  waiting:   { label: 'Waiting',   color: '#f59e0b', bgColor: 'rgba(245,158,11,0.15)',  borderColor: 'rgba(245,158,11,0.3)',  glowColor: 'rgba(245,158,11,0.1)',  pulse: true },
  drafting:  { label: 'Drafting',  color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.15)',   borderColor: 'rgba(139,92,246,0.3)',  glowColor: 'rgba(139,92,246,0.1)',  pulse: true },
  strategy:  { label: 'Strategy',  color: '#3b82f6', bgColor: 'rgba(59,130,246,0.15)',   borderColor: 'rgba(59,130,246,0.3)',  glowColor: 'rgba(59,130,246,0.1)',  pulse: false },
  playing:   { label: 'In Game',   color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)',    borderColor: 'rgba(239,68,68,0.3)',   glowColor: 'rgba(239,68,68,0.1)',   pulse: true },
};

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(Math.floor(s)).padStart(2, '0')}`;
}

function getSeriesLabel(type: number): string {
  if (type === 1) return 'Bo3';
  if (type === 2) return 'Bo5';
  return '';
}

// Dota 2 hero portrait images are ~128x72 (roughly 16:9)
const HERO_ASPECT = '16/9';

/** Convert OpenDota rank_tier (e.g. 53) to medal + stars display */
function rankTierToDisplay(rankTier: number | null | undefined): { medal: string; stars: number; badgeUrl: string } | null {
  if (!rankTier || rankTier <= 0) return null;
  const tier = Math.floor(rankTier / 10); // 1=Herald, 2=Guardian, ..., 7=Immortal, 8=Immortal top
  const stars = rankTier % 10;
  const medalNames: Record<number, string> = {
    1: 'Herald', 2: 'Guardian', 3: 'Crusader', 4: 'Archon',
    5: 'Legend', 6: 'Ancient', 7: 'Divine', 8: 'Immortal',
  };
  const medal = medalNames[tier] || 'Immortal';
  return { medal, stars, badgeUrl: getRankBadgeUrl(medal, stars) };
}

/** Calculate team average rank from player rank_tiers */
function getTeamAvgRank(players: LivePlayer[]): { medal: string; stars: number; badgeUrl: string; count: number } | null {
  const validTiers = players.map(p => p.rank_tier).filter((t): t is number => !!t && t > 0);
  if (validTiers.length === 0) return null;
  const avgTier = Math.round(validTiers.reduce((s, t) => s + t, 0) / validTiers.length);
  const display = rankTierToDisplay(avgTier);
  if (!display) return null;
  return { ...display, count: validTiers.length };
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export function LiveMatchPanel({ games, polledAt, onRefresh, refreshing, pollIntervalMs, isTcfPlus }: LiveMatchPanelProps) {
  // Visual countdown — resets when polledAt changes (parent did a poll)
  const pollIntervalSec = pollIntervalMs ? Math.round(pollIntervalMs / 1000) : 0;
  const [secondsLeft, setSecondsLeft] = useState(pollIntervalSec);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset countdown whenever a new poll completes
  useEffect(() => {
    if (!pollIntervalSec) return;
    setSecondsLeft(pollIntervalSec);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [polledAt, pollIntervalSec]);

  // Progress fraction (1 = just polled, 0 = about to poll)
  const progress = pollIntervalSec > 0 ? secondsLeft / pollIntervalSec : 0;

  if (games.length === 0) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-6 sm:p-8 text-center">
        <Radio className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
        <p className="text-muted-foreground font-semibold">No live games right now</p>
        <p className="text-sm text-muted-foreground mt-1">Games will appear here when matches are in progress</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="px-4 py-2 rounded-lg bg-harvest text-white font-bold text-sm hover:bg-harvest/90 transition-all disabled:opacity-50"
            >
              {refreshing ? 'Checking...' : 'Check Now'}
            </button>
          )}
          {pollIntervalSec > 0 && (
            <span className="text-xs text-muted-foreground">
              Auto-checking every {pollIntervalSec}s
              {isTcfPlus && <span className="ml-1 text-harvest font-bold">(TCF+)</span>}
              {secondsLeft > 0 && !refreshing && <span className="ml-1">({secondsLeft}s)</span>}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live indicator header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef4444] opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#ef4444]" />
          </span>
          <span className="font-black text-[#ef4444] text-sm uppercase tracking-wide">
            {games.length} Live {games.length === 1 ? 'Game' : 'Games'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {polledAt && (
            <span className="text-xs text-muted-foreground">
              Updated {new Date(polledAt).toLocaleTimeString()}
            </span>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-lg bg-[#ef4444]/10 text-[#ef4444] font-bold text-xs hover:bg-[#ef4444]/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      {/* Auto-refresh progress bar */}
      {pollIntervalSec > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-[#ef4444]/40 transition-all duration-1000 ease-linear"
              style={{ width: `${(1 - progress) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground font-semibold tabular-nums w-8 text-right flex-shrink-0">
            {refreshing ? (
              <RefreshCw className="w-3 h-3 animate-spin inline" />
            ) : (
              `${secondsLeft}s`
            )}
          </span>
          {isTcfPlus ? (
            <span className="text-[10px] font-bold bg-harvest/15 text-harvest px-2 py-0.5 rounded-full flex-shrink-0">
              TCF+ · 10s
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex-shrink-0 hidden sm:inline-flex">
              TCF+ gets 10s refresh
            </span>
          )}
        </div>
      )}

      {/* Game cards */}
      {games.map((game) => (
        <LiveGameCard key={game.match_id} game={game} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PHASE BADGE
// ═══════════════════════════════════════════════════════

function PhaseBadge({ phase }: { phase: GamePhase }) {
  const config = PHASE_CONFIG[phase];

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider"
      style={{ color: config.color, backgroundColor: config.bgColor }}
    >
      {config.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: config.color }}
          />
          <span
            className="relative inline-flex rounded-full h-1.5 w-1.5"
            style={{ backgroundColor: config.color }}
          />
        </span>
      )}
      {config.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════
// DRAFT PANEL — Bans & Picks
// ═══════════════════════════════════════════════════════

function DraftPanel({ game }: { game: LiveGame }) {
  const radiantPicks = game.radiant_picks || [];
  const direPicks = game.dire_picks || [];
  const radiantBans = game.radiant_bans || [];
  const direBans = game.dire_bans || [];

  const hasPicks = radiantPicks.length > 0 || direPicks.length > 0;
  const hasBans = radiantBans.length > 0 || direBans.length > 0;

  if (!hasPicks && !hasBans) return null;

  return (
    <div className="mt-4 space-y-3">
      {/* Bans row — compact, greyscale with red slash */}
      {hasBans && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Ban className="w-3 h-3 text-white/30" />
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Bans</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-1 justify-start flex-wrap">
              {radiantBans.map((b, i) => (
                <HeroBan key={`rb-${i}`} pick={b} />
              ))}
              {Array.from({ length: Math.max(0, 7 - radiantBans.length) }).map((_, i) => (
                <div key={`erb-${i}`} className="w-8 h-[18px] sm:w-9 sm:h-[20px] rounded-sm border border-dashed border-white/10 bg-white/5" />
              ))}
            </div>
            <div className="flex items-center gap-1 justify-end flex-wrap">
              {Array.from({ length: Math.max(0, 7 - direBans.length) }).map((_, i) => (
                <div key={`edb-${i}`} className="w-8 h-[18px] sm:w-9 sm:h-[20px] rounded-sm border border-dashed border-white/10 bg-white/5" />
              ))}
              {direBans.map((b, i) => (
                <HeroBan key={`db-${i}`} pick={b} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Picks row — full color, proper aspect ratio */}
      {hasPicks && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Shield className="w-3 h-3 text-white/30" />
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Picks</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-1 justify-start">
              {radiantPicks.map((p, i) => (
                <HeroPickImg key={`rp-${i}`} pick={p} side="radiant" />
              ))}
              {Array.from({ length: Math.max(0, 5 - radiantPicks.length) }).map((_, i) => (
                <div key={`erp-${i}`} className="w-10 sm:w-12 rounded-sm border border-dashed border-[#10b981]/15 bg-[#10b981]/5" style={{ aspectRatio: HERO_ASPECT }} />
              ))}
            </div>
            <div className="flex items-center gap-1 justify-end">
              {Array.from({ length: Math.max(0, 5 - direPicks.length) }).map((_, i) => (
                <div key={`edp-${i}`} className="w-10 sm:w-12 rounded-sm border border-dashed border-[#ef4444]/15 bg-[#ef4444]/5" style={{ aspectRatio: HERO_ASPECT }} />
              ))}
              {direPicks.map((p, i) => (
                <HeroPickImg key={`dp-${i}`} pick={p} side="dire" />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** A single banned hero — greyscale with red slash */
function HeroBan({ pick }: { pick: HeroPick }) {
  return (
    <div className="relative group">
      <img
        src={getHeroImageUrl(pick.hero_id)}
        alt={pick.hero_name}
        className="w-8 h-auto sm:w-9 rounded-sm border border-white/10 bg-black/30 grayscale opacity-40 object-cover"
        style={{ aspectRatio: HERO_ASPECT }}
        width={36}
        height={20}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[120%] h-[1.5px] bg-[#ef4444]/70 -rotate-45" />
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-soil/95 text-white text-[9px] font-bold rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-white/10">
        {pick.hero_name}
      </div>
    </div>
  );
}

/** A single picked hero — full color with team-colored border */
function HeroPickImg({ pick, side }: { pick: HeroPick; side: 'radiant' | 'dire' }) {
  const borderCls = side === 'radiant' ? 'border-[#10b981]/50' : 'border-[#ef4444]/50';

  return (
    <div className="relative group">
      <img
        src={getHeroImageUrl(pick.hero_id)}
        alt={pick.hero_name}
        className={`w-10 h-auto sm:w-12 rounded-sm border ${borderCls} bg-black/30 object-cover`}
        style={{ aspectRatio: HERO_ASPECT }}
        width={48}
        height={27}
      />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-soil/95 text-white text-[9px] font-bold rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-white/10">
        {pick.hero_name}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// LIVE GAME CARD
// ═══════════════════════════════════════════════════════

function LiveGameCard({ game }: { game: LiveGame }) {
  const [expanded, setExpanded] = useState(false);
  const seriesLabel = getSeriesLabel(game.series_type);
  const radiantLeads = game.radiant_score > game.dire_score;
  const phase = game.phase || 'playing';
  const phaseConfig = PHASE_CONFIG[phase];
  const isDraftPhase = phase === 'drafting' || phase === 'strategy' || phase === 'waiting';
  const hasDraftData = (game.radiant_picks?.length || 0) + (game.dire_picks?.length || 0) +
                       (game.radiant_bans?.length || 0) + (game.dire_bans?.length || 0) > 0;
  const hasPlayers = game.radiant_players.length > 0;

  return (
    <div
      className="bg-card rounded-2xl border-2 overflow-hidden"
      style={{ borderColor: phaseConfig.borderColor, boxShadow: `0 0 20px ${phaseConfig.glowColor}` }}
    >
      {/* Scoreboard Header */}
      <div className="bg-gradient-to-r from-soil to-[#1e293b] p-4 sm:p-5">
        {/* Status bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <PhaseBadge phase={phase} />
            {seriesLabel && (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/80 text-xs font-bold">
                {seriesLabel}
                {(game.radiant_series_wins > 0 || game.dire_series_wins > 0) && (
                  <span className="ml-1">({game.radiant_series_wins}-{game.dire_series_wins})</span>
                )}
              </span>
            )}
            {game.game_number && game.game_number > 1 && (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-[10px] font-bold">
                Game {game.game_number}
              </span>
            )}
            {game.spectators > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-[10px] font-bold">
                <Eye className="w-3 h-3" />
                {game.spectators.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Main Scoreboard — Teams + Score */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          {/* Radiant Team */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <TeamLogo logoUrl={game.radiant_team.logo_url} teamName={game.radiant_team.name} size="md" />
            <div className="min-w-0">
              <p className="font-black text-white text-sm sm:text-base truncate">{game.radiant_team.name}</p>
              <p className="text-[10px] sm:text-xs text-white/50 font-semibold">Radiant</p>
            </div>
          </div>

          {/* Score / VS */}
          <div className="text-center px-2 sm:px-4">
            {isDraftPhase && game.radiant_score === 0 && game.dire_score === 0 ? (
              <span className="text-lg sm:text-2xl font-black" style={{ color: phaseConfig.color }}>VS</span>
            ) : (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2 sm:gap-4">
                  <span className={`text-2xl sm:text-4xl font-black ${radiantLeads ? 'text-[#10b981]' : 'text-white/80'}`}>
                    {game.radiant_score}
                  </span>
                  <Swords className="w-4 h-4 sm:w-5 sm:h-5 text-white/30" />
                  <span className={`text-2xl sm:text-4xl font-black ${!radiantLeads ? 'text-[#ef4444]' : 'text-white/80'}`}>
                    {game.dire_score}
                  </span>
                </div>
                {phase === 'playing' && game.duration > 0 && (
                  <span className="flex items-center gap-1 text-white/50 text-xs font-semibold mt-1">
                    <Clock className="w-3 h-3" />
                    {formatDuration(game.duration)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Dire Team */}
          <div className="flex items-center gap-2 sm:gap-3 justify-end min-w-0">
            <div className="min-w-0 text-right">
              <p className="font-black text-white text-sm sm:text-base truncate">{game.dire_team.name}</p>
              <p className="text-[10px] sm:text-xs text-white/50 font-semibold">Dire</p>
            </div>
            <TeamLogo logoUrl={game.dire_team.logo_url} teamName={game.dire_team.name} size="md" />
          </div>
        </div>

        {/* Draft picks/bans — shown whenever draft data exists */}
        {hasDraftData && (
          <DraftPanel game={game} />
        )}

        {/* In-game hero row — ONLY when playing AND no draft data (so we don't double-show heroes) */}
        {phase === 'playing' && !hasDraftData && hasPlayers && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-1 justify-start">
              {game.radiant_players.map((p, i) => (
                <div key={i} className="relative group">
                  <img
                    src={getHeroImageUrl(p.hero_id)}
                    alt={p.hero_name}
                    className="w-10 h-auto sm:w-12 rounded-sm border border-[#10b981]/40 bg-black/30 object-cover"
                    style={{ aspectRatio: HERO_ASPECT }}
                    width={48}
                    height={27}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-soil/95 text-white text-[9px] font-bold rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-white/10">
                    {p.name || p.hero_name} ({p.kills}/{p.deaths}/{p.assists})
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1 justify-end">
              {game.dire_players.map((p, i) => (
                <div key={i} className="relative group">
                  <img
                    src={getHeroImageUrl(p.hero_id)}
                    alt={p.hero_name}
                    className="w-10 h-auto sm:w-12 rounded-sm border border-[#ef4444]/40 bg-black/30 object-cover"
                    style={{ aspectRatio: HERO_ASPECT }}
                    width={48}
                    height={27}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-soil/95 text-white text-[9px] font-bold rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-white/10">
                    {p.name || p.hero_name} ({p.kills}/{p.deaths}/{p.assists})
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Expand toggle — show when we have player stats */}
      {hasPlayers && phase === 'playing' && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Hide Details' : 'Show Player Stats'}
          </button>

          {/* Expanded player details */}
          {expanded && (
            <div className="p-3 sm:p-4 border-t border-border space-y-4">
              {/* Left: Minimap + Stats | Right: Player panels */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
                {/* Left column: Minimap + Stats */}
                <div className="space-y-3">
                  {/* Minimap — fills column width */}
                  <div className="w-full max-w-[400px] mx-auto lg:mx-0">
                    <LiveMinimap game={game} />
                  </div>

                  {/* Stats stacked vertically below minimap */}
                  <div className="hidden lg:block">
                    <LiveMatchStats game={game} compact />
                  </div>
                </div>

                {/* Right column: Player details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <TeamRankHeader label="Radiant" color="#10b981" players={game.radiant_players} />
                    <div className="space-y-1.5">
                      {game.radiant_players.map((p, i) => (
                        <PlayerStatRow key={i} player={p} side="radiant" />
                      ))}
                    </div>
                  </div>
                  <div>
                    <TeamRankHeader label="Dire" color="#ef4444" players={game.dire_players} />
                    <div className="space-y-1.5">
                      {game.dire_players.map((p, i) => (
                        <PlayerStatRow key={i} player={p} side="dire" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats — full-width fallback on smaller screens */}
              <div className="lg:hidden">
                <LiveMatchStats game={game} />
              </div>

              {/* Stream delay */}
              {game.stream_delay_s > 0 && (
                <div className="text-center">
                  <span className="text-[10px] text-muted-foreground font-semibold bg-muted px-2 py-0.5 rounded-full">
                    {Math.floor(game.stream_delay_s / 60)}:{String(game.stream_delay_s % 60).padStart(2, '0')} stream delay
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PLAYER STAT ROW
// ═══════════════════════════════════════════════════════

function PlayerStatRow({ player, side }: { player: LivePlayer; side: 'radiant' | 'dire' }) {
  const borderColor = side === 'radiant' ? 'border-[#10b981]/20' : 'border-[#ef4444]/20';
  const isDead = (player.respawn_timer || 0) > 0;
  const ultState = player.ultimate_state ?? 0;
  // 0=not learned, 1=cooldown, 2=no mana, 3=ready
  const ultColor = ultState === 3 ? '#10b981' : ultState === 2 ? '#3b82f6' : ultState === 1 ? '#6b7280' : '#374151';
  const ultLabel = ultState === 3 ? 'Ready' : ultState === 2 ? 'No Mana' : ultState === 1 ? `${player.ultimate_cooldown || 0}s` : '';
  const items = player.items || [];
  const hasItems = items.some(item => typeof item === 'object' ? item.id > 0 : item > 0);

  return (
    <div className={`p-2 rounded-lg border ${borderColor} bg-background ${isDead ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2">
        {/* Hero portrait */}
        <div className="relative flex-shrink-0">
          <img
            src={getHeroImageUrl(player.hero_id)}
            alt={player.hero_name}
            className={`w-10 h-auto rounded-sm border border-border bg-black/20 object-cover ${isDead ? 'grayscale' : ''}`}
            style={{ aspectRatio: HERO_ASPECT }}
            width={40}
            height={23}
          />
          {isDead && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[8px] font-black text-[#ef4444] bg-black/70 px-1 rounded">{player.respawn_timer}s</span>
            </div>
          )}
          {/* Ult indicator dot */}
          {ultState > 0 && (
            <div
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-background"
              style={{ backgroundColor: ultColor }}
              title={`Ult: ${ultLabel}`}
            />
          )}
        </div>

        {/* Player name + hero */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-xs font-bold text-foreground truncate">{player.name || player.hero_name}</p>
            {/* Rank badge */}
            {(() => {
              const rank = rankTierToDisplay(player.rank_tier);
              if (!rank) return null;
              return (
                <div className="relative group flex-shrink-0">
                  <img
                    src={rank.badgeUrl}
                    alt={`${rank.medal} ${rank.stars}`}
                    className="w-4 h-4 object-contain"
                    width={16}
                    height={16}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-soil/95 text-white text-[9px] font-bold rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-white/10">
                    {rank.medal}{rank.stars > 0 ? ` ${rank.stars}` : ''}
                  </div>
                </div>
              );
            })()}
          </div>
          {player.name && (
            <p className="text-[10px] text-muted-foreground truncate">Lv {player.level} &bull; {player.hero_name}</p>
          )}
          {!player.name && (
            <p className="text-[10px] text-muted-foreground truncate">Lv {player.level}</p>
          )}
        </div>

        {/* Net worth (mobile-friendly) */}
        <div className="text-right">
          <p className="hidden sm:block text-xs font-bold text-harvest">{player.net_worth.toLocaleString()}</p>
          <p className="sm:hidden text-xs font-bold text-harvest">{(player.net_worth / 1000).toFixed(1)}k</p>
          <p className="text-[9px] text-muted-foreground font-bold uppercase">Gold</p>
        </div>

        {/* KDA */}
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-black text-foreground">{player.kills}/{player.deaths}/{player.assists}</p>
          <p className="text-[9px] text-muted-foreground font-bold uppercase">KDA</p>
        </div>

        {/* CS - desktop only */}
        <div className="text-right hidden sm:block flex-shrink-0">
          <p className="text-xs font-bold text-foreground">{player.last_hits}/{player.denies}</p>
          <p className="text-[9px] text-muted-foreground font-bold uppercase">CS</p>
        </div>
      </div>

      {/* Item row */}
      {hasItems && (
        <div className="flex items-center gap-0.5 mt-1.5 ml-12">
          {items.map((item, idx) => {
            // Support both new {id, name} objects and legacy plain IDs
            const itemId = typeof item === 'object' ? item.id : item;
            const itemName = typeof item === 'object' && item.name ? item.name : '';
            const imgUrl = itemName
              ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${itemName}.png`
              : '';
            const displayName = itemName || (itemId ? `Item ${itemId}` : '');

            return (
              <div key={idx} className="relative group">
                {itemId > 0 ? (
                  <>
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={displayName}
                        className="w-6 h-[18px] sm:w-7 sm:h-[21px] rounded-[2px] border border-border bg-black/30 object-cover"
                        width={28}
                        height={21}
                        onError={(e) => {
                          // Hide broken images, show placeholder
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-6 h-[18px] sm:w-7 sm:h-[21px] rounded-[2px] border border-border/50 bg-muted/30 flex items-center justify-center ${imgUrl ? 'hidden' : ''}`}>
                      <span className="text-[7px] text-muted-foreground font-bold">?</span>
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-soil/95 text-white text-[9px] font-bold rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-white/10">
                      {displayName}
                    </div>
                  </>
                ) : (
                  <div className="w-6 h-[18px] sm:w-7 sm:h-[21px] rounded-[2px] border border-border/50 bg-muted/30" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TEAM RANK HEADER
// ═══════════════════════════════════════════════════════

function TeamRankHeader({ label, color, players }: { label: string; color: string; players: LivePlayer[] }) {
  const avgRank = getTeamAvgRank(players);

  return (
    <div className="flex items-center gap-2 mb-2">
      <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color }}>
        {label}
      </h4>
      {avgRank && (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted/50">
          <img
            src={avgRank.badgeUrl}
            alt={`Avg: ${avgRank.medal} ${avgRank.stars}`}
            className="w-4 h-4 object-contain"
            width={16}
            height={16}
          />
          <span className="text-[10px] font-bold text-muted-foreground">
            ~{avgRank.medal}{avgRank.stars > 0 ? ` ${avgRank.stars}` : ''}
          </span>
        </div>
      )}
    </div>
  );
}