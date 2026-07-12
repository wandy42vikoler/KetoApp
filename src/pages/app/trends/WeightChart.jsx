import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts'
import Panel from '../../../components/ui/Panel'
import Eyebrow from '../../../components/ui/Eyebrow'

const SIGNAL = 'var(--color-signal)'
const INFO = 'var(--color-info)'
const CAUTION = 'var(--color-caution)'
const HAIRLINE = 'var(--color-hairline)'
const FG_DIM = 'var(--color-fg-dim)'

const dayEpoch = (dateStr) => Math.floor(new Date(`${dateStr}T00:00:00`).getTime() / 86400000)
const shortDate = (epoch) =>
  new Date(epoch * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function buildSeries(logs, progress) {
  const weighed = logs.filter((l) => l.weight_kg != null)
  const rows = weighed.map((l) => ({
    x: dayEpoch(l.log_date),
    weight: l.weight_kg,
    bodyFat: l.body_fat_pct,
    muscle: l.muscle_mass_kg,
  }))

  let goalPoint = null
  if (rows.length > 0 && progress?.rate_kg_per_week < 0 && progress.goal_weight_kg != null) {
    const last = rows[rows.length - 1]
    const weeksToGoal = (last.weight - progress.goal_weight_kg) / Math.abs(progress.rate_kg_per_week)
    if (weeksToGoal > 0 && weeksToGoal < 104) {
      const goalX = last.x + Math.round(weeksToGoal * 7)
      rows[rows.length - 1] = { ...last, projectedWeight: last.weight }
      rows.push({ x: goalX, projectedWeight: progress.goal_weight_kg })
      goalPoint = { x: goalX, y: progress.goal_weight_kg }
    }
  }

  return { rows, goalPoint }
}

export default function WeightChart({ logs, progress }) {
  const { rows, goalPoint } = buildSeries(logs, progress)

  if (rows.length === 0) {
    return (
      <Panel className="mb-3.5">
        <Eyebrow>Weight, Body Fat &amp; Muscle</Eyebrow>
        <div className="font-mono text-[11px] text-fg-dim text-center py-6">No weigh-ins logged yet.</div>
      </Panel>
    )
  }

  return (
    <Panel className="mb-3.5">
      <Eyebrow>Weight (kg)</Eyebrow>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={rows}>
          <CartesianGrid stroke={HAIRLINE} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={shortDate}
            tick={{ fill: FG_DIM, fontSize: 9.5 }}
            axisLine={{ stroke: HAIRLINE }}
            tickLine={false}
          />
          <YAxis domain={['auto', 'auto']} tick={{ fill: FG_DIM, fontSize: 9.5 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip
            labelFormatter={shortDate}
            contentStyle={{ background: 'var(--color-panel-raised)', border: `1px solid ${HAIRLINE}`, fontFamily: 'var(--font-mono)', fontSize: 11 }}
          />
          <Line type="monotone" dataKey="weight" stroke={SIGNAL} strokeWidth={2} dot={{ r: 2.5, fill: SIGNAL }} connectNulls />
          <Line
            type="monotone"
            dataKey="projectedWeight"
            stroke={SIGNAL}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            connectNulls
          />
          {goalPoint && (
            <ReferenceDot x={goalPoint.x} y={goalPoint.y} r={4} fill={CAUTION} stroke="none" />
          )}
        </LineChart>
      </ResponsiveContainer>
      {goalPoint && (
        <div className="font-mono text-[10px] text-caution mt-1.5 text-center">
          Projected goal: {shortDate(goalPoint.x)}
        </div>
      )}

      {rows.some((r) => r.bodyFat != null) && (
        <>
          <div className="font-mono text-[10px] text-fg-dim tracking-[0.1em] mt-4 mb-1.5">BODY FAT %</div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={rows}>
              <CartesianGrid stroke={HAIRLINE} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} hide />
              <YAxis domain={['auto', 'auto']} tick={{ fill: FG_DIM, fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                labelFormatter={shortDate}
                contentStyle={{ background: 'var(--color-panel-raised)', border: `1px solid ${HAIRLINE}`, fontFamily: 'var(--font-mono)', fontSize: 11 }}
              />
              <Line type="monotone" dataKey="bodyFat" stroke={INFO} strokeWidth={2} dot={{ r: 2, fill: INFO }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}

      {rows.some((r) => r.muscle != null) && (
        <>
          <div className="font-mono text-[10px] text-fg-dim tracking-[0.1em] mt-4 mb-1.5">MUSCLE MASS (KG)</div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={rows}>
              <CartesianGrid stroke={HAIRLINE} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} hide />
              <YAxis domain={['auto', 'auto']} tick={{ fill: FG_DIM, fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                labelFormatter={shortDate}
                contentStyle={{ background: 'var(--color-panel-raised)', border: `1px solid ${HAIRLINE}`, fontFamily: 'var(--font-mono)', fontSize: 11 }}
              />
              <Line type="monotone" dataKey="muscle" stroke={CAUTION} strokeWidth={2} dot={{ r: 2, fill: CAUTION }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </Panel>
  )
}
