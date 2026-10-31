import { useEffect, useState } from 'react'
import api from '@/lib/api'
import type { NavCountKey } from '@/lib/nav'
import { devicesBySubnet } from '@/lib/occupancy'
import type { ApiKey, Connector, Subnet, Summary, Topology, TopologyDevice, Vlan } from '@/types'

export interface ShellData {
  counts: Partial<Record<NavCountKey, number>>
  vlans: Vlan[]
  subnets: Subnet[]
  devices: ReadonlyMap<number, TopologyDevice[]>
}

const EMPTY: ShellData = { counts: {}, vlans: [], subnets: [], devices: new Map() }

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
      api.get<Connector[]>('/connectors'),
      api.get<ApiKey[]>('/api-keys'),
      api.get<Topology>('/topology'),
    ]).then(([summary, vlans, subnets, connectors, apiKeys, topology]) => {
      if (!active) return
      setData((previous) => {
        const loadedTopology = value(topology)
        const next = {
          vlans: value(vlans) ?? previous.vlans,
          subnets: value(subnets) ?? previous.subnets,
          devices: loadedTopology ? devicesBySubnet(loadedTopology) : previous.devices,
        }
        return {
          ...next,
          counts: {
            ...previous.counts,
            ...(vlans.status === 'fulfilled' && { vlans: next.vlans.length }),
            ...(subnets.status === 'fulfilled' && { subnets: next.subnets.length }),
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
