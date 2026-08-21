// supabase/schema.sql ile birebir eşleşir. Şema değiştiğinde burayı da güncelle.

export type Grade =
  | '7. Sınıf'
  | '8. Sınıf'
  | '9. Sınıf'
  | '10. Sınıf'
  | '11. Sınıf'
  | '12. Sınıf'
  | 'Mezun'

/** Sınıf seçimlerinde kullanılan sıralı liste (7 → 12 → Mezun). */
export const GRADES: readonly Grade[] = [
  '7. Sınıf',
  '8. Sınıf',
  '9. Sınıf',
  '10. Sınıf',
  '11. Sınıf',
  '12. Sınıf',
  'Mezun',
]
export type Track = 'SAY' | 'EA' | 'SÖZ'
export type Curriculum = 'YKS' | 'LGS'
export type MeasurementSource = 'konu_testi' | 'deneme'
export type MasteryState = 'kritik' | 'gelisiyor' | 'yeterli'
export type ExamType = 'TYT' | 'AYT' | 'LGS'
export type ErrorType = 'bilgi_eksikligi' | 'islem_hatasi' | 'dikkat_hatasi' | 'sure_yetmedi'
export type InvitationStatus = 'bekliyor' | 'kabul' | 'iptal'

export type Institution = {
  id: string
  name: string
  slug: string
  /** true = bireysel koçluk pratiği (Netlik): öğrenci listesi kuruma değil koça bağlıdır */
  is_coaching_practice: boolean
  created_at: string
}

export type Profile = {
  id: string
  full_name: string
  role: string
  is_system_admin: boolean
  created_at: string
}

export type PermissionCatalogItem = {
  key: string
  label: string
  group_key: string
  group_label: string
  sort_order: number
}

export type Role = {
  id: string
  institution_id: string | null
  key: string
  name: string
  permissions: string[]
  is_system: boolean
  created_at: string
}

export type Membership = {
  id: string
  institution_id: string
  user_id: string
  role_id: string
  is_active: boolean
  created_at: string
}

export type Invitation = {
  id: string
  institution_id: string
  email: string
  role_id: string
  invited_by: string
  status: InvitationStatus
  accepted_by: string | null
  accepted_at: string | null
  /**
   * Davet bağlantısındaki gizli anahtar; /kayit bunu doğrulamadan hesap açmaz.
   * Opsiyonel çünkü DB tarafında `default gen_random_uuid()` ile üretiliyor —
   * okumada daima dolu gelir, insert'te gönderilmez.
   */
  token?: string
  created_at: string
}

/** Denetim kaydı. Trigger yazar, yalnız sistem admini okur. */
export type AuditLogEntry = {
  id: number
  occurred_at: string
  actor_id: string | null
  actor_label: string
  actor_name: string | null
  institution_id: string | null
  student_id: string | null
  table_name: string
  row_id: string
  action: 'insert' | 'update' | 'delete'
  old_row: Json | null
  new_row: Json | null
}

export type Student = {
  id: string
  coach_id: string
  institution_id?: string | null
  coaching_coach_id?: string | null
  full_name: string
  grade: Grade
  /** LGS öğrencisinde Alan kavramı yok → null. */
  track: Track | null
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
  curriculum: Curriculum
  /** Ders bu sınıflara özel; boş dizi = ilgili müfredatın tüm sınıfları. */
  grades: Grade[]
  /** LGS puan katsayısı; YKS derslerinde null. */
  katsayi: number | null
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
  /** Yanlışın doğruyu götürme oranı — YKS'de 4, LGS'de 3. `net` bunun üzerinden türetilir. */
  wrong_penalty: number
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
      institutions: TableDef<Institution>
      profiles: TableDef<Profile>
      permission_catalog: TableDef<PermissionCatalogItem>
      roles: TableDef<Role>
      memberships: TableDef<Membership>
      invitations: TableDef<Invitation>
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
      audit_log: TableDef<AuditLogEntry>
    }
    Views: Record<string, never>
    Functions: {
      my_access: { Args: Record<string, never>; Returns: Json }
      invitation_by_token: { Args: { p_token: string }; Returns: Json }
      audit_purge: { Args: { p_before: string }; Returns: Json }
      audit_stats: { Args: Record<string, never>; Returns: Json }
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
