/**
 * Tournament Hub — Bracket Tab
 *
 * Visual bracket tree: QF → SF → GF (left-to-right).
 * - Team logos + names
 * - Series score pills (TI-style dots that light up per win)
 * - Red blinking dot for live series
 * - Visual cues for pending/live/completed states
 * - Horizontal scroll on mobile
 * - Owner controls: generate, delete, reset channels, record results
 *
 * Receives all data via props from the orchestrator (tournament-hub-page.tsx).
 */

import { useState } from 'react';
import { Trophy, Swords, Loader2, GitBranch, AlertCircle, Crown, Volume2, Trash2, Play, CheckCircle } from '@/lib/icons';
import { TeamLogo } from '@/app/components/team-logo';
import { resolveTeamLogoUrl } from '@/lib/team-logo-utils';
import { TournamentHubEmptyState } from './tournament-hub-empty-state';

// ── Types ────────────────────────────────────────────────────────────

interface BracketTeam {
  id: string;
  team_name: string;
  team_tag?: string | null;
  logo_url?: string | null;
}

interface BracketMatch {
  id: string;
  series_id: string;
  game_number: number;
  status: 'pending' | 'live' | 'completed';
  winner_team_id?: string | null;
  radiant_team_id?: string | null;
  dire_team_id?: string | null;
  steam_match_id?: string | null;
}

interface BracketSeries {
  id: string;
  tournament_id: string;
  round: 'QF' | 'SF' | 'GF';
  position: number;
  best_of: number;
  status: 'pending' | 'live' | 'completed' | 'bye';
  seed_radiant?: number | null;
  seed_dire?: number | null;
  radiant_team_id?: string | null;
  dire_team_id?: string | null;
  winner_team_id?: string | null;
  radiant_team?: BracketTeam | null;
  dire_team?: BracketTeam | null;
  winner_team?: BracketTeam | null;
  next_series_id?: string | null;
  next_series_slot?: 'radiant' | 'dire' | null;
  completed_at?: string | null;
  matches: BracketMatch[];
}

interface BracketData {
  QF: BracketSeries[];
  SF: BracketSeries[];
  GF: BracketSeries[];
}

interface TournamentHubBracketProps {
  bracket: BracketData | null;
  loading: boolean;
  error?: string | null;
  isOwner: boolean;
  tournamentStatus: string;
  onGenerateBracket?: () => Promise<void>;
  onDeleteBracket?: () => Promise<void>;
  onResetChannels?: () => Promise<void>;
  onRecordSeriesResult?: (seriesId: string, winnerTeamId: string) => Promise<void>;
  generating?: boolean;
  deleting?: boolean;
  isRelevant?: boolean;
}

// ── Status styling config ────────────────────────────────────────────

const SERIES_STATUS_STYLES: Record<string, { bg: string; border: string; label: string; labelColor: string }> = {
  pending:   { bg: 'bg-muted/50', border: 'border-border',        label: 'Upcoming',   labelColor: 'text-muted-foreground' },
  live:      { bg: 'bg-card',     border: 'border-[#ef4444]/50',  label: 'LIVE',       labelColor: 'text-[#ef4444]' },
  completed: { bg: 'bg-card',     border: 'border-border',        label: 'Completed',  labelColor: 'text-[#10b981]' },
  bye:       { bg: 'bg-muted/30', border: 'border-border/50',     label: 'BYE',        labelColor: 'text-muted-foreground' },
};

const ROUND_LABELS: Record<string, string> = {
  QF: 'Quarterfinals',
  SF: 'Semifinals',
  GF: 'Grand Final',
};

const ROUND_COLORS: Record<string, string> = {
  QF: '#3b82f6',
  SF: '#8b5cf6',
  GF: '#d6a615',
};

// ── Helpers ──────────────────────────────────────────────────────────

function getSeriesScore(series: BracketSeries): { radiant: number; dire: number } {
  let radiant = 0;
  let dire = 0;
  for (const match of series.matches) {
    if (match.status === 'completed' && match.winner_team_id) {
      if (match.winner_team_id === series.radiant_team_id) radiant++;
      else if (match.winner_team_id === series.dire_team_id) dire++;
    }
  }
  return { radiant, dire };
}

