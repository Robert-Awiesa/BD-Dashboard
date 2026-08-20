import { useEffect } from 'react';
import { createPortal } from 'react-dom';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

// The dialog is a flex column capped to the viewport: header and footer stay
// pinned while only the body scrolls, so action buttons can never be pushed
// off-screen by a long form.
const Modal = ({ open, onClose, title, description, children, footer, size = 'md' }) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Lock background scrolling while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  // Portalled to <body>: the app's <main> sets `relative z-0`, which creates a
  // stacking context that would otherwise trap the dialog *below* the fixed
  // sidebar (z-40) and clip it.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-navy-900/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`w-full ${SIZES[size] || SIZES.md} max-h-[calc(100dvh-2rem)] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xl animate-slide-up overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="shrink-0 flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-navy-900 truncate">{title}</h3>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 -mr-1 -mt-1 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xl leading-none cursor-pointer transition-colors"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="shrink-0 px-5 py-3.5 border-t border-slate-200 bg-slate-50">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
