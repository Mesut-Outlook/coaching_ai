-- Davet ve çok kurumlu üyelik testi (npm run verify:schema içinde koşar).
-- 1) Hesabı olan kişiye davet → davet anında kuruma eklenir ('kabul').
-- 2) Yeni kişiye iki kurumdan davet → kayıt olunca ikisine birden üye olur.
-- 3) Yetkisi olmayan kurum için davet → reddedilir, üyelik oluşmaz.

\set ON_ERROR_STOP on

do $$
declare
  v_x uuid; v_y uuid; v_z uuid;
  v_admin uuid := '33333333-3333-3333-3333-333333333331';
  v_old   uuid := '33333333-3333-3333-3333-333333333332';
  v_new   uuid := '33333333-3333-3333-3333-333333333333';
  v_yon uuid; v_per uuid;
  v_status text; v_token uuid; v_res json; v_n int;
begin
  insert into institutions (name, slug) values ('Davet X', 'davet-x'), ('Davet Y', 'davet-y'), ('Davet Z', 'davet-z')
    on conflict (slug) do nothing;
  select id into v_x from institutions where slug = 'davet-x';
  select id into v_y from institutions where slug = 'davet-y';
  select id into v_z from institutions where slug = 'davet-z';
  select id into v_yon from roles where key = 'kurum_yonetici' and institution_id is null;
  select id into v_per from roles where key = 'personel' and institution_id is null;

  insert into auth.users (id, email) values (v_admin, 'yonetici@test.local'), (v_old, 'eski@test.local')
    on conflict (id) do nothing;
  insert into memberships (institution_id, user_id, role_id) values
    (v_x, v_admin, v_yon), (v_y, v_admin, v_yon), (v_x, v_old, v_per)
    on conflict (institution_id, user_id) do nothing;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  -- 1) Hesabı olan kişi Y'ye davet edilir (büyük harf + boşluk da eşleşmeli).
  insert into invitations (institution_id, email, role_id, invited_by)
    values (v_y, '  ESKI@test.local ', v_per, v_admin)
    returning status into v_status;
  if v_status is distinct from 'kabul' then
    raise exception 'Mevcut kullanıcı daveti kabul edilmedi: %', v_status;
  end if;
  if not exists (select 1 from memberships where institution_id = v_y and user_id = v_old and is_active) then
    raise exception 'Mevcut kullanıcı Y kurumuna eklenmedi';
  end if;

  -- 2) Yeni kişi iki kuruma davet edilir, tek bağlantı ikisini de gösterir.
  insert into invitations (institution_id, email, role_id, invited_by)
    values (v_x, 'yeni@test.local', v_per, v_admin) returning token into v_token;
  insert into invitations (institution_id, email, role_id, invited_by)
    values (v_y, 'yeni@test.local', v_per, v_admin);
  v_res := invitation_by_token(v_token);
  if json_array_length(v_res->'targets') is distinct from 2 then
    raise exception 'invitation_by_token iki kurumu göstermiyor: %', v_res;
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  insert into auth.users (id, email) values (v_new, 'yeni@test.local') on conflict (id) do nothing;
  select count(*) into v_n from memberships where user_id = v_new and is_active;
  if v_n <> 2 then
    raise exception 'Yeni kullanıcı iki kuruma üye olmadı: %', v_n;
  end if;

  -- 3) Yönetici Z'de yetkili değil: davet reddedilmeli.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  begin
    insert into invitations (institution_id, email, role_id, invited_by)
      values (v_z, 'eski@test.local', v_per, v_admin);
    raise exception 'YETKİSİZ DAVET KABUL EDİLDİ';
  exception when others then
    if sqlerrm = 'YETKİSİZ DAVET KABUL EDİLDİ' then raise; end if;
  end;
  if exists (select 1 from memberships where institution_id = v_z and user_id = v_old) then
    raise exception 'Yetkisiz davet üyelik oluşturdu';
  end if;
  perform set_config('request.jwt.claim.sub', '', true);

  raise notice 'Davet testleri geçti.';
end;
$$;
