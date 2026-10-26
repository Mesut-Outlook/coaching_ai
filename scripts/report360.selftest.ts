/**
 * scripts/report360.selftest.ts
 *
 * R2-1 Koç 360 Raporu Saf Motoru Öz-Testi
 *
 * Doğrulanan bölümler:
 * 1. Regresyon ve Medyan matematiksel hesaplamaları
 * 2. K0: KPI Şeridi (Son net, Δ, hedef mesafesi, 4 haftalık ödev tamamlama ve doğruluk, müfredat)
 * 3. B2: Hedef Yolu (Doğrusal regresyon, 3 deneme kuralı, sınav tarihi tahmini, belirsizlik bandı)
 * 4. B3: Öncelik Matrisi (Başarı, ağırlık, öncelik puanı, 4 bölge sınıflandırması, ilk 6 öncelik)
 * 5. B4: Net Kaybı Pareto (Kayıp net formülü, birikimli %, %60 kritik eşiği, Diğer çubuğu)
 * 6. B5: Hata Profili (Son 3 deneme bölüm bazlı yanlış/boş oranı ve 4 bölge önerileri)
 * 7. B6: Ödev ↔ Deneme Tutarlılığı (Fark ≥ 15, yön, öneri, boş durum mesajı)
 * 8. B7: Müfredat İlerlemesi ve Yetişme Tahmini (Ders bazlı dağılım, hız, kalan hafta, gecikme uyarısı)
 *
 * Çalıştırma: npm run test:report360
 */

import assert from 'node:assert/strict'
import {
  calculateLinearRegression,
  calculateMedian,
  buildReport360,
  type Report360Input,
} from '../src/lib/report360Core'

console.log('▶ R2-1 Koç 360 Raporu Motoru Öz-Testi Başlatılıyor...\n')

// ---------------------------------------------------------------------------
// 1. Regresyon ve Medyan Yardımcıları
// ---------------------------------------------------------------------------
{
  const regPoints = [
    { x: 0, y: 50 },
    { x: 10, y: 60 },
    { x: 20, y: 70 },
  ]
  const reg = calculateLinearRegression(regPoints)
  assert.equal(reg.slope, 1.0, 'Eğim 1.0 olmalı')
  assert.equal(reg.intercept, 50.0, 'Kesişim 50 olmalı')
  assert.equal(reg.residualStdDev, 0, 'Tam doğrusalda artık standart sapma 0 olmalı')

  assert.equal(calculateMedian([1, 2, 3]), 2, 'Tek sayıda ortadaki değer')
  assert.equal(calculateMedian([1, 2, 4, 6]), 3, 'Çift sayıda ortadaki ikilinin ortalaması')
  assert.equal(calculateMedian([]), 0, 'Boş dizide 0')

  console.log('✓ 1. Regresyon ve medyan matematiksel fonksiyonları doğrulandı.')
}

