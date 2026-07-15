import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAssistantHistory } from '../hooks/useAssistantHistory'

export default function AIAssistant({ goals, tasks }) {
  const [open, setOpen] = useState(false)
  const { messages, loading: historyLoading, addMessage } = useAssistantHistory()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const systemPrompt = 'You are a helpful planning assistant built into a weekly planner app. You help the user think through tasks, break down complex goals, prioritize work, and get unstuck.\n\nUser goals:\n' + (goals.length > 0 ? goals.map(g => '- ' + g.title).join('\n') : 'No goals set yet.') + '\n\nCurrent tasks:\n' + (tasks.filter(t => t.status !== 'done').slice(0, 20).map(t => '- ' + t.title + (t.scheduled_date ? ' (scheduled)' : ' (inbox)')).join('\n') || 'No tasks yet.') + '\n\nBe concise, practical, and encouraging. Suggest specific next actions. Keep responses short.'

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMessage = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    await addMessage('user', input.trim())
    setInput('')
    setLoading(true)
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: newMessages
        })
      })
      const data = await response.json()
      const reply = data.content?.[0]?.text || 'Sorry, something went wrong.'
      await addMessage('assistant', reply)
    } catch (err) {
      await addMessage('assistant', 'Could not reach the assistant. Check your API key.')
    }
    setLoading(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const starters = [
    'What should I focus on today?',
    'Help me break down a big goal',
    'I do not know where to start'
  ]

  const btnStyle = {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 99999,
    width: '48px',
    height: '48px',
    background: '#4f46e5',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '20px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }

  const panelStyle = {
    position: 'fixed',
    bottom: '88px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 99999,
    width: '320px',
    height: '500px',
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column'
  }

  const ui = (
    <>
      <button style={btnStyle} onClick={() => setOpen(o => !o)} title="Planning Assistant">
        &#129302;
      </button>
      {open && (
        <div style={panelStyle}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>&#129302;</span>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', margin: 0 }}>Planning Assistant</p>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Powered by Claude</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: '14px' }}>&#x2715;</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: '16px' }}>
                <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.6, marginBottom: '16px' }}>
                  Stuck on something? Ask me to help you brainstorm, break down a goal, or figure out where to start.
                </p>
                {starters.map(s => (
                  <button key={s} onClick={() => { setInput(s); inputRef.current?.focus() }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: '12px', color: '#4f46e5', border: '1px solid #e0e7ff', borderRadius: '8px', padding: '8px 12px', marginBottom: '8px', background: 'white', cursor: 'pointer' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '85%', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '8px 12px', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap', background: msg.role === 'user' ? '#4f46e5' : '#f3f4f6', color: msg.role === 'user' ? 'white' : '#1f2937' }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: '#f3f4f6', borderRadius: '16px 16px 16px 4px', padding: '8px 12px', fontSize: '12px', color: '#9ca3af' }}>Thinking...</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div style={{ padding: '12px', borderTop: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask something..."
                rows={1}
                style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', resize: 'none', outline: 'none' }}
              />
              <button onClick={sendMessage} disabled={!input.trim() || loading}
                style={{ padding: '8px 12px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', opacity: (!input.trim() || loading) ? 0.4 : 1 }}>
                Send
              </button>
            </div>
            <p style={{ fontSize: '11px', color: '#d1d5db', textAlign: 'center', marginTop: '6px' }}>Enter to send</p>
          </div>
        </div>
      )}
    </>
  )

  return createPortal(ui, document.body)
}
