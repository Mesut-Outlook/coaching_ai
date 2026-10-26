import { DAYS } from './weeks'

export type TalkingPointKind = 'kritik' | 'odev' | 'tutarsizlik' | 'tekrar' | 'ilerleme' | 'bilgi'
export type TalkingPointSeverity = 'danger' | 'warning' | 'info' | 'success'

export interface TalkingPointAction {
  label: string
  kind: 'add_to_program' | 'open_program'
  topicId?: number
  topicName?: string
  suggestedType?: 'konu' | 'tekrar' | 'rutin' | 'sureli_test' | 'deneme'
}

export interface TalkingPoint {
  id: string
  kind: TalkingPointKind
  severity: TalkingPointSeverity
  title: string
  text: string
  action?: TalkingPointAction
}

export interface ExamTopicStats {
  examTopicId: number
  examTopicName: string
  curriculumTopicId?: number | null
  totalQuestions: number
  correctQuestions: number
  accuracyPct: number
  examCount: number
}

export interface SubjectTrend {
  subjectId: string | number
  subjectName: string
  examNets: number[] // Kronolojik: [en eski, ..., en yeni]
}

export interface TopicProgressInfo {
  topicId: number
  topicName: string
  subjectName?: string
  lastMeasuredAccuracy?: number | null
  lastMeasuredAt?: string | null
  lastTaskAt?: string | null
  coachDecisionState?: 'yeterli' | 'gelisiyor' | 'kritik' | 'olculmedi' | null
  previousState?: 'yeterli' | 'gelisiyor' | 'kritik' | null
  taskQuestions?: number
  taskAccuracy?: number
  examAccuracy?: number
}

export interface WeeklyProgramStats {
  currentWeekTotalTasks: number
  currentWeekCompletedTasks: number
  currentWeekCompletionPct: number
  isWeekHalfway: boolean
  uncompletedDayIndices: number[]
}

export interface TalkingPointsInput {
  studentId: string
  studentName?: string
  examTopicStats?: ExamTopicStats[]
  subjectTrends?: SubjectTrend[]
  topicProgress?: TopicProgressInfo[]
  programStats?: WeeklyProgramStats | null
  referenceDate?: Date // Testler ve tarih karşılaştırmaları için opsiyonel
}

export const TALKING_POINT_CONFIG: Record<
  TalkingPointKind,
  { label: string; badgeClass: string; bg: string; color: string }
> = {
  kritik: {
    label: 'KRİTİK',
    badgeClass: 'pill-kritik',
    bg: 'var(--critical-bg)',
    color: 'var(--critical-text)',
  },
  odev: {
    label: 'ÖDEV',
    badgeClass: 'pill-gelisiyor',
    bg: 'var(--warning-bg)',
    color: 'var(--warning-text)',
  },
  tutarsizlik: {
    label: 'TUTARSIZLIK',
    badgeClass: 'pill-gelisiyor',
    bg: 'var(--warning-bg)',
    color: 'var(--warning-text)',
  },
  tekrar: {
    label: 'TEKRAR',
    badgeClass: 'pill-olculmedi',
    bg: 'var(--measured-bg)',
    color: 'var(--measured-text)',
  },
  ilerleme: {
    label: 'İLERLEME',
    badgeClass: 'pill-yeterli',
    bg: 'var(--success-bg)',
    color: 'var(--success-text)',
  },
  bilgi: {
    label: 'BİLGİ',
    badgeClass: 'pill-olculmedi',
    bg: 'var(--surface-alt)',
    color: 'var(--ink-soft)',
  },
}

/**
 * Raporlar 2.0 (R1-5) Saf Görüşme Maddeleri Motoru
 * Kurallar:
 * 1. KRİTİK: Son 4 denemede birikimli başarı < %50 ve ≥8 soru VEYA koç kararı 'kritik'
 * 2. ÖDEV: Hafta yarılanmışken bu hafta tamamlama < %70
 * 3. TUTARSIZLIK: Aynı konuda görev doğruluğu (≥20 soru) - deneme başarısı ≥ 20 puan
 * 4. TEKRAR: Son ölçüm yeterli (≥ %75), ancak 4+ haftadır yeni görev verilmemiş
 * 5. İLERLEME: Son 3 denemede monoton artan ders VEYA kritik/gelişiyor'dan yeterli'ye geçen konu
 *
 * Kısıtlar:
 * - En fazla 5 madde.
 * - En az 1 olumlu (varsa kesinlikle dahil edilir; yoksa "veri az" bilgilendirme maddesi eklenir).
 */
