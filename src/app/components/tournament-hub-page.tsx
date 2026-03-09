import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Crown, Calendar, ArrowLeft, Loader2, AlertCircle,
  UserPlus, Edit, Youtube, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { SuccessModal } from '@/app/components/success-modal';
import { EditTournamentModal } from '@/app/components/EditTournamentModal';
import { Footer } from '@/app/components/footer';
import { projectId } from '/utils/supabase/info';
import { slugifyTournamentName } from '@/lib/slugify';
import { toast } from 'sonner';
import { getPhaseConfig, isRegistrationOpen as isRegOpenFn, isLive as isLiveFn, isFinished as isFinishedFn, isMutable as isMutableFn, ALL_PHASES } from './tournament-state-config';
import { formatDateShort } from '@/lib/date-utils';
import { TwitchIcon } from '@/lib/icons';
import { TournamentHubOverview } from './tournament-hub-overview';
import { TournamentHubPlayers } from './tournament-hub-players';
import { TournamentHubTeams } from './tournament-hub-teams';
import { UserProfileModal } from './user-profile-modal';
import { PlayerInfoModal } from './tournament-hub-player-info-modal';
import { StaffModal } from './tournament-hub-staff-modal';
import { RankModal } from './tournament-hub-rank-modal';
import { TournamentHubCreateTeamModal } from './tournament-hub-create-team-modal';
import { AddExistingTeamModal } from './add-existing-team-modal';
import { TournamentHubStaff } from './tournament-hub-staff';
import { TournamentHubHistory } from './tournament-hub-history';
import type { FinishedTab } from './tournament-hub-history';
import { KKupDetailPrizes } from './kkup-detail-prizes';
import type { PrizeAward } from '@/lib/connect-api';
import { getTournamentAwards } from '@/lib/connect-api';
import { fireRoleConfetti, fireLockInConfetti } from '@/lib/confetti';
import { isOfficer as isOfficerFn } from '@/lib/roles';
import { OfficerRankOverrideModal } from './officer-rank-override-modal';
import { TournamentHubBracket } from './tournament-hub-bracket';

// ═══════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════

interface TournamentHubPageProps {
  tournamentId: string;
  user: any;
  accessToken: string;
  onBack: () => void;
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function TournamentHubPage({ tournamentId, user, accessToken, onBack }: TournamentHubPageProps) {
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Registration state
  const [registrations, setRegistrations] = useState<any>(null);
  const [myRegistration, setMyRegistration] = useState<any>(null);
  const [registering, setRegistering] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  // Teams state
  const [teams, setTeams] = useState<any[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teamRosters, setTeamRosters] = useState<Record<string, any[]>>({});
  const [teamCoachData, setTeamCoachData] = useState<Record<string, any>>({});
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  
  // Track which team rosters/invites we've already fetched (avoid useEffect dependency issues)
  const fetchedRostersRef = useRef<Set<string>>(new Set());
  const fetchedInvitesRef = useRef<Set<string>>(new Set());

  // My invites
  const [myInvites, setMyInvites] = useState<any[]>([]);
  const [respondingInvite, setRespondingInvite] = useState<string | null>(null);

  // Team creation modal
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showExistingTeam, setShowExistingTeam] = useState(false);

  // Team invites — track pending invites per team for captain/owner management
  const [teamInvites, setTeamInvites] = useState<Record<string, any[]>>({});
  const [cancellingInvite, setCancellingInvite] = useState<string | null>(null);

