import { useEffect, useState } from 'react'
import { Trophy, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { fetchLeaderboard, setLeaderboardOptIn, setDisplayName } from '../../lib/leaderboard'
import Panel from '../../components/ui/Panel'
import Eyebrow from '../../components/ui/Eyebrow'
import SheetHeader from '../../components/ui/SheetHeader'
import { Field } from '../../components/ui/FormField'

export default function LeaderboardScreen({ onClose }) {
  const { user, profile, refreshProfile } = useAuth()
  const optedIn = Boolean(profile?.on_leaderboard)

  const [nameInput, setNameInput] = useState(profile?.display_name ?? '')
  const [leaderboard, setLeaderboardData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!optedIn) return
    let active = true
    setLoading(true)
    fetchLeaderboard()
      .then((rows) => active && setLeaderboardData(rows))
      .catch((err) => active && setError(err.message || 'Could not load leaderboard.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [optedIn])

  async function handleJoin() {
    setSaving(true)
    setError(null)
    try {
      const name = nameInput.trim()
      if (!name) {
        setError('Enter a display name first.')
        setSaving(false)
        return
      }
      if (name !== profile?.display_name) {
        await setDisplayName(user.id, name)
      }
      await setLeaderboardOptIn(user.id, true)
      await refreshProfile()
    } catch (err) {
      setError(err.message || 'Could not join the leaderboard.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLeave() {
    setSaving(true)
    setError(null)
    try {
      await setLeaderboardOptIn(user.id, false)
      await refreshProfile()
    } catch (err) {
      setError(err.message || 'Could not leave the leaderboard.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="absolute inset-0 bg-bg z-20 flex flex-col overflow-y-auto">
      <SheetHeader title="LEADERBOARD" onClose={onClose} />
      <div className="px-4 pb-8">
        {!optedIn ? (
          <Panel className="mb-3.5">
            <Eyebrow>
              <Trophy size={11} className="inline mr-1.5 -translate-y-px" />
              Join the Leaderboard
            </Eyebrow>
            <div className="text-[12.5px] text-fg leading-relaxed mb-3.5">
              Shares your display name, % progress to goal, and kg lost with other opted-in users. Your weight,
              height, meals, and workouts are never shared — only these three values.
            </div>
            <div className="mb-3.5">
              <Field
                label="DISPLAY NAME"
                value={nameInput}
                onChange={setNameInput}
                placeholder="How you'll appear to others"
              />
            </div>
            {error && <div className="font-mono text-[11px] text-alert mb-3">{error}</div>}
            <button
              onClick={handleJoin}
              disabled={saving}
              className="w-full bg-signal disabled:opacity-40 rounded-[9px] py-2.5 text-[#06150F] font-mono text-[12px] font-bold"
            >
              {saving ? 'JOINING…' : 'JOIN LEADERBOARD'}
            </button>
          </Panel>
        ) : (
          <>
            <Panel className="mb-3.5">
              {loading ? (
                <div className="font-mono text-[11px] text-fg-dim text-center py-6">LOADING…</div>
              ) : leaderboard.length <= 1 ? (
                <div className="text-center py-6">
                  <Users size={20} className="text-fg-dim mx-auto mb-2.5" />
                  <div className="font-mono text-[11px] text-fg-dim leading-relaxed">
                    No one else has joined yet.
                    <br />
                    Invite your training partners to sign up.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {leaderboard.map((row, i) => {
                    const isMe = row.user_id === user.id
                    return (
                      <div
                        key={row.user_id}
                        className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 ${
                          isMe ? 'border border-signal bg-signal-dim/30' : 'bg-panel-raised border border-hairline'
                        }`}
                      >
                        <div className="w-5 font-mono text-[11px] text-fg-dim text-center flex-shrink-0">
                          {row.achieved ? <Trophy size={14} className="text-caution mx-auto" /> : i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-fg truncate">
                            {row.display_name}
                            {isMe && <span className="text-fg-dim"> (you)</span>}
                          </div>
                          <div className="font-mono text-[10px] text-fg-dim">
                            {row.achieved
                              ? `ACHIEVED · -${row.total_lost_kg}kg`
                              : `${row.progress_pct ?? 0}% · -${row.total_lost_kg ?? 0}kg`}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Panel>

            {error && <div className="font-mono text-[11px] text-alert mb-3">{error}</div>}

            <button
              onClick={handleLeave}
              disabled={saving}
              className="w-full bg-transparent border border-hairline-lit disabled:opacity-50 rounded-[9px] py-2.5 text-fg-muted font-mono text-[11.5px]"
            >
              {saving ? 'LEAVING…' : 'LEAVE LEADERBOARD'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
