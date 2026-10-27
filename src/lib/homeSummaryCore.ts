/**
 * src/lib/homeSummaryCore.ts
 *
 * Ana Sayfa / Panel Özeti Saf İş Mantığı Motoru (G2 + G2b).
 * Supabase veya Vite bağımlılığı İÇERMEZ, Node/tsx ve tarayıcıda doğrudan çalışır.
 */

import { mondayOf, weekKey } from './weeks'
import { gradeCurriculum } from './curriculum'
import { checkAttendanceNeedsAttention, isoDaysAgoFrom, SESSION_LABELS, STATUS_LABELS } from './attendance'
import { countExamsWithoutTopics } from './examReport'
import type {
  AttendanceRecord,
  CoachDecision,
  MockExam,
  MockExamSection,
  Student,
  WeeklyTask,
} from '../types/database'

// ---------------------------------------------------------------------------
// Veri Sözleşmesi Tipleri (G2b Güncel)
// ---------------------------------------------------------------------------

export type AttentionReasonKind =
  | 'kritik_karar'
  | 'net_dususu'
  | 'devamsizlik_takip'
  | 'program_dusuk'
  | 'program_yok'
  | 'deneme_yok'

export interface AttentionReasonKritikDetail {
  count: number
  topicNames: string[]
}

export interface AttentionReasonNetDususuDetail {
  prev: number
  last: number
  delta: number
  examType: string
}

export interface AttentionReasonDevamsizlikDetail {
  last14Count: number
  notOpened: boolean
}

export interface AttentionReasonProgramDetail {
  pct: number
}

export interface AttentionReasonDenemeYokDetail {
  daysSinceLast: number | null
}

export type AttentionReasonDetail =
  | AttentionReasonKritikDetail
  | AttentionReasonNetDususuDetail
  | AttentionReasonDevamsizlikDetail
  | AttentionReasonProgramDetail
  | AttentionReasonDenemeYokDetail
  | Record<string, unknown>
  | null

export interface AttentionReason {
  kind: AttentionReasonKind
  label: string
  detail?: AttentionReasonDetail
}

export interface StudentAttentionItem {
  studentId: string
  name: string
  grade: Student['grade']
  track: Student['track']
  reasons: AttentionReason[]
}

export interface HomeStudentsSummary {
  totalActive: number
  yksCount: number
  lgsCount: number
  newThisMonth: number
}

export interface HomeExamRecentItem {
  studentName: string
  name: string
  examType: string
  date: string
  totalNet: number
  delta: number | null
  topicResultsCount: number
}

export interface HomeExamsSummary {
  last7DaysCount: number
  avgDelta: number | null
  withoutTopicsCount: number
  weeklyAvgNet: Array<{ weekStart: string; avg: number }>
  recent: HomeExamRecentItem[]
}

export interface HomeProgramDayItem {
  dayIndex: number
  planned: number
  done: number
}

export interface HomeProgramToDate {
  planned: number
  done: number
  pct: number
}

export interface HomeProgramSummary {
  thisWeekTotalTasks: number
  thisWeekCompletedTasks: number
  completionRate: number | null
  studentsWithoutTasksCount: number
  byDay: HomeProgramDayItem[]
  toDate: HomeProgramToDate
  lastWeekSameDayPct: number | null
}

export interface HomeAttendanceSummary {
  thisWeekAbsenceCount: number
  needsAttentionCount: number
  notifyNotOpenedCount: number
  byDay: number[]
}

export interface HomeReportsSummary {
  criticalTopicCount: number
  studentsWithCritical: number
  topTopic: { name: string; studentCount: number } | null
  bySubject: Array<{ subjectName: string; count: number }>
}

export interface HomeRecentActivity {
  kind: 'exam' | 'attendance' | 'decision'
  at: string
  studentName: string
  text: string
}

