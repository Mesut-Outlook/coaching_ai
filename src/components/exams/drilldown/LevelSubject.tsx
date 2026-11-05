import { useState } from 'react'
import { formatNetTr } from '../../../lib/homeSummaryCore'
import { allTopicLosses, recentStat, trendPoints } from '../../../lib/examDrilldown'
import { getMasteryBand, type TopicRowData } from '../../../lib/examReport'
import ExamLineChart from '../../charts/ExamLineChart'
import LossBarChart from '../../charts/LossBarChart'
import Sparkline from '../../charts/Sparkline'
import StackedColumnChart from '../../charts/StackedColumnChart'
import LevelHeader from './LevelHeader'
import type { DrillProps } from './types'
import { cardStyle, niceStep, reasonItems, shortDate, signed } from './format'
import { BandChip, Explain, Legend, SegToggle, Stat, StatGrid } from './ui'
import { ReasonChips, TopicActions } from './TopicActions'

type SortKey = 'karne' | 'zayif' | 'dusen'

export default function LevelSubject(props: DrillProps) {
  const { report, role, palette: pal, state, go } = props
  const [metric, setMetric] = useState<'net' | 'acc'>('net')
  const [sort, setSort] = useState<SortKey>('karne')

  const row = report.subjects.rows.find((r) => r.exam_subject_id === state.examSubjectId) ?? report.subjects.rows[0]
  if (!row) {
    return <div className="card" style={{ ...cardStyle, textAlign: 'center', color: pal.textMuted }}>Ders bulunamadı.</div>
  }
  const series = report.general.time_series
  const tl = report.topicsBySubject[row.exam_subject_id]
  const topicRows: TopicRowData[] = tl?.rows ?? []
  const hl = state.examId ? series.findIndex((p) => p.exam_id === state.examId) : -1
  const toggleExam = (i: number) => go({ examId: series[i].exam_id === state.examId ? null : series[i].exam_id })
  const isNet = metric === 'net'
  const q = row.question_count

  const entered = row.cells.filter((c) => c.entered)
  const first = entered[0]
  const last = entered[entered.length - 1]
  const l3 = recentStat(row.cells)
  const vals = row.cells.map((c) => (c.entered ? (isNet ? c.net : c.accuracy_pct) : null))
  const known = vals.filter((v): v is number => v != null)
  const avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : undefined
  const yMax = isNet ? Math.max(q, 1) : 100
  const step = isNet ? niceStep(q) : 25
  const ticks = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, k) => k * step)

  const stats = topicRows.map((r) => ({ r, s: recentStat(r.cells), tr: trendPoints(r.cells) }))
  const weakest = stats.filter((x) => x.s.acc != null).sort((a, b) => a.s.acc! - b.s.acc!)[0]
  const sorted = sort === 'karne' ? stats
    : [...stats].sort((a, b) => {
        const av = sort === 'zayif' ? a.s.acc : a.tr
        const bv = sort === 'zayif' ? b.s.acc : b.tr
        return (av ?? 1e9) - (bv ?? 1e9)
      })
  const headline =
    tl?.headline ||
    report.subjects.top_loss_headline ||
    (weakest ? `En zayıf konu ${weakest.r.name} (%${weakest.s.acc!.toFixed(0)}).` : `${row.label}: konu detayı girilmemiş.`)
  const losses = allTopicLosses(report, row.exam_subject_id, 10).filter((l) => l.total_loss_net > 0)
  const maxQ = Math.max(1, ...row.cells.map((c) => c.question_count))
  const dybStep = niceStep(maxQ)
  const dybTicks = Array.from({ length: Math.floor(maxQ / dybStep) + 1 }, (_, k) => k * dybStep)
  const goTopic = (examTopicId: number, examId?: string) =>
    go({ level: 'topic', examTopicId, examSubjectId: row.exam_subject_id, ...(examId ? { examId } : {}) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <LevelHeader headline={headline} pal={pal} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, color: pal.textMuted }}>{row.section_name} · {q} soru</div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: pal.text }}>{row.label}</h3>
        </div>
        {hl >= 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => go({ examId: null })}>
            Seçili: {series[hl].exam_name} ✕
          </button>
        )}
      </div>

      <StatGrid>
        <Stat pal={pal} k="Son net" v={last ? formatNetTr(last.net) : '—'} s={`/ ${q}`} />
        <Stat pal={pal} k="Ortalama" v={entered.length ? formatNetTr(row.average_net) : '—'} s="net" />
        <Stat pal={pal} k="İlk → son" v={entered.length > 1 ? signed(last.net - first.net) : '—'} s="net" />
        <Stat pal={pal} k="Son 3 deneme başarı" v={l3.acc != null ? `%${l3.acc.toFixed(0)}` : '—'} />
      </StatGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
        <div className="card" style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700 }}>{row.label} gelişimi</h4>
            <SegToggle pal={pal} label="Ölçü" value={metric} onChange={setMetric} options={[['net', 'Net'], ['acc', 'Başarı %']]} />
          </div>
          <div style={{ fontSize: 12, color: pal.textMuted, margin: '4px 0 10px' }}>Bir denemeye tıkla → tabloda o sütun vurgulanır</div>
          <ExamLineChart
            palette={pal}
            data={series.map((p, i) => ({ label: p.exam_name, date: p.exam_date, value: vals[i] }))}
            average={avg}
            yMin={0}
            yMax={yMax}
            ticks={ticks}
            tickFormat={isNet ? undefined : (v) => `%${v}`}
            bands={!isNet}
            unit={isNet ? 'net' : '%'}
            highlightIndex={hl >= 0 ? hl : null}
            onPointClick={toggleExam}
            ariaLabel={`${row.label} gelişimi`}
            tooltip={(i) => {
              const c = row.cells[i]
              return (
                <>
                  <b>{series[i].exam_name}</b> · {shortDate(series[i].exam_date)}
                  <br />
                  {c.entered ? (
                    <>Net <b>{formatNetTr(c.net)}</b> / {c.question_count} · %{c.accuracy_pct.toFixed(0)}<br />D {c.correct_count} · Y {c.wrong_count} · B {c.blank_count}</>
                  ) : 'Ders sonucu girilmedi'}
                </>
              )
            }}
          />
          <Explain role={role} pal={pal}>Çizgi bu dersteki netin denemeden denemeye nasıl değiştiğini gösteriyor.</Explain>
        </div>

        <div className="card" style={cardStyle}>
          <h4 style={{ fontSize: 14, fontWeight: 700 }}>Doğru / yanlış / boş dağılımı</h4>
          <div style={{ fontSize: 12, color: pal.textMuted, margin: '4px 0 0' }}>Boşlar azalıp doğrular artıyorsa öğrenci konuya güveniyor</div>
          <Legend pal={pal} items={[{ name: 'Doğru', color: pal.success }, { name: 'Yanlış', color: pal.critical }, { name: 'Boş', color: pal.blank }]} />
          <StackedColumnChart
            palette={pal}
            ariaLabel={`${row.label} doğru yanlış boş`}
            yMax={maxQ}
            ticks={dybTicks}
            highlightIndex={hl >= 0 ? hl : null}
            onColumnClick={toggleExam}
            columns={row.cells.map((c, i) => ({
              label: series[i].exam_name,
              subLabel: shortDate(series[i].exam_date),
              topLabel: c.entered ? `${c.correct_count}D` : undefined,
              parts: c.entered
                ? [
                    { value: c.correct_count, color: pal.success, name: 'Doğru' },
                    { value: c.wrong_count, color: pal.critical, name: 'Yanlış' },
                    { value: c.blank_count, color: pal.blank, name: 'Boş' },
                  ]
                : null,
            }))}
            tooltip={(i) => {
              const c = row.cells[i]
              return (
                <>
                  <b>{series[i].exam_name}</b>
                  <br />
                  {c.entered ? `Doğru ${c.correct_count} · Yanlış ${c.wrong_count} · Boş ${c.blank_count}` : 'Ders sonucu girilmedi'}
                </>
              )
            }}
          />
        </div>
      </div>

      <div className="card" style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h4 style={{ fontSize: 14, fontWeight: 700 }}>Konu konu başarı</h4>
          <SegToggle
            pal={pal}
            label="Sıralama"
            value={sort}
            onChange={setSort}
            options={[['karne', 'Karne sırası'], ['zayif', 'En zayıf'], ['dusen', 'En çok düşen']]}
          />
        </div>
        <div style={{ fontSize: 12, color: pal.textMuted, margin: '4px 0 10px' }}>
          Hücre = o denemedeki başarı yüzdesi · satıra ya da hücreye tıkla → konu grafiği
        </div>
        {topicRows.length === 0 ? (
          <div style={{ fontSize: 13, color: pal.textMuted, textAlign: 'center', padding: 16 }}>Bu derste konu detayı girilmemiş.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${pal.border}`, color: pal.textMuted }}>
                  <th style={{ textAlign: 'left', padding: '8px', minWidth: 140 }}>Konu</th>
                  {series.map((p, i) => (
                    <th key={p.exam_id} style={{ textAlign: 'center', padding: '8px 4px', minWidth: 48, background: i === hl ? pal.primaryArea : undefined }}>
                      <div style={{ fontWeight: 600 }}>{p.exam_name}</div>
                      <div style={{ fontSize: 9, fontWeight: 400 }}>{shortDate(p.exam_date)}</div>
                    </th>
                  ))}
                  <th style={{ padding: '8px' }}>Soru</th>
                  <th style={{ padding: '8px' }}>Son 3</th>
                  <th style={{ padding: '8px' }}>Eğilim</th>
                  <th style={{ padding: '8px' }}>Durum</th>
                  {role === 'coach' && <th style={{ padding: '8px' }}>İşlem</th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ r, s }) => (
                  <tr key={r.exam_topic_id} onClick={() => goTopic(r.exam_topic_id)} style={{ borderBottom: `1px solid var(--border-soft)`, cursor: 'pointer' }}>
                    <td style={{ padding: '8px' }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); goTopic(r.exam_topic_id) }}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: pal.primary, fontWeight: 600, fontSize: 12, textAlign: 'left' }}
                      >
                        {r.name}
                      </button>
                      {role === 'coach' && <ReasonChips items={reasonItems(props, r.exam_topic_id)} />}
                    </td>
                    {r.cells.map((c, i) => (
                      <td key={c.exam_id} style={{ textAlign: 'center', padding: 4, background: i === hl ? pal.primaryArea : undefined }}>
                        {c.entered && c.accuracy_pct != null ? (
                          <button
                            type="button"
                            title={`${c.correct_count}D ${c.wrong_count}Y ${c.blank_count}B`}
                            onClick={(e) => { e.stopPropagation(); goTopic(r.exam_topic_id, c.exam_id) }}
                            style={{
                              border: 'none', cursor: 'pointer', borderRadius: 5, padding: '3px 6px', minWidth: 34, fontSize: 11.5, fontWeight: 700,
                              background: pal.bandBg[getMasteryBand(c.accuracy_pct) as 'good' | 'medium' | 'weak'] ?? 'var(--surface-alt)',
                              color: pal.text,
                            }}
                          >
                            {c.accuracy_pct.toFixed(0)}
                          </button>
                        ) : (
                          <span title="Konu girilmedi" style={{ color: pal.textMuted }}>—</span>
                        )}
                      </td>
                    ))}
                    <td style={{ textAlign: 'center', padding: 8 }}>{r.total_questions}</td>
                    <td style={{ textAlign: 'center', padding: 8, fontWeight: 700 }}>{s.acc != null ? `%${s.acc.toFixed(0)}` : '—'}</td>
                    <td style={{ textAlign: 'center', padding: 8 }}>
                      <Sparkline values={r.cells.filter((c) => c.entered && c.accuracy_pct != null).map((c) => c.accuracy_pct!)} width={64} height={22} max={100} />
                    </td>
                    <td style={{ textAlign: 'center', padding: 8 }}><BandChip band={s.band} pal={pal} /></td>
                    {role === 'coach' && (
                      <td style={{ textAlign: 'center', padding: 6 }}>
                        <TopicActions row={r} subjectLabel={row.label} p={props} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ fontSize: 11.5, color: pal.textMuted, marginTop: 8 }}>"Son 3" ve Durum: konu detayı girilmiş son 3 denemenin toplamı. "—" o denemede konu detayının girilmediğini gösterir.</div>
        <Explain role={role} pal={pal}>Yeşil hücre iyi (%75 ve üstü), sarı gelişiyor, kırmızı zayıf. Hücredeki sayı başarı yüzdesidir.</Explain>
      </div>

      <div className="card" style={cardStyle}>
        <h4 style={{ fontSize: 14, fontWeight: 700 }}>Toplamda en çok net kaybettiren konular</h4>
        <div style={{ fontSize: 12, color: pal.textMuted, margin: '4px 0 10px' }}>Bu dersin tüm denemelerdeki birikimli kaybı · bir konuya tıkla</div>
        <LossBarChart
          palette={pal}
          maxItems={10}
          items={losses.map((l) => ({ label: l.name, subLabel: l.subject_label, lossNet: l.total_loss_net, totalQuestions: l.total_questions }))}
          onItemClick={(i) => goTopic(losses[i].exam_topic_id)}
        />
      </div>
    </div>
  )
}
