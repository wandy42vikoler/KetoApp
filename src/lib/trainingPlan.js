import { supabase } from './supabaseClient'

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ISO weekday for a Date: 1 = Monday ... 7 = Sunday.
export function isoWeekday(date) {
  const day = date.getDay() // 0 = Sunday
  return day === 0 ? 7 : day
}

export async function fetchTrainingPlan(userId) {
  const { data, error } = await supabase
    .from('training_plan_days')
    .select('*')
    .eq('user_id', userId)
    .order('weekday', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data
}

export async function insertTrainingPlanDay(userId, fields) {
  const { data, error } = await supabase
    .from('training_plan_days')
    .insert({ user_id: userId, ...fields })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTrainingPlanDay(id, fields) {
  const { data, error } = await supabase.from('training_plan_days').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteTrainingPlanDay(id) {
  const { error } = await supabase.from('training_plan_days').delete().eq('id', id)
  if (error) throw error
}

// Groups plan rows by weekday (1=Mon..7=Sun) for rendering a Mon-Sun list.
export function groupByWeekday(planDays) {
  const grouped = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] }
  for (const row of planDays) {
    grouped[row.weekday]?.push(row)
  }
  return grouped
}

// Mon-Sun window containing today (local time), as ISO date strings, plus
// a lookup from weekday (1..7) to that day's date string.
export function currentWeekRange() {
  const today = new Date()
  const iso = isoWeekday(today)
  const monday = new Date(today)
  monday.setDate(today.getDate() - (iso - 1))

  const fmt = (d) => d.toISOString().slice(0, 10)
  const datesByWeekday = {}
  for (let i = 1; i <= 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + (i - 1))
    datesByWeekday[i] = fmt(d)
  }

  return { start: datesByWeekday[1], end: datesByWeekday[7], datesByWeekday }
}

// Compliance per date, for a set of past-or-today date strings: for each
// date, counts how many *required* plan rows exist for that weekday and
// how many workouts were actually logged that date. 'done' if logged
// count meets or exceeds required count, 'missed' if it falls short,
// null if nothing was scheduled that weekday (rest day / no plan set).
export function computeComplianceByDate(planDays, workouts, dateStrings) {
  const grouped = groupByWeekday(planDays)
  const requiredCountByWeekday = {}
  for (let wd = 1; wd <= 7; wd++) {
    requiredCountByWeekday[wd] = (grouped[wd] ?? []).filter((r) => r.required !== false).length
  }

  const workoutCountByDate = {}
  for (const w of workouts) {
    const d = (w.logged_at ?? '').slice(0, 10)
    if (!d) continue
    workoutCountByDate[d] = (workoutCountByDate[d] ?? 0) + 1
  }

  const result = {}
  for (const dateStr of dateStrings) {
    const wd = isoWeekday(new Date(`${dateStr}T00:00:00`))
    const required = requiredCountByWeekday[wd] ?? 0
    if (required === 0) {
      result[dateStr] = null
      continue
    }
    const logged = workoutCountByDate[dateStr] ?? 0
    result[dateStr] = logged >= required ? 'done' : 'missed'
  }
  return result
}
