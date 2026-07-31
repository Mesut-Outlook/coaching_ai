import { CalendarDays, CheckSquare, FileText, LogOut, Target, UserX } from 'lucide-react'

interface MobileBottomNavProps {
  activeTab: 'tasks' | 'exams' | 'goals' | 'attendance'
  setActiveTab: (tab: 'tasks' | 'exams' | 'goals' | 'attendance') => void
  role: 'ogrenci' | 'veli'
  onLogout: () => void
}

export default function MobileBottomNav({
  activeTab,
  setActiveTab,
  role,
  onLogout,
}: MobileBottomNavProps) {
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
          color: activeTab === 'tasks' ? 'var(--indigo-600)' : 'var(--ink-soft)',
          fontSize: 11,
          fontWeight: activeTab === 'tasks' ? 700 : 500,
          cursor: 'pointer',
          flex: 1,
        }}
      >
        {role === 'ogrenci' ? <CheckSquare size={20} /> : <CalendarDays size={20} />}
        <span>{role === 'ogrenci' ? 'Program' : 'Özet'}</span>
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
          color: activeTab === 'exams' ? 'var(--indigo-600)' : 'var(--ink-soft)',
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
          color: activeTab === 'goals' ? 'var(--indigo-600)' : 'var(--ink-soft)',
          fontSize: 11,
          fontWeight: activeTab === 'goals' ? 700 : 500,
          cursor: 'pointer',
          flex: 1,
        }}
      >
        {role === 'ogrenci' ? <Target size={20} /> : <UserX size={20} />}
        <span>{role === 'ogrenci' ? 'Hedefler' : 'Devamsızlık'}</span>
      </button>

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
