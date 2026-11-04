import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronUp, AlertCircle, Plus, Tag } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type {
  ExamType,
  ExamSubject,
  ExamTopic,
  MockExamSection,
  MockExamSubjectResult,
  MockExamTopicResult,
  ErrorType,
  ErrorBasketItem,
} from '../../types/database'
import { ERROR_REASON_CONFIG } from '../../lib/report360Core'
import ErrorReasonModal from './ErrorReasonModal'
import {
  generateExamReport,
  type RawExamRecord,
  type ExamReportCatalog,
  type ExamTopicLinkInfo,
  type HomeworkItem,
  type ExamReportResult,
  type MasteryBand,
  type TopicRowData,
} from '../../lib/examReport'
import {
  extractInsights,
  formatRoleInsights,
  type RoleInsightItem,
} from '../../lib/examInsights'
import LossBarChart from '../charts/LossBarChart'
import StackedBarChart from '../charts/StackedBarChart'
import Sparkline from '../charts/Sparkline'
import { type ChartPalette, DEFAULT_CHART_PALETTE } from '../charts/chartPalette'
import AddToProgramPopover from '../program/AddToProgramPopover'
import DrillNav from './drilldown/DrillNav'
import LevelHeader from './drilldown/LevelHeader'
import LevelGeneral from './drilldown/LevelGeneral'
import LevelExam from './drilldown/LevelExam'
import { INITIAL_DRILL, type DrillProps, type DrillState } from './drilldown/types'

export interface StudentExamAnalysisViewProps {
  studentId: string
  studentName?: string
  palette?: Partial<ChartPalette>
  role?: 'coach' | 'student' | 'parent'
  initialExamType?: ExamType
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
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | 'ALL'>('ALL')
  const go = (patch: Partial<DrillState>) => {
    setDrill((d) => ({ ...d, ...patch }))
    // Task 6 eski Konu görünümünü değiştirene dek: ders süzmesi iniş durumunu izler
    if ('examSubjectId' in patch) setSelectedSubjectId(patch.examSubjectId ?? 'ALL')
  }
  const [expandedTopicId, setExpandedTopicId] = useState<number | null>(null)
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

  // Uyarılar / İçgörüler
  const insights: RoleInsightItem[] = useMemo(() => {
    if (!report) return []
    const raw = extractInsights(report)
    const formatted = formatRoleInsights(raw)
    return formatted[role]
  }, [report, role])

  // Mevcut sınav türleri
  const availableExamTypes = report?.available_exam_types || []

  // Başarı bandına göre renk
  const getBandBadgeStyle = (band: MasteryBand | 'az_veri' | 'none') => {
    switch (band) {
      case 'good':
        return { bg: 'var(--success-bg)', text: 'var(--success-text)', border: 'var(--success)' }
      case 'medium':
        return { bg: 'var(--warning-bg)', text: 'var(--warning-text)', border: 'var(--warning)' }
      case 'weak':
        return { bg: 'var(--critical-bg)', text: 'var(--critical-text)', border: 'var(--critical)' }
      default:
        return { bg: 'var(--surface-alt)', text: 'var(--ink-faint)', border: 'var(--border)' }
    }
  }

  // Tüm konuların listesi (Konu seviyesi için)
  const allTopicRows = useMemo(() => {
    if (!report) return []
    const list: Array<TopicRowData & { subject_label: string }> = []
    Object.values(report.topicsBySubject).forEach((subjLevel) => {
      subjLevel.rows.forEach((row) => {
        list.push({
          ...row,
          subject_label: subjLevel.subject_label,
        })
      })
    })
    return list
  }, [report])

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

  const { general, subjects } = report
  const topicHeadline =
    (selectedSubjectId !== 'ALL' ? report.topicsBySubject[selectedSubjectId]?.headline : undefined) ||
    Object.values(report.topicsBySubject)[0]?.headline ||
    'Konu Bazlı Başarı'
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
                  setSelectedSubjectId('ALL')
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

      {drill.level === 'general' && <LevelGeneral {...drillProps} insights={insights} />}
      {drill.level === 'exam' && <LevelExam {...drillProps} />}

