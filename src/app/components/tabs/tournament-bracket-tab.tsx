/**
 * Tournament Bracket Tab
 *
 * Two modes:
 *   Viewer  — shows bracket with phase-separator headers (reads kkup_matches phase columns)
 *             Falls back to legacy kkup_bracket_series if no phase data exists.
 *   Builder — officer-only structure editor (add phases, groups, assign matches)
 */

import { useState, useEffect } from 'react';
import { GitBranch, Lock, Trophy, Clock, Hammer, Eye } from 'lucide-react';
import { useTournament } from '@/app/contexts/tournament-context';
import { isFinished } from '../tournament-state-config';
import { TeamLogo } from '../team-logo';
import { BracketBuilder } from '../bracket-builder';
import { Footer } from '@/app/components/footer';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// ═══════════════════════════════════════════════════════
// FORMAT PREVIEW (early phases — no bracket yet)
// ═══════════════════════════════════════════════════════

function BracketFormatPreview({ tournament }: { tournament: any }) {
  const format = tournament.format || 'Swiss';
  const teamCapacity = tournament.team_capacity || 16;

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl border-2 border-border p-6 sm:p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-[#8b5cf6]/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <GitBranch className="w-6 h-6 text-[#8b5cf6]" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {teamCapacity}-Team {format} Bracket
            </h2>
            <p className="text-muted-foreground">
              The bracket will be generated automatically after Roster Lock based on team registrations and seeding.
            </p>
          </div>
        </div>
        <div className="bg-muted rounded-xl p-6">
          <h3 className="font-bold text-foreground mb-3">How {format} Format Works</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><span className="text-foreground">•</span><span>Single elimination bracket</span></li>
            <li className="flex gap-2"><span className="text-foreground">•</span><span>Seeding based on average team rank</span></li>
            <li className="flex gap-2"><span className="text-foreground">•</span><span>Winners advance, losers are eliminated</span></li>
            <li className="flex gap-2"><span className="text-foreground">•</span><span>Best-of-3 series for semifinals and finals</span></li>
          </ul>
        </div>
      </div>

      <div className="bg-card rounded-2xl border-2 border-border p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-[#f59e0b]/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Lock className="w-6 h-6 text-[#f59e0b]" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-foreground mb-2">Bracket Generation</h3>
            <p className="text-muted-foreground mb-4">
              The bracket will be created automatically after teams lock their rosters.
            </p>
            <div className="space-y-3">
              {[
                { n: 1, label: 'Teams Lock Rosters', sub: tournament.roster_lock_date ? new Date(tournament.roster_lock_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA' },
                { n: 2, label: 'Bracket Auto-Generated', sub: 'Teams seeded by average rank' },
                { n: 3, label: 'Tournament Starts', sub: tournament.tournament_start_date ? new Date(tournament.tournament_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA' },
              ].map(({ n, label, sub }) => (
                <div key={n} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-foreground">{n}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-sm">{label}</div>
                    <div className="text-xs text-muted-foreground">{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MATCH CARD (used inside bracket viewer columns)
// ═══════════════════════════════════════════════════════

function BracketMatchCard({ match, showScores }: { match: any; showScores: boolean }) {
  const team1Won = match.winner_team_id && match.winner_team_id === match.team1_id;
  const team2Won = match.winner_team_id && match.winner_team_id === match.team2_id;

  return (
    <div className="bg-card rounded-xl border-2 border-border overflow-hidden hover:border-harvest/30 transition-all">
      {/* Team 1 */}
      <div className={`flex items-center gap-2.5 p-3 border-b border-border ${
        team1Won ? 'bg-[#10b981]/10' : team2Won ? 'opacity-60' : ''
      }`}>
        <TeamLogo teamTag={match.team1?.team_tag || ''} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground truncate text-sm">
            {match.team1?.team_name || 'TBD'}
          </div>
        </div>
        {showScores && match.team1_score !== null && match.team1_score !== undefined && (
          <div className={`text-xl font-black ${team1Won ? 'text-[#10b981]' : 'text-muted-foreground'}`}>
            {match.team1_score}
          </div>
        )}
      </div>

      {/* Team 2 */}
      <div className={`flex items-center gap-2.5 p-3 ${
        team2Won ? 'bg-[#10b981]/10' : team1Won ? 'opacity-60' : ''
      }`}>
        <TeamLogo teamTag={match.team2?.team_tag || ''} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground truncate text-sm">
            {match.team2?.team_name || 'TBD'}
          </div>
        </div>
        {showScores && match.team2_score !== null && match.team2_score !== undefined && (
          <div className={`text-xl font-black ${team2Won ? 'text-[#10b981]' : 'text-muted-foreground'}`}>
            {match.team2_score}
          </div>
        )}
      </div>

      {/* Scheduled time (when no result yet) */}
      {!match.winner_team_id && match.scheduled_time && (
        <div className="px-3 py-1.5 bg-muted border-t border-border flex items-center gap-2">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {new Date(match.scheduled_time).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            })}
          </span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PHASE-AWARE BRACKET VIEWER
// ═══════════════════════════════════════════════════════

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
}: {
  bracketConfig: any;
  assigned: Record<string, Record<string, any[]>>;
  showScores: boolean;
}) {
  const phases: any[] = bracketConfig?.phases || [];

  // If no phases configured yet, try to derive from match data
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

  // Merge phases from config with assigned match data
  const renderedPhases: { key: string; name: string; order: number; groups: any[] }[] = [];

  // Use config phases if available, else derive from data
  const phaseList = phases.length > 0
    ? phases.sort((a: any, b: any) => a.order - b.order)
    : Object.keys(assigned).map((key, i) => ({
        key,
        name: PHASE_DISPLAY[key]?.label || key,
        order: i + 1,
        groups: Object.keys(assigned[key]).map((gName, j) => ({
          name: gName,
          order: j + 1,
          matchup_type: assigned[key][gName][0]?.matchup_type,
        })),
      }));

  for (const phase of phaseList) {
    const phaseMatches = assigned[phase.key] || {};
    const groups = (phase.groups || [])
      .sort((a: any, b: any) => a.order - b.order)
      .map((g: any) => ({
        ...g,
        matches: (phaseMatches[g.name] || []).sort(
          (a: any, b: any) => (a.game_number || 0) - (b.game_number || 0)
        ),
      }))
      .filter((g: any) => g.matches.length > 0);

    // Also include any groups with matches not in config
    const configGroupNames = new Set((phase.groups || []).map((g: any) => g.name));
    for (const [gName, matches] of Object.entries(phaseMatches)) {
      if (!configGroupNames.has(gName) && matches.length > 0) {
        groups.push({
          name: gName,
          order: 99,
          matches: matches.sort((a: any, b: any) => (a.game_number || 0) - (b.game_number || 0)),
        });
      }
    }

    if (groups.length > 0) {
      renderedPhases.push({ key: phase.key, name: phase.name, order: phase.order, groups });
    }
  }

  return (
    <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
      {/* Bracket: horizontal scroll */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {renderedPhases.map((phase, phaseIdx) => {
            const display = PHASE_DISPLAY[phase.key] || { label: phase.name, color: '#8b5cf6' };
            return (
              <div key={phase.key}>
                {/* Phase Separator */}
                <div
                  className="flex items-center gap-3 px-6 py-3 border-b-2 border-border"
                  style={{ background: `${display.color}18` }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: display.color }}
                  />
                  <span
                    className="text-xs font-black uppercase tracking-widest"
                    style={{ color: display.color }}
                  >
                    {display.label}
                  </span>
                  {/* Separator line spanning across columns */}
                  <div
                    className="flex-1 h-px"
                    style={{ background: `${display.color}40` }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {phase.groups.length} group{phase.groups.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Match Group Columns */}
                <div className="flex gap-0 divide-x-2 divide-border">
                  {phase.groups.map((group: any) => (
                    <div key={group.name} className="flex flex-col" style={{ minWidth: '260px' }}>
                      {/* Column Header */}
                      <div className="px-4 py-3 border-b border-border bg-muted/50 text-center">
                        <div className="font-bold text-foreground text-sm">{group.name}</div>
                        {group.matchup_type && (
                          <div className="text-xs text-muted-foreground">
                            {matchupLabel(group.matchup_type)}
                          </div>
                        )}
                      </div>
                      {/* Matches */}
                      <div className="p-4 space-y-3 flex-1">
                        {group.matches.map((match: any) => (
                          <BracketMatchCard
                            key={match.id}
                            match={match}
                            showScores={showScores}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile scroll hint */}
      <div className="md:hidden p-3 bg-muted border-t-2 border-border text-center">
        <p className="text-xs text-muted-foreground">← Swipe to view all rounds →</p>
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
        <div className="flex gap-5 min-w-max">
          {ROUND_ORDER.filter(r => bracket[r]?.length > 0).map(round => (
            <div key={round} className="flex flex-col gap-4" style={{ minWidth: '260px' }}>
              <div className="text-center">
                <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wide">
                  {ROUND_LABELS[round] || round}
                </h3>
              </div>
              <div className="space-y-4">
                {bracket[round].map((series: any) => {
                  // Map series fields to match fields for BracketMatchCard
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
                    <BracketMatchCard
                      key={series.id}
                      match={mapped}
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
    const shouldFetch = ['roster_lock', 'live', 'completed', 'archived', 'active'].includes(tournament.status);
    if (shouldFetch) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [tournament]);

  if (!tournament) return null;

  const finished = isFinished(tournament.status);
  const showPreview = ['upcoming', 'registration_open', 'registration_closed'].includes(tournament.status);

  // Determine which viewer to show: new phase-aware or legacy
  const hasNewBracketData = builderData &&
    Object.keys(builderData.assigned).some(p =>
      Object.values(builderData.assigned[p]).some((g: any[]) => g.length > 0)
    );
  const hasLegacyBracket = legacyBracket &&
    Object.values(legacyBracket).some((arr: any) => arr?.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-muted-foreground text-sm">Loading bracket…</div>
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
