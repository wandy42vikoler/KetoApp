import { supabase } from './supabaseClient'
import { isoWeekday } from './trainingPlan'

// ISO date string for the Monday of the current week.
export function currentWeekStart() {
  const today = new Date()
  const iso = isoWeekday(today)
  const monday = new Date(today)
  monday.setDate(today.getDate() - (iso - 1))
  return monday.toISOString().slice(0, 10)
}

export async function fetchWeeklyCheckins(userId, limit = 12) {
  const { data, error } = await supabase
    .from('weekly_checkins')
    .select('*')
    .eq('user_id', userId)
    .order('week_start_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function fetchWeeklyCheckin(userId, weekStartDate) {
  const { data, error } = await supabase
    .from('weekly_checkins')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartDate)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertWeeklyCheckin(userId, weekStartDate, fields) {
  const { data, error } = await supabase
    .from('weekly_checkins')
    .upsert({ user_id: userId, week_start_date: weekStartDate, ...fields }, { onConflict: 'user_id,week_start_date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function uploadProgressPhoto(userId, weekStartDate, file) {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${userId}/${weekStartDate}.${ext}`
  const { error } = await supabase.storage.from('progress-photos').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

export async function getProgressPhotoUrl(path) {
  if (!path) return null
  const { data, error } = await supabase.storage.from('progress-photos').createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}
