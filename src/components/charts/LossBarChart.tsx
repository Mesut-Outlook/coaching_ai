import { type ChartPalette, DEFAULT_CHART_PALETTE } from './chartPalette'

export interface LossBarItem {
  label: string
  subLabel?: string
  lossNet: number
  totalQuestions?: number
  /** Verilirse çubuk genişliği (0–100) budur; yoksa en büyük kayba oranlanır. */
  barPercent?: number
}

export interface LossBarChartProps {
  items: LossBarItem[]
  palette?: Partial<ChartPalette>
  maxItems?: number
  unit?: string
  onItemClick?: (index: number) => void
  emptyText?: string
}

export default function LossBarChart({
  items,
  palette,
  maxItems = 10,
  unit = 'net',
  onItemClick,
  emptyText = 'Kayıp net verisi bulunmuyor.',
}: LossBarChartProps) {
  const pal = { ...DEFAULT_CHART_PALETTE, ...palette }
  const displayItems = items.slice(0, maxItems)

  if (displayItems.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 12px', color: pal.textMuted, fontSize: 12.5 }}>
        {emptyText}
      </div>
    )
  }

  const maxLoss = Math.max(...displayItems.map((i) => i.lossNet), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      {displayItems.map((item, index) => {
        const percent = Math.min(100, Math.max(4, item.barPercent ?? (item.lossNet / maxLoss) * 100))

        return (
          <Row key={index} onClick={onItemClick ? () => onItemClick(index) : undefined}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, overflow: 'hidden' }}>
                <span
                  style={{
                    fontWeight: 600,
                    color: pal.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </span>
                {item.subLabel && (
                  <span style={{ fontSize: 10.5, color: pal.textMuted, flexShrink: 0 }}>
                    ({item.subLabel})
                  </span>
                )}
              </div>

              <div style={{ fontWeight: 700, color: pal.critical, fontSize: 12.5, flexShrink: 0, marginLeft: 8 }}>
                -{item.lossNet.toFixed(2).replace('.', ',')} {unit}
              </div>
            </div>

            {/* Yatay Çubuk */}
            <div
              style={{
                width: '100%',
                height: 8,
                background: 'var(--surface-alt)',
                borderRadius: 4,
                overflow: 'hidden',
                border: `1px solid ${pal.border}`,
              }}
            >
              <div
                style={{
                  width: `${percent}%`,
                  height: '100%',
                  background: pal.critical,
                  borderRadius: 3,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </Row>
        )
      })}
    </div>
  )
}

function Row({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  const base: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }
  if (!onClick) return <div style={base}>{children}</div>
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...base, background: 'none', border: 0, padding: '4px 0', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%' }}
    >
      {children}
    </button>
  )
}