export interface HomeSummary {
  students: HomeStudentsSummary
  attention: StudentAttentionItem[]
  exams: HomeExamsSummary
  program: HomeProgramSummary
  attendance: HomeAttendanceSummary
  reports: HomeReportsSummary
  recent: HomeRecentActivity[]
}

// ---------------------------------------------------------------------------
// Girdi Tipleri
// ---------------------------------------------------------------------------

export type EnrichedMockExam = MockExam & {
  totalNet: number
  sectionsList: MockExamSection[]
  hasTopics?: boolean
  topicResultsCount?: number
}

export interface TopicInfo {
  id: number
  name: string
  subject_id?: number
}

export interface SubjectInfo {
  id: number
  name: string
}

export interface HomeSummaryRawData {
  students: Student[]
  coachDecisions: CoachDecision[]
  mockExams: EnrichedMockExam[]
  weeklyTasks: WeeklyTask[]
  lastWeekTasks?: WeeklyTask[]
  attendanceRecords: AttendanceRecord[]
  topics?: TopicInfo[]
  subjects?: SubjectInfo[]
  referenceDate?: Date | string
  isWeekHalfway?: boolean
}

// ---------------------------------------------------------------------------
// Ağırlık Haritası
// kritik > net düşüşü > devamsızlık > program > deneme yok
// ---------------------------------------------------------------------------
const REASON_WEIGHTS: Record<AttentionReasonKind, number> = {
  kritik_karar: 10000,
  net_dususu: 1000,
  devamsizlik_takip: 100,
  program_dusuk: 10,
  program_yok: 10,
  deneme_yok: 1,
}

export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100
}

const trNetFormatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatNetTr(val: number): string {
  return trNetFormatter.format(round2(val))
}

/**
 * Diziyi verilen boyutta alt parçalara böler (URL uzunluğu veya sorgu sınırını aşmamak için).
 */
export function chunkArray<T>(items: readonly T[], chunkSize = 200): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 0..6 aralığında gün indeksi döner (0=Pazartesi, ..., 6=Pazar).
 * Yerel saat dilimini esas alır (Türkiye 00:00-03:00 arası UTC gün kaymasını engeller).
 */
