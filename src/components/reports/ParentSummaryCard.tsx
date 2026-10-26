import { CheckCircle2, HeartHandshake, MessageSquareQuote, Calendar, AlertCircle } from 'lucide-react'
import type { SummaryStats } from '../../lib/parentSummaryCore'

type Props = {
  studentName: string
  weekRangeText: string
  stats: SummaryStats
  tips: string[]
  coachNote?: string | null
  compact?: boolean
}

export default function ParentSummaryCard({
  studentName,
  weekRangeText,
  stats,
  tips,
  coachNote,
  compact = false,
}: Props) {
  const roundedExamNet = stats.latestExamNet != null ? Math.round(stats.latestExamNet * 100) / 100 : null

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg, 16px)',
        padding: compact ? 16 : 20,
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--indigo-600)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <Calendar size={13} /> Haftalık Veli Özeti
          </div>
          <h3 style={{ fontSize: compact ? 16 : 18, fontWeight: 800, color: 'var(--ink)', margin: '4px 0 0 0' }}>
            {studentName}
          </h3>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>
            {weekRangeText}
          </div>
        </div>

        {/* Görev başarı rozeti */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 'var(--radius-md, 12px)',
            background: stats.completionPct >= 60 ? 'var(--success-bg)' : 'var(--warning-bg)',
            color: stats.completionPct >= 60 ? 'var(--success-text)' : 'var(--warning-text)',
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          {stats.completionPct >= 60 ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>Görev Başarısı: %{stats.completionPct}</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 10,
        }}
      >
        <div
          style={{
            background: 'var(--surface-alt)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--radius-sm, 10px)',
            padding: '10px 12px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
            Görevler
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginTop: 3 }}>
            {stats.completedCount} <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500 }}>/ {stats.totalCount}</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>
            tamamlandı
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface-alt)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--radius-sm, 10px)',
            padding: '10px 12px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
            Son Deneme
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginTop: 3 }}>
            {roundedExamNet != null ? (
              <>
                {roundedExamNet} <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500 }}>net</span>
              </>
            ) : (
              <span style={{ fontSize: 14, color: 'var(--ink-soft)' }}>—</span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {stats.latestExamName ?? (stats.targetNet != null ? `Hedef: ${stats.targetNet}` : 'Girilmedi')}
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface-alt)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--radius-sm, 10px)',
            padding: '10px 12px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
            Devamsızlık
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: stats.unexcusedAttendanceCount > 0 ? 'var(--critical-text)' : 'var(--success-text)',
              marginTop: 3,
            }}
          >
            {stats.attendanceCount === 0 ? '0' : stats.attendanceCount}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>
            {stats.attendanceCount === 0 ? 'Kayıt yok' : `${stats.unexcusedAttendanceCount} mazeretsiz`}
          </div>
        </div>
      </div>

      {/* Evde Nasıl Destek Olabilirsiniz? Kutusu */}
      <div
        style={{
          background: 'var(--surface-alt)',
          border: '1px solid var(--border-soft)',
          borderRadius: 'var(--radius-md, 12px)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
          <HeartHandshake size={17} style={{ color: 'var(--indigo-600)' }} />
          <span>Evde Nasıl Destek Olabilirsiniz?</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tips.map((tip, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                fontSize: 13,
                color: 'var(--ink)',
                lineHeight: 1.45,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'var(--indigo-050)',
                  color: 'var(--indigo-600)',
                  fontSize: 11,
                  fontWeight: 800,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {idx + 1}
              </span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Koçun Notu (varsa) */}
      {coachNote && coachNote.trim().length > 0 && (
        <div
          style={{
            background: 'var(--indigo-025)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--radius-md, 12px)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <MessageSquareQuote size={18} style={{ color: 'var(--indigo-600)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--indigo-700)', textTransform: 'uppercase' }}>
              Koçun Notu
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontStyle: 'italic', marginTop: 3, lineHeight: 1.45 }}>
              “{coachNote.trim()}”
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
