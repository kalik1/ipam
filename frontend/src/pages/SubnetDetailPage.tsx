import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import api, { createDhcpPool, deleteDhcpPool, getErrorMessage, type DhcpPoolBody } from '@/lib/api'
import { buildAddressMap, type AddressSlot } from '@/lib/addressMap'
import { useLive } from '@/lib/live'
import { devicePulseClass, pulseClass, sweepClass } from '@/lib/liveState'
import type { Loadable } from '@/lib/loadable'
import { affectsSubnet, subnetActivity } from '@/lib/subnetLive'
import { selectedAddress, type DeviceFilter } from '@/lib/subnetDevices'
import { useLiveRefetch } from '@/lib/useLiveRefetch'
import { vlanColor } from '@/lib/vlan'
import type { Device, DhcpPool, SubnetDetail } from '@/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ActivityPanel } from '@/components/subnet/ActivityPanel'
import { EmptyState } from '@/components/EmptyState'
import { AddressMapPanel } from '@/components/subnet/AddressMapPanel'
import { DeviceEditModal, type DeviceEditBody } from '@/components/subnet/DeviceEditModal'
import { DeviceTable } from '@/components/subnet/DeviceTable'
import { Inspector, type AssignBody } from '@/components/subnet/Inspector'
import { DhcpPoolPanel, NextFreePanel } from '@/components/subnet/SidePanels'
import { SubnetHeader } from '@/components/subnet/SubnetHeader'

const NEXT_FREE_LIMIT = 12
const LED_BOOT_MS = 600 + 256 * 5 + 100

type SubnetState = Loadable<SubnetDetail> | { status: 'not-found' }

function useSubnet(id: string | undefined) {
  const [state, setState] = useState<SubnetState>({ status: 'loading' })
  const [booting, setBooting] = useState(false)

  const fetchSubnet = useCallback(async () => (await api.get<SubnetDetail>(`/subnets/${id}`)).data, [id])

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    fetchSubnet()
      .then((subnet) => {
        if (!active) return
        setState({ status: 'ready', data: subnet })
        setBooting(true)
      })
      .catch((error: unknown) => {
        if (!active) return
        if (axios.isAxiosError(error) && error.response?.status === 404) setState({ status: 'not-found' })
        else setState({ status: 'error', message: getErrorMessage(error, 'Failed to load the subnet') })
      })
    return () => {
      active = false
    }
  }, [fetchSubnet])

  useEffect(() => {
    if (!booting) return
    const timer = setTimeout(() => setBooting(false), LED_BOOT_MS)
    return () => clearTimeout(timer)
  }, [booting])

  const update = useCallback((change: (subnet: SubnetDetail) => SubnetDetail) => {
    setState((current) => (current.status === 'ready' ? { status: 'ready', data: change(current.data) } : current))
  }, [])

  const refresh = useCallback(async () => {
    const subnet = await fetchSubnet()
    update(() => subnet)
  }, [fetchSubnet, update])

  return { state, booting, update, refresh }
}

export default function SubnetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { state, booting, update, refresh } = useSubnet(id)

  if (state.status === 'loading') return <p className="text-fg-3">Loading subnet...</p>
  if (state.status === 'not-found') return <EmptyState title="Subnet not found" message="It may have been deleted." />
  if (state.status === 'error') return <p className="alert">{state.message}</p>
  return <SubnetView subnet={state.data} booting={booting} update={update} refresh={refresh} />
}

interface SubnetViewProps {
  subnet: SubnetDetail
  booting: boolean
  update: (change: (subnet: SubnetDetail) => SubnetDetail) => void
  refresh: () => Promise<void>
}

