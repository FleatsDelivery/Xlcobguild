/**
 * PlayerInfoModal — Enriched player card modal for Tournament Hub
 *
 * Shows:
 *   - Avatar, rank badge, team status
 *   - Prestige level, registration date
 *   - Top 3 heroes with winrates (from OpenDota data)
 *   - Kernel Kup stats (if available)
 *   - Links to Dotabuff / OpenDota
 *   - Invite to team button (if captain + player is free agent)
 *
 * Uses dark mode semantic tokens throughout.
 */

import { X, ExternalLink, Send, Loader2, Shield, Swords } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { getRankDisplay, getMedalColor } from '@/lib/rank-utils';
import { timeAgo } from '@/lib/date-utils';
import { getHeroImageUrl, getHeroName } from '@/lib/dota-heroes';
import { RankBadge } from '@/app/components/rank-badge';
import { TcfPlusBadge } from '@/app/components/tcf-plus-badge';
import { TcfPlusAvatarRing } from '@/app/components/tcf-plus-avatar-ring';

interface PlayerInfoModalProps {
  registration: any;
  team?: any;
  onClose: () => void;
  // Invite support (optional — only provided when captain can invite)
  canInvite?: boolean;
  inviteTeamId?: string;
  inviteTeamName?: string;
  sendingInvite?: boolean;
  onInvite?: (teamId: string, personId: string, personName: string) => void;
}

