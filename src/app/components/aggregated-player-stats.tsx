import { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, Search, Trophy, Target, Users } from 'lucide-react';
import { getHeroImage } from '@/utils/dota-constants';

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

interface AggregatedPlayerStatsProps {
  stats: PlayerStat[];
}

interface AggregatedPlayer {
  steam_id: string;
  player_name: string;
  avatar_url: string | null;
  dotabuff_url: string | null;
  opendota_url: string | null;
  games_played: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
  avg_kills: number;
  avg_deaths: number;
  avg_assists: number;
  kda: number;
  avg_gpm: number;
  avg_xpm: number;
  total_hero_damage: number;
  total_tower_damage: number;
  total_hero_healing: number;
  avg_last_hits: number;
  avg_denies: number;
  most_played_hero: string;
  most_played_hero_id: number;
  most_played_hero_games: number;
  total_net_worth: number;
  avg_net_worth: number;
}

type SortField = keyof AggregatedPlayer;
type SortOrder = 'asc' | 'desc';

export function AggregatedPlayerStats({ stats }: AggregatedPlayerStatsProps) {
  const [sortField, setSortField] = useState<SortField>('games_played');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const aggregatedPlayers = useMemo(() => {
    const playerMap = new Map<string, AggregatedPlayer>();

    stats.forEach((stat) => {
      const steamId = stat.player?.steam_id || stat.steam_id;
      const playerName = stat.player?.name || stat.player_name;

      if (!playerMap.has(steamId)) {
        playerMap.set(steamId, {
          steam_id: steamId,
          player_name: playerName,
          avatar_url: stat.player?.avatar_url || null,
          dotabuff_url: stat.player?.dotabuff_url || null,
          opendota_url: stat.player?.opendota_url || null,
          games_played: 0,
          wins: 0,
          losses: 0,
          win_rate: 0,
          total_kills: 0,
          total_deaths: 0,
          total_assists: 0,
          avg_kills: 0,
          avg_deaths: 0,
          avg_assists: 0,
          kda: 0,
          avg_gpm: 0,
          avg_xpm: 0,
          total_hero_damage: 0,
          total_tower_damage: 0,
          total_hero_healing: 0,
          avg_last_hits: 0,
          avg_denies: 0,
          most_played_hero: '',
          most_played_hero_id: 0,
          most_played_hero_games: 0,
          total_net_worth: 0,
          avg_net_worth: 0,
        });
      }

      const player = playerMap.get(steamId)!;
      player.games_played++;
      if (stat.is_winner) {
        player.wins++;
      } else {
        player.losses++;
      }
      player.total_kills += stat.kills || 0;
      player.total_deaths += stat.deaths || 0;
      player.total_assists += stat.assists || 0;
      player.avg_gpm += stat.gpm || 0;
      player.avg_xpm += stat.xpm || 0;
      player.total_hero_damage += stat.hero_damage || 0;
      player.total_tower_damage += stat.tower_damage || 0;
      player.total_hero_healing += stat.hero_healing || 0;
      player.avg_last_hits += stat.last_hits || 0;
      player.avg_denies += stat.denies || 0;
      player.total_net_worth += stat.net_worth || 0;
    });

    // Calculate averages and hero stats
    const result: AggregatedPlayer[] = [];
    playerMap.forEach((player) => {
      player.win_rate = player.games_played > 0 ? (player.wins / player.games_played) * 100 : 0;
      player.avg_kills = player.games_played > 0 ? player.total_kills / player.games_played : 0;
      player.avg_deaths = player.games_played > 0 ? player.total_deaths / player.games_played : 0;
      player.avg_assists = player.games_played > 0 ? player.total_assists / player.games_played : 0;
      player.kda = player.total_deaths === 0 ? player.total_kills + player.total_assists : (player.total_kills + player.total_assists) / player.total_deaths;
      player.avg_gpm = player.games_played > 0 ? player.avg_gpm / player.games_played : 0;
      player.avg_xpm = player.games_played > 0 ? player.avg_xpm / player.games_played : 0;
      player.avg_last_hits = player.games_played > 0 ? player.avg_last_hits / player.games_played : 0;
      player.avg_denies = player.games_played > 0 ? player.avg_denies / player.games_played : 0;
      player.avg_net_worth = player.games_played > 0 ? player.total_net_worth / player.games_played : 0;

      // Find most played hero (with hero_id)
      const heroCount = new Map<string, { hero_id: number; count: number }>();
      stats
        .filter((s) => (s.player?.steam_id || s.steam_id) === player.steam_id)
        .forEach((s) => {
          const heroName = s.hero_name;
          const existing = heroCount.get(heroName) || { hero_id: s.hero_id, count: 0 };
          heroCount.set(heroName, { hero_id: s.hero_id, count: existing.count + 1 });
        });

      if (heroCount.size > 0) {
        const mostPlayed = Array.from(heroCount.entries()).sort((a, b) => b[1].count - a[1].count)[0];
        player.most_played_hero = mostPlayed[0];
        player.most_played_hero_id = mostPlayed[1].hero_id;
        player.most_played_hero_games = mostPlayed[1].count;
      }

      result.push(player);
    });

    return result;
  }, [stats]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedAndFilteredPlayers = useMemo(() => {
    let filtered = aggregatedPlayers;

    // Apply search filter
    if (searchTerm) {
      filtered = aggregatedPlayers.filter((player) =>
        player.player_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // String comparison
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [aggregatedPlayers, sortField, sortOrder, searchTerm]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ArrowDown className="w-4 h-4 inline ml-1" />
    );
  };

  const SortableHeader = ({
    field,
    label,
    align = 'center',
    sticky = false,
  }: {
    field: SortField;
    label: string;
    align?: 'left' | 'center';
    sticky?: boolean;
  }) => (
    <th
      className={`py-4 px-6 text-xs font-bold text-[#0f172a]/70 cursor-pointer hover:text-[#f97316] transition-colors uppercase tracking-wide ${
        align === 'center' ? 'text-center' : 'text-left'
      } ${sticky ? 'sticky left-0 z-10 bg-[#fdf5e9]' : ''}`}
      onClick={() => handleSort(field)}
    >
      <div className="whitespace-nowrap">
        {label}
        <SortIcon field={field} />
      </div>
    </th>
  );

  return (
    <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 overflow-hidden">
      {/* Header with search */}
      <div className="p-6 border-b-2 border-[#0f172a]/10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#0f172a] flex items-center gap-2">
              <Trophy className="w-6 h-6 text-[#f97316]" />
              Player Stats
            </h2>
            <p className="text-sm text-[#0f172a]/60 mt-1">
              Aggregated stats across all matches in this Kernel Kup
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#0f172a]/40" />
            <input
              type="text"
              placeholder="Search player..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-sm w-full md:w-64"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-[#0f172a]/60">
          <Users className="w-4 h-4" />
          <span>
            Showing {sortedAndFilteredPlayers.length} player{sortedAndFilteredPlayers.length !== 1 ? 's' : ''} • Click column headers to sort
          </span>
        </div>
      </div>

      {/* Horizontal Scrollable Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max">
          <thead className="bg-[#fdf5e9] border-b-2 border-[#0f172a]/10">
            <tr>
              <SortableHeader field="player_name" label="Player" align="left" sticky />
              <SortableHeader field="games_played" label="Games Played" />
              <SortableHeader field="wins" label="Wins" />
              <SortableHeader field="losses" label="Losses" />
              <SortableHeader field="win_rate" label="Win Rate" />
              <SortableHeader field="total_kills" label="Total Kills" />
              <SortableHeader field="total_deaths" label="Total Deaths" />
              <SortableHeader field="total_assists" label="Total Assists" />
              <SortableHeader field="kda" label="KDA" />
              <SortableHeader field="avg_kills" label="AVG Kills" />
              <SortableHeader field="avg_deaths" label="AVG Deaths" />
              <SortableHeader field="avg_assists" label="AVG Assists" />
              <SortableHeader field="total_net_worth" label="Total Net Worth" />
              <SortableHeader field="avg_net_worth" label="AVG Net Worth" />
              <SortableHeader field="avg_gpm" label="AVG GPM" />
              <SortableHeader field="avg_xpm" label="AVG XPM" />
              <SortableHeader field="avg_last_hits" label="AVG Last Hits" />
              <SortableHeader field="avg_denies" label="AVG Denies" />
              <SortableHeader field="total_hero_damage" label="Total Hero Damage" />
              <SortableHeader field="total_tower_damage" label="Total Tower Damage" />
              <SortableHeader field="total_hero_healing" label="Total Hero Healing" />
              <SortableHeader field="most_played_hero" label="Top Hero" align="left" />
            </tr>
          </thead>
          <tbody>
            {sortedAndFilteredPlayers.map((player, index) => {
              // Get hero image using the proper function
              const heroImageUrl = player.most_played_hero_id ? getHeroImage(player.most_played_hero_id) : '';

              return (
                <tr
                  key={player.steam_id}
                  className={`border-b border-[#0f172a]/10 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-[#fdf5e9]/50'
                  } hover:bg-[#f97316]/5 transition-colors`}
                >
                  {/* Player - STICKY */}
                  <td className={`py-5 px-6 sticky left-0 z-10 ${index % 2 === 0 ? 'bg-white' : 'bg-[#fdf5e9]/50'}`}>
                    <div className="flex items-center gap-3 min-w-[200px]">
                      {player.avatar_url ? (
                        <img
                          src={player.avatar_url}
                          alt={player.player_name}
                          className="w-10 h-10 rounded-full border-2 border-[#0f172a]/10"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center text-sm font-bold text-white">
                          {player.player_name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        {player.dotabuff_url ? (
                          <a
                            href={player.dotabuff_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#3b82f6] hover:text-[#2563eb] font-bold text-sm"
                          >
                            {player.player_name}
                          </a>
                        ) : (
                          <span className="text-[#0f172a] font-bold text-sm">
                            {player.player_name}
                          </span>
                        )}
                        {player.opendota_url && (
                          <div className="mt-0.5">
                            <a
                              href={player.opendota_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#f97316] hover:underline"
                            >
                              OpenDota
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Games Played */}
                  <td className="py-5 px-6 text-center text-[#0f172a] font-bold">
                    {player.games_played}
                  </td>

                  {/* Wins */}
                  <td className="py-5 px-6 text-center text-[#10b981] font-bold">
                    {player.wins}
                  </td>

                  {/* Losses */}
                  <td className="py-5 px-6 text-center text-[#ef4444] font-bold">
                    {player.losses}
                  </td>

                  {/* Win Rate */}
                  <td className="py-5 px-6 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        player.win_rate >= 60
                          ? 'bg-[#10b981]/10 text-[#10b981]'
                          : player.win_rate >= 50
                          ? 'bg-[#f97316]/10 text-[#f97316]'
                          : 'bg-[#ef4444]/10 text-[#ef4444]'
                      }`}
                    >
                      {player.win_rate.toFixed(1)}%
                    </span>
                  </td>

                  {/* Total Kills */}
                  <td className="py-5 px-6 text-center text-[#10b981] font-bold">
                    {player.total_kills}
                  </td>

                  {/* Total Deaths */}
                  <td className="py-5 px-6 text-center text-[#ef4444] font-bold">
                    {player.total_deaths}
                  </td>

                  {/* Total Assists */}
                  <td className="py-5 px-6 text-center text-[#3b82f6] font-bold">
                    {player.total_assists}
                  </td>

                  {/* KDA */}
                  <td className="py-5 px-6 text-center text-[#0f172a] font-black text-base">
                    {player.kda.toFixed(2)}
                  </td>

                  {/* Avg Kills */}
                  <td className="py-5 px-6 text-center text-[#0f172a]/70">
                    {player.avg_kills.toFixed(1)}
                  </td>

                  {/* Avg Deaths */}
                  <td className="py-5 px-6 text-center text-[#0f172a]/70">
                    {player.avg_deaths.toFixed(1)}
                  </td>

                  {/* Avg Assists */}
                  <td className="py-5 px-6 text-center text-[#0f172a]/70">
                    {player.avg_assists.toFixed(1)}
                  </td>

                  {/* Total Net Worth */}
                  <td className="py-5 px-6 text-center text-[#f97316] font-bold">
                    {player.total_net_worth.toLocaleString()}
                  </td>

                  {/* AVG Net Worth */}
                  <td className="py-5 px-6 text-center text-[#f97316] font-semibold">
                    {Math.round(player.avg_net_worth).toLocaleString()}
                  </td>

                  {/* Avg GPM */}
                  <td className="py-5 px-6 text-center text-[#fbbf24] font-semibold">
                    {Math.round(player.avg_gpm)}
                  </td>

                  {/* Avg XPM */}
                  <td className="py-5 px-6 text-center text-[#a855f7] font-semibold">
                    {Math.round(player.avg_xpm)}
                  </td>

                  {/* Avg Last Hits */}
                  <td className="py-5 px-6 text-center text-[#0f172a]/70">
                    {Math.round(player.avg_last_hits)}
                  </td>

                  {/* Avg Denies */}
                  <td className="py-5 px-6 text-center text-[#0f172a]/70">
                    {Math.round(player.avg_denies)}
                  </td>

                  {/* Total Hero Damage */}
                  <td className="py-5 px-6 text-center text-[#ef4444]/80 font-semibold">
                    {(player.total_hero_damage / 1000).toFixed(1)}k
                  </td>

                  {/* Total Tower Damage */}
                  <td className="py-5 px-6 text-center text-[#f97316]/80 font-semibold">
                    {(player.total_tower_damage / 1000).toFixed(1)}k
                  </td>

                  {/* Total Hero Healing */}
                  <td className="py-5 px-6 text-center text-[#10b981]/80 font-semibold">
                    {(player.total_hero_healing / 1000).toFixed(1)}k
                  </td>

                  {/* Most Played Hero */}
                  <td className="py-5 px-6">
                    {player.most_played_hero && (
                      <div className="flex items-center gap-3 min-w-[160px]">
                        {heroImageUrl && (
                          <img
                            src={heroImageUrl}
                            alt={player.most_played_hero}
                            className="w-10 h-10 rounded border-2 border-[#0f172a]/10"
                          />
                        )}
                        <div>
                          <p className="text-[#0f172a] text-sm font-semibold whitespace-nowrap">
                            {player.most_played_hero}
                          </p>
                          <p className="text-xs text-[#0f172a]/60">
                            {player.most_played_hero_games} game{player.most_played_hero_games !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedAndFilteredPlayers.length === 0 && (
        <div className="p-12 text-center">
          <Target className="w-16 h-16 mx-auto mb-4 text-[#0f172a]/20" />
          <p className="text-[#0f172a]/60">
            {searchTerm ? `No players found matching "${searchTerm}"` : 'No player data available yet'}
          </p>
        </div>
      )}
    </div>
  );
}
