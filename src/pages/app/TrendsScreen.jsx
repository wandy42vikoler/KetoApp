import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { fetchLogsInRange, fetchProgressSummary, todayDateString } from '../../lib/dailyLog'
import Calendar from './trends/Calendar'
import DayDetail from './trends/DayDetail'
import WeightChart from './trends/WeightChart'
import SleepEnergyChart from './trends/SleepEnergyChart'
import CheckIn from './CheckIn'

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
  const [chartLogs, setChartLogs] = useState([])
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editingDate, setEditingDate] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadMonth = useCallback(async () => {
    const { start, end } = monthRange(monthDate)
    const rows = await fetchLogsInRange(user.id, start, end)
    setMonthLogs(rows)
  }, [user.id, monthDate])

  const loadChartData = useCallback(async () => {
    const start = profile?.protocol_start_date ?? today
    const rows = await fetchLogsInRange(user.id, start, today)
    setChartLogs(rows)
    const progressRow = await fetchProgressSummary(user.id)
    setProgress(progressRow)
  }, [user.id, profile?.protocol_start_date, today])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadMonth(), loadChartData()]).finally(() => setLoading(false))
  }, [loadMonth, loadChartData, refreshKey])

  const logsByDate = Object.fromEntries(
    monthLogs.map((l) => [l.log_date, { hasLog: true, mealScore: l.meal_score }]),
  )

  function handleCheckInSaved() {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div>
      <div className="font-mono text-[10px] text-fg-dim tracking-[0.18em] mb-1">TELEMETRY</div>
      <div className="text-xl font-bold text-fg mb-4">Trends</div>

      <div className="bg-panel border border-hairline rounded-[14px] p-4 mb-3.5">
        <Calendar
          monthDate={monthDate}
          logsByDate={logsByDate}
          selectedDate={selectedDate}
          todayDate={today}
          minDate={profile?.protocol_start_date}
          onSelectDate={setSelectedDate}
          onPrevMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          onNextMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
        />
      </div>

      {selectedDate && <DayDetail date={selectedDate} onEditCheckIn={setEditingDate} key={`${selectedDate}-${refreshKey}`} />}

      {loading ? (
        <div className="font-mono text-[11px] text-fg-dim text-center py-10">LOADING…</div>
      ) : (
        <>
          <WeightChart logs={chartLogs} progress={progress} />
          <SleepEnergyChart logs={chartLogs} />
        </>
      )}

      {editingDate && (
        <CheckIn
          date={editingDate}
          onBack={() => setEditingDate(null)}
          onClose={() => setEditingDate(null)}
          onSaved={handleCheckInSaved}
        />
      )}
    </div>
  )
}
