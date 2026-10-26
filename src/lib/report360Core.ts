import type { ExamType, Grade } from '../types/database'
import { SECTIONS_CONFIG } from './examSections'

/** Sınav türüne göre maksimum net / soru sayısı sınırı */
export function getMaxNetForExamType(examType: ExamType): number {
  if (examType === 'TYT') {
    return SECTIONS_CONFIG.TYT.reduce((sum, s) => sum + s.max, 0)
  }
  if (examType === 'AYT') {
    return 80 // SAY/EA/SÖZ 40 + 40
  }
  if (examType === 'LGS') {
    return SECTIONS_CONFIG.LGS.reduce((sum, s) => sum + s.max, 0)
  }
  return 120
}

// ---------------------------------------------------------------------------
// 1. Girdi Tipleri (Supabase bağımsız, saf veri)
// ---------------------------------------------------------------------------

export interface RawExamItem {
  id: string
  name: string
  exam_date: string // YYYY-MM-DD
  exam_type: ExamType
  net: number // TYT/AYT için toplam net, LGS için weightedNet
}

export interface RawTopicResultItem {
  mock_exam_id: string
  exam_topic_id: number
  exam_topic_name: string
  exam_subject_name: string
  subject_color_token?: string
  correct_count: number
  wrong_count: number
  blank_count: number
  question_count: number
}

export interface RawSectionResultItem {
  mock_exam_id: string
  section_name: string
  correct_count: number
  wrong_count: number
  blank_count: number
  max_questions: number
}

export interface RawTopicLinkItem {
  exam_topic_id: number
  topic_id: number
  is_primary: boolean
}

export interface RawCoachDecisionItem {
  topic_id: number
  state: 'yeterli' | 'gelisiyor' | 'kritik' | 'olculmedi'
  decided_at: string
}

export interface RawTaskItem {
  id: string
  topic_id: number | null
  task_type: 'konu' | 'tekrar' | 'rutin' | 'sureli_test' | 'deneme'
  completed: boolean
  completed_at: string | null
  created_at: string
  correct_count: number | null
  wrong_count: number | null
  blank_count: number | null
  question_count: number
}

export interface RawCurriculumTopicItem {
  id: number
  name: string
  subject_id: number
  subject_name: string
}

export interface GlobalExamTopicWeight {
  exam_topic_id: number
  avg_questions: number
}

export interface Report360Input {
  studentId: string
  studentName?: string
  studentGrade?: Grade | string | null
  examType: ExamType
  targetNet?: number | null
  examDate?: string | null // Sınav tarihi (YYYY-MM-DD)
  referenceDate?: Date // Karşılaştırma referans tarihi (varsayılan bugün)
  wrongPenalty?: number // YKS: 4, LGS: 3

  // Veri koleksiyonları
  exams: RawExamItem[] // Seçili sınav türündeki denemeler
  topicResults: RawTopicResultItem[] // Konu bazlı deneme sonuçları
  sectionResults: RawSectionResultItem[] // Bölüm/ders bazlı deneme sonuçları
  topicLinks: RawTopicLinkItem[] // exam_topic_links (yalnız is_primary)
  coachDecisions: RawCoachDecisionItem[] // Koç kararları
  tasks: RawTaskItem[] // Haftalık görevler
  curriculumTopics: RawCurriculumTopicItem[] // Öğrencinin sınıfına uyan müfredat konuları
  globalTopicWeights?: GlobalExamTopicWeight[] // Kurum/koç geneli ortalama soru ağırlığı
}

// ---------------------------------------------------------------------------
// 2. Çıktı Tipleri (Grafik ve KPI Verileri)
// ---------------------------------------------------------------------------

export interface KpiStripData {
  lastNet: number | null
  previousNet: number | null
  deltaNet: number | null
  targetNet: number | null
  netGap: number | null // hedef - son net
  weeksLeft: number | null
  weeklyNeededNet: number | null
  taskCompletion4w: {
    currentPct: number
    previousPct: number
    deltaPct: number
    totalTasks: number
    completedTasks: number
  }
  taskAccuracy4w: {
    accuracyPct: number | null // null ise "Sonuç girilmedi"
    totalQuestions: number
    correctQuestions: number
  }
  curriculumProgress: {
    sufficientCount: number
    totalCount: number
    pct: number
  }
}

export interface RegressionPoint {
  date: string
  daysFromStart: number
  net: number
}

