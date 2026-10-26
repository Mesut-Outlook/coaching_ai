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
  -- kurumlarda (ör. Konsept) koçluk verilen öğrenciler birlikte görünür.
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

-- user_id yalnız auth.users'a bakıyordu; profiles'a bakan bir FK olmadığı için
-- PostgREST `memberships?select=*,profiles(*)` gömmesini çözemiyor ve sorgu
-- PGRST200 ile 400 dönüyordu (Kullanıcılar ekranı komple boş kalıyordu).
-- profiles.id zaten auth.users(id)'ye bağlı, yani bu kısıt mevcut veriyle uyumlu.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'memberships_user_id_profiles_fkey'
  ) then
    alter table memberships
      add constraint memberships_user_id_profiles_fkey
      foreign key (user_id) references profiles(id) on delete cascade;
  end if;
end $$;

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
-- Davet bağlantısı eskiden yalnız ?email= taşıyordu: kayıt formu davetle
-- ilişkilendirilemiyor, davetsiz kişi de /kayit'tan hesap açabiliyordu.
alter table invitations add column if not exists token uuid not null default gen_random_uuid();
create unique index if not exists invitations_pending_idx on invitations(institution_id, lower(email)) where status = 'bekliyor';
create unique index if not exists invitations_token_idx on invitations(token);

-- ---------------------------------------------------------------------------
-- 5. Öğrenciler
-- ---------------------------------------------------------------------------
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid references institutions(id) on delete restrict,
  coaching_coach_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  grade text not null check (grade in ('7. Sınıf', '8. Sınıf', '9. Sınıf', '10. Sınıf', '11. Sınıf', '12. Sınıf', 'Mezun')),
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

-- Sınıf aralığı 7 → 12 (+ Mezun). ⚠️ Yukarıdaki "create table if not exists"
-- mevcut bir tabloda atlandığı için CHECK kısıtı orada güncellenmez; kısıtı burada
-- düşürüp yeniden kuruyoruz. Yeniden çalıştırılabilir olsun diye önce drop.
alter table students drop constraint if exists students_grade_check;
alter table students
  add constraint students_grade_check
  check (grade in ('7. Sınıf', '8. Sınıf', '9. Sınıf', '10. Sınıf', '11. Sınıf', '12. Sınıf', 'Mezun'));

-- Müfredat YKS/LGS ayrımı: LGS öğrencisinde Alan (SAY/EA/SÖZ) kavramı yok, bu yüzden
-- track nullable olmalı. CHECK kısıtı olduğu gibi kalabilir — Postgres'te NULL için
-- CHECK zaten UNKNOWN döner (satırı reddetmez), sadece NOT NULL'ı düşürmek yeterli.
alter table students alter column track drop not null;

create index if not exists students_institution_id_idx on students(institution_id);
create index if not exists students_coaching_coach_idx on students(coaching_coach_id);
create unique index if not exists students_student_access_code_idx on students(student_access_code) where student_access_code is not null;
create unique index if not exists students_parent_access_code_idx on students(parent_access_code) where parent_access_code is not null;

-- ---------------------------------------------------------------------------
-- 6. Backfill (Varsayılan Kurumlar & Mevcut Öğrenciler Entegrasyonu)
-- ---------------------------------------------------------------------------
insert into institutions (name, slug) values
  ('Netlik', 'eda-kocluk'),
  ('Konsept Akademi', 'concept')
on conflict (slug) do nothing;

-- Tek seferlik ad duzeltmesi: yalnizca hala ILK seed adiysa degistir. Boylece
-- arayuzden sonradan verilen isim tekrar calistirmada EZILMEZ.
update institutions set name = 'Netlik'
where slug = 'eda-kocluk' and name = 'Eda Cangert Özel Koçluk';

-- Netlik = bireysel koçluk pratiği. Konsept ise normal kurum (öğrenciler kuruma bağlı).
update institutions set is_coaching_practice = true  where slug = 'eda-kocluk' and not is_coaching_practice;
update institutions set is_coaching_practice = false where slug = 'concept'     and is_coaching_practice;

update students set institution_id = (select id from institutions where slug = 'eda-kocluk') where institution_id is null;
-- Bireysel koçluk işareti — YALNIZCA İLK GEÇİŞTE.
-- ⚠️ Koşulsuz "where coaching_coach_id is null" YAZMA: Eda bir Konsept öğrencisinin
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
-- Eda hem Netlik'i (kendi özel koçluğu) hem Konsept Akademi'yi yönetir ve ikisine
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
  is_active boolean not null default true,
  curriculum text not null default 'YKS' check (curriculum in ('YKS', 'LGS')),
  grades text[] not null default '{}',
  katsayi numeric
);

