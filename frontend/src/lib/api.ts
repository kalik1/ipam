import axios from 'axios'
import type { AgentAssignment, ApiError, Connector, DhcpPool } from '../types'

export const TOKEN_KEY = 'ipam_token'

const api = axios.create({
  baseURL: '/api/v1',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string | undefined = error.config?.url
    if (error.response?.status === 401 && !url?.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY)
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined
    if (data && typeof data.message === 'string' && data.message) {
      return data.message
    }
  }
  return fallback
}

export interface DhcpPoolBody {
  name?: string
  startIp: string
  endIp: string
}

export function getDhcpPools(subnetId: number) {
  return api.get<DhcpPool[]>(`/subnets/${subnetId}/dhcp-pools`)
}

export function createDhcpPool(subnetId: number, body: DhcpPoolBody) {
  return api.post<DhcpPool>(`/subnets/${subnetId}/dhcp-pools`, body)
}

export function updateDhcpPool(poolId: number, body: Partial<DhcpPoolBody>) {
  return api.put<DhcpPool>(`/dhcp-pools/${poolId}`, body)
}

export function deleteDhcpPool(poolId: number) {
  return api.delete<void>(`/dhcp-pools/${poolId}`)
}

export interface ConnectorBody {
  name: string
  label?: string
  config: Record<string, unknown>
}

export interface AssignmentBody {
  connectorId: number
  schedule: string
  enabled?: boolean
}

export function getConnectors() {
  return api.get<Connector[]>('/connectors')
}

export function createConnector(body: ConnectorBody) {
  return api.post<Connector>('/connectors', body)
}

export function updateConnector(id: number, body: Partial<ConnectorBody>) {
  return api.put<Connector>(`/connectors/${id}`, body)
}

export function deleteConnector(id: number) {
  return api.delete<void>(`/connectors/${id}`)
}

export function getAgentAssignments(agentName: string) {
  return api.get<AgentAssignment[]>(`/agents/${agentName}/connectors`)
}

export function assignConnector(agentName: string, body: AssignmentBody) {
  return api.post<AgentAssignment>(`/agents/${agentName}/connectors`, body)
}

export function updateAgentAssignment(agentName: string, connectorId: number, body: Partial<Omit<AssignmentBody, 'connectorId'>>) {
  return api.put<AgentAssignment>(`/agents/${agentName}/connectors/${connectorId}`, body)
}

export function deleteAgentAssignment(agentName: string, connectorId: number) {
  return api.delete<void>(`/agents/${agentName}/connectors/${connectorId}`)
}

export function moveAgentAssignment(agentName: string, connectorId: number, toAgent: string) {
  return api.post<AgentAssignment>(`/agents/${agentName}/connectors/${connectorId}/move`, { toAgent })
}

export function runAgentAssignment(agentName: string, connectorId: number) {
  return api.post<{ id: string }>(`/agents/${agentName}/connectors/${connectorId}/run`)
}

export default api
