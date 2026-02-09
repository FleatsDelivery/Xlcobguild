import { useState, useEffect } from 'react';
import { X, Crown, Loader2, Users, AlertCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { toast } from 'sonner';

interface KernelKup {
  id: string;
  name: string;
  year: number;
}

interface Player {
  id: string;
  name: string;
  avatar_url: string | null;
  steam_id: string;
}

interface CurrentAwards {
  popdKernelWinners: Array<{
    player_id: string;
    player_name: string;
    player_avatar: string | null;
  }>;
}

interface AwardPopdKernelModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AwardPopdKernelModal({ onClose, onSuccess }: AwardPopdKernelModalProps) {
  const [kernelKups, setKernelKups] = useState<KernelKup[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedKernelKup, setSelectedKernelKup] = useState<string>('');
  const [selectedPlayer1, setSelectedPlayer1] = useState<string>('');
  const [selectedPlayer2, setSelectedPlayer2] = useState<string>('');
  const [currentAwards, setCurrentAwards] = useState<CurrentAwards | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingKups, setLoadingKups] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [loadingAwards, setLoadingAwards] = useState(false);

  useEffect(() => {
    fetchKernelKups();
  }, []);

  useEffect(() => {
    if (selectedKernelKup) {
      fetchPlayers(selectedKernelKup);
      fetchCurrentAwards(selectedKernelKup);
    } else {
      setPlayers([]);
      setSelectedPlayer1('');
      setSelectedPlayer2('');
      setCurrentAwards(null);
    }
  }, [selectedKernelKup]);

  const fetchKernelKups = async () => {
    try {
      setLoadingKups(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch Kernel Kups');
      }

      const data = await response.json();
      setKernelKups(data.tournaments || []);
    } catch (error: any) {
      console.error('Error fetching Kernel Kups:', error);
      toast.error('Failed to load Kernel Kups');
    } finally {
      setLoadingKups(false);
    }
  };

  const fetchPlayers = async (kernelKupId: string) => {
    try {
      setLoadingPlayers(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/${kernelKupId}/players`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch players');
      }

      const data = await response.json();
      // Sort players by name
      const sortedPlayers = (data.players || []).sort((a: Player, b: Player) => 
        a.name.localeCompare(b.name)
      );
      setPlayers(sortedPlayers);
    } catch (error: any) {
      console.error('Error fetching players:', error);
      toast.error('Failed to load players');
    } finally {
      setLoadingPlayers(false);
    }
  };

  const fetchCurrentAwards = async (kernelKupId: string) => {
    try {
      setLoadingAwards(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/${kernelKupId}/awards`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch current awards');
      }

      const data = await response.json();
      setCurrentAwards(data);
      
      // Pre-fill the dropdowns with current winners if they exist
      if (data.popdKernelWinners && data.popdKernelWinners.length > 0) {
        setSelectedPlayer1(data.popdKernelWinners[0].player_id);
        if (data.popdKernelWinners.length > 1) {
          setSelectedPlayer2(data.popdKernelWinners[1].player_id);
        }
      }
    } catch (error: any) {
      console.error('Error fetching current awards:', error);
      toast.error('Failed to load current awards');
    } finally {
      setLoadingAwards(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedKernelKup || !selectedPlayer1) {
      toast.error('Please select a Kernel Kup and at least one player');
      return;
    }

    // Validate that both players aren't the same
    if (selectedPlayer1 && selectedPlayer2 && selectedPlayer1 === selectedPlayer2) {
      toast.error('Cannot award the same player twice');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('supabase_token');

      // Build array of player IDs (filter out empty strings)
      const playerIds = [selectedPlayer1, selectedPlayer2].filter(id => id && id.trim());

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/award-popd-kernel`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            kernel_kup_id: selectedKernelKup,
            player_ids: playerIds,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to award Pop\'d Kernel');
      }

      const data = await response.json();
      toast.success('👑 Pop\'d Kernel awarded!', {
        description: data.message,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error awarding Pop\'d Kernel:', error);
      toast.error(error.message || 'Failed to award Pop\'d Kernel');
    } finally {
      setLoading(false);
    }
  };

  const selectedKernelKupName = kernelKups.find(k => k.id === selectedKernelKup)?.name;
  const selectedPlayer1Data = players.find(p => p.id === selectedPlayer1);
  const selectedPlayer2Data = players.find(p => p.id === selectedPlayer2);
  const currentWinners = currentAwards?.popdKernelWinners || [];
  
  // Check if we're changing the winners
  const currentWinnerIds = currentWinners.map(w => w.player_id).sort();
  const newWinnerIds = [selectedPlayer1, selectedPlayer2].filter(id => id).sort();
  const isChangingWinners = currentWinners.length > 0 && 
    JSON.stringify(currentWinnerIds) !== JSON.stringify(newWinnerIds);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">Award Pop'd Kernel</h2>
              <p className="text-sm text-[#0f172a]/60">Select up to 2 MVP players</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#0f172a]/60 hover:text-[#0f172a] transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Select Kernel Kup */}
          <div>
            <label className="block text-sm font-bold text-[#0f172a] mb-2">
              Select Kernel Kup
            </label>
            {loadingKups ? (
              <div className="flex items-center justify-center p-4 bg-[#fdf5e9] rounded-lg">
                <Loader2 className="w-5 h-5 animate-spin text-[#f97316]" />
                <span className="ml-2 text-sm text-[#0f172a]/60">Loading tournaments...</span>
              </div>
            ) : (
              <select
                value={selectedKernelKup}
                onChange={(e) => setSelectedKernelKup(e.target.value)}
                className="w-full p-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] bg-white text-[#0f172a]"
                required
              >
                <option value="">Choose a tournament...</option>
                {kernelKups.map((kup) => (
                  <option key={kup.id} value={kup.id}>
                    {kup.name} ({kup.year})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Current Winners Status */}
          {selectedKernelKup && !loadingAwards && (
            <div className="bg-[#fdf5e9] rounded-lg p-4 border-2 border-[#0f172a]/10">
              <p className="text-sm font-bold text-[#0f172a] mb-2">CURRENT POP'D KERNEL WINNERS</p>
              {currentWinners.length > 0 ? (
                <div className="space-y-2">
                  {currentWinners.map((winner, index) => (
                    <div key={winner.player_id} className="flex items-center gap-3">
                      <Crown className="w-5 h-5 text-purple-500" />
                      <div className="flex items-center gap-2">
                        {winner.player_avatar ? (
                          <img
                            src={winner.player_avatar}
                            alt={winner.player_name}
                            className="w-8 h-8 rounded-full border-2 border-purple-300"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center">
                            <Users className="w-4 h-4 text-purple-600" />
                          </div>
                        )}
                        <p className="font-bold text-[#0f172a]">{winner.player_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[#0f172a]/60 italic">No winners assigned yet</p>
              )}
            </div>
          )}

          {/* Select Players */}
          {selectedKernelKup && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#0f172a] mb-2">
                  NEW WINNER 1 <span className="text-red-500">*</span>
                </label>
                {loadingPlayers ? (
                  <div className="flex items-center justify-center p-4 bg-[#fdf5e9] rounded-lg">
                    <Loader2 className="w-5 h-5 animate-spin text-[#f97316]" />
                    <span className="ml-2 text-sm text-[#0f172a]/60">Loading players...</span>
                  </div>
                ) : players.length === 0 ? (
                  <div className="p-4 bg-[#fdf5e9] rounded-lg text-center">
                    <p className="text-sm text-[#0f172a]/60">No players found for this tournament</p>
                  </div>
                ) : (
                  <select
                    value={selectedPlayer1}
                    onChange={(e) => setSelectedPlayer1(e.target.value)}
                    className="w-full p-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] bg-white text-[#0f172a]"
                    required
                  >
                    <option value="">Choose the MVP player...</option>
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-[#0f172a] mb-2">
                  NEW WINNER 2 <span className="text-[#0f172a]/40">(Optional)</span>
                </label>
                {loadingPlayers ? (
                  <div className="flex items-center justify-center p-4 bg-[#fdf5e9] rounded-lg">
                    <Loader2 className="w-5 h-5 animate-spin text-[#f97316]" />
                  </div>
                ) : players.length === 0 ? (
                  <div className="p-4 bg-[#fdf5e9] rounded-lg text-center">
                    <p className="text-sm text-[#0f172a]/60">No players available</p>
                  </div>
                ) : (
                  <select
                    value={selectedPlayer2}
                    onChange={(e) => setSelectedPlayer2(e.target.value)}
                    className="w-full p-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] bg-white text-[#0f172a]"
                  >
                    <option value="">Choose second MVP (optional)...</option>
                    {players.map((player) => (
                      <option 
                        key={player.id} 
                        value={player.id}
                        disabled={player.id === selectedPlayer1}
                      >
                        {player.name} {player.id === selectedPlayer1 ? '(Already selected)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* Warning for changing winners */}
          {isChangingWinners && selectedPlayer1 && (
            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-orange-900 mb-1">Changing Pop'd Kernel Winners</p>
                  <p className="text-sm text-orange-800 mb-2">
                    Current: {currentWinners.map(w => w.player_name).join(' and ')}
                  </p>
                  <p className="text-sm text-orange-800">
                    New: {[selectedPlayer1Data?.name, selectedPlayer2Data?.name].filter(Boolean).join(' and ')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          {selectedKernelKup && selectedPlayer1 && !isChangingWinners && (
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border-2 border-purple-200">
              <p className="text-sm font-bold text-[#0f172a] mb-3">Confirmation:</p>
              <div className="space-y-2">
                {selectedPlayer1Data && (
                  <div className="flex items-center gap-3">
                    {selectedPlayer1Data.avatar_url ? (
                      <img
                        src={selectedPlayer1Data.avatar_url}
                        alt={selectedPlayer1Data.name}
                        className="w-10 h-10 rounded-full border-2 border-purple-300"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center border-2 border-purple-300">
                        <Users className="w-5 h-5 text-purple-600" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-[#0f172a]">{selectedPlayer1Data.name}</p>
                      <p className="text-xs text-[#0f172a]/60">Winner 1</p>
                    </div>
                  </div>
                )}
                {selectedPlayer2Data && (
                  <div className="flex items-center gap-3">
                    {selectedPlayer2Data.avatar_url ? (
                      <img
                        src={selectedPlayer2Data.avatar_url}
                        alt={selectedPlayer2Data.name}
                        className="w-10 h-10 rounded-full border-2 border-purple-300"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center border-2 border-purple-300">
                        <Users className="w-5 h-5 text-purple-600" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-[#0f172a]">{selectedPlayer2Data.name}</p>
                      <p className="text-xs text-[#0f172a]/60">Winner 2</p>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-sm text-[#0f172a]/80 mt-3">
                👑 Will receive Pop'd Kernel award for <strong>{selectedKernelKupName}</strong>
              </p>
              <p className="text-xs text-[#0f172a]/60 mt-2">
                This will update their Pop'd Kernel award counts in the Hall of Fame.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-[#0f172a]/5 hover:bg-[#0f172a]/10 text-[#0f172a] rounded-lg font-bold transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={loading || !selectedKernelKup || !selectedPlayer1}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Awarding...
                </>
              ) : (
                <>
                  <Crown className="w-5 h-5" />
                  Confirm Awards
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