export interface RegressionPrediction {
  canPredict: boolean
  reason?: string
  slopePerDay?: number
  intercept?: number
  predictedNetAtExam?: number
  gapToTargetAtExam?: number | null
  residualStdDev?: number
  confidenceBandWidth?: number // ± net bandı
  examDateEstimated?: boolean
  summaryText: string
}

export interface TargetTrajectoryData {
  examPoints: Array<{
    id: string
    name: string
    date: string
    net: number
  }>
  targetNet: number | null
  prediction: RegressionPrediction
  examDate: string | null
}

export type PriorityQuadrant = 'hemen_calis' | 'koru' | 'hizli_kazanim' | 'sonra'

export interface PriorityMatrixPoint {
  examTopicId: number
  examTopicName: string
  subjectName: string
  colorToken: string
  accuracyPct: number // %0..100 (x ekseni: 0..1)
  weight: number // ortalama soru sayısı (y ekseni)
  priorityScore: number // weight * (1 - accuracy)
  quadrant: PriorityQuadrant
  isTopPriority: boolean // En yüksek 6 konudan biri
  curriculumTopicId?: number | null
}

export interface PriorityMatrixData {
  points: PriorityMatrixPoint[]
  medianWeight: number
  topPriorityCount: number
  allWeightsEqual?: boolean
}

export interface ParetoBarItem {
  examTopicId: number
  examTopicName: string
  subjectName?: string
  lossNet: number
  cumulativePct: number
  isCritical: boolean // Toplam kaybın %60'ına dahil mi
  curriculumTopicId?: number | null
}

export interface ParetoLossData {
  bars: ParetoBarItem[]
  otherBar: { lossNet: number; topicCount: number } | null
  totalLossNet: number
  criticalTopicsCount: number
  criticalLossPct: number
  summaryText: string
}

export type ErrorQuadrant = 'saglam' | 'riskli_isaretleme' | 'sure_strateji' | 'konu_eksigi'

export interface ErrorProfilePoint {
  sectionName: string
  wrongRatePct: number // Y / S * 100
  blankRatePct: number // B / S * 100
  correctRatePct: number
  quadrant: ErrorQuadrant
  suggestion: string
}

export interface ErrorProfileData {
  points: ErrorProfilePoint[]
}

export interface ConsistencyItem {
  topicId: number
  topicName: string
  subjectName: string
  taskAccuracyPct: number
  examAccuracyPct: number
  diffPct: number // task - exam
  direction: 'task_higher' | 'exam_higher'
  suggestion: string
  taskQuestionsCount: number
}

export interface ConsistencyData {
  hasEnoughData: boolean
  items: ConsistencyItem[]
  tasksWithResultsCount: number
  emptyStateMessage?: string
}

export type TopicProgressStatus = 'yeterli' | 'gelisiyor' | 'calisildi' | 'baslanmadi'

export interface SubjectCurriculumProgress {
  subjectId: number
  subjectName: string
  sufficient: number
  developing: number
  worked: number
  notStarted: number
  total: number
  sufficientPct: number
}

export interface CurriculumProgressData {
  subjects: SubjectCurriculumProgress[]
  totalSufficient: number
  totalTopics: number
  overallSufficientPct: number
  velocity: {
    canPredict: boolean
    weeklyRate: number // Haftalık yeterliye geçen konu hızı
    weeksNeeded: number | null
    isLate: boolean
    weeksLate: number | null
    summaryText: string
  }
}

export interface Report360Data {
  studentId: string
  examType: ExamType
  kpi: KpiStripData
  trajectory: TargetTrajectoryData
  priorityMatrix: PriorityMatrixData
  paretoLoss: ParetoLossData
  errorProfile: ErrorProfileData
  consistency: ConsistencyData
  curriculum: CurriculumProgressData
}

// ---------------------------------------------------------------------------
// 3. İstatistik & Matematik Yardımcıları
// ---------------------------------------------------------------------------

/** Doğrusal Regresyon hesaplar: y = ax + b */
export function calculateLinearRegression(points: Array<{ x: number; y: number }>): {
  slope: number
  intercept: number
  residualStdDev: number
} {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, residualStdDev: 3.0 }

  const meanX = points.reduce((acc, p) => acc + p.x, 0) / n
  const meanY = points.reduce((acc, p) => acc + p.y, 0) / n

  let num = 0
  let den = 0
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY)
    den += (p.x - meanX) ** 2
  }

  const slope = den === 0 ? 0 : num / den
  const intercept = meanY - slope * meanX

  let sumSquaredResiduals = 0
  for (const p of points) {
    const predicted = slope * p.x + intercept
    sumSquaredResiduals += (p.y - predicted) ** 2
  }

  const dof = Math.max(1, n - 2)
  const residualStdDev = Math.sqrt(sumSquaredResiduals / dof)

  return { slope, intercept, residualStdDev }
}

