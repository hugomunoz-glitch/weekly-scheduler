import { useState, useEffect, useCallback, useMemo } from 'react'
import { startOfWeek, addWeeks, subWeeks, addDays, format, parseISO, isBefore, startOfDay } from 'date-fns'
import { DragDropContext } from '@hello-pangea/dnd'
import { supabase } from './lib/supabase'
import { useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import CollaborationPanel from './components/CollaborationPanel'
import SettingsDropdown from './components/SettingsDropdown'
import ViewSwitcher from './components/ViewSwitcher'
import { useIsMobile } from './hooks/useIsMobile'
import WeekGrid from './components/WeekGrid'
import Sidebar from './components/Sidebar'
import AddTaskModal from './components/AddTaskModal'
import GoalsBar from './components/GoalsBar'
import MobileLayout from './components/MobileLayout'

function useWarmupSensor(api) {
  useEffect(() => {
    function warmUp() {
      try {
        const el = document.querySelector('[data-rbd-draggable-id]')
        const id = el && el.getAttribute('data-rbd-draggable-id')
        if (!id) return
        const preDrag = api.tryGetLock(id, () => {})
        if (!preDrag) return
        const actions = preDrag.fluidLift({ x: 0, y: 0 })
        actions.cancel()
      } catch (e) {}
    }
    function onFirstTouch() {
      warmUp()
      document.removeEventListener('touchstart', onFirstTouch, true)
    }
    document.addEventListener('touchstart', onFirstTouch, true)
    return () => document.removeEventListener('touchstart', onFirstTouch, true)
  }, [api])
}

function bucketFromTime(startTime) {
  if (!startTime) return 'morning'
  const [h, m] = startTime.split(':').map(Number)
  const totalMin = h * 60 + (m || 0)
  if (totalMin <= 720) return 'morning'
  if (totalMin <= 1019) return 'midday'
  return 'afternoon'
}

export default function App() {
  const isMobile = useIsMobile()
  const { user, profile, loading: authLoading, signOut } = useAuth()

  useEffect(() => {
    window.scrollTo(0, 1)
    requestAnimationFrame(() => window.scrollTo(0, 0))
  }, [])

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [tasks, setTasks] = useState([])
  const [goals, setGoals] = useState([])
  const [goalTasks, setGoalTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForDate, setAddForDate] = useState(null)
  const [addForTime, setAddForTime] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const [showCollab, setShowCollab] = useState(false)
  const [collaborations, setCollaborations] = useState([])
  const [collabMembersMap, setCollabMembersMap] = useState({})
  const [activeView, setActiveView] = useState('all')
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => {
    if (!user) { setCollaborations([]); setCollabMembersMap({}); return }
    supabase.from('collaborations').select('id, name, collaboration_members(user_id, profiles(username))').then(({ data }) => {
      const rows = data || []
      setCollaborations(rows.map(c => ({ id: c.id, name: c.name })))
      setCollabMembersMap(Object.fromEntries(rows.map(c => [
        c.id,
        (c.collaboration_members || []).map(m => ({ id: m.user_id, username: m.profiles?.username || 'unknown' }))
      ])))
    })
  }, [user])

  const fetchTasks = useCallback(async () => {
    if (!user) { setTasks([]); setGoals([]); setGoalTasks([]); setLoading(false); return }
    setLoading(true)
    const s = format(weekStart, 'yyyy-MM-dd')
    const e = format(addDays(weekStart, 6), 'yyyy-MM-dd')
    const [inboxRes, weekRes, goalsRes, goalTasksRes] = await Promise.all([
      supabase.from('tasks').select('*').is('scheduled_date', null).order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').gte('scheduled_date', s).lte('scheduled_date', e).order('position'),
      supabase.from('goals').select('*').order('created_at'),
      supabase.from('tasks').select('id, title, goal_id, status, due_date, start_time, priority, collaboration_id, assigned_to').not('goal_id', 'is', null)
    ])
    const weekTasks = weekRes.data || []
    const inboxTasks = inboxRes.data || []
    const weekIds = new Set(weekTasks.map(t => t.id))
    setTasks([...weekTasks, ...inboxTasks.filter(t => !weekIds.has(t.id))])
    setGoals(goalsRes.data || [])
    setGoalTasks(goalTasksRes.data || [])
    setLoading(false)
  }, [weekStart, user])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const COLLAB_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']
  const collabMap = Object.fromEntries(collaborations.map((c, i) => [c.id, { name: c.name, color: COLLAB_COLORS[i % COLLAB_COLORS.length] }]))
  const profileMap = Object.fromEntries(Object.values(collabMembersMap).flat().map(m => [m.id, m.username]))
  const defaultCollaborationId = (activeView !== 'all' && activeView !== 'personal') ? activeView : null

  const today = startOfDay(new Date())
  const goalMap = Object.fromEntries(goals.map(g => [g.id, g]))

  const visibleTasks = useMemo(() => {
    if (activeView === 'all') return tasks
    if (activeView === 'personal') return tasks.filter(t => !t.collaboration_id)
    return tasks.filter(t => t.collaboration_id === activeView)
  }, [tasks, activeView])

  const visibleGoals = useMemo(() => {
    if (activeView === 'all') return goals
    if (activeView === 'personal') return goals.filter(g => !g.collaboration_id)
    return goals.filter(g => g.collaboration_id === activeView)
  }, [goals, activeView])

  const visibleGoalTasks = useMemo(() => {
    if (activeView === 'all') return goalTasks
    if (activeView === 'personal') return goalTasks.filter(t => !t.collaboration_id)
    return goalTasks.filter(t => t.collaboration_id === activeView)
  }, [goalTasks, activeView])

  const overdueTasks = visibleTasks.filter(t => t.scheduled_date && t.status === 'scheduled' && isBefore(parseISO(t.scheduled_date), today))

  async function onDragEnd(result) {
    const { draggableId, destination, source } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return
    if (destination.droppableId.startsWith('goalpopup-')) return

    const isDueCard = draggableId.endsWith('__due__')
    const taskId = isDueCard ? draggableId.slice(0, -7) : draggableId

    if (isDueCard) {
      try {
        const destParts = destination.droppableId.split('-')
        const destBucket = destParts[0]
        const destDateStr = destParts.slice(2).join('-')
        if (destination.droppableId === source.droppableId) {
          const siblings = visibleTasks.filter(t => t.due_date_card_date === destDateStr && (t.due_date_card_bucket || 'morning') === destBucket).sort((a, b) => (a.due_date_card_position || 0) - (b.due_date_card_position || 0))
          const reordered = Array.from(siblings)
          const [moved] = reordered.splice(source.index, 1)
          if (!moved) { fetchTasks(); return }
          reordered.splice(destination.index, 0, moved)
          const updatedPositions = Object.fromEntries(reordered.filter(Boolean).map((t, i) => [t.id, i]))
          requestAnimationFrame(() => setTasks(prev => prev.map(t => updatedPositions[t.id] !== undefined ? { ...t, due_date_card_position: updatedPositions[t.id] } : t)))
          await Promise.all(reordered.filter(Boolean).map((t, i) => supabase.from('tasks').update({ due_date_card_position: i }).eq('id', t.id)))
        } else {
          const newPosition = destination.index
          requestAnimationFrame(() => setTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date_card_date: destDateStr, due_date_card_bucket: destBucket, due_date_card_position: newPosition } : t)))
          const { error } = await supabase.from('tasks').update({ due_date_card_date: destDateStr, due_date_card_bucket: destBucket, due_date_card_position: newPosition }).eq('id', taskId)
          if (error) fetchTasks()
        }
      } catch (e) {
        console.error('onDragEnd (due card) failed, resyncing from server:', e)
        fetchTasks()
      }
      return
    }

    try {
      if (destination.droppableId === source.droppableId && destination.droppableId === 'inbox') {
        const inboxOnly = visibleTasks.filter(t => t.status === 'inbox').sort((a, b) => (a.position || 0) - (b.position || 0))
        const reordered = Array.from(inboxOnly)
        const [moved] = reordered.splice(source.index, 1)
        if (!moved) { fetchTasks(); return }
        reordered.splice(destination.index, 0, moved)
        const updatedPositions = Object.fromEntries(reordered.filter(Boolean).map((t, i) => [t.id, i]))
        requestAnimationFrame(() => setTasks(prev => prev.map(t => updatedPositions[t.id] !== undefined ? { ...t, position: updatedPositions[t.id] } : t)))
        const results = await Promise.all(reordered.filter(Boolean).map((t, i) => supabase.from('tasks').update({ position: i }).eq('id', t.id).select()))
        const failed = results.find(r => r.error)
        const zeroRow = results.find(r => !r.error && (!r.data || r.data.length === 0))
        if (failed) console.error('onDragEnd: inbox reorder save failed:', failed.error)
        if (zeroRow) console.error('onDragEnd: inbox reorder update matched 0 rows (RLS likely blocking the write):', zeroRow)
        if (failed || zeroRow) fetchTasks()
      } else if (destination.droppableId === source.droppableId) {
        const parts = destination.droppableId.split('-')
        const bucket = parts[0]
        const dateStr = parts.slice(1).join('-')
        const bucketTasks = visibleTasks.filter(t => t.scheduled_date === dateStr && (t.bucket || 'morning') === bucket).sort((a, b) => (a.position || 0) - (b.position || 0))
        const reordered = Array.from(bucketTasks)
        const [moved] = reordered.splice(source.index, 1)
        if (!moved) { fetchTasks(); return }
        reordered.splice(destination.index, 0, moved)
        const updatedPositions = Object.fromEntries(reordered.filter(Boolean).map((t, i) => [t.id, i]))
        requestAnimationFrame(() => setTasks(prev => prev.map(t => updatedPositions[t.id] !== undefined ? { ...t, position: updatedPositions[t.id] } : t)))
        const results = await Promise.all(reordered.filter(Boolean).map((t, i) => supabase.from('tasks').update({ position: i }).eq('id', t.id)))
        const failedBucket = results.find(r => r.error)
        if (failedBucket) { console.error('onDragEnd: bucket reorder save failed:', failedBucket.error); fetchTasks() }
      } else if (destination.droppableId === 'inbox') {
        requestAnimationFrame(() => setTasks(prev => prev.map(t => t.id === taskId ? { ...t, scheduled_date: null, status: 'inbox', bucket: null } : t)))
        const { error } = await supabase.from('tasks').update({ scheduled_date: null, status: 'inbox', bucket: null }).eq('id', taskId)
        if (error) fetchTasks()
      } else {
        const parts = destination.droppableId.split('-')
        const bucket = parts[0]
        const dateStr = parts.slice(1).join('-')
        const newPosition = destination.index
        requestAnimationFrame(() => setTasks(prev => prev.map(t => t.id === taskId ? { ...t, scheduled_date: dateStr, status: 'scheduled', bucket, position: newPosition } : t)))
        const { error } = await supabase.from('tasks').update({ scheduled_date: dateStr, status: 'scheduled', bucket, position: newPosition }).eq('id', taskId)
        if (error) fetchTasks()
      }
    } catch (e) {
      console.error('onDragEnd failed, resyncing from server:', e)
      fetchTasks()
    }
  }

  async function addTask(title, notes, goalId, startTime, dueDate, scheduledDate, priority, category, collaborationId, assignedTo) {
    const { data, error } = await supabase.from('tasks').insert({
      title, notes: notes || null, goal_id: goalId || null, start_time: startTime || null, due_date: dueDate || null,
      status: scheduledDate ? 'scheduled' : 'inbox',
      scheduled_date: scheduledDate || null,
      bucket: scheduledDate ? bucketFromTime(startTime) : null,
      priority: priority || null,
      category: category || null,
      owner_id: user.id,
      collaboration_id: collaborationId || null,
      assigned_to: assignedTo || null,
      due_date_card_date: dueDate || null,
      due_date_card_bucket: dueDate ? 'morning' : null
    }).select().single()
    if (error) { console.error('addTask failed:', error); throw error }
    setTasks(prev => [data, ...prev])
    if (data.goal_id) setGoalTasks(prev => [...prev, { id: data.id, title: data.title, goal_id: data.goal_id, status: data.status, due_date: data.due_date, start_time: data.start_time, priority: data.priority, collaboration_id: data.collaboration_id, assigned_to: data.assigned_to }])
  }

  async function editTask(taskId, title, notes, goalId, startTime, dueDate, scheduledDate, priority, category, collaborationId, assignedTo) {
    const existing = tasks.find(t => t.id === taskId)
    const wasScheduled = existing && existing.scheduled_date
    const updates = { title, notes: notes || null, goal_id: goalId || null, start_time: startTime || null, due_date: dueDate || null, priority: priority || null, category: category || null }
    if (collaborationId !== undefined) updates.collaboration_id = collaborationId || null
    if (assignedTo !== undefined) updates.assigned_to = assignedTo || null
    const oldDueDate = existing ? existing.due_date : null
    const oldDueCardDate = existing ? existing.due_date_card_date : null
    const stillFollowingDueDate = !oldDueCardDate || oldDueCardDate === oldDueDate
    if (!dueDate) {
      updates.due_date_card_date = null
      updates.due_date_card_bucket = null
    } else if (stillFollowingDueDate) {
      updates.due_date_card_date = dueDate
      updates.due_date_card_bucket = existing && existing.due_date_card_bucket ? existing.due_date_card_bucket : 'morning'
    }
    if (scheduledDate) {
      updates.scheduled_date = scheduledDate
      updates.status = existing && existing.status === 'done' ? 'done' : 'scheduled'
      if (startTime) {
        updates.bucket = bucketFromTime(startTime)
      } else if (!wasScheduled) {
        updates.bucket = 'morning'
      }
    } else {
      updates.scheduled_date = null
      updates.bucket = null
      updates.status = existing && existing.status === 'done' ? 'done' : 'inbox'
    }
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', taskId).select().single()
    if (!error) {
      setTasks(prev => prev.map(t => t.id === taskId ? data : t))
      setGoalTasks(prev => {
        const filtered = prev.filter(t => t.id !== taskId)
        if (data.goal_id) return [...filtered, { id: data.id, title: data.title, goal_id: data.goal_id, status: data.status, due_date: data.due_date, start_time: data.start_time, priority: data.priority, collaboration_id: data.collaboration_id, assigned_to: data.assigned_to }]
        return filtered
      })
    }
  }

  async function assignTask(taskId, assigneeId) {
    const { data, error } = await supabase.from('tasks').update({ assigned_to: assigneeId || null }).eq('id', taskId).select().single()
    if (!error) {
      setTasks(prev => prev.map(t => t.id === taskId ? data : t))
      setGoalTasks(prev => prev.map(t => t.id === taskId ? { ...t, assigned_to: data.assigned_to } : t))
    } else {
      console.error('assignTask failed:', error)
    }
  }

  async function addGoal(title, color, extra, collaborationId) {
    const payload = { title, color, owner_id: user.id, collaboration_id: collaborationId || null }
    if (extra) {
      if (extra.category) payload.category = extra.category
      if (extra.priority) payload.priority = extra.priority
      if (extra.smartSpecific) payload.smart_specific = extra.smartSpecific
      if (extra.smartMeasurable) payload.smart_measurable = extra.smartMeasurable
      if (extra.smartAchievable) payload.smart_achievable = extra.smartAchievable
      if (extra.smartRelevant) payload.smart_relevant = extra.smartRelevant
      if (extra.smartTimebound) payload.smart_timebound = extra.smartTimebound
    }
    const { data, error } = await supabase.from('goals').insert(payload).select().single()
    if (error) { console.error('addGoal failed:', error); throw error }
    setGoals(prev => [...prev, data])
    return data
  }

  async function editGoal(goalId, title, extra, collaborationId) {
    const payload = { title }
    if (collaborationId !== undefined) payload.collaboration_id = collaborationId || null
    if (extra) {
      if ('category' in extra) payload.category = extra.category || null
      if ('priority' in extra) payload.priority = extra.priority || null
      if ('smartSpecific' in extra) payload.smart_specific = extra.smartSpecific || null
      if ('smartMeasurable' in extra) payload.smart_measurable = extra.smartMeasurable || null
      if ('smartAchievable' in extra) payload.smart_achievable = extra.smartAchievable || null
      if ('smartRelevant' in extra) payload.smart_relevant = extra.smartRelevant || null
      if ('smartTimebound' in extra) payload.smart_timebound = extra.smartTimebound || null
    }
    const { data, error } = await supabase.from('goals').update(payload).eq('id', goalId).select().single()
    if (error) { console.error('editGoal failed:', error); throw error }
    setGoals(prev => prev.map(g => g.id === goalId ? data : g))
  }

  const [undoQueue, setUndoQueue] = useState([])
  const UNDO_MS = 6000

  async function performDeleteGoal(goalId) {
    const { error } = await supabase.from('goals').delete().eq('id', goalId)
    if (error) console.error('deleteGoal failed:', error)
  }

  async function performDeleteTask(taskId) {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) console.error('deleteTask failed:', error)
  }

  function deleteGoal(goalId) {
    const goal = goals.find(g => g.id === goalId)
    if (!goal) return
    const relatedGoalTasks = goalTasks.filter(t => t.goal_id === goalId)
    setGoals(prev => prev.filter(g => g.id !== goalId))
    setGoalTasks(prev => prev.filter(t => t.goal_id !== goalId))
    const timerId = setTimeout(() => {
      performDeleteGoal(goalId)
      setUndoQueue(prev => prev.filter(u => u.id !== goalId))
    }, UNDO_MS)
    setUndoQueue(prev => [...prev, { id: goalId, type: 'goal', label: goal.title, timerId, restore: () => {
      setGoals(prev => [...prev, goal])
      setGoalTasks(prev => [...prev, ...relatedGoalTasks])
    } }])
  }

  function deleteTask(taskId) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const relatedGoalTask = goalTasks.find(t => t.id === taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setGoalTasks(prev => prev.filter(t => t.id !== taskId))
    const timerId = setTimeout(() => {
      performDeleteTask(taskId)
      setUndoQueue(prev => prev.filter(u => u.id !== taskId))
    }, UNDO_MS)
    setUndoQueue(prev => [...prev, { id: taskId, type: 'task', label: task.title, timerId, restore: () => {
      setTasks(prev => [...prev, task])
      if (relatedGoalTask) setGoalTasks(prev => [...prev, relatedGoalTask])
    } }])
  }

  function undoDelete(id) {
    setUndoQueue(prev => {
      const entry = prev.find(u => u.id === id)
      if (entry) { clearTimeout(entry.timerId); entry.restore() }
      return prev.filter(u => u.id !== id)
    })
  }

  async function markDone(taskId) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const newStatus = task.status === 'done' ? (task.scheduled_date ? 'scheduled' : 'inbox') : 'done'
    const { data, error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId).select().single()
    if (!error) {
      setTasks(prev => prev.map(t => t.id === taskId ? data : t))
      setGoalTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    }
  }

  async function rescheduleToTomorrow(taskId, currentDate) {
    if (!currentDate) return
    const dateStr = format(addDays(parseISO(currentDate), 1), 'yyyy-MM-dd')
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, scheduled_date: dateStr, status: 'scheduled' } : t))
    const { error } = await supabase.from('tasks').update({ scheduled_date: dateStr, status: 'scheduled' }).eq('id', taskId)
    if (error) fetchTasks()
  }

  async function moveToInbox(taskId) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, scheduled_date: null, status: 'inbox', bucket: null } : t))
    const { error } = await supabase.from('tasks').update({ scheduled_date: null, status: 'inbox', bucket: null }).eq('id', taskId)
    if (error) fetchTasks()
  }

  async function rolloverOverdue() {
    const todayStr = format(today, 'yyyy-MM-dd')
    const ids = overdueTasks.map(t => t.id)
    if (!ids.length) return
    setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, scheduled_date: todayStr } : t))
    await supabase.from('tasks').update({ scheduled_date: todayStr }).in('id', ids)
  }

  const inboxTasks = visibleTasks.filter(t => !t.scheduled_date)
  const taskCategories = [...new Set(visibleTasks.map(t => t.category).filter(Boolean))].sort()
  const tasksForDay = (date) => visibleTasks.filter(t => t.scheduled_date === format(date, 'yyyy-MM-dd'))
  const dueCardsForDay = (date) => visibleTasks.filter(t => t.due_date_card_date === format(date, 'yyyy-MM-dd') && t.scheduled_date !== t.due_date_card_date)
  const openAddForDay = (date) => { setAddForDate(format(date, 'yyyy-MM-dd')); setAddForTime(null); setShowAdd(true) }
  const BUCKET_DEFAULT_TIME = { morning: '09:00', midday: '13:00', afternoon: '18:00' }
  const openAddForBucket = (date, bucketId) => {
    setAddForDate(format(date, 'yyyy-MM-dd'))
    setAddForTime(BUCKET_DEFAULT_TIME[bucketId] || '09:00')
    setShowAdd(true)
  }

  const sharedProps = {
    weekStart, weekDays, tasks: visibleTasks, goals: visibleGoals, goalMap, collabMap, collabMembersMap, profileMap, goalTasks: visibleGoalTasks, inboxTasks, loading,
    collaborations, activeView, onChangeView: setActiveView, defaultCollaborationId,
    overdueTasks, onMarkDone: markDone, onRescheduleToTomorrow: rescheduleToTomorrow,
    onMoveToInbox: moveToInbox, onDelete: deleteTask, onEdit: setEditingTask, onAssignTask: assignTask,
    onAddTask: () => setShowAdd(true), onAddTaskForDay: openAddForDay, onAddTaskForBucket: openAddForBucket, onCreateTask: addTask, onRollover: rolloverOverdue,
    onAddGoal: addGoal, onEditGoal: editGoal, onDeleteGoal: deleteGoal,
    onPrevWeek: () => setWeekStart(w => subWeeks(w, 1)),
    onNextWeek: () => setWeekStart(w => addWeeks(w, 1)),
    onThisWeek: () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
  }

  const dndSensors = useMemo(() => [useWarmupSensor], [])

  if (authLoading) {
    return <div className="h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>
  }
  if (!user) {
    return <Login />
  }

  return (
    <DragDropContext onDragEnd={onDragEnd} sensors={dndSensors}>
      {isMobile ? (
        <MobileLayout {...sharedProps} />
      ) : (
        <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
          <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <img src="/icon-192.png" alt="" className="w-5 h-5 rounded" />
              <h1 className="text-base font-semibold text-gray-900 tracking-tight">Schedulent</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={sharedProps.onPrevWeek} className="px-2 py-1 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded">Prev</button>
              <span className="text-sm font-medium text-gray-700 min-w-[200px] text-center">{format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}</span>
              <button onClick={sharedProps.onNextWeek} className="px-2 py-1 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded">Next</button>
              <button onClick={sharedProps.onThisWeek} className="px-3 py-1 text-xs text-indigo-600 border border-indigo-200 hover:bg-indigo-50 rounded">This week</button>
              <div className="ml-1">
                <ViewSwitcher activeView={activeView} onChangeView={setActiveView} collaborations={collaborations} collabMap={collabMap} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {overdueTasks.length > 0 && (
                <button onClick={rolloverOverdue} className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100">Roll over {overdueTasks.length} overdue</button>
              )}
              <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">+ Add task</button>
              <SettingsDropdown onOpenCollaborations={() => setShowCollab(true)} />
            </div>
          </header>
          <div className="mx-3 mt-3 rounded-xl border border-gray-200 shadow-sm overflow-hidden shrink-0">
            <GoalsBar goals={visibleGoals} goalTasks={visibleGoalTasks} allTasks={visibleTasks} collabMap={collabMap} collaborations={collaborations} defaultCollaborationId={defaultCollaborationId} onAddGoal={addGoal} onEditGoal={editGoal} onDeleteGoal={deleteGoal} onMarkDone={markDone} onDelete={deleteTask} onCreateTask={addTask} onEditTask={setEditingTask} />
          </div>
          <div className="flex flex-1 overflow-hidden gap-3 p-3">
            <main className="flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-gray-200 shadow-sm bg-white p-4">
              {loading ? <div className="flex items-center justify-center h-full text-sm text-gray-400">Loading</div> : (
                <WeekGrid days={weekDays} tasksForDay={tasksForDay} dueCardsForDay={dueCardsForDay} goalMap={goalMap} collabMap={collabMap} onMarkDone={markDone} onRescheduleToTomorrow={rescheduleToTomorrow} onMoveToInbox={moveToInbox} onDelete={deleteTask} onEdit={setEditingTask} onAddTaskForDay={openAddForDay} onAddTaskForBucket={openAddForBucket} />
              )}
            </main>
            <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden shrink-0">
              <Sidebar tasks={inboxTasks} goalMap={goalMap} collabMap={collabMap} collabMembersMap={collabMembersMap} profileMap={profileMap} onAssignTask={assignTask} goals={visibleGoals} allTasks={visibleTasks} onAddTask={() => setShowAdd(true)} onCreateTask={addTask} onAddGoal={addGoal} onEdit={setEditingTask} onDelete={deleteTask} />
            </div>
          </div>
        </div>
      )}
      {showAdd && <AddTaskModal onAdd={addTask} onClose={() => { setShowAdd(false); setAddForDate(null); setAddForTime(null) }} goals={visibleGoals} onAddGoal={addGoal} initialScheduledDate={addForDate} initialStartTime={addForTime} existingTaskCategories={taskCategories} collaborations={collaborations} collabMembersMap={collabMembersMap} defaultCollaborationId={defaultCollaborationId} />}
      {editingTask && <AddTaskModal editingTask={editingTask} onEdit={editTask} onClose={() => setEditingTask(null)} goals={visibleGoals} onAddGoal={addGoal} existingTaskCategories={taskCategories} collaborations={collaborations} collabMembersMap={collabMembersMap} defaultCollaborationId={defaultCollaborationId} />}
      {showCollab && <CollaborationPanel onClose={() => setShowCollab(false)} />}
      {undoQueue.length > 0 && (
        <div className={'fixed left-1/2 -translate-x-1/2 z-[2000] flex flex-col gap-2 items-center ' + (isMobile ? 'bottom-20' : 'bottom-4')}>
          {undoQueue.map(u => (
            <div key={u.id} className="bg-gray-800 text-white text-sm rounded-lg shadow-xl px-4 py-2.5 flex items-center gap-3 max-w-[90vw]">
              <span className="truncate">{u.type === 'goal' ? 'Goal' : 'Task'} "{u.label}" deleted.</span>
              <button onClick={() => undoDelete(u.id)} className="text-indigo-300 hover:text-indigo-200 font-semibold shrink-0">Undo</button>
            </div>
          ))}
        </div>
      )}
    </DragDropContext>
  )
}
