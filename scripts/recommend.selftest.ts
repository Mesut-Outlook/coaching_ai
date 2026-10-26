/**
 * scripts/recommend.selftest.ts
 *
 * R3-3 Öneri Motoru A (Öncelik Listesi) Öz-Testi
 *
 * Doğrulanan durumlar:
 * 1. Boş girdi (Default 300 soru hedefi, boş liste, bilgilendirici özet)
 * 2. 4 haftalık tempolu ödev geçmişi (Ortalama tamamlama + %10 hedef)
 * 3. Koçun kritik kararları (En üst öncelik sırası, 'konu' tipi, özel gerekçe)
 * 4. Tekrar zamanı gelen konular (15-25 soru kompakt, 'tekrar' tipi, unutma gerekçesi)
 * 5. B3 'hemen_calis' ve 'hizli_kazanim' entegrasyonu (Doğru sıralama ve taskType)
 * 6. Toplam soru bütçesi aşmama kuralı (sum <= targetTotalQuestions)
 * 7. Deduplication (Aynı konu hem koç kararı hem matris hem tekrarda ise birleşme)
 *
 * Çalıştırma: npm run test:recommend
 */

import assert from 'node:assert/strict'
import {
  calculateTargetWeeklyQuestions,
  buildRecommendations,
  type RecommendInput,
} from '../src/lib/recommendCore'

console.log('▶ R3-3 Öneri Motoru Öz-Testi Başlatılıyor...\n')

// ---------------------------------------------------------------------------
// 1. Haftalık Soru Hedefi Hesaplama Testleri
// ---------------------------------------------------------------------------
{
  // A. Boş girdi -> 300
  const emptyTarget = calculateTargetWeeklyQuestions([])
  assert.equal(emptyTarget, 300, 'Boş görev listesinde varsayılan 300 olmalı')

  // B. Tamamlanmamış görevler -> 300
  const uncompletedTarget = calculateTargetWeeklyQuestions([
    { week_start: '2026-10-05', question_count: 500, completed: false },
  ])
  assert.equal(uncompletedTarget, 300, 'Tamamlanan soru yoksa varsayılan 300 olmalı')

  // C. 4 hafta tempolu veri: haftada 200 soru -> %10 üstü = 220
  const tempoTarget = calculateTargetWeeklyQuestions([
    { week_start: '2026-09-28', question_count: 100, completed: true },
    { week_start: '2026-09-28', question_count: 100, completed: true },
    { week_start: '2026-10-05', question_count: 200, completed: true },
    { week_start: '2026-10-12', question_count: 200, completed: true },
    { week_start: '2026-10-19', question_count: 200, completed: true },
  ])
  assert.equal(tempoTarget, 220, 'Haftalık 200 ortalama ile hedef 220 (200 * 1.1) olmalı')

  console.log('✓ 1. Haftalık soru hedefi hesaplaması doğrulandı.')
}

// ---------------------------------------------------------------------------
// 2. Boş Girdi Durumu
// ---------------------------------------------------------------------------
{
  const emptyInput: RecommendInput = {
    studentId: 'std-empty',
    examType: 'TYT',
    priorityPoints: [],
    reviewTopics: [],
    criticalDecisions: [],
    last4WeeksTasks: [],
  }

  const result = buildRecommendations(emptyInput)
  assert.equal(result.targetTotalQuestions, 300, 'Varsayılan hedef 300 olmalı')
  assert.equal(result.items.length, 0, 'Hiç aday konu olmadığında liste boş olmalı')
  assert.ok(result.summaryText.includes('300 soru'), 'Özet metin hedefi içermeli')

  console.log('✓ 2. Boş girdi ve varsayılan davranış doğrulandı.')
}

