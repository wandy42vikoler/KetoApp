import { corsHeaders } from '../_shared/cors.ts'
import { COACH_VOICE } from '../_shared/coach-voice.ts'
import { callClaude } from '../_shared/anthropic.ts'
import { extractJson } from '../_shared/extractJson.ts'

const SYSTEM_PROMPT = `${COACH_VOICE}

You are looking at the user's own weekly progress photo(s) — a physique
check, not a medical image. Give a short, direct visual assessment (2-4
sentences): leanness, muscle definition/fullness, posture, any visible
water retention or bloat. If a second, earlier photo is included, compare
the two and say plainly whether visible change is evident week-over-week
or not — don't manufacture progress that isn't visible. Stay focused on
what's visually observable; you are not diagnosing anything. If the
user's written summary or approach is provided, you can reference it for
context (e.g. explaining a bloated look the day after a high-sodium
meal), but the photo is the primary source. If nothing meaningful is
visible to comment on (e.g. poor lighting/angle, or genuinely no visible
change), say that briefly rather than inventing detail.

Respond with ONLY a raw JSON object, no markdown code fences, no prose
outside the JSON, matching exactly this shape:
{"assessment":string}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      image_base64,
      media_type,
      previous_image_base64,
      previous_media_type,
      summary,
      dietary_approach,
    } = await req.json()

    if (!image_base64 || !media_type) {
      return new Response(JSON.stringify({ error: 'Missing image_base64 or media_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const content: Array<
      | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
      | { type: 'text'; text: string }
    > = []

    if (previous_image_base64 && previous_media_type) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: previous_media_type, data: previous_image_base64 },
      })
      content.push({ type: 'text', text: 'Above: previous week’s progress photo.' })
    }

    content.push({
      type: 'image',
      source: { type: 'base64', media_type, data: image_base64 },
    })
    content.push({
      type: 'text',
      text:
        `Above: this week's progress photo${previous_image_base64 ? ' (compare against the earlier one)' : ''}.\n` +
        `user_written_summary=${summary || '(none written)'}\n` +
        `dietary_approach=${dietary_approach || '(not set)'}`,
    })

    const rawText = await callClaude(SYSTEM_PROMPT, content, 512)

    let result: { assessment: string }
    try {
      result = extractJson(rawText) as { assessment: string }
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
