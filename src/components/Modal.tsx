import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, size = 'lg' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    const keydown = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[aria-modal="true"]');
      if (dialogs[dialogs.length - 1] !== dialogRef.current) return;
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') || []).filter(element => element.getClientRects().length);
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto animate-fade-in">
      <div className="flex min-h-[100dvh] items-end sm:items-center justify-center p-2 sm:p-4">
        {/* Backdrop com blur */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300"
          onClick={onClose}
        />
        
        {/* Modal Content */}
        <div
          ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
          className={`relative glass rounded-2xl sm:rounded-3xl shadow-premium-lg w-full ${sizeClasses[size]} max-h-[92dvh] sm:max-h-[92vh] overflow-hidden animate-scale-in`}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b px-6 sm:px-8 py-4 sm:py-5 flex items-center justify-between z-10">
            <h2 id={titleId} className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              aria-label={`Fechar ${title}`}
              className="group relative p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-all duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 sm:p-8 overflow-y-auto max-h-[calc(92dvh-80px)] sm:max-h-[calc(92vh-80px)]">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
