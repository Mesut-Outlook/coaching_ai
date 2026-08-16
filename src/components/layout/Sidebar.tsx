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

  // Kurum secim kontrolu
  const instNameLower = activeMembership?.institution_name.toLowerCase() ?? ''

  const isKonseptSelected =
    Boolean(activeInstitutionId) &&
    (instNameLower.includes('konsept') || instNameLower.includes('concept'))

  const isNetlikSelected =
    !activeInstitutionId ||
    !activeMembership ||
    activeMembership.is_coaching_practice ||
    instNameLower.includes('netlik')

  let brandTitle = 'Netlik'
  let brandSub = 'Eda Cangert · YKS Koçluk'
  let brandLogo = '/logo.png'

  if (isKonseptSelected) {
    brandTitle = 'Konsept'
    brandSub = activeMembership?.role_name ?? 'Eğitim Kurumu'
    brandLogo = '/logo-konsept.png'
  } else if (isNetlikSelected) {
    brandTitle = 'Netlik'
    brandSub = 'Eda Cangert · YKS Koçluk'
    brandLogo = '/logo.png'
  } else if (activeMembership) {
    brandTitle = activeMembership.institution_name
    brandSub = activeMembership.role_name
    brandLogo = ''
  }

  const showInstitutionSelector = isSystemAdmin || memberships.length > 1

  return (
    <aside className="sidebar">
      {/* Marka alanı ana sayfa düğmesidir: kullanıcının "anasayfaya dönüş tuşu yok"
          şikayeti buradandı — eskiden tıklanamayan bir div'di. */}
      <NavLink to="/panel" className="brand" title="Koç Paneli'ne dön">
        <div className="brand-mark">
          {brandLogo ? (
            <img src={brandLogo} alt={brandTitle} width={38} height={38} />
          ) : (
            <Building size={20} />
          )}
        </div>
        <div>
          <div className="brand-title">{brandTitle}</div>
          <div className="brand-sub">{brandSub}</div>
        </div>
      </NavLink>

      {/* Kurum seçici. Tailwind bu projede kurulu değil — eski sınıflar hiçbir şey
          yapmıyordu, seçici koyu sidebar'da çıplak sistem select'i olarak duruyordu.
          Artık projenin kendi CSS'iyle çiziliyor ve seçili kurumdaki rolü de gösteriyor. */}
      {showInstitutionSelector && (
        <div className="inst-switch">
          <span className="inst-switch-label">Kurum</span>
          <div className="inst-switch-control">
            <select
              aria-label="Aktif kurum"
              value={activeInstitutionId ?? ''}
              onChange={(e) => setActiveInstitution(e.target.value ? e.target.value : null)}
            >
              <option value="">Tüm Kurumlar</option>
              {memberships.map((m) => (
                <option key={m.institution_id} value={m.institution_id}>
                  {m.institution_name}
                </option>
              ))}
            </select>
            <ChevronDown size={15} className="inst-switch-caret" />
          </div>
          <span className="inst-switch-role">
            {activeInstitutionId ? (activeMembership?.role_name ?? displayRole) : 'Tüm kurumların birleşik görünümü'}
          </span>
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
            <div className="nav-group-label">Yönetim</div>
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
