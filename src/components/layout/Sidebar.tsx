import { NavLink } from 'react-router-dom'
import {
  LayoutGrid,
  Users,
  ClipboardList,
  Layers,
  Calendar,
  UserX,
  BarChart2,
  BookOpen,
  Compass,
  HelpCircle,
  Shield,
  UserCheck,
  Building,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useAccess } from '../../contexts/AccessContext'
import type { PermissionKey } from '../../lib/permissions'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutGrid
  permission?: PermissionKey
  adminOnly?: boolean
}

const MAIN_NAV_ITEMS: NavItem[] = [
  { to: '/panel', label: 'Panel', icon: LayoutGrid, permission: 'panel.view' },
  { to: '/ogrenciler', label: 'Öğrenciler', icon: Users, permission: 'students.view' },
  { to: '/denemeler', label: 'Denemeler', icon: ClipboardList, permission: 'exams.view' },
  { to: '/konular', label: 'Konular', icon: Layers, permission: 'topics.view' },
  { to: '/program', label: 'Program', icon: Calendar, permission: 'program.view' },
  { to: '/devamsizlik', label: 'Devamsızlık', icon: UserX, permission: 'attendance.view' },
  { to: '/raporlar', label: 'Raporlar', icon: BarChart2, permission: 'reports.view' },
  { to: '/mufredat', label: 'Müfredat', icon: BookOpen, permission: 'curriculum.manage' },
  { to: '/tercih', label: 'Tercih Sihirbazı', icon: Compass, permission: 'tercih.view' },
]

const MANAGEMENT_NAV_ITEMS: NavItem[] = [
  { to: '/yonetim/kullanicilar', label: 'Kullanıcılar', icon: UserCheck, permission: 'members.manage' },
  { to: '/yonetim/roller', label: 'Roller', icon: Shield, permission: 'roles.manage' },
  { to: '/yonetim/kurumlar', label: 'Kurumlar', icon: Building, adminOnly: true },
]

const UTILITY_NAV_ITEMS = [
  { to: '/yardim', label: 'Yardım', icon: HelpCircle },
]

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

export default function Sidebar() {
  const { profile, user, signOut } = useAuth()
  const { can, isSystemAdmin, memberships, activeInstitutionId, setActiveInstitution } = useAccess()

  const displayName = profile?.full_name ?? user?.email ?? 'Koç'

  const visibleMainItems = MAIN_NAV_ITEMS.filter((item) => !item.permission || can(item.permission))
  const visibleMgmtItems = MANAGEMENT_NAV_ITEMS.filter(
    (item) => (item.adminOnly ? isSystemAdmin : item.permission && can(item.permission))
  )

  // Aktif rolu belirle
  const activeMembership = memberships.find((m) => m.institution_id === activeInstitutionId)
  const displayRole = isSystemAdmin
    ? 'Sistem Yöneticisi'
    : activeMembership
    ? activeMembership.role_name
    : profile?.role ?? 'Koç'

  const showInstitutionSelector = isSystemAdmin || memberships.length > 1

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <img src="/logo.png" alt="" width={38} height={38} />
        </div>
        <div>
          <div className="brand-title">Netlik</div>
          <div className="brand-sub">Eda Cangert · YKS Koçluk</div>
        </div>
      </div>

      {showInstitutionSelector && (
        <div className="px-3 py-2">
          <div className="relative">
            <select
              value={activeInstitutionId ?? ''}
              onChange={(e) => setActiveInstitution(e.target.value ? e.target.value : null)}
              className="w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 pr-8 text-xs font-medium text-[var(--ink)] shadow-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Tüm Kurumlar</option>
              {memberships.map((m) => (
                <option key={m.institution_id} value={m.institution_id}>
                  {m.institution_name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-soft)]" />
          </div>
        </div>
      )}

      <nav className="nav" style={{ flex: 1, overflowY: 'auto' }}>
        {visibleMainItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
          >
            <Icon className="icon" />
            {label}
          </NavLink>
        ))}

        {visibleMgmtItems.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              Yönetim
            </div>
            {visibleMgmtItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
              >
                <Icon className="icon" />
                {label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 'auto' }}>
        {UTILITY_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
          >
            <Icon className="icon" />
            {label}
          </NavLink>
        ))}
      </div>

      <div className="sidebar-foot">
        <button type="button" className="coach-chip" onClick={signOut} title="Çıkış yap">
          <div className="coach-avatar">{initials(displayName)}</div>
          <div>
            <div className="coach-name">{displayName}</div>
            <div className="coach-role">{displayRole}</div>
          </div>
        </button>
      </div>
    </aside>
  )
}
