import { useState } from 'react'
import { X, Tag, Trash2, Check, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { ErrorType, ErrorBasketItem } from '../../types/database'
import { ERROR_REASON_CONFIG } from '../../lib/report360Core'

export interface WrongExamSummary {
  exam_id: string
  exam_name: string
  exam_date: string
  wrong_count: number
}

export interface ErrorReasonModalProps {
  isOpen: boolean
  onClose: () => void
  studentName?: string
  topicName: string
  subjectLabel?: string
  curriculumTopicId: number | null
  examTopicId: number
  wrongExams: WrongExamSummary[]
  existingItems: ErrorBasketItem[]
  onItemAdded: (item: ErrorBasketItem) => void
  onItemDeleted: (id: string) => void
}

const ERROR_OPTIONS: Array<{
  type: ErrorType
  label: string
  color: string
  bg: string
  textColor: string
  description: string
}> = (['bilgi_eksikligi', 'islem_hatasi', 'dikkat_hatasi', 'sure_yetmedi'] as ErrorType[]).map((type) => {
  const conf = ERROR_REASON_CONFIG[type]
  return {
    type,
    label: conf.label,
    color: conf.color,
    bg: conf.bg,
    textColor: conf.textColor,
    description: conf.description,
  }
})

export default function ErrorReasonModal({
  isOpen,
  onClose,
  topicName,
  subjectLabel,
  curriculumTopicId,
  wrongExams,
  existingItems,
  onItemAdded,
  onItemDeleted,
}: ErrorReasonModalProps) {
  // Varsayılan olarak en son yanlış yapılan denemeyi seç
  const [selectedExamId, setSelectedExamId] = useState<string>(
    wrongExams[wrongExams.length - 1]?.exam_id || ''
  )
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  if (!isOpen) return null

  async function handleAdd(errorType: ErrorType) {
    if (!selectedExamId) {
      setFeedback({ type: 'error', message: 'Lütfen bir deneme seçin.' })
      return
    }

    setSaving(true)
    setFeedback(null)

    try {
      const payload = {
        mock_exam_id: selectedExamId,
        topic_id: curriculumTopicId ?? null,
        error_type: errorType,
      }

      const { data, error } = await supabase
        .from('error_basket_items')
        .insert(payload)
        .select()
        .single()

      if (error) throw error

      if (data) {
        onItemAdded(data as ErrorBasketItem)
        setFeedback({
          type: 'success',
          message: `"${ERROR_REASON_CONFIG[errorType].label}" nedeni başarıyla eklendi!`,
        })
      }
    } catch (err: any) {
      console.error('ErrorReasonModal insert error:', err)
      setFeedback({
        type: 'error',
        message: err?.message || 'Yanlış nedeni kaydedilirken bir hata oluştu.',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    setFeedback(null)

    try {
      const { error } = await supabase
        .from('error_basket_items')
        .delete()
        .eq('id', id)

      if (error) throw error

      onItemDeleted(id)
      setFeedback({ type: 'success', message: 'Yanlış nedeni kaldırıldı.' })
    } catch (err: any) {
      console.error('ErrorReasonModal delete error:', err)
      setFeedback({
        type: 'error',
        message: err?.message || 'Neden silinirken hata oluştu.',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const totalWrongCount = wrongExams.reduce((sum, e) => sum + e.wrong_count, 0)

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 110 }}>
      <div
        className="modal-panel card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 480,
          width: '92%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 20,
        }}
      >
        {/* Başlık ve Kapat Butonu */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink)' }}>
              <Tag size={16} style={{ color: 'var(--indigo-600)' }} />
              {topicName}
            </h3>
            <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '3px 0 0 0' }}>
              {subjectLabel ? `${subjectLabel} · ` : ''}Toplam {totalWrongCount} Yanlış Soru
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        {/* Geri Bildirim Bildirimi */}
        {feedback && (
          <div
            style={{
              padding: '7px 10px',
              borderRadius: 6,
              marginBottom: 12,
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: feedback.type === 'success' ? 'var(--success-bg)' : 'var(--critical-bg)',
              color: feedback.type === 'success' ? 'var(--success-text)' : 'var(--critical-text)',
            }}
          >
            {feedback.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Deneme Seçici */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
            İlgili Deneme
          </label>
          {wrongExams.length > 1 ? (
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="select"
              style={{
                width: '100%',
                padding: '7px 10px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--ink)',
              }}
            >
              {wrongExams.map((ex) => (
                <option key={ex.exam_id} value={ex.exam_id}>
                  {ex.exam_name} ({ex.wrong_count} yanlış) · {ex.exam_date}
                </option>
              ))}
            </select>
          ) : wrongExams.length === 1 ? (
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--ink-soft)',
                padding: '6px 10px',
                background: 'var(--surface-alt)',
                borderRadius: 6,
                border: '1px solid var(--border-soft)',
              }}
            >
              {wrongExams[0].exam_name} ({wrongExams[0].wrong_count} yanlış) · {wrongExams[0].exam_date}
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>
              Kayıtlı deneme bulunmuyor.
            </div>
          )}
        </div>

        {/* Mevcut Kayıtlı Nedenler */}
        {existingItems.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
              Kayıtlı Yanlış Nedenleri ({existingItems.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {existingItems.map((item) => {
                const conf = ERROR_REASON_CONFIG[item.error_type]
                const ex = wrongExams.find((w) => w.exam_id === item.mock_exam_id)
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: 6,
                      background: conf.bg,
                      border: `1px solid color-mix(in srgb, ${conf.color} 30%, transparent)`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: conf.color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 700, color: conf.textColor }}>
                        {conf.label}
                      </span>
                      {ex && (
                        <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                          · {ex.exam_name}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      style={{
                        color: 'var(--critical-text)',
                        padding: '2px 6px',
                        fontSize: 11,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                      title="Bu nedeni kaldır"
                    >
                      <Trash2 size={12} /> Sil
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Yeni Neden Ekle Kartları */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
            Yanlış Nedeni Seç ve Ekle
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            {ERROR_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                disabled={saving || !selectedExamId}
                onClick={() => handleAdd(opt.type)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 3,
                  padding: '9px 11px',
                  borderRadius: 8,
                  border: `1px solid color-mix(in srgb, ${opt.color} 35%, transparent)`,
                  background: 'var(--surface)',
                  cursor: saving || !selectedExamId ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease, border-color 0.15s ease, transform 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  if (!saving && selectedExamId) {
                    e.currentTarget.style.background = opt.bg
                    e.currentTarget.style.borderColor = opt.color
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface)'
                  e.currentTarget.style.borderColor = `color-mix(in srgb, ${opt.color} 35%, transparent)`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12, color: opt.textColor }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color }} />
                  {opt.label}
                </div>
                <span style={{ fontSize: 10.5, color: 'var(--ink-soft)', lineHeight: 1.3 }}>
                  {opt.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Alt Buton */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ fontSize: 12 }}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}
