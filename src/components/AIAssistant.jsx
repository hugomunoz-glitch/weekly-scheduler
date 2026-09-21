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

// Auto-trigger prompts sent silently when switching to these tabs
const AUTO_PROMPTS = {
  brief: 'Generate my weekly brief now.',
  insights: 'Analyze my goals and tasks and give me your top insights.',
  reflect: 'Start a guided reflection for me. Ask me the first question.',
}

const CHAT_STARTERS = [
  'What should I focus on today?',
  'Help me break down a big goal',
  "I don't know where to start",
]

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
  context += activeTasks.map(t => `- ${t.title}${t.scheduled_date ? ` (${t.scheduled_date})` : ' (inbox)'}`).join('\n') || 'No active tasks.'

  const base = `You are an expert life coach and planning assistant embedded in Schedulent. You have full context on the user's vision, mission, goals, and tasks.\n\n${context}\n\n`

  const modeInstructions = {
    chat: 'Help the user think through priorities, break down goals, overcome obstacles, and take action. Be concise, direct, and practical. Keep responses under 150 words unless more is needed.',
    brief: 'Produce a structured weekly brief with these sections: **Top 3 Priorities This Week**, **Goal Progress**, **Risks & Blockers**, **Key Insight**. Use bold headers and bullet points. Be concrete and specific to the user\'s actual goals and tasks.',
    insights: 'Analyze the user\'s goals and tasks. Identify 3–5 specific insights covering: alignment with vision/mission, overcommitment or spreading too thin, locked/blocked goals, tasks with no goal, and momentum. Lead each insight with a bold label. Be direct and specific.',
    reflect: 'You are a coaching guide. Start with one warm, open-ended question to kick off a weekly reflection — something like "What felt most meaningful this week?" or "Where did you show up for yourself?" Wait for their response before asking follow-up questions. Do not dump all questions at once.',
  }

  return base + (modeInstructions[mode] || modeInstructions.chat)
}

async function callGemini(systemPrompt, messages) {
  const geminiMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: geminiMessages,
      }),
    }
  )
  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message || `API error ${response.status}`)
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.'
}

