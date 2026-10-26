import { CalendarDays, CheckSquare, FileText, LogOut, Sparkles, UserX } from 'lucide-react'
import { PORTAL_THEME } from '../../lib/portalTheme'

export type PortalNavTab = 'my_week' | 'tasks' | 'exams' | 'goals' | 'attendance'

interface MobileBottomNavProps {
  activeTab: PortalNavTab
  setActiveTab: (tab: PortalNavTab) => void
  role: 'ogrenci' | 'veli'
  onLogout: () => void
}

export default function MobileBottomNav({
  activeTab,
  setActiveTab,
  role,
  onLogout,
}: MobileBottomNavProps) {
  // Aktif sekme rengi role göre değişiyor — öğrenci indigo, veli teal.
  const accent = PORTAL_THEME[role].accentStrong
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#ffffff',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '8px 12px 14px 12px',
        zIndex: 1000,
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)',
      }}
    >
      {role === 'ogrenci' ? (
        <>
          <button
            type="button"
            onClick={() => setActiveTab('my_week')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              color: activeTab === 'my_week' ? accent : 'var(--ink-soft)',
              fontSize: 11,
              fontWeight: activeTab === 'my_week' ? 700 : 500,
              cursor: 'pointer',
              flex: 1,
            }}
          >
            <Sparkles size={20} />
            <span>Haftam</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              color: activeTab === 'tasks' ? accent : 'var(--ink-soft)',
              fontSize: 11,
              fontWeight: activeTab === 'tasks' ? 700 : 500,
              cursor: 'pointer',
              flex: 1,
            }}
          >
            <CheckSquare size={20} />
            <span>Program</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('exams')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              color: activeTab === 'exams' ? accent : 'var(--ink-soft)',
              fontSize: 11,
              fontWeight: activeTab === 'exams' ? 700 : 500,
              cursor: 'pointer',
              flex: 1,
            }}
          >
            <FileText size={20} />
            <span>Denemeler</span>
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              color: activeTab === 'tasks' ? accent : 'var(--ink-soft)',
              fontSize: 11,
              fontWeight: activeTab === 'tasks' ? 700 : 500,
              cursor: 'pointer',
              flex: 1,
            }}
          >
            <CalendarDays size={20} />
            <span>Özet</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('exams')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              color: activeTab === 'exams' ? accent : 'var(--ink-soft)',
              fontSize: 11,
              fontWeight: activeTab === 'exams' ? 700 : 500,
              cursor: 'pointer',
              flex: 1,
            }}
          >
            <FileText size={20} />
            <span>Denemeler</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('goals')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              color: activeTab === 'goals' ? accent : 'var(--ink-soft)',
              fontSize: 11,
              fontWeight: activeTab === 'goals' ? 700 : 500,
              cursor: 'pointer',
              flex: 1,
            }}
          >
            <UserX size={20} />
            <span>Devamsızlık</span>
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onLogout}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          background: 'none',
          border: 'none',
          color: 'var(--ink-soft)',
          fontSize: 11,
          fontWeight: 500,
          cursor: 'pointer',
          flex: 1,
        }}
      >
        <LogOut size={20} />
        <span>Çıkış</span>
      </button>
    </nav>
  )
}
