import { useState, useMemo } from 'react';
import { getHeroName, getHeroImage } from '@/utils/dota-constants';
import { ArrowUp, ArrowDown, Search } from 'lucide-react';

interface PlayerStat {
  id: string;
  player_name: string;
  steam_id: string;
  hero_id: number;
  hero_name: string;
  kills: number;
  deaths: number;
  assists: number;
  last_hits: number;
  denies: number;
  gpm: number;
  xpm: number;
  hero_damage: number;
  tower_damage: number;
  hero_healing: number;
  net_worth?: number;
  gold?: number;
  observer_uses?: number;
  sentry_uses?: number;
  level?: number;
  is_winner: boolean;
  account_id: number;
  player: {
    account_id: number;
    steam_id: string;
    name: string;
    avatar_url: string | null;
    dotabuff_url: string | null;
    opendota_url: string | null;
  } | null;
}

interface PlayerStatsTableProps {
  stats: PlayerStat[];
}

type SortField = 'player_name' | 'hero_name' | 'kills' | 'deaths' | 'assists' | 'kda' | 'last_hits' | 'denies' | 'gpm' | 'xpm' | 'hero_damage' | 'tower_damage' | 'hero_healing' | 'net_worth';
type SortOrder = 'asc' | 'desc';

export function PlayerStatsTable({ stats }: PlayerStatsTableProps) {
  const [sortField, setSortField] = useState<SortField>('kills');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const getKDA = (k: number, d: number, a: number) => {
    const kda = d === 0 ? k + a : (k + a) / d;
    return kda;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedAndFilteredStats = useMemo(() => {
    let filtered = stats;

    // Apply search filter
    if (searchTerm) {
      filtered = stats.filter(stat => {
        const playerName = stat.player?.name || stat.player_name;
        return playerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               getHeroName(stat.hero_id).toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      if (sortField === 'kda') {
        aVal = getKDA(a.kills, a.deaths, a.assists);
        bVal = getKDA(b.kills, b.deaths, b.assists);
      } else if (sortField === 'player_name' || sortField === 'hero_name') {
        aVal = sortField === 'player_name' ? (a.player?.name || a.player_name) : getHeroName(a.hero_id);
        bVal = sortField === 'player_name' ? (b.player?.name || b.player_name) : getHeroName(b.hero_id);
      } else {
        aVal = a[sortField] || 0;
        bVal = b[sortField] || 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [stats, sortField, sortOrder, searchTerm]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ArrowDown className="w-4 h-4 inline ml-1" />
    );
  };

  const SortableHeader = ({ field, label, align = 'center' }: { field: SortField; label: string; align?: 'left' | 'center' }) => (
    <th
      className={`py-3 px-3 text-sm font-semibold text-[#0f172a]/80 cursor-pointer hover:text-[#f97316] transition-colors ${
        align === 'center' ? 'text-center' : 'text-left'
      }`}
      onClick={() => handleSort(field)}
    >
      {label}
      <SortIcon field={field} />
    </th>
  );

  return (
    <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 overflow-hidden">
      {/* Header with search */}
      <div className="p-6 border-b-2 border-[#0f172a]/10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h2 className="text-2xl font-bold text-[#0f172a]">Player Statistics</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#0f172a]/40" />
            <input
              type="text"
              placeholder="Search player or hero..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-sm"
            />
          </div>
        </div>
        <p className="text-sm text-[#0f172a]/60 mt-2">
          Click column headers to sort • Showing {sortedAndFilteredStats.length} player{sortedAndFilteredStats.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#fdf5e9] border-b-2 border-[#0f172a]/10">
            <tr>
              <SortableHeader field="player_name" label="Player" align="left" />
              <SortableHeader field="hero_name" label="Hero" align="left" />
              <SortableHeader field="kills" label="K" />
              <SortableHeader field="deaths" label="D" />
              <SortableHeader field="assists" label="A" />
              <SortableHeader field="kda" label="KDA" />
              <SortableHeader field="net_worth" label="Net ₲" />
              <SortableHeader field="last_hits" label="LH" />
              <SortableHeader field="denies" label="DN" />
              <SortableHeader field="gpm" label="GPM" />
              <SortableHeader field="xpm" label="XPM" />
              <SortableHeader field="hero_damage" label="HD" />
              <SortableHeader field="hero_healing" label="HH" />
              <SortableHeader field="tower_damage" label="TD" />
              <th className="py-3 px-3 text-center text-sm font-semibold text-[#0f172a]/80">Result</th>
            </tr>
          </thead>
          <tbody>
            {sortedAndFilteredStats.map((stat, index) => {
              const heroName = getHeroName(stat.hero_id);
              const heroImage = getHeroImage(stat.hero_id);
              const kda = getKDA(stat.kills, stat.deaths, stat.assists);

              return (
                <tr
                  key={stat.id}
                  className={`border-b border-[#0f172a]/10 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-[#fdf5e9]/50'
                  } hover:bg-[#f97316]/5 transition-colors`}
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      {stat.player?.avatar_url ? (
                        <img 
                          src={stat.player.avatar_url} 
                          alt={stat.player?.name || stat.player_name}
                          className="w-8 h-8 rounded-full border border-[#0f172a]/10"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center text-xs font-bold text-white">
                          {(stat.player?.name || stat.player_name)[0]?.toUpperCase()}
                        </div>
                      )}
                      {stat.player?.dotabuff_url ? (
                        <a
                          href={stat.player.dotabuff_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#3b82f6] hover:text-[#2563eb] font-semibold text-sm"
                        >
                          {stat.player?.name || stat.player_name}
                        </a>
                      ) : (
                        <span className="text-[#0f172a] font-semibold text-sm">{stat.player?.name || stat.player_name}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={heroImage}
                        alt={heroName}
                        className="w-8 h-8 rounded border border-[#0f172a]/10"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <span className="text-[#0f172a] text-sm">{heroName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center text-[#10b981] font-bold text-sm">{stat.kills}</td>
                  <td className="py-3 px-3 text-center text-[#ef4444] font-bold text-sm">{stat.deaths}</td>
                  <td className="py-3 px-3 text-center text-[#3b82f6] font-bold text-sm">{stat.assists}</td>
                  <td className="py-3 px-3 text-center text-[#0f172a] font-bold text-sm">
                    {kda.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-center text-[#fbbf24] font-semibold text-sm">
                    {stat.net_worth ? (stat.net_worth / 1000).toFixed(1) + 'k' : '-'}
                  </td>
                  <td className="py-3 px-3 text-center text-[#0f172a]/70 text-sm">{stat.last_hits}</td>
                  <td className="py-3 px-3 text-center text-[#0f172a]/70 text-sm">{stat.denies}</td>
                  <td className="py-3 px-3 text-center text-[#0f172a]/70 text-sm">{stat.gpm}</td>
                  <td className="py-3 px-3 text-center text-[#0f172a]/70 text-sm">{stat.xpm}</td>
                  <td className="py-3 px-3 text-center text-[#ef4444]/80 text-sm">
                    {stat.hero_damage ? (stat.hero_damage / 1000).toFixed(1) + 'k' : '-'}
                  </td>
                  <td className="py-3 px-3 text-center text-[#10b981]/80 text-sm">
                    {stat.hero_healing ? (stat.hero_healing / 1000).toFixed(1) + 'k' : '-'}
                  </td>
                  <td className="py-3 px-3 text-center text-[#f97316]/80 text-sm">
                    {stat.tower_damage ? (stat.tower_damage / 1000).toFixed(1) + 'k' : '-'}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${
                        stat.is_winner
                          ? 'bg-[#10b981]/10 text-[#10b981]'
                          : 'bg-[#ef4444]/10 text-[#ef4444]'
                      }`}
                    >
                      {stat.is_winner ? 'W' : 'L'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedAndFilteredStats.length === 0 && (
        <div className="p-12 text-center">
          <p className="text-[#0f172a]/60">No players found matching "{searchTerm}"</p>
        </div>
      )}
    </div>
  );
}
