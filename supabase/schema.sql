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

-- =========================================================
-- Devamsızlık Kayıtları — koç öğrenci bazında devamsızlık girer, gerektiğinde
-- WhatsApp ile öğrenciye/veliye/her ikisine bildirir. Yoklama listesi YOK,
-- yalnızca devamsızlık olayları kaydediliyor — bu yüzden katılım YÜZDESİ
-- hesaplanamaz (payda, yani toplam ders/oturum sayısı sistemde bilinmiyor).
-- Mazaretli/mazeretsiz ayrı bir kolon DEĞİL: excuse_type = 'yok' → mazeretsiz.
-- =========================================================
create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  absence_date date not null,
  session_type text not null default 'birebir'
    check (session_type in ('birebir','etut','grup','online')),
  status text not null default 'gelmedi'
    check (status in ('gelmedi','gec_geldi','erken_ayrildi')),
  excuse_type text not null default 'yok'
    check (excuse_type in ('yok','hastalik','ailevi','okul_sinav','ulasim','izinli','diger')),
  excuse_note text,
  notified_at timestamptz,          -- WhatsApp sohbet penceresi açıldığında damgalanır
  notified_to text check (notified_to is null or notified_to in ('ogrenci','veli','ikisi')),
  created_at timestamptz not null default now(),
  unique (student_id, absence_date, session_type)
);
create index if not exists attendance_records_student_idx on attendance_records(student_id);
create index if not exists attendance_records_date_idx on attendance_records(absence_date desc);

alter table attendance_records enable row level security;
-- students deseniyle birebir aynı: sadece öğrencinin koçu yönetir.
-- DELETE serbest (müfredat/öğrencinin aksine) — yaprak tablo, hiçbir şey
-- buna cascade bağlı değil, yanlış girilen kayıt kalıcı olarak silinebilmeli.
drop policy if exists "attendance_records: öğrenci sahibi koç yönetir" on attendance_records;
create policy "attendance_records: öğrenci sahibi koç yönetir" on attendance_records
  for all using (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()))
  with check (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()));

-- =========================================================
-- Mobil Öğrenci & Veli Portalı Erişim Kodları (2026-07-30)
-- =========================================================
alter table students add column if not exists student_access_code text;
alter table students add column if not exists parent_access_code text;

create unique index if not exists students_student_access_code_idx on students(student_access_code) where student_access_code is not null;
create unique index if not exists students_parent_access_code_idx on students(parent_access_code) where parent_access_code is not null;

-- ⚠️ KALDIRILDI (2026-07-30): "students: erişim kodu olan herkes okur" politikası
-- giriş yapmamış HERKESE, erişim kodu üretilmiş TÜM öğrencilerin adını, telefonunu,
-- veli telefonunu VE erişim kodlarını okutuyordu (anon key JS bundle'ında herkese açık).
-- Yani kodları okuyup istediği öğrencinin portalına girmek mümkündü. Ayrıca portalın
-- ihtiyacı olan weekly_tasks/mock_exams/attendance_records tabloları RLS ile koça bağlı
-- olduğundan bu politikayla bile portal boş görünüyordu. Yerine aşağıdaki RPC katmanı geldi.
drop policy if exists "students: erişim kodu olan herkes okur" on students;

-- =========================================================
-- Mobil Portal veri katmanı — SECURITY DEFINER RPC'ler (2026-07-30)
-- ---------------------------------------------------------
-- Öğrenci/veli giriş yapmış bir Supabase kullanıcısı DEĞİL; elindeki erişim kodu
-- bir "bearer token" gibi çalışıyor. Tabloları anon role'e açmak yerine, kodu
-- SUNUCUDA doğrulayan ve yalnız o öğrenciye ait veriyi döndüren fonksiyonlar
-- kullanılıyor. Böylece anon istemcinin students/weekly_tasks/mock_exams/
-- attendance_records üzerinde HİÇBİR doğrudan yetkisi yok.
--
-- Kural: her fonksiyon ilk iş olarak portal_resolve_code() ile kodu çözer;
-- çözemezse veri değil, Türkçe hata döndürür. Yazma fonksiyonları ayrıca
-- rolün 'ogrenci' olmasını şart koşar (veli salt-okunur).
-- =========================================================

-- Kodu öğrenciye + role çevirir. anon'a AÇILMAZ; yalnız aşağıdaki definer
-- fonksiyonlar (owner olarak çalıştıkları için) çağırabilir.
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
-- ⚠️ `from public` TEK BAŞINA YETMİYOR: Supabase, public şemasındaki fonksiyonlar için
-- anon/authenticated rollerine DOĞRUDAN execute veriyor (default privileges), bu da
-- PUBLIC üzerinden gelmediği için ayrıca revoke edilmeli. Canlıda ölçüldü.
-- Definer fonksiyonlar owner olarak çalıştığı için bunu yine de çağırabiliyor.
revoke all on function portal_resolve_code(text) from public, anon, authenticated;

-- Giriş: kodu doğrular, öğrencinin güvenli alanlarını döndürür.
-- Telefon numaraları ve DİĞER tarafın erişim kodu KASITLI olarak dönmez.
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

-- Portalın tüm okuma ihtiyacı tek çağrıda: öğrenci + haftalık görevler
-- (konu/ders adlarıyla) + son 20 deneme (bölüm netleriyle) + son 50 devamsızlık.
-- Görev haftası: bu hafta görev varsa bu hafta, yoksa görev bulunan EN SON hafta
-- (öğrenci boş ekran görmesin; hangi hafta olduğu week_start/is_current_week ile bildiriliyor).
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

-- Görevi tamamlandı/tamamlanmadı işaretle. Yalnız öğrenci rolü.
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

-- Öğrenci kendi denemesini bölüm netleriyle girer. Yalnız öğrenci rolü.
-- p_sections: [{"section_name":"Türkçe","max_questions":40,"correct_count":30,"wrong_count":4,"blank_count":6}, ...]
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

  -- doğru+yanlış+boş, soru sayısını aşmasın
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

