import { useState, useEffect, useCallback } from 'react'
import { startOfWeek, addWeeks, subWeeks, addDays, format, parseISO, isBefore, startOfDay } from 'date-fns'
import { DragDropContext } from '@hello-pangea/dnd'
import { supabase } from './lib/supabase'
import { useIsMobile } from './hooks/useIsMobile'
import WeekGrid from './components/WeekGrid'
import Sidebar from './components/Sidebar'
import AddTaskModal from './components/AddTaskModal'
import GoalsBar from './components/GoalsBar'
import MobileLayout from './components/MobileLayout'

export default function App() {
  const isMobile = useIsMobile()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [tasks, setTasks] = useState([])
  const [goals, setGoals] = useState([])
  const [goalTasks, setGoalTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const s = format(weekStart, 'yyyy-MM-dd')
    const e = format(addDays(weekStart, 6), 'yyyy-MM-dd')
    const [inboxRes, weekRes, goalsRes, goalTasksRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('status', 'inbox').order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').gte('scheduled_date', s).lte('scheduled_date', e).order('position'),
      supabase.from('goals').select('*').order('created_at'),
      supabase.from('tasks').select('id, goal_id, status').not('goal_id', 'is', null)
    ])
    const weekTasks = weekRes.data || []
    const inboxTasks = inboxRes.data || []
    const weekIds = new Set(weekTasks.map(t => t.id))
    setTasks([...weekTasks, ...inboxTasks.filter(t => !weekIds.has(t.id))])
    setGoals(goalsRes.data || [])
    setGoalTasks(goalTasksRes.data || [])
    setLoading(false)
  }, [weekStart])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const today = startOfDay(new Date())
  const goalMap = Object.fromEntries(goals.map(g => [g.id, g]))
  const overdueTasks = tasks.filter(t => t.scheduled_date && t.status === 'scheduled' && isBefore(parseISO(t.scheduled_date), today))

  async function onDragEnd(result) {
    const { draggableId: taskId, destination, source } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return
    if (destination.droppableId === source.droppableId) {
      const parts = destination.droppableId.split('-')
      const bucket = parts[0]
      const dateStr = parts.slice(1).join('-')
      const bucketTasks = tasks.filter(t => t.scheduled_date === dateStr && (t.bucket || 'morning') === bucket && t.status !== 'done').sort((a, b) => (a.position || 0) - (b.position || 0))
      const reordered = Array.from(bucketTasks)
      const [moved] = reordered.splice(source.index, 1)
      reordered.splice(destination.index, 0, moved)
      const updatedPositions = Object.fromEntries(reordered.map((t, i) => [t.id, i]))
      setTasks(prev => prev.map(t => updatedPositions[t.id] !== undefined ? { ...t, position: updatedPositions[t.id] } : t))
      await Promise.all(reordered.map((t, i) => supabase.from('tasks').update({ position: i }).eq('id', t.id)))
    } else if (destination.droppableId === 'inbox') {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, scheduled_date: null, status: 'inbox', bucket: null } : t))
      const { error } = await supabase.from('tasks').update({ scheduled_date: null, status: 'inbox', bucket: null }).eq('id', taskId)
      if (error) fetchTasks()
    } else {
      const parts = destination.droppableId.split('-')
      const bucket = parts[0]
      const dateStr = parts.slice(1).join('-')
      const newPosition = destination.index
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, scheduled_date: dateStr, status: 'scheduled', bucket, position: newPosition } : t))
      const { error } = await supabase.from('tasks').update({ scheduled_date: dateStr, status: 'scheduled', bucket, position: newPosition }).eq('id', taskId)
      if (error) fetchTasks()
    }
  }

  async function addTask(title, notes, goalId, startTime) {
    const { data, error } = await supabase.from('tasks').insert({ title, notes: notes || null, status: 'inbox', goal_id: goalId || null, start_time: startTime || null }).select().single()
    if (!error) {
      setTasks(prev => [data, ...prev])
      if (data.goal_id) setGoalTasks(prev => [...prev, { id: data.id, goal_id: data.goal_id, status: data.status }])
    }
  }

  async function editTask(taskId, title, notes, goalId, startTime) {
    const { data, error } = await supabase.from('tasks').update({ title, notes: notes || null, goal_id: goalId || null, start_time: startTime || null }).eq('id', taskId).select().single()
    if (!error) {
      setTasks(prev => prev.map(t => t.id === taskId ? data : t))
      setGoalTasks(prev => {
        const filtered = prev.filter(t => t.id !== taskId)
        if (data.goal_id) return [...filtered, { id: data.id, goal_id: data.goal_id, status: data.status }]
        return filtered
      })
    }
  }

  async function addGoal(title, color) {
    const { data, error } = await supabase.from('goals').insert({ title, color }).select().single()
    if (!error) setGoals(prev => [...prev, data])
  }

  async function editGoal(goalId, title) {
    const { data, error } = await supabase.from('goals').update({ title }).eq('id', goalId).select().single()
    if (!error) setGoals(prev => prev.map(g => g.id === goalId ? data : g))
  }

  async function deleteGoal(goalId) {
    const { error } = await supabase.from('goals').delete().eq('id', goalId)
    if (!error) {
      setGoals(prev => prev.filter(g => g.id !== goalId))
      setGoalTasks(prev => prev.filter(t => t.goal_id !== goalId))
    }
  }

  async function deleteTask(taskId) {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== taskId))
      setGoalTasks(prev => prev.filter(t => t.id !== taskId))
    }
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

  const inboxTasks = tasks.filter(t => t.status === 'inbox')
  const tasksForDay = (date) => tasks.filter(t => t.scheduled_date === format(date, 'yyyy-MM-dd'))

  const sharedProps = {
    weekStart, weekDays, tasks, goals, goalMap, goalTasks, inboxTasks,
    overdueTasks, onMarkDone: markDone, onRescheduleToTomorrow: rescheduleToTomorrow,
    onMoveToInbox: moveToInbox, onDelete: deleteTask, onEdit: setEditingTask,
    onAddTask: () => setShowAdd(true), onRollover: rolloverOverdue,
    onAddGoal: addGoal, onEditGoal: editGoal, onDeleteGoal: deleteGoal,
    onPrevWeek: () => setWeekStart(w => subWeeks(w, 1)),
    onNextWeek: () => setWeekStart(w => addWeeks(w, 1)),
    onThisWeek: () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {isMobile ? (
        <MobileLayout {...sharedProps} />
      ) : (
        <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
          <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
            <h1 className="text-base font-semibold text-gray-900 tracking-tight">Weekly Planner</h1>
            <div className="flex items-center gap-2">
              <button onClick={sharedProps.onPrevWeek} className="px-2 py-1 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded">Prev</button>
              <span className="text-sm font-medium text-gray-700 min-w-[200px] text-center">{format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}</span>
              <button onClick={sharedProps.onNextWeek} className="px-2 py-1 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded">Next</button>
              <button onClick={sharedProps.onThisWeek} className="px-3 py-1 text-xs text-indigo-600 border border-indigo-200 hover:bg-indigo-50 rounded">This week</button>
            </div>
            <div className="flex items-center gap-2">
              {overdueTasks.length > 0 && (
                <button onClick={rolloverOverdue} className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100">Roll over {overdueTasks.length} overdue</button>
              )}
              <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">+ Add task</button>
            </div>
          </header>
          <GoalsBar goals={goals} goalTasks={goalTasks} onAddGoal={addGoal} onEditGoal={editGoal} onDeleteGoal={deleteGoal} />
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-x-auto overflow-y-auto p-4">
              {loading ? <div className="flex items-center justify-center h-full text-sm text-gray-400">Loading</div> : (
                <WeekGrid days={weekDays} tasksForDay={tasksForDay} goalMap={goalMap} onMarkDone={markDone} onRescheduleToTomorrow={rescheduleToTomorrow} onMoveToInbox={moveToInbox} onDelete={deleteTask} onEdit={setEditingTask} />
              )}
            </main>
            <Sidebar tasks={inboxTasks} goalMap={goalMap} goals={goals} allTasks={tasks} onAddTask={() => setShowAdd(true)} onEdit={setEditingTask} onDelete={deleteTask} />
          </div>
        </div>
      )}
      {showAdd && <AddTaskModal onAdd={addTask} onClose={() => setShowAdd(false)} goals={goals} />}
      {editingTask && <AddTaskModal editingTask={editingTask} onEdit={editTask} onClose={() => setEditingTask(null)} goals={goals} />}
    </DragDropContext>
  )
}
