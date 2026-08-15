import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import PageHeader from '../components/layout/PageHeader'
import TopicProgressPanel from '../components/topics/TopicProgressPanel'
import { fetchStudents } from '../lib/students'
import { useAccess } from '../contexts/AccessContext'
import { useAuth } from '../contexts/AuthContext'
import CoachingLockedState from '../components/common/CoachingLockedState'
import type { Student, Subject, Topic, CoachDecision, TopicMeasurement } from '../types/database'

export default function KonularPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialStudentId = searchParams.get('studentId') || ''

  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId)
  const { user } = useAuth()
  const { isSystemAdmin, studentScope } = useAccess()
  
  const selectedStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId)
  }, [students, selectedStudentId])

  const isCoachingLocked = !isSystemAdmin && Boolean(selectedStudent?.coaching_coach_id) && selectedStudent?.coaching_coach_id !== user?.id
  
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [decisions, setDecisions] = useState<CoachDecision[]>([])
  const [measurements, setMeasurements] = useState<TopicMeasurement[]>([])
  
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedSubjects, setExpandedSubjects] = useState<Record<number, boolean>>({})
  
  // Seçili konu — detay/gelişim paneli (panelin kendi state'i bileşenin içinde)
  const [editingTopicId, setEditingTopicId] = useState<number | null>(null)

  // Sync selectedStudentId with query parameters
  const handleStudentChange = (id: string) => {
    setSelectedStudentId(id)
    setSearchParams({ studentId: id })
    setEditingTopicId(null)
  }

  // Load students, subjects, topics
  useEffect(() => {
    if (!isSupabaseConfigured) return
    
    // Load students
    fetchStudents({ activeOnly: true, orderBy: 'full_name', ...studentScope })
      .then((data) => {
        if (data) {
          setStudents(data)
          if (!selectedStudentId && data.length > 0) {
            setSelectedStudentId(data[0].id)
            setSearchParams({ studentId: data[0].id })
          }
        }
      })

    // Load subjects
    supabase.from('subjects').select('*').order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data) {
          setSubjects(data)
          // Expand first two subjects by default
          if (data.length > 0) {
            setExpandedSubjects({
              [data[0].id]: true,
              [data[1]?.id]: true
            })
          }
        }
      })

    // Load topics
    supabase.from('topics').select('*').order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data) setTopics(data)
      })
  }, [studentScope])

  // Load decisions and measurements for selected student
  const loadStudentData = async () => {
    if (!selectedStudentId || !isSupabaseConfigured) return
    setLoading(true)
    
    try {
      const [{ data: decData }, { data: measData }] = await Promise.all([
        supabase.from('coach_decisions').select('*').eq('student_id', selectedStudentId),
        supabase.from('topic_measurements').select('*').eq('student_id', selectedStudentId).order('measured_at', { ascending: false })
      ])
      
      setDecisions(decData || [])
      setMeasurements(measData || [])
    } catch (err) {
      console.error('Error loading subjects/topics data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStudentData()
  }, [selectedStudentId])

  // Toggle subject accordion
  const toggleExpand = (subjectId: number) => {
    setExpandedSubjects(prev => ({
      ...prev,
      [subjectId]: !prev[subjectId]
    }))
  }

  const openEditDrawer = (topicId: number) => setEditingTopicId(topicId)

  // Group topics by subject and filter by search query
  const filteredData = useMemo(() => {
    return subjects.map(subject => {
      const subjectTopics = topics.filter(t => t.subject_id === subject.id)
      const filteredTopics = subjectTopics.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      return {
        subject,
        topics: filteredTopics,
        totalCount: subjectTopics.length,
        filteredCount: filteredTopics.length
      }
    }).filter(group => group.filteredCount > 0)
  }, [subjects, topics, searchQuery])

  // Get topic info helpers
  const getTopicStatus = (topicId: number) => {
    const dec = decisions.find(d => d.topic_id === topicId)
    return dec?.state || 'olculmedi'
  }

  const getTopicAverageAccuracy = (topicId: number) => {
    const meas = measurements.filter(m => m.topic_id === topicId)
    if (meas.length === 0) return null
    const total = meas.reduce((sum, m) => sum + Number(m.accuracy_pct), 0)
    return Math.round(total / meas.length)
  }

  const getTopicLatestAccuracy = (topicId: number) => {
    const meas = measurements.filter(m => m.topic_id === topicId)
    if (meas.length === 0) return null
    return Math.round(Number(meas[0].accuracy_pct))
  }

  const getSubjectAverageAccuracy = (subjectId: number) => {
    const subjectTopicIds = topics.filter(t => t.subject_id === subjectId).map(t => t.id)
    const subjectMeas = measurements.filter(m => subjectTopicIds.includes(m.topic_id))
    if (subjectMeas.length === 0) return null
    const total = subjectMeas.reduce((sum, m) => sum + Number(m.accuracy_pct), 0)
    return Math.round(total / subjectMeas.length)
  }

  return (
    <section className="screen">
      <PageHeader title="Konu Yeterlilik Haritası" subtitle="Öğrencinin konu bazlı doğruluk oranlarını görün ve Koç Kararı durumlarını yönetin." />

      {!isSupabaseConfigured && (
        <div className="card" style={{ padding: 16, marginBottom: 20, background: 'var(--warning-bg)', border: 'none', color: 'var(--warning-text)' }}>
          Supabase bağlı değil — Lütfen Supabase yapılandırmasını tamamlayın.
        </div>
      )}

      {isSupabaseConfigured && (
        isCoachingLocked ? (
          <CoachingLockedState />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
            
            {/* LEFT COLUMN: Lessons & Topics List */}
            <div>
              {/* Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <div className="field" style={{ minWidth: 200 }}>
                  <select value={selectedStudentId} onChange={(e) => handleStudentChange(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name} ({s.track})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', flex: 1, maxWidth: 300, color: 'var(--ink-faint)' }}>
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Konu ara…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ border: 'none', outline: 'none', background: 'none', flex: 1, color: 'var(--ink)', fontSize: 13.5 }}
                  />
                </div>
              </div>

              {/* Accordion List */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>Yükleniyor…</div>
            ) : filteredData.length === 0 ? (
              <div className="card empty-state">
                <h3>Konu bulunamadı</h3>
                <p>Arama kriterlerinize uyan bir konu veya ders bulunmuyor.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredData.map(({ subject, topics: groupTopics, totalCount }) => {
                  const isExpanded = !!expandedSubjects[subject.id]
                  
                  // Calculate statuses count for this subject
                  const subjectTopicIds = topics.filter(t => t.subject_id === subject.id).map(t => t.id)
                  const subjectDecisions = decisions.filter(d => subjectTopicIds.includes(d.topic_id))
                  
                  const countKritik = subjectDecisions.filter(d => d.state === 'kritik').length
                  const countGelisiyor = subjectDecisions.filter(d => d.state === 'gelisiyor').length
                  const countYeterli = subjectDecisions.filter(d => d.state === 'yeterli').length

                  return (
                    <div key={subject.id} className="card" style={{ overflow: 'hidden' }}>
                      {/* Accordion Header */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(subject.id)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '16px 20px',
                          border: 'none',
                          background: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          borderBottom: isExpanded ? '1px solid var(--border-soft)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ width: 14, height: 14, borderRadius: '50%', background: subject.color }}></span>
                          <h3 style={{ fontSize: 14.5 }}>{subject.name}</h3>
                          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                            ({totalCount} Konu{getSubjectAverageAccuracy(subject.id) !== null ? ` · Ort: %${getSubjectAverageAccuracy(subject.id)}` : ''})
                          </span>
                        </div>

                        {/* Status badges summary */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ display: 'flex', gap: 6, fontSize: 11, fontWeight: 700 }}>
                            {countKritik > 0 && <span style={{ background: 'var(--critical-bg)', color: 'var(--critical-text)', padding: '2px 6px', borderRadius: 4 }}>{countKritik} Kritik</span>}
                            {countGelisiyor > 0 && <span style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)', padding: '2px 6px', borderRadius: 4 }}>{countGelisiyor} Gelişiyor</span>}
                            {countYeterli > 0 && <span style={{ background: 'var(--success-bg)', color: 'var(--success-text)', padding: '2px 6px', borderRadius: 4 }}>{countYeterli} Yeterli</span>}
                          </div>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </button>

                      {/* Accordion Content */}
                      {isExpanded && (
                        <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, background: 'var(--surface-alt)' }}>
                          {groupTopics.map(topic => {
                            const status = getTopicStatus(topic.id)
                            const avgAccuracy = getTopicAverageAccuracy(topic.id)
                            const latestAccuracy = getTopicLatestAccuracy(topic.id)
                            const isEditing = editingTopicId === topic.id
                            
                            return (
                              <button
                                key={topic.id}
                                type="button"
                                onClick={() => openEditDrawer(topic.id)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 14px',
                                  background: isEditing ? 'var(--indigo-050)' : 'var(--surface)',
                                  border: isEditing ? '1px solid var(--indigo-500)' : '1px solid var(--border-soft)',
                                  borderRadius: 10,
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  transition: 'border-color .15s ease',
                                  width: '100%'
                                }}
                              >
                                <div style={{ minWidth: 0, paddingRight: 8 }}>
                                  <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--ink)' }}>{topic.name}</div>
                                  <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>
                                    {avgAccuracy !== null ? `Ort: %${avgAccuracy} (Son: %${latestAccuracy})` : 'Ölçüm yok'}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                  <span className={`pill-state ${status === 'yeterli' ? 'pill-yeterli' : status === 'gelisiyor' ? 'pill-gelisiyor' : status === 'kritik' ? 'pill-kritik' : 'pill-olculmedi'}`} style={{ fontSize: 10, padding: '1px 6px', fontWeight: 800 }}>
                                    {status === 'yeterli' && 'Yeterli'}
                                    {status === 'gelisiyor' && 'Gelişiyor'}
                                    {status === 'kritik' && 'Kritik'}
                                    {status === 'olculmedi' && 'Girilmedi'}
                                  </span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Coach Decision Editor Panel */}
          <div className="card" style={{ padding: 20, position: 'sticky', top: 80 }}>
            {editingTopicId === null ? (
              <div style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: '40px 10px' }}>
                <Info size={30} style={{ margin: '0 auto 12px', display: 'block', color: 'var(--ink-faint)' }} />
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>Koç Kararı Paneli</h4>
                <p style={{ fontSize: 11.5, marginTop: 6 }}>
                  Durumunu ve notunu değiştirmek istediğiniz bir konunun üzerine tıklayınız.
                </p>
              </div>
            ) : (() => {
              const topic = topics.find(t => t.id === editingTopicId)
              const subject = subjects.find(s => s.id === topic?.subject_id)
              if (!topic) return null

              return (
                <TopicProgressPanel
                  studentId={selectedStudentId}
                  topicId={topic.id}
                  topicName={topic.name}
                  subjectName={subject?.name}
                  onSaved={loadStudentData}
                  onClose={() => setEditingTopicId(null)}
                />
              )
            })()}
          </div>

        </div>
        )
      )}
    </section>
  )
}
