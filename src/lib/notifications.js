import { format } from 'date-fns'

const BUCKET_TIMES = {
  morning:   { hour: 8,  minute: 0 },
  afternoon: { hour: 12, minute: 0 },
  evening:   { hour: 17, minute: 0 },
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  return result
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

async function getSwRegistration() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    return reg
  } catch (e) {
    console.warn('SW registration failed', e)
    return null
  }
}

// Build the list of notifications for today based on tasks
function buildTodayNotifications(tasks) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayTasks = tasks.filter(t => t.scheduled_date === today && t.status !== 'done')

  const byBucket = { morning: [], afternoon: [], evening: [] }
  for (const t of todayTasks) {
    const bucket = t.bucket || 'morning'
    if (byBucket[bucket]) byBucket[bucket].push(t.title)
  }

  const notifications = []
  const now = new Date()

  for (const [bucket, titles] of Object.entries(byBucket)) {
    if (titles.length === 0) continue
    const { hour, minute } = BUCKET_TIMES[bucket]
    const fireAt = new Date()
    fireAt.setHours(hour, minute, 0, 0)
    if (fireAt <= now) continue  // already passed today

    const label = bucket.charAt(0).toUpperCase() + bucket.slice(1)
    const body = titles.length === 1
      ? titles[0]
      : `${titles.length} tasks: ${titles.slice(0, 2).join(', ')}${titles.length > 2 ? '…' : ''}`

    notifications.push({
      title: `Schedulent — ${label}`,
      body,
      tag: `schedulent-${bucket}`,
      fireAt: fireAt.getTime(),
    })
  }

  return notifications
}

let _scheduledHandles = []

// Schedule notifications via SW (works while app is open/backgrounded on mobile)
export async function scheduleDailyNotifications(tasks) {
  if (getNotificationPermission() !== 'granted') return

  // Clear any previously scheduled timers (page-side fallback)
  for (const h of _scheduledHandles) clearTimeout(h)
  _scheduledHandles = []

  const notifications = buildTodayNotifications(tasks)
  if (notifications.length === 0) return

  const sw = await getSwRegistration()
  if (sw?.active) {
    // Preferred: let SW handle it (works in background)
    sw.active.postMessage({ type: 'SCHEDULE_NOTIFICATIONS', notifications })
  } else {
    // Fallback: schedule in page context (only works while tab is open)
    for (const n of notifications) {
      const delay = n.fireAt - Date.now()
      if (delay > 0) {
        const handle = setTimeout(() => {
          new Notification(n.title, { body: n.body, icon: '/icon-192.png', tag: n.tag })
        }, delay)
        _scheduledHandles.push(handle)
      }
    }
  }
}
