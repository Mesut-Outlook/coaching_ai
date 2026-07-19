import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Trash2, ClipboardList, AlertCircle, Save, Search } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import PageHeader from '../components/layout/PageHeader'
import type { Student, MockExam, MockExamSection } from '../types/database'

const SECTIONS_CONFIG = {
  TYT: [
    { name: 'Türkçe', max: 40 },
    { name: 'Matematik', max: 40 },
    { name: 'Sosyal Bilimler', max: 20 },
    { name: 'Fen Bilimleri', max: 20 },
  ],
  AYT: {
    SAY: [
      { name: 'Matematik', max: 40 },
      { name: 'Fen Bilimleri', max: 40 },
    ],
    EA: [
      { name: 'Matematik', max: 40 },
      { name: 'Edebiyat-Sosyal1', max: 40 },
    ],
    SÖZ: [
      { name: 'Edebiyat-Sosyal1', max: 40 },
      { name: 'Sosyal Bilimler-2', max: 40 },
    ],
  }
}

export default function DenemelerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialStudentId = searchParams.get('studentId') || ''
  
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId)
  const [exams, setExams] = useState<(MockExam & { totalNet: number; sectionsList: MockExamSection[] })[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form State
  const [examName, setExamName] = useState('')
  const [publisher, setPublisher] = useState('')
  const [examType, setExamType] = useState<'TYT' | 'AYT'>('TYT')
  const [examDate, setExamDate] = useState(new Date().toISOString().split('T')[0])
  const [scores, setScores] = useState<Record<string, { correct: number; wrong: number }>>({})

  // Tab View State
  const [activeViewTab, setActiveViewTab] = useState<'entry' | 'list'>('entry')

  // All Exams History List State
  const [allExams, setAllExams] = useState<(MockExam & { 
    students: { full_name: string; track: string } | null;
    totalNet: number; 
    sectionsList: MockExamSection[] 
  })[]>([])
  const [listSearch, setListSearch] = useState('')
  const [listTypeFilter, setListTypeFilter] = useState<'ALL' | 'TYT' | 'AYT'>('ALL')

  // Find selected student
  const currentStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId)
  }, [students, selectedStudentId])

  // Get active exam sections layout
  const activeSections = useMemo(() => {
    if (examType === 'TYT') {
      return SECTIONS_CONFIG.TYT
    }
    // AYT depends on student track
    const track = currentStudent?.track || 'SAY'
    return SECTIONS_CONFIG.AYT[track]
  }, [examType, currentStudent])

  // Load students list
  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.from('students').select('*').order('full_name', { ascending: true })
      .then(({ data }) => {
        if (data) {
          setStudents(data)
          if (!selectedStudentId && data.length > 0) {
            setSelectedStudentId(data[0].id)
            setSearchParams({ studentId: data[0].id })
          }
        }
      })
  }, [])

  // Sync selectedStudentId with query params
  const handleStudentChange = (id: string) => {
    setSelectedStudentId(id)
    setSearchParams({ studentId: id })
  }

  // Load exams for the selected student
  const loadExams = async () => {
    if (!selectedStudentId || !isSupabaseConfigured) return
    setLoading(true)
    setError(null)
    
    try {
      const { data: rawExams, error: examsError } = await supabase
        .from('mock_exams')
        .select('*')
        .eq('student_id', selectedStudentId)
        .order('exam_date', { ascending: false })
      if (examsError) throw examsError

      if (rawExams && rawExams.length > 0) {
        const examIds = rawExams.map(e => e.id)
        const { data: rawSections, error: sectionsError } = await supabase
          .from('mock_exam_sections')
          .select('*')
          .in('mock_exam_id', examIds)
        if (sectionsError) throw sectionsError

        const enrichedExams = rawExams.map(exam => {
          const secs = rawSections?.filter(s => s.mock_exam_id === exam.id) || []
          const totalNet = Math.round(secs.reduce((sum, s) => sum + Number(s.net), 0) * 100) / 100
          return { ...exam, totalNet, sectionsList: secs }
        })
        setExams(enrichedExams)
      } else {
        setExams([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sınav verileri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  // Load all exams list across all students
  const loadAllExamsList = async () => {
    if (!isSupabaseConfigured) return
    setLoading(true)
    setError(null)
    
    try {
      const { data: rawAllExams, error: examsError } = await (supabase
        .from('mock_exams')
        .select('*, students(full_name, track)')
        .order('exam_date', { ascending: false }) as any)
      if (examsError) throw examsError

      if (rawAllExams && rawAllExams.length > 0) {
        const examIds = rawAllExams.map((e: any) => e.id)
        const { data: rawSections, error: sectionsError } = await supabase
          .from('mock_exam_sections')
          .select('*')
          .in('mock_exam_id', examIds)
        if (sectionsError) throw sectionsError

        const enrichedAllExams = rawAllExams.map((exam: any) => {
          const secs = rawSections?.filter(s => s.mock_exam_id === exam.id) || []
          const totalNet = Math.round(secs.reduce((sum, s) => sum + Number(s.net), 0) * 100) / 100
          return { ...exam, totalNet, sectionsList: secs, students: exam.students as any }
        })
        setAllExams(enrichedAllExams)
      } else {
        setAllExams([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tüm sınav verileri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  // Load either student-specific exams or all exams
  useEffect(() => {
    if (!isSupabaseConfigured) return
    if (activeViewTab === 'entry') {
      loadExams()
    } else {
      loadAllExamsList()
    }
  }, [selectedStudentId, activeViewTab])

  // Fetch count of all exams on load
  useEffect(() => {
    if (!isSupabaseConfigured) return
    loadAllExamsList()
  }, [])

  // Initialize scores state when active sections change
  useEffect(() => {
    const newScores: Record<string, { correct: number; wrong: number }> = {}
    activeSections.forEach(sec => {
      newScores[sec.name] = { correct: 0, wrong: 0 }
    })
    setScores(newScores)
  }, [activeSections])

  const handleScoreChange = (secName: string, field: 'correct' | 'wrong', val: number) => {
    setScores(prev => ({
      ...prev,
      [secName]: {
        ...prev[secName],
        [field]: val
      }
    }))
  }

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudentId) return alert('Lütfen bir öğrenci seçin.')
    if (!examName) return alert('Lütfen deneme adını girin.')

    setSubmitting(true)
    setError(null)

    try {
      // 1. Insert exam
      const { data: examData, error: examError } = await supabase
        .from('mock_exams')
        .insert({
          student_id: selectedStudentId,
          name: examName,
          publisher: publisher || null,
          exam_type: examType,
          exam_date: examDate
        })
        .select('id')
        .single()
      
      if (examError) throw examError

      // 2. Insert sections
      const sectionsToInsert = activeSections.map(sec => {
        const score = scores[sec.name] || { correct: 0, wrong: 0 }
        const blank = sec.max - (score.correct + score.wrong)
        return {
          mock_exam_id: examData.id,
          section_name: sec.name,
          max_questions: sec.max,
          correct_count: score.correct,
          wrong_count: score.wrong,
          blank_count: Math.max(0, blank),
          net: 0
        }
      })

      const { error: secError } = await supabase
        .from('mock_exam_sections')
        .insert(sectionsToInsert)
      if (secError) throw secError

      // Reset form
      setExamName('')
      setPublisher('')
      loadExams()
      loadAllExamsList()
      alert('Deneme başarıyla kaydedildi!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deneme kaydedilirken hata oluştu')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Exam Delete
  const handleDeleteExam = async (examId: string) => {
    if (!window.confirm('Bu deneme sonucunu silmek istediğinize emin misiniz?')) return
    
    try {
      const { error } = await supabase.from('mock_exams').delete().eq('id', examId)
      if (error) throw error
      loadExams()
      loadAllExamsList()
    } catch (err) {
      alert('Deneme silinirken hata oluştu.')
    }
  }

  const filteredAllExams = useMemo(() => {
    return allExams.filter(e => {
      const studentName = e.students?.full_name || '';
      const matchesSearch = studentName.toLowerCase().includes(listSearch.toLowerCase()) || e.name.toLowerCase().includes(listSearch.toLowerCase());
      const matchesType = listTypeFilter === 'ALL' ? true : e.exam_type === listTypeFilter;
      return matchesSearch && matchesType;
    })
  }, [allExams, listSearch, listTypeFilter])

  return (
    <section className="screen">
      <PageHeader title="Deneme Girişi" subtitle="Yeni bir deneme sonucu girin, netler sistem tarafından otomatik hesaplansın." />

      {/* Tab Selectors */}
      <div style={{ display: 'flex', gap: 20, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setActiveViewTab('entry')}
          style={{
            padding: '10px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeViewTab === 'entry' ? '2px solid var(--indigo-600)' : '2px solid transparent',
            color: activeViewTab === 'entry' ? 'var(--indigo-600)' : 'var(--ink-soft)',
            fontWeight: activeViewTab === 'entry' ? 700 : 500,
            fontSize: 13.5,
            cursor: 'pointer'
          }}
        >
          Deneme Sonucu Gir
        </button>
        <button
          type="button"
          onClick={() => setActiveViewTab('list')}
          style={{
            padding: '10px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeViewTab === 'list' ? '2px solid var(--indigo-600)' : '2px solid transparent',
            color: activeViewTab === 'list' ? 'var(--indigo-600)' : 'var(--ink-soft)',
            fontWeight: activeViewTab === 'list' ? 700 : 500,
            fontSize: 13.5,
            cursor: 'pointer'
          }}
        >
          Tüm Deneme Geçmişi ({allExams.length})
        </button>
      </div>

      {!isSupabaseConfigured && (
        <div className="card" style={{ padding: 16, marginBottom: 20, background: 'var(--warning-bg)', border: 'none', color: 'var(--warning-text)' }}>
          Supabase bağlı değil — Lütfen Supabase yapılandırmasını tamamlayın.
        </div>
      )}

      {isSupabaseConfigured && activeViewTab === 'entry' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 24, alignItems: 'start' }}>
          
          {/* LEFT COLUMN: Entry Form */}
          <div className="card" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 15, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 7 }}>
              <ClipboardList size={18} color="var(--indigo-600)" />
              Yeni Deneme Sonucu Ekle
            </h3>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Student Selector */}
              <div className="field">
                <label>Öğrenci Seçin</label>
                <select value={selectedStudentId} onChange={(e) => handleStudentChange(e.target.value)}>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.track})</option>
                  ))}
                </select>
              </div>

              {/* Exam Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Sınav Adı</label>
                  <input type="text" placeholder="Örn: Türkiye Geneli - 1" value={examName} onChange={e => setExamName(e.target.value)} required />
                </div>
                <div className="field">
                  <label>Yayıncı / Kurum</label>
                  <input type="text" placeholder="Örn: 3D Yayınları" value={publisher} onChange={e => setPublisher(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label>Sınav Türü</label>
                  <select value={examType} onChange={e => setExamType(e.target.value as any)}>
                    <option value="TYT">TYT</option>
                    <option value="AYT">AYT</option>
                  </select>
                </div>
                <div className="field">
                  <label>Sınav Tarihi</label>
                  <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} required />
                </div>
              </div>

              {/* Section Score Inputs */}
              <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
                <h4 style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 12 }}>Bölüm Skorları (Doğru / Yanlış)</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {activeSections.map(sec => {
                    const score = scores[sec.name] || { correct: 0, wrong: 0 }
                    return (
                      <div key={sec.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--surface-alt)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-soft)' }}>
                        <div style={{ minWidth: 100 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{sec.name}</span>
                          <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 1 }}>Maks: {sec.max} soru</div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input 
                            type="number" 
                            min="0" 
                            max={sec.max} 
                            placeholder="D"
                            value={score.correct || ''} 
                            onChange={e => handleScoreChange(sec.name, 'correct', parseInt(e.target.value) || 0)}
                            style={{ width: 60, padding: 6, textAlign: 'center', fontSize: 12.5 }}
                          />
                          <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>/</span>
                          <input 
                            type="number" 
                            min="0" 
                            max={sec.max - score.correct} 
                            placeholder="Y"
                            value={score.wrong || ''} 
                            onChange={e => handleScoreChange(sec.name, 'wrong', parseInt(e.target.value) || 0)}
                            style={{ width: 60, padding: 6, textAlign: 'center', fontSize: 12.5 }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {error && (
                <div style={{ display: 'flex', gap: 6, color: 'var(--critical)', fontSize: 12, alignItems: 'center' }}>
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={submitting}>
                <Save size={16} /> {submitting ? 'Kaydediliyor…' : 'Deneme Sonucunu Kaydet'}
              </button>
            </form>
          </div>

          {/* RIGHT COLUMN: History List */}
          <div className="card" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 15, marginBottom: 18 }}>
              {currentStudent ? `${currentStudent.full_name} Deneme Geçmişi` : 'Deneme Geçmişi'}
            </h3>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>Yükleniyor…</div>
            ) : exams.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>Kayıtlı deneme bulunamadı.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {exams.map(e => (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: '1px solid var(--border-soft)', borderRadius: 10, background: 'var(--surface-alt)' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{e.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 3 }}>
                        {e.exam_date} · {e.exam_type}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 4 }}>
                        {e.sectionsList.map(s => `${s.section_name}: ${s.correct_count}D ${s.wrong_count}Y (${s.net} net)`).join(' · ')}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--indigo-600)' }}>{e.totalNet}</div>
                        <div style={{ fontSize: 9.5, color: 'var(--ink-faint)' }}>toplam net</div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleDeleteExam(e.id)} 
                        style={{ border: 'none', background: 'none', padding: 4, color: 'var(--critical)', cursor: 'pointer' }}
                        title="Denemeyi sil"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {isSupabaseConfigured && activeViewTab === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Filter Tools */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', width: '100%', maxWidth: 320, color: 'var(--ink-faint)' }}>
              <Search size={14} />
              <input
                type="text"
                placeholder="Öğrenci veya sınav ara…"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', background: 'none', flex: 1, color: 'var(--ink)', fontSize: 13.5 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={listTypeFilter}
                onChange={(e) => setListTypeFilter(e.target.value as any)}
                style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, background: 'var(--surface)' }}
              >
                <option value="ALL">Tüm Sınav Türleri</option>
                <option value="TYT">TYT</option>
                <option value="AYT">AYT</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>Yükleniyor…</div>
          ) : filteredAllExams.length === 0 ? (
            <div className="card empty-state" style={{ padding: 40, textAlign: 'center' }}>
              <h3>Deneme Girişi Bulunamadı</h3>
              <p>Arama veya filtre kriterlerinize uygun deneme sınavı kaydı bulunmuyor.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 20, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--ink-soft)' }}>
                    <th style={{ padding: '12px 14px' }}>Öğrenci</th>
                    <th style={{ padding: '12px 14px' }}>Sınav Adı</th>
                    <th style={{ padding: '12px 14px' }}>Yayıncı</th>
                    <th style={{ padding: '12px 14px' }}>Tarih</th>
                    <th style={{ padding: '12px 14px' }}>Tür</th>
                    <th style={{ padding: '12px 14px' }}>Bölüm Netleri</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Toplam Net</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center' }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAllExams.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                        {e.students ? (
                          <Link to={`/ogrenciler/${e.student_id}`} style={{ textDecoration: 'none', color: 'var(--indigo-600)' }}>
                            {e.students.full_name}
                          </Link>
                        ) : (
                          'Bilinmeyen Öğrenci'
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{e.name}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--ink-soft)' }}>{e.publisher || '—'}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--ink-soft)' }}>{e.exam_date}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span className={`chip ${e.exam_type === 'TYT' ? 'chip-say' : 'chip-ea'}`} style={{ padding: '1px 6px', fontSize: 10.5 }}>
                          {e.exam_type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--ink-soft)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.sectionsList.map(s => `${s.section_name}: ${s.correct_count}D ${s.wrong_count}Y (${s.net} net)`).join(' · ')}>
                        {e.sectionsList.map(s => `${s.section_name}: ${s.net}`).join(' · ')}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--indigo-600)', fontSize: 14 }}>
                        {e.totalNet}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteExam(e.id)}
                          style={{ border: 'none', background: 'none', padding: 4, color: 'var(--critical)', cursor: 'pointer' }}
                          title="Denemeyi sil"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
