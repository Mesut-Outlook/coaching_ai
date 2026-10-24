/**
 * src/lib/examInsights.ts
 *
 * Deneme Karnesi Uyarı ve İçgörü Motoru (Spec §7).
 * Sabit eşikler dosyanın başında tek blokta toplanmıştır.
 * Her kural bir insight üretir, ardından koç, öğrenci ve veli rollerine
 * uygun ton ve maddelerle formatlanır.
 */

import type { ExamReportResult } from './examReport'

// ---------------------------------------------------------------------------
// 1. Sabit Eşikler (Spec §7)
// ---------------------------------------------------------------------------

export const INSIGHT_THRESHOLDS = {
  // Kritik konu: birikimli ΣS ≥ 4 ve Σ% < 50
  CRITICAL_TOPIC_MIN_QUESTIONS: 4,
  CRITICAL_TOPIC_MAX_ACCURACY: 50,

  // Tekrarlayan hata: son 3 denemenin 3'ünde de en az 1 yanlış veya boş
  REPEATED_ERROR_EXAM_COUNT: 3,

  // Düşüş: ders neti önceki aynı tür denemeye göre ≥ soru sayısının %10'u kadar düştü
  DROP_NET_RATIO: 0.1,

  // Boş alışkanlığı: son 3 denemede ΣB / ΣS ≥ %25
  BLANK_HABIT_EXAM_COUNT: 3,
  BLANK_HABIT_RATIO: 0.25,

  // Yanlış riski: son denemede Y > 2 * B ve Y / S ≥ %20
  WRONG_RISK_WRONG_TO_BLANK_FACTOR: 2,
  WRONG_RISK_RATIO: 0.2,

  // İlerleme (olumlu): konu %50 altından %75 üstüne çıktı
  PROGRESS_TOPIC_FROM: 50,
  PROGRESS_TOPIC_TO: 75,
  PROGRESS_CONSECUTIVE_INCREASE_COUNT: 3,

  // Rol limitleri
  MAX_COACH_ITEMS: 8,
  MAX_STUDENT_ITEMS: 5,
  MAX_PARENT_ITEMS: 4,
} as const

// ---------------------------------------------------------------------------
// Tipler
// ---------------------------------------------------------------------------

export type InsightKind =
  | 'critical_topic'
  | 'repeated_error'
  | 'drop'
  | 'blank_habit'
  | 'wrong_risk'
  | 'progress'

export type InsightSeverity = 'critical' | 'warning' | 'info' | 'positive'

export type RawInsight = {
  kind: InsightKind
  severity: InsightSeverity
  title: string
  subject_label: string
  topic_name?: string
  priority: number // Küçük sayı = yüksek öncelik
  data: {
    questions?: number
    correct?: number
    wrong?: number
    blank?: number
    accuracy?: number
    net_drop?: number
    old_net?: number
    new_net?: number
  }
}

export type RoleInsightItem = {
  kind: InsightKind
  severity: InsightSeverity
  text: string
  is_positive: boolean
}

export type RoleInsights = {
  coach: RoleInsightItem[]
  student: RoleInsightItem[]
  parent: RoleInsightItem[]
}

// ---------------------------------------------------------------------------
// Kural Değerlendirme Fonksiyonları
// ---------------------------------------------------------------------------