create table if not exists topics (
  id serial primary key,
  subject_id int not null references subjects(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  grades text[] not null default '{}',
  unique (subject_id, name)
);
create index if not exists topics_subject_id_idx on topics(subject_id);

alter table subjects add column if not exists is_active boolean not null default true;
alter table topics add column if not exists is_active boolean not null default true;

-- Konu bazında sınıf etiketi (P6, 2026-08-21): bir dersin konuları birden çok sınıfa
-- ait olabilir (örn. LGS "Türkçe" hem 7 hem 8. sınıfta var ama konular farklı).
-- BOŞ = dersin geçerli olduğu tüm sınıflar (mevcut YKS ve 8. sınıf LGS konuları için
-- geçerli varsayılan — geriye dönük damgalama scripts/seedLgsCurriculum7.ts'in işi).
alter table topics add column if not exists grades text[] not null default '{}';

-- Müfredat YKS/LGS ayrımı: mevcut tabloda inline tanım işlemez ("create table if not
-- exists" atlanır), bu yüzden yeni kolonlar ayrıca eklenir. Mevcut 14 ders default
-- 'YKS' ile zaten doğru değere düşer, ekstra update gerekmez.
alter table subjects add column if not exists curriculum text not null default 'YKS' check (curriculum in ('YKS', 'LGS'));
alter table subjects add column if not exists grades text[] not null default '{}';
alter table subjects add column if not exists katsayi numeric;

-- `unique (name)` → `unique (curriculum, name)`: aynı ders adı farklı müfredatlarda
-- (örn. "Matematik") tekrar edebilir. Yeniden çalıştırılabilir olsun diye önce eski
-- kısıtı düşür, sonra yenisini kur — bu satırlar yukarıdaki alter'ların ALTINDA olmalı.
alter table subjects drop constraint if exists subjects_name_key;
alter table subjects drop constraint if exists subjects_curriculum_name_key;
alter table subjects add constraint subjects_curriculum_name_key unique (curriculum, name);

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
  exam_type text not null check (exam_type in ('TYT', 'AYT', 'LGS')) default 'TYT',
  exam_date date not null,
  score numeric,
  percentile numeric,
  ranks jsonb,
  coach_note text,
  created_at timestamptz not null default now()
);
create index if not exists mock_exams_student_id_idx on mock_exams(student_id);

-- LGS deneme türü: yukarıdaki inline check mevcut bir tabloda güncellenmez
-- ("create table if not exists" atlanır) — kısıtı düşürüp yeniden kuruyoruz.
alter table mock_exams drop constraint if exists mock_exams_exam_type_check;
alter table mock_exams add constraint mock_exams_exam_type_check check (exam_type in ('TYT', 'AYT', 'LGS'));

-- Deneme Karnesi ek kolonları (puan, yüzdelik, sıralar ve koç notu)
alter table mock_exams add column if not exists score numeric;
alter table mock_exams add column if not exists percentile numeric;
alter table mock_exams add column if not exists ranks jsonb;
alter table mock_exams add column if not exists coach_note text;

create table if not exists mock_exam_sections (
  id uuid primary key default gen_random_uuid(),
  mock_exam_id uuid not null references mock_exams(id) on delete cascade,
  section_name text not null,
  max_questions int not null,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  blank_count int not null default 0,
  wrong_penalty numeric not null default 4 check (wrong_penalty > 0),
  net numeric generated always as (correct_count - wrong_count / wrong_penalty) stored
);
create index if not exists mock_exam_sections_exam_id_idx on mock_exam_sections(mock_exam_id);
create unique index if not exists mock_exam_sections_exam_section_uidx on mock_exam_sections(mock_exam_id, section_name);

-- LGS'te yanlışın doğruyu götürme oranı YKS'den farklı (3 yanlış = 1 doğru, YKS'de 4).
-- Net bir generated column olduğu için ALTER edilemez; mevcut tabloda yukarıdaki
-- inline tanım atlanır, bu yüzden kolonu önce ekleyip sonra `net`'i yeniden kuruyoruz.
-- ⚠️ İdempotentlik: yalnız generation ifadesi henüz `wrong_penalty` içermiyorsa
-- drop+add yapılır — aksi halde şema her koşuda `net` kolonunu gereksiz yere düşürüp
-- yeniden oluşturur (veri kaybı yok, `net` türetilmiş, ama gereksiz iş).
alter table mock_exam_sections add column if not exists wrong_penalty numeric not null default 4 check (wrong_penalty > 0);

do $$
declare
  v_expr text;
begin
  select pg_get_expr(d.adbin, d.adrelid) into v_expr
  from pg_attrdef d
  join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
  where d.adrelid = 'mock_exam_sections'::regclass and a.attname = 'net';

  if v_expr is null or v_expr not like '%wrong_penalty%' then
    alter table mock_exam_sections drop column if exists net;
    alter table mock_exam_sections add column net numeric generated always as (correct_count - wrong_count / wrong_penalty) stored;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Deneme Karne & Analiz Kataloğu ve Sonuç Tabloları
-- ---------------------------------------------------------------------------

-- Sınav yapısı kataloğu: karnedeki alt dersler ve soru sayıları (TYT/AYT/LGS).
create table if not exists exam_subjects (
  id serial primary key,
  exam_type text not null check (exam_type in ('TYT', 'AYT', 'LGS')),
  section_name text not null,
  subject_id int not null references subjects(id),
  label text not null,
  question_count int not null check (question_count > 0),
  choice_group text,
  sort_order int not null default 0,
  unique (exam_type, section_name, label)
);
create index if not exists exam_subjects_type_sec_idx on exam_subjects(exam_type, section_name);
create index if not exists exam_subjects_subject_id_idx on exam_subjects(subject_id);

-- Karne konu kataloğu: karnedeki konu satırları.
create table if not exists exam_topics (
  id serial primary key,
  exam_subject_id int not null references exam_subjects(id) on delete cascade,
  name text not null,
  grades text[] not null default '{}',
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (exam_subject_id, name)
);
create index if not exists exam_topics_subject_sort_idx on exam_topics(exam_subject_id, sort_order);

-- Deneme alt ders sonuçları (karnedeki "Fizik 7 6 1 0 5,75 %82" satırı).
create table if not exists mock_exam_subject_results (
  id uuid primary key default gen_random_uuid(),
  mock_exam_id uuid not null references mock_exams(id) on delete cascade,
  exam_subject_id int not null references exam_subjects(id),
  question_count int not null check (question_count > 0),
  correct_count int not null default 0 check (correct_count >= 0),
  wrong_count int not null default 0 check (wrong_count >= 0),
  blank_count int generated always as (question_count - correct_count - wrong_count) stored,
  wrong_penalty numeric not null default 4 check (wrong_penalty > 0),
  net numeric generated always as (correct_count - wrong_count / wrong_penalty) stored,
  check (correct_count + wrong_count <= question_count),
  unique (mock_exam_id, exam_subject_id)
);
create index if not exists mock_exam_subj_res_exam_idx on mock_exam_subject_results(mock_exam_id);
create index if not exists mock_exam_subj_res_subj_idx on mock_exam_subject_results(exam_subject_id);

-- Deneme konu sonuçları (karnedeki "SAYILAR 5 4 1 80" satırı).
create table if not exists mock_exam_topic_results (
  id uuid primary key default gen_random_uuid(),
  mock_exam_id uuid not null references mock_exams(id) on delete cascade,
  exam_topic_id int not null references exam_topics(id),
  question_count int not null check (question_count > 0),
  correct_count int not null default 0 check (correct_count >= 0),
  wrong_count int not null default 0 check (wrong_count >= 0),
  blank_count int generated always as (question_count - correct_count - wrong_count) stored,
  check (correct_count + wrong_count <= question_count),
  unique (mock_exam_id, exam_topic_id)
);
create index if not exists mock_exam_topic_res_exam_idx on mock_exam_topic_results(mock_exam_id);
create index if not exists mock_exam_topic_res_topic_idx on mock_exam_topic_results(exam_topic_id);

-- Karne Konuları ↔ Müfredat Konuları Eşleşmesi (exam_topic_links)
create table if not exists exam_topic_links (
  exam_topic_id int not null references exam_topics(id) on delete cascade,
  topic_id int not null references topics(id) on delete cascade,
  is_primary boolean not null default false,
  primary key (exam_topic_id, topic_id)
);
create unique index if not exists exam_topic_links_one_primary
  on exam_topic_links(exam_topic_id) where is_primary;
create index if not exists idx_exam_topic_links_topic
  on exam_topic_links(topic_id);

-- Konu Yeterlilik Haritası Deneme Ölçümleri View'ı (topic_exam_measurements)
-- Deneme sonuçlarını (mock_exam_topic_results) birincil müfredat konusuna (is_primary = true)
-- eşleyerek konu yeterlilik ölçümü formatında sunar.
-- security_invoker = true ile çağıran kullanıcının mock_exams/mock_exam_topic_results RLS'i geçerli olur.
create or replace view topic_exam_measurements
with (security_invoker = true)
as
select
  me.student_id,
  etl.topic_id,
  round((tr.correct_count::numeric / nullif(tr.question_count, 0)) * 100, 1) as accuracy_pct,
  tr.correct_count,
  tr.wrong_count,
  tr.blank_count,
  tr.question_count,
  me.exam_date as measured_at,
  'Deneme · ' || me.name as source_label,
  et.name as exam_topic_name,
  me.id as mock_exam_id
from mock_exam_topic_results tr
join exam_topic_links etl on etl.exam_topic_id = tr.exam_topic_id and etl.is_primary = true
join exam_topics et on et.id = tr.exam_topic_id
join mock_exams me on me.id = tr.mock_exam_id;

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

-- Kayıt sayfası daveti doğrulayabilsin diye: anon'un invitations tablosunda okuma
-- yetkisi yok (ve olmamalı), o yüzden token karşılığını definer fonksiyon veriyor.
-- Yalnız bekleyen davetin e-postasını ve bağlamını döndürür; token bilinmeden hiçbir şey sızmaz.
create or replace function invitation_by_token(p_token uuid)
returns json
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(
    (select json_build_object(
       'ok', true,
       'email', i.email,
       'institution_name', ins.name,
       'role_name', r.name
     )
     from invitations i
     join institutions ins on ins.id = i.institution_id
     join roles r on r.id = i.role_id
     where i.token = p_token and i.status = 'bekliyor'),
    json_build_object('ok', false)
  );
$$;
revoke all on function invitation_by_token(uuid) from public, anon, authenticated;
grant execute on function invitation_by_token(uuid) to anon, authenticated;

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

-- ⚠️ RBAC ÖNCESİ POLİTİKALARIN TEMİZLİĞİ — SİLME.
-- RBAC turunda politikalar yeniden adlandırıldı; yeni bloklar yalnız KENDİ adlarını
-- düşürdüğü için eski adlar canlı veritabanında kaldı. RLS politikaları OR'lanır:
-- tek bir izin veren politika yeterlidir, yani eski satırlar yeni kısıtlamaların
-- tamamını sessizce baypas ediyordu. (2026-08-16 izolasyon testinde yakalandı:
-- 'personel' rolü curriculum.manage izni olmadan subjects'e INSERT yapabiliyordu.)
-- Yeni bir politikayı yeniden adlandırırsan eski adı buraya eklemek ZORUNLUDUR.
drop policy if exists "profiles: kendi profilini okur/günceller" on profiles;
drop policy if exists "students: koç kendi öğrencilerini yönetir" on students;
drop policy if exists "subjects: giriş yapan koç ekler" on subjects;
drop policy if exists "subjects: giriş yapan koç günceller" on subjects;
drop policy if exists "topics: giriş yapan koç ekler" on topics;
drop policy if exists "topics: giriş yapan koç günceller" on topics;
drop policy if exists "mock_exams: öğrenci sahibi koç yönetir" on mock_exams;
drop policy if exists "mock_exam_sections: öğrenci sahibi koç yönetir" on mock_exam_sections;
drop policy if exists "error_basket_items: öğrenci sahibi koç yönetir" on error_basket_items;
drop policy if exists "topic_measurements: öğrenci sahibi koç yönetir" on topic_measurements;
drop policy if exists "coach_decisions: öğrenci sahibi koç yönetir" on coach_decisions;
drop policy if exists "weekly_tasks: öğrenci sahibi koç yönetir" on weekly_tasks;
drop policy if exists "attendance_records: öğrenci sahibi koç yönetir" on attendance_records;

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
alter table exam_subjects enable row level security;
alter table exam_topics enable row level security;
alter table mock_exam_subject_results enable row level security;
alter table mock_exam_topic_results enable row level security;
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

-- Mock Exam Subject Results
drop policy if exists "mock_exam_subject_results: okuma yetkisi" on mock_exam_subject_results;
create policy "mock_exam_subject_results: okuma yetkisi" on mock_exam_subject_results for select using (
  (select student_permission(exam_student_id(mock_exam_id), 'exams.view'))
);
drop policy if exists "mock_exam_subject_results: yönetim yetkisi" on mock_exam_subject_results;
create policy "mock_exam_subject_results: yönetim yetkisi" on mock_exam_subject_results for all using (
  (select student_permission(exam_student_id(mock_exam_id), 'exams.manage'))
) with check (
  (select student_permission(exam_student_id(mock_exam_id), 'exams.manage'))
);

-- Mock Exam Topic Results
drop policy if exists "mock_exam_topic_results: okuma yetkisi" on mock_exam_topic_results;
create policy "mock_exam_topic_results: okuma yetkisi" on mock_exam_topic_results for select using (
  (select student_permission(exam_student_id(mock_exam_id), 'exams.view'))
);
drop policy if exists "mock_exam_topic_results: yönetim yetkisi" on mock_exam_topic_results;
create policy "mock_exam_topic_results: yönetim yetkisi" on mock_exam_topic_results for all using (
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

-- Exam Subjects & Topics Kataloğu
drop policy if exists "exam_subjects: herkes okur" on exam_subjects;
create policy "exam_subjects: herkes okur" on exam_subjects for select using (
  auth.role() = 'authenticated'
);
drop policy if exists "exam_subjects: yetkili koç ekler" on exam_subjects;
create policy "exam_subjects: yetkili koç ekler" on exam_subjects for insert with check (
  (select user_has_any_permission('curriculum.manage'))
);
drop policy if exists "exam_subjects: yetkili koç günceller" on exam_subjects;
create policy "exam_subjects: yetkili koç günceller" on exam_subjects for update using (
  (select user_has_any_permission('curriculum.manage'))
) with check (
  (select user_has_any_permission('curriculum.manage'))
);
drop policy if exists "exam_subjects: yetkili koç siler" on exam_subjects;
create policy "exam_subjects: yetkili koç siler" on exam_subjects for delete using (
  (select user_has_any_permission('curriculum.manage'))
);

drop policy if exists "exam_topics: herkes okur" on exam_topics;
create policy "exam_topics: herkes okur" on exam_topics for select using (
  auth.role() = 'authenticated'
);
drop policy if exists "exam_topics: yetkili koç ekler" on exam_topics;
create policy "exam_topics: yetkili koç ekler" on exam_topics for insert with check (
  (select user_has_any_permission('curriculum.manage')) or (select user_has_any_permission('exams.manage'))
);
drop policy if exists "exam_topics: yetkili koç günceller" on exam_topics;
create policy "exam_topics: yetkili koç günceller" on exam_topics for update using (
  (select user_has_any_permission('curriculum.manage'))
) with check (
  (select user_has_any_permission('curriculum.manage'))
);
drop policy if exists "exam_topics: yetkili koç siler" on exam_topics;
create policy "exam_topics: yetkili koç siler" on exam_topics for delete using (
  (select user_has_any_permission('curriculum.manage'))
);

alter table exam_topic_links enable row level security;

-- 2026-10-26: canlıda bu politika etkisizdi (koç 0 satır görüyordu, servis anahtarı 406).
-- Sonuç: topic_exam_measurements (security_invoker) koça boş dönüyor, Konu Yeterlilik Haritası
-- deneme ölçümlerini hiç göstermiyordu. exam_calendar'daki gibi rol hedefli yazıldı.
drop policy if exists "exam_topic_links: herkes okur" on exam_topic_links;
create policy "exam_topic_links: herkes okur" on exam_topic_links
  for select to authenticated using (true);

drop policy if exists "exam_topic_links: yetkili koç ekler" on exam_topic_links;
create policy "exam_topic_links: yetkili koç ekler" on exam_topic_links for insert with check (
  (select user_has_any_permission('curriculum.manage')) or (select user_has_any_permission('exams.manage'))
);

drop policy if exists "exam_topic_links: yetkili koç günceller" on exam_topic_links;
create policy "exam_topic_links: yetkili koç günceller" on exam_topic_links for update using (
  (select user_has_any_permission('curriculum.manage'))
) with check (
  (select user_has_any_permission('curriculum.manage'))
);

drop policy if exists "exam_topic_links: yetkili koç siler" on exam_topic_links;
create policy "exam_topic_links: yetkili koç siler" on exam_topic_links for delete using (
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
as $fn$
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
    'my_week', (
      select json_build_object(
        'total_tasks', coalesce((select count(*) from weekly_tasks wt where wt.student_id = v_student_id and wt.week_start = v_week), 0),
        'completed_tasks', coalesce((select count(*) from weekly_tasks wt where wt.student_id = v_student_id and wt.week_start = v_week and wt.completed = true), 0),
        'target_net', case
          when s.grade = '8. Sınıf' then s.target_net_lgs
          else coalesce(s.target_net_tyt, s.target_net_ayt)
        end,
        'latest_net', (
          select sum(ms.net)
          from mock_exams me
          join mock_exam_sections ms on ms.mock_exam_id = me.id
          where me.student_id = v_student_id
            and me.id = (
              select me2.id from mock_exams me2
              where me2.student_id = v_student_id
              order by me2.exam_date desc, me2.created_at desc
              limit 1
            )
        ),
        'days_to_exam', (
          select (ec.exam_date - current_date)
          from exam_calendar ec
          where ec.exam = case when s.grade = '8. Sınıf' then 'LGS' else 'YKS' end
          limit 1
        ),
        'coach_latest_note', (
          select cd.note
          from coach_decisions cd
          where cd.student_id = v_student_id
            and coalesce(btrim(cd.note), '') <> ''
          order by cd.decided_at desc
          limit 1
        ),
        'focus_topics', coalesce((
          select json_agg(distinct coalesce(wt.custom_label, tp.name, 'Görev'))
          from weekly_tasks wt
          left join topics tp on tp.id = wt.topic_id
          where wt.student_id = v_student_id and wt.week_start = v_week
        ), '[]'::json),
        'improved_topics', coalesce((
          select json_agg(distinct json_build_object('topic_name', tp.name, 'subject_name', sb.name))
          from weekly_tasks wt
          join topics tp on tp.id = wt.topic_id
          left join subjects sb on sb.id = tp.subject_id
          where wt.student_id = v_student_id
            and wt.week_start = v_week
            and wt.completed = true
            and wt.correct_count is not null
            and wt.question_count > 0
            and (wt.correct_count::numeric / wt.question_count) >= 0.7
        ), '[]'::json)
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
$fn$;
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

  -- Denetim aktörü: bu fonksiyon security definer + anon ile çalışıyor, yani
  -- auth.uid() null. İşaretlemeyi yapanın öğrenci olduğunu buradan bildiriyoruz.
  perform set_config('app.actor', 'ogrenci:' || v_student_id, true);

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
  -- Yanlış cezası istemciden alınmaz (güvenilmez girdi olur) — sınav türünden
  -- sunucuda türetilir: LGS'te 3 yanlış, YKS'de (TYT/AYT) 4 yanlış 1 doğruyu götürür.
  v_penalty numeric;
begin
  select r.student_id, r.portal_role into v_student_id, v_role
  from portal_resolve_code(p_code) r;

  if v_student_id is null then
    return json_build_object('ok', false, 'error', 'Geçersiz erişim kodu.');
  end if;
  if v_role <> 'ogrenci' then
    return json_build_object('ok', false, 'error', 'Veli deneme sonucu giremez.');
  end if;

  -- Bkz. portal_set_task_completed: aktör damgası olmadan öğrencinin girdiği
  -- deneme logda 'sistem' görünür.
  perform set_config('app.actor', 'ogrenci:' || v_student_id, true);
  if coalesce(btrim(p_name), '') = '' then
    return json_build_object('ok', false, 'error', 'Sınav adı gerekli.');
  end if;
  if p_exam_type not in ('TYT', 'AYT', 'LGS') then
    return json_build_object('ok', false, 'error', 'Sınav türü TYT, AYT veya LGS olmalı.');
  end if;
  if p_exam_date is null or p_exam_date > current_date then
    return json_build_object('ok', false, 'error', 'Sınav tarihi bugünden ileri olamaz.');
  end if;
  v_penalty := case when p_exam_type = 'LGS' then 3 else 4 end;

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

  insert into mock_exam_sections (mock_exam_id, section_name, max_questions, correct_count, wrong_count, blank_count, wrong_penalty)
  select v_exam_id, x.section_name, x.max_questions,
         coalesce(x.correct_count,0), coalesce(x.wrong_count,0), coalesce(x.blank_count,0), v_penalty
  from jsonb_to_recordset(coalesce(p_sections, '[]'::jsonb))
    as x(section_name text, max_questions int, correct_count int, wrong_count int, blank_count int);

  return json_build_object('ok', true, 'exam_id', v_exam_id);
end;
$$;
grant execute on function portal_add_exam(text, text, text, text, date, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 15c. portal_exam_report (Mobil Öğrenci & Veli Portalı Deneme Analiz RPC)
-- ---------------------------------------------------------------------------
-- Erişim koduyla çağrılır. Öğrenci veya velinin son 30 denemesinin ham satırlarını
-- (genel bilgiler, bölümler, alt dersler, konular) ve katalog eşleştirmelerini
-- JSON olarak döndürür.
--
-- SECURITY DEFINER olarak çalışır: anon rolüyle gelen mobil isteklerin
-- doğrudan tablolara erişimi yoktur; erişim kodu doğrulanarak yalnız o öğrencinin
-- verisi güvenle süzülür.
create or replace function portal_exam_report(p_code text)
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
    'student', (
      select json_build_object(
        'id', s.id, 'full_name', s.full_name, 'grade', s.grade, 'track', s.track
      ) from students s where s.id = v_student_id
    ),
    'catalog', json_build_object(
      'subjects', coalesce((
        select json_agg(json_build_object(
          'id', es.id,
          'exam_type', es.exam_type,
          'section_name', es.section_name,
          'subject_id', es.subject_id,
          'label', es.label,
          'question_count', es.question_count,
          'choice_group', es.choice_group,
          'sort_order', es.sort_order
        ) order by es.sort_order, es.id)
        from exam_subjects es
      ), '[]'::json),
      'topics', coalesce((
        select json_agg(json_build_object(
          'id', et.id,
          'exam_subject_id', et.exam_subject_id,
          'name', et.name,
          'grades', et.grades,
          'sort_order', et.sort_order,
          'is_active', et.is_active
        ) order by et.sort_order, et.id)
        from exam_topics et
        where et.is_active = true
      ), '[]'::json)
    ),
    'exams', coalesce((
      select json_agg(e order by e.exam_date desc, e.created_at desc) from (
        select
          me.id,
          me.student_id,
          me.name,
          me.publisher,
          me.exam_type,
          me.exam_date,
          me.score,
          me.percentile,
          me.ranks,
          me.coach_note,
          me.created_at,
          coalesce((
            select json_agg(json_build_object(
              'section_name', ms.section_name,
              'max_questions', ms.max_questions,
              'correct_count', ms.correct_count,
              'wrong_count', ms.wrong_count,
              'blank_count', ms.blank_count,
              'wrong_penalty', ms.wrong_penalty,
              'net', ms.net
            ) order by ms.section_name)
            from mock_exam_sections ms where ms.mock_exam_id = me.id
          ), '[]'::json) as sections,
          coalesce((
            select json_agg(json_build_object(
              'exam_subject_id', sr.exam_subject_id,
              'question_count', sr.question_count,
              'correct_count', sr.correct_count,
              'wrong_count', sr.wrong_count,
              'blank_count', sr.blank_count,
              'wrong_penalty', sr.wrong_penalty,
              'net', sr.net
            ) order by sr.exam_subject_id)
            from mock_exam_subject_results sr where sr.mock_exam_id = me.id
          ), '[]'::json) as subject_results,
          coalesce((
            select json_agg(json_build_object(
              'exam_topic_id', tr.exam_topic_id,
              'question_count', tr.question_count,
              'correct_count', tr.correct_count,
              'wrong_count', tr.wrong_count,
              'blank_count', tr.blank_count
            ) order by tr.exam_topic_id)
            from mock_exam_topic_results tr where tr.mock_exam_id = me.id
          ), '[]'::json) as topic_results
        from mock_exams me
        where me.student_id = v_student_id
        order by me.exam_date desc, me.created_at desc
        limit 30
      ) e
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;
revoke all on function portal_exam_report(text) from public, anon, authenticated;
grant execute on function portal_exam_report(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 15b. save_exam_report (Atomik Deneme Kaydı RPC)
-- ---------------------------------------------------------------------------
-- Koç ekranından deneme karnesi girişini (genel bilgiler, bölümler, alt dersler,
-- konular) TEK BİR TRANSACTION içinde kaydeder / günceller.
--
-- SECURITY INVOKER olarak çalışır: çağıran kullanıcının (koç) RLS izinleri
-- ('exams.manage' vb.) aynen geçerlidir.
--
-- Payload şeması:
-- {
--   "id": "uuid (opsiyonel: null ise yeni deneme oluşturur, dolu ise günceller)",
--   "student_id": "uuid (zorunlu)",
--   "name": "text (zorunlu)",
--   "publisher": "text (opsiyonel)",
--   "exam_type": "'TYT' | 'AYT' | 'LGS' (zorunlu)",
--   "exam_date": "YYYY-MM-DD (zorunlu)",
--   "score": "numeric (opsiyonel, yayının açıkladığı puan)",
--   "percentile": "numeric (opsiyonel, yüzdelik dilim)",
--   "ranks": { "sube": {"sira": 1, "katilan": 10}, "genel": ... } (opsiyonel jsonb),
--   "coach_note": "text (opsiyonel)",
--   "sections": [
--     { "section_name": "Türkçe", "max_questions": 40, "correct_count": 35, "wrong_count": 3 }
--   ],
--   "subject_results": [
--     { "exam_subject_id": 1, "question_count": 40, "correct_count": 35, "wrong_count": 3 }
--   ],
--   "topic_results": [
--     { "exam_topic_id": 10, "question_count": 5, "correct_count": 4, "wrong_count": 1 }
--   ]
-- }
--
-- Not:
-- 1. "exam" nesnesi payload'ın kökünde veya "exam": { ... } altında verilebilir.
-- 2. wrong_penalty (yanlışın götürdüğü net katsayısı) istemciden ASLA alınmaz;
--    exam_type'a göre sunucuda belirlenir (LGS: 3, diğerleri: 4).
-- 3. Formda boşaltılan veya silinen satırlar (payload'da yer almayan mevcut sonuçlar)
--    bu deneme için otomatik olarak silinir.
-- 4. D + Y <= S ihlalleri hata fırlatır.
create or replace function save_exam_report(p_payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_exam_obj jsonb;
  v_exam_id uuid;
  v_student_id uuid;
  v_name text;
  v_publisher text;
  v_exam_type text;
  v_exam_date date;
  v_score numeric;
  v_percentile numeric;
  v_ranks jsonb;
  v_coach_note text;
  v_wrong_penalty numeric;
begin
  if p_payload is null then
    raise exception 'Payload boş olamaz.';
  end if;

  -- Kök nesne veya iç içe 'exam' nesnesi desteği
  v_exam_obj := case
    when jsonb_typeof(p_payload->'exam') = 'object' then p_payload->'exam'
    else p_payload
  end;

  v_exam_id := nullif(btrim(coalesce(v_exam_obj->>'id', '')), '')::uuid;
  v_student_id := nullif(btrim(coalesce(v_exam_obj->>'student_id', '')), '')::uuid;
  v_name := btrim(coalesce(v_exam_obj->>'name', ''));
  v_publisher := nullif(btrim(coalesce(v_exam_obj->>'publisher', '')), '');
  v_exam_type := btrim(coalesce(v_exam_obj->>'exam_type', ''));
  v_exam_date := nullif(btrim(coalesce(v_exam_obj->>'exam_date', '')), '')::date;

  if v_exam_obj->>'score' is not null and btrim(v_exam_obj->>'score') <> '' then
    v_score := (v_exam_obj->>'score')::numeric;
  else
    v_score := null;
  end if;

  if v_exam_obj->>'percentile' is not null and btrim(v_exam_obj->>'percentile') <> '' then
    v_percentile := (v_exam_obj->>'percentile')::numeric;
  else
    v_percentile := null;
  end if;

  v_ranks := case
    when jsonb_typeof(v_exam_obj->'ranks') = 'object' then v_exam_obj->'ranks'
    else null
  end;

  v_coach_note := nullif(btrim(coalesce(v_exam_obj->>'coach_note', '')), '');

  -- Doğrulamalar
  if v_student_id is null then
    raise exception 'Öğrenci kimliği (student_id) zorunludur.';
  end if;
  if v_name = '' then
    raise exception 'Deneme adı zorunludur.';
  end if;
  if v_exam_type not in ('TYT', 'AYT', 'LGS') then
    raise exception 'Geçersiz sınav türü: %', coalesce(v_exam_type, 'null');
  end if;
  if v_exam_date is null then
    raise exception 'Sınav tarihi zorunludur.';
  end if;

  -- Ceza katsayısı sunucuda belirlenir
  v_wrong_penalty := case when v_exam_type = 'LGS' then 3 else 4 end;

  -- Bölüm doğrulama: D + Y <= S ve negatif olmama kontrolü
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_payload->'sections', '[]'::jsonb))
      as x(section_name text, max_questions int, correct_count int, wrong_count int)
    where coalesce(x.correct_count, 0) < 0
       or coalesce(x.wrong_count, 0) < 0
       or coalesce(x.max_questions, 0) <= 0
       or (coalesce(x.correct_count, 0) + coalesce(x.wrong_count, 0)) > x.max_questions
  ) then
    raise exception 'Bölüm sonuçlarında geçersiz soru sayısı veya D+Y > S ihlali.';
  end if;

  -- Alt ders doğrulama: D + Y <= S kontrolü
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_payload->'subject_results', '[]'::jsonb))
      as x(exam_subject_id int, question_count int, correct_count int, wrong_count int)
    where coalesce(x.correct_count, 0) < 0
       or coalesce(x.wrong_count, 0) < 0
       or coalesce(x.question_count, 0) <= 0
       or (coalesce(x.correct_count, 0) + coalesce(x.wrong_count, 0)) > x.question_count
  ) then
    raise exception 'Alt ders sonuçlarında geçersiz soru sayısı veya D+Y > S ihlali.';
  end if;

  -- Konu doğrulama: D + Y <= S kontrolü
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_payload->'topic_results', '[]'::jsonb))
      as x(exam_topic_id int, question_count int, correct_count int, wrong_count int)
    where coalesce(x.correct_count, 0) < 0
       or coalesce(x.wrong_count, 0) < 0
       or coalesce(x.question_count, 0) <= 0
       or (coalesce(x.correct_count, 0) + coalesce(x.wrong_count, 0)) > x.question_count
  ) then
    raise exception 'Konu sonuçlarında geçersiz soru sayısı veya D+Y > S ihlali.';
  end if;

  -- 1. mock_exams upsert
  if v_exam_id is null then
    insert into mock_exams (
      student_id, name, publisher, exam_type, exam_date,
      score, percentile, ranks, coach_note
    ) values (
      v_student_id, v_name, v_publisher, v_exam_type, v_exam_date,
      v_score, v_percentile, v_ranks, v_coach_note
    ) returning id into v_exam_id;
  else
    update mock_exams set
      student_id = v_student_id,
      name = v_name,
      publisher = v_publisher,
      exam_type = v_exam_type,
      exam_date = v_exam_date,
      score = v_score,
      percentile = v_percentile,
      ranks = v_ranks,
      coach_note = v_coach_note
    where id = v_exam_id;

    if not found then
      insert into mock_exams (
        id, student_id, name, publisher, exam_type, exam_date,
        score, percentile, ranks, coach_note
      ) values (
        v_exam_id, v_student_id, v_name, v_publisher, v_exam_type, v_exam_date,
        v_score, v_percentile, v_ranks, v_coach_note
      );
    end if;
  end if;

  -- 2. mock_exam_sections upsert + silinenleri temizleme
  insert into mock_exam_sections (
    mock_exam_id, section_name, max_questions,
    correct_count, wrong_count, blank_count, wrong_penalty
  )
  select
    v_exam_id,
    x.section_name,
    x.max_questions,
    coalesce(x.correct_count, 0),
    coalesce(x.wrong_count, 0),
    (x.max_questions - coalesce(x.correct_count, 0) - coalesce(x.wrong_count, 0)),
    v_wrong_penalty
  from jsonb_to_recordset(coalesce(p_payload->'sections', '[]'::jsonb))
    as x(section_name text, max_questions int, correct_count int, wrong_count int)
  on conflict (mock_exam_id, section_name) do update set
    max_questions = excluded.max_questions,
    correct_count = excluded.correct_count,
    wrong_count = excluded.wrong_count,
    blank_count = excluded.blank_count,
    wrong_penalty = excluded.wrong_penalty;

  delete from mock_exam_sections
  where mock_exam_id = v_exam_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_payload->'sections', '[]'::jsonb)) as x(section_name text)
      where x.section_name = mock_exam_sections.section_name
    );

  -- 3. mock_exam_subject_results upsert + silinenleri temizleme
  insert into mock_exam_subject_results (
    mock_exam_id, exam_subject_id, question_count,
    correct_count, wrong_count, wrong_penalty
  )
  select
    v_exam_id,
    x.exam_subject_id,
    x.question_count,
    coalesce(x.correct_count, 0),
    coalesce(x.wrong_count, 0),
    v_wrong_penalty
  from jsonb_to_recordset(coalesce(p_payload->'subject_results', '[]'::jsonb))
    as x(exam_subject_id int, question_count int, correct_count int, wrong_count int)
  on conflict (mock_exam_id, exam_subject_id) do update set
    question_count = excluded.question_count,
    correct_count = excluded.correct_count,
    wrong_count = excluded.wrong_count,
    wrong_penalty = excluded.wrong_penalty;

  delete from mock_exam_subject_results
  where mock_exam_id = v_exam_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_payload->'subject_results', '[]'::jsonb)) as x(exam_subject_id int)
      where x.exam_subject_id = mock_exam_subject_results.exam_subject_id
    );

  -- 4. mock_exam_topic_results upsert + silinenleri temizleme
  insert into mock_exam_topic_results (
    mock_exam_id, exam_topic_id, question_count,
    correct_count, wrong_count
  )
  select
    v_exam_id,
    x.exam_topic_id,
    x.question_count,
    coalesce(x.correct_count, 0),
    coalesce(x.wrong_count, 0)
  from jsonb_to_recordset(coalesce(p_payload->'topic_results', '[]'::jsonb))
    as x(exam_topic_id int, question_count int, correct_count int, wrong_count int)
  on conflict (mock_exam_id, exam_topic_id) do update set
    question_count = excluded.question_count,
    correct_count = excluded.correct_count,
    wrong_count = excluded.wrong_count;

  delete from mock_exam_topic_results
  where mock_exam_id = v_exam_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_payload->'topic_results', '[]'::jsonb)) as x(exam_topic_id int)
      where x.exam_topic_id = mock_exam_topic_results.exam_topic_id
    );

  return v_exam_id;