// ---------------------------------------------------------------------------
// 2. K0: KPI Şeridi
// ---------------------------------------------------------------------------
{
  const refDate = new Date('2026-10-26T12:00:00Z')
  const input: Report360Input = {
    studentId: 'test-k0',
    examType: 'TYT',
    targetNet: 95.0,
    examDate: '2026-12-07', // 6 hafta sonra
    referenceDate: refDate,
    wrongPenalty: 4,
    exams: [
      { id: 'e1', name: 'Deneme 1', exam_date: '2026-10-10', exam_type: 'TYT', net: 80.0 },
      { id: 'e2', name: 'Deneme 2', exam_date: '2026-10-24', exam_type: 'TYT', net: 86.0 },
    ],
    topicResults: [],
    sectionResults: [],
    topicLinks: [],
    coachDecisions: [
      { topic_id: 1, state: 'yeterli', decided_at: '2026-10-20' },
      { topic_id: 2, state: 'gelisiyor', decided_at: '2026-10-20' },
    ],
    tasks: [
      // Son 4 hafta: 2 görev, 1 tamamlandı, 20 soru (16D, 4Y)
      {
        id: 't1',
        topic_id: 1,
        task_type: 'tekrar',
        completed: true,
        completed_at: '2026-10-20',
        created_at: '2026-10-15T00:00:00Z',
        correct_count: 16,
        wrong_count: 4,
        blank_count: 0,
        question_count: 20,
      },
      {
        id: 't2',
        topic_id: 2,
        task_type: 'konu',
        completed: false,
        completed_at: null,
        created_at: '2026-10-22T00:00:00Z',
        correct_count: null,
        wrong_count: null,
        blank_count: null,
        question_count: 20,
      },
      // Önceki 4 hafta (4-8 hafta önce): 1 görev tamamlandı
      {
        id: 't3',
        topic_id: 1,
        task_type: 'konu',
        completed: true,
        completed_at: '2026-09-20',
        created_at: '2026-09-15T00:00:00Z',
        correct_count: null,
        wrong_count: null,
        blank_count: null,
        question_count: 20,
      },
    ],
    curriculumTopics: [
      { id: 1, name: 'Sözcükte Anlam', subject_id: 10, subject_name: 'Türkçe' },
      { id: 2, name: 'Cümlede Anlam', subject_id: 10, subject_name: 'Türkçe' },
      { id: 3, name: 'Paragraf', subject_id: 10, subject_name: 'Türkçe' },
      { id: 4, name: 'Temel Kavramlar', subject_id: 20, subject_name: 'Matematik' },
    ],
  }

  const res = buildReport360(input)
  const kpi = res.kpi

  assert.equal(kpi.lastNet, 86.0)
  assert.equal(kpi.previousNet, 80.0)
  assert.equal(kpi.deltaNet, 6.0)
  assert.equal(kpi.targetNet, 95.0)
  assert.equal(kpi.netGap, 9.0) // 95 - 86
  assert.equal(kpi.weeksLeft, 6)
  assert.equal(kpi.weeklyNeededNet, 1.5) // 9 / 6

  // Ödev tamamlama
  assert.equal(kpi.taskCompletion4w.currentPct, 50) // 1 / 2
  assert.equal(kpi.taskCompletion4w.previousPct, 100) // 1 / 1
  assert.equal(kpi.taskCompletion4w.deltaPct, -50)

  // Ödev doğruluğu
  assert.equal(kpi.taskAccuracy4w.accuracyPct, 80) // 16 / 20 = %80
  assert.equal(kpi.taskAccuracy4w.totalQuestions, 20)

  // Müfredat ilerlemesi
  assert.equal(kpi.curriculumProgress.sufficientCount, 1)
  assert.equal(kpi.curriculumProgress.totalCount, 4)
  assert.equal(kpi.curriculumProgress.pct, 25) // 1 / 4 = %25

  console.log('✓ 2. K0 (KPI Şeridi) hesaplamaları doğrulandı.')
}

// ---------------------------------------------------------------------------
// 3. B2: Hedef Yolu (Trajectory)
// ---------------------------------------------------------------------------
{
  // 3.1 3 denemeden azsa tahmin yapılmamalı
  const inputFewExams: Report360Input = {
    studentId: 'test-b2-few',
    examType: 'TYT',
    exams: [
      { id: '1', name: 'D1', exam_date: '2026-10-01', exam_type: 'TYT', net: 70 },
      { id: '2', name: 'D2', exam_date: '2026-10-15', exam_type: 'TYT', net: 75 },
    ],
    topicResults: [],
    sectionResults: [],
    topicLinks: [],
    coachDecisions: [],
    tasks: [],
    curriculumTopics: [],
  }
  const resFew = buildReport360(inputFewExams)
  assert.equal(resFew.trajectory.prediction.canPredict, false)
  assert.ok(resFew.trajectory.prediction.reason?.includes('en az 3 deneme'))

  // 3.2 4 denemeli regresyon ve hedefe varış
  const inputTrajectory: Report360Input = {
    ...inputFewExams,
    targetNet: 90.0,
    examDate: '2026-11-20', // 50 gün sonra
    exams: [
      { id: '1', name: 'D1', exam_date: '2026-10-01', exam_type: 'TYT', net: 70 }, // Gün 0
      { id: '2', name: 'D2', exam_date: '2026-10-11', exam_type: 'TYT', net: 73 }, // Gün 10
      { id: '3', name: 'D3', exam_date: '2026-10-21', exam_type: 'TYT', net: 76 }, // Gün 20
      { id: '4', name: 'D4', exam_date: '2026-10-31', exam_type: 'TYT', net: 79 }, // Gün 30
    ],
  }
  const resTraj = buildReport360(inputTrajectory)
  const pred = resTraj.trajectory.prediction
  assert.equal(pred.canPredict, true)
  assert.ok(pred.predictedNetAtExam! >= 84.0 && pred.predictedNetAtExam! <= 86.0)
  assert.ok(pred.confidenceBandWidth! >= 3.0, 'En az ±3 net belirsizlik bandı olmalı')
  assert.ok(pred.summaryText.includes('hedefin'), 'Özet metin hedef kıyaslamasını içermeli')

  // 3.3 Maksimum net sınır taşması (TYT 120 net sınırı aşılmamalı)
  const inputOverflow: Report360Input = {
    ...inputFewExams,
    examDate: '2027-06-20', // Çok ileri bir tarih, regresyon 150+ net çıkarabilir
    exams: [
      { id: '1', name: 'D1', exam_date: '2026-10-01', exam_type: 'TYT', net: 100 },
      { id: '2', name: 'D2', exam_date: '2026-10-11', exam_type: 'TYT', net: 105 },
      { id: '3', name: 'D3', exam_date: '2026-10-21', exam_type: 'TYT', net: 110 },
    ],
  }
  const resOverflow = buildReport360(inputOverflow)
  assert.equal(resOverflow.trajectory.prediction.predictedNetAtExam, 120, 'TYT tahmin neti 120 sınırını aşmamalı')

  console.log('✓ 3. B2 (Hedef Yolu regresyon & tahmin) doğrulandı.')
}

