import { supabase } from './supabaseClient'

export const SHOPPING_LIST_CATEGORIES = [
  'Produce',
  'Protein',
  'Dairy & Eggs',
  'Pantry & Grains',
  'Frozen',
  'Beverages',
  'Other',
]

export async function fetchShoppingList(userId) {
  const { data, error } = await supabase
    .from('shopping_list_items')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function insertShoppingListItem(userId, fields) {
  const { data, error } = await supabase
    .from('shopping_list_items')
    .insert({ user_id: userId, ...fields })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateShoppingListItem(id, fields) {
  const { data, error } = await supabase.from('shopping_list_items').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteShoppingListItem(id) {
  const { error } = await supabase.from('shopping_list_items').delete().eq('id', id)
  if (error) throw error
}

// Replaces every AI-derived row with a freshly generated set, leaving any
// manually-added items (and their checked state) untouched.
export async function replaceAiShoppingItems(userId, items) {
  const { error: deleteError } = await supabase
    .from('shopping_list_items')
    .delete()
    .eq('user_id', userId)
    .eq('source', 'ai')
  if (deleteError) throw deleteError

  if (items.length === 0) return []

  const rows = items.map((it, i) => ({
    user_id: userId,
    item: it.item,
    category: it.category,
    source: 'ai',
    sort_order: i,
  }))
  const { data, error } = await supabase.from('shopping_list_items').insert(rows).select()
  if (error) throw error
  return data
}

export async function clearCheckedShoppingItems(userId) {
  const { error } = await supabase.from('shopping_list_items').delete().eq('user_id', userId).eq('checked', true)
  if (error) throw error
}
