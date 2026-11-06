import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle, Lightbulb } from 'lucide-react'
import type { RoleInsightItem } from '../../../lib/examInsights'
import { formatNetTr } from '../../../lib/homeSummaryCore'
import { allTopicLosses, examDetail, groupNetsByExam, recentStat } from '../../../lib/examDrilldown'
import type { SubjectRowData } from '../../../lib/examReport'
import ExamLineChart from '../../charts/ExamLineChart'
import LossBarChart from '../../charts/LossBarChart'
import Sparkline from '../../charts/Sparkline'
import StackedColumnChart from '../../charts/StackedColumnChart'
import { groupColorMap } from '../../charts/chartPalette'
import { EXPLAIN, roleText } from './copy'
import LevelHeader from './LevelHeader'
import type { DrillProps } from './types'
import { cardStyle, niceStep, shortDate, signed } from './format'
import { BandChip, Explain, Legend, SegToggle, Stat, StatGrid } from './ui'

/** ilk 2 → son 2 girilmiş ders hücresinin ortalama başarı farkı (puan); <4 hücrede null. */
function firstLastDiff(row: SubjectRowData): number | null {
  const acc = row.cells.filter((c) => c.entered).map((c) => c.accuracy_pct)
  if (acc.length < 4) return null
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  return avg(acc.slice(-2)) - avg(acc.slice(0, 2))
}

function Arrow({ d, pal }: { d: number | null; pal: DrillProps['palette'] }) {
  if (d == null) return <span style={{ color: pal.textMuted }}>—</span>
  const n = Math.abs(d).toFixed(0)
  if (d > 3) return <span style={{ color: pal.success, fontWeight: 700 }}>▲ {n}</span>
  if (d < -3) return <span style={{ color: pal.critical, fontWeight: 700 }}>▼ {n}</span>
  return <span style={{ color: pal.textMuted, fontWeight: 700 }}>● {n}</span>
}