export function buildTalkingPoints(input: TalkingPointsInput): TalkingPoint[] {
  const {
    examTopicStats = [],
    subjectTrends = [],
    topicProgress = [],
    programStats,
    referenceDate = new Date(),
  } = input

  const attentionPoints: TalkingPoint[] = []
  const positivePoints: TalkingPoint[] = []
  const coveredTopicIds = new Set<number>()

  // 1. KRİTİK MADDELER
  // 1.1 Deneme birikimli başarı < %50 ve ≥ 8 soru
  const criticalExamTopics = examTopicStats
    .filter((s) => s.totalQuestions >= 8 && s.accuracyPct < 50)
    .sort((a, b) => a.accuracyPct - b.accuracyPct)

  for (const item of criticalExamTopics) {
    if (item.curriculumTopicId) {
      coveredTopicIds.add(item.curriculumTopicId)
    }
    attentionPoints.push({
      id: `kritik-deneme-${item.examTopicId}`,
      kind: 'kritik',
      severity: 'danger',
      title: item.examTopicName,
      text: `${item.examTopicName}: ${item.examCount} denemede ${item.totalQuestions} sorudan ${item.correctQuestions} doğru (%${item.accuracyPct}).`,
      action: {
        label: 'Programa Ekle',
        kind: 'add_to_program',
        topicId: item.curriculumTopicId ?? undefined,
        topicName: item.examTopicName,
        suggestedType: 'sureli_test',
      },
    })
  }

  // 1.2 Koç kararı 'kritik'
  for (const t of topicProgress) {
    if (t.coachDecisionState === 'kritik' && !coveredTopicIds.has(t.topicId)) {
      coveredTopicIds.add(t.topicId)
      attentionPoints.push({
        id: `kritik-karar-${t.topicId}`,
        kind: 'kritik',
        severity: 'danger',
        title: t.topicName,
        text: `${t.topicName}: Koç değerlendirmesi 'Kritik' olarak işaretlendi.`,
        action: {
          label: 'Programa Ekle',
          kind: 'add_to_program',
          topicId: t.topicId,
          topicName: t.topicName,
          suggestedType: 'tekrar',
        },
      })
    }
  }

  // 2. ÖDEV MADDESİ
  if (
    programStats &&
    programStats.isWeekHalfway &&
    programStats.currentWeekTotalTasks > 0 &&
    programStats.currentWeekCompletionPct < 70
  ) {
    const uncompletedDays = (programStats.uncompletedDayIndices || [])
      .map((idx) => DAYS[idx])
      .filter(Boolean)
    const dayStr = uncompletedDays.length > 0 ? ` Eksikler: ${uncompletedDays.join(', ')}.` : ''

    attentionPoints.push({
      id: 'odev-tamamlama-dusuk',
      kind: 'odev',
      severity: 'warning',
      title: 'Haftalık Görev Takibi',
      text: `Bu haftaki görev tamamlama oranı %${programStats.currentWeekCompletionPct} (beklenen: en az %70).${dayStr}`,
      action: {
        label: 'Programı Aç',
        kind: 'open_program',
      },
    })
  }

  // 3. TUTARSIZLIK MADDELERİ
  for (const t of topicProgress) {
    if (
      (t.taskQuestions ?? 0) >= 20 &&
      t.taskAccuracy !== undefined &&
      t.examAccuracy !== undefined &&
      t.taskAccuracy - t.examAccuracy >= 20
    ) {
      attentionPoints.push({
        id: `tutarsizlik-${t.topicId}`,
        kind: 'tutarsizlik',
        severity: 'warning',
        title: `${t.topicName} Tutarsızlığı`,
        text: `${t.topicName}: Görevlerdeki doğruluk (%${t.taskAccuracy}), deneme başarısından (%${t.examAccuracy}) 20+ puan yüksek. Süre veya sınav ortamı etkisi olabilir.`,
        action: {
          label: 'Süreli Test Ekle',
          kind: 'add_to_program',
          topicId: t.topicId,
          topicName: t.topicName,
          suggestedType: 'sureli_test',
        },
      })
    }
  }

  // 4. TEKRAR MADDELERİ
  const nowMs = referenceDate.getTime()
  for (const t of topicProgress) {
    const isSufficient =
      (t.lastMeasuredAccuracy !== null && t.lastMeasuredAccuracy !== undefined && t.lastMeasuredAccuracy >= 75) ||
      t.coachDecisionState === 'yeterli'

    if (!isSufficient) continue

    let daysSinceLastTask: number | null = null
    if (t.lastTaskAt) {
      daysSinceLastTask = Math.floor((nowMs - new Date(t.lastTaskAt).getTime()) / 86400000)
    } else if (t.lastMeasuredAt) {
      daysSinceLastTask = Math.floor((nowMs - new Date(t.lastMeasuredAt).getTime()) / 86400000)
    }

    if (daysSinceLastTask !== null && daysSinceLastTask >= 28) {
      attentionPoints.push({
        id: `tekrar-${t.topicId}`,
        kind: 'tekrar',
        severity: 'info',
        title: `${t.topicName} Tekrarı`,
        text: `${t.topicName}: Son ölçümde yeterliydi (%${t.lastMeasuredAccuracy ?? 75}), ancak 4+ haftadır yeni görev verilmedi.`,
        action: {
          label: 'Tekrar Ekle',
          kind: 'add_to_program',
          topicId: t.topicId,
          topicName: t.topicName,
          suggestedType: 'tekrar',
        },
      })
    }
  }

  // 5. İLERLEME MADDELERİ (Olumlu)
  // 5.1 Son 3 denemede monoton artan ders
  for (const st of subjectTrends) {
    const nets = st.examNets || []
    if (nets.length >= 3) {
      const len = nets.length
      const n0 = nets[len - 3]
      const n1 = nets[len - 2]
      const n2 = nets[len - 1]
      if (n2 > n1 && n1 > n0) {
        positivePoints.push({
          id: `ilerleme-ders-${st.subjectId}`,
          kind: 'ilerleme',
          severity: 'success',
          title: `${st.subjectName} Gelişimi`,
          text: `${st.subjectName}: Son 3 denemedir netler düzenli yükseliyor (${n0} → ${n1} → ${n2}).`,
        })
      }
    }
  }

  // 5.2 Kritik/Gelişiyor'dan Yeterli'ye geçen konu
  for (const t of topicProgress) {
    const wasWeak = t.previousState === 'kritik' || t.previousState === 'gelisiyor'
    const isNowGood =
      t.coachDecisionState === 'yeterli' ||
      (t.lastMeasuredAccuracy !== null && t.lastMeasuredAccuracy !== undefined && t.lastMeasuredAccuracy >= 75)

    if (wasWeak && isNowGood) {
      positivePoints.push({
        id: `ilerleme-konu-${t.topicId}`,
        kind: 'ilerleme',
        severity: 'success',
        title: `${t.topicName} Başarısı`,
        text: `${t.topicName}: Başarı oranı %${t.lastMeasuredAccuracy ?? 75} seviyesine ulaşarak 'Yeterli' durumuna geçti.`,
      })
    }
  }

  // Maddeleri seç ve sırala (En fazla 5 madde, en az 1 olumlu veya "veri az" notu)
  const result: TalkingPoint[] = []

  if (positivePoints.length > 0) {
    // En az 1 olumlu ekle
    result.push(positivePoints[0])
    // Kalan 4 kontenjan için öncelikle dikkat gerektirenler, sonra diğer olumlular
    const remainingSlots = 4
    const selectedAttention = attentionPoints.slice(0, remainingSlots)
    result.push(...selectedAttention)

    const stillSlots = 5 - result.length
    if (stillSlots > 0 && positivePoints.length > 1) {
      result.push(...positivePoints.slice(1, 1 + stillSlots))
    }
  } else {
    // Olumlu yoksa: en fazla 4 dikkat maddesi + 1 "veri az" notu
    const selectedAttention = attentionPoints.slice(0, 4)
    result.push(...selectedAttention)
    result.push({
      id: 'info-veri-az',
      kind: 'bilgi',
      severity: 'info',
      title: 'Veri Birikimi',
      text: 'Öğrencinin olumlu gelişim eğilimlerini tespit etmek için henüz yeterli deneme veya görev verisi bulunmuyor.',
    })
  }

  // Nihai sonuç en fazla 5 madde
  return result.slice(0, 5)
}
