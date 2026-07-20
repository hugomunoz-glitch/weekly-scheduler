import { useState } from 'react'
import { useAssistantHistory } from '../hooks/useAssistantHistory'
import { format, isToday } from 'date-fns'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import TaskCard from './TaskCard'

function formatTime(t) {
  if (!t) return null
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return display + ':' + m + ' ' + ampm
}

const BUCKETS = [
  { id: 'morning', label: 'Morning' },
  { id: 'midday', label: 'Afternoon' },
  { id: 'afternoon', label: 'Evening' },
]

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']
const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#9ca3af' }
const PRIORITY_LABELS = { high: 'High', medium: 'Med', low: 'Low' }
const GOAL_CATEGORIES = [
  'Career/Professional', 'Financial', 'Intellectual',
  'Physical (Health/Wellness)', 'Relationships',
  'Social (Community/Volunteering)', 'Spiritual (Prayer/Church)'
]

function MobileGoalsBar({ goals, goalTasks, allTasks, onAddGoal, onEditGoal, onDeleteGoal, onMarkDone, onDelete, onCreateTask, onEditTask }) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newPriority, setNewPriority] = useState('')
  const [showSmart, setShowSmart] = useState(false)
  const [smartSpecific, setSmartSpecific] = useState('')
  const [smartMeasurable, setSmartMeasurable] = useState('')
  const [smartAchievable, setSmartAchievable] = useState('')
  const [smartRelevant, setSmartRelevant] = useState('')
  const [smartTimebound, setSmartTimebound] = useState('')
  const [viewingGoalId, setViewingGoalId] = useState(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [goalSearch, setGoalSearch] = useState('')
  const [showGoalSearch, setShowGoalSearch] = useState(false)
  const [sortMode, setSortMode] = useState('deadline')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [editingGoalId, setEditingGoalId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingCategory, setEditingCategory] = useState('')
  const [editingPriority, setEditingPriority] = useState('')

  function startEditGoal(goal) {
    setEditingGoalId(goal.id)
    setEditingTitle(goal.title)
    setEditingCategory(goal.category || '')
    setEditingPriority(goal.priority || '')
  }

  function handleEditGoalSubmit(e) {
    e.preventDefault()
    if (!editingTitle.trim()) return
    onEditGoal(editingGoalId, editingTitle.trim(), { category: editingCategory || null, priority: editingPriority || null })
    setEditingGoalId(null)
  }

  function nearestDueDate(goalId) {
    const tasks = goalTasks.filter(t => t.goal_id === goalId && t.status !== 'done' && t.due_date)
    if (tasks.length === 0) return null
    return tasks.reduce((min, t) => !min || t.due_date < min ? t.due_date : min, null)
  }

  let visibleGoals = goalSearch.trim() ? goals.filter(g => g.title.toLowerCase().includes(goalSearch.trim().toLowerCase())) : goals
  if (categoryFilter !== 'all') visibleGoals = visibleGoals.filter(g => g.category === categoryFilter)
  visibleGoals = [...visibleGoals].sort((a, b) => {
    if (sortMode === 'alpha') return a.title.localeCompare(b.title)
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

  function handleAdd(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    onAddGoal(newTitle.trim(), COLORS[goals.length % COLORS.length], {
      category: newCategory || null,
      priority: newPriority || null,
      smartSpecific: smartSpecific.trim() || null,
      smartMeasurable: smartMeasurable.trim() || null,
      smartAchievable: smartAchievable.trim() || null,
      smartRelevant: smartRelevant.trim() || null,
      smartTimebound: smartTimebound.trim() || null
    })
    setNewTitle(''); setNewCategory(''); setNewPriority('')
    setSmartSpecific(''); setSmartMeasurable(''); setSmartAchievable(''); setSmartRelevant(''); setSmartTimebound('')
    setShowSmart(false)
    setAdding(false)
  }

  return (
    <div style={{ background: 'white', borderBottom: '1px solid #f3f4f6', padding: '8px 12px', flexShrink: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto' }}>
      <div style={{ position: 'sticky', left: 0, zIndex: 10, background: 'white', alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '6px', flexShrink: 0 }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Goals</span>
        {adding ? (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setAdding(false)}>
            <form onSubmit={handleAdd} onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', padding: '16px', width: '85vw', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                style={{ border: '1px solid #6366f1', borderRadius: '8px', padding: '8px', fontSize: '14px', outline: 'none' }}
                placeholder="Goal name" />
              <select value={newCategory} onChange={e => setNewCategory(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '12px', outline: 'none' }}>
                <option value="">No category</option>
                {GOAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={newPriority} onChange={e => setNewPriority(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '12px', outline: 'none' }}>
                <option value="">No priority</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              {!showSmart ? (
                <button type="button" onClick={() => setShowSmart(true)} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '12px', textAlign: 'left', cursor: 'pointer', padding: 0 }}>+ Make it a SMART goal (optional)</button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #f3f4f6', paddingTop: '6px' }}>
                  <input type="text" placeholder="Specific: what & why?" value={smartSpecific} onChange={e => setSmartSpecific(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 8px', fontSize: '12px', outline: 'none' }} />
                  <input type="text" placeholder="Measurable: how will you know?" value={smartMeasurable} onChange={e => setSmartMeasurable(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 8px', fontSize: '12px', outline: 'none' }} />
                  <input type="text" placeholder="Achievable: realistic?" value={smartAchievable} onChange={e => setSmartAchievable(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 8px', fontSize: '12px', outline: 'none' }} />
                  <input type="text" placeholder="Relevant: why does it matter?" value={smartRelevant} onChange={e => setSmartRelevant(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 8px', fontSize: '12px', outline: 'none' }} />
                  <input type="text" placeholder="Time-bound: target deadline?" value={smartTimebound} onChange={e => setSmartTimebound(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 8px', fontSize: '12px', outline: 'none' }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button type="submit" style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>Add</button>
                <button type="button" onClick={() => { setAdding(false); setShowSmart(false) }} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} title="Add goal"
            style={{ flexShrink: 0, border: 'none', borderRadius: '10px', padding: '6px 10px', fontSize: '12px', color: 'white', background: '#6366f1', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 500 }}>
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
            style={{ fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 8px', width: '110px', flexShrink: 0, outline: 'none' }}
          />
        ) : (
          <button onClick={() => setShowGoalSearch(true)} title="Search goals"
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
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
        <div key={goal.id} onClick={() => setViewingGoalId(goal.id)} style={{ flexShrink: 0, border: '1px solid #e5e7eb', borderRadius: '10px', padding: '6px 10px', minWidth: '130px', background: 'white', position: 'relative', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: goal.color, flexShrink: 0 }} />
            <span style={{ fontSize: "12px", fontWeight: 500, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "80px", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); startEditGoal(goal) }}>{goal.title}</span>
            <span style={{ fontSize: "14px", color: "#9ca3af", cursor: "pointer", flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete goal "${goal.title}"?`)) onDeleteGoal(goal.id) }}>&times;</span>
          </div>
          {(goal.priority || goal.category) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
              {goal.priority && PRIORITY_COLORS[goal.priority] && (
                <span style={{ fontSize: '9px', fontWeight: 500, padding: '1px 5px', borderRadius: '4px', color: PRIORITY_COLORS[goal.priority], background: PRIORITY_COLORS[goal.priority] + '1a' }}>{PRIORITY_LABELS[goal.priority]}</span>
              )}
              {goal.category && <span style={{ fontSize: '9px', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90px' }}>{goal.category}</span>}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ flex: 1, height: '3px', background: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: pct + '%', background: goal.color, borderRadius: '2px' }} />
            </div>
            <span style={{ fontSize: "10px", color: "#9ca3af", flexShrink: 0 }}>{pct}%</span>
            <span style={{ fontSize: "10px", color: "#9ca3af", flexShrink: 0 }}>{done.length}/{linked.length}</span>
          </div>
          {editingGoalId === goal.id && (
            <div onClick={(e) => { e.stopPropagation(); setEditingGoalId(null) }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <form onSubmit={handleEditGoalSubmit} onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', padding: '16px', width: '85vw', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input autoFocus value={editingTitle} onChange={e => setEditingTitle(e.target.value)}
                  style={{ border: '1px solid #6366f1', borderRadius: '8px', padding: '8px', fontSize: '14px', outline: 'none' }} />
                <select value={editingCategory} onChange={e => setEditingCategory(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '12px', outline: 'none' }}>
                  <option value="">No category</option>
                  {GOAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={editingPriority} onChange={e => setEditingPriority(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '12px', outline: 'none' }}>
                  <option value="">No priority</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button type="submit" style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>Save</button>
                  <button type="button" onClick={() => setEditingGoalId(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </form>
            </div>
          )}
          {viewingGoalId === goal.id && (
            <div onClick={(e) => { e.stopPropagation(); setViewingGoalId(null) }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '85vw', maxWidth: '320px' }}>
                <button
                  onClick={() => setViewingGoalId(null)}
                  style={{ position: 'absolute', top: '-12px', right: '-12px', zIndex: 10, width: '28px', height: '28px', borderRadius: '50%', background: '#374151', color: 'white', border: 'none', fontSize: '12px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  &#10005;
                </button>
                <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', maxHeight: '70vh', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <p style={{ fontSize: '17px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{goal.title}</p>
                    {goal.priority && PRIORITY_COLORS[goal.priority] && (
                      <span style={{ fontSize: '10px', fontWeight: 500, padding: '1px 6px', borderRadius: '4px', color: PRIORITY_COLORS[goal.priority], background: PRIORITY_COLORS[goal.priority] + '1a' }}>{PRIORITY_LABELS[goal.priority]}</span>
                    )}
                  </div>
                  {goal.category && <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px', marginBottom: '8px' }}>{goal.category}</p>}
                  {(goal.smart_specific || goal.smart_measurable || goal.smart_achievable || goal.smart_relevant || goal.smart_timebound) && (
                    <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '8px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {goal.smart_specific && <p style={{ fontSize: '11px', color: '#4b5563', margin: 0 }}><b>Specific:</b> {goal.smart_specific}</p>}
                      {goal.smart_measurable && <p style={{ fontSize: '11px', color: '#4b5563', margin: 0 }}><b>Measurable:</b> {goal.smart_measurable}</p>}
                      {goal.smart_achievable && <p style={{ fontSize: '11px', color: '#4b5563', margin: 0 }}><b>Achievable:</b> {goal.smart_achievable}</p>}
                      {goal.smart_relevant && <p style={{ fontSize: '11px', color: '#4b5563', margin: 0 }}><b>Relevant:</b> {goal.smart_relevant}</p>}
                      {goal.smart_timebound && <p style={{ fontSize: '11px', color: '#4b5563', margin: 0 }}><b>Time-bound:</b> {goal.smart_timebound}</p>}
                    </div>
                  )}
                  {linked.length === 0 ? (
                    <p style={{ fontSize: '11px', color: '#9ca3af' }}>No tasks yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                      {sortedLinked.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#4b5563', padding: '4px 2px', WebkitTapHighlightColor: 'transparent', minWidth: 0 }}>
                          <span onClick={() => onMarkDone(t.id)} style={{ color: t.status === 'done' ? '#10b981' : '#d1d5db', fontSize: '14px', cursor: 'pointer', flexShrink: 0 }}>{t.status === 'done' ? '✓' : '○'}</span>
                          <span onClick={() => onMarkDone(t.id)} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: t.status === 'done' ? 'line-through' : 'none', color: t.status === 'done' ? '#9ca3af' : '#4b5563' }}>{t.title}</span>
                          {t.priority && PRIORITY_COLORS[t.priority] && (
                            <span style={{ fontSize: '9px', fontWeight: 500, padding: '1px 5px', borderRadius: '4px', flexShrink: 0, color: PRIORITY_COLORS[t.priority], background: PRIORITY_COLORS[t.priority] + '1a' }}>{PRIORITY_LABELS[t.priority]}</span>
                          )}
                          {t.start_time && (
                            <span style={{ fontSize: '9px', color: '#a5b4fc', flexShrink: 0, whiteSpace: 'nowrap' }}>{formatTime(t.start_time)}</span>
                          )}
                          <span onClick={() => handleEditTask(t.id)} style={{ color: '#c7d2fe', fontSize: '13px', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}>&#9998;</span>
                          <span onClick={() => onDelete(t.id)} style={{ color: '#d1d5db', fontSize: '13px', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}>&#x2715;</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <form onSubmit={(e) => handleAddTaskToGoal(e, goal.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f3f4f6' }}>
                    <input
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      placeholder="Add a task to this goal"
                      style={{ flex: 1, fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 8px', outline: 'none' }}
                    />
                    <button type="submit" style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}>Add</button>
                  </form>
                </div>
              </div>
            </div>
        )}
        </div>
      )
    })}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
      <select value={sortMode} onChange={e => setSortMode(e.target.value)} style={{ fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 8px', outline: 'none' }}>
        <option value="deadline">Sort: Deadline</option>
        <option value="alpha">Sort: A-Z</option>
      </select>
      <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 8px', outline: 'none', maxWidth: '140px' }}>
        <option value="all">All categories</option>
        {GOAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
    </div>
  )
}

function MobileDayView({ date, tasks, goalMap, onMarkDone, onRescheduleToTomorrow, onMoveToInbox, onDelete, onEdit, onAddTaskForDay }) {
  const activeTasks = tasks.filter(t => t.status !== 'done')
  const doneTasks = tasks.filter(t => t.status === 'done')
  const dateStr = format(date, 'yyyy-MM-dd')

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
      {BUCKETS.map(bucket => {
        const bucketTasks = activeTasks.filter(t => (t.bucket || 'morning') === bucket.id).sort((a, b) => (a.position || 0) - (b.position || 0))
        const bucketDone = doneTasks.filter(t => (t.bucket || 'morning') === bucket.id)
        const droppableId = bucket.id + '-' + dateStr
        return (
          <div key={bucket.id} style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{bucket.label}</span>
              {bucketTasks.length > 0 && <span style={{ fontSize: '11px', color: '#d1d5db' }}>{bucketTasks.length}</span>}
            </div>
            <Droppable droppableId={droppableId}>
              {(provided, snapshot) => (
                <div ref={provided.innerRef} {...provided.droppableProps}
                  style={{ minHeight: '44px', background: snapshot.isDraggingOver ? '#eef2ff' : 'transparent', borderRadius: '8px', padding: '2px', transition: 'background 0.15s' }}>
                  {bucketTasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ marginBottom: '6px', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', touchAction: 'manipulation' }}>
                          <TaskCard task={task} isDragging={snapshot.isDragging} goalColor={goalMap[task.goal_id] ? goalMap[task.goal_id].color : null} onMarkDone={onMarkDone} onRescheduleToTomorrow={onRescheduleToTomorrow} onMoveToInbox={onMoveToInbox} onDelete={onDelete} onEdit={onEdit} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {bucketDone.map(task => (
                    <div key={task.id} style={{ marginBottom: '6px' }}>
                      <TaskCard task={task} isDone goalColor={goalMap[task.goal_id] ? goalMap[task.goal_id].color : null} onMarkDone={onMarkDone} onRescheduleToTomorrow={onRescheduleToTomorrow} onMoveToInbox={onMoveToInbox} onDelete={onDelete} onEdit={onEdit} />
                    </div>
                  ))}
                </div>
              )}
            </Droppable>
          </div>
        )
      })}
    </div>
  )
}

function MobileInbox({ tasks, goalMap, onAddTask, onEdit, onDelete, search, sortMode }) {
  const filteredTasks = search && search.trim() ? tasks.filter(t => t.title.toLowerCase().includes(search.trim().toLowerCase())) : tasks
  const visibleTasks = [...filteredTasks].sort((a, b) => {
    if (sortMode === 'alpha') return a.title.localeCompare(b.title)
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0
  })
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
      <Droppable droppableId="inbox">
        {(provided, snapshot) => (
          <div ref={provided.innerRef} {...provided.droppableProps}
            style={{ minHeight: '100px', padding: '0 12px 12px', background: snapshot.isDraggingOver ? '#eef2ff' : 'transparent' }}>
            {visibleTasks.length === 0 && !snapshot.isDraggingOver && (
              <div style={{ textAlign: 'center', paddingTop: '40px' }}>
                {search && search.trim() ? (
                  <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>No matching tasks.</p>
                ) : (
                  <>
                    <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 12px' }}>Nothing in the task list.</p>
                    <button onClick={onAddTask} style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }} title="Add task">+</button>
                  </>
                )}
              </div>
            )}
            {visibleTasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(provided, snapshot) => (
                  <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                    style={{ border: '1px solid ' + (snapshot.isDragging ? '#a5b4fc' : '#e5e7eb'), borderRadius: '10px', padding: '10px 12px', background: 'white', marginBottom: '8px', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', touchAction: 'manipulation' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <p style={{ fontSize: '14px', color: '#1f2937', flex: 1, margin: 0 }}>
                        {task.title}
                        {task.priority && PRIORITY_COLORS[task.priority] && (
                          <span style={{ fontSize: '10px', fontWeight: 500, padding: '1px 6px', borderRadius: '4px', marginLeft: '6px', color: PRIORITY_COLORS[task.priority], background: PRIORITY_COLORS[task.priority] + '1a' }}>{PRIORITY_LABELS[task.priority]}</span>
                        )}
                      </p>
                      {task.goal_id && goalMap[task.goal_id] && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: goalMap[task.goal_id].color, flexShrink: 0, marginTop: '4px' }} />
                      )}
                    </div>
                    {task.notes && <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.notes}</p>}
                    {!snapshot.isDragging && (
                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <button onClick={() => onEdit(task)} style={{ fontSize: '12px', color: '#6366f1', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => onDelete(task.id)} style={{ fontSize: '12px', color: '#d1d5db', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Delete</button>
                      </div>
                    )}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      </div>
    </div>
  )
}

function parseProposals(text) {
  const proposals = []
  const taskRegex = /\[ADD_TASK:\s*([^|\]]+?)(?:\s*\|\s*goal:\s*([^\]]+))?\]/gi
  const goalRegex = /\[ADD_GOAL:\s*([^\]]+)\]/g
  let match
  while ((match = taskRegex.exec(text)) !== null) proposals.push({ type: 'task', title: match[1].trim(), goalTitle: match[2] ? match[2].trim() : null, raw: match[0] })
  while ((match = goalRegex.exec(text)) !== null) proposals.push({ type: 'goal', title: match[1].trim(), raw: match[0] })
  return proposals
}

function cleanText(text) {
  return text.replace(/\[ADD_TASK:[^\]]+\]/g, '').replace(/\[ADD_GOAL:[^\]]+\]/g, '').trim()
}

function MobileAssistant({ goals, tasks, onCreateTask, onAddGoal }) {
  const { messages, loading: historyLoading, addMessage, clearHistory } = useAssistantHistory()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState({})

  const systemPrompt = 'You are a helpful planning assistant in a weekly planner app. You can propose tasks and goals.\n\nWhen proposing a task include [ADD_TASK: task title] in your response. If the task clearly supports one of the user\'s existing goals listed below, tag it with that exact goal title like this instead: [ADD_TASK: task title | goal: Goal Title].\nWhen proposing a goal include [ADD_GOAL: goal title] in your response.\nAlways explain why you suggest them. Be concise.\n\nGoals:\n' + (goals.length > 0 ? goals.map(g => '- ' + g.title).join('\n') : 'None.') + '\n\nTasks:\n' + (tasks.filter(t => t.status !== 'done').slice(0, 15).map(t => '- ' + t.title).join('\n') || 'None.')

  async function send() {
    if (!input.trim() || loading) return
    const userContent = input.trim()
    setInput('')
    setLoading(true)
    await addMessage('user', userContent)
    const allMsgs = [...messages, { role: 'user', content: userContent }]
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + import.meta.env.VITE_GEMINI_API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: allMsgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
        })
      })
      const data = await res.json()
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Something went wrong.'
      await addMessage('assistant', reply)
    } catch {
      await addMessage('assistant', 'Could not reach the assistant.')
    }
    setLoading(false)
  }

  async function handleConfirm(proposal, msgIndex, propIndex) {
    const key = msgIndex + '-' + propIndex
    const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4']
    try {
      if (proposal.type === 'task') {
        const matchedGoal = proposal.goalTitle ? goals.find(g => g.title.toLowerCase() === proposal.goalTitle.toLowerCase()) : null
        await onCreateTask(proposal.title, '', matchedGoal ? matchedGoal.id : null, null)
      } else {
        await onAddGoal(proposal.title, colors[goals.length % colors.length])
      }
      setConfirmed(prev => ({ ...prev, [key]: true }))
    } catch {
      setConfirmed(prev => ({ ...prev, [key]: 'error' }))
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: '24px' }}>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>Ask me to suggest tasks, break down a goal, or help plan your week.</p>
            {['Suggest tasks for my goals', 'Help me break down a goal', 'What should I focus on today?'].map(s => (
              <button key={s} onClick={() => setInput(s)}
                style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: '13px', color: '#6366f1', border: '1px solid #e0e7ff', borderRadius: '10px', padding: '10px 12px', marginBottom: '8px', background: 'white', cursor: 'pointer' }}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((msg, msgIndex) => {
          const proposals = msg.role === 'assistant' ? parseProposals(msg.content) : []
          const displayText = msg.role === 'assistant' ? cleanText(msg.content) : msg.content
          return (
            <div key={msgIndex}>
              <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '85%', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '10px 14px', fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap', background: msg.role === 'user' ? '#6366f1' : '#f3f4f6', color: msg.role === 'user' ? 'white' : '#1f2937' }}>
                  {displayText}
                </div>
              </div>
              {proposals.length > 0 && (
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {proposals.map((proposal, propIndex) => {
                    const key = msgIndex + '-' + propIndex
                    const done = confirmed[key]
                    return (
                      <div key={propIndex} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e0e7ff', borderRadius: '10px', padding: '8px 12px', background: '#eef2ff' }}>
                        <div>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#818cf8', textTransform: 'uppercase', marginRight: '6px' }}>{proposal.type}</span>
                          <span style={{ fontSize: '13px', color: '#1f2937' }}>{proposal.title}</span>
                          {proposal.goalTitle && (
                            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Goal: {proposal.goalTitle}</div>
                          )}
                        </div>
                        {done === true ? (
                          <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 500 }}>Added ✓</span>
                        ) : done === 'error' ? (
                          <button onClick={() => handleConfirm(proposal, msgIndex, propIndex)}
                            style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}>
                            Failed, retry
                          </button>
                        ) : (
                          <button onClick={() => handleConfirm(proposal, msgIndex, propIndex)}
                            style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}>
                            Add
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {loading && (
          <div style={{ display: 'flex' }}>
            <div style={{ background: '#f3f4f6', borderRadius: '16px 16px 16px 4px', padding: '10px 14px', fontSize: '13px', color: '#9ca3af' }}>Thinking...</div>
          </div>
        )}
      </div>
      <div style={{ padding: '12px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: '8px' }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
          placeholder="Ask something..." rows={1}
          style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', resize: 'none', outline: 'none' }} />
        <button onClick={send} disabled={!input.trim() || loading}
          style={{ padding: '10px 14px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', opacity: (!input.trim() || loading) ? 0.4 : 1 }}>
          Send
        </button>
      </div>
    </div>
  )
}

export default function MobileLayout({
  weekStart, weekDays, tasks, goals, goalMap, goalTasks, inboxTasks,
  overdueTasks, onPrevWeek, onNextWeek, onMarkDone,
  onRescheduleToTomorrow, onMoveToInbox, onDelete, onEdit, onAddTask, onAddTaskForDay, onCreateTask,
  onRollover, onAddGoal, onEditGoal, onDeleteGoal
}) {
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = new Date()
    const inWeek = weekDays.some(d => format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'))
    return inWeek ? today : weekDays[0]
  })
  const [activeTab, setActiveTab] = useState('day')
  const [taskSearch, setTaskSearch] = useState('')
  const [showTaskSearch, setShowTaskSearch] = useState(false)
  const [taskSort, setTaskSort] = useState('deadline')

  const tasksForDay = (date) => tasks.filter(t => t.scheduled_date === format(date, 'yyyy-MM-dd'))
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f9fafb', overflow: 'hidden' }}>

      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={onPrevWeek} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#6b7280', cursor: 'pointer', padding: '4px 8px' }}>&#8249;</button>
        <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', margin: 0 }}>{format(weekStart, 'MMM d')} - {format(weekDays[6], 'MMM d, yyyy')}</p>
        <button onClick={onNextWeek} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#6b7280', cursor: 'pointer', padding: '4px 8px' }}>&#8250;</button>
      </div>

      <div style={{ background: 'white', borderBottom: '1px solid #f3f4f6', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        {weekDays.map((day, i) => {
          const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDay, 'yyyy-MM-dd')
          const today = isToday(day)
          const count = tasksForDay(day).filter(t => t.status !== 'done').length
          return (
            <button key={i} onClick={() => { setSelectedDay(day); setActiveTab('day') }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px' }}>
              <span style={{ fontSize: '12px', color: isSelected ? '#6366f1' : '#374151', fontWeight: 600, textTransform: 'uppercase' }}>{dayNames[i]}</span>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isSelected ? '#6366f1' : today ? '#e0e7ff' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '17px', fontWeight: isSelected || today ? 700 : 500, color: isSelected ? 'white' : today ? '#6366f1' : '#374151' }}>{format(day, 'd')}</span>
              </div>
              {count > 0 && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: isSelected ? '#6366f1' : '#d1d5db' }} />}
            </button>
          )
        })}
      </div>

      <MobileGoalsBar goals={goals} goalTasks={goalTasks} allTasks={tasks} onAddGoal={onAddGoal} onEditGoal={onEditGoal} onDeleteGoal={onDeleteGoal} onMarkDone={onMarkDone} onDelete={onDelete} onCreateTask={onCreateTask} onEditTask={onEdit} />

      {overdueTasks.length > 0 && activeTab === 'day' && (
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', color: '#92400e' }}>{overdueTasks.length} overdue</span>
          <button onClick={onRollover} style={{ fontSize: '12px', color: '#d97706', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Roll over</button>
        </div>
      )}

      {activeTab === 'day' && (
        <>
          <div style={{ padding: '10px 16px 6px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>{format(selectedDay, 'EEEE, MMM d')}</span>
            <button onClick={() => onAddTaskForDay(selectedDay)} style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }} title="Add task for this day">+</button>
          </div>
          <MobileDayView date={selectedDay} tasks={tasksForDay(selectedDay)} goalMap={goalMap} onMarkDone={onMarkDone} onRescheduleToTomorrow={onRescheduleToTomorrow} onMoveToInbox={onMoveToInbox} onDelete={onDelete} onEdit={onEdit} onAddTaskForDay={onAddTaskForDay} />
        </>
      )}

      {activeTab === 'inbox' && (
        <>
          <div style={{ padding: '10px 16px 6px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>Task List <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 400 }}>{inboxTasks.length}</span></span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {showTaskSearch ? (
                <input
                  autoFocus
                  type="text"
                  value={taskSearch}
                  onChange={e => setTaskSearch(e.target.value)}
                  onBlur={() => { if (!taskSearch.trim()) setShowTaskSearch(false) }}
                  placeholder="Search tasks…"
                  style={{ fontSize: '13px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '5px 8px', width: '120px', outline: 'none' }}
                />
              ) : (
                <button onClick={() => setShowTaskSearch(true)} title="Search tasks"
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                </button>
              )}
              <button onClick={onAddTask} style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }} title="Add task">+</button>
            </div>
          </div>
          <div style={{ padding: '0 16px 8px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
            <select value={taskSort} onChange={e => setTaskSort(e.target.value)} style={{ fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '5px 8px', outline: 'none' }}>
              <option value="deadline">Sort: Deadline</option>
              <option value="alpha">Sort: A-Z</option>
            </select>
          </div>
          <MobileInbox tasks={inboxTasks} goalMap={goalMap} onAddTask={onAddTask} onEdit={onEdit} onDelete={onDelete} search={taskSearch} sortMode={taskSort} />
        </>
      )}

      {activeTab === 'assistant' && (
        <>
          <div style={{ padding: '10px 16px 6px', flexShrink: 0 }}>
            <span style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>&#129302; Assistant</span>
          </div>
          <MobileAssistant goals={goals} tasks={tasks} onCreateTask={onCreateTask} onAddGoal={onAddGoal} />
        </>
      )}

      <div style={{ background: 'white', borderTop: '1px solid #e5e7eb', padding: '6px 0 8px', display: 'flex', flexShrink: 0 }}>
        {[
          { id: 'day', label: 'Today', emoji: '&#128197;' },
          { id: 'inbox', label: 'Task List', emoji: '&#128221;', badge: inboxTasks.length },
          { id: 'assistant', label: 'Assistant', emoji: '&#129302;' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', position: 'relative' }}>
            <span style={{ fontSize: '22px' }} dangerouslySetInnerHTML={{ __html: tab.emoji }} />
            <span style={{ fontSize: '10px', color: activeTab === tab.id ? '#6366f1' : '#9ca3af', fontWeight: activeTab === tab.id ? 500 : 400 }}>{tab.label}</span>
            {tab.badge > 0 && (
              <div style={{ position: 'absolute', top: '2px', right: '22%', background: '#6366f1', color: 'white', borderRadius: '10px', padding: '1px 5px', fontSize: '10px', fontWeight: 500 }}>{tab.badge}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
