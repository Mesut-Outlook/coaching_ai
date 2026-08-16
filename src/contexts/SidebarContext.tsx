import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'netlik_sidebar_collapsed'

interface SidebarContextValue {
  /** Menü şu an dar mı çiziliyor (kilit + geçici genişleme birlikte hesaplanır) */
  collapsed: boolean
  /** Kullanıcının kalıcı tercihi: true = kapalı kilitli */
  locked: boolean
  toggleLocked: () => void
  /** Dar moddayken fareyle üzerine gelince geçici olarak açılır */
  setHovering: (v: boolean) => void
}

export const SidebarContext = createContext<SidebarContextValue | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [hovering, setHovering] = useState(false)

  const toggleLocked = useCallback(() => {
    setLocked((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // localStorage kapalıysa tercih oturumluk kalır
      }
      return next
    })
  }, [])

  // Kapalıyken fareyle açılması geçicidir; kilit açılınca hover durumu anlamsız.
  useEffect(() => {
    if (!locked) setHovering(false)
  }, [locked])

  const collapsed = locked && !hovering

  return (
    <SidebarContext.Provider value={{ collapsed, locked, toggleLocked, setHovering }}>
      {children}
    </SidebarContext.Provider>
  )
}