function SubnetView({ subnet, booting, update, refresh }: SubnetViewProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [hover, setHover] = useState<number | null>(null)
  const [blockChoice, setBlockChoice] = useState<{ ip: string; index: number } | null>(null)
  const [filter, setFilter] = useState<DeviceFilter>('all')
  const [editing, setEditing] = useState<Device | null>(null)
  const [toDelete, setToDelete] = useState<Device | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const live = useLive()
  useLiveRefetch(
    (event) => affectsSubnet(event, subnet.id, subnet.devices.map((candidate) => candidate.id)),
    () => void refresh().catch(() => undefined),
  )

  const map = useMemo(() => buildAddressMap(subnet, subnet.devices), [subnet])
  const cable = vlanColor(subnet.vlan?.vlanId)
  const ip = selectedAddress(searchParams.get('ip'), map, subnet.devices)
  const slot = map.slot(ip)
  const device = slot?.device ?? subnet.devices.find((candidate) => candidate.ip === ip) ?? null
  const blockIndex = blockChoice?.ip === ip ? blockChoice.index : (map.blockOf(ip)?.index ?? 0)
  const nextFree = useMemo(() => map.nextFree(NEXT_FREE_LIMIT), [map])
  const sweep = live.sweeps[subnet.id]
  const devicePulse = useCallback((deviceId: number) => devicePulseClass(live, deviceId), [live])
  const activity = useMemo(
    () => subnetActivity({ subnetId: subnet.id, prefix: map.prefix, devices: subnet.devices, scans: live.scans, now: new Date() }),
    [subnet, map.prefix, live.scans],
  )

  const select = useCallback(
    (address: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.set('ip', address)
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )
  const selectSlot = useCallback((target: AddressSlot<Device>) => select(target.ip), [select])
  const hoverSlot = useCallback((target: AddressSlot<Device> | null) => setHover(target ? target.value : null), [])

  async function assign(body: AssignBody) {
    const { data } = await api.post<Device>('/devices', {
      ip,
      hostname: body.hostname || undefined,
      mac: body.mac || undefined,
      subnetId: subnet.id,
    })
    update((current) => ({ ...current, devices: [...current.devices, data] }))
  }

  async function saveDevice(target: Device, body: DeviceEditBody) {
    const { data } = await api.put<Device>(`/devices/${target.id}`, body)
    update((current) => ({ ...current, devices: current.devices.map((candidate) => (candidate.id === data.id ? data : candidate)) }))
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    setError('')
    try {
      await api.delete(`/devices/${toDelete.id}`)
      update((current) => ({ ...current, devices: current.devices.filter((candidate) => candidate.id !== toDelete.id) }))
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete the device'))
    } finally {
      setDeleting(false)
      setToDelete(null)
    }
  }

  async function addPool(body: DhcpPoolBody) {
    await createDhcpPool(subnet.id, body)
    await refresh()
  }

  async function removePool(pool: DhcpPool) {
    await deleteDhcpPool(pool.id)
    await refresh()
  }

  return (
    <div className="subnet-page">
      {error && <p className="alert">{error}</p>}
      <SubnetHeader subnet={subnet} prefix={map.prefix} counters={map.counters} cable={cable} />
      <div className="workrow">
        <AddressMapPanel
          map={map}
          blockIndex={blockIndex}
          cable={cable}
          selectedIp={ip}
          hover={hover}
          booting={booting}
          passClass={sweepClass(live, subnet.id)}
          fiberClass={pulseClass(sweep, live.settled, 'rx')}
          devicePulse={devicePulse}
          onBlockChange={(index) => setBlockChoice({ ip, index })}
          onSelect={selectSlot}
          onHover={hoverSlot}
        />
        <div className="aside">
          <Inspector
            ip={ip}
            slot={slot}
            device={device}
            cidr={subnet.cidr}
            includeFirstLast={subnet.includeFirstLast}
            onAssign={assign}
            onEdit={setEditing}
            onDelete={setToDelete}
          />
          <NextFreePanel addresses={nextFree} free={map.counters.free} prefix={map.prefix} onPick={select} />
          <DhcpPoolPanel pools={map.pools} cable={cable} onAdd={addPool} onDelete={removePool} />
        </div>
      </div>
      <div className="bottomrow">
        <DeviceTable
          devices={subnet.devices}
          map={map}
          prefix={map.prefix}
          filter={filter}
          selectedIp={ip}
          onFilter={setFilter}
          onSelect={select}
        />
        <ActivityPanel entries={activity} onSelect={select} />
      </div>
      {editing && <DeviceEditModal device={editing} onSave={(body) => saveDevice(editing, body)} onClose={() => setEditing(null)} />}
      {toDelete && (
        <ConfirmDialog
          title="Delete device"
          message={`Delete ${toDelete.hostname.trim() || 'the device'} on ${toDelete.ip}? The address becomes free again unless it is reserved.`}
          confirmLabel="Delete device"
          loading={deleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  )
}
