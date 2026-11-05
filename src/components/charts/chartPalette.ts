export type ChartPalette = {
  primary: string
  primaryArea: string
  averageLine: string
  success: string
  warning: string
  critical: string
  text: string
  textMuted: string
  border: string
  blank: string
  surface: string
  bandBg: { good: string; medium: string; weak: string }
  /** Sıra: Türkçe, Sosyal, Matematik, Fen (renk körlüğü kontrolünden geçti; Fen Sosyal'in yanına konmaz) */
  groups: string[]
}

const GROUP_ORDER = ['turkce', 'sosyal', 'matematik', 'fen']

function groupKey(sectionName: string): string {
  return sectionName
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/\s*bilimleri?$/, '')
    .trim()
}

/** Tek ad->renk haritası: bilinen adlar kendi yuvasını korur, bilinmeyenler ilk boş yuvayı alır; 6'dan sonra döner. */
export function groupColorMap(pal: ChartPalette, sectionNames: string[]): Map<string, string> {
  const len = pal.groups.length
  const used = new Set<number>()
  const slot = new Map<string, number>()
  for (const n of sectionNames) {
    const i = GROUP_ORDER.indexOf(groupKey(n))
    if (i >= 0 && i < len) {
      slot.set(n, i)
      used.add(i)
    }
  }
  let k = 0
  for (const n of sectionNames) {
    if (slot.has(n)) continue
    let i = k
    while (i < len && used.has(i)) i++
    if (i >= len) i = k % len
    else used.add(i)
    slot.set(n, i)
    k++
  }
  return new Map([...slot].map(([n, i]) => [n, pal.groups[i]]))
}

export const DEFAULT_CHART_PALETTE: ChartPalette = {
  primary: 'var(--indigo-600)',
  primaryArea: 'color-mix(in srgb, var(--indigo-600) 12%, transparent)',
  averageLine: 'var(--ink-faint)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  critical: 'var(--critical)',
  text: 'var(--ink)',
  textMuted: 'var(--ink-soft)',
  border: 'var(--border)',
  blank: 'var(--measured)',
  surface: 'var(--surface)',
  bandBg: { good: 'var(--success-bg)', medium: 'var(--warning-bg)', weak: 'var(--critical-bg)' },
  groups: ['var(--c-turkce)', 'var(--c-sosyal)', 'var(--c-math)', 'var(--c-fen)', 'var(--c-ek1)', 'var(--c-ek2)'],
}

export const PORTAL_STUDENT_PALETTE: ChartPalette = {
  primary: '#4C43A8',
  primaryArea: 'rgba(76, 67, 168, 0.12)',
  averageLine: '#8A86A3',
  success: '#1F9D6B',
  warning: '#D9932E',
  critical: '#D6495A',
  text: '#1D1B2E',
  textMuted: '#56526E',
  border: '#E7E4F1',
  blank: '#A6A3BB',
  surface: '#FFFFFF',
  bandBg: { good: '#E3F7EE', medium: '#FBF0DA', weak: '#FCE4E7' },
  groups: ['#D6495A', '#E2932E', '#3B6FE0', '#2E9F63', '#9350A6', '#8A6D1E'],
}

export const PORTAL_PARENT_PALETTE: ChartPalette = {
  primary: '#1D8FA6',
  primaryArea: 'rgba(29, 143, 166, 0.12)',
  averageLine: '#8A86A3',
  success: '#1F9D6B',
  warning: '#D9932E',
  critical: '#D6495A',
  text: '#1D1B2E',
  textMuted: '#56526E',
  border: '#E7E4F1',
  blank: '#A6A3BB',
  surface: '#FFFFFF',
  bandBg: { good: '#E3F7EE', medium: '#FBF0DA', weak: '#FCE4E7' },
  groups: ['#D6495A', '#E2932E', '#3B6FE0', '#2E9F63', '#9350A6', '#8A6D1E'],
}