function getWinsNeeded(bestOf: number): number {
  return Math.ceil(bestOf / 2);
}

// ── Main Component ───────────────────────────────────────────────────

export function TournamentHubBracket({
  bracket,
  loading,
  error,
  isOwner,
  tournamentStatus,
  onGenerateBracket,
  onDeleteBracket,
  onResetChannels,
  onRecordSeriesResult,
  generating,
  deleting,
  isRelevant,
}: TournamentHubBracketProps) {

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-harvest" />
        <p className="font-semibold">Loading bracket...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <AlertCircle className="w-10 h-10 mb-3 text-[#ef4444]" />
        <p className="font-bold text-foreground">Failed to load bracket</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!bracket) {
    const canGenerate = isOwner && ['roster_lock', 'registration_closed'].includes(tournamentStatus);
    return (
      <TournamentHubEmptyState
        canGenerate={canGenerate}
        isOwner={isOwner}
        tournamentStatus={tournamentStatus}
        onGenerateBracket={onGenerateBracket}
        generating={generating}
      />
    );
  }

  // Collect all series for result recording
  const allSeries = [...bracket.QF, ...bracket.SF, ...bracket.GF];
  const pendingSeries = allSeries.filter(s =>
    s.status !== 'completed' && s.status !== 'bye' && s.radiant_team_id && s.dire_team_id
  );

  return (
    <div className="space-y-4">
      {/* Owner Toolbar */}
      {isOwner && (
        <OwnerToolbar
          bracket={bracket}
          tournamentStatus={tournamentStatus}
          pendingSeries={pendingSeries}
          onDeleteBracket={onDeleteBracket}
          onResetChannels={onResetChannels}
          onRecordSeriesResult={onRecordSeriesResult}
          deleting={deleting}
        />
      )}

      {/* Champion Banner — show when GF is complete */}
      {bracket.GF[0]?.status === 'completed' && bracket.GF[0]?.winner_team && (
        <ChampionBanner team={bracket.GF[0].winner_team} />
      )}

      {/* Bracket Tree — horizontal scroll on mobile */}
      <div className="overflow-x-auto pb-4">
        <div className="min-w-[820px] flex items-stretch gap-0">
          {/* QF Column */}
          <RoundColumn round="QF" series={bracket.QF} allSeries={bracket} />
          {/* Connectors QF→SF */}
          <ConnectorColumn fromCount={4} toCount={2} />
          {/* SF Column */}
          <RoundColumn round="SF" series={bracket.SF} allSeries={bracket} />
          {/* Connectors SF→GF */}
          <ConnectorColumn fromCount={2} toCount={1} />
          {/* GF Column */}
          <RoundColumn round="GF" series={bracket.GF} allSeries={bracket} />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse" />
          Live
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#10b981]" />
          Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
          Upcoming
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-harvest/20 border border-harvest/40 flex items-center justify-center text-[8px]">●</span>
          Game win
        </span>
      </div>
    </div>
  );
}

// ── Owner Toolbar ────────────────────────────────────────────────────

