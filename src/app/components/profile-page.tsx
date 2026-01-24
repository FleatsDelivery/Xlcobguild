import { User, LogOut, Shield } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Footer } from '@/app/components/footer';

interface ProfilePageProps {
  user: any;
}

export function ProfilePage({ user }: ProfilePageProps) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#fdf5e9] px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Profile Header Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border-2 border-[#0f172a]/10 mb-6">
          <div className="flex flex-col items-center text-center">
            {/* Avatar */}
            {user?.discord_avatar ? (
              <img
                src={`https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png`}
                alt={user.discord_username}
                className="w-32 h-32 rounded-full border-4 border-[#f97316] mb-4"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-[#0f172a] flex items-center justify-center mb-4">
                <User className="w-16 h-16 text-white" />
              </div>
            )}

            {/* Username */}
            <h1 className="text-3xl font-bold text-[#0f172a] mb-2">
              {user?.discord_username || 'Guest User'}
            </h1>

            {/* Role Badge */}
            <div className="flex items-center gap-2 px-4 py-2 bg-[#f97316]/10 rounded-full mb-4">
              <Shield className="w-4 h-4 text-[#f97316]" />
              <span className="text-sm font-semibold text-[#f97316] uppercase">
                {user?.role || 'guest'}
              </span>
            </div>

            {/* Rank Info */}
            <div className="text-center mb-6">
              <p className="text-sm text-[#0f172a]/60 mb-1">Current Rank</p>
              <p className="text-2xl font-bold text-[#0f172a]">
                {user?.role === 'guest' ? 'Not Yet Ranked' : user?.ranks?.name || 'Earwig'}
              </p>
              {user?.prestige_level > 0 && (
                <p className="text-sm text-[#f97316] font-semibold">
                  Prestige Level {user.prestige_level}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Account Details Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border-2 border-[#0f172a]/10 mb-6">
          <h2 className="text-xl font-bold text-[#0f172a] mb-4">Account Details</h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-[#0f172a]/10">
              <span className="text-[#0f172a]/60">Discord ID</span>
              <span className="font-mono text-sm text-[#0f172a]">
                {user?.discord_id || 'N/A'}
              </span>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-[#0f172a]/10">
              <span className="text-[#0f172a]/60">Member Since</span>
              <span className="text-sm text-[#0f172a]">
                {user?.created_at 
                  ? new Date(user.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : 'N/A'
                }
              </span>
            </div>

            <div className="flex justify-between items-center py-3">
              <span className="text-[#0f172a]/60">Last Updated</span>
              <span className="text-sm text-[#0f172a]">
                {user?.updated_at 
                  ? new Date(user.updated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : 'N/A'
                }
              </span>
            </div>
          </div>
        </div>

        {/* Actions Card */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border-2 border-[#0f172a]/10 mb-24">
          <h2 className="text-xl font-bold text-[#0f172a] mb-4">Actions</h2>
          
          <Button
            onClick={handleSignOut}
            className="w-full bg-red-500 hover:bg-red-600 text-white h-12 rounded-xl font-semibold"
          >
            <LogOut className="mr-2 h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  );
}