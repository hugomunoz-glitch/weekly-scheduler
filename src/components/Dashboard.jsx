import { useState, useRef, useEffect } from 'react'
import { format, addDays, startOfDay, parseISO } from 'date-fns'
import { categoryBadge } from './TaskCard'

// ── helpers ──────────────────────────────────────────────────────────────────

function weekRange(weekStart) {
  const start = format(weekStart, 'yyyy-MM-dd')
  const end = format(addDays(weekStart, 6), 'yyyy-MM-dd')
  return { start, end }
}

function tasksThisWeek(tasks, weekStart) {
  const { start, end } = weekRange(weekStart)
  return tasks.filter(t => t.scheduled_date >= start && t.scheduled_date <= end)
}

function tasksInRange(tasks, start, end) {
  return tasks.filter(t => t.scheduled_date >= start && t.scheduled_date <= end)
}

function computeDailyStreak(tasks) {
  const doneDates = new Set(
    tasks.filter(t => t.status === 'done' && t.scheduled_date).map(t => t.scheduled_date)
  )
  let streak = 0
  let d = startOfDay(new Date())
  while (doneDates.has(format(d, 'yyyy-MM-dd'))) {
    streak++
    d = addDays(d, -1)
  }
  return streak
}

function computeGoalStreak(goalId, goalTasks) {
  const doneDates = new Set(
    goalTasks.filter(t => t.goal_id === goalId && t.status === 'done' && t.scheduled_date)
             .map(t => t.scheduled_date)
  )
  let streak = 0
  let d = startOfDay(new Date())
  while (doneDates.has(format(d, 'yyyy-MM-dd'))) {
    streak++
    d = addDays(d, -1)
  }
  return streak
}

// ── Donut chart ───────────────────────────────────────────────────────────────

