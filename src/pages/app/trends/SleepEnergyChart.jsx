import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import Panel from '../../../components/ui/Panel'
import Eyebrow from '../../../components/ui/Eyebrow'

const CAUTION = 'var(--color-caution)'
const INFO = 'var(--color-info)'
const HAIRLINE = 'var(--color-hairline)'
const FG_DIM = 'var(--color-fg-dim)'

const shortDate = (dateStr) =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export default function SleepEnergyChart({ logs }) {
  const rows = logs
    .filter((l) => l.sleep_quality != null || l.energy_level != null)
    .map((l) => ({ date: shortDate(l.log_date), sleep: l.sleep_quality, energy: l.energy_level }))

  if (rows.length === 0) {
    return (
      <Panel className="mb-3.5">
        <Eyebrow>Sleep &amp; Energy</Eyebrow>
        <div className="font-mono text-[11px] text-fg-dim text-center py-6">No check-ins logged yet.</div>
      </Panel>
    )
  }

  return (
    <Panel className="mb-3.5">
      <Eyebrow>Sleep Quality &amp; Energy</Eyebrow>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={rows}>
          <CartesianGrid stroke={HAIRLINE} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: FG_DIM, fontSize: 9.5 }} axisLine={{ stroke: HAIRLINE }} tickLine={false} />
          <YAxis domain={[0, 10]} tick={{ fill: FG_DIM, fontSize: 9.5 }} axisLine={false} tickLine={false} width={22} />
          <Tooltip
            contentStyle={{ background: 'var(--color-panel-raised)', border: `1px solid ${HAIRLINE}`, fontFamily: 'var(--font-mono)', fontSize: 11 }}
          />
          <ReferenceLine y={7.5} stroke={CAUTION} strokeDasharray="4 4" />
          <Line type="monotone" dataKey="sleep" stroke={CAUTION} strokeWidth={2} dot={{ r: 2.5, fill: CAUTION }} connectNulls />
          <Line type="monotone" dataKey="energy" stroke={INFO} strokeWidth={2} dot={{ r: 2.5, fill: INFO }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-4 justify-center mt-2">
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-fg-dim">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: CAUTION }} /> Sleep
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-fg-dim">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: INFO }} /> Energy
        </div>
      </div>
    </Panel>
  )
}
