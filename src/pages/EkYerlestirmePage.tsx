import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown, Printer, Save, AlertTriangle } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { fetchStudents } from '../lib/students'
import { useAccess } from '../contexts/AccessContext'
import PageHeader from '../components/layout/PageHeader'
import { ChipMultiSelect } from '../components/common/ChipMultiSelect'
import { uniqSorted, foldTr } from '../lib/turkishSearch'
import type {
  Student, EkYerlestirmeProgrami as Program, EkYerlestirmeKosulu, VakifOgrenimUcreti, Json,
} from '../types/database'

const MAX_TERCIH = 24
const SHOW_LIMIT = 200
const PAGE = 1000
const SCORE_TYPES = ['TYT', 'SAY', 'EA', 'SÖZ', 'DİL'] as const
const TURU_LABEL: Record<Program['universite_turu'], string> = {
  devlet: 'Devlet', vakif: 'Vakıf', kktc: 'KKTC', yurtdisi: 'Yurt dışı',
}
const TABLO_LABEL: Record<Program['tablo'], string> = { onlisans: 'Ön Lisans', lisans: 'Lisans' }
const DOLMADI = 'Dolmadı — puanı olan herkes tercih edebilir'

type ListItem = { program_kodu: number; notlar: string }
type Scores = Partial<Record<(typeof SCORE_TYPES)[number], string>>

const fmtPuan = (v: number | null) => (v == null ? DOLMADI : v.toLocaleString('tr-TR', { maximumFractionDigits: 5 }))
const kont = (p: Program) => p.genel_ek_kont + p.sgy_ek_kont + p.k34_ek_kont
const burs = (p: Program) => p.burs_indirim ?? 'Devlet'

// Program adından parantezli ekleri ((Burslu), (%50 İndirimli), (İngilizce)…) atıp katlar.
const normAd = (s: string) => foldTr(s.replace(/\([^)]*\)/g, ' ')).replace(/\s+/g, ' ').trim()

function findUcret(p: Program, ucretler: VakifOgrenimUcreti[]) {
  if (p.universite_turu !== 'vakif' && p.universite_turu !== 'kktc') return null
  const uni = foldTr(p.universite).trim()
  const ad = normAd(p.program_adi)
  return (
    ucretler.find((u) => {
      const uu = foldTr(u.universite).trim()
      return (uu === uni || uu.includes(uni) || uni.includes(uu)) && normAd(u.program) === ad
    }) ?? null
  )
}

async function fetchAll<T>(table: string, year: number): Promise<T[]> {
  // id her iki tabloda da var (kararlı sayfalama için sırala)
  const { count } = await supabase.from(table as never).select('*', { count: 'exact', head: true }).eq('yil', year)
  const total = count ?? 0
  const parts = await Promise.all(
    Array.from({ length: Math.ceil(total / PAGE) }, (_, i) =>
      supabase.from(table as never).select('*').eq('yil', year).order('id')
        .range(i * PAGE, i * PAGE + PAGE - 1),
    ),
  )
  return parts.flatMap((r) => (r.data as T[] | null) ?? [])
}

function loadScores(studentId: string): Scores {
  try {
    const raw = localStorage.getItem(`ekYerlestirme.puan.${studentId}`)
    return raw ? (JSON.parse(raw) as Scores) : {}
  } catch { return {} }
}
function saveScores(studentId: string, s: Scores) {
  try { localStorage.setItem(`ekYerlestirme.puan.${studentId}`, JSON.stringify(s)) } catch { /* yok say */ }
}

