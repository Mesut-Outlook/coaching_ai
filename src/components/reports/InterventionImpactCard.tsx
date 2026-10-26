import { useState } from 'react'
import type { InterventionImpactData } from '../../lib/report360Core'
import { Activity, ArrowUpRight, ArrowDownRight, Sparkles, AlertCircle } from 'lucide-react'

export interface InterventionImpactCardProps {
  data: InterventionImpactData
  height?: number
}

export default function InterventionImpactCard({
  data,
  height = 240,
}: InterventionImpactCardProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const { hasEnoughData, items, totalInterventions, improvedCount, summaryText, emptyStateMessage } = data

  if (!hasEnoughData || items.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 16,
          background: 'var(--surface)',
          borderRadius: 10,
          border: '1px solid var(--border-soft)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
          <Activity size={16} style={{ color: 'var(--indigo-600)' }} />
          <span>Müdahale Etkisi (Ödev ➔ Ölçüm Değişimi)</span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 30,
            background: 'var(--surface-alt)',
            borderRadius: 8,
            border: '1px dashed var(--border-soft)',
            textAlign: 'center',
            minHeight: height - 50,
          }}
        >
          <AlertCircle size={24} style={{ color: 'var(--ink-faint)', marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            Henüz tamamlanmış müdahale ölçümü bulunmuyor.
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 4, maxWidth: 440 }}>
            {emptyStateMessage || 'Programa deneme analizinden veya önerilerden eklenen görevler tamamlanıp ardından yeni deneme girildikçe eğim grafiği oluşacaktır.'}
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // SVG Slope Graph Hesaplamaları
  // -------------------------------------------------------------------------
  const width = 580
  const padLeft = 70
  const padRight = 70
  const padTop = 30
  const padBottom = 30
  const plotH = height - padTop - padBottom

  const getY = (accPct: number) => {
    const clamped = Math.max(0, Math.min(100, accPct))
    return padTop + plotH - (clamped / 100) * plotH
  }

  const x1 = padLeft
  const x2 = width - padRight

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        background: 'var(--surface)',
        borderRadius: 10,
        border: '1px solid var(--border-soft)',
      }}
    >
      {/* Başlık ve Özet */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
            <Activity size={16} style={{ color: 'var(--indigo-600)' }} />
            <span>Müdahale Etkisi (Önce ➔ Sonra)</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
            {summaryText}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 10,
              background: 'var(--success-bg, rgba(16, 185, 129, 0.12))',
              color: 'var(--success-text, #047857)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Sparkles size={11} />
            {improvedCount}/{totalInterventions} Yükseldi
          </span>
        </div>
      </div>

      {/* SVG Slope Grafiği */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        >
          {/* Kılavuz Çizgileri (%0, %25, %50, %75, %100) */}
          {[0, 25, 50, 75, 100].map((v) => {
            const y = getY(v)
            return (
              <g key={v}>
                <line
                  x1={x1}
                  y1={y}
                  x2={x2}
                  y2={y}
                  stroke="var(--border-soft)"
                  strokeDasharray="2 3"
                />
                <text
                  x={x1 - 8}
                  y={y + 3.5}
                  fontSize={10}
                  fill="var(--ink-faint)"
                  textAnchor="end"
                  fontFamily="system-ui, sans-serif"
                >
                  %{v}
                </text>
                <text
                  x={x2 + 8}
                  y={y + 3.5}
                  fontSize={10}
                  fill="var(--ink-faint)"
                  textAnchor="start"
                  fontFamily="system-ui, sans-serif"
                >
                  %{v}
                </text>
              </g>
            )
          })}

          {/* Dikey Eksen Başlıkları */}
          <text
            x={x1}
            y={padTop - 12}
            fontSize={11}
            fontWeight="600"
            fill="var(--ink-soft)"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
          >
            Görev Öncesi
          </text>
          <text
            x={x2}
            y={padTop - 12}
            fontSize={11}
            fontWeight="600"
            fill="var(--ink-soft)"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
          >
            Sonraki Ölçüm
          </text>

          {/* Eğim Çizgileri */}
          {items.map((it, idx) => {
            const y1 = getY(it.beforeAccuracyPct)
            const y2 = getY(it.afterAccuracyPct)
            const isHovered = hoveredIdx === idx
            const strokeColor = it.isImproved ? 'var(--success-600, #16a34a)' : 'var(--critical-500, #ef4444)'

            return (
              <g
                key={it.taskId}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={strokeColor}
                  strokeWidth={isHovered ? 3.5 : 2}
                  strokeOpacity={isHovered ? 1 : 0.75}
                />
                {/* Başlangıç ve Bitiş Noktaları */}
                <circle cx={x1} cy={y1} r={isHovered ? 4.5 : 3} fill={strokeColor} />
                <circle cx={x2} cy={y2} r={isHovered ? 5 : 3.5} fill={strokeColor} />
              </g>
            )
          })}
        </svg>
      </div>

      {/* Konu Listesi ve Rozetler */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
        {items.map((it, idx) => {
          const isHovered = hoveredIdx === idx
          return (
            <div
              key={it.taskId}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: 6,
                background: isHovered ? 'var(--surface-hover)' : 'var(--surface-alt)',
                border: '1px solid var(--border-soft)',
                fontSize: 12,
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                {it.isImproved ? (
                  <ArrowUpRight size={15} style={{ color: 'var(--success-text, #047857)', flexShrink: 0 }} />
                ) : (
                  <ArrowDownRight size={15} style={{ color: 'var(--critical-text, #b91c1c)', flexShrink: 0 }} />
                )}
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                  {it.topicName}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                  ({it.subjectName})
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                  %{it.beforeAccuracyPct} ➔ %{it.afterAccuracyPct} ({it.deltaPct > 0 ? `+${it.deltaPct}` : it.deltaPct}%)
                </span>

                {it.needsDifferentMethod ? (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'var(--critical-bg, rgba(239, 68, 68, 0.12))',
                      color: 'var(--critical-text, #b91c1c)',
                    }}
                  >
                    Farklı yöntem dene
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'var(--success-bg, rgba(16, 185, 129, 0.12))',
                      color: 'var(--success-text, #047857)',
                    }}
                  >
                    Gelişme sağlandı
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
