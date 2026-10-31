import { cx } from '@/lib/cx'
import { LOW_FREE_RATIO, type Rack } from '@/lib/rack'
import { AllocationSegments } from '@/components/addressMap/AllocationBar'

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

const LOW_PERCENT = LOW_FREE_RATIO * 100

export function NetworkSummary({ rack, agents }: { rack: Rack; agents: number }) {
  const { counters, freePercent, low, subnets, vlans } = rack.summary
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
        <div>
          <dt>Devices</dt>
          <dd>
            {counters.occupied}
            <small>{counters.occupiedOnline} online</small>
          </dd>
        </div>
        <div>
          <dt>Offline now</dt>
          <dd>
            {counters.occupiedOffline}
            <small>last seen over 5 min ago</small>
          </dd>
        </div>
        <div>
          <dt>Usable addresses</dt>
          <dd>{usable}</dd>
        </div>
        <div>
          <dt>Free addresses</dt>
          <dd>
            {counters.free.toLocaleString('en-US')}
            <small>{freePercent}% of usable</small>
          </dd>
        </div>
        <div className={cx(low > 0 && 'warn')}>
          <dt>Subnets low on free</dt>
          <dd>
            {low}
            <small>under {LOW_PERCENT}% free</small>
          </dd>
        </div>
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
