import { supabase } from './supabaseClient'
import { fetchLogsInRange, fetchProgressSummary, todayDateString } from './dailyLog'
import { fetchTodayMeals, sumMealTotals } from './meals'
import { fetchWorkoutsInRange } from './workouts'

const HISTORY_WINDOW_DAYS = 30

function windowStart(protocolStartDate, today) {
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - HISTORY_WINDOW_DAYS)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return protocolStartDate && protocolStartDate > cutoffStr ? protocolStartDate : cutoffStr
}

// Assembles a fresh snapshot of the user's real data — progress, recent
// check-ins, recent workouts, today's target vs. actual — sent to coach-chat
// on every message so answers are always grounded in current numbers, never
// stale or hypothetical.
export async function buildCoachContext(userId, profile) {
  const today = todayDateString()
  const start = windowStart(profile?.protocol_start_date, today)

  const [progress, recentLogs, recentWorkouts, todayMeals] = await Promise.all([
    fetchProgressSummary(userId),
    fetchLogsInRange(userId, start, today),
    fetchWorkoutsInRange(userId, start, today),
    fetchTodayMeals(userId),
  ])

  const todayLog = recentLogs.find((l) => l.log_date === today) ?? null
  const dayType = todayLog?.day_type ?? 'rest'

  const { data: target } = await supabase
    .from('targets')
    .select('calories, protein_g, fat_g, net_carbs_g')
    .eq('user_id', userId)
    .eq('day_type', dayType)
    .maybeSingle()

  return {
    profile: {
      height_cm: profile?.height_cm,
      gender: profile?.gender,
      activity_level: profile?.activity_level,
      starting_weight_kg: profile?.starting_weight_kg,
      goal_weight_kg: profile?.goal_weight_kg,
      goal_timeline_weeks: profile?.goal_timeline_weeks,
      protocol_start_date: profile?.protocol_start_date,
    },
    progress,
    today: {
      date: today,
      day_type: dayType,
      target,
      totals: sumMealTotals(todayMeals),
      check_in: todayLog,
    },
    recent_logs: recentLogs.map((l) => ({
      date: l.log_date,
      day_type: l.day_type,
      weight_kg: l.weight_kg,
      body_fat_pct: l.body_fat_pct,
      muscle_mass_kg: l.muscle_mass_kg,
      sleep_quality: l.sleep_quality,
      energy_level: l.energy_level,
      meal_score: l.meal_score,
      soreness_notes: l.soreness_notes,
    })),
    recent_workouts: recentWorkouts.map((w) => ({
      date: w.logged_at?.slice(0, 10),
      activity_name: w.activity_name,
      duration_minutes: w.duration_minutes,
      exercise_count: w.exercises?.length ?? 0,
    })),
  }
}
