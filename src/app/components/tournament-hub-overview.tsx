/**
 * Tournament Hub — Overview Tab
 *
 * Stripped-down overview: countdown, progress cards, Choose Your Path / Your Profile,
 * recent signups, and a compact all-registrants list.
 * Free agents, teams, and staff moved to their respective tabs.
 */

import { useMemo, useState, useRef, useEffect } from 'react';
import {
  Users, Trophy, Shield, UserMinus, Loader2,
  Star, Briefcase, Swords, GraduationCap, Headphones, Clock, Plus,
  History, Crown, Youtube,
} from '@/lib/icons';
import { Button } from '@/app/components/ui/button';
import {
  CountdownSection, WinnerBanner, AnimatedSection,
  UrgencyBar, RegistrationHeroCta,
} from './tournament-hub-sections';
import { TwitchIcon } from '@/lib/icons';
import { timeAgo } from '@/lib/date-utils';
import { extractTwitchChannel } from '@/lib/twitch-utils';
import { getRankDisplay, getMedalColor } from '@/lib/rank-utils';
import type { PhaseConfig, OverviewSection } from './tournament-state-config';
import { TcfPlusAvatarRing } from '@/app/components/tcf-plus-avatar-ring';
import { TcfPlusBadge } from '@/app/components/tcf-plus-badge';
import { RankBadge } from '@/app/components/rank-badge';
import { DonatePrizePoolModal } from '@/app/components/donate-prize-pool-modal';
import { TeamLogo } from '@/app/components/team-logo';
import { TournamentTopPlayers } from '@/app/components/tournament-top-players';
import { TournamentHeroStats } from '@/app/components/tournament-hero-stats';
import { TrophyImage } from '@/app/components/trophy-image';

// ═════════════════════════════════════════════════════
// PROGRESS CARD
// ════════════════════════════════════════════════════

