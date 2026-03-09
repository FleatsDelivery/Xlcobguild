import { useState } from 'react';
import { Shield, Settings, Trophy, RefreshCw, Gamepad2, Upload, Loader2, AlertTriangle, ChevronRight, Gift, Users, Bell, Swords, DollarSign, Radio } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { Footer } from '@/app/components/footer';
import { AwardMasterModal } from '@/app/components/award-master-modal';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { UserManagement } from '@/app/components/user-management';
import { RoleManagement } from '@/app/components/role-management';
import { GiveawayManager } from '@/app/components/giveaway-manager';
import { OfficerNotificationManager } from '@/app/components/officer-notification-manager';
import { OfficerTeamManager } from '@/app/components/officer-team-manager';
import { OfficerRankConfig } from '@/app/components/officer-rank-config';
import { PrizeManager } from '@/app/components/prize-manager';
import { toast } from 'sonner';
import { isOfficer } from '@/lib/roles';

interface OfficerPageProps {
  user: any;
  onRefresh?: () => void;
}

// ── TOC Section Config — ordered per spec ──
const TOC_SECTIONS = [
  { id: 'admin-tools', label: 'Admin Tools', icon: Settings, color: 'text-harvest', bg: 'bg-harvest/10', ownerOnly: false },
  { id: 'prize-manager', label: 'Prizes', icon: DollarSign, color: 'text-[#10b981]', bg: 'bg-[#10b981]/10', ownerOnly: true },
  { id: 'user-management', label: 'User Manager', icon: Users, color: 'text-[#3b82f6]', bg: 'bg-[#3b82f6]/10', ownerOnly: true },
  { id: 'guild-manager', label: 'Guilds', icon: Shield, color: 'text-[#6366f1]', bg: 'bg-[#6366f1]/10', ownerOnly: true },
  { id: 'team-manager', label: 'Teams', icon: Swords, color: 'text-[#8b5cf6]', bg: 'bg-[#8b5cf6]/10', ownerOnly: false },
  { id: 'giveaway-manager', label: 'Giveaways', icon: Gift, color: 'text-[#10b981]', bg: 'bg-[#10b981]/10', ownerOnly: true },
  { id: 'notification-manager', label: 'Notifications', icon: Bell, color: 'text-[#ec4899]', bg: 'bg-[#ec4899]/10', ownerOnly: true },
];

