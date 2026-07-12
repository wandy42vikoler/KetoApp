import { supabase } from './supabaseClient'

export async function fetchLeaderboard() {
  const { data, error } = await supabase.rpc('get_leaderboard')
  if (error) throw error

  const achieved = data.filter((r) => r.achieved).sort((a, b) => (b.total_lost_kg ?? 0) - (a.total_lost_kg ?? 0))
  const inProgress = data
    .filter((r) => !r.achieved)
    .sort((a, b) => (b.progress_pct ?? -Infinity) - (a.progress_pct ?? -Infinity))

  return [...achieved, ...inProgress]
}

export async function setLeaderboardOptIn(userId, value) {
  const { error } = await supabase.from('profiles').update({ on_leaderboard: value }).eq('id', userId)
  if (error) throw error
}

export async function setDisplayName(userId, name) {
  const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', userId)
  if (error) throw error
}
