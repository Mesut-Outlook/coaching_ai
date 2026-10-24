import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  AlertTriangle,
  Calendar,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react'
import type { Student, MockExam, MockExamSection } from '../../types/database'
import LossBarChart from '../charts/LossBarChart'

export interface CoachExamsOverviewTabProps {
  students: Student[]
  allExams: (MockExam & {
    students: { full_name: string; track: string; phone_number: string | null; parent_phone_number: string | null } | null
    totalNet: number
    sectionsList: MockExamSection[]
  })[]
}

export default function CoachExamsOverviewTab({ students, allExams }: CoachExamsOverviewTabProps) {
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('ALL')

  // 1. Son 7 Günde Girilen Deneme Sayısı
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const last7DaysCount = useMemo(() => {
    return allExams.filter((e) => {
      const examDate = new Date(e.exam_date)
      return examDate >= sevenDaysAgo && examDate <= now
    }).length
  }, [allExams, sevenDaysAgo, now])

  // 2. Konusu Girilmemiş Denemeler
  // MockExam nesnesinde sections var ama alt konu sayısı henüz girilmemiş olanlar
  // (sectionsList'i olan ama konusu olmayanlar)
  const examsWithoutTopicsCount = useMemo(() => {
    // Burada konusu girilmemiş denemeler kabaca konusu girilmemiş kayıtları temsil eder
    return allExams.filter((e) => !e.score && e.sectionsList.length > 0).length
  }, [allExams])

  // 3. Öğrenci Başına Son Deneme ve Δ Değişimi
  const studentLatestSummaries = useMemo(() => {
    return students.map((s) => {
      const studentExams = allExams
        .filter((e) => e.student_id === s.id)
        .sort((a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime())

      const latest = studentExams[0] || null
      const previous = studentExams.find(
        (e, idx) => idx > 0 && latest && e.exam_type === latest.exam_type
      )

      const deltaNet =
        latest && previous
          ? Math.round((latest.totalNet - previous.totalNet) * 100) / 100
          : null

      return {
        student: s,
        latestExam: latest,
        previousExam: previous,
        deltaNet,
        examCount: studentExams.length,
      }
    })
  }, [students, allExams])

  // Ortalama Net Değişimi
  const avgDelta = useMemo(() => {
    const validDeltas = studentLatestSummaries
      .map((s) => s.deltaNet)
      .filter((d): d is number => d !== null)

    if (validDeltas.length === 0) return null
    const sum = validDeltas.reduce((acc, v) => acc + v, 0)
    return Math.round((sum / validDeltas.length) * 100) / 100
  }, [studentLatestSummaries])

  // 4. "Nerede Puan Kaybediyorlar?" En Çok Kaybettiren Konular
  // Bölüm bazında ortalama kayıp netler
  const aggregatedLossItems = useMemo(() => {
    const sectionLossMap: Record<string, { lossNet: number; count: number; totalQuestions: number }> = {}

    const filtered =
      selectedStudentFilter === 'ALL'
        ? allExams
        : allExams.filter((e) => e.student_id === selectedStudentFilter)

    filtered.forEach((e) => {
      e.sectionsList.forEach((sec) => {
        const loss = sec.max_questions - Number(sec.net)
        if (!sectionLossMap[sec.section_name]) {
          sectionLossMap[sec.section_name] = { lossNet: 0, count: 0, totalQuestions: 0 }
        }
        sectionLossMap[sec.section_name].lossNet += Math.max(0, loss)
        sectionLossMap[sec.section_name].count += 1
        sectionLossMap[sec.section_name].totalQuestions += sec.max_questions
      })
    })

    return Object.entries(sectionLossMap)
      .map(([name, data]) => ({
        label: name,
        subLabel: `${data.count} deneme · ${data.totalQuestions} soru`,
        lossNet: Math.round(data.lossNet * 100) / 100,
        totalQuestions: data.totalQuestions,
      }))
      .sort((a, b) => b.lossNet - a.lossNet)
  }, [allExams, selectedStudentFilter])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 3 SAYI KARTI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {/* Kart 1: Son 7 Günde Girilen Deneme */}
        <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'var(--indigo-050)',
              color: 'var(--indigo-700)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Calendar size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontWeight: 600 }}>
              SON 7 GÜNDE GİRİLEN
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)' }}>
              {last7DaysCount} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-faint)' }}>deneme</span>
            </div>
          </div>
        </div>

        {/* Kart 2: Konusu Girilmemiş Denemeler */}
        <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'var(--warning-bg)',
              color: 'var(--warning-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontWeight: 600 }}>
              KONUSU GİRİLMEMİŞ
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)' }}>
              {examsWithoutTopicsCount} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-faint)' }}>deneme</span>
            </div>
          </div>
        </div>

        {/* Kart 3: Ortalama Net Değişimi */}
        <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: avgDelta && avgDelta >= 0 ? 'var(--success-bg)' : 'var(--critical-bg)',
              color: avgDelta && avgDelta >= 0 ? 'var(--success-text)' : 'var(--critical-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <TrendingUp size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontWeight: 600 }}>
              ORTALAMA NET DEĞİŞİMİ
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: avgDelta && avgDelta >= 0 ? 'var(--success)' : avgDelta ? 'var(--critical)' : 'var(--ink)',
              }}
            >
              {avgDelta !== null ? (
                <>
                  {avgDelta >= 0 ? '+' : ''}
                  {avgDelta.toFixed(2).replace('.', ',')}{' '}
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-faint)' }}>net</span>
                </>
              ) : (
                '—'
              )}
            </div>
          </div>
        </div>
      </div>

      {/* İKİ SÜTUNLU DÜZEN: Öğrenci Durumları & Kayıp Netler */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* SOL: Öğrenci Öğrenci Son Deneme ve Δ Rozetleri */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, margin: 0 }}>Öğrenci Deneme Takibi</h3>
            <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
              {students.length} kayıtlı öğrenci
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {studentLatestSummaries.map(({ student, latestExam, deltaNet, examCount }) => (
              <div
                key={student.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  background: 'var(--surface-alt)',
                  borderRadius: 10,
                  border: '1px solid var(--border-soft)',
                }}
              >
                <div>
                  <Link
                    to={`/ogrenciler/${student.id}?tab=analysis`}
                    style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--indigo-600)', textDecoration: 'none' }}
                  >
                    {student.full_name}
                  </Link>
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>
                    {student.grade} · {student.track} · {examCount} deneme
                  </div>
                  {latestExam ? (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 4 }}>
                      Son: <strong>{latestExam.name}</strong> ({latestExam.exam_date})
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 4, fontStyle: 'italic' }}>
                      Henüz deneme girilmedi
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {latestExam ? (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>
                        {latestExam.totalNet.toFixed(2).replace('.', ',')} net
                      </div>

                      {deltaNet !== null && (
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: deltaNet >= 0 ? 'var(--success)' : 'var(--critical)',
                          }}
                        >
                          {deltaNet >= 0 ? '▲ +' : '▼ '}
                          {deltaNet.toFixed(2).replace('.', ',')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>—</div>
                  )}

                  <Link
                    to={`/ogrenciler/${student.id}?tab=analysis`}
                    className="btn"
                    style={{ fontSize: 12, padding: '5px 10px', background: 'var(--surface)' }}
                    title="Deneme Analizine Git"
                  >
                    Analiz <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SAĞ: Nerede Puan Kaybediyorlar? */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={16} color="var(--critical)" /> Nerede Net Kaybediyorlar?
            </h3>

            {/* Öğrenci Filtresi */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={12} color="var(--ink-faint)" />
              <select
                value={selectedStudentFilter}
                onChange={(e) => setSelectedStudentFilter(e.target.value)}
                style={{ fontSize: 11.5, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)' }}
              >
                <option value="ALL">Tüm Öğrenciler</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginBottom: 14, lineHeight: 1.5 }}>
            Öğrencilerin denemelerinde en çok net kaybı yaşadığı alanlar:
          </p>

          <LossBarChart items={aggregatedLossItems} maxItems={8} />
        </div>
      </div>
    </div>
  )
}
