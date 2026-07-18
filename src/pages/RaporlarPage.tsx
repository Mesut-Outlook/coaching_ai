import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckSquare, Plus, Trash2, CheckCircle2, ChevronRight } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import PageHeader from '../components/layout/PageHeader'
import type { Student, WeeklyTask, CoachDecision, Topic, Subject } from '../types/database'
import { mondayOf, weekKey, fmtWeekRange } from '../lib/weeks'

export default function RaporlarPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialStudentId = searchParams.get('studentId') || ''
  
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId)
  
  const [lastWeekTasks, setLastWeekTasks] = useState<WeeklyTask[]>([])
  const [nextWeekTasks, setNextWeekTasks] = useState<WeeklyTask[]>([])
  const [decisions, setDecisions] = useState<CoachDecision[]>([])
  const [topics, setTopics] = useState<(Topic & { subjects: Subject | null })[]>([])
  
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Quick task input state
  const [selectedTopicId, setSelectedTopicId] = useState<string>('custom')
  const [customLabel, setCustomLabel] = useState('')
  const [questionCount, setQuestionCount] = useState<number>(120)
  const [dayIndex, setDayIndex] = useState<number>(0)

  // Calculate Mondays for past and next week
  const pastWeekMonday = useMemo(() => {
    const prev = new Date(mondayOf(new Date()))
    prev.setDate(prev.getDate() - 7)
    return prev
  }, [])

  const nextWeekMonday = useMemo(() => {
    const next = new Date(mondayOf(new Date()))
    next.setDate(next.getDate() + 7)
    return next
  }, [])

  // Sync selectedStudentId with query parameter
  const handleStudentChange = (id: string) => {
    setSelectedStudentId(id)
    setSearchParams({ studentId: id })
  }

  // Load students, topics
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

    supabase.from('topics').select('*, subjects(*)').order('name', { ascending: true })
      .then(({ data }) => {
        if (data) setTopics(data as any)
      })
  }, [])

  // Load data for the weekly review
  const loadReviewData = async () => {
    if (!selectedStudentId || !isSupabaseConfigured) return
    setLoading(true)
    
    try {
      const pastKey = weekKey(pastWeekMonday)
      const nextKey = weekKey(nextWeekMonday)

      const [
        { data: pastData },
        { data: nextData },
        { data: decData }
      ] = await Promise.all([
        supabase.from('weekly_tasks').select('*').eq('student_id', selectedStudentId).eq('week_start', pastKey).order('day_index', { ascending: true }),
        supabase.from('weekly_tasks').select('*').eq('student_id', selectedStudentId).eq('week_start', nextKey).order('day_index', { ascending: true }),
        supabase.from('coach_decisions').select('*').eq('student_id', selectedStudentId).eq('state', 'kritik')
      ])

      setLastWeekTasks(pastData || [])
      setNextWeekTasks(nextData || [])
      setDecisions(decData || [])
    } catch (err) {
      console.error('Error loading weekly review data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReviewData()
  }, [selectedStudentId])

  // Stats for the past week
  const pastWeekStats = useMemo(() => {
    const total = lastWeekTasks.length
    if (total === 0) return { completionRate: 0, solvedCount: 0, targetCount: 0 }
    
    const completed = lastWeekTasks.filter(t => t.completed).length
    const completionRate = Math.round((completed / total) * 100)
    
    const targetCount = lastWeekTasks.reduce((sum, t) => sum + t.question_count, 0)
    const solvedCount = lastWeekTasks.filter(t => t.completed).reduce((sum, t) => sum + t.question_count, 0)
    
    return { completionRate, solvedCount, targetCount }
  }, [lastWeekTasks])

  // Handle quick task assignment for next week
  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudentId || !isSupabaseConfigured) return

    const topicIdVal = selectedTopicId === 'custom' ? null : parseInt(selectedTopicId)
    const labelVal = selectedTopicId === 'custom' ? customLabel : null

    if (selectedTopicId === 'custom' && !customLabel.trim()) {
      return alert('Lütfen görev açıklaması girin.')
    }

    setSubmitting(true)

    try {
      const nextKey = weekKey(nextWeekMonday)
      const { data, error } = await supabase
        .from('weekly_tasks')
        .insert({
          student_id: selectedStudentId,
          week_start: nextKey,
          day_index: dayIndex,
          topic_id: topicIdVal,
          custom_label: labelVal,
          question_count: questionCount,
          is_exam: false,
          completed: false
        })
        .select()

      if (error) throw error
      if (data) {
        setNextWeekTasks(prev => [...prev, data[0]].sort((a, b) => a.day_index - b.day_index))
      }

      setCustomLabel('')
      setSelectedTopicId('custom')
      alert('Görev gelecek haftaya eklendi!')
    } catch (err) {
      alert('Görev eklenirken hata oluştu.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle deleting a future task
  const handleDeleteFutureTask = async (taskId: string) => {
    if (!isSupabaseConfigured) return
    
    // Optimistic update
    setNextWeekTasks(prev => prev.filter(t => t.id !== taskId))
    
    try {
      const { error } = await supabase.from('weekly_tasks').delete().eq('id', taskId)
      if (error) throw error
    } catch (err) {
      loadReviewData()
      alert('Görev silinemedi.')
    }
  }

  return (
    <section className="screen">
      <PageHeader title="Haftalık Görüşme" subtitle="Geçen haftanın değerlendirmesini yapın, kritik konuları gözden geçirin ve gelecek haftanın planını hazırlayın." />

      {!isSupabaseConfigured && (
        <div className="card" style={{ padding: 16, marginBottom: 20, background: 'var(--warning-bg)', border: 'none', color: 'var(--warning-text)' }}>
          Supabase bağlı değil — Lütfen Supabase yapılandırmasını tamamlayın.
        </div>
      )}

      {isSupabaseConfigured && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Student Selection */}
          <div className="field" style={{ maxWidth: 260 }}>
            <select value={selectedStudentId} onChange={(e) => handleStudentChange(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.full_name} ({s.track})</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>Yükleniyor…</div>
          ) : (
            /* 3 COLUMN DASHBOARD */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 20, alignItems: 'start' }}>
              
              {/* COLUMN 1: Last Week Review */}
              <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', fontWeight: 700, textTransform: 'uppercase' }}>Değerlendirme</span>
                  <h3 style={{ fontSize: 14.5, marginTop: 4 }}>Geçen Hafta Özeti</h3>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{fmtWeekRange(pastWeekMonday)}</div>
                </div>

                {/* Progress Stats */}
                <div style={{ display: 'flex', gap: 14, background: 'var(--surface-alt)', padding: 12, borderRadius: 10, border: '1px solid var(--border-soft)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--indigo-600)' }}>%{pastWeekStats.completionRate}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-faint)' }}>görev tamamlama</div>
                  </div>
                  <div style={{ borderLeft: '1px solid var(--border-soft)', paddingLeft: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {pastWeekStats.solvedCount} / {pastWeekStats.targetCount}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>hedef çözülen soru</div>
                  </div>
                </div>

                {/* Tasks List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                  {lastWeekTasks.length === 0 ? (
                    <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', textAlign: 'center', padding: 20 }}>Geçen hafta için görev tanımlanmamış.</p>
                  ) : (
                    lastWeekTasks.map(t => {
                      const topic = topics.find(tp => tp.id === t.topic_id)
                      return (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, opacity: t.completed ? 0.7 : 1 }}>
                          <CheckSquare size={14} color={t.completed ? 'var(--success)' : 'var(--ink-faint)'} />
                          <span style={{ textDecoration: t.completed ? 'line-through' : 'none', fontWeight: 500, flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {topic?.name || t.custom_label || 'Özel Görev'}
                          </span>
                          <span style={{ color: 'var(--ink-faint)', fontSize: 10 }}>({t.question_count} s.)</span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* COLUMN 2: Prioritized Topics (Focus Areas) */}
              <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', fontWeight: 700, textTransform: 'uppercase' }}>Odak Noktası</span>
                  <h3 style={{ fontSize: 14.5, marginTop: 4 }}>Kritik Seviyedeki Konular</h3>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>Koç kararı ile onaylanan odak konular.</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 370, overflowY: 'auto' }}>
                  {decisions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 30, color: 'var(--success)', fontWeight: 500, fontSize: 12.5 }}>
                      <CheckCircle2 size={24} style={{ display: 'block', margin: '0 auto 8px', color: 'var(--success)' }} />
                      Harika! Kritik durumda konu bulunmuyor.
                    </div>
                  ) : (
                    decisions.map(dec => {
                      const topic = topics.find(t => t.id === dec.topic_id)
                      if (!topic) return null
                      
                      return (
                        <div key={dec.id} style={{ padding: 12, background: 'var(--critical-bg)', border: '1px solid var(--border-soft)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ minWidth: 0, paddingRight: 8 }}>
                            <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--critical-text)' }}>{topic.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 2 }}>{topic.subjects?.name}</div>
                            {dec.note && <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 4, fontStyle: 'italic' }}>"{dec.note}"</div>}
                          </div>
                          <ChevronRight size={14} color="var(--critical-text)" />
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* COLUMN 3: Task Assignment for next week */}
              <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', fontWeight: 700, textTransform: 'uppercase' }}>Planlama</span>
                  <h3 style={{ fontSize: 14.5, marginTop: 4 }}>Gelecek Hafta Planı</h3>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>Gelecek Hafta: {fmtWeekRange(nextWeekMonday)}</div>
                </div>

                {/* Inline Assignment Form */}
                <form onSubmit={handleAssignTask} style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface-alt)', padding: 12, borderRadius: 10, border: '1px solid var(--border-soft)' }}>
                  <div className="field">
                    <label style={{ fontSize: 10.5 }}>Konu Seçin</label>
                    <select value={selectedTopicId} onChange={e => setSelectedTopicId(e.target.value)} style={{ padding: 6, fontSize: 12 }}>
                      <option value="custom">Özel Görev (Serbest Metin)</option>
                      {topics.map(t => (
                        <option key={t.id} value={t.id}>{t.subjects?.name}: {t.name}</option>
                      ))}
                    </select>
                  </div>

                  {selectedTopicId === 'custom' && (
                    <div className="field">
                      <label style={{ fontSize: 10.5 }}>Görev Açıklaması</label>
                      <input type="text" placeholder="Örn: Limit Fasikülü Bitirme" value={customLabel} onChange={e => setCustomLabel(e.target.value)} style={{ padding: 6, fontSize: 12 }} />
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div className="field">
                      <label style={{ fontSize: 10.5 }}>Soru Sayısı</label>
                      <input type="number" value={questionCount} onChange={e => setQuestionCount(parseInt(e.target.value) || 0)} style={{ padding: 6, fontSize: 12 }} />
                    </div>
                    <div className="field">
                      <label style={{ fontSize: 10.5 }}>Gün</label>
                      <select value={dayIndex} onChange={e => setDayIndex(parseInt(e.target.value))} style={{ padding: 6, fontSize: 12 }}>
                        <option value="0">Pazartesi</option>
                        <option value="1">Salı</option>
                        <option value="2">Çarşamba</option>
                        <option value="3">Perşembe</option>
                        <option value="4">Cuma</option>
                        <option value="5">Cumartesi</option>
                        <option value="6">Pazar</option>
                      </select>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 4, justifyContent: 'center' }} disabled={submitting}>
                    <Plus size={13} /> {submitting ? 'Ekleniyor…' : 'Gelecek Haftaya Ata'}
                  </button>
                </form>

                {/* Next Week Tasks list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 2 }}>Atanan Gelecek Hafta Görevleri ({nextWeekTasks.length})</div>
                  {nextWeekTasks.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--ink-faint)', textAlign: 'center', padding: 10 }}>Henüz görev atanmadı.</p>
                  ) : (
                    nextWeekTasks.map(t => {
                      const topic = topics.find(tp => tp.id === t.topic_id)
                      const dayNameShort = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][t.day_index]
                      return (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', border: '1px solid var(--border-soft)', borderRadius: 6, background: 'var(--surface)', fontSize: 11.5 }}>
                          <span style={{ fontWeight: 700, color: 'var(--indigo-600)', marginRight: 6 }}>{dayNameShort}</span>
                          <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 500 }} title={topic?.name || t.custom_label || ''}>
                            {topic?.name || t.custom_label || 'Özel Görev'}
                          </span>
                          <span style={{ color: 'var(--ink-faint)', fontSize: 10, paddingRight: 6 }}>({t.question_count} s.)</span>
                          <button 
                            type="button" 
                            onClick={() => handleDeleteFutureTask(t.id)} 
                            style={{ border: 'none', background: 'none', padding: 2, color: 'var(--critical)', cursor: 'pointer' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </section>
  )
}
