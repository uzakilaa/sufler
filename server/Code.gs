/**
 * Суфлёр — сервер на Google Apps Script.
 * База шаблонов и ссылок хранится в этой Google Таблице, пароли проверяются здесь, на сервере.
 *
 * Установка (один раз):
 *  1. Поменяйте ADMIN_PASSWORD ниже на свой. Админ видит, кто занял пароли, освобождает их и загружает базу из файла.
 *  2. Сохраните (Ctrl+S), выберите функцию setup сверху и нажмите «Выполнить», разрешите доступ к таблице.
 *  3. «Развернуть» → «Новое развертывание» → тип «Веб-приложение»:
 *       Выполнять как: «Я»; У кого есть доступ: «Все». Скопируйте URL веб-приложения.
 *
 * Пароли редакторов: один пароль — одно устройство (браузер). Первый, кто вошёл, закрепляет пароль за собой.
 * Админ может освободить пароль в разделе «Ссылки» → «Пароли редакторов».
 */

// ↓ Впишите свои пароли здесь, в редакторе Apps Script (не в GitHub!), затем запустите setup (или resetPasswords).
const ADMIN_PASSWORD = 'ВПИШИТЕ_ПАРОЛЬ_АДМИНА';
const EDITOR_PASSWORDS = ['ПАРОЛЬ_1', 'ПАРОЛЬ_2', 'ПАРОЛЬ_3', 'ПАРОЛЬ_4'];
const SALT = 'sufler-v1:';

/* ---------- setup ---------- */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  sheet_(ss, 'templates', ['id', 'json', 'updated']);
  sheet_(ss, 'links', ['id', 'json', 'updated']);
  const pw = sheet_(ss, 'passwords', ['label', 'hash', 'device', 'at', 'token', 'role']);
  if (pw.getLastRow() < 2) {
    const rows = EDITOR_PASSWORDS.map((p, i) => ['Пароль ' + (i + 1), hash_(p), '', '', '', 'editor']);
    rows.push(['Админ', hash_(ADMIN_PASSWORD), '', '', '', 'admin']);
    pw.getRange(2, 1, rows.length, 6).setValues(rows);
  }
}

/** Run after changing ADMIN_PASSWORD or EDITOR_PASSWORDS: rewrites the password list and frees every password. */
function resetPasswords() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pw = sheet_(ss, 'passwords', ['label', 'hash', 'device', 'at', 'token', 'role']);
  if (pw.getLastRow() > 1) pw.getRange(2, 1, pw.getLastRow() - 1, 6).clearContent();
  const rows = EDITOR_PASSWORDS.map((p, i) => ['Пароль ' + (i + 1), hash_(p), '', '', '', 'editor']);
  rows.push(['Админ', hash_(ADMIN_PASSWORD), '', '', '', 'admin']);
  pw.getRange(2, 1, rows.length, 6).setValues(rows);
}

/* ---------- HTTP ---------- */
function doGet() {
  try { return out_(listAll_()); } catch (err) { return out_({ ok: false, error: String(err) }); }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return out_(handle_(body));
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function handle_(b) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pw = ss.getSheetByName('passwords');

  if (b.action === 'login') return login_(pw, String(b.password || ''), String(b.device || ''));

  const me = auth_(pw, String(b.token || ''));
  if (!me) return { ok: false, error: 'auth' };

  switch (b.action) {
    case 'whoami':     return { ok: true, role: me.role, label: me.label };
    case 'save':       return upsert_(ss.getSheetByName('templates'), b.item);
    case 'delete':     return remove_(ss.getSheetByName('templates'), String(b.id));
    case 'saveLink':   return upsert_(ss.getSheetByName('links'), b.item);
    case 'deleteLink': return remove_(ss.getSheetByName('links'), String(b.id));
    case 'import':
      if (me.role !== 'admin') return { ok: false, error: 'admin' };
      return import_(ss, b.templates || [], b.links || []);
    case 'passwords':
      if (me.role !== 'admin') return { ok: false, error: 'admin' };
      return { ok: true, list: pwList_(pw) };
    case 'release':
      if (me.role !== 'admin') return { ok: false, error: 'admin' };
      return release_(pw, String(b.label || ''));
  }
  return { ok: false, error: 'unknown action' };
}

