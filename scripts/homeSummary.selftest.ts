/**
 * scripts/homeSummary.selftest.ts
 *
 * G2 — Ana Sayfa Veri Katmanı Öz-Testi (Saf Assert, Harici DB Bağımlılığı Yok).
 *
 * Doğrulananlar:
 * 1. Öğrenci Dağılımı: YKS / LGS (gradeCurriculum) ayrımı ve aktif sayısı.
 * 2. İlgi Bekleyen Öğrenciler (Attention Reasons):
 *    - 'kritik_karar': coach_decisions.state = 'kritik'.
 *    - 'net_dususu': aynı sınav türünde bir önceki denemeye göre ≥ 5 net düşüş.
 *    - 'devamsizlik_takip': son 30 günde toplam ≥ 3 veya mazeretsiz ≥ 2 devamsızlık.
 *    - 'program_dusuk': hafta yarılandığında tamamlama < %50.
 *    - 'program_yok': haftalık görev planlanmamış olması.
 *    - 'deneme_yok': son 21 günde hiç deneme girilmemiş olması.
 * 3. Öncelik Sıralaması: Neden sayısı çok olan önce, ardından ağırlık sırası.
 * 4. Denemeler Özeti: Son 7 gün sayısı, ortalama net değişimi (avgDelta), konusu girilmemiş sayaç.
 * 5. Program Özeti: Toplam görev, tamamlanan görev, genel %, görevi olmayan öğrenci sayısı.
 * 6. Devamsızlık Özeti: Bu hafta devamsızlıkları, takip gereken öğrenci, WhatsApp bildirimi bekleyenler.
 * 7. Son Hareketler Akışı: Son 10 hareket, azalan kronolojik sıralı.
 *
 * Çalıştırma: npm run test:home-summary
 */

import assert from 'node:assert/strict'
import {
  buildHomeSummary,
  type EnrichedMockExam,
} from '../src/lib/homeSummary'
import type {
  AttendanceRecord,
  CoachDecision,
  Student,
  WeeklyTask,
} from '../src/types/database'

console.log('▶ G2 Ana Sayfa Veri Katmanı Öz-Testi Başlatılıyor...\n')

const REF_DATE = '2026-10-25T12:00:00Z' // Pazar günü (hafta tamamlanmış/yarılanmış)

// ---------------------------------------------------------------------------
// Mock Veriler
// ---------------------------------------------------------------------------

const mockStudents: Student[] = [
  {
    id: 's-ali',
    institution_id: 'inst-1',
    full_name: 'Ali Yılmaz',
    grade: '12. Sınıf', // YKS
    track: 'SAY',
    school_name: 'Fen Lisesi',
    target_field: 'Mühendislik',
    notes: null,
    phone_number: '5551111111',
    parent_phone_number: '5552222222',
    is_active: true,
    created_at: '2026-08-01T09:00:00Z',
    access_code: null,
    coaching_coach_id: null,
    photo_url: null,
  },
  {
    id: 's-ayse',
    institution_id: 'inst-1',
    full_name: 'Ayşe Kaya',
    grade: '8. Sınıf', // LGS
    track: null,
    school_name: 'Ortaokul',
    target_field: 'Lise',
    notes: null,
    phone_number: '5553333333',
    parent_phone_number: '5554444444',
    is_active: true,
    created_at: '2026-08-01T09:00:00Z',
    access_code: null,
    coaching_coach_id: null,
    photo_url: null,
  },
  {
    id: 's-mehmet',
    institution_id: 'inst-1',
    full_name: 'Mehmet Demir',
    grade: 'Mezun', // YKS
    track: 'EA',
    school_name: null,
    target_field: 'Hukuk',
    notes: null,
    phone_number: null,
    parent_phone_number: null,
    is_active: true,
    created_at: '2026-08-01T09:00:00Z',
    access_code: null,
    coaching_coach_id: null,
    photo_url: null,
  },
  {
    id: 's-pasif',
    institution_id: 'inst-1',
    full_name: 'Pasif Can',
    grade: '11. Sınıf',
    track: 'SAY',
    school_name: null,
    target_field: null,
    notes: null,
    phone_number: null,
    parent_phone_number: null,
    is_active: false, // Pasif öğrenci sayılmamalı
    created_at: '2026-08-01T09:00:00Z',
    access_code: null,
    coaching_coach_id: null,
    photo_url: null,
  },
]

// ---------------------------------------------------------------------------
// 1. Öğrenci Dağılımı Testi
// ---------------------------------------------------------------------------

