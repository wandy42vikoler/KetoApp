import { useState } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { buildCoachContext } from '../../lib/coachContext'

export default function CoachScreen() {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    const nextMessages = [...messages, { role: 'user', text }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)
    setError(null)

    try {
      const context = await buildCoachContext(user.id, profile)
      const { data, error: invokeError } = await supabase.functions.invoke('coach-chat', {
        body: { messages: nextMessages, context },
      })
      if (invokeError) throw invokeError
      setMessages((m) => [...m, { role: 'assistant', text: data.reply }])
    } catch (err) {
      setError(err.message || 'Coach is unavailable right now.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <div className="font-mono text-[10px] text-fg-dim tracking-[0.18em] mb-1">LIVE CONTEXT LOADED</div>
      <div className="text-xl font-bold text-fg mb-4">Coach</div>

      <div className="mb-4">
        {messages.length === 0 && (
          <div className="font-mono text-[11px] text-fg-dim text-center py-10 leading-relaxed">
            Ask about your trends, targets, or the science behind the protocol.
            <br />
            Every answer is grounded in your actual logged data.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex mb-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[84%] text-[13px] leading-relaxed px-3.5 py-2.5 rounded-[12px] ${
                m.role === 'user' ? 'bg-info text-[#06110F]' : 'bg-panel border border-hairline text-fg'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start mb-3">
            <div className="bg-panel border border-hairline text-fg-dim text-[12px] px-3.5 py-2.5 rounded-[12px] font-mono animate-pulse">
              THINKING…
            </div>
          </div>
        )}
        {error && <div className="font-mono text-[11px] text-alert text-center py-2">{error}</div>}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 bg-panel border border-hairline rounded-[12px] p-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the coach..."
          disabled={sending}
          className="flex-1 bg-transparent border-none outline-none text-fg text-[13px] px-2 py-1.5"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="bg-signal disabled:opacity-40 rounded-[8px] w-[34px] h-[34px] flex items-center justify-center flex-shrink-0"
        >
          <Send size={14} color="#06150F" />
        </button>
      </form>
    </div>
  )
}
