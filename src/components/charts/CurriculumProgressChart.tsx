import { useState } from 'react'
import type { CurriculumProgressData } from '../../lib/report360Core'
import { BookOpen, AlertTriangle, CheckCircle2, Info } from 'lucide-react'

export interface CurriculumProgressChartProps {
  data: CurriculumProgressData
  curriculumTitle?: string
}

export default function CurriculumProgressChart({ data, curriculumTitle }: CurriculumProgressChartProps) {
  const { subjects, totalSufficient, totalTopics, overallSufficientPct, velocity } = data
  const [hoveredSubjectId, setHoveredSubjectId] = useState<number | null>(null)

  if (subjects.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: 'center',
          color: 'var(--ink-faint)',
          fontSize: 12.5,
          background: 'var(--surface-alt)',
          borderRadius: 8,
          border: '1px dashed var(--border-soft)',
        }}
      >
        Müfredat konuları bulunamadı.
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
      {/* Başlık ve Genel Özet */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
            <BookOpen size={16} style={{ color: 'var(--indigo-600)' }} />
            <span>Müfredat İlerlemesi & Yetişme Tahmini (B7)</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
            {curriculumTitle ? `${curriculumTitle} · ` : ''}%{overallSufficientPct} yeterlilik ({totalSufficient} / {totalTopics} konu tamamlandı)
          </div>
        </div>

        {/* Lejant */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--ink-soft)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--success)' }} />
            <span>Yeterli</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--warning)' }} />
            <span>Gelişiyor / Kritik</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--indigo-500)' }} />
            <span>Çalışıldı (Ödev var)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--border)' }} />
            <span>Başlanmadı</span>
          </div>
        </div>
      </div>

      {/* Hız & Yetişme Tahmini Banner */}
      <div
        style={{
          padding: '10px 14px',
          borderRadius: 8,
          background: !velocity.canPredict
            ? 'var(--surface-alt)'
            : velocity.isLate
            ? 'color-mix(in srgb, var(--critical) 8%, transparent)'
            : 'color-mix(in srgb, var(--success) 8%, transparent)',
          border: !velocity.canPredict
            ? '1px solid var(--border-soft)'
            : velocity.isLate
            ? '1px solid color-mix(in srgb, var(--critical) 25%, transparent)'
            : '1px solid color-mix(in srgb, var(--success) 25%, transparent)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 12,
        }}
      >
        {!velocity.canPredict ? (
          <>
            <Info size={16} style={{ color: 'var(--ink-soft)', flexShrink: 0 }} />
            <span style={{ color: 'var(--ink-soft)' }}>
              {velocity.summaryText}
            </span>
          </>
        ) : velocity.isLate ? (
          <>
            <AlertTriangle size={16} style={{ color: 'var(--critical)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 700, color: 'var(--critical-text)' }}>
                {velocity.weeksLate && velocity.weeksLate > 52
                  ? velocity.summaryText
                  : `Bu tempoyla müfredat sınavdan ${velocity.weeksLate} hafta sonra bitiyor!`}
              </span>
              <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                Son 6 haftalık hız: ~{velocity.weeklyRate.toFixed(1).replace('.', ',')} konu/hafta · Kalan {totalTopics - totalSufficient} konunun tamamlanması için ~{velocity.weeksNeeded} hafta gerekiyor.
              </span>
            </div>
          </>
        ) : (
          <>
            <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 700, color: 'var(--success-text)' }}>
                Müfredat sınav tarihinden önce tamamlanıyor.
              </span>
              <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                Son 6 haftalık hız: ~{velocity.weeklyRate.toFixed(1).replace('.', ',')} konu/hafta · Kalan {totalTopics - totalSufficient} konu ~{velocity.weeksNeeded} haftada tamamlanabilir.
              </span>
            </div>
          </>
        )}
      </div>

      {/* Ders Bazında Yığılı Çubuklar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {subjects.map((sub) => {
          const isHovered = hoveredSubjectId === sub.subjectId
          const tot = sub.total || 1
          const sufficientPct = (sub.sufficient / tot) * 100
          const developingPct = (sub.developing / tot) * 100
          const workedPct = (sub.worked / tot) * 100
          const notStartedPct = (sub.notStarted / tot) * 100

          return (
            <div
              key={sub.subjectId}
              onMouseEnter={() => setHoveredSubjectId(sub.subjectId)}
              onMouseLeave={() => setHoveredSubjectId(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: '6px 8px',
                borderRadius: 6,
                background: isHovered ? 'var(--surface-alt)' : 'transparent',
                transition: 'background 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{sub.subjectName}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                  <strong style={{ color: 'var(--success-text)' }}>{sub.sufficient}</strong> / {sub.total} konu yeterli (%{sub.sufficientPct})
                </span>
              </div>

              {/* Yığılı Çubuk */}
              <div
                style={{
                  display: 'flex',
                  height: 12,
                  width: '100%',
                  borderRadius: 4,
                  overflow: 'hidden',
                  background: 'var(--border-soft)',
                }}
              >
                {/* Yeterli */}
                {sub.sufficient > 0 && (
                  <div
                    style={{ width: `${sufficientPct}%`, background: 'var(--success)', height: '100%' }}
                    title={`Yeterli: ${sub.sufficient} konu (%${Math.round(sufficientPct)})`}
                  />
                )}
                {/* Gelişiyor */}
                {sub.developing > 0 && (
                  <div
                    style={{ width: `${developingPct}%`, background: 'var(--warning)', height: '100%' }}
                    title={`Gelişiyor / Kritik: ${sub.developing} konu (%${Math.round(developingPct)})`}
                  />
                )}
                {/* Çalışıldı */}
                {sub.worked > 0 && (
                  <div
                    style={{ width: `${workedPct}%`, background: 'var(--indigo-500)', height: '100%' }}
                    title={`Çalışıldı (Ödev var): ${sub.worked} konu (%${Math.round(workedPct)})`}
                  />
                )}
                {/* Başlanmadı */}
                {sub.notStarted > 0 && (
                  <div
                    style={{ width: `${notStartedPct}%`, background: 'var(--border)', height: '100%' }}
                    title={`Başlanmadı: ${sub.notStarted} konu (%${Math.round(notStartedPct)})`}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
