import { cx } from '@/lib/cx'
import { vlanColor, vlanLabel, type VlanTag } from '@/lib/vlan'

export function Cable({ tag, className }: { tag: number | null | undefined; className?: string }) {
  return <span className={cx('cable', className)} style={{ background: vlanColor(tag) }} aria-hidden="true" />
}

export function VlanChip({ vlan }: { vlan: VlanTag | null | undefined }) {
  return (
    <span className="vlanchip">
      <Cable tag={vlan?.vlanId} />
      {vlanLabel(vlan)}
    </span>
  )
}
