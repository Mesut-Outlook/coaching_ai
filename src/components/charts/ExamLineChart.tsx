import { useState } from 'react'
import { type ChartPalette, DEFAULT_CHART_PALETTE } from './chartPalette'

export interface ExamLinePoint {
  label: string
  date: string
  value: number
  subValue?: number
}

export interface ExamLineChartProps {
  data: ExamLinePoint[]
  average?: number
  height?: number
  palette?: Partial<ChartPalette>
  unit?: string
  minThresholdNotice?: string | null
}

export default function ExamLineChart({
  data,
  average,
  height = 200,
  palette,
  unit = 'net',
  minThresholdNotice,
}: ExamLineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const pal = { ...DEFAULT_CHART_PALETTE, ...palette }

  // Asgari veri eşiği kontrolü (< 3 deneme)
  if (data.length < 3) {
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
          {minThresholdNotice || `Gelişim çizgisi için en az 3 deneme gerekir (şu an ${data.length}).`}
        </div>
        <div style={{ fontSize: 12, color: pal.textMuted }}>
          {data.length > 0
            ? data.map((d) => `${d.label}: ${d.value.toFixed(2).replace('.', ',')} ${unit}`).join(' · ')
            : 'Henüz deneme kaydı bulunmuyor.'}
        </div>
      </div>
    )
  }

  const values = data.map((d) => d.value)
  const minVal = Math.min(...values, average ?? Infinity)
  const maxVal = Math.max(...values, average ?? -Infinity)
  const marginY = Math.max(2, (maxVal - minVal) * 0.15)
  const effectiveMin = Math.max(0, Math.floor(minVal - marginY))
  const effectiveMax = Math.ceil(maxVal + marginY)
  const range = effectiveMax - effectiveMin || 1

  const width = 640
  const padLeft = 46
  const padRight = 28
  const padTop = 24
  const padBottom = 34
  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom

  const points = data.map((d, i) => {
    const x = padLeft + (i / (data.length - 1)) * plotWidth
    const y = padTop + plotHeight - ((d.value - effectiveMin) / range) * plotHeight
    return { x, y, ...d }
  })

  const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padTop + plotHeight} L ${points[0].x} ${padTop + plotHeight} Z`

  const avgY =
    average != null ? padTop + plotHeight - ((average - effectiveMin) / range) * plotHeight : null

  return (
    <div style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      >
        {/* Yatay Kılavuz Çizgileri */}
        <line
          x1={padLeft}
          y1={padTop}
          x2={width - padRight}
          y2={padTop}
          stroke={pal.border}
          strokeDasharray="2 2"
          strokeOpacity={0.6}
        />
        <line
          x1={padLeft}
          y1={padTop + plotHeight}
          x2={width - padRight}
          y2={padTop + plotHeight}
          stroke={pal.border}
          strokeWidth={1}
        />

        {/* Y-ekseni etiketleri */}
        <text
          x={padLeft - 8}
          y={padTop + 4}
          fill={pal.textMuted}
          fontSize={10}
          textAnchor="end"
          fontFamily="inherit"
        >
          {effectiveMax}
        </text>
        <text
          x={padLeft - 8}
          y={padTop + plotHeight}
          fill={pal.textMuted}
          fontSize={10}
          textAnchor="end"
          fontFamily="inherit"
        >
          {effectiveMin}
        </text>

        {/* Ortalama Çizgisi (Dashed) */}
        {avgY !== null && (
          <g>
            <line
              x1={padLeft}
              y1={avgY}
              x2={width - padRight}
              y2={avgY}
              stroke={pal.averageLine}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <text
              x={width - padRight + 4}
              y={avgY + 3}
              fill={pal.textMuted}
              fontSize={9.5}
              fontWeight={600}
              fontFamily="inherit"
            >
              Ort: {average?.toFixed(1).replace('.', ',')}
            </text>
          </g>
        )}

        {/* Alan Dolgusu */}
        <path d={areaD} fill={pal.primaryArea} />

        {/* Ana Net Çizgisi */}
        <path
          d={pathD}
          fill="none"
          stroke={pal.primary}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Veri Noktaları */}
        {points.map((p, i) => {
          const isHovered = hoveredIndex === i
          const isLast = i === points.length - 1

          return (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 6 : isLast ? 4.5 : 3.5}
                fill={isHovered ? pal.primary : '#FFFFFF'}
                stroke={pal.primary}
                strokeWidth={isHovered ? 3 : 2}
                style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
              {/* X ekseni tarih / etiket */}
              <text
                x={p.x}
                y={padTop + plotHeight + 16}
                fill={isHovered ? pal.primary : pal.textMuted}
                fontSize={9.5}
                fontWeight={isHovered || isLast ? 700 : 500}
                textAnchor="middle"
                fontFamily="inherit"
              >
                {p.date ? p.date.slice(5) : p.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Hover İpucu (Tooltip) */}
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div
          style={{
            position: 'absolute',
            left: `${(points[hoveredIndex].x / width) * 100}%`,
            top: `${(points[hoveredIndex].y / height) * 100}%`,
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
          <div style={{ fontWeight: 700 }}>{points[hoveredIndex].label}</div>
          <div>
            {points[hoveredIndex].value.toFixed(2).replace('.', ',')} {unit}
            {points[hoveredIndex].subValue != null && ` · %${points[hoveredIndex].subValue?.toFixed(0)}`}
          </div>
        </div>
      )}
    </div>
  )
}