end;
$$;
revoke all on function save_exam_report(jsonb) from public, anon;
grant execute on function save_exam_report(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 16. Denetim Kaydı (Audit Log)
-- ---------------------------------------------------------------------------
-- Kim, ne zaman, hangi kaydı oluşturdu/değiştirdi/sildi.
-- Uygulama katmanında değil TRIGGER ile tutulur: yazma üç ayrı kanaldan geliyor
-- (koç oturumu, portal RPC'leri, service-role script'leri) ve trigger üçünü de
-- yakalar, atlanamaz.
--
-- Görünürlük: YALNIZ sistem admini. Bu yüzden ayrı bir izin anahtarı yok.

create table if not exists audit_log (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,                 -- auth.users; sistem/portal işlemlerinde null
  actor_label text not null,     -- 'kullanici' | 'ogrenci:<uuid>' | 'veli:<uuid>' | 'sistem'
  actor_name text,               -- anlık kopya: kullanıcı sonradan silinse de ad kalsın
  institution_id uuid,
  student_id uuid,
  table_name text not null,
  row_id text not null,
  action text not null check (action in ('insert','update','delete')),
  old_row jsonb,
  new_row jsonb
);

create index if not exists audit_log_occurred_idx on audit_log(occurred_at desc);
create index if not exists audit_log_table_idx on audit_log(table_name);
create index if not exists audit_log_actor_idx on audit_log(actor_id);
create index if not exists audit_log_student_idx on audit_log(student_id);
create index if not exists audit_log_institution_idx on audit_log(institution_id);

-- Aktör çözümleyici: tek kaynak. Yeni bir yazma kanalı eklenirse yalnız burası değişir.
-- Öncelik: açıkça set edilmiş app.actor -> oturum kullanıcısı -> sistem.
create or replace function audit_actor_label()
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(current_setting('app.actor', true), ''),
    case when auth.uid() is not null then 'kullanici' else 'sistem' end
  );
