import { useState, useEffect, useCallback } from 'react'
import {
  Award,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Layers,
  RefreshCw,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import { gradeCurriculum } from '../../lib/curriculum'
import { loadReport360Data, type Report360Data } from '../../lib/report360'
import TargetTrajectoryChart from '../charts/TargetTrajectoryChart'
import ParetoLossChart from '../charts/ParetoLossChart'
import PriorityMatrixChart from '../charts/PriorityMatrixChart'
import ErrorProfileChart from '../charts/ErrorProfileChart'
import AddToProgramPopover from '../program/AddToProgramPopover'
import type { ExamType, Grade } from '../../types/database'

export interface Report360ViewProps {
  studentId: string
  studentName?: string
  studentGrade?: Grade | string | null
  onSetTargetNet?: () => void
}

export default function Report360View({
  studentId,
  studentName,
  studentGrade,
  onSetTargetNet,
}: Report360ViewProps) {
  const isLgsStudent = gradeCurriculum(studentGrade as any) === 'LGS'
  const availableExamTypes: ExamType[] = isLgsStudent ? ['LGS'] : ['TYT', 'AYT']
  const [selectedExamType, setSelectedExamType] = useState<ExamType>(isLgsStudent ? 'LGS' : 'TYT')

  const [data, setData] = useState<Report360Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Popover state
  const [popoverTopic, setPopoverTopic] = useState<{
    topicId: number
    topicName: string
  } | null>(null)

  const loadData = useCallback(async () => {
    if (!studentId) return
    setLoading(true)
    setError(null)
    try {
      const res = await loadReport360Data(studentId, selectedExamType)
      setData(res)
    } catch (err: any) {
      console.error('Report360 load error:', err)
      setError('Rapor verileri yüklenirken bir sorun oluştu.')
    } finally {
      setLoading(false)
    }
  }, [studentId, selectedExamType])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ÜST BAR: Sınav Türü Seçici & Yenile */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'inline-flex',
              padding: 3,
              background: 'var(--surface-alt)',
              borderRadius: 8,
              border: '1px solid var(--border-soft)',
            }}
          >
            {availableExamTypes.map((type) => {
              const active = selectedExamType === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedExamType(type)}
                  style={{
                    padding: '5px 14px',
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 500,
                    borderRadius: 6,
                    border: 'none',
                    background: active ? 'var(--surface)' : 'transparent',
                    color: active ? 'var(--ink)' : 'var(--ink-soft)',
                    boxShadow: active ? 'var(--shadow-sm)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {type}
                </button>
              )
            })}
          </div>

          {selectedExamType === 'LGS' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                color: 'var(--ink-soft)',
                background: 'var(--surface-alt)',
                padding: '4px 8px',
                borderRadius: 6,
              }}
            >
              <HelpCircle size={13} style={{ color: 'var(--ink-faint)' }} />
              <span>LGS puanı değildir; ders katsayılarıyla tartılmış net toplamıdır.</span>
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={loadData}
          title="Raporu Yenile"
          style={{ fontSize: 11, padding: '5px 10px' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Yenile</span>
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 13 }}>
          <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 10px', display: 'block' }} />
          <span>360 Rapor analizi hazırlanıyor…</span>
        </div>
      ) : error || !data ? (
        <div className="alert alert-error" style={{ fontSize: 12.5 }}>
          <AlertCircle size={16} />
          <span>{error || 'Veri bulunamadı.'}</span>
        </div>
      ) : (
        <>
          {/* K0: KPI ŞERİDİ (5 KART) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 14,
            }}
          >
            {/* 1. Son Net */}
            <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Son Net ({selectedExamType})
                </span>
                <TrendingUp size={15} style={{ color: 'var(--indigo-600)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>
                  {data.kpi.lastNet !== null ? data.kpi.lastNet.toFixed(2).replace('.', ',') : '—'}
                </span>
                {data.kpi.deltaNet !== null && (
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: data.kpi.deltaNet >= 0 ? 'var(--success-text)' : 'var(--critical-text)',
                      background: data.kpi.deltaNet >= 0 ? 'var(--success-bg)' : 'var(--critical-bg)',
                      padding: '1px 5px',
                      borderRadius: 4,
                    }}
                  >
                    {data.kpi.deltaNet >= 0 ? `+${data.kpi.deltaNet}` : data.kpi.deltaNet}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
                {data.kpi.previousNet !== null ? `Önceki: ${data.kpi.previousNet} net` : 'İlk deneme kaydı'}
              </span>
            </div>

            {/* 2. Hedefe Kalan */}
            <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Hedefe Mesafe
                </span>
                <Award size={15} style={{ color: 'var(--teal-text, #0D9488)' }} />
              </div>
              {data.kpi.targetNet !== null ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>
                      {data.kpi.netGap !== null && data.kpi.netGap > 0
                        ? `-${data.kpi.netGap.toFixed(1).replace('.', ',')}`
                        : 'Ulaşıldı'}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                      / Hedef: {data.kpi.targetNet}
                    </span>
                  </div>
                  <span style={{ fontSize: 10.5, color: 'var(--teal-text, #0D9488)', fontWeight: 600 }}>
                    {data.kpi.weeksLeft !== null && data.kpi.weeklyNeededNet !== null
                      ? `${data.kpi.weeksLeft} hafta · haftada +${data.kpi.weeklyNeededNet.toFixed(1).replace('.', ',')} net`
                      : 'Sınav tarihi girilmedi'}
                  </span>
                </>
              ) : (
                <div style={{ padding: '4px 0' }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={onSetTargetNet}
                    style={{ fontSize: 11, color: 'var(--primary)', padding: 0 }}
                  >
                    + Hedef belirle
                  </button>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 4 }}>
                    Hedef net henüz girilmedi
                  </div>
                </div>
              )}
            </div>

            {/* 3. Ödev Tamamlama · 4 Hafta */}
            <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Ödev Tamamlama (4 Hf)
                </span>
                <Calendar size={15} style={{ color: 'var(--indigo-600)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>
                  %{data.kpi.taskCompletion4w.currentPct}
                </span>
                {data.kpi.taskCompletion4w.deltaPct !== 0 && (
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: data.kpi.taskCompletion4w.deltaPct >= 0 ? 'var(--success-text)' : 'var(--critical-text)',
                      background: data.kpi.taskCompletion4w.deltaPct >= 0 ? 'var(--success-bg)' : 'var(--critical-bg)',
                      padding: '1px 5px',
                      borderRadius: 4,
                    }}
                  >
                    {data.kpi.taskCompletion4w.deltaPct >= 0
                      ? `+${data.kpi.taskCompletion4w.deltaPct}%`
                      : `${data.kpi.taskCompletion4w.deltaPct}%`}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
                {data.kpi.taskCompletion4w.completedTasks} / {data.kpi.taskCompletion4w.totalTasks} görev yapıldı
              </span>
            </div>

            {/* 4. Ödev Doğruluğu · 4 Hafta */}
            <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Ödev Doğruluğu (4 Hf)
                </span>
                <CheckCircle2 size={15} style={{ color: 'var(--success-text)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>
                  {data.kpi.taskAccuracy4w.accuracyPct !== null ? `%${data.kpi.taskAccuracy4w.accuracyPct}` : '—'}
                </span>
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
                {data.kpi.taskAccuracy4w.accuracyPct !== null
                  ? `${data.kpi.taskAccuracy4w.correctQuestions} / ${data.kpi.taskAccuracy4w.totalQuestions} doğru`
                  : 'Sonuç girilmedi'}
              </span>
            </div>

            {/* 5. Müfredat İlerlemesi */}
            <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Müfredat Kapsamı
                </span>
                <Layers size={15} style={{ color: 'var(--plum-text, #7C3AED)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>
                  %{data.kpi.curriculumProgress.pct}
                </span>
                <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                  {data.kpi.curriculumProgress.sufficientCount} / {data.kpi.curriculumProgress.totalCount}
                </span>
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
                Yeterli seviyedeki konular
              </span>
            </div>
          </div>

          {/* B2: HEDEF YOLU & B4: NET KAYBI PARETO */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
            <TargetTrajectoryChart
              data={data.trajectory}
              onSetTargetNet={onSetTargetNet}
            />

            <ParetoLossChart
              data={data.paretoLoss}
              onAddToProgram={(curriculumTopicId, topicName) =>
                setPopoverTopic({ topicId: curriculumTopicId, topicName })
              }
            />
          </div>

          {/* B3: ÖNCELİK MATRİSİ & B5: HATA PROFİLİ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
            <PriorityMatrixChart
              data={data.priorityMatrix}
              onAddToProgram={(curriculumTopicId, topicName) =>
                setPopoverTopic({ topicId: curriculumTopicId, topicName })
              }
            />

            <ErrorProfileChart
              data={data.errorProfile}
            />
          </div>
        </>
      )}

      {/* Programa Ekleme Popover */}
      {popoverTopic && (
        <AddToProgramPopover
          studentId={studentId}
          studentName={studentName}
          topicId={popoverTopic.topicId}
          originKind="gorusme"
          suggestedType="tekrar"
          onClose={() => setPopoverTopic(null)}
          onSuccess={() => {
            setPopoverTopic(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}
