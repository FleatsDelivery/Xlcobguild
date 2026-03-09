import { useState, useEffect, useMemo, useRef } from 'react';
import { Trophy, Crown, Users, Search, ArrowLeft, Mic, ClipboardList, Swords, Target, Skull, Sparkles } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Footer } from '@/app/components/footer';
import { HallOfFamePlayers } from '@/app/components/hall-of-fame-players';
import { HallOfFameTeams } from '@/app/components/hall-of-fame-teams';
import { HallOfFameCoachesTab } from '@/app/components/hall-of-fame-coaches';
import { HallOfFameStaffTab } from '@/app/components/hall-of-fame-staff';
import type {
  HallOfFamePlayer, TeamStats, HallOfFameStaff, HallOfFameCoach,
  TournamentType, StatsView,
} from './hall-of-fame-types';

// ═══════════════════════════════════════════════════════
// SKELETON COMPONENTS
// ═══════════════════════════════════════════════════════

function PodiumSkeleton() {
  return (
    <div className="bg-card rounded-2xl border-2 border-border p-4 sm:p-6">
      <div className="h-5 w-36 bg-muted rounded-lg animate-pulse mx-auto mb-4" />
      <div className="grid grid-cols-3 gap-2 sm:gap-5 items-end">
        {/* 2nd */}
        <div className="flex flex-col items-center gap-2 pt-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-muted animate-pulse" />
          <div className="h-3 w-16 bg-muted rounded animate-pulse" />
          <div className="h-2.5 w-12 bg-muted rounded animate-pulse" />
        </div>
        {/* 1st */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 bg-muted rounded animate-pulse" />
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted animate-pulse" />
          <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          <div className="h-2.5 w-14 bg-muted rounded animate-pulse" />
        </div>
        {/* 3rd */}
        <div className="flex flex-col items-center gap-2 pt-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-muted animate-pulse" />
          <div className="h-3 w-16 bg-muted rounded animate-pulse" />
          <div className="h-2.5 w-12 bg-muted rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function StatGridSkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="bg-card rounded-xl border-2 border-border p-3 text-center">
          <div className="w-5 h-5 bg-muted rounded animate-pulse mx-auto mb-2" />
          <div className="h-5 w-10 bg-muted rounded animate-pulse mx-auto mb-1" />
          <div className="h-2.5 w-14 bg-muted rounded animate-pulse mx-auto" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
      <div className="flex border-b-2 border-border">
        <div className="flex-1 h-12 bg-muted/50 animate-pulse" />
        <div className="flex-1 h-12 bg-muted/30 animate-pulse" />
      </div>
      <div className="flex border-b-2 border-border">
        <div className="flex-1 h-10 bg-muted/30 animate-pulse" />
        <div className="flex-1 h-10 bg-muted/20 animate-pulse" />
        <div className="flex-1 h-10 bg-muted/20 animate-pulse" />
      </div>
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-muted animate-pulse flex-shrink-0" />
            <div className="w-10 h-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
            <div className="flex-1 h-4 bg-muted rounded animate-pulse" />
            <div className="w-16 h-4 bg-muted rounded animate-pulse" />
            <div className="w-12 h-4 bg-muted rounded animate-pulse hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FullPageSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PodiumSkeleton />
      <StatGridSkeleton />
      <TableSkeleton />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PODIUM STYLES
// ═══════════════════════════════════════════════════════

const PODIUM_STYLES = [
  // 1st
  {
    bgGradient: 'from-yellow-400/20 to-amber-300/10',
    border: 'border-yellow-400/60',
    badgeBg: 'bg-gradient-to-br from-yellow-400 to-amber-500',
    avatarSize: 'w-16 h-16 sm:w-20 sm:h-20',
    avatarBorder: 'border-yellow-400',
    nameSize: 'text-sm sm:text-lg',
    crown: true,
    padTop: 'pt-2',
  },
  // 2nd
  {
    bgGradient: 'from-gray-300/20 to-gray-200/10',
    border: 'border-gray-300/60',
    badgeBg: 'bg-gradient-to-br from-gray-400 to-gray-500',
    avatarSize: 'w-14 h-14 sm:w-16 sm:h-16',
    avatarBorder: 'border-gray-300',
    nameSize: 'text-xs sm:text-base',
    crown: false,
    padTop: 'pt-3 sm:pt-6',
  },
  // 3rd
  {
    bgGradient: 'from-orange-300/20 to-orange-200/10',
    border: 'border-orange-300/60',
    badgeBg: 'bg-gradient-to-br from-orange-400 to-orange-500',
    avatarSize: 'w-14 h-14 sm:w-16 sm:h-16',
    avatarBorder: 'border-orange-300',
    nameSize: 'text-xs sm:text-base',
    crown: false,
    padTop: 'pt-3 sm:pt-6',
  },
];

// ═══════════════════════════════════════════════════════
// STAT CONFIG
// ═══════════════════════════════════════════════════════

interface StatItem {
  icon: React.ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
  color: string;
}

function buildStatItems(overallStats: {
  totalUniquePlayers: number;
  totalUniqueMatches: number;
  totalChampions: number;
  totalUniqueHeroes?: number;
  totalDotaHeroes?: number;
}, players: HallOfFamePlayer[]): StatItem[] {
  // Derive extra stats from player data
  const totalKills = players.reduce((sum, p) => sum + (p.stats?.totalKills || 0), 0);
  const totalMVPs = players.reduce((sum, p) => sum + (p.stats?.mvps || 0), 0);

  const uniqueHeroes = overallStats.totalUniqueHeroes || 0;
  const totalDotaHeroes = overallStats.totalDotaHeroes || 126;
  const heroDisplay = `${uniqueHeroes}/${totalDotaHeroes}`;

  return [
    { icon: Users, value: overallStats.totalUniquePlayers, label: 'Players', color: 'text-harvest' },
    { icon: Swords, value: overallStats.totalUniqueMatches, label: 'Matches', color: 'text-harvest' },
    { icon: Crown, value: overallStats.totalChampions, label: 'Champions', color: 'text-yellow-500' },
    { icon: Skull, value: totalKills.toLocaleString(), label: 'Total Kills', color: 'text-error' },
    { icon: Sparkles, value: totalMVPs, label: 'MVPs', color: 'text-[#dc2626]' },
    { icon: Target, value: heroDisplay, label: 'Heroes Picked', color: 'text-husk' },
  ];
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════

export function HallOfFamePage() {
  // --- Data state ---
  const [players, setPlayers] = useState<HallOfFamePlayer[]>([]);
  const [allTeamStats, setAllTeamStats] = useState<TeamStats[]>([]);
  const [kernelKupTeamStats, setKernelKupTeamStats] = useState<TeamStats[]>([]);
  const [heapsNHooksTeamStats, setHeapsNHooksTeamStats] = useState<TeamStats[]>([]);
  const [coachMembers, setCoachMembers] = useState<HallOfFameCoach[]>([]);
  const [staffMembers, setStaffMembers] = useState<HallOfFameStaff[]>([]);
  const [overallStats, setOverallStats] = useState<{
    totalUniquePlayers: number;
    totalUniqueMatches: number;
    totalChampions: number;
    totalUniqueHeroes?: number;
    totalDotaHeroes?: number;
  } | null>(null);

  // --- Loading / error ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const [coachesLoaded, setCoachesLoaded] = useState(false);
  const [staffLoaded, setStaffLoaded] = useState(false);

  // --- UI state ---
  const [selectedTab, setSelectedTab] = useState<TournamentType>('all');
  const [statsView, setStatsView] = useState<StatsView>('players');
  const [searchTerm, setSearchTerm] = useState('');

  // --- Double-fetch guard ---
  const fetchedRef = useRef(false);

  // Parallel fetch: all 3 datasets at once on mount
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchAllData();
  }, []);

  const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;
  const headers = { Authorization: `Bearer ${publicAnonKey}` };

  const fetchAllData = async () => {
    // Fire all 4 requests in parallel — no lazy loading
    const [playersRes, teamsRes, coachesRes, staffRes] = await Promise.allSettled([
      fetch(`${baseUrl}/kkup/hall-of-fame/players`, { headers }),
      fetch(`${baseUrl}/kkup/hall-of-fame/teams`, { headers }),
      fetch(`${baseUrl}/kkup/hall-of-fame/coaches`, { headers }),
      fetch(`${baseUrl}/kkup/hall-of-fame/staff`, { headers }),
    ]);

    // Process players (critical path — sets loading to false)
    if (playersRes.status === 'fulfilled' && playersRes.value.ok) {
      try {
        const data = await playersRes.value.json();
        console.log('Hall of Fame player data received:', data.players?.length, 'players');
        setPlayers(data.players || []);
        setOverallStats(data.overallStats || { totalUniquePlayers: data.players?.length || 0, totalUniqueMatches: 0, totalChampions: 0 });
      } catch (err: any) {
        console.error('Hall of Fame player parse error:', err);
        setError(err.message);
      }
    } else {
      const reason = playersRes.status === 'rejected' ? playersRes.reason?.message : `HTTP ${playersRes.value.status}`;
      console.error('Hall of Fame player fetch failed:', reason);
      setError(`Failed to fetch player data: ${reason}`);
    }
    setLoading(false);

    // Process teams (non-blocking)
    if (teamsRes.status === 'fulfilled' && teamsRes.value.ok) {
      try {
        const data = await teamsRes.value.json();
        setAllTeamStats(data.teamStats || []);
        setKernelKupTeamStats(data.kernelKupTeamStats || []);
        setHeapsNHooksTeamStats(data.heapsNHooksTeamStats || []);
      } catch (err: any) {
        console.error('Hall of Fame team parse error:', err);
      }
    } else {
      console.error('Hall of Fame team fetch failed');
    }
    setTeamsLoaded(true);

    // Process coaches (non-blocking)
    if (coachesRes.status === 'fulfilled' && coachesRes.value.ok) {
      try {
        const data = await coachesRes.value.json();
        setCoachMembers(data.coaches || []);
      } catch (err: any) {
        console.error('Hall of Fame coaches parse error:', err);
      }
    } else {
      console.error('Hall of Fame coaches fetch failed');
    }
    setCoachesLoaded(true);

    // Process staff (non-blocking)
    if (staffRes.status === 'fulfilled' && staffRes.value.ok) {
      try {
        const data = await staffRes.value.json();
        setStaffMembers(data.staff || []);
      } catch (err: any) {
        console.error('Hall of Fame staff parse error:', err);
      }
    } else {
      console.error('Hall of Fame staff fetch failed');
    }
    setStaffLoaded(true);
  };

  // --- Dynamic Top 3 ---
  const top3 = useMemo(() => {
    // Helper: get the right stats for the selected tab
    const getPlayerStats = (p: HallOfFamePlayer) =>
      selectedTab === 'all' ? p.stats :
      selectedTab === 'kernel_kup' ? p.kernelKupStats : p.heapsNHooksStats;

    const getStaffStats = (s: HallOfFameStaff) =>
      selectedTab === 'all' ? s.stats :
      selectedTab === 'kernel_kup' ? s.kernelKupStats : s.heapsNHooksStats;

    if (statsView === 'players') {
      return [...players]
        .filter(p => getPlayerStats(p) !== null)
        .sort((a, b) => {
          const aS = getPlayerStats(a);
          const bS = getPlayerStats(b);
          if (!aS || !bS) return 0;
          if (bS.championships !== aS.championships) return bS.championships - aS.championships;
          if (bS.totalTournaments !== aS.totalTournaments) return bS.totalTournaments - aS.totalTournaments;
          return parseFloat(bS.winrate) - parseFloat(aS.winrate);
        })
        .slice(0, 3)
        .map(p => {
          const stats = getPlayerStats(p);
          return {
            id: p.id,
            name: p.name,
            avatar_url: p.avatar_url,
            subtitle: `${stats?.championships || 0} Championships`,
            stat1: `${stats?.totalTournaments || 0} Tournaments`,
            stat2: `${stats?.winrate || '0.0'}% Winrate`,
          };
        });
    }

    if (statsView === 'teams') {
      const teams = selectedTab === 'all' ? allTeamStats :
        selectedTab === 'kernel_kup' ? kernelKupTeamStats : heapsNHooksTeamStats;
      return [...teams]
        .sort((a, b) => {
          if (b.championships !== a.championships) return b.championships - a.championships;
          return b.totalWins - a.totalWins;
        })
        .slice(0, 3)
        .map(t => ({
          id: t.id,
          name: t.name,
          avatar_url: t.logo_url,
          subtitle: `${t.championships} Championships`,
          stat1: `${t.tournamentsPlayed} Tournaments`,
          stat2: `${t.winRate}% Win Rate`,
        }));
    }

    if (statsView === 'coaches') {
      const getCoachStats = (c: HallOfFameCoach) =>
        selectedTab === 'all' ? c.stats :
        selectedTab === 'kernel_kup' ? c.kernelKupStats : c.heapsNHooksStats;

      return [...coachMembers]
        .filter(c => getCoachStats(c) !== null)
        .sort((a, b) => {
          const aS = getCoachStats(a);
          const bS = getCoachStats(b);
          if (!aS || !bS) return 0;
          if (bS.championships !== aS.championships) return bS.championships - aS.championships;
          return bS.totalTournaments - aS.totalTournaments;
        })
        .slice(0, 3)
        .map(c => {
          const stats = getCoachStats(c);
          return {
            id: c.id,
            name: c.name,
            avatar_url: c.avatar_url,
            subtitle: `${stats?.championships || 0} Championships`,
            stat1: `${stats?.totalTournaments || 0} Tournaments`,
            stat2: `${stats?.winrate || '0.0'}% Win Rate`,
          };
        });
    }

    // Staff
    return [...staffMembers]
      .filter(s => getStaffStats(s) !== null)
      .sort((a, b) => {
        const aS = getStaffStats(a);
        const bS = getStaffStats(b);
        return (bS?.totalTournaments || 0) - (aS?.totalTournaments || 0);
      })
      .slice(0, 3)
      .map(s => {
        const stats = getStaffStats(s);
        return {
          id: s.id,
          name: s.name,
          avatar_url: s.avatar_url,
          subtitle: `${stats?.totalTournaments || 0} Tournaments`,
          stat1: stats?.primaryRole || 'Staff',
          stat2: `${s.allRoles.length} role${s.allRoles.length !== 1 ? 's' : ''}`,
        };
      });
  }, [players, allTeamStats, kernelKupTeamStats, heapsNHooksTeamStats, coachMembers, staffMembers, statsView, selectedTab]);

  const podiumTitle = statsView === 'players' ? 'Top 3 Legends' : statsView === 'teams' ? 'Top 3 Teams' : statsView === 'coaches' ? 'Top 3 Coaches' : 'Top 3 Staff';

  // Stat items for the grid
  const statItems = useMemo(() => {
    if (!overallStats) return [];
    return buildStatItems(overallStats, players);
  }, [overallStats, players]);

  // Is the currently active tab's data still loading?
  const isTabDataLoading =
    (statsView === 'teams' && !teamsLoaded) ||
    (statsView === 'coaches' && !coachesLoaded) ||
    (statsView === 'staff' && !staffLoaded);

  // --- Error state ---
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="bg-card rounded-2xl border-2 border-error/30 p-8 max-w-md text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-error" />
          <h2 className="text-2xl font-black text-foreground mb-2">Failed to Load</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  // Render order: [2nd, 1st, 3rd]
  const podiumOrder = [1, 0, 2];

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-[1600px] mx-auto space-y-4 sm:space-y-6">
        {/* Back Button */}
        <button
          onClick={() => { window.location.hash = '#kkup'; }}
          className="flex items-center gap-2 text-muted-foreground hover:text-harvest font-bold transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Kernel Kup
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <Trophy className="w-8 h-8 sm:w-12 sm:h-12 text-harvest" />
            <h1 className="text-3xl sm:text-5xl font-black text-foreground">Hall of Fame</h1>
            <Trophy className="w-8 h-8 sm:w-12 sm:h-12 text-harvest" />
          </div>
          <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Celebrating the greatest players, teams, coaches, and staff across all Kernel Kup tournaments
          </p>
        </div>

        {/* SKELETON or CONTENT */}
        {loading ? (
          <FullPageSkeleton />
        ) : (
          <>
            {/* ── Top 3 Podium (first thing after header) ── */}
            {isTabDataLoading ? (
              <PodiumSkeleton />
            ) : top3.length >= 3 ? (
              <div className="bg-card rounded-2xl border-2 border-border p-3 sm:p-6">
                <h2 className="text-base sm:text-xl font-black text-foreground mb-0.5 text-center">{podiumTitle}</h2>
                <p className="text-[10px] sm:text-xs text-muted-foreground text-center mb-3 sm:mb-5">
                  {statsView === 'players' ? 'Ranked by Championships, Tournaments Played, Win Rate' :
                   statsView === 'teams' ? 'Ranked by Championships, then Wins' :
                   statsView === 'coaches' ? 'Ranked by Championships, then Tournaments Coached' :
                   'Ranked by Tournaments Staffed'}
                </p>
                <div className="grid grid-cols-3 gap-2 sm:gap-5 items-end">
                  {podiumOrder.map(dataIdx => {
                    const entry = top3[dataIdx];
                    if (!entry) return null;
                    const s = PODIUM_STYLES[dataIdx];
                    return (
                      <div key={entry.id} className={`${s.padTop}`}>
                        <div className={`bg-gradient-to-br ${s.bgGradient} rounded-xl border-2 ${s.border} p-2.5 sm:p-4 text-center relative transition-all hover:scale-[1.03] hover:shadow-lg`}>
                          {/* Position badge */}
                          <div className={`${s.badgeBg} text-white rounded-full w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center font-black text-xs sm:text-base mx-auto mb-1.5 sm:mb-2 border-2 border-card shadow-md`}>
                            {dataIdx + 1}
                          </div>
                          {s.crown && <Crown className="w-4 h-4 sm:w-6 sm:h-6 mx-auto mb-0.5 text-yellow-500" />}
                          {entry.avatar_url ? (
                            <img src={entry.avatar_url} alt={entry.name} className={`${s.avatarSize} rounded-full mx-auto mb-2 sm:mb-3 border-4 ${s.avatarBorder} object-cover`} width={80} height={80} />
                          ) : (
                            <div className={`${s.avatarSize} rounded-full mx-auto mb-2 sm:mb-3 bg-harvest/20 flex items-center justify-center border-4 ${s.avatarBorder}`}>
                              {statsView === 'staff' ? <Mic className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" /> : statsView === 'coaches' ? <ClipboardList className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" /> : <Users className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />}
                            </div>
                          )}
                          <p className={`${s.nameSize} font-black text-foreground mb-0.5 truncate`}>{entry.name}</p>
                          <div className="space-y-0.5 text-[10px] sm:text-xs text-muted-foreground">
                            <p><Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 inline mr-0.5" />{entry.subtitle}</p>
                            <p>{entry.stat1}</p>
                            <p>{entry.stat2}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* ── Compact Stats Grid ── */}
            {statItems.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {statItems.map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <div key={idx} className="bg-card rounded-xl border-2 border-border p-2.5 sm:p-3 text-center">
                      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 ${stat.color}`} />
                      <p className="text-lg sm:text-xl font-black text-foreground leading-tight">{stat.value}</p>
                      <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Tabs + Search ── */}
            <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
              {/* Tournament type tabs */}
              <div className="flex border-b-2 border-border">
                {([['all', 'All'], ['kernel_kup', 'Kernel Kup'], ['heaps_n_hooks', "Heaps n' Hooks"]] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setSelectedTab(value)}
                    className={`flex-1 px-3 py-3 sm:px-6 sm:py-4 font-bold text-sm sm:text-base transition-colors ${selectedTab === value ? 'bg-harvest text-white' : 'bg-card text-foreground hover:bg-muted'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Sub-tabs: Players / Teams / Coaches / Staff */}
              <div className="flex border-b-2 border-border bg-muted/50">
                {([['players', 'Players'], ['teams', 'Teams'], ['coaches', 'Coaches'], ['staff', 'Staff']] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setStatsView(value)}
                    className={`flex-1 px-4 py-2.5 sm:px-6 sm:py-3 font-bold text-sm sm:text-base transition-colors ${statsView === value ? 'bg-husk text-white' : 'bg-transparent text-foreground hover:bg-muted'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={`Search ${statsView}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-sm sm:text-base"
                  />
                </div>
              </div>
            </div>

            {/* ── Tab Content ── */}
            {statsView === 'players' && (
              <HallOfFamePlayers players={players} selectedTab={selectedTab} searchTerm={searchTerm} />
            )}
            {statsView === 'teams' && (
              <HallOfFameTeams
                allTeamStats={allTeamStats}
                kernelKupTeamStats={kernelKupTeamStats}
                heapsNHooksTeamStats={heapsNHooksTeamStats}
                selectedTab={selectedTab}
                searchTerm={searchTerm}
                teamsLoading={!teamsLoaded}
              />
            )}
            {statsView === 'coaches' && (
              <HallOfFameCoachesTab
                coaches={coachMembers}
                selectedTab={selectedTab}
                searchTerm={searchTerm}
                coachesLoading={!coachesLoaded}
              />
            )}
            {statsView === 'staff' && (
              <HallOfFameStaffTab
                staff={staffMembers}
                selectedTab={selectedTab}
                searchTerm={searchTerm}
                staffLoading={!staffLoaded}
              />
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}