export default function MacroBar({ label, value, target, unit }) {
  const pct = Math.min(100, (value / target) * 100)
  const over = value > target
  const barColor = over ? 'bg-alert' : pct > 85 ? 'bg-caution' : 'bg-info'
  const valueColor = over ? 'text-alert' : 'text-fg'

  return (
    <div className="mb-3">
      <div className="flex justify-between font-mono text-[11.5px] mb-1.5">
        <span className="text-fg-muted tracking-wide">{label}</span>
        <span className={valueColor}>
          {value}
          <span className="text-fg-dim"> / {target}{unit}</span>
        </span>
      </div>
      <div className="h-[5px] bg-[#1B211F] rounded-[3px] overflow-hidden">
        <div
          className={`h-full rounded-[3px] transition-[width] duration-300 ease-out ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
