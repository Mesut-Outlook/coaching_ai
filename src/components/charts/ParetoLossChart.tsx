import { useState } from 'react'
import type { ParetoLossData } from '../../lib/report360Core'
import { AlertTriangle, Plus } from 'lucide-react'

export interface ParetoLossChartProps {
  data: ParetoLossData
  unit?: string
  onAddToProgram?: (curriculumTopicId: number, topicName: string) => void
}

export default function ParetoLossChart({
  data,
  unit = 'net',
  onAddToProgram,
}: ParetoLossChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const { bars, otherBar, totalLossNet, summaryText } = data

  if (bars.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: 'center',
          color: 'var(--ink-faint)',
          fontSize: 12.5,
          background: 'var(--surface-alt)',
          borderRadius: 8,
          border: '1px dashed var(--border-soft)',
        }}
      >
        Son denemelerde net kaybı tespit edilmedi.
      </div>
    )
  }

  const maxLoss = Math.max(...bars.map((b) => b.lossNet), otherBar?.lossNet || 1)

  return (
    <div
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
      {/* Başlık ve Pareto Özeti */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
            <AlertTriangle size={16} style={{ color: 'var(--critical)' }} />
            <span>Net Kaybı Pareto Analizi (80/20)</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--critical-text)', fontWeight: 600, marginTop: 3 }}>
            {summaryText} (Toplam Kayıp: -{totalLossNet.toFixed(2).replace('.', ',')} {unit})
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--ink-soft)', background: 'var(--surface-alt)', padding: '4px 8px', borderRadius: 6 }}>
          Kritik Eşik: ≤ %60
        </div>
      </div>

      {/* Çubuk Listesi */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bars.map((item, idx) => {
          const widthPct = Math.min(100, Math.max(6, (item.lossNet / maxLoss) * 100))
          const isHovered = hoveredIdx === idx

          return (
            <div
              key={item.examTopicId}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: '6px 8px',
                borderRadius: 6,
                background: isHovered ? 'var(--surface-alt)' : 'transparent',
                transition: 'background 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: item.isCritical ? 'var(--critical-bg)' : 'var(--measured-bg)',
                      color: item.isCritical ? 'var(--critical-text)' : 'var(--measured-text)',
                      flexShrink: 0,
                    }}
                  >
                    #{idx + 1}
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: 'var(--ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={item.examTopicName}
                  >
                    {item.examTopicName}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                    Σ %{item.cumulativePct}
                  </span>

                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 12,
                      color: item.isCritical ? 'var(--critical)' : 'var(--ink-soft)',
                    }}
                  >
                    -{item.lossNet.toFixed(2).replace('.', ',')} {unit}
                  </span>

                  {item.curriculumTopicId && onAddToProgram && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onAddToProgram(item.curriculumTopicId!, item.examTopicName)}
                      style={{
                        padding: '1px 6px',
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                      title="Bu konuyu programa ekle"
                    >
                      <Plus size={11} /> Ekle
                    </button>
                  )}
                </div>
              </div>

              {/* Yatay İlerleme Çubuğu */}
              <div
                style={{
                  width: '100%',
                  height: 6,
                  background: 'var(--border-soft)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${widthPct}%`,
                    height: '100%',
                    background: item.isCritical ? 'var(--critical)' : 'var(--measured-text)',
                    borderRadius: 3,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          )
        })}

        {/* Diğer N Konu Çubuğu (Varsa) */}
        {otherBar && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '6px 8px',
              borderRadius: 6,
              background: 'var(--surface-alt)',
              opacity: 0.85,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5 }}>
              <span style={{ color: 'var(--ink-soft)', fontStyle: 'italic' }}>
                Diğer {otherBar.topicCount} konu (toplam)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Σ %100</span>
                <span style={{ fontWeight: 700, color: 'var(--ink-soft)' }}>
                  -{otherBar.lossNet.toFixed(2).replace('.', ',')} {unit}
                </span>
              </div>
            </div>

            <div
              style={{
                width: '100%',
                height: 5,
                background: 'var(--border-soft)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, (otherBar.lossNet / maxLoss) * 100)}%`,
                  height: '100%',
                  background: 'var(--ink-faint)',
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
