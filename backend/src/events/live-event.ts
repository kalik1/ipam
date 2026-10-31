export interface ScanReportSubnet {
  subnetId: number | null;
  deviceIds: number[];
}

export interface LiveEventData {
  'scan.report': {
    agent: string;
    source: 'report' | 'connector';
    receivedAt: string;
    reportId?: number;
    subnets: ScanReportSubnet[];
  };
  'device.created': { deviceId: number; ip: string; subnetId: number | null };
  'device.offline': { deviceIds: number[] };
  'agent.connected': { agent: string; platform: string };
  'agent.disconnected': { agent: string };
  'agent.heartbeat': { agent: string; at: string };
  'command.sent': { commandId: string; agent: string; connector: string };
  'command.result': {
    commandId: string;
    agent: string;
    ok: boolean;
    error?: string;
  };
}

export type LiveEventType = keyof LiveEventData;

export type LiveEvent = {
  [K in LiveEventType]: { type: K; data: LiveEventData[K] };
}[LiveEventType];
