/**
 * Payout Manager — Owner-only admin panel for financial disbursement
 *
 * Shows all payout awards with status filtering and disbursement actions.
 * Focuses on "Money Out" — honorary ($0) awards are filtered out.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign, Loader2, Plus, CheckCircle, XCircle, Banknote,
  Clock, Send, Undo2, User, Trophy,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { AwardPayoutModal } from '@/app/components/award-payout-modal';
import {
  getAllAwards, disburseAward, revokeAward,
  formatCents, type PrizeAward,
} from '@/lib/connect-api';
import { toast } from 'sonner';
import { timeAgo } from '@/lib/date-utils';

// ═══════════════════════════════════════════════════════
// STATUS CONFIG
// ═══════════════════════════════════════════════════════

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:   { label: 'Pending',   color: 'text-amber-600',  bg: 'bg-amber-100 dark:bg-amber-900/30',   icon: Clock },
  accepted:  { label: 'Accepted',  color: 'text-blue-600',   bg: 'bg-blue-100 dark:bg-blue-900/30',     icon: CheckCircle },
  paid:      { label: 'Paid',      color: 'text-green-600',  bg: 'bg-green-100 dark:bg-green-900/30',   icon: Banknote },
  declined:  { label: 'Declined',  color: 'text-red-500',    bg: 'bg-red-100 dark:bg-red-900/30',       icon: XCircle },
  revoked:   { label: 'Revoked',   color: 'text-red-500',    bg: 'bg-red-100 dark:bg-red-900/30',       icon: Undo2 },
  unclaimed: { label: 'Unclaimed', color: 'text-slate-500',  bg: 'bg-slate-100 dark:bg-slate-900/30',   icon: Clock },
};

const STATUS_FILTERS = ['all', 'pending', 'accepted', 'paid', 'declined', 'revoked'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export function PayoutManager() {
  const [awards, setAwards] = useState<PrizeAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Modals
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [disburseTarget, setDisburseTarget] = useState<PrizeAward | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PrizeAward | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch
  const fetchAwards = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllAwards();
      // Filter out honorary awards here as requested
      const financialOnly = (data.awards || []).filter((a: PrizeAward) => a.status !== 'honorary');
      setAwards(financialOnly);
    } catch (err: any) {
      console.error('Failed to fetch payouts:', err);
      toast.error(err.message || 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAwards(); }, [fetchAwards]);

  // Filter
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return awards;
    return awards.filter(a => a.status === statusFilter);
  }, [awards, statusFilter]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: awards.length };
    for (const a of awards) {
      counts[a.status] = (counts[a.status] || 0) + 1;
    }
    return counts;
  }, [awards]);

  // Total paid
  const totalPaid = useMemo(() => {
    return awards.filter(a => a.status === 'paid').reduce((sum, a) => sum + a.amount_cents, 0);
  }, [awards]);

  // Actions
  const handleDisburse = async () => {
    if (!disburseTarget) return;
    setActionLoading(disburseTarget.id);
    try {
      const result = await disburseAward(disburseTarget.id);
      toast.success(result.message || 'Payout disbursed!');
      setDisburseTarget(null);
      fetchAwards();
    } catch (err: any) {
      console.error('Disburse error:', err);
      toast.error(err.message || 'Failed to disburse payout');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setActionLoading(revokeTarget.id);
    try {
      const result = await revokeAward(revokeTarget.id);
      toast.success(result.message || 'Payout revoked');
      setRevokeTarget(null);
      fetchAwards();
    } catch (err: any) {
      console.error('Revoke error:', err);
      toast.error(err.message || 'Failed to revoke payout');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBlock label="All-Time Total" value={awards.length} icon={DollarSign} color="text-harvest" />
        <StatBlock label="Pending Acceptance" value={statusCounts.pending || 0} icon={Clock} color="text-amber-500" />
        <StatBlock label="Ready to Pay" value={statusCounts.accepted || 0} icon={Send} color="text-blue-500" />
        <StatBlock label="Total Disbursed" value={formatCents(totalPaid)} icon={Banknote} color="text-green-500" />
      </div>

      {/* ── Actions Bar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/30 p-3 rounded-2xl border border-border/50">
        <Button
          onClick={() => setShowAwardModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white font-bold h-10 px-6 rounded-xl shadow-sm"
        >
          <Plus className="w-5 h-5 mr-2" />
          Award Payout
        </Button>

        {/* Status filter pills */}
        <div className="flex gap-1 overflow-x-auto max-w-full no-scrollbar">
          {STATUS_FILTERS.map((s) => {
            const count = statusCounts[s] || 0;
            const isActive = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap ${
                  isActive
                    ? 'bg-harvest text-white border-harvest shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:border-harvest/40'
                }`}
              >
                {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Payouts List ── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-harvest" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border-2 border-dashed border-border">
          <DollarSign className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-semibold">
            {statusFilter === 'all' ? 'No payouts recorded yet' : `No ${statusFilter} payouts`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((award) => (
            <PayoutRow
              key={award.id}
              award={award}
              actionLoading={actionLoading}
              onDisburse={() => setDisburseTarget(award)}
              onRevoke={() => setRevokeTarget(award)}
            />
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {showAwardModal && (
        <AwardPayoutModal
          onClose={() => setShowAwardModal(false)}
          onSuccess={() => { setShowAwardModal(false); fetchAwards(); }}
        />
      )}

      {disburseTarget && (
        <ConfirmModal
          title="Confirm Payout Disbursement"
          message={`Execute real money transfer? You are sending ${formatCents(disburseTarget.amount_cents)} to ${disburseTarget.recipient?.discord_username || 'this user'} via Stripe Connect.`}
          confirmText={actionLoading ? 'Transferring...' : `Disburse ${formatCents(disburseTarget.amount_cents)}`}
          confirmVariant="primary"
          onConfirm={handleDisburse}
          onCancel={() => setDisburseTarget(null)}
        />
      )}

      {revokeTarget && (
        <ConfirmModal
          title="Revoke Payout"
          message={`Are you sure you want to revoke this ${formatCents(revokeTarget.amount_cents)} payout? The user will be notified of the cancellation.`}
          confirmText="Revoke"
          confirmVariant="danger"
          onConfirm={handleRevoke}
          onCancel={() => setRevokeTarget(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

function StatBlock({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 text-center shadow-sm">
      <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
      <p className="text-lg sm:text-xl font-black text-foreground">{value}</p>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

function PayoutRow({
  award,
  actionLoading,
  onDisburse,
  onRevoke,
}: {
  award: PrizeAward;
  actionLoading: string | null;
  onDisburse: () => void;
  onRevoke: () => void;
}) {
  const config = STATUS_CONFIG[award.status] || STATUS_CONFIG.pending;
  const StatusIcon = config.icon;
  const isLoading = actionLoading === award.id;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-card rounded-2xl border border-border p-4 hover:border-harvest/40 transition-all group">
      {/* Left: user + amount */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Avatar */}
        {award.recipient?.discord_avatar ? (
          <img
            src={award.recipient.discord_avatar}
            alt=""
            className="w-10 h-10 rounded-xl flex-shrink-0 object-cover"
            width={40}
            height={40}
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-harvest/10 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-harvest" />
          </div>
        )}

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-bold text-foreground truncate">
              {award.recipient?.discord_username || 'Unknown User'}
            </p>
            <span className="text-lg font-black text-foreground whitespace-nowrap">
              {formatCents(award.amount_cents)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-semibold">
            <span className="truncate max-w-[200px]" title={award.reason || ''}>
              {award.reason || 'No note provided'}
            </span>
            <span>•</span>
            <span>{timeAgo(award.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Right: status + actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Status badge */}
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight ${config.color} ${config.bg} border border-current/10`}>
          <StatusIcon className="w-3 h-3" />
          {config.label}
        </span>

        {/* Connect status indicator */}
        {(award.status === 'accepted' || award.status === 'pending') && award.recipient?.stripe_connect_status !== 'active' && (
          <span className="text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800/50 whitespace-nowrap" title="User needs to connect Stripe in profile">
            Missing Stripe
          </span>
        )}

        {/* Action buttons */}
        {award.status === 'accepted' && award.recipient?.stripe_connect_status === 'active' && (
          <Button
            size="sm"
            onClick={onDisburse}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold h-8 px-4 rounded-lg shadow-sm"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
            Pay Now
          </Button>
        )}

        {(award.status === 'pending' || award.status === 'accepted') && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRevoke}
            disabled={isLoading}
            className="text-red-500 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-bold h-8 px-4 rounded-lg"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5 mr-1" />}
            Revoke
          </Button>
        )}

        {award.status === 'paid' && award.stripe_transfer_id && (
          <span className="text-[10px] font-mono text-muted-foreground/60 truncate max-w-[80px]" title={award.stripe_transfer_id}>
            {award.stripe_transfer_id.slice(0, 12)}...
          </span>
        )}
      </div>
    </div>
  );
}
