import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Search, Users, Trophy, ClipboardList } from 'lucide-react';
import { getRoleBadgeTag, getRoleBadgeStyle } from '@/lib/roles';
import type { HallOfFameCoach, CoachSortKey, SortOrder, TournamentType } from './hall-of-fame-types';

const BATCH_SIZE = 25;

interface Props {
  coaches: HallOfFameCoach[];
  selectedTab: TournamentType;
  searchTerm: string;
  coachesLoading: boolean;
}

export function HallOfFameCoachesTab({ coaches, selectedTab, searchTerm, coachesLoading }: Props) {
  const [sortField, setSortField] = useState<CoachSortKey>('championships');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [searchTerm, selectedTab, sortField, sortOrder]);

  const handleSort = useCallback((field: CoachSortKey) => {
    setSortOrder(prev => sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'desc');
    setSortField(field);
  }, [sortField]);

  const sortedCoaches = useMemo(() => {
    const getStats = (c: HallOfFameCoach) =>
      selectedTab === 'all' ? c.stats :
      selectedTab === 'kernel_kup' ? c.kernelKupStats : c.heapsNHooksStats;

    const filtered = coaches.filter(c => {
      const stats = getStats(c);
      if (!stats) return false;
      const term = searchTerm.toLowerCase();
      return c.name.toLowerCase().includes(term) ||
        stats.teamNames.some(tn => tn.toLowerCase().includes(term));
    });

    return [...filtered].sort((a, b) => {
      const aStats = getStats(a);
      const bStats = getStats(b);
      if (!aStats || !bStats) return 0;

      let aVal: number, bVal: number;
      switch (sortField) {
        case 'name':
          return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        case 'championships': aVal = aStats.championships; bVal = bStats.championships; break;
        case 'totalTournaments': aVal = aStats.totalTournaments; bVal = bStats.totalTournaments; break;
        case 'teamsCoached': aVal = aStats.teamsCoached; bVal = bStats.teamsCoached; break;
        case 'totalMatches': aVal = aStats.totalMatches; bVal = bStats.totalMatches; break;
        case 'totalWins': aVal = aStats.totalWins; bVal = bStats.totalWins; break;
        case 'totalLosses': aVal = aStats.totalLosses; bVal = bStats.totalLosses; break;
        case 'winrate': aVal = parseFloat(aStats.winrate); bVal = parseFloat(bStats.winrate); break;
        default: return 0;
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [coaches, searchTerm, sortField, sortOrder, selectedTab]);

  const visibleCoaches = sortedCoaches.slice(0, visibleCount);
  const hasMore = visibleCount < sortedCoaches.length;

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setVisibleCount(prev => prev + BATCH_SIZE); },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  if (coachesLoading) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-muted animate-pulse flex-shrink-0" />
              <div className="w-10 h-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
              <div className="flex-1 h-4 bg-muted rounded animate-pulse" />
              <div className="w-20 h-4 bg-muted rounded animate-pulse" />
              <div className="w-14 h-4 bg-muted rounded animate-pulse hidden sm:block" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sortedCoaches.length === 0) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-12 text-center">
        <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-xl font-bold text-muted-foreground">No coaches found{selectedTab !== 'all' ? ` for ${selectedTab === 'kernel_kup' ? 'Kernel Kup' : "Heaps n' Hooks"}` : ''}</p>
      </div>
    );
  }

  const SortHeader = ({ field, label, align = 'center' }: { field: CoachSortKey; label: string; align?: 'left' | 'center' }) => (
    <th
      className={`py-4 px-3 sm:px-6 text-xs font-bold text-muted-foreground cursor-pointer hover:text-harvest transition-colors uppercase tracking-wide ${align === 'left' ? 'text-left' : 'text-center'}`}
      onClick={() => handleSort(field)}
    >
      <div className="whitespace-nowrap">
        {label}
        {sortField === field && (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 inline ml-1" /> : <ArrowDown className="w-4 h-4 inline ml-1" />)}
      </div>
    </th>
  );

  return (
    <>
      <div className="bg-card rounded-2xl border-2 border-border">
        <div className="overflow-auto max-h-[calc(100vh-13rem)]">
          <table className="w-full min-w-max">
            <thead className="bg-muted border-b-2 border-border sticky top-0 z-30">
              <tr>
                <th className="py-4 px-3 sm:px-6 text-xs font-bold text-muted-foreground uppercase tracking-wide text-center w-12">#</th>
                <SortHeader field="name" label="Coach" align="left" />
                <SortHeader field="championships" label="Champs" />
                <SortHeader field="totalTournaments" label="Tourneys" />
                <SortHeader field="teamsCoached" label="Teams" />
                <SortHeader field="totalMatches" label="Matches" />
                <SortHeader field="totalWins" label="W" />
                <SortHeader field="totalLosses" label="L" />
                <SortHeader field="winrate" label="Win%" />
              </tr>
            </thead>
            <tbody>
              {visibleCoaches.map((coach, index) => {
                const stats = selectedTab === 'all' ? coach.stats :
                  selectedTab === 'kernel_kup' ? coach.kernelKupStats : coach.heapsNHooksStats;
                if (!stats) return null;

                const userRole = coach.user?.role;
                const roleTag = userRole ? getRoleBadgeTag(userRole) : null;
                const roleStyle = userRole ? getRoleBadgeStyle(userRole) : null;

                return (
                  <tr
                    key={coach.id}
                    className="border-b border-border hover:bg-muted/30 transition-colors"
                  >
                    {/* Rank */}
                    <td className="py-3 px-3 sm:px-6 text-center">
                      <span className={`font-black text-sm ${index < 3 ? 'text-harvest' : 'text-muted-foreground'}`}>
                        {index + 1}
                      </span>
                    </td>

                    {/* Coach name + avatar */}
                    <td className="py-3 px-3 sm:px-6">
                      <div className="flex items-center gap-3 min-w-0">
                        {coach.avatar_url ? (
                          <img src={coach.avatar_url} alt={coach.name} className="w-9 h-9 rounded-full flex-shrink-0 border-2 border-border" width={36} height={36} />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-harvest/20 flex items-center justify-center flex-shrink-0 border-2 border-border">
                            <ClipboardList className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-foreground truncate text-sm">{coach.name}</p>
                            {roleTag && roleStyle && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${roleStyle}`}>{roleTag}</span>
                            )}
                          </div>
                          {stats.teamNames.length > 0 && (
                            <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                              {stats.teamNames.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Championships */}
                    <td className="py-3 px-3 sm:px-6 text-center">
                      {stats.championships > 0 ? (
                        <span className="inline-flex items-center gap-1 font-black text-sm text-yellow-600">
                          <Trophy className="w-3.5 h-3.5" />
                          {stats.championships}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">0</span>
                      )}
                    </td>

                    {/* Tournaments */}
                    <td className="py-3 px-3 sm:px-6 text-center font-bold text-sm text-foreground">
                      {stats.totalTournaments}
                    </td>

                    {/* Teams coached */}
                    <td className="py-3 px-3 sm:px-6 text-center">
                      <span className="inline-flex items-center gap-1 text-sm text-foreground">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        {stats.teamsCoached}
                      </span>
                    </td>

                    {/* Matches */}
                    <td className="py-3 px-3 sm:px-6 text-center text-sm text-foreground">{stats.totalMatches}</td>

                    {/* Wins */}
                    <td className="py-3 px-3 sm:px-6 text-center text-sm font-bold text-[#10b981]">{stats.totalWins}</td>

                    {/* Losses */}
                    <td className="py-3 px-3 sm:px-6 text-center text-sm font-bold text-[#ef4444]">{stats.totalLosses}</td>

                    {/* Win rate */}
                    <td className="py-3 px-3 sm:px-6 text-center text-sm font-bold text-foreground">{stats.winrate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Result count */}
        <div className="px-4 sm:px-6 py-3 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          Showing {visibleCoaches.length} of {sortedCoaches.length} coaches
        </div>
      </div>

      {/* Infinite scroll sentinel */}
      {hasMore && <div ref={sentinelRef} className="h-10" />}
    </>
  );
}