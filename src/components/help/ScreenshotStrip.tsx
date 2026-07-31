import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export type Screenshot = {
  /** public/ altındaki yol, örn. "/yardim/portal-giris.webp" */
  src: string
  caption: string
}

/**
 * Yardım kartlarının içindeki küçük ekran görüntüsü şeridi — tıklanınca
 * tam boy açılır (lightbox). Kartın kendisi bir <Link> olduğu için
 * tıklamalar preventDefault/stopPropagation ile durduruluyor, yoksa
 * görsele basınca ilgili ekrana gidiliyordu.
 */
export default function ScreenshotStrip({ shots }: { shots: Screenshot[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const close = useCallback(() => setOpenIndex(null), [])
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((i) => (i === null ? null : (i + delta + shots.length) % shots.length)),
    [shots.length]
  )

  useEffect(() => {
    if (openIndex === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openIndex, close, step])

  function stop(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.04, color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 6 }}>
        Ekran görüntüleri
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {shots.map((shot, i) => (
          <button
            key={shot.src}
            type="button"
            title={shot.caption}
            onClick={(e) => {
              stop(e)
              setOpenIndex(i)
            }}
            style={{
              padding: 0,
              border: '1px solid var(--border)',
              borderRadius: 8,
              overflow: 'hidden',
              background: 'var(--surface-alt)',
              cursor: 'zoom-in',
              flexShrink: 0,
              lineHeight: 0,
            }}
          >
            <img
              src={shot.src}
              alt={shot.caption}
              loading="lazy"
              width={74}
              height={135}
              style={{ display: 'block', width: 74, height: 135, objectFit: 'cover', objectPosition: 'top' }}
            />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div
          onClick={(e) => {
            stop(e)
            close()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(10, 8, 26, 0.82)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            padding: 24,
            cursor: 'zoom-out',
          }}
        >
          <img
            src={shots[openIndex].src}
            alt={shots[openIndex].caption}
            onClick={stop}
            style={{
              maxHeight: '78vh',
              maxWidth: '100%',
              borderRadius: 14,
              boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
              cursor: 'default',
            }}
          />

          <div style={{ color: '#fff', fontSize: 13.5, textAlign: 'center', maxWidth: 460 }}>
            {shots[openIndex].caption}
          </div>

          {shots.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }} onClick={stop}>
              <button type="button" onClick={(e) => { stop(e); step(-1) }} style={navBtn} aria-label="Önceki">
                <ChevronLeft size={18} />
              </button>
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                {openIndex + 1} / {shots.length}
              </span>
              <button type="button" onClick={(e) => { stop(e); step(1) }} style={navBtn} aria-label="Sonraki">
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={(e) => { stop(e); close() }}
            aria-label="Kapat"
            style={{ ...navBtn, position: 'absolute', top: 20, right: 20 }}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  )
}

const navBtn = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(255,255,255,0.1)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
} as const
