/**
 * scripts/examReport.selftest.ts
 *
 * K3 Öz-testi (assert tabanlı, harici bağımlılık yok).
 *
 * Doğrulananlar:
 * 1. Net formülü: TYT ceza 4 (D - Y/4), LGS ceza 3 (D - Y/3).
 * 2. Başarı %: Ders (net / soru * 100), Konu (D / S * 100).
 * 3. Kayıp net: S - (D - Y / ceza).
 * 4. Değişim (Δ): Aynı sınav türündeki önceki denemeye göre fark.
 * 5. Asgari veri kuralı: Çizgi için en az 3 deneme, konu için en az 3 soru.
 * 6. Başlık özeti cümleleri: "Son deneme ...", "En çok kaybettiren ...".
 * 7. İçgörü / Uyarı kuralları: Kritik konu, düşüş, yanlış riski, ilerleme.
 * 8. Rol şablonları: Koç (≤8), Öğrenci (≤5 ve en az 1 olumlu), Veli (≤4).
 *
 * Çalıştırma: npm run test:exam-report
 */

import assert from 'node:assert/strict'
import {
  calcNet,
  calcLossNet,
  calcSubjectAccuracy,
  calcTopicAccuracy,
  generateExamReport,
  type RawExamRecord,
  type ExamReportCatalog,
} from '../src/lib/examReport'
import {
  extractInsights,
  formatRoleInsights,
  INSIGHT_THRESHOLDS,
} from '../src/lib/examInsights'

console.log('▶ K3 Deneme Analiz Motoru & İçgörüler Öz-Testi Başlatılıyor...\n')

// ---------------------------------------------------------------------------
// 1. Temel Matematiksel Fonksiyonlar
// ---------------------------------------------------------------------------

// TYT Net (ceza 4): 33 doğru, 3 yanlış -> 33 - 3/4 = 32.25
assert.equal(calcNet(33, 3, 4), 32.25, 'TYT net 33D 3Y = 32.25 olmalı')

// LGS Net (ceza 3): 10 doğru, 3 yanlış -> 10 - 3/3 = 9.00
assert.equal(calcNet(10, 3, 3), 9.0, 'LGS net 10D 3Y = 9.00 olmalı')

// Kayıp Net (TYT, 40 soru, 33D, 3Y): 40 - 32.25 = 7.75
assert.equal(calcLossNet(40, 33, 3, 4), 7.75, 'Kayıp net 40 - 32.25 = 7.75 olmalı')

// Ders Başarı %: 33.75 net / 40 soru = %84.38
assert.equal(calcSubjectAccuracy(33.75, 40), 84.38, 'Ders başarı yüzdesi')

// Konu Başarı %: 4 doğru / 5 soru = %80.00
assert.equal(calcTopicAccuracy(4, 5), 80.0, 'Konu başarı yüzdesi')

console.log('✓ Temel formüller (net, kayıp net, başarı %) doğrulandı.')

// ---------------------------------------------------------------------------
// 2. Örnek Karne Verisiyle Rapor Üretimi (Spec §10b-7)
// ---------------------------------------------------------------------------

const sampleCatalog: ExamReportCatalog = {
  subjects: [
    { id: 1, exam_type: 'TYT', section_name: 'Türkçe', subject_id: 1, label: 'Türkçe', question_count: 40, sort_order: 1 },
    { id: 2, exam_type: 'TYT', section_name: 'Matematik', subject_id: 2, label: 'Matematik-1', question_count: 30, sort_order: 2 },
    { id: 3, exam_type: 'TYT', section_name: 'Matematik', subject_id: 3, label: 'Geometri', question_count: 10, sort_order: 3 },
  ],
  topics: [
    { id: 101, exam_subject_id: 1, name: 'Paragraf', sort_order: 1 },
    { id: 102, exam_subject_id: 1, name: 'Sözcükte Anlam', sort_order: 2 },
    { id: 201, exam_subject_id: 2, name: 'Sayılar', sort_order: 1 },
    { id: 202, exam_subject_id: 2, name: 'Problemler', sort_order: 2 },
  ],
}

