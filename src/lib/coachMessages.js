import { supabase } from './supabaseClient'

const HISTORY_LIMIT = 60

export async function fetchCoachMessages(userId) {
  const { data, error } = await supabase
    .from('coach_messages')
    .select('role, text, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  if (error) throw error
  return data.reverse()
}

export async function insertCoachMessage(userId, role, text) {
  const { error } = await supabase.from('coach_messages').insert({ user_id: userId, role, text })
  if (error) throw error
}
