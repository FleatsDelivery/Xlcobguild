import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { Loader2, Crown, Plus, Trash2, AlertTriangle, Save, Gift, Trophy, ArrowRight, Shield, Users } from '@/lib/icons';
import { projectId } from '/utils/supabase/info';
import { toast } from 'sonner';
import { useTournament, Prize, Award } from '@/app/contexts/tournament-context';

interface EditPrizesModalProps {
  onClose: () => void;
}


export function EditPrizesModal({ onClose }: EditPrizesModalProps) {
  const { tournament, accessToken, refetch } = useTournament();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tournament-level prize pool logic
  const [prizePool, setPrizePool] = useState(tournament?.prize_pool?.toString() || '');
  const [prizeDonations, setPrizeDonations] = useState(tournament?.prize_pool_donations?.toString() || '0');

  // Prize array logic
  const [prizes, setPrizes] = useState<Partial<Prize>[]>(
    (tournament?.prizes || []).map(p => ({ ...p }))
  );
  
  // Awarding logic state
  const [activeTab, setActiveTab] = useState<'config' | 'awards'>('config');
  const [teams, setTeams] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  
  const [awardPrizeId, setAwardPrizeId] = useState('');
  const [awardType, setAwardType] = useState<'team' | 'player'>('team');
  const [awardRecipientId, setAwardRecipientId] = useState('');
  const [awardAmount, setAwardAmount] = useState('');
  const [awarding, setAwarding] = useState(false);

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };

  if (!tournament) return null;

  useEffect(() => {
    // Fetch Teams and Players for awarding dropdowns
    const fetchRecipients = async () => {
      try {
        const [teamsRes, playersRes] = await Promise.all([
          fetch(`${apiBase}/kkup/tournaments/${tournament.id}/teams`, { headers: authHeaders }),
          fetch(`${apiBase}/kkup/tournaments/${tournament.id}/registrations`, { headers: authHeaders })
        ]);
        
        if (teamsRes.ok) {
          const { teams: t } = await teamsRes.json();
          setTeams(t || []);
        }
        if (playersRes.ok) {
          const { registrations: r } = await playersRes.json();
          setPlayers(r?.filter((reg: any) => reg.status !== 'withdrawn') || []);
        }
      } catch (err) {
        console.error('Failed to fetch recipients', err);
      }
    };
    fetchRecipients();
  }, [tournament.id, apiBase, accessToken]);

  const handleAddPrize = () => {
    setPrizes([...prizes, { title: '', value_type: 'percentage', value: 0, sort_order: prizes.length + 1 }]);
  };

  const handleRemovePrize = (index: number) => {
    const newPrizes = [...prizes];
    newPrizes.splice(index, 1);
    // Fix sort order
    newPrizes.forEach((p, i) => { p.sort_order = i + 1; });
    setPrizes(newPrizes);
  };

  const updatePrize = (index: number, field: keyof Prize, val: any) => {
    const newPrizes = [...prizes];
    newPrizes[index] = { ...newPrizes[index], [field]: val };
    setPrizes(newPrizes);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setError(null);

    try {
      // 1. Update basic tournament prize pool config
      const configRes = await fetch(`${apiBase}/kkup/tournaments/${tournament.id}/config`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          prize_pool: prizePool || null,
          prize_pool_donations: prizeDonations ? parseFloat(prizeDonations) : 0,
        }),
      });
      
      if (!configRes.ok) {
        const data = await configRes.json();
        throw new Error(data.error || 'Failed to update prize pool config');
      }

      // 2. Synchronize prizes. For simplicity in UI, we delete all existing and recreate them or update one by one.
      // Easiest is to do parallel saves for new/updated prizes, but there's a risk of orphan prizes if they were deleted.
      // To handle deletes: just fetch existing prizes, compare and send DELETE requests for removed ones.
      const existingPrizeIds = (tournament.prizes || []).map(p => p.id);
      const currentPrizeIds = prizes.filter(p => p.id).map(p => p.id);
      
      const toDelete = existingPrizeIds.filter(id => !currentPrizeIds.includes(id));

      await Promise.all(toDelete.map(id => 
        fetch(`${apiBase}/kkup/tournaments/${tournament.id}/prizes/${id}`, {
          method: 'DELETE',
          headers: authHeaders,
        })
      ));

      // Process saves (create or update)
      for (const prize of prizes) {
        if (!prize.title) continue; // skip invalid empty ones
        
        if (prize.id) {
          // Update
          await fetch(`${apiBase}/kkup/tournaments/${tournament.id}/prizes/${prize.id}`, {
            method: 'PATCH',
            headers: authHeaders,
            body: JSON.stringify({
              title: prize.title,
              value_type: prize.value_type,
              value: prize.value,
              sort_order: prize.sort_order,
            }),
          });
        } else {
          // Create
          await fetch(`${apiBase}/kkup/tournaments/${tournament.id}/prizes`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              title: prize.title,
              value_type: prize.value_type,
              value: prize.value,
              sort_order: prize.sort_order,
            }),
          });
        }
      }

      toast.success('Prizes updated successfully');
      await refetch();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save prizes');
    } finally {
      setSaving(false);
    }
  };

  const handleAwardPrize = async () => {
    if (!awardPrizeId || !awardRecipientId) {
      toast.error('Please select a prize and a recipient');
      return;
    }

    setAwarding(true);
    try {
      const payload: any = {
        amount_cents: Math.round(parseFloat(awardAmount || '0') * 100),
      };
      
      if (awardType === 'team') {
        payload.team_id = awardRecipientId;
      } else {
        payload.recipient_user_id = awardRecipientId;
      }

      const res = await fetch(`${apiBase}/kkup/tournaments/${tournament.id}/prizes/${awardPrizeId}/award`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to award prize');

      toast.success('Prize awarded successfully!');
      setAwardRecipientId('');
      setAwardAmount('');
      await refetch();
    } catch (err: any) {
      toast.error(err.message || 'Error awarding prize');
    } finally {
      setAwarding(false);
    }
  };

  const handleDeleteAward = async (awardId: string) => {
    if (!confirm('Are you sure you want to revoke this award?')) return;
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournament.id}/awards/${awardId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke award');

      toast.success('Award revoked successfully');
      await refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke award');
    }
  };

  const poolTotal = (parseFloat(prizePool.replace(/[^0-9.]/g, '') || '0') + parseFloat(prizeDonations || '0'));

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-3xl" zIndex="z-50">
      <BottomSheetModal.Header gradient="from-harvest/10 to-harvest/5" borderColor="border-harvest/20">
        <div className="flex items-center gap-3">
          <Gift className="w-6 h-6 text-harvest" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Manage Tournament Prizes</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Define prize pool, distributions, and award winners</p>
          </div>
        </div>
      </BottomSheetModal.Header>

      <BottomSheetModal.Body className="space-y-6">
        <div className="flex bg-muted/50 p-1 rounded-xl w-full sm:w-min">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'config'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Configuration
          </button>
          <button
            onClick={() => setActiveTab('awards')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'awards'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Award Winners
          </button>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/30 rounded-xl p-3 text-error text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {activeTab === 'config' ? (
          <div className="bg-muted rounded-xl p-5 border-2 border-border shadow-sm space-y-6">
            {/* Total Prize Pool Overview */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-harvest" />
                <h3 className="text-base font-bold text-foreground justify-between uppercase tracking-wider">Prize Pool Config</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Base Prize Pool</Label>
                  <Input
                    value={prizePool}
                    onChange={(e) => setPrizePool(e.target.value)}
                    placeholder="e.g. 500 or $500"
                    className="bg-input-background border-border text-foreground"
                  />
                  <p className="text-[10px] text-muted-foreground">The guaranteed prize amount</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Community Donations</Label>
                  <Input
                    type="number"
                    value={prizeDonations}
                    onChange={(e) => setPrizeDonations(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="bg-input-background border-border text-foreground"
                  />
                  <p className="text-[10px] text-muted-foreground">Additional community-funded pool</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Total Calculable Pool:</span>
                <span className="text-xl font-bold text-harvest">${poolTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Divider between sections */}
            <div className="border-t border-border/60" />

            {/* Prize Tiers */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-harvest" />
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Prize Distribution Tiers</h3>
                </div>
                <Button
                  type="button"
                  onClick={handleAddPrize}
                  size="sm"
                  className="bg-harvest/10 hover:bg-harvest/20 text-harvest font-bold rounded-lg h-8"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Tier
                </Button>
              </div>

              <div className="space-y-3">
                {prizes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-xl">
                    No prize distribution configured yet.
                  </div>
                ) : (
                  prizes.map((prize, idx) => {
                    const calculatedPreview = prize.value_type === 'percentage' 
                      ? (poolTotal * (Number(prize.value || 0) / 100)).toFixed(2)
                      : Number(prize.value || 0).toFixed(2);
                    
                    return (
                      <div key={idx} className="bg-background rounded-xl border border-border p-4 flex flex-col sm:flex-row gap-3 relative group">
                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-12 sm:col-span-4 space-y-1">
                              <Label className="text-xs text-muted-foreground">Title</Label>
                              <Input
                                value={prize.title}
                                onChange={(e) => updatePrize(idx, 'title', e.target.value)}
                                placeholder="e.g. 1st Place"
                                className="h-9 text-sm bg-input-background border-border"
                              />
                            </div>
                            <div className="col-span-6 sm:col-span-3 space-y-1">
                              <Label className="text-xs text-muted-foreground">Type</Label>
                              <select
                                value={prize.value_type}
                                onChange={(e) => updatePrize(idx, 'value_type', e.target.value)}
                                className="w-full h-9 rounded-lg border border-border bg-input-background px-3 py-1 text-sm focus:outline-none focus:border-harvest/50"
                              >
                                <option value="percentage">% of Pool</option>
                                <option value="fixed">Fixed Value ($)</option>
                                <option value="bragging_rights">Bragging Rights</option>
                              </select>
                            </div>
                            <div className="col-span-6 sm:col-span-3 space-y-1">
                              <Label className="text-xs text-muted-foreground">Value</Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  value={prize.value_type === 'bragging_rights' ? 0 : prize.value}
                                  onChange={(e) => updatePrize(idx, 'value', parseFloat(e.target.value))}
                                  disabled={prize.value_type === 'bragging_rights'}
                                  className="h-9 text-sm pl-8 bg-input-background border-border disabled:opacity-50"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                                  {prize.value_type === 'percentage' ? '%' : prize.value_type === 'bragging_rights' ? '🏆' : '$'}
                                </span>
                              </div>
                            </div>
                            <div className="col-span-12 sm:col-span-2 flex items-end justify-end">
                              <Button
                                type="button"
                                onClick={() => handleRemovePrize(idx)}
                                variant="ghost"
                                size="sm"
                                className="h-9 text-muted-foreground hover:text-error hover:bg-error/10 w-full sm:w-auto px-2"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-xs bg-muted/50 rounded-lg py-1.5 px-3">
                            <span className="text-muted-foreground font-medium">Estimated Value:</span>
                            <span className="font-bold text-foreground">
                              {prize.value_type === 'bragging_rights' ? 'Priceless' : `$${calculatedPreview}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                
                {prizes.length > 0 && (
                  <div className="flex justify-between items-center p-3 mt-2 bg-harvest/5 rounded-xl border border-harvest/20">
                    <span className="text-sm font-medium text-foreground">Total Percentage Allocated</span>
                    <span className={`text-sm font-bold ${
                      prizes.reduce((sum, p) => sum + (p.value_type === 'percentage' ? (p.value || 0) : 0), 0) > 100 
                      ? 'text-error' 
                      : 'text-harvest'
                    }`}>
                      {prizes.reduce((sum, p) => sum + (p.value_type === 'percentage' ? (p.value || 0) : 0), 0)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Award New Prize */}
            <div className="bg-card rounded-xl p-5 border-2 border-border">
              <h3 className="text-sm font-bold text-foreground mb-4">Grant an Award</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Select Prize Tier</Label>
                    <select
                      value={awardPrizeId}
                      onChange={(e) => setAwardPrizeId(e.target.value)}
                      className="w-full h-10 rounded-xl border-2 border-border bg-input-background px-3 text-sm focus:outline-none focus:border-harvest/50 text-foreground"
                    >
                      <option value="">-- Choose a Prize --</option>
                      {(tournament.prizes || []).map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Final Payout Amount ($)</Label>
                    <Input
                      type="number"
                      value={awardAmount}
                      onChange={(e) => setAwardAmount(e.target.value)}
                      placeholder="e.g. 150.00"
                      className="bg-input-background border-border text-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Recipient Type</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setAwardType('team'); setAwardRecipientId(''); }}
                      className={`flex-1 ${awardType === 'team' ? 'border-harvest text-harvest bg-harvest/10' : 'text-muted-foreground border-border'}`}
                    >
                      <Shield className="w-4 h-4 mr-2" /> Team
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setAwardType('player'); setAwardRecipientId(''); }}
                      className={`flex-1 ${awardType === 'player' ? 'border-harvest text-harvest bg-harvest/10' : 'text-muted-foreground border-border'}`}
                    >
                      <Users className="w-4 h-4 mr-2" /> Player
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Select Recipient</Label>
                  <select
                    value={awardRecipientId}
                    onChange={(e) => setAwardRecipientId(e.target.value)}
                    className="w-full h-10 rounded-xl border-2 border-border bg-input-background px-3 text-sm focus:outline-none focus:border-harvest/50 text-foreground"
                  >
                    <option value="">-- Choose {awardType === 'team' ? 'Team' : 'Player'} --</option>
                    {awardType === 'team'
                      ? teams.map((team: any) => (
                          <option key={team.id} value={team.id}>{team.team_name} {team.team_tag ? `[${team.team_tag}]` : ''}</option>
                        ))
                      : players.map((player: any) => (
                          <option key={player.person_id || player.user_id || player.id} value={player.user_id || player.id}>{player.player_name || player.person?.display_name || 'Unknown'}</option>
                        ))}
                  </select>
                </div>

                <Button
                  onClick={handleAwardPrize}
                  disabled={awarding || !awardPrizeId || !awardRecipientId}
                  className="w-full bg-harvest text-white font-bold rounded-xl"
                >
                  {awarding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Gift className="w-4 h-4 mr-2" />}
                  Issue Award
                </Button>
              </div>
            </div>

            {/* Existing Awards List */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground mb-2">Issued Awards</h3>
              {(!tournament.awards || tournament.awards.length === 0) ? (
                <div className="text-center py-6 text-muted-foreground border-2 border-dashed border-border rounded-xl">
                  No prizes have been awarded yet.
                </div>
              ) : (
                tournament.awards.map((award: Award) => {
                  const prize = (tournament.prizes || []).find(p => p.id === award.prize_id);
                  const isTeam = !!award.team_id;
                  return (
                    <div key={award.id} className="flex items-center justify-between p-3 bg-muted/50 border border-border rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-background rounded-lg flex flex-shrink-0 items-center justify-center border border-border">
                          {isTeam ? <Shield className="w-5 h-5 text-harvest" /> : <Users className="w-5 h-5 text-harvest" />}
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{prize?.title || 'Unknown Prize'}</div>
                          <div className="text-xs text-muted-foreground">
                            {isTeam ? `Team: ${award.team?.team_name || 'Unknown'}` : `Player: ${award.recipient?.discord_username || 'Unknown'}`}
                          </div>
                          <div className="text-xs font-semibold text-harvest mt-0.5">
                            ${(award.amount_cents / 100).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAward(award.id)}
                        className="text-muted-foreground hover:text-error hover:bg-error/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </BottomSheetModal.Body>

      <BottomSheetModal.Footer className="border-t border-border pt-4">
        <div className="flex items-center justify-end gap-3">
          <Button type="button" onClick={onClose} className="bg-muted text-foreground font-bold rounded-xl">
            {activeTab === 'config' ? 'Cancel' : 'Close'}
          </Button>
          {activeTab === 'config' && (
            <Button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="bg-harvest hover:bg-amber text-white font-bold rounded-xl"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...</> : <><Save className="w-4 h-4 mr-1" /> Save Prizes</>}
            </Button>
          )}
        </div>
      </BottomSheetModal.Footer>
    </BottomSheetModal>
  );
}
