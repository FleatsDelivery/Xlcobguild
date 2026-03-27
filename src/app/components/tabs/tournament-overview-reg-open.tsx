/**
 * Tournament Overview Tab — Registration Open Phase (B2)
 *
 * Story: "The gates are open. Who's signing up? Who's forming teams?"
 *
 * Sections:
 *  1. Hero banner — green energy, countdown, register/status CTA
 *  2. Stats strip — registrants, teams forming, days left, max teams
 *  3. Your Status — personal registration card
 *  4. Teams Forming — grid of forming teams with roster progress
 *  5. About — tournament description
 */

import { useState, useEffect, useRef } from 'react';
import {
  Users, Trophy, Clock, Zap, CheckCircle2, UserPlus,
  Shield, AlertCircle, Star, Calendar, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { TeamLogo } from '../team-logo';
import { useTournament } from '@/app/contexts/tournament-context';
import { RankModal } from '../tournament-hub-rank-modal';
import { ChooseYourPath } from '../choose-your-path';
import { StaffApplicationModal } from '../modals/staff-application-modal';
import { ConfirmModal } from '../confirm-modal';
import { Button } from '../ui/button';
import { Footer } from '../footer';
import { RANK_MEDALS } from '@/lib/rank-utils';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface OverviewTournament {
  id: string;
  name: string;
  description: string | null;
  status: string;
  total_teams: number;
  total_players: number;
  total_registrants?: number;
  max_teams?: number;
  registration_end_date?: string | null;
  tournament_start_date?: string | null;
  tournament_type?: string | null;
  prize_pool?: string | number | null;
  prize_pool_donations?: number | null;
  // legacy compat
  start_date?: string | null;
  end_date?: string | null;
}

interface OverviewTeam {
  id: string;
  team_name: string;
  team_tag: string;
  logo_url?: string | null;
  approval_status?: string | null;
  roster_count?: number;
  ticket_coverage?: { wallet: number; tcf_plus: number; total: number } | null;
}

interface RegOpenOverviewProps {
  data: {
    tournament: OverviewTournament;
    top_teams: OverviewTeam[];
  };
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * useCountdown — Fixed to prevent Max Update Depth exceeded
 * Uses a ref for onComplete to avoid dependency loop with anonymous functions
 */
function useCountdown(targetDate: string | null | undefined, onComplete?: () => void) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
  } | null>(null);

  // Keep track if we've already triggered completion for this target
  const hasCompleted = useRef(false);
  
  // Use a ref for onComplete so we don't need it in the dependency array
  // This prevents infinite loops if the user passes an anonymous function
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft(null);
      return;
    }

    const calculate = () => {
      const targetTime = new Date(targetDate).getTime();
      const diff = targetTime - Date.now();
      
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 });
        if (!hasCompleted.current) {
          hasCompleted.current = true;
          onCompleteRef.current?.();
        }
        return;
      }
      
      hasCompleted.current = false;
      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / (3600 * 24));
      const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setTimeLeft({ days, hours, minutes, seconds, totalSeconds });
    };

    calculate();
    
    // Check more frequently if we are close to the target
    const getInterval = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      // If less than 1 hour away, use 1s interval for seconds display
      // If more, 60s is fine to save resources
      return diff < 3600000 ? 1000 : 60000;
    };

    const interval = getInterval();
    const timer = setInterval(calculate, interval);
    
    return () => clearInterval(timer);
  }, [targetDate]); // Removed onComplete to fix infinite loop

  return timeLeft;
}

function formatCountdown(time: { days: number; hours: number; minutes: number; seconds: number; totalSeconds: number } | null) {
  if (!time || time.totalSeconds <= 0) return { primary: '0', secondary: 'Ended' };
  
  if (time.days > 0) {
    return { primary: `${time.days}d`, secondary: `${time.hours}h` };
  }
  if (time.hours > 0) {
    return { primary: `${time.hours}h`, secondary: `${time.minutes}m` };
  }
  if (time.minutes > 0) {
    return { primary: `${time.minutes}m`, secondary: `${time.seconds}s` };
  }
  return { primary: `${time.seconds}s`, secondary: 'Remaining' };
}

