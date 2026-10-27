import { fmtWeekRange } from './weeks'
import type { AttendanceRecord, MockExam, Student, WeeklyTask } from '../types/database'
import type { PortalAttendance, PortalExam, PortalStudent, PortalTask } from './portal'

export type ParentSupportTipInput = {
  completionPct: number
  hasSignificantExamDrop: boolean
  hasAttendanceIssue: boolean
}

/**
 * Kural tabanlı "Evde nasıl destek olabilirsiniz?" öneri üretimi (suçlamasız, en fazla 2 madde):
 * 1. Görev tamamlama < %60 -> "Çalışma saatlerini sabit bir rutine oturtmasına ve çalışma ortamının sessiz kalmasına destek olabilirsiniz."
 * 2. Son denemede belirgin net düşüşü -> "Deneme süreçlerinde iniş çıkışlar doğaldır; uyku düzenini ve dinlenmesini korumasına yardımcı olun."
 * 3. Devamsızlık varsa -> "Aksayan ders veya etütlerin telafisi konusunda öğrenciyi motive edebilirsiniz."
 * 4. Her şey yolundaysa -> "Haftalık hedeflerini başarıyla sürdürüyor; gösterdiği disiplini ve emeği takdir edebilirsiniz."
 */
export function generateParentSupportTips(input: ParentSupportTipInput): string[] {
  const tips: string[] = []

  if (input.completionPct < 60) {
    tips.push('Çalışma saatlerini sabit bir rutine oturtmasına ve çalışma ortamının sessiz kalmasına destek olabilirsiniz.')
  }

  if (input.hasSignificantExamDrop) {
    tips.push('Deneme süreçlerinde iniş çıkışlar doğaldır; uyku düzenini ve dinlenmesini korumasına yardımcı olun.')
  }

  if (input.hasAttendanceIssue) {
    tips.push('Aksayan ders veya etütlerin telafisi konusunda öğrenciyi motive edebilirsiniz.')
  }

  if (tips.length === 0) {
    tips.push('Haftalık hedeflerini başarıyla sürdürüyor; gösterdiği disiplini ve emeği takdir edebilirsiniz.')
  }

  return tips.slice(0, 2)
}

/**
 * İki deneme arasındaki net farkına bakarak belirgin bir düşüş (>= 3 net) olup olmadığını tespit eder.
 */
export function detectSignificantExamDrop(
  latestNet?: number | null,
  previousNet?: number | null
): boolean {
  if (latestNet == null || previousNet == null) return false
  return previousNet - latestNet >= 3
}

export type SummaryStudentInfo = {
  id: string
  full_name: string
  parent_phone_number?: string | null
  grade?: string | null
  track?: string | null
  target_net_value?: number | null
}

export type SummaryStats = {
  completedCount: number
  totalCount: number
  completionPct: number
  latestExamNet: number | null
  latestExamName: string | null
  latestExamType: string | null
  hasExamDrop: boolean
  attendanceCount: number
  unexcusedAttendanceCount: number
  targetNet: number | null
}

export function computeSummaryStats(params: {
  tasks: Array<WeeklyTask | PortalTask>
  latestExam?: MockExam | PortalExam | null
  previousExam?: MockExam | PortalExam | null
  attendanceRecords?: Array<AttendanceRecord | PortalAttendance>
  targetNet?: number | null
}): SummaryStats {
  const { tasks, latestExam, previousExam, attendanceRecords = [], targetNet = null } = params

  // P2: Mola ve serbest blokları veli özeti sayaçlarından dışla
  const dersTasks = tasks.filter((t) => !('block_kind' in t) || !t.block_kind || t.block_kind === 'ders')
  const totalCount = dersTasks.length
  const completedCount = dersTasks.filter((t) => t.completed).length
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const latestNet =
    latestExam && 'total_net' in latestExam && latestExam.total_net !== undefined
      ? Number((latestExam as { total_net?: number }).total_net)
      : null
  const previousNet =
    previousExam && 'total_net' in previousExam && previousExam.total_net !== undefined
      ? Number((previousExam as { total_net?: number }).total_net)
      : null
  const hasExamDrop = detectSignificantExamDrop(latestNet, previousNet)

  const attendanceCount = attendanceRecords.length
  const unexcusedAttendanceCount = attendanceRecords.filter((a) => a.excuse_type === 'yok').length

  return {
    completedCount,
    totalCount,
    completionPct,
    latestExamNet: latestNet,
    latestExamName: latestExam?.name ?? null,
    latestExamType: latestExam?.exam_type ?? null,
    hasExamDrop,
    attendanceCount,
    unexcusedAttendanceCount,
    targetNet,
  }
}

