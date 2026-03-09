/**
 * Invite Player Modal — Bottom-sheet modal for inviting free agents
 *
 * Launched from the My Team tab. Uses BottomSheetModal for consistent spring animation.
 * Blue accent theme matching the player invite visual language.
 *
 * Features:
 *   - Auto-focused search bar
 *   - Results filtered to exclude already-invited players
 *   - Per-row loading states on invite buttons
 *   - "Sent ✓" flash state after successful invite
 *   - Invite counter for the session
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  UserPlus, Send, Loader2, X, CheckCircle, Search, AlertTriangle, Users,
} from '@/lib/icons';
import { Button } from '@/app/components/ui/button';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { getRankDisplay, getMedalColor } from '@/lib/rank-utils';
import { TcfPlusAvatarRing } from '@/app/components/tcf-plus-avatar-ring';
import { TcfPlusBadge } from '@/app/components/tcf-plus-badge';

interface InvitePlayerModalProps {
  teamId: string;
  teamName: string;
  freeAgents: any[];
  /** Person IDs of players with pending invites (to filter out) */
  pendingInvitePersonIds: Set<string>;
  sendingInvite: string | null;
  /** Whether the last invite succeeded (true), failed (false), or hasn't completed (null) */
  lastInviteSuccess: boolean | null;
  onInvite: (teamId: string, personId: string, personName: string) => void;
  onClose: () => void;
}

export function InvitePlayerModal({
  teamId, teamName, freeAgents, pendingInvitePersonIds,
  sendingInvite, lastInviteSuccess, onInvite, onClose,
}: InvitePlayerModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Track recently-sent invites for "Sent ✓" flash
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sessionCount, setSessionCount] = useState(0);
  const prevSendingRef = useRef<string | null>(null);

  // Detect when sendingInvite clears → means invite completed
  useEffect(() => {
    const prev = prevSendingRef.current;
    if (prev && !sendingInvite && lastInviteSuccess === true) {
      // The invite for `prev` just completed SUCCESSFULLY
      setSentIds(s => new Set(s).add(prev));
      setSessionCount(c => c + 1);
      // Clear the flash after 2.5s
      const timer = setTimeout(() => {
        setSentIds(s => {
          const next = new Set(s);
          next.delete(prev);
          return next;
        });
      }, 2500);
      return () => clearTimeout(timer);
    }
    prevSendingRef.current = sendingInvite;
  }, [sendingInvite, lastInviteSuccess]);

  // Auto-focus search on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  // Filter: exclude players with pending invites or recently sent
  const availableAgents = freeAgents.filter((fa: any) =>
    !pendingInvitePersonIds.has(fa.person?.id)
  );

  const matches = query.trim().length > 0
    ? availableAgents.filter((fa: any) => {
        const name = (fa.person?.display_name || '').toLowerCase();
        const discord = (fa.linked_user?.discord_username || '').toLowerCase();
        return name.includes(query.toLowerCase()) || discord.includes(query.toLowerCase());
      }).slice(0, 8)
    : availableAgents.slice(0, 6); // Show first 6 as suggestions when no query

  const handleInvite = useCallback((personId: string, personName: string) => {
    onInvite(teamId, personId, personName);
  }, [teamId, onInvite]);

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-lg">
      <BottomSheetModal.Header
        gradient="from-[#3b82f6]/10 to-[#3b82f6]/5"
        borderColor="border-[#3b82f6]/20"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#3b82f6]/15 flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-[#3b82f6]" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-black text-foreground">Invite Player</h3>
            <p className="text-sm text-muted-foreground">
              Search free agents for <span className="font-semibold text-foreground">{teamName}</span>
            </p>
          </div>
        </div>
        {sessionCount > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-[#10b981] font-bold">
            <CheckCircle className="w-3.5 h-3.5" />
            {sessionCount} invite{sessionCount !== 1 ? 's' : ''} sent this session
          </div>
        )}
      </BottomSheetModal.Header>

      <BottomSheetModal.Body>
        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name..."
              className="w-full h-11 pl-10 pr-10 rounded-xl border-2 border-[#3b82f6]/20 focus:border-[#3b82f6] bg-card text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-[#3b82f6]/15 transition-all"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Section Label */}
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            {query.trim() ? `Results (${matches.length})` : `Suggested (${Math.min(availableAgents.length, 6)} of ${availableAgents.length})`}
          </p>

          {/* Results List */}
          {matches.length > 0 ? (
            <div className="space-y-1.5">
              {matches.map((fa: any) => {
                const p = fa.person;
                const lu = fa.linked_user;
                const avatar = lu?.discord_avatar || p?.avatar_url;
                const dName = p?.display_name || lu?.discord_username || 'Unknown';
                const rank = getRankDisplay(lu?.opendota_data?.badge_rank || lu?.badge_rank);
                const isLoading = sendingInvite === p.id;
                const wasSent = sentIds.has(p.id);

                return (
                  <div
                    key={fa.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      wasSent
                        ? 'bg-[#10b981]/5 border-[#10b981]/20'
                        : 'bg-card border-border hover:border-[#3b82f6]/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <TcfPlusAvatarRing active={lu?.tcf_plus_active} size="xs">
                        {avatar ? (
                          <img src={avatar} alt={dName} className="w-10 h-10 rounded-full border border-border flex-shrink-0" width={40} height={40} />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-white">{dName.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                      </TcfPlusAvatarRing>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-foreground text-sm truncate">{dName}</p>
                          {lu?.tcf_plus_active && <TcfPlusBadge size="xs" />}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {rank ? (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${getMedalColor(rank.medal)}15`, color: getMedalColor(rank.medal) }}
                            >
                              {rank.medal}{rank.stars > 0 ? ` [${rank.stars}]` : ''}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#f59e0b]/10 text-[#f59e0b] flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> Unranked
                            </span>
                          )}
                          {fa.is_first_timer && (
                            <span className="text-[10px] font-bold text-[#f59e0b]">✨ NEW</span>
                          )}
                          {lu?.prestige_level > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#8b5cf6]/10 text-[#8b5cf6]">
                              P{lu.prestige_level}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Invite Button with states */}
                    {wasSent ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-[#10b981] bg-[#10b981]/10 px-3 py-1.5 rounded-lg flex-shrink-0">
                        <CheckCircle className="w-3.5 h-3.5" /> Sent
                      </span>
                    ) : (
                      <Button
                        onClick={() => handleInvite(p.id, dName)}
                        disabled={isLoading || !!sendingInvite}
                        className="bg-[#3b82f6] hover:bg-[#2563eb] text-white h-9 px-4 rounded-lg text-xs font-bold flex-shrink-0 min-w-[80px] transition-all"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <><Send className="w-3 h-3 mr-1.5" /> Invite</>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground font-semibold">
                {query.trim() ? `No free agents matching "${query}"` : 'No free agents available'}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {query.trim() ? 'Try a different search' : 'All registered players are already on teams'}
              </p>
            </div>
          )}
        </div>
      </BottomSheetModal.Body>

      <BottomSheetModal.Footer>
        <Button
          onClick={onClose}
          className="w-full h-11 rounded-xl font-bold bg-muted text-foreground hover:bg-muted/80"
        >
          Done
        </Button>
      </BottomSheetModal.Footer>
    </BottomSheetModal>
  );
}