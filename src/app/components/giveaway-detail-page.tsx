/**
 * GiveawayDetailPage — Full giveaway view with entry flow, prizes, entrants, winners
 *
 * Orchestrator: fetches detail data, manages entry/leave state, renders sections.
 * Uses semantic tokens for dark mode compatibility.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Gift, ArrowLeft, Users, Trophy, Clock, Loader2, AlertCircle, Check,
  LogOut, Timer, Crown, Star, ChevronDown, ChevronUp, Pencil, Trash2, CheckCircle2,
  Globe, Lock,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { projectId } from '/utils/supabase/info';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { formatDate, timeAgo } from '@/lib/date-utils';
import { isOfficer } from '@/lib/roles';
import { CreateGiveawayModal } from '@/app/components/create-giveaway-modal';
import { DrawWinnerModal } from '@/app/components/draw-winner-modal';
import { ConfirmModal } from '@/app/components/confirm-modal';
import {
  getGiveawayPhaseConfig,
  getPrizeTypeConfig,
  formatPrizeSummary,
  isGiveawayOpen,
  hasWinners,
  PHASE_TRANSITIONS,
  type GiveawayDetail,
  type GiveawayPrize,
  type GiveawayEntry,
  type GiveawayPhase,
} from './giveaway-state-config';

// ══════════════════════════════════════���═══════════════
// COUNTDOWN HOOK
// ═══════════════════════════════════════════════════════

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!targetDate) return;

    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Time\'s up!'); return; }
      const days = Math.floor(diff / 86400000);
      const hrs = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      if (days > 0) setTimeLeft(`${days}d ${hrs}h ${mins}m`);
      else if (hrs > 0) setTimeLeft(`${hrs}h ${mins}m ${secs}s`);
      else setTimeLeft(`${mins}m ${secs}s`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

// ═══════════════════════════════════════════════════════
// PRIZE CARD
// ═══════════════════════════════════════════════════════

function PrizeCard({ prize, rank }: { prize: GiveawayPrize; rank: number }) {
  const config = getPrizeTypeConfig(prize.type);
  const winner = prize.winner_user_id;

  return (
    <div className={`bg-card rounded-xl border-2 border-border p-4 transition-all ${
      prize.fulfilled ? 'opacity-60' : ''
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
          <span className="text-lg">{config.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">
              {rank > 0 ? `#${rank}` : '🎁'}
            </span>
            <h4 className="text-sm font-bold text-foreground truncate font-['Inter']">{prize.title}</h4>
          </div>
          <p className={`text-xs font-semibold mt-0.5 ${config.color}`}>
            {formatPrizeSummary(prize)}
          </p>
          {prize.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{prize.description}</p>
          )}
          {prize.fulfilled && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#10b981] mt-1.5">
              <Check className="w-3 h-3" /> Fulfilled
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ENTRANT ROW
// ═══════════════════════════════════════════════════════

function EntrantRow({ entry }: { entry: GiveawayEntry }) {
  const isWinner = entry.winner_rank !== null && entry.winner_rank !== undefined;

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
      isWinner ? 'bg-harvest/10' : 'hover:bg-muted/50'
    }`}>
      {/* Avatar */}
      {entry.discord_avatar ? (
        <img
          src={entry.discord_avatar}
          alt={entry.discord_username}
          className="w-8 h-8 rounded-full border-2 border-border"
          width={32}
          height={32}
        />
      ) : (
        <div className="w-8 h-8 rounded-full border-2 border-border bg-harvest/15 flex items-center justify-center">
          <span className="text-harvest text-xs font-bold">
            {entry.discord_username?.[0]?.toUpperCase() || '?'}
          </span>
        </div>
      )}

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {entry.discord_username}
        </p>
        <p className="text-[10px] text-muted-foreground">{timeAgo(entry.entered_at)}</p>
      </div>

      {/* Winner badge */}
      {isWinner && (
        <span className="flex items-center gap-1 text-xs font-bold text-harvest bg-harvest/15 px-2 py-0.5 rounded-full">
          <Trophy className="w-3 h-3" />
          #{entry.winner_rank}
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════

interface GiveawayDetailPageProps {
  id: string;
  user?: any;
  accessToken: string;
}

export function GiveawayDetailPage({ id, user, accessToken }: GiveawayDetailPageProps) {
  const [giveaway, setGiveaway] = useState<GiveawayDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [advancingPhase, setAdvancingPhase] = useState(false);
  const [showAllEntrants, setShowAllEntrants] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fulfillingPrize, setFulfillingPrize] = useState<string | null>(null);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const phase = getGiveawayPhaseConfig(giveaway?.status);
  const isOpen = isGiveawayOpen(giveaway?.status);
  const showWinners = hasWinners(giveaway?.status);
  const isAdmin = isOfficer(user?.role);
  const countdown = useCountdown(isOpen ? giveaway?.closes_at ?? null : null);

  const token = accessToken || localStorage.getItem('supabase_token') || '';

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/giveaways/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setGiveaway(data.giveaway);
    } catch (err: any) {
      console.error('Failed to fetch giveaway detail:', err);
      setError(err.message || 'Failed to load giveaway');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    if (id) fetchDetail();
  }, [id, fetchDetail]);

  // ── Entry flow ──
  const handleEnter = async () => {
    try {
      setEntering(true);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/giveaways/${id}/enter`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to enter');

      toast.success('You\'re in! 🎉 Good luck!');
      fetchDetail();
    } catch (err: any) {
      console.error('Enter giveaway error:', err);
      toast.error(err.message || 'Failed to enter giveaway');
    } finally {
      setEntering(false);
    }
  };

  const handleLeave = async () => {
    try {
      setLeaving(true);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/giveaways/${id}/enter`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to leave');

      toast.success('Entry removed');
      fetchDetail();
    } catch (err: any) {
      console.error('Leave giveaway error:', err);
      toast.error(err.message || 'Failed to leave giveaway');
    } finally {
      setLeaving(false);
    }
  };

  // ── Admin: advance phase ──
  const handleAdvancePhase = async (newStatus: string) => {
    try {
      setAdvancingPhase(true);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/giveaways/${id}/status`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');

      toast.success(`Phase advanced to: ${getGiveawayPhaseConfig(newStatus).label}`);
      fetchDetail();
    } catch (err: any) {
      console.error('Advance phase error:', err);
      toast.error(err.message || 'Failed to advance phase');
    } finally {
      setAdvancingPhase(false);
    }
  };

  // ── Admin: draw winners ──
  const handleDraw = async (): Promise<any[]> => {
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/giveaways/${id}/draw`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to draw');

    return data.winners || [];
  };

  // ── Admin: delete giveaway ──
  const handleDelete = async () => {
    try {
      setDeleting(true);
      setShowDeleteConfirm(false);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/giveaways/${id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');

      toast.success('Giveaway deleted');
      window.location.hash = '#giveaways';
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err.message || 'Failed to delete giveaway');
    } finally {
      setDeleting(false);
    }
  };

  // ── Admin: toggle prize fulfillment ──
  const handleToggleFulfill = async (prizeId: string, currentlyFulfilled: boolean) => {
    try {
      setFulfillingPrize(prizeId);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/giveaways/${id}/prizes/${prizeId}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fulfilled: !currentlyFulfilled }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update prize');

      toast.success(currentlyFulfilled ? 'Prize marked as unfulfilled' : 'Prize marked as fulfilled!');
      fetchDetail();
    } catch (err: any) {
      console.error('Fulfill prize error:', err);
      toast.error(err.message || 'Failed to update prize');
    } finally {
      setFulfillingPrize(null);
    }
  };

  // Derived data
  const winners = useMemo(
    () => (giveaway?.entries || []).filter((e) => e.winner_rank !== null && e.winner_rank !== undefined).sort((a, b) => (a.winner_rank || 0) - (b.winner_rank || 0)),
    [giveaway?.entries]
  );

  const entrants = useMemo(
    () => giveaway?.entries || [],
    [giveaway?.entries]
  );

  const displayedEntrants = showAllEntrants ? entrants : entrants.slice(0, 10);

  // Next phase transition for admin controls
  const nextPhases = giveaway?.status
    ? PHASE_TRANSITIONS[giveaway.status as GiveawayPhase] || []
    : [];

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-harvest animate-spin" />
      </div>
    );
  }

  // ── Error ──
  if (error || !giveaway) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-4">
        <AlertCircle className="w-10 h-10 text-error" />
        <p className="text-sm text-muted-foreground text-center">{error || 'Giveaway not found'}</p>
        <Button variant="outline" onClick={() => { window.location.hash = '#giveaways'; }}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Giveaways
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* ── Back button ── */}
        <button
          onClick={() => { window.location.hash = '#giveaways'; }}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Giveaways
        </button>

        {/* ── Header Card ── */}
        <div
          className="bg-card rounded-2xl border-2 border-border overflow-hidden mb-6"
          style={phase.cardGlow ? { boxShadow: phase.cardGlow } : undefined}
        >
          {/* Banner Image */}
          {giveaway.image_url && (
            <div className="w-full h-32 sm:h-40 overflow-hidden">
              <img
                src={giveaway.image_url}
                alt=""
                className="w-full h-full object-cover"
                width={600}
                height={160}
              />
            </div>
          )}

          <div className="p-6 sm:p-8">
            {/* Status + meta row */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${phase.statusPillBg} ${phase.statusPillText} ${phase.pulseStatus ? 'animate-pulse' : ''}`}
                >
                  {phase.pingDot && <span className="w-2 h-2 bg-white rounded-full animate-ping" />}
                  {phase.icon} {phase.label}
                </span>
                {giveaway.visibility === 'public' ? (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#3b82f6]/15 text-[#3b82f6] flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Public
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-muted text-muted-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Members
                  </span>
                )}
              </div>

              {giveaway.creator_username && (
                <span className="text-xs text-muted-foreground">
                  by {giveaway.creator_username} · {timeAgo(giveaway.created_at)}
                </span>
              )}
            </div>

            {/* Title + description */}
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl ${phase.accentBgLight} flex items-center justify-center flex-shrink-0`}>
                <Gift className={`w-6 h-6 ${phase.accentColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-black text-foreground leading-tight font-['Inter']">
                  {giveaway.title}
                </h1>
                {giveaway.description && (
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {giveaway.description}
                  </p>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center flex-wrap gap-3 mt-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-lg">
                <Users className="w-3.5 h-3.5" />
                {giveaway.entry_count} {giveaway.entry_count === 1 ? 'entry' : 'entries'}
              </span>
              <span className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-lg">
                <Trophy className="w-3.5 h-3.5" />
                {giveaway.winner_count} {giveaway.winner_count === 1 ? 'winner' : 'winners'}
              </span>
              {giveaway.closes_at && (
                <span className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-lg">
                  <Clock className="w-3.5 h-3.5" />
                  Closes {formatDate(giveaway.closes_at)}
                </span>
              )}
            </div>

            {/* Countdown */}
            {isOpen && countdown && (
              <div className="mt-5 flex items-center gap-3 bg-[#10b981]/10 rounded-xl px-4 py-3">
                <Timer className="w-5 h-5 text-[#10b981]" />
                <div>
                  <p className="text-xs font-semibold text-[#10b981]">Time Remaining</p>
                  <p className="text-lg font-black text-[#10b981]">{countdown}</p>
                </div>
              </div>
            )}

            {/* ── Entry CTA ── */}
            {isOpen && (
              <div className="mt-6">
                {giveaway.user_entered ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-2 bg-[#10b981]/10 rounded-xl px-4 py-3">
                      <Check className="w-5 h-5 text-[#10b981]" />
                      <span className="text-sm font-bold text-[#10b981]">You're entered! Good luck 🍀</span>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleLeave}
                      disabled={leaving}
                      className="text-error border-error/30 hover:bg-error/10"
                    >
                      {leaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleEnter}
                    disabled={entering}
                    className="w-full bg-[#10b981] hover:bg-[#10b981]/90 text-white text-base py-6 rounded-xl gap-2"
                  >
                    {entering ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Gift className="w-5 h-5" />
                        Enter Giveaway
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Prizes Section ── */}
        {giveaway.prizes && giveaway.prizes.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2 font-['Inter']">
              <Star className="w-4 h-4 text-harvest" />
              Prizes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {giveaway.prizes.map((prize, i) => (
                <PrizeCard key={prize.id} prize={prize} rank={prize.rank || i + 1} />
              ))}
            </div>
          </div>
        )}

        {/* ── Winners Section (drawn/completed) ── */}
        {showWinners && winners.length > 0 && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2 font-['Inter']">
              <Trophy className="w-4 h-4 text-harvest" />
              Winners
            </h2>
            <div className="bg-card rounded-2xl border-2 border-harvest/30 p-4 space-y-1" style={{ boxShadow: '0 0 24px rgba(214, 166, 21, 0.15)' }}>
              {winners.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.15, ease: 'easeOut' }}
                >
                  <EntrantRow entry={entry} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Entrants Section ── */}
        {phase.showEntrants && entrants.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2 font-['Inter']">
              <Users className="w-4 h-4 text-muted-foreground" />
              Entrants ({entrants.length})
            </h2>
            <div className="bg-card rounded-2xl border-2 border-border p-3 space-y-0.5">
              {displayedEntrants.map((entry) => (
                <EntrantRow key={entry.id} entry={entry} />
              ))}

              {entrants.length > 10 && (
                <button
                  onClick={() => setShowAllEntrants(!showAllEntrants)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground py-2 transition-colors"
                >
                  {showAllEntrants ? (
                    <>Show Less <ChevronUp className="w-3.5 h-3.5" /></>
                  ) : (
                    <>Show All ({entrants.length}) <ChevronDown className="w-3.5 h-3.5" /></>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Admin Controls ── */}
        {isAdmin && (
          <div className="bg-card rounded-2xl border-2 border-amber-500/30 p-5 mb-6">
            <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-3 flex items-center gap-2 font-['Inter']">
              <Crown className="w-4 h-4" />
              Officer Controls
            </h3>

            <div className="space-y-3">
              {/* Phase transitions */}
              {nextPhases.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {nextPhases.map((nextStatus) => {
                    const nextConfig = getGiveawayPhaseConfig(nextStatus);

                    // Special: if closed → drawn, use the Draw button instead
                    if (giveaway.status === 'closed' && nextStatus === 'drawn') {
                      return (
                        <Button
                          key={nextStatus}
                          onClick={() => setShowDrawModal(true)}
                          disabled={advancingPhase}
                          className="bg-harvest hover:bg-harvest/90 text-white gap-2"
                        >
                          🎰 Draw Winners
                        </Button>
                      );
                    }

                    return (
                      <Button
                        key={nextStatus}
                        variant="outline"
                        onClick={() => handleAdvancePhase(nextStatus)}
                        disabled={advancingPhase}
                        className="gap-2"
                      >
                        {advancingPhase ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            {nextConfig.icon} Advance to {nextConfig.label}
                          </>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}

              {/* Edit button (draft/open only) */}
              {(giveaway.status === 'draft' || giveaway.status === 'open') && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowEditModal(true)}
                    className="gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit Giveaway
                  </Button>
                </div>
              )}

              {/* Drawn: prize fulfillment toggles */}
              {giveaway.status === 'drawn' && giveaway.prizes && giveaway.prizes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-semibold">
                    Mark prizes as fulfilled, then advance to Completed:
                  </p>
                  {giveaway.prizes.map((prize) => (
                    <div key={prize.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">{getPrizeTypeConfig(prize.type).icon}</span>
                        <span className="text-sm font-semibold text-foreground truncate">{prize.title}</span>
                      </div>
                      <Button
                        size="sm"
                        variant={prize.fulfilled ? 'outline' : 'default'}
                        onClick={() => handleToggleFulfill(prize.id, prize.fulfilled)}
                        disabled={fulfillingPrize === prize.id}
                        className={`gap-1.5 text-xs h-8 ${
                          prize.fulfilled
                            ? 'text-[#10b981] border-[#10b981]/30'
                            : 'bg-[#10b981] hover:bg-[#10b981]/90 text-white'
                        }`}
                      >
                        {fulfillingPrize === prize.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : prize.fulfilled ? (
                          <><CheckCircle2 className="w-3.5 h-3.5" /> Fulfilled</>
                        ) : (
                          <><Check className="w-3.5 h-3.5" /> Mark Fulfilled</>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Delete — available on all phases */}
              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  className="gap-2 text-error border-error/30 hover:bg-error/10"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete Giveaway
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && giveaway && (
        <CreateGiveawayModal
          accessToken={token}
          existingGiveaway={giveaway}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            fetchDetail();
          }}
        />
      )}

      {/* Draw Winner Ceremony Modal */}
      {showDrawModal && giveaway && (
        <DrawWinnerModal
          entrantNames={entrants.map((e) => e.discord_username)}
          onConfirmDraw={handleDraw}
          onClose={() => {
            setShowDrawModal(false);
            fetchDetail();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Giveaway"
          message="Are you sure you want to delete this giveaway? This action cannot be undone."
          confirmText="Delete"
          confirmVariant="danger"
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}