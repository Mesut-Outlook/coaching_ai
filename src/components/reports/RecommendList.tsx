import { useState } from 'react'
import { Sparkles, CalendarPlus, HelpCircle, CheckCircle2, Target } from 'lucide-react'
import type { TaskType } from '../../types/database'
import type { RecommendItem, RecommendOutput } from '../../lib/recommendCore'
import AddToProgramPopover from '../program/AddToProgramPopover'

export interface RecommendListProps {
  studentId: string
  studentName?: string
  recommendations: RecommendOutput
  onProgramAdded?: (addedCount: number) => void
  className?: string
}

const TASK_TYPE_META: Record<TaskType, { label: string; bg: string; color: string; border: string }> = {
  konu: {
    label: 'Konu Çalışması',
    bg: 'var(--measured-bg)',
    color: 'var(--measured-text)',
    border: 'color-mix(in srgb, var(--measured-text) 25%, transparent)',
  },
  tekrar: {
    label: 'Aralıklı Tekrar',
    bg: 'var(--teal-bg)',
    color: 'var(--teal-text)',
    border: 'color-mix(in srgb, var(--teal-text) 25%, transparent)',
  },
  sureli_test: {
    label: 'Süreli Test',
    bg: 'var(--warning-bg)',
    color: 'var(--warning-text)',
    border: 'color-mix(in srgb, var(--warning-text) 25%, transparent)',
  },
  rutin: {
    label: 'Rutin',
    bg: 'var(--success-bg)',
    color: 'var(--success-text)',
    border: 'color-mix(in srgb, var(--success-text) 25%, transparent)',
  },
  deneme: {
    label: 'Deneme',
    bg: 'var(--plum-bg)',
    color: 'var(--plum-text)',
    border: 'color-mix(in srgb, var(--plum-text) 25%, transparent)',
  },
}

function getSubjectBadgeStyle(subjectName: string): { bg: string; color: string; border: string } {
  const lower = subjectName.toLowerCase()
  if (lower.includes('mat') || lower.includes('geo')) {
    return {
      bg: 'color-mix(in srgb, var(--c-math) 12%, transparent)',
      color: 'var(--c-math)',
      border: 'color-mix(in srgb, var(--c-math) 25%, transparent)',
    }
  }
  if (lower.includes('türk') || lower.includes('edeb')) {
    return {
      bg: 'color-mix(in srgb, var(--c-turkce) 12%, transparent)',
      color: 'var(--c-turkce)',
      border: 'color-mix(in srgb, var(--c-turkce) 25%, transparent)',
    }
  }
  if (lower.includes('fiz') || lower.includes('kim') || lower.includes('biyo') || lower.includes('fen')) {
    return {
      bg: 'color-mix(in srgb, var(--c-fen) 12%, transparent)',
      color: 'var(--c-fen)',
      border: 'color-mix(in srgb, var(--c-fen) 25%, transparent)',
    }
  }
  if (lower.includes('tar') || lower.includes('coğ') || lower.includes('fel') || lower.includes('din') || lower.includes('sos')) {
    return {
      bg: 'color-mix(in srgb, var(--c-sosyal) 12%, transparent)',
      color: 'var(--c-sosyal)',
      border: 'color-mix(in srgb, var(--c-sosyal) 25%, transparent)',
    }
  }
  return {
    bg: 'var(--indigo-050)',
    color: 'var(--indigo-600)',
    border: 'color-mix(in srgb, var(--indigo-600) 25%, transparent)',
  }
}