$$;

-- Erişim kodları birer kimlik bilgisidir: logda saklanırsa admin, döndürülmüş
-- olsa bile öğrencinin eski PIN'ini geçmişten okuyabilir.
create or replace function audit_redact(p jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when p is null then null
    else p
      || case when p ? 'student_access_code' then jsonb_build_object('student_access_code', '***') else '{}'::jsonb end
      || case when p ? 'parent_access_code'  then jsonb_build_object('parent_access_code',  '***') else '{}'::jsonb end
  end;
$$;

create or replace function audit_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_rec jsonb;
  v_student uuid;
  v_inst uuid;
  v_row_id text;
begin
  -- Gerçekten değişmediyse yazma: arayüz her kaydetmede tüm alanları gönderiyor.
  if TG_OP = 'UPDATE' and to_jsonb(OLD) = to_jsonb(NEW) then
    return NEW;
  end if;

  -- weekly_tasks'ta yalnız 'completed' değiştiyse atla. Öğrenci portalda her gün
  -- onlarca kutu işaretliyor; denetim değeri düşük, logun en büyük kalemi bu olur.
  if TG_TABLE_NAME = 'weekly_tasks' and TG_OP = 'UPDATE'
     and (to_jsonb(OLD) - 'completed') = (to_jsonb(NEW) - 'completed') then
    return NEW;
  end if;

  begin
    v_old := case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) end;
    v_new := case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) end;

    if TG_TABLE_NAME = 'students' then
      v_old := audit_redact(v_old);
      v_new := audit_redact(v_new);
    end if;

    v_rec := coalesce(v_new, v_old);
    v_row_id := coalesce(v_rec->>'id', '?');

    -- Bağlam yazarken çözülür: silinen satırın kurumu sonradan bulunamaz,
    -- bulunamayan kurum ise RLS'i çürütür.
    if TG_TABLE_NAME = 'students' then
      v_student := (v_rec->>'id')::uuid;
      v_inst := nullif(v_rec->>'institution_id','')::uuid;
    elsif TG_TABLE_NAME in ('weekly_tasks','topic_measurements','coach_decisions','attendance_records','mock_exams','ogrenci_tercih_listeleri') then
      v_student := nullif(v_rec->>'student_id','')::uuid;
      select s.institution_id into v_inst from students s where s.id = v_student;
    elsif TG_TABLE_NAME in ('mock_exam_sections','error_basket_items','mock_exam_subject_results','mock_exam_topic_results') then
      select e.student_id, s.institution_id into v_student, v_inst
      from mock_exams e left join students s on s.id = e.student_id
      where e.id = nullif(v_rec->>'mock_exam_id','')::uuid;
    elsif TG_TABLE_NAME in ('memberships','invitations','roles') then
      v_inst := nullif(v_rec->>'institution_id','')::uuid;
    elsif TG_TABLE_NAME = 'institutions' then
      v_inst := (v_rec->>'id')::uuid;
    end if;

    insert into audit_log (
      actor_id, actor_label, actor_name, institution_id, student_id,
      table_name, row_id, action, old_row, new_row
    ) values (
      auth.uid(),
      audit_actor_label(),
      (select p.full_name from profiles p where p.id = auth.uid()),
      v_inst, v_student,
      TG_TABLE_NAME, v_row_id, lower(TG_OP), v_old, v_new
    );
  exception when others then
    -- Denetim hatası iş akışını KESMEMELİ: koçun öğrenci kaydedememesi,
    -- log tutulamamasından daha kötü. En azından hatayı kaydetmeye çalış.
    begin
      insert into audit_log (actor_label, table_name, row_id, action, new_row)
      values ('sistem', TG_TABLE_NAME, coalesce(v_row_id,'?'), lower(TG_OP),
              jsonb_build_object('audit_error', SQLERRM));
    exception when others then null;
    end;
  end;

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ek Yerleştirme modülü
-- Referans tablolar (program/koşul/ücret) yalnız service role tarafından yazılır
-- (seed:ek); university_rankings'e BİLİNÇLİ olarak FK yok — o seed tabloyu silip doldurur.
-- ---------------------------------------------------------------------------
create table if not exists ek_yerlestirme_programlari (
  id bigserial primary key,
  yil int not null,
  tablo text not null check (tablo in ('onlisans', 'lisans')),
  universite text not null,
  universite_turu text not null check (universite_turu in ('devlet', 'vakif', 'kktc', 'yurtdisi')),
  il text,
  fakulte text,
  program_kodu bigint not null,
  program_adi text not null,
  ogrenim_suresi int,
  puan_turu text not null check (puan_turu in ('TYT', 'SAY', 'EA', 'SÖZ', 'DİL')),
  genel_ek_kont int not null default 0,
  sgy_ek_kont int not null default 0,
  k34_ek_kont int not null default 0,
  kosul_kodlari int[] not null default '{}',
  en_kucuk_gk numeric,
  en_kucuk_sgy numeric,
  en_kucuk_34y numeric,
  burs_indirim text,
  kaynak_sayfa int,
  created_at timestamptz not null default now(),
  unique (yil, program_kodu)
);

