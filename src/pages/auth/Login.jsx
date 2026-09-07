import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import Panel from '../../components/ui/Panel'
import { Field } from '../../components/ui/FormField'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signInError) {
      setError(signInError.message)
    }
    // On success, RedirectIfAuthed reacts to the session change and navigates —
    // no imperative navigate() here (it would race the auth-state listener).
  }

  return (
    <div className="min-h-screen bg-bg bg-vignette flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-mono text-[10px] text-fg-dim tracking-[0.18em] mb-1">SHREDDER PLANNER</div>
          <div className="text-xl font-bold text-fg">Sign In</div>
        </div>
        <Panel>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Field label="EMAIL" type="email" value={email} onChange={setEmail} autoComplete="email" required />
            <Field
              label="PASSWORD"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              required
            />
            {error && <div className="font-mono text-[11px] text-alert">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 bg-signal disabled:opacity-50 rounded-[9px] py-2.5 text-[#06150F] font-mono text-[12px] font-bold"
            >
              {loading ? 'SIGNING IN…' : 'SIGN IN'}
            </button>
          </form>
        </Panel>
        <div className="text-center mt-5 font-mono text-[11.5px] text-fg-muted">
          No account?{' '}
          <Link to="/signup" className="text-signal">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  )
}