// ---------------------------------------------------------------------------
// 4. B3: Öncelik Matrisi
// ---------------------------------------------------------------------------
{
  const inputMatrix: Report360Input = {
    studentId: 'test-b3',
    examType: 'TYT',
    exams: [
      { id: 'e1', name: 'D1', exam_date: '2026-10-01', exam_type: 'TYT', net: 70 },
      { id: 'e2', name: 'D2', exam_date: '2026-10-15', exam_type: 'TYT', net: 75 },
    ],
    topicResults: [
      // Konu 1: Ağırlık 4, Başarı 1/4 (%25) -> Hemen Çalış
      {
        mock_exam_id: 'e1',
        exam_topic_id: 1,
        exam_topic_name: 'Problemler',
        exam_subject_name: 'Matematik',
        correct_count: 1,
        wrong_count: 3,
        blank_count: 0,
        question_count: 4,
      },
      // Konu 2: Ağırlık 4, Başarı 4/4 (%100) -> Koru
      {
        mock_exam_id: 'e1',
        exam_topic_id: 2,
        exam_topic_name: 'Temel Kavramlar',
        exam_subject_name: 'Matematik',
        correct_count: 4,
        wrong_count: 0,
        blank_count: 0,
        question_count: 4,
      },
      // Konu 3: Ağırlık 1, Başarı 0/1 (%0) -> Hızlı Kazanım
      {
        mock_exam_id: 'e1',
        exam_topic_id: 3,
        exam_topic_name: 'Mantık',
        exam_subject_name: 'Matematik',
        correct_count: 0,
        wrong_count: 1,
        blank_count: 0,
        question_count: 1,
      },
      // Konu 4: Ağırlık 1, Başarı 1/1 (%100) -> Sonra
      {
        mock_exam_id: 'e1',
        exam_topic_id: 4,
        exam_topic_name: 'Kümeler',
        exam_subject_name: 'Matematik',
        correct_count: 1,
        wrong_count: 0,
        blank_count: 0,
        question_count: 1,
      },
    ],
    globalTopicWeights: [
      { exam_topic_id: 1, avg_questions: 4.0 },
      { exam_topic_id: 2, avg_questions: 4.0 },
      { exam_topic_id: 3, avg_questions: 1.0 },
      { exam_topic_id: 4, avg_questions: 1.0 },
    ],
    sectionResults: [],
    topicLinks: [{ exam_topic_id: 1, topic_id: 101, is_primary: true }],
    coachDecisions: [],
    tasks: [],
    curriculumTopics: [],
  }

  const res = buildReport360(inputMatrix)
  const pts = res.priorityMatrix.points

  const p1 = pts.find((p) => p.examTopicId === 1)!
  const p2 = pts.find((p) => p.examTopicId === 2)!
  const p3 = pts.find((p) => p.examTopicId === 3)!
  const p4 = pts.find((p) => p.examTopicId === 4)!

  assert.equal(p1.quadrant, 'hemen_calis', 'Başarı <%70 ve ağırlık yüksek -> hemen çalış')
  assert.equal(p2.quadrant, 'koru', 'Başarı ≥%70 ve ağırlık yüksek -> koru')
  assert.equal(p3.quadrant, 'hizli_kazanim', 'Başarı <%70 ve ağırlık düşük -> hızlı kazanım')
  assert.equal(p4.quadrant, 'sonra', 'Başarı ≥%70 ve ağırlık düşük -> sonra')

  assert.equal(p1.curriculumTopicId, 101, 'is_primary bağlantısı aktarılmalı')
  assert.equal(pts[0].examTopicId, 1, 'En yüksek öncelik puanlı konu ilk sırada olmalı')

  console.log('✓ 4. B3 (Öncelik Matrisi & 4 bölge) doğrulandı.')
}

