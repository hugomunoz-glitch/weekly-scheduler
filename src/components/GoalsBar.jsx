import { useState, useRef, useEffect } from 'react'
import { Droppable, Draggable } from '@hello-pangea/dnd'

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

export default function GoalsBar({ goals, goalTasks, allTasks, collabMap, collaborations, defaultCollaborationId, onAddGoal, onEditGoal, onDeleteGoal, onMarkDone, onDelete, onCreateTask, onEditTask }) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [customCategory, setCustomCategory] = useState(false)
  const [newCategoryCustom, setNewCategoryCustom] = useState('')
  const [newPriority, setNewPriority] = useState('')
  const [newGoalCollaborationId, setNewGoalCollaborationId] = useState(defaultCollaborationId || '')
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
  const [sortDir, setSortDir] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const allCategories = [...new Set([...GOAL_CATEGORIES, ...goals.map(g => g.category).filter(Boolean)])].sort()
  const [popupPos, setPopupPos] = useState(null)
  const dragRef = useRef(null)

  function openPopup(goalId, e) {
    setViewingGoalId(goalId)
    const rect = e.currentTarget.getBoundingClientRect()
    const left = Math.min(Math.max(rect.left, 12), window.innerWidth - 600)
    const top = Math.min(rect.bottom + 8, window.innerHeight - 200)
    setPopupPos({ top, left })
  }

  function startPopupDrag(e) {
    e.preventDefault()
    const startX = e.clientX, startY = e.clientY
    const origin = popupPos
    dragRef.current = { startX, startY, origin }
    function onMove(ev) {
      const d = dragRef.current
      if (!d) return
      setPopupPos({ top: d.origin.top + (ev.clientY - d.startY), left: d.origin.left + (ev.clientX - d.startX) })
    }
    function onUp() {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function nearestDueDate(goalId) {
    const tasks = goalTasks.filter(t => t.goal_id === goalId && t.status !== 'done' && t.due_date)
    if (tasks.length === 0) return null
    return tasks.reduce((min, t) => !min || t.due_date < min ? t.due_date : min, null)
  }

  function pctCompleted(goalId) {
    const linked = goalTasks.filter(t => t.goal_id === goalId)
    if (linked.length === 0) return -1
    const done = linked.filter(t => t.status === 'done').length
    return done / linked.length
  }

  function completedCount(goalId) {
    return goalTasks.filter(t => t.goal_id === goalId && t.status === 'done').length
  }

  let visibleGoals = goalSearch.trim() ? goals.filter(g => g.title.toLowerCase().includes(goalSearch.trim().toLowerCase())) : goals
  if (categoryFilter !== 'all') visibleGoals = visibleGoals.filter(g => g.category === categoryFilter)

  visibleGoals = [...visibleGoals].sort((a, b) => {
    let result
    if (sortMode === 'created') result = new Date(b.created_at || 0) - new Date(a.created_at || 0)
    else if (sortMode === 'alpha') result = a.title.localeCompare(b.title)
    else if (sortMode === 'percentage') result = pctCompleted(b.id) - pctCompleted(a.id)
    else if (sortMode === 'taskCount') result = completedCount(b.id) - completedCount(a.id)
    else if (sortMode === 'priority') {
      const aRank = a.priority in PRIORITY_RANK ? PRIORITY_RANK[a.priority] : 3
      const bRank = b.priority in PRIORITY_RANK ? PRIORITY_RANK[b.priority] : 3
      result = aRank !== bRank ? aRank - bRank : a.title.localeCompare(b.title)
    } else {
      const aDate = nearestDueDate(a.id), bDate = nearestDueDate(b.id)
      if (!aDate && !bDate) result = a.title.localeCompare(b.title)
      else if (!aDate) result = 1
      else if (!bDate) result = -1
      else result = aDate < bDate ? -1 : aDate > bDate ? 1 : 0
    }
    return result * sortDir
  })

  function handleEditTask(taskId) {
    const full = (allTasks || []).find(t => t.id === taskId)
    if (full) { setViewingGoalId(null); onEditTask(full) }
  }

  function handleAddTaskToGoal(e, goalId) {
    e.preventDefault()
    if (!newTaskTitle.trim()) return
    const goal = goals.find(g => g.id === goalId)
    onCreateTask(newTaskTitle.trim(), '', goalId, null, null, null, null, null, goal?.collaboration_id || null)
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
      }, newGoalCollaborationId || null)
      setNewTitle(''); setNewCategory(''); setNewPriority(''); setCustomCategory(false); setNewCategoryCustom('')
      setSmartSpecific(''); setSmartMeasurable(''); setSmartAchievable(''); setSmartRelevant(''); setSmartTimebound('')
      setNewGoalCollaborationId(defaultCollaborationId || '')
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
  const [editingCollaborationId, setEditingCollaborationId] = useState('')
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
    setEditingCollaborationId(goal.collaboration_id || '')
    setEditError('')
  }

  async function handleEditSubmit(e, goalId) {
    e.preventDefault()
    if (!editingTitle.trim()) return
    try {
      const category = editingCustomCategory ? editingCategoryCustom.trim() : editingCategory
      await onEditGoal(goalId, editingTitle.trim(), { category: category || null, priority: editingPriority || null }, editingCollaborationId || null)
      setEditingId(null)
    } catch {
      setEditError('Could not save. Try again.')
    }
  }

  return (
    <div className="bg-white px-6 py-2 shrink-0">
      <div className="flex items-center gap-3 overflow-x-auto">
      <div className="sticky left-0 z-10 bg-white self-stretch flex items-center gap-3 pr-3 shrink-0">
        <span className="text-sm font-semibold text-gray-900 tracking-wide shrink-0">Goals</span>
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
              {collaborations && collaborations.length > 0 && (
                <select value={newGoalCollaborationId} onChange={e => setNewGoalCollaborationId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300">
                  <option value="">Save to: Personal</option>
                  {collaborations.map(c => <option key={c.id} value={c.id}>Save to: {c.name}</option>)}
                </select>
              )}
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
          <div key={goal.id} className="flex items-start gap-2 border border-gray-200 rounded-lg px-3 py-1.5 shrink-0 min-w-[160px] group cursor-pointer relative" onClick={(e) => openPopup(goal.id, e)}>
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
                  {collaborations && collaborations.length > 0 && (
                    <select value={editingCollaborationId} onChange={e => setEditingCollaborationId(e.target.value)} className="text-xs border border-gray-200 rounded px-1 py-0.5 w-full focus:outline-none">
                      <option value="">Save to: Personal</option>
                      {collaborations.map(c => <option key={c.id} value={c.id}>Save to: {c.name}</option>)}
                    </select>
                  )}
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
                  {goal.collaboration_id && collabMap && collabMap[goal.collaboration_id] && (
                    <span
                      className="text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0"
                      style={{ color: collabMap[goal.collaboration_id].color, background: collabMap[goal.collaboration_id].color + '1a' }}
                      title={'Shared with: ' + collabMap[goal.collaboration_id].name}
                    >
                      {collabMap[goal.collaboration_id].name}
                    </span>
                  )}
                </div>
              )}
              {editingId !== goal.id && (
                <span
                  onClick={(e) => { e.stopPropagation(); onDeleteGoal(goal.id) }}
                  className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-[5px] font-semibold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
                  title="Delete goal"
                >
                  &#10005;
                </span>
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
              {viewingGoalId === goal.id && popupPos && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-2xl w-[580px] max-w-[92vw]"
                  style={{ top: popupPos.top, left: popupPos.left }}
                >
                  <div
                    onMouseDown={startPopupDrag}
                    className="flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-100 rounded-t-lg bg-gray-50 cursor-move select-none"
                    title="Drag to move"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-400 text-sm">&#10021;</span>
                      <p className="text-3xl font-bold text-gray-800 truncate">{goal.title}</p>
                      <PriorityBadge priority={goal.priority} />
                    </div>
                    <button
                      onClick={() => setViewingGoalId(null)}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-700 text-white text-sm hover:bg-gray-900 shrink-0"
                      title="Close"
                    >
                      &#10005;
                    </button>
                  </div>
                  <div className="p-4 max-h-[70vh] overflow-y-auto">
                    {goal.category && <p className="text-base text-gray-400 mb-3">{goal.category}</p>}
                    {(goal.smart_specific || goal.smart_measurable || goal.smart_achievable || goal.smart_relevant || goal.smart_timebound) && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-1">
                        {goal.smart_specific && <p className="text-base text-gray-600"><span className="font-semibold text-gray-700">Specific:</span> {goal.smart_specific}</p>}
                        {goal.smart_measurable && <p className="text-base text-gray-600"><span className="font-semibold text-gray-700">Measurable:</span> {goal.smart_measurable}</p>}
                        {goal.smart_achievable && <p className="text-base text-gray-600"><span className="font-semibold text-gray-700">Achievable:</span> {goal.smart_achievable}</p>}
                        {goal.smart_relevant && <p className="text-base text-gray-600"><span className="font-semibold text-gray-700">Relevant:</span> {goal.smart_relevant}</p>}
                        {goal.smart_timebound && <p className="text-base text-gray-600"><span className="font-semibold text-gray-700">Time-bound:</span> {goal.smart_timebound}</p>}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mb-2">Drag a task onto any day on the calendar to schedule it.</p>
                    {linked.length === 0 ? (
                      <p className="text-base text-gray-300">No tasks yet.</p>
                    ) : (
                      <Droppable droppableId={'goalpopup-' + goal.id}>
                        {(provided) => (
                          <ul ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                            {sortedLinked.map((t, idx) => {
                              return (
                                <Draggable key={t.id} draggableId={t.id} index={idx}>
                                  {(dragProvided, dragSnapshot) => (
                                    <li
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      {...dragProvided.dragHandleProps}
                                      className={'text-xl text-gray-600 flex items-center gap-2 group rounded px-2 py-1.5 -mx-2 ' + (dragSnapshot.isDragging ? 'bg-indigo-50 shadow-md' : 'hover:bg-gray-50')}
                                    >
                                      <span className="cursor-pointer shrink-0" onClick={() => onMarkDone(t.id)}>
                                        <span className={t.status === 'done' ? 'text-green-500' : 'text-gray-300'}>{t.status === 'done' ? '✓' : '○'}</span>
                                      </span>
                                      <span className={'flex-1 truncate cursor-pointer ' + (t.status === 'done' ? 'line-through text-gray-400' : '')} onClick={() => handleEditTask(t.id)}>{t.title}</span>
                                      <PriorityBadge priority={t.priority} />
                                      {t.collaboration_id && collabMap && collabMap[t.collaboration_id] && (
                                        <span
                                          className="text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0"
                                          style={{ color: collabMap[t.collaboration_id].color, background: collabMap[t.collaboration_id].color + '1a' }}
                                          title={'Shared with: ' + collabMap[t.collaboration_id].name}
                                        >
                                          {collabMap[t.collaboration_id].name}
                                        </span>
                                      )}
                                      {t.start_time && (
                                        <span className="text-sm text-indigo-400 shrink-0 whitespace-nowrap">{formatTime(t.start_time)}</span>
                                      )}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(t.id) }}
                                        className="w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white text-[11px] font-semibold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                        title="Delete task"
                                      >
                                        &#10005;
                                      </button>
                                    </li>
                                  )}
                                </Draggable>
                              )
                            })}
                            {provided.placeholder}
                          </ul>
                        )}
                      </Droppable>
                    )}
                    <form onSubmit={(e) => handleAddTaskToGoal(e, goal.id)} className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <input
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        placeholder="Add a task to this goal"
                        className="flex-1 text-base border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400"
                      />
                      <button type="submit" className="text-base text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shrink-0">Add</button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
      </div>
      <div className="flex items-end gap-2 mt-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-400 font-medium leading-none">Sort by</span>
          <div className="flex items-center gap-1">
            <select value={sortMode} onChange={e => setSortMode(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300">
              <option value="deadline">Deadline</option>
              <option value="priority">Priority</option>
              <option value="alpha">A-Z</option>
              <option value="created">Date Created</option>
              <option value="percentage">% Completed</option>
              <option value="taskCount"># of Tasks Completed</option>
            </select>
            <button
              onClick={() => setSortDir(d => d * -1)}
              className="text-gray-400 hover:text-indigo-500 border border-gray-200 rounded-lg p-1.5 transition-colors"
              title={sortDir === 1 ? 'Reverse order' : 'Reversed — click to restore'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sortDir === -1 ? 'scaleY(-1)' : 'none' }}>
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300" title="Filter by category">
          <option value="all">All Categories</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  )
}
