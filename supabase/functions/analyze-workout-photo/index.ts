import { corsHeaders } from '../_shared/cors.ts'
import { callClaude } from '../_shared/anthropic.ts'
import { extractJson } from '../_shared/extractJson.ts'

const SYSTEM_PROMPT = `You are extracting a logged training session from a
screenshot of a workout-tracking app (e.g. Hevy, Strong, or similar). Read
off the activity/workout name, total duration if shown, and every exercise
with its logged sets (reps and weight in kg — convert from lbs if shown,
1 lb = 0.453592 kg, rounded to 1 decimal).

If duration isn't shown, omit it rather than guessing. If a set's reps or
weight isn't legible, omit that set rather than guessing.

Respond with ONLY a raw JSON object, no markdown code fences, no prose,
matching exactly this shape:
{"activity_name":string,"duration_minutes":number,"exercises":[{"name":string,"sets":[{"reps":number,"weight_kg":number}]}]}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { image_base64, media_type } = await req.json()

    if (!image_base64 || !media_type) {
      return new Response(JSON.stringify({ error: 'Missing image_base64 or media_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawText = await callClaude(SYSTEM_PROMPT, [
      { type: 'image', source: { type: 'base64', media_type, data: image_base64 } },
      { type: 'text', text: 'Extract the logged training session from this screenshot.' },
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
