import { useMemo } from 'react';
import { getHeroImage } from '@/utils/dota-constants';
import { Medal } from '@/lib/icons';

interface PlayerStat {
  player_name: string;
  kills: number;
  deaths: number;
  assists: number;
  gpm: number;
  xpm: number;
  hero_id: number;
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
  team?: {
    id: string;
    name: string;
    tag: string;
    logo_url: string | null;
  };
}

interface TournamentTopPlayersProps {
  playerStats: PlayerStat[];
  onPlayerClick?: (playerName: string) => void;
}

interface PlayerAggregate {
  playerName: string;
  avatarUrl: string | null;
  accountId: number;
  matches: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  avgGPM: number;
  avgXPM: number;
  wins: number;
  favoriteHero?: number;
  teamName?: string;
}

export function TournamentTopPlayers({ playerStats, onPlayerClick }: TournamentTopPlayersProps) {
  const topPlayers = useMemo(() => {
    const playerMap: Record<string, PlayerAggregate> = {};

    playerStats.forEach((stat) => {
      const playerKey = stat.player?.name || stat.player_name;
      if (!playerMap[playerKey]) {
        playerMap[playerKey] = {
          playerName: stat.player?.name || stat.player_name,
          avatarUrl: stat.player?.avatar_url || null,
          accountId: stat.account_id,
          matches: 0,
          totalKills: 0,
          totalDeaths: 0,
          totalAssists: 0,
          avgGPM: 0,
          avgXPM: 0,
          wins: 0,
        };
      }

      const player = playerMap[playerKey];
      player.matches++;
      player.totalKills += stat.kills;
      player.totalDeaths += stat.deaths;
      player.totalAssists += stat.assists;
      player.avgGPM += stat.gpm;
      player.avgXPM += stat.xpm;
      if (stat.is_winner) player.wins++;
      if (stat.team) player.teamName = stat.team.name;
    });

    // Calculate averages
    Object.values(playerMap).forEach((player) => {
      player.avgGPM = Math.round(player.avgGPM / player.matches);
      player.avgXPM = Math.round(player.avgXPM / player.matches);
    });

    // Sort by KDA
    return Object.values(playerMap)
      .sort((a, b) => {
        const kdaA = a.totalDeaths === 0 ? a.totalKills + a.totalAssists : (a.totalKills + a.totalAssists) / a.totalDeaths;
        const kdaB = b.totalDeaths === 0 ? b.totalKills + b.totalAssists : (b.totalKills + b.totalAssists) / b.totalDeaths;
        return kdaB - kdaA;
      })
      .slice(0, 5);
  }, [playerStats]);

  if (topPlayers.length === 0) {
    return null;
  }

  const getKDA = (kills: number, deaths: number, assists: number) => {
    const kda = deaths === 0 ? kills + assists : (kills + assists) / deaths;
    return kda.toFixed(2);
  };

  return (
    <div className="bg-card rounded-2xl border-2 border-border p-6">
      <div className="flex items-center gap-3 mb-6">
        <Medal className="w-6 h-6 text-harvest" />
        <h2 className="text-2xl font-bold text-foreground">Top Performers</h2>
      </div>
      <div className="space-y-3">
        {topPlayers.map((player, index) => {
          const kda = getKDA(player.totalKills, player.totalDeaths, player.totalAssists);
          const winRate = ((player.wins / player.matches) * 100).toFixed(0);

          return (
            <button
              key={player.playerName}
              className={`w-full flex items-center gap-4 rounded-xl border-2 transition-all cursor-pointer ${
                index === 0
                  ? 'bg-gradient-to-r from-harvest/10 to-amber/10 border-harvest hover:shadow-[0_0_30px_rgba(241,198,15,0.3)] p-6'
                  : 'bg-background border-border hover:border-harvest hover:bg-harvest/5 p-4'
              }`}
              onClick={() => onPlayerClick?.(player.playerName)}
            >
              <span
                className={`font-black min-w-[40px] text-center ${
                  index === 0 ? 'text-3xl text-harvest' : 'text-2xl text-muted-foreground'
                }`}
              >
                #{index + 1}
              </span>
              {player.avatarUrl ? (
                <img 
                  src={player.avatarUrl} 
                  alt={player.playerName}
                  className={index === 0 ? "w-16 h-16 rounded-full border-2 border-harvest" : "w-12 h-12 rounded-full border-2 border-harvest"}
                />
              ) : (
                <div className={`rounded-full bg-gradient-to-br from-harvest to-amber flex items-center justify-center border-2 border-harvest ${
                  index === 0 ? 'w-16 h-16' : 'w-12 h-12'
                }`}>
                  <span className={`text-white font-bold ${index === 0 ? 'text-2xl' : 'text-lg'}`}>{player.playerName[0]?.toUpperCase()}</span>
                </div>
              )}
              <div className="flex-1 text-left">
                <h3 className={`font-bold text-foreground ${index === 0 ? 'text-xl' : 'text-base'}`}>{player.playerName}</h3>
                <p className={`text-muted-foreground ${index === 0 ? 'text-base' : 'text-sm'}`}>
                  {player.matches} match{player.matches !== 1 ? 'es' : ''}{player.teamName ? ` • ${player.teamName}` : ''}
                </p>
              </div>
              <div className="text-center">
                <p className={`font-bold text-foreground ${index === 0 ? 'text-base' : 'text-sm'}`}>
                  {player.totalKills}/{player.totalDeaths}/{player.totalAssists}
                </p>
                <p className={index === 0 ? 'text-sm text-muted-foreground' : 'text-xs text-muted-foreground'}>K/D/A</p>
              </div>
              <div className="text-center">
                <p className={`font-black text-harvest ${index === 0 ? 'text-2xl' : 'text-xl'}`}>{kda}</p>
                <p className={index === 0 ? 'text-sm text-muted-foreground' : 'text-xs text-muted-foreground'}>KDA</p>
              </div>
              <div className="text-center">
                <p className={`font-bold text-[#10b981] ${index === 0 ? 'text-base' : 'text-sm'}`}>{winRate}%</p>
                <p className={index === 0 ? 'text-sm text-muted-foreground' : 'text-xs text-muted-foreground'}>Win Rate</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}