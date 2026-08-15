import { useEffect, useState, useMemo, Fragment } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
  ArrowLeft, ChevronRight, ChevronDown, Plus, Search, TrendingUp, Award,
  CheckSquare, MoreVertical, MessageCircle, Smartphone,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import PageHeader from '../components/layout/PageHeader'
import ProgressRing from '../components/charts/ProgressRing'
import AddStudentModal from '../components/students/AddStudentModal'
import ExamSectionsTable from '../components/exams/ExamSectionsTable'
import ExamShareButtons from '../components/exams/ExamShareButtons'
import { formatPhoneForWhatsApp, openWhatsAppChat } from '../lib/whatsapp'
import { ensureStudentAccessCodes } from '../lib/accessCode'
import { fetchStudents } from '../lib/students'
import { useAccess } from '../contexts/AccessContext'
import { useAuth } from '../contexts/AuthContext'
import CoachingLockedState from '../components/common/CoachingLockedState'
import type { Student, MockExam, MockExamSection, WeeklyTask, CoachDecision, Topic, Subject } from '../types/database'

type ActiveTab = 'overview' | 'exams' | 'subjects' | 'tasks'

/**
 * Mobil portal erişim linkini WhatsApp ile gönderir (öğrenciye ya da veliye).
 * Kodlar yoksa üretilip kaydedilir; numara yoksa link kopyalanabilsin diye gösterilir.
 */
async function sendPortalLink(student: Student, target: 'ogrenci' | 'veli') {
  const codes = await ensureStudentAccessCodes(student)
  if (codes.error) {
    alert(codes.error)
    return
  }

  const code = target === 'ogrenci' ? codes.student_access_code : codes.parent_access_code
  const phone = target === 'ogrenci' ? student.phone_number : student.parent_phone_number
  const link = `${window.location.origin}/portal?code=${code}`

  const msg =
    target === 'ogrenci'
      ? `Merhaba ${student.full_name}, Netlik mobil öğrenci portalına buradan girebilirsin:\n${link}\n\nErişim kodun: ${code}\nBu kodu kimseyle paylaşma.`
      : `Merhaba, ${student.full_name} için Netlik veli bilgilendirme portalı:\n${link}\n\nErişim kodunuz: ${code}\nBu kodu kimseyle paylaşmayın.`

  if (phone) {
    openWhatsAppChat(phone, msg)
  } else {
    alert(
      `${target === 'ogrenci' ? 'Öğrenci' : 'Veli'} telefonu kayıtlı değil.\n\n` +
        `Linki elle iletebilirsin:\n${link}\n\nErişim kodu: ${code}`
    )
  }
}

interface StudentData {
  student: Student
  exams: MockExam[]
  sections: MockExamSection[]
  tasks: WeeklyTask[]
  decisions: CoachDecision[]
  topics: (Topic & { subjects: Subject | null })[]
  attendanceCount: number
  attendanceUnexcusedCount: number
}

const subjectConfig: Record<string, { color: string; soru_sayisi: string }> = {
  'Türkçe': { color: '#4f46e5', soru_sayisi: '40' },
  'Matematik': { color: '#7c3aed', soru_sayisi: '30' },
  'Geometri': { color: '#9333ea', soru_sayisi: '10' },
  'Fizik': { color: '#2563eb', soru_sayisi: '7' },
  'Kimya': { color: '#0d9488', soru_sayisi: '7' },
  'Biyoloji': { color: '#16a34a', soru_sayisi: '6' },
  'Tarih': { color: '#d97706', soru_sayisi: '5' },
  'Coğrafya': { color: '#059669', soru_sayisi: '5' },
  'Felsefe': { color: '#0891b2', soru_sayisi: '5' },
  'Din Kültürü': { color: '#e11d48', soru_sayisi: '5' },
}

