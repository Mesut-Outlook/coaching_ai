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
  is_active: boolean
  phone_number: string | null
  parent_phone_number: string | null
  photo_url: string | null
  student_access_code?: string | null
  parent_access_code?: string | null
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

export type ScoreType = 'SAY' | 'EA' | 'SÖZ' | 'DİL' | 'TYT'

// YÖK Atlas üniversite/bölüm sıralama verisi — "Tercih Sihirbazı" ekranı.
// Ortak, salt-okunur referans (RLS: herkese açık okuma). id bigserial, program_code = ÖSYM/YÖP kodu.
export type UniversityRanking = {
  id: number
  program_code: number
  university: string
  university_type: string | null
  city: string | null
  faculty: string | null
  program: string
  degree_level: string | null
  fee_type: string | null
  education_type: string | null
  score_type: ScoreType | null
  year: number
  base_score: number | null
  base_ranking: number | null
  quota: number | null
}

// Devamsızlık takibi — yoklama listesi yok, sadece devamsızlık olayları
// kaydediliyor (bkz. supabase/schema.sql). excuse_type='yok' → mazeretsiz.
export type SessionType = 'birebir' | 'etut' | 'grup' | 'online'
export type AbsenceStatus = 'gelmedi' | 'gec_geldi' | 'erken_ayrildi'
export type ExcuseType = 'yok' | 'hastalik' | 'ailevi' | 'okul_sinav' | 'ulasim' | 'izinli' | 'diger'
export type NotifyTarget = 'ogrenci' | 'veli' | 'ikisi'

export type AttendanceRecord = {
  id: string
  student_id: string
  absence_date: string
  session_type: SessionType
  status: AbsenceStatus
  excuse_type: ExcuseType
  excuse_note: string | null
  notified_at: string | null
  notified_to: NotifyTarget | null
  created_at: string
}

// Supabase JS v2 generic client tipi için minimal Database şeması.
// Her tablo Row/Insert/Update varyantlarını paylaşır (Insert: id/created_at opsiyonel).
// Relationships boş bırakılıyor — postgrest-js sadece dizi tipini istiyor, foreign-key
// bilgisini gerçek zamanlı sorgu tip çıkarımı için kullanıyor (bkz. mock_exam_sections join'i).
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

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
      university_rankings: TableDef<UniversityRanking>
      attendance_records: TableDef<AttendanceRecord>
    }
    Views: Record<string, never>
    // Mobil portal RPC'leri (supabase/schema.sql "Mobil Portal veri katmanı").
    // Hepsi json döndürüyor: { ok: true, ... } | { ok: false, error: string }.
    // Somut alanları `src/lib/portal.ts` daraltıyor, burada Json yeterli.
    Functions: {
      portal_login: { Args: { p_code: string }; Returns: Json }
      portal_dashboard: { Args: { p_code: string }; Returns: Json }
      portal_set_task_completed: {
        Args: { p_code: string; p_task_id: string; p_completed: boolean }
        Returns: Json
      }
      portal_add_exam: {
        Args: {
          p_code: string
          p_name: string
          p_publisher: string | null
          p_exam_type: string
          p_exam_date: string
          p_sections: Json
        }
        Returns: Json
      }
    }
  }
}
