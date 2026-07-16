import { useState } from 'react'
import { parseISO, isBefore, startOfDay, format } from 'date-fns'

function formatTime(t) {
  if (!t) return null
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return display + ':' + m + ' ' + ampm
}

function formatDueDate(d) {
  if (!d) return null
  return format(parseISO(d), 'MMM d')
}

export default function TaskCard({ task, isDone, isDragging, goalColor, onMarkDone, onRescheduleToTomorrow, onMoveToInbox, onDelete, onEdit }) {
  const [showActions, setShowActions] = useState(false)

  return (
    <div
      className={'rounded-lg border px-2.5 py-2 text-sm transition-all ' + (isDragging ? 'border-indigo-300 bg-white shadow-lg rotate-1' : isDone ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-200 bg-white hover:border-gray-300')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={() => onMarkDone(task.id)}
          className={'mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ' + (isDone ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50')}
        >
          {isDone && <span className="text-xs leading-none">&#10003;</span>}
        </button>
        <div className="flex-1 min-w-0">
          <span className={'leading-snug break-words ' + (isDone ? 'line-through text-gray-400' : 'text-gray-800')}>
            {task.title}
          </span>
          {task.start_time && (
            <p className={'text-xs mt-0.5 ' + (isDone ? 'text-gray-300' : 'text-indigo-400 font-medium')}>
              {formatTime(task.start_time)}
            </p>
          )}
          {task.due_date && (() => {
            const overdue = !isDone && isBefore(parseISO(task.due_date), startOfDay(new Date()))
            return (
              <p className={'text-xs mt-0.5 font-medium ' + (isDone ? 'text-gray-300' : overdue ? 'text-red-500' : 'text-gray-400')}>
                {overdue ? 'Overdue: ' : 'Due '}{formatDueDate(task.due_date)}
              </p>
            )
          })()}
        </div>
        {goalColor && (
          <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: goalColor }} />
        )}
      </div>
      {isDone && showActions && (
        <div className="flex justify-end gap-2 mt-1">
          <button onClick={() => onDelete(task.id)} className="text-xs text-gray-300 hover:text-red-400 transition-colors px-1">Delete</button>
        </div>
      )}
      {!isDone && !isDragging && showActions && (
        <div className="flex flex-wrap gap-1 mt-2 pt-1.5 border-t border-gray-100">
          <button onClick={() => onEdit(task)} className="text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 px-1 py-0.5 rounded transition-colors">Edit</button>
          <button onClick={() => onRescheduleToTomorrow(task.id, task.scheduled_date)} className="text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 px-1 py-0.5 rounded transition-colors">Tomorrow</button>
          <button onClick={() => onMoveToInbox(task.id)} className="text-xs text-gray-500 hover:text-orange-600 hover:bg-orange-50 px-1 py-0.5 rounded transition-colors">Inbox</button>
          <button onClick={() => onDelete(task.id)} className="text-xs text-gray-500 hover:text-red-400 hover:bg-red-50 px-1 py-0.5 rounded transition-colors">Delete</button>
        </div>
      )}
    </div>
  )
}
