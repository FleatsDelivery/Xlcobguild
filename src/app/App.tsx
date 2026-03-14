import { useState, useEffect, useCallback, useRef } from 'react';
import { Toaster } from 'sonner';
import { ThemeProvider, useTheme } from '@/app/components/theme-provider';
import { supabase, initialHash } from '@/lib/supabase';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// Pre-load the icon barrel to prevent TDZ race conditions during concurrent module initialization
import '@/lib/icons';

import { Loader2 } from '@/lib/icons';
import { LoginPage } from '@/app/components/login-page';
import { SignupPage } from '@/app/components/signup-page';
import { Navigation } from '@/app/components/navigation';
import { KKupStinger, preloadStingerVideo } from '@/app/components/kkup-stinger';
import { isOfficer, loadCustomRoles } from '@/lib/roles';
import { saveCheckoutResult } from '@/lib/checkout-context';

// Static imports for all pages to prevent TDZ race conditions
import { HomePage } from '@/app/components/home-page';
import { LeaderboardPage } from '@/app/components/leaderboard-page';
import { InboxPage } from '@/app/components/inbox-page';
import { RulesPage } from '@/app/components/rules-page';
import { ProfilePage } from '@/app/components/profile-page';
import { KKUPPage } from '@/app/components/kkup-page';
import { LogoManagementPage } from '@/app/components/logo-management-page';
import { SteamResearchPage } from '@/app/components/steam-research-page';
import { PracticeTournamentPage } from '@/app/components/practice-tournament-page';
import { HallOfFamePage } from '@/app/components/hall-of-fame-page';
import { CsvTournamentImporter } from '@/app/components/csv-tournament-importer';
import { TournamentHubPage } from '@/app/components/tournament-hub-page';
import { OfficerPage } from '@/app/components/officer-page';
import { OfficerInboxPage } from '@/app/components/officer-inbox-page';
import { GiveawaysPage } from '@/app/components/giveaways-page';
import { GiveawayDetailPage } from '@/app/components/giveaway-detail-page';
import { SecretShopPage } from '@/app/components/secret-shop-page';
import { TermsOfServicePage } from '@/app/components/terms-of-service-page';
import { PrivacyPolicyPage } from '@/app/components/privacy-policy-page';
import { TransparencyPage } from '@/app/components/transparency-page';

type PageType = 'home' | 'leaderboard' | 'requests' | 'rules' | 'profile' | 'kkup' | 'logo-management' | 'steam-research' | 'practice' | 'hall-of-fame' | 'csv-import' | 'tournament-hub' | 'officer' | 'officer-inbox' | 'giveaways' | 'giveaway-detail' | 'secret-shop' | 'terms' | 'privacy' | 'transparency';

