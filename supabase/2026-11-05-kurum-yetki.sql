-- 2026-11-05 · Kurum yetkisi: çok kurumlu davet ve hesabı olan kişiye davet.
-- Supabase SQL Editor'de BİR KEZ çalıştırın (tekrar çalıştırmak da güvenli).
-- İçerik supabase/schema.sql'deki ilgili bloklarla birebir aynı.
--  1) invitation_by_token: aynı e-postaya giden bütün bekleyen davetleri ('targets') döndürür.
--  2) accept_invitation_for_existing_user: hesabı zaten olan kişi davet edilince kuruma
--     anında eklenir (önceden davet sonsuza dek 'bekliyor'da kalıyordu).

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
       'role_name', r.name,
       -- Aynı e-postaya giden tüm bekleyen davetler: kayıt bunların hepsini birden
       -- kabul ediyor (claim_invitations), kişi hangi kurumlara girdiğini görsün.
       'targets', (
         select json_agg(json_build_object('institution_name', ins2.name, 'role_name', r2.name) order by ins2.name)
         from invitations i2
         join institutions ins2 on ins2.id = i2.institution_id
         join roles r2 on r2.id = i2.role_id
         where lower(btrim(i2.email)) = lower(btrim(i.email)) and i2.status = 'bekliyor'
       )
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

-- Hesabı ZATEN olan birine davet: claim_invitations yalnız yeni hesap açılırken
-- çalıştığı için bu davet sonsuza dek 'bekliyor'da kalıyordu (kayıt sayfası da
-- "e-posta kayıtlı" hatası veriyordu). Artık davet anında kuruma doğrudan eklenir.
-- Tetikleyici adı trg_check_invitation_… 'dan SONRA sıralanır (Postgres BEFORE
-- tetikleyicilerini ada göre çalıştırır): önce yetki denetimi, sonra kabul.
-- Üyelik insert'ini trg_check_membership_privilege_escalation da ayrıca denetler.
create or replace function accept_invitation_for_existing_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
begin
  if NEW.status <> 'bekliyor' then return NEW; end if;

  select u.id into v_uid
  from auth.users u
  where lower(btrim(u.email)) = lower(btrim(NEW.email))
  limit 1;
  if v_uid is null then return NEW; end if;

  insert into profiles (id, full_name, role)
  values (v_uid, split_part(NEW.email, '@', 1), 'Koç')
  on conflict (id) do nothing;

  insert into memberships (institution_id, user_id, role_id, is_active)
  values (NEW.institution_id, v_uid, NEW.role_id, true)
  on conflict (institution_id, user_id) do update set is_active = true, role_id = excluded.role_id;

  NEW.status := 'kabul';
  NEW.accepted_by := v_uid;
  NEW.accepted_at := now();
  return NEW;
end;
$$;
revoke all on function accept_invitation_for_existing_user() from public, anon, authenticated;

drop trigger if exists trg_invitation_auto_accept on invitations;
create trigger trg_invitation_auto_accept
  before insert on invitations
  for each row execute function accept_invitation_for_existing_user();
