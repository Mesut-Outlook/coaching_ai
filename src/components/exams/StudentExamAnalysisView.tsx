import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp,
  Layers,
  BookOpen,
  HelpCircle,
  BarChart2,
  Table as TableIcon,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  Plus,
  Tag,
} from 'lucide-react'
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
  type ExamReportResult,
  type MasteryBand,
  type TopicRowData,
} from '../../lib/examReport'
import {
  extractInsights,
  formatRoleInsights,
  type RoleInsightItem,
} from '../../lib/examInsights'
import ExamLineChart from '../charts/ExamLineChart'
import LossBarChart from '../charts/LossBarChart'
import StackedBarChart from '../charts/StackedBarChart'
import Sparkline from '../charts/Sparkline'
import { type ChartPalette, DEFAULT_CHART_PALETTE } from '../charts/chartPalette'
import AddToProgramPopover from '../program/AddToProgramPopover'

export interface StudentExamAnalysisViewProps {
  studentId: string
  studentName?: string
  palette?: Partial<ChartPalette>
  role?: 'coach' | 'student' | 'parent'
  initialExamType?: ExamType
  initialCatalog?: ExamReportCatalog
  initialExams?: RawExamRecord[]
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
}: StudentExamAnalysisViewProps) {
  const pal = { ...DEFAULT_CHART_PALETTE, ...palette }

  // Durum
  const [loading, setLoading] = useState(!initialCatalog || !initialExams)
  const [error, setError] = useState<string | null>(null)
  const [rawExams, setRawExams] = useState<RawExamRecord[]>(initialExams || [])
  const [catalog, setCatalog] = useState<ExamReportCatalog>(initialCatalog || { subjects: [], topics: [] })

  // Filtreler & Seviyeler
  const [selectedExamType, setSelectedExamType] = useState<ExamType | undefined>(initialExamType)
  const [activeLevel, setActiveLevel] = useState<'general' | 'subject' | 'topic'>('general')
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | 'ALL'>('ALL')
  const [showFormulaModal, setShowFormulaModal] = useState(false)
  const [expandedTopicId, setExpandedTopicId] = useState<number | null>(null)
  const [programPopoverTarget, setProgramPopoverTarget] = useState<{
    examTopicId: number
    examTopicName: string
    suggestedType?: 'konu' | 'tekrar' | 'rutin' | 'sureli_test' | 'deneme'
  } | null>(null)

  // R4-4: Yanlış Nedenleri State
  const [errorBasketItems, setErrorBasketItems] = useState<ErrorBasketItem[]>([])
  const [topicLinks, setTopicLinks] = useState<Map<number, number>>(new Map())
  const [topicNames, setTopicNames] = useState<Map<string, number>>(new Map())
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

      const examIds = initialExams.map((e) => e.id)
      if (examIds.length > 0) {
        Promise.all([
          supabase.from('error_basket_items').select('*').in('mock_exam_id', examIds),
          supabase.from('exam_topic_links').select('exam_topic_id, topic_id').eq('is_primary', true),
          supabase.from('topics').select('id, name'),
        ]).then(([ebRes, lRes, ctRes]) => {
          if (!isMounted) return
          if (ebRes.data) setErrorBasketItems(ebRes.data as ErrorBasketItem[])
          if (lRes.data) {
            const lMap = new Map<number, number>()
            lRes.data.forEach((l) => lMap.set(l.exam_topic_id, l.topic_id))
            setTopicLinks(lMap)
          }
          if (ctRes.data) {
            const nMap = new Map<string, number>()
            ctRes.data.forEach((t) => nMap.set(t.name.trim().toLowerCase(), t.id))
            setTopicNames(nMap)
          }
        })
      }
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
        const [sections, subjectResults, topicResults, errorBasketRes, linksRes, curriculumTopicsRes] =
          await Promise.all([
            fetchByExamIds<MockExamSection>('mock_exam_sections', examIds),
            fetchByExamIds<MockExamSubjectResult>('mock_exam_subject_results', examIds),
            fetchByExamIds<MockExamTopicResult>('mock_exam_topic_results', examIds),
            supabase.from('error_basket_items').select('*').in('mock_exam_id', examIds),
            supabase.from('exam_topic_links').select('exam_topic_id, topic_id').eq('is_primary', true),
            supabase.from('topics').select('id, name'),
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
          if (linksRes.data) {
            const lMap = new Map<number, number>()
            linksRes.data.forEach((l) => lMap.set(l.exam_topic_id, l.topic_id))
            setTopicLinks(lMap)
          }
          if (curriculumTopicsRes.data) {
            const nMap = new Map<string, number>()
            curriculumTopicsRes.data.forEach((t) => nMap.set(t.name.trim().toLowerCase(), t.id))
            setTopicNames(nMap)
          }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KONTROL ÇUBUĞU: Sınav Türü & Seviye Seçici & Nasıl Hesaplandı */}
      <div
        className="card"
        style={{
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* Sol: Sınav Türü ve Seviye Seçicileri */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {/* Sınav Türü (TYT / AYT / LGS) */}
          {availableExamTypes.length > 1 && (
            <div style={{ display: 'flex', gap: 6, background: 'var(--surface-alt)', padding: 3, borderRadius: 8 }}>
              {availableExamTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedExamType(type)}
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
          )}

          {/* Seviye Seçici: Genel / Ders / Konu */}
          <div style={{ display: 'flex', gap: 6, borderLeft: '1px solid var(--border)', paddingLeft: 14 }}>
            <button
              type="button"
              onClick={() => setActiveLevel('general')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                fontSize: 13,
                fontWeight: activeLevel === 'general' ? 700 : 500,
                cursor: 'pointer',
                background: activeLevel === 'general' ? pal.primaryArea : 'transparent',
                color: activeLevel === 'general' ? pal.primary : pal.textMuted,
              }}
            >
              <TrendingUp size={14} /> Genel
            </button>
            <button
              type="button"
              onClick={() => setActiveLevel('subject')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                fontSize: 13,
                fontWeight: activeLevel === 'subject' ? 700 : 500,
                cursor: 'pointer',
                background: activeLevel === 'subject' ? pal.primaryArea : 'transparent',
                color: activeLevel === 'subject' ? pal.primary : pal.textMuted,
              }}
            >
              <Layers size={14} /> Ders
            </button>
            <button
              type="button"
              onClick={() => setActiveLevel('topic')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                fontSize: 13,
                fontWeight: activeLevel === 'topic' ? 700 : 500,
                cursor: 'pointer',
                background: activeLevel === 'topic' ? pal.primaryArea : 'transparent',
                color: activeLevel === 'topic' ? pal.primary : pal.textMuted,
              }}
            >
              <BookOpen size={14} /> Konu
            </button>
          </div>
        </div>

        {/* Sağ: Görünüm Geçişi (Grafik / Tablo) & Nasıl Hesaplandı Bilgisi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {activeLevel === 'general' && (
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface-alt)', padding: 2, borderRadius: 6 }}>
              <button
                type="button"
                onClick={() => setViewMode('chart')}
                style={{
                  padding: '4px 8px',
                  borderRadius: 5,
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === 'chart' ? 'var(--surface)' : 'transparent',
                  color: viewMode === 'chart' ? pal.primary : pal.textMuted,
                }}
                title="Grafik Görünümü"
              >
                <BarChart2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  padding: '4px 8px',
                  borderRadius: 5,
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === 'table' ? 'var(--surface)' : 'transparent',
                  color: viewMode === 'table' ? pal.primary : pal.textMuted,
                }}
                title="Tablo Görünümü"
              >
                <TableIcon size={14} />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowFormulaModal((prev) => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              fontSize: 11.5,
              color: 'var(--ink-faint)',
              cursor: 'pointer',
              padding: '4px 6px',
            }}
          >
            <HelpCircle size={13} /> Nasıl hesaplandı?
          </button>
        </div>
      </div>

      {/* FORMÜL AÇIKLAMA BİLGİ KUTUSU */}
      {showFormulaModal && (
        <div
          className="card"
          style={{
            padding: 16,
            background: 'var(--surface-alt)',
            border: '1px solid var(--border)',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--ink)' }}>
            Ölçüm ve Hesaplama Metodolojisi
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <strong>Net Formülü:</strong> Doğru − (Yanlış / Ceza) (YKS: 4, LGS: 3).
            </div>
            <div>
              <strong>Ders Başarı %:</strong> (Net / Soru Sayısı) × 100.
            </div>
            <div>
              <strong>Konu Başarı %:</strong> (Doğru / Soru Sayısı) × 100.
            </div>
            <div>
              <strong>Kayıp Net:</strong> Soru Sayısı − Net ("Bu alanda kaç net kaybedildi?").
            </div>
            <div>
              <strong>Değişim (Δ):</strong> Son deneme ile önceki aynı sınav türündeki denemenin farkı.
            </div>
            <div>
              <strong>Asgari Veri Kuralı:</strong> Çizgi grafik için en az 3 deneme gerekir.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEVİYE 1: GENEL BAKIŞ */}
      {/* ========================================================================= */}
      {activeLevel === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Başlık Kartı: Tek Cümlelik Özet + Büyük Metrikler */}
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: pal.primary, marginBottom: 14 }}>
              {general.headline}
            </div>

            {general.latest_exam ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: pal.textMuted, fontWeight: 600 }}>SON DENEME NETİ</div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: pal.primary, letterSpacing: '-0.02em' }}>
                      {general.latest_exam.net.toFixed(2).replace('.', ',')}
                    </div>
                  </div>

                  {general.latest_exam.delta_net != null && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: 13,
                        fontWeight: 700,
                        background: general.latest_exam.delta_net >= 0 ? 'var(--success-bg)' : 'var(--critical-bg)',
                        color: general.latest_exam.delta_net >= 0 ? 'var(--success-text)' : 'var(--critical-text)',
                      }}
                    >
                      {general.latest_exam.delta_net >= 0 ? '▲ +' : '▼ '}
                      {general.latest_exam.delta_net.toFixed(2).replace('.', ',')}
                    </div>
                  )}
                </div>

                {/* Balonlar */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div className="badge badge-neutral" style={{ padding: '6px 12px', fontSize: 12 }}>
                    Toplam: <strong>{general.latest_exam.question_count}</strong> soru
                  </div>
                  <div className="badge badge-success" style={{ padding: '6px 12px', fontSize: 12 }}>
                    Doğru: <strong>{general.latest_exam.correct_count}</strong>
                  </div>
                  <div className="badge badge-critical" style={{ padding: '6px 12px', fontSize: 12 }}>
                    Yanlış: <strong>{general.latest_exam.wrong_count}</strong>
                  </div>
                  <div className="badge badge-neutral" style={{ padding: '6px 12px', fontSize: 12 }}>
                    Boş: <strong>{general.latest_exam.blank_count}</strong>
                  </div>
                  <div className="badge badge-primary" style={{ padding: '6px 12px', fontSize: 12 }}>
                    Başarı: <strong>%{general.latest_exam.accuracy_pct.toFixed(0)}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: pal.textMuted, fontSize: 13 }}>Veri bulunmuyor.</div>
            )}

            {/* Varsa Puan, Sıra ve Koç Notu */}
            {general.latest_exam && (general.latest_exam.score != null || general.latest_exam.coach_note) && (
              <div
                style={{
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: '1px solid var(--border-soft)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 16,
                  alignItems: 'center',
                  fontSize: 12,
                }}
              >
                {general.latest_exam.score != null && (
                  <div>
                    Puan: <strong>{general.latest_exam.score}</strong>
                    {general.latest_exam.percentile != null && ` (Yüzdelik: %${general.latest_exam.percentile})`}
                  </div>
                )}
                {general.latest_exam.coach_note && (
                  <div style={{ color: 'var(--ink-soft)', fontStyle: 'italic', flex: 1 }}>
                    Koç Notu: "{general.latest_exam.coach_note}"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Grafik veya Tablo Görünümü */}
          <div className="card" style={{ padding: 22 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: pal.text }}>
              Net Gelişim Çizgisi ({report.exam_type})
            </h4>

            {viewMode === 'chart' ? (
              <ExamLineChart
                data={general.time_series.map((p) => ({
                  label: p.exam_name,
                  date: p.exam_date,
                  value: p.net,
                  subValue: p.accuracy_pct,
                }))}
                average={general.average_net}
                palette={palette}
                minThresholdNotice={general.min_data_notice}
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: pal.textMuted }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>Deneme</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px' }}>Tarih</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px' }}>Net</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px' }}>Başarı %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {general.time_series.map((p) => (
                      <tr key={p.exam_id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                        <td style={{ padding: '10px', fontWeight: 600 }}>{p.exam_name}</td>
                        <td style={{ padding: '10px', color: pal.textMuted }}>{p.exam_date}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: pal.primary }}>
                          {p.net.toFixed(2).replace('.', ',')}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: pal.textMuted }}>
                          %{p.accuracy_pct.toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Görüşmede Konuşulacaklar & Uyarılar (Rol bazlı) */}
          {insights.length > 0 && (
            <div className="card" style={{ padding: 22 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lightbulb size={16} color="var(--warning)" />
                {role === 'coach' ? 'Görüşmede Konuşulacaklar (Koç İçgörüleri)' : 'Öne Çıkan Değerlendirmeler'}
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {insights.map((ins, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: ins.is_positive ? 'var(--success-bg)' : ins.severity === 'critical' ? 'var(--critical-bg)' : 'var(--surface-alt)',
                      border: `1px solid ${ins.is_positive ? 'var(--success)' : ins.severity === 'critical' ? 'var(--critical)' : 'var(--border-soft)'}`,
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: ins.is_positive ? 'var(--success-text)' : ins.severity === 'critical' ? 'var(--critical-text)' : 'var(--ink)',
                    }}
                  >
                    {ins.is_positive ? (
                      <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                    ) : (
                      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                    )}
                    <div>{ins.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEVİYE 2: DERS GELİŞİMİ */}
      {/* ========================================================================= */}
      {activeLevel === 'subject' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Başlık Kartı: Tek Cümlelik Özet */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: pal.primary }}>
              {subjects.top_loss_headline || subjects.high_low_headline || 'Ders Bazlı Deneme Dağılımı'}
            </div>
          </div>

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
      {activeLevel === 'topic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                    const curriculumTopicId =
                      topicLinks.get(row.exam_topic_id) ??
                      topicNames.get(row.name.trim().toLowerCase()) ??
                      null
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
