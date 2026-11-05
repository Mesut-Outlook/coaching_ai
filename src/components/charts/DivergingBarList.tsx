import { useState } from 'react'
import { formatNetTr } from '../../lib/homeSummaryCore'
import { type ChartPalette, DEFAULT_CHART_PALETTE } from './chartPalette'

export interface DivergingBarItem {
  key: string | number
  label: string
  /** null = veri yok */
  value: number | null
}

export interface DivergingBarListProps {
  items: DivergingBarItem[]
  onItemClick?: (key: string | number) => void
  emptyText: string
  palette?: Partial<ChartPalette>
}

/** Sıfır eksenli sapma listesi: pozitif sağa (yeşil), negatif sola (kırmızı). */
export default function DivergingBarList({ items, onItemClick, emptyText, palette }: DivergingBarListProps) {
  const [hovered, setHovered] = useState<string | number | null>(null)
  const pal = { ...DEFAULT_CHART_PALETTE, ...palette }

  if (items.length === 0) {
    return <div style={{ textAlign: 'center', padding: '24px 12px', color: pal.textMuted, fontSize: 12.5 }}>{emptyText}</div>
  }
  const maxAbs = Math.max(...items.map((i) => Math.abs(i.value ?? 0)), 0.01)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      {items.map((it) => {
        const v = it.value
        const pct = v == null ? 0 : (Math.abs(v) / maxAbs) * 50
        const text = v == null ? 'yok' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatNetTr(Math.abs(v))}`
        const inner = (
          <>
            <span style={{ flex: '0 0 38%', minWidth: 0, fontSize: 12.5, color: pal.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
              {it.label}
            </span>
            <span style={{ position: 'relative', flex: 1, height: 14, background: hovered === it.key ? 'var(--surface-alt)' : 'transparent', borderRadius: 4 }}>
              <span style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: pal.border }} />
              {v != null && v !== 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    bottom: 2,
                    borderRadius: 3,
                    background: v > 0 ? pal.success : pal.critical,
                    width: `${Math.max(pct, 1)}%`,
                    ...(v > 0 ? { left: '50%' } : { right: '50%' }),
                  }}
                />
              )}
            </span>
            <span style={{ flex: '0 0 56px', textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: v == null ? pal.textMuted : pal.text }}>{text}</span>
          </>
        )
        const style: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, minHeight: 28, width: '100%' }
        const hover = { onMouseEnter: () => setHovered(it.key), onMouseLeave: () => setHovered(null) }
        return onItemClick ? (
          <button key={it.key} type="button" onClick={() => onItemClick(it.key)} {...hover} title={`${it.label}: ${text}`} style={{ ...style, background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer' }}>
            {inner}
          </button>
        ) : (
          <div key={it.key} {...hover} title={`${it.label}: ${text}`} style={style}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}
