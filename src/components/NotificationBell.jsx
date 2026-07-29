import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { registerServiceWorker, scheduleDailyNotifications, scheduleUpcomingReminders, requestNotificationPermission, getNotificationPermission } from '../lib/notifications'

const BUCKET_TIMES = {
  morning:   { hour: 8,  minute: 0,  label: 'Morning',   emoji: '🌅', defaultOn: true },
  afternoon: { hour: 12, minute: 0,  label: 'Afternoon', emoji: '☀️', defaultOn: true },
  evening:   { hour: 17, minute: 0,  label: 'Evening',   emoji: '🌙', defaultOn: true },
}

const PREFS_KEY = 'schedulent_notif_prefs'

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') } catch { return {} }
}
function savePrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch {}
}

function notifBucket(task) {
  if (task.start_time) {
    const [h] = task.start_time.split(':').map(Number)
    if (h >= 17) return 'evening'
    if (h >= 12) return 'afternoon'
    return 'morning'
  }
  // no start_time — use DB bucket name
  if (task.bucket === 'afternoon') return 'evening'    // Evening column
  if (task.bucket === 'midday') return 'afternoon'     // Afternoon column
  return 'morning'
}

function getTodayBuckets(tasks) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayTasks = tasks.filter(t =>
    t.scheduled_date && String(t.scheduled_date).slice(0, 10) === today && t.status !== 'done'
  )
  const buckets = { morning: [], afternoon: [], evening: [] }
  for (const t of todayTasks) buckets[notifBucket(t)].push(t)
  return buckets
}

// ── Toast ────────────────────────────────────────────────────────────────────

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [523.25, 659.25, 783.99] // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      const start = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35)
      osc.start(start)
      osc.stop(start + 0.35)
    })
  } catch {}
}

