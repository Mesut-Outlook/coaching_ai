import { useEffect, useState, useMemo, useRef } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  Save,
  RotateCcw,
  Sliders,
  MessageSquare,
  Award,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type {
  Student,
  ExamType,
  ExamSubject,
  ExamTopic,
  SaveExamReportPayload,
} from '../../types/database'
import { getExamSections, weightedNet, wrongPenaltyFor } from '../../lib/examSections'
import { gradeCurriculum } from '../../lib/curriculum'
import { round2, calcNet, calcSubjectAccuracy, calcTopicAccuracy } from '../../lib/examReport'

export interface ExamReportFormProps {
  students: Student[]
  selectedStudentId: string
  onStudentChange: (studentId: string) => void
  editingExamId?: string | null
  onCancelEdit?: () => void
  onSaveSuccess: (savedExamId: string) => void
}

type AltDersEntry = {
  questionCount: number
  correct: number
  wrong: number
  entered: boolean
}

type TopicEntry = {
  questionCount: number
  correct: number
  wrong: number
  entered: boolean
}

type RankEntry = {
  sira?: number
  katilan?: number
}

// Bölüm kartı renk eşlemesi
function getSectionColor(name: string): { border: string; bg: string; text: string } {
  const n = name.toLowerCase()
  if (n.includes('türkçe') || n.includes('edebiyat')) {
    return { border: 'var(--c-turkce)', bg: 'rgba(214, 73, 90, 0.08)', text: 'var(--c-turkce)' }
  }
  if (n.includes('matematik')) {
    return { border: 'var(--c-math)', bg: 'rgba(59, 111, 224, 0.08)', text: 'var(--c-math)' }
  }
  if (n.includes('fen') || n.includes('fizik') || n.includes('kimya') || n.includes('biyoloji')) {
    return { border: 'var(--c-fen)', bg: 'rgba(46, 159, 99, 0.08)', text: 'var(--c-fen)' }
  }
  if (n.includes('sosyal') || n.includes('tarih') || n.includes('coğrafya') || n.includes('inkılap')) {
    return { border: 'var(--c-sosyal)', bg: 'rgba(226, 147, 46, 0.08)', text: 'var(--c-sosyal)' }
  }
  if (n.includes('din')) {
    return { border: 'var(--plum)', bg: 'var(--plum-bg)', text: 'var(--plum-text)' }
  }
  if (n.includes('dil') || n.includes('ingilizce')) {
    return { border: 'var(--teal)', bg: 'var(--teal-bg)', text: 'var(--teal-text)' }
  }
  return { border: 'var(--indigo-600)', bg: 'var(--indigo-050)', text: 'var(--indigo-700)' }
}

