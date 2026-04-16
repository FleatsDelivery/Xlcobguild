/**
 * Profile Page — Guild Wars Tab
 *
 * Contains: Rank progression, My Guilds manager (placeholder), and action buttons.
 */
import { useState } from 'react';
import { Swords, Plus, LogOut, Lock, TrendingUp, Award } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { MvpSubmissionModal } from '@/app/components/mvp-submission-modal';
import { PopEmoji } from '@/app/components/pop-emoji';
import { ProfileGuildManager } from '@/app/components/profile-guild-manager';

interface ProfilePageGuildWarsProps {
  user: any;
  onSignOut: () => void;
  onRefresh?: () => Promise<void>;
  onBadgeRefresh?: () => void;
}

// ═══════════════════════════════════════════════════════
// RANK DATA
// ═══════════════════════════════════════════════════════

const RANK_EMOJIS = [
  '\u{1F41B}', // 1. Earwig
  '\u{1F98C}', // 2. Ugandan Kob
  '\u{1F33D}', // 3. Private Maize
  '\u{1F944}', // 4. Specialist Ingredient
  '\u{1F35E}', // 5. Corporal Corn Bread
  '\u{1F33E}', // 6. Sergeant Husk
  '\u{1F33B}', // 7. Sergeant Major Fields
  '\u{1F3AF}', // 8. Captain Cornhole
  '\u2B50',    // 9. Major Cob
  '\u{1F31F}', // 10. Corn Star
  '\u{1F4A5}', // 11. Pop'd Kernel (prestige 5 only)
];

const RANK_NAMES = [
  'Earwig', 'Ugandan Kob', 'Private Maize', 'Specialist Ingredient',
  'Corporal Corn Bread', 'Sergeant Husk', 'Sergeant Major Fields',
  'Captain Cornhole', 'Major Cob', 'Corn Star', "Pop'd Kernel",
];

const PRESTIGE_LEVELS = [1, 2, 3, 4, 5] as const;

