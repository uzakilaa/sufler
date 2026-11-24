/*
 * Собирает js/words.js — большой словарь русских слов для корректора.
 * Источник: FrequencyWords (Hermit Dave), файл content/2018/ru/ru_50k.txt,
 *   https://github.com/hermitdave/FrequencyWords — лицензия CC BY-SA 4.0.
 * Запуск: node tools/build-words.js путь/к/ru_50k.txt
 *
 * Формат упаковки (чтобы файл был лёгким):
 *  - буквы кириллицы заменены на однобайтовые символы (ё → е);
 *  - слова отсортированы, у каждого записана длина общего начала с предыдущим словом;
 *  - в конце каждого слова — «частотный класс» (0 — самые частые).
 */
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src) { console.error('Укажите путь к ru_50k.txt'); process.exit(1); }

const C = require(path.join(__dirname, '..', 'js', 'corrector.js'));
// Слова-ошибки из словаря опечаток в «знакомые» не берём: их исправляет словарь сайта.
const bad = new Set(C.DEFAULT_ENTRIES.map((e) => C.normKey(e.short)));

const ALPHA = 'абвгдежзийклмнопрстуфхцчшщъыьэюя-';
const CODE = 'abcdefghijklmnopqrstuvwxyz{|}~`^_';
const CTRL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; // длина общего начала и частотный класс
const enc = (w) => Array.from(w, (ch) => CODE[ALPHA.indexOf(ch)]).join('');

const seen = new Map();
const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/);
lines.forEach((line, rank) => {
  const w = line.split(' ')[0].toLowerCase().replace(/ё/g, 'е');
  if (!/^[а-я]+(-[а-я]+)*$/.test(w) || w.length < 3 || bad.has(w) || seen.has(w)) return;
  seen.set(w, Math.min(CTRL.length - 1, Math.floor(Math.log2(rank + 1) * 2.25)));
});

const words = [...seen.keys()].map((w) => [enc(w), seen.get(w)]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
let out = '';
let prev = '';
for (const [w, f] of words) {
  let p = 0;
  while (p < prev.length && p < w.length && p < CTRL.length - 1 && prev[p] === w[p]) p++;
  out += CTRL[p] + w.slice(p) + CTRL[f];
  prev = w;
}

const js = `/* Большой словарь русских слов для корректора (${words.length} слов).
 * Источник: FrequencyWords, Hermit Dave — https://github.com/hermitdave/FrequencyWords
 * Лицензия данных: CC BY-SA 4.0. Собрано скриптом tools/build-words.js. */
(function (root) {
  var DATA = '${out}';
  root.SuflerWordsData = DATA;
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'words.js'), js);
console.log('слов:', words.length, 'размер:', Math.round(Buffer.byteLength(js) / 1024), 'КБ');
