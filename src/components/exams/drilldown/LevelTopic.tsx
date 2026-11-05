import { curriculumSeries, recentStat, trendPoints } from '../../../lib/examDrilldown'
import ExamLineChart from '../../charts/ExamLineChart'
import StackedColumnChart from '../../charts/StackedColumnChart'
import LevelHeader from './LevelHeader'
import type { DrillProps } from './types'
import { cardStyle, niceStep, reasonItems, shortDate, signed } from './format'
import { BandChip, Explain, Legend, Stat, StatGrid } from './ui'
import { ReasonChips, TopicActions } from './TopicActions'

export default function LevelTopic(props: DrillProps) {
  const { report, catalog, role, palette: pal, state, go } = props
  const found = Object.values(report.topicsBySubject).find((t) => t.rows.some((r) => r.exam_topic_id === state.examTopicId))
  const row = found?.rows.find((r) => r.exam_topic_id === state.examTopicId)
  if (!found || !row) {
    return (
      <div className="card" style={{ ...cardStyle, textAlign: 'center', color: pal.textMuted }}>
        Konu bulunamadı.{' '}
        <button type="button" onClick={() => go({ level: 'general', examId: null, examSubjectId: null, examTopicId: null })} style={{ background: 'none', border: 'none', color: pal.primary, cursor: 'pointer', fontWeight: 600 }}>
          Tüm denemelere dön
        </button>
      </div>
    )
  }
  const series = report.general.time_series
  const hl = state.examId ? series.findIndex((p) => p.exam_id === state.examId) : -1
  const toggleExam = (i: number) => go({ examId: series[i].exam_id === state.examId ? null : series[i].exam_id })
  const entered = row.cells.filter((c) => c.entered)
  const st = recentStat(row.cells)
  const tr = trendPoints(row.cells)
  const perExam = Math.max(0, ...entered.map((c) => c.question_count))
  const mine = reasonItems(props, row.exam_topic_id)

  const headline =
    st.acc == null
      ? `${row.name}: konu detayı henüz girilmemiş.`
      : `Son 3 denemede %${st.acc.toFixed(0)} başarı${tr != null ? `; önceki denemelere göre ${tr >= 0 ? '+' : '−'}${Math.abs(tr).toFixed(0)} yüzde puanı` : ''}. Toplam ${row.total_questions} sorudan ${row.total_correct} doğru.`

  const q = Math.max(perExam, 1)
  const dybStep = niceStep(q)
  const dybTicks = Array.from({ length: Math.floor(q / dybStep) + 1 }, (_, k) => k * dybStep)

  // Müfredatta karşılığı: links undefined ⇒ bilgi yok
  const links = catalog.links
  const mineLinks = (links ?? []).filter((l) => l.exam_topic_id === row.exam_topic_id)
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
  const currCard = () => {
    if (!links) return <div style={{ fontSize: 13, color: pal.textMuted }}>Bağlantı bilgisi yok</div>
    if (mineLinks.length === 0) return <div style={{ fontSize: 13, color: pal.textMuted }}>Bu karne konusu müfredattaki bir konuya bağlanmamış.</div>
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mineLinks.map((l) => {
          const cu = catalog.curriculumTopics?.find((c) => c.id === l.topic_id)
          const cells = curriculumSeries(report, links, l.topic_id).map((pt) => ({ entered: !!pt, question_count: pt?.question_count ?? 0, correct_count: pt?.correct ?? 0 }))
          return (
            <button
              key={l.topic_id}
              type="button"
              onClick={() => go({ level: 'curriculum', curriculumTopicId: l.topic_id })}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, textAlign: 'left', cursor: 'pointer', background: 'var(--surface-alt)', border: `1px solid ${pal.border}`, borderRadius: 8, padding: '8px 10px', color: pal.text }}
            >
              <span style={{ minWidth: 0 }}>
                <b style={{ fontSize: 13 }}>{cu?.name ?? 'Müfredat konusu'}</b>
                {cu?.subject_name && <span style={{ fontSize: 11.5, color: pal.textMuted }}> · {cu.subject_name}</span>}
                <br />
                <span style={{ fontSize: 11.5, color: l.is_primary ? pal.primary : pal.textMuted, fontWeight: l.is_primary ? 700 : 500 }}>
                  {l.is_primary ? 'Birincil · deneme sonucu buraya yansır' : 'Bağlı · sonuç yansımaz'}
                </span>
              </span>
              {l.is_primary ? <BandChip band={recentStat(cells).band} pal={pal} /> : <span style={{ fontSize: 11, fontWeight: 700, color: pal.textMuted, whiteSpace: 'nowrap' }}>Yansımaz</span>}
            </button>
          )
        })}
      </div>
    )
  }

  const good = st.band === 'good'
  const nextStep = st.band === 'none'
    ? 'Bu konu için henüz konu detayı girilmemiş.'
    : role === 'student'
      ? good ? 'Bu konu yerine oturmuş. Haftada bir kısa tekrar yeterli.' : 'Koçun bu konuyu programına ekleyebilir. Yanlışlarını not et, görüşmede birlikte bakın.'
      : good ? 'Çocuğunuz bu konuda iyi durumda.' : 'Bu konu henüz yerine oturmamış. Koç programda bu konuya zaman ayıracak; evde ek bir şey yapmanız gerekmiyor.'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <LevelHeader headline={headline} pal={pal} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, color: pal.textMuted }}>{found.subject_label} · karne konusu{perExam > 0 ? ` · denemede ${perExam} soru` : ''}</div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: pal.text }}>{row.name}</h3>
        </div>
        <BandChip band={st.band} pal={pal} />
      </div>

      <StatGrid>
        <Stat pal={pal} k="Son 3 deneme başarı" v={st.acc != null ? `%${st.acc.toFixed(0)}` : '—'} />
        <Stat pal={pal} k="Eğilim" v={tr != null ? signed(tr) : '—'} s="yüzde puanı" />
        <Stat pal={pal} k="Toplam D / Y / B" v={`${row.total_correct} / ${row.total_wrong} / ${row.total_blank}`} />
        <Stat pal={pal} k="Toplam soru" v={row.total_questions} s={`${entered.length} deneme`} />
      </StatGrid>

      {entered.length > 0 && perExam <= 1 && (
        <div role="note" style={{ fontSize: 13, background: 'var(--warning-bg)', color: 'var(--warning-text)', borderRadius: 8, padding: '8px 12px', lineHeight: 1.5 }}>
          Bu konu denemede 1 soru çıkıyor; tek denemede %0 ya da %100 görmek normal. Tek noktaya değil, birkaç denemelik eğilime bak.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
        <div className="card" style={cardStyle}>
          <h4 style={{ fontSize: 14, fontWeight: 700 }}>Konu başarısı</h4>
          <div style={{ fontSize: 12, color: pal.textMuted, margin: '4px 0 10px' }}>Bantlar: %75 üstü Yeterli · %50–75 Gelişiyor · altı Kritik</div>
          <ExamLineChart
            palette={pal}
            minPoints={1}
            nullLabel="girilmedi"
            data={series.map((p, i) => ({ label: p.exam_name, date: p.exam_date, value: row.cells[i]?.entered ? row.cells[i].accuracy_pct : null }))}
            yMin={0}
            yMax={100}
            ticks={[0, 25, 50, 75, 100]}
            tickFormat={(v) => `%${v}`}
            bands
            unit="%"
            highlightIndex={hl >= 0 ? hl : null}
            onPointClick={toggleExam}
            ariaLabel={`${row.name} başarı`}
            tooltip={(i) => {
              const c = row.cells[i]
              return (
                <>
                  <b>{series[i].exam_name}</b> · {shortDate(series[i].exam_date)}
                  <br />
                  {c?.entered && c.accuracy_pct != null
                    ? <>%{c.accuracy_pct.toFixed(0)} · D {c.correct_count} · Y {c.wrong_count} · B {c.blank_count}</>
                    : 'Konu girilmedi'}
                </>
              )
            }}
          />
          <Explain role={role} pal={pal}>Nokta yeşil banda ne kadar yakınsa konu o kadar iyi oturmuş demektir.</Explain>
        </div>
        <div className="card" style={cardStyle}>
          <h4 style={{ fontSize: 14, fontWeight: 700 }}>Soru soru dağılım</h4>
          <div style={{ fontSize: 12, color: pal.textMuted, margin: '4px 0 0' }}>Her denemede bu konudan çıkan sorular</div>
          <Legend pal={pal} items={[{ name: 'Doğru', color: pal.success }, { name: 'Yanlış', color: pal.critical }, { name: 'Boş', color: pal.blank }]} />
          <StackedColumnChart
            palette={pal}
            ariaLabel={`${row.name} doğru yanlış boş`}
            yMax={q}
            ticks={dybTicks}
            highlightIndex={hl >= 0 ? hl : null}
            onColumnClick={toggleExam}
            columns={row.cells.map((c, i) => ({
              label: series[i].exam_name,
              subLabel: shortDate(series[i].exam_date),
              topLabel: c.entered ? `${c.correct_count}/${c.question_count}` : undefined,
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
                  {c.entered ? `Doğru ${c.correct_count} · Yanlış ${c.wrong_count} · Boş ${c.blank_count}` : 'Konu girilmedi'}
                </>
              )
            }}
          />
          <Explain role={role} pal={pal}>Kırmızı (yanlış) çoksa konu yanlış öğrenilmiş olabilir; gri (boş) çoksa öğrenci konuya henüz güvenmiyor.</Explain>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
        <div className="card" style={cardStyle}>
          <h4 style={{ fontSize: 14, fontWeight: 700 }}>Müfredatta karşılığı</h4>
          <div style={{ fontSize: 12, color: pal.textMuted, margin: '4px 0 10px' }}>
            Karne konusu → Konu Yeterlilik Haritası'ndaki konu · tıkla → müfredat konusunun bütün ölçümleri
          </div>
          {currCard()}
        </div>
        {role === 'coach' ? (
          <div className="card" style={cardStyle}>
            <h4 style={{ fontSize: 14, fontWeight: 700 }}>Koç işlemleri</h4>
            <div style={{ margin: '10px 0' }}>
              <TopicActions row={row} subjectLabel={found.subject_label} p={props} />
              <ReasonChips items={mine} />
            </div>
            <div style={{ fontSize: 12, color: pal.textMuted }}>Yanlış oranı yüksekse konu tekrarı, boş oranı yüksekse temel anlatım + kolay test önerilir.</div>
          </div>
        ) : (
          <div className="card" style={cardStyle}>
            <h4 style={{ fontSize: 14, fontWeight: 700 }}>{role === 'student' ? 'Sıradaki adım' : 'Bu ne anlama geliyor'}</h4>
            <div style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.55, color: pal.text, background: 'var(--surface-alt)', borderRadius: 8, padding: '10px 12px' }}>{nextStep}</div>
          </div>
        )}
      </div>
    </div>
  )
}
