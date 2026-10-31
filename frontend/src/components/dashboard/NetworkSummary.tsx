import { summaryStats, type DeviceTotals } from '@/lib/dashboard'
import { plural } from '@/lib/format'
import type { Rack } from '@/lib/rack'
import { AllocationSegments } from '@/components/addressMap/AllocationBar'

export function NetworkSummary({ rack, devices, agents }: { rack: Rack; devices: DeviceTotals; agents: number }) {
  const { counters, subnets, vlans } = rack.summary
  const usable = counters.usable.toLocaleString('en-US')
  return (
    <section className="panel summary hud brushed" aria-label="Network summary">
      <span className="watermark" aria-hidden="true">
        {usable}
      </span>
      <span className="cscrew tl" aria-hidden="true" />
      <span className="cscrew tr" aria-hidden="true" />
      <span className="cscrew bl" aria-hidden="true" />
      <span className="cscrew br" aria-hidden="true" />
      <div className="sumid">
        <h1 className="heading">Network</h1>
        <p>
          {plural(subnets, 'subnet')}, {plural(vlans, 'VLAN')}, {plural(agents, 'agent')} connected.
        </p>
      </div>
      <dl className="stats">
        {summaryStats(rack.summary, devices).map((stat) => (
          <div key={stat.label} className={stat.warn ? 'warn' : undefined}>
            <dt>{stat.label}</dt>
            <dd>
              {stat.value}
              {stat.note && <small>{stat.note}</small>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="alloc">
        <AllocationSegments counters={counters} />
        <div className="legend">
          <span className="lg">
            <span className="sw occ" />
            Occupied <b>{counters.occupied}</b>
          </span>
          <span className="lg">
            <span className="sw res" />
            Reserved <b>{counters.reserved}</b>
          </span>
          <span className="lg">
            <span className="sw" />
            Free <b>{counters.free}</b>
          </span>
          <span className="vlanlegend" aria-label="VLAN cable colors">
            {rack.vlans.map((vlan) => (
              <span key={vlan.key} className="lg">
                <span className="cable" style={{ background: vlan.color }} aria-hidden="true" />
                {vlan.label}
              </span>
            ))}
          </span>
        </div>
      </div>
    </section>
  )
}
