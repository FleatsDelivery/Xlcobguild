/**
 * Tournament Prizes Tab - Phase-Agnostic
 * 
 * Shows prize pool and distribution
 */

import { Trophy, DollarSign, Users } from 'lucide-react';
import { useTournament } from '@/app/contexts/tournament-context';
import { Footer } from '@/app/components/footer';

export function TournamentPrizesTab() {
  const { tournament } = useTournament();

  if (!tournament) return null;

  const prizePool = tournament.prize_pool || '$0';
  const donations = tournament.prize_pool_donations || 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Prize Pool Card */}
      <div className="bg-card rounded-2xl border-2 border-border p-6 sm:p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-harvest/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Trophy className="w-6 h-6 text-harvest" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground mb-2">Prize Pool</h2>
            <div className="text-4xl font-black text-harvest mb-2">{prizePool}</div>
            {donations > 0 && (
              <p className="text-sm text-muted-foreground">
                Includes ${donations.toFixed(2)} from community donations
              </p>
            )}
          </div>
        </div>

        {/* Prize Distribution (Placeholder) */}
        <div className="bg-muted rounded-xl p-6">
          <h3 className="font-bold text-foreground mb-4">Prize Distribution</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">🥇 1st Place</span>
              <span className="text-sm font-bold text-foreground">50%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">🥈 2nd Place</span>
              <span className="text-sm font-bold text-foreground">30%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">🥉 3rd Place</span>
              <span className="text-sm font-bold text-foreground">20%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Donation Info (if applicable) */}
      {donations > 0 && (
        <div className="bg-card rounded-2xl border-2 border-border p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#10b981]/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-6 h-6 text-[#10b981]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground mb-2">Community Supported</h3>
              <p className="text-muted-foreground">
                This prize pool was boosted by generous donations from The Corn Field community. 
                Thank you to everyone who contributed!
              </p>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}