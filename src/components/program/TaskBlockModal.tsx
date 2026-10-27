import React, { useState, useEffect, useMemo, useRef } from 'react'
import { X, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { weekKey, DAYS_SHORT } from '../../lib/weeks'
import { gradeCurriculum, subjectAppliesTo, topicAppliesTo, subjectExamGroup } from '../../lib/curriculum'
import type { TaskType, BlockKind, Topic, Subject, Student, WeeklyTask } from '../../types/database'

export interface TaskBlockModalProps {
  isOpen: boolean
  onClose: () => void
  student: Student
  currentMonday: Date
  initialDayIndex?: number
  initialStartTime?: string | null
  existingTasks: WeeklyTask[]
  subjects: Subject[]
  topics: (Topic & { subjects: Subject | null })[]
  editingTask?: WeeklyTask | null
  onSuccess: (newOrUpdatedTasks: WeeklyTask[]) => void
  recentSources?: string[]
}

export const TASK_TYPE_CONFIG: Record<TaskType, { label: string; bg: string; color: string; border: string }> = {
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

const MONTHS_TR_SHORT = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'
]

// Zaman yardımcıları
export function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':')
  const h = parseInt(parts[0], 10) || 0
  const m = parseInt(parts[1], 10) || 0
  return h * 60 + m
}

