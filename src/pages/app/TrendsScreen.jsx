import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { fetchLogsInRange, fetchProgressSummary, todayDateString } from '../../lib/dailyLog'
import { fetchWorkoutsInRange } from '../../lib/workouts'
import { fetchWeeklyCheckins, getProgressPhotoUrl } from '../../lib/weeklyCheckins'
import { fetchTrainingPlan, computeComplianceByDate } from '../../lib/trainingPlan'
import Calendar from './trends/Calendar'
import DayDetail from './trends/DayDetail'
import WeightChart from './trends/WeightChart'
import SleepEnergyChart from './trends/SleepEnergyChart'
import CheckIn from './CheckIn'
import MealLog from './MealLog'
import WorkoutLog from './WorkoutLog'

function monthRange(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const end = new Date(year, month + 1, 0).toISOString().slice(0, 10)
  return { start, end }
}

export default function TrendsScreen() {
  const { user, profile } = useAuth()
  const today = todayDateString()

  const [monthDate, setMonthDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [monthLogs, setMonthLogs] = useState([])
  const [monthWorkouts, setMonthWorkouts] = useState([])
  const [planDays, setPlanDays] = useState([])
  const [chartLogs, setChartLogs] = useState([])
  const [progress, setProgress] = useState(null)
  const [weeklyCheckins, setWeeklyCheckins] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const [checkInDate, setCheckInDate] = useState(null)
  const [mealSheet, setMealSheet] = useState(null) // { date, meal? }
  const [workoutSheet, setWorkoutSheet] = useState(null) // { date, workout? }

  const loadMonth = useCallback(async () => {
    const { start, end } = monthRange(monthDate)
    const [logRows, workoutRows, plan] = await Promise.all([
      fetchLogsInRange(user.id, start, end),
      fetchWorkoutsInRange(user.id, start, end),
      fetchTrainingPlan(user.id),
    ])
    setMonthLogs(logRows)
    setMonthWorkouts(workoutRows)
    setPlanDays(plan)
  }, [user.id, monthDate])

  const loadChartData = useCallback(async () => {
    const start = profile?.protocol_start_date ?? today
    const rows = await fetchLogsInRange(user.id, start, today)
    setChartLogs(rows)
    const progressRow = await fetchProgressSummary(user.id)
    setProgress(progressRow)
  }, [user.id, profile?.protocol_start_date, today])

  const loadWeeklyCheckins = useCallback(async () => {
    const rows = await fetchWeeklyCheckins(user.id)
    const withPhotos = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        photoUrl: row.photo_path ? await getProgressPhotoUrl(row.photo_path).catch(() => null) : null,
      })),
    )
    setWeeklyCheckins(withPhotos)
  }, [user.id])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadMonth(), loadChartData(), loadWeeklyCheckins()]).finally(() => setLoading(false))
  }, [loadMonth, loadChartData, loadWeeklyCheckins, refreshKey])

  const logsByDate = Object.fromEntries(
    monthLogs.map((l) => [l.log_date, { hasLog: true, mealScore: l.meal_score }]),
  )

  const { start: monthStart, end: monthEnd } = monthRange(monthDate)
  const monthDateStrings = []
  for (let d = new Date(`${monthStart}T00:00:00`); d.toISOString().slice(0, 10) <= monthEnd; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().slice(0, 10)
    if (ds <= today) monthDateStrings.push(ds)
  }
  const complianceByDate = computeComplianceByDate(planDays, monthWorkouts, monthDateStrings)

  function handleDataSaved() {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div>
      <div className="font-mono text-[10px] text-fg-dim tracking-[0.18em] mb-1">TELEMETRY</div>
      <div className="text-xl font-bold text-fg mb-4">Trends</div>

      {weeklyCheckins.length > 0 && (
        <div className="mb-3.5">
          <div className="font-mono text-[10.5px] text-fg-dim tracking-[0.16em] uppercase mb-2.5">Weekly Check-Ins</div>
          <div className="flex flex-col gap-2.5">
            {weeklyCheckins.map((wc) => (
              <div key={wc.id} className="flex gap-3 bg-panel border border-hairline rounded-[12px] p-3">
                {wc.photoUrl ? (
                  <img src={wc.photoUrl} alt="" className="w-[54px] h-[54px] rounded-[8px] object-cover flex-shrink-0" />
                ) : (
                  <div className="w-[54px] h-[54px] rounded-[8px] bg-panel-raised flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[10px] text-fg-dim mb-1">
                    WEEK OF{' '}
                    {new Date(`${wc.week_start_date}T00:00:00`).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  {wc.summary && <div className="text-[12px] text-fg leading-relaxed line-clamp-2">{wc.summary}</div>}
                  {wc.photo_assessment && (
                    <div className="text-[11px] text-signal leading-relaxed mt-1 line-clamp-2">{wc.photo_assessment}</div>
                  )}
                  {wc.ai_feedback && (
                    <div className="text-[11px] text-fg-muted leading-relaxed mt-1 line-clamp-2">{wc.ai_feedback}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-panel border border-hairline rounded-[14px] p-4 mb-3.5">
        <Calendar
          monthDate={monthDate}
          logsByDate={logsByDate}
          complianceByDate={complianceByDate}
          selectedDate={selectedDate}
          todayDate={today}
          minDate={profile?.protocol_start_date}
          onSelectDate={setSelectedDate}
          onPrevMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          onNextMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
        />
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-hairline">
          <div className="flex items-center gap-1.5 font-mono text-[9.5px] text-fg-dim">
            <span className="w-2 h-[3px] bg-signal inline-block rounded-full" /> PLAN COMPLETE
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[9.5px] text-fg-dim">
            <span className="w-2 h-[3px] bg-alert inline-block rounded-full" /> PLAN MISSED
          </div>
        </div>
      </div>

      {selectedDate && (
        <DayDetail
          date={selectedDate}
          key={`${selectedDate}-${refreshKey}`}
          planDays={planDays}
          onEditCheckIn={setCheckInDate}
          onAddMeal={(date) => setMealSheet({ date })}
          onEditMeal={(date, meal) => setMealSheet({ date, meal })}
          onAddWorkout={(date) => setWorkoutSheet({ date })}
          onEditWorkout={(date, workout) => setWorkoutSheet({ date, workout })}
        />
      )}

      {loading ? (
        <div className="font-mono text-[11px] text-fg-dim text-center py-10">LOADING…</div>
      ) : (
        <>
          <WeightChart logs={chartLogs} progress={progress} />
          <SleepEnergyChart logs={chartLogs} />
        </>
      )}

      {checkInDate && (
        <CheckIn
          date={checkInDate}
          onBack={() => setCheckInDate(null)}
          onClose={() => setCheckInDate(null)}
          onSaved={handleDataSaved}
        />
      )}

      {mealSheet && (
        <MealLog
          date={mealSheet.date}
          meal={mealSheet.meal}
          onBack={() => setMealSheet(null)}
          onClose={() => setMealSheet(null)}
          onSaved={handleDataSaved}
        />
      )}

      {workoutSheet && (
        <WorkoutLog
          date={workoutSheet.date}
          workout={workoutSheet.workout}
          onBack={() => setWorkoutSheet(null)}
          onClose={() => setWorkoutSheet(null)}
          onSaved={handleDataSaved}
        />
      )}
    </div>
  )
}
