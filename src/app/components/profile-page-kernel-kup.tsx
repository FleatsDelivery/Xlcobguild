/**
 * Profile Page — Kernel Kup Tab
 *
 * Contains: KKUP stats, My Teams manager, and action buttons.
 * Receives kkupStats as props from orchestrator (no data fetching here).
 */
import { LogOut } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { ProfilePageMyTeams } from '@/app/components/profile-page-my-teams';
import { TrophyImage } from '@/app/components/trophy-image';

interface KkupStatsData {
  linked: boolean;
  profile?: { name: string };
  championships?: { total: number; kernel_kup: number; heaps_n_hooks: number };
  popd_kernels: number;
  tournaments_played: number;
  total_games: number;
  wins: number;
  losses: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
}

interface ProfilePageKernelKupProps {
  user: any;
  kkupStats: KkupStatsData | null;
  loadingKkupStats: boolean;
  onSignOut: () => void;
}

// ═══════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════

function KkupStatsSkeleton() {
  return (
    <div className="bg-gradient-to-br from-harvest/10 to-harvest/5 rounded-2xl p-5 sm:p-6 border-2 border-harvest/20">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
        <div>
          <div className="h-5 w-32 bg-muted rounded animate-pulse mb-1" />
          <div className="h-3 w-20 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-card/80 rounded-xl p-3 border border-border">
            <div className="h-3 w-16 bg-muted rounded animate-pulse mx-auto mb-2" />
            <div className="h-6 w-10 bg-muted rounded animate-pulse mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfilePageKernelKup({ user, kkupStats, loadingKkupStats, onSignOut }: ProfilePageKernelKupProps) {
  return (
    <div className="space-y-4">
      {/* ═══ Kernel Kup Stats ═══ */}
      {loadingKkupStats && <KkupStatsSkeleton />}

      {kkupStats && kkupStats.linked && (
        <div className="bg-gradient-to-br from-harvest/10 to-harvest/5 rounded-2xl p-5 sm:p-6 border-2 border-harvest/20">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center">
                <TrophyImage type="kernel_kup_champion" size="lg" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Kernel Kup Stats</h2>
                {kkupStats.profile?.name && (
                  <p className="text-xs text-muted-foreground">Profile: {kkupStats.profile.name}</p>
                )}
              </div>
            </div>
          </div>

          {/* Championship / MVP badges */}
          {(kkupStats.championships?.total! > 0 || kkupStats.popd_kernels > 0) && (
            <div className="flex gap-3 mb-5">
              {kkupStats.championships?.kernel_kup! > 0 && (
                <div className="flex-1 bg-card/80 rounded-2xl p-3 border border-harvest/20 text-center">
                  <div className="flex justify-center mb-1">
                    <TrophyImage type="kernel_kup_champion" size="xl" />
                  </div>
                  <p className="text-xl font-black text-harvest">{kkupStats.championships!.kernel_kup}x</p>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">KK Champ</p>
                </div>
              )}
              {kkupStats.championships?.heaps_n_hooks! > 0 && (
                <div className="flex-1 bg-card/80 rounded-2xl p-3 border border-[#10b981]/20 text-center">
                  <span className="text-2xl block mb-0.5">{'\u2693'}</span>
                  <p className="text-xl font-black text-[#10b981]">{kkupStats.championships!.heaps_n_hooks}x</p>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">H&H Champ</p>
                </div>
              )}
              {kkupStats.popd_kernels > 0 && (
                <div className="flex-1 bg-card/80 rounded-2xl p-3 border border-[#dc2626]/20 text-center">
                  <div className="flex justify-center mb-1">
                    <TrophyImage type="popd_kernel_mvp" size="xl" />
                  </div>
                  <p className="text-xl font-black text-[#dc2626]">{kkupStats.popd_kernels}x</p>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Pop'd Kernel</p>
                </div>
              )}
            </div>
          )}

          {/* Stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <div className="bg-card/80 rounded-xl p-3 border border-border text-center">
              <p className="text-xs text-muted-foreground font-medium mb-1">Tournaments</p>
              <p className="text-xl font-black text-foreground">{kkupStats.tournaments_played}</p>
            </div>
            <div className="bg-card/80 rounded-xl p-3 border border-border text-center">
              <p className="text-xs text-muted-foreground font-medium mb-1">Win Rate</p>
              <p className={`text-xl font-black ${kkupStats.total_games > 0 && ((kkupStats.wins / kkupStats.total_games) * 100) >= 50 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                {kkupStats.total_games > 0 ? `${((kkupStats.wins / kkupStats.total_games) * 100).toFixed(1)}%` : '-'}
              </p>
            </div>
            <div className="bg-card/80 rounded-xl p-3 border border-border text-center">
              <p className="text-xs text-muted-foreground font-medium mb-1">Record</p>
              <p className="text-xl font-black">
                <span className="text-[#10b981]">{kkupStats.wins}W</span>
                <span className="text-muted-foreground/40"> / </span>
                <span className="text-[#ef4444]">{kkupStats.losses}L</span>
              </p>
            </div>
            <div className="bg-card/80 rounded-xl p-3 border border-border text-center">
              <p className="text-xs text-muted-foreground font-medium mb-1">Total Kills</p>
              <p className="text-xl font-black text-[#ef4444]">{kkupStats.total_kills?.toLocaleString() || 0}</p>
            </div>
            <div className="bg-card/80 rounded-xl p-3 border border-border text-center">
              <p className="text-xs text-muted-foreground font-medium mb-1">Total Deaths</p>
              <p className="text-xl font-black text-muted-foreground">{kkupStats.total_deaths?.toLocaleString() || 0}</p>
            </div>
            <div className="bg-card/80 rounded-xl p-3 border border-border text-center">
              <p className="text-xs text-muted-foreground font-medium mb-1">Total Assists</p>
              <p className="text-xl font-black text-[#3b82f6]">{kkupStats.total_assists?.toLocaleString() || 0}</p>
            </div>
          </div>

          {/* Avg KDA */}
          {kkupStats.total_games > 0 && (
            <div className="bg-card/80 rounded-xl p-3 border border-border mb-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium">Avg KDA per Game</p>
                <p className="text-sm font-black text-foreground">
                  <span className="text-[#ef4444]">{(kkupStats.total_kills / kkupStats.total_games).toFixed(1)}</span>
                  <span className="text-muted-foreground/40"> / </span>
                  <span className="text-muted-foreground">{(kkupStats.total_deaths / kkupStats.total_games).toFixed(1)}</span>
                  <span className="text-muted-foreground/40"> / </span>
                  <span className="text-[#3b82f6]">{(kkupStats.total_assists / kkupStats.total_games).toFixed(1)}</span>
                </p>
              </div>
            </div>
          )}

          {/* View Kernel Kups CTA */}
          <button
            type="button"
            onClick={() => { window.location.hash = '#/kernel-kup'; }}
            className="w-full flex items-center justify-between p-4 bg-card hover:bg-harvest/5 border-2 border-harvest/20 hover:border-harvest/40 rounded-2xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center">
                <TrophyImage type="kernel_kup_champion" size="lg" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-foreground">View Kernel Kups</p>
                <p className="text-xs text-muted-foreground">Browse all tournaments</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-harvest group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {kkupStats.championships?.total === 0 && kkupStats.popd_kernels === 0 && kkupStats.tournaments_played === 0 && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              Linked to Kernel Kup profile but no tournament history yet
            </p>
          )}
        </div>
      )}

      {/* Not linked — show prompt */}
      {!loadingKkupStats && !kkupStats?.linked && !user?.steam_id && (
        <div className="bg-card rounded-2xl p-5 sm:p-6 border-2 border-border text-center">
          <TrophyImage type="kernel_kup_champion" size="xl" className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-bold text-foreground mb-1">No Kernel Kup Stats</p>
          <p className="text-xs text-muted-foreground">Connect your Steam account in the Settings tab to see your tournament stats.</p>
        </div>
      )}

      {/* ═══ My KKUP Teams ═══ */}
      <ProfilePageMyTeams user={user} />

      {/* ═══ Actions ═══ */}
      <div className="bg-card rounded-2xl p-5 sm:p-6 border-2 border-border">
        <Button
          onClick={onSignOut}
          className="w-full bg-red-500 hover:bg-red-600 text-white h-11 rounded-xl font-semibold"
        >
          <LogOut className="mr-2 h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}