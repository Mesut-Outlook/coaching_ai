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

// --- Türkçe karakter duyarsız arama ---
// "tip" yazınca "Tıp" bulunsun. Sunucu tarafı: her harfi Türkçe varyantlarını
// içeren regex sınıfına çevirip PostgREST imatch (~*) ile ara. İstemci: ASCII'ye katla.
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
const TR_CLASS: Record<string, string> = {
  i: '[iıİI]', 'ı': '[iıİI]',
  s: '[sşSŞ]', 'ş': '[sşSŞ]',
  c: '[cçCÇ]', 'ç': '[cçCÇ]',
  g: '[gğGĞ]', 'ğ': '[gğGĞ]',
  u: '[uüUÜ]', 'ü': '[uüUÜ]',
  o: '[oöOÖ]', 'ö': '[oöOÖ]',
}
function turkishRegex(term: string): string {
  return Array.from(term.trim())
    .map((ch) => TR_CLASS[ch.toLocaleLowerCase('tr')] ?? escapeRegex(ch))
    .join('')
}
function foldTr(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c')
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o')
    .replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u')
}

// Öğrencinin tahmini sıralamasına göre bir programın ulaşılabilirliği.
// Daha küçük sıra = daha iyi. Öğrenci sırası ≤ taban sıra → girebilir.
type StatusLabel = 'Ulaşılabilir' | 'Riskli' | 'Zor'
const STATUS_ORDER: StatusLabel[] = ['Ulaşılabilir', 'Riskli', 'Zor']
const STATUS_TONE: Record<StatusLabel, 'yeterli' | 'gelisiyor' | 'kritik'> = {
  'Ulaşılabilir': 'yeterli',
  'Riskli': 'gelisiyor',
  'Zor': 'kritik',
}
const RISK_FACTOR = 1.15

function reachability(studentRank: number | null, baseRanking: number | null) {
  if (!studentRank || baseRanking == null) return null
  if (studentRank <= baseRanking) return { label: 'Ulaşılabilir' as StatusLabel, tone: STATUS_TONE['Ulaşılabilir'] }
  if (studentRank <= baseRanking * RISK_FACTOR) return { label: 'Riskli' as StatusLabel, tone: STATUS_TONE['Riskli'] }
  return { label: 'Zor' as StatusLabel, tone: STATUS_TONE['Zor'] }
}

// Bir durum etiketinin base_ranking bandı (öğrenci sırası r için). [lo, hi) — hi=Infinity üst sınırsız.
function statusBand(label: StatusLabel, r: number): [number, number] {
  if (label === 'Ulaşılabilir') return [r, Infinity]
  if (label === 'Riskli') return [r / RISK_FACTOR, r]
  return [0, r / RISK_FACTOR] // Zor
}