/* ---------- passwords ---------- */
function login_(pw, password, device) {
  if (!password || !device) return { ok: false, error: 'wrong' };
  const h = hash_(password);
  const n = pw.getLastRow() - 1;
  if (n < 1) return { ok: false, error: 'wrong' };
  const data = pw.getRange(2, 1, n, 6).getValues();
  for (let i = 0; i < data.length; i++) {
    const [label, hash, owner, , token, role] = data[i];
    if (hash !== h) continue;
    if (role !== 'admin' && owner && owner !== device) return { ok: false, error: 'taken' };
    const tok = token || Utilities.getUuid();
    pw.getRange(i + 2, 3, 1, 3).setValues([[role === 'admin' ? (owner || device) : device, new Date(), tok]]);
    return { ok: true, token: tok, role: role, label: label };
  }
  return { ok: false, error: 'wrong' };
}

function auth_(pw, token) {
  if (!token) return null;
  const n = pw.getLastRow() - 1;
  if (n < 1) return null;
  const data = pw.getRange(2, 1, n, 6).getValues();
  for (const r of data) if (r[4] && r[4] === token) return { label: r[0], role: r[5] };
  return null;
}

function pwList_(pw) {
  const n = pw.getLastRow() - 1;
  if (n < 1) return [];
  return pw.getRange(2, 1, n, 6).getValues()
    .filter(r => r[5] !== 'admin')
    .map(r => ({ label: r[0], taken: !!r[2], at: r[3] ? new Date(r[3]).getTime() : null }));
}

function release_(pw, label) {
  const n = pw.getLastRow() - 1;
  const data = n > 0 ? pw.getRange(2, 1, n, 6).getValues() : [];
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === label && data[i][5] !== 'admin') {
      pw.getRange(i + 2, 3, 1, 3).setValues([['', '', '']]); // forget device and token: the next person may take it
      return { ok: true };
    }
  }
  return { ok: false, error: 'not found' };
}

/* ---------- data ---------- */
function listAll_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return { ok: true, templates: rows_(ss.getSheetByName('templates')), links: rows_(ss.getSheetByName('links')), at: Date.now() };
}

function rows_(sh) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, 2).getValues()
    .map(r => { try { return JSON.parse(r[1]); } catch (_) { return null; } })
    .filter(Boolean);
}

function upsert_(sh, item) {
  if (!item || !item.id) return { ok: false, error: 'no id' };
  const id = String(item.id);
  const n = sh.getLastRow() - 1;
  const ids = n > 0 ? sh.getRange(2, 1, n, 1).getValues().map(r => String(r[0])) : [];
  const i = ids.indexOf(id);
  if (i >= 0) {
    let cur = {};
    try { cur = JSON.parse(sh.getRange(i + 2, 2).getValue()); } catch (_) {}
    const merged = Object.assign(cur, item);
    sh.getRange(i + 2, 2, 1, 2).setValues([[JSON.stringify(merged), new Date()]]);
    return { ok: true, item: merged };
  }
  sh.appendRow([id, JSON.stringify(item), new Date()]);
  return { ok: true, item: item };
}

function remove_(sh, id) {
  const n = sh.getLastRow() - 1;
  const ids = n > 0 ? sh.getRange(2, 1, n, 1).getValues().map(r => String(r[0])) : [];
  const i = ids.indexOf(id);
  if (i >= 0) sh.deleteRow(i + 2);
  return { ok: true };
}

function import_(ss, templates, links) {
  const put = (name, list) => {
    const sh = ss.getSheetByName(name);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 3).clearContent();
    const rows = list.filter(x => x && x.id).map(x => [String(x.id), JSON.stringify(x), new Date()]);
    if (rows.length) sh.getRange(2, 1, rows.length, 3).setValues(rows);
    return rows.length;
  };
  return { ok: true, templates: put('templates', templates), links: put('links', links) };
}

/* ---------- helpers ---------- */
function sheet_(ss, name, head) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, head.length).setValues([head]); }
  return sh;
}

function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, SALT + s, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
