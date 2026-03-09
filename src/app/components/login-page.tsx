import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LogIn, Loader2, UserPlus, ArrowRight, Shield } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { LegalModal } from '@/app/components/legal-modal';

const TCF_LOGO = 'https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/tcf_branding/logo_no_bg.png';

type AuthMode = 'sign_in' | 'create_account';

// Loading sub-states for richer feedback
type LoadingState = 'idle' | 'connecting' | 'redirecting' | 'error';

export function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('sign_in');
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);

  const handleDiscordAuth = async () => {
    try {
      setErrorMessage(null);
      setLoadingState('connecting');

      // Save the current hash so we can restore it after OAuth redirect
      const currentHash = window.location.hash;
      if (currentHash && currentHash !== '#' && currentHash !== '#login') {
        localStorage.setItem('tcf_redirect_hash', currentHash);
      }

      // Small delay so the user sees "Connecting..." before redirect
      await new Promise(r => setTimeout(r, 400));
      setLoadingState('redirecting');

      // Both sign-in and create-account go through Discord OAuth
      // Supabase handles new vs returning users automatically
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        console.error('Discord auth error:', error);
        setErrorMessage(error.message || 'Failed to connect to Discord. Please try again.');
        setLoadingState('error');
      }
      // If successful, browser will redirect to Discord
    } catch (err: any) {
      console.error('Auth error:', err);
      setErrorMessage('An unexpected error occurred. Please try again.');
      setLoadingState('error');
    }
  };

  const isLoading = loadingState === 'connecting' || loadingState === 'redirecting';

  const loadingText = loadingState === 'connecting'
    ? 'Connecting to Discord...'
    : loadingState === 'redirecting'
      ? 'Redirecting...'
      : '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full px-6">
        {/* Logo + branding */}
        <div className="text-center mb-10">
          <img src={TCF_LOGO} alt="The Corn Field" className="w-36 h-36 mx-auto mb-6 object-contain drop-shadow-lg" />

          <h1 className="text-4xl sm:text-5xl font-black text-foreground mb-2 font-['Barlow_Semi_Condensed'] uppercase tracking-tight">
            The Corn Field
          </h1>
          <p className="text-lg text-muted-foreground">
            Home of the Kernel Kup
          </p>
        </div>

        {/* Auth card */}
        <div className="bg-card rounded-2xl shadow-lg border-2 border-border overflow-hidden">
          {/* Mode tabs */}
          <div className="flex border-b-2 border-border">
            <button
              onClick={() => { setMode('sign_in'); setErrorMessage(null); }}
              className={`flex-1 py-3.5 text-sm font-bold tracking-wide transition-all relative ${
                mode === 'sign_in'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              Sign In
              {mode === 'sign_in' && (
                <div className="absolute bottom-0 left-4 right-4 h-[3px] bg-harvest rounded-full" />
              )}
            </button>
            <button
              onClick={() => { setMode('create_account'); setErrorMessage(null); }}
              className={`flex-1 py-3.5 text-sm font-bold tracking-wide transition-all relative ${
                mode === 'create_account'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/70'
              }`}
            >
              Create Account
              {mode === 'create_account' && (
                <div className="absolute bottom-0 left-4 right-4 h-[3px] bg-harvest rounded-full" />
              )}
            </button>
          </div>

          <div className="p-8">
            {/* Context text based on mode */}
            {mode === 'sign_in' ? (
              <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                Welcome back! Sign in with your Discord account to access the guild portal, track your ranks, and manage your teams.
              </p>
            ) : (
              <div className="mb-6">
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Join The Corn Field community! Creating an account is free and takes just a few seconds.
                </p>
                <div className="bg-harvest/5 rounded-xl p-3 border border-harvest/15">
                  <div className="flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-harvest flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      We use Discord for authentication — no new passwords to remember. Your Discord profile is used to create your guild identity.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error state */}
            {errorMessage && (
              <div className="mb-4 bg-[#ef4444]/5 border border-[#ef4444]/20 rounded-xl p-3">
                <p className="text-sm text-[#ef4444] font-medium">{errorMessage}</p>
                <button
                  onClick={() => { setErrorMessage(null); setLoadingState('idle'); }}
                  className="text-xs text-[#ef4444]/70 hover:text-[#ef4444] mt-1 underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Primary CTA */}
            <Button
              onClick={handleDiscordAuth}
              disabled={isLoading}
              className="w-full bg-discord hover:bg-[#4752C4] text-white h-12 text-base font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {loadingText}
                </>
              ) : mode === 'sign_in' ? (
                <>
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  Sign in with Discord
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-5 w-5" />
                  Create Account with Discord
                </>
              )}
            </Button>

            {/* Mode switch hint */}
            <div className="mt-5 text-center">
              {mode === 'sign_in' ? (
                <p className="text-sm text-muted-foreground">
                  New here?{' '}
                  <button
                    onClick={() => setMode('create_account')}
                    className="text-harvest font-semibold hover:text-harvest/80 transition-colors"
                  >
                    Create an account <ArrowRight className="inline w-3.5 h-3.5" />
                  </button>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <button
                    onClick={() => setMode('sign_in')}
                    className="text-harvest font-semibold hover:text-harvest/80 transition-colors"
                  >
                    Sign in <ArrowRight className="inline w-3.5 h-3.5" />
                  </button>
                </p>
              )}
            </div>

            {/* Legal */}
            <div className="mt-6 pt-5 border-t border-border text-center text-xs text-muted-foreground">
              <p>By continuing, you agree to our</p>
              <div className="mt-1 space-x-2">
                <button
                  onClick={() => setLegalModal('terms')}
                  className="text-harvest/70 hover:text-harvest hover:underline"
                >
                  Terms of Service
                </button>
                <span>·</span>
                <button
                  onClick={() => setLegalModal('privacy')}
                  className="text-harvest/70 hover:text-harvest hover:underline"
                >
                  Privacy Policy
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Social links */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p className="mb-3">Find us on</p>
          <div className="flex items-start justify-center gap-3">
            {/* Discord */}
            <a href="https://discord.gg/rHYPrdYGGh" target="_blank" rel="noopener noreferrer" title="Discord" className="group flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-xl bg-soil flex items-center justify-center shadow-md hover:shadow-lg hover:scale-110 transition-all">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </div>
              <span className="text-[9px] font-bold text-muted-foreground tracking-wide uppercase">Discord</span>
            </a>

            {/* YouTube */}
            <a href="https://www.youtube.com/@TheCornField_" target="_blank" rel="noopener noreferrer" title="YouTube" className="group flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-xl bg-soil flex items-center justify-center shadow-md hover:shadow-lg hover:scale-110 transition-all">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </div>
              <span className="text-[9px] font-bold text-muted-foreground tracking-wide uppercase">YouTube</span>
            </a>

            {/* Steam Group */}
            <a href="https://steamcommunity.com/groups/TheCornField" target="_blank" rel="noopener noreferrer" title="Steam Group" className="group flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-xl bg-soil flex items-center justify-center shadow-md hover:shadow-lg hover:scale-110 transition-all">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303a3.015 3.015 0 0 0-3.016-3.016 3.015 3.015 0 0 0-3.014 3.016 3.015 3.015 0 0 0 3.014 3.014 3.016 3.016 0 0 0 3.016-3.014zm-5.273-.005c0-1.248 1.013-2.26 2.26-2.26 1.246 0 2.26 1.013 2.26 2.26 0 1.247-1.014 2.26-2.26 2.26-1.248 0-2.26-1.013-2.26-2.26z"/>
                </svg>
              </div>
              <span className="text-[9px] font-bold text-muted-foreground tracking-wide uppercase">Steam</span>
            </a>

            <div className="w-px h-11 bg-border mx-0.5" />

            {/* Twitch — KK TV1 */}
            <a href="https://www.twitch.tv/kernelkup_tv1" target="_blank" rel="noopener noreferrer" title="Twitch – Kernel Kup TV1" className="group flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-xl bg-soil flex items-center justify-center shadow-md hover:shadow-lg hover:scale-110 transition-all">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                </svg>
              </div>
              <span className="text-[9px] font-bold text-muted-foreground tracking-wide uppercase">KK TV1</span>
            </a>

            {/* Twitch — KK TV2 */}
            <a href="https://www.twitch.tv/kernelkup_tv2" target="_blank" rel="noopener noreferrer" title="Twitch – Kernel Kup TV2" className="group flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-xl bg-soil flex items-center justify-center shadow-md hover:shadow-lg hover:scale-110 transition-all">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                </svg>
              </div>
              <span className="text-[9px] font-bold text-muted-foreground tracking-wide uppercase">KK TV2</span>
            </a>

            {/* Twitch — KK TV3 */}
            <a href="https://www.twitch.tv/kernelkup_tv3" target="_blank" rel="noopener noreferrer" title="Twitch – Kernel Kup TV3" className="group flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-xl bg-soil flex items-center justify-center shadow-md hover:shadow-lg hover:scale-110 transition-all">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                </svg>
              </div>
              <span className="text-[9px] font-bold text-muted-foreground tracking-wide uppercase">KK TV3</span>
            </a>

            {/* Twitch — KK TV4 */}
            <a href="https://www.twitch.tv/kernelkup_tv4" target="_blank" rel="noopener noreferrer" title="Twitch – Kernel Kup TV4" className="group flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-xl bg-soil flex items-center justify-center shadow-md hover:shadow-lg hover:scale-110 transition-all">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                </svg>
              </div>
              <span className="text-[9px] font-bold text-muted-foreground tracking-wide uppercase">KK TV4</span>
            </a>
          </div>
        </div>
      </div>
      {legalModal && (
        <LegalModal
          type={legalModal}
          onClose={() => setLegalModal(null)}
        />
      )}
    </div>
  );
}