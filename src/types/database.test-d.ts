// database.ts için derleme-zamanı testleri (runtime yok, çalıştırılmaz).
//
// Bu dosya `tsconfig.app.json` -> include: ["src"] içinde olduğu için
// `npm run build` (tsc -b) her seferinde denetler. Bir assertion bozulursa
// derleme "Type 'false' does not satisfy the constraint 'true'" ile patlar —
// hata satırındaki assertion adı neyin kaydığını söyler.
// Hiçbir yerden import edilmediği için bundle'a girmez.
//
// Kapsam: TableDef sözleşmesi (Row/Insert/Update) + tablo adı ↔ satır tipi
// eşlemesi + SQL CHECK kısıtlarının TS union karşılıkları.
// Sütun bazlı ad/tip/null denetimi burada DEĞİL — onu schema.sql'i okuyarak
// `npm run test:types` (scripts/checkSchemaSync.ts) yapıyor.

import type {
  AbsenceStatus,
  AttendanceRecord,
  CoachDecision,
  Curriculum,
  Database,
  ErrorBasketItem,
  ErrorType,
  ExamType,
  ExcuseType,
  Grade,
  Institution,
  Invitation,
  InvitationStatus,
  MasteryState,
  MeasurementSource,
  Membership,
  MockExam,
  MockExamSection,
  NotifyTarget,
  PermissionCatalogItem,
  Profile,
  Role,
  ScoreType,
  SessionType,
  Student,
  Subject,
  Topic,
  TopicMeasurement,
  Track,
  UniversityRanking,
  WeeklyTask,
} from './database'

// --------------------------------------------------------------------------
// Yardımcılar
// --------------------------------------------------------------------------

/** Expect<X> — X `true` değilse derleme hatası. */
type Expect<T extends true> = T

/** İki tipin birebir aynı olması (çift-koşullu hile: `any` de yakalanır). */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false

/** Opsiyonel (`?`) alanların adları. */
type OptionalKeys<T> = {
  [K in keyof T]-?: Record<never, never> extends Pick<T, K> ? K : never
}[keyof T]

type Tables = Database['public']['Tables']
type Row<K extends keyof Tables> = Tables[K]['Row']
type Insert<K extends keyof Tables> = Tables[K]['Insert']
type Update<K extends keyof Tables> = Tables[K]['Update']

// --------------------------------------------------------------------------
// 1. Tablo adı ↔ satır tipi eşlemesi
//    TableDef<...> içine yanlış tipin yazılmasını yakalar (örn. topics: TableDef<Subject>).
// --------------------------------------------------------------------------

export type _rowInstitutions = Expect<Equals<Row<'institutions'>, Institution>>
export type _rowProfiles = Expect<Equals<Row<'profiles'>, Profile>>
export type _rowPermissionCatalog = Expect<Equals<Row<'permission_catalog'>, PermissionCatalogItem>>
export type _rowRoles = Expect<Equals<Row<'roles'>, Role>>
export type _rowMemberships = Expect<Equals<Row<'memberships'>, Membership>>
export type _rowInvitations = Expect<Equals<Row<'invitations'>, Invitation>>
export type _rowStudents = Expect<Equals<Row<'students'>, Student>>
export type _rowSubjects = Expect<Equals<Row<'subjects'>, Subject>>
export type _rowTopics = Expect<Equals<Row<'topics'>, Topic>>
export type _rowTopicMeasurements = Expect<Equals<Row<'topic_measurements'>, TopicMeasurement>>
export type _rowCoachDecisions = Expect<Equals<Row<'coach_decisions'>, CoachDecision>>
export type _rowMockExams = Expect<Equals<Row<'mock_exams'>, MockExam>>
export type _rowMockExamSections = Expect<Equals<Row<'mock_exam_sections'>, MockExamSection>>
export type _rowErrorBasketItems = Expect<Equals<Row<'error_basket_items'>, ErrorBasketItem>>
export type _rowWeeklyTasks = Expect<Equals<Row<'weekly_tasks'>, WeeklyTask>>
export type _rowUniversityRankings = Expect<Equals<Row<'university_rankings'>, UniversityRanking>>
export type _rowAttendanceRecords = Expect<Equals<Row<'attendance_records'>, AttendanceRecord>>

/**
 * Tablo listesi tam — bir tablo sessizce düşerse (veya adı değişirse) burada patlar.
 * `supabase.from('...')` yalnızca bu adları kabul ediyor.
 */
