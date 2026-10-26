import { useState } from 'react'
import type { ReviewTimingData, ReviewTimingItem } from '../../lib/report360Core'
import AddToProgramPopover from '../program/AddToProgramPopover'
import { RotateCcw, AlertTriangle, CheckCircle, Plus, ChevronDown } from 'lucide-react'

export interface ReviewTimingCardProps {
  data: ReviewTimingData
  studentId: string
  studentName?: string
  studentGrade?: string | null
  onTaskAdded?: () => void
}

export default function ReviewTimingCard({
  data,
  studentId,
  studentName,
  onTaskAdded,
}: ReviewTimingCardProps) {
  const [selectedTopic, setSelectedTopic] = useState<{ id: number; name: string } | null>(null)
  const [showUpcoming, setShowUpcoming] = useState(false)

  const handleOpenAddModal = (e: React.MouseEvent<HTMLButtonElement>, item: ReviewTimingItem) => {
    e.stopPropagation()
    setSelectedTopic({ id: item.topicId, name: item.topicName })
  }

  const handleClosePopover = () => {
    setSelectedTopic(null)
  }

  const dueItems = data.items.filter((i) => i.isDue && i.weeksInactive >= 3)
  const upcomingItems = data.items.filter((i) => !i.isDue || i.weeksInactive < 3)

  const renderItemRow = (item: ReviewTimingItem) => {
    const repeatLabel =
      item.repeatCount === 0
        ? 'Henüz tekrar edilmedi'
        : `${item.repeatCount}. tekrar yapıldı`

    return (
      <div
        key={item.topicId}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: item.isDue ? 'var(--surface-alt)' : 'var(--surface)',
          borderRadius: 8,
          border: item.isDue ? '1px solid var(--warning-border, rgba(245, 158, 11, 0.3))' : '1px solid var(--border-soft)',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
              {item.topicName}
            </span>
            <span
              style={{
                fontSize: 10.5,
                padding: '1px 6px',
                borderRadius: 4,
                background: 'var(--surface-hover)',
                color: 'var(--ink-soft)',
              }}
            >
              {item.subjectName}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
            Son ölçüm: %{item.lastMeasuredAccuracy} · {repeatLabel}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 6,
              background: item.isDue ? 'var(--warning-bg, #fef3c7)' : 'var(--surface-alt)',
              color: item.isDue ? 'var(--warning-text, #92400e)' : 'var(--ink-soft)',
            }}
          >
            {item.weeksInactive} haftadır boş
          </span>

          <button
            type="button"
            onClick={(e) => handleOpenAddModal(e, item)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-soft)',
              background: 'var(--surface)',
              color: 'var(--ink)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface)'
            }}
          >
            <Plus size={12} />
            Tekrar Ekle
          </button>
        </div>
      </div>
    )
  }

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
      {/* Kart Başlığı */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'var(--teal-bg, rgba(20, 184, 166, 0.12))',
              color: 'var(--teal-text, #0d9488)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RotateCcw size={16} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
              Tekrar Zamanı (Unutma Eğrisi)
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>
              {dueItems.length > 0
                ? `${dueItems.length} konunun tekrar zamanı geldi (≥ 3 hafta).`
                : 'Zamanı gelen tekrar bulunmuyor, planlar güncel.'}
            </div>
          </div>
        </div>

        {dueItems.length > 0 ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: 12,
              background: 'var(--warning-bg, rgba(245, 158, 11, 0.12))',
              color: 'var(--warning-text, #b45309)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <AlertTriangle size={12} />
            {dueItems.length} Tekrar Bekliyor
          </span>
        ) : (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: 12,
              background: 'var(--success-bg, rgba(16, 185, 129, 0.12))',
              color: 'var(--success-text, #047857)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <CheckCircle size={12} />
            Planlar Güncel
          </span>
        )}
      </div>

      {/* Konu Listesi */}
      {data.items.length === 0 ? (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            background: 'var(--surface-alt)',
            borderRadius: 8,
            border: '1px dashed var(--border-soft)',
            fontSize: 12,
            color: 'var(--ink-soft)',
          }}
        >
          Henüz 'yeterli' seviyeye ulaşmış konu bulunmuyor. Konular yeterli oldukça tekrar takvimi burada listelenecektir.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Tekrar Zamanı Gelenler (Varsayılan liste) */}
          {dueItems.length === 0 ? (
            <div
              style={{
                padding: '12px 14px',
                textAlign: 'center',
                background: 'var(--surface-alt)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--ink-soft)',
              }}
            >
              Şu an tekrar zamanı gelen (≥ 3 hafta) konu bulunmuyor.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {dueItems.map(renderItemRow)}
            </div>
          )}

          {/* Yakında Bölümü (Katlanır) */}
          {upcomingItems.length > 0 && (
            <div style={{ marginTop: 4, borderTop: '1px solid var(--border-soft)', paddingTop: 8 }}>
              <button
                type="button"
                onClick={() => setShowUpcoming((prev) => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'none',
                  border: 'none',
                  color: 'var(--ink-soft)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: 4,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--ink)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--ink-soft)'
                }}
              >
                <ChevronDown
                  size={14}
                  style={{
                    transform: showUpcoming ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease',
                  }}
                />
                <span>Yakında ({upcomingItems.length} konu)</span>
              </button>

              {showUpcoming && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, maxHeight: 220, overflowY: 'auto' }}>
                  {upcomingItems.map(renderItemRow)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add to Program Popover */}
      {selectedTopic && (
        <AddToProgramPopover
          onClose={handleClosePopover}
          studentId={studentId}
          studentName={studentName}
          topicId={selectedTopic.id}
          suggestedType="tekrar"
          originKind="oneri"
          onSuccess={() => {
            handleClosePopover()
            onTaskAdded?.()
          }}
        />
      )}
    </div>
  )
}
