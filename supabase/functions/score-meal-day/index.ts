import { corsHeaders } from '../_shared/cors.ts'
import { COACH_VOICE } from '../_shared/coach-voice.ts'
import { callClaude } from '../_shared/anthropic.ts'
import { extractJson } from '../_shared/extractJson.ts'

const SYSTEM_PROMPT = `${COACH_VOICE}

You will be given a day's logged meals and that day's macro target. Score
adherence 1-10: how well the day's totals hit the target (protein
sufficiency, net carb ceiling respected, calorie adherence), not effort or
intent. Write one line of justification citing the actual numbers.

Respond with ONLY a raw JSON object, no markdown code fences, no prose
outside the JSON, matching exactly this shape:
{"score":number,"justification":string}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { meals, target } = await req.json()

    if (!meals || !target) {
      return new Response(JSON.stringify({ error: 'Missing meals or target' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userMessage = `meals=${JSON.stringify(meals)}\ntarget=${JSON.stringify(target)}`

    const rawText = await callClaude(SYSTEM_PROMPT, userMessage, 512)

    let result: { score: number; justification: string }
    try {
      result = extractJson(rawText) as { score: number; justification: string }
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
