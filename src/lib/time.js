// Helpers for working in Indian Standard Time (IST, UTC+05:30).

const IST_OFFSET = '+05:30'
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

// <input type="datetime-local"> gives "2026-10-13T09:00" with no timezone.
// We treat it as IST and return a proper ISO string (UTC) for the database.
export function istInputToISO(value) {
  if (!value) return null
  const withSeconds = value.length === 16 ? `${value}:00` : value
  const d = new Date(`${withSeconds}${IST_OFFSET}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// Same thing, but returns milliseconds (handy for comparing two inputs).
export function istInputToMs(value) {
  const iso = istInputToISO(value)
  return iso ? new Date(iso).getTime() : NaN
}

// The reverse of istInputToISO: turns an ISO string into the "YYYY-MM-DDTHH:mm"
// text a datetime-local input needs, showing IST wall-clock time.
// addMinutes lets you pre-fill "scheduled time + 2 hours", for example.
export function isoToISTInput(value, addMinutes = 0) {
  if (!value) return ''
  const ms = new Date(value).getTime() + addMinutes * 60 * 1000 + IST_OFFSET_MS
  return new Date(ms).toISOString().slice(0, 16)
}

// Today's date in IST as "YYYY-MM-DD".
export function todayIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

// "13 Oct, 09:00" (IST). Accepts an ISO string or a Date.
export function formatDateTimeIST(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// "09:00" (IST). Accepts an ISO string or a Date.
export function formatTimeIST(value) {
  if (!value) return '-'
  return new Date(value).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// 135 -> "2h 15m", 45 -> "45m"
export function formatDuration(totalMinutes) {
  if (totalMinutes === null || totalMinutes === undefined || Number.isNaN(totalMinutes)) return '-'
  const sign = totalMinutes < 0 ? '-' : ''
  const m = Math.abs(Math.round(totalMinutes))
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (h === 0) return `${sign}${rest}m`
  return `${sign}${h}h ${rest}m`
}