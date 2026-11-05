import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import type { ChartPalette } from '../../charts/chartPalette'
import { FORMULA_LINES } from './copy'

/** Her seviyenin başındaki özet cümlesi + "Nasıl hesaplandı?" kutusu. */
export default function LevelHeader({ headline, pal }: { headline: string; pal: ChartPalette }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: pal.primary, flex: '1 1 240px', lineHeight: 1.45 }}>{headline}</div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', fontSize: 12, color: pal.textMuted, cursor: 'pointer', padding: '4px 6px' }}
        >
          <HelpCircle size={13} /> {open ? 'Formülü kapat' : 'Nasıl hesaplandı?'}
        </button>
      </div>
      {open && (
        <div style={{ background: 'var(--surface-alt)', border: `1px solid ${pal.border}`, borderRadius: 10, padding: 14, fontSize: 12.5, lineHeight: 1.6, color: pal.text }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Nasıl hesaplandı?</div>
          {FORMULA_LINES.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      )}
    </div>
  )
}
