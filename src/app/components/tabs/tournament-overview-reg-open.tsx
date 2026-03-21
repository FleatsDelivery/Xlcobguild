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

import { useState } from 'react';
import {
  Users, Trophy, Clock, Zap, CheckCircle2, UserPlus,
  Shield, AlertCircle, Star, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { TeamLogo } from '../team-logo';
import { useTournament } from '@/app/contexts/tournament-context';
import { RankModal } from '../tournament-hub-rank-modal';
import { Footer } from '../footer';
import { RANK_MEDALS } from '@/lib/rank-utils';
import { projectId } from '/utils/supabase/info';

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

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDeadlineChip(days: number | null): { label: string; urgent: boolean } {
  if (days === null) return { label: '—', urgent: false };
  if (days === 0) return { label: 'Closes Today!', urgent: true };
  if (days === 1) return { label: '1 day left', urgent: true };
  if (days <= 3) return { label: `${days} days left`, urgent: true };
  return { label: `${days} days left`, urgent: false };
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export function RegOpenOverview({ data }: RegOpenOverviewProps) {
  const { tournament: tournamentCtx, myRegistration, user, accessToken, refetch } = useTournament();
  const { tournament, top_teams } = data;

  // ── Registration state ────────────────────────────────────
  const [registering, setRegistering] = useState(false);
  const [showRankModal, setShowRankModal] = useState(false);
  const [rankError, setRankError] = useState<string | null>(null);

  const isLoggedIn = !!user;
  const isRegistered = !!myRegistration && myRegistration.status !== 'withdrawn';
  const isOnTeam = myRegistration?.status === 'on_team';
  const isFreeAgent = isRegistered && !isOnTeam;
  const myTeam = isOnTeam ? (myRegistration as any)?.team : null;

  // ── Stats ─────────────────────────────────────────────────
  const totalRegistrants = tournament.total_registrants ?? tournament.total_players;
  const approvedTeams = top_teams.filter(
    t => !t.approval_status || t.approval_status === 'approved',
  );
  const pendingTeams = top_teams.filter(
    t => t.approval_status === 'pending_approval' || t.approval_status === 'pending',
  );
  const maxTeams = tournament.max_teams ?? 0;
  const freeAgentCount = Math.max(0, totalRegistrants - tournament.total_players);
  const daysLeft = daysUntil(tournament.registration_end_date);
  const deadline = formatDeadlineChip(daysLeft);

  // ── Tournament start countdown ────────────────────────────
  const startDate = tournament.tournament_start_date ?? tournament.start_date;
  const daysToStart = daysUntil(startDate);

  // ── Register action ───────────────────────────────────────
  async function handleRegister(selfReportedMedal?: string) {
    if (!isLoggedIn) {
      toast.error('You need to be logged in to register.');
      return;
    }
    setRegistering(true);
    setRankError(null);
    try {
      const body: Record<string, string> = { role: 'player' };
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
          setShowRankModal(true);
          return;
        }
        if (result.rank_ineligible) {
          setRankError(result.error || 'Your rank is not eligible for this tournament.');
          toast.error('Rank not eligible');
          return;
        }
        throw new Error(result.error || 'Registration failed');
      }

      toast.success(result.message || "You're registered! 🌽");
      await refetch();
    } catch (err: any) {
      console.error('Registration error:', err);
      toast.error(err.message || 'Registration failed. Try again.');
    } finally {
      setRegistering(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 sm:space-y-8">

      {/* ── Rank Modal (unknown rank flow) ── */}
      {showRankModal && (
        <RankModal
          currentRank={null}
          onClose={() => setShowRankModal(false)}
          onSelect={(rankId) => {
            setShowRankModal(false);
            const medal = RANK_MEDALS[rankId] || null;
            if (medal) handleRegister(medal);
          }}
        />
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/* HERO BANNER                                          */}
      {/* ════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#10b981]/20 via-[#10b981]/10 to-transparent border-2 border-[#10b981]/40 rounded-2xl p-6 sm:p-8">
        {/* Subtle glow orb */}
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-[#10b981]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Icon block */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#10b981]/15 border-2 border-[#10b981]/40 flex items-center justify-center flex-shrink-0">
            <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-[#10b981]" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#10b981]/20 border border-[#10b981]/40 text-[11px] font-black uppercase tracking-widest text-[#10b981]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
                Registration Open
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground leading-tight mb-2">
              Spots are filling up — sign up now!
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {tournament.description
                ? tournament.description.split('.')[0] + '.'
                : `Register for ${tournament.name} and compete with the best in The Corn Field.`}
            </p>

            {/* CTA row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-4">
              {!isLoggedIn ? (
                <span className="text-sm text-muted-foreground italic">Log in to register</span>
              ) : isRegistered ? (
                <RegistrationStatusBadge
                  isOnTeam={isOnTeam}
                  isFreeAgent={isFreeAgent}
                  myTeam={myTeam}
                  tournamentName={tournament.name}
                />
              ) : (
                <button
                  onClick={() => handleRegister()}
                  disabled={registering}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white font-bold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-[#10b981]/25"
                >
                  <UserPlus className="w-4 h-4" />
                  {registering ? 'Registering…' : 'Register Now'}
                </button>
              )}

              {rankError && (
                <div className="flex items-center gap-1.5 text-xs text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg px-3 py-2 max-w-sm">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{rankError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Countdown chip */}
          {daysLeft !== null && (
            <div className={`flex-shrink-0 text-center border-2 rounded-2xl px-5 py-4 self-start sm:self-auto ${
              deadline.urgent
                ? 'bg-[#ef4444]/10 border-[#ef4444]/40'
                : 'bg-soil/70 border-[#10b981]/30'
            }`}>
              <div className={`text-3xl sm:text-4xl font-black leading-none ${
                deadline.urgent ? 'text-[#ef4444]' : 'text-[#10b981]'
              }`}>
                {daysLeft === 0 ? '!' : daysLeft}
              </div>
              <div className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${
                deadline.urgent ? 'text-[#ef4444]/80' : 'text-muted-foreground'
              }`}>
                {daysLeft === 0 ? 'Closes Today' : daysLeft === 1 ? 'Day Left' : 'Days Left'}
              </div>
              <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wide mt-0.5">
                To Register
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════ */}
      {/* STATS STRIP                                          */}
      {/* ════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Registrants */}
        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-[#3b82f6]" />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Registered</p>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-foreground">{totalRegistrants}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
            {freeAgentCount > 0 ? `${freeAgentCount} Free Agents` : 'Players'}
          </p>
        </div>

        {/* Teams */}
        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-harvest" />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Teams</p>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-foreground">
            {approvedTeams.length}
            {maxTeams > 0 && (
              <span className="text-base text-muted-foreground font-semibold">/{maxTeams}</span>
            )}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
            {pendingTeams.length > 0 ? `+${pendingTeams.length} Pending` : 'Forming'}
          </p>
        </div>

        {/* Days Left */}
        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className={`w-4 h-4 ${deadline.urgent ? 'text-[#ef4444]' : 'text-[#f59e0b]'}`} />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Reg Closes</p>
          </div>
          {daysLeft !== null ? (
            <>
              <p className={`text-2xl sm:text-3xl font-black ${deadline.urgent ? 'text-[#ef4444]' : 'text-foreground'}`}>
                {daysLeft === 0 ? 'Today' : daysLeft}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
                {daysLeft === 0 ? 'Last chance!' : daysLeft === 1 ? 'Day Remaining' : 'Days Remaining'}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl sm:text-3xl font-black text-foreground">—</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">No Deadline Set</p>
            </>
          )}
        </div>

        {/* Tournament Date / Start */}
        <div className="bg-card border-2 border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-[#8b5cf6]" />
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground">Tournament</p>
          </div>
          {daysToStart !== null ? (
            <>
              <p className="text-2xl sm:text-3xl font-black text-foreground">
                {daysToStart === 0 ? 'Today' : daysToStart}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
                {daysToStart === 0 ? 'Starts Today!' : `Day${daysToStart === 1 ? '' : 's'} Away`}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl sm:text-3xl font-black text-foreground">TBD</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Date Pending</p>
            </>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════ */}
      {/* YOUR STATUS                                          */}
      {/* ════════════════════════════════════════════════════ */}
      {isLoggedIn && (
        <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-harvest" />
            <h3 className="text-lg sm:text-xl font-bold text-foreground">Your Status</h3>
          </div>

          {isOnTeam && myTeam ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <TeamLogo
                teamTag={myTeam.team_tag}
                tournamentName={tournament.name}
                size="lg"
                className="w-14 h-14 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                  <span className="text-sm font-bold text-[#10b981]">You're on a team</span>
                </div>
                <p className="text-base font-black text-foreground truncate">{myTeam.team_name}</p>
                <p className="text-xs text-muted-foreground font-semibold">[{myTeam.team_tag}]</p>
              </div>
              <div className="px-3 py-2 rounded-xl bg-[#10b981]/10 border border-[#10b981]/30">
                <p className="text-xs font-bold text-[#10b981] uppercase tracking-wide">Ready</p>
              </div>
            </div>
          ) : isFreeAgent ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#3b82f6]/15 border-2 border-[#3b82f6]/30 flex items-center justify-center flex-shrink-0">
                <Users className="w-7 h-7 text-[#3b82f6]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-[#3b82f6]" />
                  <span className="text-sm font-bold text-[#3b82f6]">You're registered as a free agent</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  You're in the pool! Captains can invite you, or you can request to join a team from the{' '}
                  <span className="font-semibold text-foreground">Teams tab</span>.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-muted border-2 border-border flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-7 h-7 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-foreground mb-1">You haven't registered yet</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Register as a player to compete. You'll enter as a free agent and can join or form a team.
                </p>
              </div>
              <button
                onClick={() => handleRegister()}
                disabled={registering}
                className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white font-bold text-sm transition-all disabled:opacity-60 shadow-md shadow-[#10b981]/20"
              >
                <UserPlus className="w-4 h-4" />
                {registering ? 'Registering…' : 'Register'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/* TEAMS FORMING                                        */}
      {/* ════════════════════════════════════════════════════ */}
      {top_teams.length > 0 && (
        <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-5">
            <Trophy className="w-5 h-5 text-harvest" />
            <h3 className="text-lg sm:text-xl font-bold text-foreground">
              Teams Forming
            </h3>
            {approvedTeams.length > 0 && (
              <span className="ml-auto text-xs font-bold bg-harvest/10 text-harvest px-2.5 py-0.5 rounded-full flex-shrink-0">
                {approvedTeams.length} Approved
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...approvedTeams, ...pendingTeams].map((team) => {
              const isPending = team.approval_status === 'pending_approval' || team.approval_status === 'pending';
              const rosterCount = team.roster_count ?? 0;
              const MAX_ROSTER = 5;
              const isFull = rosterCount >= MAX_ROSTER;

              return (
                <div
                  key={team.id}
                  className={`bg-muted rounded-xl border-2 p-3 sm:p-4 flex items-center gap-3 transition-all ${
                    isPending
                      ? 'border-[#f59e0b]/30'
                      : isFull
                      ? 'border-[#10b981]/30'
                      : 'border-border'
                  }`}
                >
                  <TeamLogo
                    teamTag={team.team_tag}
                    tournamentName={tournament.name}
                    size="md"
                    className="w-10 h-10 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{team.team_name}</p>
                    <p className="text-[11px] text-muted-foreground font-semibold">[{team.team_tag}]</p>
                  </div>

                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                    {/* Status pill */}
                    {isPending ? (
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#f59e0b] bg-[#f59e0b]/10 px-1.5 py-0.5 rounded-full">
                        Pending
                      </span>
                    ) : isFull ? (
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#10b981] bg-[#10b981]/10 px-1.5 py-0.5 rounded-full">
                        Full
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#3b82f6] bg-[#3b82f6]/10 px-1.5 py-0.5 rounded-full">
                        Recruiting
                      </span>
                    )}
                    {/* Roster pips */}
                    {rosterCount > 0 && (
                      <div className="flex items-center gap-[3px]">
                        {Array.from({ length: MAX_ROSTER }).map((_, i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-sm ${
                              i < rosterCount
                                ? isFull
                                  ? 'bg-[#10b981]'
                                  : 'bg-[#3b82f6]'
                                : 'bg-border/60'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* No teams yet nudge */}
          {approvedTeams.length === 0 && pendingTeams.length > 0 && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              Teams are awaiting officer approval.
            </p>
          )}
        </div>
      )}

      {/* No teams yet CTA */}
      {top_teams.length === 0 && (
        <div className="bg-card border-2 border-dashed border-border rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">🌽</div>
          <h3 className="text-lg font-black text-foreground mb-2">No Teams Yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Be the first to create a team! Register, then head to the{' '}
            <span className="font-semibold text-foreground">Teams tab</span> to get started.
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════ */}
      {/* ABOUT                                               */}
      {/* ════════════════════════════════════════════════════ */}
      {tournament.description && (
        <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-foreground mb-3">About This Tournament</h3>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {tournament.description}
          </p>
        </div>
      )}

      <Footer />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REGISTRATION STATUS BADGE (inline in hero)
// ─────────────────────────────────────────────────────────────

function RegistrationStatusBadge({
  isOnTeam,
  isFreeAgent,
  myTeam,
  tournamentName,
}: {
  isOnTeam: boolean;
  isFreeAgent: boolean;
  myTeam: any;
  tournamentName: string;
}) {
  if (isOnTeam && myTeam) {
    return (
      <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#10b981]/15 border border-[#10b981]/40">
        <TeamLogo
          teamTag={myTeam.team_tag}
          tournamentName={tournamentName}
          size="sm"
          className="w-6 h-6"
        />
        <div>
          <p className="text-xs text-[#10b981] font-bold leading-none mb-0.5">On Team</p>
          <p className="text-sm font-black text-foreground leading-none">{myTeam.team_name}</p>
        </div>
        <CheckCircle2 className="w-4 h-4 text-[#10b981] ml-1" />
      </div>
    );
  }

  if (isFreeAgent) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3b82f6]/15 border border-[#3b82f6]/40">
        <CheckCircle2 className="w-4 h-4 text-[#3b82f6]" />
        <div>
          <p className="text-xs text-[#3b82f6] font-bold leading-none mb-0.5">Registered</p>
          <p className="text-sm font-black text-foreground leading-none">Free Agent</p>
        </div>
      </div>
    );
  }

  return null;
}
