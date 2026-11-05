/**
 * Saf iniş motoru (examDrilldown) öz-testi. Çalıştırma: npm run test:exam-drilldown
 */
import assert from 'node:assert/strict'
import { generateExamReport, type ExamReportCatalog, type RawExamRecord, type RawExamTopicResult } from '../src/lib/examReport'
import {
  recentStat, trendPoints, examDetail, groupNetsByExam, curriculumSeries,
  curriculumFeeders, homeworkPoints, allTopicLosses,
} from '../src/lib/examDrilldown'

const cell = (q: number, c: number, entered = true) => ({ entered, question_count: q, correct_count: c })

// recentStat
const rs = recentStat([cell(4, 2), cell(4, 3), cell(0, 0, false), cell(4, 4), cell(4, 1)])
assert.ok(Math.abs((rs.acc ?? 0) - 66.67) < 0.01)
assert.equal(rs.band, 'medium')
assert.equal(rs.questions, 12)
assert.equal(recentStat([cell(2, 2)]).band, 'az_veri')
assert.deepEqual(recentStat([cell(0, 0, false)]), { acc: null, band: 'none', questions: 0 })
// trendPoints
assert.equal(trendPoints([cell(4, 2), cell(4, 3), cell(4, 4)]), null)
assert.ok(Math.abs((trendPoints([cell(4, 2), cell(4, 3), cell(4, 4), cell(4, 1)]) ?? 0) - 16.67) < 0.01)
console.log('✓ recentStat / trendPoints')

// Katalog + 5 TYT denemesi
const catalog: ExamReportCatalog = {
  subjects: [
    { id: 1, exam_type: 'TYT', section_name: 'Türkçe', subject_id: 1, label: 'Türkçe', question_count: 40, sort_order: 1 },
    { id: 2, exam_type: 'TYT', section_name: 'Matematik', subject_id: 2, label: 'Matematik-1', question_count: 30, sort_order: 2 },
  ],
  topics: [
    { id: 1, exam_subject_id: 1, name: 'Paragrafın Yapısı', sort_order: 1 },
    { id: 2, exam_subject_id: 1, name: 'Anlatım Teknikleri', sort_order: 2 },
    { id: 3, exam_subject_id: 1, name: 'Paragraf Yorumu', sort_order: 3 },
  ],
}
const mk = (n: number, tr: number, withTopics: boolean): RawExamRecord => {
  const topic_results: RawExamTopicResult[] = withTopics
    ? [1, 2, 3].map((id) => ({ exam_topic_id: id, question_count: 4, correct_count: (id + n) % 5, wrong_count: 1, blank_count: 0 }))
    : []
  return {
    id: `e${n}`, student_id: 's', name: `D${n}`, exam_type: 'TYT', exam_date: `2026-10-0${n}`,
    subject_results: [
      { exam_subject_id: 1, question_count: 40, correct_count: tr, wrong_count: 4, blank_count: 40 - tr - 4 },
      { exam_subject_id: 2, question_count: 30, correct_count: 20, wrong_count: 4, blank_count: 6 },
    ],
    topic_results,
  }
}
const raw = [mk(1, 20, true), mk(2, 24, true), mk(3, 28, false), mk(4, 30, true), mk(5, 32, true)]
const report = generateExamReport(raw, catalog, 'TYT')

const d1 = examDetail(report, 'e1')!
assert.equal(d1.prev_exam_id, null)
assert.ok(d1.subjectDeltas.every((x) => x.delta === null))
const d3 = examDetail(report, 'e3')!
assert.equal(d3.hasTopics, false)
assert.equal(d3.topicLosses.length, 0)
assert.equal(d3.subjectDeltas.find((x) => x.label === 'Türkçe')!.delta, 27 - 23) // (28-1)-(24-1)
assert.equal(examDetail(report, 'e4')!.prev_exam_id, 'e3')
assert.equal(examDetail(report, 'yok'), null)
const d2 = examDetail(report, 'e2')!
assert.ok(d2.topicLosses.length > 0 && d2.topicLosses.length <= 8)
for (let i = 1; i < d2.topicLosses.length; i++) assert.ok(d2.topicLosses[i - 1].loss_net >= d2.topicLosses[i].loss_net)
assert.equal(d2.subjectDyb.length, 2)
console.log('✓ examDetail')

