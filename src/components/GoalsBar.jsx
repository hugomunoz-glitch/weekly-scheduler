import { useState, useRef, useEffect } from 'react'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import { categoryBadge } from './TaskCard'

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

const GOAL_CATEGORIES = [
  'Career/Professional', 'Family', 'Financial', 'Intellectual',
  'Physical (Health/Wellness)', 'Relationships',
  'Social (Community/Volunteering)', 'Spiritual (Prayer/Church)'
]

const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#9ca3af' }
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }
const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' }
const PRIORITY_BORDER = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }

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

function goalStatus(goal, goalTasks) {
  if (goal.status === 'paused') return 'paused'
  const linked = goalTasks.filter(t => t.goal_id === goal.id)
  if (linked.length > 0 && linked.every(t => t.status === 'done')) return 'completed'
  if (linked.some(t => t.status === 'done')) return 'in_progress'
  return 'not_started'
}

const STATUS_BADGE = {
  in_progress: { label: 'In Progress', color: '#4338ca', bg: '#eef2ff', dot: '#6366f1' },
  paused:      { label: 'Paused',      color: '#b45309', bg: '#fffbeb', dot: '#f59e0b' },
  completed:   { label: 'Completed',   color: '#059669', bg: '#d1fae5', dot: '#10b981' },
  not_started: null,
}

