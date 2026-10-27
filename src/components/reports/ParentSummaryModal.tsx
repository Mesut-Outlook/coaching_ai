import { useState, useEffect, useMemo } from 'react'
import { X, MessageCircle, Copy, Check, AlertTriangle, ShieldCheck, HeartHandshake } from 'lucide-react'
import { openWhatsAppChat } from '../../lib/whatsapp'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import {
  generateParentSupportTips,
  computeSummaryStats,
  formatWeekRangeFromKey,
  formatOpenedAtStamp,
  buildParentSummaryWhatsAppMessage,
  recordParentSummaryWhatsAppLog,
  getLatestParentSummaryLog,
  getDefaultWeekStart,
  type SummaryStudentInfo,
  type SummaryStats,
} from '../../lib/parentSummary'
import type { AttendanceRecord, MockExam, Student, WeeklyTask } from '../../types/database'
import type { PortalAttendance, PortalExam, PortalStudent, PortalTask } from '../../lib/portal'
import { weightedNet } from '../../lib/examSections'

export type ParentSummaryModalProps = {
  isOpen: boolean
  onClose: () => void
  student: Student | PortalStudent | SummaryStudentInfo
  weekStart?: string
  weeklyTasks?: Array<WeeklyTask | PortalTask>
  latestExam?: MockExam | PortalExam | null
  previousExam?: MockExam | PortalExam | null
  attendanceRecords?: Array<AttendanceRecord | PortalAttendance>
  targetNet?: number | null
}

