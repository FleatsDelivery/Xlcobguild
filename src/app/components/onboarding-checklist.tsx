import { useState, useEffect, useCallback } from 'react';
import { Check, Circle, Gamepad2, Tv, Shield, Gift, ChevronDown, ChevronUp, Loader2, Sparkles, X, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { SuccessModal } from '@/app/components/success-modal';
import { ConnectOpenDotaModal } from '@/app/components/connect-opendota-modal';
import { RankModal } from '@/app/components/tournament-hub-rank-modal';

interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  complete: boolean;
  skippable?: boolean;
  skipped?: boolean;
}

interface RoleRow {
  id: string;
  name: string;
  tag: string;
  color: string;
  logo_url: string | null;
  is_default: boolean;
  member_count: number;
}

interface OnboardingChecklistProps {
  user: any;
  onboarding: { mvp_request_count: number; reward_claimed: boolean } | null;
  onRefresh?: () => Promise<void>;
  variant?: 'full' | 'compact';
}

export function OnboardingChecklist({ user, onboarding, onRefresh, variant = 'full' }: OnboardingChecklistProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [guilds, setGuilds] = useState<RoleRow[]>([]);
  const [loadingGuilds, setLoadingGuilds] = useState(false);
  const [joiningGuild, setJoiningGuild] = useState(false);
  const [claimingReward, setClaimingReward] = useState(false);
  const [twitchSkipped, setTwitchSkipped] = useState(() => {
    try { return localStorage.getItem('tcf_twitch_skipped') === 'true'; } catch { return false; }
  });
  const [twitchLinking, setTwitchLinking] = useState(false);
  const [openDotaModalOpen, setOpenDotaModalOpen] = useState(false);
  const [showRankModal, setShowRankModal] = useState(false);
  const [rankSubmitting, setRankSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error' | 'info'; title: string; message: string; helpText?: string } | null>(null);

  // Derive step completion from user data
  const stepDiscord = true; // always done
  const stepSteam = !!user?.steam_id;
  const stepTwitch = !!user?.twitch_id;
  const stepGuild = user?.role !== 'guest';
  const rewardClaimed = onboarding?.reward_claimed ?? false;

  const steps: OnboardingStep[] = [
    {
      id: 'discord',
      label: 'Create Account',
      description: 'Sign in with Discord — done!',
      icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>,
      complete: stepDiscord,
    },
    {
      id: 'steam',
      label: 'Link Steam',
      description: 'Connect your Steam account to enable Dota 2 stats and OpenDota integration.',
      icon: <Gamepad2 className="w-4 h-4" />,
      complete: stepSteam,
    },
    {
      id: 'twitch',
      label: 'Link Twitch',
      description: 'Connect your Twitch channel to your profile. This step is optional.',
      icon: <Tv className="w-4 h-4" />,
      complete: stepTwitch,
      skippable: true,
      skipped: twitchSkipped && !stepTwitch,
    },
    {
      id: 'guild',
      label: 'Join a Guild',
      description: 'Pick a guild to represent. This determines your role badge across the site.',
      icon: <Shield className="w-4 h-4" />,
      complete: stepGuild,
    },
  ];

  const completedCount = steps.filter(s => s.complete || s.skipped).length;
  const totalSteps = steps.length;
  const allDone = completedCount >= totalSteps;
  const progressPct = Math.round((completedCount / totalSteps) * 100);

  // Find the current (first incomplete, non-skipped) step
  const currentStep = steps.find(s => !s.complete && !s.skipped);

  // Auto-expand the current step on mount and after completing a step
  useEffect(() => {
    if (currentStep) {
      setExpandedStep(currentStep.id);
    }
  }, [currentStep?.id]);

  // Fetch available guilds when guild step is expanded
  const fetchGuilds = useCallback(async () => {
    if (guilds.length > 0) return;
    setLoadingGuilds(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/guilds`
      );
      if (res.ok) {
        const data = await res.json();
        // Filter out Unaffiliated — not a real choice for onboarding
        const availableGuilds = (data.guilds || []).filter((g: RoleRow) => g.name !== 'Unaffiliated');
        setGuilds(availableGuilds);
      }
    } catch (e) {
      console.error('Error fetching guilds:', e);
    } finally {
      setLoadingGuilds(false);
    }
  }, [guilds.length]);

  useEffect(() => {
    if (expandedStep === 'guild' && !stepGuild) {
      fetchGuilds();
    }
  }, [expandedStep, stepGuild, fetchGuilds]);

  const handleJoinGuild = async (guildId: string, guildName: string) => {
    setJoiningGuild(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/guilds/${guildId}/join`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (res.ok) {
        setResult({
          type: 'success',
          title: 'Welcome to the Guild! 🌽',
          message: `You've joined ${guildName}! Your badge is now active across the site.`,
        });
        if (onRefresh) await onRefresh();
      } else {
        const err = await res.json();
        setResult({ type: 'error', title: 'Failed to Join', message: err.error || 'Something went wrong.' });
      }
    } catch (e) {
      console.error('Error joining guild:', e);
      setResult({ type: 'error', title: 'Error', message: 'Failed to join guild.' });
    } finally {
      setJoiningGuild(false);
    }
  };

  const handleClaimReward = async () => {
    setClaimingReward(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/auth/claim-onboarding-reward`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        }
      );

      if (res.ok) {
        const data = await res.json();
        setResult({
          type: 'success',
          title: 'Reward Claimed! 🎉',
          message: `You've earned a free rank-up to ${data.user?.ranks?.name || 'the next rank'}! Keep climbing.`,
        });
        if (onRefresh) await onRefresh();
      } else {
        const err = await res.json();
        setResult({ type: 'error', title: 'Failed to Claim', message: err.error || 'Something went wrong.' });
      }
    } catch (e) {
      console.error('Error claiming reward:', e);
      setResult({ type: 'error', title: 'Error', message: 'Failed to claim reward.' });
    } finally {
      setClaimingReward(false);
    }
  };

  const handleConnectOpenDota = async (opendotaId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not signed in');

    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/users/me/opendota`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ opendota_id: opendotaId }),
      }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to connect');
    }

    // Sync and check rank result
    const syncRes = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/users/me/opendota/sync`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      }
    );

    let rankUnknown = false;
    if (syncRes.ok) {
      try {
        const syncData = await syncRes.json();
        rankUnknown = !!syncData.rank_unknown;
      } catch { /* parse error, treat as success */ }
    }

    if (rankUnknown) {
      // Steam linked successfully, but rank couldn't be detected — prompt self-report
      setShowRankModal(true);
    } else {
      setResult({
        type: 'success',
        title: 'Steam Connected! 🎮',
        message: 'Your Steam account has been linked and Dota 2 stats are syncing.',
      });
    }

    if (onRefresh) setTimeout(() => onRefresh(), 800);
  };

  const handleSelfReportRank = async (medal: string) => {
    setRankSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/users/me/rank/self-report`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ medal }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save rank');
      }

      setShowRankModal(false);
      setResult({
        type: 'success',
        title: 'Steam Connected! 🎮',
        message: `Your Steam account is linked and your rank has been set to ${medal}. Thanks for being honest!`,
      });
      if (onRefresh) setTimeout(() => onRefresh(), 800);
    } catch (err: any) {
      console.error('Self-report rank error:', err);
      setResult({
        type: 'error',
        title: 'Rank Save Failed',
        message: err.message || 'Something went wrong saving your rank.',
      });
      setShowRankModal(false);
    } finally {
      setRankSubmitting(false);
    }
  };

  const handleLinkTwitch = async () => {
    setTwitchLinking(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'twitch',
        options: { redirectTo: window.location.origin + '/#profile' },
      });
      if (error) {
        setResult({ type: 'error', title: 'Twitch Error', message: error.message });
        setTwitchLinking(false);
      }
    } catch (e: any) {
      setResult({ type: 'error', title: 'Error', message: 'Failed to link Twitch.' });
      setTwitchLinking(false);
    }
  };

  const handleSkipTwitch = () => {
    setTwitchSkipped(true);
    try { localStorage.setItem('tcf_twitch_skipped', 'true'); } catch {}
    // Auto-advance to next step
    setExpandedStep('guild');
  };

  // If reward is claimed and all steps done, don't show anything
  if (allDone && rewardClaimed) return null;

  // ── Compact variant (for profile page) ────────────────────────────
  if (variant === 'compact') {
    if (allDone && rewardClaimed) return null;
    return (
      <div className="bg-gradient-to-br from-harvest/15 to-harvest/5 rounded-2xl p-4 border-2 border-harvest/20 mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-harvest" />
            Profile Setup
          </h3>
          <span className="text-xs font-bold text-harvest">{completedCount}/{totalSteps}</span>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-harvest to-kernel-gold transition-all duration-500 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {/* Step pills */}
        <div className="flex flex-wrap gap-1.5">
          {steps.map(step => (
            <span
              key={step.id}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold transition-all ${
                step.complete
                  ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20'
                  : step.skipped
                  ? 'bg-muted text-muted-foreground border border-border line-through'
                  : 'bg-card text-muted-foreground border border-border'
              }`}
            >
              {step.complete ? <Check className="w-3 h-3" /> : step.skipped ? <X className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
              {step.label}
            </span>
          ))}
        </div>
        {/* Action area */}
        {allDone && !rewardClaimed ? (
          <button
            onClick={handleClaimReward}
            disabled={claimingReward}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-harvest to-kernel-gold text-white font-bold text-sm hover:brightness-110 transition-all disabled:opacity-60"
          >
            {claimingReward ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
            Claim Free Rank-Up!
          </button>
        ) : !allDone && (
          <p className="mt-3 text-xs text-muted-foreground text-center">
            Head to the <button onClick={() => { window.location.hash = '#home'; }} className="text-harvest font-bold hover:underline">Home page</button> to continue setup
          </p>
        )}
        {result && (
          <SuccessModal type={result.type} title={result.title} message={result.message} helpText={result.helpText} onClose={() => setResult(null)} />
        )}
      </div>
    );
  }

  // ── Full variant (for home page) ──────────────────────────────────
  return (
    <div className="bg-gradient-to-br from-harvest/20 to-harvest/5 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border-2 border-harvest/20 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 mb-5 sm:mb-6">
        {user?.discord_avatar ? (
          <img
            src={user.discord_avatar}
            alt={user.discord_username}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-card shadow-lg"
          />
        ) : (
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-harvest flex items-center justify-center border-4 border-card shadow-lg">
            <span className="text-white font-bold text-xl sm:text-2xl">
              {user?.discord_username?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
        )}
        <div className="flex-1 text-center sm:text-left min-w-0">
          <h2 className="text-lg sm:text-2xl font-bold text-foreground mb-1">
            {allDone ? 'You\'re All Set!' : `Welcome, ${user?.discord_username || 'Player'}!`}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {allDone
              ? 'Your profile is complete. Claim your reward below!'
              : 'Complete your profile to unlock the full rank-up system and earn a free rank.'}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-5 sm:mb-6">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-semibold text-foreground">
            Profile Setup
          </span>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{totalSteps} steps
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-harvest to-kernel-gold transition-all duration-700 rounded-full relative"
            style={{ width: `${progressPct}%` }}
          >
            {progressPct > 0 && (
              <div className="absolute right-0 top-0 bottom-0 w-3 bg-white/30 rounded-full animate-pulse" />
            )}
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, index) => {
          const isExpanded = expandedStep === step.id;
          const isCurrent = currentStep?.id === step.id;
          const isLocked = !step.complete && !step.skipped && currentStep?.id !== step.id && index > steps.findIndex(s => s.id === currentStep?.id);

          return (
            <div
              key={step.id}
              className={`rounded-xl sm:rounded-2xl border-2 transition-all overflow-hidden ${
                step.complete
                  ? 'bg-[#10b981]/5 border-[#10b981]/20'
                  : step.skipped
                  ? 'bg-muted/50 border-border opacity-60'
                  : isCurrent
                  ? 'bg-card border-harvest/30 shadow-md'
                  : 'bg-card/50 border-border'
              }`}
            >
              {/* Step header */}
              <button
                onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                disabled={isLocked}
                className={`w-full flex items-center gap-3 p-3 sm:p-4 text-left transition-colors ${
                  isLocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'
                }`}
              >
                {/* Step indicator */}
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.complete
                    ? 'bg-[#10b981] text-white'
                    : step.skipped
                    ? 'bg-muted text-muted-foreground'
                    : isCurrent
                    ? 'bg-harvest text-white animate-pulse'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {step.complete ? (
                    <Check className="w-4 h-4" />
                  ) : step.skipped ? (
                    <X className="w-3.5 h-3.5" />
                  ) : (
                    step.icon
                  )}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${
                    step.complete ? 'text-[#10b981]' : step.skipped ? 'text-muted-foreground line-through' : 'text-foreground'
                  }`}>
                    {step.label}
                    {step.skippable && !step.complete && !step.skipped && (
                      <span className="text-[10px] font-normal text-muted-foreground ml-2">optional</span>
                    )}
                  </p>
                  {step.complete && (
                    <p className="text-[10px] text-[#10b981]/70">Complete</p>
                  )}
                </div>

                {/* Chevron */}
                {!step.complete && !step.skipped && !isLocked && (
                  isExpanded
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && !step.complete && !step.skipped && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-0">
                  <div className="ml-11 sm:ml-12">
                    <p className="text-xs text-muted-foreground mb-3">{step.description}</p>

                    {/* ── Steam step ────────────── */}
                    {step.id === 'steam' && (
                      <button
                        onClick={() => setOpenDotaModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-80 transition-all"
                      >
                        <Gamepad2 className="w-4 h-4" />
                        Connect Steam / OpenDota
                      </button>
                    )}

                    {/* ── Twitch step ───────────── */}
                    {step.id === 'twitch' && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={handleLinkTwitch}
                          disabled={twitchLinking}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-60"
                          style={{ backgroundColor: '#9146ff' }}
                        >
                          {twitchLinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tv className="w-4 h-4" />}
                          {twitchLinking ? 'Redirecting...' : 'Link Twitch'}
                        </button>
                        <button
                          onClick={handleSkipTwitch}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-border text-muted-foreground text-sm font-semibold hover:bg-muted transition-all"
                        >
                          Skip for now
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* ── Guild step ────────────── */}
                    {step.id === 'guild' && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-3">
                          Guilds are teams within The Corn Field. Your guild determines your badge, colors, and who you rep in Guild Wars. You can switch guilds later from your profile.
                        </p>
                        {loadingGuilds ? (
                          <div className="flex items-center gap-2 py-2">
                            <Loader2 className="w-4 h-4 animate-spin text-harvest" />
                            <span className="text-xs text-muted-foreground">Loading guilds...</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {guilds.map(guild => (
                              <button
                                key={guild.id}
                                onClick={() => handleJoinGuild(guild.id, guild.name)}
                                disabled={joiningGuild}
                                className="flex items-center gap-3 p-3 rounded-xl border-2 border-border hover:shadow-md transition-all text-left group disabled:opacity-60"
                                style={{ '--hover-color': guild.color } as any}
                              >
                                <div
                                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                  style={{ backgroundColor: guild.color }}
                                >
                                  {guild.tag}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-foreground group-hover:opacity-80 transition-colors truncate">
                                    {guild.name}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {guild.member_count} {guild.member_count === 1 ? 'member' : 'members'} · Tap to join
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Claim Reward Section */}
      {allDone && !rewardClaimed && (
        <div className="mt-5 sm:mt-6 bg-gradient-to-r from-[#fbbf24]/20 to-harvest/20 rounded-xl sm:rounded-2xl p-4 sm:p-5 border-2 border-harvest/30">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#fbbf24] to-harvest flex items-center justify-center shadow-lg">
              <Gift className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-0.5">Profile Complete!</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Claim your free rank-up reward for completing all onboarding steps.
              </p>
            </div>
            <button
              onClick={handleClaimReward}
              disabled={claimingReward}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-harvest to-kernel-gold text-white font-bold text-sm hover:brightness-110 hover:shadow-lg hover:shadow-harvest/25 transition-all active:scale-[0.97] disabled:opacity-60 cursor-pointer"
            >
              {claimingReward ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Gift className="w-5 h-5" />
              )}
              {claimingReward ? 'Claiming...' : 'Claim Free Rank-Up'}
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {openDotaModalOpen && (
        <ConnectOpenDotaModal
          onConnect={handleConnectOpenDota}
          onClose={() => setOpenDotaModalOpen(false)}
        />
      )}

      {showRankModal && (
        <RankModal
          loading={rankSubmitting}
          onClose={() => {
            setShowRankModal(false);
            // Still show success for Steam link even if they skip rank
            setResult({
              type: 'success',
              title: 'Steam Connected! 🎮',
              message: 'Your Steam account is linked! You can set your Dota rank later in Profile Settings or during tournament registration.',
            });
          }}
          onSubmit={handleSelfReportRank}
          title="What's Your Dota 2 Rank?"
          subtitle="We couldn't detect your rank from your Steam profile"
          submitLabel="Save Rank"
          showIneligibleWarning={false}
          blockHighRanks={false}
        />
      )}

      {result && (
        <SuccessModal
          type={result.type}
          title={result.title}
          message={result.message}
          helpText={result.helpText}
          onClose={() => setResult(null)}
        />
      )}
    </div>
  );
}