// Ortak çip + otomatik-tamamlama seçici (Program, Üniversite, Şehir aynı deseni kullanır).
function ChipMultiSelect({
  label, placeholder, selected, onAdd, onRemove,
  query, setQuery, open, setOpen, suggestions, loading,
}: {
  label: string
  placeholder: string
  selected: string[]
  onAdd: (v: string) => void
  onRemove: (v: string) => void
  query: string
  setQuery: (v: string) => void
  open: boolean
  setOpen: (v: boolean) => void
  suggestions: string[]
  loading?: boolean
}) {
  return (
    <div className="field" style={{ position: 'relative' }}>
      <label>{label}{selected.length > 0 ? ` (${selected.length})` : ''}</label>
      <div
        onClick={() => setOpen(true)}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 40, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', cursor: 'text' }}
      >
        {selected.map((v) => (
          <span key={v} className="chip chip-say" style={{ gap: 4 }}>
            {v}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(v) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', color: 'inherit' }}
              title="Kaldır"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          placeholder={selected.length ? 'Başka ekle…' : placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          style={{ flex: 1, minWidth: 90, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontSize: 13.5, padding: '2px 0' }}
        />
      </div>
      {open && (
        <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 25, marginTop: 4, padding: 6, maxHeight: 260, overflowY: 'auto', boxShadow: 'var(--shadow-card)' }}>
          {loading && <div style={{ padding: 8, color: 'var(--ink-soft)', fontSize: 13 }}>Aranıyor…</div>}
          {!loading && suggestions.length === 0 && (
            <div style={{ padding: 8, color: 'var(--ink-soft)', fontSize: 13 }}>
              {query.trim() ? 'Eşleşen yok' : 'Yazmaya başlayın…'}
            </div>
          )}
          {!loading && suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', border: 'none', fontWeight: 500 }}
              onMouseDown={(e) => { e.preventDefault(); onAdd(s) }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TercihPage() {
  const [facets, setFacets] = useState<FacetOptions>(EMPTY_FACETS)
  const [students, setStudents] = useState<Student[]>([])

  // Filtreler (referanstaki 11 alan)
  const [year, setYear] = useState(2025)
  const [scoreType, setScoreType] = useState('')
  // Üniversite: otomatik-tamamlamalı çoklu seçim (Türkçe-duyarsız)
  const [selectedUniversities, setSelectedUniversities] = useState<string[]>([])
  const [universityQuery, setUniversityQuery] = useState('')
  const [universitySuggestions, setUniversitySuggestions] = useState<string[]>([])
  const [universityBoxOpen, setUniversityBoxOpen] = useState(false)
  const [loadingUni, setLoadingUni] = useState(false)
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
  // Durum (ulaşılabilirlik) filtresi — öğrenci sıralaması girilince çalışır
  const [statusFilter, setStatusFilter] = useState<StatusLabel[]>([])

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
      if (term) q = q.filter('program', 'imatch', turkishRegex(term))
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

  // Üniversite önerileri: kutu açıkken Türkçe-duyarsız (imatch) sunucu araması, debounce'lu.
  useEffect(() => {
    if (!isSupabaseConfigured || !universityBoxOpen) return
    let cancelled = false
    const handle = setTimeout(async () => {
      setLoadingUni(true)
      let q = supabase.from('university_rankings').select('university').eq('year', year)
      const term = universityQuery.trim()
      if (term) q = q.filter('university', 'imatch', turkishRegex(term))
      const { data } = await q.limit(1000)
      if (cancelled) return
      setUniversitySuggestions(uniqSorted((data ?? []).map((r) => r.university)))
      setLoadingUni(false)
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [universityQuery, year, universityBoxOpen])

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) ?? null,
    [students, selectedStudentId],
  )

  // Seçilmiş olanları öneri listelerinden çıkar, ilk 100'ü göster.
  const visibleSuggestions = useMemo(
    () => programSuggestions.filter((p) => !selectedPrograms.includes(p)).slice(0, 100),
    [programSuggestions, selectedPrograms],
  )
  const visibleUniSuggestions = useMemo(
    () => universitySuggestions.filter((u) => !selectedUniversities.includes(u)).slice(0, 100),
    [universitySuggestions, selectedUniversities],
  )
  // Şehir önerileri istemci tarafı (facet listesi) — Türkçe-duyarsız katlama ile.
  const citySuggestions = useMemo(() => {
    const q = foldTr(citySearch)
    return facets.cities
      .filter((c) => !cities.includes(c) && (q === '' || foldTr(c).includes(q)))
      .slice(0, 100)
  }, [facets.cities, citySearch, cities])

  function addProgram(p: string) {
    setSelectedPrograms((prev) => (prev.includes(p) ? prev : [...prev, p]))
    setProgramQuery('')
  }
  function removeProgram(p: string) {
    setSelectedPrograms((prev) => prev.filter((x) => x !== p))
  }
  function addUniversity(u: string) {
    setSelectedUniversities((prev) => (prev.includes(u) ? prev : [...prev, u]))
    setUniversityQuery('')
  }
  function removeUniversity(u: string) {
    setSelectedUniversities((prev) => prev.filter((x) => x !== u))
  }
  function addCity(c: string) {
    setCities((prev) => (prev.includes(c) ? prev : [...prev, c]))
    setCitySearch('')
  }
  function removeCity(c: string) {
    setCities((prev) => prev.filter((x) => x !== c))
  }

  const rank = studentRank.trim() ? Number(studentRank.trim()) : null

  function toggleStatus(s: StatusLabel) {
    setStatusFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  // Durum filtresi aktifse (öğrenci sırası + seçili durum) sonuçları o duruma göre süz.
  const displayResults = useMemo(() => {
    if (!rank || statusFilter.length === 0 || statusFilter.length === 3) return results
    return results.filter((r) => {
      const reach = reachability(rank, r.base_ranking)
      return reach !== null && statusFilter.includes(reach.label)
    })
  }, [results, rank, statusFilter])

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

  function clearFilters() {
    setScoreType('')
    setSelectedUniversities([])
    setUniversityQuery('')
    setSelectedPrograms([])
    setProgramQuery('')
    setCities([])
    setCitySearch('')
    setDegreeLevel('')
    setUniversityType('')
    setFeeType('')
    setEducationType('')
    setProgramCode('')
    setMinSira('')
    setMaxSira('')
    setSelectedStudentId('')
    setStudentRank('')
    setStatusFilter([])
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
    if (programCode.trim()) query = query.eq('program_code', Number(programCode.trim()))

    // Üniversite: seçili çipler → tam eşleşme (.in); yoksa yazılan metne Türkçe-duyarsız imatch.
    if (selectedUniversities.length) {
      query = query.in('university', selectedUniversities)
    } else if (universityQuery.trim()) {
      query = query.filter('university', 'imatch', turkishRegex(universityQuery.trim()))
    }

    // Program: seçili çipler → tam eşleşme (.in); yoksa yazılan metne Türkçe-duyarsız imatch.
    if (selectedPrograms.length) {
      query = query.in('program', selectedPrograms)
    } else if (programQuery.trim()) {
      query = query.filter('program', 'imatch', turkishRegex(programQuery.trim()))
    }

    if (minSira.trim()) query = query.gte('base_ranking', Number(minSira.trim()))
    if (maxSira.trim()) query = query.lte('base_ranking', Number(maxSira.trim()))

    // Durum (ulaşılabilirlik) filtresi: öğrenci sırası + seçili durum(lar) → base_ranking bandı.
    // Bitişik seçimler tek aralık olur; kesin süzme render'da displayResults ile yapılır.
    if (rank && statusFilter.length > 0 && statusFilter.length < 3) {
      const bands = statusFilter.map((s) => statusBand(s, rank))
      const lo = Math.min(...bands.map((b) => b[0]))
      const hi = Math.max(...bands.map((b) => b[1]))
      if (lo > 0) query = query.gte('base_ranking', lo)
      if (hi !== Infinity) query = query.lt('base_ranking', hi)
    }

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
    if (displayResults.length === 0) return ''
    const header = selectedStudent
      ? `🎓 *NETLİK TERCIH LİSTESİ - ${selectedStudent.full_name.toUpperCase()}*`
      : '🎓 *NETLİK TERCIH LİSTESİ ÖNERİLERİ*'

    const rankStr = rank ? `\n📊 Tahmini Sıralama: *${rank.toLocaleString('tr')}*` : ''
    const metaStr = `\n📌 Yıl: ${year} | Puan Türü: ${scoreType || 'Tümü'}${selectedUniversities.length ? ` | Üniversite: ${selectedUniversities.join(', ')}` : ''}${selectedPrograms.length ? ` | Program: ${selectedPrograms.join(', ')}` : ''}${cities.length ? ` | Şehir: ${cities.join(', ')}` : ''}`

    const topItems = displayResults.slice(0, 15)
    const listStr = topItems
      .map((r, i) => {
        const reach = reachability(rank, r.base_ranking)
        const status = reach ? ` [${reach.label}]` : ''
        const baseRank = r.base_ranking ? ` (Sıra: ${r.base_ranking.toLocaleString('tr')})` : ''
        return `${i + 1}. *${r.university}* - ${r.program}${baseRank}${status}\n   *(ÖSYM Kod: ${r.program_code})*`
      })
      .join('\n\n')

    return `${header}${rankStr}${metaStr}\n\n${listStr}\n\n✨ *Eda Cangert Koçluk Merkezi tarafından hazırlandı.*`
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

          <ChipMultiSelect
            label="Üniversite"
            placeholder="Örn: boğaziçi"
            selected={selectedUniversities}
            onAdd={addUniversity}
            onRemove={removeUniversity}
            query={universityQuery}
            setQuery={setUniversityQuery}
            open={universityBoxOpen}
            setOpen={setUniversityBoxOpen}
            suggestions={visibleUniSuggestions}
            loading={loadingUni}
          />

          <ChipMultiSelect
            label="Program"
            placeholder="Örn: tıp (Türkçe karakter gerekmez)"
            selected={selectedPrograms}
            onAdd={addProgram}
            onRemove={removeProgram}
            query={programQuery}
            setQuery={setProgramQuery}
            open={programBoxOpen}
            setOpen={setProgramBoxOpen}
            suggestions={visibleSuggestions}
            loading={loadingPool}
          />

          <ChipMultiSelect
            label="Şehir"
            placeholder="Şehir ara…"
            selected={cities}
            onAdd={addCity}
            onRemove={removeCity}
            query={citySearch}
            setQuery={setCitySearch}
            open={cityPickerOpen}
            setOpen={setCityPickerOpen}
            suggestions={citySuggestions}
          />
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
            {selectedStudent && (
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                Sıralama <strong>tahminidir</strong>, elle düzeltebilirsiniz.
              </div>
            )}
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Durum (ulaşılabilirlik) filtresi</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', minHeight: 40 }}>
              {STATUS_ORDER.map((s) => {
                const active = statusFilter.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStatus(s)}
                    disabled={!rank}
                    className={active ? `pill-state pill-${STATUS_TONE[s]}` : 'btn btn-ghost btn-sm'}
                    style={{ cursor: rank ? 'pointer' : 'not-allowed', opacity: rank ? 1 : 0.5, border: active ? '1px solid transparent' : undefined }}
                    title={rank ? '' : 'Önce öğrenci tahmini sıralaması girin'}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
              {rank ? 'Seçtiklerin gösterilir · boş = hepsi' : 'Öğrenci sıralaması girilince aktifleşir'}
            </div>
          </div>
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
      {hasSearched && !loading && displayResults.length === 0 && (
        <div className="card empty-state" style={{ padding: 40, textAlign: 'center' }}>
          Bu kriterlere uyan program bulunamadı. Filtreleri gevşetmeyi deneyin.
        </div>
      )}

      {displayResults.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontWeight: 600, color: 'var(--ink-soft)', fontSize: 13 }}>
              {displayResults.length} program{truncated ? ` (ilk ${RESULT_LIMIT} taranıyor — filtreleri daraltın)` : ''} · başarı sırasına göre
              {rank && statusFilter.length > 0 && statusFilter.length < 3 ? ` · ${statusFilter.join(' + ')}` : ''}
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
                {displayResults.map((r) => {
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
