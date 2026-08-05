import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function ArtifactExtractModal({ artifact, version, onClose, onDone }) {
  const { user } = useAuth()
  const [step, setStep] = useState('idle')
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState({})
  const [goalAssignments, setGoalAssignments] = useState({}) // taskIndex -> 'new:<goalTitle>' or existing goal UUID
  const [existingGoals, setExistingGoals] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('goals').select('id, title').eq('owner_id', user.id).order('created_at').then(({ data }) => {
      setExistingGoals(data || [])
    })
  }, [user.id])

  function updateItem(index, field, value) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  async function extract() {
    setStep('loading')
    setError('')
    const { data, error: fnErr } = await supabase.functions.invoke('extract-artifact-tasks', {
      body: { url: version.url || null, title: version.title || 'Untitled', notes: version.notes || null, content: version.content || null },
      headers: { 'Content-Type': 'application/json' },
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

    // Auto-assign tasks to goals based on goalTitle returned by AI
    const extractedGoalTitles = extracted.filter(it => it.type === 'goal').map(g => g.title)
    const assignments = {}
    extracted.forEach((item, i) => {
      if (item.type !== 'task' || !item.goalTitle) return
      const match = extractedGoalTitles.find(t => t === item.goalTitle)
        || extractedGoalTitles.find(t =>
          t.toLowerCase().includes(item.goalTitle.toLowerCase()) ||
          item.goalTitle.toLowerCase().includes(t.toLowerCase())
        )
      if (match) {
        assignments[i] = 'new:' + match
      } else {
        const existing = existingGoals.find(g =>
          g.title === item.goalTitle ||
          g.title.toLowerCase().includes(item.goalTitle.toLowerCase())
        )
        if (existing) assignments[i] = existing.id
      }
    })
    setGoalAssignments(assignments)
    setStep('review')
  }

  async function addToSchedule() {
    setStep('saving')
    const toAdd = items.map((item, i) => ({ ...item, index: i })).filter((_, i) => selected[i])

    const goals = toAdd.filter(i => i.type === 'goal')
    const tasks = toAdd.filter(i => i.type === 'task')

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
        const assignment = goalAssignments[t.index]
        let goalId = null
        if (assignment) {
          if (assignment.startsWith('new:')) {
            goalId = newGoalIdsByTitle[assignment.slice(4)] || null
          } else {
            goalId = assignment // existing goal UUID
          }
        }
        if (!goalId && t.goalTitle) goalId = newGoalIdsByTitle[t.goalTitle] || null
        return {
          owner_id: user.id,
          title: t.title,
          notes: t.description || null,
          scheduled_date: null,
          bucket: null,
          status: 'inbox',
          goal_id: goalId,
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

  const newGoalOptions = goalItems.map(g => ({ value: 'new:' + g.title, label: g.title + ' (from this artifact)' }))
  const existingGoalOptions = existingGoals.map(g => ({ value: g.id, label: g.title }))

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
              <p className="text-sm text-gray-700">Found <strong>{items.length}</strong> items. Edit and select what to add:</p>
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
                    <div key={i} className={`p-2.5 rounded-lg border transition-colors ${selected[i] ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
                      <div className="flex items-start gap-2.5">
                        <input type="checkbox" checked={!!selected[i]} onChange={() => setSelected(s => ({ ...s, [i]: !s[i] }))}
                          className="mt-2 accent-indigo-600 shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1">
                          <input
                            type="text"
                            value={item.title}
                            onChange={e => updateItem(i, 'title', e.target.value)}
                            className="w-full text-sm font-medium text-gray-800 bg-transparent border-b border-transparent focus:border-indigo-300 focus:outline-none pb-0.5"
                          />
                          <input
                            type="text"
                            value={item.description || ''}
                            onChange={e => updateItem(i, 'description', e.target.value)}
                            placeholder="Add description…"
                            className="w-full text-xs text-gray-500 bg-transparent border-b border-transparent focus:border-indigo-300 focus:outline-none pb-0.5"
                          />
                          {item.dueDate && <p className="text-xs text-indigo-500">Due {item.dueDate}</p>}
                        </div>
                      </div>
                    </div>
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
                      <div className="flex items-start gap-2.5">
                        <input type="checkbox" checked={!!selected[i]} onChange={() => setSelected(s => ({ ...s, [i]: !s[i] }))}
                          className="mt-2 accent-indigo-600 shrink-0" />
                        <div className="flex-1 min-w-0 space-y-1">
                          <input
                            type="text"
                            value={item.title}
                            onChange={e => updateItem(i, 'title', e.target.value)}
                            className="w-full text-sm font-medium text-gray-800 bg-transparent border-b border-transparent focus:border-indigo-300 focus:outline-none pb-0.5"
                          />
                          <input
                            type="text"
                            value={item.description || ''}
                            onChange={e => updateItem(i, 'description', e.target.value)}
                            placeholder="Add description…"
                            className="w-full text-xs text-gray-500 bg-transparent border-b border-transparent focus:border-indigo-300 focus:outline-none pb-0.5"
                          />
                          {(newGoalOptions.length > 0 || existingGoalOptions.length > 0) && (
                            <select
                              value={goalAssignments[i] || ''}
                              onChange={e => setGoalAssignments(g => ({ ...g, [i]: e.target.value || null }))}
                              className="w-full text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white text-gray-600 mt-1"
                            >
                              <option value="">No goal</option>
                              {newGoalOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                              {existingGoalOptions.length > 0 && newGoalOptions.length > 0 && (
                                <option disabled>──────────</option>
                              )}
                              {existingGoalOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
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
