/**
 * scripts/homeSummary.selftest.ts
 *
 * G2 + G2b — Ana Sayfa Veri Katmanı Öz-Testi (Saf Assert, Supabase Bağımsız).
 *
 * Doğrulananlar:
 * 1. Öğrenci Dağılımı: YKS / LGS ayrımı, aktif sayısı ve bu ay yeni kayıt (newThisMonth).
 * 2. İlgi Bekleyen Öğrenciler (Attention Reasons) ve Yapılandırılmış `detail` Alanları:
 *    - 'kritik_karar': { count, topicNames: string[] }
 *    - 'net_dususu': { prev, last, delta, examType }
 *    - 'devamsizlik_takip': { last14Count, notOpened: boolean }
 *    - 'program_dusuk': { pct }
 *    - 'program_yok': detail null
 *    - 'deneme_yok': { daysSinceLast: number | null }
 *    - Satırda grade ve track alanlarının varlığı.
 * 3. Öncelik Sıralaması: Neden sayısı çok olan önce, ardından ağırlık sırası.
 * 4. Denemeler Özeti:
 *    - Son 7 gün sayısı, ortalama net değişimi (avgDelta), konusu girilmemiş sayaç.
 *    - Son 8 hafta TYT haftalık ortalama net dizisi (`weeklyAvgNet`, sparkline için).
 *    - Son 5 deneme listesi (`recent`, delta ve konu bilgisiyle).
 * 5. Program Özeti:
 *    - Toplam/tamamlanan görev, genel %, görevi olmayan öğrenci sayısı.
 *    - Günlük dağılım (`byDay`, 7 gün).
 *    - Bugüne kadarki oran (`toDate`, bugünün dayIndex'ine kadar).
 *    - Geçen haftanın aynı gününe kadarki karşılaştırma oranı (`lastWeekSameDayPct`).
 * 6. Devamsızlık Özeti:
 *    - Bu haftaki devamsızlıklar, gün dağılımı (`byDay`, 7 gün).
 *    - Takip gereken öğrenci sayısı.
 *    - Son 14 günde bildirimi açılmamış kayıt sayısı (`notifyNotOpenedCount`).
 * 7. Raporlar Özeti:
 *    - Kritik konu sayısı, kritik kararı olan öğrenci sayısı, en çok zorlanılan konu (`topTopic`), ders dağılımı (`bySubject`).
 * 8. Son Hareketler Akışı:
 *    - Görev olayları çıkarıldı; deneme, devamsızlık ve koç kararları (`decision`) eklendi.
 *    - Azalan kronolojik sıralı (max 10).
 *
 * Çalıştırma: npm run test:home-summary
 */

import assert from 'node:assert/strict'
import {
  buildHomeSummary,
  chunkArray,
  formatNetTr,
  getIsoDayIndex,
  type EnrichedMockExam,
  type SubjectInfo,
  type TopicInfo,
} from '../src/lib/homeSummaryCore'
import type {
  AttendanceRecord,
  CoachDecision,
  Student,
  WeeklyTask,
} from '../src/types/database'

console.log('▶ G2 + G2b Ana Sayfa Veri Katmanı Öz-Testi Başlatılıyor...\n')

// Sabit referans tarihi: 22 Ekim 2026 Perşembe (hafta yarılanmış, dayIndex = 3)
const REF_DATE = '2026-10-22T12:00:00Z'
const THIS_WEEK_MON = '2026-10-19'
const LAST_WEEK_MON = '2026-10-12'

// ---------------------------------------------------------------------------
// Mock Referans Verileri (Dersler ve Konular)
// ---------------------------------------------------------------------------

const mockSubjects: SubjectInfo[] = [
  { id: 1, name: 'Matematik' },
  { id: 2, name: 'Türkçe' },
]

const mockTopics: TopicInfo[] = [
  { id: 101, name: 'Türev', subject_id: 1 },
  { id: 102, name: 'İntegral', subject_id: 1 },
  { id: 201, name: 'Paragraf', subject_id: 2 },
]

