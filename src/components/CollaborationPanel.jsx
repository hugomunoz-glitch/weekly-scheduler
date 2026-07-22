import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export default function CollaborationPanel({ onClose }) {
  const { user } = useAuth()
  const [collaborations, setCollaborations] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [inviteCodes, setInviteCodes] = useState({}) // collaboration_id -> [codes]
  const [generating, setGenerating] = useState(null)
  const [copiedCode, setCopiedCode] = useState(null)
  const [error, setError] = useState(null)

  const fetchCollaborations = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('collaborations')
      .select('id, name, owner_id, collaboration_members(user_id, role, profiles(username))')
    if (error) { console.error('fetchCollaborations failed:', error); setError(error.message) }
    setCollaborations(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchCollaborations() }, [fetchCollaborations])

  useEffect(() => {
    if (!collaborations.length) return
    supabase
      .from('invite_codes')
      .select('code, collaboration_id, used_by, created_at')
      .in('collaboration_id', collaborations.map(c => c.id))
      .then(({ data }) => {
        const grouped = {}
        for (const row of data || []) {
          grouped[row.collaboration_id] = grouped[row.collaboration_id] || []
          grouped[row.collaboration_id].push(row)
        }
        setInviteCodes(grouped)
      })
  }, [collaborations])

  async function createCollaboration(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setError(null)
    const { data, error } = await supabase.from('collaborations').insert({ name: newName.trim(), owner_id: user.id }).select().single()
    if (error) { setError(error.message); setCreating(false); return }
    const { error: memberError } = await supabase.from('collaboration_members').insert({ collaboration_id: data.id, user_id: user.id, role: 'owner' })
    if (memberError) { setError(memberError.message); setCreating(false); return }
    setNewName('')
    setCreating(false)
    fetchCollaborations()
  }

  async function generateInvite(collaborationId) {
    setGenerating(collaborationId)
    setError(null)
    const code = randomCode()
    const { error } = await supabase.from('invite_codes').insert({
      code, created_by: user.id, collaboration_id: collaborationId
    })
    setGenerating(null)
    if (error) { setError(error.message); return }
    setInviteCodes(prev => ({
      ...prev,
      [collaborationId]: [{ code, collaboration_id: collaborationId, used_by: null, created_at: new Date().toISOString() }, ...(prev[collaborationId] || [])]
    }))
  }

  function copyCode(code) {
    navigator.clipboard?.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 1500)
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[3000] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Collaborations</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm">Close</button>
        </div>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <form onSubmit={createCollaboration} className="flex gap-2 mb-5">
          <input
            type="text" placeholder="New collaboration name (e.g. Hugo & Ivonet)"
            value={newName} onChange={e => setNewName(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <button type="submit" disabled={creating || !newName.trim()}
            className="px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 shrink-0">
            {creating ? 'Creating...' : 'Create'}
          </button>
        </form>

        {loading ? (
          <div className="text-sm text-gray-400 text-center py-6">Loading...</div>
        ) : collaborations.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">No collaborations yet. Create one above to start planning with someone else.</div>
        ) : (
          <div className="space-y-4">
            {collaborations.map(collab => (
              <div key={collab.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">{collab.name}</h3>
                  <button
                    onClick={() => generateInvite(collab.id)}
                    disabled={generating === collab.id}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
                  >
                    {generating === collab.id ? 'Generating...' : '+ Generate invite'}
                  </button>
                </div>

                <div className="text-xs text-gray-500 mb-2">
                  Members: {collab.collaboration_members?.map(m => m.profiles?.username || 'unknown').join(', ') || '—'}
                </div>

                {inviteCodes[collab.id]?.length > 0 && (
                  <div className="space-y-1.5">
                    {inviteCodes[collab.id].map(inv => (
                      <div key={inv.code} className="flex items-center justify-between bg-gray-50 rounded-lg px-2.5 py-1.5">
                        <span className="font-mono text-sm text-gray-800 tracking-wider">{inv.code}</span>
                        {inv.used_by ? (
                          <span className="text-xs text-gray-400">Used</span>
                        ) : (
                          <button onClick={() => copyCode(inv.code)} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                            {copiedCode === inv.code ? 'Copied!' : 'Copy'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-5">
          Share a code with the person you want to invite. They'll enter it on the sign-up screen along with their own email, password, and username.
        </p>
      </div>
    </div>
  )
}
