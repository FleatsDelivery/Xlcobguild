import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Search } from 'lucide-react';
import { getHeroImageUrl } from '@/lib/dota-heroes';
import { getRoleBadgeTag, getRoleBadgeStyle } from '@/lib/roles';
import type { HallOfFamePlayer, PlayerSortKey, SortOrder, TournamentType } from './hall-of-fame-types';

const BATCH_SIZE = 25;

interface Props {
  players: HallOfFamePlayer[];
  selectedTab: TournamentType;
  searchTerm: string;
}

export function HallOfFamePlayers({ players, selectedTab, searchTerm }: Props) {
  const [sortField, setSortField] = useState<PlayerSortKey>('championships');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [searchTerm, selectedTab, sortField, sortOrder]);

  const handleSort = useCallback((field: PlayerSortKey) => {
    setSortOrder(prev => sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'desc');
    setSortField(field);
  }, [sortField]);

  const sortedAndFiltered = useMemo(() => {
    const getStats = (p: HallOfFamePlayer) =>
      selectedTab === 'all' ? p.stats :
      selectedTab === 'kernel_kup' ? p.kernelKupStats : p.heapsNHooksStats;

    let filtered = players.filter(player => {
      const stats = getStats(player);
      if (!stats) return false;
      return player.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    filtered.sort((a, b) => {
      const aStats = getStats(a);
      const bStats = getStats(b);
      if (!aStats || !bStats) return 0;

      let aVal: number, bVal: number;
      switch (sortField) {
        case 'name':
          return sortOrder === 'asc'
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        case 'championships': aVal = aStats.championships; bVal = bStats.championships; break;
        case 'mvps': aVal = aStats.mvps; bVal = bStats.mvps; break;
        case 'prizeWinnings': aVal = aStats.prizeWinnings; bVal = bStats.prizeWinnings; break;
        case 'totalTournaments': aVal = aStats.totalTournaments; bVal = bStats.totalTournaments; break;
        case 'totalMatches': aVal = aStats.totalMatches; bVal = bStats.totalMatches; break;
        case 'totalWins': aVal = aStats.totalWins; bVal = bStats.totalWins; break;
        case 'totalLosses': aVal = aStats.totalLosses; bVal = bStats.totalLosses; break;
        case 'winrate': aVal = parseFloat(aStats.winrate); bVal = parseFloat(bStats.winrate); break;
        case 'totalKills': aVal = aStats.totalKills; bVal = bStats.totalKills; break;
        case 'totalDeaths': aVal = aStats.totalDeaths; bVal = bStats.totalDeaths; break;
        case 'totalAssists': aVal = aStats.totalAssists; bVal = bStats.totalAssists; break;
        case 'avgKDA':
          aVal = typeof aStats.avgKDA === 'string' ? parseFloat(aStats.avgKDA) : aStats.avgKDA;
          bVal = typeof bStats.avgKDA === 'string' ? parseFloat(bStats.avgKDA) : bStats.avgKDA;
          break;
        case 'avgGPM': aVal = parseFloat(aStats.avgGPM); bVal = parseFloat(bStats.avgGPM); break;
        case 'avgXPM': aVal = parseFloat(aStats.avgXPM); bVal = parseFloat(bStats.avgXPM); break;
        case 'totalLastHits': aVal = aStats.totalLastHits; bVal = bStats.totalLastHits; break;
        case 'totalDenies': aVal = aStats.totalDenies; bVal = bStats.totalDenies; break;
        case 'totalNetWorth': aVal = aStats.totalNetWorth; bVal = bStats.totalNetWorth; break;
        case 'avgNetWorth': aVal = aStats.avgNetWorth; bVal = bStats.avgNetWorth; break;
        case 'signatureHeroGames': aVal = aStats.signatureHero?.games || 0; bVal = bStats.signatureHero?.games || 0; break;
        case 'avgKills': aVal = aStats.totalMatches > 0 ? aStats.totalKills / aStats.totalMatches : 0; bVal = bStats.totalMatches > 0 ? bStats.totalKills / bStats.totalMatches : 0; break;
        case 'avgDeaths': aVal = aStats.totalMatches > 0 ? aStats.totalDeaths / aStats.totalMatches : 0; bVal = bStats.totalMatches > 0 ? bStats.totalDeaths / bStats.totalMatches : 0; break;
        case 'avgAssists': aVal = aStats.totalMatches > 0 ? aStats.totalAssists / aStats.totalMatches : 0; bVal = bStats.totalMatches > 0 ? bStats.totalAssists / bStats.totalMatches : 0; break;
        case 'avgLastHits': aVal = aStats.totalMatches > 0 ? aStats.totalLastHits / aStats.totalMatches : 0; bVal = bStats.totalMatches > 0 ? bStats.totalLastHits / bStats.totalMatches : 0; break;
        case 'avgDenies': aVal = aStats.totalMatches > 0 ? aStats.totalDenies / aStats.totalMatches : 0; bVal = bStats.totalMatches > 0 ? bStats.totalDenies / bStats.totalMatches : 0; break;
        default: return 0;
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return filtered;
  }, [players, searchTerm, sortField, sortOrder, selectedTab]);

  const visiblePlayers = sortedAndFiltered.slice(0, visibleCount);
  const hasMore = visibleCount < sortedAndFiltered.length;

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setVisibleCount(prev => prev + BATCH_SIZE); },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  const SortHeader = ({ field, label }: { field: PlayerSortKey; label: string }) => (
    <th
      className="py-4 px-6 text-xs font-bold text-muted-foreground cursor-pointer hover:text-harvest transition-colors uppercase tracking-wide text-center"
      onClick={() => handleSort(field)}
    >
      <div className="whitespace-nowrap">
        {label}
        {sortField === field && (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 inline ml-1" /> : <ArrowDown className="w-4 h-4 inline ml-1" />)}
      </div>
    </th>
  );

  if (sortedAndFiltered.length === 0) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-12 text-center">
        <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-xl font-bold text-muted-foreground">No players found{selectedTab !== 'all' ? ` for ${selectedTab === 'kernel_kup' ? 'Kernel Kup' : "Heaps n' Hooks"}` : ''}</p>
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
                <th className="py-4 px-6 text-xs font-bold text-muted-foreground uppercase tracking-wide text-center w-12 sticky left-0 z-40 bg-muted">#</th>
                <th className="py-4 px-6 text-xs font-bold text-muted-foreground cursor-pointer hover:text-harvest transition-colors uppercase tracking-wide text-left sticky left-12 z-40 bg-muted" onClick={() => handleSort('name')}>
                  <div className="whitespace-nowrap">Player {sortField === 'name' && (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 inline ml-1" /> : <ArrowDown className="w-4 h-4 inline ml-1" />)}</div>
                </th>
                <SortHeader field="signatureHeroGames" label="Top Hero" />
                <SortHeader field="championships" label="Champ" />
                <SortHeader field="mvps" label="Pop'd Kernels" />
                <SortHeader field="prizeWinnings" label="Prize $" />
                <SortHeader field="totalTournaments" label="Tourneys" />
                <SortHeader field="totalMatches" label="GP" />
                <SortHeader field="totalWins" label="W" />
                <SortHeader field="totalLosses" label="L" />
                <SortHeader field="winrate" label="Win %" />
                <SortHeader field="totalKills" label="Kills" />
                <SortHeader field="totalDeaths" label="Deaths" />
                <SortHeader field="totalAssists" label="Assists" />
                <SortHeader field="avgKDA" label="KDA" />
                <SortHeader field="avgKills" label="Avg K" />
                <SortHeader field="avgDeaths" label="Avg D" />
                <SortHeader field="avgAssists" label="Avg A" />
                <SortHeader field="totalLastHits" label="Total LH" />
                <SortHeader field="totalDenies" label="Total DN" />
                <SortHeader field="avgLastHits" label="Avg LH" />
                <SortHeader field="avgDenies" label="Avg DN" />
                <SortHeader field="avgGPM" label="Avg GPM" />
                <SortHeader field="avgXPM" label="Avg XPM" />
                <SortHeader field="totalNetWorth" label="Total NW" />
                <SortHeader field="avgNetWorth" label="Avg NW" />
              </tr>
            </thead>
            <tbody>
              {visiblePlayers.map((player, index) => {
                const stats = selectedTab === 'all' ? player.stats :
                  selectedTab === 'kernel_kup' ? player.kernelKupStats : player.heapsNHooksStats;
                if (!stats) return null;
                const avgKills = stats.totalMatches > 0 ? (stats.totalKills / stats.totalMatches).toFixed(1) : '0.0';
                const avgDeaths = stats.totalMatches > 0 ? (stats.totalDeaths / stats.totalMatches).toFixed(1) : '0.0';
                const avgAssists = stats.totalMatches > 0 ? (stats.totalAssists / stats.totalMatches).toFixed(1) : '0.0';
                const avgLastHits = stats.totalMatches > 0 ? Math.round(stats.totalLastHits / stats.totalMatches) : 0;
                const avgDenies = stats.totalMatches > 0 ? Math.round(stats.totalDenies / stats.totalMatches) : 0;
                const rowBg = index % 2 === 0 ? 'bg-card' : 'bg-muted/50';

                return (
                  <tr key={player.id} className={`border-b border-border ${rowBg} hover:bg-harvest/5 transition-colors`}>
                    <td className={`py-5 px-6 text-center font-bold text-muted-foreground text-sm sticky left-0 z-10 ${rowBg}`}>{index + 1}</td>
                    <td className={`py-5 px-6 sticky left-12 z-10 ${rowBg}`}>
                      <div className="flex items-center gap-3 min-w-[200px]">
                        {player.avatar_url ? (
                          <img src={player.avatar_url} alt={player.name} className="w-10 h-10 rounded-full border-2 border-border" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-harvest to-amber flex items-center justify-center text-sm font-bold text-white">
                            {player.name[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-foreground text-sm">{player.name}</p>
                          {player.user && (() => {
                            const tag = getRoleBadgeTag(player.user.role);
                            const style = getRoleBadgeStyle(player.user.role);
                            return (
                              <span
                                className={`text-[10px] font-black px-1.5 py-0.5 rounded ${style.badge}`}
                                style={style.hex && !style.badge ? { color: style.hex, backgroundColor: `${style.hex}15` } : undefined}
                              >
                                {tag}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      {stats.signatureHero && (
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <img src={getHeroImageUrl(stats.signatureHero.hero_id)} alt={stats.signatureHero.hero_name} className="w-10 h-10 rounded border-2 border-border" />
                          <div>
                            <p className="text-foreground text-sm font-semibold whitespace-nowrap">{stats.signatureHero.hero_name}</p>
                            <p className="text-xs text-muted-foreground">x{stats.signatureHero.games}</p>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-5 px-6 text-center">{stats.championships > 0 ? <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-yellow-100 text-yellow-600 font-black">{stats.championships}</span> : null}</td>
                    <td className="py-5 px-6 text-center">{stats.mvps > 0 ? <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-harvest/10 text-harvest font-black">{stats.mvps}</span> : null}</td>
                    <td className="py-5 px-6 text-center">
                      {stats.prizeWinnings > 0 ? (
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-black text-sm whitespace-nowrap">
                          ${(stats.prizeWinnings / 100).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>
                    <td className="py-5 px-6 text-center font-bold text-foreground">{stats.totalTournaments}</td>
                    <td className="py-5 px-6 text-center font-bold text-foreground">{stats.totalMatches}</td>
                    <td className="py-5 px-6 text-center font-bold text-[#10b981]">{stats.totalWins}</td>
                    <td className="py-5 px-6 text-center font-bold text-[#ef4444]">{stats.totalLosses}</td>
                    <td className="py-5 px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${parseFloat(stats.winrate) >= 60 ? 'bg-[#10b981]/10 text-[#10b981]' : parseFloat(stats.winrate) >= 50 ? 'bg-harvest/10 text-harvest' : 'bg-[#ef4444]/10 text-[#ef4444]'}`}>
                        {stats.winrate}%
                      </span>
                    </td>
                    <td className="py-5 px-6 text-center text-[#10b981] font-bold">{stats.totalKills}</td>
                    <td className="py-5 px-6 text-center text-[#ef4444] font-bold">{stats.totalDeaths}</td>
                    <td className="py-5 px-6 text-center text-[#3b82f6] font-bold">{stats.totalAssists}</td>
                    <td className="py-5 px-6 text-center text-foreground font-black text-base">{stats.avgKDA}</td>
                    <td className="py-5 px-6 text-center text-[#10b981]/70 font-semibold">{avgKills}</td>
                    <td className="py-5 px-6 text-center text-[#ef4444]/70 font-semibold">{avgDeaths}</td>
                    <td className="py-5 px-6 text-center text-[#3b82f6]/70 font-semibold">{avgAssists}</td>
                    <td className="py-5 px-6 text-center text-muted-foreground">{stats.totalLastHits.toLocaleString()}</td>
                    <td className="py-5 px-6 text-center text-muted-foreground">{stats.totalDenies.toLocaleString()}</td>
                    <td className="py-5 px-6 text-center text-muted-foreground">{avgLastHits}</td>
                    <td className="py-5 px-6 text-center text-muted-foreground">{avgDenies}</td>
                    <td className="py-5 px-6 text-center text-[#fbbf24] font-semibold">{stats.avgGPM}</td>
                    <td className="py-5 px-6 text-center text-[#a855f7] font-semibold">{stats.avgXPM}</td>
                    <td className="py-5 px-6 text-center text-harvest font-bold">{(stats.totalNetWorth / 1000).toFixed(1)}k</td>
                    <td className="py-5 px-6 text-center text-harvest font-semibold">{(stats.avgNetWorth / 1000).toFixed(1)}k</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          <p className="text-sm text-muted-foreground">Showing {visibleCount} of {sortedAndFiltered.length} players...</p>
        </div>
      )}
    </>
  );
}