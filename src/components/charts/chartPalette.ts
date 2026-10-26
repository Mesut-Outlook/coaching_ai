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
}
