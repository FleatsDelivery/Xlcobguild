/**
 * NewTournamentCard -- Banner-Based Design
 * 
 * Displays tournament banner with tournament info overlay.
 * Used for Season 3+ "New Tournaments" section.
 */

import { useState } from 'react';
import { getPhaseConfig } from './tournament-state-config';
import { Calendar, Users, Trophy } from 'lucide-react';
import { getTournamentBanner } from '@/lib/tournament-assets';
import { formatDateShort } from '@/lib/date-utils';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface NewTournamentCardProps {
  tournament: {
    id: string;
    name: string;
    status: string;
    start_date?: string;
    end_date?: string;
    registration_start_date?: string;
    registration_end_date?: string;
    tournament_start_date?: string;
    tournament_end_date?: string;
    registration_count?: number;
    team_count?: number;
    teams_count?: number;
    max_teams?: number;
    prize_pool?: number | string | null;
    prize_pool_cents?: number;
  };
  onClick: () => void;
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export function NewTournamentCard({ tournament, onClick }: NewTournamentCardProps) {
  const phaseConfig = getPhaseConfig(tournament.status as any);
  const [imageError, setImageError] = useState(false);

  // Get standardized tournament banner
  const bannerUrl = getTournamentBanner(tournament.name);

  // Format dates - use tournament start date for display
  const startDate = tournament.tournament_start_date || tournament.start_date;
  const dateDisplay = startDate ? formatDateShort(startDate) : 'TBA';

  // Prize pool display
  let prizeDisplay = 'TBA';
  if (tournament.prize_pool_cents) {
    prizeDisplay = `$${(tournament.prize_pool_cents / 100).toFixed(0)}`;
  } else if (tournament.prize_pool) {
    prizeDisplay = `$${tournament.prize_pool}`;
  }

  // Team count
  const teamCount = tournament.team_count || tournament.teams_count || 0;
  const maxTeams = tournament.max_teams;

  return (
    <div
      onClick={onClick}
      className="group relative bg-card rounded-2xl border-2 border-border hover:border-harvest/50 transition-all cursor-pointer overflow-hidden"
    >
      {/* Phase Badge - Top Left */}
      <div className={`absolute top-3 left-3 z-10 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${phaseConfig.statusPillBg} ${phaseConfig.statusPillText} shadow-lg`}>
        {phaseConfig.pingDot && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
          </span>
        )}
        {phaseConfig.icon} {phaseConfig.label}
      </div>

      {/* League Banner - Wide aspect ratio (5:1) */}
      <div className="aspect-[5/1] w-full bg-muted relative overflow-hidden">
        {!imageError ? (
          <img
            src={bannerUrl}
            alt={`${tournament.name} banner`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-harvest/10">
            <span className="text-4xl font-black text-harvest/30">
              {tournament.name}
            </span>
          </div>
        )}
        
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-soil/80 via-soil/20 to-transparent"></div>
        
        {/* Tournament Name - Overlaid on banner */}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-lg sm:text-xl font-black text-silk drop-shadow-lg">
            {tournament.name}
          </h3>
        </div>
      </div>

      {/* Info Bar */}
      <div className="p-4 space-y-3">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {/* Date */}
          <div>
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Calendar className="w-3 h-3" />
            </div>
            <div className="text-xs font-semibold text-foreground">{dateDisplay}</div>
          </div>

          {/* Teams */}
          <div>
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Users className="w-3 h-3" />
            </div>
            <div className="text-xs font-semibold text-foreground">
              {maxTeams ? `${teamCount}/${maxTeams}` : teamCount}
            </div>
          </div>

          {/* Prize */}
          <div>
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Trophy className="w-3 h-3" />
            </div>
            <div className="text-xs font-semibold text-harvest">{prizeDisplay}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
