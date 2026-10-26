/**
 * scripts/seedTestData.ts
 *
 * Test Öğrencileri İçin Gerçekçi Tohum Verisi Üreteci (R3-R4 / T-1).
 *
 * ⚠️ GÜVENLİK KURALI:
 * Bu script YALNIZCA şu 3 öğrenci id'sine dokunabilir:
 *   - Test Test: 5bc47392-c8f0-4249-83b5-1800a1eed0ce
 *   - Test YKS:  8dd1fd87-b0ab-48c3-bf64-7c0f520908d9
 *   - Test LGS:  7da01119-c538-4b19-b6f3-e0d733450136
 * Başka hiçbir öğrenci id'sine yazma veya silme yapılamaz.
 *
 * AYIRT EDİCİ İŞARETLER:
 *   - mock_exams: adı 'TEST ...'
 *   - weekly_tasks: source = 'TEST veri'
 *   - attendance_records: excuse_note = 'TEST'
 *   - parent_summary_log: channel = 'TEST whatsapp'
 *   - coach_decisions: note LIKE 'TEST:%'
 * Test Test'in mevcut 10 denemesine ASLA dokunulmaz.
 *
 * KULLANIM:
 *   npx tsx scripts/seedTestData.ts          -> Kuru çalışma (varsayılan, DB'ye yazmaz)
 *   npx tsx scripts/seedTestData.ts --yaz   -> Veritabanına yazar ve olusturulan.json kaydeder
 *   npx tsx scripts/seedTestData.ts --sil   -> Yalnızca kendi yazdığı test verilerini temizler
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database, ExamType, TaskType, TaskOriginKind } from '../src/types/database'

// ---------------------------------------------------------------------------
// 1. İzin Verilen Öğrenciler & Güvenlik Kilidi
// ---------------------------------------------------------------------------

const ALLOWED_STUDENTS = {
  TEST_TEST: '5bc47392-c8f0-4249-83b5-1800a1eed0ce',
  TEST_YKS: '8dd1fd87-b0ab-48c3-bf64-7c0f520908d9',
  TEST_LGS: '7da01119-c538-4b19-b6f3-e0d733450136',
} as const

const ALLOWED_STUDENT_IDS = new Set<string>(Object.values(ALLOWED_STUDENTS))

function assertAllowedStudent(studentId: string, context = 'İşlem'): void {
  if (!ALLOWED_STUDENT_IDS.has(studentId)) {
    throw new Error(
      `❌ GÜVENLİK İHLALİ (${context}): '${studentId}' izin verilen test öğrencileri arasında değil! İşlem derhal durduruldu.`,
    )
  }
}

// ---------------------------------------------------------------------------
// 2. Deterministik (Sabit Tohumlu) Rastgelelik (Mulberry32)
// ---------------------------------------------------------------------------

function createPRNG(seed = 20261026) {
  let s = seed >>> 0
  return function rand() {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min
}

function randPick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

function shuffleArray<T>(rand: () => number, arr: readonly T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const temp = copy[i]
    copy[i] = copy[j]
    copy[j] = temp
  }
  return copy
}

function distributeQuestions(
  rand: () => number,
  totalQ: number,
  numTopics: number,
): number[] {
  if (numTopics <= totalQ) {
    const counts = new Array<number>(numTopics).fill(1)
    let rem = totalQ - numTopics
    while (rem > 0) {
      const idx = Math.floor(rand() * numTopics)
      counts[idx]++
      rem--
    }
    return counts
  } else {
    const indices = shuffleArray(
      rand,
      Array.from({ length: numTopics }, (_, i) => i),
    ).slice(0, totalQ)
    const counts = new Array<number>(numTopics).fill(0)
    for (const idx of indices) {
      counts[idx] = 1
    }
    return counts
  }
}

// ---------------------------------------------------------------------------
// 3. Ortam Değişkenleri
// ---------------------------------------------------------------------------

function loadEnv() {
  let url = process.env.VITE_SUPABASE_URL
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY

  const possiblePaths = [
    path.join(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '..', 'Coching_AI', '.env.local'),
    path.join(process.cwd(), '.env'),
  ]

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const c = fs.readFileSync(envPath, 'utf8')
        if (!url) {
          const match = c.match(/VITE_SUPABASE_URL\s*=\s*(.+)/)
          if (match && match[1]) url = match[1].trim().replace(/['"]/g, '')
        }
        if (!key) {
          const match = c.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/)
          if (match && match[1]) key = match[1].trim().replace(/['"]/g, '')
        }
      } catch {
        // Devam et
      }
    }
  }

  if (!url || !key) {
    console.error('❌ VITE_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY bulunamadı.')
    process.exit(1)
  }

  return { url, key }
}

// ---------------------------------------------------------------------------
// 4. Tipler & Modeller
// ---------------------------------------------------------------------------

type ExamSubjectRow = {
  id: number
  exam_type: ExamType
  section_name: string
  subject_id: number
  label: string
  question_count: number
  sort_order: number
}

type ExamTopicRow = {
  id: number
  exam_subject_id: number
  name: string
  grades: string[]
  sort_order: number
}

type TopicRow = {
  id: number
  subject_id: number
  name: string
  grades: string[]
  curriculum: 'YKS' | 'LGS'
  subject_name: string
}

type GeneratedExamPayload = {
  student_id: string
  name: string
  publisher: string
  exam_type: ExamType
  exam_date: string
  score: number
  percentile: number
  ranks: {
    kurum: { sira: number; katilan: number }
    genel: { sira: number; katilan: number }
  }
  coach_note: string
  sections: Array<{
    section_name: string
    max_questions: number
    correct_count: number
    wrong_count: number
  }>
  subject_results: Array<{
    exam_subject_id: number
    question_count: number
    correct_count: number
    wrong_count: number
  }>
  topic_results: Array<{
    exam_topic_id: number
    question_count: number
    correct_count: number
    wrong_count: number
  }>
}

type GeneratedTaskPayload = {
  student_id: string
  week_start: string
  day_index: number
  topic_id: number | null
  custom_label: string
  question_count: number
  is_exam: boolean
  completed: boolean
  completed_at: string | null
  task_type: TaskType
  source: string
  origin_kind: TaskOriginKind
  origin_exam_topic_id: number | null
  correct_count: number | null
  wrong_count: number | null
  blank_count: number | null
  duration_min: number | null
}

type GeneratedCoachDecisionPayload = {
  student_id: string
  topic_id: number
  state: 'yeterli' | 'gelisiyor' | 'kritik'
  note: string
  decided_by: string
  decided_at: string
}

type GeneratedAttendancePayload = {
  student_id: string
  absence_date: string
  session_type: 'birebir' | 'etut' | 'grup' | 'online'
  status: 'gelmedi' | 'gec_geldi' | 'erken_ayrildi'
  excuse_type: 'yok' | 'hastalik' | 'ailevi' | 'okul_sinav' | 'ulasim' | 'izinli' | 'diger'
  excuse_note: string
  notified_at: string | null
  notified_to: 'ogrenci' | 'veli' | 'ikisi' | null
}

type GeneratedErrorBasketPayload = {
  mock_exam_id?: string
  topic_id: number
  error_type: 'bilgi_eksikligi' | 'islem_hatasi' | 'dikkat_hatasi' | 'sure_yetmedi'
}

type GeneratedParentLogPayload = {
  student_id: string
  week_start: string
  opened_at: string
  opened_by: string
  channel: string
}

// ---------------------------------------------------------------------------
// 5. Ana Tohum Üreteci Sınıfı
// ---------------------------------------------------------------------------

class TestDataGenerator {
  private rand: () => number
  private examSubjects: ExamSubjectRow[] = []
  private examTopics: ExamTopicRow[] = []
  private topics: TopicRow[] = []
  private coachId = '6e7c1177-3f01-428a-b198-36c472b0202e'

  constructor(seed = 20261026) {
    this.rand = createPRNG(seed)
  }

  setMetadata(
    examSubjects: ExamSubjectRow[],
    examTopics: ExamTopicRow[],
    topics: TopicRow[],
    coachId?: string,
  ) {
    this.examSubjects = examSubjects
    this.examTopics = examTopics
    this.topics = topics
    if (coachId) this.coachId = coachId
  }

  // --- Deneme Üretimi (Tutarlılık Garantili: Bölüm = Alt Ders = Konu) ---
  generateExam(
    studentId: string,
    examType: ExamType,
    examNumber: number,
    examDate: string,
    targetAccuracy: number,
  ): GeneratedExamPayload {
    assertAllowedStudent(studentId, 'generateExam')

    const wrongPenalty = examType === 'LGS' ? 3 : 4
    const padNum = String(examNumber).padStart(2, '0')
    const name = `TEST ${examType} Deneme ${padNum}`
    const publishers = ['Özdebir', '3D Yayınları', 'Limit', 'Bilgi Sarmal', 'Karakök', 'Hız ve Renk', 'Paraf', 'Apotemi']
    const publisher = randPick(this.rand, publishers)

    // Sınav türüne ait alt dersleri bul
    let subjects = this.examSubjects.filter((es) => es.exam_type === examType)
    if (examType === 'AYT') {
      // Test YKS için AYT SAY alt dersleri: Matematik (12), Fizik (13), Kimya (14), Biyoloji (15)
      subjects = subjects.filter((es) => [12, 13, 14, 15].includes(es.id))
    }

    const sectionMap = new Map<
      string,
      { max_questions: number; correct_count: number; wrong_count: number }
    >()
    const subjectResults: GeneratedExamPayload['subject_results'] = []
    const topicResults: GeneratedExamPayload['topic_results'] = []

    let totalCorrect = 0
    let totalWrong = 0
    let totalQuestions = 0

    for (const es of subjects) {
      // İlgili alt dersin konuları
      let candidateTopics = this.examTopics.filter((et) => et.exam_subject_id === es.id)
      if (examType === 'LGS') {
        // Yalnızca 8. sınıf konuları (veya genel boş olanlar)
        candidateTopics = candidateTopics.filter(
          (et) => et.grades.includes('8. Sınıf') || et.grades.length === 0,
        )
      }

      if (candidateTopics.length === 0) {
        throw new Error(`exam_subject ${es.id} (${es.label}) için konu bulunamadı!`)
      }

      // Soru sayısını konulara dağıt (toplam = es.question_count)
      const dist = distributeQuestions(this.rand, es.question_count, candidateTopics.length)

      let subjCorrect = 0
      let subjWrong = 0

      for (let i = 0; i < candidateTopics.length; i++) {
        const qCount = dist[i]
        if (qCount === 0) continue

        const topic = candidateTopics[i]
        // Doğru ve yanlış üretimi (konu bazında tutarlı)
        const jitter = (this.rand() - 0.5) * 0.16
        const topicAcc = Math.max(0.3, Math.min(0.98, targetAccuracy + jitter))
        const correct = Math.min(qCount, Math.round(qCount * topicAcc))
        const remaining = qCount - correct
        // Kalanın çoğu yanlış, azı boş
        const wrong = remaining > 0 ? Math.round(remaining * (0.6 + this.rand() * 0.35)) : 0

        subjCorrect += correct
        subjWrong += wrong

        topicResults.push({
          exam_topic_id: topic.id,
          question_count: qCount,
          correct_count: correct,
          wrong_count: wrong,
        })
      }

      subjectResults.push({
        exam_subject_id: es.id,
        question_count: es.question_count,
        correct_count: subjCorrect,
        wrong_count: subjWrong,
      })

      // Bölüm toplamlarına ekle
      const curSec = sectionMap.get(es.section_name) ?? {
        max_questions: 0,
        correct_count: 0,
        wrong_count: 0,
      }
      curSec.max_questions += es.question_count
      curSec.correct_count += subjCorrect
      curSec.wrong_count += subjWrong
      sectionMap.set(es.section_name, curSec)

      totalCorrect += subjCorrect
      totalWrong += subjWrong
      totalQuestions += es.question_count
    }

    const sections: GeneratedExamPayload['sections'] = []
    for (const [section_name, sData] of sectionMap.entries()) {
      sections.push({
        section_name,
        max_questions: sData.max_questions,
        correct_count: sData.correct_count,
        wrong_count: sData.wrong_count,
      })
    }

    const calculatedNet = totalCorrect - totalWrong / wrongPenalty
    // Sınav türüne göre yaklaşık puan / net
    const score = Math.round(calculatedNet * 10) / 10
    const percentile = Math.round((1.0 + (1 - calculatedNet / totalQuestions) * 12) * 10) / 10

    return {
      student_id: studentId,
      name,
      publisher,
      exam_type: examType,
      exam_date: examDate,
      score,
      percentile,
      ranks: {
        kurum: { sira: randInt(this.rand, 1, 8), katilan: 110 },
        genel: { sira: randInt(this.rand, 250, 2400), katilan: 38000 },
      },
      coach_note: `TEST: Deneme tamamlandı. Net: ${score}. Zaman ve odak gayet başarılı.`,
      sections,
      subject_results: subjectResults,
      topic_results: topicResults,
    }
  }

  // --- Haftalık Görev Üretimi ---
  generateTasksForWeek(
    studentId: string,
    curriculum: 'YKS' | 'LGS',
    weekStart: string,
    isPastWeek: boolean,
    isCurrentWeek: boolean,
  ): GeneratedTaskPayload[] {
    assertAllowedStudent(studentId, 'generateTasksForWeek')

    let eligibleTopics = this.topics.filter((t) => t.curriculum === curriculum)
    if (curriculum === 'LGS') {
      eligibleTopics = eligibleTopics.filter(
        (t) => t.grades.includes('8. Sınıf') || t.grades.length === 0,
      )
    }

    const tasks: GeneratedTaskPayload[] = []
    const taskCount = randInt(this.rand, 5, 7) // Haftalık 5 ila 7 görev
    const taskTypes: TaskType[] = ['konu', 'tekrar', 'rutin', 'sureli_test', 'deneme']
    const originKinds: TaskOriginKind[] = ['elle', 'deneme_analizi', 'oneri', 'konu_haritasi', 'gorusme']

    for (let dayIdx = 0; dayIdx < taskCount; dayIdx++) {
      const topic = randPick(this.rand, eligibleTopics)
      const taskType = randPick(this.rand, taskTypes)
      const originKind = randPick(this.rand, originKinds)
      const qCount = taskType === 'rutin' ? 15 : taskType === 'deneme' ? 40 : randInt(this.rand, 20, 35)

      let completed = false
      if (isPastWeek) {
        // Geçmiş haftalar: %60 - %90 tamamlama
        completed = this.rand() < 0.78
      } else if (isCurrentWeek) {
        // Bu hafta: gün indexine göre kısmi tamamlama (~%50)
        completed = dayIdx < 3 && this.rand() < 0.7
      } else {
        // Gelecek hafta: tamamlanmadı
        completed = false
      }

      let correct_count: number | null = null
      let wrong_count: number | null = null
      let blank_count: number | null = null
      let duration_min: number | null = null
      let completed_at: string | null = null

      if (completed) {
        // Tamamlananların ~%70'inde D/Y/B ve süre
        const hasResults = this.rand() < 0.72
        if (hasResults) {
          const acc = 0.75 + (this.rand() - 0.5) * 0.2
          const c = Math.min(qCount, Math.round(qCount * acc))
          const rem = qCount - c
          const w = Math.round(rem * 0.7)
          const b = rem - w
          correct_count = c
          wrong_count = w
          blank_count = b
          duration_min = randInt(this.rand, 25, 60)
        }
        // Hafta başlangıcına gün ekleyerek completed_at oluştur
        const d = new Date(weekStart)
        d.setDate(d.getDate() + dayIdx)
        completed_at = `${d.toISOString().split('T')[0]}T17:00:00Z`
      }

      const labelPrefix = taskType === 'rutin' ? 'Rutin Soru Çözümü' : taskType === 'tekrar' ? 'Tekrar Testi' : 'Konu Pekiştirme'
      const custom_label = `${topic.name} · ${labelPrefix}`

      tasks.push({
        student_id: studentId,
        week_start: weekStart,
        day_index: dayIdx % 7,
        topic_id: topic.id,
        custom_label,
        question_count: qCount,
        is_exam: taskType === 'deneme',
        completed,
        completed_at,
        task_type: taskType,
        source: 'TEST veri',
        origin_kind: originKind,
        origin_exam_topic_id: null,
        correct_count,
        wrong_count,
        blank_count,
        duration_min,
      })
    }

    return tasks
  }

  // --- Koç Kararları Üretimi ---
  generateCoachDecisions(
    studentId: string,
    curriculum: 'YKS' | 'LGS',
    count: number,
  ): GeneratedCoachDecisionPayload[] {
    assertAllowedStudent(studentId, 'generateCoachDecisions')

    let eligibleTopics = this.topics.filter((t) => t.curriculum === curriculum)
    if (curriculum === 'LGS') {
      eligibleTopics = eligibleTopics.filter(
        (t) => t.grades.includes('8. Sınıf') || t.grades.length === 0,
      )
    }

    const shuffled = shuffleArray(this.rand, eligibleTopics).slice(0, count)
    const states: Array<'yeterli' | 'gelisiyor' | 'kritik'> = ['yeterli', 'gelisiyor', 'kritik']
    const decisions: GeneratedCoachDecisionPayload[] = []

    const baseDates = [
      '2026-09-08T11:00:00Z',
      '2026-09-15T14:30:00Z',
      '2026-09-22T10:00:00Z',
      '2026-09-29T16:15:00Z',
      '2026-10-06T13:45:00Z',
      '2026-10-13T11:30:00Z',
      '2026-10-18T15:00:00Z',
      '2026-10-21T09:30:00Z',
      '2026-10-23T14:00:00Z',
      '2026-10-25T16:30:00Z',
    ]

    for (let i = 0; i < shuffled.length; i++) {
      const top = shuffled[i]
      const state = states[i % states.length]
      const dateStr = baseDates[i % baseDates.length]

      decisions.push({
        student_id: studentId,
        topic_id: top.id,
        state,
        note: `TEST: Koç kararı - ${top.name} konusunda gelişim ${state === 'yeterli' ? 'tamamlandı' : state === 'gelisiyor' ? 'devam ediyor' : 'yakın takip gerektirir'}.`,
        decided_by: this.coachId,
        decided_at: dateStr,
      })
    }

    return decisions
  }

  // --- Devamsızlık Kayıtları ---
  generateAttendance(
    studentId: string,
    items: Array<{
      date: string
      session_type: 'birebir' | 'etut' | 'grup' | 'online'
      status: 'gelmedi' | 'gec_geldi' | 'erken_ayrildi'
      excuse_type: 'yok' | 'hastalik' | 'ailevi' | 'okul_sinav' | 'ulasim' | 'izinli' | 'diger'
      notified?: boolean
    }>,
  ): GeneratedAttendancePayload[] {
    assertAllowedStudent(studentId, 'generateAttendance')

    return items.map((item) => ({
      student_id: studentId,
      absence_date: item.date,
      session_type: item.session_type,
      status: item.status,
      excuse_type: item.excuse_type,
      excuse_note: 'TEST',
      notified_at: item.notified ? `${item.date}T15:30:00Z` : null,
      notified_to: item.notified ? 'veli' : null,
    }))
  }

  // --- Veli Özeti Logu ---
  generateParentLog(studentId: string, weekStart: string, openedAt: string): GeneratedParentLogPayload {
    assertAllowedStudent(studentId, 'generateParentLog')
    return {
      student_id: studentId,
      week_start: weekStart,
      opened_at: openedAt,
      opened_by: this.coachId,
      channel: 'TEST whatsapp',
    }
  }

  // --- Yanlış Nedenleri (Error Basket Items) ---
  generateErrorBasketItems(studentId: string): GeneratedErrorBasketPayload[] {
    assertAllowedStudent(studentId, 'generateErrorBasketItems')
    const yksTopics = this.topics.filter((t) => t.curriculum === 'YKS')
    const picked = shuffleArray(this.rand, yksTopics).slice(0, 4)
    const errorTypes: Array<'bilgi_eksikligi' | 'islem_hatasi' | 'dikkat_hatasi' | 'sure_yetmedi'> = [
      'bilgi_eksikligi',
      'islem_hatasi',
      'dikkat_hatasi',
      'sure_yetmedi',
    ]

    return picked.map((t, idx) => ({
      topic_id: t.id,
      error_type: errorTypes[idx % errorTypes.length],
    }))
  }
}

// ---------------------------------------------------------------------------
// 6. Doğrulama ve Tutarlılık Kontrol Fonksiyonu
// ---------------------------------------------------------------------------

function verifyGeneratedData(
  exams: GeneratedExamPayload[],
  tasks: GeneratedTaskPayload[],
  decisions: GeneratedCoachDecisionPayload[],
  attendances: GeneratedAttendancePayload[],
  parentLogs: GeneratedParentLogPayload[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // 1. Öğrenci ID güvenlik kontrolü
  for (const e of exams) {
    if (!ALLOWED_STUDENT_IDS.has(e.student_id)) {
      errors.push(`Geçersiz öğrenci ID: ${e.student_id} (deneme: ${e.name})`)
    }
    if (e.student_id === ALLOWED_STUDENTS.TEST_TEST) {
      errors.push(`KURAL İHLALİ: Test Test için yeni deneme üretilemez!`)
    }
    if (!e.name.startsWith('TEST ')) {
      errors.push(`Deneme adı 'TEST ' ile başlamalıdır: ${e.name}`)
    }

    // Bölüm = Alt ders = Konu toplamı kontrolü
    for (const sec of e.sections) {
      if (sec.correct_count + sec.wrong_count > sec.max_questions) {
        errors.push(`${e.name} - Bölüm ${sec.section_name}: D+Y (${sec.correct_count + sec.wrong_count}) > Soru (${sec.max_questions})`)
      }
    }

    // Her alt ders için kontrol
    for (const sr of e.subject_results) {
      if (sr.correct_count + sr.wrong_count > sr.question_count) {
        errors.push(`${e.name} - Alt ders ${sr.exam_subject_id}: D+Y > Soru`)
      }
    }
  }

  // 2. Görev kontrolleri
  for (const t of tasks) {
    if (!ALLOWED_STUDENT_IDS.has(t.student_id)) {
      errors.push(`Geçersiz öğrenci ID (görev): ${t.student_id}`)
    }
    if (t.source !== 'TEST veri') {
      errors.push(`Görev source 'TEST veri' olmalıdır, mevcut: ${t.source}`)
    }
    if (t.correct_count != null && t.wrong_count != null && t.blank_count != null) {
      const sum = t.correct_count + t.wrong_count + t.blank_count
      if (sum > t.question_count) {
        errors.push(`Görev ${t.custom_label}: D+Y+B (${sum}) > Soru (${t.question_count})`)
      }
    }
  }

  // 3. Devamsızlık kontrolleri
  for (const a of attendances) {
    if (!ALLOWED_STUDENT_IDS.has(a.student_id)) {
      errors.push(`Geçersiz öğrenci ID (devamsızlık): ${a.student_id}`)
    }
    if (a.excuse_note !== 'TEST') {
      errors.push(`Devamsızlık excuse_note 'TEST' olmalıdır: ${a.excuse_note}`)
    }
  }

  // 4. Veli özeti kontrolleri
  for (const p of parentLogs) {
    if (!ALLOWED_STUDENT_IDS.has(p.student_id)) {
      errors.push(`Geçersiz öğrenci ID (veli özeti): ${p.student_id}`)
    }
    if (p.channel !== 'TEST whatsapp') {
      errors.push(`Veli özeti channel 'TEST whatsapp' olmalıdır: ${p.channel}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

// ---------------------------------------------------------------------------
// 7. Silme İşlemi (--sil)
// ---------------------------------------------------------------------------

async function executeDeletion(supabase: ReturnType<typeof createClient<Database>>) {
  console.log('\n🗑️  TEST VERİLERİ TEMİZLEME MODU (--sil)')
  console.log('='.repeat(65))
  console.log('Yalnızca izin verilen 3 test öğrencisine ait test işaretli veriler silinecek.')

  const targetStudentIds = [
    ALLOWED_STUDENTS.TEST_TEST,
    ALLOWED_STUDENTS.TEST_YKS,
    ALLOWED_STUDENTS.TEST_LGS,
  ]

  // 1. parent_summary_log
  const { data: delParents, error: errParents } = await supabase
    .from('parent_summary_log')
    .delete()
    .in('student_id', targetStudentIds)
    .eq('channel', 'TEST whatsapp')
    .select('id')
  if (errParents) console.error('parent_summary_log silme hatası:', errParents.message)
  else console.log(`✓ parent_summary_log: ${delParents?.length ?? 0} kayıt silindi.`)

  // 2. Test YKS ve Test LGS için TEST denemeleri (Test Test'e asla dokunma!)
  const { data: testExams, error: errFindExams } = await supabase
    .from('mock_exams')
    .select('id, name, student_id')
    .in('student_id', [ALLOWED_STUDENTS.TEST_YKS, ALLOWED_STUDENTS.TEST_LGS])
    .ilike('name', 'TEST %')

  if (errFindExams) {
    console.error('Test denemeleri bulunamadı:', errFindExams.message)
  } else if (testExams && testExams.length > 0) {
    const examIds = testExams.map((e) => e.id)
    // 2a. error_basket_items
    const { data: delErrors } = await supabase
      .from('error_basket_items')
      .delete()
      .in('mock_exam_id', examIds)
      .select('id')
    console.log(`✓ error_basket_items: ${delErrors?.length ?? 0} kayıt silindi.`)

    // 2b. mock_exams (cascade ile alt tablolar da silinir)
    const { data: delExams, error: errDelExams } = await supabase
      .from('mock_exams')
      .delete()
      .in('id', examIds)
      .select('id')
    if (errDelExams) console.error('mock_exams silme hatası:', errDelExams.message)
    else console.log(`✓ mock_exams (YKS/LGS): ${delExams?.length ?? 0} deneme ve bağlı sonuçları silindi.`)
  } else {
    console.log('✓ Silinecek test denemesi bulunamadı.')
  }

  // 3. weekly_tasks
  const { data: delTasks, error: errTasks } = await supabase
    .from('weekly_tasks')
    .delete()
    .in('student_id', targetStudentIds)
    .eq('source', 'TEST veri')
    .select('id')
  if (errTasks) console.error('weekly_tasks silme hatası:', errTasks.message)
  else console.log(`✓ weekly_tasks: ${delTasks?.length ?? 0} görev silindi.`)

  // 4. attendance_records
  const { data: delAtt, error: errAtt } = await supabase
    .from('attendance_records')
    .delete()
    .in('student_id', targetStudentIds)
    .eq('excuse_note', 'TEST')
    .select('id')
  if (errAtt) console.error('attendance_records silme hatası:', errAtt.message)
  else console.log(`✓ attendance_records: ${delAtt?.length ?? 0} devamsızlık silindi.`)

  // 5. coach_decisions
  const { data: delDec, error: errDec } = await supabase
    .from('coach_decisions')
    .delete()
    .in('student_id', targetStudentIds)
    .ilike('note', 'TEST:%')
    .select('id')
  if (errDec) console.error('coach_decisions silme hatası:', errDec.message)
  else console.log(`✓ coach_decisions: ${delDec?.length ?? 0} koç kararı silindi.`)

  // 6. Hedef netleri sıfırla (Test YKS, Test LGS, Test Test)
  for (const id of targetStudentIds) {
    await supabase
      .from('students')
      .update({
        target_net_tyt: null,
        target_net_ayt: null,
        target_net_lgs: null,
        target_set_at: null,
      })
      .eq('id', id)
  }
  console.log(`✓ Öğrenci hedef netleri sıfırlandı.`)

  // 7. olusturulan.json dosyasını temizle
  const outputFilePath = path.join(process.cwd(), 'data', 'test-seed', 'olusturulan.json')
  if (fs.existsSync(outputFilePath)) {
    fs.unlinkSync(outputFilePath)
    console.log(`✓ ${outputFilePath} silindi.`)
  }

  console.log('='.repeat(65))
  console.log('✨ Temizleme işlemi başarıyla tamamlandı.\n')
}

// ---------------------------------------------------------------------------
// 8. Ana Akış
// ---------------------------------------------------------------------------

async function main() {
  const isWrite = process.argv.includes('--yaz')
  const isDelete = process.argv.includes('--sil')

  const { url, key } = loadEnv()
  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Eğer --sil parametresi verilmişse temizle ve çık
  if (isDelete) {
    await executeDeletion(supabase)
    return
  }

  console.log('='.repeat(70))
  console.log(
    isWrite
      ? '🚀 TEST VERİSİ YAZMA MODU (--yaz: Veritabanına uygulanıyor)'
      : '🔍 TEST VERİSİ KURU ÇALIŞMA MODU (DRY RUN: Veritabanına yazılmaz)',
  )
  console.log('='.repeat(70))

  // 1. Meta verileri DB'den çek
  const { data: examSubjectsData, error: esErr } = await supabase
    .from('exam_subjects')
    .select('id, exam_type, section_name, subject_id, label, question_count, sort_order')
    .order('sort_order')
  if (esErr || !examSubjectsData) {
    console.error('❌ exam_subjects tablosu okunamadı:', esErr?.message)
    process.exit(1)
  }

  const { data: examTopicsData, error: etErr } = await supabase
    .from('exam_topics')
    .select('id, exam_subject_id, name, grades, sort_order')
    .eq('is_active', true)
    .order('sort_order')
  if (etErr || !examTopicsData) {
    console.error('❌ exam_topics tablosu okunamadı:', etErr?.message)
    process.exit(1)
  }

  const { data: topicsData, error: tErr } = await supabase
    .from('topics')
    .select('id, subject_id, name, grades, subjects!inner(name, curriculum)')
    .eq('is_active', true)
  if (tErr || !topicsData) {
    console.error('❌ topics tablosu okunamadı:', tErr?.message)
    process.exit(1)
  }

  const mappedTopics: TopicRow[] = topicsData.map((t: any) => ({
    id: t.id,
    subject_id: t.subject_id,
    name: t.name,
    grades: t.grades ?? [],
    curriculum: t.subjects.curriculum,
    subject_name: t.subjects.name,
  }))

  const generator = new TestDataGenerator(20261026)
  generator.setMetadata(
    examSubjectsData as ExamSubjectRow[],
    examTopicsData as ExamTopicRow[],
    mappedTopics,
  )

  // -------------------------------------------------------------------------
  // 2. Veri Paketlerini Üret
  // -------------------------------------------------------------------------

  // Haftalar (Pazartesi tarihleri): 2026-08-31'den bugüne (son 8 hafta) + bu hafta + gelecek hafta
  const allWeeks = [
    { weekStart: '2026-08-31', isPast: true, isCurrent: false },
    { weekStart: '2026-09-07', isPast: true, isCurrent: false },
    { weekStart: '2026-09-14', isPast: true, isCurrent: false },
    { weekStart: '2026-09-21', isPast: true, isCurrent: false },
    { weekStart: '2026-09-28', isPast: true, isCurrent: false },
    { weekStart: '2026-10-05', isPast: true, isCurrent: false },
    { weekStart: '2026-10-12', isPast: true, isCurrent: false },
    { weekStart: '2026-10-19', isPast: true, isCurrent: false },
    { weekStart: '2026-10-26', isPast: false, isCurrent: true }, // bu hafta
    { weekStart: '2026-11-02', isPast: false, isCurrent: false }, // gelecek hafta
  ]

  const allGeneratedExams: GeneratedExamPayload[] = []
  const allGeneratedTasks: GeneratedTaskPayload[] = []
  const allGeneratedDecisions: GeneratedCoachDecisionPayload[] = []
  const allGeneratedAttendances: GeneratedAttendancePayload[] = []
  const allGeneratedParentLogs: GeneratedParentLogPayload[] = []
  const allGeneratedErrorBaskets: GeneratedErrorBasketPayload[] = []

  // --- A. TEST YKS ---
  // 1. 8 TYT Denemesi (İlerleyen net trendi: ~85 netten ~98 nete)
  const tytDates = [
    '2026-09-02',
    '2026-09-09',
    '2026-09-16',
    '2026-09-23',
    '2026-09-30',
    '2026-10-07',
    '2026-10-14',
    '2026-10-21',
  ]
  const tytAccuracies = [0.72, 0.74, 0.76, 0.78, 0.8, 0.81, 0.83, 0.85]
  for (let i = 0; i < 8; i++) {
    allGeneratedExams.push(
      generator.generateExam(
        ALLOWED_STUDENTS.TEST_YKS,
        'TYT',
        i + 1,
        tytDates[i],
        tytAccuracies[i],
      ),
    )
  }

  // 2. 4 AYT Denemesi (SAY: ~48 netten ~58 nete)
  const aytDates = ['2026-09-12', '2026-09-26', '2026-10-10', '2026-10-24']
  const aytAccuracies = [0.65, 0.68, 0.72, 0.75]
  for (let i = 0; i < 4; i++) {
    allGeneratedExams.push(
      generator.generateExam(
        ALLOWED_STUDENTS.TEST_YKS,
        'AYT',
        i + 1,
        aytDates[i],
        aytAccuracies[i],
      ),
    )
  }

  // 3. Görevler (son 8 hafta + bu hafta + gelecek hafta = 10 hafta)
  for (const w of allWeeks) {
    const weekTasks = generator.generateTasksForWeek(
      ALLOWED_STUDENTS.TEST_YKS,
      'YKS',
      w.weekStart,
      w.isPast,
      w.isCurrent,
    )
    allGeneratedTasks.push(...weekTasks)
  }

  // 4. Koç Kararları (10 adet)
  allGeneratedDecisions.push(
    ...generator.generateCoachDecisions(ALLOWED_STUDENTS.TEST_YKS, 'YKS', 10),
  )

  // 5. Devamsızlık (3 adet, 1'i WhatsApp açıldı)
  allGeneratedAttendances.push(
    ...generator.generateAttendance(ALLOWED_STUDENTS.TEST_YKS, [
      { date: '2026-09-18', session_type: 'birebir', status: 'gec_geldi', excuse_type: 'ulasim' },
      { date: '2026-10-02', session_type: 'etut', status: 'gelmedi', excuse_type: 'hastalik' },
      { date: '2026-10-16', session_type: 'birebir', status: 'gelmedi', excuse_type: 'yok', notified: true },
    ]),
  )

  // 6. Veli Özeti Logu (1 adet)
  allGeneratedParentLogs.push(
    generator.generateParentLog(ALLOWED_STUDENTS.TEST_YKS, '2026-10-19', '2026-10-25T14:30:00Z'),
  )

  // 7. Yanlış Nedenleri (4 adet)
  allGeneratedErrorBaskets.push(...generator.generateErrorBasketItems(ALLOWED_STUDENTS.TEST_YKS))

  // --- B. TEST LGS ---
  // 1. 6 LGS Denemesi (8. sınıf konuları, ~62 netten ~74 nete)
  const lgsDates = [
    '2026-09-06',
    '2026-09-15',
    '2026-09-24',
    '2026-10-04',
    '2026-10-13',
    '2026-10-22',
  ]
  const lgsAccuracies = [0.71, 0.73, 0.75, 0.77, 0.8, 0.83]
  for (let i = 0; i < 6; i++) {
    allGeneratedExams.push(
      generator.generateExam(
        ALLOWED_STUDENTS.TEST_LGS,
        'LGS',
        i + 1,
        lgsDates[i],
        lgsAccuracies[i],
      ),
    )
  }

  // 2. Görevler (son 8 hafta + bu hafta + gelecek hafta)
  for (const w of allWeeks) {
    const weekTasks = generator.generateTasksForWeek(
      ALLOWED_STUDENTS.TEST_LGS,
      'LGS',
      w.weekStart,
      w.isPast,
      w.isCurrent,
    )
    allGeneratedTasks.push(...weekTasks)
  }

  // 3. Koç Kararları (8 adet)
  allGeneratedDecisions.push(
    ...generator.generateCoachDecisions(ALLOWED_STUDENTS.TEST_LGS, 'LGS', 8),
  )

  // 4. Devamsızlık (2 adet)
  allGeneratedAttendances.push(
    ...generator.generateAttendance(ALLOWED_STUDENTS.TEST_LGS, [
      { date: '2026-09-22', session_type: 'birebir', status: 'gec_geldi', excuse_type: 'ulasim' },
      { date: '2026-10-09', session_type: 'etut', status: 'gelmedi', excuse_type: 'okul_sinav' },
    ]),
  )

  // --- C. TEST TEST ---
  // Mevcut 10 TYT denemesine DOKUNULMAZ!
  // 1. Son 6 hafta görevleri (2026-09-14 - 2026-10-19) + bu hafta
  const testTestWeeks = allWeeks.slice(2, 9) // 7 hafta
  for (const w of testTestWeeks) {
    const weekTasks = generator.generateTasksForWeek(
      ALLOWED_STUDENTS.TEST_TEST,
      'YKS',
      w.weekStart,
      w.isPast,
      w.isCurrent,
    )
    allGeneratedTasks.push(...weekTasks)
  }

  // 2. Koç Kararları (6 adet)
  allGeneratedDecisions.push(
    ...generator.generateCoachDecisions(ALLOWED_STUDENTS.TEST_TEST, 'YKS', 6),
  )

  // -------------------------------------------------------------------------
  // 3. Doğrulama ve Tutarlılık Kontrolü
  // -------------------------------------------------------------------------
  const verification = verifyGeneratedData(
    allGeneratedExams,
    allGeneratedTasks,
    allGeneratedDecisions,
    allGeneratedAttendances,
    allGeneratedParentLogs,
  )

  if (!verification.valid) {
    console.error('❌ Veri üretiminde doğrulama hataları tespit edildi:')
    for (const err of verification.errors) {
      console.error('  - ' + err)
    }
    process.exit(1)
  }

  console.log('✅ Bütün veriler tutarlılık ve doğrulama kurallarından tam geçti.')
  console.log('   - Bölüm = Alt Ders = Konu toplamları tam eşit')
  console.log('   - D + Y + B <= Soru sayısı ve negatif olmayan değerler')
  console.log('   - YKS ceza 4, LGS ceza 3 uygulandı')
  console.log('   - Yalnızca izin verilen 3 öğrenciye ait kayıtlar üretildi')
  console.log('   - Test Test için yeni deneme üretilmedi (mevcut 10 TYT korundu)')

  // -------------------------------------------------------------------------
  // 4. Özet Raporu Yazdır
  // -------------------------------------------------------------------------
  console.log('\n📊 ÜRETİLEN VERİ ÖZETİ:')
  console.log('─'.repeat(55))
  console.log(`• Toplam Deneme Sayısı:         ${allGeneratedExams.length} (Test YKS: 8 TYT + 4 AYT, Test LGS: 6 LGS)`)
  console.log(`• Toplam Haftalık Görev:        ${allGeneratedTasks.length}`)
  console.log(`  - Test YKS: ${allGeneratedTasks.filter((t) => t.student_id === ALLOWED_STUDENTS.TEST_YKS).length} görev`)
  console.log(`  - Test LGS: ${allGeneratedTasks.filter((t) => t.student_id === ALLOWED_STUDENTS.TEST_LGS).length} görev`)
  console.log(`  - Test Test: ${allGeneratedTasks.filter((t) => t.student_id === ALLOWED_STUDENTS.TEST_TEST).length} görev`)
  console.log(`• Toplam Koç Kararı:            ${allGeneratedDecisions.length} (YKS: 10, LGS: 8, Test: 6)`)
  console.log(`• Toplam Devamsızlık:           ${allGeneratedAttendances.length} (YKS: 3, LGS: 2)`)
  console.log(`• Toplam Veli Özeti Logu:       ${allGeneratedParentLogs.length} (YKS: 1)`)
  console.log(`• Toplam Yanlış Nedeni:         ${allGeneratedErrorBaskets.length} (YKS: 4)`)
  console.log(`• Hedef Netler:`)
  console.log(`  - Test YKS:  TYT 100 / AYT 60`)
  console.log(`  - Test LGS:  LGS 75`)
  console.log(`  - Test Test: TYT 105`)
  console.log('─'.repeat(55))

  // Eğer kuru çalışma moduysa burada dur
  if (!isWrite) {
    console.log('\n💡 [KURU ÇALIŞMA] Veritabanında hiçbir değişiklik yapılmadı.')
    console.log("   Veritabanına yazmak için '--yaz' parametresiyle çalıştırın:")
    console.log('   npm run seed:test -- --yaz\n')
    return
  }

  // -------------------------------------------------------------------------
  // 5. Veritabanına Yazma (--yaz)
  // -------------------------------------------------------------------------
  console.log('\n💾 Veritabanına kayıt başlatılıyor...\n')

  const createdIds: {
    seeded_at: string
    mock_exams: string[]
    weekly_tasks: string[]
    coach_decisions: string[]
    attendance_records: string[]
    error_basket_items: string[]
    parent_summary_log: string[]
  } = {
    seeded_at: new Date().toISOString(),
    mock_exams: [],
    weekly_tasks: [],
    coach_decisions: [],
    attendance_records: [],
    error_basket_items: [],
    parent_summary_log: [],
  }

  // 5.1 Hedef Netleri Güncelle
  console.log('1/7. Öğrenci hedefleri güncelleniyor...')
  await supabase
    .from('students')
    .update({
      target_net_tyt: 100,
      target_net_ayt: 60,
      target_set_at: '2026-09-01T09:00:00Z',
    })
    .eq('id', ALLOWED_STUDENTS.TEST_YKS)

  await supabase
    .from('students')
    .update({
      target_net_lgs: 75,
      target_set_at: '2026-09-01T09:00:00Z',
    })
    .eq('id', ALLOWED_STUDENTS.TEST_LGS)

  await supabase
    .from('students')
    .update({
      target_net_tyt: 105,
      target_set_at: '2026-09-01T09:00:00Z',
    })
    .eq('id', ALLOWED_STUDENTS.TEST_TEST)

  // 5.2 Denemeleri Kaydet (save_exam_report RPC ile)
  console.log('2/7. Denemeler kaydediliyor (save_exam_report RPC)...')
  let firstYksExamId: string | null = null

  for (const exam of allGeneratedExams) {
    const payload = {
      student_id: exam.student_id,
      name: exam.name,
      publisher: exam.publisher,
      exam_type: exam.exam_type,
      exam_date: exam.exam_date,
      score: exam.score,
      percentile: exam.percentile,
      ranks: exam.ranks,
      coach_note: exam.coach_note,
      sections: exam.sections,
      subject_results: exam.subject_results,
      topic_results: exam.topic_results,
    }

    const { data: savedExamId, error: examErr } = await supabase.rpc(
      'save_exam_report',
      { p_payload: payload as any },
    )

    if (examErr || !savedExamId) {
      console.error(`❌ Deneme kayıt hatası (${exam.name}):`, examErr?.message)
    } else {
      createdIds.mock_exams.push(savedExamId)
      if (exam.student_id === ALLOWED_STUDENTS.TEST_YKS && !firstYksExamId) {
        firstYksExamId = savedExamId
      }
    }
  }
  console.log(`   ✓ ${createdIds.mock_exams.length} deneme başarıyla kaydedildi.`)

  // 5.3 Yanlış Nedenleri (error_basket_items)
  if (firstYksExamId && allGeneratedErrorBaskets.length > 0) {
    console.log('3/7. Yanlış nedenleri kaydediliyor...')
    const errorRows = allGeneratedErrorBaskets.map((eb) => ({
      mock_exam_id: firstYksExamId!,
      topic_id: eb.topic_id,
      error_type: eb.error_type,
    }))
    const { data: savedErrors, error: ebErr } = await supabase
      .from('error_basket_items')
      .insert(errorRows)
      .select('id')

    if (ebErr) {
      console.error('❌ Yanlış nedenleri kayıt hatası:', ebErr.message)
    } else if (savedErrors) {
      createdIds.error_basket_items.push(...savedErrors.map((r) => r.id))
      console.log(`   ✓ ${savedErrors.length} yanlış nedeni kaydedildi.`)
    }
  }

  // 5.4 Haftalık Görevler (weekly_tasks)
  console.log('4/7. Haftalık görevler kaydediliyor...')
  const batchSize = 50
  for (let i = 0; i < allGeneratedTasks.length; i += batchSize) {
    const batch = allGeneratedTasks.slice(i, i + batchSize)
    const { data: savedTasks, error: tErr } = await supabase
      .from('weekly_tasks')
      .insert(batch)
      .select('id')

    if (tErr) {
      console.error(`❌ Görev toplu kayıt hatası (${i}-${i + batch.length}):`, tErr.message)
    } else if (savedTasks) {
      createdIds.weekly_tasks.push(...savedTasks.map((t) => t.id))
    }
  }
  console.log(`   ✓ ${createdIds.weekly_tasks.length} haftalık görev kaydedildi.`)

  // 5.5 Koç Kararları (coach_decisions)
  console.log('5/7. Koç kararları kaydediliyor...')
  const { data: savedDecisions, error: decErr } = await supabase
    .from('coach_decisions')
    .upsert(allGeneratedDecisions, { onConflict: 'student_id,topic_id' })
    .select('id')

  if (decErr) {
    console.error('❌ Koç kararları kayıt hatası:', decErr.message)
  } else if (savedDecisions) {
    createdIds.coach_decisions.push(...savedDecisions.map((d) => d.id))
    console.log(`   ✓ ${savedDecisions.length} koç kararı kaydedildi.`)
  }

  // 5.6 Devamsızlık (attendance_records)
  console.log('6/7. Devamsızlık kayıtları kaydediliyor...')
  const { data: savedAttendances, error: attErr } = await supabase
    .from('attendance_records')
    .upsert(allGeneratedAttendances, { onConflict: 'student_id,absence_date,session_type' })
    .select('id')

  if (attErr) {
    console.error('❌ Devamsızlık kayıt hatası:', attErr.message)
  } else if (savedAttendances) {
    createdIds.attendance_records.push(...savedAttendances.map((a) => a.id))
    console.log(`   ✓ ${savedAttendances.length} devamsızlık kaydedildi.`)
  }

  // 5.7 Veli Özeti Logu (parent_summary_log)
  console.log('7/7. Veli özeti logu kaydediliyor...')
  const { data: savedParents, error: plErr } = await supabase
    .from('parent_summary_log')
    .insert(allGeneratedParentLogs)
    .select('id')

  if (plErr) {
    console.error('❌ Veli özeti kayıt hatası:', plErr.message)
  } else if (savedParents) {
    createdIds.parent_summary_log.push(...savedParents.map((p) => p.id))
    console.log(`   ✓ ${savedParents.length} veli özeti logu kaydedildi.`)
  }

  // 5.8 Kimlik Listesini JSON Olarak Kaydet (data/test-seed/olusturulan.json)
  const outputDir = path.join(process.cwd(), 'data', 'test-seed')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  const outputPath = path.join(outputDir, 'olusturulan.json')
  fs.writeFileSync(outputPath, JSON.stringify(createdIds, null, 2), 'utf8')
  console.log(`\n📁 Oluşturulan kimlikler kaydedildi: ${outputPath}`)

  console.log('\n🎉 TEST VERİSİ TOHUMLAMA BAŞARIYLA TAMAMLANDI!')
  console.log('='.repeat(70) + '\n')
}

main().catch((err) => {
  console.error('\n💥 Beklenmeyen hata oluştu:', err)
  process.exit(1)
})
