import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAssistantHistory() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('assistant_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100)
      if (error) console.error('Failed to load history:', error)
      if (data) setMessages(data.map(m => ({ role: m.role, content: m.content })))
      setLoading(false)
    }
    load()
  }, [])

  async function addMessage(role, content) {
    const msg = { role, content }
    setMessages(prev => [...prev, msg])
    const { error } = await supabase
      .from('assistant_messages')
      .insert({ role, content })
    if (error) console.error('Failed to save message:', error)
    return msg
  }

  async function clearHistory() {
    const { error } = await supabase
      .from('assistant_messages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) console.error('Failed to clear history:', error)
    else setMessages([])
  }

  return { messages, loading, addMessage, clearHistory }
}
