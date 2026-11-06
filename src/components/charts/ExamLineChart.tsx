import { useState, type ReactNode } from 'react'
import { type ChartPalette, DEFAULT_CHART_PALETTE } from './chartPalette'
import { useElementWidth } from './useElementWidth'
import { shortDate } from '../exams/drilldown/format'

export interface ExamLinePoint {
  label: string
  date: string
  value: number | null
  subValue?: number
}

export interface ExamLineChartProps {
  data: ExamLinePoint[]
  average?: number
  height?: number
  palette?: Partial<ChartPalette>
  unit?: string
  minThresholdNotice?: string | null
  yMin?: number
  yMax?: number
  ticks?: number[]
  tickFormat?: (v: number) => string
  /** 0-100 ölçeğinde Yeterli (>=75) / Gelişiyor (>=50) / Kritik bantları */
  bands?: boolean
  refs?: Array<{ value: number; label: string }>
  highlightIndex?: number | null
  onPointClick?: (index: number) => void
  secondSeries?: { label: string; values: Array<number | null>; color?: string }
  /** true: null noktalarda çizgi kopmaz */
  connectNulls?: boolean
  /** Altında düz özet gösterilir; varsayılan 3 */
  minPoints?: number
  tooltip?: (index: number) => ReactNode
  /** Ana serinin adı (ikinci seri varken açıklamada); varsayılan 'Deneme' */
  seriesLabel?: string
  ariaLabel?: string
  /** Değeri olmayan noktada gösterilen yazı; varsayılan 'konu girilmedi' */
  nullLabel?: string
}

const FALLBACK_W = 640

