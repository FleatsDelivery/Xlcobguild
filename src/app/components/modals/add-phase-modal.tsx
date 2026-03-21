/**
 * Add Phase Modal
 * Simple modal for adding a phase (Group Stage or Main Event) to the bracket builder.
 */

import { useState } from 'react';
import { X, GitBranch } from 'lucide-react';

const PHASE_OPTIONS = [
  {
    key: 'group_stage',
    name: 'Group Stage',
    description: 'Qualifying rounds — Quarterfinals, Semifinals, Round Robin, etc.',
    color: '#3b82f6',
  },
  {
    key: 'main_event',
    name: 'Main Event',
    description: 'The championship stage — Grand Finals and climactic rounds.',
    color: '#d6a615',
  },
] as const;

type PhaseKey = typeof PHASE_OPTIONS[number]['key'];

interface AddPhaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (phase: { key: PhaseKey; name: string }) => void;
  existingPhaseKeys: string[];
}

export function AddPhaseModal({ isOpen, onClose, onAdd, existingPhaseKeys }: AddPhaseModalProps) {
  const [selected, setSelected] = useState<PhaseKey>('group_stage');

  if (!isOpen) return null;

  const available = PHASE_OPTIONS.filter(p => !existingPhaseKeys.includes(p.key));

  const handleAdd = () => {
    const phase = PHASE_OPTIONS.find(p => p.key === selected);
    if (phase) {
      onAdd({ key: phase.key, name: phase.name });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-soil/80 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border-2 border-border max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b-2 border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-harvest/10 rounded-xl flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-harvest" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Add Phase</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Both phases have already been added.
            </p>
          ) : (
            <>
              <label className="block text-sm font-semibold text-foreground mb-2">Phase Type</label>
              <div className="space-y-2">
                {available.map((phase) => (
                  <button
                    key={phase.key}
                    onClick={() => setSelected(phase.key)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selected === phase.key
                        ? 'border-harvest bg-harvest/10'
                        : 'border-border hover:border-harvest/40 bg-muted'
                    }`}
                  >
                    <div className="font-bold text-foreground text-sm">{phase.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{phase.description}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t-2 border-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 rounded-xl font-semibold text-sm text-foreground transition-colors"
          >
            Cancel
          </button>
          {available.length > 0 && (
            <button
              onClick={handleAdd}
              className="flex-1 px-4 py-2.5 bg-harvest hover:bg-harvest/90 rounded-xl font-semibold text-sm text-soil transition-colors"
            >
              Add Phase
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
