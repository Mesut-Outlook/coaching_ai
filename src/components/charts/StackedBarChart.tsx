import { type ChartPalette, DEFAULT_CHART_PALETTE } from './chartPalette'

export interface StackedBarSection {
  label: string
  correct: number
  wrong: number
  blank: number
  total: number
  /** Verilirse sağ metne 'Net x' eklenir */
  net?: number
}

export interface StackedBarChartProps {
  sections: StackedBarSection[]
  palette?: Partial<ChartPalette>
  onItemClick?: (index: number) => void
}

export default function StackedBarChart({ sections, palette, onItemClick }: StackedBarChartProps) {
  const pal = { ...DEFAULT_CHART_PALETTE, ...palette }

  if (sections.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 12px', color: pal.textMuted, fontSize: 12.5 }}>
        Bölüm dağılım verisi bulunmuyor.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: pal.textMuted, justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: pal.success }} />
          <span>Doğru</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: pal.critical }} />
          <span>Yanlış</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: pal.border }} />
          <span>Boş</span>
        </div>
      </div>

      {/* Rows */}
      {sections.map((sec, i) => {
        const total = sec.total || 1
        const correctPct = (sec.correct / total) * 100
        const wrongPct = (sec.wrong / total) * 100
        const blankPct = (sec.blank / total) * 100

        return (
          <Row key={i} onClick={onItemClick ? () => onItemClick(i) : undefined}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: pal.text }}>{sec.label}</span>
              <span style={{ color: pal.textMuted }}>
                {sec.correct}D · {sec.wrong}Y · {sec.blank}B / {sec.total} soru{sec.net != null && ` · Net ${sec.net.toFixed(2).replace('.', ',')}`}
              </span>
            </div>

            {/* Yığılı Çubuk */}
            <div
              style={{
                width: '100%',
                height: 12,
                display: 'flex',
                borderRadius: 4,
                overflow: 'hidden',
                background: 'var(--surface-alt)',
                border: `1px solid ${pal.border}`,
              }}
            >
              {sec.correct > 0 && (
                <div
                  title={`${sec.correct} Doğru`}
                  style={{
                    width: `${correctPct}%`,
                    background: pal.success,
                  }}
                />
              )}
              {sec.wrong > 0 && (
                <div
                  title={`${sec.wrong} Yanlış`}
                  style={{
                    width: `${wrongPct}%`,
                    background: pal.critical,
                  }}
                />
              )}
              {sec.blank > 0 && (
                <div
                  title={`${sec.blank} Boş`}
                  style={{
                    width: `${blankPct}%`,
                    background: 'var(--border)',
                  }}
                />
              )}
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