// ---------------------------------------------------------------------------
// Mock Öğrenciler
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
    created_at: '2026-10-05T09:00:00Z', // Bu ay yeni kayıt (newThisMonth)
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
    created_at: '2026-07-15T09:00:00Z',
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
    is_active: false, // Pasif
    created_at: '2026-10-02T09:00:00Z',
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
assert.equal(baseSummary.students.yksCount, 2, 'YKS öğrencisi 2 olmalı')
assert.equal(baseSummary.students.lgsCount, 1, 'LGS öğrencisi 1 olmalı')
assert.equal(baseSummary.students.newThisMonth, 1, 'Bu ay kayıtlı aktif öğrenci 1 olmalı (Ali, 2026-10-05)')
console.log('✓ 1. Öğrenci dağılımı ve newThisMonth başarıyla doğrulandı.')

// ---------------------------------------------------------------------------
// 2. İlgi Bekleyen Öğrenciler ve Yapılandırılmış Detaylar
// ---------------------------------------------------------------------------

const decisions: CoachDecision[] = [
  {
    id: 'cd-1',
    student_id: 's-ali',
    topic_id: 101, // Türev
    state: 'kritik',
    note: 'Türevde ciddi eksik',
    decided_by: 'coach-1',
    decided_at: '2026-10-21T10:00:00Z',
  },
  {
    id: 'cd-2',
    student_id: 's-mehmet',
    topic_id: 101, // Türev
    state: 'kritik',
    note: 'Temel kavramlar',
    decided_by: 'coach-1',
    decided_at: '2026-10-20T10:00:00Z',
  },
]

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
    topicResultsCount: 40,
  },
  // Ali: TYT Deneme 2 (2026-10-21) -> 73 net (7 net düşüş)
  {
    id: 'e-ali-2',
    student_id: 's-ali',
    name: 'TYT Deneme 2',
    publisher: 'Test Yayını',
    exam_type: 'TYT',
    exam_date: '2026-10-21',
    score: null,
    percentile: null,
    ranks: null,
    coach_note: null,
    created_at: '2026-10-21T12:00:00Z',
    totalNet: 73,
    sectionsList: [{ id: 'sec-2', mock_exam_id: 'e-ali-2', section_name: 'Türkçe', max_questions: 40, correct_count: 33, wrong_count: 0, blank_count: 7, wrong_penalty: 4, net: 33 }],
    hasTopics: true,
    topicResultsCount: 40,
  },
]

const attendance: AttendanceRecord[] = [
  {
    id: 'att-1',
    student_id: 's-ayse',
    absence_date: '2026-10-19', // Pazartesi
    session_type: 'birebir',
    status: 'gelmedi',
    excuse_type: 'yok',
    excuse_note: null,
    notified_at: null, // Açılmadı
    notified_to: null,
    created_at: '2026-10-19T10:00:00Z',
  },
  {
    id: 'att-2',
    student_id: 's-ayse',
    absence_date: '2026-10-21', // Çarşamba
    session_type: 'etut',
    status: 'gelmedi',
    excuse_type: 'yok', // 2. mazeretsiz -> TAKİP GEREKLİ!
    excuse_note: null,
    notified_at: null, // Açılmadı
    notified_to: null,
    created_at: '2026-10-21T10:00:00Z',
  },
]

const thisWeekTasks: WeeklyTask[] = [
  // Ayşe için 4 görev: 1'i tamamlanmış (%25 < %50)
  {
    id: 't-1',
    student_id: 's-ayse',
    week_start: THIS_WEEK_MON,
    day_index: 0, // Pzt
    topic_id: 101,
    custom_label: 'Matematik 1',
    question_count: 30,
    is_exam: false,
    completed: true,
    created_at: '2026-10-19T08:00:00Z',
  },
  {
    id: 't-2',
    student_id: 's-ayse',
    week_start: THIS_WEEK_MON,
    day_index: 1, // Salı
    topic_id: 101,
    custom_label: 'Matematik 2',
    question_count: 30,
    is_exam: false,
    completed: false,
    created_at: '2026-10-19T08:00:00Z',
  },
  {
    id: 't-3',
    student_id: 's-ayse',
    week_start: THIS_WEEK_MON,
    day_index: 2, // Çarşamba
    topic_id: 201,
    custom_label: 'Paragraf',
    question_count: 20,
    is_exam: false,
    completed: false,
    created_at: '2026-10-19T08:00:00Z',
  },
  {
    id: 't-4',
    student_id: 's-ayse',
    week_start: THIS_WEEK_MON,
    day_index: 3, // Perşembe
    topic_id: 201,
    custom_label: 'Paragraf 2',
    question_count: 20,
    is_exam: false,
    completed: false,
    created_at: '2026-10-19T08:00:00Z',
  },
  // Ali için bu hafta 1 görev (tamamlanmış)
  {
    id: 't-ali-1',
    student_id: 's-ali',
    week_start: THIS_WEEK_MON,
    day_index: 0,
    topic_id: 101,
    custom_label: 'Türev Soru Çözümü',
    question_count: 50,
    is_exam: false,
    completed: true,
    created_at: '2026-10-19T08:00:00Z',
  },
]

