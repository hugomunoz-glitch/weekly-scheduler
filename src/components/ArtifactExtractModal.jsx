import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'

export default function ArtifactExtractModal({ artifact, version, onClose, onDone }) {
  const { user } = useAuth()
  const [step, setStep] = useState('idle') // idle | loading | review | saving | done
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState({})
  const [error, setError] = useState('')

  async function extract() {
    setStep('loading')
    setError('')
    const { data, error: fnErr } = await supabase.functions.invoke('extract-artifact-tasks', {
      body: { url: version.url, title: version.title, notes: version.notes, content: version.content || null }
    })
    if (fnErr || data?.error) {
      setError(fnErr?.message || data?.error || 'Extraction failed')
      setStep('idle')
      return
    }
    const extracted = data?.items || []
    setItems(extracted)
    const sel = {}
    extracted.forEach((_, i) => { sel[i] = true })
    setSelected(sel)
    setStep('review')
  }

  async function addToSchedule() {
    setStep('saving')
    const toAdd = items.filter((_, i) => selected[i])
    const today = format(new Date(), 'yyyy-MM-dd')

    const goals = toAdd.filter(i => i.type === 'goal')
    const tasks = toAdd.filter(i => i.type === 'task')

    if (goals.length) {
      await supabase.from('goals').insert(goals.map(g => ({
        owner_id: user.id,
        title: g.title,
        due_date: g.dueDate || null,
        source_artifact_version_id: version.id,
      })))
    }

    if (tasks.length) {
      await supabase.from('tasks').insert(tasks.map(t => ({
        owner_id: user.id,
        title: t.title,
        notes: t.description || null,
        scheduled_date: t.dueDate || today,
        bucket: t.bucket || 'morning',
        status: 'scheduled',
        source_artifact_version_id: version.id,
      })))
    }

    setStep('done')
    setTimeout(() => { onDone?.(); onClose() }, 1200)
  }

  const goalItems = items.filter(i => i.type === 'goal')
  const taskItems = items.filter(i => i.type === 'task')
  const selectedCount = Object.values(selected).filter(Boolean).length

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[4000] p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Extract from artifact</h2>
            <p className="text-xs text-gray-500 mt-0.5">{version.title} · v{version.version_number}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm">Close</button>
        </div>

        {error && <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        {step === 'idle' && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-600 mb-4">Claude will scan this artifact and extract all actionable tasks and goals so you can add them to your schedule.</p>
            <button onClick={extract} className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
              Extract tasks & goals
            </button>
          </div>
        )}

        {step === 'loading' && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Scanning artifact...</p>
          </div>
        )}

        {step === 'review' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-700">Found <strong>{items.length}</strong> items. Select what to add:</p>
              <div className="flex gap-2">
                <button onClick={() => setSelected(Object.fromEntries(items.map((_, i) => [i, true])))}
                  className="text-xs text-indigo-600 hover:underline">All</button>
                <button onClick={() => setSelected(Object.fromEntries(items.map((_, i) => [i, false])))}
                  className="text-xs text-gray-400 hover:underline">None</button>
              </div>
            </div>

            {goalItems.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Goals</p>
                <div className="space-y-1.5">
                  {items.map((item, i) => item.type !== 'goal' ? null : (
                    <label key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${selected[i] ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
                      <input type="checkbox" checked={!!selected[i]} onChange={() => setSelected(s => ({ ...s, [i]: !s[i] }))}
                        className="mt-0.5 accent-indigo-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{item.title}</p>
                        {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                        {item.dueDate && <p className="text-xs text-indigo-500 mt-0.5">Due {item.dueDate}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {taskItems.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tasks</p>
                <div className="space-y-1.5">
                  {items.map((item, i) => item.type !== 'task' ? null : (
                    <label key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${selected[i] ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
                      <input type="checkbox" checked={!!selected[i]} onChange={() => setSelected(s => ({ ...s, [i]: !s[i] }))}
                        className="mt-0.5 accent-indigo-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{item.title}</p>
                        {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                        <div className="flex gap-2 mt-0.5">
                          {item.dueDate && <p className="text-xs text-indigo-500">{item.dueDate}</p>}
                          {item.bucket && <p className="text-xs text-gray-400 capitalize">{item.bucket}</p>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={addToSchedule}
              disabled={selectedCount === 0}
              className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              Add {selectedCount} item{selectedCount !== 1 ? 's' : ''} to schedule
            </button>
          </>
        )}

        {step === 'saving' && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Adding to your schedule...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-6">
            <p className="text-2xl mb-2">✓</p>
            <p className="text-sm font-medium text-gray-800">Added to your schedule!</p>
          </div>
        )}
      </div>
    </div>
  )
}