const gn = groupNetsByExam(report)
assert.equal(gn.length, 5)
for (const g of gn) {
  assert.deepEqual(g.groups.map((x) => x.section_name), ['Türkçe', 'Matematik'])
}
const tot = (id: string) => gn.find((g) => g.exam_id === id)!.groups.reduce((s, x) => s + x.net, 0)
const subjNet = (id: string) => report.subjects.rows.reduce((s, r) => s + r.cells.find((c) => c.exam_id === id)!.net, 0)
assert.ok(Math.abs(tot('e2') - subjNet('e2')) < 0.01)
const lgs = generateExamReport([{
  id: 'l1', student_id: 's', name: 'L', exam_type: 'LGS', exam_date: '2026-10-01',
  subject_results: [{ exam_subject_id: 9, question_count: 20, correct_count: 12, wrong_count: 6, blank_count: 2 }],
}], { subjects: [{ id: 9, exam_type: 'LGS', section_name: 'Türkçe', subject_id: 1, label: 'Türkçe', question_count: 20 }], topics: [] }, 'LGS')
assert.equal(groupNetsByExam(lgs)[0].groups[0].net, 10) // 12 - 6/3
console.log('✓ groupNetsByExam')

// Müfredat bağları
const links = [
  { exam_topic_id: 1, topic_id: 100, is_primary: true },
  { exam_topic_id: 2, topic_id: 100, is_primary: true },
  { exam_topic_id: 3, topic_id: 100, is_primary: true },
  { exam_topic_id: 1, topic_id: 101, is_primary: false },
]
assert.deepEqual(curriculumFeeders(links, 100), { primary: [1, 2, 3], linked: [] })
assert.deepEqual(curriculumFeeders(links, 101), { primary: [], linked: [1] })
const cs = curriculumSeries(report, links, 100)
assert.equal(cs.length, 5)
assert.equal(cs[2], null)
const c0 = cs[0]!
assert.equal(c0.question_count, 12)
assert.equal(c0.correct, [1, 2, 3].reduce((s, id) => s + ((id + 1) % 5), 0))
assert.equal(c0.exam_id, 'e1')
assert.ok(curriculumSeries(report, links, 101).every((x) => x === null))
assert.ok(curriculumSeries(report, [], 100).every((x) => x === null))
console.log('✓ curriculumSeries / feeders')

const hw = [
  { topic_id: 100, date: '2026-10-05', label: 'b', question_count: 10, correct_count: 5, wrong_count: 3, blank_count: 2, accuracy_pct: 50, kind: 'odev' as const },
  { topic_id: 101, date: '2026-10-01', label: 'x', question_count: 10, correct_count: 5, wrong_count: 3, blank_count: 2, accuracy_pct: 50, kind: 'odev' as const },
  { topic_id: 100, date: '2026-10-02', label: 'a', question_count: 10, correct_count: 5, wrong_count: 3, blank_count: 2, accuracy_pct: 50, kind: 'konu_testi' as const },
]
assert.deepEqual(homeworkPoints(hw, 100).map((h) => h.label), ['a', 'b'])
assert.deepEqual(homeworkPoints(undefined, 100), [])
console.log('✓ homeworkPoints')

assert.equal(allTopicLosses(report, 'ALL', 10)[0].exam_topic_id, report.all_top_loss_topics[0].exam_topic_id)
assert.ok(allTopicLosses(report, 2, 10).length === 0)
assert.ok(allTopicLosses(report, 1, 10).every((t) => t.subject_label === 'Türkçe'))
console.log('✓ allTopicLosses\n✓ examDrilldown öz-testi tamam')
