/**
 * Tournament Bracket Tab
 *
 * Two modes:
 *   Viewer  — shows bracket with phase-separator headers (reads kkup_matches phase columns)
 *             Falls back to legacy kkup_bracket_series if no phase data exists.
 *   Builder — officer-only structure editor (add phases, groups, assign matches)
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  GitBranch, Trophy, Clock, Hammer, Eye, Loader2,
  Users, ChevronLeft, ChevronRight, Share2, Info, LayoutGrid, Map as MapIcon
} from 'lucide-react';
import { useTournament } from '@/app/contexts/tournament-context';
import { isFinished } from '../tournament-state-config';
import { TeamLogo } from '../team-logo';
import { BracketBuilder } from '../bracket-builder';
import { Footer } from '@/app/components/footer';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { groupMatchesIntoSeries, BracketSeries } from '@/lib/bracket-utils';
import { numericToRank, MEDAL_ORDER } from '@/lib/rank-utils';

const TROPHY_URL  = 'https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/make-4789f4af-kkup-assets/trophies/kernel_kup_trophy.png';

// ═══════════════════════════════════════════════════════
// FORMAT PREVIEW (early phases — no bracket yet)
// ═══════════════════════════════════════════════════════

function BracketFormatPreview({ tournament }: { tournament: any }) {
  const startDate = tournament.tournament_start_date
    ? new Date(tournament.tournament_start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="bg-card rounded-2xl border-2 border-border p-10 sm:p-14 flex flex-col items-center text-center gap-4">
      <div className="w-16 h-16 bg-harvest/10 rounded-2xl flex items-center justify-center">
        <GitBranch className="w-8 h-8 text-harvest" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Bracket Coming Soon</h2>
        <p className="text-muted-foreground max-w-sm">
          The bracket will be posted here once the tournament kicks off.
          {startDate && <> Check back on <span className="font-semibold text-foreground">{startDate}</span>.</>}
        </p>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// MATCH CARD (used inside bracket viewer columns)
// ═══════════════════════════════════════════════════════

// ─── Layout Constants ─────────────────────────────────────────────────────────
// CARD_H must match actual rendered height: sm TeamLogo (h-8=32px) + 2×py-2 (8px each) = 48px per row × 2 rows = 96px
const CARD_H  = 100;  // px — height of each series card
const CARD_W  = 240;  // px — width of each series card
const MIN_GAP = 40;   // px — increased gap between cards for more room
const BASE_SLOT    = CARD_H + MIN_GAP; 
const MIN_VIEWER_H = 440; // px — enforced minimum height for the bracket viewer
const CONN_W  = 56;   // px — width of the connector SVG 
const PAD_TOP = 60;   // px — increased top padding for better headers

// ─── Series Card ─────────────────────────────────────────────────────────────
// A TBD placeholder card for when no matches are assigned yet
function TbdSeriesCard() {
  return (
    <div
      className="rounded-xl border-2 border-dashed border-border/80 overflow-hidden shadow-sm shadow-black/5"
      style={{ width: CARD_W, background: 'var(--card)' }}
    >
      {/* Team 1 row */}
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-dashed border-border/80 bg-muted/20">
        <div className="w-6 h-6 rounded-md bg-muted/40 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-muted-foreground/50">TBD</div>
        </div>
      </div>
      {/* Team 2 row */}
      <div className="flex items-center gap-2 px-2.5 py-2 bg-muted/20">
        <div className="w-6 h-6 rounded-md bg-muted/40 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-muted-foreground/50">TBD</div>
        </div>
      </div>
    </div>
  );
}