export default function EkYerlestirmePage() {
  const { studentScope } = useAccess()
  const [years, setYears] = useState<number[]>([])
  const [year, setYear] = useState<number | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [kosullar, setKosullar] = useState<EkYerlestirmeKosulu[]>([])
  const [ucretler, setUcretler] = useState<VakifOgrenimUcreti[]>([])
  const [loading, setLoading] = useState(true)

  // filtreler
  const [tablo, setTablo] = useState('')
  const [puanTuru, setPuanTuru] = useState('')
  const [turu, setTuru] = useState('')
  const [bursF, setBursF] = useState('')
  const [iller, setIller] = useState<string[]>([])
  const [ilQ, setIlQ] = useState('')
  const [ilOpen, setIlOpen] = useState(false)
  const [q, setQ] = useState('')
  const [sadeceKont, setSadeceKont] = useState(false)
  const [sadeceBos, setSadeceBos] = useState(false)

  const [openCode, setOpenCode] = useState<number | null>(null)

  // öğrenci paneli
  const [students, setStudents] = useState<Student[]>([])
  const [studentId, setStudentId] = useState('')
  const [list, setList] = useState<ListItem[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [scores, setScores] = useState<Scores>({})
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return }
    fetchStudents({ activeOnly: true, orderBy: 'full_name', ...studentScope }).then(setStudents)
  }, [studentScope])

  // Farklı yıllar: her seferinde bir önceki yılın altındaki en büyük yılı al (distinct yok).
  useEffect(() => {
    if (!isSupabaseConfigured) return
    ;(async () => {
      const ys: number[] = []
      let below = 9999
      for (let i = 0; i < 10; i++) { // en çok 10 farklı yıl
        const { data } = await supabase.from('ek_yerlestirme_programlari').select('yil')
          .lt('yil', below).order('yil', { ascending: false }).limit(1)
        const y = (data as { yil: number }[] | null)?.[0]?.yil
        if (y == null) break
        ys.push(y); below = y
      }
      setYears(ys)
      setYear(ys[0] ?? null)
      if (ys.length === 0) setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (year == null) return
    setLoading(true)
    ;(async () => {
      const [p, k, u] = await Promise.all([
        fetchAll<Program>('ek_yerlestirme_programlari', year),
        supabase.from('ek_yerlestirme_kosullari').select('*').eq('yil', year).limit(1000),
        fetchAll<VakifOgrenimUcreti>('vakif_ogrenim_ucretleri', year),
      ])
      setPrograms(p)
      setKosullar((k.data as EkYerlestirmeKosulu[] | null) ?? [])
      setUcretler(u)
      setLoading(false)
    })()
  }, [year])

  // Öğrenci listesi + puanlar
  useEffect(() => {
    setMsg(null); setDirty(false)
    if (!studentId || year == null) { setList([]); setScores({}); return }
    setScores(loadScores(studentId))
    supabase.from('ogrenci_tercih_listeleri').select('program_kodu, notlar')
      .eq('student_id', studentId).eq('yil', year).eq('donem', 'ek').order('sira')
      .then(({ data, error }) => {
        if (error) setMsg({ ok: false, text: 'Liste yüklenemedi: ' + error.message })
        else setList(((data as { program_kodu: number; notlar: string | null }[]) ?? [])
          .map((r) => ({ program_kodu: r.program_kodu, notlar: r.notlar ?? '' })))
      })
  }, [studentId, year])

  const byCode = useMemo(() => new Map(programs.map((p) => [p.program_kodu, p])), [programs])
  const kosulMap = useMemo(() => new Map(kosullar.map((k) => [k.kosul_no, k])), [kosullar])
  const ilOptions = useMemo(() => uniqSorted(programs.map((p) => p.il)), [programs])
  const ilSuggestions = useMemo(() => {
    const f = foldTr(ilQ)
    return ilOptions.filter((i) => !iller.includes(i) && foldTr(i).includes(f)).slice(0, 30)
  }, [ilOptions, ilQ, iller])
  const bursOptions = useMemo(() => uniqSorted(programs.map(burs)), [programs])

  const filtered = useMemo(() => {
    const f = foldTr(q).trim()
    return programs.filter((p) =>
      (!tablo || p.tablo === tablo) &&
      (!puanTuru || p.puan_turu === puanTuru) &&
      (!turu || p.universite_turu === turu) &&
      (!bursF || burs(p) === bursF) &&
      (iller.length === 0 || (p.il != null && iller.includes(p.il))) &&
      (!f || foldTr(p.program_adi).includes(f) || foldTr(p.universite).includes(f)) &&
      (!sadeceKont || kont(p) > 0) &&
      (!sadeceBos || (p.en_kucuk_gk == null && p.en_kucuk_sgy == null && p.en_kucuk_34y == null)),
    )
  }, [programs, tablo, puanTuru, turu, bursF, iller, q, sadeceKont, sadeceBos])

  const scoreOf = (t: string): number | null => {
    const v = parseFloat(((scores as Record<string, string>)[t] ?? '').replace(',', '.'))
    return Number.isFinite(v) ? v : null
  }
  const lowScore = (p: Program) => {
    const s = scoreOf(p.puan_turu)
    return s != null && p.en_kucuk_gk != null && s < p.en_kucuk_gk
  }
  const Warn = ({ p }: { p: Program }) => lowScore(p) ? (
    <span className="badge badge-critical" title={`Puanın bu programın en küçük puanının (${fmtPuan(p.en_kucuk_gk)}) altında`}>
      <AlertTriangle size={12} /> Puan altında
    </span>
  ) : null

  const inList = (code: number) => list.some((l) => l.program_kodu === code)
  const full = list.length >= MAX_TERCIH
  const add = (code: number) => {
    if (!studentId || full || inList(code)) return
    setList([...list, { program_kodu: code, notlar: '' }]); setDirty(true); setMsg(null)
  }
  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return
    const n = [...list]; n.splice(to, 0, n.splice(from, 1)[0]); setList(n); setDirty(true)
  }
  const remove = (i: number) => { setList(list.filter((_, j) => j !== i)); setDirty(true) }
  const setNote = (i: number, notlar: string) => { setList(list.map((l, j) => (j === i ? { ...l, notlar } : l))); setDirty(true) }
  const setScore = (t: string, v: string) => {
    const s = { ...scores, [t]: v }; setScores(s); if (studentId) saveScores(studentId, s)
  }

  const save = async () => {
    if (!studentId || year == null) return
    setSaving(true); setMsg(null)
    const items = list.map((l, i) => ({ program_kodu: l.program_kodu, sira: i + 1, notlar: l.notlar.trim() || null }))
    const { error } = await supabase.rpc('tercih_listesi_kaydet', {
      p_student_id: studentId, p_yil: year, p_donem: 'ek', p_items: items as unknown as Json,
    })
    setSaving(false)
    if (error) setMsg({ ok: false, text: 'Kaydedilemedi: ' + error.message })
    else { setDirty(false); setMsg({ ok: true, text: 'Liste kaydedildi.' }) }
  }

  const student = students.find((s) => s.id === studentId)
  const open = openCode != null ? byCode.get(openCode) ?? null : null
  const sel = { width: '100%' }

  if (!isSupabaseConfigured || (!loading && years.length === 0)) {
    return (
      <section className="screen">
        <PageHeader title="Ek Yerleştirme" subtitle="ÖSYM Ek Yerleştirme Kılavuzu: boş kontenjanlar ve en fazla 24 tercihlik liste." />
        <div className="card empty-state"><p className="empty-state-text">Henüz Ek Yerleştirme verisi yüklenmemiş.</p></div>
      </section>
    )
  }

  return (
    <section className="screen">
      <div className="no-print">
        <PageHeader
          title="Ek Yerleştirme"
          subtitle="Merkezî yerleştirmede boş kalan kontenjanlar. Öğrenci için en fazla 24 tercihlik liste hazırla."
          actions={
            <select value={year ?? ''} onChange={(e) => { setYear(Number(e.target.value)); setOpenCode(null) }} title="Kılavuz yılı">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          }
        />
      </div>

      {/* YALNIZ YAZDIRMADA */}
      <div className="print-only">
        <h2 style={{ margin: 0 }}>Ek Yerleştirme Tercih Listesi — {year}</h2>
        <p>{student?.full_name} · {new Date().toLocaleDateString('tr-TR')}</p>
        <table className="table" style={{ width: '100%' }}>
          <thead><tr><th>Sıra</th><th>Program Kodu</th><th>Üniversite</th><th>Program</th><th>Puan Türü</th><th>En Küçük Puan</th><th>Not</th></tr></thead>
          <tbody>
            {list.map((l, i) => {
              const p = byCode.get(l.program_kodu)
              return (
                <tr key={l.program_kodu}>
                  <td>{i + 1}</td>
                  <td style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{l.program_kodu}</td>
                  <td>{p?.universite}</td><td>{p?.program_adi}</td><td>{p?.puan_turu}</td>
                  <td>{p ? (p.en_kucuk_gk == null ? 'Dolmadı' : fmtPuan(p.en_kucuk_gk)) : ''}</td>
                  <td>{l.notlar}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(320px, 1fr)', gap: 18, alignItems: 'start' }}>
        {/* SOL: filtre + liste */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div className="card" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
            <div className="field"><label>Tablo</label>
              <select style={sel} value={tablo} onChange={(e) => setTablo(e.target.value)}>
                <option value="">Tümü</option><option value="onlisans">Ön Lisans</option><option value="lisans">Lisans</option>
              </select></div>
            <div className="field"><label>Puan türü</label>
              <select style={sel} value={puanTuru} onChange={(e) => setPuanTuru(e.target.value)}>
                <option value="">Tümü</option>{SCORE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select></div>
            <div className="field"><label>Üniversite türü</label>
              <select style={sel} value={turu} onChange={(e) => setTuru(e.target.value)}>
                <option value="">Tümü</option>
                {Object.entries(TURU_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div className="field"><label>Burs / indirim</label>
              <select style={sel} value={bursF} onChange={(e) => setBursF(e.target.value)}>
                <option value="">Tümü</option>{bursOptions.map((b) => <option key={b}>{b}</option>)}
              </select></div>
            <ChipMultiSelect
              label="İl" placeholder="İl ara…" selected={iller}
              onAdd={(v) => { setIller([...iller, v]); setIlQ('') }}
              onRemove={(v) => setIller(iller.filter((i) => i !== v))}
              query={ilQ} setQuery={setIlQ} open={ilOpen} setOpen={setIlOpen} suggestions={ilSuggestions}
            />
            <div className="field" style={{ gridColumn: 'span 2' }}><label>Program / üniversite ara</label>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="örn. hemsirelik, ege" /></div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={sadeceKont} onChange={(e) => setSadeceKont(e.target.checked)} /> Sadece kontenjanı olanlar
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={sadeceBos} onChange={(e) => setSadeceBos(e.target.checked)} /> En küçük puanı boş olanlar
            </label>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--ink-soft)', borderBottom: '1px solid var(--border)' }}>
              {loading ? 'Yükleniyor…' : `${filtered.length.toLocaleString('tr-TR')} sonuç`}
              {filtered.length > SHOW_LIMIT && ` (ilk ${SHOW_LIMIT} gösteriliyor — filtreleri daralt)`}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead><tr><th>Kod</th><th>Program</th><th>Puan</th><th>Kont.</th><th>En küçük</th><th /></tr></thead>
                <tbody>
                  {filtered.slice(0, SHOW_LIMIT).map((p) => (
                    <tr key={p.program_kodu} onClick={() => setOpenCode(p.program_kodu)} style={{ cursor: 'pointer', background: openCode === p.program_kodu ? 'var(--indigo-050)' : undefined }}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{p.program_kodu}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.program_adi}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{p.universite} · {p.il ?? '—'} · {TURU_LABEL[p.universite_turu]}</div>
                      </td>
                      <td>{p.puan_turu}</td>
                      <td>{kont(p)}</td>
                      <td>{p.en_kucuk_gk == null ? <span className="badge badge-subtle">Dolmadı</span> : fmtPuan(p.en_kucuk_gk)} <Warn p={p} /></td>
                      <td>
                        <button className="btn btn-ghost btn-sm" disabled={!studentId || full || inList(p.program_kodu)}
                          onClick={(e) => { e.stopPropagation(); add(p.program_kodu) }}
                          title={!studentId ? 'Önce öğrenci seç' : full ? '24 tercih sınırı' : inList(p.program_kodu) ? 'Listede' : 'Listeye ekle'}>
                          <Plus size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* SAĞ: detay + öğrenci */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {open && (() => {
            const u = findUcret(open, ucretler)
            return (
              <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 18 }}>{open.program_kodu}</div>
                  <div style={{ fontWeight: 700 }}>{open.program_adi}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                    {open.universite} · {open.il ?? '—'} · {TURU_LABEL[open.universite_turu]} · {TABLO_LABEL[open.tablo]} · {open.puan_turu}
                    {open.burs_indirim ? ` · ${open.burs_indirim}` : ''}
                  </div>
                </div>
                {lowScore(open) && (
                  <div className="alert alert-error">Puanın bu programın en küçük puanının ({fmtPuan(open.en_kucuk_gk)}) altında</div>
                )}
                <table className="table" style={{ width: '100%' }}>
                  <thead><tr><th /><th>Kontenjan</th><th>En küçük puan</th></tr></thead>
                  <tbody>
                    {([['Genel', open.genel_ek_kont, open.en_kucuk_gk], ['Şehit/gazi yakını', open.sgy_ek_kont, open.en_kucuk_sgy], ['34 yaş üstü kadın', open.k34_ek_kont, open.en_kucuk_34y]] as const).map(([l, k, s]) => (
                      <tr key={l}><td>{l}</td><td>{k}</td><td>{fmtPuan(s)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 4 }}>Koşullar</div>
                  {open.kosul_kodlari.length === 0 && <div style={{ fontSize: 13 }}>Koşul yok.</div>}
                  {open.kosul_kodlari.map((n) => {
                    const k = kosulMap.get(n)
                    return (
                      <div key={n} style={{ fontSize: 13, marginBottom: 6 }}>
                        <strong>{n}</strong>{k && <span className="badge badge-neutral" style={{ marginLeft: 6 }}>{k.kisim === 1 ? 'ÖSYM kontrol eder' : 'ÖSYM kontrol etmez'}</span>}
                        <div style={{ color: 'var(--ink-soft)' }}>{k ? k.metin : 'Koşul metni yüklenmedi'}</div>
                      </div>
                    )
                  })}
                </div>
                {u && (
                  <div className="alert alert-warning">
                    Yıllık ücret (yaklaşık eşleşme): {u.ucret != null ? `${u.ucret.toLocaleString('tr-TR')} ₺` : '—'}
                    {u.aciklama && <div style={{ fontWeight: 400, marginTop: 4 }}>{u.aciklama}</div>}
                  </div>
                )}
                <button className="btn btn-primary" disabled={!studentId || full || inList(open.program_kodu)} onClick={() => add(open.program_kodu)}>
                  <Plus size={14} /> {inList(open.program_kodu) ? 'Listede' : 'Listeye ekle'}
                </button>
                {full && !inList(open.program_kodu) && <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>24 tercih sınırı</div>}
                {!studentId && <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Eklemek için önce öğrenci seç.</div>}
              </div>
            )
          })()}

          <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field"><label>Öğrenci</label>
              <select style={sel} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">Öğrenci seç…</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select></div>

            {studentId && (
              <>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 6 }}>Öğrencinin puanları (bu tarayıcıda saklanır)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                    {SCORE_TYPES.map((t) => (
                      <div className="field" key={t}><label>{t}</label>
                        <input inputMode="decimal" value={scores[t] ?? ''} onChange={(e) => setScore(t, e.target.value)} style={{ width: '100%', minWidth: 0 }} /></div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <strong>Tercih listesi ({list.length}/{MAX_TERCIH})</strong>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" disabled={list.length === 0} onClick={() => window.print()}><Printer size={13} /> Yazdır</button>
                    <button className="btn btn-primary btn-sm" disabled={!dirty || saving} onClick={save}><Save size={13} /> {saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
                  </div>
                </div>
                {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`}>{msg.text}</div>}
                {full && <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>24 tercih sınırı</div>}
                {list.length === 0 && <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Liste boş. Soldan program seçip "Listeye ekle" de.</div>}

                {list.map((l, i) => {
                  const p = byCode.get(l.program_kodu)
                  return (
                    <div key={l.program_kodu} draggable
                      onDragStart={() => setDragIdx(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => { if (dragIdx != null) move(dragIdx, i); setDragIdx(null) }}
                      style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 8, background: 'var(--surface-alt)', cursor: 'grab', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span className="badge badge-primary">{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setOpenCode(l.program_kodu)}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{l.program_kodu}</div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{p?.program_adi ?? 'Program bu yılın verisinde yok'}</div>
                          {p && <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{p.universite}</div>}
                          {p && <Warn p={p} />}
                        </div>
                        <button className="btn btn-ghost btn-sm" title="Yukarı" disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp size={13} /></button>
                        <button className="btn btn-ghost btn-sm" title="Aşağı" disabled={i === list.length - 1} onClick={() => move(i, i + 1)}><ArrowDown size={13} /></button>
                        <button className="btn btn-ghost btn-sm" title="Sil" onClick={() => remove(i)}><Trash2 size={13} /></button>
                      </div>
                      <input value={l.notlar} maxLength={200} placeholder="Kısa not…" onChange={(e) => setNote(i, e.target.value)}
                        style={{ padding: '6px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--ink)', fontSize: 13 }} />
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
