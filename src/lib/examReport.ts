/**
 * src/lib/examReport.ts
 *
 * Deneme Karnesi ve Gelişim Analizi Tek Motoru (Saf TypeScript, React yok).
 * Koç ekranı (Deneme Analizi sekmesi, Sonuçlar sekmesi) ve öğrenci/veli portalı
 * aynı analiz fonksiyonundan beslenir, mantık kopyalanmaz.
 *
 * Formüller (Spec §6 & karneyle birebir aynı):
 * - Net = D − Y / ceza (LGS: 3, TYT/AYT: 4; wrongPenaltyFor)
 * - Ders / bölüm başarı % = net / soru × 100
 * - Konu başarı % = D / S × 100
 * - Kayıp net = S − (D − Y / ceza)
 * - Değişim (Δ) = son deneme − bir önceki AYNI exam_type deneme
 * - Birikimli Σ = tüm denemeler toplamı
 * - Asgari veri kuralı: Çizgi grafiği için en az 3 aynı tür deneme;
 *   konu yüzdesi ve uyarılar için konuda en az 3 soru.
 */

import type { ExamType } from '../types/database'
import { wrongPenaltyFor } from './examSections'

// ---------------------------------------------------------------------------
// Girdi Tipleri
// ---------------------------------------------------------------------------

export type RawExamSectionResult = {
  id?: string
  mock_exam_id?: string
  section_name: string
  max_questions: number
  correct_count: number
  wrong_count: number
  blank_count?: number
  wrong_penalty?: number
  net?: number
}

export type RawExamSubjectResult = {
  id?: string
  mock_exam_id?: string
  exam_subject_id: number
  question_count: number
  correct_count: number
  wrong_count: number
  blank_count?: number
  wrong_penalty?: number
  net?: number
}

export type RawExamTopicResult = {
  id?: string
  mock_exam_id?: string
  exam_topic_id: number
  question_count: number
  correct_count: number
  wrong_count: number
  blank_count?: number
}

export type RawExamRecord = {
  id: string
  student_id: string
  name: string
  publisher?: string | null
  exam_type: ExamType
  exam_date: string
  score?: number | null
  percentile?: number | null
  ranks?: Record<string, { sira?: number; katilan?: number }> | null
  coach_note?: string | null
  created_at?: string
  sections?: RawExamSectionResult[]
  subject_results?: RawExamSubjectResult[]
  topic_results?: RawExamTopicResult[]
}

export type ExamCatalogSubjectInfo = {
  id: number
  exam_type: ExamType
  section_name: string
  subject_id: number
  label: string
  question_count: number
  choice_group?: string | null
  sort_order?: number
}

export type ExamCatalogTopicInfo = {
  id: number
  exam_subject_id: number
  name: string
  grades?: string[]
  sort_order?: number
  is_active?: boolean
}

export type ExamReportCatalog = {
  subjects: ExamCatalogSubjectInfo[]
  topics: ExamCatalogTopicInfo[]
}

// ---------------------------------------------------------------------------
// Çıktı Tipleri
// ---------------------------------------------------------------------------

export type MasteryBand = 'good' | 'medium' | 'weak' | 'none'

export function getMasteryBand(percentage: number | null): MasteryBand {
  if (percentage == null || isNaN(percentage)) return 'none'
  if (percentage >= 75) return 'good'
  if (percentage >= 50) return 'medium'
  return 'weak'
}

export type GeneralTimeSeriesPoint = {
  exam_id: string
  exam_name: string
  exam_date: string
  net: number
  accuracy_pct: number
}

export type GeneralLevelData = {
  latest_exam: {
    id: string
    name: string
    publisher: string | null
    exam_date: string
    exam_type: ExamType
    question_count: number
    correct_count: number
    wrong_count: number
    blank_count: number
    net: number
    accuracy_pct: number
    delta_net: number | null
    delta_pct: number | null
    score: number | null
    percentile: number | null
    ranks: Record<string, { sira?: number; katilan?: number }> | null
    coach_note: string | null
  } | null
  headline: string
  time_series: GeneralTimeSeriesPoint[]
  average_net: number
  min_data_reached: boolean
  min_data_notice: string | null
}

