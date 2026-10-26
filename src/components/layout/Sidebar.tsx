import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  House,
  Users,
  ClipboardList,
  Layers,
  Calendar,
  UserX,
  BarChart2,
  BookOpen,
  Compass,
  ListPlus,
  HelpCircle,
  Shield,
  UserCheck,
  Building,
  ChevronDown,
  ScrollText,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useAccess } from '../../contexts/AccessContext'
import type { PermissionKey } from '../../lib/permissions'
import { useSidebar } from '../../contexts/useSidebar'
import { useHomeSummary } from '../../contexts/homeSummaryContext'
import type { HomeSummary } from '../../lib/homeSummary'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  permission?: PermissionKey
  adminOnly?: boolean
  /** Modül kimlik rengi: menü ikonu ve Ana Sayfa kısayol kartı aynı rengi taşır.
   *  Menü zemini her temada koyu olduğu için sabit, açık tonlar. */
  color?: string
  /** Menüde sayaç rozeti; değer Ana Sayfa özetinden gelir */
  badge?: (s: HomeSummary) => { n: number; hot?: boolean; title: string } | null
}

const MAIN_NAV_ITEMS: NavItem[] = [
  { to: '/panel', label: 'Ana Sayfa', icon: House, permission: 'panel.view', color: '#3FB6CC' },
  {
    to: '/ogrenciler', label: 'Öğrenciler', icon: Users, permission: 'students.view', color: '#6E63C9',
    badge: (s) => (s.students.totalActive ? { n: s.students.totalActive, title: 'Aktif öğrenci' } : null),
  },
  {
    to: '/denemeler', label: 'Denemeler', icon: ClipboardList, permission: 'exams.view', color: '#3B6FE0',
    badge: (s) => (s.exams.withoutTopicsCount ? { n: s.exams.withoutTopicsCount, hot: true, title: 'Konusu girilmemiş deneme' } : null),
  },
  { to: '/konular', label: 'Konular', icon: Layers, permission: 'topics.view', color: 'var(--m-kon)' },
  { to: '/program', label: 'Program', icon: Calendar, permission: 'program.view', color: '#2E9F63' },
  {
    to: '/devamsizlik', label: 'Devamsızlık', icon: UserX, permission: 'attendance.view', color: '#E2832E',
    badge: (s) => (s.attendance.needsAttentionCount ? { n: s.attendance.needsAttentionCount, hot: true, title: 'Takip gereken öğrenci' } : null),
  },
  { to: '/raporlar', label: 'Raporlar', icon: BarChart2, permission: 'reports.view', color: '#9350A6' },
]

const TOOL_NAV_ITEMS: NavItem[] = [
  { to: '/mufredat', label: 'Müfredat', icon: BookOpen, permission: 'curriculum.manage' },
  { to: '/tercih', label: 'Tercih Sihirbazı', icon: Compass, permission: 'tercih.view' },
  { to: '/ek-yerlestirme', label: 'Ek Yerleştirme', icon: ListPlus, permission: 'tercih.view' },
]

const MANAGEMENT_NAV_ITEMS: NavItem[] = [
  { to: '/yonetim/kullanicilar', label: 'Kullanıcılar', icon: UserCheck, permission: 'members.manage' },
  { to: '/yonetim/roller', label: 'Roller', icon: Shield, permission: 'roles.manage' },
  { to: '/yonetim/kurumlar', label: 'Kurumlar', icon: Building, adminOnly: true },
  { to: '/yonetim/kayitlar', label: 'Denetim Kayıtları', icon: ScrollText, adminOnly: true },
]

const UTILITY_NAV_ITEMS = [
  { to: '/yardim', label: 'Yardım', icon: HelpCircle },
]

