import { formatNetTr } from '../../../lib/homeSummaryCore'
import { examDetail } from '../../../lib/examDrilldown'
import DivergingBarList from '../../charts/DivergingBarList'
import LossBarChart from '../../charts/LossBarChart'
import StackedBarChart from '../../charts/StackedBarChart'
import { EXAM_DELTA_EMPTY, EXAM_NO_TOPICS, EXPLAIN } from './copy'
import LevelHeader from './LevelHeader'
import type { DrillProps } from './types'
import { cardStyle, shortDate, signed } from './format'
import { Explain, Stat, StatGrid } from './ui'

export default function LevelExam({ report, exams, role, palette: pal, state, go }: DrillProps) {
  const detail = state.examId ? examDetail(report, state.examId) : null
  if (!detail) {
    return (
      <div className="card" style={{ ...cardStyle, textAlign: 'center', color: pal.textMuted }}>
        Deneme bulunamadı.{' '}
        <button type="button" onClick={() => go({ level: 'general', examId: null })} style={{ background: 'none', border: 'none', color: pal.primary, cursor: 'pointer', fontWeight: 600 }}>
          Tüm denemelere dön
        </button>
      </div>
    )
  }
  const series = report.general.time_series
  const p = series[detail.index]
  const prev = detail.index > 0 ? series[detail.index - 1] : null
  const next = series[detail.index + 1] ?? null
  const raw = exams.find((e) => e.id === p.exam_id)
  const isLgs = report.exam_type === 'LGS'

  const sections = raw?.sections ?? []
  const q = sections.reduce((a, s) => a + s.max_questions, 0)
  const d = sections.reduce((a, s) => a + s.correct_count, 0)
  const y = sections.reduce((a, s) => a + s.wrong_count, 0)
  const b = sections.reduce((a, s) => a + (s.blank_count ?? s.max_questions - s.correct_count - s.wrong_count), 0)

  const diff = prev ? p.net - prev.net : null
  const known = detail.subjectDeltas.filter((x): x is typeof x & { delta: number } => x.delta != null)
  const best = known.reduce<(typeof known)[number] | null>((a, x) => (a == null || x.delta > a.delta ? x : a), null)
  const worst = known.reduce<(typeof known)[number] | null>((a, x) => (a == null || x.delta < a.delta ? x : a), null)
  const headline =
    diff == null
      ? `İlk deneme: ${formatNetTr(p.net)} net.`
      : `Önceki denemeye göre ${signed(diff)} net` +
        (best && best.delta > 0 ? `; en çok artış ${best.label} (${signed(best.delta)})` : '') +
        (worst && worst.delta < 0 ? `${best && best.delta > 0 ? ',' : ';'} en çok düşüş ${worst.label} (${signed(worst.delta)})` : '') +
        '.'

  const ranks = Object.entries(raw?.ranks ?? {}).filter(([, v]) => v?.sira != null)
  const hasCarne = raw && (raw.score != null || raw.percentile != null || ranks.length > 0 || !!raw.coach_note)
  const losses = detail.topicLosses.filter((l) => l.loss_net > 0)
  const goSubject = (id: number) => go({ level: 'subject', examSubjectId: id })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <LevelHeader headline={headline} pal={pal} />
      {detail.index === series.length - 1 && report.subjects.top_loss_headline && (
        <div style={{ fontSize: 13, color: pal.textMuted, marginTop: -8 }}>{report.subjects.top_loss_headline}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, color: pal.textMuted }}>{shortDate(p.exam_date)} · {report.exam_type}</div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: pal.text }}>{p.exam_name}</h3>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {prev && <button type="button" className="btn btn-ghost btn-sm" onClick={() => go({ examId: prev.exam_id })}>← {prev.exam_name}</button>}
          {next && <button type="button" className="btn btn-ghost btn-sm" onClick={() => go({ examId: next.exam_id })}>{next.exam_name} →</button>}
        </div>
      </div>

      <StatGrid>
        <Stat pal={pal} k="Net" v={formatNetTr(p.net)} s={q ? `/ ${q}` : undefined} />
        <Stat pal={pal} k="Önceki denemeye göre" v={diff == null ? '—' : signed(diff)} s={diff == null ? 'ilk deneme' : 'net'} />
        <Stat pal={pal} k="Başarı" v={`%${p.accuracy_pct.toFixed(0)}`} />
        {q > 0 && <Stat pal={pal} k="D / Y / B" v={`${d} / ${y} / ${b}`} />}
      </StatGrid>

      {hasCarne && raw && (
        <div className="card" style={cardStyle}>
          <h4 style={{ fontSize: 14, fontWeight: 700 }}>Karne bilgileri</h4>
          <div style={{ fontSize: 12, color: pal.textMuted, margin: '4px 0 10px' }}>{isLgs ? 'Yayın karnesindeki toplam ve sıralamalar (girildiyse)' : 'Yayın karnesindeki puan ve sıralamalar (girildiyse)'}</div>
          <StatGrid>
            {raw.score != null && <Stat pal={pal} k={isLgs ? 'Karne toplamı' : 'Puan'} v={formatNetTr(raw.score)} />}
            {raw.percentile != null && <Stat pal={pal} k="Yüzdelik dilim" v={`%${formatNetTr(raw.percentile)}`} />}
            {ranks.map(([k, v]) => (
              <Stat pal={pal} key={k} k={`${k} sırası`} v={v.sira!.toLocaleString('tr-TR')} s={v.katilan != null ? `/ ${v.katilan.toLocaleString('tr-TR')}` : undefined} />
            ))}
          </StatGrid>
          {raw.coach_note && (
            <div style={{ marginTop: 10, fontSize: 13, background: 'var(--surface-alt)', borderRadius: 8, padding: '8px 10px', color: pal.text }}>
              <b>Koç notu:</b> <i>"{raw.coach_note}"</i>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
        <div className="card" style={cardStyle}>
          <h4 style={{ fontSize: 14, fontWeight: 700 }}>Önceki denemeye göre ders değişimi</h4>
          <div style={{ fontSize: 12, color: pal.textMuted, margin: '4px 0 10px' }}>
            {prev ? `${prev.exam_name} → ${p.exam_name} · bir derse tıkla` : 'İlk deneme, karşılaştırma yok'}
          </div>
          <DivergingBarList
            palette={pal}
            emptyText={prev ? 'Bu denemede ders sonucu girilmemiş.' : EXAM_DELTA_EMPTY}
            items={prev ? detail.subjectDeltas.map((x) => ({ key: x.exam_subject_id, label: x.label, value: x.delta })) : []}
            onItemClick={(k) => goSubject(k as number)}
          />
          <Explain role={role} pal={pal}>{EXPLAIN.examDeltas}</Explain>
        </div>
        <div className="card" style={cardStyle}>
          <h4 style={{ fontSize: 14, fontWeight: 700 }}>Ders bazında doğru / yanlış / boş</h4>
          <div style={{ fontSize: 12, color: pal.textMuted, margin: '4px 0 10px' }}>Çubuk = dersin soru sayısı · bir derse tıkla</div>
          <StackedBarChart
            palette={pal}
            sections={detail.subjectDyb.map((s) => ({ label: s.label, correct: s.correct, wrong: s.wrong, blank: s.blank, total: s.question_count, net: s.net }))}
            onItemClick={(i) => goSubject(detail.subjectDyb[i].exam_subject_id)}
          />
        </div>
      </div>

      <div className="card" style={cardStyle}>
        <h4 style={{ fontSize: 14, fontWeight: 700 }}>Bu denemede en çok net kaybettiren konular</h4>
        <div style={{ fontSize: 12, color: pal.textMuted, margin: '4px 0 10px' }}>Kayıp = soru sayısı − konu neti · bir konuya tıkla</div>
        {detail.hasTopics ? (
          <LossBarChart
            palette={pal}
            maxItems={8}
            items={losses.map((l) => ({ label: l.name, subLabel: l.subject_label, lossNet: l.loss_net }))}
            onItemClick={(i) => go({ level: 'topic', examTopicId: losses[i].exam_topic_id, examSubjectId: losses[i].exam_subject_id })}
          />
        ) : (
          <div style={{ fontSize: 13, color: pal.textMuted, background: 'var(--surface-alt)', border: `1px dashed ${pal.border}`, borderRadius: 8, padding: 16, textAlign: 'center' }}>
            {EXAM_NO_TOPICS}
          </div>
        )}
        <Explain role={role} pal={pal}>{EXPLAIN.examLoss}</Explain>
      </div>
    </div>
  )
}
