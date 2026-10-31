import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import { LiveProvider } from '@/lib/live'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Layout } from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import VlanListPage from '@/pages/VlanListPage'
import SubnetListPage from '@/pages/SubnetListPage'
import DeviceListPage from '@/pages/DeviceListPage'
import VlanDetailPage from '@/pages/VlanDetailPage'
import SubnetDetailPage from '@/pages/SubnetDetailPage'
import TopologyPage from '@/pages/TopologyPage'
import ApiKeysPage from '@/pages/ApiKeysPage'
import ScanReportsPage from '@/pages/ScanReportsPage'
import AgentsPage from '@/pages/AgentsPage'
import ConnectorsPage from '@/pages/ConnectorsPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <LiveProvider>
                <Layout />
              </LiveProvider>
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/vlans" element={<VlanListPage />} />
          <Route path="/vlans/:id" element={<VlanDetailPage />} />
          <Route path="/subnets" element={<SubnetListPage />} />
          <Route path="/subnets/:id" element={<SubnetDetailPage />} />
          <Route path="/devices" element={<DeviceListPage />} />
          <Route path="/topology" element={<TopologyPage />} />
          <Route path="/api-keys" element={<ApiKeysPage />} />
          <Route path="/scan-reports" element={<ScanReportsPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/connectors" element={<ConnectorsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
