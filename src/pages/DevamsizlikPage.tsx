import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, MoreVertical, MessageCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { fetchStudents } from '../lib/students'
import { useAccess } from '../contexts/AccessContext'
import PageHeader from '../components/layout/PageHeader'
import Sparkline from '../components/charts/Sparkline'
import AddAbsenceModal from '../components/attendance/AddAbsenceModal'
import { openWhatsAppChat } from '../lib/whatsapp'
import {
  ABSENCE_ALERT_THRESHOLDS,
  EXCUSE_LABELS,
  NOTIFY_TARGET_LABELS,
  SESSION_LABELS,
  STATUS_LABELS,
  buildParentSummaryMessage,
  formatDateTr,
  formatTimestampDayMonthTr,
  isoDaysAgo,
  monthlyBuckets,
  planAttendanceNotification,
  todayIso,
} from '../lib/attendance'
import type { AttendanceRecord, NotifyTarget, SessionType, Student } from '../types/database'

type ActiveTab = 'kayitlar' | 'ozet'
type ExcuseFilter = 'hepsi' | 'mazeretli' | 'mazeretsiz'

// attendance_records küçük ölçekli bir tablo (koç bazlı) ama proje genelinde
// keşfedilen Supabase 1000 satır cap'ine (bkz. coordination.md) karşı burada da
// tedbir alınıyor: tüm kayıtlar sayfalanarak (range) çekiliyor, tek sorguya güvenilmiyor.
async function fetchAllAttendanceRecords(): Promise<AttendanceRecord[]> {
  const pageSize = 1000
  let all: AttendanceRecord[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .order('absence_date', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

interface StudentSummary {
  student: Student
  total: number
  unexcused: number
  last30Count: number
  last30Unexcused: number
  lastDate: string | null
  monthly: number[]
  needsAttention: boolean
  records: AttendanceRecord[]
}

export default function DevamsizlikPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { studentScope } = useAccess()

  const [students, setStudents] = useState<Student[]>([])
  const [allRecords, setAllRecords] = useState<AttendanceRecord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<ActiveTab>('kayitlar')

  // Kayıtlar sekmesi filtreleri
  const [filterStudentId, setFilterStudentId] = useState(searchParams.get('studentId') || '')
  const [dateFrom, setDateFrom] = useState(() => isoDaysAgo(90))
  const [dateTo, setDateTo] = useState(() => todayIso())
  const [excuseFilter, setExcuseFilter] = useState<ExcuseFilter>('hepsi')
  const [sessionFilter, setSessionFilter] = useState<'hepsi' | SessionType>('hepsi')

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null)
  const [menuOpenRecordId, setMenuOpenRecordId] = useState<string | null>(null)
  // Satır menüsü `position: fixed` ile açılır: tablo kabında `overflowX: auto` var,
  // bu da dikey eksende taşmayı kırpıyordu (az satır varken "Sil" ulaşılamıyordu).
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | null>(null)
  const [notifyRecord, setNotifyRecord] = useState<AttendanceRecord | null>(null)

  // Öğrenci Özeti sekmesi
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)

  const handleStudentFilterChange = (id: string) => {
    setFilterStudentId(id)
    if (id) setSearchParams({ studentId: id })
    else setSearchParams({})
  }

  const loadAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [studentsData, records] = await Promise.all([
        fetchStudents({ activeOnly: true, orderBy: 'full_name', ...studentScope }),
        fetchAllAttendanceRecords(),
      ])
      setStudents(studentsData)
      setAllRecords(records)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Devamsızlık verileri yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    loadAll()
  }, [studentScope])

  const studentById = useMemo(() => {
    const map = new Map<string, Student>()
    students.forEach((s) => map.set(s.id, s))
    return map
  }, [students])

  // ---- Kayıtlar sekmesi: filtrelenmiş liste ----
  const displayRecords = useMemo(() => {
    if (!allRecords) return []
    return allRecords
      .filter((r) => {
        if (filterStudentId && r.student_id !== filterStudentId) return false
        if (dateFrom && r.absence_date < dateFrom) return false
        if (dateTo && r.absence_date > dateTo) return false
        if (excuseFilter === 'mazeretli' && r.excuse_type === 'yok') return false
        if (excuseFilter === 'mazeretsiz' && r.excuse_type !== 'yok') return false
        if (sessionFilter !== 'hepsi' && r.session_type !== sessionFilter) return false
        return true
      })
      .sort((a, b) => (a.absence_date < b.absence_date ? 1 : a.absence_date > b.absence_date ? -1 : 0))
  }, [allRecords, filterStudentId, dateFrom, dateTo, excuseFilter, sessionFilter])

  // ---- Üstteki 4 özet kutusu (global, filtreden bağımsız) ----
  const summaryBoxes = useMemo(() => {
    if (!allRecords) return null
    const monthKey = todayIso().slice(0, 7)
    const thisMonth = allRecords.filter((r) => r.absence_date.slice(0, 7) === monthKey)
    const thisMonthUnexcused = thisMonth.filter((r) => r.excuse_type === 'yok')
    const unnotifiedCount = allRecords.filter((r) => !r.notified_at).length

    const last30 = isoDaysAgo(30)
    const recentByStudent = new Map<string, number>()
    allRecords
      .filter((r) => r.absence_date >= last30)
      .forEach((r) => recentByStudent.set(r.student_id, (recentByStudent.get(r.student_id) ?? 0) + 1))

    let topStudentId: string | null = null
    let topCount = 0
    recentByStudent.forEach((count, sid) => {
      if (count > topCount) {
        topCount = count
        topStudentId = sid
      }
    })

    return {
      monthTotal: thisMonth.length,
      monthUnexcused: thisMonthUnexcused.length,
      unnotifiedCount,
      topStudentName: topStudentId ? studentById.get(topStudentId)?.full_name ?? null : null,
      topStudentCount: topCount,
    }
  }, [allRecords, studentById])

  // ---- Öğrenci Özeti sekmesi ----
  const studentSummaries = useMemo<StudentSummary[]>(() => {
    if (!allRecords) return []
    const last30 = isoDaysAgo(30)
    return students
      .filter((s) => s.is_active)
      .map((student) => {
        const records = allRecords
          .filter((r) => r.student_id === student.id)
          .sort((a, b) => (a.absence_date < b.absence_date ? 1 : a.absence_date > b.absence_date ? -1 : 0))
        const total = records.length
        const unexcused = records.filter((r) => r.excuse_type === 'yok').length
        const last30Records = records.filter((r) => r.absence_date >= last30)
        const last30Count = last30Records.length
        const last30Unexcused = last30Records.filter((r) => r.excuse_type === 'yok').length
        const lastDate = records.length ? records[0].absence_date : null
        const needsAttention =
          last30Count >= ABSENCE_ALERT_THRESHOLDS.last30DaysTotal ||
          last30Unexcused >= ABSENCE_ALERT_THRESHOLDS.last30DaysUnexcused

        return {
          student,
          total,
          unexcused,
          last30Count,
          last30Unexcused,
          lastDate,
          monthly: monthlyBuckets(records, 6),
          needsAttention,
          records,
        }
      })
      .sort((a, b) => b.unexcused - a.unexcused || b.total - a.total)
  }, [allRecords, students])

  // ---- CRUD ve bildirim ----
  const handleSaved = (record: AttendanceRecord, opts?: { promptNotify?: boolean }) => {
    setAllRecords((prev) => {
      if (!prev) return [record]
      const exists = prev.some((r) => r.id === record.id)
      return exists ? prev.map((r) => (r.id === record.id ? record : r)) : [record, ...prev]
    })
    setShowAddModal(false)
    setEditingRecord(null)
    if (opts?.promptNotify) setNotifyRecord(record)
  }

  const handleDeleteRecord = async (id: string) => {
    setMenuOpenRecordId(null)
    if (!window.confirm('Bu devamsızlık kaydını silmek istediğinize emin misiniz?')) return
    setAllRecords((prev) => (prev ? prev.filter((r) => r.id !== id) : prev))
    try {
      const { error: delError } = await supabase.from('attendance_records').delete().eq('id', id)
      if (delError) throw delError
    } catch {
      alert('Kayıt silinemedi.')
      loadAll()
    }
  }

  const handleSendWhatsApp = (record: AttendanceRecord, recipient: NotifyTarget) => {
    setNotifyRecord(null)
    const student = studentById.get(record.student_id)
    if (!student) return

    const plan = planAttendanceNotification(record, student, recipient)
    if (plan.missing.length > 0) {
      alert(
        `Bu öğrencinin ${plan.missing.join(' ve ')} telefon numarası girilmemiş. Lütfen önce Öğrenciler sayfasından öğrenciyi düzenleyerek telefon numarasını kaydedin.`
      )
      return
    }

    const recipientLabel = recipient === 'ogrenci' ? 'öğrenciye' : recipient === 'veli' ? 'veliye' : 'öğrenciye ve veliye'
    const confirmSend = window.confirm(
      `${recipientLabel.charAt(0).toUpperCase() + recipientLabel.slice(1)} WhatsApp üzerinden devamsızlık bildirimi göndermek için "Tamam"a basın — sohbet penceresi/pencereleri açılacaktır.` +
        (recipient === 'ikisi'
          ? '\n\nİki sohbet penceresi açılacağı için tarayıcınız pop-up engelleyebilir — izin vermeniz gerekebilir.'
          : '')
    )
    if (!confirmSend) return

    if (plan.wantsStudent && plan.studentMessage && student.phone_number) {
      openWhatsAppChat(student.phone_number, plan.studentMessage)
    }
    if (plan.wantsParent && plan.parentMessage && student.parent_phone_number) {
      openWhatsAppChat(student.parent_phone_number, plan.parentMessage)
    }

    const notifiedAt = new Date().toISOString()
    setAllRecords((prev) =>
      prev ? prev.map((r) => (r.id === record.id ? { ...r, notified_at: notifiedAt, notified_to: recipient } : r)) : prev
    )
    supabase
      .from('attendance_records')
      .update({ notified_at: notifiedAt, notified_to: recipient })
      .eq('id', record.id)
      .then(({ error: updError }) => {
        if (updError) console.error('Bildirim damgası kaydedilemedi:', updError)
      })
  }

  const handleSendParentSummary = (summary: StudentSummary) => {
    const student = summary.student
    if (!student.parent_phone_number) {
      alert('Bu öğrencinin veli telefon numarası girilmemiş. Lütfen önce Öğrenciler sayfasından kaydedin.')
      return
    }
    if (summary.total === 0 || !summary.lastDate) return

    const oldestDate = summary.records[summary.records.length - 1].absence_date
    const message = buildParentSummaryMessage(
      student.full_name,
      formatDateTr(oldestDate),
      formatDateTr(todayIso()),
      summary.total,
      summary.unexcused,
      formatDateTr(summary.lastDate)
    )
    const confirmSend = window.confirm('Veliye WhatsApp üzerinden devamsızlık özeti göndermek için "Tamam"a basın.')
    if (!confirmSend) return
    openWhatsAppChat(student.parent_phone_number, message)
  }

  return (
    <section className="screen">
      <PageHeader
        title="Devamsızlık"
        subtitle="Öğrenci devamsızlıklarını kaydet, gerektiğinde öğrenciye ve veliye WhatsApp ile bildir."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> Devamsızlık Ekle
          </button>
        }
      />

      {!isSupabaseConfigured && (
        <div className="card" style={{ padding: 16, marginBottom: 20, background: 'var(--warning-bg)', border: 'none', color: 'var(--warning-text)', fontSize: 13 }}>
          Supabase bağlı değil — Lütfen Supabase yapılandırmasını tamamlayın.
        </div>
      )}
      {error && (
        <div className="card" style={{ padding: 16, marginBottom: 20, background: 'var(--critical-bg)', border: 'none', color: 'var(--critical-text)', fontSize: 13 }}>
          {error}. Eğer <code>attendance_records</code> tablosu henüz oluşturulmadıysa, <code>supabase/schema.sql</code>'i Supabase SQL Editor'de çalıştırman gerekiyor.
        </div>
      )}

      {isSupabaseConfigured && !error && (
        <>
          {showAddModal && (
            <AddAbsenceModal
              students={students}
              defaultStudentId={filterStudentId || undefined}
              onClose={() => setShowAddModal(false)}
              onSaved={handleSaved}
            />
          )}
          {editingRecord && (
            <AddAbsenceModal
              students={students}
              editingRecord={editingRecord}
              onClose={() => setEditingRecord(null)}
              onSaved={handleSaved}
            />
          )}
          {notifyRecord && (
            <div className="modal-overlay" onClick={() => setNotifyRecord(null)}>
              <div className="modal-panel card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>WhatsApp ile Bildir</h3>
                <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 16 }}>
                  {studentById.get(notifyRecord.student_id)?.full_name ?? 'Öğrenci'} — {formatDateTr(notifyRecord.absence_date)} · {SESSION_LABELS[notifyRecord.session_type]}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => handleSendWhatsApp(notifyRecord, 'ogrenci')}>Öğrenciye Gönder</button>
                  <button type="button" className="btn btn-ghost" onClick={() => handleSendWhatsApp(notifyRecord, 'veli')}>Veliye Gönder</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ background: '#25D366', borderColor: '#25D366' }}
                    onClick={() => handleSendWhatsApp(notifyRecord, 'ikisi')}
                  >
                    Her İkisine Gönder
                  </button>
                </div>
                <div style={{ marginTop: 14, textAlign: 'right' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNotifyRecord(null)}>Şimdi Değil</button>
                </div>
              </div>
            </div>
          )}

          {/* Üst özet kutuları */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 22 }}>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>Bu Ay Toplam</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{summaryBoxes?.monthTotal ?? '—'}</div>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>Bu Ay Mazeretsiz</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--critical-text)' }}>{summaryBoxes?.monthUnexcused ?? '—'}</div>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>Bildirilmemiş Kayıt</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{summaryBoxes?.unnotifiedCount ?? '—'}</div>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>Son 30 Gün · En Çok Devamsızlık</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                {summaryBoxes?.topStudentName ? `${summaryBoxes.topStudentName} (${summaryBoxes.topStudentCount})` : '—'}
              </div>
            </div>
          </div>

          {/* Sekmeler */}
          <div style={{ display: 'flex', gap: 20, borderBottom: '1px solid var(--border)', marginBottom: 22 }}>
            {(['kayitlar', 'ozet'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '12px 6px', border: 'none', background: 'none',
                  fontWeight: activeTab === tab ? 600 : 500,
                  color: activeTab === tab ? 'var(--indigo-600)' : 'var(--ink-soft)',
                  borderBottom: activeTab === tab ? '2px solid var(--indigo-600)' : '2px solid transparent',
                  cursor: 'pointer', fontSize: 13.5,
                }}
              >
                {tab === 'kayitlar' ? 'Kayıtlar' : 'Öğrenci Özeti'}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>Yükleniyor…</div>
          ) : activeTab === 'kayitlar' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Filtreler */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="field" style={{ minWidth: 180 }}>
                  <label>Öğrenci</label>
                  <select value={filterStudentId} onChange={(e) => handleStudentFilterChange(e.target.value)}>
                    <option value="">Tüm öğrenciler</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.full_name}{!s.is_active ? ' (Arşivli)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Başlangıç</label>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className="field">
                  <label>Bitiş</label>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div className="field">
                  <label>Mazeret Durumu</label>
                  <select value={excuseFilter} onChange={(e) => setExcuseFilter(e.target.value as ExcuseFilter)}>
                    <option value="hepsi">Hepsi</option>
                    <option value="mazeretli">Mazeretli</option>
                    <option value="mazeretsiz">Mazeretsiz</option>
                  </select>
                </div>
                <div className="field">
                  <label>Oturum Türü</label>
                  <select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value as typeof sessionFilter)}>
                    <option value="hepsi">Hepsi</option>
                    <option value="birebir">Birebir</option>
                    <option value="etut">Etüt</option>
                    <option value="grup">Grup</option>
                    <option value="online">Online</option>
                  </select>
                </div>
              </div>

              {displayRecords.length === 0 ? (
                <div className="card empty-state">
                  <h3>Kayıt bulunamadı</h3>
                  <p>Seçili filtrelere uyan bir devamsızlık kaydı yok. Yeni bir kayıt eklemek için "Devamsızlık Ekle" butonunu kullan.</p>
                </div>
              ) : (
                <div className="card" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--ink-soft)' }}>
                        <th style={{ padding: '10px 12px' }}>Tarih</th>
                        <th style={{ padding: '10px 12px' }}>Öğrenci</th>
                        <th style={{ padding: '10px 12px' }}>Oturum</th>
                        <th style={{ padding: '10px 12px' }}>Durum</th>
                        <th style={{ padding: '10px 12px' }}>Mazeret</th>
                        <th style={{ padding: '10px 12px' }}>Not</th>
                        <th style={{ padding: '10px 12px' }}>Bildirim</th>
                        <th style={{ padding: '10px 12px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRecords.map((r) => {
                        const student = studentById.get(r.student_id)
                        return (
                          <tr key={r.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{formatDateTr(r.absence_date)}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>{student?.full_name ?? '—'}</td>
                            <td style={{ padding: '10px 12px' }}>{SESSION_LABELS[r.session_type]}</td>
                            <td style={{ padding: '10px 12px' }}>{STATUS_LABELS[r.status]}</td>
                            <td style={{ padding: '10px 12px' }}>
                              {r.excuse_type === 'yok' ? (
                                <span style={{ color: 'var(--critical-text)', fontWeight: 600 }}>Mazeretsiz</span>
                              ) : (
                                EXCUSE_LABELS[r.excuse_type]
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--ink-soft)', maxWidth: 180 }}>{r.excuse_note || '—'}</td>
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                              {r.notified_at ? (
                                <span title="Mesajın gönderildiğini uygulama doğrulayamaz" style={{ color: 'var(--success-text)', fontSize: 12 }}>
                                  WhatsApp açıldı · {formatTimestampDayMonthTr(r.notified_at)} · {r.notified_to ? NOTIFY_TARGET_LABELS[r.notified_to] : ''}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--ink-faint)' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', position: 'relative' }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ padding: 4, minHeight: 'auto', background: 'none' }}
                                onClick={(e) => {
                                  if (menuOpenRecordId === r.id) {
                                    setMenuOpenRecordId(null)
                                    setMenuAnchor(null)
                                    return
                                  }
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  setMenuAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                                  setMenuOpenRecordId(r.id)
                                }}
                              >
                                <MoreVertical size={15} />
                              </button>
                              {menuOpenRecordId === r.id && (
                                <>
                                  <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => { setMenuOpenRecordId(null); setMenuAnchor(null) }} />
                                  <div
                                    style={{
                                      position: 'fixed', right: menuAnchor?.right ?? 0, top: menuAnchor?.top ?? 0, zIndex: 20, minWidth: 170,
                                      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                                      boxShadow: 'var(--shadow-pop)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                                    }}
                                  >
                                    <button
                                      type="button"
                                      style={{ padding: '8px 12px', fontSize: 12, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--ink)', width: '100%' }}
                                      onClick={() => { setNotifyRecord(r); setMenuOpenRecordId(null) }}
                                    >
                                      WhatsApp ile Bildir
                                    </button>
                                    <button
                                      type="button"
                                      style={{ padding: '8px 12px', fontSize: 12, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--ink)', width: '100%', borderTop: '1px solid var(--border-soft)' }}
                                      onClick={() => { setEditingRecord(r); setMenuOpenRecordId(null) }}
                                    >
                                      Düzenle
                                    </button>
                                    <button
                                      type="button"
                                      style={{ padding: '8px 12px', fontSize: 12, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--critical-text)', width: '100%', borderTop: '1px solid var(--border-soft)' }}
                                      onClick={() => handleDeleteRecord(r.id)}
                                    >
                                      Sil
                                    </button>
                                  </div>
                                </>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            // ---- Öğrenci Özeti sekmesi ----
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {studentSummaries.length === 0 ? (
                <div className="card empty-state">
                  <h3>Aktif öğrenci yok</h3>
                  <p>Özet gösterebilmek için önce Öğrenciler sayfasından öğrenci ekle.</p>
                </div>
              ) : (
                studentSummaries.map((summary) => {
                  const isExpanded = expandedStudentId === summary.student.id
                  const isEmpty = summary.total === 0
                  return (
                    <div key={summary.student.id} className="card" style={{ padding: 0, opacity: isEmpty ? 0.6 : 1 }}>
                      <button
                        type="button"
                        onClick={() => setExpandedStudentId(isExpanded ? null : summary.student.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: 16,
                          background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer',
                        }}
                      >
                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--measured-bg)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0, border: '1px solid var(--border-soft)' }}>
                          {summary.student.photo_url ? (
                            <img src={summary.student.photo_url} alt={summary.student.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            summary.student.full_name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
                          )}
                        </div>

                        <div style={{ flex: '0 0 160px', minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {summary.student.full_name}
                            {summary.needsAttention && (
                              <span title="Son 30 günde eşik aşıldı" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 800, color: 'var(--warning-text)', background: 'var(--warning-bg)', padding: '2px 6px', borderRadius: 10 }}>
                                <AlertTriangle size={11} /> Takip gerekli
                              </span>
                            )}
                          </div>
                          {isEmpty ? (
                            <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>Devamsızlık yok</div>
                          ) : (
                            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>Son: {summary.lastDate ? formatDateTr(summary.lastDate) : '—'}</div>
                          )}
                        </div>

                        {!isEmpty && (
                          <>
                            <div style={{ textAlign: 'center', flexShrink: 0 }}>
                              <div style={{ fontSize: 17, fontWeight: 700 }}>{summary.total}</div>
                              <div style={{ fontSize: 10, color: 'var(--ink-faint)' }}>Toplam</div>
                            </div>
                            <div style={{ textAlign: 'center', flexShrink: 0 }}>
                              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--critical-text)' }}>{summary.unexcused}</div>
                              <div style={{ fontSize: 10, color: 'var(--ink-faint)' }}>Mazeretsiz</div>
                            </div>
                            <div style={{ textAlign: 'center', flexShrink: 0 }}>
                              <div style={{ fontSize: 17, fontWeight: 700 }}>{summary.last30Count}</div>
                              <div style={{ fontSize: 10, color: 'var(--ink-faint)' }}>Son 30 Gün</div>
                            </div>
                            <div style={{ flexShrink: 0 }}>
                              <Sparkline values={summary.monthly} width={90} height={28} />
                            </div>
                          </>
                        )}

                        <div style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div style={{ borderTop: '1px solid var(--border-soft)', padding: 16 }}>
                          {summary.records.length === 0 ? (
                            <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Bu öğrenci için devamsızlık kaydı yok.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                              {summary.records.map((r) => (
                                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', background: 'var(--surface-alt)', border: '1px solid var(--border-soft)', borderRadius: 8, fontSize: 12.5 }}>
                                  <span style={{ fontWeight: 600 }}>{formatDateTr(r.absence_date)}</span>
                                  <span style={{ color: 'var(--ink-soft)' }}>{SESSION_LABELS[r.session_type]} · {STATUS_LABELS[r.status]}</span>
                                  <span style={{ color: r.excuse_type === 'yok' ? 'var(--critical-text)' : 'var(--ink-soft)', fontWeight: r.excuse_type === 'yok' ? 700 : 400 }}>
                                    {r.excuse_type === 'yok' ? 'Mazeretsiz' : EXCUSE_LABELS[r.excuse_type]}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ background: '#25D366', borderColor: '#25D366' }}
                              onClick={() => handleSendParentSummary(summary)}
                              disabled={summary.total === 0}
                            >
                              <MessageCircle size={13} /> Veliye Özet Gönder
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => { handleStudentFilterChange(summary.student.id); setActiveTab('kayitlar') }}
                            >
                              Tüm Kayıtları Kayıtlar Sekmesinde Gör
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
