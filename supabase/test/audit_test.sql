-- Denetim kaydının (audit_log) işlevsel testi.
-- schema.sql + stub.sql uygulanmış boş bir veritabanında çalışır.
-- Amaç: trigger'ın gerçekten yazdığını, gürültüyü elediğini ve erişim kodlarını
-- maskelediğini kanıtlamak. Şemanın "uygulanıyor olması" bunu göstermez.

\set ON_ERROR_STOP on

do $$
declare
  v_inst uuid;
  v_coach uuid := '11111111-1111-1111-1111-111111111111';
  v_student uuid;
  v_task uuid;
  v_n bigint;
  v_json jsonb;
begin
  -- Hazırlık: kurum + koç + öğrenci
  insert into institutions (name, slug) values ('Test Kurumu', 'test-kurumu')
    on conflict (slug) do nothing;
  select id into v_inst from institutions where slug = 'test-kurumu';

  insert into auth.users (id, email) values (v_coach, 'kocluk@test.local')
    on conflict (id) do nothing;
  insert into profiles (id, full_name, role) values (v_coach, 'Test Koç', 'Koç')
    on conflict (id) do nothing;

  delete from audit_log;

  -- 1) INSERT loglanıyor mu?
  insert into students (coach_id, institution_id, full_name, grade, track,
                        student_access_code, parent_access_code)
  values (v_coach, v_inst, 'Denek Öğrenci', '12. Sınıf', 'SAY', 'STU-GIZLI1', 'PAR-GIZLI2')
  returning id into v_student;

  select count(*) into v_n from audit_log
   where table_name = 'students' and action = 'insert';
  if v_n <> 1 then raise exception 'TEST 1 BAŞARISIZ: insert loglanmadı (% kayıt)', v_n; end if;

  -- 2) Erişim kodları maskelendi mi?
  select new_row into v_json from audit_log
   where table_name = 'students' and action = 'insert';
  if v_json->>'student_access_code' <> '***' or v_json->>'parent_access_code' <> '***' then
    raise exception 'TEST 2 BAŞARISIZ: erişim kodu maskelenmemiş: %', v_json->>'student_access_code';
  end if;

  -- 3) Bağlam (kurum + öğrenci) yazma anında çözülmüş mü?
  select count(*) into v_n from audit_log
   where table_name = 'students' and institution_id = v_inst and student_id = v_student;
  if v_n <> 1 then raise exception 'TEST 3 BAŞARISIZ: kurum/öğrenci bağlamı çözülmemiş'; end if;

  -- 4) Değişmeyen UPDATE loglanmamalı
  delete from audit_log;
  update students set full_name = 'Denek Öğrenci' where id = v_student;
  select count(*) into v_n from audit_log;
  if v_n <> 0 then raise exception 'TEST 4 BAŞARISIZ: değişmeyen güncelleme loglandı (% kayıt)', v_n; end if;

  -- 5) Gerçek UPDATE eski+yeni ile loglanmalı
  update students set full_name = 'Yeni Ad' where id = v_student;
  select count(*) into v_n from audit_log where action = 'update';
  if v_n <> 1 then raise exception 'TEST 5 BAŞARISIZ: güncelleme loglanmadı'; end if;
  if (select old_row->>'full_name' from audit_log where action='update') <> 'Denek Öğrenci' then
    raise exception 'TEST 5b BAŞARISIZ: eski değer saklanmamış';
  end if;

  -- 6) weekly_tasks: yalnız "completed" değişimi loglanmamalı
  insert into weekly_tasks (student_id, week_start, day_index, custom_label)
  values (v_student, current_date, 0, 'Test görevi') returning id into v_task;
  delete from audit_log;
  update weekly_tasks set completed = true where id = v_task;
  select count(*) into v_n from audit_log;
  if v_n <> 0 then raise exception 'TEST 6 BAŞARISIZ: completed değişimi loglandı (gürültü)'; end if;

  -- 7) weekly_tasks: başka bir alan değişirse loglanmalı
  update weekly_tasks set custom_label = 'Değişti' where id = v_task;
  select count(*) into v_n from audit_log where table_name = 'weekly_tasks';
  if v_n <> 1 then raise exception 'TEST 7 BAŞARISIZ: anlamlı görev değişimi loglanmadı'; end if;

  -- 8) DELETE loglanmalı ve eski satır saklanmalı
  delete from audit_log;
  delete from weekly_tasks where id = v_task;
  select count(*) into v_n from audit_log
   where table_name = 'weekly_tasks' and action = 'delete' and old_row is not null;
  if v_n <> 1 then raise exception 'TEST 8 BAŞARISIZ: silme loglanmadı'; end if;

  -- 9) Aktör: oturum yoksa 'sistem' damgası
  select count(*) into v_n from audit_log where actor_label = 'sistem';
  if v_n = 0 then raise exception 'TEST 9 BAŞARISIZ: service-role yazımı sistem olarak damgalanmadı'; end if;

  -- 10) app.actor ayarlanınca ona uyulmalı (portal RPC'lerinin kullandığı yol)
  delete from audit_log;
  perform set_config('app.actor', 'ogrenci:' || v_student, true);
  update students set target_program = 'Tıp' where id = v_student;
  if (select actor_label from audit_log limit 1) <> 'ogrenci:' || v_student then
    raise exception 'TEST 10 BAŞARISIZ: app.actor dikkate alınmadı: %',
      (select actor_label from audit_log limit 1);
  end if;
  perform set_config('app.actor', '', true);

  raise notice '✅ Denetim kaydı testleri geçti (10/10)';
end $$;
