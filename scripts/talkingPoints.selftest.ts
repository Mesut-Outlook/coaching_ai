/**
 * scripts/talkingPoints.selftest.ts
 *
 * R1-5 Görüşmede Konuşulacaklar (Talking Points) Saf Motoru Öz-Testi
 *
 * Doğrulanan kurallar:
 * 1. KRİTİK: Son 4 denemede birikimli başarı < %50 ve ≥8 soru (action: Programa Ekle).
 * 2. KRİTİK (Koç): Koç kararı 'kritik' olan konular.
 * 3. ÖDEV: Hafta yarılanmışken (Çarşamba+) tamamlama < %70 (action: Programı Aç).
 * 4. TUTARSIZLIK: Görev doğruluğu (≥20 soru) - deneme başarısı ≥ 20 puan (action: Süreli Test Ekle).
 * 5. TEKRAR: Son ölçüm yeterli (≥ %75), ancak 4+ haftadır yeni görev verilmemiş (action: Tekrar Ekle).
 * 6. İLERLEME: Son 3 denemede monoton artan ders netleri (olumlu, action yok).
 * 7. İLERLEME (Konu): Zayıf/Gelişiyor'dan Yeterli'ye yükselen konu.
 * 8. Kısıtlar: En fazla 5 madde, en az 1 olumlu (yoksa 'veri az' notu).
 *
 * Çalıştırma: npm run test:talking-points
 */

import assert from 'node:assert/strict'
import {
  buildTalkingPoints,
  type TalkingPointsInput,
} from '../src/lib/talkingPointsCore'

console.log('▶ R1-5 Talking Points Motoru Öz-Testi Başlatılıyor...\n')

const REF_DATE = new Date('2026-10-26T12:00:00Z') // Pazartesi

// ---------------------------------------------------------------------------
// 1. KRİTİK Kuralı
// ---------------------------------------------------------------------------
{
  const input: TalkingPointsInput = {
    studentId: 'test-1',
    referenceDate: REF_DATE,
    examTopicStats: [
      {
        examTopicId: 101,
        examTopicName: 'Problemler',
        curriculumTopicId: 201,
        totalQuestions: 52,
        correctQuestions: 25,
        accuracyPct: 48,
        examCount: 4,
      },
      {
        // 8 sorudan az ölçülmüş, tetiklenmemeli
        examTopicId: 102,
        examTopicName: 'Olasılık',
        curriculumTopicId: 202,
        totalQuestions: 6,
        correctQuestions: 1,
        accuracyPct: 17,
        examCount: 2,
      },
    ],
  }

  const points = buildTalkingPoints(input)
  const kritik = points.find((p) => p.kind === 'kritik')

  assert.ok(kritik, 'Kritik madde üretilmeli')
  assert.equal(kritik.severity, 'danger')
  assert.equal(kritik.title, 'Problemler')
  assert.ok(kritik.text.includes('52 sorudan 25 doğru (%48)'))
  assert.equal(kritik.action?.kind, 'add_to_program')
  assert.equal(kritik.action?.label, 'Programa Ekle')
  assert.equal(kritik.action?.topicId, 201)

  // Olasılık (6 soru) tetiklenmemeli
  assert.equal(points.some((p) => p.title === 'Olasılık'), false, 'Yetersiz soru sayısı tetiklenmemeli')

  console.log('✓ 1. KRİTİK deneme kuralı doğrulandı.')
}

// ---------------------------------------------------------------------------
// 2. KRİTİK (Koç Kararı) Kuralı
// ---------------------------------------------------------------------------
{
  const input: TalkingPointsInput = {
    studentId: 'test-2',
    referenceDate: REF_DATE,
    topicProgress: [
      {
        topicId: 301,
        topicName: 'Trigonometri',
        coachDecisionState: 'kritik',
      },
    ],
  }

  const points = buildTalkingPoints(input)
  const kritik = points.find((p) => p.id === 'kritik-karar-301')
  assert.ok(kritik, 'Koç kararı kritik maddesi üretilmeli')
  assert.equal(kritik.severity, 'danger')
  assert.ok(kritik.text.includes('Koç değerlendirmesi \'Kritik\' olarak işaretlendi'))
  assert.equal(kritik.action?.suggestedType, 'tekrar')

  console.log('✓ 2. KRİTİK koç kararı kuralı doğrulandı.')
}

