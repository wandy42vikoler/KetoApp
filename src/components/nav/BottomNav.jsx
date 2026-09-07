import { Home, TrendingUp, MessageSquare, SlidersHorizontal, Plus } from 'lucide-react'

const TABS = [
  { id: 'home', icon: Home },
  { id: 'trends', icon: TrendingUp },
  { id: 'fab', icon: Plus },
  { id: 'coach', icon: MessageSquare },
  { id: 'targets', icon: SlidersHorizontal },
]

export default function BottomNav({ active, onSelect, onFab }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-[78px] bg-panel/90 backdrop-blur-md border-t border-hairline flex items-center justify-around px-2 pb-3.5">
      {TABS.map((tab) => {
        if (tab.id === 'fab') {
          return (
            <button
              key="fab"
              onClick={onFab}
              className="w-[52px] h-[52px] rounded-full bg-signal flex items-center justify-center -mt-[22px] shadow-[0_4px_18px_rgba(30,158,102,0.4)]"
            >
              <Plus size={22} color="#06150F" />
            </button>
          )
        }
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`bg-transparent p-2 ${isActive ? 'text-signal' : 'text-fg-dim'}`}
          >
            <tab.icon size={20} />
          </button>
        )
      })}
    </div>
  )
}
