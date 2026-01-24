import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { LoginPage } from '@/app/components/login-page';
import { Navigation } from '@/app/components/navigation';
import { HomePage } from '@/app/components/home-page';
import { LeaderboardPage } from '@/app/components/leaderboard-page';
import { RequestsPage } from '@/app/components/requests-page';
import { Loader2 } from 'lucide-react';

type PageType = 'home' | 'leaderboard' | 'requests';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<PageType>('home');

  useEffect(() => {
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
    try {
      // First, ensure user exists in database via server endpoint
      const discordUser = (await supabase.auth.getUser(accessToken)).data.user;
      
      if (discordUser) {
        // Call server to create/update user record
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/auth/discord-callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            discord_id: discordUser.id,
            discord_username: discordUser.user_metadata.full_name || discordUser.user_metadata.name || 'Unknown',
            discord_avatar: discordUser.user_metadata.avatar_url || discordUser.user_metadata.picture,
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

        if (userResponse.ok) {
          const { user: dbUser } = await userResponse.json();
          setUser(dbUser);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
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
        {currentPage === 'leaderboard' && <LeaderboardPage />}
        {currentPage === 'requests' && <RequestsPage user={user} />}
      </main>
    </div>
  );
}