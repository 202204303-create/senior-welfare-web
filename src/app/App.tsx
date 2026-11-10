import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from '@/shared/layout/AppLayout'
import { CarePage } from '@/features/care/pages/CarePage'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { JobApplyPage } from '@/features/jobs/pages/JobApplyPage'
import { JobsPage } from '@/features/jobs/pages/JobsPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { MapPage } from '@/features/map/pages/MapPage'
import { MyPage } from '@/features/dashboard/pages/MyPage'
import { NotFoundPage } from '@/shared/pages/NotFoundPage'
import { PoliciesPage } from '@/features/policies/pages/PoliciesPage'
import { useUserStore } from '@/features/auth/store/useUserStore'

function RequireAuth({ children }: { children: ReactNode }) {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn)
  const location = useLocation()
  if (!isLoggedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="care" element={<CarePage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="jobs/:id/apply" element={<JobApplyPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="policies" element={<PoliciesPage />} />
        <Route path="my" element={<MyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
