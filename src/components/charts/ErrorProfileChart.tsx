import { useState, useId } from 'react'
import type { ErrorProfileData, ErrorProfilePoint, ErrorQuadrant } from '../../lib/report360Core'
import { AlertCircle, CheckCircle2, ShieldAlert, Timer } from 'lucide-react'

export interface ErrorProfileChartProps {
  data: ErrorProfileData
}

const QUADRANT_CONFIG: Record<
  ErrorQuadrant,
  {
    title: string
    subtitle: string
    color: string
    bg: string
    border: string
    icon: typeof AlertCircle
    defaultSuggestion: string
  }
> = {
  saglam: {
    title: 'Sağlam',
    subtitle: 'Yanlış < %15 · Boş < %15',
    color: 'var(--success-text)',
    bg: 'color-mix(in srgb, var(--success) 6%, transparent)',
    border: 'color-mix(in srgb, var(--success) 30%, transparent)',
    icon: CheckCircle2,
    defaultSuggestion: 'Performans dengeli, düzenli deneme temposunu koru.',
  },
  riskli_isaretleme: {
    title: 'Riskli İşaretleme',
    subtitle: 'Yanlış ≥ %15 · Boş < %15',
    color: 'var(--warning-text)',
    bg: 'color-mix(in srgb, var(--warning) 6%, transparent)',
    border: 'color-mix(in srgb, var(--warning) 30%, transparent)',
    icon: ShieldAlert,
    defaultSuggestion: 'Emin olmadığın sorularda eleme yapmadan işaretleme yapma.',
  },
  sure_strateji: {
    title: 'Süre / Strateji',
    subtitle: 'Yanlış < %15 · Boş ≥ %15',
    color: 'var(--measured-text)',
    bg: 'color-mix(in srgb, var(--indigo-600) 6%, transparent)',
    border: 'color-mix(in srgb, var(--indigo-600) 30%, transparent)',
    icon: Timer,
    defaultSuggestion: 'Turlama tekniğini uygula ve süreli branş denemesi çöz.',
  },
  konu_eksigi: {
    title: 'Konu Eksiği',
    subtitle: 'Yanlış ≥ %15 · Boş ≥ %15',
    color: 'var(--critical-text)',
    bg: 'color-mix(in srgb, var(--critical) 6%, transparent)',
    border: 'color-mix(in srgb, var(--critical) 30%, transparent)',
    icon: AlertCircle,
    defaultSuggestion: 'Temel kavram tekrarları ve konu kavrama testlerine öncelik ver.',
  },
}

