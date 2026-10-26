import type { ExamType, TaskType } from '../types/database'
import type { PriorityQuadrant } from './report360Core'

// ---------------------------------------------------------------------------
// 1. Girdi Tipleri (RecommendInput)
// ---------------------------------------------------------------------------

export interface PriorityPointInput {
  examTopicId: number
  examTopicName: string
  subjectName: string
  weight: number
  accuracyPct: number
  priorityScore: number
  quadrant: PriorityQuadrant
  curriculumTopicId?: number | null
}

export interface ReviewTopicInput {
  topicId: number
  topicName: string
  subjectName: string
  lastMeasuredAccuracy: number
  weeksInactive: number
  reviewIntervalWeek: number
  repeatCount: number
}

export interface CriticalDecisionInput {
  topicId: number
  topicName: string
  subjectName: string
  decidedAt: string
  note?: string | null
}

export interface Last4WeeksTaskInput {
  week_start: string
  question_count: number
  completed: boolean
  task_type?: TaskType
}

export interface RecommendInput {
  studentId: string
  examType: ExamType
  priorityPoints: PriorityPointInput[]
  reviewTopics: ReviewTopicInput[]
  criticalDecisions: CriticalDecisionInput[]
  last4WeeksTasks: Last4WeeksTaskInput[]
}

// ---------------------------------------------------------------------------
// 2. Çıktı Tipleri (RecommendOutput)
// ---------------------------------------------------------------------------

export interface RecommendItem {
  id: string
  topicId?: number | null
  examTopicId?: number | null
  topicName: string
  subjectName: string
  taskType: TaskType // 'konu' | 'tekrar' | 'sureli_test'
  recommendedQuestions: number
  reason: string // Tek cümlelik açık ve motive edici gerekçe
  priorityRank: number
}

export interface RecommendOutput {
  targetTotalQuestions: number
  items: RecommendItem[]
  summaryText: string
}

// ---------------------------------------------------------------------------
// 3. Yardımcı Fonksiyonlar ve Hesaplama Mantığı
// ---------------------------------------------------------------------------

/**
 * Son 4 haftada tamamlanan ortalama haftalık sorunun en fazla %10 üstünü hesaplar.
 * Veri veya tamamlanan soru yoksa varsayılan 300 döner.
 */
export function calculateTargetWeeklyQuestions(tasks: Last4WeeksTaskInput[]): number {
  if (!tasks || tasks.length === 0) {
    return 300
  }

  // Haftalık bazda tamamlanan soruları grupla
  const weeklyMap = new Map<string, number>()
  for (const t of tasks) {
    if (t.completed && t.question_count > 0) {
      const current = weeklyMap.get(t.week_start) ?? 0
      weeklyMap.set(t.week_start, current + t.question_count)
    }
  }

  if (weeklyMap.size === 0) {
    return 300
  }

  const totalCompleted = Array.from(weeklyMap.values()).reduce((sum, val) => sum + val, 0)
  const weeklyAvg = totalCompleted / weeklyMap.size

  if (weeklyAvg <= 0) {
    return 300
  }

  // En fazla %10 üstü (+ %10 tempo artışı)
  const target = Math.round(weeklyAvg * 1.1)
  return Math.max(50, target)
}

interface CandidateTopic {
  key: string
  topicId?: number | null
  examTopicId?: number | null
  topicName: string
  subjectName: string
  isCritical: boolean
  criticalNote?: string | null
  quadrant?: PriorityQuadrant | null
  priorityScore: number
  accuracyPct?: number | null
  reviewData?: ReviewTopicInput | null
}

/**
 * Normalleştirilmiş benzersiz anahtar oluşturur
 */
function buildTopicKey(
  topicId?: number | null,
  examTopicId?: number | null,
  subjectName?: string,
  topicName?: string
): string {
  if (topicId != null && topicId > 0) {
    return `topic:${topicId}`
  }
  if (examTopicId != null && examTopicId > 0) {
    return `examTopic:${examTopicId}`
  }
  const s = (subjectName || '').trim().toLowerCase()
  const t = (topicName || '').trim().toLowerCase()
  return `name:${s}:${t}`
}

