import { NavLink } from 'react-router-dom'
import { LayoutGrid, Users, ClipboardList, Layers, Calendar, BarChart2, Target } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const NAV_ITEMS = [
  { to: '/panel', label: 'Panel', icon: LayoutGrid },
  { to: '/ogrenciler', label: 'Öğrenciler', icon: Users },
  { to: '/denemeler', label: 'Denemeler', icon: ClipboardList },
  { to: '/konular', label: 'Konular', icon: Layers },
  { to: '/program', label: 'Program', icon: Calendar },
  { to: '/raporlar', label: 'Raporlar', icon: BarChart2 },
]

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

export default function Sidebar() {
  const { profile, user, signOut } = useAuth()
  const displayName = profile?.full_name ?? user?.email ?? 'Koç'

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Target size={19} color="#fff" strokeWidth={1.8} />
        </div>
        <div>
          <div className="brand-title">Netlik</div>
          <div className="brand-sub">Eda Cangert · YKS Koçluk</div>
        </div>
      </div>

      <nav className="nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
          >
            <Icon className="icon" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot">
        <button type="button" className="coach-chip" onClick={signOut} title="Çıkış yap">
          <div className="coach-avatar">{initials(displayName)}</div>
          <div>
            <div className="coach-name">{displayName}</div>
            <div className="coach-role">{profile?.role ?? 'Kurucu Koç'}</div>
          </div>
        </button>
      </div>
    </aside>
  )
}
