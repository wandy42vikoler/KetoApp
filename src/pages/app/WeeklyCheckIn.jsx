import { useEffect, useState } from 'react'
import { Camera, Check, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { fetchLogsInRange } from '../../lib/dailyLog'
import { fetchWorkoutsInRange } from '../../lib/workouts'
import { fileToBase64 } from '../../lib/image'
import {
  currentWeekStart,
  fetchWeeklyCheckin,
  upsertWeeklyCheckin,
  uploadProgressPhoto,
  getProgressPhotoUrl,
} from '../../lib/weeklyCheckins'
import Panel from '../../components/ui/Panel'
import Eyebrow from '../../components/ui/Eyebrow'
import SheetHeader from '../../components/ui/SheetHeader'

function previousWeekStart(weekStart) {
  const d = new Date(`${weekStart}T00:00:00`)
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

// Fetches an existing progress photo (by storage path) and returns it in
// the same { base64, mediaType } shape fileToBase64 produces, for sending
// to the vision endpoint alongside this week's newly-picked photo.
async function existingPhotoToBase64(photoPath) {
  const url = await getProgressPhotoUrl(photoPath)
  if (!url) return null
  const res = await fetch(url)
  const blob = await res.blob()
  return fileToBase64(blob)
}

export default function WeeklyCheckIn({ onBack, onClose, onSaved }) {
  const { user, profile } = useAuth()
  const weekStart = currentWeekStart()

  const [loading, setLoading] = useState(true)
  const [existing, setExisting] = useState(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null)
  const [summary, setSummary] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [photoAssessment, setPhotoAssessment] = useState(null)

  useEffect(() => {
    let active = true
    fetchWeeklyCheckin(user.id, weekStart)
      .then(async (row) => {
        if (!active || !row) return
        setExisting(row)
        setSummary(row.summary ?? '')
        setFeedback(row.ai_feedback ?? null)
        setPhotoAssessment(row.photo_assessment ?? null)
        if (row.photo_path) {
          const url = await getProgressPhotoUrl(row.photo_path).catch(() => null)
          if (active) setExistingPhotoUrl(url)
        }
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, weekStart])

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      let photo_path = existing?.photo_path ?? null
      if (photoFile) {
        photo_path = await uploadProgressPhoto(user.id, weekStart, photoFile)
      }
      await upsertWeeklyCheckin(user.id, weekStart, { summary: summary || null, photo_path })

      onSaved?.()

      // Best-effort AI feedback on the week — never blocks the save. Two
      // independent calls: a data-driven note (summary vs logged numbers)
      // and, only when a fresh photo was picked this session, a vision
      // assessment of the photo itself (compared against last week's, if
      // one exists).
      let feedbackText = null
      let photoAssessmentText = null
      try {
        const weekEnd = new Date(`${weekStart}T00:00:00`)
        weekEnd.setDate(weekEnd.getDate() + 6)
        const weekEndStr = weekEnd.toISOString().slice(0, 10)
        const [logs, workouts] = await Promise.all([
          fetchLogsInRange(user.id, weekStart, weekEndStr),
          fetchWorkoutsInRange(user.id, weekStart, weekEndStr),
        ])

        const notePromise = supabase.functions
          .invoke('generate-weekly-note', {
            body: { summary, recent_daily_logs: logs, workouts_count: workouts.length },
          })
          .catch(() => null)

        const photoPromise = photoFile
          ? (async () => {
              const { base64, mediaType } = await fileToBase64(photoFile)
              let previous = null
              try {
                const prevCheckin = await fetchWeeklyCheckin(user.id, previousWeekStart(weekStart))
                if (prevCheckin?.photo_path) previous = await existingPhotoToBase64(prevCheckin.photo_path)
              } catch {
                // no previous photo to compare against — fine
              }
              return supabase.functions.invoke('assess-weekly-photo', {
                body: {
                  image_base64: base64,
                  media_type: mediaType,
                  previous_image_base64: previous?.base64,
                  previous_media_type: previous?.mediaType,
                  summary,
                  dietary_approach: profile?.dietary_approach,
                },
              })
            })().catch(() => null)
          : Promise.resolve(null)

        const [noteResult, photoResult] = await Promise.all([notePromise, photoPromise])

        if (noteResult && !noteResult.error && noteResult.data?.note) {
          feedbackText = noteResult.data.note
        }
        if (photoResult && !photoResult.error && photoResult.data?.assessment) {
          photoAssessmentText = photoResult.data.assessment
        }

        if (feedbackText || photoAssessmentText) {
          await upsertWeeklyCheckin(user.id, weekStart, {
            ...(feedbackText ? { ai_feedback: feedbackText } : {}),
            ...(photoAssessmentText ? { photo_assessment: photoAssessmentText } : {}),
          })
        }
      } catch {
        // non-fatal
      }

      if (feedbackText || photoAssessmentText) {
        setFeedback(feedbackText)
        setPhotoAssessment(photoAssessmentText)
      } else {
        onClose()
      }
    } catch (err) {
      setSaveError(err.message || 'Could not save weekly check-in.')
    } finally {
      setSaving(false)
    }
  }

  const previewSrc = photoPreviewUrl || existingPhotoUrl

  if (loading) {
    return (
      <div className="absolute inset-0 bg-bg z-20 flex flex-col overflow-y-auto">
        <SheetHeader title="WEEKLY CHECK-IN" onBack={onBack} onClose={onClose} />
        <div className="font-mono text-[11px] text-fg-dim text-center py-10">LOADING…</div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 bg-bg z-20 flex flex-col overflow-y-auto">
      <SheetHeader title="WEEKLY CHECK-IN" onBack={onBack} onClose={onClose} />
      <div className="px-4 pb-8">
        <div className="font-mono text-[10px] text-fg-dim tracking-[0.1em] mb-3.5">
          WEEK OF{' '}
          {new Date(`${weekStart}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>

        <Panel className="mb-3.5">
          <Eyebrow>Progress Photo</Eyebrow>
          <label className="block h-[220px] rounded-[10px] border border-dashed border-hairline-lit flex items-center justify-center cursor-pointer overflow-hidden">
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
            {previewSrc ? (
              <img src={previewSrc} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-fg-dim">
                <Camera size={22} />
                <span className="font-mono text-[10.5px]">TAP TO UPLOAD</span>
              </div>
            )}
          </label>
        </Panel>

        <Panel className="mb-3.5">
          <Eyebrow>Summary</Eyebrow>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={5}
            placeholder="How did the week go? Training, food, energy, anything worth noting."
            className="w-full bg-panel-raised border border-hairline rounded-[8px] px-3 py-2.5 text-[13px] text-fg outline-none focus:border-signal transition-colors resize-none"
          />
        </Panel>

        {photoAssessment && (
          <Panel className="mb-3.5 border-l-2 border-signal">
            <Eyebrow>
              <Sparkles size={11} className="inline mr-1.5 -translate-y-px" /> Photo Assessment
            </Eyebrow>
            <div className="text-[13px] text-fg leading-relaxed">{photoAssessment}</div>
          </Panel>
        )}

        {feedback && (
          <Panel className="mb-3.5 border-l-2 border-info">
            <Eyebrow>
              <Sparkles size={11} className="inline mr-1.5 -translate-y-px" /> Coach Feedback
            </Eyebrow>
            <div className="text-[13px] text-fg leading-relaxed">{feedback}</div>
          </Panel>
        )}

        {saveError && <div className="font-mono text-[11px] text-alert mb-3">{saveError}</div>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-signal disabled:opacity-40 rounded-[9px] py-2.5 text-[#06150F] font-mono text-[12px] font-bold flex items-center justify-center gap-1.5"
        >
          <Check size={14} /> {saving ? 'SAVING…' : 'SAVE WEEKLY CHECK-IN'}
        </button>
      </div>
    </div>
  )
}
