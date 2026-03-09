/**
 * TournamentCard — Unified, state-driven tournament card component
 *
 * Renders differently based on tournament phase (status). Used on the
 * Kernel Kup listing page for both live and past tournaments.
 *
 * Visual behavior, animations, and content are all driven by the
 * tournament-state-config system.
 */

import { Crown, Calendar, Users, Trophy, UserPlus, Swords, Clock } from '@/lib/icons';
import { getPhaseConfig, isRegistrationOpen, isLive, isFinished } from './tournament-state-config';
import { projectId } from '/utils/supabase/info';
import { slugifyTournamentName } from '@/lib/slugify';
import { useState, useEffect } from 'react';
import { TcfPlusAvatarRing } from '@/app/components/tcf-plus-avatar-ring';
import { LiveMinimap } from '@/app/components/live-match-minimap';
import type { LiveGame } from './live-match-panel';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface PlayerPreview {
  avatar: string | null;
  name: string;
  tcf_plus_active?: boolean;
}

interface TournamentCardProps {
  tournament: any;
  /** 'hub' navigates to tournament-hub, 'detail' to kkup detail page */
  variant?: 'live' | 'past';
  onClick?: () => void;
  /** Optional live game data — when provided and tournament is live, shows a compact minimap */
  liveGame?: LiveGame;
}

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════

function getKKupNumber(t: any): string | null {
  if (!t?.name) return null;
  const m = t.name.match(/Kernel Kup (\d+)|KKup (\d+)|KKUP (\d+)/i);
  return m ? (m[1] || m[2] || m[3]) : null;
}

function getLeagueAssetUrl(t: any, assetType: 'banner' | 'large_icon' | 'square_icon'): string | null {
  if (!t?.name) return null;
  const slug = slugifyTournamentName(t.name);
  if (slug.length < 3) return null;
  const filename = assetType === 'banner' ? 'league_banner.png'
                 : assetType === 'large_icon' ? 'league_large_icon.png'
                 : 'league_square_icon.png';
  return `https://${projectId}.supabase.co/storage/v1/object/public/make-4789f4af-kkup-assets/${slug}/${filename}`;
}

// ═══════════════════════════════════════════════════════
// AVATAR STRIP
// ═══════════════════════════════════════════════════════

