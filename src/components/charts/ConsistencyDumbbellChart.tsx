import { useState } from 'react'
import type { ConsistencyData } from '../../lib/report360Core'
import { GitCommit, Plus, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { TaskType } from '../../types/database'

export interface ConsistencyDumbbellChartProps {
  data: ConsistencyData
  onAddToProgram?: (topicId: number, topicName: string, suggestedType?: TaskType) => void
}

export default function ConsistencyDumbbellChart({
  data,
  onAddToProgram,
}: ConsistencyDumbbellChartProps) {
  const { hasEnoughData, items, tasksWithResultsCount, emptyStateMessage } = data
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // Veri yetersizse veya fark ≥ 15 olan konu yoksa
  if (!hasEnoughData || items.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 20,
          background: 'var(--surface)',
          borderRadius: 10,
          border: '1px solid var(--border-soft)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
          <GitCommit size={16} style={{ color: 'var(--indigo-600)' }} />
          <span>Ödev ↔ Deneme Tutarlılığı (B6)</span>
        </div>

        <div
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            color: 'var(--ink-soft)',
            fontSize: 12.5,
            background: 'var(--surface-alt)',
            borderRadius: 8,
            border: '1px dashed var(--border-soft)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {!hasEnoughData ? (
            <>
              <AlertCircle size={20} style={{ color: 'var(--ink-faint)' }} />
              <div>
                {emptyStateMessage ||
                  `Görev sonuçları birikiyor: ${tasksWithResultsCount} görevde sonuç var, karşılaştırma için konu başına en az 20 soru gerekli.`}
              </div>
            </>
          ) : (
            <>
              <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
              <div>
                Belirgin tutarsızlık tespit edilmedi. Ödev doğruluğu ile deneme başarısı dengeli seyrediyor (fark &lt; 15 puan).
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 16,
        background: 'var(--surface)',
        borderRadius: 10,
        border: '1px solid var(--border-soft)',
      }}
    >
      {/* Başlık ve Lejant */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
            <GitCommit size={16} style={{ color: 'var(--indigo-600)' }} />
            <span>Ödev ↔ Deneme Tutarlılığı (B6)</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
            Ödev doğruluğu (son 4 hafta) ile deneme başarısı arasında fark ≥ 15 puan olan konular
          </div>
        </div>

        {/* Lejant */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--ink-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--indigo-600, #4f46e5)' }} />
            <span>Ödev Doğruluğu</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--teal, #1D8FA6)' }} />
            <span>Deneme Başarısı</span>
          </div>
        </div>
      </div>

      {/* Dambıl Satırları */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((item, idx) => {
          const isHovered = hoveredIdx === idx
          const isTaskHigher = item.direction === 'task_higher'
          const leftPct = Math.min(item.taskAccuracyPct, item.examAccuracyPct)
          const rightPct = Math.max(item.taskAccuracyPct, item.examAccuracyPct)
          const spanWidth = Math.max(4, rightPct - leftPct)

          return (
            <div
              key={item.topicId}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 8,
                background: isHovered ? 'var(--surface-alt)' : 'transparent',
                border: '1px solid var(--border-soft)',
                transition: 'background 0.15s ease',
              }}
            >
              {/* Üst Bilgi Satırı */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{item.topicName}</span>
                  <span style={{ color: 'var(--ink-soft)', marginLeft: 6, fontSize: 11 }}>({item.subjectName})</span>
                  <span style={{ color: 'var(--ink-faint)', marginLeft: 6, fontSize: 10.5 }}>· {item.taskQuestionsCount} ödev sorusu</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: isTaskHigher ? 'color-mix(in srgb, var(--warning) 12%, transparent)' : 'color-mix(in srgb, var(--indigo-600) 10%, transparent)',
                      color: isTaskHigher ? 'var(--warning-text)' : 'var(--indigo-600)',
                    }}
                  >
                    {isTaskHigher ? `Ödev +${item.diffPct} Puan Yüksek` : `Deneme +${Math.abs(item.diffPct)} Puan Yüksek`}
                  </span>

                  {onAddToProgram && (
                    <button
                      type="button"
                      onClick={() =>
                        onAddToProgram(
                          item.topicId,
                          item.topicName,
                          isTaskHigher ? 'sureli_test' : 'tekrar'
                        )
                      }
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: 'var(--surface)',
                        color: 'var(--indigo-600)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={12} /> {isTaskHigher ? 'Süreli Test Ekle' : 'Programa Ekle'}
                    </button>
                  )}
                </div>
              </div>

              {/* Dambıl Barı (0..100%) */}
              <div style={{ position: 'relative', height: 26, margin: '2px 0', display: 'flex', alignItems: 'center' }}>
                {/* Arka Plan Kılavuz Çizgisi */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    height: 4,
                    background: 'var(--border-soft)',
                    borderRadius: 2,
                  }}
                />

                {/* Bağlantı Çizgisi (Left -> Right) */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${leftPct}%`,
                    width: `${spanWidth}%`,
                    height: 4,
                    background: isTaskHigher ? 'var(--warning, #f59e0b)' : 'var(--teal, #1D8FA6)',
                    borderRadius: 2,
                  }}
                />

                {/* Ödev Noktası */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${item.taskAccuracyPct}%`,
                    transform: 'translate(-50%, 0)',
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: 'var(--indigo-600, #4f46e5)',
                    border: '2px solid var(--surface, #ffffff)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    zIndex: 2,
                  }}
                  title={`Ödev Doğruluğu: %${item.taskAccuracyPct}`}
                />

                {/* Deneme Noktası */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${item.examAccuracyPct}%`,
                    transform: 'translate(-50%, 0)',
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: 'var(--teal, #1D8FA6)',
                    border: '2px solid var(--surface, #ffffff)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    zIndex: 2,
                  }}
                  title={`Deneme Başarısı: %${item.examAccuracyPct}`}
                />
              </div>

              {/* Değerler ve Öneri */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                <div style={{ display: 'flex', gap: 14 }}>
                  <span style={{ color: 'var(--indigo-600, #4f46e5)', fontWeight: 600 }}>
                    Ödev: %{item.taskAccuracyPct}
                  </span>
                  <span style={{ color: 'var(--teal-text, #0F6478)', fontWeight: 600 }}>
                    Deneme: %{item.examAccuracyPct}
                  </span>
                </div>

                <div style={{ color: 'var(--ink-soft)', fontStyle: 'italic' }}>
                  💡 {item.suggestion}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
