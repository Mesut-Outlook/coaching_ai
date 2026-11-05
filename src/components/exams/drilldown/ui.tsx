import type { ReactNode } from 'react'
import type { MasteryBand } from '../../../lib/examReport'
import type { ChartPalette } from '../../charts/chartPalette'
import type { DrillRole } from './types'

export function Stat({ k, v, s, pal }: { k: string; v: ReactNode; s?: string; pal: ChartPalette }) {
  return (
    <div style={{ background: 'var(--surface-alt)', border: `1px solid ${pal.border}`, borderRadius: 10, padding: '10px 12px', minWidth: 0 }}>
      <div style={{ fontSize: 11, color: pal.textMuted, fontWeight: 600 }}>{k}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: pal.text, letterSpacing: '-0.01em' }}>
        {v}
        {s && <small style={{ fontSize: 11.5, fontWeight: 500, color: pal.textMuted, marginLeft: 5 }}>{s}</small>}
      </div>
    </div>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>{children}</div>
}

export function SegToggle<T extends string>({
  value, options, onChange, label, pal,
}: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label: string; pal: ChartPalette }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'inline-flex', gap: 2, background: 'var(--surface-alt)', padding: 2, borderRadius: 8 }}>
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          style={{
            padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: value === v ? pal.surface : 'transparent',
            color: value === v ? pal.primary : pal.textMuted,
            boxShadow: value === v ? 'var(--shadow-card)' : 'none',
          }}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

/** Yalnız veliye gösterilen kısa açıklama. */
export function Explain({ role, pal, children }: { role: DrillRole; pal: ChartPalette; children: ReactNode }) {
  if (role !== 'parent') return null
  return (
    <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.5, color: pal.textMuted, background: 'var(--surface-alt)', borderRadius: 8, padding: '8px 10px' }}>
      {children}
    </div>
  )
}

const BAND_LABEL: Record<string, string> = { good: 'Yeterli', medium: 'Gelişiyor', weak: 'Kritik', az_veri: 'Az veri', none: 'Ölçülmedi' }

export function BandChip({ band, pal }: { band: MasteryBand | 'az_veri'; pal: ChartPalette }) {
  const dot = band === 'good' ? pal.success : band === 'medium' ? pal.warning : band === 'weak' ? pal.critical : pal.textMuted
  const bg = band === 'good' || band === 'medium' || band === 'weak' ? pal.bandBg[band] : 'var(--surface-alt)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: bg, color: pal.text, whiteSpace: 'nowrap' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />
      {BAND_LABEL[band]}
    </span>
  )
}

export function Legend({ items, pal }: { items: Array<{ name: string; color: string }>; pal: ChartPalette }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 11.5, color: pal.textMuted, margin: '6px 0' }}>
      {items.map((it) => (
        <span key={it.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: it.color }} />
          {it.name}
        </span>
      ))}
    </div>
  )
}
