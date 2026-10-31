import { useEffect, useState } from 'react'
import api from '@/lib/api'
import type { NavCountKey } from '@/lib/nav'
import type { Agent, ApiKey, Connector, Subnet, Summary, Vlan } from '@/types'

export interface ShellData {
  counts: Partial<Record<NavCountKey, number>>
  vlans: Vlan[]
  subnets: Subnet[]
  agents: Agent[]
  agentsLoaded: boolean
}

const EMPTY: ShellData = { counts: {}, vlans: [], subnets: [], agents: [], agentsLoaded: false }

function value<T>(result: PromiseSettledResult<{ data: T }>): T | undefined {
  return result.status === 'fulfilled' ? result.value.data : undefined
}

export function useShellData(pathname: string): ShellData {
  const [data, setData] = useState<ShellData>(EMPTY)

  useEffect(() => {
    let active = true
    Promise.allSettled([
      api.get<Summary>('/summary'),
      api.get<Vlan[]>('/vlans'),
      api.get<Subnet[]>('/subnets'),
      api.get<Agent[]>('/agents'),
      api.get<Connector[]>('/connectors'),
      api.get<ApiKey[]>('/api-keys'),
    ]).then(([summary, vlans, subnets, agents, connectors, apiKeys]) => {
      if (!active) return
      setData((previous) => {
        const next = {
          vlans: value(vlans) ?? previous.vlans,
          subnets: value(subnets) ?? previous.subnets,
          agents: value(agents) ?? previous.agents,
        }
        return {
          ...next,
          agentsLoaded: previous.agentsLoaded || agents.status === 'fulfilled',
          counts: {
            ...previous.counts,
            ...(vlans.status === 'fulfilled' && { vlans: next.vlans.length }),
            ...(subnets.status === 'fulfilled' && { subnets: next.subnets.length }),
            ...(agents.status === 'fulfilled' && { agents: next.agents.length }),
            ...(summary.status === 'fulfilled' && { devices: summary.value.data.devices }),
            ...(connectors.status === 'fulfilled' && { connectors: connectors.value.data.length }),
            ...(apiKeys.status === 'fulfilled' && { apiKeys: apiKeys.value.data.length }),
          },
        }
      })
    })
    return () => {
      active = false
    }
  }, [pathname])

  return data
}
