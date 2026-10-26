import { useState } from 'react'
import type { TargetTrajectoryData } from '../../lib/report360Core'
import { TrendingUp, Calendar, AlertCircle } from 'lucide-react'

function formatDateShortTr(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export interface TargetTrajectoryChartProps {
  data: TargetTrajectoryData
  height?: number
  unit?: string
  onSetTargetNet?: () => void
}

export default function TargetTrajectoryChart({
  data,
  height = 240,
  unit = 'net',
  onSetTargetNet,
}: TargetTrajectoryChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const { examPoints, targetNet, prediction, examDate } = data

  if (examPoints.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 30,
          background: 'var(--surface-alt)',
          borderRadius: 10,
          border: '1px dashed var(--border-soft)',
          color: 'var(--ink-soft)',
          minHeight: height,
          fontSize: 12.5,
        }}
      >
        <AlertCircle size={24} style={{ color: 'var(--ink-faint)', marginBottom: 8 }} />
        <span>Bu sınav türünde henüz girilmiş deneme kaydı bulunmuyor.</span>
      </div>
    )
  }

  if (!prediction.canPredict || examPoints.length < 3) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          <TrendingUp size={16} style={{ color: 'var(--indigo-600)' }} />
          <span>Hedef Yolu & Net Trendi</span>
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
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            Tahmin için en az 3 deneme gereklidir (şu an {examPoints.length}).
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 4 }}>
            Mevcut denemeler: {examPoints.map((e) => `${e.name}: ${e.net} ${unit}`).join(' · ')}
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // SVG Koordinat Hesaplamaları
  // -------------------------------------------------------------------------
  const width = 640
  const padLeft = 48
  const padRight = 48
  const padTop = 32
  const padBottom = 36
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom

  const firstDateMs = new Date(examPoints[0].date).getTime()
  const lastExamDateMs = new Date(examPoints[examPoints.length - 1].date).getTime()
  let targetDateMs = examDate ? new Date(examDate).getTime() : lastExamDateMs + 84 * 86400000
  if (targetDateMs <= lastExamDateMs) {
    targetDateMs = lastExamDateMs + 30 * 86400000
  }

  const totalDays = Math.max(1, Math.round((targetDateMs - firstDateMs) / 86400000))

  // Y ekseni min / max
  const maxAllowed = data.maxNet ?? (targetNet ? Math.max(targetNet, 120) : 120)
  const allNets = examPoints.map((e) => e.net)
  if (targetNet !== null) allNets.push(Math.min(maxAllowed, targetNet))
  if (prediction.predictedNetAtExam !== undefined) {
    const pNet = prediction.predictedNetAtExam
    allNets.push(pNet)
    const band = prediction.confidenceBandWidth || 3
    allNets.push(Math.max(0, pNet - band))
    allNets.push(Math.min(maxAllowed, pNet + band))
  }

  const minVal = Math.min(...allNets)
  const maxVal = Math.min(maxAllowed, Math.max(...allNets))
  const marginY = Math.max(3, (maxVal - minVal) * 0.15)
  const yMin = Math.max(0, Math.floor(minVal - marginY))
  const yMax = Math.min(maxAllowed, Math.ceil(maxVal + marginY))
  const yRange = yMax - yMin || 1

  const getX = (dateMs: number) => {
    const days = Math.max(0, Math.round((dateMs - firstDateMs) / 86400000))
    return padLeft + (days / totalDays) * plotW
  }

  const getY = (val: number) => {
    return padTop + plotH - ((val - yMin) / yRange) * plotH
  }

  // Gerçek deneme noktaları
  const points = examPoints.map((e) => ({
    ...e,
    cx: getX(new Date(e.date).getTime()),
    cy: getY(e.net),
  }))

  const polylineStr = points.map((p) => `${p.cx},${p.cy}`).join(' ')

  // Tahmin uzantısı (Son denemeden sınav tarihine)
  const lastPoint = points[points.length - 1]
  const targetX = getX(targetDateMs)
  const targetY = getY(prediction.predictedNetAtExam || lastPoint.net)
  const bandW = prediction.confidenceBandWidth || 3.0
  const bandTopNet = Math.min(maxAllowed, (prediction.predictedNetAtExam || lastPoint.net) + bandW)
  const bandBottomNet = Math.max(0, (prediction.predictedNetAtExam || lastPoint.net) - bandW)
  const bandTopY = getY(bandTopNet)
  const bandBottomY = getY(bandBottomNet)

  const bandPolygonStr = `${lastPoint.cx},${lastPoint.cy} ${targetX},${bandTopY} ${targetX},${bandBottomY}`

  // Hedef çizgisi
  const targetLineY = targetNet !== null ? getY(targetNet) : null

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
      {/* Başlık ve Cümlelik Özet */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
            <TrendingUp size={16} style={{ color: 'var(--indigo-600)' }} />
            <span>Hedef Yolu & Sınav Tahmini</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--indigo-700)', fontWeight: 600, marginTop: 3 }}>
            {prediction.summaryText}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {targetNet === null && onSetTargetNet && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onSetTargetNet}
              style={{ fontSize: 11, color: 'var(--primary)', padding: '2px 8px' }}
            >
              Hedef Belirle
            </button>
          )}

          {examDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-soft)' }}>
              <Calendar size={13} />
              <span>Sınav: {formatDateShortTr(examDate)}</span>
            </div>
          )}
        </div>
      </div>

      {/* SVG Grafiği */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="bandGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--indigo-500)" stopOpacity="0.05" />
              <stop offset="100%" stopColor="var(--indigo-500)" stopOpacity="0.18" />
            </linearGradient>
          </defs>

          {/* Yatay Kılavuz Çizgileri */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const v = Math.round(yMin + ratio * yRange)
            const y = padTop + plotH - ratio * plotH
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="var(--border-soft)"
                  strokeDasharray="2 3"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  fontSize={10}
                  fill="var(--ink-faint)"
                  textAnchor="end"
                  fontFamily="system-ui, sans-serif"
                >
                  {v}
                </text>
              </g>
            )
          })}

          {/* Belirsizlik Bandı (Prediction Confidence Band) */}
          <polygon points={bandPolygonStr} fill="url(#bandGradient)" />

          {/* Hedef Net Çizgisi (Varsa) */}
          {targetLineY !== null && (
            <g>
              <line
                x1={padLeft}
                y1={targetLineY}
                x2={width - padRight}
                y2={targetLineY}
                stroke="var(--teal-text, #0D9488)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              <text
                x={width - padRight + 4}
                y={targetLineY + 3.5}
                fontSize={10}
                fontWeight={700}
                fill="var(--teal-text, #0D9488)"
                fontFamily="system-ui, sans-serif"
              >
                Hedef {targetNet}
              </text>
            </g>
          )}

          {/* Regresyon Tahmin Çizgisi (Kesikli Çizgi) */}
          <line
            x1={lastPoint.cx}
            y1={lastPoint.cy}
            x2={targetX}
            y2={targetY}
            stroke="var(--indigo-500)"
            strokeWidth={1.75}
            strokeDasharray="3 3"
          />

          {/* Sınav Günü Tahmin Noktası */}
          <circle cx={targetX} cy={targetY} r={4.5} fill="var(--indigo-600)" stroke="var(--surface)" strokeWidth={1.5}>
            <title>{`Sınav Tahmini: ~${prediction.predictedNetAtExam?.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${unit} (±${bandW.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} net)`}</title>
          </circle>
          <text
            x={targetX}
            y={targetY - 8}
            fontSize={10}
            fontWeight={800}
            fill="var(--indigo-600)"
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
          >
            ~{prediction.predictedNetAtExam?.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </text>

          {/* Gerçek Deneme Eğrisi */}
          <polyline
            fill="none"
            stroke="var(--indigo-600)"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylineStr}
          />

          {/* Deneme Noktaları */}
          {points.map((p, idx) => {
            const isHovered = hoveredIdx === idx
            return (
              <g
                key={p.id}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={p.cx}
                  cy={p.cy}
                  r={isHovered ? 5.5 : 3.5}
                  fill="var(--surface)"
                  stroke="var(--indigo-600)"
                  strokeWidth={2}
                >
                  <title>{`${p.name} (${p.date}): ${p.net} ${unit}`}</title>
                </circle>
                {isHovered && (
                  <text
                    x={p.cx}
                    y={p.cy - 9}
                    fontSize={11}
                    fontWeight={700}
                    fill="var(--ink)"
                    textAnchor="middle"
                    fontFamily="system-ui, sans-serif"
                  >
                    {p.net}
                  </text>
                )}
              </g>
            )
          })}

          {/* X Ekseni Tarih Etiketleri */}
          <text
            x={points[0].cx}
            y={height - 10}
            fontSize={10}
            fill="var(--ink-faint)"
            textAnchor="start"
            fontFamily="system-ui, sans-serif"
          >
            {formatDateShortTr(examPoints[0].date)}
          </text>

          <text
            x={targetX}
            y={height - 10}
            fontSize={10}
            fontWeight={600}
            fill="var(--ink-soft)"
            textAnchor="end"
            fontFamily="system-ui, sans-serif"
          >
            {examDate ? `Sınav (${formatDateShortTr(examDate)})` : 'Tahmin (+12 hf)'}
          </text>
        </svg>
      </div>
    </div>
  )
}
