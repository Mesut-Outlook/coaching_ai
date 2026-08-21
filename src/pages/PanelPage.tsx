import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, ChevronRight, HelpCircle, Users } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { mondayOf, weekKey } from '../lib/weeks'
import PageHeader from '../components/layout/PageHeader'
import ProgressRing from '../components/charts/ProgressRing'
import Sparkline from '../components/charts/Sparkline'
import AddStudentModal from '../components/students/AddStudentModal'
import { fetchStudents } from '../lib/students'
import { useAccess, type StudentScope } from '../contexts/AccessContext'
import { GRADES } from '../types/database'
import type { Student } from '../types/database'

interface StudentCardData {
  student: Student
  /** null = bu hafta hiç görev planlanmamış (0% ile karıştırılmamalı) */
  completion: number | null
  criticalCount: number
  recentNets: number[]
}

const TRACK_CHIP_CLASS: Record<Student['track'], string> = {
  SAY: 'chip-say',
  EA: 'chip-ea',
  SÖZ: 'chip-soz',
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

async function loadDashboard(scope: StudentScope): Promise<StudentCardData[]> {
  const students = await fetchStudents({ activeOnly: true, orderBy: 'created_at', ...scope })
  if (!students || students.length === 0) return []

  const studentIds = students.map((s) => s.id)
  const thisWeek = weekKey(mondayOf(new Date()))

  const [{ data: tasks }, { data: exams }, { data: decisions }] = await Promise.all([
    supabase.from('weekly_tasks').select('*').in('student_id', studentIds).eq('week_start', thisWeek),
    supabase
      .from('mock_exams')
      .select('id, student_id, exam_date')
      .in('student_id', studentIds)
      .order('exam_date', { ascending: false }),
    supabase.from('coach_decisions').select('student_id').in('student_id', studentIds).eq('state', 'kritik'),
  ])

  const examIds = exams?.map((e) => e.id) ?? []
  const { data: sections } = examIds.length
    ? await supabase.from('mock_exam_sections').select('mock_exam_id, net').in('mock_exam_id', examIds)
    : { data: [] as { mock_exam_id: string; net: number }[] }

  return students.map((student) => {
    const studentTasks = tasks?.filter((t) => t.student_id === student.id) ?? []
    const completion = studentTasks.length
      ? Math.round((studentTasks.filter((t) => t.completed).length / studentTasks.length) * 100)
      : null

    const studentExams = (exams ?? [])
      .filter((e) => e.student_id === student.id)
      .slice(0, 5)
      .reverse()
    const recentNets = studentExams.map((e) => {
      const examSections = sections?.filter((s) => s.mock_exam_id === e.id) ?? []
      return Math.round(examSections.reduce((sum, s) => sum + Number(s.net), 0) * 10) / 10
    })

    const criticalCount = decisions?.filter((d) => d.student_id === student.id).length ?? 0

    return { student, completion, criticalCount, recentNets }
  })
}

export default function PanelPage() {
  const [cards, setCards] = useState<StudentCardData[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [trackFilter, setTrackFilter] = useState<'Tümü' | Student['track']>('Tümü')
  const [gradeFilter, setGradeFilter] = useState<'Tümü' | Student['grade']>('Tümü')
  const [showAddModal, setShowAddModal] = useState(false)

  const { studentScope, can } = useAccess()

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCards([])
      return
    }
    loadDashboard(studentScope)
      .then(setCards)
      .catch((err) => setError(err instanceof Error ? err.message : 'Öğrenciler yüklenemedi.'))
  }, [studentScope])

  const visible = useMemo(() => {
    if (!cards) return []
    return cards
      .filter((c) => c.student.full_name.toLowerCase().includes(search.toLowerCase()))
      .filter((c) => trackFilter === 'Tümü' || c.student.track === trackFilter)
      .filter((c) => gradeFilter === 'Tümü' || c.student.grade === gradeFilter)
      .sort((a, b) => b.criticalCount - a.criticalCount)
  }, [cards, search, trackFilter, gradeFilter])

  return (
    <section className="screen">
      <PageHeader
        hideSearch
        title="Koç Paneli"
        subtitle={
          cards
            ? `${cards.length} öğrenci takip ediliyor, ${cards.reduce((s, c) => s + c.criticalCount, 0)} kritik konu ilgi bekliyor.`
            : 'Yükleniyor…'
        }
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/yardim" className="btn btn-ghost">
              <HelpCircle size={14} /> Yardım
            </Link>
            <button type="button" className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={14} /> Öğrenci Ekle
            </button>
          </div>
        }
      />

      {showAddModal && (
        <AddStudentModal
          onClose={() => setShowAddModal(false)}
          onCreated={(student) => {
            setCards((prev) => [...(prev ?? []), { student, completion: null, criticalCount: 0, recentNets: [] }])
            setShowAddModal(false)
          }}
        />
      )}

      {!isSupabaseConfigured && (
        <div className="card" style={{ padding: 16, marginBottom: 20, background: 'var(--warning-bg)', border: 'none', color: 'var(--warning-text)', fontSize: 13 }}>
          Supabase bağlı değil — <code>.env.example</code>'ı <code>.env.local</code> olarak kopyalayıp proje bilgilerini gir, sonra bu ekran gerçek öğrenci verisini çekmeye başlar.
        </div>
      )}
      {error && (
        <div className="card" style={{ padding: 16, marginBottom: 20, background: 'var(--critical-bg)', border: 'none', color: 'var(--critical-text)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {isSupabaseConfigured && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', flex: 1, minWidth: 220, maxWidth: 320, color: 'var(--ink-faint)' }}>
            <Search size={14} />
            <input
              type="text"
              placeholder="Öğrenci ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'none', flex: 1, color: 'var(--ink)', fontSize: 13.5 }}
            />
          </div>
          <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value as typeof gradeFilter)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', fontSize: 13 }}>
            <option>Tümü</option>
            {GRADES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <select value={trackFilter} onChange={(e) => setTrackFilter(e.target.value as typeof trackFilter)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', fontSize: 13 }}>
            <option>Tümü</option>
            <option>SAY</option>
            <option>EA</option>
            <option>SÖZ</option>
          </select>
        </div>
      )}

      {cards && cards.length === 0 && (
        <div className="card empty-state">
          <Users size={26} className="empty-state-icon" />
          <p className="empty-state-text">
            Bu kurumda henüz öğrenci yok. İlk öğrenciyi ekleyerek haftalık takibe başla.
          </p>
          {can('students.create') && (
            <button type="button" className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={16} /> Öğrenci Ekle
            </button>
          )}
        </div>
      )}

      <div className="student-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))', gap: 18 }}>
        {/* Yüklenirken boş ekran gösterip sonra kartları basmak sayfayı zıplatıyordu;
            iskelet kartlar nihai düzeni baştan ayırıyor. */}
        {cards === null &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={`iskelet-${i}`} className="skeleton skeleton-card" aria-hidden="true" />
          ))}

        {visible.map(({ student, completion, criticalCount, recentNets }) => (
          <Link to={`/ogrenciler/${student.id}`} key={student.id} className="card" style={{ padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 14, textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', gap: 11, alignItems: 'center', minWidth: 0 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--measured-bg)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-disp)', fontWeight: 700, fontSize: 15, flexShrink: 0, border: '1px solid var(--border-soft)' }}>
                  {student.photo_url ? (
                    <img src={student.photo_url} alt={student.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    initials(student.full_name)
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{student.full_name}</div>
                  <div style={{ color: 'var(--ink-soft)', fontSize: 12, marginTop: 2 }}>{student.grade}</div>
                </div>
              </div>
              {/* Rozet yalnız gerçekten kritik varken çıkar. Eskiden her kartta
                  "Kritik yok" yazıyordu; 14 kartın 14'ünde tekrar eden bir etiket
                  bilgi taşımıyor, sadece gürültü yapıyordu. */}
              {criticalCount > 0 && (
                <span
                  className="critical-badge"
                  style={{
                    background: 'var(--critical-bg)', color: 'var(--critical-text)',
                    fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  {criticalCount} kritik
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Halka neyin yüzdesi olduğunu söylemiyordu; ayrıca plan yokken de %0
                  gösterip "hiç yapmamış" gibi okunuyordu. */}
              {completion === null ? (
                <div style={{ width: 52, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)', lineHeight: 1.3 }}>Plan<br />yok</div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <ProgressRing percent={completion} />
                  <div style={{ fontSize: 9.5, color: 'var(--ink-faint)', marginTop: 3, letterSpacing: '.02em' }}>HAFTALIK GÖREV</div>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginBottom: 3 }}>Son 5 deneme neti</div>
                <Sparkline values={recentNets} />
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15 }}>
                  {recentNets.length ? recentNets[recentNets.length - 1] : '—'}{' '}
                  <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 500 }}>net</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border-soft)' }}>
              <span className={`chip ${TRACK_CHIP_CLASS[student.track]}`}>{student.track}</span>
              <span style={{ fontSize: 11.5, color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                Profil <ChevronRight size={14} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
