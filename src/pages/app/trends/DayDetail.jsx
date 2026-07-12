import { useEffect, useState } from 'react'
import { Dumbbell, Pencil } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { fetchLogForDate } from '../../../lib/dailyLog'
import { fetchMealsForDate, sumMealTotals } from '../../../lib/meals'
import { fetchWorkoutsForDate } from '../../../lib/workouts'
import Panel from '../../../components/ui/Panel'
import Eyebrow from '../../../components/ui/Eyebrow'

export default function DayDetail({ date, onEditCheckIn }) {
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
        <div className="font-mono text-[10.5px] text-fg-dim mb-2">
          {meals.length} meal{meals.length > 1 ? 's' : ''} · {totals.calories}kcal · P{totals.protein} F{totals.fat} C
          {totals.carbs}
        </div>
      )}

      {workouts.length > 0 &&
        workouts.map((w) => (
          <div key={w.id} className="flex items-center gap-2 font-mono text-[10.5px] text-fg-dim mb-1">
            <Dumbbell size={11} className="text-signal" /> {w.activity_name}
            {w.duration_minutes ? ` · ${w.duration_minutes}min` : ''}
          </div>
        ))}

      {meals.length === 0 && workouts.length === 0 && !log && (
        <div className="font-mono text-[10.5px] text-fg-dim text-center py-2">Nothing logged this day.</div>
      )}
    </Panel>
  )
}
