import { useEffect, useState } from 'react'
import { Camera, Check } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { fetchLogForDate, fetchRecentLogs, upsertLogForDate, todayDateString } from '../../lib/dailyLog'
import { fileToBase64 } from '../../lib/image'
import Panel from '../../components/ui/Panel'
import Eyebrow from '../../components/ui/Eyebrow'
import SheetHeader from '../../components/ui/SheetHeader'
import { Field, SliderField } from '../../components/ui/FormField'

const EMPTY_FIELDS = {
  weight_kg: '',
  body_fat_pct: '',
  muscle_mass_kg: '',
  sleep_quality: 6,
  energy_level: 6,
  soreness_notes: '',
  notes: '',
}

export default function CheckIn({ date, onBack, onClose, onSaved }) {
  const { user } = useAuth()
  const logDate = date ?? todayDateString()
  const isToday = logDate === todayDateString()

  const [mode, setMode] = useState('manual')
  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [loadingExisting, setLoadingExisting] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [extracted, setExtracted] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    let active = true
    fetchLogForDate(user.id, logDate)
      .then((existing) => {
        if (!active || !existing) return
        setIsEditing(true)
        setFields((f) => ({
          ...f,
          weight_kg: existing.weight_kg ?? '',
          body_fat_pct: existing.body_fat_pct ?? '',
          muscle_mass_kg: existing.muscle_mass_kg ?? '',
          sleep_quality: existing.sleep_quality ?? 6,
          energy_level: existing.energy_level ?? 6,
          soreness_notes: existing.soreness_notes ?? '',
          notes: existing.notes ?? '',
        }))
      })
      .finally(() => {
        if (active) setLoadingExisting(false)
      })
    return () => {
      active = false
    }
  }, [user.id, logDate])

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
      const { data, error } = await supabase.functions.invoke('analyze-checkin-photo', {
        body: { image_base64: base64, media_type: mediaType },
      })
      if (error) throw error
      setFields((f) => ({
        ...f,
        weight_kg: data.weight_kg ?? f.weight_kg,
        body_fat_pct: data.body_fat_pct ?? f.body_fat_pct,
        muscle_mass_kg: data.muscle_mass_kg ?? f.muscle_mass_kg,
      }))
      setExtracted(true)
    } catch (err) {
      setAnalyzeError(err.message || 'Photo analysis failed.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const recent = await fetchRecentLogs(user.id, 7)

      const saved = await upsertLogForDate(user.id, logDate, {
        weight_kg: fields.weight_kg === '' ? null : Number(fields.weight_kg),
        body_fat_pct: fields.body_fat_pct === '' ? null : Number(fields.body_fat_pct),
        muscle_mass_kg: fields.muscle_mass_kg === '' ? null : Number(fields.muscle_mass_kg),
        sleep_quality: Number(fields.sleep_quality),
        energy_level: Number(fields.energy_level),
        soreness_notes: fields.soreness_notes || null,
        notes: fields.notes || null,
      })

      if (isToday) {
        try {
          const { data: noteData, error: noteError } = await supabase.functions.invoke('generate-checkin-note', {
            body: {
              today: saved,
              recent_days: recent.filter((d) => d.log_date !== logDate),
            },
          })
          if (!noteError && noteData?.note) {
            await supabase.from('daily_logs').update({ ai_note: noteData.note }).eq('id', saved.id)
          }
        } catch {
          // Note generation is best-effort — the check-in itself already saved.
        }
      }

      onSaved?.()
      onClose()
    } catch (err) {
      setSaveError(err.message || 'Could not save check-in.')
    } finally {
      setSaving(false)
    }
  }

  const showForm = mode === 'manual' || extracted

  const title = isToday
    ? isEditing
      ? 'EDIT CHECK-IN'
      : 'MORNING CHECK-IN'
    : `CHECK-IN — ${new Date(`${logDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  return (
    <div className="absolute inset-0 bg-bg z-20 flex flex-col overflow-y-auto">
      <SheetHeader title={title} onBack={onBack} onClose={onClose} />
      <div className="px-4 pb-8">
        {!loadingExisting && (
          <>
            <div className="flex gap-2 mb-3.5">
              {['manual', 'photo'].map((m) => (
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
                <Eyebrow>Scale Screenshot</Eyebrow>
                <label className="block h-[130px] rounded-[10px] border border-dashed border-hairline-lit flex items-center justify-center cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                  {analyzing ? (
                    <div className="font-mono text-[11px] text-fg-dim tracking-[0.1em] animate-pulse">
                      ANALYZING…
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-fg-dim">
                      <Camera size={22} />
                      <span className="font-mono text-[10.5px]">TAP TO UPLOAD</span>
                    </div>
                  )}
                </label>
                {analyzeError && <div className="font-mono text-[11px] text-alert mt-3">{analyzeError}</div>}
              </Panel>
            )}

            {showForm && (
              <>
                {mode === 'photo' && extracted && (
                  <div className="font-mono text-[10px] text-signal tracking-[0.1em] mb-2.5">
                    EXTRACTED FROM PHOTO — EDITABLE
                  </div>
                )}

                <Panel className="mb-3.5">
                  <Eyebrow>Body Composition</Eyebrow>
                  <div className="grid grid-cols-3 gap-2">
                    <Field
                      label="WEIGHT"
                      type="number"
                      unit="kg"
                      value={fields.weight_kg}
                      onChange={(v) => updateField('weight_kg', v)}
                    />
                    <Field
                      label="BF%"
                      type="number"
                      unit="%"
                      value={fields.body_fat_pct}
                      onChange={(v) => updateField('body_fat_pct', v)}
                    />
                    <Field
                      label="MUSCLE"
                      type="number"
                      unit="kg"
                      value={fields.muscle_mass_kg}
                      onChange={(v) => updateField('muscle_mass_kg', v)}
                    />
                  </div>
                </Panel>

                <Panel className="mb-3.5">
                  <Eyebrow>Sleep &amp; Energy</Eyebrow>
                  <div className="flex flex-col gap-4">
                    <SliderField
                      label="SLEEP QUALITY"
                      value={fields.sleep_quality}
                      onChange={(v) => updateField('sleep_quality', v)}
                    />
                    <SliderField
                      label="ENERGY LEVEL"
                      value={fields.energy_level}
                      onChange={(v) => updateField('energy_level', v)}
                    />
                  </div>
                </Panel>

                <Panel className="mb-3.5">
                  <Eyebrow>Notes</Eyebrow>
                  <div className="flex flex-col gap-3">
                    <Field
                      label="SORENESS"
                      value={fields.soreness_notes}
                      onChange={(v) => updateField('soreness_notes', v)}
                    />
                    <Field label="NOTES" value={fields.notes} onChange={(v) => updateField('notes', v)} />
                  </div>
                </Panel>

                {saveError && <div className="font-mono text-[11px] text-alert mb-3">{saveError}</div>}

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-signal disabled:opacity-40 rounded-[9px] py-2.5 text-[#06150F] font-mono text-[12px] font-bold flex items-center justify-center gap-1.5"
                >
                  <Check size={14} /> {saving ? 'SAVING…' : isEditing ? 'UPDATE CHECK-IN' : 'SAVE CHECK-IN'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
