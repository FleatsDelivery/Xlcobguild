import { Pencil, Trophy, Swords, Skull } from '@/lib/icons';
import { TeamLogo } from '@/app/components/team-logo';
import { Button } from '@/app/components/ui/button';
import { formatDateWithTime } from '@/lib/date-utils';
import { getHeroName, getHeroImageUrl as getHeroImage, getHeroImageByName } from '@/lib/dota-heroes';

interface PlayerProfile {
  id: string;
  player_name: string;
  steam_id: string;
  account_id: number;
  avatar_url: string | null;
  dotabuff_url: string | null;
  opendota_url: string | null;
}

interface RosterEntry {
  id: string;
  team_id: string;
  player_profile_id: string;
  player: PlayerProfile;
}

interface PlayerStat {
  id: string;
  player_name: string;
  hero_id?: number;        // Optional: numeric hero ID
  hero?: string;           // Optional: hero name string (from kkup_player_match_stats)
  hero_name?: string;      // Optional: hero name (alternative field)
  kills: number;
  deaths: number;
  assists: number;
  team_id: string;
  is_winner?: boolean;
  net_worth?: number;
  steam_id?: string | null;
  account_id?: number | null;
  dotabuff_url?: string | null;
  opendota_url?: string | null;
  avatar_url?: string | null;
  player?: {
    avatar_url: string | null;
  };
}

interface Match {
  id: string;
  team1_id: string;
  team2_id: string;
  stage: string;
  status: string;
  team1: { id: string; name: string; tag: string; logo_url: string | null };
  team2: { id: string; name: string; tag: string; logo_url: string | null };
  winner: { id: string; name: string; tag: string; logo_url: string | null } | null;
  winner_team_id: string | null;
  team1_score: number;
  team2_score: number;
  scheduled_time: string;
  dotabuff_url: string | null;
  youtube_url: string | null;
  match_id: number | null;
  series_id: number | null;
  tournament_name?: string;  // For TeamLogo dynamic URL generation
}

interface MatchCardWithHeroesProps {
  match: Match;
  playerStats?: PlayerStat[];
  team1Roster?: RosterEntry[];
  team2Roster?: RosterEntry[];
  isOwner?: boolean;
  onEdit?: () => void;
}

