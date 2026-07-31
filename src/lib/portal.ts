import { supabase } from './supabase'
import type { Database, Grade, Json, Track } from '../types/database'

/**
 * Mobil portal (öğrenci/veli) veri katmanı.
 *
 * Öğrenci ve veli giriş yapmış bir Supabase kullanıcısı DEĞİL — ellerindeki erişim
 * kodu bir bearer token gibi çalışıyor. Bu yüzden tablolara doğrudan sorgu ATILMAZ:
 * anon rolünün students/weekly_tasks/mock_exams/attendance_records üzerinde hiçbir
 * yetkisi yok. Tüm okuma/yazma, kodu sunucuda doğrulayan SECURITY DEFINER
 * fonksiyonları üzerinden gider (bkz. supabase/schema.sql "Mobil Portal veri katmanı").
 */

export type PortalRole = 'ogrenci' | 'veli'

export type PortalStudent = {
  id: string
  full_name: string
  grade: Grade
  track: Track
  target_program: string | null
  target_ranking: string | null
  photo_url: string | null
}

export type PortalTask = {
  id: string
  day_index: number
  week_start: string
  question_count: number
  is_exam: boolean
  completed: boolean
  label: string
  subject_name: string | null
}

export type PortalExamSection = {
  section_name: string
  max_questions: number
  correct_count: number
  wrong_count: number
  blank_count: number
  net: number
}

export type PortalExam = {
  id: string
  name: string
  publisher: string | null
  exam_type: 'TYT' | 'AYT'
  exam_date: string
  total_net: number
  sections: PortalExamSection[]
}

export type PortalAttendance = {
  id: string
  absence_date: string
  session_type: string
  status: string
  excuse_type: string
  excuse_note: string | null
}

export type PortalDashboard = {
  role: PortalRole
  student: PortalStudent
  week_start: string | null
  is_current_week: boolean
  tasks: PortalTask[]
  exams: PortalExam[]
  attendance: PortalAttendance[]
}

type RpcEnvelope = { ok: boolean; error?: string } & Record<string, unknown>

const GENERIC_ERROR = 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.'

type PortalFunctions = Database['public']['Functions']

/** RPC çağrısını tek yerde çalıştırır; ağ hatasını da { ok:false } zarfına indirger. */
async function callRpc<K extends keyof PortalFunctions>(
  fn: K,
  args: PortalFunctions[K]['Args']
): Promise<RpcEnvelope> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    console.error(`portal rpc ${String(fn)}:`, error.message)
    return { ok: false, error: GENERIC_ERROR }
  }
  // Generic K yüzünden postgrest-js dönüş tipini çıkaramıyor; zarf biçimini
  // fonksiyonların kendisi garanti ediyor (schema.sql: hepsi json_build_object('ok', ...)).
  const envelope = data as unknown as RpcEnvelope | null
  if (!envelope) return { ok: false, error: GENERIC_ERROR }
  return envelope
}

export function normalizeAccessCode(code: string): string {
  return code.trim().toUpperCase()
}

/** Erişim kodunu doğrular; geçerliyse öğrenciyi ve rolü döndürür. */
export async function portalLogin(code: string): Promise<
  { ok: true; role: PortalRole; student: PortalStudent } | { ok: false; error: string }
> {
  const clean = normalizeAccessCode(code)
  if (!clean) return { ok: false, error: 'Lütfen erişim kodunu gir.' }

  const res = await callRpc('portal_login', { p_code: clean })
  if (!res.ok) return { ok: false, error: res.error ?? 'Geçersiz erişim kodu.' }
  return {
    ok: true,
    role: res.role as PortalRole,
    student: res.student as PortalStudent,
  }
}

/** Portalın tüm okuma ihtiyacı tek çağrıda: öğrenci + görevler + denemeler + devamsızlık. */
export async function portalDashboard(
  code: string
): Promise<{ ok: true; data: PortalDashboard } | { ok: false; error: string }> {
  const res = await callRpc('portal_dashboard', { p_code: normalizeAccessCode(code) })
  if (!res.ok) return { ok: false, error: res.error ?? 'Veriler yüklenemedi.' }
  return {
    ok: true,
    data: {
      role: res.role as PortalRole,
      student: res.student as PortalStudent,
      week_start: (res.week_start as string | null) ?? null,
      is_current_week: Boolean(res.is_current_week),
      tasks: (res.tasks as PortalTask[]) ?? [],
      exams: (res.exams as PortalExam[]) ?? [],
      attendance: (res.attendance as PortalAttendance[]) ?? [],
    },
  }
}

/** Görevi tamamlandı/tamamlanmadı işaretler (yalnız öğrenci rolü). */
export async function portalSetTaskCompleted(
  code: string,
  taskId: string,
  completed: boolean
): Promise<{ ok: boolean; error?: string }> {
  const res = await callRpc('portal_set_task_completed', {
    p_code: normalizeAccessCode(code),
    p_task_id: taskId,
    p_completed: completed,
  })
  return { ok: res.ok, error: res.error }
}

export type PortalExamInput = {
  name: string
  publisher: string | null
  exam_type: 'TYT' | 'AYT'
  exam_date: string
  sections: {
    section_name: string
    max_questions: number
    correct_count: number
    wrong_count: number
    blank_count: number
  }[]
}

/** Öğrencinin kendi denemesini bölüm netleriyle kaydeder (yalnız öğrenci rolü). */
export async function portalAddExam(
  code: string,
  exam: PortalExamInput
): Promise<{ ok: boolean; error?: string }> {
  const res = await callRpc('portal_add_exam', {
    p_code: normalizeAccessCode(code),
    p_name: exam.name,
    p_publisher: exam.publisher,
    p_exam_type: exam.exam_type,
    p_exam_date: exam.exam_date,
    p_sections: exam.sections as unknown as Json,
  })
  return { ok: res.ok, error: res.error }
}

// ---------------------------------------------------------------------------
// Yerel oturum (localStorage) — sadece kod + rol tutulur; öğrenci kimliğini
// istemci belirlemez, her istekte sunucu koddan çözer.
// ---------------------------------------------------------------------------
const CODE_KEY = 'netlik_mobile_code'
const ROLE_KEY = 'netlik_mobile_role'
const LEGACY_STUDENT_KEY = 'netlik_mobile_student_id' // v0.20 öncesi kalıntı

export function savePortalSession(code: string, role: PortalRole) {
  localStorage.setItem(CODE_KEY, normalizeAccessCode(code))
  localStorage.setItem(ROLE_KEY, role)
  localStorage.removeItem(LEGACY_STUDENT_KEY)
}

export function getPortalSession(): { code: string; role: PortalRole } | null {
  const code = localStorage.getItem(CODE_KEY)
  const role = localStorage.getItem(ROLE_KEY)
  if (!code) return null
  return { code, role: role === 'veli' ? 'veli' : 'ogrenci' }
}

export function clearPortalSession() {
  localStorage.removeItem(CODE_KEY)
  localStorage.removeItem(ROLE_KEY)
  localStorage.removeItem(LEGACY_STUDENT_KEY)
}
