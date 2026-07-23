-- Netlik (Coching_AI) — Supabase şeması
-- Sırayla çalıştır: bu dosyanın tamamını Supabase SQL Editor'de tek seferde yürütebilirsin.
-- Coğu tablo bir koça (auth.users) bağlıdır; RLS her koçun sadece kendi öğrencilerini görmesini sağlar.

-- ---------------------------------------------------------------------------
-- Koç profili (auth.users'a 1:1 uzanır; sadece görünen ad için)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'Kurucu Koç',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Öğrenciler
-- ---------------------------------------------------------------------------
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
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
  created_at timestamptz not null default now()
);
create index if not exists students_coach_id_idx on students(coach_id);

-- Geriye dönük kolon eklemeleri (tablo zaten varsa çalışır)
alter table students add column if not exists is_active boolean not null default true;
alter table students add column if not exists phone_number text;
alter table students add column if not exists parent_phone_number text;
alter table students add column if not exists photo_url text;

-- ---------------------------------------------------------------------------
-- Müfredat: dersler ve konular (2022 TYT Konuları — tüm koçlar arasında ortak,
-- koça özel değil, herkes aynı müfredatı görür)
-- ---------------------------------------------------------------------------
-- is_active: müfredat yıldan yıla değişebiliyor. Bir konu/ders kaldırılmak
-- istendiğinde SİLİNMEZ (silinirse ona bağlı tüm ölçüm/görev geçmişi cascade
-- ile yok olur) — is_active=false yapılıp Müfredat ekranında gizlenir, geçmiş
-- veri korunur. Yeni bir yılın müfredatı geldiğinde yeni ders/konu eklenir.
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

-- Bu şemayı daha önce çalıştırdıysan (subjects/topics zaten vardı), yukarıdaki
-- "create table if not exists" onları atlar — is_active sütununu buradan ekle.
alter table subjects add column if not exists is_active boolean not null default true;
alter table topics add column if not exists is_active boolean not null default true;

-- ---------------------------------------------------------------------------
-- Konu bazlı ölçümler — hem konu testi hem deneme sonuçları buraya düşer.
-- accuracy_pct, doğru/yanlış/boş girilmişse otomatik hesaplanır.
-- ---------------------------------------------------------------------------
create table if not exists topic_measurements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  topic_id int not null references topics(id) on delete cascade,
  source text not null check (source in ('konu_testi', 'deneme')),
  source_label text not null, -- 'Konu Testi' veya deneme adı
  correct_count int,
  wrong_count int,
  blank_count int,
  accuracy_pct numeric not null check (accuracy_pct >= 0 and accuracy_pct <= 100),
  measured_at date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists topic_measurements_student_topic_idx on topic_measurements(student_id, topic_id);

-- ---------------------------------------------------------------------------
-- Koç Kararı — otomatik önerinin üzerine koçun onayladığı/geçersiz kıldığı durum.
-- Bir öğrenci+konu için tek satır (upsert ile güncellenir).
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Denemeler (mock exams) ve bölüm sonuçları
-- ---------------------------------------------------------------------------
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
  section_name text not null, -- 'Türkçe' | 'Matematik' | 'Fen Bilimleri' | 'Sosyal Bilimler' (TYT geniş bölümler)
  max_questions int not null,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  blank_count int not null default 0,
  net numeric generated always as (correct_count - wrong_count / 4.0) stored
);
create index if not exists mock_exam_sections_exam_id_idx on mock_exam_sections(mock_exam_id);

-- Hata Sepeti — denemedeki her yanlışın konu + hata türü etiketi
create table if not exists error_basket_items (
  id uuid primary key default gen_random_uuid(),
  mock_exam_id uuid not null references mock_exams(id) on delete cascade,
  topic_id int references topics(id),
  error_type text not null check (error_type in ('bilgi_eksikligi', 'islem_hatasi', 'dikkat_hatasi', 'sure_yetmedi')),
  created_at timestamptz not null default now()
);
create index if not exists error_basket_items_exam_id_idx on error_basket_items(mock_exam_id);

