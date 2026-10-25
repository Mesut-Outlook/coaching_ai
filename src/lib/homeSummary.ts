/**
 * src/lib/homeSummary.ts
 *
 * Ana Sayfa / Panel Özeti Asenkron Supabase Veri Yükleyicisi (G2 + G2b).
 * Saf iş mantığı `homeSummaryCore.ts` içindedir; bu dosya veri çekme ve parça yönetimi yapar.
 */

import { supabase, isSupabaseConfigured } from './supabase'
import { fetchStudents } from './students'
import { mondayOf, weekKey } from './weeks'
import {
  buildHomeSummary,
  chunkArray,
  round2,
  type EnrichedMockExam,
  type HomeSummary,
  type SubjectInfo,
  type TopicInfo,
} from './homeSummaryCore'
import type { StudentScope } from '../contexts/AccessContext'
import type {
  AttendanceRecord,
  CoachDecision,
  MockExam,
  MockExamSection,
  WeeklyTask,
} from '../types/database'

export * from './homeSummaryCore'

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
  const now = new Date()
  const thisMon = mondayOf(now)
  const thisWeekStr = weekKey(thisMon)
  const lastMon = new Date(thisMon.getTime() - 7 * 86400000)
  const lastWeekStr = weekKey(lastMon)

  // 2. Konu ve Ders referans listelerini çek (join/raporlar için)
  const [topicsRes, subjectsRes] = await Promise.all([
    supabase.from('topics').select('id, name, subject_id'),
    supabase.from('subjects').select('id, name'),
  ])
  const topics: TopicInfo[] = (topicsRes.data as TopicInfo[]) || []
  const subjects: SubjectInfo[] = (subjectsRes.data as SubjectInfo[]) || []

  // 3. Öğrenci verilerini çek (1000 satır sınırına karşı sayfalama ile)
  // Bu hafta ve geçen haftanın görevlerini birlikte çekiyoruz
  const [tasks, rawExams, decisions, attendance] = await Promise.all([
    fetchAllWithPagination<WeeklyTask>((from, to) =>
      supabase
        .from('weekly_tasks')
        .select('*')
        .in('student_id', studentIds)
        .in('week_start', [thisWeekStr, lastWeekStr])
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

  // 4. Denemelerin bölümlerini ve konu sayılarını 200'lük parçalar halinde çek (URL sınırı koruması)
  const examIds = rawExams.map((e) => e.id)
  let sections: MockExamSection[] = []
  const topicCountsByExam: Record<string, number> = {}

  if (examIds.length > 0) {
    const examIdChunks = chunkArray(examIds, 200)

    for (const chunk of examIdChunks) {
      const [chunkSections, chunkTopics] = await Promise.all([
        fetchAllWithPagination<MockExamSection>((from, to) =>
          supabase
            .from('mock_exam_sections')
            .select('*')
            .in('mock_exam_id', chunk)
            .range(from, to)
        ),
        fetchAllWithPagination<{ mock_exam_id: string }>((from, to) =>
          supabase
            .from('mock_exam_topic_results')
            .select('mock_exam_id')
            .in('mock_exam_id', chunk)
            .range(from, to)
        ),
      ])

      sections = sections.concat(chunkSections)
      for (const t of chunkTopics) {
        topicCountsByExam[t.mock_exam_id] = (topicCountsByExam[t.mock_exam_id] || 0) + 1
      }
    }
  }

  // 5. Denemeleri zenginleştir
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

  // Görevleri bu hafta ve geçen hafta olarak ayır
  const thisWeekTasks = tasks.filter((t) => t.week_start === thisWeekStr)
  const lastWeekTasks = tasks.filter((t) => t.week_start === lastWeekStr)

  // 6. Saf hesaplama motoruna devret
  return buildHomeSummary({
    students,
    coachDecisions: decisions,
    mockExams: enrichedExams,
    weeklyTasks: thisWeekTasks,
    lastWeekTasks,
    attendanceRecords: attendance,
    topics,
    subjects,
  })
}