create table if not exists ek_yerlestirme_kosullari (
  yil int not null,
  kosul_no int not null,
  kisim smallint not null check (kisim in (1, 2)),
  metin text not null,
  primary key (yil, kosul_no)
);

create table if not exists vakif_ogrenim_ucretleri (
  id bigserial primary key,
  yil int not null,
  universite text not null,
  duzey text,
  program text not null,
  ucret numeric,
  aciklama text,
  unique nulls not distinct (yil, universite, duzey, program)
);

create table if not exists ogrenci_tercih_listeleri (
  id bigserial primary key,
  student_id uuid not null references students(id) on delete cascade,
  yil int not null,
  donem text not null check (donem in ('asil', 'ek')),
  program_kodu bigint not null,
  sira int not null check (sira between 1 and 24),
  notlar text,
  created_at timestamptz not null default now(),
  unique (student_id, yil, donem, sira),
  unique (student_id, yil, donem, program_kodu)
);
create index if not exists ogrenci_tercih_listeleri_student_idx on ogrenci_tercih_listeleri(student_id);

alter table ek_yerlestirme_programlari enable row level security;
alter table ek_yerlestirme_kosullari enable row level security;
alter table vakif_ogrenim_ucretleri enable row level security;
alter table ogrenci_tercih_listeleri enable row level security;

