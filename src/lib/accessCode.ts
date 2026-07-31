import { supabase } from './supabase'
import type { Student } from '../types/database'
import { generateRandomCode } from './accessCodeGenerator'

export { generateRandomCode }

/**
 * Öğrencide eksik olan erişim kodlarını üretir ve kaydeder.
 * Koç oturumu üzerinden çalışır (students RLS: sadece kendi öğrencileri).
 */
export async function ensureStudentAccessCodes(student: Student): Promise<{
  student_access_code: string
  parent_access_code: string
  error?: string
}> {
  let studentCode = student.student_access_code
  let parentCode = student.parent_access_code

  if (!studentCode || !parentCode) {
    if (!studentCode) studentCode = generateRandomCode('STU')
    if (!parentCode) parentCode = generateRandomCode('PAR')

    const { error } = await supabase
      .from('students')
      .update({
        student_access_code: studentCode,
        parent_access_code: parentCode,
      })
      .eq('id', student.id)

    if (error) {
      console.error('Erişim kodu kaydedilemedi:', error.message)
      return {
        student_access_code: studentCode,
        parent_access_code: parentCode,
        error: 'Erişim kodu kaydedilemedi. Linki göndermeden önce tekrar dene.',
      }
    }
  }

  return {
    student_access_code: studentCode,
    parent_access_code: parentCode,
  }
}
