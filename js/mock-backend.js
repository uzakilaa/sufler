/*
 * Демо-режим: «база» внутри браузера (localStorage).
 * Включается сам, пока в js/config.js не указан Supabase.
 * Коды демо-режима ненастоящие и нужны только чтобы потрогать интерфейс.
 */
(function () {
  'use strict';

  const KEY = 'sufler.demo.v2';
  const HOURS9 = 9 * 3600 * 1000;
  const DEMO_CODES = [
    { id: 1, code: '1111', role: 'admin', max: 2, label: 'Админ (демо)' },
    { id: 2, code: 'demo', role: 'owner', max: 2, label: 'Владелец (демо)' },
  ];

  const SAMPLE_TEMPLATES = [
    ['возз', 'Возврат средств', 'Возврат средств поступит на карту в течение 3–10 рабочих дней с момента отмены покупки. Срок зависит от магазина и банка-эквайера. Если по истечении 10 рабочих дней деньги не поступят, напишите нам — проверим статус операции.', ''],
    ['кешб', 'Кешбэк не начислен', 'Кешбэк начисляется после того, как покупка пройдёт по счёту, обычно это 2–3 рабочих дня. Если покупка совершена в категории с повышенным кешбэком, проверьте, что категория была выбрана до покупки.', 'https://example.com/cashback'],
    ['блок', 'Карта заблокирована', 'Карта временно заблокирована в целях безопасности. Для разблокировки подтвердите последнюю операцию в приложении или позвоните по номеру на обороте карты.', ''],
    ['перев', 'Перевод не дошёл', 'Переводы между банками обычно зачисляются в течение нескольких минут, но в отдельных случаях могут идти до 3 рабочих дней. Пришлите, пожалуйста, квитанцию о переводе, и мы проверим его статус.', ''],
    ['лим', 'Лимиты по карте', 'Изменить лимиты можно в приложении: Карты → выберите карту → Лимиты. Новые лимиты начинают действовать сразу после сохранения.', 'https://example.com/limits'],
    ['пин', 'Смена ПИН-кода', 'Сменить ПИН-код можно в приложении: Карты → Настройки → Сменить ПИН-код. Новый ПИН-код начнёт работать сразу. Никому не сообщайте ПИН-код, даже сотрудникам банка.', ''],
    ['выпис', 'Выписка по счёту', 'Выписку по счёту можно сформировать в приложении: Счета → выберите счёт → Выписка. Выберите период и формат (PDF или Excel), выписка придёт на вашу почту.', ''],
    ['кешлим', 'Лимит кешбэка', 'Максимальная сумма кешбэка в месяц зависит от вашего тарифа. Узнать её можно в приложении в разделе «Бонусы». Кешбэк сверх лимита не начисляется.', ''],
    ['закр', 'Закрытие счёта', 'Закрыть счёт можно в любом отделении банка с удостоверением личности. Перед закрытием убедитесь, что на счёте нет задолженности и подключённых автоплатежей.', ''],
  ];

  function load() {
    let db = null;
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || !db.templates) {
      const C = window.SuflerCorrector;
      let id = 1;
      db = {
        seq: 100,
        templates: SAMPLE_TEMPLATES.map(([keyword, title, body, link]) => ({ id: id++, keyword, title, body, link: link || null })),
        shortcuts: C.DEFAULT_ENTRIES.map((e, i) => ({ id: i + 1, kind: e.kind, short: e.short, full: e.full })),
        sessions: [{
          id: 'demo-other', token: 'x-' + Math.random(), code_id: 1, role: 'admin',
          created_at: new Date(Date.now() - 2.5 * 3600 * 1000).toISOString(),
          expires_at: new Date(Date.now() + 6.5 * 3600 * 1000).toISOString(), ended_at: null, end_reason: null,
        }],
        attempts: {},
      };
      db.seq = Math.max(db.shortcuts.length, db.templates.length) + 10;
      save(db);
    }
    db.announcements = db.announcements || [];
    db.suggestions = db.suggestions || [];
    db.journal = db.journal || [];
    return db;
  }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* приватный режим */ } }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const err = (code) => window.SuflerApiError(code);
  const isActive = (s) => !s.ended_at && new Date(s.expires_at).getTime() > Date.now();

  function auth(db, token, min) {
    const s = db.sessions.find((x) => x.token === token);
    if (!token || !s) throw err('SESSION_INVALID');
    if (s.ended_at) throw err(s.end_reason === 'kicked' ? 'SESSION_KICKED' : 'SESSION_ENDED');
    if (new Date(s.expires_at).getTime() <= Date.now()) throw err('SESSION_EXPIRED');
    if (min === 'owner' && s.role !== 'owner') throw err('FORBIDDEN');
    return s;
  }

  const actor = (s) => (DEMO_CODES.find((c) => c.id === s.code_id) || {}).label || s.role;
  const log = (db, who, action, details) => db.journal.push({ at: new Date().toISOString(), actor: who, action, details: String(details || '').slice(0, 500) });

  window.SuflerMock = function () {
    const run = async (fn) => { await wait(90 + Math.random() * 120); const db = load(); const r = fn(db); save(db); return r; };
    const clone = (x) => JSON.parse(JSON.stringify(x));

    return {
      mode: 'demo',
      demoCodes: DEMO_CODES.map((c) => ({ code: c.code, role: c.role })),
      listTemplates: () => run((db) => clone(db.templates)),
      listShortcuts: () => run((db) => clone(db.shortcuts)),
      login: (code, device) => run((db) => {
        const key = device || 'none';
        const a = db.attempts[key] || { fails: 0, blocked_until: 0 };
        if (a.blocked_until > Date.now()) return { ok: false, error: 'blocked', retry_in: Math.ceil((a.blocked_until - Date.now()) / 1000) };
        const c = DEMO_CODES.find((x) => x.code === code);
        if (!c) {
          a.fails += 1;
          if (a.fails >= 5) { a.fails = 0; a.blocked_until = Date.now() + 60000; db.attempts[key] = a; return { ok: false, error: 'blocked', retry_in: 60 }; }
          db.attempts[key] = a;
          return { ok: false, error: 'wrong', attempts_left: 5 - a.fails };
        }
        delete db.attempts[key];
        if (db.sessions.filter((s) => s.code_id === c.id && isActive(s)).length >= c.max) return { ok: false, error: 'busy' };
        const s = {
          id: 'demo-' + Math.random().toString(36).slice(2, 10),
          token: Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join(''),
          code_id: c.id, role: c.role, created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + HOURS9).toISOString(), ended_at: null, end_reason: null,
        };
        db.sessions.push(s);
        return { ok: true, token: s.token, role: s.role, expires_at: s.expires_at, session_id: s.id };
      }),
      logout: (token) => run((db) => {
        const s = db.sessions.find((x) => x.token === token && !x.ended_at);
        if (s) { s.ended_at = new Date().toISOString(); s.end_reason = 'logout'; }
        return { ok: true };
      }),
      status: (token) => run((db) => {
        const s = db.sessions.find((x) => x.token === token);
        if (!s) return { ok: false, reason: 'invalid' };
        if (s.ended_at) return { ok: false, reason: s.end_reason === 'kicked' ? 'kicked' : 'ended' };
        if (new Date(s.expires_at).getTime() <= Date.now()) return { ok: false, reason: 'expired' };
        return { ok: true, role: s.role, expires_at: s.expires_at, session_id: s.id };
      }),
      saveTemplate: (token, t) => run((db) => {
        auth(db, token, 'admin');
        if (!t.keyword.trim() || !t.title.trim() || !t.body.trim()) throw err('VALIDATION');
        const row = { keyword: t.keyword.trim(), title: t.title.trim(), category: (t.category || '').trim() || null, body: t.body.trim(), body_kz: (t.body_kz || '').trim() || null, link: (t.link || '').trim() || null };
        if (t.id) {
          const ex = db.templates.find((x) => x.id === t.id);
          if (!ex) throw err('NOT_FOUND');
          Object.assign(ex, row);
          return clone(ex);
        }
        const n = { id: ++db.seq, ...row };
        db.templates.push(n);
        return clone(n);
      }),
      deleteTemplate: (token, id) => run((db) => {
        auth(db, token, 'admin');
        db.templates = db.templates.filter((x) => x.id !== id);
        return { ok: true };
      }),
      importTemplates: (token, items, replace) => run((db) => {
        auth(db, token, 'owner');
        if (replace) db.templates = [];
        let inserted = 0;
        for (const x of items) {
          if (!x.keyword || !x.title || !x.body) continue;
          db.templates.push({ id: ++db.seq, keyword: x.keyword.trim(), title: x.title.trim(), category: (x.category || '').trim() || null, body: x.body.trim(), body_kz: (x.body_kz || '').trim() || null, link: (x.link || '').trim() || null });
          inserted++;
        }
        return { inserted };
      }),
      saveShortcut: (token, s) => run((db) => {
        auth(db, token, 'admin');
        const short = s.short.trim().toLowerCase();
        if (!short || !s.full.trim()) throw err('VALIDATION');
        if (db.shortcuts.some((x) => x.kind === s.kind && x.short.toLowerCase() === short && x.id !== s.id)) throw err('DUPLICATE');
        if (s.id) {
          const ex = db.shortcuts.find((x) => x.id === s.id);
          if (!ex) throw err('NOT_FOUND');
          Object.assign(ex, { kind: s.kind, short, full: s.full.trim() });
          return clone(ex);
        }
        const n = { id: ++db.seq, kind: s.kind, short, full: s.full.trim() };
        db.shortcuts.push(n);
        return clone(n);
      }),
      deleteShortcut: (token, id) => run((db) => {
        auth(db, token, 'admin');
        db.shortcuts = db.shortcuts.filter((x) => x.id !== id);
        return { ok: true };
      }),
      announcements: () => run((db) => clone(db.announcements.filter((a) => !a.ended_at && new Date(a.expires_at) > new Date()).reverse())),
      announce: (token, body, hours) => run((db) => {
        const s = auth(db, token, 'admin');
        if (!body.trim() || hours < 1 || hours > 48) throw err('VALIDATION');
        const a = { id: ++db.seq, body: body.trim(), author: actor(s), created_at: new Date().toISOString(), expires_at: new Date(Date.now() + hours * 3600e3).toISOString() };
        db.announcements.push(a);
        log(db, actor(s), 'Объявление', a.body + ' · на ' + hours + ' ч');
        return clone(a);
      }),
      announceEnd: (token, id) => run((db) => {
        const s = auth(db, token, 'admin');
        const a = db.announcements.find((x) => x.id === id && !x.ended_at);
        if (a) { a.ended_at = new Date().toISOString(); log(db, actor(s), 'Объявление снято', a.body); }
        return { ok: true };
      }),
      suggest: (sg) => run((db) => {
        if (!sg.body || (sg.kind === 'new' && (!sg.keyword || !sg.title))) throw err('VALIDATION');
        const n = { ...sg, id: ++db.seq, status: 'pending', created_at: new Date().toISOString() };
        db.suggestions.push(n);
        const t = db.templates.find((x) => x.id === sg.template_id);
        log(db, sg.author || 'оператор', sg.kind === 'new' ? 'Предложен шаблон' : 'Предложена правка', sg.title || (t && t.title) || '');
        return { ok: true, id: n.id };
      }),
      suggestions: (token) => run((db) => {
        auth(db, token, 'admin');
        return clone(db.suggestions.slice().reverse().map((x) => {
          const t = db.templates.find((y) => y.id === x.template_id);
          return { ...x, template_title: t && t.title, template_body: t && t.body, template_keyword: t && t.keyword, template_category: t && t.category };
        }).sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1)));
      }),
      decideSuggestion: (token, id, accept, t) => run((db) => {
        const s = auth(db, token, 'admin');
        const sg = db.suggestions.find((x) => x.id === id);
        if (!sg) throw err('NOT_FOUND');
        if (sg.status !== 'pending') throw err('DUPLICATE');
        let row = null;
        if (accept) {
          const fields = { keyword: t.keyword, title: t.title, category: t.category || null, body: t.body, body_kz: t.body_kz || null, link: t.link || null };
          row = sg.kind === 'fix' && db.templates.find((x) => x.id === sg.template_id);
          if (row) Object.assign(row, fields); else { row = { id: ++db.seq, ...fields }; db.templates.push(row); }
          log(db, actor(s), sg.kind === 'fix' ? 'Шаблон изменён' : 'Шаблон добавлен', row.title);
        }
        Object.assign(sg, { status: accept ? 'accepted' : 'rejected', decided_at: new Date().toISOString(), decided_by: actor(s) });
        log(db, actor(s), accept ? 'Предложение принято' : 'Предложение отклонено', (row && row.title) || sg.title || '');
        return { ok: true, template: row ? clone(row) : null };
      }),
      journal: (token) => run((db) => { auth(db, token, 'owner'); return clone(db.journal.slice().reverse()); }),
      ownerSessions: (token) => run((db) => {
        const me = auth(db, token, 'owner');
        return db.sessions.filter(isActive).map((s) => ({
          id: s.id, code: DEMO_CODES.find((c) => c.id === s.code_id).label, role: s.role,
          created_at: s.created_at, expires_at: s.expires_at, is_me: s.id === me.id,
        }));
      }),
      kick: (token, id) => run((db) => {
        auth(db, token, 'owner');
        const s = db.sessions.find((x) => x.id === id && !x.ended_at);
        if (s) { s.ended_at = new Date().toISOString(); s.end_reason = 'kicked'; }
        return { ok: true };
      }),
    };
  };
})();
