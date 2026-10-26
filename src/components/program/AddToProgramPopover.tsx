import { useState, useEffect, useMemo } from 'react'
import { X, Calendar, Plus, Check } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { mondayOf, weekKey, DAYS, DAYS_SHORT } from '../../lib/weeks'
import { topicAppliesTo } from '../../lib/curriculum'
import type { TaskType, TaskOriginKind, Topic, Subject, Student } from '../../types/database'

export interface AddToProgramPopoverProps {
  studentId: string
  studentName?: string
  examTopicId?: number | null
  examTopicName?: string | null
  topicId?: number | null
  originKind: TaskOriginKind
  suggestedType?: TaskType
  onClose: () => void
  onSuccess?: (addedCount: number) => void
}

const TASK_TYPE_CONFIG: Record<TaskType, { label: string; bg: string; color: string; border: string }> = {
  konu: {
    label: 'Konu',
    bg: 'var(--measured-bg)',
    color: 'var(--measured-text)',
    border: 'color-mix(in srgb, var(--measured-text) 25%, transparent)',
  },
  tekrar: {
    label: 'Tekrar',
    bg: 'var(--teal-bg)',
    color: 'var(--teal-text)',
    border: 'color-mix(in srgb, var(--teal-text) 25%, transparent)',
  },
  rutin: {
    label: 'Rutin',
    bg: 'var(--success-bg)',
    color: 'var(--success-text)',
    border: 'color-mix(in srgb, var(--success-text) 25%, transparent)',
  },
  sureli_test: {
    label: 'Süreli Test',
    bg: 'var(--warning-bg)',
    color: 'var(--warning-text)',
    border: 'color-mix(in srgb, var(--warning-text) 25%, transparent)',
  },
  deneme: {
    label: 'Deneme',
    bg: 'var(--plum-bg)',
    color: 'var(--plum-text)',
    border: 'color-mix(in srgb, var(--plum-text) 25%, transparent)',
  },
}

const ALL_TASK_TYPES: TaskType[] = ['konu', 'tekrar', 'rutin', 'sureli_test', 'deneme']

