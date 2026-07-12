const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const MODEL = 'claude-sonnet-5'

type TextBlock = { type: 'text'; text: string }
type ImageBlock = { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
type ContentBlock = TextBlock | ImageBlock
type Message = { role: 'user' | 'assistant'; content: string | ContentBlock[] }

async function callClaudeRaw(system: string, messages: Message[], maxTokens: number): Promise<string> {
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
      messages,
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

// Single-turn call: system prompt + one user turn (plain text, or a mix of
// text/image blocks for vision requests). Returns the response text.
export function callClaude(system: string, userContent: string | ContentBlock[], maxTokens = 1024): Promise<string> {
  return callClaudeRaw(system, [{ role: 'user', content: userContent }], maxTokens)
}

// Multi-turn call: system prompt + a full conversation history. Used by
// coach-chat, where prior turns matter and the system prompt carries a fresh
// per-request data snapshot rather than being baked into any one turn.
export function callClaudeMessages(system: string, messages: Message[], maxTokens = 1024): Promise<string> {
  return callClaudeRaw(system, messages, maxTokens)
}
