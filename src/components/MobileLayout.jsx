import { useState } from 'react'
import { useAssistantHistory } from '../hooks/useAssistantHistory'
import { format, isToday } from 'date-fns'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import TaskCard from './TaskCard'

const BUCKETS = [
  { id: 'morning', label: 'Morning' },
  { id: 'midday', label: 'Afternoon' },
  { id: 'afternoon', label: 'Evening' },
]

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

function MobileGoalsBar({ goals, goalTasks, onAddGoal, onEditGoal, onDeleteGoal }) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  function handleAdd(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    onAddGoal(newTitle.trim(), COLORS[goals.length % COLORS.length])
    setNewTitle('')
    setAdding(false)
  }

  return (
    <div style={{ background: 'white', borderBottom: '1px solid #f3f4f6', padding: '8px 12px', display: 'flex', gap: '8px', overflowX: 'auto', flexShrink: 0 }}>
      {goals.map(goal => {
        const linked = goalTasks.filter(t => t.goal_id === goal.id)
        const done = linked.filter(t => t.status === 'done')
        const pct = linked.length > 0 ? Math.round((done.length / linked.length) * 100) : 0
        return (
          <div key={goal.id} style={{ flexShrink: 0, border: '1px solid #e5e7eb', borderRadius: '10px', padding: '6px 10px', minWidth: '120px', background: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: goal.color, flexShrink: 0 }} />
              <span style={{ fontSize: "11px", fontWeight: 500, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "80px", cursor: "pointer" }} onClick={() => { const t = prompt("Edit goal name:", goal.title); if (t && t.trim()) onEditGoal(goal.id, t.trim()) }}>{goal.title}</span>
            <span style={{ fontSize: "14px", color: "#9ca3af", cursor: "pointer", flexShrink: 0 }} onClick={() => { if (window.confirm(`Delete goal "${goal.title}"?`)) onDeleteGoal(goal.id) }}>&times;</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ flex: 1, height: '3px', background: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pct + '%', background: goal.color, borderRadius: '2px' }} />
              </div>
              <span style={{ fontSize: "10px", color: "#9ca3af", flexShrink: 0 }}>{pct}%</span>
              <span style={{ fontSize: "10px", color: "#9ca3af", flexShrink: 0 }}>{done.length}/{linked.length}</span>
            </div>
          </div>
        )
      })}
      {adding ? (
        <form onSubmit={handleAdd} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onBlur={() => { if (!newTitle.trim()) setAdding(false) }}
            style={{ border: '1px solid #6366f1', borderRadius: '8px', padding: '4px 8px', fontSize: '12px', width: '120px', outline: 'none' }}
            placeholder="Goal name" />
          <button type="submit" style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}>Add</button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ flexShrink: 0, border: '1px dashed #c7d2fe', borderRadius: '10px', padding: '6px 10px', fontSize: '11px', color: '#6366f1', background: 'white', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          + Goal
        </button>
      )}
    </div>
  )
}

function MobileDayView({ date, tasks, goalMap, onMarkDone, onRescheduleToTomorrow, onMoveToInbox, onDelete, onEdit }) {
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
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{bucket.label}</span>
              {bucketTasks.length > 0 && <span style={{ fontSize: '11px', color: '#d1d5db' }}>{bucketTasks.length}</span>}
            </div>
            <Droppable droppableId={droppableId}>
              {(provided, snapshot) => (
                <div ref={provided.innerRef} {...provided.droppableProps}
                  style={{ minHeight: '44px', background: snapshot.isDraggingOver ? '#eef2ff' : 'transparent', borderRadius: '8px', padding: '2px', transition: 'background 0.15s' }}>
                  {bucketTasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ marginBottom: '6px' }}>
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
                  {bucketTasks.length === 0 && !snapshot.isDraggingOver && (
                    <p style={{ fontSize: '11px', color: '#e5e7eb', textAlign: 'center', padding: '8px 0', margin: 0 }}>drop here</p>
                  )}
                </div>
              )}
            </Droppable>
          </div>
        )
      })}
    </div>
  )
}

