import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export default function CollaborationPanel({ onClose }) {
  const { user } = useAuth()

  // ── Collaboration state ────────────────────────────────────
  const [collaborations, setCollaborations] = useState([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [inviteCodes, setInviteCodes] = useState({})
  const [generating, setGenerating] = useState(null)
  const [copiedCode, setCopiedCode] = useState(null)
  const [error, setError] = useState(null)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [redeemMessage, setRedeemMessage] = useState(null)

  // ── Coaching state ─────────────────────────────────────────
  const [coachingGlobalEnabled, setCoachingGlobalEnabled] = useState(false)
  const [coachingUserEnabled, setCoachingUserEnabled] = useState(false)
  const [receivedInvites, setReceivedInvites] = useState([])
  const [sentInvites, setSentInvites] = useState([])
  const [coachRelationships, setCoachRelationships] = useState([]) // {id, coach_id, member_id, coach_username, member_username}
  const [inviteSearch, setInviteSearch] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [respondingId, setRespondingId] = useState(null)

  // ── Fetch collaborations ───────────────────────────────────
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

  // ── Fetch coaching data ────────────────────────────────────
  const fetchCoachingData = useCallback(async () => {
    if (!user) return

    // Global flag
    const { data: flag } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('key', 'coaching_enabled')
      .single()
    setCoachingGlobalEnabled(flag?.enabled ?? false)

    // User-level toggle
    const { data: profile } = await supabase
      .from('profiles')
      .select('coaching_enabled')
      .eq('id', user.id)
      .single()
    setCoachingUserEnabled(profile?.coaching_enabled ?? false)

    if (!flag?.enabled) return

    // Invitations received (pending)
    const { data: received } = await supabase
      .from('coach_invitations')
      .select('id, message, created_at, coach_id, profiles!coach_invitations_coach_id_fkey(username)')
      .eq('invitee_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setReceivedInvites(received || [])

    // Invitations sent (pending)
    const { data: sent } = await supabase
      .from('coach_invitations')
      .select('id, invitee_email, created_at, status, profiles!coach_invitations_invitee_id_fkey(username)')
      .eq('coach_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setSentInvites(sent || [])

    // Established relationships
    const { data: assignments } = await supabase
      .from('coach_assignments')
      .select(`
        id, coach_id, member_id,
        coach:profiles!coach_assignments_coach_id_fkey(username),
        member:profiles!coach_assignments_member_id_fkey(username)
      `)
      .or(`coach_id.eq.${user.id},member_id.eq.${user.id}`)
    setCoachRelationships(assignments || [])
  }, [user])

  useEffect(() => { fetchCoachingData() }, [fetchCoachingData])

  // ── Collaboration actions ──────────────────────────────────
  async function createCollaboration(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setError(null)
    const { data, error } = await supabase.from('collaborations').insert({ name: newName.trim(), owner_id: user.id }).select().single()
    if (error) { setError(error.message); setCreating(false); return }
    await supabase.from('collaboration_members').insert({ collaboration_id: data.id, user_id: user.id, role: 'owner' })
    setNewName('')
    setCreating(false)
    fetchCollaborations()
  }

  async function generateInvite(collaborationId) {
    setGenerating(collaborationId)
    setError(null)
    const code = randomCode()
    const { error } = await supabase.from('invite_codes').insert({ code, created_by: user.id, collaboration_id: collaborationId })
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

  async function handleRedeem(e) {
    e.preventDefault()
    if (!redeemCode.trim()) return
    setRedeeming(true)
    setError(null)
    setRedeemMessage(null)
    const code = redeemCode.trim().toUpperCase()
    const { data: invite, error: lookupError } = await supabase
      .from('invite_codes').select('*').eq('code', code).is('used_by', null).maybeSingle()
    if (lookupError || !invite) { setRedeeming(false); setError('Invalid or already-used invite code'); return }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) { setRedeeming(false); setError('This invite code has expired'); return }
    if (!invite.collaboration_id) { setRedeeming(false); setError('This code is not tied to a collaboration'); return }
    const { error: memberError } = await supabase.from('collaboration_members').insert({ collaboration_id: invite.collaboration_id, user_id: user.id, role: 'member' })
    if (memberError) { setRedeeming(false); setError(memberError.message); return }
    await supabase.from('invite_codes').update({ used_by: user.id, used_at: new Date().toISOString() }).eq('code', code)
    setRedeeming(false)
    setRedeemCode('')
    setRedeemMessage("You've joined the collaboration.")
    fetchCollaborations()
  }

  // ── Coaching actions ───────────────────────────────────────
  async function sendCoachingInvite(e) {
    e.preventDefault()
    const query = inviteSearch.trim()
    if (!query) return
    setSendingInvite(true)
    setInviteError('')
    setInviteSuccess('')

    const isEmail = query.includes('@')
    let inviteeId = null
    let inviteeEmail = null

    if (isEmail) {
      inviteeEmail = query
    } else {
      const { data: found } = await supabase
        .from('profiles').select('id').eq('username', query).maybeSingle()
      if (!found) { setInviteError('No user found with that username.'); setSendingInvite(false); return }
      if (found.id === user.id) { setInviteError("You can't invite yourself."); setSendingInvite(false); return }
      inviteeId = found.id
    }

    const { error } = await supabase.from('coach_invitations').insert({
      coach_id: user.id,
      invitee_id: inviteeId,
      invitee_email: inviteeEmail,
      message: inviteMessage.trim() || null,
    })

    setSendingInvite(false)
    if (error) { setInviteError(error.message); return }
    setInviteSearch('')
    setInviteMessage('')
    setInviteSuccess('Coaching invitation sent!')
    setTimeout(() => setInviteSuccess(''), 3000)
    fetchCoachingData()
  }

  async function respondToInvite(invitationId, accept) {
    setRespondingId(invitationId)
    const fn = accept ? 'accept_coaching_invitation' : 'decline_coaching_invitation'
    const { error } = await supabase.rpc(fn, { invitation_id: invitationId })
    setRespondingId(null)
    if (error) { setInviteError(error.message); return }
    fetchCoachingData()
  }

  async function cancelSentInvite(invitationId) {
    await supabase.from('coach_invitations').delete().eq('id', invitationId).eq('coach_id', user.id)
    fetchCoachingData()
  }

  const coachingVisible = coachingGlobalEnabled && coachingUserEnabled

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[3000] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Collaborations</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm">Close</button>
        </div>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        {/* ── Create collaboration ── */}
        <form onSubmit={createCollaboration} className="flex gap-2 mb-5">
          <input
            type="text" placeholder="New collaboration name (e.g. Hugo & Ivonet)"
            value={newName} onChange={e => setNewName(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            style={{ fontSize: 16 }}
          />
          <button type="submit" disabled={creating || !newName.trim()}
            className="px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 shrink-0">
            {creating ? 'Creating...' : 'Create'}
          </button>
        </form>

        {/* ── Enter invite code ── */}
        <div className="mb-5 pb-5 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Enter Invite Code</h3>
          {redeemMessage && <div className="mb-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{redeemMessage}</div>}
          <form onSubmit={handleRedeem} className="flex gap-2">
            <input
              type="text" placeholder="e.g. 7F3KQ92R"
              value={redeemCode} onChange={e => setRedeemCode(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono tracking-wider"
              style={{ fontSize: 16 }}
            />
            <button type="submit" disabled={redeeming || !redeemCode.trim()}
              className="px-3 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 disabled:opacity-50 shrink-0">
              {redeeming ? 'Joining...' : 'Join'}
            </button>
          </form>
        </div>

        {/* ── Coaching section (only when both flags are on) ── */}
        {coachingGlobalEnabled && (
          <div className="mb-5 pb-5 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Coaching</h3>
              {!coachingUserEnabled && (
                <span className="text-xs text-gray-400 italic">Not enabled on your account</span>
              )}
            </div>

            {/* Pending invitations received — always visible regardless of coaching_enabled */}
            {receivedInvites.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Coaching invitations for you</p>
                <div className="space-y-2">
                  {receivedInvites.map(inv => (
                    <div key={inv.id} className="border border-indigo-100 bg-indigo-50 rounded-lg px-3 py-2.5">
                      <p className="text-sm font-medium text-gray-800 mb-0.5">
                        {inv.profiles?.username || 'Someone'} wants to coach you
                      </p>
                      {inv.message && <p className="text-xs text-gray-500 mb-2">"{inv.message}"</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => respondToInvite(inv.id, true)}
                          disabled={respondingId === inv.id}
                          className="flex-1 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {respondingId === inv.id ? '...' : 'Accept'}
                        </button>
                        <button
                          onClick={() => respondToInvite(inv.id, false)}
                          disabled={respondingId === inv.id}
                          className="flex-1 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {coachingVisible && (
              <>

                {/* Established coaching relationships */}
                {coachRelationships.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">Active coaching relationships</p>
                    <div className="space-y-1.5">
                      {coachRelationships.map(rel => {
                        const isCoach = rel.coach_id === user.id
                        return (
                          <div key={rel.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                              style={{ background: isCoach ? '#e0e7ff' : '#dcfce7', color: isCoach ? '#4338ca' : '#15803d' }}>
                              {isCoach ? 'Coach' : 'Member'}
                            </span>
                            <span className="text-sm text-gray-700">
                              {isCoach ? rel.member?.username : rel.coach?.username}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Send coaching invitation */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Invite someone to be coached by you</p>
                  {inviteError && <div className="mb-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{inviteError}</div>}
                  {inviteSuccess && <div className="mb-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{inviteSuccess}</div>}
                  <form onSubmit={sendCoachingInvite} className="space-y-2">
                    <input
                      type="text"
                      placeholder="Username or email address"
                      value={inviteSearch}
                      onChange={e => setInviteSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      style={{ fontSize: 16 }}
                    />
                    <input
                      type="text"
                      placeholder="Optional message"
                      value={inviteMessage}
                      onChange={e => setInviteMessage(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      style={{ fontSize: 16 }}
                    />
                    <button
                      type="submit"
                      disabled={sendingInvite || !inviteSearch.trim()}
                      className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {sendingInvite ? 'Sending...' : 'Send coaching invitation'}
                    </button>
                  </form>

                  {/* Pending sent invitations */}
                  {sentInvites.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-400 mb-1.5">Pending invitations you sent</p>
                      <div className="space-y-1.5">
                        {sentInvites.map(inv => (
                          <div key={inv.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                            <span className="text-xs text-gray-600">
                              {inv.profiles?.username || inv.invitee_email || 'Unknown'}
                            </span>
                            <button
                              onClick={() => cancelSentInvite(inv.id)}
                              className="text-xs text-red-400 hover:text-red-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Existing collaborations list ── */}
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
