import { useState } from 'react'
import { Camera, Dumbbell, ClipboardList, ChevronRight } from 'lucide-react'
import CheckIn from './CheckIn'
import MealLog from './MealLog'

const OPTIONS = [
  { id: 'meal', label: 'Log Meal', sub: 'Photo → editable macros', icon: Camera, disabled: false },
  { id: 'workout', label: 'Log Workout', sub: 'Photo, manual, or Strava — next pass', icon: Dumbbell, disabled: true },
  { id: 'checkin', label: 'Check-In', sub: 'Scale photo or manual', icon: ClipboardList, disabled: false },
]

export default function LogSheet({ onClose, onCheckinSaved, onMealSaved }) {
  const [mode, setMode] = useState(null)

  if (mode === 'checkin') {
    return <CheckIn onBack={() => setMode(null)} onClose={onClose} onSaved={onCheckinSaved} />
  }

  if (mode === 'meal') {
    return <MealLog onBack={() => setMode(null)} onClose={onClose} onSaved={onMealSaved} />
  }

  return (
    <div className="absolute inset-0 bg-black/70 flex items-end z-20">
      <div className="w-full bg-panel border-t border-hairline-lit rounded-t-[20px] px-4 pt-2.5 pb-7">
        <div className="w-9 h-1 bg-hairline-lit rounded-full mx-auto mb-4.5" />
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => !o.disabled && setMode(o.id)}
            disabled={o.disabled}
            className={`w-full flex items-center gap-3 bg-panel-raised border border-hairline rounded-[12px] px-3.5 py-3.5 mb-2.5 ${
              o.disabled ? 'opacity-40' : ''
            }`}
          >
            <div
              className={`w-9 h-9 rounded-[9px] flex items-center justify-center flex-shrink-0 ${
                o.disabled ? 'bg-hairline' : 'bg-signal-dim'
              }`}
            >
              <o.icon size={16} className={o.disabled ? 'text-fg-dim' : 'text-signal'} />
            </div>
            <div className="text-left flex-1">
              <div className="text-[13.5px] text-fg font-semibold">{o.label}</div>
              <div className="font-mono text-[10.5px] text-fg-dim">{o.sub}</div>
            </div>
            {!o.disabled && <ChevronRight size={15} className="text-fg-dim" />}
          </button>
        ))}
        <button onClick={onClose} className="w-full bg-transparent border-none text-fg-muted font-mono text-[11.5px] py-2 mt-0.5">
          CANCEL
        </button>
      </div>
    </div>
  )
}