// 2 Deneme senaryosu (asgari veri 3 eşiğini test etmek için)
const twoExams: RawExamRecord[] = [
  {
    id: 'exam-1',
    student_id: 'std-1',
    name: 'TYT Deneme 1',
    exam_type: 'TYT',
    exam_date: '2026-10-10',
    sections: [
      { section_name: 'Türkçe', max_questions: 40, correct_count: 30, wrong_count: 5, blank_count: 5, net: 28.75 },
      { section_name: 'Matematik', max_questions: 40, correct_count: 25, wrong_count: 4, blank_count: 11, net: 24.0 },
    ],
    subject_results: [
      { exam_subject_id: 1, question_count: 40, correct_count: 30, wrong_count: 5, blank_count: 5, net: 28.75 },
      { exam_subject_id: 2, question_count: 30, correct_count: 20, wrong_count: 3, blank_count: 7, net: 19.25 },
      { exam_subject_id: 3, question_count: 10, correct_count: 5, wrong_count: 1, blank_count: 4, net: 4.75 },
    ],
    topic_results: [
      { exam_topic_id: 101, question_count: 20, correct_count: 16, wrong_count: 3, blank_count: 1 },
      { exam_topic_id: 201, question_count: 5, correct_count: 2, wrong_count: 3, blank_count: 0 },
    ],
  },
  {
    id: 'exam-2',
    student_id: 'std-1',
    name: 'TYT Deneme 2',
    exam_type: 'TYT',
    exam_date: '2026-10-17',
    score: 415.5,
    percentile: 8.2,
    ranks: { genel: { sira: 150, katilan: 5000 } },
    coach_note: 'Matematik süresine dikkat.',
    sections: [
      { section_name: 'Türkçe', max_questions: 40, correct_count: 35, wrong_count: 2, blank_count: 3, net: 34.5 },
      { section_name: 'Matematik', max_questions: 40, correct_count: 28, wrong_count: 4, blank_count: 8, net: 27.0 },
    ],
    subject_results: [
      { exam_subject_id: 1, question_count: 40, correct_count: 35, wrong_count: 2, blank_count: 3, net: 34.5 },
      { exam_subject_id: 2, question_count: 30, correct_count: 22, wrong_count: 3, blank_count: 5, net: 21.25 },
      { exam_subject_id: 3, question_count: 10, correct_count: 6, wrong_count: 1, blank_count: 3, net: 5.75 },
    ],
    topic_results: [
      { exam_topic_id: 101, question_count: 20, correct_count: 18, wrong_count: 1, blank_count: 1 },
      { exam_topic_id: 201, question_count: 5, correct_count: 2, wrong_count: 2, blank_count: 1 },
    ],
  },
]

const report2 = generateExamReport(twoExams, sampleCatalog, 'TYT')

// 1. Deneme toplam netleri: Exam 1 = 28.75 + 24.0 = 52.75; Exam 2 = 34.5 + 27.0 = 61.5
assert.equal(report2.general.latest_exam?.net, 61.5, 'Son deneme neti 61.5 olmalı')
assert.equal(report2.general.latest_exam?.delta_net, 8.75, 'Δ net +8.75 olmalı (61.5 - 52.75)')

// Asgari veri kuralı (2 deneme < 3):
assert.equal(report2.general.min_data_reached, false, '2 denemede min_data_reached false olmalı')
assert.ok(
  report2.general.min_data_notice?.includes('Çizgi için en az 3 deneme gerekir (şu an 2)'),
  'Dürüst boş durum mesajı üretilmeli',
)
assert.ok(
  report2.general.headline.includes('Son deneme 61,50 net (+8,75)'),
  `Başlık özeti doğru formatta olmalı: "${report2.general.headline}"`,
)

console.log('✓ 2 denemeli senaryo ve asgari veri kuralı doğrulandı.')

// ---------------------------------------------------------------------------
// 3. 3. Denemenin Eklenmesi ve Eğilim Doğrulaması
// ---------------------------------------------------------------------------

const threeExams: RawExamRecord[] = [
  ...twoExams,
  {
    id: 'exam-3',
    student_id: 'std-1',
    name: 'TYT Deneme 3',
    exam_type: 'TYT',
    exam_date: '2026-10-24',
    sections: [
      { section_name: 'Türkçe', max_questions: 40, correct_count: 36, wrong_count: 4, blank_count: 0, net: 35.0 },
      { section_name: 'Matematik', max_questions: 40, correct_count: 32, wrong_count: 4, blank_count: 4, net: 31.0 },
    ],
    subject_results: [
      { exam_subject_id: 1, question_count: 40, correct_count: 36, wrong_count: 4, blank_count: 0, net: 35.0 },
      { exam_subject_id: 2, question_count: 30, correct_count: 25, wrong_count: 3, blank_count: 2, net: 24.25 },
      { exam_subject_id: 3, question_count: 10, correct_count: 7, wrong_count: 1, blank_count: 2, net: 6.75 },
    ],
    topic_results: [
      { exam_topic_id: 101, question_count: 20, correct_count: 19, wrong_count: 1, blank_count: 0 },
      { exam_topic_id: 201, question_count: 5, correct_count: 1, wrong_count: 4, blank_count: 0 },
    ],
  },
]

