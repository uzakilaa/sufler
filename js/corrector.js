/*
 * Суфлёр — корректор на правилах.
 * Работает целиком в браузере, без нейросетей и внешних сервисов.
 * Из базы берёт только список сокращений и словарь опечаток.
 */
(function (root) {
  'use strict';

  /* ---------- Стартовые списки (их же кладёт в базу supabase/seed.sql) ---------- */

  const DEFAULT_SHORTCUTS = [
    ['прив', 'здравствуйте!'],
    ['здр', 'здравствуйте!'],
    ['спс', 'спасибо'],
    ['спс за ожид', 'спасибо за ожидание!'],
    ['спс за обр', 'спасибо за обращение!'],
    ['за ожид', 'за ожидание'],
    ['изв', 'извините'],
    ['изв за ожид', 'извините за ожидание!'],
    ['изв за неуд', 'извините за неудобства!'],
    ['подск', 'подскажите'],
    ['чмп', 'чем могу помочь?'],
    ['ост вопр', 'остались ли у вас вопросы?'],
    ['хд', 'хорошего дня!'],
    ['хор дня', 'хорошего дня!'],
    ['всег доб', 'всего доброго!'],
    ['обр', 'обращайтесь!'],
    ['скок', 'сколько'],
    ['прет', 'здравствуйте!'],
    ['уоч', 'уточните'],
    ['уто', 'уточните'],
    ['утч', 'уточните'],
  ];

  const DEFAULT_TYPOS = [
    ['изза', 'из-за'], ['из за', 'из-за'], ['изпод', 'из-под'],
    ['сорри', 'извините'], ['сори', 'извините'], ['сорян', 'извините'], ['соррян', 'извините'],
    ['спасиб', 'спасибо'], ['пасиб', 'спасибо'], ['пасибо', 'спасибо'],
    ['норм', 'нормально'], ['инфа', 'информация'], ['инфу', 'информацию'], ['инфы', 'информации'],
    ['плиз', 'пожалуйста'], ['пж', 'пожалуйста'], ['оч', 'очень'], ['мб', 'может быть'],
    ['кст', 'кстати'], ['тож', 'тоже'], ['чет', 'что-то'],
    ['пож', 'пожалуйста'], ['инф', 'информацию'], ['в теч', 'в течение'], ['в течении', 'в течение'], ['в течени', 'в течение'], ['раб дн', 'рабочих дней'], ['раб дней', 'рабочих дней'],
    ['щас', 'сейчас'], ['щя', 'сейчас'], ['щяс', 'сейчас'], ['счас', 'сейчас'], ['ща', 'сейчас'],
    ['кароче', 'короче'], ['вобщем', 'в общем'], ['вообщем', 'в общем'], ['вопщем', 'в общем'],
    ['тоесть', 'то есть'], ['итд', 'и т. д.'], ['итп', 'и т. п.'],
    ['незнаю', 'не знаю'], ['немогу', 'не могу'], ['нету', 'нет'],
    ['впринципе', 'в принципе'], ['вкурсе', 'в курсе'], ['всмысле', 'в смысле'],
    ['навсякий', 'на всякий'], ['вцелом', 'в целом'], ['вочередь', 'в очередь'],
    ['както', 'как-то'], ['чтото', 'что-то'], ['ктото', 'кто-то'], ['гдето', 'где-то'],
    ['когдато', 'когда-то'], ['почемуто', 'почему-то'], ['чтонибудь', 'что-нибудь'],
    ['чтоли', 'что ли'], ['скока', 'сколько'], ['скоко', 'сколько'], ['чо', 'что'],
    ['извените', 'извините'], ['извеняюсь', 'извиняюсь'],
    ['пожалуста', 'пожалуйста'], ['пожайлуста', 'пожалуйста'], ['пожалста', 'пожалуйста'],
    ['пжл', 'пожалуйста'], ['пжлст', 'пожалуйста'], ['плз', 'пожалуйста'],
    ['здраствуйте', 'здравствуйте'], ['здравствуйти', 'здравствуйте'],
    ['здрасте', 'здравствуйте'], ['здрасьте', 'здравствуйте'],
    ['сдесь', 'здесь'], ['зделать', 'сделать'], ['зделал', 'сделал'], ['зделали', 'сделали'],
    ['расчитать', 'рассчитать'], ['расчитывать', 'рассчитывать'],
    ['оплотить', 'оплатить'], ['оплотите', 'оплатите'],
    ['прийдет', 'придёт'], ['прийдут', 'придут'], ['придти', 'прийти'],
    ['координально', 'кардинально'], ['проблемма', 'проблема'], ['обезательно', 'обязательно'],
    ['конешно', 'конечно'], ['канешно', 'конечно'], ['ваще', 'вообще'],
    ['седня', 'сегодня'], ['севодня', 'сегодня'], ['щет', 'счёт'],
    ['кэшбэк', 'кешбэк'], ['кешбек', 'кешбэк'], ['кэшбек', 'кешбэк'],
    ['заблокированна', 'заблокирована'],
    ['проверил все верно', 'проверил, всё верно'], ['проверила все верно', 'проверила, всё верно'],
    ['проверил все в порядке', 'проверил, всё в порядке'], ['проверила все в порядке', 'проверила, всё в порядке'],
  ].filter(([a, b]) => a !== b);

  /* ---------- Буква ё ---------- */

  // Слова, где без «ё» вариантов нет — меняем всегда.
  const ALWAYS_YO = toMap([
    'ещё', 'её', 'неё', 'моё', 'твоё', 'своё', 'всё-таки',
    'платёж', 'счёт', 'счёте', 'счёту', 'счётом', 'отчёт', 'отчёта', 'отчёты', 'отчётов',
    'расчёт', 'расчёта', 'расчёты', 'учёт', 'учёта', 'зачёт', 'зачёта',
    'перевёл', 'пришёл', 'нашёл', 'ушёл', 'прошёл', 'подошёл', 'зашёл', 'вошёл', 'произошёл',
    'придёт', 'пойдёт', 'найдёт', 'зайдёт', 'подойдёт', 'пройдёт', 'произойдёт', 'дойдёт', 'приведёт',
    'ждём', 'ждёт', 'идёт', 'даём', 'даёт', 'берём', 'берёт', 'ведём', 'вернём', 'вернёт',
    'найдём', 'пришлём', 'пришлёт', 'учтём', 'поймём', 'передаём', 'отдаём', 'отдаёт',
    'создаём', 'создаёт', 'начнём', 'начнёт', 'возьмём', 'возьмёт', 'чётко',
    'щёлкните', 'щёлкнуть', 'зелёный', 'жёлтый', 'чёрный', 'ребёнок', 'ребёнка',
  ]);

  // «все» → «всё», если дальше идёт одно из этих слов.
  const YO_AFTER = new Set([
    'верно', 'правильно', 'хорошо', 'понятно', 'ясно', 'готово', 'нормально', 'отлично', 'плохо',
    'равно', 'же', 'ок', 'окей', 'сделано', 'решено', 'исправлено', 'оформлено', 'оплачено',
    'зачислено', 'отправлено', 'работает', 'заработало', 'заработает', 'получилось', 'получится',
    'прошло', 'пройдет', 'решится', 'будет', 'было', 'еще', 'таки', 'остальное', 'необходимое',
    'нужное', 'что', 'подробно', 'есть',
  ]);

  /* ---------- Пунктуация ---------- */

  const BASE_STOP = new Set(['и', 'или', 'либо', 'а', 'но', 'да', 'ни', 'не', 'ли', 'же', 'ж', 'бы',
    'однако', 'зато', 'тоже', 'также']);
  const STOP_CHTO = new Set([...BASE_STOP, 'только', 'лишь', 'даже', 'почти', 'чуть', 'вот', 'ну',
    'потому', 'оттого', 'затем', 'так', 'раз', 'хоть', 'чем', 'более', 'нежели', 'что', 'кто',
    'зачем', 'почему', 'это', 'ничто', 'нечто']);
  const PARTICLES = new Set(['даже', 'только', 'лишь', 'особенно', 'именно', 'хотя', 'прямо', 'ровно']);
  const PREPS = new Set(['в', 'во', 'на', 'о', 'об', 'обо', 'по', 'с', 'со', 'у', 'к', 'ко', 'за',
    'из', 'от', 'до', 'для', 'без', 'при', 'про', 'через', 'над', 'под', 'перед', 'между', 'после',
    'из-за', 'из-под', 'около', 'вокруг', 'среди', 'кроме', 'вместо', 'благодаря', 'согласно']);
  const KOTOR_RE = /^котор(ый|ая|ое|ые|ого|ой|ому|ым|ом|ую|ых|ыми)$/;

  const INTRO = [
    ['к', 'сожалению'], ['к', 'счастью'], ['например'], ['конечно'], ['пожалуйста'],
    ['кстати'], ['во-первых'], ['во-вторых'], ['в-третьих'], ['разумеется'],
  ];
  const INTRO_NO_COMMA_BEFORE = new Set(['и', 'а', 'но', 'или', 'либо']);
  // Короткие ответы в начале предложения, после которых нужна запятая: «Да, всё верно».
  const START_COMMA = new Set(['да', 'хорошо', 'ок', 'окей', 'понятно', 'ясно', 'отлично']);
  // Извинение или благодарность посреди текста почти всегда начинает новую фразу.
  const APOLOGY = new Set(['извините', 'простите', 'спасибо', 'благодарю']);
  const NO_BREAK_BEFORE = new Set(['очень', 'большое', 'огромное', 'заранее', 'вам', 'всем', 'еще', 'вот',
    'просто', 'тоже', 'также', 'уж', 'вас', 'тебе', 'скажите', 'сказать']);
  const SUBJECTS = new Set(['я', 'мы']);
  // Прощальные фразы тоже начинают новое предложение: «…обратились. Хорошего дня»
  const CLOSERS = { хорошего: ['дня', 'вечера'], всего: ['доброго', 'хорошего'], до: ['свидания'] };
  const CLAUSE_WORDS = new Set(['что', 'чтобы', 'если', 'когда', 'где', 'как', 'потому', 'так', 'и', 'а', 'но']);

  // Знаки, после которых запятую не ставим.
  const BOUNDARY = new Set([',', '.', ';', ':', '!', '?', '…', '—', '–', '-', '(', '«', '"', '„', '“',
    '[', '{', "'", '/', '\n']);
  const END = '.!?…';

  /* ---------- Мелочи ---------- */

  function toMap(words) {
    const m = new Map();
    for (const w of words) m.set(w.replace(/ё/g, 'е'), w);
    return m;
  }
  const lower = (s) => String(s).toLowerCase().replace(/ё/g, 'е');
  const normKey = (s) => lower(String(s == null ? '' : s).trim()).replace(/\s+/g, ' ');
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const capFirst = (s) => s.replace(/\p{L}/u, (c) => c.toUpperCase());

  function matchCase(src, repl) {
    if (!repl) return repl;
    const letters = src.replace(/[^\p{L}]/gu, '');
    if (letters.length > 1 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) {
      return repl.toUpperCase();
    }
    const first = src.match(/\p{L}/u);
    if (first && first[0] !== first[0].toLowerCase()) return capFirst(repl);
    return repl;
  }

  function keyPattern(key) {
    let out = '';
    for (const ch of key) {
      if (ch === 'е') out += '[её]';
      else if (ch === ' ') out += '\\s+';
      else out += escapeRe(ch);
    }
    return out;
  }

  /* ---------- Словарь (сокращения + опечатки) ---------- */

  function buildDict(entries) {
    const map = new Map();
    // Сначала опечатки, потом сокращения: при совпадении ключа сокращение важнее.
    const sorted = [...entries].sort((a, b) => (a.kind === 'shortcut') - (b.kind === 'shortcut'));
    for (const e of sorted) {
      const k = normKey(e.short);
      const v = String(e.full == null ? '' : e.full).trim();
      if (k && v) map.set(k, v);
    }
    if (!map.size) return null;
    const keys = [...map.keys()].sort((a, b) => b.length - a.length);
    const re = new RegExp(
      '(?<![\\p{L}\\p{N}\\-])(?:' + keys.map(keyPattern).join('|') + ')(?![\\p{L}\\p{N}\\-])',
      'giu'
    );
    // Слова из словаря сайта корректор по своему словарю не трогает:
    // так админ может «защитить» любое слово парой «слово → слово».
    const words = new Set();
    for (const v of map.values()) for (const w of lower(v).split(/[^\p{L}-]+/u)) if (w) words.add(w);
    return { map, re, words };
  }

  function applyDict(text, dict) {
    if (!dict) return text;
    dict.re.lastIndex = 0;
    return text.replace(dict.re, (m) => {
      const v = dict.map.get(normKey(m));
      return v == null ? m : matchCase(m, v);
    });
  }

  // Набрано в английской раскладке: «ghbdtn» → «привет», «cgfcb,j» → «спасибо», «yt pyf.» → «не знаю».
  // Меняем только если получилось знакомое русское слово — Freedom, SuperApp, eSIM и ссылки не трогаем.
  const EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
  const RU = 'йцукенгшщзхъфывапролджэячсмитьбюё';
  const toRu = (w) => [...w].map((ch) => { const i = EN.indexOf(ch.toLowerCase()); return i < 0 ? ch : (ch !== ch.toLowerCase() ? RU[i].toUpperCase() : RU[i]); }).join('');
  function fixLayout(text, dict, sp) {
    if (!sp) return text;
    const ok = (w) => sp.isKnown(w) || (dict && dict.map.has(lower(w)));
    return text.replace(/(?<![\p{L}\p{N}@\/:])[a-zA-Z][a-zA-Z,.;'\[\]`]*(?![\p{L}\p{N}])/gu, (m) => {
      if (/[a-z][A-Z]/.test(m)) return m;                         // SuperApp, eSIM
      const full = toRu(m);
      if (ok(full)) return full;
      const mm = m.match(/^(.*?)([,.;]+)$/);                       // «pyf.» — точка в конце, а не «ю»
      if (mm && mm[1] && ok(toRu(mm[1]))) return toRu(mm[1]) + mm[2];
      return m;
    });
  }

  // Короткие слова с промахом по соседним клавишам: «ла» / «лп» → «да», «нпт» → «нет».
  // Только «да» и «нет», только если слово незнакомое и не похоже на сокращение (ПТ, ЗП, ИП…).
  const SHORT_TARGETS = ['да', 'нет'];
  const SHORT_KEEP = new Set(['пт', 'зп', 'ип', 'ци', 'пл', 'лк', 'мб', 'кб', 'ок', 'ну', 'пж', 'кз', 'рк', 'рф', 'вн', 'ерез']);
  function fixShort(text, sp) {
    if (!sp || !Speller || !Speller.near) return text;
    return text.replace(/(?<![\p{L}\p{N}-])[а-яё]{2,3}(?![\p{L}\p{N}-])/gu, (w) => {
      const t = lower(w);
      if (w !== t && w === w.toUpperCase()) return w;               // ПТ, ЗП — аббревиатуры
      if (SHORT_KEEP.has(t) || sp.isKnown(t)) return w;
      const hits = SHORT_TARGETS.filter((d) => d.length === t.length && [...t].every((ch, i) => ch === d[i] || Speller.near(ch, d[i])));
      return hits.length === 1 ? matchCase(w, hits[0]) : w;
    });
  }

  // Сокращение набрано с одной опечаткой (переставил буквы, соседняя клавиша): «спч» → «спс» → «спасибо».
  // Только для незнакомых слов из 3–6 букв и только если похожее сокращение одно.
  function fuzzyShortcuts(text, dict, sp) {
    if (!dict || !Speller || !Speller.dist) return text;
    const keys = [...dict.map.keys()].filter((k) => !k.includes(' ') && k.length >= 3);
    return text.replace(/(?<![\p{L}\p{N}-])[а-яё]{3,6}(?![\p{L}\p{N}-])/giu, (w) => {
      const t = lower(w);
      if (dict.map.has(t) || (sp && sp.isKnown(t))) return w;
      let best = null;
      let bestD = 2;
      let ties = 0;
      for (const k of keys) {
        if (Math.abs(k.length - t.length) > 1 || k[0] !== t[0]) continue;
        const d = Speller.dist(t, k, 1);
        if (d < bestD) { bestD = d; best = k; ties = 0; } else if (d === bestD) ties++;
      }
      return best && bestD <= 0.6 && !ties ? matchCase(w, best) : w;
    });
  }

  /* ---------- Защита ссылок и почты от правок ---------- */

  const PROTECT_RES = [
    /\b(?:https?:\/\/|www\.)[^\s<>«»"]+/gi,
    /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
    /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s<>«»"]*)?/gi,
  ];
  const PUA_BASE = 0xE000;
  const PUA_RE = /[-]/g;

  function protect(text, vault) {
    for (const re of PROTECT_RES) {
      text = text.replace(re, (m) => {
        // Хвостовую пунктуацию оставляем тексту: «зайдите на site.kz.»
        const tail = (m.match(/[.,!?;:)\]]+$/) || [''])[0];
        const core = tail ? m.slice(0, -tail.length) : m;
        if (!core) return m;
        vault.push(core);
        return String.fromCharCode(PUA_BASE + vault.length - 1) + tail;
      });
    }
    return text;
  }
  const restore = (text, vault) =>
    text.replace(PUA_RE, (c) => vault[c.charCodeAt(0) - PUA_BASE] ?? '');

  /* ---------- Пробелы ---------- */

  function fixSpacing(t) {
    t = t.replace(/[ \t  -​]+/g, ' ');
    t = t.replace(/(\S) *--+ *(?=\S)/g, '$1 — ');
    t = t.replace(/(\S) +[-–—] +(?=\S)/g, '$1 — ');
    t = t.replace(/ +([,.!?;:…)\]»])/g, '$1');
    t = t.replace(/([(\[«]) +/g, '$1');
    t = t.replace(/,{2,}/g, ',');
    t = t.replace(/,+(?=[.!?…])/g, '');
    t = t.replace(/([!?…]) *[.,]+(?!\.)/g, '$1');
    t = t.replace(/([,;:])(?=[\p{L}«(])/gu, '$1 ');
    t = t.replace(/([.!?…])(?=[\p{L}«(])/gu, '$1 ');
    t = t.replace(/(\p{L})\(/gu, '$1 (');
    t = t.replace(/\)(?=\p{L})/gu, ') ');
    t = t.replace(/ {2,}/g, ' ');
    t = t.replace(/ +\n/g, '\n').replace(/\n +/g, '\n');
    return t;
  }

  /* ---------- Слова и запятые внутри строки ---------- */

  const TOKEN_RE = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*|\s+|[\s\S]/gu;

  function tokenize(line) {
    const out = [];
    for (const m of line.matchAll(TOKEN_RE)) {
      const t = m[0];
      let k = 'p';
      if (/^\s+$/.test(t)) k = 's';
      else if (/^[\p{L}\p{N}]/u.test(t)) k = 'w';
      out.push({ t, k });
    }
    return out;
  }

  function processLine(line) {
    if (!line.trim()) return line;
    const toks = tokenize(line);
    const n = toks.length;
    const commaAfter = new Set();
    const handled = new Set();

    const isW = (i) => i >= 0 && i < n && toks[i].k === 'w';
    const lw = (i) => lower(toks[i].t);
    const prevIdx = (i) => { for (let j = i - 1; j >= 0; j--) if (toks[j].k !== 's') return j; return -1; };
    const nextIdx = (i) => { for (let j = i + 1; j < n; j++) if (toks[j].k !== 's') return j; return -1; };
    const isBoundaryTok = (j) => toks[j].k === 'p' && BOUNDARY.has(toks[j].t);
    const prevBlocked = (i) => {
      const j = prevIdx(i);
      return j < 0 || commaAfter.has(j) || isBoundaryTok(j);
    };
    const atSentenceStart = (i) => {
      const j = prevIdx(i);
      return j < 0 || (toks[j].k === 'p' && END.includes(toks[j].t));
    };
    const nextEnds = (i) => {
      const j = nextIdx(i);
      return j < 0 || (toks[j].k === 'p' && (END.includes(toks[j].t) || toks[j].t === ','));
    };
    const addCommaBefore = (i) => { if (!prevBlocked(i)) commaAfter.add(prevIdx(i)); };

    // 1. Буква ё
    for (let i = 0; i < n; i++) {
      if (!isW(i) || /ё/i.test(toks[i].t)) continue;
      const w = lw(i);
      let yo = ALWAYS_YO.get(w);
      if (!yo && w === 'все') {
        const j = nextIdx(i);
        if (j < 0 || (toks[j].k === 'p' && (END + ',;:)').includes(toks[j].t))) yo = 'всё';
        else if (isW(j)) {
          const nw = lw(j);
          if (YO_AFTER.has(nw)) yo = 'всё';
          else if (nw === 'в') { const j2 = nextIdx(j); if (isW(j2) && lw(j2) === 'порядке') yo = 'всё'; }
        }
      }
      if (yo) toks[i].t = matchCase(toks[i].t, yo);
    }

    // 2. Вводные слова: «Подождите, пожалуйста, минуту»
    for (let i = 0; i < n; i++) {
      if (!isW(i) || handled.has(i)) continue;
      for (const phrase of INTRO) {
        let end = i;
        let ok = lw(i) === phrase[0];
        for (let p = 1; ok && p < phrase.length; p++) {
          const j = end + 1;
          if (!(toks[j] && toks[j].k === 's' && isW(j + 1) && lw(j + 1) === phrase[p])) ok = false;
          else end = j + 1;
        }
        if (!ok) continue;
        const after = nextIdx(end);
        if (phrase[0] === 'конечно' && isW(after) && lw(after) === 'же') end = after;
        for (let k = i; k <= end; k++) handled.add(k);
        const pj = prevIdx(i);
        if (!prevBlocked(i) && !(isW(pj) && INTRO_NO_COMMA_BEFORE.has(lw(pj)))) commaAfter.add(pj);
        const nj = nextIdx(end);
        if (nj >= 0 && !isBoundaryTok(nj)) commaAfter.add(end);
        break;
      }
    }

    // 3. «Да, всё верно», «Хорошо, ожидайте»
    for (let i = 0; i < n; i++) {
      if (!isW(i) || !START_COMMA.has(lw(i)) || !atSentenceStart(i)) continue;
      const j = nextIdx(i);
      if (isW(j) && !commaAfter.has(i)) commaAfter.add(i);
    }

    // 4. Запятые перед союзами и союзными словами
    for (let i = 0; i < n; i++) {
      if (!isW(i) || handled.has(i)) continue;
      const w = lw(i);
      const ni = nextIdx(i);
      const nw = isW(ni) ? lw(ni) : null;
      let kind = null;
      if (w === 'потому' && nw === 'что') { kind = 'unit'; handled.add(ni); }
      else if (w === 'так' && (nw === 'как' || nw === 'что')) { kind = 'unit'; handled.add(ni); }
      else if (w === 'что') kind = 'chto';
      else if (w === 'чтобы') kind = 'chtoby';
      else if (w === 'но' || w === 'а' || w === 'однако') kind = 'adv';
      else if (w === 'если' || w === 'когда' || w === 'где') kind = 'cond';
      else if (KOTOR_RE.test(w)) kind = 'kotor';
      if (!kind) continue;
      if ((kind === 'chto' || kind === 'cond' || kind === 'adv') && nextEnds(i)) continue;
      if (kind === 'chto' && nw === 'ли') continue;
      if (prevBlocked(i)) continue;

      const pj = prevIdx(i);
      if (!isW(pj)) { addCommaBefore(i); continue; } // перед словом стоит «)» или ссылка
      const pw = lw(pj);
      let target = i;
      if (kind === 'chto') {
        if (STOP_CHTO.has(pw)) continue;
        if (PREPS.has(pw)) target = pj;
      } else if (kind === 'kotor') {
        if (BASE_STOP.has(pw)) continue;
        if (PREPS.has(pw)) target = pj;
      } else {
        if (BASE_STOP.has(pw)) continue;
        if (kind === 'cond' && pw === 'что') continue;
        if (kind !== 'adv' && PARTICLES.has(pw)) target = pj;
      }
      if (target !== i) {
        if (prevBlocked(target)) continue;
        const pj2 = prevIdx(target);
        if (isW(pj2) && BASE_STOP.has(lw(pj2))) continue;
      }
      addCommaBefore(target);
    }

    // 5. Новая фраза перед «извините / спасибо» посреди текста:
    //    «…неудобная извините за это…» → «…неудобная. Извините за это…»
    const periodAfter = new Set();
    for (let i = 0; i < n; i++) {
      const closer = isW(nextIdx(i)) && (CLOSERS[lw(i)] || []).includes(lw(nextIdx(i)));
      if (!isW(i) || !(APOLOGY.has(lw(i)) || closer) || atSentenceStart(i) || prevBlocked(i)) continue;
      const pj = prevIdx(i);
      if (!isW(pj)) continue;
      const pw = lw(pj);
      if (BASE_STOP.has(pw) || PREPS.has(pw) || NO_BREAK_BEFORE.has(pw)) continue;
      periodAfter.add(pj);
    }
    // «Извините за это, мы…», «Спасибо за ожидание, я…»
    for (let i = 0; i < n; i++) {
      if (!isW(i) || !APOLOGY.has(lw(i))) continue;
      let k = nextIdx(i);
      if (!isW(k) || lw(k) !== 'за') continue;
      for (let step = 0; step < 4; step++) {
        k = nextIdx(k);
        if (k < 0 || !isW(k) || prevBlocked(k) || CLAUSE_WORDS.has(lw(k))) break;
        if (SUBJECTS.has(lw(k))) { commaAfter.add(prevIdx(k)); break; }
      }
    }

    let out = '';
    for (let i = 0; i < n; i++) {
      out += toks[i].t;
      if (periodAfter.has(i)) out += '.';
      else if (commaAfter.has(i)) out += ',';
    }
    return out;
  }

  /* ---------- Заглавные буквы ---------- */

  // Сокращения, после которых предложение не заканчивается.
  const ABBR_RE = /(?:^|[^\p{L}])(?:т|т\. ?[екчн]|ул|им|см|тел|напр|стр|обл|\p{Lu})\.$/u;

  function capitalize(t) {
    let out = '';
    let cap = true;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (ch === '\n') { cap = true; out += ch; continue; }
      if (cap) {
        if (/\p{L}/u.test(ch)) { out += ch.toUpperCase(); cap = false; continue; }
        if (/[\p{N}-[]/u.test(ch)) cap = false;
      }
      out += ch;
      if (END.includes(ch)) {
        const next = t[i + 1];
        if (next === ' ' || next === undefined) {
          if (!(ch === '.' && ABBR_RE.test(out))) cap = true;
        }
      }
    }
    return out;
  }

  /* ---------- Точка в конце ---------- */

  // Вопрос без знака: «сколько ждать» → «Сколько ждать?», «остались ли вопросы» → «…?»
  const Q_START = /^(?:сколько|когда|где|куда|откуда|почему|зачем|как|какой|какая|какое|какие|каким|какую|кто|кому|кого|что|чем|чего)(?:\s|$)/i;
  function isQuestion(sentence) {
    const s = lower(sentence.trim()).replace(/^[«"(]+/, '');
    if (!s || s.includes(',')) return false;                       // «как только …, …» — не вопрос
    if (/^(?:как только|что касается|когда (?:деньги|средства|карта|заявка|проверка)|где бы|кто бы|что бы)/.test(s)) return false;
    return Q_START.test(s) || /^[\p{L}-]+\s+ли(?:\s|$)/u.test(s);
  }

  function finishLine(line) {
    const t = line.replace(/\s+$/, '');
    if (!t) return t;
    const chars = Array.from(t);
    const last = chars[chars.length - 1];
    const prev = chars[chars.length - 2] || '';
    if (END.includes(last) || last === ':' || last === ';') return t;
    if (last === ',') return t.slice(0, -1) + '.';
    if (/[-]/.test(last)) return t; // заканчивается ссылкой — точку не лепим
    if (/[\p{Extended_Pictographic}️‍]/u.test(last)) return t;
    if (last === '(' || last === '-' || last === '—') return t;
    if (last === ')') {
      const opens = (t.match(/\(/g) || []).length;
      const closes = (t.match(/\)/g) || []).length;
      if (closes > opens) return t; // это смайлик, а не скобка
    }
    if ((last === '»' || last === '"' || last === '”') && END.includes(prev)) return t;
    const tail = t.split(/[.!?…]\s+/).pop();
    return t + (isQuestion(tail) ? '?' : '.');
  }

  /* ---------- Казахский текст ---------- */
  // Строку на казахском русский словарь не «чинит»: только заглавные, точка или вопрос в конце
  // и казахские сокращения.
  const KZ_LETTERS = /[әғқңөұүһі]/i;
  // казахские слова, которые часто пишут русскими буквами (без қ, ң, ү…)
  const KZ_WORDS = new Set(['рахмет', 'рақмет', 'сау', 'болыныз', 'калай', 'кандай', 'жок', 'жоқ', 'иа', 'иә', 'жане', 'ушин',
    'сизге', 'сиз', 'сизде', 'бизде', 'биз', 'бар', 'емес', 'керек', 'кутиниз', 'тексеремиз', 'тексерип', 'жатыр', 'кешириниз',
    'салем', 'саламатсызба', 'салеметсиз', 'мен', 'сен', 'бул', 'осы', 'немесе', 'бойынша', 'туралы', 'ушін', 'үшін', 'кейин',
    'карта', 'ақша', 'акша', 'шот', 'банк']);
  const KZ_STRONG = new Set(['рахмет', 'рақмет', 'калай', 'кандай', 'жок', 'иа', 'жане', 'ушин', 'сизге', 'сизде', 'бизде', 'емес',
    'кутиниз', 'тексеремиз', 'тексерип', 'жатыр', 'кешириниз', 'салем', 'саламатсызба', 'салеметсиз', 'бойынша', 'туралы', 'кейин',
    'акша', 'болыныз']);
  function isKazakh(text) {
    const t = String(text || '');
    if (KZ_LETTERS.test(t)) return true;
    const words = lower(t).match(/\p{L}+/gu) || [];
    const strong = words.filter((w) => KZ_STRONG.has(w)).length;
    return strong >= 2 || (strong >= 1 && words.filter((w) => KZ_WORDS.has(w)).length >= 2);
  }

  const KZ_SHORTCUTS = [
    ['сәл', 'сәлеметсіз бе!'],
    ['салем', 'сәлеметсіз бе!'],
    ['рахм', 'рахмет'],
    ['күт рахм', 'күткеніңізге рахмет!'],
    ['кутк рахм', 'күткеніңізге рахмет!'],
    ['кешір', 'кешіріңіз'],
    ['кешир', 'кешіріңіз'],
    ['күте тұр', 'күте тұрыңыз'],
    ['сау бол', 'сау болыңыз!'],
    ['қайырлы күн', 'қайырлы күн!'],
  ];
  const KZ_DICT = buildDict(KZ_SHORTCUTS.map(([short, full]) => ({ kind: 'shortcut', short, full })));

  // Вопрос по-казахски: частицы ма/ме/ба/бе/па/пе или вопросительные слова
  const KZ_Q_PARTICLE = /(?:^|\s)(?:ма|ме|ба|бе|па|пе)(?:\s*[)»"]*)?$/i;
  const KZ_Q_WORDS = /(?:^|[^\p{L}])(?:қандай|кандай|қалай|калай|қашан|кашан|қайда|кайда|қайдан|неге|неліктен|қанша|канша|неше|кім|ким|қай|кай|не үшін)(?![\p{L}])/iu;
  function kzFinish(line) {
    const t = line.replace(/\s+$/, '');
    if (!t) return t;
    const last = t[t.length - 1];
    if (END.includes(last) || last === ':' || last === ';' || /[\p{Extended_Pictographic}️‍]/u.test(last)) return t;
    const body = last === ',' ? t.slice(0, -1) : t;
    // последнее предложение строки
    const tail = body.split(/[.!?…]\s+/).pop();
    const q = KZ_Q_PARTICLE.test(tail) || KZ_Q_WORDS.test(tail);
    // сәлеметсіз бе — приветствие, а не вопрос
    if (/сәлеметсіз бе$/i.test(tail)) return body + '!';
    return body + (q ? '?' : '.');
  }

  /* ---------- Главная функция ---------- */

  // Исправление слов по словарю русского языка (js/speller.js + js/vocab.js)
  const Speller = root.SuflerSpeller ||
    (typeof require === 'function' ? (() => { try { return require('./speller.js'); } catch (e) { return null; } })() : null);
  let spellerInst = null;
  const getSpeller = () => {
    if (!spellerInst && Speller) spellerInst = Speller.createSpeller();
    return spellerInst;
  };

  function correct(input, dict) {
    if (input == null) return '';
    let text = String(input).replace(/\r\n?/g, '\n');
    if (!text.trim()) return '';
    const vault = [];
    text = protect(text, vault);
    text = text.replace(/[ \t  -​]+/g, ' ');
    text = text.split('\n').map((l) => l.trim()).join('\n')
      .replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
    text = text.split('\n').map((l) => {
      if (isKazakh(l)) return l;
      const sp = getSpeller();
      return fuzzyShortcuts(fixShort(fixLayout(l, dict, sp), sp), dict, sp);
    }).join('\n');
    text = applyDict(text, dict);
    // Каждая строка — на своём языке: казахские строки русским словарём не правим
    const kz = text.split('\n').map(isKazakh);
    const sp = getSpeller();
    text = text.split('\n').map((l, i) => {
      if (kz[i]) return applyDict(l, KZ_DICT);
      return sp ? Speller.correctWords(l, sp, dict ? dict.words : null) : l;
    }).join('\n');
    text = fixSpacing(text);
    text = text.split('\n').map((l, i) => (kz[i] ? l : processLine(l))).join('\n');
    text = fixSpacing(text);
    text = capitalize(text);
    text = text.split('\n').map((l, i) => (kz[i] ? kzFinish(l) : finishLine(l))).join('\n');
    return restore(text, vault);
  }

  const toEntries = (pairs, kind) => pairs.map(([short, full]) => ({ kind, short, full }));
  const DEFAULT_ENTRIES = [...toEntries(DEFAULT_TYPOS, 'typo'), ...toEntries(DEFAULT_SHORTCUTS, 'shortcut')];

  function createCorrector(entries) {
    let dict = buildDict(entries || DEFAULT_ENTRIES);
    return {
      setEntries(list) { dict = buildDict(list || []); },
      correct(text) { return correct(text, dict); },
    };
  }

  /* ---------- Подсветка правок: какие слова поменялись ---------- */

  function diffWords(before, after) {
    const a = String(before || '').split(/\s+/).filter(Boolean);
    const parts = String(after || '').split(/(\s+)/);
    const b = parts.filter((p, i) => i % 2 === 0 && p);
    if (a.length * b.length > 360000) return parts.map((p) => ({ text: p, changed: false }));
    const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const same = new Set();
    for (let i = 0, j = 0; i < a.length && j < b.length;) {
      if (a[i] === b[j]) { same.add(j); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    let w = 0;
    return parts.filter((p) => p !== '').map((p) => {
      if (/^\s+$/.test(p)) return { text: p, changed: false };
      return { text: p, changed: !same.has(w++) };
    });
  }

  const api = {
    createCorrector, correct, buildDict, diffWords, normKey, isKazakh, KZ_SHORTCUTS,
    DEFAULT_SHORTCUTS, DEFAULT_TYPOS, DEFAULT_ENTRIES,
  };
  root.SuflerCorrector = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
