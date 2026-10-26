import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart2,
  Calendar,
  Check,
  ChevronRight,
  ClipboardList,
  Layers,
  MessageCircle,
  Plus,
  UserX,
  Users,
  type LucideIcon,
} from 'lucide-react'
import AddStudentModal from '../components/students/AddStudentModal'
import { useAccess } from '../contexts/AccessContext'
import { useAuth } from '../contexts/AuthContext'
import { useHomeSummary } from '../contexts/homeSummaryContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { DAYS, DAYS_SHORT as DAY_SHORT } from '../lib/weeks'
import {
  getIsoDayIndex,
  type AttentionReason,
  type AttentionReasonKind,
  type HomeRecentActivity,
  type HomeSummary,
  type StudentAttentionItem,
} from '../lib/homeSummary'
import '../styles/home.css'

// ---------------------------------------------------------------------------
// Biçimlendirme
// ---------------------------------------------------------------------------

const nf2 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nf1 = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + nf2.format(Math.abs(n))

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toLocaleUpperCase('tr-TR')
}

function greeting(d: Date) {
  const h = d.getHours()
  return h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar'
}

function relTime(iso: string, now: Date) {
  // Saatsiz tarih ('YYYY-MM-DD') yerel gün olarak okunur, saat yazılmaz.
  const dateOnly = iso.length <= 10
  const d = dateOnly ? new Date(`${iso}T12:00:00`) : new Date(iso)
  const day = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  if (dateOnly) return day
  const mins = Math.round((now.getTime() - d.getTime()) / 60000)
  if (mins < 60) return mins <= 1 ? 'Az önce' : `${mins} dakika önce`
  if (d.toDateString() === now.toDateString()) return `${Math.round(mins / 60)} saat önce`
  const hm = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  return d.toDateString() === yesterday.toDateString() ? `Dün ${hm}` : `${day} ${hm}`
}

function shortDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