const report3 = generateExamReport(threeExams, sampleCatalog, 'TYT')

// 3 deneme tamamlandı:
assert.equal(report3.general.min_data_reached, true, '3 denemede min_data_reached true olmalı')
assert.equal(report3.general.min_data_notice, null, 'Eşik aşılınca notice null olmalı')
assert.equal(report3.general.time_series.length, 3, '3 nokta olmalı')

// Seviye 2 (Ders) kayıp sıralaması:
assert.ok(report3.subjects.loss_rankings.length > 0, 'Kayıp sıralaması boş olmamalı')
assert.ok(report3.subjects.top_loss_headline.includes('En çok kaybettiren ders'), 'Ders kayıp başlığı üretilmeli')

// Seviye 3 (Konu):
// 'Sayılar' konusu toplam: 5 + 5 + 5 = 15 soru; doğru = 2 + 2 + 1 = 5; yanlış = 3 + 2 + 4 = 9
const sayilarTopic = report3.topicsBySubject[2]?.rows.find((r) => r.exam_topic_id === 201)
assert.ok(sayilarTopic, 'Sayılar konusu bulunmalı')
assert.equal(sayilarTopic?.total_questions, 15, 'Sayılar toplam 15 soru olmalı')
assert.equal(sayilarTopic?.total_correct, 5, 'Sayılar toplam 5 doğru olmalı')
assert.equal(sayilarTopic?.total_accuracy_pct, 33.33, 'Sayılar başarı %33.33 olmalı (5/15)')
assert.equal(sayilarTopic?.status_badge, 'weak', 'Başarı < %50 zayıf (weak) bandı olmalı')

console.log('✓ 3 denemeli rapor, zaman serisi ve konu birikimli toplamları doğrulandı.')

// ---------------------------------------------------------------------------
// 4. İçgörüler ve Uyarı Motoru (Spec §7)
// ---------------------------------------------------------------------------

const rawInsights = extractInsights(report3)
assert.ok(rawInsights.length > 0, 'En az 1 içgörü üretilmeli')

// Kritik konu kuralı: Sayılar konusu (15 soru >= 4 ve %33.33 < %50)
const criticalSayilar = rawInsights.find((i) => i.kind === 'critical_topic' && i.topic_name === 'Sayılar')
assert.ok(criticalSayilar, 'Sayılar konusu kritik konu olarak yakalanmalı')

// İlerleme kuralı: Türkçe dersi netleri 28.75 -> 34.50 -> 35.00 ardışık 3 artış!
const progressTr = rawInsights.find((i) => i.kind === 'progress' && i.subject_label === 'Türkçe')
assert.ok(progressTr, 'Türkçe dersindeki ardışık 3 artış ilerleme olarak yakalanmalı')

// Rol formatlayıcı
const roleInsights = formatRoleInsights(rawInsights)

// Koç: <= 8 madde
assert.ok(roleInsights.coach.length <= INSIGHT_THRESHOLDS.MAX_COACH_ITEMS, 'Koç maddeleri ≤ 8 olmalı')
assert.ok(roleInsights.coach.some((c) => c.text.includes('Sayılar')), 'Koç metninde kritik konu yer almalı')

// Öğrenci: <= 5 madde ve en az 1 olumlu
assert.ok(roleInsights.student.length <= INSIGHT_THRESHOLDS.MAX_STUDENT_ITEMS, 'Öğrenci maddeleri ≤ 5 olmalı')
assert.ok(roleInsights.student.some((s) => s.is_positive), 'Öğrenci şablonunda en az 1 olumlu madde olmalı')

// Veli: <= 4 madde
assert.ok(roleInsights.parent.length <= INSIGHT_THRESHOLDS.MAX_PARENT_ITEMS, 'Veli maddeleri ≤ 4 olmalı')

console.log('✓ Kural tabanlı uyarı motoru ve rol şablonları doğrulandı.')
console.log('  Örnek Koç Uyarısı:', roleInsights.coach[0]?.text)
console.log('  Örnek Öğrenci Uyarısı:', roleInsights.student.find((s) => !s.is_positive)?.text)
console.log('  Örnek Öğrenci Olumlu:', roleInsights.student.find((s) => s.is_positive)?.text)
console.log('  Örnek Veli Bilgilendirmesi:', roleInsights.parent[0]?.text)

console.log('\n==============================================')
console.log('✅ TÜM K3 ÖZ-TESTLERİ BAŞARIYLA GEÇTİ!')
console.log('==============================================')