function MobileInbox({ tasks, goalMap, onAddTask, onEdit, onDelete }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Droppable droppableId="inbox">
        {(provided, snapshot) => (
          <div ref={provided.innerRef} {...provided.droppableProps}
            style={{ minHeight: '100px', padding: '12px', background: snapshot.isDraggingOver ? '#eef2ff' : 'transparent' }}>
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div style={{ textAlign: 'center', paddingTop: '40px' }}>
                <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 12px' }}>Nothing in the inbox.</p>
                <button onClick={onAddTask} style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}>+ Add task</button>
              </div>
            )}
            {tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(provided, snapshot) => (
                  <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                    style={{ border: '1px solid ' + (snapshot.isDragging ? '#a5b4fc' : '#e5e7eb'), borderRadius: '10px', padding: '10px 12px', background: 'white', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <p style={{ fontSize: '14px', color: '#1f2937', flex: 1, margin: 0 }}>{task.title}</p>
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
  )
}

function parseProposals(text) {
  const proposals = []
  const taskRegex = /\[ADD_TASK:\s*([^\]]+)\]/g
  const goalRegex = /\[ADD_GOAL:\s*([^\]]+)\]/g
  let match
  while ((match = taskRegex.exec(text)) !== null) proposals.push({ type: 'task', title: match[1].trim(), raw: match[0] })
  while ((match = goalRegex.exec(text)) !== null) proposals.push({ type: 'goal', title: match[1].trim(), raw: match[0] })
  return proposals
}

function cleanText(text) {
  return text.replace(/\[ADD_TASK:[^\]]+\]/g, '').replace(/\[ADD_GOAL:[^\]]+\]/g, '').trim()
}

function MobileAssistant({ goals, tasks, onAddTask, onAddGoal }) {
  const { messages, loading: historyLoading, addMessage, clearHistory } = useAssistantHistory()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState({})

  const systemPrompt = 'You are a helpful planning assistant in a weekly planner app. You can propose tasks and goals.\n\nWhen proposing a task include [ADD_TASK: task title] in your response.\nWhen proposing a goal include [ADD_GOAL: goal title] in your response.\nAlways explain why you suggest them. Be concise.\n\nGoals:\n' + (goals.length > 0 ? goals.map(g => '- ' + g.title).join('\n') : 'None.') + '\n\nTasks:\n' + (tasks.filter(t => t.status !== 'done').slice(0, 15).map(t => '- ' + t.title).join('\n') || 'None.')

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
    if (proposal.type === 'task') await onAddTask(proposal.title, '', null, null)
    else await onAddGoal(proposal.title, colors[goals.length % colors.length])
    setConfirmed(prev => ({ ...prev, [key]: true }))
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
                        </div>
                        {done ? (
                          <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 500 }}>Added ✓</span>
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
  onRescheduleToTomorrow, onMoveToInbox, onDelete, onEdit, onAddTask,
  onRollover, onAddGoal, onEditGoal, onDeleteGoal
}) {
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = new Date()
    const inWeek = weekDays.some(d => format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'))
    return inWeek ? today : weekDays[0]
  })
  const [activeTab, setActiveTab] = useState('day')

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
              <span style={{ fontSize: '10px', color: isSelected ? '#6366f1' : '#9ca3af', fontWeight: 500, textTransform: 'uppercase' }}>{dayNames[i]}</span>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: isSelected ? '#6366f1' : today ? '#e0e7ff' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: isSelected || today ? 600 : 400, color: isSelected ? 'white' : today ? '#6366f1' : '#374151' }}>{format(day, 'd')}</span>
              </div>
              {count > 0 && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: isSelected ? '#6366f1' : '#d1d5db' }} />}
            </button>
          )
        })}
      </div>

      <MobileGoalsBar goals={goals} goalTasks={goalTasks} onAddGoal={onAddGoal} onEditGoal={onEditGoal} onDeleteGoal={onDeleteGoal} />

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
            <button onClick={onAddTask} style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>+ Add</button>
          </div>
          <MobileDayView date={selectedDay} tasks={tasksForDay(selectedDay)} goalMap={goalMap} onMarkDone={onMarkDone} onRescheduleToTomorrow={onRescheduleToTomorrow} onMoveToInbox={onMoveToInbox} onDelete={onDelete} onEdit={onEdit} />
        </>
      )}

      {activeTab === 'inbox' && (
        <>
          <div style={{ padding: '10px 16px 6px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>Inbox <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 400 }}>{inboxTasks.length}</span></span>
            <button onClick={onAddTask} style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>+ Add</button>
          </div>
          <MobileInbox tasks={inboxTasks} goalMap={goalMap} onAddTask={onAddTask} onEdit={onEdit} onDelete={onDelete} />
        </>
      )}

      {activeTab === 'assistant' && (
        <>
          <div style={{ padding: '10px 16px 6px', flexShrink: 0 }}>
            <span style={{ fontSize: '15px', fontWeight: 500, color: '#111827' }}>&#129302; Assistant</span>
          </div>
          <MobileAssistant goals={goals} tasks={tasks} onAddTask={onAddTask} onAddGoal={onAddGoal} />
        </>
      )}

      <div style={{ background: 'white', borderTop: '1px solid #e5e7eb', padding: '6px 0 8px', display: 'flex', flexShrink: 0 }}>
        {[
          { id: 'day', label: 'Today', emoji: '&#128197;' },
          { id: 'inbox', label: 'Inbox', emoji: '&#128228;', badge: inboxTasks.length },
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