      {/* ========================================================================= */}
      {/* SEVİYE 2: DERS GELİŞİMİ */}
      {/* ========================================================================= */}
      {(drill.level === 'subject') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <LevelHeader headline={subjects.top_loss_headline || subjects.high_low_headline || 'Ders Bazlı Deneme Dağılımı'} pal={pal} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
            {/* Kayıp Netler Çubuğu */}
            <div className="card" style={{ padding: 20 }}>
              <h4 style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 14 }}>
                Son Denemede En Çok Net Kaybettiren Dersler
              </h4>
              <LossBarChart
                items={subjects.loss_rankings.map((r) => ({
                  label: r.label,
                  subLabel: r.section_name,
                  lossNet: r.loss_net,
                  totalQuestions: r.question_count,
                }))}
                palette={palette}
              />
            </div>

            {/* Son Deneme Bölüm Dağılımı (Stacked Bar) */}
            <div className="card" style={{ padding: 20 }}>
              <h4 style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 14 }}>
                Son Deneme Soru Dağılımı (Doğru / Yanlış / Boş)
              </h4>
              <StackedBarChart
                sections={subjects.rows
                  .filter((r) => r.cells.some((c) => c.entered))
                  .map((r) => {
                    const lastEntered = [...r.cells].reverse().find((c) => c.entered)
                    return {
                      label: r.label,
                      correct: lastEntered?.correct_count || 0,
                      wrong: lastEntered?.wrong_count || 0,
                      blank: lastEntered?.blank_count || 0,
                      total: lastEntered?.question_count || r.question_count,
                    }
                  })}
                palette={palette}
              />
            </div>
          </div>

          {/* Ders Isı Tablosu (Heatmap Table) */}
          <div className="card" style={{ padding: 20, overflowX: 'auto' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
              Ders Isı Tablosu (Tüm Denemeler)
            </h4>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: pal.textMuted }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px' }}>Ders</th>
                  {general.time_series.map((p) => (
                    <th key={p.exam_id} style={{ textAlign: 'center', padding: '10px 6px', minWidth: 64 }}>
                      <div style={{ fontWeight: 600 }}>{p.exam_name}</div>
                      <div style={{ fontSize: 9.5, color: pal.textMuted }}>{p.exam_date.slice(5)}</div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'right', padding: '10px 8px' }}>Ortalama</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px' }}>Son Net</th>
                </tr>
              </thead>
              <tbody>
                {subjects.rows.map((row) => (
                  <tr key={row.exam_subject_id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{row.label}</td>

                    {/* Deneme Hücreleri (Isı Haritası) */}
                    {row.cells.map((cell) => {
                      if (!cell.entered) {
                        return (
                          <td key={cell.exam_id} style={{ textAlign: 'center', padding: '8px', color: pal.textMuted }}>
                            —
                          </td>
                        )
                      }

                      const badge = getBandBadgeStyle(
                        cell.accuracy_pct >= 75 ? 'good' : cell.accuracy_pct >= 50 ? 'medium' : 'weak'
                      )

                      return (
                        <td key={cell.exam_id} style={{ textAlign: 'center', padding: '6px' }}>
                          <div
                            style={{
                              padding: '4px 6px',
                              borderRadius: 6,
                              background: badge.bg,
                              color: badge.text,
                              fontSize: 11.5,
                              fontWeight: 700,
                            }}
                          >
                            <div>{cell.net.toFixed(2).replace('.', ',')}</div>
                            <div style={{ fontSize: 9.5, opacity: 0.85 }}>%{cell.accuracy_pct.toFixed(0)}</div>
                          </div>
                        </td>
                      )
                    })}

                    {/* Ortalama */}
                    <td style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 700 }}>
                      {row.average_net.toFixed(2).replace('.', ',')}
                    </td>

                    {/* Son Net */}
                    <td style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 700, color: pal.primary }}>
                      {row.latest_net != null ? row.latest_net.toFixed(2).replace('.', ',') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEVİYE 3: KONU DETAYLARI */}
      {/* ========================================================================= */}
      {(drill.level === 'topic' || drill.level === 'curriculum') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <LevelHeader headline={topicHeadline} pal={pal} />
          {/* En Çok Net Kaybettiren Konular (İlk 10) */}
          <div className="card" style={{ padding: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
              En Çok Net Kaybettiren Konular (Birikimli Kayıp Net)
            </h4>
            <LossBarChart
              items={report.all_top_loss_topics.map((r) => ({
                label: r.name,
                subLabel: r.subject_label,
                lossNet: r.total_loss_net,
                totalQuestions: r.total_questions,
              }))}
              palette={palette}
              maxItems={10}
            />
          </div>

          {/* Alt Ders Çipleri (Filtreleme) */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: pal.textMuted, marginRight: 4 }}>Ders Filtresi:</span>
            <button
              type="button"
              onClick={() => setSelectedSubjectId('ALL')}
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: selectedSubjectId === 'ALL' ? pal.primary : 'var(--surface-alt)',
                color: selectedSubjectId === 'ALL' ? '#FFFFFF' : pal.text,
              }}
            >
              Tüm Dersler
            </button>
            {subjects.rows.map((s) => (
              <button
                key={s.exam_subject_id}
                type="button"
                onClick={() => setSelectedSubjectId(s.exam_subject_id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: selectedSubjectId === s.exam_subject_id ? pal.primary : 'var(--surface-alt)',
                  color: selectedSubjectId === s.exam_subject_id ? '#FFFFFF' : pal.text,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Konu Isı Tablosu */}
          <div className="card" style={{ padding: 20, overflowX: 'auto' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
              Konu Bazlı Başarı Tablosu
            </h4>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: pal.textMuted }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px' }}>Konu</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px' }}>Ders</th>
                  {general.time_series.map((p) => (
                    <th key={p.exam_id} style={{ textAlign: 'center', padding: '8px 4px', minWidth: 54 }}>
                      <div style={{ fontWeight: 600 }}>{p.exam_name}</div>
                      <div style={{ fontSize: 9, color: pal.textMuted }}>{p.exam_date.slice(5)}</div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'center', padding: '8px' }}>Σ Soru</th>
                  <th style={{ textAlign: 'center', padding: '8px' }}>Σ D</th>
                  <th style={{ textAlign: 'center', padding: '8px' }}>Σ Y</th>
                  <th style={{ textAlign: 'center', padding: '8px' }}>Σ %</th>
                  <th style={{ textAlign: 'center', padding: '8px' }}>Eğilim</th>
                  <th style={{ textAlign: 'center', padding: '8px' }}>Durum</th>
                  <th style={{ textAlign: 'center', padding: '8px' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {allTopicRows
                  .filter((r) => selectedSubjectId === 'ALL' || r.exam_subject_id === selectedSubjectId)
                  .map((row) => {
                    const badge = getBandBadgeStyle(row.status_badge)
                    const isExpanded = expandedTopicId === row.exam_topic_id
                    const curriculumTopicId = primaryTopicByExamTopic.get(row.exam_topic_id) ?? null
                    const rowErrors = errorBasketItems.filter(
                      (it) => curriculumTopicId !== null && it.topic_id === curriculumTopicId
                    )
                    const errorCountsByType = rowErrors.reduce((acc, it) => {
                      acc[it.error_type] = (acc[it.error_type] || 0) + 1
                      return acc
                    }, {} as Record<ErrorType, number>)

                    return (
                      <tr key={row.exam_topic_id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedTopicId((prev) => (prev === row.exam_topic_id ? null : row.exam_topic_id))
                            }
                            style={{
                              background: 'none',
                              border: 'none',
                              color: pal.primary,
                              cursor: 'pointer',
                              padding: 0,
                              fontWeight: 600,
                              fontSize: 12,
                              textAlign: 'left',
                            }}
                          >
                            {row.name}
                            {isExpanded ? <ChevronUp size={12} style={{ marginLeft: 4 }} /> : <ChevronDown size={12} style={{ marginLeft: 4 }} />}
                          </button>

                          {/* R4-4: Mevcut girilmiş nedenleri satırda küçük rozet olarak göster */}
                          {rowErrors.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                              {Object.entries(errorCountsByType).map(([type, cnt]) => {
                                const conf = ERROR_REASON_CONFIG[type as ErrorType]
                                return (
                                  <span
                                    key={type}
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 600,
                                      padding: '1.5px 6px',
                                      borderRadius: 4,
                                      background: conf.bg,
                                      color: conf.textColor,
                                      border: `1px solid color-mix(in srgb, ${conf.color} 30%, transparent)`,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                    }}
                                    title={`${conf.label}: ${conf.description}`}
                                  >
                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: conf.color }} />
                                    {conf.label} {cnt > 1 ? `(${cnt})` : ''}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px', color: pal.textMuted }}>{row.subject_label}</td>

                        {/* Deneme Hücreleri (D/S ve %) */}
                        {row.cells.map((cell) => {
                          if (!cell.entered) {
                            return (
                              <td key={cell.exam_id} style={{ textAlign: 'center', padding: '6px', color: pal.textMuted }}>
                                —
                              </td>
                            )
                          }

                          const cellBadge = getBandBadgeStyle(
                            cell.accuracy_pct != null
                              ? cell.accuracy_pct >= 75
                                ? 'good'
                                : cell.accuracy_pct >= 50
                                ? 'medium'
                                : 'weak'
                              : 'none'
                          )

                          return (
                            <td key={cell.exam_id} style={{ textAlign: 'center', padding: '4px' }}>
                              <div
                                style={{
                                  padding: '3px 4px',
                                  borderRadius: 4,
                                  background: cellBadge.bg,
                                  color: cellBadge.text,
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                <div>{cell.correct_count}/{cell.question_count}</div>
                                {cell.accuracy_pct != null && (
                                  <div style={{ fontSize: 9 }}>%{cell.accuracy_pct.toFixed(0)}</div>
                                )}
                              </div>
                            </td>
                          )
                        })}

                        {/* Birikimli Toplamlar */}
                        <td style={{ textAlign: 'center', padding: '8px', fontWeight: 600 }}>{row.total_questions}</td>
                        <td style={{ textAlign: 'center', padding: '8px', color: pal.success }}>{row.total_correct}</td>
                        <td style={{ textAlign: 'center', padding: '8px', color: pal.critical }}>{row.total_wrong}</td>
                        <td style={{ textAlign: 'center', padding: '8px', fontWeight: 700 }}>
                          {row.total_accuracy_pct != null ? `%${row.total_accuracy_pct.toFixed(0)}` : '—'}
                        </td>

                        {/* Eğilim (Sparkline) */}
                        <td style={{ textAlign: 'center', padding: '8px' }}>
                          <Sparkline
                            values={row.cells.filter((c) => c.entered && c.accuracy_pct != null).map((c) => c.accuracy_pct!)}
                            width={54}
                            height={20}
                          />
                        </td>

                        {/* Durum Rozeti */}
                        <td style={{ textAlign: 'center', padding: '8px' }}>
                          <span
                            className="badge"
                            style={{
                              background: badge.bg,
                              color: badge.text,
                              fontSize: 10.5,
                              padding: '2px 8px',
                            }}
                          >
                            {row.status_badge === 'good'
                              ? 'Yeterli'
                              : row.status_badge === 'medium'
                              ? 'Gelişiyor'
                              : row.status_badge === 'weak'
                              ? 'Kritik'
                              : 'Ölçülmedi'}
                          </span>
                        </td>

                        {/* İşlem (Programa Ekle & Yanlış Nedeni Ekle/Düzenle) */}
                        <td style={{ textAlign: 'center', padding: '6px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() =>
                                setProgramPopoverTarget({
                                  examTopicId: row.exam_topic_id,
                                  examTopicName: row.name,
                                  suggestedType: 'sureli_test',
                                })
                              }
                              style={{
                                padding: '2px 8px',
                                fontSize: 11,
                                fontWeight: 600,
                                color: row.status_badge === 'weak' ? 'var(--critical-text)' : 'var(--indigo-600)',
                                background: row.status_badge === 'weak' ? 'var(--critical-bg)' : 'transparent',
                                border: row.status_badge === 'weak' ? '1px solid color-mix(in srgb, var(--critical-text) 25%, transparent)' : 'none',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                              title="Bu konuyu haftalık programa ekle"
                            >
                              <Plus size={12} /> Programa Ekle
                            </button>

                            {/* R4-4: Yanlış nedeni ekle / düzenle düğmesi */}
                            {role === 'coach' && (row.total_wrong > 0 || rowErrors.length > 0) && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() =>
                                  setErrorModalTarget({
                                    topicRow: row,
                                    curriculumTopicId,
                                  })
                                }
                                style={{
                                  padding: '2px 8px',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: rowErrors.length > 0 ? 'var(--indigo-600)' : 'var(--warning-text)',
                                  background: rowErrors.length > 0 ? 'var(--indigo-025)' : 'var(--warning-bg)',
                                  border: `1px solid ${
                                    rowErrors.length > 0
                                      ? 'var(--border)'
                                      : 'color-mix(in srgb, var(--warning) 35%, transparent)'
                                  }`,
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                                title="Bu konudaki yanlışların nedenini ekle veya düzenle"
                              >
                                <Tag size={12} /> {rowErrors.length > 0 ? 'Neden Düzenle' : 'Neden Ekle'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