/** Medyan hesaplar */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// ---------------------------------------------------------------------------
// 4. Saf Rapor Oluşturucu (buildReport360)
// ---------------------------------------------------------------------------

export function buildReport360(input: Report360Input): Report360Data {
  const now = input.referenceDate || new Date()
  const penalty = input.wrongPenalty ?? (input.examType === 'LGS' ? 3 : 4)

  // Denemeleri tarihe göre kronolojik sırala (en eskiden en yeniye)
  const sortedExams = [...input.exams].sort(
    (a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime()
  )

  // -------------------------------------------------------------------------
  // K0: KPI Şeridi
  // -------------------------------------------------------------------------
  const lastExam = sortedExams.length > 0 ? sortedExams[sortedExams.length - 1] : null
  const prevExam = sortedExams.length > 1 ? sortedExams[sortedExams.length - 2] : null
  const lastNet = lastExam ? Number(lastExam.net) : null
  const prevNet = prevExam ? Number(prevExam.net) : null
  const deltaNet = lastNet !== null && prevNet !== null ? Math.round((lastNet - prevNet) * 100) / 100 : null

  const targetNet = input.targetNet ?? null
  const netGap = targetNet !== null && lastNet !== null ? Math.round((targetNet - lastNet) * 100) / 100 : null

  let weeksLeft: number | null = null
  let weeklyNeededNet: number | null = null
  if (input.examDate) {
    const msDiff = new Date(input.examDate).getTime() - now.getTime()
    weeksLeft = Math.max(1, Math.round(msDiff / (7 * 86400000)))
    if (netGap !== null && weeksLeft > 0) {
      weeklyNeededNet = Math.round((Math.max(0, netGap) / weeksLeft) * 100) / 100
    }
  }

  // Ödev 4 hafta analizi
  const fourWeeksMs = 28 * 86400000
  const eightWeeksMs = 56 * 86400000
  const nowMs = now.getTime()

  const current4wTasks = input.tasks.filter((t) => {
    const tMs = new Date(t.created_at).getTime()
    return tMs >= nowMs - fourWeeksMs && tMs <= nowMs
  })

  const prev4wTasks = input.tasks.filter((t) => {
    const tMs = new Date(t.created_at).getTime()
    return tMs >= nowMs - eightWeeksMs && tMs < nowMs - fourWeeksMs
  })

  const currTotal = current4wTasks.length
  const currCompleted = current4wTasks.filter((t) => t.completed).length
  const currPct = currTotal > 0 ? Math.round((currCompleted / currTotal) * 100) : 0

  const prevTotal = prev4wTasks.length
  const prevCompleted = prev4wTasks.filter((t) => t.completed).length
  const prevPct = prevTotal > 0 ? Math.round((prevCompleted / prevTotal) * 100) : 0
  const deltaPct = currPct - prevPct

  // Görev doğruluğu (son 4 hafta)
  let totalAnsweredQ = 0
  let totalCorrectQ = 0
  for (const t of current4wTasks) {
    if (t.completed && t.correct_count !== null && t.wrong_count !== null) {
      const q = (t.correct_count || 0) + (t.wrong_count || 0) + (t.blank_count || 0)
      if (q > 0) {
        totalAnsweredQ += q
        totalCorrectQ += t.correct_count || 0
      }
    }
  }
  const taskAccuracyPct = totalAnsweredQ > 0 ? Math.round((totalCorrectQ / totalAnsweredQ) * 100) : null

  // Müfredat yeterli sayısı
  const decisionMap = new Map<number, string>()
  for (const d of input.coachDecisions) {
    decisionMap.set(d.topic_id, d.state)
  }
  const totalCurriculumTopics = input.curriculumTopics.length
  const sufficientTopics = input.curriculumTopics.filter(
    (t) => decisionMap.get(t.id) === 'yeterli'
  ).length
  const curriculumProgressPct =
    totalCurriculumTopics > 0 ? Math.round((sufficientTopics / totalCurriculumTopics) * 100) : 0

  const kpi: KpiStripData = {
    lastNet,
    previousNet: prevNet,
    deltaNet,
    targetNet,
    netGap,
    weeksLeft,
    weeklyNeededNet,
    taskCompletion4w: {
      currentPct: currPct,
      previousPct: prevPct,
      deltaPct,
      totalTasks: currTotal,
      completedTasks: currCompleted,
    },
    taskAccuracy4w: {
      accuracyPct: taskAccuracyPct,
      totalQuestions: totalAnsweredQ,
      correctQuestions: totalCorrectQ,
    },
    curriculumProgress: {
      sufficientCount: sufficientTopics,
      totalCount: totalCurriculumTopics,
      pct: curriculumProgressPct,
    },
  }

  // -------------------------------------------------------------------------
  // B2: Hedef Yolu (Trajectory)
  // -------------------------------------------------------------------------
  const examPoints = sortedExams.map((e) => ({
    id: e.id,
    name: e.name,
    date: e.exam_date,
    net: Number(e.net),
  }))

  // Regresyon hesaplaması (son en çok 6 deneme)
  let prediction: RegressionPrediction
  const regressionExams = sortedExams.slice(-6)

  if (regressionExams.length < 3) {
    prediction = {
      canPredict: false,
      reason: 'Tahmin için en az 3 deneme gerekli',
      summaryText: 'Tahmin oluşturmak için en az 3 deneme sonucu girilmelidir.',
    }
  } else {
    const firstDateMs = new Date(regressionExams[0].exam_date).getTime()
    const regPoints = regressionExams.map((e) => ({
      x: Math.round((new Date(e.exam_date).getTime() - firstDateMs) / 86400000),
      y: Number(e.net),
    }))

    const { slope, intercept, residualStdDev } = calculateLinearRegression(regPoints)

    let targetDateMs: number
    let examDateEstimated = false
    if (input.examDate) {
      targetDateMs = new Date(input.examDate).getTime()
    } else {
      // 12 hafta sonra
      targetDateMs = new Date(regressionExams[regressionExams.length - 1].exam_date).getTime() + 84 * 86400000
      examDateEstimated = true
    }

    const examDaysFromFirst = Math.round((targetDateMs - firstDateMs) / 86400000)
    const rawPredicted = Math.round((slope * examDaysFromFirst + intercept) * 10) / 10
    const maxNet = getMaxNetForExamType(input.examType)
    const predictedNet = Math.max(0, Math.min(maxNet, rawPredicted))

    // Belirsizlik bandı: stdDev * sqrt(1 + 1/n), min ±3 net
    const n = regressionExams.length
    const band = Math.max(3.0, Math.round(residualStdDev * Math.sqrt(1 + 1 / n) * 100) / 100)

    const formattedPred = predictedNet.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    let gapToTarget: number | null = null
    let summaryText = `Bu hızla sınav gününde ~${formattedPred} net bekleniyor.`
    if (targetNet !== null) {
      gapToTarget = Math.round((predictedNet - targetNet) * 10) / 10
      const formattedGap = Math.abs(gapToTarget).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      if (gapToTarget >= 0) {
        summaryText = `Bu hızla sınav gününde ~${formattedPred} net: hedefin ${formattedGap} üstünde.`
      } else {
        summaryText = `Bu hızla sınav gününde ~${formattedPred} net: hedefin ${formattedGap} altında.`
      }
    }

    prediction = {
      canPredict: true,
      slopePerDay: slope,
      intercept,
      predictedNetAtExam: predictedNet,
      gapToTargetAtExam: gapToTarget,
      residualStdDev,
      confidenceBandWidth: band,
      examDateEstimated,
      summaryText,
    }
  }

  const trajectory: TargetTrajectoryData = {
    examPoints,
    targetNet,
    prediction,
    examDate: input.examDate || null,
  }

  // -------------------------------------------------------------------------
  // B3: Öncelik Matrisi (Priority Matrix)
  // -------------------------------------------------------------------------
  // Son 6 denemedeki konu sonuçları
  const last6ExamIds = new Set(regressionExams.map((e) => e.id))
  const last6TopicResults = input.topicResults.filter((r) => last6ExamIds.has(r.mock_exam_id))

  // Konu bazında doğru/soru toplamı
  const topicStatsMap = new Map<
    number,
    {
      name: string
      subjectName: string
      colorToken: string
      totalCorrect: number
      totalQuestions: number
    }
  >()

  for (const r of last6TopicResults) {
    const q = r.question_count || (r.correct_count + r.wrong_count + r.blank_count)
    if (!topicStatsMap.has(r.exam_topic_id)) {
      topicStatsMap.set(r.exam_topic_id, {
        name: r.exam_topic_name || `Konu #${r.exam_topic_id}`,
        subjectName: r.exam_subject_name || '',
        colorToken: r.subject_color_token || 'var(--indigo-600)',
        totalCorrect: 0,
        totalQuestions: 0,
      })
    }
    const st = topicStatsMap.get(r.exam_topic_id)!
    if (!st.name && r.exam_topic_name) st.name = r.exam_topic_name
    if (!st.subjectName && r.exam_subject_name) st.subjectName = r.exam_subject_name
    if (r.subject_color_token && st.colorToken === 'var(--indigo-600)') st.colorToken = r.subject_color_token
    st.totalCorrect += r.correct_count
    st.totalQuestions += q
  }

  // Ağırlık haritası (global veya öğrenci ortalaması)
  const weightMap = new Map<number, number>()
  if (input.globalTopicWeights && input.globalTopicWeights.length > 0) {
    for (const gw of input.globalTopicWeights) {
      weightMap.set(gw.exam_topic_id, gw.avg_questions)
    }
  }

  // exam_topic_id -> curriculum topic_id haritası
  const primaryTopicMap = new Map<number, number>()
  for (const l of input.topicLinks) {
    if (l.is_primary) {
      primaryTopicMap.set(l.exam_topic_id, l.topic_id)
    }
  }

  const matrixPointsRaw: Array<{
    examTopicId: number
    examTopicName: string
    subjectName: string
    colorToken: string
    accuracy: number
    accuracyPct: number
    weight: number
    priorityScore: number
    curriculumTopicId?: number | null
  }> = []

  const examCountForStudent = Math.max(1, regressionExams.length)
  for (const [etId, st] of topicStatsMap.entries()) {
    if (st.totalQuestions === 0) continue

    const accuracy = st.totalCorrect / st.totalQuestions
    const accuracyPct = Math.round(accuracy * 100)

    // Ağırlık: global yoksa öğrencinin denemelerinde deneme başına ortalama soru sayısı
    const weight = weightMap.has(etId)
      ? weightMap.get(etId)!
      : Math.round((st.totalQuestions / examCountForStudent) * 100) / 100

    const priorityScore = Math.round(weight * (1 - accuracy) * 100) / 100

    matrixPointsRaw.push({
      examTopicId: etId,
      examTopicName: st.name,
      subjectName: st.subjectName,
      colorToken: st.colorToken,
      accuracy,
      accuracyPct,
      weight,
      priorityScore,
      curriculumTopicId: primaryTopicMap.get(etId) ?? null,
    })
  }

  // Medyan ağırlık
  const medianWeight = calculateMedian(matrixPointsRaw.map((p) => p.weight))
  const allWeightsEqual =
    matrixPointsRaw.length > 0 &&
    matrixPointsRaw.every((p) => p.weight === matrixPointsRaw[0].weight)

  // Öncelik puanına göre sırala
  matrixPointsRaw.sort((a, b) => b.priorityScore - a.priorityScore)

  const priorityPoints: PriorityMatrixPoint[] = matrixPointsRaw.map((p, idx) => {
    let quadrant: PriorityQuadrant
    const isSuccess = p.accuracy >= 0.7
    // weight > median; hepsi eşitse başarıya göre iki bölgeye ayrılır
    const isHeavy = allWeightsEqual ? true : p.weight > medianWeight

    if (!isSuccess && isHeavy) quadrant = 'hemen_calis'
    else if (isSuccess && isHeavy) quadrant = 'koru'
    else if (!isSuccess && !isHeavy) quadrant = 'hizli_kazanim'
    else quadrant = 'sonra'

    return {
      examTopicId: p.examTopicId,
      examTopicName: p.examTopicName,
      subjectName: p.subjectName,
      colorToken: p.colorToken,
      accuracyPct: p.accuracyPct,
      weight: p.weight,
      priorityScore: p.priorityScore,
      quadrant,
      isTopPriority: idx < 6,
      curriculumTopicId: p.curriculumTopicId,
    }
  })

  const priorityMatrix: PriorityMatrixData = {
    points: priorityPoints,
    medianWeight,
    topPriorityCount: Math.min(6, priorityPoints.length),
    allWeightsEqual,
  }

  // -------------------------------------------------------------------------
  // B4: Net Kaybı Pareto (Pareto Loss)
  // -------------------------------------------------------------------------
  const topicLossMap = new Map<number, { name: string; subjectName?: string; loss: number; curriculumTopicId?: number | null }>()
  let totalLoss = 0

  for (const r of last6TopicResults) {
    const totalQ = r.question_count || (r.correct_count + r.wrong_count + r.blank_count)
    const net = r.correct_count - r.wrong_count / penalty
    const loss = Math.max(0, totalQ - net)

    if (!topicLossMap.has(r.exam_topic_id)) {
      topicLossMap.set(r.exam_topic_id, {
        name: r.exam_topic_name || `Konu #${r.exam_topic_id}`,
        subjectName: r.exam_subject_name || '',
        loss: 0,
        curriculumTopicId: primaryTopicMap.get(r.exam_topic_id) ?? null,
      })
    }
    const item = topicLossMap.get(r.exam_topic_id)!
    if (!item.name && r.exam_topic_name) item.name = r.exam_topic_name
    if (!item.subjectName && r.exam_subject_name) item.subjectName = r.exam_subject_name
    item.loss += loss
    totalLoss += loss
  }

  const sortedLosses = Array.from(topicLossMap.entries())
    .map(([etId, v]) => ({
      examTopicId: etId,
      examTopicName: v.name,
      subjectName: v.subjectName,
      lossNet: Math.round(v.loss * 100) / 100,
      curriculumTopicId: v.curriculumTopicId,
    }))
    .sort((a, b) => b.lossNet - a.lossNet)

  let cumulative = 0
  let criticalCount = 0
  const paretoBars: ParetoBarItem[] = []
  const top10 = sortedLosses.slice(0, 10)
  const remaining = sortedLosses.slice(10)

  for (const item of top10) {
    cumulative += item.lossNet
    const cumPct = totalLoss > 0 ? Math.round((cumulative / totalLoss) * 100) : 0
    const isCritical = cumPct <= 60 || (paretoBars.length === 0 && cumPct > 0)
    if (isCritical) criticalCount++

    paretoBars.push({
      examTopicId: item.examTopicId,
      examTopicName: item.examTopicName,
      subjectName: item.subjectName,
      lossNet: item.lossNet,
      cumulativePct: cumPct,
      isCritical,
      curriculumTopicId: item.curriculumTopicId,
    })
  }

  let otherBar: { lossNet: number; topicCount: number } | null = null
  if (remaining.length > 0) {
    const remainingLoss = remaining.reduce((acc, r) => acc + r.lossNet, 0)
    otherBar = {
      lossNet: Math.round(remainingLoss * 100) / 100,
      topicCount: remaining.length,
    }
  }

  const criticalLossSum = paretoBars
    .filter((b) => b.isCritical)
    .reduce((acc, b) => acc + b.lossNet, 0)
  const criticalLossPct = totalLoss > 0 ? Math.round((criticalLossSum / totalLoss) * 100) : 0

  const paretoLoss: ParetoLossData = {
    bars: paretoBars,
    otherBar,
    totalLossNet: Math.round(totalLoss * 100) / 100,
    criticalTopicsCount: criticalCount,
    criticalLossPct,
    summaryText: `${criticalCount} konu, toplam kaybın %${criticalLossPct}'si`,
  }

  // -------------------------------------------------------------------------
  // B5: Hata Profili (Error Profile)
  // -------------------------------------------------------------------------
  // Son 3 denemedeki bölüm sonuçları
  const last3Exams = sortedExams.slice(-3)
  const last3ExamIds = new Set(last3Exams.map((e) => e.id))
  const last3Sections = input.sectionResults.filter((s) => last3ExamIds.has(s.mock_exam_id))

  const sectionAggMap = new Map<
    string,
    { totalWrong: number; totalBlank: number; totalCorrect: number; totalQuestions: number }
  >()

  for (const s of last3Sections) {
    const q = s.max_questions || (s.correct_count + s.wrong_count + s.blank_count)
    if (!sectionAggMap.has(s.section_name)) {
      sectionAggMap.set(s.section_name, {
        totalWrong: 0,
        totalBlank: 0,
        totalCorrect: 0,
        totalQuestions: 0,
      })
    }
    const agg = sectionAggMap.get(s.section_name)!
    agg.totalWrong += s.wrong_count
    agg.totalBlank += s.blank_count
    agg.totalCorrect += s.correct_count
    agg.totalQuestions += q
  }

  const errorProfilePoints: ErrorProfilePoint[] = []
  for (const [sName, agg] of sectionAggMap.entries()) {
    if (agg.totalQuestions === 0) continue

    const wrongRatePct = Math.round((agg.totalWrong / agg.totalQuestions) * 100)
    const blankRatePct = Math.round((agg.totalBlank / agg.totalQuestions) * 100)
    const correctRatePct = Math.round((agg.totalCorrect / agg.totalQuestions) * 100)

    let quadrant: ErrorQuadrant
    let suggestion: string

    const highWrong = wrongRatePct >= 15
    const highBlank = blankRatePct >= 15

    if (!highWrong && !highBlank) {
      quadrant = 'saglam'
      suggestion = 'Doğru ve dengeli çözüm stratejisi; aynı tempoyu koru.'
    } else if (highWrong && !highBlank) {
      quadrant = 'riskli_isaretleme'
      suggestion = 'Emin olmadan yapılan işaretlemeler net kaybettiriyor; iki şık arasında kalmadıkça boş bırak.'
    } else if (!highWrong && highBlank) {
      quadrant = 'sure_strateji'
      suggestion = 'Sorular yetişmiyor ya da cesaret eksikliği var; turlama taktiği ve süreli test çöz.'
    } else {
      quadrant = 'konu_eksigi'
      suggestion = 'Hem anlama hem yetiştirme eksikliği; temel konu anlatımlarına ve soru tiplerine dön.'
    }

    errorProfilePoints.push({
      sectionName: sName,
      wrongRatePct,
      blankRatePct,
      correctRatePct,
      quadrant,
      suggestion,
    })
  }

  const errorProfile: ErrorProfileData = {
    points: errorProfilePoints,
  }

  // -------------------------------------------------------------------------
  // B6: Ödev ↔ Deneme Tutarlılığı (Consistency)
  // -------------------------------------------------------------------------
  // Görev doğruluğu (son 4 hafta, >= 20 soru)
  const taskAccuracyByTopic = new Map<number, { correct: number; total: number }>()
  let tasksWithResults = 0

  for (const t of current4wTasks) {
    if (t.topic_id && t.completed && t.correct_count !== null) {
      tasksWithResults++
      const q = (t.correct_count || 0) + (t.wrong_count || 0) + (t.blank_count || 0)
      if (q > 0) {
        if (!taskAccuracyByTopic.has(t.topic_id)) {
          taskAccuracyByTopic.set(t.topic_id, { correct: 0, total: 0 })
        }
        const st = taskAccuracyByTopic.get(t.topic_id)!
        st.correct += t.correct_count || 0
        st.total += q
      }
    }
  }

  // Deneme başarısı (son 6 deneme, aynı konuya is_primary bağlı)
  // topic_id -> exam stats
  const examStatsByCurriculumTopic = new Map<number, { correct: number; total: number }>()
  for (const r of last6TopicResults) {
    const curId = primaryTopicMap.get(r.exam_topic_id)
    if (!curId) continue

    const q = r.question_count || (r.correct_count + r.wrong_count + r.blank_count)
    if (q > 0) {
      if (!examStatsByCurriculumTopic.has(curId)) {
        examStatsByCurriculumTopic.set(curId, { correct: 0, total: 0 })
      }
      const st = examStatsByCurriculumTopic.get(curId)!
      st.correct += r.correct_count
      st.total += q
    }
  }

  const topicNameMap = new Map<number, { name: string; subjectName: string }>()
  for (const ct of input.curriculumTopics) {
    topicNameMap.set(ct.id, { name: ct.name, subjectName: ct.subject_name })
  }

  const consistencyItems: ConsistencyItem[] = []
  for (const [topId, taskStat] of taskAccuracyByTopic.entries()) {
    if (taskStat.total < 20) continue

    const examStat = examStatsByCurriculumTopic.get(topId)
    if (!examStat || examStat.total < 5) continue

    const taskPct = Math.round((taskStat.correct / taskStat.total) * 100)
    const examPct = Math.round((examStat.correct / examStat.total) * 100)
    const diff = taskPct - examPct

    if (Math.abs(diff) >= 15) {
      const info = topicNameMap.get(topId)
      const isTaskHigher = diff > 0

      consistencyItems.push({
        topicId: topId,
        topicName: info?.name || `Konu #${topId}`,
        subjectName: info?.subjectName || '',
        taskAccuracyPct: taskPct,
        examAccuracyPct: examPct,
        diffPct: Math.abs(diff),
        direction: isTaskHigher ? 'task_higher' : 'exam_higher',
        suggestion: isTaskHigher ? 'Süreli test ekle' : 'Kaynağı zorlaştır',
        taskQuestionsCount: taskStat.total,
      })
    }
  }

  // Farkı en yüksek olandan sırala
  consistencyItems.sort((a, b) => b.diffPct - a.diffPct)

  const consistency: ConsistencyData = {
    hasEnoughData: consistencyItems.length > 0,
    items: consistencyItems,
    tasksWithResultsCount: tasksWithResults,
    emptyStateMessage:
      consistencyItems.length === 0
        ? `Görev sonuçları birikiyor: ${tasksWithResults} görevde sonuç var, karşılaştırma için konu başına 20 soru gerekli.`
        : undefined,
  }

  // -------------------------------------------------------------------------
  // B7: Müfredat İlerlemesi + Yetişme Tahmini (Curriculum Progress & Velocity)
  // -------------------------------------------------------------------------
  // Her dersin konularını grupla
  const subjectMap = new Map<
    number,
    {
      subjectName: string
      sufficient: number
      developing: number
      worked: number
      notStarted: number
      total: number
    }
  >()

  const tasksByTopicId = new Set(input.tasks.filter((t) => t.topic_id !== null).map((t) => t.topic_id!))

  for (const ct of input.curriculumTopics) {
    if (!subjectMap.has(ct.subject_id)) {
      subjectMap.set(ct.subject_id, {
        subjectName: ct.subject_name,
        sufficient: 0,
        developing: 0,
        worked: 0,
        notStarted: 0,
        total: 0,
      })
    }
    const sm = subjectMap.get(ct.subject_id)!
    sm.total++

    const decState = decisionMap.get(ct.id)
    if (decState === 'yeterli') {
      sm.sufficient++
    } else if (decState === 'gelisiyor' || decState === 'kritik') {
      sm.developing++
    } else if (tasksByTopicId.has(ct.id)) {
      sm.worked++
    } else {
      sm.notStarted++
    }
  }

  const subjectsProgress: SubjectCurriculumProgress[] = Array.from(subjectMap.entries()).map(
    ([sId, val]) => ({
      subjectId: sId,
      subjectName: val.subjectName,
      sufficient: val.sufficient,
      developing: val.developing,
      worked: val.worked,
      notStarted: val.notStarted,
      total: val.total,
      sufficientPct: val.total > 0 ? Math.round((val.sufficient / val.total) * 100) : 0,
    })
  )

  // Yetişme tahmini (Velocity)
  // Son 6 haftada yeterli'ye geçen konular (coachDecisions decided_at)
  const sixWeeksMs = 42 * 86400000
  const recentSufficientDecisions = input.coachDecisions.filter((d) => {
    if (d.state !== 'yeterli') return false
    const dMs = new Date(d.decided_at).getTime()
    return dMs >= nowMs - sixWeeksMs && dMs <= nowMs
  })

  // Haftalık hız
  const weeklyRate = Math.round((recentSufficientDecisions.length / 6) * 100) / 100
  const remainingTopicsToSufficient = Math.max(0, totalCurriculumTopics - sufficientTopics)

  let canPredictVelocity = false
  let weeksNeeded: number | null = null
  let isLate = false
  let weeksLate: number | null = null
  let velocitySummary = 'Yetişme tahmini için en az 3 haftalık koçluk geçmişi gereklidir.'

  if (weeklyRate >= 0.3 && remainingTopicsToSufficient > 0) {
    canPredictVelocity = true
    weeksNeeded = Math.ceil(remainingTopicsToSufficient / weeklyRate)

    if (weeksLeft !== null) {
      if (weeksNeeded > weeksLeft) {
        isLate = true
        weeksLate = weeksNeeded - weeksLeft
        velocitySummary = `Bu tempoyla müfredat sınavdan ${weeksLate} hafta sonra bitiyor.`
      } else {
        velocitySummary = `Bu tempoyla müfredat sınava ${weeksLeft - weeksNeeded} hafta kala tamamlanıyor.`
      }
    } else {
      velocitySummary = `Bu tempoyla kalan ${remainingTopicsToSufficient} konu yaklaşık ${weeksNeeded} haftada tamamlanır.`
    }
  } else if (remainingTopicsToSufficient === 0) {
    canPredictVelocity = true
    weeksNeeded = 0
    velocitySummary = 'Tüm müfredat konuları yeterli seviyeye ulaştı!'
  }

  const curriculum: CurriculumProgressData = {
    subjects: subjectsProgress,
    totalSufficient: sufficientTopics,
    totalTopics: totalCurriculumTopics,
    overallSufficientPct: curriculumProgressPct,
    velocity: {
      canPredict: canPredictVelocity,
      weeklyRate,
      weeksNeeded,
      isLate,
      weeksLate,
      summaryText: velocitySummary,
    },
  }

  return {
    studentId: input.studentId,
    examType: input.examType,
    kpi,
    trajectory,
    priorityMatrix,
    paretoLoss,
    errorProfile,
    consistency,
    curriculum,
  }
}