// Geçen hafta görevleri (Ali için 2'de 2 tamamlanmış = %100)
const lastWeekTasks: WeeklyTask[] = [
  {
    id: 't-lw-1',
    student_id: 's-ali',
    week_start: LAST_WEEK_MON,
    day_index: 0,
    topic_id: 101,
    custom_label: 'Limit 1',
    question_count: 40,
    is_exam: false,
    completed: true,
    created_at: '2026-10-12T08:00:00Z',
  },
  {
    id: 't-lw-2',
    student_id: 's-ali',
    week_start: LAST_WEEK_MON,
    day_index: 2,
    topic_id: 101,
    custom_label: 'Limit 2',
    question_count: 40,
    is_exam: false,
    completed: true,
    created_at: '2026-10-12T08:00:00Z',
  },
]

const summary = buildHomeSummary({
  students: mockStudents,
  coachDecisions: decisions,
  mockExams,
  weeklyTasks: thisWeekTasks,
  lastWeekTasks,
  attendanceRecords: attendance,
  topics: mockTopics,
  subjects: mockSubjects,
  referenceDate: REF_DATE,
})

// A) Attention ve Yapılandırılmış Detail Testleri
const aliAtt = summary.attention.find((a) => a.studentId === 's-ali')
assert.ok(aliAtt, 'Ali ilgi listesinde olmalı')
assert.equal(aliAtt.grade, '12. Sınıf', 'Öğrenci sınıfı bulunmalı')
assert.equal(aliAtt.track, 'SAY', 'Öğrenci alanı bulunmalı')

// Kritik karar detail: { count, topicNames: ['Türev'] }
const kritikR = aliAtt.reasons.find((r) => r.kind === 'kritik_karar')
assert.ok(kritikR, 'Kritik karar nedeni bulunmalı')
const kritikDetail = kritikR.detail as { count: number; topicNames: string[] }
assert.equal(kritikDetail.count, 1)
assert.deepEqual(kritikDetail.topicNames, ['Türev'])

// Net düşüşü detail: { prev: 80, last: 73, delta: -7, examType: 'TYT' }
const netR = aliAtt.reasons.find((r) => r.kind === 'net_dususu')
assert.ok(netR, 'Net düşüşü nedeni bulunmalı')
const netDetail = netR.detail as { prev: number; last: number; delta: number; examType: string }
assert.equal(netDetail.prev, 80)
assert.equal(netDetail.last, 73)
assert.equal(netDetail.delta, -7)
assert.equal(netDetail.examType, 'TYT')

// Ayşe Devamsızlık detail: { last14Count: 2, notOpened: true }
const ayseAtt = summary.attention.find((a) => a.studentId === 's-ayse')
assert.ok(ayseAtt, 'Ayşe ilgi listesinde olmalı')
const devR = ayseAtt.reasons.find((r) => r.kind === 'devamsizlik_takip')
assert.ok(devR, 'Devamsızlık nedeni bulunmalı')
const devDetail = devR.detail as { last14Count: number; notOpened: boolean }
assert.equal(devDetail.last14Count, 2)
assert.equal(devDetail.notOpened, true)

