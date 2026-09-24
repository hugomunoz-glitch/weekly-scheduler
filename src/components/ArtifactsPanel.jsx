import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ArtifactExtractModal from './ArtifactExtractModal'

export default function ArtifactsPanel({ user }) {
  const [artifacts, setArtifacts] = useState([])
  const [versions, setVersions] = useState({})
  const [notifications, setNotifications] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [expanded, setExpanded] = useState({})
  const [extracting, setExtracting] = useState(null)
  const [pushingId, setPushingId] = useState(null)
  const [pushUrl, setPushUrl] = useState('')
  const [pushTitle, setPushTitle] = useState('')
  const [pushNotes, setPushNotes] = useState('')
  const [pushError, setPushError] = useState('')

  useEffect(() => { fetchArtifacts() }, [])

  async function fetchArtifacts() {
    setLoading(true)
    const { data: arts } = await supabase
      .from('artifacts')
      .select('*')
      .eq('scope', 'personal')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (!arts?.length) { setArtifacts([]); setLoading(false); return }

    const ids = arts.map(a => a.id)
    const { data: vers } = await supabase
      .from('artifact_versions')
      .select('*')
      .in('artifact_id', ids)
      .order('version_number', { ascending: false })

    const { data: notifs } = await supabase
      .from('artifact_notifications')
      .select('artifact_id')
      .in('artifact_id', ids)
      .eq('is_read', false)

    const vMap = {}
    vers?.forEach(v => { if (!vMap[v.artifact_id]) vMap[v.artifact_id] = []; vMap[v.artifact_id].push(v) })
    const nMap = {}
    notifs?.forEach(n => { nMap[n.artifact_id] = (nMap[n.artifact_id] || 0) + 1 })

    setArtifacts(arts)
    setVersions(vMap)
    setNotifications(nMap)
    setLoading(false)
  }

  async function createArtifact() {
    if (!url.trim() || !title.trim()) { setFormError('URL and title are required'); return }
    setSaving(true); setFormError('')
    const { data: art, error: artErr } = await supabase.from('artifacts').insert({
      scope: 'personal', recipient_id: user.id, created_by: user.id
    }).select().single()
    if (artErr) { setFormError(artErr.message); setSaving(false); return }
    const { error: verErr } = await supabase.from('artifact_versions').insert({
      artifact_id: art.id, url: url.trim(), title: title.trim(),
      notes: notes.trim() || null, pushed_by: user.id
    })
    if (verErr) { setFormError(verErr.message); setSaving(false); return }
    setUrl(''); setTitle(''); setNotes(''); setShowForm(false); setSaving(false)
    fetchArtifacts()
  }

  async function pushVersion(artifactId) {
    if (!pushUrl.trim() || !pushTitle.trim()) { setPushError('URL and title are required'); return }
    setSaving(true); setPushError('')
    const { error } = await supabase.from('artifact_versions').insert({
      artifact_id: artifactId, url: pushUrl.trim(), title: pushTitle.trim(),
      notes: pushNotes.trim() || null, pushed_by: user.id
    })
    if (error) { setPushError(error.message); setSaving(false); return }
    setPushingId(null); setPushUrl(''); setPushTitle(''); setPushNotes('')
    setSaving(false); fetchArtifacts()
  }

  async function deleteArtifact(id) {
    await supabase.from('artifacts').update({ deleted_at: new Date().toISOString(), deleted_by: user.id }).eq('id', id)
    fetchArtifacts()
  }

  async function markRead(artifactId) {
    const { data: notifs } = await supabase.from('artifact_notifications')
      .select('id').eq('artifact_id', artifactId).eq('is_read', false)
    if (notifs?.length) {
      await supabase.from('artifact_notifications').update({ is_read: true }).in('id', notifs.map(n => n.id))
      setNotifications(n => ({ ...n, [artifactId]: 0 }))
    }
  }

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading artifacts...</div>

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Save Claude artifact links to extract tasks & goals.</p>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            + Add
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Artifact URL (claude.ai/...)"
            style={{ width: '100%', fontSize: 13, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, marginBottom: 6, boxSizing: 'border-box' }} />
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
            style={{ width: '100%', fontSize: 13, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, marginBottom: 6, boxSizing: 'border-box' }} />
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2}
            style={{ width: '100%', fontSize: 13, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, marginBottom: 6, boxSizing: 'border-box', resize: 'none' }} />
          {formError && <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 6 }}>{formError}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={createArtifact} disabled={saving}
              style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '7px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setShowForm(false); setFormError('') }}
              style={{ fontSize: 13, padding: '7px 14px', background: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {artifacts.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>No artifacts yet.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {artifacts.map(art => {
          const vers = versions[art.id] || []
          const latest = vers[0]
          const unread = notifications[art.id] || 0
          const isExpanded = expanded[art.id]
          return (
            <div key={art.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {unread > 0 && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />}
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {latest?.title || 'Untitled'}
                    </p>
                  </div>
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>v{latest?.version_number} · {vers.length} version{vers.length !== 1 ? 's' : ''}</p>
                  {latest?.notes && <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>{latest.notes}</p>}
                </div>
                <button onClick={() => deleteArtifact(art.id)}
                  style={{ fontSize: 16, background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>×</button>
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {latest && (
                  <a href={latest.url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', background: '#f3f4f6', color: '#374151', borderRadius: 6, textDecoration: 'none' }}>
                    Open ↗
                  </a>
                )}
                {latest && (
                  <button onClick={() => { markRead(art.id); setExtracting({ artifact: art, version: latest }) }}
                    style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', background: '#eef2ff', color: '#6366f1', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    Extract
                  </button>
                )}
                <button onClick={() => { setExpanded(e => ({ ...e, [art.id]: !e[art.id] })); if (unread) markRead(art.id) }}
                  style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                  {isExpanded ? 'Hide' : 'Versions'}
                </button>
                <button onClick={() => setPushingId(pushingId === art.id ? null : art.id)}
                  style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', background: '#f0fdf4', color: '#16a34a', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                  + Version
                </button>
              </div>

              {pushingId === art.id && (
                <div style={{ marginTop: 10, padding: 10, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                  <input value={pushUrl} onChange={e => setPushUrl(e.target.value)} placeholder="New artifact URL"
                    style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, marginBottom: 5, boxSizing: 'border-box' }} />
                  <input value={pushTitle} onChange={e => setPushTitle(e.target.value)} placeholder="Title"
                    style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, marginBottom: 5, boxSizing: 'border-box' }} />
                  <textarea value={pushNotes} onChange={e => setPushNotes(e.target.value)} placeholder="Notes (optional)" rows={2}
                    style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, marginBottom: 5, boxSizing: 'border-box', resize: 'none' }} />
                  {pushError && <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 5 }}>{pushError}</p>}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => pushVersion(art.id)} disabled={saving}
                      style={{ flex: 1, fontSize: 12, fontWeight: 600, padding: '6px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                      Push
                    </button>
                    <button onClick={() => { setPushingId(null); setPushError('') }}
                      style={{ fontSize: 12, padding: '6px 10px', background: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {isExpanded && vers.length > 0 && (
                <div style={{ marginTop: 10, borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
                  {vers.map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f9fafb' }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>v{v.version_number} — {v.title}</span>
                        {v.notes && <p style={{ fontSize: 11, color: '#9ca3af', margin: '1px 0 0' }}>{v.notes}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <a href={v.url} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, padding: '3px 7px', background: '#f3f4f6', color: '#374151', borderRadius: 5, textDecoration: 'none' }}>
                          Open
                        </a>
                        <button onClick={() => setExtracting({ artifact: art, version: v })}
                          style={{ fontSize: 11, padding: '3px 7px', background: '#eef2ff', color: '#6366f1', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
                          Extract
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {extracting && (
        <ArtifactExtractModal
          artifact={extracting.artifact}
          version={extracting.version}
          onClose={() => setExtracting(null)}
          onDone={() => fetchArtifacts()}
        />
      )}
    </div>
  )
}
