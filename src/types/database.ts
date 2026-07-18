// supabase/schema.sql ile birebir eşleşir. Şema değiştiğinde burayı da güncelle.

export type Grade = '12. Sınıf' | 'Mezun'
export type Track = 'SAY' | 'EA' | 'SÖZ'
export type MeasurementSource = 'konu_testi' | 'deneme'
export type MasteryState = 'kritik' | 'gelisiyor' | 'yeterli'
export type ExamType = 'TYT' | 'AYT'
export type ErrorType = 'bilgi_eksikligi' | 'islem_hatasi' | 'dikkat_hatasi' | 'sure_yetmedi'

export type Profile = {
  id: string
  full_name: string
  role: string
  created_at: string
}

export type Student = {
  id: string
  coach_id: string
  full_name: string
  grade: Grade
  track: Track
  target_program: string | null
  target_ranking: string | null
  target_net_label: string | null
  target_net_value: number | null
  created_at: string
}

export type Subject = {
  id: number
  name: string
  color: string
  soru_sayisi: string
  sort_order: number
  is_active: boolean
}

export type Topic = {
  id: number
  subject_id: number
  name: string
  sort_order: number
  is_active: boolean
}

export type TopicMeasurement = {
  id: string
  student_id: string
  topic_id: number
  source: MeasurementSource
  source_label: string
  correct_count: number | null
  wrong_count: number | null
  blank_count: number | null
  accuracy_pct: number
  measured_at: string
  created_at: string
}

export type CoachDecision = {
  id: string
  student_id: string
  topic_id: number
  state: MasteryState
  note: string | null
  decided_by: string
  decided_at: string
}

export type MockExam = {
  id: string
  student_id: string
  name: string
  publisher: string | null
  exam_type: ExamType
  exam_date: string
  created_at: string
}

export type MockExamSection = {
  id: string
  mock_exam_id: string
  section_name: string
  max_questions: number
  correct_count: number
  wrong_count: number
  blank_count: number
  net: number
}

export type ErrorBasketItem = {
  id: string
  mock_exam_id: string
  topic_id: number | null
  error_type: ErrorType
  created_at: string
}

export type WeeklyTask = {
  id: string
  student_id: string
  week_start: string
  day_index: number
  topic_id: number | null
  custom_label: string | null
  question_count: number
  is_exam: boolean
  completed: boolean
  created_at: string
}

// Supabase JS v2 generic client tipi için minimal Database şeması.
// Her tablo Row/Insert/Update varyantlarını paylaşır (Insert: id/created_at opsiyonel).
// Relationships boş bırakılıyor — postgrest-js sadece dizi tipini istiyor, foreign-key
// bilgisini gerçek zamanlı sorgu tip çıkarımı için kullanıyor (bkz. mock_exam_sections join'i).
type TableDef<Row> = {
  Row: Row
  Insert: Partial<Row> & Omit<Row, 'id' | 'created_at'>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<Profile>
      students: TableDef<Student>
      subjects: TableDef<Subject>
      topics: TableDef<Topic>
      topic_measurements: TableDef<TopicMeasurement>
      coach_decisions: TableDef<CoachDecision>
      mock_exams: TableDef<MockExam>
      mock_exam_sections: TableDef<MockExamSection>
      error_basket_items: TableDef<ErrorBasketItem>
      weekly_tasks: TableDef<WeeklyTask>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