// Ayşe Program Düşük detail: { pct: 25 }
const progR = ayseAtt.reasons.find((r) => r.kind === 'program_dusuk')
assert.ok(progR, 'Program düşük nedeni bulunmalı')
const progDetail = progR.detail as { pct: number }
assert.equal(progDetail.pct, 25)

// Mehmet Program Yok ve Deneme Yok detail
const mehmetAtt = summary.attention.find((a) => a.studentId === 's-mehmet')
assert.ok(mehmetAtt, 'Mehmet ilgi listesinde olmalı')
assert.ok(mehmetAtt.reasons.some((r) => r.kind === 'program_yok'), 'Mehmet için program_yok olmalı')
const denemeYokR = mehmetAtt.reasons.find((r) => r.kind === 'deneme_yok')
assert.ok(denemeYokR, 'Mehmet için deneme_yok olmalı')
const denemeYokDetail = denemeYokR.detail as { daysSinceLast: number | null }
assert.equal(denemeYokDetail.daysSinceLast, null, 'Hiç denemesi olmayanın daysSinceLast null olmalı')

console.log('✓ 2. Attention yapılandırılmış detaylar (G2b e) başarıyla doğrulandı.')

// ---------------------------------------------------------------------------
// 3. Denemeler Özeti (weeklyAvgNet ve recent)
// ---------------------------------------------------------------------------
assert.equal(summary.exams.last7DaysCount, 1, 'Son 7 günde 1 deneme (21 Ekim)')
assert.equal(summary.exams.avgDelta, -7)
assert.equal(summary.exams.weeklyAvgNet.length, 8, 'Son 8 haftanın TYT ortalama dizisi üretilmeli')
// 19 Ekim haftasında 1 TYT denemesi var (73 net), ortalama 73 olmalı
const currentWeekTyt = summary.exams.weeklyAvgNet[7]
assert.equal(currentWeekTyt.weekStart, THIS_WEEK_MON)
assert.equal(currentWeekTyt.avg, 73)

// Recent exams
assert.ok(summary.exams.recent.length <= 5, 'Recent denemeler en fazla 5 olmalı')
assert.equal(summary.exams.recent[0].totalNet, 73)
assert.equal(summary.exams.recent[0].delta, -7)
console.log('✓ 3. Denemeler weeklyAvgNet ve recent (G2b g) başarıyla doğrulandı.')

// ---------------------------------------------------------------------------
// 4. Program Özeti (byDay, toDate, lastWeekSameDayPct)
// ---------------------------------------------------------------------------
assert.equal(summary.program.byDay.length, 7, 'Haftanın 7 günü için byDay dizisi olmalı')
assert.equal(summary.program.byDay[0].planned, 2, 'Pazartesi 2 görev planlanmış (Ayşe + Ali)')
assert.equal(summary.program.byDay[0].done, 2, 'Pazartesi 2 görev tamamlanmış')
assert.equal(summary.program.byDay[1].planned, 1, 'Salı 1 görev')

// toDate: Perşembe gününe kadar (dayIndex <= 3): toplam 5 görev, 2 tamamlanan = %40
assert.equal(summary.program.toDate.planned, 5)
assert.equal(summary.program.toDate.done, 2)
assert.equal(summary.program.toDate.pct, 40)

// lastWeekSameDayPct: geçen hafta perşembeye kadar 2 görev vardı, 2'si tamamlandı = %100
assert.equal(summary.program.lastWeekSameDayPct, 100)
console.log('✓ 4. Program byDay, toDate ve lastWeekSameDayPct (G2b f) başarıyla doğrulandı.')

// ---------------------------------------------------------------------------
// 5. Devamsızlık Özeti (notifyNotOpenedCount, byDay)
// ---------------------------------------------------------------------------
assert.equal(summary.attendance.thisWeekAbsenceCount, 2)
assert.equal(summary.attendance.notifyNotOpenedCount, 2, 'Son 14 günde açılmamış 2 kayıt olmalı')
assert.equal(summary.attendance.byDay.length, 7)
assert.equal(summary.attendance.byDay[0], 1, 'Pazartesi günü 1 devamsızlık')
assert.equal(summary.attendance.byDay[2], 1, 'Çarşamba günü 1 devamsızlık')
console.log('✓ 5. Devamsızlık notifyNotOpenedCount ve byDay (G2b b/i) başarıyla doğrulandı.')

