import { type ChartPalette, DEFAULT_CHART_PALETTE } from './chartPalette'

export interface StackedBarSection {
  label: string
  correct: number
  wrong: number
  blank: number
  total: number
}

export interface StackedBarChartProps {
  sections: StackedBarSection[]
  palette?: Partial<ChartPalette>
}

export default function StackedBarChart({ sections, palette }: StackedBarChartProps) {
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
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: pal.text }}>{sec.label}</span>
              <span style={{ color: pal.textMuted }}>
                {sec.correct}D · {sec.wrong}Y · {sec.blank}B / {sec.total} soru
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
          </div>
        )
      })}
    </div>
  )
}
