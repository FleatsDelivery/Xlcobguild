/**
 * Tournament Teams Tab — Phase-Agnostic
 *
 * Completed / Archived  → Final Standings: placement-ordered, stats right-aligned, always-open rosters with fav hero
 * Active phases         → Teams list with rosters
 * Early phases          → Team formation preview
 */

import { useEffect, useMemo, useState } from 'react';
import { Shield, Users, Lock, Trophy, Crown, Loader2, Sword, GraduationCap, Send, Check, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { rankToNumeric, numericToRank, getRankDisplay } from '@/lib/rank-utils';
import { CoachHeadsetAvatar } from '../coach-headset-avatar';
import { useTournament } from '@/app/contexts/tournament-context';
import { isFinished } from '../tournament-state-config';
import { TeamLogo } from '../team-logo';
import { TcfPlusAvatarRing } from '../tcf-plus-avatar-ring';
import { RankBadge } from '../rank-badge';
import { Footer } from '@/app/components/footer';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { getHeroImageByName } from '@/lib/dota-heroes';
import { TabNoData } from '../tab-no-data';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface TeamData {
  id: string;
  team_name: string;
  team_tag: string;
  captain_person_id: string;
  approval_status: string;
  placement: number | null;
  valve_team_id: number | null;
  wins: number;
  losses: number;
  total_matches: number;
  avg_kills: number;
  avg_deaths: number;
  avg_assists: number;
  avg_gpm: number;
  avg_xpm: number;
  top_heroes: Array<{ name: string; count: number }>;
  roster: RosterPlayer[];
  roster_count: number;
  coach: RosterPlayer | null;
}

interface RosterPlayer {
  person_id: string;
  player_name: string;
  avatar_url: string | null;
  steam_id: string | null;
  tcf_plus_active: boolean;
  badge_rank: { medal: string; stars: number } | null;
  is_captain: boolean;
  fav_hero: string | null;
}

// ═══════════════════════════════════════════════════════
// PLACEMENT CONFIG — single source of truth
// ═══════════════════════════════════════════════════════

interface PlacementStyle {
  border: string;
  headerBg: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  icon: 'crown' | 'trophy' | null;
  label: string;
}

const PLACEMENT_STYLES: Record<number, PlacementStyle> = {
  1: {
    border: 'border-[#ffd700]/60',
    headerBg: 'bg-[#ffd700]/10',
    badgeBg: 'bg-[#ffd700]/15',
    badgeText: 'text-[#ffd700]',
    badgeBorder: 'border-[#ffd700]/40',
    icon: 'crown',
    label: '1st',
  },
  2: {
    border: 'border-[#c0c0c0]/50',
    headerBg: 'bg-[#c0c0c0]/8',
    badgeBg: 'bg-[#c0c0c0]/15',
    badgeText: 'text-[#c0c0c0]',
    badgeBorder: 'border-[#c0c0c0]/40',
    icon: 'trophy',
    label: '2nd',
  },
  3: {
    border: 'border-[#cd7f32]/50',
    headerBg: 'bg-[#cd7f32]/8',
    badgeBg: 'bg-[#cd7f32]/15',
    badgeText: 'text-[#cd7f32]',
    badgeBorder: 'border-[#cd7f32]/40',
    icon: 'trophy',
    label: '3rd',
  },
};

const DEFAULT_STYLE: PlacementStyle = {
  border: 'border-border',
  headerBg: 'bg-muted/50',
  badgeBg: 'bg-muted',
  badgeText: 'text-muted-foreground',
  badgeBorder: 'border-border',
  icon: null,
  label: '',
};

function getStyle(p: number | null): PlacementStyle {
  if (!p) return DEFAULT_STYLE;
  return PLACEMENT_STYLES[p] || { ...DEFAULT_STYLE, label: `${p}th` };
}

function ordinal(n: number) {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

// ═══════════════════════════════════════════════════════
// HERO IMAGE — small portrait, silent on error
// ═══════════════════════════════════════════════════════

function HeroPortrait({ name, size = 'sm' }: { name: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'lg' ? 'w-10 h-10' : size === 'md' ? 'w-7 h-7' : 'w-6 h-6';
  if (!name) return null;
  const url = getHeroImageByName(name);
  if (!url) return <Sword className={`${size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} text-muted-foreground flex-shrink-0`} />;
  return (
    <img
      src={url}
      alt={name}
      title={name}
      className={`${px} rounded object-cover flex-shrink-0`}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

// ═══════════════════════════════════════════════════════
// HERO CHIP — top picks row
// ═══════════════════════════════════════════════════════

function HeroChip({ hero }: { hero: { name: string; count: number } }) {
  const url = getHeroImageByName(hero.name);
  return (
    <div
      className="flex items-center gap-1.5 bg-card/60 rounded-lg px-2 py-1 border border-border/60"
      title={`${hero.name} (×${hero.count})`}
    >
      {url ? (
        <img src={url} alt={hero.name} className="w-5 h-5 rounded object-cover flex-shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <Sword className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      )}
      <span className="text-xs font-semibold text-foreground max-w-[72px] truncate leading-none">{hero.name}</span>
      <span className="text-[10px] text-muted-foreground flex-shrink-0">×{hero.count}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// STAT CHIP — K / D / A / GPM / XPM
// ═══════════════════════════════════════════════════════

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm font-bold" style={{ color }}>{value}</span>
    </span>
  );
}

// ═══════════════════════════════════════════════════════
// SEEDING / PLACEMENT BADGE — top-left of card, inline above logo
// ═══════════════════════════════════════════════════════

function PlacementBadge({ placement }: { placement: number | null }) {
  if (!placement) return null;
  const style = getStyle(placement);
  const label = ordinal(placement);
  return (
    <div className={`flex items-center gap-1 ${style.badgeBg} ${style.badgeText} rounded-full pl-2 pr-2.5 py-1 border ${style.badgeBorder}`}>
      {style.icon === 'crown' && <Crown className="w-3.5 h-3.5 flex-shrink-0" />}
      {style.icon === 'trophy' && <Trophy className="w-3.5 h-3.5 flex-shrink-0" />}
      <span className="text-xs font-bold leading-none">{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PLAYER CARD — inside roster grid
// ═══════════════════════════════════════════════════════

function PlayerCard({ player }: { player: RosterPlayer }) {
  const dotabuffUrl = player.steam_id ? `https://www.dotabuff.com/players/${player.steam_id}` : null;
  const opendotaUrl = player.steam_id ? `https://www.opendota.com/players/${player.steam_id}` : null;

  return (
    <div className="bg-muted rounded-xl p-2.5 flex items-center gap-2.5 border border-border min-w-0">
      {/* Avatar + ring + captain crown → OpenDota link */}
      <div className="relative flex-shrink-0">
        <a
          href={opendotaUrl || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={opendotaUrl ? 'hover:opacity-80 transition-opacity' : 'cursor-default'}
          title={opendotaUrl ? 'View on OpenDota' : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <TcfPlusAvatarRing active={player.tcf_plus_active} size="xs">
            {player.avatar_url ? (
              <img
                src={player.avatar_url}
                alt={player.player_name}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-harvest/20 flex items-center justify-center">
                <span className="text-sm font-bold text-harvest">
                  {player.player_name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </TcfPlusAvatarRing>
        </a>
        {player.is_captain && (
          <div className="absolute -top-1 -right-1 bg-harvest rounded-full p-0.5 z-20">
            <Crown className="w-2.5 h-2.5 text-soil" />
          </div>
        )}
      </div>

      {/* Name → Dotabuff link + rank */}
      <div className="flex-1 min-w-0">
        <a
          href={dotabuffUrl || undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`font-semibold text-sm truncate block ${dotabuffUrl ? 'text-foreground hover:text-harvest transition-colors' : 'text-foreground cursor-default'}`}
          title={dotabuffUrl ? 'View on Dotabuff' : undefined}
        >
          {player.player_name}
        </a>
        {player.badge_rank?.medal && (
          <div className="flex items-center gap-1 mt-0.5">
            <RankBadge medal={player.badge_rank.medal} stars={player.badge_rank.stars ?? 0} size="xs" />
            <span className="text-[10px] text-muted-foreground font-semibold">
              {player.badge_rank.medal}{player.badge_rank.stars > 0 ? ` ${player.badge_rank.stars}` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Fav Hero — right side */}
      {player.fav_hero && (
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide leading-none">Fav</span>
          <HeroPortrait name={player.fav_hero} size="md" />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════��═══
// COACH CARD — inside roster, spans full width
// ═══════════════════════════════════════════════════════

function CoachCard({ coach }: { coach: RosterPlayer }) {
  const dotabuffUrl = coach.steam_id ? `https://www.dotabuff.com/players/${coach.steam_id}` : null;
  const opendotaUrl = coach.steam_id ? `https://www.opendota.com/players/${coach.steam_id}` : null;

  return (
    <div className="col-span-full bg-[#10b981]/8 rounded-xl p-2.5 flex items-center gap-3 border border-[#10b981]/25 min-w-0">
      {/* Headset avatar → OpenDota link */}
      <a
        href={opendotaUrl || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex-shrink-0 ${opendotaUrl ? 'hover:opacity-80 transition-opacity' : 'cursor-default'}`}
        title={opendotaUrl ? 'View on OpenDota' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <CoachHeadsetAvatar
          coach={{ display_name: coach.player_name, avatar_url: coach.avatar_url || undefined }}
          size={36}
        />
      </a>

      {/* Name → Dotabuff link + label */}
      <div className="flex-1 min-w-0">
        <a
          href={dotabuffUrl || undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`font-semibold text-sm truncate block ${dotabuffUrl ? 'text-foreground hover:text-harvest transition-colors' : 'text-foreground cursor-default'}`}
          title={dotabuffUrl ? 'View on Dotabuff' : undefined}
        >
          {coach.player_name}
        </a>
        <div className="flex items-center gap-1 mt-0.5">
          <GraduationCap className="w-3 h-3 text-[#10b981] flex-shrink-0" />
          <span className="text-[10px] font-bold text-[#10b981] uppercase tracking-wide">Coach</span>
          {coach.tcf_plus_active && (
            <span className="text-[10px] text-harvest font-semibold ml-1">· TCF+</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// FINISHED TEAM CARD — completed / archived
// ═══════════════════════════════════════════════════════

function FinishedTeamCard({ team, tournament }: { team: TeamData; tournament: any }) {
  const style = getStyle(team.placement);
  const isChampion = team.placement === 1;
  const hasStats = team.total_matches > 0;

  return (
    <div
      className={`relative bg-card rounded-2xl border-2 overflow-hidden transition-all ${style.border} ${
        isChampion ? 'shadow-[0_0_32px_rgba(255,215,0,0.10)]' : ''
      }`}
    >
      {/* ── HEADER: Logo+Identity left, Stats+Heroes right ── */}
      <div className={`p-4 sm:p-5 ${style.headerBg}`}>
        {/* Outer row: badge+logo column left, name+stats block right */}
        <div className="flex items-start gap-3 md:gap-4">

          {/* Left column: placement badge stacked above logo */}
          <div className="flex-shrink-0 flex flex-col items-start gap-1.5">
            <PlacementBadge placement={team.placement} />
            <TeamLogo
              teamTag={team.team_tag}
              tournamentName={tournament.name}
              size={isChampion ? 'xl' : 'lg'}
            />
          </div>

          {/* Middle: name + tag + big score + mobile stats/heroes */}
          <div className="flex-1 min-w-0">
            {/* Name [Tag] on one line */}
            <h3 className={`font-bold truncate text-foreground leading-tight ${isChampion ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'}`}>
              {team.team_name}{' '}
              <span className="text-muted-foreground font-semibold">[{team.team_tag}]</span>
            </h3>

            {/* Big W–L score */}
            {hasStats && (
              <div className={`font-bold leading-none mt-1 ${isChampion ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'}`}>
                <span style={{ color: '#10b981' }}>{team.wins}</span>
                <span className="text-muted-foreground mx-1">–</span>
                <span style={{ color: '#ef4444' }}>{team.losses}</span>
              </div>
            )}

            {/* Team ID */}
            <div className="mt-1">
              {team.valve_team_id && team.valve_team_id > 0 ? (
                <span className="text-xs font-semibold text-muted-foreground">
                  ID: {team.valve_team_id}
                </span>
              ) : (
                <span className="text-xs font-semibold text-muted-foreground/50 italic">
                  Team ID Unavailable
                </span>
              )}
            </div>

            {/* Fav Heroes — mobile/sm only, above stats */}
            {hasStats && team.top_heroes.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2 md:hidden">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Fav Heroes</span>
                {team.top_heroes.map((h) => <HeroChip key={h.name} hero={h} />)}
              </div>
            )}

            {/* Stats inline — mobile/sm only, below heroes */}
            {hasStats && (
              <div className="flex items-center gap-3 flex-wrap mt-1.5 md:hidden">
                <StatChip label="K" value={team.avg_kills.toFixed(1)} color="#10b981" />
                <StatChip label="D" value={team.avg_deaths.toFixed(1)} color="#ef4444" />
                <StatChip label="A" value={team.avg_assists.toFixed(1)} color="#3b82f6" />
                <StatChip label="GPM" value={team.avg_gpm.toLocaleString()} color="#f59e0b" />
                <StatChip label="XPM" value={team.avg_xpm.toLocaleString()} color="#8b5cf6" />
              </div>
            )}
          </div>

          {/* RIGHT column — heroes then stats, only on md+ */}
          {hasStats && (
            <div className="hidden md:flex flex-col gap-2 items-end flex-shrink-0">
              {/* Fav Heroes — top */}
              {team.top_heroes.length > 0 && (
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Fav Heroes</span>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {team.top_heroes.map((h) => <HeroChip key={h.name} hero={h} />)}
                  </div>
                </div>
              )}
              {/* AVG STATS — below heroes */}
              <div className="flex flex-col gap-1 items-end">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">AVG STATS</span>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <StatChip label="Kills" value={team.avg_kills.toFixed(1)} color="#10b981" />
                  <StatChip label="Deaths" value={team.avg_deaths.toFixed(1)} color="#ef4444" />
                  <StatChip label="Assists" value={team.avg_assists.toFixed(1)} color="#3b82f6" />
                  <StatChip label="GPM" value={team.avg_gpm.toLocaleString()} color="#f59e0b" />
                  <StatChip label="XPM" value={team.avg_xpm.toLocaleString()} color="#8b5cf6" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ROSTER — always visible, coach first then players ── */}
      {(team.roster.length > 0 || team.coach) && (
        <div className="border-t-2 border-border">
          <div className="px-3 sm:px-4 py-1.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
              Roster ({team.roster.length}{team.coach ? ' + coach' : ''})
            </span>
          </div>
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Coach card spans both columns, appears at the top */}
              {team.coach && <CoachCard coach={team.coach} />}
              {team.roster.map((player) => (
                <PlayerCard key={player.person_id} player={player} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// FINISHED TEAMS LIST — strict top-to-bottom by placement
// ═══════════════════════════════════════════════════════

function FinishedTeamsList({ teams, tournament }: { teams: TeamData[]; tournament: any }) {
  const sorted = useMemo(() => {
    const winnerId = tournament.winning_team_id as string | undefined;

    const copy = [...teams].sort((a, b) => {
      // Winner is always pinned to #1, regardless of stored placement or record
      if (winnerId) {
        if (a.id === winnerId) return -1;
        if (b.id === winnerId) return 1;
      }
      // Both have stored placements — trust them
      if (a.placement !== null && b.placement !== null) return a.placement - b.placement;
      if (a.placement !== null) return -1;
      if (b.placement !== null) return 1;
      // Neither has a placement — sort by record: wins desc, then losses asc
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.losses - b.losses;
    });

    // Compute effective placement so the badge is always accurate:
    // winner → 1 (locked), rest → stored placement if present, else their sorted position
    return copy.map((team, idx) => ({
      ...team,
      placement: team.id === winnerId
        ? 1
        : (team.placement ?? idx + 1),
    }));
  }, [teams, tournament.winning_team_id]);

  if (sorted.length === 0) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-8 text-center">
        <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">No Team Data</h3>
        <p className="text-muted-foreground">Final standings have not been recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
        Final Standings
        <span className="text-muted-foreground font-semibold text-lg ml-2">({sorted.length})</span>
      </h2>

      {/* Every team gets its own full-width row */}
      {sorted.map((t) => (
        <FinishedTeamCard key={t.id} team={t} tournament={tournament} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TEAM FORMATION PREVIEW (Upcoming / Reg_Open)
// ═══════════════════════════════════════════════════════

function TeamFormationPreview({ tournament }: { tournament: any }) {
  const teamSize     = tournament.team_size     || 6;
  const teamCapacity = tournament.team_capacity || 16;

  return (
    <div className="bg-card rounded-2xl border-2 border-border p-6 sm:p-8">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-harvest/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <Shield className="w-6 h-6 text-harvest" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Team Format</h2>
          <p className="text-muted-foreground">
            This tournament features{' '}
            <span className="font-semibold text-foreground">{teamCapacity} teams</span> of{' '}
            <span className="font-semibold text-foreground">{teamSize} players</span> each.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-muted rounded-xl p-4">
          <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#3b82f6]" /> How Teams Work
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><span className="text-foreground">•</span><span>Any registered player can create a team</span></li>
            <li className="flex gap-2"><span className="text-foreground">•</span><span>Team captains send invites to other players</span></li>
            <li className="flex gap-2"><span className="text-foreground">•</span><span>Players can accept or decline invites</span></li>
            <li className="flex gap-2"><span className="text-foreground">•</span><span>Teams need {teamSize} players to be eligible</span></li>
          </ul>
        </div>
        <div className="bg-muted rounded-xl p-4">
          <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#f59e0b]" /> Important Dates
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><span className="text-foreground">•</span>
              <span><span className="font-semibold text-foreground">Registration Opens:</span>{' '}
                {tournament.registration_start_date ? new Date(tournament.registration_start_date).toLocaleDateString() : 'TBA'}
              </span>
            </li>
            <li className="flex gap-2"><span className="text-foreground">•</span>
              <span><span className="font-semibold text-foreground">Roster Lock:</span>{' '}
                {tournament.roster_lock_date ? new Date(tournament.roster_lock_date).toLocaleDateString() : 'TBA'}
              </span>
            </li>
            <li className="flex gap-2"><span className="text-foreground">•</span>
              <span><span className="font-semibold text-foreground">Tournament Starts:</span>{' '}
                {tournament.tournament_start_date ? new Date(tournament.tournament_start_date).toLocaleDateString() : 'TBA'}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TEAM AVG RANK — computed from roster + coach badge_rank
// ═══════════════════════════════════════════════════════

function computeTeamAvgRank(roster: any[], coach: any | null): { medal: string; stars: number } | null {
  const numerics: number[] = [];
  const all = [...roster, ...(coach ? [coach] : [])];
  for (const p of all) {
    const rd = getRankDisplay(p.badge_rank);
    if (rd) numerics.push(rankToNumeric(rd.medal, rd.stars));
  }
  if (numerics.length === 0) return null;
  const avg = numerics.reduce((s, v) => s + v, 0) / numerics.length;
  return numericToRank(avg);
}

// ═══════════════════════════════════════════════════════
// ACTIVE TEAM CARD — reg_closed / roster_lock / live
// ═══════════════════════════════════════════════════════

interface JoinRequestCtx {
  /** Can the current user request to join teams? (free agent, not a captain) */
  canRequest: boolean;
  /** Map of teamId → 'pending' | 'sending' */
  requestedTeams: Record<string, 'pending' | 'sending'>;
  onRequest: (teamId: string, teamName: string) => void;
}

function ActiveTeamCard({
  team,
  tournament,
  joinCtx,
}: {
  team: any;
  tournament: any;
  joinCtx?: JoinRequestCtx;
}) {
  const avgRank = computeTeamAvgRank(team.roster || [], team.coach || null);

  return (
    <div className="bg-card rounded-2xl border-2 border-border overflow-hidden hover:border-harvest/30 transition-all">
      {/* ── Header ── */}
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <TeamLogo teamTag={team.team_tag} tournamentName={tournament.name} size="lg" />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-foreground truncate">{team.team_name}</h3>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className="text-sm text-muted-foreground font-semibold">{team.team_tag}</span>
              {/* Approval badge */}
              {team.approval_status && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  team.approval_status === 'approved' ? 'bg-[#10b981]/10 text-[#10b981]' :
                  team.approval_status === 'denied'   ? 'bg-[#ef4444]/10 text-[#ef4444]' :
                                                        'bg-[#f59e0b]/10 text-[#f59e0b]'
                }`}>
                  {team.approval_status === 'approved' ? '✓ Approved' :
                   team.approval_status === 'denied' ? '✗ Denied' : '⏳ Pending'}
                </span>
              )}
            </div>
          </div>

          {/* Right side: Team Rank + optional join request button */}
          <div className="flex-shrink-0 flex flex-col items-center gap-2">
            {/* Join Request button — only for eligible free agents, approved teams */}
            {joinCtx?.canRequest && team.approval_status === 'approved' && (() => {
              const reqState = joinCtx.requestedTeams[team.id];
              const isSending = reqState === 'sending';
              const alreadyRequested = reqState === 'pending';
              return (
                <button
                  onClick={() => joinCtx.onRequest(team.id, team.team_name)}
                  disabled={isSending || alreadyRequested}
                  className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all ${
                    alreadyRequested
                      ? 'bg-[#10b981]/10 text-[#10b981] cursor-default border border-[#10b981]/20'
                      : isSending
                      ? 'bg-harvest/10 text-harvest/60 cursor-not-allowed border border-harvest/20'
                      : 'bg-harvest/10 text-harvest hover:bg-harvest/20 active:scale-95 border border-harvest/20'
                  }`}
                >
                  {alreadyRequested ? (
                    <><Check className="w-3 h-3" />Requested</>
                  ) : isSending ? (
                    <><Loader2 className="w-3 h-3 animate-spin" />Sending</>
                  ) : (
                    <><Send className="w-3 h-3" />Request to Join</>
                  )}
                </button>
              );
            })()}

            <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide leading-none">Team Rank</span>
            {avgRank ? (
              <>
                <RankBadge medal={avgRank.medal} stars={avgRank.stars} size="md" />
                <span className="text-[11px] font-semibold text-muted-foreground leading-none">
                  {avgRank.medal}{avgRank.stars > 0 ? ` ${avgRank.stars}` : ''}
                </span>
              </>
            ) : (
              <>
                <RankBadge medal="Unranked" stars={0} size="md" />
                <span className="text-[11px] font-semibold text-muted-foreground leading-none">Unranked</span>
              </>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Roster ── */}
      {((team.roster && team.roster.length > 0) || team.coach) && (
        <div className="border-t-2 border-border p-3 sm:p-4 bg-muted/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Coach — full-width, green bg */}
            {team.coach && (
              <div className="col-span-full bg-[#10b981]/8 rounded-xl p-2.5 flex items-center gap-2.5 border border-[#10b981]/25 min-w-0">
                <a
                  href={team.coach.steam_id ? `https://www.opendota.com/players/${team.coach.steam_id}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex-shrink-0 ${team.coach.steam_id ? 'hover:opacity-80 transition-opacity' : 'cursor-default'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <CoachHeadsetAvatar
                    coach={{ display_name: team.coach.player_name, avatar_url: team.coach.avatar_url || undefined }}
                    size={36}
                  />
                </a>
                <div className="flex-1 min-w-0">
                  <a
                    href={team.coach.steam_id ? `https://www.dotabuff.com/players/${team.coach.steam_id}` : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`font-semibold text-sm truncate block ${team.coach.steam_id ? 'text-foreground hover:text-harvest transition-colors' : 'text-foreground cursor-default'}`}
                  >
                    {team.coach.player_name}
                  </a>
                  <div className="flex items-center gap-1 mt-0.5">
                    <GraduationCap className="w-3 h-3 text-[#10b981] flex-shrink-0" />
                    <span className="text-[10px] font-bold text-[#10b981] uppercase tracking-wide">Coach</span>
                    {team.coach.tcf_plus_active && (
                      <span className="text-[10px] text-harvest font-semibold ml-1">· TCF+</span>
                    )}
                  </div>
                  {team.coach.badge_rank?.medal && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <RankBadge medal={team.coach.badge_rank.medal} stars={team.coach.badge_rank.stars ?? 0} size="xs" />
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        {team.coach.badge_rank.medal}{(team.coach.badge_rank.stars ?? 0) > 0 ? ` ${team.coach.badge_rank.stars}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Players */}
            {(team.roster || []).map((player: any) => {
              const dotabuffUrl = player.steam_id ? `https://www.dotabuff.com/players/${player.steam_id}` : null;
              const opendotaUrl = player.steam_id ? `https://www.opendota.com/players/${player.steam_id}` : null;
              return (
                <div key={player.person_id} className="bg-card rounded-lg p-2.5 flex items-center gap-2.5 border border-border min-w-0">
                  {/* Avatar + TCF+ ring + captain crown */}
                  <div className="relative flex-shrink-0">
                    <a
                      href={opendotaUrl || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={opendotaUrl ? 'hover:opacity-80 transition-opacity' : 'cursor-default'}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <TcfPlusAvatarRing active={player.tcf_plus_active} size="xs">
                        {player.avatar_url ? (
                          <img src={player.avatar_url} alt={player.player_name} className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-harvest/20 flex items-center justify-center">
                            <span className="text-sm font-bold text-harvest">{player.player_name?.charAt(0).toUpperCase() || '?'}</span>
                          </div>
                        )}
                      </TcfPlusAvatarRing>
                    </a>
                    {player.is_captain && (
                      <div className="absolute -top-1 -right-1 bg-harvest rounded-full p-0.5 z-20">
                        <Crown className="w-2.5 h-2.5 text-soil" />
                      </div>
                    )}
                  </div>
                  {/* Name — truncates to make room for rank badge */}
                  <div className="flex-1 min-w-0">
                    <a
                      href={dotabuffUrl || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={`font-semibold text-sm truncate block ${dotabuffUrl ? 'text-foreground hover:text-harvest transition-colors' : 'text-foreground cursor-default'}`}
                    >
                      {player.player_name || 'Unknown'}
                    </a>
                  </div>
                  {/* Rank badge — right side, larger */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
                    {player.badge_rank?.medal ? (
                      <>
                        <RankBadge medal={player.badge_rank.medal} stars={player.badge_rank.stars ?? 0} size="sm" />
                        <span className="text-[10px] text-muted-foreground font-semibold leading-none">
                          {player.badge_rank.medal}{(player.badge_rank.stars ?? 0) > 0 ? ` ${player.badge_rank.stars}` : ''}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/50 leading-none">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ACTIVE TEAMS LIST
// ═══════════════════════════════════════════════════════

function ActiveTeamsList({
  teams,
  tournament,
  joinCtx,
}: {
  teams: any[];
  tournament: any;
  joinCtx?: JoinRequestCtx;
}) {
  if (!teams || teams.length === 0) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-8 text-center">
        <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">No Teams Yet</h3>
        <p className="text-muted-foreground">Teams will appear here as players form their rosters.</p>
      </div>
    );
  }
  const sorted = [...teams].sort((a, b) => {
    if (a.approval_status === 'approved' && b.approval_status !== 'approved') return -1;
    if (b.approval_status === 'approved' && a.approval_status !== 'approved') return 1;
    return (a.team_name || '').localeCompare(b.team_name || '');
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-foreground">Teams ({teams.length})</h2>
        {joinCtx?.canRequest && (
          <span className="text-xs font-semibold text-muted-foreground bg-card border border-border rounded-full px-3 py-1">
            You're a free agent — request to join any approved team
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sorted.map((team) => (
          <ActiveTeamCard key={team.id} team={team} tournament={tournament} joinCtx={joinCtx} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN TAB COMPONENT
// ═══════════════════════════════════════════════════════

export function TournamentTeamsTab() {
  const { tournament, myRegistration, accessToken } = useTournament();
  const [teams, setTeams]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Join-request state: teamId → 'pending' | 'sending'
  const [requestedTeams, setRequestedTeams] = useState<Record<string, 'pending' | 'sending'>>({});
  // Whether the current user is a free agent (not a captain, not on a team)
  const [isFreeAgent, setIsFreeAgent] = useState(false);

  const finished    = tournament ? isFinished(tournament.status) : false;
  const showPreview = tournament ? ['registration_open'].includes(tournament.status) : false;
  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;
  const token = accessToken || localStorage.getItem('supabase_token') || publicAnonKey;

  useEffect(() => {
    if (!tournament) return;
    // D1 — Upcoming: no teams yet, skip fetch
    if (tournament.status === 'upcoming') return;
    fetchTeams();
  }, [tournament]);

  // Determine if user is an eligible free agent for join requests
  useEffect(() => {
    if (!myRegistration || !tournament) return;
    if (!['registration_closed', 'roster_lock'].includes(tournament.status)) return;
    const reg = myRegistration as any;
    // Free agent = registered, not withdrawn, not on_team, not a coach
    const eligible = reg.status === 'registered' || reg.status === 'free_agent';
    if (!eligible) return;

    // Also check they're not a captain
    const myPersonId = reg.person_id;
    if (!myPersonId) return;

    // We'll check against the loaded teams
    setIsFreeAgent(true);
    // Load existing pending join requests to pre-populate state
    loadMyJoinRequests();
  }, [myRegistration, tournament, teams]);

  const loadMyJoinRequests = async () => {
    if (!tournament) return;
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournament.id}/my-join-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const { join_requests } = await res.json();
      const reqMap: Record<string, 'pending'> = {};
      for (const jr of (join_requests || [])) {
        if (jr.team_id) reqMap[jr.team_id] = 'pending';
      }
      setRequestedTeams(reqMap);
    } catch (err) {
      console.error('Non-critical: failed to load join requests:', err);
    }
  };

  const fetchTeams = async () => {
    if (!tournament) return;
    setLoading(true);
    try {
      const url = finished
        ? `${apiBase}/kkup/tournaments/${tournament.id}/stats/teams`
        : `${apiBase}/kkup/tournaments/${tournament.id}/teams`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams || []);
      } else {
        console.error('Failed to fetch teams:', await res.json().catch(() => ({})));
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRequest = async (teamId: string, teamName: string) => {
    if (!tournament) return;
    setRequestedTeams(prev => ({ ...prev, [teamId]: 'sending' }));
    try {
      const res = await fetch(
        `${apiBase}/kkup/tournaments/${tournament.id}/teams/${teamId}/join-request`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `Join request sent to "${teamName}"!`);
        setRequestedTeams(prev => ({ ...prev, [teamId]: 'pending' }));
      } else {
        toast.error(data.error || 'Failed to send join request.');
        setRequestedTeams(prev => {
          const next = { ...prev };
          delete next[teamId];
          return next;
        });
      }
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
      setRequestedTeams(prev => {
        const next = { ...prev };
        delete next[teamId];
        return next;
      });
    }
  };

  if (!tournament) return null;

  // D1 — Upcoming phase: team formation hasn't started
  if (tournament.status === 'upcoming') {
    return (
      <>
        <TabNoData
          icon={Shield}
          title="No Team Data Available"
          subtitle="Team formation hasn't started yet. Teams will appear here once registration opens and players begin forming squads."
          hint="Available from: Registration Open"
        />
        <Footer />
      </>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-harvest" />
          <div className="text-muted-foreground">Loading teams...</div>
        </div>
      </div>
    );
  }

  // User is a captain if they own one of the loaded teams
  const myPersonId = (myRegistration as any)?.person_id;
  const isCaptain = myPersonId
    ? teams.some(t => t.captain_person_id === myPersonId && t.approval_status !== 'withdrawn')
    : false;

  const joinCtx: JoinRequestCtx | undefined =
    (!finished && isFreeAgent && !isCaptain && ['registration_closed', 'roster_lock'].includes(tournament.status))
      ? { canRequest: true, requestedTeams, onRequest: handleJoinRequest }
      : undefined;

  return (
    <div className="space-y-6 sm:space-y-8">
      {showPreview && <TeamFormationPreview tournament={tournament} />}

      {finished ? (
        <FinishedTeamsList teams={teams as TeamData[]} tournament={tournament} />
      ) : (
        <ActiveTeamsList teams={teams} tournament={tournament} joinCtx={joinCtx} />
      )}

      <Footer />
    </div>
  );
}