drop policy if exists "ek_yerlestirme_programlari: giriş yapan okur" on ek_yerlestirme_programlari;
create policy "ek_yerlestirme_programlari: giriş yapan okur" on ek_yerlestirme_programlari
  for select to authenticated using (true);
drop policy if exists "ek_yerlestirme_kosullari: giriş yapan okur" on ek_yerlestirme_kosullari;
create policy "ek_yerlestirme_kosullari: giriş yapan okur" on ek_yerlestirme_kosullari
  for select to authenticated using (true);
drop policy if exists "vakif_ogrenim_ucretleri: giriş yapan okur" on vakif_ogrenim_ucretleri;
create policy "vakif_ogrenim_ucretleri: giriş yapan okur" on vakif_ogrenim_ucretleri
  for select to authenticated using (true);

drop policy if exists "ogrenci_tercih_listeleri: okuma yetkisi" on ogrenci_tercih_listeleri;
create policy "ogrenci_tercih_listeleri: okuma yetkisi" on ogrenci_tercih_listeleri for select using (
  (select student_permission(student_id, 'tercih.view'))
);
drop policy if exists "ogrenci_tercih_listeleri: yönetim yetkisi" on ogrenci_tercih_listeleri;
create policy "ogrenci_tercih_listeleri: yönetim yetkisi" on ogrenci_tercih_listeleri for all using (
  (select student_permission(student_id, 'tercih.view'))
) with check (
  (select student_permission(student_id, 'tercih.view'))
);

