import { useState } from 'react'

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

function formatTime(t) {
  if (!t) return null
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return display + ':' + m + ' ' + ampm
}

export default function GoalsBar({ goals, goalTasks, allTasks, onAddGoal, onEditGoal, onDeleteGoal, onMarkDone, onDelete, onCreateTask, onEditTask }) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [viewingGoalId, setViewingGoalId] = useState(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [goalSearch, setGoalSearch] = useState('')
  const [showGoalSearch, setShowGoalSearch] = useState(false)

  const visibleGoals = goalSearch.trim() ? goals.filter(g => g.title.toLowerCase().includes(goalSearch.trim().toLowerCase())) : goals

  function handleEditTask(taskId) {
    const full = (allTasks || []).find(t => t.id === taskId)
    if (full) onEditTask(full)
  }

  function handleAddTaskToGoal(e, goalId) {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    onCreateTask(newTaskTitle.trim(), '', goalId, null)
    setNewTaskTitle('')
  }

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
    <div className="bg-white border-b border-gray-100 px-6 py-2 shrink-0">
      <div className="flex items-center gap-3 overflow-x-auto">
      <div className="sticky left-0 z-10 bg-white self-stretch flex items-center gap-3 pr-3 shrink-0">
        <span className="text-xs font-medium text-gray-700 uppercase tracking-wide shrink-0">Goals</span>
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
            title="Add goal"
          >
            +
          </button>
        )}
        {showGoalSearch ? (
          <input
            autoFocus
            type="text"
            value={goalSearch}
            onChange={e => setGoalSearch(e.target.value)}
            onBlur={() => { if (!goalSearch.trim()) setShowGoalSearch(false) }}
            placeholder="Search goals…"
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-40 shrink-0 focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400"
          />
        ) : (
          <button
            onClick={() => setShowGoalSearch(true)}
            className="text-gray-400 hover:text-indigo-500 shrink-0 transition-colors"
            title="Search goals"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </button>
        )}
      </div>
      {visibleGoals.map(goal => {
        const linked = goalTasks.filter(t => t.goal_id === goal.id)
        const sortedLinked = [...linked].sort((a, b) => {
          const aDone = a.status === 'done', bDone = b.status === 'done'
          if (aDone !== bDone) return aDone ? 1 : -1
          if (!a.due_date && !b.due_date) return 0
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return new Date(a.due_date) - new Date(b.due_date)
        })
        const done = linked.filter(t => t.status === 'done')
        const pct = linked.length > 0 ? Math.round((done.length / linked.length) * 100) : 0
        return (
          <div key={goal.id} className="flex items-start gap-2 border border-gray-200 rounded-lg px-3 py-1.5 shrink-0 min-w-[150px] group cursor-pointer relative" onClick={() => setViewingGoalId(goal.id)}>
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
                    onClick={(e) => { e.stopPropagation(); startEdit(goal) }}
                    title="Click to edit"
                  >
                    {goal.title}
                  </p>
                  {confirmDeleteId === goal.id ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteGoal(goal.id); setConfirmDeleteId(null) }}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Yes
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(goal.id) }}
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
              <p className="text-xs text-gray-300 mt-0.5">{done.length}/{linked.length}</p>
              {viewingGoalId === goal.id && (
            <div onClick={(e) => { e.stopPropagation(); setViewingGoalId(null) }} className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
              <div className="relative w-80">
                <button
                  onClick={() => setViewingGoalId(null)}
                  className="absolute -top-3 -right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-gray-700 text-white text-xs hover:bg-gray-900 shadow-md"
                  title="Close"
                >
                  &#10005;
                </button>
                <div onClick={(e) => e.stopPropagation()} className="bg-white border border-gray-200 rounded-lg shadow-xl p-4 max-h-[70vh] overflow-y-auto">
                  <p className="text-base font-bold text-gray-800 mb-3">{goal.title}</p>
                  {linked.length === 0 ? (
                    <p className="text-xs text-gray-300">No tasks yet.</p>
                  ) : (
                    <ul className="space-y-1 max-h-48 overflow-y-auto">
                      {sortedLinked.map(t => (
                        <li key={t.id} className="text-xs text-gray-600 flex items-center gap-1.5 group hover:bg-gray-50 rounded px-1 py-0.5 -mx-1">
                          <span className="cursor-pointer" onClick={() => onMarkDone(t.id)}>
                            <span className={t.status === 'done' ? 'text-green-500' : 'text-gray-300'}>{t.status === 'done' ? '✓' : '○'}</span>
                          </span>
                          <span className={'flex-1 truncate cursor-pointer ' + (t.status === 'done' ? 'line-through text-gray-400' : '')} onClick={() => onMarkDone(t.id)}>{t.title}</span>
                          {t.start_time && (
                            <span className="text-[10px] text-indigo-400 shrink-0 whitespace-nowrap">{formatTime(t.start_time)}</span>
                          )}
                          <button onClick={() => handleEditTask(t.id)} className="text-gray-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-colors shrink-0" title="Edit task">
                            <span className="text-xs">&#9998;</span>
                          </button>
                          <button onClick={() => onDelete(t.id)} className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-colors shrink-0" title="Delete task">
                            <span className="text-xs">&#x2715;</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form onSubmit={(e) => handleAddTaskToGoal(e, goal.id)} className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
                    <input
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      placeholder="Add a task to this goal"
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400"
                    />
                    <button type="submit" className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 rounded-lg shrink-0">Add</button>
                  </form>
                </div>
              </div>
            </div>
          )}
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}
