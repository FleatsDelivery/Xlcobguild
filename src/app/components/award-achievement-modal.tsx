import { useState, useEffect } from 'react';
import { X, Trophy, Award } from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '/utils/supabase/info';

interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface KernelKup {
  id: string;
  name: string;
  year: number;
}

interface AwardAchievementModalProps {
  tournamentId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ACHIEVEMENT_TYPES = [
  {
    value: 'kernel_kup_champion',
    label: '🏆 Kernel Kup Champion',
    description: 'Won the tournament (winged trophy)',
    icon: Trophy,
  },
  {
    value: 'popd_kernel_mvp',
    label: '🍿 Pop\'d Kernel MVP',
    description: 'MVP award (golden popcorn trophy)',
    icon: Award,
  },
  {
    value: 'runner_up',
    label: '🥈 Runner Up',
    description: 'Second place finish',
    icon: Trophy,
  },
];

export function AwardAchievementModal({ tournamentId, onClose, onSuccess }: AwardAchievementModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [kernelKups, setKernelKups] = useState<KernelKup[]>([]);
  const [loading, setLoading] = useState(true);
  const [awarding, setAwarding] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedKernelKupId, setSelectedKernelKupId] = useState('');
  const [selectedAchievementType, setSelectedAchievementType] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('supabase_token');

      // Fetch all users
      const usersResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/users`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.users || []);
      }

      // Fetch all Kernel Kups
      const kkupsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (kkupsResponse.ok) {
        const kkupsData = await kkupsResponse.json();
        setKernelKups(kkupsData.tournaments || []);
      }
    } catch (error) {
      console.error('Fetch data error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAward = async () => {
    if (!selectedUserId || !selectedKernelKupId || !selectedAchievementType) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      setAwarding(true);
      const token = localStorage.getItem('supabase_token');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/achievements/award`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: selectedUserId,
            kernel_kup_id: selectedKernelKupId,
            achievement_type: selectedAchievementType,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to award achievement');
      }

      const selectedUser = users.find(u => u.id === selectedUserId);
      const selectedKKup = kernelKups.find(k => k.id === selectedKernelKupId);
      const achievementLabel = ACHIEVEMENT_TYPES.find(a => a.value === selectedAchievementType)?.label;

      toast.success(`✅ Awarded ${achievementLabel} to ${selectedUser?.display_name} for ${selectedKKup?.name}!`);
      onSuccess();
    } catch (error: any) {
      console.error('Award achievement error:', error);
      toast.error(error.message || 'Failed to award achievement');
    } finally {
      setAwarding(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full p-6">
          <p className="text-center text-[#0f172a]/60">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-[#f97316]" />
            <h2 className="text-2xl font-bold text-[#0f172a]">Award Achievement</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#0f172a]/60 hover:text-[#0f172a]"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Select User */}
          <div>
            <label className="block text-sm font-medium text-[#0f172a] mb-2">
              Select User
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-4 py-2 border-2 border-[#0f172a]/10 rounded-lg focus:border-[#f97316] focus:outline-none"
            >
              <option value="">Choose a user...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.display_name} (@{user.username})
                </option>
              ))}
            </select>
          </div>

          {/* Select Kernel Kup */}
          <div>
            <label className="block text-sm font-medium text-[#0f172a] mb-2">
              Select Kernel Kup
            </label>
            <select
              value={selectedKernelKupId}
              onChange={(e) => setSelectedKernelKupId(e.target.value)}
              className="w-full px-4 py-2 border-2 border-[#0f172a]/10 rounded-lg focus:border-[#f97316] focus:outline-none"
            >
              <option value="">Choose a tournament...</option>
              {kernelKups.map((kkup) => (
                <option key={kkup.id} value={kkup.id}>
                  {kkup.name} ({kkup.year})
                </option>
              ))}
            </select>
          </div>

          {/* Select Achievement Type */}
          <div>
            <label className="block text-sm font-medium text-[#0f172a] mb-2">
              Select Achievement
            </label>
            <div className="space-y-2">
              {ACHIEVEMENT_TYPES.map((achievement) => (
                <button
                  key={achievement.value}
                  onClick={() => setSelectedAchievementType(achievement.value)}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    selectedAchievementType === achievement.value
                      ? 'border-[#f97316] bg-[#f97316]/5'
                      : 'border-[#0f172a]/10 hover:border-[#f97316]/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <achievement.icon className={`w-5 h-5 mt-0.5 ${
                      selectedAchievementType === achievement.value ? 'text-[#f97316]' : 'text-[#0f172a]/40'
                    }`} />
                    <div>
                      <p className="font-semibold text-[#0f172a]">{achievement.label}</p>
                      <p className="text-sm text-[#0f172a]/60">{achievement.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Award Button */}
          <button
            onClick={handleAward}
            disabled={awarding || !selectedUserId || !selectedKernelKupId || !selectedAchievementType}
            className="w-full bg-[#f97316] text-white py-3 rounded-lg font-semibold hover:bg-[#ea580c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {awarding ? 'Awarding...' : '🏆 Award Achievement'}
          </button>
        </div>
      </div>
    </div>
  );
}