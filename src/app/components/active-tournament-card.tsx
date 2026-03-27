import { Crown, Users, Calendar, Trophy, UserPlus, Swords, Clock } from 'lucide-react';
import { getPhaseConfig, isRegistrationOpen, isLive } from '@/app/components/tournament-state-config';
import { slugifyTournamentName } from '@/lib/slugify';
import { projectId } from '/utils/supabase/info';
import { TcfPlusAvatarRing } from '@/app/components/tcf-plus-avatar-ring';

interface ActiveTournamentCardProps {
  tournament: any;
  onClick?: () => void;
}

export function ActiveTournamentCard({ tournament, onClick }: ActiveTournamentCardProps) {
  const phase = getPhaseConfig(tournament.status);
  const slug = tournament.name ? slugifyTournamentName(tournament.name) : '';
  const bannerUrl = slug.length >= 3
    ? `https://${projectId}.supabase.co/storage/v1/object/public/make-4789f4af-kkup-assets/${slug}/league_banner.png`
    : null;
  const previews: { avatar: string | null; name: string; tcf_plus_active?: boolean }[] = tournament.player_previews || [];
  const regCount: number = tournament.registration_count || 0;
  const teamCount: number = tournament.team_count || 0;
  const regOpen = isRegistrationOpen(tournament.status);
  const live = isLive(tournament.status);
  const maxTeams: number = tournament.max_teams || 0;
  const maxAvatars = typeof window !== 'undefined' && window.innerWidth >= 640 ? 15 : 8;

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      window.location.hash = `#tournament-hub/${tournament.id}`;
    }
  };

  // Show teams after roster lock, otherwise show players
  const showTeams = ['roster_lock', 'in_progress', 'paused'].includes(tournament.status);

  return (
    <div
      onClick={handleClick}
      className={`relative bg-card rounded-2xl sm:rounded-3xl border-2 border-border ${phase.cardBorderHover} overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl`}
      style={phase.cardGlow ? { boxShadow: phase.cardGlow } : undefined}
    >
      {/* ── Banner Image ── */}
      <div className="relative overflow-hidden" style={{ minHeight: '200px' }}>
        {bannerUrl ? (
          <>
            <img
              src={bannerUrl}
              alt=""
              className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${phase.bannerZoom ? 'group-hover:scale-105' : ''}`}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
          </>
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${phase.headerGradient}`} />
        )}

        {/* Status pill */}
        <span
          className={`absolute top-4 right-4 px-4 py-2 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 ${phase.statusPillBg} ${phase.statusPillText} ${phase.pulseStatus ? 'animate-pulse' : ''}`}
          style={phase.cardGlow ? { boxShadow: `0 0 16px ${phase.accentHex}66` } : undefined}
        >
          {phase.pingDot && <span className="w-2 h-2 bg-white rounded-full animate-ping" />}
          {phase.icon} {phase.label}
        </span>

        {/* Tournament name at bottom of banner */}
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 z-10">
          <div className="flex items-end gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Crown className="w-7 h-7 sm:w-8 sm:h-8 text-kernel-gold" />
            </div>
            <div className="min-w-0">
              <h3 className="text-2xl sm:text-3xl font-bold text-white truncate leading-tight">{tournament.name}</h3>
              <p className="text-white/60 text-sm sm:text-base mt-1">
                {tournament.tournament_type === 'kernel_kup' ? '🌽 5v5 Captains Mode' : '🪝 1v1 Duel'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Card Body ── */}
      <div className="p-5 sm:p-8 space-y-5">
        {/* Description */}
        {tournament.description && (
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed line-clamp-2">{tournament.description}</p>
        )}

        {/* ── Registrants/Teams Strip ── */}
        <div className="bg-muted/50 rounded-xl sm:rounded-2xl p-4 sm:p-5">
          {showTeams && teamCount > 0 ? (
            /* Show team count for roster-locked+ tournaments */
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: phase.accentHex }} />
                <span className="text-sm sm:text-base font-bold text-foreground">
                  Teams Registered
                </span>
                <span
                  className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${phase.accentHex}15`, color: phase.accentHex }}
                >
                  {teamCount}{maxTeams > 0 ? ` / ${maxTeams}` : ''}
                </span>
              </div>
              {live && (
                <span className="text-[10px] sm:text-xs font-semibold text-[#ef4444] bg-[#ef4444]/10 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#ef4444] rounded-full animate-pulse" />
                  Playing now
                </span>
              )}
            </div>
          ) : regCount > 0 ? (
            /* Show player avatars for pre-roster-lock tournaments */
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: phase.accentHex }} />
                  <span className="text-sm sm:text-base font-bold text-foreground">
                    Recent Registrants
                  </span>
                  <span
                    className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${phase.accentHex}15`, color: phase.accentHex }}
                  >
                    {regCount}
                  </span>
                </div>
                {regOpen && (
                  <span className="text-[10px] sm:text-xs font-semibold text-[#10b981] bg-[#10b981]/10 px-2.5 py-1 rounded-full">
                    Sign ups open
                  </span>
                )}
                {live && (
                  <span className="text-[10px] sm:text-xs font-semibold text-[#ef4444] bg-[#ef4444]/10 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-[#ef4444] rounded-full animate-pulse" />
                    Playing now
                  </span>
                )}
              </div>
              {/* Avatar strip with TCF+ rings and hover effects */}
              <div className="flex items-center">
                <div className="flex -space-x-2.5">
                  {previews.slice(0, maxAvatars).map((p, i) => (
                    <div key={i} className="relative group/avatar" style={{ zIndex: maxAvatars + 1 - i }}>
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
                {regCount > maxAvatars && (
                  <div className="ml-1 w-9 h-9 rounded-full border-[2.5px] border-card bg-muted flex items-center justify-center">
                    <span className="text-[10px] font-bold text-muted-foreground">+{regCount - maxAvatars}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* No registrations yet */
            <div className="flex items-center gap-3 py-1">
              <div className="flex -space-x-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-9 h-9 rounded-full border-[2.5px] border-card bg-muted" />
                ))}
              </div>
              <div>
                <p className="text-xs sm:text-sm font-semibold text-muted-foreground">No registrations yet</p>
                {regOpen && <p className="text-[10px] sm:text-xs text-[#10b981] font-medium">Be the first to sign up!</p>}
              </div>
            </div>
          )}
        </div>

        {/* ── Meta Row ── */}
        <div className="flex items-center flex-wrap gap-3 text-xs sm:text-sm text-muted-foreground">
          {tournament.tournament_start_date && (
            <span className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-lg">
              <Calendar className="w-4 h-4" />
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
            <span className="flex items-center gap-1.5 bg-harvest/10 text-harvest px-3 py-1.5 rounded-lg font-semibold">
              <Trophy className="w-4 h-4" />
              ${(() => {
                const base = Number(tournament.prize_pool) || 0;
                const donations = tournament.prize_pool_donations ?? 0;
                return (base + donations).toFixed(2);
              })()}
            </span>
          )}
          {maxTeams > 0 && (
            <span className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-lg">
              <Users className="w-4 h-4" />
              {maxTeams} teams max
            </span>
          )}
        </div>

        {/* CTA — state-driven */}
        <div className="flex items-center justify-center gap-2 pt-1">
          {regOpen && (
            <>
              <UserPlus className="w-5 h-5 text-[#10b981]" />
              <span className="text-sm font-bold text-[#10b981]">Click to view & register</span>
            </>
          )}
          {live && (
            <>
              <Swords className="w-5 h-5 text-[#ef4444]" />
              <span className="text-sm font-bold text-[#ef4444]">Click to watch live</span>
            </>
          )}
          {tournament.status === 'registration_closed' && (
            <>
              <Clock className="w-5 h-5 text-[#f59e0b]" />
              <span className="text-sm font-bold text-[#f59e0b]">Starting soon — view details</span>
            </>
          )}
          {tournament.status === 'upcoming' && (
            <>
              <Calendar className="w-5 h-5 text-harvest" />
              <span className="text-sm font-bold text-harvest">View tournament details</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
