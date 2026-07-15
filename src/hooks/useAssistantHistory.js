import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAssistantHistory() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('assistant_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100)
      if (data) setMessages(data.map(m => ({ role: m.role, content: m.content })))
      setLoading(false)
    }
    load()
  }, [])

  async function addMessage(role, content) {
    const msg = { role, content }
    setMessages(prev => [...prev, msg])
    await supabase.from('assistant_messages').insert({ role, content })
    return msg
  }

  async function clearHistory() {
    await supabase.from('assistant_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setMessages([])
  }

  return { messages, loading, addMessage, clearHistory }
}