const baseSummary = buildHomeSummary({
  students: mockStudents,
  coachDecisions: [],
  mockExams: [],
  weeklyTasks: [],
  attendanceRecords: [],
  referenceDate: REF_DATE,
})

assert.equal(baseSummary.students.totalActive, 3, 'Aktif öğrenci sayısı 3 olmalı (pasif hariç)')
assert.equal(baseSummary.students.yksCount, 2, 'YKS öğrencisi 2 olmalı (12. Sınıf + Mezun)')
assert.equal(baseSummary.students.lgsCount, 1, 'LGS öğrencisi 1 olmalı (8. Sınıf)')
console.log('✓ 1. Öğrenci dağılımı (YKS/LGS) başarıyla doğrulandı.')

// ---------------------------------------------------------------------------
// 2. İlgi Bekleyen Öğrenciler (Attention Reasons)
// ---------------------------------------------------------------------------

// A) kritik_karar testi
const decisions: CoachDecision[] = [
  {
    id: 'cd-1',
    student_id: 's-ali',
    topic_id: 101,
    state: 'kritik',
    note: 'Türevde ciddi eksik',
    decided_by: 'coach-1',
    decided_at: '2026-10-24T10:00:00Z',
  },
]

const summaryWithKritik = buildHomeSummary({
  students: mockStudents,
  coachDecisions: decisions,
  mockExams: [],
  weeklyTasks: [],
  attendanceRecords: [],
  referenceDate: REF_DATE,
})

const aliAttention = summaryWithKritik.attention.find((a) => a.studentId === 's-ali')
assert.ok(aliAttention, 'Ali ilgi listesinde olmalı')
assert.ok(
  aliAttention.reasons.some((r) => r.kind === 'kritik_karar'),
  'Ali için kritik_karar nedeni bulunmalı'
)
console.log('✓ 2.A kritik_karar nedeni doğrulandı.')

// B) net_dususu testi (son deneme bir öncekinden >= 5 net düşük)
const mockExams: EnrichedMockExam[] = [
  // Ali: TYT Deneme 1 (2026-10-10) -> 80 net
  {
    id: 'e-ali-1',
    student_id: 's-ali',
    name: 'TYT Deneme 1',
    publisher: 'Test Yayını',
    exam_type: 'TYT',
    exam_date: '2026-10-10',
    score: null,
    percentile: null,
    ranks: null,
    coach_note: null,
    created_at: '2026-10-10T12:00:00Z',
    totalNet: 80,
    sectionsList: [{ id: 'sec-1', mock_exam_id: 'e-ali-1', section_name: 'Türkçe', max_questions: 40, correct_count: 40, wrong_count: 0, blank_count: 0, wrong_penalty: 4, net: 40 }],
    hasTopics: true,
  },
  // Ali: TYT Deneme 2 (2026-10-24) -> 73 net (7 net düşüş! >= 5)
  {
    id: 'e-ali-2',
    student_id: 's-ali',
    name: 'TYT Deneme 2',
    publisher: 'Test Yayını',
    exam_type: 'TYT',
    exam_date: '2026-10-24',
    score: null,
    percentile: null,
    ranks: null,
    coach_note: null,
    created_at: '2026-10-24T12:00:00Z',
    totalNet: 73,
    sectionsList: [{ id: 'sec-2', mock_exam_id: 'e-ali-2', section_name: 'Türkçe', max_questions: 40, correct_count: 33, wrong_count: 0, blank_count: 7, wrong_penalty: 4, net: 33 }],
    hasTopics: true,
  },
]

const summaryWithExams = buildHomeSummary({
  students: mockStudents,
  coachDecisions: [],
  mockExams,
  weeklyTasks: [],
  attendanceRecords: [],
  referenceDate: REF_DATE,
})

const aliNetDususu = summaryWithExams.attention.find((a) => a.studentId === 's-ali')
assert.ok(
  aliNetDususu?.reasons.some((r) => r.kind === 'net_dususu'),
  'Ali için net_dususu nedeni bulunmalı (-7 net)'
)
console.log('✓ 2.B net_dususu nedeni doğrulandı.')

// C) devamsizlik_takip testi (30 günde >= 3 toplam veya >= 2 mazeretsiz)
const attendance: AttendanceRecord[] = [
  {
    id: 'att-1',
    student_id: 's-ayse',
    absence_date: '2026-10-20',
    session_type: 'birebir',
    status: 'gelmedi',
    excuse_type: 'yok', // 1. mazeretsiz
    excuse_note: null,
    notified_at: null,
    notified_to: null,
    created_at: '2026-10-20T10:00:00Z',
  },
  {
    id: 'att-2',
    student_id: 's-ayse',
    absence_date: '2026-10-22',
    session_type: 'etut',
    status: 'gelmedi',
    excuse_type: 'yok', // 2. mazeretsiz -> TAKİP GEREKLİ!
    excuse_note: null,
    notified_at: null,
    notified_to: null,
    created_at: '2026-10-22T10:00:00Z',
  },
]

