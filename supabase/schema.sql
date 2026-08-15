-- Netlik (Coching_AI) — Supabase şeması (RBAC / Çok Kurumlu Yapı Entegrasyonlu)
-- Sırayla çalıştır: bu dosyanın tamamını Supabase SQL Editor'de tek seferde yürütebilirsin.

-- ---------------------------------------------------------------------------
-- 1. Kurumlar (Institutions)
-- ---------------------------------------------------------------------------
create table if not exists institutions (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug text unique not null,
  -- true = bu kurum bir "bireysel koçluk pratiği" (Netlik). Öğrenci listesi kurumla
  -- DEĞİL, coaching_coach_id ile belirlenir: kendi kurumundaki öğrenciler + başka
  -- kurumlarda (ör. Concept) koçluk verilen öğrenciler birlikte görünür.
  is_coaching_practice boolean not null default false,
  created_at timestamptz not null default now()
);
alter table institutions add column if not exists is_coaching_practice boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Koç profili (auth.users'a 1:1 uzanır)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'Kurucu Koç',
  is_system_admin boolean not null default false,
  created_at timestamptz not null default now()
);
alter table profiles add column if not exists is_system_admin boolean not null default false;

-- ---------------------------------------------------------------------------
-- 3. İzin Kataloğu (Permission Catalog) & Roller (Roles)
-- ---------------------------------------------------------------------------
create table if not exists permission_catalog (
  key text primary key,
  label text not null,
  group_key text not null,
  group_label text not null,
  sort_order int not null default 0
);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references institutions(id) on delete cascade, -- null = sistem şablonu
  key text not null,
  name text not null,
  permissions text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists roles_system_key_idx on roles(key) where institution_id is null;
create unique index if not exists roles_inst_key_idx on roles(institution_id, key) where institution_id is not null;

-- ---------------------------------------------------------------------------
-- 4. Üyelikler (Memberships) & Davetler (Invitations)
-- ---------------------------------------------------------------------------
create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (institution_id, user_id)
);
create index if not exists memberships_user_id_idx on memberships(user_id);
create index if not exists memberships_inst_id_idx on memberships(institution_id);

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  email text not null,
  role_id uuid not null references roles(id) on delete cascade,
  invited_by uuid not null references auth.users(id),
  status text not null check (status in ('bekliyor','kabul','iptal')) default 'bekliyor',
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists invitations_pending_idx on invitations(institution_id, lower(email)) where status = 'bekliyor';

-- ---------------------------------------------------------------------------
-- 5. Öğrenciler
-- ---------------------------------------------------------------------------
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid references institutions(id) on delete restrict,
  coaching_coach_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  grade text not null check (grade in ('12. Sınıf', 'Mezun')),
  track text not null check (track in ('SAY', 'EA', 'SÖZ')),
  target_program text,
  target_ranking text,
  target_net_label text,
  target_net_value numeric,
  is_active boolean not null default true,
  phone_number text,
  parent_phone_number text,
  photo_url text,
  student_access_code text,
  parent_access_code text,
  created_at timestamptz not null default now()
);
create index if not exists students_coach_id_idx on students(coach_id);

-- Geriye dönük kolon eklemeleri
-- ⚠️ Yeni kolonlara ait indeksler bu blogun ALTINDA kurulmali: tablo zaten varsa
-- yukaridaki "create table if not exists" tamamen atlanir ve kolonlar yalnizca
-- burada dogar. Aksi halde mevcut bir veritabaninda 42703 (column does not exist).
alter table students add column if not exists is_active boolean not null default true;
alter table students add column if not exists phone_number text;
alter table students add column if not exists parent_phone_number text;
alter table students add column if not exists photo_url text;
alter table students add column if not exists institution_id uuid references institutions(id) on delete restrict;
alter table students add column if not exists coaching_coach_id uuid references auth.users(id) on delete set null;
alter table students add column if not exists student_access_code text;
alter table students add column if not exists parent_access_code text;

create index if not exists students_institution_id_idx on students(institution_id);
create index if not exists students_coaching_coach_idx on students(coaching_coach_id);
create unique index if not exists students_student_access_code_idx on students(student_access_code) where student_access_code is not null;
create unique index if not exists students_parent_access_code_idx on students(parent_access_code) where parent_access_code is not null;

-- ---------------------------------------------------------------------------
-- 6. Backfill (Varsayılan Kurumlar & Mevcut Öğrenciler Entegrasyonu)
-- ---------------------------------------------------------------------------
insert into institutions (name, slug) values
  ('Netlik', 'eda-kocluk'),
  ('Concept Akademi', 'concept')
on conflict (slug) do nothing;

-- Tek seferlik ad duzeltmesi: yalnizca hala ILK seed adiysa degistir. Boylece
-- arayuzden sonradan verilen isim tekrar calistirmada EZILMEZ.
update institutions set name = 'Netlik'
where slug = 'eda-kocluk' and name = 'Eda Cangert Özel Koçluk';

-- Netlik = bireysel koçluk pratiği. Concept ise normal kurum (öğrenciler kuruma bağlı).
update institutions set is_coaching_practice = true  where slug = 'eda-kocluk' and not is_coaching_practice;
update institutions set is_coaching_practice = false where slug = 'concept'     and is_coaching_practice;

