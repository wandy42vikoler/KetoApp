const SIGNAL = 'var(--color-signal)'
const HAIRLINE = 'var(--color-hairline)'
const HAIRLINE_LIT = 'var(--color-hairline-lit)'
const SIGNAL_GLOW = 'color-mix(in srgb, var(--color-signal) 55%, transparent)'

export default function ProtocolDial({ start, goal, current }) {
  const size = 240
  const cx = size / 2
  const cy = size / 2
  const rOuter = 104
  const rInner = 92
  const sweep = 270
  const startAngle = -225
  const totalLoss = start - goal
  const lost = start - current
  const pct = totalLoss > 0 ? Math.max(0, Math.min(1, lost / totalLoss)) : 0

  const polar = (r, angleDeg) => {
    const a = ((angleDeg - 90) * Math.PI) / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }

  const arcPath = (r, fromDeg, toDeg) => {
    const [x1, y1] = polar(r, fromDeg)
    const [x2, y2] = polar(r, toDeg)
    const large = toDeg - fromDeg > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  const ticks = []
  const tickCount = 27
  for (let i = 0; i <= tickCount; i++) {
    const deg = startAngle + (sweep * i) / tickCount
    const major = i % 3 === 0
    const [x1, y1] = polar(rInner - (major ? 10 : 5), deg)
    const [x2, y2] = polar(rInner, deg)
    const litUp = i / tickCount <= pct
    ticks.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={litUp ? SIGNAL : HAIRLINE_LIT}
        strokeWidth={major ? 2 : 1}
        strokeLinecap="round"
        opacity={litUp ? 0.9 : 0.55}
      />
    )
  }

  const endDeg = startAngle + sweep * pct
  const [needleX, needleY] = polar((rOuter + rInner) / 2, endDeg)

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path
          d={arcPath(rOuter, startAngle, startAngle + sweep)}
          fill="none"
          stroke={HAIRLINE}
          strokeWidth={1.5}
        />
        <path
          d={arcPath((rOuter + rInner) / 2, startAngle, endDeg)}
          fill="none"
          stroke={SIGNAL}
          strokeWidth={6}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${SIGNAL_GLOW})` }}
        />
        {ticks}
        <circle
          cx={needleX}
          cy={needleY}
          r={5}
          fill={SIGNAL}
          style={{ filter: `drop-shadow(0 0 5px ${SIGNAL})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-mono text-[11px] text-fg-dim tracking-[0.1em] mb-0.5">PROGRESS</div>
        <div className="font-mono text-[40px] font-bold text-fg leading-none">
          {(pct * 100).toFixed(0)}
          <span className="text-xl text-fg-muted">%</span>
        </div>
        <div className="font-mono text-[11.5px] text-signal mt-1.5">
          −{lost.toFixed(2)}kg <span className="text-fg-dim">/ {totalLoss.toFixed(0)}kg</span>
        </div>
      </div>
    </div>
  )
}
