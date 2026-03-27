/**
 * Tournament Prizes Tab - Phase-Agnostic
 * 
 * Shows prize pool and distribution
 */

import { useState } from 'react';
import { Trophy, DollarSign } from 'lucide-react';
import { useTournament } from '@/app/contexts/tournament-context';
import { Footer } from '@/app/components/footer';
import { Button } from '@/app/components/ui/button';
import { Pencil } from '@/lib/icons';
import { EditPrizesModal } from '@/app/components/modals/edit-prizes-modal';

export function TournamentPrizesTab() {
  const { tournament, isOwner } = useTournament();
  const [showEditModal, setShowEditModal] = useState(false);

  if (!tournament) return null;


  const prizePoolStr = tournament.prize_pool?.toString() || '0';
  const basePool = parseFloat(prizePoolStr.replace(/[^0-9.]/g, '') || '0');
  const donations = tournament.prize_pool_donations || 0;
  const totalPool = basePool + donations;
  
  const displayPrizePoolStr = prizePoolStr.startsWith('$') ? prizePoolStr : `$${prizePoolStr}`;
  const displayTotalStr = `$${totalPool.toFixed(0)}`; // simplified for display
  
  const prizes = tournament.prizes || [];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Prize Pool Card */}
      <div className="bg-card rounded-2xl border-2 border-border p-6 sm:p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-harvest/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Trophy className="w-6 h-6 text-harvest" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">Prize Pool</h2>
              {isOwner && (
                <Button
                  onClick={() => setShowEditModal(true)}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1.5 border-harvest/50 text-harvest hover:bg-harvest/10 rounded-lg flex-shrink-0 ml-2"
                >
                  <Pencil className="w-4 h-4" />
                  <span className="hidden sm:inline">Edit Prizes</span>
                </Button>
              )}
            </div>
            <div className="text-4xl font-bold text-harvest mb-2">
              {donations > 0 ? displayTotalStr : displayPrizePoolStr}
            </div>
            {donations > 0 && (
              <p className="text-sm text-muted-foreground">
                Base ({displayPrizePoolStr}) + Community (${donations.toFixed(2)})
              </p>
            )}
          </div>
        </div>

        {/* Prize Distribution */}
        <div className="bg-muted rounded-xl p-6">
          <h3 className="font-bold text-foreground mb-4">Prize Distribution</h3>
          <div className="space-y-3">
            {prizes.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Prize distribution has not been configured yet.</p>
            ) : (
              prizes.map((prize, idx) => {
                const getMedalIcon = (index: number) => {
                  if (index === 0) return '🥇';
                  if (index === 1) return '🥈';
                  if (index === 2) return '🥉';
                  return '🎖️';
                };

                const expectedPayout = prize.value_type === 'bragging_rights'
                  ? 'Priceless'
                  : prize.value_type === 'percentage' 
                    ? `$${(totalPool * (Number(prize.value || 0) / 100)).toFixed(2)}`
                    : `$${Number(prize.value || 0).toFixed(2)}`;
                
                const valueLabel = prize.value_type === 'bragging_rights'
                  ? '🏆 Bragging Rights'
                  : prize.value_type === 'percentage'
                    ? `${prize.value}%`
                    : `$${prize.value}`;

                const awardsForPrize = tournament.awards?.filter(a => a.prize_id === prize.id) || [];
                const showWinners = ['completed', 'archived'].includes(tournament.status);

                return (
                  <div key={prize.id || idx} className="flex flex-col p-3 bg-card border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground flex items-center gap-2">
                        <span className="text-lg">{getMedalIcon(idx)}</span> {prize.title}
                      </span>
                      <div className="text-right">
                        <div className="text-sm font-bold text-harvest">{expectedPayout}</div>
                        <div className="text-xs text-muted-foreground">{valueLabel}</div>
                      </div>
                    </div>

                    {showWinners && awardsForPrize.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Awarded To:</div>
                        {awardsForPrize.map(award => (
                          <div key={award.id} className="flex items-center gap-3 bg-muted/30 p-2 rounded-lg border border-border/50">
                            {award.team ? (
                              <>
                                <img src={award.team.logo_url || '/images/default-team.png'} className="w-6 h-6 rounded-md object-cover" alt="" />
                                <span className="text-sm font-bold text-foreground">{award.team.team_name}</span>
                              </>
                            ) : award.recipient ? (
                              <>
                                <img src={award.recipient.discord_avatar || '/images/default-avatar.png'} className="w-6 h-6 rounded-full object-cover" alt="" />
                                <span className="text-sm font-bold text-foreground">{award.recipient.discord_username}</span>
                              </>
                            ) : <span className="text-sm text-muted-foreground italic">Unknown Winner</span>}
                            
                            {award.amount_cents > 0 && (
                              <span className="ml-auto text-xs font-bold text-harvest bg-harvest/10 px-2 py-0.5 rounded-full">
                                ${(award.amount_cents / 100).toFixed(2)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
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

      {showEditModal && (
        <EditPrizesModal onClose={() => setShowEditModal(false)} />
      )}
    </div>
  );
}
