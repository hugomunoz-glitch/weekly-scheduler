import { useState } from 'react'

export default function ViewSwitcher({ activeView, onChangeView, collaborations, collabMap, fullWidth }) {
  const [open, setOpen] = useState(false)

  const currentLabel = activeView === 'all'
    ? 'All'
    : activeView === 'personal'
      ? 'Personal'
      : (collaborations.find(c => c.id === activeView)?.name || 'All')
  const currentDot = activeView !== 'all' && activeView !== 'personal' && collabMap[activeView] ? collabMap[activeView].color : null

  function select(value) {
    onChangeView(value)
    setOpen(false)
  }

  return (
    <div className={'relative' + (fullWidth ? ' w-full' : '')}>
      <button
        onClick={() => setOpen(o => !o)}
        className={'flex items-center gap-1.5 text-xs border border-gray-200 rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors' + (fullWidth ? ' w-full justify-between' : '')}
      >
        <span className="flex items-center gap-1.5">
          {currentDot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: currentDot }} />}
          <span>Viewing: {currentLabel}</span>
        </span>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={'absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1' + (fullWidth ? ' w-full' : ' w-48')}>
            <button onClick={() => select('all')} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              All
            </button>
            <button onClick={() => select('personal')} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              Personal
            </button>
            {collaborations.map(c => (
              <button key={c.id} onClick={() => select(c.id)} className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: collabMap[c.id]?.color || '#9ca3af' }} />
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