function DonutChart({ data }) {
  const size = 120, strokeWidth = 16
  const r = (size - strokeWidth) / 2
  const cx = size / 2, cy = size / 2
  const circumference = 2 * Math.PI * r
  const GAP = 3
  const total = data.reduce((s, d) => s + d.value, 0)
  const [hovered, setHovered] = useState(null)

  if (total === 0) {
    return (
      <div className="w-[120px] h-[120px] rounded-full border-[16px] border-gray-100 flex items-center justify-center shrink-0">
        <span className="text-xs text-gray-300">No data</span>
      </div>
    )
  }

  let offset = 0
  const segments = data.map(d => {
    const length = Math.max(0, (d.value / total) * circumference - GAP)
    const dashOffset = circumference - offset
    offset += length + GAP
    return { ...d, length, dashOffset }
  })

  const active = hovered != null ? data[hovered] : null

  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        {segments.map((seg, i) => (
          <circle key={seg.label} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color}
            strokeWidth={hovered === i ? strokeWidth + 3 : strokeWidth}
            strokeDasharray={`${seg.length} ${circumference - seg.length}`}
            strokeDashoffset={seg.dashOffset}
            strokeLinecap="butt"
            style={{ transition: 'stroke-width 0.12s ease', cursor: 'pointer' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        {active ? (
          <>
            <span className="text-lg font-bold tabular-nums text-gray-800">
              {Math.round((active.value / total) * 100)}%
            </span>
            <span className="text-[10px] text-gray-400 mt-0.5 max-w-[70px] text-center leading-tight">
              {active.label}
            </span>
          </>
        ) : (
          <>
            <span className="text-lg font-bold tabular-nums text-gray-800">{total}</span>
            <span className="text-[10px] text-gray-400 mt-0.5">tasks</span>
          </>
        )}
      </div>
    </div>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({ value, label, accent }) {
  return (
    <div className="flex-1 rounded-xl border border-gray-200 bg-white p-4 text-center">
      <p className="text-2xl font-bold tabular-nums" style={{ color: accent || '#111827' }}>{value}</p>
      <p className="text-xs text-gray-400 mt-1 leading-tight">{label}</p>
    </div>
  )
}

// ── Mobile donut (no hover, touch-friendly) ───────────────────────────────────

function MobileDonutChart({ data, size = 110 }) {
  const strokeWidth = 14
  const r = (size - strokeWidth) / 2
  const cx = size / 2, cy = size / 2
  const circumference = 2 * Math.PI * r
  const GAP = 3
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null
  let offset = 0
  const segments = data.map(d => {
    const length = Math.max(0, (d.value / total) * circumference - GAP)
    const dashOffset = circumference - offset
    offset += length + GAP
    return { ...d, length, dashOffset }
  })
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        {segments.map(seg => (
          <circle key={seg.label} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth={strokeWidth}
            strokeDasharray={`${seg.length} ${circumference - seg.length}`}
            strokeDashoffset={seg.dashOffset} strokeLinecap="butt"
          />
        ))}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{total}</span>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>tasks</span>
      </div>
    </div>
  )
}

// ── Dashboard modal ───────────────────────────────────────────────────────────

export default function Dashboard({ tasks, goals, goalTasks, collaborations, collabMap, collabMembersMap, profileMap, weekStart, onClose, isMobile = false }) {
  const [view, setView] = useState('personal')
  const [rangeMode, setRangeMode] = useState('week') // 'week' | 'custom'
  const defaultStart = format(weekStart, 'yyyy-MM-dd')
  const defaultEnd = format(addDays(weekStart, 6), 'yyyy-MM-dd')
  const [customStart, setCustomStart] = useState(defaultStart)
  const [customEnd, setCustomEnd] = useState(defaultEnd)
  const overlayRef = useRef(null)

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const rangeStart = rangeMode === 'week' ? defaultStart : customStart
  const rangeEnd = rangeMode === 'week' ? defaultEnd : customEnd

  // ── personal stats ──
  const weekTasks = rangeMode === 'week' ? tasksThisWeek(tasks, weekStart) : tasksInRange(tasks, rangeStart, rangeEnd)
  const weekDone = weekTasks.filter(t => t.status === 'done')
  const dailyStreak = computeDailyStreak(tasks)
  const activeGoals = goals.filter(g => goalTasks.some(t => t.goal_id === g.id && t.status === 'done')).length

  // goals with progress + per-goal streak
  const goalsWithProgress = goals.map(g => {
    const linked = goalTasks.filter(t => t.goal_id === g.id)
    const done = linked.filter(t => t.status === 'done').length
    const pct = linked.length > 0 ? Math.round((done / linked.length) * 100) : 0
    const streak = computeGoalStreak(g.id, goalTasks)
    const catColor = g.category ? categoryBadge(g.category)?.color : null
    const displayColor = catColor || g.color
    return { ...g, done, total: linked.length, pct, streak, displayColor }
  }).sort((a, b) => b.pct - a.pct)

  // donut: tasks this week by category
  const catCounts = {}
  weekTasks.forEach(t => {
    const key = t.category || 'Uncategorized'
    catCounts[key] = (catCounts[key] || 0) + 1
  })
  const DONUT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']
  const chartData = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([cat, count], i) => {
      const badge = categoryBadge(cat)
      return { label: cat === 'Uncategorized' ? cat : badge?.name || cat, value: count, color: badge?.color || DONUT_COLORS[i % DONUT_COLORS.length] }
    })

  // ── team stats ──
  const memberDone = {}
  tasks.filter(t => t.status === 'done' && t.assigned_to).forEach(t => {
    memberDone[t.assigned_to] = (memberDone[t.assigned_to] || 0) + 1
  })
  const memberWeekDone = {}
  weekDone.filter(t => t.assigned_to).forEach(t => {
    memberWeekDone[t.assigned_to] = (memberWeekDone[t.assigned_to] || 0) + 1
  })

  const weekLabel = rangeMode === 'week'
    ? `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`
    : `${format(parseISO(rangeStart), 'MMM d')} – ${format(parseISO(rangeEnd), 'MMM d, yyyy')}`

  if (isMobile) {
    return (
      <div
        ref={overlayRef}
        style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
        onClick={e => { if (e.target === overlayRef.current) onClose() }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Dashboard"
          style={{ background: '#f8f9fc', borderRadius: '16px 16px 0 0', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          {/* mobile handle + header */}
          <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #e5e7eb', background: '#f8f9fc', position: 'sticky', top: 0, zIndex: 10 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#d1d5db', margin: '0 auto 10px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 15, color: '#111827', margin: 0 }}>Dashboard</p>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{weekLabel}</p>
              </div>
              <button
                onClick={onClose}
                style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280', fontSize: 14 }}
                aria-label="Close"
              >✕</button>
            </div>
            {/* date range picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 2, gap: 2 }}>
                {['week', 'custom'].map(m => (
                  <button
                    key={m}
                    onClick={() => setRangeMode(m)}
                    style={{
                      padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                      background: rangeMode === m ? 'white' : 'transparent',
                      color: rangeMode === m ? '#111827' : '#6b7280',
                      boxShadow: rangeMode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    {m === 'week' ? 'This week' : 'Custom'}
                  </button>
                ))}
              </div>
              {rangeMode === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#374151' }}>
                  <input
                    type="date"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 6px', fontSize: 11, background: 'white', outline: 'none' }}
                  />
                  <span style={{ color: '#9ca3af' }}>–</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                    style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 6px', fontSize: 11, background: 'white', outline: 'none' }}
                  />
                </div>
              )}
            </div>
          </div>

          <div style={{ overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* stat tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { value: dailyStreak === 0 ? '—' : `${dailyStreak}d`, label: 'Streak', accent: dailyStreak > 0 ? '#f97316' : '#9ca3af' },
                { value: weekDone.length, label: 'Done', accent: '#6366f1' },
                { value: `${weekTasks.length > 0 ? Math.round((weekDone.length / weekTasks.length) * 100) : 0}%`, label: 'Complete', accent: '#10b981' },
              ].map(({ value, label, accent }) => (
                <div key={label} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                  <p style={{ fontSize: 20, fontWeight: 700, color: accent, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
                  <p style={{ fontSize: 10, color: '#9ca3af', margin: '3px 0 0' }}>{label}</p>
                </div>
              ))}
            </div>

            {/* where your time goes */}
            <section>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af', marginBottom: 8 }}>Where Your Time Goes</p>
              {chartData.length === 0 ? (
                <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, textAlign: 'center', fontSize: 13, color: '#d1d5db' }}>No tasks this week.</div>
              ) : (
                <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <MobileDonutChart data={chartData} size={110} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
                    {chartData.map(d => {
                      const total = chartData.reduce((s, x) => s + x.value, 0)
                      return (
                        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{d.value}</span>
                          <span style={{ fontSize: 11, color: '#9ca3af', width: 30, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            {Math.round((d.value / total) * 100)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* goal momentum */}
            {goalsWithProgress.length > 0 && (
              <section>
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af', marginBottom: 8 }}>Goal Momentum</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {goalsWithProgress.map(g => (
                    <div key={g.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: g.displayColor, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: '#1f2937', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {g.streak > 0 && <span style={{ fontSize: 11, color: '#f97316', fontWeight: 500 }}>🔥{g.streak}d</span>}
                            <span style={{ fontSize: 11, color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{g.done}/{g.total}</span>
                          </div>
                        </div>
                        <div style={{ height: 5, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 99, background: g.displayColor, width: `${g.pct}%` }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', width: 34, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{g.pct}%</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-gray-50 rounded-2xl shadow-2xl border border-gray-200 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard"
      >
        {/* ── header ── */}
        <div className="sticky top-0 z-10 flex flex-col gap-3 px-5 pt-5 pb-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Dashboard</h2>
              <p className="text-xs text-gray-400 mt-0.5">{weekLabel}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* personal / team toggle */}
              <div className="flex items-center p-0.5 rounded-lg bg-gray-200 text-xs font-medium">
                {['personal', 'team'].map(v => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-3 py-1.5 rounded-md capitalize transition-all ${
                      view === v
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                aria-label="Close dashboard"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>
          {/* ── date range ── */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 rounded-lg bg-gray-200 text-xs font-medium">
              {['week', 'custom'].map(m => (
                <button
                  key={m}
                  onClick={() => setRangeMode(m)}
                  className={`px-2.5 py-1 rounded-md capitalize transition-all ${
                    rangeMode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m === 'week' ? 'This week' : 'Custom'}
                </button>
              ))}
            </div>
            {rangeMode === 'custom' && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:border-indigo-400"
                />
                <span className="text-gray-400">–</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:border-indigo-400"
                />
              </div>
            )}
          </div>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {view === 'personal' ? (
            <>
              {/* ── quick stats ── */}
              <div className="flex gap-3">
                <StatTile value={dailyStreak === 0 ? '—' : `${dailyStreak}d`} label="Daily streak" accent={dailyStreak > 0 ? '#f97316' : undefined} />
                <StatTile value={weekDone.length} label="Done this week" accent="#6366f1" />
                <StatTile value={`${weekTasks.length > 0 ? Math.round((weekDone.length / weekTasks.length) * 100) : 0}%`} label="Completion rate" accent="#10b981" />
                <StatTile value={activeGoals} label="Goals with progress" />
              </div>

              {/* ── task breakdown ── */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Where Your Time Goes</h3>
                {chartData.length === 0 ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-300">
                    No tasks scheduled this week yet.
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-6">
                    <DonutChart data={chartData} />
                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                      {chartData.map(d => (
                        <div key={d.label} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="text-sm text-gray-600 truncate flex-1 min-w-0">{d.label}</span>
                          <span className="text-sm tabular-nums font-medium text-gray-800 shrink-0">{d.value}</span>
                          <span className="text-xs tabular-nums text-gray-400 w-9 text-right shrink-0">
                            {Math.round((d.value / chartData.reduce((s, x) => s + x.value, 0)) * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* ── goal momentum ── */}
              {goalsWithProgress.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Goal Momentum</h3>
                  <div className="flex flex-col gap-2">
                    {goalsWithProgress.map(g => (
                      <div key={g.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex items-center gap-4">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.displayColor }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <p className="text-sm font-medium text-gray-800 truncate">{g.title}</p>
                            <div className="flex items-center gap-2 shrink-0">
                              {g.streak > 0 && (
                                <span className="text-xs text-orange-500 font-medium tabular-nums">🔥 {g.streak}d</span>
                              )}
                              <span className="text-xs text-gray-400 tabular-nums">{g.done}/{g.total}</span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${g.pct}%`, backgroundColor: g.displayColor }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-gray-700 w-9 text-right shrink-0">{g.pct}%</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            /* ── team view ── */
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Team This Week</h3>
              {collaborations.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-300">
                  No collaborations yet. Add one via Settings.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {collaborations.map(collab => {
                    const members = collabMembersMap[collab.id] || []
                    const color = collabMap[collab.id]?.color || '#6366f1'
                    return (
                      <div key={collab.id} className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <p className="text-sm font-semibold text-gray-800">{collab.name}</p>
                        </div>
                        {members.length === 0 ? (
                          <p className="text-xs text-gray-300">No members yet.</p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {members.map(m => {
                              const done = memberDone[m.id] || 0
                              const weekDoneCount = memberWeekDone[m.id] || 0
                              return (
                                <div key={m.id} className="flex items-center gap-3">
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 text-white" style={{ backgroundColor: color }}>
                                    {m.username.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-800 font-medium truncate">{m.username}</p>
                                    <p className="text-xs text-gray-400 tabular-nums">
                                      {weekDoneCount} done this week · {done} total
                                    </p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
