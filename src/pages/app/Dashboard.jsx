import { useCallback, useEffect, useState } from 'react'
import { Moon, Droplet, Sparkles, Camera, Dumbbell, Trophy, ChevronRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { fetchTodayLog, fetchProgressSummary } from '../../lib/dailyLog'
import { fetchTodayMeals, sumMealTotals } from '../../lib/meals'
import { fetchTodayWorkouts } from '../../lib/workouts'
import { recommendedWaterLiters } from '../../lib/hydration'
import { protocolDayNumber } from '../../lib/protocolDay'
import Panel from '../../components/ui/Panel'
import Eyebrow from '../../components/ui/Eyebrow'
import Stamp from '../../components/ui/Stamp'
import MacroBar from '../../components/ui/MacroBar'
import Stat from '../../components/ui/Stat'
import ProtocolDial from '../../components/ui/ProtocolDial'

function computeEta(progress) {
  if (!progress?.current_weight_kg || progress.rate_kg_per_week == null) return null
  const remaining = progress.current_weight_kg - progress.goal_weight_kg
  if (remaining <= 0) return 'REACHED'
  if (progress.rate_kg_per_week >= 0) return null
  const weeks = remaining / Math.abs(progress.rate_kg_per_week)
  const etaDate = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000)
  return etaDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Dashboard({ onOpenCheckIn, onOpenLeaderboard, refreshKey }) {
  const { user, profile } = useAuth()
  const [log, setLog] = useState(null)
  const [meals, setMeals] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [target, setTarget] = useState(null)
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)

  const [scoring, setScoring] = useState(false)
  const [scoreError, setScoreError] = useState(null)
  const [scoreResult, setScoreResult] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [logRow, mealsRows, workoutsRows, progressRow] = await Promise.all([
      fetchTodayLog(user.id),
      fetchTodayMeals(user.id),
      fetchTodayWorkouts(user.id),
      fetchProgressSummary(user.id),
    ])
    setLog(logRow)
    setMeals(mealsRows)
    setWorkouts(workoutsRows)
    setProgress(progressRow)
    setScoreResult(null)

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

  async function handleScoreDay() {
    setScoring(true)
    setScoreError(null)
    try {
      const { data, error } = await supabase.functions.invoke('score-meal-day', {
        body: { meals, target },
      })
      if (error) throw error
      setScoreResult(data)
      if (log?.id) {
        await supabase.from('daily_logs').update({ meal_score: data.score }).eq('id', log.id)
      }
    } catch (err) {
      setScoreError(err.message || 'Scoring failed.')
    } finally {
      setScoring(false)
    }
  }

  if (loading) {
    return <div className="font-mono text-[11px] text-fg-dim text-center py-10">LOADING…</div>
  }

  const totals = sumMealTotals(meals)
  const carbStatus = target && totals.carbs > target.net_carbs_g ? 'BREACH' : 'COMPLIANT'
  const eta = computeEta(progress)
  const waterTarget = recommendedWaterLiters(
    progress?.current_weight_kg ?? profile?.starting_weight_kg,
    log?.day_type ?? 'rest',
  )

  return (
    <div>
      <div className="flex justify-between items-baseline mb-4.5">
        <div>
          <div className="font-mono text-[10px] text-fg-dim tracking-[0.18em]">PROTOCOL // TKD-01</div>
          <div className="text-xl font-bold text-fg">Welcome back</div>
        </div>
        <div className="font-mono text-[10.5px] text-fg-dim text-right">
          {protocolDayNumber(profile?.protocol_start_date) != null && (
            <>DAY {protocolDayNumber(profile?.protocol_start_date)}<br /></>
          )}
          <span className="text-info">{(log?.day_type ?? 'rest').toUpperCase()}</span>
        </div>
      </div>

      <button
        onClick={onOpenLeaderboard}
        className="w-full flex items-center gap-2.5 bg-panel border border-hairline rounded-[12px] px-3.5 py-3 mb-3.5"
      >
        <Trophy size={15} className="text-caution flex-shrink-0" />
        <span className="flex-1 text-left text-[12.5px] text-fg">Leaderboard</span>
        <ChevronRight size={14} className="text-fg-dim flex-shrink-0" />
      </button>

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

      {meals.length > 0 && target && (
        <Panel className="mb-3.5">
          {scoreResult ? (
            <>
              <Eyebrow
                right={
                  <span className="font-mono text-[14px] font-bold text-signal">{scoreResult.score}/10</span>
                }
              >
                Meal Day Score
              </Eyebrow>
              <div className="text-[12.5px] text-fg leading-relaxed">{scoreResult.justification}</div>
            </>
          ) : (
            <button
              onClick={handleScoreDay}
              disabled={scoring}
              className="w-full bg-transparent border border-dashed border-hairline-lit disabled:opacity-50 rounded-[9px] py-2.5 text-info font-mono text-[11.5px] tracking-wide flex items-center justify-center gap-1.5"
            >
              <Sparkles size={13} /> {scoring ? 'SCORING…' : 'SCORE MY DAY'}
            </button>
          )}
          {scoreError && <div className="font-mono text-[11px] text-alert mt-2.5">{scoreError}</div>}
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
            <Droplet size={12} /> WATER TARGET
          </div>
          <div className="font-mono text-[22px] text-fg mt-1">
            {waterTarget ?? '—'}
            <span className="text-xs text-fg-dim">L</span>
          </div>
        </Panel>
      </div>

      <Panel>
        <Eyebrow>Today's Log</Eyebrow>

        {log ? (
          <div className="flex justify-between items-center pb-2.5 mb-1 border-b border-hairline">
            <div className="text-[12.5px] text-fg leading-relaxed font-mono">
              {log.weight_kg ? `${log.weight_kg}kg` : 'no weight'} ·{' '}
              {log.body_fat_pct ? `${log.body_fat_pct}% BF` : 'no BF%'}
            </div>
            <button onClick={onOpenCheckIn} className="font-mono text-[10.5px] text-info bg-transparent border-none">
              EDIT
            </button>
          </div>
        ) : (
          <div className="text-center py-4 border-b border-hairline mb-1">
            <div className="font-mono text-[11px] text-fg-dim mb-3">No check-in logged today.</div>
            <button
              onClick={onOpenCheckIn}
              className="bg-signal rounded-[9px] px-4 py-2 text-[#06150F] font-mono text-[11.5px] font-bold"
            >
              LOG CHECK-IN
            </button>
          </div>
        )}

        {workouts.map((w) => (
          <div key={w.id} className="flex gap-2.5 py-2 border-b border-hairline last:border-b-0">
            <div className="w-[26px] h-[26px] rounded-[7px] bg-signal-dim flex items-center justify-center flex-shrink-0">
              <Dumbbell size={13} className="text-signal" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between">
                <span className="text-[12.5px] text-fg">{w.activity_name}</span>
                <span className="font-mono text-[10.5px] text-fg-dim">
                  {new Date(w.logged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="font-mono text-[10.5px] text-fg-dim">
                {w.duration_minutes ? `${w.duration_minutes}min` : 'duration n/a'}
                {w.exercises?.length ? ` · ${w.exercises.length} exercise${w.exercises.length > 1 ? 's' : ''}` : ''}
              </div>
            </div>
          </div>
        ))}

        {meals.map((m) => (
          <div key={m.id} className="flex gap-2.5 py-2 border-b border-hairline last:border-b-0">
            <div className="w-[26px] h-[26px] rounded-[7px] bg-[#1B2422] flex items-center justify-center flex-shrink-0">
              <Camera size={12} className="text-info" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between">
                <span className="text-[12.5px] text-fg">{m.description || 'Meal'}</span>
                <span className="font-mono text-[10.5px] text-fg-dim">
                  {new Date(m.logged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="font-mono text-[10.5px] text-fg-dim">
                P{m.protein_g ?? 0} · F{m.fat_g ?? 0} · C{m.net_carbs_g ?? 0} · {m.calories ?? 0}kcal
              </div>
            </div>
          </div>
        ))}

        {workouts.length === 0 && meals.length === 0 && (
          <div className="font-mono text-[11px] text-fg-dim text-center py-3">Nothing logged yet today.</div>
        )}
      </Panel>
    </div>
  )
}
