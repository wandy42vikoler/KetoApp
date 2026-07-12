import { useState } from 'react'
import BottomNav from '../../components/nav/BottomNav'
import Dashboard from './Dashboard'
import TargetsScreen from './TargetsScreen'
import TrendsScreen from './TrendsScreen'
import CoachScreen from './CoachScreen'
import LogSheet from './LogSheet'
import CheckIn from './CheckIn'
import LeaderboardScreen from './LeaderboardScreen'

export default function AppShell() {
  const [tab, setTab] = useState('home')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  function handleRefresh() {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="min-h-screen bg-bg bg-vignette relative">
      <div className="px-4 pt-6 pb-[100px] max-w-md mx-auto">
        {tab === 'home' && (
          <Dashboard
            onOpenCheckIn={() => setCheckinOpen(true)}
            onOpenLeaderboard={() => setLeaderboardOpen(true)}
            refreshKey={refreshKey}
          />
        )}
        {tab === 'trends' && <TrendsScreen />}
        {tab === 'coach' && <CoachScreen />}
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
      {leaderboardOpen && <LeaderboardScreen onClose={() => setLeaderboardOpen(false)} />}
    </div>
  )
}
