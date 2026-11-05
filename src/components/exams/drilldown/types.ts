import type { ExamReportCatalog, ExamReportResult, RawExamRecord, TopicRowData } from '../../../lib/examReport'
import type { ErrorBasketItem } from '../../../types/database'
import type { ChartPalette } from '../../charts/chartPalette'

export type DrillRole = 'coach' | 'student' | 'parent'
export type DrillLevel = 'general' | 'exam' | 'subject' | 'topic' | 'curriculum'

export type DrillState = {
  level: DrillLevel
  examId: string | null
  examSubjectId: number | null
  examTopicId: number | null
  curriculumTopicId: number | null
}

export const INITIAL_DRILL: DrillState = {
  level: 'general',
  examId: null,
  examSubjectId: null,
  examTopicId: null,
  curriculumTopicId: null,
}

export type DrillTargets = { TYT?: number | null; AYT?: number | null; LGS?: number | null }
export type ErrorReasonRow = TopicRowData & { subject_label: string }

export type DrillProps = {
  report: ExamReportResult
  catalog: ExamReportCatalog
  /** Seçili sınav türündeki ham deneme kayıtları (puan, sıra, koç notu için) */
  exams: RawExamRecord[]
  role: DrillRole
  palette: ChartPalette
  targets: DrillTargets
  state: DrillState
  go: (patch: Partial<DrillState>) => void
  onAddToProgram: (examTopicId: number, name: string) => void
  onErrorReason: (row: ErrorReasonRow) => void
  /** Koçun girdiği yanlış nedenleri (portalda boş) */
  errorItems: ErrorBasketItem[]
}
