/**
 * Award Master Modal — Unified prize awarding flow
 *
 * Replaces the old AwardChampionshipModal, AwardPopdKernelModal, and AwardPrizeModal.
 * Steps: 1. Pick Tournament → 2. Pick Award Type → 3. Pick Recipients → 4. Review & Submit
 *
 * Supports: Champion, Pop'd Kernel, Match of the Night, Staff Pay, Rampage Bonus, Custom.
 * Players can win multiple awards per tournament (e.g. Champion + Pop'd Kernel).
 * $0 "honorary" awards are supported for historical KKups with no prize pool.
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Crown, Star, Swords, Users, Zap, DollarSign,
  Loader2, Search, ChevronLeft, ChevronRight, Check,
  Trophy, User, AlertCircle, X, CheckCircle, Send,
  PartyPopper, Inbox, XCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { PRIZE_POOL_CONFIG } from '@/app/components/kkup-detail-prizes';
import { createAwardBatch, type CreateAwardBatchParams } from '@/lib/connect-api';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ══════════════════════════════════════════════════════
// AWARD TYPES CONFIG
// ═══════════════════════════════════════════════════════

export const AWARD_TYPES = [
  {
    key: 'champion',
    label: 'KKup Champions',
    shortLabel: 'Champions',
    icon: Crown,
    color: '#d6a615',
    gradient: 'from-yellow-400 to-yellow-500',
    poolKey: 'champion',
    recipientType: 'team' as const,
    description: 'Award the winning team. Each roster member gets a split.',
    place: 1,
  },
  {
    key: 'popd_kernel',
    label: "Pop'd Kernel Award",
    shortLabel: "Pop'd Kernel",
    icon: Star,
    color: '#f59e0b',
    gradient: 'from-amber-400 to-amber-500',
    poolKey: 'popd_kernel',
    recipientType: 'players' as const,
    maxRecipients: 2,
    description: 'Highest KDA of the tournament. Pick 1-2 players.',
  },
  {
    key: 'match_of_the_night',
    label: 'Match of the Night',
    shortLabel: 'MOTN',
    icon: Swords,
    color: '#ef4444',
    gradient: 'from-red-400 to-red-500',
    poolKey: 'match_of_the_night',
    recipientType: 'players' as const,
    description: 'Most exciting match voted by viewers. Split among selected players.',
  },
  {
    key: 'staff',
    label: 'Staff Pay',
    shortLabel: 'Staff',
    icon: Users,
    color: '#6366f1',
    gradient: 'from-indigo-400 to-indigo-500',
    poolKey: 'staff',
    recipientType: 'users' as const,
    description: '$5 per person per day. Pick staff members.',
  },
  {
    key: 'rampage_bonus',
    label: 'Rampage Bonus',
    shortLabel: 'Rampage',
    icon: Zap,
    color: '#10b981',
    gradient: 'from-emerald-400 to-emerald-500',
    poolKey: null,
    recipientType: 'players' as const,
    maxRecipients: 1,
    description: '$1 per rampage. Bonus paid from pocket, not the prize pool.',
  },
  {
    key: 'custom',
    label: 'Custom Award',
    shortLabel: 'Custom',
    icon: DollarSign,
    color: '#8b5cf6',
    gradient: 'from-purple-400 to-purple-500',
    poolKey: null,
    recipientType: 'users' as const,
    maxRecipients: 1,
    description: 'Free-form award. Any user, any amount, any reason.',
  },
] as const;

type AwardTypeKey = typeof AWARD_TYPES[number]['key'];

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface AwardMasterModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface TournamentOption {
  id: string;
  name: string;
  year: number;
  status?: string;
}

interface TeamOption {
  id: string;
  name: string;
  tag?: string;
  logo_url?: string | null;
}

interface PlayerOption {
  id: string;         // kkup_persons.id
  display_name: string;
  steam_id: string;
  user_id?: string;   // users.id (if linked)
}

interface UserOption {
  id: string;
  discord_username: string;
  discord_avatar: string | null;
}

interface RosterMember {
  person_id: string;
  display_name: string;
  steam_id: string;
  user_id?: string;
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export function AwardMasterModal({ onClose, onSuccess }: AwardMasterModalProps) {
  // Step navigation
  const [step, setStep] = useState(1);

  // Step 1: Tournament
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<TournamentOption | null>(null);

  // Step 2: Award type
  const [selectedAwardType, setSelectedAwardType] = useState<AwardTypeKey | null>(null);

  // Existing awards for the selected tournament
  const [existingAwards, setExistingAwards] = useState<any[]>([]);
  const [loadingExistingAwards, setLoadingExistingAwards] = useState(false);

  // Step 3: Recipients
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamOption | null>(null);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<PlayerOption[]>([]);

  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);

  const [playerSearch, setPlayerSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // Step 4: Amount & reason
  const [totalAmountStr, setTotalAmountStr] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Confirmation & success states
  const [showConfirm, setShowConfirm] = useState(false);
  const [successData, setSuccessData] = useState<{
    awardCount: number;
    totalCents: number;
    awardLabel: string;
    tournamentName: string;
    recipientNames: string[];
    linkedCount: number;
    unlinkedCount: number;
    warnings?: string[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const confettiFired = useRef(false);

  // ── Derived ──
  const awardConfig = useMemo(
    () => AWARD_TYPES.find(t => t.key === selectedAwardType) || null,
    [selectedAwardType],
  );

  // Auto-calc pool amount for the selected award type
  const poolAmount = useMemo(() => {
    if (!awardConfig?.poolKey) return 0;
    const poolEntry = PRIZE_POOL_CONFIG.find(p => p.key === awardConfig.poolKey);
    return poolEntry ? poolEntry.baseAmount : 0;
  }, [awardConfig]);

  // Recipients list (unified)
  const recipientsList = useMemo(() => {
    if (awardConfig?.recipientType === 'team') {
      return roster.map(r => ({
        user_id: r.user_id || '',
        person_id: r.person_id,
        name: r.display_name,
      }));
    }
    if (awardConfig?.recipientType === 'players') {
      return selectedPlayers.map(p => ({
        user_id: p.user_id || '',
        person_id: p.id,
        name: p.display_name,
      }));
    }
    return selectedUsers.map(u => ({
      user_id: u.id,
      person_id: undefined,
      name: u.discord_username,
    }));
  }, [awardConfig, roster, selectedPlayers, selectedUsers]);

  const totalAmountCents = useMemo(() => {
    const parsed = parseFloat(totalAmountStr);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100);
  }, [totalAmountStr]);

  const perPersonCents = useMemo(() => {
    if (recipientsList.length === 0) return 0;
    return Math.floor(totalAmountCents / recipientsList.length);
  }, [totalAmountCents, recipientsList.length]);

  const validRecipients = useMemo(
    () => recipientsList.filter(r => r.user_id),
    [recipientsList],
  );

  const unlinkedRecipients = useMemo(
    () => recipientsList.filter(r => !r.user_id),
    [recipientsList],
  );

  // ═══════════════════════════════════════════════════════
  // DATA FETCHING
  // ═══════════════════════════════════════════════════════

  // Fetch tournaments on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } },
        );
        if (!res.ok) throw new Error('Failed to fetch tournaments');
        const data = await res.json();
        setTournaments(data.tournaments || []);
      } catch (err) {
        console.error('Failed to load tournaments:', err);
        toast.error('Failed to load tournaments');
      } finally {
        setLoadingTournaments(false);
      }
    })();
  }, []);

  // Fetch teams when tournament is selected
  useEffect(() => {
    if (!selectedTournament) { setTeams([]); return; }
    (async () => {
      setLoadingTeams(true);
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/${selectedTournament.id}`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } },
        );
        if (!res.ok) throw new Error('Failed to fetch teams');
        const data = await res.json();
        setTeams(data.teams || []);
      } catch (err) {
        console.error('Failed to load teams:', err);
      } finally {
        setLoadingTeams(false);
      }
    })();
  }, [selectedTournament]);

  // Fetch roster when team is selected (for champion awards)
  useEffect(() => {
    if (!selectedTeam || !selectedTournament) { setRoster([]); return; }
    (async () => {
      setLoadingRoster(true);
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${selectedTournament.id}/teams/${selectedTeam.id}/roster`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } },
        );
        if (!res.ok) throw new Error('Failed to fetch roster');
        const data = await res.json();
        const rosterData: RosterMember[] = (data.roster || []).map((r: any) => ({
          person_id: r.person_id || r.id,
          display_name: r.display_name || r.person?.display_name || 'Unknown',
          steam_id: r.steam_id || r.person?.steam_id || '',
          user_id: r.user_id || undefined,
        }));

        // Try to resolve user_ids from steam_ids for members that don't have user_id
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const unresolvedSteamIds = rosterData.filter(r => !r.user_id && r.steam_id).map(r => r.steam_id);
          if (unresolvedSteamIds.length > 0) {
            const usersRes = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/users`,
              { headers: { Authorization: `Bearer ${session.access_token}` } },
            );
            if (usersRes.ok) {
              const usersData = await usersRes.json();
              const usersBySteam: Record<string, string> = {};
              for (const u of (usersData.users || usersData || [])) {
                if (u.steam_id) usersBySteam[u.steam_id] = u.id;
              }
              for (const member of rosterData) {
                if (!member.user_id && member.steam_id && usersBySteam[member.steam_id]) {
                  member.user_id = usersBySteam[member.steam_id];
                }
              }
            }
          }
        }

        setRoster(rosterData);
      } catch (err) {
        console.error('Failed to load roster:', err);
      } finally {
        setLoadingRoster(false);
      }
    })();
  }, [selectedTeam, selectedTournament]);

  // Fetch players when tournament is selected
  useEffect(() => {
    if (!selectedTournament) { setPlayers([]); return; }
    (async () => {
      setLoadingPlayers(true);
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/${selectedTournament.id}/players`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } },
        );
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        const playerData: PlayerOption[] = (data.players || []).map((p: any) => ({
          id: p.id,
          display_name: p.display_name || 'Unknown',
          steam_id: p.steam_id || '',
        }));

        // Resolve user_ids
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const steamIds = playerData.filter(p => p.steam_id).map(p => p.steam_id);
          if (steamIds.length > 0) {
            const usersRes = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/users`,
              { headers: { Authorization: `Bearer ${session.access_token}` } },
            );
            if (usersRes.ok) {
              const usersData = await usersRes.json();
              const usersBySteam: Record<string, string> = {};
              for (const u of (usersData.users || usersData || [])) {
                if (u.steam_id) usersBySteam[u.steam_id] = u.id;
              }
              for (const p of playerData) {
                if (p.steam_id && usersBySteam[p.steam_id]) {
                  p.user_id = usersBySteam[p.steam_id];
                }
              }
            }
          }
        }

        setPlayers(playerData);
      } catch (err) {
        console.error('Failed to load players:', err);
      } finally {
        setLoadingPlayers(false);
      }
    })();
  }, [selectedTournament]);

  // Load all users (for staff/custom)
  const loadUsers = useCallback(async () => {
    if (allUsers.length > 0) return;
    setLoadingUsers(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/users`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setAllUsers((data.users || data || []).map((u: any) => ({
        id: u.id,
        discord_username: u.discord_username || 'Unknown',
        discord_avatar: u.discord_avatar || null,
      })));
    } catch (err) {
      console.error('Failed to load users:', err);
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, [allUsers.length]);

  // When entering step 3 with staff/custom, load users
  useEffect(() => {
    if (step === 3 && (selectedAwardType === 'staff' || selectedAwardType === 'custom')) {
      loadUsers();
    }
  }, [step, selectedAwardType, loadUsers]);

  // Auto-set amount when entering step 4
  useEffect(() => {
    if (step === 4 && totalAmountStr === '' && poolAmount > 0) {
      setTotalAmountStr((poolAmount / 100).toFixed(2));
    }
  }, [step, poolAmount, totalAmountStr]);

  // Auto-generate reason
  useEffect(() => {
    if (step === 4 && !reason && awardConfig && selectedTournament) {
      const autoReason = `${awardConfig.label} — ${selectedTournament.name}`;
      setReason(autoReason);
    }
  }, [step, reason, awardConfig, selectedTournament]);

  // Fetch existing awards for the selected tournament
  useEffect(() => {
    if (!selectedTournament) { setExistingAwards([]); return; }
    (async () => {
      setLoadingExistingAwards(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();

        // Fetch from both sources in parallel:
        // 1. Tournament column awards (championship + pop'd kernel — public, no auth)
        // 2. Prize awards table (all award types — requires officer auth)
        const [legacyRes, prizeRes] = await Promise.all([
          fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/${selectedTournament.id}/awards`,
            { headers: { Authorization: `Bearer ${publicAnonKey}` } },
          ),
          session
            ? fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/connect/awards/tournament/${selectedTournament.id}`,
                { headers: { Authorization: `Bearer ${session.access_token}` } },
              )
            : Promise.resolve(null),
        ]);

        const combined: any[] = [];

        // Parse legacy tournament-column winners
        if (legacyRes.ok) {
          const legacy = await legacyRes.json();
          if (legacy.championship) {
            combined.push({
              role: 'champion',
              source: 'tournament',
              label: legacy.championship.team_name,
              names: [legacy.championship.team_name],
            });
          }
          if (legacy.popdKernelWinners?.length > 0) {
            combined.push({
              role: 'popd_kernel',
              source: 'tournament',
              label: legacy.popdKernelWinners.map((p: any) => p.player_name).join(', '),
              names: legacy.popdKernelWinners.map((p: any) => p.player_name),
            });
          }
        }

        // Parse prize_awards table entries (grouped by role)
        if (prizeRes && prizeRes.ok) {
          const prizeData = await prizeRes.json();
          const awards = prizeData.awards || [];
          const byRole: Record<string, any[]> = {};
          for (const a of awards) {
            if (a.status === 'revoked') continue;
            if (!byRole[a.role]) byRole[a.role] = [];
            byRole[a.role].push(a);
          }

          for (const [role, roleAwards] of Object.entries(byRole)) {
            // Don't duplicate champion/popd_kernel if already from tournament columns
            const alreadyHas = combined.some(c => c.role === role && c.source === 'tournament');
            const names = roleAwards.map((a: any) => a.recipient?.discord_username || 'Unknown');
            const totalCents = roleAwards.reduce((s: number, a: any) => s + (a.amount_cents || 0), 0);

            if (alreadyHas) {
              // Merge: add prize info to existing entry
              const existing = combined.find(c => c.role === role);
              if (existing) {
                existing.totalCents = totalCents;
                existing.count = roleAwards.length;
                existing.status = roleAwards[0]?.status;
                existing.source = 'both';
              }
            } else {
              combined.push({
                role,
                source: 'prize_awards',
                label: names.join(', '),
                names,
                totalCents,
                count: roleAwards.length,
                status: roleAwards[0]?.status,
              });
            }
          }
        }

        setExistingAwards(combined);
      } catch (err) {
        console.error('Failed to load existing awards:', err);
      } finally {
        setLoadingExistingAwards(false);
      }
    })();
  }, [selectedTournament]);

  // ═══════════════════════════════════════════════════════
  // EXISTING AWARDS GROUPED BY ROLE (for step 2 display)
  // ═══════════════════════════════════════════════════════

  const existingAwardsByRole = useMemo(() => {
    const map: Record<string, any> = {};
    for (const a of existingAwards) {
      map[a.role] = a;
    }
    return map;
  }, [existingAwards]);

  const hasAnyExistingAwards = existingAwards.length > 0;

  // ═══════════════════════════════════════════════════════
  // FILTERED LISTS
  // ═══════════════════════════════════════════════════════

  const filteredPlayers = useMemo(() => {
    if (!playerSearch.trim()) return players;
    const q = playerSearch.toLowerCase();
    return players.filter(p => p.display_name.toLowerCase().includes(q));
  }, [players, playerSearch]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return allUsers.slice(0, 20);
    const q = userSearch.toLowerCase();
    return allUsers.filter(u => u.discord_username.toLowerCase().includes(q)).slice(0, 20);
  }, [allUsers, userSearch]);

  // ═══════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════

  const togglePlayer = (player: PlayerOption) => {
    const max = awardConfig?.maxRecipients;
    setSelectedPlayers(prev => {
      const exists = prev.find(p => p.id === player.id);
      if (exists) return prev.filter(p => p.id !== player.id);
      if (max && prev.length >= max) return prev;
      return [...prev, player];
    });
  };

  const toggleUser = (user: UserOption) => {
    const max = awardConfig?.maxRecipients;
    setSelectedUsers(prev => {
      const exists = prev.find(u => u.id === user.id);
      if (exists) return prev.filter(u => u.id !== user.id);
      if (max && prev.length >= max) return prev;
      return [...prev, user];
    });
  };

  const canProceedFromStep3 = useMemo(() => {
    if (awardConfig?.recipientType === 'team') return selectedTeam && roster.length > 0;
    if (awardConfig?.recipientType === 'players') return selectedPlayers.length > 0;
    return selectedUsers.length > 0;
  }, [awardConfig, selectedTeam, roster, selectedPlayers, selectedUsers]);

  // Fire corn confetti (reused from checkout celebration pattern)
  const firePrizeConfetti = useCallback(() => {
    if (confettiFired.current) return;
    confettiFired.current = true;

    const corn = confetti.shapeFromText({ text: '🌽', scalar: 2 });
    const popcorn = confetti.shapeFromText({ text: '🍿', scalar: 2 });
    const trophy = confetti.shapeFromText({ text: '🏆', scalar: 2 });
    const money = confetti.shapeFromText({ text: '💰', scalar: 2 });

    const defaults = {
      gravity: 0.85,
      ticks: 250,
      shapes: [corn, popcorn, trophy, money],
      scalar: 2,
      flat: true,
    };

    // Center burst
    confetti({ ...defaults, particleCount: 40, spread: 90, origin: { y: 0.5 } });

    // Side cannons
    setTimeout(() => {
      confetti({ ...defaults, particleCount: 25, angle: 60, spread: 55, origin: { x: 0, y: 0.6 } });
      confetti({ ...defaults, particleCount: 25, angle: 120, spread: 55, origin: { x: 1, y: 0.6 } });
    }, 150);

    // Follow-up rain
    setTimeout(() => {
      confetti({ ...defaults, particleCount: 20, spread: 130, origin: { y: 0.3 }, gravity: 0.65 });
    }, 400);
  }, []);

  // Step 4 "Award" button → opens confirmation overlay
  const handleShowConfirm = () => {
    setShowConfirm(true);
    setErrorMessage(null);
  };

  // Confirmation "Send Awards" button → fires the API call
  const handleFireAwards = async () => {
    if (!selectedTournament || !selectedAwardType || recipientsList.length === 0) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const params: CreateAwardBatchParams = {
        tournament_id: selectedTournament.id,
        role: selectedAwardType,
        team_id: selectedTeam?.id,
        recipients: recipientsList.map(r => ({
          user_id: r.user_id || undefined,
          person_id: r.person_id,
          amount_cents: perPersonCents,
        })),
        reason: reason.trim() || undefined,
        place: awardConfig?.place,
      };

      const result = await createAwardBatch(params);

      // Transition to success celebration
      setSuccessData({
        awardCount: recipientsList.length,
        totalCents: totalAmountCents,
        awardLabel: awardConfig?.label || 'Award',
        tournamentName: selectedTournament.name,
        recipientNames: recipientsList.map(r => r.name),
        linkedCount: validRecipients.length,
        unlinkedCount: unlinkedRecipients.length,
        warnings: result.errors,
      });

      // Fire confetti after a short delay so the success UI is visible
      setTimeout(() => firePrizeConfetti(), 300);
    } catch (err: any) {
      console.error('Award submit error:', err);
      setErrorMessage(err.message || 'Failed to create awards. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Success "Done" button → notify parent + close
  const handleSuccessDone = () => {
    onSuccess();
  };

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  const stepTitles = ['Select Tournament', 'Award Type', 'Recipients', 'Review & Award'];

  return (
    <>
    <BottomSheetModal onClose={successData ? handleSuccessDone : showConfirm ? undefined : onClose} maxWidth="max-w-2xl">
      <BottomSheetModal.Header gradient="from-harvest/10 to-kernel-gold/10" borderColor="border-harvest/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-harvest to-kernel-gold flex items-center justify-center shadow-md">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Award Prizes</h2>
            <p className="text-xs text-muted-foreground">
              Step {step} of 4 — {stepTitles[step - 1]}
            </p>
          </div>
        </div>

        {/* Step indicator dots */}
        <div className="flex items-center gap-2 mt-3">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step ? 'w-8 bg-harvest' :
                s < step ? 'w-6 bg-harvest/50' : 'w-6 bg-foreground/10'
              }`}
            />
          ))}
        </div>
      </BottomSheetModal.Header>

      <BottomSheetModal.Body>
        {/* ── STEP 1: Tournament ── */}
        {step === 1 && (
          <div className="space-y-3">
            {loadingTournaments ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-harvest" />
              </div>
            ) : (
              <div className="space-y-2">
                {tournaments.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTournament(t);
                      setStep(2);
                      // Reset downstream selections
                      setSelectedAwardType(null);
                      setSelectedTeam(null);
                      setRoster([]);
                      setSelectedPlayers([]);
                      setSelectedUsers([]);
                      setTotalAmountStr('');
                      setReason('');
                    }}
                    className={`w-full flex items-center gap-3 p-3 sm:p-4 rounded-xl border-2 transition-all text-left ${
                      selectedTournament?.id === t.id
                        ? 'border-harvest bg-harvest/10'
                        : 'border-border bg-card hover:border-harvest/40'
                    }`}
                  >
                    <Trophy className="w-5 h-5 text-harvest flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.year}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Award Type ── */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {AWARD_TYPES.map(at => {
                const Icon = at.icon;
                const poolEntry = at.poolKey ? PRIZE_POOL_CONFIG.find(p => p.key === at.poolKey) : null;
                const baseAmount = poolEntry ? `$${(poolEntry.baseAmount / 100).toFixed(0)}` : at.key === 'rampage_bonus' ? '$1/ea' : '---';
                const existing = existingAwardsByRole[at.key];
                const hasExisting = !!existing;

                return (
                  <button
                    key={at.key}
                    onClick={() => {
                      setSelectedAwardType(at.key);
                      setSelectedTeam(null);
                      setRoster([]);
                      setSelectedPlayers([]);
                      setSelectedUsers([]);
                      setTotalAmountStr('');
                      setReason('');
                      setStep(3);
                    }}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center ${
                      hasExisting
                        ? 'border-green-500/40 bg-green-500/5 hover:border-harvest/40'
                        : 'border-border bg-card hover:border-harvest/40'
                    }`}
                  >
                    {/* Awarded badge */}
                    {hasExisting && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                    )}

                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${at.gradient} flex items-center justify-center shadow-md`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{at.shortLabel}</p>
                      <p className="text-xs font-semibold text-muted-foreground">{baseAmount}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Current Winners section */}
            {loadingExistingAwards ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground ml-2">Loading existing awards...</span>
              </div>
            ) : hasAnyExistingAwards ? (
              <div className="bg-card rounded-xl border-2 border-border p-4 mt-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Current Winners
                </p>
                <div className="space-y-2.5">
                  {existingAwards.map(a => {
                    const typeConfig = AWARD_TYPES.find(t => t.key === a.role);
                    const TypeIcon = typeConfig?.icon || Trophy;
                    const typeColor = typeConfig?.color || '#6b7280';
                    const typeLabel = typeConfig?.shortLabel || a.role;

                    return (
                      <div key={a.role} className="flex items-start gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: `${typeColor}15` }}
                        >
                          <TypeIcon className="w-3.5 h-3.5" style={{ color: typeColor }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-muted-foreground">{typeLabel}</p>
                            {a.totalCents > 0 && (
                              <span className="text-[10px] font-bold text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full">
                                {formatDollars(a.totalCents)}
                              </span>
                            )}
                            {a.totalCents === 0 && a.source !== 'tournament' && (
                              <span className="text-[10px] font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded-full">
                                honorary
                              </span>
                            )}
                            {a.status && a.status !== 'honorary' && (
                              <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                {a.status}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-foreground font-semibold truncate mt-0.5">
                            {a.label}
                          </p>
                          {a.count > 1 && (
                            <p className="text-[10px] text-muted-foreground">
                              {a.count} recipient{a.count > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : !loadingExistingAwards && (
              <div className="bg-muted/50 rounded-xl p-3 mt-2 text-center">
                <p className="text-xs text-muted-foreground font-semibold">No awards issued yet for this tournament</p>
              </div>
            )}

            {/* Tournament context */}
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Selected Tournament</p>
              <p className="text-sm font-bold text-foreground">{selectedTournament?.name} ({selectedTournament?.year})</p>
            </div>
          </div>
        )}

        {/* ── STEP 3: Recipients ── */}
        {step === 3 && awardConfig && (
          <div className="space-y-4">
            {/* Description */}
            <p className="text-sm text-muted-foreground">{awardConfig.description}</p>

            {/* TEAM PICKER (champion) */}
            {awardConfig.recipientType === 'team' && (
              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground">Select Winning Team</label>
                {loadingTeams ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-harvest" />
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {teams.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTeam(t)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                          selectedTeam?.id === t.id
                            ? 'border-harvest bg-harvest/10'
                            : 'border-border bg-card hover:border-harvest/40'
                        }`}
                      >
                        <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-bold text-foreground truncate">{t.name}</span>
                        {selectedTeam?.id === t.id && <Check className="w-4 h-4 text-harvest ml-auto flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}

                {/* Roster preview */}
                {selectedTeam && (
                  <div className="bg-muted rounded-xl p-3 mt-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Roster ({loadingRoster ? '...' : roster.length} members)
                    </p>
                    {loadingRoster ? (
                      <Loader2 className="w-4 h-4 animate-spin text-harvest" />
                    ) : (
                      <div className="space-y-1.5">
                        {roster.map(r => (
                          <div key={r.person_id} className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.user_id ? 'bg-green-500' : 'bg-amber-500'}`} />
                            <span className="text-sm text-foreground truncate">{r.display_name}</span>
                            {!r.user_id && (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                No account
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* PLAYER PICKER (popd_kernel, match_of_the_night, rampage_bonus) */}
            {awardConfig.recipientType === 'players' && (
              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground">
                  Select Player{awardConfig.maxRecipients === 1 ? '' : 's'}
                  {awardConfig.maxRecipients ? ` (max ${awardConfig.maxRecipients})` : ''}
                </label>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    placeholder="Search players..."
                    className="pl-9 bg-input-background"
                  />
                </div>

                {loadingPlayers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-harvest" />
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {filteredPlayers.map(p => {
                      const isSelected = selectedPlayers.some(sp => sp.id === p.id);
                      const atMax = awardConfig.maxRecipients && selectedPlayers.length >= awardConfig.maxRecipients && !isSelected;
                      return (
                        <button
                          key={p.id}
                          onClick={() => togglePlayer(p)}
                          disabled={!!atMax}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${
                            isSelected
                              ? 'border-harvest bg-harvest/10'
                              : atMax
                                ? 'border-border bg-muted opacity-50 cursor-not-allowed'
                                : 'border-border bg-card hover:border-harvest/40'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'border-harvest bg-harvest' : 'border-border'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-sm font-semibold text-foreground truncate">{p.display_name}</span>
                          {!p.user_id && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full flex-shrink-0 ml-auto">
                              No account
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* USER PICKER (staff, custom) */}
            {awardConfig.recipientType === 'users' && (
              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground">
                  Select User{awardConfig.maxRecipients === 1 ? '' : 's'}
                </label>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by Discord username..."
                    className="pl-9 bg-input-background"
                    disabled={loadingUsers}
                  />
                  {loadingUsers && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                </div>

                {/* Selected users chips */}
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUsers.map(u => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-harvest/10 border border-harvest/30 text-xs font-bold text-foreground"
                      >
                        {u.discord_username}
                        <button onClick={() => toggleUser(u)} className="hover:text-error transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {filteredUsers.map(u => {
                    const isSelected = selectedUsers.some(su => su.id === u.id);
                    const atMax = awardConfig.maxRecipients && selectedUsers.length >= awardConfig.maxRecipients && !isSelected;
                    return (
                      <button
                        key={u.id}
                        onClick={() => toggleUser(u)}
                        disabled={!!atMax}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${
                          isSelected
                            ? 'border-harvest bg-harvest/10'
                            : atMax
                              ? 'border-border bg-muted opacity-50 cursor-not-allowed'
                              : 'border-border bg-card hover:border-harvest/40'
                        }`}
                      >
                        {u.discord_avatar ? (
                          <img src={u.discord_avatar} alt="" className="w-7 h-7 rounded-full flex-shrink-0" width={28} height={28} />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-harvest/20 flex items-center justify-center flex-shrink-0">
                            <User className="w-3.5 h-3.5 text-harvest" />
                          </div>
                        )}
                        <span className="text-sm font-semibold text-foreground truncate">{u.discord_username}</span>
                        {isSelected && <Check className="w-4 h-4 text-harvest ml-auto flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 4: Review & Amount ── */}
        {step === 4 && awardConfig && (
          <div className="space-y-5">
            {/* Summary banner */}
            <div className={`bg-gradient-to-br ${awardConfig.gradient}/10 rounded-xl p-4 border border-border`}>
              <div className="flex items-center gap-3 mb-2">
                <awardConfig.icon className="w-5 h-5" style={{ color: awardConfig.color }} />
                <div>
                  <p className="text-sm font-bold text-foreground">{awardConfig.label}</p>
                  <p className="text-xs text-muted-foreground">{selectedTournament?.name}</p>
                </div>
              </div>
              {selectedTeam && (
                <p className="text-xs text-muted-foreground mt-1">
                  Team: <span className="font-bold text-foreground">{selectedTeam.name}</span>
                </p>
              )}
            </div>

            {/* Amount input */}
            <div>
              <label className="text-sm font-bold text-foreground mb-1.5 block">
                Total Payout (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={totalAmountStr}
                  onChange={(e) => setTotalAmountStr(e.target.value)}
                  placeholder="0.00"
                  className="pl-8 text-lg font-bold bg-input-background"
                />
              </div>
              {poolAmount > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Base pool allocation: ${(poolAmount / 100).toFixed(2)}
                  {totalAmountCents !== poolAmount && (
                    <span className="text-amber-600 font-semibold"> (custom override)</span>
                  )}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                Set to $0 for honorary (bragging rights only) awards.
              </p>
            </div>

            {/* Reason */}
            <div>
              <label className="text-sm font-bold text-foreground mb-1.5 block">
                Reason <span className="text-muted-foreground font-normal">(auto-generated, editable)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-border bg-input-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-harvest/40 placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Recipients breakdown */}
            <div>
              <p className="text-sm font-bold text-foreground mb-2">
                Recipients ({validRecipients.length}{unlinkedRecipients.length > 0 ? ` + ${unlinkedRecipients.length} without accounts` : ''})
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {recipientsList.map((r, i) => (
                  <div key={r.person_id || r.user_id || i} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.user_id ? 'bg-green-500' : 'bg-amber-500'}`} />
                      <span className="text-sm text-foreground truncate">{r.name}</span>
                    </div>
                    <span className="text-sm font-bold text-foreground flex-shrink-0 ml-2">
                      {totalAmountCents > 0 ? `$${(perPersonCents / 100).toFixed(2)}` : '$0.00'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Warnings */}
            {unlinkedRecipients.length > 0 && totalAmountCents > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                    {unlinkedRecipients.length} recipient{unlinkedRecipients.length > 1 ? 's' : ''} don't have linked Discord accounts.
                    Their awards will be recorded for tournament history, but prize money can't be paid out until they create an account and link their Steam ID. Status will be set to "unclaimed."
                  </p>
                </div>
              </div>
            )}

            {unlinkedRecipients.length > 0 && totalAmountCents === 0 && (
              <div className="bg-muted rounded-xl p-3 border border-border">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground font-semibold">
                    {unlinkedRecipients.length} recipient{unlinkedRecipients.length > 1 ? 's' : ''} don't have accounts — their honorary awards will still be recorded for Hall of Fame and tournament history.
                  </p>
                </div>
              </div>
            )}

            {totalAmountCents === 0 && recipientsList.length > 0 && unlinkedRecipients.length === 0 && (
              <div className="bg-muted rounded-xl p-3 border border-border">
                <p className="text-xs text-muted-foreground font-semibold">
                  This will create <strong>honorary</strong> awards — recorded for the Hall of Fame and tournament history, but no money changes hands.
                </p>
              </div>
            )}
          </div>
        )}
      </BottomSheetModal.Body>

      <BottomSheetModal.Footer>
        <div className="flex gap-3">
          {/* Back button */}
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(s => s - 1)}
              className="flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}

          {step === 1 && (
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          )}

          {/* Forward / Submit */}
          {step === 3 && (
            <Button
              onClick={() => setStep(4)}
              disabled={!canProceedFromStep3}
              className="flex-1 bg-harvest hover:bg-harvest/90 text-white font-bold"
            >
              Review
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}

          {step === 4 && (
            <Button
              onClick={handleShowConfirm}
              disabled={submitting || recipientsList.length === 0}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trophy className="w-4 h-4 mr-2" />
              )}
              {submitting
                ? 'Awarding...'
                : totalAmountCents > 0
                  ? `Award ${formatDollars(totalAmountCents)} to ${recipientsList.length}`
                  : `Award Honorary to ${recipientsList.length}`
              }
            </Button>
          )}
        </div>
      </BottomSheetModal.Footer>
    </BottomSheetModal>

    {/* ═══════════════════════════════════════════════════════
        CONFIRMATION OVERLAY — "Are you sure?"
        ═══════════════════════════════════════════════════════ */}
    <AnimatePresence>
      {showConfirm && !successData && (
        <motion.div
          key="confirm-overlay"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => !submitting && setShowConfirm(false)}
          />

          <motion.div
            className="relative bg-card rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 bg-gradient-to-r from-harvest via-kernel-gold to-harvest" />

            <div className="relative px-6 pt-6 pb-4 text-center overflow-hidden">
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 40%, rgba(214,166,21,0.08) 0%, transparent 60%)' }} />
              <motion.div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: (awardConfig?.color || '#d6a615') + '15', border: `2px solid ${awardConfig?.color || '#d6a615'}30` }}
                initial={{ scale: 0.8, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 14, stiffness: 200 }}
              >
                {awardConfig && <awardConfig.icon className="w-8 h-8" style={{ color: awardConfig.color }} />}
              </motion.div>
              <h3 className="text-xl font-black text-foreground mb-1">Final Check</h3>
              <p className="text-sm text-muted-foreground">
                You're about to send {totalAmountCents > 0 ? <strong className="text-foreground">{formatDollars(totalAmountCents)}</strong> : <strong className="text-foreground">honorary awards</strong>}
              </p>
            </div>

            <div className="px-6 pb-2">
              <div className="rounded-xl p-4 space-y-2.5" style={{ backgroundColor: (awardConfig?.color || '#d6a615') + '08', border: `1px solid ${awardConfig?.color || '#d6a615'}20` }}>
                {[
                  { label: 'Award', value: awardConfig?.label || '' },
                  { label: 'Tournament', value: selectedTournament?.name || '' },
                  ...(selectedTeam ? [{ label: 'Team', value: selectedTeam.name }] : []),
                  { label: 'Recipients', value: `${recipientsList.length} ${recipientsList.length === 1 ? 'person' : 'people'}${totalAmountCents > 0 ? ` × ${formatDollars(perPersonCents)} each` : ''}` },
                  ...(unlinkedRecipients.length > 0 ? [{ label: 'Without accounts', value: `${unlinkedRecipients.length} (still recorded)`, warn: true }] : []),
                ].map((row: any) => (
                  <div key={row.label} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={`font-bold ${row.warn ? 'text-amber-600' : 'text-foreground'}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {errorMessage && (
              <motion.div className="mx-6 mb-2 rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400 font-semibold">{errorMessage}</p>
                </div>
              </motion.div>
            )}

            <div className="px-6 pb-6 pt-3 flex gap-3">
              <button onClick={() => { setShowConfirm(false); setErrorMessage(null); }} disabled={submitting} className="flex-1 py-3 rounded-xl font-bold text-sm text-foreground bg-muted hover:bg-border transition-all disabled:opacity-50">
                Go Back
              </button>
              <button onClick={handleFireAwards} disabled={submitting} className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-green-600 hover:bg-green-700 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><Send className="w-4 h-4" /> Send Awards</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ═══════════════════════════════════════════════════════
        SUCCESS CELEBRATION — confetti + receipt + done
        ═══════════════════════════════════════════════════════ */}
    <AnimatePresence>
      {successData && (
        <motion.div
          key="success-overlay"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />

          <motion.div
            className="relative bg-card rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div className="h-1.5" style={{ background: 'linear-gradient(90deg, #d6a61566, #d6a615, #f1c60f, #d6a615, #d6a61566)' }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, delay: 0.1 }} />

            <div className="relative px-6 pt-8 pb-5 text-center overflow-hidden">
              <motion.div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 40%, rgba(214,166,21,0.12) 0%, transparent 60%)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
              <motion.div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ backgroundColor: '#d6a61515', border: '2px solid #d6a61530' }}
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.15 }}
              >
                <Trophy className="w-10 h-10 text-harvest" />
              </motion.div>
              <motion.h3 className="text-2xl sm:text-3xl font-black text-foreground mb-1.5" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }}>
                Awards Sent!
              </motion.h3>
              <motion.p className="text-sm text-muted-foreground" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4 }}>
                {successData.totalCents > 0
                  ? `${formatDollars(successData.totalCents)} awarded to ${successData.awardCount} ${successData.awardCount === 1 ? 'person' : 'people'}`
                  : `Honorary awards given to ${successData.awardCount} ${successData.awardCount === 1 ? 'person' : 'people'}`}
              </motion.p>
            </div>

            <motion.div className="mx-6 mb-4 rounded-xl p-4 space-y-2.5" style={{ backgroundColor: '#d6a61508', border: '1px solid #d6a61520' }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.4 }}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Receipt</p>
              {[
                { label: 'Award', value: successData.awardLabel },
                { label: 'Tournament', value: successData.tournamentName },
                { label: 'Recipients', value: `${successData.awardCount} ${successData.awardCount === 1 ? 'person' : 'people'}` },
                ...(successData.totalCents > 0 ? [{ label: 'Total', value: formatDollars(successData.totalCents), highlight: true }] : [{ label: 'Type', value: 'Honorary (no payout)' }]),
              ].map((line: any, i) => (
                <motion.div key={line.label} className="flex items-center justify-between text-xs" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.06 }}>
                  <span className="text-muted-foreground">{line.label}</span>
                  <span className={line.highlight ? 'font-black text-foreground text-sm' : 'font-semibold text-muted-foreground'}>{line.value}</span>
                </motion.div>
              ))}
            </motion.div>

            <motion.div className="mx-6 mb-4 flex items-center gap-2.5 rounded-xl p-3" style={{ backgroundColor: '#d6a61506', border: '1px solid #d6a61512' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}>
              <Inbox className="w-4 h-4 flex-shrink-0 text-harvest" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {successData.linkedCount > 0
                  ? `${successData.linkedCount} recipient${successData.linkedCount > 1 ? 's' : ''} will be notified in their inbox.`
                  : 'Awards recorded for tournament history.'}
                {successData.unlinkedCount > 0 && <> {successData.unlinkedCount} without accounts — recorded as unclaimed.</>}
              </p>
            </motion.div>

            {successData.warnings && successData.warnings.length > 0 && (
              <motion.div className="mx-6 mb-4 rounded-xl p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                    <p className="mb-1">{successData.warnings.length} warning{successData.warnings.length > 1 ? 's' : ''}:</p>
                    {successData.warnings.map((w, i) => <p key={i} className="font-normal">{w}</p>)}
                  </div>
                </div>
              </motion.div>
            )}

            <motion.div className="px-6 pb-6 pt-1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.3 }}>
              <button onClick={handleSuccessDone} className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-harvest hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Done
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}