function formatDeadlineChip(time: { days: number; hours: number; minutes: number; seconds: number; totalSeconds: number } | null): { label: string; urgent: boolean } {
  if (!time) return { label: '—', urgent: false };
  if (time.totalSeconds <= 0) return { label: 'Closed', urgent: true };
  
  const urgent = time.days < 1; 
  
  if (time.days > 0) {
    return { label: `${time.days}d ${time.hours}h left`, urgent };
  }
  if (time.hours > 0) {
    return { label: `${time.hours}h ${time.minutes}m left`, urgent };
  }
  if (time.minutes > 0) {
    return { label: `${time.minutes}m ${time.seconds}s left`, urgent };
  }
  return { label: `${time.seconds}s left`, urgent };
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export function RegOpenOverview({ data }: RegOpenOverviewProps) {
  const { tournament: tournamentCtx, staff, myRegistration, user, accessToken, refetch, isOwner } = useTournament();
  const { tournament, top_teams } = data;

  // ── Registration state ────────────────────────────────────
  const [registering, setRegistering] = useState(false);
  const [showRankModal, setShowRankModal] = useState(false);
  const [rankError, setRankError] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<string>('player');
  const [withdrawing, setWithdrawing] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [pendingRegRole, setPendingRegRole] = useState<string | null>(null);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [myStaffApp, setMyStaffApp] = useState<any>(null);

  const isLoggedIn = !!user;
  const isRegistered = !!myRegistration && myRegistration.status !== 'withdrawn';
  const isOnTeam = myRegistration?.status === 'on_team';
  const myTeam = isOnTeam ? myRegistration?.team : null;
  const myRole = myRegistration?.role || 'player';
  const isFreeAgent = isRegistered && !isOnTeam;

  // ── Fetch staff app state ─────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn || !accessToken) return;
    fetch(`https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournament.id}/staff`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.my_application) setMyStaffApp(data.my_application);
      })
      .catch(() => {});
  }, [isLoggedIn, accessToken, tournament.id]);

  // ── Stats ─────────────────────────────────────────────────
  const isUserApprovedStaff = myStaffApp?.status === 'approved' || myRegistration?.role === 'staff';
  const isUserInStaffList = staff?.some(s => s.person_id === user?.id);
  
  const baseCount = (
    tournament.total_registrants ?? 
    tournament.total_players ?? 
    (tournament as any).player_count ?? 
    (tournament as any).staff_count ?? 
    (tournament as any).registration_count ?? 
    0
  );
  
  const staffCount = staff?.length || 0;
  const extraStaffCount = (isUserApprovedStaff && !isUserInStaffList) ? 1 : 0;
  
  const totalParticipantsCount = baseCount + staffCount + extraStaffCount;
  const approvedTeams = top_teams.filter(
    t => !t.approval_status || t.approval_status === 'approved',
  );
  const pendingTeams = top_teams.filter(
    t => t.approval_status === 'pending_approval' || t.approval_status === 'pending',
  );
  const maxTeams = tournament.max_teams ?? 0;

  // ── Countdowns ────────────────────────────────────────────
  const regDeadlineTime = useCountdown(tournament.registration_end_date, async () => {
    if (tournament.status === 'registration_open' || tournament.status === 'registration') {
      // Auto-close registration for owner
      if (isOwner) {
        try {
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournament.id}/status`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ status: 'registration_closed' }),
            }
          );
          if (res.ok) {
            toast.success('Registration deadline reached. Scaling to closed phase.');
            await refetch();
            return;
          }
        } catch (err) {
          console.error('Auto-close error:', err);
        }
      }

      // Fallback for non-owners or if update failed: just refresh to see if someone else closed it
      setTimeout(refetch, 2500);
    }
  });

  const startDate = tournament.tournament_start_date ?? tournament.start_date;
  const tourneyStartTime = useCountdown(startDate, () => {
    if (tournament.status !== 'live' && tournament.status !== 'completed') {
      setTimeout(refetch, 2000);
    }
  });
  
  const deadline = formatDeadlineChip(regDeadlineTime);
  const regDisplay = formatCountdown(regDeadlineTime);
  const startDisplay = formatCountdown(tourneyStartTime);

  // ── Actions ───────────────────────────────────────────────
  async function handleWithdraw() {
    if (!isLoggedIn) return;
    setWithdrawing(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournament.id}/register`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Withdrawal failed');

      toast.success(result.message || 'Successfully withdrawn.');
      await refetch();
    } catch (err: any) {
      console.error('Withdrawal error:', err);
      toast.error(err.message || 'Withdrawal failed. Try again.');
    } finally {
      setWithdrawing(false);
    }
  }

  async function handleRegister(role: string = 'player', selfReportedMedal?: string) {
    if (!isLoggedIn) {
      toast.error('You need to be logged in to register.');
      return;
    }
    setRegistering(true);
    setRankError(null);
    try {
      const body: Record<string, string> = { role };
      if (selfReportedMedal) body.self_reported_rank = selfReportedMedal;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournament.id}/register`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );
      const result = await res.json();

      if (!res.ok) {
        if (result.rank_unknown) {
          setPendingRole(role);
          setShowRankModal(true);
          return false;
        }
        if (result.rank_ineligible) {
          setRankError(result.error || 'Your rank is not eligible for this tournament.');
          toast.error('Rank not eligible');
          return false;
        }
        throw new Error(result.error || 'Registration failed');
      }

      toast.success(result.message || "You're registered! 🌽");
      await refetch();
      return true;
    } catch (err: any) {
      console.error('Registration error:', err);
      toast.error(err.message || 'Registration failed. Try again.');
      return false;
    } finally {
      setRegistering(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  const isStaff = myRole === 'staff' || myStaffApp?.status === 'approved';
  const isCoach = myRole === 'coach';

  const roleTheme = {
    coach: { bg: 'bg-[#10b981]/15', border: 'border-[#10b981]/30', text: 'text-[#10b981]' },
    staff: { bg: 'bg-[#f59e0b]/15', border: 'border-[#f59e0b]/30', text: 'text-[#f59e0b]' },
    player: { bg: 'bg-[#3b82f6]/15', border: 'border-[#3b82f6]/30', text: 'text-[#3b82f6]' }
  };
  const activeTheme = isCoach ? roleTheme.coach : isStaff ? roleTheme.staff : roleTheme.player;

  return (
    <div className="space-y-6 sm:space-y-8">

      {/* ── Modals ── */}
      {showRankModal && (
        <RankModal
          currentRank={null}
          onClose={() => setShowRankModal(false)}
          onSelect={(rankId) => {
            setShowRankModal(false);
            const medal = RANK_MEDALS[rankId] || null;
            if (medal) handleRegister(pendingRole, medal);
          }}
        />
      )}

      {showRegConfirm && (
        <ConfirmModal
          title={`Register as ${pendingRegRole === 'coach' ? 'Coach' : 'Player'}?`}
          message={pendingRegRole === 'coach' 
            ? "You'll be able to create a team and recruit players. Coaches do not have rank restrictions."
            : "You'll be added to the Free Agent pool. Captains can invite you to their teams, or you can request to join one."}
          confirmText="Confirm Registration"
          confirmVariant="success"
          loading={registering}
          loadingText="Registering..."
          onCancel={() => { setShowRegConfirm(false); setPendingRegRole(null); }}
          onConfirm={async () => {
            if (pendingRegRole) {
              const success = await handleRegister(pendingRegRole);
              if (success) { setShowRegConfirm(false); setPendingRegRole(null); }
            }
          }}
        />
      )}

      {showWithdrawConfirm && (
        <ConfirmModal
          title="Withdraw Registration?"
          message="You will be removed from the tournament. You can re-register as long as registration remains open."
          confirmText="Yes, Withdraw"
          confirmVariant="danger"
          loading={withdrawing}
          loadingText="Withdrawing..."
          onCancel={() => setShowWithdrawConfirm(false)}
          onConfirm={async () => {
            if (myStaffApp && myStaffApp.status !== 'approved') {
              setWithdrawing(true);
              try {
                const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournament.id}/apply-staff`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (!res.ok) throw new Error('Failed to withdraw staff application');
                toast.success('Staff application withdrawn');
                setMyStaffApp(null);
                setShowWithdrawConfirm(false);
              } catch(err: any) { toast.error(err.message); }
              finally { setWithdrawing(false); }
            } else if (myStaffApp && myStaffApp.status === 'approved') {
              setWithdrawing(true);
              try {
                const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournament.id}/apply-staff`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (!res.ok) throw new Error('Failed to step down from staff');
                toast.success('Staff registration withdrawn');
                setMyStaffApp(null);
                await refetch();
                setShowWithdrawConfirm(false);
              } catch(err: any) { toast.error(err.message); }
              finally { setWithdrawing(false); }
            } else {
              setWithdrawing(true);
              try {
                const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournament.id}/register`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Withdrawal failed');
                toast.success(result.message || 'Withdrawn from tournament');
                await refetch();
                setShowWithdrawConfirm(false);
              } catch (err: any) { toast.error(err.message || 'Error occurred during withdrawal'); }
              finally { setWithdrawing(false); }
            }
          }}
        />
      )}

      <StaffApplicationModal 
        isOpen={showStaffModal} 
        onClose={() => {
          setShowStaffModal(false);
          if (isLoggedIn && accessToken) {
            fetch(`https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournament.id}/staff`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            })
              .then(res => res.json())
              .then(data => { if (data.my_application) setMyStaffApp(data.my_application); })
              .catch(() => {});
          }
        }} 
        tournamentId={tournament.id} 
        tournamentName={tournament.name} 
      />

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#10b981]/15 via-[#10b981]/5 to-transparent border-2 border-[#10b981]/30 rounded-2xl p-4 sm:p-6 pb-5">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-[#10b981]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#10b981]/15 border-2 border-[#10b981]/40 flex items-center justify-center flex-shrink-0">
            <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-[#10b981]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#10b981]/20 border border-[#10b981]/40 text-[10px] font-bold uppercase tracking-widest text-[#10b981]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                Registration Open
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight mb-1">
              {tournament.name} registration is live!
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {tournament.description
                ? tournament.description.split('.')[0] + '.'
                : `Register for ${tournament.name} and compete with the best in The Corn Field.`}
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-4">
              {!isLoggedIn ? (
                <span className="text-sm text-muted-foreground italic">Log in to register</span>
              ) : isRegistered ? (
                <RegistrationStatusBadge
                  isOnTeam={isOnTeam}
                  isFreeAgent={isFreeAgent}
                  myTeam={myTeam}
                  tournamentName={tournament.name}
                  myRole={myRole}
                />
              ) : <div />}

              {rankError && (
                <div className="flex items-center gap-1.5 text-xs text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg px-3 py-2 max-w-sm">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{rankError}</span>
                </div>
              )}
            </div>
          </div>

          {regDeadlineTime !== null && (
            <div className={`flex-shrink-0 text-center border-2 rounded-2xl px-5 py-4 self-start sm:self-auto ${deadline.urgent
              ? 'bg-[#ef4444]/10 border-[#ef4444]/40'
              : 'bg-soil/70 border-[#10b981]/30'
              }`}>
              <div className={`text-2xl sm:text-3xl font-bold leading-none ${deadline.urgent ? 'text-[#ef4444]' : 'text-[#10b981]'}`}>
                {regDisplay.primary}
              </div>
              <div className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${deadline.urgent ? 'text-[#ef4444]/80' : 'text-muted-foreground'}`}>
                {regDisplay.secondary}
              </div>
              <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wide mt-0.5 whitespace-nowrap">
                To Register
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-[#3b82f6]" />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Participants</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">{totalParticipantsCount}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Total Registrants</p>
        </div>

        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-harvest" />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Prize Pool</p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-harvest drop-shadow-sm">
            ${((Number(tournamentCtx?.prize_pool) || 0) + (Number(tournamentCtx?.prize_pool_donations) || 0)).toLocaleString()}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
            {Number(tournamentCtx?.prize_pool_donations) > 0 ? `+ $${Number(tournamentCtx?.prize_pool_donations).toLocaleString()} Donations` : 'Base Pool'}
          </p>
        </div>

        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className={`w-4 h-4 ${deadline.urgent ? 'text-[#ef4444]' : 'text-[#f59e0b]'}`} />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Reg Closes</p>
          </div>
          {regDeadlineTime != null ? (
            <>
              <div className="flex items-baseline gap-1">
                <p className={`text-2xl sm:text-3xl font-bold ${deadline.urgent ? 'text-[#ef4444]' : 'text-foreground'}`}>
                  {regDisplay.primary}
                </p>
                <p className="text-sm font-bold text-muted-foreground/60">{regDisplay.secondary}</p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Remaining</p>
            </>
          ) : (
            <>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">—</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">No Deadline Set</p>
            </>
          )}
        </div>

        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-[#8b5cf6]" />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Tournament</p>
          </div>
          {tourneyStartTime != null ? (
            <>
              <div className="flex items-baseline gap-1">
                <p className="text-2xl sm:text-3xl font-bold text-foreground">{startDisplay.primary}</p>
                <p className="text-sm font-bold text-muted-foreground/60">{startDisplay.secondary}</p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Away</p>
            </>
          ) : (
            <>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">TBD</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Date Pending</p>
            </>
          )}
        </div>
      </div>

      {/* ── Your Status ── */}
      {isLoggedIn && (
        <div id="registration-choices" className="bg-card border-2 border-border rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-harvest" />
              <h3 className="text-lg sm:text-xl font-bold text-foreground">Your Status</h3>
            </div>
            {(isRegistered || myStaffApp) && !isOnTeam && (
              <button
                onClick={() => setShowWithdrawConfirm(true)}
                disabled={withdrawing}
                className="text-xs px-3 py-1.5 rounded-lg border-2 border-border bg-muted/50 hover:border-[#ef4444]/40 hover:bg-[#ef4444]/10 hover:text-[#ef4444] text-muted-foreground font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                {withdrawing ? 'Withdrawing...' : 'Withdraw'}
              </button>
            )}
          </div>

          {isOnTeam && myTeam ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <TeamLogo teamTag={myTeam.team_tag} tournamentName={tournament.name} size="lg" className="w-14 h-14 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                  <span className="text-sm font-bold text-[#10b981]">You are on a team</span>
                </div>
                <p className="text-base font-bold text-foreground truncate">{myTeam.team_name}</p>
                <p className="text-xs text-muted-foreground font-semibold">[{myTeam.team_tag}]</p>
              </div>
              <div className="px-3 py-2 rounded-xl bg-[#10b981]/10 border border-[#10b981]/30">
                <p className="text-xs font-bold text-[#10b981] uppercase tracking-wide">Ready</p>
              </div>
            </div>
          ) : isFreeAgent || (myStaffApp && myStaffApp.status === 'approved') ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl ${activeTheme.bg} border-2 ${activeTheme.border} flex items-center justify-center flex-shrink-0`}>
                <Users className={`w-7 h-7 ${activeTheme.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className={`w-4 h-4 ${activeTheme.text}`} />
                  <span className={`text-sm font-bold ${activeTheme.text}`}>You are registered as a {isCoach ? 'Coach' : isStaff ? 'Staff Member' : 'free agent'}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {isCoach
                    ? 'Create a team from the Teams tab to recruit players and start coaching!'
                    : isStaff
                      ? 'You are approved as staff for this tournament! Your responsibilities will be coordinated by the administration.'
                      : "You're in the pool! Captains can invite you, or you can request to join a team from the Teams tab."}
                </p>
              </div>
            </div>
          ) : myStaffApp && myStaffApp.status === 'pending' ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#f59e0b]/15 border-2 border-[#f59e0b]/30 flex items-center justify-center flex-shrink-0">
                <Clock className="w-7 h-7 text-[#f59e0b]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-[#f59e0b]">Staff Application Pending</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your application to be {myStaffApp.role_preference === 'tournament_director' ? 'a Tournament Director' : `a ${myStaffApp.role_preference}`} is under review by the officers.
                </p>
              </div>
            </div>
          ) : myStaffApp && myStaffApp.status === 'denied' ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#ef4444]/15 border-2 border-[#ef4444]/30 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-7 h-7 text-[#ef4444]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-[#ef4444]">Staff Application Denied</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Unfortunately your staff application was not accepted. You can still participate as a player!
                </p>
              </div>
            </div>
          ) : (
            <ChooseYourPath
              tournamentName={tournament.name}
              tournamentType={tournament.tournament_type || 'kernel_kup'}
              isRankIneligible={false}
              registering={registering}
              choosingRole={pendingRegRole}
              onRegisterWithRole={(r) => { setPendingRegRole(r); setShowRegConfirm(true); }}
              onOpenStaffModal={() => setShowStaffModal(true)}
            />
          )}
        </div>
      )}


      {/* ── About ── */}
      {tournament.description && (
        <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3">About This Tournament</h3>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">{tournament.description}</p>
        </div>
      )}

      <Footer />
    </div>
  );
}

function RegistrationStatusBadge({
  isOnTeam,
  isFreeAgent,
  myTeam,
  tournamentName,
  myRole,
}: {
  isOnTeam: boolean;
  isFreeAgent: boolean;
  myTeam: any;
  tournamentName: string;
  myRole?: string;
}) {
  if (isOnTeam && myTeam) {
    return (
      <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#10b981]/15 border border-[#10b981]/40">
        <TeamLogo teamTag={myTeam.team_tag} tournamentName={tournamentName} size="sm" className="w-6 h-6" />
        <div>
          <p className="text-xs text-[#10b981] font-bold leading-none mb-0.5">On Team</p>
          <p className="text-sm font-bold text-foreground leading-none">{myTeam.team_name}</p>
        </div>
        <CheckCircle2 className="w-4 h-4 text-[#10b981] ml-1" />
      </div>
    );
  }

  if (isFreeAgent) {
    const roleDisplay = myRole === 'coach' ? 'Coach' : myRole === 'staff' ? 'Staff' : 'Free Agent';
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3b82f6]/15 border border-[#3b82f6]/40">
        <CheckCircle2 className="w-4 h-4 text-[#3b82f6]" />
        <div>
          <p className="text-xs text-[#3b82f6] font-bold leading-none mb-0.5">Registered</p>
          <p className="text-sm font-bold text-foreground leading-none">{roleDisplay}</p>
        </div>
      </div>
    );
  }

  return null;
}
