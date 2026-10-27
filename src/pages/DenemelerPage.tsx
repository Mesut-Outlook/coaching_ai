import { useEffect, useState, useMemo, Fragment } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Trash2, Search, ChevronDown, ChevronRight, Edit3 } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { fetchStudents } from '../lib/students'
import { useAccess } from '../contexts/AccessContext'
import PageHeader from '../components/layout/PageHeader'
import ExamSectionsTable from '../components/exams/ExamSectionsTable'
import ExamShareButtons from '../components/exams/ExamShareButtons'
import ExamReportForm from '../components/exams/ExamReportForm'
import CoachExamsOverviewTab from '../components/exams/CoachExamsOverviewTab'
import type { Student, MockExam, MockExamSection } from '../types/database'
import { formatNetTr } from '../lib/homeSummaryCore'

function chunkArray<T>(items: readonly T[], chunkSize = 200): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

export default function DenemelerPage() {
  const { studentScope } = useAccess()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialStudentId = searchParams.get('studentId') || ''

  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId)
  const [exams, setExams] = useState<(MockExam & { totalNet: number; sectionsList: MockExamSection[] })[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Düzenleme durumu
  const [editingExamId, setEditingExamId] = useState<string | null>(null)

  // Tab View State
  const [activeViewTab, setActiveViewTab] = useState<'entry' | 'results' | 'list'>('entry')

  // Tıklanan denemenin bölüm tablosu açılır (her iki sekmede de ayrı ayrı)
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null)
  const toggleExam = (id: string) => setExpandedExamId((prev) => (prev === id ? null : id))

  // All Exams History List State
  const [allExams, setAllExams] = useState<
    (MockExam & {
      students: { full_name: string; track: string; phone_number: string | null; parent_phone_number: string | null } | null
      totalNet: number
      sectionsList: MockExamSection[]
      hasTopics?: boolean
      topicResultsCount?: number
    })[]
  >([])
  const [listSearch, setListSearch] = useState('')
  const [listTypeFilter, setListTypeFilter] = useState<'ALL' | 'TYT' | 'AYT' | 'LGS'>('ALL')

  // Find selected student
  const currentStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId)
  }, [students, selectedStudentId])

  // Load students list
  useEffect(() => {
    if (!isSupabaseConfigured) return
    fetchStudents({ activeOnly: true, orderBy: 'full_name', ...studentScope }).then((data) => {
      if (data) {
        setStudents(data)
        if (!selectedStudentId && data.length > 0) {
          setSelectedStudentId(data[0].id)
          setSearchParams({ studentId: data[0].id })
        }
      }
    })
  }, [studentScope, selectedStudentId, setSearchParams])

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
        const examIds = rawExams.map((e) => e.id)
        const examIdChunks = chunkArray(examIds, 200)

        let rawSections: MockExamSection[] = []
        for (const chunk of examIdChunks) {
          let from = 0
          const pageSize = 1000
          while (true) {
            const { data: sectionBatch, error: sectionsError } = await supabase
              .from('mock_exam_sections')
              .select('*')
              .in('mock_exam_id', chunk)
              .order('id')
              .range(from, from + pageSize - 1)
            if (sectionsError) throw sectionsError
            if (!sectionBatch || sectionBatch.length === 0) break
            rawSections = rawSections.concat(sectionBatch)
            if (sectionBatch.length < pageSize) break
            from += pageSize
          }
        }

        const enrichedExams = rawExams.map((exam) => {
          const secs = rawSections.filter((s) => s.mock_exam_id === exam.id)
          const totalNet = Math.round(secs.reduce((sum, s) => sum + Number(s.net), 0) * 100) / 100
          return { ...exam, totalNet, sectionsList: secs }
        })
        setExams(enrichedExams)
      } else {
        setExams([])
      }
    } catch (err) {
      console.error('Sınav yükleme hatası:', err)
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
        .select('*, students(full_name, track, phone_number, parent_phone_number)')
        .order('exam_date', { ascending: false })
        .order('id') as any)
      if (examsError) throw examsError

      if (rawAllExams && rawAllExams.length > 0) {
        const examIds: string[] = rawAllExams.map((e: any) => String(e.id))
        const examIdChunks = chunkArray(examIds, 200)

        // Bölüm sonuçlarını çek (1000 satır sınırı + 200 chunk ile)
        let rawSections: MockExamSection[] = []
        for (const chunk of examIdChunks) {
          let from = 0
          const pageSize = 1000
          while (true) {
            const { data: sectionBatch, error: sectionsError } = await supabase
              .from('mock_exam_sections')
              .select('*')
              .in('mock_exam_id', chunk)
              .order('id')
              .range(from, from + pageSize - 1)
            if (sectionsError) throw sectionsError
            if (!sectionBatch || sectionBatch.length === 0) break
            rawSections = rawSections.concat(sectionBatch)
            if (sectionBatch.length < pageSize) break
            from += pageSize
          }
        }

        // Konu sonuçlarını çek (1000 satır sınırı + 200 chunk ile)
        let rawTopics: { mock_exam_id: string }[] = []
        for (const chunk of examIdChunks) {
          let from = 0
          const pageSize = 1000
          while (true) {
            const { data: topicBatch, error: topicsError } = await supabase
              .from('mock_exam_topic_results')
              .select('mock_exam_id')
              .in('mock_exam_id', chunk)
              .order('id')
              .range(from, from + pageSize - 1)
            if (topicsError) throw topicsError
            if (!topicBatch || topicBatch.length === 0) break
            rawTopics = rawTopics.concat(topicBatch)
            if (topicBatch.length < pageSize) break
            from += pageSize
          }
        }

        const topicCountsByExam: Record<string, number> = {}
        for (const t of rawTopics) {
          topicCountsByExam[t.mock_exam_id] = (topicCountsByExam[t.mock_exam_id] || 0) + 1
        }

        const enrichedAllExams = rawAllExams.map((exam: any) => {
          const secs = rawSections?.filter((s) => s.mock_exam_id === exam.id) || []
          const totalNet = Math.round(secs.reduce((sum, s) => sum + Number(s.net), 0) * 100) / 100
          const topicResultsCount = topicCountsByExam[exam.id] || 0
          return {
            ...exam,
            totalNet,
            sectionsList: secs,
            students: exam.students as any,
            hasTopics: topicResultsCount > 0,
            topicResultsCount,
          }
        })
        setAllExams(enrichedAllExams)
      } else {
        setAllExams([])
      }
    } catch (err) {
      console.error('Tüm sınavlar yükleme hatası:', err)
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

  // Handle Exam Delete
  const handleDeleteExam = async (examId: string) => {
    if (!window.confirm('Bu deneme sonucunu silmek istediğinize emin misiniz?')) return

    try {
      const { error: delError } = await supabase.from('mock_exams').delete().eq('id', examId)
      if (delError) throw delError
      if (editingExamId === examId) setEditingExamId(null)
      loadExams()
      loadAllExamsList()
    } catch (err) {
      console.error('Deneme silme hatası:', err)
      alert('Deneme silinirken hata oluştu.')
    }
  }

  // Düzenleme Başlatma (Her iki listeden de çağrılabilir)
  const handleStartEditExam = (examId: string, studentId: string) => {
    setSelectedStudentId(studentId)
    setSearchParams({ studentId })
    setEditingExamId(examId)
    setActiveViewTab('entry')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setEditingExamId(null)
  }

  const handleSaveSuccess = () => {
    setEditingExamId(null)
    loadExams()
    loadAllExamsList()
  }

  const filteredAllExams = useMemo(() => {
    return allExams.filter((e) => {
      const studentName = e.students?.full_name || ''
      const matchesSearch =
        studentName.toLowerCase().includes(listSearch.toLowerCase()) ||
        e.name.toLowerCase().includes(listSearch.toLowerCase())
      const matchesType = listTypeFilter === 'ALL' ? true : e.exam_type === listTypeFilter
      return matchesSearch && matchesType
    })
  }, [allExams, listSearch, listTypeFilter])

  return (
    <section className="screen">
      <PageHeader
        title="Deneme Girişi"
        subtitle="Öğrencinin karne düzeninde deneme, alt ders ve konu sonuçlarını girin; analiz motoru anında hesaplasın."
      />

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
            cursor: 'pointer',
          }}
        >
          {editingExamId ? 'Deneme Düzenle (Karne)' : 'Deneme Sonucu Gir (Karne)'}
        </button>
        <button
          type="button"
          onClick={() => setActiveViewTab('results')}
          style={{
            padding: '10px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeViewTab === 'results' ? '2px solid var(--indigo-600)' : '2px solid transparent',
            color: activeViewTab === 'results' ? 'var(--indigo-600)' : 'var(--ink-soft)',
            fontWeight: activeViewTab === 'results' ? 700 : 500,
            fontSize: 13.5,
            cursor: 'pointer',
          }}
        >
          Sonuçlar & Koç Özeti
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
            cursor: 'pointer',
          }}
        >
          Tüm Deneme Geçmişi ({allExams.length})
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!isSupabaseConfigured && (
        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 20,
            background: 'var(--warning-bg)',
            border: 'none',
            color: 'var(--warning-text)',
          }}
        >
          Supabase bağlı değil — Lütfen Supabase yapılandırmasını tamamlayın.
        </div>
      )}

      {isSupabaseConfigured && activeViewTab === 'entry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* KARNE GİRİŞ FORMU */}
          <ExamReportForm
            students={students}
            selectedStudentId={selectedStudentId}
            onStudentChange={handleStudentChange}
            editingExamId={editingExamId}
            onCancelEdit={handleCancelEdit}
            onSaveSuccess={handleSaveSuccess}
          />

          {/* SEÇİLİ ÖĞRENCİNİN DENEME GEÇMİŞİ LİSTESİ */}
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, margin: 0 }}>
                {currentStudent ? `${currentStudent.full_name} Deneme Geçmişi (${exams.length})` : 'Deneme Geçmişi'}
              </h3>
              <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                Düzenlemek ve konularını girmek için kaleme tıklayın
              </span>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>Yükleniyor…</div>
            ) : exams.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>
                Bu öğrenciye ait kayıtlı deneme bulunamadı.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {exams.map((e) => {
                  const isOpen = expandedExamId === e.id
                  const isBeingEdited = editingExamId === e.id

                  return (
                    <div
                      key={e.id}
                      style={{
                        border: isBeingEdited ? '2px solid var(--indigo-600)' : '1px solid var(--border-soft)',
                        borderRadius: 10,
                        background: 'var(--surface-alt)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleExam(e.id)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault()
                            toggleExam(e.id)
                          }
                        }}
                        title={isOpen ? 'Bölüm tablosunu kapat' : 'Bölüm tablosunu aç'}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 14px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: 'var(--ink-faint)', display: 'flex' }}>
                            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {e.name}
                              {isBeingEdited && (
                                <span className="badge badge-primary" style={{ fontSize: 10 }}>
                                  Düzenleniyor
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 3 }}>
                              {e.exam_date} · {e.exam_type} {e.publisher ? `· ${e.publisher}` : ''}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 4 }}>
                              {e.sectionsList.map((s) => `${s.section_name}: ${formatNetTr(Number(s.net))}`).join(' · ')}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--indigo-600)' }}>{formatNetTr(e.totalNet)}</div>
                            <div style={{ fontSize: 9.5, color: 'var(--ink-faint)' }}>toplam net</div>
                          </div>

                          {/* Düzenle / Konuları gir */}
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              handleStartEditExam(e.id, e.student_id)
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              borderRadius: 6,
                              padding: '5px 8px',
                              color: 'var(--indigo-600)',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                            title="Düzenle / Konuları gir"
                          >
                            <Edit3 size={13} /> Düzenle
                          </button>

                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              handleDeleteExam(e.id)
                            }}
                            style={{
                              border: 'none',
                              background: 'none',
                              padding: 4,
                              color: 'var(--critical)',
                              cursor: 'pointer',
                            }}
                            title="Denemeyi sil"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {isOpen && (
                        <div style={{ padding: '0 12px 12px' }}>
                          <ExamSectionsTable sections={e.sectionsList} />
                          {currentStudent && (
                            <ExamShareButtons
                              exam={e}
                              sections={e.sectionsList}
                              studentName={currentStudent.full_name}
                              phone={currentStudent.phone_number}
                              parentPhone={currentStudent.parent_phone_number}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {isSupabaseConfigured && activeViewTab === 'results' && (
        <CoachExamsOverviewTab students={students} allExams={allExams} />
      )}

      {isSupabaseConfigured && activeViewTab === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Filter Tools */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '8px 12px',
                width: '100%',
                maxWidth: 320,
                color: 'var(--ink-faint)',
              }}
            >
              <Search size={14} />
              <input
                type="text"
                placeholder="Öğrenci veya sınav ara…"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'none',
                  flex: 1,
                  color: 'var(--ink)',
                  fontSize: 13.5,
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={listTypeFilter}
                onChange={(e) => setListTypeFilter(e.target.value as any)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  fontSize: 13,
                  background: 'var(--surface)',
                }}
              >
                <option value="ALL">Tüm Sınav Türleri</option>
                <option value="TYT">TYT</option>
                <option value="AYT">AYT</option>
                <option value="LGS">LGS</option>
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
                    <th style={{ padding: '12px 4px', width: 26 }} aria-label="Detay" />
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
                  {filteredAllExams.map((e) => {
                    const isOpen = expandedExamId === e.id
                    return (
                      <Fragment key={e.id}>
                        <tr
                          onClick={() => toggleExam(e.id)}
                          title={isOpen ? 'Bölüm tablosunu kapat' : 'Bölüm tablosunu aç'}
                          style={{
                            borderBottom: isOpen ? 'none' : '1px solid var(--border-soft)',
                            cursor: 'pointer',
                          }}
                        >
                          <td style={{ padding: '12px 4px', color: 'var(--ink-faint)' }}>
                            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                            {e.students ? (
                              <Link
                                to={`/ogrenciler/${e.student_id}`}
                                onClick={(ev) => ev.stopPropagation()}
                                style={{ textDecoration: 'none', color: 'var(--indigo-600)' }}
                              >
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
                            <span
                              className={`chip ${
                                e.exam_type === 'TYT'
                                  ? 'chip-say'
                                  : e.exam_type === 'AYT'
                                  ? 'chip-ea'
                                  : 'chip-soz'
                              }`}
                              style={{ padding: '1px 6px', fontSize: 10.5 }}
                            >
                              {e.exam_type}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: '12px 14px',
                              color: 'var(--ink-soft)',
                              maxWidth: 280,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={e.sectionsList
                              .map((s) => `${s.section_name}: ${s.correct_count}D ${s.wrong_count}Y (${formatNetTr(Number(s.net))} net)`)
                              .join(' · ')}
                          >
                            {e.sectionsList.map((s) => `${s.section_name}: ${formatNetTr(Number(s.net))}`).join(' · ')}
                          </td>
                          <td
                            style={{
                              padding: '12px 14px',
                              textAlign: 'right',
                              fontWeight: 700,
                              color: 'var(--indigo-600)',
                              fontSize: 14,
                            }}
                          >
                            {formatNetTr(e.totalNet)}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  handleStartEditExam(e.id, e.student_id)
                                }}
                                style={{
                                  border: '1px solid var(--border)',
                                  background: 'var(--surface)',
                                  borderRadius: 6,
                                  padding: '4px 6px',
                                  color: 'var(--indigo-600)',
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                                title="Düzenle / Konuları gir"
                              >
                                <Edit3 size={13} /> Düzenle
                              </button>
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  handleDeleteExam(e.id)
                                }}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  padding: 4,
                                  color: 'var(--critical)',
                                  cursor: 'pointer',
                                }}
                                title="Denemeyi sil"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                            <td colSpan={9} style={{ padding: '0 14px 14px 34px', background: 'var(--surface-alt)' }}>
                              <div style={{ maxWidth: 760 }}>
                                <ExamSectionsTable sections={e.sectionsList} />
                                {e.students && (
                                  <ExamShareButtons
                                    exam={e}
                                    sections={e.sectionsList}
                                    studentName={e.students.full_name}
                                    phone={e.students.phone_number}
                                    parentPhone={e.students.parent_phone_number}
                                  />
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
