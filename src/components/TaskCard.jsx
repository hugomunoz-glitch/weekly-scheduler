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

const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#9ca3af' }
const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' }
const PRIORITY_BORDER = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }
const CATEGORY_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

export function categoryBadge(category) {
  if (!category) return null
  const clean = category.replace(/\s*\([^)]*\)\s*/g, '').trim()
  if (!clean) return null
  let hash = 0
  for (let i = 0; i < clean.length; i++) hash = (hash * 31 + clean.charCodeAt(i)) >>> 0
  return { name: clean, color: CATEGORY_COLORS[hash % CATEGORY_COLORS.length] }
}

export default function TaskCard({ task, isDone, isDragging, collabBadge, isDueCard, onMarkDone, onRescheduleToTomorrow, onMoveToInbox, onDelete, onEdit }) {
  const [showActions, setShowActions] = useState(false)
  const canHover = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: hover)').matches
  const catBadge = categoryBadge(task.category)

  return (
    <div
      className={'relative group rounded-lg border px-2.5 py-2 text-base transition-colors ' + (isDragging ? 'border-indigo-300 bg-white shadow-lg' : isDone ? 'border-gray-100 bg-gray-50 opacity-60' : isDueCard ? 'border-gray-300 border-dashed bg-white hover:border-gray-400' : 'border-gray-200 bg-white hover:border-gray-300')}
      style={task.priority && !isDone && PRIORITY_BORDER[task.priority] ? { borderLeft: '4px solid ' + PRIORITY_BORDER[task.priority] } : undefined}
      title={task.priority ? PRIORITY_LABELS[task.priority] + ' priority' : undefined}
      onMouseEnter={canHover ? () => setShowActions(true) : undefined}
      onMouseLeave={canHover ? () => setShowActions(false) : undefined}
    >
      {!isDragging && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
          className="hidden md:flex absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 text-white text-[9px] font-semibold items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
          title="Delete task"
        >
          &#10005;
        </button>
      )}
      <div className="flex items-start gap-2">
        <button
          onClick={() => onMarkDone(task.id)}
          className={'mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ' + (isDone ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50')}
        >
          {isDone && <span className="text-xs leading-none">&#10003;</span>}
        </button>
        <div className="flex-1 min-w-0">
          {isDueCard && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 mr-1.5 align-middle">Due</span>
          )}
          {collabBadge && (
            <span
              className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
              style={{ background: collabBadge.color }}
              title={'Shared with: ' + collabBadge.name}
            />
          )}
          <span className={'leading-snug break-words ' + (isDone ? 'line-through text-gray-400' : 'text-gray-800')}>
            {task.title}
          </span>
          {task.start_time && !isDueCard && (
            <p className={'text-xs mt-0.5 ' + (isDone ? 'text-gray-300' : 'text-indigo-400 font-medium')}>
              {formatTime(task.start_time)}
            </p>
          )}
          {catBadge && (
            <div className="mt-1">
              <span
                className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                style={{ color: catBadge.color, background: catBadge.color + '1a' }}
                title={'Category: ' + catBadge.name}
              >
                {catBadge.name}
              </span>
            </div>
          )}
        </div>
        {!isDragging && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowActions(v => !v) }}
            className="md:hidden shrink-0 text-gray-500 hover:text-gray-700 px-1 -mr-1 leading-none"
            title="More actions"
          >
            &#8942;
          </button>
        )}
      </div>
      {isDone && showActions && (
        <div className="flex justify-end gap-2 mt-1">
          <button onClick={() => onDelete(task.id)} className="md:hidden text-base text-red-500 hover:text-red-700 transition-colors px-1" title="Delete">&#128465;</button>
        </div>
      )}
      {!isDone && !isDragging && showActions && (
        <div className="flex flex-wrap items-center gap-2 mt-2 pt-1.5 border-t border-gray-100">
          <button onClick={() => onEdit(task)} className="text-[27px] text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors leading-none" title="Edit">&#9998;</button>
          {!isDueCard && (
          <button onClick={() => onRescheduleToTomorrow(task.id, task.scheduled_date)} className="hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors leading-none flex items-center" title="Move to tomorrow">
            <svg width="20" height="20" viewBox="0 0 34 32" fill="none">
              <line x1="10" y1="0" x2="10" y2="7" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
              <line x1="24" y1="0" x2="24" y2="7" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
              <rect x="0" y="4" width="34" height="26" rx="4" fill="white" stroke="#9ca3af" strokeWidth="1" />
              <rect x="0" y="4" width="34" height="8" fill="#9ca3af" />
              <circle cx="26" cy="24" r="9" fill="#4f46e5" />
              <text x="26" y="27.5" textAnchor="middle" fill="white" fontSize="9" fontWeight="600">+1</text>
            </svg>
          </button>
          )}
          <button onClick={() => onDelete(task.id)} className="md:hidden text-base text-red-500 hover:text-red-700 px-1 py-0.5 rounded transition-colors ml-auto" title="Delete">&#128465;</button>
        </div>
      )}
    </div>
  )
}
