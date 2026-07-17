import { useEffect, useState } from 'react'
import { Camera, Check, Trash2, Star, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { upsertLogForDate, todayDateString } from '../../lib/dailyLog'
import { insertMeal, updateMeal, deleteMeal } from '../../lib/meals'
import { fetchFavoriteMeals, insertFavoriteMeal, deleteFavoriteMeal } from '../../lib/favoriteMeals'
import { fileToBase64 } from '../../lib/image'
import Panel from '../../components/ui/Panel'
import Eyebrow from '../../components/ui/Eyebrow'
import SheetHeader from '../../components/ui/SheetHeader'
import { Field } from '../../components/ui/FormField'

const EMPTY_FIELDS = {
  description: '',
  protein_g: '',
  fat_g: '',
  net_carbs_g: '',
  calories: '',
}

function fieldsFromMeal(meal) {
  return {
    description: meal.description ?? '',
    protein_g: meal.protein_g ?? '',
    fat_g: meal.fat_g ?? '',
    net_carbs_g: meal.net_carbs_g ?? '',
    calories: meal.calories ?? '',
  }
}

export default function MealLog({ date, meal, onBack, onClose, onSaved }) {
  const { user } = useAuth()
  const logDate = date ?? todayDateString()
  const isEditing = Boolean(meal?.id)

  const [mode, setMode] = useState('photo')
  const [fields, setFields] = useState(() => (isEditing ? fieldsFromMeal(meal) : EMPTY_FIELDS))
  const [confidence, setConfidence] = useState(meal?.confidence ?? 'manual')
  const [notes, setNotes] = useState(meal?.ai_notes ?? null)
  const [photoContext, setPhotoContext] = useState('')

  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [extracted, setExtracted] = useState(false)

  const [favorites, setFavorites] = useState([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [favoritesFetched, setFavoritesFetched] = useState(false)
  const [favoritesError, setFavoritesError] = useState(null)
  const [favoriteSelected, setFavoriteSelected] = useState(false)
  const [confirmDeleteFavId, setConfirmDeleteFavId] = useState(null)
  const [saveAsFavorite, setSaveAsFavorite] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (mode !== 'favorites' || favoritesFetched) return
    let active = true
    setFavoritesLoading(true)
    fetchFavoriteMeals(user.id)
      .then((rows) => active && setFavorites(rows))
      .catch((err) => active && setFavoritesError(err.message || 'Could not load favorites.'))
      .finally(() => {
        if (!active) return
        setFavoritesLoading(false)
        setFavoritesFetched(true)
      })
    return () => {
      active = false
    }
  }, [mode, user.id, favoritesFetched])

  function updateField(key, value) {
    setFields((f) => ({ ...f, [key]: value }))
  }

  function selectFavorite(fav) {
    setFields({
      description: fav.description ?? '',
      protein_g: fav.protein_g ?? '',
      fat_g: fav.fat_g ?? '',
      net_carbs_g: fav.net_carbs_g ?? '',
      calories: fav.calories ?? '',
    })
    setConfidence('manual')
    setNotes(null)
    setFavoriteSelected(true)
  }

  async function handleDeleteFavorite(id) {
    try {
      await deleteFavoriteMeal(id)
      setFavorites((f) => f.filter((fav) => fav.id !== id))
    } catch (err) {
      setFavoritesError(err.message || 'Could not delete favorite.')
    } finally {
      setConfirmDeleteFavId(null)
    }
  }

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const { base64, mediaType } = await fileToBase64(file)
      const { data, error } = await supabase.functions.invoke('analyze-meal', {
        body: { image_base64: base64, media_type: mediaType, user_context: photoContext || undefined },
      })
      if (error) throw error
      setFields({
        description: data.description ?? '',
        protein_g: data.protein_g ?? '',
        fat_g: data.fat_g ?? '',
        net_carbs_g: data.net_carbs_g ?? '',
        calories: data.calories ?? '',
      })
      setConfidence(data.confidence ?? 'medium')
      setNotes(data.notes ?? null)
      setExtracted(true)
    } catch (err) {
      setAnalyzeError(err.message || 'Meal analysis failed.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const macroFields = {
        description: fields.description || null,
        protein_g: fields.protein_g === '' ? null : Number(fields.protein_g),
        fat_g: fields.fat_g === '' ? null : Number(fields.fat_g),
        net_carbs_g: fields.net_carbs_g === '' ? null : Number(fields.net_carbs_g),
        calories: fields.calories === '' ? null : Number(fields.calories),
      }

      if (isEditing) {
        await updateMeal(meal.id, macroFields)
      } else {
        const dailyLog = await upsertLogForDate(user.id, logDate, {})
        const loggedAt = logDate === todayDateString() ? undefined : `${logDate}T12:00:00`
        await insertMeal(user.id, dailyLog.id, {
          ...macroFields,
          confidence: mode === 'manual' || mode === 'favorites' ? 'manual' : confidence,
          ai_notes: notes,
          ...(loggedAt ? { logged_at: loggedAt } : {}),
        })
      }

      if (saveAsFavorite && fields.description) {
        await insertFavoriteMeal(user.id, macroFields)
      }

      onSaved?.()
      onClose()
    } catch (err) {
      setSaveError(err.message || 'Could not save meal.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setSaveError(null)
    try {
      await deleteMeal(meal.id)
      onSaved?.()
      onClose()
    } catch (err) {
      setSaveError(err.message || 'Could not delete meal.')
      setDeleting(false)
    }
  }

  const showForm = isEditing || mode === 'manual' || extracted || favoriteSelected

  return (
    <div className="absolute inset-0 bg-bg z-20 flex flex-col overflow-y-auto">
      <SheetHeader title={isEditing ? 'EDIT MEAL' : 'LOG MEAL'} onBack={onBack} onClose={onClose} />
      <div className="px-4 pb-8">
        {!isEditing && (
          <div className="flex gap-2 mb-3.5">
            {['photo', 'manual', 'favorites'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-[8px] font-mono text-[10px] tracking-wide border ${
                  mode === m ? 'border-signal bg-signal-dim/40 text-signal' : 'border-hairline text-fg-muted'
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {!isEditing && mode === 'photo' && !extracted && (
          <Panel className="mb-3.5">
            <Eyebrow>Meal Photo</Eyebrow>
            <label className="block h-[150px] rounded-[10px] border border-dashed border-hairline-lit flex items-center justify-center cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              {analyzing ? (
                <div className="font-mono text-[11px] text-fg-dim tracking-[0.1em] animate-pulse">ANALYZING…</div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-fg-dim">
                  <Camera size={22} />
                  <span className="font-mono text-[10.5px]">TAP TO UPLOAD</span>
                </div>
              )}
            </label>
            {analyzeError && <div className="font-mono text-[11px] text-alert mt-3">{analyzeError}</div>}
            <div className="mt-3">
              <Field
                label="DESCRIBE IT (OPTIONAL)"
                value={photoContext}
                onChange={setPhotoContext}
                placeholder="e.g. two grilled chicken breasts, roughly 200g each"
                disabled={analyzing}
              />
            </div>
          </Panel>
        )}

        {!isEditing && mode === 'favorites' && !favoriteSelected && (
          <Panel className="mb-3.5">
            <Eyebrow>Saved Favorites</Eyebrow>
            {favoritesLoading || !favoritesFetched ? (
              <div className="font-mono text-[11px] text-fg-dim text-center py-6">LOADING…</div>
            ) : favorites.length === 0 ? (
              <div className="font-mono text-[11px] text-fg-dim text-center py-6 leading-relaxed">
                No favorites saved yet.
                <br />
                Log a meal and toggle "Save as Favorite" to build your list.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {favorites.map((fav) => (
                  <div
                    key={fav.id}
                    className="flex items-center gap-2 bg-panel-raised border border-hairline rounded-[10px] px-3 py-2.5"
                  >
                    <button onClick={() => selectFavorite(fav)} className="flex-1 min-w-0 text-left bg-transparent border-none">
                      <div className="text-[12.5px] text-fg truncate">{fav.description}</div>
                      <div className="font-mono text-[10px] text-fg-dim">
                        P{fav.protein_g ?? 0} · F{fav.fat_g ?? 0} · C{fav.net_carbs_g ?? 0} · {fav.calories ?? 0}kcal
                      </div>
                    </button>
                    {confirmDeleteFavId === fav.id ? (
                      <button
                        onClick={() => handleDeleteFavorite(fav.id)}
                        className="font-mono text-[10px] text-alert bg-transparent border border-alert rounded-[6px] px-2 py-1 flex-shrink-0"
                      >
                        CONFIRM
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteFavId(fav.id)}
                        className="bg-transparent border-none text-fg-dim flex-shrink-0"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {favoritesError && <div className="font-mono text-[11px] text-alert mt-3">{favoritesError}</div>}
          </Panel>
        )}

        {showForm && (
          <>
            <Panel className="mb-3.5">
              <Eyebrow
                right={
                  !isEditing && mode === 'photo' ? (
                    <span className="font-mono text-[10px] text-caution">CONFIDENCE: {confidence.toUpperCase()}</span>
                  ) : null
                }
              >
                {isEditing
                  ? 'Editable'
                  : mode === 'photo'
                    ? 'AI Estimate — Editable'
                    : mode === 'favorites'
                      ? 'From Favorites — Editable'
                      : 'Manual Entry'}
              </Eyebrow>

              <div className="mb-3">
                <Field label="DESCRIPTION" value={fields.description} onChange={(v) => updateField('description', v)} />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Field
                  label="PROTEIN"
                  type="number"
                  unit="g"
                  value={fields.protein_g}
                  onChange={(v) => updateField('protein_g', v)}
                />
                <Field
                  label="FAT"
                  type="number"
                  unit="g"
                  value={fields.fat_g}
                  onChange={(v) => updateField('fat_g', v)}
                />
                <Field
                  label="NET CARBS"
                  type="number"
                  unit="g"
                  value={fields.net_carbs_g}
                  onChange={(v) => updateField('net_carbs_g', v)}
                />
                <Field
                  label="CALORIES"
                  type="number"
                  value={fields.calories}
                  onChange={(v) => updateField('calories', v)}
                />
              </div>

              {notes && <div className="font-mono text-[10.5px] text-caution mt-3 leading-relaxed">{notes}</div>}
            </Panel>

            {mode !== 'favorites' && (
              <button
                onClick={() => setSaveAsFavorite((s) => !s)}
                className={`w-full flex items-center justify-center gap-1.5 rounded-[9px] py-2.5 mb-3.5 font-mono text-[11.5px] border ${
                  saveAsFavorite ? 'border-signal bg-signal-dim/40 text-signal' : 'border-hairline-lit text-fg-muted'
                }`}
              >
                <Star size={13} fill={saveAsFavorite ? 'currentColor' : 'none'} /> SAVE AS FAVORITE
              </button>
            )}

            {saveError && <div className="font-mono text-[11px] text-alert mb-3">{saveError}</div>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-signal disabled:opacity-40 rounded-[9px] py-2.5 text-[#06150F] font-mono text-[12px] font-bold flex items-center justify-center gap-1.5"
            >
              <Check size={14} /> {saving ? 'SAVING…' : isEditing ? 'UPDATE MEAL' : 'ADD TO LOG'}
            </button>

            {isEditing && (
              <div className="mt-2.5">
                {confirmingDelete ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmingDelete(false)}
                      className="flex-1 bg-transparent border border-hairline-lit rounded-[9px] py-2.5 text-fg-muted font-mono text-[11.5px]"
                    >
                      CANCEL
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 bg-alert-dim border border-alert disabled:opacity-50 rounded-[9px] py-2.5 text-alert font-mono text-[11.5px] font-bold"
                    >
                      {deleting ? 'DELETING…' : 'CONFIRM DELETE'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="w-full bg-transparent border-none text-alert font-mono text-[11px] py-1 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={12} /> DELETE MEAL
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
