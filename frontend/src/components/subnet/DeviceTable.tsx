import { useMemo } from 'react'
import type { AddressMap } from '@/lib/addressMap'
import { splitIp, splitMac } from '@/lib/addressMath'
import { cx } from '@/lib/cx'
import { formatDay, timeAgo } from '@/lib/format'
import { deviceFilterCounts, filterDevices, type DeviceFilter } from '@/lib/subnetDevices'
import type { Device } from '@/types'
import { Badge } from '@/components/Badge'
import { Panel } from '@/components/Panel'
import { Selector } from '@/components/Selector'
import { Table, TableMessage } from '@/components/Table'

const FILTER_LABELS: Record<DeviceFilter, string> = {
  all: 'All',
  online: 'Online',
  offline: 'Offline',
  pool: 'In DHCP pool',
}

interface DeviceTableProps {
  devices: Device[]
  map: AddressMap<Device>
  prefix: number
  filter: DeviceFilter
  selectedIp: string | null
  onFilter: (filter: DeviceFilter) => void
  onSelect: (ip: string) => void
}

export function DeviceTable({ devices, map, prefix, filter, selectedIp, onFilter, onSelect }: DeviceTableProps) {
  const counts = useMemo(() => deviceFilterCounts(devices, map), [devices, map])
  const rows = useMemo(() => filterDevices(devices, filter, map), [devices, filter, map])
  const options = (Object.keys(FILTER_LABELS) as DeviceFilter[]).map((value) => ({ value, label: FILTER_LABELS[value], count: counts[value] }))

  return (
    <Panel className="tablepanel" aria-label="Devices in this subnet">
      <div className="panel-head">
        <h2 className="panel-title mr-2">Devices in this subnet</h2>
        <Selector label="Filter devices" options={options} value={filter} onChange={onFilter} />
        <span className="r">Sorted by IP address</span>
      </div>
      <Table maxHeight={540}>
        <thead>
          <tr>
            <th>Status</th>
            <th>IP address</th>
            <th>Hostname</th>
            <th>MAC address</th>
            <th>Vendor</th>
            <th>Last seen</th>
            <th>First seen</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <TableMessage colSpan={8}>{devices.length === 0 ? 'No devices in this subnet yet.' : 'No devices match this filter.'}</TableMessage>
          )}
          {rows.map((device) => {
            const ip = splitIp(device.ip, prefix)
            const mac = splitMac(device.mac)
            return (
              <tr key={device.id} className={cx(device.ip === selectedIp && 'sel')} onClick={() => onSelect(device.ip)}>
                <td>
                  <Badge status={device.status} />
                </td>
                <td className="mono">
                  <span className="ipnet">{ip.network}</span>
                  {ip.host}
                </td>
                <td>
                  <button type="button" className="linkbtn" aria-pressed={device.ip === selectedIp} onClick={() => onSelect(device.ip)}>
                    {device.hostname.trim() || 'Unnamed device'}
                  </button>
                </td>
                <td className="mono">
                  {device.mac ? (
                    <>
                      <span className="oui">{mac.oui}</span>
                      {mac.nic}
                    </>
                  ) : (
                    <span className="text-fg-3">Unknown</span>
                  )}
                </td>
                <td>{device.vendor || <span className="text-fg-3">Unknown</span>}</td>
                <td className="text-fg-2">{timeAgo(device.lastSeen)}</td>
                <td className="text-fg-2">{formatDay(device.createdAt)}</td>
                <td className="notes" title={device.notes}>
                  {device.notes}
                </td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </Panel>
  )
}
