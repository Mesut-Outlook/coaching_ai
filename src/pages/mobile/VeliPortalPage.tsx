import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import MobileBottomNav from '../../components/mobile/MobileBottomNav'
import ExamSectionsTable from '../../components/exams/ExamSectionsTable'
import { EXCUSE_LABELS, SESSION_LABELS, STATUS_LABELS, formatDateTr } from '../../lib/attendance'
import { PORTAL_THEME, roleBadgeStyle, roleTopBarStyle } from '../../lib/portalTheme'
import type { AbsenceStatus, ExcuseType, SessionType } from '../../types/database'
import {
  clearPortalSession,
  getPortalSession,
  portalDashboard,
  type PortalDashboard,
} from '../../lib/portal'

const card = {
  backgroundColor: '#ffffff',
  borderRadius: 16,
  padding: 18,
  border: '1px solid var(--border)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
} as const

export default function VeliPortalPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<PortalDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'tasks' | 'exams' | 'goals' | 'attendance'>('tasks')
  const [openExamId, setOpenExamId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const session = getPortalSession()
    if (!session) {
      navigate('/portal')
      return
    }

    setLoading(true)
    const res = await portalDashboard(session.code)
    if (!res.ok) {
      clearPortalSession()
      setLoadError(res.error)
      setLoading(false)
      return
    }
    if (res.data.role === 'ogrenci') {
      navigate('/ogrenci')
      return
    }
    setData(res.data)
    setLoadError(null)
    setLoading(false)
  }, [navigate])

  useEffect(() => {
    load()
  }, [load])

  function handleLogout() {
    clearPortalSession()
    navigate('/portal')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Yükleniyor...
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14, textAlign: 'center' }}>
        <AlertTriangle size={32} style={{ color: '#dc2626' }} />
        <div style={{ fontSize: 15, color: 'var(--ink)' }}>{loadError}</div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/portal')}>
          Giriş ekranına dön
        </button>
      </div>
    )
  }

  if (!data) return null

  const theme = PORTAL_THEME.veli
  const { student, tasks, exams, attendance, week_start, is_current_week } = data
  const completedCount = tasks.filter((t) => t.completed).length
  const totalCount = tasks.length
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const latestExam = exams[0] ?? null
  const unexcusedAbsences = attendance.filter((a) => a.excuse_type === 'yok').length

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: 90 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={roleTopBarStyle(theme)} />
        <header
          style={{
            backgroundColor: '#ffffff',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {student.full_name}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Veli Bilgilendirme Portalı</div>
          </div>
          <div style={roleBadgeStyle(theme)}>{theme.label}</div>
        </header>
      </div>

      <main style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {activeTab === 'tasks' && (
          <>
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
                Haftalık Çalışma İlerlemesi
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: theme.accentStrong, marginTop: 4 }}>
                %{completionPct}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
                {completedCount} / {totalCount} görev tamamlandı
              </div>
              {week_start && !is_current_week && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#b45309', backgroundColor: '#fffbeb', padding: '8px 10px', borderRadius: 8 }}>
                  Bu hafta için henüz program girilmemiş. Yukarıdaki oran {formatDateTr(week_start)} haftasına ait.
                </div>
              )}
            </div>

            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
                Son Kayıtlı Deneme
              </div>
              {latestExam ? (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{latestExam.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>
                    {latestExam.exam_type}
                    {latestExam.publisher ? ` · ${latestExam.publisher}` : ''} · {formatDateTr(latestExam.exam_date)}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: theme.accentStrong, marginTop: 6 }}>
                    {Math.round(Number(latestExam.total_net) * 100) / 100} <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600 }}>net</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 6 }}>
                  Henüz girilmiş deneme sonucu yok.
                </div>
              )}
            </div>

            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
                Devamsızlık & Katılım
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: unexcusedAbsences > 0 ? '#dc2626' : '#10b981', marginTop: 4 }}>
                {unexcusedAbsences === 0 ? '✓ Mazeretsiz devamsızlık yok' : `${unexcusedAbsences} mazeretsiz devamsızlık`}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
                Toplam kayıtlı devamsızlık: {attendance.length}
              </div>
            </div>

            {student.target_program && (
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
                  Hedeflenen Bölüm
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginTop: 4 }}>
                  {student.target_program}
                </div>
                {student.target_ranking && (
                  <div style={{ fontSize: 13, color: theme.accentStrong, fontWeight: 700, marginTop: 4 }}>
                    Hedef Sıralama: #{student.target_ranking}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'exams' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Deneme Geçmişi</h3>
            {exams.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>
                Henüz kayıtlı deneme yok.
              </div>
            ) : (
              exams.map((e) => {
                const open = openExamId === e.id
                return (
                  <div key={e.id} style={{ ...card, padding: 0, overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setOpenExamId(open ? null : e.id)}
                      style={{
                        width: '100%',
                        padding: 16,
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{e.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                          {e.exam_type}
                          {e.publisher ? ` · ${e.publisher}` : ''} · {formatDateTr(e.exam_date)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: theme.accentStrong, fontVariantNumeric: 'tabular-nums' }}>
                          {Math.round(Number(e.total_net) * 100) / 100}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>net</div>
                      </div>
                    </button>
                    {open && (
                      <div style={{ padding: '0 12px 12px 12px' }}>
                        <ExamSectionsTable sections={e.sections} />
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </>
        )}

        {activeTab === 'goals' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Devamsızlık Geçmişi</h3>
            {attendance.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>
                Kayıtlı devamsızlık yok. 👏
              </div>
            ) : (
              attendance.map((a) => {
                const unexcused = a.excuse_type === 'yok'
                return (
                  <div key={a.id} style={{ ...card, padding: 14, borderLeft: `4px solid ${unexcused ? '#dc2626' : '#f59e0b'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                        {formatDateTr(a.absence_date)}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: 12,
                          backgroundColor: unexcused ? '#fef2f2' : '#fffbeb',
                          color: unexcused ? '#dc2626' : '#b45309',
                        }}
                      >
                        {unexcused ? 'Mazeretsiz' : EXCUSE_LABELS[a.excuse_type as ExcuseType]}
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4 }}>
                      {SESSION_LABELS[a.session_type as SessionType]} · {STATUS_LABELS[a.status as AbsenceStatus]}
                    </div>
                    {a.excuse_note && (
                      <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4, fontStyle: 'italic' }}>
                        “{a.excuse_note}”
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </>
        )}
      </main>

      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} role="veli" onLogout={handleLogout} />
    </div>
  )
}
