import { useMemo } from 'react';
import { getHeroName, getHeroImage } from '@/utils/dota-constants';
import { Flame } from 'lucide-react';

interface PlayerStat {
  hero_id: number;
  is_winner: boolean;
}

interface TournamentHeroStatsProps {
  playerStats: PlayerStat[];
  heroBans?: Record<number, number>; // hero_id -> ban count
}

interface HeroAggregateStat {
  hero_id: number;
  picks: number;
  wins: number;
  winRate: number;
  bans?: number;
}

export function TournamentHeroStats({ playerStats, heroBans }: TournamentHeroStatsProps) {
  const heroStats = useMemo(() => {
    const stats: Record<number, { picks: number; wins: number }> = {};

    playerStats.forEach((stat) => {
      if (!stats[stat.hero_id]) {
        stats[stat.hero_id] = { picks: 0, wins: 0 };
      }
      stats[stat.hero_id].picks++;
      if (stat.is_winner) {
        stats[stat.hero_id].wins++;
      }
    });

    const aggregated: HeroAggregateStat[] = Object.entries(stats).map(([heroId, data]) => ({
      hero_id: Number(heroId),
      picks: data.picks,
      wins: data.wins,
      winRate: (data.wins / data.picks) * 100,
      bans: heroBans ? heroBans[Number(heroId)] || 0 : 0,
    }));

    // Sort by picks (most picked first)
    return aggregated.sort((a, b) => b.picks - a.picks).slice(0, 10);
  }, [playerStats, heroBans]);

  if (heroStats.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Flame className="w-6 h-6 text-[#f97316]" />
        <h2 className="text-2xl font-bold text-[#0f172a]">Popular Heroes</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {heroStats.map((stat, index) => {
          const heroName = getHeroName(stat.hero_id);
          const heroImage = getHeroImage(stat.hero_id);
          
          return (
            <div
              key={stat.hero_id}
              className="flex items-center gap-4 p-4 bg-[#fdf5e9] rounded-xl border-2 border-[#0f172a]/10 hover:border-[#f97316] transition-all"
            >
              <div className="relative shrink-0">
                <img
                  src={heroImage}
                  alt={heroName}
                  className="w-24 h-14 rounded-lg border-2 border-[#0f172a]/10 object-cover"
                />
                <span className="absolute -top-2 -left-2 w-6 h-6 bg-[#f97316] text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[#0f172a]">{heroName}</h3>
                <p className="text-sm text-[#0f172a]/60">
                  {stat.picks} pick{stat.picks !== 1 ? 's' : ''}{stat.bans ? ` - ${stat.bans} ban${stat.bans !== 1 ? 's' : ''}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-[#f97316]">
                  {stat.winRate.toFixed(0)}%
                </p>
                <p className="text-xs text-[#0f172a]/60">
                  {stat.wins}-{stat.picks - stat.wins}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}