update students set institution_id = (select id from institutions where slug = 'eda-kocluk') where institution_id is null;
-- Bireysel koçluk işareti — YALNIZCA İLK GEÇİŞTE.
-- ⚠️ Koşulsuz "where coaching_coach_id is null" YAZMA: Eda bir Concept öğrencisinin
-- bireysel koçluk anahtarını arayüzden kapattığında alan null olur; şema tekrar
-- çalıştırıldığında bu satır onu SESSİZCE yeniden işaretler ve öğrencinin konu/
-- program verisini Concept personeline tekrar kapatır. Aşağıdaki "not exists"
-- guard'ı, hiç kimse işaretlenmemişken (yani gerçek ilk göç) bir kez çalışmasını
-- sağlar; sonraki koşularda hiçbir şey yapmaz.
update students set coaching_coach_id = coach_id
where coaching_coach_id is null
  and not exists (select 1 from students where coaching_coach_id is not null);
alter table students alter column institution_id set not null;

-- Sistem admini. ⚠️ Duz "update" YETMEZ: profiles satiri yalnizca yeni kayitta
-- (on_auth_user_created trigger'i) olusur, RBAC oncesinden var olan bir hesapta
-- satir hic olmayabilir → update 0 satir gunceller ve admin yetkisi SESSIZCE verilmez.
-- Bu yuzden upsert: satir yoksa olustur, varsa bayragi kaldir.
insert into profiles (id, full_name, role, is_system_admin)
select
  u.id,
  coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)),
  'Kurucu Koç',
  true
from auth.users u
-- ⚠️ Supabase hesabinin e-postasi burada birebir dogru yazilmali. Yanlissa sorgu
-- 0 satir eslestirir ve admin yetkisi yine SESSIZCE verilmez (2026-08-13'te yasandi:
-- seed 'ozdemirmesut@gmail.com' idi, gercek hesap 'ozdemir-mesut@outlook.com').
where lower(u.email) in ('ozdemir-mesut@outlook.com', 'ozdemirmesut@gmail.com')
on conflict (id) do update set is_system_admin = true;

-- ---------------------------------------------------------------------------
-- 7. Seed Data: İzin Kataloğu (Permission Catalog) & Şablon Roller
-- ---------------------------------------------------------------------------
insert into permission_catalog (key, label, group_key, group_label, sort_order) values
  ('panel.view', 'Paneli görüntüleme', 'panel', 'Panel', 10),
  ('students.view', 'Öğrencileri görüntüleme', 'students', 'Öğrenciler', 20),
  ('students.create', 'Öğrenci ekleme', 'students', 'Öğrenciler', 21),
  ('students.edit', 'Öğrenci düzenleme', 'students', 'Öğrenciler', 22),
  ('students.archive', 'Öğrenci arşivleme', 'students', 'Öğrenciler', 23),
  ('students.delete', 'Öğrenci silme', 'students', 'Öğrenciler', 24),
  ('students.contact.view', 'Öğrenci/veli iletişim bilgilerini görme', 'students', 'Öğrenciler', 25),
  ('students.access_code.manage', 'Erişim kodu yönetimi', 'students', 'Öğrenciler', 26),
  ('attendance.view', 'Devamsızlık kayıtlarını görme', 'attendance', 'Devamsızlık', 30),
  ('attendance.manage', 'Devamsızlık kaydı girme/silme', 'attendance', 'Devamsızlık', 31),
  ('attendance.notify', 'Devamsızlık bildirimi gönderme', 'attendance', 'Devamsızlık', 32),
  ('exams.view', 'Deneme sınavlarını görme', 'exams', 'Denemeler', 40),
  ('exams.manage', 'Deneme sınavı girme/silme', 'exams', 'Denemeler', 41),
  ('topics.view', 'Konu yeterlilik ve testlerini görme', 'topics', 'Konular', 50),
  ('topics.manage', 'Konu testi girme / koç kararı verme', 'topics', 'Konular', 51),
  ('program.view', 'Haftalık programı görme', 'program', 'Haftalık Program', 60),
  ('program.manage', 'Haftalık programa görev ekleme/düzenleme/silme', 'program', 'Haftalık Program', 61),
  ('reports.view', 'Raporları görüntüleme', 'reports', 'Raporlar', 70),
  ('curriculum.manage', 'Müfredat ders ve konularını düzenleme', 'curriculum', 'Müfredat', 80),
  ('tercih.view', 'Tercih sihirbazını kullanma', 'tercih', 'Tercih Sihirbazı', 90),
  ('members.manage', 'Kurum üyelerini ve davetleri yönetme', 'management', 'Yönetim', 100),
  ('roles.manage', 'Kurum rollerini ve yetkilerini yönetme', 'management', 'Yönetim', 101)
on conflict (key) do update set
  label = excluded.label,
  group_key = excluded.group_key,
  group_label = excluded.group_label,
  sort_order = excluded.sort_order;

insert into roles (institution_id, key, name, permissions, is_system) values
  (null, 'kurum_yonetici', 'Kurum Yöneticisi', array[
    'panel.view','students.view','students.create','students.edit','students.archive','students.delete','students.contact.view','students.access_code.manage',
    'attendance.view','attendance.manage','attendance.notify','exams.view','exams.manage','topics.view','topics.manage',
    'program.view','program.manage','reports.view','curriculum.manage','tercih.view','members.manage','roles.manage'
  ], true),
  (null, 'personel', 'Personel', array[
    'panel.view','students.view','students.create','students.edit','students.archive','students.contact.view',
    'attendance.view','attendance.manage','attendance.notify','exams.view','exams.manage','topics.view','topics.manage',
    'program.view','program.manage','reports.view','tercih.view'
  ], true),
  (null, 'etut_gorevlisi', 'Etüt Görevlisi', array[
    'panel.view','students.view','attendance.view','attendance.manage','attendance.notify'
  ], true)
on conflict (key) where institution_id is null do update set
  name = excluded.name,
  permissions = excluded.permissions,
  is_system = true;