export default function AddToProgramPopover({
  studentId,
  studentName,
  examTopicId,
  examTopicName,
  topicId,
  originKind,
  suggestedType,
  onClose,
  onSuccess,
}: AddToProgramPopoverProps) {
  // Topic options state
  const [allTopics, setAllTopics] = useState<Array<Topic & { subjects: Subject | null }>>([])
  const [studentGrade, setStudentGrade] = useState<Student['grade'] | null>(null)
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(topicId ?? null)
  const [linkedTopicIds, setLinkedTopicIds] = useState<number[]>([])
  const [loadingLinks, setLoadingLinks] = useState(false)

  // Week selection: 'this_week' | 'next_week'
  const [weekTarget, setWeekTarget] = useState<'this_week' | 'next_week'>('this_week')

  // Multiple Day Selection: array of dayIndex (0..6)
  // Default to tomorrow or today
  const defaultDay = useMemo(() => {
    const todayJs = new Date().getDay()
    const isoDay = todayJs === 0 ? 6 : todayJs - 1
    return [Math.min(6, isoDay + 1)] // yarın
  }, [])
  const [selectedDays, setSelectedDays] = useState<number[]>(defaultDay)

  // Questions per session
  const [questionCount, setQuestionCount] = useState<number>(40)

  // Task type
  const [taskType, setTaskType] = useState<TaskType>(
    suggestedType || (originKind === 'deneme_analizi' ? 'sureli_test' : originKind === 'konu_haritasi' ? 'tekrar' : 'konu')
  )

  // Source field
  const [source, setSource] = useState('')
  const [recentSources, setRecentSources] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load curriculum topics and recent sources
  useEffect(() => {
    if (!isSupabaseConfigured) return

    supabase
      .from('students')
      .select('grade')
      .eq('id', studentId)
      .maybeSingle()
      .then(({ data }) => setStudentGrade(data?.grade ?? null))

    supabase
      .from('topics')
      .select('*, subjects(*)')
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (data) setAllTopics(data as any)
      })

    supabase
      .from('weekly_tasks')
      .select('source')
      .eq('student_id', studentId)
      .not('source', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          const unique = Array.from(
            new Set(
              data
                .map((d: any) => (d.source ? String(d.source).trim() : ''))
                .filter((s: string) => Boolean(s && s.length > 0))
            )
          ).slice(0, 5)
          setRecentSources(unique)
        }
      })
  }, [studentId])

  // If examTopicId is provided, resolve primary linked curriculum topic from exam_topic_links
  useEffect(() => {
    if (!examTopicId || !isSupabaseConfigured) return

    const loadLinks = async () => {
      setLoadingLinks(true)
      try {
        const { data } = await supabase
          .from('exam_topic_links')
          .select('topic_id, is_primary')
          .eq('exam_topic_id', examTopicId)

        if (data && data.length > 0) {
          const ids = data.map((d: any) => d.topic_id)
          setLinkedTopicIds(ids)
          // Primary topic first
          const primary = data.find((d: any) => d.is_primary)
          if (primary) {
            setSelectedTopicId(primary.topic_id)
          } else if (ids.length > 0) {
            setSelectedTopicId((prev) => (prev === null ? ids[0] : prev))
          }
        }
      } finally {
        setLoadingLinks(false)
      }
    }

    loadLinks()
  }, [examTopicId])

  // Toggle day selection
  const toggleDay = (dayIdx: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayIdx)
        ? (prev.length > 1 ? prev.filter((d) => d !== dayIdx) : prev) // En az 1 gün seçili kalsın
        : [...prev, dayIdx].sort((a, b) => a - b)
    )
  }

  // Selected topic object
  const currentTopic = useMemo(() => {
    return allTopics.find((t) => t.id === selectedTopicId)
  }, [allTopics, selectedTopicId])

  // Öğrencinin müfredatına ait konular (YKS öğrencisine LGS konusu çıkmasın). Tek kaynak: curriculum.ts
  const visibleTopics = useMemo(
    () => (studentGrade ? allTopics.filter((t) => t.subjects && topicAppliesTo(t, t.subjects, studentGrade)) : allTopics),
    [allTopics, studentGrade],
  )

  // Total questions across days
  const totalQuestions = selectedDays.length * (questionCount || 0)

  // Target week Monday
  const targetMonday = useMemo(() => {
    const thisMon = mondayOf(new Date())
    if (weekTarget === 'this_week') return thisMon
    return new Date(thisMon.getTime() + 7 * 86400000)
  }, [weekTarget])

  const weekLabel = weekTarget === 'this_week' ? 'Bu Hafta' : 'Gelecek Hafta'

  const handleSave = async () => {
    if (!isSupabaseConfigured) return
    if (!selectedTopicId) {
      setError('Lütfen bir müfredat konusu seçin.')
      return
    }
    if (selectedDays.length === 0) {
      setError('Lütfen en az bir gün seçin.')
      return
    }
    if (!questionCount || questionCount <= 0) {
      setError('Lütfen geçerli bir soru sayısı girin.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const weekStartStr = weekKey(targetMonday)
      const trimmedSource = source.trim() || null

      // Supabase-js null tuzağına karşı tüm satırlarda TAM OLARAK AYNI anahtarlar bulunur.
      const rows = selectedDays.map((dayIdx) => ({
        student_id: studentId,
        week_start: weekStartStr,
        day_index: dayIdx,
        topic_id: selectedTopicId,
        custom_label: null,
        question_count: questionCount,
        is_exam: taskType === 'deneme',
        task_type: taskType,
        source: trimmedSource,
        origin_kind: originKind,
        origin_exam_topic_id: examTopicId ?? null,
        completed: false,
        correct_count: null,
        wrong_count: null,
        blank_count: null,
        completed_at: null,
      }))

      const { data, error: insertError } = await supabase
        .from('weekly_tasks')
        .insert(rows)
        .select()

      if (insertError) throw insertError

      if (onSuccess) {
        onSuccess(data ? data.length : rows.length)
      }
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Görevler programa eklenemedi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 100 }}>
      <div
        className="modal-panel card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440, width: '92%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} style={{ color: 'var(--brand, #0D9488)' }} /> Programa Ekle
            </h3>
            <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', margin: '2px 0 0 0' }}>
              {studentName ? `${studentName} için haftalık plana görev ekle` : 'Haftalık plana görev ekle'}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 12, fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Müfredat Konusu Seçimi */}
          <div className="field">
            <label style={{ fontSize: 11, fontWeight: 700 }}>
              Bağlanacak Müfredat Konusu
              {examTopicName && (
                <span style={{ fontWeight: 400, color: 'var(--ink-soft)', marginLeft: 4 }}>
                  (Deneme konusu: <strong>{examTopicName}</strong>)
                </span>
              )}
            </label>
            <select
              value={selectedTopicId ?? ''}
              onChange={(e) => setSelectedTopicId(e.target.value ? Number(e.target.value) : null)}
              style={{ padding: '8px 10px', fontSize: 12.5 }}
            >
              <option value="" disabled>
                {loadingLinks ? 'Eşleşen konular yükleniyor…' : 'Konu seçin'}
              </option>
              {/* Varsa eşleşen (linked) konular önce listelenir */}
              {linkedTopicIds.length > 0 && (
                <optgroup label="Eşleşen Müfredat Konuları (Önerilen)">
                  {visibleTopics
                    .filter((t) => linkedTopicIds.includes(t.id))
                    .map((t) => (
                      <option key={`linked-${t.id}`} value={t.id}>
                        ★ {t.name} ({t.subjects?.name || 'Ders'})
                      </option>
                    ))}
                </optgroup>
              )}
              <optgroup label="Tüm Müfredat Konuları">
                {visibleTopics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.subjects?.name || 'Ders'})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Hafta Seçimi */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700 }}>Hedef Hafta</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button
                type="button"
                onClick={() => setWeekTarget('this_week')}
                style={{
                  padding: '7px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: weekTarget === 'this_week' ? 700 : 500,
                  border: weekTarget === 'this_week' ? '1px solid var(--brand, #0D9488)' : '1px solid var(--border)',
                  background: weekTarget === 'this_week' ? 'var(--brand-surface, rgba(13, 148, 136, 0.12))' : 'var(--surface)',
                  color: weekTarget === 'this_week' ? 'var(--brand, #0D9488)' : 'var(--ink-soft)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Calendar size={13} /> Bu Hafta
              </button>
              <button
                type="button"
                onClick={() => setWeekTarget('next_week')}
                style={{
                  padding: '7px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: weekTarget === 'next_week' ? 700 : 500,
                  border: weekTarget === 'next_week' ? '1px solid var(--brand, #0D9488)' : '1px solid var(--border)',
                  background: weekTarget === 'next_week' ? 'var(--brand-surface, rgba(13, 148, 136, 0.12))' : 'var(--surface)',
                  color: weekTarget === 'next_week' ? 'var(--brand, #0D9488)' : 'var(--ink-soft)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Calendar size={13} /> Gelecek Hafta
              </button>
            </div>
          </div>

          {/* Gün Seçimi (Çoklu; Her gün = bir görev) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
              <span>Gün Seçimi (Her gün = ayrı bir görev)</span>
              <span style={{ fontWeight: 500, color: 'var(--brand, #0D9488)' }}>{selectedDays.length} gün seçili</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {DAYS.map((dayName, idx) => {
                const isSelected = selectedDays.includes(idx)
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    style={{
                      padding: '8px 2px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: isSelected ? 700 : 500,
                      border: isSelected ? '1px solid var(--brand, #0D9488)' : '1px solid var(--border)',
                      background: isSelected ? 'var(--brand, #0D9488)' : 'var(--surface-alt)',
                      color: isSelected ? '#fff' : 'var(--ink-soft)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                    title={dayName}
                  >
                    <span>{DAYS_SHORT[idx]}</span>
                    {isSelected && <Check size={10} />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Görev Türü Seçici */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700 }}>Görev Türü</label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 3,
                background: 'var(--surface)',
                padding: 2,
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}
            >
              {ALL_TASK_TYPES.map((tt) => {
                const cfg = TASK_TYPE_CONFIG[tt]
                const isSel = taskType === tt
                return (
                  <button
                    key={tt}
                    type="button"
                    onClick={() => setTaskType(tt)}
                    style={{
                      padding: '5px 2px',
                      fontSize: 10.5,
                      fontWeight: isSel ? 700 : 500,
                      border: isSel ? `1px solid ${cfg.border}` : '1px solid transparent',
                      borderRadius: 6,
                      background: isSel ? cfg.bg : 'transparent',
                      color: isSel ? cfg.color : 'var(--ink-soft)',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Soru / Oturum Sayısı & Kaynak */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 10 }}>
            <div className="field">
              <label style={{ fontSize: 11, fontWeight: 700 }}>Soru / Oturum</label>
              <input
                type="number"
                min="5"
                step="5"
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value, 10) || 0)}
                style={{ padding: '7px 10px', fontSize: 12.5 }}
              />
            </div>
            <div className="field">
              <label style={{ fontSize: 11, fontWeight: 700 }}>
                Kaynak <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(opsiyonel)</span>
              </label>
              <input
                type="text"
                list="add-popover-sources"
                placeholder="Örn: 3D AYT, Apotemi"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                style={{ padding: '7px 10px', fontSize: 12.5 }}
              />
              <datalist id="add-popover-sources">
                {recentSources.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Alt Satır Özet Bilgisi */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--surface-alt)',
              border: '1px solid var(--border-soft)',
              fontSize: 12,
              color: 'var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>
              <strong>{weekLabel}</strong> {currentTopic ? `"${currentTopic.name}"` : 'seçilen konuya'}{' '}
              toplam <strong>{totalQuestions} soru</strong> ({selectedDays.length} gün) ekleniyor.
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={onClose}
              disabled={saving}
            >
              İptal
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1.8, justifyContent: 'center' }}
              onClick={handleSave}
              disabled={saving || !selectedTopicId || selectedDays.length === 0}
            >
              {saving ? 'Ekleniyor…' : `Programa Ekle (${selectedDays.length} Görev)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
