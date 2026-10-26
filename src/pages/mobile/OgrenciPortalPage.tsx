import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  Circle,
  Plus,
  AlertTriangle,
  Calendar,
  Sparkles,
  Target,
  MessageSquareQuote,
  ArrowRight,
} from 'lucide-react'
import MobileBottomNav, { type PortalNavTab } from '../../components/mobile/MobileBottomNav'
import ExamSectionsTable from '../../components/exams/ExamSectionsTable'
import { getExamSections, sectionNet, weightedNet } from '../../lib/examSections'
import { gradeCurriculum } from '../../lib/curriculum'
import { PORTAL_THEME, roleBadgeStyle, roleTopBarStyle } from '../../lib/portalTheme'
import type { ExamType } from '../../types/database'
import StudentExamAnalysisView from '../../components/exams/StudentExamAnalysisView'
import { PORTAL_STUDENT_PALETTE } from '../../components/charts/chartPalette'
import {
  clearPortalSession,
  getPortalSession,
  portalAddExam,
  portalDashboard,
  portalExamReport,
  portalSetTaskCompleted,
  type PortalDashboard,
  type PortalExamReportData,
  type PortalTask,
} from '../../lib/portal'

const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

/** ISO tarih + gün indeksinden (0=Pazartesi) o günün tarihini üretir. */
function dayDate(weekStart: string, dayIndex: number): Date {
  const d = new Date(`${weekStart}T00:00:00`)
  d.setDate(d.getDate() + dayIndex)
  return d
}

function formatDayMonth(d: Date): string {
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' })
}

/** Bugünün gün indeksi (0=Pazartesi … 6=Pazar). */
function todayDayIndex(): number {
  return (new Date().getDay() + 6) % 7
}

const card = {
  backgroundColor: '#ffffff',
  borderRadius: 16,
  padding: 18,
  border: '1px solid var(--border)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
} as const

