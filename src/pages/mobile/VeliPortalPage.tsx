import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import MobileBottomNav, { type PortalNavTab } from '../../components/mobile/MobileBottomNav'
import ExamSectionsTable from '../../components/exams/ExamSectionsTable'
import { EXCUSE_LABELS, SESSION_LABELS, STATUS_LABELS, formatDateTr } from '../../lib/attendance'
import { PORTAL_THEME, roleBadgeStyle, roleTopBarStyle } from '../../lib/portalTheme'
import type { AbsenceStatus, ExcuseType, SessionType } from '../../types/database'
import StudentExamAnalysisView from '../../components/exams/StudentExamAnalysisView'
import { PORTAL_PARENT_PALETTE } from '../../components/charts/chartPalette'
import ParentSummaryCard from '../../components/reports/ParentSummaryCard'
import {
  computeSummaryStats,
  generateParentSupportTips,
  formatWeekRangeFromKey,
} from '../../lib/parentSummaryCore'
import {
  clearPortalSession,
  getPortalSession,
  portalDashboard,
  portalExamReport,
  type PortalDashboard,
  type PortalExamReportData,
} from '../../lib/portal'

const card = {
  backgroundColor: 'var(--surface)',
  borderRadius: 16,
  padding: 18,
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-card)',
} as const

export default function VeliPortalPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<PortalDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<PortalNavTab>('tasks')
  const [openExamId, setOpenExamId] = useState<string | null>(null)
  const [examSubTab, setExamSubTab] = useState<'analysis' | 'list'>('analysis')
  const [examReportData, setExamReportData] = useState<PortalExamReportData | null>(null)
  const [examReportLoading, setExamReportLoading] = useState(false)

  const loadExamReport = useCallback(async () => {
    const session = getPortalSession()
    if (!session) return
    setExamReportLoading(true)
    const res = await portalExamReport(session.code)
    if (res.ok) {
      setExamReportData(res.data)
    }
    setExamReportLoading(false)
  }, [])

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
    loadExamReport()
  }, [load, loadExamReport])

  useEffect(() => {
    if (activeTab === 'exams' && !examReportData) {
      loadExamReport()
    }
  }, [activeTab, examReportData, loadExamReport])

  function handleLogout() {
    clearPortalSession()
    navigate('/portal')
  }

  // Summary stats for the parent weekly card
  const summaryStats = useMemo(() => {
    if (!data) return null
    return computeSummaryStats({
      tasks: data.tasks,
      latestExam: data.exams[0] ?? null,
      previousExam: data.exams[1] ?? null,
      attendanceRecords: data.attendance,
      targetNet: data.my_week?.target_net ?? null,
    })
  }, [data])

  // Support tips for the parent
  const tips = useMemo(() => {
    if (!summaryStats) return []
    return generateParentSupportTips({
      completionPct: summaryStats.completionPct,
      hasSignificantExamDrop: summaryStats.hasExamDrop,
      hasAttendanceIssue: summaryStats.attendanceCount > 0,
    })
  }, [summaryStats])

  const coachNote =
    data?.my_week?.coach_latest_note ||
    examReportData?.exams?.[0]?.coach_note ||
    null

  const weekRangeText = data?.week_start
    ? formatWeekRangeFromKey(data.week_start)
    : 'Bu Hafta'

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}>
        Yükleniyor...
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14, textAlign: 'center' }}>
        <AlertTriangle size={32} style={{ color: 'var(--critical)' }} />
        <div style={{ fontSize: 15, color: 'var(--ink)' }}>{loadError}</div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/portal')}>
          Giriş ekranına dön
        </button>
      </div>
    )
  }

  if (!data || !summaryStats) return null

  const theme = PORTAL_THEME.veli
  const { student, exams, attendance, week_start, is_current_week } = data

  return (
    <div className="portal-page" style={{ minHeight: '100vh', backgroundColor: 'var(--paper)', paddingBottom: 90 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={roleTopBarStyle(theme)} />
        <header
          style={{
            backgroundColor: 'var(--surface)',
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
            {/* R3-6: Salt-okunur Veli Haftalık Özeti ve Koç Notu Kartı */}
            <ParentSummaryCard
              studentName={student.full_name}
              weekRangeText={weekRangeText}
              stats={summaryStats}
              tips={tips}
              coachNote={coachNote}
            />

            {week_start && !is_current_week && (
              <div style={{ fontSize: 12, color: 'var(--warning-text)', backgroundColor: 'var(--warning-bg)', padding: '10px 14px', borderRadius: 'var(--radius-md, 12px)', border: '1px solid var(--border-soft)' }}>
                Bu hafta için henüz yeni program girilmemiş. Yukarıdaki oran {formatDateTr(week_start)} haftasına aittir.
              </div>
            )}

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
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 4, background: 'var(--surface-alt)', border: '1px solid var(--border-soft)', padding: 3, borderRadius: 10 }}>
                <button
                  type="button"
                  onClick={() => setExamSubTab('analysis')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: examSubTab === 'analysis' ? 'var(--surface)' : 'transparent',
                    color: examSubTab === 'analysis' ? theme.accentStrong : 'var(--ink-soft)',
                    boxShadow: examSubTab === 'analysis' ? 'var(--shadow-card)' : 'none',
                  }}
                >
                  Analiz & Özet
                </button>
                <button
                  type="button"
                  onClick={() => setExamSubTab('list')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: examSubTab === 'list' ? 'var(--surface)' : 'transparent',
                    color: examSubTab === 'list' ? theme.accentStrong : 'var(--ink-soft)',
                    boxShadow: examSubTab === 'list' ? 'var(--shadow-card)' : 'none',
                  }}
                >
                  Geçmiş Denemeler ({exams.length})
                </button>
              </div>
            </div>

            {examSubTab === 'analysis' ? (
              examReportLoading ? (
                <div style={{ ...card, textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>
                  Deneme analiz raporu yükleniyor…
                </div>
              ) : examReportData && examReportData.exams.length > 0 ? (
                <div>
                  <StudentExamAnalysisView
                    studentId={student.id}
                    role="parent"
                    palette={PORTAL_PARENT_PALETTE}
                    initialCatalog={examReportData.catalog}
                    initialExams={examReportData.exams}
                  />
                  <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11.5, color: 'var(--ink-faint)', padding: '12px 16px' }}>
                    Sayılar girilen deneme sonuçlarından hesaplanır; konusu girilmemiş denemeler konu analizinde yer almaz.
                  </div>
                </div>
              ) : (
                <div style={{ ...card, textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>
                  Henüz kayıtlı deneme karnesi bulunmuyor.
                </div>
              )
            ) : (
              exams.length === 0 ? (
                <div style={{ ...card, textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>
                  Henüz kayıtlı deneme yok.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {exams.map((e) => {
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
                  })}
                </div>
              )
            )}
          </div>
        )}

        {activeTab === 'goals' && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Devamsızlık Geçmişi</h3>
            {attendance.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>
                Kayıtlı devamsızlık yok. 👏
              </div>
            ) : (
              attendance.map((a) => {
                const unexcused = a.excuse_type === 'yok'
                return (
                  <div
                    key={a.id}
                    style={{
                      ...card,
                      padding: 14,
                      borderLeft: `4px solid ${unexcused ? 'var(--critical)' : 'var(--warning)'}`,
                    }}
                  >
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
                          backgroundColor: unexcused ? 'var(--critical-bg)' : 'var(--warning-bg)',
                          color: unexcused ? 'var(--critical-text)' : 'var(--warning-text)',
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