// ---------------------------------------------------------------------------
// 6. Raporlar Özeti (HomeReportsSummary)
// ---------------------------------------------------------------------------
assert.equal(summary.reports.criticalTopicCount, 1, '1 kritik konu var (Türev)')
assert.equal(summary.reports.studentsWithCritical, 2, '2 öğrencinin kritik kararı var (Ali ve Mehmet)')
assert.ok(summary.reports.topTopic, 'Top topic bulunmalı')
assert.equal(summary.reports.topTopic.name, 'Türev')
assert.equal(summary.reports.topTopic.studentCount, 2)
assert.equal(summary.reports.bySubject[0].subjectName, 'Matematik')
assert.equal(summary.reports.bySubject[0].count, 2)
console.log('✓ 6. Raporlar özeti (G2b j) başarıyla doğrulandı.')

// ---------------------------------------------------------------------------
// 7. Son Hareketler Akışı (Recent Activity)
// ---------------------------------------------------------------------------
assert.ok(summary.recent.length <= 10)
// Görev olayı bulunmamalı
assert.ok(
  summary.recent.every((r) => r.kind !== ('task' as any)),
  'Görev olayları akışta bulunmamalı (G2b c)'
)
// Karar olayı bulunmalı
assert.ok(
  summary.recent.some((r) => r.kind === 'decision' && r.text.includes('Türev → kritik')),
  'Koç kararı akışta bulunmalı (G2b c)'
)
// Deneme olayı Türkçe formatlı (virgüllü, 2 ondalık basamak) olmalı
assert.equal(formatNetTr(92.5), '92,50', 'formatNetTr(92.5) Türkçe biçimde 92,50 dönmeli')
const examAct = summary.recent.find((r) => r.kind === 'exam')
assert.ok(examAct, 'Deneme aktivitesi akışta bulunmalı')
assert.ok(
  examAct.text.includes('73,00 net'),
  `Deneme aktivitesi Türkçe net formatı ("73,00 net") içermeli, gelen: "${examAct.text}"`
)
console.log('✓ 7. Son hareketler akışı (görev hariç, karar dahil, Türkçe net formatlı) başarıyla doğrulandı.')

// ---------------------------------------------------------------------------
// 8. İlave Uç Durumlar ve Detaylı Doğrulamalar (G4 İncelemesi)
// ---------------------------------------------------------------------------

// A. Attention Sıralaması:
// Mehmet: 3 neden (kritik_karar [5], program_yok [1], deneme_yok [1]) -> 3 neden, maxWeight 5 -> 1. sıra
// Ayşe: 3 neden (devamsizlik_takip [3], program_dusuk [2], deneme_yok [1]) -> 3 neden, maxWeight 3 -> 2. sıra
// Ali: 2 neden (kritik_karar [5], net_dususu [4]) -> 2 neden -> 3. sıra
assert.equal(summary.attention.length, 3, 'Tam 3 öğrenci ilgi bekliyor olmalı')
assert.equal(summary.attention[0].studentId, 's-mehmet', 'İlk sırada 3 nedeni ve maxWeight 5 olan Mehmet olmalı')
assert.equal(summary.attention[0].reasons.length, 3)
assert.equal(summary.attention[1].studentId, 's-ayse', 'İkinci sırada 3 nedeni ve maxWeight 3 olan Ayşe olmalı')
assert.equal(summary.attention[1].reasons.length, 3)
assert.equal(summary.attention[2].studentId, 's-ali', 'Üçüncü sırada 2 nedeni olan Ali olmalı')
assert.equal(summary.attention[2].reasons.length, 2)

// B. 21 günden eski deneme için daysSinceLast hesaplaması
const oldExamStudent: Student = {
  id: 's-old-exam',
  institution_id: 'inst-1',
  full_name: 'Eski Sınavlı Öğrenci',
  grade: '12. Sınıf',
  track: 'SAY',
  school_name: null,
  target_field: null,
  notes: null,
  phone_number: null,
  parent_phone_number: null,
  is_active: true,
  created_at: '2026-08-01T09:00:00Z',
  access_code: null,
  coaching_coach_id: null,
  photo_url: null,
}

