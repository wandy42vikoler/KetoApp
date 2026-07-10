import { corsHeaders } from '../_shared/cors.ts'
import { callClaude } from '../_shared/anthropic.ts'
import { extractJson } from '../_shared/extractJson.ts'

const SYSTEM_PROMPT = `You are estimating macros for a meal photo, for a strict
ketogenic diet protocol. Be conservative and clinical in portion sizing —
prefer slight underestimates of quantity over generous ones. Flag any
visible bread, grain, rice, pasta, sugar, or other high-carb item by name
in the notes field, since these are protocol violations on a keto diet.

The user may also provide a short text note alongside the photo (e.g. exact
portion weights, ingredients not visible in the shot, cooking method). Treat
anything they state as ground truth — they know their own plate better than
the image does — and use it to refine the estimate. This can also raise your
confidence: a stated portion weight resolves the biggest source of
uncertainty in a photo-only estimate.

Respond with ONLY a raw JSON object, no markdown code fences, no prose,
matching exactly this shape:
{"description":string,"protein_g":number,"fat_g":number,"net_carbs_g":number,"calories":number,"confidence":"low"|"medium"|"high","notes":string}

description: short factual description of what's on the plate.
confidence: "low" if portions/ingredients are hard to judge from the image
and no user note fills the gap, "high" if the plate is clear and
unambiguous or the user note resolves the ambiguity, "medium" otherwise.
notes: one line — flag carb risks, or state there are none.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { image_base64, media_type, user_context } = await req.json()

    if (!image_base64 || !media_type) {
      return new Response(JSON.stringify({ error: 'Missing image_base64 or media_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const textPrompt = user_context
      ? `Estimate the macros for this meal. User-provided context: ${user_context}`
      : 'Estimate the macros for this meal.'

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
