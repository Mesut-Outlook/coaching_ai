import { supabase } from './supabase'
import { mondayOf, weekKey } from './weeks'
export * from './parentSummaryCore'

/**
 * WhatsApp açıldığında log tablosuna kayıt atar.
 */
export async function recordParentSummaryWhatsAppLog(
  studentId: string,
  weekStart: string
): Promise<{ ok: boolean; openedAt?: string; error?: string }> {
  const nowIso = new Date().toISOString()
  try {
    const { error } = await supabase.from('parent_summary_log').insert({
      student_id: studentId,
      week_start: weekStart,
      channel: 'whatsapp',
      opened_at: nowIso,
    })

    if (error) {
      console.error('recordParentSummaryWhatsAppLog error:', error.message)
      return { ok: false, error: error.message }
    }
    return { ok: true, openedAt: nowIso }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

/**
 * Belirtilen öğrenci ve hafta için son WhatsApp logunu sorgular.
 */
export async function getLatestParentSummaryLog(
  studentId: string,
  weekStart?: string
): Promise<string | null> {
  try {
    let query = supabase
      .from('parent_summary_log')
      .select('opened_at')
      .eq('student_id', studentId)
      .order('opened_at', { ascending: false })
      .limit(1)

    if (weekStart) {
      query = query.eq('week_start', weekStart)
    }

    const { data, error } = await query
    if (error || !data || data.length === 0) {
      return null
    }
    return data[0].opened_at
  } catch {
    return null
  }
}

export function getDefaultWeekStart(): string {
  return weekKey(mondayOf(new Date()))
}
