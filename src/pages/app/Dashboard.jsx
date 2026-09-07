import { useCallback, useEffect, useState } from 'react'
import { Moon, Droplet, Footprints, Sparkles, Camera, Dumbbell, Pill } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { fetchTodayLog, fetchProgressSummary, todayDateString } from '../../lib/dailyLog'
import { fetchTodayMeals, sumMealTotals } from '../../lib/meals'
import { fetchTodayWorkouts, fetchWorkoutsInRange } from '../../lib/workouts'
import { recommendedWaterLiters } from '../../lib/hydration'
import { protocolDayNumber, daysUntil } from '../../lib/protocolDay'
import {
  WEEKDAY_LABELS,
  fetchTrainingPlan,
  groupByWeekday,
  isoWeekday,
  currentWeekRange,
} from '../../lib/trainingPlan'
import { toggleSupplementToday } from '../../lib/supplementLog'
import Panel from '../../components/ui/Panel'
import Eyebrow from '../../components/ui/Eyebrow'
import Stamp from '../../components/ui/Stamp'
import MacroBar from '../../components/ui/MacroBar'
import Stat from '../../components/ui/Stat'
import ProtocolDial from '../../components/ui/ProtocolDial'
import WorkoutLog from './WorkoutLog'

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
  const { user, profile } = useAuth()
  const [log, setLog] = useState(null)
  const [meals, setMeals] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [target, setTarget] = useState(null)
  const [progress, setProgress] = useState(null)
  const [planDays, setPlanDays] = useState([])
  const [weekWorkouts, setWeekWorkouts] = useState([])
  const [loading, setLoading] = useState(true)

  const [scoring, setScoring] = useState(false)
  const [scoreError, setScoreError] = useState(null)
  const [scoreResult, setScoreResult] = useState(null)

  const [plannedLog, setPlannedLog] = useState(null) // { label } — opens WorkoutLog for today

  const today = todayDateString()
  const { start: weekStart, end: weekEnd } = currentWeekRange()

  const load = useCallback(async () => {
    setLoading(true)
    const [logRow, mealsRows, workoutsRows, progressRow, plan, weekWorkoutRows] = await Promise.all([
      fetchTodayLog(user.id),
      fetchTodayMeals(user.id),
      fetchTodayWorkouts(user.id),
      fetchProgressSummary(user.id),
      fetchTrainingPlan(user.id),
      fetchWorkoutsInRange(user.id, weekStart, weekEnd),
    ])
    setLog(logRow)
    setMeals(mealsRows)
    setWorkouts(workoutsRows)
    setProgress(progressRow)
    setPlanDays(plan)
    setWeekWorkouts(weekWorkoutRows)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  // Workout calorie estimates run high, so only count a dampened fraction
  // of them toward the day's actual budget — the whole bump goes to fat
  // (protein and carb targets stay fixed).
  const CALORIE_BURN_DAMPENING = 0.65
  const caloriesBurnedToday = workouts.reduce((sum, w) => sum + (w.calories_burned ?? 0), 0)
  const adjustmentKcal = caloriesBurnedToday * CALORIE_BURN_DAMPENING
  const effectiveTarget =
    target && adjustmentKcal > 0
      ? { ...target, calories: target.calories + adjustmentKcal, fat_g: target.fat_g + adjustmentKcal / 9 }
      : target

  async function handleScoreDay() {
    setScoring(true)
    setScoreError(null)
    try {
      const { data, error } = await supabase.functions.invoke('score-meal-day', {
        body: { meals, target: effectiveTarget },
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

  async function handleToggleSupplement(id, checked) {
    setLog((l) => ({ ...l, supplements: { ...(l?.supplements ?? {}), [id]: checked } }))
    try {
      await toggleSupplementToday(user.id, id, checked)
    } catch {
      // best-effort — a failed toggle just means it reverts on next load
    }
  }

  if (loading) {
    return <div className="font-mono text-[11px] text-fg-dim text-center py-10">LOADING…</div>
  }

  const totals = sumMealTotals(meals)
  const carbStatus = target && totals.carbs > target.carbs_g ? 'OVER' : 'ON TARGET'
  const eta = computeEta(progress)
  const waterTarget = recommendedWaterLiters(
    progress?.current_weight_kg ?? profile?.starting_weight_kg,
    log?.day_type ?? 'rest',
  )
  const remainingDays = daysUntil(profile?.target_event_date)
  const eventLabel = profile?.target_event_name

  const grouped = groupByWeekday(planDays)
  const todayWeekday = isoWeekday(new Date())
  const todayPlan = grouped[todayWeekday] ?? []

  const loggedWeekdaySet = new Set(weekWorkouts.map((w) => isoWeekday(new Date(w.logged_at))))

  const supplements = profile?.supplement_stack ?? []
  const todaySupplements = log?.supplements ?? {}

  return (
    <div>
      <div className="flex justify-between items-baseline mb-4.5">
        <div>
          <div className="font-mono text-[10px] text-fg-dim tracking-[0.18em]">SHREDDER PLANNER</div>
          <div className="text-xl font-bold text-fg">Welcome back</div>
        </div>
        <div className="font-mono text-[10.5px] text-fg-dim text-right">
          {protocolDayNumber(profile?.protocol_start_date) != null && (
            <>
              DAY {protocolDayNumber(profile?.protocol_start_date)}
              <br />
            </>
          )}
          {remainingDays != null && (
            <>
              <span className="text-signal">{remainingDays >= 0 ? `${remainingDays}D` : 'PASSED'}</span>
              {eventLabel ? ` TO ${eventLabel.toUpperCase()}` : ''}
              <br />
            </>
          )}
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

      {effectiveTarget ? (
        <Panel className="mb-3.5">
          <Eyebrow right={<Stamp status={carbStatus} />}>Macro Burn-Down</Eyebrow>
          <MacroBar label="CALORIES" value={totals.calories} target={Math.round(effectiveTarget.calories)} unit="" />
          <MacroBar label="PROTEIN" value={totals.protein} target={effectiveTarget.protein_g} unit="g" />
          <MacroBar label="FAT" value={totals.fat} target={Math.round(effectiveTarget.fat_g * 10) / 10} unit="g" />
          <MacroBar label="CARBS" value={totals.carbs} target={effectiveTarget.carbs_g} unit="g" />
          {adjustmentKcal > 0 && (
            <div className="font-mono text-[10px] text-fg-dim mt-2.5 pt-2.5 border-t border-hairline leading-relaxed">
              +{Math.round(adjustmentKcal)}kcal / +{(adjustmentKcal / 9).toFixed(1)}g fat added to target
              <br />
              from {Math.round(caloriesBurnedToday)}kcal estimated workout burn × {CALORIE_BURN_DAMPENING} dampening
              (estimates run high — protein and carbs stay fixed).
            </div>
          )}
        </Panel>
      ) : (
        <Panel className="mb-3.5">
          <div className="font-mono text-[11px] text-fg-dim text-center py-4">
            No targets set yet — visit the Plan tab.
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

      {(todayPlan.length > 0 || planDays.length > 0) && (
        <Panel className="mb-3.5">
          <Eyebrow>This Week</Eyebrow>
          <div className="grid grid-cols-7 gap-1.5 mb-3">
            {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
              const done = loggedWeekdaySet.has(wd)
              const isToday = wd === todayWeekday
              return (
                <div
                  key={wd}
                  className={`flex flex-col items-center gap-1.5 rounded-[8px] py-2 ${
                    isToday ? 'bg-signal-dim/30 border border-signal/40' : ''
                  }`}
                >
                  <div className="font-mono text-[9px] text-fg-dim">{WEEKDAY_LABELS[wd - 1][0]}</div>
                  <div className={`w-2 h-2 rounded-full ${done ? 'bg-signal' : 'bg-hairline-lit'}`} />
                </div>
              )
            })}
          </div>
          {todayPlan.length > 0 && (
            <div className="flex flex-col gap-2 pt-1 border-t border-hairline">
              <div className="font-mono text-[10px] text-fg-dim tracking-[0.1em] pt-2.5">TODAY'S PLAN — TAP TO LOG</div>
              {todayPlan.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setPlannedLog({ label: row.label })}
                  className="flex items-center gap-2.5 bg-panel-raised border border-hairline rounded-[10px] px-3 py-2.5 text-left"
                >
                  <div className="w-[26px] h-[26px] rounded-[7px] bg-signal-dim flex items-center justify-center flex-shrink-0">
                    <Dumbbell size={13} className="text-signal" />
                  </div>
                  <span className="flex-1 text-[12.5px] text-fg">{row.label}</span>
                  {!row.required && (
                    <span className="font-mono text-[9px] text-fg-dim border border-hairline rounded-[4px] px-1.5 py-0.5">
                      OPT
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </Panel>
      )}

      {supplements.length > 0 && (
        <Panel className="mb-3.5">
          <Eyebrow>
            <Pill size={11} className="inline mr-1.5 -translate-y-px" /> Supplements
          </Eyebrow>
          <div className="flex flex-col gap-2">
            {supplements.map((item) => {
              const checked = Boolean(todaySupplements[item.id])
              return (
                <label
                  key={item.id}
                  className="flex items-center gap-2.5 bg-panel-raised border border-hairline rounded-[9px] px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => handleToggleSupplement(item.id, e.target.checked)}
                  />
                  <span className={`flex-1 text-[12.5px] ${checked ? 'text-fg-dim line-through' : 'text-fg'}`}>
                    {item.name}
                  </span>
                  {item.dose && <span className="font-mono text-[10px] text-fg-dim">{item.dose}</span>}
                </label>
              )
            })}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-3 gap-2.5 mb-3.5">
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
            <Footprints size={12} /> STEPS
          </div>
          <div className="font-mono text-[22px] text-fg mt-1">
            {log?.steps ?? '—'}
            {profile?.daily_steps_goal && (
              <span className="text-xs text-fg-dim"> /{Math.round(profile.daily_steps_goal / 1000)}k</span>
            )}
          </div>
        </Panel>
        <Panel className="p-3.5">
          <div className="flex items-center gap-1.5 text-fg-muted font-mono text-[10.5px]">
            <Droplet size={12} /> WATER
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
              {w.ai_feedback && <div className="text-[11px] text-fg-muted mt-1 leading-relaxed">{w.ai_feedback}</div>}
            </div>
          </div>
        ))}

        {meals.map((m) => (
          <div key={m.id} className="flex gap-2.5 py-2 border-b border-hairline last:border-b-0">
            <div className="w-[26px] h-[26px] rounded-[7px] bg-panel-raised flex items-center justify-center flex-shrink-0">
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
                P{m.protein_g ?? 0} · F{m.fat_g ?? 0} · C{m.carbs_g ?? 0} · {m.calories ?? 0}kcal
              </div>
            </div>
          </div>
        ))}

        {workouts.length === 0 && meals.length === 0 && (
          <div className="font-mono text-[11px] text-fg-dim text-center py-3">Nothing logged yet today.</div>
        )}
      </Panel>

      {plannedLog && (
        <WorkoutLog
          date={today}
          plannedLabel={plannedLog.label}
          onBack={() => setPlannedLog(null)}
          onClose={() => setPlannedLog(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
