import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { requestNotificationPermission, getNotificationPermission, scheduleDailyNotifications, scheduleUpcomingReminders, registerServiceWorker } from '../lib/notifications'

const NOTIF_PREFS_KEY = 'schedulent_notif_prefs'
function loadPrefs() { try { return JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY) || '{}') } catch { return {} } }
function savePrefs(p) { try { localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(p)) } catch {} }

const BUCKET_CONFIG = [
  { key: 'morning',   label: 'Morning',   time: '8:00 AM (8:00)' },
  { key: 'afternoon', label: 'Afternoon', time: '12:00 PM (12:00)' },
  { key: 'evening',   label: 'Evening',   time: '5:00 PM (17:00)' },
]

function Toggle({ on, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      style={{
        width: 34, height: 18, borderRadius: 9, border: 'none', cursor: disabled ? 'default' : 'pointer',
        background: on ? '#6366f1' : '#d1d5db', position: 'relative',
        transition: 'background 0.2s', flexShrink: 0, opacity: disabled ? 0.4 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 17 : 2,
        width: 14, height: 14, borderRadius: '50%', background: 'white',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

function NotificationSection({ tasks }) {
  const [permission, setPermission] = useState(getNotificationPermission)
  const [prefs, setPrefs] = useState(loadPrefs)
  const [expanded, setExpanded] = useState(false)

  const enabled = prefs.enabled ?? true
  const bucketPrefs = prefs.buckets || { morning: true, afternoon: true, evening: true }
  const reminders15 = prefs.reminders15 ?? true

  useEffect(() => { registerServiceWorker() }, [])

  useEffect(() => {
    if (permission !== 'granted' || !enabled) return
    const activeTasks = tasks.filter(t => {
      const b = t.bucket || 'morning'
      return (prefs.buckets || {})[b] !== false
    })
    scheduleDailyNotifications(activeTasks)
    if (reminders15) scheduleUpcomingReminders(tasks)
  }, [tasks, prefs, permission])

  function update(next) { setPrefs(next); savePrefs(next) }

  async function handleEnable() {
    if (permission !== 'granted') {
      const result = await requestNotificationPermission()
      setPermission(result)
      if (result === 'granted') update({ ...prefs, enabled: true })
    } else {
      update({ ...prefs, enabled: !enabled })
    }
  }

  if (permission === 'unsupported') return null

  return (
    <div className="border-t border-gray-100">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="sd-bell-grad" x1="6" y1="2" x2="18" y2="20" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={permission === 'granted' && enabled ? '#fde68a' : '#e5e7eb'}/>
                <stop offset="100%" stopColor={permission === 'granted' && enabled ? '#d97706' : '#9ca3af'}/>
              </linearGradient>
            </defs>
            <path fill="url(#sd-bell-grad)" d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9z"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={permission === 'granted' && enabled ? '#b45309' : '#9ca3af'} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          </svg>
          Notifications
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {permission === 'denied' && (
            <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1.5">Blocked in browser — go to site settings to allow.</p>
          )}

          {/* Master toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-700">Enable notifications</p>
              <p className="text-[11px] text-gray-400">{permission === 'granted' ? 'Including when screen is locked' : 'Click to grant permission'}</p>
            </div>
            <Toggle on={enabled && permission === 'granted'} onChange={handleEnable} disabled={permission === 'denied'} />
          </div>

          {/* Bucket toggles */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Alert times</p>
            {BUCKET_CONFIG.map(({ key, label, time }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-gray-600">{label} <span className="text-gray-400">{time}</span></span>
                <Toggle
                  on={bucketPrefs[key] !== false && enabled && permission === 'granted'}
                  onChange={() => update({ ...prefs, buckets: { ...bucketPrefs, [key]: !bucketPrefs[key] } })}
                  disabled={!enabled || permission !== 'granted'}
                />
              </div>
            ))}
          </div>

          {/* 15-min reminders */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <div>
              <p className="text-xs font-medium text-gray-700">⏰ 15-min reminders</p>
              <p className="text-[11px] text-gray-400">Before tasks with a set time</p>
            </div>
            <Toggle
              on={reminders15 && enabled && permission === 'granted'}
              onChange={() => update({ ...prefs, reminders15: !reminders15 })}
              disabled={!enabled || permission !== 'granted'}
            />
          </div>

          {permission !== 'granted' && permission !== 'denied' && (
            <button
              onClick={handleEnable}
              className="w-full py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              Allow notifications
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function SettingsDropdown({ onOpenCollaborations, tasks, rolloverMode, onRolloverModeChange }) {
  const { user, profile, signOut, updateEmail, updatePassword, updateUsername } = useAuth()
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState(null) // 'email' | 'password' | 'username' | null
  const [newEmail, setNewEmail] = useState('')
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [currentPasswordForPw, setCurrentPasswordForPw] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function closeAll() {
    setOpen(false)
    setSection(null)
    setError(null)
    setMessage(null)
  }

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setSubmitting(true)
    const { error } = await updateEmail(currentPasswordForEmail, newEmail.trim())
    setSubmitting(false)
    if (error) { setError(error.message); return }
    setMessage('Check your new email address to confirm the change.')
    setNewEmail('')
    setCurrentPasswordForEmail('')
    setSection(null)
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setSubmitting(true)
    const { error } = await updatePassword(currentPasswordForPw, newPassword)
    setSubmitting(false)
    if (error) { setError(error.message); return }
    setMessage('Password updated.')
    setCurrentPasswordForPw('')
    setNewPassword('')
    setConfirmPassword('')
    setSection(null)
  }

  async function handleUsernameSubmit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    const trimmed = newUsername.trim()
    if (!trimmed) return
    setSubmitting(true)
    const { error } = await updateUsername(trimmed)
    setSubmitting(false)
    if (error) { setError(error.message); return }
    setMessage('Username updated.')
    setNewUsername('')
    setSection(null)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-center p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
        title="Settings"
      >
        <span style={{ fontSize: '18px', lineHeight: 1 }}>⚙️</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeAll} />
          <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1.5">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-800 truncate">{profile?.username}</p>
              <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
            </div>

            {message && <div className="px-3 py-2 text-xs text-emerald-600 bg-emerald-50 border-b border-gray-100">{message}</div>}
            {error && <div className="px-3 py-2 text-xs text-red-600 bg-red-50 border-b border-gray-100">{error}</div>}

            {section === 'username' ? (
              <form onSubmit={handleUsernameSubmit} className="px-3 py-2 space-y-2 border-b border-gray-100">
                <input
                  autoFocus
                  type="text"
                  required
                  placeholder="New username"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={submitting} className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
                    {submitting ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" onClick={() => { setSection(null); setError(null) }} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => { setSection('username'); setNewUsername(profile?.username || ''); setError(null); setMessage(null) }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Change username
              </button>
            )}

            {section === 'email' ? (
              <form onSubmit={handleEmailSubmit} className="px-3 py-2 space-y-2 border-b border-gray-100">
                <input
                  autoFocus
                  type="password"
                  required
                  placeholder="Current password"
                  value={currentPasswordForEmail}
                  onChange={e => setCurrentPasswordForEmail(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
                <input
                  type="email"
                  required
                  placeholder="New email address"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={submitting} className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
                    {submitting ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" onClick={() => { setSection(null); setError(null) }} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => { setSection('email'); setCurrentPasswordForEmail(''); setError(null); setMessage(null) }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Change email
              </button>
            )}

            {section === 'password' ? (
              <form onSubmit={handlePasswordSubmit} className="px-3 py-2 space-y-2 border-b border-gray-100">
                <input
                  autoFocus
                  type="password"
                  required
                  placeholder="Current password"
                  value={currentPasswordForPw}
                  onChange={e => setCurrentPasswordForPw(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
                <input
                  type="password"
                  required
                  placeholder="New password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
                <input
                  type="password"
                  required
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={submitting} className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
                    {submitting ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" onClick={() => { setSection(null); setError(null) }} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => { setSection('password'); setCurrentPasswordForPw(''); setError(null); setMessage(null) }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Change password
              </button>
            )}

            <div className="px-3 py-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 font-medium mb-1.5">Overdue tasks</p>
              <div className="flex flex-col gap-1">
                {['manual', 'auto'].map(mode => (
                  <label key={mode} className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input type="radio" name="rollover" checked={rolloverMode === mode} onChange={() => onRolloverModeChange(mode)} className="accent-indigo-600" />
                    {mode === 'manual' ? 'Manual — show "Roll over" button' : 'Auto — roll over on app open'}
                  </label>
                ))}
              </div>
            </div>
            <NotificationSection tasks={tasks} />
            <button
              onClick={() => { setOpen(false); onOpenCollaborations() }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 border-t border-gray-100"
            >
              Collaborations
            </button>
            <button onClick={signOut} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50">
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
