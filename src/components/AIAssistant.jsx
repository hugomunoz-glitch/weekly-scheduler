import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAssistantHistory } from '../hooks/useAssistantHistory'
import { format } from 'date-fns'

const MODES = [
  { id: 'chat', label: 'Chat' },
  { id: 'brief', label: 'Brief' },
  { id: 'insights', label: 'Insights' },
  { id: 'reflect', label: 'Reflect' },
]

const MODE_STARTERS = {
  chat: [
    'What should I focus on today?',
    'Help me break down a big goal',
    "I don't know where to start",
  ],
  brief: [
    'Give me my weekly brief',
    "What's my top priority this week?",
    'Summarize my goals and progress',
  ],
  insights: [
    "What patterns do you see in my goals?",
    'Which of my goals are at risk?',
    'Am I spreading myself too thin?',
  ],
  reflect: [
    'Guide me through a weekly reflection',
    'What went well this week?',
    'Help me identify what to improve',
  ],
}

function buildSystemPrompt(goals, tasks, mode) {
  const vision = localStorage.getItem('schedulent_vision') || ''
  const mission = localStorage.getItem('schedulent_mission') || ''
  const today = format(new Date(), 'EEEE, MMMM d, yyyy')
  const activeTasks = tasks.filter(t => t.status !== 'done').slice(0, 30)
  const activeGoals = goals.filter(g => g.status !== 'done')

  let context = `Today is ${today}.\n\n`
  if (vision) context += `User's Vision:\n${vision}\n\n`
  if (mission) context += `User's Mission:\n${mission}\n\n`
  context += `Goals (${activeGoals.length} active):\n`
  context += activeGoals.map(g => `- ${g.title}${g.prerequisite_goal_id && !g.is_unlocked ? ' [LOCKED]' : ''}`).join('\n') || 'No active goals.'
  context += `\n\nActive Tasks (${activeTasks.length}):\n`
  context += activeTasks.map(t => `- ${t.title}${t.scheduled_date ? ` (${t.scheduled_date})` : ' (inbox)'}${t.status === 'done' ? ' ✓' : ''}`).join('\n') || 'No active tasks.'

  const base = `You are an expert life coach and planning assistant embedded in Schedulent, the user's personal planning app. You have full context on their vision, mission, goals, and tasks.\n\n${context}\n\n`

  const modeInstructions = {
    chat: 'Help the user think through priorities, break down goals, overcome obstacles, and take action. Be concise, direct, and practical. Suggest specific next steps. Keep responses under 150 words unless complexity demands more.',
    brief: 'Provide a structured weekly brief. Cover: (1) Top 3 priorities for the week, (2) Goal progress summary, (3) Key risks or blockers, (4) One key insight. Use headers and bullet points. Be concrete.',
    insights: 'Analyze the user\'s goals and tasks for patterns, risks, and opportunities. Look for: goal alignment with vision/mission, overcommitment signals, locked/blocked goals, tasks without goal alignment, momentum indicators. Give 3–5 specific insights with clear implications.',
    reflect: 'Guide a structured reflection. Ask thoughtful coaching questions about: what moved forward, what got stuck, what surprised them, what they learned, and what one thing they\'d do differently. Be a compassionate but challenging coach.',
  }

  return base + modeInstructions[mode] || modeInstructions.chat
}

export default function AIAssistant({ goals = [], tasks = [], open, onClose, trigger }) {
  const { messages, loading: historyLoading, addMessage, clearHistory } = useAssistantHistory()
  const [mode, setMode] = useState('chat')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const seededRef = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    if (open && trigger?.id && seededRef.current !== trigger.id && !historyLoading) {
      seededRef.current = trigger.id
      if (trigger.msg) setInput(trigger.msg)
    }
    if (!open) seededRef.current = null
  }, [open, trigger, historyLoading])

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim()
    if (!content || loading) return
    const userMessage = { role: 'user', content }
    const contextMessages = [...messages, userMessage]
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
          max_tokens: 1024,
          system: buildSystemPrompt(goals, tasks, mode),
          messages: contextMessages,
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
  }, [input, loading, messages, addMessage, goals, tasks, mode])

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const starters = MODE_STARTERS[mode] || MODE_STARTERS.chat

  if (!open) return null

  const panel = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9990, pointerEvents: 'none' }}>
      {/* backdrop - only captures clicks */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }} onClick={onClose} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '400px',
          background: 'white',
          boxShadow: '-4px 0 32px rgba(0,0,0,0.12)',
          borderLeft: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
          zIndex: 9991,
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 0', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>✦</span>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', margin: 0 }}>AI Assistant</p>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Powered by Claude</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {messages.length > 0 && (
                <button onClick={clearHistory} title="Clear history"
                  style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px' }}>
                  Clear
                </button>
              )}
              <button onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px', padding: '4px', lineHeight: 1 }}>
                ✕
              </button>
            </div>
          </div>
          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '0' }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: mode === m.id ? 600 : 400,
                  color: mode === m.id ? '#4f46e5' : '#6b7280',
                  background: 'none',
                  border: 'none',
                  borderBottom: mode === m.id ? '2px solid #4f46e5' : '2px solid transparent',
                  cursor: 'pointer',
                  borderRadius: '0',
                  transition: 'color 0.15s',
                }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {messages.length === 0 && (
            <div style={{ paddingTop: '8px' }}>
              <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.6, marginBottom: '12px', textAlign: 'center' }}>
                {mode === 'chat' && 'Ask anything about your goals, tasks, or priorities.'}
                {mode === 'brief' && 'Get a structured summary of your week ahead.'}
                {mode === 'insights' && 'Discover patterns and opportunities in your planning.'}
                {mode === 'reflect' && 'Guided reflection to close out the week and improve.'}
              </p>
              {starters.map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: '12px', color: '#4f46e5', border: '1px solid #e0e7ff', borderRadius: '8px', padding: '8px 12px', marginBottom: '8px', background: '#fafafe', cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '88%',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '10px 14px',
                fontSize: '13px',
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
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '16px 16px 16px 4px', padding: '10px 14px', fontSize: '13px', color: '#9ca3af' }}>
                <span style={{ display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }}>Thinking…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', background: 'white' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={mode === 'brief' ? 'Ask for your brief…' : mode === 'insights' ? 'Ask for insights…' : mode === 'reflect' ? 'Start your reflection…' : 'Ask anything…'}
              rows={2}
              style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', resize: 'none', outline: 'none', lineHeight: 1.5, fontFamily: 'inherit' }}
            />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
              style={{ padding: '10px 14px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', opacity: (!input.trim() || loading) ? 0.45 : 1, whiteSpace: 'nowrap', fontWeight: 500 }}>
              Send
            </button>
          </div>
          <p style={{ fontSize: '11px', color: '#d1d5db', textAlign: 'center', marginTop: '6px', marginBottom: 0 }}>Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )

  return createPortal(panel, document.body)
}