export function ProfilePageGuildWars({ user, onSignOut, onRefresh, onBadgeRefresh }: ProfilePageGuildWarsProps) {
  const [hoveredRank, setHoveredRank] = useState<number | null>(null);
  const [hoveredPrestige, setHoveredPrestige] = useState<number | null>(null);
  const [showMvpModal, setShowMvpModal] = useState(false);

  const currentRankId = user?.rank_id || 1;
  const prestigeLevel = user?.prestige_level || 0;
  const maxRanks = prestigeLevel === 5 ? 11 : 10;
  const displayRanks = prestigeLevel === 5 ? 11 : 10;

  return (
    <div className="space-y-4">
      {/* ═══ Header Stats/Actions Row ═══ */}
      {user?.role !== 'guest' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Upload MVP Button */}
          <button
            onClick={() => setShowMvpModal(true)}
            className="bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8] text-white rounded-2xl p-4 sm:p-5 border-2 border-[#3b82f6]/30 transition-all hover:shadow-lg hover:shadow-[#3b82f6]/20 group text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 group-hover:bg-white/30 transition-colors">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm sm:text-base font-bold">Upload MVP</p>
                  <p className="text-[11px] sm:text-xs text-white/70">Submit a screenshot to rank up</p>
                </div>
              </div>
              <div className="text-white/60 group-hover:text-white/90 transition-colors text-xl">
                +
              </div>
            </div>
          </button>

          {/* MVP Count Card */}
          <div className="bg-card rounded-2xl p-4 sm:p-5 border-2 border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Award className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm sm:text-base font-bold text-foreground">MVP Count</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground">My 2026 MVP Count</p>
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-500 tabular-nums">
              {user?.mvp_count ?? 0}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Your Guild Rank Progress ═══ */}
      {user?.role !== 'guest' && (
        <div className="bg-card rounded-2xl p-5 sm:p-6 border-2 border-border">
          <h2 className="text-lg font-bold text-foreground mb-0.5">Your Guild Rank Progress</h2>
          <p className="text-xs text-muted-foreground mb-5">
            Rank {currentRankId}/{maxRanks}{prestigeLevel > 0 ? ` \u2022 Prestige ${prestigeLevel}` : ''}
          </p>

          {/* Prestige Progression */}
          <div className="mb-5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Prestige Level</p>
            <div className="flex items-center gap-2 sm:gap-3">
              {PRESTIGE_LEVELS.map((level) => {
                const isAchieved = prestigeLevel >= level;
                const isCurrent = prestigeLevel === level;
                const emoji = level === 5 ? '\u{1F4A5}' : '\u{1F31F}';
                return (
                  <div
                    key={`prestige-${level}`}
                    className="relative flex flex-col items-center"
                    onMouseEnter={() => setHoveredPrestige(level)}
                    onMouseLeave={() => setHoveredPrestige(null)}
                  >
                    {isAchieved ? (
                      <PopEmoji emoji={emoji} unlocked sizeClass="text-2xl sm:text-3xl">
                        <span className={`text-2xl sm:text-3xl leading-none drop-shadow-lg ${isCurrent ? 'scale-110 sm:scale-125' : ''
                          }`}>
                          {emoji}
                        </span>
                      </PopEmoji>
                    ) : (
                      <div
                        className={`text-2xl sm:text-3xl transition-all duration-200 cursor-default opacity-25 scale-90 grayscale ${hoveredPrestige === level ? '!scale-[1.5] drop-shadow-lg !opacity-100 !grayscale-0' : ''
                          }`}
                      >
                        {emoji}
                      </div>
                    )}
                    <div className={`h-1 w-8 sm:w-10 rounded-full mt-1.5 ${isAchieved ? 'bg-harvest' : 'bg-border'}`} />
                    {hoveredPrestige === level && (
                      <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap z-10 shadow-lg pointer-events-none">
                        Prestige {level}{isCurrent ? ' (Current)' : isAchieved ? ' \u2713' : ''}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rank Progression */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Guild Rank</p>
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              {Array.from({ length: displayRanks }).map((_, index) => {
                const rankNumber = index + 1;
                const isUnlocked = rankNumber <= currentRankId;
                const isCurrent = rankNumber === currentRankId;
                const emoji = RANK_EMOJIS[index];
                return (
                  <div
                    key={rankNumber}
                    className="relative flex flex-col items-center"
                    onMouseEnter={() => setHoveredRank(index)}
                    onMouseLeave={() => setHoveredRank(null)}
                  >
                    {isUnlocked ? (
                      <PopEmoji emoji={emoji} unlocked sizeClass="text-xl sm:text-2xl">
                        <span className={`text-xl sm:text-2xl leading-none drop-shadow-lg ${isCurrent ? 'scale-125' : ''
                          }`}>
                          {emoji}
                        </span>
                      </PopEmoji>
                    ) : (
                      <div
                        className={`text-xl sm:text-2xl transition-all duration-200 cursor-default scale-90 opacity-30 ${hoveredRank === index ? '!scale-[1.6] drop-shadow-lg' : ''
                          }`}
                      >
                        {emoji}
                      </div>
                    )}
                    <div className={`h-1 w-5 sm:w-8 rounded-full mt-1.5 ${isUnlocked ? 'bg-harvest' : 'bg-border'}`} />
                    {hoveredRank === index && (
                      <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap z-10 shadow-lg pointer-events-none">
                        {RANK_NAMES[index]}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ My Guild Manager ═══ */}
      <ProfileGuildManager user={user} onRefresh={onRefresh} />

      {/* ═══ Actions ═══ */}
      <div className="bg-card rounded-2xl p-5 sm:p-6 border-2 border-border">
        <Button
          onClick={onSignOut}
          className="w-full bg-red-500 hover:bg-red-600 text-white h-11 rounded-xl font-semibold"
        >
          <LogOut className="mr-2 h-5 w-5" />
          Sign Out
        </Button>
      </div>

      {/* MVP Submission Modal */}
      {showMvpModal && (
        <MvpSubmissionModal
          user={user}
          onClose={() => setShowMvpModal(false)}
          onRefresh={onRefresh}
          onBadgeRefresh={onBadgeRefresh}
        />
      )}
    </div>
  );
}
