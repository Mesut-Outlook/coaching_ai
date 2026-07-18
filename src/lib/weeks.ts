export const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'] as const
export const DAY_ABBR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const
const MONTHS_TR_FULL = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
] as const

export function mondayOf(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = date.getDay()
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day))
  return date
}

/** Supabase 'date' sütunlarıyla eşleşen YYYY-MM-DD anahtarı. */
export function weekKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fmtWeekRange(start: Date): string {
  const end = new Date(start.getTime() + 6 * 86400000)
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS_TR_FULL[start.getMonth()]} ${start.getFullYear()}`
  }
  return `${start.getDate()} ${MONTHS_TR_FULL[start.getMonth()]} – ${end.getDate()} ${MONTHS_TR_FULL[end.getMonth()]} ${end.getFullYear()}`
}
