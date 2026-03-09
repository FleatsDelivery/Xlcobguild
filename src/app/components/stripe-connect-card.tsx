/**
 * Stripe Connect Card — Profile Linked Accounts section
 *
 * Shows Connect status and provides onboarding/dashboard buttons.
 * Matches the visual style of the Discord/Steam/Twitch cards in profile-page-settings.
 */
import { useState, useEffect } from 'react';
import { DollarSign, Loader2, ExternalLink, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { getConnectStatus, startOnboarding, getDashboardLink, type ConnectStatus } from '@/lib/connect-api';
import { toast } from 'sonner';

interface StripeConnectCardProps {
  user: any;
}

const STATUS_DISPLAY: Record<string, { label: string; color: string; bg: string; borderColor: string }> = {
  active:               { label: 'Connected',            color: 'text-[#10b981]', bg: 'bg-[#10b981]/5',  borderColor: 'border-[#10b981]/20' },
  pending:              { label: 'Onboarding...',        color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-950/20', borderColor: 'border-amber-200 dark:border-amber-800' },
  pending_verification: { label: 'Verifying...',         color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-950/20', borderColor: 'border-amber-200 dark:border-amber-800' },
  not_connected:        { label: 'Not connected',        color: 'text-muted-foreground', bg: 'bg-muted/50', borderColor: 'border-border' },
};

export function StripeConnectCard({ user }: StripeConnectCardProps) {
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const status = await getConnectStatus();
        setConnectStatus(status);
      } catch (err) {
        console.error('Failed to fetch Connect status:', err);
        // Default to not_connected on error
        setConnectStatus({ status: 'not_connected', account_id: null });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleOnboard = async () => {
    setActionLoading(true);
    try {
      const returnUrl = window.location.href.split('#')[0] + '#profile';
      const result = await startOnboarding(returnUrl, returnUrl);

      if (result.status === 'active') {
        toast.success('Your Stripe account is already connected!');
        setConnectStatus({ status: 'active', account_id: connectStatus?.account_id || null });
      } else if (result.onboarding_url) {
        window.location.href = result.onboarding_url;
      }
    } catch (err: any) {
      console.error('Onboarding error:', err);
      toast.error(err.message || 'Failed to start Stripe onboarding');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDashboard = async () => {
    setActionLoading(true);
    try {
      const result = await getDashboardLink();
      if (result.url) {
        window.open(result.url, '_blank');
      }
    } catch (err: any) {
      console.error('Dashboard link error:', err);
      toast.error(err.message || 'Failed to open Stripe dashboard');
    } finally {
      setActionLoading(false);
    }
  };

  const status = connectStatus?.status || 'not_connected';
  const display = STATUS_DISPLAY[status] || STATUS_DISPLAY.not_connected;
  const isActive = status === 'active';
  const isPending = status === 'pending' || status === 'pending_verification';

  return (
    <div className={`p-4 rounded-2xl border-2 ${display.bg} ${display.borderColor}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
            isActive ? 'bg-[#10b981]' : isPending ? 'bg-amber-500' : 'bg-muted'
          }`}>
            {loading ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <DollarSign className="w-5 h-5 text-white" />
            )}
          </div>
          <div className="text-left min-w-0">
            <p className={`text-[11px] font-bold uppercase tracking-wide ${isActive ? 'text-[#10b981]' : 'text-muted-foreground'}`}>
              Stripe Connect
            </p>
            {loading ? (
              <div className="h-4 w-20 bg-muted rounded animate-pulse mt-0.5" />
            ) : isActive ? (
              <p className="text-sm font-semibold text-foreground">Prize payouts enabled</p>
            ) : isPending ? (
              <p className="text-sm font-semibold text-foreground">Complete onboarding to receive payouts</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Connect to receive prize money</p>
            )}
          </div>
        </div>
        {!loading && (
          isActive ? (
            <span className="text-xs font-semibold text-[#10b981] bg-[#10b981]/10 px-2.5 py-1 rounded-full flex-shrink-0">Connected</span>
          ) : isPending ? (
            <button
              onClick={handleOnboard}
              disabled={actionLoading}
              className="text-xs font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 px-3 py-1.5 rounded-full transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
            >
              {actionLoading ? 'Loading...' : 'Continue'}
            </button>
          ) : (
            <button
              onClick={handleOnboard}
              disabled={actionLoading}
              className="text-xs font-semibold text-harvest bg-harvest/10 hover:bg-harvest/20 px-3 py-1.5 rounded-full transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
            >
              {actionLoading ? 'Loading...' : 'Connect'}
            </button>
          )
        )}
      </div>
      {/* Expanded details for active accounts */}
      {isActive && (
        <div className="mt-3 pt-3 border-t border-[#10b981]/15">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDashboard}
              disabled={actionLoading}
              className="text-[10px] font-semibold text-[#10b981]/70 hover:text-[#10b981] bg-[#10b981]/5 hover:bg-[#10b981]/10 px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
            >
              <ExternalLink className="w-3 h-3" />
              Stripe Dashboard
            </button>
            {connectStatus?.payouts_enabled && (
              <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-[#10b981]" />
                Payouts enabled
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
