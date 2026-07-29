import { Geolocation } from '@capacitor/geolocation'
import { LocalNotifications } from '@capacitor/local-notifications'
import { BackgroundGeolocation } from '@capacitor-community/background-geolocation'

const GEOFENCE_RADIUS_METERS = 500
const CHECK_INTERVAL_MS = 60_000 // check every 60s while foreground
const NOTIF_COOLDOWN_MS = 30 * 60 * 1000 // don't re-notify same task within 30 min

let _watchId = null
let _bgRegistered = false
let _tasks = []
const _notifiedAt = {} // taskId → timestamp

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

async function checkProximity(lat, lng) {
  const now = Date.now()
  const today = new Date().toISOString().slice(0, 10)

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
  try {
    const status = await Geolocation.requestPermissions()
    return status.location
  } catch {
    return 'denied'
  }
}

export async function getLocationPermission() {
  try {
    const status = await Geolocation.checkPermissions()
    return status.location
  } catch {
    return 'denied'
  }
}

export async function requestNotificationPermission() {
  try {
    const result = await LocalNotifications.requestPermissions()
    return result.display
  } catch {
    return 'denied'
  }
}

// Geocode a plain-text address to lat/lng using OpenStreetMap Nominatim (free, no key)
export async function geocodeAddress(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    const data = await res.json()
    if (data.length === 0) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name }
  } catch {
    return null
  }
}

export async function startGeofencing(tasks) {
  _tasks = tasks

  const perm = await getLocationPermission()
  if (perm !== 'granted') return false

  await LocalNotifications.requestPermissions()

  // Background geolocation (works when app is in background/suspended)
  if (!_bgRegistered) {
    _bgRegistered = true
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
  }

  return true
}

export function updateGeofencingTasks(tasks) {
  _tasks = tasks
}

export async function stopGeofencing() {
  if (_watchId !== null) {
    await Geolocation.clearWatch({ id: _watchId })
    _watchId = null
  }
  // Background watcher persists intentionally until app is killed
}
