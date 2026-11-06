-- Supabase SQL Editor'de çalıştırın (idempotent; schema.sql'in ilgili parçası).
-- ---------------------------------------------------------------------------
-- Üye yönetimi: e-posta/onay/son giriş bilgisi ve kurumdan çıkarma (2026-11-06)
-- ---------------------------------------------------------------------------
-- profiles'ta e-posta yok; yönetici, kendi kurumundaki üyelerin e-postasını, e-posta
-- onayını ve son girişini auth.users'tan bu fonksiyonla okur. Çift hesap (aynı isim)
-- ve "giremiyorum" şikâyetleri ancak bunlarla ayırt edilebiliyor.
create or replace function member_auth_info(p_institution uuid)
returns table (user_id uuid, email text, email_confirmed_at timestamptz, last_sign_in_at timestamptz)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select u.id, u.email::text, u.email_confirmed_at, u.last_sign_in_at
  from memberships m
  join auth.users u on u.id = m.user_id
  where m.institution_id = p_institution
    and has_permission(p_institution, 'members.manage');
$$;
revoke all on function member_auth_info(uuid) from public, anon, authenticated;
grant execute on function member_auth_info(uuid) to authenticated;

-- Kişiyi kurumdan çıkarır: yalnız üyelik silinir. Hesap SİLİNMEZ — students.coach_id
-- auth.users'a "on delete cascade" bağlı, hesap silmek o kişinin eklediği bütün
-- öğrencileri de siler. Hata durumunda { ok:false, error } döner, hiçbir şey silinmez.
create or replace function remove_member(p_membership uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_m memberships%rowtype;
  v_target_perms text[];
  v_caller_perms text[];
  v_n int;
begin
  select * into v_m from memberships where id = p_membership;
  if not found then
    return json_build_object('ok', false, 'error', 'Üyelik bulunamadı.');
  end if;
  if auth.uid() is null or not has_permission(v_m.institution_id, 'members.manage') then
    return json_build_object('ok', false, 'error', 'Bu kurumda üye yönetimi izniniz yok.');
  end if;
  if v_m.user_id = auth.uid() then
    return json_build_object('ok', false, 'error', 'Kendinizi kurumdan çıkaramazsınız.');
  end if;

  select permissions into v_target_perms from roles where id = v_m.role_id;

  -- Yetki yükseltme kuralının aynısı: kendinden geniş yetkili birini çıkaramazsın.
  if not is_system_admin() then
    select array_agg(distinct p) into v_caller_perms
    from memberships m
    join roles r on r.id = m.role_id
    cross join unnest(r.permissions) as p
    where m.user_id = auth.uid() and m.institution_id = v_m.institution_id and m.is_active;
    if not (coalesce(v_target_perms, '{}') <@ coalesce(v_caller_perms, '{}')) then
      return json_build_object('ok', false, 'error', 'Sizden daha geniş yetkili birini çıkaramazsınız.');
    end if;
  end if;

  -- Kurum yöneticisiz kalmasın.
  if 'members.manage' = any(coalesce(v_target_perms, '{}')) then
    select count(*) into v_n
    from memberships m
    join roles r on r.id = m.role_id
    where m.institution_id = v_m.institution_id and m.id <> v_m.id and m.is_active
      and 'members.manage' = any(r.permissions);
    if v_n = 0 then
      return json_build_object('ok', false, 'error', 'Kurumun son yöneticisi çıkarılamaz.');
    end if;
  end if;

  -- Özel koçluğunu yaptığı öğrenciler başka kimseye açılmaz (koçluk kilidi).
  select count(*) into v_n
  from students s
  where s.institution_id = v_m.institution_id and s.coaching_coach_id = v_m.user_id;
  if v_n > 0 then
    return json_build_object('ok', false, 'students', v_n, 'error',
      format('Bu kişi bu kurumda %s öğrencinin özel koçu. Önce o öğrencilerde "özel koçluk" işaretini kaldırın.', v_n));
  end if;

  delete from memberships where id = p_membership;
  return json_build_object('ok', true);
end;
$$;
revoke all on function remove_member(uuid) from public, anon, authenticated;
grant execute on function remove_member(uuid) to authenticated;
