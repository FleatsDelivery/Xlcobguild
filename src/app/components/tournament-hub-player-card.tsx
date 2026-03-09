/**
 * PlayerCard — Unified player/coach card for Tournament Hub
 *
 * Used in the Players tab, Teams tab roster grids, and Overview tab.
 * Renders a clickable card with avatar, rank, badges, and optional
 * invite / remove buttons. Supports captain and coach indicators.
 */

import { Send, Loader2, Crown, GraduationCap, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { getRankDisplay } from '@/lib/rank-utils';
import { TcfPlusAvatarRing } from '@/app/components/tcf-plus-avatar-ring';
import { TcfPlusBadge } from '@/app/components/tcf-plus-badge';
import { RankBadge } from '@/app/components/rank-badge';

export interface PlayerCardProps {
  registration: any;
  user?: any;
  sendingInvite?: string | null;
  showInviteButton?: boolean;
  inviteTeamId?: string;
  onInvite?: (teamId: string, personId: string, personName: string) => void;
  onSelect?: (registration: any) => void;
  /** Person ID of the team captain — shows crown badge on matching card */
  captainId?: string;
  /** Render as a coach card (green accent, coach badge instead of rank row) */
  isCoach?: boolean;
  /** Show a remove button (captain managing roster) */
  onRemove?: () => void;
  /** If true, shows an edit button on unranked badges for officer rank override */
  isOfficer?: boolean;
  /** Called when officer clicks the unranked badge edit button */
  onRankOverride?: (userId: string, displayName: string, currentMedal?: string | null, currentStars?: number) => void;
}

export function PlayerCard({
  registration,
  user,
  sendingInvite,
  showInviteButton,
  inviteTeamId,
  onInvite,
  onSelect,
  captainId,
  isCoach,
  onRemove,
  isOfficer,
  onRankOverride,
}: PlayerCardProps) {
  const person = registration.person;
  const linkedUser = registration.linked_user;
  const rank = getRankDisplay(linkedUser?.opendota_data?.badge_rank || linkedUser?.badge_rank);
  const avatar = linkedUser?.discord_avatar || person?.avatar_url;
  const displayName = person?.display_name || linkedUser?.discord_username || 'Unknown';
  const isFirstTimer = registration.is_first_timer;
  const isSelf = user && registration.user_id === user.id;
  const isCaptain = captainId && person?.id === captainId;
  const isClickable = !!onSelect;
  const isSelfReported = linkedUser?.opendota_data?.badge_rank?.self_reported || linkedUser?.opendota_data?.badge_rank?.officer_override;

  // Border accent: coach green, captain gold, self gold, default neutral
  const borderClass = isCoach
    ? 'border-[#10b981]/30 hover:border-[#10b981]/50'
    : isCaptain
      ? 'border-harvest/40 hover:border-harvest/60'
      : isSelf
        ? 'border-harvest/40 ring-2 ring-harvest/20'
        : 'border-border hover:border-[#3b82f6]/30 hover:shadow-md';

  return (
    <div
      className={`relative bg-card rounded-2xl border-2 transition-all overflow-hidden ${isClickable ? 'cursor-pointer' : ''} ${borderClass}`}
      onClick={isClickable ? () => onSelect(registration) : undefined}
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <TcfPlusAvatarRing active={linkedUser?.tcf_plus_active} size="sm">
            {avatar ? (
              <img src={avatar} alt={displayName} className="w-12 h-12 rounded-full border-2 border-border flex-shrink-0" width={48} height={48} />
            ) : (
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isCoach ? 'bg-gradient-to-br from-[#10b981] to-[#059669]' : 'bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6]'}`}>
                <span className="text-white text-lg font-bold">{displayName.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </TcfPlusAvatarRing>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-foreground truncate">{displayName}</span>
              {linkedUser?.tcf_plus_active && <TcfPlusBadge size="xs" />}
              {isSelf && (
                <span className="px-2 py-0.5 rounded-full bg-harvest/10 text-harvest text-xs font-bold">YOU</span>
              )}
            </div>

            {/* Badges Row */}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {isCaptain && (
                <span className="text-xs text-harvest font-bold flex items-center gap-0.5">
                  <Crown className="w-3 h-3" /> Capt
                </span>
              )}
              {isCoach && (
                <span className="text-xs text-[#10b981] font-bold flex items-center gap-0.5">
                  <GraduationCap className="w-3 h-3" /> Coach
                </span>
              )}
              {rank ? (
                <span className="inline-flex items-center gap-1">
                  <RankBadge medal={rank.medal} stars={rank.stars} size="sm" showLabel showStars />
                  {isOfficer && onRankOverride && linkedUser?.id && isSelfReported && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRankOverride(
                          linkedUser.id,
                          displayName,
                          rank.medal,
                          rank.stars,
                        );
                      }}
                      className="w-5 h-5 rounded-full bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 flex items-center justify-center transition-colors flex-shrink-0"
                      title="Edit rank (Officer)"
                    >
                      <Pencil className="w-2.5 h-2.5 text-[#f59e0b]" />
                    </button>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <RankBadge medal="Unranked" stars={0} size="sm" showLabel />
                  {isOfficer && onRankOverride && linkedUser?.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRankOverride(
                          linkedUser.id,
                          displayName,
                          linkedUser?.opendota_data?.badge_rank?.medal,
                          linkedUser?.opendota_data?.badge_rank?.stars,
                        );
                      }}
                      className="w-5 h-5 rounded-full bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 flex items-center justify-center transition-colors flex-shrink-0"
                      title="Set rank (Officer)"
                    >
                      <Pencil className="w-2.5 h-2.5 text-[#f59e0b]" />
                    </button>
                  )}
                </span>
              )}
              {isFirstTimer && (
                <span className="px-2 py-0.5 rounded-full bg-[#f59e0b]/10 text-[#f59e0b] text-xs font-bold">
                  ✨ NEW
                </span>
              )}
              {linkedUser?.prestige_level > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#8b5cf6]/10 text-[#8b5cf6] text-xs font-semibold">
                  P{linkedUser.prestige_level}
                </span>
              )}
              {registration.status === 'on_team' && registration.team?.team_name && (
                <span className="px-2 py-0.5 rounded-full bg-[#8b5cf6]/10 text-[#8b5cf6] text-xs font-semibold truncate max-w-[100px]">
                  {registration.team.team_name}
                </span>
              )}
              {isCoach && registration.coaching_team_name && (
                <span className="px-2 py-0.5 rounded-full bg-[#10b981]/10 text-[#10b981] text-xs font-semibold truncate max-w-[120px]">
                  {registration.coaching_team_name}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {showInviteButton && inviteTeamId && onInvite && !isSelf && (
            <Button
              onClick={(e) => { e.stopPropagation(); onInvite(inviteTeamId, person.id, displayName); }}
              disabled={sendingInvite === person.id}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-xl h-9 px-3 text-sm font-bold flex-shrink-0"
            >
              {sendingInvite === person.id ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 mr-1" />
              )}
              Invite
            </Button>
          )}
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="text-muted-foreground hover:text-[#ef4444] transition-colors p-1.5 rounded-lg hover:bg-[#ef4444]/10 flex-shrink-0"
              title="Remove from roster"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}