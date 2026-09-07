import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Check } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { computeAssessment } from '../../lib/assessment'
import Panel from '../../components/ui/Panel'
import Eyebrow from '../../components/ui/Eyebrow'
import { Field, Select, ActivityLevelField, ACTIVITY_LEVELS } from '../../components/ui/FormField'

const STEPS = ['basics', 'goals', 'approach', 'generating', 'review']

const EMPTY_MACROS = { calories: '', protein_g: '', fat_g: '', carbs_g: '' }

const activityNumeric = (value) => ACTIVITY_LEVELS.find((a) => a.value === value)?.numeric ?? 6

export default function Onboarding() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState(0)
  const step = STEPS[stepIndex]

  const [basics, setBasics] = useState({ height_cm: '', gender: 'female', activity_level: 'moderate' })
  const [goals, setGoals] = useState({ starting_weight_kg: '', goal_weight_kg: '', goal_timeline_weeks: '' })
  const [approach, setApproach] = useState({
    target_event_name: profile?.target_event_name ?? '',
    target_event_date: profile?.target_event_date ?? '',
    dietary_approach: profile?.dietary_approach ?? '',
  })
  const [targets, setTargets] = useState(EMPTY_MACROS)
  const [maintenanceCalories, setMaintenanceCalories] = useState(null)
  const [assessment, setAssessment] = useState(null)
  const [generationError, setGenerationError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  function goTo(name) {
    setStepIndex(STEPS.indexOf(name))
  }

  async function runGeneration() {
    setGenerationError(null)
    goTo('generating')
    try {
      const { data, error } = await supabase.functions.invoke('generate-targets', {
        body: {
          height_cm: Number(basics.height_cm),
          gender: basics.gender,
          activity_level: activityNumeric(basics.activity_level),
          starting_weight_kg: Number(goals.starting_weight_kg),
          goal_weight_kg: Number(goals.goal_weight_kg),
          goal_timeline_weeks: Number(goals.goal_timeline_weeks),
          dietary_approach: approach.dietary_approach || undefined,
        },
      })
      if (error) throw error
      const { maintenance_calories, assessment: assessmentText, ...macros } = data
      setTargets(macros)
      setMaintenanceCalories(maintenance_calories)
      setAssessment(assessmentText)
      goTo('review')
    } catch (err) {
      setGenerationError(err.message || 'Target generation failed.')
    }
  }

  function skipToManualReview() {
    setGenerationError(null)
    setTargets(EMPTY_MACROS)
    setMaintenanceCalories(null)
    setAssessment(null)
    goTo('review')
  }

  function updateTargetField(field, value) {
    setTargets((t) => {
      const next = { ...t, [field]: value }
      if (maintenanceCalories !== null) {
        setAssessment(
          computeAssessment({
            weight_kg: Number(goals.starting_weight_kg),
            height_cm: Number(basics.height_cm),
            goal_weight_kg: Number(goals.goal_weight_kg),
            calories: Number(next.calories) || 0,
            maintenance_calories: maintenanceCalories,
          }),
        )
      }
      return next
    })
  }

  async function confirmAndSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const protocol_start_date = new Date().toISOString().slice(0, 10)

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          height_cm: Number(basics.height_cm),
          gender: basics.gender,
          activity_level: activityNumeric(basics.activity_level),
          starting_weight_kg: Number(goals.starting_weight_kg),
          goal_weight_kg: Number(goals.goal_weight_kg),
          goal_timeline_weeks: Number(goals.goal_timeline_weeks),
          protocol_start_date,
          target_event_name: approach.target_event_name || null,
          target_event_date: approach.target_event_date || null,
          dietary_approach: approach.dietary_approach || null,
        })
        .eq('id', user.id)
      if (profileError) throw profileError

      // Onboarding sets one baseline macro target. Rest vs. activity-day
      // adjustment happens dynamically later from logged workout data — both
      // day_type rows start identical so dashboard lookups always find a row.
      const macros = {
        calories: Number(targets.calories),
        protein_g: Number(targets.protein_g),
        fat_g: Number(targets.fat_g),
        carbs_g: Number(targets.carbs_g),
      }
      const rows = ['rest', 'activity'].map((day_type) => ({
        user_id: user.id,
        day_type,
        ...macros,
      }))
      const { error: targetsError } = await supabase.from('targets').upsert(rows, { onConflict: 'user_id,day_type' })
      if (targetsError) throw targetsError

      await refreshProfile()
      navigate('/app', { replace: true })
    } catch (err) {
      setSaveError(err.message || 'Could not save your protocol.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg bg-vignette flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="font-mono text-[10px] text-fg-dim tracking-[0.18em] mb-1">PROTOCOL SETUP</div>
          <div className="text-xl font-bold text-fg">Onboarding</div>
        </div>

        <StepDots current={stepIndex} total={STEPS.length} />

        {step === 'basics' && <StepBasics basics={basics} setBasics={setBasics} onNext={() => goTo('goals')} />}

        {step === 'goals' && (
          <StepGoals goals={goals} setGoals={setGoals} onBack={() => goTo('basics')} onNext={() => goTo('approach')} />
        )}

        {step === 'approach' && (
          <StepApproach approach={approach} setApproach={setApproach} onBack={() => goTo('goals')} onNext={runGeneration} />
        )}

        {step === 'generating' && (
          <StepGenerating error={generationError} onRetry={runGeneration} onSkip={skipToManualReview} />
        )}

        {step === 'review' && (
          <StepReview
            targets={targets}
            onFieldChange={updateTargetField}
            assessment={assessment}
            onBack={() => goTo('goals')}
            onConfirm={confirmAndSave}
            saving={saving}
            saveError={saveError}
          />
        )}
      </div>
    </div>
  )
}

