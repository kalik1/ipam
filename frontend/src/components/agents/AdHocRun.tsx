import { useEffect, useState, type FormEvent } from 'react'
import api from '@/lib/api'
import type { AgentRow } from '@/lib/agentRows'
import { CONNECTOR_FIELDS, configFromFields, parseJsonObject } from '@/lib/connectors'
import { useCommandRun } from '@/lib/useCommandRun'
import { Button } from '@/components/Button'
import { FormField, inputClass } from '@/components/FormField'
import { RunFeedback } from './CommandResultView'

function defaultFields(connector: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const field of CONNECTOR_FIELDS[connector] ?? []) fields[field.key] = field.default ?? ''
  return fields
}

export function AdHocRun({ agent }: { agent: AgentRow }) {
  const [selected, setSelected] = useState(agent.connectors[0] ?? '')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [rawParams, setRawParams] = useState('')
  const [formError, setFormError] = useState('')
  const { run, start, reset } = useCommandRun(agent.name)

  const active = agent.connectors.includes(selected) ? selected : (agent.connectors[0] ?? '')
  const fieldDefs = CONNECTOR_FIELDS[active]

  useEffect(() => {
    setFields(defaultFields(active))
    setRawParams('')
  }, [active])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!active) {
      setFormError('Select a connector')
      return
    }
    const params = configFromFields(active, fields) ?? parseJsonObject(rawParams)
    if (!params) {
      setFormError('Params must be a JSON object')
      return
    }
    setFormError('')
    void start(async () => {
      const { data } = await api.post<{ id: string }>(`/agents/${agent.name}/commands`, {
        action: 'run_connector',
        connector: active,
        params,
      })
      return data.id
    }, 'Failed to send command')
  }

  return (
    <section className="disc-section" aria-label={`Ad hoc run on ${agent.name}`}>
      <div className="disc-section-head">
        <h3 className="section-title">Ad hoc run</h3>
        <span className="list-count">Send one connector command to this agent now</span>
      </div>
      {!agent.connected ? (
        <p className="disc-note">The agent is disconnected: commands need a connected agent.</p>
      ) : agent.connectors.length === 0 ? (
        <p className="disc-note">This agent exposes no connectors.</p>
      ) : (
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="cols-3">
            <FormField label="Connector">
              <select className={inputClass} value={active} onChange={(e) => setSelected(e.target.value)}>
                {agent.connectors.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </FormField>
            {fieldDefs?.map((field) => (
              <FormField key={field.key} label={field.label}>
                <input
                  type={field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'}
                  className={field.type === 'number' ? `${inputClass} mono` : inputClass}
                  value={fields[field.key] ?? ''}
                  onChange={(e) => setFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              </FormField>
            ))}
          </div>
          {!fieldDefs && (
            <FormField label="Params (JSON)" hint="JSON object passed to the connector">
              <textarea
                className={`${inputClass} mono`}
                value={rawParams}
                onChange={(e) => setRawParams(e.target.value)}
                placeholder='{"host": "192.168.1.1"}'
              />
            </FormField>
          )}
          {formError && (
            <p className="alert" role="alert">
              {formError}
            </p>
          )}
          <div>
            <Button type="submit" variant="primary" disabled={run.status === 'sending'} aria-busy={run.status === 'sending'}>
              {run.status === 'sending' ? 'Sending...' : 'Run connector'}
            </Button>
          </div>
          <RunFeedback run={run} onDismiss={reset} />
        </form>
      )}
    </section>
  )
}
