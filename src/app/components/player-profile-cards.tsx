import { User, ExternalLink, Trophy, Target } from 'lucide-react';

interface PlayerProfile {
  steam_id: string;
  name: string;
  avatar_url: string | null;
  dotabuff_url: string | null;
  opendota_url: string | null;
  stats?: {
    total_games: number;
    wins: number;
    kills: number;
    deaths: number;
    assists: number;
  };
}

interface PlayerProfileCardsProps {
  players: PlayerProfile[];
}

export function PlayerProfileCards({ players }: PlayerProfileCardsProps) {
  if (players.length === 0) {
    return (
      <div className="bg-white rounded-2xl border-2 border-field-dark/10 p-12 text-center">
        <User className="w-16 h-16 mx-auto mb-4 text-field-dark/20" />
        <p className="text-field-dark/60">No player profiles available yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {players.map((player) => {
        const winRate = player.stats && player.stats.total_games > 0
          ? ((player.stats.wins / player.stats.total_games) * 100).toFixed(1)
          : '0';
        const kda = player.stats && player.stats.deaths > 0
          ? (((player.stats.kills + player.stats.assists) / player.stats.deaths)).toFixed(2)
          : player.stats ? ((player.stats.kills + player.stats.assists)).toFixed(2) : '0';

        return (
          <div
            key={player.steam_id}
            className="bg-white rounded-xl border-2 border-field-dark/10 overflow-hidden hover:border-harvest transition-all hover:shadow-lg"
          >
            {/* Player Header */}
            <div className="bg-gradient-to-br from-harvest to-amber p-6 text-white relative">
              <div className="flex items-center gap-4">
                {player.avatar_url ? (
                  <img
                    src={player.avatar_url}
                    alt={player.name}
                    className="w-16 h-16 rounded-full border-4 border-white/30 object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full border-4 border-white/30 bg-white/20 flex items-center justify-center">
                    <User className="w-8 h-8" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg truncate">{player.name}</h3>
                  <p className="text-white/80 text-sm truncate">Steam ID: {player.steam_id}</p>
                </div>
              </div>
            </div>

            {/* Player Stats */}
            {player.stats && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-silk rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Trophy className="w-3 h-3 text-harvest" />
                      <span className="text-xs font-semibold text-field-dark/60">Win Rate</span>
                    </div>
                    <p className="text-xl font-black text-harvest">{winRate}%</p>
                  </div>
                  <div className="bg-silk rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Target className="w-3 h-3 text-harvest" />
                      <span className="text-xs font-semibold text-field-dark/60">KDA</span>
                    </div>
                    <p className="text-xl font-black text-harvest">{kda}</p>
                  </div>
                </div>

                <div className="bg-silk rounded-lg p-3">
                  <p className="text-xs font-semibold text-field-dark/60 mb-2">Tournament Stats</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-sm font-black text-field-dark">{player.stats.total_games}</p>
                      <p className="text-xs text-field-dark/60">Games</p>
                    </div>
                    <div>
                      <p className="text-sm font-black text-green-600">{player.stats.wins}</p>
                      <p className="text-xs text-field-dark/60">Wins</p>
                    </div>
                    <div>
                      <p className="text-sm font-black text-red-600">{player.stats.total_games - player.stats.wins}</p>
                      <p className="text-xs text-field-dark/60">Losses</p>
                    </div>
                  </div>
                </div>

                <div className="bg-silk rounded-lg p-3">
                  <p className="text-xs font-semibold text-field-dark/60 mb-2">K / D / A</p>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div>
                      <p className="text-lg font-black text-green-600">{player.stats.kills}</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-red-600">{player.stats.deaths}</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-blue-600">{player.stats.assists}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Player Links */}
            <div className="border-t-2 border-field-dark/10 p-3 flex gap-2">
              {player.dotabuff_url && (
                <a
                  href={player.dotabuff_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Dotabuff
                </a>
              )}
              {player.opendota_url && (
                <a
                  href={player.opendota_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  OpenDota
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}