export function MatchCardWithHeroes({ match, playerStats = [], team1Roster, team2Roster, isOwner, onEdit }: MatchCardWithHeroesProps) {
  // formatDate replaced by formatDateWithTime imported from @/lib/date-utils
  const formatDate = formatDateWithTime;

  // Separate player stats by team
  const team1Stats = playerStats.filter(s => s.team_id === match.team1_id);
  const team2Stats = playerStats.filter(s => s.team_id === match.team2_id);

  // Determine winner from match data
  const team1Won = match.winner_team_id === match.team1_id;
  const team2Won = match.winner_team_id === match.team2_id;

  // Score IS total kills (from match data, not calculated from player stats)
  const team1Score = match.team1_score; // This is total kills for team 1
  const team2Score = match.team2_score; // This is total kills for team 2

  // Helper: resolve hero display name from whichever field is populated
  const resolveHeroName = (stat: PlayerStat): string => {
    if (stat.hero) return stat.hero.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    if (stat.hero_name) return stat.hero_name;
    if (stat.hero_id) return getHeroName(stat.hero_id);
    return 'Unknown Hero';
  };

  // Helper: resolve hero portrait URL
  const resolveHeroImage = (stat: PlayerStat): string | null => {
    if (stat.hero) return getHeroImageByName(stat.hero) || null;
    if (stat.hero_id) return getHeroImage(stat.hero_id) || null;
    return null;
  };

  return (
    <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
      {/* Match Header */}
      <div className="bg-gradient-to-r from-soil to-[#1e293b] p-4 border-b-2 border-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-harvest text-white">
              {match.stage.replace(/_/g, ' ').toUpperCase()}
            </span>
            <span className="text-sm text-white/80 font-semibold">
              {formatDate(match.scheduled_time)}
            </span>
            {match.series_id && (
              <span className="text-xs text-white/60 font-mono">
                Series #{match.series_id}
              </span>
            )}
            {match.match_id && (
              <span className="text-xs text-white/50 font-mono hidden sm:inline">
                Match #{match.match_id}
              </span>
            )}
            {match.winner_team_id && (
              <span className="text-sm text-white/90 font-bold">
                • {team1Won ? 'Radiant' : 'Dire'} Victory
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {isOwner && onEdit && (
              <Button
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-2 border-white/20"
                onClick={onEdit}
              >
                <Pencil className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* VERSUS Layout - Desktop: Side by Side, Mobile: Stacked */}
      <div className="p-3 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-3">
          {/* Team 1 Section */}
          <div className={`space-y-4 ${team1Won ? 'order-1 lg:order-1' : 'order-3 lg:order-1'}`}>
            {/* Combined Team + Score Card */}
            <div className={`flex items-center justify-between p-3 sm:p-6 rounded-xl border-2 ${
              team1Won 
                ? 'bg-[#10b981]/5 border-[#10b981]/30' 
                : 'bg-[#ef4444]/5 border-[#ef4444]/30'
            }`}>
              {/* Left: Team Info */}
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <TeamLogo 
                  logoUrl={match.team1.logo_url} 
                  teamName={match.team1.name} 
                  teamTag={match.team1.tag}
                  size="lg" 
                  tournamentName={match.tournament_name}
                />
                <div className="min-w-0">
                  <h3 className={`text-lg sm:text-2xl font-bold truncate ${team1Won ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                    {match.team1.name}
                  </h3>
                  {team1Won && match.winner_team_id && (
                    <p className="text-xs font-bold uppercase tracking-widest text-[#10b981]">Victory</p>
                  )}
                  <p className="text-sm text-muted-foreground font-semibold">
                    {match.team1.tag && <span>{match.team1.tag} - </span>}
                    <span>Radiant</span>
                  </p>
                </div>
              </div>

              {/* Right: Score */}
              <div className="text-right flex-shrink-0">
                <p className={`text-3xl sm:text-6xl font-bold ${team1Won ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                  {team1Score}
                </p>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide mt-1">Score</p>
              </div>
            </div>

            {/* Player Roster with Heroes OR Team Roster */}
            {team1Stats.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Radiant Roster & Heroes</h4>
                {team1Stats.map((stat) => {
                  const heroName = resolveHeroName(stat);
                  const heroImage = resolveHeroImage(stat);
                  const avatarUrl = stat.avatar_url || stat.player?.avatar_url;
                  return (
                    <div
                      key={stat.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border-2 transition-all ${
                        team1Won 
                          ? 'bg-[#10b981]/5 border-[#10b981]/20 hover:border-[#10b981]/40' 
                          : 'bg-background border-border hover:border-harvest/30'
                      }`}
                    >
                      {/* Player Avatar → OpenDota */}
                      <a
                        href={stat.opendota_url || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={stat.opendota_url ? 'hover:opacity-80 transition-opacity flex-shrink-0' : 'flex-shrink-0 cursor-default'}
                        title={stat.opendota_url ? 'View on OpenDota' : undefined}
                      >
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={stat.player_name}
                            className="w-10 h-10 rounded-full border-2 border-border"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-harvest/20 flex items-center justify-center text-harvest font-bold border-2 border-border">
                            {stat.player_name ? stat.player_name.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}
                      </a>
                      
                      {/* Player Info */}
                      <div className="flex-1 min-w-0">
                        {/* Name → Dotabuff */}
                        <a
                          href={stat.dotabuff_url || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={`font-bold text-sm truncate block ${stat.dotabuff_url ? 'text-foreground hover:text-harvest transition-colors' : 'text-foreground cursor-default'}`}
                          title={stat.dotabuff_url ? 'View on Dotabuff' : undefined}
                        >
                          {stat.player_name}
                        </a>
                        {/* Hero with portrait */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {heroImage && (
                            <img src={heroImage} alt={heroName} className="w-4 h-4 rounded object-cover flex-shrink-0" />
                          )}
                          <p className="text-xs text-muted-foreground truncate">{heroName}</p>
                        </div>
                      </div>

                      {/* Net Worth */}
                      {stat.net_worth != null && (
                        <div className="text-right">
                          <p className="hidden sm:block text-xs font-bold text-harvest">
                            {stat.net_worth.toLocaleString()}
                          </p>
                          <p className="sm:hidden text-xs font-bold text-harvest">
                            {(stat.net_worth / 1000).toFixed(1)}k
                          </p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Gold</p>
                        </div>
                      )}

                      {/* KDA */}
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">
                          {stat.kills}/{stat.deaths}/{stat.assists}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">KDA</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : team1Roster && team1Roster.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Team Roster ({team1Roster.length})</h4>
                {team1Roster.map((rosterEntry) => (
                  <div
                    key={rosterEntry.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border-2 bg-background border-border hover:border-harvest/30 transition-all"
                  >
                    {/* Player Avatar */}
                    {rosterEntry.player.avatar_url ? (
                      <img
                        src={rosterEntry.player.avatar_url}
                        alt={rosterEntry.player.player_name}
                        className="w-10 h-10 rounded-full border-2 border-harvest/20"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-harvest/20 flex items-center justify-center text-harvest font-bold">
                        {rosterEntry.player.player_name ? rosterEntry.player.player_name.charAt(0).toUpperCase() : '?'}
                      </div>
                    )}
                    
                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm truncate">{rosterEntry.player.player_name}</p>
                      <p className="text-xs text-muted-foreground">Registered Player</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-background rounded-xl border-2 border-dashed border-border">
                <p className="text-sm text-muted-foreground">No roster data available</p>
              </div>
            )}
          </div>

          {/* VS Divider - Desktop Only */}
          <div className="hidden lg:flex flex-col items-center justify-center lg:order-2">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-harvest to-amber flex items-center justify-center shadow-lg">
                <Swords className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">VS</p>
              </div>
            </div>
          </div>

          {/* Mobile VS Divider */}
          <div className="lg:hidden flex items-center justify-center py-4 order-2">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-harvest to-amber text-white">
                <Swords className="w-4 h-4" />
                <span className="text-sm font-bold">VS</span>
              </div>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>

          {/* Team 2 Section */}
          <div className={`space-y-4 ${team2Won ? 'order-1 lg:order-3' : 'order-3 lg:order-3'}`}>
            {/* Combined Team + Score Card */}
            <div className={`flex items-center justify-between p-3 sm:p-6 rounded-xl border-2 ${
              team2Won 
                ? 'bg-[#10b981]/5 border-[#10b981]/30' 
                : 'bg-[#ef4444]/5 border-[#ef4444]/30'
            }`}>
              {/* Left: Team Info */}
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <TeamLogo 
                  logoUrl={match.team2.logo_url} 
                  teamName={match.team2.name}
                  teamTag={match.team2.tag}
                  size="lg" 
                  tournamentName={match.tournament_name}
                />
                <div className="min-w-0">
                  <h3 className={`text-lg sm:text-2xl font-bold truncate ${team2Won ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                    {match.team2.name}
                  </h3>
                  {team2Won && match.winner_team_id && (
                    <p className="text-xs font-bold uppercase tracking-widest text-[#10b981]">Victory</p>
                  )}
                  <p className="text-sm text-muted-foreground font-semibold">
                    {match.team2.tag && <span>{match.team2.tag} - </span>}
                    <span>Dire</span>
                  </p>
                </div>
              </div>

              {/* Right: Score */}
              <div className="text-right flex-shrink-0">
                <p className={`text-3xl sm:text-6xl font-bold ${team2Won ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                  {team2Score}
                </p>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide mt-1">Score</p>
              </div>
            </div>

            {/* Player Roster with Heroes OR Team Roster */}
            {team2Stats.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Dire Roster & Heroes</h4>
                {team2Stats.map((stat) => {
                  const heroName = resolveHeroName(stat);
                  const heroImage = resolveHeroImage(stat);
                  const avatarUrl = stat.avatar_url || stat.player?.avatar_url;
                  return (
                    <div
                      key={stat.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border-2 transition-all ${
                        team2Won 
                          ? 'bg-[#10b981]/5 border-[#10b981]/20 hover:border-[#10b981]/40' 
                          : 'bg-background border-border hover:border-harvest/30'
                      }`}
                    >
                      {/* Player Avatar → OpenDota */}
                      <a
                        href={stat.opendota_url || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={stat.opendota_url ? 'hover:opacity-80 transition-opacity flex-shrink-0' : 'flex-shrink-0 cursor-default'}
                        title={stat.opendota_url ? 'View on OpenDota' : undefined}
                      >
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={stat.player_name}
                            className="w-10 h-10 rounded-full border-2 border-border"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-harvest/20 flex items-center justify-center text-harvest font-bold border-2 border-border">
                            {stat.player_name ? stat.player_name.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}
                      </a>
                      
                      {/* Player Info */}
                      <div className="flex-1 min-w-0">
                        {/* Name → Dotabuff */}
                        <a
                          href={stat.dotabuff_url || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={`font-bold text-sm truncate block ${stat.dotabuff_url ? 'text-foreground hover:text-harvest transition-colors' : 'text-foreground cursor-default'}`}
                          title={stat.dotabuff_url ? 'View on Dotabuff' : undefined}
                        >
                          {stat.player_name}
                        </a>
                        {/* Hero with portrait */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {heroImage && (
                            <img src={heroImage} alt={heroName} className="w-4 h-4 rounded object-cover flex-shrink-0" />
                          )}
                          <p className="text-xs text-muted-foreground truncate">{heroName}</p>
                        </div>
                      </div>

                      {/* Net Worth */}
                      {stat.net_worth != null && (
                        <div className="text-right">
                          <p className="hidden sm:block text-xs font-bold text-harvest">
                            {stat.net_worth.toLocaleString()}
                          </p>
                          <p className="sm:hidden text-xs font-bold text-harvest">
                            {(stat.net_worth / 1000).toFixed(1)}k
                          </p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Gold</p>
                        </div>
                      )}

                      {/* KDA */}
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">
                          {stat.kills}/{stat.deaths}/{stat.assists}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">KDA</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : team2Roster && team2Roster.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Team Roster ({team2Roster.length})</h4>
                {team2Roster.map((rosterEntry) => (
                  <div
                    key={rosterEntry.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border-2 bg-background border-border hover:border-harvest/30 transition-all"
                  >
                    {/* Player Avatar */}
                    {rosterEntry.player.avatar_url ? (
                      <img
                        src={rosterEntry.player.avatar_url}
                        alt={rosterEntry.player.player_name}
                        className="w-10 h-10 rounded-full border-2 border-harvest/20"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-harvest/20 flex items-center justify-center text-harvest font-bold">
                        {rosterEntry.player.player_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    
                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm truncate">{rosterEntry.player.player_name}</p>
                      <p className="text-xs text-muted-foreground">Registered Player</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-background rounded-xl border-2 border-dashed border-border">
                <p className="text-sm text-muted-foreground">No roster data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
