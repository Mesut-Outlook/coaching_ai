import { Plus, Tag } from 'lucide-react'
import type { ErrorBasketItem } from '../../../types/database'
import type { TopicRowData } from '../../../lib/examReport'
import { ERROR_REASON_CONFIG } from '../../../lib/report360Core'
import type { DrillProps } from './types'

/** Karne konusunun birincil müfredat konusuna girilmiş yanlış nedenleri. */
export function reasonItems(p: Pick<DrillProps, 'catalog' | 'errorItems'>, examTopicId: number): ErrorBasketItem[] {
  const cid = p.catalog.links?.find((l) => l.exam_topic_id === examTopicId && l.is_primary)?.topic_id
  return cid == null ? [] : p.errorItems.filter((i) => i.topic_id === cid)
}

/** Koç işlemleri: Programa ekle + Neden ekle/düzenle (yalnız yanlış ya da kayıtlı neden varsa). */
export function TopicActions({
  row, subjectLabel, p,
}: { row: TopicRowData; subjectLabel: string; p: Pick<DrillProps, 'catalog' | 'errorItems' | 'onAddToProgram' | 'onErrorReason'> }) {
  const n = reasonItems(p, row.exam_topic_id).length
  const weak = row.status_badge === 'weak'
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={(e) => { e.stopPropagation(); p.onAddToProgram(row.exam_topic_id, row.name) }}
        title="Bu konuyu haftalık programa ekle"
        style={{
          padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 3,
          color: weak ? 'var(--critical-text)' : 'var(--indigo-600)',
          background: weak ? 'var(--critical-bg)' : 'transparent',
        }}
      >
        <Plus size={12} /> Programa ekle
      </button>
      {(row.total_wrong > 0 || n > 0) && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={(e) => { e.stopPropagation(); p.onErrorReason({ ...row, subject_label: subjectLabel }) }}
          title="Bu konudaki yanlışların nedenini ekle veya düzenle"
          style={{
            padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 3,
            color: n > 0 ? 'var(--indigo-600)' : 'var(--warning-text)',
            background: n > 0 ? 'var(--indigo-050)' : 'var(--warning-bg)',
          }}
        >
          <Tag size={12} /> {n > 0 ? 'Neden düzenle' : 'Neden ekle'}
        </button>
      )}
    </div>
  )
}

/** Satırdaki kayıtlı yanlış nedenleri küçük rozet olarak gösterir. */
export function ReasonChips({ items }: { items: ErrorBasketItem[] }) {
  if (items.length === 0) return null
  const counts: Partial<Record<string, number>> = {}
  for (const it of items) counts[it.error_type] = (counts[it.error_type] ?? 0) + 1
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {Object.entries(counts).map(([type, cnt]) => {
        const conf = ERROR_REASON_CONFIG[type as keyof typeof ERROR_REASON_CONFIG]
        if (!conf) return null
        return (
          <span
            key={type}
            title={`${conf.label}: ${conf.description}`}
            style={{ fontSize: 10, fontWeight: 600, padding: '1.5px 6px', borderRadius: 4, background: conf.bg, color: conf.textColor, display: 'inline-flex', alignItems: 'center', gap: 3 }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: conf.color }} />
            {conf.label}{(cnt ?? 0) > 1 ? ` (${cnt})` : ''}
          </span>
        )
      })}
    </div>
  )
}
