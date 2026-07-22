import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Weekly Planner</h1>
        <p className="text-sm text-gray-500 mb-5">{mode === 'signin' ? 'Sign in to your account' : 'Create your account'}</p>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-3">
          <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          {mode === 'signup' && (
            <>
              <input type="text" required placeholder="Username" value={username} onChange={e => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <input type="text" required placeholder="Invite code" value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
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
