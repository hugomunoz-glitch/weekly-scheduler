import { useState, useEffect, useCallback } from 'react'
import { format, subDays, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Returns today's date as a UTC date string (YYYY-MM-DD).
// We always use UTC so that the same calendar day is consistent
// regardless of where the user is.
function utcDateStr(date) {
  return date.toISOString().slice(0, 10)
}

export default function DailyReflection({ onClose, isMobile = false, date }) {
  const { user } = useAuth()
  const targetUTC = date ? utcDateStr(parseISO(date)) : utcDateStr(new Date())
  const prevUTC = utcDateStr(subDays(parseISO(targetUTC), 1))

  const [todayReflection, setTodayReflection] = useState({ completed_notes: '', goals_notes: '' })
  const [yesterdayReflection, setYesterdayReflection] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadReflections = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('daily_reflections')
      .select('*')
      .eq('user_id', user.id)
      .in('date', [targetUTC, prevUTC])
    if (data) {
      const today = data.find(r => r.date === targetUTC)
      const yesterday = data.find(r => r.date === prevUTC)
      if (today) setTodayReflection({ completed_notes: today.completed_notes || '', goals_notes: today.goals_notes || '' })
      if (yesterday) setYesterdayReflection(yesterday)
    }
    setLoading(false)
  }, [user, targetUTC, prevUTC])

  useEffect(() => { loadReflections() }, [loadReflections])

  async function save() {
    if (!user) return
    setSaving(true)
    await supabase.from('daily_reflections').upsert({
      user_id: user.id,
      date: targetUTC,
      completed_notes: todayReflection.completed_notes,
      goals_notes: todayReflection.goals_notes,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,date' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const displayDate = parseISO(targetUTC)

  const containerStyle = isMobile ? {
    display: 'flex', flexDirection: 'column', height: '100%', background: 'white', overflow: 'hidden'
  } : {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 50
  }

  const panelStyle = isMobile ? {
    flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'
  } : {
    background: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px',
    margin: '16px', display: 'flex', flexDirection: 'column', maxHeight: '90vh'
  }

  const content = (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ padding: isMobile ? '16px 16px 12px' : '20px 24px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#111827' }}>Daily Reflection</h2>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9ca3af' }}>{format(displayDate, 'EEEE, MMMM d')}</p>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9ca3af', padding: '4px', lineHeight: 1 }}>×</button>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '20px 24px' }}>
        {loading ? (
          <p style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', marginTop: '32px' }}>Loading…</p>
        ) : (
          <>
            {/* Yesterday's goals — context for today */}
            {yesterdayReflection?.goals_notes && (
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px 14px', marginBottom: '20px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Yesterday's intentions
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {yesterdayReflection.goals_notes}
                </p>
              </div>
            )}

            {/* Today: what got done */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                What did you actually get done today?
              </label>
              <textarea
                value={todayReflection.completed_notes}
                onChange={e => setTodayReflection(r => ({ ...r, completed_notes: e.target.value }))}
                placeholder="Wins, completions, progress made…"
                rows={4}
                style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px', fontSize: '14px', resize: 'vertical', outline: 'none', fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box', lineHeight: 1.5 }}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Today: intentions for tomorrow */}
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                What are your intentions for tomorrow?
              </label>
              <textarea
                value={todayReflection.goals_notes}
                onChange={e => setTodayReflection(r => ({ ...r, goals_notes: e.target.value }))}
                placeholder="Top priorities, goals, things not to forget…"
                rows={4}
                style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px', fontSize: '14px', resize: 'vertical', outline: 'none', fontFamily: 'inherit', color: '#111827', boxSizing: 'border-box', lineHeight: 1.5 }}
                onFocus={e => e.target.style.borderColor = '#6366f1'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      {!loading && (
        <div style={{ padding: isMobile ? '12px 16px' : '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
          {saved && <span style={{ fontSize: '13px', color: '#10b981', fontWeight: 500 }}>Saved ✓</span>}
          <button
            onClick={save}
            disabled={saving}
            style={{ padding: '10px 20px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )

  if (isMobile) return content

  return (
    <div style={containerStyle} onClick={e => { if (e.target === e.currentTarget) onClose?.() }}>
      {content}
    </div>
  )
}