function OwnerToolbar({
  bracket,
  tournamentStatus,
  pendingSeries,
  onDeleteBracket,
  onResetChannels,
  onRecordSeriesResult,
  deleting,
}: {
  bracket: BracketData;
  tournamentStatus: string;
  pendingSeries: BracketSeries[];
  onDeleteBracket?: () => Promise<void>;
  onResetChannels?: () => Promise<void>;
  onRecordSeriesResult?: (seriesId: string, winnerTeamId: string) => Promise<void>;
  deleting?: boolean;
}) {
  const [resultPicker, setResultPicker] = useState<BracketSeries | null>(null);
  const [recording, setRecording] = useState(false);
  const [resettingChannels, setResettingChannels] = useState(false);

  const canDelete = !['live', 'completed'].includes(tournamentStatus);
  const isLive = tournamentStatus === 'live';

  const handleRecordResult = async (seriesId: string, winnerTeamId: string) => {
    if (!onRecordSeriesResult) return;
    setRecording(true);
    try {
      await onRecordSeriesResult(seriesId, winnerTeamId);
      setResultPicker(null);
    } finally {
      setRecording(false);
    }
  };

  const handleResetChannels = async () => {
    if (!onResetChannels) return;
    setResettingChannels(true);
    try {
      await onResetChannels();
    } finally {
      setResettingChannels(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Action buttons row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Delete bracket — only when not live/completed */}
        {canDelete && onDeleteBracket && (
          <button
            onClick={onDeleteBracket}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ef4444]/10 text-[#ef4444] font-bold text-xs border border-[#ef4444]/20 hover:bg-[#ef4444]/20 transition-all disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {deleting ? 'Deleting...' : 'Delete Bracket'}
          </button>
        )}

        {/* Reset voice channels */}
        {onResetChannels && (
          <button
            onClick={handleResetChannels}
            disabled={resettingChannels}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground font-bold text-xs border border-border hover:border-harvest/30 hover:text-foreground transition-all disabled:opacity-50"
          >
            {resettingChannels ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
            {resettingChannels ? 'Resetting...' : 'Reset Voice Channels'}
          </button>
        )}

        {/* Record series result — only when tournament is live */}
        {isLive && onRecordSeriesResult && pendingSeries.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setResultPicker(resultPicker ? null : pendingSeries[0])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-harvest/10 text-harvest font-bold text-xs border border-harvest/20 hover:bg-harvest/20 transition-all"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Record Series Result
            </button>
          </div>
        )}
      </div>

      {/* Result picker — pick series then pick winner */}
      {resultPicker && isLive && onRecordSeriesResult && (
        <div className="bg-card rounded-xl border-2 border-harvest/30 p-3 sm:p-4 space-y-3">
          <p className="text-xs font-bold text-foreground">Pick a series, then pick the winner:</p>

          {/* Series selector */}
          <div className="flex flex-wrap gap-2">
            {pendingSeries.map(s => {
              const rName = s.radiant_team?.team_tag || s.radiant_team?.team_name || 'TBD';
              const dName = s.dire_team?.team_tag || s.dire_team?.team_name || 'TBD';
              const isSelected = resultPicker.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setResultPicker(s)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    isSelected
                      ? 'bg-harvest/15 border-harvest/40 text-harvest'
                      : 'bg-muted border-border text-muted-foreground hover:border-harvest/20'
                  }`}
                >
                  {s.round}{s.position}: {rName} vs {dName}
                </button>
              );
            })}
          </div>

          {/* Winner buttons */}
          {resultPicker.radiant_team && resultPicker.dire_team && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Winner:</p>
              <button
                onClick={() => handleRecordResult(resultPicker.id, resultPicker.radiant_team_id!)}
                disabled={recording}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#10b981]/10 text-[#10b981] font-bold text-xs border border-[#10b981]/20 hover:bg-[#10b981]/20 transition-all disabled:opacity-50"
              >
                {recording ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crown className="w-3.5 h-3.5" />}
                {resultPicker.radiant_team.team_name}
              </button>
              <span className="text-xs text-muted-foreground text-center">or</span>
              <button
                onClick={() => handleRecordResult(resultPicker.id, resultPicker.dire_team_id!)}
                disabled={recording}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#10b981]/10 text-[#10b981] font-bold text-xs border border-[#10b981]/20 hover:bg-[#10b981]/20 transition-all disabled:opacity-50"
              >
                {recording ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crown className="w-3.5 h-3.5" />}
                {resultPicker.dire_team.team_name}
              </button>
              <button
                onClick={() => setResultPicker(null)}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Champion Banner ──────────────────────────────────────────────────

function ChampionBanner({ team }: { team: BracketTeam }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-harvest/15 via-kernel-gold/10 to-harvest/15 rounded-2xl border-2 border-harvest/30 p-4 sm:p-6">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')] opacity-50" />
      <div className="relative flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
        <div className="relative">
          <TeamLogo logoUrl={resolveTeamLogoUrl(team.logo_url, team.team_tag)} teamName={team.team_name} size="lg" />
          <Crown className="absolute -top-2 -right-2 w-6 h-6 text-kernel-gold drop-shadow-md" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-harvest">Champion</p>
          <h3 className="text-xl sm:text-2xl font-black text-foreground">{team.team_name}</h3>
        </div>
        <Trophy className="w-10 h-10 text-kernel-gold/60 ml-auto hidden sm:block" />
      </div>
    </div>
  );
}

// ── Round Column ─────────────────────────────────────────────────────

function RoundColumn({
  round,
  series,
  allSeries,
}: {
  round: string;
  series: BracketSeries[];
  allSeries: BracketData;
}) {
  const roundColor = ROUND_COLORS[round] || '#6b7280';

  return (
    <div className="flex flex-col flex-shrink-0" style={{ width: round === 'GF' ? '240px' : '220px' }}>
      {/* Round header */}
      <div className="text-center mb-3">
        <span
          className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
          style={{ backgroundColor: `${roundColor}18`, color: roundColor }}
        >
          {ROUND_LABELS[round] || round}
        </span>
      </div>

      {/* Series cards — vertically distributed */}
      <div
        className="flex flex-col justify-around flex-1"
        style={{ gap: round === 'QF' ? '12px' : round === 'SF' ? '24px' : '0px' }}
      >
        {series.map((s) => (
          <SeriesCard key={s.id} series={s} round={round} />
        ))}
      </div>
    </div>
  );
}

// ── Series Card (one matchup box) ────────────────────────────────────

function SeriesCard({ series, round }: { series: BracketSeries; round: string }) {
  const statusStyle = SERIES_STATUS_STYLES[series.status] || SERIES_STATUS_STYLES.pending;
  const score = getSeriesScore(series);
  const winsNeeded = getWinsNeeded(series.best_of);
  const isLive = series.status === 'live';
  const isComplete = series.status === 'completed';
  const isBye = series.status === 'bye';

  return (
    <div
      className={`${statusStyle.bg} rounded-xl border-2 ${statusStyle.border} p-2.5 transition-all ${
        isLive ? 'shadow-md shadow-[#ef4444]/10' : ''
      }`}
    >
      {/* Status bar */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[9px] font-black uppercase tracking-wider ${statusStyle.labelColor} flex items-center gap-1`}>
          {isLive && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef4444] opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-[#ef4444]" /></span>}
          {statusStyle.label}
        </span>
        {!isBye && (
          <span className="text-[9px] font-bold text-muted-foreground">
            Bo{series.best_of}
          </span>
        )}
      </div>

      {/* Radiant team row */}
      <TeamRow
        team={series.radiant_team}
        seed={series.seed_radiant}
        wins={score.radiant}
        winsNeeded={winsNeeded}
        isWinner={isComplete && series.winner_team_id === series.radiant_team_id}
        isLoser={isComplete && !!series.winner_team_id && series.winner_team_id !== series.radiant_team_id}
        isBye={isBye}
        showDots={!isBye && series.best_of > 1}
      />

      {/* Divider */}
      {!isBye && (
        <div className="flex items-center gap-1.5 my-1.5">
          <div className="flex-1 border-t border-border/50" />
          <Swords className="w-2.5 h-2.5 text-muted-foreground/40" />
          <div className="flex-1 border-t border-border/50" />
        </div>
      )}

      {/* Dire team row */}
      {!isBye ? (
        <TeamRow
          team={series.dire_team}
          seed={series.seed_dire}
          wins={score.dire}
          winsNeeded={winsNeeded}
          isWinner={isComplete && series.winner_team_id === series.dire_team_id}
          isLoser={isComplete && !!series.winner_team_id && series.winner_team_id !== series.dire_team_id}
          isBye={false}
          showDots={series.best_of > 1}
        />
      ) : (
        <div className="flex items-center gap-2 py-1 px-1 opacity-30">
          <div className="w-7 h-5 rounded bg-muted flex items-center justify-center text-[9px] text-muted-foreground">—</div>
          <span className="text-xs text-muted-foreground italic">No opponent</span>
        </div>
      )}
    </div>
  );
}

// ── Team Row ─────────────────────────────────────────────────────────

function TeamRow({
  team,
  seed,
  wins,
  winsNeeded,
  isWinner,
  isLoser,
  isBye,
  showDots,
}: {
  team?: BracketTeam | null;
  seed?: number | null;
  wins: number;
  winsNeeded: number;
  isWinner: boolean;
  isLoser: boolean;
  isBye: boolean;
  showDots: boolean;
}) {
  const hasTBD = !team;

  return (
    <div
      className={`flex items-center gap-2 py-1 px-1 rounded-lg transition-all ${
        isWinner ? 'bg-[#10b981]/8' : isLoser ? 'opacity-40' : ''
      }`}
    >
      {/* Seed badge */}
      {seed && (
        <span className="text-[9px] font-black text-muted-foreground w-3 text-center flex-shrink-0">
          {seed}
        </span>
      )}

      {/* Team logo */}
      {team ? (
        <TeamLogo logoUrl={resolveTeamLogoUrl(team.logo_url, team.team_tag)} teamName={team.team_name} size="sm" className="w-7 h-5 !text-xs !rounded" />
      ) : (
        <div className="w-7 h-5 rounded bg-muted/50 border border-border/50 flex items-center justify-center">
          <span className="text-[8px] text-muted-foreground font-bold">TBD</span>
        </div>
      )}

      {/* Team name */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-bold truncate ${
          hasTBD ? 'text-muted-foreground italic' : isWinner ? 'text-[#10b981]' : 'text-foreground'
        }`}>
          {team?.team_name || 'TBD'}
          {isWinner && <Crown className="inline w-3 h-3 ml-1 text-kernel-gold" />}
        </p>
      </div>

      {/* Score dots (TI-style) */}
      {showDots && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {Array.from({ length: winsNeeded }).map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full border transition-all ${
                i < wins
                  ? isWinner
                    ? 'bg-[#10b981] border-[#10b981]/60'
                    : 'bg-harvest border-harvest/60'
                  : 'bg-transparent border-muted-foreground/30'
              }`}
            />
          ))}
        </div>
      )}

      {/* Win count for Bo1 */}
      {!showDots && !isBye && !hasTBD && (
        <span className={`text-xs font-black flex-shrink-0 ${
          isWinner ? 'text-[#10b981]' : 'text-muted-foreground'
        }`}>
          {wins}
        </span>
      )}
    </div>
  );
}

