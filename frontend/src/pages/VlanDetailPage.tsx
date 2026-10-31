import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import api, { getErrorMessage } from '@/lib/api'
import { devicesBySubnet, subnetOccupancy, sumOccupancy } from '@/lib/occupancy'
import { vlanColor } from '@/lib/vlan'
import type { Topology, TopologyDevice, VlanDetail } from '@/types'
import { EmptyState } from '@/components/EmptyState'
import { OCCUPANCY_COLUMNS, OccupancyCells, OccupancyHeads } from '@/components/OccupancyMeter'
import { Panel, PanelHeader } from '@/components/Panel'
import { Table, TableMessage } from '@/components/Table'
import { VlanChip } from '@/components/VlanChip'

const COLUMNS = 5 + OCCUPANCY_COLUMNS

interface LoadedVlan {
  vlan: VlanDetail
  devices: ReadonlyMap<number, TopologyDevice[]>
}

export default function VlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [loaded, setLoaded] = useState<LoadedVlan | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [vlanRes, topologyRes] = await Promise.all([api.get<VlanDetail>(`/vlans/${id}`), api.get<Topology>('/topology')])
      setLoaded({ vlan: vlanRes.data, devices: devicesBySubnet(topologyRes.data) })
      setNotFound(false)
      setError('')
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 404) {
        setNotFound(true)
      } else {
        setError(getErrorMessage(e, 'Failed to load VLAN'))
      }
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <p className="alert" role="alert">
        {error}
      </p>
    )
  }
  if (notFound) {
    return (
      <Panel>
        <EmptyState title="VLAN not found" message="It may have been deleted" />
      </Panel>
    )
  }
  if (!loaded) {
    return <p className="text-fg-3">Loading VLAN...</p>
  }

  const { vlan, devices } = loaded
  const color = vlanColor(vlan.vlanId)
  const occupancies = new Map(vlan.subnets.map((subnet) => [subnet.id, subnetOccupancy(subnet, devices.get(subnet.id) ?? [])]))
  const total = sumOccupancy([...occupancies.values()])
  const facts = [
    { label: 'VLAN ID', value: String(vlan.vlanId) },
    { label: 'Subnets', value: String(vlan.subnets.length) },
    { label: 'Occupied', value: String(total.occupied) },
    { label: 'Reserved', value: String(total.reserved) },
    { label: 'Free', value: total.usable > 0 ? `${total.free} (${total.freePercent}%)` : String(total.free) },
    { label: 'Usable addresses', value: String(total.usable) },
    { label: 'Created', value: new Date(vlan.createdAt).toLocaleDateString() },
  ]

  return (
    <>
      <Panel hud className="vlanhead brushed" aria-label="VLAN">
        <span className="vlanghost" aria-hidden="true">
          {vlan.vlanId}
        </span>
        <span className="cscrew tl" aria-hidden="true" />
        <span className="cscrew tr" aria-hidden="true" />
        <span className="cscrew bl" aria-hidden="true" />
        <span className="cscrew br" aria-hidden="true" />
        <div className="idblock">
          <h1 className="heading">{vlan.name}</h1>
          <VlanChip vlan={vlan} />
          {vlan.description && <p className="desc">{vlan.description}</p>}
        </div>
        <dl className="vlanfacts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd className="mono">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel aria-label="Subnets in this VLAN">
        <PanelHeader title="Subnets in this VLAN">
          <span className="list-count">
            {vlan.subnets.length} {vlan.subnets.length === 1 ? 'subnet' : 'subnets'}
          </span>
        </PanelHeader>
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>CIDR</th>
              <th>Gateways</th>
              <th className="num">DHCP pools</th>
              <OccupancyHeads />
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {vlan.subnets.length === 0 ? (
              <TableMessage colSpan={COLUMNS}>
                <EmptyState title="No subnets" message="Assign a subnet to this VLAN from the subnets page" />
              </TableMessage>
            ) : (
              vlan.subnets.map((subnet) => {
                const occupancy = occupancies.get(subnet.id) ?? subnetOccupancy(subnet, [])
                return (
                  <tr key={subnet.id}>
                    <td>
                      <Link to={`/subnets/${subnet.id}`} className="cell-link">
                        {subnet.name}
                      </Link>
                    </td>
                    <td className="mono">{subnet.cidr}</td>
                    <td className="mono text-fg-2">
                      {subnet.gateways.length > 0 ? subnet.gateways.join(', ') : <span className="cell-muted">None</span>}
                    </td>
                    <td className="num mono">{subnet.dhcpPools.length}</td>
                    <OccupancyCells occupancy={occupancy} color={color} />
                    <td className="mono text-fg-2">{new Date(subnet.createdAt).toLocaleDateString()}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </Table>
      </Panel>
    </>
  )
}
