/**
 * src/lib/report360.ts
 *
 * Koç 360 Raporu Veri Yükleyicisi (R2-1).
 * Sayfalama, 200'lük chunking ve müfredat süzgeciyle ham verileri çeker,
 * `report360Core.ts` içindeki saf motora aktarır.
 */

import { supabase, isSupabaseConfigured } from './supabase'
import { subjectAppliesTo, topicAppliesTo } from './curriculum'
import { weightedNet, wrongPenaltyFor } from './examSections'
import {
  type Report360Input,
  type Report360Data,
  type RawExamItem,
  type RawTopicResultItem,
  type RawSectionResultItem,
  type RawTopicLinkItem,
  type RawCoachDecisionItem,
  type RawTaskItem,
  type RawMeasurementItem,
  type RawCurriculumTopicItem,
  type GlobalExamTopicWeight,
  buildReport360,
} from './report360Core'
import type { ExamType, ErrorBasketItem } from '../types/database'

export * from './report360Core'

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

function getSubjectColorToken(subjectName: string): string {
  const lower = subjectName.toLowerCase()
  if (lower.includes('mat') || lower.includes('geo')) return 'var(--c-math)'
  if (lower.includes('türk') || lower.includes('edeb')) return 'var(--c-turkce)'
  if (lower.includes('fiz') || lower.includes('kim') || lower.includes('biyo') || lower.includes('fen')) return 'var(--c-fen)'
  if (lower.includes('tar') || lower.includes('coğ') || lower.includes('fel') || lower.includes('din') || lower.includes('sos')) return 'var(--c-sosyal)'
  return 'var(--indigo-600)'
}

