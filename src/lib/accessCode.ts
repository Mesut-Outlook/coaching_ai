import { supabase } from './supabase'
import type { Student } from '../types/database'

/**
 * Generates a 6-character random uppercase alphanumeric access code.
 */
export function generateRandomCode(prefix: 'STU' | 'PAR'): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' // Excluding easily confused characters like O, 0, I, 1
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${prefix}-${code}`
}

/**
 * Ensures a student has both student_access_code and parent_access_code.
 * If missing, generates and updates them in Supabase.
 */
export async function ensureStudentAccessCodes(student: Student): Promise<{
  student_access_code: string
  parent_access_code: string
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
      console.error('Error saving access codes:', error)
    }
  }

  return {
    student_access_code: studentCode,
    parent_access_code: parentCode,
  }
}

/**
 * Fetches a student and their access role ('ogrenci' | 'veli') by PIN code.
 */
export async function verifyAccessCode(code: string): Promise<{
  student: Student | null
  role: 'ogrenci' | 'veli' | null
  error?: string
}> {
  const cleanCode = code.trim().toUpperCase()
  if (!cleanCode) return { student: null, role: null, error: 'Lütfen bir erişim kodu girin.' }

  // Try student access code first
  const { data: studentMatch } = await supabase
    .from('students')
    .select('*')
    .eq('student_access_code', cleanCode)
    .single()

  if (studentMatch) {
    return { student: studentMatch as Student, role: 'ogrenci' }
  }

  // Try parent access code
  const { data: parentMatch } = await supabase
    .from('students')
    .select('*')
    .eq('parent_access_code', cleanCode)
    .single()

  if (parentMatch) {
    return { student: parentMatch as Student, role: 'veli' }
  }

  return { student: null, role: null, error: 'Geçersiz erişim kodu veya bağlantı.' }
}
