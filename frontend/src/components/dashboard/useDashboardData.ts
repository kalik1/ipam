import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api, { getAgentAssignments, getErrorMessage } from '@/lib/api'
import { agentRows, withHeartbeat, type AgentRow } from '@/lib/agentRows'
import type { CommandOutcome } from '@/lib/discovery'
import { useLive, useLiveEvent } from '@/lib/live'
import type { LiveEvent } from '@/lib/liveEvents'
import { buildTopologyTree, type TopologyBranch } from '@/lib/topology'
import type { Agent, AgentAssignment, Device, ScanReport, Subnet, Topology } from '@/types'

const LIVE_REFRESH_DELAY_MS = 150
const OUTCOMES_LIMIT = 50

export type Loadable<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string }

export interface NetworkData {
  branches: TopologyBranch[]
  offline: Device[]
}

function useLiveRefetch(matches: (event: LiveEvent) => boolean, refetch: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLiveEvent((event) => {
    if (timer.current || !matches(event)) return
    timer.current = setTimeout(() => {
      timer.current = null
      refetch()
    }, LIVE_REFRESH_DELAY_MS)
  })

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
}

function useLoadable<T>(fetcher: () => Promise<T>, failure: string) {
  const [state, setState] = useState<Loadable<T>>({ status: 'loading' })

  const refetch = useCallback(() => {
    fetcher()
      .then((data) => setState({ status: 'ready', data }))
      .catch((error: unknown) => setState((current) => (current.status === 'ready' ? current : { status: 'error', message: getErrorMessage(error, failure) })))
  }, [fetcher, failure])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { state, refetch }
}

async function fetchNetwork(): Promise<NetworkData> {
  const [topology, subnets, offline] = await Promise.all([
    api.get<Topology>('/topology'),
    api.get<Subnet[]>('/subnets'),
    api.get<Device[]>('/devices', { params: { status: 'offline' } }),
  ])
  return { branches: buildTopologyTree(topology.data, subnets.data), offline: offline.data }
}

function changesNetwork(event: LiveEvent): boolean {
  return event.type === 'scan.report' || event.type === 'device.created' || event.type === 'device.offline'
}

export function useNetwork(): Loadable<NetworkData> {
  const { state, refetch } = useLoadable(fetchNetwork, 'Failed to load the network')
  useLiveRefetch(changesNetwork, refetch)
  return state
}

function storesReport(event: LiveEvent): boolean {
  return event.type === 'scan.report' && event.data.source === 'report'
}

export function useScanReports(limit: number): Loadable<ScanReport[]> {
  const fetchReports = useCallback(async () => (await api.get<ScanReport[]>('/scan/reports', { params: { limit } })).data, [limit])
  const { state, refetch } = useLoadable(fetchReports, 'Failed to load scan reports')
  useLiveRefetch(storesReport, refetch)
  return state
}

export interface DiscoveryData {
  loaded: boolean
  error: string
  agents: AgentRow[]
  assignments: ReadonlyMap<string, AgentAssignment[]>
  outcomes: ReadonlyMap<string, CommandOutcome>
}

function changesAssignments(event: LiveEvent): boolean {
  return event.type === 'command.sent' || event.type === 'command.result'
}

async function fetchAssignments(names: string[]): Promise<Map<string, AgentAssignment[]>> {
  const lists = await Promise.allSettled(names.map((name) => getAgentAssignments(name)))
  return new Map(lists.flatMap((list, index) => (list.status === 'fulfilled' ? [[names[index], list.value.data] as const] : [])))
}

export function useDiscovery(): DiscoveryData {
  const live = useLive()
  const [baselines] = useState(() => new Map(live.agents.map((agent) => [agent.name, agent.heartbeats])))
  const [agents, setAgents] = useState<Agent[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [assignments, setAssignments] = useState<ReadonlyMap<string, AgentAssignment[]>>(new Map())
  const [revision, setRevision] = useState(0)
  const [outcomes, setOutcomes] = useState<ReadonlyMap<string, CommandOutcome>>(new Map())

  const loadAgents = useCallback(() => {
    api
      .get<Agent[]>('/agents')
      .then(({ data }) => {
        setAgents(data)
        setError('')
      })
      .catch((e: unknown) => setError(getErrorMessage(e, 'Failed to load agents')))
      .finally(() => {
        setLoaded(true)
        setRevision((value) => value + 1)
      })
  }, [])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  const rows = useMemo(() => (loaded ? agentRows(agents, live.agents, baselines) : []), [loaded, agents, live.agents, baselines])
  const namesKey = rows.map((row) => row.name).join('\n')

  useEffect(() => {
    if (!namesKey) return
    let active = true
    void fetchAssignments(namesKey.split('\n')).then((lists) => {
      if (active) setAssignments(lists)
    })
    return () => {
      active = false
    }
  }, [namesKey, revision])

  useLiveRefetch(changesAssignments, () => setRevision((value) => value + 1))

  useLiveEvent((event) => {
    if (event.type === 'agent.heartbeat') setAgents((list) => withHeartbeat(list, event.data.agent, event.data.at))
    if (event.type === 'agent.connected') loadAgents()
    if (event.type === 'command.result') {
      const { commandId, ok } = event.data
      setOutcomes((current) => new Map([...current, [commandId, { ok, at: new Date().toISOString() }] as const].slice(-OUTCOMES_LIMIT)))
    }
  })

  return { loaded, error, agents: rows, assignments, outcomes }
}
