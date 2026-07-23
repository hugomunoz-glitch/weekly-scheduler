const STORAGE_KEY = 'schedulerFamilyMembers'

export function getFamilyMembers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function addFamilyMember(name) {
  const trimmed = (name || '').trim()
  if (!trimmed) return getFamilyMembers()
  const current = getFamilyMembers()
  if (current.includes(trimmed)) return current
  const updated = [...current, trimmed].sort((a, b) => a.localeCompare(b))
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {}
  return updated
}
