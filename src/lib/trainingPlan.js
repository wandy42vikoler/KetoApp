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
