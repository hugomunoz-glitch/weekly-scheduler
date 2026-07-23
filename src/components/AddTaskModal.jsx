import { useState, useEffect, useRef } from 'react'
import { resetViewportZoom } from '../lib/resetZoom'

const GOAL_CATEGORIES = [
  'Career/Professional', 'Financial', 'Intellectual',
  'Physical (Health/Wellness)', 'Relationships',
  'Social (Community/Volunteering)', 'Spiritual (Prayer/Church)'
]

export default function AddTaskModal({ onAdd, onEdit, onClose, goals, editingTask, onAddGoal, initialScheduledDate, initialStartTime, initialBucket, existingTaskCategories, collaborations, collabMembersMap, defaultCollaborationId, onCreateFollowUp, followUpPrefill }) {
  function closeModal() {
    resetViewportZoom()
    onClose()
  }
  const [collaborationId, setCollaborationId] = useState(editingTask ? (editingTask.collaboration_id || '') : (followUpPrefill?.collaborationId || defaultCollaborationId || ''))
  const [assignedTo, setAssignedTo] = useState(editingTask ? (editingTask.assigned_to || '') : '')
  const [title, setTitle] = useState(editingTask ? editingTask.title : (followUpPrefill?.title || ''))
  const [notes, setNotes] = useState(editingTask ? (editingTask.notes || '') : '')
  const [goalId, setGoalId] = useState(editingTask ? (editingTask.goal_id || '') : (followUpPrefill?.goalId || ''))
  const [startTime, setStartTime] = useState(editingTask ? (editingTask.start_time || '') : (initialStartTime || ''))
  const [dueDate, setDueDate] = useState(editingTask ? (editingTask.due_date || '') : '')
  const [scheduledDate, setScheduledDate] = useState(editingTask ? (editingTask.scheduled_date || '') : (initialScheduledDate || ''))
  const [priority, setPriority] = useState(editingTask ? (editingTask.priority || '') : (followUpPrefill?.priority || ''))
  const allTaskCategories = [...new Set([...GOAL_CATEGORIES, ...(existingTaskCategories || [])])].sort()
  const initialCategory = editingTask ? editingTask.category : followUpPrefill?.category
  const [taskCategory, setTaskCategory] = useState(initialCategory && !allTaskCategories.includes(initialCategory) ? '' : (initialCategory || ''))
  const [customTaskCategory, setCustomTaskCategory] = useState(!!(initialCategory && !allTaskCategories.includes(initialCategory)))
  const [taskCategoryCustom, setTaskCategoryCustom] = useState(initialCategory && !allTaskCategories.includes(initialCategory) ? initialCategory : '')
  const [addingGoal, setAddingGoal] = useState(false)
  const [newGoalTitle, setNewGoalTitle] = useState('')
  const [showGoalDetails, setShowGoalDetails] = useState(false)
  const [newGoalError, setNewGoalError] = useState('')
  const [newGoalCategory, setNewGoalCategory] = useState('')
  const [customCategory, setCustomCategory] = useState(false)
  const [newGoalCategoryCustom, setNewGoalCategoryCustom] = useState('')
  const [newGoalPriority, setNewGoalPriority] = useState('')
  const [smartSpecific, setSmartSpecific] = useState('')
  const [smartMeasurable, setSmartMeasurable] = useState('')
  const [smartAchievable, setSmartAchievable] = useState('')
  const [smartRelevant, setSmartRelevant] = useState('')
  const [smartTimebound, setSmartTimebound] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkTitles, setBulkTitles] = useState('')
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleAddNewGoal() {
    if (!newGoalTitle.trim()) return
    const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4']
    try {
      const created = await onAddGoal(newGoalTitle.trim(), colors[(goals || []).length % colors.length], {
        category: (customCategory ? newGoalCategoryCustom.trim() : newGoalCategory) || null,
        priority: newGoalPriority || null,
        smartSpecific: smartSpecific.trim() || null,
        smartMeasurable: smartMeasurable.trim() || null,
        smartAchievable: smartAchievable.trim() || null,
        smartRelevant: smartRelevant.trim() || null,
        smartTimebound: smartTimebound.trim() || null
      })
      if (created) setGoalId(created.id)
      setNewGoalTitle('')
      setNewGoalCategory('')
      setCustomCategory(false)
      setNewGoalCategoryCustom('')
      setNewGoalPriority('')
      setSmartSpecific(''); setSmartMeasurable(''); setSmartAchievable(''); setSmartRelevant(''); setSmartTimebound('')
      setShowGoalDetails(false)
      setAddingGoal(false)
      setNewGoalError('')
    } catch {
      setNewGoalError('Could not save. Try again.')
    }
  }

  async function handleSubmitCore(e, keepOpen) {
    e.preventDefault()
    if (!title.trim()) return
    const category = (customTaskCategory ? taskCategoryCustom.trim() : taskCategory) || null
    setSubmitError('')
    setSubmitting(true)
    try {
      if (editingTask) {
        await onEdit(editingTask.id, title.trim(), notes.trim(), goalId || null, startTime || null, dueDate || null, scheduledDate || null, priority || null, category, collaborationId || null, assignedTo || null)
        closeModal()
        return
      }
      await onAdd(title.trim(), notes.trim(), goalId || null, startTime || null, dueDate || null, scheduledDate || null, priority || null, category, collaborationId || null, assignedTo || null, initialBucket || null)
      if (keepOpen) {
        setTitle('')
        setNotes('')
        inputRef.current?.focus()
      } else {
        closeModal()
      }
    } catch (err) {
      console.error('Task save failed:', err)
      setSubmitError('Couldn\'t save: ' + (err?.message || 'unknown error') + '. Nothing was lost — try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleBulkSubmit(e) {
    e.preventDefault()
    const lines = bulkTitles.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    const category = (customTaskCategory ? taskCategoryCustom.trim() : taskCategory) || null
    setBulkSubmitting(true)
    setBulkError('')
    let addedCount = 0
    try {
      for (const line of lines) {
        await onAdd(line, '', goalId || null, startTime || null, dueDate || null, scheduledDate || null, priority || null, category, collaborationId || null, assignedTo || null, initialBucket || null)
        addedCount++
      }
      closeModal()
    } catch (err) {
      console.error('Bulk add failed:', err)
      setBulkTitles(lines.slice(addedCount).join('\n'))
      setBulkError(
        (addedCount > 0
          ? 'Added ' + addedCount + ' of ' + lines.length + ' tasks, then hit an error: '
          : 'Couldn\'t save any tasks: ') +
        (err?.message || 'unknown error') +
        '. The rest are still in the box below — fix the issue and try again.'
      )
    } finally {
      setBulkSubmitting(false)
    }
  }

  const bulkCount = bulkTitles.split('\n').map(l => l.trim()).filter(Boolean).length

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-gray-900 mb-4">{editingTask ? 'Edit task' : initialScheduledDate ? 'Add task for ' + initialScheduledDate : 'Add task'}</h2>
        <form onSubmit={bulkMode ? handleBulkSubmit : (e) => handleSubmitCore(e, false)} className="space-y-3">
          {!editingTask && (
            <div className="flex justify-end -mb-1">
              <button
                type="button"
                onClick={() => setBulkMode(m => !m)}
                className="text-xs text-indigo-500 hover:text-indigo-700"
              >
                {bulkMode ? 'Switch to single task' : 'Add multiple tasks at once'}
              </button>
            </div>
          )}
          {bulkMode ? (
            <textarea
              autoFocus
              placeholder={'One task per line, e.g.\nCall dentist\nBuy groceries\nReview budget'}
              value={bulkTitles}
              onChange={e => setBulkTitles(e.target.value)}
              rows={5}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 resize-none"
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              placeholder="What do you need to do?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
          )}
          {!bulkMode && (
          <textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 resize-none"
          />
          )}
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-gray-500 mb-1">Goal</label>
              <select
                value={goalId}
                onChange={e => {
                  if (e.target.value === '__new__') { setAddingGoal(true); return }
                  setGoalId(e.target.value)
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-gray-700"
              >
                <option value="">No goal</option>
                {(goals || []).map(g => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
                {onAddGoal && <option value="__new__">+ New goal…</option>}
              </select>
            </div>
            <div className="shrink-0">
              <label className="block text-xs font-medium text-gray-500 mb-1">Start time (optional)</label>
              <div className="flex items-center gap-1">
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="min-w-[136px] border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-gray-700"
                />
                {startTime && (
                  <button type="button" onClick={() => setStartTime('')} className="text-gray-400 hover:text-gray-600 text-xs px-1" title="Clear time">
                    &#10005;
                  </button>
                )}
              </div>
            </div>
          </div>
          {collaborations && collaborations.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Save to</label>
              <select
                value={collaborationId}
                onChange={e => { setCollaborationId(e.target.value); setAssignedTo('') }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-gray-700"
              >
                <option value="">Personal</option>
                {collaborations.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {collaborationId && collabMembersMap && collabMembersMap[collaborationId] && collabMembersMap[collaborationId].length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Assign to</label>
              <select
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-gray-700"
              >
                <option value="">Unassigned</option>
                {collabMembersMap[collaborationId].map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
              </select>
            </div>
          )}
          {addingGoal && (
            <div className="border border-gray-200 rounded-lg p-3 -mt-1 space-y-2 bg-gray-50">
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="New goal title"
                  value={newGoalTitle}
                  onChange={e => setNewGoalTitle(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                />
              </div>
              <div className="flex gap-2">
                {customCategory ? (
                  <input
                    autoFocus
                    type="text"
                    placeholder="Custom category name"
                    value={newGoalCategoryCustom}
                    onChange={e => setNewGoalCategoryCustom(e.target.value)}
                    className="flex-1 min-w-0 border border-indigo-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                ) : (
                  <select
                    value={newGoalCategory}
                    onChange={e => { if (e.target.value === '__custom__') { setCustomCategory(true); return } setNewGoalCategory(e.target.value) }}
                    className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">No category</option>
                    {GOAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__custom__">+ New category…</option>
                  </select>
                )}
                <select value={newGoalPriority} onChange={e => setNewGoalPriority(e.target.value)} className="w-28 shrink-0 border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="">No priority</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              {!showGoalDetails ? (
                <button type="button" onClick={() => setShowGoalDetails(true)} className="text-xs text-indigo-500 hover:text-indigo-700">+ Make it a SMART goal (optional)</button>
              ) : (
                <div className="space-y-1.5 pt-1 border-t border-gray-200">
                  <p className="text-[11px] text-gray-400">All SMART fields are optional.</p>
                  <input type="text" placeholder="Specific: what & why?" value={smartSpecific} onChange={e => setSmartSpecific(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                  <input type="text" placeholder="Measurable: how will you know?" value={smartMeasurable} onChange={e => setSmartMeasurable(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                  <input type="text" placeholder="Achievable: realistic with current resources?" value={smartAchievable} onChange={e => setSmartAchievable(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                  <input type="text" placeholder="Relevant: why does this matter to you?" value={smartRelevant} onChange={e => setSmartRelevant(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                  <input type="text" placeholder="Time-bound: target deadline?" value={smartTimebound} onChange={e => setSmartTimebound(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={handleAddNewGoal} className="text-sm text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg">Create goal</button>
                <button type="button" onClick={() => { setAddingGoal(false); setNewGoalTitle(''); setShowGoalDetails(false) }} className="text-sm text-gray-400 hover:text-gray-600 px-2">Cancel</button>
              </div>
              {newGoalError && <p className="text-xs text-red-500">{newGoalError}</p>}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Soft deadline (optional)</label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={scheduledDate}
                onChange={e => setScheduledDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-gray-700"
              />
              {scheduledDate && (
                <button type="button" onClick={() => setScheduledDate('')} className="text-gray-400 hover:text-gray-600 text-xs px-1" title="Clear date">
                  &#10005;
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Leave blank to keep in Task List. Clearing this later sends it back to Task List.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Deadline (optional)</label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-gray-700"
              />
              {dueDate && (
                <button type="button" onClick={() => setDueDate('')} className="text-gray-400 hover:text-gray-600 text-xs px-1" title="Clear date">
                  &#10005;
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Priority (optional)</label>
            <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-gray-700">
              <option value="">No priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category (optional)</label>
            {customTaskCategory ? (
              <input
                autoFocus
                type="text"
                placeholder="Custom category name"
                value={taskCategoryCustom}
                onChange={e => setTaskCategoryCustom(e.target.value)}
                className="w-full border border-indigo-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            ) : (
              <select
                value={taskCategory}
                onChange={e => { if (e.target.value === '__custom__') { setCustomTaskCategory(true); return } setTaskCategory(e.target.value) }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-gray-700"
              >
                <option value="">No category</option>
                {allTaskCategories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__custom__">+ New category…</option>
              </select>
            )}
          </div>
          {bulkMode && bulkError && <p className="text-xs text-red-500">{bulkError}</p>}
          {!bulkMode && submitError && <p className="text-xs text-red-500">{submitError}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={closeModal} className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
            {bulkMode ? (
              <button type="submit" disabled={bulkCount === 0 || bulkSubmitting} className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {bulkSubmitting ? 'Adding...' : bulkCount > 0 ? 'Add ' + bulkCount + ' tasks' : 'Add tasks'}
              </button>
            ) : editingTask ? (
              <>
                <button
                  type="button"
                  onClick={() => onCreateFollowUp && onCreateFollowUp({ title: editingTask.title, goalId: editingTask.goal_id, category: editingTask.category, priority: editingTask.priority, collaborationId: editingTask.collaboration_id })}
                  className="flex-1 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Follow-up
                </button>
                <button type="submit" disabled={!title.trim() || submitting} className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">{submitting ? 'Saving...' : 'Save changes'}</button>
              </>
            ) : (
              <>
                <button type="button" onClick={(e) => handleSubmitCore(e, true)} disabled={!title.trim() || submitting} className="flex-1 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Add another</button>
                <button type="submit" disabled={!title.trim() || submitting} className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">{submitting ? 'Adding...' : 'Add'}</button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
