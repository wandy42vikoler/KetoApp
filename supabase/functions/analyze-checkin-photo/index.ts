import { corsHeaders } from '../_shared/cors.ts'
import { callClaude } from '../_shared/anthropic.ts'
import { extractJson } from '../_shared/extractJson.ts'

const SYSTEM_PROMPT = `You are extracting body composition metrics from a
screenshot of a smart scale app. Look for weight, body fat percentage, and
muscle mass — a screenshot may show some or all of these, and may show
other metrics you should ignore.

Only include a field if its value is clearly visible in the image. Do not
guess, estimate, or infer a value that isn't shown. Convert weight to
kilograms if the screenshot shows pounds (1 lb = 0.453592 kg), rounded to
1 decimal.

Respond with ONLY a raw JSON object, no markdown code fences, no prose,
containing only the fields you could confidently read, from this set:
{"weight_kg":number,"body_fat_pct":number,"muscle_mass_kg":number}`

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
      { type: 'text', text: 'Extract the visible body composition metrics from this scale screenshot.' },
    ])

    let extracted: Record<string, number>
    try {
      extracted = extractJson(rawText) as Record<string, number>
    } catch {
      throw new Error(`Could not parse JSON from model output: ${rawText.slice(0, 500)}`)
    }

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