export function formatWeekRangeFromKey(weekStartKey: string): string {
  try {
    const parts = weekStartKey.split('-').map(Number)
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const d = new Date(parts[0], parts[1] - 1, parts[2])
      return fmtWeekRange(d)
    }
  } catch {
    // fallback
  }
  return weekStartKey
}

/**
 * WhatsApp mesajı ve ekran damgası için tarih-saat biçimi: "26 Eki 14:05"
 */
export function formatOpenedAtStamp(isoDate: string): string {
  try {
    const d = new Date(isoDate)
    if (isNaN(d.getTime())) return isoDate
    const day = d.getDate()
    const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
    const month = months[d.getMonth()]
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${day} ${month} ${hours}:${minutes}`
  } catch {
    return isoDate
  }
}

/**
 * Veliye gönderilecek WhatsApp mesaj metnini oluşturur.
 */
export function buildParentSummaryWhatsAppMessage(params: {
  studentName: string
  weekRangeText: string
  stats: SummaryStats
  tips: string[]
  coachNote?: string | null
}): string {
  const { studentName, weekRangeText, stats, tips, coachNote } = params

  const greeting = `Sayın Velimiz,`
  const intro = `*${studentName}* için haftalık çalışma özeti (${weekRangeText}):`

  const taskLine = `📋 *Haftalık Görevler:* ${stats.completedCount}/${stats.totalCount} tamamlandı (%${stats.completionPct})`

  let examLine = ''
  if (stats.latestExamName && stats.latestExamNet != null) {
    const roundedNet = Math.round(stats.latestExamNet * 100) / 100
    examLine = `\n📊 *Son Deneme:* ${stats.latestExamName} (${stats.latestExamType ?? 'Deneme'}) — *${roundedNet} Net*`
    if (stats.targetNet != null) {
      examLine += ` (Hedef: ${stats.targetNet})`
    }
  } else if (stats.targetNet != null) {
    examLine = `\n🎯 *Hedef Net:* ${stats.targetNet}`
  }

  let attendanceLine = ''
  if (stats.attendanceCount === 0) {
    attendanceLine = `\n⏱ *Devamsızlık:* Bu hafta devamsızlık kaydı yok 👏`
  } else if (stats.unexcusedAttendanceCount > 0) {
    attendanceLine = `\n⏱ *Devamsızlık:* ${stats.attendanceCount} kayıt (${stats.unexcusedAttendanceCount} mazeretsiz)`
  } else {
    attendanceLine = `\n⏱ *Devamsızlık:* ${stats.attendanceCount} kayıt (tamamı mazeretli)`
  }

  const tipsSection = `\n\n🏡 *Evde Nasıl Destek Olabilirsiniz?*\n${tips.map((t) => `• ${t}`).join('\n')}`

  const cleanNote = coachNote?.trim()
  const coachNoteSection = cleanNote ? `\n\n📝 *Koçun Notu:*\n"${cleanNote}"` : ''

  const footer = `\n\nİyi haftalar dileriz. — Netlik Koçluk`

  return `${greeting}\n\n${intro}\n\n${taskLine}${examLine}${attendanceLine}${tipsSection}${coachNoteSection}${footer}`
}

export type { Student, WeeklyTask, MockExam, AttendanceRecord, PortalStudent, PortalTask, PortalExam, PortalAttendance }
