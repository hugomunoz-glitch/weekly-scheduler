import { useState } from 'react'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import { useAssistantHistory } from '../hooks/useAssistantHistory'
import { categoryBadge } from './TaskCard'

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }
const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#9ca3af' }
const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' }
const PRIORITY_BORDER = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }

function Inbox({ tasks, goalMap, collabMap, collabMembersMap, onAssignTask, onEdit, onDelete, search, sortMode, sortDir, categoryFilter }) {
  const [hoverId, setHoverId] = useState(null)
  const searched = search && search.trim() ? tasks.filter(t => t.title.toLowerCase().includes(search.trim().toLowerCase())) : tasks
  const filteredTasks = categoryFilter && categoryFilter !== 'all' ? searched.filter(t => t.category === categoryFilter) : searched
  const visibleTasks = [...filteredTasks].sort((a, b) => {
    const aDone = a.status === 'done', bDone = b.status === 'done'
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
    <div className="flex flex-col h-full">
      <Droppable droppableId="inbox">
        {(provided, snapshot) => (
          <div ref={provided.innerRef} {...provided.droppableProps}
            className={'flex-1 overflow-y-auto p-3 space-y-2 min-h-[60px] transition-colors ' + (snapshot.isDraggingOver ? 'bg-indigo-50' : '')}>
            {visibleTasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="text-center pt-10">
                <p className="text-xs text-gray-400 leading-relaxed">{search && search.trim() ? 'No matching tasks.' : <>Nothing waiting.<br />Add a task to get started.</>}</p>
              </div>
            )}
            {visibleTasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(provided, snapshot) => (
                  <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                    className={'relative group border rounded-lg px-3 py-2.5 bg-white transition-colors ' + (snapshot.isDragging ? 'border-indigo-300 shadow-lg' : 'border-gray-200 hover:border-gray-300')}
                    style={{ ...provided.draggableProps.style, ...(task.priority && PRIORITY_BORDER[task.priority] ? { borderLeft: '4px solid ' + PRIORITY_BORDER[task.priority] } : {}) }}
                    title={task.priority ? PRIORITY_LABELS[task.priority] + ' priority' : undefined}
                    onMouseEnter={() => setHoverId(task.id)} onMouseLeave={() => setHoverId(null)}>
                    {!snapshot.isDragging && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
                        className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 text-white text-[9px] font-semibold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
                        title="Delete task"
                      >
                        &#10005;
                      </button>
                    )}
                    <p className="text-sm text-gray-800 leading-snug break-words">
                      {task.title}
                      {task.collaboration_id && collabMap && collabMap[task.collaboration_id] && (
                        <span
                          className="inline-block w-2 h-2 rounded-full ml-1.5 align-middle"
                          style={{ background: collabMap[task.collaboration_id].color }}
                          title={'Shared with: ' + collabMap[task.collaboration_id].name}
                        />
                      )}
                    </p>
                    {(categoryBadge(task.category) || (task.collaboration_id && collabMembersMap && collabMembersMap[task.collaboration_id] && collabMembersMap[task.collaboration_id].length > 0)) && (
                      <div className="flex items-center gap-1.5 mt-1">
                        {categoryBadge(task.category) && (
                          <span
                            className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                            style={{ color: categoryBadge(task.category).color, background: categoryBadge(task.category).color + '1a' }}
                            title={'Category: ' + categoryBadge(task.category).name}
                          >
                            {categoryBadge(task.category).name}
                          </span>
                        )}
                        {task.collaboration_id && collabMembersMap && collabMembersMap[task.collaboration_id] && collabMembersMap[task.collaboration_id].length > 0 && (
                          <select
                            value={task.assigned_to || ''}
                            onChange={(e) => { e.stopPropagation(); onAssignTask(task.id, e.target.value || null) }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="text-[10px] border border-gray-200 rounded px-1 py-0.5 focus:outline-none"
                            title="Assign to"
                          >
                            <option value="">Unassigned</option>
                            {collabMembersMap[task.collaboration_id].map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                          </select>
                        )}
                      </div>
                    )}
                    {task.notes && <p className="text-xs text-gray-400 mt-1 truncate">{task.notes}</p>}
                    {!snapshot.isDragging && hoverId === task.id && (
                      <div className="flex gap-2 mt-1.5">
                        <button onClick={() => onEdit(task)} className="text-[27px] text-indigo-400 hover:text-indigo-600 leading-none" title="Edit">&#9998;</button>
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
      <div className="px-4 py-3 border-t border-gray-100 shrink-0">
        <p className="text-xs text-gray-400">Drag tasks onto any day to schedule them.</p>
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

function Assistant({ goals, tasks, onCreateTask, onAddGoal }) {
  const { messages, loading: historyLoading, addMessage, clearHistory } = useAssistantHistory()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState({})

  const systemPrompt = 'You are a helpful planning assistant in a weekly planner app. You can propose tasks and goals.\n\nWhen proposing a task include [ADD_TASK: task title] in your response. If the task clearly supports one of the user\'s existing goals listed below, tag it with that exact goal title like this instead: [ADD_TASK: task title | goal: Goal Title].\nWhen proposing a goal include [ADD_GOAL: goal title] in your response.\nAlways explain why you suggest them. Be concise.\n\nUser goals:\n' + (goals.length > 0 ? goals.map(g => '- ' + g.title).join('\n') : 'None set.') + '\n\nCurrent tasks:\n' + (tasks.filter(t => t.status !== 'done').slice(0, 20).map(t => '- ' + t.title + (t.scheduled_date ? ' (scheduled)' : ' (inbox)')).join('\n') || 'None yet.')

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userContent = input.trim()
    setInput('')
    setLoading(true)
    await addMessage('user', userContent)
    const allMessages = [...messages, { role: 'user', content: userContent }]
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + import.meta.env.VITE_GEMINI_API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: allMessages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
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

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
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

  const starters = ['What should I focus on today?', 'Suggest tasks for my goals', 'Help me break down a big goal']

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {historyLoading && <p className="text-xs text-gray-400 text-center pt-4">Loading history...</p>}
        {!historyLoading && messages.length === 0 && (
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
                          {proposal.goalTitle && (
                            <div className="text-[11px] text-gray-400 mt-0.5">Goal: {proposal.goalTitle}</div>
                          )}
                        </div>
                        {done === true ? (
                          <span className="text-xs text-emerald-500 font-medium">Added ✓</span>
                        ) : done === 'error' ? (
                          <button onClick={() => handleConfirm(proposal, msgIndex, propIndex)}
                            className="text-xs text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded-lg transition-colors shrink-0">Failed, retry</button>
                        ) : (
                          <button onClick={() => handleConfirm(proposal, msgIndex, propIndex)}
                            className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-lg transition-colors shrink-0">Add</button>
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
        <div className="flex justify-end mb-1.5">
          <button onClick={clearHistory} className="text-xs text-gray-300 hover:text-red-400 transition-colors">Clear history</button>
        </div>
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

export default function Sidebar({ tasks, goalMap, collabMap, collabMembersMap, onAssignTask, goals, allTasks, onAddTask, onCreateTask, onAddGoal, onEdit, onDelete }) {
  const [tab, setTab] = useState('inbox')
  const [taskSearch, setTaskSearch] = useState('')
  const [showTaskSearch, setShowTaskSearch] = useState(false)
  const [taskSort, setTaskSort] = useState('manual')
  const [taskSortDir, setTaskSortDir] = useState(1)
  const [taskCategoryFilter, setTaskCategoryFilter] = useState('all')
  const taskCategories = [...new Set(allTasks.map(t => t.category).filter(Boolean))].sort()
  return (
    <div className="w-64 bg-white flex flex-col shrink-0 overflow-hidden h-full">
      <div className="flex border-b border-gray-100 shrink-0">
        <button onClick={() => setTab('inbox')}
          className={'flex-1 py-2.5 text-xs font-medium transition-colors ' + (tab === 'inbox' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600 hover:text-gray-800')}>
          &#128221; Task List {tasks.filter(t => t.status !== 'done').length > 0 && <span className="ml-1 bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{tasks.filter(t => t.status !== 'done').length}</span>}
        </button>
        <button onClick={() => setTab('assistant')}
          className={'flex-1 py-2.5 text-xs font-medium transition-colors ' + (tab === 'assistant' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600 hover:text-gray-800')}>
          &#129302; Assistant
        </button>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'inbox' ? (
          <>
            <div className="px-4 py-2 flex justify-end items-center gap-2 shrink-0">
              {showTaskSearch ? (
                <input
                  autoFocus
                  type="text"
                  value={taskSearch}
                  onChange={e => setTaskSearch(e.target.value)}
                  onBlur={() => { if (!taskSearch.trim()) setShowTaskSearch(false) }}
                  placeholder="Search tasks…"
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-32 focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400"
                />
              ) : (
                <button onClick={() => setShowTaskSearch(true)} className="text-gray-400 hover:text-indigo-500 transition-colors" title="Search tasks">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                </button>
              )}
              <button onClick={onAddTask} className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-2.5 py-1 font-medium" title="Add task">+</button>
            </div>
            <div className="px-4 pb-2 flex items-end gap-2 shrink-0 overflow-x-auto">
              <div className="flex flex-col gap-0.5 shrink-0">
                <span className="text-[10px] text-gray-400 font-medium leading-none">Sort by</span>
                <div className="flex items-center gap-1">
                  <select value={taskSort} onChange={e => setTaskSort(e.target.value)} style={{ width: '100px' }} className="shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300">
                    <option value="manual">Manual</option>
                    <option value="deadline">Deadline</option>
                    <option value="priority">Priority</option>
                    <option value="alpha">A-Z</option>
                    <option value="created">Date Created</option>
                  </select>
                  <button
                    onClick={() => setTaskSortDir(d => d * -1)}
                    className="text-gray-400 hover:text-indigo-500 border border-gray-200 rounded-lg p-1 transition-colors shrink-0"
                    title={taskSortDir === 1 ? 'Reverse order' : 'Reversed — click to restore'}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: taskSortDir === -1 ? 'scaleY(-1)' : 'none' }}>
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              <select value={taskCategoryFilter} onChange={e => setTaskCategoryFilter(e.target.value)} style={{ width: '105px' }} className="shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300" title="Filter by category">
                <option value="all">All Categories</option>
                {taskCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Inbox tasks={tasks} goalMap={goalMap} collabMap={collabMap} collabMembersMap={collabMembersMap} onAssignTask={onAssignTask} onEdit={onEdit} onDelete={onDelete} search={taskSearch} sortMode={taskSort} sortDir={taskSortDir} categoryFilter={taskCategoryFilter} />
          </>
        ) : (
          <Assistant goals={goals} tasks={allTasks} onCreateTask={onCreateTask} onAddGoal={onAddGoal} />
        )}
      </div>
    </div>
  )
}
