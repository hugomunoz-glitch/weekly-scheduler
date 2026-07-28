import { useState, useRef, useEffect } from 'react'
import { format, addDays, startOfDay } from 'date-fns'
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
  const size = 140, strokeWidth = 18
  const r = (size - strokeWidth) / 2
  const cx = size / 2, cy = size / 2
  const circumference = 2 * Math.PI * r
  const GAP = 3
  const total = data.reduce((s, d) => s + d.value, 0)
  const [hovered, setHovered] = useState(null)

  if (total === 0) {
    return (
      <div className="w-[140px] h-[140px] rounded-full border-[18px] border-gray-100 flex items-center justify-center shrink-0">
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

// ── Dashboard modal ───────────────────────────────────────────────────────────

export default function Dashboard({ tasks, goals, goalTasks, collaborations, collabMap, collabMembersMap, profileMap, weekStart, onClose }) {
  const [view, setView] = useState('personal')
  const overlayRef = useRef(null)

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // ── personal stats ──
  const weekTasks = tasksThisWeek(tasks, weekStart)
  const weekDone = weekTasks.filter(t => t.status === 'done')
  const dailyStreak = computeDailyStreak(tasks)
  const activeGoals = goals.filter(g => goalTasks.some(t => t.goal_id === g.id && t.status === 'done')).length

  // goals with progress + per-goal streak
  const goalsWithProgress = goals.map(g => {
    const linked = goalTasks.filter(t => t.goal_id === g.id)
    const done = linked.filter(t => t.status === 'done').length
    const pct = linked.length > 0 ? Math.round((done / linked.length) * 100) : 0
    const streak = computeGoalStreak(g.id, goalTasks)
    return { ...g, done, total: linked.length, pct, streak }
  }).sort((a, b) => b.pct - a.pct)

  // donut: tasks this week by category
  const catCounts = {}
  weekTasks.forEach(t => {
    const key = t.category || 'Uncategorized'
    catCounts[key] = (catCounts[key] || 0) + 1
  })
  const chartData = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([cat, count]) => {
      const badge = categoryBadge(cat)
      return { label: cat === 'Uncategorized' ? cat : badge?.name || cat, value: count, color: badge?.color || '#9ca3af' }
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

  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-gray-50 rounded-2xl shadow-2xl border border-gray-200 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard"
      >
        {/* ── header ── */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
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

              {/* ── goal momentum ── */}
              {goalsWithProgress.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Goal Momentum</h3>
                  <div className="flex flex-col gap-2">
                    {goalsWithProgress.map(g => (
                      <div key={g.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex items-center gap-4">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
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
                              style={{ width: `${g.pct}%`, backgroundColor: g.color }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-gray-700 w-9 text-right shrink-0">{g.pct}%</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

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
