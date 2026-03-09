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
import { TrendingUp } from 'lucide-react';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { MvpSubmissionForm } from '@/app/components/mvp-submission-form';

interface MvpSubmissionModalProps {
  user: any;
  onClose: () => void;
  onRefresh?: () => Promise<void>;
  onBadgeRefresh?: () => void;
}

export function MvpSubmissionModal({ user, onClose, onRefresh, onBadgeRefresh }: MvpSubmissionModalProps) {
  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-2xl">
      <BottomSheetModal.Header gradient="from-[#3b82f6]/10 to-[#3b82f6]/5" borderColor="border-[#3b82f6]/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#3b82f6] flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Submit MVP Request</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Upload an MVP screenshot to rank up yourself or others
            </p>
          </div>
        </div>
      </BottomSheetModal.Header>
      <BottomSheetModal.Body>
        <MvpSubmissionForm
          user={user}
          onRefresh={onRefresh}
          onBadgeRefresh={onBadgeRefresh}
          variant="bare"
        />
      </BottomSheetModal.Body>
    </BottomSheetModal>
  );
}
