import { useState } from 'react'
import { format, addDays, subDays, isToday } from 'date-fns'
import TaskCard from './TaskCard'

const BUCKETS = [
  { id: 'morning', label: 'Morning', icon: '🌅' },
  { id: 'midday', label: 'Afternoon', icon: '☀️' },
  { id: 'afternoon', label: 'Evening', icon: '🌙' },
]

export default function DayView({ tasks, goalMap, collabMap, profileMap, onMarkDone, onRescheduleToTomorrow, onMoveToInbox, onDelete, onEdit, onAddTaskForBucket }) {
  const [currentDay, setCurrentDay] = useState(new Date())
  const dateStr = format(currentDay, 'yyyy-MM-dd')
  const dayTasks = tasks.filter(t => t.scheduled_date === dateStr || t.due_date_card_date === dateStr)
  const done = dayTasks.filter(t => t.status === 'done')
  const pct = dayTasks.length > 0 ? Math.round((done.length / dayTasks.length) * 100) : 0
  const today = isToday(currentDay)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
        <button onClick={() => setCurrentDay(d => subDays(d, 1))} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#6b7280', cursor: 'pointer', padding: '4px 10px' }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{format(currentDay, 'EEEE, MMMM d')}</div>
          {today
            ? <div style={{ fontSize: '10px', color: '#6366f1', fontWeight: 600, letterSpacing: '0.05em' }}>TODAY</div>
            : <button onClick={() => setCurrentDay(new Date())} style={{ fontSize: '10px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>Go to today</button>
          }
        </div>
        <button onClick={() => setCurrentDay(d => addDays(d, 1))} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#6b7280', cursor: 'pointer', padding: '4px 10px' }}>›</button>
      </div>

      <div style={{ padding: '8px 20px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, height: '5px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: pct + '%', background: '#6366f1', borderRadius: '3px', transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>{done.length}/{dayTasks.length} done</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {dayTasks.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: '60px', color: '#9ca3af', fontSize: '14px' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>📅</div>
            Nothing scheduled for this day.
          </div>
        )}
        {BUCKETS.map(bucket => {
          const bucketTasks = dayTasks
            .filter(t => (t.bucket || 'morning') === bucket.id)
            .sort((a, b) => {
              if (a.start_time && b.start_time) return a.start_time < b.start_time ? -1 : 1
              return (a.position || 0) - (b.position || 0)
            })
          return (
            <div key={bucket.id} style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{bucket.icon} {bucket.label}</span>
                <button
                  onClick={() => onAddTaskForBucket && onAddTaskForBucket(currentDay, bucket.id)}
                  style={{ fontSize: '11px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                >+ Add</button>
              </div>
              {bucketTasks.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#e5e7eb', padding: '6px 0' }}>Nothing yet</div>
              ) : (
                bucketTasks.map((task, idx) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={idx}
                    goalMap={goalMap}
                    collabMap={collabMap}
                    profileMap={profileMap}
                    onMarkDone={onMarkDone}
                    onRescheduleToTomorrow={onRescheduleToTomorrow}
                    onMoveToInbox={onMoveToInbox}
                    onDelete={onDelete}
                    onEdit={onEdit}
                  />
                ))
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
