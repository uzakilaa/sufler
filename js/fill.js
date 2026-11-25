/*
 * Подстановка значений в шаблоны прямо из строки поиска.
 *
 * В тексте шаблона можно оставить место:  {телефон} {сумма} {карта} {ICCID} {дата} {модель} {банк} {имя}
 *                                          {MCC} {мерчант} {ЧСИ} {обращение}
 *   «заявл 123456» → {обращение} (номер обращения/тикета)
 *   {пожелание} / {тілек} — сайт сам ставит по времени суток: «доброго утра» / «хорошего дня» / «хорошего вечера» / «доброй ночи»
 *   «мсс 4722» → {MCC}, «мерч 165459» → {мерчант}, «модель A2848» → {модель},
 *   «чси хамзин жаслан ерланович» → {ЧСИ} = «Хамзин Жаслан Ерланович» (из Колвира можно капсом)
 * ({имя} — имя оператора, его вписывают один раз на вкладке «Корректор»)
 * Кусок в двойных скобках [[ … ]] выводится, только если все значения внутри него найдены:
 *   «нет доступа к номеру[[ {телефон}]], мы не можем…»
 *     поиск «идентиф +7 701 000 0000» → «нет доступа к номеру +7 701 000 0000, мы не можем…»
 *     поиск «идентиф»                 → «нет доступа к номеру, мы не можем…»
 *
 * Банки: короткое или скопированное название («бцк», «халык», АО "ForteBank") → официальное.
 * Список можно дополнять в BANKS ниже.
 */
