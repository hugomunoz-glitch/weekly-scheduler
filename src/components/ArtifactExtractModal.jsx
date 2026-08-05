import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function ArtifactExtractModal({ artifact, version, onClose, onDone }) {
  const { user } = useAuth()
  const [step, setStep] = useState('idle')
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState({})
  const [goalAssignments, setGoalAssignments] = useState({}) // taskIndex -> goalId
  const [existingGoals, setExistingGoals] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('goals').select('id, title').eq('owner_id', user.id).order('created_at').then(({ data }) => {
      setExistingGoals(data || [])
    })
  }, [user.id])

  async function extract() {
    setStep('loading')
    setError('')
    console.log('Invoking extract with:', { title: version.title, hasContent: !!version.content, hasUrl: !!version.url })
    const { data, error: fnErr } = await supabase.functions.invoke('extract-artifact-tasks', {
      body: { url: version.url || null, title: version.title || 'Untitled', notes: version.notes || null, content: version.content || null },
      headers: { 'Content-Type': 'application/json' },
    })
    if (fnErr || data?.error) {
      setError(fnErr?.message || data?.error || JSON.stringify(fnErr) || 'Extraction failed')
      console.error('Extract error:', fnErr, data)
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
    const toAdd = items.map((item, i) => ({ ...item, index: i })).filter((_, i) => selected[i])

    const goals = toAdd.filter(i => i.type === 'goal')
    const tasks = toAdd.filter(i => i.type === 'task')

    // Insert goals and collect their new IDs so tasks can reference them by title
    const newGoalIdsByTitle = {}
    if (goals.length) {
      const { data: insertedGoals, error: goalsErr } = await supabase.from('goals').insert(goals.map(g => ({
        owner_id: user.id,
        title: g.title,
        due_date: g.dueDate || null,
        source_artifact_version_id: version.id,
      }))).select('id, title')
      if (goalsErr) { setError('Failed to save goals: ' + goalsErr.message); setStep('review'); return }
      insertedGoals?.forEach(g => { newGoalIdsByTitle[g.title] = g.id })
    }

    if (tasks.length) {
      const { error: tasksErr } = await supabase.from('tasks').insert(tasks.map(t => {
        // Use manually assigned goal, or match by title to a newly created goal
        const assignedGoalId = goalAssignments[t.index] || newGoalIdsByTitle[t.goalTitle] || null
        return {
          owner_id: user.id,
          title: t.title,
          notes: t.description || null,
          scheduled_date: null,
          bucket: null,
          status: 'inbox',
          goal_id: assignedGoalId,
          source_artifact_version_id: version.id,
        }
      }))
      if (tasksErr) { setError('Failed to save tasks: ' + tasksErr.message); setStep('review'); return }
    }

    setStep('done')
    setTimeout(() => { onDone?.(); onClose() }, 1200)
  }

  const goalItems = items.filter(i => i.type === 'goal')
  const taskItems = items.filter(i => i.type === 'task')
  const selectedCount = Object.values(selected).filter(Boolean).length

  // All goals available to assign: existing + ones being created in this extraction
  const allGoalOptions = [
    ...existingGoals,
    ...goalItems.map((g, i) => ({ id: `new-${i}`, title: g.title + ' (new)' }))
  ]

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
                    <div key={i} className={`p-2.5 rounded-lg border transition-colors ${selected[i] ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={!!selected[i]} onChange={() => setSelected(s => ({ ...s, [i]: !s[i] }))}
                          className="mt-0.5 accent-indigo-600" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{item.title}</p>
                          {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                          {item.dueDate && <p className="text-xs text-indigo-500 mt-0.5">{item.dueDate}</p>}
                        </div>
                      </label>
                      {selected[i] && allGoalOptions.length > 0 && (
                        <div className="mt-1.5 ml-6">
                          <select
                            value={goalAssignments[i] || ''}
                            onChange={e => setGoalAssignments(g => ({ ...g, [i]: e.target.value || null }))}
                            className="w-full text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white text-gray-600"
                          >
                            <option value="">No goal</option>
                            {existingGoals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                            {goalItems.filter((_, gi) => selected[items.indexOf(goalItems[gi])]).map((g, gi) => (
                              <option key={`new-${gi}`} value={`new-${gi}`}>{g.title} (being added)</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
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
