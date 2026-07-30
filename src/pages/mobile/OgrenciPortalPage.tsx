import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Student, WeeklyTask, MockExam } from '../../types/database'
import MobileBottomNav from '../../components/mobile/MobileBottomNav'
import { CheckCircle2, Circle, Plus } from 'lucide-react'

export default function OgrenciPortalPage() {
  const navigate = useNavigate()
  const [student, setStudent] = useState<Student | null>(null)
  const [tasks, setTasks] = useState<WeeklyTask[]>([])
  const [exams, setExams] = useState<MockExam[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'tasks' | 'exams' | 'goals' | 'attendance'>('tasks')

  // Quick exam add modal state
  const [showExamModal, setShowExamModal] = useState(false)
  const [examName, setExamName] = useState('')
  const [publisher, setPublisher] = useState('')
  const [examType, setExamType] = useState<'TYT' | 'AYT'>('TYT')

  useEffect(() => {
    loadStudentData()
  }, [])

  async function loadStudentData() {
    const code = localStorage.getItem('netlik_mobile_code')
    const studentId = localStorage.getItem('netlik_mobile_student_id')

    if (!code || !studentId) {
      navigate('/portal')
      return
    }

    setLoading(true)

    // Load student profile
    const { data: stuData } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single()

    if (stuData) {
      setStudent(stuData as Student)

      // Load tasks
      const { data: taskData } = await supabase
        .from('weekly_tasks')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })

      if (taskData) setTasks(taskData as WeeklyTask[])

      // Load exams
      const { data: examData } = await supabase
        .from('mock_exams')
        .select('*')
        .eq('student_id', studentId)
        .order('exam_date', { ascending: false })

      if (examData) setExams(examData as MockExam[])
    }

    setLoading(false)
  }

  async function toggleTaskCompleted(task: WeeklyTask) {
    const updatedStatus = !task.completed

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: updatedStatus } : t))
    )

    await supabase
      .from('weekly_tasks')
      .update({ completed: updatedStatus })
      .eq('id', task.id)
  }

  async function handleAddExam(e: React.FormEvent) {
    e.preventDefault()
    if (!student || !examName.trim()) return

    const { error } = await supabase.from('mock_exams').insert({
      student_id: student.id,
      name: examName.trim(),
      publisher: publisher.trim() || null,
      exam_type: examType,
      exam_date: new Date().toISOString().split('T')[0],
    })

    if (!error) {
      setShowExamModal(false)
      setExamName('')
      setPublisher('')
      loadStudentData()
    }
  }

  function handleLogout() {
    localStorage.removeItem('netlik_mobile_code')
    localStorage.removeItem('netlik_mobile_student_id')
    localStorage.removeItem('netlik_mobile_role')
    navigate('/portal')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Yükleniyor...
      </div>
    )
  }

  if (!student) return null

  const completedCount = tasks.filter((t) => t.completed).length
  const totalCount = tasks.length
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: 80 }}>
      {/* Header Bar */}
      <header
        style={{
          backgroundColor: '#ffffff',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>
            👋 {student.full_name}
          </h2>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            {student.grade} · {student.track}
          </div>
        </div>

        <div
          style={{
            padding: '6px 12px',
            borderRadius: 20,
            backgroundColor: 'var(--indigo-50)',
            color: 'var(--indigo-600)',
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {student.student_access_code || 'Öğrenci'}
        </div>
      </header>

      {/* Progress Header Card */}
      <div style={{ padding: '16px 20px 0 20px' }}>
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: 18,
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
              Haftalık Program İlerlemesi
            </span>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--indigo-600)' }}>
              %{completionPct}
            </span>
          </div>

          <div
            style={{
              width: '100%',
              height: 10,
              borderRadius: 5,
              backgroundColor: '#e2e8f0',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${completionPct}%`,
                height: '100%',
                backgroundColor: 'var(--indigo-600)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-soft)', display: 'flex', gap: 12 }}>
            <span> Tamamlanan: <strong>{completedCount}</strong></span>
            <span> Bekleyen: <strong>{totalCount - completedCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <main style={{ padding: 20 }}>
        {activeTab === 'tasks' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Program Görevlerim</h3>
              <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                {tasks.length} Görev
              </span>
            </div>

            {tasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, backgroundColor: '#fff', borderRadius: 16, border: '1px solid var(--border)' }}>
                Henüz bu hafta atanmış bir görev bulunmuyor.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tasks.map((t) => {
                  const isDone = t.completed
                  return (
                    <div
                      key={t.id}
                      onClick={() => toggleTaskCompleted(t)}
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: 14,
                        padding: '14px 16px',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        opacity: isDone ? 0.65 : 1,
                      }}
                    >
                      {isDone ? (
                        <CheckCircle2 size={24} style={{ color: '#10b981', flexShrink: 0 }} />
                      ) : (
                        <Circle size={24} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                      )}

                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--ink)',
                            textDecoration: isDone ? 'line-through' : 'none',
                          }}
                        >
                          {t.custom_label || `Görev #${t.id.slice(0, 4)}`}
                        </div>
                        {t.question_count > 0 && (
                          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                            Hedef: {t.question_count} Soru
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'exams' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Deneme Geçmişim</h3>
              <button
                type="button"
                onClick={() => setShowExamModal(true)}
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Plus size={14} /> Deneme Ekle
              </button>
            </div>

            {exams.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, backgroundColor: '#fff', borderRadius: 16, border: '1px solid var(--border)' }}>
                Henüz kayıtlı deneme bulunmuyor.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {exams.map((e) => (
                  <div
                    key={e.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 14,
                      padding: 16,
                      border: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{e.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                        {e.exam_type} {e.publisher ? `· ${e.publisher}` : ''} · {e.exam_date}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'goals' && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Hedeflerim & Bilgilerim</h3>

            <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18, border: '1px solid var(--border)', marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>HEDEF BÖLÜM / ÜNİVERSİTE</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginTop: 4 }}>
                {student.target_program || 'Henüz Hedef Belirtilmedi'}
              </div>
              {student.target_ranking && (
                <div style={{ fontSize: 13, color: 'var(--indigo-600)', fontWeight: 700, marginTop: 4 }}>
                  Hedef Sıralama: #{student.target_ranking}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Quick Add Exam Modal */}
      {showExamModal && (
        <div className="modal-overlay">
          <div className="modal-panel" style={{ maxWidth: 360, width: '90%' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Yeni Deneme Gir</h3>
            <form onSubmit={handleAddExam}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Sınav Adı</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Özdebir TYT 3"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Yayın (Opsiyonel)</label>
                <input
                  type="text"
                  placeholder="Örn: 3D Yayınları"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Sınav Türü</label>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value as 'TYT' | 'AYT')}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
                >
                  <option value="TYT">TYT</option>
                  <option value="AYT">AYT</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => setShowExamModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  İptal
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        role="ogrenci"
        onLogout={handleLogout}
      />
    </div>
  )
}