export default function ErrorProfileChart({ data }: ErrorProfileChartProps) {
  const { points } = data
  const [hoveredSection, setHoveredSection] = useState<ErrorProfilePoint | null>(null)
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
        Hata profili analizi için son denemelerde ders verisi bulunamadı.
      </div>
    )
  }

  // Koordinat sınırları
  const width = 500
  const height = 320
  const padLeft = 45
  const padRight = 30
  const padTop = 30
  const padBottom = 40

  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom

  // Eksenler 0..40% aralığında (maksimum nokta 40%'ı aşarsa dinamik ölçeklensin)
  const maxVal = Math.max(
    30,
    ...points.map((p) => Math.max(p.wrongRatePct, p.blankRatePct))
  )
  const axisMax = Math.ceil((maxVal * 1.15) / 5) * 5 // 5'in katı

  // x: Yanlış Oranı (0..axisMax) -> plotWidth
  const getX = (wrongPct: number) =>
    padLeft + (Math.max(0, Math.min(axisMax, wrongPct)) / axisMax) * plotWidth
  // y: Boş Oranı (0..axisMax) -> plotHeight (ters: üstte yüksek boş oranı)
  const getY = (blankPct: number) =>
    padTop + plotHeight - (Math.max(0, Math.min(axisMax, blankPct)) / axisMax) * plotHeight

  // Eşikler (15% Yanlış, 15% Boş)
  const thresholdX = getX(15)
  const thresholdY = getY(15)

  // Bölgeye göre gruplanmış noktalar
  const grouped: Record<ErrorQuadrant, ErrorProfilePoint[]> = {
    saglam: points.filter((p) => p.quadrant === 'saglam'),
    riskli_isaretleme: points.filter((p) => p.quadrant === 'riskli_isaretleme'),
    sure_strateji: points.filter((p) => p.quadrant === 'sure_strateji'),
    konu_eksigi: points.filter((p) => p.quadrant === 'konu_eksigi'),
  }

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
      {/* Başlık */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
            <AlertCircle size={16} style={{ color: 'var(--critical)' }} />
            <span>Ders Hata Profili (B5)</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
            Son 3 deneme ders bazında Yanlış / Boş dağılımı (Kritik Eşik: %15)
          </div>
        </div>
      </div>

      {/* SVG Grafiği ve Yan Kartlar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1.2fr) minmax(240px, 1fr)', gap: 16, alignItems: 'start' }}>
        {/* Sol: 2x2 Koordinat Dağılımı */}
        <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 320 }}
          >
            {/* Bölgeler Arka Planları */}
            {/* Sol Alt: SAĞLAM */}
            <rect
              x={padLeft}
              y={thresholdY}
              width={Math.max(0, thresholdX - padLeft)}
              height={Math.max(0, padTop + plotHeight - thresholdY)}
              fill="var(--success)"
              fillOpacity={0.06}
            />
            {/* Sağ Alt: RİSKLİ İŞARETLEME */}
            <rect
              x={thresholdX}
              y={thresholdY}
              width={Math.max(0, padLeft + plotWidth - thresholdX)}
              height={Math.max(0, padTop + plotHeight - thresholdY)}
              fill="var(--warning)"
              fillOpacity={0.06}
            />
            {/* Sol Üst: SÜRE / STRATEJİ */}
            <rect
              x={padLeft}
              y={padTop}
              width={Math.max(0, thresholdX - padLeft)}
              height={Math.max(0, thresholdY - padTop)}
              fill="var(--indigo-600)"
              fillOpacity={0.05}
            />
            {/* Sağ Üst: KONU EKSİĞİ */}
            <rect
              x={thresholdX}
              y={padTop}
              width={Math.max(0, padLeft + plotWidth - thresholdX)}
              height={Math.max(0, thresholdY - padTop)}
              fill="var(--critical)"
              fillOpacity={0.06}
            />

            {/* Bölge İsimleri Filigranı */}
            <text
              x={padLeft + 10}
              y={padTop + plotHeight - 12}
              fill="var(--success-text)"
              fontSize="10"
              fontWeight="700"
              opacity={0.7}
            >
              SAĞLAM
            </text>
            <text
              x={padLeft + plotWidth - 10}
              y={padTop + plotHeight - 12}
              textAnchor="end"
              fill="var(--warning-text)"
              fontSize="10"
              fontWeight="700"
              opacity={0.7}
            >
              RİSKLİ İŞARETLEME
            </text>
            <text
              x={padLeft + 10}
              y={padTop + 20}
              fill="var(--measured-text)"
              fontSize="10"
              fontWeight="700"
              opacity={0.7}
            >
              SÜRE / STRATEJİ
            </text>
            <text
              x={padLeft + plotWidth - 10}
              y={padTop + 20}
              textAnchor="end"
              fill="var(--critical-text)"
              fontSize="10"
              fontWeight="700"
              opacity={0.7}
            >
              KONU EKSİĞİ
            </text>

            {/* %15 Eşik Çizgileri */}
            <line
              x1={thresholdX}
              y1={padTop}
              x2={thresholdX}
              y2={padTop + plotHeight}
              stroke="var(--border)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <line
              x1={padLeft}
              y1={thresholdY}
              x2={padLeft + plotWidth}
              y2={thresholdY}
              stroke="var(--border)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />

            {/* Eksenler */}
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

            {/* x-axis etiketleri (Yanlış Oranı) */}
            {[0, 15, axisMax].map((val) => {
              const x = getX(val)
              return (
                <g key={`x-${val}`}>
                  <text
                    x={x}
                    y={padTop + plotHeight + 16}
                    textAnchor="middle"
                    fontSize="10"
                    fill={val === 15 ? 'var(--indigo-600)' : 'var(--ink-faint)'}
                    fontWeight={val === 15 ? '700' : '400'}
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
              Yanlış Oranı (Y / S)
            </text>

            {/* y-axis etiketleri (Boş Oranı) */}
            {[0, 15, axisMax].map((val) => {
              const y = getY(val)
              return (
                <g key={`y-${val}`}>
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill={val === 15 ? 'var(--indigo-600)' : 'var(--ink-faint)'}
                    fontWeight={val === 15 ? '700' : '400'}
                  >
                    %{val}
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
              Boş Oranı (B / S)
            </text>

            {/* Ders Noktaları */}
            {points.map((p, idx) => {
              const cx = getX(p.wrongRatePct)
              const cy = getY(p.blankRatePct)
              const isHovered = hoveredSection?.sectionName === p.sectionName

              return (
                <g
                  key={`${chartId}-err-${idx}`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredSection(p)}
                  onMouseLeave={() => setHoveredSection(null)}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 8 : 6}
                    fill="var(--indigo-600)"
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                  {/* Kısa Ders Adı */}
                  <text
                    x={cx}
                    y={cy - 10}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill="var(--ink)"
                  >
                    {p.sectionName.split(' ')[0]}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Hover Tooltip */}
          {hoveredSection && (
            <div
              style={{
                position: 'absolute',
                top: Math.max(8, getY(hoveredSection.blankRatePct) - 65),
                left: Math.min(width - 200, Math.max(10, getX(hoveredSection.wrongRatePct) - 80)),
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 12px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                fontSize: 12,
                pointerEvents: 'none',
                zIndex: 10,
                minWidth: 160,
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{hoveredSection.sectionName}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                Doğru: %{hoveredSection.correctRatePct.toFixed(0)} · Yanlış: %{hoveredSection.wrongRatePct.toFixed(0)} · Boş: %{hoveredSection.blankRatePct.toFixed(0)}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: QUADRANT_CONFIG[hoveredSection.quadrant].color, marginTop: 4 }}>
                {QUADRANT_CONFIG[hoveredSection.quadrant].title}
              </div>
            </div>
          )}
        </div>

        {/* Sağ: 4 Bölge Kartları & Koçluk Önerileri */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(['saglam', 'riskli_isaretleme', 'sure_strateji', 'konu_eksigi'] as const).map((qKey) => {
            const cfg = QUADRANT_CONFIG[qKey]
            const items = grouped[qKey]
            const Icon = cfg.icon

            return (
              <div
                key={qKey}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={14} style={{ color: cfg.color }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>
                      {cfg.title}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}>
                    {cfg.subtitle}
                  </span>
                </div>

                {/* Bu Bölgedeki Dersler */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                  {items.length === 0 ? (
                    <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                      Bu bölgede ders yok
                    </span>
                  ) : (
                    items.map((sec) => (
                      <span
                        key={sec.sectionName}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'var(--surface)',
                          color: 'var(--ink)',
                          border: '1px solid var(--border-soft)',
                        }}
                      >
                        {sec.sectionName} (Y: %{sec.wrongRatePct.toFixed(0)} · B: %{sec.blankRatePct.toFixed(0)})
                      </span>
                    ))
                  )}
                </div>

                {/* Koçluk Önerisi */}
                <div style={{ fontSize: 11, color: 'var(--ink)', marginTop: 2 }}>
                  💡 <em>{items[0]?.suggestion || cfg.defaultSuggestion}</em>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
