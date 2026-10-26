import { createContext, useContext } from 'react'
import type { HomeSummary } from '../lib/homeSummary'

export interface HomeSummaryState {
  /** null = henüz yüklenmedi */
  summary: HomeSummary | null
  error: string | null
  refresh: () => void
}

export const HomeSummaryContext = createContext<HomeSummaryState | null>(null)

/** Ana Sayfa ve menü rozetleri aynı özeti paylaşır; ikinci kez yüklenmez. */
export function useHomeSummary() {
  const ctx = useContext(HomeSummaryContext)
  if (!ctx) throw new Error('useHomeSummary must be used within a HomeSummaryProvider')
  return ctx
}
