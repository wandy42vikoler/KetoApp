import { X } from 'lucide-react'

export default function SheetHeader({ title, onBack, onClose }) {
  return (
    <div className="flex justify-between items-center px-4 pt-4 pb-2">
      {onBack ? (
        <button onClick={onBack} className="bg-transparent border-none text-fg-muted font-mono text-[11px]">
          ‹ BACK
        </button>
      ) : (
        <span />
      )}
      <div className="font-mono text-[11px] tracking-[0.1em] text-fg-dim">{title}</div>
      <button onClick={onClose} className="bg-transparent border-none text-fg-muted">
        <X size={16} />
      </button>
    </div>
  )
}
