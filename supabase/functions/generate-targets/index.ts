import { corsHeaders } from '../_shared/cors.ts'
import { COACH_VOICE } from '../_shared/coach-voice.ts'
import { computeAssessment } from '../_shared/assessment.ts'
import { callClaude } from '../_shared/anthropic.ts'
import { extractJson } from '../_shared/extractJson.ts'

const SYSTEM_PROMPT = `${COACH_VOICE}

Calculate a baseline daily macro target. Method:
1. BMR via Mifflin-St Jeor.
2. Apply an activity multiplier derived from the user's self-reported
   activity_level (1-10) to get estimated maintenance calories (TDEE).
3. Derive a sustainable deficit from the stated goal weight and timeline —
   do not exceed a safe rate of loss (roughly 0.5-1% bodyweight/week); if the
   requested timeline implies an unsafe rate, use the safe rate instead and
   let the timeline run longer in practice.
4. Split into macros. Protein first — enough to protect muscle in a deficit
   (roughly 1.6-2.2g/kg bodyweight, more toward the top end for a leaner
   starting point or heavier training load). Then split the remaining
   calories between fat and carbs according to the user's stated dietary
   approach below: a low-carb/keto approach means minimal carbs and most
   remaining calories as fat; a higher-carb/performance approach means
   carbs get priority (they fuel training and recovery) with fat kept
   moderate (rough floor ~0.6g/kg for hormonal health); if no approach is
   stated, default to a balanced moderate-carb split. This is the baseline
   (rest-day) target — activity-day adjustments are applied later by the
   app from logged workout data, not by you.

Respond with ONLY a raw JSON object, no markdown code fences, no prose,
matching exactly this shape (maintenance_calories is your step-2 TDEE
estimate, before the deficit is applied):
{"calories":number,"protein_g":number,"fat_g":number,"carbs_g":number,"maintenance_calories":number}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      height_cm,
      gender,
      activity_level,
      starting_weight_kg,
      goal_weight_kg,
      goal_timeline_weeks,
      dietary_approach,
    } = await req.json()

    if (!height_cm || !gender || !activity_level || !starting_weight_kg || !goal_weight_kg || !goal_timeline_weeks) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userMessage =
      `height_cm=${height_cm}, gender=${gender}, activity_level=${activity_level}/10, ` +
      `starting_weight_kg=${starting_weight_kg}, goal_weight_kg=${goal_weight_kg}, ` +
      `goal_timeline_weeks=${goal_timeline_weeks}` +
      (dietary_approach
        ? `, dietary_approach=${dietary_approach}`
        : ', dietary_approach=(not stated — use a balanced moderate-carb split)')

    const rawText = await callClaude(SYSTEM_PROMPT, userMessage)

    let targets: {
      calories: number
      protein_g: number
      fat_g: number
      carbs_g: number
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
