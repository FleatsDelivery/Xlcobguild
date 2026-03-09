/**
 * Profile Page — Settings Tab
 *
 * Contains:
 *   - Membership & Tickets (TCF+ status, ticket balance, Stripe portal)
 *   - Linked Accounts (Discord, Steam, Twitch)
 *   - Appearance (TCF+ gated dark/system modes)
 *   - Recent Activity (last 5 items, fetched by orchestrator)
 *   - Account Details
 *   - Sign Out
 *
 * Receives all data as props from orchestrator.
 */
import { useState } from 'react';
import {
  LogOut, Loader2, Tv, Unlink, Sun, Moon, Monitor, Lock,
  Crown, Ticket, ShoppingBag, Activity, ArrowRight, CreditCard,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { supabase } from '@/lib/supabase';
import { RankBadge } from '@/app/components/rank-badge';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { toast } from 'sonner';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { ConnectOpenDotaModal } from '@/app/components/connect-opendota-modal';
import { SuccessModal } from '@/app/components/success-modal';
import { RankModal } from '@/app/components/tournament-hub-rank-modal';
import { useTheme } from '@/app/components/theme-provider';
import { getActivityConfig } from '@/app/components/inbox-activity-config';
import { timeAgo } from '@/lib/date-utils';
import { createCheckoutSession, openCustomerPortal } from '@/lib/stripe';
import { StripeConnectCard } from '@/app/components/stripe-connect-card';

// ── Shared icon map for activity display ──
import {
  Bell, UserPlus, UserMinus, CheckCircle, XCircle, Star, Gift,
  Trophy, Shield, Archive, Link, Users, Send, Undo2, ShieldAlert,
  Wrench, TrendingUp, UserCog, Heart, Clock, DollarSign, Banknote,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Activity, Bell, UserPlus, UserMinus, CheckCircle, XCircle, Star, Gift,
  Trophy, Shield, Archive, Link, Users, Send, LogOut, Undo2, ShieldAlert,
  Wrench, TrendingUp, ShoppingBag, CreditCard, UserCog, Crown, Heart,
  Ticket, Clock, Lock, DollarSign, Banknote,
};

function getIcon(iconName: string): React.ElementType {
  return ICON_MAP[iconName] || Bell;
}

interface ProfilePageSettingsProps {
  user: any;
  onSignOut: () => void;
  onRefresh?: () => void;
  recentActivity?: any[];
  loadingActivity?: boolean;
}

// ═══════════════════════════════════════════════════════
// PHASE 3: THEME SELECTOR (TCF+ gated)
// ═══════════════════════════════════════════════════════

const THEME_OPTIONS = [
  { value: 'light' as const, icon: Sun, label: 'Light', requiresPlus: false },
  { value: 'dark' as const, icon: Moon, label: 'Dark', requiresPlus: true },
  { value: 'system' as const, icon: Monitor, label: 'System', requiresPlus: true },
];

function ThemeSelector({ isTcfPlus }: { isTcfPlus: boolean }) {
  const { theme, setTheme } = useTheme();

  const handleThemeClick = (value: 'light' | 'dark' | 'system', requiresPlus: boolean) => {
    if (requiresPlus && !isTcfPlus) {
      toast('Dark mode is a TCF+ perk! 🌽', {
        description: 'Upgrade in the Secret Shop to unlock appearance settings.',
        action: {
          label: 'Secret Shop',
          onClick: () => { window.location.hash = '#secret-shop'; },
        },
      });
      return;
    }
    setTheme(value);
  };

  return (
    <div className="bg-card rounded-2xl p-4 sm:p-6 border-2 border-border">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-foreground">Appearance</h2>
        {!isTcfPlus && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-harvest bg-harvest/10 px-2 py-0.5 rounded-full uppercase tracking-wide">
            <Crown className="w-3 h-3" />
            TCF+
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {isTcfPlus ? 'Choose your preferred theme' : 'Dark mode is available with TCF+'}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map(({ value, icon: Icon, label, requiresPlus }) => {
          const isLocked = requiresPlus && !isTcfPlus;
          const isActive = theme === value;

          return (
            <button
              key={value}
              onClick={() => handleThemeClick(value, requiresPlus)}
              className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                isActive && !isLocked
                  ? 'border-harvest bg-harvest/10 text-harvest'
                  : isLocked
                    ? 'border-border bg-muted/50 text-muted-foreground/40 cursor-not-allowed'
                    : 'border-border bg-card text-muted-foreground hover:border-border hover:bg-muted'
              }`}
            >
              {isLocked ? (
                <div className="relative">
                  <Icon className="w-5 h-5 opacity-40" />
                  <Lock className="w-3 h-3 absolute -bottom-0.5 -right-1 text-harvest" />
                </div>
              ) : (
                <Icon className="w-5 h-5" />
              )}
              <span className="text-xs font-bold">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PHASE 1: MEMBERSHIP & TICKETS CARD
// ═══════════════════════════════════════════════════════

function MembershipTicketsCard({ user }: { user: any }) {
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const isTcfPlus = !!user?.tcf_plus_active;
  const ticketBalance = user?.kkup_tickets ?? 0;
  const hasStripeCustomer = !!user?.stripe_customer_id;

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const url = await openCustomerPortal();
      if (!url) throw new Error('No portal URL returned');
      window.location.href = url;
    } catch (err: any) {
      console.error('Customer portal error:', err);
      toast.error(err.message || 'Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCheckout = async (type: string) => {
    setCheckoutLoading(type);
    try {
      const url = await createCheckoutSession({ type });
      window.location.href = url;
    } catch (err: any) {
      console.error(`Checkout error (${type}):`, err);
      toast.error(err.message || 'Failed to start checkout');
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="bg-card rounded-2xl p-4 sm:p-6 border-2 border-border">
      <h2 className="text-lg font-bold text-foreground mb-1">Membership & Tickets</h2>
      <p className="text-xs text-muted-foreground mb-4">Your subscription status and ticket balance</p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* TCF+ Status */}
        <div className={`rounded-xl p-3 sm:p-4 border-2 ${
          isTcfPlus
            ? 'bg-gradient-to-br from-harvest/10 to-kernel-gold/10 border-harvest/30'
            : 'bg-muted/50 border-border'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <Crown className={`w-4 h-4 ${isTcfPlus ? 'text-harvest' : 'text-muted-foreground'}`} />
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">TCF+</span>
          </div>
          {isTcfPlus ? (
            <div>
              <p className="text-sm font-bold text-harvest">Active</p>
              {user?.tcf_plus_expires_at && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Renews {new Date(user.tcf_plus_expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm font-bold text-muted-foreground">Free</p>
          )}
        </div>

        {/* Ticket Balance */}
        <div className="bg-muted/50 rounded-xl p-3 sm:p-4 border-2 border-border">
          <div className="flex items-center gap-2 mb-1">
            <Ticket className="w-4 h-4 text-muted-foreground" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Tickets</span>
          </div>
          <p className="text-2xl font-black text-foreground">{ticketBalance}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Manage Billing — for existing Stripe customers (same tab) */}
        {hasStripeCustomer && (
          <button
            onClick={handleOpenPortal}
            disabled={portalLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-muted text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            {portalLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            Manage Billing
          </button>
        )}
        {/* Get TCF+ — for non-subscribers */}
        {!isTcfPlus && (
          <button
            onClick={() => handleCheckout('tcf_plus')}
            disabled={checkoutLoading === 'tcf_plus'}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-harvest text-silk hover:bg-harvest/90 transition-colors disabled:opacity-50"
          >
            {checkoutLoading === 'tcf_plus' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Crown className="w-4 h-4" />
            )}
            Get TCF+ — $20/yr
          </button>
        )}
        {/* Buy Tickets */}
        <button
          onClick={() => handleCheckout('ticket')}
          disabled={checkoutLoading === 'ticket'}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6]/20 transition-colors disabled:opacity-50"
        >
          {checkoutLoading === 'ticket' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Ticket className="w-4 h-4" />
          )}
          Buy Tickets
        </button>
        {/* Secret Shop link */}
        <button
          onClick={() => { window.location.hash = '#secret-shop'; }}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-harvest/10 text-harvest hover:bg-harvest/20 transition-colors"
        >
          <ShoppingBag className="w-4 h-4" />
          Secret Shop
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PHASE 2: RECENT ACTIVITY PREVIEW
// ═══════════════════════════════════════════════════════

function RecentActivityCard({
  activities,
  loading,
}: {
  activities: any[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-card rounded-2xl p-4 sm:p-6 border-2 border-border">
        <h2 className="text-lg font-bold text-foreground mb-3">Recent Activity</h2>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 p-2">
              <div className="w-8 h-8 bg-muted rounded-lg animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-40 bg-muted rounded animate-pulse" />
                <div className="h-3 w-24 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-card rounded-2xl p-4 sm:p-6 border-2 border-border">
        <h2 className="text-lg font-bold text-foreground mb-3">Recent Activity</h2>
        <div className="text-center py-6">
          <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No activity yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Your recent actions will show up here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl p-4 sm:p-6 border-2 border-border">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-foreground">Recent Activity</h2>
        <button
          onClick={() => { window.location.hash = '#inbox'; }}
          className="flex items-center gap-1 text-xs font-semibold text-harvest hover:text-harvest/80 transition-colors"
        >
          View All
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-1">
        {activities.map((activity: any) => {
          const config = getActivityConfig(activity.type);
          const IconComponent = getIcon(config.icon);
          const hasLink = !!activity.related_url;

          return (
            <div
              key={activity.id}
              className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors ${
                hasLink ? 'cursor-pointer hover:bg-muted/50' : ''
              }`}
              onClick={() => {
                if (hasLink) window.location.hash = activity.related_url!.replace('#', '');
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${config.color}15` }}
              >
                <IconComponent className="w-4 h-4" style={{ color: config.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{activity.title}</p>
                <p className="text-[11px] text-muted-foreground">{timeAgo(activity.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function ProfilePageSettings({ user, onSignOut, onRefresh, recentActivity = [], loadingActivity = false }: ProfilePageSettingsProps) {
  // OpenDota connection state
  const [openDotaModalOpen, setOpenDotaModalOpen] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; title: string; message: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showRankModal, setShowRankModal] = useState(false);
  const [rankSubmitting, setRankSubmitting] = useState(false);

  // Twitch linking state
  const [twitchLinking, setTwitchLinking] = useState(false);
  const [twitchUnlinking, setTwitchUnlinking] = useState(false);
  const [showUnlinkTwitchConfirm, setShowUnlinkTwitchConfirm] = useState(false);

  const isTwitchLinked = !!user?.twitch_id;
  const twitchUsername = user?.twitch_username;
  const twitchAvatar = user?.twitch_avatar;

  // ── Twitch OAuth ──
  const handleLinkTwitch = async () => {
    setTwitchLinking(true);
    try {
      const { data, error } = await supabase.auth.linkIdentity({
        provider: 'twitch',
        options: { redirectTo: window.location.origin + '/#profile' },
      });
      if (error) {
        console.error('Error linking Twitch identity:', error);
        toast.error(`Failed to link Twitch: ${error.message}`);
        setTwitchLinking(false);
      }
    } catch (error: any) {
      console.error('Error linking Twitch:', error);
      toast.error('Failed to initiate Twitch linking. Please try again.');
      setTwitchLinking(false);
    }
  };

  const handleUnlinkTwitch = async () => {
    setTwitchUnlinking(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not signed in');
      const twitchIdentity = authUser.identities?.find((i: any) => i.provider === 'twitch');
      if (twitchIdentity) {
        const { error } = await supabase.auth.unlinkIdentity(twitchIdentity);
        if (error) throw new Error(error.message);
      }
      const refreshedUser = (await supabase.auth.getUser()).data.user;
      if (refreshedUser) {
        await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/auth/discord-callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
          body: JSON.stringify({ user: refreshedUser }),
        });
      }
      toast.success('Twitch account disconnected!');
      if (onRefresh) setTimeout(() => onRefresh(), 500);
    } catch (error: any) {
      console.error('Error unlinking Twitch:', error);
      toast.error(`Failed to disconnect Twitch: ${error.message}`);
    } finally {
      setTwitchUnlinking(false);
      setShowUnlinkTwitchConfirm(false);
    }
  };

  // ── OpenDota ──
  const handleConnectOpenDota = async (opendotaId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in first');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/users/me/opendota`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ opendota_id: opendotaId }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to connect OpenDota account');
      setSyncing(true);
      const syncResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/users/me/opendota/sync`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );
      let rankUnknown = false;
      if (syncResponse.ok) {
        try {
          const syncData = await syncResponse.json();
          rankUnknown = !!syncData.rank_unknown;
        } catch { /* parse error */ }
      } else {
        console.error('Failed to sync OpenDota data');
      }
      setSyncing(false);

      if (rankUnknown) {
        // Steam connected, but rank unknown — prompt self-report
        setShowRankModal(true);
      } else {
        setResult({ type: 'success', title: 'Connected! \u{1F3AE}', message: 'Your OpenDota account has been connected and synced successfully!' });
      }
      if (onRefresh) setTimeout(() => onRefresh(), 1000);
    } catch (error: any) {
      setSyncing(false);
      throw error;
    }
  };

  // ── Rank Self-Report ──
  const handleSelfReportRank = async (medal: string) => {
    setRankSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/users/me/rank/self-report`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ medal }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save rank');
      }

      setShowRankModal(false);
      setResult({
        type: 'success',
        title: 'Connected! \u{1F3AE}',
        message: `Your Steam account is linked and your rank has been set to ${medal}. Officers may review.`,
      });
      if (onRefresh) setTimeout(() => onRefresh(), 800);
    } catch (err: any) {
      console.error('Self-report rank error:', err);
      toast.error(err.message || 'Failed to save rank');
      setShowRankModal(false);
    } finally {
      setRankSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ═══ Phase 1: Membership & Tickets ═══ */}
      <MembershipTicketsCard user={user} />

      {/* ═══ Linked Accounts ═══ */}
      <div className="bg-card rounded-2xl p-4 sm:p-6 border-2 border-border">
        <h2 className="text-lg font-bold text-foreground mb-1">Linked Accounts</h2>
        <p className="text-xs text-muted-foreground mb-4">Manage your connected services and game profiles</p>

        <div className="space-y-3">
          {/* ── Discord ── */}
          <div className="p-4 bg-[#5865F2]/5 border-2 border-[#5865F2]/20 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {user?.discord_avatar ? (
                  <img
                    src={user.discord_avatar.startsWith('http')
                      ? user.discord_avatar
                      : `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png?size=128`}
                    alt="Discord"
                    className="w-11 h-11 rounded-full border-2 border-[#5865F2]/30 object-cover"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-[#5865F2] flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                  </div>
                )}
                <div className="text-left">
                  <p className="text-[11px] font-bold text-[#5865F2] uppercase tracking-wide">Discord</p>
                  <p className="text-sm font-semibold text-foreground">{user?.discord_username || 'Unknown'}</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-[#5865F2] bg-[#5865F2]/10 px-2.5 py-1 rounded-full">Connected</span>
            </div>
          </div>

          {/* ── Steam / OpenDota ── */}
          <div className={`p-4 rounded-2xl border-2 ${user?.steam_id ? 'bg-[#10b981]/5 border-[#10b981]/20' : 'bg-muted/50 border-border'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {user?.opendota_data?.profile?.avatarfull ? (
                  <img
                    src={user.opendota_data.profile.avatarfull}
                    alt="Steam"
                    className="w-11 h-11 rounded-full border-2 border-border object-cover flex-shrink-0"
                  />
                ) : (
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${user?.steam_id ? 'bg-[#10b981]' : 'bg-muted'}`}>
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"/>
                    </svg>
                  </div>
                )}
                <div className="text-left min-w-0">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Steam / OpenDota</p>
                  {user?.steam_id ? (
                    <div>
                      <p className="text-sm font-semibold text-foreground truncate">
                        {user?.opendota_data?.profile?.personaname || `ID: ${user.steam_id}`}
                      </p>
                      {user?.opendota_data?.badge_rank && user.opendota_data.badge_rank.medal !== 'Unranked' && (
                        <RankBadge
                          medal={user.opendota_data.badge_rank.medal}
                          stars={user.opendota_data.badge_rank.stars}
                          size="xs"
                          showLabel
                          showStars
                        />
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Not connected</p>
                  )}
                </div>
              </div>
              {user?.steam_id ? (
                <span className="text-xs font-semibold text-[#10b981] bg-[#10b981]/10 px-2.5 py-1 rounded-full flex-shrink-0">Connected</span>
              ) : (
                <button
                  onClick={() => setOpenDotaModalOpen(true)}
                  className="text-xs font-semibold text-harvest bg-harvest/10 hover:bg-harvest/20 px-3 py-1.5 rounded-full transition-colors cursor-pointer flex-shrink-0"
                >
                  Connect
                </button>
              )}
            </div>
            {/* Expanded Steam details */}
            {user?.steam_id && (
              <div className="mt-3 pt-3 border-t border-[#10b981]/15">
                <div className="flex items-center gap-2 flex-wrap">
                  {user?.opendota_last_synced && (
                    <span className="text-[10px] text-muted-foreground">
                      Synced {new Date(user.opendota_last_synced).toLocaleDateString()}
                    </span>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <button
                      onClick={() => window.open(`https://www.opendota.com/players/${user.steam_id}`, '_blank')}
                      className="text-[10px] font-semibold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 px-2 py-1 rounded-md transition-colors cursor-pointer"
                    >
                      OpenDota
                    </button>
                    <button
                      onClick={() => window.open(`https://www.dotabuff.com/players/${user.steam_id}`, '_blank')}
                      className="text-[10px] font-semibold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 px-2 py-1 rounded-md transition-colors cursor-pointer"
                    >
                      Dotabuff
                    </button>
                    <button
                      onClick={() => {
                        const steamId64 = (BigInt(user.steam_id) + BigInt('76561197960265728')).toString();
                        window.open(`https://steamcommunity.com/profiles/${steamId64}`, '_blank');
                      }}
                      className="text-[10px] font-semibold text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 px-2 py-1 rounded-md transition-colors cursor-pointer"
                    >
                      Steam Profile
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Twitch ── */}
          <div className={`p-4 rounded-2xl border-2 ${twitchUsername ? 'bg-[#9146ff]/5 border-[#9146ff]/20' : 'bg-muted/50 border-border'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {twitchAvatar ? (
                  <img
                    src={twitchAvatar}
                    alt={twitchUsername || 'Twitch'}
                    className="w-11 h-11 rounded-full border-2 border-[#9146ff]/30 object-cover flex-shrink-0"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${twitchUsername ? 'bg-[#9146ff]' : 'bg-muted'}`}>
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                    </svg>
                  </div>
                )}
                <div className="text-left min-w-0">
                  <p className="text-[11px] font-bold text-[#9146ff] uppercase tracking-wide">Twitch</p>
                  {twitchUsername ? (
                    <>
                      <p className="text-sm font-semibold text-foreground truncate">{twitchUsername}</p>
                      <p className="text-[10px] text-muted-foreground">twitch.tv/{twitchUsername}</p>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Not connected</p>
                  )}
                </div>
              </div>
              {twitchUsername ? (
                <span className="text-xs font-semibold text-[#9146ff] bg-[#9146ff]/10 px-2.5 py-1 rounded-full flex-shrink-0">Connected</span>
              ) : (
                <button
                  onClick={handleLinkTwitch}
                  disabled={twitchLinking}
                  className="text-xs font-semibold text-[#9146ff] bg-[#9146ff]/10 hover:bg-[#9146ff]/20 px-3 py-1.5 rounded-full transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
                >
                  {twitchLinking ? 'Linking...' : 'Connect'}
                </button>
              )}
            </div>
            {twitchUsername && (
              <div className="mt-3 pt-3 border-t border-[#9146ff]/15">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.open(`https://twitch.tv/${twitchUsername}`, '_blank')}
                    className="text-[10px] font-semibold text-[#9146ff]/70 hover:text-[#9146ff] bg-[#9146ff]/5 hover:bg-[#9146ff]/10 px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Tv className="w-3 h-3" />
                    View Channel
                  </button>
                  <button
                    onClick={() => setShowUnlinkTwitchConfirm(true)}
                    disabled={twitchUnlinking}
                    className="text-[10px] font-semibold text-red-400 hover:text-red-500 bg-red-500/5 hover:bg-red-500/10 px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50 ml-auto"
                  >
                    {twitchUnlinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />}
                    Disconnect
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Stripe Connect (Prize Payouts) ── */}
          <StripeConnectCard user={user} />
        </div>
      </div>

      {/* ═══ Phase 3: Appearance (TCF+ gated) ═══ */}
      <ThemeSelector isTcfPlus={!!user?.tcf_plus_active} />

      {/* ═══ Phase 2: Recent Activity ═══ */}
      <RecentActivityCard activities={recentActivity} loading={loadingActivity} />

      {/* ═══ Account Details ═══ */}
      <div className="bg-card rounded-2xl p-4 sm:p-6 border-2 border-border">
        <h2 className="text-lg font-bold text-foreground mb-3">Account Details</h2>
        <div className="space-y-0">
          <div className="flex justify-between items-center py-3 border-b border-border">
            <span className="text-muted-foreground text-sm">Discord ID</span>
            <span className="font-mono text-sm text-foreground">{user?.discord_id || 'N/A'}</span>
          </div>
          {user?.steam_id && (
            <div className="flex justify-between items-center py-3 border-b border-border">
              <span className="text-muted-foreground text-sm">Steam ID</span>
              <span className="font-mono text-sm text-foreground">{user.steam_id}</span>
            </div>
          )}
          {user?.twitch_id && (
            <div className="flex justify-between items-center py-3 border-b border-border">
              <span className="text-muted-foreground text-sm">Twitch ID</span>
              <span className="font-mono text-sm text-foreground">{user.twitch_id}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-3 border-b border-border">
            <span className="text-muted-foreground text-sm">Member Since</span>
            <span className="text-sm text-foreground">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-muted-foreground text-sm">Last Updated</span>
            <span className="text-sm text-foreground">
              {user?.updated_at
                ? new Date(user.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ Actions ═══ */}
      <div className="bg-card rounded-2xl p-4 sm:p-6 border-2 border-border">
        <Button
          onClick={onSignOut}
          className="w-full bg-red-500 hover:bg-red-600 text-white h-11 rounded-xl font-semibold"
        >
          <LogOut className="mr-2 h-5 w-5" />
          Sign Out
        </Button>
      </div>

      {/* ── Modals ── */}
      {openDotaModalOpen && (
        <ConnectOpenDotaModal
          onConnect={handleConnectOpenDota}
          onClose={() => setOpenDotaModalOpen(false)}
        />
      )}
      {showRankModal && (
        <RankModal
          loading={rankSubmitting}
          onClose={() => {
            setShowRankModal(false);
            setResult({
              type: 'success',
              title: 'Connected! \u{1F3AE}',
              message: 'Your Steam account is linked! You can set your Dota rank later or during tournament registration.',
            });
          }}
          onSubmit={handleSelfReportRank}
          title="What's Your Dota 2 Rank?"
          subtitle="We couldn't detect your rank from your Steam profile"
          submitLabel="Save Rank"
          showIneligibleWarning={false}
          blockHighRanks={false}
        />
      )}
      {result && (
        <SuccessModal
          type={result.type}
          title={result.title}
          message={result.message}
          onClose={() => setResult(null)}
        />
      )}
      {showUnlinkTwitchConfirm && (
        <ConfirmModal
          title="Disconnect Twitch Account"
          message={`Are you sure you want to disconnect your Twitch account${twitchUsername ? ` (${twitchUsername})` : ''}? Your Twitch info will be removed from your profile.`}
          confirmText={twitchUnlinking ? 'Disconnecting...' : 'Disconnect Twitch'}
          confirmVariant="danger"
          onConfirm={handleUnlinkTwitch}
          onCancel={() => setShowUnlinkTwitchConfirm(false)}
        />
      )}
    </div>
  );
}