-- ---------------------------------------------------------------------------
-- Haftalık Program — her öğrencinin haftaya/güne yerleştirdiği görevler
-- ---------------------------------------------------------------------------
create table if not exists weekly_tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  week_start date not null, -- o haftanın Pazartesi'si
  day_index int not null check (day_index between 0 and 6), -- 0=Pazartesi ... 6=Pazar
  topic_id int references topics(id),
  custom_label text, -- topic_id null ise (örn. "Deneme Çözümü")
  question_count int not null default 0,
  is_exam boolean not null default false,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists weekly_tasks_student_week_idx on weekly_tasks(student_id, week_start);

-- ---------------------------------------------------------------------------
-- Row Level Security — her koç sadece kendi öğrencilerini ve onlara bağlı
-- verileri görür/değiştirir. subjects/topics ortak müfredat, herkese açık okuma.
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table students enable row level security;
alter table subjects enable row level security;
alter table topics enable row level security;
alter table topic_measurements enable row level security;
alter table coach_decisions enable row level security;
alter table mock_exams enable row level security;
alter table mock_exam_sections enable row level security;
alter table error_basket_items enable row level security;
alter table weekly_tasks enable row level security;

drop policy if exists "profiles: kendi profilini okur/günceller" on profiles;
create policy "profiles: kendi profilini okur/günceller" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "subjects: herkes okur" on subjects;
create policy "subjects: herkes okur" on subjects for select using (true);
drop policy if exists "topics: herkes okur" on topics;
create policy "topics: herkes okur" on topics for select using (true);
-- Müfredat (subjects/topics) tüm koçlar arasında ortak — herhangi bir giriş
-- yapmış koç ekleyebilir/güncelleyebilir. Silme politikası kasıtlı olarak yok:
-- RLS her delete isteğini reddeder, arayüz is_active=false ile "pasifleştirir".
drop policy if exists "subjects: giriş yapan koç ekler" on subjects;
create policy "subjects: giriş yapan koç ekler" on subjects for insert with check (auth.uid() is not null);
drop policy if exists "subjects: giriş yapan koç günceller" on subjects;
create policy "subjects: giriş yapan koç günceller" on subjects for update using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "topics: giriş yapan koç ekler" on topics;
create policy "topics: giriş yapan koç ekler" on topics for insert with check (auth.uid() is not null);
drop policy if exists "topics: giriş yapan koç günceller" on topics;
create policy "topics: giriş yapan koç günceller" on topics for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "students: koç kendi öğrencilerini yönetir" on students;
create policy "students: koç kendi öğrencilerini yönetir" on students
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

drop policy if exists "topic_measurements: öğrenci sahibi koç yönetir" on topic_measurements;
create policy "topic_measurements: öğrenci sahibi koç yönetir" on topic_measurements
  for all using (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()))
  with check (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()));

drop policy if exists "coach_decisions: öğrenci sahibi koç yönetir" on coach_decisions;
create policy "coach_decisions: öğrenci sahibi koç yönetir" on coach_decisions
  for all using (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()))
  with check (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()));

drop policy if exists "mock_exams: öğrenci sahibi koç yönetir" on mock_exams;
create policy "mock_exams: öğrenci sahibi koç yönetir" on mock_exams
  for all using (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()))
  with check (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()));

drop policy if exists "mock_exam_sections: öğrenci sahibi koç yönetir" on mock_exam_sections;
create policy "mock_exam_sections: öğrenci sahibi koç yönetir" on mock_exam_sections
  for all using (exists (
    select 1 from mock_exams e join students s on s.id = e.student_id
    where e.id = mock_exam_id and s.coach_id = auth.uid()
  )) with check (exists (
    select 1 from mock_exams e join students s on s.id = e.student_id
    where e.id = mock_exam_id and s.coach_id = auth.uid()
  ));

drop policy if exists "error_basket_items: öğrenci sahibi koç yönetir" on error_basket_items;
create policy "error_basket_items: öğrenci sahibi koç yönetir" on error_basket_items
  for all using (exists (
    select 1 from mock_exams e join students s on s.id = e.student_id
    where e.id = mock_exam_id and s.coach_id = auth.uid()
  )) with check (exists (
    select 1 from mock_exams e join students s on s.id = e.student_id
    where e.id = mock_exam_id and s.coach_id = auth.uid()
  ));

