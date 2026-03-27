import { useState } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Users, Trophy, Lock, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// ═══════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════

const PHASE_TRANSITIONS: Record<string, { prev: string | null; next: string | null }> = {
  upcoming: { prev: null, next: 'registration_open' },
  registration_open: { prev: 'upcoming', next: 'registration_closed' },
  registration_closed: { prev: 'registration_open', next: 'roster_lock' },
  roster_lock: { prev: 'registration_closed', next: 'live' },
  live: { prev: 'roster_lock', next: 'completed' },
  completed: { prev: 'live', next: 'archived' },
  archived: { prev: null, next: 'upcoming' },
};

const PHASE_LABELS: Record<string, string> = {
  upcoming: 'Upcoming',
  registration_open: 'Registration Open',
  registration_closed: 'Registration Closed',
  roster_lock: 'Roster Lock',
  live: 'Live',
  completed: 'Completed',
  archived: 'Archived',
};

const PHASE_ACTIONS: Record<string, { forward: string; backward: string }> = {
  upcoming: { forward: 'Open Registration', backward: '' },
  registration_open: { forward: 'Close Registration', backward: 'Revert to Upcoming' },
  registration_closed: { forward: 'Lock Rosters & Generate Bracket', backward: 'Re-Open Registration' },
  roster_lock: { forward: 'Start Tournament (Go Live)', backward: 'Unlock Rosters' },
  live: { forward: 'Mark as Completed', backward: 'Revert to Roster Lock' },
  completed: { forward: 'Archive Tournament', backward: 'Revert to Live' },
  archived: { forward: 'Un-Archive', backward: '' },
};

interface PhaseTransitionArrowsProps {
  tournament: any;
  accessToken: string;
  onSuccess: () => void;
  showLeftArrow?: boolean;  // Show only left arrow
  showRightArrow?: boolean; // Show only right arrow
}

// ═══════════════════════════════════════════════════════
// CONFIRMATION MODAL
// ═══════════════════════════════════════════════════════

