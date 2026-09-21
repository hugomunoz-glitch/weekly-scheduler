import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAssistantHistory } from '../hooks/useAssistantHistory'
import { format } from 'date-fns'

function buildSystemPrompt(goals, tasks) {
  const vision = localStorage.getItem('schedulent_vision') || ''
  const mission = localStorage.getItem('schedulent_mission') || ''
  const today = format(new Date(), 'EEEE, MMMM d, yyyy')
  const activeTasks = tasks.filter(t => t.status !== 'done').slice(0, 25)
  const activeGoals = goals.filter(g => g.status !== 'done')

  let ctx = `Today is ${today}.\n\n`
  if (vision) ctx += `Vision:\n${vision}\n\n`
  if (mission) ctx += `Mission:\n${mission}\n\n`
  ctx += `Goals:\n` + (activeGoals.map(g => `- ${g.title}${g.prerequisite_goal_id && !g.is_unlocked ? ' [LOCKED]' : ''}`).join('\n') || 'None yet.')
  ctx += `\n\nActive tasks:\n` + (activeTasks.map(t => `- ${t.title}${t.scheduled_date ? ` (${t.scheduled_date})` : ' (inbox)'}`).join('\n') || 'None yet.')

  return `You are an expert planning coach embedded in Schedulent. ${ctx}\n\nBe concise, warm, and actionable. Responses should be short — under 120 words — unless the user explicitly asks for more.`
}

const QUICK_REPLIES = [
  "What should I focus on today?",
  "What's my top priority?",
  "I'm feeling overwhelmed",
  "Help me reflect on my week",
]

export default function MobileAIAssistant({ goals = [], tasks = [], bottomOffset = 64, trigger }) {
  const [open, setOpen] = useState(false)
  const { messages, loading: historyLoading, addMessage, clearHistory } = useAssistantHistory()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const seededRef = useRef(false)

  // Draggable FAB position
  const [fabPos, setFabPos] = useState(() => {
    try {
      const saved = localStorage.getItem('ai_fab_pos')
      return saved ? JSON.parse(saved) : { right: 16, bottom: bottomOffset + 16 }
    } catch { return { right: 16, bottom: bottomOffset + 16 } }
  })
  const dragRef = useRef(null)
  const isDragging = useRef(false)
  const dragStart = useRef(null)

  function onFabPointerDown(e) {
    isDragging.current = false
    dragStart.current = { x: e.clientX, y: e.clientY, right: fabPos.right, bottom: fabPos.bottom }
    dragRef.current = { pointerId: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onFabPointerMove(e) {
    if (!dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    if (!isDragging.current && Math.abs(dx) < 5 && Math.abs(dy) < 5) return
    isDragging.current = true
    const newRight = Math.max(8, Math.min(window.innerWidth - 60, dragStart.current.right - dx))
    const newBottom = Math.max(bottomOffset + 8, Math.min(window.innerHeight - 60, dragStart.current.bottom - dy))
    const pos = { right: newRight, bottom: newBottom }
    setFabPos(pos)
    try { localStorage.setItem('ai_fab_pos', JSON.stringify(pos)) } catch {}
  }
  function onFabPointerUp(e) {
    if (!isDragging.current) {
      setOpen(true)
    }
    dragStart.current = null
    isDragging.current = false
  }

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300)
  }, [open])

  useEffect(() => {
    if (trigger?.id && !seededRef.current) {
      seededRef.current = trigger.id
      setOpen(true)
      if (trigger.msg) setInput(trigger.msg)
    }
  }, [trigger])

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim()
    if (!content || loading) return
    const userMsg = { role: 'user', content }
    const contextMsgs = [...messages, userMsg]
    await addMessage('user', content)
    setInput('')
    setLoading(true)
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 600,
          system: buildSystemPrompt(goals, tasks),
          messages: contextMsgs,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        const msg = data?.error?.message || `API error ${response.status}`
        await addMessage('assistant', `⚠️ ${msg}`)
      } else {
        const reply = data.content?.[0]?.text || 'No response from assistant.'
        await addMessage('assistant', reply)
      }
    } catch (err) {
      await addMessage('assistant', `⚠️ Could not reach the assistant: ${err?.message || 'network error'}. Make sure VITE_ANTHROPIC_API_KEY is set in your Vercel environment.`)
    }
    setLoading(false)
  }, [input, loading, messages, addMessage, goals, tasks])

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const ui = (
    <>
      {/* Draggable FAB */}
      <div
        onPointerDown={onFabPointerDown}
        onPointerMove={onFabPointerMove}
        onPointerUp={onFabPointerUp}
        style={{
          position: 'fixed',
          bottom: fabPos.bottom,
          right: fabPos.right,
          zIndex: 8000,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: 'white',
          boxShadow: '0 4px 16px rgba(79,70,229,0.45)',
          cursor: 'grab',
          fontSize: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          touchAction: 'none',
        }}
        aria-label="Open AI Assistant"
      >
        ✦
      </div>

      {/* Bottom sheet */}
      {open && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000 }}>
          {/* Scrim */}
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
            onClick={() => setOpen(false)}
          />
          {/* Sheet */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'white',
              borderRadius: '20px 20px 0 0',
              height: '82vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -4px 32px rgba(0,0,0,0.15)',
            }}
          >
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#d1d5db' }} />
            </div>

            {/* Header */}
            <div style={{ padding: '4px 16px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>✦</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#1f2937' }}>AI Assistant</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>Powered by Claude</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {messages.length > 0 && (
                  <button onClick={clearHistory} style={{ fontSize: 12, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
                )}
                <button onClick={() => setOpen(false)} style={{ fontSize: 18, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '4px' }}>✕</button>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 && (
                <div style={{ paddingTop: 8 }}>
                  <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', marginBottom: 16, lineHeight: 1.5 }}>
                    Your personal planning coach. Ask anything about your goals and priorities.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {QUICK_REPLIES.map(q => (
                      <button key={q} onClick={() => sendMessage(q)}
                        style={{ fontSize: 12, color: '#4f46e5', border: '1px solid #e0e7ff', borderRadius: 20, padding: '6px 14px', background: '#f5f3ff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '85%',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '10px 14px',
                    fontSize: 13,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    background: msg.role === 'user' ? '#4f46e5' : '#f9fafb',
                    color: msg.role === 'user' ? 'white' : '#1f2937',
                    border: msg.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '16px 16px 16px 4px', padding: '10px 14px', fontSize: 13, color: '#9ca3af' }}>Thinking…</div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick reply chips (when there are messages) */}
            {messages.length > 0 && messages.length < 6 && (
              <div style={{ padding: '8px 16px 0', display: 'flex', gap: 8, overflowX: 'auto' }}>
                {QUICK_REPLIES.slice(0, 3).map(q => (
                  <button key={q} onClick={() => sendMessage(q)}
                    style={{ fontSize: 11, color: '#4f46e5', border: '1px solid #e0e7ff', borderRadius: 20, padding: '4px 12px', background: '#f5f3ff', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{ padding: '10px 16px 16px', borderTop: '1px solid #f3f4f6', background: 'white' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask anything…"
                  rows={2}
                  style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 12px', fontSize: 14, resize: 'none', outline: 'none', lineHeight: 1.5, fontFamily: 'inherit' }}
                />
                <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                  style={{ padding: '10px 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer', opacity: (!input.trim() || loading) ? 0.45 : 1, fontWeight: 600 }}>
                  ↑
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )

  return ui
}