// ---------------------------------------------------------------------------
// 3. Koçun Kritik Kararları ve Öncelik Sıralaması
// ---------------------------------------------------------------------------
{
  const input: RecommendInput = {
    studentId: 'std-coach-critical',
    examType: 'TYT',
    priorityPoints: [
      {
        examTopicId: 101,
        examTopicName: 'Üslü Sayılar',
        subjectName: 'Matematik',
        weight: 2.5,
        accuracyPct: 35,
        priorityScore: 1.625,
        quadrant: 'hemen_calis',
        curriculumTopicId: 11,
      },
      {
        examTopicId: 102,
        examTopicName: 'Noktalama İşaretleri',
        subjectName: 'Türkçe',
        weight: 2.0,
        accuracyPct: 75,
        priorityScore: 0.5,
        quadrant: 'hizli_kazanim',
        curriculumTopicId: 12,
      },
    ],
    reviewTopics: [],
    criticalDecisions: [
      {
        topicId: 21,
        topicName: 'Paragrafta Anlam',
        subjectName: 'Türkçe',
        decidedAt: '2026-10-25',
        note: 'Her gün 20 paragraf çözülmeli, ana düşünce kaçıyor',
      },
    ],
    last4WeeksTasks: [
      { week_start: '2026-10-12', question_count: 250, completed: true },
      { week_start: '2026-10-19', question_count: 250, completed: true },
    ],
  }

  const result = buildRecommendations(input)

  // Hedef: 250 * 1.1 = 275
  assert.equal(result.targetTotalQuestions, 275, 'Hedef 275 olmalı')
  assert.ok(result.items.length >= 2, 'En az 2 öneri bulunmalı')

  // Koç kararı 1. sırada olmalı
  const topItem = result.items[0]
  assert.equal(topItem.topicName, 'Paragrafta Anlam', 'Koç kritik kararı 1. sırada olmalı')
  assert.equal(topItem.taskType, 'konu', 'Kritik karar türü konu olmalı')
  assert.ok(
    topItem.reason.includes('Koç kritik olarak işaretledi'),
    'Gerekçede koç uyarısı yer almalı'
  )
  assert.ok(
    topItem.reason.includes('Her gün 20 paragraf'),
    'Koç notu gerekçeye dahil edilmeli'
  )

  // Hemen çalış konusu 2. sırada olmalı
  const secondItem = result.items[1]
  assert.equal(secondItem.topicName, 'Üslü Sayılar')
  assert.equal(secondItem.taskType, 'konu')
  assert.ok(secondItem.reason.includes('hemen çalış'))

  console.log('✓ 3. Koçun kritik kararları ve öncelik sıralaması doğrulandı.')
}

// ---------------------------------------------------------------------------
// 4. Tekrar Zamanı Gelen Konular (B8 Verisi)
// ---------------------------------------------------------------------------
{
  const input: RecommendInput = {
    studentId: 'std-review',
    examType: 'TYT',
    priorityPoints: [],
    reviewTopics: [
      {
        topicId: 301,
        topicName: 'Fonksiyonlar',
        subjectName: 'Matematik',
        lastMeasuredAccuracy: 85,
        weeksInactive: 4,
        reviewIntervalWeek: 3,
        repeatCount: 2,
      },
      {
        topicId: 302,
        topicName: 'Mitoz ve Mayoz',
        subjectName: 'Biyoloji',
        lastMeasuredAccuracy: 90,
        weeksInactive: 6,
        reviewIntervalWeek: 4,
        repeatCount: 1,
      },
    ],
    criticalDecisions: [],
    last4WeeksTasks: [],
  }

  const result = buildRecommendations(input)
  assert.equal(result.items.length, 2, '2 tekrar konusu önerilmeli')

  for (const item of result.items) {
    assert.equal(item.taskType, 'tekrar', 'Tekrar türünde olmalı')
    assert.ok(
      item.recommendedQuestions >= 15 && item.recommendedQuestions <= 25,
      `Tekrar soruları kompakt olmalı (15-25): ${item.recommendedQuestions}`
    )
    assert.ok(
      item.reason.includes('çalışılmadı') && item.reason.includes('tekrar zamanı'),
      'Tekrar gerekçesi doğru formatta olmalı'
    )
  }

  console.log('✓ 4. Tekrar zamanı gelen konular (B8) doğrulandı.')
}

