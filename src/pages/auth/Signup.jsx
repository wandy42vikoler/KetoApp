import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import Panel from '../../components/ui/Panel'
import { Field } from '../../components/ui/FormField'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (signUpError) {
      setError(signUpError.message)
      return
    }
    if (data.session) {
      navigate('/', { replace: true })
    } else {
      setCheckEmail(true)
    }
  }

  return (
    <div className="min-h-screen bg-bg bg-vignette flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-mono text-[10px] text-fg-dim tracking-[0.18em] mb-1">PROTOCOL // TKD-01</div>
          <div className="text-xl font-bold text-fg">Create Account</div>
        </div>

        {checkEmail ? (
          <Panel>
            <div className="font-mono text-[11px] text-fg-dim tracking-[0.1em] mb-2">CONFIRMATION SENT</div>
            <div className="text-[13px] text-fg leading-relaxed">
              Check <span className="text-signal">{email}</span> to confirm your account, then sign in.
            </div>
          </Panel>
        ) : (
          <Panel>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Field label="EMAIL" type="email" value={email} onChange={setEmail} autoComplete="email" required />
              <Field
                label="PASSWORD"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                minLength={6}
                required
              />
              {error && <div className="font-mono text-[11px] text-alert">{error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="mt-1 bg-signal disabled:opacity-50 rounded-[9px] py-2.5 text-[#06150F] font-mono text-[12px] font-bold"
              >
                {loading ? 'CREATING…' : 'CREATE ACCOUNT'}
              </button>
            </form>
          </Panel>
        )}

        <div className="text-center mt-5 font-mono text-[11.5px] text-fg-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-signal">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
