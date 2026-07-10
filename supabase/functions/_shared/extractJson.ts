// Claude is asked to respond with raw JSON, but sometimes wraps it in a
// markdown code fence anyway — strip that before parsing rather than
// failing the whole request over formatting.
export function extractJson(rawText: string): unknown {
  const trimmed = rawText.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(candidate)
}