function StepDots({ current, total }) {
  return (
    <div className="flex justify-center gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1 rounded-full transition-all ${i === current ? 'w-6 bg-signal' : 'w-1.5 bg-hairline-lit'}`} />
      ))}
    </div>
  )
}

function StepBasics({ basics, setBasics, onNext }) {
  const valid = basics.height_cm && basics.gender

  return (
    <Panel>
      <Eyebrow>Baseline</Eyebrow>
      <div className="flex flex-col gap-4">
        <Field
          label="HEIGHT"
          type="number"
          unit="cm"
          value={basics.height_cm}
          onChange={(v) => setBasics((b) => ({ ...b, height_cm: v }))}
          required
        />
        <Select
          label="GENDER"
          value={basics.gender}
          onChange={(v) => setBasics((b) => ({ ...b, gender: v }))}
          options={[
            { value: 'female', label: 'Female' },
            { value: 'male', label: 'Male' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <ActivityLevelField
          value={basics.activity_level}
          onChange={(v) => setBasics((b) => ({ ...b, activity_level: v }))}
        />
      </div>
      <button
        onClick={onNext}
        disabled={!valid}
        className="w-full mt-5 bg-signal disabled:opacity-40 rounded-[9px] py-2.5 text-[#06150F] font-mono text-[12px] font-bold"
      >
        CONTINUE
      </button>
    </Panel>
  )
}

function StepGoals({ goals, setGoals, onBack, onNext }) {
  const valid = goals.starting_weight_kg && goals.goal_weight_kg && goals.goal_timeline_weeks

  return (
    <Panel>
      <Eyebrow>Weight &amp; Goal</Eyebrow>
      <div className="flex flex-col gap-4">
        <Field
          label="CURRENT WEIGHT — recorded once as your baseline"
          type="number"
          unit="kg"
          value={goals.starting_weight_kg}
          onChange={(v) => setGoals((g) => ({ ...g, starting_weight_kg: v }))}
          required
        />
        <Field
          label="GOAL WEIGHT"
          type="number"
          unit="kg"
          value={goals.goal_weight_kg}
          onChange={(v) => setGoals((g) => ({ ...g, goal_weight_kg: v }))}
          required
        />
        <Field
          label="TIMELINE"
          type="number"
          unit="weeks"
          value={goals.goal_timeline_weeks}
          onChange={(v) => setGoals((g) => ({ ...g, goal_timeline_weeks: v }))}
          required
        />
      </div>
      <div className="flex gap-2 mt-5">
        <button
          onClick={onBack}
          className="flex-1 bg-transparent border border-hairline-lit rounded-[9px] py-2.5 text-fg-muted font-mono text-[12px]"
        >
          BACK
        </button>
        <button
          onClick={onNext}
          disabled={!valid}
          className="flex-1 bg-signal disabled:opacity-40 rounded-[9px] py-2.5 text-[#06150F] font-mono text-[12px] font-bold flex items-center justify-center gap-1.5"
        >
          <Sparkles size={13} /> GENERATE TARGETS
        </button>
      </div>
    </Panel>
  )
}

function StepApproach({ approach, setApproach, onBack, onNext }) {
  return (
    <Panel>
      <Eyebrow>Plan</Eyebrow>
      <div className="flex flex-col gap-4">
        <Field
          label="TARGET EVENT (OPTIONAL)"
          value={approach.target_event_name}
          onChange={(v) => setApproach((a) => ({ ...a, target_event_name: v }))}
          placeholder="e.g. Morocco Surf Trip"
        />
        <Field
          label="EVENT DATE (OPTIONAL)"
          type="date"
          value={approach.target_event_date}
          onChange={(v) => setApproach((a) => ({ ...a, target_event_date: v }))}
        />
        <label className="block">
          <div className="font-mono text-[9.5px] text-fg-dim tracking-[0.1em] mb-1.5">DIETARY APPROACH (OPTIONAL)</div>
          <textarea
            value={approach.dietary_approach}
            onChange={(e) => setApproach((a) => ({ ...a, dietary_approach: e.target.value }))}
            rows={4}
            placeholder="The macro philosophy for this goal — low-carb, higher-carb for training, balanced, whatever it is. Leave blank for a balanced default. This steers target generation and the AI coach instead of a fixed diet template."
            className="w-full bg-panel-raised border border-hairline rounded-[8px] px-3 py-2.5 text-[13px] text-fg outline-none focus:border-signal transition-colors resize-none"
          />
        </label>
      </div>
      <div className="flex gap-2 mt-5">
        <button
          onClick={onBack}
          className="flex-1 bg-transparent border border-hairline-lit rounded-[9px] py-2.5 text-fg-muted font-mono text-[12px]"
        >
          BACK
        </button>
        <button
          onClick={onNext}
          className="flex-1 bg-signal rounded-[9px] py-2.5 text-[#06150F] font-mono text-[12px] font-bold flex items-center justify-center gap-1.5"
        >
          <Sparkles size={13} /> GENERATE TARGETS
        </button>
      </div>
    </Panel>
  )
}

function StepGenerating({ error, onRetry, onSkip }) {
  return (
    <Panel>
      {error ? (
        <>
          <Eyebrow>Generation Failed</Eyebrow>
          <div className="font-mono text-[11px] text-alert mb-4 leading-relaxed whitespace-pre-wrap">{error}</div>
          <div className="flex gap-2">
            <button onClick={onRetry} className="flex-1 bg-signal rounded-[9px] py-2.5 text-[#06150F] font-mono text-[12px] font-bold">
              RETRY
            </button>
            <button
              onClick={onSkip}
              className="flex-1 bg-transparent border border-hairline-lit rounded-[9px] py-2.5 text-fg-muted font-mono text-[12px]"
            >
              ENTER MANUALLY
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <Sparkles size={22} className="text-signal mx-auto mb-3 animate-pulse" />
          <div className="font-mono text-[11px] text-fg-dim tracking-[0.1em]">CALCULATING TARGETS…</div>
        </div>
      )}
    </Panel>
  )
}

function StepReview({ targets, onFieldChange, assessment, onBack, onConfirm, saving, saveError }) {
  return (
    <>
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
            onChange={(v) => onFieldChange('calories', v)}
          />
          <Field
            label="PROTEIN"
            type="number"
            unit="g"
            value={targets.protein_g}
            onChange={(v) => onFieldChange('protein_g', v)}
          />
          <Field
            label="FAT"
            type="number"
            unit="g"
            value={targets.fat_g}
            onChange={(v) => onFieldChange('fat_g', v)}
          />
          <Field
            label="CARBS"
            type="number"
            unit="g"
            value={targets.carbs_g}
            onChange={(v) => onFieldChange('carbs_g', v)}
          />
        </div>
      </Panel>

      {assessment && (
        <Panel className="mb-3">
          <Eyebrow>AI Assessment</Eyebrow>
          <div className="text-[12.5px] text-fg leading-relaxed">{assessment}</div>
        </Panel>
      )}

      {saveError && <div className="font-mono text-[11px] text-alert mb-3">{saveError}</div>}

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 bg-transparent border border-hairline-lit rounded-[9px] py-2.5 text-fg-muted font-mono text-[12px]"
        >
          BACK
        </button>
        <button
          onClick={onConfirm}
          disabled={saving}
          className="flex-1 bg-signal disabled:opacity-40 rounded-[9px] py-2.5 text-[#06150F] font-mono text-[12px] font-bold flex items-center justify-center gap-1.5"
        >
          <Check size={14} /> {saving ? 'SAVING…' : 'CONFIRM & START'}
        </button>
      </div>
    </>
  )
}
