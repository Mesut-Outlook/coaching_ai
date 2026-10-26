import type { SupabaseClient } from '@supabase/supabase-js'
import { mondayOf, weekKey } from './weeks'
import type { Database } from '../types/database'
import {
  type TalkingPointsInput,
  type ExamTopicStats,
  type SubjectTrend,
  type TopicProgressInfo,
  type WeeklyProgramStats,
} from './talkingPointsCore'

export * from './talkingPointsCore'

/**
 * Supabase üzerinden bir öğrencinin görüşmede konuşulacak maddelerini (Talking Points)
 * oluşturmak için gerekli ham verileri toplar ve TalkingPointsInput formatına dönüştürür.
 */
export async function fetchTalkingPointsInput(
  supabase: SupabaseClient<Database>,
  studentId: string,
  referenceDate: Date = new Date()
): Promise<TalkingPointsInput> {
  const now = referenceDate
  const currentMonday = mondayOf(now)
  const currentWeekKey = weekKey(currentMonday)

  // 1. Öğrenci bilgisi
  const { data: student } = await supabase
    .from('students')
    .select('id, full_name')
    .eq('id', studentId)
    .single()

  // 2. Denemeler (son 4 deneme)
  const { data: recentExams } = await supabase
    .from('mock_exams')
    .select('id, exam_date, exam_type, name')
    .eq('student_id', studentId)
    .order('exam_date', { ascending: false })
    .limit(4)

  const examIds = (recentExams || []).map((e) => e.id)
  const examTopicStatsMap = new Map<number, ExamTopicStats>()
  const sectionNetsMap = new Map<string, { name: string; netsByExam: Map<string, number> }>()

  if (examIds.length > 0) {
    // 2.1 Konu bazlı deneme sonuçları
    const { data: topicResults } = await supabase
      .from('mock_exam_topic_results')
      .select('mock_exam_id, exam_topic_id, correct_count, wrong_count, blank_count, exam_topics(id, name)')
      .in('mock_exam_id', examIds)

    // exam_topic_links bağlantılarını çek
    const uniqueExamTopicIds = Array.from(new Set((topicResults || []).map((r) => r.exam_topic_id)))
    const { data: topicLinks } = uniqueExamTopicIds.length > 0
      ? await supabase
          .from('exam_topic_links')
          .select('exam_topic_id, topic_id, is_primary')
          .in('exam_topic_id', uniqueExamTopicIds)
      : { data: [] }

    const primaryTopicMap = new Map<number, number>()
    for (const link of topicLinks || []) {
      if (link.is_primary || !primaryTopicMap.has(link.exam_topic_id)) {
        primaryTopicMap.set(link.exam_topic_id, link.topic_id)
      }
    }

    // Topla
    const examSetByTopic = new Map<number, Set<string>>()
    for (const row of topicResults || []) {
      const etId = row.exam_topic_id
      const etName = (row.exam_topics as any)?.name || `Konu #${etId}`
      const totalQ = (row.correct_count || 0) + (row.wrong_count || 0) + (row.blank_count || 0)
      const correct = row.correct_count || 0

      if (!examTopicStatsMap.has(etId)) {
        examTopicStatsMap.set(etId, {
          examTopicId: etId,
          examTopicName: etName,
          curriculumTopicId: primaryTopicMap.get(etId) ?? null,
          totalQuestions: 0,
          correctQuestions: 0,
          accuracyPct: 0,
          examCount: 0,
        })
        examSetByTopic.set(etId, new Set<string>())
      }

      const st = examTopicStatsMap.get(etId)!
      st.totalQuestions += totalQ
      st.correctQuestions += correct
      examSetByTopic.get(etId)?.add(row.mock_exam_id)
    }

    for (const [etId, st] of examTopicStatsMap.entries()) {
      st.examCount = examSetByTopic.get(etId)?.size || 0
      st.accuracyPct = st.totalQuestions > 0 ? Math.round((st.correctQuestions / st.totalQuestions) * 100) : 0
    }

    // 2.2 Bölüm bazlı netler (Son 3-4 deneme, kronolojik sıra için)
    const { data: sectionResults } = await supabase
      .from('mock_exam_sections')
      .select('mock_exam_id, section_name, net')
      .in('mock_exam_id', examIds)

    for (const row of sectionResults || []) {
      const sName = row.section_name
      if (!sectionNetsMap.has(sName)) {
        sectionNetsMap.set(sName, { name: sName, netsByExam: new Map() })
      }
      sectionNetsMap.get(sName)!.netsByExam.set(row.mock_exam_id, Number(row.net) || 0)
    }
  }

  // Denemeleri kronolojik (en eskiden en yeniye) sırala
  const chronologicalExams = [...(recentExams || [])].reverse()
  const subjectTrends: SubjectTrend[] = []
  for (const [sName, info] of sectionNetsMap.entries()) {
    const examNets: number[] = []
    for (const ex of chronologicalExams) {
      if (info.netsByExam.has(ex.id)) {
        examNets.push(info.netsByExam.get(ex.id)!)
      }
    }
    if (examNets.length > 0) {
      subjectTrends.push({
        subjectId: sName,
        subjectName: info.name,
        examNets,
      })
    }
  }

  // 3. Haftalık Program İstatistikleri
  const { data: thisWeekTasks } = await supabase
    .from('weekly_tasks')
    .select('id, day_index, completed')
    .eq('student_id', studentId)
    .eq('week_start', currentWeekKey)

  let programStats: WeeklyProgramStats | null = null
  if (thisWeekTasks && thisWeekTasks.length > 0) {
    const total = thisWeekTasks.length
    const completed = thisWeekTasks.filter((t) => t.completed).length
    const pct = Math.round((completed / total) * 100)
    // Hafta yarılandı mı? Çarşamba (3) veya sonrası (pazar=0 ise 6 gün geçmiş)
    const dayOfWeek = now.getDay()
    const isoDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 0: Pzt, 1: Sal, 2: Çar...
    const isWeekHalfway = isoDay >= 2 // Çarşamba ve sonrası

    const uncompletedDayIndices = Array.from(
      new Set(thisWeekTasks.filter((t) => !t.completed).map((t) => t.day_index))
    ).sort((a, b) => a - b)

    programStats = {
      currentWeekTotalTasks: total,
      currentWeekCompletedTasks: completed,
      currentWeekCompletionPct: pct,
      isWeekHalfway,
      uncompletedDayIndices,
    }
  }

  // 4. Konu İlerlemesi & Koç Kararları & Ölçümler
  const [{ data: coachDecisions }, { data: recentTasks }, { data: topicMeasurements }] = await Promise.all([
    supabase.from('coach_decisions').select('*').eq('student_id', studentId),
    supabase
      .from('weekly_tasks')
      .select('topic_id, created_at, completed, correct_count, wrong_count, blank_count')
      .eq('student_id', studentId)
      .not('topic_id', 'is', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('topic_measurements')
      .select('topic_id, accuracy_pct, measured_at')
      .eq('student_id', studentId)
      .order('measured_at', { ascending: false }),
  ])

  // Tüm konuları çek (isimleri almak için)
  const { data: allTopics } = await supabase.from('topics').select('id, name, subjects(name)')

  const topicNameMap = new Map<number, { name: string; subjectName?: string }>()
  for (const t of allTopics || []) {
    topicNameMap.set(t.id, {
      name: t.name,
      subjectName: (t.subjects as any)?.name,
    })
  }

  // Görev verilerini topla (son 4 hafta ve son görev tarihi)
  const fourWeeksAgoMs = now.getTime() - 28 * 86400000
  const topicTaskStats = new Map<number, { lastTaskAt: string | null; qCount: number; correctCount: number }>()

  for (const t of recentTasks || []) {
    if (!t.topic_id) continue
    if (!topicTaskStats.has(t.topic_id)) {
      topicTaskStats.set(t.topic_id, {
        lastTaskAt: t.created_at,
        qCount: 0,
        correctCount: 0,
      })
    }
    const stat = topicTaskStats.get(t.topic_id)!
    const isRecent = new Date(t.created_at).getTime() >= fourWeeksAgoMs
    if (isRecent && t.completed && t.correct_count !== null) {
      const q = (t.correct_count || 0) + (t.wrong_count || 0) + (t.blank_count || 0)
      stat.qCount += q
      stat.correctCount += t.correct_count || 0
    }
  }

  // Son ölçümleri topla
  const latestMeasMap = new Map<number, { accuracy: number; measuredAt: string }>()
  for (const m of topicMeasurements || []) {
    if (!latestMeasMap.has(m.topic_id)) {
      latestMeasMap.set(m.topic_id, {
        accuracy: Number(m.accuracy_pct),
        measuredAt: m.measured_at,
      })
    }
  }

  // TopicProgressInfo listesini inşa et
  const topicProgress: TopicProgressInfo[] = []
  const decisionMap = new Map<number, any>()
  for (const d of coachDecisions || []) {
    decisionMap.set(d.topic_id, d)
  }

  // Değerlendirilmesi gereken konu ID'leri (karar verilmiş, görev açılmış veya ölçüm yapılmış)
  const candidateTopicIds = new Set<number>([
    ...Array.from(decisionMap.keys()),
    ...Array.from(topicTaskStats.keys()),
    ...Array.from(latestMeasMap.keys()),
  ])

  for (const topId of candidateTopicIds) {
    const tInfo = topicNameMap.get(topId)
    const tName = tInfo?.name || `Konu #${topId}`
    const sName = tInfo?.subjectName
    const dec = decisionMap.get(topId)
    const taskStat = topicTaskStats.get(topId)
    const meas = latestMeasMap.get(topId)

    // Tutarsızlık için deneme başarısı eşleşmesi (varsa)
    let matchedExamAccuracy: number | undefined
    for (const st of examTopicStatsMap.values()) {
      if (st.curriculumTopicId === topId && st.totalQuestions > 0) {
        matchedExamAccuracy = st.accuracyPct
        break
      }
    }

    const taskQuestions = taskStat?.qCount || 0
    const taskAccuracy = taskQuestions > 0 ? Math.round((taskStat!.correctCount / taskQuestions) * 100) : undefined

    topicProgress.push({
      topicId: topId,
      topicName: tName,
      subjectName: sName,
      lastMeasuredAccuracy: meas ? meas.accuracy : null,
      lastMeasuredAt: meas ? meas.measuredAt : null,
      lastTaskAt: taskStat?.lastTaskAt ?? null,
      coachDecisionState: dec?.state ?? null,
      taskQuestions,
      taskAccuracy,
      examAccuracy: matchedExamAccuracy,
    })
  }

  return {
    studentId,
    studentName: student?.full_name,
    examTopicStats: Array.from(examTopicStatsMap.values()),
    subjectTrends,
    topicProgress,
    programStats,
    referenceDate: now,
  }
}
