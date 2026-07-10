export function Field({ label, type = 'text', value, onChange, unit, ...props }) {
  return (
    <label className="block">
      <div className="font-mono text-[9.5px] text-fg-dim tracking-[0.1em] mb-1.5">{label}</div>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(type === 'number' ? e.target.valueAsNumber : e.target.value)}
          className="w-full bg-panel-raised border border-hairline rounded-[8px] px-3 py-2.5 text-[13px] text-fg outline-none focus:border-signal transition-colors"
          {...props}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-fg-dim">
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
