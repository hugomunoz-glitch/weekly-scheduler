import { useState, useEffect, useRef } from 'react'

export default function AddTaskModal({ onAdd, onEdit, onClose, goals, editingTask }) {
  const [title, setTitle] = useState(editingTask ? editingTask.title : '')
  const [notes, setNotes] = useState(editingTask ? (editingTask.notes || '') : '')
  const [goalId, setGoalId] = useState(editingTask ? (editingTask.goal_id || '') : '')
  const [startTime, setStartTime] = useState(editingTask ? (editingTask.start_time || '') : '')
  const [dueDate, setDueDate] = useState(editingTask ? (editingTask.due_date || '') : '')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    if (editingTask) {
      onEdit(editingTask.id, title.trim(), notes.trim(), goalId || null, startTime || null, dueDate || null)
    } else {
      onAdd(title.trim(), notes.trim(), goalId || null, startTime || null, dueDate || null)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">{editingTask ? 'Edit task' : 'Add task'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={inputRef}
            type="text"
            placeholder="What do you need to do?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
          />
          <textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 resize-none"
          />
          <div className="flex gap-3">
            <select
              value={goalId}
              onChange={e => setGoalId(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-gray-700"
            >
              <option value="">No goal</option>
              {(goals || []).map(g => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-32 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-gray-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Due date (optional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-gray-700"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={!title.trim()} className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">{editingTask ? 'Save changes' : 'Add to inbox'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