// ---------------------------------------------------------------------------
// 5. B4: Net Kaybı Pareto
// ---------------------------------------------------------------------------
{
  const inputPareto: Report360Input = {
    studentId: 'test-b4',
    examType: 'TYT',
    wrongPenalty: 4,
    exams: [{ id: 'e1', name: 'D1', exam_date: '2026-10-01', exam_type: 'TYT', net: 70 }],
    topicResults: [
      // K1: 10 soru, 0 doğru, 4 yanlış (net = -1, kayıp = 10 - (-1) = 11)
      { mock_exam_id: 'e1', exam_topic_id: 1, exam_topic_name: 'Problemler', exam_subject_name: 'Mat', correct_count: 0, wrong_count: 4, blank_count: 6, question_count: 10 },
      // K2: 5 soru, 2 doğru, 2 yanlış (net = 1.5, kayıp = 3.5)
      { mock_exam_id: 'e1', exam_topic_id: 2, exam_topic_name: 'Geometri', exam_subject_name: 'Mat', correct_count: 2, wrong_count: 2, blank_count: 1, question_count: 5 },
      // K3: 2 soru, 1 doğru, 0 yanlış (net = 1.0, kayıp = 1.0)
      { mock_exam_id: 'e1', exam_topic_id: 3, exam_topic_name: 'Fonksiyonlar', exam_subject_name: 'Mat', correct_count: 1, wrong_count: 0, blank_count: 1, question_count: 2 },
    ],
    sectionResults: [],
    topicLinks: [],
    coachDecisions: [],
    tasks: [],
    curriculumTopics: [],
  }

  const res = buildReport360(inputPareto)
  const pareto = res.paretoLoss

  assert.equal(pareto.totalLossNet, 15.5) // 11 + 3.5 + 1.0 = 15.5
  assert.equal(pareto.bars[0].examTopicName, 'Problemler')
  assert.equal(pareto.bars[0].isCritical, true, 'İlk konu toplam kaybın çoğunluğunu oluşturduğu için kritik olmalı')
  assert.ok(pareto.summaryText.includes('konu, toplam kaybın %'))

  console.log('✓ 5. B4 (Net Kaybı Pareto) doğrulandı.')
}

// ---------------------------------------------------------------------------
// 6. B5: Hata Profili
// ---------------------------------------------------------------------------
{
  const inputError: Report360Input = {
    studentId: 'test-b5',
    examType: 'TYT',
    exams: [
      { id: 'e1', name: 'D1', exam_date: '2026-10-01', exam_type: 'TYT', net: 70 },
      { id: 'e2', name: 'D2', exam_date: '2026-10-10', exam_type: 'TYT', net: 75 },
      { id: 'e3', name: 'D3', exam_date: '2026-10-20', exam_type: 'TYT', net: 80 },
    ],
    sectionResults: [
      // Türkçe: 40 soru, 35D, 3Y (%7.5), 2B (%5) -> Sağlam
      { mock_exam_id: 'e3', section_name: 'Türkçe', correct_count: 35, wrong_count: 3, blank_count: 2, max_questions: 40 },
      // Matematik: 40 soru, 20D, 10Y (%25), 10B (%25) -> Konu Eksiği
      { mock_exam_id: 'e3', section_name: 'Matematik', correct_count: 20, wrong_count: 10, blank_count: 10, max_questions: 40 },
      // Fen: 20 soru, 16D, 4Y (%20), 0B (%0) -> Riskli İşaretleme
      { mock_exam_id: 'e3', section_name: 'Fen Bilimleri', correct_count: 16, wrong_count: 4, blank_count: 0, max_questions: 20 },
      // Sosyal: 20 soru, 14D, 1Y (%5), 5B (%25) -> Süre / Strateji
      { mock_exam_id: 'e3', section_name: 'Sosyal Bilimler', correct_count: 14, wrong_count: 1, blank_count: 5, max_questions: 20 },
    ],
    topicResults: [],
    topicLinks: [],
    coachDecisions: [],
    tasks: [],
    curriculumTopics: [],
  }

  const res = buildReport360(inputError)
  const pts = res.errorProfile.points

  const turkce = pts.find((p) => p.sectionName === 'Türkçe')!
  const mat = pts.find((p) => p.sectionName === 'Matematik')!
  const fen = pts.find((p) => p.sectionName === 'Fen Bilimleri')!
  const sos = pts.find((p) => p.sectionName === 'Sosyal Bilimler')!

  assert.equal(turkce.quadrant, 'saglam')
  assert.equal(mat.quadrant, 'konu_eksigi')
  assert.equal(fen.quadrant, 'riskli_isaretleme')
  assert.equal(sos.quadrant, 'sure_strateji')

  console.log('✓ 6. B5 (Hata Profili 4 bölge) doğrulandı.')
}

