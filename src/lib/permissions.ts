export type PermissionKey =
  | 'panel.view'
  | 'students.view'
  | 'students.create'
  | 'students.edit'
  | 'students.archive'
  | 'students.delete'
  | 'students.contact.view'
  | 'students.access_code.manage'
  | 'attendance.view'
  | 'attendance.manage'
  | 'attendance.notify'
  | 'exams.view'
  | 'exams.manage'
  | 'topics.view'
  | 'topics.manage'
  | 'program.view'
  | 'program.manage'
  | 'reports.view'
  | 'curriculum.manage'
  | 'tercih.view'
  | 'members.manage'
  | 'roles.manage'

export type PermissionGroupKey =
  | 'panel'
  | 'students'
  | 'attendance'
  | 'exams'
  | 'topics'
  | 'program'
  | 'reports'
  | 'curriculum'
  | 'tercih'
  | 'management'

export interface PermissionDefinition {
  key: PermissionKey
  label: string
}

export interface PermissionGroup {
  group_key: PermissionGroupKey
  group_label: string
  permissions: PermissionDefinition[]
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group_key: 'panel',
    group_label: 'Panel',
    permissions: [
      { key: 'panel.view', label: 'Paneli görüntüleme' },
    ],
  },
  {
    group_key: 'students',
    group_label: 'Öğrenciler',
    permissions: [
      { key: 'students.view', label: 'Öğrencileri görüntüleme' },
      { key: 'students.create', label: 'Öğrenci ekleme' },
      { key: 'students.edit', label: 'Öğrenci düzenleme' },
      { key: 'students.archive', label: 'Öğrenci arşivleme' },
      { key: 'students.delete', label: 'Öğrenci silme' },
      { key: 'students.contact.view', label: 'Öğrenci/veli iletişim bilgilerini görme' },
      { key: 'students.access_code.manage', label: 'Erişim kodu yönetimi' },
    ],
  },
  {
    group_key: 'attendance',
    group_label: 'Devamsızlık',
    permissions: [
      { key: 'attendance.view', label: 'Devamsızlık kayıtlarını görme' },
      { key: 'attendance.manage', label: 'Devamsızlık kaydı girme/silme' },
      { key: 'attendance.notify', label: 'Devamsızlık bildirimi gönderme' },
    ],
  },
  {
    group_key: 'exams',
    group_label: 'Denemeler',
    permissions: [
      { key: 'exams.view', label: 'Deneme sınavlarını görme' },
      { key: 'exams.manage', label: 'Deneme sınavı girme/silme' },
    ],
  },
  {
    group_key: 'topics',
    group_label: 'Konular',
    permissions: [
      { key: 'topics.view', label: 'Konu yeterlilik ve testlerini görme' },
      { key: 'topics.manage', label: 'Konu testi girme / koç kararı verme' },
    ],
  },
  {
    group_key: 'program',
    group_label: 'Haftalık Program',
    permissions: [
      { key: 'program.view', label: 'Haftalık programı görme' },
      { key: 'program.manage', label: 'Haftalık programa görev ekleme/düzenleme/silme' },
    ],
  },
  {
    group_key: 'reports',
    group_label: 'Raporlar',
    permissions: [
      { key: 'reports.view', label: 'Raporları görüntüleme' },
    ],
  },
  {
    group_key: 'curriculum',
    group_label: 'Müfredat',
    permissions: [
      { key: 'curriculum.manage', label: 'Müfredat ders ve konularını düzenleme' },
    ],
  },
  {
    group_key: 'tercih',
    group_label: 'Tercih Sihirbazı',
    permissions: [
      { key: 'tercih.view', label: 'Tercih sihirbazını kullanma' },
    ],
  },
  {
    group_key: 'management',
    group_label: 'Yönetim',
    permissions: [
      { key: 'members.manage', label: 'Kurum üyelerini ve davetleri yönetme' },
      { key: 'roles.manage', label: 'Kurum rollerini ve yetkilerini yönetme' },
    ],
  },
]

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key)
)
