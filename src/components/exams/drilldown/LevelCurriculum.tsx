import { curriculumFeeders, curriculumSeries, homeworkPoints, recentStat } from '../../../lib/examDrilldown'
import ExamLineChart from '../../charts/ExamLineChart'
import LevelHeader from './LevelHeader'
import type { DrillProps } from './types'
import { cardStyle, shortDate } from './format'
import { BandChip, Explain, Legend, Stat, StatGrid } from './ui'


export default function LevelCurriculum({ report, catalog, role, palette: pal, state, go }: DrillProps) {
  const links = catalog.links
  const topicId = state.curriculumTopicId
  if (!links || topicId == null) {
    return (
      <div className="card" style={{ ...cardStyle, textAlign: 'center', color: pal.textMuted }}>
        Bağlantı bilgisi yok.{' '}
        <button type="button" onClick={() => go({ level: 'topic', curriculumTopicId: null })} style={{ background: 'none', border: 'none', color: pal.primary, cursor: 'pointer', fontWeight: 600 }}>
          Karne konusuna dön
        </button>
      </div>
    )
  }
  const cu = catalog.curriculumTopics?.find((c) => c.id === topicId)
  const series = report.general.time_series
  const ser = curriculumSeries(report, links, topicId)
  const hw = homeworkPoints(catalog.homework, topicId)
  const l3 = recentStat(ser.map((p) => ({ entered: !!p, question_count: p?.question_count ?? 0, correct_count: p?.correct ?? 0 })))
  const allRows = Object.values(report.topicsBySubject).flatMap((t) => t.rows.map((r) => ({ r, subject: t.subject_label, sid: t.exam_subject_id })))
  const feeders = curriculumFeeders(links, topicId)
  const primary = feeders.primary.map((id) => allRows.find((x) => x.r.exam_topic_id === id)).filter((x): x is NonNullable<typeof x> => !!x)
  const linked = feeders.linked.map((id) => allRows.find((x) => x.r.exam_topic_id === id)).filter((x): x is NonNullable<typeof x> => !!x)
  const perExamQ = primary.reduce((a, x) => a + Math.max(0, ...x.r.cells.filter((c) => c.entered).map((c) => c.question_count)), 0)

  const hwQ = hw.reduce((a, h) => a + (h.correct_count != null ? h.question_count : 0), 0)
  const hwAcc = hwQ > 0 ? (hw.reduce((a, h) => a + (h.correct_count ?? 0), 0) * 100) / hwQ : null

  // Tek kronolojik eksen: denemeler (daire) + ödev/test (kare); eşit tarihte deneme önce.
  type Ev = { kind: 'd'; i: number; date: string } | { kind: 'h'; h: (typeof hw)[number]; date: string }
  const ev: Ev[] = [
    ...series.map((p, i): Ev => ({ kind: 'd', i, date: p.exam_date })),
    ...hw.map((h): Ev => ({ kind: 'h', h, date: h.date })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const headline =
    primary.length === 0
      ? 'Bu müfredat konusuna birincil bağlı karne konusu yok; deneme sonucu yansımaz.'
      : `${primary.length} karne konusundan besleniyor. ${l3.acc != null ? `Son 3 denemede %${l3.acc.toFixed(0)}` : 'Denemede henüz ölçülmedi'}${hwAcc != null ? `, ödevlerde %${hwAcc.toFixed(0)}` : ''}.`

  const goTopic = (x: { r: { exam_topic_id: number }; sid: number }) => go({ level: 'topic', examTopicId: x.r.exam_topic_id, examSubjectId: x.sid, curriculumTopicId: null })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <LevelHeader headline={headline} pal={pal} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, color: pal.textMuted }}>{cu?.subject_name ? `${cu.subject_name} · ` : ''}müfredat konusu</div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: pal.text }}>{cu?.name ?? 'Müfredat konusu'}</h3>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: pal.textMuted }}>
          son 3 deneme <BandChip band={l3.band} pal={pal} />
        </span>
      </div>

      <StatGrid>
        <Stat pal={pal} k="Son 3 deneme başarı" v={l3.acc != null ? `%${l3.acc.toFixed(0)}` : '—'} />
        <Stat pal={pal} k="Besleyen karne konusu" v={primary.length} />
        <Stat pal={pal} k="Ödev ölçümü" v={hw.length || '—'} />
        <Stat pal={pal} k="Deneme başı soru" v={perExamQ || '—'} />
      </StatGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
        <div className="card" style={cardStyle}>
          <h4 style={{ fontSize: 14, fontWeight: 700 }}>Deneme ve ödev sonuçları</h4>
          <div style={{ fontSize: 12, color: pal.textMuted, margin: '4px 0 0' }}>Tarih sırasıyla; deneme sonuçları birincil karne konularının toplamı</div>
          <Legend pal={pal} items={[{ name: 'Deneme (daire)', color: pal.primary }, ...(hw.length ? [{ name: 'Ödev / test (kare)', color: pal.warning }] : [])]} />
          <ExamLineChart
            palette={pal}
            minPoints={1}
            data={ev.map((e) => ({
              label: e.kind === 'd' ? series[e.i].exam_name : e.h.kind === 'odev' ? 'Ödev' : 'Test',
              date: e.date,
              value: e.kind === 'd' ? (ser[e.i]?.accuracy_pct ?? null) : null,
            }))}
            secondSeries={hw.length ? { label: 'Ödev / test', color: pal.warning, values: ev.map((e) => (e.kind === 'h' ? e.h.accuracy_pct : null)) } : undefined}
            connectNulls
            seriesLabel="Deneme"
            yMin={0}
            yMax={100}
            ticks={[0, 25, 50, 75, 100]}
            tickFormat={(v) => `%${v}`}
            bands
            unit="%"
            ariaLabel={`${cu?.name ?? 'Müfredat konusu'} ölçümleri`}
            tooltip={(i) => {
              const e = ev[i]
              if (e.kind === 'd') {
                const pt = ser[e.i]
                return (
                  <>
                    <b>{series[e.i].exam_name}</b> · {shortDate(e.date)}
                    <br />
                    {pt ? <>%{pt.accuracy_pct.toFixed(0)} · {pt.correct}/{pt.question_count} doğru</> : 'Konu girilmedi'}
                  </>
                )
              }
              const h = e.h
              return (
                <>
                  <b>{h.kind === 'odev' ? 'Ödev' : 'Konu testi'}</b> · {shortDate(e.date)}
                  <br />
                  {h.label}
                  <br />
                  %{h.accuracy_pct.toFixed(0)}{h.correct_count != null && <> · {h.correct_count}/{h.question_count} doğru</>}
                </>
              )
            }}
          />
          {hw.length > 0 ? (
            <div style={{ fontSize: 12.5, color: pal.textMuted, marginTop: 8 }}>
              {role === 'coach'
                ? 'Ödevde %80 üstü, denemede düşük: bilgi var ama sınav koşulunda (süre, karışık soru) aktarılamıyor.'
                : role === 'student'
                  ? 'Ödevde iyisin; denemede aynı başarıyı süre baskısında yakalamaya çalış.'
                  : 'Evdeki ödevlerde başarı denemeden yüksek olabilir; bu sık görülür ve süreyle kapanır.'}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: pal.textMuted, marginTop: 8 }}>Bu konuda doğru/yanlış sayısı girilmiş ödev yok; yalnız deneme ölçümleri gösteriliyor.</div>
          )}
          {hwAcc != null && hwAcc >= 80 && l3.acc != null && l3.acc < hwAcc - 10 && (
            <Explain role={role} pal={pal}>Yuvarlaklar denemeler, kareler evde çözülen ödevler. İkisi birbirine yaklaştıkça konu sınavda da oturmuş demektir.</Explain>
          )}
          {hwAcc != null && l3.acc != null && l3.acc >= hwAcc - 10 && (
            <Explain role={role} pal={pal}>Evdeki ödevlerle denemeler birbirine yakın.</Explain>
          )}
        </div>

        <div className="card" style={cardStyle}>
          <h4 style={{ fontSize: 14, fontWeight: 700 }}>Bu konuyu besleyen karne konuları</h4>
          <div style={{ fontSize: 12, color: pal.textMuted, margin: '4px 0 10px' }}>1→N eşlemede deneme sonucu yalnız birincil konuya yansır</div>
          {primary.length === 0 && <div style={{ fontSize: 13, color: pal.textMuted }}>Bu sınav türünde birincil bağlı karne konusu yok.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {primary.map((x) => {
              const s = recentStat(x.r.cells)
              const color = s.band === 'good' ? pal.success : s.band === 'medium' ? pal.warning : s.band === 'weak' ? pal.critical : pal.blank
              return (
                <button
                  key={x.r.exam_topic_id}
                  type="button"
                  onClick={() => goTopic(x)}
                  style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) 44px', alignItems: 'center', gap: 8, textAlign: 'left', cursor: 'pointer', background: 'none', border: 'none', padding: 0, color: pal.text }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{x.r.name}<br /><small style={{ color: pal.textMuted, fontWeight: 400 }}>{x.subject}</small></span>
                  <span style={{ height: 8, borderRadius: 4, background: 'var(--surface-alt)', overflow: 'hidden' }}>
                    {s.acc != null && <span style={{ display: 'block', height: '100%', width: `${s.acc}%`, background: color }} />}
                  </span>
                  <b style={{ fontSize: 12.5 }}>{s.acc != null ? `%${s.acc.toFixed(0)}` : '—'}</b>
                </button>
              )
            })}
          </div>
          {linked.length > 0 && (
            <div style={{ fontSize: 12, color: pal.textMuted, marginTop: 10 }}>
              Ayrıca bağlı (sonuç yansımaz):{' '}
              {linked.map((x, k) => (
                <span key={x.r.exam_topic_id}>
                  {k > 0 && ', '}
                  <button type="button" onClick={() => goTopic(x)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: pal.primary, fontSize: 12, textDecoration: 'underline' }}>{x.r.name}</button>
                </span>
              ))}
            </div>
          )}
          <Explain role={role} pal={pal}>Kurumdaki deneme karnesi bu konuyu birkaç parçaya bölüyor; burada parçaların her biri ayrı görünüyor.</Explain>
        </div>
      </div>
    </div>
  )
}