(function (root) {
  'use strict';

  // [официальное название, варианты написания (в нижнем регистре, ё → е)]
  const BANKS = [
    // с 2023 года официальное название — «Народный Банк Казахстана» (раньше было «Народный сберегательный банк Казахстана»)
    ['АО «Народный Банк Казахстана»', ['халык', 'халық', 'halyk', 'народный', 'народный банк', 'народный сберегательный', 'хсбк', 'hsbk']],
    ['АО «Kaspi Bank»', ['каспи', 'kaspi']],
    ['АО «Банк ЦентрКредит»', ['бцк', 'bcc', 'центркредит', 'центр кредит', 'centercredit', 'bank centercredit']],
    ['АО «ForteBank»', ['форте', 'фортебанк', 'forte', 'fortebank']],
    ['АО «Jusan Bank»', ['жусан', 'джусан', 'jusan']],
    ['АО «Bereke Bank»', ['береке', 'bereke', 'сбер', 'сбербанк']],
    ['АО «Евразийский Банк»', ['евразийский', 'евразийка', 'eurasian']],
    ['АО «Bank RBK»', ['рбк', 'rbk']],
    ['АО «Нурбанк»', ['нурбанк', 'nurbank']],
    ['АО «Home Credit Bank»', ['хоум кредит', 'хоум', 'home credit', 'homecredit', 'хкб']],
    ['АО «Отбасы банк»', ['отбасы', 'otbasy', 'жилстройсбербанк']],
    ['АО «Шинхан Банк Казахстан»', ['шинхан', 'shinhan']],
    ['АО «Altyn Bank»', ['алтын', 'altyn']],
    ['ДО АО Банк ВТБ (Казахстан)', ['втб', 'vtb']],
    ['АО «Ситибанк Казахстан»', ['ситибанк', 'сити банк', 'citibank', 'citi']],
    ['АО «KZI Bank»', ['kzi', 'кзи']],
    ['АО «Исламский банк «Al Hilal»', ['al hilal', 'аль хилал', 'альхилал', 'хилал']],
    ['АО «Исламский банк «Заман-Банк»', ['заман', 'zaman']],
    ['АО «Банк Китая в Казахстане»', ['банк китая', 'bank of china']],
  ];

  // Имя в фигурных скобках → ключ значения
  const NAMES = {
    iccid: 'iccid', айсисиайди: 'iccid',
    телефон: 'phone', номер: 'phone', phone: 'phone',
    карта: 'card', карты: 'card', card: 'card',
    сумма: 'amount', amount: 'amount',
    дата: 'date', date: 'date',
    модель: 'model', model: 'model',
    банк: 'bank', bank: 'bank',
    имя: 'name', name: 'name',
    mcc: 'mcc', мсс: 'mcc',
    мерчант: 'merchant', merchant: 'merchant', мерч: 'merchant',
    чси: 'chsi', исполнитель: 'chsi',
    обращение: 'ticket', тикет: 'ticket',
    пожелание: 'wish', тілек: 'wish_kz', тилек: 'wish_kz',
  };
  const LABELS = { iccid: 'ICCID', phone: 'телефон', card: 'карта', amount: 'сумма', date: 'дата', model: 'модель', bank: 'банк', name: 'имя',
    mcc: 'MCC', merchant: 'ID мерчанта', chsi: 'ФИО ЧСИ',
    ticket: 'номер обращения', wish: 'пожелание по времени суток', wish_kz: 'пожелание по времени суток' };

  // Пожелание по времени суток (по часам компьютера оператора)
  function wishes(date) {
    const h = (date || new Date()).getHours();
    if (h >= 5 && h < 12) return { wish: 'доброго утра', wish_kz: 'қайырлы таң' };
    if (h >= 12 && h < 18) return { wish: 'хорошего дня', wish_kz: 'қайырлы күн' };
    if (h >= 18 && h < 23) return { wish: 'хорошего вечера', wish_kz: 'қайырлы кеш' };
    return { wish: 'доброй ночи', wish_kz: 'қайырлы түн' };
  }

  // Слова после «чси», которые точно не ФИО
  const NOT_NAME = new Set(['арест', 'ареста', 'аресты', 'арестов', 'счет', 'счета', 'счетов', 'списание', 'списания', 'пт', 'долг',
    'долга', 'кредит', 'кред', 'исполнитель', 'наложен', 'наложил', 'снять', 'снятие', 'сумма', 'остаток', 'карта', 'карты', 'инкассо',
    'платежное', 'требование', 'и', 'по', 'на', 'от', 'для', 'это', 'кто', 'как', 'где']);
  const cap = (w) => w.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('-');

  const PH = /\{\s*([a-zа-яёәғқңөұүһі]+)\s*\}/gi;
  const OPT = /\[\[([\s\S]*?)\]\]/g;
  const L = 'a-zа-яёәғқңөұүһі0-9';
  const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');
  const keyOf = (name) => NAMES[norm(name)] || null;

  function placeholders(text) {
    const out = new Set();
    for (const m of String(text || '').matchAll(PH)) { const k = keyOf(m[1]); if (k) out.add(k); }
    return [...out];
  }

  const group3 = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // Ищет значения в строке поиска. rest — что осталось для обычного поиска по словам.
  function extract(query) {
    let s = ' ' + String(query || '') + ' ';
    const values = {};
    const cut = (m) => { s = s.slice(0, m.index) + ' '.repeat(m[0].length) + s.slice(m.index + m[0].length); };

    // Значение сразу после слова-подсказки. Само слово остаётся для поиска, вырезается только значение (последняя группа).
    const after = (re, fn) => {
      const m = re.exec(s);
      if (!m) return;
      const v = fn(m);
      if (!v) return;
      values[v[0]] = v[1];
      const g = m[m.length - 1];
      const start = m.index + m[0].length - g.length;
      s = s.slice(0, start) + ' '.repeat(g.length) + s.slice(start + g.length);
    };
    const W = '[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]';
    // MCC-код: «мсс 4722», «mcc 5411», «мсс код 4722» (мсс — и русскими буквами)
    after(/(?:^|\s)(?:mcc|мсс)(?:[\s-]*(?:код|кода|code))?[\s:—-]*(\d{4})(?!\d)/i, (m) => ['mcc', m[1]]);
    // Номер обращения: «заявл 123456», «тикет 123456», «№123456»
    after(/(?:^|\s)(?:тикет|заявл[а-яё]*|обращ[а-яё]*|№)[\s:]*№?\s*(\d{4,12})(?!\d)/i, (m) => ['ticket', m[1]]);
    // ID мерчанта: «мерч 165459», «мерчант id 165459»
    after(/(?:^|\s)(?:мерч|мерчант|мерчанта|merchant)(?:[\s:]*id)?[\s:№#—-]*(\d{3,12})(?!\d)/i, (m) => ['merchant', m[1]]);
    // Модель: «модель A2848», «модель MTP00ZA/A»
    after(/(?:^|\s)(?:модель|модели|model)[\s:—-]+([A-Za-z0-9]{2,10}(?:\/[A-Za-z])?)(?![A-Za-z0-9\/])/i,
      (m) => (/\d/.test(m[1]) && /[A-Za-z]/.test(m[1]) ? ['model', m[1].toUpperCase()] : null));
    // ФИО ЧСИ: «чси хамзин жаслан ерланович» (2–3 слова после «чси»)
    after(new RegExp('(?:^|\\s)(?:чси|исполнитель)[\\s:—-]+(' + W + '+(?:-' + W + '+)?(?:\\s+' + W + '+(?:-' + W + '+)?){1,2})(?=\\s|$)', 'i'), (m) => {
      const words = m[1].split(/\s+/);
      if (words.some((w) => NOT_NAME.has(norm(w)) || w.length < 2)) return null;
      return ['chsi', words.map(cap).join(' ')];
    });

    // Модель устройства Apple: MTP00ZA/A, MTP00ZA/A
    for (const m of s.matchAll(/(?<![A-Za-z0-9])[A-Za-z0-9]{3,8}[A-Za-z]{1,2}\/[A-Za-z](?![A-Za-z0-9])/g)) {
      if (values.model) break;
      if (/\d/.test(m[0])) { values.model = m[0].toUpperCase(); cut(m); break; }
    }
    // Дата: 01.02.2026, 7.9.26
    for (const m of s.matchAll(/(?<!\d)(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})(?!\d)/g)) {
      const d = +m[1], mo = +m[2];
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
        const y = m[3].length === 2 ? '20' + m[3] : m[3];
        values.date = String(d).padStart(2, '0') + '.' + String(mo).padStart(2, '0') + '.' + y;
        cut(m);
        break;
      }
    }
    // Длинные номера: ICCID, телефон, полный номер карты
    for (const m of [...s.matchAll(/\+?\d[\d\s()\-]{8,}\d/g)]) {
      const digits = m[0].replace(/\D/g, '');
      if (!values.iccid && digits.length >= 18 && digits.length <= 22 && digits.startsWith('89')) {
        values.iccid = digits; cut(m);
      } else if (!values.phone && ((digits.length === 11 && /^[78]/.test(digits)) || (digits.length === 10 && digits[0] === '7'))) {
        const d = digits.length === 11 ? digits.slice(1) : digits;
        values.phone = `+7 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
        cut(m);
      } else if (!values.card && digits.length === 16) {
        values.card = digits.slice(-4); cut(m);
      }
    }
    // Последние 4 цифры карты: *1234, ***1234, 1234
    const star = s.match(/\*+\s?(\d{4})(?!\d)/);
    if (star && !values.card) { values.card = star[1]; cut(star); }
    // Сумма: 5000, 5 000, 1 500,50
    const am = s.match(/(?<![\d.,\p{L}])\d{1,3}(?:[ \u00a0]\d{3})+(?:[.,]\d{1,2})?(?![\d.,\p{L}])|(?<![\d.,\p{L}])\d+(?:[.,]\d{1,2})?(?![\d.,\p{L}])/u);
    if (am) {
      const [int, frac] = am[0].replace(/[ \u00a0]/g, '').split(/[.,]/);
      values.amount = group3(int.replace(/^0+(?=\d)/, '')) + (frac ? ',' + frac : '');
      if (!values.card && /^\d{4}$/.test(am[0])) values.card = am[0];
      cut(am);
    }
    // Банк
    const low = norm(s).replace(/[«»"'“”„]/g, ' ');
    let best = null;
    for (const [name, aliases] of BANKS) {
      for (const a of aliases) {
        const re = new RegExp(`(^|[^${L}])(${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')})[${L}]{0,3}(?![${L}])`, 'i');
        const m = low.match(re);
        if (m && (!best || m[2].length > best.len)) best = { name, idx: m.index + m[1].length, len: m[0].length - m[1].length };
      }
    }
    if (best) {
      values.bank = best.name;
      s = s.slice(0, best.idx) + ' '.repeat(best.len) + s.slice(best.idx + best.len);
      // хвосты скопированного названия: АО, ДБ, «банк», кавычки
      s = s.replace(/[«»"'“”„]/g, ' ').replace(/(^|\s)(ао|дб|до|jsc|банк|bank|акционерное|общество|казахстана|казахстан|kazakhstan|of)(?=\s|$)/gi, ' ');
    }
    const rest = s.replace(/\s+/g, ' ').trim();
    return { values, rest };
  }

  // Подставляет значения. mark = [до, после] — чем обернуть подставленное (для подсветки).
  function render(text, values, mark) {
    values = values || {};
    const [a, b] = mark || ['', ''];
    const fill = (str) => str.replace(PH, (m, name) => {
      const k = keyOf(name);
      if (!k) return m;
      return values[k] ? a + values[k] + b : '';
    });
    let out = String(text || '').replace(OPT, (m, inner) => {
      const keys = placeholders(inner);
      return keys.length && keys.every((k) => values[k]) ? fill(inner) : '';
    });
    out = fill(out);
    return out
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/ +([,.;:!?])/g, '$1')
      .replace(/ +$/gm, '');
  }

  const api = { BANKS, LABELS, extract, render, placeholders, wishes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SuflerFill = api;
})(typeof window !== 'undefined' ? window : globalThis);
