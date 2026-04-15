import React, { useState, useEffect } from 'react';
import { getTeamLogoUrl, getTournamentTeamLogoUrl } from '@/lib/tournament-assets';
import { getRankBadgeUrl, rankTierToDisplay } from '@/lib/rank-utils';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';

interface TeamLogoProps {
  logoUrl?: string | null;
  teamName?: string;
  teamTag?: string;
  tournamentName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  seed?: number | null;
  rankTier?: number | null;
}

export function TeamLogo({ 
  logoUrl, teamName, teamTag, tournamentName, size = 'md', className = '',
  seed, rankTier
}: TeamLogoProps) {
  const [urlIndex, setUrlIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  const sizeClasses = {
    sm: 'w-12 h-8 text-lg',
    md: 'w-16 h-11 text-2xl',
    lg: 'w-20 h-14 text-3xl',
    xl: 'w-32 h-22 text-5xl',
  };

  const effectiveTeamName = teamName || teamTag || 'Team';

  // Build ordered fallback queue for this team
  const buildQueue = (): string[] => {
    const queue: string[] = [];
    if (!teamTag) {
      // No tag — only thing we can try is the DB URL
      if (logoUrl) queue.push(logoUrl);
      return queue;
    }

    // 1. Master team_logos folder (png then jpg) — always first
    queue.push(getTeamLogoUrl(teamTag, 'png'));
    queue.push(getTeamLogoUrl(teamTag, 'jpg'));

    // 2. Tournament-specific folder (png then jpg) — if we know the tournament
    if (tournamentName) {
      queue.push(getTournamentTeamLogoUrl(tournamentName, teamTag, 'png'));
      queue.push(getTournamentTeamLogoUrl(tournamentName, teamTag, 'jpg'));
    }

    // 3. DB logo_url as last resort (may be stale or wrong)
    if (logoUrl) queue.push(logoUrl);

    return queue;
  };

  // Rebuild queue when key props change, reset index
  const [queue] = useState<string[]>(() => buildQueue());

  // When we run out of URLs to try, show the fallback corn
  const currentUrl = !exhausted && queue.length > 0 ? queue[urlIndex] : null;

  const handleError = () => {
    const next = urlIndex + 1;
    if (next < queue.length) {
      setUrlIndex(next);
    } else {
      setExhausted(true);
    }
  };

  const rankDisplay = rankTier ? rankTierToDisplay(rankTier) : null;
  const rankUrl = rankDisplay ? getRankBadgeUrl(rankDisplay.medal, rankDisplay.stars) : null;

  return (
    <div className="relative group/logo inline-block">
      {!currentUrl ? (
        <div
          className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-md ${className}`}
          title={`${effectiveTeamName} (No logo)`}
        >
          <span className="leading-none">🌽</span>
        </div>
      ) : (
        <img
          key={currentUrl}
          src={currentUrl}
          alt={`${effectiveTeamName} logo`}
          crossOrigin="anonymous"
          className={`${sizeClasses[size]} rounded-lg object-cover shadow-md ${className}`}
          onError={handleError}
        />
      )}

      {/* Seed Badge (Bottom-Left) */}
      {seed && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute -bottom-1 -left-1 px-1 min-w-[14px] h-3.5 bg-black/80 border border-border/50 rounded-sm flex items-center justify-center shadow-lg z-10 cursor-help">
              <span className="text-[8px] font-black text-white leading-none">#{seed}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" align="start" className="bg- soil border-harvest/30">
            Tournament Seed #{seed}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Rank Badge (Bottom-Right) */}
      {rankUrl && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute -bottom-1.5 -right-1 w-5 h-5 drop-shadow-lg z-10 transition-transform hover:scale-125 cursor-help">
              <img src={rankUrl} alt="Rank Badge" className="w-full h-full drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" align="end" className="bg-soil border-harvest/30">
            Team Rank: {rankDisplay?.medal} {rankDisplay?.stars > 0 ? rankDisplay?.stars : ''}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
