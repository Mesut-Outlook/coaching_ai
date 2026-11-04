import { useState, type ReactNode } from 'react'
import { type ChartPalette, DEFAULT_CHART_PALETTE } from './chartPalette'
import { useElementWidth } from './useElementWidth'

export interface StackedColumn {
  label: string
  subLabel?: string
  /** null = bu sütunda veri yok */
  parts: Array<{ value: number; color: string; name: string }> | null
  topLabel?: string
}

export interface StackedColumnChartProps {
  columns: StackedColumn[]
  yMax: number
  ticks?: number[]
  height?: number
  highlightIndex?: number | null
  onColumnClick?: (i: number) => void
  tooltip?: (i: number) => ReactNode
  palette?: Partial<ChartPalette>
  ariaLabel: string
}

export default function StackedColumnChart({
  columns,
  yMax,
  ticks = [],
  height = 200,
  highlightIndex,
  onColumnClick,
  tooltip,
  palette,
  ariaLabel,
}: StackedColumnChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const [ref, measured] = useElementWidth<HTMLDivElement>()
  const pal = { ...DEFAULT_CHART_PALETTE, ...palette }
  const width = Math.max(260, measured || 640)
  const wide = width > 520
  const n = columns.length
  const m = { l: 38, r: 14, t: 18, b: wide ? 40 : 28 }
  const iw = width - m.l - m.r
  const ih = height - m.t - m.b
  const slot = n ? iw / n : iw
  const bw = Math.min(40, slot * 0.56)
  const y = (v: number) => m.t + ih - (v / (yMax || 1)) * ih
  const cx = (i: number) => m.l + slot * i + slot / 2
  // Dar ekranda çok sütun varsa etiketler seyrek
  const thin = !wide && n > 8

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} style={{ display: 'block' }}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={m.l + iw} y1={y(v)} y2={y(v)} stroke={pal.border} />
            <text x={m.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={pal.textMuted} fontFamily="inherit">
              {v}
            </text>
          </g>
        ))}
        {columns.map((c, i) => {
          const hl = i === highlightIndex
          let base = y(0)
          return (
            <g key={i}>
              {hl && <rect x={cx(i) - slot / 2 + 2} y={m.t - 14} width={slot - 4} height={ih + 14} rx={6} fill={pal.primaryArea} />}
              {!c.parts ? (
                <text x={cx(i)} y={m.t + ih / 2} textAnchor="middle" fontSize={10.5} fill={pal.textMuted} fontFamily="inherit">
                  yok
                </text>
              ) : (
                <>
                  {c.parts.map((p, pi) => {
                    const h = (p.value / (yMax || 1)) * ih
                    const gap = pi > 0 ? 2 : 0
                    const top = base - h
                    base -= h
                    if (h - gap <= 0) return null
                    return <rect key={pi} x={cx(i) - bw / 2} y={top} width={bw} height={h - gap} rx={2} fill={p.color} />
                  })}
                  {c.topLabel && (i === n - 1 || hl) && (
                    <text x={cx(i)} y={base - 5} textAnchor="middle" fontSize={11} fontWeight={700} fill={pal.text} fontFamily="inherit">
                      {c.topLabel}
                    </text>
                  )}
                </>
              )}
              {!(thin && i % 2 && i !== n - 1) && (
                <>
                  <text x={cx(i)} y={m.t + ih + 16} textAnchor="middle" fontSize={11} fontWeight={hl ? 700 : 400} fill={pal.textMuted} fontFamily="inherit">
                    {c.label}
                  </text>
                  {wide && c.subLabel && (
                    <text x={cx(i)} y={m.t + ih + 30} textAnchor="middle" fontSize={10} fill={pal.textMuted} fontFamily="inherit">
                      {c.subLabel}
                    </text>
                  )}
                </>
              )}
              <rect
                x={cx(i) - slot / 2}
                y={m.t - 14}
                width={slot}
                height={ih + 14 + m.b}
                fill="transparent"
                style={{ cursor: onColumnClick ? 'pointer' : 'default' }}
                onPointerEnter={() => setHovered(i)}
                onPointerLeave={() => setHovered(null)}
                onClick={onColumnClick ? () => onColumnClick(i) : undefined}
                {...(onColumnClick
                  ? {
                      tabIndex: 0,
                      role: 'button',
                      'aria-label': `${c.label}${c.subLabel ? ` ${c.subLabel}` : ''}: ${c.parts ? c.parts.map((p) => `${p.name} ${p.value}`).join(', ') : 'veri yok'}`,
                      onFocus: () => setHovered(i),
                      onBlur: () => setHovered(null),
                      onKeyDown: (ev: React.KeyboardEvent) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault()
                          onColumnClick(i)
                        }
                      },
                    }
                  : {})}
              />
            </g>
          )
        })}
      </svg>
      {hovered != null && tooltip && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(Math.max(cx(hovered), 60), width - 60),
            top: m.t,
            transform: 'translate(-50%, -100%)',
            background: 'var(--ink)',
            color: '#FFFFFF',
            padding: '5px 10px',
            borderRadius: 6,
            fontSize: 11,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-pop)',
            zIndex: 10,
          }}
        >
          {tooltip(hovered)}
        </div>
      )}
    </div>
  )
}
