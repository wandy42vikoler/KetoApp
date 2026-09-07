import { supabase } from './supabaseClient'

export const FOOD_GUIDE_MEALS = ['breakfast', 'lunch', 'dinner', 'anytime']

export const EMPTY_FOOD_GUIDE = {
  eat: { breakfast: [], lunch: [], dinner: [], anytime: [] },
  avoid: { breakfast: [], lunch: [], dinner: [], anytime: [] },
}

export async function updateFoodGuide(userId, foodGuide) {
  const { error } = await supabase.from('profiles').update({ food_guide: foodGuide }).eq('id', userId)
  if (error) throw error
}
