// Devamsızlık Takibi — Türkçe etiket haritaları, uyarı eşikleri, tarih
// yardımcıları ve WhatsApp mesaj şablonları. Tablo, modal ve bildirim akışının
// üçü de buradan besleniyor — sayfa dosyasına dağıtılmadı (tek kaynak).
import type { AbsenceStatus, AttendanceRecord, ExcuseType, NotifyTarget, SessionType, Student } from '../types/database'

export const SESSION_LABELS: Record<SessionType, string> = {
  birebir: 'Birebir',
  etut: 'Etüt',
  grup: 'Grup',
  online: 'Online',
}

export const STATUS_LABELS: Record<AbsenceStatus, string> = {
  gelmedi: 'Gelmedi',
  gec_geldi: 'Geç Geldi',
  erken_ayrildi: 'Erken Ayrıldı',
}

export const EXCUSE_LABELS: Record<ExcuseType, string> = {
  yok: 'Mazeret bildirilmedi',
  hastalik: 'Hastalık',
  ailevi: 'Ailevi',
  okul_sinav: 'Okul / Sınav',
  ulasim: 'Ulaşım',
  izinli: 'İzinli',
  diger: 'Diğer',
}

export const NOTIFY_TARGET_LABELS: Record<NotifyTarget, string> = {
  ogrenci: 'Öğrenci',
  veli: 'Veli',
  ikisi: 'Öğrenci+Veli',
}

// Öğrenci Özeti'nde "Takip gerekli" rozetinin eşikleri — tek yerde, sonradan
// kolayca değiştirilebilsin diye.
export const ABSENCE_ALERT_THRESHOLDS = {
  last30DaysTotal: 3,
  last30DaysUnexcused: 2,
}

// ---------------------------------------------------------------------------
// Tarih yardımcıları — absence_date bir 'date' sütunu (YYYY-MM-DD, saat dilimi
// yok), Date nesnesine çevirip toLocaleDateString kullanmak kaydırma riski
// taşır; bu yüzden düz string bölme ile ele alınıyor.
// ---------------------------------------------------------------------------
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 'YYYY-MM-DD' → '29.07.2026' */
export function formatDateTr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

/** timestamptz (notified_at/created_at) → '29.07' (yerel tarih dilimiyle) */
export function formatTimestampDayMonthTr(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
}

/** Bir öğrencinin son N ayının devamsızlık sayısını (eskiden yeniye) döner — Sparkline için. */
export function monthlyBuckets(records: AttendanceRecord[], months: number): number[] {
  const now = new Date()
  const buckets: number[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.push(records.filter((r) => r.absence_date.slice(0, 7) === key).length)
  }
  return buckets
}

// ---------------------------------------------------------------------------
// WhatsApp mesaj şablonları (Opus 5 planı, bölüm F)
// ---------------------------------------------------------------------------
export function buildStudentMessage(studentName: string, record: AttendanceRecord): string {
  const dateLabel = formatDateTr(record.absence_date)
  const sessionLabel = SESSION_LABELS[record.session_type]
  if (record.excuse_type === 'yok') {
    return `Merhaba ${studentName}, ${dateLabel} tarihli ${sessionLabel} çalışmasına katılmadın ve bir mazeret bildirilmedi. Lütfen en kısa sürede iletişime geç. — Netlik Koçluk`
  }
  const excuseLabel = EXCUSE_LABELS[record.excuse_type]
  return `Merhaba ${studentName}, ${dateLabel} tarihli ${sessionLabel} çalışmana katılamadığını kaydettik. Mazeret: ${excuseLabel}. Kaçırdığın konuları telafi etmek için en kısa sürede planlama yapalım. — Netlik Koçluk`
}

export function buildParentMessage(studentName: string, record: AttendanceRecord): string {
  const dateLabel = formatDateTr(record.absence_date)
  const sessionLabel = SESSION_LABELS[record.session_type]
  const excuseLabel = record.excuse_type === 'yok' ? 'bildirilmedi' : EXCUSE_LABELS[record.excuse_type]
  return `Merhaba, ${studentName} ${dateLabel} tarihli ${sessionLabel} çalışmasına katılmadı. Mazeret: ${excuseLabel}. Bilginize. — Netlik Koçluk`
}

export function buildParentSummaryMessage(
  studentName: string,
  startLabel: string,
  endLabel: string,
  total: number,
  unexcused: number,
  lastDateLabel: string
): string {
  return `Merhaba, ${studentName} için devamsızlık özeti (${startLabel}–${endLabel}): toplam ${total} devamsızlık, ${unexcused} tanesi mazeretsiz. Son devamsızlık: ${lastDateLabel}. Görüşmek üzere. — Netlik Koçluk`
}

/**
 * Bir devamsızlık kaydını verilen alıcıya (öğrenci/veli/her ikisi) bildirmek için
 * gereken mesajları hazırlar ve telefon numarası eksik olan tarafları raporlar.
 * Gerçek `window.open`/DB güncellemesi çağıran tarafta yapılır (bu fonksiyon yan etkisiz).
 */
export function planAttendanceNotification(record: AttendanceRecord, student: Student, recipient: NotifyTarget) {
  const wantsStudent = recipient === 'ogrenci' || recipient === 'ikisi'
  const wantsParent = recipient === 'veli' || recipient === 'ikisi'
  const missing: string[] = []
  if (wantsStudent && !student.phone_number) missing.push('öğrenci')
  if (wantsParent && !student.parent_phone_number) missing.push('veli')

  return {
    wantsStudent,
    wantsParent,
    missing,
    studentMessage: wantsStudent ? buildStudentMessage(student.full_name, record) : null,
    parentMessage: wantsParent ? buildParentMessage(student.full_name, record) : null,
  }
}
