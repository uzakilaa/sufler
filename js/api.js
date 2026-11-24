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
    'FORBIDDEN', 'DUPLICATE', 'VALIDATION', 'NOT_FOUND'];

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
      listTemplates: () => listAll('templates', 'id,keyword,title,category,body,body_kz,link', 'id.asc'),
      listShortcuts: async () => (await listAll('shortcuts', 'id,kind,short,full_text', 'id.asc'))
        .map((r) => ({ id: r.id, kind: r.kind, short: r.short, full: r.full_text })),
      login: (code, device) => rpc('login', { p_code: code, p_device: device }),
      logout: (token) => rpc('logout', { p_token: token }),
      status: (token) => rpc('session_status', { p_token: token }),
      saveTemplate: (token, t) => rpc('template_save', {
        p_token: token, p_id: t.id || null, p_keyword: t.keyword, p_title: t.title, p_body: t.body, p_link: t.link || null,
        p_category: t.category || null, p_body_kz: t.body_kz || null,
      }),
      deleteTemplate: (token, id) => rpc('template_delete', { p_token: token, p_id: id }),
      importTemplates: (token, items, replace) => rpc('templates_import', { p_token: token, p_items: items, p_replace: !!replace }),
      saveShortcut: async (token, s) => {
        const r = await rpc('shortcut_save', { p_token: token, p_id: s.id || null, p_kind: s.kind, p_short: s.short, p_full: s.full });
        return { id: r.id, kind: r.kind, short: r.short, full: r.full_text };
      },
      deleteShortcut: (token, id) => rpc('shortcut_delete', { p_token: token, p_id: id }),
      ownerSessions: (token) => rpc('owner_sessions', { p_token: token }),
      kick: (token, id) => rpc('owner_kick', { p_token: token, p_session_id: id }),
    };
  };

  window.SuflerApiError = ApiError;
})();
