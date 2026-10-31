import { createSseParser, type SseFrame } from './sse'

export interface ScanReportSubnet {
  subnetId: number | null
  deviceIds: number[]
}

export interface LiveEventData {
  'scan.report': {
    agent: string
    source: 'report' | 'connector'
    receivedAt: string
    reportId?: number
    subnets: ScanReportSubnet[]
  }
  'device.created': { deviceId: number; ip: string; subnetId: number | null }
  'device.offline': { deviceIds: number[] }
  'agent.connected': { agent: string; platform: string }
  'agent.disconnected': { agent: string }
  'agent.heartbeat': { agent: string; at: string }
  'command.sent': { commandId: string; agent: string; connector: string }
  'command.result': { commandId: string; agent: string; ok: boolean; error?: string }
}

export type LiveEventType = keyof LiveEventData

export type LiveEvent = { [K in LiveEventType]: { type: K; data: LiveEventData[K] } }[LiveEventType]

type Fields = Record<string, unknown>

const isRecord = (value: unknown): value is Fields => typeof value === 'object' && value !== null && !Array.isArray(value)
const isString = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number => typeof value === 'number'
const isNullableNumber = (value: unknown) => value === null || isNumber(value)
const isNumberArray = (value: unknown) => Array.isArray(value) && value.every(isNumber)
const isOptional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value)
const isScanReportSubnet = (value: unknown) =>
  isRecord(value) && isNullableNumber(value.subnetId) && isNumberArray(value.deviceIds)

const DATA_CHECKS: { [K in LiveEventType]: (data: Fields) => boolean } = {
  'scan.report': (data) =>
    isString(data.agent) &&
    (data.source === 'report' || data.source === 'connector') &&
    isString(data.receivedAt) &&
    isOptional(data.reportId, isNumber) &&
    Array.isArray(data.subnets) &&
    data.subnets.every(isScanReportSubnet),
  'device.created': (data) => isNumber(data.deviceId) && isString(data.ip) && isNullableNumber(data.subnetId),
  'device.offline': (data) => isNumberArray(data.deviceIds),
  'agent.connected': (data) => isString(data.agent) && isString(data.platform),
  'agent.disconnected': (data) => isString(data.agent),
  'agent.heartbeat': (data) => isString(data.agent) && isString(data.at),
  'command.sent': (data) => isString(data.commandId) && isString(data.agent) && isString(data.connector),
  'command.result': (data) =>
    isString(data.commandId) && isString(data.agent) && typeof data.ok === 'boolean' && isOptional(data.error, isString),
}

function isLiveEventType(value: string): value is LiveEventType {
  return Object.prototype.hasOwnProperty.call(DATA_CHECKS, value)
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function decodeLiveEvent(frame: SseFrame): LiveEvent | null {
  if (!isLiveEventType(frame.event)) return null
  const data = parseJson(frame.data)
  if (!isRecord(data) || !DATA_CHECKS[frame.event](data)) return null
  return { type: frame.event, data } as LiveEvent
}

export function createLiveEventParser(): (chunk: string) => LiveEvent[] {
  const parseFrames = createSseParser()
  return (chunk) => parseFrames(chunk).flatMap((frame) => decodeLiveEvent(frame) ?? [])
}
