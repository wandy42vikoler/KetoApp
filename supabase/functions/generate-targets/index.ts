import { corsHeaders } from '../_shared/cors.ts'
import { COACH_VOICE } from '../_shared/coach-voice.ts'
import { computeAssessment } from '../_shared/assessment.ts'
import { callClaude } from '../_shared/anthropic.ts'
import { extractJson } from '../_shared/extractJson.ts'

const SYSTEM_PROMPT = `${COACH_VOICE}

Calculate a baseline Targeted Ketogenic Diet (TKD) daily macro target. Method:
1. BMR via Mifflin-St Jeor.
2. Apply an activity multiplier derived from the user's self-reported
   activity_level (1-10) to get estimated maintenance calories (TDEE).
3. Derive a sustainable deficit from the stated goal weight and timeline —
   do not exceed a safe rate of loss (roughly 0.5-1% bodyweight/week); if the
   requested timeline implies an unsafe rate, use the safe rate instead and
   let the timeline run longer in practice.
4. Split into TKD macros: high fat, moderate protein, very low net carbs.
   This is the baseline (rest-day) target — activity-day adjustments are
   applied later by the app from logged workout data, not by you.

Respond with ONLY a raw JSON object, no markdown code fences, no prose,
matching exactly this shape (maintenance_calories is your step-2 TDEE
estimate, before the deficit is applied):
{"calories":number,"protein_g":number,"fat_g":number,"net_carbs_g":number,"maintenance_calories":number}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { height_cm, gender, activity_level, starting_weight_kg, goal_weight_kg, goal_timeline_weeks } =
      await req.json()

    if (!height_cm || !gender || !activity_level || !starting_weight_kg || !goal_weight_kg || !goal_timeline_weeks) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userMessage = `height_cm=${height_cm}, gender=${gender}, activity_level=${activity_level}/10, starting_weight_kg=${starting_weight_kg}, goal_weight_kg=${goal_weight_kg}, goal_timeline_weeks=${goal_timeline_weeks}`

    const rawText = await callClaude(SYSTEM_PROMPT, userMessage)

    let targets: {
      calories: number
      protein_g: number
      fat_g: number
      net_carbs_g: number
      maintenance_calories: number
    }
    try {
      targets = extractJson(rawText) as typeof targets
    } catch {
      throw new Error(`Could not parse JSON from model output: ${rawText.slice(0, 500)}`)
    }

    const assessment = computeAssessment({
      weight_kg: starting_weight_kg,
      height_cm,
      goal_weight_kg,
      calories: targets.calories,
      maintenance_calories: targets.maintenance_calories,
    })

    return new Response(JSON.stringify({ ...targets, assessment }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
