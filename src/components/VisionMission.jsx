import { useState, useEffect } from 'react'

const VISION_QUESTIONS = [
  'What does your ideal life look like in 5–10 years?',
  'What kind of person do you want to become?',
  'What impact do you want to have on the world?',
  'What does success truly mean to you?',
]

const MISSION_QUESTIONS = [
  'What do you stand for every single day?',
  'What drives you out of bed in the morning?',
  'How do you want to show up for the people you love?',
  'What values guide every decision you make?',
]

export default function VisionMission({ onClose }) {
  const [vision, setVision] = useState(() => localStorage.getItem('schedulent_vision') || '')
  const [mission, setMission] = useState(() => localStorage.getItem('schedulent_mission') || '')
  const [visionExpanded, setVisionExpanded] = useState(false)
  const [missionExpanded, setMissionExpanded] = useState(false)

  useEffect(() => {
    localStorage.setItem('schedulent_vision', vision)
  }, [vision])

  useEffect(() => {
    localStorage.setItem('schedulent_mission', mission)
  }, [mission])

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Vision &amp; Mission</h2>
            <p className="text-xs text-gray-400 mt-0.5">Your personal north star</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors" aria-label="Close">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Vision */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">🌅 My Vision</h3>
              <span className="text-xs text-gray-300 tabular-nums">{vision.length}/500</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Your vision describes the life you want to live — where you&apos;re headed in 5–10 years. Think: What does success look like? What kind of person do you want to become? What impact do you want to have?</p>
            <textarea
              value={vision}
              onChange={e => setVision(e.target.value)}
              placeholder="I envision a life where..."
              rows={5}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 resize-none"
            />
            {vision.length > 500 && <p className="text-xs text-amber-500 mt-1">Over the suggested 500 character limit — consider trimming for clarity.</p>}
            <button
              type="button"
              onClick={() => setVisionExpanded(v => !v)}
              className="mt-2 text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
            >
              <span style={{ display: 'inline-block', transform: visionExpanded ? 'rotate(90deg)' : 'none', fontSize: '9px' }}>▶</span>
              Guiding questions
            </button>
            {visionExpanded && (
              <ul className="mt-2 space-y-1.5 pl-3 border-l-2 border-indigo-100">
                {VISION_QUESTIONS.map((q, i) => (
                  <li key={i} className="text-xs text-gray-500">{q}</li>
                ))}
              </ul>
            )}
          </section>

          {/* Mission */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">🌠 My Mission</h3>
              <span className="text-xs text-gray-300 tabular-nums">{mission.length}/500</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Your mission is your daily purpose — the &apos;why&apos; behind your actions. Think: What do you stand for? What drives you every day? How do you want to show up for others?</p>
            <textarea
              value={mission}
              onChange={e => setMission(e.target.value)}
              placeholder="My mission is to..."
              rows={5}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 resize-none"
            />
            {mission.length > 500 && <p className="text-xs text-amber-500 mt-1">Over the suggested 500 character limit — consider trimming for clarity.</p>}
            <button
              type="button"
              onClick={() => setMissionExpanded(v => !v)}
              className="mt-2 text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
            >
              <span style={{ display: 'inline-block', transform: missionExpanded ? 'rotate(90deg)' : 'none', fontSize: '9px' }}>▶</span>
              Guiding questions
            </button>
            {missionExpanded && (
              <ul className="mt-2 space-y-1.5 pl-3 border-l-2 border-indigo-100">
                {MISSION_QUESTIONS.map((q, i) => (
                  <li key={i} className="text-xs text-gray-500">{q}</li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-[11px] text-gray-300 text-center">Saved automatically to this browser.</p>
        </div>
      </div>
    </div>
  )
}
