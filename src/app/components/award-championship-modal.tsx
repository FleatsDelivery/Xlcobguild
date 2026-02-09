import { useState, useEffect } from 'react';
import { X, Trophy, Loader2, AlertCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { toast } from 'sonner';

interface KernelKup {
  id: string;
  name: string;
  year: number;
}

interface Team {
  id: string;
  name: string;
  logo_url: string | null;
}

interface CurrentAwards {
  championship: {
    team_id: string;
    team_name: string;
    team_logo: string | null;
  } | null;
}

interface AwardChampionshipModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AwardChampionshipModal({ onClose, onSuccess }: AwardChampionshipModalProps) {
  const [kernelKups, setKernelKups] = useState<KernelKup[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedKernelKup, setSelectedKernelKup] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [currentAwards, setCurrentAwards] = useState<CurrentAwards | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingKups, setLoadingKups] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingAwards, setLoadingAwards] = useState(false);

  useEffect(() => {
    fetchKernelKups();
  }, []);

  useEffect(() => {
    if (selectedKernelKup) {
      fetchTeams(selectedKernelKup);
      fetchCurrentAwards(selectedKernelKup);
    } else {
      setTeams([]);
      setSelectedTeam('');
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

  const fetchTeams = async (kernelKupId: string) => {
    try {
      setLoadingTeams(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/${kernelKupId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch teams');
      }

      const data = await response.json();
      setTeams(data.teams || []);
    } catch (error: any) {
      console.error('Error fetching teams:', error);
      toast.error('Failed to load teams');
    } finally {
      setLoadingTeams(false);
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
    } catch (error: any) {
      console.error('Error fetching current awards:', error);
      toast.error('Failed to load current awards');
    } finally {
      setLoadingAwards(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedKernelKup || !selectedTeam) {
      toast.error('Please select both a Kernel Kup and a team');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('supabase_token');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/award-championship`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            kernel_kup_id: selectedKernelKup,
            team_id: selectedTeam,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to award championship');
      }

      const data = await response.json();
      toast.success('🏆 Championship awarded!', {
        description: data.message,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error awarding championship:', error);
      toast.error(error.message || 'Failed to award championship');
    } finally {
      setLoading(false);
    }
  };

  const selectedKernelKupName = kernelKups.find(k => k.id === selectedKernelKup)?.name;
  const selectedTeamName = teams.find(t => t.id === selectedTeam)?.name;
  const currentChampionTeam = currentAwards?.championship;
  const isChangingWinner = currentChampionTeam && currentChampionTeam.team_id !== selectedTeam;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-md">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#0f172a]">Award Championship</h2>
              <p className="text-sm text-[#0f172a]/60">Select the winning team</p>
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

          {/* Current Champion Status */}
          {selectedKernelKup && !loadingAwards && (
            <div className="bg-[#fdf5e9] rounded-lg p-4 border-2 border-[#0f172a]/10">
              <p className="text-sm font-bold text-[#0f172a] mb-2">CURRENT CHAMPION</p>
              {currentChampionTeam ? (
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                  <div>
                    <p className="font-bold text-[#0f172a]">{currentChampionTeam.team_name}</p>
                    <p className="text-xs text-[#0f172a]/60">Currently holds championship</p>
                  </div>
                </div>
              ) : (
                <p className="text-[#0f172a]/60 italic">No champion assigned yet</p>
              )}
            </div>
          )}

          {/* Select Team */}
          {selectedKernelKup && (
            <div>
              <label className="block text-sm font-bold text-[#0f172a] mb-2">
                NEW CHAMPION
              </label>
              {loadingTeams ? (
                <div className="flex items-center justify-center p-4 bg-[#fdf5e9] rounded-lg">
                  <Loader2 className="w-5 h-5 animate-spin text-[#f97316]" />
                  <span className="ml-2 text-sm text-[#0f172a]/60">Loading teams...</span>
                </div>
              ) : teams.length === 0 ? (
                <div className="p-4 bg-[#fdf5e9] rounded-lg text-center">
                  <p className="text-sm text-[#0f172a]/60">No teams found for this tournament</p>
                </div>
              ) : (
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="w-full p-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] bg-white text-[#0f172a]"
                  required
                >
                  <option value="">Choose the winning team...</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Warning for changing winner */}
          {isChangingWinner && selectedTeam && (
            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-orange-900 mb-1">Changing Championship Winner</p>
                  <p className="text-sm text-orange-800">
                    You are replacing <strong>{currentChampionTeam.team_name}</strong> with{' '}
                    <strong>{selectedTeamName}</strong> as the champion for {selectedKernelKupName}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          {selectedKernelKup && selectedTeam && !isChangingWinner && (
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border-2 border-yellow-200">
              <p className="text-sm font-bold text-[#0f172a] mb-2">Confirmation:</p>
              <p className="text-sm text-[#0f172a]/80">
                🏆 <strong>{selectedTeamName}</strong> will be awarded the championship for <strong>{selectedKernelKupName}</strong>
              </p>
              <p className="text-xs text-[#0f172a]/60 mt-2">
                This will update all team members' championship counts in the Hall of Fame.
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
              className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white rounded-lg font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={loading || !selectedKernelKup || !selectedTeam}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Awarding...
                </>
              ) : (
                <>
                  <Trophy className="w-5 h-5" />
                  Confirm Award
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
