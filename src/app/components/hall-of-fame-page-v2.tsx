import { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, Crown, Users, ArrowUp, ArrowDown, Search
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { getHeroImageUrl } from '@/lib/dota-heroes';
import { Footer } from '@/app/components/footer';

interface HeroData {
  hero_id: number;
  hero_name: string;
  games: number;
  wins: number;
  winrate: string;
}

interface PlayerStats {
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
  totalHeroDamage: number;
  totalTowerDamage: number;
  totalHealing: number;
  championships: number;
  mvps: number;
  signatureHero: HeroData | null;
  records: {
    bestKills: number;
    bestGPM: number;
    bestXPM: number;
    bestHeroDamage: number;
    bestTowerDamage: number;
    bestHealing: number;
  };
}

interface HallOfFamePlayer {
  id: string;
  name: string;
  avatar_url: string | null;
  steam_id: string | null;
  user?: { // Changed from xlcobMember to match backend response
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

interface TeamStats {
  id: string;
  name: string;
  tag: string | null;
  logo_url: string | null;
  championships: number;
  popdKernels: number;
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

type PlayerSortKey = 
  | 'name' 
  | 'championships' 
  | 'mvps' 
  | 'totalTournaments' 
  | 'totalMatches' 
  | 'totalWins'
  | 'totalLosses'
  | 'winrate' 
  | 'totalKills' 
  | 'totalDeaths'
  | 'totalAssists'
  | 'avgKDA' 
  | 'avgGPM' 
  | 'avgXPM' 
  | 'totalLastHits'
  | 'totalDenies'
  | 'totalHeroDamage'
  | 'totalTowerDamage'
  | 'totalHealing';

type TeamSortKey =
  | 'name'
  | 'championships'
  | 'popdKernels'
  | 'tournamentsPlayed'
  | 'totalMatches'
  | 'totalWins'
  | 'totalLosses'
  | 'winRate'
  | 'totalKills'
  | 'totalDeaths'
  | 'totalAssists'
  | 'kda'
  | 'avgGPM'
  | 'avgXPM';

type SortOrder = 'asc' | 'desc';
type TournamentType = 'kernel_kup' | 'heaps_n_hooks';
type StatsView = 'players' | 'teams';

export function HallOfFamePage() {
  const [players, setPlayers] = useState<HallOfFamePlayer[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [kernelKupTeamStats, setKernelKupTeamStats] = useState<TeamStats[]>([]);
  const [heapsNHooksTeamStats, setHeapsNHooksTeamStats] = useState<TeamStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerSortField, setPlayerSortField] = useState<PlayerSortKey>('championships');
  const [playerSortOrder, setPlayerSortOrder] = useState<SortOrder>('desc');
  const [teamSortField, setTeamSortField] = useState<TeamSortKey>('championships');
  const [teamSortOrder, setTeamSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<TournamentType>('kernel_kup');
  const [statsView, setStatsView] = useState<StatsView>('players');
  const [overallStats, setOverallStats] = useState<{
    totalUniquePlayers: number;
    totalUniqueMatches: number;
    totalChampions: number;
    totalUniqueHeroes?: number;
  } | null>(null);

  // 🚀 PROGRESSIVE LOADING - Load players first, then teams only when needed
  const [playersLoading, setPlayersLoading] = useState(true);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsLoaded, setTeamsLoaded] = useState(false);

  useEffect(() => {
    fetchPlayers();
  }, []);

  // Fetch teams when user switches to Teams view
  useEffect(() => {
    if (statsView === 'teams' && !teamsLoaded && !teamsLoading) {
      fetchTeams();
    }
  }, [statsView, teamsLoaded, teamsLoading]);

  const fetchPlayers = async () => {
    try {
      setPlayersLoading(true);
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/hall-of-fame/players`;
      console.log('🏛️ Fetching Hall of Fame PLAYERS from:', url);
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 Hall of Fame players error response:', errorText);
        throw new Error(`Failed to fetch Hall of Fame player data: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('🏛️ Hall of Fame player data received:', data.players?.length, 'players');
      setPlayers(data.players || []);
      setOverallStats(data.overallStats || {
        totalUniquePlayers: data.players?.length || 0,
        totalUniqueMatches: 0,
        totalChampions: 0,
      });
    } catch (err: any) {
      console.error('🔴 Hall of Fame player fetch error:', err);
      setError(err.message);
    } finally {
      setPlayersLoading(false);
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      setTeamsLoading(true);
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/hall-of-fame/teams`;
      console.log('🏛️ Fetching Hall of Fame TEAMS from:', url);
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔴 Hall of Fame teams error response:', errorText);
        throw new Error(`Failed to fetch Hall of Fame team data: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('🏛️ Hall of Fame team data received:', data.kernelKupTeamStats?.length, 'KK teams', data.heapsNHooksTeamStats?.length, 'HnH teams');
      setTeamStats(data.teamStats || []);
      setKernelKupTeamStats(data.kernelKupTeamStats || []);
      setHeapsNHooksTeamStats(data.heapsNHooksTeamStats || []);
      setTeamsLoaded(true);
    } catch (err: any) {
      console.error('🔴 Hall of Fame team fetch error:', err);
      setError(err.message);
    } finally {
      setTeamsLoading(false);
    }
  };

  const handlePlayerSort = (field: PlayerSortKey) => {
    if (playerSortField === field) {
      setPlayerSortOrder(playerSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setPlayerSortField(field);
      setPlayerSortOrder('desc');
    }
  };

  const handleTeamSort = (field: TeamSortKey) => {
    if (teamSortField === field) {
      setTeamSortOrder(teamSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setTeamSortField(field);
      setTeamSortOrder('desc');
    }
  };

  const sortedAndFilteredPlayers = useMemo(() => {
    // Filter players who have stats for the selected tournament type
    let filtered = players.filter(player => {
      const stats = selectedTab === 'kernel_kup' ? player.kernelKupStats : player.heapsNHooksStats;
      if (!stats) return false;
      return player.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    filtered.sort((a, b) => {
      const aStats = selectedTab === 'kernel_kup' ? a.kernelKupStats : a.heapsNHooksStats;
      const bStats = selectedTab === 'kernel_kup' ? b.kernelKupStats : b.heapsNHooksStats;
      
      if (!aStats || !bStats) return 0;

      let aVal: any, bVal: any;
      
      switch (playerSortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'championships':
          aVal = aStats.championships;
          bVal = bStats.championships;
          break;
        case 'mvps':
          aVal = aStats.mvps;
          bVal = bStats.mvps;
          break;
        case 'totalTournaments':
          aVal = aStats.totalTournaments;
          bVal = bStats.totalTournaments;
          break;
        case 'totalMatches':
          aVal = aStats.totalMatches;
          bVal = bStats.totalMatches;
          break;
        case 'totalWins':
          aVal = aStats.totalWins;
          bVal = bStats.totalWins;
          break;
        case 'totalLosses':
          aVal = aStats.totalLosses;
          bVal = bStats.totalLosses;
          break;
        case 'winrate':
          aVal = parseFloat(aStats.winrate);
          bVal = parseFloat(bStats.winrate);
          break;
        case 'totalKills':
          aVal = aStats.totalKills;
          bVal = bStats.totalKills;
          break;
        case 'totalDeaths':
          aVal = aStats.totalDeaths;
          bVal = bStats.totalDeaths;
          break;
        case 'totalAssists':
          aVal = aStats.totalAssists;
          bVal = bStats.totalAssists;
          break;
        case 'avgKDA':
          aVal = typeof aStats.avgKDA === 'string' ? parseFloat(aStats.avgKDA) : aStats.avgKDA;
          bVal = typeof bStats.avgKDA === 'string' ? parseFloat(bStats.avgKDA) : bStats.avgKDA;
          break;
        case 'avgGPM':
          aVal = parseFloat(aStats.avgGPM);
          bVal = parseFloat(bStats.avgGPM);
          break;
        case 'avgXPM':
          aVal = parseFloat(aStats.avgXPM);
          bVal = parseFloat(bStats.avgXPM);
          break;
        case 'totalLastHits':
          aVal = aStats.totalLastHits;
          bVal = bStats.totalLastHits;
          break;
        case 'totalDenies':
          aVal = aStats.totalDenies;
          bVal = bStats.totalDenies;
          break;
        case 'totalHeroDamage':
          aVal = aStats.totalHeroDamage;
          bVal = bStats.totalHeroDamage;
          break;
        case 'totalTowerDamage':
          aVal = aStats.totalTowerDamage;
          bVal = bStats.totalTowerDamage;
          break;
        case 'totalHealing':
          aVal = aStats.totalHealing;
          bVal = bStats.totalHealing;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return playerSortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return playerSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [players, searchTerm, playerSortField, playerSortOrder, selectedTab]);

  const sortedTeams = useMemo(() => {
    // Select team stats based on tournament type
    const teamsForTab = selectedTab === 'kernel_kup' ? kernelKupTeamStats : heapsNHooksTeamStats;
    
    // Filter by search term
    const filtered = teamsForTab.filter(team => 
      team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.tag?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    let sorted = [...filtered];

    sorted.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (teamSortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'championships':
          aVal = a.championships;
          bVal = b.championships;
          break;
        case 'popdKernels':
          aVal = a.popdKernels;
          bVal = b.popdKernels;
          break;
        case 'tournamentsPlayed':
          aVal = a.tournamentsPlayed;
          bVal = b.tournamentsPlayed;
          break;
        case 'totalMatches':
          aVal = a.totalMatches;
          bVal = b.totalMatches;
          break;
        case 'totalWins':
          aVal = a.totalWins;
          bVal = b.totalWins;
          break;
        case 'totalLosses':
          aVal = a.totalLosses;
          bVal = b.totalLosses;
          break;
        case 'winRate':
          aVal = parseFloat(a.winRate);
          bVal = parseFloat(b.winRate);
          break;
        case 'totalKills':
          aVal = a.totalKills;
          bVal = b.totalKills;
          break;
        case 'totalDeaths':
          aVal = a.totalDeaths;
          bVal = b.totalDeaths;
          break;
        case 'totalAssists':
          aVal = a.totalAssists;
          bVal = b.totalAssists;
          break;
        case 'kda':
          aVal = typeof a.kda === 'string' ? parseFloat(a.kda) : a.kda;
          bVal = typeof b.kda === 'string' ? parseFloat(b.kda) : b.kda;
          break;
        case 'avgGPM':
          aVal = parseFloat(a.avgGPM);
          bVal = parseFloat(b.avgGPM);
          break;
        case 'avgXPM':
          aVal = parseFloat(a.avgXPM);
          bVal = parseFloat(b.avgXPM);
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return teamSortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return teamSortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [kernelKupTeamStats, heapsNHooksTeamStats, searchTerm, teamSortField, teamSortOrder, selectedTab]);

  const top3Players = useMemo(() => {
    return [...players]
      .filter(p => p.stats) // Only include players with stats
      .sort((a, b) => {
        // Sort by championships first, then by total tournaments, then by winrate
        if (!a.stats || !b.stats) return 0;
        if (b.stats.championships !== a.stats.championships) {
          return b.stats.championships - a.stats.championships;
        }
        if (b.stats.totalTournaments !== a.stats.totalTournaments) {
          return b.stats.totalTournaments - a.stats.totalTournaments;
        }
        return parseFloat(b.stats.winrate) - parseFloat(a.stats.winrate);
      })
      .slice(0, 3);
  }, [players]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdf5e9] flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-[#f97316] animate-pulse" />
          <p className="text-xl font-bold text-[#0f172a]">Loading Hall of Fame...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fdf5e9] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border-2 border-red-200 p-8 max-w-md text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-black text-[#0f172a] mb-2">Failed to Load</h2>
          <p className="text-[#0f172a]/60">{error}</p>
        </div>
      </div>
    );
  }

  // Helper component for sortable table headers (used for both player and team tables)
  const PlayerSortableHeader = ({ field, label, onClick }: { field: PlayerSortKey; label: string; onClick: () => void }) => {
    return (
      <th 
        className="text-center p-4 font-bold cursor-pointer hover:bg-[#ea580c]" 
        onClick={onClick}
      >
        <div className="flex items-center justify-center gap-2 whitespace-nowrap">
          {label}
          {playerSortField === field && (playerSortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
        </div>
      </th>
    );
  };

  const TeamSortableHeader = ({ field, label, onClick }: { field: TeamSortKey; label: string; onClick: () => void }) => {
    return (
      <th 
        className="text-center p-4 font-bold cursor-pointer hover:bg-[#ea580c]" 
        onClick={onClick}
      >
        <div className="flex items-center justify-center gap-2 whitespace-nowrap">
          {label}
          {teamSortField === field && (teamSortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
        </div>
      </th>
    );
  };

  return (
    <div className="min-h-screen bg-[#fdf5e9] p-6">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="w-12 h-12 text-[#f97316]" />
            <h1 className="text-5xl font-black text-[#0f172a]">Hall of Fame</h1>
            <Trophy className="w-12 h-12 text-[#f97316]" />
          </div>
          <p className="text-lg text-[#0f172a]/60 max-w-2xl mx-auto">
            Celebrating the greatest players and teams across all Kernel Kup tournaments
          </p>
        </div>

        {/* Overall Stats */}
        {overallStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-white to-[#f97316]/5 rounded-2xl border-2 border-[#0f172a]/10 p-6 text-center">
              <Users className="w-10 h-10 mx-auto mb-3 text-[#f97316]" />
              <p className="text-4xl font-black text-[#0f172a] mb-1">{overallStats.totalUniquePlayers}</p>
              <p className="text-sm font-bold text-[#0f172a]/60 uppercase tracking-wide">Total Players</p>
            </div>
            <div className="bg-gradient-to-br from-white to-[#f97316]/5 rounded-2xl border-2 border-[#0f172a]/10 p-6 text-center">
              <Trophy className="w-10 h-10 mx-auto mb-3 text-[#f97316]" />
              <p className="text-4xl font-black text-[#0f172a] mb-1">{overallStats.totalUniqueMatches}</p>
              <p className="text-sm font-bold text-[#0f172a]/60 uppercase tracking-wide">Total Matches</p>
            </div>
            <div className="bg-gradient-to-br from-white to-[#f97316]/5 rounded-2xl border-2 border-[#0f172a]/10 p-6 text-center">
              <Crown className="w-10 h-10 mx-auto mb-3 text-yellow-500" />
              <p className="text-4xl font-black text-[#0f172a] mb-1">{overallStats.totalChampions}</p>
              <p className="text-sm font-bold text-[#0f172a]/60 uppercase tracking-wide">Champions</p>
            </div>
          </div>
        )}

        {/* Top 3 Podium */}
        {top3Players.length >= 3 && (
          <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-8">
            <h2 className="text-3xl font-black text-[#0f172a] mb-8 text-center">Top 3 Legends</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              {/* 2nd Place */}
              <div className="order-2 md:order-1">
                <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl border-2 border-gray-300 p-6 text-center relative">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gray-400 text-white w-10 h-10 rounded-full flex items-center justify-center text-xl font-black border-2 border-white shadow-lg">
                    2
                  </div>
                  {top3Players[1].avatar_url ? (
                    <img
                      src={top3Players[1].avatar_url}
                      alt={top3Players[1].name}
                      className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-gray-300"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-gray-300 flex items-center justify-center border-4 border-gray-400">
                      <Users className="w-10 h-10 text-gray-500" />
                    </div>
                  )}
                  <p className="text-xl font-black text-[#0f172a] mb-1">{top3Players[1].name}</p>
                  {top3Players[1].stats && (
                    <div className="space-y-1 text-sm text-[#0f172a]/60">
                      <p><Trophy className="w-4 h-4 inline mr-1" />{top3Players[1].stats.championships} Championships</p>
                      <p>{top3Players[1].stats.totalTournaments} Tournaments</p>
                      <p>{top3Players[1].stats.winrate}% Winrate</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 1st Place */}
              <div className="order-1 md:order-2">
                <div className="bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-2xl border-2 border-yellow-400 p-6 text-center relative transform md:scale-110">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gradient-to-br from-yellow-400 to-yellow-500 text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl font-black border-4 border-white shadow-xl">
                    1
                  </div>
                  <Crown className="w-8 h-8 mx-auto mb-2 text-yellow-600" />
                  {top3Players[0].avatar_url ? (
                    <img
                      src={top3Players[0].avatar_url}
                      alt={top3Players[0].name}
                      className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-yellow-400"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-yellow-300 flex items-center justify-center border-4 border-yellow-400">
                      <Users className="w-12 h-12 text-yellow-600" />
                    </div>
                  )}
                  <p className="text-2xl font-black text-[#0f172a] mb-2">{top3Players[0].name}</p>
                  {top3Players[0].stats && (
                    <div className="space-y-1 text-sm text-[#0f172a]/60 font-bold">
                      <p><Trophy className="w-4 h-4 inline mr-1" />{top3Players[0].stats.championships} Championships</p>
                      <p>{top3Players[0].stats.totalTournaments} Tournaments</p>
                      <p>{top3Players[0].stats.winrate}% Winrate</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 3rd Place */}
              <div className="order-3">
                <div className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl border-2 border-orange-300 p-6 text-center relative">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-orange-400 text-white w-10 h-10 rounded-full flex items-center justify-center text-xl font-black border-2 border-white shadow-lg">
                    3
                  </div>
                  {top3Players[2].avatar_url ? (
                    <img
                      src={top3Players[2].avatar_url}
                      alt={top3Players[2].name}
                      className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-orange-300"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-orange-300 flex items-center justify-center border-4 border-orange-400">
                      <Users className="w-10 h-10 text-orange-500" />
                    </div>
                  )}
                  <p className="text-xl font-black text-[#0f172a] mb-1">{top3Players[2].name}</p>
                  {top3Players[2].stats && (
                    <div className="space-y-1 text-sm text-[#0f172a]/60">
                      <p><Trophy className="w-4 h-4 inline mr-1" />{top3Players[2].stats.championships} Championships</p>
                      <p>{top3Players[2].stats.totalTournaments} Tournaments</p>
                      <p>{top3Players[2].stats.winrate}% Winrate</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search and Tabs */}
        <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b-2 border-[#0f172a]/10">
            <button
              onClick={() => setSelectedTab('kernel_kup')}
              className={`flex-1 px-6 py-4 font-bold transition-colors ${
                selectedTab === 'kernel_kup'
                  ? 'bg-[#f97316] text-white'
                  : 'bg-white text-[#0f172a] hover:bg-[#fdf5e9]'
              }`}
            >
              Kernel Kup
            </button>
            <button
              onClick={() => setSelectedTab('heaps_n_hooks')}
              className={`flex-1 px-6 py-4 font-bold transition-colors ${
                selectedTab === 'heaps_n_hooks'
                  ? 'bg-[#f97316] text-white'
                  : 'bg-white text-[#0f172a] hover:bg-[#fdf5e9]'
              }`}
            >
              Heaps n' Hooks
            </button>
          </div>

          {/* Sub-tabs: Players vs Teams */}
          <div className="flex border-b-2 border-[#0f172a]/10 bg-gray-50">
            <button
              onClick={() => setStatsView('players')}
              className={`flex-1 px-6 py-3 font-bold transition-colors ${
                statsView === 'players'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-50 text-[#0f172a] hover:bg-gray-100'
              }`}
            >
              Players
            </button>
            <button
              onClick={() => setStatsView('teams')}
              className={`flex-1 px-6 py-3 font-bold transition-colors ${
                statsView === 'teams'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-50 text-[#0f172a] hover:bg-gray-100'
              }`}
            >
              Teams
            </button>
          </div>

          {/* Search */}
          <div className="p-6">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-[#0f172a]/40" />
              <input
                type="text"
                placeholder={`Search ${statsView}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-[#0f172a] placeholder:text-[#0f172a]/40"
              />
            </div>
          </div>
        </div>

        {/* Player Stats Table - Only show when statsView === 'players' */}
        {statsView === 'players' && (
          <>
            <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-max">
                  <thead className="bg-[#f97316] text-white">
                    <tr>
                      <th className="text-center p-4 font-bold w-12 sticky left-0 z-20 bg-[#f97316]">#</th>
                      <th className="text-left p-4 font-bold cursor-pointer hover:bg-[#ea580c] sticky left-12 z-20 bg-[#f97316]" onClick={() => handlePlayerSort('name')}>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          Player
                          {playerSortField === 'name' && (playerSortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                        </div>
                      </th>
                      <th className="text-center p-4 font-bold cursor-pointer hover:bg-[#ea580c]">Most Played Hero</th>
                      <PlayerSortableHeader field="championships" label="Championships" onClick={() => handlePlayerSort('championships')} />
                      <PlayerSortableHeader field="mvps" label="MVPs" onClick={() => handlePlayerSort('mvps')} />
                      <PlayerSortableHeader field="totalTournaments" label="Tournaments" onClick={() => handlePlayerSort('totalTournaments')} />
                      <PlayerSortableHeader field="totalMatches" label="Matches" onClick={() => handlePlayerSort('totalMatches')} />
                      <PlayerSortableHeader field="totalWins" label="Total Wins" onClick={() => handlePlayerSort('totalWins')} />
                      <PlayerSortableHeader field="totalLosses" label="Total Losses" onClick={() => handlePlayerSort('totalLosses')} />
                      <PlayerSortableHeader field="winrate" label="Winrate" onClick={() => handlePlayerSort('winrate')} />
                      <PlayerSortableHeader field="totalKills" label="Total Kills" onClick={() => handlePlayerSort('totalKills')} />
                      <PlayerSortableHeader field="totalDeaths" label="Total Deaths" onClick={() => handlePlayerSort('totalDeaths')} />
                      <PlayerSortableHeader field="totalAssists" label="Total Assists" onClick={() => handlePlayerSort('totalAssists')} />
                      <PlayerSortableHeader field="avgKDA" label="KDA" onClick={() => handlePlayerSort('avgKDA')} />
                      <th className="text-center p-4 font-bold cursor-pointer hover:bg-[#ea580c]">Avg Kills</th>
                      <th className="text-center p-4 font-bold cursor-pointer hover:bg-[#ea580c]">Avg Deaths</th>
                      <th className="text-center p-4 font-bold cursor-pointer hover:bg-[#ea580c]">Avg Assists</th>
                      <PlayerSortableHeader field="totalLastHits" label="Total Last Hits" onClick={() => handlePlayerSort('totalLastHits')} />
                      <PlayerSortableHeader field="totalDenies" label="Total Denies" onClick={() => handlePlayerSort('totalDenies')} />
                      <th className="text-center p-4 font-bold cursor-pointer hover:bg-[#ea580c]">Avg Last Hits</th>
                      <th className="text-center p-4 font-bold cursor-pointer hover:bg-[#ea580c]">Avg Denies</th>
                      <PlayerSortableHeader field="avgGPM" label="Avg GPM" onClick={() => handlePlayerSort('avgGPM')} />
                      <PlayerSortableHeader field="avgXPM" label="Avg XPM" onClick={() => handlePlayerSort('avgXPM')} />
                      <PlayerSortableHeader field="totalHeroDamage" label="Total Hero Dmg" onClick={() => handlePlayerSort('totalHeroDamage')} />
                      <PlayerSortableHeader field="totalTowerDamage" label="Total Tower Dmg" onClick={() => handlePlayerSort('totalTowerDamage')} />
                      <PlayerSortableHeader field="totalHealing" label="Total Healing" onClick={() => handlePlayerSort('totalHealing')} />
                      <th className="text-center p-4 font-bold cursor-pointer hover:bg-[#ea580c]">Avg Hero Dmg</th>
                      <th className="text-center p-4 font-bold cursor-pointer hover:bg-[#ea580c]">Avg Tower Dmg</th>
                      <th className="text-center p-4 font-bold cursor-pointer hover:bg-[#ea580c]">Avg Healing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0f172a]/10">
                    {sortedAndFilteredPlayers.map((player, index) => {
                      const stats = selectedTab === 'kernel_kup' ? player.kernelKupStats : player.heapsNHooksStats;
                      if (!stats) return null;

                      const avgKills = stats.totalMatches > 0 ? (stats.totalKills / stats.totalMatches).toFixed(1) : '0.0';
                      const avgDeaths = stats.totalMatches > 0 ? (stats.totalDeaths / stats.totalMatches).toFixed(1) : '0.0';
                      const avgAssists = stats.totalMatches > 0 ? (stats.totalAssists / stats.totalMatches).toFixed(1) : '0.0';
                      const avgLastHits = stats.totalMatches > 0 ? Math.round(stats.totalLastHits / stats.totalMatches) : 0;
                      const avgDenies = stats.totalMatches > 0 ? Math.round(stats.totalDenies / stats.totalMatches) : 0;
                      const avgHeroDmg = stats.totalMatches > 0 ? Math.round(stats.totalHeroDamage / stats.totalMatches) : 0;
                      const avgTowerDmg = stats.totalMatches > 0 ? Math.round(stats.totalTowerDamage / stats.totalMatches) : 0;
                      const avgHealing = stats.totalMatches > 0 ? Math.round(stats.totalHealing / stats.totalMatches) : 0;

                      return (
                        <tr key={player.id} className={`hover:bg-[#fdf5e9] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#fdf5e9]/50'}`}>
                          <td className="p-4 text-center font-bold text-[#0f172a]/40 text-sm sticky left-0 z-10">{index + 1}</td>
                          <td className={`p-4 sticky left-12 z-10 ${index % 2 === 0 ? 'bg-white' : 'bg-[#fdf5e9]/50'}`}>
                            <div className="flex items-center gap-3 min-w-[200px]">
                              {player.avatar_url ? (
                                <img
                                  src={player.avatar_url}
                                  alt={player.name}
                                  className="w-12 h-12 rounded-full border-2 border-[#f97316]/20"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-[#f97316]/20 flex items-center justify-center">
                                  <Users className="w-6 h-6 text-[#f97316]" />
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-[#0f172a]">{player.name}</p>
                                {player.user && (
                                  <p className="text-xs text-[#0f172a]/60">XLCOB Member</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            {stats.signatureHero && (
                              <div className="flex flex-col items-center justify-center gap-1">
                                <img
                                  src={getHeroImageUrl(stats.signatureHero.hero_id)}
                                  alt={stats.signatureHero.hero_name}
                                  className="w-16 h-9 object-cover rounded border-2 border-[#0f172a]/10"
                                />
                                <p className="text-xs font-bold text-[#0f172a]">x{stats.signatureHero.games}</p>
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {stats.championships > 0 && (
                              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-yellow-100 text-yellow-600 font-black">
                                {stats.championships}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {stats.mvps > 0 && (
                              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#f97316]/10 text-[#f97316] font-black">
                                {stats.mvps}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center font-bold text-[#0f172a]">{stats.totalTournaments}</td>
                          <td className="p-4 text-center font-bold text-[#0f172a]">{stats.totalMatches}</td>
                          <td className="p-4 text-center font-bold text-[#10b981]">{stats.totalWins}</td>
                          <td className="p-4 text-center font-bold text-[#ef4444]">{stats.totalLosses}</td>
                          <td className="p-4 text-center">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${
                                parseFloat(stats.winrate) >= 60
                                  ? 'bg-[#10b981]/10 text-[#10b981]'
                                  : parseFloat(stats.winrate) >= 50
                                  ? 'bg-[#f97316]/10 text-[#f97316]'
                                  : 'bg-[#ef4444]/10 text-[#ef4444]'
                              }`}
                            >
                              {stats.winrate}%
                            </span>
                          </td>
                          <td className="p-4 text-center text-[#10b981] font-bold">{stats.totalKills}</td>
                          <td className="p-4 text-center text-[#ef4444] font-bold">{stats.totalDeaths}</td>
                          <td className="p-4 text-center text-[#3b82f6] font-bold">{stats.totalAssists}</td>
                          <td className="p-4 text-center text-[#0f172a] font-black text-base">{stats.avgKDA}</td>
                          <td className="p-4 text-center text-[#10b981] font-semibold">{avgKills}</td>
                          <td className="p-4 text-center text-[#ef4444] font-semibold">{avgDeaths}</td>
                          <td className="p-4 text-center text-[#3b82f6] font-semibold">{avgAssists}</td>
                          <td className="p-4 text-center text-[#0f172a]/70">{stats.totalLastHits.toLocaleString()}</td>
                          <td className="p-4 text-center text-[#0f172a]/70">{stats.totalDenies.toLocaleString()}</td>
                          <td className="p-4 text-center text-[#0f172a]/70">{avgLastHits}</td>
                          <td className="p-4 text-center text-[#0f172a]/70">{avgDenies}</td>
                          <td className="p-4 text-center text-[#fbbf24] font-semibold">{stats.avgGPM}</td>
                          <td className="p-4 text-center text-[#a855f7] font-semibold">{stats.avgXPM}</td>
                          <td className="p-4 text-center text-[#ef4444]/80 font-semibold">
                            {(stats.totalHeroDamage / 1000).toFixed(1)}k
                          </td>
                          <td className="p-4 text-center text-[#f97316]/80 font-semibold">
                            {(stats.totalTowerDamage / 1000).toFixed(1)}k
                          </td>
                          <td className="p-4 text-center text-[#10b981]/80 font-semibold">
                            {(stats.totalHealing / 1000).toFixed(1)}k
                          </td>
                          <td className="p-4 text-center text-[#ef4444]/70">
                            {(avgHeroDmg / 1000).toFixed(1)}k
                          </td>
                          <td className="p-4 text-center text-[#f97316]/70">
                            {(avgTowerDmg / 1000).toFixed(1)}k
                          </td>
                          <td className="p-4 text-center text-[#10b981]/70">
                            {(avgHealing / 1000).toFixed(1)}k
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {sortedAndFilteredPlayers.length === 0 && (
              <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-12 text-center">
                <Search className="w-16 h-16 mx-auto mb-4 text-[#0f172a]/20" />
                <p className="text-xl font-bold text-[#0f172a]/60">No players found for {selectedTab === 'kernel_kup' ? 'Kernel Kup' : 'Heaps n\' Hooks'}</p>
              </div>
            )}
          </>
        )}

        {/* Team Stats Table - Only show when statsView === 'teams' */}
        {statsView === 'teams' && (
          <>
            {teamsLoading ? (
              <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-12 text-center">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-[#f97316] animate-pulse" />
                <p className="text-xl font-bold text-[#0f172a]">Loading team statistics...</p>
                <p className="text-sm text-[#0f172a]/60 mt-2">This may take a moment</p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-max">
                      <thead className="bg-[#f97316] text-white">
                        <tr>
                          <th className="text-center p-4 font-bold w-12">#</th>
                          <th className="text-left p-4 font-bold cursor-pointer hover:bg-[#ea580c]" onClick={() => handleTeamSort('name')}>
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              Team Name
                              {teamSortField === 'name' && (teamSortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                            </div>
                          </th>
                          <TeamSortableHeader field="championships" label="Championships" onClick={() => handleTeamSort('championships')} />
                          <TeamSortableHeader field="popdKernels" label="Pop'd Kernels" onClick={() => handleTeamSort('popdKernels')} />
                          <TeamSortableHeader field="tournamentsPlayed" label="Tournaments" onClick={() => handleTeamSort('tournamentsPlayed')} />
                          <TeamSortableHeader field="totalMatches" label="Matches" onClick={() => handleTeamSort('totalMatches')} />
                          <TeamSortableHeader field="totalWins" label="Total Wins" onClick={() => handleTeamSort('totalWins')} />
                          <TeamSortableHeader field="totalLosses" label="Total Losses" onClick={() => handleTeamSort('totalLosses')} />
                          <TeamSortableHeader field="winRate" label="Win Rate" onClick={() => handleTeamSort('winRate')} />
                          <TeamSortableHeader field="totalKills" label="Total Kills" onClick={() => handleTeamSort('totalKills')} />
                          <TeamSortableHeader field="totalDeaths" label="Total Deaths" onClick={() => handleTeamSort('totalDeaths')} />
                          <TeamSortableHeader field="totalAssists" label="Total Assists" onClick={() => handleTeamSort('totalAssists')} />
                          <TeamSortableHeader field="kda" label="KDA" onClick={() => handleTeamSort('kda')} />
                          <th className="text-center p-4 font-bold cursor-pointer hover:bg-[#ea580c]">Avg Kills</th>
                          <th className="text-center p-4 font-bold cursor-pointer hover:bg-[#ea580c]">Avg Deaths</th>
                          <th className="text-center p-4 font-bold cursor-pointer hover:bg-[#ea580c]">Avg Assists</th>
                          <TeamSortableHeader field="avgGPM" label="Avg GPM" onClick={() => handleTeamSort('avgGPM')} />
                          <TeamSortableHeader field="avgXPM" label="Avg XPM" onClick={() => handleTeamSort('avgXPM')} />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#0f172a]/10">
                        {sortedTeams.map((team, index) => (
                          <tr key={team.id} className={`hover:bg-[#fdf5e9] transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-[#fdf5e9]/50'}`}>
                            <td className="p-4 text-center font-bold text-[#0f172a]/40 text-sm">{index + 1}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-3 min-w-[200px]">
                                {team.logo_url ? (
                                  <img
                                    src={team.logo_url}
                                    alt={team.name}
                                    className="w-12 h-12 rounded border-2 border-[#f97316]/20 object-cover"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded bg-[#f97316]/20 flex items-center justify-center">
                                    <Trophy className="w-6 h-6 text-[#f97316]" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-bold text-[#0f172a]">{team.name}</p>
                                  {team.tag && (
                                    <p className="text-xs text-[#0f172a]/60">[{team.tag}]</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              {team.championships > 0 && (
                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-yellow-100 text-yellow-600 font-black">
                                  {team.championships}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {team.popdKernels > 0 && (
                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#f97316]/10 text-[#f97316] font-black">
                                  {team.popdKernels}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-center font-bold text-[#0f172a]">{team.tournamentsPlayed}</td>
                            <td className="p-4 text-center font-bold text-[#0f172a]">{team.totalMatches}</td>
                            <td className="p-4 text-center font-bold text-[#10b981]">{team.totalWins}</td>
                            <td className="p-4 text-center font-bold text-[#ef4444]">{team.totalLosses}</td>
                            <td className="p-4 text-center">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  parseFloat(team.winRate) >= 60
                                    ? 'bg-[#10b981]/10 text-[#10b981]'
                                    : parseFloat(team.winRate) >= 50
                                    ? 'bg-[#f97316]/10 text-[#f97316]'
                                    : 'bg-[#ef4444]/10 text-[#ef4444]'
                                }`}
                              >
                                {team.winRate}%
                              </span>
                            </td>
                            <td className="p-4 text-center text-[#10b981] font-bold">{team.totalKills}</td>
                            <td className="p-4 text-center text-[#ef4444] font-bold">{team.totalDeaths}</td>
                            <td className="p-4 text-center text-[#3b82f6] font-bold">{team.totalAssists}</td>
                            <td className="p-4 text-center text-[#0f172a] font-black text-base">{team.kda}</td>
                            <td className="p-4 text-center text-[#10b981] font-semibold">{team.avgKills}</td>
                            <td className="p-4 text-center text-[#ef4444] font-semibold">{team.avgDeaths}</td>
                            <td className="p-4 text-center text-[#3b82f6] font-semibold">{team.avgAssists}</td>
                            <td className="p-4 text-center text-[#fbbf24] font-semibold">{team.avgGPM}</td>
                            <td className="p-4 text-center text-[#a855f7] font-semibold">{team.avgXPM}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}