import { EmptyState } from '@/components/EmptyState'

export default function TopologyPage() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">VLANs, subnets and their devices</p>
      <div className="card">
        <EmptyState
          title="Nothing here yet"
          message="The topology is now shown on the Overview page"
        />
      </div>
    </div>
  )
}
