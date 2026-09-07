import { corsHeaders } from '../_shared/cors.ts'
import { COACH_VOICE } from '../_shared/coach-voice.ts'
import { callClaude } from '../_shared/anthropic.ts'
import { extractJson } from '../_shared/extractJson.ts'

const SYSTEM_PROMPT = `${COACH_VOICE}

You will be given a just-logged training session, and, if there was one,
the planned session it was meant to fulfill. Give brief feedback (2-4
sentences): whether the logged session matches or reasonably substitutes
for the plan, anything notable about volume/duration/exercise selection,
and how it fits into the day if other sessions were already logged today.
This is training feedback, not nutrition — don't reference any diet or
macro philosophy.

Respond with ONLY a raw JSON object, no markdown code fences, no prose
outside the JSON, matching exactly this shape:
{"feedback":string}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { planned_label, session, other_sessions_today } = await req.json()

    if (!session) {
      return new Response(JSON.stringify({ error: 'Missing session' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userMessage =
      `planned_session=${planned_label ?? '(none scheduled)'}\n` +
      `logged_session=${JSON.stringify(session)}\n` +
      `other_sessions_already_logged_today=${other_sessions_today ?? 0}`

    const rawText = await callClaude(SYSTEM_PROMPT, userMessage, 512)

    let result: { feedback: string }
    try {
      result = extractJson(rawText) as { feedback: string }
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
