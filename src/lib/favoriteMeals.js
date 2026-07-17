import { supabase } from './supabaseClient'

export async function fetchFavoriteMeals(userId) {
  const { data, error } = await supabase
    .from('favorite_meals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function insertFavoriteMeal(userId, fields) {
  const { data, error } = await supabase
    .from('favorite_meals')
    .insert({ user_id: userId, ...fields })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteFavoriteMeal(id) {
  const { error } = await supabase.from('favorite_meals').delete().eq('id', id)
  if (error) throw error
}