export function minutesToTime(minutes: number): string {
  const total = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function addMinutesToTime(timeStr: string, mins: number): string {
  return minutesToTime(timeToMinutes(timeStr) + mins)
}

export function formatTimeShort(t?: string | null): string {
  if (!t) return ''
  return t.slice(0, 5)
}

export default function TaskBlockModal({
  isOpen,
  onClose,
  student,
  currentMonday,
  initialDayIndex = 0,
  initialStartTime = null,
  existingTasks,
  subjects,
  topics,
  editingTask = null,
  onSuccess,
  recentSources = [],
}: TaskBlockModalProps) {
  const isEditing = Boolean(editingTask)
  const isLgs = gradeCurriculum(student.grade) === 'LGS'

  // Block kind: 'ders' | 'mola' | 'serbest'
  const [blockKind, setBlockKind] = useState<BlockKind>(() => {
    if (editingTask?.block_kind) return editingTask.block_kind
    return 'ders'
  })

  // Sınav grubu: TYT vs AYT (LGS'de yok)
  const [examGroup, setExamGroup] = useState<'TYT' | 'AYT'>('TYT')

  // Ders & Konu state
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null)
  const [subjectQuery, setSubjectQuery] = useState('')
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)
  const [topicQuery, setTopicQuery] = useState('')
  const [customLabel, setCustomLabel] = useState('')

  // Ders detayları
  const [taskType, setTaskType] = useState<TaskType>('konu')
  const [durationMin, setDurationMin] = useState<number>(40)
  const [customDurationInput, setCustomDurationInput] = useState('')
  const [questionCount, setQuestionCount] = useState<number>(0)
  const [taskSource, setTaskSource] = useState('')
  const [showDetailFields, setShowDetailFields] = useState(false)

  // Mola & Serbest detayları
  const [molaNote, setMolaNote] = useState('')
  const [activityName, setActivityName] = useState('')

  // Sağ sütun: Günler ve Saatler
  const [selectedDays, setSelectedDays] = useState<number[]>([initialDayIndex])
  const [selectedHours, setSelectedHours] = useState<string[]>(() => {
    if (initialStartTime) return [formatTimeShort(initialStartTime)]
    return []
  })
  const [newHourInput, setNewHourInput] = useState('')
  const [frequentHours, setFrequentHours] = useState<string[]>([])

  // Modal genel durum
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Input & Dropdown refs
  const subjectDropdownRef = useRef<HTMLDivElement>(null)
  const [showSubjectMenu, setShowSubjectMenu] = useState(false)
  const topicDropdownRef = useRef<HTMLDivElement>(null)
  const [showTopicMenu, setShowTopicMenu] = useState(false)

  // Sık kullanılan saatleri son 8 haftadan çek
  useEffect(() => {
    if (!isOpen || !student?.id || !isSupabaseConfigured) return

    const eightWeeksAgo = new Date(Date.now() - 56 * 86400000).toISOString().split('T')[0]
    supabase
      .from('weekly_tasks')
      .select('start_time')
      .eq('student_id', student.id)
      .gte('week_start', eightWeeksAgo)
      .not('start_time', 'is', null)
      .order('id')
      .range(0, 999)
      .then(({ data }) => {
        if (!data || data.length === 0) return
        const countMap: Record<string, number> = {}
        for (const row of data) {
          if (row.start_time) {
            const h = formatTimeShort(row.start_time)
            countMap[h] = (countMap[h] || 0) + 1
          }
        }
        const top3 = Object.entries(countMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([h]) => h)
          .sort()
        setFrequentHours(top3)
      })
  }, [isOpen, student?.id])

  // Initial state / Editing setup
  useEffect(() => {
    if (!isOpen) return

    if (editingTask) {
      setBlockKind(editingTask.block_kind || 'ders')
      setSelectedDays([editingTask.day_index])
      setSelectedHours(editingTask.start_time ? [formatTimeShort(editingTask.start_time)] : [])
      setDurationMin(editingTask.duration_min || 40)
      setCustomDurationInput('')
      setTaskType(editingTask.task_type || (editingTask.is_exam ? 'deneme' : 'konu'))
      setQuestionCount(editingTask.question_count || 0)
      setTaskSource(editingTask.source || '')
      setShowDetailFields(Boolean(editingTask.question_count || editingTask.source))

      if (editingTask.block_kind === 'mola') {
        setMolaNote(editingTask.custom_label && editingTask.custom_label !== 'Mola' ? editingTask.custom_label : '')
      } else if (editingTask.block_kind === 'serbest') {
        setActivityName(editingTask.custom_label || '')
      } else {
        // Ders
        if (editingTask.topic_id) {
          const t = topics.find((item) => item.id === editingTask.topic_id)
          if (t) {
            setSelectedTopicId(t.id)
            setTopicQuery(t.name)
            if (t.subject_id) {
              setSelectedSubjectId(t.subject_id)
              const s = subjects.find((sb) => sb.id === t.subject_id)
              if (s) {
                setSubjectQuery(s.name)
                if (!isLgs) setExamGroup(subjectExamGroup(s))
              }
            }
          }
        } else if (editingTask.subject_id) {
          setSelectedSubjectId(editingTask.subject_id)
          const s = subjects.find((sb) => sb.id === editingTask.subject_id)
          if (s) {
            setSubjectQuery(s.name)
            if (!isLgs) setExamGroup(subjectExamGroup(s))
          }
          setSelectedTopicId(null)
          setTopicQuery('')
        } else {
          setSelectedSubjectId(null)
          setSubjectQuery(editingTask.custom_label || '')
          setCustomLabel(editingTask.custom_label || '')
        }
      }
    } else {
      // Ekleme modu sıfırlama
      setBlockKind('ders')
      setSelectedDays([initialDayIndex])
      setSelectedHours(initialStartTime ? [formatTimeShort(initialStartTime)] : [])
      setDurationMin(40)
      setCustomDurationInput('')
      setTaskType('konu')
      setQuestionCount(0)
      setTaskSource('')
      setShowDetailFields(false)
      setMolaNote('')
      setActivityName('')
      setSelectedSubjectId(null)
      setSubjectQuery('')
      setSelectedTopicId(null)
      setTopicQuery('')
      setCustomLabel('')
      setErrorMessage(null)
      setExamGroup('TYT')
    }
  }, [isOpen, editingTask, initialDayIndex, initialStartTime, subjects, topics, isLgs])

  // ESC ile kapatma
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Dışa tıklama ile dropdown kapatma
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (subjectDropdownRef.current && !subjectDropdownRef.current.contains(event.target as Node)) {
        setShowSubjectMenu(false)
      }
      if (topicDropdownRef.current && !topicDropdownRef.current.contains(event.target as Node)) {
        setShowTopicMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Sınav grubuna ve öğrenci sınıfına göre süzülmüş dersler
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      if (!subjectAppliesTo(s, student.grade)) return false
      if (isLgs) return true
      return subjectExamGroup(s) === examGroup
    })
  }, [subjects, student.grade, isLgs, examGroup])

  // Seçili derse ait konular (Türkçe-duyarsız arama)
  const filteredTopics = useMemo(() => {
    if (!selectedSubjectId) return []
    const s = subjects.find((sb) => sb.id === selectedSubjectId)
    if (!s) return []

    let list = topics.filter((t) => t.subject_id === selectedSubjectId && topicAppliesTo(t, s, student.grade))
    if (topicQuery.trim()) {
      const q = topicQuery.toLocaleLowerCase('tr-TR')
      list = list.filter((t) => t.name.toLocaleLowerCase('tr-TR').includes(q))
    }
    return list
  }, [topics, selectedSubjectId, subjects, student.grade, topicQuery])

  // Hızlı çip seçimi (Özel ders / Koçluk görüşmesi)
  const handleQuickChip = (title: string) => {
    setBlockKind('serbest')
    setActivityName(title)
    setDurationMin(60)
    setCustomDurationInput('')
  }

  // Gün seçimi toggle
  const toggleDay = (idx: number) => {
    if (isEditing) {
      setSelectedDays([idx])
      return
    }
    setSelectedDays((prev) => {
      if (prev.includes(idx)) {
        if (prev.length === 1) return prev // en az 1 gün seçili kalsın
        return prev.filter((d) => d !== idx).sort((a, b) => a - b)
      }
      return [...prev, idx].sort((a, b) => a - b)
    })
  }

  // Saat ekleme
  const handleAddHour = (hStr: string) => {
    const formatted = formatTimeShort(hStr)
    if (!formatted) return
    if (isEditing) {
      setSelectedHours([formatted])
      return
    }
    if (!selectedHours.includes(formatted)) {
      setSelectedHours((prev) => [...prev, formatted].sort())
    }
  }

  // Saat silme
  const handleRemoveHour = (hStr: string) => {
    setSelectedHours((prev) => prev.filter((h) => h !== hStr))
  }

  // "+ Ardından (HH:MM)" hesabı
  const nextHourSuggestion = useMemo(() => {
    if (selectedHours.length === 0 || !durationMin) return null
    const lastHour = selectedHours[selectedHours.length - 1]
    return addMinutesToTime(lastHour, durationMin)
  }, [selectedHours, durationMin])

  // Çakışma kontrolü
  const conflictWarnings = useMemo(() => {
    if (selectedHours.length === 0 || !durationMin) return []

    const warnings: string[] = []
    const newDur = durationMin

    for (const dIdx of selectedDays) {
      const dayTasks = existingTasks.filter(
        (t) => t.day_index === dIdx && t.start_time && (!editingTask || t.id !== editingTask.id)
      )

      for (const h of selectedHours) {
        const startA = timeToMinutes(h)
        const endA = startA + newDur

        for (const t of dayTasks) {
          const startB = timeToMinutes(t.start_time!)
          const durB = t.duration_min || 40
          const endB = startB + durB

          // Kesişme kontrolü
          if (startA < endB && startB < endA) {
            const dayName = DAYS_SHORT[dIdx]
            const endFormatted = minutesToTime(endA)
            const label = t.custom_label || (t.block_kind === 'mola' ? 'Mola' : 'Mevcut blok')
            warnings.push(`${dayName} ${h} – ${endFormatted} (${label} ile kesişiyor)`)
          }
        }
      }
    }

    return warnings
  }, [selectedDays, selectedHours, durationMin, existingTasks, editingTask])

  // Form doğrulama & Kaydet
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    // Doğrulamalar
    if (selectedDays.length === 0) {
      setErrorMessage('Lütfen en az bir gün seçin.')
      return
    }

    if (blockKind === 'mola') {
      if (selectedHours.length === 0) {
        setErrorMessage('Mola için en az bir saat seçin.')
        return
      }
    }

    if (blockKind === 'serbest') {
      if (!activityName.trim()) {
        setErrorMessage('Lütfen etkinlik adını girin.')
        return
      }
      if (!durationMin || durationMin <= 0) {
        setErrorMessage('Lütfen etkinlik süresini seçin.')
        return
      }
    }

    if (blockKind === 'ders') {
      const hasSubject = Boolean(selectedSubjectId)
      const hasCustomText = Boolean(subjectQuery.trim())
      if (!hasSubject && !hasCustomText) {
        setErrorMessage('Lütfen bir ders seçin veya özel görev açıklaması yazın.')
        return
      }
    }

    setSubmitting(true)
    try {
      const weekStartStr = weekKey(currentMonday)

      // Düzenleme modu: tek bir görevi güncelle
      if (isEditing && editingTask) {
        const dIdx = selectedDays[0] ?? editingTask.day_index
        const sTime = selectedHours[0] ? `${selectedHours[0]}:00` : null

        let payloadCustomLabel: string | null = null
        let payloadTopicId: number | null = null
        let payloadSubjectId: number | null = null
        let payloadTaskType: TaskType = 'rutin'
        let payloadQuestionCount = 0
        let payloadDuration = durationMin || null
        let payloadSource: string | null = null

        if (blockKind === 'ders') {
          payloadTopicId = selectedTopicId
          payloadSubjectId = selectedSubjectId
          payloadCustomLabel = selectedSubjectId ? (customLabel.trim() || null) : subjectQuery.trim()
          payloadTaskType = taskType
          payloadQuestionCount = questionCount || 0
          payloadSource = taskSource.trim() || null
        } else if (blockKind === 'mola') {
          payloadCustomLabel = molaNote.trim() || 'Mola'
          payloadDuration = durationMin || 10
        } else if (blockKind === 'serbest') {
          payloadCustomLabel = activityName.trim()
          payloadDuration = durationMin
        }

        const { data, error } = await supabase
          .from('weekly_tasks')
          .update({
            day_index: dIdx,
            start_time: sTime,
            block_kind: blockKind,
            topic_id: payloadTopicId,
            subject_id: payloadSubjectId,
            custom_label: payloadCustomLabel,
            question_count: payloadQuestionCount,
            duration_min: payloadDuration,
            task_type: payloadTaskType,
            source: payloadSource,
            is_exam: blockKind === 'ders' && payloadTaskType === 'deneme',
          })
          .eq('id', editingTask.id)
          .select()

        if (error) throw error
        if (data && data.length > 0) {
          onSuccess(data)
          onClose()
        }
        return
      }

      // Ekleme modu: Günler × Saatler toplu ekleme
      const hoursToUse = selectedHours.length > 0 ? selectedHours : [null]
      const rowsToInsert: any[] = []

      for (const dIdx of selectedDays) {
        for (const h of hoursToUse) {
          const sTime = h ? `${h}:00` : null

          let payloadCustomLabel: string | null = null
          let payloadTopicId: number | null = null
          let payloadSubjectId: number | null = null
          let payloadTaskType: TaskType = 'rutin'
          let payloadQuestionCount = 0
          let payloadDuration = durationMin || null
          let payloadSource: string | null = null

          if (blockKind === 'ders') {
            payloadTopicId = selectedTopicId
            payloadSubjectId = selectedSubjectId
            payloadCustomLabel = selectedSubjectId ? (customLabel.trim() || null) : subjectQuery.trim()
            payloadTaskType = taskType
            payloadQuestionCount = questionCount || 0
            payloadSource = taskSource.trim() || null
          } else if (blockKind === 'mola') {
            payloadCustomLabel = molaNote.trim() || 'Mola'
            payloadDuration = durationMin || 10
          } else if (blockKind === 'serbest') {
            payloadCustomLabel = activityName.trim()
            payloadDuration = durationMin
          }

          rowsToInsert.push({
            student_id: student.id,
            week_start: weekStartStr,
            day_index: dIdx,
            topic_id: payloadTopicId,
            subject_id: payloadSubjectId,
            custom_label: payloadCustomLabel,
            question_count: payloadQuestionCount,
            duration_min: payloadDuration,
            start_time: sTime,
            block_kind: blockKind,
            task_type: payloadTaskType,
            source: payloadSource,
            origin_kind: 'elle',
            is_exam: blockKind === 'ders' && payloadTaskType === 'deneme',
            completed: false,
          })
        }
      }

      const { data, error } = await supabase
        .from('weekly_tasks')
        .insert(rowsToInsert)
        .select()

      if (error) throw error
      if (data) {
        onSuccess(data)
        onClose()
      }
    } catch (err: any) {
      console.error('Görev ekleme hatası:', err)
      setErrorMessage(err.message || 'Görev kaydedilirken bir hata oluştu.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  // Başlık altındaki tarih & saat etiketi
  const firstSelectedDay = selectedDays[0] ?? initialDayIndex
  const headerDate = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + firstSelectedDay)
  const headerDateText = `${DAYS_SHORT[firstSelectedDay]} ${headerDate.getDate()} ${MONTHS_TR_SHORT[headerDate.getMonth()]}`
  const headerSubtitle = selectedHours.length > 0 ? `${headerDateText} · ${selectedHours[0]}` : headerDateText

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 760,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: 14,
          boxShadow: '0 20px 40px rgba(0,0,0,0.22)',
          background: 'var(--surface)',
        }}
      >
        {/* Üst Başlık */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-soft)',
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              {isEditing ? 'Görevi düzenle' : 'Görev ekle'}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>
              {headerSubtitle}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ padding: 6, borderRadius: 8 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Gövde (Kaydırılabilir) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {/* Bölmeli Düğme: Ders | Mola | Serbest */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--surface-alt)',
                padding: 3,
                borderRadius: 8,
                border: '1px solid var(--border-soft)',
                width: '100%',
                maxWidth: 360,
              }}
            >
              {(['ders', 'mola', 'serbest'] as const).map((kind) => {
                const isSel = blockKind === kind
                const label = kind === 'ders' ? 'Ders' : kind === 'mola' ? 'Mola' : 'Serbest'
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      setBlockKind(kind)
                      if (kind === 'mola') setDurationMin(10)
                      else if (kind === 'ders') setDurationMin(40)
                    }}
                    style={{
                      flex: 1,
                      padding: '7px 12px',
                      fontSize: 12.5,
                      fontWeight: isSel ? 700 : 500,
                      borderRadius: 6,
                      border: 'none',
                      background: isSel ? 'var(--surface)' : 'transparent',
                      color: isSel ? 'var(--indigo-600)' : 'var(--ink-soft)',
                      boxShadow: isSel ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Hızlı Çipler */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 600 }}>Bu saate:</span>
              <button
                type="button"
                onClick={() => handleQuickChip('Özel ders')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 14,
                  fontSize: 11.5,
                  fontWeight: 600,
                  border: '1px solid var(--border-soft)',
                  background: 'var(--surface-alt)',
                  color: 'var(--ink)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>🎓</span> Özel ders (60 dk)
              </button>
              <button
                type="button"
                onClick={() => handleQuickChip('Koçluk görüşmesi')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 14,
                  fontSize: 11.5,
                  fontWeight: 600,
                  border: '1px solid var(--border-soft)',
                  background: 'var(--surface-alt)',
                  color: 'var(--ink)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>🤝</span> Koçluk görüşmesi (60 dk)
              </button>
            </div>
          </div>

          {/* 2 Sütunlu Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
              gap: 22,
              marginTop: 16,
            }}
          >
            {/* SOL SÜTUN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* DERS FORMU */}
              {blockKind === 'ders' && (
                <>
                  {/* Sınav Grubu (YKS ise TYT | AYT) */}
                  {!isLgs && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 4, display: 'block' }}>
                        Sınav Grubu
                      </label>
                      <div
                        style={{
                          display: 'inline-flex',
                          background: 'var(--surface-alt)',
                          padding: 2,
                          borderRadius: 6,
                          border: '1px solid var(--border-soft)',
                        }}
                      >
                        {(['TYT', 'AYT'] as const).map((grp) => {
                          const isSel = examGroup === grp
                          return (
                            <button
                              key={grp}
                              type="button"
                              onClick={() => {
                                setExamGroup(grp)
                                setSelectedSubjectId(null)
                                setSubjectQuery('')
                                setSelectedTopicId(null)
                                setTopicQuery('')
                              }}
                              style={{
                                padding: '4px 14px',
                                fontSize: 11.5,
                                fontWeight: isSel ? 700 : 500,
                                borderRadius: 5,
                                border: 'none',
                                background: isSel ? 'var(--indigo-600)' : 'transparent',
                                color: isSel ? '#ffffff' : 'var(--ink-soft)',
                                cursor: 'pointer',
                              }}
                            >
                              {grp}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ders Seçimi / Yazma */}
                  <div style={{ position: 'relative' }} ref={subjectDropdownRef}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 4, display: 'block' }}>
                      {isLgs ? 'Ders' : `${examGroup} Dersi`}
                    </label>
                    <input
                      type="text"
                      placeholder={isLgs ? 'Ders seçin veya yazın…' : `${examGroup} dersi seçin veya yazın…`}
                      value={subjectQuery}
                      onChange={(e) => {
                        setSubjectQuery(e.target.value)
                        setShowSubjectMenu(true)
                        const exact = filteredSubjects.find(
                          (s) => s.name.toLocaleLowerCase('tr-TR') === e.target.value.trim().toLocaleLowerCase('tr-TR')
                        )
                        if (exact) {
                          setSelectedSubjectId(exact.id)
                          setSelectedTopicId(null)
                          setTopicQuery('')
                        } else {
                          setSelectedSubjectId(null)
                          setSelectedTopicId(null)
                        }
                      }}
                      onFocus={() => setShowSubjectMenu(true)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: 12.5,
                        borderRadius: 7,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--ink)',
                      }}
                    />

                    {/* Ders Öneri Menüsü */}
                    {showSubjectMenu && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 50,
                          marginTop: 4,
                          background: 'var(--surface)',
                          border: '1px solid var(--border-soft)',
                          borderRadius: 8,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                          maxHeight: 180,
                          overflowY: 'auto',
                        }}
                      >
                        {filteredSubjects
                          .filter((s) => !subjectQuery || s.name.toLocaleLowerCase('tr-TR').includes(subjectQuery.toLocaleLowerCase('tr-TR')))
                          .map((s) => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setSelectedSubjectId(s.id)
                                setSubjectQuery(s.name)
                                setSelectedTopicId(null)
                                setTopicQuery('')
                                setShowSubjectMenu(false)
                              }}
                              style={{
                                padding: '8px 12px',
                                fontSize: 12,
                                cursor: 'pointer',
                                background: selectedSubjectId === s.id ? 'var(--surface-alt)' : 'transparent',
                                borderBottom: '1px solid var(--border-subtle)',
                              }}
                            >
                              {s.name}
                            </div>
                          ))}
                        {filteredSubjects.length === 0 && (
                          <div style={{ padding: 10, fontSize: 11.5, color: 'var(--ink-faint)', textAlign: 'center' }}>
                            Kayıtlı ders bulunamadı. Yazılan metin özel görev olarak kaydedilir.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Konu Kutusu (Opsiyonel) */}
                  {selectedSubjectId && (
                    <div style={{ position: 'relative' }} ref={topicDropdownRef}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 4, display: 'block' }}>
                        Konu <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(opsiyonel)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Konu seçin veya arayın (opsiyonel)"
                        value={topicQuery}
                        onChange={(e) => {
                          setTopicQuery(e.target.value)
                          setShowTopicMenu(true)
                          const exact = filteredTopics.find(
                            (t) => t.name.toLocaleLowerCase('tr-TR') === e.target.value.trim().toLocaleLowerCase('tr-TR')
                          )
                          if (exact) {
                            setSelectedTopicId(exact.id)
                          } else {
                            setSelectedTopicId(null)
                          }
                        }}
                        onFocus={() => setShowTopicMenu(true)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          fontSize: 12.5,
                          borderRadius: 7,
                          border: '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--ink)',
                        }}
                      />

                      {/* Konu Öneri Menüsü */}
                      {showTopicMenu && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 50,
                            marginTop: 4,
                            background: 'var(--surface)',
                            border: '1px solid var(--border-soft)',
                            borderRadius: 8,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                            maxHeight: 180,
                            overflowY: 'auto',
                          }}
                        >
                          <div
                            onClick={() => {
                              setSelectedTopicId(null)
                              setTopicQuery('')
                              setShowTopicMenu(false)
                            }}
                            style={{
                              padding: '8px 12px',
                              fontSize: 11.5,
                              color: 'var(--ink-faint)',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border-subtle)',
                              fontStyle: 'italic',
                            }}
                          >
                            (Konu seçme — genel ders çalışması)
                          </div>
                          {filteredTopics.map((t) => (
                            <div
                              key={t.id}
                              onClick={() => {
                                setSelectedTopicId(t.id)
                                setTopicQuery(t.name)
                                setShowTopicMenu(false)
                              }}
                              style={{
                                padding: '8px 12px',
                                fontSize: 12,
                                cursor: 'pointer',
                                background: selectedTopicId === t.id ? 'var(--surface-alt)' : 'transparent',
                                borderBottom: '1px solid var(--border-subtle)',
                              }}
                            >
                              {t.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tip Çipleri: Konu, Tekrar, Rutin, Süreli Test, Deneme */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 5, display: 'block' }}>
                      Görev Türü
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {ALL_TASK_TYPES.map((tt) => {
                        const cfg = TASK_TYPE_CONFIG[tt]
                        const isSel = taskType === tt
                        return (
                          <button
                            key={tt}
                            type="button"
                            onClick={() => setTaskType(tt)}
                            style={{
                              padding: '5px 10px',
                              fontSize: 11.5,
                              fontWeight: isSel ? 700 : 500,
                              borderRadius: 6,
                              border: isSel ? `1px solid ${cfg.border}` : '1px solid var(--border-soft)',
                              background: isSel ? cfg.bg : 'var(--surface)',
                              color: isSel ? cfg.color : 'var(--ink-soft)',
                              cursor: 'pointer',
                            }}
                          >
                            {cfg.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Süre Çipleri: 30 / 40 / 50 / 60 ve "Diğer dk" */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 5, display: 'block' }}>
                      Süre (dk)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {[30, 40, 50, 60].map((dur) => {
                        const isSel = durationMin === dur && customDurationInput === ''
                        return (
                          <button
                            key={dur}
                            type="button"
                            onClick={() => {
                              setDurationMin(dur)
                              setCustomDurationInput('')
                            }}
                            style={{
                              padding: '5px 12px',
                              fontSize: 11.5,
                              fontWeight: isSel ? 700 : 500,
                              borderRadius: 6,
                              border: isSel ? '1px solid var(--indigo-600)' : '1px solid var(--border-soft)',
                              background: isSel ? 'var(--indigo-050)' : 'var(--surface)',
                              color: isSel ? 'var(--indigo-600)' : 'var(--ink)',
                              cursor: 'pointer',
                            }}
                          >
                            {dur} dk
                          </button>
                        )
                      })}
                      <input
                        type="number"
                        placeholder="Diğer dk"
                        min="5"
                        value={customDurationInput}
                        onChange={(e) => {
                          setCustomDurationInput(e.target.value)
                          const parsed = parseInt(e.target.value, 10)
                          if (!isNaN(parsed) && parsed > 0) {
                            setDurationMin(parsed)
                          }
                        }}
                        style={{
                          width: 80,
                          padding: '5px 8px',
                          fontSize: 11.5,
                          borderRadius: 6,
                          border: customDurationInput !== '' ? '1px solid var(--indigo-600)' : '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--ink)',
                        }}
                      />
                    </div>
                  </div>

                  {/* "+ Detay ekle" (Soru sayısı ve Kaynak) */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowDetailFields(!showDetailFields)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--indigo-600)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {showDetailFields ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {showDetailFields ? 'Detayları gizle' : '+ Detay ekle (Soru, Kaynak)'}
                    </button>

                    {showDetailFields && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: 12,
                          background: 'var(--surface-alt)',
                          borderRadius: 8,
                          border: '1px solid var(--border-soft)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 4, display: 'block' }}>
                            Soru Sayısı <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(boşsa 0)</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={questionCount || ''}
                            onChange={(e) => setQuestionCount(parseInt(e.target.value, 10) || 0)}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              fontSize: 12,
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              color: 'var(--ink)',
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 4, display: 'block' }}>
                            Kaynak
                          </label>
                          <input
                            type="text"
                            list="task-sources"
                            placeholder="Örn: 3D AYT, Apotemi..."
                            value={taskSource}
                            onChange={(e) => setTaskSource(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              fontSize: 12,
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              color: 'var(--ink)',
                            }}
                          />
                          <datalist id="task-sources">
                            {recentSources.map((s, idx) => (
                              <option key={idx} value={s} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* MOLA FORMU */}
              {blockKind === 'mola' && (
                <>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 5, display: 'block' }}>
                      Mola Süresi (dk)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {[5, 10, 15, 20, 30, 45, 60].map((dur) => {
                        const isSel = durationMin === dur && customDurationInput === ''
                        return (
                          <button
                            key={dur}
                            type="button"
                            onClick={() => {
                              setDurationMin(dur)
                              setCustomDurationInput('')
                            }}
                            style={{
                              padding: '5px 10px',
                              fontSize: 11.5,
                              fontWeight: isSel ? 700 : 500,
                              borderRadius: 6,
                              border: isSel ? '1px solid var(--indigo-600)' : '1px solid var(--border-soft)',
                              background: isSel ? 'var(--indigo-050)' : 'var(--surface)',
                              color: isSel ? 'var(--indigo-600)' : 'var(--ink)',
                              cursor: 'pointer',
                            }}
                          >
                            {dur} dk
                          </button>
                        )
                      })}
                      <input
                        type="number"
                        placeholder="Diğer dk"
                        min="1"
                        value={customDurationInput}
                        onChange={(e) => {
                          setCustomDurationInput(e.target.value)
                          const parsed = parseInt(e.target.value, 10)
                          if (!isNaN(parsed) && parsed > 0) setDurationMin(parsed)
                        }}
                        style={{
                          width: 80,
                          padding: '5px 8px',
                          fontSize: 11.5,
                          borderRadius: 6,
                          border: customDurationInput !== '' ? '1px solid var(--indigo-600)' : '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--ink)',
                        }}
                      />
                    </div>
                  </div>

                  {/* "+ Detay ekle" (Mola notu) */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowDetailFields(!showDetailFields)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--indigo-600)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {showDetailFields ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {showDetailFields ? 'Not alanını gizle' : '+ Not ekle'}
                    </button>

                    {showDetailFields && (
                      <div style={{ marginTop: 8 }}>
                        <input
                          type="text"
                          placeholder="Yemek, yürüyüş, dinlenme…"
                          value={molaNote}
                          onChange={(e) => setMolaNote(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            fontSize: 12,
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--ink)',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* SERBEST FORMU */}
              {blockKind === 'serbest' && (
                <>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 4, display: 'block' }}>
                      Etkinlik Adı <span style={{ color: 'var(--critical)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Hastane randevusu, okul sınavı…"
                      value={activityName}
                      onChange={(e) => setActivityName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        fontSize: 12.5,
                        borderRadius: 7,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--ink)',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 5, display: 'block' }}>
                      Süre (dk) <span style={{ color: 'var(--critical)' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {[5, 10, 15, 20, 30, 45, 60].map((dur) => {
                        const isSel = durationMin === dur && customDurationInput === ''
                        return (
                          <button
                            key={dur}
                            type="button"
                            onClick={() => {
                              setDurationMin(dur)
                              setCustomDurationInput('')
                            }}
                            style={{
                              padding: '5px 10px',
                              fontSize: 11.5,
                              fontWeight: isSel ? 700 : 500,
                              borderRadius: 6,
                              border: isSel ? '1px solid var(--indigo-600)' : '1px solid var(--border-soft)',
                              background: isSel ? 'var(--indigo-050)' : 'var(--surface)',
                              color: isSel ? 'var(--indigo-600)' : 'var(--ink)',
                              cursor: 'pointer',
                            }}
                          >
                            {dur} dk
                          </button>
                        )
                      })}
                      <input
                        type="number"
                        placeholder="Diğer dk"
                        min="1"
                        value={customDurationInput}
                        onChange={(e) => {
                          setCustomDurationInput(e.target.value)
                          const parsed = parseInt(e.target.value, 10)
                          if (!isNaN(parsed) && parsed > 0) setDurationMin(parsed)
                        }}
                        style={{
                          width: 80,
                          padding: '5px 8px',
                          fontSize: 11.5,
                          borderRadius: 6,
                          border: customDurationInput !== '' ? '1px solid var(--indigo-600)' : '1px solid var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--ink)',
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* SAĞ SÜTUN (GÜN & SAATLER & ÖZET) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* GÜNLER */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>
                    GÜN
                  </label>
                  {!isEditing && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setSelectedDays([0, 1, 2, 3, 4])}
                        style={{
                          fontSize: 10.5,
                          color: 'var(--indigo-600)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 600,
                          padding: 0,
                        }}
                      >
                        Hafta içi
                      </button>
                      <span style={{ color: 'var(--border)' }}>·</span>
                      <button
                        type="button"
                        onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])}
                        style={{
                          fontSize: 10.5,
                          color: 'var(--indigo-600)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 600,
                          padding: 0,
                        }}
                      >
                        Hepsi
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {DAYS_SHORT.map((dayName, idx) => {
                    const isSel = selectedDays.includes(idx)
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        style={{
                          flex: 1,
                          minWidth: 36,
                          padding: '6px 4px',
                          fontSize: 11.5,
                          fontWeight: isSel ? 700 : 500,
                          borderRadius: 6,
                          border: isSel ? '1px solid var(--indigo-600)' : '1px solid var(--border-soft)',
                          background: isSel ? 'var(--indigo-050)' : 'var(--surface)',
                          color: isSel ? 'var(--indigo-600)' : 'var(--ink-soft)',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        {dayName}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* SAATLER */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 5, display: 'block' }}>
                  SAATLER
                </label>

                {/* Seçili saat çipleri */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, minHeight: 28 }}>
                  {selectedHours.map((h) => (
                    <span
                      key={h}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 8px',
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 600,
                        background: 'var(--surface-alt)',
                        color: 'var(--ink)',
                        border: '1px solid var(--border-soft)',
                      }}
                    >
                      <Clock size={11} color="var(--ink-faint)" />
                      {h}
                      <button
                        type="button"
                        onClick={() => handleRemoveHour(h)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: 'var(--ink-faint)',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {selectedHours.length === 0 && (
                    <span style={{ fontSize: 11, color: 'var(--ink-faint)', alignSelf: 'center', fontStyle: 'italic' }}>
                      Saat seçilmedi (saatsiz blok olarak eklenir)
                    </span>
                  )}
                </div>

                {/* Saat giriş alanı & + Saat butonu */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="time"
                    value={newHourInput}
                    onChange={(e) => setNewHourInput(e.target.value)}
                    style={{
                      padding: '5px 8px',
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newHourInput) {
                        handleAddHour(newHourInput)
                        setNewHourInput('')
                      }
                    }}
                    style={{
                      padding: '5px 12px',
                      fontSize: 11.5,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: '1px solid var(--border-soft)',
                      background: 'var(--surface-alt)',
                      color: 'var(--ink)',
                      cursor: 'pointer',
                    }}
                  >
                    + Saat
                  </button>

                  {/* + Ardından (HH:MM) */}
                  {nextHourSuggestion && !isEditing && (
                    <button
                      type="button"
                      onClick={() => handleAddHour(nextHourSuggestion)}
                      style={{
                        padding: '5px 10px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: '1px solid var(--indigo-100, #c7d2fe)',
                        background: 'var(--indigo-050)',
                        color: 'var(--indigo-600)',
                        cursor: 'pointer',
                      }}
                    >
                      + Ardından ({nextHourSuggestion})
                    </button>
                  )}
                </div>
              </div>

              {/* SIK KULLANDIĞIN SAATLER */}
              {frequentHours.length > 0 && !isEditing && (
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-faint)', marginBottom: 4, display: 'block' }}>
                    Sık kullandığın saatler
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {frequentHours.map((fh) => {
                      const isSel = selectedHours.includes(fh)
                      return (
                        <button
                          key={fh}
                          type="button"
                          onClick={() => handleAddHour(fh)}
                          style={{
                            padding: '3px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 5,
                            border: isSel ? '1px solid var(--indigo-600)' : '1px solid var(--border-soft)',
                            background: isSel ? 'var(--indigo-050)' : 'var(--surface-alt)',
                            color: isSel ? 'var(--indigo-600)' : 'var(--ink-soft)',
                            cursor: 'pointer',
                          }}
                        >
                          {fh}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ÖZET ŞERİDİ (Yeşil) */}
              <div
                style={{
                  background: 'var(--success-bg)',
                  color: 'var(--success-text)',
                  border: '1px solid color-mix(in srgb, var(--success-text) 25%, transparent)',
                  borderRadius: 8,
                  padding: '9px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {selectedHours.length > 0
                  ? `${selectedDays.length} gün × ${selectedHours.length} saat = ${selectedDays.length * selectedHours.length} blok`
                  : `${selectedDays.length} gün · saatsiz = ${selectedDays.length} blok`}
              </div>

              {/* ÇAKIŞMA UYARILARI (Sarı) */}
              {conflictWarnings.length > 0 && (
                <div
                  style={{
                    background: 'var(--warning-bg)',
                    color: 'var(--warning-text)',
                    border: '1px solid color-mix(in srgb, var(--warning-text) 25%, transparent)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 11.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
                    <AlertTriangle size={13} />
                    <span>Çakışma Uyarısı (eklemeyi engellemez):</span>
                  </div>
                  {conflictWarnings.slice(0, 3).map((warn, wIdx) => (
                    <div key={wIdx} style={{ fontSize: 11 }}>
                      • {warn}
                    </div>
                  ))}
                  {conflictWarnings.length > 3 && (
                    <div style={{ fontSize: 10.5, opacity: 0.85 }}>
                      ve {conflictWarnings.length - 3} çakışma daha…
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Hata Mesajı */}
          {errorMessage && (
            <div
              style={{
                marginTop: 14,
                padding: '8px 12px',
                borderRadius: 7,
                background: 'var(--critical-bg)',
                color: 'var(--critical-text)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {errorMessage}
            </div>
          )}
        </div>

        {/* Alt Butonlar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '14px 20px',
            borderTop: '1px solid var(--border-soft)',
            background: 'var(--surface-alt)',
          }}
        >
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            disabled={submitting}
          >
            İptal
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSubmit}
            disabled={submitting}
            style={{ minWidth: 100, justifyContent: 'center' }}
          >
            {submitting ? 'Kaydediliyor…' : isEditing ? 'Kaydet' : 'Ekle'}
          </button>
        </div>
      </div>
    </div>
  )
}
