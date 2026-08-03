import { useState, useRef, useEffect } from 'react'
import { format, startOfYear, eachMonthOfInterval, endOfYear, getDaysInMonth, startOfMonth, getDay, isToday, addYears, subYears, getMonth, getYear } from 'date-fns'

export default function YearView({ tasks, onMonthClick, onDayClick }) {
  const [currentYear, setCurrentYear] = useState(new Date())
  const months = eachMonthOfInterval({ start: startOfYear(currentYear), end: endOfYear(currentYear) })
  const scrollRef = useRef(null)
  const currentMonthRef = useRef(null)
  const todayMonth = getMonth(new Date())
  const todayYear = getYear(new Date())

  useEffect(() => {
    if (currentMonthRef.current && scrollRef.current) {
      currentMonthRef.current.scrollIntoView({ behavior: 'auto', block: 'start' })
    }
  }, [getYear(currentYear)])

  function taskCountForMonth(month) {
    const prefix = format(month, 'yyyy-MM')
    return tasks.filter(t => t.scheduled_date && t.scheduled_date.startsWith(prefix) && t.status !== 'done').length
  }

  function taskCountForDay(dateStr) {
    return tasks.filter(t => t.scheduled_date === dateStr && t.status !== 'done').length
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        <button onClick={() => setCurrentYear(y => subYears(y, 1))} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#6b7280', cursor: 'pointer', padding: '4px 10px' }}>‹</button>
        <span style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{format(currentYear, 'yyyy')}</span>
        <button onClick={() => setCurrentYear(y => addYears(y, 1))} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#6b7280', cursor: 'pointer', padding: '4px 10px' }}>›</button>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '14px' }}>
        {months.map(month => {
          const daysInMonth = getDaysInMonth(month)
          const firstDow = getDay(startOfMonth(month))
          const count = taskCountForMonth(month)
          const monthStr = format(month, 'yyyy-MM')
          const isCurrentMonth = getYear(currentYear) === todayYear && getMonth(month) === todayMonth
          return (
            <div
              key={monthStr}
              ref={isCurrentMonth ? currentMonthRef : null}
              onClick={() => onMonthClick && onMonthClick(month)}
              style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px', cursor: onMonthClick ? 'pointer' : 'default', background: 'white', transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>{format(month, 'MMMM')}</span>
                {count > 0 && <span style={{ fontSize: '10px', color: '#6366f1', fontWeight: 600, background: '#eef2ff', borderRadius: '8px', padding: '1px 6px' }}>{count}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px' }}>
                {['S','M','T','W','T','F','S'].map((h, i) => (
                  <div key={i} style={{ fontSize: '7px', color: '#d1d5db', textAlign: 'center', marginBottom: '2px' }}>{h}</div>
                ))}
                {Array.from({ length: firstDow }).map((_, i) => <div key={'pad'+i} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1
                  const dateStr = `${monthStr}-${String(dayNum).padStart(2, '0')}`
                  const cnt = taskCountForDay(dateStr)
                  const todayMatch = isToday(new Date(dateStr + 'T12:00:00'))
                  const bg = todayMatch ? '#6366f1'
                    : cnt >= 5 ? '#ef4444'
                    : cnt >= 3 ? '#f59e0b'
                    : cnt >= 1 ? '#22c55e'
                    : 'transparent'
                  const color = todayMatch ? 'white'
                    : cnt >= 1 ? 'white'
                    : '#d1d5db'
                  return (
                    <div
                      key={dayNum}
                      onClick={(e) => { e.stopPropagation(); onDayClick && onDayClick(new Date(dateStr + 'T12:00:00')) }}
                      title={cnt > 0 ? `${cnt} task${cnt !== 1 ? 's' : ''}` : undefined}
                      style={{
                        width: '16px', height: '16px', borderRadius: '50%', fontSize: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1px',
                        background: bg, color, fontWeight: todayMatch || cnt > 0 ? 700 : 400,
                        cursor: onDayClick ? 'pointer' : 'default',
                      }}
                    >{dayNum}</div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
