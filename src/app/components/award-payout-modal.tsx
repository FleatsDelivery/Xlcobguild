/**
 * Award Payout Modal — Simplified 2-step financial payout flow
 *
 * Steps: 1. Find User → 2. Amount & Reason → Review & Confirm
 *
 * Focuses on direct "Money Out" via Stripe Connect.
 */
import { useState, useMemo, useCallback, useRef } from 'react';
import {
  User, Search, Loader2, ChevronRight, DollarSign,
  AlertCircle, CheckCircle, Send, PartyPopper, Banknote,
  ShieldCheck, ShieldAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { createPayout } from '@/lib/connect-api';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface AwardPayoutModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface UserSearchResult {
  id: string;
  discord_username: string;
  discord_avatar: string | null;
  stripe_connect_status: string;
  steam_id: string | null;
}

export function AwardPayoutModal({ onClose, onSuccess }: AwardPayoutModalProps) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: User Search
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);

  // Step 2: Details
  const [amountStr, setAmountStr] = useState('');
  const [reason, setReason] = useState('');

  // Confirmation & Success
  const [showConfirm, setShowConfirm] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [errorHeader, setErrorHeader] = useState<string | null>(null);
  const confettiFired = useRef(false);

  // ── Handlers ──

  const searchUsers = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      // Search users table
      const { data, error } = await supabase
        .from('users')
        .select('id, discord_username, discord_avatar, stripe_connect_status, steam_id')
        .ilike('discord_username', `%${term}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data as UserSearchResult[]);
    } catch (err) {
      console.error('User search error:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    searchUsers(val);
  };

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setStep(2);
  };

  const fireSuccessConfetti = useCallback(() => {
    if (confettiFired.current) return;
    confettiFired.current = true;

    const scalar = 2;
    const money = confetti.shapeFromText({ text: '💰', scalar });
    const corn = confetti.shapeFromText({ text: '🌽', scalar });

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      shapes: [money, corn],
      scalar: 1.5,
    });
  }, []);

  const totalCents = useMemo(() => {
    const parsed = parseFloat(amountStr);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100);
  }, [amountStr]);

  const handleSubmit = async () => {
    if (!selectedUser || totalCents <= 0 || !reason.trim()) return;

    setSubmitting(true);
    setErrorHeader(null);
    try {
      await createPayout({
        recipient_user_id: selectedUser.id,
        amount_cents: totalCents,
        reason: reason.trim(),
        role: 'custom', // Payout Manager uses custom role for direct payments
      });

      setIsFinished(true);
      setTimeout(fireSuccessConfetti, 400);
    } catch (err: any) {
      console.error('Payout creation error:', err);
      setErrorHeader(err.message || 'Failed to create payout');
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  // ── Render ──

  if (isFinished) {
    return (
      <BottomSheetModal onClose={onSuccess} maxWidth="max-w-md">
        <div className="py-12 px-6 text-center space-y-4 animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-2">
            <PartyPopper className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-black text-foreground">Payout Awarded!</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Successfully awarded <span className="text-foreground font-bold font-mono">${(totalCents / 100).toFixed(2)}</span> to <span className="text-foreground font-bold">{selectedUser?.discord_username}</span>.
          </p>
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50 max-w-xs mx-auto">
            <p className="text-xs text-muted-foreground italic truncate">"{reason}"</p>
          </div>
          <p className="text-xs text-muted-foreground">The recipient will be notified in their inbox.</p>
          <Button onClick={onSuccess} className="w-full bg-foreground text-background font-bold h-12 rounded-xl mt-4">
            Done
          </Button>
        </div>
      </BottomSheetModal>
    );
  }

  return (
    <BottomSheetModal onClose={submitting ? undefined : onClose} maxWidth="max-w-lg">
      <BottomSheetModal.Header gradient="from-[#10b981]/10 to-[#3b82f6]/10" borderColor="border-[#10b981]/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#3b82f6] flex items-center justify-center shadow-lg">
            <Banknote className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Award Payout</h2>
            <p className="text-xs text-muted-foreground">Step {step} of 2 — {step === 1 ? 'Select Recipient' : 'Payout Details'}</p>
          </div>
        </div>
      </BottomSheetModal.Header>

      <BottomSheetModal.Body>
        <div className="min-h-[300px]">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search user by Discord username..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="pl-10 h-12 rounded-xl border-2 focus-visible:ring-offset-0 focus-visible:ring-0 focus-visible:border-green-500 transition-all font-semibold"
                    autoFocus
                  />
                  {searching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-border hover:border-green-500/50 bg-card hover:bg-green-50/50 dark:hover:bg-green-950/20 transition-all group"
                    >
                      <div className="flex items-center gap-3 truncate">
                        {u.discord_avatar ? (
                          <img src={u.discord_avatar} className="w-10 h-10 rounded-full" alt="" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="text-left truncate">
                          <p className="font-bold text-foreground truncate group-hover:text-green-600 transition-colors">
                            {u.discord_username}
                          </p>
                          <div className="flex items-center gap-2">
                            {u.stripe_connect_status === 'active' ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase">
                                <ShieldCheck className="w-3 h-3" /> Stripe Connected
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500 uppercase">
                                <ShieldAlert className="w-3 h-3" /> Missing Stripe
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </button>
                  ))}

                  {searchTerm.length >= 2 && !searching && searchResults.length === 0 && (
                    <div className="py-8 text-center bg-muted/20 rounded-2xl border-2 border-dashed border-border">
                      <p className="text-sm text-muted-foreground font-medium">No users match your search.</p>
                    </div>
                  )}

                  {!searchTerm && (
                    <div className="py-8 text-center bg-muted/20 rounded-2xl border-2 border-dashed border-border">
                      <User className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground font-medium">Start typing to find a user</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                {/* Back Link */}
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  Change Recipient
                </button>

                {/* Recipient Snapshot */}
                <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-2xl border border-border/50">
                  <div className="relative">
                    {selectedUser?.discord_avatar ? (
                      <img src={selectedUser.discord_avatar} className="w-14 h-14 rounded-2xl border-2 border-white dark:border-slate-800 shadow-md" alt="" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                        <User className="w-7 h-7 text-slate-400" />
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                      {selectedUser?.stripe_connect_status === 'active' ? (
                        <ShieldCheck className="w-4 h-4 text-green-500" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-tight">Recipient</p>
                    <p className="text-lg font-black text-foreground truncate">{selectedUser?.discord_username}</p>
                    {selectedUser?.stripe_connect_status !== 'active' && (
                      <p className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full inline-block mt-1">
                        Cannot pay until Connect is set up
                      </p>
                    )}
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-[#10b981] ml-1">Amount (USD)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[#10b981]" />
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={amountStr}
                        onChange={(e) => setAmountStr(e.target.value)}
                        className="h-14 pl-12 text-2xl font-black rounded-2xl border-2 border-border focus-visible:border-[#10b981] transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-[#3b82f6] ml-1">Payout Note</label>
                    <textarea
                      placeholder="e.g. Winner of the Saturday night cast party..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full min-h-[100px] p-4 rounded-2xl border-2 border-border bg-input-background text-sm text-foreground focus:outline-none focus:border-[#3b82f6] transition-all font-semibold resize-none"
                    />
                  </div>
                </div>

                {errorHeader && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-900 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">{errorHeader}</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </BottomSheetModal.Body>

      <BottomSheetModal.Footer>
        <div className="flex gap-3 w-full">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1 h-12 rounded-xl text-muted-foreground font-bold"
          >
            Cancel
          </Button>
          {step === 2 && (
            <Button
              onClick={() => setShowConfirm(true)}
              disabled={submitting || totalCents <= 0 || !reason.trim()}
              className="flex-[2] h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black shadow-lg shadow-green-500/20 group"
            >
              <Send className="w-4 h-4 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              Award Payout
            </Button>
          )}
        </div>
      </BottomSheetModal.Footer>

      {/* ── Confirmation Overlay ── */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <div className="bg-card w-full max-w-sm rounded-[2rem] border-2 border-slate-700 p-8 text-center space-y-6 shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto ring-8 ring-green-500/20">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black text-foreground mb-2">Final Review</h3>
                <p className="text-sm text-muted-foreground">
                  You are sending <span className="font-mono text-foreground font-bold">${(totalCents / 100).toFixed(2)}</span> to <span className="text-foreground font-bold">{selectedUser?.discord_username}</span>.
                </p>
                <div className="mt-4 p-3 bg-muted/50 rounded-xl border border-border/50">
                  <p className="text-xs text-muted-foreground italic truncate">"{reason}"</p>
                </div>
              </div>

              {selectedUser?.stripe_connect_status !== 'active' && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <p className="text-[10px] font-bold text-amber-600 leading-tight">
                    NOTE: User hasn't finished Stripe setup. They will see the award but cannot be paid until they connect.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Send'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowConfirm(false)}
                  className="w-full h-10 rounded-xl text-muted-foreground font-bold"
                >
                  Go Back
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </BottomSheetModal>
  );
}
