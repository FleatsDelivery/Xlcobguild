import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Search } from 'lucide-react';
import type { TeamStats, TeamSortKey, SortOrder, TournamentType } from './hall-of-fame-types';

const BATCH_SIZE = 25;

interface Props {
  allTeamStats: TeamStats[];
  kernelKupTeamStats: TeamStats[];
  heapsNHooksTeamStats: TeamStats[];
  selectedTab: TournamentType;
  searchTerm: string;
  teamsLoading: boolean;
}

export function HallOfFameTeams({ allTeamStats, kernelKupTeamStats, heapsNHooksTeamStats, selectedTab, searchTerm, teamsLoading }: Props) {
  const [sortField, setSortField] = useState<TeamSortKey>('championships');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [searchTerm, selectedTab, sortField, sortOrder]);

  const handleSort = useCallback((field: TeamSortKey) => {
    setSortOrder(prev => sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'desc');
    setSortField(field);
  }, [sortField]);

  const sortedTeams = useMemo(() => {
    const teamsForTab = selectedTab === 'all' ? allTeamStats :
      selectedTab === 'kernel_kup' ? kernelKupTeamStats : heapsNHooksTeamStats;
    const filtered = teamsForTab.filter(team =>
      team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.tag?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
        case 'championships': aVal = a.championships; bVal = b.championships; break;
        case 'popdKernels': aVal = a.popdKernels; bVal = b.popdKernels; break;
        case 'prizeWinnings': aVal = a.prizeWinnings; bVal = b.prizeWinnings; break;
        case 'tournamentsPlayed': aVal = a.tournamentsPlayed; bVal = b.tournamentsPlayed; break;
        case 'totalMatches': aVal = a.totalMatches; bVal = b.totalMatches; break;
        case 'totalWins': aVal = a.totalWins; bVal = b.totalWins; break;
        case 'totalLosses': aVal = a.totalLosses; bVal = b.totalLosses; break;
        case 'winRate': aVal = parseFloat(a.winRate); bVal = parseFloat(b.winRate); break;
        case 'totalKills': aVal = a.totalKills; bVal = b.totalKills; break;
        case 'totalDeaths': aVal = a.totalDeaths; bVal = b.totalDeaths; break;
        case 'totalAssists': aVal = a.totalAssists; bVal = b.totalAssists; break;
        case 'kda': aVal = typeof a.kda === 'string' ? parseFloat(a.kda) : a.kda; bVal = typeof b.kda === 'string' ? parseFloat(b.kda) : b.kda; break;
        case 'avgGPM': aVal = parseFloat(a.avgGPM); bVal = parseFloat(b.avgGPM); break;
        case 'avgXPM': aVal = parseFloat(a.avgXPM); bVal = parseFloat(b.avgXPM); break;
        default: return 0;
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allTeamStats, kernelKupTeamStats, heapsNHooksTeamStats, searchTerm, sortField, sortOrder, selectedTab]);

  const visibleTeams = sortedTeams.slice(0, visibleCount);
  const hasMore = visibleCount < sortedTeams.length;

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setVisibleCount(prev => prev + BATCH_SIZE); },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  if (teamsLoading) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-muted animate-pulse flex-shrink-0" />
              <div className="w-10 h-10 rounded bg-muted animate-pulse flex-shrink-0" />
              <div className="flex-1 h-4 bg-muted rounded animate-pulse" />
              <div className="w-16 h-4 bg-muted rounded animate-pulse" />
              <div className="w-12 h-4 bg-muted rounded animate-pulse hidden sm:block" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const SortHeader = ({ field, label }: { field: TeamSortKey; label: string }) => (
    <th className="py-4 px-6 text-xs font-bold text-muted-foreground cursor-pointer hover:text-harvest transition-colors uppercase tracking-wide text-center" onClick={() => handleSort(field)}>
      <div className="whitespace-nowrap">
        {label}
        {sortField === field && (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 inline ml-1" /> : <ArrowDown className="w-4 h-4 inline ml-1" />)}
      </div>
    </th>
  );

  if (sortedTeams.length === 0) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-12 text-center">
        <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-xl font-bold text-muted-foreground">No teams found</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-2xl border-2 border-border">
        <div className="overflow-auto max-h-[calc(100vh-13rem)]">
          <table className="w-full min-w-max">
            <thead className="bg-muted border-b-2 border-border sticky top-0 z-30">
              <tr>
                <th className="py-4 px-6 text-xs font-bold text-muted-foreground uppercase tracking-wide text-center w-12">#</th>
                <SortHeader field="name" label="Team" />
                <SortHeader field="championships" label="Champ" />
                <SortHeader field="popdKernels" label="Pop'd Kernels" />
                <SortHeader field="prizeWinnings" label="Prize $" />
                <SortHeader field="tournamentsPlayed" label="Tourneys" />
                <SortHeader field="totalMatches" label="GP" />
                <SortHeader field="totalWins" label="W" />
                <SortHeader field="totalLosses" label="L" />
                <SortHeader field="winRate" label="Win %" />
                <SortHeader field="totalKills" label="Kills" />
                <SortHeader field="totalDeaths" label="Deaths" />
                <SortHeader field="totalAssists" label="Assists" />
                <SortHeader field="kda" label="KDA" />
                <SortHeader field="avgGPM" label="Avg GPM" />
                <SortHeader field="avgXPM" label="Avg XPM" />
              </tr>
            </thead>
            <tbody>
              {visibleTeams.map((team, index) => (
                <tr key={team.id} className={`border-b border-border ${index % 2 === 0 ? 'bg-card' : 'bg-muted/50'} hover:bg-harvest/5 transition-colors`}>
                  <td className="py-5 px-6 text-center font-bold text-muted-foreground text-sm">{index + 1}</td>
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-3 min-w-[200px]">
                      {team.logo_url ? (
                        <img src={team.logo_url} alt={team.name} className="w-10 h-10 rounded border-2 border-border object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gradient-to-br from-harvest to-amber flex items-center justify-center text-sm font-bold text-white">
                          {team.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-foreground text-sm">{team.name}</p>
                        {team.tag && <p className="text-xs text-muted-foreground">[{team.tag}]</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-5 px-6 text-center">{team.championships > 0 ? <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-yellow-100 text-yellow-600 font-black">{team.championships}</span> : null}</td>
                  <td className="py-5 px-6 text-center">{team.popdKernels > 0 ? <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-harvest/10 text-harvest font-black">{team.popdKernels}</span> : null}</td>
                  <td className="py-5 px-6 text-center">
                    {team.prizeWinnings > 0 ? (
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-black text-sm whitespace-nowrap">
                        ${(team.prizeWinnings / 100).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </td>
                  <td className="py-5 px-6 text-center font-bold text-foreground">{team.tournamentsPlayed}</td>
                  <td className="py-5 px-6 text-center font-bold text-foreground">{team.totalMatches}</td>
                  <td className="py-5 px-6 text-center font-bold text-[#10b981]">{team.totalWins}</td>
                  <td className="py-5 px-6 text-center font-bold text-[#ef4444]">{team.totalLosses}</td>
                  <td className="py-5 px-6 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${parseFloat(team.winRate) >= 60 ? 'bg-[#10b981]/10 text-[#10b981]' : parseFloat(team.winRate) >= 50 ? 'bg-harvest/10 text-harvest' : 'bg-[#ef4444]/10 text-[#ef4444]'}`}>
                      {team.winRate}%
                    </span>
                  </td>
                  <td className="py-5 px-6 text-center text-[#10b981] font-bold">{team.totalKills}</td>
                  <td className="py-5 px-6 text-center text-[#ef4444] font-bold">{team.totalDeaths}</td>
                  <td className="py-5 px-6 text-center text-[#3b82f6] font-bold">{team.totalAssists}</td>
                  <td className="py-5 px-6 text-center text-foreground font-black text-base">{team.kda}</td>
                  <td className="py-5 px-6 text-center text-[#fbbf24] font-semibold">{team.avgGPM}</td>
                  <td className="py-5 px-6 text-center text-[#a855f7] font-semibold">{team.avgXPM}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          <p className="text-sm text-muted-foreground">Showing {visibleCount} of {sortedTeams.length} teams...</p>
        </div>
      )}
    </>
  );
}