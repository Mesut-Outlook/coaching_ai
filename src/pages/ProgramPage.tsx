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
import { subjectAppliesTo, gradeCurriculum } from '../lib/curriculum'
import { openWhatsAppChat } from '../lib/whatsapp'
import { loadReport360Data } from '../lib/report360'
import { buildRecommendations, type RecommendItem } from '../lib/recommendCore'
import TaskBlockModal, {
  timeToMinutes,
  addMinutesToTime,
  formatTimeShort,
  TASK_TYPE_CONFIG,
} from '../components/program/TaskBlockModal'

const MONTHS_TR_SHORT = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
]

function formatBlockTimeRange(startTime: string | null | undefined, durationMin: number | null | undefined): string {
  if (!startTime) return durationMin ? `${durationMin} dk` : ''
  const start = formatTimeShort(startTime)
  if (!durationMin) return start
  const end = addMinutesToTime(start, durationMin)
  return `${start} – ${end}`
}

function formatMinutesToHours(min: number): string {
  if (min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0) {
    return m > 0 ? `${h} sa ${m} dk` : `${h} sa`
  }
  return `${m} dk`
}

function buildWhatsAppScheduleText(
  tasks: WeeklyTask[],
  topics: (Topic & { subjects: Subject | null })[],
  subjects: Subject[]
): string {
  const lines: string[] = []
  DAYS.forEach((dayName, dayIndex) => {
    // Molalar metne girmez
    const dayTasks = tasks.filter((t) => t.day_index === dayIndex && t.block_kind !== 'mola')
    if (dayTasks.length === 0) return

    const timed = dayTasks
      .filter((t) => Boolean(t.start_time))
      .sort((a, b) => timeToMinutes(a.start_time!) - timeToMinutes(b.start_time!))
    const untimed = dayTasks
      .filter((t) => !t.start_time)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    lines.push(`\n📅 *${dayName}*`)

    const formatTaskLine = (t: WeeklyTask) => {
      if (t.block_kind === 'serbest') {
        const timeStr = t.start_time ? formatTimeShort(t.start_time) + ' ' : ''
        const durStr = t.duration_min ? ` (${t.duration_min} dk)` : ''
        return `• ${timeStr}📌 ${t.custom_label || 'Serbest Etkinlik'}${durStr}`
      }

      const topic = topics.find((tp) => tp.id === t.topic_id)
      const subject = t.subject_id ? subjects.find((s) => s.id === t.subject_id) : topic?.subjects
      const subjectName = subject?.name || ''
      const topicOrLabel = topic?.name || t.custom_label || 'Ders'
      const title = subjectName ? `${subjectName} · ${topicOrLabel}` : topicOrLabel
      const timeStr = t.start_time ? formatTimeShort(t.start_time) + ' ' : ''
      const durStr = t.duration_min ? ` (${t.duration_min} dk)` : ''
      const qStr = t.question_count > 0 ? ` [${t.question_count} soru]` : ''
      return `• ${timeStr}${title}${durStr}${qStr}`
    }

    timed.forEach((t) => lines.push(formatTaskLine(t)))
    untimed.forEach((t) => lines.push(formatTaskLine(t)))
  })
  return lines.join('\n')
}

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

  // Coach Result Entry Modal duration
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

  // Sources datalist
  const [recentSources, setRecentSources] = useState<string[]>([])

  // Konuya tıklanınca açılan gelişim paneli (Konu Yeterlilik Haritası'ndaki panelin aynısı)
  const [progressTopic, setProgressTopic] = useState<{ id: number; name: string; subjectName?: string | null } | null>(null)
  const [waMenuOpen, setWaMenuOpen] = useState(false)

  // P3: TaskBlockModal State
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [taskModalDayIndex, setTaskModalDayIndex] = useState(0)
  const [taskModalStartTime, setTaskModalStartTime] = useState<string | null>(null)
  const [taskModalEditingTask, setTaskModalEditingTask] = useState<WeeklyTask | null>(null)

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
    const scheduleSummary = buildWhatsAppScheduleText(tasks, topics, subjectsList)
    const studentMessage = `Merhaba ${currentStudent.full_name}, bu haftaki (${weekRange}) ders çalışma programın:\n${scheduleSummary}\n\nİyi çalışmalar!`
    const parentMessage = `Merhaba, ${currentStudent.full_name} için bu haftaki (${weekRange}) ders çalışma programı:\n${scheduleSummary}`

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

  // HTML5 Drag and Drop Handlers (preserves start_time)
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
    } catch {
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
    } catch {
      loadTasks()
      alert('Görev durumu güncellenemedi.')
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
    } catch {
      loadTasks()
      alert('Görev silinemedi.')
    }
  }

  // TaskBlockModal Handlers (P3)
  const handleOpenAddTaskModal = (dayIndex: number) => {
    const dayTasks = tasks.filter(t => t.day_index === dayIndex && t.start_time)
    const sorted = [...dayTasks].sort((a, b) => timeToMinutes(a.start_time!) - timeToMinutes(b.start_time!))
    let nextStart: string | null = null
    if (sorted.length > 0) {
      const last = sorted[sorted.length - 1]
      const dur = last.duration_min || 40
      nextStart = addMinutesToTime(formatTimeShort(last.start_time), dur)
    }
    setTaskModalDayIndex(dayIndex)
    setTaskModalStartTime(nextStart)
    setTaskModalEditingTask(null)
    setTaskModalOpen(true)
  }

  const handleOpenEditTaskModal = (task: WeeklyTask) => {
    setTaskModalDayIndex(task.day_index)
    setTaskModalStartTime(task.start_time ? formatTimeShort(task.start_time) : null)
    setTaskModalEditingTask(task)
    setTaskModalOpen(true)
  }

  const handleTaskModalSuccess = (newOrUpdatedTasks: WeeklyTask[]) => {
    setTaskModalOpen(false)
    setTaskModalEditingTask(null)
    // Add any newly used sources to recentSources
    newOrUpdatedTasks.forEach(t => {
      if (t.source && !recentSources.includes(t.source)) {
        setRecentSources(prev => [t.source!, ...prev].slice(0, 5))
      }
    })
    loadTasks()
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

      // Saatli blokta soru hedefi olmadan açılmışsa (question_count = 0) D+Y+B hedef kontrolünü atla
      if (resultModalTask.question_count > 0 && d + y + b > resultModalTask.question_count) {
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
      const updatePayload: Partial<WeeklyTask> = {
        correct_count: d,
        wrong_count: y,
        blank_count: b,
        duration_min: dur,
      }
      // question_count = 0 ise kullanıcı sonradan soru girdiyse hedef soru sayısını da doldursun
      if (resultModalTask.question_count === 0 && d !== null && y !== null && b !== null) {
        updatePayload.question_count = d + y + b
      }

      const { data, error: updateError } = await supabase
        .from('weekly_tasks')
        .update(updatePayload)
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

      // 3. Son 4 haftanın görevleri (Yalnızca ders blokları)
      const fourWeeksAgo = new Date(currentMonday.getTime() - 28 * 86400000).toISOString().split('T')[0]
      const { data: pastTasksData } = await supabase
        .from('weekly_tasks')
        .select('week_start, question_count, completed, task_type')
        .eq('student_id', selectedStudentId)
        .eq('block_kind', 'ders')
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
              const dayDate = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + dayIndex)
              const dayTasks = tasks.filter(t => t.day_index === dayIndex)
              const draftsForDay = draftTasks.filter(d => d.day_index === dayIndex)

              const timedTasks = dayTasks
                .filter(t => Boolean(t.start_time))
                .sort((a, b) => timeToMinutes(a.start_time!) - timeToMinutes(b.start_time!))

              const untimedTasks = dayTasks
                .filter(t => !t.start_time)
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

              const dersTasks = dayTasks.filter(t => !t.block_kind || t.block_kind === 'ders')
              const doneDersCount = dersTasks.filter(t => t.completed).length
              const dersMins = dersTasks.reduce((s, t) => s + (t.duration_min || 0), 0)
              const dersDurationText = formatMinutesToHours(dersMins)

              const renderTaskCard = (task: WeeklyTask) => {
                const isMola = task.block_kind === 'mola'
                const isSerbest = task.block_kind === 'serbest'
                const range = formatBlockTimeRange(task.start_time, task.duration_min)

                // 1) MOLA KARTI (Tek satır, gri, tamamlama kutusu ve sonuç butonu yok)
                if (isMola) {
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDoubleClick={() => handleOpenEditTaskModal(task)}
                      className="no-print"
                      style={{
                        background: 'var(--measured-bg)',
                        border: '1px dashed var(--border)',
                        borderRadius: 8,
                        padding: '6px 9px',
                        fontSize: 11.5,
                        color: 'var(--measured-text)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                        cursor: 'grab',
                      }}
                      title="Çift tıklayın: düzenle"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                        <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          ☕ {task.custom_label || 'Mola'} · {task.duration_min || 10} dk
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        {task.start_time && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            {range}
                          </span>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm no-print"
                          onClick={() => handleOpenEditTaskModal(task)}
                          style={{ padding: '2px 4px', border: 'none', background: 'none', color: 'var(--ink-faint)', cursor: 'pointer' }}
                          title="Düzenle"
                        >
                          <Edit2 size={11} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm no-print"
                          onClick={() => handleDeleteTask(task.id)}
                          style={{ padding: '2px 4px', border: 'none', background: 'none', color: 'var(--ink-faint)', cursor: 'pointer' }}
                          title="Sil"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  )
                }

                // 2) SERBEST KARTI (Nötr renk, etkinlik adı ve saat, tamamlama kutusu yok)
                if (isSerbest) {
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDoubleClick={() => handleOpenEditTaskModal(task)}
                      style={{
                        background: 'var(--surface-alt)',
                        border: '1px dashed var(--border)',
                        borderRadius: 10,
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        cursor: 'grab',
                      }}
                      title="Çift tıklayın: düzenle"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', fontFamily: 'var(--font-mono)' }}>
                          {range}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 5,
                              background: 'var(--measured-bg)',
                              color: 'var(--measured-text)',
                            }}
                          >
                            Serbest
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm no-print"
                            onClick={() => handleOpenEditTaskModal(task)}
                            style={{ padding: 2, border: 'none', background: 'none', color: 'var(--ink-faint)', cursor: 'pointer' }}
                            title="Düzenle"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm no-print"
                            onClick={() => handleDeleteTask(task.id)}
                            style={{ padding: 2, border: 'none', background: 'none', color: 'var(--ink-faint)', cursor: 'pointer' }}
                            title="Sil"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', wordBreak: 'break-word' }}>
                        📌 {task.custom_label || 'Serbest Etkinlik'}
                      </div>
                    </div>
                  )
                }

                // 3) DERS KARTI (Renkli sol kenarlık, saat aralığı, tamamlama kutusu, sonuç)
                const topic = topics.find(t => t.id === task.topic_id)
                const subject = task.subject_id
                  ? subjectsList.find(s => s.id === task.subject_id)
                  : topic?.subjects
                const subjectColor = subject?.color || 'var(--indigo-500)'
                const subjectName = subject?.name || ''
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
                    onDoubleClick={() => handleOpenEditTaskModal(task)}
                    title="Konuya tıklayın: gelişim paneli · Karta çift tıklayın: düzenle"
                    style={{
                      padding: '8px 10px 8px 12px',
                      background: task.completed ? 'var(--success-bg)' : 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderLeft: `4px solid ${subjectColor}`,
                      borderRadius: 10,
                      cursor: 'grab',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                      opacity: task.completed ? 0.88 : 1,
                      position: 'relative',
                    }}
                  >
                    {/* 1. Satır: Saat aralığı + Tamamlama kutusu + Düzenle/Sil */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', fontFamily: 'var(--font-mono)' }}>
                        {range}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(task.id, task.completed)}
                          style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
                          title={task.completed ? 'Tamamlanmadı yap' : 'Tamamlandı işaretle'}
                        >
                          <CheckSquare size={16} color={task.completed ? 'var(--success)' : 'var(--ink-faint)'} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm no-print"
                          onClick={() => handleOpenEditTaskModal(task)}
                          style={{ padding: 2, border: 'none', background: 'none', color: 'var(--ink-faint)', cursor: 'pointer' }}
                          title="Düzenle"
                        >
                          <Edit2 size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.id)}
                          style={{ border: 'none', background: 'none', padding: 2, color: 'var(--ink-faint)', cursor: 'pointer', opacity: 0.6 }}
                          className="delete-btn no-print"
                          title="Sil"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* 2. Satır: Ders · Konu */}
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', wordBreak: 'break-word' }}>
                      {subjectName && (
                        <span style={{ color: 'var(--ink)' }}>
                          {subjectName}
                          {topic || task.custom_label ? ' · ' : ''}
                        </span>
                      )}
                      {topic ? (
                        <span
                          role="button"
                          tabIndex={0}
                          title="Bu konunun gelişim panelini aç"
                          onClick={(ev) => {
                            ev.stopPropagation()
                            setProgressTopic({ id: topic.id, name: topic.name, subjectName: topic.subjects?.name })
                          }}
                          onDoubleClick={(ev) => ev.stopPropagation()}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter' || ev.key === ' ') {
                              ev.preventDefault()
                              setProgressTopic({ id: topic.id, name: topic.name, subjectName: topic.subjects?.name })
                            }
                          }}
                          style={{
                            fontWeight: 600,
                            color: 'var(--indigo-600)',
                            textDecoration: task.completed ? 'line-through' : 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {topic.name}
                        </span>
                      ) : (
                        <span style={{ fontWeight: 600, textDecoration: task.completed ? 'line-through' : 'none' }}>
                          {task.custom_label || 'Özel Görev'}
                        </span>
                      )}
                    </div>

                    {/* 3. Satır: Tip rozeti + Süre/Soru/Kaynak */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap', marginTop: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span
                          style={{
                            fontSize: 9.5,
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--ink-soft)' }}>
                        {task.question_count > 0 && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--indigo-600)' }}>
                            {task.question_count} soru
                          </span>
                        )}
                        {task.source && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--ink-soft)' }}>
                            <BookOpen size={10} style={{ opacity: 0.7 }} />
                            <span>{task.source}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 4. Satır: Tamamlanan görev için Sonuç alanı (D/Y/B ve % Doğruluk) */}
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
                  </div>
                )
              }

              return (
                <div
                  key={dayIndex}
                  className="program-day-col"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, dayIndex)}
                >
                  {/* Column Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--border-soft)', paddingBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{dayName}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontVariantNumeric: 'tabular-nums' }}>
                        {dayDate.getDate()} {MONTHS_TR_SHORT[dayDate.getMonth()]}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ink-faint)', fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ background: 'var(--measured-bg)', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
                        {doneDersCount}/{dersTasks.length} ders
                        {draftsForDay.length > 0 ? ` (+${draftsForDay.length})` : ''}
                      </span>
                      {dersDurationText && (
                        <span style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>
                          {dersDurationText}
                        </span>
                      )}
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
                            onClick={() => handleOpenAddTaskModal(dayIndex)}
                          >
                            <Plus size={14} /> Görev ekle
                          </button>
                        )}
                      </div>
                    )}

                    {/* 1. Saatli Bloklar (Saate göre sıralı) */}
                    {timedTasks.map(renderTaskCard)}

                    {/* 2. Saatsiz Bölümü (Varsa) */}
                    {untimedTasks.length > 0 && (
                      <>
                        {timedTasks.length > 0 && (
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: '0.07em',
                              textTransform: 'uppercase',
                              color: 'var(--ink-faint)',
                              margin: '6px 0 2px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span>Saatsiz</span>
                            <div style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
                          </div>
                        )}
                        {untimedTasks.map(renderTaskCard)}
                      </>
                    )}
                  </div>

                  {/* Günün altına "+ Görev Ekle" düğmesi */}
                  <button
                    type="button"
                    className="no-print"
                    onClick={() => handleOpenAddTaskModal(dayIndex)}
                    style={{
                      marginTop: 'auto',
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
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={14} /> Görev Ekle
                  </button>
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
                  max={resultModalTask.question_count > 0 ? resultModalTask.question_count : undefined}
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
                  max={resultModalTask.question_count > 0 ? resultModalTask.question_count : undefined}
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
                  max={resultModalTask.question_count > 0 ? resultModalTask.question_count : undefined}
                  value={resultBlank}
                  placeholder="0"
                  onChange={(e) => setResultBlank(e.target.value)}
                  style={{ padding: '6px 8px', fontSize: 13, fontWeight: 600, textAlign: 'center' }}
                />
              </div>
            </div>

            {/* Kalan / Doldur yardımcısı (yalnız question_count > 0 ise) */}
            {resultModalTask.question_count > 0 && (() => {
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

      {/* P3: TaskBlockModal (Çoklu gün × çoklu saat blok ekleme/düzenleme) */}
      {selectedStudent && (
        <TaskBlockModal
          isOpen={taskModalOpen}
          onClose={() => {
            setTaskModalOpen(false)
            setTaskModalEditingTask(null)
          }}
          student={selectedStudent}
          currentMonday={currentMonday}
          initialDayIndex={taskModalDayIndex}
          initialStartTime={taskModalStartTime}
          existingTasks={tasks}
          subjects={subjectsList}
          topics={topics}
          editingTask={taskModalEditingTask}
          onSuccess={handleTaskModalSuccess}
          recentSources={recentSources}
        />
      )}
    </section>
  )
}