export default function GoalsBar({ goals, goalTasks, allTasks, collabMap, collaborations, collabMembersMap, defaultCollaborationId, onAddGoal, onEditGoal, onDeleteGoal, onDuplicateGoal, onPauseGoal, onMarkDone, onDelete, onDuplicateTask, onCreateTask, onEditTask, activeView, onChangeView }) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newGoalTasks, setNewGoalTasks] = useState([''])
  const [newCategory, setNewCategory] = useState('')
  const [customCategory, setCustomCategory] = useState(false)
  const [newCategoryCustom, setNewCategoryCustom] = useState('')
  const [newPriority, setNewPriority] = useState('')
  const [newFamilyMember, setNewFamilyMember] = useState('')
  const [bulkGoalMode, setBulkGoalMode] = useState(false)
  const [bulkGoalTitles, setBulkGoalTitles] = useState('')
  const [bulkGoalSubmitting, setBulkGoalSubmitting] = useState(false)
  const [newGoalCollaborationId, setNewGoalCollaborationId] = useState(defaultCollaborationId || '')
  const [newGoalAssignee, setNewGoalAssignee] = useState('')
  const [newSoftDeadline, setNewSoftDeadline] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newTerm, setNewTerm] = useState('')
  const [showSmart, setShowSmart] = useState(false)
  const [smartSpecific, setSmartSpecific] = useState('')
  const [smartMeasurable, setSmartMeasurable] = useState('')
  const [smartAchievable, setSmartAchievable] = useState('')
  const [smartRelevant, setSmartRelevant] = useState('')
  const [smartTimebound, setSmartTimebound] = useState('')
  const [postDuplicateGoalId, setPostDuplicateGoalId] = useState(null)
  const [postDupTasks, setPostDupTasks] = useState([''])
  const [postDupPopupPos, setPostDupPopupPos] = useState(null)
  const [postDupGoalTitle, setPostDupGoalTitle] = useState('')
  const [postDupSaving, setPostDupSaving] = useState(false)
  const [inlineCategoryGoalId, setInlineCategoryGoalId] = useState(null)
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
  // localStorage-backed term map so long/short-term sort works even before DB column exists
  const [localTerms, setLocalTerms] = useState(() => { try { return JSON.parse(localStorage.getItem('goal_terms') || '{}') } catch { return {} } })
  function saveLocalTerm(goalId, term) {
    setLocalTerms(prev => {
      const next = { ...prev, [goalId]: term || null }
      try { localStorage.setItem('goal_terms', JSON.stringify(next)) } catch {}
      return next
    })
  }
  const allCategories = [...new Set([...GOAL_CATEGORIES, ...goals.map(g => g.category).filter(Boolean)])].sort()
  const [popupPos, setPopupPos] = useState(null)
  const dragRef = useRef(null)

  function openPopup(goalId, e) {
    setViewingGoalId(goalId)
    setAddTaskToGoalError('')
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

  const completedGoalsCount = goals.filter(g => {
    const linked = goalTasks.filter(t => t.goal_id === g.id)
    return linked.length > 0 && linked.every(t => t.status === 'done')
  }).length

  // Merge localStorage terms into goals so sort-by-term works regardless of DB schema
  const goalsWithTerm = goals.map(g => ({ ...g, term: g.term || localTerms[g.id] || null }))
  let visibleGoals = goalSearch.trim() ? goalsWithTerm.filter(g => g.title.toLowerCase().includes(goalSearch.trim().toLowerCase())) : goalsWithTerm
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
  // Partition: fully completed goals go to bottom
  const [activeGoals, completedGoalsPartition] = visibleGoals.reduce(([a, c], g) => {
    const linked = goalTasks.filter(t => t.goal_id === g.id)
    const isFullyDone = linked.length > 0 && linked.every(t => t.status === 'done')
    return isFullyDone ? [a, [...c, g]] : [[...a, g], c]
  }, [[], []])
  visibleGoals = [...activeGoals, ...completedGoalsPartition]

  function handleEditTask(taskId) {
    const full = (allTasks || []).find(t => t.id === taskId)
    if (full) { onEditTask(full) }
  }

  const [addTaskToGoalError, setAddTaskToGoalError] = useState('')
  const [addingTaskToGoal, setAddingTaskToGoal] = useState(false)
  const [bulkPopupMode, setBulkPopupMode] = useState(false)
  const [bulkPopupText, setBulkPopupText] = useState('')

  async function handleAddTaskToGoal(e, goalId) {
    e.preventDefault()
    const goal = goals.find(g => g.id === goalId)
    setAddingTaskToGoal(true)
    setAddTaskToGoalError('')
    try {
      if (bulkPopupMode) {
        const titles = bulkPopupText.split('\n').map(l => l.trim()).filter(Boolean)
        for (const title of titles) {
          await onCreateTask(title, '', goalId, null, null, null, null, null, goal?.collaboration_id || null)
        }
        setBulkPopupText('')
        setBulkPopupMode(false)
      } else {
        if (!newTaskTitle.trim()) return
        await onCreateTask(newTaskTitle.trim(), '', goalId, null, null, null, null, null, goal?.collaboration_id || null)
        setNewTaskTitle('')
      }
    } catch (err) {
      setAddTaskToGoalError('Couldn\'t save task: ' + (err?.message || 'unknown error'))
    } finally {
      setAddingTaskToGoal(false)
    }
  }

  const [addGoalError, setAddGoalError] = useState('')

  async function handleAdd(e, keepOpen) {
    e.preventDefault()
    if (!newTitle.trim()) return
    const color = COLORS[goals.length % COLORS.length]
    try {
      const savedGoal = await onAddGoal(newTitle.trim(), color, {
        category: (customCategory ? newCategoryCustom.trim() : newCategory) || null,
        priority: newPriority || null,
        familyMember: newCategory === 'Family' ? newFamilyMember.trim() || null : null,
        smartSpecific: smartSpecific.trim() || null,
        smartMeasurable: smartMeasurable.trim() || null,
        smartAchievable: smartAchievable.trim() || null,
        smartRelevant: smartRelevant.trim() || null,
        smartTimebound: smartTimebound.trim() || null,
        softDeadline: newSoftDeadline || null,
        goalDueDate: newDueDate || null,
        term: newTerm || null,
        assigneeId: newGoalAssignee || null
      }, newGoalCollaborationId || null)
      setAddGoalError('')
      if (savedGoal?.id && newTerm) saveLocalTerm(savedGoal.id, newTerm)
      // Create any initial tasks the user entered
      const taskTitles = newGoalTasks.map(t => t.trim()).filter(Boolean)
      for (const title of taskTitles) {
        try { await onCreateTask(title, '', savedGoal?.id, null, null, null, null, null, newGoalCollaborationId || null) } catch {}
      }
      if (keepOpen) {
        setNewTitle('')
        setNewGoalTasks([''])
      } else {
        setNewTitle(''); setNewCategory(''); setNewPriority(''); setCustomCategory(false); setNewCategoryCustom(''); setNewFamilyMember('')
        setSmartSpecific(''); setSmartMeasurable(''); setSmartAchievable(''); setSmartRelevant(''); setSmartTimebound('')
        setNewSoftDeadline(''); setNewDueDate(''); setNewTerm(''); setNewGoalAssignee('')
        setNewGoalCollaborationId(defaultCollaborationId || '')
        setShowSmart(false)
        setNewGoalTasks([''])
        setAdding(false)
      }
    } catch {
      setAddGoalError('Could not save. Check the category isn\'t blocked by an old rule, then try again.')
    }
  }

  async function handleBulkGoalSubmit(e) {
    e.preventDefault()
    const lines = bulkGoalTitles.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    setBulkGoalSubmitting(true)
    try {
      for (const line of lines) {
        const color = COLORS[goals.length % COLORS.length]
        await onAddGoal(line, color, {
          category: (customCategory ? newCategoryCustom.trim() : newCategory) || null,
          priority: newPriority || null,
          familyMember: newCategory === 'Family' ? newFamilyMember.trim() || null : null
        }, newGoalCollaborationId || null)
      }
      setBulkGoalTitles('')
      setBulkGoalMode(false)
      setNewCategory(''); setNewPriority(''); setCustomCategory(false); setNewCategoryCustom(''); setNewFamilyMember('')
      setNewGoalCollaborationId(defaultCollaborationId || '')
      setAdding(false)
      setAddGoalError('')
    } catch {
      setAddGoalError('Could not save one or more goals. Try again.')
    } finally {
      setBulkGoalSubmitting(false)
    }
  }

  const bulkGoalCount = bulkGoalTitles.split('\n').map(l => l.trim()).filter(Boolean).length

  const [editingAssigneeId, setEditingAssigneeId] = useState('')
  const [editSoftDeadline, setEditSoftDeadline] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editingTerm, setEditingTerm] = useState('')
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
    setEditFamilyMember(goal.family_member || '')
    setEditSmartSpecific(goal.smart_specific || '')
    setEditSmartMeasurable(goal.smart_measurable || '')
    setEditSmartAchievable(goal.smart_achievable || '')
    setEditSmartRelevant(goal.smart_relevant || '')
    setEditSmartTimebound(goal.smart_timebound || '')
    setEditShowSmart(!!(goal.smart_specific || goal.smart_measurable || goal.smart_achievable || goal.smart_relevant || goal.smart_timebound))
    setEditSoftDeadline(goal.soft_deadline || '')
    setEditDueDate(goal.due_date || '')
    setEditingTerm(goal.term || '')
    setEditingAssigneeId(goal.assigned_to || '')
    setEditError('')
  }

  async function handleEditSubmit(e, goalId) {
    e.preventDefault()
    if (!editingTitle.trim()) return
    try {
      const category = editingCustomCategory ? editingCategoryCustom.trim() : editingCategory
      await onEditGoal(goalId, editingTitle.trim(), {
        category: category || null,
        priority: editingPriority || null,
        familyMember: category === 'Family' ? editFamilyMember.trim() || null : null,
        smartSpecific: editSmartSpecific.trim() || null,
        smartMeasurable: editSmartMeasurable.trim() || null,
        smartAchievable: editSmartAchievable.trim() || null,
        smartRelevant: editSmartRelevant.trim() || null,
        smartTimebound: editSmartTimebound.trim() || null,
        softDeadline: editSoftDeadline || null,
        goalDueDate: editDueDate || null,
        term: editingTerm || null,
        assigneeId: editingAssigneeId || null
      }, editingCollaborationId || null)
      saveLocalTerm(goalId, editingTerm)
      setEditingId(null)
    } catch {
      setEditError('Could not save. Try again.')
    }
  }

  return (
    <div className="bg-white px-6 pt-4 pb-2 shrink-0">
      <div className="flex items-start gap-3 overflow-x-auto">
      <div className="sticky left-0 z-10 bg-white self-stretch flex items-center gap-3 pr-3 shrink-0">
        <div className="flex flex-col gap-1 shrink-0">
          <span className="text-sm font-semibold text-gray-900 tracking-wide flex items-center gap-1">
            <span style={{ fontSize: 14, lineHeight: 1 }}>🎯</span>
            Goals
          </span>
          <span className="text-[11px] text-gray-400">{completedGoalsCount} of {goals.length} done</span>
          {onChangeView && (
            <div className="flex flex-col gap-1 mt-0.5">
              <div className="flex items-center p-0.5 rounded-lg bg-gray-100 text-[10px] font-medium">
                {[['all', 'All'], ['personal', 'Personal'], ...(collaborations && collaborations.length > 0 ? [['collab', 'Collabs']] : [])].map(([v, label]) => {
                  const isCollabActive = v === 'collab' && activeView !== 'all' && activeView !== 'personal'
                  const isActive = v === 'collab' ? isCollabActive : activeView === v
                  return (
                    <button
                      key={v}
                      onClick={() => onChangeView(v === 'collab' ? (collaborations[0]?.id || 'all') : v)}
                      className={'px-2 py-0.5 rounded-md transition-all ' + (isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              {activeView !== 'all' && activeView !== 'personal' && collaborations && collaborations.length > 1 && (
                <select
                  value={activeView}
                  onChange={e => onChangeView(e.target.value)}
                  className="text-[10px] border border-gray-200 rounded-lg px-1.5 py-0.5 bg-white focus:outline-none focus:border-indigo-400"
                >
                  {collaborations.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
          )}
        </div>
        {adding ? (
          <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50 shrink-0 w-72">
            <div className="flex justify-end -mb-1">
              <button type="button" onClick={() => setBulkGoalMode(m => !m)} className="text-xs text-indigo-500 hover:text-indigo-700">
                {bulkGoalMode ? 'Switch to single goal' : 'Add multiple goals at once'}
              </button>
            </div>
            <form onSubmit={bulkGoalMode ? handleBulkGoalSubmit : (e) => handleAdd(e, false)} className="space-y-2">
              {bulkGoalMode ? (
                <textarea
                  autoFocus
                  placeholder={'One goal per line, e.g.\nRun a 5K\nRead 12 books\nSave $5,000'}
                  value={bulkGoalTitles}
                  onChange={e => setBulkGoalTitles(e.target.value)}
                  rows={4}
                  className="w-full border border-indigo-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-none"
                />
              ) : (
                <input
                  autoFocus
                  type="text"
                  placeholder="Goal name"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full border border-indigo-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
              )}
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
              {newCategory === 'Family' && (
                <input
                  type="text"
                  placeholder="Who's this about?"
                  value={newFamilyMember}
                  onChange={e => setNewFamilyMember(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
              )}
              {collaborations && collaborations.length > 0 && (
                <select value={newGoalCollaborationId} onChange={e => { setNewGoalCollaborationId(e.target.value); setNewGoalAssignee('') }} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300">
                  <option value="">Save to: Personal</option>
                  {collaborations.map(c => <option key={c.id} value={c.id}>Save to: {c.name}</option>)}
                </select>
              )}
              {newGoalCollaborationId && collabMembersMap && collabMembersMap[newGoalCollaborationId] && collabMembersMap[newGoalCollaborationId].length > 0 && (
                <select value={newGoalAssignee} onChange={e => setNewGoalAssignee(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300">
                  <option value="">Assign to: Unassigned</option>
                  {collabMembersMap[newGoalCollaborationId].map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                </select>
              )}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-400 mb-0.5">Soft deadline</label>
                  <input type="date" value={newSoftDeadline} onChange={e => setNewSoftDeadline(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-400 mb-0.5">Due date</label>
                  <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                </div>
              </div>
              <div className="flex gap-1">
                {[['', '—'], ['long', 'Long-term'], ['short', 'Short-term']].map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setNewTerm(val)}
                    className={'text-[10px] px-2 py-1 rounded border transition-colors ' + (newTerm === val ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500 hover:border-indigo-300')}>
                    {label}
                  </button>
                ))}
              </div>
              {!bulkGoalMode && (
                <div className="space-y-1.5 pt-1 border-t border-gray-200">
                  <p className="text-xs font-medium text-gray-500">Tasks (optional)</p>
                  {newGoalTasks.map((t, i) => (
                    <div key={i} className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        placeholder={i === 0 ? 'First task…' : 'Another task…'}
                        value={t}
                        onChange={e => setNewGoalTasks(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      />
                      {newGoalTasks.length > 1 && (
                        <button type="button" onClick={() => setNewGoalTasks(prev => prev.filter((_, j) => j !== i))}
                          className="text-gray-300 hover:text-red-400 text-sm leading-none">×</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setNewGoalTasks(prev => [...prev, ''])}
                    className="text-xs text-indigo-500 hover:text-indigo-700">+ Add another task</button>
                </div>
              )}
              {!bulkGoalMode && (!showSmart ? (
                <button type="button" onClick={() => setShowSmart(true)} className="text-xs text-indigo-500 hover:text-indigo-700">+ Make it a SMART goal (optional)</button>
              ) : (
                <div className="space-y-1.5 pt-1 border-t border-gray-200">
                  <input type="text" placeholder="Specific: what & why?" value={smartSpecific} onChange={e => setSmartSpecific(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                  <input type="text" placeholder="Measurable: how will you know?" value={smartMeasurable} onChange={e => setSmartMeasurable(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                  <input type="text" placeholder="Achievable: realistic?" value={smartAchievable} onChange={e => setSmartAchievable(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                  <input type="text" placeholder="Relevant: why does it matter?" value={smartRelevant} onChange={e => setSmartRelevant(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                  <input type="text" placeholder="Time-bound: target deadline?" value={smartTimebound} onChange={e => setSmartTimebound(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                </div>
              ))}
              <div className="flex gap-2">
                {bulkGoalMode ? (
                  <button type="submit" disabled={bulkGoalCount === 0 || bulkGoalSubmitting} className="text-sm text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    {bulkGoalSubmitting ? 'Adding...' : bulkGoalCount > 0 ? 'Add ' + bulkGoalCount + ' goals' : 'Add goals'}
                  </button>
                ) : (
                  <button type="submit" className="text-sm text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700">Add</button>
                )}
                <button type="button" onClick={() => { setAdding(false); setShowSmart(false); setBulkGoalMode(false) }} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
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
        const isFullyCompleted = linked.length > 0 && linked.every(t => t.status === 'done')
        const status = goalStatus(goal, goalTasks)
        const statusBadge = STATUS_BADGE[status]
        const goalDisplayColor = (goal.category ? categoryBadge(goal.category)?.color : null) || goal.color
        return (
          <div
            key={goal.id}
            className={'flex items-start gap-2 border rounded-lg px-3 py-1.5 shrink-0 min-w-[160px] group cursor-pointer relative ' + (isFullyCompleted ? 'border-emerald-100 bg-white' : status === 'paused' ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white')}
            style={goal.priority && PRIORITY_BORDER[goal.priority] ? { borderLeft: '4px solid ' + PRIORITY_BORDER[goal.priority] } : undefined}
            title={goal.priority ? PRIORITY_LABELS[goal.priority] + ' priority' : undefined}
            onClick={(e) => openPopup(goal.id, e)}
          >
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
                  {editingCategory === 'Family' && (
                    <input
                      type="text"
                      placeholder="Who's this about?"
                      value={editFamilyMember}
                      onChange={e => setEditFamilyMember(e.target.value)}
                      className="text-xs border border-gray-200 rounded px-1.5 py-1 w-full focus:outline-none"
                    />
                  )}
                  {collaborations && collaborations.length > 0 && (
                    <select value={editingCollaborationId} onChange={e => { setEditingCollaborationId(e.target.value); setEditingAssigneeId('') }} className="text-xs border border-gray-200 rounded px-1 py-0.5 w-full focus:outline-none">
                      <option value="">Save to: Personal</option>
                      {collaborations.map(c => <option key={c.id} value={c.id}>Save to: {c.name}</option>)}
                    </select>
                  )}
                  {editingCollaborationId && collabMembersMap && collabMembersMap[editingCollaborationId] && collabMembersMap[editingCollaborationId].length > 0 && (
                    <select value={editingAssigneeId} onChange={e => setEditingAssigneeId(e.target.value)} className="text-xs border border-gray-200 rounded px-1 py-0.5 w-full focus:outline-none">
                      <option value="">Assign to: Unassigned</option>
                      {collabMembersMap[editingCollaborationId].map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                    </select>
                  )}
                  <div className="flex gap-1.5">
                    <div className="flex-1">
                      <label className="block text-[10px] text-gray-400 mb-0.5">Soft deadline</label>
                      <input type="date" value={editSoftDeadline} onChange={e => setEditSoftDeadline(e.target.value)} className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] text-gray-400 mb-0.5">Due date</label>
                      <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none" />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[['', '—'], ['long', 'Long-term'], ['short', 'Short-term']].map(([val, label]) => (
                      <button key={val} type="button" onClick={() => setEditingTerm(val)}
                        className={'text-[10px] px-2 py-0.5 rounded border transition-colors ' + (editingTerm === val ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500 hover:border-indigo-300')}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {!editShowSmart ? (
                    <button type="button" onClick={() => setEditShowSmart(true)} className="text-xs text-indigo-500 hover:text-indigo-700 text-left">+ Make it a SMART goal (optional)</button>
                  ) : (
                    <div className="space-y-1.5 pt-1 border-t border-gray-200">
                      <input type="text" placeholder="Specific: what & why?" value={editSmartSpecific} onChange={e => setEditSmartSpecific(e.target.value)} className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none" />
                      <input type="text" placeholder="Measurable: how will you know?" value={editSmartMeasurable} onChange={e => setEditSmartMeasurable(e.target.value)} className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none" />
                      <input type="text" placeholder="Achievable: realistic?" value={editSmartAchievable} onChange={e => setEditSmartAchievable(e.target.value)} className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none" />
                      <input type="text" placeholder="Relevant: why does it matter?" value={editSmartRelevant} onChange={e => setEditSmartRelevant(e.target.value)} className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none" />
                      <input type="text" placeholder="Time-bound: target deadline?" value={editSmartTimebound} onChange={e => setEditSmartTimebound(e.target.value)} className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none" />
                    </div>
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
                    className={'text-sm font-medium truncate cursor-pointer hover:text-indigo-600 ' + (isFullyCompleted ? 'line-through text-gray-400' : 'text-gray-700')}
                    onClick={(e) => { e.stopPropagation(); startEdit(goal) }}
                    title="Click to edit"
                  >
                    {goal.title}
                    {goal.collaboration_id && collabMap && collabMap[goal.collaboration_id] && (
                      <span
                        className="inline-block w-2 h-2 rounded-full ml-1.5 align-middle"
                        style={{ background: collabMap[goal.collaboration_id].color }}
                        title={'Shared with: ' + collabMap[goal.collaboration_id].name}
                      />
                    )}
                  </p>
                </div>
              )}
              {inlineCategoryGoalId === goal.id ? (
                <select
                  autoFocus
                  value={goal.category || ''}
                  onClick={e => e.stopPropagation()}
                  onChange={async e => {
                    e.stopPropagation()
                    await onEditGoal(goal.id, goal.title, { ...goal, category: e.target.value || null }, goal.collaboration_id || null)
                    setInlineCategoryGoalId(null)
                  }}
                  onBlur={() => setInlineCategoryGoalId(null)}
                  className="text-[10px] border border-indigo-300 rounded px-1 py-0.5 w-full focus:outline-none mt-0.5"
                >
                  <option value="">No category</option>
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : categoryBadge(goal.category) ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded cursor-pointer hover:opacity-75"
                    style={{ color: categoryBadge(goal.category).color, background: categoryBadge(goal.category).color + '1a' }}
                    onClick={e => { e.stopPropagation(); setInlineCategoryGoalId(goal.id) }}
                    title="Click to change category"
                  >
                    {categoryBadge(goal.category).name}
                  </span>
                </div>
              ) : editingId !== goal.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(goal) }}
                  className="mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded border border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
                  title="Add category"
                >
                  + Category
                </button>
              )}
              {goal.term && (
                <span className={'text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 inline-block ' + (goal.term === 'long' ? 'bg-violet-50 text-violet-600' : 'bg-sky-50 text-sky-600')}>
                  {goal.term === 'long' ? 'Long-term' : 'Short-term'}
                </span>
              )}
              {statusBadge && (
                <div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 inline-flex items-center gap-1" style={{ color: statusBadge.color, background: statusBadge.bg }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusBadge.dot, display: 'inline-block', flexShrink: 0 }} />
                    {statusBadge.label}
                  </span>
                </div>
              )}
              {isFullyCompleted ? (
                <div className="mt-1">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">✓ Complete — All tasks done</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: pct + '%', background: goalDisplayColor }} />
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{pct}%</span>
                </div>
              )}
              {!isFullyCompleted && <p className="text-xs text-gray-300 mt-0.5">{done.length}/{linked.length}</p>}
              {(goal.soft_deadline || goal.due_date) && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {goal.soft_deadline && <span>Aim: {goal.soft_deadline.slice(5).replace('-', '/')}</span>}
                  {goal.soft_deadline && goal.due_date && ' · '}
                  {goal.due_date && <span className="text-amber-500">Due: {goal.due_date.slice(5).replace('-', '/')}</span>}
                </p>
              )}
              {editingId !== goal.id && (
                <div
                  className="flex flex-wrap items-center gap-2 mt-2 pt-1.5 border-t border-gray-100 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => startEdit(goal)}
                    className="text-[27px] text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors leading-none"
                    title="Edit goal"
                  >&#9998;</button>
                  {onDuplicateGoal && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        const newGoal = await onDuplicateGoal(goal.id)
                        if (newGoal) {
                          setPostDuplicateGoalId(newGoal.id)
                          setPostDupGoalTitle(newGoal.title)
                          setPostDupTasks([''])
                          const rect = e.currentTarget.getBoundingClientRect()
                          setPostDupPopupPos({ top: Math.min(rect.bottom + 8, window.innerHeight - 300), left: Math.min(Math.max(rect.left, 12), window.innerWidth - 420) })
                        }
                      }}
                      className="text-[20px] text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors leading-none"
                      title="Duplicate goal"
                    >&#10697;</button>
                  )}
                  {!isFullyCompleted && onPauseGoal && (
                    status === 'paused' ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); onPauseGoal(goal.id, false) }}
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-colors"
                        style={{ color: '#4338ca', background: '#eef2ff', borderColor: '#c7d2fe' }}
                        title="Resume goal"
                      >▶ Resume</button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); onPauseGoal(goal.id, true) }}
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-colors"
                        style={{ color: '#b45309', background: '#fffbeb', borderColor: '#fde68a' }}
                        title="Pause goal"
                      >⏸ Pause</button>
                    )
                  )}
                  {isFullyCompleted && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openPopup(goal.id, e) }}
                      className="text-xs text-indigo-500 hover:text-indigo-700 px-1.5 py-0.5 rounded transition-colors"
                      title="Add tasks to revive goal"
                    >+ Tasks</button>
                  )}
                  <button
                    onClick={() => onDeleteGoal(goal.id)}
                    className="text-base text-red-400 hover:text-red-600 px-1 py-0.5 rounded transition-colors ml-auto"
                    title="Delete goal"
                  >&#128465;</button>
                </div>
              )}
              {viewingGoalId === goal.id && popupPos && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="fixed z-40 bg-white border border-gray-200 rounded-lg shadow-2xl w-[580px] max-w-[92vw]"
                  style={{ top: popupPos.top, left: popupPos.left, borderLeft: goal.priority && PRIORITY_BORDER[goal.priority] ? '4px solid ' + PRIORITY_BORDER[goal.priority] : undefined }}
                  title={goal.priority ? PRIORITY_LABELS[goal.priority] + ' priority' : undefined}
                >
                  <div
                    onMouseDown={startPopupDrag}
                    className="flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-100 rounded-t-lg bg-gray-50 cursor-move select-none"
                    title="Drag to move"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-400 text-sm">&#10021;</span>
                      <p className="text-3xl font-bold text-gray-800 truncate">{goal.title}</p>
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
                    {categoryBadge(goal.category) && (
                      <span
                        className="inline-block text-sm font-medium px-2 py-1 rounded mb-3"
                        style={{ color: categoryBadge(goal.category).color, background: categoryBadge(goal.category).color + '1a' }}
                      >
                        {categoryBadge(goal.category).name}
                      </span>
                    )}
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
                                      style={{ ...dragProvided.draggableProps.style, ...(t.priority && PRIORITY_BORDER[t.priority] ? { borderLeft: '4px solid ' + PRIORITY_BORDER[t.priority] } : {}) }}
                                      title={t.priority ? PRIORITY_LABELS[t.priority] + ' priority' : undefined}
                                    >
                                      <span className="cursor-pointer shrink-0" onClick={() => onMarkDone(t.id)}>
                                        <span className={t.status === 'done' ? 'text-green-500' : 'text-gray-300'}>{t.status === 'done' ? '✓' : '○'}</span>
                                      </span>
                                      <span className={'flex-1 truncate cursor-pointer ' + (t.status === 'done' ? 'line-through text-gray-400' : '')} onClick={() => handleEditTask(t.id)}>{t.title}</span>
                                      {t.collaboration_id && collabMap && collabMap[t.collaboration_id] && (
                                        <span
                                          className="inline-block w-2 h-2 rounded-full shrink-0"
                                          style={{ background: collabMap[t.collaboration_id].color }}
                                          title={'Shared with: ' + collabMap[t.collaboration_id].name}
                                        />
                                      )}
                                      {t.start_time && (
                                        <span className="text-sm text-indigo-400 shrink-0 whitespace-nowrap">{formatTime(t.start_time)}</span>
                                      )}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleEditTask(t.id) }}
                                        className="text-[18px] text-gray-400 hover:text-indigo-600 transition-colors shrink-0 leading-none px-0.5"
                                        title="Edit task"
                                      >
                                        &#9998;
                                      </button>
                                      {onDuplicateTask && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); onDuplicateTask(t.id) }}
                                          className="text-[14px] text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 leading-none px-0.5"
                                          title="Duplicate task"
                                        >
                                          &#10697;
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(t.id, e) }}
                                        className="text-base text-red-400 hover:text-red-600 transition-colors shrink-0 px-0.5 leading-none"
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
                    <form onSubmit={(e) => handleAddTaskToGoal(e, goal.id)} className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-gray-500">Add task</p>
                        <button type="button" onClick={() => { setBulkPopupMode(m => !m); setNewTaskTitle(''); setBulkPopupText('') }}
                          className="text-xs text-indigo-500 hover:text-indigo-700">
                          {bulkPopupMode ? 'Single task' : 'Add multiple at once'}
                        </button>
                      </div>
                      {bulkPopupMode ? (
                        <textarea
                          autoFocus
                          placeholder={'One task per line, e.g.\nDraft outline\nReview notes\nSend follow-up'}
                          value={bulkPopupText}
                          onChange={e => setBulkPopupText(e.target.value)}
                          rows={3}
                          disabled={addingTaskToGoal}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-none disabled:opacity-50"
                        />
                      ) : (
                        <input
                          autoFocus
                          value={newTaskTitle}
                          onChange={e => setNewTaskTitle(e.target.value)}
                          placeholder="Task title…"
                          disabled={addingTaskToGoal}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 disabled:opacity-50"
                        />
                      )}
                      <button type="submit"
                        disabled={addingTaskToGoal || (bulkPopupMode ? !bulkPopupText.trim() : !newTaskTitle.trim())}
                        className="w-full text-sm text-white bg-indigo-600 hover:bg-indigo-700 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed font-medium">
                        {addingTaskToGoal ? 'Adding…' : bulkPopupMode ? 'Add tasks' : 'Add task'}
                      </button>
                    </form>
                    {addTaskToGoalError && <p className="text-xs text-red-500 mt-1.5">{addTaskToGoalError}</p>}
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
      {/* Post-duplicate add-tasks popup */}
      {postDuplicateGoalId && postDupPopupPos && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-2xl w-[380px] max-w-[92vw] p-4"
          style={{ top: postDupPopupPos.top, left: postDupPopupPos.left }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-800">Add tasks to &ldquo;{postDupGoalTitle}&rdquo;</p>
            <button onClick={() => { setPostDuplicateGoalId(null); setPostDupPopupPos(null) }} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
          </div>
          <div className="space-y-1.5">
            {postDupTasks.map((t, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <input
                  type="text"
                  placeholder={i === 0 ? 'First task…' : 'Another task…'}
                  value={t}
                  onChange={e => setPostDupTasks(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  autoFocus={i === 0}
                />
                {postDupTasks.length > 1 && (
                  <button type="button" onClick={() => setPostDupTasks(prev => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400 text-sm leading-none">×</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setPostDupTasks(prev => [...prev, ''])} className="text-xs text-indigo-500 hover:text-indigo-700">+ Add another</button>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              disabled={postDupSaving}
              onClick={async () => {
                const titles = postDupTasks.map(t => t.trim()).filter(Boolean)
                if (titles.length === 0) { setPostDuplicateGoalId(null); setPostDupPopupPos(null); return }
                setPostDupSaving(true)
                const goal = goals.find(g => g.id === postDuplicateGoalId)
                try {
                  for (const title of titles) {
                    await onCreateTask(title, '', postDuplicateGoalId, null, null, null, null, null, goal?.collaboration_id || null)
                  }
                } catch {}
                setPostDupSaving(false)
                setPostDuplicateGoalId(null)
                setPostDupPopupPos(null)
              }}
              className="flex-1 text-sm text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg disabled:opacity-40"
            >
              {postDupSaving ? 'Saving…' : 'Save tasks'}
            </button>
            <button type="button" onClick={() => { setPostDuplicateGoalId(null); setPostDupPopupPos(null) }} className="text-sm text-gray-400 hover:text-gray-600 px-2">Skip</button>
          </div>
        </div>
      )}
    </div>
  )
}
