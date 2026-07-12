import { supabase } from './supabaseClient'

export function todayDateString() {
  return new Date().toISOString().slice(0, 10)
}

export async function fetchLogForDate(userId, logDate) {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .maybeSingle()
  if (error) throw error
  return data
}

export function fetchTodayLog(userId) {
  return fetchLogForDate(userId, todayDateString())
}

// day_type is derived, not user-entered: 'activity' if a workouts row
// exists on that date, else 'rest'. Always resolves 'rest' until workout
// logging exists — that's correct, not a bug.
async function deriveDayType(userId, logDate) {
  const { count, error } = await supabase
    .from('workouts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('logged_at', `${logDate}T00:00:00`)
    .lt('logged_at', `${logDate}T23:59:59.999`)
  if (error) throw error
  return count > 0 ? 'activity' : 'rest'
}

export async function upsertLogForDate(userId, logDate, fields) {
  const day_type = await deriveDayType(userId, logDate)

  const { data, error } = await supabase
    .from('daily_logs')
    .upsert({ user_id: userId, log_date: logDate, day_type, ...fields }, { onConflict: 'user_id,log_date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export function upsertTodayLog(userId, fields) {
  return upsertLogForDate(userId, todayDateString(), fields)
}

export async function fetchRecentLogs(userId, days = 7) {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .limit(days)
  if (error) throw error
  return data
}

// Inclusive date range, e.g. for a calendar month or a trend chart window.
export async function fetchLogsInRange(userId, startDate, endDate) {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('log_date', startDate)
    .lte('log_date', endDate)
    .order('log_date', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchProgressSummary(userId) {
  const { data, error } = await supabase.from('progress_summary').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data
}
