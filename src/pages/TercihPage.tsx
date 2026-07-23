import { useEffect, useMemo, useState } from 'react'
import { Search, Trash2, ChevronDown, SlidersHorizontal, GraduationCap, Printer, Send, MessageSquare, X } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import PageHeader from '../components/layout/PageHeader'
import type { Student, UniversityRanking, ScoreType } from '../types/database'

// YÖK Atlas verisinde en son TAM yıl 2025 (YKS-2026 yerleşme sıralamaları henüz yok).
const REFERENCE_YEARS = [2025, 2024, 2023]
const SCORE_TYPES: ScoreType[] = ['SAY', 'EA', 'SÖZ', 'DİL', 'TYT']
const RESULT_LIMIT = 300

// Öğrenci track'i → puan türü ön-doldurma
const TRACK_TO_SCORE: Record<string, ScoreType> = { SAY: 'SAY', EA: 'EA', SÖZ: 'SÖZ' }

type FacetOptions = {
  cities: string[]
  universityTypes: string[]
  degreeLevels: string[]
  feeTypes: string[]
  educationTypes: string[]
}

const EMPTY_FACETS: FacetOptions = {
  cities: [],
  universityTypes: [],
  degreeLevels: [],
  feeTypes: [],
  educationTypes: [],
}

function uniqSorted(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v))).sort((a, b) =>
    a.localeCompare(b, 'tr'),
  )
}

// Türkçe ek/yumuşama desteği ile program arama terimlerini genişlet (örn: Mühendislik -> Mühendisliği, Mühendis)
function getProgramSearchTerms(rawText: string): string[] {
  const terms = rawText
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  const expanded: string[] = []

  for (const t of terms) {
    expanded.push(t)
    if (/lik$/i.test(t)) {
      expanded.push(t.replace(/lik$/i, 'liği'))
      expanded.push(t.replace(/lik$/i, ''))
    } else if (/liği$/i.test(t)) {
      expanded.push(t.replace(/liği$/i, 'lik'))
      expanded.push(t.replace(/liği$/i, ''))
    } else if (/lık$/i.test(t)) {
      expanded.push(t.replace(/lık$/i, 'lığı'))
      expanded.push(t.replace(/lık$/i, ''))
    } else if (/lığı$/i.test(t)) {
      expanded.push(t.replace(/lığı$/i, 'lık'))
      expanded.push(t.replace(/lığı$/i, ''))
    } else if (/lük$/i.test(t)) {
      expanded.push(t.replace(/lük$/i, 'lüğü'))
      expanded.push(t.replace(/lük$/i, ''))
    } else if (/lüğü$/i.test(t)) {
      expanded.push(t.replace(/lüğü$/i, 'lük'))
      expanded.push(t.replace(/lüğü$/i, ''))
    }
  }

  return Array.from(new Set(expanded.filter((x) => x.length >= 2)))
}

// Öğrencinin tahmini sıralamasına göre bir programın ulaşılabilirliği.
// Daha küçük sıra = daha iyi. Öğrenci sırası ≤ taban sıra → girebilir.
function reachability(studentRank: number | null, baseRanking: number | null) {
  if (!studentRank || baseRanking == null) return null
  if (studentRank <= baseRanking) return { label: 'Ulaşılabilir', tone: 'yeterli' as const }
  if (studentRank <= baseRanking * 1.15) return { label: 'Riskli', tone: 'gelisiyor' as const }
  return { label: 'Zor', tone: 'kritik' as const }
}

