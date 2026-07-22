import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function SettingsDropdown({ onOpenCollaborations }) {
  const { user, profile, signOut, updateEmail, updatePassword } = useAuth()
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState(null) // 'email' | 'password' | null
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
    const { error } = await updateEmail(newEmail.trim())
    setSubmitting(false)
    if (error) { setError(error.message); return }
    setMessage('Check your new email address to confirm the change.')
    setNewEmail('')
    setSection(null)
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setSubmitting(true)
    const { error } = await updatePassword(newPassword)
    setSubmitting(false)
    if (error) { setError(error.message); return }
    setMessage('Password updated.')
    setNewPassword('')
    setConfirmPassword('')
    setSection(null)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-center p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
        title="Settings"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
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

            {section === 'email' ? (
              <form onSubmit={handleEmailSubmit} className="px-3 py-2 space-y-2 border-b border-gray-100">
                <input
                  autoFocus
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
                onClick={() => { setSection('email'); setError(null); setMessage(null) }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Change email
              </button>
            )}

            {section === 'password' ? (
              <form onSubmit={handlePasswordSubmit} className="px-3 py-2 space-y-2 border-b border-gray-100">
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
                onClick={() => { setSection('password'); setError(null); setMessage(null) }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Change password
              </button>
            )}

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
