/**
 * Add / Edit Match Group Modal
 * Full form for configuring a match group within a bracket phase.
 * Matches Valve's league editor UI from the screenshots.
 */

import { useState, useEffect } from 'react';
import { X, Layers } from 'lucide-react';

export interface MatchGroupConfig {
  name: string;
  type: 'round_robin' | 'single_elim' | 'double_elim';
  team_count: number;
  advancing_team_count: number | null;
  next_advancing_team_count: number | null;
  matchup_type: 'bo1' | 'bo2' | 'bo3' | 'bo5';
  is_final_node_group: boolean;
  order: number;
}

const GROUP_TYPE_OPTIONS = [
  { value: 'round_robin',   label: 'Round Robin' },
  { value: 'single_elim',  label: 'Single Elim Bracket' },
  { value: 'double_elim',  label: 'Double Elim Bracket' },
] as const;

const MATCHUP_TYPE_OPTIONS = [
  { value: 'bo1', label: 'Best of 1' },
  { value: 'bo2', label: 'Best of 2' },
  { value: 'bo3', label: 'Best of 3' },
  { value: 'bo5', label: 'Best of 5' },
] as const;

interface AddMatchGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (group: MatchGroupConfig) => void;
  /** If provided, we're editing an existing group */
  existing?: MatchGroupConfig;
  /** Phase name for context in the header */
  phaseName: string;
  /** Order index this group will be placed at */
  nextOrder: number;
}

const DEFAULTS: MatchGroupConfig = {
  name: '',
  type: 'single_elim',
  team_count: 8,
  advancing_team_count: 4,
  next_advancing_team_count: null,
  matchup_type: 'bo3',
  is_final_node_group: false,
  order: 1,
};

export function AddMatchGroupModal({
  isOpen,
  onClose,
  onSave,
  existing,
  phaseName,
  nextOrder,
}: AddMatchGroupModalProps) {
  const [form, setForm] = useState<MatchGroupConfig>(existing || { ...DEFAULTS, order: nextOrder });

  useEffect(() => {
    if (isOpen) {
      setForm(existing || { ...DEFAULTS, order: nextOrder });
    }
  }, [isOpen, existing, nextOrder]);

  if (!isOpen) return null;

  const isEditing = !!existing;

  const set = <K extends keyof MatchGroupConfig>(key: K, value: MatchGroupConfig[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({ ...form, name: form.name.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-soil/80 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border-2 border-border max-w-md w-full overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b-2 border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#8b5cf6]/10 rounded-xl flex items-center justify-center">
              <Layers className="w-5 h-5 text-[#8b5cf6]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {isEditing ? 'Edit Match Group' : 'Add Match Group'}
              </h2>
              <p className="text-xs text-muted-foreground">{phaseName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Quarterfinals, Grand Finals"
              className="w-full px-3 py-2.5 bg-input-background border-2 border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-harvest transition-colors"
            />
          </div>

          {/* Match Group Type */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Match Group Type</label>
            <select
              value={form.type}
              onChange={e => set('type', e.target.value as MatchGroupConfig['type'])}
              className="w-full px-3 py-2.5 bg-input-background border-2 border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-harvest transition-colors"
            >
              {GROUP_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Team Count */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Team Count</label>
            <input
              type="number"
              min={2}
              max={32}
              value={form.team_count}
              onChange={e => set('team_count', parseInt(e.target.value) || 2)}
              className="w-full px-3 py-2.5 bg-input-background border-2 border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-harvest transition-colors"
            />
          </div>

          {/* Advancing Team Count — hide if final node */}
          {!form.is_final_node_group && (
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Advancing Team Count</label>
              <input
                type="number"
                min={0}
                max={form.team_count}
                value={form.advancing_team_count ?? ''}
                onChange={e => set('advancing_team_count', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="e.g. 4"
                className="w-full px-3 py-2.5 bg-input-background border-2 border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-harvest transition-colors"
              />
            </div>
          )}

          {/* Next Advancing Team Count */}
          {!form.is_final_node_group && (
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Next Advancing Team Count</label>
              <input
                type="number"
                min={0}
                value={form.next_advancing_team_count ?? ''}
                onChange={e => set('next_advancing_team_count', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Optional"
                className="w-full px-3 py-2.5 bg-input-background border-2 border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-harvest transition-colors"
              />
            </div>
          )}

          {/* Default Matchup Type */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Default Matchup Type</label>
            <select
              value={form.matchup_type}
              onChange={e => set('matchup_type', e.target.value as MatchGroupConfig['matchup_type'])}
              className="w-full px-3 py-2.5 bg-input-background border-2 border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-harvest transition-colors"
            >
              {MATCHUP_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Is Final Node Group */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
            <input
              type="checkbox"
              id="is_final_node_group"
              checked={form.is_final_node_group}
              onChange={e => set('is_final_node_group', e.target.checked)}
              className="w-4 h-4 accent-harvest cursor-pointer"
            />
            <label htmlFor="is_final_node_group" className="text-sm font-semibold text-foreground cursor-pointer">
              Is Final Node Group?
            </label>
            <span className="text-xs text-muted-foreground ml-auto">e.g. Grand Finals</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t-2 border-border flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 rounded-xl font-semibold text-sm text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name.trim()}
            className="flex-1 px-4 py-2.5 bg-harvest hover:bg-harvest/90 rounded-xl font-semibold text-sm text-soil transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEditing ? 'Save Changes' : 'Add Match Group'}
          </button>
        </div>
      </div>
    </div>
  );
}
