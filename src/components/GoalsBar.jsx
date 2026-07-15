import { useState } from 'react'

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

export default function GoalsBar({ goals, goalTasks, onAddGoal, onEditGoal, onDeleteGoal }) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  function handleAdd(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    const color = COLORS[goals.length % COLORS.length]
    onAddGoal(newTitle.trim(), color)
    setNewTitle('')
    setAdding(false)
  }

  function startEdit(goal) {
    setEditingId(goal.id)
    setEditingTitle(goal.title)
  }

  function handleEditSubmit(e, goalId) {
    e.preventDefault()
    if (!editingTitle.trim()) return
    onEditGoal(goalId, editingTitle.trim())
    setEditingId(null)
  }

  return (
    <div className="bg-white border-b border-gray-100 px-6 py-2 flex items-center gap-3 overflow-x-auto shrink-0">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide shrink-0">Goals</span>
      {goals.map(goal => {
        const linked = goalTasks.filter(t => t.goal_id === goal.id)
        const done = linked.filter(t => t.status === 'done')
        const pct = linked.length > 0 ? Math.round((done.length / linked.length) * 100) : 0
        return (
          <div key={goal.id} className="flex items-start gap-2 border border-gray-200 rounded-lg px-3 py-1.5 shrink-0 min-w-[150px] group">
            <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: goal.color }} />
            <div className="flex-1 min-w-0">
              {editingId === goal.id ? (
                <form onSubmit={(e) => handleEditSubmit(e, goal.id)} className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={e => setEditingTitle(e.target.value)}
                    onBlur={() => setEditingId(null)}
                    className="text-xs font-medium text-gray-700 border border-indigo-300 rounded px-1 w-full focus:outline-none"
                  />
                </form>
              ) : (
                <div className="flex items-center justify-between gap-1">
                  <p
                    className="text-xs font-medium text-gray-700 truncate cursor-pointer hover:text-indigo-600"
                    onClick={() => startEdit(goal)}
                    title="Click to edit"
                  >
                    {goal.title}
                  </p>
                  {confirmDeleteId === goal.id ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { onDeleteGoal(goal.id); setConfirmDeleteId(null) }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(goal.id)}
                      className="text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      title="Delete goal"
                    >
                      <span className="text-xs">&#x2715;</span>
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-1">
                <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: pct + '%', background: goal.color }} />
                </div>
                <span className="text-xs text-gray-400 shrink-0">{pct}%</span>
              </div>
              <p className="text-xs text-gray-300 mt-0.5">{done.length}/{linked.length} tasks</p>
            </div>
          </div>
        )
      })}
      {adding ? (
        <form onSubmit={handleAdd} className="flex items-center gap-2 shrink-0">
          <input
            autoFocus
            type="text"
            placeholder="Goal name"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onBlur={() => { if (!newTitle.trim()) setAdding(false) }}
            className="border border-indigo-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300 w-36"
          />
          <button type="submit" className="text-xs text-white bg-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-700">Add</button>
          <button type="button" onClick={() => setAdding(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-xs text-indigo-500 hover:text-indigo-700 border border-dashed border-indigo-200 hover:border-indigo-400 rounded-lg px-3 py-1.5 shrink-0 transition-colors"
        >
          + Add goal
        </button>
      )}
    </div>
  )
}
