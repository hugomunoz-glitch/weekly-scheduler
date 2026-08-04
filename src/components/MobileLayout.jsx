import { useState, useRef, useEffect } from 'react'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { createPortal } from 'react-dom'
import { useAssistantHistory } from '../hooks/useAssistantHistory'
import { useAuth } from '../contexts/AuthContext'
import CollaborationPanel from './CollaborationPanel'
import DailyReflection from './DailyReflection'
import Dashboard from './Dashboard'
import VisionMission from './VisionMission'
import ExportMenu from './ExportMenu'
import NotificationBell, { NotificationToast } from './NotificationBell'
import MonthView from './MonthView'
import YearView from './YearView'
import { resetViewportZoom } from '../lib/resetZoom'
import { format, isToday, parseISO } from 'date-fns'
import { startGeofencing, updateGeofencingTasks, requestLocationPermission, getLocationPermission } from '../lib/geofencing'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import TaskCard, { categoryBadge } from './TaskCard'
import ViewSwitcher from './ViewSwitcher'

function LocationAlertsSection({ tasks }) {
  const [perm, setPerm] = useState('unknown')

  useEffect(() => {
    getLocationPermission().then(setPerm)
  }, [])

  async function enable() {
    const result = await requestLocationPermission()
    setPerm(result)
    if (result === 'granted') startGeofencing(tasks)
  }

  const locationTasks = tasks.filter(t => t.location && t.location_lat && t.location_lng && t.status !== 'done')

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', marginBottom: '10px', background: 'white' }}>
      <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Location Alerts</p>
      {perm === 'granted' ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            <span style={{ fontSize: '12px', color: '#374151' }}>Location access enabled</span>
          </div>
          <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>
            {locationTasks.length === 0
              ? 'Add a location to a task to get notified when you arrive.'
              : `Watching ${locationTasks.length} task${locationTasks.length > 1 ? 's' : ''} with locations.`}
          </p>
        </div>
      ) : perm === 'denied' ? (
        <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Location blocked. Enable it in your device Settings → Schedulent → Location.</p>
      ) : (
        <div>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px' }}>Get notified when you arrive at a task's location — even when the app is in the background.</p>
          <button onClick={enable} style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', cursor: 'pointer' }}>
            Enable location alerts
          </button>
        </div>
      )}
    </div>
  )
}

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
const PRIORITY_BORDER = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }
const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' }
const GOAL_CATEGORIES = [
  'Career/Professional', 'Family', 'Financial', 'Intellectual',
  'Physical (Health/Wellness)', 'Relationships',
  'Social (Community/Volunteering)', 'Spiritual (Prayer/Church)'
]

// Returns handlers that fire onLongPress after ~550ms of holding without releasing.
// Uses pointer events so it works reliably for touch. Plain factory (not a hook) so
// it can be called inside .map() loops; timerRef/firedRef are shared refs from the caller.
function longPressHandlers(timerRef, firedRef, onLongPress, ms = 550) {
  function clear() { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null } }
  return {
    onPointerDown(e) {
      firedRef.current = false
      clear()
      timerRef.current = setTimeout(() => { firedRef.current = true; onLongPress() }, ms)
    },
    onPointerMove: clear,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick(e) { if (firedRef.current) { e.preventDefault(); e.stopPropagation() } }
  }
}