// 2026-10-22'den tam 30 gün önce: 2026-09-22
const oldExam: EnrichedMockExam = {
  id: 'e-old-1',
  student_id: 's-old-exam',
  name: 'Eski Deneme',
  publisher: null,
  exam_type: 'TYT',
  exam_date: '2026-09-22',
  score: null,
  percentile: null,
  ranks: null,
  coach_note: null,
  created_at: '2026-09-22T10:00:00Z',
  totalNet: 65,
  sectionsList: [],
  hasTopics: false,
  topicResultsCount: 0,
}

const oldExamSummary = buildHomeSummary({
  students: [oldExamStudent],
  coachDecisions: [],
  mockExams: [oldExam],
  weeklyTasks: [
    {
      id: 't-dummy',
      student_id: 's-old-exam',
      subject_id: 1,
      topic_id: 101,
      task_type: 'soru',
      title: 'Görev',
      question_count: 50,
      completed: true,
      day_index: 0,
      week_key: THIS_WEEK_MON,
      institution_id: 'inst-1',
      created_at: '2026-10-19T08:00:00Z',
      is_exam: false,
    },
  ],
  attendanceRecords: [],
  referenceDate: REF_DATE,
})

const oldAtt = oldExamSummary.attention.find((a) => a.studentId === 's-old-exam')
assert.ok(oldAtt, 'Eski denemeli öğrenci ilgi listesinde olmalı')
const oldDenemeYok = oldAtt.reasons.find((r) => r.kind === 'deneme_yok')
assert.ok(oldDenemeYok, 'Eski denemeli öğrenci deneme_yok nedeni almalı')
const oldDetail = oldDenemeYok.detail as { daysSinceLast: number | null }
assert.equal(oldDetail.daysSinceLast, 30, '30 gün önceki deneme için daysSinceLast 30 olmalı')

// C. Boş girdi koruması (sıfır kayıtlı durumlar için güvenli varsayılanlar)
const emptySummary = buildHomeSummary({
  students: [],
  coachDecisions: [],
  mockExams: [],
  weeklyTasks: [],
  attendanceRecords: [],
  referenceDate: REF_DATE,
})
assert.equal(emptySummary.students.totalActive, 0)
assert.equal(emptySummary.students.newThisMonth, 0)
assert.equal(emptySummary.attention.length, 0)
assert.equal(emptySummary.program.completionRate, null, 'Görev planlanmamışsa completionRate null olmalı')
assert.equal(emptySummary.program.toDate.pct, 0)
assert.equal(emptySummary.exams.avgDelta, null)
assert.equal(emptySummary.reports.criticalTopicCount, 0)
assert.equal(emptySummary.reports.topTopic, null)

// D. chunkArray fonksiyonu doğrulaması
const sampleList = [1, 2, 3, 4, 5, 6, 7]
const chunks = chunkArray(sampleList, 3)
assert.deepEqual(chunks, [[1, 2, 3], [4, 5, 6], [7]], 'chunkArray 3 elemanlık alt parçalara bölmeli')

// E. getIsoDayIndex yerel gün testi (00:00-03:00 UTC sınır kayması kontrolü)
const mondayEarlyLocal = new Date(2026, 9, 19, 1, 30, 0) // Pazartesi 01:30
assert.equal(getIsoDayIndex(mondayEarlyLocal), 0, 'Pazartesi 01:30 yerel saatte 0 (Pazartesi) olmalı')
assert.equal(getIsoDayIndex('2026-10-19'), 0, '2026-10-19 ISO dizesi yerel öğlen çözülüp 0 (Pazartesi) olmalı')
assert.equal(getIsoDayIndex('2026-10-25'), 6, '2026-10-25 Pazar dizesi 6 (Pazar) olmalı')

console.log('✓ 8. İlave uç durumlar, attention sıralaması, chunkArray ve getIsoDayIndex başarıyla doğrulandı.')

console.log('\n==============================================')
console.log('✅ TÜM G2 + G2b ÖZ-TESTLERİ BAŞARIYLA GEÇTİ!')
console.log('==============================================')
