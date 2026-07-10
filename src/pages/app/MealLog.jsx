import { useState } from 'react'
import { Camera, Check } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { upsertTodayLog } from '../../lib/dailyLog'
import { insertMeal } from '../../lib/meals'
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

export default function MealLog({ onBack, onClose, onSaved }) {
  const { user } = useAuth()
  const [mode, setMode] = useState('photo')
  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [confidence, setConfidence] = useState('manual')
  const [notes, setNotes] = useState(null)
  const [photoContext, setPhotoContext] = useState('')

  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [extracted, setExtracted] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  function updateField(key, value) {
    setFields((f) => ({ ...f, [key]: value }))
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
      const dailyLog = await upsertTodayLog(user.id, {})
      await insertMeal(user.id, dailyLog.id, {
        description: fields.description || null,
        protein_g: fields.protein_g === '' ? null : Number(fields.protein_g),
        fat_g: fields.fat_g === '' ? null : Number(fields.fat_g),
        net_carbs_g: fields.net_carbs_g === '' ? null : Number(fields.net_carbs_g),
        calories: fields.calories === '' ? null : Number(fields.calories),
        confidence: mode === 'manual' ? 'manual' : confidence,
        ai_notes: notes,
      })
      onSaved?.()
      onClose()
    } catch (err) {
      setSaveError(err.message || 'Could not save meal.')
    } finally {
      setSaving(false)
    }
  }

  const showForm = mode === 'manual' || extracted

  return (
    <div className="absolute inset-0 bg-bg z-20 flex flex-col overflow-y-auto">
      <SheetHeader title="LOG MEAL" onBack={onBack} onClose={onClose} />
      <div className="px-4 pb-8">
        <div className="flex gap-2 mb-3.5">
          {['photo', 'manual'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-[8px] font-mono text-[10.5px] tracking-wide border ${
                mode === m ? 'border-signal bg-signal-dim/40 text-signal' : 'border-hairline text-fg-muted'
              }`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        {mode === 'photo' && !extracted && (
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

        {showForm && (
          <>
            <Panel className="mb-3.5">
              <Eyebrow
                right={
                  mode === 'photo' ? (
                    <span className="font-mono text-[10px] text-caution">CONFIDENCE: {confidence.toUpperCase()}</span>
                  ) : null
                }
              >
                {mode === 'photo' ? 'AI Estimate — Editable' : 'Manual Entry'}
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

            {saveError && <div className="font-mono text-[11px] text-alert mb-3">{saveError}</div>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-signal disabled:opacity-40 rounded-[9px] py-2.5 text-[#06150F] font-mono text-[12px] font-bold flex items-center justify-center gap-1.5"
            >
              <Check size={14} /> {saving ? 'SAVING…' : 'ADD TO LOG'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