export default function ExamLineChart({
  data,
  average,
  height = 200,
  palette,
  unit = 'net',
  minThresholdNotice,
  yMin,
  yMax,
  ticks,
  tickFormat,
  bands,
  refs,
  highlightIndex,
  onPointClick,
  secondSeries,
  connectNulls,
  minPoints = 3,
  tooltip,
  seriesLabel,
  ariaLabel = 'Gelişim grafiği',
  nullLabel = 'konu girilmedi',
}: ExamLineChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const [wrapRef, measured] = useElementWidth<HTMLDivElement>()
  const pal = { ...DEFAULT_CHART_PALETTE, ...palette }

  if (data.length < minPoints) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 20px',
          background: 'var(--surface-alt)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border)',
          textAlign: 'center',
          gap: 8,
          minHeight: height,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: pal.text }}>
          {minThresholdNotice || `Gelişim çizgisi için en az ${minPoints} deneme gerekir (şu an ${data.length}).`}
        </div>
        <div style={{ fontSize: 12, color: pal.textMuted }}>
          {data.length > 0
            ? data
                .filter((d) => d.value != null)
                .map((d) => `${d.label}: ${(d.value as number).toFixed(2).replace('.', ',')} ${unit}`)
                .join(' · ')
            : 'Henüz deneme kaydı bulunmuyor.'}
        </div>
      </div>
    )
  }

  // Yeni davranışlardan biri istendiyse "zengin" mod; aksi halde eski görünüm (alan dolgusu, min/maks etiket)
  const rich = !!(bands || ticks || refs || secondSeries || onPointClick || yMin != null || yMax != null)
  const second = secondSeries?.values ?? []
  const refVals = (refs ?? []).map((r) => r.value)
  const all = [...data.map((d) => d.value), ...second, ...(yMin == null || yMax == null ? refVals : [])].filter((v): v is number => v != null)
  const hasVals = all.length > 0
  const minVal = Math.min(...all, average ?? Infinity)
  const maxVal = Math.max(...all, average ?? -Infinity)
  const marginY = Math.max(2, (maxVal - minVal) * 0.15)
  const lo = yMin ?? (hasVals ? Math.max(0, Math.floor(minVal - marginY)) : 0)
  const hi = yMax ?? (hasVals ? Math.ceil(maxVal + marginY) : 100)
  const range = hi - lo || 1

  const width = measured || FALLBACK_W
  const wide = width > 520
  const n = data.length
  const padLeft = rich ? 38 : 46
  const padRight = rich ? 14 : 28
  const padTop = rich ? 14 : 24
  const padBottom = rich && wide ? 40 : 34
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom
  const x = (i: number) => padLeft + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (v: number) => padTop + plotH - ((v - lo) / range) * plotH
  const yTicks = ticks ?? [lo, hi]
  const fmt = tickFormat ?? ((v: number) => String(v))

  const buildPath = (vals: Array<number | null>) => {
    let d = ''
    let pen = false
    vals.forEach((v, i) => {
      if (v == null) {
        if (!connectNulls) pen = false
        return
      }
      d += `${pen ? 'L' : 'M'} ${x(i)} ${y(v)} `
      pen = true
    })
    return d.trim()
  }
  const mainVals = data.map((d) => d.value)
  const mainD = buildPath(mainVals)
  const lastIdx = (vals: Array<number | null>) => vals.reduce((a: number, v, i) => (v == null ? a : i), -1)
  const mainLast = lastIdx(mainVals)
  const solid = data.filter((d) => d.value != null)
  const areaD =
    !rich && solid.length === n && mainD
      ? `${mainD} L ${x(n - 1)} ${padTop + plotH} L ${x(0)} ${padTop + plotH} Z`
      : null
  const avgY = average != null ? y(average) : null
  const secColor = secondSeries?.color ?? pal.textMuted
  const slotW = n > 1 ? plotW / (n - 1) : plotW
  const hitHalf = n === 1 ? plotW / 2 : plotW / (n - 1) / 2

  const mark = (v: number, i: number, color: string, isLast: boolean, square: boolean) => {
    const big = i === highlightIndex || (!rich && hovered === i)
    const r = rich ? (big ? 5.5 : 4) : big ? 6 : isLast ? 4.5 : 3.5
    const fill = isLast || big ? color : pal.surface
    return square ? (
      <rect key={`s${i}`} x={x(i) - r} y={y(v) - r} width={2 * r} height={2 * r} rx={1.5} fill={fill} stroke={color} strokeWidth={2} />
    ) : (
      <circle key={`m${i}`} cx={x(i)} cy={y(v)} r={r} fill={fill} stroke={color} strokeWidth={2} />
    )
  }

  const tipIdx = hovered
  const tipPoint = tipIdx != null ? data[tipIdx] : null
  const tipY = tipPoint?.value != null ? y(tipPoint.value) : padTop + plotH / 2
  const tipX = tipIdx != null ? Math.min(Math.max(x(tipIdx), 60), width - 60) : 0

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
      {secondSeries && (
        <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: pal.text, marginBottom: 4, paddingLeft: padLeft }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <svg width={10} height={10} aria-hidden="true"><circle cx={5} cy={5} r={4} fill={pal.primary} /></svg>
            {seriesLabel ?? 'Deneme'}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <svg width={10} height={10} aria-hidden="true"><rect x={1} y={1} width={8} height={8} rx={1.5} fill={secColor} /></svg>
            {secondSeries.label}
          </span>
        </div>
      )}
      <svg role="img" aria-label={ariaLabel} width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
        {bands &&
          (
            [
              [75, 100, pal.bandBg.good, 'Yeterli'],
              [50, 75, pal.bandBg.medium, 'Gelişiyor'],
              [0, 50, pal.bandBg.weak, 'Kritik'],
            ] as const
          ).map(([a, b, bg, label]) => {
            const top = y(Math.min(b, hi))
            const bottom = y(Math.max(a, lo))
            if (bottom <= top) return null
            return (
              <g key={label}>
                <rect x={padLeft} y={top} width={plotW} height={bottom - top} fill={bg} opacity={0.7} />
                <text x={padLeft + plotW - 4} y={top + 12} textAnchor="end" fontSize={10.5} fill={pal.textMuted} fontFamily="inherit">
                  {label}
                </text>
              </g>
            )
          })}

        {highlightIndex != null && highlightIndex >= 0 && highlightIndex < n && (
          <rect x={x(highlightIndex) - 14} y={padTop} width={28} height={plotH} rx={6} fill={pal.primaryArea} />
        )}

        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={padLeft}
              x2={padLeft + plotW}
              y1={y(v)}
              y2={y(v)}
              stroke={pal.border}
              strokeWidth={1}
              strokeDasharray={!rich && v === hi ? '2 2' : undefined}
              strokeOpacity={!rich && v === hi ? 0.6 : 1}
            />
            <text x={padLeft - 8} y={y(v) + 4} textAnchor="end" fontSize={rich ? 11 : 10} fill={pal.textMuted} fontFamily="inherit">
              {fmt(v)}
            </text>
          </g>
        ))}

        {refs?.map((r) => (
          <g key={r.label}>
            <line x1={padLeft} x2={padLeft + plotW} y1={y(r.value)} y2={y(r.value)} stroke={pal.averageLine} strokeDasharray="4 4" />
            <text x={padLeft + 4} y={y(r.value) - 5} fontSize={10.5} fill={pal.textMuted} fontFamily="inherit">
              {r.label}
            </text>
          </g>
        ))}

        {avgY !== null && (
          <g>
            <line x1={padLeft} y1={avgY} x2={padLeft + plotW} y2={avgY} stroke={pal.averageLine} strokeWidth={1.5} strokeDasharray="4 4" />
            <text x={padLeft + plotW - 14} y={avgY - 5} textAnchor="end" fill={pal.textMuted} fontSize={9.5} fontWeight={600} fontFamily="inherit" stroke={pal.surface} strokeWidth={3} paintOrder="stroke">
              Ort: {average?.toFixed(1).replace('.', ',')}
            </text>
          </g>
        )}

        {areaD && <path d={areaD} fill={pal.primaryArea} />}

        {secondSeries && (
          <path d={buildPath(second)} fill="none" stroke={secColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {mainD && (
          <path d={mainD} fill="none" stroke={pal.primary} strokeWidth={rich ? 2 : 2.5} strokeLinejoin="round" strokeLinecap="round" />
        )}

        {secondSeries && second.map((v, i) => (v == null ? null : mark(v, i, secColor, i === lastIdx(second), true)))}
        {mainVals.map((v, i) => (v == null ? null : mark(v, i, pal.primary, i === mainLast, false)))}

        {/* Boş noktalar: "konu girilmedi" */}
        {rich &&
          mainVals.map((v, i) =>
            v == null && slotW >= 64 && (!secondSeries || second[i] == null) ? (
              <g key={`g${i}`}>
                <text
                  x={x(i)}
                  y={padTop + plotH / 2}
                  textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}
                  fontSize={10.5}
                  fill={pal.textMuted}
                  fontFamily="inherit"
                >
                  {nullLabel}
                </text>
              </g>
            ) : null,
          )}

        {/* X ekseni: dar ekranda seyrek, geniş ekranda iki satır */}
        {data.map((d, i) => {
          if (rich && !wide && n > 8 && i % 2 && i !== n - 1) return null
          const strong = i === highlightIndex || i === n - 1 || hovered === i
          const first = d.date ? shortDate(d.date) : d.label
          return (
            <g key={`x${i}`}>
              <text x={x(i)} y={padTop + plotH + 16} fill={hovered === i ? pal.primary : pal.textMuted} fontSize={rich ? 11 : 9.5} fontWeight={strong ? 700 : 500} textAnchor="middle" fontFamily="inherit">
                {first}
              </text>
              {rich && wide && d.date && (
                <text x={x(i)} y={padTop + plotH + 30} textAnchor="middle" fontSize={10} fill={pal.textMuted} fontFamily="inherit">
                  {d.label.length > 14 ? `${d.label.slice(0, 13)}…` : d.label}
                </text>
              )}
            </g>
          )
        })}

        {hovered != null && (
          <line x1={x(hovered)} x2={x(hovered)} y1={padTop} y2={padTop + plotH} stroke={pal.averageLine} strokeWidth={1} />
        )}

        {/* Tıklama/hover hedefleri: işaretten geniş */}
        {data.map((_, i) => (
          <rect
            key={`h${i}`}
            x={x(i) - hitHalf}
            y={padTop}
            width={2 * hitHalf}
            height={plotH + padBottom}
            fill="transparent"
            style={{ cursor: onPointClick ? 'pointer' : 'default' }}
            onPointerEnter={() => setHovered(i)}
            onPointerLeave={() => setHovered(null)}
            onClick={onPointClick ? () => onPointClick(i) : undefined}
            {...(onPointClick
              ? {
                  tabIndex: 0,
                  role: 'button',
                  'aria-label': `${data[i].label}: ${data[i].value != null ? `${data[i].value!.toFixed(2).replace('.', ',')} ${unit}` : 'veri yok'}`,
                  onFocus: () => setHovered(i),
                  onBlur: () => setHovered(null),
                  onKeyDown: (ev: React.KeyboardEvent) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault()
                      onPointClick(i)
                    }
                  },
                }
              : {})}
          />
        ))}
      </svg>

      {tipIdx != null && tipPoint && (
        <div
          style={{
            position: 'absolute',
            left: tipX,
            top: tipY,
            transform: 'translate(-50%, -125%)',
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
          {tooltip ? (
            tooltip(tipIdx)
          ) : (
            <>
              <div style={{ fontWeight: 700 }}>{tipPoint.label}</div>
              <div>
                {tipPoint.value != null ? `${tipPoint.value.toFixed(2).replace('.', ',')} ${unit}` : 'Konu detayı girilmedi'}
                {tipPoint.subValue != null && ` · %${tipPoint.subValue.toFixed(0)}`}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
