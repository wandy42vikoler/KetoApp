import { corsHeaders } from '../_shared/cors.ts'
import { callClaude } from '../_shared/anthropic.ts'
import { extractJson } from '../_shared/extractJson.ts'

const CATEGORIES = ['Produce', 'Protein', 'Dairy & Eggs', 'Pantry & Grains', 'Frozen', 'Beverages', 'Other']

const SYSTEM_PROMPT = `You are converting the user's own "eat" food guide (meal-by-meal
suggestions from their nutrition plan) into a concrete, deduplicated grocery shopping
list.

Turn descriptive/meal-context phrases (e.g. "Lean protein (chicken, turkey, fish, tofu)",
"Fist-size lean protein at every meal") into individual, purchasable grocery items (e.g.
"chicken breast", "turkey", "salmon fillets", "tofu"). Merge duplicates and near-duplicates
that show up across multiple meals into a single item. Skip vague phrases that don't map to
an actual purchasable grocery item (e.g. general encouragement, not a food).

Assign each item to exactly one of these categories, spelled exactly as given:
${CATEGORIES.join(', ')}.

Respond with ONLY a raw JSON object, no markdown code fences, no prose outside the JSON,
matching exactly this shape:
{"items":[{"item":string,"category":string}]}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { food_guide } = await req.json()
    const eatGuide = food_guide?.eat ?? {}

    const userMessage = `eat_guide=${JSON.stringify(eatGuide)}`

    const rawText = await callClaude(SYSTEM_PROMPT, userMessage, 1024)

    let result: { items: Array<{ item: string; category: string }> }
    try {
      result = extractJson(rawText) as { items: Array<{ item: string; category: string }> }
    } catch {
      throw new Error(`Could not parse JSON from model output: ${rawText.slice(0, 500)}`)
    }

    // Guard against a category the model invented despite instructions.
    const items = (result.items ?? []).map((i) => ({
      item: i.item,
      category: CATEGORIES.includes(i.category) ? i.category : 'Other',
    }))

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
