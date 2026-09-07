import { useEffect, useState } from 'react'
import { Plus, Sparkles, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import {
  SHOPPING_LIST_CATEGORIES,
  fetchShoppingList,
  insertShoppingListItem,
  updateShoppingListItem,
  deleteShoppingListItem,
  replaceAiShoppingItems,
  clearCheckedShoppingItems,
} from '../../lib/shoppingList'
import Panel from '../../components/ui/Panel'
import Eyebrow from '../../components/ui/Eyebrow'
import SheetHeader from '../../components/ui/SheetHeader'

export default function ShoppingList({ onBack, onClose }) {
  const { user, profile } = useAuth()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)

  const [newItem, setNewItem] = useState('')
  const [newCategory, setNewCategory] = useState('Other')
  const [adding, setAdding] = useState(false)

  async function load() {
    try {
      const rows = await fetchShoppingList(user.id)
      setItems(rows)
    } catch (err) {
      setLoadError(err.message || 'Could not load shopping list.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setGenerateError(null)
    try {
      const { data, error } = await supabase.functions.invoke('generate-shopping-list', {
        body: { food_guide: profile?.food_guide },
      })
      if (error) throw error
      await replaceAiShoppingItems(user.id, data.items ?? [])
      await load()
    } catch (err) {
      setGenerateError(err.message || 'Could not generate a shopping list — check your Food Guide is filled in.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleToggle(item) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)))
    try {
      await updateShoppingListItem(item.id, { checked: !item.checked })
    } catch {
      load() // revert to server state on failure
    }
  }

  async function handleDelete(id) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    try {
      await deleteShoppingListItem(id)
    } catch {
      load()
    }
  }

  async function handleAdd() {
    if (!newItem.trim()) return
    setAdding(true)
    try {
      const row = await insertShoppingListItem(user.id, {
        item: newItem.trim(),
        category: newCategory,
        source: 'manual',
      })
      setItems((prev) => [...prev, row])
      setNewItem('')
    } catch (err) {
      setLoadError(err.message || 'Could not add item.')
    } finally {
      setAdding(false)
    }
  }

  async function handleClearChecked() {
    const checkedIds = new Set(items.filter((i) => i.checked).map((i) => i.id))
    setItems((prev) => prev.filter((i) => !checkedIds.has(i.id)))
    try {
      await clearCheckedShoppingItems(user.id)
    } catch {
      load()
    }
  }

  const hasChecked = items.some((i) => i.checked)
  const grouped = SHOPPING_LIST_CATEGORIES.map((cat) => ({
    category: cat,
    rows: items.filter((i) => i.category === cat),
  })).filter((g) => g.rows.length > 0)

  return (
    <div className="absolute inset-0 bg-bg z-20 flex flex-col overflow-y-auto">
      <SheetHeader title="SHOPPING LIST" onBack={onBack} onClose={onClose} />
      <div className="px-4 pb-8">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full mb-3.5 bg-transparent border border-dashed border-hairline-lit disabled:opacity-50 rounded-[9px] py-2.5 text-info font-mono text-[11.5px] tracking-wide flex items-center justify-center gap-1.5"
        >
          <Sparkles size={13} /> {generating ? 'UPDATING…' : 'UPDATE WITH AI (FROM FOOD GUIDE)'}
        </button>
        {generateError && <div className="font-mono text-[11px] text-alert mb-3.5">{generateError}</div>}

        {loading ? (
          <div className="font-mono text-[11px] text-fg-dim text-center py-10">LOADING…</div>
        ) : (
          <>
            {loadError && <div className="font-mono text-[11px] text-alert mb-3.5">{loadError}</div>}

            {items.length === 0 && !generating && (
              <div className="font-mono text-[11px] text-fg-dim text-center py-6 leading-relaxed mb-3.5">
                No items yet. Tap "Update with AI" to build a list from your Food Guide, or add items manually
                below.
              </div>
            )}

            {grouped.map((group) => (
              <Panel key={group.category} className="mb-3.5">
                <Eyebrow>{group.category}</Eyebrow>
                <div className="flex flex-col gap-2">
                  {group.rows.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-2.5 bg-panel-raised border border-hairline rounded-[9px] px-3 py-2"
                    >
                      <input type="checkbox" checked={row.checked} onChange={() => handleToggle(row)} />
                      <span className={`flex-1 text-[12.5px] ${row.checked ? 'text-fg-dim line-through' : 'text-fg'}`}>
                        {row.item}
                      </span>
                      <button onClick={() => handleDelete(row.id)} className="bg-transparent border-none text-fg-dim flex-shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </Panel>
            ))}

            {hasChecked && (
              <button
                onClick={handleClearChecked}
                className="w-full mb-3.5 bg-transparent border-none text-alert font-mono text-[11px] py-1 flex items-center justify-center gap-1.5"
              >
                <Trash2 size={12} /> CLEAR CHECKED ITEMS
              </button>
            )}

            <Panel>
              <Eyebrow>Add Item</Eyebrow>
              <div className="flex gap-2 mb-2.5">
                <input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="e.g. Greek yogurt"
                  className="flex-1 bg-panel-raised border border-hairline rounded-[8px] px-3 py-2 text-[12.5px] text-fg outline-none focus:border-signal"
                />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-[124px] bg-panel-raised border border-hairline rounded-[8px] px-2 py-2 text-[11px] text-fg outline-none focus:border-signal"
                >
                  {SHOPPING_LIST_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAdd}
                disabled={adding || !newItem.trim()}
                className="w-full border border-dashed border-hairline-lit disabled:opacity-40 rounded-[9px] py-2.5 text-fg-muted font-mono text-[11.5px] flex items-center justify-center gap-1.5"
              >
                <Plus size={13} /> ADD ITEM
              </button>
            </Panel>
          </>
        )}
      </div>
    </div>
  )
}
