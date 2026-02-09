import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { Search, Link, X, Loader2, Trophy, Award, Gamepad2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

interface LinkKKupProfileModalProps {
  user: {
    id: string;
    discord_username: string;
    kkup_player_profile_id?: string | null;
  };
  onClose: () => void;
  onLinked: () => void;
}

interface PlayerProfile {
  id: string;
  name: string;
  steam_id: string;
  avatar_url?: string;
}

export function LinkKKupProfileModal({ user, onClose, onLinked }: LinkKKupProfileModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user.kkup_player_profile_id) {
      fetchCurrentProfile();
    }
  }, [user.kkup_player_profile_id]);

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchProfiles();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const fetchCurrentProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup-player-profiles/search?q=${user.kkup_player_profile_id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();
      if (response.ok && data.profiles && data.profiles.length > 0) {
        setCurrentProfile(data.profiles[0]);
      }
    } catch (err) {
      console.error('Error fetching current profile:', err);
    }
  };

  const searchProfiles = async () => {
    setSearching(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup-player-profiles/search?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setSearchResults(data.profiles || []);
      } else {
        setError(data.error || 'Failed to search profiles');
      }
    } catch (err: any) {
      setError(err.message || 'Error searching profiles');
    } finally {
      setSearching(false);
    }
  };

  const handleLink = async (profileId: string) => {
    setLinking(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/link-user-kkup-profile`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: user.id,
            kkup_player_profile_id: profileId,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        onLinked();
        onClose();
      } else {
        setError(data.error || 'Failed to link profile');
      }
    } catch (err: any) {
      setError(err.message || 'Error linking profile');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/unlink-user-kkup-profile`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: user.id,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        onLinked();
        onClose();
      } else {
        setError(data.error || 'Failed to unlink profile');
      }
    } catch (err: any) {
      setError(err.message || 'Error unlinking profile');
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[#fdf5e9] rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">Link Kernel Kup Profile</h2>
              <p className="text-sm text-orange-100">{user.discord_username}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Current Link Status */}
          {currentProfile && (
            <div className="mb-6 p-4 bg-green-50 border-2 border-green-500 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trophy className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-green-900">Currently Linked</p>
                    <p className="text-lg font-bold text-green-700">{currentProfile.name}</p>
                    <p className="text-xs text-green-600">Steam ID: {currentProfile.steam_id}</p>
                  </div>
                </div>
                <Button
                  onClick={handleUnlink}
                  disabled={unlinking}
                  variant="outline"
                  className="border-red-500 text-red-600 hover:bg-red-50"
                >
                  {unlinking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Unlinking...
                    </>
                  ) : (
                    'Unlink'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Search for Player Profile
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by player name or Steam ID..."
                className="w-full pl-10 pr-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-orange-500 bg-white"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500 animate-spin" />
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Type at least 2 characters to search
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Search Results */}
          <div className="space-y-2">
            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-center text-slate-500 py-8">
                No players found matching "{searchQuery}"
              </p>
            )}

            {searchResults.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center justify-between p-4 bg-white border-2 border-slate-200 rounded-lg hover:border-orange-400 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                    ) : (
                      <Gamepad2 className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{profile.name}</p>
                    <p className="text-xs text-slate-500">Steam ID: {profile.steam_id}</p>
                  </div>
                </div>
                <Button
                  onClick={() => handleLink(profile.id)}
                  disabled={linking || profile.id === currentProfile?.id}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {linking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Linking...
                    </>
                  ) : profile.id === currentProfile?.id ? (
                    'Current'
                  ) : (
                    'Link Profile'
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-4 flex justify-end gap-3 border-t-2 border-slate-200">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