const summaryWithAttendance = buildHomeSummary({
  students: mockStudents,
  coachDecisions: [],
  mockExams: [],
  weeklyTasks: [],
  attendanceRecords: attendance,
  referenceDate: REF_DATE,
})

const ayseAttention = summaryWithAttendance.attention.find((a) => a.studentId === 's-ayse')
assert.ok(
  ayseAttention?.reasons.some((r) => r.kind === 'devamsizlik_takip'),
  'Ayşe için devamsizlik_takip nedeni bulunmalı'
)
console.log('✓ 2.C devamsizlik_takip nedeni doğrulandı.')

// D) program_dusuk ve program_yok testi
const thisWeekKey = '2026-10-19' // 2026-10-25 haftasının pazartesisi
const weeklyTasks: WeeklyTask[] = [
  // Ayşe için 4 görev: 1'i tamamlanmış (%25 < %50)
  {
    id: 't-1',
    student_id: 's-ayse',
    week_start: thisWeekKey,
    day_index: 0,
    topic_id: 1,
    custom_label: 'Matematik Çarpanlar',
    question_count: 30,
    is_exam: false,
    completed: true,
    created_at: '2026-10-19T08:00:00Z',
  },
  {
    id: 't-2',
    student_id: 's-ayse',
    week_start: thisWeekKey,
    day_index: 1,
    topic_id: 1,
    custom_label: 'Matematik Test 2',
    question_count: 30,
    is_exam: false,
    completed: false,
    created_at: '2026-10-19T08:00:00Z',
  },
  {
    id: 't-3',
    student_id: 's-ayse',
    week_start: thisWeekKey,
    day_index: 2,
    topic_id: 2,
    custom_label: 'Türkçe Paragraf',
    question_count: 20,
    is_exam: false,
    completed: false,
    created_at: '2026-10-19T08:00:00Z',
  },
  {
    id: 't-4',
    student_id: 's-ayse',
    week_start: thisWeekKey,
    day_index: 3,
    topic_id: 2,
    custom_label: 'Türkçe Deneme',
    question_count: 20,
    is_exam: false,
    completed: false,
    created_at: '2026-10-19T08:00:00Z',
  },
]

const summaryWithTasks = buildHomeSummary({
  students: mockStudents,
  coachDecisions: [],
  mockExams: [],
  weeklyTasks,
  attendanceRecords: [],
  referenceDate: REF_DATE,
  isWeekHalfway: true,
})

const ayseTaskAttention = summaryWithTasks.attention.find((a) => a.studentId === 's-ayse')
assert.ok(
  ayseTaskAttention?.reasons.some((r) => r.kind === 'program_dusuk'),
  'Ayşe için program_dusuk nedeni bulunmalı (%25)'
)

// Mehmet'in hiç görevi yok -> program_yok olmalı
const mehmetTaskAttention = summaryWithTasks.attention.find((a) => a.studentId === 's-mehmet')
assert.ok(
  mehmetTaskAttention?.reasons.some((r) => r.kind === 'program_yok'),
  'Mehmet için program_yok nedeni bulunmalı'
)
console.log('✓ 2.D program_dusuk ve program_yok nedenleri doğrulandı.')

// E) deneme_yok testi (son 21 günde hiç deneme yok)
// Mehmet'in hiç denemesi yok
assert.ok(
  mehmetTaskAttention?.reasons.some((r) => r.kind === 'deneme_yok'),
  'Mehmet için son 21 günde deneme_yok nedeni bulunmalı'
)
console.log('✓ 2.E deneme_yok nedeni doğrulandı.')

// ---------------------------------------------------------------------------
// 3. Sıralama Algoritması Testi
// ---------------------------------------------------------------------------
// Ayşe: devamsizlik_takip + program_dusuk + deneme_yok (3 neden)
// Ali: kritik_karar + net_dususu + tam görev (2 neden, kritik_karar ağırlıklı)
// Mehmet: program_yok + deneme_yok (2 neden, düşük ağırlıklı)

const aliCompleteTask: WeeklyTask = {
  id: 't-ali-1',
  student_id: 's-ali',
  week_start: thisWeekKey,
  day_index: 0,
  topic_id: 101,
  custom_label: 'Türev Tekrar',
  question_count: 50,
  is_exam: false,
  completed: true,
  created_at: '2026-10-19T08:00:00Z',
}