/** Kurum id'sini sabit bir palet dizinine (1..5) eşler. */
function institutionColorIndex(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (h % 5) + 1
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

export default function Sidebar() {
  const { profile, user, signOut } = useAuth()
  const { can, isSystemAdmin, memberships, activeInstitutionId, setActiveInstitution } = useAccess()
  const { collapsed, locked, toggleLocked, setHovering } = useSidebar()

  const displayName = profile?.full_name ?? user?.email ?? 'Koç'

  const { summary } = useHomeSummary()
  const location = useLocation()
  const navRef = useRef<HTMLElement>(null)
  const [ind, setInd] = useState<{ y: number; h: number; color: string } | null>(null)
  const [scrolling, setScrolling] = useState(false)
  const scrollTimer = useRef<number | undefined>(undefined)

  const visibleMainItems = MAIN_NAV_ITEMS.filter((item) => !item.permission || can(item.permission))
  const visibleToolItems = TOOL_NAV_ITEMS.filter((item) => !item.permission || can(item.permission))
  const visibleMgmtItems = MANAGEMENT_NAV_ITEMS.filter(
    (item) => (item.adminOnly ? isSystemAdmin : item.permission && can(item.permission))
  )

  // Seçili sayfanın arkasındaki zemin bir öğeden diğerine kayar. Konum ölçülerek
  // bulunur: menü daralınca, kurum değişince ya da pencere boyu değişince yeniden ölçülür.
  useLayoutEffect(() => {
    const measure = () => {
      const active = navRef.current?.querySelector<HTMLElement>('.nav-item.is-active')
      setInd(active ? { y: active.offsetTop, h: active.offsetHeight, color: active.dataset.color ?? '' } : null)
    }
    measure()
    // daralma/genişleme geçişi bitince bir kez daha
    const t = window.setTimeout(measure, 200)
    window.addEventListener('resize', measure)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', measure)
    }
  }, [location.pathname, collapsed, visibleMainItems.length, visibleToolItems.length])

  const onNavScroll = () => {
    setScrolling(true)
    window.clearTimeout(scrollTimer.current)
    scrollTimer.current = window.setTimeout(() => setScrolling(false), 700)
  }

  const renderItem = ({ to, label, icon: Icon, color, badge }: NavItem) => {
    const b = badge && summary ? badge(summary) : null
    return (
      <NavLink
        key={to}
        to={to}
        viewTransition
        className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}${color ? ' has-color' : ''}`}
        style={color ? ({ '--mc': color } as CSSProperties) : undefined}
        data-color={color}
        title={b ? `${label} · ${b.n} ${b.title.toLocaleLowerCase('tr-TR')}` : label}
      >
        <span className="nav-ic">
          <Icon className="icon" />
        </span>
        <span className="nav-label">{label}</span>
        {b && <span className={`nav-count${b.hot ? ' is-hot' : ''}`}>{b.n}</span>}
      </NavLink>
    )
  }

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

  // Menü zemini aktif kuruma göre değişir: hangi kurumda çalıştığın tek bakışta
  // belli olsun (kurumlar arası geçişte en sık yapılan hata yanlış kurumda işlem
  // yapmak). "Tüm Kurumlar" da kendi nötr tonunu alır — birleşik görünümde
  // olduğunu bilmek, bir kurumda olduğunu sanmaktan daha güvenli.
  //
  // Netlik/Konsept dışındaki kurumlar için renk, kurum id'sinden türetilir:
  // aynı kurum her açılışta aynı rengi alır ve kurumlar birbirinden ayrışır.
  const instTheme = !activeInstitutionId
    ? 'tumu'
    : isKonseptSelected
    ? 'konsept'
    : isNetlikSelected
    ? 'netlik'
    : `diger-${institutionColorIndex(activeInstitutionId)}`

  const showInstitutionSelector = isSystemAdmin || memberships.length > 1

  return (
    <aside
      className={`sidebar sidebar-${instTheme}${collapsed ? ' is-collapsed' : ''}${locked ? ' is-locked' : ''}`}
      onMouseEnter={() => locked && setHovering(true)}
      onMouseLeave={() => locked && setHovering(false)}
    >
      {/* Kilit düğmesi: kapalıyken menü dar kalır, fareyle üzerine gelince
          geçici açılır. Tercih localStorage'da saklanır. */}
      <button
        type="button"
        className="sidebar-toggle"
        onClick={toggleLocked}
        title={locked ? 'Menüyü açık sabitle' : 'Menüyü daralt'}
        aria-label={locked ? 'Menüyü açık sabitle' : 'Menüyü daralt'}
        aria-pressed={locked}
      >
        {locked ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
      </button>

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

      <nav
        ref={navRef}
        className={`nav${scrolling ? ' is-scrolling' : ''}`}
        onScroll={onNavScroll}
        aria-label="Ana menü"
      >
        {ind && (
          <span
            className="nav-ind"
            aria-hidden="true"
            style={{ transform: `translateY(${ind.y}px)`, height: ind.h, ...(ind.color ? { '--mc': ind.color } : {}) } as CSSProperties}
          />
        )}
        {visibleMainItems.map(renderItem)}

        {visibleToolItems.length > 0 && (
          <>
            <div className="nav-group-label">Araçlar</div>
            {visibleToolItems.map(renderItem)}
          </>
        )}

        {visibleMgmtItems.length > 0 && (
          <>
            <div className="nav-group-label">Yönetim</div>
            {visibleMgmtItems.map(renderItem)}
          </>
        )}
      </nav>

      <div className="nav-utility">{UTILITY_NAV_ITEMS.map(renderItem)}</div>

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
