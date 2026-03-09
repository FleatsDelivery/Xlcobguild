/**
 * Ticket Meter Section — Battle Cup-style ticket contributions
 *
 * Model:
 * - TCF+ members (players + coach) automatically contribute 1 free ticket each
 * - The dropdown controls wallet-only contributions on top of the free ticket
 * - Total team tickets = sum(wallet contributions) + count(TCF+ members incl. coach)
 * - Team needs exactly `min_team_size` total to lock in
 * - TCF+ Full Coverage: if tcfPlusFreeCount >= ticketsRequired, no wallet tickets needed
 * - Wallet balances are only validated/deducted at lock-in (ready up), not per-contribution
 */

import { useState } from 'react';
import { Lock, Ticket, Loader2, Check, ChevronDown, AlertTriangle, Sparkles, GraduationCap, Crown } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { TcfPlusAvatarRing } from '@/app/components/tcf-plus-avatar-ring';

export interface TicketMeterProps {
  myTeam: any;
  tournament: any;
  roster: any[] | undefined;
  /** Coach's linked user data (from teamCoachData[teamId]) */
  coachData: any;
  isMutable: boolean;
  handleSetContribution: (teamId: string, personId: string, tickets: number) => void;
  settingContribution: string | null;
  handleTeamReady: (teamId: string, teamName: string) => void;
}