const combinedSummary = buildHomeSummary({
  students: mockStudents,
  coachDecisions: decisions, // Ali: kritik_karar
  mockExams, // Ali: net_dususu
  weeklyTasks: [...weeklyTasks, aliCompleteTask], // Ayşe: program_dusuk, Ali: tam program, Mehmet: program_yok
  attendanceRecords: attendance, // Ayşe: devamsizlik_takip
  referenceDate: REF_DATE,
  isWeekHalfway: true,
})

// Ayşe 3 nedene sahip olduğu için ilk sırada olmalı
assert.equal(
  combinedSummary.attention[0].studentId,
  's-ayse',
  'En çok nedene (3) sahip Ayşe 1. sırada olmalı'
)
// Ali 2 nedene sahip ama kritik_karar ağırlığı Mehmet'ten yüksek olduğu için 2. sırada olmalı
assert.equal(
  combinedSummary.attention[1].studentId,
  's-ali',
  'Kritik karar ağırlığına sahip Ali 2. sırada olmalı'
)
// Mehmet 3. sırada olmalı
assert.equal(
  combinedSummary.attention[2].studentId,
  's-mehmet',
  'Mehmet 3. sırada olmalı'
)
console.log('✓ 3. İlgi bekleyenler sıralama algoritması (neden sayısı + öncelik ağırlığı) doğrulandı.')

// ---------------------------------------------------------------------------
// 4. Denemeler Özeti Testi
// ---------------------------------------------------------------------------
assert.equal(
  combinedSummary.exams.last7DaysCount,
  1,
  'Son 7 günde (18-25 Ekim) girilen deneme sayısı 1 olmalı (24 Ekim denemesi)'
)
assert.equal(
  combinedSummary.exams.avgDelta,
  -7,
  'Ortalama net değişimi -7 net olmalı'
)
assert.equal(
  combinedSummary.exams.withoutTopicsCount,
  0,
  'Konusu girilmemiş deneme sayısı 0 olmalı'
)
console.log('✓ 4. Denemeler kartı özeti doğrulandı.')

// ---------------------------------------------------------------------------
// 5. Program Özeti Testi
// ---------------------------------------------------------------------------
assert.equal(combinedSummary.program.thisWeekTotalTasks, 5, 'Bu hafta 5 görev olmalı (Ayşe 4 + Ali 1)')
assert.equal(combinedSummary.program.thisWeekCompletedTasks, 2, 'Bu hafta 2 tamamlanan görev olmalı')
assert.equal(combinedSummary.program.completionRate, 40, 'Tamamlama oranı %40 olmalı (2/5)')
assert.equal(
  combinedSummary.program.studentsWithoutTasksCount,
  1,
  'Görevi olmayan aktif öğrenci sayısı 1 olmalı (yalnız Mehmet)'
)
console.log('✓ 5. Program kartı özeti doğrulandı.')

// ---------------------------------------------------------------------------
// 6. Devamsızlık Özeti Testi
// ---------------------------------------------------------------------------
assert.equal(
  combinedSummary.attendance.thisWeekAbsenceCount,
  2,
  'Bu haftaki devamsızlık 2 olmalı'
)
assert.equal(
  combinedSummary.attendance.needsAttentionCount,
  1,
  'Takip gereken öğrenci sayısı 1 olmalı (Ayşe)'
)
assert.equal(
  combinedSummary.attendance.whatsappPendingCount,
  2,
  'WhatsApp bildirimi gönderilmemiş kayıt sayısı 2 olmalı'
)
console.log('✓ 6. Devamsızlık kartı özeti doğrulandı.')

// ---------------------------------------------------------------------------
// 7. Son Hareketler Akışı (Recent Activity)
// ---------------------------------------------------------------------------
assert.ok(combinedSummary.recent.length <= 10, 'Son hareketler ≤ 10 olmalı')
assert.ok(combinedSummary.recent.length > 0, 'En az 1 hareket olmalı')
// Sıralama azalan tarih olmalı
for (let i = 0; i < combinedSummary.recent.length - 1; i++) {
  const t1 = new Date(combinedSummary.recent[i].at).getTime()
  const t2 = new Date(combinedSummary.recent[i + 1].at).getTime()
  assert.ok(t1 >= t2, 'Hareketler kronolojik olarak yeniden eskiye sıralı olmalı')
}
console.log('✓ 7. Son hareketler akışı (azalan kronolojik sıralı) doğrulandı.')

console.log('\n==============================================')
console.log('✅ TÜM G2 ÖZ-TESTLERİ BAŞARIYLA GEÇTİ!')
console.log('==============================================')