// ---------------------------------------------------------------------------
// Sayıların sayarak dolması: son değer her zaman doğru; hareket istemeyende anında.
// ---------------------------------------------------------------------------

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(() => (reduceMotion() ? value : 0))
  useEffect(() => {
    if (reduceMotion()) {
      setShown(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 900)
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{shown.toLocaleString('tr-TR')}</>
}

// ---------------------------------------------------------------------------
// İlgi bekleyenler: neden rozetleri ve tek sonraki adım
// ---------------------------------------------------------------------------

type FilterKey = 'all' | 'kritik' | 'net' | 'devam' | 'prog' | 'deneme'

const FILTERS: { key: FilterKey; label: string; kinds: AttentionReasonKind[] }[] = [
  { key: 'all', label: 'Tümü', kinds: [] },
  { key: 'kritik', label: 'Kritik konu', kinds: ['kritik_karar'] },
  { key: 'net', label: 'Net düşüşü', kinds: ['net_dususu'] },
  { key: 'devam', label: 'Devamsızlık', kinds: ['devamsizlik_takip'] },
  { key: 'prog', label: 'Program', kinds: ['program_dusuk', 'program_yok'] },
  { key: 'deneme', label: 'Deneme yok', kinds: ['deneme_yok'] },
]

const SEVERITY: Record<AttentionReasonKind, 'bad' | 'warn' | 'gray'> = {
  kritik_karar: 'bad',
  net_dususu: 'bad',
  devamsizlik_takip: 'bad',
  program_dusuk: 'warn',
  program_yok: 'warn',
  deneme_yok: 'gray',
}

function reasonText(r: AttentionReason): { tag: string; text: string } {
  const d = (r.detail ?? {}) as Record<string, unknown>
  switch (r.kind) {
    case 'kritik_karar': {
      const names = (d.topicNames as string[] | undefined) ?? []
      return { tag: 'KRİTİK', text: `${d.count ?? names.length} konu${names.length ? ' · ' + names.join(', ') : ''}` }
    }
    case 'net_dususu':
      return { tag: 'NET', text: `${nf2.format(Number(d.prev))} → ${nf2.format(Number(d.last))} (${signed(Number(d.delta))})` }
    case 'devamsizlik_takip':
      return { tag: 'DEVAMSIZLIK', text: `14 günde ${d.last14Count ?? '?'} ders${d.notOpened ? ' · bildirim açılmadı' : ''}` }
    case 'program_dusuk':
      return { tag: 'PROGRAM', text: `%${d.pct} tamamlandı` }
    case 'program_yok':
      return { tag: 'PROGRAM YOK', text: 'bu hafta görev yok' }
    case 'deneme_yok':
      return { tag: 'DENEME YOK', text: d.daysSinceLast == null ? 'hiç deneme girilmedi' : `son deneme ${d.daysSinceLast} gün önce` }
  }
}

/** En önemli nedene göre tek bir sonraki adım. Nedenler önem sırasıyla gelir. */
function nextStep(item: StudentAttentionItem): { to: string; label: string; icon: LucideIcon; primary?: boolean } {
  const id = item.studentId
  switch (item.reasons[0]?.kind) {
    case 'kritik_karar':
    case 'net_dususu':
      return { to: `/ogrenciler/${id}?tab=analysis`, label: 'Deneme analizini aç', icon: BarChart2, primary: true }
    case 'devamsizlik_takip':
      return { to: `/devamsizlik?studentId=${id}`, label: 'Devamsızlığı aç', icon: MessageCircle }
    case 'program_dusuk':
      return { to: `/program?studentId=${id}`, label: 'Programı aç', icon: Calendar }
    case 'program_yok':
      return { to: `/program?studentId=${id}`, label: 'Program hazırla', icon: Calendar }
    default:
      return { to: `/denemeler?studentId=${id}`, label: 'Deneme gir', icon: Plus }
  }
}

const ATT_LIMIT = 6

function AttentionCard({ items }: { items: StudentAttentionItem[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [showAll, setShowAll] = useState(false)

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: items.length, kritik: 0, net: 0, devam: 0, prog: 0, deneme: 0 }
    for (const f of FILTERS.slice(1)) c[f.key] = items.filter((i) => i.reasons.some((r) => f.kinds.includes(r.kind))).length
    return c
  }, [items])

  const kinds = FILTERS.find((f) => f.key === filter)?.kinds ?? []
  const filtered = filter === 'all' ? items : items.filter((i) => i.reasons.some((r) => kinds.includes(r.kind)))
  const visible = showAll ? filtered : filtered.slice(0, ATT_LIMIT)

  return (
    <section className="h-card h-span-8 h-att-card h-rise" style={{ '--i': 1 } as CSSProperties} aria-labelledby="h-att-title">
      <div className="h-card-head">
        <div className="h-card-title">
          <h2 id="h-att-title" className="h-h2">Bugün ilgi bekleyenler</h2>
          {items.length > 0 && <span className="h-big-pill">{filtered.length}</span>}
        </div>
        {items.length > 0 && (
          <div className="h-chips" role="group" aria-label="Nedene göre süz">
            {FILTERS.filter((f) => f.key === 'all' || counts[f.key] > 0).map((f) => (
              <button
                key={f.key}
                type="button"
                className="h-fchip"
                aria-pressed={filter === f.key}
                onClick={() => {
                  setFilter(f.key)
                  setShowAll(false)
                }}
              >
                {f.label} <span>{counts[f.key]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="h-calm">
          <span className="h-calm-ic">
            <Check size={18} />
          </span>
          <div>
            <b>Bugün acil bir şey yok.</b>
            <p>Kritik konu, net düşüşü, devamsızlık ya da yarım kalan program görünmüyor.</p>
          </div>
        </div>
      ) : (
        <ul className="h-att">
          {visible.map((item) => {
            const step = nextStep(item)
            const StepIcon = step.icon
            return (
              <li key={item.studentId} style={{ '--sev': `var(--h-${SEVERITY[item.reasons[0].kind]})` } as CSSProperties}>
                <span className="h-av">{initials(item.name)}</span>
                <div className="h-who">
                  <div className="h-who-top">
                    <Link to={`/ogrenciler/${item.studentId}`} className="h-who-name" viewTransition>
                      {item.name}
                    </Link>
                    <span className="h-who-meta">
                      {item.grade}
                      {item.track ? ` · ${item.track}` : ''}
                    </span>
                  </div>
                  <div className="h-why">
                    {item.reasons.map((r) => {
                      const t = reasonText(r)
                      return (
                        <span key={r.kind} className={`h-r h-r-${SEVERITY[r.kind]}`}>
                          <b>{t.tag}</b> {t.text}
                        </span>
                      )
                    })}
                  </div>
                </div>
                <div className="h-do">
                  <Link to={step.to} className={`h-act${step.primary ? ' is-primary' : ''}`} viewTransition>
                    <StepIcon size={14} /> {step.label}
                  </Link>
                  <Link to={`/ogrenciler/${item.studentId}`} className="h-go" aria-label={`${item.name} profili`} viewTransition>
                    <ChevronRight size={18} />
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {filtered.length > ATT_LIMIT && (
        <button type="button" className="h-more" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Daha az göster' : `Tümünü göster (${filtered.length})`}
        </button>
      )}
      {items.length > 0 && (
        <p className="h-foot-note">
          Sıra: neden sayısı, sonra kritik konu, net düşüşü, devamsızlık, program, deneme. Her öğrencinin yanında en önemli
          nedenine göre tek bir sonraki adım durur.
        </p>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Bu hafta
// ---------------------------------------------------------------------------

const RING_C = 2 * Math.PI * 52

function WeekCard({ program }: { program: HomeSummary['program'] }) {
  const today = getIsoDayIndex(new Date())
  const { toDate, byDay, lastWeekSameDayPct } = program
  const hasPlan = program.thisWeekTotalTasks > 0
  // Pazartesi günü yeni başlamışken geçen haftanın bitmiş Pazartesi'siyle kıyas yanıltıcı (%0 ▼100).
  const diff = hasPlan && today > 0 && toDate.planned > 0 && lastWeekSameDayPct != null ? toDate.pct - lastWeekSameDayPct : null
  const monday = new Date()
  monday.setDate(monday.getDate() - today)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })

  return (
    <section className="h-card h-span-4 h-rise" style={{ '--i': 2 } as CSSProperties} aria-labelledby="h-wk-title">
      <div className="h-card-head">
        <div>
          <div className="h-eyebrow">
            {fmt(monday)} – {fmt(sunday)}
          </div>
          <h2 id="h-wk-title" className="h-h2">Bu hafta</h2>
        </div>
        <Link to="/program" className="h-link" viewTransition>
          Program <ArrowRight size={14} />
        </Link>
      </div>

      {hasPlan ? (
        <>
          <div className="h-week-top">
            <div className="h-ring" role="img" aria-label={`Bugüne kadar planlanan görevlerin yüzde ${toDate.pct}'i tamamlandı`}>
              <svg viewBox="0 0 120 120">
                <circle className="h-ring-trk" cx="60" cy="60" r="52" fill="none" strokeWidth="11" />
                <circle
                  className="h-ring-val"
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  strokeWidth="11"
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - toDate.pct / 100)}
                  style={{ '--full': RING_C } as CSSProperties}
                />
              </svg>
              <div className="h-ring-txt">
                <b>
                  %<CountUp value={toDate.pct} />
                </b>
                <span>tamamlandı</span>
              </div>
            </div>
            <div className="h-week-stats">
              <span>
                <b className="tnum">
                  {toDate.done} / {toDate.planned}
                </b>{' '}
                görev bitti (bugüne kadar)
              </span>
              {diff != null && (
                <span>
                  Geçen hafta bu gün: %{lastWeekSameDayPct}{' '}
                  <span className={diff >= 0 ? 'h-up' : 'h-down'}>
                    {diff >= 0 ? '▲' : '▼'} {Math.abs(diff)}
                  </span>
                </span>
              )}
              <span>
                Haftanın tamamı: <b className="tnum">{program.thisWeekTotalTasks}</b> görev
              </span>
            </div>
          </div>

          <div className="h-days" aria-label="Günlere göre tamamlanan görevler">
            {byDay.map((d) => {
              const future = d.dayIndex > today
              const isToday = d.dayIndex === today
              const h = d.planned ? Math.round((d.done / d.planned) * 100) : 0
              return (
                <div
                  key={d.dayIndex}
                  className={`h-day${isToday ? ' is-today' : ''}${future ? ' is-future' : ''}`}
                  title={
                    future
                      ? `${DAYS[d.dayIndex]}: ${d.planned} görev planlı`
                      : `${DAYS[d.dayIndex]}: ${d.planned} görevden ${d.done} tanesi bitti`
                  }
                >
                  <div className="h-bar">{!future && <i style={{ '--h': `${h}%`, '--d': d.dayIndex } as CSSProperties} />}</div>
                  <small>{isToday ? 'Bugün' : DAY_SHORT[d.dayIndex]}</small>
                  <em className="tnum">{future ? d.planned : `${d.done}/${d.planned}`}</em>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <p className="h-muted">Bu hafta henüz görev planlanmadı.</p>
      )}

      {program.studentsWithoutTasksCount > 0 && (
        <div className="h-mini-alert">
          <span>{program.studentsWithoutTasksCount} öğrencinin bu hafta programı yok</span>
          <Link to="/program" viewTransition>
            Hazırla
          </Link>
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Modül kısayolları
// ---------------------------------------------------------------------------

function TrendLine({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const span = Math.max(...values) - min || 1
  const W = 200
  const H = 34
  const x = (i: number) => 4 + (i * (W - 8)) / (values.length - 1)
  const y = (v: number) => H - 3 - ((v - min) / span) * (H - 8)
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const last = values[values.length - 1]
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Son ${values.length} haftanın ortalama TYT neti: ${nf1.format(values[0])}'den ${nf1.format(last)}'e`}
    >
      <polygon points={`${x(0)},${H} ${pts} ${x(values.length - 1)},${H}`} fill="var(--tc)" fillOpacity=".12" />
      <polyline points={pts} fill="none" stroke="var(--tc)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(values.length - 1)} cy={y(last)} r="3.5" fill="var(--tc)" stroke="var(--surface)" strokeWidth="2" />
    </svg>
  )
}

const STACK_COLORS = ['var(--m-den)', 'var(--critical)', 'var(--m-prg)', 'var(--m-dev)', 'var(--m-kon)', 'var(--m-rap)']

interface TileProps {
  to: string
  color: string
  icon: LucideIcon
  name: string
  num: ReactNode
  unit?: string
  i: number
  children: ReactNode
  viz?: ReactNode
}

function Tile({ to, color, icon: Icon, name, num, unit, i, children, viz }: TileProps) {
  return (
    <Link to={to} className="h-tile h-rise" style={{ '--tc': color, '--i': i } as CSSProperties} viewTransition>
      <div className="h-tile-head">
        <span className="h-tile-ic">
          <Icon size={18} />
        </span>
        <ArrowRight size={14} className="h-tile-arrow" />
      </div>
      <div>
        <div className="h-tile-name">{name}</div>
        <div className="h-tile-num tnum">
          {num}
          {unit && <small>{unit}</small>}
        </div>
      </div>
      <p className="h-tile-line">{children}</p>
      <div className="h-tile-viz">{viz}</div>
    </Link>
  )
}

function ModuleTiles({ s }: { s: HomeSummary }) {
  const { can } = useAccess()
  const { students, exams, program, attendance, reports } = s
  const today = getIsoDayIndex(new Date())
  const tiles: ReactNode[] = []

  if (can('students.view'))
    tiles.push(
      <Tile
        key="ogr"
        to="/ogrenciler"
        color="var(--m-ogr)"
        icon={Users}
        name="Öğrenciler"
        num={<CountUp value={students.totalActive} />}
        unit="aktif"
        i={3}
        viz={
          <div className="h-viz-col">
            <div className="h-stack">
              <i style={{ width: `${(students.yksCount / students.totalActive) * 100}%`, background: 'var(--m-ogr)' }} />
              <i style={{ width: `${(students.lgsCount / students.totalActive) * 100}%`, background: 'var(--m-kon)' }} />
            </div>
            <div className="h-legend">
              <span>
                <i style={{ background: 'var(--m-ogr)' }} />
                YKS
              </span>
              <span>
                <i style={{ background: 'var(--m-kon)' }} />
                LGS
              </span>
            </div>
          </div>
        }
      >
        <b>{students.yksCount}</b> YKS · <b>{students.lgsCount}</b> LGS.
        {students.newThisMonth > 0 && (
          <>
            {' '}
            Bu ay <b>{students.newThisMonth}</b> yeni kayıt.
          </>
        )}
      </Tile>,
    )

  if (can('exams.view'))
    tiles.push(
      <Tile
        key="den"
        to="/denemeler"
        color="var(--m-den)"
        icon={ClipboardList}
        name="Denemeler · son 7 gün"
        num={<CountUp value={exams.last7DaysCount} />}
        unit="deneme"
        i={4}
        viz={<TrendLine values={exams.weeklyAvgNet.map((w) => w.avg)} />}
      >
        {exams.avgDelta != null && (
          <>
            Ortalama net{' '}
            <span className={exams.avgDelta >= 0 ? 'h-up' : 'h-down'}>
              {exams.avgDelta >= 0 ? '▲' : '▼'} {nf1.format(Math.abs(exams.avgDelta))}
            </span>
            .{' '}
          </>
        )}
        {exams.withoutTopicsCount > 0 ? (
          <span className="h-warn">{exams.withoutTopicsCount} denemede konu girilmedi.</span>
        ) : (
          'Denemelerin hepsinde konu sonuçları girili.'
        )}
      </Tile>,
    )

  if (can('program.view'))
    tiles.push(
      <Tile
        key="prg"
        to="/program"
        color="var(--m-prg)"
        icon={Calendar}
        name="Program · bu hafta"
        num={
          program.toDate.planned ? (
            <>
              %<CountUp value={program.toDate.pct} />
            </>
          ) : (
            '—'
          )
        }
        unit={program.toDate.planned ? 'bugüne kadar' : undefined}
        i={5}
        viz={
          program.toDate.planned > 0 && (
            <div className="h-prog">
              <i style={{ '--w': `${program.toDate.pct}%` } as CSSProperties} />
            </div>
          )
        }
      >
        {program.toDate.planned ? (
          <>
            <b>
              {program.toDate.done} / {program.toDate.planned}
            </b>{' '}
            görev bitti.
          </>
        ) : (
          'Bugüne kadar planlı görev yok.'
        )}
        {program.studentsWithoutTasksCount > 0 && (
          <span className="h-warn"> {program.studentsWithoutTasksCount} öğrencinin programı yok.</span>
        )}
      </Tile>,
    )

  if (can('attendance.view'))
    tiles.push(
      <Tile
        key="dev"
        to="/devamsizlik"
        color="var(--m-dev)"
        icon={UserX}
        name="Devamsızlık · bu hafta"
        num={<CountUp value={attendance.thisWeekAbsenceCount} />}
        unit="kayıt"
        i={6}
        viz={
          <div className="h-dots" aria-label={`Günlere göre devamsızlık: ${attendance.byDay.map((n, d) => `${DAYS[d]} ${n}`).join(', ')}`}>
            {attendance.byDay.map((n, d) => (
              <span key={d} className={d === today ? 'is-today' : undefined}>
                {Array.from({ length: Math.min(n, 4) }).map((_, k) => (
                  <i key={k} />
                ))}
                <em>{DAY_SHORT[d]}</em>
              </span>
            ))}
          </div>
        }
      >
        {attendance.needsAttentionCount > 0 ? (
          <span className="h-warn">{attendance.needsAttentionCount} öğrenci takip gerekli.</span>
        ) : (
          'Takip gereken öğrenci yok.'
        )}
        {attendance.notifyNotOpenedCount > 0 && <> {attendance.notifyNotOpenedCount} bildirim açılmadı (14 gün).</>}
      </Tile>,
    )

  if (can('reports.view')) {
    const total = reports.bySubject.reduce((a, b) => a + b.count, 0)
    tiles.push(
      <Tile
        key="rap"
        to="/raporlar"
        color="var(--m-rap)"
        icon={BarChart2}
        name="Raporlar · görüşme hazırlığı"
        num={<CountUp value={reports.criticalTopicCount} />}
        unit="kritik konu"
        i={7}
        viz={
          total > 0 && (
            <div className="h-stack" title={reports.bySubject.map((b) => `${b.subjectName}: ${b.count}`).join(' · ')}>
              {reports.bySubject.map((b, k) => (
                <i key={b.subjectName} style={{ width: `${(b.count / total) * 100}%`, background: STACK_COLORS[k % STACK_COLORS.length] }} />
              ))}
            </div>
          )
        }
      >
        {reports.criticalTopicCount > 0 ? (
          <>
            <b>{reports.studentsWithCritical}</b> öğrencide.
            {reports.topTopic && (
              <>
                {' '}
                En sık: <b>{reports.topTopic.name}</b> ({reports.topTopic.studentCount} öğrenci).
              </>
            )}
          </>
        ) : (
          'Kritik işaretli konu yok.'
        )}
      </Tile>,
    )
  }

  return (
    <section aria-label="Modüller" className="h-tiles">
      {tiles}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Son denemeler + son hareketler
// ---------------------------------------------------------------------------

const FEED_STYLE: Record<HomeRecentActivity['kind'], { icon: LucideIcon; color: string }> = {
  exam: { icon: ClipboardList, color: 'var(--m-den)' },
  attendance: { icon: UserX, color: 'var(--m-dev)' },
  decision: { icon: Layers, color: 'var(--m-kon)' },
}

function RecentExams({ exams }: { exams: HomeSummary['exams']['recent'] }) {
  return (
    <section className="h-card h-span-7 h-rise" style={{ '--i': 8 } as CSSProperties} aria-labelledby="h-ex-title">
      <div className="h-card-head">
        <h2 id="h-ex-title" className="h-h2">Son denemeler</h2>
        <Link to="/denemeler" className="h-link" viewTransition>
          Tümü <ArrowRight size={14} />
        </Link>
      </div>
      {exams.length === 0 ? (
        <p className="h-muted">Henüz deneme girilmedi.</p>
      ) : (
        <div className="h-tbl-wrap">
          <table className="h-tbl">
            <thead>
              <tr>
                <th>Öğrenci</th>
                <th>Deneme</th>
                <th>Tarih</th>
                <th className="num">Net</th>
                <th className="num">Değişim</th>
                <th>Konu sonuçları</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((e, k) => (
                <tr key={k}>
                  <td>
                    <b>{e.studentName}</b>
                  </td>
                  <td>
                    {e.name} <span className="h-muted-sm">{e.examType}</span>
                  </td>
                  <td>{shortDate(e.date)}</td>
                  <td className="num">{nf2.format(e.totalNet)}</td>
                  <td className={`num ${e.delta == null ? '' : e.delta >= 0 ? 'h-up' : 'h-down'}`}>{e.delta == null ? '—' : signed(e.delta)}</td>
                  <td>
                    {e.topicResultsCount > 0 ? (
                      <span className="h-k-ok">
                        <Check size={14} /> {e.topicResultsCount} konu
                      </span>
                    ) : (
                      <Link to="/denemeler" className="h-k-miss" viewTransition>
                        Konu gir
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function ActivityFeed({ items }: { items: HomeRecentActivity[] }) {
  const now = new Date()
  return (
    <section className="h-card h-span-5 h-rise" style={{ '--i': 9 } as CSSProperties} aria-labelledby="h-fd-title">
      <div className="h-card-head">
        <h2 id="h-fd-title" className="h-h2">Son hareketler</h2>
      </div>
      {items.length === 0 ? (
        <p className="h-muted">Henüz hareket yok.</p>
      ) : (
        <ul className="h-feed">
          {items.slice(0, 6).map((a, k) => {
            const st = FEED_STYLE[a.kind]
            const Icon = st.icon
            return (
              <li key={k} style={{ '--fc': st.color } as CSSProperties}>
                <span className="h-f-ic">
                  <Icon size={15} />
                </span>
                <div className="h-f-txt">
                  <b>{a.studentName}</b> · {a.text}
                  <div className="h-f-time">{relTime(a.at, now)}</div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Sayfa
// ---------------------------------------------------------------------------

export default function PanelPage() {
  const { summary: s, error, refresh } = useHomeSummary()
  const { can } = useAccess()
  const { profile } = useAuth()
  const [showAddModal, setShowAddModal] = useState(false)

  // Ana Sayfa'ya her dönüşte özet tazelenir (menü rozetleri de aynı veriyi kullanır).
  useEffect(() => {
    refresh()
  }, [refresh])

  const now = new Date()
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? ''
  const planned = s ? s.program.toDate.planned > 0 : false

  return (
    <section className="screen h-page">
      <header className="h-hello h-rise" style={{ '--i': 0 } as CSSProperties}>
        <div>
          <div className="h-date">{now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <h1>
            {greeting(now)}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          {s && s.students.totalActive > 0 && (
            <p className="h-sub">
              {s.attention.length > 0 ? (
                <>
                  <b>{s.attention.length} öğrenci</b> bugün ilgini bekliyor.
                </>
              ) : (
                'Bugün acil bir şey görünmüyor.'
              )}
              {planned && (
                <>
                  {' '}
                  Bu hafta planlanan görevlerin <b>%{s.program.toDate.pct}</b>'i tamamlandı,
                </>
              )}
              {planned ? ' son' : ' Son'} 7 günde <b>{s.exams.last7DaysCount} deneme</b> girildi.
            </p>
          )}
        </div>
        <div className="h-actions">
          {can('exams.view') && (
            <Link to="/denemeler" className="btn btn-ghost" viewTransition>
              <ClipboardList size={14} /> Deneme gir
            </Link>
          )}
          {can('students.create') && (
            <button type="button" className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={14} /> Öğrenci ekle
            </button>
          )}
        </div>
      </header>

      {showAddModal && (
        <AddStudentModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false)
            refresh()
          }}
        />
      )}

      {!isSupabaseConfigured && (
        <div className="h-banner h-banner-warn">
          Supabase bağlı değil: <code>.env.example</code>'ı <code>.env.local</code> olarak kopyalayıp proje bilgilerini gir.
        </div>
      )}
      {error && <div className="h-banner h-banner-bad">{error}</div>}

      {!s && !error && (
        <div className="h-grid" aria-hidden="true">
          <div className="skeleton h-span-8 h-skel" />
          <div className="skeleton h-span-4 h-skel" />
        </div>
      )}

      {s && s.students.totalActive === 0 && (
        <div className="card empty-state">
          <Users size={26} className="empty-state-icon" />
          <p className="empty-state-text">Bu kurumda henüz öğrenci yok. İlk öğrenciyi ekleyerek haftalık takibe başla.</p>
          {can('students.create') && (
            <button type="button" className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={16} /> Öğrenci Ekle
            </button>
          )}
        </div>
      )}

      {s && s.students.totalActive > 0 && (
        <>
          <div className="h-grid">
            <AttentionCard items={s.attention} />
            <WeekCard program={s.program} />
          </div>
          <ModuleTiles s={s} />
          <div className="h-grid">
            <RecentExams exams={s.exams.recent} />
            <ActivityFeed items={s.recent} />
          </div>
        </>
      )}
    </section>
  )
}
