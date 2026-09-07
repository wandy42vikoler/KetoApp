import { supabase } from './supabaseClient'
import { todayDateString } from './dailyLog'

export async function fetchMealsForDate(userId, logDate) {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', `${logDate}T00:00:00`)
    .lt('logged_at', `${logDate}T23:59:59.999`)
    .order('logged_at', { ascending: true })
  if (error) throw error
  return data
}

export function fetchTodayMeals(userId) {
  return fetchMealsForDate(userId, todayDateString())
}

export async function insertMeal(userId, dailyLogId, fields) {
  const { data, error } = await supabase
    .from('meals')
    .insert({ user_id: userId, daily_log_id: dailyLogId, ...fields })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateMeal(mealId, fields) {
  const { data, error } = await supabase.from('meals').update(fields).eq('id', mealId).select().single()
  if (error) throw error
  return data
}

export async function deleteMeal(mealId) {
  const { error } = await supabase.from('meals').delete().eq('id', mealId)
  if (error) throw error
}

// Rounds to 1 decimal — floating point addition otherwise produces values
// like 68.70000000000002 once a few meals are summed.
function round1(n) {
  return Math.round(n * 10) / 10
}

export function sumMealTotals(meals) {
  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein: acc.protein + (m.protein_g ?? 0),
      fat: acc.fat + (m.fat_g ?? 0),
      carbs: acc.carbs + (m.carbs_g ?? 0),
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  )
  return {
    calories: Math.round(totals.calories),
    protein: round1(totals.protein),
    fat: round1(totals.fat),
    carbs: round1(totals.carbs),
  }
}
