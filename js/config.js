/*
 * Настройки подключения к базе Supabase.
 * Взять в Supabase → Project Settings → API (Data API):
 *   supabaseUrl  — Project URL, вида https://abcdxyz.supabase.co
 *   supabaseKey  — публичный ключ: anon public (eyJ...) или publishable (sb_publishable_...)
 * Этот ключ публичный, его можно хранить в коде сайта: менять данные он не даёт,
 * всё изменение идёт через серверные функции с проверкой кода и сессии.
 *
 * Пока поля пустые, сайт работает в демо-режиме: данные живут только в этом браузере.
 */
window.SUFLER_CONFIG = {
  supabaseUrl: 'https://axcefcygkmlxuzkyhgeo.supabase.co',
  supabaseKey: 'sb_publishable_u49iWCy_1IVXb6lB-yB8Qg_eEPPcGub',
};
