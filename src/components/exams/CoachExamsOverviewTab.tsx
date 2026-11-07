import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  AlertTriangle,
  Calendar,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react'
import type { Student, MockExam, MockExamSection } from '../../types/database'
import { countExamsWithoutTopics } from '../../lib/examReport'
import LossBarChart from '../charts/LossBarChart'

export interface CoachExamsOverviewTabProps {
  students: Student[]
  allExams: (MockExam & {
    students: { full_name: string; track: string; phone_number: string | null; parent_phone_number: string | null } | null
    totalNet: number
    sectionsList: MockExamSection[]
    hasTopics?: boolean
    topicResultsCount?: number
  })[]
}

export default function CoachExamsOverviewTab({ students, allExams }: CoachExamsOverviewTabProps) {
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('ALL')
  const navigate = useNavigate()

  // 1. Son 7 Günde Girilen Deneme Sayısı
  const last7DaysCount = useMemo(() => {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return allExams.filter((e) => {
      const examDate = new Date(e.exam_date)
      return examDate >= sevenDaysAgo && examDate <= now
    }).length
  }, [allExams])

  // 2. Konusu Girilmemiş Denemeler
  // MockExam nesnesinde sections var ama alt konu sayısı henüz girilmemiş olanlar
  // (sectionsList'i olan ama konusu olmayanlar)
  const examsWithoutTopicsCount = useMemo(() => {
    return countExamsWithoutTopics(allExams)
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

  // 4. "Nerede Net Kaybediyorlar?" — bölüm başına kayıp = soru sayısı − net.
  // Ham toplam soru sayısını cezalandırır (40 soruluk Matematik hep başta çıkar);
  // bu yüzden ORAN'a göre sıralanır, deneme başına ortalama gösterilir.
  // TYT/AYT/LGS'nin aynı adlı bölümleri ayrı tutulur.
  const aggregatedLossItems = useMemo(() => {
    const map = new Map<string, { examType: string; section: string; loss: number; count: number; questions: number }>()

    const filtered =
      selectedStudentFilter === 'ALL'
        ? allExams
        : allExams.filter((e) => e.student_id === selectedStudentFilter)

    filtered.forEach((e) => {
      e.sectionsList.forEach((sec) => {
        if (!sec.max_questions) return
        const key = `${e.exam_type}|${sec.section_name}`
        const row = map.get(key) ?? { examType: e.exam_type, section: sec.section_name, loss: 0, count: 0, questions: 0 }
        row.loss += Math.max(0, sec.max_questions - Number(sec.net))
        row.count += 1
        row.questions += sec.max_questions
        map.set(key, row)
      })
    })

    const multiType = new Set([...map.values()].map((r) => r.examType)).size > 1
    return [...map.values()]
      .map((r) => {
        const pct = (r.loss / r.questions) * 100
        return {
          examType: r.examType,
          section: r.section,
          label: multiType ? `${r.examType} ${r.section}` : r.section,
          subLabel: `%${Math.round(pct)} kayıp · ${r.count} deneme`,
          lossNet: Math.round((r.loss / r.count) * 100) / 100,
          barPercent: pct,
        }
      })
      .sort((a, b) => b.barPercent - a.barPercent)
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
                      {latestExam.exam_type === 'LGS' && (
                        <div style={{ fontSize: 10, color: 'var(--ink-faint)' }} title="LGS katsayılı net (LGS puanı değildir)">katsayılı</div>
                      )}

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

        {/* SAĞ: Nerede Net Kaybediyorlar? */}
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
            Kayıp = soru sayısı − net. Sağdaki değer <b>deneme başına ortalama</b> kayıp; çubuk ve sıralama
            sorulara oranla kaybı (%) gösterir.
            {selectedStudentFilter === 'ALL'
              ? ' Ayrıntı için bir öğrenci seçin.'
              : ' Bir derse tıklayınca öğrencinin deneme analizinde o derse inilir.'}
          </p>

          <LossBarChart
            items={aggregatedLossItems}
            maxItems={8}
            unit="net / deneme"
            onItemClick={
              selectedStudentFilter === 'ALL'
                ? undefined
                : (i) => {
                    const it = aggregatedLossItems[i]
                    navigate(
                      `/ogrenciler/${selectedStudentFilter}?tab=analysis&tur=${it.examType}&bolum=${encodeURIComponent(it.section)}`,
                    )
                  }
            }
          />
        </div>
      </div>
    </div>
  )
}
