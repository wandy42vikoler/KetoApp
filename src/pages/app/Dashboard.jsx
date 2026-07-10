import { useCallback, useEffect, useState } from 'react'
import { Moon, Droplet, Sparkles } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { fetchTodayLog, fetchProgressSummary } from '../../lib/dailyLog'
import Panel from '../../components/ui/Panel'
import Eyebrow from '../../components/ui/Eyebrow'
import Stamp from '../../components/ui/Stamp'
import MacroBar from '../../components/ui/MacroBar'
import Stat from '../../components/ui/Stat'
import ProtocolDial from '../../components/ui/ProtocolDial'

const SUPPLEMENT_COUNT = 4 // creatine, electrolytes, magnesium, omega3 — see CheckIn.jsx

function computeEta(progress) {
  if (!progress?.current_weight_kg || progress.rate_kg_per_week == null) return null
  const remaining = progress.current_weight_kg - progress.goal_weight_kg
  if (remaining <= 0) return 'REACHED'
  if (progress.rate_kg_per_week >= 0) return null
  const weeks = remaining / Math.abs(progress.rate_kg_per_week)
  const etaDate = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000)
  return etaDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Dashboard({ onOpenCheckIn, refreshKey }) {
  const { user } = useAuth()
  const [log, setLog] = useState(null)
  const [target, setTarget] = useState(null)
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [logRow, progressRow] = await Promise.all([fetchTodayLog(user.id), fetchProgressSummary(user.id)])
    setLog(logRow)
    setProgress(progressRow)

    const dayType = logRow?.day_type ?? 'rest'
    const { data: targetRow } = await supabase
      .from('targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('day_type', dayType)
      .maybeSingle()
    setTarget(targetRow)

    setLoading(false)
  }, [user.id])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  if (loading) {
    return <div className="font-mono text-[11px] text-fg-dim text-center py-10">LOADING…</div>
  }

  // No meal logging yet — totals are honestly 0 rather than faked.
  const totals = { calories: 0, protein: 0, fat: 0, carbs: 0 }
  const carbStatus = target && totals.carbs > target.net_carbs_g ? 'BREACH' : 'COMPLIANT'
  const eta = computeEta(progress)
  const supplementCount = Object.values(log?.supplements ?? {}).filter(Boolean).length

  return (
    <div>
      <div className="flex justify-between items-baseline mb-4.5">
        <div>
          <div className="font-mono text-[10px] text-fg-dim tracking-[0.18em]">PROTOCOL // TKD-01</div>
          <div className="text-xl font-bold text-fg">Welcome back</div>
        </div>
        <div className="font-mono text-[10.5px] text-fg-dim text-right">
          <span className="text-info">{(log?.day_type ?? 'rest').toUpperCase()}</span>
        </div>
      </div>

      {progress && (
        <Panel className="mb-3.5">
          <ProtocolDial
            start={progress.starting_weight_kg}
            goal={progress.goal_weight_kg}
            current={progress.current_weight_kg ?? progress.starting_weight_kg}
          />
          <div className="flex justify-around mt-3.5 pt-3.5 border-t border-hairline">
            <Stat label="CURRENT" value={progress.current_weight_kg ?? '—'} unit={progress.current_weight_kg ? 'kg' : ''} />
            <Stat
              label="RATE"
              value={progress.rate_kg_per_week != null ? progress.rate_kg_per_week : '—'}
              unit={progress.rate_kg_per_week != null ? 'kg/wk' : ''}
              colorClass="text-signal"
            />
            <Stat label="ETA" value={eta ?? '—'} mono={false} />
          </div>
        </Panel>
      )}

      {target ? (
        <Panel className="mb-3.5">
          <Eyebrow right={<Stamp status={carbStatus} />}>Macro Burn-Down</Eyebrow>
          <MacroBar label="CALORIES" value={totals.calories} target={target.calories} unit="" />
          <MacroBar label="PROTEIN" value={totals.protein} target={target.protein_g} unit="g" />
          <MacroBar label="FAT" value={totals.fat} target={target.fat_g} unit="g" />
          <MacroBar label="NET CARBS" value={totals.carbs} target={target.net_carbs_g} unit="g" />
        </Panel>
      ) : (
        <Panel className="mb-3.5">
          <div className="font-mono text-[11px] text-fg-dim text-center py-4">
            No targets set yet — visit the Targets tab.
          </div>
        </Panel>
      )}

      {log?.ai_note && (
        <Panel className="mb-3.5 border-l-2 border-info">
          <Eyebrow>
            <Sparkles size={11} className="inline mr-1.5 -translate-y-px" />
            Coach Note
          </Eyebrow>
          <div className="text-[13px] text-fg leading-relaxed">{log.ai_note}</div>
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-2.5 mb-3.5">
        <Panel className="p-3.5">
          <div className="flex items-center gap-1.5 text-fg-muted font-mono text-[10.5px]">
            <Moon size={12} /> SLEEP
          </div>
          <div className="font-mono text-[22px] text-caution mt-1">
            {log?.sleep_quality ?? '—'}
            <span className="text-xs text-fg-dim">/10</span>
          </div>
        </Panel>
        <Panel className="p-3.5">
          <div className="flex items-center gap-1.5 text-fg-muted font-mono text-[10.5px]">
            <Droplet size={12} /> WATER
          </div>
          <div className="font-mono text-[22px] text-fg mt-1">
            {log?.water_liters ?? '—'}
            <span className="text-xs text-fg-dim">L</span>
          </div>
        </Panel>
      </div>

      <Panel>
        <Eyebrow>Today's Log</Eyebrow>
        {log ? (
          <div className="text-[12.5px] text-fg leading-relaxed font-mono">
            {supplementCount}/{SUPPLEMENT_COUNT} supplements · {log.weight_kg ? `${log.weight_kg}kg` : 'no weight'} ·{' '}
            {log.body_fat_pct ? `${log.body_fat_pct}% BF` : 'no BF%'}
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="font-mono text-[11px] text-fg-dim mb-3">No check-in logged today.</div>
            <button
              onClick={onOpenCheckIn}
              className="bg-signal rounded-[9px] px-4 py-2 text-[#06150F] font-mono text-[11.5px] font-bold"
            >
              LOG CHECK-IN
            </button>
          </div>
        )}
      </Panel>
    </div>
  )
}
