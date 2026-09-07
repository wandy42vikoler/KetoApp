import { supabase } from './supabaseClient'
import { fetchLogForDate, upsertLogForDate, todayDateString } from './dailyLog'

// daily_logs.supplements is a jsonb map of { [supplementId]: true|false }.
// Missing and false both read as "not taken" — toggling off writes false
// (rather than deleting the key) so the row stays a complete record of
// what was shown that day, in case the stack changes later.
export async function fetchSupplementsForDate(userId, logDate) {
  const log = await fetchLogForDate(userId, logDate)
  return log?.supplements ?? {}
}

export async function toggleSupplement(userId, logDate, supplementId, taken) {
  const current = await fetchSupplementsForDate(userId, logDate)
  const next = { ...current, [supplementId]: taken }
  return upsertLogForDate(userId, logDate, { supplements: next })
}

export function toggleSupplementToday(userId, supplementId, taken) {
  return toggleSupplement(userId, todayDateString(), supplementId, taken)
}

export async function updateSupplementStack(userId, stack) {
  const { error } = await supabase.from('profiles').update({ supplement_stack: stack }).eq('id', userId)
  if (error) throw error
}
