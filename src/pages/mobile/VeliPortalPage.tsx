import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Student, WeeklyTask, MockExam, AttendanceRecord } from '../../types/database'
import MobileBottomNav from '../../components/mobile/MobileBottomNav'

export default function VeliPortalPage() {
  const navigate = useNavigate()
  const [student, setStudent] = useState<Student | null>(null)
  const [tasks, setTasks] = useState<WeeklyTask[]>([])
  const [exams, setExams] = useState<MockExam[]>([])
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'tasks' | 'exams' | 'goals' | 'attendance'>('tasks')

  useEffect(() => {
    loadVeliData()
  }, [])

  async function loadVeliData() {
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

      // Fetch tasks
      const { data: taskData } = await supabase
        .from('weekly_tasks')
        .select('*')
        .eq('student_id', studentId)

      if (taskData) setTasks(taskData as WeeklyTask[])

      // Fetch exams
      const { data: examData } = await supabase
        .from('mock_exams')
        .select('*')
        .eq('student_id', studentId)
        .order('exam_date', { ascending: false })

      if (examData) setExams(examData as MockExam[])

      // Fetch attendance
      const { data: attData } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('student_id', studentId)
        .order('absence_date', { ascending: false })

      if (attData) setAttendances(attData as AttendanceRecord[])
    }

    setLoading(false)
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
  const latestExam = exams.length > 0 ? exams[0] : null
  const unexcusedAbsences = attendances.filter((a) => a.excuse_type === 'yok').length

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: 80 }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: '#ffffff',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>
            Öğrenci: {student.full_name}
          </h2>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            Veli Bilgilendirme Portalı
          </div>
        </div>

        <div
          style={{
            padding: '6px 12px',
            borderRadius: 20,
            backgroundColor: '#ecfdf5',
            color: '#059669',
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          Veli Erişimi
        </div>
      </header>

      {/* Main Executive Cards */}
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Weekly Completion Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: 18,
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
            Haftalık Çalışma İlerlemesi
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--indigo-600)', marginTop: 4 }}>
            %{completionPct}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
            {completedCount} / {totalCount} görev tamamlandı
          </div>
        </div>

        {/* Latest Exam Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: 18,
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
            Son Kayıtlı Sınav
          </div>
          {latestExam ? (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>
                {latestExam.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>
                {latestExam.exam_type} {latestExam.publisher ? `· ${latestExam.publisher}` : ''} · {latestExam.exam_date}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 6 }}>
              Henüz girilmiş deneme verisi yok.
            </div>
          )}
        </div>

        {/* Attendance Summary */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: 18,
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
            Devamsızlık & Katılım
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: unexcusedAbsences > 0 ? '#dc2626' : '#10b981', marginTop: 4 }}>
            {unexcusedAbsences === 0 ? '✓ Mazeretsiz devamsızlık yok' : `${unexcusedAbsences} Mazeretsiz Devamsızlık`}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
            Toplam kayıtlı olay: {attendances.length}
          </div>
        </div>

        {/* Target Rank Card */}
        {student.target_program && (
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 16,
              padding: 18,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
              Hedeflenen Bölüm
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginTop: 4 }}>
              {student.target_program}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        role="veli"
        onLogout={handleLogout}
      />
    </div>
  )
}
