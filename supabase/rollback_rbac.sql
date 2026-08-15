-- Netlik (Coching_AI) — RBAC Rollback Scripti
-- Bu script RBAC şeması öncesindeki sade RLS politıkalarına ve yapısına geri döner.

-- 1. Trigger ve Fonksiyonların Temizlenmesi
drop trigger if exists on_auth_user_created_claim_invitations on auth.users;
drop trigger if exists trg_prevent_system_admin_escalation on profiles;
drop trigger if exists trg_check_membership_privilege_escalation on memberships;
drop trigger if exists trg_check_invitation_privilege_escalation on invitations;
drop trigger if exists trg_check_role_privilege_escalation on roles;

drop function if exists claim_invitations();
drop function if exists prevent_system_admin_escalation();
drop function if exists check_membership_privilege_escalation();
drop function if exists check_invitation_privilege_escalation();
drop function if exists check_role_privilege_escalation();

drop function if exists is_system_admin();
drop function if exists my_institution_ids();
drop function if exists has_permission(uuid, text);
drop function if exists user_has_any_permission(text);
drop function if exists student_permission(uuid, text);
drop function if exists can_access_coaching(uuid, text);
drop function if exists exam_student_id(uuid);
drop function if exists my_access();

-- 2. Eski Politikaların Geri Yüklenmesi

-- Profiles
drop policy if exists "profiles: okuma yetkisi" on profiles;
drop policy if exists "profiles: güncelleme yetkisi" on profiles;
drop policy if exists "profiles: kendi profilini okur/günceller" on profiles;
create policy "profiles: kendi profilini okur/günceller" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Students
drop policy if exists "students: okuma yetkisi" on students;
drop policy if exists "students: ekleme yetkisi" on students;
drop policy if exists "students: güncelleme yetkisi" on students;
drop policy if exists "students: silme yetkisi" on students;
drop policy if exists "students: koç kendi öğrencilerini yönetir" on students;
create policy "students: koç kendi öğrencilerini yönetir" on students
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- Subjects & Topics
drop policy if exists "subjects: yetkili koç ekler" on subjects;
drop policy if exists "subjects: yetkili koç günceller" on subjects;
drop policy if exists "subjects: giriş yapan koç ekler" on subjects;
drop policy if exists "subjects: giriş yapan koç günceller" on subjects;
create policy "subjects: giriş yapan koç ekler" on subjects for insert with check (auth.uid() is not null);
create policy "subjects: giriş yapan koç günceller" on subjects for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "topics: yetkili koç ekler" on topics;
drop policy if exists "topics: yetkili koç günceller" on topics;
drop policy if exists "topics: giriş yapan koç ekler" on topics;
drop policy if exists "topics: giriş yapan koç günceller" on topics;
create policy "topics: giriş yapan koç ekler" on topics for insert with check (auth.uid() is not null);
create policy "topics: giriş yapan koç günceller" on topics for update using (auth.uid() is not null) with check (auth.uid() is not null);

-- Topic Measurements
drop policy if exists "topic_measurements: okuma yetkisi" on topic_measurements;
drop policy if exists "topic_measurements: yönetim yetkisi" on topic_measurements;
drop policy if exists "topic_measurements: öğrenci sahibi koç yönetir" on topic_measurements;
create policy "topic_measurements: öğrenci sahibi koç yönetir" on topic_measurements
  for all using (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()))
  with check (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()));

-- Coach Decisions
drop policy if exists "coach_decisions: okuma yetkisi" on coach_decisions;
drop policy if exists "coach_decisions: yönetim yetkisi" on coach_decisions;
drop policy if exists "coach_decisions: öğrenci sahibi koç yönetir" on coach_decisions;
create policy "coach_decisions: öğrenci sahibi koç yönetir" on coach_decisions
  for all using (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()))
  with check (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()));

-- Mock Exams
drop policy if exists "mock_exams: okuma yetkisi" on mock_exams;
drop policy if exists "mock_exams: yönetim yetkisi" on mock_exams;
drop policy if exists "mock_exams: öğrenci sahibi koç yönetir" on mock_exams;
create policy "mock_exams: öğrenci sahibi koç yönetir" on mock_exams
  for all using (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()))
  with check (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()));

-- Mock Exam Sections
drop policy if exists "mock_exam_sections: okuma yetkisi" on mock_exam_sections;
drop policy if exists "mock_exam_sections: yönetim yetkisi" on mock_exam_sections;
drop policy if exists "mock_exam_sections: öğrenci sahibi koç yönetir" on mock_exam_sections;
create policy "mock_exam_sections: öğrenci sahibi koç yönetir" on mock_exam_sections
  for all using (exists (
    select 1 from mock_exams e join students s on s.id = e.student_id
    where e.id = mock_exam_id and s.coach_id = auth.uid()
  )) with check (exists (
    select 1 from mock_exams e join students s on s.id = e.student_id
    where e.id = mock_exam_id and s.coach_id = auth.uid()
  ));

-- Error Basket Items
drop policy if exists "error_basket_items: okuma yetkisi" on error_basket_items;
drop policy if exists "error_basket_items: yönetim yetkisi" on error_basket_items;
drop policy if exists "error_basket_items: öğrenci sahibi koç yönetir" on error_basket_items;
create policy "error_basket_items: öğrenci sahibi koç yönetir" on error_basket_items
  for all using (exists (
    select 1 from mock_exams e join students s on s.id = e.student_id
    where e.id = mock_exam_id and s.coach_id = auth.uid()
  )) with check (exists (
    select 1 from mock_exams e join students s on s.id = e.student_id
    where e.id = mock_exam_id and s.coach_id = auth.uid()
  ));

-- Weekly Tasks
drop policy if exists "weekly_tasks: okuma yetkisi" on weekly_tasks;
drop policy if exists "weekly_tasks: yönetim yetkisi" on weekly_tasks;
drop policy if exists "weekly_tasks: öğrenci sahibi koç yönetir" on weekly_tasks;
create policy "weekly_tasks: öğrenci sahibi koç yönetir" on weekly_tasks
  for all using (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()))
  with check (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()));

-- Attendance Records
drop policy if exists "attendance_records: okuma yetkisi" on attendance_records;
drop policy if exists "attendance_records: yönetim yetkisi" on attendance_records;
drop policy if exists "attendance_records: öğrenci sahibi koç yönetir" on attendance_records;
create policy "attendance_records: öğrenci sahibi koç yönetir" on attendance_records
  for all using (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()))
  with check (exists (select 1 from students s where s.id = student_id and s.coach_id = auth.uid()));

-- Storage Objects
drop policy if exists "Koçlar fotoğraf yükleyebilir" on storage.objects;
create policy "Koçlar fotoğraf yükleyebilir" on storage.objects
  for insert with check (bucket_id = 'student-photos' and auth.role() = 'authenticated');

drop policy if exists "Koçlar fotoğraf güncelleyebilir" on storage.objects;
create policy "Koçlar fotoğraf güncelleyebilir" on storage.objects
  for update using (bucket_id = 'student-photos' and auth.role() = 'authenticated')
  with check (bucket_id = 'student-photos' and auth.role() = 'authenticated');

drop policy if exists "Koçlar fotoğraf silebilir" on storage.objects;
create policy "Koçlar fotoğraf silebilir" on storage.objects
  for delete using (bucket_id = 'student-photos' and auth.role() = 'authenticated');

-- 3. RBAC Tablolarının Silinmesi (İhtiyaç duyulursa)
drop table if exists invitations;
drop table if exists memberships;
drop table if exists roles;
drop table if exists permission_catalog;
drop table if exists institutions;
