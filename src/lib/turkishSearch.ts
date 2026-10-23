export function uniqSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) =>
    a.localeCompare(b, 'tr'),
  )
}

// --- Türkçe karakter duyarsız arama ---
// "tip" yazınca "Tıp" bulunsun. Sunucu tarafı: her harfi Türkçe varyantlarını
// içeren regex sınıfına çevirip PostgREST imatch (~*) ile ara. İstemci: ASCII'ye katla.
export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
export const TR_CLASS: Record<string, string> = {
  i: '[iıİI]', 'ı': '[iıİI]',
  s: '[sşSŞ]', 'ş': '[sşSŞ]',
  c: '[cçCÇ]', 'ç': '[cçCÇ]',
  g: '[gğGĞ]', 'ğ': '[gğGĞ]',
  u: '[uüUÜ]', 'ü': '[uüUÜ]',
  o: '[oöOÖ]', 'ö': '[oöOÖ]',
}
export function turkishRegex(term: string): string {
  return Array.from(term.trim())
    .map((ch) => TR_CLASS[ch.toLocaleLowerCase('tr')] ?? escapeRegex(ch))
    .join('')
}
export function foldTr(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o')
    .replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u')
}
