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

/** Bilinmeyen ders adı => groups[index % 4]. Büyük/küçük harf ve "Bilimleri" eki duyarsız. */
export function groupColor(pal: ChartPalette, sectionName: string, index: number): string {
  const n = sectionName
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/\s*bilimleri?$/, '')
    .trim()
  const i = GROUP_ORDER.indexOf(n)
  return pal.groups[(i >= 0 ? i : index) % pal.groups.length]
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
  groups: ['var(--c-turkce)', 'var(--c-sosyal)', 'var(--c-math)', 'var(--c-fen)'],
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
  groups: ['#D6495A', '#E2932E', '#3B6FE0', '#2E9F63'],
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
  groups: ['#D6495A', '#E2932E', '#3B6FE0', '#2E9F63'],
}