function useResponsiveMaxShow(desktopMax: number, mobileMax: number, breakpoint = 640): number {
  const [maxShow, setMaxShow] = useState(() =>
    typeof window !== 'undefined' ? (window.innerWidth >= breakpoint ? desktopMax : mobileMax) : desktopMax
  );
  useEffect(() => {
    const onResize = () => setMaxShow(window.innerWidth >= breakpoint ? desktopMax : mobileMax);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [desktopMax, mobileMax, breakpoint]);
  return maxShow;
}

function AvatarStrip({ previews, total }: { previews: PlayerPreview[]; total: number }) {
  const maxShow = useResponsiveMaxShow(15, 8);
  const shown = previews.slice(0, maxShow);
  const overflow = total - shown.length;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2.5">
        {shown.map((p, i) => (
          <div key={i} className="relative group/avatar" style={{ zIndex: maxShow + 1 - i }}>
            <TcfPlusAvatarRing active={p.tcf_plus_active} size="xs">
              {p.avatar ? (
                <img
                  src={p.avatar}
                  alt={p.name}
                  title={p.name}
                  className="w-9 h-9 rounded-full border-[2.5px] border-card shadow-sm transition-transform duration-200 group-hover/avatar:scale-110 group-hover/avatar:-translate-y-1"
                />
              ) : (
                <div
                  title={p.name}
                  className="w-9 h-9 rounded-full border-[2.5px] border-card bg-harvest/15 flex items-center justify-center shadow-sm transition-transform duration-200 group-hover/avatar:scale-110 group-hover/avatar:-translate-y-1"
                >
                  <span className="text-harvest text-xs font-bold">{p.name?.[0]?.toUpperCase() || '?'}</span>
                </div>
              )}
            </TcfPlusAvatarRing>
          </div>
        ))}
      </div>
      {overflow > 0 && (
        <div className="ml-1 w-9 h-9 rounded-full border-[2.5px] border-card bg-muted flex items-center justify-center">
          <span className="text-[10px] font-bold text-muted-foreground">+{overflow}</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// EMPTY AVATAR PLACEHOLDERS
// ═══════════════════════════════════════════════════════

function EmptyAvatarRow({ regOpen }: { regOpen: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex -space-x-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-8 h-8 rounded-full border-[2.5px] border-card bg-muted" />
        ))}
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground">No registrations yet</p>
        {regOpen && (
          <p className="text-[10px] text-[#10b981] font-medium">Be the first to sign up!</p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PAST TOURNAMENT CARD (compact image card)
// ═══════════════════════════════════════════════════════

function PastTournamentCard({ tournament, onClick }: { tournament: any; onClick?: () => void }) {
  const phase = getPhaseConfig(tournament.status);
  const leagueLargeIconUrl = getLeagueAssetUrl(tournament, 'large_icon');
  const kkupNumber = getKKupNumber(tournament);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="space-y-2">
      {/* Title */}
      {kkupNumber && (
        <div className="flex items-center gap-1.5 px-2 min-h-[28px]">
          <Trophy className="w-3.5 h-3.5 text-harvest shrink-0" />
          <h3 className="text-sm font-bold text-foreground truncate">
            Kernel Kup {kkupNumber}
            {(tournament.winning_team?.name || tournament.winning_team_name || tournament.winning_team?.tag) && (
              <span className="font-semibold text-harvest"> – {tournament.winning_team?.name || tournament.winning_team_name || tournament.winning_team?.tag}</span>
            )}
          </h3>
        </div>
      )}

      {/* Card */}
      <div
        className={`relative rounded-lg sm:rounded-xl overflow-hidden border-2 border-border ${phase.cardBorderHover} transition-all duration-200 cursor-pointer group ${phase.cardHoverLift ? 'hover:scale-[1.03]' : ''}`}
        onClick={onClick}
        style={phase.cardGlow ? { boxShadow: phase.cardGlow } : undefined}
      >
        {/* Completed badge overlay */}
        {phase.showWinnerBanner && tournament.winning_team_name && (
          <div className="absolute top-2 right-2 z-10 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold flex items-center gap-1">
            <Trophy className="w-3 h-3 text-kernel-gold" />
            {tournament.winning_team_name}
          </div>
        )}

        {leagueLargeIconUrl && !imgFailed ? (
          <img
            src={leagueLargeIconUrl}
            alt={tournament.name}
            className={`w-full aspect-[3/2] object-cover transition-opacity ${phase.bannerZoom ? 'group-hover:opacity-90' : ''}`}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className={`w-full aspect-[3/2] bg-gradient-to-br ${phase.headerGradient} flex items-center justify-center`}>
            <div className="text-center p-4 sm:p-6">
              <Crown className="w-12 h-12 sm:w-16 sm:h-16 text-white mx-auto mb-2 sm:mb-4" />
              <h3 className="text-lg sm:text-2xl font-black text-white">{tournament.name}</h3>
            </div>
          </div>
        )}

        {/* Status badge (for non-completed/archived, shows status) */}
        {!isFinished(tournament.status) && (
          <div className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full ${phase.statusPillBg} ${phase.statusPillText} text-[10px] font-bold`}>
            {phase.icon} {phase.label}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// LIVE TOURNAMENT CARD (rich card with avatars)
// ═══════════════════════════════════════════════════════

function LiveTournamentCard({ tournament, onClick, liveGame }: { tournament: any; onClick?: () => void; liveGame?: LiveGame }) {
  const phase = getPhaseConfig(tournament.status);
  const bannerUrl = getLeagueAssetUrl(tournament, 'banner');
  const previews: PlayerPreview[] = tournament.player_previews || [];
  const regCount: number = tournament.registration_count || 0;
  const maxTeams: number = tournament.max_teams || 0;
  const regOpen = isRegistrationOpen(tournament.status);
  const live = isLive(tournament.status);

  return (
    <div
      onClick={onClick}
      className={`bg-card rounded-2xl border-2 border-border ${phase.cardBorderHover} overflow-hidden cursor-pointer group transition-all duration-300 ${phase.cardHoverLift ? 'hover:-translate-y-1' : ''} hover:shadow-xl`}
      style={phase.cardGlow ? { boxShadow: phase.cardGlow } : undefined}
    >
      {/* ── Banner Header ── */}
      <div className="relative overflow-hidden" style={{ minHeight: '140px' }}>
        {bannerUrl ? (
          <>
            <img
              src={bannerUrl}
              alt=""
              className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${phase.bannerZoom ? 'group-hover:scale-105' : ''}`}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
          </>
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${phase.headerGradient}`} />
        )}

        {/* Status pill */}
        <span className={`absolute top-3 right-3 px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${phase.statusPillBg} ${phase.statusPillText} ${phase.pulseStatus ? 'animate-pulse' : ''}`}
          style={phase.cardGlow ? { boxShadow: `0 0 12px ${phase.accentHex}66` } : undefined}
        >
          {phase.pingDot && <span className="w-2 h-2 bg-white rounded-full animate-ping" />}
          {phase.icon} {phase.label}
        </span>

        {/* Tournament name at bottom of banner */}
        <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
          <div className="flex items-end gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Crown className="w-6 h-6 text-kernel-gold" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-white truncate leading-tight">{tournament.name}</h3>
              <p className="text-white/60 text-xs mt-0.5">
                {tournament.tournament_type === 'kernel_kup' ? '🌽 5v5 Captains Mode' : '🪝 1v1 Duel'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Card Body ── */}
      <div className="p-5 space-y-4">
        {/* Description */}
        {tournament.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{tournament.description}</p>
        )}

        {/* ── Recent Registrants Strip ── */}
        <div className="bg-muted/50 rounded-xl p-4">
          {regCount > 0 ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: phase.accentHex }} />
                  <span className="text-sm font-bold text-foreground">
                    Recent Registrants
                  </span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${phase.accentHex}15`, color: phase.accentHex }}
                  >
                    {regCount}
                  </span>
                </div>
                {regOpen && (
                  <span className="text-[10px] font-semibold text-[#10b981] bg-[#10b981]/10 px-2 py-0.5 rounded-full">
                    Sign ups open
                  </span>
                )}
                {live && (
                  <span className="text-[10px] font-semibold text-[#ef4444] bg-[#ef4444]/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-[#ef4444] rounded-full animate-pulse" />
                    Playing now
                  </span>
                )}
              </div>
              <AvatarStrip previews={previews} total={regCount} />
            </>
          ) : (
            <EmptyAvatarRow regOpen={regOpen} />
          )}
        </div>

        {/* ── Live Minimap Preview ── */}
        {live && liveGame && (
          <div className="bg-muted/50 rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef4444] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ef4444]" />
              </span>
              <span className="text-[10px] font-black text-[#ef4444] uppercase tracking-wider">
                Live — {liveGame.radiant_team.tag} vs {liveGame.dire_team.tag}
              </span>
              {liveGame.duration > 0 && (
                <span className="text-[10px] font-semibold text-muted-foreground ml-auto">
                  {Math.floor(liveGame.duration / 60)}:{String(Math.floor(liveGame.duration % 60)).padStart(2, '0')}
                </span>
              )}
            </div>
            {/* Compact score + minimap side-by-side */}
            <div className="flex items-center gap-3">
              {/* Score column */}
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <span className="text-xs font-bold text-[#10b981]">{liveGame.radiant_team.tag}</span>
                <span className="text-lg font-black text-foreground">{liveGame.radiant_score}</span>
                <span className="text-[9px] text-muted-foreground font-bold">vs</span>
                <span className="text-lg font-black text-foreground">{liveGame.dire_score}</span>
                <span className="text-xs font-bold text-[#ef4444]">{liveGame.dire_team.tag}</span>
              </div>
              {/* Minimap — compact square */}
              <div className="flex-1 max-w-[200px]">
                <LiveMinimap game={liveGame} />
              </div>
            </div>
          </div>
        )}

        {/* ── Meta Row ── */}
        <div className="flex items-center flex-wrap gap-3 text-xs text-muted-foreground">
          {tournament.tournament_start_date && (
            <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-lg">
              <Calendar className="w-3.5 h-3.5" />
              {(() => {
                const d = new Date(tournament.tournament_start_date);
                const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0;
                const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                if (!hasTime) return datePart;
                return `${datePart}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`;
              })()}
            </span>
          )}
          {(Number(tournament.prize_pool) > 0 || (tournament.prize_pool_donations ?? 0) > 0) && (
            <span className="flex items-center gap-1.5 bg-harvest/10 text-harvest px-2.5 py-1 rounded-lg font-semibold">
              <Trophy className="w-3.5 h-3.5" />
              ${(() => {
                const base = Number(tournament.prize_pool) || 0;
                const donations = tournament.prize_pool_donations ?? 0;
                const total = base + donations;
                return total.toFixed(2);
              })()}
            </span>
          )}
          {maxTeams > 0 && (
            <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-lg">
              <Users className="w-3.5 h-3.5" />
              {maxTeams} teams max
            </span>
          )}
        </div>

        {/* CTA hint — state-driven */}
        {regOpen && (
          <div className="flex items-center justify-center gap-2 pt-1">
            <UserPlus className="w-4 h-4 text-[#10b981]" />
            <span className="text-xs font-semibold text-[#10b981]">Click to view & register</span>
          </div>
        )}
        {live && (
          <div className="flex items-center justify-center gap-2 pt-1">
            <Swords className="w-4 h-4 text-[#ef4444]" />
            <span className="text-xs font-semibold text-[#ef4444]">Click to watch live</span>
          </div>
        )}
        {tournament.status === 'registration_closed' && (
          <div className="flex items-center justify-center gap-2 pt-1">
            <Clock className="w-4 h-4 text-[#f59e0b]" />
            <span className="text-xs font-semibold text-[#f59e0b]">Starting soon — view details</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════

export function TournamentCard({ tournament, variant = 'live', onClick, liveGame }: TournamentCardProps) {
  if (variant === 'past') {
    return <PastTournamentCard tournament={tournament} onClick={onClick} />;
  }
  return <LiveTournamentCard tournament={tournament} onClick={onClick} liveGame={liveGame} />;
}