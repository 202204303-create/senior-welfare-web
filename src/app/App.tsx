import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from '@/shared/layout/AppLayout'
import { CarePage } from '@/features/care/pages/CarePage'
import { AlertsPage } from '@/features/care/pages/AlertsPage'
import { GuardianPage } from '@/features/care/pages/GuardianPage'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { MyPage } from '@/features/dashboard/pages/MyPage'
import { NotFoundPage } from '@/shared/pages/NotFoundPage'
import { WorkerPage } from '@/features/worker/pages/WorkerPage'
import { homePathOf } from '@/features/auth/lib/demoAccounts'
import { useUserStore } from '@/features/auth/store/useUserStore'

function RequireAuth({ children }: { children: ReactNode }) {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn)
  const role = useUserStore((s) => s.role)
  const location = useLocation()
  if (!isLoggedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  // 보호자·복지사 계정은 어르신 화면 대신 자기 화면으로 보냅니다.
  if (role && role !== 'elder') return <Navigate to={homePathOf(role)} replace />
  return children
}

/** 복지사 계정으로 로그인한 경우에만 들어갈 수 있습니다. */
function RequireWorker({ children }: { children: ReactNode }) {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn)
  const role = useUserStore((s) => s.role)
  if (!isLoggedIn) return <Navigate to="/login" replace />
  if (role !== 'worker') return <Navigate to={homePathOf(role ?? 'elder')} replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/guardian" element={<GuardianPage />} />
      <Route
        path="/worker"
        element={
          <RequireWorker>
            <WorkerPage />
          </RequireWorker>
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="care" element={<CarePage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="my" element={<MyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
