export default function Stat({ label, value, unit, colorClass = 'text-fg', mono = true }) {
  return (
    <div className="text-center">
      <div className="font-mono text-[9.5px] text-fg-dim tracking-[0.1em] mb-[3px]">{label}</div>
      <div className={`${mono ? 'font-mono' : 'font-sans'} text-[14.5px] font-semibold ${colorClass}`}>
        {value}
        {unit && <span className="text-[10.5px] text-fg-dim"> {unit}</span>}
      </div>
    </div>
  )
}