export type _tableNames = Expect<
  Equals<
    keyof Tables,
    | 'institutions'
    | 'profiles'
    | 'permission_catalog'
    | 'roles'
    | 'memberships'
    | 'invitations'
    | 'students'
    | 'subjects'
    | 'topics'
    | 'topic_measurements'
    | 'coach_decisions'
    | 'mock_exams'
    | 'mock_exam_sections'
    | 'error_basket_items'
    | 'weekly_tasks'
    | 'university_rankings'
    | 'attendance_records'
    | 'audit_log'
  >
>

/** postgrest-js generic client'ı Views/Functions anahtarlarını bekliyor. */
export type _hasViews = Expect<Equals<keyof Database['public'], 'Tables' | 'Views' | 'Functions'>>

// --------------------------------------------------------------------------
// 2. TableDef sözleşmesi: Insert'te yalnız id/created_at opsiyonel, Update tümüyle kısmi
// --------------------------------------------------------------------------

// created_at'i olan tablolarda ikisi de opsiyonel...
export type _insInstitutions = Expect<Equals<OptionalKeys<Insert<'institutions'>>, 'id' | 'created_at'>>
export type _insRoles = Expect<Equals<OptionalKeys<Insert<'roles'>>, 'id' | 'created_at'>>
export type _insMemberships = Expect<Equals<OptionalKeys<Insert<'memberships'>>, 'id' | 'created_at'>>
// token DB tarafında gen_random_uuid() ile üretiliyor — students'taki erişim kodlarıyla aynı desen.
export type _insInvitations = Expect<Equals<OptionalKeys<Insert<'invitations'>>, 'id' | 'created_at' | 'token'>>
export type _insStudents = Expect<Equals<OptionalKeys<Insert<'students'>>, 'id' | 'created_at' | 'student_access_code' | 'parent_access_code' | 'institution_id' | 'coaching_coach_id'>>
export type _insProfiles = Expect<Equals<OptionalKeys<Insert<'profiles'>>, 'id' | 'created_at'>>
export type _insWeeklyTasks = Expect<
  Equals<OptionalKeys<Insert<'weekly_tasks'>>, 'id' | 'created_at'>
>
export type _insAttendance = Expect<
  Equals<OptionalKeys<Insert<'attendance_records'>>, 'id' | 'created_at'>
>

// ...created_at'i olmayan tablolarda sadece id.
export type _insSubjects = Expect<Equals<OptionalKeys<Insert<'subjects'>>, 'id'>>
export type _insTopics = Expect<Equals<OptionalKeys<Insert<'topics'>>, 'id'>>
export type _insSections = Expect<Equals<OptionalKeys<Insert<'mock_exam_sections'>>, 'id'>>
export type _insRankings = Expect<Equals<OptionalKeys<Insert<'university_rankings'>>, 'id'>>

// Insert zorunlu alanı gerçekten zorunlu tutuyor (id/created_at dışı hiçbir şey düşmez).
export type _insStudentsRequired = Expect<
  Equals<
    Exclude<keyof Insert<'students'>, 'id' | 'created_at'>,
    Exclude<keyof Student, 'id' | 'created_at'>
  >
>

// Update her alanı opsiyonel yapar (kısmi güncelleme / upsert).
export type _updStudents = Expect<Equals<OptionalKeys<Update<'students'>>, keyof Student>>
export type _updDecisions = Expect<Equals<OptionalKeys<Update<'coach_decisions'>>, keyof CoachDecision>>
export type _updSubjects = Expect<Equals<OptionalKeys<Update<'subjects'>>, keyof Subject>>

// --------------------------------------------------------------------------
// 3. SQL CHECK kısıtları ↔ TS union'ları
// --------------------------------------------------------------------------

export type _invitationStatus = Expect<Equals<InvitationStatus, 'bekliyor' | 'kabul' | 'iptal'>>
export type _grade = Expect<
  Equals<
    Grade,
    '7. Sınıf' | '8. Sınıf' | '9. Sınıf' | '10. Sınıf' | '11. Sınıf' | '12. Sınıf' | 'Mezun'
  >
>
export type _track = Expect<Equals<Track, 'SAY' | 'EA' | 'SÖZ'>>
export type _curriculum = Expect<Equals<Curriculum, 'YKS' | 'LGS'>>
export type _source = Expect<Equals<MeasurementSource, 'konu_testi' | 'deneme'>>
export type _state = Expect<Equals<MasteryState, 'kritik' | 'gelisiyor' | 'yeterli'>>
export type _examType = Expect<Equals<ExamType, 'TYT' | 'AYT' | 'LGS'>>
export type _errorType = Expect<
  Equals<ErrorType, 'bilgi_eksikligi' | 'islem_hatasi' | 'dikkat_hatasi' | 'sure_yetmedi'>
