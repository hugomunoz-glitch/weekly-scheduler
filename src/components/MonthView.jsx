import { useState } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, addMonths, subMonths } from 'date-fns'

export default function MonthView({ tasks, onDayClick }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = []
  let d = calStart
  while (d <= calEnd) { days.push(d); d = addDays(d, 1) }

  function tasksForDay(date) {
    const str = format(date, 'yyyy-MM-dd')
    return tasks.filter(t => (t.scheduled_date === str || t.due_date_card_date === str) && t.status !== 'done')
  }

  const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#6b7280', cursor: 'pointer', padding: '4px 10px' }}>‹</button>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{format(currentMonth, 'MMMM yyyy')}</span>
          <button onClick={() => setCurrentMonth(new Date())} style={{ fontSize: '11px', color: '#6366f1', background: 'none', border: '1px solid #c7d2fe', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer' }}>Today</button>
        </div>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#6b7280', cursor: 'pointer', padding: '4px 10px' }}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        {DAY_HEADERS.map(h => (
          <div key={h} style={{ padding: '6px 4px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>{h}</div>
        ))}
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr', overflow: 'hidden' }}>
        {days.map((day, i) => {
          const active = tasksForDay(day)
          const inMonth = isSameMonth(day, currentMonth)
          const today = isToday(day)
          return (
            <div
              key={i}
              onClick={() => onDayClick && onDayClick(day)}
              style={{
                borderRight: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6',
                padding: '4px 6px', background: today ? '#eef2ff' : inMonth ? 'white' : '#f9fafb',
                cursor: onDayClick ? 'pointer' : 'default', overflow: 'hidden',
                transition: 'background 0.1s'
              }}
              onMouseEnter={e => { if (!today) e.currentTarget.style.background = inMonth ? '#f9fafb' : '#f3f4f6' }}
              onMouseLeave={e => { e.currentTarget.style.background = today ? '#eef2ff' : inMonth ? 'white' : '#f9fafb' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{
                  fontSize: '12px', fontWeight: today ? 700 : 500,
                  color: today ? 'white' : inMonth ? '#374151' : '#d1d5db',
                  background: today ? '#6366f1' : 'transparent',
                  width: '20px', height: '20px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>{format(day, 'd')}</span>
                {active.length > 0 && (
                  <span style={{ fontSize: '9px', color: active.length >= 5 ? '#ef4444' : active.length >= 3 ? '#f59e0b' : '#6366f1', fontWeight: 600 }}>{active.length}</span>
                )}
              </div>
              {active.slice(0, 3).map(t => (
                <div key={t.id} style={{ fontSize: '10px', color: '#374151', background: '#eef2ff', borderRadius: '3px', padding: '1px 4px', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.title}
                </div>
              ))}
              {active.length > 3 && <div style={{ fontSize: '9px', color: '#9ca3af' }}>+{active.length - 3} more</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
