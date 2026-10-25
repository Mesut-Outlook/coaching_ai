/**
 * src/lib/homeSummary.ts
 *
 * Ana Sayfa / Panel Özeti Veri Katmanı (G2).
 * UI bileşenlerinden bağımsız, saf veri ve özet hesaplama modülü.
 *
 * Sorumluluklar:
 * 1. buildHomeSummary(rawData): Yan etkisiz, saf hesaplama motoru (test edilebilir).
 * 2. loadHomeSummary(scope): Supabase sorgularını kurum izolasyonu (StudentScope)
 *    ve 1000 satır sınırı korumasıyla yürüten asenkron yükleyici.
 */

import { supabase, isSupabaseConfigured } from './supabase'
import { fetchStudents } from './students'
import { mondayOf, weekKey } from './weeks'
import { gradeCurriculum } from './curriculum'
import { checkAttendanceNeedsAttention, isoDaysAgoFrom, SESSION_LABELS, STATUS_LABELS } from './attendance'
import { countExamsWithoutTopics } from './examReport'
import type { StudentScope } from '../contexts/AccessContext'
import type {
  AttendanceRecord,
  CoachDecision,
  MockExam,
  MockExamSection,
  Student,
  WeeklyTask,
} from '../types/database'

// ---------------------------------------------------------------------------
// Veri Sözleşmesi Tipleri
// ---------------------------------------------------------------------------

export type AttentionReasonKind =
  | 'kritik_karar'
  | 'net_dususu'
  | 'devamsizlik_takip'
  | 'program_dusuk'
  | 'program_yok'
  | 'deneme_yok'

export interface AttentionReason {
  kind: AttentionReasonKind
  label: string
  detail?: string | number | null
}

export interface StudentAttentionItem {
  studentId: string
  name: string
  reasons: AttentionReason[]
}

export interface HomeStudentsSummary {
  totalActive: number
  yksCount: number
  lgsCount: number
}

export interface HomeExamsSummary {
  last7DaysCount: number
  avgDelta: number | null
  withoutTopicsCount: number
}

export interface HomeProgramSummary {
  thisWeekTotalTasks: number
  thisWeekCompletedTasks: number
  completionRate: number | null
  studentsWithoutTasksCount: number
}

export interface HomeAttendanceSummary {
  thisWeekAbsenceCount: number
  needsAttentionCount: number
  whatsappPendingCount: number
}

export interface HomeRecentActivity {
  kind: 'exam' | 'task' | 'attendance'
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
  recent: HomeRecentActivity[]
}

// ---------------------------------------------------------------------------
// Girdi Tipleri (Saf Fonksiyon İçin)
// ---------------------------------------------------------------------------

export type EnrichedMockExam = MockExam & {
  totalNet: number
  sectionsList: MockExamSection[]
  hasTopics?: boolean
  topicResultsCount?: number
}

export interface HomeSummaryRawData {
  students: Student[]
  coachDecisions: CoachDecision[]
  mockExams: EnrichedMockExam[]
  weeklyTasks: WeeklyTask[]
  attendanceRecords: AttendanceRecord[]
  referenceDate?: Date | string
  isWeekHalfway?: boolean
}

// ---------------------------------------------------------------------------
// Ağırlık Haritası (Sıralama: Neden sayısı, ardından öncelik ağırlığı)
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

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Saf Hesaplama Fonksiyonu: buildHomeSummary
// ---------------------------------------------------------------------------

