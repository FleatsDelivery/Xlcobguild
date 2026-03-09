import { AlertTriangle, X, Loader2, Trash2 } from '@/lib/icons';
import { Button } from '@/app/components/ui/button';

interface SecondaryAction {
  text: string;
  variant: 'danger' | 'primary' | 'success';
  onAction?: () => void;
}

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary' | 'success';
  /** When true, shows a spinner on the active button and disables all buttons */
  loading?: boolean;
  /** Text to show on the active button while loading. Defaults to 'Working...' */
  loadingText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional secondary destructive action (e.g. "Delete Entirely" alongside "Remove from Tournament") */
  secondaryAction?: SecondaryAction;
}

export function ConfirmModal({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  loading = false,
  loadingText = 'Working...',
  onConfirm,
  onCancel,
  secondaryAction,
}: ConfirmModalProps) {
  const variantColors = {
    danger: 'bg-error hover:bg-[#c13a3a] text-white',
    primary: 'bg-harvest hover:bg-amber text-white',
    success: 'bg-[#10b981] hover:bg-[#059669] text-white',
  };

  const secondaryColors: Record<string, string> = {
    danger: 'bg-transparent hover:bg-error/10 text-error border-2 border-error/30 hover:border-error/50',
    primary: 'bg-transparent hover:bg-harvest/10 text-harvest border-2 border-harvest/30 hover:border-harvest/50',
    success: 'bg-transparent hover:bg-[#10b981]/10 text-[#10b981] border-2 border-[#10b981]/30 hover:border-[#10b981]/50',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={loading ? undefined : onCancel}>
      <div className="bg-card rounded-3xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="relative bg-gradient-to-br from-harvest/10 to-harvest/5 rounded-t-3xl p-6 border-b-2 border-harvest/20">
          <button
            onClick={onCancel}
            disabled={loading}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-card/80 hover:bg-card flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-harvest/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-harvest" />
            </div>
            <h3 className="text-xl font-bold text-foreground">{title}</h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{message}</p>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 space-y-3">
          {/* Primary + Cancel row */}
          <div className="flex gap-3">
            <Button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 bg-muted hover:bg-muted/80 text-foreground h-12 rounded-xl font-semibold disabled:opacity-50"
            >
              {cancelText}
            </Button>
            <Button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 h-12 rounded-xl font-semibold ${variantColors[confirmVariant]} disabled:opacity-70`}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {loadingText}</>
              ) : (
                confirmText
              )}
            </Button>
          </div>

          {/* Secondary action — outlined destructive button, full width */}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onAction || (() => {})}
              disabled={loading}
              className={`w-full h-10 rounded-xl font-semibold text-sm ${secondaryColors[secondaryAction.variant] || secondaryColors.danger} disabled:opacity-50`}
            >
              {loading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> {loadingText}</>
              ) : (
                <><Trash2 className="w-3.5 h-3.5 mr-2" /> {secondaryAction.text}</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
