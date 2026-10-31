export interface ConnectorField {
  key: string
  label: string
  type: 'string' | 'number' | 'password'
  default?: string
}

export const CONNECTOR_TYPES = ['mikrotik', 'demo']

export const CONNECTOR_FIELDS: Record<string, ConnectorField[]> = {
  mikrotik: [
    { key: 'host', label: 'Host', type: 'string' },
    { key: 'port', label: 'Port', type: 'number', default: '8728' },
    { key: 'username', label: 'Username', type: 'string' },
    { key: 'password', label: 'Password', type: 'password' },
  ],
  demo: [],
}

export function configFromFields(name: string, fields: Record<string, string>): Record<string, unknown> | null {
  const defs = CONNECTOR_FIELDS[name]
  if (!defs) return null
  const config: Record<string, unknown> = {}
  for (const field of defs) {
    const value = (fields[field.key] ?? '').trim()
    if (!value) continue
    config[field.key] = field.type === 'number' ? Number(value) : value
  }
  return config
}

export function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  return parsed as Record<string, unknown>
}

export function summarizeConfig(name: string, config: Record<string, unknown>): string {
  if (name === 'mikrotik') {
    const host = typeof config.host === 'string' ? config.host : ''
    const port = config.port == null ? '' : String(config.port)
    const username = typeof config.username === 'string' ? config.username : ''
    const parts = [host && port ? `${host}:${port}` : host, username].filter(Boolean)
    if (parts.length > 0) return parts.join(' ')
  }
  if (Object.keys(config).length === 0) return 'No settings'
  const json = JSON.stringify(config)
  return json.length > 60 ? `${json.slice(0, 60)}...` : json
}