export function NotificationToast({ toast, onDismiss }) {
  useEffect(() => {
    playChime()
    const t = setTimeout(onDismiss, 7000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: 'white', border: '1px solid #e5e7eb',
      borderLeft: '4px solid #6366f1', borderRadius: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
      padding: '14px 16px', maxWidth: 320,
      display: 'flex', gap: 12, alignItems: 'flex-start',
      animation: 'slideInToast 0.25s ease',
    }}>
      <style>{`@keyframes slideInToast{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <span style={{ fontSize: 20, lineHeight: 1.2 }}>{toast.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#111827' }}>{toast.title}</p>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{toast.body}</p>
      </div>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, padding: 0, lineHeight: 1, flexShrink: 0 }}>✕</button>
    </div>
  )
}

// ── Settings panel ────────────────────────────────────────────────────────────

function NotifSettings({ onClose, prefs, onPrefsChange, permission, onRequestPermission }) {
  const enabled = prefs.enabled ?? true

  async function handleToggleEnabled() {
    if (!enabled) {
      if (permission !== 'granted') {
        const result = await onRequestPermission()
        if (result !== 'granted') return
      }
    }
    onPrefsChange({ ...prefs, enabled: !enabled })
  }

  function handleToggleBucket(bucket) {
    const buckets = prefs.buckets || { morning: true, afternoon: true, evening: true }
    onPrefsChange({ ...prefs, buckets: { ...buckets, [bucket]: !buckets[bucket] } })
  }

  const bucketPrefs = prefs.buckets || { morning: true, afternoon: true, evening: true }

  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#111827' }}>Notification settings</p>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, padding: 0 }}>✕</button>
      </div>

      {permission === 'denied' && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 10px', marginBottom: 12, fontSize: 11, color: '#92400e' }}>
          {window.Capacitor?.isNativePlatform?.()
            ? 'Notifications are blocked. Go to iPhone Settings → Schedulent → Notifications to allow them.'
            : 'Notifications are blocked in your browser. Go to your browser settings → Site permissions → Notifications to allow them.'}
        </div>
      )}

      {/* Master toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#111827' }}>Enable notifications</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>
            {permission === 'granted' ? 'Works even when your screen is locked' : 'Tap to grant permission'}
          </p>
        </div>
        <button
          onClick={handleToggleEnabled}
          disabled={permission === 'denied' || permission === 'unsupported'}
          style={{
            width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
            background: enabled && permission === 'granted' ? '#6366f1' : '#d1d5db',
            position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            opacity: permission === 'denied' || permission === 'unsupported' ? 0.5 : 1,
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: enabled && permission === 'granted' ? 21 : 3,
            width: 16, height: 16, borderRadius: '50%', background: 'white',
            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>

      {permission !== 'granted' && permission !== 'denied' && permission !== 'unsupported' && (
        <button
          onClick={onRequestPermission}
          style={{ width: '100%', padding: '8px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 14 }}
        >
          Allow notifications
        </button>
      )}

      {/* Bucket toggles */}
      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alert times</p>
        {Object.entries(BUCKET_TIMES).map(([bucket, { label, emoji, hour, minute }]) => (
          <div key={bucket} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{emoji}</span>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#374151' }}>{label}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>{hour <= 12 ? hour : hour - 12}:{String(minute).padStart(2, '0')} {hour < 12 ? 'AM' : 'PM'} ({hour}:{String(minute).padStart(2, '0')})</p>
              </div>
            </div>
            <button
              onClick={() => handleToggleBucket(bucket)}
              disabled={!enabled || permission !== 'granted'}
              style={{
                width: 34, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer',
                background: bucketPrefs[bucket] && enabled && permission === 'granted' ? '#6366f1' : '#d1d5db',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                opacity: !enabled || permission !== 'granted' ? 0.4 : 1,
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: bucketPrefs[bucket] && enabled && permission === 'granted' ? 17 : 2,
                width: 14, height: 14, borderRadius: '50%', background: 'white',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
        ))}
      </div>

      {/* 15-min reminder toggle */}
      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#374151' }}>⏰ 15-minute reminders</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>Alert before tasks with a set time</p>
          </div>
          <button
            onClick={() => onPrefsChange({ ...prefs, reminders15: !(prefs.reminders15 ?? true) })}
            disabled={!enabled || permission !== 'granted'}
            style={{
              width: 34, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer',
              background: (prefs.reminders15 ?? true) && enabled && permission === 'granted' ? '#6366f1' : '#d1d5db',
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              opacity: !enabled || permission !== 'granted' ? 0.4 : 1,
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: (prefs.reminders15 ?? true) && enabled && permission === 'granted' ? 17 : 2,
              width: 14, height: 14, borderRadius: '50%', background: 'white',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
        </div>
      </div>

      <p style={{ margin: '12px 0 0', fontSize: 10, color: '#d1d5db', textAlign: 'center' }}>
        Notifications fire for tasks scheduled today in each time slot.
      </p>
    </div>
  )
}

// ── Bell ──────────────────────────────────────────────────────────────────────

export default function NotificationBell({ tasks, isMobile = false }) {
  const [open, setOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState(null)
  const [permission, setPermission] = useState('default')
  const [prefs, setPrefs] = useState(loadPrefs)
  const ref = useRef(null)
  const firedRef = useRef(new Set())

  const buckets = getTodayBuckets(tasks)
  const count = Object.values(buckets).reduce((s, a) => s + a.length, 0)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setShowSettings(false) } }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Load permission state on mount (async-safe)
  useEffect(() => { getNotificationPermission().then(setPermission) }, [])

  // Register SW on mount
  useEffect(() => { registerServiceWorker() }, [])

  // Schedule push notifications via SW when tasks or prefs change
  useEffect(() => {
    if (permission !== 'granted' || !(prefs.enabled ?? true)) return
    const activeBuckets = prefs.buckets || { morning: true, afternoon: true, evening: true }
    const filteredTasks = tasks.filter(t => {
      const b = t.bucket || 'morning'
      return activeBuckets[b] !== false
    })
    scheduleDailyNotifications(filteredTasks)
    if (prefs.reminders15 ?? true) {
      scheduleUpcomingReminders(tasks)
    }
  }, [tasks, prefs, permission])

  // In-app toasts at bucket times
  useEffect(() => {
    if (!(prefs.enabled ?? true)) return
    const activeBuckets = prefs.buckets || { morning: true, afternoon: true, evening: true }
    const handles = []
    const now = new Date()

    for (const [bucket, { hour, minute, label, emoji }] of Object.entries(BUCKET_TIMES)) {
      if (!activeBuckets[bucket]) continue
      const fireAt = new Date()
      fireAt.setHours(hour, minute, 0, 0)
      const delay = fireAt.getTime() - now.getTime()
      if (delay <= 0 || firedRef.current.has(bucket)) continue

      const handle = setTimeout(() => {
        const titles = (buckets[bucket] || []).map(t => t.title)
        if (titles.length === 0) return
        firedRef.current.add(bucket)
        const body = titles.length === 1
          ? titles[0]
          : `${titles.length} tasks: ${titles.slice(0, 2).join(', ')}${titles.length > 2 ? '…' : ''}`
        setToast({ title: `${label} tasks`, body, emoji })
      }, delay)

      handles.push(handle)
    }
    return () => handles.forEach(clearTimeout)
  }, [tasks, prefs])

  // In-app toasts 15 min before timed tasks
  useEffect(() => {
    if (!(prefs.enabled ?? true) || !(prefs.reminders15 ?? true)) return
    const today = format(new Date(), 'yyyy-MM-dd')
    const now = Date.now()
    const handles = []

    for (const t of tasks) {
      if (t.scheduled_date !== today || !t.start_time || t.status === 'done') continue
      const [h, m] = t.start_time.split(':').map(Number)
      const taskTime = new Date()
      taskTime.setHours(h, m, 0, 0)
      const fireAt = taskTime.getTime() - 15 * 60 * 1000
      const delay = fireAt - now
      if (delay <= 0 || firedRef.current.has(`reminder-${t.id}`)) continue

      const handle = setTimeout(() => {
        firedRef.current.add(`reminder-${t.id}`)
        const timeStr = t.start_time.slice(0, 5)
        setToast({ title: 'Starting in 15 min', body: `${t.title} at ${timeStr}`, emoji: '⏰' })
      }, delay)

      handles.push(handle)
    }
    return () => handles.forEach(clearTimeout)
  }, [tasks, prefs])

  async function handleRequestPermission() {
    const result = await requestNotificationPermission()
    setPermission(result)
    return result
  }

  function handlePrefsChange(next) {
    setPrefs(next)
    savePrefs(next)
  }

  return (
    <>
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => { setOpen(o => !o); setShowSettings(false) }}
          title="Notifications"
          style={{
            position: 'relative', background: 'none', border: 'none',
            padding: '2px 4px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bell-grad" x1="6" y1="2" x2="18" y2="20" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fde68a"/>
                <stop offset="100%" stopColor="#d97706"/>
              </linearGradient>
              <filter id="bell-shadow" x="-30%" y="-20%" width="160%" height="180%">
                <feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#b45309" floodOpacity="0.55"/>
              </filter>
            </defs>
            <path filter="url(#bell-shadow)" fill="url(#bell-grad)" d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9z"/>
            <path d="M9.5 6.5 Q10.5 4.5 12 4" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" fill="none"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          </svg>
        </button>

        {open && isMobile && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.4)' }} onClick={() => { setOpen(false); setShowSettings(false) }} />
        )}
        {open && (
          <div style={isMobile ? {
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301,
            background: 'white', borderRadius: '16px 16px 0 0',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
            maxHeight: '80vh', overflowY: 'auto',
          } : {
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 200,
            background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)', width: 290,
          }}>
            {showSettings ? (
              <NotifSettings
                prefs={prefs}
                onPrefsChange={handlePrefsChange}
                permission={permission}
                onRequestPermission={handleRequestPermission}
                onClose={() => setShowSettings(false)}
              />
            ) : (
              <>
                <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#111827' }}>Today's tasks</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>{format(new Date(), 'EEEE, MMM d')}</p>
                  </div>
                  <button
                    onClick={() => setShowSettings(true)}
                    title="Notification settings"
                    style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                  </button>
                </div>

                {count === 0 ? (
                  <div style={{ padding: '24px 14px', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>No tasks scheduled for today</p>
                  </div>
                ) : (
                  <div style={{ padding: '8px 0', maxHeight: 340, overflowY: 'auto' }}>
                    {Object.entries(BUCKET_TIMES).map(([bucket, { label, emoji }]) => {
                      const items = buckets[bucket] || []
                      if (items.length === 0) return null
                      return (
                        <div key={bucket} style={{ padding: '6px 14px' }}>
                          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {emoji} {label}
                          </p>
                          {items.map(t => (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.3, flex: 1 }}>{t.title}</span>
                              {t.start_time && <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>{t.start_time.slice(0, 5)}</span>}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}

                {permission !== 'granted' && (
                  <div style={{ padding: '10px 14px', borderTop: '1px solid #f3f4f6' }}>
                    <button
                      onClick={async () => { await handleRequestPermission(); setShowSettings(true) }}
                      style={{ width: '100%', padding: '7px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Enable push notifications
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {toast && <NotificationToast toast={toast} onDismiss={() => setToast(null)} />}
    </>
  )
}