/**
 * Öneri motoru ana fonksiyonu
 */
export function buildRecommendations(input: RecommendInput): RecommendOutput {
  const targetTotalQuestions = calculateTargetWeeklyQuestions(input.last4WeeksTasks)

  // 1. Aday havuzu oluştur ve deduplicate et
  const candidateMap = new Map<string, CandidateTopic>()

  // A. Kritik Koç Kararları (En yüksek otorite)
  for (const cd of input.criticalDecisions || []) {
    const key = buildTopicKey(cd.topicId, null, cd.subjectName, cd.topicName)
    candidateMap.set(key, {
      key,
      topicId: cd.topicId,
      topicName: cd.topicName,
      subjectName: cd.subjectName,
      isCritical: true,
      criticalNote: cd.note,
      priorityScore: 9999, // En yüksek öncelik tabanı
    })
  }

  // B. B3 Öncelik Matrisi Noktaları
  for (const pp of input.priorityPoints || []) {
    // Önce curriculumTopicId ile dene, yoksa examTopicId ile
    const candidateKeyByCurriculum = pp.curriculumTopicId
      ? buildTopicKey(pp.curriculumTopicId, null, pp.subjectName, pp.examTopicName)
      : null
    const key =
      candidateKeyByCurriculum && candidateMap.has(candidateKeyByCurriculum)
        ? candidateKeyByCurriculum
        : buildTopicKey(pp.curriculumTopicId, pp.examTopicId, pp.subjectName, pp.examTopicName)

    const existing = candidateMap.get(key)
    if (existing) {
      existing.examTopicId = pp.examTopicId
      existing.quadrant = pp.quadrant
      existing.accuracyPct = pp.accuracyPct
      if (!existing.topicId && pp.curriculumTopicId) {
        existing.topicId = pp.curriculumTopicId
      }
      // Kritikse ek puanı koru, değilse puanını güncelle
      if (existing.isCritical) {
        existing.priorityScore = 9999 + pp.priorityScore
      } else {
        existing.priorityScore = Math.max(existing.priorityScore, pp.priorityScore)
      }
    } else {
      candidateMap.set(key, {
        key,
        topicId: pp.curriculumTopicId ?? null,
        examTopicId: pp.examTopicId,
        topicName: pp.examTopicName,
        subjectName: pp.subjectName,
        isCritical: false,
        quadrant: pp.quadrant,
        accuracyPct: pp.accuracyPct,
        priorityScore: pp.priorityScore,
      })
    }
  }

  // C. B8 Tekrar Zamanı Gelen Konular (Unutma Eğrisi)
  for (const rt of input.reviewTopics || []) {
    const key = buildTopicKey(rt.topicId, null, rt.subjectName, rt.topicName)
    const existing = candidateMap.get(key)
    if (existing) {
      existing.reviewData = rt
      if (existing.accuracyPct == null) {
        existing.accuracyPct = rt.lastMeasuredAccuracy
      }
    } else {
      candidateMap.set(key, {
        key,
        topicId: rt.topicId,
        topicName: rt.topicName,
        subjectName: rt.subjectName,
        isCritical: false,
        reviewData: rt,
        accuracyPct: rt.lastMeasuredAccuracy,
        priorityScore: 50 + rt.weeksInactive * 5, // Tekrar aciliyetine göre dinamik puan
      })
    }
  }

  // 2. Adayları sırala ve sınıflandır
  // Öncelik kuralı:
  // 1. Koçun kritik kararları ve 'hemen_calis' bölgesi (Tier 1)
  // 2. Tekrar zamanı gelenler (Tier 2)
  // 3. 'hizli_kazanim' bölgesi (Tier 3)
  // 4. 'koru' / 'sonra' (Tier 4)
  function getTier(cand: CandidateTopic): number {
    if (cand.isCritical && cand.quadrant === 'hemen_calis') return 1
    if (cand.isCritical) return 2
    if (cand.quadrant === 'hemen_calis') return 3
    if (cand.reviewData) return 4
    if (cand.quadrant === 'hizli_kazanim') return 5
    if (cand.quadrant === 'koru') return 6
    return 7
  }

  const sortedCandidates = Array.from(candidateMap.values()).sort((a, b) => {
    const tierA = getTier(a)
    const tierB = getTier(b)
    if (tierA !== tierB) {
      return tierA - tierB
    }
    // Aynı kademede priorityScore azalan
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore
    }
    // Eşitlikte doğruluk oranı düşük olan öne
    const accA = a.accuracyPct ?? 100
    const accB = b.accuracyPct ?? 100
    return accA - accB
  })

  // 3. Görev Türü (taskType), Tek Cümlelik Gerekçe (reason) ve İdeal Soru Sayısı Belirleme
  interface DraftItem {
    candidate: CandidateTopic
    taskType: TaskType
    idealQuestions: number
    reason: string
  }

  const drafts: DraftItem[] = []

  for (const cand of sortedCandidates) {
    let taskType: TaskType = 'konu'
    let idealQuestions = 40
    let reason = ''

    const acc = cand.accuracyPct != null ? Math.round(cand.accuracyPct) : null

    if (cand.isCritical) {
      taskType = 'konu'
      idealQuestions = 45
      if (cand.criticalNote && cand.criticalNote.trim().length > 0) {
        reason = `Koç kritik olarak işaretledi: ${cand.criticalNote.trim()}`
      } else if (cand.quadrant === 'hemen_calis' && acc != null) {
        reason = `Koç kritik olarak işaretledi ve öncelik matrisinde hemen çalış bölgesinde (%${acc} başarı).`
      } else {
        reason = 'Koç kritik odak olarak işaretledi.'
      }
    } else if (cand.quadrant === 'hemen_calis') {
      taskType = 'konu'
      idealQuestions = 40
      reason = acc != null
        ? `Öncelik matrisinde hemen çalış bölgesinde (%${acc} başarı).`
        : 'Öncelik matrisinde yüksek ağırlıklı eksik konu olarak hemen çalış bölgesinde.'
    } else if (cand.reviewData) {
      taskType = 'tekrar'
      idealQuestions = 20 // 15-25 soru gibi kompakt
      const repeatNum = cand.reviewData.repeatCount + 1
      reason = `Son ${cand.reviewData.weeksInactive} haftadır çalışılmadı (${repeatNum}. tekrar zamanı).`
    } else if (cand.quadrant === 'hizli_kazanim') {
      // Hızlı kazanım: Başarısı %60 üstü ise pekiştirme için 'sureli_test', altı ise 'konu'
      if (acc != null && acc >= 60) {
        taskType = 'sureli_test'
        idealQuestions = 30
        reason = `Hızlı net kazanımı potansiyeli yüksek (%${acc} başarı, süreli test ile pekiştirme).`
      } else {
        taskType = 'konu'
        idealQuestions = 30
        reason = acc != null
          ? `Hızlı net kazanımı potansiyeli yüksek (%${acc} başarı).`
          : 'Hızlı net kazanımı bölgesinde yer alıyor.'
      }
    } else if (cand.quadrant === 'koru') {
      taskType = 'sureli_test'
      idealQuestions = 25
      reason = acc != null
        ? `Yüksek başarıyı korumak için pratik zamanı (%${acc} başarı).`
        : 'Mevcut net kazanımını korumak için pratik önerildi.'
    } else {
      taskType = 'konu'
      idealQuestions = 25
      reason = 'Gelişim planında sıradaki çalışma konusu.'
    }

    drafts.push({
      candidate: cand,
      taskType,
      idealQuestions,
      reason,
    })
  }

  // 4. Soru Bütçesi Dağıtımı (Toplam hedef aşılmayacak)
  let remainingBudget = targetTotalQuestions
  const finalItems: RecommendItem[] = []

  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i]
    if (remainingBudget <= 0) break

    let allocatedQuestions = 0

    if (remainingBudget >= draft.idealQuestions) {
      allocatedQuestions = draft.idealQuestions
    } else if (remainingBudget >= 15) {
      // Kalan bütçe en az 15 ise adaya kalan tamamını ver
      allocatedQuestions = remainingBudget
    } else {
      // Kalan bütçe 15'ten az ise (<15), yeni madde açmak yerine önceki maddelere ekleyerek bütçeyi tüket
      if (finalItems.length > 0) {
        // En yüksek öncelikli veya ilk konuya ekle
        finalItems[0].recommendedQuestions += remainingBudget
        remainingBudget = 0
      }
      break
    }

    remainingBudget -= allocatedQuestions

    finalItems.push({
      id: `rec-${draft.candidate.key}`,
      topicId: draft.candidate.topicId,
      examTopicId: draft.candidate.examTopicId,
      topicName: draft.candidate.topicName,
      subjectName: draft.candidate.subjectName,
      taskType: draft.taskType,
      recommendedQuestions: allocatedQuestions,
      reason: draft.reason,
      priorityRank: finalItems.length + 1,
    })
  }

  // Eğer tüm adaylar bittiği halde hala bütçe arttıysa ve aday sayısı az ise,
  // kalan bütçeyi mevcut maddelere (özellikle kritik/konu çalışmalarına) paylaştırarak
  // hedefin hakkını verelim.
  if (remainingBudget > 0 && finalItems.length > 0) {
    for (const item of finalItems) {
      if (remainingBudget <= 0) break
      // Konu maddelerine 10'ar, tekrarlara 5'er ekle
      const bonus = item.taskType === 'konu' ? Math.min(remainingBudget, 10) : Math.min(remainingBudget, 5)
      item.recommendedQuestions += bonus
      remainingBudget -= bonus
    }
  }

  // 5. Özet Metin Üretimi (summaryText)
  const criticalCount = finalItems.filter((it) => {
    const original = candidateMap.get(`topic:${it.topicId}`) || candidateMap.get(`examTopic:${it.examTopicId}`)
    return original?.isCritical || false
  }).length

  const reviewCount = finalItems.filter((it) => it.taskType === 'tekrar').length
  const konuCount = finalItems.filter((it) => it.taskType === 'konu').length
  const testCount = finalItems.filter((it) => it.taskType === 'sureli_test').length
  const totalAllocated = finalItems.reduce((sum, it) => sum + it.recommendedQuestions, 0)

  let summaryText = ''
  if (finalItems.length === 0) {
    summaryText = `Bu hafta için hedeflenen ${targetTotalQuestions} soru bütçesi bulunuyor ancak acil çalışma veya tekrar ihtiyacı olan bir konu tespit edilmedi.`
  } else {
    const parts: string[] = []
    if (criticalCount > 0) parts.push(`${criticalCount} koç kritik odağı`)
    if (konuCount > 0 && criticalCount === 0) parts.push(`${konuCount} öncelikli konu çalışması`)
    if (reviewCount > 0) parts.push(`${reviewCount} aralıklı tekrar`)
    if (testCount > 0) parts.push(`${testCount} süreli pekiştirme testi`)

    const focusStr = parts.length > 0 ? parts.join(', ') : `${finalItems.length} konu`
    summaryText = `Bu hafta için hedeflenen ${targetTotalQuestions} soru, ${finalItems.length} öncelikli konuya paylaştırıldı (${totalAllocated} soru planlandı: ${focusStr}).`
  }

  return {
    targetTotalQuestions,
    items: finalItems,
    summaryText,
  }
}