export default function LevelGeneral({
  report, exams, role, palette: pal, targets, go, insights,
}: DrillProps & { insights: RoleInsightItem[] }) {
  const { general, subjects } = report
  const [netView, setNetView] = useState<'grafik' | 'tablo'>('grafik')
  const [subjView, setSubjView] = useState<'kart' | 'tablo'>('kart')
  const [lossFilter, setLossFilter] = useState<number | 'ALL'>('ALL')
  const isLgs = report.exam_type === 'LGS'
  const series = general.time_series
  const target = targets[report.exam_type] ?? null
  const nets = series.map((p) => p.net)
  const hasTopics = useMemo(() => series.map((p) => examDetail(report, p.exam_id)?.hasTopics ?? false), [report, series])
  const topicSubject = useMemo(() => {
    const m = new Map<number, number>()
    for (const t of Object.values(report.topicsBySubject)) for (const r of t.rows) m.set(r.exam_topic_id, t.exam_subject_id)
    return m
  }, [report])
  const goExam = (i: number) => go({ level: 'exam', examId: series[i].exam_id })

  const last = general.latest_exam
  const lastRaw = exams.find((e) => e.id === last?.id)
  const kurum = lastRaw?.ranks?.['Kurum']
  const lastLine = [
    lastRaw?.score != null && <span key="s">{isLgs ? 'karne toplamı' : 'puan'} <b>{formatNetTr(lastRaw.score)}</b></span>,
    lastRaw?.percentile != null && <span key="p">yüzdelik %{formatNetTr(lastRaw.percentile)}</span>,
    kurum?.sira != null && <span key="k">kurum sırası {kurum.sira}{kurum.katilan != null && `/${kurum.katilan}`}</span>,
    lastRaw?.coach_note && <i key="n">Koç notu: "{lastRaw.coach_note}"</i>,
  ].filter(Boolean)

  // Net hangi dersten geliyor
  const groupData = useMemo(() => groupNetsByExam(report, exams), [report, exams])
  const groupNames = useMemo(() => {
    const names: string[] = []
    for (const g of groupData) for (const p of g.groups) if (!names.includes(p.section_name)) names.push(p.section_name)
    return names
  }, [groupData])
  const colorMap = useMemo(() => groupColorMap(pal, groupNames), [pal, groupNames])
  const groupColors = groupNames.map((n) => colorMap.get(n) ?? pal.blank)
  const maxTotal = Math.max(1, ...groupData.map((g) => g.groups.reduce((a, p) => a + Math.max(0, p.net), 0)))
  const step = niceStep(maxTotal)
  const groupMax = Math.ceil(maxTotal / step) * step
  const groupTicks = Array.from({ length: groupMax / step + 1 }, (_, k) => k * step)

  const lossItems = allTopicLosses(report, lossFilter, 10).filter((r) => r.total_loss_net > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <LevelHeader headline={general.headline} pal={pal} />

      {last ? (
        <>
          <StatGrid>
            <Stat pal={pal} k="Son deneme" v={formatNetTr(last.net)} s={`/ ${last.question_count} net`} />
            <Stat pal={pal} k="Ortalama" v={formatNetTr(general.average_net)} s="net" />
            <Stat pal={pal} k="İlk → son" v={series.length > 1 ? signed(nets[nets.length - 1] - nets[0]) : '—'} s="net" />
            {target != null && <Stat pal={pal} k="Hedef" v={formatNetTr(target)} s="net" />}
          </StatGrid>
          {lastLine.length > 0 && (
            <div style={{ fontSize: 12.5, color: pal.textMuted }}>
              {last.name}: {lastLine.map((x, i) => <span key={i}>{i > 0 && ' · '}{x}</span>)}
            </div>
          )}
        </>
      ) : (
        <div style={{ color: pal.textMuted, fontSize: 13 }}>Veri bulunmuyor.</div>
      )}

      <div className="card" style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700 }}>{roleText(role, { coach: 'Toplam net gelişimi', student: 'Netin nasıl değişti', parent: 'Toplam net gelişimi' })} ({report.exam_type})</h4>
          <SegToggle pal={pal} label="Görünüm" value={netView} onChange={setNetView} options={[['grafik', 'Grafik'], ['tablo', 'Tablo']]} />
        </div>
        <div style={{ fontSize: 12, color: pal.textMuted, margin: '4px 0 12px' }}>Bir denemeye tıkla → o denemenin ders ve konu dökümü</div>
        {netView === 'grafik' ? (
          <ExamLineChart
            data={series.map((p) => ({ label: p.exam_name, date: p.exam_date, value: p.net, subValue: p.accuracy_pct }))}
            average={general.average_net}
            refs={target != null ? [{ value: target, label: `Hedef ${formatNetTr(target)}` }] : undefined}
            palette={pal}
            minThresholdNotice={general.min_data_notice}
            onPointClick={goExam}
            ariaLabel="Toplam net gelişimi"
            tooltip={(i) => (
              <>
                <b>{series[i].exam_name}</b> · {shortDate(series[i].exam_date)}
                <br />
                Net <b>{formatNetTr(series[i].net)}</b> · başarı %{series[i].accuracy_pct.toFixed(0)}
                {!hasTopics[i] && <><br />Konu detayı girilmedi</>}
              </>
            )}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${pal.border}`, color: pal.textMuted }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Deneme</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px' }}>Tarih</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px' }}>Net</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px' }}>Başarı %</th>
                </tr>
              </thead>
              <tbody>
                {series.map((p, i) => (
                  <tr key={p.exam_id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    <td style={{ padding: '6px 10px' }}>
                      <button type="button" onClick={() => goExam(i)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: pal.primary, fontWeight: 600, fontSize: 13, textAlign: 'left' }}>
                        {p.exam_name}
                      </button>
                    </td>
                    <td style={{ padding: '10px', color: pal.textMuted, whiteSpace: 'nowrap' }}>{shortDate(p.exam_date)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: pal.primary }}>{formatNetTr(p.net)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: pal.textMuted }}>%{p.accuracy_pct.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Explain role={role} pal={pal}>{EXPLAIN.totalNet}</Explain>
      </div>

      <div className="card" style={cardStyle}>
        <h4 style={{ fontSize: 14, fontWeight: 700 }}>Net hangi dersten geliyor</h4>
        <div style={{ fontSize: 12, color: pal.textMuted, margin: '4px 0' }}>Her sütun bir deneme; renkler ders grupları</div>
        <Legend pal={pal} items={groupNames.map((n, i) => ({ name: n, color: groupColors[i] }))} />
        <StackedColumnChart
          palette={pal}
          ariaLabel="Ders gruplarına göre net"
          yMax={groupMax}
          ticks={groupTicks}
          onColumnClick={goExam}
          columns={series.map((p, i) => {
            const groups = groupData[i].groups
            return {
              label: p.exam_name,
              subLabel: shortDate(p.exam_date),
              topLabel: String(Math.round(nets[i])),
              parts: groups.map((g) => ({ value: Math.max(0, g.net), color: groupColors[groupNames.indexOf(g.section_name)], name: g.section_name })),
            }
          })}
          tooltip={(i) => (
            <>
              <b>{series[i].exam_name}</b>
              {groupData[i].groups.map((g) => (
                <div key={g.section_name}>{g.section_name}: <b>{formatNetTr(g.net)}</b></div>
              ))}
            </>
          )}
        />
        <Explain role={role} pal={pal}>{EXPLAIN.groups}</Explain>
      </div>

      <div className="card" style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700 }}>Derslerin gelişimi</h4>
          <SegToggle pal={pal} label="Ders görünümü" value={subjView} onChange={setSubjView} options={[['kart', 'Kartlar'], ['tablo', 'Isı tablosu']]} />
        </div>
        <div style={{ fontSize: 12, color: pal.textMuted, margin: '4px 0 12px' }}>
          Bir derse tıkla → konu konu dökümü ve büyük grafik{subjView === 'tablo' && ' · hücreye tıkla → o deneme vurgulu'}
        </div>
        {subjView === 'kart' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
            {subjects.rows.map((row) => {
              const entered = row.cells.filter((c) => c.entered)
              return (
                <button
                  key={row.exam_subject_id}
                  type="button"
                  onClick={() => go({ level: 'subject', examSubjectId: row.exam_subject_id })}
                  style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', font: 'inherit', color: pal.text, background: 'var(--surface-alt)', border: `1px solid ${pal.border}`, borderRadius: 10, padding: 12, cursor: 'pointer' }}
                >
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, minWidth: 0 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: colorMap.get(row.section_name) ?? pal.blank }} />
                      {row.label}
                    </span>
                    <BandChip band={recentStat(row.cells).band} pal={pal} />
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 20, fontWeight: 800 }}>
                      {row.latest_net != null ? formatNetTr(row.latest_net) : '—'} <span style={{ fontSize: 11.5, fontWeight: 500, color: pal.textMuted }}>/ {row.question_count}</span>
                    </span>
                    <Arrow d={firstLastDiff(row)} pal={pal} />
                  </span>
                  <Sparkline values={entered.map((c) => c.net)} max={row.question_count} width={176} height={30} />
                  <span style={{ fontSize: 10.5, color: pal.textMuted }}>
                    ilk 2 → son 2 deneme, {isLgs ? 'başarı yüzdesi' : 'başarı puanı'} farkı
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${pal.border}`, color: pal.textMuted }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px' }}>Ders</th>
                  {series.map((p) => (
                    <th key={p.exam_id} style={{ textAlign: 'center', padding: '10px 6px', minWidth: 64 }}>
                      <div style={{ fontWeight: 600 }}>{p.exam_name}</div>
                      <div style={{ fontSize: 9.5 }}>{shortDate(p.exam_date)}</div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'right', padding: '10px 8px' }}>Ortalama</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px' }}>Son Net</th>
                </tr>
              </thead>
              <tbody>
                {subjects.rows.map((row) => (
                  <tr key={row.exam_subject_id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <button type="button" onClick={() => go({ level: 'subject', examSubjectId: row.exam_subject_id })} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: pal.primary, fontWeight: 600, fontSize: 12.5, textAlign: 'left' }}>
                        {row.label}
                      </button>
                    </td>
                    {row.cells.map((cell) =>
                      !cell.entered ? (
                        <td key={cell.exam_id} style={{ textAlign: 'center', padding: 8, color: pal.textMuted }}>—</td>
                      ) : (
                        <td key={cell.exam_id} style={{ textAlign: 'center', padding: 4 }}>
                          <button
                            type="button"
                            title={`${row.label} · ${cell.exam_name}`}
                            onClick={() => go({ level: 'subject', examSubjectId: row.exam_subject_id, examId: cell.exam_id })}
                            style={{
                              width: '100%', border: 'none', cursor: 'pointer', borderRadius: 6, padding: '4px 6px', fontSize: 11.5, fontWeight: 700,
                              color: pal.text, background: cell.band === 'none' ? 'var(--surface-alt)' : pal.bandBg[cell.band],
                            }}
                          >
                            {formatNetTr(cell.net)}
                            <br />
                            <span style={{ fontWeight: 400, fontSize: 10 }}>%{cell.accuracy_pct.toFixed(0)}</span>
                          </button>
                        </td>
                      ),
                    )}
                    <td style={{ textAlign: 'right', padding: '8px', fontWeight: 700 }}>{formatNetTr(row.average_net)}</td>
                    <td style={{ textAlign: 'right', padding: '8px', fontWeight: 700, color: pal.primary }}>{row.latest_net != null ? formatNetTr(row.latest_net) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Explain role={role} pal={pal}>{subjView === 'tablo' ? EXPLAIN.cardsHeat : EXPLAIN.cardsCards}</Explain>
      </div>

      <div className="card" style={cardStyle}>
        <h4 style={{ fontSize: 14, fontWeight: 700 }}>Tüm denemelerde en çok net kaybettiren konular</h4>
        <div style={{ fontSize: 12, color: pal.textMuted, margin: '4px 0 10px' }}>Konu detayı girilen denemelerin toplamı · bir konuya tıkla</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {([['ALL', 'Tümü'], ...subjects.rows.map((s) => [s.exam_subject_id, s.label])] as Array<[number | 'ALL', string]>).map(([k, l]) => (
            <button
              key={k}
              type="button"
              aria-pressed={lossFilter === k}
              onClick={() => setLossFilter(k)}
              style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${lossFilter === k ? pal.primary : pal.border}`,
                background: lossFilter === k ? pal.primary : 'var(--surface-alt)',
                color: lossFilter === k ? 'var(--on-primary)' : pal.text,
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <LossBarChart
          palette={pal}
          maxItems={10}
          emptyText={lossFilter === 'ALL' ? 'Konu detayı girilmiş deneme yok.' : undefined}
          items={lossItems.map((r) => ({ label: r.name, subLabel: r.subject_label, lossNet: r.total_loss_net, totalQuestions: r.total_questions }))}
          onItemClick={(i) => go({ level: 'topic', examTopicId: lossItems[i].exam_topic_id, examSubjectId: topicSubject.get(lossItems[i].exam_topic_id) ?? null })}
        />
        <Explain role={role} pal={pal}>{EXPLAIN.allLoss}</Explain>
      </div>

      {insights.length > 0 && (
        <div className="card" style={cardStyle}>
          <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Lightbulb size={16} color={pal.warning} />
            {roleText(role, { coach: 'Görüşmede konuşulacaklar', student: 'Öne çıkanlar', parent: 'Öne çıkanlar' })}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insights.map((ins, i) => {
              const crit = !ins.is_positive && ins.severity === 'critical'
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, lineHeight: 1.5, color: pal.text,
                    background: ins.is_positive ? pal.bandBg.good : crit ? pal.bandBg.weak : 'var(--surface-alt)',
                    border: `1px solid ${ins.is_positive ? pal.success : crit ? pal.critical : pal.border}`,
                  }}
                >
                  {ins.is_positive ? (
                    <CheckCircle size={16} color={pal.success} style={{ flexShrink: 0, marginTop: 2 }} />
                  ) : (
                    <AlertCircle size={16} color={crit ? pal.critical : pal.textMuted} style={{ flexShrink: 0, marginTop: 2 }} />
                  )}
                  <div>{ins.text}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
