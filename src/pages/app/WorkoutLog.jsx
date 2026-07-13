import { useState } from 'react'
import { Camera, Check, Plus, X, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { upsertLogForDate, todayDateString, fetchProgressSummary } from '../../lib/dailyLog'
import { insertWorkout, updateWorkout, deleteWorkout } from '../../lib/workouts'
import { fileToBase64 } from '../../lib/image'
import Panel from '../../components/ui/Panel'
import Eyebrow from '../../components/ui/Eyebrow'
import SheetHeader from '../../components/ui/SheetHeader'
import { Field } from '../../components/ui/FormField'

const EMPTY_FIELDS = { activity_name: '', duration_minutes: '', calories_burned: '', exercises: [] }

function fieldsFromWorkout(workout) {
  return {
    activity_name: workout.activity_name ?? '',
    duration_minutes: workout.duration_minutes ?? '',
    calories_burned: workout.calories_burned ?? '',
    exercises: (workout.exercises ?? []).map((ex) => ({
      name: ex.name ?? '',
      sets: (ex.sets ?? []).map((s) => ({ reps: s.reps ?? '', weight_kg: s.weight_kg ?? '' })),
    })),
  }
}

export default function WorkoutLog({ date, workout, onBack, onClose, onSaved }) {
  const { user, profile } = useAuth()
  const logDate = date ?? todayDateString()
  const isEditing = Boolean(workout?.id)

  const [mode, setMode] = useState('photo')
  const [fields, setFields] = useState(() => (isEditing ? fieldsFromWorkout(workout) : EMPTY_FIELDS))
  const [rawExtraction, setRawExtraction] = useState(null)

  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [extracted, setExtracted] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function updateField(key, value) {
    setFields((f) => ({ ...f, [key]: value }))
  }

  function addExercise() {
    setFields((f) => ({ ...f, exercises: [...f.exercises, { name: '', sets: [{ reps: '', weight_kg: '' }] }] }))
  }

  function removeExercise(i) {
    setFields((f) => ({ ...f, exercises: f.exercises.filter((_, idx) => idx !== i) }))
  }

  function updateExerciseName(i, value) {
    setFields((f) => ({
      ...f,
      exercises: f.exercises.map((ex, idx) => (idx === i ? { ...ex, name: value } : ex)),
    }))
  }

  function addSet(i) {
    setFields((f) => ({
      ...f,
      exercises: f.exercises.map((ex, idx) =>
        idx === i ? { ...ex, sets: [...ex.sets, { reps: '', weight_kg: '' }] } : ex,
      ),
    }))
  }

  function removeSet(i, setIdx) {
    setFields((f) => ({
      ...f,
      exercises: f.exercises.map((ex, idx) =>
        idx === i ? { ...ex, sets: ex.sets.filter((_, sIdx) => sIdx !== setIdx) } : ex,
      ),
    }))
  }

  function updateSet(i, setIdx, key, value) {
    setFields((f) => ({
      ...f,
      exercises: f.exercises.map((ex, idx) =>
        idx === i
          ? { ...ex, sets: ex.sets.map((s, sIdx) => (sIdx === setIdx ? { ...s, [key]: value } : s)) }
          : ex,
      ),
    }))
  }

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const { base64, mediaType } = await fileToBase64(file)
      const progress = await fetchProgressSummary(user.id).catch(() => null)
      const weight_kg = progress?.current_weight_kg ?? profile?.starting_weight_kg ?? undefined

      const { data, error } = await supabase.functions.invoke('analyze-workout-photo', {
        body: { image_base64: base64, media_type: mediaType, weight_kg },
      })
      if (error) throw error
      setFields({
        activity_name: data.activity_name ?? '',
        duration_minutes: data.duration_minutes ?? '',
        calories_burned: data.calories_burned ?? '',
        exercises: data.exercises ?? [],
      })
      setRawExtraction(data)
      setExtracted(true)
    } catch (err) {
      setAnalyzeError(err.message || 'Workout analysis failed.')
    } finally {
      setAnalyzing(false)
    }
  }

  function packExercises() {
    return fields.exercises
      .filter((ex) => ex.name)
      .map((ex) => ({
        name: ex.name,
        sets: ex.sets
          .filter((s) => s.reps !== '' || s.weight_kg !== '')
          .map((s) => ({
            reps: s.reps === '' ? null : Number(s.reps),
            weight_kg: s.weight_kg === '' ? null : Number(s.weight_kg),
          })),
      }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const exercises = packExercises()
      const activityFields = {
        activity_name: fields.activity_name || 'Workout',
        duration_minutes: fields.duration_minutes === '' ? null : Number(fields.duration_minutes),
        calories_burned: fields.calories_burned === '' ? null : Number(fields.calories_burned),
        exercises: exercises.length > 0 ? exercises : null,
      }

      if (isEditing) {
        await updateWorkout(workout.id, activityFields)
      } else {
        // Ensure the daily_logs row exists before we can link the workout.
        const dailyLog = await upsertLogForDate(user.id, logDate, {})
        const loggedAt = logDate === todayDateString() ? undefined : `${logDate}T12:00:00`

        await insertWorkout(user.id, dailyLog.id, {
          ...activityFields,
          source: mode === 'photo' ? 'photo' : 'manual',
          raw_ai_extraction: mode === 'photo' ? rawExtraction : null,
          ...(loggedAt ? { logged_at: loggedAt } : {}),
        })

        // day_type is derived from whether a workouts row exists that day —
        // the ensure-call above ran before this insert, so re-derive now.
        await upsertLogForDate(user.id, logDate, {})
      }

      onSaved?.()
      onClose()
    } catch (err) {
      setSaveError(err.message || 'Could not save workout.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setSaveError(null)
    try {
      await deleteWorkout(workout.id)
      // Removing the last workout of the day should revert day_type to 'rest'.
      await upsertLogForDate(user.id, logDate, {})
      onSaved?.()
      onClose()
    } catch (err) {
      setSaveError(err.message || 'Could not delete workout.')
      setDeleting(false)
    }
  }

  const showForm = isEditing || mode === 'manual' || extracted

  return (
    <div className="absolute inset-0 bg-bg z-20 flex flex-col overflow-y-auto">
      <SheetHeader title={isEditing ? 'EDIT WORKOUT' : 'LOG WORKOUT'} onBack={onBack} onClose={onClose} />
      <div className="px-4 pb-8">
        {!isEditing && (
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
            <button
              disabled
              className="flex-1 py-2 rounded-[8px] font-mono text-[10.5px] tracking-wide border border-hairline text-fg-dim opacity-40"
            >
              STRAVA
            </button>
          </div>
        )}

        {!isEditing && mode === 'photo' && !extracted && (
          <Panel className="mb-3.5">
            <Eyebrow>Training App Screenshot</Eyebrow>
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
          </Panel>
        )}

        {showForm && (
          <>
            <Panel className="mb-3.5">
              <Eyebrow>{isEditing ? 'Editable' : mode === 'photo' ? 'AI-Extracted — Editable' : 'Manual Entry'}</Eyebrow>
              <div className="flex flex-col gap-3">
                <Field
                  label="ACTIVITY NAME"
                  value={fields.activity_name}
                  onChange={(v) => updateField('activity_name', v)}
                  placeholder="e.g. Leg Day, Tennis"
                />
                <Field
                  label="DURATION"
                  type="number"
                  unit="min"
                  value={fields.duration_minutes}
                  onChange={(v) => updateField('duration_minutes', v)}
                />
                <Field
                  label="CALORIES BURNED"
                  type="number"
                  unit="kcal"
                  value={fields.calories_burned}
                  onChange={(v) => updateField('calories_burned', v)}
                />
              </div>
            </Panel>

            <Panel className="mb-3.5">
              <Eyebrow>Exercises (Optional)</Eyebrow>
              <div className="flex flex-col gap-3">
                {fields.exercises.map((ex, i) => (
                  <div key={i} className="bg-panel-raised border border-hairline rounded-[10px] p-3">
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="flex-1">
                        <Field
                          label="EXERCISE"
                          value={ex.name}
                          onChange={(v) => updateExerciseName(i, v)}
                          placeholder="e.g. Barbell Squat"
                        />
                      </div>
                      <button
                        onClick={() => removeExercise(i)}
                        className="bg-transparent border-none text-fg-dim mt-4"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    {ex.sets.map((s, sIdx) => (
                      <div key={sIdx} className="flex items-center gap-2 mb-1.5">
                        <input
                          type="number"
                          value={s.reps}
                          onChange={(e) => updateSet(i, sIdx, 'reps', e.target.value)}
                          placeholder="reps"
                          className="w-full bg-panel border border-hairline rounded-[6px] px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-signal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-fg-dim font-mono text-[11px]">×</span>
                        <input
                          type="number"
                          value={s.weight_kg}
                          onChange={(e) => updateSet(i, sIdx, 'weight_kg', e.target.value)}
                          placeholder="kg"
                          className="w-full bg-panel border border-hairline rounded-[6px] px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-signal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          onClick={() => removeSet(i, sIdx)}
                          className="bg-transparent border-none text-fg-dim flex-shrink-0"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addSet(i)}
                      className="font-mono text-[10.5px] text-info bg-transparent border-none mt-1"
                    >
                      + ADD SET
                    </button>
                  </div>
                ))}

                <button
                  onClick={addExercise}
                  className="w-full border border-dashed border-hairline-lit rounded-[9px] py-2.5 text-fg-muted font-mono text-[11.5px] flex items-center justify-center gap-1.5"
                >
                  <Plus size={13} /> ADD EXERCISE
                </button>
              </div>
            </Panel>

            {saveError && <div className="font-mono text-[11px] text-alert mb-3">{saveError}</div>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-signal disabled:opacity-40 rounded-[9px] py-2.5 text-[#06150F] font-mono text-[12px] font-bold flex items-center justify-center gap-1.5"
            >
              <Check size={14} /> {saving ? 'SAVING…' : isEditing ? 'UPDATE WORKOUT' : 'CONFIRM & LOG'}
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
                    <Trash2 size={12} /> DELETE WORKOUT
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
