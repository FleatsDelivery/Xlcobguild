/**
 * Invite Coach Modal — Bottom-sheet modal for inviting registered coaches
 *
 * Launched from the My Team tab. Uses BottomSheetModal for consistent spring animation.
 * Green accent theme matching the coach visual language throughout the app.
 *
 * Features:
 *   - Auto-focused search bar
 *   - Per-row loading states on invite buttons
 *   - "Sent ✓" flash state after successful invite
 *   - Green theme matching registration flow coach styling
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GraduationCap, Send, Loader2, X, CheckCircle, Search,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { getRankDisplay, getMedalColor } from '@/lib/rank-utils';
import { TcfPlusAvatarRing } from '@/app/components/tcf-plus-avatar-ring';
import { TcfPlusBadge } from '@/app/components/tcf-plus-badge';

interface InviteCoachModalProps {
  teamId: string;
  teamName: string;
  availableCoaches: any[];
  sendingInvite: string | null;
  /** Whether the last invite succeeded (true), failed (false), or hasn't completed (null) */
  lastInviteSuccess: boolean | null;
  onInvite: (teamId: string, personId: string, personName: string, inviteRole: 'coach') => void;
  onClose: () => void;
}

export function InviteCoachModal({
  teamId, teamName, availableCoaches,
  sendingInvite, lastInviteSuccess, onInvite, onClose,
}: InviteCoachModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Track recently-sent invite for "Sent ✓" flash
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const prevSendingRef = useRef<string | null>(null);

  // Detect when sendingInvite clears → invite completed
  useEffect(() => {
    const prev = prevSendingRef.current;
    if (prev && !sendingInvite && lastInviteSuccess === true) {
      setSentIds(s => new Set(s).add(prev));
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

  const matches = query.trim().length > 0
    ? availableCoaches.filter((c: any) => {
        const name = (c.person?.display_name || '').toLowerCase();
        const discord = (c.linked_user?.discord_username || '').toLowerCase();
        return name.includes(query.toLowerCase()) || discord.includes(query.toLowerCase());
      }).slice(0, 8)
    : availableCoaches.slice(0, 6);

  const handleInvite = useCallback((personId: string, personName: string) => {
    onInvite(teamId, personId, personName, 'coach');
  }, [teamId, onInvite]);

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-lg">
      <BottomSheetModal.Header
        gradient="from-[#10b981]/10 to-[#10b981]/5"
        borderColor="border-[#10b981]/20"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#10b981]/15 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-[#10b981]" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-black text-foreground">Invite Coach</h3>
            <p className="text-sm text-muted-foreground">
              Search available coaches for <span className="font-semibold text-foreground">{teamName}</span>
            </p>
          </div>
        </div>
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
              placeholder="Search coaches by name..."
              className="w-full h-11 pl-10 pr-10 rounded-xl border-2 border-[#10b981]/20 focus:border-[#10b981] bg-card text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-[#10b981]/15 transition-all"
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
            {query.trim() ? `Results (${matches.length})` : `Available Coaches (${availableCoaches.length})`}
          </p>

          {/* Results List */}
          {matches.length > 0 ? (
            <div className="space-y-1.5">
              {matches.map((coach: any) => {
                const p = coach.person;
                const lu = coach.linked_user;
                const avatar = lu?.discord_avatar || p?.avatar_url;
                const dName = p?.display_name || lu?.discord_username || 'Unknown';
                const rank = getRankDisplay(lu?.opendota_data?.badge_rank || lu?.badge_rank);
                const isLoading = sendingInvite === p.id;
                const wasSent = sentIds.has(p.id);

                return (
                  <div
                    key={coach.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      wasSent
                        ? 'bg-[#10b981]/5 border-[#10b981]/20'
                        : 'bg-card border-border hover:border-[#10b981]/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <TcfPlusAvatarRing active={lu?.tcf_plus_active} size="xs">
                        {avatar ? (
                          <img src={avatar} alt={dName} className="w-10 h-10 rounded-full border-2 border-[#10b981]/20 flex-shrink-0" width={40} height={40} />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#10b981]/15 flex items-center justify-center flex-shrink-0">
                            <GraduationCap className="w-5 h-5 text-[#10b981]" />
                          </div>
                        )}
                      </TcfPlusAvatarRing>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-foreground text-sm truncate">{dName}</p>
                          {lu?.tcf_plus_active && <TcfPlusBadge size="xs" />}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-[#10b981] font-bold">Coach</span>
                          {rank && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${getMedalColor(rank.medal)}15`, color: getMedalColor(rank.medal) }}
                            >
                              {rank.medal}{rank.stars > 0 ? ` [${rank.stars}]` : ''}
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
                        className="bg-[#10b981] hover:bg-[#059669] text-white h-9 px-4 rounded-lg text-xs font-bold flex-shrink-0 min-w-[80px] transition-all"
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
              <GraduationCap className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground font-semibold">
                {query.trim() ? `No coaches matching "${query}"` : 'No coaches available'}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {query.trim() ? 'Try a different search' : 'All registered coaches are already assigned to teams'}
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