export default function AIAssistant({ goals = [], tasks = [], open, onClose, trigger }) {
  const { messages: chatMessages, loading: historyLoading, addMessage: addChatMessage, clearHistory } = useAssistantHistory()
  const [mode, setMode] = useState('chat')
  // Each non-chat tab has its own local message list
  const [tabMessages, setTabMessages] = useState({ brief: [], insights: [], reflect: [] })
  const [tabLoading, setTabLoading] = useState({ brief: false, insights: false, reflect: false })
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const seededRef = useRef(null)
  const autoTriggeredRef = useRef({ brief: false, insights: false, reflect: false })

  const messages = mode === 'chat' ? chatMessages : (tabMessages[mode] || [])
  const loading = mode === 'chat' ? chatLoading : tabLoading[mode]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, mode])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Seed input from trigger (goal card "Ask AI")
  useEffect(() => {
    if (open && trigger?.id && seededRef.current !== trigger.id && !historyLoading) {
      seededRef.current = trigger.id
      if (trigger.msg) { setMode('chat'); setInput(trigger.msg) }
    }
    if (!open) seededRef.current = null
  }, [open, trigger, historyLoading])

  // Auto-generate when switching to brief/insights/reflect for the first time
  useEffect(() => {
    if (!open || mode === 'chat') return
    if (autoTriggeredRef.current[mode]) return
    autoTriggeredRef.current[mode] = true
    autoGenerate(mode)
  }, [open, mode])

  async function autoGenerate(targetMode) {
    const prompt = AUTO_PROMPTS[targetMode]
    if (!prompt) return
    const userMsg = { role: 'user', content: prompt }
    setTabMessages(prev => ({ ...prev, [targetMode]: [userMsg] }))
    setTabLoading(prev => ({ ...prev, [targetMode]: true }))
    try {
      const reply = await callGemini(buildSystemPrompt(goals, tasks, targetMode), [userMsg])
      setTabMessages(prev => ({ ...prev, [targetMode]: [...prev[targetMode], { role: 'assistant', content: reply }] }))
    } catch (err) {
      setTabMessages(prev => ({ ...prev, [targetMode]: [...prev[targetMode], { role: 'assistant', content: `⚠️ ${err.message}` }] }))
    }
    setTabLoading(prev => ({ ...prev, [targetMode]: false }))
  }

  function refreshTab() {
    autoTriggeredRef.current[mode] = false
    setTabMessages(prev => ({ ...prev, [mode]: [] }))
    autoTriggeredRef.current[mode] = true
    autoGenerate(mode)
  }

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim()
    if (!content || loading) return
    setInput('')

    if (mode === 'chat') {
      const userMessage = { role: 'user', content }
      const contextMessages = [...chatMessages, userMessage]
      await addChatMessage('user', content)
      setChatLoading(true)
      try {
        const reply = await callGemini(buildSystemPrompt(goals, tasks, 'chat'), contextMessages)
        await addChatMessage('assistant', reply)
      } catch (err) {
        await addChatMessage('assistant', `⚠️ ${err.message}`)
      }
      setChatLoading(false)
    } else {
      const userMsg = { role: 'user', content }
      const newMsgs = [...(tabMessages[mode] || []), userMsg]
      setTabMessages(prev => ({ ...prev, [mode]: newMsgs }))
      setTabLoading(prev => ({ ...prev, [mode]: true }))
      try {
        const reply = await callGemini(buildSystemPrompt(goals, tasks, mode), newMsgs)
        setTabMessages(prev => ({ ...prev, [mode]: [...newMsgs, { role: 'assistant', content: reply }] }))
      } catch (err) {
        setTabMessages(prev => ({ ...prev, [mode]: [...newMsgs, { role: 'assistant', content: `⚠️ ${err.message}` }] }))
      }
      setTabLoading(prev => ({ ...prev, [mode]: false }))
    }
  }, [input, loading, mode, chatMessages, tabMessages, addChatMessage, goals, tasks])

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  if (!open) return null

  const panel = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9990, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }} onClick={onClose} />
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: '400px',
        background: 'white', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)',
        borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column',
        pointerEvents: 'auto', zIndex: 9991,
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 0', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>✦</span>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', margin: 0 }}>AI Assistant</p>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Powered by Gemini</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {mode === 'chat' && chatMessages.length > 0 && (
                <button onClick={clearHistory} style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px' }}>Clear</button>
              )}
              {mode !== 'chat' && tabMessages[mode]?.length > 0 && (
                <button onClick={refreshTab} title="Regenerate" style={{ fontSize: '11px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px' }}>↻ Refresh</button>
              )}
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px', padding: '4px', lineHeight: 1 }}>✕</button>
            </div>
          </div>
          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)} style={{
                padding: '6px 14px', fontSize: '12px',
                fontWeight: mode === m.id ? 600 : 400,
                color: mode === m.id ? '#4f46e5' : '#6b7280',
                background: 'none', border: 'none',
                borderBottom: mode === m.id ? '2px solid #4f46e5' : '2px solid transparent',
                cursor: 'pointer', transition: 'color 0.15s',
              }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mode === 'chat' && messages.length === 0 && !loading && (
            <div style={{ paddingTop: '8px' }}>
              <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.6, marginBottom: '12px', textAlign: 'center' }}>
                Ask anything about your goals, tasks, or priorities.
              </p>
              {CHAT_STARTERS.map(s => (
                <button key={s} onClick={() => sendMessage(s)} style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: '12px', color: '#4f46e5', border: '1px solid #e0e7ff', borderRadius: '8px', padding: '8px 12px', marginBottom: '8px', background: '#fafafe', cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.filter(m => !(m.role === 'user' && AUTO_PROMPTS[mode] && m.content === AUTO_PROMPTS[mode])).map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '88%',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '10px 14px', fontSize: '13px', lineHeight: 1.55, whiteSpace: 'pre-wrap',
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
                Generating…
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
              placeholder={mode === 'brief' ? 'Follow up on your brief…' : mode === 'insights' ? 'Dig deeper into an insight…' : mode === 'reflect' ? 'Reply to continue your reflection…' : 'Ask anything…'}
              rows={2}
              style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', resize: 'none', outline: 'none', lineHeight: 1.5, fontFamily: 'inherit' }}
            />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{ padding: '10px 14px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', opacity: (!input.trim() || loading) ? 0.45 : 1, whiteSpace: 'nowrap', fontWeight: 500 }}>
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
