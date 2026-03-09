import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

type SignupState = 'loading' | 'authenticating' | 'submitting' | 'success' | 'error' | 'already_member';

interface SignupPageProps {
  onComplete?: () => void;
}

export function SignupPage({ onComplete }: SignupPageProps) {
  const [state, setState] = useState<SignupState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    handleSignup();
  }, []);

  const handleSignup = async () => {
    try {
      // Check if user is already authenticated
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.access_token) {
        // User is already logged in - check their role
        setState('submitting');
        await submitMembershipRequest(session.access_token);
      } else {
        // Not authenticated - trigger Discord OAuth
        setState('authenticating');
        
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'discord',
          options: {
            redirectTo: `${window.location.origin}#signup`, // Redirect back to signup page
          },
        });

        if (error) {
          console.error('Discord OAuth error:', error);
          setErrorMessage('Failed to start Discord authentication. Please try again.');
          setState('error');
        }
        // Browser will redirect to Discord - when they come back, this component will re-mount
      }
    } catch (err) {
      console.error('Signup error:', err);
      setErrorMessage('An unexpected error occurred. Please try again.');
      setState('error');
    }
  };

  const submitMembershipRequest = async (accessToken: string) => {
    try {
      // Fetch user info to check their current role
      const userResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/auth/me`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user info');
      }

      const { user: dbUser } = await userResponse.json();
      setUser(dbUser);

      // If they're already a member or higher, don't submit a new request
      if (dbUser.role !== 'guest') {
        setState('already_member');
        return;
      }

      // Check if they already have a pending request
      const checkResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/requests/membership/check`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (checkResponse.ok) {
        const { hasPendingRequest } = await checkResponse.json();
        if (hasPendingRequest) {
          setState('success'); // They already have a pending request, consider it success
          return;
        }
      }

      // Submit membership request
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/requests/membership`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to submit membership request:', errorText);
        throw new Error('Failed to submit membership request');
      }

      setState('success');
    } catch (err) {
      console.error('Error submitting membership request:', err);
      setErrorMessage('Failed to submit membership request. Please try again from the home page.');
      setState('error');
    }
  };

  // Listen for auth state changes (when user returns from Discord OAuth)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      // Only process if we're in authenticating state and we got a session
      if (state === 'authenticating' && session?.access_token && event === 'SIGNED_IN') {
        setState('submitting');
        await submitMembershipRequest(session.access_token);
      }
    });

    return () => subscription.unsubscribe();
  }, [state]);

  const renderContent = () => {
    switch (state) {
      case 'loading':
      case 'authenticating':
        return (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-harvest flex items-center justify-center shadow-lg">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
            <h1 className="text-3xl font-bold text-field-dark mb-4">
              Connecting to Discord...
            </h1>
            <p className="text-lg text-field-dark/70">
              Please wait while we redirect you to Discord to complete your registration.
            </p>
          </>
        );

      case 'submitting':
        return (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-harvest flex items-center justify-center shadow-lg">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
            <h1 className="text-3xl font-bold text-field-dark mb-4">
              Creating Your Account...
            </h1>
            <p className="text-lg text-field-dark/70">
              Setting up your profile and submitting your membership request.
            </p>
          </>
        );

      case 'success':
        return (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#22c55e] flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-field-dark mb-4">
              Welcome to The Corn Field! 🌽
            </h1>
            <p className="text-lg text-field-dark/70 mb-6">
              Your account has been created and your membership request has been submitted!
            </p>
            <div className="bg-harvest/10 rounded-xl p-6 mb-6 border-2 border-harvest/20">
              <p className="text-field-dark mb-2">
                <strong>Status:</strong> Guest (Pending Approval)
              </p>
              <p className="text-field-dark mb-2">
                <strong>Starting Rank:</strong> Earwig
              </p>
              <p className="text-field-dark/70 text-sm mt-4">
                Officers will review your request soon. You can track your request status on the home page!
              </p>
            </div>
            <Button
              onClick={() => {
                window.location.hash = '';
                if (onComplete) onComplete();
              }}
              className="w-full bg-harvest hover:bg-amber text-white h-12 text-lg font-medium rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              Go to Home Page
            </Button>
          </>
        );

      case 'already_member':
        return (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-harvest flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-field-dark mb-4">
              You're Already a Member! 🌽
            </h1>
            <p className="text-lg text-field-dark/70 mb-6">
              {user?.discord_username}, you're already part of The Corn Field!
            </p>
            <div className="bg-harvest/10 rounded-xl p-6 mb-6 border-2 border-harvest/20">
              <p className="text-field-dark mb-2">
                <strong>Role:</strong> {user?.role}
              </p>
              <p className="text-field-dark mb-2">
                <strong>Rank:</strong> {user?.ranks?.name || 'Earwig'} (Prestige {user?.prestige_level || 0})
              </p>
            </div>
            <Button
              onClick={() => {
                window.location.hash = '';
                if (onComplete) onComplete();
              }}
              className="w-full bg-harvest hover:bg-amber text-white h-12 text-lg font-medium rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              Go to Home Page
            </Button>
          </>
        );

      case 'error':
        return (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#ef4444] flex items-center justify-center shadow-lg">
              <AlertCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-field-dark mb-4">
              Something Went Wrong
            </h1>
            <p className="text-lg text-field-dark/70 mb-6">
              {errorMessage || 'An unexpected error occurred during signup.'}
            </p>
            <Button
              onClick={handleSignup}
              className="w-full bg-harvest hover:bg-amber text-white h-12 text-lg font-medium rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              Try Again
            </Button>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-silk px-6">
      <div className="max-w-xl w-full">
        <div className="bg-white rounded-3xl shadow-xl p-8 sm:p-12 border-2 border-field-dark/10 text-center">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}