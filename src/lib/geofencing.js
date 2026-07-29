// Capacitor plugins are only available inside the native app shell.
// Dynamic imports let the web build succeed while still loading them at runtime.
const GEOFENCE_RADIUS_METERS = 500
const NOTIF_COOLDOWN_MS = 30 * 60 * 1000

let _bgRegistered = false
let _pollInterval = null
let _tasks = []
const _notifiedAt = {}

function metersApart(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getLocalNotifications() {
  return window.Capacitor?.Plugins?.LocalNotifications ?? null
}
function getGeolocation() {
  return window.Capacitor?.Plugins?.Geolocation ?? null
}
function getBackgroundGeolocation() {
  return null // requires UIBackgroundModes:location entitlement — disabled until configured
}

async function checkProximity(lat, lng) {
  const now = Date.now()
  const today = new Date().toISOString().slice(0, 10)
  const LocalNotifications = getLocalNotifications()
  if (!LocalNotifications) return

  for (const task of _tasks) {
    if (
      task.status === 'done' ||
      !task.location_lat ||
      !task.location_lng ||
      String(task.scheduled_date || '').slice(0, 10) !== today
    ) continue

    const dist = metersApart(lat, lng, task.location_lat, task.location_lng)
    if (dist > GEOFENCE_RADIUS_METERS) continue

    const lastNotif = _notifiedAt[task.id] || 0
    if (now - lastNotif < NOTIF_COOLDOWN_MS) continue

    _notifiedAt[task.id] = now
    await LocalNotifications.schedule({
      notifications: [{
        id: Math.abs(task.id.split('').reduce((a, c) => (a << 5) - a + c.charCodeAt(0), 0)) % 2147483647,
        title: `📍 Near ${task.location}`,
        body: task.title,
        schedule: { at: new Date(Date.now() + 1000) },
        sound: null,
        attachments: null,
        actionTypeId: '',
        extra: null,
      }],
    })
  }
}

export async function requestLocationPermission() {
  const Geolocation = getGeolocation()
  if (!Geolocation) return 'denied'
  try {
    const status = await Geolocation.requestPermissions()
    return status.location
  } catch { return 'denied' }
}

export async function getLocationPermission() {
  const Geolocation = getGeolocation()
  if (!Geolocation) return 'denied'
  try {
    const status = await Geolocation.checkPermissions()
    return status.location
  } catch { return 'denied' }
}

// Geocode a plain-text address to lat/lng using OpenStreetMap Nominatim (free, no key)
export async function geocodeAddress(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    const data = await res.json()
    if (data.length === 0) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name }
  } catch { return null }
}

export async function startGeofencing(tasks) {
  try {
    _tasks = tasks
    const perm = await getLocationPermission()
    if (perm !== 'granted') return false

    const LocalNotifications = getLocalNotifications()
    if (LocalNotifications) {
      try { await LocalNotifications.requestPermissions() } catch {}
    }

    if (!_bgRegistered) {
      const BackgroundGeolocation = getBackgroundGeolocation()
      if (BackgroundGeolocation) {
        _bgRegistered = true
        try {
          await BackgroundGeolocation.addWatcher(
            {
              backgroundMessage: 'Schedulent is checking for nearby tasks.',
              backgroundTitle: 'Location active',
              requestPermissions: false,
              stale: false,
              distanceFilter: 50,
            },
            (location, error) => {
              if (error || !location) return
              checkProximity(location.latitude, location.longitude)
            }
          )
        } catch { _bgRegistered = false }
      }

      // Fallback: poll every 30s while app is open (foreground only)
      if (!_bgRegistered && !_pollInterval) {
        const Geolocation = getGeolocation()
        if (Geolocation) {
          _pollInterval = setInterval(async () => {
            try {
              const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 })
              checkProximity(pos.coords.latitude, pos.coords.longitude)
            } catch {}
          }, 30000)
          // Run once immediately
          try {
            const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 })
            checkProximity(pos.coords.latitude, pos.coords.longitude)
          } catch {}
        }
      }
    }

    return true
  } catch {
    return false
  }
}

export function updateGeofencingTasks(tasks) {
  _tasks = tasks
}
