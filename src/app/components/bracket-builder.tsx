/**
 * Bracket Builder — Officer-only UI
 *
 * Lets officers define the tournament bracket structure (phases + match groups)
 * and assign existing kkup_matches rows to those groups.
 *
 * Data flow:
 *   bracket_config (JSONB on tournament) — phase/group metadata definitions
 *   kkup_matches columns                — actual phase/match_group assignments
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Plus, Trash2, Pencil, ChevronDown, ChevronUp,
  Trophy, Star, Layers, CheckSquare, Square, X,
  ArrowRight, Users, RefreshCw, Loader2,
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { AddPhaseModal } from './modals/add-phase-modal';
import { AddMatchGroupModal, type MatchGroupConfig } from './modals/add-match-group-modal';
import { TeamLogo } from './team-logo';
import { groupMatchesIntoSeries, type BracketSeries } from '@/lib/bracket-utils';
import { rankTierToDisplay } from '@/lib/rank-utils';

// ─── Types ────────────────────────────────────────────

interface BracketPhase {
  key: 'group_stage' | 'main_event';
  name: string;
  order: number;
  groups: MatchGroupConfig[];
}

interface BracketConfig {
  phases: BracketPhase[];
}

interface SeedTeam {
  team_id: string;
  team_name: string;
  team_tag: string;
  logo_url?: string;
  avg_rank_numeric: number;
  avg_rank_label: string;
  seed: number;
  roster: Array<{ display_name: string; rank_tier: number | null; rank_label: string }>;
}

interface Match {
  id: string;
  external_match_id?: string;
  series_id?: string;
  match_status: string;
  team1?: { id: string; team_name: string; team_tag: string };
  team2?: { id: string; team_name: string; team_tag: string };
  winner_team_id?: string;
  team1_score?: number;
  team2_score?: number;
  phase?: string;
  match_group?: string;
  match_group_type?: string;
  matchup_type?: string;
  game_number?: number;
  scheduled_time?: string;
}

interface BracketBuilderProps {
  tournamentId: string;
  accessToken: string;
  bracketConfig: BracketConfig;
  assigned: Record<string, Record<string, Match[]>>;
  unassigned: Match[];
  onRefresh: () => void;
}

// ─── Helpers ──────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  group_stage: '#3b82f6',
  main_event:  '#d6a615',
};

function matchupLabel(type?: string) {
  const map: Record<string, string> = { bo1: 'BO1', bo2: 'BO2', bo3: 'BO3', bo5: 'BO5' };
  return map[type || ''] || type || '—';
}

function groupTypeLabel(type?: string) {
  const map: Record<string, string> = {
    round_robin:  'Round Robin',
    single_elim:  'Single Elim',
    double_elim:  'Double Elim',
  };
  return map[type || ''] || type || '—';
}

// ─── Small Components ─────────────────────────────────

function MatchChip({ match, selected, onToggle }: {
  match: Match;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const isCompleted = match.match_status === 'completed' || match.winner_team_id;
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all w-full ${
        selected
          ? 'border-harvest bg-harvest/10'
          : 'border-border bg-card hover:border-harvest/40'
      }`}
    >
      {onToggle && (
        <div className="flex-shrink-0 text-harvest">
          {selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-muted-foreground" />}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 text-xs font-semibold text-foreground truncate">
          <span className="truncate">{match.team1?.team_tag || '?'}</span>
          {isCompleted && (
            <span className="text-muted-foreground font-normal">
              {match.team1_score ?? 0}–{match.team2_score ?? 0}
            </span>
          )}
          <span className="text-muted-foreground font-normal">vs</span>
          <span className="truncate">{match.team2?.team_tag || '?'}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {match.external_match_id ? `Match ${match.external_match_id}` : `Game ${match.game_number || 1}`}
          {match.matchup_type && ` · ${matchupLabel(match.matchup_type)}`}
        </div>
      </div>
      {isCompleted && (
        <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] flex-shrink-0" />
      )}
    </button>
  );
}

function SeriesChip({ series, selected, onToggle }: {
  series: BracketSeries;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const finished = series.team1_wins > series.team2_wins || series.team2_wins > series.team1_wins;
  const content = (
    <div className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all w-full ${
      selected
        ? 'border-harvest bg-harvest/10'
        : 'border-border bg-card hover:border-harvest/40'
    }`}>
      {onToggle && (
        <div className="flex-shrink-0 text-harvest">
          {selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-muted-foreground" />}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 text-xs font-semibold text-foreground truncate">
          <span className="truncate">{series.team1?.team_name || series.team1?.team_tag || 'TBD'}</span>
          {finished && (
            <span className="text-muted-foreground font-bold shrink-0">{series.team1_wins}–{series.team2_wins}</span>
          )}
          <span className="text-muted-foreground font-normal shrink-0">vs</span>
          <span className="truncate">{series.team2?.team_name || series.team2?.team_tag || 'TBD'}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {series.matches.length} game{series.matches.length !== 1 ? 's' : ''}
          {finished ? (finished ? ` · Done` : '') : ' · In Progress'}
        </div>
      </div>
      {finished && <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] flex-shrink-0" />}
    </div>
  );
  if (onToggle) return <button onClick={onToggle} className="w-full">{content}</button>;
  return content;
}

// ─── Match Group Card ─────────────────────────────────

function MatchGroupCard({
  group,
  phase,
  allPhases,
  assignedMatches,
  unassigned,
  onEdit,
  onDelete,
  onAssign,
  onUnassign,
  onAdvancementChange,
}: {
  group: MatchGroupConfig;
  phase: BracketPhase;
  allPhases: BracketPhase[];
  assignedMatches: Match[];
  unassigned: Match[];
  onEdit: () => void;
  onDelete: () => void;
  onAssign: (matchIds: string[]) => Promise<void>;
  onUnassign: (matchIds: string[]) => Promise<void>;
  onAdvancementChange: (
    field: 'winners_advance_to' | 'losers_advance_to',
    value: { phase_key: string; group_name: string } | null
  ) => void;
}) {
  const [assigning, setAssigning] = useState(false);
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Group the incoming matches into series
  const unassignedSeries = useMemo(() => groupMatchesIntoSeries(unassigned as any), [unassigned]);
  const assignedSeries = useMemo(() => groupMatchesIntoSeries(assignedMatches as any), [assignedMatches]);

  const toggleSelect = (seriesId: string) => {
    setSelectedSeriesIds(prev => {
      const next = new Set(prev);
      next.has(seriesId) ? next.delete(seriesId) : next.add(seriesId);
      return next;
    });
  };

  const handleSaveAssign = async () => {
    if (!selectedSeriesIds.size) return;
    setSaving(true);
    // Find all matching series and extract their match IDs
    const seriesToAssign = unassignedSeries.filter(s => selectedSeriesIds.has(s.series_id));
    const allMatchIds = seriesToAssign.flatMap(s => s.matches.map((m: any) => m.id));
    
    await onAssign(allMatchIds);
    setSaving(false);
    setSelectedSeriesIds(new Set());
    setAssigning(false);
  };

  const handleUnassignSeries = async (series: BracketSeries) => {
    const allMatchIds = series.matches.map((m: any) => m.id);
    await onUnassign(allMatchIds);
  };

  return (
    <div className="bg-muted rounded-xl border-2 border-border overflow-hidden">
      {/* Group Header */}
      <div className="flex items-center gap-3 p-3 border-b border-border">
        <Layers className="w-4 h-4 text-[#8b5cf6] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-foreground text-sm">{group.name}</span>
            {group.is_final_node_group && (
              <span className="flex items-center gap-1 text-xs text-harvest font-semibold">
                <Star className="w-3 h-3" /> Final
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {groupTypeLabel(group.type)} · {matchupLabel(group.matchup_type)} · {group.team_count} teams
              {group.advancing_team_count ? ` → ${group.advancing_team_count}` : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card transition-colors"
            title="Edit group"
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#ef4444]/10 transition-colors"
            title="Delete group"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#ef4444]" />
          </button>
        </div>
      </div>

      {/* Assigned Series */}
      <div className="p-3 space-y-2">
        {assignedSeries.length === 0 && !assigning && (
          <p className="text-xs text-muted-foreground text-center py-2">No matches assigned yet</p>
        )}
        {assignedSeries.map(series => (
          <div key={series.series_id} className="flex items-center gap-2">
            <div className="flex-1">
              <SeriesChip series={series} />
            </div>
            <button
              onClick={() => handleUnassignSeries(series)}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-[#ef4444]/10 transition-colors flex-shrink-0"
              title="Remove from group"
            >
              <X className="w-3 h-3 text-[#ef4444]" />
            </button>
          </div>
        ))}

        {/* Assign panel */}
        {assigning && (
          <div className="border-2 border-harvest/30 rounded-xl p-3 space-y-2 bg-harvest/5">
            <p className="text-xs font-semibold text-foreground mb-2">
              Select unassigned series to add:
            </p>
            {unassignedSeries.length === 0 ? (
              <p className="text-xs text-muted-foreground">No unassigned series available.</p>
            ) : (
              unassignedSeries.map(series => (
                <SeriesChip
                  key={series.series_id}
                  series={series}
                  selected={selectedSeriesIds.has(series.series_id)}
                  onToggle={() => toggleSelect(series.series_id)}
                />
              ))
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setAssigning(false); setSelectedSeriesIds(new Set()); }}
                className="flex-1 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-xs font-semibold text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAssign}
                disabled={!selectedSeriesIds.size || saving}
                className="flex-1 px-3 py-2 bg-harvest hover:bg-harvest/90 rounded-lg text-xs font-semibold text-soil transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : `Assign (${selectedSeriesIds.size})`}
              </button>
            </div>
          </div>
        )}

        {/* Assign button */}
        {!assigning && unassignedSeries.length > 0 && (
          <button
            onClick={() => setAssigning(true)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-border hover:border-harvest/40 text-xs text-muted-foreground hover:text-foreground transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Assign Matches
          </button>
        )}
      </div>

      {/* Advancement Links */}
      <div className="px-3 pb-3 pt-1 border-t border-border space-y-2">
        {/* Build dropdown options from all phases/groups, excluding self */}
        {(() => {
          const options: Array<{ label: string; phase_key: string; group_name: string }> = [];
          for (const p of allPhases) {
            for (const g of p.groups) {
              if (p.key === phase.key && g.name === group.name) continue; // skip self
              options.push({ label: `${p.name} — ${g.name}`, phase_key: p.key, group_name: g.name });
            }
          }
          const makeValue = (v: { phase_key: string; group_name: string } | null) =>
            v ? `${v.phase_key}::${v.group_name}` : '';
          const parseValue = (s: string) => {
            if (!s) return null;
            const [phase_key, ...rest] = s.split('::');
            return { phase_key, group_name: rest.join('::') };
          };
          return (
            <>
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Winners advance to
                </label>
                <select
                  value={makeValue(group.winners_advance_to ?? null)}
                  onChange={e => onAdvancementChange('winners_advance_to', parseValue(e.target.value))}
                  className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-harvest transition-colors"
                >
                  <option value="">Not Set</option>
                  {options.map(o => (
                    <option key={`${o.phase_key}::${o.group_name}`} value={`${o.phase_key}::${o.group_name}`}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {!group.is_final_node_group && (
                <div>
                  <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Losers advance to <span className="font-normal normal-case">(optional)</span>
                  </label>
                  <select
                    value={makeValue(group.losers_advance_to ?? null)}
                    onChange={e => onAdvancementChange('losers_advance_to', parseValue(e.target.value))}
                    className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-harvest transition-colors"
                  >
                    <option value="">Not Set</option>
                    {options.map(o => (
                      <option key={`${o.phase_key}::${o.group_name}`} value={`${o.phase_key}::${o.group_name}`}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          );
        })()}
      </div>

    </div>
  );
}

// ─── Phase Card ───────────────────────────────────────

function PhaseCard({
  phase,
  allPhases,
  assigned,
  unassigned,
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
  onDeletePhase,
  onAssign,
  onUnassign,
  onAdvancementChange,
}: {
  phase: BracketPhase;
  allPhases: BracketPhase[];
  assigned: Record<string, Match[]>;
  unassigned: Match[];
  onAddGroup: () => void;
  onEditGroup: (group: MatchGroupConfig) => void;
  onDeleteGroup: (groupName: string) => void;
  onDeletePhase: () => void;
  onAssign: (groupName: string, matchIds: string[], group: MatchGroupConfig) => Promise<void>;
  onUnassign: (matchIds: string[]) => Promise<void>;
  onAdvancementChange: (groupName: string, field: 'winners_advance_to' | 'losers_advance_to', value: { phase_key: string; group_name: string } | null) => void;
}) {
  const color = PHASE_COLORS[phase.key] || '#8b5cf6';
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
      {/* Phase Header */}
      <div
        className="flex items-center gap-3 p-4 border-b-2 border-border"
        style={{ background: `${color}15`, borderLeftColor: color, borderLeftWidth: 4 }}
      >
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: color }}
        />
        <span className="font-bold text-foreground text-base tracking-wide flex-1">
          {phase.name.toUpperCase()}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onAddGroup}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:opacity-80"
            style={{ background: `${color}20`, color }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Group
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
          >
            {collapsed
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
          </button>
          <button
            onClick={onDeletePhase}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#ef4444]/10 transition-colors"
            title="Delete phase"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#ef4444]" />
          </button>
        </div>
      </div>

      {/* Groups */}
      {!collapsed && (
        <div className="p-4 space-y-4">
          {phase.groups.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No match groups yet. Add one above.
            </p>
          )}
          {phase.groups
            .sort((a, b) => a.order - b.order)
            .map(group => (
              <MatchGroupCard
                key={group.name}
                group={group}
                phase={phase}
                allPhases={allPhases}
                assignedMatches={assigned[group.name] || []}
                unassigned={unassigned}
                onEdit={() => onEditGroup(group)}
                onDelete={() => onDeleteGroup(group.name)}
                onAssign={(ids) => onAssign(group.name, ids, group)}
                onUnassign={onUnassign}
                onAdvancementChange={(field, value) => onAdvancementChange(group.name, field, value)}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Builder ─────────────────────────────────────

export function BracketBuilder({
  tournamentId,
  accessToken,
  bracketConfig: initialConfig,
  assigned,
  unassigned,
  onRefresh,
}: BracketBuilderProps) {
  // Local draft state for the JSON bracket_config
  const [draftConfig, setDraftConfig] = useState<BracketConfig>(
    initialConfig?.phases ? JSON.parse(JSON.stringify(initialConfig)) : { phases: [] }
  );
  
  // Track if we have local changes to bracket_config
  const hasChanges = useMemo(() => {
    return JSON.stringify(draftConfig) !== JSON.stringify(initialConfig || { phases: [] });
  }, [draftConfig, initialConfig]);

  // Update draft when initialConfig changes (e.g. after a refresh), 
  // but ONLY if we don't have local changes we're working on.
  useEffect(() => {
    if (!hasChanges) {
      setDraftConfig(initialConfig?.phases ? JSON.parse(JSON.stringify(initialConfig)) : { phases: [] });
    }
  }, [initialConfig, hasChanges]);

  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [addGroupModal, setAddGroupModal] = useState<{
    phaseKey: string;
    phaseName: string;
    existing?: MatchGroupConfig;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken || publicAnonKey}`,
  };

  const saveConfig = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `${apiBase}/kkup/tournaments/${tournamentId}/bracket-builder/config`,
        { method: 'PUT', headers, body: JSON.stringify({ bracket_config: draftConfig }) }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      toast.success('Bracket structure saved');
      onRefresh(); // Re-fetch to sync all data
    } catch (err: any) {
      toast.error(`Failed to save structure: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [tournamentId, accessToken, draftConfig, onRefresh]);

  const handleDiscard = () => {
    setDraftConfig(initialConfig?.phases ? JSON.parse(JSON.stringify(initialConfig)) : { phases: [] });
    toast.info('Changes discarded');
  };

  // ── Phase operations ──

  const handleAddPhase = (phase: { key: 'group_stage' | 'main_event'; name: string }) => {
    const maxOrder = draftConfig.phases.reduce((m, p) => Math.max(m, p.order), 0);
    const newPhase: BracketPhase = {
      key: phase.key,
      name: phase.name,
      order: maxOrder + 1,
      groups: [],
    };
    setDraftConfig({ ...draftConfig, phases: [...draftConfig.phases, newPhase] });
    toast.success(`Phase "${phase.name}" added locally. Remember to save.`);
  };

  const handleDeletePhase = (phaseKey: string) => {
    setDraftConfig({ ...draftConfig, phases: draftConfig.phases.filter(p => p.key !== phaseKey) });
    toast.success('Phase removed locally. Remember to save.');
  };

  // ── Group operations ──

  const handleAddGroup = (phaseKey: string, group: MatchGroupConfig) => {
    setDraftConfig({
      ...draftConfig,
      phases: draftConfig.phases.map(p =>
        p.key === phaseKey
          ? { ...p, groups: [...p.groups, group] }
          : p
      ),
    });
    toast.success(`Group "${group.name}" added locally. Remember to save.`);
  };

  const handleEditGroup = (phaseKey: string, oldName: string, updated: MatchGroupConfig) => {
    setDraftConfig({
      ...draftConfig,
      phases: draftConfig.phases.map(p =>
        p.key === phaseKey
          ? {
              ...p,
              groups: p.groups.map(g => g.name === oldName ? updated : g),
            }
          : p
      ),
    });
    toast.success('Group updated locally');
  };

  const handleDeleteGroup = async (phaseKey: string, groupName: string) => {
    // Note: We still unassign matches immediately in the DB to avoid orphaned rows
    const matchesInGroup = (assigned[phaseKey]?.[groupName] || []).map((m: any) => m.id);
    if (matchesInGroup.length > 0) {
      try {
        const res = await fetch(
          `${apiBase}/kkup/tournaments/${tournamentId}/bracket-builder/unassign`,
          { method: 'PUT', headers, body: JSON.stringify({ match_ids: matchesInGroup }) }
        );
        if (!res.ok) {
          const err = await res.json();
          toast.error(`Could not unassign matches: ${err.error}`);
          return; 
        }
      } catch (err: any) {
        toast.error(`Network error unassigning matches: ${err.message}`);
        return;
      }
    }

    // Update draft locally
    setDraftConfig({
      ...draftConfig,
      phases: draftConfig.phases.map(p =>
        p.key === phaseKey
          ? { ...p, groups: p.groups.filter(g => g.name !== groupName) }
          : p
      ),
    });
    toast.success(`Group "${groupName}" removed locally. Remember to save.`);
  };


  // ── Match assignment ──

  const handleAssign = async (
    groupName: string,
    matchIds: string[],
    group: MatchGroupConfig,
    phase: BracketPhase,
  ) => {
    try {
      const res = await fetch(
        `${apiBase}/kkup/tournaments/${tournamentId}/bracket-builder/assign`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            match_ids: matchIds,
            phase: phase.key,
            match_group: groupName,
            match_group_type: group.type,
            matchup_type: group.matchup_type,
            is_final_node_group: group.is_final_node_group,
            phase_order: phase.order,
            match_group_order: group.order,
          }),
        }
      );
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`${matchIds.length} match${matchIds.length > 1 ? 'es' : ''} assigned to "${groupName}"`);
      onRefresh();
    } catch (err: any) {
      toast.error(`Assignment failed: ${err.message}`);
    }
  };

  const handleUnassign = async (matchIds: string[]) => {
    try {
      const res = await fetch(
        `${apiBase}/kkup/tournaments/${tournamentId}/bracket-builder/unassign`,
        { method: 'PUT', headers, body: JSON.stringify({ match_ids: matchIds }) }
      );
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Match removed from group');
      onRefresh();
    } catch (err: any) {
      toast.error(`Failed to unassign: ${err.message}`);
    }
  };

  const handleAdvancementChange = (
    phaseKey: string,
    groupName: string,
    field: 'winners_advance_to' | 'losers_advance_to',
    value: { phase_key: string; group_name: string } | null,
  ) => {
    setDraftConfig({
      ...draftConfig,
      phases: draftConfig.phases.map(p =>
        p.key === phaseKey
          ? {
              ...p,
              groups: p.groups.map(g =>
                g.name === groupName ? { ...g, [field]: value } : g
              ),
            }
          : p
      ),
    });
  };

  // ── Seed Teams state ──
  const [seedData, setSeedData] = useState<SeedTeam[] | null>(null);
  const [fetchingRanks, setFetchingRanks] = useState(false);
  const [loadingSeeds, setLoadingSeeds] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);

  const loadSeeds = async () => {
    setLoadingSeeds(true);
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/seeding`, { headers });
      if (!res.ok) throw new Error((await res.json()).error);
      const data: SeedTeam[] = await res.json();
      setSeedData(data);
    } catch (err: any) {
      toast.error(`Failed to load seeds: ${err.message}`);
    } finally {
      setLoadingSeeds(false);
    }
  };

  const handleFetchRanks = async () => {
    setFetchingRanks(true);
    try {
      const res = await fetch(
        `${apiBase}/kkup/tournaments/${tournamentId}/seeding/fetch-ranks`,
        { method: 'POST', headers, body: '{}' }
      );
      if (!res.ok) throw new Error((await res.json()).error);
      const result = await res.json();
      toast.success(`Ranks fetched: ${result.saved} saved, ${result.skipped_private} private/unranked`);
      await loadSeeds(); // reload with updated ranks
    } catch (err: any) {
      toast.error(`Rank fetch failed: ${err.message}`);
    } finally {
      setFetchingRanks(false);
    }
  };

  const existingPhaseKeys = draftConfig.phases.map(p => p.key);

  return (
    <div className="space-y-6">
      {/* Builder Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30 p-4 rounded-2xl border-2 border-border">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-5 h-5 text-harvest" />
            Bracket Builder
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define phases and match groups, then assign matches to each group.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <div className="flex items-center gap-2 mr-2 pr-4 border-r border-border">
              <button
                onClick={handleDiscard}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Discard
              </button>
              <button
                onClick={saveConfig}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-[#10b981] hover:bg-[#10b981]/90 rounded-xl font-bold text-sm text-white shadow-lg shadow-[#10b981]/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          )}
          <button
            onClick={() => setAddPhaseOpen(true)}
            disabled={existingPhaseKeys.length >= 2}
            className="flex items-center gap-2 px-4 py-2 bg-harvest hover:bg-harvest/90 rounded-xl font-semibold text-sm text-soil transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add Phase
          </button>
        </div>
      </div>

      {/* ── Seed Teams Panel ── */}
      <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
        <button
          onClick={() => { setSeedOpen(o => !o); if (!seedOpen && !seedData) loadSeeds(); }}
          className="w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors"
        >
          <Users className="w-4 h-4 text-harvest flex-shrink-0" />
          <span className="font-bold text-foreground text-sm flex-1 text-left">Seed Teams</span>
          <span className="text-xs text-muted-foreground">
            {seedData ? `${seedData.length} teams ranked` : 'Click to load'}
          </span>
          {seedOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {seedOpen && (
          <div className="border-t border-border p-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Teams ranked by average Dota 2 MMR from their roster. Unranked / private players count as rank 0 (worst seed).
            </p>

            {/* Fetch controls */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleFetchRanks}
                disabled={fetchingRanks}
                className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-xl text-xs font-semibold text-foreground transition-colors disabled:opacity-50"
              >
                {fetchingRanks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {fetchingRanks ? 'Fetching from OpenDota…' : 'Fetch Missing Ranks'}
              </button>
              {seedData && (
                <button
                  onClick={loadSeeds}
                  disabled={loadingSeeds}
                  className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-xl text-xs font-semibold text-foreground transition-colors disabled:opacity-50"
                >
                  {loadingSeeds ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Reload
                </button>
              )}
            </div>

            {/* Loading state */}
            {loadingSeeds && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Computing seeds…
              </div>
            )}

            {/* Seed list */}
            {seedData && !loadingSeeds && (
              <>
                <div className="space-y-2">
                  {seedData.map(team => (
                    <div key={team.team_id} className="flex items-center gap-3 p-2.5 bg-muted rounded-xl">
                      <div className="w-7 h-7 rounded-full bg-harvest/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-black text-harvest">{team.seed}</span>
                      </div>
                      <TeamLogo teamTag={team.team_tag} logoUrl={team.logo_url} size="xs" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-foreground truncate">{team.team_name}</div>
                        <div className="text-xs text-muted-foreground">{team.avg_rank_label}</div>
                      </div>
                      <div className="text-right flex-shrink-0 text-xs text-muted-foreground">
                        {team.roster.filter(r => r.rank_tier).length}/{team.roster.length} ranked
                      </div>
                    </div>
                  ))}
                </div>

                {seedData.length >= 2 && (
                  <div className="text-xs text-muted-foreground pt-2 border-t border-border space-y-0.5">
                    <span className="font-semibold text-foreground block mb-1">Standard seeded pairings:</span>
                    {Array.from({ length: Math.floor(seedData.length / 2) }, (_, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <ArrowRight className="w-3 h-3" />
                        Seed {i + 1} vs Seed {seedData.length - i}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Phase Cards */}
      {draftConfig.phases.length === 0 && (
        <div className="bg-card rounded-2xl border-2 border-border border-dashed p-10 text-center">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-semibold">No phases defined yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Start by adding a phase (Group Stage or Main Event).
          </p>
        </div>
      )}

      {draftConfig.phases
        .sort((a, b) => a.order - b.order)
        .map(phase => {
          const phaseAssigned = assigned[phase.key] || {};
          return (
          <PhaseCard
              key={phase.key}
              phase={phase}
              allPhases={draftConfig.phases}
              assigned={phaseAssigned}

              unassigned={unassigned}
              onAddGroup={() =>
                setAddGroupModal({
                  phaseKey: phase.key,
                  phaseName: phase.name,
                })
              }
              onEditGroup={(group) =>
                setAddGroupModal({
                  phaseKey: phase.key,
                  phaseName: phase.name,
                  existing: group,
                })
              }
              onDeleteGroup={(groupName) => handleDeleteGroup(phase.key, groupName)}
              onDeletePhase={() => handleDeletePhase(phase.key)}
              onAssign={(groupName, matchIds, group) =>
                handleAssign(groupName, matchIds, group, phase)
              }
              onUnassign={handleUnassign}
              onAdvancementChange={(groupName, field, value) =>
                handleAdvancementChange(phase.key, groupName, field, value)
              }
            />
          );
        })}

      {/* Unassigned Matches */}
      {unassigned.length > 0 && (
        <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
          <div className="p-4 border-b-2 border-border flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
            <span className="font-bold text-foreground text-sm">
              Unassigned Matches ({unassigned.length})
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              — assign these to a group above
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {unassigned.map(match => (
              <MatchChip key={match.id} match={match} />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <AddPhaseModal
        isOpen={addPhaseOpen}
        onClose={() => setAddPhaseOpen(false)}
        onAdd={handleAddPhase}
        existingPhaseKeys={existingPhaseKeys}
      />

      {addGroupModal && (
        <AddMatchGroupModal
          isOpen={!!addGroupModal}
          onClose={() => setAddGroupModal(null)}
          phaseName={addGroupModal.phaseName}
          existing={addGroupModal.existing}
          nextOrder={
            (draftConfig.phases.find(p => p.key === addGroupModal.phaseKey)?.groups.length || 0) + 1
          }
          onSave={(group) => {
            if (addGroupModal.existing) {
              handleEditGroup(addGroupModal.phaseKey, addGroupModal.existing.name, group);
            } else {
              handleAddGroup(addGroupModal.phaseKey, group);
            }
          }}
        />
      )}
    </div>
  );
}