export default function ExamReportForm({
  students,
  selectedStudentId,
  onStudentChange,
  editingExamId,
  onCancelEdit,
  onSaveSuccess,
}: ExamReportFormProps) {
  // 1. Sınav Üst Bilgileri State'i
  const [examName, setExamName] = useState('')
  const [publisher, setPublisher] = useState('')
  const [examType, setExamType] = useState<ExamType>('TYT')
  const [examDate, setExamDate] = useState(() => new Date().toISOString().split('T')[0])
  const [score, setScore] = useState<string>('')
  const [percentile, setPercentile] = useState<string>('')
  const [coachNote, setCoachNote] = useState<string>('')
  const [ranks, setRanks] = useState<Record<string, RankEntry>>({})
  const [showRankPanel, setShowRankPanel] = useState(false)

  // 2. Katalog Verileri
  const [catalogSubjects, setCatalogSubjects] = useState<ExamSubject[]>([])
  const [catalogTopics, setCatalogTopics] = useState<ExamTopic[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [loadingEditData, setLoadingEditData] = useState(false)

  // 3. Giriş Skorları State'i
  // Manuel bölüm skorları (eğer alt dersler eksikse veya alt dersi olmayan bölümler için)
  const [manualSections, setManualSections] = useState<Record<string, { correct: number; wrong: number }>>({})
  // Alt ders skorları (key: exam_subject_id)
  const [subjectEntries, setSubjectEntries] = useState<Record<number, AltDersEntry>>({})
  // Konu skorları (key: exam_topic_id)
  const [topicEntries, setTopicEntries] = useState<Record<number, TopicEntry>>({})
  // Seçmeli ders grubu seçimi (group_name -> exam_subject_id)
  const [choiceSelections, setChoiceSelections] = useState<Record<string, number>>({})

  // UI state
  const [expandedTopics, setExpandedTopics] = useState<Record<number, boolean>>({})
  const [newTopicInputs, setNewTopicInputs] = useState<Record<number, string>>({})
  const [addingTopicFor, setAddingTopicFor] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const currentStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId)
  }, [students, selectedStudentId])

  const studentCurriculum = currentStudent ? gradeCurriculum(currentStudent.grade) : null

  // Sınav türü uyumluluğu
  useEffect(() => {
    if (!studentCurriculum) return
    setExamType((prev) => {
      if (studentCurriculum === 'LGS') return 'LGS'
      return prev === 'LGS' ? 'TYT' : prev
    })
  }, [studentCurriculum])

  // Katalog verilerini yükle (exam_subjects + exam_topics)
  useEffect(() => {
    let isMounted = true
    setLoadingCatalog(true)

    Promise.all([
      supabase.from('exam_subjects').select('*').order('sort_order', { ascending: true }),
      supabase.from('exam_topics').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
    ])
      .then(([subjRes, topicRes]) => {
        if (!isMounted) return
        if (subjRes.data) setCatalogSubjects(subjRes.data)
        if (topicRes.data) setCatalogTopics(topicRes.data)
      })
      .catch((err) => {
        console.error('Katalog yükleme hatası:', err)
      })
      .finally(() => {
        if (isMounted) setLoadingCatalog(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Aktif sınav türü için şablon bölümler
  const activeSectionTemplates = useMemo(() => {
    return getExamSections(examType, currentStudent?.track ?? null)
  }, [examType, currentStudent])

  // Aktif sınav türünün katalog alt dersleri
  const currentExamSubjects = useMemo(() => {
    return catalogSubjects.filter((s) => s.exam_type === examType)
  }, [catalogSubjects, examType])

  // Seçmeli gruplar için varsayılan seçimleri hazırla
  useEffect(() => {
    const groups: Record<string, number[]> = {}
    currentExamSubjects.forEach((s) => {
      if (s.choice_group) {
        if (!groups[s.choice_group]) groups[s.choice_group] = []
        groups[s.choice_group].push(s.id)
      }
    })

    setChoiceSelections((prev) => {
      const updated = { ...prev }
      Object.entries(groups).forEach(([groupName, ids]) => {
        if (!updated[groupName] || !ids.includes(updated[groupName])) {
          updated[groupName] = ids[0]
        }
      })
      return updated
    })
  }, [currentExamSubjects])

  // Düzenleme modu: Var olan deneme verisini yükle
  useEffect(() => {
    const currentExamId = editingExamId
    if (!currentExamId) return
    let isMounted = true
    setLoadingEditData(true)
    setErrorMsg(null)

    async function loadEditingExam(examId: string) {
      try {
        const [examRes, secRes, subjRes, topRes] = await Promise.all([
          supabase.from('mock_exams').select('*').eq('id', examId).single(),
          supabase.from('mock_exam_sections').select('*').eq('mock_exam_id', examId),
          supabase.from('mock_exam_subject_results').select('*').eq('mock_exam_id', examId),
          supabase.from('mock_exam_topic_results').select('*').eq('mock_exam_id', examId),
        ])

        if (!isMounted) return
        if (examRes.error) throw examRes.error
        const exam = examRes.data

        setExamName(exam.name)
        setPublisher(exam.publisher || '')
        setExamType(exam.exam_type)
        setExamDate(exam.exam_date)
        setScore(exam.score != null ? String(exam.score) : '')
        setPercentile(exam.percentile != null ? String(exam.percentile) : '')
        setCoachNote(exam.coach_note || '')
        if (exam.ranks && typeof exam.ranks === 'object') {
          setRanks(exam.ranks as Record<string, RankEntry>)
          setShowRankPanel(true)
        }

        // Manuel bölümler
        const secMap: Record<string, { correct: number; wrong: number }> = {}
        secRes.data?.forEach((s) => {
          secMap[s.section_name] = { correct: s.correct_count, wrong: s.wrong_count }
        })
        setManualSections(secMap)

        // Alt dersler
        const subjMap: Record<number, AltDersEntry> = {}
        subjRes.data?.forEach((s) => {
          subjMap[s.exam_subject_id] = {
            questionCount: s.question_count,
            correct: s.correct_count,
            wrong: s.wrong_count,
            entered: true,
          }
        })
        setSubjectEntries(subjMap)

        // Konular
        const topMap: Record<number, TopicEntry> = {}
        topRes.data?.forEach((t) => {
          topMap[t.exam_topic_id] = {
            questionCount: t.question_count,
            correct: t.correct_count,
            wrong: t.wrong_count,
            entered: true,
          }
        })
        setTopicEntries(topMap)

        // Konusu girilmiş alt derslerin akordeonlarını açık yap
        if (topRes.data && topRes.data.length > 0) {
          const topicIds = new Set(topRes.data.map((t) => t.exam_topic_id))
          const autoExpand: Record<number, boolean> = {}
          catalogTopics.forEach((t) => {
            if (topicIds.has(t.id)) {
              autoExpand[t.exam_subject_id] = true
            }
          })
          setExpandedTopics((prev) => ({ ...prev, ...autoExpand }))
        }
      } catch (err) {
        if (!isMounted) return
        setErrorMsg(err instanceof Error ? err.message : 'Sınav düzenleme verisi yüklenemedi.')
      } finally {
        if (isMounted) setLoadingEditData(false)
      }
    }

    loadEditingExam(currentExamId)

    return () => {
      isMounted = false
    }
  }, [editingExamId, catalogTopics])

  // Ceza katsayısı
  const penalty = wrongPenaltyFor(examType)

  // Bölümlerin nihai durumu (Ayrıntılı / Elle)
  const computedSections = useMemo(() => {
    return activeSectionTemplates.map((template) => {
      const sectionName = template.name
      // Bu bölüme ait katalog alt dersleri
      const sectionSubjects = currentExamSubjects.filter((s) => s.section_name === sectionName)

      // Seçmeli dersleri ele (her gruptan sadece seçili olan kalır)
      const activeSubjects = sectionSubjects.filter((s) => {
        if (!s.choice_group) return true
        return choiceSelections[s.choice_group] === s.id
      })

      const hasAltDersKatalog = activeSubjects.length > 0
      const enteredSubjects = activeSubjects.filter((s) => {
        const entry = subjectEntries[s.id]
        return entry && entry.entered
      })
      const hasAnyEntered = enteredSubjects.length > 0
      const allEntered = hasAltDersKatalog && activeSubjects.length > 0 && enteredSubjects.length === activeSubjects.length

      // Alt ders kataloğu varsa ve en az bir alt ders girilmişse: alt derslerden topla
      if (hasAltDersKatalog && hasAnyEntered) {
        const correct = activeSubjects.reduce((sum, s) => sum + (subjectEntries[s.id]?.correct || 0), 0)
        const wrong = activeSubjects.reduce((sum, s) => sum + (subjectEntries[s.id]?.wrong || 0), 0)
        const totalQ = activeSubjects.reduce((sum, s) => sum + (subjectEntries[s.id]?.questionCount || s.question_count), 0)
        const blank = Math.max(0, totalQ - correct - wrong)
        const net = calcNet(correct, wrong, penalty)
        const accuracy = calcSubjectAccuracy(net, totalQ)

        return {
          name: sectionName,
          max: totalQ,
          katsayi: template.katsayi,
          isDetailed: true,
          allEntered,
          hasAltDersKatalog,
          activeSubjects,
          correct,
          wrong,
          blank,
          net,
          accuracy,
        }
      }

      // Elle girilen / portaldan gelen bölüm
      const manual = manualSections[sectionName] || { correct: 0, wrong: 0 }
      const max = template.max
      const blank = Math.max(0, max - manual.correct - manual.wrong)
      const net = calcNet(manual.correct, manual.wrong, penalty)
      const accuracy = calcSubjectAccuracy(net, max)

      return {
        name: sectionName,
        max,
        katsayi: template.katsayi,
        isDetailed: false,
        allEntered: false,
        hasAltDersKatalog,
        activeSubjects,
        correct: manual.correct,
        wrong: manual.wrong,
        blank,
        net,
        accuracy,
      }
    })
  }, [activeSectionTemplates, currentExamSubjects, choiceSelections, subjectEntries, manualSections, penalty])

  // Canlı Toplam Özet Balonları (Soru · Doğru · Yanlış · Boş · Net)
  const summaryBubbles = useMemo(() => {
    let totalQuestions = 0
    let totalCorrect = 0
    let totalWrong = 0
    let totalBlank = 0
    let totalNet = 0

    computedSections.forEach((sec) => {
      totalQuestions += sec.max
      totalCorrect += sec.correct
      totalWrong += sec.wrong
      totalBlank += sec.blank
      totalNet += sec.net
    })

    const roundedNet = round2(totalNet)
    const accuracy = totalQuestions > 0 ? round2((totalCorrect / totalQuestions) * 100) : 0

    const weighted =
      examType === 'LGS'
        ? weightedNet(computedSections.map((s) => ({ section_name: s.name, net: s.net })))
        : null

    return {
      totalQuestions,
      totalCorrect,
      totalWrong,
      totalBlank,
      totalNet: roundedNet,
      accuracy,
      weightedNet: weighted != null ? round2(weighted) : null,
    }
  }, [computedSections, examType])

  // Input değişiklik handlers
  const handleManualSectionChange = (sectionName: string, field: 'correct' | 'wrong', val: number) => {
    setManualSections((prev) => ({
      ...prev,
      [sectionName]: {
        correct: field === 'correct' ? val : prev[sectionName]?.correct || 0,
        wrong: field === 'wrong' ? val : prev[sectionName]?.wrong || 0,
      },
    }))
  }

  const handleAltDersChange = (
    subjectId: number,
    field: 'correct' | 'wrong' | 'questionCount',
    val: number,
    defaultQuestionCount: number,
  ) => {
    setSubjectEntries((prev) => {
      const curr = prev[subjectId] || {
        questionCount: defaultQuestionCount,
        correct: 0,
        wrong: 0,
        entered: false,
      }
      return {
        ...prev,
        [subjectId]: {
          ...curr,
          [field]: val,
          entered: true, // Kullanıcı değer girdiği an girilmiş sayılır
        },
      }
    })
  }

  const handleTopicChange = (
    topicId: number,
    field: 'questionCount' | 'correct' | 'wrong',
    val: number,
  ) => {
    setTopicEntries((prev) => {
      const curr = prev[topicId] || { questionCount: 0, correct: 0, wrong: 0, entered: false }
      const updated = {
        ...curr,
        [field]: val,
      }
      // Soru sayısı > 0 veya doğru/yanlış girilmişse entered true olur
      updated.entered = updated.questionCount > 0 || updated.correct > 0 || updated.wrong > 0
      return {
        ...prev,
        [topicId]: updated,
      }
    })
  }

  const handleRankChange = (type: string, field: 'sira' | 'katilan', val: number | undefined) => {
    setRanks((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: val,
      },
    }))
  }

  // + Konu Ekle (kataloğa satır ekler)
  const handleAddTopic = async (subjectId: number) => {
    const name = newTopicInputs[subjectId]?.trim()
    if (!name) return

    setAddingTopicFor(subjectId)
    setErrorMsg(null)

    try {
      const maxSortOrder = catalogTopics
        .filter((t) => t.exam_subject_id === subjectId)
        .reduce((max, t) => Math.max(max, t.sort_order), 0)

      const { data, error } = await supabase
        .from('exam_topics')
        .insert({
          exam_subject_id: subjectId,
          name,
          grades: [],
          sort_order: maxSortOrder + 1,
          is_active: true,
        })
        .select('*')
        .single()

      if (error) throw error
      if (data) {
        setCatalogTopics((prev) => [...prev, data])
        setNewTopicInputs((prev) => ({ ...prev, [subjectId]: '' }))
        // Yeni konuyu hemen formda açık tut
        setExpandedTopics((prev) => ({ ...prev, [subjectId]: true }))
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Yeni konu kataloğa eklenemedi.')
    } finally {
      setAddingTopicFor(null)
    }
  }

  // Form doğrulama
  const validateForm = (): string | null => {
    if (!selectedStudentId) return 'Lütfen bir öğrenci seçin.'
    if (!examName.trim()) return 'Lütfen deneme adını girin.'
    if (!examDate) return 'Lütfen sınav tarihini girin.'

    // 1. Bölüm kontrolleri
    for (const sec of computedSections) {
      if (!sec.isDetailed) {
        if (sec.correct < 0 || sec.wrong < 0) return `${sec.name} bölümünde negatif değer girilemez.`
        if (sec.correct + sec.wrong > sec.max) {
          return `${sec.name} bölümünde Doğru (${sec.correct}) + Yanlış (${sec.wrong}) toplam soru sayısını (${sec.max}) aşıyor!`
        }
      }
    }

    // 2. Alt ders kontrolleri
    for (const sec of computedSections) {
      if (sec.hasAltDersKatalog) {
        for (const subj of sec.activeSubjects) {
          const entry = subjectEntries[subj.id]
          if (entry && entry.entered) {
            const qCount = entry.questionCount || subj.question_count
            if (entry.correct < 0 || entry.wrong < 0) {
              return `${subj.label} alt dersinde negatif değer girilemez.`
            }
            if (entry.correct + entry.wrong > qCount) {
              return `${subj.label} alt dersinde Doğru (${entry.correct}) + Yanlış (${entry.wrong}) toplam soru sayısını (${qCount}) aşıyor!`
            }
          }
        }
      }
    }

    // 3. Konu kontrolleri
    for (const [topicIdStr, entry] of Object.entries(topicEntries)) {
      if (entry && entry.entered && entry.questionCount > 0) {
        const topic = catalogTopics.find((t) => t.id === Number(topicIdStr))
        const topicName = topic?.name || 'Bir konu'
        if (entry.correct < 0 || entry.wrong < 0) {
          return `${topicName} konusunda negatif değer girilemez.`
        }
        if (entry.correct + entry.wrong > entry.questionCount) {
          return `${topicName} konusunda Doğru (${entry.correct}) + Yanlış (${entry.wrong}) soru sayısını (${entry.questionCount}) aşıyor!`
        }
      }
    }

    return null
  }

  // Klavye akışı: Enter ile bir alt satıra inme
  const formRef = useRef<HTMLDivElement>(null)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const inputs = Array.from(
        formRef.current?.querySelectorAll<HTMLInputElement>(
          'input[type="number"]:not([disabled]):not([readonly])'
        ) || []
      )
      const currentIndex = inputs.indexOf(e.currentTarget)
      if (currentIndex >= 0 && currentIndex < inputs.length - 1) {
        inputs[currentIndex + 1].focus()
        inputs[currentIndex + 1].select()
      }
    }
  }

  // Kayıt işlemi (Tek RPC: save_exam_report)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const validationError = validateForm()
    if (validationError) {
      setErrorMsg(validationError)
      return
    }

    setSaving(true)

    try {
      // 1. Bölümler listesi
      const sectionsPayload = computedSections.map((sec) => ({
        section_name: sec.name,
        max_questions: sec.max,
        correct_count: sec.correct,
        wrong_count: sec.wrong,
      }))

      // 2. Alt dersler listesi (Yalnız girilmiş olanlar)
      const subjectResultsPayload: Array<{
        exam_subject_id: number
        question_count: number
        correct_count: number
        wrong_count: number
      }> = []

      computedSections.forEach((sec) => {
        sec.activeSubjects.forEach((subj) => {
          const entry = subjectEntries[subj.id]
          if (entry && entry.entered) {
            subjectResultsPayload.push({
              exam_subject_id: subj.id,
              question_count: entry.questionCount || subj.question_count,
              correct_count: entry.correct,
              wrong_count: entry.wrong,
            })
          }
        })
      })

      // 3. Konular listesi (Yalnız soru sayısı > 0 ve girilmiş olanlar)
      const topicResultsPayload: Array<{
        exam_topic_id: number
        question_count: number
        correct_count: number
        wrong_count: number
      }> = []

      Object.entries(topicEntries).forEach(([topicIdStr, entry]) => {
        if (entry && entry.entered && entry.questionCount > 0) {
          topicResultsPayload.push({
            exam_topic_id: Number(topicIdStr),
            question_count: entry.questionCount,
            correct_count: entry.correct,
            wrong_count: entry.wrong,
          })
        }
      })

      // 4. Temizlenmiş Ranks nesnesi
      const cleanRanks: Record<string, { sira?: number; katilan?: number }> = {}
      Object.entries(ranks).forEach(([key, val]) => {
        if (val && (val.sira != null || val.katilan != null)) {
          cleanRanks[key] = {
            ...(val.sira != null ? { sira: val.sira } : {}),
            ...(val.katilan != null ? { katilan: val.katilan } : {}),
          }
        }
      })

      const payload: SaveExamReportPayload = {
        ...(editingExamId ? { id: editingExamId } : {}),
        student_id: selectedStudentId,
        name: examName.trim(),
        publisher: publisher.trim() || null,
        exam_type: examType,
        exam_date: examDate,
        score: score ? Number(score) : null,
        percentile: percentile ? Number(percentile) : null,
        ranks: Object.keys(cleanRanks).length > 0 ? cleanRanks : null,
        coach_note: coachNote.trim() || null,
        sections: sectionsPayload,
        subject_results: subjectResultsPayload,
        topic_results: topicResultsPayload,
      }

      const { data: savedExamId, error } = await supabase.rpc('save_exam_report', {
        p_payload: payload as any,
      })

      if (error) throw error

      setSuccessMsg(
        editingExamId
          ? 'Deneme karnesi başarıyla güncellendi!'
          : 'Yeni deneme karnesi başarıyla kaydedildi!'
      )

      // Yeni deneme ise formu temizle
      if (!editingExamId) {
        setExamName('')
        setPublisher('')
        setScore('')
        setPercentile('')
        setCoachNote('')
        setRanks({})
        setManualSections({})
        setSubjectEntries({})
        setTopicEntries({})
      }

      onSaveSuccess(savedExamId)
    } catch (err) {
      console.error('Kayıt hatası:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Deneme kaydedilirken beklenmedik bir hata oluştu.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={formRef} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Düzenleme Modu Banner */}
      {editingExamId && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            background: 'var(--indigo-050)',
            border: '1px solid var(--indigo-500)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Award size={18} color="var(--indigo-700)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--indigo-900)' }}>
                Düzenleme Modu: {examName || 'Deneme Karnesi'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--indigo-700)' }}>
                Yapılan değişiklikler mevcut deneme kaydının üzerine kaydedilecek ve çıkarılan konular temizlenecektir.
              </div>
            </div>
          </div>
          {onCancelEdit && (
            <button
              type="button"
              className="btn"
              onClick={onCancelEdit}
              style={{ fontSize: 12.5, padding: '6px 12px', background: 'var(--surface)' }}
            >
              <RotateCcw size={14} /> Vazgeç / Yeni Deneme
            </button>
          )}
        </div>
      )}

      {/* ÜST BİLGİ VE CANLI ÖZET ŞERİDİ */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {/* Sol: Öğrenci ve Sınav Üst Bilgileri */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: '1 1 500px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div className="field">
                <label>Öğrenci</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => onStudentChange(e.target.value)}
                  disabled={!!editingExamId}
                  style={{ fontWeight: 600 }}
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.grade}{s.track ? ` · ${s.track}` : ''})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Sınav Türü</label>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value as ExamType)}
                  disabled={studentCurriculum === 'LGS' || !!editingExamId}
                  style={{ fontWeight: 700 }}
                >
                  {studentCurriculum === 'LGS' ? (
                    <option value="LGS">LGS</option>
                  ) : (
                    <>
                      <option value="TYT">TYT</option>
                      <option value="AYT">AYT</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Sınav Adı</label>
                <input
                  type="text"
                  placeholder="Örn: 3D Türkiye Geneli - 1"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label>Yayıncı / Kurum</label>
                <input
                  type="text"
                  placeholder="Örn: 3D Yayınları"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Tarih</label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Sağ: Canlı Karne Özet Balonları */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 8,
              background: 'var(--surface-alt)',
              padding: '14px 18px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-soft)',
              minWidth: 280,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Canlı Karne Özeti
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ textAlign: 'center', minWidth: 44 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Soru</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{summaryBubbles.totalQuestions}</div>
              </div>
              <div style={{ textAlign: 'center', minWidth: 44 }}>
                <div style={{ fontSize: 11, color: 'var(--success)' }}>Doğru</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>{summaryBubbles.totalCorrect}</div>
              </div>
              <div style={{ textAlign: 'center', minWidth: 44 }}>
                <div style={{ fontSize: 11, color: 'var(--critical)' }}>Yanlış</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--critical)' }}>{summaryBubbles.totalWrong}</div>
              </div>
              <div style={{ textAlign: 'center', minWidth: 44 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Boş</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-faint)' }}>{summaryBubbles.totalBlank}</div>
              </div>
              <div
                style={{
                  textAlign: 'center',
                  minWidth: 64,
                  padding: '2px 8px',
                  borderRadius: 8,
                  background: 'var(--indigo-050)',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--indigo-700)' }}>Net</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--indigo-600)' }}>
                  {summaryBubbles.totalNet.toFixed(2).replace('.', ',')}
                </div>
              </div>
            </div>

            {summaryBubbles.weightedNet !== null && (
              <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                Ağırlıklı Net (LGS): <strong style={{ color: 'var(--ink)' }}>{summaryBubbles.weightedNet.toFixed(2).replace('.', ',')}</strong>
              </div>
            )}
          </div>
        </div>

        {/* İsteğe Bağlı: Puan, Sıralama ve Koç Notu Paneli */}
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border-soft)', paddingTop: 12 }}>
          <button
            type="button"
            onClick={() => setShowRankPanel((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              color: 'var(--indigo-600)',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <Sliders size={14} />
            {showRankPanel ? 'Puan, Sıralama ve Koç Notunu Gizle' : 'Puan, Sıralama ve Koç Notu Ekle (İsteğe bağlı)'}
            {showRankPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showRankPanel && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
              {/* Puan ve Yüzdelik */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div className="field">
                  <label>Yayının Açıkladığı Puan</label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Örn: 426.442"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Yüzdelik Dilim (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Örn: 7.34"
                    value={percentile}
                    onChange={(e) => setPercentile(e.target.value)}
                  />
                </div>
              </div>

              {/* Sıralamalar (Şube / Kurum / İlçe / İl / Genel) */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 6, display: 'block' }}>
                  Sıralamalar (Sıra / Katılan)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                  {(['genel', 'kurum', 'sube', 'il', 'ilce'] as const).map((rankKey) => {
                    const labelMap = { genel: 'Genel', kurum: 'Kurum', sube: 'Şube', il: 'İl', ilce: 'İlçe' }
                    return (
                      <div
                        key={rankKey}
                        style={{
                          background: 'var(--surface-alt)',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-soft)',
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 4 }}>
                          {labelMap[rankKey]}
                        </div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input
                            type="number"
                            placeholder="Sıra"
                            min="1"
                            value={ranks[rankKey]?.sira ?? ''}
                            onChange={(e) =>
                              handleRankChange(rankKey, 'sira', e.target.value ? parseInt(e.target.value, 10) : undefined)
                            }
                            style={{ width: '50%', padding: '4px 6px', fontSize: 12 }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>/</span>
                          <input
                            type="number"
                            placeholder="Kişi"
                            min="1"
                            value={ranks[rankKey]?.katilan ?? ''}
                            onChange={(e) =>
                              handleRankChange(rankKey, 'katilan', e.target.value ? parseInt(e.target.value, 10) : undefined)
                            }
                            style={{ width: '50%', padding: '4px 6px', fontSize: 12 }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Koçun Notu */}
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MessageSquare size={13} /> Koçun Notu
                  </label>
                  <span className="badge badge-neutral" style={{ fontSize: 10.5 }}>
                    öğrenci ve veli görür
                  </span>
                </div>
                <textarea
                  rows={2}
                  placeholder="Bu denemeye özel geri bildirim veya koç notunuz..."
                  value={coachNote}
                  onChange={(e) => setCoachNote(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Yükleme / Durum Mesajları */}
      {loadingCatalog && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--ink-soft)' }}>
          Katalog konuları yükleniyor…
        </div>
      )}

      {loadingEditData && (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--indigo-600)' }}>
          Deneme ve konu ayrıntıları yükleniyor…
        </div>
      )}

      {/* BÖLÜM KARTLARI IZGARASI (Karnedeki Renk Blokları Düzeni) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 20 }}>
        {computedSections.map((sec) => {
          const colorTheme = getSectionColor(sec.name)

          return (
            <div
              key={sec.name}
              className="card"
              style={{
                padding: 18,
                borderTop: `4px solid ${colorTheme.border}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              {/* Bölüm Başlığı ve Canlı Bölüm Neti */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                    {sec.name}
                  </h3>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                    Maksimum: {sec.max} soru
                    {sec.katsayi ? ` · katsayı ${sec.katsayi}` : ''}
                    {sec.isDetailed && (
                      <span className="badge badge-success" style={{ marginLeft: 6, fontSize: 10 }}>
                        {sec.allEntered ? 'Alt derslerden otomatik' : 'Alt derslerden'}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: colorTheme.border }}>
                      {sec.net.toFixed(2).replace('.', ',')} net
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--ink-faint)' }}>%{sec.accuracy.toFixed(0)} başarı</div>
                  </div>
                </div>
              </div>

              {/* Alt Ders Tablosu */}
              {sec.hasAltDersKatalog ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--ink-soft)' }}>
                        <th style={{ textAlign: 'left', padding: '6px 4px' }}>Ders</th>
                        <th style={{ textAlign: 'center', width: 44 }}>Soru</th>
                        <th style={{ textAlign: 'center', width: 48 }}>Doğru</th>
                        <th style={{ textAlign: 'center', width: 48 }}>Yanlış</th>
                        <th style={{ textAlign: 'center', width: 36 }}>Boş</th>
                        <th style={{ textAlign: 'right', width: 48 }}>Net</th>
                        <th style={{ textAlign: 'right', width: 48 }}>Başarı</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sec.activeSubjects.map((subj) => {
                        const entry = subjectEntries[subj.id] || {
                          questionCount: subj.question_count,
                          correct: 0,
                          wrong: 0,
                          entered: false,
                        }

                        const dVal = entry.entered ? entry.correct : ''
                        const yVal = entry.entered ? entry.wrong : ''
                        const qVal = entry.questionCount || subj.question_count
                        const blank = Math.max(0, qVal - entry.correct - entry.wrong)
                        const subNet = calcNet(entry.correct, entry.wrong, penalty)
                        const subAcc = calcSubjectAccuracy(subNet, qVal)
                        const isExpanded = !!expandedTopics[subj.id]

                        // Konular bu alt derse ait
                        const subjectTopics = catalogTopics.filter(
                          (t) =>
                            t.exam_subject_id === subj.id &&
                            (!currentStudent || t.grades.length === 0 || t.grades.includes(currentStudent.grade))
                        )

                        // Tutarlılık hesabı (Konu toplamları vs Alt ders)
                        let topicTotalQ = 0
                        let topicTotalD = 0
                        let topicTotalY = 0
                        subjectTopics.forEach((t) => {
                          const topEntry = topicEntries[t.id]
                          if (topEntry && topEntry.entered && topEntry.questionCount > 0) {
                            topicTotalQ += topEntry.questionCount
                            topicTotalD += topEntry.correct
                            topicTotalY += topEntry.wrong
                          }
                        })

                        const hasTopicData = topicTotalQ > 0
                        const isMismatch =
                          hasTopicData &&
                          (topicTotalQ !== qVal || topicTotalD !== entry.correct || topicTotalY !== entry.wrong)

                        return (
                          <tr key={subj.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                            <td colSpan={7} style={{ padding: '8px 0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                {/* minWidth: 0 — seçmeli ders kutusu (ör. "Din Kültürü") daralabilsin; yoksa
                                    satırı genişletip Net/Başarı sütunlarını kartın dışına itiyordu. */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                                  {/* Seçmeli grup geçiş anahtarı */}
                                  {subj.choice_group ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                                      <select
                                        value={choiceSelections[subj.choice_group] ?? subj.id}
                                        onChange={(e) =>
                                          setChoiceSelections((prev) => ({
                                            ...prev,
                                            [subj.choice_group!]: Number(e.target.value),
                                          }))
                                        }
                                        style={{ fontSize: 12, padding: '3px 6px', fontWeight: 600, width: 112, maxWidth: '100%', minWidth: 0 }}
                                      >
                                        {catalogSubjects
                                          .filter((cs) => cs.choice_group === subj.choice_group)
                                          .map((cs) => (
                                            <option key={cs.id} value={cs.id}>
                                              {cs.label}
                                            </option>
                                          ))}
                                      </select>
                                    </div>
                                  ) : (
                                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{subj.label}</span>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedTopics((prev) => ({ ...prev, [subj.id]: !prev[subj.id] }))
                                    }
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--indigo-600)',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      padding: '2px 4px',
                                    }}
                                  >
                                    Konular ({subjectTopics.length})
                                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  </button>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                  {/* Soru sayısı */}
                                  <input
                                    type="number"
                                    min="1"
                                    value={qVal}
                                    onChange={(e) =>
                                      handleAltDersChange(
                                        subj.id,
                                        'questionCount',
                                        parseInt(e.target.value, 10) || subj.question_count,
                                        subj.question_count
                                      )
                                    }
                                    onFocus={(e) => e.target.select()}
                                    onKeyDown={handleKeyDown}
                                    style={{ width: 44, padding: '4px', textAlign: 'center', fontSize: 12 }}
                                    title="Soru sayısı (değiştirilebilir)"
                                  />

                                  {/* Doğru sayısı */}
                                  <input
                                    type="number"
                                    min="0"
                                    max={qVal}
                                    placeholder="D"
                                    value={dVal}
                                    onChange={(e) =>
                                      handleAltDersChange(
                                        subj.id,
                                        'correct',
                                        e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0,
                                        qVal
                                      )
                                    }
                                    onFocus={(e) => e.target.select()}
                                    onKeyDown={handleKeyDown}
                                    style={{
                                      width: 48,
                                      padding: '4px',
                                      textAlign: 'center',
                                      fontSize: 12,
                                      borderColor: entry.entered && entry.correct + entry.wrong > qVal ? 'var(--critical)' : undefined,
                                    }}
                                  />

                                  {/* Yanlış sayısı */}
                                  <input
                                    type="number"
                                    min="0"
                                    max={qVal}
                                    placeholder="Y"
                                    value={yVal}
                                    onChange={(e) =>
                                      handleAltDersChange(
                                        subj.id,
                                        'wrong',
                                        e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0,
                                        qVal
                                      )
                                    }
                                    onFocus={(e) => e.target.select()}
                                    onKeyDown={handleKeyDown}
                                    style={{
                                      width: 48,
                                      padding: '4px',
                                      textAlign: 'center',
                                      fontSize: 12,
                                      borderColor: entry.entered && entry.correct + entry.wrong > qVal ? 'var(--critical)' : undefined,
                                    }}
                                  />

                                  {/* Boş */}
                                  <span style={{ width: 36, textAlign: 'center', fontSize: 11.5, color: 'var(--ink-faint)' }}>
                                    {entry.entered ? blank : '—'}
                                  </span>

                                  {/* Net */}
                                  <span style={{ width: 48, textAlign: 'right', fontWeight: 700, fontSize: 12, color: 'var(--indigo-600)' }}>
                                    {entry.entered ? subNet.toFixed(2).replace('.', ',') : '—'}
                                  </span>

                                  {/* Başarı % */}
                                  <span style={{ width: 48, textAlign: 'right', fontSize: 11.5, color: 'var(--ink-soft)' }}>
                                    {entry.entered ? `%${subAcc.toFixed(0)}` : '—'}
                                  </span>
                                </div>
                              </div>

                              {/* AÇILIR KONULAR TABLOSU */}
                              {isExpanded && (
                                <div
                                  style={{
                                    marginTop: 8,
                                    padding: '10px 12px',
                                    background: 'var(--surface-alt)',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-soft)',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>
                                      {subj.label} Konuları
                                    </span>
                                    <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
                                      Soru sayısı (S) girilmeyen satırlar kaydedilmez
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {subjectTopics.map((top) => {
                                      const topEntry = topicEntries[top.id] || {
                                        questionCount: 0,
                                        correct: 0,
                                        wrong: 0,
                                        entered: false,
                                      }
                                      const sVal = topEntry.entered && topEntry.questionCount > 0 ? topEntry.questionCount : ''
                                      const dTopVal = topEntry.entered && topEntry.questionCount > 0 ? topEntry.correct : ''
                                      const yTopVal = topEntry.entered && topEntry.questionCount > 0 ? topEntry.wrong : ''
                                      const bTopVal = Math.max(0, topEntry.questionCount - topEntry.correct - topEntry.wrong)
                                      const topAcc = calcTopicAccuracy(topEntry.correct, topEntry.questionCount)

                                      return (
                                        <div
                                          key={top.id}
                                          style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '3px 0',
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontSize: 12,
                                              color: topEntry.entered && topEntry.questionCount > 0 ? 'var(--ink)' : 'var(--ink-soft)',
                                              flex: 1,
                                            }}
                                          >
                                            {top.name}
                                          </span>

                                          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                            {/* Soru */}
                                            <input
                                              type="number"
                                              min="0"
                                              placeholder="S"
                                              value={sVal}
                                              onChange={(e) =>
                                                handleTopicChange(
                                                  top.id,
                                                  'questionCount',
                                                  e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0
                                                )
                                              }
                                              onFocus={(e) => e.target.select()}
                                              onKeyDown={handleKeyDown}
                                              style={{ width: 42, padding: '3px 4px', fontSize: 11.5, textAlign: 'center' }}
                                            />

                                            {/* Doğru */}
                                            <input
                                              type="number"
                                              min="0"
                                              max={topEntry.questionCount}
                                              placeholder="D"
                                              value={dTopVal}
                                              onChange={(e) =>
                                                handleTopicChange(
                                                  top.id,
                                                  'correct',
                                                  e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0
                                                )
                                              }
                                              onFocus={(e) => e.target.select()}
                                              onKeyDown={handleKeyDown}
                                              style={{ width: 42, padding: '3px 4px', fontSize: 11.5, textAlign: 'center' }}
                                            />

                                            {/* Yanlış */}
                                            <input
                                              type="number"
                                              min="0"
                                              max={topEntry.questionCount}
                                              placeholder="Y"
                                              value={yTopVal}
                                              onChange={(e) =>
                                                handleTopicChange(
                                                  top.id,
                                                  'wrong',
                                                  e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0
                                                )
                                              }
                                              onFocus={(e) => e.target.select()}
                                              onKeyDown={handleKeyDown}
                                              style={{ width: 42, padding: '3px 4px', fontSize: 11.5, textAlign: 'center' }}
                                            />

                                            {/* Boş */}
                                            <span style={{ width: 30, textAlign: 'center', fontSize: 11, color: 'var(--ink-faint)' }}>
                                              {topEntry.entered && topEntry.questionCount > 0 ? bTopVal : '—'}
                                            </span>

                                            {/* Başarı % */}
                                            <span style={{ width: 40, textAlign: 'right', fontSize: 11, color: 'var(--ink-soft)' }}>
                                              {topEntry.entered && topEntry.questionCount > 0 ? `%${topAcc.toFixed(0)}` : '—'}
                                            </span>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>

                                  {/* Tutarlılık Çubuğu */}
                                  {hasTopicData && (
                                    <div
                                      style={{
                                        marginTop: 8,
                                        padding: '7px 12px',
                                        borderRadius: 6,
                                        fontSize: 11.5,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: 8,
                                        background: isMismatch ? 'var(--warning-bg)' : 'var(--success-bg)',
                                        color: isMismatch ? 'var(--warning-text)' : 'var(--success-text)',
                                        border: `1px solid ${isMismatch ? 'var(--warning-border)' : 'var(--success-border)'}`,
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {isMismatch ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                                        <span>
                                          {isMismatch
                                            ? `Konular ${topicTotalQ} soru · ${topicTotalD} D · ${topicTotalY} Y, ders ${qVal} soru · ${entry.correct} D · ${entry.wrong} Y: fark var`
                                            : `Konular dersle tam uyumlu (${topicTotalQ} soru · ${topicTotalD} D · ${topicTotalY} Y)`}
                                        </span>
                                      </div>
                                      <span style={{ fontSize: 10.5, opacity: 0.9 }}>
                                        {isMismatch ? 'Uyarı: kaydı engellemez' : 'Uyumlu'}
                                      </span>
                                    </div>
                                  )}

                                  {/* + Konu Ekle Butonu / Girişi */}
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
                                    <input
                                      type="text"
                                      placeholder="Yeni konu adı…"
                                      value={newTopicInputs[subj.id] || ''}
                                      onChange={(e) =>
                                        setNewTopicInputs((prev) => ({ ...prev, [subj.id]: e.target.value }))
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault()
                                          handleAddTopic(subj.id)
                                        }
                                      }}
                                      style={{ padding: '4px 8px', fontSize: 11.5, flex: 1 }}
                                    />
                                    <button
                                      type="button"
                                      className="btn"
                                      disabled={addingTopicFor === subj.id || !newTopicInputs[subj.id]?.trim()}
                                      onClick={() => handleAddTopic(subj.id)}
                                      style={{ fontSize: 11, padding: '4px 8px' }}
                                    >
                                      <Plus size={12} /> {addingTopicFor === subj.id ? 'Ekleniyor…' : 'Konu Ekle'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Alt ders kataloğu olmayan bölüm: Doğrudan Bölüm Elle Girişi */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                    Bu bölüm için alt ders kataloğu bulunmuyor, skorları doğrudan bölüm olarak girin:
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div className="field" style={{ flex: 1 }}>
                      <label>Doğru</label>
                      <input
                        type="number"
                        min="0"
                        max={sec.max}
                        value={sec.correct || ''}
                        onChange={(e) =>
                          handleManualSectionChange(sec.name, 'correct', parseInt(e.target.value, 10) || 0)
                        }
                        onFocus={(e) => e.target.select()}
                        onKeyDown={handleKeyDown}
                      />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label>Yanlış</label>
                      <input
                        type="number"
                        min="0"
                        max={sec.max}
                        value={sec.wrong || ''}
                        onChange={(e) =>
                          handleManualSectionChange(sec.name, 'wrong', parseInt(e.target.value, 10) || 0)
                        }
                        onFocus={(e) => e.target.select()}
                        onKeyDown={handleKeyDown}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Hata ve Başarı Bildirimleri */}
      {errorMsg && (
        <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Kaydet Düğmesi */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
        {onCancelEdit && (
          <button type="button" className="btn" onClick={onCancelEdit} disabled={saving}>
            Vazgeç
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ minWidth: 200, padding: '12px 24px', fontSize: 14 }}
        >
          <Save size={16} /> {saving ? 'Kaydediliyor…' : editingExamId ? 'Değişiklikleri Kaydet' : 'Deneme Karnesini Kaydet'}
        </button>
      </div>
    </div>
  )
}
