import { useEffect, useState } from 'react'
import { Camera, Dumbbell, Pencil, Plus } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { fetchLogForDate } from '../../../lib/dailyLog'
import { fetchMealsForDate, sumMealTotals } from '../../../lib/meals'
import { fetchWorkoutsForDate } from '../../../lib/workouts'
import Panel from '../../../components/ui/Panel'
import Eyebrow from '../../../components/ui/Eyebrow'

export default function DayDetail({ date, onEditCheckIn, onAddMeal, onEditMeal, onAddWorkout, onEditWorkout }) {
  const { user } = useAuth()
  const [log, setLog] = useState(null)
  const [meals, setMeals] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      fetchLogForDate(user.id, date),
      fetchMealsForDate(user.id, date),
      fetchWorkoutsForDate(user.id, date),
    ]).then(([logRow, mealsRows, workoutsRows]) => {
      if (!active) return
      setLog(logRow)
      setMeals(mealsRows)
      setWorkouts(workoutsRows)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [user.id, date])

  const totals = sumMealTotals(meals)
  const label = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  if (loading) {
    return (
      <Panel className="mb-3.5">
        <div className="font-mono text-[11px] text-fg-dim text-center py-4">LOADING…</div>
      </Panel>
    )
  }

  return (
    <Panel className="mb-3.5">
      <Eyebrow
        right={
          <button
            onClick={() => onEditCheckIn(date)}
            className="font-mono text-[10px] text-info bg-transparent border-none flex items-center gap-1"
          >
            <Pencil size={11} /> {log ? 'EDIT' : 'ADD CHECK-IN'}
          </button>
        }
      >
        {label}
      </Eyebrow>

      {log ? (
        <div className="font-mono text-[11.5px] text-fg leading-relaxed mb-2">
          {log.weight_kg ? `${log.weight_kg}kg` : 'no weight'} ·{' '}
          {log.body_fat_pct ? `${log.body_fat_pct}% BF` : 'no BF%'} · sleep {log.sleep_quality ?? '—'}/10 · energy{' '}
          {log.energy_level ?? '—'}/10
          {log.meal_score != null && <> · meal score {log.meal_score}/10</>}
        </div>
      ) : (
        <div className="font-mono text-[11px] text-fg-dim mb-2">No check-in logged this day.</div>
      )}

      {log?.soreness_notes && (
        <div className="font-mono text-[10.5px] text-caution mb-1">Soreness: {log.soreness_notes}</div>
      )}
      {log?.notes && <div className="font-mono text-[10.5px] text-fg-dim mb-2">{log.notes}</div>}

      {meals.length > 0 && (
        <div className="font-mono text-[10px] text-fg-dim mb-1.5 pt-2 border-t border-hairline">
          {meals.length} meal{meals.length > 1 ? 's' : ''} · {totals.calories}kcal · P{totals.protein} F{totals.fat} C
          {totals.carbs}
        </div>
      )}

      {meals.map((m) => (
        <button
          key={m.id}
          onClick={() => onEditMeal(date, m)}
          className="w-full flex items-center gap-2.5 py-1.5 text-left bg-transparent border-none"
        >
          <div className="w-[22px] h-[22px] rounded-[6px] bg-[#1B2422] flex items-center justify-center flex-shrink-0">
            <Camera size={11} className="text-info" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-fg truncate">{m.description || 'Meal'}</div>
            <div className="font-mono text-[10px] text-fg-dim">
              P{m.protein_g ?? 0} · F{m.fat_g ?? 0} · C{m.net_carbs_g ?? 0} · {m.calories ?? 0}kcal
            </div>
          </div>
          <Pencil size={11} className="text-fg-dim flex-shrink-0" />
        </button>
      ))}

      <button
        onClick={() => onAddMeal(date)}
        className="w-full flex items-center gap-2 py-2 mt-1 font-mono text-[10.5px] text-info bg-transparent border-none"
      >
        <Plus size={12} /> ADD MEAL
      </button>

      {workouts.length > 0 && <div className="pt-1.5 border-t border-hairline" />}

      {workouts.map((w) => (
        <button
          key={w.id}
          onClick={() => onEditWorkout(date, w)}
          className="w-full flex items-center gap-2.5 py-1.5 text-left bg-transparent border-none"
        >
          <div className="w-[22px] h-[22px] rounded-[6px] bg-signal-dim flex items-center justify-center flex-shrink-0">
            <Dumbbell size={11} className="text-signal" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-fg truncate">{w.activity_name}</div>
            <div className="font-mono text-[10px] text-fg-dim">
              {w.duration_minutes ? `${w.duration_minutes}min` : 'duration n/a'}
              {w.exercises?.length ? ` · ${w.exercises.length} exercise${w.exercises.length > 1 ? 's' : ''}` : ''}
            </div>
          </div>
          <Pencil size={11} className="text-fg-dim flex-shrink-0" />
        </button>
      ))}

      <button
        onClick={() => onAddWorkout(date)}
        className="w-full flex items-center gap-2 py-2 mt-1 font-mono text-[10.5px] text-info bg-transparent border-none"
      >
        <Plus size={12} /> ADD WORKOUT
      </button>
    </Panel>
  )
}
