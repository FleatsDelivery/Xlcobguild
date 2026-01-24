import { Home, Trophy, FileText, User, LogOut } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { supabase } from '@/lib/supabase';

interface NavigationProps {
  currentPage: 'home' | 'leaderboard' | 'requests';
  onNavigate: (page: 'home' | 'leaderboard' | 'requests') => void;
  user: any;
}

export function Navigation({ currentPage, onNavigate, user }: NavigationProps) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <>
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white border-b-2 border-[#0f172a]/10 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-[#f97316] flex items-center justify-center">
                <span className="text-2xl">🌽</span>
              </div>
            </div>

            {/* Center Title */}
            <h1 className="text-xl font-bold text-[#0f172a] absolute left-1/2 transform -translate-x-1/2">
              XLCOB
            </h1>

            {/* Profile Button */}
            <div className="flex items-center space-x-3">
              {user?.discord_avatar ? (
                <img
                  src={`https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png`}
                  alt={user.discord_username}
                  className="w-10 h-10 rounded-full border-2 border-[#f97316]"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#0f172a] flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
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
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-[#0f172a]/10 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-around h-16">
            <Button
              onClick={() => onNavigate('home')}
              variant="ghost"
              className={`flex flex-col items-center justify-center h-full px-6 space-y-1 rounded-none ${
                currentPage === 'home'
                  ? 'text-[#f97316] bg-[#f97316]/10'
                  : 'text-[#0f172a]/60 hover:text-[#0f172a] hover:bg-[#0f172a]/5'
              }`}
            >
              <Home className="w-6 h-6" strokeWidth={currentPage === 'home' ? 2.5 : 2} />
              <span className="text-xs font-medium">Home</span>
            </Button>

            <Button
              onClick={() => onNavigate('leaderboard')}
              variant="ghost"
              className={`flex flex-col items-center justify-center h-full px-6 space-y-1 rounded-none ${
                currentPage === 'leaderboard'
                  ? 'text-[#f97316] bg-[#f97316]/10'
                  : 'text-[#0f172a]/60 hover:text-[#0f172a] hover:bg-[#0f172a]/5'
              }`}
            >
              <Trophy className="w-6 h-6" strokeWidth={currentPage === 'leaderboard' ? 2.5 : 2} />
              <span className="text-xs font-medium">Leaderboard</span>
            </Button>

            <Button
              onClick={() => onNavigate('requests')}
              variant="ghost"
              className={`flex flex-col items-center justify-center h-full px-6 space-y-1 rounded-none ${
                currentPage === 'requests'
                  ? 'text-[#f97316] bg-[#f97316]/10'
                  : 'text-[#0f172a]/60 hover:text-[#0f172a] hover:bg-[#0f172a]/5'
              }`}
            >
              <FileText className="w-6 h-6" strokeWidth={currentPage === 'requests' ? 2.5 : 2} />
              <span className="text-xs font-medium">Requests</span>
            </Button>
          </div>
        </div>
      </nav>
    </>
  );
}
