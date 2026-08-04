import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import ArtifactExtractModal from './ArtifactExtractModal'

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function ArtifactForm({ url, setUrl, title, setTitle, notes, setNotes, saving, error, onSubmit, onCancel, label = 'Push artifact' }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2 mt-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input
        type="url" placeholder="Claude.ai artifact URL"
        value={url} onChange={e => setUrl(e.target.value)}
        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-400"
        style={{ fontSize: 16 }}
      />
      <input
        type="text" placeholder="Title (e.g. 12-Week Strength Plan)"
        value={title} onChange={e => setTitle(e.target.value)}
        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-400"
        style={{ fontSize: 16 }}
      />
      <textarea
        placeholder="Notes (optional)"
        value={notes} onChange={e => setNotes(e.target.value)}
        rows={2}
        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-400 resize-none"
        style={{ fontSize: 16 }}
      />
      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={saving || !url.trim() || !title.trim()}
          className="flex-1 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : label}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100">
          Cancel
        </button>
      </div>
    </div>
  )
}

function ArtifactCard({ artifact, versions, unreadCount, onDelete, onToggleMain, onMarkRead, userId,
  pushingArtifact, setPushingArtifact, artifactUrl, setArtifactUrl, artifactTitle, setArtifactTitle,
  artifactNotes, setArtifactNotes, savingArtifact, artifactError, pushNewVersion,
  expandedArtifact, setExpandedArtifact, onExtract }) {
  const latest = versions?.[0]
  const isOwner = artifact.created_by === userId
  const hasUnread = unreadCount > 0
  const isExpanded = expandedArtifact === artifact.id
  const isPushingVersion = pushingArtifact === `version-${artifact.id}`

  return (
    <div className={`border rounded-lg p-3 ${hasUnread ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {hasUnread && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />}
            <p className="text-sm font-medium text-gray-900 truncate">{latest?.title || 'Untitled'}</p>
            <span className="text-xs text-gray-400 shrink-0">v{latest?.version_number}</span>
          </div>
          <p className="text-xs text-gray-500">by {latest?.profiles?.username || 'unknown'} · {latest ? new Date(latest.created_at).toLocaleDateString() : ''}</p>
          {latest?.notes && <p className="text-xs text-gray-500 mt-0.5 italic">"{latest.notes}"</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <a href={latest?.url} target="_blank" rel="noopener noreferrer"
            onClick={() => hasUnread && onMarkRead(artifact.id)}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Open</a>
          <button onClick={() => onExtract({ artifact, version: latest })}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Extract</button>
          <button onClick={() => setExpandedArtifact(isExpanded ? null : artifact.id)}
            className="text-xs text-gray-400 hover:text-gray-600">{isExpanded ? '▲' : '▼'}</button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">Show in calendar/goals</p>
            <button onClick={() => onToggleMain(artifact.id, artifact.display_in_main_view)}
              className={`relative w-8 h-4 rounded-full transition-colors ${artifact.display_in_main_view ? 'bg-indigo-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${artifact.display_in_main_view ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {versions?.length > 1 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Version history</p>
              <div className="space-y-1">
                {versions.map(v => (
                  <div key={v.id} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                    <span>v{v.version_number} — {v.title}</span>
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">Open</a>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {isOwner && (
              <button
                onClick={() => { setPushingArtifact(isPushingVersion ? null : `version-${artifact.id}`); setArtifactUrl(''); setArtifactTitle(latest?.title || ''); setArtifactNotes('') }}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                + New version
              </button>
            )}
            <button onClick={() => onDelete(artifact.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
          </div>

          {isPushingVersion && (
            <ArtifactForm
              url={artifactUrl} setUrl={setArtifactUrl}
              title={artifactTitle} setTitle={setArtifactTitle}
              notes={artifactNotes} setNotes={setArtifactNotes}
              saving={savingArtifact} error={artifactError}
              onSubmit={() => pushNewVersion(artifact.id)}
              onCancel={() => setPushingArtifact(null)}
              label="Push new version"
            />
          )}
        </div>
      )}
    </div>
  )
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
  const [inviteEmailTarget, setInviteEmailTarget] = useState(null) // collab.id currently showing email input
  const [inviteEmailValue, setInviteEmailValue] = useState('')
  const [sendingInviteEmail, setSendingInviteEmail] = useState(false)
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

  // ── Artifacts state ────────────────────────────────────────
  const [artifacts, setArtifacts] = useState([]) // all artifacts visible to user
  const [artifactVersions, setArtifactVersions] = useState({}) // { artifact_id: [versions] }
  const [artifactNotifications, setArtifactNotifications] = useState([])
  const [pushingArtifact, setPushingArtifact] = useState(null) // collab.id or coaching rel.id or 'personal'
  const [artifactUrl, setArtifactUrl] = useState('')
  const [artifactTitle, setArtifactTitle] = useState('')
  const [artifactNotes, setArtifactNotes] = useState('')
  const [savingArtifact, setSavingArtifact] = useState(false)
  const [artifactError, setArtifactError] = useState('')
  const [expandedArtifact, setExpandedArtifact] = useState(null)
  const [extractingArtifact, setExtractingArtifact] = useState(null) // { artifact, version }

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

    // Invitations received (pending) — by user id OR by email, regardless of coaching flag
    const { data: receivedById } = await supabase
      .from('coach_invitations')
      .select('id, message, created_at, coach_id, profiles!coach_invitations_coach_id_fkey(username, id)')
      .eq('invitee_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    const { data: receivedByEmail } = await supabase
      .from('coach_invitations')
      .select('id, message, created_at, coach_id, profiles!coach_invitations_coach_id_fkey(username, id)')
      .eq('invitee_email', user.email)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    const allReceived = [...(receivedById || []), ...(receivedByEmail || [])]
    const uniqueReceived = allReceived.filter((inv, i, arr) => arr.findIndex(x => x.id === inv.id) === i)

    // Resolve coach usernames for any invitations where the join didn't return a profile
    const missingCoachIds = uniqueReceived.filter(inv => !inv.profiles?.username && inv.coach_id).map(inv => inv.coach_id)
    let coachMap = {}
    if (missingCoachIds.length > 0) {
      const { data: coaches } = await supabase.from('profiles').select('id, username').in('id', missingCoachIds)
      for (const c of coaches || []) coachMap[c.id] = c.username
    }
    const withCoachNames = uniqueReceived.map(inv => ({
      ...inv,
      coachUsername: inv.profiles?.username || coachMap[inv.coach_id] || 'Someone'
    }))
    setReceivedInvites(withCoachNames)

    if (!flag?.enabled) return

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

  // ── Fetch artifacts ────────────────────────────────────────
  const fetchArtifacts = useCallback(async () => {
    if (!user) return
    const { data: arts } = await supabase
      .from('artifacts')
      .select('id, scope, recipient_id, collaboration_id, created_by, display_in_main_view, created_at, profiles!artifacts_created_by_fkey(username)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setArtifacts(arts || [])

    if (!arts?.length) return
    const { data: versions } = await supabase
      .from('artifact_versions')
      .select('id, artifact_id, version_number, url, title, notes, pushed_by, created_at, profiles!artifact_versions_pushed_by_fkey(username)')
      .in('artifact_id', arts.map(a => a.id))
      .order('version_number', { ascending: false })
    const grouped = {}
    for (const v of versions || []) {
      grouped[v.artifact_id] = grouped[v.artifact_id] || []
      grouped[v.artifact_id].push(v)
    }
    setArtifactVersions(grouped)

    const { data: notifs } = await supabase
      .from('artifact_notifications')
      .select('id, artifact_id, artifact_version_id, is_read, created_at')
      .eq('recipient_id', user.id)
      .eq('is_read', false)
    setArtifactNotifications(notifs || [])
  }, [user])

  useEffect(() => { fetchArtifacts() }, [fetchArtifacts])

  // ── Artifact actions ───────────────────────────────────────
  async function pushArtifact({ scope, recipientId, collaborationId }) {
    if (!artifactUrl.trim() || !artifactTitle.trim()) return
    setSavingArtifact(true)
    setArtifactError('')

    // Create artifact container
    const insertData = { scope, created_by: user.id, display_in_main_view: false }
    if (scope === 'personal') insertData.recipient_id = recipientId
    if (scope === 'collaboration') insertData.collaboration_id = collaborationId

    const { data: art, error: artErr } = await supabase
      .from('artifacts').insert(insertData).select().single()
    if (artErr) { setArtifactError(artErr.message); setSavingArtifact(false); return }

    // Create first version
    const { error: verErr } = await supabase.from('artifact_versions').insert({
      artifact_id: art.id,
      url: artifactUrl.trim(),
      title: artifactTitle.trim(),
      notes: artifactNotes.trim() || null,
      pushed_by: user.id,
    })
    if (verErr) { setArtifactError(verErr.message); setSavingArtifact(false); return }

    setSavingArtifact(false)
    setArtifactUrl('')
    setArtifactTitle('')
    setArtifactNotes('')
    setPushingArtifact(null)
    fetchArtifacts()
  }

  async function pushNewVersion(artifactId) {
    if (!artifactUrl.trim() || !artifactTitle.trim()) return
    setSavingArtifact(true)
    setArtifactError('')
    const { error } = await supabase.from('artifact_versions').insert({
      artifact_id: artifactId,
      url: artifactUrl.trim(),
      title: artifactTitle.trim(),
      notes: artifactNotes.trim() || null,
      pushed_by: user.id,
    })
    if (error) { setArtifactError(error.message); setSavingArtifact(false); return }
    setSavingArtifact(false)
    setArtifactUrl('')
    setArtifactTitle('')
    setArtifactNotes('')
    setPushingArtifact(null)
    fetchArtifacts()
  }

  async function deleteArtifact(artifactId) {
    const { error } = await supabase.from('artifacts').delete().eq('id', artifactId)
    if (error) { setError(error.message); return }
    setArtifacts(prev => prev.filter(a => a.id !== artifactId))
  }

  async function markNotificationsRead(artifactId) {
    const ids = artifactNotifications.filter(n => n.artifact_id === artifactId).map(n => n.id)
    if (!ids.length) return
    await supabase.from('artifact_notifications').update({ is_read: true }).in('id', ids)
    setArtifactNotifications(prev => prev.filter(n => !ids.includes(n.id)))
  }

  async function toggleDisplayInMain(artifactId, current) {
    await supabase.from('artifacts').update({ display_in_main_view: !current }).eq('id', artifactId)
    setArtifacts(prev => prev.map(a => a.id === artifactId ? { ...a, display_in_main_view: !current } : a))
  }

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

  async function generateInvite(collaborationId, email) {
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
    if (email) {
      setSendingInviteEmail(true)
      const collab = collaborations.find(c => c.id === collaborationId)
      await supabase.functions.invoke('notify-collaboration-invite', {
        body: { email, code, collaborationName: collab?.name || 'a collaboration' }
      })
      setSendingInviteEmail(false)
      setInviteEmailTarget(null)
      setInviteEmailValue('')
    }
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
    <>
    {extractingArtifact && (
      <ArtifactExtractModal
        artifact={extractingArtifact.artifact}
        version={extractingArtifact.version}
        onClose={() => setExtractingArtifact(null)}
        onDone={fetchArtifacts}
      />
    )}
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[3000] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Collaborations & Artifacts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm">Close</button>
        </div>

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        {/* ── My Artifacts ── */}
        {(() => {
          const myArtifacts = artifacts.filter(a => a.scope === 'personal' && a.recipient_id === user.id && a.created_by === user.id)
          const isPushingPersonal = pushingArtifact === 'personal'
          return (
            <div className="mb-5 pb-5 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">My Artifacts</h3>
                <button
                  onClick={() => { setPushingArtifact(isPushingPersonal ? null : 'personal'); setArtifactUrl(''); setArtifactTitle(''); setArtifactNotes('') }}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  {isPushingPersonal ? 'Cancel' : '+ Add artifact'}
                </button>
              </div>
              {isPushingPersonal && (
                <ArtifactForm
                  url={artifactUrl} setUrl={setArtifactUrl}
                  title={artifactTitle} setTitle={setArtifactTitle}
                  notes={artifactNotes} setNotes={setArtifactNotes}
                  saving={savingArtifact} error={artifactError}
                  onSubmit={() => pushArtifact({ scope: 'personal', recipientId: user.id })}
                  onCancel={() => setPushingArtifact(null)}
                  label="Save artifact"
                />
              )}
              {myArtifacts.length === 0 && !isPushingPersonal && (
                <p className="text-xs text-gray-400">No personal artifacts yet. Add a Claude.ai link to extract tasks & goals.</p>
              )}
              {myArtifacts.length > 0 && (
                <div className="space-y-2 mt-1">
                  {myArtifacts.map(art => (
                    <ArtifactCard
                      key={art.id} artifact={art}
                      versions={artifactVersions[art.id]}
                      unreadCount={artifactNotifications.filter(n => n.artifact_id === art.id).length}
                      onDelete={deleteArtifact} onToggleMain={toggleDisplayInMain}
                      onMarkRead={markNotificationsRead} userId={user.id}
                      pushingArtifact={pushingArtifact} setPushingArtifact={setPushingArtifact}
                      artifactUrl={artifactUrl} setArtifactUrl={setArtifactUrl}
                      artifactTitle={artifactTitle} setArtifactTitle={setArtifactTitle}
                      artifactNotes={artifactNotes} setArtifactNotes={setArtifactNotes}
                      savingArtifact={savingArtifact} artifactError={artifactError}
                      pushNewVersion={pushNewVersion}
                      expandedArtifact={expandedArtifact} setExpandedArtifact={setExpandedArtifact}
                      onExtract={setExtractingArtifact}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })()}

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

        {/* Pending invitations received — always visible regardless of coaching flags */}
        {receivedInvites.length > 0 && (
          <div className="mb-5 pb-5 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Coaching</h3>
            <p className="text-xs font-medium text-gray-500 mb-2">Coaching invitations for you</p>
            <div className="space-y-2">
              {receivedInvites.map(inv => (
                <div key={inv.id} className="border border-indigo-100 bg-indigo-50 rounded-lg px-3 py-2.5">
                  <p className="text-sm font-medium text-gray-800 mb-0.5">
                    {inv.coachUsername} wants to coach you
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

        {coachingGlobalEnabled && (
          <div className="mb-5 pb-5 border-b border-gray-100">
            {receivedInvites.length === 0 && (
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Coaching</h3>
                {!coachingUserEnabled && (
                  <span className="text-xs text-gray-400 italic">Not enabled on your account</span>
                )}
              </div>
            )}

            {coachingVisible && (
              <>

                {/* Established coaching relationships */}
                {coachRelationships.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">Active coaching relationships</p>
                    <div className="space-y-3">
                      {coachRelationships.map(rel => {
                        const isCoach = rel.coach_id === user.id
                        const partnerId = isCoach ? rel.member_id : rel.coach_id
                        const partnerName = isCoach ? rel.member?.username : rel.coach?.username
                        const relArtifacts = artifacts.filter(a => a.scope === 'personal' && (
                          (a.recipient_id === partnerId && a.created_by === user.id) ||
                          (a.recipient_id === user.id && a.created_by === partnerId)
                        ))
                        const isPushingNew = pushingArtifact === `coaching-${rel.id}`
                        return (
                          <div key={rel.id} className="border border-gray-100 rounded-lg p-2.5">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                                  style={{ background: isCoach ? '#e0e7ff' : '#dcfce7', color: isCoach ? '#4338ca' : '#15803d' }}>
                                  {isCoach ? 'Coach' : 'Member'}
                                </span>
                                <span className="text-sm text-gray-700">{partnerName}</span>
                              </div>
                              <button
                                onClick={() => { setPushingArtifact(isPushingNew ? null : `coaching-${rel.id}`); setArtifactUrl(''); setArtifactTitle(''); setArtifactNotes('') }}
                                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                              >
                                + Artifact
                              </button>
                            </div>
                            {isPushingNew && (
                              <ArtifactForm
                                url={artifactUrl} setUrl={setArtifactUrl}
                                title={artifactTitle} setTitle={setArtifactTitle}
                                notes={artifactNotes} setNotes={setArtifactNotes}
                                saving={savingArtifact} error={artifactError}
                                onSubmit={() => pushArtifact({ scope: 'personal', recipientId: isCoach ? partnerId : user.id })}
                                onCancel={() => setPushingArtifact(null)}
                              />
                            )}
                            {relArtifacts.length > 0 && (
                              <div className="space-y-2 mt-1">
                                {relArtifacts.map(art => (
                                  <ArtifactCard
                                    key={art.id} artifact={art}
                                    versions={artifactVersions[art.id]}
                                    unreadCount={artifactNotifications.filter(n => n.artifact_id === art.id).length}
                                    onDelete={deleteArtifact} onToggleMain={toggleDisplayInMain}
                                    onMarkRead={markNotificationsRead} userId={user.id}
                                    pushingArtifact={pushingArtifact} setPushingArtifact={setPushingArtifact}
                                    artifactUrl={artifactUrl} setArtifactUrl={setArtifactUrl}
                                    artifactTitle={artifactTitle} setArtifactTitle={setArtifactTitle}
                                    artifactNotes={artifactNotes} setArtifactNotes={setArtifactNotes}
                                    savingArtifact={savingArtifact} artifactError={artifactError}
                                    pushNewVersion={pushNewVersion}
                                    expandedArtifact={expandedArtifact} setExpandedArtifact={setExpandedArtifact}
                                    onExtract={setExtractingArtifact}
                                  />
                                ))}
                              </div>
                            )}
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setInviteEmailTarget(inviteEmailTarget === collab.id ? null : collab.id); setInviteEmailValue('') }}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      ✉ Email invite
                    </button>
                    <button
                      onClick={() => generateInvite(collab.id)}
                      disabled={generating === collab.id}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
                    >
                      {generating === collab.id ? 'Generating...' : '+ Invite code'}
                    </button>
                  </div>
                </div>
                {inviteEmailTarget === collab.id && (
                  <div className="flex gap-2 mb-2">
                    <input
                      type="email"
                      placeholder="their@email.com"
                      value={inviteEmailValue}
                      onChange={e => setInviteEmailValue(e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-400"
                    />
                    <button
                      onClick={() => generateInvite(collab.id, inviteEmailValue.trim())}
                      disabled={!inviteEmailValue.trim() || generating === collab.id || sendingInviteEmail}
                      className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                    >
                      {sendingInviteEmail ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                )}
                <div className="text-xs text-gray-500 mb-2">
                  Members: {collab.collaboration_members?.map(m => m.profiles?.username || 'unknown').join(', ') || '—'}
                </div>
                {inviteCodes[collab.id]?.length > 0 && (
                  <div className="space-y-1.5 mb-2">
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

                {/* Artifacts for this collaboration */}
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-medium text-gray-500">Artifacts</p>
                    <button
                      onClick={() => { setPushingArtifact(pushingArtifact === `collab-${collab.id}` ? null : `collab-${collab.id}`); setArtifactUrl(''); setArtifactTitle(''); setArtifactNotes('') }}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      + Add
                    </button>
                  </div>
                  {pushingArtifact === `collab-${collab.id}` && (
                    <ArtifactForm
                      url={artifactUrl} setUrl={setArtifactUrl}
                      title={artifactTitle} setTitle={setArtifactTitle}
                      notes={artifactNotes} setNotes={setArtifactNotes}
                      saving={savingArtifact} error={artifactError}
                      onSubmit={() => pushArtifact({ scope: 'collaboration', collaborationId: collab.id })}
                      onCancel={() => setPushingArtifact(null)}
                    />
                  )}
                  {artifacts.filter(a => a.scope === 'collaboration' && a.collaboration_id === collab.id).length === 0 && pushingArtifact !== `collab-${collab.id}` && (
                    <p className="text-xs text-gray-400">No artifacts yet.</p>
                  )}
                  <div className="space-y-2">
                    {artifacts.filter(a => a.scope === 'collaboration' && a.collaboration_id === collab.id).map(art => (
                      <ArtifactCard
                        key={art.id} artifact={art}
                        versions={artifactVersions[art.id]}
                        unreadCount={artifactNotifications.filter(n => n.artifact_id === art.id).length}
                        onDelete={deleteArtifact} onToggleMain={toggleDisplayInMain}
                        onMarkRead={markNotificationsRead} userId={user.id}
                        pushingArtifact={pushingArtifact} setPushingArtifact={setPushingArtifact}
                        artifactUrl={artifactUrl} setArtifactUrl={setArtifactUrl}
                        artifactTitle={artifactTitle} setArtifactTitle={setArtifactTitle}
                        artifactNotes={artifactNotes} setArtifactNotes={setArtifactNotes}
                        savingArtifact={savingArtifact} artifactError={artifactError}
                        pushNewVersion={pushNewVersion}
                        expandedArtifact={expandedArtifact} setExpandedArtifact={setExpandedArtifact}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-5">
          Share a code with the person you want to invite. They'll enter it on the sign-up screen along with their own email, password, and username.
        </p>
      </div>
    </div>
    </>
  )
}
