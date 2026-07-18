import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, ChevronDown, ChevronUp, Save, Info, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import PageHeader from '../components/layout/PageHeader'
import type { Student, Subject, Topic, CoachDecision, TopicMeasurement } from '../types/database'

export default function KonularPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialStudentId = searchParams.get('studentId') || ''

  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId)
  
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [decisions, setDecisions] = useState<CoachDecision[]>([])
  const [measurements, setMeasurements] = useState<TopicMeasurement[]>([])
  
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedSubjects, setExpandedSubjects] = useState<Record<number, boolean>>({})
  
  // Selected topic for edit drawer/panel
  const [editingTopicId, setEditingTopicId] = useState<number | null>(null)
  const [editState, setEditState] = useState<'yeterli' | 'gelisiyor' | 'kritik' | 'olculmedi'>('olculmedi')
  const [editNote, setEditNote] = useState('')
  const [savingDecision, setSavingDecision] = useState(false)

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
  }, [])

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

  const currentStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId)
  }, [students, selectedStudentId])

  // Toggle subject accordion
  const toggleExpand = (subjectId: number) => {
    setExpandedSubjects(prev => ({
      ...prev,
      [subjectId]: !prev[subjectId]
    }))
  }

  // Handle opening the details drawer
  const openEditDrawer = (topicId: number) => {
    const dec = decisions.find(d => d.topic_id === topicId)
    setEditingTopicId(topicId)
    setEditState((dec?.state as any) || 'olculmedi')
    setEditNote(dec?.note || '')
  }

  // Handle saving coach decision
  const handleSaveDecision = async () => {
    if (!selectedStudentId || !editingTopicId || !isSupabaseConfigured) return
    setSavingDecision(true)

    try {
      const coachId = currentStudent?.coach_id || ''
      
      if (editState === 'olculmedi') {
        // Delete decision if set back to olculmedi
        const { error } = await supabase
          .from('coach_decisions')
          .delete()
          .eq('student_id', selectedStudentId)
          .eq('topic_id', editingTopicId)
        
        if (error) throw error
        setDecisions(prev => prev.filter(d => d.topic_id !== editingTopicId))
      } else {
        // Upsert decision
        const { data, error } = await supabase
          .from('coach_decisions')
          .upsert({
            student_id: selectedStudentId,
            topic_id: editingTopicId,
            state: editState,
            note: editNote || null,
            decided_by: coachId,
            decided_at: new Date().toISOString()
          })
          .select()
          
        if (error) throw error
        if (data && data.length > 0) {
          setDecisions(prev => {
            const idx = prev.findIndex(d => d.topic_id === editingTopicId)
            if (idx > -1) {
              const next = [...prev]
              next[idx] = data[0]
              return next
            }
            return [...prev, data[0]]
          })
        }
      }

      setEditingTopicId(null)
      alert('Koç kararı kaydedildi!')
    } catch (err) {
      alert('Karar kaydedilirken hata oluştu.')
    } finally {
      setSavingDecision(false)
    }
  }

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

  const getTopicAccuracy = (topicId: number) => {
    const meas = measurements.filter(m => m.topic_id === topicId)
    if (meas.length === 0) return null
    return Math.round(Number(meas[0].accuracy_pct))
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
                          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>({totalCount} Konu)</span>
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
                            const accuracy = getTopicAccuracy(topic.id)
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
                                    {accuracy !== null ? `Doğruluk: %${accuracy}` : 'Ölçüm yok'}
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
              const meas = measurements.filter(m => m.topic_id === editingTopicId)
              
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', fontWeight: 700, textTransform: 'uppercase' }}>
                      {subject?.name}
                    </span>
                    <h3 style={{ fontSize: 15, marginTop: 4 }}>{topic?.name}</h3>
                  </div>

                  {/* Diagnostic stats */}
                  <div style={{ padding: 10, background: 'var(--surface-alt)', borderRadius: 8, border: '1px solid var(--border-soft)', fontSize: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Deneme / Test Ölçümleri</div>
                    {meas.length === 0 ? (
                      <div style={{ color: 'var(--ink-faint)' }}>Henüz test çözülmemiş.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {meas.slice(0, 3).map(m => (
                          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-soft)' }}>
                            <span>{m.source_label}</span>
                            <span style={{ fontWeight: 700 }}>%{Math.round(Number(m.accuracy_pct))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Decision Form */}
                  <div className="field">
                    <label>Koç Kararı Durumu</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(['yeterli', 'gelisiyor', 'kritik', 'olculmedi'] as const).map(stateOpt => (
                        <button
                          key={stateOpt}
                          type="button"
                          onClick={() => setEditState(stateOpt)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: 8,
                            borderRadius: 8,
                            border: editState === stateOpt ? '2px solid var(--indigo-500)' : '1px solid var(--border-soft)',
                            background: editState === stateOpt ? 'var(--indigo-025)' : 'var(--surface)',
                            cursor: 'pointer',
                            fontSize: 12.5,
                            fontWeight: editState === stateOpt ? 700 : 500,
                            textAlign: 'left'
                          }}
                        >
                          {stateOpt === 'yeterli' && <CheckCircle2 size={14} color="var(--success)" />}
                          {stateOpt === 'gelisiyor' && <AlertTriangle size={14} color="var(--warning)" />}
                          {stateOpt === 'kritik' && <XCircle size={14} color="var(--critical)" />}
                          {stateOpt === 'olculmedi' && <HelpCircle size={14} color="var(--measured-text)" />}
                          <span style={{
                            textTransform: 'capitalize',
                            color: stateOpt === 'yeterli' ? 'var(--success-text)' : stateOpt === 'gelisiyor' ? 'var(--warning-text)' : stateOpt === 'kritik' ? 'var(--critical-text)' : 'var(--measured-text)'
                          }}>
                            {stateOpt === 'yeterli' && 'Yeterli'}
                            {stateOpt === 'gelisiyor' && 'Gelişiyor'}
                            {stateOpt === 'kritik' && 'Kritik'}
                            {stateOpt === 'olculmedi' && 'Seçimi Kaldır'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field">
                    <label>Koç Notu</label>
                    <textarea
                      placeholder="Konu gelişimine dair koç notu ekleyin…"
                      value={editNote}
                      onChange={e => setEditNote(e.target.value)}
                      rows={3}
                      style={{ resize: 'none', fontSize: 13 }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => setEditingTopicId(null)}
                    >
                      İptal
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ flex: 1.5, justifyContent: 'center' }}
                      onClick={handleSaveDecision}
                      disabled={savingDecision}
                    >
                      <Save size={14} /> Kaydet
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>

        </div>
      )}
    </section>
  )
}
