import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmColors = {
    danger: 'bg-[#ef4444] hover:bg-[#dc2626] text-white',
    primary: 'bg-[#f97316] hover:bg-[#ea580c] text-white',
    success: 'bg-[#10b981] hover:bg-[#059669] text-white',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#f97316]/10 to-[#f97316]/5 rounded-t-3xl p-6 border-b-2 border-[#f97316]/20">
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center transition-all hover:scale-110"
          >
            <X className="w-5 h-5 text-[#0f172a]" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#f97316]/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#f97316]" />
            </div>
            <h3 className="text-xl font-bold text-[#0f172a]">{title}</h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-[#0f172a]/70 leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 flex gap-3">
          <Button
            onClick={onCancel}
            className="flex-1 bg-[#0f172a]/10 hover:bg-[#0f172a]/20 text-[#0f172a] h-12 rounded-xl font-semibold"
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            className={`flex-1 h-12 rounded-xl font-semibold ${confirmColors[confirmVariant]}`}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
