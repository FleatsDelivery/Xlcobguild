/**
 * MVP Submission Modal — Reusable modal wrapper for MvpSubmissionForm
 *
 * Uses BottomSheetModal + MvpSubmissionForm in 'bare' variant.
 * Can be spawned from any page that wants to offer quick MVP uploads.
 *
 * Usage:
 *   <MvpSubmissionModal
 *     user={user}
 *     onClose={() => setShowMvpModal(false)}
 *     onRefresh={handleRefresh}
 *   />
 */
import { useState } from 'react';
import { TrendingUp, Bell, BellOff } from 'lucide-react';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { MvpSubmissionForm } from '@/app/components/mvp-submission-form';

interface MvpSubmissionModalProps {
  user: any;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
  onBadgeRefresh?: () => void;
}

export function MvpSubmissionModal({ user, onClose, onRefresh, onBadgeRefresh }: MvpSubmissionModalProps) {
  const [notifyDiscord, setNotifyDiscord] = useState(true);

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-2xl">
      <BottomSheetModal.Header gradient="from-[#3b82f6]/10 to-[#3b82f6]/5" borderColor="border-[#3b82f6]/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#3b82f6] flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Submit MVP Request</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Upload an MVP screenshot to rank up yourself or others
            </p>
          </div>
          {/* Discord Notification Toggle */}
          <button
            type="button"
            onClick={() => setNotifyDiscord(!notifyDiscord)}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex-shrink-0 ${
              notifyDiscord
                ? 'bg-[#5865F2]/15 text-[#5865F2] border border-[#5865F2]/30'
                : 'bg-muted text-muted-foreground border border-border'
            }`}
            title={notifyDiscord ? 'Discord notifications ON' : 'Discord notifications OFF'}
          >
            {notifyDiscord ? (
              <Bell className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            ) : (
              <BellOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            )}
            <span className="hidden sm:inline">{notifyDiscord ? 'Discord ON' : 'Discord OFF'}</span>
            {/* Toggle track */}
            <div className={`w-7 h-4 rounded-full relative transition-colors duration-200 ${
              notifyDiscord ? 'bg-[#5865F2]' : 'bg-gray-300'
            }`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                notifyDiscord ? 'translate-x-3.5' : 'translate-x-0.5'
              }`} />
            </div>
          </button>
        </div>
      </BottomSheetModal.Header>
      <BottomSheetModal.Body>
        <MvpSubmissionForm
          user={user}
          onRefresh={onRefresh}
          onBadgeRefresh={onBadgeRefresh}
          variant="bare"
          notifyDiscord={notifyDiscord}
        />
      </BottomSheetModal.Body>
    </BottomSheetModal>
  );
}