// ---------------------------------------------------------------------------
// 5. Hızlı Kazanım ve Soru Bütçesi Sınırı Testi
// ---------------------------------------------------------------------------
{
  const input: RecommendInput = {
    studentId: 'std-budget',
    examType: 'TYT',
    priorityPoints: [
      {
        examTopicId: 1,
        examTopicName: 'Konu 1',
        subjectName: 'Mat',
        weight: 3,
        accuracyPct: 30,
        priorityScore: 2.1,
        quadrant: 'hemen_calis',
      },
      {
        examTopicId: 2,
        examTopicName: 'Konu 2',
        subjectName: 'Fiz',
        weight: 3,
        accuracyPct: 25,
        priorityScore: 2.25,
        quadrant: 'hemen_calis',
      },
      {
        examTopicId: 3,
        examTopicName: 'Konu 3',
        subjectName: 'Kim',
        weight: 1,
        accuracyPct: 70,
        priorityScore: 0.3,
        quadrant: 'hizli_kazanim',
      },
      {
        examTopicId: 4,
        examTopicName: 'Konu 4',
        subjectName: 'Biyo',
        weight: 1,
        accuracyPct: 80,
        priorityScore: 0.2,
        quadrant: 'hizli_kazanim',
      },
    ],
    reviewTopics: [],
    criticalDecisions: [],
    // Haftalık ortalama 80 soru -> hedef 88 soru
    last4WeeksTasks: [
      { week_start: '2026-10-12', question_count: 80, completed: true },
    ],
  }

  const result = buildRecommendations(input)
  assert.equal(result.targetTotalQuestions, 88, 'Hedef 88 olmalı')

  const totalAllocated = result.items.reduce((s, it) => s + it.recommendedQuestions, 0)
  assert.ok(
    totalAllocated <= result.targetTotalQuestions,
    `Toplam ayrılan (${totalAllocated}) hedefi (${result.targetTotalQuestions}) aşmamalı`
  )

  // Hızlı kazanım konusu süreli test mi
  const hizli = result.items.find((it) => it.topicName === 'Konu 3')
  if (hizli) {
    assert.equal(hizli.taskType, 'sureli_test', 'Yüksek başarıda hızlı kazanım süreli test olmalı')
  }

  console.log('✓ 5. Hızlı kazanım ve soru bütçesi aşmama kuralı doğrulandı.')
}

// ---------------------------------------------------------------------------
// 6. Deduplication (Çakışma Yönetimi)
// ---------------------------------------------------------------------------
{
  const input: RecommendInput = {
    studentId: 'std-dedup',
    examType: 'TYT',
    priorityPoints: [
      {
        examTopicId: 50,
        examTopicName: 'Trigonometri',
        subjectName: 'Matematik',
        weight: 4,
        accuracyPct: 40,
        priorityScore: 2.4,
        quadrant: 'hemen_calis',
        curriculumTopicId: 500,
      },
    ],
    reviewTopics: [
      {
        topicId: 500,
        topicName: 'Trigonometri',
        subjectName: 'Matematik',
        lastMeasuredAccuracy: 40,
        weeksInactive: 5,
        reviewIntervalWeek: 3,
        repeatCount: 1,
      },
    ],
    criticalDecisions: [
      {
        topicId: 500,
        topicName: 'Trigonometri',
        subjectName: 'Matematik',
        decidedAt: '2026-10-20',
        note: 'Temel formüllerde eksik var',
      },
    ],
    last4WeeksTasks: [],
  }

  const result = buildRecommendations(input)
  assert.equal(result.items.length, 1, 'Aynı konu tek bir öneride birleştirilmeli')
  const item = result.items[0]
  assert.equal(item.topicName, 'Trigonometri')
  assert.equal(item.taskType, 'konu', 'Koç kritik kararı baskın çıkıp konu olmalı')
  assert.ok(item.reason.includes('Koç kritik'), 'Gerekçe koç kararını yansıtmalı')

  console.log('✓ 6. Deduplication ve öncelik birleşimi doğrulandı.')
}

console.log('\n Tüm R3-3 Öneri Motoru testleri başarıyla geçti!')
