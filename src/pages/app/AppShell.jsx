import { useState } from 'react'
import BottomNav from '../../components/nav/BottomNav'
import Panel from '../../components/ui/Panel'
import Dashboard from './Dashboard'
import TargetsScreen from './TargetsScreen'
import TrendsScreen from './TrendsScreen'
import LogSheet from './LogSheet'
import CheckIn from './CheckIn'

export default function AppShell() {
  const [tab, setTab] = useState('home')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  function handleRefresh() {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="min-h-screen bg-bg bg-vignette relative">
      <div className="px-4 pt-6 pb-[100px] max-w-md mx-auto">
        {tab === 'home' && <Dashboard onOpenCheckIn={() => setCheckinOpen(true)} refreshKey={refreshKey} />}
        {tab === 'trends' && <TrendsScreen />}
        {tab === 'coach' && <ComingSoon title="Live Context Loaded" label="Coach" />}
        {tab === 'targets' && <TargetsScreen />}
      </div>

      <BottomNav active={tab} onSelect={setTab} onFab={() => setSheetOpen(true)} />

      {sheetOpen && (
        <LogSheet
          onClose={() => setSheetOpen(false)}
          onCheckinSaved={handleRefresh}
          onMealSaved={handleRefresh}
          onWorkoutSaved={handleRefresh}
        />
      )}
      {checkinOpen && <CheckIn onClose={() => setCheckinOpen(false)} onSaved={handleRefresh} />}
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
