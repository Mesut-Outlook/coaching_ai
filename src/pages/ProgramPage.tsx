import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  CheckSquare,
  X,
  Printer,
  MessageCircle,
  BookOpen,
  Edit2,
  Sparkles,
  Check,
  Clock,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import PageHeader from '../components/layout/PageHeader'
import TopicProgressPanel from '../components/topics/TopicProgressPanel'
import { fetchStudents } from '../lib/students'
import { useAccess } from '../contexts/AccessContext'
import { useAuth } from '../contexts/AuthContext'
import CoachingLockedState from '../components/common/CoachingLockedState'
import type { Student, Topic, WeeklyTask, Subject, TaskType, ExamType } from '../types/database'
import { mondayOf, weekKey, fmtWeekRange, DAYS } from '../lib/weeks'
import { subjectAppliesTo, topicAppliesTo, gradeCurriculum } from '../lib/curriculum'
import { openWhatsAppChat } from '../lib/whatsapp'
import { loadReport360Data } from '../lib/report360'
import { buildRecommendations, type RecommendItem } from '../lib/recommendCore'

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

export default function ProgramPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialStudentId = searchParams.get('studentId') || ''

  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId)
  const { user } = useAuth()
  const { isSystemAdmin, studentScope, can } = useAccess()
  
  const selectedStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId)
  }, [students, selectedStudentId])

  const isCoachingLocked = !isSystemAdmin && Boolean(selectedStudent?.coaching_coach_id) && selectedStudent?.coaching_coach_id !== user?.id
  
  const [topics, setTopics] = useState<(Topic & { subjects: Subject | null })[]>([])
  const [tasks, setTasks] = useState<WeeklyTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // R4-3: Süre Alanları (duration_min)
  const [durationMin, setDurationMin] = useState<number | ''>('')
  const [editDurationMin, setEditDurationMin] = useState<number | ''>('')
  const [resultDurationMin, setResultDurationMin] = useState<string>('')

  // R3-4: Öneri Motoru B - Haftalık Taslak Katmanı
  const [draftTasks, setDraftTasks] = useState<Array<{
    id: string
    day_index: number
    topic_id: number | null
    custom_label: string | null
    question_count: number
    task_type: TaskType
    source: string | null
    origin_kind: 'oneri'
    reason: string
    subjectName?: string
    topicName?: string
  }>>([])
  const [generatingDraft, setGeneratingDraft] = useState(false)
  const [confirmingDraft, setConfirmingDraft] = useState(false)
  
  // Navigation for weeks
  const [currentMonday, setCurrentMonday] = useState<Date>(() => mondayOf(new Date()))
  
  // Inline Add Form State (per day)
  const [addingDayIndex, setAddingDayIndex] = useState<number | null>(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('custom')
  const [selectedTopicId, setSelectedTopicId] = useState<string>('')
  const [customLabel, setCustomLabel] = useState('')
  const [questionCount, setQuestionCount] = useState<number>(100)
  const [taskType, setTaskType] = useState<TaskType>('konu')
  const [taskSource, setTaskSource] = useState<string>('')
  const [recentSources, setRecentSources] = useState<string[]>([])
  const [addingTask, setAddingTask] = useState(false)

  // Task Editing State
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  // Konuya tıklanınca açılan gelişim paneli (Konu Yeterlilik Haritası'ndaki panelin aynısı)
  const [progressTopic, setProgressTopic] = useState<{ id: number; name: string; subjectName?: string | null } | null>(null)
  const [editSubjectId, setEditSubjectId] = useState<string>('custom')
  const [editTopicId, setEditTopicId] = useState<string>('')
  const [editCustomLabel, setEditCustomLabel] = useState('')
  const [editQuestionCount, setEditQuestionCount] = useState<number>(100)
  const [editTaskType, setEditTaskType] = useState<TaskType>('konu')
  const [editTaskSource, setEditTaskSource] = useState<string>('')
  const [savingTask, setSavingTask] = useState(false)
  const [waMenuOpen, setWaMenuOpen] = useState(false)

  // Coach Result Entry Modal State (D / Y / B)
  const [resultModalTask, setResultModalTask] = useState<WeeklyTask | null>(null)
  const [resultCorrect, setResultCorrect] = useState<string>('')
  const [resultWrong, setResultWrong] = useState<string>('')
  const [resultBlank, setResultBlank] = useState<string>('')
  const [savingResult, setSavingResult] = useState(false)
  const [resultError, setResultError] = useState<string | null>(null)

  // Sync selectedStudentId with query parameters
  const handleStudentChange = (id: string) => {
    setSelectedStudentId(id)
    setSearchParams({ studentId: id })
  }

  // Load students, topics
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

    // Load topics
    supabase.from('topics').select('*, subjects(*)').order('name', { ascending: true })
      .then(({ data }) => {
        if (data) setTopics(data as any)
      })
  }, [studentScope])

  // Load recent sources for current student (top 5 distinct)
  useEffect(() => {
    if (!selectedStudentId || !isSupabaseConfigured) {
      setRecentSources([])
      return
    }
    supabase
      .from('weekly_tasks')
      .select('source')
      .eq('student_id', selectedStudentId)
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
  }, [selectedStudentId])

  // Load tasks for the selected student and week
  const loadTasks = async () => {
    if (!selectedStudentId || !isSupabaseConfigured) return
    setLoading(true)
    setError(null)
    
    try {
      const startKey = weekKey(currentMonday)
      const { data, error: tasksError } = await supabase
        .from('weekly_tasks')
        .select('*')
        .eq('student_id', selectedStudentId)
        .eq('week_start', startKey)
        .order('day_index', { ascending: true })
      
      if (tasksError) throw tasksError
      setTasks(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Görevler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [selectedStudentId, currentMonday])

  const currentStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId)
  }, [students, selectedStudentId])

  // Week navigation handlers
  const handlePrevWeek = () => {
    setCurrentMonday(prev => new Date(prev.getTime() - 7 * 86400000))
  }
  
  const handleNextWeek = () => {
    setCurrentMonday(prev => new Date(prev.getTime() + 7 * 86400000))
  }
  
  const handleJumpToToday = () => {
    setCurrentMonday(mondayOf(new Date()))
  }

  const handleSendWhatsApp = (recipient: 'ogrenci' | 'veli' | 'ikisi') => {
    setWaMenuOpen(false)
    if (!currentStudent) return

    const wantsStudent = recipient === 'ogrenci' || recipient === 'ikisi'
    const wantsParent = recipient === 'veli' || recipient === 'ikisi'

    if (wantsStudent && !currentStudent.phone_number) {
      alert('Bu öğrencinin telefon numarası girilmemiş. Lütfen önce Öğrenciler sayfasından öğrenciyi düzenleyerek bir telefon numarası kaydedin.')
      return
    }
    if (wantsParent && !currentStudent.parent_phone_number) {
      alert('Bu öğrencinin veli telefon numarası girilmemiş. Lütfen önce Öğrenciler sayfasından öğrenciyi düzenleyerek bir veli telefon numarası kaydedin.')
      return
    }

    const weekRange = fmtWeekRange(currentMonday)
    const studentMessage = `Merhaba ${currentStudent.full_name}, bu haftaki (${weekRange}) ders çalışma programın hazır! PDF dosyasını ekten inceleyebilirsin. İyi çalışmalar!`
    const parentMessage = `Merhaba, ${currentStudent.full_name} için bu haftaki (${weekRange}) ders çalışma programı hazır! PDF dosyasını ekte bulabilirsiniz.`

    const recipientLabel = recipient === 'ogrenci' ? 'öğrenciye' : recipient === 'veli' ? 'veliye' : 'öğrenciye ve veliye'
    const confirmSend = window.confirm(
      `${recipientLabel.charAt(0).toUpperCase() + recipientLabel.slice(1)} WhatsApp üzerinden program iletmek için:\n\n` +
      `1. Henüz indirmediyseniz, "Yazdır / PDF" butonuna tıklayıp programı PDF olarak bilgisayarınıza kaydedin.\n` +
      `2. Bu onay kutusunda "Tamam" dediğinizde WhatsApp sohbet penceresi/pencereleri açılacaktır.\n` +
      `3. Açılan sohbete mesaj otomatik eklenecektir. İndirdiğiniz PDF dosyasını sürükleyip sohbet penceresine bırakarak (veya ataç simgesinden ekleyerek) kolayca gönderebilirsiniz.` +
      (recipient === 'ikisi' ? `\n\nİki sohbet penceresi açılacağı için tarayıcınız pop-up engelleyebilir — izin vermeniz gerekebilir.` : '') +
      `\n\nWhatsApp sohbetini açmak istiyor musunuz?`
    )

    if (!confirmSend) return

    if (wantsStudent && currentStudent.phone_number) {
      openWhatsAppChat(currentStudent.phone_number, studentMessage)
    }
    if (wantsParent && currentStudent.parent_phone_number) {
      openWhatsAppChat(currentStudent.parent_phone_number, parentMessage)
    }
  }

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, targetDayIndex: number) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain')
    if (!taskId || !isSupabaseConfigured) return

    // Optimistic local state update
    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        return { ...t, day_index: targetDayIndex }
      }
      return t
    })
    setTasks(updatedTasks)

    try {
      // Update in Supabase
      const { error } = await supabase
        .from('weekly_tasks')
        .update({ day_index: targetDayIndex })
        .eq('id', taskId)
      
      if (error) throw error
    } catch (err) {
      // Rollback on error
      loadTasks()
      alert('Görev taşınırken hata oluştu.')
    }
  }

  // Toggle Task Completion
  const handleToggleComplete = async (taskId: string, currentCompleted: boolean) => {
    if (!isSupabaseConfigured) return
    
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !currentCompleted } : t))
    
    try {
      const { error } = await supabase
        .from('weekly_tasks')
        .update({ completed: !currentCompleted })
        .eq('id', taskId)
      if (error) throw error
    } catch (err) {
      loadTasks()
      alert('Görev durumu güncellenemedi.')
    }
  }

  // Add a new task to a specific day
  const handleAddTask = async (dayIndex: number) => {
    if (!selectedStudentId || !isSupabaseConfigured) return

    const topicIdVal = selectedSubjectId === 'custom' ? null : (selectedTopicId ? parseInt(selectedTopicId) : null)
    const labelVal = selectedSubjectId === 'custom' ? customLabel : null

    if (selectedSubjectId === 'custom' && !customLabel.trim()) {
      return alert('Lütfen görev açıklaması girin.')
    }
    if (selectedSubjectId !== 'custom' && !selectedTopicId) {
      return alert('Lütfen konu seçin.')
    }

    setAddingTask(true)
    
    try {
      const weekStartStr = weekKey(currentMonday)
      // "Deneme mi?" kutusu kalktı: deneme olup olmadığı yalnız görev türünden gelir.
      const effectiveIsExam = taskType === 'deneme'
      const trimmedSource = taskSource.trim() || null

      const { data, error } = await supabase
        .from('weekly_tasks')
        .insert({
          student_id: selectedStudentId,
          week_start: weekStartStr,
          day_index: dayIndex,
          topic_id: topicIdVal,
          custom_label: labelVal,
          question_count: questionCount,
          duration_min: durationMin !== '' ? Number(durationMin) : null,
          is_exam: effectiveIsExam,
          task_type: taskType,
          source: trimmedSource,
          origin_kind: 'elle',
          completed: false
        })
        .select()
      
      if (error) throw error
      if (data) {
        setTasks(prev => [...prev, data[0]])
        if (trimmedSource && !recentSources.includes(trimmedSource)) {
          setRecentSources(prev => [trimmedSource, ...prev].slice(0, 5))
        }
      }

      // Reset form
      setAddingDayIndex(null)
      setSelectedSubjectId('custom')
      setSelectedTopicId('')
      setCustomLabel('')
      setQuestionCount(100)
      setDurationMin('')
      setTaskType('konu')
      setTaskSource('')
    } catch (err) {
      alert('Görev eklenirken hata oluştu.')
    } finally {
      setAddingTask(false)
    }
  }

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Bu görevi silmek istediğinize emin misiniz?')) return
    if (!isSupabaseConfigured) return

    // Optimistic update
    setTasks(prev => prev.filter(t => t.id !== taskId))

    try {
      const { error } = await supabase.from('weekly_tasks').delete().eq('id', taskId)
      if (error) throw error
    } catch (err) {
      loadTasks()
      alert('Görev silinemedi.')
    }
  }

  // Handle task editing start
  const handleStartEdit = (task: WeeklyTask) => {
    setEditingTaskId(task.id)
    if (task.topic_id) {
      const topic = topics.find(t => t.id === task.topic_id)
      setEditSubjectId(topic ? String(topic.subject_id) : 'custom')
      setEditTopicId(String(task.topic_id))
    } else {
      setEditSubjectId('custom')
      setEditTopicId('')
    }
    setEditCustomLabel(task.custom_label || '')
    setEditQuestionCount(task.question_count)
    setEditDurationMin(task.duration_min !== null && task.duration_min !== undefined ? task.duration_min : '')
    setEditTaskType(task.task_type || (task.is_exam ? 'deneme' : 'konu'))
    setEditTaskSource(task.source || '')
  }

  // Handle task editing save
  const handleSaveEdit = async (taskId: string) => {
    if (!isSupabaseConfigured) return

    const topicIdVal = editSubjectId === 'custom' ? null : (editTopicId ? parseInt(editTopicId) : null)
    const labelVal = editSubjectId === 'custom' ? editCustomLabel : null

    if (editSubjectId === 'custom' && !editCustomLabel.trim()) {
      return alert('Lütfen görev açıklaması girin.')
    }
    if (editSubjectId !== 'custom' && !editTopicId) {
      return alert('Lütfen konu seçin.')
    }

    setSavingTask(true)
    try {
      const effectiveIsExam = editTaskType === 'deneme'
      const trimmedSource = editTaskSource.trim() || null

      const { data, error } = await supabase
        .from('weekly_tasks')
        .update({
          topic_id: topicIdVal,
          custom_label: labelVal,
          question_count: editQuestionCount,
          duration_min: editDurationMin !== '' ? Number(editDurationMin) : null,
          is_exam: effectiveIsExam,
          task_type: editTaskType,
          source: trimmedSource,
        })
        .eq('id', taskId)
        .select()

      if (error) throw error

      if (data && data.length > 0) {
        setTasks(prev => prev.map(t => t.id === taskId ? data[0] : t))
        if (trimmedSource && !recentSources.includes(trimmedSource)) {
          setRecentSources(prev => [trimmedSource, ...prev].slice(0, 5))
        }
      }
      setEditingTaskId(null)
    } catch (err) {
      alert('Görev güncellenirken hata oluştu.')
    } finally {
      setSavingTask(false)
    }
  }

  // Coach Result Entry Handlers (D / Y / B & Süre)
  const openResultModal = (task: WeeklyTask) => {
    setResultModalTask(task)
    setResultCorrect(task.correct_count !== null && task.correct_count !== undefined ? String(task.correct_count) : '')
    setResultWrong(task.wrong_count !== null && task.wrong_count !== undefined ? String(task.wrong_count) : '')
    setResultBlank(task.blank_count !== null && task.blank_count !== undefined ? String(task.blank_count) : '')
    setResultDurationMin(task.duration_min !== null && task.duration_min !== undefined ? String(task.duration_min) : '')
    setResultError(null)
  }

  const handleSaveResult = async () => {
    if (!resultModalTask || !isSupabaseConfigured) return

    const isEmptyInput = resultCorrect.trim() === '' && resultWrong.trim() === '' && resultBlank.trim() === ''

    let d: number | null = null
    let y: number | null = null
    let b: number | null = null

    if (!isEmptyInput) {
      d = parseInt(resultCorrect.trim(), 10)
      y = parseInt(resultWrong.trim(), 10)
      b = parseInt(resultBlank.trim(), 10)

      if (isNaN(d) || isNaN(y) || isNaN(b) || d < 0 || y < 0 || b < 0) {
        setResultError('Doğru, Yanlış ve Boş sayılarını pozitif tamsayı olarak eksiksiz girin (veya temizlemek için tümünü silin).')
        return
      }

      if (d + y + b > resultModalTask.question_count) {
        setResultError(`D + Y + B toplamı (${d + y + b}), hedef soru sayısını (${resultModalTask.question_count}) aşamaz.`)
        return
      }
    }

    let dur: number | null = null
    if (resultDurationMin.trim() !== '') {
      const parsedDur = parseInt(resultDurationMin.trim(), 10)
      if (!isNaN(parsedDur) && parsedDur > 0) {
        dur = parsedDur
      }
    }

    setSavingResult(true)
    setResultError(null)

    try {
      const { data, error: updateError } = await supabase
        .from('weekly_tasks')
        .update({
          correct_count: d,
          wrong_count: y,
          blank_count: b,
          duration_min: dur,
        })
        .eq('id', resultModalTask.id)
        .select()

      if (updateError) throw updateError

      if (data && data.length > 0) {
        setTasks(prev => prev.map(t => t.id === resultModalTask.id ? data[0] : t))
      }
      setResultModalTask(null)
    } catch (err: any) {
      setResultError(err?.message || 'Sonuç kaydedilemedi.')
    } finally {
      setSavingResult(false)
    }
  }

  // R3-4: Akıllı Taslak Üret / Onayla / Temizle
  const handleGenerateDraft = async () => {
    if (!selectedStudentId || !selectedStudent || !isSupabaseConfigured) return
    setGeneratingDraft(true)
    try {
      const isLgs = gradeCurriculum(selectedStudent.grade) === 'LGS'
      const examType: ExamType = isLgs ? 'LGS' : 'TYT'

      // 1. 360 rapor verisini yükle
      const r360 = await loadReport360Data(selectedStudentId, examType)
      if (!r360) {
        alert('Öneri motoru için yeterli veri bulunamadı.')
        return
      }

      // 2. Koçun kritik kararları
      const { data: decisionsData } = await supabase
        .from('coach_decisions')
        .select('topic_id, state, decided_at, note, topics(id, name, subjects(name))')
        .eq('student_id', selectedStudentId)
        .eq('state', 'kritik')

      const criticalDecisions = (decisionsData || []).map((d: any) => ({
        topicId: d.topic_id,
        topicName: d.topics?.name || 'Konu',
        subjectName: d.topics?.subjects?.name || 'Ders',
        decidedAt: d.decided_at,
        note: d.note,
      }))

      // 3. Son 4 haftanın görevleri
      const fourWeeksAgo = new Date(currentMonday.getTime() - 28 * 86400000).toISOString().split('T')[0]
      const { data: pastTasksData } = await supabase
        .from('weekly_tasks')
        .select('week_start, question_count, completed, task_type')
        .eq('student_id', selectedStudentId)
        .gte('week_start', fourWeeksAgo)

      const last4WeeksTasks = (pastTasksData || []).map((t) => ({
        week_start: t.week_start,
        question_count: t.question_count,
        completed: t.completed,
        task_type: t.task_type as TaskType,
      }))

      // 4. Öneri motorunu çağır
      const output = buildRecommendations({
        studentId: selectedStudentId,
        examType,
        priorityPoints: r360.priorityMatrix.points.map((p) => ({
          examTopicId: p.examTopicId,
          examTopicName: p.examTopicName,
          subjectName: p.subjectName,
          weight: p.weight,
          accuracyPct: p.accuracyPct,
          priorityScore: p.priorityScore,
          quadrant: p.quadrant,
          curriculumTopicId: p.curriculumTopicId,
        })),
        reviewTopics: r360.reviewTiming.items.map((r) => ({
          topicId: r.topicId,
          topicName: r.topicName,
          subjectName: r.subjectName,
          lastMeasuredAccuracy: r.lastMeasuredAccuracy,
          weeksInactive: r.weeksInactive,
          reviewIntervalWeek: r.targetIntervalWeeks,
          repeatCount: r.repeatCount,
        })),
        criticalDecisions,
        last4WeeksTasks,
      })

      if (!output.items || output.items.length === 0) {
        alert('Şu an için önerilecek konu bulunamadı. Deneme sonuçları veya konu yeterlilik durumları girildiğinde öneriler otomatik şekillenecektir.')
        return
      }

      // 5. Günlere dağıt (Pazartesi-Cumartesi arası 6 güne dağıt)
      const newDrafts = output.items.map((item: RecommendItem, idx: number) => ({
        id: `draft-${idx}-${Date.now()}`,
        day_index: idx % 6,
        topic_id: item.topicId ?? null,
        custom_label: item.topicId ? null : `${item.subjectName}: ${item.topicName}`,
        question_count: item.recommendedQuestions,
        task_type: item.taskType,
        source: 'Akıllı Öneri',
        origin_kind: 'oneri' as const,
        reason: item.reason,
        subjectName: item.subjectName,
        topicName: item.topicName,
      }))

      setDraftTasks(newDrafts)
    } catch (err: any) {
      console.error('Draft generation error:', err)
      alert('Taslak üretilirken bir hata oluştu: ' + (err?.message || 'Bilinmeyen hata'))
    } finally {
      setGeneratingDraft(false)
    }
  }

  const handleConfirmDraft = async () => {
    if (!selectedStudentId || draftTasks.length === 0 || !isSupabaseConfigured) return
    setConfirmingDraft(true)
    try {
      const weekStartStr = weekKey(currentMonday)
      const payload = draftTasks.map((d) => ({
        student_id: selectedStudentId,
        week_start: weekStartStr,
        day_index: d.day_index,
        topic_id: d.topic_id,
        custom_label: d.custom_label,
        question_count: d.question_count,
        task_type: d.task_type,
        is_exam: d.task_type === 'deneme',
        source: d.source,
        origin_kind: 'oneri' as const,
        completed: false,
      }))

      const { data, error } = await supabase.from('weekly_tasks').insert(payload).select()
      if (error) throw error

      if (data) {
        setTasks((prev) => [...prev, ...data])
        setDraftTasks([])
      }
    } catch (err: any) {
      console.error('Confirm draft error:', err)
      alert('Taslak onaylanırken hata oluştu.')
    } finally {
      setConfirmingDraft(false)
    }
  }

  const handleClearDraft = () => {
    setDraftTasks([])
  }

  const handleRemoveDraftItem = (draftId: string) => {
    setDraftTasks((prev) => prev.filter((d) => d.id !== draftId))
  }

  // Unique subjects, derived from the joined topics list — seçili öğrencinin sınıfına
  // uymayan dersler (subjectAppliesTo) görev atama formundan hiç görünmez.
  const subjectsList = useMemo(() => {
    const bySubjectId = new Map<number, Subject>()
    topics.forEach((t) => {
      if (t.subjects && !bySubjectId.has(t.subject_id)) bySubjectId.set(t.subject_id, t.subjects)
    })
    const all = Array.from(bySubjectId.values())
    const filtered = selectedStudent ? all.filter((s) => subjectAppliesTo(s, selectedStudent.grade)) : all
    return filtered.sort((a, b) => a.sort_order - b.sort_order)
  }, [topics, selectedStudent])

  // Topics belonging to the currently selected subject in the add-task form.
  // topicAppliesTo (subject + grade) tek kaynak — sınıfa uymayan konular listelenmez.
  const topicsForSubject = useMemo(() => {
    if (selectedSubjectId === 'custom') return []
    const subjectId = parseInt(selectedSubjectId)
    return topics
      .filter((t) => t.subject_id === subjectId && t.subjects && (!selectedStudent || topicAppliesTo(t, t.subjects, selectedStudent.grade)))
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [topics, selectedSubjectId, selectedStudent])

  // Topics belonging to the currently selected subject in the edit-task form
  const editTopicsForSubject = useMemo(() => {
    if (editSubjectId === 'custom') return []
    const subjectId = parseInt(editSubjectId)
    return topics
      .filter((t) => t.subject_id === subjectId && t.subjects && (!selectedStudent || topicAppliesTo(t, t.subjects, selectedStudent.grade)))
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [topics, editSubjectId, selectedStudent])

  return (
    <section className="screen">
      <PageHeader
        title="Haftalık Program"
        subtitle="Öğrencinin haftalık çalışma planını hazırlayın. Görevleri sürükleyerek gününü değiştirebilirsiniz."
        actions={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {can('program.manage') && !isCoachingLocked && (
              <button
                type="button"
                className="btn btn-secondary no-print"
                onClick={handleGenerateDraft}
                disabled={generatingDraft || !selectedStudentId}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                title="Öneri motoru ile haftalık çalışma taslağı üret"
              >
                <Sparkles size={14} style={{ color: 'var(--indigo-600)' }} />
                {generatingDraft ? 'Taslak Üretiliyor…' : 'Akıllı Taslak Üret'}
              </button>
            )}
            <button type="button" className="btn btn-ghost no-print" onClick={() => window.print()}>
              <Printer size={14} /> Yazdır / PDF
            </button>
            <div className="no-print" style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setWaMenuOpen(o => !o)}
                style={{ background: '#25D366', borderColor: '#25D366', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <MessageCircle size={14} /> WhatsApp ile Gönder <ChevronDown size={13} />
              </button>
              {waMenuOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 19 }} onClick={() => setWaMenuOpen(false)} />
                  <div
                    style={{
                      position: 'absolute', top: '110%', right: 0, zIndex: 20, minWidth: 190,
                      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                      boxShadow: 'var(--shadow-pop)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
                    }}
                  >
                    <button type="button" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => handleSendWhatsApp('ogrenci')}>Öğrenciye Gönder</button>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => handleSendWhatsApp('veli')}>Veliye Gönder</button>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => handleSendWhatsApp('ikisi')}>Her İkisine Gönder</button>
                  </div>
                </>
              )}
            </div>
          </div>
        }
      />

      <div className="print-only" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#F6EFDD' }}>
          <img src="/logo.png" alt="" width={34} height={34} style={{ width: '122%', height: '122%', objectFit: 'cover', margin: '-11%' }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{currentStudent?.full_name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{fmtWeekRange(currentMonday)}</div>
        </div>
      </div>

      {!isSupabaseConfigured && (
        <div className="card" style={{ padding: 16, marginBottom: 20, background: 'var(--warning-bg)', border: 'none', color: 'var(--warning-text)' }}>
          Supabase bağlı değil — Lütfen Supabase yapılandırmasını tamamlayın.
        </div>
      )}

      {isSupabaseConfigured && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Toolbar */}
          <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            {/* Student Selector */}
            <div className="field" style={{ minWidth: 200 }}>
              <select value={selectedStudentId} onChange={(e) => handleStudentChange(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 10 }}>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name} ({s.track})</option>
                ))}
              </select>
            </div>

            {/* Week Navigator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 8px' }}>
              <button onClick={handlePrevWeek} style={{ border: 'none', background: 'none', padding: 6, display: 'flex', color: 'var(--ink-soft)' }}><ChevronLeft size={16} /></button>
              <button onClick={handleJumpToToday} style={{ border: 'none', background: 'none', fontSize: 12.5, fontWeight: 600, padding: '4px 10px', color: 'var(--indigo-600)' }}>Bugün</button>
              <span style={{ fontSize: 13, fontWeight: 700, padding: '0 8px', color: 'var(--ink)' }}>{fmtWeekRange(currentMonday)}</span>
              <button onClick={handleNextWeek} style={{ border: 'none', background: 'none', padding: 6, display: 'flex', color: 'var(--ink-soft)' }}><ChevronRight size={16} /></button>
            </div>
          </div>

          {error && (
            <div className="card" style={{ padding: 12, background: 'var(--critical-bg)', color: 'var(--critical-text)', border: 'none', fontSize: 13 }}>
              {error}
            </div>
          )}

          {selectedStudent && subjectsList.length === 0 && (
            <div className="card" style={{ padding: 12, background: 'var(--warning-bg)', color: 'var(--warning-text)', border: 'none', fontSize: 12.5 }}>
              Bu sınıf için müfredat henüz yüklenmemiş — ders/konu seçemezsiniz, yalnızca özel görev (serbest metin) ekleyebilirsiniz.
            </div>
          )}

          {/* R3-4: Taslak Görevler Bildirim / Aksiyon Çubuğu */}
          {draftTasks.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 10,
                background: 'color-mix(in srgb, var(--indigo-600) 8%, var(--surface))',
                border: '1.5px dashed var(--indigo-400)',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--indigo-100)', color: 'var(--indigo-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
                    {draftTasks.length} Görev Taslağı Hazırlandı (Öneri Motoru)
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                    Taslak görevler kesikli kenarlıkla gösteriliyor. İncelendikten sonra onaylayarak programa kalıcı ekleyebilirsiniz.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleClearDraft}
                  disabled={confirmingDraft}
                  style={{ fontSize: 12 }}
                >
                  Taslağı Temizle
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleConfirmDraft}
                  disabled={confirmingDraft}
                  style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Check size={14} /> {confirmingDraft ? 'Ekleniyor…' : 'Taslağı Onayla ve Programa Ekle'}
                </button>
              </div>
            </div>
          )}

          {/* Kanban Board */}
          {isCoachingLocked ? (
            <CoachingLockedState />
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--ink-soft)' }}>Yükleniyor…</div>
          ) : (
            <div className="program-board">
            {DAYS.map((dayName, dayIndex) => {
              const dayTasks = tasks.filter(t => t.day_index === dayIndex)
              const draftsForDay = draftTasks.filter(d => d.day_index === dayIndex)
              const isAddingHere = addingDayIndex === dayIndex

              return (
                <div
                  key={dayIndex}
                  className="program-day-col"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, dayIndex)}
                >
                  {/* Column Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-soft)', paddingBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{dayName}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-faint)', background: 'var(--measured-bg)', padding: '1px 6px', borderRadius: 10 }}>
                        {dayTasks.length}{draftsForDay.length > 0 ? ` (+${draftsForDay.length})` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Task Cards List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 200 }}>
                    {/* R3-4: Taslak Kartları */}
                    {draftsForDay.map((draft) => (
                      <div
                        key={draft.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: '2px dashed var(--indigo-400)',
                          background: 'color-mix(in srgb, var(--indigo-600) 4%, var(--surface))',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 5,
                          position: 'relative',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: 'var(--indigo-100)',
                                  color: 'var(--indigo-700)',
                                }}
                              >
                                Taslak
                              </span>
                              {draft.subjectName && (
                                <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}>
                                  {draft.subjectName}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', wordBreak: 'break-word' }}>
                              {draft.topicName || draft.custom_label}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleRemoveDraftItem(draft.id)}
                            style={{ padding: '2px 5px', color: 'var(--ink-faint)', border: 'none', background: 'none' }}
                            title="Bu taslak görevi kaldır"
                          >
                            <X size={13} />
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--indigo-600)' }}>
                            {draft.question_count} soru
                          </span>
                          <span style={{ color: 'var(--ink-faint)' }}>·</span>
                          <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}>
                            {TASK_TYPE_CONFIG[draft.task_type]?.label}
                          </span>
                        </div>

                        <div style={{ fontSize: 10.5, color: 'var(--indigo-600)', fontStyle: 'italic', lineHeight: 1.3, background: 'var(--surface)', padding: '4px 6px', borderRadius: 5, border: '1px solid var(--border-soft)' }}>
                          💡 {draft.reason}
                        </div>
                      </div>
                    ))}

                    {/* Boş gün */}
                    {dayTasks.length === 0 && draftsForDay.length === 0 && (
                      <div className="day-empty">
                        <span className="day-empty-text">Bu güne görev yok</span>
                        {selectedStudentId && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm no-print"
                            onClick={() => setAddingDayIndex(dayIndex)}
                          >
                            <Plus size={14} /> Görev ekle
                          </button>
                        )}
                      </div>
                    )}
                    {dayTasks.map(task => {
                      const topic = topics.find(t => t.id === task.topic_id)
                      const isEditing = editingTaskId === task.id

                      if (isEditing) {
                        return (
                          <div
                            key={task.id}
                            style={{
                              padding: 10,
                              background: 'var(--surface-alt)',
                              border: '1px solid var(--indigo-500)',
                              borderRadius: 10,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8
                            }}
                          >
                            <div className="field">
                              <label style={{ fontSize: 9, fontWeight: 700 }}>Ders</label>
                              <select
                                value={editSubjectId}
                                onChange={e => { setEditSubjectId(e.target.value); setEditTopicId('') }}
                                style={{ padding: 4, fontSize: 11, height: 'auto' }}
                              >
                                <option value="custom">Özel Görev (Metin)</option>
                                {subjectsList.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>

                            {editSubjectId === 'custom' ? (
                              <div className="field">
                                <label style={{ fontSize: 9, fontWeight: 700 }}>Görev Açıklaması</label>
                                <input
                                  type="text"
                                  value={editCustomLabel}
                                  onChange={e => setEditCustomLabel(e.target.value)}
                                  style={{ padding: 4, fontSize: 11 }}
                                />
                              </div>
                            ) : (
                              <div className="field">
                                <label style={{ fontSize: 9, fontWeight: 700 }}>Konu</label>
                                <select
                                  value={editTopicId}
                                  onChange={e => setEditTopicId(e.target.value)}
                                  style={{ padding: 4, fontSize: 11, height: 'auto' }}
                                >
                                  <option value="" disabled>Konu seçin</option>
                                  {editTopicsForSubject.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                              <div className="field">
                                <label style={{ fontSize: 9, fontWeight: 700 }}>Soru Sayısı</label>
                                <input
                                  type="number"
                                  value={editQuestionCount}
                                  onChange={e => setEditQuestionCount(parseInt(e.target.value) || 0)}
                                  style={{ padding: 4, fontSize: 11 }}
                                />
                              </div>
                              <div className="field">
                                <label style={{ fontSize: 9, fontWeight: 700 }}>Süre (dk)</label>
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="dk"
                                  value={editDurationMin}
                                  onChange={e => setEditDurationMin(e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
                                  style={{ padding: 4, fontSize: 11 }}
                                />
                              </div>
                            </div>

                            {/* Görev Türü Seçici */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <label style={{ fontSize: 9, fontWeight: 700 }}>Görev Türü</label>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 2, background: 'var(--surface)', padding: 2, borderRadius: 6, border: '1px solid var(--border)' }}>
                                {ALL_TASK_TYPES.map(tt => {
                                  const cfg = TASK_TYPE_CONFIG[tt]
                                  const isSel = editTaskType === tt
                                  return (
                                    <button
                                      key={tt}
                                      type="button"
                                      onClick={() => {
                                        setEditTaskType(tt)
                                      }}
                                      style={{
                                        padding: '3px 1px',
                                        fontSize: 9.5,
                                        fontWeight: isSel ? 700 : 500,
                                        border: isSel ? `1px solid ${cfg.border}` : '1px solid transparent',
                                        borderRadius: 4,
                                        background: isSel ? cfg.bg : 'transparent',
                                        color: isSel ? cfg.color : 'var(--ink-soft)',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {cfg.label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Kaynak Alanı */}
                            <div className="field">
                              <label style={{ fontSize: 9, fontWeight: 700 }}>
                                Kaynak <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(opsiyonel)</span>
                              </label>
                              <input
                                type="text"
                                list="task-sources"
                                placeholder="Örn: 3D AYT, Apotemi"
                                value={editTaskSource}
                                onChange={e => setEditTaskSource(e.target.value)}
                                style={{ padding: 4, fontSize: 11 }}
                              />
                            </div>

                            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ flex: 1, padding: '3px 6px', fontSize: 10, justifyContent: 'center' }}
                                onClick={() => setEditingTaskId(null)}
                              >
                                İptal
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ flex: 1.5, padding: '3px 6px', fontSize: 10, justifyContent: 'center' }}
                                onClick={() => handleSaveEdit(task.id)}
                                disabled={savingTask}
                              >
                                Kaydet
                              </button>
                            </div>
                          </div>
                        )
                      }

                      const typeCfg = TASK_TYPE_CONFIG[task.task_type || (task.is_exam ? 'deneme' : 'konu')] || TASK_TYPE_CONFIG.konu
                      const hasResult = task.correct_count !== null && task.correct_count !== undefined && task.wrong_count !== null && task.wrong_count !== undefined
                      const correct = task.correct_count ?? 0
                      const wrong = task.wrong_count ?? 0
                      const blank = task.blank_count ?? 0
                      const totalAnswered = correct + wrong + blank
                      const accuracyPct = totalAnswered > 0 ? Math.round((correct / totalAnswered) * 100) : 0

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onDoubleClick={() => handleStartEdit(task)}
                          title="Konuya tıklayın: gelişim paneli · Karta çift tıklayın: düzenle"
                          style={{
                            padding: '10px 12px',
                            background: task.completed ? 'var(--success-bg)' : 'var(--surface-alt)',
                            border: '1px solid var(--border-soft)',
                            borderRadius: 10,
                            cursor: 'grab',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            opacity: task.completed ? 0.85 : 1,
                            position: 'relative'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => handleToggleComplete(task.id, task.completed)}
                              style={{ border: 'none', background: 'none', padding: 0, marginTop: 2, cursor: 'pointer', display: 'flex' }}
                            >
                              <CheckSquare size={15} color={task.completed ? 'var(--success)' : 'var(--ink-faint)'} />
                            </button>
                            
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {topic ? (
                                <div
                                  role="button"
                                  tabIndex={0}
                                  title="Bu konunun gelişim panelini aç"
                                  onClick={(ev) => { ev.stopPropagation(); setProgressTopic({ id: topic.id, name: topic.name, subjectName: topic.subjects?.name }) }}
                                  onDoubleClick={(ev) => ev.stopPropagation()}
                                  onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setProgressTopic({ id: topic.id, name: topic.name, subjectName: topic.subjects?.name }) } }}
                                  style={{ fontSize: 12.5, fontWeight: 600, textDecoration: task.completed ? 'line-through' : 'none', color: 'var(--indigo-600)', wordBreak: 'break-word', cursor: 'pointer' }}
                                >
                                  {topic.name}
                                </div>
                              ) : (
                                <div style={{ fontSize: 12.5, fontWeight: 600, textDecoration: task.completed ? 'line-through' : 'none', color: 'var(--ink)', wordBreak: 'break-word' }}>
                                  {task.custom_label || 'Özel Görev'}
                                </div>
                              )}
                              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                {topic?.subjects && (
                                  <div style={{ fontSize: 9.5, color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: topic.subjects.color }}></span>
                                    {topic.subjects.name}
                                  </div>
                                )}
                                {task.source && (
                                  <div style={{ fontSize: 9.5, color: 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <BookOpen size={10} style={{ opacity: 0.7 }} />
                                    <span>{task.source}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id)}
                              style={{ border: 'none', background: 'none', padding: 2, color: 'var(--ink-faint)', cursor: 'pointer', opacity: 0.5 }}
                              className="delete-btn no-print"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {/* Tamamlanan görev için Sonuç alanı (D/Y/B ve % Doğruluk) */}
                          {task.completed && (
                            <div style={{ marginTop: 2, paddingTop: 4, borderTop: '1px dashed var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              {hasResult ? (
                                <>
                                  <span style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--success-text)', background: 'var(--surface)', border: '1px solid var(--border-soft)', padding: '1px 5px', borderRadius: 4 }}>
                                    {correct}D · {wrong}Y · {blank}B · %{accuracyPct}
                                  </span>
                                  <button
                                    type="button"
                                    className="no-print"
                                    onClick={(e) => { e.stopPropagation(); openResultModal(task) }}
                                    style={{ background: 'none', border: 'none', color: 'var(--indigo-600)', fontSize: 9.5, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                                  >
                                    Düzenle
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="no-print"
                                  onClick={(e) => { e.stopPropagation(); openResultModal(task) }}
                                  style={{ background: 'none', border: 'none', color: 'var(--indigo-600)', fontSize: 10, fontWeight: 600, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                                >
                                  <Edit2 size={10} /> Sonuç gir
                                </button>
                              )}
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-soft)', paddingTop: 5, marginTop: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--indigo-600)' }}>
                                {task.question_count} soru
                              </span>
                              {task.duration_min ? (
                                <span style={{ fontSize: 9.5, color: 'var(--ink-soft)', background: 'var(--surface)', border: '1px solid var(--border-soft)', padding: '0 4px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <Clock size={9} /> {task.duration_min} dk
                                </span>
                              ) : null}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: typeCfg.bg,
                                  color: typeCfg.color,
                                  border: `1px solid ${typeCfg.border}`,
                                }}
                              >
                                {typeCfg.label}
                              </span>
                              {task.is_exam && task.task_type !== 'deneme' && (
                                <span style={{ fontSize: 9, background: 'var(--critical-bg)', color: 'var(--critical-text)', fontWeight: 800, padding: '1px 5px', borderRadius: 4 }}>
                                  DENEME
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Add Task Form Button / Section */}
                  {isAddingHere ? (
                    <div className="no-print" style={{ background: 'var(--surface-alt)', border: '1px dashed var(--border)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div className="field">
                        <label style={{ fontSize: 10 }}>Ders</label>
                        <select
                          value={selectedSubjectId}
                          onChange={e => { setSelectedSubjectId(e.target.value); setSelectedTopicId('') }}
                          style={{ padding: 6, fontSize: 11.5 }}
                        >
                          <option value="custom">Özel Görev (Metin)</option>
                          {subjectsList.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      {selectedSubjectId === 'custom' ? (
                        <div className="field">
                          <label style={{ fontSize: 10 }}>Görev Açıklaması</label>
                          <input type="text" placeholder="Örn: Paragraf Çözümü" value={customLabel} onChange={e => setCustomLabel(e.target.value)} style={{ padding: 6, fontSize: 11.5 }} />
                        </div>
                      ) : (
                        <div className="field">
                          <label style={{ fontSize: 10 }}>Konu</label>
                          <select value={selectedTopicId} onChange={e => setSelectedTopicId(e.target.value)} style={{ padding: 6, fontSize: 11.5 }}>
                            <option value="" disabled>Konu seçin</option>
                            {topicsForSubject.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <div className="field">
                          <label style={{ fontSize: 10 }}>Soru Sayısı</label>
                          <input type="number" value={questionCount} onChange={e => setQuestionCount(parseInt(e.target.value) || 0)} style={{ padding: 6, fontSize: 11.5 }} />
                        </div>
                        <div className="field">
                          <label style={{ fontSize: 10 }}>Süre (dk) <span style={{ color: 'var(--ink-faint)' }}>(ops)</span></label>
                          <input
                            type="number"
                            min="1"
                            placeholder="dk"
                            value={durationMin}
                            onChange={e => setDurationMin(e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
                            style={{ padding: 6, fontSize: 11.5 }}
                          />
                        </div>
                      </div>

                      {/* Görev Türü Seçici */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <label style={{ fontSize: 10, fontWeight: 700 }}>Görev Türü</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 2, background: 'var(--surface)', padding: 2, borderRadius: 6, border: '1px solid var(--border)' }}>
                          {ALL_TASK_TYPES.map(tt => {
                            const cfg = TASK_TYPE_CONFIG[tt]
                            const isSel = taskType === tt
                            return (
                              <button
                                key={tt}
                                type="button"
                                onClick={() => {
                                  setTaskType(tt)
                                }}
                                style={{
                                  padding: '4px 2px',
                                  fontSize: 10,
                                  fontWeight: isSel ? 700 : 500,
                                  border: isSel ? `1px solid ${cfg.border}` : '1px solid transparent',
                                  borderRadius: 5,
                                  background: isSel ? cfg.bg : 'transparent',
                                  color: isSel ? cfg.color : 'var(--ink-soft)',
                                  cursor: 'pointer',
                                  textAlign: 'center',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {cfg.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Kaynak Alanı */}
                      <div className="field">
                        <label style={{ fontSize: 10, fontWeight: 700 }}>
                          Kaynak <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(opsiyonel)</span>
                        </label>
                        <input
                          type="text"
                          list="task-sources"
                          placeholder="Örn: 3D AYT, Apotemi"
                          value={taskSource}
                          onChange={e => setTaskSource(e.target.value)}
                          style={{ padding: 6, fontSize: 11.5 }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setAddingDayIndex(null)}><X size={12} /></button>
                        <button type="button" className="btn btn-primary btn-sm" style={{ flex: 2, justifyContent: 'center' }} onClick={() => handleAddTask(dayIndex)} disabled={addingTask}>
                          Ekle
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="no-print"
                      onClick={() => setAddingDayIndex(dayIndex)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px dashed var(--border)',
                        borderRadius: 10,
                        background: 'none',
                        color: 'var(--indigo-600)',
                        fontSize: 12,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: 'pointer'
                      }}
                    >
                      <Plus size={14} /> Görev Ekle
                    </button>
                  )}

                </div>
              )
            })}
          </div>
          )}

        </div>
      )}

      {/* Konuya tıklanınca açılan gelişim paneli — Konu Yeterlilik Haritası ile aynı bileşen */}
      {progressTopic && selectedStudentId && (
        <div className="modal-overlay no-print" onClick={() => setProgressTopic(null)}>
          <div className="modal-panel card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Konu Gelişimi</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setProgressTopic(null)} aria-label="Kapat">
                <X size={14} />
              </button>
            </div>
            <TopicProgressPanel
              studentId={selectedStudentId}
              topicId={progressTopic.id}
              topicName={progressTopic.name}
              subjectName={progressTopic.subjectName}
              onClose={() => setProgressTopic(null)}
            />
          </div>
        </div>
      )}
      {/* Öğrencinin son kullandığı kaynaklar otomatik öneri listesi */}
      <datalist id="task-sources">
        {recentSources.map(s => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {/* Koç Sonuç Girişi Modalı (D / Y / B) */}
      {resultModalTask && (
        <div className="modal-overlay no-print" onClick={() => setResultModalTask(null)}>
          <div className="modal-panel card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380, width: '92%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Görev Sonucu Girişi</h3>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                  {resultModalTask.custom_label || topics.find(t => t.id === resultModalTask.topic_id)?.name || 'Görev'} · Hedef: {resultModalTask.question_count} soru
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setResultModalTask(null)} aria-label="Kapat">
                <X size={14} />
              </button>
            </div>

            {resultError && (
              <div style={{ padding: '6px 10px', background: 'var(--critical-bg)', color: 'var(--critical-text)', borderRadius: 6, fontSize: 11.5, marginBottom: 10 }}>
                {resultError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div className="field">
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--success-text)' }}>Doğru (D)</label>
                <input
                  type="number"
                  min="0"
                  max={resultModalTask.question_count}
                  value={resultCorrect}
                  placeholder="0"
                  onChange={(e) => setResultCorrect(e.target.value)}
                  style={{ padding: '6px 8px', fontSize: 13, fontWeight: 600, textAlign: 'center' }}
                  autoFocus
                />
              </div>
              <div className="field">
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--critical-text)' }}>Yanlış (Y)</label>
                <input
                  type="number"
                  min="0"
                  max={resultModalTask.question_count}
                  value={resultWrong}
                  placeholder="0"
                  onChange={(e) => setResultWrong(e.target.value)}
                  style={{ padding: '6px 8px', fontSize: 13, fontWeight: 600, textAlign: 'center' }}
                />
              </div>
              <div className="field">
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)' }}>Boş (B)</label>
                <input
                  type="number"
                  min="0"
                  max={resultModalTask.question_count}
                  value={resultBlank}
                  placeholder="0"
                  onChange={(e) => setResultBlank(e.target.value)}
                  style={{ padding: '6px 8px', fontSize: 13, fontWeight: 600, textAlign: 'center' }}
                />
              </div>
            </div>

            {/* Kalan / Doldur yardımcısı */}
            {(() => {
              const dNum = parseInt(resultCorrect.trim(), 10) || 0
              const yNum = parseInt(resultWrong.trim(), 10) || 0
              const bNum = parseInt(resultBlank.trim(), 10) || 0
              const unassigned = Math.max(0, resultModalTask.question_count - dNum - yNum)
              const remaining = Math.max(0, resultModalTask.question_count - dNum - yNum - bNum)
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--surface-alt)', borderRadius: 6, fontSize: 11, color: 'var(--ink-soft)', marginBottom: 14 }}>
                  <span>Kalan soru: <strong>{remaining}</strong></span>
                  {unassigned > 0 && resultBlank.trim() === '' && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 6px', fontSize: 10 }}
                      onClick={() => setResultBlank(String(unassigned))}
                    >
                      Boş olarak doldur
                    </button>
                  )}
                </div>
              )
            })()}

            {/* R4-3: Çalışma Süresi (dk) */}
            <div className="field" style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink)' }}>
                Çalışma Süresi (dk) <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>(opsiyonel)</span>
              </label>
              <input
                type="number"
                min="1"
                value={resultDurationMin}
                placeholder="Örn: 45"
                onChange={(e) => setResultDurationMin(e.target.value)}
                style={{ padding: '6px 8px', fontSize: 13, fontWeight: 600 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              {(resultModalTask.correct_count !== null && resultModalTask.correct_count !== undefined) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11, color: 'var(--critical-text)' }}
                  onClick={() => {
                    setResultCorrect('')
                    setResultWrong('')
                    setResultBlank('')
                  }}
                  title="Sonucu temizle"
                >
                  Temizle
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setResultModalTask(null)}
              >
                İptal
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ flex: 1.5, justifyContent: 'center' }}
                onClick={handleSaveResult}
                disabled={savingResult}
              >
                {savingResult ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
