/**
 * Deneme analizi iniş motoru (saf, React'siz).
 * generateExamReport çıktısından tek deneme dökümü, grup netleri, "son 3"/eğilim,
 * müfredat konusu serisi ve ödev noktalarını türetir. Yeni formül yok: calcNet /
 * calcLossNet / calcTopicAccuracy / round2 / getMasteryBand yeniden kullanılır.
 */
import {
  calcTopicAccuracy, getMasteryBand, round2,
  type ExamReportResult, type ExamTopicLinkInfo, type HomeworkItem, type MasteryBand, type TopicCell,
} from './examReport'

type Cell = Pick<TopicCell, 'entered' | 'question_count' | 'correct_count'>

export type RecentStat = { acc: number | null; band: MasteryBand | 'az_veri'; questions: number }

function sums(cells: Cell[]) {
  return cells.reduce((a, c) => ({ q: a.q + c.question_count, d: a.d + c.correct_count }), { q: 0, d: 0 })
}

/** Girilmiş son 3 hücrenin Σdoğru/Σsoru'su; Σsoru < 3 ⇒ 'az_veri'. */
export function recentStat(cells: Cell[]): RecentStat {
  const { q, d } = sums(cells.filter((c) => c.entered).slice(-3))
  if (q === 0) return { acc: null, band: 'none', questions: 0 }
  const acc = calcTopicAccuracy(d, q)
  return { acc, band: q < 3 ? 'az_veri' : getMasteryBand(acc), questions: q }
}

/** Son 3 girilmiş ölçüm % − öncekilerin % (puan); 4'ten az ölçümde null. */
export function trendPoints(cells: Cell[]): number | null {
  const e = cells.filter((c) => c.entered)
  if (e.length < 4) return null
  const last = sums(e.slice(-3))
  const prev = sums(e.slice(0, -3))
  if (last.q === 0 || prev.q === 0) return null
  return round2(calcTopicAccuracy(last.d, last.q) - calcTopicAccuracy(prev.d, prev.q))
}

export type ExamDetail = {
  exam_id: string
  index: number
  prev_exam_id: string | null
  hasTopics: boolean
  subjectDeltas: Array<{ exam_subject_id: number; label: string; delta: number | null }>
  subjectDyb: Array<{ exam_subject_id: number; label: string; question_count: number; correct: number; wrong: number; blank: number; net: number }>
  topicLosses: Array<{ exam_topic_id: number; exam_subject_id: number; name: string; subject_label: string; loss_net: number; accuracy_pct: number | null }>
}

export function examDetail(report: ExamReportResult, examId: string): ExamDetail | null {
  const series = report.general.time_series
  const index = series.findIndex((p) => p.exam_id === examId)
  if (index < 0) return null
  const rows = report.subjects.rows
  const topicRows = Object.values(report.topicsBySubject).flatMap((t) => t.rows.map((r) => ({ r, label: t.subject_label })))

  const subjectDeltas = rows.map((r) => {
    const cur = r.cells[index]
    const prev = r.cells[index - 1]
    return {
      exam_subject_id: r.exam_subject_id,
      label: r.label,
      delta: cur?.entered && prev?.entered ? round2(cur.net - prev.net) : null,
    }
  })
  const subjectDyb = rows
    .filter((r) => r.cells[index]?.entered)
    .map((r) => {
      const c = r.cells[index]
      return { exam_subject_id: r.exam_subject_id, label: r.label, question_count: c.question_count, correct: c.correct_count, wrong: c.wrong_count, blank: c.blank_count, net: c.net }
    })
  const entered = topicRows.filter(({ r }) => r.cells[index]?.entered)
  const topicLosses = entered
    .map(({ r, label }) => ({
      exam_topic_id: r.exam_topic_id,
      exam_subject_id: r.exam_subject_id,
      name: r.name,
      subject_label: label,
      loss_net: r.cells[index].loss_net,
      accuracy_pct: r.cells[index].accuracy_pct,
    }))
    .sort((a, b) => b.loss_net - a.loss_net)
    .slice(0, 8)

  return {
    exam_id: examId,
    index,
    prev_exam_id: index > 0 ? series[index - 1].exam_id : null,
    hasTopics: entered.length > 0,
    subjectDeltas,
    subjectDyb,
    topicLosses,
  }
}

/** Deneme başına section_name grupları ve grup net toplamı (yalnız girilmiş ders sonuçları). */
export function groupNetsByExam(report: ExamReportResult): Array<{ exam_id: string; groups: Array<{ section_name: string; net: number }> }> {
  return report.general.time_series.map((p, i) => {
    const map = new Map<string, number>()
    for (const r of report.subjects.rows) {
      map.set(r.section_name, (map.get(r.section_name) ?? 0) + (r.cells[i]?.entered ? r.cells[i].net : 0))
    }
    return { exam_id: p.exam_id, groups: [...map].map(([section_name, net]) => ({ section_name, net: round2(net) })) }
  })
}

export type CurriculumPoint = { exam_id: string; exam_date: string; exam_name: string; question_count: number; correct: number; accuracy_pct: number } | null

export function curriculumFeeders(links: ExamTopicLinkInfo[], topicId: number): { primary: number[]; linked: number[] } {
  const mine = links.filter((l) => l.topic_id === topicId)
  return {
    primary: mine.filter((l) => l.is_primary).map((l) => l.exam_topic_id),
    linked: mine.filter((l) => !l.is_primary).map((l) => l.exam_topic_id),
  }
}

/** Müfredat konusuna yalnız BİRİNCİL bağlı karne konularının toplamı; deneme başına nokta ya da null. */
export function curriculumSeries(report: ExamReportResult, links: ExamTopicLinkInfo[], topicId: number): CurriculumPoint[] {
  const ids = new Set(curriculumFeeders(links, topicId).primary)
  const rows = Object.values(report.topicsBySubject).flatMap((t) => t.rows).filter((r) => ids.has(r.exam_topic_id))
  return report.general.time_series.map((p, i) => {
    const { q, d } = sums(rows.map((r) => r.cells[i]).filter((c) => c?.entered))
    if (q === 0) return null
    return { exam_id: p.exam_id, exam_date: p.exam_date, exam_name: p.exam_name, question_count: q, correct: d, accuracy_pct: calcTopicAccuracy(d, q) }
  })
}

export function homeworkPoints(homework: HomeworkItem[] | undefined, topicId: number): HomeworkItem[] {
  return (homework ?? []).filter((h) => h.topic_id === topicId).sort((a, b) => a.date.localeCompare(b.date))
}

export function allTopicLosses(report: ExamReportResult, examSubjectId: number | 'ALL', limit = 10): ExamReportResult['all_top_loss_topics'] {
  // all_top_loss_topics ilk 10'a kesik; ders süzmesi için satırlardan yeniden kurulur.
  return Object.values(report.topicsBySubject)
    .filter((t) => examSubjectId === 'ALL' || t.exam_subject_id === examSubjectId)
    .flatMap((t) =>
      t.rows.filter((r) => r.total_questions > 0).map((r) => ({
        exam_topic_id: r.exam_topic_id, name: r.name, subject_label: t.subject_label,
        total_loss_net: r.total_loss_net, total_questions: r.total_questions, total_accuracy_pct: r.total_accuracy_pct,
      })),
    )
    .sort((a, b) => b.total_loss_net - a.total_loss_net)
    .slice(0, limit)
}
