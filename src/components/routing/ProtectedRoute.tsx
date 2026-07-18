import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { isSupabaseConfigured } from '../../lib/supabase'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  // Supabase henüz bağlanmadıysa geliştirme sırasında giriş ekranını atlayıp
  // ekranları görebilmek için erişime izin ver (veri boş/hata durumları görünür).
  if (!isSupabaseConfigured) return <>{children}</>

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)' }}>
        Yükleniyor…
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return <>{children}</>
}