export default function ParentSummaryModal({
  isOpen,
  onClose,
  student,
  weekStart: initialWeekStart,
  weeklyTasks: propTasks,
  latestExam: propLatestExam,
  previousExam: propPreviousExam,
  attendanceRecords: propAttendance,
  targetNet: propTargetNet,
}: ParentSummaryModalProps) {
  const activeWeekStart = initialWeekStart ?? getDefaultWeekStart()
  const weekRangeText = formatWeekRangeFromKey(activeWeekStart)

  // Local data state if props are not fully passed
  const [tasks, setTasks] = useState<Array<WeeklyTask | PortalTask>>(propTasks ?? [])
  const [latestExam, setLatestExam] = useState<MockExam | PortalExam | null>(propLatestExam ?? null)
  const [previousExam, setPreviousExam] = useState<MockExam | PortalExam | null>(propPreviousExam ?? null)
  const [attendance, setAttendance] = useState<Array<AttendanceRecord | PortalAttendance>>(propAttendance ?? [])
  const [dataLoading, setDataLoading] = useState(false)

  // Coach Note (persisted to localStorage per student & week)
  const storageKey = `parent_summary_note_${student.id}_${activeWeekStart}`
  const [coachNote, setCoachNote] = useState<string>(() => {
    try {
      return localStorage.getItem(storageKey) || ''
    } catch {
      return ''
    }
  })

  // WhatsApp opened stamp
  const [lastOpenedAt, setLastOpenedAt] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)

  // Load missing data from Supabase if needed
  useEffect(() => {
    if (!isOpen || !student.id || !isSupabaseConfigured) return

    let cancelled = false

    const loadMissing = async () => {
      setDataLoading(true)
      try {
        const promises: Promise<unknown>[] = []

        // 1. WhatsApp son açılma damgasını kontrol et
        promises.push((async () => {
          const ts = await getLatestParentSummaryLog(student.id, activeWeekStart)
          if (!cancelled) setLastOpenedAt(ts)
        })())

        // 2. Görevler eksikse çek
        if (!propTasks) {
          promises.push((async () => {
            const { data } = await supabase
              .from('weekly_tasks')
              .select('*')
              .eq('student_id', student.id)
              .eq('week_start', activeWeekStart)
              .eq('block_kind', 'ders')
              .order('day_index', { ascending: true })
            if (!cancelled && data) setTasks(data)
          })())
        } else {
          setTasks(propTasks)
        }

        // 3. Denemeler eksikse son 2 denemeyi bölümleriyle birlikte çek
        if (propLatestExam === undefined) {
          promises.push((async () => {
            const { data } = await supabase
              .from('mock_exams')
              .select('*, mock_exam_sections(section_name, net)')
              .eq('student_id', student.id)
              .order('exam_date', { ascending: false })
              .limit(2)
            if (!cancelled && data) {
              const enrich = (raw: any) => {
                if (!raw) return null
                const secs = (raw.mock_exam_sections || []).map((s: any) => ({
                  section_name: s.section_name,
                  net: Number(s.net) || 0,
                }))
                const isLgs = raw.exam_type === 'LGS'
                const totalNet = isLgs ? weightedNet(secs) : secs.reduce((sum: number, s: any) => sum + s.net, 0)
                return {
                  ...raw,
                  total_net: Math.round(totalNet * 100) / 100,
                }
              }
              setLatestExam(enrich(data[0]))
              setPreviousExam(enrich(data[1]))
            }
          })())
        } else {
          setLatestExam(propLatestExam)
          setPreviousExam(propPreviousExam ?? null)
        }

        // 4. Devamsızlık eksikse çek
        if (!propAttendance) {
          promises.push((async () => {
            const { data } = await supabase
              .from('attendance_records')
              .select('*')
              .eq('student_id', student.id)
            if (!cancelled && data) setAttendance(data)
          })())
        } else {
          setAttendance(propAttendance)
        }

        await Promise.all(promises)
      } catch (err) {
        console.error('ParentSummaryModal data loading error:', err)
      } finally {
        if (!cancelled) setDataLoading(false)
      }
    }

    loadMissing()

    return () => {
      cancelled = true
    }
  }, [isOpen, student.id, activeWeekStart, propTasks, propLatestExam, propPreviousExam, propAttendance])

  // Save coach note to localStorage
  const handleCoachNoteChange = (text: string) => {
    setCoachNote(text)
    try {
      localStorage.setItem(storageKey, text)
    } catch {
      // ignore
    }
  }

  // Resolved target net
  const studentTargetNet =
    'target_net_value' in student
      ? (student as { target_net_value?: number | null }).target_net_value
      : 'target_net_tyt' in student
        ? (student as { target_net_tyt?: number | null }).target_net_tyt
        : null

  const resolvedTargetNet =
    propTargetNet !== undefined ? propTargetNet : studentTargetNet ?? null

  // Compute summary stats
  const stats: SummaryStats = useMemo(() => {
    return computeSummaryStats({
      tasks,
      latestExam,
      previousExam,
      attendanceRecords: attendance,
      targetNet: resolvedTargetNet,
    })
  }, [tasks, latestExam, previousExam, attendance, resolvedTargetNet])

  // Generate support tips
  const tips = useMemo(() => {
    return generateParentSupportTips({
      completionPct: stats.completionPct,
      hasSignificantExamDrop: stats.hasExamDrop,
      hasAttendanceIssue: stats.attendanceCount > 0,
    })
  }, [stats])

  // Build WhatsApp message
  const whatsappMessage = useMemo(() => {
    return buildParentSummaryWhatsAppMessage({
      studentName: student.full_name,
      weekRangeText,
      stats,
      tips,
      coachNote,
    })
  }, [student.full_name, weekRangeText, stats, tips, coachNote])

  // Handle WhatsApp Open
  const handleOpenWhatsApp = async () => {
    const parentPhone =
      'parent_phone_number' in student
        ? (student as { parent_phone_number?: string | null }).parent_phone_number
        : null
    if (!parentPhone || !parentPhone.trim()) {
      alert(
        'Bu öğrencinin veli telefon numarası girilmemiş. Lütfen önce Öğrenciler sayfasından öğrenciyi düzenleyerek veli telefonunu kaydedin.'
      )
      return
    }

    setSending(true)
    try {
      // 1. WhatsApp penceresini aç
      openWhatsAppChat(parentPhone, whatsappMessage)

      // 2. parent_summary_log tablosuna log kaydet
      const res = await recordParentSummaryWhatsAppLog(student.id, activeWeekStart)
      if (res.ok && res.openedAt) {
        setLastOpenedAt(res.openedAt)
      } else {
        // Fallback: Yerel zaman damgasını göster
        setLastOpenedAt(new Date().toISOString())
      }
    } catch (err) {
      console.error('WhatsApp açma hatası:', err)
      setLastOpenedAt(new Date().toISOString())
    } finally {
      setSending(false)
    }
  }

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('Mesaj panoya kopyalanamadı.')
    }
  }

  if (!isOpen) return null

  const parentPhoneVal =
    'parent_phone_number' in student
      ? (student as { parent_phone_number?: string | null }).parent_phone_number
      : null
  const hasParentPhone = Boolean(parentPhoneVal && parentPhoneVal.trim())

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(15, 29, 33, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        overflowY: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="parent-summary-title"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg, 18px)',
          boxShadow: 'var(--shadow-pop)',
          width: '100%',
          maxWidth: 620,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease',
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: 'var(--surface)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--indigo-600)', textTransform: 'uppercase' }}>
              <MessageCircle size={14} /> Veli Bilgilendirme
            </div>
            <h2 id="parent-summary-title" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', margin: '2px 0 0 0' }}>
              {student.full_name} · Haftalık Özet
            </h2>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
              {weekRangeText}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Kapat"
            style={{ padding: 6, borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </header>

        {/* Scrollable Body */}
        <div
          style={{
            padding: 20,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {dataLoading && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', textAlign: 'center', padding: '6px 0' }}>
              Veriler güncelleniyor…
            </div>
          )}

          {/* Haftalık Metrikler Özeti */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}
          >
            <div
              style={{
                background: 'var(--surface-alt)',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--radius-sm, 10px)',
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
                Görevler
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginTop: 2 }}>
                %{stats.completionPct}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                {stats.completedCount} / {stats.totalCount} bitti
              </div>
            </div>

            <div
              style={{
                background: 'var(--surface-alt)',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--radius-sm, 10px)',
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
                Son Deneme
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginTop: 2 }}>
                {stats.latestExamNet != null ? `${Math.round(stats.latestExamNet * 100) / 100} net` : '—'}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {stats.latestExamName ?? (stats.targetNet != null ? `Hedef ${stats.targetNet}` : 'Girilmedi')}
              </div>
            </div>

            <div
              style={{
                background: 'var(--surface-alt)',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--radius-sm, 10px)',
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
                Devamsızlık
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: stats.unexcusedAttendanceCount > 0 ? 'var(--critical-text)' : 'var(--success-text)',
                  marginTop: 2,
                }}
              >
                {stats.attendanceCount === 0 ? '0 kayıt' : `${stats.attendanceCount} kayıt`}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                {stats.unexcusedAttendanceCount > 0 ? `${stats.unexcusedAttendanceCount} mazeretsiz` : 'Sorun yok'}
              </div>
            </div>
          </div>

          {/* Kural Tabanlı: Evde Nasıl Destek Olabilirsiniz? */}
          <div
            style={{
              background: 'var(--surface-alt)',
              border: '1px solid var(--border-soft)',
              borderRadius: 'var(--radius-md, 12px)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
              <HeartHandshake size={16} style={{ color: 'var(--indigo-600)' }} />
              <span>Evde Nasıl Destek Olabilirsiniz? (Otomatik Öneri)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tips.map((tip, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.4 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 17,
                      height: 17,
                      borderRadius: '50%',
                      background: 'var(--indigo-050)',
                      color: 'var(--indigo-600)',
                      fontSize: 10.5,
                      fontWeight: 800,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Koçun Serbest Not Alanı */}
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6, display: 'block' }}>
              Koç Notu (İsteğe Bağlı)
            </label>
            <textarea
              rows={3}
              value={coachNote}
              onChange={(e) => handleCoachNoteChange(e.target.value)}
              placeholder="Veliye iletmek istediğiniz kişiselleştirilmiş not, gözlem veya teşekkür..."
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm, 9px)',
                background: 'var(--surface)',
                color: 'var(--ink)',
                fontSize: 13,
                lineHeight: 1.45,
                resize: 'vertical',
              }}
            />
          </div>

          {/* WhatsApp Mesaj Önizlemesi */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>
                Mesaj Önizlemesi
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCopyMessage}
                style={{ fontSize: 11, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                {copied ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                <span>{copied ? 'Kopyalandı' : 'Metni Kopyala'}</span>
              </button>
            </div>
            <div
              style={{
                background: 'var(--surface-alt)',
                border: '1px solid var(--border-soft)',
                borderRadius: 'var(--radius-sm, 9px)',
                padding: '12px 14px',
                fontSize: 12,
                color: 'var(--ink)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.45,
                maxHeight: 160,
                overflowY: 'auto',
                fontFamily: 'inherit',
              }}
            >
              {whatsappMessage}
            </div>
          </div>

          {/* Veli Telefon Uyarısı */}
          {!hasParentPhone && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm, 9px)',
                background: 'var(--warning-bg)',
                color: 'var(--warning-text)',
                fontSize: 12.5,
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>
                Velinin telefon numarası kayıtlı değil. WhatsApp ile doğrudan göndermek için lütfen öğrenci profilinden veli telefonunu kaydedin.
              </span>
            </div>
          )}

          {/* WhatsApp Açıldı Damgası */}
          {lastOpenedAt && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 20,
                background: 'var(--success-bg)',
                color: 'var(--success-text)',
                fontSize: 12.5,
                fontWeight: 700,
                alignSelf: 'flex-start',
              }}
            >
              <ShieldCheck size={15} />
              <span>WhatsApp açıldı · {formatOpenedAtStamp(lastOpenedAt)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: 'var(--surface)',
          }}
        >
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ fontSize: 13 }}>
            Kapat
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenWhatsApp}
              disabled={sending}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                background: 'var(--success)',
                borderColor: 'var(--success)',
                color: 'var(--on-primary, #ffffff)',
              }}
            >
              <MessageCircle size={16} />
              <span>{sending ? 'Açılıyor…' : "WhatsApp'ta Aç"}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
