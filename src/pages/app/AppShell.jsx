import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import BottomNav from '../../components/nav/BottomNav'
import Panel from '../../components/ui/Panel'
import Eyebrow from '../../components/ui/Eyebrow'
import ProtocolDial from '../../components/ui/ProtocolDial'

export default function AppShell() {
  const [tab, setTab] = useState('home')
  const { user, profile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-bg bg-vignette">
      <div className="px-4 pt-6 pb-[100px] max-w-md mx-auto">
        {tab === 'home' && <HomePlaceholder user={user} profile={profile} onSignOut={signOut} />}
        {tab === 'trends' && <ComingSoon title="Telemetry" label="Trends" />}
        {tab === 'coach' && <ComingSoon title="Live Context Loaded" label="Coach" />}
        {tab === 'targets' && <ComingSoon title="Configuration" label="Targets" />}
      </div>
      <BottomNav active={tab} onSelect={setTab} onFab={() => {}} />
    </div>
  )
}

function HomePlaceholder({ user, profile, onSignOut }) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-5">
        <div>
          <div className="font-mono text-[10px] text-fg-dim tracking-[0.18em]">PROTOCOL // TKD-01</div>
          <div className="text-xl font-bold text-fg">Welcome, {user?.email}</div>
        </div>
      </div>

      {profile?.starting_weight_kg && profile?.goal_weight_kg && (
        <Panel className="mb-3.5">
          <ProtocolDial
            start={profile.starting_weight_kg}
            goal={profile.goal_weight_kg}
            current={profile.starting_weight_kg}
          />
        </Panel>
      )}

      <Panel>
        <Eyebrow>Account</Eyebrow>
        <div className="font-mono text-[11px] text-fg-muted mb-4">
          Protocol start: {profile?.protocol_start_date ?? '—'}
        </div>
        <button
          onClick={onSignOut}
          className="w-full bg-transparent border border-hairline-lit rounded-[9px] py-2.5 text-fg-muted font-mono text-[12px]"
        >
          SIGN OUT
        </button>
      </Panel>

      <div className="font-mono text-[10.5px] text-fg-dim text-center mt-6">
        Dashboard, meals, workouts &amp; check-ins are built in the next pass.
      </div>
    </div>
  )
}

function ComingSoon({ title, label }) {
  return (
    <div>
      <div className="font-mono text-[10px] text-fg-dim tracking-[0.18em] mb-1">{title.toUpperCase()}</div>
      <div className="text-xl font-bold text-fg mb-5">{label}</div>
      <Panel>
        <div className="font-mono text-[11px] text-fg-dim text-center py-6">COMING IN THE NEXT PASS</div>
      </Panel>
    </div>
  )
}
