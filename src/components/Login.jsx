import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [username, setUsername] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [signedUp, setSignedUp] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, username, inviteCode)
    setSubmitting(false)
    if (result.error) {
      setError(result.error.message)
    } else if (mode === 'signup') {
      setSignedUp(true)
    }
  }

  if (signedUp) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h1>
          <p className="text-sm text-gray-500">Confirm your account, then sign in.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Schedulent</h1>
        <p className="text-sm text-gray-500 mb-5">{mode === 'signin' ? 'Sign in to your account' : 'Create your account'}</p>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-3">
          <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base" />
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-base" />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {mode === 'signup' && (
            <>
              <input type="text" required placeholder="Username" value={username} onChange={e => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base" />
              <input type="text" required placeholder="Invite code" value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base" />
            </>
          )}
        </div>

        <button type="submit" disabled={submitting}
          className="w-full mt-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {submitting ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>

        <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
          className="w-full mt-3 text-xs text-indigo-600 hover:text-indigo-700">
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
