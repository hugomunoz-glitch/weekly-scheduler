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

const INSIGHT_CATEGORIES = {
  risk:        { emoji: '⚠️', label: 'Risk',        color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  blocked:     { emoji: '🔒', label: 'Blocked',     color: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb' },
  opportunity: { emoji: '💡', label: 'Opportunity', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  momentum:    { emoji: '🚀', label: 'Momentum',    color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  alignment:   { emoji: '🎯', label: 'Alignment',   color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
}

function buildContext(goals, tasks) {
  const vision = localStorage.getItem('schedulent_vision') || ''
  const mission = localStorage.getItem('schedulent_mission') || ''
  const today = format(new Date(), 'EEEE, MMMM d, yyyy')
  const activeTasks = tasks.filter(t => t.status !== 'done').slice(0, 30)
  const activeGoals = goals.filter(g => g.status !== 'done')

  let ctx = `Today is ${today}.\n\n`
  if (vision) ctx += `Vision:\n${vision}\n\n`
  if (mission) ctx += `Mission:\n${mission}\n\n`
  ctx += `Goals (${activeGoals.length} active):\n`
  ctx += activeGoals.map(g => `- ${g.title}${g.prerequisite_goal_id && !g.is_unlocked ? ' [LOCKED]' : ''}`).join('\n') || 'No active goals.'
  ctx += `\n\nActive Tasks (${activeTasks.length}):\n`
  ctx += activeTasks.map(t => `- ${t.title}${t.scheduled_date ? ` (${t.scheduled_date})` : ' (inbox)'}`).join('\n') || 'No active tasks.'
  return ctx
}

function buildSystemPrompt(goals, tasks, mode) {
  const context = buildContext(goals, tasks)
  const base = `You are an expert life coach and planning assistant embedded in Schedulent.\n\n${context}\n\n`

  const modeInstructions = {
    chat: 'Help the user think through priorities, break down goals, overcome obstacles, and take action. Be concise, direct, and practical. Keep responses under 150 words unless more is needed.',

    brief: `Return ONLY a valid JSON object — no markdown, no explanation, no code fences. Schema:
{
  "priorities": [
    { "title": "short action phrase", "why": "one sentence on why this matters most" },
    { "title": "...", "why": "..." },
    { "title": "...", "why": "..." }
  ],
  "goalProgress": [
    { "name": "goal name", "status": "on_track|at_risk|blocked", "note": "one short sentence" }
  ],
  "risks": ["short risk description", "..."],
  "keyInsight": "one punchy sentence — the single most important thing to know this week"
}
Be specific to the user's actual goals and tasks. No placeholder text.`,

    insights: `Return ONLY a valid JSON array — no markdown, no explanation, no code fences. Each element:
{
  "category": "risk|blocked|opportunity|momentum|alignment",
  "headline": "short bold claim (max 8 words)",
  "detail": "one or two concrete sentences explaining the insight and what to do about it"
}
Return 4–5 insights. Base them strictly on the user's actual goals and tasks. No generic advice.`,

    reflect: 'You are a coaching guide. Start with one warm, open-ended question to kick off a weekly reflection. Wait for their response before asking follow-ups. Do not dump all questions at once. Keep it conversational.',
  }

  return base + (modeInstructions[mode] || modeInstructions.chat)
}

function parseJSON(text) {
  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
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

// ── Structured renderers ──────────────────────────────────────────────────────

function BriefCard({ data }) {
  const statusStyle = {
    on_track: { color: '#059669', bg: '#f0fdf4', label: 'On track' },
    at_risk:  { color: '#d97706', bg: '#fffbeb', label: 'At risk' },
    blocked:  { color: '#9ca3af', bg: '#f9fafb', label: 'Blocked' },
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Priorities */}
      <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Top 3 Priorities</p>
      {data.priorities?.map((p, i) => (
        <div key={i} style={{ background: i === 0 ? '#eef2ff' : '#f9fafb', border: `1px solid ${i === 0 ? '#c7d2fe' : '#e5e7eb'}`, borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: i === 0 ? '#4f46e5' : '#d1d5db', minWidth: 24, lineHeight: 1.3 }}>{i + 1}</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{p.title}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.45 }}>{p.why}</p>
          </div>
        </div>
      ))}

      {/* Goal progress */}
      {data.goalProgress?.length > 0 && <>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '4px 0 0' }}>Goal Progress</p>
        {data.goalProgress.map((g, i) => {
          const s = statusStyle[g.status] || statusStyle.on_track
          return (
            <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#374151' }}>{g.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af', lineHeight: 1.4 }}>{g.note}</p>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: s.color, background: s.bg, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>{s.label}</span>
            </div>
          )
        })}
      </>}

      {/* Risks */}
      {data.risks?.length > 0 && <>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '4px 0 0' }}>Risks & Blockers</p>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>
          {data.risks.map((r, i) => (
            <p key={i} style={{ margin: i > 0 ? '4px 0 0' : 0, fontSize: 12, color: '#dc2626', lineHeight: 1.45 }}>⚠️ {r}</p>
          ))}
        </div>
      </>}

      {/* Key insight */}
      {data.keyInsight && <>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '4px 0 0' }}>Key Insight</p>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#92400e', fontStyle: 'italic', lineHeight: 1.5 }}>💡 {data.keyInsight}</p>
        </div>
      </>}
    </div>
  )
}

