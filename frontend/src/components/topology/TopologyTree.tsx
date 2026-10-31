import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { splitIp } from '@/lib/addressMath'
import type { StatusFilter } from '@/lib/deviceList'
import { timeAgo } from '@/lib/format'
import { portDescription } from '@/lib/portGlyph'
import type { TopologyBranch, TopologyPort, TopologySubnetNode } from '@/lib/topology'
import { AllocationSegments } from '@/components/addressMap/AllocationBar'
import { Port } from '@/components/addressMap/Port'

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function visiblePorts(ports: TopologyPort[], status: StatusFilter): TopologyPort[] {
  return status === 'all' ? ports : ports.filter((port) => port.device.status === status)
}

function DevicePort({ port, prefix, cable }: { port: TopologyPort; prefix: number; cable: string }) {
  const navigate = useNavigate()
  const ip = splitIp(port.device.ip, prefix)
  const hostname = port.device.hostname.trim()
  return (
    <li className="topo-dev" onClick={() => navigate(port.href)}>
      <Port slot={port.slot} cable={cable} label={portDescription(port.slot)} />
      <span className="ip mono" aria-hidden="true">
        <span className="ipnet">{ip.network}</span>
        {ip.host}
      </span>
      <span className="seen">{timeAgo(port.device.lastSeen)}</span>
      <span className="host" aria-hidden="true">
        {hostname || <span className="cell-muted">Unnamed device</span>}
      </span>
    </li>
  )
}

function SubnetNode({ subnet, cable, status }: { subnet: TopologySubnetNode; cable: string; status: StatusFilter }) {
  const ports = visiblePorts(subnet.ports, status)
  const { occupied, reserved, free, usable } = subnet.counters
  return (
    <li className="topo-subnet">
      <span className="topo-branch" aria-hidden="true" />
      <section className="panel topo-card" aria-label={`${subnet.name}, ${subnet.cidr}`}>
        <div className="topo-shead">
          <Link to={subnet.href} className="topo-sid">
            <span className="nm">{subnet.name}</span>
            <span className="cidr mono">{subnet.cidr}</span>
          </Link>
          <span className="topo-gw">
            {subnet.gateways.length > 0 ? (
              <>
                Gateway <span className="mono">{subnet.gateways.join(', ')}</span>
              </>
            ) : (
              'No gateway'
            )}
          </span>
          <div className="topo-util">
            <AllocationSegments counters={subnet.counters} cable={cable} />
            <span className="topo-counts">
              <span>
                Occupied <b>{occupied}</b>
              </span>
              <span>
                Reserved <b>{reserved}</b>
              </span>
              <span>
                Free <b>{free}</b>
              </span>
              <span>
                Usable <b>{usable}</b>
              </span>
            </span>
          </div>
        </div>
        {ports.length === 0 ? (
          <p className="topo-none">{subnet.ports.length === 0 ? 'No devices in this subnet yet' : `No ${status} devices`}</p>
        ) : (
          <ul className="topo-devs" aria-label={`Devices in ${subnet.name}`}>
            {ports.map((port) => (
              <DevicePort key={port.device.id} port={port} prefix={subnet.prefix} cable={cable} />
            ))}
          </ul>
        )}
      </section>
    </li>
  )
}

function BranchNode({ branch, status }: { branch: TopologyBranch; status: StatusFilter }) {
  const devices = branch.subnets.reduce((total, subnet) => total + subnet.ports.length, 0)
  const style = { '--cable': branch.color } as CSSProperties
  return (
    <section className="topo-vlan" style={style} aria-label={branch.label}>
      <header className="topo-vhead">
        <span className="topo-jack" aria-hidden="true" />
        <div className="topo-vtext">
          <h2 className="nm">{branch.label}</h2>
          {branch.description && <span className="desc">{branch.description}</span>}
          <span className="r">
            {plural(branch.subnets.length, 'subnet')}, {plural(devices, 'device')}
          </span>
        </div>
      </header>
      {branch.subnets.length === 0 ? (
        <p className="topo-none topo-empty-vlan">No subnets in this VLAN</p>
      ) : (
        <ul className="topo-subnets">
          {branch.subnets.map((subnet) => (
            <SubnetNode key={subnet.id} subnet={subnet} cable={branch.color} status={status} />
          ))}
        </ul>
      )}
    </section>
  )
}

export function TopologyTree({ branches, status }: { branches: TopologyBranch[]; status: StatusFilter }) {
  return (
    <div className="topo-tree">
      {branches.map((branch) => (
        <BranchNode key={branch.key} branch={branch} status={status} />
      ))}
    </div>
  )
}