>
export type _sessionType = Expect<Equals<SessionType, 'birebir' | 'etut' | 'grup' | 'online'>>
export type _absenceStatus = Expect<Equals<AbsenceStatus, 'gelmedi' | 'gec_geldi' | 'erken_ayrildi'>>
export type _excuseType = Expect<
  Equals<ExcuseType, 'yok' | 'hastalik' | 'ailevi' | 'okul_sinav' | 'ulasim' | 'izinli' | 'diger'>
>
export type _notifyTarget = Expect<Equals<NotifyTarget, 'ogrenci' | 'veli' | 'ikisi'>>
export type _scoreType = Expect<Equals<ScoreType, 'SAY' | 'EA' | 'SÖZ' | 'DİL' | 'TYT'>>

export type _studentGradeField = Expect<Equals<Student['grade'], Grade>>
// LGS öğrencisinde Alan (SAY/EA/SÖZ) kavramı yok → nullable.
export type _studentTrackField = Expect<Equals<Student['track'], Track | null>>
export type _decisionStateField = Expect<Equals<CoachDecision['state'], MasteryState>>
export type _measurementSourceField = Expect<Equals<TopicMeasurement['source'], MeasurementSource>>
export type _examTypeField = Expect<Equals<MockExam['exam_type'], ExamType>>
export type _errorTypeField = Expect<Equals<ErrorBasketItem['error_type'], ErrorType>>
export type _attendanceSessionField = Expect<Equals<AttendanceRecord['session_type'], SessionType>>
export type _attendanceStatusField = Expect<Equals<AttendanceRecord['status'], AbsenceStatus>>
export type _attendanceExcuseField = Expect<Equals<AttendanceRecord['excuse_type'], ExcuseType>>

// --------------------------------------------------------------------------
// 4. UI mantığının doğrudan dayandığı null'lanabilirlikler
// --------------------------------------------------------------------------

export type _studentNullables = Expect<
  Equals<
    | Student['photo_url']
    | Student['phone_number']
    | Student['parent_phone_number']
    | Student['target_program'],
    string | null
  >
>
export type _subjectCurriculumField = Expect<Equals<Subject['curriculum'], Curriculum>>
export type _subjectGradesField = Expect<Equals<Subject['grades'], Grade[]>>
export type _subjectKatsayi = Expect<Equals<Subject['katsayi'], number | null>>
export type _topicGradesField = Expect<Equals<Topic['grades'], Grade[]>>
export type _studentTargetNet = Expect<Equals<Student['target_net_value'], number | null>>
export type _taskTopicId = Expect<Equals<WeeklyTask['topic_id'], number | null>>
export type _taskCustomLabel = Expect<Equals<WeeklyTask['custom_label'], string | null>>
export type _basketTopicId = Expect<Equals<ErrorBasketItem['topic_id'], number | null>>
export type _attendanceNotified = Expect<Equals<AttendanceRecord['notified_at'], string | null>>
export type _attendanceNotifiedTo = Expect<
  Equals<AttendanceRecord['notified_to'], NotifyTarget | null>
>
export type _rankingNullables = Expect<
  Equals<UniversityRanking['base_ranking'] | UniversityRanking['base_score'], number | null>
>

export type _sectionNet = Expect<Equals<MockExamSection['net'], number>>
// LGS'te yanlış cezası 3, YKS'de 4 — DB'de generated `net` bunun üzerinden hesaplanıyor.
export type _sectionWrongPenalty = Expect<Equals<MockExamSection['wrong_penalty'], number>>
export type _sectionCounts = Expect<
  Equals<
    | MockExamSection['correct_count']
    | MockExamSection['wrong_count']
    | MockExamSection['blank_count']
    | MockExamSection['max_questions']
    | MockExamSection['wrong_penalty'],
    number
  >
>
export type _accuracyPct = Expect<Equals<TopicMeasurement['accuracy_pct'], number>>
export type _isActiveFlags = Expect<
  Equals<Student['is_active'] | Subject['is_active'] | Topic['is_active'], boolean>
>
export type _taskFlags = Expect<Equals<WeeklyTask['is_exam'] | WeeklyTask['completed'], boolean>>

export type _dateFields = Expect<
  Equals<
    | Student['created_at']
    | MockExam['exam_date']
    | WeeklyTask['week_start']
    | TopicMeasurement['measured_at']
    | AttendanceRecord['absence_date']
    | CoachDecision['decided_at'],
    string
  >
>

export type _uuidKeys = Expect<
  Equals<Student['id'] | Student['coach_id'] | MockExamSection['mock_exam_id'], string>
>
export type _serialKeys = Expect<
  Equals<Subject['id'] | Topic['id'] | Topic['subject_id'] | CoachDecision['topic_id'], number>
>