  // Invite sending — track per person_id for independent loading states
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);
  // Tracks whether last invite was successful (true) or failed (false) — used by modals for "Sent ✓" flash
  const [lastInviteSuccess, setLastInviteSuccess] = useState<boolean | null>(null);
  // Add self to roster loading — track by team_id
  const [addingSelfToRoster, setAddingSelfToRoster] = useState<string | null>(null);
  // Owner status change
  const [changingStatus, setChangingStatus] = useState(false);
  // Edit tournament modal
  const [showEditTournament, setShowEditTournament] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'players' | 'teams' | 'bracket' | 'matches' | 'staff' | 'gallery' | 'prizes'>('overview');
  // Players sub-tab
  const [playersSubTab, setPlayersSubTab] = useState<'all' | 'free_agents' | 'coaches'>('all');
  // Player info modal
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  // Prize awards (lazy-loaded when prizes tab is active on non-finished tournaments)
  const [prizeAwards, setPrizeAwards] = useState<PrizeAward[]>([]);
  const [awardsLoading, setAwardsLoading] = useState(false);
  const [awardsLoaded, setAwardsLoaded] = useState(false);

  // Staff application
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [myStaffApp, setMyStaffApp] = useState<any>(null);
  const [staffApps, setStaffApps] = useState<any[]>([]);
  const [staffSummary, setStaffSummary] = useState<any>(null);

  // Invite search dropdown
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');

  // Rank self-report modal
  const [showRankModal, setShowRankModal] = useState(false);

  // Modals
  const [confirmModal, setConfirmModal] = useState<{
    title: string; message: string; confirmText: string;
    confirmVariant: 'danger' | 'primary' | 'success';
    onConfirm: () => void;
    loading?: boolean; loadingText?: string;
    // Secondary action for two-option confirms (e.g. "Remove" vs "Delete Entirely")
    secondaryAction?: {
      text: string;
      variant: 'danger' | 'primary' | 'success';
      onAction?: () => void;
    };
  } | null>(null);
  const [resultModal, setResultModal] = useState<{
    type: 'success' | 'error' | 'info';
    title: string; message: string; helpText?: string;
  } | null>(null);

  const isOwner = user?.role === 'owner';
  const isOfficerUser = isOfficerFn(user?.role) || isOwner;

  // Officer rank override modal state
  const [rankOverrideTarget, setRankOverrideTarget] = useState<{
    userId: string; displayName: string; currentMedal?: string | null; currentStars?: number;
  } | null>(null);

  const handleRankOverride = (userId: string, displayName: string, currentMedal?: string | null, currentStars?: number) => {
    setRankOverrideTarget({ userId, displayName, currentMedal, currentStars });
  };

  const handleRankOverrideSuccess = () => {
    // Refresh registrations to pick up the updated rank
    fetchTournament();
  };

  // Bracket state
  const [bracketData, setBracketData] = useState<any>(null);
  const [bracketLoading, setBracketLoading] = useState(false);
  const [bracketError, setBracketError] = useState<string | null>(null);
  const [bracketGenerating, setBracketGenerating] = useState(false);
  const [bracketDeleting, setBracketDeleting] = useState(false);

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;
  const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` };

  // ═══════════════════════════════════════════════════════
  // DATA FETCHING
  // ═══════════════════════════════════════════════════════

  const fetchTournament = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/registrations`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load tournament');
      }
      const data = await res.json();
      setTournament(data.tournament);
      setRegistrations(data);

      if (data.registrations && user) {
        const myReg = data.registrations.find((r: any) => r.user_id === user.id);
        setMyRegistration(myReg || null);
      }
    } catch (err: any) {
      console.error('Fetch tournament error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tournamentId, accessToken, user]);

  const fetchTeams = useCallback(async () => {
    setLoadingTeams(true);
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams || []);
      }
    } catch (err) {
      console.error('Fetch teams error:', err);
    } finally {
      setLoadingTeams(false);
    }
  }, [tournamentId, accessToken]);

  const fetchMyInvites = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/my-invites`, {
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        setMyInvites(data.invites || []);
      }
    } catch (err) {
      console.error('Fetch invites error:', err);
    }
  }, [tournamentId, accessToken]);

  const fetchTeamInvites = async (teamId: string) => {
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams/${teamId}/invites?status=pending`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTeamInvites(prev => ({ ...prev, [teamId]: data.invites || [] }));
      }
    } catch (err) {
      console.error('Fetch team invites error:', err);
    }
  };

  const fetchTeamRoster = async (teamId: string) => {
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams/${teamId}/roster`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTeamRosters(prev => ({ ...prev, [teamId]: data.roster || [] }));
        // Store coach linked user data for team rank calculation
        if (data.team?.coach_linked_user) {
          setTeamCoachData(prev => ({ ...prev, [teamId]: data.team.coach_linked_user }));
        }
        // Sync coach_tickets_contributed back to team state
        if (data.team && 'coach_tickets_contributed' in data.team) {
          setTeams(prev => prev.map(t =>
            t.id === teamId ? { ...t, coach_tickets_contributed: data.team.coach_tickets_contributed } : t
          ));
        }
      }
    } catch (err) {
      console.error('Fetch roster error:', err);
    }
  };

  const fetchStaffApps = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/staff`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStaffApps(data.applications || []);
        setMyStaffApp(data.my_application || null);
        setStaffSummary(data.summary || null);
      }
    } catch (err) {
      console.error('Fetch staff apps error:', err);
    }
  }, [tournamentId, accessToken]);

  const fetchBracket = useCallback(async () => {
    setBracketLoading(true);
    setBracketError(null);
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/bracket`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load bracket');
      }
      const data = await res.json();
      setBracketData(data.bracket || null);
    } catch (err: any) {
      console.error('Fetch bracket error:', err);
      setBracketError(err.message);
    } finally {
      setBracketLoading(false);
    }
  }, [tournamentId, accessToken]);

  useEffect(() => {
    // Clear fetch tracking refs when tournament changes
    fetchedRostersRef.current.clear();
    fetchedInvitesRef.current.clear();
    
    fetchTournament();
    fetchTeams();
    fetchMyInvites();
    fetchStaffApps();
    fetchBracket();
  }, [fetchTournament, fetchTeams, fetchMyInvites, fetchStaffApps, fetchBracket]);

  // Lazy-fetch prize awards when prizes tab is active (non-finished tournaments)
  useEffect(() => {
    if (activeTab !== 'prizes' || awardsLoaded || isFinished || !tournamentId) return;
    const fetchAwards = async () => {
      setAwardsLoading(true);
      try {
        const data = await getTournamentAwards(tournamentId);
        setPrizeAwards(data.awards || []);
      } catch (err) {
        console.error('Awards fetch error:', err);
      } finally {
        setAwardsLoading(false);
        setAwardsLoaded(true);
      }
    };
    fetchAwards();
  }, [activeTab, tournamentId, awardsLoaded, isFinished]);

  // Pre-fetch all rosters when teams load (needed for team rank display on always-expanded cards)
  // Also fetch pending invites for teams the user captains
  // Uses refs to track fetched IDs to avoid circular dependency on teamRosters state
  useEffect(() => {
    if (teams.length === 0) return;
    
    const approvedTeamIds = teams
      .filter(t => t.approval_status === 'approved' || t.approval_status === 'ready')
      .map(t => t.id);
    
    // Fetch rosters for approved teams (if not already fetched)
    for (const teamId of approvedTeamIds) {
      if (!fetchedRostersRef.current.has(teamId)) {
        fetchedRostersRef.current.add(teamId);
        fetchTeamRoster(teamId);
      }
    }
    
    // Fetch invites for teams user is captain/owner of
    for (const team of teams) {
      if ((isUserCaptainOf(team) || isOwner) && (team.approval_status === 'approved' || team.approval_status === 'ready')) {
        if (!fetchedInvitesRef.current.has(team.id)) {
          fetchedInvitesRef.current.add(team.id);
          fetchTeamInvites(team.id);
        }
      }
    }
  }, [teams, isOwner, fetchTeamRoster, fetchTeamInvites, isUserCaptainOf]);

  // ═══════════════════════════════════════════════════════
  // BRACKET ACTIONS (owner/officer)
  // ═══════════════════════════════════════════════════════

  const handleGenerateBracket = async () => {
    setBracketGenerating(true);
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/bracket/generate`, {
        method: 'POST', headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Bracket generation failed:', res.status, data);
        toast.error(data.error || 'Failed to generate bracket');
        if (data.unrankedPlayers) {
          console.error('Unranked players:', data.unrankedPlayers);
        }
        return;
      }
      toast.success(data.message || 'Bracket generated!');
      await fetchBracket();
    } catch (err: any) {
      console.error('Generate bracket error:', err);
      toast.error('Failed to generate bracket');
    } finally {
      setBracketGenerating(false);
    }
  };

  const handleDeleteBracket = async () => {
    if (!confirm('Delete the bracket? This will remove all series and matches. You can re-generate afterward.')) return;
    setBracketDeleting(true);
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/bracket`, {
        method: 'DELETE', headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to delete bracket');
        return;
      }
      toast.success(data.message || 'Bracket deleted');
      setBracketData(null);
    } catch (err: any) {
      console.error('Delete bracket error:', err);
      toast.error('Failed to delete bracket');
    } finally {
      setBracketDeleting(false);
    }
  };

  const handleResetVoiceChannels = async () => {
    try {
      const res = await fetch(`${apiBase}/kkup/voice-channels/reset`, {
        method: 'POST', headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to reset voice channels');
        return;
      }
      toast.success('Voice channels reset to defaults');
    } catch (err: any) {
      console.error('Reset voice channels error:', err);
      toast.error('Failed to reset voice channels');
    }
  };

  const handleRecordSeriesResult = async (seriesId: string, winnerTeamId: string) => {
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/bracket/series/${seriesId}/result`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ winner_team_id: winnerTeamId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to record result');
        return;
      }
      toast.success(data.message || 'Series result recorded');
      if (data.is_grand_final) {
        toast.success(`🌽 ${data.winner?.name} is the champion!`, { duration: 8000 });
      }
      await fetchBracket();
    } catch (err: any) {
      console.error('Record series result error:', err);
      toast.error('Failed to record series result');
    }
  };

  // ═══════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════

  const handleRegisterWithRole = async (role: string, overrideRank?: string) => {
    setRegistering(true);
    try {
      const body: any = { role };
      if (overrideRank) body.self_reported_rank = overrideRank;
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/register`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.rank_unknown) { setShowRankModal(true); return; }
        if (data.tcf_plus_required) {
          setResultModal({
            type: 'error', title: 'TCF+ Early Access Only',
            message: data.error || 'Early registration is exclusive to TCF+ members.',
            helpText: 'Public registration opens when the tournament moves to Registration Open. Join TCF+ to register early!',
          });
          return;
        }
        if (data.rank_ineligible) {
          setResultModal({
            type: 'error', title: 'Rank Ineligible', message: data.error,
            helpText: data.self_reported
              ? `Based on your self-reported rank (${data.rank_medal}), you're above the eligibility range. You can still participate as a Coach or Staff!`
              : `Your rank (${data.rank_medal}) is above the Herald 1 – Divine 1 eligibility range. You can still participate as a Coach or Staff!`,
          });
          return;
        }
        throw new Error(data.error || 'Registration failed');
      }
      toast.success(data.message || `You're registered!`);
      setShowRankModal(false);
      fireRoleConfetti(role);
      await fetchTournament();
    } catch (err: any) {
      console.error('Registration error:', err);
      const message = err.message?.includes('cyclic') || err.message?.includes('serialize')
        ? 'Registration failed due to a server error. Please try again.'
        : (err.message || 'Registration failed. Please try again.');
      setResultModal({ type: 'error', title: 'Registration Failed', message });
    } finally {
      setRegistering(false);
    }
  };

  const handleWithdraw = async () => {
    // Check if user is a team captain — withdrawal will disband the team
    const isCaptainOfTeam = myTeam != null;
    const teamName = myTeam?.team_name || 'your team';
    const rosterSize = myTeam?.roster_count || 0;
    const teamWarning = isCaptainOfTeam
      ? `\n\n⚠️ You are the captain of "${teamName}"${rosterSize > 0 ? ` (${rosterSize} member${rosterSize !== 1 ? 's' : ''})` : ''}. Withdrawing will disband the team — all roster members will be returned to the free agent pool, the coach will be unassigned, and pending invites will be canceled.`
      : '';

    setConfirmModal({
      title: isCaptainOfTeam ? `Withdraw & Disband "${teamName}"?` : 'Withdraw from Tournament?',
      message: `This will remove your player/coach registration, team roster, and coaching spot.${teamWarning}\n\nYou can re-register anytime while registration is open.`,
      confirmText: isCaptainOfTeam ? 'Withdraw & Disband' : 'Withdraw', confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => prev ? { ...prev, loading: true, loadingText: 'Withdrawing...' } : null);
        try {
          const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/register`, { method: 'DELETE', headers: authHeaders });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
          setConfirmModal(null);
          setMyRegistration(null);
          const disbandMsg = isCaptainOfTeam
            ? ` Team "${teamName}" has been disbanded and all members returned to the free agent pool.`
            : '';
          setResultModal({
            type: 'success',
            title: isCaptainOfTeam ? 'Withdrawn & Team Disbanded' : 'Withdrawn',
            message: (data.message || 'You have been withdrawn from this tournament.') + disbandMsg,
            helpText: 'You can re-register anytime while registration is open.',
          });
          await Promise.all([fetchTournament(), fetchTeams(), fetchMyInvites(), fetchStaffApps()]);
        } catch (err: any) {
          setConfirmModal(null);
          setResultModal({ type: 'error', title: 'Withdrawal Failed', message: err.message });
        }
      },
    });
  };

  const handleTeamApproval = async (teamId: string, teamName: string, approval: 'approved' | 'denied') => {
    const verb = approval === 'approved' ? 'Approve' : 'Deny';
    setConfirmModal({
      title: `${verb} Team "${teamName}"?`,
      message: approval === 'denied' ? 'Denying this team will remove all roster members and cancel pending invites. They will be returned to the free agent pool.' : `Approving this team will allow them to send invites and build their roster.`,
      confirmText: verb, confirmVariant: approval === 'approved' ? 'success' : 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => prev ? { ...prev, loading: true, loadingText: approval === 'approved' ? 'Approving...' : 'Denying...' } : null);
        try {
          const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams/${teamId}/approval`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ approval_status: approval }) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to update approval');
          setConfirmModal(null);
          setResultModal({
            type: approval === 'approved' ? 'success' : 'info',
            title: approval === 'approved' ? 'Team Approved!' : 'Team Denied',
            message: data.message || `Team "${teamName}" has been ${approval}.`,
            helpText: approval === 'approved' ? 'The captain can now send invites and build their roster.' : 'Roster members have been returned to the free agent pool.',
          });
          await Promise.all([fetchTeams(), fetchTournament()]);
        } catch (err: any) {
          setConfirmModal(null);
          setResultModal({ type: 'error', title: `${verb} Failed`, message: err.message });
        }
      },
    });
  };

  const handleSendInvite = async (teamId: string, personId: string, personName: string, inviteRole?: 'player' | 'coach') => {
    setSendingInvite(personId);
    setLastInviteSuccess(null); // reset
    try {
      const body: any = { person_id: personId };
      if (inviteRole) body.invite_role = inviteRole;
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams/${teamId}/invites`, { method: 'POST', headers: authHeaders, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invite');
      const roleLabel = inviteRole === 'coach' ? 'coaching' : 'team';
      setResultModal({ type: 'success', title: 'Invite Sent!', message: `${roleLabel === 'coaching' ? 'Coaching invite' : 'Invite'} sent to ${personName}. They'll see it in their inbox and can accept or decline.` });
      setLastInviteSuccess(true);
      await fetchTournament();
      fetchTeamInvites(teamId);
    } catch (err: any) {
      setResultModal({ type: 'error', title: 'Invite Failed', message: err.message });
      setLastInviteSuccess(false);
    } finally { setSendingInvite(null); }
  };

  const handleCancelInvite = async (teamId: string, inviteId: string, personName: string) => {
    setConfirmModal({
      title: `Cancel Invite to ${personName}?`,
      message: `${personName} will no longer be able to accept this team invite.`,
      confirmText: 'Cancel Invite', confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => prev ? { ...prev, loading: true, loadingText: 'Cancelling...' } : null);
        setCancellingInvite(inviteId);
        try {
          const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams/${teamId}/invites/${inviteId}`, { method: 'DELETE', headers: authHeaders });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to cancel invite');
          setConfirmModal(null);
          setResultModal({ type: 'info', title: 'Invite Cancelled', message: `The invite to ${personName} has been cancelled.` });
          // Remove from local state immediately for snappy UX
          setTeamInvites(prev => ({
            ...prev,
            [teamId]: (prev[teamId] || []).filter(inv => inv.id !== inviteId),
          }));
        } catch (err: any) {
          setConfirmModal(null);
          setResultModal({ type: 'error', title: 'Cancel Failed', message: err.message });
        } finally { setCancellingInvite(null); }
      },
    });
  };

  const handleInviteResponse = async (inviteId: string, status: 'accepted' | 'declined', teamName?: string) => {
    if (status === 'accepted') {
      setConfirmModal({
        title: `Join ${teamName || 'this team'}?`,
        message: 'Accepting this invite will automatically decline all your other pending invites in this tournament.',
        confirmText: 'Join Team', confirmVariant: 'success',
        onConfirm: async () => { setConfirmModal(null); await doInviteResponse(inviteId, status); },
      });
    } else { await doInviteResponse(inviteId, status); }
  };

  const doInviteResponse = async (inviteId: string, status: 'accepted' | 'declined') => {
    setRespondingInvite(inviteId);
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/invites/${inviteId}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ status }) });
      const data = await res.json();
      if (!res.ok) {
        // Rank ineligible — player is too high rank for Kernel Kup
        if (data.rank_ineligible) {
          setResultModal({
            type: 'error', title: 'Rank Ineligible',
            message: data.error,
            helpText: 'Your rank is above the Herald 1 – Divine 1 eligibility range. You can still participate as a Coach!',
          });
          return;
        }
        // 409 — already on this team's roster (stale invite)
        if (res.status === 409) {
          setResultModal({
            type: 'info', title: 'Already on Roster',
            message: data.error || "You're already on this team's roster.",
          });
          await Promise.all([fetchMyInvites(), fetchTeams(), fetchTournament()]);
          return;
        }
        throw new Error(data.error || 'Failed to respond');
      }
      if (status === 'accepted') {
        setResultModal({ type: 'success', title: 'Welcome to the Team!', message: data.message || "You've joined the team.", helpText: 'All other pending invites have been auto-declined.' });
      } else {
        setResultModal({ type: 'info', title: 'Invite Declined', message: "You've declined this team invite. You can still accept other invites or remain as a free agent." });
      }
      await Promise.all([fetchMyInvites(), fetchTeams(), fetchTournament()]);
    } catch (err: any) {
      setResultModal({ type: 'error', title: 'Action Failed', message: err.message });
    } finally { setRespondingInvite(null); }
  };

  const handleAddSelfToRoster = async (teamId: string) => {
    setConfirmModal({
      title: "Join Your Team's Roster?",
      message: "You'll be added as a playing member of your team. This is separate from being the captain — you can be both captain and player.",
      confirmText: 'Add Me to Roster', confirmVariant: 'success',
      onConfirm: async () => {
        setConfirmModal(null);
        setAddingSelfToRoster(teamId);
        try {
          const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams/${teamId}/roster`, { method: 'POST', headers: authHeaders, body: JSON.stringify({}) });
          const data = await res.json();
          if (!res.ok) {
            // Rank ineligible — player is too high rank for Kernel Kup
            if (data.rank_ineligible) {
              setResultModal({
                type: 'error', title: 'Rank Ineligible',
                message: data.error,
                helpText: 'Your rank is above the Herald 1 – Divine 1 eligibility range for Kernel Kup players. You can participate as a Coach instead!',
              });
              return;
            }
            throw new Error(data.error || 'Failed to add to roster');
          }
          setResultModal({ type: 'success', title: 'Added to Roster!', message: data.message || "You've been added to your team's roster as a player." });
          await Promise.all([fetchTeams(), fetchTournament()]);
          if (teamRosters[teamId]) fetchTeamRoster(teamId);
        } catch (err: any) {
          setResultModal({ type: 'error', title: 'Failed to Join Roster', message: err.message });
        } finally { setAddingSelfToRoster(null); }
      },
    });
  };

  const handleRemoveFromRoster = async (teamId: string, personId: string, personName: string) => {
    setConfirmModal({
      title: `Remove ${personName}?`,
      message: `${personName} will be removed from the roster and returned to the free agent pool.`,
      confirmText: 'Remove', confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams/${teamId}/roster/${personId}`, { method: 'DELETE', headers: authHeaders });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to remove');
          setResultModal({ type: 'info', title: 'Player Removed', message: data.message || `${personName} has been removed from the roster.` });
          await Promise.all([fetchTeams(), fetchTournament()]);
          if (teamRosters[teamId]) fetchTeamRoster(teamId);
        } catch (err: any) {
          setResultModal({ type: 'error', title: 'Removal Failed', message: err.message });
        }
      },
    });
  };

  const handleAssignCoach = async (teamId: string, teamName: string, personId: string, personName: string) => {
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams/${teamId}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ coach_person_id: personId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign coach');
      setResultModal({ type: 'success', title: 'Coach Assigned', message: `${personName} is now the coach of ${teamName}.` });
      await fetchTeams();
    } catch (err: any) {
      setResultModal({ type: 'error', title: 'Coach Assignment Failed', message: err.message });
    }
  };

  const handleRemoveCoach = async (teamId: string, teamName: string) => {
    setConfirmModal({
      title: 'Remove Coach?', message: `Remove the coach from ${teamName}?`,
      confirmText: 'Remove Coach', confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams/${teamId}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ coach_person_id: null }) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to remove coach');
          setResultModal({ type: 'info', title: 'Coach Removed', message: `The coach has been removed from ${teamName}.` });
          await fetchTeams();
        } catch (err: any) {
          setResultModal({ type: 'error', title: 'Removal Failed', message: err.message });
        }
      },
    });
  };

  const handleStaffReview = async (userId: string, status: 'approved' | 'denied', username: string) => {
    const verb = status === 'approved' ? 'Approve' : 'Deny';
    setConfirmModal({
      title: `${verb} ${username}?`,
      message: status === 'approved'
        ? `${username} will be approved as staff for this tournament.`
        : `${username}'s staff application will be denied. They can still register as a player or coach.`,
      confirmText: verb, confirmVariant: status === 'approved' ? 'success' : 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => prev ? { ...prev, loading: true, loadingText: status === 'approved' ? 'Approving...' : 'Denying...' } : null);
        try {
          const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/staff/${userId}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ status }) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to review');
          setConfirmModal(null);
          setResultModal({
            type: status === 'approved' ? 'success' : 'info',
            title: status === 'approved' ? 'Staff Approved!' : 'Application Denied',
            message: `${username} has been ${status}.`,
            helpText: status === 'approved' ? 'They are now part of the tournament staff.' : 'They can still register as a player or coach.',
          });
          await fetchStaffApps();
        } catch (err: any) {
          setConfirmModal(null);
          setResultModal({ type: 'error', title: `${verb} Failed`, message: err.message });
        }
      },
    });
  };

  const handleRemoveStaff = async (userId: string, username: string) => {
    setConfirmModal({
      title: `Remove ${username} from Staff?`,
      message: `This will remove ${username} from staff and clean up any associated registration. They will be notified.`,
      confirmText: 'Remove from Staff', confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => prev ? { ...prev, loading: true, loadingText: 'Removing...' } : null);
        try {
          const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/staff/${userId}`, {
            method: 'DELETE', headers: authHeaders,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to remove');
          setConfirmModal(null);
          setResultModal({
            type: 'success',
            title: 'Staff Removed',
            message: data.message || `${username} has been removed from staff.`,
            helpText: 'They have been notified and can re-apply or register as a player.',
          });
          await Promise.all([fetchTournament(), fetchTeams(), fetchStaffApps()]);
        } catch (err: any) {
          setConfirmModal(null);
          setResultModal({ type: 'error', title: 'Removal Failed', message: err.message });
        }
      },
    });
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    setConfirmModal({
      title: `Withdraw "${teamName}" from Tournament?`,
      message: 'This team will be withdrawn from this tournament. All roster members will be returned to the free agent pool and pending invites will be cancelled. The team itself is not deleted — you can re-add it later from your My Teams page.',
      confirmText: 'Withdraw Team',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => prev ? { ...prev, loading: true, loadingText: 'Withdrawing...' } : null);
        try {
          const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams/${teamId}`, {
            method: 'DELETE', headers: authHeaders,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to withdraw team');
          setConfirmModal(null);
          setTeamRosters(prev => { const next = { ...prev }; delete next[teamId]; return next; });
          setTeamCoachData(prev => { const next = { ...prev }; delete next[teamId]; return next; });
          setTeamInvites(prev => { const next = { ...prev }; delete next[teamId]; return next; });
          setResultModal({
            type: 'success', title: 'Team Withdrawn',
            message: data.message || `Team "${teamName}" has been withdrawn from this tournament.`,
            helpText: 'Players returned to the free agent pool. You can re-register this team later from your My Teams page.',
          });
          await Promise.all([fetchTeams(), fetchTournament(), fetchMyInvites()]);
        } catch (err: any) {
          setConfirmModal(null);
          setResultModal({ type: 'error', title: 'Withdraw Failed', message: err.message });
        }
      },
    });
  };

  // ── Ticket Contribution (Phase 3) ──
  const [settingContribution, setSettingContribution] = useState<string | null>(null); // person_id being toggled

  const handleSetContribution = async (teamId: string, personId: string, tickets: number) => {
    setSettingContribution(personId);
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams/${teamId}/roster/${personId}/contribution`, {
        method: 'PATCH', headers: authHeaders,
        body: JSON.stringify({ tickets }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to set contribution');
      // Refresh roster to reflect updated tickets_contributed
      fetchTeamRoster(teamId);
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSettingContribution(null); }
  };

  const [readyingTeam, setReadyingTeam] = useState(false);

  const handleTeamReady = async (teamId: string, teamName: string) => {
    // New model: total = wallet contributions + TCF+ auto-tickets
    const rosterForConfirm = teamRosters[teamId] || [];
    const ticketsRequired = tournament?.min_team_size || 5;

    // Pre-flight: must have enough players on the roster
    if (rosterForConfirm.length < ticketsRequired) {
      toast.error(`Need at least ${ticketsRequired} players on the roster to lock in — only have ${rosterForConfirm.length}.`);
      return;
    }

    // Count TCF+ auto-tickets (roster + coach)
    const myTeamForReady = teams.find((t: any) => t.id === teamId);
    const coachLinkedUser = teamCoachData[teamId];
    const rosterTcfPlus = rosterForConfirm.filter((r: any) => !!r.linked_user?.tcf_plus_active).length;
    const coachTcfPlus = coachLinkedUser?.tcf_plus_active ? 1 : 0;
    const tcfPlusFreeCount = rosterTcfPlus + coachTcfPlus;
    const isFullyCovered = tcfPlusFreeCount >= ticketsRequired;

    // Sum wallet contributions (roster + coach)
    let totalTicketsFromWallets = 0;
    for (const r of rosterForConfirm) {
      totalTicketsFromWallets += r.tickets_contributed || 0;
    }
    totalTicketsFromWallets += myTeamForReady?.coach_tickets_contributed || 0;

    // Pre-flight checks
    if (isFullyCovered) {
      // Full TCF+ coverage — no wallet tickets allowed
      if (totalTicketsFromWallets > 0) {
        toast.error(`Team is fully covered by TCF+ (${tcfPlusFreeCount} members). Remove all ${totalTicketsFromWallets} wallet ticket(s) before locking in.`);
        return;
      }
    } else {
      const totalContributed = totalTicketsFromWallets + tcfPlusFreeCount;
      if (totalContributed < ticketsRequired) {
        toast.error(`Need ${ticketsRequired} tickets to lock in — only have ${totalContributed} (${tcfPlusFreeCount} free + ${totalTicketsFromWallets} from wallets).`);
        return;
      }
      const walletNeeded = ticketsRequired - tcfPlusFreeCount;
      if (totalTicketsFromWallets > walletNeeded) {
        toast.error(`Too many wallet tickets! Have ${totalTicketsFromWallets} but only ${walletNeeded} needed (${tcfPlusFreeCount} covered by TCF+). Remove ${totalTicketsFromWallets - walletNeeded} excess.`);
        return;
      }
    }

    let confirmMessage = '';
    if (isFullyCovered) {
      confirmMessage = `All ${ticketsRequired} tickets are covered by TCF+ memberships (${tcfPlusFreeCount} TCF+ members) — no wallet tickets will be consumed. This cannot be undone.`;
    } else if (totalTicketsFromWallets > 0 && tcfPlusFreeCount > 0) {
      confirmMessage = `This will consume ${totalTicketsFromWallets} ticket${totalTicketsFromWallets !== 1 ? 's' : ''} from wallets (${tcfPlusFreeCount} free via TCF+). This cannot be undone.`;
    } else if (totalTicketsFromWallets > 0) {
      confirmMessage = `This will consume ${totalTicketsFromWallets} ticket${totalTicketsFromWallets !== 1 ? 's' : ''} from wallets. This cannot be undone.`;
    } else {
      confirmMessage = `All ${tcfPlusFreeCount} tickets are covered by TCF+ — no wallet tickets will be consumed. This cannot be undone.`;
    }

    setConfirmModal({
      title: `Lock In "${teamName}"?`,
      message: confirmMessage,
      confirmText: 'Lock It In',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setConfirmModal(prev => prev ? { ...prev, loading: true, loadingText: 'Locking in...' } : null);
        try {
          const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/teams/${teamId}/ready`, {
            method: 'POST', headers: authHeaders,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to ready team');
          setConfirmModal(null);
          setResultModal({
            type: 'success',
            title: '🔒 Team Locked In!',
            message: data.message || `"${teamName}" is ready for the tournament!`,
            helpText: data.tcf_plus_free > 0
              ? `${data.tickets_deducted} ticket${data.tickets_deducted !== 1 ? 's' : ''} consumed, ${data.tcf_plus_free} free via TCF+.`
              : `${data.tickets_deducted} ticket${data.tickets_deducted !== 1 ? 's' : ''} consumed.`,
          });
          fireLockInConfetti();
          await Promise.all([fetchTeams(), fetchTournament()]);
          fetchTeamRoster(teamId);
        } catch (err: any) {
          setConfirmModal(null);
          setResultModal({ type: 'error', title: 'Ready Failed', message: err.message });
        }
      },
    });
  };

  const handleStatusChange = async (newStatus: string) => {
    const label = getPhaseConfig(newStatus).label || newStatus;
    setConfirmModal({
      title: `Change Status to "${label}"?`,
      message: `This will change the tournament from "${getPhaseConfig(tournament?.status).label}" to "${label}".`,
      confirmText: `Set to ${label}`, confirmVariant: 'primary',
      onConfirm: async () => {
        setConfirmModal(null);
        setChangingStatus(true);
        try {
          const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/status`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ status: newStatus }) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to change status');
          if (data.warnings?.length > 0) {
            setResultModal({ type: 'info', title: 'Status Changed with Warnings', message: data.message, helpText: data.warnings.join('\n') });
          } else { toast.success(data.message); }
          await fetchTournament();
        } catch (err: any) {
          setResultModal({ type: 'error', title: 'Status Change Failed', message: err.message });
        } finally { setChangingStatus(false); }
      },
    });
  };

  // ── Staff Registration ──
  // Staff modal completed — no registration is created until the application is approved.
  // Just refresh data so the pending state shows.
  const handleStaffRegistration = async () => {
    await Promise.all([fetchTournament(), fetchStaffApps()]);
  };

  // ── Staff Application Withdrawal (pending apps only, no registration to clean up) ──
  const handleWithdrawStaffApp = async () => {
    const roleLabel = myStaffApp?.role_preference === 'tournament_director' ? 'Tournament Director' : 'Staff';
    const isApproved = myStaffApp?.status === 'approved';
    const hadPlansToPlay = isApproved && myStaffApp?.plans_to_play && myRegistration;

    // Check if stepping down as TD will also disband a team
    const isCaptainOfTeam = hadPlansToPlay && myTeam != null;
    const teamName = myTeam?.team_name || 'your team';
    const rosterSize = myTeam?.roster_count || 0;
    const teamWarning = isCaptainOfTeam
      ? `\n\n⚠️ You are the captain of "${teamName}"${rosterSize > 0 ? ` (${rosterSize} member${rosterSize !== 1 ? 's' : ''})` : ''}. Stepping down will also disband the team — all roster members will be returned to the free agent pool, the coach will be unassigned, and pending invites will be canceled.`
      : '';

    setConfirmModal({
      title: isCaptainOfTeam ? `Step Down & Disband "${teamName}"?` : (isApproved ? `Step Down as ${roleLabel}?` : 'Withdraw Staff Application?'),
      message: isApproved
        ? hadPlansToPlay
          ? `This will remove you from the ${roleLabel} role and your player registration. You'll return to Choose Your Path.${teamWarning}`
          : `This will remove you from the ${roleLabel} role for this tournament. You can re-apply or choose a different path.`
        : "This will withdraw your pending staff application. You can re-apply or choose a different path.",
      confirmText: isCaptainOfTeam ? 'Step Down & Disband' : (isApproved ? `Step Down` : 'Withdraw Application'), confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => prev ? { ...prev, loading: true, loadingText: 'Withdrawing...' } : null);
        try {
          const res = await fetch(`${apiBase}/kkup/tournaments/${tournamentId}/apply-staff`, { method: 'DELETE', headers: authHeaders });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
          setConfirmModal(null);
          setMyStaffApp(null);
          // Server also cleans up the auto-created player registration for approved TD with plans_to_play
          if (hadPlansToPlay) setMyRegistration(null);
          const disbandedMsg = isCaptainOfTeam
            ? ` Team "${teamName}" has been disbanded and all members returned to the free agent pool.`
            : '';
          setResultModal({
            type: 'success',
            title: isCaptainOfTeam ? `${roleLabel} Removed & Team Disbanded` : (isApproved ? `${roleLabel} Role Removed` : 'Application Withdrawn'),
            message: (data.message || (isApproved ? `You are no longer ${roleLabel} for this tournament.` : 'Your staff application has been withdrawn.')) + disbandedMsg,
            helpText: 'You can re-apply or register as a player/coach.',
          });
          await Promise.all([fetchTournament(), fetchTeams(), fetchMyInvites(), fetchStaffApps()]);
        } catch (err: any) {
          setConfirmModal(null);
          setResultModal({ type: 'error', title: 'Withdrawal Failed', message: err.message });
        }
      },
    });
  };

  // ═══════════════════════════════════════════════════════
  // HELPERS & DERIVED DATA
  // ═══════════════════════════════════════════════════════

  const isUserCaptainOf = (team: any): boolean => {
    if (myRegistration) {
      if (team.captain?.id === myRegistration.person?.id || team.captain_person_id === myRegistration.person_id) return true;
    }
    if (user && team.captain?.user_id === user.id) return true;
    return false;
  };

  const myTeam = teams.find(t => isUserCaptainOf(t) && t.approval_status !== 'denied');
  const freeAgents = registrations?.free_agents || [];
  const onTeamPlayers = registrations?.on_team || [];
  const allPlayers = [...freeAgents, ...onTeamPlayers];
  // Available coaches: registered as 'coach', not already coaching a team
  const coachingPersonIds = new Set(teams.filter(t => t.coach?.id && t.approval_status !== 'withdrawn').map((t: any) => t.coach?.id));
  const availableCoaches = (registrations?.registrations || []).filter((r: any) => r.role === 'coach' && r.status !== 'withdrawn' && !coachingPersonIds.has(r.person?.id));
  // All coaches (for Players tab "Coaches" sub-tab) — includes those already assigned to teams
  const allCoaches = (registrations?.registrations || []).filter((r: any) => r.role === 'coach' && r.status !== 'withdrawn')
    .map((r: any) => {
      // Enrich with team name if coaching a team
      const coachingTeam = teams.find(t => t.coach?.id === r.person?.id && t.approval_status !== 'withdrawn');
      return coachingTeam ? { ...r, coaching_team_name: coachingTeam.team_name } : r;
    });
  const phase = getPhaseConfig(tournament?.status);
  const canRegister = phase.canRegister && !myRegistration;
  // TCF+ Early Access: TCF+ members can register during upcoming (before public registration opens)
  const canRegisterEarly = phase.tcfPlusEarlyAccess && !phase.canRegister && !myRegistration && !!user?.tcf_plus_active;
  // Effective flag: tells the overview & ChooseYourPath whether to show the registration CTA
  const effectiveCanRegister = canRegister || canRegisterEarly;
  const isEarlyAccess = phase.tcfPlusEarlyAccess && !phase.canRegister;
  // Can create team: must have registration as player or coach, no existing team, phase allows it
  const myRole = myRegistration?.role as string | undefined;
  const canCreateTeam = phase.canCreateTeam && !!user && !myTeam && !!myRegistration && (myRole === 'player' || myRole === 'coach');
  const isMutable = isMutableFn(tournament?.status);
  const isRegOpen = isRegOpenFn(tournament?.status);
  const isFinished = isFinishedFn(tournament?.status);
  const approvedTeams = teams.filter(t => t.approval_status === 'approved' || t.approval_status === 'ready');
  const pendingTeams = teams.filter(t => t.approval_status === 'pending_approval');

  // Rank ineligibility for Kernel Kup (Divine 2+ / Immortal can't be player)
  // NOTE: users.rank_id is GUILD rank (1–10), NOT Dota rank. Only use opendota_data.badge_rank.
  const isRankIneligible = (() => {
    if (!user || tournament?.tournament_type !== 'kernel_kup') return false;
    const badgeRank = user.opendota_data?.badge_rank;
    if (!badgeRank?.medal || badgeRank.medal === 'Unranked') return false;
    const rankMedal = badgeRank.medal;
    const rankStars = badgeRank.stars || 0;
    if (rankMedal === 'Immortal') return true;
    if (rankMedal === 'Divine' && rankStars >= 2) return true;
    return false;
  })();

  // ═══════════════════════════════════════════════════════
  // LOADING & ERROR STATES
  // ══════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="px-3 sm:px-4 py-4 min-h-screen bg-silk">
        <div className="max-w-7xl mx-auto flex items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-harvest animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="px-3 sm:px-4 py-4 min-h-screen bg-background">
        <div className="max-w-7xl mx-auto space-y-4">
          <Button onClick={onBack} className="bg-card hover:bg-muted text-foreground border-2 border-border">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Kernel Kup
          </Button>
          <div className="bg-card rounded-3xl border-2 border-[#ef4444]/20 p-12 text-center">
            <AlertCircle className="w-16 h-16 text-[#ef4444] mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Tournament Not Found</h2>
            <p className="text-muted-foreground">{error || 'This tournament could not be loaded.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const statusStyle = getPhaseConfig(tournament.status);

  const getKKupNumber = (t: any): string | null => {
    if (!t) return null;
    const m = t.name?.match(/Kernel Kup (\d+)|KKup (\d+)|KKUP (\d+)/i);
    return m ? (m[1] || m[2] || m[3]) : null;
  };

  const getLeagueAssetUrl = (t: any, assetType: 'banner' | 'large_icon' | 'square_icon'): string | null => {
    if (!t?.name) return null;
    const slug = slugifyTournamentName(t.name);
    if (slug.length < 3) return null;
    const filename = assetType === 'banner' ? 'league_banner.png' : assetType === 'large_icon' ? 'league_large_icon.png' : 'league_square_icon.png';
    return `https://${projectId}.supabase.co/storage/v1/object/public/make-4789f4af-kkup-assets/${slug}/${filename}`;
  };

  const bannerUrl = getLeagueAssetUrl(tournament, 'banner');

  const findPlayerTeam = (reg: any) => {
    if (reg.status !== 'on_team') return null;
    return teams.find(t => t.id === reg.team_id) || null;
  };

  // ═══════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════

  // Phase-aware tabs: finished tournaments get results-focused tabs,
  // pre-tournament phases get lifecycle/management tabs
  // Show bracket tab once it exists or tournament is in roster_lock+ phase
  const showBracketTab = !!bracketData || ['roster_lock', 'live', 'completed', 'archived'].includes(tournament?.status);

  const tabs: { key: typeof activeTab; label: string; color: string }[] = isFinished
    ? [
        { key: 'overview', label: 'Overview', color: 'harvest' },
        ...(showBracketTab ? [{ key: 'bracket' as const, label: 'Bracket', color: '[#d6a615]' }] : []),
        { key: 'teams', label: 'Teams', color: '[#8b5cf6]' },
        { key: 'players', label: 'Players', color: '[#3b82f6]' },
        { key: 'matches', label: 'Matches', color: '[#ef4444]' },
        { key: 'prizes', label: 'Prizes', color: '[#f59e0b]' },
        { key: 'staff', label: 'Staff', color: '[#6366f1]' },
        { key: 'gallery', label: 'Gallery', color: '[#10b981]' },
      ]
    : [
        { key: 'overview', label: 'Overview', color: 'harvest' },
        { key: 'players', label: 'Players', color: '[#3b82f6]' },
        { key: 'teams', label: 'Teams', color: '[#8b5cf6]' },
        ...(showBracketTab ? [{ key: 'bracket' as const, label: 'Bracket', color: '[#d6a615]' }] : []),
        { key: 'prizes', label: 'Prizes', color: '[#f59e0b]' },
        { key: 'staff', label: 'Staff', color: '[#6366f1]' },
      ];

  return (
    <div className="px-3 sm:px-4 py-4 min-h-screen bg-background">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Hero Header — compact, clipped banner with overlaid content */}
        <div
          className={`relative bg-gradient-to-br ${statusStyle.headerGradient} rounded-2xl sm:rounded-3xl overflow-hidden ${statusStyle.headerBreathing ? 'animate-breathing' : ''}`}
          style={{
            height: bannerUrl ? 'auto' : undefined,
            maxHeight: bannerUrl ? '260px' : undefined,
            minHeight: '260px',
            ...(statusStyle.headerBreathing ? { '--breathing-color': `${statusStyle.accentHex}40` } as React.CSSProperties : {}),
          }}
        >
          {/* Banner image — clipped via container maxHeight + object-cover */}
          {bannerUrl && (
            <img
              src={bannerUrl}
              alt={`${tournament.name} banner`}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          {bannerUrl && <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/60" />}
          {!bannerUrl && <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')] opacity-50" />}

          {/* Content overlay — positioned with flex */}
          <div className="relative z-10 flex flex-col justify-between p-4 sm:p-6" style={{ minHeight: '260px' }}>
            {/* Top row: Back button (left) + Title & pills (right) */}
            <div className="flex items-start justify-between gap-3">
              {/* Top-left: Back button */}
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white/80 hover:text-white text-xs font-bold transition-all border border-white/10 flex-shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>

              {/* Top-right: Title + pills + description */}
              <div className="text-right min-w-0 flex-1">
                <div className="flex items-center justify-end gap-2 mb-1.5">
                  <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-white drop-shadow-lg truncate">{tournament.name}</h1>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5 mb-1.5">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm text-white flex items-center gap-1.5 ${isLiveFn(tournament.status) ? 'bg-[#ef4444]/80 animate-pulse' : isRegOpen ? 'bg-[#10b981]/80' : 'bg-white/20'}`}
                    style={statusStyle.cardGlow ? { boxShadow: `0 0 12px ${statusStyle.accentHex}55` } : undefined}
                  >
                    {statusStyle.pingDot && <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />}
                    {statusStyle.icon} {statusStyle.label}
                  </span>
                  {tournament.tournament_type && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm text-white">
                      {tournament.tournament_type === 'kernel_kup' ? '🌽 Kernel Kup' : '🎣 Heaps N Hooks'}
                    </span>
                  )}
                  {tournament.league_id && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-sm text-white">League #{tournament.league_id}</span>
                  )}
                </div>
                {tournament.description && (
                  <p className="text-white/70 text-xs sm:text-sm line-clamp-2 ml-auto max-w-lg">
                    {tournament.description}
                  </p>
                )}
              </div>
            </div>

            {/* Bottom row: Dates/streams (left) + Owner controls (right) */}
            <div className="flex items-end justify-between gap-3 mt-auto">
              {/* Bottom-left: Dates + stream links */}
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {(tournament.registration_start_date || tournament.registration_end_date) && (
                    <div className="flex items-center gap-1.5 text-white/70 text-xs">
                      <UserPlus className="w-3.5 h-3.5 text-white/50" />
                      <span className="font-semibold text-white/90">Reg:</span>
                      <span>{formatDateShort(tournament.registration_start_date)} – {formatDateShort(tournament.registration_end_date)}</span>
                    </div>
                  )}
                  {(tournament.tournament_start_date || tournament.tournament_end_date) && (
                    <div className="flex items-center gap-1.5 text-white/70 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-white/50" />
                      <span className="font-semibold text-white/90">Event:</span>
                      <span>{formatDateShort(tournament.tournament_start_date)} – {formatDateShort(tournament.tournament_end_date)}</span>
                    </div>
                  )}
                </div>
                {(tournament.youtube_url || tournament.twitch_url_1 || tournament.twitch_url_2) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {tournament.youtube_url && (
                      <a href={tournament.youtube_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/30 hover:bg-black/50 backdrop-blur-sm transition-all border border-white/10">
                        <Youtube className="w-3.5 h-3.5 text-white" />
                        <span className="text-[10px] font-bold text-white/90 tracking-wide uppercase">YouTube</span>
                      </a>
                    )}
                    {tournament.twitch_url_1 && (
                      <a href={tournament.twitch_url_1} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/30 hover:bg-black/50 backdrop-blur-sm transition-all border border-white/10">
                        <TwitchIcon className="w-3.5 h-3.5 text-white" />
                        <span className="text-[10px] font-bold text-white/90 tracking-wide uppercase">Stream 1</span>
                      </a>
                    )}
                    {tournament.twitch_url_2 && (
                      <a href={tournament.twitch_url_2} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/30 hover:bg-black/50 backdrop-blur-sm transition-all border border-white/10">
                        <TwitchIcon className="w-3.5 h-3.5 text-white" />
                        <span className="text-[10px] font-bold text-white/90 tracking-wide uppercase">Stream 2</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom-right: Phase arrows (non-archived) + Edit (always) — owner only */}
              {isOwner && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Phase arrows — hidden for archived tournaments */}
                  {tournament.status !== 'archived' && (() => {
                    const normalizedStatus = tournament.status === 'registration' ? 'registration_open'
                      : tournament.status === 'active' ? 'live'
                      : tournament.status;
                    const currentIdx = ALL_PHASES.indexOf(normalizedStatus as any);
                    const prevPhase = currentIdx > 0 ? ALL_PHASES[currentIdx - 1] : null;
                    const nextPhase = currentIdx >= 0 && currentIdx < ALL_PHASES.length - 1 ? ALL_PHASES[currentIdx + 1] : null;
                    const prevConfig = prevPhase ? getPhaseConfig(prevPhase) : null;
                    const nextConfig = nextPhase ? getPhaseConfig(nextPhase) : null;

                    return (
                      <>
                        <div className="relative group">
                          <button
                            onClick={() => prevPhase && handleStatusChange(prevPhase)}
                            disabled={!prevPhase || changingStatus}
                            className={`p-1.5 rounded-lg border backdrop-blur-sm transition-all ${
                              prevPhase
                                ? 'bg-white/20 hover:bg-white/30 border-white/20 text-white hover:scale-105 cursor-pointer'
                                : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                            }`}
                          >
                            {changingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                          </button>
                          {prevConfig && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-soil/95 text-white text-[10px] font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-white/10">
                              {prevConfig.icon} Back to {prevConfig.label}
                            </div>
                          )}
                        </div>

                        <div className="relative group">
                          <button
                            onClick={() => nextPhase && handleStatusChange(nextPhase)}
                            disabled={!nextPhase || changingStatus}
                            className={`p-1.5 rounded-lg border backdrop-blur-sm transition-all ${
                              nextPhase
                                ? 'bg-white/20 hover:bg-white/30 border-white/20 text-white hover:scale-105 cursor-pointer'
                                : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                            }`}
                          >
                            {changingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                          {nextConfig && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-soil/95 text-white text-[10px] font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-white/10">
                              {nextConfig.icon} Advance to {nextConfig.label}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  {/* Edit button — always visible regardless of phase */}
                  <button
                    onClick={() => setShowEditTournament(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-bold text-xs border border-white/20 transition-all hover:scale-105"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-card rounded-xl border-2 border-border p-2">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-sm sm:text-base transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.key
                    ? tab.key === 'players' ? 'bg-[#3b82f6] text-white'
                      : tab.key === 'teams' ? 'bg-[#8b5cf6] text-white'
                      : tab.key === 'staff' ? 'bg-[#6366f1] text-white'
                      : tab.key === 'matches' ? 'bg-[#ef4444] text-white'
                      : tab.key === 'gallery' ? 'bg-[#10b981] text-white'
                      : tab.key === 'bracket' ? 'bg-[#d6a615] text-white'
                      : tab.key === 'prizes' ? 'bg-[#f59e0b] text-white'
                      : 'bg-harvest text-white'
                    : 'bg-transparent text-muted-foreground hover:bg-muted'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content — bracket tab is handled directly in both branches,
            finished tournaments delegate remaining tabs to TournamentHubHistory,
            pre-tournament phases use lifecycle components */}
        {activeTab === 'bracket' ? (
          <TournamentHubBracket
            bracket={bracketData}
            loading={bracketLoading}
            error={bracketError}
            isOwner={isOwner}
            tournamentStatus={tournament?.status || ''}
            onGenerateBracket={handleGenerateBracket}
            onDeleteBracket={handleDeleteBracket}
            onResetChannels={handleResetVoiceChannels}
            onRecordSeriesResult={handleRecordSeriesResult}
            generating={bracketGenerating}
            deleting={bracketDeleting}
          />
        ) : isFinished ? (
          <TournamentHubHistory
            tournamentId={tournamentId}
            tournament={tournament}
            isOwner={isOwner}
            accessToken={accessToken}
            activeTab={activeTab as FinishedTab}
            setActiveTab={setActiveTab}
          />
        ) : (
          <>
            {activeTab === 'overview' && (
              <TournamentHubOverview
                tournament={tournament} statusStyle={statusStyle} registrations={registrations}
                freeAgents={freeAgents} onTeamPlayers={onTeamPlayers}
                approvedTeams={approvedTeams} pendingTeams={pendingTeams}
                user={user} isOwner={isOwner} myRegistration={myRegistration}
                myTeam={myTeam} myInvites={myInvites} myStaffApp={myStaffApp}
                staffApps={staffApps} staffSummary={staffSummary}
                canRegister={effectiveCanRegister} isEarlyAccess={isEarlyAccess}
                canCreateTeam={canCreateTeam}
                isMutable={isMutable} isRegOpen={isRegOpen} isFinished={isFinished}
                handleRegisterWithRole={handleRegisterWithRole} handleWithdraw={handleWithdraw}
                handleSendInvite={handleSendInvite} handleInviteResponse={handleInviteResponse}
                handleStaffReview={handleStaffReview} handleWithdrawStaffApp={handleWithdrawStaffApp}
                registering={registering} withdrawing={withdrawing}
                sendingInvite={sendingInvite} respondingInvite={respondingInvite}
                setActiveTab={setActiveTab} setPlayersSubTab={setPlayersSubTab}
                setSelectedPlayer={setSelectedPlayer} setShowCreateTeam={setShowCreateTeam}
                setShowExistingTeam={setShowExistingTeam}
                setShowStaffModal={setShowStaffModal}
                tournamentId={tournamentId}
                isRankIneligible={isRankIneligible}
              />
            )}
            {activeTab === 'players' && (
              <TournamentHubPlayers
                allPlayers={allPlayers} freeAgents={freeAgents} coaches={allCoaches}
                playersSubTab={playersSubTab} setPlayersSubTab={setPlayersSubTab}
                user={user} myTeam={myTeam} isMutable={isMutable}
                sendingInvite={sendingInvite} handleSendInvite={handleSendInvite}
                setSelectedPlayer={setSelectedPlayer}
                isOfficer={isOfficerUser}
                onRankOverride={handleRankOverride}
              />
            )}
            {activeTab === 'teams' && (
              <>
                <TournamentHubTeams
                  tournament={tournament} teams={teams}
                  approvedTeams={approvedTeams} pendingTeams={pendingTeams} freeAgents={freeAgents} availableCoaches={availableCoaches}
                  user={user} isOwner={isOwner} isMutable={isMutable} canCreateTeam={canCreateTeam}
                  teamRosters={teamRosters} teamCoachData={teamCoachData} expandedTeamId={expandedTeamId}
                  setExpandedTeamId={setExpandedTeamId} fetchTeamRoster={fetchTeamRoster}
                  inviteSearchQuery={inviteSearchQuery} setInviteSearchQuery={setInviteSearchQuery}
                  sendingInvite={sendingInvite} lastInviteSuccess={lastInviteSuccess} addingSelfToRoster={addingSelfToRoster}
                  handleTeamApproval={handleTeamApproval} handleSendInvite={handleSendInvite}
                  handleAddSelfToRoster={handleAddSelfToRoster} handleRemoveFromRoster={handleRemoveFromRoster}
                  handleAssignCoach={handleAssignCoach} handleRemoveCoach={handleRemoveCoach}
                  handleDeleteTeam={handleDeleteTeam}
                  handleSetContribution={handleSetContribution} settingContribution={settingContribution}
                  handleTeamReady={handleTeamReady} readyingTeam={readyingTeam}
                  setActiveTab={setActiveTab} setPlayersSubTab={setPlayersSubTab}
                  setShowCreateTeam={setShowCreateTeam} setShowExistingTeam={setShowExistingTeam}
                  isUserCaptainOf={isUserCaptainOf}
                  teamInvites={teamInvites} cancellingInvite={cancellingInvite}
                  handleCancelInvite={handleCancelInvite}
                  setSelectedPlayer={setSelectedPlayer}
                  isOfficer={isOfficerUser}
                  onRankOverride={handleRankOverride}
                />

              </>
            )}
            {activeTab === 'prizes' && (
              <KKupDetailPrizes
                tournament={{
                  ...tournament,
                  prize_pool: tournament.prize_pool ? String(tournament.prize_pool) : '0',
                  prize_pool_donations: tournament.prize_pool_donations ?? 0,
                }}
                teams={[]}
                playerStats={[]}
                prizeAwards={prizeAwards}
                awardsLoading={awardsLoading}
                isOfficer={isOfficerUser}
                accessToken={accessToken}
              />
            )}
            {activeTab === 'staff' && (
              <TournamentHubStaff
                tournament={tournament}
                staffApps={staffApps}
                myStaffApp={myStaffApp}
                staffSummary={staffSummary}
                user={user}
                isOwner={isOwner}
                isMutable={isMutable}
                myRegistration={myRegistration}
                handleStaffReview={handleStaffReview}
                handleRemoveStaff={handleRemoveStaff}
                setShowStaffModal={setShowStaffModal}
              />
            )}
          </>
        )}
      </div>

      <Footer />

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODALS                                                  */}
      {/* ═══════════════════════════════════════════════════════ */}

      {/* Staff Application Modal */}
      {showStaffModal && (
        <StaffModal
          tournamentId={tournamentId}
          tournamentName={tournament.name}
          accessToken={accessToken}
          onClose={() => setShowStaffModal(false)}
          onApplied={async () => {
            setShowStaffModal(false);
            await handleStaffRegistration();
            fetchStaffApps();
          }}
          setResultModal={setResultModal}
        />
      )}

      {/* Rank Self-Report Modal */}
      {showRankModal && (
        <RankModal
          loading={registering}
          onClose={() => { setShowRankModal(false); setRegistering(false); }}
          onSubmit={(rank) => handleRegisterWithRole('player', rank)}
          submitLabel="Register"
          submitIcon={<UserPlus className="w-5 h-5 mr-2" />}
        />
      )}

      {/* Create Team Modal */}
      {showCreateTeam && (
        <TournamentHubCreateTeamModal
          tournamentId={tournamentId}
          tournamentName={tournament.name}
          tournamentType={tournament.tournament_type || 'kernel_kup'}
          accessToken={accessToken}
          user={user}
          isOwner={isOwner}
          creatorRole={myRegistration?.role === 'coach' ? 'coaching_captain' : 'playing_captain'}
          onClose={() => setShowCreateTeam(false)}
          onCreated={() => { setShowCreateTeam(false); fetchTeams(); }}
          setResultModal={setResultModal}
        />
      )}

      {/* Add Existing Team Modal */}
      {showExistingTeam && (
        <AddExistingTeamModal
          tournamentId={tournamentId}
          tournamentName={tournament.name}
          accessToken={accessToken}
          isOwner={isOwner}
          creatorRole={myRegistration?.role === 'coach' ? 'coaching_captain' : 'playing_captain'}
          onClose={() => setShowExistingTeam(false)}
          onCreated={() => { setShowExistingTeam(false); fetchTeams(); }}
          setResultModal={setResultModal}
        />
      )}

      {/* Edit Tournament Modal */}
      {showEditTournament && tournament && (
        <EditTournamentModal
          tournament={tournament}
          onClose={() => setShowEditTournament(false)}
          onSave={() => { fetchTournament(); }}
          onDeleted={() => { window.location.hash = '#kkup'; }}

        />
      )}

      {/* Player Info Modal — Use the rich UserProfileModal when linked_user exists */}
      {selectedPlayer && selectedPlayer.linked_user?.id && (
        <UserProfileModal
            user={{
              id: selectedPlayer.linked_user.id,
              discord_id: selectedPlayer.linked_user.discord_id || null,
              discord_username: selectedPlayer.linked_user.discord_username || selectedPlayer.person?.display_name || 'Unknown',
              discord_avatar: selectedPlayer.linked_user.discord_avatar || selectedPlayer.person?.avatar_url || null,
              rank_id: selectedPlayer.linked_user.rank_id || 0,
              prestige_level: selectedPlayer.linked_user.prestige_level || 0,
              role: selectedPlayer.linked_user.role || 'player',
              created_at: selectedPlayer.linked_user.created_at || selectedPlayer.registered_at,
              steam_id: selectedPlayer.linked_user.steam_id || selectedPlayer.person?.steam_id || null,
              opendota_data: selectedPlayer.linked_user.opendota_data || (selectedPlayer.linked_user.badge_rank ? { badge_rank: selectedPlayer.linked_user.badge_rank } : undefined),
              ranks: selectedPlayer.linked_user.ranks || { id: selectedPlayer.linked_user.rank_id || 1, name: 'Member', display_order: 1 },
              tcf_plus_active: selectedPlayer.linked_user.tcf_plus_active || false,
              twitch_username: selectedPlayer.linked_user.twitch_username || null,
              twitch_avatar: selectedPlayer.linked_user.twitch_avatar || null,
            }}
            currentUser={user}
            onClose={() => setSelectedPlayer(null)}
            onUpdate={() => {}}
          />
        )}
      {selectedPlayer && !selectedPlayer.linked_user?.id && (
        <PlayerInfoModal
            registration={selectedPlayer}
            team={findPlayerTeam(selectedPlayer)}
            onClose={() => setSelectedPlayer(null)}
            canInvite={!!(myTeam && myTeam.approval_status === 'approved' && isMutable && selectedPlayer.status !== 'on_team')}
            inviteTeamId={myTeam?.id}
            inviteTeamName={myTeam?.team_name}
            sendingInvite={sendingInvite === selectedPlayer.person?.id}
            onInvite={(teamId, personId, personName) => {
              handleSendInvite(teamId, personId, personName);
              setSelectedPlayer(null);
            }}
          />
        )}

      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          confirmVariant={confirmModal.confirmVariant}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
          loading={confirmModal.loading}
          loadingText={confirmModal.loadingText}
          secondaryAction={confirmModal.secondaryAction ? {
            ...confirmModal.secondaryAction,
            onAction: confirmModal.secondaryAction.onAction || (confirmModal as any).onSecondaryAction,
          } : undefined}
        />
      )}

      {/* Result Modal */}
      {resultModal && (
        <SuccessModal
          type={resultModal.type}
          title={resultModal.title}
          message={resultModal.message}
          helpText={resultModal.helpText}
          onClose={() => setResultModal(null)}
        />
      )}

      {/* Officer Rank Override Modal */}
      {rankOverrideTarget && (
        <OfficerRankOverrideModal
          targetUserId={rankOverrideTarget.userId}
          targetDisplayName={rankOverrideTarget.displayName}
          currentMedal={rankOverrideTarget.currentMedal}
          currentStars={rankOverrideTarget.currentStars}
          accessToken={accessToken}
          onClose={() => setRankOverrideTarget(null)}
          onSuccess={handleRankOverrideSuccess}
        />
      )}
    </div>
  );
}