// ---------------------------------------------------------------------------
// 3. ÖDEV Kuralı
// ---------------------------------------------------------------------------
{
  const input: TalkingPointsInput = {
    studentId: 'test-3',
    referenceDate: REF_DATE,
    programStats: {
      currentWeekTotalTasks: 10,
      currentWeekCompletedTasks: 4,
      currentWeekCompletionPct: 40,
      isWeekHalfway: true,
      uncompletedDayIndices: [0, 1], // Pazartesi, Salı
    },
  }

  const points = buildTalkingPoints(input)
  const odev = points.find((p) => p.kind === 'odev')
  assert.ok(odev, 'Ödev tamamlama maddesi üretilmeli')
  assert.equal(odev.severity, 'warning')
  assert.ok(odev.text.includes('%40'))
  assert.ok(odev.text.includes('Pazartesi, Salı'))
  assert.equal(odev.action?.kind, 'open_program')
  assert.equal(odev.action?.label, 'Programı Aç')

  // Hafta yarılanmamışsa veya tamamlama >= %70 ise tetiklenmemeli
  const inputNotHalfway: TalkingPointsInput = {
    ...input,
    programStats: {
      ...input.programStats!,
      isWeekHalfway: false,
    },
  }
  const pointsNotHalfway = buildTalkingPoints(inputNotHalfway)
  assert.equal(pointsNotHalfway.some((p) => p.kind === 'odev'), false, 'Hafta yarılanmadan ödev uyarısı çıkmamalı')

  console.log('✓ 3. ÖDEV tamamlama kuralı doğrulandı.')
}

// ---------------------------------------------------------------------------
// 4. TUTARSIZLIK Kuralı
// ---------------------------------------------------------------------------
{
  const input: TalkingPointsInput = {
    studentId: 'test-4',
    referenceDate: REF_DATE,
    topicProgress: [
      {
        topicId: 401,
        topicName: 'Paragrafta Anlam',
        taskQuestions: 40,
        taskAccuracy: 85,
        examAccuracy: 55, // Fark: 30 >= 20
      },
      {
        topicId: 402,
        topicName: 'Cümlede Anlam',
        taskQuestions: 15, // 20 sorudan az
        taskAccuracy: 90,
        examAccuracy: 60,
      },
    ],
  }

  const points = buildTalkingPoints(input)
  const tutarsizlik = points.find((p) => p.kind === 'tutarsizlik')
  assert.ok(tutarsizlik, 'Tutarsızlık maddesi üretilmeli')
  assert.equal(tutarsizlik.severity, 'warning')
  assert.ok(tutarsizlik.text.includes('Paragrafta Anlam'))
  assert.ok(tutarsizlik.text.includes('%85'))
  assert.ok(tutarsizlik.text.includes('%55'))
  assert.equal(tutarsizlik.action?.kind, 'add_to_program')
  assert.equal(tutarsizlik.action?.suggestedType, 'sureli_test')

  // Soru sayısı yetersiz olan tetiklenmemeli
  assert.equal(points.some((p) => p.text.includes('Cümlede Anlam')), false)

  console.log('✓ 4. TUTARSIZLIK kuralı doğrulandı.')
}

// ---------------------------------------------------------------------------
// 5. TEKRAR Kuralı
// ---------------------------------------------------------------------------
{
  const input: TalkingPointsInput = {
    studentId: 'test-5',
    referenceDate: REF_DATE,
    topicProgress: [
      {
        topicId: 501,
        topicName: 'Fonksiyonlar',
        lastMeasuredAccuracy: 80,
        lastTaskAt: '2026-09-20T00:00:00Z', // 36 gün önce (> 28 gün)
      },
      {
        topicId: 502,
        topicName: 'Polinomlar',
        lastMeasuredAccuracy: 80,
        lastTaskAt: '2026-10-20T00:00:00Z', // 6 gün önce (< 28 gün)
      },
    ],
  }

  const points = buildTalkingPoints(input)
  const tekrar = points.find((p) => p.kind === 'tekrar')
  assert.ok(tekrar, 'Tekrar maddesi üretilmeli')
  assert.equal(tekrar.severity, 'info')
  assert.ok(tekrar.text.includes('Fonksiyonlar'))
  assert.equal(tekrar.action?.suggestedType, 'tekrar')

  assert.equal(points.some((p) => p.text.includes('Polinomlar')), false, 'Yakın zamanda çalışılan tekrar gerektirmez')

  console.log('✓ 5. TEKRAR kuralı doğrulandı.')
}

