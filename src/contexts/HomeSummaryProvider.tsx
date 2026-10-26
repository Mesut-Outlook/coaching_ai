import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { loadHomeSummary, type HomeSummary } from '../lib/homeSummary'
import { useAccess } from './AccessContext'
import { HomeSummaryContext } from './homeSummaryContext'

export default function HomeSummaryProvider({ children }: { children: ReactNode }) {
  const { studentScope } = useAccess()
  const [summary, setSummary] = useState<HomeSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadHomeSummary(studentScope)
      .then((s) => {
        if (cancelled) return
        setSummary(s)
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Özet yüklenemedi.')
      })
    return () => {
      cancelled = true
    }
  }, [studentScope, tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  return <HomeSummaryContext.Provider value={{ summary, error, refresh }}>{children}</HomeSummaryContext.Provider>
}
