import { CheckCircle, XCircle, AlertCircle, ArrowRight, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

interface SuccessModalProps {
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  helpText?: string;
  actionText?: string;
  onClose: () => void;
}

export function SuccessModal({
  type,
  title,
  message,
  helpText,
  actionText = 'Got it!',
  onClose,
}: SuccessModalProps) {
  const config = {
    success: {
      icon: CheckCircle,
      bgColor: 'from-[#10b981]/10 to-[#10b981]/5',
      borderColor: 'border-[#10b981]/20',
      iconBg: 'bg-[#10b981]/20',
      iconColor: 'text-[#10b981]',
      buttonColor: 'bg-[#10b981] hover:bg-[#059669]',
    },
    error: {
      icon: XCircle,
      bgColor: 'from-[#ef4444]/10 to-[#ef4444]/5',
      borderColor: 'border-[#ef4444]/20',
      iconBg: 'bg-[#ef4444]/20',
      iconColor: 'text-[#ef4444]',
      buttonColor: 'bg-[#ef4444] hover:bg-[#dc2626]',
    },
    info: {
      icon: AlertCircle,
      bgColor: 'from-[#3b82f6]/10 to-[#3b82f6]/5',
      borderColor: 'border-[#3b82f6]/20',
      iconBg: 'bg-[#3b82f6]/20',
      iconColor: 'text-[#3b82f6]',
      buttonColor: 'bg-[#3b82f6] hover:bg-[#2563eb]',
    },
  };

  const { icon: Icon, bgColor, borderColor, iconBg, iconColor, buttonColor } = config[type];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`relative bg-gradient-to-br ${bgColor} rounded-t-3xl p-6 border-b-2 ${borderColor}`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center transition-all hover:scale-110"
          >
            <X className="w-5 h-5 text-field-dark" />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className={`w-16 h-16 rounded-full ${iconBg} flex items-center justify-center mb-4`}>
              <Icon className={`w-8 h-8 ${iconColor}`} />
            </div>
            <h3 className="text-2xl font-bold text-field-dark">{title}</h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <p className="text-field-dark/70 leading-relaxed mb-4">{message}</p>
          
          {helpText && (
            <div className={`bg-gradient-to-br ${bgColor} rounded-2xl p-4 border-2 ${borderColor}`}>
              <div className="flex items-start gap-2">
                <ArrowRight className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
                <p className="text-sm text-field-dark/70 text-left">{helpText}</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 pt-0">
          <Button
            onClick={onClose}
            className={`w-full h-12 rounded-xl font-semibold text-white ${buttonColor}`}
          >
            {actionText}
          </Button>
        </div>
      </div>
    </div>
  );
}