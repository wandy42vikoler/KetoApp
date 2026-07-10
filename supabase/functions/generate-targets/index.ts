import { corsHeaders } from '../_shared/cors.ts'
import { COACH_VOICE } from '../_shared/coach-voice.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const MODEL = 'claude-sonnet-5'

const SYSTEM_PROMPT = `${COACH_VOICE}

Calculate Targeted Ketogenic Diet (TKD) macro targets for a rest day and an
activity day. Method:
1. BMR via Mifflin-St Jeor.
2. Apply an activity multiplier derived from the user's self-reported
   activity_level (1-10).
3. Derive a sustainable deficit from the stated goal weight and timeline —
   do not exceed a safe rate of loss (roughly 0.5-1% bodyweight/week); if the
   requested timeline implies an unsafe rate, use the safe rate instead and
   let the timeline run longer in practice.
4. Split into TKD macros: high fat, moderate protein, very low carb on rest
   days; activity days get higher calories and a modest carb allowance
   timed around training to support performance, still net-carb-ceiling
   constrained (TKD, not standard keto).
5. Respond with strict JSON only, no markdown, no prose, matching exactly:
{"rest":{"calories":number,"protein_g":number,"fat_g":number,"net_carbs_g":number},"activity":{"calories":number,"protein_g":number,"fat_g":number,"net_carbs_g":number}}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured on this Supabase project')
    }

    const { height_cm, gender, activity_level, starting_weight_kg, goal_weight_kg, goal_timeline_weeks } =
      await req.json()

    if (!height_cm || !gender || !activity_level || !starting_weight_kg || !goal_weight_kg || !goal_timeline_weeks) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userMessage = `height_cm=${height_cm}, gender=${gender}, activity_level=${activity_level}/10, starting_weight_kg=${starting_weight_kg}, goal_weight_kg=${goal_weight_kg}, goal_timeline_weeks=${goal_timeline_weeks}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Anthropic API error (${response.status}): ${text}`)
    }

    const result = await response.json()
    const rawText = result.content?.[0]?.text ?? ''
    const targets = JSON.parse(rawText)

    return new Response(JSON.stringify(targets), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
