/**
 * Tournament Bracket Tab
 *
 * Two modes:
 *   Viewer  — shows bracket with phase-separator headers (reads kkup_matches phase columns)
 *             Falls back to legacy kkup_bracket_series if no phase data exists.
 *   Builder — officer-only structure editor (add phases, groups, assign matches)
 */

import { useState, useEffect } from 'react';
import { GitBranch, Trophy, Clock, Hammer, Eye, Loader2 } from 'lucide-react';
import { useTournament } from '@/app/contexts/tournament-context';
import { isFinished } from '../tournament-state-config';
import { TeamLogo } from '../team-logo';
import { BracketBuilder } from '../bracket-builder';
import { Footer } from '@/app/components/footer';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { groupMatchesIntoSeries, BracketSeries } from '@/lib/bracket-utils';

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
const CARD_H  = 100;  // px — height of each series card (two 48px rows + border)
const CARD_W  = 240;  // px — width of each series card
const MIN_GAP = 20;   // px — minimum gap between cards in the densest column
const BASE_SLOT = CARD_H + MIN_GAP; // slot height for densest round
const CONN_W  = 56;   // px — width of the connector SVG between columns
const PAD_TOP = 52;   // px — top padding (room for column headers)

// ─── Series Card ─────────────────────────────────────────────────────────────
function BracketSeriesCard({ series, showScores, compact, tournamentName }: { series: BracketSeries; showScores: boolean; compact?: boolean; tournamentName?: string }) {
  const t1w = series.team1_wins > series.team2_wins;
  const t2w = series.team2_wins > series.team1_wins;
  const finished = t1w || t2w;

  return (
    <div
      className="rounded-xl border-2 border-border overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-harvest/40"
      style={{ width: CARD_W, background: 'var(--card)' }}
    >
      {/* Team 1 row */}
      <div className={`flex items-center gap-2 px-2.5 py-2 border-b border-border ${t1w ? 'bg-[#10b981]/8' : finished ? 'opacity-50' : ''}`}>
        <TeamLogo
          teamTag={series.team1?.team_tag || ''}
          teamName={series.team1?.team_name}
          logoUrl={series.team1?.logo_url}
          tournamentName={tournamentName}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] font-semibold truncate ${t1w ? 'text-foreground' : 'text-foreground'}`}>
            {series.team1?.team_name || 'TBD'}
          </div>
        </div>
        {showScores && (
          <div className={`text-base font-black w-5 text-right ${t1w ? 'text-[#10b981]' : 'text-muted-foreground'}`}>
            {series.team1_wins}
          </div>
        )}
      </div>
      {/* Team 2 row */}
      <div className={`flex items-center gap-2 px-2.5 py-2 ${t2w ? 'bg-[#10b981]/8' : finished ? 'opacity-50' : ''}`}>
        <TeamLogo
          teamTag={series.team2?.team_tag || ''}
          teamName={series.team2?.team_name}
          logoUrl={series.team2?.logo_url}
          tournamentName={tournamentName}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className={`text-[13px] font-semibold truncate ${t2w ? 'text-foreground' : 'text-foreground'}`}>
            {series.team2?.team_name || 'TBD'}
          </div>
        </div>
        {showScores && (
          <div className={`text-base font-black w-5 text-right ${t2w ? 'text-[#10b981]' : 'text-muted-foreground'}`}>
            {series.team2_wins}
          </div>
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

// ─── Bracket Connector SVG ────────────────────────────────────────────────────
// Draws the classic bracket elbow lines between adjacent columns.
// fromSlotH / toSlotH are the slot heights in each column.
// fromCount / toCount are the number of series in each column.
// totalH is the full bracket height (same for both columns).
function BracketConnector({
  fromCount,
  toCount,
  fromSlotH,
  toSlotH,
  totalH,
}: {
  fromCount: number;
  toCount: number;
  fromSlotH: number;
  toSlotH: number;
  totalH: number;
}) {
  const paths: JSX.Element[] = [];
  const mid = CONN_W / 2;

  if (fromCount >= toCount && toCount > 0) {
    // Seeded bracket pairing: fi=0 & fi=(N-1) → ti=0, fi=1 & fi=(N-2) → ti=1, etc.
    const half = fromCount / 2;
    for (let fi = 0; fi < fromCount; fi++) {
      const ti = fi < half ? fi : fromCount - 1 - fi;
      // Center Y of slot = slotIndex × slotH + slotH/2
      // (cards are absolutely positioned inside slots; the slot self-centers them)
      const fromCY = fi * fromSlotH + fromSlotH / 2;
      const toCY   = ti * toSlotH   + toSlotH   / 2;
      paths.push(
        <path
          key={`${fi}-${ti}`}
          d={`M 0,${fromCY} H ${mid} V ${toCY} H ${CONN_W}`}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    }
  } else if (toCount > fromCount && fromCount > 0) {
    // Expanding — single source splits out to multiple targets
    const half = toCount / 2;
    for (let ti = 0; ti < toCount; ti++) {
      const fi = ti < half ? ti : toCount - 1 - ti;
      const fromCY = fi * fromSlotH + fromSlotH / 2;
      const toCY   = ti * toSlotH   + toSlotH   / 2;
      paths.push(
        <path
          key={`${fi}-${ti}`}
          d={`M 0,${fromCY} H ${mid} V ${toCY} H ${CONN_W}`}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    }
  } else {
    // Same count — straight pass-through lines
    for (let i = 0; i < fromCount; i++) {
      const cy = i * fromSlotH + fromSlotH / 2;
      paths.push(
        <line key={i} x1={0} y1={cy} x2={CONN_W} y2={cy}
          stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" />
      );
    }
  }

  return (
    <svg
      width={CONN_W}
      height={totalH}
      style={{ flexShrink: 0, overflow: 'visible' }}
    >
      {paths}
    </svg>
  );
}


// ─── Phase-Aware Bracket Viewer ────────────────────────────────────────────────
const PHASE_DISPLAY: Record<string, { label: string; color: string }> = {
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
}: {
  bracketConfig: any;
  assigned: Record<string, Record<string, any[]>>;
  showScores: boolean;
  tournamentName?: string;
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
    ? [...phases].sort((a: any, b: any) => a.order - b.order)
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
    phaseLabel: string;
    phaseColor: string;
    matchupType?: string;
    series: BracketSeries[];
    winnersAdvanceTo: { phase_key: string; group_name: string } | null;
  }

  const rounds: BracketRound[] = [];
  for (const phase of phaseList) {
    const phaseMatches = assigned[phase.key] || {};
    const display = PHASE_DISPLAY[phase.key] || { label: phase.name, color: '#8b5cf6' };
    const sortedGroups = [...(phase.groups || [])].sort((a: any, b: any) => a.order - b.order);

    for (const g of sortedGroups) {
      const rawMatches = (phaseMatches[g.name] || []).sort(
        (a: any, b: any) => (a.game_number || 0) - (b.game_number || 0)
      );
      if (rawMatches.length === 0) continue;
      const series = groupMatchesIntoSeries(rawMatches);
      if (series.length === 0) continue;
      rounds.push({
        key: `${phase.key}__${g.name}`,
        label: g.name,
        phaseLabel: display.label,
        phaseColor: display.color,
        matchupType: g.matchup_type,
        series,
        winnersAdvanceTo: (g as any).winners_advance_to ?? null,
      });
    }
  }

  if (rounds.length === 0) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-10 text-center">
        <GitBranch className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">No Matches Yet</h3>
        <p className="text-muted-foreground">Matches will appear here once they are assigned to bracket groups.</p>
      </div>
    );
  }

  // ── Slot height math ─────────────────────────────────────────────────────
  const maxSeries = Math.max(...rounds.map(r => r.series.length));
  const totalH = maxSeries * BASE_SLOT;

  const slotHeightFor = (count: number) => (count > 0 ? totalH / count : totalH);

  // ── Champion — find winner of last round ──────────────────────────────────
  const lastRound = rounds[rounds.length - 1];
  const champion = showScores && lastRound?.series.length === 1
    ? lastRound.series[0]
    : null;
  const championTeam = champion
    ? (champion.team1_wins > champion.team2_wins ? champion.team1 : champion.team2_wins > champion.team1_wins ? champion.team2 : null)
    : null;
  const championWinnerId = champion?.winner_team_id;
  const championTeamResolved =
    championWinnerId && champion
      ? (champion.team1_id === championWinnerId ? champion.team1 : champion.team2)
      : null;

  return (
    <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
      <div className="overflow-x-auto">
        <div
          className="flex items-start"
          style={{ padding: `${PAD_TOP}px 40px 40px 40px`, minWidth: 'max-content' }}
        >
          {rounds.map((round, ri) => {
            const slotH = slotHeightFor(round.series.length);
            const nextRound = rounds[ri + 1];

            return (
              <div key={round.key} className="flex items-start">
                {/* ── Column ─────────────────────────────────────────── */}
                <div style={{ width: CARD_W, position: 'relative' }}>
                  {/* Column Header */}
                  <div
                    className="absolute left-0 right-0 text-center"
                    style={{ top: -PAD_TOP + 4 }}
                  >
                    <div
                      className="text-[9px] font-black uppercase tracking-[0.18em] mb-0.5"
                      style={{ color: round.phaseColor }}
                    >
                      {round.phaseLabel}
                    </div>
                    <div className="text-sm font-bold text-foreground leading-tight">
                      {round.label}
                    </div>
                    {round.matchupType && (
                      <div className="mt-0.5 inline-block text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                        {matchupLabel(round.matchupType)}
                      </div>
                    )}
                  </div>

                  {/* Cards — absolutely positioned by slot */}
                  <div style={{ position: 'relative', height: totalH }}>
                    {round.series.map((series, si) => {
                      const cardTop = si * slotH + (slotH - CARD_H) / 2;
                      return (
                        <div
                          key={series.series_id}
                          style={{ position: 'absolute', top: cardTop, left: 0 }}
                        >
                          <BracketSeriesCard series={series} showScores={showScores} tournamentName={tournamentName} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Advancement footer */}
                  {round.winnersAdvanceTo && (() => {
                    const targetPhase = phaseList.find((p: any) => p.key === round.winnersAdvanceTo!.phase_key);
                    const targetPhaseName = targetPhase?.name || round.winnersAdvanceTo.phase_key;
                    return (
                      <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-muted-foreground">
                        <span>↓</span>
                        <span>Advancing to: <span className="font-semibold text-foreground">{targetPhaseName} — {round.winnersAdvanceTo.group_name}</span></span>
                      </div>
                    );
                  })()}
                </div>

                {/* ── Connector SVG to next round ───────────────────── */}
                {nextRound && (
                  <BracketConnector
                    fromCount={round.series.length}
                    toCount={nextRound.series.length}
                    fromSlotH={slotH}
                    toSlotH={slotHeightFor(nextRound.series.length)}
                    totalH={totalH}
                  />
                )}
              </div>
            );
          })}

          {/* ── Champion Badge ──────────────────────────────────────── */}
          {championTeamResolved && (
            <div
              className="flex flex-col items-center justify-center"
              style={{ width: 160, height: totalH, flexShrink: 0, paddingLeft: 8 }}
            >
              {/* Short connector line from left */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-12 flex items-center justify-center rounded-2xl bg-harvest/15 border-2 border-harvest/40 shadow-inner">
                  <Trophy className="w-5 h-5 text-harvest" />
                </div>
                <div className="text-center">
                  <div className="text-[9px] font-black uppercase tracking-[0.15em] text-harvest mb-1">Champion</div>
                  <div className="flex flex-col items-center gap-1">
                    <TeamLogo
                      teamTag={championTeamResolved.team_tag || ''}
                      teamName={championTeamResolved.team_name}
                      logoUrl={championTeamResolved.logo_url}
                      tournamentName={tournamentName}
                      size="sm"
                    />
                    <div className="font-bold text-foreground text-sm text-center leading-tight max-w-[140px]">
                      {championTeamResolved.team_name}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile hint */}
      <div className="md:hidden p-3 bg-muted border-t-2 border-border text-center">
        <p className="text-xs text-muted-foreground">← Swipe to view full bracket →</p>
      </div>
    </div>
  );
}




// ═══════════════════════════════════════════════════════
// LEGACY VIEWER (kkup_bracket_series fallback)
// ═══════════════════════════════════════════════════════

function LegacyBracketViewer({ bracket, showScores }: { bracket: any; showScores: boolean }) {
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
                  const mapped = {
                    id: series.id,
                    team1_id: series.radiant_team_id,
                    team2_id: series.dire_team_id,
                    winner_team_id: series.winner_team_id,
                    team1: series.radiant_team ? {
                      team_name: series.radiant_team.team_name,
                      team_tag: series.radiant_team.team_tag,
                    } : null,
                    team2: series.dire_team ? {
                      team_name: series.dire_team.team_name,
                      team_tag: series.dire_team.team_tag,
                    } : null,
                    team1_score: series.radiant_score ?? null,
                    team2_score: series.dire_score ?? null,
                    scheduled_time: series.scheduled_time,
                  };
                  return (
                    <BracketSeriesCard
                      key={series.id}
                      series={{...mapped, series_id: mapped.id, team1_wins: mapped.team1_score || 0, team2_wins: mapped.team2_score || 0, matches: [mapped]} as any}
                      showScores={showScores}
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

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;
  const token = accessToken || publicAnonKey;

  const fetchData = async () => {
    if (!tournament) return;
    setLoading(true);

    try {
      // Fetch new bracket builder data
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
  const hasNewBracketData = builderData &&
    Object.keys(builderData.assigned).some(p =>
      Object.values(builderData.assigned[p]).some((g: any[]) => g.length > 0)
    );
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
                  />
                ) : hasLegacyBracket ? (
                  <LegacyBracketViewer bracket={legacyBracket} showScores={finished} />
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