export default function RecommendList({
  studentId,
  studentName,
  recommendations,
  onProgramAdded,
  className = '',
}: RecommendListProps) {
  const [activeItem, setActiveItem] = useState<RecommendItem | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  const { targetTotalQuestions, items, summaryText } = recommendations

  const handleOpenPopover = (item: RecommendItem) => {
    setActiveItem(item)
  }

  const handleSuccess = (count: number) => {
    if (activeItem) {
      setAddedIds((prev) => new Set(prev).add(activeItem.id))
    }
    setActiveItem(null)
    onProgramAdded?.(count)
  }

  return (
    <div
      className={className}
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* 1. Başlık ve Haftalık Soru Hedefi Özeti */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          borderBottom: '1px solid var(--border-soft)',
          paddingBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--indigo-050)',
              color: 'var(--indigo-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={22} />
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--ink)',
                fontFamily: 'var(--font-disp)',
              }}
            >
              Haftalık Öncelik ve Öneri Listesi
            </h3>
            <p
              style={{
                margin: '3px 0 0',
                fontSize: '13px',
                color: 'var(--ink-soft)',
              }}
            >
              {summaryText}
            </p>
          </div>
        </div>

        {/* Hedef Soru Rozeti */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--surface-alt)',
            border: '1px solid var(--border-soft)',
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <Target size={16} style={{ color: 'var(--indigo-600)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '11px', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Haftalık Hedef
            </span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>
              {targetTotalQuestions} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--ink-soft)' }}>soru</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Sıralı Öneri Listesi */}
      {items.length === 0 ? (
        <div
          style={{
            padding: '36px 20px',
            textAlign: 'center',
            backgroundColor: 'var(--surface-alt)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <HelpCircle size={32} style={{ color: 'var(--ink-faint)' }} />
          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--ink-soft)' }}>
            Önerilecek öncelikli konu bulunamadı
          </span>
          <span style={{ fontSize: '12px', color: 'var(--ink-faint)' }}>
            Öğrencinin tüm konuları yeterli düzeyde veya veri girişi bekleniyor.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.map((item) => {
            const subjectStyle = getSubjectBadgeStyle(item.subjectName)
            const typeMeta = TASK_TYPE_META[item.taskType] || TASK_TYPE_META.konu
            const isAdded = addedIds.has(item.id)

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  padding: '14px 18px',
                  backgroundColor: 'var(--surface-alt)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: 'var(--radius-md)',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Sol: Sıra, Ders, Konu, Açıklama */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1, minWidth: 0 }}>
                  {/* Sıra Numarası */}
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--paper)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--ink-soft)',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    {item.priorityRank}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    {/* Üst Satır: Ders Rozeti + Konu Adı + Tür Etiketi */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: subjectStyle.bg,
                          color: subjectStyle.color,
                          border: `1px solid ${subjectStyle.border}`,
                        }}
                      >
                        {item.subjectName}
                      </span>

                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: 'var(--ink)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.topicName}
                      </span>

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 500,
                          padding: '2px 7px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: typeMeta.bg,
                          color: typeMeta.color,
                          border: `1px solid ${typeMeta.border}`,
                        }}
                      >
                        {typeMeta.label}
                      </span>
                    </div>

                    {/* Alt Satır: Tek Cümlelik Gerekçe */}
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--ink-soft)',
                        lineHeight: 1.4,
                      }}
                    >
                      {item.reason}
                    </div>
                  </div>
                </div>

                {/* Sağ: Soru Sayısı Rozeti + "Programa Ekle" Butonu */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <div
                    style={{
                      textAlign: 'right',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--ink)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {item.recommendedQuestions}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--ink-faint)' }}>soru</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenPopover(item)}
                    disabled={isAdded}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm)',
                      cursor: isAdded ? 'default' : 'pointer',
                      border: isAdded
                        ? '1px solid color-mix(in srgb, var(--success) 30%, transparent)'
                        : '1px solid var(--border)',
                      backgroundColor: isAdded ? 'var(--success-bg)' : 'var(--surface)',
                      color: isAdded ? 'var(--success-text)' : 'var(--indigo-600)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isAdded ? (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Eklendi</span>
                      </>
                    ) : (
                      <>
                        <CalendarPlus size={14} />
                        <span>Programa Ekle</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 3. Program Ekleme Popover Entegrasyonu */}
      {activeItem && (
        <AddToProgramPopover
          studentId={studentId}
          studentName={studentName}
          topicId={activeItem.topicId}
          examTopicId={activeItem.examTopicId}
          examTopicName={activeItem.topicName}
          originKind="oneri"
          suggestedType={activeItem.taskType}
          onClose={() => setActiveItem(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
