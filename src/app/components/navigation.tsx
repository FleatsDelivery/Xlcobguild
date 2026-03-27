import { useState, useEffect, useRef } from 'react';
import { Home, BookOpen, User, Menu, X, Crown, Gift, Swords, Inbox, Trophy, ShieldAlert, ShoppingBag, Upload } from '@/lib/icons';
import { getRoleDisplayName, isOfficer } from '@/lib/roles';
import { TcfPlusAvatarRing } from '@/app/components/tcf-plus-avatar-ring';
import { MvpSubmissionModal } from '@/app/components/mvp-submission-modal';

const TCF_LOGO = 'https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/tcf_branding/logo_no_bg.png';

// Inject logo glow keyframes once globally (mirrors tcf-plus-avatar-ring's pattern)
let logoGlowInjected = false;
function injectLogoGlowKeyframes() {
  if (logoGlowInjected || typeof document === 'undefined') return;
  logoGlowInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes tcfLogoGlow {
      0%, 100% { filter: drop-shadow(0 0 3px rgba(241,198,15,0.35)) drop-shadow(0 0 6px rgba(241,198,15,0.2)); }
      50% { filter: drop-shadow(0 0 6px rgba(241,198,15,0.55)) drop-shadow(0 0 12px rgba(241,198,15,0.35)); }
    }
    .tcf-logo-glow {
      animation: tcfLogoGlow 3s ease-in-out infinite;
    }
    @keyframes tcfTextGlow {
      0%, 100% { text-shadow: 0 0 4px rgba(241,198,15,0.25), 0 0 8px rgba(241,198,15,0.15); }
      50% { text-shadow: 0 0 8px rgba(241,198,15,0.45), 0 0 16px rgba(241,198,15,0.25); }
    }
    .tcf-text-glow {
      animation: tcfTextGlow 3s ease-in-out infinite;
    }
    @keyframes tcfAvatarGlow {
      0%, 100% { box-shadow: 0 0 4px 1px rgba(241,198,15,0.3); }
      50% { box-shadow: 0 0 8px 3px rgba(241,198,15,0.5); }
    }
    .tcf-avatar-glow {
      animation: tcfAvatarGlow 3s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}

// Guild rank emojis (1-11)
const RANK_EMOJIS = [
  '🐛', // 1. Earwig
  '🦌', // 2. Ugandan Kob
  '🌽', // 3. Private Maize
  '🥄', // 4. Specialist Ingredient
  '🍞', // 5. Corporal Corn Bread
  '🌾', // 6. Sergeant Husk
  '🌻', // 7. Sergeant Major Fields
  '🎯', // 8. Captain Cornhole
  '⭐', // 9. Major Cob
  '🌟', // 10. Corn Star
  '💥', // 11. Pop'd Kernel
];

type PageType = 'home' | 'leaderboard' | 'requests' | 'rules' | 'profile' | 'kkup' | 'logo-management' | 'steam-research' | 'practice' | 'hall-of-fame' | 'csv-import' | 'tournament-hub' | 'officer' | 'officer-inbox' | 'giveaways' | 'giveaway-detail' | 'secret-shop' | 'terms' | 'privacy' | 'transparency';

/**
 * Maps any PageType to the nav item that should be highlighted.
 * Pages not in the bottom/side nav light up their logical parent.
 */
function getNavParent(page: PageType): PageType {
  switch (page) {
    case 'tournament-hub':
      return 'kkup';
    case 'giveaway-detail':
      return 'giveaways';
    case 'logo-management':
    case 'steam-research':
    case 'practice':
    case 'csv-import':
      return 'officer';
    default:
      return page;
  }
}

interface NavigationProps {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  onHallOfFameNavigate: () => void;
  user: any;
  pendingRequestsCount: number;
  officerPendingCount?: number;
}

export function Navigation({ currentPage, onNavigate, onHallOfFameNavigate, user, pendingRequestsCount, officerPendingCount = 0 }: NavigationProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMvpModal, setShowMvpModal] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Inject TCF+ logo glow keyframes once
  useEffect(() => {
    if (user?.tcf_plus_active) injectLogoGlowKeyframes();
  }, [user?.tcf_plus_active]);

  const avatarUrl = user?.discord_avatar
    ? user.discord_avatar.startsWith('http')
      ? user.discord_avatar
      : `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png?size=64`
    : null;

  const handleNavigate = (page: PageType) => {
    if (page === 'hall-of-fame') {
      onHallOfFameNavigate();
    } else {
      window.location.hash = `#${page === 'home' ? '' : page}`;
      onNavigate(page);
    }
  };

  const handleMenuNavigate = (page: PageType) => {
    closeMenu();
    handleNavigate(page);
  };

  const openMenu = () => {
    setMenuOpen(true);
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  // Close menu on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) closeMenu();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [menuOpen]);

  const navItems: { page: PageType; icon: typeof Home; label: string; badge?: number }[] = [
    { page: 'home', icon: Home, label: 'Home' },
    { page: 'rules', icon: BookOpen, label: 'Rules' },
    { page: 'leaderboard', icon: Swords, label: 'Guild Wars' },
    { page: 'kkup' as PageType, icon: Crown, label: 'Kernel Kup' },
    { page: 'hall-of-fame' as PageType, icon: Trophy, label: 'Hall of Fame' },
    { page: 'giveaways', icon: Gift, label: 'Giveaways' },
    { page: 'secret-shop', icon: ShoppingBag, label: 'Secret Shop' },
    { page: 'requests', icon: Inbox, label: 'Inbox', badge: pendingRequestsCount },
    { page: 'profile', icon: User, label: 'Profile' },
  ];

  const showOfficerPanel = isOfficer(user?.role);

  return (
    <>
      {/* ── Top Header Bar ── */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-soil border-b border-harvest/20">
        <div className="relative flex items-center h-12 sm:h-14 px-3 sm:px-5">
          {/* Left: Hamburger + Logo */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 z-10">
            <button
              onClick={() => (menuOpen ? closeMenu() : openMenu())}
              className="p-1.5 rounded-lg text-silk/80 hover:text-silk hover:bg-white/10 transition-colors"
              aria-label="Toggle menu"
            >
              <div
                className="transition-transform duration-300 ease-out"
                style={{ transform: menuOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
              >
                {menuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </div>
            </button>
            <button
              onClick={() => handleNavigate('home')}
              className="hover:opacity-80 transition-opacity"
            >
              <img
                src={TCF_LOGO}
                alt="TCF Logo"
                className={`w-7 h-7 sm:w-8 sm:h-8 ${user?.tcf_plus_active ? 'tcf-logo-glow' : ''}`}
              />
            </button>
          </div>

          {/* Center: Text branding — absolutely positioned so it's always dead center */}
          <button
            onClick={() => handleNavigate('home')}
            className="hidden sm:flex absolute inset-0 flex-col items-center justify-center hover:opacity-80 transition-opacity pointer-events-none"
          >
            <p className={`pointer-events-auto text-xs sm:text-sm font-bold text-silk font-['Barlow_Semi_Condensed'] tracking-wide leading-tight ${user?.tcf_plus_active ? 'tcf-text-glow' : ''}`}>
              THE CORN FIELD
            </p>
            <p className={`pointer-events-auto text-[7px] sm:text-[9px] text-harvest font-semibold tracking-widest uppercase leading-tight ${user?.tcf_plus_active ? 'tcf-text-glow' : ''}`}>
              Home Of The Kernel Kup
            </p>
          </button>

          {/* Spacer so left/right don't collapse */}
          <div className="flex-1" />

          {/* Right: Inbox shortcuts + Avatar + Logout */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 z-10">
            {/* Inbox button */}
            <button
              onClick={() => handleNavigate('requests')}
              className={`relative p-1.5 rounded-lg transition-colors ${
                getNavParent(currentPage) === 'requests'
                  ? 'text-harvest bg-harvest/15'
                  : 'text-silk/60 hover:text-silk hover:bg-white/10'
              }`}
              aria-label="Inbox"
            >
              <Inbox className="w-[18px] h-[18px]" />
              {pendingRequestsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-harvest rounded-full ring-2 ring-soil" />
              )}
            </button>

            {/* Officer Inbox button (officers only) */}
            {showOfficerPanel && (
              <button
                onClick={() => handleNavigate('officer-inbox')}
                className={`relative p-1.5 rounded-lg transition-colors ${
                  getNavParent(currentPage) === 'officer-inbox'
                    ? 'text-amber-400 bg-amber-500/15'
                    : 'text-amber-400/50 hover:text-amber-400 hover:bg-amber-500/10'
                }`}
                aria-label="Officer Inbox"
              >
                <Inbox className="w-[18px] h-[18px]" />
                {(officerPendingCount ?? 0) > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-soil" />
                )}
              </button>
            )}

            {/* Officer Panel button (officers only) */}
            {showOfficerPanel && (
              <button
                onClick={() => handleNavigate('officer')}
                className={`relative p-1.5 rounded-lg transition-colors ${
                  getNavParent(currentPage) === 'officer'
                    ? 'text-amber-400 bg-amber-500/15'
                    : 'text-amber-400/50 hover:text-amber-400 hover:bg-amber-500/10'
                }`}
                aria-label="Officer Panel"
              >
                <ShieldAlert className="w-[18px] h-[18px]" />
              </button>
            )}

            {/* Divider */}
            <div className="w-px h-5 bg-white/10 mx-0.5" />

            {avatarUrl ? (
              <button
                onClick={() => handleNavigate('profile')}
                className="hover:opacity-80 transition-opacity"
              >
                <img
                  src={avatarUrl}
                  alt=""
                  className={`w-7 h-7 rounded-full border border-harvest/40 ${user?.tcf_plus_active ? 'tcf-avatar-glow' : ''}`}
                />
              </button>
            ) : (
              <button
                onClick={() => handleNavigate('profile')}
                className="w-7 h-7 rounded-full bg-harvest/20 flex items-center justify-center hover:opacity-80 transition-opacity"
              >
                <User className="w-4 h-4 text-silk/60" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Slide-Out Side Menu ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 top-12 sm:top-14">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black transition-opacity duration-200"
            style={{ opacity: 0.5 }}
            onClick={closeMenu}
          />

          {/* Panel — slides from left */}
          <div
            ref={panelRef}
            className="absolute top-0 left-0 bottom-0 sm:bottom-16 w-72 bg-soil border-r border-harvest/20 shadow-2xl flex flex-col transition-transform duration-300 ease-out"
            style={{ transform: 'translateX(0)' }}
          >
            {/* User Info */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
              <button
                onClick={() => handleMenuNavigate('profile')}
                className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
              >
                <TcfPlusAvatarRing active={user?.tcf_plus_active} size="sm">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="w-10 h-10 rounded-full border-2 border-harvest/40 flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-harvest/20 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-silk/60" />
                  </div>
                )}
                </TcfPlusAvatarRing>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-silk truncate text-left">
                    {user?.discord_username || 'Guest'}
                  </p>
                  <p className="text-[10px] text-harvest font-semibold uppercase tracking-wide text-left">
                    {getRoleDisplayName(user?.role || 'guest')}
                  </p>
                </div>
              </button>
            </div>

            {/* Nav Items */}
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
              {navItems.map(({ page, icon: Icon, label, badge }) => {
                const activePage = getNavParent(currentPage);
                const isActive = activePage === page;

                return (
                  <button
                    key={page}
                    onClick={() => handleMenuNavigate(page)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? 'bg-harvest/20 text-harvest'
                        : 'text-silk/70 hover:bg-white/5 hover:text-silk'
                    }`}
                  >
                    <div className="relative">
                      <Icon className="w-5 h-5" />
                      {!!badge && badge > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-harvest rounded-full ring-2 ring-soil" />
                      )}
                    </div>
                    <span className="text-sm font-semibold">{label}</span>
                  </button>
                );
              })}

              {/* Officer Panel — Special styled, officers only */}
              {showOfficerPanel && (
                <>
                  <div className="my-2 mx-2 border-t border-white/10" />
                  <button
                    onClick={() => handleMenuNavigate('officer')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      getNavParent(currentPage) === 'officer'
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                        : 'border-amber-500/20 text-amber-400/70 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400'
                    }`}
                  >
                    <ShieldAlert className="w-5 h-5" />
                    <span className="text-sm font-bold tracking-wide">Officer Panel</span>
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wider opacity-60 bg-amber-500/15 px-1.5 py-0.5 rounded">Staff</span>
                  </button>
                  <button
                    onClick={() => handleMenuNavigate('officer-inbox')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                      getNavParent(currentPage) === 'officer-inbox'
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                        : 'border-amber-500/20 text-amber-400/70 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400'
                    }`}
                  >
                    <div className="relative">
                      <Inbox className="w-5 h-5" />
                      {officerPendingCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-soil" />
                      )}
                    </div>
                    <span className="text-sm font-bold tracking-wide">Officer Inbox</span>
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wider opacity-60 bg-amber-500/15 px-1.5 py-0.5 rounded">Staff</span>
                  </button>
                </>
              )}
            </nav>

            {/* Legal Links + Copyright */}
            <div className="px-5 pb-4 pt-1 space-y-2 border-t border-white/10 mt-auto">
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => handleMenuNavigate('terms')}
                  className="text-[10px] text-silk/40 hover:text-silk/70 font-medium uppercase tracking-wide transition-colors"
                >
                  Terms
                </button>
                <span className="w-0.5 h-0.5 rounded-full bg-silk/20" />
                <button
                  onClick={() => handleMenuNavigate('privacy')}
                  className="text-[10px] text-silk/40 hover:text-silk/70 font-medium uppercase tracking-wide transition-colors"
                >
                  Privacy
                </button>
              </div>
              <p className="text-[10px] text-silk/30 text-center">
                &copy; The Corn Field 2023 – 2026
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom Navigation Bar (desktop only) ── */}
      <div className="hidden sm:block fixed bottom-0 left-0 right-0 z-50">
        {/* Nav bar background */}
        <div className="bg-soil border-t border-harvest/20">
          <div className="grid grid-cols-5 items-center h-16 max-w-2xl mx-auto px-2">
            {/* Col 1 — Home */}
            <button
              onClick={() => handleNavigate('home')}
              className={`flex flex-col items-center justify-center gap-1 py-2 rounded-2xl transition-all duration-200 ${
                getNavParent(currentPage) === 'home'
                  ? 'text-harvest bg-harvest/15 scale-105'
                  : 'text-silk/50 hover:text-silk/80 hover:bg-white/5'
              }`}
              title="Home"
            >
              <Home className="w-6 h-6" strokeWidth={getNavParent(currentPage) === 'home' ? 2.5 : 2} />
              <span className="text-xs font-semibold tracking-wide">Home</span>
            </button>

            {/* Col 2 — Guild Wars */}
            <button
              onClick={() => handleNavigate('leaderboard')}
              className={`flex flex-col items-center justify-center gap-1 py-2 rounded-2xl transition-all duration-200 ${
                getNavParent(currentPage) === 'leaderboard'
                  ? 'text-harvest bg-harvest/15 scale-105'
                  : 'text-silk/50 hover:text-silk/80 hover:bg-white/5'
              }`}
              title="Guild Wars"
            >
              <Swords className="w-6 h-6" strokeWidth={getNavParent(currentPage) === 'leaderboard' ? 2.5 : 2} />
              <span className="text-xs font-semibold tracking-wide">Guild Wars</span>
            </button>

            {/* Col 3 — FAB (mathematically centered by grid) */}
            <div className="flex items-center justify-center">
              <button
                onClick={() => setShowMvpModal(true)}
                className="w-16 h-16 -mt-8 rounded-full bg-gradient-to-br from-harvest to-[#c89612] hover:from-[#e8b71a] hover:to-[#d6a615] shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center text-4xl hover:scale-110 ring-4 ring-soil"
                title="Upload MVP Screenshot"
              >
                {RANK_EMOJIS[(user?.rank_id || 1) - 1] || '🐛'}
              </button>
            </div>

            {/* Col 4 — KKUP */}
            <button
              onClick={() => handleNavigate('kkup')}
              className={`flex flex-col items-center justify-center gap-1 py-2 rounded-2xl transition-all duration-200 ${
                getNavParent(currentPage) === 'kkup'
                  ? 'text-harvest bg-harvest/15 scale-105'
                  : 'text-silk/50 hover:text-silk/80 hover:bg-white/5'
              }`}
              title="KKUP"
            >
              <Crown className="w-6 h-6" strokeWidth={getNavParent(currentPage) === 'kkup' ? 2.5 : 2} />
              <span className="text-xs font-semibold tracking-wide">KKUP</span>
            </button>

            {/* Col 5 — Shop */}
            <button
              onClick={() => handleNavigate('secret-shop')}
              className={`flex flex-col items-center justify-center gap-1 py-2 rounded-2xl transition-all duration-200 ${
                getNavParent(currentPage) === 'secret-shop'
                  ? 'text-harvest bg-harvest/15 scale-105'
                  : 'text-silk/50 hover:text-silk/80 hover:bg-white/5'
              }`}
              title="Shop"
            >
              <ShoppingBag className="w-6 h-6" strokeWidth={getNavParent(currentPage) === 'secret-shop' ? 2.5 : 2} />
              <span className="text-xs font-semibold tracking-wide">Shop</span>
            </button>
          </div>
        </div>
      </div>

      {/* MVP Submission Modal */}
      {showMvpModal && (
        <MvpSubmissionModal
          user={user}
          onClose={() => setShowMvpModal(false)}
          onRefresh={() => {}}
        />
      )}
    </>
  );
}
