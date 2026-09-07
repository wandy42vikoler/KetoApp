import { useEffect, useState } from 'react'
import { Sparkles, Check, Plus, X, Trash2, Calendar, Pill, Utensils } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { computeAssessment } from '../../lib/assessment'
import { daysUntil } from '../../lib/protocolDay'
import {
  WEEKDAY_LABELS,
  fetchTrainingPlan,
  insertTrainingPlanDay,
  deleteTrainingPlanDay,
  groupByWeekday,
} from '../../lib/trainingPlan'
import { updateSupplementStack } from '../../lib/supplementLog'
import { updateFoodGuide, FOOD_GUIDE_MEALS, EMPTY_FOOD_GUIDE } from '../../lib/foodGuide'
import Panel from '../../components/ui/Panel'
import Eyebrow from '../../components/ui/Eyebrow'
import { Field } from '../../components/ui/FormField'
import ShoppingList from './ShoppingList'

const EMPTY_MACROS = { calories: '', protein_g: '', fat_g: '', carbs_g: '' }

export default function PlanScreen() {
  const { user, profile, refreshProfile } = useAuth()

  // ---- Daily macro targets ----
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
        .select('calories, protein_g, fat_g, carbs_g')
        .eq('user_id', user.id)
        .eq('day_type', 'rest')
        .maybeSingle()
      if (!active) return
      if (error) setLoadError(error.message)
      else if (data) setTargets(data)
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [user.id])

  function updateTargetField(field, value) {
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
          dietary_approach: profile.dietary_approach || undefined,
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

  async function handleSaveTargets() {
    setSaving(true)
    setSaveError(null)
    setSavedAt(null)
    try {
      const macros = {
        calories: Number(targets.calories),
        protein_g: Number(targets.protein_g),
        fat_g: Number(targets.fat_g),
        carbs_g: Number(targets.carbs_g),
      }
      const rows = ['rest', 'activity'].map((day_type) => ({ user_id: user.id, day_type, ...macros }))
      const { error } = await supabase.from('targets').upsert(rows, { onConflict: 'user_id,day_type' })
      if (error) throw error
      setSavedAt(Date.now())
    } catch (err) {
      setSaveError(err.message || 'Could not save targets.')
    } finally {
      setSaving(false)
    }
  }

  // ---- Target event & dietary approach ----
  const [eventFields, setEventFields] = useState({
    target_event_name: profile?.target_event_name ?? '',
    target_event_date: profile?.target_event_date ?? '',
    dietary_approach: profile?.dietary_approach ?? '',
  })
  const [eventSaving, setEventSaving] = useState(false)
  const [eventSavedAt, setEventSavedAt] = useState(null)

  async function handleSaveEvent() {
    setEventSaving(true)
    setEventSavedAt(null)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          target_event_name: eventFields.target_event_name || null,
          target_event_date: eventFields.target_event_date || null,
          dietary_approach: eventFields.dietary_approach || null,
        })
        .eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      setEventSavedAt(Date.now())
    } finally {
      setEventSaving(false)
    }
  }

  const remainingDays = daysUntil(profile?.target_event_date)

  // ---- Weekly training split ----
  const [planDays, setPlanDays] = useState([])
  const [planLoading, setPlanLoading] = useState(true)
  const [newPlanRow, setNewPlanRow] = useState({ weekday: '1', label: '', required: true })

  async function loadPlan() {
    setPlanLoading(true)
    try {
      setPlanDays(await fetchTrainingPlan(user.id))
    } finally {
      setPlanLoading(false)
    }
  }

  useEffect(() => {
    loadPlan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  async function handleAddPlanRow() {
    if (!newPlanRow.label.trim()) return
    await insertTrainingPlanDay(user.id, {
      weekday: Number(newPlanRow.weekday),
      label: newPlanRow.label.trim(),
      required: newPlanRow.required,
      sort_order: 0,
    })
    setNewPlanRow((r) => ({ ...r, label: '' }))
    loadPlan()
  }

  async function handleDeletePlanRow(id) {
    await deleteTrainingPlanDay(id)
    loadPlan()
  }

  const grouped = groupByWeekday(planDays)

  // ---- Supplement stack ----
  const [stack, setStack] = useState(profile?.supplement_stack ?? [])
  const [newSupplement, setNewSupplement] = useState({ name: '', dose: '', situational: false })

  useEffect(() => {
    setStack(profile?.supplement_stack ?? [])
  }, [profile?.supplement_stack])

  async function persistStack(next) {
    setStack(next)
    await updateSupplementStack(user.id, next)
    await refreshProfile()
  }

  async function handleAddSupplement() {
    if (!newSupplement.name.trim()) return
    const item = {
      id: `${newSupplement.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
      name: newSupplement.name.trim(),
      dose: newSupplement.dose.trim(),
      situational: newSupplement.situational,
    }
    await persistStack([...stack, item])
    setNewSupplement({ name: '', dose: '', situational: false })
  }

  async function handleRemoveSupplement(id) {
    await persistStack(stack.filter((s) => s.id !== id))
  }

  // ---- Food guide ----
  const [foodGuide, setFoodGuide] = useState(profile?.food_guide ?? EMPTY_FOOD_GUIDE)
  const [foodGuideSaving, setFoodGuideSaving] = useState(false)
  const [foodGuideSavedAt, setFoodGuideSavedAt] = useState(null)
  const [shoppingListOpen, setShoppingListOpen] = useState(false)

  useEffect(() => {
    setFoodGuide(profile?.food_guide ?? EMPTY_FOOD_GUIDE)
  }, [profile?.food_guide])

  function updateFoodGuideList(listType, meal, text) {
    const items = text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    setFoodGuide((fg) => ({ ...fg, [listType]: { ...fg[listType], [meal]: items } }))
  }

  async function handleSaveFoodGuide() {
    setFoodGuideSaving(true)
    setFoodGuideSavedAt(null)
    try {
      await updateFoodGuide(user.id, foodGuide)
      await refreshProfile()
      setFoodGuideSavedAt(Date.now())
    } finally {
      setFoodGuideSaving(false)
    }
  }

  return (
    <div>
      <div className="font-mono text-[10px] text-fg-dim tracking-[0.18em] mb-1">CONFIGURATION</div>
      <div className="text-xl font-bold text-fg mb-5">Plan</div>

      <Panel className="mb-3">
        <Eyebrow
          right={
            remainingDays != null && (
              <span className="font-mono text-[11px] text-signal">
                {remainingDays >= 0 ? `${remainingDays}D` : 'PASSED'}
              </span>
            )
          }
        >
          <Calendar size={11} className="inline mr-1.5 -translate-y-px" /> Target Event
        </Eyebrow>
        <div className="flex flex-col gap-3">
          <Field
            label="EVENT NAME"
            value={eventFields.target_event_name}
            onChange={(v) => setEventFields((f) => ({ ...f, target_event_name: v }))}
            placeholder="e.g. Morocco Surf Trip"
          />
          <Field
            label="EVENT DATE"
            type="date"
            value={eventFields.target_event_date}
            onChange={(v) => setEventFields((f) => ({ ...f, target_event_date: v }))}
          />
        </div>
        <div className="mt-3">
          <div className="font-mono text-[9.5px] text-fg-dim tracking-[0.1em] mb-1.5">DIETARY APPROACH</div>
          <textarea
            value={eventFields.dietary_approach}
            onChange={(e) => setEventFields((f) => ({ ...f, dietary_approach: e.target.value }))}
            rows={3}
            placeholder="Macro philosophy for this goal — steers AI target generation and coaching instead of a fixed diet template."
            className="w-full bg-panel-raised border border-hairline rounded-[8px] px-3 py-2.5 text-[13px] text-fg outline-none focus:border-signal transition-colors resize-none"
          />
        </div>
        {eventSavedAt && <div className="font-mono text-[11px] text-signal mt-2.5">SAVED</div>}
        <button
          onClick={handleSaveEvent}
          disabled={eventSaving}
          className="w-full mt-3 bg-signal disabled:opacity-40 rounded-[9px] py-2.5 text-[#06150F] font-mono text-[12px] font-bold flex items-center justify-center gap-1.5"
        >
          <Check size={14} /> {eventSaving ? 'SAVING…' : 'SAVE'}
        </button>
      </Panel>

      {loading ? (
        <Panel className="mb-3">
          <div className="font-mono text-[11px] text-fg-dim text-center py-6">LOADING…</div>
        </Panel>
      ) : (
        <Panel className="mb-3">
          {loadError && <div className="font-mono text-[11px] text-alert mb-3">{loadError}</div>}
          <Eyebrow>Daily Targets — Editable</Eyebrow>
          <div className="font-mono text-[10px] text-fg-dim mb-3 leading-relaxed">
            Baseline macros. Activity-day adjustments are applied automatically later from logged workouts.
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Field
              label="CALORIES"
              type="number"
              value={targets.calories}
              onChange={(v) => updateTargetField('calories', v)}
            />
            <Field
              label="PROTEIN"
              type="number"
              unit="g"
              value={targets.protein_g}
              onChange={(v) => updateTargetField('protein_g', v)}
            />
            <Field
              label="FAT"
              type="number"
              unit="g"
              value={targets.fat_g}
              onChange={(v) => updateTargetField('fat_g', v)}
            />
            <Field
              label="CARBS"
              type="number"
              unit="g"
              value={targets.carbs_g}
              onChange={(v) => updateTargetField('carbs_g', v)}
            />
          </div>

          {assessment && (
            <div className="mt-3 pt-3 border-t border-hairline">
              <div className="font-mono text-[10px] text-fg-dim tracking-[0.1em] mb-1.5">AI ASSESSMENT</div>
              <div className="text-[12.5px] text-fg leading-relaxed">{assessment}</div>
            </div>
          )}

          {recalcError && <div className="font-mono text-[11px] text-alert mt-3">{recalcError}</div>}
          {saveError && <div className="font-mono text-[11px] text-alert mt-3">{saveError}</div>}
          {savedAt && <div className="font-mono text-[11px] text-signal mt-3">TARGETS SAVED</div>}

          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="w-full mt-3 mb-2.5 bg-transparent border border-dashed border-hairline-lit disabled:opacity-50 rounded-[10px] py-3 text-info font-mono text-[12px] tracking-wide flex items-center justify-center gap-1.5"
          >
            <Sparkles size={13} /> {recalculating ? 'RECALCULATING…' : 'RECALCULATE WITH AI'}
          </button>
          <button
            onClick={handleSaveTargets}
            disabled={saving}
            className="w-full bg-signal disabled:opacity-40 rounded-[9px] py-2.5 text-[#06150F] font-mono text-[12px] font-bold flex items-center justify-center gap-1.5"
          >
            <Check size={14} /> {saving ? 'SAVING…' : 'SAVE'}
          </button>
        </Panel>
      )}

      <Panel className="mb-3">
        <Eyebrow>Weekly Training Split</Eyebrow>
        {planLoading ? (
          <div className="font-mono text-[11px] text-fg-dim text-center py-4">LOADING…</div>
        ) : (
          <div className="flex flex-col gap-2.5 mb-3">
            {[1, 2, 3, 4, 5, 6, 7].map((wd) => (
              <div key={wd} className="flex gap-2.5">
                <div className="w-8 flex-shrink-0 font-mono text-[10.5px] text-fg-dim pt-1.5">
                  {WEEKDAY_LABELS[wd - 1].toUpperCase()}
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  {grouped[wd].length === 0 && <div className="font-mono text-[11px] text-fg-dim py-1">—</div>}
                  {grouped[wd].map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-2 bg-panel-raised border border-hairline rounded-[8px] px-2.5 py-1.5"
                    >
                      <span className="flex-1 text-[12px] text-fg">{row.label}</span>
                      {!row.required && (
                        <span className="font-mono text-[9px] text-fg-dim border border-hairline rounded-[4px] px-1.5 py-0.5">
                          OPT
                        </span>
                      )}
                      <button
                        onClick={() => handleDeletePlanRow(row.id)}
                        className="bg-transparent border-none text-fg-dim flex-shrink-0"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-hairline pt-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <select
              value={newPlanRow.weekday}
              onChange={(e) => setNewPlanRow((r) => ({ ...r, weekday: e.target.value }))}
              className="bg-panel-raised border border-hairline rounded-[8px] px-2.5 py-2 text-[12px] text-fg outline-none focus:border-signal"
            >
              {WEEKDAY_LABELS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label.toUpperCase()}
                </option>
              ))}
            </select>
            <input
              value={newPlanRow.label}
              onChange={(e) => setNewPlanRow((r) => ({ ...r, label: e.target.value }))}
              placeholder="e.g. Push + cardio"
              className="flex-1 bg-panel-raised border border-hairline rounded-[8px] px-3 py-2 text-[12px] text-fg outline-none focus:border-signal"
            />
          </div>
          <label className="flex items-center gap-2 font-mono text-[10.5px] text-fg-dim">
            <input
              type="checkbox"
              checked={newPlanRow.required}
              onChange={(e) => setNewPlanRow((r) => ({ ...r, required: e.target.checked }))}
            />
            REQUIRED (UNCHECK FOR OPTIONAL / BONUS)
          </label>
          <button
            onClick={handleAddPlanRow}
            className="w-full border border-dashed border-hairline-lit rounded-[9px] py-2.5 text-fg-muted font-mono text-[11.5px] flex items-center justify-center gap-1.5"
          >
            <Plus size={13} /> ADD SESSION
          </button>
        </div>
      </Panel>

      <Panel className="mb-3">
        <Eyebrow>
          <Pill size={11} className="inline mr-1.5 -translate-y-px" /> Supplement Stack
        </Eyebrow>
        <div className="flex flex-col gap-2 mb-3">
          {stack.length === 0 && (
            <div className="font-mono text-[11px] text-fg-dim text-center py-2">No supplements added.</div>
          )}
          {stack.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 bg-panel-raised border border-hairline rounded-[8px] px-2.5 py-2"
            >
              <div className="flex-1">
                <div className="text-[12.5px] text-fg">
                  {item.name}
                  {item.situational && <span className="font-mono text-[9px] text-fg-dim ml-1.5">SITUATIONAL</span>}
                </div>
                {item.dose && <div className="font-mono text-[10.5px] text-fg-dim">{item.dose}</div>}
              </div>
              <button
                onClick={() => handleRemoveSupplement(item.id)}
                className="bg-transparent border-none text-fg-dim flex-shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <div className="border-t border-hairline pt-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={newSupplement.name}
              onChange={(e) => setNewSupplement((s) => ({ ...s, name: e.target.value }))}
              placeholder="Name"
              className="flex-1 bg-panel-raised border border-hairline rounded-[8px] px-3 py-2 text-[12px] text-fg outline-none focus:border-signal"
            />
            <input
              value={newSupplement.dose}
              onChange={(e) => setNewSupplement((s) => ({ ...s, dose: e.target.value }))}
              placeholder="Dose"
              className="w-28 bg-panel-raised border border-hairline rounded-[8px] px-3 py-2 text-[12px] text-fg outline-none focus:border-signal"
            />
          </div>
          <label className="flex items-center gap-2 font-mono text-[10.5px] text-fg-dim">
            <input
              type="checkbox"
              checked={newSupplement.situational}
              onChange={(e) => setNewSupplement((s) => ({ ...s, situational: e.target.checked }))}
            />
            SITUATIONAL (NOT DAILY)
          </label>
          <button
            onClick={handleAddSupplement}
            className="w-full border border-dashed border-hairline-lit rounded-[9px] py-2.5 text-fg-muted font-mono text-[11.5px] flex items-center justify-center gap-1.5"
          >
            <Plus size={13} /> ADD SUPPLEMENT
          </button>
        </div>
      </Panel>

      <Panel className="mb-3">
        <Eyebrow>
          <Utensils size={11} className="inline mr-1.5 -translate-y-px" /> Food Guide
        </Eyebrow>
        <div className="font-mono text-[10px] text-fg-dim mb-3 leading-relaxed">One item per line.</div>
        {['eat', 'avoid'].map((listType) => (
          <div key={listType} className="mb-3">
            <div
              className={`font-mono text-[10.5px] tracking-[0.1em] mb-2 ${
                listType === 'eat' ? 'text-signal' : 'text-alert'
              }`}
            >
              {listType.toUpperCase()}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {FOOD_GUIDE_MEALS.map((meal) => (
                <label key={meal} className="block">
                  <div className="font-mono text-[9px] text-fg-dim tracking-[0.1em] mb-1">{meal.toUpperCase()}</div>
                  <textarea
                    value={(foodGuide[listType]?.[meal] ?? []).join('\n')}
                    onChange={(e) => updateFoodGuideList(listType, meal, e.target.value)}
                    rows={4}
                    className="w-full bg-panel-raised border border-hairline rounded-[8px] px-2.5 py-2 text-[11.5px] text-fg outline-none focus:border-signal transition-colors resize-none"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        {foodGuideSavedAt && <div className="font-mono text-[11px] text-signal mb-2.5">SAVED</div>}
        <button
          onClick={handleSaveFoodGuide}
          disabled={foodGuideSaving}
          className="w-full bg-signal disabled:opacity-40 rounded-[9px] py-2.5 text-[#06150F] font-mono text-[12px] font-bold flex items-center justify-center gap-1.5"
        >
          <Check size={14} /> {foodGuideSaving ? 'SAVING…' : 'SAVE FOOD GUIDE'}
        </button>
        <button
          onClick={() => setShoppingListOpen(true)}
          className="w-full mt-2.5 bg-transparent border border-dashed border-hairline-lit rounded-[9px] py-2.5 text-info font-mono text-[11.5px] tracking-wide flex items-center justify-center gap-1.5"
        >
          <Sparkles size={13} /> SHOPPING LIST
        </button>
      </Panel>

      {shoppingListOpen && (
        <ShoppingList onBack={() => setShoppingListOpen(false)} onClose={() => setShoppingListOpen(false)} />
      )}
    </div>
  )
}