export default function TercihPage() {
  const [facets, setFacets] = useState<FacetOptions>(EMPTY_FACETS)
  const [students, setStudents] = useState<Student[]>([])

  // Filtreler (referanstaki 11 alan)
  const [year, setYear] = useState(2025)
  const [scoreType, setScoreType] = useState('')
  const [universite, setUniversite] = useState('')
  // Program: otomatik-tamamlamalı çoklu seçim (o puan türündeki programlar sunucuda dinamik aranır)
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([])
  const [programQuery, setProgramQuery] = useState('')
  const [programSuggestions, setProgramSuggestions] = useState<string[]>([])
  const [programBoxOpen, setProgramBoxOpen] = useState(false)
  const [loadingPool, setLoadingPool] = useState(false)
  const [cities, setCities] = useState<string[]>([])
  const [degreeLevel, setDegreeLevel] = useState('')
  const [universityType, setUniversityType] = useState('')
  const [feeType, setFeeType] = useState('')
  const [educationType, setEducationType] = useState('')
  const [programCode, setProgramCode] = useState('')
  const [minSira, setMinSira] = useState('')
  const [maxSira, setMaxSira] = useState('')

  // Öğrenci entegrasyonu (elle + ön-doldur)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [studentRank, setStudentRank] = useState('')

  const [cityPickerOpen, setCityPickerOpen] = useState(false)
  const [citySearch, setCitySearch] = useState('')
  const [waMenuOpen, setWaMenuOpen] = useState(false)

  const [results, setResults] = useState<UniversityRanking[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [truncated, setTruncated] = useState(false)

  // Facet seçenekleri + öğrenciler (tek sefer)
  useEffect(() => {
    if (!isSupabaseConfigured) return

    // Supabase 1000 satır hard-cap → tüm distinct facet değerleri (özellikle şehirler) için
    // önce sayım, sonra parça parça (range) paralel çekip birleştir.
    ;(async () => {
      const PAGE = 1000
      const { count } = await supabase
        .from('university_rankings')
        .select('*', { count: 'exact', head: true })
        .eq('year', 2025)
      const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE))
      const reqs = Array.from({ length: pages }, (_, i) =>
        supabase
          .from('university_rankings')
          .select('city, university_type, degree_level, fee_type, education_type')
          .eq('year', 2025)
          .range(i * PAGE, i * PAGE + PAGE - 1),
      )
      const results = await Promise.all(reqs)
      const rows = results.flatMap((r) => r.data ?? [])
      if (rows.length === 0) return
      setFacets({
        cities: uniqSorted(rows.map((r) => r.city)),
        universityTypes: uniqSorted(rows.map((r) => r.university_type)),
        degreeLevels: uniqSorted(rows.map((r) => r.degree_level)),
        feeTypes: uniqSorted(rows.map((r) => r.fee_type)),
        educationTypes: uniqSorted(rows.map((r) => r.education_type)),
      })
    })()

    supabase
      .from('students')
      .select('*')
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .then(({ data }) => {
        if (data) setStudents(data)
      })
  }, [])

  // Program önerileri: kutu açıkken, yazılan metne göre SUNUCUDA ilike ile ara (debounce'lu).
  // 1000 satır cap sorun değil — program adları üniversiteler arası tekrar ettiği için
  // yazılan terimin distinct adları tek istekte yakalanır. Boş sorgu → o puan türünden bir örnek liste.
  useEffect(() => {
    if (!isSupabaseConfigured || !programBoxOpen) return
    let cancelled = false
    const handle = setTimeout(async () => {
      setLoadingPool(true)
      let q = supabase.from('university_rankings').select('program').eq('year', year)
      if (scoreType) q = q.eq('score_type', scoreType as ScoreType)
      const term = programQuery.trim()
      if (term) q = q.ilike('program', `%${term}%`)
      const { data } = await q.limit(1000)
      if (cancelled) return
      setProgramSuggestions(uniqSorted((data ?? []).map((r) => r.program)))
      setLoadingPool(false)
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [programQuery, scoreType, year, programBoxOpen])

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? null,
    [students, selectedStudentId],
  )

  // Seçilmiş olanları öneri listesinden çıkar, ekranda ilk 100'ü göster.
  const visibleSuggestions = useMemo(
    () => programSuggestions.filter((p) => !selectedPrograms.includes(p)).slice(0, 100),
    [programSuggestions, selectedPrograms],
  )

  function addProgram(p: string) {
    setSelectedPrograms((prev) => (prev.includes(p) ? prev : [...prev, p]))
    setProgramQuery('')
  }
  function removeProgram(p: string) {
    setSelectedPrograms((prev) => prev.filter((x) => x !== p))
  }
  function openProgramBox() {
    setProgramBoxOpen(true)
  }

  const rank = studentRank.trim() ? Number(studentRank.trim()) : null

  function handleStudentChange(id: string) {
    setSelectedStudentId(id)
    const student = students.find((s) => s.id === id)
    if (student) {
      const mapped = TRACK_TO_SCORE[student.track]
      if (mapped) setScoreType(mapped)
      if (student.target_net_value == null && student.target_ranking) {
        const num = student.target_ranking.replace(/[^\d]/g, '')
        if (num) setStudentRank(num)
      }
    }
  }

  function toggleCity(city: string) {
    setCities((prev) => (prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]))
  }

  function clearFilters() {
    setScoreType('')
    setUniversite('')
    setSelectedPrograms([])
    setProgramQuery('')
    setCities([])
    setDegreeLevel('')
    setUniversityType('')
    setFeeType('')
    setEducationType('')
    setProgramCode('')
    setMinSira('')
    setMaxSira('')
    setSelectedStudentId('')
    setStudentRank('')
    setResults([])
    setHasSearched(false)
    setTruncated(false)
  }

  async function runSearch() {
    if (!isSupabaseConfigured) return
    setLoading(true)
    setHasSearched(true)
    setCityPickerOpen(false)

    let query = supabase
      .from('university_rankings')
      .select('*')
      .eq('year', year)

    if (scoreType) query = query.eq('score_type', scoreType as ScoreType)
    if (universityType) query = query.eq('university_type', universityType)
    if (degreeLevel) query = query.eq('degree_level', degreeLevel)
    if (feeType) query = query.eq('fee_type', feeType)
    if (educationType) query = query.eq('education_type', educationType)
    if (cities.length) query = query.in('city', cities)
    if (universite.trim()) query = query.ilike('university', `%${universite.trim()}%`)
    if (programCode.trim()) query = query.eq('program_code', Number(programCode.trim()))

    // Program: seçilmiş çipler varsa tam eşleşme (.in); yoksa yazılan metne Türkçe-ek genişletmeli ilike.
    if (selectedPrograms.length) {
      query = query.in('program', selectedPrograms)
    } else if (programQuery.trim()) {
      const programTerms = getProgramSearchTerms(programQuery)
      if (programTerms.length === 1) {
        query = query.ilike('program', `%${programTerms[0]}%`)
      } else if (programTerms.length > 1) {
        query = query.or(programTerms.map((t) => `program.ilike.*${t}*`).join(','))
      }
    }

    if (minSira.trim()) query = query.gte('base_ranking', Number(minSira.trim()))
    if (maxSira.trim()) query = query.lte('base_ranking', Number(maxSira.trim()))

    query = query
      .order('base_ranking', { ascending: true, nullsFirst: false })
      .limit(RESULT_LIMIT + 1)

    const { data, error } = await query
    if (error) {
      console.error('[tercih] sorgu hatası', error)
      setResults([])
    } else if (data) {
      setTruncated(data.length > RESULT_LIMIT)
      setResults(data.slice(0, RESULT_LIMIT))
    }
    setLoading(false)
  }

  function generateWhatsAppText() {
    if (results.length === 0) return ''
    const header = selectedStudent
      ? `🎓 *NETLİK TERCIH LİSTESİ - ${selectedStudent.full_name.toUpperCase()}*`
      : '🎓 *NETLİK TERCIH LİSTESİ ÖNERİLERİ*'

    const rankStr = rank ? `\n📊 Tahmini Sıralama: *${rank.toLocaleString('tr')}*` : ''
    const metaStr = `\n📌 Yıl: ${year} | Puan Türü: ${scoreType || 'Tümü'}${selectedPrograms.length ? ` | Program: ${selectedPrograms.join(', ')}` : ''}${cities.length ? ` | Şehir: ${cities.join(', ')}` : ''}`

    const topItems = results.slice(0, 15)
    const listStr = topItems
      .map((r, i) => {
        const reach = reachability(rank, r.base_ranking)
        const status = reach ? ` [${reach.label}]` : ''
        const baseRank = r.base_ranking ? ` (Sıra: ${r.base_ranking.toLocaleString('tr')})` : ''
        return `${i + 1}. *${r.university}* - ${r.program}${baseRank}${status}\n   *(ÖSYM Kod: ${r.program_code})*`
      })
      .join('\n\n')

    return `${header}${rankStr}${metaStr}\n\n${listStr}\n\n✨ *Netlik Koçluk Paneli ile oluşturuldu.*`
  }

  function handleSendWhatsApp(targetPhone?: string | null) {
    const text = generateWhatsAppText()
    if (!text) return
    const cleanPhone = targetPhone ? targetPhone.replace(/[^\d+]/g, '') : ''
    const encoded = encodeURIComponent(text)
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`
    window.open(url, '_blank')
    setWaMenuOpen(false)
  }

  const filteredCityOptions = facets.cities.filter((c) =>
    c.toLocaleLowerCase('tr').includes(citySearch.toLocaleLowerCase('tr')),
  )

  const inputStyle = { width: '100%' }

  return (
    <section className="screen">
      {/* PRINT-ONLY BAŞLIK */}
      <div className="print-only" style={{ display: 'none', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, margin: 0, fontWeight: 800 }}>NETLİK · TERCIH LİSTESİ RAPORU</h1>
            <p style={{ fontSize: 13, margin: '4px 0 0 0', color: '#444' }}>
              {selectedStudent ? `Öğrenci: ${selectedStudent.full_name} (${selectedStudent.track})` : 'Üniversite & Bölüm Tercih Listesi'}
              {rank && ` · Tahmini Sıralama: ${rank.toLocaleString('tr')}`}
            </p>
          </div>
          <div style={{ fontSize: 12, textAlign: 'right', color: '#666' }}>
            Tarih: {new Date().toLocaleDateString('tr-TR')}
            <br />
            Veri Kaynağı: YÖK Atlas ({year})
          </div>
        </div>
      </div>

      <PageHeader
        title="Tercih Sihirbazı"
        subtitle="YÖK Atlas 2025 taban puan ve başarı sırası verisiyle bölüm arama ve tercih listesi oluşturma"
      />

      {!isSupabaseConfigured && (
        <div
          className="card no-print"
          style={{ padding: 16, marginBottom: 20, background: 'var(--warning-bg)', border: 'none', color: 'var(--warning-text)' }}
        >
          Supabase bağlı değil — <code>.env.local</code> tanımlanınca üniversite verisi görünecek.
        </div>
      )}

      {/* FİLTRE PANELİ */}
      <div className="card no-print" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontWeight: 700 }}>
          <SlidersHorizontal size={18} /> Tercih Sihirbazı Filtreleri
        </div>

        {/* 1. satır */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div className="field">
            <label>Puan Türü</label>
            <select style={inputStyle} value={scoreType} onChange={(e) => setScoreType(e.target.value)}>
              <option value="">Hepsi</option>
              {SCORE_TYPES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Üniversite</label>
            <input style={inputStyle} type="text" placeholder="Örn: Boğaziçi" value={universite} onChange={(e) => setUniversite(e.target.value)} />
          </div>

          {/* Program: otomatik-tamamlamalı çoklu seçim */}
          <div className="field" style={{ position: 'relative' }}>
            <label>Program{selectedPrograms.length > 0 ? ` (${selectedPrograms.length})` : ''}</label>
            <div
              onClick={openProgramBox}
              style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 40, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', cursor: 'text' }}
            >
              {selectedPrograms.map((p) => (
                <span key={p} className="chip chip-say" style={{ gap: 4 }}>
                  {p}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeProgram(p) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', color: 'inherit' }}
                    title="Kaldır"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder={selectedPrograms.length ? 'Başka program ekle…' : 'Yaz — programlar listelenir'}
                value={programQuery}
                onFocus={openProgramBox}
                onBlur={() => setTimeout(() => setProgramBoxOpen(false), 150)}
                onChange={(e) => { setProgramQuery(e.target.value); openProgramBox() }}
                style={{ flex: 1, minWidth: 90, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 13.5, padding: '2px 0' }}
              />
            </div>
            {programBoxOpen && (
              <div
                className="card"
                style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 25, marginTop: 4, padding: 6, maxHeight: 260, overflowY: 'auto', boxShadow: 'var(--shadow-card)' }}
              >
                {loadingPool && <div style={{ padding: 8, color: 'var(--ink-soft)', fontSize: 13 }}>Aranıyor…</div>}
                {!loadingPool && visibleSuggestions.length === 0 && (
                  <div style={{ padding: 8, color: 'var(--ink-soft)', fontSize: 13 }}>
                    {programQuery.trim() ? 'Eşleşen program yok' : 'Yazmaya başlayın…'}
                  </div>
                )}
                {!loadingPool && visibleSuggestions.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', border: 'none', fontWeight: 500 }}
                    onMouseDown={(e) => { e.preventDefault(); addProgram(p) }}
                  >
                    {p}
                  </button>
                ))}
                {!loadingPool && visibleSuggestions.length > 0 && (
                  <div style={{ padding: '6px 8px 2px', fontSize: 11, color: 'var(--ink-soft)', borderTop: '1px solid var(--border)', marginTop: 4 }}>
                    {scoreType ? `${scoreType} · ` : 'Tüm türler · '}tıklayarak ekle, birden fazla seçebilirsin
                    {programSuggestions.length > visibleSuggestions.length + selectedPrograms.length ? ' · daraltmak için yazın' : ''}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Şehir: çoklu seçim */}
          <div className="field" style={{ position: 'relative' }}>
            <label>Şehir</label>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'space-between', fontWeight: 500 }}
              onClick={() => setCityPickerOpen((o) => !o)}
            >
              <span style={{ color: cities.length ? 'var(--ink)' : 'var(--ink-soft)' }}>
                {cities.length ? `${cities.length} şehir seçili` : 'Şehir seçin'}
              </span>
              <ChevronDown size={16} />
            </button>
            {cityPickerOpen && (
              <div
                className="card"
                style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, padding: 10, maxHeight: 280, overflowY: 'auto', boxShadow: 'var(--shadow-card)' }}
              >
                <input
                  type="text"
                  placeholder="Şehir ara…"
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  style={{ width: '100%', marginBottom: 8, padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--ink)', fontSize: 13 }}
                />
                {cities.length > 0 && (
                  <button type="button" className="btn btn-sm btn-ghost" style={{ marginBottom: 8 }} onClick={() => setCities([])}>
                    Seçimi temizle
                  </button>
                )}
                {filteredCityOptions.map((c) => (
                  <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={cities.includes(c)} onChange={() => toggleCity(c)} />
                    {c}
                  </label>
                ))}
                {filteredCityOptions.length === 0 && (
                  <div style={{ padding: 8, color: 'var(--ink-soft)', fontSize: 13 }}>Sonuç yok</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2. satır */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 14 }}>
          <div className="field">
            <label>Ön Lisans / Lisans</label>
            <select style={inputStyle} value={degreeLevel} onChange={(e) => setDegreeLevel(e.target.value)}>
              <option value="">Hepsi</option>
              {facets.degreeLevels.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Üniversite Türü</label>
            <select style={inputStyle} value={universityType} onChange={(e) => setUniversityType(e.target.value)}>
              <option value="">Hepsi</option>
              {facets.universityTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Ücret / Burs</label>
            <select style={inputStyle} value={feeType} onChange={(e) => setFeeType(e.target.value)}>
              <option value="">Hepsi</option>
              {facets.feeTypes.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Öğretim Türü</label>
            <select style={inputStyle} value={educationType} onChange={(e) => setEducationType(e.target.value)}>
              <option value="">Hepsi</option>
              {facets.educationTypes.map((e2) => (
                <option key={e2} value={e2}>{e2}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. satır */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 14 }}>
          <div className="field">
            <label>Program Kodu</label>
            <input style={inputStyle} type="text" inputMode="numeric" placeholder="Örn: 105510892" value={programCode} onChange={(e) => setProgramCode(e.target.value)} />
          </div>
          <div className="field">
            <label>En Az Başarı Sırası</label>
            <input style={inputStyle} type="number" placeholder="Örn: 40000" value={minSira} onChange={(e) => setMinSira(e.target.value)} />
          </div>
          <div className="field">
            <label>En Çok Başarı Sırası</label>
            <input style={inputStyle} type="number" placeholder="Örn: 90000" value={maxSira} onChange={(e) => setMaxSira(e.target.value)} />
          </div>
          <div className="field">
            <label>Yıl</label>
            <select style={inputStyle} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {REFERENCE_YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Öğrenci entegrasyonu */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><GraduationCap size={14} /> Öğrenci (opsiyonel)</label>
            <select style={inputStyle} value={selectedStudentId} onChange={(e) => handleStudentChange(e.target.value)}>
              <option value="">Öğrenci seç — puan türünü ön-doldur</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name} ({s.track})</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Öğrenci Tahmini Sıralaması</label>
            <input style={inputStyle} type="number" placeholder="Ulaşılabilirlik için" value={studentRank} onChange={(e) => setStudentRank(e.target.value)} />
          </div>
          {selectedStudent && (
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                Sıralama <strong>tahminidir</strong>, elle düzeltebilirsiniz.
              </div>
            </div>
          )}
        </div>

        {/* Butonlar */}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button type="button" className="btn btn-ghost" onClick={clearFilters}>
            <Trash2 size={15} /> Temizle
          </button>
          <button type="button" className="btn btn-primary" onClick={runSearch} disabled={loading}>
            <Search size={15} /> {loading ? 'Aranıyor…' : 'Ara'}
          </button>
        </div>
      </div>

      {/* SONUÇLAR */}
      {hasSearched && !loading && results.length === 0 && (
        <div className="card empty-state" style={{ padding: 40, textAlign: 'center' }}>
          Bu kriterlere uyan program bulunamadı. Filtreleri gevşetmeyi deneyin.
        </div>
      )}

      {results.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontWeight: 600, color: 'var(--ink-soft)', fontSize: 13 }}>
              {results.length} program{truncated ? ` (ilk ${RESULT_LIMIT} gösteriliyor — filtreleri daraltın)` : ''} · başarı sırasına göre
            </div>

            {/* Aksiyon butonları */}
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
              {/* Yazdır / PDF */}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => window.print()}
                title="Yazdır ya da PDF olarak kaydet"
              >
                <Printer size={15} /> Yazdır / PDF
              </button>

              {/* WhatsApp ile Gönder */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ background: '#25D366', color: '#fff', border: 'none', gap: 6 }}
                  onClick={() => setWaMenuOpen((o) => !o)}
                >
                  <Send size={14} /> WhatsApp ile Paylaş <ChevronDown size={14} />
                </button>

                {waMenuOpen && (
                  <div
                    className="card"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      marginTop: 4,
                      zIndex: 30,
                      minWidth: 220,
                      padding: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      boxShadow: 'var(--shadow-card)',
                    }}
                  >
                    {selectedStudent?.phone_number && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                        onClick={() => handleSendWhatsApp(selectedStudent.phone_number)}
                      >
                        <MessageSquare size={14} /> Öğrenciye Gönder ({selectedStudent.full_name})
                      </button>
                    )}
                    {selectedStudent?.parent_phone_number && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                        onClick={() => handleSendWhatsApp(selectedStudent.parent_phone_number)}
                      >
                        <MessageSquare size={14} /> Veliye Gönder
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                      onClick={() => handleSendWhatsApp(null)}
                    >
                      <Send size={14} /> Genel Paylaş (Numarasız)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--ink-soft)' }}>
                  <th style={{ padding: '10px 12px' }}>Kod</th>
                  <th style={{ padding: '10px 12px' }}>Üniversite</th>
                  <th style={{ padding: '10px 12px' }}>Program</th>
                  <th style={{ padding: '10px 12px' }}>Şehir</th>
                  <th style={{ padding: '10px 12px' }}>Tür</th>
                  <th style={{ padding: '10px 12px' }}>Ücret/Burs</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Taban Puan</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Başarı Sırası</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Kont.</th>
                  {rank && <th style={{ padding: '10px 12px', textAlign: 'center' }}>Durum</th>}
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const reach = reachability(rank, r.base_ranking)
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--ink-soft)' }}>{r.program_code}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.university}</td>
                      <td style={{ padding: '10px 12px' }}>{r.program}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--ink-soft)' }}>{r.city ?? '—'}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--ink-soft)' }}>{r.university_type ?? '—'}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--ink-soft)' }}>{r.fee_type ?? '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                        {r.base_score != null ? Number(r.base_score).toFixed(2) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--indigo-600)' }}>
                        {r.base_ranking != null ? Number(r.base_ranking).toLocaleString('tr') : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--ink-soft)' }}>{r.quota ?? '—'}</td>
                      {rank && (
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {reach ? <span className={`pill-state pill-${reach.tone}`}>{reach.label}</span> : '—'}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
