/**
 * Profile Page — Orchestrator
 *
 * Slim orchestrator: profile header card, tab bar, data fetching.
 * Follows the "One Tab = One File" rule.
 *
 * Tabs:
 *   Guild Wars   → profile-page-guild-wars.tsx
 *   Kernel Kup   → profile-page-kernel-kup.tsx
 *   Settings     → profile-page-settings.tsx
 */
import { useState, useEffect, useRef } from 'react';
import { User, Shield, Swords, Settings, Crown, Ticket, Calendar, Gamepad2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { isOfficer, getRoleDisplayName, getRoleBadgeStyle } from '@/lib/roles';
import { getRankDisplay, getMedalColor } from '@/lib/rank-utils';
import { Footer } from '@/app/components/footer';
import { OnboardingChecklist } from '@/app/components/onboarding-checklist';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { ProfilePageGuildWars } from '@/app/components/profile-page-guild-wars';
import { ProfilePageKernelKup } from '@/app/components/profile-page-kernel-kup';
import { ProfilePageSettings } from '@/app/components/profile-page-settings';
import { TcfPlusAvatarRing } from '@/app/components/tcf-plus-avatar-ring';
import { TcfPlusBadge } from '@/app/components/tcf-plus-badge';
import { RankBadge } from '@/app/components/rank-badge';

// ══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

type ProfileTab = 'guild-wars' | 'kernel-kup' | 'settings';

interface ProfilePageProps {
  user: any;
  onboarding?: { mvp_request_count: number; reward_claimed: boolean } | null;
  onRefresh?: () => void;
}

// ═══════════════════════════════════════════════════════
// TAB CONFIG
// ═══════════════════════════════════════════════════════

const TABS: { value: ProfileTab; label: string; icon: typeof Swords }[] = [
  { value: 'settings', label: 'Settings', icon: Settings },
  { value: 'kernel-kup', label: 'Kernel Kup', icon: Crown },
  { value: 'guild-wars', label: 'Guild Wars', icon: Swords },
];

// ═══════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════

function ProfileHeaderSkeleton() {
  return (
    <div className="bg-card rounded-2xl p-5 sm:p-6 border-2 border-border">
      <div className="flex flex-col items-center text-center">
        <div className="w-24 h-24 rounded-full bg-muted animate-pulse mb-3" />
        <div className="h-6 w-36 bg-muted rounded animate-pulse mb-2" />
        <div className="h-5 w-24 bg-muted rounded-full animate-pulse mb-4" />
        <div className="h-4 w-20 bg-muted rounded animate-pulse" />
      </div>
    </div>
  );
}

function TabContentSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl p-5 sm:p-6 border-2 border-border">
        <div className="h-5 w-48 bg-muted rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
      <div className="bg-card rounded-2xl p-5 sm:p-6 border-2 border-border">
        <div className="h-5 w-32 bg-muted rounded animate-pulse mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function ProfilePage({ user, onboarding, onRefresh }: ProfilePageProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('settings');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // --- KKUP stats (fetched once, passed to Kernel Kup tab) ---
  const [kkupStats, setKkupStats] = useState<any>(null);
  const [loadingKkupStats, setLoadingKkupStats] = useState(false);
  const kkupFetchedRef = useRef(false);

  // --- Recent activity (fetched once, passed to Settings tab) ---
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const activityFetchedRef = useRef(false);

  useEffect(() => {
    if (!user?.steam_id || kkupFetchedRef.current) return;
    kkupFetchedRef.current = true;

    const fetchKkupStats = async () => {
      setLoadingKkupStats(true);
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/users/${user.id}/kkup-stats`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } }
        );
        if (!response.ok) {
          console.error('Failed to fetch KKUP stats');
          return;
        }
        const data = await response.json();
        setKkupStats(data);
      } catch (error) {
        console.error('Error fetching KKUP stats:', error);
      } finally {
        setLoadingKkupStats(false);
      }
    };
    fetchKkupStats();
  }, [user?.id, user?.steam_id]);

  // --- Fetch recent activity (last 5 items for Settings tab) ---
  useEffect(() => {
    if (!user?.id || activityFetchedRef.current) return;
    activityFetchedRef.current = true;

    const fetchRecentActivity = async () => {
      setLoadingActivity(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const params = new URLSearchParams({ limit: '5', offset: '0' });
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/user-activity?${params}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (!response.ok) {
          console.error('Failed to fetch recent activity');
          return;
        }
        const data = await response.json();
        setRecentActivity(data.activities || []);
      } catch (error) {
        console.error('Error fetching recent activity:', error);
      } finally {
        setLoadingActivity(false);
      }
    };
    fetchRecentActivity();
  }, [user?.id]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('tcf_current_hash');
    localStorage.removeItem('tcf_redirect_hash');
    window.location.reload();
  };

  const getDisplayRank = () => {
    if (isOfficer(user?.role)) return getRoleDisplayName(user?.role);
    return user?.ranks?.name || 'Earwig';
  };

  return (
    <div className="min-h-screen bg-background px-3 sm:px-4 py-6 sm:py-8">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* ═══ Profile Header Card ═══ */}
        <div className={`rounded-2xl border-2 overflow-hidden ${
          user?.tcf_plus_active
            ? 'border-harvest/40 shadow-[0_0_20px_-4px_rgba(214,166,21,0.15)]'
            : 'border-border'
        }`}>
          {/* Gradient banner */}
          <div className={`h-20 sm:h-24 relative ${
            user?.tcf_plus_active
              ? 'bg-gradient-to-r from-harvest/25 via-kernel-gold/15 to-husk/20'
              : 'bg-gradient-to-r from-harvest/10 via-transparent to-husk/8'
          }`}>
            {/* Subtle dot pattern overlay */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }} />
          </div>

          {/* Main content area */}
          <div className="bg-card px-4 sm:px-6 pb-4 sm:pb-5">
            {/* Avatar — pulled up to overlap the banner */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 -mt-12 sm:-mt-14">
              <div className="flex-shrink-0 self-center sm:self-auto">
                <TcfPlusAvatarRing active={user?.tcf_plus_active} size="lg">
                  {user?.discord_avatar ? (
                    <img
                      src={user.discord_avatar.startsWith('http')
                        ? user.discord_avatar
                        : `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png?size=256`}
                      alt={user.discord_username || 'User'}
                      className="w-24 h-24 rounded-full border-4 border-card object-cover"
                      width={96}
                      height={96}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-muted border-4 border-card flex items-center justify-center">
                      <User className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                </TcfPlusAvatarRing>
              </div>

              {/* Name + badges — beside avatar on desktop, below on mobile */}
              <div className="flex-1 min-w-0 text-center sm:text-left pb-0 sm:pb-1">
                <h1 className="text-xl sm:text-2xl font-black text-foreground truncate">
                  {user?.discord_username || 'Guest User'}
                </h1>

                {/* Badges row */}
                <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start flex-wrap">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border ${getRoleBadgeStyle(user?.role || 'guest').badge}`}>
                    <Shield className="w-3 h-3" />
                    {getRoleDisplayName(user?.role || 'guest')}
                  </div>

                  {/* Guild badge */}
                  {user?.guild && user.guild.name !== 'Unaffiliated' && (
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide text-white"
                      style={{ backgroundColor: user.guild.color }}
                    >
                      {user.guild.tag}
                    </div>
                  )}

                  {user?.tcf_plus_active && <TcfPlusBadge size="sm" />}

                  {(() => {
                    const dotaRank = getRankDisplay(user?.opendota_data?.badge_rank);
                    if (!dotaRank) return null;
                    return (
                      <RankBadge medal={dotaRank.medal} stars={dotaRank.stars} size="sm" showLabel showStars />
                    );
                  })()}
                </div>

                {/* Guild rank + prestige + member since */}
                <p className="text-xs text-muted-foreground mt-1.5">
                  {getDisplayRank()}
                  {user?.prestige_level > 0 && (
                    <span className="text-harvest font-semibold ml-1.5">{'\u2022'} Prestige {user.prestige_level}</span>
                  )}
                  {user?.created_at && (
                    <span className="ml-1.5">{'\u2022'} Joined {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Connected accounts preview */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border justify-center sm:justify-start">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">Linked</span>
              {/* Discord — always connected */}
              <a
                href={`https://discord.com/users/${user?.discord_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative"
              >
                {user?.discord_avatar ? (
                  <img
                    src={user.discord_avatar.startsWith('http')
                      ? user.discord_avatar
                      : `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png?size=64`}
                    alt="Discord"
                    className="w-7 h-7 rounded-full border border-[#5865F2]/25 object-cover transition-all group-hover:scale-110 group-hover:border-[#5865F2]/60 group-hover:shadow-[0_0_8px_rgba(88,101,242,0.3)]"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#5865F2]/10 border border-[#5865F2]/25 flex items-center justify-center transition-all group-hover:scale-110 group-hover:border-[#5865F2]/60 group-hover:shadow-[0_0_8px_rgba(88,101,242,0.3)]">
                    <svg className="w-3.5 h-3.5 text-[#5865F2]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.125-.094.25-.192.372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                  </div>
                )}
              </a>
              {/* Steam */}
              {user?.steam_id ? (
                <a
                  href={`https://steamcommunity.com/profiles/${(BigInt(user.steam_id) + BigInt('76561197960265728')).toString()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative"
                >
                  {user?.opendota_data?.profile?.avatarfull ? (
                    <img
                      src={user.opendota_data.profile.avatarfull}
                      className="w-7 h-7 rounded-full border border-[#10b981]/25 object-cover transition-all group-hover:scale-110 group-hover:border-[#10b981]/60 group-hover:shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                      alt="Steam"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#10b981]/10 border border-[#10b981]/25 flex items-center justify-center transition-all group-hover:scale-110 group-hover:border-[#10b981]/60 group-hover:shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                      <svg className="w-3.5 h-3.5 text-[#10b981]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0z"/>
                      </svg>
                    </div>
                  )}
                </a>
              ) : (
                <div className="w-7 h-7 rounded-full bg-muted/60 border border-border flex items-center justify-center opacity-40">
                  <svg className="w-3.5 h-3.5 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0z"/>
                  </svg>
                </div>
              )}
              {/* Twitch */}
              {user?.twitch_username ? (
                <a
                  href={`https://twitch.tv/${user.twitch_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative"
                >
                  {user?.twitch_avatar ? (
                    <img
                      src={user.twitch_avatar}
                      className="w-7 h-7 rounded-full border border-[#9146ff]/25 object-cover transition-all group-hover:scale-110 group-hover:border-[#9146ff]/60 group-hover:shadow-[0_0_8px_rgba(145,70,255,0.3)]"
                      alt="Twitch"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#9146ff]/10 border border-[#9146ff]/25 flex items-center justify-center transition-all group-hover:scale-110 group-hover:border-[#9146ff]/60 group-hover:shadow-[0_0_8px_rgba(145,70,255,0.3)]">
                      <svg className="w-3.5 h-3.5 text-[#9146ff]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                      </svg>
                    </div>
                  )}
                </a>
              ) : (
                <div className="w-7 h-7 rounded-full bg-muted/60 border border-border flex items-center justify-center opacity-40">
                  <svg className="w-3.5 h-3.5 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
                  </svg>
                </div>
              )}
            </div>

            {/* Quick stats strip */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Ticket className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tickets</span>
                </div>
                <p className="text-lg sm:text-xl font-black text-foreground">{user?.kkup_tickets ?? 0}</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Gamepad2 className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Dota</span>
                </div>
                <p className="text-lg sm:text-xl font-black text-foreground">
                  {(() => {
                    const rank = getRankDisplay(user?.opendota_data?.badge_rank);
                    if (!rank) return <span className="text-muted-foreground text-sm">—</span>;
                    return (
                      <span className="flex items-center justify-center gap-1">
                        <RankBadge medal={rank.medal} stars={rank.stars} size="md" />
                      </span>
                    );
                  })()}
                </p>
              </div>
              <div className="bg-muted/50 rounded-xl p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Joined</span>
                </div>
                <p className="text-sm sm:text-base font-black text-foreground">
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Onboarding Checklist (compact, shows when incomplete) */}
        <OnboardingChecklist
          user={user}
          onboarding={onboarding ?? null}
          onRefresh={onRefresh ? async () => { onRefresh(); } : undefined}
          variant="compact"
        />

        {/* ═══ Tab Bar ═══ */}
        <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
          <div className="flex">
            {TABS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-3 font-bold text-xs sm:text-sm transition-colors ${
                  activeTab === value
                    ? 'bg-harvest text-white'
                    : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ Tab Content ═══ */}
        {activeTab === 'guild-wars' && (
          <ProfilePageGuildWars
            user={user}
            onSignOut={() => setShowLogoutConfirm(true)}
            onRefresh={onRefresh ? async () => { onRefresh(); } : undefined}
          />
        )}
        {activeTab === 'kernel-kup' && (
          <ProfilePageKernelKup
            user={user}
            kkupStats={kkupStats}
            loadingKkupStats={loadingKkupStats}
            onSignOut={() => setShowLogoutConfirm(true)}
          />
        )}
        {activeTab === 'settings' && (
          <ProfilePageSettings
            user={user}
            onSignOut={() => setShowLogoutConfirm(true)}
            onRefresh={onRefresh}
            recentActivity={recentActivity}
            loadingActivity={loadingActivity}
          />
        )}
      </div>

      <Footer />

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <ConfirmModal
          title="Sign Out"
          message="Are you sure you want to sign out? You'll need to log in with Discord again to access your account."
          confirmText="Sign Out"
          cancelText="Stay Logged In"
          confirmVariant="danger"
          onConfirm={handleSignOut}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  );
}

export default ProfilePage;