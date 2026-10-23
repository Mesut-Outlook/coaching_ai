import { X } from 'lucide-react'

// Ortak çip + otomatik-tamamlama seçici (Program, Üniversite, Şehir aynı deseni kullanır).
export function ChipMultiSelect({
  label, placeholder, selected, onAdd, onRemove,
  query, setQuery, open, setOpen, suggestions, loading,
}: {
  label: string
  placeholder: string
  selected: string[]
  onAdd: (v: string) => void
  onRemove: (v: string) => void
  query: string
  setQuery: (v: string) => void
  open: boolean
  setOpen: (v: boolean) => void
  suggestions: string[]
  loading?: boolean
}) {
  return (
    <div className="field" style={{ position: 'relative' }}>
      <label>{label}{selected.length > 0 ? ` (${selected.length})` : ''}</label>
      <div
        onClick={() => setOpen(true)}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 40, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', cursor: 'text' }}
      >
        {selected.map((v) => (
          <span key={v} className="chip chip-say" style={{ gap: 4 }}>
            {v}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(v) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', color: 'inherit' }}
              title="Kaldır"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          placeholder={selected.length ? 'Başka ekle…' : placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          style={{ flex: 1, minWidth: 90, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 13.5, padding: '2px 0' }}
        />
      </div>
      {open && (
        <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 25, marginTop: 4, padding: 6, maxHeight: 260, overflowY: 'auto', boxShadow: 'var(--shadow-card)' }}>
          {loading && <div style={{ padding: 8, color: 'var(--ink-soft)', fontSize: 13 }}>Aranıyor…</div>}
          {!loading && suggestions.length === 0 && (
            <div style={{ padding: 8, color: 'var(--ink-soft)', fontSize: 13 }}>
              {query.trim() ? 'Eşleşen yok' : 'Yazmaya başlayın…'}
            </div>
          )}
          {!loading && suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', border: 'none', fontWeight: 500 }}
              onMouseDown={(e) => { e.preventDefault(); onAdd(s) }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