export type SubjectCell = {
  exam_id: string
  exam_date: string
  exam_name: string
  entered: boolean
  question_count: number
  correct_count: number
  wrong_count: number
  blank_count: number
  net: number
  accuracy_pct: number
  loss_net: number
  band: MasteryBand
}

export type SubjectRowData = {
  exam_subject_id: number
  section_name: string
  label: string
  question_count: number
  choice_group: string | null
  cells: SubjectCell[]
  latest_net: number | null
  latest_loss: number | null
  latest_accuracy: number | null
  latest_band: MasteryBand
  total_questions: number
  total_net: number
  average_net: number
  total_loss: number
}

export type SubjectLevelData = {
  rows: SubjectRowData[]
  loss_rankings: Array<{
    exam_subject_id: number
    label: string
    section_name: string
    loss_net: number
    net: number
    question_count: number
  }>
  top_loss_headline: string
  high_low_headline: string
}

export type TopicCell = {
  exam_id: string
  exam_date: string
  exam_name: string
  entered: boolean
  question_count: number
  correct_count: number
  wrong_count: number
  blank_count: number
  accuracy_pct: number | null
  loss_net: number
  band: MasteryBand
}

export type TopicRowData = {
  exam_topic_id: number
  exam_subject_id: number
  name: string
  sort_order: number
  cells: TopicCell[]
  total_questions: number
  total_correct: number
  total_wrong: number
  total_blank: number
  total_accuracy_pct: number | null
  total_loss_net: number
  trend_values: number[]
  status_badge: MasteryBand | 'az_veri'
  min_questions_reached: boolean
}

export type TopicLevelData = {
  exam_subject_id: number
  subject_label: string
  rows: TopicRowData[]
  top_loss_topics: Array<{
    exam_topic_id: number
    name: string
    subject_label: string
    total_loss_net: number
    total_questions: number
    total_accuracy_pct: number | null
  }>
  headline: string
}

export type ExamReportResult = {
  exam_type: ExamType
  available_exam_types: ExamType[]
  general: GeneralLevelData
  subjects: SubjectLevelData
  topicsBySubject: Record<number, TopicLevelData>
  all_top_loss_topics: Array<{
    exam_topic_id: number
    name: string
    subject_label: string
    total_loss_net: number
    total_questions: number
    total_accuracy_pct: number | null
  }>
}

// ---------------------------------------------------------------------------
// Yardımcı Matematiksel Fonksiyonlar
// ---------------------------------------------------------------------------

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

export function calcNet(correct: number, wrong: number, penalty: number): number {
  return round2(correct - wrong / penalty)
}

export function calcLossNet(questionCount: number, correct: number, wrong: number, penalty: number): number {
  const net = correct - wrong / penalty
  return round2(questionCount - net)
}

export function calcSubjectAccuracy(net: number, questionCount: number): number {
  if (questionCount <= 0) return 0
  return round2((net / questionCount) * 100)
}

export function calcTopicAccuracy(correct: number, questionCount: number): number {
  if (questionCount <= 0) return 0
  return round2((correct / questionCount) * 100)
}

/**
 * Bir denemenin bölümleri girilmiş ancak konu detayları henüz girilmemiş mi?
 * - Denemenin bölümleri olmalı (sectionsList veya sections > 0).
 * - Konu verisi bulunmamalı:
 *   - hasTopics === false
 *   - topicResultsCount === 0
 *   - topic_results dizisi boş
 */
