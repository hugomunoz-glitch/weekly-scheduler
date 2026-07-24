import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { exportPDF, exportSpreadsheet } from '../lib/exportUtils'

const SCOPE_OPTIONS = [
  { id: 'all', label: 'All tasks ever' },
  { id: 'week', label: 'Current week' },
  { id: 'today', label: 'Today only' },
  { id: 'inbox', label: 'Inbox only' },
]

export default function ExportMenu({ tasks, goals, weekStart, isMobile = false }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState('all')
  const [exporting, setExporting] = useState(null) // 'pdf' | 'xlsx' | null
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchReflections() {
    if (!user) return []
    const { data } = await supabase
      .from('daily_reflections')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    return data || []
  }

  async function handlePDF() {
    setExporting('pdf')
    const reflections = await fetchReflections()
    exportPDF({ tasks, goals, reflections })
    setExporting(null)
    setOpen(false)
  }

  async function handleXLSX() {
    setExporting('xlsx')
    const reflections = await fetchReflections()
    exportSpreadsheet({ tasks, goals, reflections, scope, weekStart })
    setExporting(null)
    setOpen(false)
  }

  const panelContent = (
        <div style={{ padding: isMobile ? '0' : '12px' }}>
          {/* PDF — always exports everything */}
          <div style={{ marginBottom: '12px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PDF</p>
            <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#6b7280' }}>Includes all goals, tasks, and reflections.</p>
            <button
              onClick={handlePDF}
              disabled={!!exporting}
              style={{ width: '100%', padding: '8px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: exporting ? 'default' : 'pointer', opacity: exporting ? 0.6 : 1 }}
            >
              {exporting === 'pdf' ? 'Generating…' : 'Download PDF'}
            </button>
          </div>

          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
            <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Spreadsheet (.xlsx)</p>
            <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#6b7280' }}>Choose task scope — goals and reflections always included.</p>

            {/* Scope selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
              {SCOPE_OPTIONS.map(opt => (
                <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', cursor: 'pointer', padding: '4px 6px', borderRadius: '6px', background: scope === opt.id ? '#eef2ff' : 'transparent' }}>
                  <input
                    type="radio"
                    name="scope"
                    value={opt.id}
                    checked={scope === opt.id}
                    onChange={() => setScope(opt.id)}
                    style={{ accentColor: '#6366f1' }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            <button
              onClick={handleXLSX}
              disabled={!!exporting}
              style={{ width: '100%', padding: '8px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: exporting ? 'default' : 'pointer', opacity: exporting ? 0.6 : 1 }}
            >
              {exporting === 'xlsx' ? 'Generating…' : 'Download Spreadsheet'}
            </button>
          </div>
        </div>
  )

  if (isMobile) return panelContent

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
      >
        Export ↓
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
          background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.10)', width: '240px'
        }}>
          {panelContent}
        </div>
      )}
    </div>
  )
}