function InsightCards({ data }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((item, i) => {
        const cat = INSIGHT_CATEGORIES[item.category] || INSIGHT_CATEGORIES.opportunity
        return (
          <div key={i} style={{ background: cat.bg, border: `1px solid ${cat.border}`, borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 14 }}>{cat.emoji}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{cat.label}</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1f2937', lineHeight: 1.4 }}>{item.headline}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{item.detail}</p>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AIAssistant({ goals = [], tasks = [], open, onClose, trigger }) {
  const { messages: chatMessages, loading: historyLoading, addMessage: addChatMessage, clearHistory } = useAssistantHistory()
  const [mode, setMode] = useState('chat')
  const [tabMessages, setTabMessages] = useState({ brief: [], insights: [], reflect: [] })
  const [tabStructured, setTabStructured] = useState({ brief: null, insights: null })
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
  }, [messages, mode, tabStructured])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    if (open && trigger?.id && seededRef.current !== trigger.id && !historyLoading) {
      seededRef.current = trigger.id
      if (trigger.msg) { setMode('chat'); setInput(trigger.msg) }
    }
    if (!open) seededRef.current = null
  }, [open, trigger, historyLoading])

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
      if (targetMode === 'brief' || targetMode === 'insights') {
        const parsed = parseJSON(reply)
        if (parsed) setTabStructured(prev => ({ ...prev, [targetMode]: parsed }))
      }
    } catch (err) {
      setTabMessages(prev => ({ ...prev, [targetMode]: [...prev[targetMode], { role: 'assistant', content: `⚠️ ${err.message}` }] }))
    }
    setTabLoading(prev => ({ ...prev, [targetMode]: false }))
  }

  function refreshTab() {
    autoTriggeredRef.current[mode] = false
    setTabMessages(prev => ({ ...prev, [mode]: [] }))
    setTabStructured(prev => ({ ...prev, [mode]: null }))
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

  // For brief/insights, show structured cards if parsed; otherwise fall back to raw messages
  const showStructured = (mode === 'brief' || mode === 'insights') && tabStructured[mode]
  // Reflect and chat follow-up messages shown as bubbles
  const visibleMessages = messages.filter(m => !(m.role === 'user' && AUTO_PROMPTS[mode] && m.content === AUTO_PROMPTS[mode]))

  const panel = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9990, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }} onClick={onClose} />
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: '420px',
        background: '#f9fafb', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)',
        borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column',
        pointerEvents: 'auto', zIndex: 9991,
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 0', borderBottom: '1px solid #e5e7eb', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>✦</span>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', margin: 0 }}>AI Assistant</p>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Powered by Gemini</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {mode === 'chat' && chatMessages.length > 0 && (
                <button onClick={clearHistory} style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px' }}>Clear</button>
              )}
              {mode !== 'chat' && tabMessages[mode]?.length > 0 && (
                <button onClick={refreshTab} style={{ fontSize: '11px', color: '#6366f1', background: '#eef2ff', border: '1px solid #c7d2fe', cursor: 'pointer', padding: '3px 8px', borderRadius: '6px', fontWeight: 500 }}>↻ Refresh</button>
              )}
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px', padding: '4px', lineHeight: 1 }}>✕</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0' }}>
            {MODES.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)} style={{
                flex: 1, padding: '7px 4px', fontSize: '12px',
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

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Structured brief/insights cards */}
          {showStructured && mode === 'brief' && <BriefCard data={tabStructured.brief} />}
          {showStructured && mode === 'insights' && <InsightCards data={tabStructured.insights} />}

          {/* Loading spinner */}
          {loading && !showStructured && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '10px 14px', fontSize: '13px', color: '#9ca3af' }}>Generating…</div>
            </div>
          )}
          {loading && showStructured && (
            <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>Refreshing…</p>
          )}

          {/* Chat starters */}
          {mode === 'chat' && chatMessages.length === 0 && !chatLoading && (
            <div style={{ paddingTop: '4px' }}>
              <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.6, marginBottom: '12px', textAlign: 'center' }}>Ask anything about your goals, tasks, or priorities.</p>
              {CHAT_STARTERS.map(s => (
                <button key={s} onClick={() => sendMessage(s)} style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: '12px', color: '#4f46e5', border: '1px solid #e0e7ff', borderRadius: '8px', padding: '8px 12px', marginBottom: '8px', background: 'white', cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Message bubbles — chat always; reflect always; brief/insights only when no structured data */}
          {(mode === 'chat' || mode === 'reflect' || !showStructured) && visibleMessages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '90%',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                padding: '10px 14px', fontSize: '13px', lineHeight: 1.55, whiteSpace: 'pre-wrap',
                background: msg.role === 'user' ? '#4f46e5' : 'white',
                color: msg.role === 'user' ? 'white' : '#1f2937',
                border: msg.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
                boxShadow: msg.role === 'assistant' ? '0 1px 4px rgba(0,0,0,0.04)' : 'none',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Follow-up messages after structured brief/insights */}
          {showStructured && visibleMessages.filter(m => m.role !== 'assistant' || visibleMessages.indexOf(m) > 0).slice(2).map((msg, i) => (
            <div key={'fu' + i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '90%',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                padding: '10px 14px', fontSize: '13px', lineHeight: 1.55, whiteSpace: 'pre-wrap',
                background: msg.role === 'user' ? '#4f46e5' : 'white',
                color: msg.role === 'user' ? 'white' : '#1f2937',
                border: msg.role === 'assistant' ? '1px solid #e5e7eb' : 'none',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', background: 'white' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={
                mode === 'brief' ? 'Ask a follow-up about your brief…' :
                mode === 'insights' ? 'Dig deeper into an insight…' :
                mode === 'reflect' ? 'Reply to continue your reflection…' :
                'Ask anything…'
              }
              rows={2}
              style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', resize: 'none', outline: 'none', lineHeight: 1.5, fontFamily: 'inherit', background: '#f9fafb' }}
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
