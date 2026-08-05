import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function ArtifactExtractModal({ artifact, version, onClose, onDone }) {
  const { user } = useAuth()
  const [step, setStep] = useState('idle')
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState({})
  const [goalAssignments, setGoalAssignments] = useState({})
  const [prerequisites, setPrerequisites] = useState({}) // goalIndex -> prerequisiteTitle
  const [unlockMode, setUnlockMode] = useState('sequential') // 'sequential' | 'all'
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

    // If the coach pre-defined a goal sequence, inject those goals into the extraction
    const coachGoalSequence = version.goal_sequence || null
    const coachGoalTitles = coachGoalSequence ? coachGoalSequence.map(g => g.title) : null

    const { data, error: fnErr } = await supabase.functions.invoke('extract-artifact-tasks', {
      body: {
        url: version.url || null,
        title: version.title || 'Untitled',
        notes: version.notes || null,
        content: version.content || null,
        goalTitles: coachGoalTitles,
      },
      headers: { 'Content-Type': 'application/json' },
    })
    if (fnErr || data?.error) {
      setError(fnErr?.message || data?.error || 'Extraction failed')
      setStep('idle')
      return
    }

    // Merge: if coach defined goals, use those; otherwise use AI-extracted goals
    let extracted = data?.items || []
    if (coachGoalSequence && coachGoalSequence.length > 0) {
      // Replace AI goals with coach-defined goals, keep AI tasks
      const aiTasks = extracted.filter(it => it.type === 'task')
      const coachGoals = coachGoalSequence.map((g, idx) => ({
        type: 'goal',
        title: g.title,
        description: g.description || null,
        dueDate: null,
        // Sequential: each goal after the first gets the previous as prerequisite
        prerequisiteTitle: idx > 0 ? coachGoalSequence[idx - 1].title : null,
      }))
      extracted = [...coachGoals, ...aiTasks]
    }

    setItems(extracted)

    const sel = {}
    extracted.forEach((_, i) => { sel[i] = true })
    setSelected(sel)

    // Auto-assign tasks to goals
    const extractedGoalTitles = extracted.filter(it => it.type === 'goal').map(g => g.title)
    const assignments = {}
    extracted.forEach((item, i) => {
      if (item.type !== 'task' || !item.goalTitle) return
      const match = extractedGoalTitles.find(t => t === item.goalTitle)
        || extractedGoalTitles.find(t =>
          t.toLowerCase().includes(item.goalTitle.toLowerCase()) ||
          item.goalTitle.toLowerCase().includes(t.toLowerCase())
        )
      if (match) assignments[i] = 'new:' + match
      else {
        const existing = existingGoals.find(g =>
          g.title === item.goalTitle || g.title.toLowerCase().includes(item.goalTitle.toLowerCase())
        )
        if (existing) assignments[i] = existing.id
      }
    })
    setGoalAssignments(assignments)

    // Auto-populate prerequisites
    const prereqs = {}
    extracted.forEach((item, i) => {
      if (item.type === 'goal' && item.prerequisiteTitle) prereqs[i] = item.prerequisiteTitle
    })
    // If coach defined a sequence or AI returned prerequisites, apply them
    // Otherwise in sequential mode, auto-wire by position
    const goalsList = extracted.filter(it => it.type === 'goal')
    if (Object.keys(prereqs).length === 0 && goalsList.length > 1) {
      // Auto-wire sequential: each goal unlocks after the previous
      goalsList.forEach((g, idx) => {
        if (idx === 0) return
        const gIndex = extracted.indexOf(g)
        prereqs[gIndex] = goalsList[idx - 1].title
      })
    }
    setPrerequisites(prereqs)
    if (coachGoalSequence && coachGoalSequence.length > 1) setUnlockMode('sequential')

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
        source_artifact_version_id: version.id,
      }))).select('id, title')
      if (goalsErr) { setError('Failed to save goals: ' + goalsErr.message); setStep('review'); return }
      insertedGoals?.forEach(g => { newGoalIdsByTitle[g.title] = g.id })

      // Wire up prerequisites in sequential or custom mode
      if (unlockMode === 'sequential' || unlockMode === 'custom') {
        const prereqUpdates = goals
          .map(g => {
            const prereqTitle = prerequisites[g.index]
            if (!prereqTitle) return null
            const prereqId = newGoalIdsByTitle[prereqTitle] || null
            if (!prereqId) return null
            const goalId = newGoalIdsByTitle[g.title]
            if (!goalId) return null
            return { id: goalId, prerequisite_goal_id: prereqId }
          })
          .filter(Boolean)
        for (const upd of prereqUpdates) {
          const { error: prereqErr } = await supabase
            .from('goals')
            .update({ prerequisite_goal_id: upd.prerequisite_goal_id })
            .eq('id', upd.id)
          if (prereqErr) {
            console.error('Failed to set prerequisite:', prereqErr)
            setError('Goals saved but prerequisite links failed: ' + prereqErr.message)
            setStep('review')
            return
          }
        }
      }
    }

    if (tasks.length) {
      const { error: tasksErr } = await supabase.from('tasks').insert(tasks.map(t => {
        const assignment = goalAssignments[t.index]
        let goalId = null
        if (assignment) {
          goalId = assignment.startsWith('new:') ? (newGoalIdsByTitle[assignment.slice(4)] || null) : assignment
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

  const goalItems = items.map((item, i) => ({ ...item, index: i })).filter(i => i.type === 'goal')
  const taskItems = items.map((item, i) => ({ ...item, index: i })).filter(i => i.type === 'task')
  const selectedCount = Object.values(selected).filter(Boolean).length

  const newGoalOptions = goalItems.map(g => ({ value: 'new:' + g.title, label: g.title + ' (from this artifact)' }))
  const existingGoalOptions = existingGoals.map(g => ({ value: g.id, label: g.title }))

  // Build ordered chain for display
  function buildChain() {
    const visited = new Set()
    const chain = []
    const roots = goalItems.filter(g => !prerequisites[g.index] || !goalItems.some(o => o.title === prerequisites[g.index]))
    function walk(g) {
      if (!g || visited.has(g.title)) return
      visited.add(g.title)
      chain.push(g)
      const next = goalItems.find(other => prerequisites[other.index] === g.title)
      if (next) walk(next)
    }
    roots.forEach(walk)
    goalItems.forEach(g => { if (!visited.has(g.title)) chain.push(g) })
    return chain
  }
  const goalChain = buildChain()

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
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Goals</p>
                  {/* Unlock mode toggle */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                    <button
                      onClick={() => { setUnlockMode('all'); setPrerequisites({}) }}
                      className={`text-xs px-2 py-0.5 rounded-md transition-colors ${unlockMode === 'all' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                    >
                      All at once
                    </button>
                    <button
                      onClick={() => {
                        setUnlockMode('sequential')
                        const newPrereqs = {}
                        goalChain.forEach((goal, idx) => {
                          if (idx === 0) return
                          newPrereqs[goal.index] = goalChain[idx - 1].title
                        })
                        setPrerequisites(newPrereqs)
                      }}
                      className={`text-xs px-2 py-0.5 rounded-md transition-colors ${unlockMode === 'sequential' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                    >
                      Sequential
                    </button>
                    <button
                      onClick={() => setUnlockMode('custom')}
                      className={`text-xs px-2 py-0.5 rounded-md transition-colors ${unlockMode === 'custom' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                    >
                      Custom
                    </button>
                  </div>
                </div>
                {unlockMode === 'all' && (
                  <p className="text-xs text-gray-400 mb-2">All goals start available immediately — no prerequisites.</p>
                )}
                {unlockMode === 'sequential' && (
                  <p className="text-xs text-gray-400 mb-2">Goals unlock in order. Adjust any prerequisite below.</p>
                )}
                {unlockMode === 'custom' && (
                  <p className="text-xs text-gray-400 mb-2">Choose which goal each one unlocks after — or none.</p>
                )}

                <div className="space-y-0">
                  {goalChain.map((goal, chainIdx) => {
                    const i = goal.index
                    const prereqTitle = (unlockMode === 'sequential' || unlockMode === 'custom') ? prerequisites[i] : null
                    const isChained = unlockMode === 'sequential' && !!prereqTitle && goalItems.some(g => g.title === prereqTitle)
                    return (
                      <div key={i}>
                        {isChained && (
                          <div className="flex items-center gap-1.5 pl-4 py-0.5">
                            <div className="w-px h-3 bg-indigo-300 ml-1" />
                            <span className="text-[10px] text-indigo-400">unlocks after "{prereqTitle}"</span>
                          </div>
                        )}
                        <div className={`p-2.5 rounded-lg border transition-colors mb-1.5 ${selected[i] ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
                          <div className="flex items-start gap-2.5">
                            <input type="checkbox" checked={!!selected[i]} onChange={() => {
                              const nowSelected = !selected[i]
                              setSelected(s => {
                                const next = { ...s, [i]: nowSelected }
                                // When unchecking a goal, also uncheck its tasks
                                if (!nowSelected) {
                                  const goalTitle = items[i]?.title
                                  items.forEach((it, idx) => {
                                    if (it.type !== 'task') return
                                    // Match by initial goalTitle or by goalAssignments pointing to this goal
                                    const assigned = goalAssignments[idx]
                                    const assignedToThis = assigned === 'new:' + goalTitle || it.goalTitle === goalTitle
                                    if (assignedToThis) next[idx] = false
                                  })
                                }
                                return next
                              })
                            }}
                              className="mt-2 accent-indigo-600 shrink-0" />
                            <div className="flex-1 min-w-0 space-y-1">
                              <input
                                type="text"
                                value={goal.title}
                                onChange={e => updateItem(i, 'title', e.target.value)}
                                className="w-full text-sm font-medium text-gray-800 bg-transparent border-b border-transparent focus:border-indigo-300 focus:outline-none pb-0.5"
                              />
                              <input
                                type="text"
                                value={goal.description || ''}
                                onChange={e => updateItem(i, 'description', e.target.value)}
                                placeholder="Add description…"
                                className="w-full text-xs text-gray-500 bg-transparent border-b border-transparent focus:border-indigo-300 focus:outline-none pb-0.5"
                              />
                              {(unlockMode === 'sequential' || unlockMode === 'custom') && (
                                <select
                                  value={prerequisites[i] || ''}
                                  onChange={e => setPrerequisites(p => ({ ...p, [i]: e.target.value || null }))}
                                  className="w-full text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white text-gray-500 mt-1"
                                >
                                  <option value="">No prerequisite (starts immediately)</option>
                                  {goalItems.filter(g => g.index !== i).map(g => (
                                    <option key={g.index} value={g.title}>Unlocks after: {g.title}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {taskItems.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tasks</p>
                <div className="space-y-1.5">
                  {taskItems.map(item => {
                    const i = item.index
                    return (
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
                    )
                  })}
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
