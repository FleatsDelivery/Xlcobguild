import { Home, Trophy, FileText, User, LogOut, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { supabase } from '@/lib/supabase';

interface NavigationProps {
  currentPage: 'home' | 'leaderboard' | 'requests' | 'profile';
  onNavigate: (page: 'home' | 'leaderboard' | 'requests' | 'profile') => void;
  user: any;
  pendingRequestsCount?: number;
}

export function Navigation({ currentPage, onNavigate, user, pendingRequestsCount }: NavigationProps) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <>
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white border-b-2 border-[#0f172a]/10 z-50">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-full bg-[#f97316] flex items-center justify-center">
                <span className="text-2xl">🌽</span>
              </div>
            </button>

            {/* Center Title */}
            <button
              onClick={() => window.open('https://discord.gg/rHYPrdYGGh', '_blank')}
              className="text-xl font-bold text-[#0f172a] absolute left-1/2 transform -translate-x-1/2 hover:text-[#f97316] transition-colors"
            >
              XLCOB
            </button>

            {/* Profile Button */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => onNavigate('profile')}
                className="hover:opacity-80 transition-opacity"
              >
                {user?.discord_avatar ? (
                  <img
                    src={user.discord_avatar.startsWith('http') 
                      ? user.discord_avatar 
                      : `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png?size=128`}
                    alt={user.discord_username || 'User'}
                    className="w-10 h-10 rounded-full border-2 border-[#f97316]"
                    onError={(e) => {
                      console.error('Failed to load avatar:', user.discord_avatar);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#0f172a] flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                )}
              </button>
              <Button
                onClick={handleSignOut}
                variant="ghost"
                size="sm"
                className="text-[#0f172a]/70 hover:text-[#0f172a] hover:bg-[#0f172a]/5"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg z-50">
        <div className="max-w-md mx-auto px-8 py-3">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => onNavigate('home')}
              className={`flex flex-col items-center justify-center gap-1.5 px-8 py-3 rounded-2xl transition-all duration-200 ${
                currentPage === 'home'
                  ? 'text-[#f97316] scale-105'
                  : 'text-[#0f172a]/40 hover:text-[#0f172a]/70 hover:scale-105'
              }`}
            >
              <Home className="w-7 h-7" strokeWidth={currentPage === 'home' ? 2.5 : 2} />
              <span className="text-xs font-semibold">Home</span>
            </button>

            <button
              onClick={() => onNavigate('leaderboard')}
              disabled={user?.role === 'guest'}
              className={`relative flex flex-col items-center justify-center gap-1.5 px-8 py-3 rounded-2xl transition-all duration-200 ${
                user?.role === 'guest'
                  ? 'text-[#0f172a]/20 cursor-not-allowed'
                  : currentPage === 'leaderboard'
                  ? 'text-[#f97316] scale-105'
                  : 'text-[#0f172a]/40 hover:text-[#0f172a]/70 hover:scale-105'
              }`}
            >
              <div className="relative">
                <Trophy className={`w-7 h-7 ${user?.role === 'guest' ? 'opacity-30' : ''}`} strokeWidth={currentPage === 'leaderboard' ? 2.5 : 2} />
                {user?.role === 'guest' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <X className="w-8 h-8 text-red-500/80" strokeWidth={3} />
                  </div>
                )}
              </div>
              <span className="text-xs font-semibold">Leaderboard</span>
            </button>

            <button
              onClick={() => onNavigate('requests')}
              className={`relative flex flex-col items-center justify-center gap-1.5 px-8 py-3 rounded-2xl transition-all duration-200 ${
                currentPage === 'requests'
                  ? 'text-[#f97316] scale-105'
                  : 'text-[#0f172a]/40 hover:text-[#0f172a]/70 hover:scale-105'
              }`}
            >
              <div className="relative">
                <FileText className="w-7 h-7" strokeWidth={currentPage === 'requests' ? 2.5 : 2} />
                {pendingRequestsCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#ef4444] text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {pendingRequestsCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold">Requests</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}