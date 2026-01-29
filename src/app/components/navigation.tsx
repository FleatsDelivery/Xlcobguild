import { useState } from 'react';
import { Home, Trophy, FileText, BookOpen, User, LogOut, X, Menu } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { supabase } from '@/lib/supabase';

interface NavigationProps {
  currentPage: 'home' | 'leaderboard' | 'requests' | 'rules' | 'profile';
  onNavigate: (page: 'home' | 'leaderboard' | 'requests' | 'rules' | 'profile') => void;
  user: any;
  pendingRequestsCount?: number;
}

export function Navigation({ currentPage, onNavigate, user, pendingRequestsCount }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleMobileNavigate = (page: 'home' | 'leaderboard' | 'requests' | 'rules' | 'profile') => {
    onNavigate(page);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white border-b-2 border-[#0f172a]/10 z-50">
        <div className="max-w-2xl mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Left side - Hamburger menu (mobile) + Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Hamburger Menu Button - Mobile only */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="sm:hidden p-2 hover:bg-[#0f172a]/5 rounded-lg transition-colors"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5 text-[#0f172a]" />
                ) : (
                  <Menu className="w-5 h-5 text-[#0f172a]" />
                )}
              </button>

              {/* Corn Logo - Always navigates to home */}
              <button
                onClick={() => onNavigate('home')}
                className="flex items-center hover:opacity-80 transition-opacity"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#f97316] flex items-center justify-center">
                  <span className="text-xl sm:text-2xl">🌽</span>
                </div>
              </button>
            </div>

            {/* Center Title - Links to home */}
            <button
              onClick={() => onNavigate('home')}
              className="text-lg sm:text-xl font-bold text-[#0f172a] absolute left-1/2 transform -translate-x-1/2 hover:text-[#f97316] transition-colors"
            >
              XLCOB
            </button>

            {/* Profile Button & Logout (desktop only for logout) */}
            <div className="flex items-center space-x-2 sm:space-x-3">
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
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-[#f97316]"
                    onError={(e) => {
                      console.error('Failed to load avatar:', user.discord_avatar);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#0f172a] flex items-center justify-center">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                )}
              </button>
              {/* Logout button - hidden on mobile */}
              <Button
                onClick={handleSignOut}
                variant="ghost"
                size="sm"
                className="hidden sm:flex text-[#0f172a]/70 hover:text-[#0f172a] hover:bg-[#0f172a]/5 p-1.5 sm:p-2"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Side Menu */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-40 sm:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Side Menu - Starts below top nav */}
          <div className="fixed top-14 left-0 bottom-0 w-64 bg-white z-50 shadow-2xl sm:hidden animate-in slide-in-from-left duration-300">
            <div className="flex flex-col h-full">
              {/* Menu Items */}
              <div className="flex-1 py-4 overflow-y-auto">
                <div className="space-y-1 px-2">
                  {/* Home */}
                  <button
                    onClick={() => handleMobileNavigate('home')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      currentPage === 'home'
                        ? 'bg-[#f97316] text-white'
                        : 'text-[#0f172a]/70 hover:bg-[#0f172a]/5'
                    }`}
                  >
                    <Home className="w-5 h-5" />
                    <span className="font-semibold">Home</span>
                  </button>

                  {/* Leaderboard */}
                  <button
                    onClick={() => handleMobileNavigate('leaderboard')}
                    disabled={user?.role === 'guest'}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      user?.role === 'guest'
                        ? 'text-[#0f172a]/20 cursor-not-allowed'
                        : currentPage === 'leaderboard'
                        ? 'bg-[#f97316] text-white'
                        : 'text-[#0f172a]/70 hover:bg-[#0f172a]/5'
                    }`}
                  >
                    <div className="relative">
                      <Trophy className={`w-5 h-5 ${user?.role === 'guest' ? 'opacity-30' : ''}`} />
                      {user?.role === 'guest' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <X className="w-6 h-6 text-red-500/80" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <span className="font-semibold">Leaderboard</span>
                  </button>

                  {/* Requests */}
                  <button
                    onClick={() => handleMobileNavigate('requests')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      currentPage === 'requests'
                        ? 'bg-[#f97316] text-white'
                        : 'text-[#0f172a]/70 hover:bg-[#0f172a]/5'
                    }`}
                  >
                    <div className="relative">
                      <FileText className="w-5 h-5" />
                      {pendingRequestsCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-[#ef4444] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                          {pendingRequestsCount}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold">Requests</span>
                  </button>

                  {/* Rules */}
                  <button
                    onClick={() => handleMobileNavigate('rules')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      currentPage === 'rules'
                        ? 'bg-[#f97316] text-white'
                        : 'text-[#0f172a]/70 hover:bg-[#0f172a]/5'
                    }`}
                  >
                    <BookOpen className="w-5 h-5" />
                    <span className="font-semibold">Rules</span>
                  </button>

                  {/* Profile */}
                  <button
                    onClick={() => handleMobileNavigate('profile')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      currentPage === 'profile'
                        ? 'bg-[#f97316] text-white'
                        : 'text-[#0f172a]/70 hover:bg-[#0f172a]/5'
                    }`}
                  >
                    <User className="w-5 h-5" />
                    <span className="font-semibold">Profile</span>
                  </button>
                </div>
              </div>

              {/* Logout Button at bottom */}
              <div className="p-4 border-t-2 border-[#0f172a]/10">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#ef4444] hover:bg-[#ef4444]/5 transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-semibold">Log Out</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Bottom Navigation - Hidden on mobile, visible on desktop */}
      <nav className="hidden sm:block fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg z-50 border-t border-[#0f172a]/10">
        <div className="max-w-md mx-auto px-4 sm:px-8 py-2 sm:py-3">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            <button
              onClick={() => onNavigate('home')}
              className={`flex flex-col items-center justify-center gap-1 sm:gap-1.5 px-4 sm:px-8 py-2 sm:py-3 rounded-2xl transition-all duration-200 ${
                currentPage === 'home'
                  ? 'text-[#f97316] scale-105'
                  : 'text-[#0f172a]/40 hover:text-[#0f172a]/70 hover:scale-105'
              }`}
            >
              <Home className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={currentPage === 'home' ? 2.5 : 2} />
              <span className="text-[10px] sm:text-xs font-semibold">Home</span>
            </button>

            <button
              onClick={() => onNavigate('leaderboard')}
              disabled={user?.role === 'guest'}
              className={`relative flex flex-col items-center justify-center gap-1 sm:gap-1.5 px-4 sm:px-8 py-2 sm:py-3 rounded-2xl transition-all duration-200 ${
                user?.role === 'guest'
                  ? 'text-[#0f172a]/20 cursor-not-allowed'
                  : currentPage === 'leaderboard'
                  ? 'text-[#f97316] scale-105'
                  : 'text-[#0f172a]/40 hover:text-[#0f172a]/70 hover:scale-105'
              }`}
            >
              <div className="relative">
                <Trophy className={`w-6 h-6 sm:w-7 sm:h-7 ${user?.role === 'guest' ? 'opacity-30' : ''}`} strokeWidth={currentPage === 'leaderboard' ? 2.5 : 2} />
                {user?.role === 'guest' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <X className="w-7 h-7 sm:w-8 sm:h-8 text-red-500/80" strokeWidth={3} />
                  </div>
                )}
              </div>
              <span className="text-[10px] sm:text-xs font-semibold">Leaderboard</span>
            </button>

            <button
              onClick={() => onNavigate('requests')}
              className={`relative flex flex-col items-center justify-center gap-1 sm:gap-1.5 px-4 sm:px-8 py-2 sm:py-3 rounded-2xl transition-all duration-200 ${
                currentPage === 'requests'
                  ? 'text-[#f97316] scale-105'
                  : 'text-[#0f172a]/40 hover:text-[#0f172a]/70 hover:scale-105'
              }`}
            >
              <div className="relative">
                <FileText className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={currentPage === 'requests' ? 2.5 : 2} />
                {pendingRequestsCount > 0 && (
                  <span className="absolute -top-1 sm:-top-2 -right-1 sm:-right-2 bg-[#ef4444] text-white text-[10px] sm:text-xs font-bold px-1 sm:px-1.5 py-0.5 rounded-full min-w-[16px] sm:min-w-[20px] text-center">
                    {pendingRequestsCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] sm:text-xs font-semibold">Requests</span>
            </button>

            <button
              onClick={() => onNavigate('rules')}
              className={`flex flex-col items-center justify-center gap-1 sm:gap-1.5 px-4 sm:px-8 py-2 sm:py-3 rounded-2xl transition-all duration-200 ${
                currentPage === 'rules'
                  ? 'text-[#f97316] scale-105'
                  : 'text-[#0f172a]/40 hover:text-[#0f172a]/70 hover:scale-105'
              }`}
            >
              <BookOpen className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={currentPage === 'rules' ? 2.5 : 2} />
              <span className="text-[10px] sm:text-xs font-semibold">Rules</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}