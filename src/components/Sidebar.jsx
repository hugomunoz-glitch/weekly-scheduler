import { useState } from 'react'
import { Droppable, Draggable } from '@hello-pangea/dnd'

function Inbox({ tasks, goalMap, onEdit, onDelete }) {
  const [hoverId, setHoverId] = useState(null)
  return (
    <div className="flex flex-col h-full">
      <Droppable droppableId="inbox">
        {(provided, snapshot) => (
          <div ref={provided.innerRef} {...provided.droppableProps}
            className={'flex-1 overflow-y-auto p-3 space-y-2 min-h-[60px] transition-colors ' + (snapshot.isDraggingOver ? 'bg-indigo-50' : '')}>
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="text-center pt-10">
                <p className="text-xs text-gray-400 leading-relaxed">Nothing waiting.<br />Add a task to get started.</p>
              </div>
            )}
            {tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(provided, snapshot) => (
                  <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                    className={'border rounded-lg px-3 py-2.5 bg-white transition-all ' + (snapshot.isDragging ? 'border-indigo-300 shadow-lg rotate-1' : 'border-gray-200 hover:border-gray-300')}
                    onMouseEnter={() => setHoverId(task.id)} onMouseLeave={() => setHoverId(null)}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-gray-800 leading-snug break-words flex-1">{task.title}</p>
                      {task.goal_id && goalMap[task.goal_id] && (
                        <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: goalMap[task.goal_id].color }} />
                      )}
                    </div>
                    {task.notes && <p className="text-xs text-gray-400 mt-1 truncate">{task.notes}</p>}
                    {!snapshot.isDragging && hoverId === task.id && (
                      <div className="flex gap-2 mt-1.5">
                        <button onClick={() => onEdit(task)} className="text-xs text-indigo-500 hover:text-indigo-700">Edit</button>
                        <button onClick={() => onDelete(task.id)} className="text-xs text-gray-300 hover:text-red-400">Delete</button>
                      </div>
                    )}
                    {!snapshot.isDragging && hoverId !== task.id && (
                      <p className="text-xs text-gray-400 mt-1.5">Drag to a day</p>
                    )}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      <div className="px-4 py-3 border-t border-gray-100 shrink-0">
        <p className="text-xs text-gray-400">Drag tasks onto any day to schedule them.</p>
      </div>
    </div>
  )
}

function parseProposals(text) {
  const proposals = []
  const taskRegex = /\[ADD_TASK:\s*([^\]]+)\]/g
  const goalRegex = /\[ADD_GOAL:\s*([^\]]+)\]/g
  let match
  while ((match = taskRegex.exec(text)) !== null) {
    proposals.push({ type: 'task', title: match[1].trim(), raw: match[0] })
  }
  while ((match = goalRegex.exec(text)) !== null) {
    proposals.push({ type: 'goal', title: match[1].trim(), raw: match[0] })
  }
  return proposals
}

function cleanText(text) {
  return text.replace(/\[ADD_TASK:[^\]]+\]/g, '').replace(/\[ADD_GOAL:[^\]]+\]/g, '').trim()
}

