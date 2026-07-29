import { format } from 'date-fns'

const BUCKET_TIMES = {
  morning:   { hour: 8,  minute: 0 },
  afternoon: { hour: 12, minute: 0 },
  evening:   { hour: 17, minute: 0 },
}

// Detect if running inside a Capacitor native shell
function isNative() {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()
}

function getLocalNotifications() {
  return window.Capacitor?.Plugins?.LocalNotifications ?? null
}

export async function requestNotificationPermission() {
  if (isNative()) {
    const LN = getLocalNotifications()
    if (!LN) return 'unsupported'
    const result = await LN.requestPermissions()
    return result.display === 'granted' ? 'granted' : result.display === 'denied' ? 'denied' : 'default'
  }
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  return result
}

export async function getNotificationPermission() {
  if (isNative()) {
    const LN = getLocalNotifications()
    if (!LN) return 'unsupported'
    try {
      const result = await LN.checkPermissions()
      return result.display === 'granted' ? 'granted' : result.display === 'denied' ? 'denied' : 'default'
    } catch { return 'unsupported' }
  }
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

export async function updateAppBadge(tasks) {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const count = tasks.filter(t =>
    t.scheduled_date && String(t.scheduled_date).slice(0, 10) === todayStr && t.status !== 'done'
  ).length

  // Native Capacitor badge via bridge (same pattern as LocalNotifications)
  const Badge = window.Capacitor?.Plugins?.Badge
  if (Badge && window.Capacitor?.isNativePlatform?.()) {
    try {
      await Badge.requestPermissions()
      await Badge.set({ count })
    } catch {}
    return
  }

  // Web API fallback (PWA on supported browsers)
  // iOS requires notification permission for setAppBadge to work
  if ('setAppBadge' in navigator) {
    if ('Notification' in window && Notification.permission === 'default') {
      // Permission not yet asked — request it so badge can work
      Notification.requestPermission().catch(() => {})
    }
    if (count > 0) {
      navigator.setAppBadge(count).catch(async () => {
        // Retry once after requesting permission (handles the case where
        // permission was just granted by the requestPermission call above)
        if ('Notification' in window && Notification.permission === 'granted') {
          navigator.setAppBadge(count).catch(() => {})
        }
      })
    } else {
      navigator.clearAppBadge().catch(() => {})
    }
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
  const todayTasks = tasks.filter(t =>
    t.scheduled_date && String(t.scheduled_date).slice(0, 10) === today && t.status !== 'done'
  )

  function notifBucket(task) {
    if (task.start_time) {
      const [h] = task.start_time.split(':').map(Number)
      if (h >= 17) return 'evening'
      if (h >= 12) return 'afternoon'
      return 'morning'
    }
    if (task.bucket === 'afternoon') return 'evening'
    if (task.bucket === 'midday') return 'afternoon'
    return 'morning'
  }

  const byBucket = { morning: [], afternoon: [], evening: [] }
  for (const t of todayTasks) byBucket[notifBucket(t)].push(t.title)

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
let _reminderHandles = []

// Schedule a 15-min-before reminder for each timed task today
export async function scheduleUpcomingReminders(tasks) {
  for (const h of _reminderHandles) clearTimeout(h)
  _reminderHandles = []

  const perm = await getNotificationPermission()
  if (perm !== 'granted') return

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const now = Date.now()
  const sw = await getSwRegistration()

  for (const t of tasks) {
    if (!t.scheduled_date || String(t.scheduled_date).slice(0, 10) !== todayStr || !t.start_time || t.status === 'done') continue
    const [h, m] = t.start_time.split(':').map(Number)
    const taskTime = new Date()
    taskTime.setHours(h, m, 0, 0)
    const fireAt = taskTime.getTime() - 15 * 60 * 1000
    const delay = fireAt - now
    if (delay <= 0) continue

    const notification = {
      title: `Starting in 15 min`,
      body: t.title,
      tag: `schedulent-reminder-${t.id}`,
      fireAt,
    }

    if (sw?.active) {
      sw.active.postMessage({ type: 'SCHEDULE_NOTIFICATIONS', notifications: [notification] })
    } else {
      const handle = setTimeout(() => {
        new Notification(notification.title, { body: notification.body, icon: '/icon-192.png', tag: notification.tag })
      }, delay)
      _reminderHandles.push(handle)
    }
  }
}

// Schedule notifications via SW (works while app is open/backgrounded on mobile)
export async function scheduleDailyNotifications(tasks) {
  const perm = await getNotificationPermission()
  if (perm !== 'granted') return

  // Native Capacitor path
  if (isNative()) {
    const LN = getLocalNotifications()
    if (!LN) return
    const notifications = buildTodayNotifications(tasks)
    if (notifications.length === 0) return
    await LN.cancel({ notifications: notifications.map((_, i) => ({ id: 1000 + i })) }).catch(() => {})
    await LN.schedule({
      notifications: notifications.map((n, i) => ({
        id: 1000 + i,
        title: n.title,
        body: n.body,
        schedule: { at: new Date(n.fireAt) },
        sound: 'default',
        attachments: null,
        actionTypeId: '',
        extra: null,
      })),
    })
    return
  }

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
