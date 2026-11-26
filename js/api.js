/*
 * Работа с базой Supabase через REST (PostgREST) без сторонних библиотек.
 * Читать шаблоны и сокращения можно напрямую, всё остальное — через серверные функции (rpc).
 */
(function () {
  'use strict';

  function ApiError(code, message) {
    const e = new Error(message || code);
    e.code = code;
    return e;
  }

  const KNOWN = ['SESSION_INVALID', 'SESSION_KICKED', 'SESSION_ENDED', 'SESSION_EXPIRED',
    'FORBIDDEN', 'DUPLICATE', 'VALIDATION', 'NOT_FOUND', 'TOO_MANY', 'NEED_KZ'];

  window.SuflerSupabase = function (cfg) {
    const base = cfg.supabaseUrl.replace(/\/+$/, '');
    const headers = { apikey: cfg.supabaseKey, 'Content-Type': 'application/json' };
    if (/^eyJ/.test(cfg.supabaseKey)) headers.Authorization = 'Bearer ' + cfg.supabaseKey;

    async function req(path, opts = {}) {
      let res;
      try {
        res = await fetch(base + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
      } catch (e) {
        throw ApiError('NETWORK', 'Нет связи с базой');
      }
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
      if (!res.ok) {
        const msg = (data && (data.message || data.hint)) || res.statusText || 'Ошибка базы';
        const code = KNOWN.find((k) => String(msg).includes(k)) || (res.status >= 500 ? 'SERVER' : 'BAD_REQUEST');
        throw ApiError(code, msg);
      }
      return data;
    }

    const rpc = (name, args) => req('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(args) });

    async function listAll(table, select, order) {
      const size = 1000;
      let from = 0;
      const out = [];
      for (;;) {
        const rows = await req(`/rest/v1/${table}?select=${select}&order=${order}`, {
          headers: { Range: `${from}-${from + size - 1}`, 'Range-Unit': 'items' },
        });
        out.push(...(rows || []));
        if (!rows || rows.length < size) return out;
        from += size;
      }
    }

    return {
      mode: 'supabase',
      listTemplates: () => listAll('templates', 'id,keyword,title,category,body,body_kz,link,notice,has_image,kz_checked', 'id.asc'),
      // скриншот шаблона грузим отдельно — только когда он нужен
      templateImage: async (id) => {
        const rows = await req('/rest/v1/templates?select=image&id=eq.' + encodeURIComponent(id));
        return rows && rows[0] ? rows[0].image : null;
      },
      listTopics: async () => (await listAll('topics', 'name', 'name.asc')).map((r) => r.name),
      topicAdd: (token, name) => rpc('topic_add', { p_token: token, p_name: name }),
      topicDelete: (token, name) => rpc('topic_delete', { p_token: token, p_name: name }),
      listLinks: () => listAll('links', 'id,title,url,note,sort', 'sort.asc,id.asc'),
      linkSave: (token, l) => rpc('link_save', { p_token: token, p_id: l.id || null, p_title: l.title, p_url: l.url, p_note: l.note || null, p_sort: l.sort == null ? 100 : l.sort }),
      linkDelete: (token, id) => rpc('link_delete', { p_token: token, p_id: id }),
      listShortcuts: async () => (await listAll('shortcuts', 'id,kind,short,full_text', 'id.asc'))
        .map((r) => ({ id: r.id, kind: r.kind, short: r.short, full: r.full_text })),
      login: (code, device) => rpc('login', { p_code: code, p_device: device }),
      logout: (token) => rpc('logout', { p_token: token }),
      status: (token) => rpc('session_status', { p_token: token }),
      saveTemplate: (token, t) => rpc('template_save', {
        p_token: token, p_id: t.id || null, p_keyword: t.keyword, p_title: t.title, p_body: t.body, p_link: t.link || null,
        p_category: t.category || null, p_body_kz: t.body_kz || null, p_notice: t.notice || null,
        p_image: t.image === undefined ? null : t.image,
      }),
      deleteTemplate: (token, id) => rpc('template_delete', { p_token: token, p_id: id }),
      importTemplates: (token, items, replace) => rpc('templates_import', { p_token: token, p_items: items, p_replace: !!replace }),
      saveShortcut: async (token, s) => {
        const r = await rpc('shortcut_save', { p_token: token, p_id: s.id || null, p_kind: s.kind, p_short: s.short, p_full: s.full });
        return { id: r.id, kind: r.kind, short: r.short, full: r.full_text };
      },
      deleteShortcut: (token, id) => rpc('shortcut_delete', { p_token: token, p_id: id }),
      ownerSessions: (token) => rpc('owner_sessions', { p_token: token }),
      setSessionName: (token, name) => rpc('session_set_name', { p_token: token, p_name: name || '' }),
      kzCheck: (token, id, checked) => rpc('template_kz_check', { p_token: token, p_id: id, p_checked: !!checked }),
      ownerFavs: (token) => rpc('owner_favs', { p_token: token }),
      favsList: (token) => rpc('favs_list', { p_token: token }),
      favGroupSave: (token, id, name) => rpc('fav_group_save', { p_token: token, p_id: id || null, p_name: name }),
      favGroupDelete: (token, id) => rpc('fav_group_delete', { p_token: token, p_id: id }),
      favSet: (token, groupId, templateId, on) => rpc('fav_set', { p_token: token, p_group_id: groupId, p_template_id: templateId, p_on: !!on }),
      announcements: () => rpc('announcements_active', {}),
      announce: (token, body, hours) => rpc('announce_create', { p_token: token, p_body: body, p_hours: hours }),
      announceEnd: (token, id) => rpc('announce_end', { p_token: token, p_id: id }),
      suggest: (sg) => rpc('suggestion_create', {
        p_kind: sg.kind, p_template_id: sg.template_id || null, p_keyword: sg.keyword || null, p_title: sg.title || null,
        p_category: sg.category || null, p_body: sg.body, p_note: sg.note || null, p_author: sg.author || '',
      }),
      suggestions: (token) => rpc('suggestions_list', { p_token: token }),
      decideSuggestion: (token, id, accept, t) => rpc('suggestion_decide', {
        p_token: token, p_id: id, p_accept: !!accept,
        p_keyword: t ? t.keyword : null, p_title: t ? t.title : null, p_category: t ? t.category || null : null,
        p_body: t ? t.body : null, p_body_kz: t ? t.body_kz || null : null, p_link: t ? t.link || null : null,
      }),
      journal: (token) => rpc('owner_journal', { p_token: token, p_limit: 400 }),
      kick: (token, id) => rpc('owner_kick', { p_token: token, p_session_id: id }),
    };
  };

  window.SuflerApiError = ApiError;
})();