export function isExamWithoutTopics(exam: {
  sectionsList?: readonly unknown[]
  sections?: readonly unknown[]
  hasTopics?: boolean
  topicResultsCount?: number
  topic_results?: readonly unknown[]
}): boolean {
  const sectionsCount = exam.sectionsList?.length ?? exam.sections?.length ?? 0
  if (sectionsCount === 0) return false

  if (typeof exam.hasTopics === 'boolean') {
    return !exam.hasTopics
  }
  if (typeof exam.topicResultsCount === 'number') {
    return exam.topicResultsCount === 0
  }
  if (Array.isArray(exam.topic_results)) {
    return exam.topic_results.length === 0
  }
  return true
}

/**
 * Konusu girilmemiş deneme sayısını hesaplar.
 */
export function countExamsWithoutTopics(
  exams: readonly {
    sectionsList?: readonly unknown[]
    sections?: readonly unknown[]
    hasTopics?: boolean
    topicResultsCount?: number
    topic_results?: readonly unknown[]
  }[]
): number {
  return exams.filter(isExamWithoutTopics).length
}

// ---------------------------------------------------------------------------
// Ana Rapor Üretici
// ---------------------------------------------------------------------------

export function generateExamReport(
  exams: RawExamRecord[],
  catalog: ExamReportCatalog,
  selectedExamType?: ExamType,
): ExamReportResult {
  // Sadece verisi olan exam_type'lar
  const availableExamTypes = Array.from(new Set(exams.map((e) => e.exam_type)))
  const activeExamType: ExamType =
    selectedExamType && availableExamTypes.includes(selectedExamType)
      ? selectedExamType
      : availableExamTypes[0] ?? 'TYT'

  // Seçili sınav türündeki denemeler, kronolojik sıralı (eskiden yeniye)
  const typeExams = exams
    .filter((e) => e.exam_type === activeExamType)
    .sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime() || a.name.localeCompare(b.name))

  const penalty = wrongPenaltyFor(activeExamType)

  // -------------------------------------------------------------------------
  // 1. Seviye 1: Genel
  // -------------------------------------------------------------------------
  const timeSeries: GeneralTimeSeriesPoint[] = []
  let prevExamNet: number | null = null
  let latestDeltaNet: number | null = null
  let latestDeltaPct: number | null = null

  for (let i = 0; i < typeExams.length; i++) {
    const exam = typeExams[i]
    // Toplam net hesabı: sections tablosundan veya alt derslerden
    let totalQuestions = 0
    let totalCorrect = 0
    let totalWrong = 0
    let totalNet = 0

    if (exam.sections && exam.sections.length > 0) {
      for (const s of exam.sections) {
        totalQuestions += s.max_questions
        totalCorrect += s.correct_count
        totalWrong += s.wrong_count
        const sNet = s.net != null ? Number(s.net) : calcNet(s.correct_count, s.wrong_count, penalty)
        totalNet += sNet
      }
    } else if (exam.subject_results && exam.subject_results.length > 0) {
      for (const sr of exam.subject_results) {
        totalQuestions += sr.question_count
        totalCorrect += sr.correct_count
        totalWrong += sr.wrong_count
        const srNet = sr.net != null ? Number(sr.net) : calcNet(sr.correct_count, sr.wrong_count, penalty)
        totalNet += srNet
      }
    }

    totalNet = round2(totalNet)
    const accuracy = totalQuestions > 0 ? round2((totalNet / totalQuestions) * 100) : 0

    timeSeries.push({
      exam_id: exam.id,
      exam_name: exam.name,
      exam_date: exam.exam_date,
      net: totalNet,
      accuracy_pct: accuracy,
    })

    if (i === typeExams.length - 1 && prevExamNet != null) {
      latestDeltaNet = round2(totalNet - prevExamNet)
      latestDeltaPct = prevExamNet !== 0 ? round2((latestDeltaNet / Math.abs(prevExamNet)) * 100) : null
    }
    prevExamNet = totalNet
  }

  const latestRaw = typeExams[typeExams.length - 1] ?? null
  const latestPoint = timeSeries[timeSeries.length - 1] ?? null
  const averageNet =
    timeSeries.length > 0 ? round2(timeSeries.reduce((sum, p) => sum + p.net, 0) / timeSeries.length) : 0

  const minDataReached = typeExams.length >= 3
  let minDataNotice: string | null = null
  if (!minDataReached && typeExams.length > 0) {
    if (typeExams.length === 1) {
      minDataNotice = `Çizgi için en az 3 deneme gerekir (şu an 1 deneme).`
    } else if (typeExams.length === 2) {
      const p1 = timeSeries[0].net.toFixed(2)
      const p2 = timeSeries[1].net.toFixed(2)
      minDataNotice = `Çizgi için en az 3 deneme gerekir (şu an 2). Önceki → şimdi: ${p1} → ${p2}`
    }
  }

  let generalHeadline = 'Henüz deneme verisi bulunmuyor.'
  if (latestPoint) {
    const deltaFormatted = latestDeltaNet != null ? latestDeltaNet.toFixed(2).replace('.', ',') : ''
    const deltaStr =
      latestDeltaNet != null
        ? latestDeltaNet >= 0
          ? ` (+${deltaFormatted})`
          : ` (${deltaFormatted})`
        : ''
    generalHeadline = `Son deneme ${latestPoint.net.toFixed(2).replace('.', ',')} net${deltaStr}`
  }

  const generalLevel: GeneralLevelData = {
    latest_exam: latestRaw && latestPoint
      ? {
          id: latestRaw.id,
          name: latestRaw.name,
          publisher: latestRaw.publisher ?? null,
          exam_date: latestRaw.exam_date,
          exam_type: latestRaw.exam_type,
          question_count: latestRaw.sections?.reduce((sum, s) => sum + s.max_questions, 0) ?? 0,
          correct_count: latestRaw.sections?.reduce((sum, s) => sum + s.correct_count, 0) ?? 0,
          wrong_count: latestRaw.sections?.reduce((sum, s) => sum + s.wrong_count, 0) ?? 0,
          blank_count: latestRaw.sections?.reduce((sum, s) => sum + (s.blank_count ?? (s.max_questions - s.correct_count - s.wrong_count)), 0) ?? 0,
          net: latestPoint.net,
          accuracy_pct: latestPoint.accuracy_pct,
          delta_net: latestDeltaNet,
          delta_pct: latestDeltaPct,
          score: latestRaw.score ?? null,
          percentile: latestRaw.percentile ?? null,
          ranks: (latestRaw.ranks as Record<string, { sira?: number; katilan?: number }>) ?? null,
          coach_note: latestRaw.coach_note ?? null,
        }
      : null,
    headline: generalHeadline,
    time_series: timeSeries,
    average_net: averageNet,
    min_data_reached: minDataReached,
    min_data_notice: minDataNotice,
  }

  // -------------------------------------------------------------------------
  // 2. Seviye 2: Ders
  // -------------------------------------------------------------------------
  // Sadece seçili sınav türüne ait alt dersler (exam_subjects)
  const catalogSubjects = catalog.subjects
    .filter((s) => s.exam_type === activeExamType)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.label.localeCompare(b.label))

  const subjectRows: SubjectRowData[] = []
  const lossRankings: Array<{
    exam_subject_id: number
    label: string
    section_name: string
    loss_net: number
    net: number
    question_count: number
  }> = []

  for (const cs of catalogSubjects) {
    const cells: SubjectCell[] = []
    let totalQuestions = 0
    let totalNet = 0
    let totalLoss = 0

    for (const exam of typeExams) {
      const match = exam.subject_results?.find((sr) => sr.exam_subject_id === cs.id)
      if (match) {
        const q = match.question_count || cs.question_count
        const d = match.correct_count
        const y = match.wrong_count
        const b = match.blank_count ?? (q - d - y)
        const net = match.net != null ? round2(Number(match.net)) : calcNet(d, y, penalty)
        const loss = calcLossNet(q, d, y, penalty)
        const acc = calcSubjectAccuracy(net, q)
        const band = getMasteryBand(acc)

        cells.push({
          exam_id: exam.id,
          exam_date: exam.exam_date,
          exam_name: exam.name,
          entered: true,
          question_count: q,
          correct_count: d,
          wrong_count: y,
          blank_count: b,
          net,
          accuracy_pct: acc,
          loss_net: loss,
          band,
        })

        totalQuestions += q
        totalNet += net
        totalLoss += loss
      } else {
        cells.push({
          exam_id: exam.id,
          exam_date: exam.exam_date,
          exam_name: exam.name,
          entered: false,
          question_count: cs.question_count,
          correct_count: 0,
          wrong_count: 0,
          blank_count: cs.question_count,
          net: 0,
          accuracy_pct: 0,
          loss_net: cs.question_count,
          band: 'none',
        })
      }
    }

    const enteredCells = cells.filter((c) => c.entered)
    const latestCell = enteredCells[enteredCells.length - 1] ?? null

    const avgNet = enteredCells.length > 0 ? round2(totalNet / enteredCells.length) : 0

    if (latestCell) {
      lossRankings.push({
        exam_subject_id: cs.id,
        label: cs.label,
        section_name: cs.section_name,
        loss_net: latestCell.loss_net,
        net: latestCell.net,
        question_count: latestCell.question_count,
      })
    }

    subjectRows.push({
      exam_subject_id: cs.id,
      section_name: cs.section_name,
      label: cs.label,
      question_count: cs.question_count,
      choice_group: cs.choice_group ?? null,
      cells,
      latest_net: latestCell ? latestCell.net : null,
      latest_loss: latestCell ? latestCell.loss_net : null,
      latest_accuracy: latestCell ? latestCell.accuracy_pct : null,
      latest_band: latestCell ? latestCell.band : 'none',
      total_questions: totalQuestions,
      total_net: round2(totalNet),
      average_net: avgNet,
      total_loss: round2(totalLoss),
    })
  }

  lossRankings.sort((a, b) => b.loss_net - a.loss_net)

  let topLossHeadline = 'Ders kayıp analizi için veri bekleniyor.'
  if (lossRankings.length > 0 && lossRankings[0].loss_net > 0) {
    const top = lossRankings[0]
    topLossHeadline = `En çok kaybettiren ders ${top.label}: ${top.loss_net.toFixed(2).replace('.', ',')} net`
  }

  let highLowHeadline = ''
  const enteredRows = subjectRows.filter((r) => r.latest_accuracy != null)
  if (enteredRows.length >= 2) {
    enteredRows.sort((a, b) => (b.latest_accuracy ?? 0) - (a.latest_accuracy ?? 0))
    const highest = enteredRows[0]
    const lowest = enteredRows[enteredRows.length - 1]
    highLowHeadline = `En yüksek ${highest.label} %${Math.round(highest.latest_accuracy ?? 0)}, en düşük ${lowest.label} %${Math.round(lowest.latest_accuracy ?? 0)}`
  } else if (enteredRows.length === 1) {
    highLowHeadline = `${enteredRows[0].label} başarı %${Math.round(enteredRows[0].latest_accuracy ?? 0)}`
  }

  const subjectLevel: SubjectLevelData = {
    rows: subjectRows,
    loss_rankings: lossRankings,
    top_loss_headline: topLossHeadline,
    high_low_headline: highLowHeadline,
  }

  // -------------------------------------------------------------------------
  // 3. Seviye 3: Konu
  // -------------------------------------------------------------------------
  const topicsBySubject: Record<number, TopicLevelData> = {}
  const allTopicLossList: Array<{
    exam_topic_id: number
    name: string
    subject_label: string
    total_loss_net: number
    total_questions: number
    total_accuracy_pct: number | null
  }> = []

  for (const cs of catalogSubjects) {
    const subjectTopics = catalog.topics
      .filter((t) => t.exam_subject_id === cs.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))

    const topicRows: TopicRowData[] = []

    for (const ct of subjectTopics) {
      const cells: TopicCell[] = []
      let totalS = 0
      let totalD = 0
      let totalY = 0
      let totalB = 0
      const trendValues: number[] = []

      for (const exam of typeExams) {
        const match = exam.topic_results?.find((tr) => tr.exam_topic_id === ct.id)
        if (match) {
          const s = match.question_count
          const d = match.correct_count
          const y = match.wrong_count
          const b = match.blank_count ?? (s - d - y)
          const acc = calcTopicAccuracy(d, s)
          const loss = calcLossNet(s, d, y, penalty)
          const band = getMasteryBand(acc)

          cells.push({
            exam_id: exam.id,
            exam_date: exam.exam_date,
            exam_name: exam.name,
            entered: true,
            question_count: s,
            correct_count: d,
            wrong_count: y,
            blank_count: b,
            accuracy_pct: acc,
            loss_net: loss,
            band,
          })

          totalS += s
          totalD += d
          totalY += y
          totalB += b
          trendValues.push(acc)
        } else {
          cells.push({
            exam_id: exam.id,
            exam_date: exam.exam_date,
            exam_name: exam.name,
            entered: false,
            question_count: 0,
            correct_count: 0,
            wrong_count: 0,
            blank_count: 0,
            accuracy_pct: null,
            loss_net: 0,
            band: 'none',
          })
        }
      }

      const totalAcc = totalS > 0 ? calcTopicAccuracy(totalD, totalS) : null
      const totalLoss = totalS > 0 ? calcLossNet(totalS, totalD, totalY, penalty) : 0
      const minQuestionsReached = totalS >= 3
      const statusBadge = !minQuestionsReached ? 'az_veri' : getMasteryBand(totalAcc)

      topicRows.push({
        exam_topic_id: ct.id,
        exam_subject_id: cs.id,
        name: ct.name,
        sort_order: ct.sort_order ?? 0,
        cells,
        total_questions: totalS,
        total_correct: totalD,
        total_wrong: totalY,
        total_blank: totalB,
        total_accuracy_pct: totalAcc,
        total_loss_net: totalLoss,
        trend_values: trendValues,
        status_badge: statusBadge,
        min_questions_reached: minQuestionsReached,
      })

      if (totalS > 0) {
        allTopicLossList.push({
          exam_topic_id: ct.id,
          name: ct.name,
          subject_label: cs.label,
          total_loss_net: totalLoss,
          total_questions: totalS,
          total_accuracy_pct: totalAcc,
        })
      }
    }

    const sortedTopics = [...topicRows].sort((a, b) => b.total_loss_net - a.total_loss_net)
    const topTopic = sortedTopics.find((t) => t.total_loss_net > 0)
    const headline = topTopic
      ? `En çok kaybettiren ${topTopic.name}: ${topTopic.total_loss_net.toFixed(2).replace('.', ',')} net`
      : 'Konu kayıp analizi için yeterli veri yok.'

    topicsBySubject[cs.id] = {
      exam_subject_id: cs.id,
      subject_label: cs.label,
      rows: topicRows,
      top_loss_topics: sortedTopics.slice(0, 10).map((t) => ({
        exam_topic_id: t.exam_topic_id,
        name: t.name,
        subject_label: cs.label,
        total_loss_net: t.total_loss_net,
        total_questions: t.total_questions,
        total_accuracy_pct: t.total_accuracy_pct,
      })),
      headline,
    }
  }

  allTopicLossList.sort((a, b) => b.total_loss_net - a.total_loss_net)

  return {
    exam_type: activeExamType,
    available_exam_types: availableExamTypes,
    general: generalLevel,
    subjects: subjectLevel,
    topicsBySubject,
    all_top_loss_topics: allTopicLossList.slice(0, 10),
  }
}
