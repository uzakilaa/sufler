/*
 * Исправление слов по словарю (js/vocab.js), без нейросетей.
 *  1. Дописывает оборванные слова: «поним» → «понимаю», «ситуац» → «ситуация».
 *  2. Исправляет опечатки на 1–2 буквы: «пстраемся» → «постараемся».
 *  3. Подбирает форму по соседям: «мы …» → «постараемся», «ситуация … неуд» → «неудобная»,
 *     «в ситуац» → «в ситуации».
 * Слова, которых нет в словаре и на которые ничего не похоже, не трогает.
 */
(function (root) {
  'use strict';

  const tryRequire = (p) => { try { return require(p); } catch (e) { return ''; } };
  const SRC = root.SuflerVocabSource || (typeof require === 'function' ? tryRequire('./vocab.js') : '');
  const WORDS = root.SuflerWordsData || (typeof require === 'function' ? tryRequire('./words.js') : '');

  const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е');

  /* ---------- Большой словарь (js/words.js): слово → частотный класс 0…35 ---------- */

  function decodeWords(data) {
    const ALPHA = 'абвгдежзийклмнопрстуфхцчшщъыьэюя-';
    const CODE = 'abcdefghijklmnopqrstuvwxyz{|}~`^_';
    const CTRL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const map = {};
    for (let i = 0; i < CODE.length; i++) map[CODE[i]] = ALPHA[i];
    const ctrl = {};
    for (let i = 0; i < CTRL.length; i++) ctrl[CTRL[i]] = i;
    const out = new Map();
    let prev = '';
    let i = 0;
    while (i < data.length) {
      const p = ctrl[data[i++]];
      let s = '';
      while (i < data.length && ctrl[data[i]] === undefined) s += map[data[i++]];
      const w = prev.slice(0, p) + s;
      out.set(w, ctrl[data[i++]]);
      prev = w;
    }
    return out;
  }

  /* ---------- Формы слов ---------- */

  // 1-е лицо у глаголов на -ить: проверить → проверю, отправить → отправлю, ответить → отвечу
  function first1s(stem, refl) {
    let w;
    if (/ст$/.test(stem)) w = stem.slice(0, -2) + 'щу';
    else if (/[пбвмф]$/.test(stem)) w = stem + 'лю';
    else if (/т$/.test(stem)) w = stem.slice(0, -1) + 'чу';
    else if (/[дз]$/.test(stem)) w = stem.slice(0, -1) + 'жу';
    else if (/с$/.test(stem)) w = stem.slice(0, -1) + 'шу';
    else if (/[жшчщ]$/.test(stem)) w = stem + 'у';
    else w = stem + 'ю';
    return refl ? w + 'сь' : w;
  }

  const PERS = [
    [/(ьте|йте)$/, 'imp'],
    [/(юсь|усь)$/, '1s'], [/(емся|имся|ёмся)$/, '1p'], [/(етесь|итесь)$/, '2p'],
    [/(ется|ится|ётся)$/, '3s'], [/(ются|ятся|утся|атся)$/, '3p'],
    [/(ю|у)$/, '1s'], [/(ем|им|ём)$/, '1p'], [/(ете|ите|ёте)$/, '2p'],
    [/(ет|ит|ёт)$/, '3s'], [/(ют|ят|ут|ат)$/, '3p'],
    [/(ть|ти|чь|ться|тись)$/, 'inf'], [/(л|ла|ло|ли|лся|лась|лись)$/, 'past'],
  ];
  const personOf = (w) => { for (const [re, t] of PERS) if (re.test(w)) return t; return ''; };

  const E = (list) => list.map((x) => (Array.isArray(x) ? x : [x, '']));
  const SIBIL = /[кгхжшчщ]$/;
  const HUSH = /[жшчщ]$/;

  const MACROS = {
    V1: { type: 'V', end: E(['ю', 'ем', 'ете', 'ет', 'ют', 'ешь', 'ть', 'л', 'ла', 'ло', 'ли', 'й', 'йте', 'я']) },
    V1r: { type: 'V', end: E(['юсь', 'емся', 'етесь', 'ется', 'ются', 'ешься', 'ться', 'лся', 'лась', 'лось', 'лись', 'йся', 'йтесь']) },
    V2: { type: 'V', first: (s) => first1s(s), gen: (s) => (HUSH.test(s)
      ? ['им', 'ите', 'ит', 'ат', 'ишь', 'ить', 'ил', 'ила', 'ило', 'или', 'и']
      : ['им', 'ите', 'ит', 'ят', 'ишь', 'ить', 'ил', 'ила', 'ило', 'или', 'и']) },
    V2r: { type: 'V', first: (s) => first1s(s, true), gen: (s) => (HUSH.test(s)
      ? ['имся', 'итесь', 'ится', 'атся', 'иться', 'ился', 'илась', 'ились']
      : ['имся', 'итесь', 'ится', 'ятся', 'иться', 'ился', 'илась', 'ились']) },
    OV: { type: 'V', end: E(['ую', 'уем', 'уете', 'ует', 'уют', 'овать', 'овал', 'овала', 'овали', 'овало', 'уй', 'уйте']) },
    OVr: { type: 'V', end: E(['уюсь', 'уемся', 'уетесь', 'уется', 'уются', 'оваться', 'овался', 'овалась', 'овались', 'уйтесь']) },

    Nf: { type: 'N', g: 'f', end: [['а', 'nom'], ['ы', 'gen'], ['е', 'dat prep'], ['у', 'acc'], ['ой', 'ins'], ['ам', ''], ['ами', ''], ['ах', ''], ['', '']] },
    Nfk: { type: 'N', g: 'f', end: [['а', 'nom'], ['и', 'gen'], ['е', 'dat prep'], ['у', 'acc'], ['ой', 'ins'], ['ам', ''], ['ами', ''], ['ах', '']] },
    Nfs: { type: 'N', g: 'f', end: [['я', 'nom'], ['и', 'gen'], ['е', 'dat prep'], ['ю', 'acc'], ['ей', 'ins'], ['ям', ''], ['ями', ''], ['ях', '']] },
    Nia: { type: 'N', g: 'f', end: [['ия', 'nom'], ['ии', 'gen dat prep'], ['ию', 'acc'], ['ией', 'ins'], ['ий', ''], ['иям', ''], ['иями', ''], ['иях', '']] },
    Nf3: { type: 'N', g: 'f', end: [['ь', 'nom acc'], ['и', 'gen dat prep'], ['ью', 'ins'], ['ей', ''], ['ям', ''], ['ями', ''], ['ях', '']] },
    Nm: { type: 'N', g: 'm', end: [['', 'nom acc'], ['а', 'gen'], ['у', 'dat'], ['ом', 'ins'], ['е', 'prep'], ['ы', ''], ['ов', ''], ['ам', ''], ['ами', ''], ['ах', '']] },
    Nmk: { type: 'N', g: 'm', end: [['', 'nom acc'], ['а', 'gen'], ['у', 'dat'], ['ом', 'ins'], ['е', 'prep'], ['и', ''], ['ов', ''], ['ам', ''], ['ами', ''], ['ах', '']] },
    Nn: { type: 'N', g: 'n', end: [['о', 'nom acc'], ['а', 'gen'], ['у', 'dat'], ['ом', 'ins'], ['е', 'prep'], ['ам', ''], ['ами', ''], ['ах', ''], ['', '']] },
    Nie: { type: 'N', g: 'n', end: [['е', 'nom acc'], ['я', 'gen'], ['ю', 'dat'], ['ем', 'ins'], ['и', 'prep'], ['й', ''], ['ям', ''], ['ями', ''], ['ях', '']] },

    A: { type: 'A', end: [['ый', 'm m-acc'], ['ая', 'f'], ['ое', 'n n-acc'], ['ые', 'pl pl-acc'], ['ого', 'm-gen n-gen'], ['ому', 'm-dat n-dat'], ['ым', 'm-ins n-ins pl-dat'], ['ом', 'm-prep n-prep'], ['ой', 'f-gen f-dat f-ins f-prep'], ['ую', 'f-acc'], ['ых', 'pl-gen pl-prep'], ['ыми', 'pl-ins']], adv: 'о' },
    Ak: { type: 'A', end: [['ий', 'm m-acc'], ['ая', 'f'], ['ое', 'n n-acc'], ['ие', 'pl pl-acc'], ['ого', 'm-gen n-gen'], ['ому', 'm-dat n-dat'], ['им', 'm-ins n-ins pl-dat'], ['ом', 'm-prep n-prep'], ['ой', 'f-gen f-dat f-ins f-prep'], ['ую', 'f-acc'], ['их', 'pl-gen pl-prep'], ['ими', 'pl-ins']], adv: 'о' },
    Ash: { type: 'A', end: [['ий', 'm m-acc'], ['ая', 'f'], ['ее', 'n n-acc'], ['ие', 'pl pl-acc'], ['его', 'm-gen n-gen'], ['ему', 'm-dat n-dat'], ['им', 'm-ins n-ins pl-dat'], ['ем', 'm-prep n-prep'], ['ей', 'f-gen f-dat f-ins f-prep'], ['ую', 'f-acc'], ['их', 'pl-gen pl-prep'], ['ими', 'pl-ins']] },
    As: { type: 'A', end: [['ий', 'm m-acc'], ['яя', 'f'], ['ее', 'n n-acc'], ['ие', 'pl pl-acc'], ['его', 'm-gen n-gen'], ['ему', 'm-dat n-dat'], ['им', 'm-ins n-ins pl-dat'], ['ем', 'm-prep n-prep'], ['ей', 'f-gen f-dat f-ins f-prep'], ['юю', 'f-acc'], ['их', 'pl-gen pl-prep'], ['ими', 'pl-ins']] },
    Ao: { type: 'A', gen: (s) => {
      const y = SIBIL.test(s) ? 'и' : 'ы';
      return [['ой', 'm m-acc f-gen f-dat f-ins f-prep'], ['ая', 'f'], ['ое', 'n n-acc'], [y + 'е', 'pl pl-acc'], ['ого', 'm-gen n-gen'], ['ому', 'm-dat n-dat'], [y + 'м', 'm-ins n-ins pl-dat'], ['ом', 'm-prep n-prep'], ['ую', 'f-acc'], [y + 'х', 'pl-gen pl-prep'], [y + 'ми', 'pl-ins']];
    } },
    P: { type: 'A', short: true, end: [['', 'm'], ['а', 'f'], ['о', 'n'], ['ы', 'pl']] },
  };

  /* ---------- Сборка словаря ---------- */

  function build(src) {
    const groups = [];
    const forms = new Map();     // слово → { g, tags }
    const list = [];             // [{ w, g, tags }] для перебора

    function add(type, items, gender, short) {
      const gi = groups.length;
      const g = { type, gender: gender || '', short: !!short, forms: [] };
      groups.push(g);
      for (const it of items) {
        const w = norm(it.w);
        if (!w) continue;
        const f = { w, g: gi, tags: it.tags || '', i: g.forms.length };
        g.forms.push(f);
        if (!forms.has(w)) forms.set(w, f);
        list.push(f);
      }
    }

    for (const raw of src.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const parts = line.split(/\s+/);
      let kind = parts[0];
      const extras = parts.slice(1).filter((p) => p.startsWith('+')).map((p) => p.slice(1));
      const words = parts.slice(1).filter((p) => !p.startsWith('+'));
      if (kind === 'W') { for (const w of words) add('W', [{ w }]); continue; }
      if (kind === 'X') { add('X', words.map((w) => ({ w }))); continue; }
      if (/^X[mfnp]$/.test(kind)) {
        const CASES = ['nom', 'gen', 'dat', 'acc', 'ins', 'prep'];
        add('N', words.map((w, i) => ({ w, tags: CASES[i] || '' })), kind[1] === 'p' ? 'pl' : kind[1]);
        continue;
      }
      if (kind === 'XV') { add('V', words.map((w) => ({ w, tags: personOf(w) }))); continue; }
      const adv = kind.endsWith('!');
      if (adv) kind = kind.slice(0, -1);
      const m = MACROS[kind];
      if (!m) continue;
      for (const stem of words) {
        let ends = m.gen ? m.gen(stem) : m.end;
        ends = ends.map((e) => (Array.isArray(e) ? e : [e, '']));
        const items = ends.map(([e, t]) => ({ w: stem + e, tags: m.type === 'V' ? personOf(stem + e) : t }));
        if (m.first) items.unshift({ w: m.first(stem), tags: '1s' });
        if (adv && m.adv) {
          items.push({ w: stem + m.adv, tags: 'adv' });
          items.push({ w: stem + 'а', tags: 'sf' }, { w: stem + (SIBIL.test(stem) ? 'и' : 'ы'), tags: 'spl' });
        }
        for (const x of extras) items.push({ w: x, tags: m.type === 'V' ? personOf(x) : '' });
        add(m.type, items, m.g, m.short);
      }
    }
    // Для перебора: сначала по длине, чтобы быстро отсекать
    const byLen = new Map();
    for (const f of list) {
      if (!byLen.has(f.w.length)) byLen.set(f.w.length, []);
      byLen.get(f.w.length).push(f);
    }
    return { groups, forms, list, byLen };
  }

  /* ---------- Расстояние между словами (с перестановкой соседних букв) ---------- */

  function dist(a, b, max) {
    const n = a.length;
    const m = b.length;
    if (Math.abs(n - m) > max) return max + 1;
    let prev2 = null;
    let prev = new Array(m + 1);
    for (let j = 0; j <= m; j++) prev[j] = j;
    for (let i = 1; i <= n; i++) {
      const cur = new Array(m + 1);
      cur[0] = i;
      let rowMin = cur[0];
      for (let j = 1; j <= m; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev;
      prev = cur;
    }
    return prev[m];
  }

  /* ---------- Поиск кандидатов ---------- */

  const PRONOUN = { я: '1s', мы: '1p', вы: '2p', он: '3s', она: '3s', оно: '3s', это: '3s', они: '3p' };
  const PREP_CASE = {
    в: 'prep', во: 'prep', на: 'prep', о: 'prep', об: 'prep', обо: 'prep', при: 'prep',
    с: 'ins', со: 'ins', над: 'ins', под: 'ins', перед: 'ins', между: 'ins',
    к: 'dat', ко: 'dat', по: 'dat', благодаря: 'dat', согласно: 'dat',
    за: 'acc', про: 'acc', через: 'acc',
    у: 'gen', от: 'gen', до: 'gen', из: 'gen', для: 'gen', без: 'gen', после: 'gen', около: 'gen',
    кроме: 'gen', вокруг: 'gen', среди: 'gen', 'из-за': 'gen', 'из-под': 'gen', вместо: 'gen', насчет: 'gen',
  };
  const hasTag = (f, t) => (' ' + f.tags + ' ').includes(' ' + t + ' ');
  // Обычные окончания русских слов (без -ся/-сь: возвратные проверяются отдельно)
  const ENDINGS = ['а', 'я', 'о', 'е', 'и', 'ы', 'у', 'ю', 'ь', 'й', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ой', 'ей',
    'ый', 'ий', 'ую', 'юю', 'ого', 'его', 'ому', 'ему', 'ым', 'им', 'ом', 'ем', 'ых', 'их', 'ыми', 'ими', 'ам', 'ям',
    'ами', 'ями', 'ах', 'ях', 'ов', 'ев', 'ью', 'ия', 'ии', 'ию', 'ией', 'ть', 'ти', 'ла', 'ло', 'ли', 'ет', 'ит',
    'ут', 'ют', 'ат', 'ят', 'ешь', 'ишь', 'ете', 'ите', 'ал', 'ял', 'ил', 'ешь'];
  const PLURAL_SUBJ = new Set(['деньги', 'средства', 'они', 'клиенты', 'люди', 'сотрудники', 'специалисты']);

  function createSpeller(src) {
    const V = build(src || SRC);
    const FREQ = decodeWords(WORDS || '');
    // Слова большого словаря, которых нет в ручном — тоже кандидаты на исправление (по частоте)
    const extraByLen = new Map();
    for (const w of FREQ.keys()) {
      if (V.forms.has(w)) continue;
      if (!extraByLen.has(w.length)) extraByLen.set(w.length, []);
      extraByLen.get(w.length).push({ w, g: -1, tags: '', i: 0 });
    }
    const cache = new Map();
    const typeOf = (w) => { const f = V.forms.get(w); return f ? V.groups[f.g].type : ''; };
    const rare = (w) => (FREQ.has(w) ? FREQ.get(w) / 35 : 1); // 0 — частое слово, 1 — редкое/нет в словаре
    const known = (w) => V.forms.has(w) || FREQ.has(w);

    // Основы знакомых слов: «настройки» → «настройк». Если незнакомое слово — знакомая основа
    // с обычным окончанием («настройках», «реквизитов»), это скорее редкая форма, а не опечатка.
    const STEMS = new Set();
    const addStems = (w) => {
      for (const e of ENDINGS) if (w.length - e.length >= 4 && w.endsWith(e)) STEMS.add(w.slice(0, -e.length));
    };
    for (const w of FREQ.keys()) addStems(w);
    for (const w of V.forms.keys()) addStems(w);
    function plausible(t) {
      for (const e of ENDINGS) if (t.length - e.length >= 4 && t.endsWith(e) && STEMS.has(t.slice(0, -e.length))) return true;
      if (known(t + 'ы')) return true;                       // «реквизит» ← «реквизиты»
      // «увеличен» ← «увеличена / увеличение»
      if (/(ен|ан|ян)$/.test(t) && ['а', 'о', 'ы', 'ие', 'ия', 'ный', 'ная'].some((e) => known(t + e))) return true;
      // «доставленные» ← «доставлен», «подключенных» ← «подключен»
      const m = t.match(/^(.+н)н(ый|ая|ое|ые|ого|ому|ым|ом|ой|ую|ых|ыми)$/);
      if (m && known(m[1])) return true;
      return false;
    }
    // w = t с одной пропущенной буквой внутри: «отменть» → «отменить»
    function missedOne(t, w) {
      if (w.length !== t.length + 1) return false;
      for (let i = 1; i < w.length - 1; i++) if (w.slice(0, i) + w.slice(i + 1) === t) return true;
      return false;
    }

    // Редкие формы (косвенные падежи мн. числа и т. п.) чуть дороже — при равенстве выигрывают частые.
    function penalty(f) {
      if (f.g < 0) return 0.3 + 0.5 * rare(f.w); // слово только из большого словаря
      const g = V.groups[f.g];
      if (g.type === 'W') return 0;
      return (!f.tags || f.tags === '2s' ? 0.3 : 0.05) + 0.1 * rare(f.w);
    }

    function candidates(t) {
      if (cache.has(t)) return cache.get(t);
      if (cache.size > 5000) cache.clear();
      const len = t.length;
      let best = Infinity;
      const all = [];
      const consider = (cost, f) => {
        if (cost > best + 0.35) return;
        if (cost < best) best = cost;
        all.push({ w: f.w, g: f.g, tags: f.tags, i: f.i, cost });
      };
      const maxFull = len >= 9 ? 2 : 1;
      const maxPre = len >= 9 ? 2 : len >= 5 ? 1 : 0;
      const preCost = len >= 9 ? 0 : 0.5;
      const scan = (byLen, sameFirst) => {
        for (const [L, arr] of byLen) {
          if (L > len) {
            for (const f of arr) {
              if (sameFirst && f.w[0] !== t[0]) continue;
              if (f.w.startsWith(t)) consider(0.3 + penalty(f) * 0.5, f);
              else if (maxPre) {
                const d = dist(t, f.w.slice(0, len), maxPre);
                if (d <= maxPre) consider(d + preCost + penalty(f) * 0.5, f);
              }
            }
          }
          if (Math.abs(L - len) <= maxFull) {
            for (const f of arr) {
              if (sameFirst && f.w[0] !== t[0] && f.w[1] !== t[1]) continue;
              const d = dist(t, f.w, maxFull);
              if (d <= maxFull) consider(d + penalty(f), f);
            }
          }
        }
      };
      scan(V.byLen, false);
      scan(extraByLen, true);
      // Оставляем только лучший уровень цены (с небольшим допуском для выбора формы по контексту)
      const cands = all.filter((f) => f.cost <= best + 0.35);
      const res = cands.length ? { cost: best, cands } : null;
      cache.set(t, res);
      return res;
    }

    // Падеж, которого требует предлог или глагол перед словом (прилагательные между ними пропускаем)
    function caseFrom(prev) {
      for (let i = prev.length - 1, n = 0; i >= 0 && n < 3; i--, n++) {
        const w = prev[i];
        if (PREP_CASE[w]) return PREP_CASE[w];
        const t = typeOf(w);
        if (t === 'A') continue;
        if (t === 'V' && n === 0) return 'acc';  // «отправим заявку»
        if (t === 'N' && n === 0) return 'gen';  // «скриншот ошибки»
        return '';
      }
      return '';
    }

    // Существительное рядом: его род и стоит ли оно до слова («карта … заблок») или после («подозрит операц»)
    function nounNear(ctx) {
      const nf = ctx.nextInfo;
      if (nf && nf.type === 'N') return { g: nf.gender, after: false, kase: (nf.tags || '').split(' ')[0] };
      const prev = ctx.prev.slice(-3).reverse();
      for (const w of prev) {
        const f = V.forms.get(w);
        if (f && V.groups[f.g].type === 'N' && hasTag(f, 'nom')) return { g: V.groups[f.g].gender, after: true };
        if (w === 'вы' || w === 'мы' || w === 'они') return { g: 'pl', after: true };
      }
      return { g: '', after: false };
    }

    function choose(res, ctx) {
      // Лучшее слово только из большого словаря — берём его, если ручной словарь ничего близкого не дал
      const cur = res.cands.filter((f) => f.g >= 0);
      const curBest = cur.length ? Math.min(...cur.map((f) => f.cost)) : Infinity;
      if (curBest > res.cost + 0.1 || !cur.length) {
        return res.cands.filter((f) => f.g < 0).sort((a, b) => a.cost - b.cost)[0];
      }
      res = { cost: curBest, cands: cur };
      const prev = ctx.prev;
      const prev1 = prev[prev.length - 1] || '';
      let person = PRONOUN[prev1] || PRONOUN[prev[prev.length - 2] || ''] || '';
      const kase = caseFrom(prev);
      const noun = nounNear(ctx);
      // «деньги поступ» → «поступят», «карта придет»
      const personByPronoun = !!person;
      if (!person && noun.after && noun.g) person = noun.g === 'pl' ? '3p' : '3s';
      if (!person && prev.some((w) => PLURAL_SUBJ.has(w))) person = '3p';
      // В начале фразы перед «пожалуйста» — просьба: «Уточните, пожалуйста»
      if (!person && !prev.length && ctx.nextWord === 'пожалуйста') person = 'imp';
      const best = Math.min(...res.cands.map((f) => f.cost));
      const top = res.cands.filter((f) => f.cost <= best + 0.15);
      const bestOf = (g) => Math.min(...top.filter((f) => f.g === g).map((f) => f.cost));
      const groupIds = [...new Set(top.map((f) => f.g))].sort((a, b) => bestOf(a) - bestOf(b) || a - b);
      const ofType = (t, pool) => (pool || groupIds).filter((g) => V.groups[g].type === t);
      let gi = groupIds[0];
      if (V.groups[gi].type === 'W' && noun.g && !noun.after && ofType('A').length) gi = ofType('A')[0];
      if (V.groups[gi].type !== 'W') {
        // «карта заблок» → «заблокирована»: после существительного-подлежащего краткая форма важнее глагола
        if (!personByPronoun && noun.after && noun.g && ofType('A').some((g) => V.groups[g].short)) {
          gi = ofType('A').find((g) => V.groups[g].short);
        } else if (person && ofType('V').length) gi = ofType('V')[0];
        else if (noun.g && !noun.after && ofType('A').length) gi = ofType('A').find((g) => !V.groups[g].short) ?? ofType('A')[0];
        else if (kase && ofType('N').length) gi = ofType('N')[0];
        else if (noun.g && ofType('A').length) gi = ofType('A').find((g) => !!V.groups[g].short === noun.after) ?? ofType('A')[0];
      }
      const g = V.groups[gi];
      // Внутри группы можно взять и форму чуть дороже — если её требует контекст
      const forms = res.cands.filter((f) => f.g === gi);
      const tagged = (t) => forms.find((f) => hasTag(f, t));
      let choice = null;
      if (g.type === 'V' && person) choice = tagged(person) || (person === 'imp' ? tagged('2p') : null);
      if (g.type === 'A') {
        const gn = noun.g;
        const nk = kase || (noun.kase && noun.kase !== 'nom' ? noun.kase : '');
        if (gn && nk && !noun.after) choice = tagged((gn === 'pl' ? 'pl' : gn) + '-' + nk);
        if (!choice && gn) choice = tagged(gn);
        if (!choice && !gn) choice = tagged('adv') || tagged('m');
      }
      if (g.type === 'N') choice = tagged(kase || 'nom') || tagged('nom');
      const pickF = choice || forms.sort((a, b) => a.cost - b.cost || a.i - b.i)[0];
      return pickF;
    }

    function lookup(word) {
      const t = norm(word);
      if (t.length < 4 || known(t)) return null;
      // «списались», «оформилась»: если без -ся/-сь слово знакомо — слово правильное
      if (/(ся|сь)$/.test(t) && known(t.slice(0, -2))) return null;
      if (/цц?а$/.test(t)) {
        const base = t.replace(/цц?а$/, '');
        const one = (w) => ({ cost: 0, cands: [{ w, g: -1, tags: '', i: 0, cost: 0 }] });
        for (const e of ['тся', 'ться']) if (known(base + e)) return one(base + e);
        if (/[аеиуюя]$/.test(base)) return one(base + 'тся');
      }
      // Залипла клавиша: «работее» → «работе», «спасибоо» → «спасибо»
      for (let i = 1; i < t.length; i++) {
        if (t[i] !== t[i - 1]) continue;
        const w = t.slice(0, i) + t.slice(i + 1);
        if (known(w)) return { cost: 0, cands: [{ w, g: -1, tags: '', i: 0, cost: 0 }] };
      }
      const r = candidates(t);
      if (!r) return null;
      if (plausible(t)) {
        // Похоже на настоящее слово — разрешаем только дописать 1–2 буквы до слова из ручного словаря
        // («приложени» → «приложение»), опечатки не трогаем.
        const tail = r.cands.filter((f) => (f.g >= 0 && f.w.startsWith(t) && f.w.length - t.length <= 2) || missedOne(t, f.w));
        if (!tail.length) return null;
        return { cost: Math.min(...tail.map((f) => f.cost)), cands: tail };
      }
      return { cost: r.cost, cands: r.cands.map((x) => x) };
    }

    function info(w) {
      const f = V.forms.get(norm(w));
      return f ? { type: V.groups[f.g].type, gender: V.groups[f.g].gender, tags: f.tags } : null;
    }

    function suggest(word, ctx) {
      const r = lookup(word);
      if (!r) return null;
      return choose(r, ctx || { prev: [] }).w;
    }

    return { suggest, lookup, choose, info, isKnown: (w) => known(norm(w)), size: V.list.length + extraByLen.size };
  }

  /* ---------- Проход по тексту ---------- */

  const WORD_RE = /[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*|[.!?…,;:\n]/gu;
  const isBreak = (t) => /^[.!?…\n]$/.test(t);

  function correctWords(text, speller, skip) {
    const tokens = [...text.matchAll(WORD_RE)].map((m) => ({ t: m[0], i: m.index }));
    const canFix = (k, sentenceStart) => {
      const tok = tokens[k].t;
      if (!/^[а-яё]+$/i.test(tok) || /[А-ЯЁ]/.test(tok.slice(1))) return false;
      if (!sentenceStart && /^[А-ЯЁ]/.test(tok)) return false; // имя собственное
      if (skip && skip.has(norm(tok))) return false;
      return true;
    };
    let prev = [];
    let out = '';
    let last = 0;
    let sentenceStart = true;
    for (let k = 0; k < tokens.length; k++) {
      const tok = tokens[k].t;
      if (isBreak(tok)) { prev = []; sentenceStart = true; continue; }
      if (/^[,;:]$/.test(tok)) { prev = []; continue; }
      let word = tok;
      if (canFix(k, sentenceStart)) {
        const r = speller.lookup(tok);
        if (r) {
          // Что за слово идёт следом — нужно для согласования «подозрит операц» → «подозрительной операции»
          let nextInfo = null;
          const nx = tokens[k + 1];
          if (nx && !/^[.!?…,;:\n]$/.test(nx.t)) {
            nextInfo = speller.info(nx.t);
            if (!nextInfo && canFix(k + 1, false)) {
              const rn = speller.lookup(nx.t);
              if (rn) {
                const f = speller.choose(rn, { prev: [...prev, norm(tok)] });
                nextInfo = speller.info(f.w);
              }
            }
          }
          const nextWord = nx && !/^[.!?…,;:\n]$/.test(nx.t) ? norm(nx.t) : '';
          const f = speller.choose(r, { prev, nextInfo, nextWord });
          word = /^[А-ЯЁ]/.test(tok) ? f.w.charAt(0).toUpperCase() + f.w.slice(1) : f.w;
          out += text.slice(last, tokens[k].i) + word;
          last = tokens[k].i + tok.length;
        }
      }
      prev.push(norm(word));
      if (prev.length > 4) prev.shift();
      sentenceStart = false;
    }
    return out + text.slice(last);
  }

  const api = { createSpeller, correctWords, dist };
  root.SuflerSpeller = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