drop policy if exists "weekly_tasks: öğrenci sahibi koç yönetir" on weekly_tasks;
create policy "weekly_tasks: öğrenci sahibi koç yönetir" on weekly_tasks
  for all using (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()))
  with check (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage - Profil Fotoğrafları için Bucket ve RLS Kurulumu
-- ---------------------------------------------------------------------------
-- Not: Supabase'de storage şemasındaki tablolara veri eklemek/politikalar yazmak için:
-- 1. 'student-photos' adında public bir bucket oluşturun (eğer yoksa)
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', true)
on conflict (id) do nothing;

-- 2. Giriş yapmış tüm koçların fotoğraf yüklemesine ve güncellemesine izin verin
drop policy if exists "Koçlar fotoğraf yükleyebilir" on storage.objects;
create policy "Koçlar fotoğraf yükleyebilir" on storage.objects
  for insert with check (
    bucket_id = 'student-photos' 
    and auth.role() = 'authenticated'
  );

drop policy if exists "Koçlar fotoğraf güncelleyebilir" on storage.objects;
create policy "Koçlar fotoğraf güncelleyebilir" on storage.objects
  for update using (
    bucket_id = 'student-photos' 
    and auth.role() = 'authenticated'
  ) with check (
    bucket_id = 'student-photos' 
    and auth.role() = 'authenticated'
  );

-- 3. Herkesin (veya en azından giriş yapmış koçların) fotoğrafları okumasına izin verin
drop policy if exists "Fotoğraflar herkese açık okunabilir" on storage.objects;
create policy "Fotoğraflar herkese açık okunabilir" on storage.objects
  for select using (bucket_id = 'student-photos');

-- 4. Koçlar kendi yükledikleri fotoğrafları silebilir
drop policy if exists "Koçlar fotoğraf silebilir" on storage.objects;
create policy "Koçlar fotoğraf silebilir" on storage.objects
  for delete using (
    bucket_id = 'student-photos'
    and auth.role() = 'authenticated'
  );

-- =========================================================
-- Üniversite Sıralamaları (YÖK Atlas, 2023-2026) — "Tercih Sihirbazı" verisi
-- Ortak, salt-okunur referans veri. YALNIZ service-role seed yazar
-- (bkz. scripts/seedUniversityRankings.ts). Client'tan insert/update/delete YOK.
-- program_code = ÖSYM tercih (YÖP) kodu; (program_code, year) veride tekil.
-- =========================================================
create table if not exists university_rankings (
  id bigserial primary key,
  program_code bigint not null,
  university text not null,
  university_type text,          -- DEVLET / VAKIF / KKTC / YURTDISI VAKIF
  city text,
  faculty text,
  program text not null,
  degree_level text,             -- LISANS / ÖNLISANS
  fee_type text,                 -- Burslu / Ücretsiz / Ücretli / %50 İndirimli / %25 İndirimli
  education_type text,           -- Örgün Öğretim / Uzaktan Öğretim / UOLP ...
  score_type text,               -- SAY / EA / SÖZ / DİL / TYT  (nadiren null)
  year int not null,
  base_score numeric,            -- taban puan (kaynak JSON'da string → seed Number()/::numeric cast etmeli)
  base_ranking numeric,          -- taban başarı sırası (dolmayan programlarda null)
  quota int,                     -- kontenjan
  unique (program_code, year)
);
create index if not exists university_rankings_program_idx on university_rankings(program);
create index if not exists university_rankings_city_idx on university_rankings(city);
create index if not exists university_rankings_score_type_idx on university_rankings(score_type);
create index if not exists university_rankings_year_idx on university_rankings(year);
create index if not exists university_rankings_base_ranking_idx on university_rankings(base_ranking);
create index if not exists university_rankings_program_code_idx on university_rankings(program_code);

alter table university_rankings enable row level security;
-- Herkese açık okuma (subjects/topics deseniyle aynı — ortak referans veri)
drop policy if exists "university_rankings: herkes okur" on university_rankings;
create policy "university_rankings: herkes okur" on university_rankings for select using (true);
-- insert/update/delete politikası KASITLI YOK: client yazamaz, yalnız service-role (RLS bypass) seed yazar.
