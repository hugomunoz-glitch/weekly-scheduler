import { useState } from 'react'

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

const GOAL_CATEGORIES = [
  'Career/Professional', 'Financial', 'Intellectual',
  'Physical (Health/Wellness)', 'Relationships',
  'Social (Community/Volunteering)', 'Spiritual (Prayer/Church)'
]

const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#9ca3af' }
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }
const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' }

function formatTime(t) {
  if (!t) return null
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return display + ':' + m + ' ' + ampm
}

function PriorityBadge({ priority }) {
  if (!priority || !PRIORITY_COLORS[priority]) return null
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0" style={{ color: PRIORITY_COLORS[priority], background: PRIORITY_COLORS[priority] + '1a' }}>
      {PRIORITY_LABELS[priority]}
    </span>
  )
}

export default function GoalsBar({ goals, goalTasks, allTasks, onAddGoal, onEditGoal, onDeleteGoal, onMarkDone, onDelete, onCreateTask, onEditTask }) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [customCategory, setCustomCategory] = useState(false)
  const [newCategoryCustom, setNewCategoryCustom] = useState('')
  const [newPriority, setNewPriority] = useState('')
  const [showSmart, setShowSmart] = useState(false)
  const [smartSpecific, setSmartSpecific] = useState('')
  const [smartMeasurable, setSmartMeasurable] = useState('')
  const [smartAchievable, setSmartAchievable] = useState('')
  const [smartRelevant, setSmartRelevant] = useState('')
  const [smartTimebound, setSmartTimebound] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [viewingGoalId, setViewingGoalId] = useState(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [goalSearch, setGoalSearch] = useState('')
  const [showGoalSearch, setShowGoalSearch] = useState(false)
  const [sortMode, setSortMode] = useState('deadline')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const allCategories = [...new Set([...GOAL_CATEGORIES, ...goals.map(g => g.category).filter(Boolean)])].sort()

  function nearestDueDate(goalId) {
    const tasks = goalTasks.filter(t => t.goal_id === goalId && t.status !== 'done' && t.due_date)
    if (tasks.length === 0) return null
    return tasks.reduce((min, t) => !min || t.due_date < min ? t.due_date : min, null)
  }

  let visibleGoals = goalSearch.trim() ? goals.filter(g => g.title.toLowerCase().includes(goalSearch.trim().toLowerCase())) : goals
  if (categoryFilter !== 'all') visibleGoals = visibleGoals.filter(g => g.category === categoryFilter)

  visibleGoals = [...visibleGoals].sort((a, b) => {
    if (sortMode === 'alpha') return a.title.localeCompare(b.title)
    if (sortMode === 'priority') {
      const aRank = a.priority in PRIORITY_RANK ? PRIORITY_RANK[a.priority] : 3
      const bRank = b.priority in PRIORITY_RANK ? PRIORITY_RANK[b.priority] : 3
      if (aRank !== bRank) return aRank - bRank
      return a.title.localeCompare(b.title)
    }
    const aDate = nearestDueDate(a.id), bDate = nearestDueDate(b.id)
    if (!aDate && !bDate) return a.title.localeCompare(b.title)
    if (!aDate) return 1
    if (!bDate) return -1
    return aDate < bDate ? -1 : aDate > bDate ? 1 : 0
  })

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

  const [addGoalError, setAddGoalError] = useState('')

  async function handleAdd(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    const color = COLORS[goals.length % COLORS.length]
    try {
      await onAddGoal(newTitle.trim(), color, {
        category: (customCategory ? newCategoryCustom.trim() : newCategory) || null,
        priority: newPriority || null,
        smartSpecific: smartSpecific.trim() || null,
        smartMeasurable: smartMeasurable.trim() || null,
        smartAchievable: smartAchievable.trim() || null,
        smartRelevant: smartRelevant.trim() || null,
        smartTimebound: smartTimebound.trim() || null
      })
      setNewTitle(''); setNewCategory(''); setNewPriority(''); setCustomCategory(false); setNewCategoryCustom('')
      setSmartSpecific(''); setSmartMeasurable(''); setSmartAchievable(''); setSmartRelevant(''); setSmartTimebound('')
      setShowSmart(false)
      setAdding(false)
      setAddGoalError('')
    } catch {
      setAddGoalError('Could not save. Check the category isn\'t blocked by an old rule, then try again.')
    }
  }

  const [editingCategory, setEditingCategory] = useState('')
  const [editingCustomCategory, setEditingCustomCategory] = useState(false)
  const [editingCategoryCustom, setEditingCategoryCustom] = useState('')
  const [editingPriority, setEditingPriority] = useState('')
  const [editError, setEditError] = useState('')

  function startEdit(goal) {
    setEditingId(goal.id)
    setEditingTitle(goal.title)
    if (goal.category && !GOAL_CATEGORIES.includes(goal.category)) {
      setEditingCustomCategory(true)
      setEditingCategoryCustom(goal.category)
      setEditingCategory('')
    } else {
      setEditingCustomCategory(false)
      setEditingCategoryCustom('')
      setEditingCategory(goal.category || '')
    }
    setEditingPriority(goal.priority || '')
    setEditError('')
  }

  async function handleEditSubmit(e, goalId) {
    e.preventDefault()
    if (!editingTitle.trim()) return
    try {
      const category = editingCustomCategory ? editingCategoryCustom.trim() : editingCategory
      await onEditGoal(goalId, editingTitle.trim(), { category: category || null, priority: editingPriority || null })
      setEditingId(null)
    } catch {
      setEditError('Could not save. Try again.')
    }
  }

  return (
    <div className="bg-white px-6 py-2 shrink-0">
      <div className="flex items-center gap-3 overflow-x-auto">
      <div className="sticky left-0 z-10 bg-white self-stretch flex items-center gap-3 pr-3 shrink-0">
        <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide shrink-0">Goals</span>
        {adding ? (
          <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50 shrink-0 w-72">
            <form onSubmit={handleAdd} className="space-y-2">
              <input
                autoFocus
                type="text"
                placeholder="Goal name"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full border border-indigo-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
              <div className="flex gap-2">
                {customCategory ? (
                  <input
                    autoFocus
                    type="text"
                    placeholder="Custom category name"
                    value={newCategoryCustom}
                    onChange={e => setNewCategoryCustom(e.target.value)}
                    className="flex-1 min-w-0 border border-indigo-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  />
                ) : (
                  <select
                    value={newCategory}
                    onChange={e => { if (e.target.value === '__custom__') { setCustomCategory(true); return } setNewCategory(e.target.value) }}
                    className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    <option value="">No category</option>
                    {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__custom__">+ New category…</option>
                  </select>
                )}
                <select value={newPriority} onChange={e => setNewPriority(e.target.value)} className="w-24 shrink-0 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300">
                  <option value="">Priority</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              {!showSmart ? (
                <button type="button" onClick={() => setShowSmart(true)} className="text-xs text-indigo-500 hover:text-indigo-700">+ Make it a SMART goal (optional)</button>
              ) : (
                <div className="space-y-1.5 pt-1 border-t border-gray-200">
                  <input type="text" placeholder="Specific: what & why?" value={smartSpecific} onChange={e => setSmartSpecific(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                  <input type="text" placeholder="Measurable: how will you know?" value={smartMeasurable} onChange={e => setSmartMeasurable(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                  <input type="text" placeholder="Achievable: realistic?" value={smartAchievable} onChange={e => setSmartAchievable(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                  <input type="text" placeholder="Relevant: why does it matter?" value={smartRelevant} onChange={e => setSmartRelevant(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                  <input type="text" placeholder="Time-bound: target deadline?" value={smartTimebound} onChange={e => setSmartTimebound(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                </div>
              )}
              <div className="flex gap-2">
                <button type="submit" className="text-sm text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700">Add</button>
                <button type="button" onClick={() => { setAdding(false); setShowSmart(false) }} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
              {addGoalError && <p className="text-xs text-red-500">{addGoalError}</p>}
            </form>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3 py-1.5 shrink-0 font-medium transition-colors"
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
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 w-40 shrink-0 focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400"
          />
        ) : (
          <button
            onClick={() => setShowGoalSearch(true)}
            className="text-gray-400 hover:text-indigo-500 shrink-0 transition-colors"
            title="Search goals"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
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
          <div key={goal.id} className="flex items-start gap-2 border border-gray-200 rounded-lg px-3 py-1.5 shrink-0 min-w-[160px] group cursor-pointer relative" onClick={() => setViewingGoalId(goal.id)}>
            <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: goal.color }} />
            <div className="flex-1 min-w-0">
              {editingId === goal.id ? (
                <form onSubmit={(e) => handleEditSubmit(e, goal.id)} className="space-y-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={e => setEditingTitle(e.target.value)}
                    className="text-sm font-medium text-gray-700 border border-indigo-300 rounded px-1.5 py-0.5 w-full focus:outline-none"
                  />
                  {editingCustomCategory ? (
                    <input
                      autoFocus
                      type="text"
                      placeholder="Custom category name"
                      value={editingCategoryCustom}
                      onChange={e => setEditingCategoryCustom(e.target.value)}
                      className="text-xs border border-indigo-300 rounded px-1 py-0.5 w-full focus:outline-none"
                    />
                  ) : (
                    <select
                      value={editingCategory}
                      onChange={e => { if (e.target.value === '__custom__') { setEditingCustomCategory(true); return } setEditingCategory(e.target.value) }}
                      className="text-xs border border-gray-200 rounded px-1 py-0.5 w-full focus:outline-none"
                    >
                      <option value="">No category</option>
                      {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="__custom__">+ New category…</option>
                    </select>
                  )}
                  <select
                    value={editingPriority}
                    onChange={e => setEditingPriority(e.target.value)}
                    className="text-xs border border-gray-200 rounded px-1 py-0.5 w-full focus:outline-none"
                  >
                    <option value="">No priority</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <div className="flex gap-1.5">
                    <button type="submit" className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-0.5 rounded">Save</button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                  {editError && <p className="text-xs text-red-500">{editError}</p>}
                </form>
              ) : (
                <div className="flex items-center justify-between gap-1">
                  <p
                    className="text-sm font-medium text-gray-700 truncate cursor-pointer hover:text-indigo-600"
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
              {(goal.priority || goal.category) && (
                <div className="flex items-center gap-1 mt-0.5">
                  <PriorityBadge priority={goal.priority} />
                  {goal.category && <span className="text-[10px] text-gray-400 truncate">{goal.category}</span>}
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
              <div className="relative w-[960px] max-w-[92vw]">
                <button
                  onClick={() => setViewingGoalId(null)}
                  className="absolute -top-3 -right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 text-white text-sm hover:bg-gray-900 shadow-md"
                  title="Close"
                >
                  &#10005;
                </button>
                <div onClick={(e) => e.stopPropagation()} className="bg-white border border-gray-200 rounded-lg shadow-xl p-6 max-h-[85vh] overflow-y-auto">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-2xl font-bold text-gray-800">{goal.title}</p>
                    <PriorityBadge priority={goal.priority} />
                  </div>
                  {goal.category && <p className="text-sm text-gray-400 mb-3">{goal.category}</p>}
                  {(goal.smart_specific || goal.smart_measurable || goal.smart_achievable || goal.smart_relevant || goal.smart_timebound) && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-1">
                      {goal.smart_specific && <p className="text-sm text-gray-600"><span className="font-semibold text-gray-700">Specific:</span> {goal.smart_specific}</p>}
                      {goal.smart_measurable && <p className="text-sm text-gray-600"><span className="font-semibold text-gray-700">Measurable:</span> {goal.smart_measurable}</p>}
                      {goal.smart_achievable && <p className="text-sm text-gray-600"><span className="font-semibold text-gray-700">Achievable:</span> {goal.smart_achievable}</p>}
                      {goal.smart_relevant && <p className="text-sm text-gray-600"><span className="font-semibold text-gray-700">Relevant:</span> {goal.smart_relevant}</p>}
                      {goal.smart_timebound && <p className="text-sm text-gray-600"><span className="font-semibold text-gray-700">Time-bound:</span> {goal.smart_timebound}</p>}
                    </div>
                  )}
                  {linked.length === 0 ? (
                    <p className="text-sm text-gray-300">No tasks yet.</p>
                  ) : (
                    <ul className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                      {sortedLinked.map(t => (
                        <li key={t.id} className="text-sm text-gray-600 flex items-center gap-2 group hover:bg-gray-50 rounded px-2 py-1.5 -mx-2">
                          <span className="cursor-pointer" onClick={() => onMarkDone(t.id)}>
                            <span className={t.status === 'done' ? 'text-green-500' : 'text-gray-300'}>{t.status === 'done' ? '✓' : '○'}</span>
                          </span>
                          <span className={'flex-1 truncate cursor-pointer ' + (t.status === 'done' ? 'line-through text-gray-400' : '')} onClick={() => onMarkDone(t.id)}>{t.title}</span>
                          <PriorityBadge priority={t.priority} />
                          {t.start_time && (
                            <span className="text-xs text-indigo-400 shrink-0 whitespace-nowrap">{formatTime(t.start_time)}</span>
                          )}
                          <button onClick={() => handleEditTask(t.id)} className="text-gray-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-colors shrink-0" title="Edit task">
                            <span className="text-sm">&#9998;</span>
                          </button>
                          <button onClick={() => onDelete(t.id)} className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-colors shrink-0" title="Delete task">
                            <span className="text-sm">&#x2715;</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <form onSubmit={(e) => handleAddTaskToGoal(e, goal.id)} className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <input
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      placeholder="Add a task to this goal"
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400"
                    />
                    <button type="submit" className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shrink-0">Add</button>
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
      <div className="flex items-center gap-2 mt-2">
        <select value={sortMode} onChange={e => setSortMode(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" title="Sort goals">
          <option value="deadline">Sort: Deadline</option>
          <option value="priority">Sort: Priority</option>
          <option value="alpha">Sort: A-Z</option>
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" title="Filter by category">
          <option value="all">All categories</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  )
}
