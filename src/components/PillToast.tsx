import { createPortal } from 'react-dom'
import { usePillToast, type PillToastVariant } from '@/hooks/usePillToast'

const VARIANT_BG: Record<PillToastVariant, string> = {
  default: '#333333',
  success: '#1e8e3e',
  warning: '#f9ab00',
  info: '#1a73e8',
}

export function PillToast() {
  const message = usePillToast((s) => s.message)
  const variant = usePillToast((s) => s.variant)
  if (typeof document === 'undefined') return null
  if (message == null) return null

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="animate-pill-toast-in"
      style={{
        position: 'fixed',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 5000,
        backgroundColor: VARIANT_BG[variant],
        color: '#ffffff',
        padding: '12px 24px',
        borderRadius: 30,
        fontSize: 14,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        maxWidth: '90%',
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {message}
    </div>,
    document.body,
  )
}
