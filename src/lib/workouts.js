import { supabase } from './supabaseClient'
import { todayDateString } from './dailyLog'

export async function fetchWorkoutsForDate(userId, logDate) {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', `${logDate}T00:00:00`)
    .lt('logged_at', `${logDate}T23:59:59.999`)
    .order('logged_at', { ascending: true })
  if (error) throw error
  return data
}

export function fetchTodayWorkouts(userId) {
  return fetchWorkoutsForDate(userId, todayDateString())
}

export async function fetchWorkoutsInRange(userId, startDate, endDate) {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', `${startDate}T00:00:00`)
    .lt('logged_at', `${endDate}T23:59:59.999`)
    .order('logged_at', { ascending: true })
  if (error) throw error
  return data
}

export async function insertWorkout(userId, dailyLogId, fields) {
  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: userId, daily_log_id: dailyLogId, ...fields })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateWorkout(workoutId, fields) {
  const { data, error } = await supabase.from('workouts').update(fields).eq('id', workoutId).select().single()
  if (error) throw error
  return data
}

export async function deleteWorkout(workoutId) {
  const { error } = await supabase.from('workouts').delete().eq('id', workoutId)
  if (error) throw error
}
