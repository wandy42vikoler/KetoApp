import { corsHeaders } from '../_shared/cors.ts'
import { COACH_VOICE } from '../_shared/coach-voice.ts'
import { callClaude } from '../_shared/anthropic.ts'
import { extractJson } from '../_shared/extractJson.ts'

const SYSTEM_PROMPT = `${COACH_VOICE}

You will be given today's check-in numbers and the user's last 7 days of
check-in history. Write a short progress note — 1 to 3 sentences, no more.
Call out trends across the history (e.g. consecutive days below a target,
a plateau, a consistent improvement) rather than just restating today's
numbers in isolation. If there's nothing notable, say so briefly rather
than padding with generic encouragement.

Respond with ONLY a raw JSON object, no markdown code fences, no prose
outside the JSON, matching exactly this shape:
{"note":string}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { today, recent_days } = await req.json()

    if (!today) {
      return new Response(JSON.stringify({ error: 'Missing today' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userMessage = `today=${JSON.stringify(today)}\nrecent_days=${JSON.stringify(recent_days ?? [])}`

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
