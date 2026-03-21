/**
 * Rank Modal - STUB FILE
 * 
 * This is a temporary stub extracted from tournament-hub to prevent import errors.
 * This component is still used by profile-page-settings and onboarding-checklist.
 */

import { useState } from 'react';
import { X, Crown } from 'lucide-react';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { Button } from '@/app/components/ui/button';
import { RANK_MEDALS, getRankDisplay } from '@/lib/rank-utils';

interface RankModalProps {
  currentRank: number | null;
  onClose: () => void;
  onSelect: (rankId: number) => void;
}

export function RankModal({ currentRank, onClose, onSelect }: RankModalProps) {
  const [selectedRank, setSelectedRank] = useState<number | null>(currentRank);

  return (
    <BottomSheetModal open={true} onClose={onClose} title="Select Your Rank">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(RANK_MEDALS).map(([id, medal]) => (
            <button
              key={id}
              onClick={() => setSelectedRank(parseInt(id))}
              className={`p-4 rounded-xl border-2 transition-all ${
                selectedRank === parseInt(id)
                  ? 'border-harvest bg-harvest/10'
                  : 'border-border bg-card hover:border-harvest/50'
              }`}
            >
              <img src={medal} alt={`Rank ${id}`} className="w-16 h-16 mx-auto mb-2" />
              <p className="text-sm font-semibold text-center text-foreground">
                {getRankDisplay(parseInt(id))}
              </p>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <Button
            onClick={onClose}
            className="flex-1 bg-muted hover:bg-muted/80 text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={() => selectedRank !== null && onSelect(selectedRank)}
            disabled={selectedRank === null}
            className="flex-1 bg-harvest hover:bg-harvest/90 text-soil"
          >
            Save Rank
          </Button>
        </div>
      </div>
    </BottomSheetModal>
  );
}
