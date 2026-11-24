-- =====================================================================
--  Суфлёр — схема базы для Supabase.
--  Запускать целиком в Supabase → SQL Editor → New query → Run.
--  Скрипт можно запускать повторно: он ничего не удаляет из данных.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Таблицы ----------

create table if not exists public.templates (
  id          bigint generated always as identity primary key,
  keyword     text not null check (length(trim(keyword)) between 1 and 60),
  title       text not null check (length(trim(title)) between 1 and 200),
  body        text not null check (length(trim(body)) between 1 and 10000),
  link        text check (link is null or length(link) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Сокращения (kind = 'shortcut') и словарь опечаток (kind = 'typo') для корректора.
create table if not exists public.shortcuts (
  id          bigint generated always as identity primary key,
  kind        text not null default 'shortcut' check (kind in ('shortcut', 'typo')),
  short       text not null check (length(trim(short)) between 1 and 60),
  full_text   text not null check (length(trim(full_text)) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create unique index if not exists shortcuts_kind_short_uq on public.shortcuts (kind, lower(trim(short)));

-- Коды входа. Хранится только bcrypt-хеш, сам код в базе не лежит.
create table if not exists public.access_codes (
  id            bigint generated always as identity primary key,
  code_hash     text not null,
  role          text not null check (role in ('admin', 'owner')),
  max_sessions  int  not null default 1 check (max_sessions > 0),
  label         text not null default '',
  created_at    timestamptz not null default now()
);

-- Сессии. Токен тоже хранится только как sha256-хеш.
create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  code_id     bigint not null references public.access_codes(id) on delete cascade,
  token_hash  text not null unique,
  role        text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  ended_at    timestamptz,
  end_reason  text check (end_reason in ('logout', 'kicked'))   -- kicked = «выкинута владельцем»
);
create index if not exists sessions_active_idx on public.sessions (code_id) where ended_at is null;

-- Счётчик неверных попыток (защита от подбора кода).
create table if not exists public.login_attempts (
  key            text primary key,
  fails          int not null default 0,
  window_start   timestamptz not null default now(),
  blocked_until  timestamptz
);

-- ---------- Доступ: читать шаблоны и сокращения может кто угодно, менять напрямую — никто ----------

alter table public.templates      enable row level security;
alter table public.shortcuts      enable row level security;
alter table public.access_codes   enable row level security;
alter table public.sessions       enable row level security;
alter table public.login_attempts enable row level security;

drop policy if exists "templates are public" on public.templates;
create policy "templates are public" on public.templates for select to anon, authenticated using (true);

drop policy if exists "shortcuts are public" on public.shortcuts;
create policy "shortcuts are public" on public.shortcuts for select to anon, authenticated using (true);

-- Явно разрешаем чтение (в новых проектах Supabase доступ к таблицам сам не выдаётся)
grant usage on schema public to anon, authenticated;
grant select on public.templates, public.shortcuts to anon, authenticated;
revoke insert, update, delete, truncate on public.templates, public.shortcuts from anon, authenticated;
revoke all on public.access_codes, public.sessions, public.login_attempts from anon, authenticated;

-- ---------- Служебные функции (снаружи недоступны) ----------

create or replace function public._hash_token(p_token text)
returns text language sql immutable
set search_path = public, extensions
as $$ select encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') $$;

create or replace function public._client_ip()
returns text language sql stable
as $$
  select nullif(trim(split_part(
    coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''),
    ',', 1)), '')
$$;

-- Проверяет токен сессии. Бросает ошибку с понятным кодом, если сессия не годится.
create or replace function public._auth(p_token text, p_min_role text default 'admin')
returns public.sessions
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.sessions;
begin
  if coalesce(p_token, '') = '' then
    raise exception 'SESSION_INVALID';
  end if;
  select * into s from public.sessions where token_hash = public._hash_token(p_token);
  if not found then
    raise exception 'SESSION_INVALID';
  end if;
  if s.ended_at is not null then
    if s.end_reason = 'kicked' then raise exception 'SESSION_KICKED'; end if;
    raise exception 'SESSION_ENDED';
  end if;
  if s.expires_at <= now() then
    raise exception 'SESSION_EXPIRED';
  end if;
  if p_min_role = 'owner' and s.role <> 'owner' then
    raise exception 'FORBIDDEN';
  end if;
  return s;
end;
$$;

-- Добавить код. Вызывается только владельцем базы из SQL Editor, с сайта недоступна.
create or replace function public.add_access_code(p_code text, p_role text, p_max_sessions int default 1, p_label text default '')
returns bigint
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_id bigint;
begin
  if length(coalesce(p_code, '')) < 4 then
    raise exception 'Код должен быть не короче 4 символов';
  end if;
  insert into public.access_codes (code_hash, role, max_sessions, label)
  values (crypt(p_code, gen_salt('bf', 8)), p_role, p_max_sessions,
          coalesce(nullif(trim(p_label), ''), case p_role when 'owner' then 'Владелец' else 'Админ' end))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------- Вход, выход, проверка сессии ----------

create or replace function public.login(p_code text, p_device text default null)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_dev_key  text := 'dev:' || coalesce(nullif(left(trim(p_device), 64), ''), 'none');
  v_ip       text := public._client_ip();
  v_ip_key   text := 'ip:' || coalesce(public._client_ip(), 'unknown');
  a          public.login_attempts;
  c          public.access_codes;
  v_found    boolean := false;
  v_active   int;
  v_token    text;
  v_exp      timestamptz;
  v_sid      uuid;
begin
  -- Уборка: старые сессии и попытки.
  delete from public.sessions where coalesce(ended_at, expires_at) < now() - interval '30 days';
  delete from public.login_attempts
   where window_start < now() - interval '1 day' and coalesce(blocked_until, now()) <= now();

  -- Не заблокирован ли этот компьютер или вся сеть.
  select * into a from public.login_attempts
   where key in (v_dev_key, v_ip_key) and blocked_until > now()
   order by blocked_until desc limit 1;
  if found then
    return json_build_object('ok', false, 'error', 'blocked',
      'retry_in', ceil(extract(epoch from a.blocked_until - now())));
  end if;

  for c in select * from public.access_codes order by id loop
    if c.code_hash = crypt(coalesce(p_code, ''), c.code_hash) then
      v_found := true;
      exit;
    end if;
  end loop;

  if not v_found then
    -- 5 неверных попыток подряд с одного компьютера → минута блокировки.
    insert into public.login_attempts as la (key, fails, window_start)
    values (v_dev_key, 1, now())
    on conflict (key) do update set fails = la.fails + 1, window_start = now()
    returning * into a;
    if a.fails >= 5 then
      update public.login_attempts set fails = 0, blocked_until = now() + interval '1 minute'
       where key = v_dev_key;
    end if;
    -- Страховка от подбора с разных «компьютеров» из одной сети: 30 ошибок за 10 минут → 10 минут блокировки.
    if v_ip is not null then
      insert into public.login_attempts as la (key, fails, window_start)
      values (v_ip_key, 1, now())
      on conflict (key) do update set
        fails        = case when la.window_start < now() - interval '10 minutes' then 1 else la.fails + 1 end,
        window_start = case when la.window_start < now() - interval '10 minutes' then now() else la.window_start end
      returning fails into v_active;
      if v_active >= 30 then
        update public.login_attempts set fails = 0, window_start = now(), blocked_until = now() + interval '10 minutes'
         where key = v_ip_key;
      end if;
    end if;
    if a.fails >= 5 then
      return json_build_object('ok', false, 'error', 'blocked', 'retry_in', 60);
    end if;
    return json_build_object('ok', false, 'error', 'wrong', 'attempts_left', 5 - a.fails);
  end if;

  delete from public.login_attempts where key = v_dev_key;

  -- Лимит одновременных входов. Блокируем строку кода, чтобы два входа не проскочили одновременно.
  perform 1 from public.access_codes where id = c.id for update;
  select count(*) into v_active from public.sessions
   where code_id = c.id and ended_at is null and expires_at > now();
  if v_active >= c.max_sessions then
    return json_build_object('ok', false, 'error', 'busy');
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_exp   := now() + interval '9 hours';
  insert into public.sessions (code_id, token_hash, role, expires_at)
  values (c.id, public._hash_token(v_token), c.role, v_exp)
  returning id into v_sid;

  return json_build_object('ok', true, 'token', v_token, 'role', c.role,
    'expires_at', v_exp, 'session_id', v_sid);
end;
$$;

create or replace function public.logout(p_token text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  update public.sessions set ended_at = now(), end_reason = 'logout'
   where token_hash = public._hash_token(p_token) and ended_at is null;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.session_status(p_token text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.sessions;
begin
  select * into s from public.sessions where token_hash = public._hash_token(p_token);
  if not found then
    return json_build_object('ok', false, 'reason', 'invalid');
  end if;
  if s.ended_at is not null then
    return json_build_object('ok', false, 'reason', case when s.end_reason = 'kicked' then 'kicked' else 'ended' end);
  end if;
  if s.expires_at <= now() then
    return json_build_object('ok', false, 'reason', 'expired');
  end if;
  return json_build_object('ok', true, 'role', s.role, 'expires_at', s.expires_at, 'session_id', s.id);
end;
$$;

-- ---------- Шаблоны ----------

create or replace function public.template_save(
  p_token text, p_id bigint, p_keyword text, p_title text, p_body text, p_link text default null)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  t public.templates;
begin
  perform public._auth(p_token, 'admin');
  if coalesce(trim(p_keyword), '') = '' or coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'VALIDATION';
  end if;
  if p_id is null then
    insert into public.templates (keyword, title, body, link)
    values (trim(p_keyword), trim(p_title), trim(p_body), nullif(trim(coalesce(p_link, '')), ''))
    returning * into t;
  else
    update public.templates
       set keyword = trim(p_keyword), title = trim(p_title), body = trim(p_body),
           link = nullif(trim(coalesce(p_link, '')), ''), updated_at = now()
     where id = p_id
    returning * into t;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  return row_to_json(t);
end;
$$;

create or replace function public.template_delete(p_token text, p_id bigint)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  perform public._auth(p_token, 'admin');
  delete from public.templates where id = p_id;
  return json_build_object('ok', true);
end;
$$;

-- Первичная загрузка шаблонов одним импортом (только владелец).
-- p_items: [{"keyword": "...", "title": "...", "body": "...", "link": "..."}, ...]
create or replace function public.templates_import(p_token text, p_items jsonb, p_replace boolean default false)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_count int;
begin
  perform public._auth(p_token, 'owner');
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'VALIDATION';
  end if;
  if p_replace then
    delete from public.templates where id is not null;
  end if;
  insert into public.templates (keyword, title, body, link)
  select left(trim(x ->> 'keyword'), 60), left(trim(x ->> 'title'), 200), left(trim(x ->> 'body'), 10000),
         nullif(trim(coalesce(x ->> 'link', '')), '')
    from jsonb_array_elements(p_items) as x
   where coalesce(trim(x ->> 'keyword'), '') <> ''
     and coalesce(trim(x ->> 'title'), '') <> ''
     and coalesce(trim(x ->> 'body'), '') <> '';
  get diagnostics v_count = row_count;
  return json_build_object('inserted', v_count);
end;
$$;

-- ---------- Сокращения и словарь опечаток ----------

create or replace function public.shortcut_save(
  p_token text, p_id bigint, p_kind text, p_short text, p_full text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  r public.shortcuts;
begin
  perform public._auth(p_token, 'admin');
  if p_kind not in ('shortcut', 'typo') or coalesce(trim(p_short), '') = '' or coalesce(trim(p_full), '') = '' then
    raise exception 'VALIDATION';
  end if;
  begin
    if p_id is null then
      insert into public.shortcuts (kind, short, full_text)
      values (p_kind, lower(trim(p_short)), trim(p_full))
      returning * into r;
    else
      update public.shortcuts set kind = p_kind, short = lower(trim(p_short)), full_text = trim(p_full)
       where id = p_id
      returning * into r;
      if not found then raise exception 'NOT_FOUND'; end if;
    end if;
  exception when unique_violation then
    raise exception 'DUPLICATE';
  end;
  return row_to_json(r);
end;
$$;

create or replace function public.shortcut_delete(p_token text, p_id bigint)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  perform public._auth(p_token, 'admin');
  delete from public.shortcuts where id = p_id;
  return json_build_object('ok', true);
end;
$$;

-- ---------- Панель владельца ----------

create or replace function public.owner_sessions(p_token text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  me public.sessions;
begin
  me := public._auth(p_token, 'owner');
  return (
    select coalesce(json_agg(json_build_object(
             'id', s.id, 'code', c.label, 'role', s.role,
             'created_at', s.created_at, 'expires_at', s.expires_at,
             'is_me', s.id = me.id) order by s.created_at), '[]'::json)
      from public.sessions s
      join public.access_codes c on c.id = s.code_id
     where s.ended_at is null and s.expires_at > now()
  );
end;
$$;

create or replace function public.owner_kick(p_token text, p_session_id uuid)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  perform public._auth(p_token, 'owner');
  update public.sessions set ended_at = now(), end_reason = 'kicked'
   where id = p_session_id and ended_at is null;
  return json_build_object('ok', true);
end;
$$;

-- ---------- Права на функции ----------
-- Служебные функции закрыты; сайту доступны только «публичные» ручки.

revoke execute on function public._hash_token(text)              from public, anon, authenticated;
revoke execute on function public._client_ip()                   from public, anon, authenticated;
revoke execute on function public._auth(text, text)              from public, anon, authenticated;
revoke execute on function public.add_access_code(text, text, int, text) from public, anon, authenticated;

grant execute on function public.login(text, text)                                   to anon, authenticated;
grant execute on function public.logout(text)                                        to anon, authenticated;
grant execute on function public.session_status(text)                                to anon, authenticated;
grant execute on function public.template_save(text, bigint, text, text, text, text) to anon, authenticated;
grant execute on function public.template_delete(text, bigint)                       to anon, authenticated;
grant execute on function public.templates_import(text, jsonb, boolean)              to anon, authenticated;
grant execute on function public.shortcut_save(text, bigint, text, text, text)       to anon, authenticated;
grant execute on function public.shortcut_delete(text, bigint)                       to anon, authenticated;
grant execute on function public.owner_sessions(text)                                to anon, authenticated;
grant execute on function public.owner_kick(text, uuid)                              to anon, authenticated;