export function getIsoDayIndex(dateOrIso: Date | string): number {
  let d: Date
  if (typeof dateOrIso === 'string') {
    if (dateOrIso.includes('T')) {
      d = new Date(dateOrIso)
    } else {
      const [y, m, day] = dateOrIso.split('-').map(Number)
      d = new Date(y, m - 1, day, 12, 0, 0)
    }
  } else {
    d = dateOrIso
  }
  const jsDay = d.getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

// ---------------------------------------------------------------------------
// buildHomeSummary
// ---------------------------------------------------------------------------

export function buildHomeSummary(rawData: HomeSummaryRawData): HomeSummary {
  const refDate = rawData.referenceDate
    ? typeof rawData.referenceDate === 'string'
      ? new Date(rawData.referenceDate)
      : rawData.referenceDate
    : new Date()

  const todayIsoStr = toIsoDate(refDate)
  const currentMonthPrefix = todayIsoStr.slice(0, 7) // 'YYYY-MM'
  const iso7DaysAgo = isoDaysAgoFrom(refDate, 7)
  const iso14DaysAgo = isoDaysAgoFrom(refDate, 14)
  const iso21DaysAgo = isoDaysAgoFrom(refDate, 21)

  const thisMon = mondayOf(refDate)
  const thisWeekKeyStr = weekKey(thisMon)
  const thisSun = new Date(thisMon.getTime() + 6 * 86400000)
  const thisMonIsoStr = toIsoDate(thisMon)
  const thisSunIsoStr = toIsoDate(thisSun)

  const lastMon = new Date(thisMon.getTime() - 7 * 86400000)
  const lastWeekKeyStr = weekKey(lastMon)

  // Bugünün gün indeksi (0=Pazartesi .. 6=Pazar)
  const currentDayIndex = getIsoDayIndex(refDate)

  // Hafta en az yarılanmış mı? (Perşembe=3. gün sonrası, dayIndex >= 3 veya Pazar)
  const weekHalfway =
    typeof rawData.isWeekHalfway === 'boolean'
      ? rawData.isWeekHalfway
      : currentDayIndex >= 3

  const activeStudents = rawData.students.filter((s) => s.is_active)
  const studentMap = new Map<string, Student>()
  for (const s of activeStudents) {
    studentMap.set(s.id, s)
  }

  const topicMap = new Map<number, TopicInfo>()
  if (rawData.topics) {
    for (const t of rawData.topics) {
      topicMap.set(t.id, t)
    }
  }

  const subjectMap = new Map<number, SubjectInfo>()
  if (rawData.subjects) {
    for (const sub of rawData.subjects) {
      subjectMap.set(sub.id, sub)
    }
  }

  // -------------------------------------------------------------------------
  // 1. Öğrenciler Özeti
  // -------------------------------------------------------------------------
  let yksCount = 0
  let lgsCount = 0
  let newThisMonth = 0

  for (const s of activeStudents) {
    if (gradeCurriculum(s.grade) === 'LGS') {
      lgsCount++
    } else {
      yksCount++
    }
    if (s.created_at && s.created_at.slice(0, 7) === currentMonthPrefix) {
      newThisMonth++
    }
  }

  const studentsSummary: HomeStudentsSummary = {
    totalActive: activeStudents.length,
    yksCount,
    lgsCount,
    newThisMonth,
  }

  // -------------------------------------------------------------------------
  // 2. Denemeler Haritası ve Hazırlığı
  // -------------------------------------------------------------------------
  const studentExamsMap = new Map<string, EnrichedMockExam[]>()
  for (const exam of rawData.mockExams) {
    const list = studentExamsMap.get(exam.student_id) || []
    list.push(exam)
    studentExamsMap.set(exam.student_id, list)
  }

  for (const [, exams] of studentExamsMap) {
    exams.sort((a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime())
  }

  // -------------------------------------------------------------------------
  // 3. Program Görevleri Haritası (Yalnızca ders blokları)
  // -------------------------------------------------------------------------
  const dersWeeklyTasks = rawData.weeklyTasks.filter((t) => !t.block_kind || t.block_kind === 'ders')
  const thisWeekTasks = dersWeeklyTasks.filter((t) => t.week_start === thisWeekKeyStr)
  const activeStudentTasksMap = new Map<string, WeeklyTask[]>()
  for (const t of thisWeekTasks) {
    if (studentMap.has(t.student_id)) {
      const list = activeStudentTasksMap.get(t.student_id) || []
      list.push(t)
      activeStudentTasksMap.set(t.student_id, list)
    }
  }

  // -------------------------------------------------------------------------
  // 4. Devamsızlık Haritası
  // -------------------------------------------------------------------------
  const studentAttendanceMap = new Map<string, AttendanceRecord[]>()
  for (const rec of rawData.attendanceRecords) {
    const list = studentAttendanceMap.get(rec.student_id) || []
    list.push(rec)
    studentAttendanceMap.set(rec.student_id, list)
  }

  // -------------------------------------------------------------------------
  // 5. İlgi Bekleyen Öğrenciler (Attention List)
  // -------------------------------------------------------------------------
  const criticalDecisionsByStudent = new Map<string, CoachDecision[]>()
  for (const d of rawData.coachDecisions) {
    if (d.state === 'kritik') {
      const list = criticalDecisionsByStudent.get(d.student_id) || []
      list.push(d)
      criticalDecisionsByStudent.set(d.student_id, list)
    }
  }

  const attentionList: StudentAttentionItem[] = []

  for (const s of activeStudents) {
    const reasons: AttentionReason[] = []

    // 1. Kritik karar (state = 'kritik')
    const critList = criticalDecisionsByStudent.get(s.id) || []
    if (critList.length > 0) {
      const topicNames: string[] = []
      for (const cd of critList) {
        const tInfo = topicMap.get(cd.topic_id)
        topicNames.push(tInfo ? tInfo.name : `Konu #${cd.topic_id}`)
      }
      reasons.push({
        kind: 'kritik_karar',
        label: `${critList.length} kritik konu kararı`,
        detail: {
          count: critList.length,
          topicNames: topicNames.slice(0, 3),
        },
      })
    }

    // 2. Net düşüşü (son deneme bir öncekinden >= 5 net düşük)
    const sExams = studentExamsMap.get(s.id) || []
    const latestExam = sExams[0] || null
    if (latestExam) {
      const prevExam = sExams.find((e, idx) => idx > 0 && e.exam_type === latestExam.exam_type)
      if (prevExam) {
        // totalNet LGS'te zaten katsayılı net (puan değil).
        const lastN = latestExam.totalNet
        const prevN = prevExam.totalNet
        const delta = round2(lastN - prevN)
        if (delta <= -5) {
          reasons.push({
            kind: 'net_dususu',
            label: `${latestExam.exam_type} denemesinde ${formatNetTr(Math.abs(delta))} net düşüş`,
            detail: {
              prev: round2(prevN),
              last: round2(lastN),
              delta,
              examType: latestExam.exam_type,
            },
          })
        }
      }
    }

    // 3. Devamsızlık takibi
    const sAttendance = studentAttendanceMap.get(s.id) || []
    const last14Absences = sAttendance.filter(
      (r) => r.absence_date >= iso14DaysAgo && r.absence_date <= todayIsoStr
    )
    const hasNotOpened = last14Absences.some((r) => !r.notified_at)
    if (checkAttendanceNeedsAttention(sAttendance, todayIsoStr)) {
      reasons.push({
        kind: 'devamsizlik_takip',
        label: 'Devamsızlık takibi gerekli',
        detail: {
          last14Count: last14Absences.length,
          notOpened: hasNotOpened,
        },
      })
    }

    // 4. Program düşük veya program yok
    const sTasks = activeStudentTasksMap.get(s.id) || []
    if (sTasks.length === 0) {
      reasons.push({
        kind: 'program_yok',
        label: 'Bu hafta görev planlanmadı',
        detail: null,
      })
    } else if (weekHalfway) {
      const compTasks = sTasks.filter((t) => t.completed).length
      const compPct = Math.round((compTasks / sTasks.length) * 100)
      if (compPct < 50) {
        reasons.push({
          kind: 'program_dusuk',
          label: `Haftalık tamamlama %${compPct}`,
          detail: {
            pct: compPct,
          },
        })
      }
    }

    // 5. Deneme yok (son 21 günde hiç deneme yok)
    const recentExam = sExams.find((e) => e.exam_date >= iso21DaysAgo && e.exam_date <= todayIsoStr)
    if (!recentExam) {
      let daysSinceLast: number | null = null
      if (latestExam) {
        const diffMs = refDate.getTime() - new Date(latestExam.exam_date.includes('T') ? latestExam.exam_date : `${latestExam.exam_date}T12:00:00Z`).getTime()
        daysSinceLast = Math.max(0, Math.floor(diffMs / 86400000))
      }
      reasons.push({
        kind: 'deneme_yok',
        label: 'Son 21 günde deneme yok',
        detail: {
          daysSinceLast,
        },
      })
    }

    if (reasons.length > 0) {
      attentionList.push({
        studentId: s.id,
        name: s.full_name,
        grade: s.grade,
        track: s.track,
        reasons,
      })
    }
  }

  // Sıralama
  attentionList.sort((a, b) => {
    if (b.reasons.length !== a.reasons.length) {
      return b.reasons.length - a.reasons.length
    }
    const maxWeightA = Math.max(...a.reasons.map((r) => REASON_WEIGHTS[r.kind]))
    const maxWeightB = Math.max(...b.reasons.map((r) => REASON_WEIGHTS[r.kind]))
    if (maxWeightB !== maxWeightA) {
      return maxWeightB - maxWeightA
    }
    const totalWeightA = a.reasons.reduce((sum, r) => sum + REASON_WEIGHTS[r.kind], 0)
    const totalWeightB = b.reasons.reduce((sum, r) => sum + REASON_WEIGHTS[r.kind], 0)
    return totalWeightB - totalWeightA
  })

  // -------------------------------------------------------------------------
  // 6. Denemeler Özeti (G2b Eklentileriyle)
  // -------------------------------------------------------------------------
  const examsWithin7Days = rawData.mockExams.filter((e) => {
    return e.exam_date >= iso7DaysAgo && e.exam_date <= todayIsoStr
  })
  const withoutTopicsCount = countExamsWithoutTopics(rawData.mockExams)

  const studentDeltas: number[] = []
  for (const s of activeStudents) {
    const sExams = studentExamsMap.get(s.id) || []
    const latest = sExams[0] || null
    if (latest) {
      const prev = sExams.find((e, idx) => idx > 0 && e.exam_type === latest.exam_type)
      if (prev) {
        studentDeltas.push(round2(latest.totalNet - prev.totalNet))
      }
    }
  }

  const avgDelta =
    studentDeltas.length > 0
      ? round2(studentDeltas.reduce((sum, d) => sum + d, 0) / studentDeltas.length)
      : null

  // Son 8 hafta TYT haftalık ortalama toplam net
  const weeklyAvgNet: Array<{ weekStart: string; avg: number }> = []
  for (let i = 7; i >= 0; i--) {
    const wMon = new Date(thisMon.getTime() - i * 7 * 86400000)
    const wKey = weekKey(wMon)
    const wSun = new Date(wMon.getTime() + 6 * 86400000)
    const wSunKey = toIsoDate(wSun)
    const wMonKey = toIsoDate(wMon)

    const weekTytExams = rawData.mockExams.filter((e) => {
      return e.exam_type === 'TYT' && e.exam_date >= wMonKey && e.exam_date <= wSunKey
    })

    const avgNet =
      weekTytExams.length > 0
        ? round2(weekTytExams.reduce((sum, e) => sum + e.totalNet, 0) / weekTytExams.length)
        : 0

    weeklyAvgNet.push({
      weekStart: wKey,
      avg: avgNet,
    })
  }

  // Son 5 deneme (recent)
  const sortedExams = [...rawData.mockExams].sort(
    (a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime()
  )
  const recentExams: HomeExamRecentItem[] = sortedExams.slice(0, 5).map((exam) => {
    const s = studentMap.get(exam.student_id)
    const sExams = studentExamsMap.get(exam.student_id) || []
    const currentIdx = sExams.findIndex((e) => e.id === exam.id)
    const prev = sExams.find((e, idx) => idx > currentIdx && e.exam_type === exam.exam_type)
    const delta = prev ? round2(exam.totalNet - prev.totalNet) : null

    return {
      studentName: s ? s.full_name : 'Bilinmeyen Öğrenci',
      name: exam.name,
      examType: exam.exam_type,
      date: exam.exam_date,
      totalNet: round2(exam.totalNet),
      delta,
      topicResultsCount: exam.topicResultsCount ?? (exam.hasTopics ? 1 : 0),
    }
  })

  const examsSummary: HomeExamsSummary = {
    last7DaysCount: examsWithin7Days.length,
    avgDelta,
    withoutTopicsCount,
    weeklyAvgNet,
    recent: recentExams,
  }

  // -------------------------------------------------------------------------
  // 7. Program Özeti (G2b Eklentileriyle)
  // -------------------------------------------------------------------------
  let studentsWithoutTasksCount = 0
  for (const s of activeStudents) {
    const sTasks = activeStudentTasksMap.get(s.id) || []
    if (sTasks.length === 0) {
      studentsWithoutTasksCount++
    }
  }

  const thisWeekCompletedTasks = thisWeekTasks.filter((t) => t.completed).length

  // byDay (0..6)
  const byDay: HomeProgramDayItem[] = []
  for (let dIdx = 0; dIdx < 7; dIdx++) {
    const dayTasks = thisWeekTasks.filter((t) => t.day_index === dIdx)
    const dayDone = dayTasks.filter((t) => t.completed).length
    byDay.push({
      dayIndex: dIdx,
      planned: dayTasks.length,
      done: dayDone,
    })
  }

  // toDate: bugünün gün indeksine kadar olan görevler (0..currentDayIndex)
  const toDateTasks = thisWeekTasks.filter((t) => t.day_index <= currentDayIndex)
  const toDateDone = toDateTasks.filter((t) => t.completed).length
  const toDatePct =
    toDateTasks.length > 0 ? Math.round((toDateDone / toDateTasks.length) * 100) : 0

  const toDate: HomeProgramToDate = {
    planned: toDateTasks.length,
    done: toDateDone,
    pct: toDatePct,
  }

  // lastWeekSameDayPct
  let lastWeekSameDayPct: number | null = null
  const lastWeekAllTasks =
    (rawData.lastWeekTasks ? rawData.lastWeekTasks.filter((t) => !t.block_kind || t.block_kind === 'ders') : null) ||
    dersWeeklyTasks.filter((t) => t.week_start === lastWeekKeyStr)

  if (lastWeekAllTasks.length > 0) {
    const lwToDateTasks = lastWeekAllTasks.filter((t) => t.day_index <= currentDayIndex)
    if (lwToDateTasks.length > 0) {
      const lwDone = lwToDateTasks.filter((t) => t.completed).length
      lastWeekSameDayPct = Math.round((lwDone / lwToDateTasks.length) * 100)
    }
  }

  const programSummary: HomeProgramSummary = {
    thisWeekTotalTasks: thisWeekTasks.length,
    thisWeekCompletedTasks,
    completionRate:
      thisWeekTasks.length > 0
        ? Math.round((thisWeekCompletedTasks / thisWeekTasks.length) * 100)
        : null,
    studentsWithoutTasksCount,
    byDay,
    toDate,
    lastWeekSameDayPct,
  }

  // -------------------------------------------------------------------------
  // 8. Devamsızlık Özeti (G2b Eklentileriyle)
  // -------------------------------------------------------------------------
  let thisWeekAbsenceCount = 0
  let notifyNotOpenedCount = 0
  const attendanceByDay: number[] = [0, 0, 0, 0, 0, 0, 0]

  for (const rec of rawData.attendanceRecords) {
    if (rec.absence_date >= thisMonIsoStr && rec.absence_date <= thisSunIsoStr) {
      thisWeekAbsenceCount++
      const aIdx = getIsoDayIndex(rec.absence_date)
      if (aIdx >= 0 && aIdx < 7) {
        attendanceByDay[aIdx]++
      }
    }
    // Son 14 gün içinde notified_at boş (açılmamış / bildirilmemiş) kayıtlar
    if (rec.absence_date >= iso14DaysAgo && rec.absence_date <= todayIsoStr && !rec.notified_at) {
      notifyNotOpenedCount++
    }
  }

  let needsAttentionCount = 0
  for (const s of activeStudents) {
    const sRecords = studentAttendanceMap.get(s.id) || []
    if (checkAttendanceNeedsAttention(sRecords, todayIsoStr)) {
      needsAttentionCount++
    }
  }

  const attendanceSummary: HomeAttendanceSummary = {
    thisWeekAbsenceCount,
    needsAttentionCount,
    notifyNotOpenedCount,
    byDay: attendanceByDay,
  }

  // -------------------------------------------------------------------------
  // 9. Raporlar Özeti (HomeReportsSummary)
  // -------------------------------------------------------------------------
  const criticalDecisions = rawData.coachDecisions.filter((d) => d.state === 'kritik')
  const critTopicIds = new Set<number>()
  const critStudentIds = new Set<string>()
  const critCountByTopic = new Map<number, Set<string>>() // topicId -> Set of studentIds

  for (const cd of criticalDecisions) {
    critTopicIds.add(cd.topic_id)
    critStudentIds.add(cd.student_id)
    const stSet = critCountByTopic.get(cd.topic_id) || new Set<string>()
    stSet.add(cd.student_id)
    critCountByTopic.set(cd.topic_id, stSet)
  }

  let topTopic: { name: string; studentCount: number } | null = null
  let maxCritStudents = 0
  for (const [tId, stSet] of critCountByTopic) {
    if (stSet.size > maxCritStudents) {
      maxCritStudents = stSet.size
      const tInfo = topicMap.get(tId)
      topTopic = {
        name: tInfo ? tInfo.name : `Konu #${tId}`,
        studentCount: stSet.size,
      }
    }
  }

  // bySubject gruplaması
  const critCountBySubject = new Map<string, number>()
  for (const cd of criticalDecisions) {
    const tInfo = topicMap.get(cd.topic_id)
    let sName = 'Diğer'
    if (tInfo && tInfo.subject_id) {
      const subInfo = subjectMap.get(tInfo.subject_id)
      if (subInfo) sName = subInfo.name
    }
    critCountBySubject.set(sName, (critCountBySubject.get(sName) || 0) + 1)
  }

  const bySubject = Array.from(critCountBySubject.entries())
    .map(([subjectName, count]) => ({ subjectName, count }))
    .sort((a, b) => b.count - a.count)

  const reportsSummary: HomeReportsSummary = {
    criticalTopicCount: critTopicIds.size,
    studentsWithCritical: critStudentIds.size,
    topTopic,
    bySubject,
  }

  // -------------------------------------------------------------------------
  // 10. Son Hareketler Akışı (Recent Activity, max 10)
  // Görevler çıkarıldı; deneme, devamsızlık ve koç kararları eklendi.
  // -------------------------------------------------------------------------
  const activities: HomeRecentActivity[] = []

  for (const e of rawData.mockExams) {
    const student = studentMap.get(e.student_id)
    if (!student) continue
    activities.push({
      kind: 'exam',
      at: e.created_at || e.exam_date,
      studentName: student.full_name,
      text: `${e.name} (${e.exam_type}) — ${formatNetTr(e.totalNet)} net`,
    })
  }

  for (const a of rawData.attendanceRecords) {
    const student = studentMap.get(a.student_id)
    if (!student) continue
    const sessionLabel = SESSION_LABELS[a.session_type] || a.session_type
    const statusLabel = STATUS_LABELS[a.status] || a.status
    activities.push({
      kind: 'attendance',
      at: a.created_at || a.absence_date,
      studentName: student.full_name,
      text: `${sessionLabel}: ${statusLabel}`,
    })
  }

  for (const cd of rawData.coachDecisions) {
    const student = studentMap.get(cd.student_id)
    if (!student) continue
    const tInfo = topicMap.get(cd.topic_id)
    const topicName = tInfo ? tInfo.name : `Konu #${cd.topic_id}`
    activities.push({
      kind: 'decision',
      at: cd.decided_at,
      studentName: student.full_name,
      text: `${topicName} → ${cd.state}`,
    })
  }

  activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  const recentActivities = activities.slice(0, 10)

  return {
    students: studentsSummary,
    attention: attentionList,
    exams: examsSummary,
    program: programSummary,
    attendance: attendanceSummary,
    reports: reportsSummary,
    recent: recentActivities,
  }
}
