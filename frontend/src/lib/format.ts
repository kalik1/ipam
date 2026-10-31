export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'unknown'
  const seconds = Math.floor((Date.now() - then) / 1000)
  if (seconds < 45) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export function formatDay(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'unknown'
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export type UtilizationLevel = 'ok' | 'warn' | 'danger'

export function utilizationColor(percent: number): UtilizationLevel {
  if (percent > 90) return 'danger'
  if (percent > 75) return 'warn'
  return 'ok'
}