function MobileGoalsBar({ goals, goalTasks, allTasks, collabMap, collaborations, defaultCollaborationId, onAddGoal, onEditGoal, onDeleteGoal, onDuplicateGoal, onPauseGoal, onMarkDone, onDelete, onCreateTask, onEditTask }) {
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
  const [viewingGoalId, setViewingGoalId] = useState(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [goalSearch, setGoalSearch] = useState('')
  const [showGoalSearch, setShowGoalSearch] = useState(false)
  const [sortMode, setSortMode] = useState('deadline')
  const [sortDir, setSortDir] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [editingGoalId, setEditingGoalId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingCategory, setEditingCategory] = useState('')
  const [editingCustomCategory, setEditingCustomCategory] = useState(false)
  const [editingCategoryCustom, setEditingCategoryCustom] = useState('')
  const [editingPriority, setEditingPriority] = useState('')
  const [editingCollaborationId, setEditingCollaborationId] = useState('')
  const [editFamilyMember, setEditFamilyMember] = useState('')
  const [editShowSmart, setEditShowSmart] = useState(false)
  const [editSmartSpecific, setEditSmartSpecific] = useState('')
  const [editSmartMeasurable, setEditSmartMeasurable] = useState('')
  const [editSmartAchievable, setEditSmartAchievable] = useState('')
  const [editSmartRelevant, setEditSmartRelevant] = useState('')
  const [editSmartTimebound, setEditSmartTimebound] = useState('')
  const [editGoalError, setEditGoalError] = useState('')
  const [newTerm, setNewTerm] = useState('')
  const [editingTerm, setEditingTerm] = useState('')
  const allCategories = [...new Set([...GOAL_CATEGORIES, ...goals.map(g => g.category).filter(Boolean)])].sort()
  const [pressedGoalId, setPressedGoalId] = useState(null)
  const [longPressTaskId, setLongPressTaskId] = useState(null)
  const pressTimerRef = useRef(null)
  const pressFiredRef = useRef(false)
  const [goalBulkTaskMode, setGoalBulkTaskMode] = useState(false)
  const [goalBulkTaskText, setGoalBulkTaskText] = useState('')
  const [goalTaskSubmitting, setGoalTaskSubmitting] = useState(false)

  function startEditGoal(goal) {
    setEditingGoalId(goal.id)
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
    setEditFamilyMember(goal.family_member || '')
    setEditSmartSpecific(goal.smart_specific || '')
    setEditSmartMeasurable(goal.smart_measurable || '')
    setEditSmartAchievable(goal.smart_achievable || '')
    setEditSmartRelevant(goal.smart_relevant || '')
    setEditSmartTimebound(goal.smart_timebound || '')
    setEditShowSmart(!!(goal.smart_specific || goal.smart_measurable || goal.smart_achievable || goal.smart_relevant || goal.smart_timebound))
    setEditingTerm(goal.term || '')
    setEditGoalError('')
    setEditOptionsOpen(!!(goal.category || goal.priority || goal.collaboration_id || goal.family_member || goal.smart_specific || goal.smart_measurable || goal.smart_achievable || goal.smart_relevant || goal.smart_timebound))
  }

  async function handleEditGoalSubmit(e) {
    e.preventDefault()
    if (!editingTitle.trim()) return
    try {
      const category = editingCustomCategory ? editingCategoryCustom.trim() : editingCategory
      await onEditGoal(editingGoalId, editingTitle.trim(), {
        category: category || null,
        priority: editingPriority || null,
        familyMember: category === 'Family' ? editFamilyMember.trim() || null : null,
        smartSpecific: editSmartSpecific.trim() || null,
        smartMeasurable: editSmartMeasurable.trim() || null,
        smartAchievable: editSmartAchievable.trim() || null,
        smartRelevant: editSmartRelevant.trim() || null,
        smartTimebound: editSmartTimebound.trim() || null,
        term: editingTerm || null
      }, editingCollaborationId || null)
      closeEditingGoal()
    } catch {
      setEditGoalError('Could not save. Try again.')
    }
  }

  function closeAdding() {
    resetViewportZoom()
    setAdding(false)
    setAddOptionsOpen(false)
    setNewGoalTasks([''])
  }

  function closeEditingGoal() {
    resetViewportZoom()
    setEditingGoalId(null)
  }

  function closeViewingGoal() {
    resetViewportZoom()
    setViewingGoalId(null)
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

  const completedGoalsCount = goals.filter(g => {
    const linked = goalTasks.filter(t => t.goal_id === g.id)
    return linked.length > 0 && linked.every(t => t.status === 'done')
  }).length

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
    } else if (sortMode === 'term') {
      const termRank = { long: 0, short: 1 }
      const aR = a.term in termRank ? termRank[a.term] : 2
      const bR = b.term in termRank ? termRank[b.term] : 2
      result = aR !== bR ? aR - bR : a.title.localeCompare(b.title)
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
    if (full) { closeViewingGoal(); onEditTask(full) }
  }

  function handleAddTaskToGoal(e, goalId) {
    e.preventDefault()
    if (!newTaskTitle.trim() || goalTaskSubmitting) return
    const goal = goals.find(g => g.id === goalId)
    onCreateTask(newTaskTitle.trim(), '', goalId, null, null, null, null, null, goal?.collaboration_id || null)
    setNewTaskTitle('')
  }

  async function handleBulkAddTaskToGoal(e, goalId) {
    e.preventDefault()
    const lines = goalBulkTaskText.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length || goalTaskSubmitting) return
    const goal = goals.find(g => g.id === goalId)
    setGoalTaskSubmitting(true)
    for (const line of lines) {
      await onCreateTask(line, '', goalId, null, null, null, null, null, goal?.collaboration_id || null)
    }
    setGoalBulkTaskText('')
    setGoalBulkTaskMode(false)
    setGoalTaskSubmitting(false)
  }

  const [addGoalError, setAddGoalError] = useState('')
  const [newGoalCollaborationId, setNewGoalCollaborationId] = useState(defaultCollaborationId || '')
  const [newFamilyMember, setNewFamilyMember] = useState('')
  const [bulkGoalMode, setBulkGoalMode] = useState(false)
  const [bulkGoalTitles, setBulkGoalTitles] = useState('')
  const [bulkGoalSubmitting, setBulkGoalSubmitting] = useState(false)
  const [addOptionsOpen, setAddOptionsOpen] = useState(false)
  const [editOptionsOpen, setEditOptionsOpen] = useState(false)
  const [newGoalTasks, setNewGoalTasks] = useState([''])

  async function handleAdd(e, keepOpen) {
    e.preventDefault()
    if (!newTitle.trim()) return
    try {
      const savedGoal = await onAddGoal(newTitle.trim(), COLORS[goals.length % COLORS.length], {
        category: (customCategory ? newCategoryCustom.trim() : newCategory) || null,
        priority: newPriority || null,
        familyMember: newCategory === 'Family' ? newFamilyMember.trim() || null : null,
        smartSpecific: smartSpecific.trim() || null,
        smartMeasurable: smartMeasurable.trim() || null,
        smartAchievable: smartAchievable.trim() || null,
        smartRelevant: smartRelevant.trim() || null,
        smartTimebound: smartTimebound.trim() || null,
        term: newTerm || null
      }, newGoalCollaborationId || null)
      setAddGoalError('')
      const taskTitles = newGoalTasks.map(t => t.trim()).filter(Boolean)
      for (const title of taskTitles) {
        try { await onCreateTask(title, '', savedGoal?.id, null, null, null, null, null, newGoalCollaborationId || null) } catch {}
      }
      setNewTitle(''); setNewCategory(''); setNewPriority(''); setCustomCategory(false); setNewCategoryCustom(''); setNewFamilyMember('')
      setSmartSpecific(''); setSmartMeasurable(''); setSmartAchievable(''); setSmartRelevant(''); setSmartTimebound('')
      setNewTerm('')
      setNewGoalCollaborationId(defaultCollaborationId || '')
      setShowSmart(false)
      closeAdding()
    } catch {
      setAddGoalError('Could not save. Try again.')
    }
  }

  async function handleBulkGoalSubmit(e) {
    e.preventDefault()
    const lines = bulkGoalTitles.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    setBulkGoalSubmitting(true)
    try {
      for (const line of lines) {
        await onAddGoal(line, COLORS[goals.length % COLORS.length], {
          category: (customCategory ? newCategoryCustom.trim() : newCategory) || null,
          priority: newPriority || null,
          familyMember: newCategory === 'Family' ? newFamilyMember.trim() || null : null
        }, newGoalCollaborationId || null)
      }
      setBulkGoalTitles('')
      setBulkGoalMode(false)
      setNewCategory(''); setNewPriority(''); setCustomCategory(false); setNewCategoryCustom(''); setNewFamilyMember('')
      setNewGoalCollaborationId(defaultCollaborationId || '')
      closeAdding()
      setAddGoalError('')
    } catch {
      setAddGoalError('Could not save one or more goals. Try again.')
    } finally {
      setBulkGoalSubmitting(false)
    }
  }

  const bulkGoalCount = bulkGoalTitles.split('\n').map(l => l.trim()).filter(Boolean).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '10px 16px 6px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>&#127919; Goals <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 400 }}>{goals.length}</span></span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {showGoalSearch ? (
            <input
              autoFocus
              type="text"
              value={goalSearch}
              onChange={e => setGoalSearch(e.target.value)}
              onBlur={() => { if (!goalSearch.trim()) setShowGoalSearch(false) }}
              placeholder="Search goals…"
              style={{ fontSize: '13px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '5px 8px', width: '120px', outline: 'none' }}
            />
          ) : (
            <button onClick={() => setShowGoalSearch(true)} title="Search goals"
              style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </button>
          )}
          <button onClick={() => setAdding(true)} style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }} title="Add goal">+</button>
        </div>
      </div>
      <div style={{ padding: '0 16px', flexShrink: 0 }}>
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>{completedGoalsCount} of {goals.length} done</span>
      </div>
      <div style={{ padding: '4px 16px 8px', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '9px', color: '#9ca3af', fontWeight: 500, lineHeight: 1 }}>Sort by</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <select value={sortMode} onChange={e => setSortMode(e.target.value)} style={{ fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '5px 8px', outline: 'none' }}>
              <option value="taskCount"># of Tasks Completed</option>
              <option value="percentage">% Completed</option>
              <option value="alpha">A-Z</option>
              <option value="created">Date Created</option>
              <option value="deadline">Deadline</option>
              <option value="priority">Priority</option>
              <option value="term">Long/Short Term</option>
            </select>
            <button
              onClick={() => setSortDir(d => d * -1)}
              style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '5px', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={sortDir === 1 ? 'Reverse order' : 'Reversed — tap to restore'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sortDir === -1 ? 'scaleY(-1)' : 'none' }}>
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '5px 8px', outline: 'none', maxWidth: '140px' }}>
          <option value="all">All Categories</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {adding && createPortal((
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={closeAdding}>
          <form onSubmit={bulkGoalMode ? handleBulkGoalSubmit : (e) => handleAdd(e, false)} onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', padding: '16px', width: '85vw', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setBulkGoalMode(m => !m)} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '11px', cursor: 'pointer', padding: 0 }}>
                {bulkGoalMode ? 'Switch to single goal' : 'Add multiple goals at once'}
              </button>
            </div>
            {bulkGoalMode ? (
              <textarea
                autoFocus
                placeholder={'One goal per line, e.g.\nRun a 5K\nRead 12 books\nSave $5,000'}
                value={bulkGoalTitles}
                onChange={e => setBulkGoalTitles(e.target.value)}
                rows={4}
                style={{ border: '1px solid #6366f1', borderRadius: '8px', padding: '8px', fontSize: '14px', outline: 'none', resize: 'none' }}
              />
            ) : (
              <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                style={{ border: '1px solid #6366f1', borderRadius: '8px', padding: '8px', fontSize: '14px', outline: 'none' }}
                placeholder="Goal name" />
            )}
            <button type="button" onClick={() => setAddOptionsOpen(o => !o)}
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '12px', textAlign: 'left', cursor: 'pointer', padding: '2px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', transform: addOptionsOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span> Options
            </button>
            {addOptionsOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #f3f4f6', paddingTop: '8px' }}>
                {customCategory ? (
                  <input autoFocus type="text" placeholder="Custom category name" value={newCategoryCustom} onChange={e => setNewCategoryCustom(e.target.value)} style={{ border: '1px solid #6366f1', borderRadius: '8px', padding: '8px', fontSize: '12px', outline: 'none' }} />
                ) : (
                  <select value={newCategory} onChange={e => { if (e.target.value === '__custom__') { setCustomCategory(true); return } setNewCategory(e.target.value) }} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '12px', outline: 'none' }}>
                    <option value="">No category</option>
                    {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__custom__">+ New category…</option>
                  </select>
                )}
                {newCategory === 'Family' && (
                  <input type="text" placeholder="Who's this about?" value={newFamilyMember} onChange={e => setNewFamilyMember(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '12px', outline: 'none' }} />
                )}
                <select value={newPriority} onChange={e => setNewPriority(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '12px', outline: 'none' }}>
                  <option value="">No priority</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[['', '—'], ['long', 'Long-term'], ['short', 'Short-term']].map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setNewTerm(val)}
                      style={{ fontSize: '11px', padding: '5px 8px', borderRadius: '6px', border: '1px solid ' + (newTerm === val ? '#6366f1' : '#e5e7eb'), background: newTerm === val ? '#6366f1' : 'white', color: newTerm === val ? 'white' : '#6b7280', cursor: 'pointer' }}>
                      {label}
                    </button>
                  ))}
                </div>
                {collaborations && collaborations.length > 0 && (
                  <select value={newGoalCollaborationId} onChange={e => setNewGoalCollaborationId(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '12px', outline: 'none' }}>
                    <option value="">Save to: Personal</option>
                    {collaborations.map(c => <option key={c.id} value={c.id}>Save to: {c.name}</option>)}
                  </select>
                )}
                {!bulkGoalMode && (!showSmart ? (
                  <button type="button" onClick={() => setShowSmart(true)} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '12px', textAlign: 'left', cursor: 'pointer', padding: 0 }}>+ Make it a SMART goal (optional)</button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <input type="text" placeholder="Specific: what & why?" value={smartSpecific} onChange={e => setSmartSpecific(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 8px', fontSize: '12px', outline: 'none' }} />
                    <input type="text" placeholder="Measurable: how will you know?" value={smartMeasurable} onChange={e => setSmartMeasurable(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 8px', fontSize: '12px', outline: 'none' }} />
                    <input type="text" placeholder="Achievable: realistic?" value={smartAchievable} onChange={e => setSmartAchievable(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 8px', fontSize: '12px', outline: 'none' }} />
                    <input type="text" placeholder="Relevant: why does it matter?" value={smartRelevant} onChange={e => setSmartRelevant(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 8px', fontSize: '12px', outline: 'none' }} />
                    <input type="text" placeholder="Time-bound: target deadline?" value={smartTimebound} onChange={e => setSmartTimebound(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 8px', fontSize: '12px', outline: 'none' }} />
                  </div>
                ))}
              </div>
            )}
            {!bulkGoalMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #f3f4f6', paddingTop: '8px' }}>
                <p style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', margin: 0 }}>Tasks (optional)</p>
                {newGoalTasks.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder={i === 0 ? 'First task…' : 'Another task…'}
                      value={t}
                      onChange={e => setNewGoalTasks(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                      style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 8px', fontSize: '12px', outline: 'none' }}
                    />
                    {newGoalTasks.length > 1 && (
                      <button type="button" onClick={() => setNewGoalTasks(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: '#d1d5db', fontSize: '16px', cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setNewGoalTasks(prev => [...prev, ''])}
                  style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '12px', textAlign: 'left', cursor: 'pointer', padding: 0 }}>+ Add another task</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
              {bulkGoalMode ? (
                <button type="submit" disabled={bulkGoalCount === 0 || bulkGoalSubmitting} style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: bulkGoalCount === 0 ? 'default' : 'pointer', opacity: bulkGoalCount === 0 || bulkGoalSubmitting ? 0.4 : 1 }}>
                  {bulkGoalSubmitting ? 'Adding...' : bulkGoalCount > 0 ? 'Add ' + bulkGoalCount + ' goals' : 'Add goals'}
                </button>
              ) : (
                <button type="submit" style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>Add</button>
              )}
              <button type="button" onClick={() => { closeAdding(); setShowSmart(false); setBulkGoalMode(false) }} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            </div>
            {addGoalError && <p style={{ fontSize: '12px', color: '#ef4444', margin: 0 }}>{addGoalError}</p>}
          </form>
        </div>
      ), document.body)}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
      {visibleGoals.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', paddingTop: '40px' }}>No goals yet.</p>
      ) : visibleGoals.map(goal => {
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
        const goalDisplayColor = (goal.category ? categoryBadge(goal.category)?.color : null) || goal.color
        const isFullyCompleted = linked.length > 0 && linked.every(t => t.status === 'done')
        const mobileStatus = goal.status === 'paused' ? 'paused' : isFullyCompleted ? 'completed' : linked.some(t => t.status === 'done') ? 'in_progress' : 'not_started'
        const MOBILE_STATUS_BADGE = {
          in_progress: { label: 'In Progress', color: '#4338ca', bg: '#eef2ff', dot: '#6366f1' },
          paused:      { label: 'Paused',      color: '#b45309', bg: '#fffbeb', dot: '#f59e0b' },
          completed:   { label: 'Completed',   color: '#059669', bg: '#d1fae5', dot: '#10b981' },
          not_started: null,
        }
        const mobileStatusBadge = MOBILE_STATUS_BADGE[mobileStatus]
        const cardBg = mobileStatus === 'paused' ? '#fffbeb' : 'white'
        const cardBorder = mobileStatus === 'paused' ? '1px solid #fde68a' : '1px solid #e5e7eb'
      return (
        <div key={goal.id} onClick={() => { if (pressedGoalId !== goal.id) setViewingGoalId(goal.id) }} style={{ border: cardBorder, borderLeft: goal.priority && PRIORITY_BORDER[goal.priority] ? '4px solid ' + PRIORITY_BORDER[goal.priority] : cardBorder, borderRadius: '10px', padding: '10px 12px', marginBottom: '8px', background: cardBg, position: 'relative', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: "15px", fontWeight: 600, color: "#1f2937", flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal.title}</span>
            {goal.collaboration_id && collabMap && collabMap[goal.collaboration_id] && (
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: collabMap[goal.collaboration_id].color }} />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setPressedGoalId(pressedGoalId === goal.id ? null : goal.id) }}
              style={{ background: 'none', border: 'none', color: '#6b7280', flexShrink: 0, padding: '0 0 0 4px', lineHeight: 1, fontSize: '16px' }}
              title="More actions"
            >&#8942;</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', paddingLeft: '2px', flexWrap: 'wrap' }}>
            {categoryBadge(goal.category) ? (
              <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px', color: categoryBadge(goal.category).color, background: categoryBadge(goal.category).color + '1a' }}>{categoryBadge(goal.category).name}</span>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); startEditGoal(goal) }}
                style={{ fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px', border: '1px dashed #d1d5db', color: '#9ca3af', background: 'none', cursor: 'pointer', display: 'block' }}
              >+ Category</button>
            )}
            {goal.term && (
              <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px', color: goal.term === 'long' ? '#7c3aed' : '#0284c7', background: goal.term === 'long' ? '#f5f3ff' : '#f0f9ff' }}>
                {goal.term === 'long' ? 'Long-term' : 'Short-term'}
              </span>
            )}
            {mobileStatusBadge && (
              <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px', color: mobileStatusBadge.color, background: mobileStatusBadge.bg }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: mobileStatusBadge.dot, display: 'inline-block', flexShrink: 0 }} />
                {mobileStatusBadge.label}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '2px' }}>
            <div style={{ flex: 1, height: '4px', background: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: pct + '%', background: goalDisplayColor, borderRadius: '2px' }} />
            </div>
            <span style={{ fontSize: "11px", color: "#9ca3af", flexShrink: 0 }}>{pct}%</span>
            <span style={{ fontSize: "11px", color: "#9ca3af", flexShrink: 0 }}>{done.length}/{linked.length}</span>
          </div>
          {pressedGoalId === goal.id && (
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f3f4f6' }}>
              <button onClick={(e) => { e.stopPropagation(); setPressedGoalId(null); startEditGoal(goal) }} style={{ fontSize: '24px', color: '#6b7280', background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 1 }} title="Edit goal">&#9998;</button>
              {onDuplicateGoal && <button onClick={(e) => { e.stopPropagation(); setPressedGoalId(null); onDuplicateGoal(goal.id) }} style={{ fontSize: '20px', color: '#6b7280', background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 1 }} title="Duplicate goal">&#10697;</button>}
              {!isFullyCompleted && onPauseGoal && (
                mobileStatus === 'paused' ? (
                  <button onClick={(e) => { e.stopPropagation(); setPressedGoalId(null); onPauseGoal(goal.id, false) }} style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '5px', border: '1px solid #c7d2fe', color: '#4338ca', background: '#eef2ff', cursor: 'pointer' }}>▶ Resume</button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setPressedGoalId(null); onPauseGoal(goal.id, true) }} style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '5px', border: '1px solid #fde68a', color: '#b45309', background: '#fffbeb', cursor: 'pointer' }}>⏸ Pause</button>
                )
              )}
              <button onClick={(e) => { e.stopPropagation(); setPressedGoalId(null); onDeleteGoal(goal.id) }} style={{ fontSize: '18px', color: '#ef4444', background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 1, marginLeft: 'auto' }} title="Delete goal">&#128465;</button>
            </div>
          )}
          {editingGoalId === goal.id && (
            <div onClick={(e) => { e.stopPropagation(); closeEditingGoal() }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <form onSubmit={handleEditGoalSubmit} onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', padding: '16px', width: '85vw', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input autoFocus value={editingTitle} onChange={e => setEditingTitle(e.target.value)}
                  style={{ border: '1px solid #6366f1', borderRadius: '8px', padding: '8px', fontSize: '14px', outline: 'none' }} />
                <button type="button" onClick={() => setEditOptionsOpen(o => !o)}
                  style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '12px', textAlign: 'left', cursor: 'pointer', padding: '2px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ display: 'inline-block', transform: editOptionsOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span> Options
                </button>
                {editOptionsOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #f3f4f6', paddingTop: '8px' }}>
                    {editingCustomCategory ? (
                      <input type="text" placeholder="Custom category name" value={editingCategoryCustom} onChange={e => setEditingCategoryCustom(e.target.value)} style={{ border: '1px solid #6366f1', borderRadius: '8px', padding: '8px', fontSize: '12px', outline: 'none' }} />
                    ) : (
                      <select value={editingCategory} onChange={e => { if (e.target.value === '__custom__') { setEditingCustomCategory(true); return } setEditingCategory(e.target.value) }} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '12px', outline: 'none' }}>
                        <option value="">No category</option>
                        {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="__custom__">+ New category…</option>
                      </select>
                    )}
                    <select value={editingPriority} onChange={e => setEditingPriority(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '12px', outline: 'none' }}>
                      <option value="">No priority</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[['', '—'], ['long', 'Long-term'], ['short', 'Short-term']].map(([val, label]) => (
                        <button key={val} type="button" onClick={() => setEditingTerm(val)}
                          style={{ fontSize: '11px', padding: '5px 8px', borderRadius: '6px', border: '1px solid ' + (editingTerm === val ? '#6366f1' : '#e5e7eb'), background: editingTerm === val ? '#6366f1' : 'white', color: editingTerm === val ? 'white' : '#6b7280', cursor: 'pointer' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {editingCategory === 'Family' && (
                      <input type="text" placeholder="Who's this about?" value={editFamilyMember} onChange={e => setEditFamilyMember(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '12px', outline: 'none' }} />
                    )}
                    {collaborations && collaborations.length > 0 && (
                      <select value={editingCollaborationId} onChange={e => setEditingCollaborationId(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '12px', outline: 'none' }}>
                        <option value="">Save to: Personal</option>
                        {collaborations.map(c => <option key={c.id} value={c.id}>Save to: {c.name}</option>)}
                      </select>
                    )}
                    {!editShowSmart ? (
                      <button type="button" onClick={() => setEditShowSmart(true)} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '12px', textAlign: 'left', cursor: 'pointer', padding: 0 }}>+ Make it a SMART goal (optional)</button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <input type="text" placeholder="Specific: what & why?" value={editSmartSpecific} onChange={e => setEditSmartSpecific(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 8px', fontSize: '12px', outline: 'none' }} />
                        <input type="text" placeholder="Measurable: how will you know?" value={editSmartMeasurable} onChange={e => setEditSmartMeasurable(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 8px', fontSize: '12px', outline: 'none' }} />
                        <input type="text" placeholder="Achievable: realistic?" value={editSmartAchievable} onChange={e => setEditSmartAchievable(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 8px', fontSize: '12px', outline: 'none' }} />
                        <input type="text" placeholder="Relevant: why does it matter?" value={editSmartRelevant} onChange={e => setEditSmartRelevant(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 8px', fontSize: '12px', outline: 'none' }} />
                        <input type="text" placeholder="Time-bound: target deadline?" value={editSmartTimebound} onChange={e => setEditSmartTimebound(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '7px 8px', fontSize: '12px', outline: 'none' }} />
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                  <button type="submit" style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>Save</button>
                  <button type="button" onClick={closeEditingGoal} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                  <button type="button" onClick={() => { onDeleteGoal(editingGoalId); closeEditingGoal() }} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '18px', cursor: 'pointer', marginLeft: 'auto', lineHeight: 1 }} title="Delete goal">&#128465;</button>
                </div>
                {editGoalError && <p style={{ fontSize: '12px', color: '#ef4444', margin: 0 }}>{editGoalError}</p>}
              </form>
            </div>
          )}
          {viewingGoalId === goal.id && (
            <div onClick={(e) => { e.stopPropagation(); closeViewingGoal() }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '90vw', maxWidth: '380px' }}>
                <button
                  onClick={closeViewingGoal}
                  style={{ position: 'absolute', top: '-12px', right: '-12px', zIndex: 10, width: '28px', height: '28px', borderRadius: '50%', background: '#374151', color: 'white', border: 'none', fontSize: '12px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  &#10005;
                </button>
                <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: goal.priority && PRIORITY_BORDER[goal.priority] ? '4px solid ' + PRIORITY_BORDER[goal.priority] : '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', maxHeight: '70vh', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <p style={{ fontSize: '30px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{goal.title}</p>
                  </div>
                  {categoryBadge(goal.category) && <span style={{ display: 'inline-block', fontSize: '12px', fontWeight: 500, padding: '3px 8px', borderRadius: '6px', marginTop: '2px', marginBottom: '8px', color: categoryBadge(goal.category).color, background: categoryBadge(goal.category).color + '1a' }}>{categoryBadge(goal.category).name}</span>}
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
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '20px', color: '#4b5563', padding: '6px 8px', minWidth: 0, borderLeft: t.priority && PRIORITY_BORDER[t.priority] ? '4px solid ' + PRIORITY_BORDER[t.priority] : undefined }}>
                          <span onClick={() => onMarkDone(t.id)} style={{ color: t.status === 'done' ? '#10b981' : '#d1d5db', fontSize: '22px', cursor: 'pointer', flexShrink: 0 }}>{t.status === 'done' ? '✓' : '○'}</span>
                          <span onClick={() => handleEditTask(t.id)} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: t.status === 'done' ? 'line-through' : 'none', color: t.status === 'done' ? '#9ca3af' : '#4b5563' }}>{t.title}</span>
                          {t.collaboration_id && collabMap && collabMap[t.collaboration_id] && (
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: collabMap[t.collaboration_id].color }} />
                          )}
                          {t.start_time && (
                            <span style={{ fontSize: '13px', color: '#a5b4fc', flexShrink: 0, whiteSpace: 'nowrap' }}>{formatTime(t.start_time)}</span>
                          )}
                          <span onClick={(e) => { e.stopPropagation(); onDelete(t.id, e) }} style={{ color: '#ef4444', fontSize: '17px', fontWeight: 500, cursor: 'pointer', padding: '2px 4px', flexShrink: 0, lineHeight: 1 }}>&#10005;</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
                      <button type="button" onClick={() => { setGoalBulkTaskMode(m => !m); setGoalBulkTaskText(''); setNewTaskTitle('') }} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '11px', cursor: 'pointer', padding: 0 }}>
                        {goalBulkTaskMode ? 'Add single task' : 'Add multiple tasks at once'}
                      </button>
                    </div>
                    {goalBulkTaskMode ? (
                      <form onSubmit={(e) => handleBulkAddTaskToGoal(e, goal.id)} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <textarea
                          autoFocus
                          value={goalBulkTaskText}
                          onChange={e => setGoalBulkTaskText(e.target.value)}
                          placeholder="One task per line…"
                          rows={3}
                          style={{ fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 8px', outline: 'none', resize: 'none' }}
                        />
                        <button type="submit" disabled={!goalBulkTaskText.trim() || goalTaskSubmitting}
                          style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '6px', padding: '7px', fontSize: '12px', cursor: 'pointer', opacity: !goalBulkTaskText.trim() ? 0.5 : 1 }}>
                          {goalTaskSubmitting ? 'Adding…' : 'Add tasks'}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={(e) => handleAddTaskToGoal(e, goal.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          value={newTaskTitle}
                          onChange={e => setNewTaskTitle(e.target.value)}
                          placeholder="Add a task to this goal"
                          style={{ flex: 1, fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 8px', outline: 'none' }}
                        />
                        <button type="submit" disabled={!newTaskTitle.trim()} style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', flexShrink: 0, opacity: !newTaskTitle.trim() ? 0.5 : 1 }}>Add</button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>
        )}
        </div>
      )
    })}
      </div>
    </div>
  )
}

function MobileDayView({ date, tasks, dueCards, goalMap, collabMap, profileMap, onMarkDone, onRescheduleToTomorrow, onMoveToInbox, onDelete, onEdit, onDuplicate, onAddTaskForBucket }) {
  const activeTasks = tasks.filter(t => t.status !== 'done')
  const doneTasks = tasks.filter(t => t.status === 'done')
  const dateStr = format(date, 'yyyy-MM-dd')

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
      {BUCKETS.map(bucket => {
        const bucketActiveCount = tasks.filter(t => t.status !== 'done' && (t.bucket || 'morning') === bucket.id).length
          + (dueCards || []).filter(t => t.status !== 'done' && (t.due_date_card_bucket || 'morning') === bucket.id).length
        const bucketAll = tasks.filter(t => (t.bucket || 'morning') === bucket.id).sort((a, b) => {
          const aDone = a.status === 'done', bDone = b.status === 'done'
          const aHasTime = !!a.start_time, bHasTime = !!b.start_time
          if (aDone && !aHasTime && !(bDone && !bHasTime)) return 1
          if (bDone && !bHasTime && !(aDone && !aHasTime)) return -1
          if (aHasTime && bHasTime) return a.start_time < b.start_time ? -1 : a.start_time > b.start_time ? 1 : 0
          if (aHasTime) return -1
          if (bHasTime) return 1
          return (a.position || 0) - (b.position || 0)
        })
        const bucketDueCards = (dueCards || []).filter(t => (t.due_date_card_bucket || 'morning') === bucket.id).sort((a, b) => (a.due_date_card_position || 0) - (b.due_date_card_position || 0))
        const droppableId = bucket.id + '-' + dateStr
        return (
          <div key={bucket.id} style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{bucket.label}</span>
              {bucketActiveCount > 0 && <span style={{ fontSize: '11px', color: '#d1d5db' }}>{bucketActiveCount}</span>}
              <button onClick={() => onAddTaskForBucket(date, bucket.id)} style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '13px', cursor: 'pointer', marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }} title={'Add task to ' + bucket.label}>+</button>
            </div>
            <Droppable droppableId={droppableId}>
              {(provided, snapshot) => (
                <div ref={provided.innerRef} {...provided.droppableProps}
                  style={{ minHeight: '44px', background: snapshot.isDraggingOver ? '#eef2ff' : 'transparent', borderRadius: '8px', padding: '2px', transition: 'background 0.15s' }}>
                  {bucketAll.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={task.status === 'done'}>
                      {(provided, snapshot) => {
                        const card = (
                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ ...provided.draggableProps.style, marginBottom: '6px', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', touchAction: 'manipulation' }}>
                            <TaskCard task={task} isDone={task.status === 'done'} isDragging={snapshot.isDragging} collabBadge={task.collaboration_id && collabMap ? collabMap[task.collaboration_id] : null} assigneeName={task.assigned_to && profileMap ? profileMap[task.assigned_to] : null} onMarkDone={onMarkDone} onRescheduleToTomorrow={onRescheduleToTomorrow} onMoveToInbox={onMoveToInbox} onDelete={onDelete} onEdit={onEdit} onDuplicate={onDuplicate} />
                          </div>
                        )
                        return snapshot.isDragging ? createPortal(card, document.body) : card
                      }}
                    </Draggable>
                  ))}
                  {bucketDueCards.map((task, index) => (
                    <Draggable key={task.id + '__due__'} draggableId={task.id + '__due__'} index={bucketAll.length + index} isDragDisabled={task.status === 'done'}>
                      {(provided, snapshot) => {
                        const card = (
                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ ...provided.draggableProps.style, marginBottom: '6px', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', touchAction: 'manipulation' }}>
                            <TaskCard task={task} isDone={task.status === 'done'} isDragging={snapshot.isDragging} isDueCard collabBadge={task.collaboration_id && collabMap ? collabMap[task.collaboration_id] : null} assigneeName={task.assigned_to && profileMap ? profileMap[task.assigned_to] : null} onMarkDone={onMarkDone} onRescheduleToTomorrow={onRescheduleToTomorrow} onMoveToInbox={onMoveToInbox} onDelete={onDelete} onEdit={onEdit} onDuplicate={onDuplicate} />
                          </div>
                        )
                        return snapshot.isDragging ? createPortal(card, document.body) : card
                      }}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        )
      })}
    </div>
  )
}

function MobileInbox({ tasks, goalMap, collabMap, collabMembersMap, profileMap, onAssignTask, onMarkDone, onAddTask, onEdit, onDelete, onDuplicate, search, sortMode, sortDir, categoryFilter }) {
  const [pressedTaskId, setPressedTaskId] = useState(null)
  const searched = search && search.trim() ? tasks.filter(t => t.title.toLowerCase().includes(search.trim().toLowerCase())) : tasks
  const filteredTasks = categoryFilter && categoryFilter !== 'all' ? searched.filter(t => t.category === categoryFilter) : searched
  const visibleTasks = [...filteredTasks].sort((a, b) => {
    const aDone = a.status === 'done', bDone = b.status === 'done'
    if (sortMode === 'completed') return (aDone === bDone ? 0 : aDone ? -1 : 1) * sortDir
    if (aDone !== bDone) return aDone ? 1 : -1
    let result
    if (sortMode === 'manual') result = (a.position || 0) - (b.position || 0)
    else if (sortMode === 'created') result = new Date(b.created_at || 0) - new Date(a.created_at || 0)
    else if (sortMode === 'alpha') result = a.title.localeCompare(b.title)
    else if (sortMode === 'priority') {
      const aRank = a.priority in PRIORITY_RANK ? PRIORITY_RANK[a.priority] : 3
      const bRank = b.priority in PRIORITY_RANK ? PRIORITY_RANK[b.priority] : 3
      result = aRank !== bRank ? aRank - bRank : a.title.localeCompare(b.title)
    } else {
      if (!a.due_date && !b.due_date) result = 0
      else if (!a.due_date) result = 1
      else if (!b.due_date) result = -1
      else result = a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0
    }
    return result * sortDir
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
                {(provided, snapshot) => {
                  const row = (
                  <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                    style={{ ...provided.draggableProps.style, border: '1px solid ' + (snapshot.isDragging ? '#a5b4fc' : '#e5e7eb'), borderLeft: task.priority && PRIORITY_BORDER[task.priority] ? '4px solid ' + PRIORITY_BORDER[task.priority] : undefined, borderRadius: '10px', padding: '10px 12px', background: 'white', marginBottom: '8px', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', touchAction: 'manipulation' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onMarkDone(task.id) }}
                        style={{ marginTop: '2px', width: '16px', height: '16px', borderRadius: '4px', border: '1px solid ' + (task.status === 'done' ? '#a7f3d0' : '#d1d5db'), background: task.status === 'done' ? '#d1fae5' : 'transparent', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11px', lineHeight: 1 }}
                      >
                        {task.status === 'done' && '\u2713'}
                      </button>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', color: task.status === 'done' ? '#9ca3af' : '#1f2937', margin: 0, textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
                          {task.collaboration_id && collabMap && collabMap[task.collaboration_id] && (
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', marginRight: '6px', verticalAlign: 'middle', background: collabMap[task.collaboration_id].color }} title={'Shared with: ' + collabMap[task.collaboration_id].name} />
                          )}
                          {task.title}
                        </p>
                        {categoryBadge(task.category) && (() => {
                          const cb = categoryBadge(task.category)
                          return <span style={{ fontSize: '9px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '4px', color: cb.color, background: cb.color + '1a' }}>{cb.name}</span>
                        })()}
                        {task.assigned_to && profileMap && profileMap[task.assigned_to] && (() => {
                          const c = collabMap && task.collaboration_id && collabMap[task.collaboration_id] ? collabMap[task.collaboration_id].color : '#6366f1'
                          return <span style={{ fontSize: '9px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '4px', marginLeft: '4px', color: c, background: c + '1a' }} title={'Assigned to: ' + profileMap[task.assigned_to]}>{profileMap[task.assigned_to]}</span>
                        })()}
                      </div>
                      {!snapshot.isDragging && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setPressedTaskId(pressedTaskId === task.id ? null : task.id) }}
                          style={{ background: 'none', border: 'none', color: '#6b7280', flexShrink: 0, padding: '0 0 0 4px', lineHeight: 1, fontSize: '16px' }}
                          title="More actions"
                        >
                          &#8942;
                        </button>
                      )}
                    </div>
                    {task.notes && <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.notes}</p>}
                    {!snapshot.isDragging && pressedTaskId === task.id && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                        <button onClick={(e) => { e.stopPropagation(); onEdit(task) }} style={{ fontSize: '27px', color: '#6366f1', background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 1 }} title="Edit">&#9998;</button>
                        {onDuplicate && <button onClick={(e) => { e.stopPropagation(); setPressedTaskId(null); onDuplicate(task.id) }} style={{ fontSize: '20px', color: '#9ca3af', background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 1 }} title="Duplicate">&#10697;</button>}
                        {task.collaboration_id && collabMembersMap && collabMembersMap[task.collaboration_id] && collabMembersMap[task.collaboration_id].length > 0 && (
                          <select
                            value={task.assigned_to || ''}
                            onChange={(e) => { e.stopPropagation(); onAssignTask(task.id, e.target.value || null) }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '4px 6px' }}
                          >
                            <option value="">Unassigned</option>
                            {collabMembersMap[task.collaboration_id].map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                          </select>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); onDelete(task.id, e) }} style={{ fontSize: '17px', color: '#ef4444', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginLeft: 'auto', lineHeight: 1 }} title="Delete">&#128465;</button>
                      </div>
                    )}
                    {!snapshot.isDragging && pressedTaskId === task.id && task.scheduled_date && (
                      <p style={{ fontSize: '11px', color: '#9ca3af', margin: '6px 0 0' }}>Scheduled: {format(parseISO(task.scheduled_date), 'MMM d')}</p>
                    )}
                    {!snapshot.isDragging && pressedTaskId === task.id && task.due_date && (
                      <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>Deadline: {format(parseISO(task.due_date), 'MMM d')}</p>
                    )}
                  </div>
                  )
                  return snapshot.isDragging ? createPortal(row, document.body) : row
                }}
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
  weekStart, weekDays, tasks, goals, goalMap, collabMap, collabMembersMap, profileMap, goalTasks, inboxTasks, loading,
  collaborations, activeView, onChangeView, defaultCollaborationId,
  overdueTasks, onPrevWeek, onNextWeek, onMarkDone,
  onRescheduleToTomorrow, onMoveToInbox, onDelete, onEdit, onAddTask, onAddTaskForBucket, onCreateTask,
  onRollover, onAddGoal, onEditGoal, onDeleteGoal, onAssignTask,
  onDuplicateGoal, onDuplicateTask,
  rolloverMode, onRolloverModeChange, onRefresh
}) {
  const [selectedDay, setSelectedDay] = useState(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const inWeek = weekDays.some(d => format(d, 'yyyy-MM-dd') === todayStr)
    return inWeek ? todayStr : format(weekDays[0], 'yyyy-MM-dd')
  })
  const [activeTab, setActiveTab] = useState('day')
  const [mobileCalView, setMobileCalView] = useState('week')
  const mobileScrollRef = useRef(null)
  const { pullY, refreshing } = usePullToRefresh(onRefresh || (() => {}), mobileScrollRef)

  // Reset selectedDay when week navigation changes and selected day is no longer in view
  useEffect(() => {
    getLocationPermission().then(perm => {
      if (perm === 'granted') {
        startGeofencing(tasks).catch(() => {})
      } else {
        updateGeofencingTasks(tasks)
      }
    }).catch(() => {})
  }, [tasks])

  useEffect(() => {
    const inWeek = weekDays.some(d => format(d, 'yyyy-MM-dd') === selectedDay)
    if (!inWeek) {
      const todayStr = format(new Date(), 'yyyy-MM-dd')
      const todayInWeek = weekDays.some(d => format(d, 'yyyy-MM-dd') === todayStr)
      setSelectedDay(todayInWeek ? todayStr : format(weekDays[0], 'yyyy-MM-dd'))
    }
  }, [weekDays])
  const [showCollab, setShowCollab] = useState(false)
  const { user, profile, signOut, updateEmail, updatePassword, updateUsername } = useAuth()
  const [settingsSection, setSettingsSection] = useState(null) // 'username' | 'email' | 'password' | null
  const [newUsername, setNewUsername] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [currentPasswordForPw, setCurrentPasswordForPw] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [settingsMessage, setSettingsMessage] = useState(null)
  const [settingsError, setSettingsError] = useState(null)
  const [settingsSubmitting, setSettingsSubmitting] = useState(false)
  const [reflectDay, setReflectDay] = useState(null)
  const [showDashboard, setShowDashboard] = useState(false)
  const [showVisionMission, setShowVisionMission] = useState(false)

  async function handleUsernameSubmit(e) {
    e.preventDefault()
    setSettingsError(null)
    setSettingsMessage(null)
    const trimmed = newUsername.trim()
    if (!trimmed) return
    setSettingsSubmitting(true)
    const { error } = await updateUsername(trimmed)
    setSettingsSubmitting(false)
    if (error) { setSettingsError(error.message); return }
    setSettingsMessage('Username updated.')
    setNewUsername('')
    setSettingsSection(null)
  }

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setSettingsError(null)
    setSettingsMessage(null)
    setSettingsSubmitting(true)
    const { error } = await updateEmail(currentPasswordForEmail, newEmail.trim())
    setSettingsSubmitting(false)
    if (error) { setSettingsError(error.message); return }
    setSettingsMessage('Check your new email address to confirm the change.')
    setNewEmail('')
    setCurrentPasswordForEmail('')
    setSettingsSection(null)
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setSettingsError(null)
    setSettingsMessage(null)
    if (newPassword.length < 6) { setSettingsError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setSettingsError('Passwords do not match.'); return }
    setSettingsSubmitting(true)
    const { error } = await updatePassword(currentPasswordForPw, newPassword)
    setSettingsSubmitting(false)
    if (error) { setSettingsError(error.message); return }
    setSettingsMessage('Password updated.')
    setCurrentPasswordForPw('')
    setNewPassword('')
    setConfirmPassword('')
    setSettingsSection(null)
  }
  const [taskSearch, setTaskSearch] = useState('')
  const [showTaskSearch, setShowTaskSearch] = useState(false)
  const [taskSort, setTaskSort] = useState('deadline')
  const [taskSortDir, setTaskSortDir] = useState(1)
  const [taskCategoryFilter, setTaskCategoryFilter] = useState('all')
  const taskCategories = [...new Set(tasks.map(t => t.category).filter(Boolean))].sort()

  const tasksForDay = (date) => tasks.filter(t => t.scheduled_date === format(date, 'yyyy-MM-dd'))
  const dueCardsForDay = (date) => tasks.filter(t => t.due_date_card_date === format(date, 'yyyy-MM-dd'))

  return (
    <div ref={mobileScrollRef} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', background: '#f9fafb', overflow: 'hidden' }}>
      {(pullY > 0 || refreshing) && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', paddingTop: Math.min(pullY, 48) + 'px', zIndex: 100, pointerEvents: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid #6366f1', borderTopColor: 'transparent', animation: refreshing ? 'spin 0.7s linear infinite' : 'none', transform: refreshing ? 'none' : `rotate(${pullY / 72 * 270}deg)`, opacity: Math.min(pullY / 36, 1) }} />
        </div>
      )}

      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '10px 16px', paddingTop: 'max(10px, env(safe-area-inset-top))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={onPrevWeek} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#6b7280', cursor: 'pointer', padding: '4px 8px' }}>&#8249;</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', margin: 0 }}>
            {mobileCalView === 'workweek'
              ? `${format(weekDays[1], 'MMM d')} - ${format(weekDays[5], 'MMM d, yyyy')}`
              : `${format(weekStart, 'MMM d')} - ${format(weekDays[6], 'MMM d, yyyy')}`}
          </p>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[['week','Week'],['workweek','Work Wk'],['month','Month'],['year','Year']].map(([v, label]) => (
              <button key={v} onClick={() => setMobileCalView(v)}
                style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 500, background: mobileCalView === v ? '#6366f1' : '#f3f4f6', color: mobileCalView === v ? 'white' : '#6b7280' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={onNextWeek} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#6b7280', cursor: 'pointer', padding: '4px 8px' }}>&#8250;</button>
      </div>

      {mobileCalView === 'month' && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <MonthView tasks={tasks} onDayClick={(day) => { setSelectedDay(format(day, 'yyyy-MM-dd')); setMobileCalView('week'); setActiveTab('day') }} />
        </div>
      )}
      {mobileCalView === 'year' && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <YearView tasks={tasks} onMonthClick={() => setMobileCalView('month')} onDayClick={(day) => { setSelectedDay(format(day, 'yyyy-MM-dd')); setMobileCalView('week'); setActiveTab('day') }} />
        </div>
      )}

      {(mobileCalView === 'week' || mobileCalView === 'workweek') && <div style={{ background: 'white', borderBottom: '1px solid #f3f4f6', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        {(mobileCalView === 'workweek' ? weekDays.slice(1, 6) : weekDays).map((day, i) => {
          const isSelected = format(day, 'yyyy-MM-dd') === selectedDay
          const today = isToday(day)
          const count = tasksForDay(day).filter(t => t.status !== 'done').length
          return (
            <button key={i} onClick={() => { setSelectedDay(format(day, 'yyyy-MM-dd')); setActiveTab('day'); setMobileCalView('week') }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px' }}>
              <span style={{ fontSize: '12px', color: isSelected ? '#6366f1' : '#374151', fontWeight: 600, textTransform: 'uppercase' }}>{format(day, 'EEEEE')}</span>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isSelected ? '#6366f1' : today ? '#e0e7ff' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '17px', fontWeight: isSelected || today ? 700 : 500, color: isSelected ? 'white' : today ? '#6366f1' : '#374151' }}>{format(day, 'd')}</span>
              </div>
              {count > 0 && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: count >= 5 ? '#ef4444' : count >= 3 ? '#f59e0b' : '#22c55e' }} />}
            </button>
          )
        })}
      </div>}

      {(mobileCalView === 'week' || mobileCalView === 'workweek') && overdueTasks.length > 0 && activeTab === 'day' && rolloverMode === 'manual' && (
        <div style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', color: '#92400e' }}>{overdueTasks.length} overdue</span>
          <button onClick={onRollover} style={{ fontSize: '12px', color: '#d97706', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Roll over</button>
        </div>
      )}

      {(mobileCalView === 'week' || mobileCalView === 'workweek') && activeTab === 'day' && (
        <>
          <div style={{ padding: '10px 16px 4px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
              <span style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>{format(parseISO(selectedDay), 'EEEE, MMM d')}</span>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Tap, Drag, &amp; Drop</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={() => setReflectDay(selectedDay)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '2px 4px', color: '#9ca3af' }}
                title="Reflect on this day"
              >&#129488;</button>
              <button
                onClick={() => setShowVisionMission(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '2px 4px', color: '#9ca3af' }}
                title="Vision &amp; Mission"
              >&#11088;</button>
              <NotificationBell tasks={tasks} isMobile={true} />
            </div>
          </div>
          {(() => {
            const dayTasks = [...tasksForDay(parseISO(selectedDay)), ...dueCardsForDay(parseISO(selectedDay))]
            const dayDone = dayTasks.filter(t => t.status === 'done').length
            const dayPct = dayTasks.length > 0 ? Math.round((dayDone / dayTasks.length) * 100) : 0
            return (
              <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ flex: 1, height: '4px', background: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: dayPct + '%', background: '#6366f1', borderRadius: '2px' }} />
                  </div>
                  <span style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>{dayPct}%</span>
                </div>
                <p style={{ fontSize: '11px', color: '#d1d5db', margin: '2px 0 0' }}>{dayDone}/{dayTasks.length}</p>
              </div>
            )
          })()}
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '13px' }}>Loading</div>
          ) : (
            <MobileDayView date={parseISO(selectedDay)} tasks={tasksForDay(parseISO(selectedDay))} dueCards={dueCardsForDay(parseISO(selectedDay))} goalMap={goalMap} collabMap={collabMap} profileMap={profileMap} onMarkDone={onMarkDone} onRescheduleToTomorrow={onRescheduleToTomorrow} onMoveToInbox={onMoveToInbox} onDelete={onDelete} onEdit={onEdit} onDuplicate={onDuplicateTask} onAddTaskForBucket={onAddTaskForBucket} />
          )}
        </>
      )}

      {(mobileCalView === 'week' || mobileCalView === 'workweek') && activeTab === 'goals' && (
        <MobileGoalsBar goals={goals} goalTasks={goalTasks} allTasks={tasks} collabMap={collabMap} collaborations={collaborations} defaultCollaborationId={defaultCollaborationId} onAddGoal={onAddGoal} onEditGoal={onEditGoal} onDeleteGoal={onDeleteGoal} onDuplicateGoal={onDuplicateGoal} onPauseGoal={onPauseGoal} onMarkDone={onMarkDone} onDelete={onDelete} onCreateTask={onCreateTask} onEditTask={onEdit} />
      )}

      {(mobileCalView === 'week' || mobileCalView === 'workweek') && activeTab === 'inbox' && (
        <>
          <div style={{ padding: '10px 16px 0', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>&#128221; Task List <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 400 }}>{inboxTasks.filter(t => t.status !== 'done').length}</span></span>
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
          <div style={{ padding: '2px 16px 0', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>{inboxTasks.filter(t => t.status === 'done').length} of {inboxTasks.length} done</span>
          </div>
          <div style={{ padding: '0 16px 8px', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '9px', color: '#9ca3af', fontWeight: 500, lineHeight: 1 }}>Sort by</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <select value={taskSort} onChange={e => setTaskSort(e.target.value)} style={{ fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '5px 8px', outline: 'none' }}>
                  <option value="alpha">A-Z</option>
                  <option value="completed">Completed</option>
                  <option value="created">Date Created</option>
                  <option value="deadline">Deadline</option>
                  <option value="manual">Manual</option>
                  <option value="priority">Priority</option>
                </select>
                <button
                  onClick={() => setTaskSortDir(d => d * -1)}
                  style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '5px', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title={taskSortDir === 1 ? 'Reverse order' : 'Reversed — tap to restore'}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: taskSortDir === -1 ? 'scaleY(-1)' : 'none' }}>
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                </button>
              </div>
            </div>
            <select value={taskCategoryFilter} onChange={e => setTaskCategoryFilter(e.target.value)} style={{ fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '5px 8px', outline: 'none', maxWidth: '130px' }}>
              <option value="all">All categories</option>
              {taskCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <MobileInbox tasks={loading ? [] : inboxTasks} goalMap={goalMap} collabMap={collabMap} collabMembersMap={collabMembersMap} profileMap={profileMap} onAssignTask={onAssignTask} onMarkDone={onMarkDone} onAddTask={onAddTask} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicateTask} search={taskSearch} sortMode={taskSort} sortDir={taskSortDir} categoryFilter={taskCategoryFilter} />
        </>
      )}

      {(mobileCalView === 'week' || mobileCalView === 'workweek') && activeTab === 'assistant' && (
        <>
          <div style={{ padding: '10px 16px 6px', flexShrink: 0 }}>
            <span style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>&#129302; Assistant</span>
          </div>
          <MobileAssistant goals={goals} tasks={tasks} onCreateTask={onCreateTask} onAddGoal={onAddGoal} />
        </>
      )}

      {(mobileCalView === 'week' || mobileCalView === 'workweek') && activeTab === 'settings' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          <div style={{ padding: '4px 0 12px' }}>
            <span style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>&#9881; Settings</span>
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', marginBottom: '10px', background: 'white' }}>
            <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Overdue tasks</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[['manual', 'Manual — show "Roll over" button'], ['auto', 'Auto — roll over on app open']].map(([mode, label]) => (
                <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
                  <input type="radio" name="mobileRollover" checked={rolloverMode === mode} onChange={() => onRolloverModeChange(mode)} style={{ accentColor: '#6366f1' }} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <LocationAlertsSection tasks={tasks} />

          <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', marginBottom: '10px', background: 'white' }}>
            <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Export</p>
            <ExportMenu tasks={tasks} goals={goals} weekStart={weekDays[0]} isMobile />
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', marginBottom: '10px', background: 'white' }}>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 2px' }}>Signed in as</p>
            <p style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937', margin: 0 }}>{profile?.username}</p>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>{user?.email}</p>
          </div>

          {settingsMessage && <div style={{ fontSize: '13px', color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px' }}>{settingsMessage}</div>}
          {settingsError && <div style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px' }}>{settingsError}</div>}

          <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', marginBottom: '10px', background: 'white' }}>
            {settingsSection === 'username' ? (
              <form onSubmit={handleUsernameSubmit}>
                <input autoFocus type="text" required placeholder="New username" value={newUsername} onChange={e => setNewUsername(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '14px', marginBottom: '8px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" disabled={settingsSubmitting} style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px' }}>{settingsSubmitting ? 'Saving...' : 'Save'}</button>
                  <button type="button" onClick={() => { setSettingsSection(null); setSettingsError(null) }} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '13px' }}>Cancel</button>
                </div>
              </form>
            ) : (
              <button onClick={() => { setSettingsSection('username'); setNewUsername(profile?.username || ''); setSettingsError(null); setSettingsMessage(null) }} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', fontSize: '14px', color: '#1f2937', fontWeight: 500 }}>Change username</button>
            )}
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', marginBottom: '10px', background: 'white' }}>
            {settingsSection === 'email' ? (
              <form onSubmit={handleEmailSubmit}>
                <input autoFocus type="password" required placeholder="Current password" value={currentPasswordForEmail} onChange={e => setCurrentPasswordForEmail(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '16px', marginBottom: '8px' }} />
                <input type="email" required placeholder="New email address" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '16px', marginBottom: '8px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" disabled={settingsSubmitting} style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px' }}>{settingsSubmitting ? 'Saving...' : 'Save'}</button>
                  <button type="button" onClick={() => { setSettingsSection(null); setSettingsError(null) }} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '13px' }}>Cancel</button>
                </div>
              </form>
            ) : (
              <button onClick={() => { setSettingsSection('email'); setCurrentPasswordForEmail(''); setSettingsError(null); setSettingsMessage(null) }} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', fontSize: '14px', color: '#1f2937', fontWeight: 500 }}>Change email</button>
            )}
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', marginBottom: '10px', background: 'white' }}>
            {settingsSection === 'password' ? (
              <form onSubmit={handlePasswordSubmit}>
                <input autoFocus type="password" required placeholder="Current password" value={currentPasswordForPw} onChange={e => setCurrentPasswordForPw(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '16px', marginBottom: '8px' }} />
                <input type="password" required placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '16px', marginBottom: '8px' }} />
                <input type="password" required placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px', fontSize: '16px', marginBottom: '8px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" disabled={settingsSubmitting} style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px' }}>{settingsSubmitting ? 'Saving...' : 'Save'}</button>
                  <button type="button" onClick={() => { setSettingsSection(null); setSettingsError(null) }} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '13px' }}>Cancel</button>
                </div>
              </form>
            ) : (
              <button onClick={() => { setSettingsSection('password'); setCurrentPasswordForPw(''); setSettingsError(null); setSettingsMessage(null) }} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', fontSize: '14px', color: '#1f2937', fontWeight: 500 }}>Change password</button>
            )}
          </div>

          <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', marginBottom: '10px', background: 'white' }}>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 6px' }}>Viewing</p>
            <ViewSwitcher activeView={activeView} onChangeView={onChangeView} collaborations={collaborations || []} collabMap={collabMap || {}} fullWidth />
          </div>
          <button
            onClick={() => setShowCollab(true)}
            style={{ width: '100%', textAlign: 'left', background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', marginBottom: '10px', fontSize: '14px', color: '#1f2937', cursor: 'pointer', fontWeight: 500 }}
          >
            Collaborations
          </button>
          <button
            onClick={signOut}
            style={{ width: '100%', textAlign: 'left', background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', fontSize: '14px', color: '#ef4444', cursor: 'pointer', fontWeight: 500 }}
          >
            Sign out
          </button>
        </div>
      )}

      {showCollab && <CollaborationPanel onClose={() => setShowCollab(false)} />}

      {reflectDay && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={e => { if (e.target === e.currentTarget) setReflectDay(null) }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <DailyReflection isMobile={true} date={reflectDay} onClose={() => setReflectDay(null)} />
          </div>
        </div>
      )}

      {showDashboard && (
        <Dashboard
          tasks={tasks}
          goals={goals}
          goalTasks={goalTasks}
          collaborations={collaborations}
          collabMap={collabMap}
          collabMembersMap={collabMembersMap}
          profileMap={profileMap}
          weekStart={weekStart}
          onClose={() => setShowDashboard(false)}
          onEditGoal={onEditGoal}
          isMobile={true}
        />
      )}

      {showVisionMission && <VisionMission onClose={() => setShowVisionMission(false)} />}

      <div style={{ background: 'white', borderTop: '1px solid #e5e7eb', paddingTop: '6px', paddingBottom: '8px', display: 'flex', flexShrink: 0 }}>
        {[
          { id: 'day', label: 'Today', emoji: null },
          { id: 'goals', label: 'Goals', emoji: '🎯' },
          { id: 'inbox', label: 'Task List', emoji: '📝' },
          { id: 'dashboard', label: 'Dashboard', emoji: '📊' },
          { id: 'assistant', label: 'Assistant', emoji: '🤖' },
          { id: 'settings', label: 'Settings', emoji: '⚙️' }
        ].map(tab => (
          <button key={tab.id} onClick={() => { if (tab.id === 'dashboard') { setShowDashboard(true) } else { setActiveTab(tab.id); setMobileCalView('week') } }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', position: 'relative' }}>
            <div style={{ width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {tab.id === 'day' && (
                <svg width="22" height="20.7" viewBox="0 0 34 32">
                  <line x1="10" y1="0" x2="10" y2="7" stroke={activeTab === 'day' ? '#6366f1' : '#ef4444'} strokeWidth="2" strokeLinecap="round" />
                  <line x1="24" y1="0" x2="24" y2="7" stroke={activeTab === 'day' ? '#6366f1' : '#ef4444'} strokeWidth="2" strokeLinecap="round" />
                  <rect x="0" y="4" width="34" height="26" rx="4" fill="white" stroke={activeTab === 'day' ? '#6366f1' : '#d1d5db'} strokeWidth="1" />
                  <rect x="0" y="4" width="34" height="9" fill={activeTab === 'day' ? '#6366f1' : '#ef4444'} />
                  <text x="17" y="24" textAnchor="middle" fill={activeTab === 'day' ? '#4338ca' : '#374151'} fontSize="13" fontWeight="600">{new Date().getDate()}</text>
                </svg>
              )}
              {tab.emoji && (
                <span style={{ fontSize: '20px', lineHeight: 1 }}>{tab.emoji}</span>
              )}
            </div>
            <span style={{ fontSize: '10px', color: activeTab === tab.id ? '#6366f1' : '#6b7280', fontWeight: activeTab === tab.id ? 600 : 500 }}>{tab.label}</span>
          </button>
        ))}
      </div>
      <div style={{ background: 'white', flexShrink: 0, height: 'env(safe-area-inset-bottom)' }} />
    </div>
  )
}