export function OfficerPage({ user, onRefresh }: OfficerPageProps) {
  // State for admin modals
  const [showAwardMasterModal, setShowAwardMasterModal] = useState(false);

  // State for admin actions
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [refreshingOpenDota, setRefreshingOpenDota] = useState(false);

  // Handler for syncing names and logos
  const handleSyncNamesAndLogos = async () => {
    setIsSyncing(true);
    try {
      const token = localStorage.getItem('supabase_token');
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/sync-names-logos`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      const data = await response.json();
      toast.success(`Synced ${data.playersUpdated} players and ${data.teamsUpdated} teams!`);
    } catch (error) {
      console.error('Sync error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync names & logos';
      toast.error(`Sync failed: ${errorMessage}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Handler for refreshing all OpenDota stats
  const handleRefreshOpenDota = async () => {
    setRefreshingOpenDota(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to refresh OpenDota data.');
        setRefreshingOpenDota(false);
        return;
      }
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/refresh-opendota`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );
      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to refresh OpenDota data.');
        setRefreshingOpenDota(false);
        return;
      }
      const data = await response.json();
      toast.success(`Synced ${data.updatedCount || 0} user(s) with OpenDota!`);
    } catch (error) {
      console.error('Error refreshing OpenDota data:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setRefreshingOpenDota(false);
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Redirect non-officers away
  const hasAccess = isOfficer(user?.role);
  const isOwner = user?.role === 'owner';

  // Filter TOC sections based on role
  const visibleSections = TOC_SECTIONS.filter(s => !s.ownerOnly || isOwner);

  // ── Shared admin tool button style ──
  const adminBtnClass = "w-full flex items-center justify-between p-4 bg-card hover:bg-harvest/5 border-2 border-border hover:border-harvest/40 rounded-2xl transition-all group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="min-h-screen bg-background px-3 sm:px-4 py-6 sm:py-8">
      <div className="max-w-2xl mx-auto">

        {/* Red Warning Banner */}
        <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-300 dark:border-red-800 rounded-2xl p-4 sm:p-5 mb-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-red-700 dark:text-red-400 mb-1">Restricted Area — Officers Only</h3>
            <p className="text-xs text-red-600 dark:text-red-400/80 leading-relaxed">
              This page is restricted to guild officers and the Colonel Kernel. If you are not an officer and you're seeing this page, please leave immediately and contact <span className="font-bold">Mavi</span> on Discord.
            </p>
          </div>
        </div>

        {!hasAccess ? (
          <div className="bg-card rounded-3xl p-8 shadow-sm border-2 border-red-200 dark:border-red-800 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Access Denied</h2>
            <p className="text-sm text-muted-foreground mb-6">
              You do not have officer-level permissions. If you believe this is an error, please contact Mavi.
            </p>
            <button
              onClick={() => { window.location.hash = '#profile'; }}
              className="px-6 py-3 bg-foreground text-background rounded-xl font-semibold hover:opacity-90 transition-colors"
            >
              Return to Profile
            </button>
          </div>
        ) : (
          <>
            {/* Page Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-harvest to-amber flex items-center justify-center shadow-md">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Officer Panel</h1>
                  <p className="text-xs text-muted-foreground font-semibold">Admin tools & guild management</p>
                </div>
              </div>
            </div>

            {/* ── Quick Nav TOC ── */}
            {visibleSections.length > 1 && (
              <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
                {visibleSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-border hover:border-harvest/40 bg-card hover:bg-harvest/5 transition-all flex-shrink-0 group"
                    >
                      <div className={`w-7 h-7 rounded-lg ${section.bg} flex items-center justify-center`}>
                        <Icon className={`w-3.5 h-3.5 ${section.color}`} />
                      </div>
                      <span className="text-xs font-bold text-foreground group-hover:text-harvest transition-colors">
                        {section.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ════════════════════════════════════════════════
                 1. ADMIN TOOLS
                 ════════════════════════════════════════════════ */}
            <div id="admin-tools" className="bg-card rounded-3xl p-6 sm:p-8 shadow-sm border-2 border-border mb-6 scroll-mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground">Admin Tools</h2>
                <Settings className="w-6 h-6 text-harvest" />
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Manage tournaments, teams, and community assets
              </p>

              <div className="space-y-3">
                {/* Award Master */}
                <button onClick={() => setShowAwardMasterModal(true)} className={adminBtnClass}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-md">
                      <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-foreground">Award Prizes</p>
                      <p className="text-xs text-muted-foreground">Champions, Pop'd Kernel, MOTN, staff pay & more</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-harvest group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Sync Names and Logos */}
                <button onClick={() => setShowSyncConfirm(true)} disabled={isSyncing} className={adminBtnClass}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-harvest to-amber flex items-center justify-center shadow-md">
                      {isSyncing ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <RefreshCw className="w-6 h-6 text-white" />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-foreground">{isSyncing ? 'Syncing...' : 'Sync Names & Logos'}</p>
                      <p className="text-xs text-muted-foreground">Update player and team names/logos</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-harvest group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Refresh All OpenDota Stats */}
                <button onClick={handleRefreshOpenDota} disabled={refreshingOpenDota} className={adminBtnClass}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-harvest to-amber flex items-center justify-center shadow-md">
                      {refreshingOpenDota ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Gamepad2 className="w-6 h-6 text-white" />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-foreground">{refreshingOpenDota ? 'Syncing with OpenDota...' : 'Refresh All User Stats'}</p>
                      <p className="text-xs text-muted-foreground">Sync MMR, medals & match history for all members</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-harvest group-hover:translate-x-1 transition-transform" />
                </button>

                {/* CSV Tournament Importer — Owner only */}
                {isOwner && (
                  <button onClick={() => { window.location.hash = '#csv-import'; }} className={adminBtnClass}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                        <Upload className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-foreground">CSV Tournament Importer</p>
                        <p className="text-xs text-muted-foreground">Import tournament data from CSV files</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-harvest group-hover:translate-x-1 transition-transform" />
                  </button>
                )}

                {/* Practice Tournament Builder */}
                <button onClick={() => { window.location.hash = '#practice'; }} className={adminBtnClass}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-md">
                      <Radio className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-foreground">Practice Tournament Builder</p>
                      <p className="text-xs text-muted-foreground">Spin up throwaway tournaments from Steam leagues for casting practice</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-harvest group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* ── Tournament Rank Config ── */}
              <div className="mt-6 pt-6 border-t-2 border-border">
                <h3 className="text-sm font-bold text-foreground mb-3">Tournament Rank Eligibility</h3>
                <OfficerRankConfig />
              </div>
            </div>

            {/* ════════════════════════════════════════════════
                 2. PRIZE MANAGER — Owner only
                 ════════════════════════════════════════════════ */}
            {isOwner && (
              <div id="prize-manager" className="bg-card rounded-3xl p-6 sm:p-8 shadow-sm border-2 border-border mb-6 scroll-mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-foreground">Prize Manager</h2>
                  <DollarSign className="w-6 h-6 text-[#10b981]" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Award prize money to tournament winners and manage Stripe Connect payouts.
                </p>
                <PrizeManager />
              </div>
            )}

            {/* ════════════════════════════════════════════════
                 3. USER MANAGEMENT — Owner only
                 ════════════════════════════════════════════════ */}
            {isOwner && (
              <div id="user-management" className="scroll-mt-6 mb-6">
                <UserManagement onRefresh={onRefresh ? async () => { onRefresh(); } : undefined} />
              </div>
            )}

            {/* ════════════════════════════════════════════════
                 4. GUILD MANAGER (Roles) — Owner only
                 ════════════════════════════════════════════════ */}
            {isOwner && (
              <div id="guild-manager" className="bg-card rounded-3xl p-6 sm:p-8 shadow-sm border-2 border-border mb-6 scroll-mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-foreground">Guild Manager</h2>
                  <Shield className="w-6 h-6 text-[#6366f1]" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Create custom guild roles that appear as leaderboard tabs and user badges
                </p>
                <RoleManagement />
              </div>
            )}

            {/* ════════════════════════════════════════════════
                 5. TEAM MANAGER
                 ════════════════════════════════════════════════ */}
            <div id="team-manager" className="bg-card rounded-3xl p-6 sm:p-8 shadow-sm border-2 border-border mb-6 scroll-mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground">Team Manager</h2>
                <Swords className="w-6 h-6 text-[#8b5cf6]" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Manage and organize guild teams
              </p>
              <OfficerTeamManager />
            </div>

            {/* ════════════════════════════════════════════════
                 6. GIVEAWAY MANAGER — Owner only
                 ════════════════════════════════════════════════ */}
            {isOwner && (
              <div id="giveaway-manager" className="bg-card rounded-3xl p-6 sm:p-8 shadow-sm border-2 border-border mb-6 scroll-mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-foreground">Giveaway Manager</h2>
                  <Gift className="w-6 h-6 text-[#10b981]" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Manage prize types available in the giveaway system. Built-in types can be customized; add new types for your unique prizes.
                </p>
                <GiveawayManager />
              </div>
            )}

            {/* ════════════════════════════════════════════════
                 7. NOTIFICATION MANAGER — Owner only
                 ════════════════════════════════════════════════ */}
            {isOwner && (
              <div id="notification-manager" className="bg-card rounded-3xl p-6 sm:p-8 shadow-sm border-2 border-border mb-24 scroll-mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-foreground">Notification Manager</h2>
                  <Bell className="w-6 h-6 text-[#ec4899]" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Manage and send notifications to guild members.
                </p>
                <OfficerNotificationManager />
              </div>
            )}
          </>
        )}
      </div>

      <Footer />

      {/* ── Modals ── */}
      {showAwardMasterModal && (
        <AwardMasterModal
          onClose={() => setShowAwardMasterModal(false)}
          onSuccess={() => {
            setShowAwardMasterModal(false);
          }}
        />
      )}

      {showSyncConfirm && (
        <ConfirmModal
          title="Confirm Sync"
          message="This will update all player names and avatars from Steam, and all team logos from the kkupassets bucket. Existing data will be overwritten. Are you sure?"
          confirmText="Sync Now"
          confirmVariant="primary"
          onConfirm={() => {
            setShowSyncConfirm(false);
            handleSyncNamesAndLogos();
          }}
          onCancel={() => setShowSyncConfirm(false)}
        />
      )}
    </div>
  );
}