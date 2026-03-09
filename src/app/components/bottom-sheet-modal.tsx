/**
 * BottomSheetModal — Reusable bottom-sheet modal wrapper
 *
 * The standard pattern for "important" modals in the app.
 * Springs up from the bottom of the viewport with a smooth animation.
 *
 * Features:
 *   - Spring animation (slides up from bottom)
 *   - Backdrop click to close
 *   - Escape key to close
 *   - Background scroll lock
 *   - Mobile drag handle
 *   - Dark mode via semantic tokens (bg-card, text-foreground, border-border)
 *   - Configurable max width
 *
 * Usage:
 *   <BottomSheetModal onClose={handleClose} maxWidth="max-w-2xl">
 *     <BottomSheetModal.Header>
 *       ... header content ...
 *     </BottomSheetModal.Header>
 *     <BottomSheetModal.Body>
 *       ... scrollable body ...
 *     </BottomSheetModal.Body>
 *     <BottomSheetModal.Footer>
 *       ... action buttons ...
 *     </BottomSheetModal.Footer>
 *   </BottomSheetModal>
 *
 * For simple modals that don't need sub-sections:
 *   <BottomSheetModal onClose={handleClose}>
 *     ... any content ...
 *   </BottomSheetModal>
 */

import { useEffect, Children, cloneElement, isValidElement, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

// ════════════════════════════════════════════��══════════
// TYPES
// ═══════════════════════════════════════════════════════

interface BottomSheetModalProps {
  onClose: () => void;
  children: ReactNode;
  /** Tailwind max-width class. Default: 'max-w-2xl' */
  maxWidth?: string;
  /** z-index class. Default: 'z-40' */
  zIndex?: string;
}

interface HeaderProps {
  children: ReactNode;
  /** Optional gradient classes for the header background.
   *  Default: 'from-harvest/10 to-harvest/5' with 'border-harvest/20' */
  gradient?: string;
  /** Optional border color. Default: 'border-harvest/20' */
  borderColor?: string;
  /** Hide the close X button (rare — only if you handle close yourself). Default: false */
  hideClose?: boolean;
  onClose?: () => void;
}

interface BodyProps {
  children: ReactNode;
  /** Additional classes on the body container */
  className?: string;
}

interface FooterProps {
  children: ReactNode;
  /** Additional classes on the footer container */
  className?: string;
}

// ═══════════════════════════════════════════════════════
// HEADER — gradient banner at top, with close button
// ══════════════════════════════════════════════════════

function Header({
  children,
  gradient = 'from-harvest/10 to-harvest/5',
  borderColor = 'border-harvest/20',
  hideClose = false,
  onClose,
}: HeaderProps) {
  return (
    <div className={`relative bg-gradient-to-br ${gradient} rounded-t-3xl p-4 sm:p-6 border-b-2 ${borderColor} flex-shrink-0`}>
      {/* Mobile drag handle */}
      <div className="sm:hidden w-10 h-1 bg-foreground/20 rounded-full mx-auto mb-3" />

      {/* Close button */}
      {!hideClose && onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-full bg-card/80 hover:bg-card flex items-center justify-center transition-all hover:scale-110 z-10"
        >
          <X className="w-5 h-5 text-foreground" />
        </button>
      )}

      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// BODY — scrollable content area
// ═══════════════════════════════════════════════════════

function Body({ children, className = '' }: BodyProps) {
  return (
    <div className={`p-4 sm:p-6 overflow-y-auto flex-1 ${className}`}>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// FOOTER — sticky action bar at bottom
// ═══════════════════════════════════════════════════════

function Footer({ children, className = '' }: FooterProps) {
  return (
    <div className={`p-4 sm:p-6 pt-0 pb-6 sm:pb-8 flex-shrink-0 ${className}`}>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN SHELL — backdrop, spring animation, scroll lock
// ═══════════════════════════════════════════════════════

export function BottomSheetModal({
  onClose,
  children,
  maxWidth = 'max-w-2xl',
  zIndex = 'z-40',
}: BottomSheetModalProps) {

  // Escape key listener
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Lock background scroll
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Clone children to inject onClose into Header sub-components
  // so the X button works automatically
  const enhancedChildren = injectCloseIntoHeaders(children, onClose);

  return (
    <div className={`fixed inset-0 ${zIndex} flex flex-col justify-end`}>
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />

      {/* Card — springs up from behind the bottom nav */}
      <motion.div
        className={`relative w-full ${maxWidth} mx-auto`}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 24,
          mass: 0.8,
        }}
      >
        <div className="bg-card rounded-t-3xl shadow-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden mx-0 sm:mx-4 sm:pb-20">
          {enhancedChildren}
        </div>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

/**
 * Walk through children and inject `onClose` into any <BottomSheetModal.Header>
 * that doesn't already have an onClose prop. This way consumers don't need to
 * pass onClose twice (once to the shell, once to the header).
 */
function injectCloseIntoHeaders(children: ReactNode, onClose: () => void): ReactNode {
  return Children.map(children, (child: any) => {
    if (isValidElement(child) && (child as any).type === Header) {
      const existing = (child as any).props.onClose;
      if (!existing) {
        return cloneElement(child as any, { onClose });
      }
    }
    return child;
  });
}

// ═══════════════════════════════════════════════════════
// ATTACH SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

BottomSheetModal.Header = Header;
BottomSheetModal.Body = Body;
BottomSheetModal.Footer = Footer;