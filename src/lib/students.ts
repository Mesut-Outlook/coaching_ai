import { supabase, isSupabaseConfigured } from './supabase'
import type { Student } from '../types/database'

export interface FetchStudentsOptions {
  institutionId?: string | null
  /**
   * Dolu olduğunda aktif kurum bir "bireysel koçluk pratiği"dir (Netlik):
   * liste, o kurumun öğrencileri **veya** bu koçun koçluk verdiği öğrenciler olur.
   * Böylece Konsept'te kayıtlı olup Eda'dan koçluk alan öğrenci de Netlik'te görünür.
   */
  coachingCoachId?: string | null
  activeOnly?: boolean
  orderBy?: 'full_name' | 'created_at'
}

export async function fetchStudents(opts: FetchStudentsOptions = {}): Promise<Student[]> {
  if (!isSupabaseConfigured) return []

  let query = supabase.from('students').select('*')

  if (opts.activeOnly !== false) {
    query = query.eq('is_active', true)
  }

  if (opts.institutionId && opts.coachingCoachId) {
    query = query.or(
      `institution_id.eq.${opts.institutionId},coaching_coach_id.eq.${opts.coachingCoachId}`
    )
  } else if (opts.institutionId) {
    query = query.eq('institution_id', opts.institutionId)
  } else if (opts.coachingCoachId) {
    query = query.eq('coaching_coach_id', opts.coachingCoachId)
  }

  const orderBy = opts.orderBy ?? 'full_name'
  query = query.order(orderBy, { ascending: true })

  const { data, error } = await query
  if (error) {
    console.error('Öğrenciler getirilemedi:', error)
    return []
  }

  return (data as Student[]) || []
}