export function buildHomeSummary(rawData: HomeSummaryRawData): HomeSummary {
  const refDate = rawData.referenceDate
    ? typeof rawData.referenceDate === 'string'
      ? new Date(rawData.referenceDate)
      : rawData.referenceDate
    : new Date()

  const todayIsoStr = toIsoDate(refDate)
  const iso7DaysAgo = isoDaysAgoFrom(refDate, 7)
  const iso21DaysAgo = isoDaysAgoFrom(refDate, 21)

  const thisMon = mondayOf(refDate)
  const thisWeekKeyStr = weekKey(thisMon)
  const thisSun = new Date(thisMon.getTime() + 6 * 86400000)
  const thisSunIsoStr = toIsoDate(thisSun)
  const thisMonIsoStr = toIsoDate(thisMon)

  // Hafta en az yarılanmış mı? (Pazartesi=1 .. Perşembe=4, Pazar=0)
  // Perşembe veya sonrası (veya pazar) ise hafta en az yarılanmıştır (4. gün veya sonrası).
  const dayOfWeek = refDate.getDay()
  const weekHalfway =
    typeof rawData.isWeekHalfway === 'boolean'
      ? rawData.isWeekHalfway
      : dayOfWeek === 0 || dayOfWeek >= 4

  const activeStudents = rawData.students.filter((s) => s.is_active)
  const studentMap = new Map<string, Student>()
  for (const s of activeStudents) {
    studentMap.set(s.id, s)
  }

  // 1. Öğrenciler Dağılımı
  let yksCount = 0
  let lgsCount = 0
  for (const s of activeStudents) {
    if (gradeCurriculum(s.grade) === 'LGS') {
      lgsCount++
    } else {
      yksCount++
    }
  }
  const studentsSummary: HomeStudentsSummary = {
    totalActive: activeStudents.length,
    yksCount,
    lgsCount,
  }

  // 2. Denemeler Özeti
  const examsWithin7Days = rawData.mockExams.filter((e) => {
    return e.exam_date >= iso7DaysAgo && e.exam_date <= todayIsoStr
  })
  const withoutTopicsCount = countExamsWithoutTopics(rawData.mockExams)

  // Öğrenci bazında son ve önceki deneme net değişimi
  const studentDeltas: number[] = []
  const studentExamsMap = new Map<string, EnrichedMockExam[]>()
  for (const exam of rawData.mockExams) {
    const list = studentExamsMap.get(exam.student_id) || []
    list.push(exam)
    studentExamsMap.set(exam.student_id, list)
  }

  // Tarihe göre azalan sırala
  for (const [, exams] of studentExamsMap) {
    exams.sort((a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime())
  }

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

  const examsSummary: HomeExamsSummary = {
    last7DaysCount: examsWithin7Days.length,
    avgDelta,
    withoutTopicsCount,
  }

  // 3. Program Özeti
  const thisWeekTasks = rawData.weeklyTasks.filter((t) => t.week_start === thisWeekKeyStr)
  const activeStudentTasksMap = new Map<string, WeeklyTask[]>()
  for (const t of thisWeekTasks) {
    if (studentMap.has(t.student_id)) {
      const list = activeStudentTasksMap.get(t.student_id) || []
      list.push(t)
      activeStudentTasksMap.set(t.student_id, list)
    }
  }

  let studentsWithoutTasksCount = 0
  for (const s of activeStudents) {
    const sTasks = activeStudentTasksMap.get(s.id) || []
    if (sTasks.length === 0) {
      studentsWithoutTasksCount++
    }
  }

  const thisWeekCompletedTasks = thisWeekTasks.filter((t) => t.completed).length
  const programSummary: HomeProgramSummary = {
    thisWeekTotalTasks: thisWeekTasks.length,
    thisWeekCompletedTasks,
    completionRate:
      thisWeekTasks.length > 0
        ? Math.round((thisWeekCompletedTasks / thisWeekTasks.length) * 100)
        : null,
    studentsWithoutTasksCount,
  }

  // 4. Devamsızlık Özeti
  const studentAttendanceMap = new Map<string, AttendanceRecord[]>()
  let thisWeekAbsenceCount = 0
  let whatsappPendingCount = 0

  for (const rec of rawData.attendanceRecords) {
    if (rec.absence_date >= thisMonIsoStr && rec.absence_date <= thisSunIsoStr) {
      thisWeekAbsenceCount++
    }
    if (!rec.notified_at) {
      whatsappPendingCount++
    }
    const list = studentAttendanceMap.get(rec.student_id) || []
    list.push(rec)
    studentAttendanceMap.set(rec.student_id, list)
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
    whatsappPendingCount,
  }

  // 5. İlgi Bekleyen Öğrenciler (Attention Items)
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
      reasons.push({
        kind: 'kritik_karar',
        label: `${critList.length} kritik konu kararı`,
        detail: critList.length,
      })
    }

    // 2. Net düşüşü (son deneme bir öncekinden ≥ 5 net düşük)
    const sExams = studentExamsMap.get(s.id) || []
    const latestExam = sExams[0] || null
    if (latestExam) {
      const prevExam = sExams.find((e, idx) => idx > 0 && e.exam_type === latestExam.exam_type)
      if (prevExam) {
        const delta = round2(latestExam.totalNet - prevExam.totalNet)
        if (delta <= -5) {
          reasons.push({
            kind: 'net_dususu',
            label: `${latestExam.exam_type} denemesinde ${Math.abs(delta)} net düşüş`,
            detail: delta,
          })
        }
      }
    }

    // 3. Devamsızlık takip (Devamsızlık sayfasındaki ortak fonksiyonla)
    const sAttendance = studentAttendanceMap.get(s.id) || []
    if (checkAttendanceNeedsAttention(sAttendance, todayIsoStr)) {
      reasons.push({
        kind: 'devamsizlik_takip',
        label: 'Devamsızlık takibi gerekli',
      })
    }

    // 4. Program düşük veya program yok
    const sTasks = activeStudentTasksMap.get(s.id) || []
    if (sTasks.length === 0) {
      reasons.push({
        kind: 'program_yok',
        label: 'Bu hafta görev planlanmadı',
      })
    } else if (weekHalfway) {
      const compTasks = sTasks.filter((t) => t.completed).length
      const compPct = Math.round((compTasks / sTasks.length) * 100)
      if (compPct < 50) {
        reasons.push({
          kind: 'program_dusuk',
          label: `Haftalık tamamlama %${compPct}`,
          detail: compPct,
        })
      }
    }

    // 5. Deneme yok (son 21 günde hiç deneme girilmemiş)
    const recentExam = sExams.find((e) => e.exam_date >= iso21DaysAgo && e.exam_date <= todayIsoStr)
    if (!recentExam) {
      reasons.push({
        kind: 'deneme_yok',
        label: 'Son 21 günde deneme yok',
      })
    }

    if (reasons.length > 0) {
      attentionList.push({
        studentId: s.id,
        name: s.full_name,
        reasons,
      })
    }
  }

  // Sıralama: Neden sayısı, ardından en yüksek ağırlıklı neden, ardından toplam ağırlık
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

  // 6. Son Hareketler Akışı (Recent Activity, son 10 olay)
  const activities: HomeRecentActivity[] = []

  for (const e of rawData.mockExams) {
    const student = studentMap.get(e.student_id)
    if (!student) continue
    activities.push({
      kind: 'exam',
      at: e.created_at || e.exam_date,
      studentName: student.full_name,
      text: `${e.name} (${e.exam_type}) — ${round2(e.totalNet)} net`,
    })
  }

  for (const t of rawData.weeklyTasks) {
    const student = studentMap.get(t.student_id)
    if (!student) continue
    const taskName = t.custom_label || (t.is_exam ? 'Deneme Görevi' : 'Haftalık Görev')
    activities.push({
      kind: 'task',
      at: t.created_at,
      studentName: student.full_name,
      text: `${taskName} ${t.completed ? 'tamamlandı' : 'eklendi'} (${t.question_count} soru)`,
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

  activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  const recentActivities = activities.slice(0, 10)

  return {
    students: studentsSummary,
    attention: attentionList,
    exams: examsSummary,
    program: programSummary,
    attendance: attendanceSummary,
    recent: recentActivities,
  }
}

// ---------------------------------------------------------------------------
// Supabase Veri Yükleyici: loadHomeSummary
// ---------------------------------------------------------------------------

async function fetchAllWithPagination<T>(
  fetcher: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  let all: T[] = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await fetcher(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

export async function loadHomeSummary(scope: StudentScope): Promise<HomeSummary> {
  if (!isSupabaseConfigured) {
    return buildHomeSummary({
      students: [],
      coachDecisions: [],
      mockExams: [],
      weeklyTasks: [],
      attendanceRecords: [],
    })
  }

  // 1. Kurum/Koç kapsamına göre aktif öğrencileri çek
  const students = await fetchStudents({ activeOnly: true, orderBy: 'created_at', ...scope })
  if (!students || students.length === 0) {
    return buildHomeSummary({
      students: [],
      coachDecisions: [],
      mockExams: [],
      weeklyTasks: [],
      attendanceRecords: [],
    })
  }

  const studentIds = students.map((s) => s.id)
  const thisWeekStr = weekKey(mondayOf(new Date()))

  // 2. Öğrenci verilerini çek (1000 limitine takılmamak için sayfalama ile)
  const [tasks, rawExams, decisions, attendance] = await Promise.all([
    fetchAllWithPagination<WeeklyTask>((from, to) =>
      supabase
        .from('weekly_tasks')
        .select('*')
        .in('student_id', studentIds)
        .eq('week_start', thisWeekStr)
        .range(from, to)
    ),
    fetchAllWithPagination<MockExam>((from, to) =>
      supabase
        .from('mock_exams')
        .select('*')
        .in('student_id', studentIds)
        .order('exam_date', { ascending: false })
        .range(from, to)
    ),
    fetchAllWithPagination<CoachDecision>((from, to) =>
      supabase
        .from('coach_decisions')
        .select('*')
        .in('student_id', studentIds)
        .eq('state', 'kritik')
        .range(from, to)
    ),
    fetchAllWithPagination<AttendanceRecord>((from, to) =>
      supabase
        .from('attendance_records')
        .select('*')
        .in('student_id', studentIds)
        .order('absence_date', { ascending: false })
        .range(from, to)
    ),
  ])

  // 3. Denemelerin bölümlerini ve konu sayılarını çek
  const examIds = rawExams.map((e) => e.id)
  let sections: MockExamSection[] = []
  let topicCountsByExam: Record<string, number> = {}

  if (examIds.length > 0) {
    const [rawSections, rawTopics] = await Promise.all([
      fetchAllWithPagination<MockExamSection>((from, to) =>
        supabase
          .from('mock_exam_sections')
          .select('*')
          .in('mock_exam_id', examIds)
          .range(from, to)
      ),
      fetchAllWithPagination<{ mock_exam_id: string }>((from, to) =>
        supabase
          .from('mock_exam_topic_results')
          .select('mock_exam_id')
          .in('mock_exam_id', examIds)
          .range(from, to)
      ),
    ])

    sections = rawSections
    for (const t of rawTopics) {
      topicCountsByExam[t.mock_exam_id] = (topicCountsByExam[t.mock_exam_id] || 0) + 1
    }
  }

  // 4. Denemeleri zenginleştir
  const enrichedExams: EnrichedMockExam[] = rawExams.map((exam) => {
    const secs = sections.filter((s) => s.mock_exam_id === exam.id)
    const totalNet = round2(secs.reduce((sum, s) => sum + Number(s.net), 0))
    const topicResultsCount = topicCountsByExam[exam.id] || 0
    return {
      ...exam,
      totalNet,
      sectionsList: secs,
      hasTopics: topicResultsCount > 0,
      topicResultsCount,
    }
  })

  // 5. Saf hesaplama motoruna devret
  return buildHomeSummary({
    students,
    coachDecisions: decisions,
    mockExams: enrichedExams,
    weeklyTasks: tasks,
    attendanceRecords: attendance,
  })
}