export async function loadReport360Data(
  studentId: string,
  examType: ExamType,
  referenceDate: Date = new Date()
): Promise<Report360Data | null> {
  if (!isSupabaseConfigured || !studentId) return null

  // 1. Öğrenci bilgisi ve hedef neti
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .single()

  if (studentError || !student) {
    console.error('Report360: Student not found', studentError)
    return null
  }

  let targetNet: number | null = null
  if (examType === 'TYT') targetNet = student.target_net_tyt ?? null
  else if (examType === 'AYT') targetNet = student.target_net_ayt ?? null
  else if (examType === 'LGS') targetNet = student.target_net_lgs ?? null

  // 2. Ulusal Sınav Tarihi (exam_calendar)
  const calendarKey = examType === 'LGS' ? 'LGS' : 'YKS'
  const { data: calendarData } = await supabase
    .from('exam_calendar')
    .select('exam_date')
    .eq('exam', calendarKey)
    .maybeSingle()

  const examDate = calendarData?.exam_date ?? null

  // 3. Öğrencinin seçili sınav türündeki denemeleri
  const { data: examsData, error: examsError } = await supabase
    .from('mock_exams')
    .select('id, name, exam_date, exam_type')
    .eq('student_id', studentId)
    .eq('exam_type', examType)
    .order('exam_date', { ascending: true })

  if (examsError) {
    console.error('Report360: Mock exams error', examsError)
  }

  const examList = examsData || []
  const examIds = examList.map((e) => e.id)
  const examChunks = chunkArray(examIds, 200)

  // 4. Deneme Bölüm Sonuçları (mock_exam_sections)
  const rawSections: RawSectionResultItem[] = []
  const examSectionMap = new Map<string, Array<{ section_name: string; net: number }>>()

  for (const chunk of examChunks) {
    const { data: secs } = await supabase
      .from('mock_exam_sections')
      .select('mock_exam_id, section_name, correct_count, wrong_count, blank_count, max_questions, net')
      .in('mock_exam_id', chunk)
      .order('id', { ascending: true })

    for (const s of secs || []) {
      rawSections.push({
        mock_exam_id: s.mock_exam_id,
        section_name: s.section_name,
        correct_count: Number(s.correct_count) || 0,
        wrong_count: Number(s.wrong_count) || 0,
        blank_count: Number(s.blank_count) || 0,
        max_questions: Number(s.max_questions) || 0,
      })

      if (!examSectionMap.has(s.mock_exam_id)) {
        examSectionMap.set(s.mock_exam_id, [])
      }
      examSectionMap.get(s.mock_exam_id)!.push({
        section_name: s.section_name,
        net: Number(s.net) || 0,
      })
    }
  }

  // RawExamItem listesini net ile zenginleştir
  const rawExams: RawExamItem[] = examList.map((e) => {
    const secs = examSectionMap.get(e.id) || []
    let totalNet = 0
    if (examType === 'LGS') {
      totalNet = weightedNet(secs)
    } else {
      totalNet = secs.reduce((acc, s) => acc + s.net, 0)
    }

    return {
      id: e.id,
      name: e.name,
      exam_date: e.exam_date,
      exam_type: e.exam_type,
      net: Math.round(totalNet * 100) / 100,
    }
  })

  // 5. Konu Bazlı Deneme Sonuçları (mock_exam_topic_results)
  const rawTopicResults: RawTopicResultItem[] = []
  const rawExamTopicIds = new Set<number>()

  for (const chunk of examChunks) {
    let offset = 0
    const PAGE_SIZE = 1000
    while (true) {
      const { data: topicRes, error: trErr } = await supabase
        .from('mock_exam_topic_results')
        .select('mock_exam_id, exam_topic_id, correct_count, wrong_count, blank_count, question_count')
        .in('mock_exam_id', chunk)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)

      if (trErr || !topicRes || topicRes.length === 0) break

      for (const tr of topicRes) {
        rawExamTopicIds.add(tr.exam_topic_id)
        rawTopicResults.push({
          mock_exam_id: tr.mock_exam_id,
          exam_topic_id: tr.exam_topic_id,
          exam_topic_name: '', // exam_topics ile zenginleştirilecek
          exam_subject_name: '',
          correct_count: Number(tr.correct_count) || 0,
          wrong_count: Number(tr.wrong_count) || 0,
          blank_count: Number(tr.blank_count) || 0,
          question_count: Number(tr.question_count) || 0,
        })
      }

      if (topicRes.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }
  }

  // exam_topics detaylarını çek
  const examTopicIdArray = Array.from(rawExamTopicIds)
  const topicIdChunks = chunkArray(examTopicIdArray, 200)
  const examTopicMetaMap = new Map<
    number,
    { name: string; subjectName: string; colorToken?: string }
  >()

  for (const chunk of topicIdChunks) {
    const { data: ets } = await supabase
      .from('exam_topics')
      .select('id, name, exam_subjects(label, section_name, subjects(color, sort_order))')
      .in('id', chunk)
      .order('id', { ascending: true })

    for (const et of ets || []) {
      const s = et.exam_subjects as any
      const subj = s?.subjects as any
      const subjName = s?.label || s?.section_name || ''
      const subjColor = subj?.color || getSubjectColorToken(subjName)
      examTopicMetaMap.set(et.id, {
        name: et.name,
        subjectName: subjName,
        colorToken: subjColor,
      })
    }
  }

  // Konu sonuçlarını adlarla doldur
  for (const tr of rawTopicResults) {
    const meta = examTopicMetaMap.get(tr.exam_topic_id)
    if (meta) {
      tr.exam_topic_name = meta.name
      tr.exam_subject_name = meta.subjectName
      tr.subject_color_token = meta.colorToken
    }
  }

  // 6. Karne Konu -> Müfredat Bağlantıları (exam_topic_links, yalnız is_primary)
  const rawTopicLinks: RawTopicLinkItem[] = []
  for (const chunk of topicIdChunks) {
    const { data: links } = await supabase
      .from('exam_topic_links')
      .select('exam_topic_id, topic_id, is_primary')
      .in('exam_topic_id', chunk)
      .eq('is_primary', true)
      .order('topic_id', { ascending: true })

    for (const l of links || []) {
      rawTopicLinks.push({
        exam_topic_id: l.exam_topic_id,
        topic_id: l.topic_id,
        is_primary: l.is_primary,
      })
    }
  }

  // 7. Koç Kararları (coach_decisions)
  const { data: decisionsData } = await supabase
    .from('coach_decisions')
    .select('topic_id, state, decided_at')
    .eq('student_id', studentId)
    .order('decided_at', { ascending: false })

  const rawDecisions: RawCoachDecisionItem[] = (decisionsData || []).map((d) => ({
    topic_id: d.topic_id,
    state: d.state,
    decided_at: d.decided_at,
  }))

  // 8. Haftalık Görevler (weekly_tasks) - Yalnızca ders blokları
  const { data: tasksData } = await supabase
    .from('weekly_tasks')
    .select('id, topic_id, task_type, completed, completed_at, created_at, correct_count, wrong_count, blank_count, question_count, origin_kind, duration_min, block_kind')
    .eq('student_id', studentId)
    .eq('block_kind', 'ders')
    .order('created_at', { ascending: false })

  const rawTasks: RawTaskItem[] = (tasksData || []).map((t) => ({
    id: t.id,
    topic_id: t.topic_id,
    task_type: t.task_type || 'konu',
    completed: t.completed,
    completed_at: t.completed_at ?? null,
    created_at: t.created_at,
    correct_count: t.correct_count ?? null,
    wrong_count: t.wrong_count ?? null,
    blank_count: t.blank_count ?? null,
    question_count: t.question_count,
    origin_kind: t.origin_kind ?? null,
    duration_min: t.duration_min ?? null,
    block_kind: t.block_kind,
  }))

  // 8b. Konu Ölçüm Geçmişi (topic_exam_measurements + topic_measurements)
  const rawMeasurements: RawMeasurementItem[] = []
  const { data: mExamData } = await supabase
    .from('topic_exam_measurements')
    .select('topic_id, accuracy_pct, measured_at, source_label')
    .eq('student_id', studentId)
    .order('measured_at', { ascending: true })

  for (const m of mExamData || []) {
    rawMeasurements.push({
      topic_id: m.topic_id,
      accuracy_pct: Number(m.accuracy_pct) || 0,
      measured_at: m.measured_at,
      source_label: m.source_label || 'Deneme',
    })
  }

  const { data: mData } = await supabase
    .from('topic_measurements')
    .select('topic_id, accuracy_pct, measured_at, source')
    .eq('student_id', studentId)
    .order('measured_at', { ascending: true })

  for (const m of mData || []) {
    rawMeasurements.push({
      topic_id: m.topic_id,
      accuracy_pct: Number(m.accuracy_pct) || 0,
      measured_at: m.measured_at,
      source_label: m.source || 'Ölçüm',
    })
  }

  // 9. Öğrencinin sınıfına uyan Müfredat Konuları (topics + subjects)
  const { data: allSubjects } = await supabase
    .from('subjects')
    .select('*')
    .order('sort_order', { ascending: true })

  const { data: allCurriculumTopics } = await supabase
    .from('topics')
    .select('*')
    .order('sort_order', { ascending: true })

  const rawCurriculumTopics: RawCurriculumTopicItem[] = []
  const grade = student.grade

  for (const s of allSubjects || []) {
    if (!subjectAppliesTo(s, grade)) continue

    const subTopics = (allCurriculumTopics || []).filter(
      (t) => t.subject_id === s.id && topicAppliesTo(t, s, grade)
    )

    for (const t of subTopics) {
      rawCurriculumTopics.push({
        id: t.id,
        name: t.name,
        subject_id: s.id,
        subject_name: s.name,
      })
    }
  }

  // 10. Global / Kurum Geneli Konu Soru Ağırlıkları (R4-1: ÖSYM / MEB resmi dağılımları öncelikli)
  const globalWeights: GlobalExamTopicWeight[] = []

  // Önce topic_weights tablosunu kontrol et
  const { data: dbWeights, error: weightsErr } = await supabase
    .from('topic_weights')
    .select('exam_topic_id, avg_questions, source')
    .eq('exam_type', examType)

  if (!weightsErr && dbWeights && dbWeights.length > 0) {
    for (const w of dbWeights) {
      globalWeights.push({
        exam_topic_id: w.exam_topic_id,
        avg_questions: Number(w.avg_questions) || 0,
        source: w.source,
      })
    }
  } else if (examTopicIdArray.length > 0) {
    const countMap = new Map<number, { sumQ: number; cnt: number }>()
    const PAGE_SIZE = 1000

    for (const chunk of topicIdChunks) {
      let offset = 0
      while (true) {
        const { data: chunkStats, error: statsErr } = await supabase
          .from('mock_exam_topic_results')
          .select('id, exam_topic_id, question_count, correct_count, wrong_count, blank_count')
          .in('exam_topic_id', chunk)
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1)

        if (statsErr || !chunkStats || chunkStats.length === 0) break

        for (const row of chunkStats) {
          const q = row.question_count || (row.correct_count + row.wrong_count + row.blank_count)
          if (!countMap.has(row.exam_topic_id)) {
            countMap.set(row.exam_topic_id, { sumQ: 0, cnt: 0 })
          }
          const st = countMap.get(row.exam_topic_id)!
          st.sumQ += q
          st.cnt++
        }

        if (chunkStats.length < PAGE_SIZE) break
        offset += PAGE_SIZE
      }
    }

    for (const [etId, st] of countMap.entries()) {
      if (st.cnt > 0) {
        globalWeights.push({
          exam_topic_id: etId,
          avg_questions: Math.round((st.sumQ / st.cnt) * 100) / 100,
        })
      }
    }
  }

  // 11. Hata Sepeti / Yanlış Nedenleri (error_basket_items)
  const rawErrorBasketItems: ErrorBasketItem[] = []
  if (examIds.length > 0) {
    for (const chunk of examChunks) {
      const { data: eItems, error: eErr } = await supabase
        .from('error_basket_items')
        .select('id, mock_exam_id, topic_id, error_type, created_at')
        .in('mock_exam_id', chunk)
        .order('created_at', { ascending: false })

      if (eErr) {
        console.error('Report360: Error basket items error', eErr)
      }
      if (eItems) {
        rawErrorBasketItems.push(...(eItems as ErrorBasketItem[]))
      }
    }
  }

  // 12. Kurum içi anonim karşılaştırma (R4-2: son 30 günün en iyi netleri)
  let peerComparisonInput: { studentBestNet: number | null; peerBestNets: number[] } | undefined = undefined
  const thirtyDaysAgo = new Date(referenceDate.getTime() - 30 * 86400000).toISOString().split('T')[0]
  const { data: recentExamsData, error: recentExamsError } = await supabase
    .from('mock_exams')
    .select('id, student_id')
    .eq('exam_type', examType)
    .gte('exam_date', thirtyDaysAgo)

  if (recentExamsError) {
    console.error('Report360: Recent exams peer comparison error', recentExamsError)
  }

  if (recentExamsData && recentExamsData.length > 0) {
    const recentExamIds = recentExamsData.map((e) => e.id)
    const recentChunks = chunkArray(recentExamIds, 200)
    const examNetMap = new Map<string, number>()

    for (const chunk of recentChunks) {
      const { data: secs } = await supabase
        .from('mock_exam_sections')
        .select('mock_exam_id, net')
        .in('mock_exam_id', chunk)

      if (secs) {
        for (const s of secs) {
          examNetMap.set(s.mock_exam_id, (examNetMap.get(s.mock_exam_id) || 0) + (Number(s.net) || 0))
        }
      }
    }

    const studentBestNetMap = new Map<string, number>()
    for (const ex of recentExamsData) {
      const net = examNetMap.get(ex.id) || 0
      const currentBest = studentBestNetMap.get(ex.student_id)
      if (currentBest === undefined || net > currentBest) {
        studentBestNetMap.set(ex.student_id, net)
      }
    }

    peerComparisonInput = {
      studentBestNet: studentBestNetMap.get(studentId) ?? null,
      peerBestNets: Array.from(studentBestNetMap.values()),
    }
  }

  // 13. Saf motoru çalıştır
  const input: Report360Input = {
    studentId,
    studentName: student.full_name,
    studentGrade: grade,
    examType,
    targetNet,
    examDate,
    referenceDate,
    wrongPenalty: wrongPenaltyFor(examType),
    exams: rawExams,
    topicResults: rawTopicResults,
    sectionResults: rawSections,
    topicLinks: rawTopicLinks,
    coachDecisions: rawDecisions,
    tasks: rawTasks,
    curriculumTopics: rawCurriculumTopics,
    globalTopicWeights: globalWeights,
    topicMeasurements: rawMeasurements,
    errorBasketItems: rawErrorBasketItems,
    peerComparison: peerComparisonInput,
  }

  return buildReport360(input)
}
