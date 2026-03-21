/**
 * TournamentCard -- Visual-First Design
 * 
 * Displays tournament league icon with minimal stats and winner badge.
 * Used on the Kernel Kup landing page.
 */

import { useState } from 'react';
import { getPhaseConfig } from './tournament-state-config';
import { Calendar, Crown, Users } from 'lucide-react';
import { getTournamentLargeIcon } from '@/lib/tournament-assets';
import { formatDateShort } from '@/lib/date-utils';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface TournamentCardProps {
  tournament: {
    id: string;
    name: string;
    status: string;
    start_date?: string;
    end_date?: string;
    registration_count?: number;
    team_count?: number;
    teams_count?: number;
    max_teams?: number;
    prize_pool_cents?: number;
    winner?: {
      team_name: string;
      team_tag: string;
      logo_url?: string;
    };
    // Legacy fields (backwards compatible)
    winner_team_name?: string;
    winner_team_tag?: string;
    // POPD Kernel MVP winners
    popd_kernel_1_name?: string;
    popd_kernel_2_name?: string;
  };
  onClick: () => void;
}

// ═════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export function TournamentCard({ tournament, onClick }: TournamentCardProps) {
  const phaseConfig = getPhaseConfig(tournament.status as any);
  const [imageError, setImageError] = useState(false);

  // Get standardized tournament large icon
  const leagueIconUrl = getTournamentLargeIcon(tournament.name);

  // Format dates
  const dateDisplay = tournament.start_date 
    ? formatDateShort(tournament.start_date)
    : 'TBA';

  // Prize pool display
  const prizeDisplay = tournament.prize_pool_cents
    ? `$${(tournament.prize_pool_cents / 100).toFixed(0)}`
    : 'TBA';

  // Has winner? Show for both completed and archived tournaments
  const hasWinner = tournament.winner?.team_name && (tournament.status === 'completed' || tournament.status === 'archived');

  // POPD Kernel MVP winner(s) display
  const popdKernelDisplay = tournament.popd_kernel_1_name
    ? tournament.popd_kernel_2_name
      ? `${tournament.popd_kernel_1_name} & ${tournament.popd_kernel_2_name}`
      : tournament.popd_kernel_1_name
    : null;

  return (
    <div
      onClick={onClick}
      className="group relative bg-card rounded-2xl border-2 border-border hover:border-harvest/50 transition-all cursor-pointer overflow-hidden"
    >
      {/* Winner Badge - Top Right with glow */}
      {hasWinner && (
        <div className="absolute top-3 right-3 z-10 bg-kernel-gold text-soil px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg animate-pulse-slow">
          <Crown className="w-4 h-4" />
          <span className="font-bold text-xs">{tournament.winner?.team_tag || tournament.winner?.team_name}</span>
        </div>
      )}

      {/* Phase Badge - Top Left */}
      <div className={`absolute top-3 left-3 z-10 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${phaseConfig.statusPillBg} ${phaseConfig.statusPillText}`}>
        {phaseConfig.pingDot && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
          </span>
        )}
        {phaseConfig.icon} {phaseConfig.label}
      </div>

      {/* League Icon - Rectangular aspect ratio (3:2) */}
      <div className="aspect-[3/2] w-full bg-muted relative overflow-hidden">
        {!imageError ? (
          <img
            src={leagueIconUrl}
            alt={`${tournament.name} icon`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-harvest/10">
            <span className="text-6xl font-black text-harvest/30">
              {tournament.name.match(/\d+/)?.[0] || '?'}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Info Bar */}
      <div className="p-4 space-y-3">
        {/* Tournament Title */}
        <h3 className="text-lg font-bold text-foreground truncate">
          {tournament.name}
        </h3>
        
        {/* Date & Champion */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span className="font-semibold">{dateDisplay}</span>
          </div>
          {hasWinner && tournament.winner?.team_tag ? (
            <div className="flex items-center gap-1.5 text-kernel-gold font-bold">
              <Crown className="w-4 h-4" />
              <span className="truncate max-w-[120px]">{tournament.winner.team_tag}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
              <Crown className="w-4 h-4" />
              <span>TBA</span>
            </div>
          )}
        </div>

        {/* Team Count & POPD Kernel MVP */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span className="font-semibold">{tournament.team_count || 8} Teams</span>
          </div>
          {popdKernelDisplay ? (
            <div className="flex items-center gap-1 text-[#dc2626] font-bold" title="Pop'd Kernel MVP">
              <span className="text-sm">🍿</span>
              <span className="truncate max-w-[120px]">{popdKernelDisplay}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground font-semibold">
              <span className="text-sm">🍿</span>
              <span>TBA</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}