// ── Connector lines between rounds ───────────────────────────────────

function ConnectorColumn({ fromCount, toCount }: { fromCount: number; toCount: number }) {
  // SVG connector that draws lines from `fromCount` output points to `toCount` input points
  // Each pair of "from" feeds into one "to"

  return (
    <div className="flex-shrink-0 w-10 flex items-stretch">
      <svg
        viewBox={`0 0 40 ${fromCount * 100}`}
        className="w-full h-full"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {Array.from({ length: toCount }).map((_, i) => {
          const topFrom = i * 2;
          const bottomFrom = i * 2 + 1;
          const totalHeight = fromCount * 100;

          // Calculate Y positions based on even distribution
          const fromTopY = (topFrom + 0.5) * (totalHeight / fromCount);
          const fromBottomY = (bottomFrom + 0.5) * (totalHeight / fromCount);
          const toY = (fromTopY + fromBottomY) / 2;

          return (
            <g key={i}>
              {/* Top source → midpoint */}
              <path
                d={`M 0 ${fromTopY} C 20 ${fromTopY}, 20 ${toY}, 40 ${toY}`}
                stroke="currentColor"
                className="text-border"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              {/* Bottom source → midpoint */}
              <path
                d={`M 0 ${fromBottomY} C 20 ${fromBottomY}, 20 ${toY}, 40 ${toY}`}
                stroke="currentColor"
                className="text-border"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}