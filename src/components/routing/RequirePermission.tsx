import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAccess } from '../../contexts/AccessContext'
import type { PermissionKey } from '../../lib/permissions'

interface RequirePermissionProps {
  perm: PermissionKey
  children: ReactNode
}

const ROUTE_PERMISSION_MAP: { perm: PermissionKey; path: string }[] = [
  { perm: 'panel.view', path: '/panel' },
  { perm: 'students.view', path: '/ogrenciler' },
  { perm: 'attendance.view', path: '/devamsizlik' },
  { perm: 'exams.view', path: '/denemeler' },
  { perm: 'topics.view', path: '/konular' },
  { perm: 'program.view', path: '/program' },
  { perm: 'reports.view', path: '/raporlar' },
  { perm: 'curriculum.manage', path: '/mufredat' },
  { perm: 'tercih.view', path: '/tercih' },
]

export function RequirePermission({ perm, children }: RequirePermissionProps) {
  const { can, loading } = useAccess()

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  if (can(perm)) {
    return <>{children}</>
  }

  // Kullanıcının erişebildiği ilk rotayı bul
  const allowedRoute = ROUTE_PERMISSION_MAP.find((item) => can(item.perm))
  const fallbackPath = allowedRoute ? allowedRoute.path : '/yardim'

  return <Navigate to={fallbackPath} replace />
}
