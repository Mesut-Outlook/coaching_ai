import { useEffect, useRef } from 'react'
import type { ExamReportCatalog, ExamReportResult } from '../../../lib/examReport'
import type { ChartPalette } from '../../charts/chartPalette'
import type { DrillLevel, DrillState } from './types'

const LEVELS: Array<[DrillLevel, string]> = [
  ['general', 'Genel'], ['exam', 'Deneme'], ['subject', 'Ders'], ['topic', 'Karne konusu'], ['curriculum', 'Müfredat'],
]

type Crumb = { label: string; patch: Partial<DrillState> }

export default function DrillNav({
  report, catalog, state, go, pal,
}: { report: ExamReportResult; catalog: ExamReportCatalog; state: DrillState; go: (p: Partial<DrillState>) => void; pal: ChartPalette }) {
  const navRef = useRef<HTMLElement>(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    navRef.current?.scrollIntoView({ block: 'nearest' })
  }, [state.level, state.examId, state.examSubjectId, state.examTopicId, state.curriculumTopicId])

  const at = LEVELS.findIndex(([l]) => l === state.level)
  const crumbs: Crumb[] = [
    { label: 'Tüm denemeler', patch: { level: 'general', examId: null, examSubjectId: null, examTopicId: null, curriculumTopicId: null } },
  ]
  const examName = report.general.time_series.find((p) => p.exam_id === state.examId)?.exam_name
  if (state.examId && examName && (state.level === 'exam' || state.examSubjectId != null)) {
    crumbs.push({ label: examName, patch: { level: 'exam', examSubjectId: null, examTopicId: null, curriculumTopicId: null } })
  }
  const subjName = report.subjects.rows.find((r) => r.exam_subject_id === state.examSubjectId)?.label
  if (state.examSubjectId != null && subjName && state.level !== 'exam') {
    crumbs.push({ label: subjName, patch: { level: 'subject', examTopicId: null, curriculumTopicId: null } })
  }
  const topicName = state.examTopicId == null ? undefined
    : Object.values(report.topicsBySubject).flatMap((t) => t.rows).find((r) => r.exam_topic_id === state.examTopicId)?.name
  if (topicName && (state.level === 'topic' || state.level === 'curriculum')) {
    crumbs.push({ label: topicName, patch: { level: 'topic', curriculumTopicId: null } })
  }
  const currName = state.curriculumTopicId == null ? undefined
    : catalog.curriculumTopics?.find((c) => c.id === state.curriculumTopicId)?.name
  if (currName && state.level === 'curriculum') crumbs.push({ label: currName, patch: {} })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {LEVELS.map(([l, name], k) => (
          <span
            key={l}
            aria-current={k === at ? 'step' : undefined}
            style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 11.5, whiteSpace: 'nowrap',
              fontWeight: k === at ? 700 : 500,
              background: k === at ? pal.primaryArea : 'transparent',
              color: k === at ? pal.primary : pal.textMuted,
              border: `1px solid ${k === at ? pal.primary : pal.border}`,
              opacity: k > at ? 0.7 : 1,
            }}
          >
            {k + 1} · {name}
          </span>
        ))}
      </div>
      <nav ref={navRef} aria-label="Konum" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, fontSize: 13 }}>
        {crumbs.map((c, k) =>
          k === crumbs.length - 1 ? (
            <span key={k} style={{ fontWeight: 700, color: pal.text }}>{c.label}</span>
          ) : (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <button type="button" onClick={() => go(c.patch)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: pal.primary, fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}>
                {c.label}
              </button>
              <span aria-hidden="true" style={{ color: pal.textMuted }}>›</span>
            </span>
          ),
        )}
      </nav>
    </div>
  )
}
