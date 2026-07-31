import { supabase } from './supabase'
import type { Student } from '../types/database'

// Karıştırılması kolay karakterler (O/0, I/1, S/5) dışarıda bırakıldı.
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRTUVWXYZ'
const CODE_LENGTH = 6

/**
 * 6 karakterlik rastgele erişim kodu üretir (örn. STU-4KX9M2).
 *
 * ⚠️ Uzunluk neden 6: kod, giriş yapmamış istemcinin sunucuya gönderdiği bir
 * bearer token gibi çalışıyor (bkz. portal_login RPC) ve deneme sayısı sınırlı
 * değil. 4 karakterde ~1 milyon ihtimal vardı (kaba kuvvetle saatler içinde
 * taranabilir); 6 karakterde ~887 milyona çıkıyor. Kısaltma.
 */
export function generateRandomCode(prefix: 'STU' | 'PAR'): string {
  const bytes = new Uint32Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET.charAt(bytes[i] % CODE_ALPHABET.length)
  }
  return `${prefix}-${code}`
}

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