-- ---------------------------------------------------------------------------
-- 7b. Mevcut koçların üyelik backfill'i  ⚠️ ATLANIRSA CANLI UYGULAMA KIRILIR
-- ---------------------------------------------------------------------------
-- RBAC öncesinde kullanıcıların üyelik satırı yok. Yeni RLS ise okumayı
-- "is_system_admin() OR institution_id in my_institution_ids()" şartına bağlıyor.
-- Backfill olmadan mevcut koçlar (sistem admini hariç) kendi öğrencilerini bile
-- göremez — RLS hata vermez, sessizce BOŞ LİSTE döner.
-- Kendi öğrencisi olan her koç, o öğrencilerin kurumunda "Kurum Yöneticisi" olur.
-- `do nothing`: sonradan elle değiştirilen/pasifleştirilen üyelikleri geri almaz.
insert into memberships (institution_id, user_id, role_id, is_active)
select distinct
  s.institution_id,
  s.coach_id,
  (select id from roles where key = 'kurum_yonetici' and institution_id is null),
  true
from students s
where s.institution_id is not null
on conflict (institution_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 7c. Eda Cangert: HER İKİ kurumda da yönetici
-- ---------------------------------------------------------------------------
-- Eda hem Netlik'i (kendi özel koçluğu) hem Concept Akademi'yi yönetir ve ikisine
-- de kullanıcı davet edebilmelidir. §7b onu yalnızca öğrencilerinin bulunduğu
-- kuruma üye yapar; eksik kalan kurum burada tamamlanır.
-- `do nothing`: arayüzden sonradan değiştirilen/pasifleştirilen üyeliği geri almaz.
insert into memberships (institution_id, user_id, role_id, is_active)
select i.id, u.id, r.id, true
from auth.users u
cross join institutions i
cross join roles r
where lower(u.email) = 'test-arkadas@netlik.app'   -- Eda Cangert
  and i.slug in ('eda-kocluk', 'concept')
  and r.key = 'kurum_yonetici' and r.institution_id is null
on conflict (institution_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Müfredat: dersler ve konular
-- ---------------------------------------------------------------------------
create table if not exists subjects (
  id serial primary key,
  name text not null unique,
  color text not null,
  soru_sayisi text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table if not exists topics (
  id serial primary key,
  subject_id int not null references subjects(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (subject_id, name)
);
create index if not exists topics_subject_id_idx on topics(subject_id);

alter table subjects add column if not exists is_active boolean not null default true;
alter table topics add column if not exists is_active boolean not null default true;

-- ---------------------------------------------------------------------------
-- 9. Ölçümler, Kararlar, Denemeler, Program, Devamsızlık
-- ---------------------------------------------------------------------------
create table if not exists topic_measurements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  topic_id int not null references topics(id) on delete cascade,
  source text not null check (source in ('konu_testi', 'deneme')),
  source_label text not null,
  correct_count int,
  wrong_count int,
  blank_count int,
  accuracy_pct numeric not null check (accuracy_pct >= 0 and accuracy_pct <= 100),
  measured_at date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists topic_measurements_student_topic_idx on topic_measurements(student_id, topic_id);

create table if not exists coach_decisions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  topic_id int not null references topics(id) on delete cascade,
  state text not null check (state in ('kritik', 'gelisiyor', 'yeterli')),
  note text,
  decided_by uuid not null references auth.users(id),
  decided_at timestamptz not null default now(),
  unique (student_id, topic_id)
);

create table if not exists mock_exams (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  name text not null,
  publisher text,
  exam_type text not null check (exam_type in ('TYT', 'AYT')) default 'TYT',
  exam_date date not null,
  created_at timestamptz not null default now()
);
create index if not exists mock_exams_student_id_idx on mock_exams(student_id);

create table if not exists mock_exam_sections (
  id uuid primary key default gen_random_uuid(),
  mock_exam_id uuid not null references mock_exams(id) on delete cascade,
  section_name text not null,
  max_questions int not null,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  blank_count int not null default 0,
  net numeric generated always as (correct_count - wrong_count / 4.0) stored
);
create index if not exists mock_exam_sections_exam_id_idx on mock_exam_sections(mock_exam_id);

create table if not exists error_basket_items (
  id uuid primary key default gen_random_uuid(),
  mock_exam_id uuid not null references mock_exams(id) on delete cascade,
  topic_id int references topics(id),
  error_type text not null check (error_type in ('bilgi_eksikligi', 'islem_hatasi', 'dikkat_hatasi', 'sure_yetmedi')),
  created_at timestamptz not null default now()
);
create index if not exists error_basket_items_exam_id_idx on error_basket_items(mock_exam_id);

create table if not exists weekly_tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  week_start date not null,
  day_index int not null check (day_index between 0 and 6),
  topic_id int references topics(id),
  custom_label text,
  question_count int not null default 0,
  is_exam boolean not null default false,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists weekly_tasks_student_week_idx on weekly_tasks(student_id, week_start);

create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  absence_date date not null,
  session_type text not null default 'birebir' check (session_type in ('birebir','etut','grup','online')),
  status text not null default 'gelmedi' check (status in ('gelmedi','gec_geldi','erken_ayrildi')),
  excuse_type text not null default 'yok' check (excuse_type in ('yok','hastalik','ailevi','okul_sinav','ulasim','izinli','diger')),
  excuse_note text,
  notified_at timestamptz,
  notified_to text check (notified_to is null or notified_to in ('ogrenci','veli','ikisi')),
  created_at timestamptz not null default now(),
  unique (student_id, absence_date, session_type)
);
create index if not exists attendance_records_student_idx on attendance_records(student_id);
create index if not exists attendance_records_date_idx on attendance_records(absence_date desc);

create table if not exists university_rankings (
  id bigserial primary key,
  program_code bigint not null,
  university text not null,
  university_type text,
  city text,
  faculty text,
  program text not null,
  degree_level text,
  fee_type text,
  education_type text,
  score_type text,
  year int not null,
  base_score numeric,
  base_ranking numeric,
  quota int,
  unique (program_code, year)
);

-- ---------------------------------------------------------------------------
-- 10. RBAC Yardımcı Fonksiyonları (Helper Functions)
-- ---------------------------------------------------------------------------
create or replace function is_system_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(
    (select p.is_system_admin from profiles p where p.id = auth.uid()),
    false
  );
$$;
revoke all on function is_system_admin() from public, anon;
grant execute on function is_system_admin() to authenticated;

create or replace function my_institution_ids()
returns setof uuid
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select m.institution_id
  from memberships m
  where m.user_id = auth.uid()
    and m.is_active = true;
$$;
revoke all on function my_institution_ids() from public, anon;
grant execute on function my_institution_ids() to authenticated;

create or replace function has_permission(p_institution uuid, p_key text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case
    when is_system_admin() then true
    when p_institution is null then false
    else exists (
      select 1
      from memberships m
      join roles r on r.id = m.role_id
      where m.user_id = auth.uid()
        and m.institution_id = p_institution
        and m.is_active = true
        and p_key = any(r.permissions)
    )
  end;
$$;
revoke all on function has_permission(uuid, text) from public, anon;
grant execute on function has_permission(uuid, text) to authenticated;

create or replace function user_has_any_permission(p_key text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case
    when is_system_admin() then true
    else exists (
      select 1
      from memberships m
      join roles r on r.id = m.role_id
      where m.user_id = auth.uid()
        and m.is_active = true
        and p_key = any(r.permissions)
    )
  end;
$$;
revoke all on function user_has_any_permission(text) from public, anon;
grant execute on function user_has_any_permission(text) to authenticated;

create or replace function student_permission(p_student uuid, p_key text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case
    when is_system_admin() then true
    when p_student is null then false
    else has_permission(
      (select s.institution_id from students s where s.id = p_student),
      p_key
    )
  end;
$$;
revoke all on function student_permission(uuid, text) from public, anon;
grant execute on function student_permission(uuid, text) to authenticated;

create or replace function can_access_coaching(p_student uuid, p_key text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case
    when is_system_admin() then true
    when (select s.coaching_coach_id from students s where s.id = p_student) is not null
      then (select s.coaching_coach_id from students s where s.id = p_student) = auth.uid()
    else student_permission(p_student, p_key)
  end;
$$;
revoke all on function can_access_coaching(uuid, text) from public, anon;
grant execute on function can_access_coaching(uuid, text) to authenticated;

create or replace function exam_student_id(p_exam uuid)
returns uuid
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select e.student_id from mock_exams e where e.id = p_exam;
$$;
revoke all on function exam_student_id(uuid) from public, anon;
grant execute on function exam_student_id(uuid) to authenticated;

create or replace function my_access()
returns json
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_is_admin boolean;
  v_memberships json;
begin
  v_is_admin := is_system_admin();

  select coalesce(json_agg(
    json_build_object(
      'institution_id', m.institution_id,
      'institution_name', i.name,
      'is_coaching_practice', i.is_coaching_practice,
      'role_id', r.id,
      'role_key', r.key,
      'role_name', r.name,
      'permissions', r.permissions
    )
  ), '[]'::json)
  into v_memberships
  from memberships m
  join institutions i on i.id = m.institution_id
  join roles r on r.id = m.role_id
  where m.user_id = auth.uid()
    and m.is_active = true;

  return json_build_object(
    'ok', true,
    'is_system_admin', v_is_admin,
    'memberships', v_memberships
  );
end;
$$;
revoke all on function my_access() from public, anon;
grant execute on function my_access() to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Güvenlik & Yetki Yükseltme Trigger'ları (Privilege Escalation Triggers)
-- ---------------------------------------------------------------------------
create or replace function prevent_system_admin_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then return NEW; end if;

  if NEW.is_system_admin <> OLD.is_system_admin and not is_system_admin() then
    NEW.is_system_admin := OLD.is_system_admin;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_prevent_system_admin_escalation on profiles;
create trigger trg_prevent_system_admin_escalation
  before update on profiles
  for each row execute function prevent_system_admin_escalation();

create or replace function check_membership_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_perms text[];
  v_caller_perms text[];
begin
  if auth.uid() is null then return NEW; end if;

  if is_system_admin() then
    return NEW;
  end if;

  if not has_permission(NEW.institution_id, 'members.manage') then
    raise exception 'Bu kurumda üye yönetimi izniniz bulunmamaktadır.';
  end if;

  select permissions into v_target_perms from roles where id = NEW.role_id;

  select array_agg(distinct p) into v_caller_perms
  from memberships m
  join roles r on r.id = m.role_id
  cross join unnest(r.permissions) as p
  where m.user_id = auth.uid()
    and m.institution_id = NEW.institution_id
    and m.is_active = true;

  if not (coalesce(v_target_perms, '{}') <@ coalesce(v_caller_perms, '{}')) then
    raise exception 'Kendi yetki kümenizden daha geniş yetkilere sahip bir rol atayamazsınız.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_check_membership_privilege_escalation on memberships;
create trigger trg_check_membership_privilege_escalation
  before insert or update on memberships
  for each row execute function check_membership_privilege_escalation();

create or replace function check_invitation_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_perms text[];
  v_caller_perms text[];
begin
  if auth.uid() is null then return NEW; end if;

  if is_system_admin() then
    return NEW;
  end if;

  if not has_permission(NEW.institution_id, 'members.manage') then
    raise exception 'Bu kurumda üye yönetimi izniniz bulunmamaktadır.';
  end if;

  select permissions into v_target_perms from roles where id = NEW.role_id;

  select array_agg(distinct p) into v_caller_perms
  from memberships m
  join roles r on r.id = m.role_id
  cross join unnest(r.permissions) as p
  where m.user_id = auth.uid()
    and m.institution_id = NEW.institution_id
    and m.is_active = true;

  if not (coalesce(v_target_perms, '{}') <@ coalesce(v_caller_perms, '{}')) then
    raise exception 'Kendi yetki kümenizden daha geniş yetkilere sahip bir rol ile davet gönderemezsiniz.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_check_invitation_privilege_escalation on invitations;
create trigger trg_check_invitation_privilege_escalation
  before insert or update on invitations
  for each row execute function check_invitation_privilege_escalation();

create or replace function check_role_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_perms text[];
begin
  if auth.uid() is null then return NEW; end if;

  if is_system_admin() then
    return NEW;
  end if;

  if NEW.institution_id is null then
    raise exception 'Sistem şablon rollerini yalnızca sistem yöneticisi düzenleyebilir.';
  end if;

  if not has_permission(NEW.institution_id, 'roles.manage') then
    raise exception 'Bu kurumda rol yönetimi izniniz bulunmamaktadır.';
  end if;

  select array_agg(distinct p) into v_caller_perms
  from memberships m
  join roles r on r.id = m.role_id
  cross join unnest(r.permissions) as p
  where m.user_id = auth.uid()
    and m.institution_id = NEW.institution_id
    and m.is_active = true;

  if not (coalesce(NEW.permissions, '{}') <@ coalesce(v_caller_perms, '{}')) then
    raise exception 'Kendi yetki kümenizden daha geniş yetkilere sahip bir rol oluşturamazsınız veya güncelleyemezsiniz.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_check_role_privilege_escalation on roles;
create trigger trg_check_role_privilege_escalation
  before insert or update on roles
  for each row execute function check_role_privilege_escalation();

-- ---------------------------------------------------------------------------
-- 12. Davet Hak Etme Trigger'ı (claim_invitations)
-- ---------------------------------------------------------------------------
create or replace function claim_invitations()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv record;
begin
  insert into profiles (id, full_name, role)
  values (
    NEW.id,
    coalesce(nullif(btrim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    'Koç'
  )
  on conflict (id) do nothing;

  for v_inv in
    select * from invitations
    where lower(btrim(email)) = lower(btrim(NEW.email))
      and status = 'bekliyor'
  loop
    insert into memberships (institution_id, user_id, role_id, is_active)
    values (v_inv.institution_id, NEW.id, v_inv.role_id, true)
    on conflict (institution_id, user_id) do update set is_active = true, role_id = v_inv.role_id;

    update invitations
    set status = 'kabul', accepted_by = NEW.id, accepted_at = now()
    where id = v_inv.id;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists on_auth_user_created_claim_invitations on auth.users;
create trigger on_auth_user_created_claim_invitations
  after insert on auth.users
  for each row execute function claim_invitations();

-- ---------------------------------------------------------------------------
-- 13. Row Level Security (RLS) Politikaları
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table institutions enable row level security;
alter table roles enable row level security;
alter table permission_catalog enable row level security;
alter table memberships enable row level security;
alter table invitations enable row level security;
alter table students enable row level security;
alter table subjects enable row level security;
alter table topics enable row level security;
alter table topic_measurements enable row level security;
alter table coach_decisions enable row level security;
alter table mock_exams enable row level security;
alter table mock_exam_sections enable row level security;
alter table error_basket_items enable row level security;
alter table weekly_tasks enable row level security;
alter table attendance_records enable row level security;
alter table university_rankings enable row level security;

-- Profiles
drop policy if exists "profiles: okuma yetkisi" on profiles;
create policy "profiles: okuma yetkisi" on profiles for select using (
  id = auth.uid()
  or (select is_system_admin())
  or exists (
    select 1 from memberships m1
    join memberships m2 on m1.institution_id = m2.institution_id
    where m1.user_id = auth.uid()
      and m2.user_id = profiles.id
      and m1.is_active = true
      and m2.is_active = true
  )
);
drop policy if exists "profiles: güncelleme yetkisi" on profiles;
create policy "profiles: güncelleme yetkisi" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Institutions
drop policy if exists "institutions: okuma yetkisi" on institutions;
create policy "institutions: okuma yetkisi" on institutions for select using (
  (select is_system_admin()) or (id in (select my_institution_ids()))
);
drop policy if exists "institutions: yönetici yazma yetkisi" on institutions;
create policy "institutions: yönetici yazma yetkisi" on institutions for all using (
  (select is_system_admin())
) with check (
  (select is_system_admin())
);

-- Roles
drop policy if exists "roles: okuma yetkisi" on roles;
create policy "roles: okuma yetkisi" on roles for select using (
  (select is_system_admin()) or (institution_id is null) or (institution_id in (select my_institution_ids()))
);
drop policy if exists "roles: yönetici ekleme yetkisi" on roles;
create policy "roles: yönetici ekleme yetkisi" on roles for insert with check (
  (select is_system_admin()) or ((institution_id is not null) and (select has_permission(institution_id, 'roles.manage')))
);
drop policy if exists "roles: yönetici güncelleme yetkisi" on roles;
create policy "roles: yönetici güncelleme yetkisi" on roles for update using (
  (select is_system_admin()) or ((institution_id is not null) and (select has_permission(institution_id, 'roles.manage')))
) with check (
  (select is_system_admin()) or ((institution_id is not null) and (select has_permission(institution_id, 'roles.manage')))
);
drop policy if exists "roles: yönetici silme yetkisi" on roles;
create policy "roles: yönetici silme yetkisi" on roles for delete using (
  (select is_system_admin()) or ((institution_id is not null) and (select has_permission(institution_id, 'roles.manage')))
);

-- Permission Catalog
drop policy if exists "permission_catalog: herkes okur" on permission_catalog;
create policy "permission_catalog: herkes okur" on permission_catalog for select using (auth.role() = 'authenticated');

-- Memberships
drop policy if exists "memberships: okuma yetkisi" on memberships;
create policy "memberships: okuma yetkisi" on memberships for select using (
  (select is_system_admin()) or (user_id = auth.uid()) or (institution_id in (select my_institution_ids()))
);
drop policy if exists "memberships: yönetim yetkisi" on memberships;
create policy "memberships: yönetim yetkisi" on memberships for all using (
  (select is_system_admin()) or (select has_permission(institution_id, 'members.manage'))
) with check (
  (select is_system_admin()) or (select has_permission(institution_id, 'members.manage'))
);

-- Invitations
drop policy if exists "invitations: okuma yetkisi" on invitations;
create policy "invitations: okuma yetkisi" on invitations for select using (
  (select is_system_admin()) or (select has_permission(institution_id, 'members.manage'))
);
drop policy if exists "invitations: yönetim yetkisi" on invitations;
create policy "invitations: yönetim yetkisi" on invitations for all using (
  (select is_system_admin()) or (select has_permission(institution_id, 'members.manage'))
) with check (
  (select is_system_admin()) or (select has_permission(institution_id, 'members.manage'))
);

-- Students
drop policy if exists "students: okuma yetkisi" on students;
create policy "students: okuma yetkisi" on students for select using (
  (select is_system_admin()) or (institution_id in (select my_institution_ids()))
);
drop policy if exists "students: ekleme yetkisi" on students;
create policy "students: ekleme yetkisi" on students for insert with check (
  (select is_system_admin()) or (select has_permission(institution_id, 'students.create'))
);
drop policy if exists "students: güncelleme yetkisi" on students;
create policy "students: güncelleme yetkisi" on students for update using (
  (select is_system_admin()) or (select has_permission(institution_id, 'students.edit'))
) with check (
  (select is_system_admin()) or (select has_permission(institution_id, 'students.edit'))
);
drop policy if exists "students: silme yetkisi" on students;
create policy "students: silme yetkisi" on students for delete using (
  (select is_system_admin()) or (select has_permission(institution_id, 'students.delete'))
);

-- Attendance Records
drop policy if exists "attendance_records: okuma yetkisi" on attendance_records;
create policy "attendance_records: okuma yetkisi" on attendance_records for select using (
  (select student_permission(student_id, 'attendance.view'))
);
drop policy if exists "attendance_records: yönetim yetkisi" on attendance_records;
create policy "attendance_records: yönetim yetkisi" on attendance_records for all using (
  (select student_permission(student_id, 'attendance.manage'))
) with check (
  (select student_permission(student_id, 'attendance.manage'))
);

-- Mock Exams
drop policy if exists "mock_exams: okuma yetkisi" on mock_exams;
create policy "mock_exams: okuma yetkisi" on mock_exams for select using (
  (select student_permission(student_id, 'exams.view'))
);
drop policy if exists "mock_exams: yönetim yetkisi" on mock_exams;
create policy "mock_exams: yönetim yetkisi" on mock_exams for all using (
  (select student_permission(student_id, 'exams.manage'))
) with check (
  (select student_permission(student_id, 'exams.manage'))
);

-- Mock Exam Sections
drop policy if exists "mock_exam_sections: okuma yetkisi" on mock_exam_sections;
create policy "mock_exam_sections: okuma yetkisi" on mock_exam_sections for select using (
  (select student_permission(exam_student_id(mock_exam_id), 'exams.view'))
);
drop policy if exists "mock_exam_sections: yönetim yetkisi" on mock_exam_sections;
create policy "mock_exam_sections: yönetim yetkisi" on mock_exam_sections for all using (
  (select student_permission(exam_student_id(mock_exam_id), 'exams.manage'))
) with check (
  (select student_permission(exam_student_id(mock_exam_id), 'exams.manage'))
);

-- Error Basket Items
drop policy if exists "error_basket_items: okuma yetkisi" on error_basket_items;
create policy "error_basket_items: okuma yetkisi" on error_basket_items for select using (
  (select student_permission(exam_student_id(mock_exam_id), 'exams.view'))
);
drop policy if exists "error_basket_items: yönetim yetkisi" on error_basket_items;
create policy "error_basket_items: yönetim yetkisi" on error_basket_items for all using (
  (select student_permission(exam_student_id(mock_exam_id), 'exams.manage'))
) with check (
  (select student_permission(exam_student_id(mock_exam_id), 'exams.manage'))
);

-- Topic Measurements
drop policy if exists "topic_measurements: okuma yetkisi" on topic_measurements;
create policy "topic_measurements: okuma yetkisi" on topic_measurements for select using (
  (select can_access_coaching(student_id, 'topics.view'))
);
drop policy if exists "topic_measurements: yönetim yetkisi" on topic_measurements;
create policy "topic_measurements: yönetim yetkisi" on topic_measurements for all using (
  (select can_access_coaching(student_id, 'topics.manage'))
) with check (
  (select can_access_coaching(student_id, 'topics.manage'))
);

-- Coach Decisions
drop policy if exists "coach_decisions: okuma yetkisi" on coach_decisions;
create policy "coach_decisions: okuma yetkisi" on coach_decisions for select using (
  (select can_access_coaching(student_id, 'topics.view'))
);
drop policy if exists "coach_decisions: yönetim yetkisi" on coach_decisions;
create policy "coach_decisions: yönetim yetkisi" on coach_decisions for all using (
  (select can_access_coaching(student_id, 'topics.manage'))
) with check (
  (select can_access_coaching(student_id, 'topics.manage'))
);

-- Weekly Tasks
drop policy if exists "weekly_tasks: okuma yetkisi" on weekly_tasks;
create policy "weekly_tasks: okuma yetkisi" on weekly_tasks for select using (
  (select can_access_coaching(student_id, 'program.view'))
);
drop policy if exists "weekly_tasks: yönetim yetkisi" on weekly_tasks;
create policy "weekly_tasks: yönetim yetkisi" on weekly_tasks for all using (
  (select can_access_coaching(student_id, 'program.manage'))
) with check (
  (select can_access_coaching(student_id, 'program.manage'))
);

-- Subjects & Topics
drop policy if exists "subjects: herkes okur" on subjects;
create policy "subjects: herkes okur" on subjects for select using (true);
drop policy if exists "topics: herkes okur" on topics;
create policy "topics: herkes okur" on topics for select using (true);

drop policy if exists "subjects: yetkili koç ekler" on subjects;
create policy "subjects: yetkili koç ekler" on subjects for insert with check (
  (select user_has_any_permission('curriculum.manage'))
);
drop policy if exists "subjects: yetkili koç günceller" on subjects;
create policy "subjects: yetkili koç günceller" on subjects for update using (
  (select user_has_any_permission('curriculum.manage'))
) with check (
  (select user_has_any_permission('curriculum.manage'))
);

drop policy if exists "topics: yetkili koç ekler" on topics;
create policy "topics: yetkili koç ekler" on topics for insert with check (
  (select user_has_any_permission('curriculum.manage'))
);
drop policy if exists "topics: yetkili koç günceller" on topics;
create policy "topics: yetkili koç günceller" on topics for update using (
  (select user_has_any_permission('curriculum.manage'))
) with check (
  (select user_has_any_permission('curriculum.manage'))
);

-- University Rankings
drop policy if exists "university_rankings: herkes okur" on university_rankings;
create policy "university_rankings: herkes okur" on university_rankings for select using (true);

-- Storage - Profil Fotoğrafları
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', true)
on conflict (id) do nothing;

drop policy if exists "Fotoğraflar herkese açık okunabilir" on storage.objects;
create policy "Fotoğraflar herkese açık okunabilir" on storage.objects
  for select using (bucket_id = 'student-photos');

drop policy if exists "Koçlar fotoğraf yükleyebilir" on storage.objects;
create policy "Koçlar fotoğraf yükleyebilir" on storage.objects
  for insert with check (
    bucket_id = 'student-photos'
    and (select user_has_any_permission('students.edit'))
  );

drop policy if exists "Koçlar fotoğraf güncelleyebilir" on storage.objects;
create policy "Koçlar fotoğraf güncelleyebilir" on storage.objects
  for update using (
    bucket_id = 'student-photos'
    and (select user_has_any_permission('students.edit'))
  ) with check (
    bucket_id = 'student-photos'
    and (select user_has_any_permission('students.edit'))
  );

drop policy if exists "Koçlar fotoğraf silebilir" on storage.objects;
create policy "Koçlar fotoğraf silebilir" on storage.objects
  for delete using (
    bucket_id = 'student-photos'
    and (select user_has_any_permission('students.edit'))
  );

-- ---------------------------------------------------------------------------
-- 14. Mobil Portal SECURITY DEFINER RPC Fonksiyonları
-- ---------------------------------------------------------------------------
create or replace function portal_resolve_code(p_code text)
returns table (student_id uuid, portal_role text)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select s.id,
         case when s.student_access_code = upper(btrim(p_code)) then 'ogrenci' else 'veli' end
  from students s
  where coalesce(btrim(p_code), '') <> ''
    and s.is_active
    and (s.student_access_code = upper(btrim(p_code))
         or s.parent_access_code = upper(btrim(p_code)))
  limit 1;
$$;
revoke all on function portal_resolve_code(text) from public, anon, authenticated;

create or replace function portal_login(p_code text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_student_id uuid;
  v_role text;
  v_result json;
begin
  select r.student_id, r.portal_role into v_student_id, v_role
  from portal_resolve_code(p_code) r;

  if v_student_id is null then
    return json_build_object('ok', false, 'error', 'Geçersiz erişim kodu.');
  end if;

  select json_build_object(
    'ok', true,
    'role', v_role,
    'student', json_build_object(
      'id', s.id,
      'full_name', s.full_name,
      'grade', s.grade,
      'track', s.track,
      'target_program', s.target_program,
      'target_ranking', s.target_ranking,
      'photo_url', s.photo_url
    )
  ) into v_result
  from students s
  where s.id = v_student_id;

  return v_result;
end;
$$;
grant execute on function portal_login(text) to anon, authenticated;

create or replace function portal_dashboard(p_code text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_student_id uuid;
  v_role text;
  v_week date;
  v_result json;
begin
  select r.student_id, r.portal_role into v_student_id, v_role
  from portal_resolve_code(p_code) r;

  if v_student_id is null then
    return json_build_object('ok', false, 'error', 'Geçersiz erişim kodu.');
  end if;

  select coalesce(
    (select wt.week_start from weekly_tasks wt
      where wt.student_id = v_student_id
        and wt.week_start = date_trunc('week', current_date)::date
      limit 1),
    (select max(wt.week_start) from weekly_tasks wt where wt.student_id = v_student_id)
  ) into v_week;

  select json_build_object(
    'ok', true,
    'role', v_role,
    'week_start', v_week,
    'is_current_week', (v_week = date_trunc('week', current_date)::date),
    'student', (
      select json_build_object(
        'id', s.id, 'full_name', s.full_name, 'grade', s.grade, 'track', s.track,
        'target_program', s.target_program, 'target_ranking', s.target_ranking,
        'photo_url', s.photo_url
      ) from students s where s.id = v_student_id
    ),
    'tasks', coalesce((
      select json_agg(t order by t.day_index, t.created_at) from (
        select wt.id, wt.day_index, wt.week_start, wt.question_count,
               wt.is_exam, wt.completed, wt.created_at,
               coalesce(wt.custom_label, tp.name, 'Görev') as label,
               sb.name as subject_name
        from weekly_tasks wt
        left join topics tp on tp.id = wt.topic_id
        left join subjects sb on sb.id = tp.subject_id
        where wt.student_id = v_student_id and wt.week_start = v_week
      ) t
    ), '[]'::json),
    'exams', coalesce((
      select json_agg(e order by e.exam_date desc, e.created_at desc) from (
        select me.id, me.name, me.publisher, me.exam_type, me.exam_date, me.created_at,
          coalesce((select sum(ms.net) from mock_exam_sections ms where ms.mock_exam_id = me.id), 0) as total_net,
          coalesce((
            select json_agg(json_build_object(
              'section_name', ms.section_name, 'max_questions', ms.max_questions,
              'correct_count', ms.correct_count, 'wrong_count', ms.wrong_count,
              'blank_count', ms.blank_count, 'net', ms.net
            ) order by ms.section_name)
            from mock_exam_sections ms where ms.mock_exam_id = me.id
          ), '[]'::json) as sections
        from mock_exams me
        where me.student_id = v_student_id
        order by me.exam_date desc, me.created_at desc
        limit 20
      ) e
    ), '[]'::json),
    'attendance', coalesce((
      select json_agg(a order by a.absence_date desc) from (
        select ar.id, ar.absence_date, ar.session_type, ar.status,
               ar.excuse_type, ar.excuse_note
        from attendance_records ar
        where ar.student_id = v_student_id
        order by ar.absence_date desc
        limit 50
      ) a
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;
grant execute on function portal_dashboard(text) to anon, authenticated;

create or replace function portal_set_task_completed(p_code text, p_task_id uuid, p_completed boolean)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student_id uuid;
  v_role text;
  v_rows int;
begin
  select r.student_id, r.portal_role into v_student_id, v_role
  from portal_resolve_code(p_code) r;

  if v_student_id is null then
    return json_build_object('ok', false, 'error', 'Geçersiz erişim kodu.');
  end if;
  if v_role <> 'ogrenci' then
    return json_build_object('ok', false, 'error', 'Veli görev durumunu değiştiremez.');
  end if;

  update weekly_tasks set completed = coalesce(p_completed, false)
  where id = p_task_id and student_id = v_student_id;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    return json_build_object('ok', false, 'error', 'Görev bulunamadı.');
  end if;
  return json_build_object('ok', true);
end;
$$;
grant execute on function portal_set_task_completed(text, uuid, boolean) to anon, authenticated;

create or replace function portal_add_exam(
  p_code text,
  p_name text,
  p_publisher text,
  p_exam_type text,
  p_exam_date date,
  p_sections jsonb
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student_id uuid;
  v_role text;
  v_exam_id uuid;
  v_bad int;
begin
  select r.student_id, r.portal_role into v_student_id, v_role
  from portal_resolve_code(p_code) r;

  if v_student_id is null then
    return json_build_object('ok', false, 'error', 'Geçersiz erişim kodu.');
  end if;
  if v_role <> 'ogrenci' then
    return json_build_object('ok', false, 'error', 'Veli deneme sonucu giremez.');
  end if;
  if coalesce(btrim(p_name), '') = '' then
    return json_build_object('ok', false, 'error', 'Sınav adı gerekli.');
  end if;
  if p_exam_type not in ('TYT', 'AYT') then
    return json_build_object('ok', false, 'error', 'Sınav türü TYT veya AYT olmalı.');
  end if;
  if p_exam_date is null or p_exam_date > current_date then
    return json_build_object('ok', false, 'error', 'Sınav tarihi bugünden ileri olamaz.');
  end if;

  select count(*) into v_bad
  from jsonb_to_recordset(coalesce(p_sections, '[]'::jsonb))
    as x(section_name text, max_questions int, correct_count int, wrong_count int, blank_count int)
  where coalesce(x.correct_count,0) < 0 or coalesce(x.wrong_count,0) < 0 or coalesce(x.blank_count,0) < 0
     or coalesce(x.correct_count,0) + coalesce(x.wrong_count,0) + coalesce(x.blank_count,0)
        > coalesce(x.max_questions, 0);
  if v_bad > 0 then
    return json_build_object('ok', false, 'error', 'Doğru + yanlış + boş, soru sayısını aşamaz.');
  end if;

  insert into mock_exams (student_id, name, publisher, exam_type, exam_date)
  values (v_student_id, btrim(p_name), nullif(btrim(coalesce(p_publisher, '')), ''), p_exam_type, p_exam_date)
  returning id into v_exam_id;

  insert into mock_exam_sections (mock_exam_id, section_name, max_questions, correct_count, wrong_count, blank_count)
  select v_exam_id, x.section_name, x.max_questions,
         coalesce(x.correct_count,0), coalesce(x.wrong_count,0), coalesce(x.blank_count,0)
  from jsonb_to_recordset(coalesce(p_sections, '[]'::jsonb))
    as x(section_name text, max_questions int, correct_count int, wrong_count int, blank_count int);

  return json_build_object('ok', true, 'exam_id', v_exam_id);
end;
$$;
grant execute on function portal_add_exam(text, text, text, text, date, jsonb) to anon, authenticated;
