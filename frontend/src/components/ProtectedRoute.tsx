import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { TOKEN_KEY } from '@/lib/api'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
