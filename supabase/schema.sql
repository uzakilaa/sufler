-- =====================================================================
--  Суфлёр — схема базы для Supabase.
--  Запускать целиком в Supabase → SQL Editor → New query → Run.
--  Скрипт можно запускать повторно: он ничего не удаляет из данных.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Таблицы ----------

create table if not exists public.templates (
  id          bigint generated always as identity primary key,
  keyword     text not null,                     -- ключевые слова через запятую
  title       text not null check (length(trim(title)) between 1 and 200),
  category    text,                              -- тема: «Кредиты», «Контакты»…
  body        text not null check (length(trim(body)) between 1 and 10000),
  body_kz     text,                              -- текст на казахском (необязательно)
  link        text check (link is null or length(link) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Обновление базы, созданной первой версией скрипта: тема, казахский текст, длинный список ключей.
alter table public.templates add column if not exists category text;
alter table public.templates add column if not exists body_kz  text;
alter table public.templates drop constraint if exists templates_keyword_check;
alter table public.templates drop constraint if exists templates_keyword_len;
alter table public.templates add constraint templates_keyword_len check (length(trim(keyword)) between 1 and 300);
alter table public.templates drop constraint if exists templates_category_len;
alter table public.templates add constraint templates_category_len check (category is null or length(category) <= 60);
alter table public.templates drop constraint if exists templates_body_kz_len;
alter table public.templates add constraint templates_body_kz_len check (body_kz is null or length(body_kz) <= 10000);

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
-- _auth — ниже, в блоке «Имя человека в сессии».

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

-- template_save — ниже, в блоке «Предупреждение и скриншот у шаблона» (ему нужен журнал).

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
-- p_items: [{"keyword": "...", "title": "...", "category": "...", "body": "...", "body_kz": "...", "link": "..."}, ...]
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
  insert into public.templates (keyword, title, category, body, body_kz, link, notice)
  select left(trim(x ->> 'keyword'), 300), left(trim(x ->> 'title'), 200),
         nullif(left(trim(coalesce(x ->> 'category', '')), 60), ''),
         left(trim(x ->> 'body'), 10000),
         nullif(left(trim(coalesce(x ->> 'body_kz', '')), 10000), ''),
         nullif(trim(coalesce(x ->> 'link', '')), ''),
         nullif(left(trim(coalesce(x ->> 'notice', '')), 1000), '')
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

-- owner_sessions — ниже, в блоке «Имя человека в сессии».

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

-- ---------- Объявления, предложения шаблонов, журнал изменений ----------

-- Объявление о массовом сбое: видно всем на сайте до expires_at (от 1 до 48 часов).
create table if not exists public.announcements (
  id          bigint generated always as identity primary key,
  body        text not null check (length(trim(body)) between 1 and 1000),
  author      text not null default '',
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  ended_at    timestamptz,
  ended_by    text
);

-- Предложения от операторов: новый шаблон (new) или правка существующего (fix).
create table if not exists public.suggestions (
  id           bigint generated always as identity primary key,
  kind         text not null check (kind in ('new', 'fix')),
  template_id  bigint references public.templates(id) on delete set null,
  keyword      text check (keyword is null or length(keyword) <= 300),
  title        text check (title is null or length(title) <= 200),
  category     text check (category is null or length(category) <= 60),
  body         text not null check (length(trim(body)) between 1 and 10000),
  note         text check (note is null or length(note) <= 1000),
  author       text not null default '' check (length(author) <= 60),
  ip_hash      text,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   text
);
create index if not exists suggestions_status_idx on public.suggestions (status, created_at desc);

-- Журнал: кто и что менял. Видит только владелец.
create table if not exists public.journal (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  actor    text not null,
  action   text not null,
  details  text not null default ''
);
create index if not exists journal_at_idx on public.journal (at desc);

alter table public.announcements enable row level security;
alter table public.suggestions   enable row level security;
alter table public.journal       enable row level security;
revoke all on public.announcements, public.suggestions, public.journal from anon, authenticated;

-- Кто сейчас действует: метку кода ставит _auth на время запроса.
create or replace function public._actor()
returns text language sql stable
as $$ select coalesce(nullif(current_setting('sufler.actor', true), ''), 'база (SQL)') $$;

create or replace function public._log(p_action text, p_details text default '')
returns void language sql security definer
set search_path = public, extensions
as $$ insert into public.journal (actor, action, details) values (public._actor(), p_action, left(coalesce(p_details, ''), 500)) $$;

-- Изменения шаблонов и словаря пишутся в журнал автоматически
create or replace function public._journal_templates()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if tg_op = 'INSERT' then
    perform public._log('Шаблон добавлен', new.title || ' · ' || split_part(new.keyword, ',', 1));
  elsif tg_op = 'UPDATE' then
    perform public._log('Шаблон изменён', new.title || ' · ' || split_part(new.keyword, ',', 1));
  else
    perform public._log('Шаблон удалён', old.title || ' · ' || split_part(old.keyword, ',', 1));
  end if;
  return null;
end;
$$;
drop trigger if exists templates_journal on public.templates;
create trigger templates_journal after insert or update or delete on public.templates
  for each row execute function public._journal_templates();

create or replace function public._journal_shortcuts()
returns trigger language plpgsql security definer
set search_path = public, extensions
as $$
declare
  w text := case coalesce(new.kind, old.kind) when 'typo' then 'Словарь опечаток' else 'Сокращения' end;
begin
  if tg_op = 'INSERT' then
    perform public._log(w || ': добавлено', new.short || ' → ' || new.full_text);
  elsif tg_op = 'UPDATE' then
    perform public._log(w || ': изменено', new.short || ' → ' || new.full_text);
  else
    perform public._log(w || ': удалено', old.short || ' → ' || old.full_text);
  end if;
  return null;
end;
$$;
drop trigger if exists shortcuts_journal on public.shortcuts;
create trigger shortcuts_journal after insert or update or delete on public.shortcuts
  for each row execute function public._journal_shortcuts();

-- Объявления: читать может кто угодно (только действующие)
-- announcements_active — ниже, в блоке «Имена кодов видит только владелец».

create or replace function public.announce_create(p_token text, p_body text, p_hours int)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  a public.announcements;
begin
  perform public._auth(p_token, 'admin');
  if coalesce(trim(p_body), '') = '' or length(p_body) > 1000 or p_hours is null or p_hours < 1 or p_hours > 48 then
    raise exception 'VALIDATION';
  end if;
  insert into public.announcements (body, author, expires_at)
  values (trim(p_body), public._actor(), now() + make_interval(hours => p_hours))
  returning * into a;
  perform public._log('Объявление', trim(p_body) || ' · на ' || p_hours || ' ч');
  return row_to_json(a);
end;
$$;

create or replace function public.announce_end(p_token text, p_id bigint)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  a public.announcements;
begin
  perform public._auth(p_token, 'admin');
  update public.announcements set ended_at = now(), ended_by = public._actor()
   where id = p_id and ended_at is null
  returning * into a;
  if found then perform public._log('Объявление снято', a.body); end if;
  return json_build_object('ok', true);
end;
$$;

-- Предложение шаблона: может отправить кто угодно (с ограничением частоты)
create or replace function public.suggestion_create(
  p_kind text, p_template_id bigint, p_keyword text, p_title text, p_category text,
  p_body text, p_note text, p_author text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_ip text := encode(digest(coalesce(public._client_ip(), 'unknown'), 'sha256'), 'hex');
  v_author text := left(trim(coalesce(p_author, '')), 60);
  sg public.suggestions;
begin
  if p_kind not in ('new', 'fix') or coalesce(trim(p_body), '') = '' then
    raise exception 'VALIDATION';
  end if;
  if p_kind = 'new' and (coalesce(trim(p_keyword), '') = '' or coalesce(trim(p_title), '') = '') then
    raise exception 'VALIDATION';
  end if;
  if p_kind = 'fix' and not exists (select 1 from public.templates where id = p_template_id) then
    raise exception 'NOT_FOUND';
  end if;
  if (select count(*) from public.suggestions where ip_hash = v_ip and created_at > now() - interval '1 hour') >= 20
     or (select count(*) from public.suggestions where created_at > now() - interval '1 day') >= 500 then
    raise exception 'TOO_MANY';
  end if;
  insert into public.suggestions (kind, template_id, keyword, title, category, body, note, author, ip_hash)
  values (p_kind, case when p_kind = 'fix' then p_template_id end,
          nullif(left(trim(coalesce(p_keyword, '')), 300), ''), nullif(left(trim(coalesce(p_title, '')), 200), ''),
          nullif(left(trim(coalesce(p_category, '')), 60), ''), left(trim(p_body), 10000),
          nullif(left(trim(coalesce(p_note, '')), 1000), ''), v_author, v_ip)
  returning * into sg;
  perform set_config('sufler.actor', coalesce(nullif(v_author, ''), 'оператор'), true);
  perform public._log(case p_kind when 'new' then 'Предложен шаблон' else 'Предложена правка' end,
    coalesce(sg.title, (select title from public.templates where id = sg.template_id), '') ||
    coalesce(' · «' || left(sg.note, 120) || '»', ''));
  return json_build_object('ok', true, 'id', sg.id);
end;
$$;

-- suggestions_list — ниже, в блоке «Имена кодов видит только владелец».

-- Решение по предложению. Принять = добавить шаблон (или применить правку) с полями, которые видит админ.
create or replace function public.suggestion_decide(
  p_token text, p_id bigint, p_accept boolean,
  p_keyword text default null, p_title text default null, p_category text default null,
  p_body text default null, p_body_kz text default null, p_link text default null)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  sg public.suggestions;
  t public.templates;
begin
  perform public._auth(p_token, 'admin');
  select * into sg from public.suggestions where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if sg.status <> 'pending' then raise exception 'DUPLICATE'; end if;
  if p_accept then
    if coalesce(trim(p_keyword), '') = '' or coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
      raise exception 'VALIDATION';
    end if;
    if coalesce(trim(p_body_kz), '') = '' then
      raise exception 'NEED_KZ';
    end if;
    if sg.kind = 'fix' and exists (select 1 from public.templates where id = sg.template_id) then
      update public.templates
         set keyword = left(trim(p_keyword), 300), title = left(trim(p_title), 200),
             category = nullif(left(trim(coalesce(p_category, '')), 60), ''), body = trim(p_body),
             body_kz = nullif(trim(coalesce(p_body_kz, '')), ''), link = nullif(trim(coalesce(p_link, '')), ''),
             updated_at = now()
       where id = sg.template_id
      returning * into t;
    else
      insert into public.templates (keyword, title, category, body, body_kz, link)
      values (left(trim(p_keyword), 300), left(trim(p_title), 200), nullif(left(trim(coalesce(p_category, '')), 60), ''),
              trim(p_body), nullif(trim(coalesce(p_body_kz, '')), ''), nullif(trim(coalesce(p_link, '')), ''))
      returning * into t;
    end if;
  end if;
  update public.suggestions
     set status = case when p_accept then 'accepted' else 'rejected' end, decided_at = now(), decided_by = public._actor()
   where id = p_id;
  perform public._log(case when p_accept then 'Предложение принято' else 'Предложение отклонено' end,
    coalesce(t.title, sg.title, (select title from public.templates where id = sg.template_id), '') ||
    ' · от ' || coalesce(nullif(sg.author, ''), 'оператора'));
  return json_build_object('ok', true, 'template', case when t.id is null then null else (to_jsonb(t) - 'image')::json end);
end;
$$;

create or replace function public.owner_journal(p_token text, p_limit int default 300)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  perform public._auth(p_token, 'owner');
  return (
    select coalesce(json_agg(json_build_object('at', j.at, 'actor', j.actor, 'action', j.action, 'details', j.details)
                             order by j.at desc, j.id desc), '[]'::json)
      from (select * from public.journal order by at desc, id desc limit least(greatest(coalesce(p_limit, 300), 1), 1000)) j
  );
end;
$$;

-- ---------- Предупреждение и скриншот у шаблона, темы, «Программы» ----------

-- notice — окно-предупреждение при копировании («проверь перед отправкой»);
-- image  — скриншот к шаблону (data:image/…;base64), грузится отдельно, только когда нужен.
alter table public.templates add column if not exists notice text;
alter table public.templates add column if not exists image  text;
alter table public.templates add column if not exists has_image boolean generated always as (image is not null) stored;
alter table public.templates drop constraint if exists templates_notice_len;
alter table public.templates add constraint templates_notice_len check (notice is null or length(notice) <= 1000);
alter table public.templates drop constraint if exists templates_image_fmt;
alter table public.templates add constraint templates_image_fmt
  check (image is null or (image ~ '^data:image/(png|jpeg|webp);base64,' and length(image) <= 3000000));

drop function if exists public.template_save(text, bigint, text, text, text, text);
drop function if exists public.template_save(text, bigint, text, text, text, text, text, text);
-- p_image: null — не трогать скрин, '' — убрать, data:image/… — заменить
create or replace function public.template_save(
  p_token text, p_id bigint, p_keyword text, p_title text, p_body text, p_link text default null,
  p_category text default null, p_body_kz text default null, p_notice text default null, p_image text default null)
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
  if coalesce(p_image, '') <> '' and (p_image !~ '^data:image/(png|jpeg|webp);base64,' or length(p_image) > 3000000) then
    raise exception 'VALIDATION';
  end if;
  -- у каждого шаблона должен быть и казахский текст
  if coalesce(trim(p_body_kz), '') = '' then
    raise exception 'NEED_KZ';
  end if;
  if p_id is null then
    insert into public.templates (keyword, title, category, body, body_kz, link, notice, image)
    values (trim(p_keyword), trim(p_title), nullif(trim(coalesce(p_category, '')), ''), trim(p_body),
            nullif(trim(coalesce(p_body_kz, '')), ''), nullif(trim(coalesce(p_link, '')), ''),
            nullif(trim(coalesce(p_notice, '')), ''), nullif(p_image, ''))
    returning * into t;
  else
    update public.templates
       set keyword = trim(p_keyword), title = trim(p_title), body = trim(p_body),
           category = nullif(trim(coalesce(p_category, '')), ''),
           body_kz = nullif(trim(coalesce(p_body_kz, '')), ''),
           link = nullif(trim(coalesce(p_link, '')), ''),
           notice = nullif(trim(coalesce(p_notice, '')), ''),
           image = case when p_image is null then image when p_image = '' then null else p_image end,
           updated_at = now()
     where id = p_id
    returning * into t;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  return (to_jsonb(t) - 'image')::json;
end;
$$;

-- Темы шаблонов: админ может завести тему заранее, даже пока в ней нет шаблонов.
create table if not exists public.topics (
  name        text primary key check (length(trim(name)) between 1 and 60),
  created_at  timestamptz not null default now()
);

-- Программы, с которыми работает поддержка: название и ссылка. Видят все, правят админы.
create table if not exists public.links (
  id          bigint generated always as identity primary key,
  title       text not null check (length(trim(title)) between 1 and 80),
  url         text not null check (url ~* '^https?://' and length(url) <= 1000),
  note        text check (note is null or length(note) <= 300),
  sort        int  not null default 100,
  created_at  timestamptz not null default now()
);

alter table public.topics enable row level security;
alter table public.links  enable row level security;
drop policy if exists "topics are public" on public.topics;
create policy "topics are public" on public.topics for select to anon, authenticated using (true);
drop policy if exists "links are public" on public.links;
create policy "links are public" on public.links for select to anon, authenticated using (true);
grant select on public.topics, public.links to anon, authenticated;
revoke insert, update, delete, truncate on public.topics, public.links from anon, authenticated;

create or replace function public.topic_add(p_token text, p_name text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  perform public._auth(p_token, 'admin');
  if v = '' or length(v) > 60 then raise exception 'VALIDATION'; end if;
  insert into public.topics (name) values (v) on conflict do nothing;
  if found then perform public._log('Тема добавлена', v); end if;
  return json_build_object('ok', true, 'name', v);
end;
$$;

-- Удалить можно только пустую тему (шаблоны сначала перенести).
create or replace function public.topic_delete(p_token text, p_name text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  perform public._auth(p_token, 'admin');
  if exists (select 1 from public.templates where category = p_name) then raise exception 'VALIDATION'; end if;
  delete from public.topics where name = p_name;
  if found then perform public._log('Тема удалена', p_name); end if;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.link_save(
  p_token text, p_id bigint, p_title text, p_url text, p_note text default null, p_sort int default 100)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  l public.links;
begin
  perform public._auth(p_token, 'admin');
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_url), '') !~* '^https?://' then raise exception 'VALIDATION'; end if;
  if p_id is null then
    insert into public.links (title, url, note, sort)
    values (left(trim(p_title), 80), left(trim(p_url), 1000), nullif(left(trim(coalesce(p_note, '')), 300), ''), coalesce(p_sort, 100))
    returning * into l;
    perform public._log('Программа добавлена', l.title);
  else
    update public.links
       set title = left(trim(p_title), 80), url = left(trim(p_url), 1000),
           note = nullif(left(trim(coalesce(p_note, '')), 300), ''), sort = coalesce(p_sort, sort)
     where id = p_id
    returning * into l;
    if not found then raise exception 'NOT_FOUND'; end if;
    perform public._log('Программа изменена', l.title);
  end if;
  return row_to_json(l);
end;
$$;

create or replace function public.link_delete(p_token text, p_id bigint)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  l public.links;
begin
  perform public._auth(p_token, 'admin');
  delete from public.links where id = p_id returning * into l;
  if found then perform public._log('Программа удалена', l.title); end if;
  return json_build_object('ok', true);
end;
$$;

grant execute on function public.template_save(text, bigint, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.topic_add(text, text)                               to anon, authenticated;
grant execute on function public.topic_delete(text, text)                            to anon, authenticated;
grant execute on function public.link_save(text, bigint, text, text, text, int)      to anon, authenticated;
grant execute on function public.link_delete(text, bigint)                           to anon, authenticated;

-- ---------- Имя человека в сессии: в журнале «Админ 2 · Айдана» ----------
alter table public.sessions add column if not exists person text;
alter table public.sessions drop constraint if exists sessions_person_len;
alter table public.sessions add constraint sessions_person_len check (person is null or length(person) <= 40);

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
  -- кто действует — для журнала изменений (до конца текущего запроса): «Админ 2 · Айдана»
  perform set_config('sufler.actor',
    coalesce(nullif((select label from public.access_codes where id = s.code_id), ''), s.role)
      || coalesce(' · ' || nullif(s.person, ''), ''), true);
  return s;
end;
$$;

-- Имя человека, который вошёл по коду (необязательно). Видно в журнале и в списке сессий.
create or replace function public.session_set_name(p_token text, p_name text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.sessions;
  v text := nullif(left(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 40), '');
begin
  s := public._auth(p_token, 'admin');
  update public.sessions set person = v where id = s.id;
  return json_build_object('ok', true, 'person', v);
end;
$$;

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
             'id', s.id, 'code', c.label, 'person', s.person, 'role', s.role,
             'created_at', s.created_at, 'expires_at', s.expires_at,
             'is_me', s.id = me.id) order by s.created_at), '[]'::json)
      from public.sessions s
      join public.access_codes c on c.id = s.code_id
     where s.ended_at is null and s.expires_at > now()
  );
end;
$$;

grant execute on function public.session_set_name(text, text) to anon, authenticated;

-- ---------- Имена кодов видит только владелец ----------
-- Объявления видят все, поэтому автора в них больше не отдаём (он есть в журнале владельца).
create or replace function public.announcements_active()
returns json
language sql stable security definer
set search_path = public, extensions
as $$
  select coalesce(json_agg(json_build_object('id', id, 'body', body,
                                             'created_at', created_at, 'expires_at', expires_at)
                           order by created_at desc), '[]'::json)
    from public.announcements
   where ended_at is null and expires_at > now()
$$;

-- «Кто решил» по предложению: владельцу — имя кода, админам — просто «админ».
create or replace function public.suggestions_list(p_token text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  me public.sessions;
begin
  me := public._auth(p_token, 'admin');
  return (
    select coalesce(json_agg(json_build_object(
             'id', s.id, 'kind', s.kind, 'template_id', s.template_id,
             'template_title', t.title, 'template_body', t.body, 'template_keyword', t.keyword, 'template_category', t.category,
             'keyword', s.keyword, 'title', s.title, 'category', s.category, 'body', s.body, 'note', s.note,
             'author', s.author, 'status', s.status, 'created_at', s.created_at,
             'decided_at', s.decided_at,
             'decided_by', case when me.role = 'owner' then s.decided_by when s.decided_by is null then null else 'админ' end)
           order by (s.status = 'pending') desc, s.created_at desc), '[]'::json)
      from (select * from public.suggestions
             where status = 'pending' or decided_at > now() - interval '30 days'
             order by created_at desc limit 300) s
      left join public.templates t on t.id = s.template_id
  );
end;
$$;

-- ---------- Избранное: у каждого кода свои группы шаблонов ----------
create table if not exists public.fav_groups (
  id          bigint generated always as identity primary key,
  code_id     bigint not null references public.access_codes(id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 40),
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists fav_groups_code_idx on public.fav_groups (code_id);

create table if not exists public.fav_items (
  group_id     bigint not null references public.fav_groups(id) on delete cascade,
  template_id  bigint not null references public.templates(id) on delete cascade,
  added_at     timestamptz not null default now(),
  primary key (group_id, template_id)
);

alter table public.fav_groups enable row level security;
alter table public.fav_items  enable row level security;
revoke all on public.fav_groups, public.fav_items from anon, authenticated;

-- Группы своего кода вместе с шаблонами в них
create or replace function public.favs_list(p_token text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.sessions;
begin
  s := public._auth(p_token, 'admin');
  return (
    select coalesce(json_agg(json_build_object(
             'id', g.id, 'name', g.name, 'sort', g.sort,
             'items', coalesce((select json_agg(i.template_id order by i.added_at) from public.fav_items i where i.group_id = g.id), '[]'::json))
           order by g.sort, g.id), '[]'::json)
      from public.fav_groups g
     where g.code_id = s.code_id
  );
end;
$$;

-- Создать (p_id = null) или переименовать группу
create or replace function public.fav_group_save(p_token text, p_id bigint, p_name text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.sessions;
  g public.fav_groups;
  v text := left(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 40);
begin
  s := public._auth(p_token, 'admin');
  if v = '' then raise exception 'VALIDATION'; end if;
  if p_id is null then
    if (select count(*) from public.fav_groups where code_id = s.code_id) >= 30 then raise exception 'TOO_MANY'; end if;
    insert into public.fav_groups (code_id, name, sort)
    values (s.code_id, v, coalesce((select max(sort) + 1 from public.fav_groups where code_id = s.code_id), 0))
    returning * into g;
  else
    update public.fav_groups set name = v where id = p_id and code_id = s.code_id returning * into g;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  return json_build_object('id', g.id, 'name', g.name, 'sort', g.sort, 'items', '[]'::json);
end;
$$;

create or replace function public.fav_group_delete(p_token text, p_id bigint)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.sessions;
begin
  s := public._auth(p_token, 'admin');
  delete from public.fav_groups where id = p_id and code_id = s.code_id;
  return json_build_object('ok', true);
end;
$$;

-- Положить шаблон в группу (p_on = true) или убрать из неё
create or replace function public.fav_set(p_token text, p_group_id bigint, p_template_id bigint, p_on boolean)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  s public.sessions;
begin
  s := public._auth(p_token, 'admin');
  if not exists (select 1 from public.fav_groups where id = p_group_id and code_id = s.code_id) then raise exception 'NOT_FOUND'; end if;
  if p_on then
    if (select count(*) from public.fav_items where group_id = p_group_id) >= 300 then raise exception 'TOO_MANY'; end if;
    insert into public.fav_items (group_id, template_id) values (p_group_id, p_template_id) on conflict do nothing;
  else
    delete from public.fav_items where group_id = p_group_id and template_id = p_template_id;
  end if;
  return json_build_object('ok', true);
end;
$$;

grant execute on function public.favs_list(text)                                 to anon, authenticated;
grant execute on function public.fav_group_save(text, bigint, text)              to anon, authenticated;
grant execute on function public.fav_group_delete(text, bigint)                  to anon, authenticated;
grant execute on function public.fav_set(text, bigint, bigint, boolean)          to anon, authenticated;

-- ---------- Казахский: черновик перевода или проверен ----------
-- kz_checked = false — казахский текст переведён автоматически и ещё не проверен человеком.
alter table public.templates add column if not exists kz_checked boolean not null default true;

-- Админ поправил казахский текст в форме — значит, проверил.
create or replace function public._kz_checked_on_edit()
returns trigger language plpgsql
as $$
begin
  if new.body_kz is distinct from old.body_kz and coalesce(current_setting('sufler.kz_import', true), '') <> 'on' then
    new.kz_checked := true;
  end if;
  return new;
end;
$$;
drop trigger if exists templates_kz_checked on public.templates;
create trigger templates_kz_checked before update on public.templates
  for each row execute function public._kz_checked_on_edit();

-- Кнопка «Казахский проверен» в деталях шаблона
create or replace function public.template_kz_check(p_token text, p_id bigint, p_checked boolean default true)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  t public.templates;
begin
  perform public._auth(p_token, 'admin');
  update public.templates set kz_checked = coalesce(p_checked, true) where id = p_id returning * into t;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public._log(case when coalesce(p_checked, true) then 'Казахский проверен' else 'Казахский — снова черновик' end, t.title);
  return json_build_object('ok', true);
end;
$$;

revoke execute on function public._kz_checked_on_edit() from public, anon, authenticated;
grant execute on function public.template_kz_check(text, bigint, boolean) to anon, authenticated;

-- ---------- Владелец видит избранное всех кодов (только просмотр) ----------
create or replace function public.owner_favs(p_token text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  perform public._auth(p_token, 'owner');
  return (
    select coalesce(json_agg(json_build_object(
             'code', c.label, 'role', c.role,
             'groups', (
               select coalesce(json_agg(json_build_object(
                        'id', g.id, 'name', g.name,
                        'items', (
                          select coalesce(json_agg(json_build_object('id', t.id, 'title', t.title) order by i.added_at), '[]'::json)
                            from public.fav_items i join public.templates t on t.id = i.template_id
                           where i.group_id = g.id))
                      order by g.sort, g.id), '[]'::json)
                 from public.fav_groups g where g.code_id = c.id))
           order by c.id), '[]'::json)
      from public.access_codes c
  );
end;
$$;

grant execute on function public.owner_favs(text) to anon, authenticated;

-- ---------- Права на функции ----------
-- Служебные функции закрыты; сайту доступны только «публичные» ручки.

revoke execute on function public._hash_token(text)              from public, anon, authenticated;
revoke execute on function public._client_ip()                   from public, anon, authenticated;
revoke execute on function public._auth(text, text)              from public, anon, authenticated;
revoke execute on function public.add_access_code(text, text, int, text) from public, anon, authenticated;

grant execute on function public.login(text, text)                                   to anon, authenticated;
grant execute on function public.logout(text)                                        to anon, authenticated;
grant execute on function public.session_status(text)                                to anon, authenticated;
grant execute on function public.template_delete(text, bigint)                       to anon, authenticated;
grant execute on function public.templates_import(text, jsonb, boolean)              to anon, authenticated;
grant execute on function public.shortcut_save(text, bigint, text, text, text)       to anon, authenticated;
grant execute on function public.shortcut_delete(text, bigint)                       to anon, authenticated;
grant execute on function public.owner_sessions(text)                                to anon, authenticated;
grant execute on function public.owner_kick(text, uuid)                              to anon, authenticated;

revoke execute on function public._actor()                         from public, anon, authenticated;
revoke execute on function public._log(text, text)                 from public, anon, authenticated;
revoke execute on function public._journal_templates()             from public, anon, authenticated;
revoke execute on function public._journal_shortcuts()             from public, anon, authenticated;

grant execute on function public.announcements_active()                              to anon, authenticated;
grant execute on function public.announce_create(text, text, int)                    to anon, authenticated;
grant execute on function public.announce_end(text, bigint)                          to anon, authenticated;
grant execute on function public.suggestion_create(text, bigint, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.suggestions_list(text)                              to anon, authenticated;
grant execute on function public.suggestion_decide(text, bigint, boolean, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.owner_journal(text, int)                            to anon, authenticated;
