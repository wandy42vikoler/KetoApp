import { corsHeaders } from '../_shared/cors.ts'
import { COACH_VOICE } from '../_shared/coach-voice.ts'
import { callClaudeMessages } from '../_shared/anthropic.ts'

const PERSONA = `You are this user's dedicated coach for a Targeted Ketogenic
Diet (TKD) performance protocol. Every message includes a fresh JSON snapshot
of their actual data below — recent daily check-ins (weight, body fat,
muscle mass, sleep, energy, meal scores), recent workouts, today's macro
target vs. actual intake, and their overall progress summary (total lost,
rate per week, projected timeline). Ground every answer in this data — cite
specific numbers and dates rather than speaking in generalities. If the data
doesn't support a claim, say so rather than guessing or padding with
generic advice.

Respond in plain text, not JSON, not markdown headers or bullet lists unless
the user explicitly asks for a structured breakdown. Keep answers focused —
a few sentences for most questions, longer only if the question genuinely
requires it.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages, context } = await req.json()

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing messages' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const system = `${COACH_VOICE}\n\n${PERSONA}\n\nCurrent data snapshot:\n${JSON.stringify(context ?? {})}`

    const anthropicMessages = messages.map((m: { role: string; text: string }) => ({
      role: m.role,
      content: m.text,
    }))

    const reply = await callClaudeMessages(system, anthropicMessages, 1024)

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
