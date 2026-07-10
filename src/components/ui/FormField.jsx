export function Field({ label, type = 'text', value, onChange, unit, className = '', ...props }) {
  return (
    <label className="block">
      <div className="font-mono text-[9.5px] text-fg-dim tracking-[0.1em] mb-1.5">{label}</div>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(type === 'number' ? e.target.valueAsNumber : e.target.value)}
          className={`w-full bg-panel-raised border border-hairline rounded-[8px] px-3 py-2.5 text-[13px] text-fg outline-none focus:border-signal transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
            unit ? 'pr-10' : ''
          } ${className}`}
          {...props}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-fg-dim pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </label>
  )
}

export function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="font-mono text-[9.5px] text-fg-dim tracking-[0.1em] mb-1.5">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-panel-raised border border-hairline rounded-[8px] px-3 py-2.5 text-[13px] text-fg outline-none focus:border-signal transition-colors appearance-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function SliderField({ label, value, onChange, min = 1, max = 10 }) {
  return (
    <label className="block">
      <div className="flex justify-between font-mono text-[9.5px] text-fg-dim tracking-[0.1em] mb-1.5">
        <span>{label}</span>
        <span className="text-signal">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-signal)]"
      />
    </label>
  )
}

export const ACTIVITY_LEVELS = [
  { value: 'low', label: 'LOW', numeric: 3, desc: '0–2 sessions / week · under 90 min total' },
  { value: 'moderate', label: 'MODERATE', numeric: 6, desc: '3–4 sessions / week · 90–240 min total' },
  { value: 'high', label: 'HIGH', numeric: 9, desc: '5+ sessions / week · 240+ min total' },
]

export function ActivityLevelField({ label = 'ACTIVITY LEVEL (BASELINE)', value, onChange }) {
  return (
    <div>
      <div className="font-mono text-[9.5px] text-fg-dim tracking-[0.1em] mb-2">{label}</div>
      <div className="flex flex-col gap-2">
        {ACTIVITY_LEVELS.map((opt) => {
          const active = value === opt.value
          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`text-left rounded-[8px] border px-3 py-2.5 transition-colors ${
                active ? 'border-signal bg-signal-dim/40' : 'border-hairline bg-panel-raised'
              }`}
            >
              <div className={`font-mono text-[11.5px] font-bold ${active ? 'text-signal' : 'text-fg'}`}>
                {opt.label}
              </div>
              <div className="font-mono text-[10px] text-fg-dim mt-0.5">{opt.desc}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
