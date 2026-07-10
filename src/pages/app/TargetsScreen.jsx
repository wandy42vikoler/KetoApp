import { useEffect, useState } from 'react'
import { Sparkles, Check } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { computeAssessment } from '../../lib/assessment'
import Panel from '../../components/ui/Panel'
import Eyebrow from '../../components/ui/Eyebrow'
import { Field } from '../../components/ui/FormField'

const EMPTY_MACROS = { calories: '', protein_g: '', fat_g: '', net_carbs_g: '' }

export default function TargetsScreen() {
  const { user, profile } = useAuth()

  const [targets, setTargets] = useState(EMPTY_MACROS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [maintenanceCalories, setMaintenanceCalories] = useState(null)
  const [assessment, setAssessment] = useState(null)

  const [recalculating, setRecalculating] = useState(false)
  const [recalcError, setRecalcError] = useState(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [savedAt, setSavedAt] = useState(null)

  useEffect(() => {
    let active = true
    async function load() {
      const { data, error } = await supabase
        .from('targets')
        .select('calories, protein_g, fat_g, net_carbs_g')
        .eq('user_id', user.id)
        .eq('day_type', 'rest')
        .maybeSingle()
      if (!active) return
      if (error) {
        setLoadError(error.message)
      } else if (data) {
        setTargets(data)
      }
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [user.id])

  function updateField(field, value) {
    setTargets((t) => {
      const next = { ...t, [field]: value }
      if (maintenanceCalories !== null) {
        setAssessment(
          computeAssessment({
            weight_kg: Number(profile.starting_weight_kg),
            height_cm: Number(profile.height_cm),
            goal_weight_kg: Number(profile.goal_weight_kg),
            calories: Number(next.calories) || 0,
            maintenance_calories: maintenanceCalories,
          }),
        )
      }
      return next
    })
  }

  async function handleRecalculate() {
    setRecalculating(true)
    setRecalcError(null)
    try {
      const { data, error } = await supabase.functions.invoke('generate-targets', {
        body: {
          height_cm: Number(profile.height_cm),
          gender: profile.gender,
          activity_level: Number(profile.activity_level),
          starting_weight_kg: Number(profile.starting_weight_kg),
          goal_weight_kg: Number(profile.goal_weight_kg),
          goal_timeline_weeks: Number(profile.goal_timeline_weeks),
        },
      })
      if (error) throw error
      const { maintenance_calories, assessment: assessmentText, ...macros } = data
      setTargets(macros)
      setMaintenanceCalories(maintenance_calories)
      setAssessment(assessmentText)
    } catch (err) {
      setRecalcError(err.message || 'Recalculation failed.')
    } finally {
      setRecalculating(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    setSavedAt(null)
    try {
      const macros = {
        calories: Number(targets.calories),
        protein_g: Number(targets.protein_g),
        fat_g: Number(targets.fat_g),
        net_carbs_g: Number(targets.net_carbs_g),
      }
      const rows = ['rest', 'activity'].map((day_type) => ({
        user_id: user.id,
        day_type,
        ...macros,
      }))
      const { error } = await supabase.from('targets').upsert(rows, { onConflict: 'user_id,day_type' })
      if (error) throw error
      setSavedAt(Date.now())
    } catch (err) {
      setSaveError(err.message || 'Could not save targets.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="font-mono text-[10px] text-fg-dim tracking-[0.18em] mb-1">CONFIGURATION</div>
      <div className="text-xl font-bold text-fg mb-5">Targets</div>

      {loading ? (
        <Panel>
          <div className="font-mono text-[11px] text-fg-dim text-center py-6">LOADING…</div>
        </Panel>
      ) : (
        <>
          {loadError && <div className="font-mono text-[11px] text-alert mb-3">{loadError}</div>}

          <Panel className="mb-3">
            <Eyebrow>Daily Targets — Editable</Eyebrow>
            <div className="font-mono text-[10px] text-fg-dim mb-3 leading-relaxed">
              Baseline macros. Activity-day adjustments are applied automatically later from logged workouts.
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Field
                label="CALORIES"
                type="number"
                value={targets.calories}
                onChange={(v) => updateField('calories', v)}
              />
              <Field
                label="PROTEIN"
                type="number"
                unit="g"
                value={targets.protein_g}
                onChange={(v) => updateField('protein_g', v)}
              />
              <Field label="FAT" type="number" unit="g" value={targets.fat_g} onChange={(v) => updateField('fat_g', v)} />
              <Field
                label="NET CARBS"
                type="number"
                unit="g"
                value={targets.net_carbs_g}
                onChange={(v) => updateField('net_carbs_g', v)}
              />
            </div>
          </Panel>

          {assessment && (
            <Panel className="mb-3">
              <Eyebrow>AI Assessment</Eyebrow>
              <div className="text-[12.5px] text-fg leading-relaxed">{assessment}</div>
            </Panel>
          )}

          {recalcError && <div className="font-mono text-[11px] text-alert mb-3">{recalcError}</div>}
          {saveError && <div className="font-mono text-[11px] text-alert mb-3">{saveError}</div>}
          {savedAt && <div className="font-mono text-[11px] text-signal mb-3">TARGETS SAVED</div>}

          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="w-full mb-2.5 bg-transparent border border-dashed border-hairline-lit disabled:opacity-50 rounded-[10px] py-3 text-info font-mono text-[12px] tracking-wide flex items-center justify-center gap-1.5"
          >
            <Sparkles size={13} /> {recalculating ? 'RECALCULATING…' : 'RECALCULATE WITH AI'}
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-signal disabled:opacity-40 rounded-[9px] py-2.5 text-[#06150F] font-mono text-[12px] font-bold flex items-center justify-center gap-1.5"
          >
            <Check size={14} /> {saving ? 'SAVING…' : 'SAVE'}
          </button>
        </>
      )}
    </div>
  )
}