// Mock user data for development mode
const MOCK_USER = {
  id: 'dev-user-123',
  discord_id: '123456789',
  discord_username: 'GuestUser',
  discord_avatar: null,
  rank_id: null,
  prestige_level: 0,
  role: 'guest',
  ranks: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Resolve the "effective hash" — checks URL first, then module-level snapshot, then localStorage.
// This handles: normal navigation (URL hash), Supabase clearing hash (initialHash), and
// iframe reload / browser refresh stripping the hash entirely (localStorage).
const getEffectiveHash = (): string => {
  const urlHash = window.location.hash;
  if (urlHash && urlHash !== '#') return urlHash;
  if (initialHash && initialHash !== '#') return initialHash;
  
  // Last resort: check localStorage (survives iframe recreation on refresh)
  return localStorage.getItem('tcf_current_hash') || '';
};

// Determine current page from hash
const hashToPage = (hash: string): PageType => {
  if (hash.startsWith('#tournament-hub/')) return 'tournament-hub';
  if (hash.startsWith('#kkup/')) {
    // Unified routing: redirect legacy #kkup/{id} to #tournament-hub/{id}
    const id = hash.replace('#kkup/', '');
    window.location.hash = `#tournament-hub/${id}`;
    return 'tournament-hub';
  }
  if (hash === '#kernel-kup' || hash === '#kkup') return 'kkup';
  if (hash === '#logo-management') return 'logo-management';
  if (hash === '#leaderboard') return 'leaderboard';
  if (hash === '#requests') return 'requests';
  if (hash === '#inbox') return 'requests';
  if (hash === '#rules') return 'rules';
  if (hash === '#profile') return 'profile';
  if (hash === '#steam-research') return 'steam-research';
  if (hash === '#practice' || hash.startsWith('#practice/')) return 'practice';
  if (hash === '#hall-of-fame') return 'hall-of-fame';
  if (hash === '#csv-import') return 'csv-import';
  if (hash === '#officer') return 'officer';
  if (hash === '#officer-inbox') return 'officer-inbox';
  if (hash === '#giveaways') return 'giveaways';
  if (hash.startsWith('#giveaway/')) return 'giveaway-detail';
  if (hash === '#secret-shop' || hash.startsWith('#secret-shop?')) return 'secret-shop';
  if (hash === '#terms') return 'terms';
  if (hash === '#privacy') return 'privacy';
  if (hash === '#transparency') return 'transparency';
  return 'home';
};

/**
 * ThemeEnforcer — forces light mode for non-TCF+ users.
 * Must be rendered inside ThemeProvider. Renders nothing visible.
 */
function ThemeEnforcer({ isTcfPlus }: { isTcfPlus: boolean }) {
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    if (!isTcfPlus && theme !== 'light') {
      setTheme('light');
    }
  }, [isTcfPlus, theme, setTheme]);
  return null;
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [devMode, setDevMode] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [officerPendingCount, setOfficerPendingCount] = useState(0);
  const [showStinger, setShowStinger] = useState(false);
  const [onboarding, setOnboarding] = useState<{ mvp_request_count: number; reward_claimed: boolean } | null>(null);

  useEffect(() => {
    // ── Stripe Checkout Redirect Detection ──
    // Stripe redirects back with ?checkout=success|cancelled in the URL query string.
    // URL fragments (hash) don't survive redirect chains, so we use query params instead.
    // Save the result to localStorage and clean the URL before any other navigation logic runs.
    const searchParams = new URLSearchParams(window.location.search);
    const checkoutStatus = searchParams.get('checkout');
    if (checkoutStatus === 'success' || checkoutStatus === 'cancelled') {
      const checkoutType = searchParams.get('type');
      const checkoutQty = searchParams.get('qty') ? parseInt(searchParams.get('qty')!) : null;

      console.log('🌽 Stripe checkout redirect detected:', { checkoutStatus, checkoutType, checkoutQty });

      // Save result to localStorage so SecretShopPage can pick it up
      saveCheckoutResult({
        status: checkoutStatus as 'success' | 'cancelled',
        type: checkoutType,
        qty: checkoutQty,
      });

      // Clean the URL: remove query params, navigate to #secret-shop
      window.history.replaceState({}, '', window.location.pathname);
      window.location.hash = '#secret-shop';
      localStorage.setItem('tcf_current_hash', '#secret-shop');
    }

    // On mount: figure out where the user should be
    const effectiveHash = getEffectiveHash();

    // Preload the stinger video so it's cached when the user navigates to KKup
    preloadStingerVideo();

    console.log('🌽 Navigation restore — URL hash:', JSON.stringify(window.location.hash),
      '| initialHash:', JSON.stringify(initialHash),
      '| localStorage:', JSON.stringify(localStorage.getItem('tcf_current_hash')),
      '| effective:', JSON.stringify(effectiveHash));

    // If the URL is missing the hash but we know where the user should be, restore it
    if (effectiveHash && effectiveHash !== '#' && (!window.location.hash || window.location.hash === '#')) {
      console.log('🌽 Restoring hash to URL:', effectiveHash);
      window.location.hash = effectiveHash;
      // hashchange listener below will handle setCurrentPage + scroll
    } else {
      setCurrentPage(hashToPage(effectiveHash));
      window.scrollTo(0, 0);
    }

    // On every hash change: update page state AND persist to localStorage
    const onHashChange = () => {
      const hash = window.location.hash;
      // Persist every meaningful navigation to localStorage
      if (hash && hash !== '#') {
        localStorage.setItem('tcf_current_hash', hash);
        localStorage.setItem('tcf_hash_timestamp', Date.now().toString());
      } else {
        localStorage.removeItem('tcf_current_hash');
        localStorage.removeItem('tcf_hash_timestamp');
      }
      setCurrentPage(hashToPage(hash));
      window.scrollTo(0, 0);
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    // Check for dev mode in hash
    const checkDevMode = () => {
      const hash = window.location.hash || initialHash;
      if (hash === '#dev-mode') {
        setDevMode(true);
        setUser(MOCK_USER);
        setSession({ user: MOCK_USER }); // Mock session
        setLoading(false);
        return true;
      }
      return false;
    };

    // Check immediately
    if (checkDevMode()) return;

    // Listen for hash changes
    const handleHashChange = () => {
      if (checkDevMode()) return;
    };
    window.addEventListener('hashchange', handleHashChange);

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        // Store token for other components
        localStorage.setItem('supabase_token', session.access_token);
        
        // ── Session Freshness Check ──
        // If it's been 60+ minutes since the last login, clear saved hash and send user to home.
        // This prevents returning to stale/broken pages after long periods away.
        const lastLoginTime = localStorage.getItem('tcf_last_login_time');
        const now = Date.now();
        const oneHour = 60 * 60 * 1000; // 60 minutes in milliseconds
        
        if (lastLoginTime) {
          const timeSinceLastLogin = now - parseInt(lastLoginTime, 10);
          if (timeSinceLastLogin > oneHour) {
            console.log('🌽 Session stale (60+ minutes since last login), clearing saved hash');
            localStorage.removeItem('tcf_current_hash');
            localStorage.removeItem('tcf_hash_timestamp');
            window.location.hash = '';
          }
        }
        
        // Update last login time
        localStorage.setItem('tcf_last_login_time', now.toString());
        
        fetchUserData(session.access_token);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        // Store token for other components
        localStorage.setItem('supabase_token', session.access_token);
        await fetchUserData(session.access_token);
      } else {
        setUser(null);
        localStorage.removeItem('supabase_token');
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (accessToken: string) => {
    // Skip fetching if in dev mode
    if (devMode) return;

    try {
      // Fetch all roles from DB in parallel with user data (needed for display functions)
      const rolesPromise = fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/roles`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      ).then(r => r.ok ? r.json() : { roles: [] }).catch(() => ({ roles: [] }));

      // First, ensure user exists in database via server endpoint
      const discordUser = (await supabase.auth.getUser(accessToken)).data.user;
      
      if (discordUser) {
        // Log Discord user metadata for debugging
        console.log('Discord user metadata:', discordUser.user_metadata);
        console.log('Discord user identities:', discordUser.identities);
        console.log('🌽 Supabase User ID:', discordUser.id);
        
        // Call server to create/update user record - send full user object
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/auth/discord-callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            user: discordUser, // Send the FULL Supabase user object
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to create/update user in database:', errorText);
        }

        // Fetch full user data with rank info
        const userResponse = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/auth/me`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        console.log('🔍 /auth/me response status:', userResponse.status, userResponse.statusText);

        if (userResponse.ok) {
          const responseData = await userResponse.json();
          console.log('✅ Fetched user from database:', responseData.user);
          setUser(responseData.user);
          // Capture onboarding metadata from /auth/me
          if (responseData.onboarding) {
            setOnboarding(responseData.onboarding);
          }
        } else {
          const errorText = await userResponse.text();
          console.error('❌ Failed to fetch user from /auth/me:', userResponse.status, errorText);
          console.error('❌ Access token used:', accessToken?.substring(0, 20) + '...');
        }

        // Load custom roles into the roles module (filter out built-ins — those are hardcoded on frontend)
        const rolesData = await rolesPromise;
        const allDbRoles = rolesData.roles || [];
        const customOnly = allDbRoles.filter((r: any) => !r.isBuiltin);
        if (customOnly.length > 0) {
          loadCustomRoles(customOnly);
          console.log(`🎭 Loaded ${customOnly.length} custom role(s) from roles table`);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);

      // After auth completes, restore any saved page hash from before OAuth redirect
      const savedHash = localStorage.getItem('tcf_redirect_hash');
      if (savedHash) {
        localStorage.removeItem('tcf_redirect_hash');
        // Only restore if we're currently on an empty/home hash (i.e. came back from OAuth)
        if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
          window.location.hash = savedHash;
        }
      }
    }
  };

  const handleRefreshUser = async () => {
    if (session?.access_token) {
      await fetchUserData(session.access_token);
    }
  };

  // Function to trigger Hall of Fame stinger
  const handleHallOfFameNavigate = () => {
    if (currentPage !== 'hall-of-fame') {
      // Show stinger FIRST — navigation happens mid-way through the video
      setShowStinger(true);
    }
  };

  const handleStingerComplete = useCallback(() => {
    setShowStinger(false);
  }, []);

  const handleStingerMidpoint = useCallback(() => {
    // Navigate to hall-of-fame page mid-way through the stinger so it loads behind the video
    window.location.hash = '#hall-of-fame';
  }, []);

  // Fetch pending requests count — extracted as a stable callback so children can trigger it
  const fetchPendingCountRef = useRef<() => Promise<void>>();

  // If a direct count is provided, set it immediately without a server round-trip.
  // Otherwise, fetch from server (existing behavior for polling / visibility change).
  const refreshBadgeCount = useCallback((directCount?: number) => {
    if (typeof directCount === 'number') {
      setPendingRequestsCount(directCount);
      return;
    }
    fetchPendingCountRef.current?.();
  }, []);

  // Same pattern for officer badge — optimistic direct count, or fall back to server fetch
  const refreshOfficerBadge = useCallback((directCount?: number) => {
    if (typeof directCount === 'number') {
      setOfficerPendingCount(directCount);
      return;
    }
    fetchPendingCountRef.current?.();
  }, []);

  useEffect(() => {
    if (!session?.access_token || !user) return;

    const fetchPendingCount = async () => {
      try {
        let totalPending = 0;

        // Fetch notification unread count from the unified system
        try {
          const notifResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/notifications/unread-count`,
            { headers: { 'Authorization': `Bearer ${session.access_token}` } }
          );
          if (notifResponse.ok) {
            const notifData = await notifResponse.json();
            totalPending += notifData.unread_count || 0;
          }
        } catch (e) {
          // Notification endpoint may not have data yet — that's OK
        }

        setPendingRequestsCount(totalPending);
      } catch (error) {
        console.error('Error fetching pending requests count:', error);
      }

      // Fetch officer pending count (lightweight, runs for officers only)
      if (isOfficer(user.role)) {
        try {
          const officerRes = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/officer/pending-count`,
            { headers: { 'Authorization': `Bearer ${session.access_token}` } }
          );
          if (officerRes.ok) {
            const officerData = await officerRes.json();
            setOfficerPendingCount(officerData.pending_count || 0);
          }
        } catch (_) { /* non-critical */ }
      }
    };

    // Store latest version in ref so refreshBadgeCount always calls the current one
    fetchPendingCountRef.current = fetchPendingCount;

    fetchPendingCount();

    // Officers poll faster (15s) since they're acting on requests; members poll at 30s
    const isAdmin = isOfficer(user.role);
    const pollInterval = isAdmin ? 15000 : 30000;
    const interval = setInterval(fetchPendingCount, pollInterval);

    // Refetch when tab regains focus (biggest "real-time feel" win)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchPendingCount();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session, user]);

  // Refetch badge count whenever user navigates to the requests page
  useEffect(() => {
    if (currentPage === 'requests' || currentPage === 'officer-inbox') {
      refreshBadgeCount();
    }
  }, [currentPage, refreshBadgeCount]);

  if (loading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-harvest animate-spin mx-auto mb-4" />
            <p className="text-foreground/70">Loading...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Check if we're on the signup route
  const isSignupRoute = window.location.hash === '#signup';

  if (!session && isSignupRoute) {
    return <ThemeProvider><SignupPage onComplete={() => window.location.reload()} /></ThemeProvider>;
  }

  if (!session) {
    // Save the current hash so the user lands on the right page after Discord login
    const hash = window.location.hash || initialHash || localStorage.getItem('tcf_current_hash') || '';
    if (hash && hash !== '#' && hash !== '#login' && hash !== '#signup') {
      localStorage.setItem('tcf_redirect_hash', hash);
    }
    return <ThemeProvider><LoginPage /></ThemeProvider>;
  }

  // If user is logged in but on signup route, show signup page
  if (isSignupRoute) {
    return <SignupPage onComplete={() => {
      window.location.hash = '';
      window.location.reload();
    }} />;
  }

  return (
    <ThemeProvider>
    <ThemeEnforcer isTcfPlus={!!user?.tcf_plus_active} />
    <div className="min-h-screen bg-background">
      <Navigation 
        currentPage={currentPage} 
        onNavigate={setCurrentPage} 
        onHallOfFameNavigate={handleHallOfFameNavigate}
        user={user}
        pendingRequestsCount={pendingRequestsCount}
        officerPendingCount={officerPendingCount}
      />
      
      <main className="pt-14 sm:pt-16 pb-4 sm:pb-20">
        {currentPage === 'home' && <HomePage user={user} onboarding={onboarding} onRefresh={handleRefreshUser} onBadgeRefresh={refreshBadgeCount} />}
        {currentPage === 'leaderboard' && <LeaderboardPage user={user} onRefresh={handleRefreshUser} />}
        {currentPage === 'requests' && <InboxPage user={user} onBadgeRefresh={refreshBadgeCount} />}
        {currentPage === 'rules' && <RulesPage />}
        {currentPage === 'profile' && <ProfilePage user={user} onboarding={onboarding} onRefresh={handleRefreshUser} />}
        {currentPage === 'kkup' && <KKUPPage user={user} onHallOfFameNavigate={handleHallOfFameNavigate} />}
        {currentPage === 'logo-management' && <LogoManagementPage />}
        {currentPage === 'steam-research' && <SteamResearchPage />}
        {currentPage === 'practice' && (
          <PracticeTournamentPage
            user={user}
            accessToken={session?.access_token || localStorage.getItem('supabase_token') || ''}
            leagueId={(() => {
              const hash = window.location.hash || initialHash || localStorage.getItem('tcf_current_hash') || '';
              const match = hash.match(/^#practice\/(\d+)$/);
              return match ? match[1] : undefined;
            })()}
            onBack={() => { window.location.hash = '#practice'; }}
          />
        )}
        {currentPage === 'hall-of-fame' && <HallOfFamePage />}
        {currentPage === 'csv-import' && user?.role === 'owner' && (
          <CsvTournamentImporter user={user} onBack={() => { window.location.hash = '#officer'; }} />
        )}
        {currentPage === 'tournament-hub' && (
          <TournamentHubPage
            tournamentId={(window.location.hash || initialHash || localStorage.getItem('tcf_current_hash') || '').replace('#tournament-hub/', '')}
            user={user}
            accessToken={session?.access_token || localStorage.getItem('supabase_token') || ''}
            onBack={() => { window.location.hash = '#kkup'; }}
          />
        )}
        {currentPage === 'officer' && (
          <OfficerPage
            user={user}
            onRefresh={handleRefreshUser}
          />
        )}
        {currentPage === 'officer-inbox' && (
          <OfficerInboxPage user={user} onBadgeRefresh={refreshOfficerBadge} />
        )}
        {currentPage === 'giveaways' && (
          <GiveawaysPage user={user} />
        )}
        {currentPage === 'giveaway-detail' && (
          <GiveawayDetailPage
            id={(window.location.hash || initialHash || localStorage.getItem('tcf_current_hash') || '').replace('#giveaway/', '')}
            user={user}
            accessToken={session?.access_token || localStorage.getItem('supabase_token') || ''}
          />
        )}
        {currentPage === 'secret-shop' && (
          <SecretShopPage user={user} />
        )}
        {currentPage === 'terms' && <TermsOfServicePage />}
        {currentPage === 'privacy' && <PrivacyPolicyPage />}
        {currentPage === 'transparency' && <TransparencyPage />}
      </main>

      {/* Hall of Fame Stinger - renders on top of everything */}
      {showStinger && (
        <KKupStinger
          onComplete={handleStingerComplete}
          onMidpoint={handleStingerMidpoint}
        />
      )}
    </div>
    </ThemeProvider>
  );
}