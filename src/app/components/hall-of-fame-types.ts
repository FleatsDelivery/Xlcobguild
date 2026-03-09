export interface HeroData {
  hero_id: number;
  hero_name: string;
  games: number;
  wins: number;
  winrate: string;
}

export interface PlayerStats {
  totalTournaments: number;
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  winrate: string;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalLastHits: number;
  totalDenies: number;
  avgKDA: string | number;
  avgGPM: string;
  avgXPM: string;
  totalNetWorth: number;
  avgNetWorth: number;
  championships: number;
  mvps: number;
  prizeWinnings: number; // cents
  signatureHero: HeroData | null;
  records: {
    bestKills: number;
    bestGPM: number;
    bestXPM: number;
  };
}

export interface HallOfFamePlayer {
  id: string;
  name: string;
  avatar_url: string | null;
  steam_id: string | null;
  user?: {
    id: string;
    discord_username: string;
    discord_avatar: string | null;
    rank_id: number | null;
    prestige_level: number;
    role: string;
  } | null;
  stats: PlayerStats | null;
  kernelKupStats: PlayerStats | null;
  heapsNHooksStats: PlayerStats | null;
}

export interface TeamStats {
  id: string;
  name: string;
  tag: string | null;
  logo_url: string | null;
  championships: number;
  popdKernels: number;
  prizeWinnings: number; // cents
  tournamentsPlayed: number;
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  winRate: string;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  kda: string | number;
  avgKills: string;
  avgDeaths: string;
  avgAssists: string;
  avgGPM: string;
  avgXPM: string;
}

export interface StaffRoleEntry {
  role: string;
  count: number;
}

export interface StaffStats {
  totalTournaments: number;
  primaryRole: string;
  allRoles: StaffRoleEntry[];
}

export interface HallOfFameStaff {
  id: string;
  name: string;
  avatar_url: string | null;
  steam_id: string | null;
  user?: {
    id: string;
    discord_username: string;
    discord_avatar: string | null;
    rank_id: number | null;
    prestige_level: number;
    role: string;
  } | null;
  allRoles: string[];
  stats: StaffStats | null;
  kernelKupStats: StaffStats | null;
  heapsNHooksStats: StaffStats | null;
}

export type PlayerSortKey =
  | 'name' | 'championships' | 'mvps' | 'prizeWinnings' | 'totalTournaments' | 'totalMatches'
  | 'totalWins' | 'totalLosses' | 'winrate' | 'totalKills' | 'totalDeaths'
  | 'totalAssists' | 'avgKDA' | 'avgGPM' | 'avgXPM' | 'totalLastHits'
  | 'totalDenies' | 'totalNetWorth' | 'avgNetWorth' | 'signatureHeroGames'
  | 'avgKills' | 'avgDeaths' | 'avgAssists' | 'avgLastHits' | 'avgDenies';

export type TeamSortKey =
  | 'name' | 'championships' | 'popdKernels' | 'prizeWinnings' | 'tournamentsPlayed'
  | 'totalMatches' | 'totalWins' | 'totalLosses' | 'winRate'
  | 'totalKills' | 'totalDeaths' | 'totalAssists' | 'kda' | 'avgGPM' | 'avgXPM';

export interface CoachStats {
  totalTournaments: number;
  championships: number;
  teamsCoached: number;
  teamNames: string[];
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  winrate: string;
}

export interface HallOfFameCoach {
  id: string;
  name: string;
  avatar_url: string | null;
  steam_id: string | null;
  user?: {
    id: string;
    discord_username: string;
    discord_avatar: string | null;
    rank_id: number | null;
    prestige_level: number;
    role: string;
  } | null;
  stats: CoachStats | null;
  kernelKupStats: CoachStats | null;
  heapsNHooksStats: CoachStats | null;
}

export type CoachSortKey =
  | 'name' | 'championships' | 'totalTournaments' | 'teamsCoached'
  | 'totalMatches' | 'totalWins' | 'totalLosses' | 'winrate';

export type SortOrder = 'asc' | 'desc';
export type TournamentType = 'all' | 'kernel_kup' | 'heaps_n_hooks';
export type StatsView = 'players' | 'teams' | 'coaches' | 'staff';