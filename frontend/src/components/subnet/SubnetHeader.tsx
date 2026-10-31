import { Link } from 'react-router-dom'
import type { AddressCounters } from '@/lib/addressMap'
import { formatRange, subnetFacts } from '@/lib/addressMath'
import { cx } from '@/lib/cx'
import type { SubnetDetail } from '@/types'
import { Tooltip } from '@/components/Tooltip'
import { VlanChip } from '@/components/VlanChip'
import { AllocationBar } from '@/components/addressMap/AllocationBar'

function PrefixRuler({ prefix }: { prefix: number }) {
  const hostBits = 32 - prefix
  return (
    <div className="ruler" role="img" aria-label={`Prefix /${prefix}: ${prefix} network bits, ${hostBits} host bits`}>
      <div className="bits">
        {[0, 1, 2, 3].map((group) => (
          <span className="bitgrp" key={group}>
            {Array.from({ length: 8 }, (_, bit) => (
              <span key={bit} className={cx('bit', group * 8 + bit < prefix ? 'n' : 'h')} />
            ))}
          </span>
        ))}
      </div>
      <div className="bitlab">
        <span>{prefix} network bits</span>
        <span>{hostBits} host bits</span>
      </div>
    </div>
  )
}

function Fact({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <Tooltip tip={value} focusable>
        <dd className={cx(mono && value !== 'None' && 'mono')}>{value}</dd>
      </Tooltip>
    </div>
  )
}

function orNone(value: string): string {
  return value.trim() || 'None'
}

export function SubnetHeader({ subnet, prefix, counters, cable }: { subnet: SubnetDetail; prefix: number; counters: AddressCounters; cable: string }) {
  const facts = subnetFacts(subnet.cidr, subnet.includeFirstLast)
  const pools = subnet.dhcpPools.map((pool) => formatRange(pool.startIp, pool.endIp)).join(', ')
  const usableRange = facts.firstUsable && facts.lastUsable ? formatRange(facts.firstUsable, facts.lastUsable) : 'None'
  return (
    <section className="panel subhead hud brushed" aria-label="Subnet">
      <span className="watermark" aria-hidden="true">
        {subnet.cidr}
      </span>
      <span className="cscrew tl" aria-hidden="true" />
      <span className="cscrew tr" aria-hidden="true" />
      <span className="cscrew bl" aria-hidden="true" />
      <span className="cscrew br" aria-hidden="true" />
      <div className="idblock">
        <div className="idrow">
          <h1 className="heading">{subnet.name}</h1>
          <span className="cidr-hero">{subnet.cidr}</span>
        </div>
        <PrefixRuler prefix={prefix} />
        {subnet.vlan ? (
          <Link to={`/vlans/${subnet.vlan.id}`} className="self-start">
            <VlanChip vlan={subnet.vlan} />
          </Link>
        ) : (
          <VlanChip vlan={null} />
        )}
        {subnet.description && <p className="desc">{subnet.description}</p>}
      </div>
      <dl className="facts">
        <Fact label="Gateway" value={orNone(subnet.gateways.join(', '))} />
        <Fact label="DHCP pool" value={orNone(pools)} />
        <Fact label="DNS servers" value={orNone(subnet.dnsServers)} />
        <Fact label="Domain" value={orNone(subnet.domainName)} />
        <Fact label="Network" value={facts.network} />
        <Fact label="Broadcast" value={facts.broadcast} />
        <Fact label="Usable range" value={usableRange} />
        <Fact label="NTP servers" value={orNone(subnet.ntpServers)} />
        <Fact label="Netmask" value={facts.netmask} />
        <Fact label="Wildcard" value={facts.wildcard} />
        <Fact label="Reverse zone" value={facts.reverseZone} />
        <Fact label="Size" value={`${facts.size.toLocaleString('en-US')} addresses`} mono={false} />
      </dl>
      <div className="alloc">
        <AllocationBar counters={counters} cable={cable} />
      </div>
    </section>
  )
}
