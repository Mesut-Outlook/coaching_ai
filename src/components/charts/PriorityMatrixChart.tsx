import { useState, useId } from 'react'
import type { PriorityMatrixData, PriorityMatrixPoint, PriorityQuadrant } from '../../lib/report360Core'
import { Target, Plus } from 'lucide-react'

export interface PriorityMatrixChartProps {
  data: PriorityMatrixData
  onAddToProgram?: (curriculumTopicId: number, topicName: string) => void
}

const QUADRANT_LABELS: Record<PriorityQuadrant, { label: string; desc: string; color: string; bg: string }> = {
  hemen_calis: {
    label: 'Hemen Çalış',
    desc: 'Düşük Başarı · Yüksek Soru Ağırlığı',
    color: 'var(--critical-text)',
    bg: 'color-mix(in srgb, var(--critical) 8%, transparent)',
  },
  koru: {
    label: 'Koru',
    desc: 'Yüksek Başarı · Yüksek Soru Ağırlığı',
    color: 'var(--success-text)',
    bg: 'color-mix(in srgb, var(--success) 8%, transparent)',
  },
  hizli_kazanim: {
    label: 'Hızlı Kazanım',
    desc: 'Düşük Başarı · Düşük Soru Ağırlığı',
    color: 'var(--warning-text)',
    bg: 'color-mix(in srgb, var(--warning) 8%, transparent)',
  },
  sonra: {
    label: 'Sonra',
    desc: 'Yüksek Başarı · Düşük Soru Ağırlığı',
    color: 'var(--ink-soft)',
    bg: 'var(--surface-alt)',
  },
}

