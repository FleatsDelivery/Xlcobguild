import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { LoginPage } from '@/app/components/login-page';
import { Navigation } from '@/app/components/navigation';
import { HomePage } from '@/app/components/home-page';
import { LeaderboardPage } from '@/app/components/leaderboard-page';
import { RequestsPage } from '@/app/components/requests-page';
import { RulesPage } from '@/app/components/rules-page';
import { ProfilePage } from '@/app/components/profile-page';
import { Loader2 } from 'lucide-react';

type PageType = 'home' | 'leaderboard' | 'requests' | 'rules' | 'profile';

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

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [devMode, setDevMode] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Set up favicon and social meta tags
  useEffect(() => {
    // Set page title
    document.title = 'XLCOB - The Corn Field Guild Portal';

    // Create or update favicon (corn emoji as data URI)
    const setFavicon = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = '48px serif';
        ctx.fillText('🌽', 8, 52);
      }
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = canvas.toDataURL();
      document.getElementsByTagName('head')[0].appendChild(link);
    };
    setFavicon();

    // Set Open Graph meta tags for social sharing
    const setMetaTag = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    setMetaTag('og:title', 'XLCOB - The Corn Field Guild Portal');
    setMetaTag('og:description', 'Digital guild management system for The Corn Field Dota community. Track ranks, submit MVP requests, and compete on the leaderboard.');
    setMetaTag('og:image', 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f33d.png'); // Corn emoji
    setMetaTag('og:type', 'website');
    
    // Twitter Card tags
    const setTwitterTag = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    setTwitterTag('twitter:card', 'summary_large_image');
    setTwitterTag('twitter:title', 'XLCOB - The Corn Field Guild Portal');
    setTwitterTag('twitter:description', 'Digital guild management system for The Corn Field Dota community.');
    setTwitterTag('twitter:image', 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f33d.png');
  }, []);

  useEffect(() => {
    // Check for dev mode in hash
    const checkDevMode = () => {
      if (window.location.hash === '#dev-mode') {
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
        await fetchUserData(session.access_token);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (accessToken: string) => {
    // Skip fetching if in dev mode
    if (devMode) return;

    try {
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
          const { user: dbUser } = await userResponse.json();
          console.log('✅ Fetched user from database:', dbUser);
          setUser(dbUser);
        } else {
          const errorText = await userResponse.text();
          console.error('❌ Failed to fetch user from /auth/me:', userResponse.status, errorText);
          console.error('❌ Access token used:', accessToken?.substring(0, 20) + '...');
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshUser = async () => {
    if (session?.access_token) {
      await fetchUserData(session.access_token);
    }
  };

  // Fetch pending requests count
  useEffect(() => {
    if (!session?.access_token || !user) return;

    const fetchPendingCount = async () => {
      try {
        const isAdmin = user.role === 'admin' || user.role === 'owner';
        
        let totalPending = 0;

        // Fetch MVP requests count
        const mvpEndpoint = isAdmin 
          ? `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/mvp-requests`
          : `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/requests/mvp/my`;

        const mvpResponse = await fetch(mvpEndpoint, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (mvpResponse.ok) {
          const mvpData = await mvpResponse.json();
          totalPending += (mvpData.requests || []).filter((r: any) => r.status === 'pending').length;
        }

        // Fetch membership requests count (only for admins)
        if (isAdmin) {
          const membershipResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/admin/membership-requests`,
            {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
            }
          );

          if (membershipResponse.ok) {
            const membershipData = await membershipResponse.json();
            totalPending += (membershipData.requests || []).filter((r: any) => r.status === 'pending').length;
          }
        }

        setPendingRequestsCount(totalPending);
      } catch (error) {
        console.error('Error fetching pending requests count:', error);
      }
    };

    fetchPendingCount();

    // Refresh count every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [session, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdf5e9]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#f97316] animate-spin mx-auto mb-4" />
          <p className="text-[#0f172a]/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-[#fdf5e9]">
      <Navigation 
        currentPage={currentPage} 
        onNavigate={setCurrentPage} 
        user={user}
        pendingRequestsCount={pendingRequestsCount}
      />
      
      <main className="pt-16 pb-16">
        {currentPage === 'home' && <HomePage user={user} onRefresh={handleRefreshUser} />}
        {currentPage === 'leaderboard' && user?.role !== 'guest' && <LeaderboardPage user={user} />}
        {currentPage === 'leaderboard' && user?.role === 'guest' && <HomePage user={user} onRefresh={handleRefreshUser} />}
        {currentPage === 'requests' && <RequestsPage user={user} />}
        {currentPage === 'rules' && <RulesPage />}
        {currentPage === 'profile' && <ProfilePage user={user} onRefresh={handleRefreshUser} />}
      </main>
    </div>
  );
}