function BracketSeriesCard({ series, showScores, compact, tournamentName }: { series: BracketSeries; showScores: boolean; compact?: boolean; tournamentName?: string }) {
  const t1w = series.team1_wins > series.team2_wins || series.winner_team_id === series.team1_id;
  const t2w = series.team2_wins > series.team1_wins || series.winner_team_id === series.team2_id;
  const finished = t1w || t2w;

  // If both teams are null/TBD, render the placeholder card
  if (!series.team1 && !series.team2) return <TbdSeriesCard />;

  return (
    <div
      className="rounded-xl border-2 border-border overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-harvest/40"
      style={{ width: CARD_W, background: 'var(--card)' }}
    >
      {/* Team 1 row */}
      <div className={`flex items-center gap-2 px-2.5 py-2 border-b border-border ${t1w ? 'bg-[#10b981]/8' : finished ? 'opacity-50' : ''}`}>
        {series.team1 ? (
          <TeamLogo 
            teamTag={series.team1.team_tag || ''} 
            teamName={series.team1.team_name} 
            logoUrl={series.team1.logo_url} 
            tournamentName={tournamentName} 
            size="sm" 
            seed={(series.team1 as any).seed || (series.team1 as any).seeding}
            rankTier={(series.team1 as any).avg_rank_tier || (series.team1 as any).avg_rank_numeric}
          />
        ) : (
          <div className="w-6 h-6 rounded-md bg-muted/60 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] font-semibold truncate ${!series.team1 ? 'text-muted-foreground/60' : '' }`}>
            {series.team1?.team_name || 'TBD'}
          </div>
        </div>
        {showScores && series.team1 && (
          <div className={`text-base font-black w-5 text-right ${t1w ? 'text-[#10b981]' : 'text-muted-foreground'}`}>
            {series.team1_wins}
          </div>
        )}
      </div>
      {/* Team 2 row */}
      <div className={`flex items-center gap-2 px-2.5 py-2 ${t2w ? 'bg-[#10b981]/8' : finished ? 'opacity-50' : ''}`}>
        {series.team2 ? (
          <TeamLogo 
            teamTag={series.team2.team_tag || ''} 
            teamName={series.team2.team_name} 
            logoUrl={series.team2.logo_url} 
            tournamentName={tournamentName} 
            size="sm" 
            seed={(series.team2 as any).seed || (series.team2 as any).seeding}
            rankTier={(series.team2 as any).avg_rank_tier || (series.team2 as any).avg_rank_numeric}
          />
        ) : (
          <div className="flex-1 flex items-center gap-2 min-w-0">
             <div className="w-6 h-6 rounded-md bg-muted/60 flex-shrink-0 border border-dashed border-border flex items-center justify-center">
               <span className="text-[10px] text-muted-foreground opacity-50 italic">?</span>
             </div>
             <div className="text-[11px] font-black text-muted-foreground/40 italic uppercase tracking-widest">
               {series.team1 ? 'BYE' : 'TBD'}
             </div>
          </div>
        )}
        {series.team2 && (
          <>
            <div className="flex-1 min-w-0">
              <div className={`text-[13px] font-semibold truncate`}>
                {series.team2.team_name}
              </div>
            </div>
            {showScores && (
              <div className={`text-base font-black w-5 text-right ${t2w ? 'text-[#10b981]' : 'text-muted-foreground'}`}>
                {series.team2_wins}
              </div>
            )}
          </>
        )}
      </div>
      {/* Scheduled time pill */}
      {!finished && series.matches[0]?.scheduled_time && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted/60 border-t border-border">
          <Clock className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
          <span className="text-[10px] text-muted-foreground">
            {new Date(series.matches[0]?.scheduled_time).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            })}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Champion Card ─────────────────────────────────────────────────────────────
// Displays the Kernal Kup Trophy with the winning team logo
function ChampionCard({ team, totalH, tournamentName }: { team: any; totalH: number; tournamentName?: string }) {
  return (
    <div 
      className="relative flex flex-col items-center justify-center group py-4"
      style={{ width: CARD_W, height: totalH }}
    >
      {/* Trophy Image Container */}
      <div className="relative w-full h-full max-h-[320px] flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
        <img 
          src={TROPHY_URL} 
          alt="Kernel Kup Trophy"
          className="h-full w-auto object-contain drop-shadow-[0_20px_60px_rgba(214,166,21,0.3)] transition-all"
        />
        
        {/* Winner Logo Overlay — positioned precisely at the vertical center to align with the bracket line */}
        {team && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-fade-in group-hover:rotate-6 transition-transform duration-700">
            <div className="bg-silk p-2 rounded-full shadow-[0_0_30px_rgba(255,255,255,0.6)] border-2 border-harvest/60 ring-4 ring-harvest/10">
              <TeamLogo 
                teamTag={team.team_tag || ''} 
                teamName={team.team_name} 
                logoUrl={team.logo_url} 
                tournamentName={tournamentName}
                size="md" 
              />
            </div>
          </div>
        )}
      </div>

      {/* Champion Label & Name */}
      <div className="mt-4 text-center z-10">
        {team ? (
          <div className="space-y-1.5 animate-slide-in-up">
            <div className="px-4 py-1.5 bg-harvest/10 border-2 border-harvest/30 rounded-full inline-flex items-center gap-2 shadow-sm">
              <Trophy className="w-3.5 h-3.5 text-harvest" />
              <span className="text-[11px] font-black uppercase tracking-[0.25em] text-harvest">Champion</span>
            </div>
            <div className="text-2xl font-black text-foreground drop-shadow-sm tracking-tight truncate max-w-[240px]">
              {team.team_name}
            </div>
          </div>
        ) : (
          <div className="text-sm font-bold text-muted-foreground/60 italic bg-muted/40 px-6 py-3 rounded-2xl border-2 border-dashed border-border/40">
            Final Winner TBD
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bracket Connector SVG ────────────────────────────────────────────────────
// Draws classic bracket elbow lines between adjacent columns.
// Uses linear pairing: top-half from → top to, bottom-half from → bottom to.
// No crossing lines.
function BracketConnector({
  fromCenters,
  toCenters,
  color = "var(--border)",
  CONN_W = 56,
}: {
  fromCenters: number[];
  toCenters: number[];
  color?: string;
  CONN_W?: number;
}) {
  const paths: JSX.Element[] = [];
  const mid = CONN_W / 2;

  fromCenters.forEach((fromCY, fi) => {
    // Basic mapping: sources feed into targets proportionally.
    const ti = toCenters.length > 0 ? Math.floor(fi * toCenters.length / fromCenters.length) : -1;
    if (ti === -1) return;

    const toCY = toCenters[ti];
    if (isNaN(fromCY) || isNaN(toCY)) return;

    paths.push(
      <path
        key={`f${fi}-t${ti}-${fromCY}-${toCY}`}
        d={`M 0,${fromCY} H ${mid} V ${toCY} H ${CONN_W}`}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeOpacity="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  });

  return <>{paths}</>;
}


// ─── Phase-Aware Bracket Viewer ────────────────────────────────────────────────────
// Phase sort order: play_in always first, main_event always last
const PHASE_SORT_ORDER: Record<string, number> = {
  play_in:     0,
  group_stage: 1,
  main_event:  2,
};

const PHASE_DISPLAY: Record<string, { label: string; color: string }> = {
  play_in:     { label: 'Play In',     color: '#a855f7' },
  group_stage: { label: 'Group Stage', color: '#3b82f6' },
  main_event:  { label: 'Main Event',  color: '#d6a615' },
};

function matchupLabel(type?: string) {
  const m: Record<string, string> = { bo1: 'BO1', bo2: 'BO2', bo3: 'BO3', bo5: 'BO5' };
  return m[type || ''] || '';
}

function PhaseBracketViewer({
  bracketConfig,
  assigned,
  showScores,
  tournamentName,
  enrichTeam,
}: {
  bracketConfig: any;
  assigned: Record<string, Record<string, any[]>>;
  showScores: boolean;
  tournamentName?: string;
  enrichTeam: (team: any) => any;
}) {
  const phases: any[] = bracketConfig?.phases || [];

  const hasPhaseData = Object.keys(assigned).some(p =>
    Object.values(assigned[p]).some(g => g.length > 0)
  );

  if (!hasPhaseData && phases.length === 0) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-10 text-center">
        <GitBranch className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">Bracket Not Configured</h3>
        <p className="text-muted-foreground">
          No bracket structure has been defined yet. Officers can use the Bracket Builder to set it up.
        </p>
      </div>
    );
  }

  // ── Build a flat ordered array of "rounds" (one per group) ───────────────
  const phaseList = (phases.length > 0
    ? [...phases].sort((a: any, b: any) => {
        const ao = a.order ?? (PHASE_SORT_ORDER[a.key] || 99);
        const bo = b.order ?? (PHASE_SORT_ORDER[b.key] || 99);
        return ao - bo;
      })
    : Object.keys(assigned).map((key, i) => ({
        key, name: PHASE_DISPLAY[key]?.label || key, order: i + 1,
        groups: Object.keys(assigned[key]).map((gName, j) => ({
          name: gName, order: j + 1,
          matchup_type: assigned[key][gName][0]?.matchup_type,
        })),
      }))
  );

  interface BracketRound {
    key: string;
    label: string;
    phaseKey: string;
    phaseLabel: string;
    phaseColor: string;
    matchupType?: string;
    series: BracketSeries[];
    winnersAdvanceTo: { phase_key: string; group_name: string } | null;
    losersAdvanceTo: { phase_key: string; group_name: string } | null;
    isSkeleton?: boolean;
    isFinalNodeGroup?: boolean;
    isChampion?: boolean;
    // Layout metadata
    topOffset?: number;
    stackOffset?: number;
    stackH?: number;
    cardCenters?: number[]; // Added for connectors
  }

  interface PhaseColumn {
    key: string;
    phaseLabel: string;
    phaseColor: string;
    groups: BracketRound[];
    isChampion?: boolean;
  }

  // 1. Process Groups into Rounds
  const allRounds: BracketRound[] = [];
  for (const phase of phaseList) {
    const phaseMatches = assigned[phase.key] || {};
    const display = PHASE_DISPLAY[phase.key] || { label: phase.name, color: '#8b5cf6' };
    const sortedGroups = [...(phase.groups || [])].sort((a: any, b: any) => a.order - b.order);

    for (const g of sortedGroups) {
      // Normalize match data: Map radiant/dire fields to team1/team2 early so all components can rely on a standard interface.
      const rawMatches = (phaseMatches[g.name] || []).map((m: any) => {
        const team1 = enrichTeam(m.team1 || m.radiant_team);
        const team2 = enrichTeam(m.team2 || m.dire_team);
        
        return {
          ...m,
          team1,
          team2,
          team1_id: m.team1_id || m.radiant_team_id,
          team2_id: m.team2_id || m.dire_team_id,
          team1_score: m.team1_score ?? m.radiant_team_score,
          team2_score: m.team2_score ?? m.dire_team_score,
          // Carry over any existing seeding/rank top-level fields for the series
          seeding: m.seeding || (m.radiant_team?.seeding ?? m.dire_team?.seeding),
        };
      }).sort(
        (a: any, b: any) => (a.game_number || 0) - (b.game_number || 0)
      );

      let series: BracketSeries[] = [];
      let isSkeleton = false;

      if (rawMatches.length > 0) {
        series = groupMatchesIntoSeries(rawMatches);
        if (series.length === 0) continue;

        // Auto-advance byes for UI
        series.forEach(s => {
          if (s.team1 && !s.team2) {
            s.winner_team_id = s.team1_id;
          } else if (s.team2 && !s.team1) {
            s.winner_team_id = s.team2_id;
          }
        });
      } else {
        const teamCount: number = (g as any).team_count || 2;
        const matchupCount = Math.max(1, Math.ceil(teamCount / 2));
        series = Array.from({ length: matchupCount }, (_, i) => ({
          id: `skeleton-${phase.key}-${g.name}-${i}`,
          series_id: `skeleton-${phase.key}-${g.name}-${i}` as any,
          team1_id: null as any,
          team2_id: null as any,
          team1: null as any,
          team2: null as any,
          team1_wins: 0,
          team2_wins: 0,
          winner_team_id: null as any,
          matches: [],
          scheduled_time: null as any,
        }));
        isSkeleton = true;
      }

      allRounds.push({
        key: `${phase.key}__${g.name}`,
        label: g.name,
        phaseKey: phase.key,
        phaseLabel: display.label,
        phaseColor: display.color,
        matchupType: g.matchup_type,
        series,
        winnersAdvanceTo: (g as any).winners_advance_to ?? null,
        losersAdvanceTo: (g as any).losers_advance_to ?? null,
        isSkeleton,
        isFinalNodeGroup: (g as any).is_final_node_group,
      });
    }
  }

  // Helper for rendering advancement labels
  const renderAdvTarget = (target: any) => {
    if (!target) return null;
    if (target === 'eliminated') return <span className="font-semibold text-[#ef4444]">Eliminated</span>;
    if (target.phase_key === 'virtual' && target.group_name?.startsWith('placement::')) {
      const num = target.group_name.split('::')[1];
      const icons: any = { '1': '🏆', '2': '🥈', '3': '🥉', '4': '' };
      const labels: any = { '1': '1st Place', '2': '2nd Place', '3': '3rd Place', '4': '4th Place' };
      return (
        <span className="font-semibold text-foreground text-[10px]">
          {icons[num] || ''} {labels[num] || `${num}th Place`}
        </span>
      );
    }
    const p = phaseList.find((p: any) => p.key === target.phase_key);
    return (
      <span className="font-semibold text-foreground text-center text-[10px]">
        {p?.name || target.phase_key} — {target.group_name}
      </span>
    );
  };

  // 2. Resolve Placements
  const placements: Record<string, any> = {};
  if (showScores) {
    allRounds.forEach(round => {
      const getTargetPlacement = (adv: any) => {
        if (adv?.phase_key === 'virtual' && adv.group_name?.startsWith('placement::')) {
          return adv.group_name.split('::')[1];
        }
        return null;
      };
      const wPlacement = getTargetPlacement(round.winnersAdvanceTo);
      const lPlacement = getTargetPlacement(round.losersAdvanceTo);

      if (wPlacement || lPlacement) {
        if (round.series.length === 1) {
          const s = round.series[0];
          const winId = s.winner_team_id;
          const winner = winId ? (winId === s.team1_id ? s.team1 : s.team2) : (s.team1_wins > s.team2_wins ? s.team1 : s.team2_wins > s.team1_wins ? s.team2 : null);
          const loser = winId ? (winId === s.team1_id ? s.team2 : s.team1) : (s.team1_wins < s.team2_wins ? s.team1 : s.team2_wins < s.team1_wins ? s.team2 : null);
          if (wPlacement && winner) placements[wPlacement] = winner;
          if (lPlacement && loser) placements[lPlacement] = loser;
        } else {
          const stats: Record<string, { team: any; seriesWins: number; mapWins: number }> = {};
          round.series.forEach(s => {
            [s.team1_id, s.team2_id].forEach(id => {
              if (id && !stats[id]) stats[id] = { team: id === s.team1_id ? s.team1 : s.team2, seriesWins: 0, mapWins: 0 };
            });
            if (s.winner_team_id) stats[s.winner_team_id].seriesWins++;
            if (s.team1_id) stats[s.team1_id].mapWins += s.team1_wins;
            if (s.team2_id) stats[s.team2_id].mapWins += s.team2_wins;
          });
          const sorted = Object.values(stats).sort((a, b) => b.seriesWins - a.seriesWins || b.mapWins - a.mapWins);
          if (sorted.length > 0) {
            if (wPlacement) placements[wPlacement] = sorted[0].team;
            if (lPlacement && sorted.length > 1) placements[lPlacement] = sorted[1].team;
          }
        }
      }
    });
  }

  // Resolve Champion
  let championTeamResolved = placements['1'];
  const lastFinalRound = allRounds.findLast(r => r.isFinalNodeGroup);
  if (!championTeamResolved && showScores && lastFinalRound && !lastFinalRound.isSkeleton) {
    if (lastFinalRound.series.length === 1) {
      const s = lastFinalRound.series[0];
      const winId = s.winner_team_id;
      if (winId) championTeamResolved = (winId === s.team1_id ? s.team1 : s.team2);
      else if (s.team1_wins > s.team2_wins) championTeamResolved = s.team1;
      else if (s.team2_wins > s.team1_wins) championTeamResolved = s.team2;
    } else {
      const stats: Record<string, { team: any; seriesWins: number; mapWins: number }> = {};
      lastFinalRound.series.forEach(s => {
        [s.team1_id, s.team2_id].forEach(id => {
          if (id && !stats[id]) stats[id] = { team: id === s.team1_id ? s.team1 : s.team2, seriesWins: 0, mapWins: 0 };
        });
        if (s.winner_team_id) stats[s.winner_team_id].seriesWins++;
        if (s.team1_id) stats[s.team1_id].mapWins += s.team1_wins;
        if (s.team2_id) stats[s.team2_id].mapWins += s.team2_wins;
      });
      const sorted = Object.values(stats).sort((a, b) => b.seriesWins - a.seriesWins || b.mapWins - a.mapWins);
      if (sorted.length > 0) championTeamResolved = sorted[0].team;
    }
  }

  // 3. Group Rounds into Phase Columns
  const columns: PhaseColumn[] = [];
  phaseList.forEach(phase => {
    const phaseRounds = allRounds.filter(r => r.phaseKey === phase.key);
    if (phaseRounds.length > 0) {
      columns.push({
        key: phase.key,
        phaseLabel: phaseRounds[0].phaseLabel,
        phaseColor: phaseRounds[0].phaseColor,
        groups: phaseRounds,
      });
    }
  });

  // Calculate global heights
  const maxTotalSeries = Math.max(...columns.map(c => c.groups.reduce((sum, g) => sum + g.series.length, 0)), 1);
  const totalH = Math.max(maxTotalSeries * BASE_SLOT, MIN_VIEWER_H);

  // Apply vertical layout and pre-calculate coordinates
  columns.forEach(col => {
    const colTotalSeries = col.groups.reduce((sum, g) => sum + g.series.length, 0);
    let currentOffset = 0;
    col.groups.forEach(group => {
      const gHeight = (group.series.length / colTotalSeries) * totalH;
      group.height = gHeight;
      group.topOffset = currentOffset;
      
      // Pre-calculate card centers for global connectors
      const advHeight = (group.isFinalNodeGroup || group.winnersAdvanceTo || group.losersAdvanceTo) ? 60 : 0;
      const stackH = (group.series.length * CARD_H + (group.series.length - 1) * MIN_GAP + (advHeight ? advHeight + 20 : 0));
      const stackOffset = (gHeight - stackH) / 2;
      group.stackOffset = stackOffset;
      group.stackH = stackH;
      group.cardCenters = group.series.map((_, i) => currentOffset + stackOffset + i * (CARD_H + 20) + CARD_H / 2);
      
      currentOffset += gHeight;
    });
  });

  // Add Champion Column if needed
  const shouldShowTrophy = lastFinalRound || allRounds.some(r => 
    r.winnersAdvanceTo?.phase_key === 'virtual' && r.winnersAdvanceTo?.group_name === 'placement::1'
  );
  if (shouldShowTrophy) {
    columns.push({
      key: 'virtual__champion',
      phaseLabel: 'CHAMPION',
      phaseColor: '#d6a615',
      groups: [{
        key: 'virtual__champion',
        label: 'THE KERNEL KUP',
        phaseKey: 'virtual',
        phaseLabel: 'CHAMPION',
        phaseColor: '#d6a615',
        series: [],
        winnersAdvanceTo: null,
        losersAdvanceTo: null,
        isChampion: true,
        height: totalH,
        topOffset: 0,
        stackOffset: 0,
        cardCenters: [totalH / 2 + 60], // Offset for trophy centerpiece
      }],
      isChampion: true,
    });
  }

  // Calculate absolute positions for global connectors
  const columnsWithPos = columns.map((col, ci) => {
    const startX = ci * (CARD_W + CONN_W);
    return { ...col, startX };
  });

  // Collect all connections globally
  const globalConnections: any[] = [];
  columnsWithPos.forEach((col, ci) => {
    col.groups.forEach(src => {
      // Champion connection special case
      if (ci === columnsWithPos.length - 2 && col.key !== 'virtual__champion') {
        const nextCol = columnsWithPos[ci + 1];
        if (nextCol.isChampion) {
          const gfGroup = col.groups.find(g => g.label === 'GRAND FINALS') || col.groups[0];
          globalConnections.push({
            id: `champ-${src.key}`,
            fromX: col.startX + CARD_W,
            fromCenters: [gfGroup.cardCenters?.[0] || totalH / 2],
            toX: nextCol.startX,
            toCenters: [totalH / 2 + 60],
            color: "#d6a615",
            width: CONN_W
          });
        }
      }

      // Regular advancements
      const solve = (target: any, color: string, type: string) => {
        if (!target) return;
        for (let i = ci + 1; i < columnsWithPos.length; i++) {
          const destCol = columnsWithPos[i];
          if (destCol.key === target.phase_key) {
            const tNm = (target.group_name || '').toLowerCase().trim();
            const destG = destCol.groups.find(g => (g.label || '').toLowerCase().trim() === tNm);
            if (destG) {
              globalConnections.push({
                id: `${src.key}-${destG.key}-${type}`,
                fromX: col.startX + CARD_W,
                fromCenters: src.cardCenters || [],
                toX: destCol.startX,
                toCenters: destG.cardCenters || [],
                color: color,
                width: destCol.startX - (col.startX + CARD_W)
              });
              return;
            }
          }
        }
      };
      solve(src.winnersAdvanceTo, "#10b981", 'win');
      solve(src.losersAdvanceTo, "#ef4444", 'loss');
    });
  });

  return (
    <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
      <div className="overflow-x-auto scrollbar-visible">
        <div
          className="flex items-start relative pr-10"
          style={{ padding: `${PAD_TOP}px 40px 40px 40px`, minWidth: 'max-content' }}
        >
          {/* ── Global Connector Overlay ────────────────────────────────────── */}
          <svg 
            className="absolute pointer-events-none overflow-visible z-0"
            style={{ 
              top: PAD_TOP,
              left: 40,
              width: '100%', 
              height: '100%',
            }}
          >
            {globalConnections.map(conn => (
              <g key={conn.id} transform={`translate(${conn.fromX}, 0)`}>
                <BracketConnector 
                  fromCenters={conn.fromCenters} 
                  toCenters={conn.toCenters} 
                  color={conn.color} 
                  CONN_W={conn.width} 
                />
              </g>
            ))}
          </svg>

          {columnsWithPos.map((col, ci) => (
            <div key={col.key} className={`flex items-start ${ci === columnsWithPos.length - 1 ? '' : 'relative'}`} style={{ zIndex: 1 }}>
              {/* Phase Column */}
              <div style={{ width: CARD_W, position: 'relative', flexShrink: 0 }}>
                  {/* Global Phase Header */}
                  <div
                    className="absolute left-0 right-0 text-center"
                    style={{ top: -PAD_TOP + 4 }}
                  >
                    <div
                      className="text-[9px] font-black uppercase tracking-[0.18em] mb-2"
                      style={{ color: col.phaseColor }}
                    >
                      {col.phaseLabel}
                    </div>
                    {/* Group Labels at Top */}
                    {col.groups.length > 0 && (
                      <div className="flex flex-col gap-1 items-center pb-4">
                        {col.groups.map(group => {
                          // Don't show redundant labels if they are strictly identical to phase label and it's a single group
                          const isRedundant = col.groups.length === 1 && group.label === col.phaseLabel;
                          if (isRedundant) return null;
                          
                          return (
                            <div key={`head-${group.key}`} className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest bg-card border border-border px-3 py-1 rounded-full shadow-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-full inline-flex items-center gap-1.5">
                              <span>{group.label}</span>
                              {group.matchupType && (
                                <>
                                  <span className="opacity-30 border-l border-border h-2.5 mx-0.5" />
                                  <span className="text-muted-foreground/60">{matchupLabel(group.matchupType)}</span>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Groups within Phase */}
                  <div style={{ position: 'relative', height: totalH }}>
                    {col.groups.map(group => {
                      const gH = group.height!;
                      const gTop = group.topOffset!;
                      const slotH = gH / (group.series.length || 1);

                      return (
                        <div 
                          key={group.key} 
                          style={{ 
                            position: 'absolute', 
                            top: gTop, 
                            left: 0, 
                            width: '100%', 
                            height: gH,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderBottom: col.groups.length > 1 && group !== col.groups[col.groups.length - 1] ? '1px dashed rgba(255,255,255,0.05)' : 'none'
                          }}
                        >
                          {(() => {
                            const advHeight = (group.isFinalNodeGroup || group.winnersAdvanceTo || group.losersAdvanceTo) ? 60 : 0;
                            const stackH = group.isChampion ? 400 : (group.series.length * CARD_H + (group.series.length - 1) * MIN_GAP + (advHeight ? advHeight + 20 : 0));
                            const stackOffset = (gH - stackH) / 2;

                            // Group metadata already pre-calculated at top

                            return (
                              <div 
                                style={{ 
                                  height: stackH,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '100%',
                                }}
                              >
                                {group.isChampion ? (
                                  <ChampionCard team={championTeamResolved} totalH={totalH} tournamentName={tournamentName} />
                                ) : (
                                  <>
                                    <div className="flex flex-col gap-5">
                                      {group.series.map((series) => (
                                        <BracketSeriesCard 
                                          key={series.series_id} 
                                          series={series} 
                                          showScores={showScores} 
                                          tournamentName={tournamentName} 
                                        />
                                      ))}
                                    </div>
                                    
                                    {/* Group Advancement footer inside the stack */}
                                    {(group.isFinalNodeGroup || group.winnersAdvanceTo || group.losersAdvanceTo) && (
                                      <div className="pt-4 space-y-1.5 border-t border-border/10 mt-3 w-full">
                                        {(group.isFinalNodeGroup || group.winnersAdvanceTo) && (
                                          <div className="flex flex-col items-center justify-center gap-0.5 text-[9px]">
                                            <span className="text-[#10b981] font-bold uppercase tracking-tighter opacity-50">↑ Winners</span>
                                            {renderAdvTarget(group.winnersAdvanceTo) || (group.isFinalNodeGroup ? <span className="font-semibold text-foreground">🏆 1st Place</span> : null)}
                                          </div>
                                        )}
                                        {(group.isFinalNodeGroup || group.losersAdvanceTo) && (
                                          <div className="flex flex-col items-center justify-center gap-0.5 text-[9px]">
                                            <span className="text-[#ef4444] font-bold uppercase tracking-tighter opacity-50">↓ Losers</span>
                                            {renderAdvTarget(group.losersAdvanceTo) || (group.isFinalNodeGroup ? <span className="font-semibold text-muted-foreground">🥈 2nd Place</span> : null)}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* ── Gap for Connectors ───────────────────────────────────────── */}
                {!col.isChampion && (
                  <div style={{ width: CONN_W, height: totalH, flexShrink: 0 }} />
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}




// ═══════════════════════════════════════════════════════
// LEGACY VIEWER (kkup_bracket_series fallback)
// ═══════════════════════════════════════════════════════

function LegacyBracketViewer({ 
  bracket, 
  showScores,
  enrichTeam
}: { 
  bracket: any; 
  showScores: boolean;
  enrichTeam: (team: any) => any;
}) {
  if (!bracket) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-10 text-center">
        <GitBranch className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">Bracket Not Generated Yet</h3>
        <p className="text-muted-foreground">The bracket will be created after rosters are locked.</p>
      </div>
    );
  }

  const ROUND_ORDER = ['QF', 'SF', 'GF'];
  const ROUND_LABELS: Record<string, string> = { QF: 'Quarterfinals', SF: 'Semifinals', GF: 'Grand Finals' };

  return (
    <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
      <div className="p-5 border-b-2 border-border">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
          <Trophy className="w-5 h-5 text-harvest" />
          Tournament Bracket
        </h2>
      </div>
      <div className="overflow-x-auto p-5">
        <div className="flex gap-5 min-w-max items-start">
          {ROUND_ORDER.filter(r => bracket[r]?.length > 0).map(round => (
            <div key={round} className="flex flex-col gap-4 w-64">
              <div className="text-center">
                <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wide">
                  {ROUND_LABELS[round] || round}
                </h3>
              </div>
              <div className="space-y-4">
                {bracket[round].map((series: any) => {
                  // Map series fields to match fields for BracketSeriesCard
                  const t1 = enrichTeam(series.radiant_team || series.team1);
                  const t2 = enrichTeam(series.dire_team || series.team2);
                  const mapped = {
                    id: series.id,
                    team1_id: series.radiant_team_id || series.team1_id,
                    team2_id: series.dire_team_id || series.team2_id,
                    winner_team_id: series.winner_team_id,
                    team1: t1,
                    team2: t2,
                    team1_score: series.radiant_score ?? series.team1_score ?? null,
                    team2_score: series.dire_score ?? series.team2_score ?? null,
                    scheduled_time: series.scheduled_time,
                  };
                  return (
                    <BracketSeriesCard
                      key={series.id}
                      series={{...mapped, series_id: mapped.id, team1_wins: mapped.team1_score || 0, team2_wins: mapped.team2_score || 0, matches: [mapped]} as any}
                      showScores={showScores}
                      tournamentName={tournament?.name}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="md:hidden p-3 bg-muted border-t-2 border-border text-center">
        <p className="text-xs text-muted-foreground">← Swipe to view all rounds →</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN TAB COMPONENT
// ═══════════════════════════════════════════════════════

export function TournamentBracketTab() {
  const { tournament, isOfficer, accessToken } = useTournament();

  const [mode, setMode] = useState<'viewer' | 'builder'>('viewer');
  const [loading, setLoading] = useState(true);

  // New bracket builder data (from kkup_matches)
  const [builderData, setBuilderData] = useState<{
    bracketConfig: any;
    assigned: Record<string, Record<string, any[]>>;
    unassigned: any[];
  } | null>(null);

  // Legacy bracket data (from kkup_bracket_series)
  const [legacyBracket, setLegacyBracket] = useState<any>(null);
  const [seedingData, setSeedingData] = useState<any[] | null>(null);

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;
  const token = accessToken || publicAnonKey;

  // Seeding context map for badges
  const seedingMap = useMemo(() => {
    if (!seedingData) return {};
    return seedingData.reduce((acc, team) => {
      acc[team.team_id] = team;
      return acc;
    }, {} as Record<string, any>);
  }, [seedingData]);

  // Enrich a team object with seed and rank info from the seeding data
  const enrichTeam = useCallback((team: any) => {
    if (!team || !team.id) return team;
    const context = seedingMap[team.id];
    if (!context) return team;

    const rankDetails = numericToRank(context.avg_rank_numeric);
    const medalIdx = MEDAL_ORDER.indexOf(rankDetails.medal as any);
    const inferredTier = (medalIdx + 1) * 10 + rankDetails.stars;

    return {
      ...team,
      seed: team.seed || context.seed,
      avg_rank_tier: team.avg_rank_tier || inferredTier,
    };
  }, [seedingMap]);

  const fetchData = async () => {
    if (!tournament) return;
    setLoading(true);

    try {
      // 1. Fetch seeding data (for badges)
      const seedRes = await fetch(
        `${apiBase}/kkup/tournaments/${tournament.id}/seeding`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (seedRes.ok) {
        setSeedingData(await seedRes.json());
      }

      // 2. Fetch new bracket builder data
      const builderRes = await fetch(
        `${apiBase}/kkup/tournaments/${tournament.id}/bracket-builder`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (builderRes.ok) {
        const data = await builderRes.json();
        setBuilderData({
          bracketConfig: data.bracketConfig,
          assigned: data.assigned,
          unassigned: data.unassigned,
        });
      }
    } catch (err) {
      console.error('Failed to fetch bracket builder data:', err);
    }

    try {
      // Fetch legacy bracket (kkup_bracket_series)
      const legacyRes = await fetch(
        `${apiBase}/kkup/tournaments/${tournament.id}/bracket`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (legacyRes.ok) {
        const data = await legacyRes.json();
        setLegacyBracket(data.bracket);
      }
    } catch (err) {
      console.error('Failed to fetch legacy bracket:', err);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!tournament) return;
    const shouldFetch = ['registration_closed', 'roster_lock', 'live', 'completed', 'archived', 'active'].includes(tournament.status);
    if (shouldFetch) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [tournament]);

  if (!tournament) return null;

  const finished = isFinished(tournament.status);
  const showPreview = ['upcoming', 'registration_open'].includes(tournament.status);

  // Determine which viewer to show: new phase-aware or legacy
  // Show PhaseBracketViewer as soon as bracket_config has phases defined (skeleton mode),
  // even if no matches are assigned yet.
  const hasNewBracketData = builderData &&
    builderData.bracketConfig?.phases?.length > 0;
  const hasLegacyBracket = legacyBracket &&
    Object.values(legacyBracket).some((arr: any) => arr?.length > 0);

  if (loading && !builderData && !legacyBracket) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-harvest" />
        <p className="text-muted-foreground animate-pulse font-medium">Loading Bracket Interface...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 sm:space-y-8">
        {showPreview ? (
          <BracketFormatPreview tournament={tournament} />
        ) : (
          <>
            {/* Officer mode toggle */}
            {isOfficer && (
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setMode(mode === 'builder' ? 'viewer' : 'builder')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-all ${
                    mode === 'builder'
                      ? 'bg-harvest border-harvest text-soil'
                      : 'bg-card border-border text-foreground hover:border-harvest/40'
                  }`}
                >
                  {mode === 'builder'
                    ? <><Eye className="w-4 h-4" /> View Bracket</>
                    : <><Hammer className="w-4 h-4" /> Bracket Builder</>
                  }
                </button>
              </div>
            )}

            {/* Builder mode */}
            {mode === 'builder' && isOfficer && builderData && (
              <BracketBuilder
                tournamentId={tournament.id}
                accessToken={accessToken}
                bracketConfig={builderData.bracketConfig}
                assigned={builderData.assigned}
                unassigned={builderData.unassigned}
                onRefresh={fetchData}
              />
            )}

            {/* Viewer mode */}
            {mode === 'viewer' && (
              <>
                {hasNewBracketData ? (
                  <PhaseBracketViewer
                    bracketConfig={builderData!.bracketConfig}
                    assigned={builderData!.assigned}
                    showScores={finished}
                    tournamentName={tournament.name}
                    enrichTeam={enrichTeam}
                  />
                ) : hasLegacyBracket ? (
                  <LegacyBracketViewer 
                    bracket={legacyBracket} 
                    showScores={finished} 
                    enrichTeam={enrichTeam}
                  />
                ) : (
                  <div className="bg-card rounded-2xl border-2 border-border p-10 text-center">
                    <GitBranch className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-foreground mb-2">No Bracket Yet</h3>
                    <p className="text-muted-foreground">
                      {isOfficer
                        ? 'Use the Bracket Builder to define phases and assign matches.'
                        : 'The bracket will be available once the tournament structure is configured.'}
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <Footer />
    </>
  );
}