function ProgressCard({
  icon, label, current, max, color, accentBg, accentBgLight, subtext, children, onAction, displayValue,
}: {
  icon: React.ReactNode;
  label: string;
  current: number;
  max: number | null;
  color: string;
  accentBg: string;
  accentBgLight: string;
  subtext?: string;
  children?: React.ReactNode;
  onAction?: () => void;
  displayValue?: string;
}) {
  const pct = max && max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const hasMax = max !== null && max !== undefined && max > 0;
  const isHex = color.startsWith('#');

  return (
    <div className="bg-card rounded-2xl border-2 border-border p-5 relative group hover:border-harvest/30 transition-all flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${isHex ? '' : accentBgLight}`}
            style={isHex ? { backgroundColor: `${color}15` } : undefined}
          >
            {icon}
          </div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        {onAction && (
          <button
            onClick={onAction}
            className="w-7 h-7 rounded-lg bg-muted hover:bg-harvest/15 flex items-center justify-center transition-colors group/btn"
            title={`Add ${label}`}
          >
            <Plus className="w-4 h-4 text-muted-foreground group-hover/btn:text-harvest transition-colors" />
          </button>
        )}
      </div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span
          className={`text-3xl font-black ${isHex ? '' : color}`}
          style={isHex ? { color } : undefined}
        >
          {displayValue ?? current}
        </span>
        {hasMax && <span className="text-lg font-bold text-muted-foreground/50">/ {max}</span>}
      </div>
      {hasMax && (
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden mb-1.5">
          <div
            className={`h-full rounded-full animate-progress-fill ${isHex ? '' : accentBg}`}
            style={isHex ? { 
              backgroundColor: color,
              ['--progress-width' as any]: `${pct}%`
            } : { 
              ['--progress-width' as any]: `${pct}%`
            }}
          />
        </div>
      )}
      {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ROLE CONFIG
// ══════════════════════════════════════════════════════

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  player: { label: 'Player', color: '#3b82f6', icon: <Swords className="w-3.5 h-3.5" /> },
  coach: { label: 'Coach', color: '#10b981', icon: <GraduationCap className="w-3.5 h-3.5" /> },
  staff: { label: 'Staff', color: '#f59e0b', icon: <Headphones className="w-3.5 h-3.5" /> },
  // Legacy support
  captain: { label: 'Captain', color: '#8b5cf6', icon: <Shield className="w-3.5 h-3.5" /> },
  undecided: { label: 'Undecided', color: '#6b7280', icon: <Star className="w-3.5 h-3.5" /> },
};

// ═══════════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════════

export interface TournamentHubOverviewProps {
  tournament: any;
  statusStyle: PhaseConfig;
  registrations: any;
  freeAgents: any[];
  onTeamPlayers: any[];
  approvedTeams: any[];
  pendingTeams: any[];
  user: any;
  isOwner: boolean;
  myRegistration: any;
  myTeam: any;
  myInvites: any[];
  myStaffApp: any;
  staffApps: any[];
  staffSummary: any;
  canRegister: boolean;
  isEarlyAccess: boolean;
  canCreateTeam: boolean;
  isMutable: boolean;
  isRegOpen: boolean;
  isFinished: boolean;
  // Actions
  handleRegisterWithRole: (role: string) => void;
  handleWithdraw: () => void;
  handleSendInvite: (teamId: string, personId: string, personName: string) => void;
  handleInviteResponse: (inviteId: string, status: 'accepted' | 'declined', teamName?: string) => void;
  handleStaffReview: (userId: string, status: 'approved' | 'denied', username: string) => void;
  handleWithdrawStaffApp: () => void;
  // Loading states
  registering: boolean;
  withdrawing: boolean;
  // Tab navigation
  setActiveTab: (tab: any) => void;
  setShowStaffModal: (show: boolean) => void;
  // Choose Your Path
  tournamentId: string;
  isRankIneligible: boolean;
  // NEW: Finished tournament props
  teams?: any[];
  playerStats?: any[];
  heroBans?: Record<number, number>;
  getKKupNumber?: (t: any | null) => string | null;
  setShowCreateTeam?: (show: boolean) => void;
  setShowExistingTeam?: (show: boolean) => void;
  setSelectedPlayer?: (player: any) => void;
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export function TournamentHubOverview(props: TournamentHubOverviewProps) {
  const {
    tournament, statusStyle, registrations, freeAgents, onTeamPlayers, approvedTeams, pendingTeams,
    user, isOwner, myRegistration, myTeam, myInvites, myStaffApp, staffApps, staffSummary,
    canRegister, isEarlyAccess, canCreateTeam, isMutable, isRegOpen, isFinished,
    handleRegisterWithRole, handleWithdraw,
    registering, withdrawing,
    setActiveTab, setShowStaffModal,
    tournamentId, isRankIneligible,
    handleWithdrawStaffApp,
    setShowCreateTeam, setShowExistingTeam,
    setSelectedPlayer,
    teams, playerStats, heroBans, getKKupNumber,
  } = props;

  // ── FINISHED TOURNAMENT: Show final standings, winners, stats, movie ──
  if (isFinished && teams && playerStats) {
    return <FinishedOverview
      tournament={tournament}
      teams={teams}
      playerStats={playerStats}
      heroBans={heroBans || {}}
      getKKupNumber={getKKupNumber}
      setActiveTab={setActiveTab}
    />;
  }

  // ── ACTIVE TOURNAMENT: Show phase-driven overview sections ──

  const totalActive = registrations?.summary?.total_active || 0;
  const staffNeeded = (tournament.casters_needed || 0) + (tournament.staff_needed || 0);

  // Role breakdown for registrations card subtext
  const playerCount = (registrations?.registrations || []).filter((r: any) => r.role === 'player' && r.status !== 'withdrawn').length;
  const coachCount = (registrations?.registrations || []).filter((r: any) => r.role === 'coach' && r.status !== 'withdrawn').length;

  // Staff-only count (staff apps whose user_id is NOT already in kkup_registrations)
  const regUserIds = new Set(
    (registrations?.registrations || [])
      .filter((r: any) => r.status !== 'withdrawn')
      .map((r: any) => r.user_id)
      .filter(Boolean)
  );
  const staffOnlyCount = (staffApps || []).filter(
    (app: any) => app.status !== 'withdrawn' && !regUserIds.has(app.user_id)
  ).length;
  const totalRegistrants = totalActive + staffOnlyCount;

  // Determine if user can create/add a team from the + button
  const showTeamAction = canCreateTeam && !myTeam && isMutable && !isFinished;
  const showDonationAction = user && !isFinished;
  const [showTeamChoice, setShowTeamChoice] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);

  // All registrants (sorted by most recent) — merges kkup_registrations + staff apps
  const allRegistrants = useMemo(() => {
    const regs = registrations?.registrations || [];
    const filtered = [...regs].filter((r: any) => r.registered_at);

    // Merge staff apps that don't already have a corresponding registration
    const existingUserIds = new Set(filtered.map((r: any) => r.user_id).filter(Boolean));
    const staffEntries = (staffApps || [])
      .filter((app: any) => app.status !== 'withdrawn' && !existingUserIds.has(app.user_id))
      .map((app: any) => ({
        id: `staff-app-${app.id}`,
        role: 'staff',
        registered_at: app.applied_at || app.created_at,
        person: {
          id: app.person_id || null,
          display_name: app.discord_username || 'Unknown',
          avatar_url: app.discord_avatar || null,
        },
        linked_user: {
          id: app.user_id,
          discord_username: app.discord_username || 'Unknown',
          discord_avatar: app.discord_avatar || null,
          badge_rank: null,
          opendota_data: null,
          tcf_plus_active: app.tcf_plus_active || false,
        },
        _isStaffApp: true,
        _staffStatus: app.status,
        _rolePreference: app.role_preference,
      }));

    return [...filtered, ...staffEntries]
      .sort((a: any, b: any) => new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime());
  }, [registrations, staffApps]);

  // Final registrant count: use allRegistrants length as the authoritative count
  // (it properly deduplicates players/coaches/staff)
  const registrantCount = allRegistrants.length;

  // ── Section Renderers ──
  const sectionRenderers: Record<OverviewSection, () => React.ReactNode> = {

    countdown: () => (
      <CountdownSection tournament={tournament} phase={statusStyle} />
    ),

    winner_banner: () => (
      <WinnerBanner tournament={tournament} phase={statusStyle} />
    ),

    urgency_bar: () => (
      <UrgencyBar totalActive={totalActive} maxPlayers={0} phase={statusStyle} />
    ),

    progress_cards: () => (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ProgressCard
          icon={<Users className="w-5 h-5 text-[#3b82f6]" />}
          label="Registrations"
          current={registrantCount}
          max={null}
          color="#3b82f6"
          accentBg="bg-[#3b82f6]"
          accentBgLight="bg-[#3b82f6]/10"
          subtext={isFinished
            ? `${playerCount} players · ${coachCount} coaches${staffOnlyCount > 0 ? ` · ${staffOnlyCount} staff` : ''}`
            : `${playerCount} players · ${coachCount} coaches${staffOnlyCount > 0 ? ` · ${staffOnlyCount} staff` : ''} · ${freeAgents.length} free agents`}
        />
        <ProgressCard
          icon={<Shield className="w-5 h-5 text-[#8b5cf6]" />}
          label="Teams"
          current={approvedTeams.length}
          max={tournament.max_teams || null}
          color="text-[#8b5cf6]"
          accentBg="bg-[#8b5cf6]"
          accentBgLight="bg-[#8b5cf6]/10"
          subtext={isFinished ? `${approvedTeams.length} competed` : pendingTeams.length > 0 ? `${pendingTeams.length} pending approval` : approvedTeams.length > 0 ? 'ready to compete' : 'none yet'}
          onAction={showTeamAction ? () => setShowTeamChoice(prev => !prev) : undefined}
        >
          {showTeamChoice && (
            <TeamChoiceDropdown
              onCreateNew={() => { setShowTeamChoice(false); setShowCreateTeam(true); }}
              onAddExisting={() => { setShowTeamChoice(false); setShowExistingTeam(true); }}
              onClose={() => setShowTeamChoice(false)}
            />
          )}
        </ProgressCard>
        <ProgressCard
          icon={<Briefcase className="w-5 h-5 text-[#f59e0b]" />}
          label="Staff"
          current={staffSummary?.approved || 0}
          max={staffNeeded || null}
          color="text-[#f59e0b]"
          accentBg="bg-[#f59e0b]"
          accentBgLight="bg-[#f59e0b]/10"
          subtext={isFinished
            ? `${staffSummary?.casters || 0} casters · ${(staffSummary?.approved || 0) - (staffSummary?.casters || 0)} other`
            : staffNeeded > 0 ? `${tournament.casters_needed || 0} casters needed · ${tournament.staff_needed || 0} staff needed${staffSummary?.pending ? ` · ${staffSummary.pending} pending` : ''}` : 'not set'}
        />
        <ProgressCard
          icon={<Trophy className="w-5 h-5 text-harvest" />}
          label="Prize Pool"
          current={(() => {
            const base = tournament.prize_pool ? Number(tournament.prize_pool) : 0;
            const donations = tournament.prize_pool_donations ?? 0;
            return base + donations;
          })()}
          displayValue={(() => {
            const base = tournament.prize_pool ? Number(tournament.prize_pool) : 0;
            const donations = tournament.prize_pool_donations ?? 0;
            const total = base + donations;
            return total > 0 ? `$${total.toFixed(2)}` : '$0';
          })()}
          max={null}
          color="text-harvest"
          accentBg="bg-harvest"
          accentBgLight="bg-harvest/10"
          onAction={showDonationAction ? () => setShowDonateModal(true) : undefined}
        >
          {(() => {
            const base = tournament.prize_pool ? Number(tournament.prize_pool) : 0;
            const donations = tournament.prize_pool_donations ?? 0;
            const total = base + donations;
            const format = tournament.tournament_type === 'heaps_n_hooks' ? '1v1' : '5v5';
            return (
              <div className="mt-1 space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  {format} · {total > 0 ? `$${total.toFixed(2)}` : 'TBD'}
                </p>
                {donations > 0 && base > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    ${base.toFixed(2)} base + ${donations.toFixed(2)} donated
                  </p>
                )}
                {donations > 0 && base === 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    ${donations.toFixed(2)} from donations
                  </p>
                )}
              </div>
            );
          })()}
        </ProgressCard>
      </div>
    ),

    registration_cta: () => {
      // During early access: show upsell for non-TCF+ logged-in users
      if (isEarlyAccess && user && !user.tcf_plus_active && !myRegistration) {
        return (
          <div className="bg-gradient-to-r from-harvest/5 via-kernel-gold/5 to-harvest/5 rounded-2xl border-2 border-harvest/20 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground mb-1">TCF+ Members Are Registering Early</h3>
                <p className="text-muted-foreground text-sm">
                  TCF+ members can register before public registration opens. Join TCF+ to secure your spot early and get other perks.
                </p>
              </div>
              <Button
                onClick={() => window.location.hash = '#secret-shop'}
                className="bg-gradient-to-r from-harvest to-kernel-gold hover:from-harvest/90 hover:to-kernel-gold/90 text-white font-bold rounded-xl h-12 px-6"
              >
                Get TCF+
              </Button>
            </div>
          </div>
        );
      }
      // Normal: not logged in during registration_open or early access
      if (!user && (isRegOpen || isEarlyAccess)) {
        return (
          <div className="bg-gradient-to-r from-[#3b82f6]/5 to-[#8b5cf6]/5 rounded-2xl border-2 border-[#3b82f6]/20 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground mb-1">Want to play?</h3>
                <p className="text-muted-foreground text-sm">Log in with Discord to register for this tournament.</p>
              </div>
              <Button
                onClick={() => window.location.hash = '#login'}
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white font-bold rounded-xl h-12 px-6"
              >
                Log In to Register
              </Button>
            </div>
          </div>
        );
      }
      return null;
    },

    registration_hero_cta: () => (
      <RegistrationHeroCta
        user={user}
        myRegistration={myRegistration}
        canRegister={canRegister && !myStaffApp}
        isMutable={isMutable}
        registering={registering}
        withdrawing={withdrawing}
        onRegisterWithRole={handleRegisterWithRole}
        onWithdraw={handleWithdraw}
        onOpenStaffModal={() => setShowStaffModal(true)}
        phase={statusStyle}
        tournamentName={tournament.name}
        tournamentType={tournament.tournament_type || 'kernel_kup'}
        isRankIneligible={isRankIneligible}
        isEarlyAccess={isEarlyAccess}
      />
    ),

    your_status: () => {
      if (!user) return null;

      // ── Staff application without registration ──
      if (!myRegistration && myStaffApp) {
        const isPending = myStaffApp.status === 'pending';
        const isDenied = myStaffApp.status === 'denied';
        const isApproved = myStaffApp.status === 'approved';
        if (isPending) {
          return (
            <div className="bg-card rounded-2xl border-2 border-[#f59e0b]/20 overflow-hidden">
              <div className="bg-[#f59e0b]/5 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#f59e0b]/15 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-[#f59e0b]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-foreground">Staff Application Under Review</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      You applied as {myStaffApp.role_preference === 'tournament_director' ? 'Tournament Director' : myStaffApp.role_preference}
                      {myStaffApp.plans_to_play ? ' (plans to play)' : ''} — an officer will review your application soon.
                    </p>
                  </div>
                  {isMutable && (
                    <button
                      onClick={handleWithdrawStaffApp}
                      className="text-xs font-bold text-muted-foreground hover:text-[#ef4444] transition-colors flex-shrink-0 px-3 py-1.5 rounded-lg hover:bg-[#ef4444]/10"
                    >
                      Withdraw
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        }
        // Denied — show Choose Your Path again (denial banner + CTA)
        if (isDenied) {
          return (
            <div className="space-y-4">
              <div className="rounded-xl border-2 border-[#ef4444]/20 bg-[#ef4444]/5 p-4 flex items-center gap-3">
                <Briefcase className="w-5 h-5 text-[#ef4444] flex-shrink-0" />
                <div>
                  <p className="font-semibold text-foreground text-sm">Staff Application Not Selected</p>
                  <p className="text-xs text-muted-foreground">
                    Your staff application was not selected. You can still register as a player or coach!
                  </p>
                </div>
              </div>
              {canRegister && (
                <RegistrationHeroCta
                  user={user}
                  myRegistration={null}
                  canRegister={true}
                  isMutable={isMutable}
                  registering={registering}
                  withdrawing={withdrawing}
                  onRegisterWithRole={handleRegisterWithRole}
                  onWithdraw={handleWithdraw}
                  onOpenStaffModal={() => setShowStaffModal(true)}
                  phase={statusStyle}
                  tournamentName={tournament.name}
                  tournamentType={tournament.tournament_type || 'kernel_kup'}
                  isRankIneligible={isRankIneligible}
                />
              )}
            </div>
          );
        }
        // Approved staff (no player registration — either TD-only or withdrew player reg)
        if (isApproved) {
          const staffRoleLabel = myStaffApp.role_preference === 'tournament_director' ? 'Tournament Director' : myStaffApp.role_preference === 'caster' ? 'Caster' : 'Staff';
          return (
            <div className="space-y-4">
              <div className="bg-card rounded-2xl border-2 border-[#10b981]/20 overflow-hidden">
                <div className="bg-[#10b981]/5 p-4 sm:p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#10b981]/15 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="w-6 h-6 text-[#10b981]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-foreground">{staffRoleLabel}</p>
                        <span className="px-2 py-0.5 rounded-full bg-[#10b981]/10 text-[#10b981] text-[11px] font-bold">Approved</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        You're an approved {staffRoleLabel.toLowerCase()} for this tournament.
                        {myStaffApp.plans_to_play && !myRegistration && isRegOpen && (
                          <> You can still register as a player below.</>
                        )}
                      </p>
                    </div>
                    {isMutable && (
                      <button
                        onClick={handleWithdrawStaffApp}
                        disabled={withdrawing}
                        className="text-xs font-bold text-muted-foreground hover:text-[#ef4444] transition-colors flex-shrink-0 px-3 py-1.5 rounded-lg hover:bg-[#ef4444]/10"
                      >
                        {withdrawing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Step Down'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {/* If TD plans to play, show player registration CTA */}
              {myStaffApp.plans_to_play && canRegister && (
                <RegistrationHeroCta
                  user={user}
                  myRegistration={null}
                  canRegister={true}
                  isMutable={isMutable}
                  registering={registering}
                  withdrawing={withdrawing}
                  onRegisterWithRole={handleRegisterWithRole}
                  onWithdraw={handleWithdraw}
                  onOpenStaffModal={() => setShowStaffModal(true)}
                  phase={statusStyle}
                  tournamentName={tournament.name}
                  tournamentType={tournament.tournament_type || 'kernel_kup'}
                  isRankIneligible={isRankIneligible}
                />
              )}
            </div>
          );
        }
      }

      // Not registered
      if (!myRegistration) {
        // Don't show "closed" message during early access phases — the registration_cta handles the upsell
        if (!canRegister && !isEarlyAccess && !['completed', 'archived'].includes(tournament.status)) {
          return (
            <div className="bg-card rounded-2xl border-2 border-border p-5">
              <p className="text-muted-foreground text-sm">
                Registration is currently closed ({statusStyle.label}).
              </p>
            </div>
          );
        }
        if (['completed', 'archived'].includes(tournament.status)) {
          return (
            <div className="bg-card rounded-2xl border-2 border-border p-5">
              <p className="text-muted-foreground text-sm">You did not participate in this tournament.</p>
            </div>
          );
        }
        return null;
      }

      // ── Registered — Tournament Profile Card ──
      const role = myRegistration.role as string;
      const rc = ROLE_CONFIG[role] || ROLE_CONFIG.player;
      const isOnTeam = myRegistration.status === 'on_team';
      const isCompleted = ['completed', 'archived'].includes(tournament.status);

      // Dota rank
      const linkedUser = myRegistration.linked_user || user;
      const rankDisplay = getRankDisplay(
        linkedUser?.opendota_data?.badge_rank || linkedUser?.badge_rank,
      );
      const medalColor = rankDisplay ? getMedalColor(rankDisplay.medal) : null;

      // Avatar
      const avatar = linkedUser?.discord_avatar || user?.discord_avatar;
      const displayName = linkedUser?.discord_username || user?.discord_username || 'You';

      return (
        <div
          className="bg-card rounded-2xl border-2 overflow-hidden"
          style={{ borderColor: `${rc.color}25` }}
        >
          {/* Compact profile bar */}
          <div className="flex items-center gap-4 p-4">
            {/* Avatar */}
            {avatar ? (
              <img src={avatar} alt={displayName} className="w-12 h-12 rounded-full border-2 border-border flex-shrink-0" width={48} height={48} />
            ) : (
              <div className="w-12 h-12 rounded-full bg-muted border-2 border-border flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-black text-muted-foreground">{displayName.charAt(0).toUpperCase()}</span>
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-foreground truncate">{displayName}</span>
                {/* Role badge */}
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                  style={{ backgroundColor: `${rc.color}15`, color: rc.color }}
                >
                  {rc.icon}
                  {rc.label}
                </span>
                {/* Rank badge */}
                {rankDisplay && (
                  <RankBadge medal={rankDisplay.medal} stars={rankDisplay.stars} size="xs" showLabel showStars />
                )}
                {/* On team badge */}
                {isOnTeam && myRegistration.team?.team_name && (
                  <span className="px-2 py-0.5 rounded-full bg-[#8b5cf6]/10 text-[#8b5cf6] text-[11px] font-bold truncate max-w-[120px]">
                    {myRegistration.team.team_name}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isCompleted
                  ? `Participated as ${rc.label}`
                  : role === 'player'
                    ? isOnTeam ? 'On a team — good luck!' : 'Free agent — waiting for a coach to recruit you'
                    : role === 'coach'
                      ? isOnTeam ? 'Leading a team' : 'Ready to build a team'
                      : role === 'staff'
                        ? myStaffApp?.status === 'approved' ? 'Staff — approved' : myStaffApp?.status === 'pending' ? 'Staff — application pending' : 'Staff'
                        : 'Registered'
                }
                {myRegistration.registered_at && !isCompleted && (
                  <> · registered {timeAgo(myRegistration.registered_at)}</>
                )}
              </p>
            </div>

            {/* Withdraw button */}
            {isMutable && !isCompleted && (
              <Button
                onClick={handleWithdraw}
                disabled={withdrawing}
                className="bg-muted hover:bg-[#ef4444]/10 text-muted-foreground hover:text-[#ef4444] font-bold rounded-xl h-9 px-3 text-sm flex-shrink-0"
              >
                {withdrawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4 mr-1.5" />}
                Withdraw as {rc.label}
              </Button>
            )}
          </div>
        </div>
      );
    },

    my_staff_status: () => {
      // Only show this banner when user has a registration AND a staff app
      // (i.e., they're approved staff with a profile card).
      // Pending/denied without registration is handled by your_status.
      if (!myStaffApp || !myRegistration) return null;
      const staffColor = myStaffApp.status === 'pending' ? '#f59e0b' : myStaffApp.status === 'approved' ? '#10b981' : '#ef4444';
      const staffRoleLabel = myStaffApp.role_preference === 'tournament_director' ? 'Tournament Director'
        : myStaffApp.role_preference === 'either' ? 'Caster/Staff' : myStaffApp.role_preference;
      return (
        <div className="rounded-xl border-2 p-4 flex items-center gap-3" style={{ backgroundColor: `${staffColor}08`, borderColor: `${staffColor}33` }}>
          <Briefcase className="w-5 h-5 flex-shrink-0" style={{ color: staffColor }} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm">
              {myStaffApp.status === 'pending' ? 'Staff Application Under Review' : myStaffApp.status === 'approved' ? `${staffRoleLabel} — Approved` : 'Staff Application Not Selected'}
            </p>
            <p className="text-xs text-muted-foreground">
              Applied as {staffRoleLabel.toLowerCase()} · {timeAgo(myStaffApp.applied_at)}
            </p>
          </div>
          {myStaffApp.status === 'approved' && isMutable && (
            <button
              onClick={handleWithdrawStaffApp}
              disabled={withdrawing}
              className="text-xs font-bold text-muted-foreground hover:text-[#ef4444] transition-colors flex-shrink-0 px-3 py-1.5 rounded-lg hover:bg-[#ef4444]/10"
            >
              {withdrawing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Step Down'}
            </button>
          )}
          {myStaffApp.status === 'pending' && isMutable && (
            <button
              onClick={handleWithdrawStaffApp}
              disabled={withdrawing}
              className="text-xs font-bold text-muted-foreground hover:text-[#ef4444] transition-colors flex-shrink-0 px-3 py-1.5 rounded-lg hover:bg-[#ef4444]/10"
            >
              {withdrawing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Withdraw'}
            </button>
          )}
        </div>
      );
    },

    live_broadcast: () => {
      if (!(tournament.twitch_url_1 || tournament.twitch_url_2)) return null;
      return (
        <div className="bg-gradient-to-br from-[#9146FF]/5 to-harvest/5 rounded-2xl border-2 border-[#9146FF]/20 overflow-hidden">
          <div className="bg-gradient-to-r from-[#9146FF]/10 to-transparent p-4 border-b border-[#9146FF]/10">
            <div className="flex items-center gap-2">
              <div className="relative flex items-center gap-2">
                <div className="w-3 h-3 bg-[#ef4444] rounded-full animate-pulse" />
                <span className="font-black text-[#9146FF] text-lg">LIVE BROADCAST</span>
              </div>
            </div>
          </div>
          <div className={`grid gap-4 p-4 ${tournament.twitch_url_1 && tournament.twitch_url_2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            {tournament.twitch_url_1 && (() => {
              const channel1 = extractTwitchChannel(tournament.twitch_url_1);
              return channel1 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#9146FF]">Stream 1</span>
                    <a href={tournament.twitch_url_1} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-[#9146FF] transition-colors">↗ Open in Twitch</a>
                  </div>
                  <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ paddingTop: '56.25%' }}>
                    <iframe src={`https://player.twitch.tv/?channel=${channel1}&parent=${window.location.hostname}&muted=true`} className="absolute inset-0 w-full h-full" allowFullScreen allow="autoplay; encrypted-media" />
                  </div>
                </div>
              ) : (
                <a href={tournament.twitch_url_1} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-[#9146FF]/10 rounded-xl hover:bg-[#9146FF]/20 transition-colors">
                  <TwitchIcon className="w-5 h-5 text-[#9146FF]" />
                  <span className="font-bold text-[#9146FF]">Watch Stream 1</span>
                </a>
              );
            })()}
            {tournament.twitch_url_2 && (() => {
              const channel2 = extractTwitchChannel(tournament.twitch_url_2);
              return channel2 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#9146FF]">Stream 2</span>
                    <a href={tournament.twitch_url_2} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-[#9146FF] transition-colors">↗ Open in Twitch</a>
                  </div>
                  <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ paddingTop: '56.25%' }}>
                    <iframe src={`https://player.twitch.tv/?channel=${channel2}&parent=${window.location.hostname}&muted=true`} className="absolute inset-0 w-full h-full" allowFullScreen allow="autoplay; encrypted-media" />
                  </div>
                </div>
              ) : (
                <a href={tournament.twitch_url_2} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-[#9146FF]/10 rounded-xl hover:bg-[#9146FF]/20 transition-colors">
                  <TwitchIcon className="w-5 h-5 text-[#9146FF]" />
                  <span className="font-bold text-[#9146FF]">Watch Stream 2</span>
                </a>
              );
            })()}
          </div>
        </div>
      );
    },

    all_registrants: () => {
      if (allRegistrants.length === 0) return null;

      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: statusStyle.accentHex }} />
              All Registrants
              <span
                className="px-2 py-0.5 rounded-full text-xs font-bold"
                style={{ backgroundColor: `${statusStyle.accentHex}15`, color: statusStyle.accentHex }}
              >
                {allRegistrants.length}
              </span>
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
            {allRegistrants.map((reg: any) => {
              const person = reg.person;
              const linkedUser = reg.linked_user;
              const name = person?.display_name || linkedUser?.discord_username || 'Unknown';
              const avatar = linkedUser?.discord_avatar || person?.avatar_url;
              const role = reg.role as string;
              const rc = ROLE_CONFIG[role] || ROLE_CONFIG.player;
              const rank = getRankDisplay(
                linkedUser?.opendota_data?.badge_rank || linkedUser?.badge_rank,
              );
              const isTcfPlus = linkedUser?.tcf_plus_active;

              return (
                <button
                  key={reg.id}
                  onClick={() => setSelectedPlayer(reg)}
                  className="bg-card rounded-xl border-2 border-border p-3 sm:p-4 flex flex-col items-center text-center hover:border-harvest/50 transition-all cursor-pointer group"
                >
                  {/* Avatar */}
                  <TcfPlusAvatarRing active={isTcfPlus} size="sm">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={name}
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-border group-hover:border-harvest/30 transition-colors"
                      width={56} height={56}
                    />
                  ) : (
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-muted border-2 border-border flex items-center justify-center group-hover:border-harvest/30 transition-colors">
                      <span className="text-base sm:text-lg font-black text-muted-foreground">{name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  </TcfPlusAvatarRing>
                  {/* Name + TCF+ badge */}
                  <div className="flex items-center gap-1 mt-2 justify-center w-full">
                    <p className="font-bold text-foreground text-xs sm:text-sm truncate">{name}</p>
                    {isTcfPlus && <TcfPlusBadge size="xs" />}
                  </div>
                  {/* Role badge */}
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1"
                    style={{ backgroundColor: `${rc.color}12`, color: rc.color }}
                  >
                    {rc.icon}
                    {rc.label}
                  </span>
                  {/* Rank badge */}
                  {rank && (
                    <RankBadge
                      medal={rank.medal}
                      stars={rank.stars}
                      size="xs"
                      className="mt-1"
                    />
                  )}
                  {/* Time ago */}
                  <span className="text-[10px] text-muted-foreground mt-1.5">
                    {timeAgo(reg.registered_at)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    },
  };

  // ── Render sections in phase-driven order ──
  let sectionIndex = 0;
  return (
    <div className="space-y-6">
      {statusStyle.overviewSections.map((sectionKey) => {
        const content = sectionRenderers[sectionKey]?.();
        if (!content) return null;
        const idx = sectionIndex++;
        return (
          <AnimatedSection key={sectionKey} index={idx}>
            {content}
          </AnimatedSection>
        );
      })}

      {/* Prize Pool Donation Modal */}
      {showDonateModal && (
        <DonatePrizePoolModal
          tournamentName={tournament.name}
          currentPrizePool={tournament.prize_pool ? Number(tournament.prize_pool) : undefined}
          currentDonations={tournament.prize_pool_donations ?? 0}
          tournamentId={tournamentId}
          onClose={() => setShowDonateModal(false)}
        />
      )}
    </div>
  );
}

// ── Team Choice Dropdown ──
function TeamChoiceDropdown({
  onCreateNew, onAddExisting, onClose,
}: {
  onCreateNew: () => void;
  onAddExisting: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={ref} className="mt-2 bg-popover rounded-xl border-2 border-border shadow-xl z-20 overflow-hidden">
      <button
        onClick={onCreateNew}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[#8b5cf6]/5 transition-colors"
      >
        <div className="w-7 h-7 rounded-lg bg-[#8b5cf6]/10 flex items-center justify-center flex-shrink-0">
          <Plus className="w-3.5 h-3.5 text-[#8b5cf6]" />
        </div>
        <div>
          <p className="text-xs font-bold text-foreground">Create New Team</p>
          <p className="text-[10px] text-muted-foreground">Start fresh with a new team</p>
        </div>
      </button>
      <button
        onClick={onAddExisting}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-harvest/5 transition-colors border-t border-border"
      >
        <div className="w-7 h-7 rounded-lg bg-harvest/10 flex items-center justify-center flex-shrink-0">
          <History className="w-3.5 h-3.5 text-harvest" />
        </div>
        <div>
          <p className="text-xs font-bold text-foreground">Add Existing Team</p>
          <p className="text-[10px] text-muted-foreground">Register a team you already captain</p>
        </div>
      </button>
    </div>
  );
}

// ── Finished Tournament Overview ──
function FinishedOverview({
  tournament, teams, playerStats, heroBans, getKKupNumber, setActiveTab,
}: {
  tournament: any;
  teams: any[];
  playerStats: any[];
  heroBans: Record<number, number>;
  getKKupNumber: (t: any | null) => string | null;
  setActiveTab: (tab: any) => void;
}) {
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  // ── Team Selection ──
  const handleSelectTeam = (team: any) => {
    setSelectedTeam(team);
    setSelectedPlayer(null);
    setActiveTab('teams');
  };

  // ── Player Selection ──
  const handleSelectPlayer = (player: any) => {
    setSelectedPlayer(player);
    setSelectedTeam(null);
    setActiveTab('players');
  };

  return (
    <div className="space-y-6">
      {/* ── Tournament Summary ── */}
      <div className="bg-card rounded-2xl border-2 border-border p-5">
        <h3 className="text-lg font-bold text-foreground mb-2">Tournament Summary</h3>
        <p className="text-sm text-muted-foreground">
          {tournament.name} concluded on {new Date(tournament.end_date).toLocaleDateString()}.
          {tournament.winner && (
            <> The winner was {tournament.winner}.</>
          )}
        </p>
      </div>

      {/* ── Top Teams ── */}
      <div className="bg-card rounded-2xl border-2 border-border p-5">
        <h3 className="text-lg font-bold text-foreground mb-2">Top Teams</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {teams.slice(0, 4).map((team: any) => (
            <button
              key={team.team_id}
              onClick={() => handleSelectTeam(team)}
              className="bg-card rounded-xl border-2 border-border p-3 sm:p-4 flex flex-col items-center text-center hover:border-harvest/50 transition-all cursor-pointer group"
            >
              {/* Team Logo */}
              <TeamLogo
                teamId={team.team_id}
                size="sm"
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-border group-hover:border-harvest/30 transition-colors"
              />
              {/* Team Name */}
              <p className="font-bold text-foreground text-xs sm:text-sm truncate">{team.team_name}</p>
              {/* Team Rank */}
              <span className="text-[10px] text-muted-foreground mt-1.5">
                Rank {team.rank}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Top Players ── */}
      <div className="bg-card rounded-2xl border-2 border-border p-5">
        <h3 className="text-lg font-bold text-foreground mb-2">Top Players</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {playerStats.slice(0, 4).map((player: any) => (
            <button
              key={player.player_id}
              onClick={() => handleSelectPlayer(player)}
              className="bg-card rounded-xl border-2 border-border p-3 sm:p-4 flex flex-col items-center text-center hover:border-harvest/50 transition-all cursor-pointer group"
            >
              {/* Avatar */}
              <TcfPlusAvatarRing active={player.tcf_plus_active} size="sm">
                {player.avatar_url ? (
                  <img
                    src={player.avatar_url}
                    alt={player.display_name}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-border group-hover:border-harvest/30 transition-colors"
                    width={56} height={56}
                  />
                ) : (
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-muted border-2 border-border flex items-center justify-center group-hover:border-harvest/30 transition-colors">
                    <span className="text-base sm:text-lg font-black text-muted-foreground">{player.display_name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </TcfPlusAvatarRing>
              {/* Name + TCF+ badge */}
              <div className="flex items-center gap-1 mt-2 justify-center w-full">
                <p className="font-bold text-foreground text-xs sm:text-sm truncate">{player.display_name}</p>
                {player.tcf_plus_active && <TcfPlusBadge size="xs" />}
              </div>
              {/* Rank badge */}
              {player.rank && (
                <RankBadge
                  medal={player.rank.medal}
                  stars={player.rank.stars}
                  size="xs"
                  className="mt-1"
                />
              )}
              {/* Time ago */}
              <span className="text-[10px] text-muted-foreground mt-1.5">
                Rank {player.rank}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Hero Bans ── */}
      {Object.keys(heroBans).length > 0 && (
        <div className="bg-card rounded-2xl border-2 border-border p-5">
          <h3 className="text-lg font-bold text-foreground mb-2">Hero Bans</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(heroBans).map(([heroId, count]) => (
              <div key={heroId} className="bg-card rounded-xl border-2 border-border p-3 sm:p-4 flex flex-col items-center text-center hover:border-harvest/50 transition-all cursor-pointer group">
                {/* Hero Image */}
                <img
                  src={`https://api.opendota.com/apps/dota2/images/heroes/${heroId}.png`}
                  alt={`Hero ${heroId}`}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-border group-hover:border-harvest/30 transition-colors"
                  width={56} height={56}
                />
                {/* Hero Name */}
                <p className="font-bold text-foreground text-xs sm:text-sm truncate">Hero {heroId}</p>
                {/* Ban Count */}
                <span className="text-[10px] text-muted-foreground mt-1.5">
                  {count} bans
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tournament Stats ── */}
      <div className="bg-card rounded-2xl border-2 border-border p-5">
        <h3 className="text-lg font-bold text-foreground mb-2">Tournament Stats</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border-2 border-border p-3 sm:p-4 flex flex-col items-center text-center hover:border-harvest/50 transition-all cursor-pointer group">
            <TrophyImage size="sm" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-border group-hover:border-harvest/30 transition-colors" />
            <p className="font-bold text-foreground text-xs sm:text-sm truncate">Total Wins</p>
            <span className="text-[10px] text-muted-foreground mt-1.5">
              {tournament.total_wins}
            </span>
          </div>
          <div className="bg-card rounded-xl border-2 border-border p-3 sm:p-4 flex flex-col items-center text-center hover:border-harvest/50 transition-all cursor-pointer group">
            <Users size="sm" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-border group-hover:border-harvest/30 transition-colors" />
            <p className="font-bold text-foreground text-xs sm:text-sm truncate">Total Players</p>
            <span className="text-[10px] text-muted-foreground mt-1.5">
              {tournament.total_players}
            </span>
          </div>
          <div className="bg-card rounded-xl border-2 border-border p-3 sm:p-4 flex flex-col items-center text-center hover:border-harvest/50 transition-all cursor-pointer group">
            <Clock size="sm" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-border group-hover:border-harvest/30 transition-colors" />
            <p className="font-bold text-foreground text-xs sm:text-sm truncate">Duration</p>
            <span className="text-[10px] text-muted-foreground mt-1.5">
              {tournament.duration}
            </span>
          </div>
        </div>
      </div>

      {/* ── Tournament Movie ── */}
      {tournament.movie_url && (
        <div className="bg-card rounded-2xl border-2 border-border p-5">
          <h3 className="text-lg font-bold text-foreground mb-2">Tournament Movie</h3>
          <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ paddingTop: '56.25%' }}>
            <iframe src={tournament.movie_url} className="absolute inset-0 w-full h-full" allowFullScreen allow="autoplay; encrypted-media" />
          </div>
        </div>
      )}
    </div>
  );
}