interface ConfirmationModalProps {
  tournament: any;
  direction: 'forward' | 'backward';
  targetPhase: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function PhaseTransitionModal({ tournament, direction, targetPhase, onConfirm, onCancel, loading }: ConfirmationModalProps) {
  const currentPhase = tournament.status;
  const isForward = direction === 'forward';
  const action = isForward ? PHASE_ACTIONS[currentPhase]?.forward : PHASE_ACTIONS[currentPhase]?.backward;

  // Detailed effects based on phase transition
  const effects: { icon: any; text: string; type?: 'warning' | 'success' }[] = [];

  if (isForward) {
    if (targetPhase === 'registration_open') {
      effects.push({ icon: Users, text: 'Registration form will be available to players', type: 'success' });
      effects.push({ icon: AlertTriangle, text: 'Make sure registration dates are set', type: 'warning' });
    } else if (targetPhase === 'registration_closed') {
      effects.push({ icon: Lock, text: 'New player registrations will be blocked' });
      effects.push({ icon: Users, text: 'Existing players can still create/join teams' });
    } else if (targetPhase === 'roster_lock') {
      effects.push({ icon: Lock, text: 'All team rosters will be locked (no more edits)' });
      effects.push({ icon: Trophy, text: 'Bracket will be auto-generated with current teams' });
      effects.push({ icon: Users, text: 'Teams will be seeded by average rank' });
      if ((tournament.team_count || 0) < 6) {
        effects.push({ icon: AlertTriangle, text: `Only ${tournament.team_count || 0} teams — need at least 6 for bracket`, type: 'warning' });
      }
    } else if (targetPhase === 'live') {
      effects.push({ icon: Trophy, text: 'Tournament officially starts' });
      effects.push({ icon: CheckCircle, text: 'Match results will auto-update from Steam API' });
      effects.push({ icon: AlertTriangle, text: 'Make sure bracket is generated', type: 'warning' });
    } else if (targetPhase === 'completed') {
      effects.push({ icon: CheckCircle, text: 'Tournament marked as finished' });
      effects.push({ icon: Trophy, text: 'Results will be archived' });
    } else if (targetPhase === 'archived') {
      effects.push({ icon: Lock, text: 'Tournament will be archived (read-only)' });
    }
  } else {
    // Backward transitions
    if (targetPhase === 'registration_closed') {
      effects.push({ icon: AlertTriangle, text: 'Bracket will be deleted', type: 'warning' });
      effects.push({ icon: Users, text: 'Teams can edit rosters again' });
    } else if (targetPhase === 'registration_open') {
      effects.push({ icon: Users, text: 'New players can register again' });
      effects.push({ icon: AlertTriangle, text: 'Existing teams will remain', type: 'warning' });
    } else if (targetPhase === 'roster_lock') {
      effects.push({ icon: AlertTriangle, text: 'Match progress will be preserved', type: 'warning' });
      effects.push({ icon: Lock, text: 'Tournament goes back to preparation mode' });
    } else if (targetPhase === 'live') {
      effects.push({ icon: AlertTriangle, text: 'Tournament status reverted to live', type: 'warning' });
    }
  }

  return (
    <div className="fixed inset-0 bg-soil/80 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border-2 border-border max-w-lg w-full p-6 sm:p-8">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            {action}
          </h2>
          <p className="text-muted-foreground">
            Moving <span className="font-bold text-foreground">{tournament.name}</span> from{' '}
            <span className="font-bold text-harvest">{PHASE_LABELS[currentPhase]}</span> →{' '}
            <span className="font-bold text-harvest">{PHASE_LABELS[targetPhase]}</span>
          </p>
        </div>

        {/* Effects List */}
        {effects.length > 0 && (
          <div className="space-y-3 mb-6">
            {effects.map((effect, i) => {
              const Icon = effect.icon;
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${
                  effect.type === 'warning' ? 'bg-harvest/10 border border-harvest/20' :
                  effect.type === 'success' ? 'bg-husk/10 border border-husk/20' :
                  'bg-muted'
                }`}>
                  <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    effect.type === 'warning' ? 'text-harvest' :
                    effect.type === 'success' ? 'text-husk' :
                    'text-muted-foreground'
                  }`} />
                  <p className={`text-sm ${
                    effect.type === 'warning' ? 'text-foreground font-semibold' :
                    effect.type === 'success' ? 'text-foreground' :
                    'text-muted-foreground'
                  }`}>
                    {effect.text}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Tournament Stats */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{tournament.team_count || 0}</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Teams Approved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{tournament.registration_count || 0}</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Players</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-muted text-foreground font-bold rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-3 font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
              isForward 
                ? 'bg-harvest text-soil hover:bg-harvest/90' 
                : 'bg-error text-white hover:bg-error/90'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {isForward ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                {isForward ? 'Advance' : 'Revert'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ERROR MODAL
// ═══════════════════════════════════════════════════════

interface ErrorModalProps {
  error: string;
  details?: string[];
  onClose: () => void;
}

function ErrorModal({ error, details, onClose }: ErrorModalProps) {
  return (
    <div className="fixed inset-0 bg-soil/80 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border-2 border-error/20 max-w-lg w-full p-6 sm:p-8">
        <div className="flex items-start gap-4 mb-6">
          <AlertTriangle className="w-8 h-8 text-error flex-shrink-0" />
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">Phase Transition Failed</h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>

        {details && details.length > 0 && (
          <div className="bg-error/10 border border-error/20 rounded-lg p-4 mb-6">
            <p className="text-sm font-bold text-foreground mb-2">Issues:</p>
            <ul className="space-y-1">
              {details.map((detail, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-error">•</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full px-4 py-3 bg-muted text-foreground font-bold rounded-lg hover:bg-muted/80 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SUCCESS MODAL
// ═══════════════════════════════════════════════════════

interface SuccessModalProps {
  message: string;
  newPhase: string;
  onClose: () => void;
}

function SuccessModal({ message, newPhase, onClose }: SuccessModalProps) {
  return (
    <div className="fixed inset-0 bg-soil/80 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border-2 border-husk/20 max-w-lg w-full p-6 sm:p-8">
        <div className="flex items-start gap-4 mb-6">
          <CheckCircle className="w-8 h-8 text-husk flex-shrink-0" />
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">Phase Updated!</h2>
            <p className="text-muted-foreground">{message}</p>
          </div>
        </div>

        <div className="bg-husk/10 border border-husk/20 rounded-lg p-4 mb-6 text-center">
          <p className="text-sm text-muted-foreground mb-1">Tournament is now in</p>
          <p className="text-lg font-bold text-foreground">{PHASE_LABELS[newPhase]}</p>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-3 bg-harvest text-soil font-bold rounded-lg hover:bg-harvest/90 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function PhaseTransitionArrows({ tournament, accessToken, onSuccess, showLeftArrow, showRightArrow }: PhaseTransitionArrowsProps) {
  const [showModal, setShowModal] = useState<'confirm' | 'error' | 'success' | null>(null);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [targetPhase, setTargetPhase] = useState<string>('');

  const currentPhase = tournament.status;
  const transitions = PHASE_TRANSITIONS[currentPhase];

  const handleArrowClick = (dir: 'forward' | 'backward') => {
    const target = dir === 'forward' ? transitions?.next : transitions?.prev;
    if (!target) return;

    setDirection(dir);
    setTargetPhase(target);
    setShowModal('confirm');
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournament.id}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ status: targetPhase }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError({
          message: data.error || 'Failed to update tournament phase',
          details: data.warnings || [],
        });
        setShowModal('error');
        return;
      }

      // Success!
      setSuccessMessage(data.message || `Tournament moved to ${PHASE_LABELS[targetPhase]}`);
      setShowModal('success');
      
      // Trigger refresh
      setTimeout(() => {
        onSuccess();
        setShowModal(null);
      }, 2000);

    } catch (err: any) {
      console.error('Phase transition error:', err);
      setError({
        message: 'Network error: Failed to update tournament phase',
        details: [err.message],
      });
      setShowModal('error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowModal(null);
    setError(null);
    setTargetPhase('');
  };

  return (
    <>
      {/* Arrow Buttons */}
      <div className="flex items-center gap-2">
        {/* Backward Arrow */}
        {transitions?.prev && (showLeftArrow || !showRightArrow) && (
          <button
            onClick={() => handleArrowClick('backward')}
            className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors group"
            title={`Revert to ${PHASE_LABELS[transitions.prev]}`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Forward Arrow */}
        {transitions?.next && (showRightArrow || !showLeftArrow) && (
          <button
            onClick={() => handleArrowClick('forward')}
            className="p-2 rounded-lg bg-harvest hover:bg-harvest/90 text-soil transition-colors group"
            title={`Advance to ${PHASE_LABELS[transitions.next]}`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Modals */}
      {showModal === 'confirm' && (
        <PhaseTransitionModal
          tournament={tournament}
          direction={direction}
          targetPhase={targetPhase}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          loading={loading}
        />
      )}

      {showModal === 'error' && error && (
        <ErrorModal
          error={error.message}
          details={error.details}
          onClose={handleCancel}
        />
      )}

      {showModal === 'success' && (
        <SuccessModal
          message={successMessage}
          newPhase={targetPhase}
          onClose={() => {
            onSuccess();
            setShowModal(null);
          }}
        />
      )}
    </>
  );
}
