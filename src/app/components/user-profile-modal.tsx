/**
 * UserProfileModal — Rich player profile card (bottom sheet)
 *
 * Sections:
 *   1. Hero header — dark gradient, avatar, name, role badge, TCF+
 *   2. Guild Rank — rank emoji, rank name, prestige, rank progress bar
 *   3. Dota 2 Profile — rank badge, top heroes with portraits, stats grid
 *   4. Kernel Kup Career — trophies, registration, most played hero, KDA
 *   5. Member Since footer
 *   Header includes linked account mini-avatars (Discord, Steam, Twitch) with labels
 */

import { X, TrendingUp, Swords, Zap, Calendar, Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { getHeroName, getHeroImageUrl, getHeroImageByName } from '@/lib/dota-heroes';
import { getRoleBadgeStyle, getRoleDisplayName } from '@/lib/roles';
import { formatDateLong } from '@/lib/date-utils';
import { TcfPlusBadge } from '@/app/components/tcf-plus-badge';
import { TcfPlusAvatarRing } from '@/app/components/tcf-plus-avatar-ring';
import { RankBadge } from '@/app/components/rank-badge';
import { TrophyImage } from '@/app/components/trophy-image';
import { TwitchIcon, DiscordIcon, SteamIcon } from '@/lib/icons';

interface UserProfileModalProps {
  user: {
    id: string;
    discord_username: string;
    discord_avatar: string | null;
    discord_id?: string | null;
    rank_id: number;
    prestige_level: number;
    role: string;
    created_at: string;
    steam_id?: string | null;
    tcf_plus_active?: boolean | null;
    twitch_username?: string | null;
    twitch_avatar?: string | null;
    opendota_data?: {
      badge_rank?: {
        medal: string;
        stars: number;
        rank_tier: number;
        leaderboard_rank: number | null;
      };
      top_3_heroes?: any[];
      primary_role?: string | null;
      win_loss?: { win: number; lose: number };
      profile?: { avatarfull?: string };
    };
    ranks: {
      id: number;
      name: string;
      display_order: number;
    };
    guild_id?: string | null;
    guild?: {
      id: string;
      name: string;
      tag: string;
      color: string;
      logo_url: string | null;
    } | null;
  };
  currentUser: any;
  onClose: () => void;
  onUpdate: () => void;
}

// Rank emojis mapping
const RANK_EMOJIS: Record<number, string> = {
  1: '\u{1F41B}', 2: '\u{1F98C}', 3: '\u{1F33D}', 4: '\u{1F944}',
  5: '\u{1F35E}', 6: '\u{1F33E}', 7: '\u{1F33B}', 8: '\u{1F3AF}',
  9: '\u2B50', 10: '\u{1F31F}', 11: '\u{1F4A5}',
};

export function UserProfileModal({ user, currentUser, onClose, onUpdate }: UserProfileModalProps) {
  const [kkupStats, setKkupStats] = useState<any>(null);
  const [loadingKkupStats, setLoadingKkupStats] = useState(false);
  // Live user data — starts from props, gets overwritten with fresh DB data on mount.
  // This ensures the modal always shows current data regardless of which page opens it.
  const [liveUser, setLiveUser] = useState(user);

  // Fetch fresh user profile from DB (props may be stale registration-time snapshots)
  useEffect(() => {
    const fetchFreshProfile = async () => {
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/users/${user.id}/profile`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } }
        );
        if (!res.ok) {
          console.error('Failed to fetch fresh user profile, using prop data');
          return;
        }
        const fresh = await res.json();
        setLiveUser({
          id: fresh.id,
          discord_id: fresh.discord_id || user.discord_id || null,
          discord_username: fresh.discord_username || user.discord_username,
          discord_avatar: fresh.discord_avatar || user.discord_avatar,
          rank_id: fresh.rank_id ?? user.rank_id,
          prestige_level: fresh.prestige_level ?? user.prestige_level,
          role: fresh.role || user.role,
          created_at: fresh.created_at || user.created_at,
          steam_id: fresh.steam_id || user.steam_id || null,
          tcf_plus_active: fresh.tcf_plus_active ?? user.tcf_plus_active,
          twitch_username: fresh.twitch_username || user.twitch_username || null,
          twitch_avatar: fresh.twitch_avatar || user.twitch_avatar || null,
          opendota_data: fresh.opendota_data || user.opendota_data,
          ranks: fresh.ranks || user.ranks,
          guild_id: fresh.guild_id || user.guild_id || null,
          guild: fresh.guild || user.guild || null,
        });
      } catch (err) {
        console.error('Error fetching fresh user profile:', err);
      }
    };
    fetchFreshProfile();
  }, [user.id]);

  const u = liveUser; // Short alias for rendering — always fresh data

  const maxRank = u.prestige_level === 5 ? 11 : 10;
  const rankProgress = (u.rank_id / maxRank) * 100;

  const badgeRank = u.opendota_data?.badge_rank;
  const hasDotaRank = badgeRank && badgeRank.medal !== 'Unranked';
  const topHeroes = u.opendota_data?.top_3_heroes || [];
  const winLoss = u.opendota_data?.win_loss;
  const totalDotaGames = winLoss ? (winLoss.win || 0) + (winLoss.lose || 0) : null;
  const dotaWinrate = totalDotaGames && totalDotaGames > 0 ? ((winLoss!.win || 0) / totalDotaGames * 100) : null;

  // Precompute linked account URLs
  const steamId64 = u.steam_id ? (BigInt(u.steam_id) + BigInt('76561197960265728')).toString() : null;
  const steamAvatarUrl = u.opendota_data?.profile?.avatarfull;

  // Fetch KKUP stats
  useEffect(() => {
    const fetchKkupStats = async () => {
      setLoadingKkupStats(true);
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/users/${user.id}/kkup-stats`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } }
        );
        if (!response.ok) {
          console.error('Failed to fetch KKUP stats');
          setLoadingKkupStats(false);
          return;
        }
        setKkupStats(await response.json());
      } catch (error) {
        console.error('Error fetching KKUP stats:', error);
      } finally {
        setLoadingKkupStats(false);
      }
    };
    fetchKkupStats();
  }, [user.id]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Lock background scroll
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  const roleBadge = getRoleBadgeStyle(u.role);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      {/* Card */}
      <motion.div
        className="relative w-full max-w-4xl mx-auto"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 24, mass: 0.8 }}
      >
        <div className="bg-card rounded-t-3xl shadow-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden mx-0 sm:mx-4 sm:pb-16">

          {/* ═════════════════════════════════════════════════════ */}
          {/* HERO HEADER                                          */}
          {/* ═════════════════════════════════════════════════════ */}
          <div className="relative flex-shrink-0">
            <div className="bg-gradient-to-br from-soil via-soil to-[#1e293b] px-4 pt-3 pb-14 sm:pb-16 rounded-t-3xl">
              {/* Mobile drag handle */}
              <div className="sm:hidden w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />

              {/* Role badge + linked accounts + close row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 ${roleBadge.bgFull} text-white text-xs font-bold rounded-full`}>
                    {getRoleDisplayName(u.role)}
                  </span>
                  {u.guild && u.guild.name !== 'Unaffiliated' && (
                    <span
                      className="px-2.5 py-0.5 text-white text-xs font-bold rounded-full"
                      style={{ backgroundColor: u.guild.color }}
                    >
                      {u.guild.tag}
                    </span>
                  )}
                  {u.tcf_plus_active && <TcfPlusBadge size="sm" />}
                </div>

                {/* Linked account mini-avatars + close button */}
                <div className="flex items-center gap-2">
                  {/* Discord */}
                  {u.discord_id ? (
                    <a href={`https://discord.com/users/${u.discord_id}`} target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-0.5">
                      {u.discord_avatar ? (
                        <img
                          src={u.discord_avatar.startsWith('http') ? u.discord_avatar : `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.discord_avatar}.png?size=64`}
                          alt="Discord"
                          className="w-7 h-7 rounded-full border border-[#5865F2]/40 object-cover transition-all group-hover:scale-110 group-hover:border-[#5865F2] group-hover:shadow-[0_0_8px_rgba(88,101,242,0.4)]"
                          width={28} height={28}
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center transition-all group-hover:scale-110 group-hover:border-[#5865F2] group-hover:shadow-[0_0_8px_rgba(88,101,242,0.4)]">
                          <DiscordIcon className="w-3.5 h-3.5 text-[#5865F2]" />
                        </div>
                      )}
                      <span className="text-[8px] font-bold text-[#5865F2]/80">Discord</span>
                    </a>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-7 h-7 rounded-full bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center">
                        <DiscordIcon className="w-3.5 h-3.5 text-[#5865F2]" />
                      </div>
                      <span className="text-[8px] font-bold text-[#5865F2]/80">Discord</span>
                    </div>
                  )}

                  {/* Steam */}
                  {u.steam_id && steamId64 ? (
                    <a href={`https://steamcommunity.com/profiles/${steamId64}`} target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-0.5">
                      {steamAvatarUrl ? (
                        <img
                          src={steamAvatarUrl}
                          alt="Steam"
                          className="w-7 h-7 rounded-full border border-[#10b981]/40 object-cover transition-all group-hover:scale-110 group-hover:border-[#10b981] group-hover:shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                          width={28} height={28}
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#10b981]/20 border border-[#10b981]/40 flex items-center justify-center transition-all group-hover:scale-110 group-hover:border-[#10b981] group-hover:shadow-[0_0_8px_rgba(16,185,129,0.4)]">
                          <SteamIcon className="w-3.5 h-3.5 text-[#10b981]" />
                        </div>
                      )}
                      <span className="text-[8px] font-bold text-[#10b981]/80">Steam</span>
                    </a>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5 opacity-30">
                      <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                        <SteamIcon className="w-3.5 h-3.5 text-white/50" />
                      </div>
                      <span className="text-[8px] font-bold text-white/30">Steam</span>
                    </div>
                  )}

                  {/* Twitch */}
                  {u.twitch_username ? (
                    <a href={`https://twitch.tv/${u.twitch_username}`} target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-0.5">
                      {u.twitch_avatar ? (
                        <img
                          src={u.twitch_avatar}
                          alt="Twitch"
                          className="w-7 h-7 rounded-full border border-[#9146ff]/40 object-cover transition-all group-hover:scale-110 group-hover:border-[#9146ff] group-hover:shadow-[0_0_8px_rgba(145,70,255,0.4)]"
                          width={28} height={28}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#9146ff]/20 border border-[#9146ff]/40 flex items-center justify-center transition-all group-hover:scale-110 group-hover:border-[#9146ff] group-hover:shadow-[0_0_8px_rgba(145,70,255,0.4)]">
                          <TwitchIcon className="w-3.5 h-3.5 text-[#9146ff]" />
                        </div>
                      )}
                      <span className="text-[8px] font-bold text-[#9146ff]/80">Twitch</span>
                    </a>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5 opacity-30">
                      <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                        <TwitchIcon className="w-3.5 h-3.5 text-white/50" />
                      </div>
                      <span className="text-[8px] font-bold text-white/30">Twitch</span>
                    </div>
                  )}

                  {/* Close button — inline as last item in row */}
                  <button
                    onClick={onClose}
                    className="flex flex-col items-center gap-0.5"
                  >
                    <div className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                      <X className="w-3.5 h-3.5 text-white/70" />
                    </div>
                    <span className="text-[8px] font-bold text-white/40">Close</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Avatar overlapping banner */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-10 sm:-bottom-12">
              <TcfPlusAvatarRing active={u.tcf_plus_active} size="lg" shape="rounded">
                {u.discord_avatar ? (
                  <img
                    src={u.discord_avatar}
                    alt={u.discord_username}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-card shadow-xl object-cover"
                    width={96} height={96}
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-card shadow-xl bg-gradient-to-br from-harvest to-kernel-gold flex items-center justify-center">
                    <span className="text-white text-3xl sm:text-4xl font-black">{u.discord_username[0].toUpperCase()}</span>
                  </div>
                )}
              </TcfPlusAvatarRing>
            </div>
          </div>

          {/* Name below avatar */}
          <div className="text-center pt-12 sm:pt-14 pb-2 px-4 flex-shrink-0">
            <h3 className="text-xl sm:text-2xl font-black text-foreground truncate max-w-[280px] mx-auto">
              {u.discord_username}
            </h3>
          </div>

          {/* ═════════════════════════════════════════════════════ */}
          {/* SCROLLABLE CONTENT                                   */}
          {/* ═════════════════════════════════════════════════════ */}
          <div className="px-4 sm:px-6 pb-6 space-y-3 overflow-y-auto flex-1">

            {/* ── GUILD WARS RANK ──────────────────────────────── */}
            <div className="bg-gradient-to-br from-harvest/10 to-harvest/5 rounded-2xl p-4 border-2 border-harvest/20">
              {/* Section label */}
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-harvest" /> Guild Wars Rank
              </p>
              <div className="flex items-center gap-3">
                <span className="text-4xl leading-none">{RANK_EMOJIS[u.rank_id] || '\u{1F33D}'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-black text-harvest truncate">{u.ranks.name}</p>
                    {u.prestige_level > 0 && (
                      <span className="px-2 py-0.5 bg-[#fbbf24]/20 text-[#d97706] text-[10px] font-bold rounded-full flex items-center gap-0.5 flex-shrink-0">
                        <Star className="w-3 h-3" /> Prestige {u.prestige_level}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-muted-foreground">Rank {u.rank_id} of {maxRank}</span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">Progress</span>
                  <span className="text-[9px] font-bold text-muted-foreground">{Math.round(rankProgress)}%</span>
                </div>
                <div className="h-1.5 bg-card rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-harvest to-kernel-gold rounded-full transition-all duration-500"
                    style={{ width: `${rankProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* ── DOTA 2 PROFILE ──────────────────────────────── */}
            {(hasDotaRank || topHeroes.length > 0 || winLoss) && (
              <div className="bg-gradient-to-br from-[#3b82f6]/8 to-[#6366f1]/5 rounded-2xl border-2 border-[#3b82f6]/15 overflow-hidden">
                {/* Section header */}
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Swords className="w-3.5 h-3.5 text-[#3b82f6]" /> Dota 2 Profile
                  </p>
                  {u.opendota_data?.primary_role && (
                    <span className="px-2 py-0.5 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] text-[10px] font-bold">
                      {u.opendota_data.primary_role}
                    </span>
                  )}
                </div>

                {/* Rank badge + Signature Heroes — side by side */}
                <div className="px-4 pb-3">
                  <div className="flex gap-3">
                    {/* Rank badge column */}
                    <div className="flex flex-col items-center justify-center flex-shrink-0 bg-card/60 rounded-xl border border-border/50 px-3 py-3 min-w-[72px]">
                      {hasDotaRank ? (
                        <>
                          <RankBadge medal={badgeRank!.medal} stars={badgeRank!.stars} size="2xl" />
                          <p className="text-[10px] font-black mt-1.5 text-center whitespace-nowrap" style={{ color: getMedalAccent(badgeRank!.medal) }}>
                            {badgeRank!.medal} {badgeRank!.stars > 0 ? badgeRank!.stars : ''}
                          </p>
                        </>
                      ) : (
                        <>
                          <RankBadge medal={null} size="2xl" />
                          <p className="text-[10px] font-bold text-muted-foreground mt-1.5">Unranked</p>
                        </>
                      )}
                    </div>

                    {/* Hero cards — fill remaining space */}
                    {topHeroes.length > 0 ? (
                      <div className="flex-1 flex gap-2 min-w-0">
                        {topHeroes.slice(0, 3).map((hero: any, i: number) => {
                          const heroName = getHeroName(hero.hero_id);
                          const heroImg = getHeroImageUrl(hero.hero_id);
                          const wr = hero.games > 0 ? (hero.win / hero.games * 100) : 0;
                          const wrColor = wr >= 55 ? '#10b981' : wr >= 50 ? '#3b82f6' : '#ef4444';
                          return (
                            <div key={hero.hero_id} className="flex-1 bg-card/60 rounded-xl overflow-hidden border border-border/50 min-w-0">
                              {/* Hero portrait — taller crop for more face */}
                              <div className="relative">
                                {heroImg ? (
                                  <img src={heroImg} alt={heroName} className="w-full h-16 sm:h-20 object-cover object-top" loading="lazy" />
                                ) : (
                                  <div className="w-full h-16 sm:h-20 bg-muted flex items-center justify-center text-[10px] text-muted-foreground">?</div>
                                )}
                                <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-soil/80 text-white text-[9px] font-black flex items-center justify-center">
                                  {i + 1}
                                </span>
                                {/* Gradient fade at bottom for text readability */}
                                <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/50 to-transparent" />
                                <p className="absolute bottom-0.5 left-1.5 text-[9px] sm:text-[10px] font-bold text-white truncate drop-shadow-sm">{heroName}</p>
                              </div>
                              {/* Stats line */}
                              <div className="px-1.5 py-1 flex items-center justify-between gap-1">
                                <span className="text-[9px] text-muted-foreground truncate">{hero.games} Games</span>
                                <span className="text-[9px] font-black whitespace-nowrap" style={{ color: wrColor }}>{wr.toFixed(0)}% WR</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center bg-card/60 rounded-xl border border-border/50 p-4">
                        <p className="text-xs text-muted-foreground">No hero data</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick stats row */}
                <div className="px-4 pb-3">
                  <div className="grid grid-cols-4 gap-2">
                    {totalDotaGames !== null && (
                      <div className="bg-card/60 rounded-xl p-2 text-center border border-border/50">
                        <p className="text-base sm:text-lg font-black text-foreground">{totalDotaGames.toLocaleString()}</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">Games</p>
                      </div>
                    )}
                    {dotaWinrate !== null && (
                      <div className={`rounded-xl p-2 text-center border ${dotaWinrate >= 50 ? 'bg-[#10b981]/8 border-[#10b981]/20' : 'bg-[#ef4444]/8 border-[#ef4444]/20'}`}>
                        <p className={`text-base sm:text-lg font-black ${dotaWinrate >= 50 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                          {dotaWinrate.toFixed(1)}%
                        </p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">Win Rate</p>
                      </div>
                    )}
                    {winLoss && (
                      <>
                        <div className="bg-[#10b981]/8 rounded-xl p-2 text-center border border-[#10b981]/20">
                          <p className="text-base sm:text-lg font-black text-[#10b981]">{(winLoss.win || 0).toLocaleString()}</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">Wins</p>
                        </div>
                        <div className="bg-[#ef4444]/8 rounded-xl p-2 text-center border border-[#ef4444]/20">
                          <p className="text-base sm:text-lg font-black text-[#ef4444]">{(winLoss.lose || 0).toLocaleString()}</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">Losses</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* No data fallback */}
                {!hasDotaRank && topHeroes.length === 0 && !winLoss && (
                  <div className="px-4 pb-4">
                    <p className="text-xs text-muted-foreground text-center py-2">OpenDota data not yet synced</p>
                  </div>
                )}
              </div>
            )}

            {/* ── KERNEL KUP CAREER ──────────────────────────── */}
            {loadingKkupStats && (
              <div className="bg-harvest/5 rounded-2xl p-6 border-2 border-harvest/10 flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-harvest border-t-transparent" />
              </div>
            )}

            {kkupStats && kkupStats.linked && (
              <div className="bg-gradient-to-br from-harvest/8 to-harvest/3 rounded-2xl border-2 border-harvest/20 overflow-hidden">
                {/* Section header */}
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <TrophyImage type="kernel_kup_champion" size="sm" /> Kernel Kup Career
                  </p>
                  {kkupStats.current_registration && (
                    <span className="px-2.5 py-1 rounded-full bg-[#10b981]/15 text-[#10b981] text-[10px] font-bold flex items-center gap-1 animate-pulse">
                      <Zap className="w-3 h-3" /> {kkupStats.current_registration.tournament_name}
                    </span>
                  )}
                </div>

                {/* Trophy shelf */}
                {(kkupStats.championships.total > 0 || kkupStats.popd_kernels > 0) && (
                  <div className="px-4 pb-3">
                    <div className="flex gap-2">
                      {kkupStats.championships.kernel_kup > 0 && (
                        <div className="flex-1 bg-card/70 rounded-xl p-3 text-center border border-harvest/15">
                          <div className="flex justify-center mb-1">
                            <TrophyImage type="kernel_kup_champion" size="xl" />
                          </div>
                          <p className="text-xl font-black text-harvest">{kkupStats.championships.kernel_kup}x</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">KK Champ</p>
                        </div>
                      )}
                      {kkupStats.championships.heaps_n_hooks > 0 && (
                        <div className="flex-1 bg-card/70 rounded-xl p-3 text-center border border-[#10b981]/15">
                          <span className="text-2xl block mb-1">{'\u2693'}</span>
                          <p className="text-xl font-black text-[#10b981]">{kkupStats.championships.heaps_n_hooks}x</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">H&H Champ</p>
                        </div>
                      )}
                      {kkupStats.popd_kernels > 0 && (
                        <div className="flex-1 bg-card/70 rounded-xl p-3 text-center border border-[#dc2626]/15">
                          <div className="flex justify-center mb-1">
                            <TrophyImage type="popd_kernel_mvp" size="xl" />
                          </div>
                          <p className="text-xl font-black text-[#dc2626]">{kkupStats.popd_kernels}x</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Pop'd Kernel</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Stats grid */}
                <div className="px-4 pb-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-card/60 rounded-xl p-2.5 text-center border border-border/50">
                      <p className="text-lg font-black text-foreground">{kkupStats.tournaments_played}</p>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">Tourneys</p>
                    </div>
                    <div className="bg-card/60 rounded-xl p-2.5 text-center border border-border/50">
                      <p className="text-lg font-black">
                        <span className="text-[#10b981]">{kkupStats.wins}</span>
                        <span className="text-muted-foreground/30">-</span>
                        <span className="text-[#ef4444]">{kkupStats.losses}</span>
                      </p>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">W-L</p>
                    </div>
                    {kkupStats.total_games > 0 ? (
                      <div className={`rounded-xl p-2.5 text-center border ${((kkupStats.wins / kkupStats.total_games) * 100) >= 50 ? 'bg-[#10b981]/8 border-[#10b981]/20' : 'bg-[#ef4444]/8 border-[#ef4444]/20'}`}>
                        <p className={`text-lg font-black ${((kkupStats.wins / kkupStats.total_games) * 100) >= 50 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                          {((kkupStats.wins / kkupStats.total_games) * 100).toFixed(0)}%
                        </p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">Win Rate</p>
                      </div>
                    ) : (
                      <div className="bg-card/60 rounded-xl p-2.5 text-center border border-border/50">
                        <p className="text-lg font-black text-muted-foreground">-</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">Win Rate</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Most Played Hero + KDA row */}
                {kkupStats.total_games > 0 && (
                  <div className="px-4 pb-4 space-y-2">
                    {/* Most Played Hero */}
                    {kkupStats.most_played_hero && (
                      <div className="bg-card/60 rounded-xl p-3 border border-border/50 flex items-center gap-3">
                        {(() => {
                          const heroImg = getHeroImageByName(kkupStats.most_played_hero.name);
                          return heroImg ? (
                            <img src={heroImg} alt={kkupStats.most_played_hero.name} className="w-12 h-8 sm:w-14 sm:h-9 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                          ) : null;
                        })()}
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                            <Star className="w-3 h-3 text-harvest" /> KKup Signature Hero
                          </p>
                          <p className="text-sm font-black text-foreground truncate">{kkupStats.most_played_hero.name}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-black text-harvest">{kkupStats.most_played_hero.games}</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">Games</p>
                        </div>
                      </div>
                    )}

                    {/* Avg KDA */}
                    <div className="bg-card/60 rounded-xl p-3 border border-border/50">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Avg KDA / Game</p>
                        <p className="text-sm font-black">
                          <span className="text-[#10b981]">{(kkupStats.total_kills / kkupStats.total_games).toFixed(1)}</span>
                          <span className="text-muted-foreground/30"> / </span>
                          <span className="text-[#ef4444]">{(kkupStats.total_deaths / kkupStats.total_games).toFixed(1)}</span>
                          <span className="text-muted-foreground/30"> / </span>
                          <span className="text-[#3b82f6]">{(kkupStats.total_assists / kkupStats.total_games).toFixed(1)}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {kkupStats.championships.total === 0 && kkupStats.popd_kernels === 0 && kkupStats.tournaments_played === 0 && (
                  <div className="px-4 pb-4">
                    <p className="text-xs text-muted-foreground text-center py-1">
                      Linked to Kernel Kup profile — no tournament history yet
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── MEMBER SINCE ───────────────────────────────── */}
            <div className="bg-muted rounded-2xl p-4 border-2 border-border">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">Member Since</p>
                  <p className="text-sm font-semibold text-foreground">{formatDateLong(u.created_at)}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function getMedalAccent(medal: string): string {
  const accents: Record<string, string> = {
    Herald: '#8b7355', Guardian: '#a0a0a0', Crusader: '#3cb371', Archon: '#daa520',
    Legend: '#ffd700', Ancient: '#ff6347', Divine: '#6495ed', Immortal: '#ff4500',
  };
  return accents[medal] || '#888888';
}