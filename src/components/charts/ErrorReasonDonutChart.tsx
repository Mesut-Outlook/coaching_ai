import { useState, useId } from 'react'
import { PieChart, HelpCircle, CheckCircle2 } from 'lucide-react'
import type { ErrorType, ErrorBasketItem } from '../../types/database'
import {
  type ErrorReasonAnalysisData,
  type ErrorReasonItem,
  buildErrorReasonAnalysis,
  ERROR_REASON_CONFIG,
} from '../../lib/report360Core'

export interface ErrorReasonDonutChartProps {
  data?: ErrorReasonAnalysisData | null
  items?: ErrorBasketItem[] | null
  counts?: Partial<Record<ErrorType, number>> | null
  title?: string
  subtitle?: string
}

export default function ErrorReasonDonutChart({
  data: providedData,
  items,
  counts,
  title = 'Yanlış Nedenleri Dağılımı',
  subtitle,
}: ErrorReasonDonutChartProps) {
  const chartId = useId()
  const [hoveredType, setHoveredType] = useState<ErrorType | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  // Veri çözümleme: ya doğrudan data, ya items, ya counts
  let analysisData: ErrorReasonAnalysisData
  if (providedData) {
    analysisData = providedData
  } else if (items) {
    analysisData = buildErrorReasonAnalysis(items)
  } else if (counts) {
    const syntheticItems: ErrorBasketItem[] = []
    Object.entries(counts).forEach(([type, cnt]) => {
      for (let i = 0; i < (cnt || 0); i++) {
        syntheticItems.push({
          id: `${type}-${i}`,
          mock_exam_id: 'synthetic',
          topic_id: null,
          error_type: type as ErrorType,
          created_at: new Date().toISOString(),
        })
      }
    })
    analysisData = buildErrorReasonAnalysis(syntheticItems)
  } else {
    analysisData = buildErrorReasonAnalysis([])
  }

  const { totalCount, items: categoryItems, dominantReason, summaryText } = analysisData

  // Boş durum
  if (totalCount === 0) {
    return (
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          padding: 16,
          background: 'var(--surface)',
          borderRadius: 10,
          border: '1px solid var(--border-soft)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PieChart size={17} style={{ color: 'var(--indigo-600)' }} />
          <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
            {title}
          </h3>
        </div>

        <div
          style={{
            padding: '28px 16px',
            textAlign: 'center',
            background: 'var(--surface-alt)',
            borderRadius: 8,
            border: '1px dashed var(--border-soft)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <HelpCircle size={28} style={{ color: 'var(--ink-faint)', opacity: 0.6 }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            Henüz Yanlış Nedeni Belirtilmedi
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--ink-soft)',
              maxWidth: 380,
              lineHeight: 1.5,
            }}
          >
            Henüz yanlış nedeni girilmemiş. Deneme analizinden yanlış nedenleri ekleyebilirsiniz.
          </div>
        </div>
      </div>
    )
  }

  // Donut SVG hesaplamaları
  const size = 200
  const center = size / 2
  const radius = 68
  const strokeWidth = 24
  const circumference = 2 * Math.PI * radius

  // Dilim açılarını ve ofsetlerini hesapla
  let accumulatedOffset = 0
  const activeSlices = categoryItems
    .filter((cat) => cat.count > 0)
    .map((cat) => {
      const fraction = cat.count / totalCount
      const segmentLength = fraction * circumference
      // Dilimler arasında hafif bir boşluk (birden fazla dilim varsa)
      const gap = categoryItems.filter((c) => c.count > 0).length > 1 ? 2 : 0
      const strokeDash = `${Math.max(0, segmentLength - gap)} ${circumference - Math.max(0, segmentLength - gap)}`
      const offset = -accumulatedOffset
      accumulatedOffset += segmentLength

      return {
        ...cat,
        strokeDash,
        offset,
      }
    })

  const hoveredItem: ErrorReasonItem | undefined = hoveredType
    ? categoryItems.find((c) => c.type === hoveredType)
    : undefined

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: 16,
        background: 'var(--surface)',
        borderRadius: 10,
        border: '1px solid var(--border-soft)',
        position: 'relative',
      }}
    >
      {/* Kart Başlığı */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <PieChart size={17} style={{ color: 'var(--indigo-600)' }} />
            <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
              {title}
            </h3>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>
            {subtitle || summaryText}
          </div>
        </div>

        {dominantReason && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: 6,
              background: ERROR_REASON_CONFIG[dominantReason].bg,
              color: ERROR_REASON_CONFIG[dominantReason].textColor,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <CheckCircle2 size={12} />
            Baskın: {ERROR_REASON_CONFIG[dominantReason].label}
          </div>
        )}
      </div>

      {/* Grafik ve Lejant Izgarası */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(180px, 200px) 1fr',
          gap: 18,
          alignItems: 'center',
        }}
      >
        {/* SVG Donut */}
        <div
          style={{
            position: 'relative',
            width: size,
            height: size,
            margin: '0 auto',
          }}
          onMouseLeave={() => {
            setHoveredType(null)
            setTooltipPos(null)
          }}
        >
          <svg
            viewBox={`0 0 ${size} ${size}`}
            width={size}
            height={size}
            style={{ overflow: 'visible' }}
          >
            {/* Arka plan halkası */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="var(--border-soft)"
              strokeWidth={strokeWidth}
            />

            {/* Renkli dilimler */}
            {activeSlices.map((slice) => {
              const isHovered = hoveredType === slice.type
              return (
                <circle
                  key={slice.type}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={slice.strokeDash}
                  strokeDashoffset={slice.offset}
                  strokeLinecap={gapCapable(categoryItems) ? 'round' : 'butt'}
                  transform={`rotate(-90 ${center} ${center})`}
                  style={{
                    cursor: 'pointer',
                    transition: 'stroke-width 0.15s ease, opacity 0.15s ease',
                    opacity: hoveredType && !isHovered ? 0.45 : 1,
                  }}
                  onMouseEnter={(e) => {
                    setHoveredType(slice.type)
                    const rect = e.currentTarget.getBoundingClientRect()
                    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top })
                  }}
                />
              )
            })}

            {/* Donut Merkez Metni */}
            <text
              x={center}
              y={center - 4}
              textAnchor="middle"
              fill="var(--ink)"
              fontSize="24"
              fontWeight="800"
              style={{ pointerEvents: 'none', fontFeatureSettings: '"tnum"' }}
            >
              {hoveredItem ? hoveredItem.count : totalCount}
            </text>
            <text
              x={center}
              y={center + 16}
              textAnchor="middle"
              fill={hoveredItem ? hoveredItem.textColor : 'var(--ink-soft)'}
              fontSize="11"
              fontWeight="600"
              style={{ pointerEvents: 'none' }}
            >
              {hoveredItem ? `%${hoveredItem.percentage} ${hoveredItem.label}` : 'Toplam Hata'}
            </text>
          </svg>
        </div>

        {/* Lejant & Yüzde Dağılımı */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {categoryItems.map((cat) => {
            const isHovered = hoveredType === cat.type
            return (
              <div
                key={cat.type}
                onMouseEnter={() => setHoveredType(cat.type)}
                onMouseLeave={() => setHoveredType(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: isHovered ? cat.bg : 'var(--surface-alt)',
                  border: `1px solid ${isHovered ? cat.color : 'var(--border-soft)'}`,
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: cat.color,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: isHovered ? cat.textColor : 'var(--ink)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cat.label}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
                      {cat.description}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 6,
                    marginLeft: 10,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: cat.count > 0 ? cat.textColor : 'var(--ink-faint)',
                    }}
                  >
                    {cat.count} <span style={{ fontSize: 10, fontWeight: 500 }}>adet</span>
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--ink-soft)',
                      minWidth: 32,
                      textAlign: 'right',
                    }}
                  >
                    %{cat.percentage}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Fare Üzerine Gelince İpucu (Tooltip) */}
      {hoveredItem && tooltipPos && (
        <div
          role="tooltip"
          id={chartId}
          style={{
            position: 'fixed',
            left: tooltipPos.x,
            top: tooltipPos.y - 10,
            transform: 'translate(-50%, -100%)',
            background: 'var(--surface)',
            color: 'var(--ink)',
            border: `1px solid ${hoveredItem.color}`,
            borderRadius: 8,
            padding: '8px 12px',
            boxShadow: 'var(--shadow-pop)',
            zIndex: 1000,
            pointerEvents: 'none',
            fontSize: 11.5,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: hoveredItem.color,
              }}
            />
            <span>{hoveredItem.label}</span>
          </div>
          <div style={{ marginTop: 3, color: 'var(--ink-soft)', fontSize: 11 }}>
            {hoveredItem.count} adet (%{hoveredItem.percentage}) · {hoveredItem.description}
          </div>
        </div>
      )}
    </div>
  )
}

function gapCapable(items: ErrorReasonItem[]): boolean {
  return items.filter((i) => i.count > 0).length === 1
}