-- Listeyi tek transaction'da değiştirir (sil + ekle). SECURITY INVOKER: RLS çağıranın
-- yetkisiyle işler. Sırayı değiştirmek unique(sira) ihlali yaratmasın diye önce silinir.
create or replace function tercih_listesi_kaydet(
  p_student_id uuid, p_yil int, p_donem text, p_items jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if jsonb_array_length(p_items) > 24 then
    raise exception 'Tercih listesi en fazla 24 program içerebilir.';
  end if;

  delete from ogrenci_tercih_listeleri
  where student_id = p_student_id and yil = p_yil and donem = p_donem;

  insert into ogrenci_tercih_listeleri (student_id, yil, donem, program_kodu, sira, notlar)
  select p_student_id, p_yil, p_donem, x.program_kodu, x.sira, x.notlar
  from jsonb_to_recordset(p_items) as x(program_kodu bigint, sira int, notlar text);
end;
$$;
revoke all on function tercih_listesi_kaydet(uuid, int, text, jsonb) from public, anon, authenticated;
grant execute on function tercih_listesi_kaydet(uuid, int, text, jsonb) to authenticated;

-- İzlenen tablolar. university_rankings (66 bin satırlık referans veri) ve
-- permission_catalog (seed) bilinçli olarak dışarıda.
do $$
declare t text;
begin
  foreach t in array array[
    'students','weekly_tasks','topic_measurements','coach_decisions',
    'attendance_records','mock_exams','mock_exam_sections','error_basket_items',
    'mock_exam_subject_results','mock_exam_topic_results',
    'memberships','invitations','roles','institutions','subjects','topics',
    'ogrenci_tercih_listeleri'
  ]
  loop
    execute format('drop trigger if exists trg_audit_%1$s on %1$I', t);
    execute format(
      'create trigger trg_audit_%1$s after insert or update or delete on %1$I
       for each row execute function audit_row()', t);
  end loop;
end $$;

alter table audit_log enable row level security;

-- Yalnız okuma, yalnız sistem admini. insert/update/delete politikası YOK:
-- kayıtları trigger (security definer) yazar, kimse elle değiştiremez/silemez.
-- Silme yalnız audit_purge() üzerinden ve o da kendini loglar.
drop policy if exists "audit_log: yalnız sistem admini okur" on audit_log;
create policy "audit_log: yalnız sistem admini okur" on audit_log for select using (
  (select is_system_admin())
);

revoke all on function audit_actor_label() from public, anon;
grant execute on function audit_actor_label() to authenticated;

-- Dönemsel temizlik. Silme işleminin KENDİSİ loglanır ve o kayıt asla silinmez —
-- "log silinmiş mi" sorusunun cevabı her zaman logda kalır.
create or replace function audit_purge(p_before timestamptz)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count bigint;
begin
  if not is_system_admin() then
    return json_build_object('ok', false, 'error', 'Bu işlem yalnız sistem yöneticisine açıktır.');
  end if;

  delete from audit_log
  where occurred_at < p_before and table_name <> '_temizlik';
  get diagnostics v_count = row_count;

  insert into audit_log (actor_id, actor_label, actor_name, table_name, row_id, action, new_row)
  values (
    auth.uid(), 'kullanici',
    (select p.full_name from profiles p where p.id = auth.uid()),
    '_temizlik', to_char(p_before, 'YYYY-MM-DD'), 'delete',
    jsonb_build_object('silinen_kayit', v_count, 'bu_tarihten_once', p_before)
  );

  return json_build_object('ok', true, 'silinen', v_count);
end;
$$;
revoke all on function audit_purge(timestamptz) from public, anon;
grant execute on function audit_purge(timestamptz) to authenticated;

-- Arayüzün "ne kadar yer kaplıyor, ne zaman temizlemeliyim" sorusuna cevabı.
create or replace function audit_stats()
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_system_admin() then
    return json_build_object('ok', false, 'error', 'Bu işlem yalnız sistem yöneticisine açıktır.');
  end if;

  return json_build_object(
    'ok', true,
    'toplam_kayit', (select count(*) from audit_log),
    'en_eski', (select min(occurred_at) from audit_log),
    'en_yeni', (select max(occurred_at) from audit_log),
    'boyut_bayt', pg_total_relation_size('audit_log'),
    'son_30_gun', (select count(*) from audit_log where occurred_at > now() - interval '30 days')
  );
end;
$$;
revoke all on function audit_stats() from public, anon;
grant execute on function audit_stats() to authenticated;

-- ===========================================================================
-- Raporlar 2.0 · R1-1 — Veri Modeli Genişletmeleri (Idempotent)
-- ===========================================================================

-- 1.1 weekly_tasks: Yeni kolonlar
alter table weekly_tasks add column if not exists correct_count smallint;
alter table weekly_tasks add column if not exists wrong_count smallint;
alter table weekly_tasks add column if not exists blank_count smallint;
alter table weekly_tasks add column if not exists completed_at timestamptz;
alter table weekly_tasks add column if not exists task_type text not null default 'konu';
alter table weekly_tasks add column if not exists source text;
alter table weekly_tasks add column if not exists origin_kind text not null default 'elle';
alter table weekly_tasks add column if not exists origin_exam_topic_id int references exam_topics(id) on delete set null;

-- weekly_tasks: task_type ve origin_kind check kısıtlamaları
alter table weekly_tasks drop constraint if exists weekly_tasks_task_type_ck;
alter table weekly_tasks add constraint weekly_tasks_task_type_ck
  check (task_type in ('konu', 'tekrar', 'rutin', 'sureli_test', 'deneme'));

alter table weekly_tasks drop constraint if exists weekly_tasks_origin_kind_ck;
alter table weekly_tasks add constraint weekly_tasks_origin_kind_ck
  check (origin_kind in ('elle', 'deneme_analizi', 'konu_haritasi', 'gorusme', 'oneri'));

-- weekly_tasks: Sonuç kısıtlaması (D + Y + B <= question_count ve negatif olamaz)
alter table weekly_tasks drop constraint if exists weekly_tasks_result_ck;
alter table weekly_tasks add constraint weekly_tasks_result_ck check (
  (correct_count is null or correct_count >= 0) and
  (wrong_count is null or wrong_count >= 0) and
  (blank_count is null or blank_count >= 0) and
  (coalesce(correct_count, 0) + coalesce(wrong_count, 0) + coalesce(blank_count, 0) <= question_count)
);

-- Geriye dönük doldurma: is_exam olanlar deneme türüne güncellenir
update weekly_tasks set task_type = 'deneme' where is_exam and task_type = 'konu';

-- weekly_tasks trigger: completed false->true olunca completed_at = now(), true->false olunca null
create or replace function trg_weekly_tasks_completed_at()
returns trigger
language plpgsql
-- $fn$: bazı arayüzler $$ çiftini matematik işareti sanıp siliyor (2026-10-26, SQL Editor'e kopyalarken).
as $fn$
begin
  if new.completed = true and (old.completed is null or old.completed = false) then
    new.completed_at = now();
  elsif new.completed = false and old.completed = true then
    new.completed_at = null;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_weekly_tasks_completed_at on weekly_tasks;
create trigger trg_weekly_tasks_completed_at
before insert or update on weekly_tasks
for each row execute function trg_weekly_tasks_completed_at();

-- 1.2 students: Hedef net kolonları
alter table students add column if not exists target_net_tyt numeric(5,2);
alter table students add column if not exists target_net_ayt numeric(5,2);
alter table students add column if not exists target_net_lgs numeric(5,2);
alter table students add column if not exists target_set_at timestamptz;

-- 1.3 exam_calendar: Sınav tarihleri
create table if not exists exam_calendar (
  exam text primary key check (exam in ('YKS', 'LGS')),
  exam_date date not null,
  updated_at timestamptz not null default now()
);

alter table exam_calendar enable row level security;

drop policy if exists "exam_calendar: herkes okur" on exam_calendar;
create policy "exam_calendar: herkes okur" on exam_calendar
  for select to authenticated using (true);

drop policy if exists "exam_calendar: yalnız sistem admini yönetir" on exam_calendar;
create policy "exam_calendar: yalnız sistem admini yönetir" on exam_calendar
  for all to authenticated
  using (is_system_admin())
  with check (is_system_admin());

-- ===========================================================================
-- Raporlar 2.0 · R3-0 — Şema ve Veri Modeli Genişletmeleri (Idempotent)
-- ===========================================================================

-- 1. weekly_tasks: duration_min kolonu (R4-3)
alter table weekly_tasks add column if not exists duration_min smallint;

-- 2. parent_summary_log: Veli özeti görüntüleme ve WhatsApp logu (R3-6)
create table if not exists parent_summary_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  week_start date not null,
  opened_at timestamptz not null default now(),
  opened_by uuid default auth.uid(),
  channel text not null default 'whatsapp'
);

create index if not exists parent_summary_log_student_week_idx on parent_summary_log(student_id, week_start desc);

alter table parent_summary_log enable row level security;

drop policy if exists "parent_summary_log: öğrenciyi görebilen koç okur" on parent_summary_log;
create policy "parent_summary_log: öğrenciyi görebilen koç okur" on parent_summary_log
  for select to authenticated using (
    (select is_system_admin()) or exists (
      select 1 from students s
      where s.id = parent_summary_log.student_id
        and s.institution_id in (select my_institution_ids())
    )
  );

drop policy if exists "parent_summary_log: öğrenciyi görebilen koç ekler" on parent_summary_log;
create policy "parent_summary_log: öğrenciyi görebilen koç ekler" on parent_summary_log
  for insert to authenticated with check (
    (select is_system_admin()) or exists (
      select 1 from students s
      where s.id = parent_summary_log.student_id
        and s.institution_id in (select my_institution_ids())
    )
  );

-- 3. topic_weights: ÖSYM / MEB konu soru dağılım ağırlıkları (R4-1)
create table if not exists topic_weights (
  id serial primary key,
  exam_type text not null check (exam_type in ('TYT', 'AYT', 'LGS')),
  exam_topic_id int not null references exam_topics(id) on delete cascade,
  avg_questions numeric(5,2) not null,
  source text not null,
  year_from int,
  year_to int,
  unique (exam_type, exam_topic_id, source)
);

create index if not exists topic_weights_exam_topic_idx on topic_weights(exam_type, exam_topic_id);

alter table topic_weights enable row level security;

drop policy if exists "topic_weights: herkes okur" on topic_weights;
create policy "topic_weights: herkes okur" on topic_weights
  for select to authenticated using (true);

drop policy if exists "topic_weights: yetkili koç ekler" on topic_weights;
create policy "topic_weights: yetkili koç ekler" on topic_weights
  for insert to authenticated with check (
    (select is_system_admin()) or (select user_has_any_permission('curriculum.manage'))
  );

drop policy if exists "topic_weights: yetkili koç günceller" on topic_weights;
create policy "topic_weights: yetkili koç günceller" on topic_weights
  for update to authenticated using (
    (select is_system_admin()) or (select user_has_any_permission('curriculum.manage'))
  ) with check (
    (select is_system_admin()) or (select user_has_any_permission('curriculum.manage'))
  );

drop policy if exists "topic_weights: yetkili koç siler" on topic_weights;
create policy "topic_weights: yetkili koç siler" on topic_weights
  for delete to authenticated using (
    (select is_system_admin()) or (select user_has_any_permission('curriculum.manage'))
  );
