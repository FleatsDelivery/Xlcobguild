import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleDiscordLogin = async () => {
    try {
      setIsLoading(true);

      // Direct redirect to Discord OAuth (no popup)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        console.error('Discord login error:', error);
        alert('Failed to sign in with Discord. Please try again.');
        setIsLoading(false);
      }
      // If successful, browser will redirect to Discord
      // User will be redirected back after authorization
    } catch (err) {
      console.error('Login error:', err);
      alert('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdf5e9]">
      <div className="max-w-md w-full px-6">
        <div className="text-center mb-12">
          {/* Corn Logo Placeholder */}
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-[#f97316] flex items-center justify-center shadow-lg">
            <span className="text-5xl">🌽</span>
          </div>
          
          <h1 className="text-4xl font-bold text-[#0f172a] mb-2">
            XLCOB
          </h1>
          <p className="text-lg text-[#0f172a]/70">
            Welcome To The Guild
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-[#0f172a]/10">
          <p className="text-[#0f172a]/70 mb-8">
            Sign in with Discord to access the guild portal, track your ranks, and submit MVP requests.
          </p>

          <Button
            onClick={handleDiscordLogin}
            disabled={isLoading}
            className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white h-12 text-lg font-medium rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-5 w-5" />
                Sign in with Discord
              </>
            )}
          </Button>

          <div className="mt-6 text-center text-sm text-[#0f172a]/60">
            <p>By signing in, you agree to our</p>
            <div className="mt-1 space-x-2">
              <a
                href="https://sites.google.com/view/tcfevents/more/termsofservice"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3b82f6] hover:underline"
              >
                Terms of Service
              </a>
              <span>•</span>
              <a
                href="https://sites.google.com/view/tcfevents/more/privacypolicy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3b82f6] hover:underline"
              >
                Privacy Policy
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-[#0f172a]/60">
          <p>Need help? Join our Discord server</p>
          <a
            href="https://discord.gg/rHYPrdYGGh"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3b82f6] hover:underline mt-1 inline-block"
          >
            https://discord.gg/rHYPrdYGGh
          </a>
        </div>
      </div>
    </div>
  );
}