export default function PriorityMatrixChart({ data, onAddToProgram }: PriorityMatrixChartProps) {
  const { points, medianWeight, allWeightsEqual } = data
  const [hoveredPoint, setHoveredPoint] = useState<PriorityMatrixPoint | null>(null)
  const [selectedQuadrant, setSelectedQuadrant] = useState<PriorityQuadrant | 'all'>('all')
  const chartId = useId()

  if (points.length === 0) {
    return (
      <div
        style={{
        padding: 32,
        textAlign: 'center',
        color: 'var(--ink-faint)',
        fontSize: 13,
        background: 'var(--surface-alt)',
        borderRadius: 10,
        border: '1px dashed var(--border-soft)',
      }}
    >
      Öncelik matrisi için yeterli deneme konusu verisi bulunamadı.
    </div>
  )
}

  // Koordinat sınırları
  const width = 640
  const height = 380
  const padLeft = 45
  const padRight = 30
  const padTop = 30
  const padBottom = 40

  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom

  // y-axis max (ağırlık)
  const maxWeightFound = Math.max(...points.map((p) => p.weight), 1)
  const yMax = Math.ceil(maxWeightFound * 1.2)

  // x: 0..100 (%) -> plotWidth
  const getX = (accuracyPct: number) => padLeft + (Math.max(0, Math.min(100, accuracyPct)) / 100) * plotWidth
  // y: 0..yMax -> plotHeight (ters: üstte yüksek)
  const getY = (w: number) => padTop + plotHeight - (Math.max(0, Math.min(yMax, w)) / yMax) * plotHeight

  // Eşik koordinatları
  const thresholdX = getX(70) // %70 başarı eşiği
  const thresholdY = getY(medianWeight) // medyan soru ağırlığı eşiği

  // Top 6 öncelikli konular
  const topPoints = points.filter((p) => p.isTopPriority)

  const filteredPoints = selectedQuadrant === 'all'
    ? points
    : points.filter((p) => p.quadrant === selectedQuadrant)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 16,
        background: 'var(--surface)',
        borderRadius: 10,
        border: '1px solid var(--border-soft)',
      }}
    >
      {/* Başlık ve Filtre Seçicisi */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
            <Target size={16} style={{ color: 'var(--indigo-600)' }} />
            <span>Konu Öncelik Matrisi (B3)</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
            {allWeightsEqual
              ? `x: Başarı (%70 eşiği) · Tüm konuların soru ağırlığı eşit (${medianWeight.toFixed(1).replace('.', ',')} soru); başarıya göre 2 bölge (Hemen Çalış / Koru)`
              : `x: Başarı (%70 eşiği) · y: Soru Ağırlığı (medyan: ${medianWeight.toFixed(1).replace('.', ',')} soru)`}
          </div>
        </div>

        {/* Bölge Butonları */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(['all', 'hemen_calis', 'hizli_kazanim', 'koru', 'sonra'] as const).map((qKey) => {
            const isSelected = selectedQuadrant === qKey
            const count = qKey === 'all' ? points.length : points.filter((p) => p.quadrant === qKey).length
            const label = qKey === 'all' ? 'Tümü' : QUADRANT_LABELS[qKey].label

            return (
              <button
                key={qKey}
                type="button"
                onClick={() => setSelectedQuadrant(qKey)}
                style={{
                  fontSize: 11,
                  fontWeight: isSelected ? 600 : 500,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: isSelected ? '1px solid var(--indigo-600)' : '1px solid var(--border-soft)',
                  background: isSelected ? 'var(--indigo-50)' : 'var(--surface)',
                  color: isSelected ? 'var(--indigo-600)' : 'var(--ink-soft)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* SVG Grafiği */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 380 }}
        >
          {/* Bölge Arka Planları */}
          {/* Sol Üst: HEMEN ÇALIŞ */}
          <rect
            x={padLeft}
            y={padTop}
            width={Math.max(0, thresholdX - padLeft)}
            height={Math.max(0, thresholdY - padTop)}
            fill="var(--critical)"
            fillOpacity={0.05}
          />
          {/* Sağ Üst: KORU */}
          <rect
            x={thresholdX}
            y={padTop}
            width={Math.max(0, padLeft + plotWidth - thresholdX)}
            height={Math.max(0, thresholdY - padTop)}
            fill="var(--success)"
            fillOpacity={0.05}
          />
          {/* Sol Alt: HIZLI KAZANIM */}
          <rect
            x={padLeft}
            y={thresholdY}
            width={Math.max(0, thresholdX - padLeft)}
            height={Math.max(0, padTop + plotHeight - thresholdY)}
            fill="var(--warning)"
            fillOpacity={0.05}
          />
          {/* Sağ Alt: SONRA */}
          <rect
            x={thresholdX}
            y={thresholdY}
            width={Math.max(0, padLeft + plotWidth - thresholdX)}
            height={Math.max(0, padTop + plotHeight - thresholdY)}
            fill="var(--ink-faint)"
            fillOpacity={0.03}
          />

          {/* Bölge İsimleri Filigranı */}
          <text
            x={padLeft + 12}
            y={padTop + 20}
            fill="var(--critical-text)"
            fontSize="10"
            fontWeight="700"
            letterSpacing="0.5"
            opacity={0.6}
          >
            HEMEN ÇALIŞ
          </text>
          <text
            x={padLeft + plotWidth - 12}
            y={padTop + 20}
            textAnchor="end"
            fill="var(--success-text)"
            fontSize="10"
            fontWeight="700"
            letterSpacing="0.5"
            opacity={0.6}
          >
            KORU
          </text>
          <text
            x={padLeft + 12}
            y={padTop + plotHeight - 12}
            fill="var(--warning-text)"
            fontSize="10"
            fontWeight="700"
            letterSpacing="0.5"
            opacity={0.6}
          >
            HIZLI KAZANIM
          </text>
          <text
            x={padLeft + plotWidth - 12}
            y={padTop + plotHeight - 12}
            textAnchor="end"
            fill="var(--ink-faint)"
            fontSize="10"
            fontWeight="700"
            letterSpacing="0.5"
            opacity={0.6}
          >
            SONRA
          </text>

          {/* Eksen Izgaraları & Eşik Çizgileri */}
          {/* Dikey Eşik (Başarı %70) */}
          <line
            x1={thresholdX}
            y1={padTop}
            x2={thresholdX}
            y2={padTop + plotHeight}
            stroke="var(--border)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          {/* Yatay Eşik (Ağırlık Medyan - yalnızca ağırlıklar farklıysa çizilir) */}
          {!allWeightsEqual && (
            <line
              x1={padLeft}
              y1={thresholdY}
              x2={padLeft + plotWidth}
              y2={thresholdY}
              stroke="var(--border)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          )}

          {/* Eksen Çizgileri */}
          <line
            x1={padLeft}
            y1={padTop + plotHeight}
            x2={padLeft + plotWidth}
            y2={padTop + plotHeight}
            stroke="var(--border)"
            strokeWidth="1"
          />
          <line
            x1={padLeft}
            y1={padTop}
            x2={padLeft}
            y2={padTop + plotHeight}
            stroke="var(--border)"
            strokeWidth="1"
          />

          {/* Eksen Etiketleri */}
          {/* x-axis (%0, %25, %50, %70, %100) */}
          {[0, 25, 50, 70, 100].map((val) => {
            const x = getX(val)
            return (
              <g key={`x-${val}`}>
                <text
                  x={x}
                  y={padTop + plotHeight + 16}
                  textAnchor="middle"
                  fontSize="10"
                  fill={val === 70 ? 'var(--indigo-600)' : 'var(--ink-faint)'}
                  fontWeight={val === 70 ? '700' : '400'}
                >
                  %{val}
                </text>
              </g>
            )
          })}
          <text
            x={padLeft + plotWidth / 2}
            y={height - 6}
            textAnchor="middle"
            fontSize="11"
            fill="var(--ink-soft)"
            fontWeight="600"
          >
            Öğrenci Başarı Oranı (%)
          </text>

          {/* y-axis (Soru ağırlığı) */}
          {[0, medianWeight, yMax].map((val, idx) => {
            const y = getY(val)
            return (
              <g key={`y-${idx}`}>
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill={val === medianWeight ? 'var(--indigo-600)' : 'var(--ink-faint)'}
                  fontWeight={val === medianWeight ? '700' : '400'}
                >
                  {val.toFixed(1).replace('.', ',')}
                </text>
              </g>
            )
          })}
          <text
            transform={`rotate(-90 ${padLeft - 28} ${padTop + plotHeight / 2})`}
            x={padLeft - 28}
            y={padTop + plotHeight / 2}
            textAnchor="middle"
            fontSize="11"
            fill="var(--ink-soft)"
            fontWeight="600"
          >
            Soru Ağırlığı (Ort.)
          </text>

          {/* Konu Noktaları */}
          {filteredPoints.map((p) => {
            const cx = getX(p.accuracyPct)
            const cy = getY(p.weight)
            const isHovered = hoveredPoint?.examTopicId === p.examTopicId
            const radius = p.isTopPriority ? 7 : 5

            return (
              <g
                key={`${chartId}-pt-${p.examTopicId}`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredPoint(p)}
                onClick={() => {
                  if (p.curriculumTopicId && onAddToProgram) {
                    onAddToProgram(p.curriculumTopicId, p.examTopicName)
                  }
                }}
              >
                {/* Top 6 Hare/Aura */}
                {p.isTopPriority && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={radius + 4}
                    fill={p.colorToken || 'var(--indigo-600)'}
                    fillOpacity={0.2}
                  />
                )}

                {/* Ana Nokta */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={p.colorToken || 'var(--indigo-600)'}
                  stroke={isHovered ? 'var(--ink)' : '#ffffff'}
                  strokeWidth={isHovered ? 2 : 1.5}
                />
              </g>
            )
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              top: Math.max(8, getY(hoveredPoint.weight) - 75),
              left: Math.min(width - 220, Math.max(10, getX(hoveredPoint.accuracyPct) - 100)),
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
              fontSize: 12,
              pointerEvents: 'auto',
              zIndex: 10,
              minWidth: 200,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{hoveredPoint.examTopicName}</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: QUADRANT_LABELS[hoveredPoint.quadrant].bg,
                  color: QUADRANT_LABELS[hoveredPoint.quadrant].color,
                }}
              >
                {QUADRANT_LABELS[hoveredPoint.quadrant].label}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
              {hoveredPoint.subjectName} · Başarı: %{hoveredPoint.accuracyPct.toFixed(0)} · Ağırlık: {hoveredPoint.weight.toFixed(1).replace('.', ',')} soru
            </div>

            {hoveredPoint.curriculumTopicId && onAddToProgram && (
              <button
                type="button"
                onClick={() => {
                  onAddToProgram(hoveredPoint.curriculumTopicId!, hoveredPoint.examTopicName)
                }}
                style={{
                  marginTop: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: 'var(--indigo-50)',
                  color: 'var(--indigo-600)',
                  border: '1px solid var(--indigo-200)',
                  cursor: 'pointer',
                }}
              >
                <Plus size={12} /> Programa Ekle
              </button>
            )}
          </div>
        )}
      </div>

      {/* Öncelikli 6 Konu Listesi */}
      {topPoints.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-soft)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
            🎯 En Yüksek Öncelikli {topPoints.length} Konu (Öncelik Puanı = Soru Ağırlığı × (1 − Başarı))
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {topPoints.map((item, idx) => {
              const qInfo = QUADRANT_LABELS[item.quadrant]
              return (
                <div
                  key={item.examTopicId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--surface-alt)',
                    border: '1px solid var(--border-soft)',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: 'var(--indigo-100)',
                        color: 'var(--indigo-700)',
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.examTopicName}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>
                        {item.subjectName} · Başarı: %{item.accuracyPct.toFixed(0)} · Ort: {item.weight.toFixed(1).replace('.', ',')} soru
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: qInfo.bg,
                        color: qInfo.color,
                      }}
                    >
                      {qInfo.label}
                    </span>

                    {item.curriculumTopicId && onAddToProgram && (
                      <button
                        type="button"
                        onClick={() => onAddToProgram(item.curriculumTopicId!, item.examTopicName)}
                        title="Haftalık Programa Ekle"
                        style={{
                          padding: '4px 6px',
                          borderRadius: 4,
                          background: 'var(--surface)',
                          border: '1px solid var(--border-soft)',
                          color: 'var(--indigo-600)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <Plus size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