export default function OgrencilerPage() {
  const { studentId } = useParams()

  // State for all-students list view
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [menuOpenStudentId, setMenuOpenStudentId] = useState<string | null>(null)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  
  // State for single-student detail view
  const [studentData, setStudentData] = useState<StudentData | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')
  // Deneme Geçmişi sekmesinde tıklanan denemenin bölüm tablosu açılır
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { isSystemAdmin, studentScope } = useAccess()
  const { user } = useAuth()

  const isCoachingLocked = !isSystemAdmin && Boolean(studentData?.student?.coaching_coach_id) && studentData?.student?.coaching_coach_id !== user?.id

  // Load all students (if no studentId)
  useEffect(() => {
    if (studentId) return
    if (!isSupabaseConfigured) {
      setStudents([])
      setLoading(false)
      return
    }
    
    setLoading(true)
    const loadList = async () => {
      try {
        const data = await fetchStudents({
          activeOnly: !showArchived,
          orderBy: 'created_at',
          ...studentScope
        })
        setStudents(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Öğrenciler yüklenemedi')
      } finally {
        setLoading(false)
      }
    }
    loadList()
  }, [studentId, showArchived, studentScope])

  // Load specific student data
  useEffect(() => {
    if (!studentId) {
      setStudentData(null)
      return
    }
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    
    const loadData = async () => {
      // 1. Fetch student
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single()
      if (studentError) throw studentError
      if (!student) throw new Error('Öğrenci bulunamadı.')

      // 2. Fetch mock exams
      const { data: exams, error: examsError } = await supabase
        .from('mock_exams')
        .select('*')
        .eq('student_id', studentId)
        .order('exam_date', { ascending: false })
      if (examsError) throw examsError

      // 3. Fetch sections
      let sections: MockExamSection[] = []
      if (exams && exams.length > 0) {
        const { data: secData, error: secError } = await supabase
          .from('mock_exam_sections')
          .select('*')
          .in('mock_exam_id', exams.map(e => e.id))
        if (secError) throw secError
        sections = secData || []
      }

      // 4. Fetch tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('weekly_tasks')
        .select('*')
        .eq('student_id', studentId)
        .order('week_start', { ascending: false })
        .order('day_index', { ascending: true })
      if (tasksError) throw tasksError

      // 5. Fetch decisions
      const { data: decisions, error: decError } = await supabase
        .from('coach_decisions')
        .select('*')
        .eq('student_id', studentId)
      if (decError) throw decError

      // 6. Fetch topics
      const { data: topics, error: topicsError } = await supabase
        .from('topics')
        .select('*, subjects(*)')
      if (topicsError) throw topicsError

      // 7. Devamsızlık sayıları (tablo henüz oluşturulmadıysa sayfayı çökertme — sessizce 0 say)
      let attendanceCount = 0
      let attendanceUnexcusedCount = 0
      try {
        const { data: attendance, error: attendanceError } = await supabase
          .from('attendance_records')
          .select('id, excuse_type')
          .eq('student_id', studentId)
        if (attendanceError) throw attendanceError
        attendanceCount = attendance?.length ?? 0
        attendanceUnexcusedCount = attendance?.filter((a) => a.excuse_type === 'yok').length ?? 0
      } catch {
        attendanceCount = 0
        attendanceUnexcusedCount = 0
      }

      setStudentData({
        student,
        exams: exams || [],
        sections,
        tasks: tasks || [],
        decisions: decisions || [],
        topics: (topics as any) || [],
        attendanceCount,
        attendanceUnexcusedCount,
      })
    }

    loadData()
      .catch(err => setError(err instanceof Error ? err.message : 'Öğrenci verileri yüklenemedi'))
      .finally(() => setLoading(false))
  }, [studentId])

  const handleToggleActive = async (student: Student) => {
    try {
      const { error } = await supabase
        .from('students')
        .update({ is_active: !student.is_active })
        .eq('id', student.id)
      
      if (error) throw error

      setStudents(prev => prev.map(s => s.id === student.id ? { ...s, is_active: !s.is_active } : s))
      // Update studentData if currently viewing
      if (studentData && studentData.student.id === student.id) {
        setStudentData({
          ...studentData,
          student: { ...studentData.student, is_active: !student.is_active }
        })
      }
    } catch (err) {
      alert('Öğrenci durumu güncellenemedi.')
    }
  }

  const handleDeleteStudent = async (studentId: string) => {
    if (!window.confirm('Bu öğrenciyi kalıcı olarak silmek istediğinize emin misiniz? Bu işlem öğrenciye bağlı tüm deneme, görev ve istatistik verilerini geri alınamayacak şekilde silecektir!')) {
      return
    }

    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId)

      if (error) throw error

      setStudents(prev => prev.filter(s => s.id !== studentId))
    } catch (err) {
      alert('Öğrenci silinirken hata oluştu.')
    }
  }

  // Filter students (list view)
  const filteredStudents = useMemo(() => {
    if (!students) return []
    return students.filter(s => {
      const matchesSearch = s.full_name.toLowerCase().includes(search.toLowerCase())
      const matchesActive = showArchived ? true : s.is_active
      return matchesSearch && matchesActive
    })
  }, [students, search, showArchived])

  // Calculated stats (detail view)
  const stats = useMemo(() => {
    if (!studentData) return null
    const { exams, sections, tasks, decisions } = studentData
    
    // Group exams with their nets
    const examNets = exams.map(exam => {
      const examSecs = sections.filter(s => s.mock_exam_id === exam.id)
      const totalNet = Math.round(examSecs.reduce((sum, s) => sum + Number(s.net), 0) * 10) / 10
      return { exam, totalNet }
    })

    const tytExams = examNets.filter(e => e.exam.exam_type === 'TYT').slice(0, 5).reverse()
    const aytExams = examNets.filter(e => e.exam.exam_type === 'AYT').slice(0, 5).reverse()

    const averageTytNet = tytExams.length 
      ? Math.round((tytExams.reduce((sum, e) => sum + e.totalNet, 0) / tytExams.length) * 10) / 10 
      : 0
    const averageAytNet = aytExams.length 
      ? Math.round((aytExams.reduce((sum, e) => sum + e.totalNet, 0) / aytExams.length) * 10) / 10 
      : 0

    const taskCompletion = tasks.length
      ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100)
      : 0

    const criticalTopics = decisions.filter(d => d.state === 'kritik')

    return {
      examNets,
      tytExams,
      aytExams,
      averageTytNet,
      averageAytNet,
      taskCompletion,
      criticalCount: criticalTopics.length,
      criticalTopics
    }
  }, [studentData])

  // Save coach decision override
  const handleUpdateMastery = async (topicId: number, newState: 'yeterli' | 'gelisiyor' | 'kritik') => {
    if (!studentData || !studentId || !user) return
    
    try {
      const { data, error } = await supabase
        .from('coach_decisions')
        .upsert({
          student_id: studentId,
          topic_id: topicId,
          state: newState,
          note: null,
          decided_by: user.id,
          decided_at: new Date().toISOString()
        })
        .select()
        
      if (error) throw error
      
      // Update local state
      const updatedDecisions = [...studentData.decisions]
      const idx = updatedDecisions.findIndex(d => d.topic_id === topicId)
      if (idx > -1) {
        updatedDecisions[idx] = data[0]
      } else {
        updatedDecisions.push(data[0])
      }
      setStudentData({ ...studentData, decisions: updatedDecisions })
    } catch (err) {
      alert('Karar güncellenirken hata oluştu.')
    }
  }

  // Render Students List (when studentId is not specified)
  if (!studentId) {
    return (
      <section className="screen">
        <PageHeader 
          title="Öğrenciler" 
          subtitle="Öğrenci listesini gör, arama yap ve profillerini incele."
          actions={
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={14} /> Yeni Öğrenci
            </button>
          }
        />

        {showAddModal && (
          <AddStudentModal
            onClose={() => setShowAddModal(false)}
            onCreated={(student) => {
              setStudents((prev) => [...prev, student])
              setShowAddModal(false)
            }}
          />
        )}

        {editingStudent && (
          <AddStudentModal
            editingStudent={editingStudent}
            onClose={() => setEditingStudent(null)}
            onCreated={(updatedStudent) => {
              setStudents(prev => prev.map(st => st.id === updatedStudent.id ? updatedStudent : st))
              if (studentData && studentData.student.id === updatedStudent.id) {
                setStudentData({ ...studentData, student: updatedStudent })
              }
              setEditingStudent(null)
            }}
          />
        )}

        {!isSupabaseConfigured && (
          <div className="card" style={{ padding: 16, marginBottom: 20, background: 'var(--warning-bg)', border: 'none', color: 'var(--warning-text)', fontSize: 13 }}>
            Supabase bağlı değil — Lütfen Supabase kurulumunu tamamlayın.
          </div>
        )}

        {isSupabaseConfigured && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', width: '100%', maxWidth: 320, color: 'var(--ink-faint)' }}>
              <Search size={14} />
              <input
                type="text"
                placeholder="Öğrenci ara…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', background: 'none', flex: 1, color: 'var(--ink)', fontSize: 13.5 }}
              />
            </div>
            
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink-soft)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Arşivlenmiş öğrencileri de göster
            </label>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>Yükleniyor…</div>
        ) : filteredStudents.length === 0 ? (
          <div className="card empty-state">
            <h3>Öğrenci bulunamadı</h3>
            <p>Arama kriterinize uygun veya sistemde kayıtlı bir öğrenci bulunmamaktadır.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {filteredStudents.map(s => (
              <Link
                to={`/ogrenciler/${s.id}`}
                key={s.id}
                className="card"
                style={{
                  padding: 20,
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  opacity: s.is_active ? 1 : 0.6
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--measured-bg)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17, flexShrink: 0, border: '1px solid var(--border-soft)' }}>
                      {s.photo_url ? (
                        <img src={s.photo_url} alt={s.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        s.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3 style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                        {s.full_name}
                      </h3>
                      <p style={{ color: 'var(--ink-soft)', fontSize: 12, marginTop: 4, margin: 0 }}>
                        {s.grade} · {s.track} {!s.is_active && <strong style={{ color: 'var(--critical-text)' }}>(Arşivli)</strong>}
                      </p>
                    </div>
                  </div>

                  {/* Actions Dropdown */}
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: 4, minHeight: 'auto', background: 'none' }}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setMenuOpenStudentId(menuOpenStudentId === s.id ? null : s.id)
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>
                    {menuOpenStudentId === s.id && (
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 28,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          zIndex: 10,
                          display: 'flex',
                          flexDirection: 'column',
                          minWidth: 120,
                          overflow: 'hidden'
                        }}
                      >
                        <button
                          type="button"
                          style={{ padding: '8px 12px', fontSize: 12, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--ink)', width: '100%' }}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setEditingStudent(s)
                            setMenuOpenStudentId(null)
                          }}
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          style={{ padding: '8px 12px', fontSize: 12, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--ink)', width: '100%' }}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleToggleActive(s)
                            setMenuOpenStudentId(null)
                          }}
                        >
                          {s.is_active ? 'Arşivle' : 'Aktifleştir'}
                        </button>
                        <button
                          type="button"
                          style={{ padding: '8px 12px', fontSize: 12, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--critical-text)', width: '100%', borderTop: '1px solid var(--border-soft)' }}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDeleteStudent(s.id)
                            setMenuOpenStudentId(null)
                          }}
                        >
                          Kalıcı Sil
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {s.target_program && (
                  <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 10 }}>
                    <div style={{ fontSize: 9.5, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Hedef Program</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-soft)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.target_program}
                    </div>
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--indigo-600)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    Profili Aç <ChevronRight size={13} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    )
  }

  // Render Detailed Student Profile
  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--ink-soft)' }}>Profil yükleniyor…</div>
  }

  if (error || !studentData || !stats) {
    return (
      <section className="screen">
        <Link to="/ogrenciler" className="back-link"><ArrowLeft size={14} /> Öğrencilere Dön</Link>
        <div className="card" style={{ padding: 24, background: 'var(--critical-bg)', color: 'var(--critical-text)', border: 'none', marginTop: 20 }}>
          {error || 'Öğrenci yüklenemedi.'}
        </div>
      </section>
    )
  }

  const { student, exams, sections, tasks, decisions, topics } = studentData

  return (
    <section className="screen">
      <Link to="/ogrenciler" className="back-link"><ArrowLeft size={14} /> Öğrenciler Listesi</Link>
      
      {/* Student Profile Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'center', marginBottom: 26, marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--measured-bg)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 26, border: '2px solid var(--border-soft)', flexShrink: 0 }}>
            {student.photo_url ? (
              <img src={student.photo_url} alt={student.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              student.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <h1 style={{ fontSize: 24, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              {student.full_name}
              <span className={`chip ${student.track === 'SAY' ? 'chip-say' : student.track === 'EA' ? 'chip-ea' : 'chip-soz'}`} style={{ fontSize: 11, padding: '2px 8px' }}>
                {student.track}
              </span>
            </h1>
            <p style={{ color: 'var(--ink-soft)', fontSize: 13, marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: 0 }}>
              <span>{student.grade} öğrencisi</span>
              <span>•</span>
              <span>Hedef: {student.target_program || 'Girilmedi'} ({student.target_ranking || '—'})</span>
              {student.phone_number && (
                <>
                  <span>•</span>
                  <span style={{ color: 'var(--indigo-600)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Öğrenci Tlf: {student.phone_number}
                    <a
                      href={`https://api.whatsapp.com/send?phone=${formatPhoneForWhatsApp(student.phone_number)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', color: '#25D366' }}
                      title="WhatsApp Sohbeti Başlat"
                    >
                      <MessageCircle size={14} style={{ fill: '#25D366', color: '#25D366' }} />
                    </a>
                  </span>
                </>
              )}
              {student.parent_phone_number && (
                <>
                  <span>•</span>
                  <span style={{ color: 'var(--indigo-600)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Veli Tlf: {student.parent_phone_number}
                    <a
                      href={`https://api.whatsapp.com/send?phone=${formatPhoneForWhatsApp(student.parent_phone_number)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', color: '#25D366' }}
                      title="WhatsApp Sohbeti Başlat"
                    >
                      <MessageCircle size={14} style={{ fill: '#25D366', color: '#25D366' }} />
                    </a>
                  </span>
                </>
              )}
              {studentData.attendanceCount > 0 && (
                <>
                  <span>•</span>
                  <Link
                    to={`/devamsizlik?studentId=${studentId}`}
                    style={{ color: 'var(--warning-text)', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Devamsızlık: {studentData.attendanceCount} ({studentData.attendanceUnexcusedCount} mazeretsiz)
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
        
        {/* Navigation Actions to other parts */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => sendPortalLink(student, 'ogrenci')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Smartphone size={14} /> Öğrenci Linki
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => sendPortalLink(student, 'veli')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Smartphone size={14} /> Veli Linki
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setEditingStudent(student)}
          >
            Düzenle
          </button>
          <Link to={`/program?studentId=${studentId}`} className="btn btn-ghost btn-sm">
            Haftalık Program
          </Link>
          <Link to={`/denemeler?studentId=${studentId}`} className="btn btn-ghost btn-sm">
            Deneme Girişi
          </Link>
          <Link to={`/konular?studentId=${studentId}`} className="btn btn-ghost btn-sm">
            Yeterlilik Haritası
          </Link>
        </div>
      </div>

      {editingStudent && (
        <AddStudentModal
          editingStudent={editingStudent}
          onClose={() => setEditingStudent(null)}
          onCreated={(updatedStudent) => {
            setStudents(prev => prev.map(st => st.id === updatedStudent.id ? updatedStudent : st))
            if (studentData && studentData.student.id === updatedStudent.id) {
              setStudentData({ ...studentData, student: updatedStudent })
            }
            setEditingStudent(null)
          }}
        />
      )}

      {/* Tabs Menu */}
      <div style={{ display: 'flex', gap: 20, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {(['overview', 'exams', 'subjects', 'tasks'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 6px',
              border: 'none',
              background: 'none',
              fontWeight: activeTab === tab ? 600 : 500,
              color: activeTab === tab ? 'var(--indigo-600)' : 'var(--ink-soft)',
              borderBottom: activeTab === tab ? '2px solid var(--indigo-600)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 13.5
            }}
          >
            {tab === 'overview' && 'Genel Bakış'}
            {tab === 'exams' && 'Deneme Geçmişi'}
            {tab === 'subjects' && 'Konu Yeterliliği'}
            {tab === 'tasks' && 'Görevler'}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Top Cards Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {/* Target Card */}
            <div className="card" style={{ padding: 20, display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--indigo-050)', color: 'var(--indigo-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={20} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>Hedef Net / Derece</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                  {student.target_net_value ? `${student.target_net_value} Net` : '—'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>{student.target_ranking || 'Sıralama girilmedi'}</div>
              </div>
            </div>

            {/* Average Nets */}
            <div className="card" style={{ padding: 20, display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--teal-bg)', color: 'var(--teal-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={20} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>Ortalama Net (TYT / AYT)</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                  {stats.averageTytNet} <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--ink-soft)' }}>TYT</span> / {stats.averageAytNet} <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--ink-soft)' }}>AYT</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>Son 5 deneme ortalaması</div>
              </div>
            </div>

            {/* Task Progress */}
            <div className="card" style={{ padding: 20, display: 'flex', gap: 16, alignItems: 'center' }}>
              <ProgressRing percent={stats.taskCompletion} size={44} stroke={4.5} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>Haftalık Görev Tamamlama</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>%{stats.taskCompletion}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>Tüm haftaların ortalaması</div>
              </div>
            </div>
          </div>

          {/* Graphic and Recent Exams Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
            {/* TYT Net Progress */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, marginBottom: 16 }}>TYT Net Gelişimi</h3>
              {stats.tytExams.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-faint)' }}>Veri bulunamadı</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ height: 120, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                    {stats.tytExams.map((e) => (
                      <div key={e.exam.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--indigo-600)' }}>{e.totalNet}</span>
                        <div style={{ width: 14, height: `${(e.totalNet / 120) * 80}px`, background: 'linear-gradient(to top, var(--indigo-500), var(--indigo-300))', borderRadius: '4px 4px 0 0' }}></div>
                        <span style={{ fontSize: 9.5, color: 'var(--ink-faint)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 60 }} title={e.exam.name}>
                          {e.exam.publisher || 'Deneme'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* AYT Net Progress */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, marginBottom: 16 }}>AYT Net Gelişimi</h3>
              {stats.aytExams.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-faint)' }}>Veri bulunamadı</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ height: 120, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                    {stats.aytExams.map((e) => (
                      <div key={e.exam.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal-text)' }}>{e.totalNet}</span>
                        <div style={{ width: 14, height: `${(e.totalNet / 80) * 80}px`, background: 'linear-gradient(to top, var(--teal), #7fd8e8)', borderRadius: '4px 4px 0 0' }}></div>
                        <span style={{ fontSize: 9.5, color: 'var(--ink-faint)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 60 }} title={e.exam.name}>
                          {e.exam.publisher || 'Deneme'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Critical Topics Card */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 14 }}>Kritik Konular ({stats.criticalCount})</h3>
            {stats.criticalCount === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>Harika! Kritik durumda konu bulunmuyor.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {stats.criticalTopics.map(d => {
                  const topic = topics.find(t => t.id === d.topic_id)
                  if (!topic) return null
                  return (
                    <div key={d.id} style={{ padding: '10px 12px', border: '1px solid var(--border-soft)', borderRadius: 10, background: 'var(--surface-alt)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{topic.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>{topic.subjects?.name || 'Müfredat'}</div>
                      </div>
                      <span className="state-dot state-kritik" title="Kritik seviye"></span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Exam History */}
      {activeTab === 'exams' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14 }}>Girişi Yapılmış Denemeler ({exams.length})</h3>
            <Link to={`/denemeler?studentId=${studentId}`} className="btn btn-primary btn-sm">
              <Plus size={14} /> Yeni Deneme Sonucu Gir
            </Link>
          </div>
          {exams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>Henüz girilmiş deneme sonucu bulunmuyor.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--ink-soft)' }}>
                    <th style={{ padding: '10px 4px', width: 26 }} aria-label="Detay" />
                    <th style={{ padding: '10px 12px' }}>Sınav Adı</th>
                    <th style={{ padding: '10px 12px' }}>Tarih</th>
                    <th style={{ padding: '10px 12px' }}>Tür</th>
                    <th style={{ padding: '10px 12px' }}>Net Dağılımları</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Toplam Net</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map(exam => {
                    const examSecs = sections.filter(s => s.mock_exam_id === exam.id)
                    const totalNet = Math.round(examSecs.reduce((sum, s) => sum + Number(s.net), 0) * 10) / 10
                    const isOpen = expandedExamId === exam.id
                    return (
                      <Fragment key={exam.id}>
                        <tr
                          onClick={() => setExpandedExamId(prev => prev === exam.id ? null : exam.id)}
                          title={isOpen ? 'Bölüm tablosunu kapat' : 'Bölüm tablosunu aç'}
                          style={{ borderBottom: isOpen ? 'none' : '1px solid var(--border-soft)', cursor: 'pointer' }}
                        >
                          <td style={{ padding: '12px 4px', color: 'var(--ink-faint)' }}>
                            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </td>
                          <td style={{ padding: '12px', fontWeight: 600 }}>{exam.name}</td>
                          <td style={{ padding: '12px', color: 'var(--ink-soft)' }}>{exam.exam_date}</td>
                          <td style={{ padding: '12px' }}>
                            <span className={`chip ${exam.exam_type === 'TYT' ? 'chip-say' : 'chip-ea'}`} style={{ padding: '1px 6px', fontSize: 10.5 }}>
                              {exam.exam_type}
                            </span>
                          </td>
                          <td style={{ padding: '12px', color: 'var(--ink-faint)' }}>
                            {examSecs.map(s => `${s.section_name}: ${s.net}`).join(' · ')}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--indigo-600)', fontSize: 14 }}>
                            {totalNet}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                            <td colSpan={6} style={{ padding: '0 12px 12px 34px', background: 'var(--surface-alt)' }}>
                              <div style={{ maxWidth: 760 }}>
                                <ExamSectionsTable sections={examSecs} />
                                <ExamShareButtons
                                  exam={exam}
                                  sections={examSecs}
                                  studentName={student.full_name}
                                  phone={student.phone_number}
                                  parentPhone={student.parent_phone_number}
                                />
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

      {/* TAB CONTENT: Subject Proficiency Map */}
      {activeTab === 'subjects' && (
        isCoachingLocked ? (
          <CoachingLockedState />
        ) : (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, marginBottom: 16 }}>Müfredat Konu Yeterlilik Takibi</h3>
          <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 20 }}>
            Aşağıdaki listeden konulardaki hedeflenen yeterlilik durumunu manuel olarak değiştirebilir (Koç Kararı Override) ve durumu güncelleyebilirsiniz.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Filter by Subject Category */}
            {Object.keys(subjectConfig).map(subjectName => {
              const subjectTopics = topics.filter(t => t.subjects?.name === subjectName)
              if (subjectTopics.length === 0) return null
              
              const config = subjectConfig[subjectName]
              
              return (
                <div key={subjectName} style={{ border: '1px solid var(--border-soft)', borderRadius: 12, padding: 16 }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--ink)', marginBottom: 12 }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: config.color }}></span>
                    {subjectName} ({subjectTopics.length} Konu)
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                    {subjectTopics.map(topic => {
                      const decision = decisions.find(d => d.topic_id === topic.id)
                      const state = decision?.state || 'olculmedi'
                      
                      return (
                        <div key={topic.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--surface-alt)', border: '1px solid var(--border-soft)', borderRadius: 8 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 500 }} title={topic.name}>{topic.name}</span>
                          <select 
                            value={state} 
                            onChange={(e) => handleUpdateMastery(topic.id, e.target.value as any)}
                            style={{ 
                              padding: '2px 8px', 
                              borderRadius: 6, 
                              fontSize: 11, 
                              border: '1px solid var(--border)', 
                              background: state === 'yeterli' ? 'var(--success-bg)' : state === 'gelisiyor' ? 'var(--warning-bg)' : state === 'kritik' ? 'var(--critical-bg)' : 'var(--measured-bg)',
                              color: state === 'yeterli' ? 'var(--success-text)' : state === 'gelisiyor' ? 'var(--warning-text)' : state === 'kritik' ? 'var(--critical-text)' : 'var(--measured-text)',
                              fontWeight: 700
                            }}
                          >
                            <option value="olculmedi">Ölçülmedi</option>
                            <option value="yeterli">Yeterli</option>
                            <option value="gelisiyor">Gelişiyor</option>
                            <option value="kritik">Kritik</option>
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        )
      )}

      {/* TAB CONTENT: Weekly Tasks */}
      {activeTab === 'tasks' && (
        isCoachingLocked ? (
          <CoachingLockedState />
        ) : (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, marginBottom: 16 }}>Haftalık Atanan Görevler</h3>
          {tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>
              Henüz bu öğrenciye atanmış bir görev bulunmuyor. Haftalık Program sekmesinden görev atayabilirsiniz.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Group tasks by week_start */}
              {Array.from(new Set(tasks.map(t => t.week_start))).map(weekStart => {
                const weekTasks = tasks.filter(t => t.week_start === weekStart)
                
                return (
                  <div key={weekStart} style={{ borderBottom: '1px solid var(--border-soft)', paddingBottom: 16 }}>
                    <h4 style={{ color: 'var(--indigo-600)', fontSize: 13, marginBottom: 12 }}>
                      Pazartesi: {weekStart} ({weekTasks.length} Görev)
                    </h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {weekTasks.map(task => {
                        const topic = topics.find(t => t.id === task.topic_id)
                        return (
                          <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: task.completed ? 'var(--success-bg)' : 'var(--surface-alt)', border: '1px solid var(--border-soft)', borderRadius: 10, opacity: task.completed ? 0.75 : 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <CheckSquare size={16} color={task.completed ? 'var(--success)' : 'var(--ink-faint)'} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, textDecoration: task.completed ? 'line-through' : 'none' }}>
                                  {topic?.name || task.custom_label || 'Özel Görev'}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>
                                  {topic?.subjects?.name || 'Genel'} · Hedef: {task.question_count} Soru
                                </div>
                              </div>
                            </div>
                            <span 
                              style={{ 
                                fontSize: 10.5, 
                                fontWeight: 700, 
                                padding: '2px 8px', 
                                borderRadius: 12, 
                                background: task.completed ? 'var(--success-bg)' : 'var(--warning-bg)', 
                                color: task.completed ? 'var(--success-text)' : 'var(--warning-text)' 
                              }}
                            >
                              {task.completed ? 'Tamamlandı' : 'Yapılacak'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        )
      )}
    </section>
  )
}