export function TicketMeterSection({
  myTeam, tournament, roster, coachData, isMutable,
  handleSetContribution, settingContribution, handleTeamReady,
}: TicketMeterProps) {
  const ticketsRequired = tournament.min_team_size || 5;
  const isReady = myTeam.approval_status === 'ready';
  const isApproved = myTeam.approval_status === 'approved';

  const hasCoach = !!myTeam.coach;
  const coachIsTcfPlus = !!coachData?.tcf_plus_active;
  const captainPersonId = myTeam.captain?.id || myTeam.captain_person_id;

  // TCF+ auto-tickets: roster members + coach
  const rosterTcfPlusCount = roster
    ? roster.filter((r: any) => !!r.linked_user?.tcf_plus_active).length
    : 0;
  const tcfPlusFreeCount = rosterTcfPlusCount + (coachIsTcfPlus ? 1 : 0);

  // Wallet contributions from roster + coach
  const rosterWalletContributed = roster
    ? roster.reduce((sum: number, r: any) => sum + (r.tickets_contributed || 0), 0)
    : 0;
  const coachWalletContributed = myTeam.coach_tickets_contributed || 0;
  const walletContributed = rosterWalletContributed + coachWalletContributed;

  // TCF+ Full Coverage: if enough TCF+ members, no wallet tickets needed at all
  const isFullyCovered = tcfPlusFreeCount >= ticketsRequired;

  // For display: effective total capped at ticketsRequired for the meter when fully covered
  const effectiveTotal = isFullyCovered
    ? ticketsRequired + walletContributed // wallet excess shows as over
    : walletContributed + tcfPlusFreeCount;

  const rosterCount = roster?.length || 0;
  const rosterShort = rosterCount < ticketsRequired;
  const meterPct = ticketsRequired > 0 ? Math.min((Math.min(effectiveTotal, ticketsRequired) / ticketsRequired) * 100, 100) : 0;

  // When fully covered: meter is full if no wallet excess, otherwise over-limit
  const isMeterFull = isFullyCovered
    ? walletContributed === 0 && !rosterShort
    : effectiveTotal === ticketsRequired && !rosterShort;
  const isOverLimit = isFullyCovered
    ? walletContributed > 0
    : effectiveTotal > ticketsRequired;

  // How many wallet tickets are needed (0 when fully covered)
  const walletTicketsNeeded = isFullyCovered ? 0 : Math.max(0, ticketsRequired - tcfPlusFreeCount);

  // If team is already ready — show locked state
  if (isReady) {
    return (
      <div className="pt-3 border-t border-border">
        <div className="bg-harvest/5 rounded-xl border-2 border-harvest/30 p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-harvest/15 flex items-center justify-center flex-shrink-0">
              <Lock className="w-5 h-5 text-harvest" />
            </div>
            <div>
              <p className="font-black text-foreground">Team Locked In</p>
              <p className="text-xs text-muted-foreground">
                {isFullyCovered
                  ? 'Your team is ready for the tournament. Fully covered by TCF+ memberships!'
                  : 'Your team is ready for the tournament. Tickets have been consumed.'}
              </p>
            </div>
          </div>
          <div className="h-3 bg-harvest/20 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-harvest transition-all duration-500" style={{ width: '100%' }} />
          </div>
          <p className="text-xs font-bold text-harvest mt-2 text-center">{ticketsRequired}/{ticketsRequired} tickets</p>
        </div>
      </div>
    );
  }

  // If team is not approved yet — don't show ticket section
  if (!isApproved) return null;

  // If roster hasn't loaded yet
  if (!roster) return null;

  return (
    <div className="pt-3 border-t border-border">
      <div className={`rounded-xl border-2 p-4 sm:p-5 transition-all ${
        isOverLimit
          ? 'bg-error/5 border-error/30'
          : isMeterFull
            ? 'bg-harvest/5 border-harvest/30'
            : 'bg-card border-border'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-harvest" />
            <h5 className="text-sm font-bold text-foreground">Ticket Pool</h5>
          </div>
          <span className={`text-sm font-black ${
            isOverLimit
              ? 'text-error'
              : isMeterFull
                ? 'text-harvest'
                : 'text-muted-foreground'
          }`}>
            {isFullyCovered && walletContributed === 0
              ? `${ticketsRequired}/${ticketsRequired}`
              : `${effectiveTotal}/${ticketsRequired}`
            }
          </span>
        </div>

        {/* TCF+ Full Coverage Banner */}
        {isFullyCovered && (
          <div className={`flex items-center gap-2.5 rounded-xl p-3 mb-3 ${
            walletContributed > 0
              ? 'bg-error/5 border border-error/20'
              : 'bg-harvest/10 border border-harvest/20'
          }`}>
            <Sparkles className={`w-5 h-5 flex-shrink-0 ${walletContributed > 0 ? 'text-error' : 'text-harvest'}`} />
            <div>
              {walletContributed > 0 ? (
                <>
                  <p className="text-sm font-bold text-error">Remove wallet contributions</p>
                  <p className="text-xs text-error/80">
                    Your team has {tcfPlusFreeCount} TCF+ member{tcfPlusFreeCount !== 1 ? 's' : ''} — that fully covers the {ticketsRequired} tickets needed. Remove {walletContributed} wallet ticket{walletContributed !== 1 ? 's' : ''} to lock in.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-harvest">Fully Covered by TCF+</p>
                  <p className="text-xs text-muted-foreground">
                    {tcfPlusFreeCount} TCF+ member{tcfPlusFreeCount !== 1 ? 's' : ''} cover{tcfPlusFreeCount === 1 ? 's' : ''} all {ticketsRequired} tickets. No wallet contributions needed!
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* TCF+ auto-ticket summary (when NOT fully covered) */}
        {!isFullyCovered && tcfPlusFreeCount > 0 && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] font-bold text-harvest bg-harvest/10 px-2 py-0.5 rounded-full">
              {tcfPlusFreeCount} free from TCF+
            </span>
            {walletTicketsNeeded > 0 && walletContributed < walletTicketsNeeded && (
              <span className="text-[10px] text-muted-foreground">
                · {walletTicketsNeeded - walletContributed} more from wallets
              </span>
            )}
          </div>
        )}

        {/* Over-limit error banner (non-fully-covered case) */}
        {isOverLimit && !isFullyCovered && (
          <div className="flex items-center gap-2 bg-error/10 border border-error/20 rounded-lg p-3 mb-4">
            <AlertTriangle className="w-4 h-4 text-error flex-shrink-0" />
            <p className="text-xs font-semibold text-error">
              Too many tickets! Remove {effectiveTotal - ticketsRequired} to lock in.
            </p>
          </div>
        )}

        {/* Meter Bar */}
        <div className="h-3 bg-muted rounded-full overflow-hidden mb-4">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isOverLimit
                ? 'bg-error'
                : isMeterFull
                  ? 'bg-harvest'
                  : 'bg-[#3b82f6]'
            }`}
            style={{ width: `${meterPct}%` }}
          />
        </div>

        {/* Per-member contribution rows */}
        {!isFullyCovered || walletContributed > 0 ? (
          <div className="space-y-2 mb-4">
            {roster.map((r: any) => {
              // Calculate remaining wallet slots for this player's team cap
              const othersWallet = roster
                .filter((o: any) => o.person?.id !== r.person?.id)
                .reduce((sum: number, o: any) => sum + (o.tickets_contributed || 0), 0)
                + coachWalletContributed;
              const remainingWalletSlots = Math.max(0, walletTicketsNeeded - othersWallet);

              return (
                <ContributionRow
                  key={r.id}
                  personId={r.person?.id}
                  name={r.person?.display_name || r.linked_user?.discord_username || 'Unknown'}
                  avatar={r.linked_user?.discord_avatar || r.person?.avatar_url}
                  isTcfPlus={!!r.linked_user?.tcf_plus_active}
                  currentContribution={r.tickets_contributed || 0}
                  walletBalance={r.linked_user?.kkup_tickets || 0}
                  isCoach={false}
                  isCaptain={r.person?.id === captainPersonId}
                  teamId={myTeam.id}
                  isMutable={isMutable}
                  forceZero={isFullyCovered}
                  handleSetContribution={handleSetContribution}
                  settingContribution={settingContribution}
                  walletCap={remainingWalletSlots}
                />
              );
            })}
            {/* Coach contribution row */}
            {hasCoach && coachData && (
              <ContributionRow
                key={`coach-${myTeam.id}`}
                personId={myTeam.coach?.id}
                name={coachData.discord_username || myTeam.coach?.display_name || 'Coach'}
                avatar={coachData.discord_avatar || myTeam.coach?.avatar_url}
                isTcfPlus={coachIsTcfPlus}
                currentContribution={coachWalletContributed}
                walletBalance={coachData.kkup_tickets || 0}
                isCoach={true}
                isCaptain={false}
                teamId={myTeam.id}
                isMutable={isMutable}
                forceZero={isFullyCovered}
                handleSetContribution={handleSetContribution}
                settingContribution={settingContribution}
                walletCap={Math.max(0, walletTicketsNeeded - (walletContributed - coachWalletContributed))}
              />
            )}
          </div>
        ) : (
          /* Fully covered and no excess — show compact member list */
          <div className="space-y-1.5 mb-4">
            {roster.map((r: any) => (
              <CompactMemberRow
                key={r.id}
                name={r.person?.display_name || r.linked_user?.discord_username || 'Unknown'}
                avatar={r.linked_user?.discord_avatar || r.person?.avatar_url}
                isTcfPlus={!!r.linked_user?.tcf_plus_active}
                isCoach={false}
                isCaptain={r.person?.id === captainPersonId}
              />
            ))}
            {hasCoach && coachData && (
              <CompactMemberRow
                key={`coach-${myTeam.id}`}
                name={coachData.discord_username || myTeam.coach?.display_name || 'Coach'}
                avatar={coachData.discord_avatar || myTeam.coach?.avatar_url}
                isTcfPlus={coachIsTcfPlus}
                isCoach={true}
                isCaptain={false}
              />
            )}
          </div>
        )}

        {/* Team Ready button */}
        {isMutable && (
          <div>
            {rosterShort ? (
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <p className="text-sm text-muted-foreground font-semibold">
                  Need at least {ticketsRequired} players to lock in — currently have {rosterCount}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  Invite {ticketsRequired - rosterCount} more player{ticketsRequired - rosterCount !== 1 ? 's' : ''} to your roster.
                </p>
              </div>
            ) : isMeterFull ? (
              <Button
                onClick={() => handleTeamReady(myTeam.id, myTeam.team_name)}
                className="w-full h-12 bg-gradient-to-r from-harvest to-kernel-gold hover:from-harvest/90 hover:to-kernel-gold/90 text-soil font-black rounded-xl text-base shadow-lg shadow-harvest/20 transition-all"
              >
                <Lock className="w-5 h-5 mr-2" /> Lock In Team
              </Button>
            ) : isOverLimit ? (
              <div className="bg-error/10 rounded-xl p-3 text-center border border-error/20">
                <p className="text-sm text-error font-semibold">
                  {isFullyCovered
                    ? `Remove all ${walletContributed} wallet ticket${walletContributed !== 1 ? 's' : ''} — TCF+ has it covered`
                    : `Can't lock in — ${effectiveTotal - ticketsRequired} excess ticket${effectiveTotal - ticketsRequired !== 1 ? 's' : ''}`
                  }
                </p>
                <p className="text-xs text-error/70 mt-0.5">
                  {isFullyCovered
                    ? 'Your team is fully covered by TCF+ memberships. No wallet tickets needed.'
                    : `Reduce wallet contributions so the total equals ${ticketsRequired}.`
                  }
                </p>
              </div>
            ) : (
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <p className="text-sm text-muted-foreground font-semibold">
                  Need {ticketsRequired - effectiveTotal} more ticket{ticketsRequired - effectiveTotal !== 1 ? 's' : ''} to lock in
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// Compact member row — used when fully covered (no dropdowns needed)
// ═══════════════════════════════════════════════════════

function CompactMemberRow({ name, avatar, isTcfPlus, isCoach, isCaptain }: {
  name: string;
  avatar: string | null | undefined;
  isTcfPlus: boolean;
  isCoach: boolean;
  isCaptain: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-lg bg-harvest/5 border border-harvest/15">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <TcfPlusAvatarRing active={isTcfPlus} size="xs">
          {avatar ? (
            <img src={avatar} alt={name} className="w-7 h-7 rounded-full border border-border" width={28} height={28} />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">{name.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </TcfPlusAvatarRing>
        <div className="min-w-0 flex items-center gap-1.5">
          <p className="text-sm font-semibold text-foreground truncate">{name}</p>
          {isCaptain && (
            <span className="text-[9px] font-bold text-harvest bg-harvest/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0">
              <Crown className="w-2.5 h-2.5" /> Capt
            </span>
          )}
          {isCoach && (
            <span className="text-[9px] font-bold text-[#10b981] bg-[#10b981]/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0">
              <GraduationCap className="w-2.5 h-2.5" /> Coach
            </span>
          )}
        </div>
      </div>
      <span className="text-xs font-bold text-harvest bg-harvest/10 px-2 py-1 rounded-lg flex items-center gap-1 flex-shrink-0">
        {isTcfPlus ? (
          <><Sparkles className="w-3 h-3" /> Free</>
        ) : (
          <><Ticket className="w-3 h-3" /> Covered</>
        )}
      </span>
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// Per-member contribution row (players + coach)
// ═══════════════════════════════════════════════════════

function ContributionRow({
  personId, name, avatar, isTcfPlus, currentContribution, walletBalance,
  isCoach, isCaptain, teamId, isMutable, forceZero,
  handleSetContribution, settingContribution, walletCap,
}: {
  personId: string;
  name: string;
  avatar: string | null | undefined;
  isTcfPlus: boolean;
  currentContribution: number;
  walletBalance: number;
  isCoach: boolean;
  isCaptain: boolean;
  teamId: string;
  isMutable: boolean;
  /** When true (fully covered), dropdowns should show 0 and prompt removal */
  forceZero: boolean;
  handleSetContribution: (teamId: string, personId: string, tickets: number) => void;
  settingContribution: string | null;
  walletCap: number;
}) {
  const [selectedAmount, setSelectedAmount] = useState<number>(currentContribution);
  const [showDropdown, setShowDropdown] = useState(false);
  const isToggling = settingContribution === personId;
  const hasUnsavedChange = selectedAmount !== currentContribution;

  // Dropdown shows 0 through full walletBalance (scrollable).
  // Options above the team walletCap are greyed out to prevent over-contributing.
  const options: number[] = [];
  for (let i = 0; i <= walletBalance; i++) {
    options.push(i);
  }

  const handleConfirm = () => {
    handleSetContribution(teamId, personId, selectedAmount);
    setShowDropdown(false);
  };

  // Total this member contributes (free + wallet)
  const memberTotal = (isTcfPlus ? 1 : 0) + currentContribution;

  // When fully covered and member has wallet contribution, highlight as needing removal
  const needsRemoval = forceZero && currentContribution > 0;

  return (
    <div
      className={`flex items-center justify-between p-2.5 sm:p-3 rounded-lg border transition-all ${
        needsRemoval
          ? 'bg-error/5 border-error/20'
          : memberTotal > 0
            ? 'bg-harvest/5 border-harvest/20'
            : 'bg-background border-border'
      }`}
    >
      {/* Member info with TCF+ ring on avatar */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <TcfPlusAvatarRing active={isTcfPlus} size="xs">
          {avatar ? (
            <img src={avatar} alt={name} className="w-8 h-8 rounded-full border border-border" width={32} height={32} />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center">
              <span className="text-[11px] font-bold text-white">{name.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </TcfPlusAvatarRing>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground truncate">{name}</p>
            {isCaptain && (
              <span className="text-[9px] font-bold text-harvest bg-harvest/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0">
                <Crown className="w-2.5 h-2.5" /> Capt
              </span>
            )}
            {isCoach && (
              <span className="text-[9px] font-bold text-[#10b981] bg-[#10b981]/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0">
                <GraduationCap className="w-2.5 h-2.5" /> Coach
              </span>
            )}
          </div>
          <p className={`text-[10px] ${needsRemoval ? 'text-error font-semibold' : 'text-muted-foreground'}`}>
            {needsRemoval
              ? `Remove ${currentContribution} wallet ticket${currentContribution !== 1 ? 's' : ''}`
              : isTcfPlus && currentContribution > 0
                ? `1 free + ${currentContribution} from wallet`
                : isTcfPlus
                  ? '1 free'
                  : currentContribution > 0
                    ? `${currentContribution} from wallet`
                    : ''
            }
          </p>
        </div>
      </div>

      {/* Wallet ticket selector */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isMutable ? (
          <>
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                disabled={isToggling || walletBalance === 0}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all min-w-[52px] justify-between ${
                  walletBalance === 0
                    ? 'bg-muted/50 text-muted-foreground/40 border-border cursor-not-allowed'
                    : needsRemoval
                      ? 'bg-error/10 text-error border-error/30'
                      : hasUnsavedChange
                        ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30'
                        : currentContribution > 0
                          ? 'bg-harvest/10 text-harvest border-harvest/30'
                          : 'bg-muted text-muted-foreground border-border hover:border-harvest/30'
                }`}
              >
                <Ticket className="w-3 h-3" />
                <span>{selectedAmount}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                  <div className="absolute right-0 bottom-full mb-1 z-50 bg-popover border-2 border-border rounded-lg shadow-xl py-1 min-w-[56px] max-h-60 overflow-y-auto">
                    {options.map((n) => {
                      // When fully covered, only 0 is allowed
                      const isOverCap = forceZero ? n > 0 : n > walletCap;
                      return (
                        <button
                          key={n}
                          onClick={() => {
                            if (!isOverCap) {
                              setSelectedAmount(n);
                              setShowDropdown(false);
                            }
                          }}
                          disabled={isOverCap}
                          className={`w-full text-center px-3 py-1.5 text-xs font-bold transition-colors ${
                            isOverCap
                              ? 'text-muted-foreground/30 cursor-not-allowed'
                              : n === selectedAmount
                                ? 'bg-harvest/10 text-harvest'
                                : 'text-foreground hover:bg-muted'
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {hasUnsavedChange && (
              <button
                onClick={handleConfirm}
                disabled={isToggling}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white transition-all shadow-sm"
                title="Apply contribution"
              >
                {isToggling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </button>
            )}
          </>
        ) : (
          /* Read-only */
          <span className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 ${
            memberTotal > 0 ? 'text-harvest bg-harvest/10' : 'text-muted-foreground bg-muted/50'
          }`}>
            <Ticket className="w-3 h-3" /> {memberTotal}
          </span>
        )}
      </div>
    </div>
  );
}