export function extractInsights(report: ExamReportResult): RawInsight[] {
  const insights: RawInsight[] = []

  // 1. Kritik Konular & Tekrarlayan Hatalar & İlerleme (Konu Düzeyi)
  for (const subjectLevel of Object.values(report.topicsBySubject)) {
    for (const topic of subjectLevel.rows) {
      const totalS = topic.total_questions
      const totalAcc = topic.total_accuracy_pct ?? 0

      // Kural 1: Kritik konu (ΣS ≥ 4 ve Σ% < 50)
      if (
        totalS >= INSIGHT_THRESHOLDS.CRITICAL_TOPIC_MIN_QUESTIONS &&
        totalAcc < INSIGHT_THRESHOLDS.CRITICAL_TOPIC_MAX_ACCURACY
      ) {
        insights.push({
          kind: 'critical_topic',
          severity: 'critical',
          title: `Kritik Konu: ${topic.name}`,
          subject_label: subjectLevel.subject_label,
          topic_name: topic.name,
          priority: 10 + (50 - totalAcc),
          data: {
            questions: totalS,
            correct: topic.total_correct,
            wrong: topic.total_wrong,
            accuracy: Math.round(totalAcc),
          },
        })
      }

      // Kural 2: Tekrarlayan hata (son 3 denemenin üçünde de en az 1 yanlış ya da boş)
      const enteredCells = topic.cells.filter((c) => c.entered)
      if (enteredCells.length >= INSIGHT_THRESHOLDS.REPEATED_ERROR_EXAM_COUNT) {
        const last3 = enteredCells.slice(-INSIGHT_THRESHOLDS.REPEATED_ERROR_EXAM_COUNT)
        const hasErrorInAll = last3.every((c) => c.wrong_count > 0 || c.blank_count > 0)
        if (hasErrorInAll) {
          insights.push({
            kind: 'repeated_error',
            severity: 'warning',
            title: `Tekrarlayan Hata: ${topic.name}`,
            subject_label: subjectLevel.subject_label,
            topic_name: topic.name,
            priority: 30,
            data: {
              questions: last3.reduce((sum, c) => sum + c.question_count, 0),
              wrong: last3.reduce((sum, c) => sum + c.wrong_count, 0),
              blank: last3.reduce((sum, c) => sum + c.blank_count, 0),
            },
          })
        }
      }

      // Kural 6a: İlerleme - Konu (%50 altından %75 üstüne çıkış)
      if (enteredCells.length >= 2) {
        const prev = enteredCells[enteredCells.length - 2].accuracy_pct
        const curr = enteredCells[enteredCells.length - 1].accuracy_pct
        if (
          prev != null &&
          curr != null &&
          prev < INSIGHT_THRESHOLDS.PROGRESS_TOPIC_FROM &&
          curr >= INSIGHT_THRESHOLDS.PROGRESS_TOPIC_TO
        ) {
          insights.push({
            kind: 'progress',
            severity: 'positive',
            title: `Belirgin İlerleme: ${topic.name}`,
            subject_label: subjectLevel.subject_label,
            topic_name: topic.name,
            priority: 5,
            data: {
              accuracy: Math.round(curr),
            },
          })
        }
      }
    }
  }

  // 2. Düşüş, Boş Alışkanlığı, Yanlış Riski ve İlerleme (Ders Düzeyi)
  for (const subjectRow of report.subjects.rows) {
    const enteredCells = subjectRow.cells.filter((c) => c.entered)
    if (enteredCells.length === 0) continue

    const latest = enteredCells[enteredCells.length - 1]

    // Kural 3: Düşüş (ders neti bir önceki denemeye göre ≥ soru sayısının %10'u kadar düştü)
    if (enteredCells.length >= 2) {
      const prev = enteredCells[enteredCells.length - 2]
      const dropThreshold = subjectRow.question_count * INSIGHT_THRESHOLDS.DROP_NET_RATIO
      const diff = prev.net - latest.net
      if (diff >= dropThreshold) {
        insights.push({
          kind: 'drop',
          severity: 'warning',
          title: `Net Düşüşü: ${subjectRow.label}`,
          subject_label: subjectRow.label,
          priority: 20 + diff,
          data: {
            net_drop: Math.round(diff * 100) / 100,
            old_net: prev.net,
            new_net: latest.net,
          },
        })
      }
    }

    // Kural 4: Boş alışkanlığı (son 3 denemede ΣB / ΣS ≥ %25)
    if (enteredCells.length >= INSIGHT_THRESHOLDS.BLANK_HABIT_EXAM_COUNT) {
      const last3 = enteredCells.slice(-INSIGHT_THRESHOLDS.BLANK_HABIT_EXAM_COUNT)
      const sumB = last3.reduce((s, c) => s + c.blank_count, 0)
      const sumS = last3.reduce((s, c) => s + c.question_count, 0)
      if (sumS > 0 && sumB / sumS >= INSIGHT_THRESHOLDS.BLANK_HABIT_RATIO) {
        insights.push({
          kind: 'blank_habit',
          severity: 'warning',
          title: `Boş Bırakma Oranı Yüksek: ${subjectRow.label}`,
          subject_label: subjectRow.label,
          priority: 40,
          data: {
            blank: sumB,
            questions: sumS,
            accuracy: Math.round((sumB / sumS) * 100),
          },
        })
      }
    }

    // Kural 5: Yanlış riski (son denemede Y > 2 * B ve Y / S ≥ %20)
    if (latest.question_count > 0) {
      const yRatio = latest.wrong_count / latest.question_count
      if (
        latest.wrong_count > INSIGHT_THRESHOLDS.WRONG_RISK_WRONG_TO_BLANK_FACTOR * latest.blank_count &&
        yRatio >= INSIGHT_THRESHOLDS.WRONG_RISK_RATIO
      ) {
        insights.push({
          kind: 'wrong_risk',
          severity: 'warning',
          title: `Yanlış Riski: ${subjectRow.label}`,
          subject_label: subjectRow.label,
          priority: 35,
          data: {
            wrong: latest.wrong_count,
            blank: latest.blank_count,
            questions: latest.question_count,
          },
        })
      }
    }

    // Kural 6b: İlerleme - Ders (ardışık 3 denemede net artışı)
    if (enteredCells.length >= INSIGHT_THRESHOLDS.PROGRESS_CONSECUTIVE_INCREASE_COUNT) {
      const last3 = enteredCells.slice(-INSIGHT_THRESHOLDS.PROGRESS_CONSECUTIVE_INCREASE_COUNT)
      if (last3[2].net > last3[1].net && last3[1].net > last3[0].net) {
        const gain = Math.round((last3[2].net - last3[0].net) * 100) / 100
        insights.push({
          kind: 'progress',
          severity: 'positive',
          title: `Düzenli Yükseliş: ${subjectRow.label}`,
          subject_label: subjectRow.label,
          priority: 8,
          data: {
            net_drop: gain,
            old_net: last3[0].net,
            new_net: last3[2].net,
          },
        })
      }
    }
  }

  // Öncelik sırasına göre sırala
  return insights.sort((a, b) => a.priority - b.priority)
}