// ---------------------------------------------------------------------------
// 7. B6: Ödev ↔ Deneme Tutarlılığı
// ---------------------------------------------------------------------------
{
  const refDate = new Date('2026-10-26T12:00:00Z')
  const inputConsistency: Report360Input = {
    studentId: 'test-b6',
    examType: 'TYT',
    referenceDate: refDate,
    exams: [{ id: 'e1', name: 'D1', exam_date: '2026-10-20', exam_type: 'TYT', net: 70 }],
    topicResults: [
      // Denemede Paragraf: 10 soru, 5 doğru = %50
      { mock_exam_id: 'e1', exam_topic_id: 1, exam_topic_name: 'Paragraf', exam_subject_name: 'Türkçe', correct_count: 5, wrong_count: 5, blank_count: 0, question_count: 10 },
    ],
    topicLinks: [{ exam_topic_id: 1, topic_id: 101, is_primary: true }],
    tasks: [
      // Görevlerde Paragraf: 25 soru, 22 doğru = %88 (Fark = 38 >= 15) -> Süreli test ekle
      {
        id: 't1',
        topic_id: 101,
        task_type: 'konu',
        completed: true,
        completed_at: '2026-10-22',
        created_at: '2026-10-21T00:00:00Z',
        correct_count: 22,
        wrong_count: 3,
        blank_count: 0,
        question_count: 25,
      },
    ],
    curriculumTopics: [{ id: 101, name: 'Paragraf', subject_id: 10, subject_name: 'Türkçe' }],
    sectionResults: [],
    coachDecisions: [],
  }

  const res = buildReport360(inputConsistency)
  const consistency = res.consistency

  assert.equal(consistency.hasEnoughData, true)
  assert.equal(consistency.items.length, 1)
  const item = consistency.items[0]
  assert.equal(item.direction, 'task_higher')
  assert.equal(item.suggestion, 'Süreli test ekle')
  assert.equal(item.taskAccuracyPct, 88)
  assert.equal(item.examAccuracyPct, 50)

  console.log('✓ 7. B6 (Ödev ↔ Deneme Tutarlılığı) doğrulandı.')
}

// ---------------------------------------------------------------------------
// 8. B7: Müfredat İlerlemesi ve Yetişme Tahmini
// ---------------------------------------------------------------------------
{
  const refDate = new Date('2026-10-26T12:00:00Z')
  const inputCurriculum: Report360Input = {
    studentId: 'test-b7',
    examType: 'TYT',
    examDate: '2026-12-07', // 6 hafta sonra
    referenceDate: refDate,
    exams: [],
    topicResults: [],
    sectionResults: [],
    topicLinks: [],
    tasks: [{ id: 't1', topic_id: 2, task_type: 'konu', completed: true, completed_at: null, created_at: '2026-10-20T00:00:00Z', correct_count: null, wrong_count: null, blank_count: null, question_count: 20 }],
    coachDecisions: [
      // Son 6 haftada 3 konu yeterliye geçti -> hız = 3 / 6 = 0.5 konu/hafta
      { topic_id: 1, state: 'yeterli', decided_at: '2026-10-10' },
      { topic_id: 3, state: 'gelisiyor', decided_at: '2026-10-10' },
    ],
    curriculumTopics: [
      { id: 1, name: 'T1', subject_id: 10, subject_name: 'Türkçe' },
      { id: 2, name: 'T2', subject_id: 10, subject_name: 'Türkçe' },
      { id: 3, name: 'T3', subject_id: 10, subject_name: 'Türkçe' },
      { id: 4, name: 'M1', subject_id: 20, subject_name: 'Matematik' },
    ],
  }

  const res = buildReport360(inputCurriculum)
  const cur = res.curriculum

  assert.equal(cur.totalTopics, 4)
  assert.equal(cur.totalSufficient, 1)

  // Ders dağılımı
  const turkce = cur.subjects.find((s) => s.subjectName === 'Türkçe')!
  assert.equal(turkce.sufficient, 1)
  assert.equal(turkce.developing, 1)
  assert.equal(turkce.worked, 1)
  assert.equal(turkce.notStarted, 0)

  // Hız & Yetişme
  const vel = cur.velocity
  assert.ok(vel.weeklyRate > 0)

  console.log('✓ 8. B7 (Müfredat ilerlemesi & yetişme tahmini) doğrulandı.')
}

console.log('\n==============================================')
console.log('✅ TÜM RAPOR 360 ÖZ-TESTLERİ BAŞARIYLA GEÇTİ!')
console.log('==============================================')