export default function OgrenciPortalPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<PortalDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<PortalNavTab>('my_week')
  const [showExamModal, setShowExamModal] = useState(false)
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
      // Kod koç tarafından değiştirilmiş/silinmiş olabilir → oturumu bırak.
      clearPortalSession()
      setLoadError(res.error)
      setLoading(false)
      return
    }
    if (res.data.role === 'veli') {
      navigate('/veli')
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

  async function toggleTaskCompleted(task: PortalTask) {
    const session = getPortalSession()
    if (!session || !data) return

    const next = !task.completed
    setActionError(null)
    // İyimser güncelleme — sunucu reddederse geri alınıyor.
    const updatedTasks = data.tasks.map((t) => (t.id === task.id ? { ...t, completed: next } : t))
    const updatedCompletedTasks = updatedTasks.filter((t) => t.completed).length

    setData({
      ...data,
      tasks: updatedTasks,
      my_week: data.my_week
        ? {
            ...data.my_week,
            completed_tasks: updatedCompletedTasks,
          }
        : undefined,
    })

    const res = await portalSetTaskCompleted(session.code, task.id, next)
    if (!res.ok) {
      setData((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, completed: !next } : t)),
              my_week: prev.my_week
                ? {
                    ...prev.my_week,
                    completed_tasks: prev.tasks.filter((t) => (t.id === task.id ? !next : t.completed)).length,
                  }
                : undefined,
            }
          : prev
      )
      setActionError(res.error ?? 'Görev güncellenemedi.')
    }
  }

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

  const theme = PORTAL_THEME.ogrenci
  const { student, tasks, exams, week_start, is_current_week, my_week } = data
  const completedCount = my_week?.completed_tasks ?? tasks.filter((t) => t.completed).length
  const totalCount = my_week?.total_tasks ?? tasks.length
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const today = todayDayIndex()
  const curriculum = gradeCurriculum(student.grade)
  const examName = curriculum === 'LGS' ? 'LGS' : 'YKS'

  // Görevleri gün gün grupla; bugün varsa en üste al.
  const days = [...new Set(tasks.map((t) => t.day_index))].sort((a, b) => {
    if (is_current_week) {
      if (a === today) return -1
      if (b === today) return 1
    }
    return a - b
  })

  // Sıradaki odak listesi: my_week.focus_topics varsa o, yoksa tamamlanmamış görev etiketleri
  const focusTopics =
    my_week?.focus_topics && my_week.focus_topics.length > 0
      ? my_week.focus_topics
      : tasks.filter((t) => !t.completed).map((t) => t.label)

  return (
    <div className="portal-page" style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: 90 }}>
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
              👋 {student.full_name}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
              {student.grade}{student.track ? ` · ${student.track}` : ''}
            </div>
          </div>
          <div style={roleBadgeStyle(theme)}>{theme.label}</div>
        </header>
      </div>

      {actionError && (
        <div style={{ margin: '12px 20px 0 20px', padding: 12, borderRadius: 10, backgroundColor: '#fef2f2', color: '#dc2626', fontSize: 13 }}>
          {actionError}
        </div>
      )}

      {week_start && !is_current_week && (
        <div style={{ margin: '16px 20px 0 20px', fontSize: 12, color: '#b45309', backgroundColor: '#fffbeb', padding: '10px 14px', borderRadius: 10, border: '1px solid #fef3c7' }}>
          Bu hafta için henüz program yok. <strong>{formatDayMonth(dayDate(week_start, 0))} – {formatDayMonth(dayDate(week_start, 6))}</strong> haftası gösteriliyor.
        </div>
      )}

      <main style={{ padding: 20 }}>
        {/* ================================================================= */}
        {/* 1. SEKME: HAFTAM                                                  */}
        {/* ================================================================= */}
        {activeTab === 'my_week' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Üst Kart: Sınava Kalan Gün & Hedefe Yolculuk */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-soft)' }}>
                    Hedefe Yolculuk
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginTop: 2 }}>
                    {student.target_program || 'Hedef Program Belirlenmedi'}
                  </div>
                  {student.target_ranking && (
                    <div style={{ fontSize: 12, fontWeight: 600, color: theme.accentStrong, marginTop: 2 }}>
                      Hedef Sıralama: #{student.target_ranking}
                    </div>
                  )}
                </div>

                {my_week?.days_to_exam !== null && my_week?.days_to_exam !== undefined && (
                  <div
                    style={{
                      padding: '6px 12px',
                      borderRadius: 20,
                      backgroundColor: theme.tint,
                      color: theme.tintText,
                      fontWeight: 800,
                      fontSize: 12.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexShrink: 0,
                    }}
                  >
                    <Calendar size={14} />
                    <span>
                      {my_week.days_to_exam > 0
                        ? `${examName}'ye ${my_week.days_to_exam} Gün`
                        : my_week.days_to_exam === 0
                        ? `${examName} Bugün!`
                        : `${examName} Tamamlandı`}
                    </span>
                  </div>
                )}
              </div>

              {/* Hedef Net ve Son Net Karşılaştırma Barı */}
              {(() => {
                const targetNet = my_week?.target_net ?? null
                const isLgsExam = my_week?.latest_exam_type === 'LGS' || curriculum === 'LGS'
                const fallbackNet = exams.length > 0
                  ? (isLgsExam && exams[0].sections ? weightedNet(exams[0].sections) : Number(exams[0].total_net))
                  : null
                const latestNet = my_week?.latest_net ?? fallbackNet
                if (targetNet !== null && targetNet > 0) {
                  const ratio = Math.min(100, Math.max(0, Math.round(((latestNet ?? 0) / targetNet) * 100)))
                  const remainingNet = Math.max(0, Math.round((targetNet - (latestNet ?? 0)) * 10) / 10)
                  return (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>
                          Son Net:{' '}
                          <strong style={{ color: 'var(--ink)', fontSize: 14 }}>
                            {latestNet !== null ? Math.round(latestNet * 10) / 10 : '—'}
                          </strong>
                          {isLgsExam && (
                            <span style={{ fontSize: 10, color: 'var(--ink-faint)', marginLeft: 4 }}>
                              (katsayılı net)
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>
                          Hedef:{' '}
                          <strong style={{ color: theme.accentStrong, fontSize: 14 }}>
                            {targetNet} Net
                          </strong>
                        </span>
                      </div>

                      <div style={{ width: '100%', height: 10, borderRadius: 5, backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${ratio}%`,
                            height: '100%',
                            backgroundColor: ratio >= 100 ? '#10b981' : theme.accent,
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 11, color: 'var(--ink-soft)' }}>
                        <span>Hedef ilerlemesi: %{ratio}</span>
                        {ratio >= 100 ? (
                          <span style={{ color: '#10b981', fontWeight: 700 }}>🎉 Hedefe Ulaşıldı!</span>
                        ) : (
                          <span>
                            Hedefe <strong>{remainingNet}</strong> net kaldı
                          </span>
                        )}
                      </div>
                    </div>
                  )
                }
                return null
              })()}
            </div>

            {/* Görev İlerlemesi */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={16} style={{ color: theme.accentStrong }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                    Görev İlerlemesi
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: theme.accentStrong }}>
                  {completedCount} / {totalCount} Görev Tamamlandı
                </span>
              </div>

              <div style={{ width: '100%', height: 10, borderRadius: 5, backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${completionPct}%`,
                    height: '100%',
                    backgroundColor: completionPct === 100 ? '#10b981' : theme.accent,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>
                <span>%{completionPct} Tamamlandı</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('tasks')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: theme.accentStrong,
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  Programı Aç <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* Bu Hafta İyi Gidenler */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Sparkles size={18} style={{ color: '#eab308' }} />
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                    Bu Hafta İyi Gidenler
                  </h3>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 1 }}>
                    Haftalık görevlerde %70 ve üzeri doğruluk sağlanan konular
                  </div>
                </div>
              </div>

              {my_week?.improved_topics && my_week.improved_topics.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {my_week.improved_topics.map((item, idx) => (
                    <div
                      key={`${item.topic_name}-${idx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                          {item.topic_name}
                        </div>
                        {item.subject_name && (
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                            {item.subject_name}
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          fontSize: 11,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        ↑ Gelişti
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', textAlign: 'center', padding: '16px 8px', lineHeight: 1.5 }}>
                  Bu hafta tamamlanan testler analiz edildikçe gelişim gösterdiğin konular burada listelenecek. ✨
                </div>
              )}
            </div>

            {/* Sıradaki Odak */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Target size={18} style={{ color: theme.accentStrong }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                  Sıradaki Odak
                </h3>
              </div>

              {focusTopics.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {focusTopics.map((topicName, idx) => (
                    <div
                      key={`${topicName}-${idx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 10,
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: theme.accent,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                        {topicName}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', textAlign: 'center', padding: '16px 8px', lineHeight: 1.5 }}>
                  Bu hafta için bekleyen odak konusu kalmadı! Harika gidiyorsun. 🎉
                </div>
              )}
            </div>

            {/* Koçunun Notu */}
            {my_week?.coach_latest_note && my_week.coach_latest_note.trim() && (
              <div
                style={{
                  ...card,
                  borderLeft: `4px solid ${theme.accent}`,
                  backgroundColor: '#faf5ff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageSquareQuote size={18} style={{ color: theme.accentStrong }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: theme.accentStrong }}>
                    Koçunun Notu
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13.5, color: '#1e1b4b', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {my_week.coach_latest_note}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 2. SEKME: PROGRAM (GÖREVLER)                                      */}
        {/* ================================================================= */}
        {activeTab === 'tasks' && (
          <div>
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
                  Haftalık Program İlerlemesi
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: theme.accentStrong }}>%{completionPct}</span>
              </div>

              <div style={{ width: '100%', height: 10, borderRadius: 5, backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${completionPct}%`,
                    height: '100%',
                    backgroundColor: theme.accent,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-soft)', display: 'flex', gap: 12 }}>
                <span>Tamamlanan: <strong>{completedCount}</strong></span>
                <span>Bekleyen: <strong>{totalCount - completedCount}</strong></span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Program Görevlerim</h3>
              <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{tasks.length} Görev</span>
            </div>

            {tasks.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>
                Koçun henüz sana bir program atamadı.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {days.map((dayIndex) => {
                  const isToday = is_current_week && dayIndex === today
                  const dayTasks = tasks.filter((t) => t.day_index === dayIndex)
                  return (
                    <div key={dayIndex}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 8,
                          fontSize: 13,
                          fontWeight: 700,
                          color: isToday ? theme.accentStrong : 'var(--ink-soft)',
                        }}
                      >
                        <span>{DAY_NAMES[dayIndex]}</span>
                        {week_start && (
                          <span style={{ fontWeight: 500, fontSize: 12, color: 'var(--ink-soft)' }}>
                            {formatDayMonth(dayDate(week_start, dayIndex))}
                          </span>
                        )}
                        {isToday && (
                          <span style={{ padding: '2px 8px', borderRadius: 12, backgroundColor: theme.tint, color: theme.tintText, fontSize: 11 }}>
                            Bugün
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {dayTasks.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleTaskCompleted(t)}
                            style={{
                              backgroundColor: '#ffffff',
                              borderRadius: 14,
                              padding: '14px 16px',
                              border: isToday ? `1px solid ${theme.accent}` : '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 14,
                              cursor: 'pointer',
                              textAlign: 'left',
                              width: '100%',
                              opacity: t.completed ? 0.65 : 1,
                            }}
                          >
                            {t.completed ? (
                              <CheckCircle2 size={24} style={{ color: '#10b981', flexShrink: 0 }} />
                            ) : (
                              <Circle size={24} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                            )}

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 14,
                                  fontWeight: 600,
                                  color: 'var(--ink)',
                                  textDecoration: t.completed ? 'line-through' : 'none',
                                }}
                              >
                                {t.label}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {t.subject_name && <span>{t.subject_name}</span>}
                                {t.question_count > 0 && <span>Hedef: {t.question_count} soru</span>}
                                {t.is_exam && <span style={{ color: theme.accentStrong, fontWeight: 700 }}>Deneme</span>}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 3. SEKME: DENEMELER                                               */}
        {/* ================================================================= */}
        {activeTab === 'exams' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 4, background: '#e2e8f0', padding: 3, borderRadius: 10 }}>
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
                    background: examSubTab === 'analysis' ? '#ffffff' : 'transparent',
                    color: examSubTab === 'analysis' ? theme.accentStrong : 'var(--ink-soft)',
                    boxShadow: examSubTab === 'analysis' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Analiz & Karne
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
                    background: examSubTab === 'list' ? '#ffffff' : 'transparent',
                    color: examSubTab === 'list' ? theme.accentStrong : 'var(--ink-soft)',
                    boxShadow: examSubTab === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  Deneme Listesi ({exams.length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowExamModal(true)}
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Plus size={14} /> Deneme Ekle
              </button>
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
                    role="student"
                    palette={PORTAL_STUDENT_PALETTE}
                    initialCatalog={examReportData.catalog}
                    initialExams={examReportData.exams}
                  />
                  <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11.5, color: '#8A86A3', padding: '12px 16px' }}>
                    Sayılar girilen deneme sonuçlarından hesaplanır; konusu girilmemiş denemeler konu analizinde yer almaz.
                  </div>
                </div>
              ) : (
                <div style={{ ...card, textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>
                  Henüz kayıtlı deneme karnesi bulunmuyor. "Deneme Ekle" ile sonucunu kaydedebilirsin.
                </div>
              )
            ) : (
              exams.length === 0 ? (
                <div style={{ ...card, textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>
                  Henüz kayıtlı deneme yok. "Deneme Ekle" ile ilk sonucunu gir.
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
                              {e.publisher ? ` · ${e.publisher}` : ''} · {e.exam_date}
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

        {/* Hedefler sekmesi yedek olarak tutuluyor (tab doğrudan çağrılırsa) */}
        {activeTab === 'goals' && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Hedeflerim & Bilgilerim</h3>
            <div style={{ ...card, marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>HEDEF BÖLÜM / ÜNİVERSİTE</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginTop: 4 }}>
                {student.target_program || 'Henüz hedef belirtilmedi'}
              </div>
              {student.target_ranking && (
                <div style={{ fontSize: 13, color: theme.accentStrong, fontWeight: 700, marginTop: 4 }}>
                  Hedef Sıralama: #{student.target_ranking}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {showExamModal && (
        <AddExamModal
          grade={student.grade}
          track={student.track}
          onClose={() => setShowExamModal(false)}
          onSaved={() => {
            setShowExamModal(false)
            load()
            loadExamReport()
          }}
        />
      )}

      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} role="ogrenci" onLogout={handleLogout} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Deneme ekleme — koç ekranıyla aynı bölüm şablonu (src/lib/examSections.ts),
// böylece öğrencinin girdiği deneme koç tarafında da netleriyle görünür.
// ---------------------------------------------------------------------------
function AddExamModal({
  grade,
  track,
  onClose,
  onSaved,
}: {
  grade: PortalDashboard['student']['grade']
  track: PortalDashboard['student']['track']
  onClose: () => void
  onSaved: () => void
}) {
  // Görünürlüğün tek kaynağı src/lib/curriculum.ts: 7./8. sınıf LGS, geri kalanı YKS.
  const curriculum = gradeCurriculum(grade)
  const [name, setName] = useState('')
  const [publisher, setPublisher] = useState('')
  const [examType, setExamType] = useState<ExamType>(curriculum === 'LGS' ? 'LGS' : 'TYT')
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0])
  const [scores, setScores] = useState<Record<string, { correct: number; wrong: number }>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sections = getExamSections(examType, track)

  function scoreOf(sectionName: string) {
    return scores[sectionName] ?? { correct: 0, wrong: 0 }
  }

  function setScore(sectionName: string, field: 'correct' | 'wrong', value: number) {
    setScores((prev) => ({
      ...prev,
      [sectionName]: { ...scoreOf(sectionName), [field]: Math.max(0, value) },
    }))
  }

  const totalNet = sections.reduce((acc, s) => {
    const { correct, wrong } = scoreOf(s.name)
    return acc + sectionNet(correct, wrong, examType)
  }, 0)

  // LGS'te gerçek puan (500'lük) hesaplanamaz (istatistik gerektirir) — ders
  // katsayılarıyla tartılmış NET gösterilir, asla "puan" denmez.
  const weightedNetTotal =
    examType === 'LGS'
      ? weightedNet(
          sections.map((s) => {
            const { correct, wrong } = scoreOf(s.name)
            return { section_name: s.name, net: sectionNet(correct, wrong, examType) }
          })
        )
      : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const session = getPortalSession()
    if (!session) return

    // Sunucu da aynı kontrolü yapıyor; burada hemen geri bildirim veriyoruz.
    const invalid = sections.find((s) => {
      const { correct, wrong } = scoreOf(s.name)
      return correct + wrong > s.max
    })
    if (invalid) {
      setError(`${invalid.name}: doğru + yanlış toplamı ${invalid.max} soruyu aşamaz.`)
      return
    }

    setSaving(true)
    setError(null)
    const res = await portalAddExam(session.code, {
      name: name.trim(),
      publisher: publisher.trim() || null,
      exam_type: examType,
      exam_date: examDate,
      sections: sections.map((s) => {
        const { correct, wrong } = scoreOf(s.name)
        return {
          section_name: s.name,
          max_questions: s.max,
          correct_count: correct,
          wrong_count: wrong,
          blank_count: Math.max(0, s.max - correct - wrong),
        }
      }),
    })
    setSaving(false)

    if (!res.ok) {
      setError(res.error ?? 'Deneme kaydedilemedi.')
      return
    }
    onSaved()
  }

  const input = {
    width: '100%',
    padding: 10,
    borderRadius: 8,
    border: '1px solid var(--border)',
    // 16px ŞART: iOS Safari daha küçük bir alana odaklanınca sayfayı
    // kendiliğinden yakınlaştırıyor ve geri uzaklaştırmıyor. Deneme girişinde
    // her kutuya dokunuşta ekran zıplıyordu.
    fontSize: 16,
  } as const

  return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ maxWidth: 420, width: '92%', maxHeight: '88vh', overflowY: 'auto' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Yeni Deneme Gir</h3>

        {error && (
          <div style={{ padding: 10, borderRadius: 8, backgroundColor: '#fef2f2', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Sınav Adı</label>
            <input type="text" required placeholder="Örn: Özdebir TYT 3" value={name} onChange={(e) => setName(e.target.value)} style={input} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Sınav Türü</label>
              <select value={examType} onChange={(e) => setExamType(e.target.value as ExamType)} style={input}>
                {curriculum === 'LGS' ? (
                  <option value="LGS">LGS</option>
                ) : (
                  <>
                    <option value="TYT">TYT</option>
                    <option value="AYT">AYT</option>
                  </>
                )}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Tarih</label>
              <input
                type="date"
                required
                value={examDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setExamDate(e.target.value)}
                style={input}
              />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Yayın (opsiyonel)</label>
            <input type="text" placeholder="Örn: 3D Yayınları" value={publisher} onChange={(e) => setPublisher(e.target.value)} style={input} />
          </div>

          <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>
            BÖLÜM SONUÇLARI
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {sections.map((s) => {
              const { correct, wrong } = scoreOf(s.name)
              const net = sectionNet(correct, wrong, examType)
              return (
                <div key={s.name} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      {s.max} soru{s.katsayi ? ` · katsayı ${s.katsayi}` : ''} · net <strong style={{ color: 'var(--indigo-600)' }}>{Math.round(net * 100) / 100}</strong>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <label style={{ flex: 1, fontSize: 11, color: 'var(--ink-soft)' }}>
                      Doğru
                      <input
                        type="number"
                        min={0}
                        max={s.max}
                        value={correct}
                        onChange={(e) => setScore(s.name, 'correct', Number(e.target.value))}
                        style={{ ...input, padding: 8 }}
                      />
                    </label>
                    <label style={{ flex: 1, fontSize: 11, color: 'var(--ink-soft)' }}>
                      Yanlış
                      <input
                        type="number"
                        min={0}
                        max={s.max}
                        value={wrong}
                        onChange={(e) => setScore(s.name, 'wrong', Number(e.target.value))}
                        style={{ ...input, padding: 8 }}
                      />
                    </label>
                    <div style={{ flex: 1, fontSize: 11, color: 'var(--ink-soft)' }}>
                      Boş
                      <div style={{ ...input, padding: 8, backgroundColor: '#f8fafc', color: 'var(--ink-soft)' }}>
                        {Math.max(0, s.max - correct - wrong)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: PORTAL_THEME.ogrenci.tint, borderRadius: 10, marginBottom: weightedNetTotal !== null ? 8 : 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Toplam Net</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: PORTAL_THEME.ogrenci.accentStrong }}>
              {Math.round(totalNet * 100) / 100}
            </span>
          </div>
          {weightedNetTotal !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>Ağırlıklı Net (LGS puanı değildir)</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>
                {Math.round(weightedNetTotal * 100) / 100}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }} disabled={saving}>
              İptal
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
