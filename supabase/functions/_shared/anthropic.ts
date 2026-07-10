const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const MODEL = 'claude-sonnet-5'

type TextBlock = { type: 'text'; text: string }
type ImageBlock = { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
type ContentBlock = TextBlock | ImageBlock

// Calls Claude with a system prompt + user content (plain text, or a mix of
// text/image blocks for vision requests) and returns the text of the
// response. Throws with a descriptive message on API errors, empty
// responses, or missing configuration — callers don't need to re-derive
// any of that.
export async function callClaude(
  system: string,
  userContent: string | ContentBlock[],
  maxTokens = 1024,
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured on this Supabase project')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Anthropic API error (${response.status}): ${text}`)
  }

  const result = await response.json()
  const rawText = result.content?.find((block: { type: string }) => block.type === 'text')?.text ?? ''

  if (!rawText) {
    throw new Error(
      `Anthropic returned no text content (stop_reason: ${result.stop_reason}). Raw response: ${JSON.stringify(result).slice(0, 500)}`,
    )
  }

  return rawText
}
