import { formatNetTr } from '../../../lib/homeSummaryCore'

const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

/** "2026-10-04" -> "4 Eki" */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${AY[Number(m) - 1] ?? ''}`
}

export function signed(n: number): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatNetTr(Math.abs(n))}`
}

export const cardStyle = { padding: 20 } as const

export function niceStep(mx: number): number {
  return mx <= 6 ? 1 : mx <= 12 ? 2 : mx <= 25 ? 5 : mx <= 60 ? 10 : 20
}
