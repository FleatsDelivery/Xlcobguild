/**
 * OfficerRankOverrideModal — Compact modal for officers to set a player's Dota 2 rank.
 *
 * Shown when an officer clicks an "Unranked" badge on a player card.
 * Supports medal + stars selection, fires POST /users/:id/rank/officer-override.
 */

import { useState } from 'react';
import { X, Shield, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { RankBadge } from '@/app/components/rank-badge';
import { toast } from 'sonner';
import { projectId } from '/utils/supabase/info';

const MEDALS = ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'] as const;

interface OfficerRankOverrideModalProps {
  /** The target user's database ID */
  targetUserId: string;
  /** Display name for the modal header */
  targetDisplayName: string;
  /** Current medal (if any) for pre-selection */
  currentMedal?: string | null;
  currentStars?: number;
  accessToken: string;
  onClose: () => void;
  /** Called after a successful override so the parent can refresh data */
  onSuccess?: (medal: string, stars: number) => void;
}

export function OfficerRankOverrideModal({
  targetUserId,
  targetDisplayName,
  currentMedal,
  currentStars,
  accessToken,
  onClose,
  onSuccess,
}: OfficerRankOverrideModalProps) {
  const [selectedMedal, setSelectedMedal] = useState<string | null>(
    currentMedal && currentMedal !== 'Unranked' ? currentMedal : null
  );
  const [selectedStars, setSelectedStars] = useState<number>(
    currentStars && currentStars > 0 ? currentStars : 1
  );
  const [saving, setSaving] = useState(false);

  const isImmortal = selectedMedal === 'Immortal';
  const displayRank = selectedMedal
    ? isImmortal ? 'Immortal' : `${selectedMedal} ${selectedStars}`
    : null;

  const handleSubmit = async () => {
    if (!selectedMedal) return;
    setSaving(true);
    try {
      const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;
      const res = await fetch(`${apiBase}/users/${targetUserId}/rank/officer-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ medal: selectedMedal, stars: isImmortal ? 0 : selectedStars }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Officer rank override failed:', data);
        toast.error(data.error || 'Failed to update rank');
        return;
      }
      toast.success(`Set ${targetDisplayName}'s rank to ${data.display}`);
      onSuccess?.(data.medal, data.stars);
      onClose();
    } catch (err) {
      console.error('Officer rank override error:', err);
      toast.error('Failed to update rank');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-3xl shadow-2xl max-w-sm w-full border-2 border-border" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="relative bg-gradient-to-br from-harvest/10 to-harvest/5 rounded-t-3xl p-4 sm:p-5 border-b-2 border-harvest/20">
          <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-card/80 hover:bg-card flex items-center justify-center">
            <X className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-harvest/20 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-harvest" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-foreground">Set Rank</h3>
              <p className="text-sm text-muted-foreground truncate">{targetDisplayName}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Medal grid */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Medal</p>
            <div className="grid grid-cols-4 gap-1.5">
              {MEDALS.map(medal => {
                const isSelected = selectedMedal === medal;
                return (
                  <button
                    key={medal}
                    onClick={() => {
                      setSelectedMedal(medal);
                      if (medal === 'Immortal') setSelectedStars(0);
                      else if (selectedStars === 0) setSelectedStars(1);
                    }}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border-2 transition-all text-center ${
                      isSelected
                        ? 'border-harvest bg-harvest/10'
                        : 'border-border hover:border-harvest/30'
                    }`}
                  >
                    <RankBadge medal={medal} stars={medal === 'Immortal' ? 0 : (isSelected ? selectedStars : 1)} size="sm" />
                    <span className={`text-[10px] font-bold leading-tight ${isSelected ? 'text-harvest' : 'text-muted-foreground'}`}>
                      {medal}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Star selector (hidden for Immortal) */}
          {selectedMedal && !isImmortal && (
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Stars</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setSelectedStars(star)}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
                      selectedStars === star
                        ? 'border-harvest bg-harvest/10 text-harvest'
                        : 'border-border text-muted-foreground hover:border-harvest/30'
                    }`}
                  >
                    {star}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {displayRank && (
            <div className="bg-muted rounded-xl p-3 flex items-center justify-center gap-2">
              <RankBadge medal={selectedMedal} stars={isImmortal ? 0 : selectedStars} size="lg" />
              <span className="text-sm font-bold text-foreground">{displayRank}</span>
            </div>
          )}

          {/* Officer note */}
          <div className="bg-harvest/5 rounded-xl p-3 border border-harvest/20 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-harvest flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              This overrides the player's rank for team rank calculation and tournament seeding. The player will be notified.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 pt-0 flex gap-3">
          <Button onClick={onClose} className="flex-1 bg-muted hover:bg-muted/80 text-foreground h-10 rounded-xl font-semibold text-sm">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedMedal || saving}
            className="flex-1 bg-harvest hover:bg-harvest/90 text-white h-10 rounded-xl font-bold text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
            Set Rank
          </Button>
        </div>
      </div>
    </div>
  );
}
