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

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Plus, Trash2, Pencil, ChevronDown, ChevronUp,
  Trophy, Star, Layers, CheckSquare, Square, X,
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { AddPhaseModal } from './modals/add-phase-modal';
import { AddMatchGroupModal, type MatchGroupConfig } from './modals/add-match-group-modal';
import { TeamLogo } from './team-logo';

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

// ─── Match Group Card ─────────────────────────────────

function MatchGroupCard({
  group,
  phase,
  assignedMatches,
  unassigned,
  onEdit,
  onDelete,
  onAssign,
  onUnassign,
}: {
  group: MatchGroupConfig;
  phase: BracketPhase;
  assignedMatches: Match[];
  unassigned: Match[];
  onEdit: () => void;
  onDelete: () => void;
  onAssign: (matchIds: string[]) => Promise<void>;
  onUnassign: (matchIds: string[]) => Promise<void>;
}) {
  const [assigning, setAssigning] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSaveAssign = async () => {
    if (!selected.size) return;
    setSaving(true);
    await onAssign(Array.from(selected));
    setSaving(false);
    setSelected(new Set());
    setAssigning(false);
  };

  const handleUnassignMatch = async (matchId: string) => {
    await onUnassign([matchId]);
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

      {/* Assigned Matches */}
      <div className="p-3 space-y-2">
        {assignedMatches.length === 0 && !assigning && (
          <p className="text-xs text-muted-foreground text-center py-2">No matches assigned yet</p>
        )}
        {assignedMatches.map(match => (
          <div key={match.id} className="flex items-center gap-2">
            <div className="flex-1">
              <MatchChip match={match} />
            </div>
            <button
              onClick={() => handleUnassignMatch(match.id)}
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
              Select unassigned matches to add:
            </p>
            {unassigned.length === 0 ? (
              <p className="text-xs text-muted-foreground">No unassigned matches available.</p>
            ) : (
              unassigned.map(match => (
                <MatchChip
                  key={match.id}
                  match={match}
                  selected={selected.has(match.id)}
                  onToggle={() => toggleSelect(match.id)}
                />
              ))
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setAssigning(false); setSelected(new Set()); }}
                className="flex-1 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-xs font-semibold text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAssign}
                disabled={!selected.size || saving}
                className="flex-1 px-3 py-2 bg-harvest hover:bg-harvest/90 rounded-lg text-xs font-semibold text-soil transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : `Assign (${selected.size})`}
              </button>
            </div>
          </div>
        )}

        {/* Assign button */}
        {!assigning && unassigned.length > 0 && (
          <button
            onClick={() => setAssigning(true)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-border hover:border-harvest/40 text-xs text-muted-foreground hover:text-foreground transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Assign Matches
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Phase Card ───────────────────────────────────────

function PhaseCard({
  phase,
  assigned,
  unassigned,
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
  onDeletePhase,
  onAssign,
  onUnassign,
}: {
  phase: BracketPhase;
  assigned: Record<string, Match[]>;
  unassigned: Match[];
  onAddGroup: () => void;
  onEditGroup: (group: MatchGroupConfig) => void;
  onDeleteGroup: (groupName: string) => void;
  onDeletePhase: () => void;
  onAssign: (groupName: string, matchIds: string[], group: MatchGroupConfig) => Promise<void>;
  onUnassign: (matchIds: string[]) => Promise<void>;
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
                assignedMatches={assigned[group.name] || []}
                unassigned={unassigned}
                onEdit={() => onEditGroup(group)}
                onDelete={() => onDeleteGroup(group.name)}
                onAssign={(ids) => onAssign(group.name, ids, group)}
                onUnassign={onUnassign}
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
  const [config, setConfig] = useState<BracketConfig>(
    initialConfig?.phases ? initialConfig : { phases: [] }
  );
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

  const saveConfig = useCallback(async (newConfig: BracketConfig) => {
    setSaving(true);
    try {
      const res = await fetch(
        `${apiBase}/kkup/tournaments/${tournamentId}/bracket-builder/config`,
        { method: 'PUT', headers, body: JSON.stringify({ bracket_config: newConfig }) }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
    } catch (err: any) {
      toast.error(`Failed to save structure: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [tournamentId, accessToken]);

  // ── Phase operations ──

  const handleAddPhase = async (phase: { key: 'group_stage' | 'main_event'; name: string }) => {
    const maxOrder = config.phases.reduce((m, p) => Math.max(m, p.order), 0);
    const newPhase: BracketPhase = {
      key: phase.key,
      name: phase.name,
      order: maxOrder + 1,
      groups: [],
    };
    const newConfig = { ...config, phases: [...config.phases, newPhase] };
    setConfig(newConfig);
    await saveConfig(newConfig);
    toast.success(`Phase "${phase.name}" added`);
  };

  const handleDeletePhase = async (phaseKey: string) => {
    const newConfig = { ...config, phases: config.phases.filter(p => p.key !== phaseKey) };
    setConfig(newConfig);
    await saveConfig(newConfig);
    toast.success('Phase removed');
    onRefresh();
  };

  // ── Group operations ──

  const handleAddGroup = async (phaseKey: string, group: MatchGroupConfig) => {
    const newConfig = {
      ...config,
      phases: config.phases.map(p =>
        p.key === phaseKey
          ? { ...p, groups: [...p.groups, group] }
          : p
      ),
    };
    setConfig(newConfig);
    await saveConfig(newConfig);
    toast.success(`Group "${group.name}" added`);
  };

  const handleEditGroup = async (phaseKey: string, oldName: string, updated: MatchGroupConfig) => {
    const newConfig = {
      ...config,
      phases: config.phases.map(p =>
        p.key === phaseKey
          ? {
              ...p,
              groups: p.groups.map(g => g.name === oldName ? updated : g),
            }
          : p
      ),
    };
    setConfig(newConfig);
    await saveConfig(newConfig);
    toast.success(`Group "${updated.name}" updated`);
  };

  const handleDeleteGroup = async (phaseKey: string, groupName: string) => {
    const newConfig = {
      ...config,
      phases: config.phases.map(p =>
        p.key === phaseKey
          ? { ...p, groups: p.groups.filter(g => g.name !== groupName) }
          : p
      ),
    };
    setConfig(newConfig);
    await saveConfig(newConfig);
    toast.success(`Group "${groupName}" removed`);
    onRefresh();
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

  const existingPhaseKeys = config.phases.map(p => p.key);

  return (
    <div className="space-y-6">
      {/* Builder Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-5 h-5 text-harvest" />
            Bracket Builder
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define phases and match groups, then assign matches to each group.
          </p>
        </div>
        <button
          onClick={() => setAddPhaseOpen(true)}
          disabled={existingPhaseKeys.length >= 2}
          className="flex items-center gap-2 px-4 py-2 bg-harvest hover:bg-harvest/90 rounded-xl font-semibold text-sm text-soil transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Add Phase
        </button>
      </div>

      {/* Phase Cards */}
      {config.phases.length === 0 && (
        <div className="bg-card rounded-2xl border-2 border-border border-dashed p-10 text-center">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-semibold">No phases defined yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Start by adding a phase (Group Stage or Main Event).
          </p>
        </div>
      )}

      {config.phases
        .sort((a, b) => a.order - b.order)
        .map(phase => {
          const phaseAssigned = assigned[phase.key] || {};
          return (
            <PhaseCard
              key={phase.key}
              phase={phase}
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
            (config.phases.find(p => p.key === addGroupModal.phaseKey)?.groups.length || 0) + 1
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
