import { useState, useEffect, useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type {
  ExamType,
  ExamSubject,
  ExamTopic,
  MockExamSection,
  MockExamSubjectResult,
  MockExamTopicResult,
  ErrorBasketItem,
} from '../../types/database'
import ErrorReasonModal from './ErrorReasonModal'
import {
  generateExamReport,
  type RawExamRecord,
  type ExamReportCatalog,
  type ExamTopicLinkInfo,
  type HomeworkItem,
  type ExamReportResult,
  type TopicRowData,
} from '../../lib/examReport'
import {
  extractInsights,
  formatRoleInsights,
  type RoleInsightItem,
} from '../../lib/examInsights'
import { type ChartPalette, DEFAULT_CHART_PALETTE } from '../charts/chartPalette'
import AddToProgramPopover from '../program/AddToProgramPopover'
import DrillNav from './drilldown/DrillNav'
import LevelGeneral from './drilldown/LevelGeneral'
import LevelExam from './drilldown/LevelExam'
import LevelSubject from './drilldown/LevelSubject'
import LevelTopic from './drilldown/LevelTopic'
import LevelCurriculum from './drilldown/LevelCurriculum'
import { INITIAL_DRILL, type DrillProps, type DrillState } from './drilldown/types'

export interface StudentExamAnalysisViewProps {
  studentId: string
  studentName?: string
  palette?: Partial<ChartPalette>
  role?: 'coach' | 'student' | 'parent'
  initialExamType?: ExamType
  /** Açılışta bu bölümün (örn. 'Matematik') en çok kaybettiren alt dersine inilir. */
  initialSection?: string
  initialCatalog?: ExamReportCatalog
  initialExams?: RawExamRecord[]
  targets?: { TYT?: number | null; AYT?: number | null; LGS?: number | null }
}

async function fetchByExamIds<T>(
  tableName: 'mock_exam_sections' | 'mock_exam_subject_results' | 'mock_exam_topic_results',
  examIds: string[]
): Promise<T[]> {
  if (examIds.length === 0) return []
  const chunkSize = 200
  const chunks: string[][] = []
  for (let i = 0; i < examIds.length; i += chunkSize) {
    chunks.push(examIds.slice(i, i + chunkSize))
  }

  let allResults: T[] = []
  for (const chunk of chunks) {
    let from = 0
    const pageSize = 1000
    while (true) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .in('mock_exam_id', chunk)
        .order('id')
        .range(from, from + pageSize - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      allResults = allResults.concat(data as unknown as T[])
      if (data.length < pageSize) break
      from += pageSize
    }
  }
  return allResults
}

export default function StudentExamAnalysisView({
  studentId,
  studentName,
  palette,
  role = 'coach',
  initialExamType,
  initialSection,
  initialCatalog,
  initialExams,
  targets: targetsProp,
}: StudentExamAnalysisViewProps) {
  const pal = { ...DEFAULT_CHART_PALETTE, ...palette }

  // Durum
  const [loading, setLoading] = useState(!initialCatalog || !initialExams)
  const [error, setError] = useState<string | null>(null)
  const [rawExams, setRawExams] = useState<RawExamRecord[]>(initialExams || [])
  const [catalog, setCatalog] = useState<ExamReportCatalog>(initialCatalog || { subjects: [], topics: [] })

  // Filtreler & Seviyeler
  const [selectedExamType, setSelectedExamType] = useState<ExamType | undefined>(initialExamType)
  const [drill, setDrill] = useState<DrillState>(INITIAL_DRILL)
  const go = (patch: Partial<DrillState>) => setDrill((d) => ({ ...d, ...patch }))
  const [programPopoverTarget, setProgramPopoverTarget] = useState<{
    examTopicId: number
    examTopicName: string
    suggestedType?: 'konu' | 'tekrar' | 'rutin' | 'sureli_test' | 'deneme'
  } | null>(null)

  // R4-4: Yanlış Nedenleri State
  const [errorBasketItems, setErrorBasketItems] = useState<ErrorBasketItem[]>([])
  const [coachTargets, setCoachTargets] = useState<{ TYT: number | null; AYT: number | null; LGS: number | null }>({
    TYT: null,
    AYT: null,
    LGS: null,
  })
  // Portalda hedefler prop ile gelir (== null: SQL uygulanmadan undefined olabilir).
  const targets = {
    TYT: targetsProp?.TYT ?? coachTargets.TYT,
    AYT: targetsProp?.AYT ?? coachTargets.AYT,
    LGS: targetsProp?.LGS ?? coachTargets.LGS,
  }
  // Birincil eşleme: karne konusu -> müfredat konusu (yalnız katalog.links; ad eşlemesi yok).
  const primaryTopicByExamTopic = useMemo(() => {
    const m = new Map<number, number>()
    for (const l of catalog.links ?? []) if (l.is_primary) m.set(l.exam_topic_id, l.topic_id)
    return m
  }, [catalog.links])
  const [errorModalTarget, setErrorModalTarget] = useState<{
    topicRow: TopicRowData & { subject_label: string }
    curriculumTopicId: number | null
  } | null>(null)

  // Veri yükleme
  useEffect(() => {
    let isMounted = true

    if (initialCatalog && initialExams) {
      setCatalog(initialCatalog)
      setRawExams(initialExams)
      setLoading(false)

      return () => {
        isMounted = false
      }
    }

    setLoading(true)
    setError(null)

    async function loadData() {
      try {
        // 1. Katalog
        const [subjRes, topicRes] = await Promise.all([
          supabase.from('exam_subjects').select('*').order('sort_order', { ascending: true }),
          supabase.from('exam_topics').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
        ])

        if (subjRes.error) throw subjRes.error
        if (topicRes.error) throw topicRes.error

        const catalogData: ExamReportCatalog = {
          subjects: (subjRes.data as ExamSubject[]) || [],
          topics: (topicRes.data as ExamTopic[]) || [],
        }

        // Bağlantılar, müfredat konuları, hedefler, ödev + konu testi (portal_exam_report ile aynı kurallar)
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 365)
        const cutoffStr = cutoff.toISOString().slice(0, 10)
        const weekCutoff = new Date(cutoff)
        weekCutoff.setDate(weekCutoff.getDate() - 7)
        const [linksRes, wtRes, tmRes, stRes] = await Promise.all([
          supabase.from('exam_topic_links').select('exam_topic_id, topic_id, is_primary').range(0, 1999),
          supabase
            .from('weekly_tasks')
            .select('topic_id, week_start, day_index, custom_label, question_count, correct_count, wrong_count, blank_count')
            .eq('student_id', studentId)
            .eq('block_kind', 'ders')
            .not('topic_id', 'is', null)
            .not('correct_count', 'is', null)
            .gt('question_count', 0)
            .gte('week_start', weekCutoff.toISOString().slice(0, 10))
            .range(0, 1999),
          supabase
            .from('topic_measurements')
            .select('topic_id, measured_at, source_label, correct_count, wrong_count, blank_count, accuracy_pct')
            .eq('student_id', studentId)
            .eq('source', 'konu_testi')
            .gte('measured_at', cutoffStr)
            .range(0, 1999),
          supabase.from('students').select('target_net_tyt, target_net_ayt, target_net_lgs').eq('id', studentId).maybeSingle(),
        ])
        if (linksRes.error) throw linksRes.error

        const links = (linksRes.data || []) as ExamTopicLinkInfo[]
        const wt = wtRes.data || []
        const tm = tmRes.data || []
        const linkTopicIds = [...new Set(links.map((l) => l.topic_id))]
        const allTopicIds = [...new Set([...linkTopicIds, ...wt.map((w) => w.topic_id as number), ...tm.map((t) => t.topic_id)])]
        const topicsRes = allTopicIds.length
          ? await supabase.from('topics').select('id, name, subject_id').in('id', allTopicIds)
          : { data: [] as { id: number; name: string; subject_id: number }[] }
        const topicRows = topicsRes.data || []
        const subjIds = [...new Set(topicRows.map((t) => t.subject_id))]
        const subjNamesRes = subjIds.length
          ? await supabase.from('subjects').select('id, name').in('id', subjIds)
          : { data: [] as { id: number; name: string }[] }
        const subjName = new Map((subjNamesRes.data || []).map((x) => [x.id, x.name]))
        const topicName = new Map(topicRows.map((t) => [t.id, t.name]))

        const addDays = (iso: string, n: number) => {
          const d = new Date(iso + 'T00:00:00Z')
          d.setUTCDate(d.getUTCDate() + n)
          return d.toISOString().slice(0, 10)
        }
        const homework: HomeworkItem[] = [
          ...wt.map((w): HomeworkItem => ({
            topic_id: w.topic_id as number,
            date: addDays(w.week_start, w.day_index),
            label: w.custom_label?.trim() ? w.custom_label : `${topicName.get(w.topic_id as number) ?? ''} · ${w.question_count} soru`,
            question_count: w.question_count as number,
            correct_count: w.correct_count ?? null,
            wrong_count: w.wrong_count ?? null,
            blank_count: w.blank_count ?? null,
            accuracy_pct: Math.round(((w.correct_count as number) * 1000) / (w.question_count as number)) / 10,
            kind: 'odev',
          })),
          ...tm.map((t): HomeworkItem => ({
            topic_id: t.topic_id,
            date: t.measured_at,
            label: t.source_label,
            question_count: (t.correct_count ?? 0) + (t.wrong_count ?? 0) + (t.blank_count ?? 0),
            correct_count: t.correct_count ?? null,
            wrong_count: t.wrong_count ?? null,
            blank_count: t.blank_count ?? null,
            accuracy_pct: t.accuracy_pct,
            kind: 'konu_testi',
          })),
        ]
          .filter((h) => h.date >= cutoffStr)
          .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
          .slice(0, 300)

        catalogData.links = links
        catalogData.curriculumTopics = linkTopicIds
          .filter((id) => topicName.has(id))
          .map((id) => {
            const t = topicRows.find((x) => x.id === id)!
            return { id, name: t.name, subject_name: subjName.get(t.subject_id) ?? '' }
          })
        catalogData.homework = homework
        if (isMounted && stRes.data) {
          setCoachTargets({
            TYT: stRes.data.target_net_tyt ?? null,
            AYT: stRes.data.target_net_ayt ?? null,
            LGS: stRes.data.target_net_lgs ?? null,
          })
        }

        if (isMounted) setCatalog(catalogData)

        // 2. Denemeler
        const { data: examsData, error: examsErr } = await supabase
          .from('mock_exams')
          .select('*')
          .eq('student_id', studentId)
          .order('exam_date', { ascending: true })

        if (examsErr) throw examsErr

        if (!examsData || examsData.length === 0) {
          if (isMounted) {
            setRawExams([])
            setLoading(false)
          }
          return
        }

        const examIds = examsData.map((e) => e.id)

        // 3. Bölümler, Alt Ders Sonuçları, Konu Sonuçları ve Hata Sepeti (1000 satır cap + 200 chunk korumalı)
        const [sections, subjectResults, topicResults, errorBasketRes] =
          await Promise.all([
            fetchByExamIds<MockExamSection>('mock_exam_sections', examIds),
            fetchByExamIds<MockExamSubjectResult>('mock_exam_subject_results', examIds),
            fetchByExamIds<MockExamTopicResult>('mock_exam_topic_results', examIds),
            supabase.from('error_basket_items').select('*').in('mock_exam_id', examIds),
          ])

        // RawExamRecord formatında birleştir
        const fullRecords: RawExamRecord[] = examsData.map((exam) => ({
          id: exam.id,
          student_id: exam.student_id,
          name: exam.name,
          publisher: exam.publisher,
          exam_type: exam.exam_type,
          exam_date: exam.exam_date,
          score: exam.score,
          percentile: exam.percentile,
          ranks: exam.ranks as any,
          coach_note: exam.coach_note,
          sections: sections.filter((s) => s.mock_exam_id === exam.id),
          subject_results: subjectResults.filter((s) => s.mock_exam_id === exam.id),
          topic_results: topicResults.filter((t) => t.mock_exam_id === exam.id),
        }))

        if (isMounted) {
          setRawExams(fullRecords)
          if (errorBasketRes.data) setErrorBasketItems(errorBasketRes.data as ErrorBasketItem[])
        }
      } catch (err) {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : 'Analiz verileri yüklenirken hata oluştu.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [studentId, initialCatalog, initialExams])

  // Rapor Motoru Çıktısı
  const report: ExamReportResult | null = useMemo(() => {
    if (rawExams.length === 0 || catalog.subjects.length === 0) return null
    return generateExamReport(rawExams, catalog, selectedExamType)
  }, [rawExams, catalog, selectedExamType])

  // Koç özetindeki "Nerede Net Kaybediyorlar?" satırından gelindiyse bir kez o bölüme in.
  const [pendingSection, setPendingSection] = useState(initialSection)
  useEffect(() => {
    if (!report || !pendingSection) return
    const worst = report.subjects.rows
      .filter((r) => r.section_name === pendingSection)
      .sort((a, b) => b.total_loss - a.total_loss)[0]
    if (worst) setDrill({ ...INITIAL_DRILL, level: 'subject', examSubjectId: worst.exam_subject_id })
    setPendingSection(undefined)
  }, [report, pendingSection])

  // Uyarılar / İçgörüler
  const insights: RoleInsightItem[] = useMemo(() => {
    if (!report) return []
    const raw = extractInsights(report)
    const formatted = formatRoleInsights(raw)
    return formatted[role]
  }, [report, role])

  // Mevcut sınav türleri
  const availableExamTypes = report?.available_exam_types || []

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-soft)' }}>
        Deneme analiz raporu hazırlanıyor…
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertCircle size={16} />
        <span>{error}</span>
      </div>
    )
  }

  if (!report || rawExams.length === 0) {
    return (
      <div className="card empty-state" style={{ padding: 40, textAlign: 'center' }}>
        <h3>Henüz Deneme Verisi Yok</h3>
        <p>
          {role === 'coach'
            ? 'Öğrenciye ait kayıtlı deneme karnesi bulunmuyor. Denemeler sayfasından yeni deneme ekleyebilirsiniz.'
            : 'Henüz kayıtlı bir deneme karnesi bulunmuyor.'}
        </p>
      </div>
    )
  }

  const drillProps: DrillProps = {
    report,
    catalog,
    exams: rawExams.filter((e) => e.exam_type === report.exam_type),
    role,
    palette: pal,
    targets,
    state: drill,
    go,
    onAddToProgram: (examTopicId, name) =>
      setProgramPopoverTarget({ examTopicId, examTopicName: name, suggestedType: 'sureli_test' }),
    errorItems: errorBasketItems,
    onErrorReason: (row) =>
      setErrorModalTarget({ topicRow: row, curriculumTopicId: primaryTopicByExamTopic.get(row.exam_topic_id) ?? null }),
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KONTROL ÇUBUĞU: Sınav Türü */}
      {availableExamTypes.length > 1 && (
        <div className="card" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, background: 'var(--surface-alt)', padding: 3, borderRadius: 8 }}>
            {availableExamTypes.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={report.exam_type === type}
                onClick={() => {
                  setSelectedExamType(type)
                  setDrill(INITIAL_DRILL)
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: report.exam_type === type ? 'var(--surface)' : 'transparent',
                  color: report.exam_type === type ? pal.primary : pal.textMuted,
                  boxShadow: report.exam_type === type ? 'var(--shadow-card)' : 'none',
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      )}

      <DrillNav report={report} catalog={catalog} state={drill} go={go} pal={pal} />

      {drill.level === 'general' && <LevelGeneral key={report.exam_type} {...drillProps} insights={insights} />}
      {drill.level === 'exam' && <LevelExam {...drillProps} />}

      {drill.level === 'subject' && <LevelSubject {...drillProps} />}
      {drill.level === 'topic' && <LevelTopic {...drillProps} />}
      {drill.level === 'curriculum' && <LevelCurriculum {...drillProps} />}

      {programPopoverTarget && (
        <AddToProgramPopover
          studentId={studentId}
          studentName={studentName}
          examTopicId={programPopoverTarget.examTopicId}
          examTopicName={programPopoverTarget.examTopicName}
          originKind="deneme_analizi"
          suggestedType={programPopoverTarget.suggestedType || 'sureli_test'}
          onClose={() => setProgramPopoverTarget(null)}
          onSuccess={(cnt) => alert(`${cnt} görev başarıyla haftalık plana eklendi!`)}
        />
      )}

      {/* R4-4: Yanlış Nedenleri Modal */}
      {errorModalTarget && (
        <ErrorReasonModal
          isOpen={true}
          onClose={() => setErrorModalTarget(null)}
          studentName={studentName}
          topicName={errorModalTarget.topicRow.name}
          subjectLabel={errorModalTarget.topicRow.subject_label}
          curriculumTopicId={errorModalTarget.curriculumTopicId}
          examTopicId={errorModalTarget.topicRow.exam_topic_id}
          wrongExams={errorModalTarget.topicRow.cells
            .filter((c) => c.entered && c.wrong_count > 0)
            .map((c) => ({
              exam_id: c.exam_id,
              exam_name: c.exam_name,
              exam_date: c.exam_date,
              wrong_count: c.wrong_count,
            }))}
          existingItems={errorBasketItems.filter(
            (item) =>
              errorModalTarget.curriculumTopicId !== null &&
              item.topic_id === errorModalTarget.curriculumTopicId
          )}
          onItemAdded={(newItem) => {
            setErrorBasketItems((prev) => [newItem, ...prev])
          }}
          onItemDeleted={(deletedId) => {
            setErrorBasketItems((prev) => prev.filter((it) => it.id !== deletedId))
          }}
        />
      )}
    </div>
  )
}
