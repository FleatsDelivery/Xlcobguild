import React, { useState, useEffect } from 'react';
import { getTeamLogoUrl, getTournamentTeamLogoUrl } from '@/lib/tournament-assets';

interface TeamLogoProps {
  logoUrl?: string | null;
  teamName?: string;
  teamTag?: string;
  tournamentName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function TeamLogo({ logoUrl, teamName, teamTag, tournamentName, size = 'md', className = '' }: TeamLogoProps) {
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

  if (!currentUrl) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-md ${className}`}
        title={`${effectiveTeamName} (No logo)`}
      >
        <span className="leading-none">🌽</span>
      </div>
    );
  }

  return (
    <img
      key={currentUrl}
      src={currentUrl}
      alt={`${effectiveTeamName} logo`}
      className={`${sizeClasses[size]} rounded-lg object-cover shadow-md ${className}`}
      onError={handleError}
    />
  );
}