function Assistant({ goals, tasks, onAddTask, onAddGoal }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState({})

  const systemPrompt = 'You are a helpful planning assistant in a weekly planner app. You can propose tasks and goals for the user to add.\n\nWhen you want to propose a task, include [ADD_TASK: task title here] in your response.\nWhen you want to propose a goal, include [ADD_GOAL: goal title here] in your response.\nYou can propose multiple items. Always explain why you are suggesting them.\n\nUser goals:\n' + (goals.length > 0 ? goals.map(g => '- ' + g.title).join('\n') : 'None set.') + '\n\nCurrent tasks:\n' + (tasks.filter(t => t.status !== 'done').slice(0, 20).map(t => '- ' + t.title + (t.scheduled_date ? ' (scheduled)' : ' (inbox)')).join('\n') || 'None yet.') + '\n\nBe concise and practical.'

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + import.meta.env.VITE_GEMINI_API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: newMessages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
        })
      })
      const data = await res.json()
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Something went wrong.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Could not reach the assistant.' }])
    }
    setLoading(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  async function handleConfirm(proposal, msgIndex, propIndex) {
    const key = msgIndex + '-' + propIndex
    if (proposal.type === 'task') {
      await onAddTask(proposal.title, '', null, null)
    } else {
      const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4']
      await onAddGoal(proposal.title, colors[goals.length % colors.length])
    }
    setConfirmed(prev => ({ ...prev, [key]: true }))
  }

  const starters = ['What should I focus on today?', 'Suggest tasks for my goals', 'Help me break down a big goal']

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center pt-4">
            <p className="text-xs text-gray-400 leading-relaxed mb-4">Ask me to suggest tasks, break down goals, or help you plan your week.</p>
            {starters.map(s => (
              <button key={s} onClick={() => setInput(s)}
                className="block w-full text-left text-xs text-indigo-600 border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 rounded-lg px-3 py-2 mb-2 transition-colors">{s}</button>
            ))}
          </div>
        )}
        {messages.map((msg, msgIndex) => {
          const proposals = msg.role === 'assistant' ? parseProposals(msg.content) : []
          const displayText = msg.role === 'assistant' ? cleanText(msg.content) : msg.content
          return (
            <div key={msgIndex}>
              <div className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={'max-w-[90%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ' + (msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm')}>
                  {displayText}
                </div>
              </div>
              {proposals.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {proposals.map((proposal, propIndex) => {
                    const key = msgIndex + '-' + propIndex
                    const done = confirmed[key]
                    return (
                      <div key={propIndex} className="flex items-center justify-between border border-indigo-100 rounded-lg px-3 py-2 bg-indigo-50">
                        <div>
                          <span className="text-xs font-medium text-indigo-400 uppercase mr-2">{proposal.type}</span>
                          <span className="text-xs text-gray-700">{proposal.title}</span>
                        </div>
                        {done ? (
                          <span className="text-xs text-emerald-500 font-medium">Added ✓</span>
                        ) : (
                          <button onClick={() => handleConfirm(proposal, msgIndex, propIndex)}
                            className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-lg transition-colors shrink-0">
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
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2 text-xs text-gray-400">Thinking...</div>
          </div>
        )}
      </div>
      <div className="px-3 py-3 border-t border-gray-100 shrink-0">
        <div className="flex gap-2">
          <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
            placeholder="Ask something..." rows={1}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          <button onClick={sendMessage} disabled={!input.trim() || loading}
            className="px-3 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">Send</button>
        </div>
        <p className="text-xs text-gray-300 mt-1.5 text-center">Enter to send</p>
      </div>
    </div>
  )
}

export default function Sidebar({ tasks, goalMap, goals, allTasks, onAddTask, onAddGoal, onEdit, onDelete }) {
  const [tab, setTab] = useState('inbox')
  return (
    <div className="w-64 border-l border-gray-200 bg-white flex flex-col shrink-0 overflow-hidden">
      <div className="flex border-b border-gray-100 shrink-0">
        <button onClick={() => setTab('inbox')}
          className={'flex-1 py-2.5 text-xs font-medium transition-colors ' + (tab === 'inbox' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600')}>
          Inbox {tasks.length > 0 && <span className="ml-1 bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{tasks.length}</span>}
        </button>
        <button onClick={() => setTab('assistant')}
          className={'flex-1 py-2.5 text-xs font-medium transition-colors ' + (tab === 'assistant' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600')}>
          &#129302; Assistant
        </button>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'inbox' ? (
          <>
            <div className="px-4 py-2 flex justify-end shrink-0">
              <button onClick={onAddTask} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Add</button>
            </div>
            <Inbox tasks={tasks} goalMap={goalMap} onEdit={onEdit} onDelete={onDelete} />
          </>
        ) : (
          <Assistant goals={goals} tasks={allTasks} onAddTask={onAddTask} onAddGoal={onAddGoal} />
        )}
      </div>
    </div>
  )
}
