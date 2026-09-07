import { corsHeaders } from '../_shared/cors.ts'
import { COACH_VOICE } from '../_shared/coach-voice.ts'
import { callClaude } from '../_shared/anthropic.ts'
import { extractJson } from '../_shared/extractJson.ts'

const SYSTEM_PROMPT = `${COACH_VOICE}

You will be given the user's own written summary of their week, plus that
week's logged daily check-ins (weight, body fat, sleep, energy, meal
scores) and workout count. Write a short weekly progress note — 2 to 4
sentences. Weigh the numbers against what they wrote — confirm what the
data supports, flag anything their summary claims that the numbers don't
back up (or vice versa), and note any trend across the week. If there's
nothing notable, say so briefly rather than padding with generic
encouragement.

Respond with ONLY a raw JSON object, no markdown code fences, no prose
outside the JSON, matching exactly this shape:
{"note":string}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { summary, recent_daily_logs, workouts_count } = await req.json()

    const userMessage =
      `user_summary=${summary || '(none written)'}\n` +
      `daily_logs=${JSON.stringify(recent_daily_logs ?? [])}\n` +
      `workouts_logged_this_week=${workouts_count ?? 0}`

    const rawText = await callClaude(SYSTEM_PROMPT, userMessage, 512)

    let result: { note: string }
    try {
      result = extractJson(rawText) as { note: string }
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
