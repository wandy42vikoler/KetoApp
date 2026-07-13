import { corsHeaders } from '../_shared/cors.ts'
import { callClaude } from '../_shared/anthropic.ts'
import { extractJson } from '../_shared/extractJson.ts'

const SYSTEM_PROMPT = `You are extracting a logged training session from a
screenshot of a workout-tracking app (e.g. Hevy, Strong, Strava, Apple
Watch, Garmin, or similar). Read off the activity/workout name, total
duration if shown, and every exercise with its logged sets (reps and
weight in kg — convert from lbs if shown, 1 lb = 0.453592 kg, rounded to
1 decimal).

If duration isn't shown, omit it rather than guessing. If a set's reps or
weight isn't legible, omit that set rather than guessing.

Also estimate calories_burned for the session, using this priority order:
1. If a calorie/kcal figure is shown directly in the screenshot, use it
   exactly — this is the most reliable source, don't second-guess it.
2. Else, if average heart rate (BPM) is visible, factor it into an
   intensity-adjusted estimate — higher relative BPM implies a higher-end
   estimate. Don't attempt a precise heart-rate-based formula (that needs
   resting/max HR and age, which you don't have); use it only to bias a
   reasonable estimate up or down.
3. Else, estimate using standard MET values for the activity type (e.g.
   tennis ≈ 7, running ≈ 9-11 depending on apparent pace, weightlifting ≈
   3-6, cycling ≈ 7-10) via: calories ≈ MET × weight_kg × duration_hours,
   using the user's weight_kg provided below and the extracted duration.
   If duration is also missing, omit calories_burned rather than guessing
   at both.

Respond with ONLY a raw JSON object, no markdown code fences, no prose,
matching exactly this shape:
{"activity_name":string,"duration_minutes":number,"calories_burned":number,"exercises":[{"name":string,"sets":[{"reps":number,"weight_kg":number}]}]}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { image_base64, media_type, weight_kg } = await req.json()

    if (!image_base64 || !media_type) {
      return new Response(JSON.stringify({ error: 'Missing image_base64 or media_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const textPrompt = weight_kg
      ? `Extract the logged training session from this screenshot. User's weight_kg for calorie estimation: ${weight_kg}.`
      : 'Extract the logged training session from this screenshot. User weight was not provided — if you need it for a MET-based calorie estimate, omit calories_burned instead of guessing a weight.'

    const rawText = await callClaude(SYSTEM_PROMPT, [
      { type: 'image', source: { type: 'base64', media_type, data: image_base64 } },
      { type: 'text', text: textPrompt },
    ])

    let result: Record<string, unknown>
    try {
      result = extractJson(rawText) as Record<string, unknown>
    } catch {
      throw new Error(`Could not parse JSON from model output: ${rawText.slice(0, 500)}`)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
