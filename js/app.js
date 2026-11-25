/* Суфлёр — интерфейс. Чистый JavaScript, без сборки. */
(function () {
  'use strict';

  const C = window.SuflerCorrector;
  const F = window.SuflerFill;
  const cfg = window.SUFLER_CONFIG || {};
  const api = cfg.supabaseUrl && cfg.supabaseKey ? window.SuflerSupabase(cfg) : window.SuflerMock();

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');

  /* ---------- Хранилище в браузере (может быть недоступно — тогда просто без памяти) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('sufler.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('sufler.' + k, JSON.stringify(v)); } catch (e) { /* ничего */ } },
    del(k) { try { localStorage.removeItem('sufler.' + k); } catch (e) { /* ничего */ } },
  };

  const SLOGANS = [
    'Создан для отчаянных операторов, которых завалило чатами',
    'Пока клиент печатает «алло вы тут», ты уже ответил',
    'Суфлёр: потому что запятые сами себя не поставят',
  ];
  const ROLE_NAMES = { guest: 'Гость', admin: 'Админ', owner: 'Владелец' };
  const isAdmin = () => state.role === 'admin' || state.role === 'owner';
  const isOwner = () => state.role === 'owner';

  const state = {
    role: null,            // guest | admin | owner
    session: null,         // { token, role, expires_at, session_id }
    templates: [],
    entries: [],
    tab: 'corrector',
    dictKind: 'shortcut',
    openTemplateId: null,
    lang: 'ru',            // язык копирования шаблонов: ru | kz
    cat: 'all',            // выбранная тема шаблонов
    fill: {},              // значения из строки поиска (телефон, сумма, банк…)
    rest: '',              // строка поиска без этих значений
    opName: '',            // имя оператора для {имя} в шаблонах
    topics: [],            // темы, заведённые админами (могут быть пустыми)
    links: [],             // «Программы»: рабочие системы и ссылки
  };

  let device = store.get('device');
  if (!device) { device = Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('device', device); }

  state.lang = store.get('lang', 'ru') === 'kz' ? 'kz' : 'ru';
  state.cat = store.get('cat', 'all');
  state.opName = store.get('opname', '');
  state.topics = store.get('topics', []);
  state.links = store.get('links', []);

  const corrector = C.createCorrector();

  /* =====================================================================
   *  Уведомления и копирование
   * ===================================================================== */

  function toast(text, kind, ms) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = text;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms || 3200);
  }

  function bubble(x, y) {
    const b = document.createElement('div');
    b.className = 'copy-bubble';
    b.textContent = 'Скопировано';
    b.style.left = x + 'px';
    b.style.top = y + 'px';
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 1050);
    sparks(x, y);
  }

  // Конфетти из знаков препинания: запятые наконец-то на своих местах
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function sparks(x, y) {
    if (REDUCED) return;
    const marks = [',', '.', '!', '?', '«»', '—', ','];
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('span');
      s.className = 'spark';
      s.textContent = marks[i % marks.length];
      const a = (Math.PI * 2 * i) / 9 + Math.random() * 0.5;
      const r = 40 + Math.random() * 40;
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      s.style.setProperty('--dx', Math.cos(a) * r + 'px');
      s.style.setProperty('--dy', Math.sin(a) * r - 20 + 'px');
      s.style.setProperty('--rot', (Math.random() * 120 - 60) + 'deg');
      s.style.color = i % 3 === 0 ? 'var(--green)' : i % 3 === 1 ? 'var(--terracotta)' : 'var(--sage)';
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 850);
    }
  }

  /* ---------- Живой фон ---------- */

  const FLOAT_TEXTS = [
    ['алло вы тут?', 0], ['где мои деньги', 0], ['спасибо за ожидание!', 1], ['уже проверяю', 1],
    ['карта не работает', 0], ['одну минуту…', 1], ['кешбэк где', 0], ['всё решили 🙌', 1],
    ['а можно быстрее', 0], ['хорошего дня!', 1], ['ну что там', 0], ['понимаю вас', 1],
  ];
  // Всплывающие на фоне реплики и знаки. Выключены по просьбе (25.11.2026); вернуть — поставить true.
  const FLOATERS_ON = false;
  const FLOAT_MARKS = [',', ',', '!', '?', '.', '«»', '—', ';', '…', ','];

  function startBackground() {
    const box = $('#floaters');
    if (!box || REDUCED) return;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const items = [];
    FLOAT_TEXTS.forEach(([t, me]) => items.push({ t, cls: 'bubble' + (me ? ' me' : '') }));
    FLOAT_MARKS.forEach((t) => items.push({ t, cls: 'mark' }));
    const small = window.matchMedia('(max-width: 760px), (hover: none)').matches;
    items.sort(() => Math.random() - 0.5).slice(0, FLOATERS_ON ? (small ? 9 : items.length) : 0).forEach((it, i) => {
      const el = document.createElement('div');
      el.className = 'floater ' + it.cls;
      const inner = document.createElement('span');
      inner.textContent = it.t;
      el.appendChild(inner);
      const d = rnd(28, 46);
      el.style.setProperty('--x', rnd(2, 92) + 'vw');
      el.style.setProperty('--d', d + 's');
      el.style.setProperty('--delay', -rnd(0, d) + 's'); // сразу в разных местах, без «пустого» старта
      el.style.setProperty('--r0', rnd(-12, 12) + 'deg');
      el.style.setProperty('--r1', rnd(-12, 12) + 'deg');
      el.style.setProperty('--sw', rnd(4, 8) + 's');
      el.style.setProperty('--s', rnd(26, 54) + 'px');
      el.style.setProperty('--o', it.cls.startsWith('bubble') ? rnd(0.45, 0.7).toFixed(2) : rnd(0.6, 1).toFixed(2));
      box.appendChild(el);
    });

    // Пятна чуть сдвигаются за мышью
    if (small) return; // на телефоне мыши нет — параллакс не нужен
    const bgMove = $('.bg-move');
    let raf = 0;
    let last = null;
    window.addEventListener('pointermove', (ev) => {
      last = ev;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const nx = last.clientX / window.innerWidth - 0.5;
        const ny = last.clientY / window.innerHeight - 0.5;
        if (bgMove) {
          bgMove.style.setProperty('--px', (-nx * 40).toFixed(0) + 'px');
          bgMove.style.setProperty('--py', (-ny * 30).toFixed(0) + 'px');
        }
      });
    }, { passive: true });
  }
  function bubbleOver(el) {
    const r = el.getBoundingClientRect();
    bubble(r.left + r.width / 2, r.top - 4);
  }
  function pulse(el) {
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }
  function shake(el) {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      document.dispatchEvent(new CustomEvent('sufler:copied'));
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove();
      if (!ok) toast('Браузер не дал скопировать. Выделите текст и нажмите Ctrl+C', 'warn');
      else document.dispatchEvent(new CustomEvent('sufler:copied'));
      return ok;
    }
  }

  /* =====================================================================
   *  Роли, вход, сессии
   * ===================================================================== */

  function setRole(role, session) {
    state.role = role;
    state.session = session || null;
    store.set('role', role);
    if (session) store.set('session', session); else store.del('session');
    renderRole();
    scheduleExpiry();
  }

  function renderRole() {
    const role = state.role || 'guest';
    $('#role-name').textContent = ROLE_NAMES[role];
    $('#role-pill').classList.toggle('admin', role !== 'guest');
    $('#btn-logout').hidden = role === 'guest';
    $$('[data-admin]').forEach((el) => { el.hidden = !isAdmin(); });
    $('#btn-add-tpl').hidden = !isAdmin();
    $('#dict-guest-note').hidden = isAdmin();
    $('.tab[data-tab="owner"]').hidden = !isOwner();
    $('.tab[data-tab="sugg"]').hidden = !isAdmin();
    $('#btn-suggest').hidden = isAdmin();
    if (!isOwner() && state.tab === 'owner') switchTab('corrector');
    if (!isAdmin() && state.tab === 'sugg') switchTab('corrector');
    renderAnnouncements();
    renderLinks();
    renderChips(!!$('#search').value.trim());
    if (isAdmin()) loadSuggestions(true); else $('#sugg-count').textContent = '';
    updateRoleTime();
    renderDictList();
    moveInk();
    if (window.SuflerPets) window.SuflerPets.setRole(role);
  }

  function updateRoleTime() {
    const el = $('#role-time');
    if (!state.session) { el.textContent = ''; return; }
    const left = new Date(state.session.expires_at).getTime() - Date.now();
    el.textContent = left > 0 ? '· ещё ' + fmtLeft(left) : '';
  }

  function fmtLeft(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(m / 60);
    return h ? `${h} ч ${m % 60} мин` : `${m} мин`;
  }

  let expiryTimer = null;
  function scheduleExpiry() {
    clearTimeout(expiryTimer);
    if (!state.session) return;
    const left = new Date(state.session.expires_at).getTime() - Date.now();
    if (left <= 0) { demote('expired'); return; }
    expiryTimer = setTimeout(() => demote('expired'), Math.min(left, 2 ** 31 - 1));
  }

  const DEMOTE_MSG = {
    expired: 'Прошло 9 часов — теперь вы гость. Код снова свободен.',
    kicked: 'Владелец завершил вашу сессию. Теперь вы гость.',
    ended: 'Сессия завершена. Теперь вы гость.',
    invalid: 'Сессия больше не действует. Теперь вы гость.',
  };

  function demote(reason) {
    if (!state.session) return;
    setRole('guest', null);
    closeAdminOnlyUi();
    toast(DEMOTE_MSG[reason] || DEMOTE_MSG.ended, 'warn', 5500);
  }

  function closeAdminOnlyUi() {
    if (!$('#tpl-modal').hidden) closeLayer($('#tpl-modal'));
    if (!$('#confirm-modal').hidden) closeLayer($('#confirm-modal'));
  }

  // Ошибка сессии от сервера → становимся гостем. Возвращает true, если ошибка обработана.
  function handleSessionError(e) {
    const map = { SESSION_KICKED: 'kicked', SESSION_EXPIRED: 'expired', SESSION_ENDED: 'ended', SESSION_INVALID: 'invalid', FORBIDDEN: 'invalid' };
    if (e && map[e.code]) { demote(map[e.code]); return true; }
    return false;
  }

  let lastCheck = 0;
  async function verifySession(force) {
    if (!state.session) return;
    if (new Date(state.session.expires_at).getTime() <= Date.now()) { demote('expired'); return; }
    if (!force && Date.now() - lastCheck < 15000) return;
    lastCheck = Date.now();
    try {
      const r = await api.status(state.session.token);
      if (!state.session) return;
      if (!r.ok) demote(r.reason);
      else if (r.role !== state.session.role) setRole(r.role, { ...state.session, role: r.role });
    } catch (e) { /* нет сети — проверим позже */ }
  }

  async function endSession() {
    const s = state.session;
    if (!s) return;
    setRole('guest', null);
    try { await api.logout(s.token); } catch (e) { /* сессия всё равно истечёт */ }
  }

  /* ---------- Экран выбора роли ---------- */

  function showGate() {
    const gate = $('#gate');
    gate.classList.remove('leaving');
    $('#gate-choices').hidden = false;
    $('#code-form').hidden = true;
    $('#code-msg').textContent = '';
    gate.hidden = false;
    const first = $('.choice', gate);
    setTimeout(() => first && first.focus(), 50);
  }

  function hideGate() {
    const gate = $('#gate');
    if (gate.hidden) return;
    gate.classList.add('leaving');
    const app = $('#app');
    app.classList.remove('entering');
    void app.offsetWidth;
    app.classList.add('entering');
    setTimeout(() => { gate.hidden = true; gate.classList.remove('leaving'); moveInk(); }, 430);
  }

  let blockTimer = null;
  function startBlockCountdown(sec) {
    const input = $('#code-input');
    const btn = $('#code-submit');
    const msg = $('#code-msg');
    let left = sec;
    input.disabled = true;
    btn.disabled = true;
    clearInterval(blockTimer);
    const tick = () => {
      const m = Math.floor(left / 60);
      const s = String(left % 60).padStart(2, '0');
      msg.textContent = `Слишком много попыток. Подождите ${m}:${s}`;
      if (left-- <= 0) {
        clearInterval(blockTimer);
        input.disabled = false;
        btn.disabled = false;
        msg.textContent = '';
        input.focus();
      }
    };
    tick();
    blockTimer = setInterval(tick, 1000);
  }

  function bindGate() {
    $$('.choice').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.choice === 'guest') {
        setRole('guest', null);
        hideGate();
        return;
      }
      $('#gate-choices').hidden = true;
      $('#code-form').hidden = false;
      $('#code-input').value = '';
      setTimeout(() => $('#code-input').focus(), 30);
    }));

    $('#code-back').addEventListener('click', () => {
      $('#code-form').hidden = true;
      $('#gate-choices').hidden = false;
      $('#code-msg').textContent = '';
    });

    $('#code-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const input = $('#code-input');
      const code = input.value.trim();
      const msg = $('#code-msg');
      if (!code) { shake(input); return; }
      const btn = $('#code-submit');
      btn.disabled = true;
      msg.textContent = '';
      try {
        const r = await api.login(code, device);
        if (r.ok) {
          setRole(r.role, { token: r.token, role: r.role, expires_at: r.expires_at, session_id: r.session_id });
          lastCheck = Date.now();
          hideGate();
          toast(r.role === 'owner' ? 'С возвращением, владелец. Всё под контролем.' : 'Вы вошли как админ. Шаблоны в вашей власти.', 'ok');
        } else if (r.error === 'busy') {
          msg.textContent = 'Этот код сейчас используется';
          shake(input);
        } else if (r.error === 'blocked') {
          startBlockCountdown(r.retry_in || 60);
          return;
        } else {
          const left = r.attempts_left;
          msg.textContent = left != null && left <= 2
            ? `Неверный код. Осталось попыток: ${left}`
            : 'Неверный код';
          shake(input);
          input.select();
        }
      } catch (e) {
        msg.textContent = 'Не получилось связаться с базой. Проверьте интернет и попробуйте ещё раз.';
      }
      btn.disabled = false;
    });
  }

  /* =====================================================================
   *  Вкладки
   * ===================================================================== */

  function moveInk() {
    const active = $('.tab.active');
    const ink = $('#tab-ink');
    if (!active || !active.offsetWidth) return;
    ink.style.left = active.offsetLeft + 'px';
    ink.style.width = active.offsetWidth + 'px';
  }

  function switchTab(tab) {
    if (tab === 'owner' && !isOwner()) tab = 'corrector';
    if (tab === 'sugg' && !isAdmin()) tab = 'corrector';
    state.tab = tab;
    store.set('tab', tab);
    $$('.tab').forEach((t) => {
      const on = t.dataset.tab === tab;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on);
    });
    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== tab; });
    moveInk();
    if (tab === 'templates') setTimeout(() => $('#search').focus(), 30);
    if (tab === 'corrector') setTimeout(() => $('#draft').focus(), 30);
    if (tab === 'owner') { loadSessions(); loadJournal(); }
    if (tab === 'sugg') loadSuggestions();
    if (tab === 'apps') loadLinks();
  }

  /* =====================================================================
   *  Корректор
   * ===================================================================== */

  let lastResult = '';

  // Подсказки и варианты тона ниже обновляются не на каждую букву, а когда оператор
  // перестал печатать на 2 секунды. Пока ждём — старые блоки чуть приглушены.
  const BELOW_DELAY = 2000;
  let belowTimer = 0;
  function renderBelow(draft, out, wait) {
    clearTimeout(belowTimer);
    const blocks = [$('#suggest'), $('#tones')];
    const run = () => {
      blocks.forEach((b) => b.classList.remove('waiting'));
      renderTones(out);
      renderSuggest(draft, out);
    };
    if (!wait || !out) { run(); return; }
    blocks.forEach((b) => b.classList.add('waiting'));
    belowTimer = setTimeout(run, BELOW_DELAY);
  }

  function renderResult(wait) {
    const draft = $('#draft').value;
    const out = corrector.correct(draft);
    lastResult = out;
    const box = $('#result');
    renderBelow(draft, out, wait);
    if (!out) {
      box.innerHTML = '<span class="placeholder">Тут появится текст, который не стыдно отправить клиенту.</span>';
      $('#changes-hint').textContent = '';
      return;
    }
    const parts = C.diffWords(draft, out);
    box.innerHTML = parts.map((p) => (p.changed ? `<span class="chg">${esc(p.text)}</span>` : esc(p.text))).join('');
    const n = parts.filter((p) => p.changed).length;
    $('#changes-hint').textContent = n ? `поправлено слов: ${n}` : 'придраться не к чему';
  }


  /* ---------- Быстрые фразы: живая схема под корректором ---------- */
  // title — по нему ищется шаблон в базе (текст можно править в шаблонах), text — запасной вариант.
  const FLOW = [
    { title: 'Приветствие', label: 'Приветствие', icon: 'i-wave', c: 1, r: 1,
      text: 'Здравствуйте! На связи чат-поддержка Freedom Bank[[, меня зовут {имя}]]. Подскажите, пожалуйста, ваш вопрос.' },
    { title: 'Приветствие + уточню и вернусь', label: 'Уточню и вернусь', icon: 'i-search', c: 3, r: 1,
      text: 'Здравствуйте![[ Меня зовут {имя}.]] Уточню информацию по вашему вопросу и вернусь к вам через несколько минут.' },
    { title: 'Приветствие + ожидайте', label: 'Ожидайте', icon: 'i-clock', c: 5, r: 1,
      text: 'Здравствуйте![[ Меня зовут {имя}.]] Мне потребуется немного времени для уточнения деталей. Пожалуйста, ожидайте.' },
    { title: 'Передали специалистам (тикет создан)', label: 'Передали специалистам', icon: 'i-send', c: 7, r: 1,
      text: 'Мы передали ваш вопрос профильным специалистам для подробной проверки. Как только появится результат, мы обязательно сообщим вам. Спасибо за терпение!' },
    { title: 'В работе: отметили как приоритетный', label: 'В работе · приоритет', icon: 'i-gear', c: 9, r: 1,
      text: 'Проверили и видим, что ваше обращение всё ещё находится в работе у специалистов. Мы направили уведомление, чтобы ускорить решение, и отметили ваш вопрос как приоритетный. Просим немного подождать 🙏 — будем держать вопрос под контролем.' },
    { title: 'Изучу переписку выше', label: 'Изучу переписку', icon: 'i-doc', c: 4, r: 2,
      text: 'Спасибо за ваш запрос! Мне понадобится время, чтобы изучить переписку выше и подготовить ответ. Спасибо за терпение.' },
    { title: 'Продолжаем работу, ожидайте', label: 'Продолжаем, ожидайте', icon: 'i-loop', c: 6, r: 2,
      text: 'Продолжаем работу по вашему запросу. Пожалуйста, ожидайте — это может занять некоторое время.' },
    { title: 'В работе: на постоянном контроле', label: 'В работе · на контроле', icon: 'i-shield', c: 8, r: 2,
      text: 'Проверили и видим, что ваш запрос всё ещё в работе у специалистов. После завершения проверки и анализа предоставленных вами данных мы обязательно свяжемся с вами и сообщим результат. Ваш вопрос находится на постоянном контроле. 🤝' },
    { title: 'Кешбэк зачисляется в течение 48 часов', label: 'Кешбэк · 48 часов', icon: 'i-coin', c: 2, r: 2, hot: true,
      text: 'Кешбэки обрабатываются и зачисляются в течение 48 часов. Просим вас ожидать.' },
  ];
  const flowText = (n) => {
    const t = state.templates.find((x) => x.title === n.title);
    return F.render(t ? t.body : n.text, fillVals());
  };

  function renderFlow() {
    $('#flow-map').innerHTML = FLOW.map((n, i) => `
      <button class="flow-node${n.r === 2 ? ' branch' : ''}${n.hot ? ' hot' : ''}" type="button" data-i="${i}" style="--c:${n.c};--r:${n.r};--d:${(i * 0.7) % 3.1}s">
        <span class="flow-ico"><svg><use href="#${n.icon}"/></svg></span>
        <span class="flow-label">${esc(n.label)}${n.hot ? '<i class="flow-hot">часто</i>' : ''}</span>
        <span class="flow-tip">${esc(flowText(n))}</span>
      </button>`).join('');
  }

  /* ---------- Подсказка шаблонов по черновику: «в работе сорри» → шаблоны «в работе» ---------- */
  let suggestList = [];
  function renderSuggest(draft, out) {
    const text = norm(draft + '\n' + out);
    const words = norm(draft).split(/\s+/).filter(Boolean).length;
    const found = [];
    if (words) {
      for (const t of state.templates) {
        let best = 0;
        for (const k of kwRaw(t).map(norm)) {
          if (k.length < 3 || /^\d+$/.test(k)) continue;
          // короткие ключи вроде «прив» срабатывают только в коротком черновике
          if (words > 3 && k.length < 5 && !k.includes(' ')) continue;
          if (wordHit(text, k)) best = Math.max(best, k.length + (k.includes(' ') ? 4 : 0));
        }
        if (best) found.push({ t, best });
      }
    }
    suggestList = found.sort((a, b) => b.best - a.best).slice(0, 3).map((x) => x.t);
    const box = $('#suggest');
    box.hidden = !suggestList.length;
    $('#suggest-list').innerHTML = suggestList.map((t, i) => `
      <button class="sug" type="button" data-i="${i}" style="--i:${i}">
        <span class="sug-cat">${esc(catOf(t))}</span>
        <b>${esc(t.title)}</b>
        <span class="sug-text">${esc(F.render(t.body, fillVals()))}</span>
      </button>`).join('');
  }

  function bindFlow() {
    const name = $('#op-name');
    name.value = state.opName;
    name.addEventListener('input', () => {
      state.opName = name.value.trim();
      store.set('opname', state.opName);
      renderFlow();
    });
    $('#flow-map').addEventListener('click', async (ev) => {
      const b = ev.target.closest('.flow-node');
      if (!b) return;
      if (await copyText(flowText(FLOW[b.dataset.i]))) {
        bubble(ev.clientX || b.getBoundingClientRect().left + 30, (ev.clientY || b.getBoundingClientRect().top) - 6);
        b.classList.add('copied');
        setTimeout(() => b.classList.remove('copied'), 900);
      }
    });
    $('#suggest-list').addEventListener('click', async (ev) => {
      const b = ev.target.closest('.sug');
      if (!b || !suggestList[b.dataset.i]) return;
      if (await copyText(F.render(suggestList[b.dataset.i].body, fillVals()))) {
        bubble(ev.clientX, ev.clientY - 6);
        afterCopy(suggestList[b.dataset.i]);
        b.classList.add('copied');
        setTimeout(() => b.classList.remove('copied'), 900);
      }
    });
    renderFlow();
  }

  let toneList = [];
  function renderTones(text) {
    toneList = text ? window.SuflerTones.variants(text) : [];
    const wrap = $('#tones');
    wrap.hidden = !toneList.length;
    $('#tones-list').innerHTML = toneList.map((v, i) => `
      <button class="tone" type="button" data-i="${i}" style="--i:${i}">
        <span class="tone-label">${esc(v.label)}</span>
        <span class="tone-hint">${esc(v.hint)}</span>
        <span class="tone-text">${esc(v.text)}</span>
      </button>`).join('');
  }

  async function copyResult(clear) {
    const btn = $('#btn-copy');
    if (!lastResult) { shake(btn); return; }
    if (await copyText(lastResult)) {
      pulse(btn);
      bubbleOver(btn);
      if (clear) {
        $('#draft').value = '';
        store.del('draft');
        renderResult();
        $('#draft').focus();
      }
    }
  }

  function bindCorrector() {
    const draft = $('#draft');
    draft.value = store.get('draft', '');
    let raf = 0;
    draft.addEventListener('input', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { renderResult(true); store.set('draft', draft.value); });
    });
    $('#btn-copy').addEventListener('click', () => copyResult(false));
    $('#btn-clear').addEventListener('click', () => { draft.value = ''; store.del('draft'); renderResult(); draft.focus(); });
    $('#btn-dict').addEventListener('click', openDict);
    $('#tones-list').addEventListener('click', async (ev) => {
      const b = ev.target.closest('.tone');
      if (!b || !toneList[b.dataset.i]) return;
      if (await copyText(toneList[b.dataset.i].text)) {
        bubble(ev.clientX, ev.clientY - 6);
        b.classList.add('copied');
        setTimeout(() => b.classList.remove('copied'), 900);
      }
    });
    renderResult();
  }

  /* ---------- Сокращения и словарь ---------- */

  function applyEntries(list) {
    state.entries = list;
    corrector.setEntries(list);
    store.set('entries', list);
    renderResult();
    renderDictList();
  }

  async function loadEntries() {
    const cached = store.get('entries', null);
    if (cached && cached.length) { state.entries = cached; corrector.setEntries(cached); }
    try {
      applyEntries(await api.listShortcuts());
    } catch (e) {
      if (!cached) corrector.setEntries(C.DEFAULT_ENTRIES);
    }
  }

  const DICT_DESC = {
    shortcut: 'Сокращение раскрывается в начале или посреди текста: «прив» → «здравствуйте!». Остальное исправляется как обычно.',
    typo: 'Пары «ошибка → правильно». Корректор заменяет слово целиком, регистр подстраивает сам.',
  };

  function openDict() {
    setDictKind(state.dictKind);
    $('#dict-filter').value = '';
    $('#dict-msg').textContent = '';
    openLayer($('#dict-modal'));
    setTimeout(() => (isAdmin() ? $('#dict-form [name=short]') : $('#dict-filter')).focus(), 50);
  }

  function setDictKind(kind) {
    state.dictKind = kind;
    $$('#dict-modal .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.kind === kind));
    $('#dict-desc').textContent = DICT_DESC[kind];
    $('#dict-form [name=short]').placeholder = kind === 'shortcut' ? 'прив' : 'изза';
    $('#dict-form [name=full]').placeholder = kind === 'shortcut' ? 'здравствуйте!' : 'из-за';
    renderDictList();
  }

  function renderDictList() {
    const ul = $('#dict-list');
    if (!ul) return;
    const q = norm($('#dict-filter').value.trim());
    const rows = state.entries
      .filter((e) => e.kind === state.dictKind)
      .filter((e) => !q || norm(e.short).includes(q) || norm(e.full).includes(q))
      .sort((a, b) => a.short.localeCompare(b.short, 'ru'));
    if (!rows.length) {
      ul.innerHTML = `<li class="empty-row">${q ? 'Ничего не нашлось' : 'Список пуст'}</li>`;
      return;
    }
    ul.innerHTML = rows.map((e, i) => `
      <li data-id="${esc(e.id)}" style="animation-delay:${Math.min(i, 20) * 12}ms">
        <span class="dict-short">${esc(e.short)}</span>
        <span class="dict-full">${esc(e.full)}</span>
        ${isAdmin() ? '<span class="row-actions"><button type="button" class="edit">Изменить</button><button type="button" class="del">Удалить</button></span>' : ''}
      </li>`).join('');
  }

  function dictError(e) {
    if (handleSessionError(e)) { renderDictList(); return; }
    const m = { DUPLICATE: 'Такое уже есть в списке.', VALIDATION: 'Заполните оба поля.', NETWORK: 'Нет связи с базой.' };
    $('#dict-msg').textContent = m[e.code] || 'Не получилось сохранить. Попробуйте ещё раз.';
  }

  function bindDict() {
    $$('#dict-modal .seg-btn').forEach((b) => b.addEventListener('click', () => setDictKind(b.dataset.kind)));
    $('#dict-filter').addEventListener('input', renderDictList);

    $('#dict-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const short = f.short.value.trim();
      const full = f.full.value.trim();
      $('#dict-msg').textContent = '';
      if (!short || !full) { $('#dict-msg').textContent = 'Заполните оба поля.'; return; }
      try {
        const row = await api.saveShortcut(state.session && state.session.token, { kind: state.dictKind, short, full });
        applyEntries([...state.entries, row]);
        f.reset();
        f.short.focus();
        toast(state.dictKind === 'shortcut' ? 'Сокращение добавлено' : 'Добавлено в словарь', 'ok');
      } catch (e) { dictError(e); }
    });

    $('#dict-list').addEventListener('click', async (ev) => {
      const li = ev.target.closest('li[data-id]');
      if (!li) return;
      const id = Number(li.dataset.id) || li.dataset.id;
      const entry = state.entries.find((x) => String(x.id) === String(id));
      if (!entry) return;

      if (ev.target.classList.contains('del')) {
        const ok = await confirmBox('Удалить из списка?', `«${entry.short} → ${entry.full}»`, 'Удалить');
        if (!ok) return;
        try {
          await api.deleteShortcut(state.session && state.session.token, entry.id);
          applyEntries(state.entries.filter((x) => x.id !== entry.id));
          toast('Удалено');
        } catch (e) { dictError(e); }
      }

      if (ev.target.classList.contains('edit')) {
        li.classList.add('editing');
        li.innerHTML = `<input class="e-short" value="${esc(entry.short)}" maxlength="60"><span class="arrow">→</span>
          <input class="e-full" value="${esc(entry.full)}" maxlength="1000">
          <span class="row-actions"><button type="button" class="save">Сохранить</button><button type="button" class="cancel">Отмена</button></span>`;
        $('.e-full', li).focus();
      }

      if (ev.target.classList.contains('cancel')) renderDictList();

      if (ev.target.classList.contains('save')) {
        const short = $('.e-short', li).value.trim();
        const full = $('.e-full', li).value.trim();
        try {
          const row = await api.saveShortcut(state.session && state.session.token, { id: entry.id, kind: entry.kind, short, full });
          applyEntries(state.entries.map((x) => (x.id === entry.id ? row : x)));
          toast('Сохранено', 'ok');
        } catch (e) { dictError(e); }
      }
    });

    $('#dict-list').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && ev.target.matches('.e-short, .e-full')) {
        ev.preventDefault();
        const save = $('.save', ev.target.closest('li'));
        if (save) save.click();
      }
    });
  }

  /* =====================================================================
   *  Шаблоны
   * ===================================================================== */

  async function loadTemplates() {
    const cached = store.get('templates', null);
    if (cached) { state.templates = cached; renderTemplates(); }
    try {
      state.templates = await api.listTemplates();
      store.set('templates', state.templates);
      renderTemplates();
    } catch (e) {
      if (!cached) {
        $('#tpl-list').innerHTML = '';
        const empty = $('#tpl-empty');
        empty.hidden = false;
        empty.innerHTML = '<b>Шаблоны не загрузились</b>Нет связи с базой. Обновите страницу чуть позже.';
      } else {
        toast('Нет связи с базой — показываю сохранённые шаблоны', 'warn');
      }
    }
  }

  // Порядок тем в списке; темы, которых здесь нет, идут следом по алфавиту.
  const CAT_ORDER = ['Быстрые фразы', 'Идентификация', 'Кредиты', 'ПТ и аресты', 'Переводы', 'Карты', 'Кешбэк', 'Bilim и Power Card',
    'Реферальная программа', 'Freedom Валюта', 'Рейтинг и eGov', 'Госуслуги', 'eSIM', 'Депозиты и лояльность', 'ВАРМ',
    'Сервисы и подписки', 'Приложение', 'Нерезиденты', 'Выписки и справки', 'Контакты', 'Уточнения', 'Отзывы и жалобы', 'Прочее'];
  const NO_CAT = 'Без темы';
  const catOf = (t) => (t.category && t.category.trim()) || NO_CAT;
  const catRank = (c) => { const i = CAT_ORDER.indexOf(c); return c === NO_CAT ? 999 : i < 0 ? 500 : i; };
  const byCat = (a, b) => catRank(a) - catRank(b) || a.localeCompare(b, 'ru');

  const LETTER = /[a-zа-я0-9әғқңөұүһі]/;
  // Совпадение с начала слова: «пт» найдёт «пт комиссия», но не «оптом».
  function wordHit(text, term) {
    if (!term) return false;
    for (let i = text.indexOf(term); i >= 0; i = text.indexOf(term, i + 1)) {
      if (i === 0 || !LETTER.test(text[i - 1])) return true;
    }
    return false;
  }
  const kwRaw = (t) => String(t.keyword || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);

  function rankOne(t, nq) {
    if (!nq) return null;
    const ks = kwRaw(t).map(norm);
    const kAll = ks.join(' , ');
    const ti = norm(t.title);
    const b = norm(t.body) + '\n' + norm(t.body_kz);
    if (ks.includes(nq)) return 0;
    if (ks.some((k) => k.startsWith(nq))) return 1;
    if (ks.some((k) => wordHit(k, nq))) return 1.5;
    if (wordHit(ti, nq)) return 2;
    if (wordHit(b, nq)) return 3;
    const terms = nq.split(' ');
    if (terms.length > 1 && terms.every((w) => wordHit(kAll, w) || wordHit(ti, w) || wordHit(b, w))) {
      return terms.every((w) => wordHit(kAll, w)) ? 3.5 : 4;
    }
    return null;
  }

  // Поиск. Номера, суммы, банки из строки поиска запоминаются в state.fill и подставляются в текст.
  function searchTemplates(q) {
    const raw = q.trim();
    const ex = F.extract(raw);
    state.fill = raw ? ex.values : {};
    state.rest = ex.rest;
    if (!raw) {
      const list = state.cat === 'all' ? state.templates : state.templates.filter((t) => catOf(t) === state.cat);
      return [...list].sort((a, b) => byCat(catOf(a), catOf(b)) || a.title.localeCompare(b.title, 'ru')).map((t) => ({ t, rank: 9 }));
    }
    const nq = norm(raw).replace(/\s+/g, ' ');
    const nr = norm(ex.rest).replace(/\s+/g, ' ');
    const keys = Object.keys(ex.values);
    const out = [];
    for (const t of state.templates) {
      let r = rankOne(t, nq);
      // совпадение без чисел/имён чуть слабее совпадения всей фразы: «кеш 48» — сначала ключ «кеш 48», потом просто «кеш»
      if (nr && nr !== nq) { const r2 = rankOne(t, nr); if (r2 !== null && (r === null || r2 + 0.1 < r)) r = r2 + 0.1; }
      if (r === null) continue;
      if (keys.length && F.placeholders(t.body + ' ' + (t.body_kz || '')).some((k) => keys.includes(k))) r -= 0.5;
      out.push({ t, rank: r });
    }
    return out.sort((a, b) => a.rank - b.rank || a.t.title.localeCompare(b.t.title, 'ru'));
  }

  // Какое ключевое слово показать на карточке: то, что совпало с поиском, иначе первое.
  function shownKeyword(t) {
    const list = kwRaw(t);
    const nq = norm(state.rest || $('#search').value.trim());
    if (nq) {
      const hit = list.find((k) => norm(k) === nq) || list.find((k) => norm(k).startsWith(nq)) || list.find((k) => wordHit(norm(k), nq));
      if (hit) return hit;
    }
    return list[0] || '';
  }

  const tplHasKz = (t) => !!(t.body_kz && t.body_kz.trim());
  const MARK = ['\uE010', '\uE011'];
  function tplText(t, lang, mark) {
    const src = lang === 'kz' && tplHasKz(t) ? t.body_kz : t.body;
    return F.render(src, fillVals(), mark);
  }
  // Значения из поиска + имя оператора
  // Значения из поиска + имя оператора + пожелание по времени суток
  const fillVals = () => ({ ...F.wishes(), ...state.fill, ...(state.opName ? { name: state.opName } : {}) });
  const AUTO_KEYS = ['wish', 'wish_kz'];
  const unmark = (html) => html.replace(/\uE010/g, '<span class="filled">').replace(/\uE011/g, '</span>');

  function fillNote(t) {
    const all = F.placeholders(t.body + ' ' + (t.body_kz || ''));
    const keys = all.filter((k) => !AUTO_KEYS.includes(k));
    const vals = fillVals();
    if (!keys.length) return all.length ? `<span class="tpl-fill ok">✓ «${esc(vals.wish)}» — по времени суток, само</span>` : '';
    const got = keys.filter((k) => vals[k]);
    const miss = keys.filter((k) => !vals[k] && k !== 'name');
    if (got.length) return `<span class="tpl-fill ok">✓ подставлено: ${esc(got.map((k) => F.LABELS[k]).join(', '))}</span>`;
    if (!miss.length) return '<span class="tpl-fill">своё имя впишите на вкладке «Корректор» — встанет в текст</span>';
    return `<span class="tpl-fill">можно подставить: ${esc(miss.map((k) => F.LABELS[k]).join(', '))} — допишите в поиск</span>`;
  }

  function termsRegex(q) {
    const terms = norm(q.trim()).split(/\s+/).filter(Boolean);
    if (!terms.length) return null;
    const all = [...new Set([terms.join(' '), ...terms])].sort((a, b) => b.length - a.length);
    const pat = all.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/е/g, '[её]').replace(/ /g, '\\s+')).join('|');
    return new RegExp(pat, 'giu');
  }

  function hl(text, re) {
    if (!re) return esc(text);
    let out = '';
    let last = 0;
    re.lastIndex = 0;
    for (const m of String(text).matchAll(re)) {
      if (!m[0]) continue;
      out += esc(text.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
      last = m.index + m[0].length;
    }
    return out + esc(text.slice(last));
  }

  // Если совпадение глубоко в тексте — показываем кусок вокруг него.
  // Подставленное значение важнее совпадения — показываем кусок вокруг него.
  function snippet(body, q) {
    const terms = norm(q.trim()).split(/\s+/).filter(Boolean);
    const nb = norm(body);
    let idx = body.indexOf(MARK[0]);
    if (idx < 0 && !terms.length) return body;
    if (idx < 0) idx = nb.indexOf(terms.join(' '));
    if (idx < 0) idx = Math.min(...terms.map((t) => { const i = nb.indexOf(t); return i < 0 ? Infinity : i; }));
    if (!isFinite(idx) || idx < 120) return body;
    const start = body.lastIndexOf(' ', idx - 50);
    return '…' + body.slice(start > 0 ? start + 1 : idx - 50);
  }

  function renderChips(searching) {
    const counts = new Map();
    state.templates.forEach((t) => counts.set(catOf(t), (counts.get(catOf(t)) || 0) + 1));
    state.topics.forEach((n) => { if (!counts.has(n)) counts.set(n, 0); });
    const cats = [...counts.keys()].sort(byCat);
    if (state.cat !== 'all' && !counts.has(state.cat)) state.cat = 'all';
    const box = $('#cat-chips');
    box.hidden = !state.templates.length;
    box.classList.toggle('searching', searching);
    box.innerHTML = [['all', 'Все', state.templates.length], ...cats.map((c) => [c, c, counts.get(c)])]
      .map(([id, label, n]) => `<button class="chip${state.cat === id ? ' active' : ''}${n ? '' : ' empty'}" type="button" data-cat="${esc(id)}">${esc(label)}<span>${n}</span></button>`)
      .join('') + (isAdmin() ? '<button class="chip chip-add" type="button" data-add-topic title="Добавить новую тему">+ Тема</button>' : '');
  }

  function cardHtml(t, i, q, re) {
    const text = tplText(t, state.lang, MARK);
    return `
      <article class="tpl" tabindex="0" data-id="${esc(t.id)}" style="--i:${i}">
        <div class="tpl-top">
          <span class="kw">${hl(shownKeyword(t), re)}</span>
          <h3>${hl(t.title, re)}</h3>
          ${tplHasKz(t) ? '<span class="kz-badge" title="Есть текст на казахском">ҚАЗ</span>' : ''}
          ${t.link ? '<svg class="tpl-link-dot" aria-label="есть ссылка"><use href="#i-link"/></svg>' : ''}
          ${t.has_image ? '<span class="shot-badge" title="К шаблону есть скриншот — без него не отправлять"><svg><use href="#i-image"/></svg>скрин</span>' : ''}
          ${t.notice ? '<span class="warn-badge" title="Перед отправкой проверьте: есть предупреждение">!</span>' : ''}
        </div>
        <p class="tpl-text">${unmark(hl(snippet(text, q), re))}</p>
        ${fillNote(t)}
        <div class="tpl-foot">
          <span class="tpl-hint">клик — копия · два — детали</span>
          <button class="tpl-more" type="button">Детали <span aria-hidden="true">→</span></button>
        </div>
      </article>`;
  }

  function renderTemplates() {
    if (state.templates.length) { renderFlow(); if (!belowTimer || !$('#suggest').classList.contains('waiting')) renderSuggest($('#draft').value, lastResult || ''); }
    // выбранная тема могла исчезнуть (удалили тему или последний шаблон в ней)
    if (state.cat !== 'all' && !state.topics.includes(state.cat) && !state.templates.some((t) => catOf(t) === state.cat)) state.cat = 'all';
    const q = $('#search').value;
    const searching = !!q.trim();
    const res = searchTemplates(q);
    const re = termsRegex(searching ? (state.rest || q) : '');
    const hq = searching ? (state.rest || q) : '';
    renderChips(searching);
    $$('#lang-seg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.lang === state.lang));
    $('#tab-count').textContent = state.templates.length || '';
    $('#tpl-count').textContent = searching ? `нашлось: ${res.length}` : state.cat === 'all' ? `всего: ${state.templates.length}` : `в теме: ${res.length}`;
    let html = '';
    if (!searching && state.cat === 'all') {
      let cur = null;
      res.forEach(({ t }, i) => {
        const c = catOf(t);
        if (c !== cur) { cur = c; html += `<h3 class="tpl-group" style="--i:${i}">${esc(c)}</h3>`; }
        html += cardHtml(t, i, hq, re);
      });
    } else {
      html = res.map(({ t }, i) => cardHtml(t, i, hq, re)).join('');
    }
    $('#tpl-list').innerHTML = html;
    const empty = $('#tpl-empty');
    if (!res.length) {
      empty.hidden = false;
      empty.innerHTML = state.templates.length && !searching && state.cat !== 'all'
        ? `<b>В теме «${esc(state.cat)}» пока нет шаблонов</b>${isAdmin() ? 'Добавьте первый кнопкой «+ Добавить шаблон» — тема подставится сама.' : 'Скоро появятся.'}`
        : state.templates.length
        ? `<b>Ничего не нашлось по «${esc(q.trim())}»</b>Даже кешбэк не помог. Попробуйте другое слово — или напишите ответ сами, корректор подстрахует.`
        : `<b>Шаблонов пока нет</b>${isOwner() ? 'Загрузите их во вкладке «Сессии» → «Импорт шаблонов».' : 'Скоро появятся.'}`;
    } else {
      empty.hidden = true;
    }
  }

  const findTpl = (id) => state.templates.find((t) => String(t.id) === String(id));

  async function copyTemplate(t, x, y, card, lang) {
    if (!t) return;
    lang = lang || state.lang;
    if (await copyText(tplText(t, lang))) {
      bubble(x, y);
      if (lang === 'kz' && !tplHasKz(t)) toast('Казахского текста у этого шаблона нет — скопирован русский', 'warn');
      afterCopy(t);
      if (card) {
        card.classList.add('copied');
        setTimeout(() => card.classList.remove('copied'), 900);
      }
    }
  }

  function bindTemplates() {
    let raf = 0;
    $('#search').addEventListener('input', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        $('#tpl-list').classList.add('quiet');
        renderTemplates();
      });
    });
    $('#search').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        const first = $('.tpl');
        if (first) {
          const r = first.getBoundingClientRect();
          copyTemplate(findTpl(first.dataset.id), r.left + r.width / 2, r.top + 10, first);
        }
      }
      if (ev.key === 'Escape') { ev.target.value = ''; renderTemplates(); }
    });

    $('#cat-chips').addEventListener('click', (ev) => {
      if (ev.target.closest('[data-add-topic]')) { openTopics(); return; }
      const b = ev.target.closest('.chip');
      if (!b) return;
      state.cat = b.dataset.cat;
      store.set('cat', state.cat);
      $('#tpl-list').classList.remove('quiet');
      if ($('#search').value.trim()) $('#search').value = '';
      renderTemplates();
    });
    $('#lang-seg').addEventListener('click', (ev) => {
      const b = ev.target.closest('.seg-btn');
      if (!b) return;
      state.lang = b.dataset.lang;
      store.set('lang', state.lang);
      renderTemplates();
    });

    const list = $('#tpl-list');
    // Один клик — копировать, двойной — только открыть детали (без копирования).
    // Поэтому одиночный клик ждём чуть-чуть: вдруг будет второй.
    let clickTimer = null;
    list.addEventListener('click', (ev) => {
      const card = ev.target.closest('.tpl');
      if (!card) return;
      if (ev.target.closest('.tpl-more')) { clearTimeout(clickTimer); openDetails(card.dataset.id); return; }
      clearTimeout(clickTimer);
      if (ev.detail > 1) return;
      const x = ev.clientX;
      const y = ev.clientY - 6;
      card.classList.add('pressing');
      clickTimer = setTimeout(() => {
        card.classList.remove('pressing');
        copyTemplate(findTpl(card.dataset.id), x, y, card);
      }, 230);
    });
    list.addEventListener('dblclick', (ev) => {
      const card = ev.target.closest('.tpl');
      clearTimeout(clickTimer);
      if (card) card.classList.remove('pressing');
      if (card && !ev.target.closest('.tpl-more')) openDetails(card.dataset.id);
    });
    list.addEventListener('keydown', (ev) => {
      const card = ev.target.closest('.tpl');
      if (!card || ev.target !== card) return;
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        if (ev.shiftKey) { openDetails(card.dataset.id); return; }
        const r = card.getBoundingClientRect();
        copyTemplate(findTpl(card.dataset.id), r.left + r.width / 2, r.top + 10, card);
      }
    });

    $('#btn-add-tpl').addEventListener('click', () => openTplForm(null));

    const drawerCopy = (btn, lang) => {
      const t = findTpl(state.openTemplateId);
      if (t) copyText(tplText(t, lang)).then((ok) => { if (ok) { pulse(btn); bubbleOver(btn); afterCopy(t); } });
    };
    $('#d-copy').addEventListener('click', () => drawerCopy($('#d-copy'), 'ru'));
    $('#d-copy-kz').addEventListener('click', () => drawerCopy($('#d-copy-kz'), 'kz'));
    $('#d-edit').addEventListener('click', () => {
      const t = findTpl(state.openTemplateId);
      closeLayer($('#drawer'));
      openTplForm(t);
    });
    $('#d-delete').addEventListener('click', async () => {
      const t = findTpl(state.openTemplateId);
      if (!t) return;
      const ok = await confirmBox('Удалить шаблон?', `«${t.title}» (${kwRaw(t)[0] || ''}) исчезнет у всех. Вернуть его можно будет только вручную.`, 'Удалить');
      if (!ok) return;
      try {
        await api.deleteTemplate(state.session && state.session.token, t.id);
        state.templates = state.templates.filter((x) => x.id !== t.id);
        store.set('templates', state.templates);
        closeLayer($('#drawer'));
        renderTemplates();
        toast('Шаблон удалён');
      } catch (e) {
        if (!handleSessionError(e)) toast('Не получилось удалить. Попробуйте ещё раз.', 'warn');
        else closeLayer($('#drawer'));
      }
    });

    $('#tpl-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const data = {
        id: f.dataset.id ? Number(f.dataset.id) || f.dataset.id : null,
        keyword: f.elements.keyword.value.trim(),
        title: f.elements.title.value.trim(),
        category: f.elements.category.value.trim(),
        body: f.elements.body.value.trim(),
        body_kz: f.elements.body_kz.value.trim(),
        link: f.elements.link.value.trim(),
        notice: f.elements.notice.value.trim(),
        image: formImage,
      };
      const msg = $('#tpl-form-msg');
      msg.textContent = '';
      if (!data.keyword || !data.title || !data.body) { msg.textContent = 'Ключевые слова, название и текст обязательны.'; return; }
      if (data.link && !/^https?:\/\//i.test(data.link)) data.link = 'https://' + data.link;
      const btn = $('button[type=submit]', f);
      btn.disabled = true;
      if (f.dataset.sid) {
        try {
          const r = await api.decideSuggestion(state.session && state.session.token, Number(f.dataset.sid) || f.dataset.sid, true, data);
          if (r && r.template) {
            let row = r.template;
            // предупреждение и скрин предложение не несёт — дописываем отдельным сохранением
            if (data.notice || formImage) row = await api.saveTemplate(state.session && state.session.token, { ...data, id: row.id });
            if (formImage !== undefined) imgCache.delete(String(row.id));
            state.templates = state.templates.some((x) => String(x.id) === String(row.id))
              ? state.templates.map((x) => (String(x.id) === String(row.id) ? row : x))
              : [...state.templates, row];
            store.set('templates', state.templates);
            renderTemplates();
          }
          closeLayer($('#tpl-modal'));
          toast('Предложение принято, шаблон сохранён', 'ok');
          loadSuggestions(true);
        } catch (e) {
          if (!handleSessionError(e)) msg.textContent = e.code === 'DUPLICATE' ? 'Это предложение уже решил другой админ.' : e.code === 'NETWORK' ? 'Нет связи с базой.' : 'Не получилось сохранить. Проверьте поля.';
        }
        btn.disabled = false;
        return;
      }
      try {
        const row = await api.saveTemplate(state.session && state.session.token, data);
        if (formImage !== undefined) imgCache.delete(String(row.id));
        if (data.id) state.templates = state.templates.map((x) => (String(x.id) === String(row.id) ? row : x));
        else state.templates = [...state.templates, row];
        store.set('templates', state.templates);
        renderTemplates();
        closeLayer($('#tpl-modal'));
        toast(data.id ? 'Шаблон обновлён' : 'Шаблон добавлен', 'ok');
      } catch (e) {
        if (!handleSessionError(e)) msg.textContent = e.code === 'NETWORK' ? 'Нет связи с базой.' : 'Не получилось сохранить. Проверьте поля.';
      }
      btn.disabled = false;
    });
  }

  function openDetails(id) {
    const t = findTpl(id);
    if (!t) return;
    state.openTemplateId = t.id;
    $('#d-cat').textContent = catOf(t);
    $('#d-keyword').textContent = kwRaw(t).join(' · ');
    $('#d-title').textContent = t.title;
    $('#d-body').innerHTML = unmark(esc(tplText(t, 'ru', MARK)));
    const kz = tplHasKz(t);
    $('#d-kz-wrap').hidden = !kz;
    $('#d-copy-kz').hidden = !kz;
    $('#d-copy-label').textContent = kz ? 'Копировать РУС' : 'Копировать';
    if (kz) $('#d-body-kz').innerHTML = unmark(esc(tplText(t, 'kz', MARK)));
    $('#d-fill').innerHTML = fillNote(t);
    const link = $('#d-link');
    if (t.link && /^https?:\/\//i.test(t.link)) {
      link.hidden = false;
      link.href = t.link;
      $('span', link).textContent = t.link;
    } else {
      link.hidden = true;
      link.removeAttribute('href');
    }
    const dn = $('#d-notice');
    dn.hidden = !t.notice;
    $('span', dn).textContent = t.notice || '';
    $('#d-shot').hidden = !t.has_image;
    const dimg = $('#d-shot-img');
    dimg.removeAttribute('src');
    if (t.has_image) getImage(t.id).then((u) => { if (u && String(state.openTemplateId) === String(t.id)) dimg.src = u; }).catch(() => {});
    $$('#drawer [data-admin]').forEach((el) => { el.hidden = !isAdmin(); });
    $('#d-suggest').hidden = isAdmin();
    openLayer($('#drawer'));
    setTimeout(() => $('#d-copy').focus(), 60);
  }

  function openTplForm(t) {
    if (!isAdmin()) return;
    const f = $('#tpl-form');
    f.reset();
    f.dataset.id = t ? t.id : '';
    f.dataset.sid = '';
    $('#tpl-form-title').textContent = t ? 'Редактировать шаблон' : 'Новый шаблон';
    $('#tpl-form-msg').textContent = '';
    const cats = [...new Set([...CAT_ORDER, ...state.topics, ...state.templates.map((x) => x.category).filter(Boolean)])];
    $('#cat-list').innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join('');
    formImage = undefined;
    setFormPreview(null);
    if (t && t.has_image) getImage(t.id).then((u) => { if (formImage === undefined && f.dataset.id === String(t.id)) setFormPreview(u); }).catch(() => {});
    if (t) {
      f.elements.notice.value = t.notice || '';
      f.elements.keyword.value = t.keyword;
      f.elements.title.value = t.title;
      f.elements.category.value = t.category || '';
      f.elements.body.value = t.body;
      f.elements.body_kz.value = t.body_kz || '';
      f.elements.link.value = t.link || '';
    } else if (state.cat !== 'all') {
      f.elements.category.value = state.cat === NO_CAT ? '' : state.cat;
    }
    openLayer($('#tpl-modal'));
    setTimeout(() => f.elements.keyword.focus(), 50);
  }

  /* =====================================================================
   *  Панель владельца
   * ===================================================================== */

  let sessionsTimer = null;

  async function loadSessions() {
    clearInterval(sessionsTimer);
    if (!isOwner() || state.tab !== 'owner') return;
    sessionsTimer = setInterval(() => { if (state.tab === 'owner' && !document.hidden) loadSessions(); }, 30000);
    const body = $('#sessions-body');
    try {
      const rows = await api.ownerSessions(state.session.token);
      if (!rows.length) {
        body.innerHTML = '<tr class="empty-row"><td colspan="5">Никого. Тишина, как в отделении в 8:59.</td></tr>';
        return;
      }
      const H9 = 9 * 3600 * 1000;
      body.innerHTML = rows.map((s, i) => {
        const left = new Date(s.expires_at).getTime() - Date.now();
        const pct = Math.max(0, Math.min(100, (left / H9) * 100));
        const t = new Date(s.created_at);
        const when = t.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        return `<tr class="${s.is_me ? 'me' : ''}" style="animation-delay:${i * 50}ms">
          <td><b>${esc(s.code)}</b>${s.is_me ? '<span class="me-badge">Это вы</span>' : ''}</td>
          <td>${esc(ROLE_NAMES[s.role] || s.role)}</td>
          <td>${esc(when)}</td>
          <td>${fmtLeft(left)}<div class="bar"><span style="width:${pct}%"></span></div></td>
          <td><button class="btn danger kick" type="button" data-id="${esc(s.id)}" data-me="${s.is_me ? 1 : ''}">Выкинуть</button></td>
        </tr>`;
      }).join('');
    } catch (e) {
      if (!handleSessionError(e)) body.innerHTML = '<tr class="empty-row"><td colspan="5">Не получилось загрузить. Нажмите «Обновить».</td></tr>';
    }
  }

  function bindOwner() {
    $('#btn-sessions-refresh').addEventListener('click', loadSessions);
    $('#sessions-body').addEventListener('click', async (ev) => {
      const b = ev.target.closest('.kick');
      if (!b) return;
      const me = !!b.dataset.me;
      const ok = await confirmBox(me ? 'Выкинуть самого себя?' : 'Выкинуть сессию?',
        me ? 'Вы станете гостем, а место кода освободится.' : 'Человек станет гостем при следующем действии, место кода освободится сразу.', 'Выкинуть');
      if (!ok) return;
      try {
        await api.kick(state.session.token, b.dataset.id);
        if (me) { demote('kicked'); return; }
        toast('Сессия завершена', 'ok');
        loadSessions();
      } catch (e) {
        if (!handleSessionError(e)) toast('Не получилось. Попробуйте ещё раз.', 'warn');
      }
    });

    const text = $('#import-text');
    let parsed = { items: [], errors: [] };
    const preview = () => {
      parsed = parseImport(text.value);
      const p = $('#import-preview');
      p.classList.toggle('bad', !!parsed.errors.length && !parsed.items.length);
      if (!text.value.trim()) { p.textContent = ''; }
      else {
        p.textContent = `Готово к импорту: ${parsed.items.length}` +
          (parsed.errors.length ? ` · пропущено: ${parsed.errors.length} (${parsed.errors.slice(0, 3).join('; ')}${parsed.errors.length > 3 ? '…' : ''})` : '');
      }
      $('#btn-import').disabled = !parsed.items.length;
    };
    text.addEventListener('input', preview);
    $('#import-file').addEventListener('change', async (ev) => {
      const f = ev.target.files[0];
      if (!f) return;
      text.value = await f.text();
      ev.target.value = '';
      preview();
    });
    $('#btn-import').addEventListener('click', async () => {
      const replace = $('#import-replace').checked;
      const ok = await confirmBox('Импортировать шаблоны?',
        `Будет добавлено: ${parsed.items.length}.` + (replace ? ' Все текущие шаблоны будут удалены.' : ''), 'Импортировать');
      if (!ok) return;
      const btn = $('#btn-import');
      btn.disabled = true;
      try {
        const r = await api.importTemplates(state.session.token, parsed.items, replace);
        toast(`Загружено шаблонов: ${r.inserted}`, 'ok');
        text.value = '';
        preview();
        await loadTemplates();
      } catch (e) {
        if (!handleSessionError(e)) toast('Импорт не прошёл. Проверьте формат и связь.', 'warn');
      }
      btn.disabled = !parsed.items.length;
    });
  }

  // JSON-массив или блоки «ключ: / название: / тема: / ссылка: / текст: / текст каз:», разделённые строкой ===.
  function parseImport(raw) {
    const items = [];
    const errors = [];
    const src = String(raw || '').trim();
    if (!src) return { items, errors };
    const pick = (o, keys) => { for (const k of keys) if (o[k] != null && String(o[k]).trim()) return String(o[k]).trim(); return ''; };
    if (src.startsWith('[')) {
      try {
        const arr = JSON.parse(src);
        arr.forEach((o, i) => {
          const t = {
            keyword: pick(o, ['keyword', 'keywords', 'ключ', 'key']),
            title: pick(o, ['title', 'название', 'name']),
            category: pick(o, ['category', 'тема', 'раздел']),
            body: pick(o, ['body', 'text', 'текст']),
            body_kz: pick(o, ['body_kz', 'kz', 'текст_каз', 'каз']),
            link: pick(o, ['link', 'url', 'ссылка']),
          };
          if (t.keyword && t.title && t.body) items.push(t); else errors.push(`№${i + 1}: не хватает полей`);
        });
      } catch (e) { errors.push('JSON не читается'); }
      return { items, errors };
    }
    src.split(/^\s*={3,}\s*$/m).forEach((block, i) => {
      if (!block.trim()) return;
      const t = { keyword: '', title: '', category: '', body: '', body_kz: '', link: '' };
      const lines = block.replace(/\r/g, '').split('\n');
      let where = null; // null | 'ru' | 'kz'
      const ru = [];
      const kz = [];
      for (const line of lines) {
        const kzm = line.match(/^\s*(?:текст\s*)?(?:каз|қаз|kz)\s*:\s*(.*)$/i);
        if (kzm) { where = 'kz'; if (kzm[1].trim()) kz.push(kzm[1]); continue; }
        if (where === 'kz') { kz.push(line); continue; }
        if (where === 'ru') { ru.push(line); continue; }
        const m = line.match(/^\s*(ключ(?:евые слова|евое слово|и)?|название|тема|раздел|ссылка|текст)\s*:\s*(.*)$/i);
        if (!m) { if (line.trim()) ru.push(line); continue; }
        const key = m[1].toLowerCase();
        if (key.startsWith('ключ')) t.keyword = m[2].trim();
        else if (key === 'название') t.title = m[2].trim();
        else if (key === 'тема' || key === 'раздел') t.category = m[2].trim();
        else if (key === 'ссылка') t.link = m[2].trim();
        else { where = 'ru'; if (m[2].trim()) ru.push(m[2]); }
      }
      t.body = ru.join('\n').trim();
      t.body_kz = kz.join('\n').trim();
      if (t.keyword && t.title && t.body) items.push(t);
      else errors.push(`блок ${i + 1}: ${!t.keyword ? 'нет ключа' : !t.title ? 'нет названия' : 'нет текста'}`);
    });
    return { items, errors };
  }

  /* =====================================================================
   *  Объявления о массовых сбоях (видят все, публикуют админ и владелец)
   * ===================================================================== */

  let annList = [];
  const annHidden = () => store.get('annHidden', []);
  const hoursWord = (n) => {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return n + ' час';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return n + ' часа';
    return n + ' часов';
  };
  function fmtUntil(iso) {
    const d = new Date(iso);
    const t = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date().toDateString() ? 'до ' + t : 'до ' + d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ', ' + t;
  }
  const fmtWhen = (iso) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  async function loadAnnouncements() {
    try { annList = await api.announcements(); } catch (e) { return; }
    const ids = annList.map((a) => a.id);
    store.set('annHidden', annHidden().filter((id) => ids.includes(id)));
    renderAnnouncements();
  }

  function renderAnnouncements() {
    const now = Date.now();
    annList = annList.filter((a) => new Date(a.expires_at).getTime() > now);
    const hidden = annHidden();
    const shown = annList.filter((a) => !hidden.includes(a.id));
    const bar = $('#ann-bar');
    bar.hidden = !shown.length;
    bar.innerHTML = shown.map((a) => `
      <div class="ann" data-id="${esc(a.id)}">
        <svg class="ann-ico"><use href="#i-megaphone"/></svg>
        <div class="ann-text">${esc(a.body)}<span class="ann-meta">${esc(fmtUntil(a.expires_at))}${a.author ? ' · ' + esc(a.author) : ''}</span></div>
        ${isAdmin() ? '<button class="ann-end" type="button" data-end>Снять</button>' : ''}
        <button class="ann-hide" type="button" data-hide title="Скрыть у себя" aria-label="Скрыть"><svg><use href="#i-close"/></svg></button>
      </div>`).join('');
    const nHidden = annList.length - shown.length;
    $('#ann-pill').hidden = !nHidden;
    $('#ann-pill-n').textContent = nHidden > 1 ? String(nHidden) : '';
    $('#ann-active').innerHTML = annList.length && isAdmin()
      ? '<h3>Сейчас висят</h3>' + annList.map((a) => `
          <div class="ann-row" data-id="${esc(a.id)}"><span>${esc(a.body)}<small>${esc(fmtUntil(a.expires_at))}${a.author ? ' · ' + esc(a.author) : ''}</small></span>
          <button class="btn danger" type="button" data-end>Снять</button></div>`).join('')
      : '';
  }

  async function endAnnouncement(id) {
    const ok = await confirmBox('Снять объявление?', 'Оно пропадёт у всех.', 'Снять');
    if (!ok) return;
    try {
      await api.announceEnd(state.session && state.session.token, Number(id) || id);
      annList = annList.filter((a) => String(a.id) !== String(id));
      renderAnnouncements();
      toast('Объявление снято', 'ok');
    } catch (e) {
      if (!handleSessionError(e)) toast('Не получилось снять. Попробуйте ещё раз.', 'warn');
    }
  }

  function annHoursChanged() {
    const f = $('#ann-form');
    const h = Number(f.elements.hours.value);
    $('#ann-hours-val').textContent = hoursWord(h);
    $('#ann-until').textContent = 'Пропадёт ' + fmtUntil(new Date(Date.now() + h * 3600 * 1000).toISOString()) + '.';
    $$('#ann-quick button').forEach((b) => b.classList.toggle('active', Number(b.dataset.h) === h));
  }

  /* =====================================================================
   *  Предложения шаблонов от операторов
   * ===================================================================== */

  let suggList = [];
  let suggFilter = 'pending';

  function openSuggest(t) {
    const f = $('#sug-form');
    f.reset();
    f.dataset.kind = t ? 'fix' : 'new';
    f.dataset.tid = t ? t.id : '';
    $('#sug-form-title').textContent = t ? 'Предложить правку' : 'Предложить шаблон';
    $('#sug-form-desc').textContent = t ? `Шаблон «${t.title}». Исправьте текст как нужно — админ посмотрит и применит.` : 'Админы посмотрят и добавят шаблон, если он подходит.';
    $$('#sug-form [data-new]').forEach((el) => { el.hidden = !!t; });
    $('#sug-msg').textContent = '';
    if (t) f.elements.body.value = t.body;
    f.elements.author.value = state.opName || store.get('sugAuthor', '');
    const cats = [...new Set([...CAT_ORDER, ...state.templates.map((x) => x.category).filter(Boolean)])];
    $('#cat-list').innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join('');
    openLayer($('#sug-modal'));
    setTimeout(() => (t ? f.elements.body : f.elements.keyword).focus(), 50);
  }

  async function loadSuggestions(quiet) {
    if (!isAdmin()) return;
    try {
      suggList = await api.suggestions(state.session.token);
    } catch (e) {
      if (!handleSessionError(e) && !quiet) toast('Не получилось загрузить предложения', 'warn');
      return;
    }
    const pending = suggList.filter((s) => s.status === 'pending').length;
    $('#sugg-count').textContent = pending || '';
    renderSuggestions();
  }

  function renderSuggestions() {
    const list = suggList.filter((s) => (suggFilter === 'pending' ? s.status === 'pending' : s.status !== 'pending'));
    $$('#sugg-filter .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.f === suggFilter));
    $('#sugg-list').innerHTML = list.map((s) => {
      const isFix = s.kind === 'fix';
      const title = isFix ? (s.template_title || 'шаблон удалён') : s.title;
      const who = s.author ? esc(s.author) : 'оператора';
      const status = s.status === 'pending' ? '' : `<p class="sug-status ${s.status === 'accepted' ? 'ok' : 'no'}">${s.status === 'accepted' ? 'Принято' : 'Отклонено'} · ${esc(s.decided_by || '')} · ${esc(fmtWhen(s.decided_at))}</p>`;
      return `
        <article class="sug-card" data-id="${esc(s.id)}">
          <div class="sug-head">
            <span class="sug-kind ${isFix ? 'fix' : 'new'}">${isFix ? 'Правка' : 'Новый шаблон'}</span>
            <b>${esc(title)}</b>
            <span class="sug-from">от ${who} · ${esc(fmtWhen(s.created_at))}</span>
          </div>
          ${!isFix ? `<p class="sug-meta">Ключи: ${esc(s.keyword || '')}${s.category ? ' · тема: ' + esc(s.category) : ''}</p>` : ''}
          ${isFix && s.template_body ? `<details class="sug-old"><summary>Сейчас в шаблоне</summary><div class="sug-text">${esc(s.template_body)}</div></details>` : ''}
          <div class="sug-text">${esc(s.body)}</div>
          ${s.note ? `<p class="sug-note">«${esc(s.note)}»</p>` : ''}
          ${s.status === 'pending' ? `<div class="sug-actions">
            <button class="btn btn-green" type="button" data-act="accept"${isFix && !s.template_title ? ' disabled' : ''}>${isFix ? 'Открыть и применить' : 'Открыть и добавить'}</button>
            <button class="btn ghost" type="button" data-act="reject">Отклонить</button></div>` : status}
        </article>`;
    }).join('');
    const empty = $('#sugg-empty');
    empty.hidden = !!list.length;
    empty.innerHTML = suggFilter === 'pending' ? '<b>Новых предложений нет</b>Операторы предлагают шаблоны кнопкой «Предложить шаблон» во вкладке «Шаблоны».' : '<b>Пока ничего не решали</b>';
  }

  // «Открыть и добавить»: форма шаблона, заполненная предложением; сохранение = принять предложение
  function acceptSuggestion(s) {
    const base = s.kind === 'fix' ? findTpl(s.template_id) : null;
    openTplForm(base || null);
    const f = $('#tpl-form');
    f.dataset.sid = s.id;
    $('#tpl-form-title').textContent = s.kind === 'fix' ? 'Применить правку' : 'Добавить предложенный шаблон';
    if (s.kind === 'fix') {
      f.elements.keyword.value = base ? base.keyword : (s.template_keyword || '');
      f.elements.title.value = base ? base.title : (s.template_title || '');
      f.elements.category.value = base ? base.category || '' : (s.template_category || '');
    } else {
      f.elements.keyword.value = s.keyword || '';
      f.elements.title.value = s.title || '';
      f.elements.category.value = s.category || '';
    }
    f.elements.body.value = s.body;
  }

  async function rejectSuggestion(s) {
    const ok = await confirmBox('Отклонить предложение?', s.author ? `Предложение от ${s.author} уйдёт в «Решённые».` : 'Предложение уйдёт в «Решённые».', 'Отклонить');
    if (!ok) return;
    try {
      await api.decideSuggestion(state.session.token, s.id, false);
      toast('Предложение отклонено');
      loadSuggestions();
    } catch (e) {
      if (!handleSessionError(e)) toast(e.code === 'DUPLICATE' ? 'Его уже решил другой админ' : 'Не получилось. Попробуйте ещё раз.', 'warn');
      loadSuggestions(true);
    }
  }

  /* =====================================================================
   *  Журнал изменений (владелец)
   * ===================================================================== */

  let journalRows = [];
  async function loadJournal() {
    if (!isOwner()) return;
    try {
      journalRows = await api.journal(state.session.token);
    } catch (e) {
      if (!handleSessionError(e)) $('#journal-list').innerHTML = '<p class="muted small">Не получилось загрузить журнал.</p>';
      return;
    }
    renderJournal();
  }
  function renderJournal() {
    const q = norm($('#journal-filter').value.trim());
    const rows = q ? journalRows.filter((j) => norm(j.actor + ' ' + j.action + ' ' + j.details).includes(q)) : journalRows;
    $('#journal-list').innerHTML = rows.length
      ? rows.slice(0, 400).map((j) => `
          <div class="j-row">
            <time>${esc(fmtWhen(j.at))}</time>
            <b class="j-who">${esc(j.actor)}</b>
            <span class="j-act ${/удал|отклон|снят/i.test(j.action) ? 'neg' : /добав|принят|Объявление$/i.test(j.action) ? 'pos' : ''}">${esc(j.action)}</span>
            <span class="j-det">${esc(j.details)}</span>
          </div>`).join('')
      : '<p class="muted small">Записей нет.</p>';
  }

  function bindTeam() {
    // объявления
    $('#btn-announce').addEventListener('click', () => {
      const f = $('#ann-form');
      f.reset();
      $('#ann-msg').textContent = '';
      annHoursChanged();
      renderAnnouncements();
      openLayer($('#ann-modal'));
      setTimeout(() => f.elements.body.focus(), 50);
    });
    $('#ann-form').elements.hours.addEventListener('input', annHoursChanged);
    $('#ann-quick').addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-h]');
      if (!b) return;
      $('#ann-form').elements.hours.value = b.dataset.h;
      annHoursChanged();
    });
    $('#ann-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const body = f.elements.body.value.trim();
      const hours = Number(f.elements.hours.value);
      if (!body) { $('#ann-msg').textContent = 'Напишите текст объявления.'; return; }
      const btn = $('button[type=submit]', f);
      btn.disabled = true;
      try {
        const a = await api.announce(state.session && state.session.token, body, hours);
        annList = [a, ...annList];
        store.set('annHidden', annHidden().filter((id) => id !== a.id));
        renderAnnouncements();
        closeLayer($('#ann-modal'));
        toast(`Объявление опубликовано на ${hoursWord(hours)}`, 'ok');
      } catch (e) {
        if (!handleSessionError(e)) $('#ann-msg').textContent = e.code === 'NETWORK' ? 'Нет связи с базой.' : 'Не получилось опубликовать.';
        else closeLayer($('#ann-modal'));
      }
      btn.disabled = false;
    });
    $('#ann-bar').addEventListener('click', (ev) => {
      const row = ev.target.closest('.ann');
      if (!row) return;
      if (ev.target.closest('[data-hide]')) {
        store.set('annHidden', [...new Set([...annHidden(), Number(row.dataset.id) || row.dataset.id])]);
        renderAnnouncements();
      } else if (ev.target.closest('[data-end]')) {
        endAnnouncement(row.dataset.id);
      }
    });
    $('#ann-active').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-end]');
      if (b) endAnnouncement(b.closest('.ann-row').dataset.id);
    });
    $('#ann-pill').addEventListener('click', () => {
      store.set('annHidden', []);
      renderAnnouncements();
    });
    setInterval(() => { if (!document.hidden) loadAnnouncements(); }, 60000);
    setInterval(renderAnnouncements, 30000); // убрать истёкшие без запроса
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAnnouncements(); });

    // предложения
    $('#btn-suggest').addEventListener('click', () => openSuggest(null));
    $('#d-suggest').addEventListener('click', () => {
      const t = findTpl(state.openTemplateId);
      closeLayer($('#drawer'));
      if (t) openSuggest(t);
    });
    $('#sug-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const kind = f.dataset.kind;
      const data = {
        kind,
        template_id: kind === 'fix' ? Number(f.dataset.tid) || f.dataset.tid : null,
        keyword: f.elements.keyword.value.trim(),
        title: f.elements.title.value.trim(),
        category: f.elements.category.value.trim(),
        body: f.elements.body.value.trim(),
        note: f.elements.note.value.trim(),
        author: f.elements.author.value.trim(),
      };
      const msg = $('#sug-msg');
      msg.textContent = '';
      if (!data.body || (kind === 'new' && (!data.keyword || !data.title))) {
        msg.textContent = kind === 'new' ? 'Нужны ключевые слова, название и текст.' : 'Напишите исправленный текст.';
        return;
      }
      if (kind === 'fix') {
        const t = findTpl(data.template_id);
        if (t && t.body.trim() === data.body && !data.note) { msg.textContent = 'Текст не изменился — поправьте его или напишите комментарий.'; return; }
      }
      if (data.author) store.set('sugAuthor', data.author);
      const btn = $('button[type=submit]', f);
      btn.disabled = true;
      try {
        await api.suggest(data);
        closeLayer($('#sug-modal'));
        toast('Спасибо! Админы посмотрят предложение', 'ok');
        if (isAdmin()) loadSuggestions(true);
      } catch (e) {
        msg.textContent = e.code === 'TOO_MANY' ? 'Слишком много предложений подряд. Попробуйте через час.'
          : e.code === 'NETWORK' ? 'Нет связи с базой.' : 'Не получилось отправить. Проверьте поля.';
      }
      btn.disabled = false;
    });
    $('#sugg-filter').addEventListener('click', (ev) => {
      const b = ev.target.closest('.seg-btn');
      if (!b) return;
      suggFilter = b.dataset.f;
      renderSuggestions();
    });
    $('#btn-sugg-refresh').addEventListener('click', () => loadSuggestions());
    $('#sugg-list').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-act]');
      if (!b) return;
      const s = suggList.find((x) => String(x.id) === b.closest('.sug-card').dataset.id);
      if (!s) return;
      if (b.dataset.act === 'accept') acceptSuggestion(s);
      else rejectSuggestion(s);
    });
    setInterval(() => { if (isAdmin() && !document.hidden) loadSuggestions(true); }, 120000);

    // журнал
    $('#btn-journal-refresh').addEventListener('click', loadJournal);
    let jt = 0;
    $('#journal-filter').addEventListener('input', () => { clearTimeout(jt); jt = setTimeout(renderJournal, 150); });
  }

  /* =====================================================================
   *  Предупреждение при копировании и скриншоты шаблонов
   * ===================================================================== */

  // Скрин грузится из базы только когда нужен и запоминается до перезагрузки страницы.
  const imgCache = new Map();
  function getImage(id) {
    const key = String(id);
    if (!imgCache.has(key)) {
      imgCache.set(key, Promise.resolve(api.templateImage(id)).catch((e) => { imgCache.delete(key); throw e; }));
    }
    return imgCache.get(key);
  }

  function loadImg(url) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('image'));
      im.src = url;
    });
  }

  // Буфер обмена браузера принимает картинки только в PNG
  async function toPngBlob(url) {
    if (!url) throw new Error('no image');
    const im = await loadImg(url);
    const c = document.createElement('canvas');
    c.width = im.naturalWidth;
    c.height = im.naturalHeight;
    c.getContext('2d').drawImage(im, 0, 0);
    return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
  }

  async function copyImage(id, btn) {
    try {
      if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) throw new Error('no clipboard');
      // промис внутри ClipboardItem — чтобы браузер не потерял «клик пользователя», пока картинка готовится
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': getImage(id).then(toPngBlob) })]);
      if (btn) { pulse(btn); bubbleOver(btn); }
      toast('Скрин скопирован — вставьте его в Ч2Д (Ctrl+V)', 'ok');
      return true;
    } catch (e) {
      // запасной путь: открыть скрин крупно — его можно скопировать правой кнопкой мыши
      toast('Браузер не дал скопировать картинку сам. Нажмите на скрин правой кнопкой → «Копировать изображение».', 'warn', 7000);
      if ($('#shot-view').hidden) viewShot(id);
      return false;
    }
  }

  let shotId = null;
  async function viewShot(id) {
    shotId = id;
    const img = $('#sv-img');
    img.removeAttribute('src');
    openLayer($('#shot-view'));
    try { const u = await getImage(id); if (shotId === id && u) img.src = u; } catch (e) { toast('Скрин не загрузился. Проверьте связь.', 'warn'); }
  }

  let noticeTpl = null;
  function afterCopy(t) {
    if (!t || (!t.notice && !t.has_image)) return;
    noticeTpl = t;
    $('#nm-title').textContent = t.has_image ? 'Текст скопирован. Без скрина не отправлять!' : 'Текст скопирован. Проверьте перед отправкой';
    const text = $('#nm-text');
    text.textContent = t.notice || '';
    text.hidden = !t.notice;
    $('#nm-steps').hidden = !t.has_image;
    ['#nm-shot', '#nm-view', '#nm-copy-img'].forEach((s) => { $(s).hidden = !t.has_image; });
    const img = $('#nm-img');
    img.removeAttribute('src');
    $('#nm-loading').hidden = false;
    openLayer($('#notice-modal'));
    setTimeout(() => $(t.has_image ? '#nm-copy-img' : '#nm-ok').focus(), 60);
    if (t.has_image) {
      getImage(t.id).then((u) => {
        if (noticeTpl !== t || !u) return;
        img.src = u;
        $('#nm-loading').hidden = true;
      }).catch(() => { $('#nm-loading').textContent = 'Скрин не загрузился — проверьте связь'; });
    }
  }

  /* ---------- «Лоханулся»: ошибочно отправленное сообщение ---------- */
  const OOPS_TITLE = 'Лоханулся: предыдущее сообщение отправлено ошибочно';
  const OOPS_TEXT = 'Просим не обращать внимания на предыдущее сообщение, оно было отправлено ошибочно.';
  const BYE_TITLE = 'Прощание (по времени суток)';
  const BYE_TEXT = 'Спасибо, что обратились в поддержку Freedom Bank. Желаем вам {пожелание}! 💚';
  function byeText() {
    const t = state.templates.find((x) => x.title === BYE_TITLE);
    return t ? tplText(t, 'ru') : F.render(BYE_TEXT, fillVals());
  }
  function oopsText(lang) {
    const t = state.templates.find((x) => x.title === OOPS_TITLE);
    if (!t) return OOPS_TEXT;
    return tplText(t, lang);
  }

  /* ---------- Скрин в форме шаблона ---------- */
  let formImage; // undefined — не трогали, '' — убрать, data:… — новый скрин
  function setFormPreview(url) {
    const img = $('#tpl-img-preview');
    if (url) { img.src = url; img.hidden = false; } else { img.removeAttribute('src'); img.hidden = true; }
    $('#tpl-img-hint').hidden = !!url;
    $('#tpl-img-remove').hidden = !url;
  }
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }
  // Уменьшаем до 1600 px по большей стороне и берём то, что легче: PNG или JPEG.
  async function shrinkImage(file) {
    const im = await loadImg(await readFile(file));
    const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * k);
    c.height = Math.round(im.naturalHeight * k);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(im, 0, 0, c.width, c.height);
    const png = c.toDataURL('image/png');
    const jpg = c.toDataURL('image/jpeg', 0.88);
    let best = png.length < jpg.length ? png : jpg;
    if (best.length > 2900000) best = c.toDataURL('image/jpeg', 0.7);
    if (best.length > 2900000) throw new Error('too big');
    return best;
  }
  async function takeFormImage(file) {
    if (!file || !/^image\//.test(file.type)) return;
    try {
      formImage = await shrinkImage(file);
      setFormPreview(formImage);
    } catch (e) {
      $('#tpl-form-msg').textContent = 'Картинка слишком большая или повреждена. Попробуйте другой скрин.';
    }
  }

  /* =====================================================================
   *  Темы шаблонов
   * ===================================================================== */

  async function loadTopics() {
    try {
      state.topics = await api.listTopics();
      store.set('topics', state.topics);
      renderTemplates();
    } catch (e) { /* темы не критичны */ }
  }

  function openTopics() {
    if (!isAdmin()) return;
    const f = $('#topic-form');
    f.reset();
    $('#topic-form-msg').textContent = '';
    renderTopicList();
    openLayer($('#topic-modal'));
    setTimeout(() => f.elements.name.focus(), 50);
  }

  function renderTopicList() {
    const used = new Set(state.templates.map(catOf));
    const empty = state.topics.filter((n) => !used.has(n));
    $('#topic-empty').hidden = !empty.length;
    $('#topic-list').innerHTML = empty.map((n) => `<li><span>${esc(n)}</span><button class="btn ghost" type="button" data-del-topic="${esc(n)}">Удалить</button></li>`).join('');
  }

  /* =====================================================================
   *  Программы (ссылки на рабочие системы)
   * ===================================================================== */

  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? u : '');
  const urlHost = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch (e) { return u; } };
  const appMark = (title) => {
    const w = String(title || '?').trim().split(/\s+/);
    return (w.length > 1 && w[0].length < 4 ? w[0] : w[0].slice(0, 2)).slice(0, 3);
  };

  async function loadLinks() {
    try {
      state.links = await api.listLinks();
      store.set('links', state.links);
    } catch (e) {
      if (!state.links.length) {
        $('#apps-empty').hidden = false;
        $('#apps-empty').innerHTML = '<b>Список не загрузился</b>Нет связи с базой. Обновите страницу чуть позже.';
        return;
      }
    }
    renderLinks();
  }

  function renderLinks() {
    const list = state.links;
    $('#apps-list').innerHTML = list.map((l, i) => {
      const url = safeUrl(l.url);
      return `
      <article class="app-card" style="--i:${i}" data-id="${esc(l.id)}">
        <a class="app-open" ${url ? `href="${esc(url)}"` : ''} target="_blank" rel="noopener noreferrer">
          <span class="app-mark" aria-hidden="true">${esc(appMark(l.title))}</span>
          <span class="app-main">
            <b>${esc(l.title)}</b>
            <span class="app-host">${esc(urlHost(l.url))}</span>
            ${l.note ? `<span class="app-note">${esc(l.note)}</span>` : ''}
          </span>
          <svg class="app-ext" aria-hidden="true"><use href="#i-external"/></svg>
        </a>
        <div class="app-actions">
          <button class="btn ghost app-copy" type="button"><svg class="ico"><use href="#i-copy"/></svg>Ссылка</button>
          ${isAdmin() ? '<button class="btn ghost app-edit" type="button">Изменить</button>' : ''}
        </div>
      </article>`;
    }).join('');
    const empty = $('#apps-empty');
    empty.hidden = !!list.length;
    if (!list.length) empty.innerHTML = `<b>Программ пока нет</b>${isAdmin() ? 'Добавьте первую кнопкой «+ Добавить программу».' : 'Скоро админ их добавит.'}`;
  }

  function openAppForm(l) {
    if (!isAdmin()) return;
    const f = $('#app-form');
    f.reset();
    f.dataset.id = l ? l.id : '';
    $('#app-form-title').textContent = l ? 'Изменить программу' : 'Новая программа';
    $('#app-form-msg').textContent = '';
    $('#app-delete').hidden = !l;
    if (l) {
      f.elements.title.value = l.title;
      f.elements.url.value = l.url;
      f.elements.note.value = l.note || '';
      f.elements.sort.value = l.sort == null ? 100 : l.sort;
    } else {
      f.elements.sort.value = state.links.length ? Math.max(...state.links.map((x) => x.sort || 0)) + 1 : 1;
    }
    openLayer($('#app-modal'));
    setTimeout(() => f.elements.title.focus(), 50);
  }

  function bindExtra() {
    // окно после копирования
    $('#nm-copy-img').addEventListener('click', () => noticeTpl && copyImage(noticeTpl.id, $('#nm-copy-img')));
    $('#nm-view').addEventListener('click', () => noticeTpl && viewShot(noticeTpl.id));
    $('#nm-shot').addEventListener('click', () => noticeTpl && viewShot(noticeTpl.id));
    $('#sv-copy').addEventListener('click', () => shotId != null && copyImage(shotId, $('#sv-copy')));
    $('#d-shot-copy').addEventListener('click', () => copyImage(state.openTemplateId, $('#d-shot-copy')));
    $('#d-shot-view').addEventListener('click', () => viewShot(state.openTemplateId));

    // «Лоханулся»
    $$('[data-oops]').forEach((b) => b.addEventListener('click', async (ev) => {
      if (await copyText(oopsText(b.dataset.oops === 'tpl' ? state.lang : 'ru'))) {
        pulse(b);
        bubble(ev.clientX || b.getBoundingClientRect().left + 40, (ev.clientY || b.getBoundingClientRect().top) - 6);
      }
    }));

    // «Прощание»: подсказка с текстом под текущее время
    const bye = $('#btn-bye');
    bye.addEventListener('mouseenter', () => { bye.title = 'Скопировать: «' + byeText() + '»'; });
    bye.addEventListener('click', async (ev) => {
      if (await copyText(byeText())) { pulse(bye); bubble(ev.clientX || bye.getBoundingClientRect().left + 40, (ev.clientY || bye.getBoundingClientRect().top) - 6); }
    });

    // памятка: открыта/закрыта — запоминаем
    const memo = $('#tpl-memo');
    memo.open = store.get('memo', false);
    memo.addEventListener('toggle', () => store.set('memo', memo.open));

    // скрин в форме шаблона
    $('#tpl-img-file').addEventListener('change', (ev) => { takeFormImage(ev.target.files[0]); ev.target.value = ''; });
    $('#tpl-img-remove').addEventListener('click', () => { formImage = ''; setFormPreview(null); });
    const drop = $('#tpl-img-drop');
    drop.addEventListener('dragover', (ev) => { ev.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (ev) => {
      ev.preventDefault();
      drop.classList.remove('over');
      takeFormImage(ev.dataTransfer.files[0]);
    });
    $('#tpl-form').addEventListener('paste', (ev) => {
      const item = Array.from((ev.clipboardData && ev.clipboardData.items) || []).find((x) => x.kind === 'file' && /^image\//.test(x.type));
      if (!item) return;
      ev.preventDefault();
      takeFormImage(item.getAsFile());
    });

    // темы
    $('#topic-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const name = f.elements.name.value.replace(/\s+/g, ' ').trim();
      const msg = $('#topic-form-msg');
      msg.textContent = '';
      if (!name) return;
      const exists = [...state.topics, ...state.templates.map(catOf)].some((n) => norm(n) === norm(name));
      if (exists) { msg.textContent = 'Такая тема уже есть.'; return; }
      try {
        const r = await api.topicAdd(state.session && state.session.token, name);
        state.topics = [...state.topics, r.name || name];
        store.set('topics', state.topics);
        state.cat = r.name || name;
        store.set('cat', state.cat);
        $('#search').value = '';
        renderTemplates();
        closeLayer($('#topic-modal'));
        toast(`Тема «${r.name || name}» добавлена`, 'ok');
      } catch (e) {
        if (!handleSessionError(e)) msg.textContent = e.code === 'NETWORK' ? 'Нет связи с базой.' : 'Не получилось добавить тему.';
      }
    });
    $('#topic-list').addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-del-topic]');
      if (!b) return;
      const name = b.dataset.delTopic;
      try {
        await api.topicDelete(state.session && state.session.token, name);
        state.topics = state.topics.filter((n) => n !== name);
        store.set('topics', state.topics);
        renderTopicList();
        renderTemplates();
        toast(`Тема «${name}» удалена`);
      } catch (e) {
        if (!handleSessionError(e)) toast(e.code === 'VALIDATION' ? 'В теме есть шаблоны — сначала перенесите их.' : 'Не получилось удалить тему.', 'warn');
      }
    });

    // программы
    $('#btn-add-app').addEventListener('click', () => openAppForm(null));
    $('#apps-list').addEventListener('click', async (ev) => {
      const card = ev.target.closest('.app-card');
      if (!card) return;
      const l = state.links.find((x) => String(x.id) === card.dataset.id);
      if (!l) return;
      if (ev.target.closest('.app-copy')) {
        const b = ev.target.closest('.app-copy');
        if (await copyText(l.url)) { pulse(b); bubbleOver(b); }
      } else if (ev.target.closest('.app-edit')) {
        openAppForm(l);
      }
    });
    $('#app-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const msg = $('#app-form-msg');
      msg.textContent = '';
      let url = f.elements.url.value.trim();
      if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
      const data = {
        id: f.dataset.id ? Number(f.dataset.id) || f.dataset.id : null,
        title: f.elements.title.value.trim(),
        url,
        note: f.elements.note.value.trim(),
        sort: Number(f.elements.sort.value) || 0,
      };
      if (!data.title || !data.url) { msg.textContent = 'Название и ссылка обязательны.'; return; }
      const btn = $('button[type=submit]', f);
      btn.disabled = true;
      try {
        const row = await api.linkSave(state.session && state.session.token, data);
        state.links = (data.id ? state.links.map((x) => (String(x.id) === String(row.id) ? row : x)) : [...state.links, row])
          .sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.id - b.id);
        store.set('links', state.links);
        renderLinks();
        closeLayer($('#app-modal'));
        toast(data.id ? 'Программа обновлена' : 'Программа добавлена', 'ok');
      } catch (e) {
        if (!handleSessionError(e)) msg.textContent = e.code === 'NETWORK' ? 'Нет связи с базой.' : 'Не получилось сохранить. Проверьте ссылку.';
      }
      btn.disabled = false;
    });
    $('#app-delete').addEventListener('click', async () => {
      const f = $('#app-form');
      const l = state.links.find((x) => String(x.id) === f.dataset.id);
      if (!l) return;
      closeLayer($('#app-modal'));
      const ok = await confirmBox('Удалить программу?', `«${l.title}» пропадёт из списка у всех.`, 'Удалить');
      if (!ok) return;
      try {
        await api.linkDelete(state.session && state.session.token, l.id);
        state.links = state.links.filter((x) => x.id !== l.id);
        store.set('links', state.links);
        renderLinks();
        toast('Программа удалена');
      } catch (e) {
        if (!handleSessionError(e)) toast('Не получилось удалить. Попробуйте ещё раз.', 'warn');
      }
    });
  }

  /* =====================================================================
   *  Слои: модальные окна и выезжающая панель
   * ===================================================================== */

  let lastFocus = null;
  function openLayer(el) {
    lastFocus = document.activeElement;
    el.classList.remove('closing');
    el.hidden = false;
  }
  function closeLayer(el) {
    if (el.hidden || el.classList.contains('closing')) return;
    el.classList.add('closing');
    setTimeout(() => {
      el.hidden = true;
      el.classList.remove('closing');
      if (el.id === 'confirm-modal' && confirmResolve) { confirmResolve(false); confirmResolve = null; }
    }, el.id === 'drawer' ? 330 : 240);
    if (lastFocus && document.body.contains(lastFocus)) setTimeout(() => lastFocus.focus(), 260);
  }

  let confirmResolve = null;
  function confirmBox(title, text, okLabel) {
    return new Promise((resolve) => {
      if (confirmResolve) confirmResolve(false);
      confirmResolve = resolve;
      $('#confirm-title').textContent = title;
      $('#confirm-text').textContent = text || '';
      $('#confirm-ok').textContent = okLabel || 'Да';
      openLayer($('#confirm-modal'));
      setTimeout(() => $('#confirm-ok').focus(), 50);
    });
  }

  function bindLayers() {
    $$('[data-close]').forEach((el) => el.addEventListener('click', () => closeLayer(el.closest('.modal-wrap, .drawer-wrap'))));
    $('#confirm-ok').addEventListener('click', () => {
      const r = confirmResolve;
      confirmResolve = null;
      closeLayer($('#confirm-modal'));
      if (r) r(true);
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        const open = ['#confirm-modal', '#shot-view', '#notice-modal', '#app-modal', '#topic-modal', '#tpl-modal', '#dict-modal', '#drawer'].map((s) => $(s)).find((el) => !el.hidden);
        if (open) { ev.preventDefault(); closeLayer(open); }
      }
    });
  }

  /* =====================================================================
   *  Запуск
   * ===================================================================== */

  function bindGlobal() {
    $$('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));
    $('#btn-switch').addEventListener('click', async () => {
      await endSession();
      store.del('role');
      state.role = null;
      showGate();
    });
    $('#btn-logout').addEventListener('click', async () => {
      await endSession();
      toast('Вы вышли. Теперь вы гость.');
    });

    document.addEventListener('keydown', (ev) => {
      const layerOpen = ['#confirm-modal', '#tpl-modal', '#dict-modal', '#drawer', '#gate', '#notice-modal', '#shot-view', '#app-modal', '#topic-modal'].some((s) => !$(s).hidden);
      if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && state.tab === 'corrector' && !layerOpen) {
        ev.preventDefault();
        copyResult(true);
      }
    });

    // Выкинутая владельцем сессия: проверяем при возврате на вкладку и при действиях.
    document.addEventListener('visibilitychange', () => { if (!document.hidden) verifySession(true); });
    window.addEventListener('focus', () => verifySession(false));
    document.addEventListener('pointerdown', () => verifySession(false), { passive: true });

    // Вход/выход в другой вкладке того же браузера.
    window.addEventListener('storage', (ev) => {
      if (ev.key !== 'sufler.session' && ev.key !== 'sufler.role') return;
      const s = store.get('session', null);
      const role = store.get('role', null);
      if (role) {
        state.role = role;
        state.session = s;
        renderRole();
        scheduleExpiry();
        if (!$('#gate').hidden) hideGate();
      }
    });

    setInterval(updateRoleTime, 30000);
    window.addEventListener('resize', moveInk);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveInk);
  }

  function init() {
    startBackground();
    if (window.SuflerPets) {
      window.SuflerPets.init();
      const pt = $('#pets-toggle');
      const label = () => { pt.textContent = 'Питомцы: ' + (window.SuflerPets.enabled() ? 'вкл' : 'выкл'); };
      label();
      pt.addEventListener('click', () => { window.SuflerPets.toggle(); label(); });
    }
    const slogan = SLOGANS[Math.floor(Math.random() * SLOGANS.length)];
    $$('[data-slogan]').forEach((el) => { el.textContent = `«${slogan}»`; });

    if (api.mode === 'demo') {
      const banner = $('#demo-banner');
      banner.hidden = false;
      banner.textContent = 'Демо-режим: база не подключена, всё хранится только в этом браузере.';
      const note = document.createElement('p');
      note.className = 'demo-note';
      note.textContent = 'Это выдуманные примеры для демо, не из Telegram-канала. В настоящей базе их не будет: туда загружаются ваши шаблоны через импорт.';
      $('#tpl-memo').after(note);
    }

    bindGate();
    bindCorrector();
    bindDict();
    bindTemplates();
    bindFlow();
    bindOwner();
    bindTeam();
    bindExtra();
    bindLayers();
    bindGlobal();

    const role = store.get('role', null);
    const session = store.get('session', null);
    if (role === 'admin' || role === 'owner') {
      if (session && session.token) {
        state.role = session.role;
        state.session = session;
        scheduleExpiry();
        verifySession(true);
      } else {
        state.role = 'guest';
      }
    } else {
      state.role = role === 'guest' ? 'guest' : null;
    }
    renderRole();
    switchTab(store.get('tab', 'corrector'));
    if (!state.role) showGate();

    loadEntries();
    loadTemplates();
    loadTopics();
    loadLinks();
    loadAnnouncements();
  }

  init();
})();
