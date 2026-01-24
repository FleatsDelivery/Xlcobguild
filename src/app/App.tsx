import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { LoginPage } from '@/app/components/login-page';
import { Navigation } from '@/app/components/navigation';
import { HomePage } from '@/app/components/home-page';
import { LeaderboardPage } from '@/app/components/leaderboard-page';
import { RequestsPage } from '@/app/components/requests-page';
import { ProfilePage } from '@/app/components/profile-page';
import { Loader2 } from 'lucide-react';

type PageType = 'home' | 'leaderboard' | 'requests' | 'profile';

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
        
        // Extract Discord info - Discord OAuth provides specific metadata
        const discordUsername = discordUser.user_metadata?.custom_claims?.global_name 
          || discordUser.user_metadata?.full_name 
          || discordUser.user_metadata?.name 
          || discordUser.email?.split('@')[0] 
          || 'Unknown';
        
        const discordAvatar = discordUser.user_metadata?.avatar_url 
          || discordUser.user_metadata?.picture;
        
        console.log('Extracted Discord username:', discordUsername);
        console.log('Extracted Discord avatar:', discordAvatar);
        
        // For auth purposes, we'll use the Supabase user ID as the primary identifier
        // The actual Discord ID is available in the identities array if needed
        console.log('🌽 Supabase User ID:', discordUser.id);
        
        // Call server to create/update user record
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/auth/discord-callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            supabase_user_id: discordUser.id, // Primary ID for lookups
            discord_username: discordUsername,
            discord_avatar: discordAvatar,
            discord_email: discordUser.email,
          }),
        });

        if (!response.ok) {
          console.error('Failed to create/update user in database');
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
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} user={user} />
      
      <main className="pt-16 pb-16">
        {currentPage === 'home' && <HomePage user={user} />}
        {currentPage === 'leaderboard' && user?.role !== 'guest' && <LeaderboardPage />}
        {currentPage === 'leaderboard' && user?.role === 'guest' && <HomePage user={user} />}
        {currentPage === 'requests' && <RequestsPage user={user} />}
        {currentPage === 'profile' && <ProfilePage user={user} onRefresh={handleRefreshUser} />}
      </main>
    </div>
  );
}