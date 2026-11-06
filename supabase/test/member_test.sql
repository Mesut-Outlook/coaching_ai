-- Üye yönetimi testi (npm run verify:schema içinde koşar).
-- member_auth_info: yalnız members.manage olan görür.
-- remove_member: kendini / son yöneticiyi / özel koçluğu olanı çıkarmaz; yetkisiz çağrıyı reddeder.

\set ON_ERROR_STOP on

do $$
declare
  v_i uuid; v_yon uuid; v_per uuid;
  v_a1 uuid := '44444444-4444-4444-4444-444444444441';
  v_a2 uuid := '44444444-4444-4444-4444-444444444442';
  v_p  uuid := '44444444-4444-4444-4444-444444444443';
  v_c  uuid := '44444444-4444-4444-4444-444444444444';
  v_s  uuid := '44444444-4444-4444-4444-444444444445';
  v_res json; v_n int; v_mid uuid;
begin
  insert into institutions (name, slug) values ('Uye I', 'uye-i') on conflict (slug) do nothing;
  select id into v_i from institutions where slug = 'uye-i';
  select id into v_yon from roles where key = 'kurum_yonetici' and institution_id is null;
  select id into v_per from roles where key = 'personel' and institution_id is null;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_a1, 'a1@test.local', now()), (v_a2, 'a2@test.local', null), (v_p, 'p@test.local', now()),
    (v_c, 'c@test.local', now()), (v_s, 's@test.local', now())
    on conflict (id) do nothing;
  insert into profiles (id, full_name) values (v_s, 'Sistem') on conflict (id) do nothing;
  update profiles set is_system_admin = true where id = v_s;
  insert into memberships (institution_id, user_id, role_id) values
    (v_i, v_a1, v_yon), (v_i, v_a2, v_yon), (v_i, v_p, v_per), (v_i, v_c, v_per)
    on conflict (institution_id, user_id) do nothing;
  insert into students (coach_id, institution_id, coaching_coach_id, full_name, grade, track)
    values (v_c, v_i, v_c, 'Uye Test Ogrenci', '12. Sınıf', 'SAY');

  -- member_auth_info
  perform set_config('request.jwt.claim.sub', v_a1::text, true);
  select count(*) into v_n from member_auth_info(v_i);
  if v_n <> 4 then raise exception 'Yönetici 4 üye görmeli, gördü: %', v_n; end if;
  if (select email_confirmed_at from member_auth_info(v_i) where user_id = v_a2) is not null then
    raise exception 'Onaysız hesap onaylı görünüyor';
  end if;
  perform set_config('request.jwt.claim.sub', v_p::text, true);
  select count(*) into v_n from member_auth_info(v_i);
  if v_n <> 0 then raise exception 'Personel e-postaları görmemeli, gördü: %', v_n; end if;

  -- Personel kimseyi çıkaramaz
  select id into v_mid from memberships where institution_id = v_i and user_id = v_c;
  v_res := remove_member(v_mid);
  if (v_res->>'ok')::boolean then raise exception 'Yetkisiz çıkarma kabul edildi'; end if;

  -- Yönetici kendini çıkaramaz
  perform set_config('request.jwt.claim.sub', v_a1::text, true);
  v_res := remove_member((select id from memberships where institution_id = v_i and user_id = v_a1));
  if (v_res->>'ok')::boolean then raise exception 'Kendini çıkarma kabul edildi'; end if;

  -- Özel koçluğu olan çıkarılamaz; işaret kalkınca çıkarılır
  v_res := remove_member(v_mid);
  if (v_res->>'ok')::boolean or (v_res->>'students')::int <> 1 then
    raise exception 'Özel koçluğu olan çıkarıldı / sayı yanlış: %', v_res;
  end if;
  update students set coaching_coach_id = null where institution_id = v_i;
  v_res := remove_member(v_mid);
  if not (v_res->>'ok')::boolean then raise exception 'Çıkarma başarısız: %', v_res; end if;
  if exists (select 1 from memberships where id = v_mid) then raise exception 'Üyelik silinmedi'; end if;
  if not exists (select 1 from auth.users where id = v_c) then raise exception 'Hesap silinmiş!'; end if;
  if not exists (select 1 from students where institution_id = v_i) then raise exception 'Öğrenci silinmiş!'; end if;

  -- Diğer yönetici çıkarılabilir; ardından son yönetici (sistem yöneticisi bile) çıkaramaz
  v_res := remove_member((select id from memberships where institution_id = v_i and user_id = v_a2));
  if not (v_res->>'ok')::boolean then raise exception 'İkinci yönetici çıkarılamadı: %', v_res; end if;
  perform set_config('request.jwt.claim.sub', v_s::text, true);
  v_res := remove_member((select id from memberships where institution_id = v_i and user_id = v_a1));
  if (v_res->>'ok')::boolean then raise exception 'Son yönetici çıkarıldı'; end if;
  perform set_config('request.jwt.claim.sub', '', true);

  raise notice 'Üye yönetimi testleri geçti.';
end;
$$;
