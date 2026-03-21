/**
 * Edit Bracket Series Modal
 * Officer-only modal for manually classifying series into bracket rounds
 */

import { useState } from 'react';
import { X, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface EditBracketSeriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tournamentId: string;
  series: {
    id: string;
    team1?: { name: string; tag: string };
    team2?: { name: string; tag: string };
    team1_score: number;
    team2_score: number;
  };
  currentRound?: string;
  currentPosition?: number;
  accessToken: string;
}

const ROUND_OPTIONS = [
  'Grand Finals',
  'Semifinals',
  'Quarterfinals',
  'Round of 16',
  'Round of 32',
  'Round 1',
  'Round 2',
  'Round 3',
];

export function EditBracketSeriesModal({
  isOpen,
  onClose,
  onSuccess,
  tournamentId,
  series,
  currentRound,
  currentPosition,
  accessToken,
}: EditBracketSeriesModalProps) {
  const [bracketRound, setBracketRound] = useState(currentRound || 'Grand Finals');
  const [bracketPosition, setBracketPosition] = useState(currentPosition || 1);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournamentId}/bracket/series/${series.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            bracket_round: bracketRound,
            bracket_position: bracketPosition,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update bracket classification');
      }

      toast.success('Bracket classification updated');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to update bracket classification:', error);
      toast.error(error.message || 'Failed to update bracket classification');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-soil/80 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border-2 border-border max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b-2 border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#8b5cf6]/10 rounded-xl flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-[#8b5cf6]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Edit Bracket Classification</h2>
              <p className="text-sm text-muted-foreground">
                {series.team1?.tag || 'TBD'} vs {series.team2?.tag || 'TBD'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Series Info */}
          <div className="bg-muted rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground">
                  {series.team1?.name || 'TBD'}
                </div>
                <div className="text-xs text-muted-foreground">{series.team1?.tag || 'TBD'}</div>
              </div>
              <div className="text-2xl font-black text-foreground">
                {series.team1_score} - {series.team2_score}
              </div>
              <div className="text-right">
                <div className="font-semibold text-foreground">
                  {series.team2?.name || 'TBD'}
                </div>
                <div className="text-xs text-muted-foreground">{series.team2?.tag || 'TBD'}</div>
              </div>
            </div>
          </div>

          {/* Bracket Round */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Bracket Round
            </label>
            <select
              value={bracketRound}
              onChange={(e) => setBracketRound(e.target.value)}
              className="w-full px-4 py-3 bg-input-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:border-harvest transition-colors"
            >
              {ROUND_OPTIONS.map((round) => (
                <option key={round} value={round}>
                  {round}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Which bracket round does this series belong to?
            </p>
          </div>

          {/* Position in Round */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Position in Round
            </label>
            <input
              type="number"
              min="1"
              max="16"
              value={bracketPosition}
              onChange={(e) => setBracketPosition(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-3 bg-input-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:border-harvest transition-colors"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Order within the round (1 = first match, 2 = second match, etc.)
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t-2 border-border flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-muted hover:bg-muted/80 rounded-xl font-semibold text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-harvest hover:bg-harvest/90 rounded-xl font-semibold text-soil transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Classification'}
          </button>
        </div>
      </div>
    </div>
  );
}
