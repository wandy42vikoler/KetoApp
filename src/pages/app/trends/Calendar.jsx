import { ChevronLeft, ChevronRight } from 'lucide-react'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function toDateString(year, month, day) {
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

function scoreColorClass(score) {
  if (score == null) return 'text-fg-dim'
  if (score >= 7) return 'text-signal'
  if (score >= 4) return 'text-caution'
  return 'text-alert'
}

export default function Calendar({
  monthDate,
  logsByDate,
  selectedDate,
  todayDate,
  minDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) cells.push(day)

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <button onClick={onPrevMonth} className="bg-transparent border-none text-fg-muted p-1">
          <ChevronLeft size={16} />
        </button>
        <div className="font-mono text-[11px] text-fg tracking-[0.1em]">
          {monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}
        </div>
        <button onClick={onNextMonth} className="bg-transparent border-none text-fg-muted p-1">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center font-mono text-[9px] text-fg-dim">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} />
          const dateStr = toDateString(year, month, day)
          const entry = logsByDate[dateStr]
          const isSelected = dateStr === selectedDate
          const isToday = dateStr === todayDate
          const isOutOfRange = dateStr > todayDate || (minDate && dateStr < minDate)

          return (
            <button
              key={dateStr}
              onClick={() => !isOutOfRange && onSelectDate(dateStr)}
              disabled={isOutOfRange}
              className={`aspect-square rounded-[7px] flex flex-col items-center justify-center gap-0.5 border ${
                isSelected
                  ? 'border-signal bg-signal-dim/40'
                  : isToday
                    ? 'border-hairline-lit bg-panel-raised'
                    : 'border-transparent'
              } ${isOutOfRange ? 'opacity-30' : ''}`}
            >
              <span className="font-mono text-[10.5px] text-fg">{day}</span>
              {entry?.mealScore != null ? (
                <span className={`font-mono text-[8.5px] font-bold ${scoreColorClass(entry.mealScore)}`}>
                  {entry.mealScore}
                </span>
              ) : entry?.hasLog ? (
                <span className="w-1 h-1 rounded-full bg-info" />
              ) : (
                <span className="w-1 h-1" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