// ---------------------------------------------------------------------------
// 6. İLERLEME (Monoton Artan Ders) Kuralı
// ---------------------------------------------------------------------------
{
  const input: TalkingPointsInput = {
    studentId: 'test-6',
    referenceDate: REF_DATE,
    subjectTrends: [
      {
        subjectId: 1,
        subjectName: 'Matematik',
        examNets: [18.25, 22.5, 27.0], // Monoton artış
      },
      {
        subjectId: 2,
        subjectName: 'Fizik',
        examNets: [10.0, 14.0, 12.0], // Dalgalı
      },
    ],
  }

  const points = buildTalkingPoints(input)
  const ilerleme = points.find((p) => p.kind === 'ilerleme')
  assert.ok(ilerleme, 'İlerleme maddesi üretilmeli')
  assert.equal(ilerleme.severity, 'success')
  assert.ok(ilerleme.text.includes('Matematik'))
  assert.ok(ilerleme.text.includes('18.25 → 22.5 → 27'))
  assert.equal(ilerleme.action, undefined, 'İlerleme maddesinde aksiyon butonu olmamalı')

  assert.equal(points.some((p) => p.text.includes('Fizik')), false, 'Dalgalı seyreden derste monoton artış çıkmamalı')

  console.log('✓ 6. İLERLEME (monoton ders neti) kuralı doğrulandı.')
}

// ---------------------------------------------------------------------------
// 7. İLERLEME (Konu Yeterli'ye Geçiş) Kuralı
// ---------------------------------------------------------------------------
{
  const input: TalkingPointsInput = {
    studentId: 'test-7',
    referenceDate: REF_DATE,
    topicProgress: [
      {
        topicId: 701,
        topicName: 'Mitoz ve Mayoz',
        previousState: 'kritik',
        coachDecisionState: 'yeterli',
        lastMeasuredAccuracy: 85,
      },
    ],
  }

  const points = buildTalkingPoints(input)
  const ilerleme = points.find((p) => p.id === 'ilerleme-konu-701')
  assert.ok(ilerleme, 'Konu gelişim maddesi üretilmeli')
  assert.equal(ilerleme.severity, 'success')
  assert.ok(ilerleme.text.includes('Mitoz ve Mayoz'))
  assert.ok(ilerleme.text.includes('Yeterli'))

  console.log('✓ 7. İLERLEME (konu durumu yükselmesi) kuralı doğrulandı.')
}

// ---------------------------------------------------------------------------
// 8. Kısıtlar: Max 5 Madde, Min 1 Olumlu veya "Veri Az" Notu
// ---------------------------------------------------------------------------
{
  // 8.1 Hiç olumlu yoksa en fazla 4 dikkat maddesi + 1 "veri az" notu = 5
  const inputNoPositive: TalkingPointsInput = {
    studentId: 'test-8',
    referenceDate: REF_DATE,
    examTopicStats: [
      { examTopicId: 1, examTopicName: 'K1', totalQuestions: 10, correctQuestions: 2, accuracyPct: 20, examCount: 4 },
      { examTopicId: 2, examTopicName: 'K2', totalQuestions: 10, correctQuestions: 2, accuracyPct: 20, examCount: 4 },
      { examTopicId: 3, examTopicName: 'K3', totalQuestions: 10, correctQuestions: 2, accuracyPct: 20, examCount: 4 },
      { examTopicId: 4, examTopicName: 'K4', totalQuestions: 10, correctQuestions: 2, accuracyPct: 20, examCount: 4 },
      { examTopicId: 5, examTopicName: 'K5', totalQuestions: 10, correctQuestions: 2, accuracyPct: 20, examCount: 4 },
      { examTopicId: 6, examTopicName: 'K6', totalQuestions: 10, correctQuestions: 2, accuracyPct: 20, examCount: 4 },
    ],
  }

  const pointsNoPos = buildTalkingPoints(inputNoPositive)
  assert.equal(pointsNoPos.length, 5, 'Tam olarak 5 madde olmalı')
  const veriAz = pointsNoPos.find((p) => p.id === 'info-veri-az')
  assert.ok(veriAz, 'Olumlu yokken veri az notu dahil edilmeli')
  assert.equal(veriAz.kind, 'bilgi')

  // 8.2 Olumlu varsa en az 1 olumlu mutlaka korunmalı
  const inputWithPositive: TalkingPointsInput = {
    ...inputNoPositive,
    subjectTrends: [
      { subjectId: 99, subjectName: 'Kimya', examNets: [5, 8, 12] },
    ],
  }

  const pointsWithPos = buildTalkingPoints(inputWithPositive)
  assert.equal(pointsWithPos.length, 5, 'Toplam 5 madde olmalı')
  assert.ok(pointsWithPos.some((p) => p.kind === 'ilerleme'), 'Olumlu madde mutlaka yer almalı')
  assert.equal(pointsWithPos.some((p) => p.id === 'info-veri-az'), false, 'Olumlu varken veri az notu eklenmemeli')

  console.log('✓ 8. Kısıtlar (en fazla 5 madde, en az 1 olumlu / veri az) doğrulandı.')
}

console.log('\n==============================================')
console.log('✅ TÜM TALKING POINTS ÖZ-TESTLERİ BAŞARIYLA GEÇTİ!')
console.log('==============================================')