export function PlayerInfoModal({
  registration, team, onClose,
  canInvite, inviteTeamId, inviteTeamName, sendingInvite, onInvite,
}: PlayerInfoModalProps) {
  const person = registration.person;
  const linkedUser = registration.linked_user;
  const rank = getRankDisplay(linkedUser?.opendota_data?.badge_rank || linkedUser?.badge_rank);
  const avatar = linkedUser?.discord_avatar || person?.avatar_url;
  const displayName = person?.display_name || linkedUser?.discord_username || 'Unknown';
  const steamId = linkedUser?.steam_id || person?.steam_id;

  // OpenDota hero data (stored on user's opendota_data)
  const opendotaData = linkedUser?.opendota_data;
  const topHeroes: { hero_id: number; games: number; win: number }[] = opendotaData?.top_heroes || [];
  const winLoss = opendotaData?.win_loss;
  const totalGames = winLoss ? (winLoss.win || 0) + (winLoss.lose || 0) : null;
  const overallWinrate = totalGames && totalGames > 0 ? ((winLoss.win || 0) / totalGames * 100) : null;

  const isFreeAgent = registration.status === 'registered' || registration.status === 'free_agent';
  const isOnTeam = registration.status === 'on_team';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-modal-backdrop-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border-2 border-border animate-modal-content-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div className="relative bg-gradient-to-br from-soil to-[#1e293b] p-6 pb-12">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {rank && (
              <RankBadge medal={rank.medal} stars={rank.stars} size="sm" showLabel showStars className="backdrop-blur-sm" />
            )}
            {registration.is_first_timer && (
              <span className="px-2.5 py-1 rounded-full bg-[#f59e0b]/30 text-[#fbbf24] text-xs font-bold backdrop-blur-sm">
                ✨ First Timer
              </span>
            )}
            {isFreeAgent && (
              <span className="px-2.5 py-1 rounded-full bg-[#3b82f6]/30 text-[#60a5fa] text-xs font-bold backdrop-blur-sm">
                Free Agent
              </span>
            )}
            {isOnTeam && team && (
              <span className="px-2.5 py-1 rounded-full bg-[#8b5cf6]/30 text-[#a78bfa] text-xs font-bold backdrop-blur-sm flex items-center gap-1">
                <Shield className="w-3 h-3" /> {team.team_name}
              </span>
            )}
          </div>
        </div>

        {/* Avatar - overlapping */}
        <div className="flex justify-center -mt-10 relative z-10">
          <TcfPlusAvatarRing active={linkedUser?.tcf_plus_active} size="md" shape="rounded">
          {avatar ? (
            <img src={avatar} alt={displayName} className="w-20 h-20 rounded-2xl border-4 border-card shadow-lg object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-2xl border-4 border-card shadow-lg bg-gradient-to-br from-harvest to-kernel-gold flex items-center justify-center">
              <span className="text-white text-2xl font-black">{displayName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          </TcfPlusAvatarRing>
        </div>

        {/* Info */}
        <div className="p-6 pt-3 space-y-5">
          {/* Name + Team */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <h3 className="text-xl font-black text-foreground">{displayName}</h3>
              {linkedUser?.tcf_plus_active && (
                <TcfPlusBadge size="sm" />
              )}
            </div>
            {linkedUser?.discord_username && linkedUser.discord_username !== displayName && (
              <p className="text-xs text-muted-foreground mt-0.5">{linkedUser.discord_username}</p>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            {rank ? (
              <div className="rounded-xl p-3 flex flex-col items-center" style={{ backgroundColor: `${getMedalColor(rank.medal)}10` }}>
                <RankBadge medal={rank.medal} stars={rank.stars} size="xl" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Rank</p>
              </div>
            ) : (
              <div className="bg-muted rounded-xl p-3 text-center">
                <RankBadge medal={null} size="xl" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Rank</p>
              </div>
            )}
            {linkedUser?.prestige_level !== undefined && linkedUser.prestige_level > 0 ? (
              <div className="bg-[#8b5cf6]/10 rounded-xl p-3 text-center">
                <p className="text-lg font-black text-[#8b5cf6]">P{linkedUser.prestige_level}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Prestige</p>
              </div>
            ) : (
              <div className="bg-harvest/10 rounded-xl p-3 text-center">
                <p className="text-lg font-black text-harvest">{timeAgo(registration.registered_at).replace(' ago', '')}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Joined</p>
              </div>
            )}
            {overallWinrate !== null ? (
              <div className={`rounded-xl p-3 text-center ${overallWinrate >= 50 ? 'bg-[#10b981]/10' : 'bg-[#ef4444]/10'}`}>
                <p className={`text-lg font-black ${overallWinrate >= 50 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                  {overallWinrate.toFixed(0)}%
                </p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Win Rate</p>
              </div>
            ) : (
              <div className="bg-muted rounded-xl p-3 text-center">
                <p className="text-lg font-black text-muted-foreground">{timeAgo(registration.registered_at).replace(' ago', '')}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Joined</p>
              </div>
            )}
          </div>

          {/* Top Heroes */}
          {topHeroes.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5" /> Top Heroes
              </h4>
              <div className="space-y-2">
                {topHeroes.slice(0, 3).map((hero, i) => {
                  const heroName = getHeroName(hero.hero_id);
                  const heroImg = getHeroImageUrl(hero.hero_id);
                  const wr = hero.games > 0 ? (hero.win / hero.games * 100) : 0;
                  const wrColor = wr >= 55 ? '#10b981' : wr >= 50 ? '#3b82f6' : '#ef4444';
                  return (
                    <div key={hero.hero_id} className="flex items-center gap-3 bg-muted/50 rounded-xl p-2.5 border border-border">
                      <div className="relative flex-shrink-0">
                        {heroImg ? (
                          <img src={heroImg} alt={heroName} className="w-10 h-6 rounded object-cover" />
                        ) : (
                          <div className="w-10 h-6 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                            ?
                          </div>
                        )}
                        <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-card border border-border text-[9px] font-black flex items-center justify-center text-muted-foreground">
                          {i + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{heroName}</p>
                        <p className="text-[10px] text-muted-foreground">{hero.games} game{hero.games !== 1 ? 's' : ''}</p>
                      </div>
                      <span className="text-sm font-black" style={{ color: wrColor }}>
                        {wr.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Match Stats */}
          {totalGames !== null && totalGames > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted/50 rounded-lg p-2 text-center border border-border">
                <p className="text-sm font-black text-foreground">{totalGames}</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Games</p>
              </div>
              <div className="bg-[#10b981]/10 rounded-lg p-2 text-center border border-[#10b981]/20">
                <p className="text-sm font-black text-[#10b981]">{winLoss?.win || 0}</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Wins</p>
              </div>
              <div className="bg-[#ef4444]/10 rounded-lg p-2 text-center border border-[#ef4444]/20">
                <p className="text-sm font-black text-[#ef4444]">{winLoss?.lose || 0}</p>
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Losses</p>
              </div>
            </div>
          )}

          {/* Links */}
          {steamId && (
            <div className="flex gap-2 justify-center">
              <a
                href={`https://www.dotabuff.com/players/${steamId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-semibold transition-colors border border-border"
              >
                <ExternalLink className="w-3 h-3" /> Dotabuff
              </a>
              <a
                href={`https://www.opendota.com/players/${steamId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-semibold transition-colors border border-border"
              >
                <ExternalLink className="w-3 h-3" /> OpenDota
              </a>
            </div>
          )}

          {/* Invite Button */}
          {canInvite && isFreeAgent && inviteTeamId && onInvite && (
            <Button
              onClick={() => onInvite(inviteTeamId, person.id, displayName)}
              disabled={sendingInvite}
              className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white h-11 rounded-xl font-bold"
            >
              {sendingInvite ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Invite to {inviteTeamName || 'Your Team'}</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}