// ---------------------------------------------------------------------------
// Rol Şablonları Formatlayıcı
// ---------------------------------------------------------------------------

export function formatRoleInsights(insights: RawInsight[]): RoleInsights {
  // 1. Koç Şablonu: Teknik ve eylem odaklı (en fazla 8 madde)
  const coachItems: RoleInsightItem[] = []
  for (const ins of insights) {
    if (coachItems.length >= INSIGHT_THRESHOLDS.MAX_COACH_ITEMS) break

    let text = ''
    switch (ins.kind) {
      case 'critical_topic':
        text = `${ins.topic_name}: son denemelerde ${ins.data.questions} sorudan ${ins.data.correct} doğru (%${ins.data.accuracy}) → haftalık programa ekle.`
        break
      case 'repeated_error':
        text = `${ins.topic_name}: son 3 denemenin tümünde hata var (${ins.data.wrong}Y/${ins.data.blank}B) → konu testi ve analizi planla.`
        break
      case 'drop':
        text = `${ins.subject_label}: net ${ins.data.old_net} seviyesinden ${ins.data.new_net}'e geriledi (−${ins.data.net_drop} net).`
        break
      case 'blank_habit':
        text = `${ins.subject_label}: son 3 denemede soruların %${ins.data.accuracy}'si boş bırakıldı (${ins.data.blank} soru) → süre ve konu kapsamını gözden geçir.`
        break
      case 'wrong_risk':
        text = `${ins.subject_label}: yanlış sayısı (${ins.data.wrong}) boşların 2 katından fazla → emin olmadan işaretleme alışkanlığı var.`
        break
      case 'progress':
        if (ins.topic_name) {
          text = `${ins.topic_name}: başarı %${ins.data.accuracy} seviyesine yükseldi, kritik eşik aşıldı.`
        } else {
          text = `${ins.subject_label}: son 3 denemedir düzenli artıyor (${ins.data.old_net} → ${ins.data.new_net}, +${ins.data.net_drop} net).`
        }
        break
    }

    if (text) {
      coachItems.push({
        kind: ins.kind,
        severity: ins.severity,
        text,
        is_positive: ins.severity === 'positive',
      })
    }
  }

  // 2. Öğrenci Şablonu: Cesaretlendirici, odak veren, en az 1 olumlu (en fazla 5 madde)
  const studentItems: RoleInsightItem[] = []
  const positives = insights.filter((i) => i.severity === 'positive')
  const negatives = insights.filter((i) => i.severity !== 'positive')

  // En kritik 1-2 negatif odak
  for (const ins of negatives) {
    if (studentItems.length >= INSIGHT_THRESHOLDS.MAX_STUDENT_ITEMS - 1) break

    let text = ''
    switch (ins.kind) {
      case 'critical_topic':
        text = `Bu hafta odağın: ${ins.topic_name}. Buradaki birkaç soru netlerini doğrudan yukarı çekecek.`
        break
      case 'repeated_error':
        text = `${ins.topic_name} konusunda küçük bir tekrarla eksikleri kapatabilirsin.`
        break
      case 'wrong_risk':
        text = `${ins.subject_label} dersinde emin olmadığın soruları boş bırakmak netlerini hemen artırabilir.`
        break
      case 'drop':
        text = `${ins.subject_label} bu denemede biraz zorlamış olabilir, moral bozmadan devam!`
        break
      case 'blank_habit':
        text = `${ins.subject_label} sorularına biraz daha zaman ayırmayı dene.`
        break
    }

    if (text) {
      studentItems.push({
        kind: ins.kind,
        severity: ins.severity,
        text,
        is_positive: false,
      })
    }
  }

  // En az 1 olumlu madde ekle
  if (positives.length > 0) {
    const topPositive = positives[0]
    let posText = ''
    if (topPositive.topic_name) {
      posText = `${topPositive.topic_name} konusundaki yükselişin harika (%${topPositive.data.accuracy})!`
    } else {
      posText = `${topPositive.subject_label} dersinde istikrarlı yükselişin devam ediyor (+${topPositive.data.net_drop} net), tebrikler!`
    }
    studentItems.push({
      kind: 'progress',
      severity: 'positive',
      text: posText,
      is_positive: true,
    })
  } else if (studentItems.length > 0) {
    // Doğal olumlu motivasyon
    studentItems.push({
      kind: 'progress',
      severity: 'positive',
      text: 'Çalışma temponu koruduğunda sonuçlar adım adım gelecektir.',
      is_positive: true,
    })
  }

  // 3. Veli Şablonu: Sade, suçlamasız, terimsiz (en fazla 4 madde)
  const parentItems: RoleInsightItem[] = []
  for (const ins of insights) {
    if (parentItems.length >= INSIGHT_THRESHOLDS.MAX_PARENT_ITEMS) break

    let text = ''
    switch (ins.kind) {
      case 'critical_topic':
        text = `Desteklenecek: ${ins.subject_label} dersinde ${ins.topic_name} konusunu koçumuzla birlikte programa aldık.`
        break
      case 'progress':
        if (ins.topic_name) {
          text = `Güçlü ilerleme: ${ins.subject_label} / ${ins.topic_name} konusunda belirgin gelişme var.`
        } else {
          text = `Güçlü alan: ${ins.subject_label} dersinde netler istikrarlı olarak yükseliyor.`
        }
        break
      case 'drop':
        text = `${ins.subject_label} dersinde bu deneme genel ortalamanın biraz altında kaldı, telafi çalışması yapılacak.`
        break
      case 'wrong_risk':
      case 'blank_habit':
        text = `Sınav stratejisi: ${ins.subject_label} sorularında süreyi ve soru seçme alışkanlığını optimize ediyoruz.`
        break
    }

    if (text && !parentItems.some((p) => p.text === text)) {
      parentItems.push({
        kind: ins.kind,
        severity: ins.severity,
        text,
        is_positive: ins.severity === 'positive',
      })
    }
  }

  return {
    coach: coachItems.slice(0, INSIGHT_THRESHOLDS.MAX_COACH_ITEMS),
    student: studentItems.slice(0, INSIGHT_THRESHOLDS.MAX_STUDENT_ITEMS),
    parent: parentItems.slice(0, INSIGHT_THRESHOLDS.MAX_PARENT_ITEMS),
  }
}
