/*
 * Питомцы Суфлёра. Внизу гуляют зверьки (котик, лисёнок, ёжик, пёсик, панда, цыплёнок, зайчик, утёнок, пингвин),
 * наверху живёт чёрный дракон.
 *
 * Дракон по ролям:
 *   гость    — спит наверху;
 *   админ    — спит и иногда вылетает: машет крыльями, летит в свободное поле справа, спускается, садится внизу,
 *              осматривается и улетает обратно спать;
 *   владелец — всё то же + следит головой за мышкой; клик — пересаживается, двойной клик — спускается вниз,
 *              и если в течение 5 секунд ещё раз дважды кликнуть — сжигает зверьков и улетает спать.
 *              Зверьки возвращаются через полминуты.
 *
 * Всё двигается трансформами (это дёшево для браузера). Выключается кнопкой «Питомцы» в подвале.
 */
(function () {
  'use strict';

  const KEY = 'sufler.pets';
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const isSmall = () => window.innerWidth < 700;

  /* ---------------------------------------------------------------- Зверьки (все свои, смотрят вправо) */

  const eyes = (x1, y1, x2, y2, c = '#2f2a24') => `
    <g class="eyes">
      <ellipse class="eye" cx="${x1}" cy="${y1}" rx="1.9" ry="2.6" fill="${c}"/>
      <ellipse class="eye" cx="${x2}" cy="${y2}" rx="2" ry="2.7" fill="${c}"/>
      <circle cx="${x1 + 0.6}" cy="${y1 - 0.9}" r=".6" fill="#fff"/><circle cx="${x2 + 0.6}" cy="${y2 - 0.9}" r=".65" fill="#fff"/>
    </g>`;
  const eye1 = (x, y) => `<g class="eyes"><ellipse class="eye" cx="${x}" cy="${y}" rx="1.7" ry="2.3" fill="#2f2a24"/><circle cx="${x + 0.5}" cy="${y - 0.8}" r=".55" fill="#fff"/></g>`;
  const cheeks = (x1, x2, y) => `<ellipse cx="${x1}" cy="${y}" rx="2.4" ry="1.5" fill="#e8907a" opacity=".5"/><ellipse cx="${x2}" cy="${y}" rx="2.4" ry="1.5" fill="#e8907a" opacity=".5"/>`;
  const cheek = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="2.2" ry="1.4" fill="#e8907a" opacity=".5"/>`;
  const legs = (back, y = 40, h = 11) => `
    <g class="legs">
      <rect class="leg lb" x="16" y="${y}" width="6" height="${h}" rx="3" fill="${back}"/>
      <rect class="leg lf" x="32" y="${y}" width="6" height="${h}" rx="3" fill="${back}"/>
    </g>`;
  const legsFront = (front, y = 41, h = 11) => `
    <g class="legs">
      <rect class="leg lb2" x="20" y="${y}" width="6" height="${h}" rx="3" fill="${front}"/>
      <rect class="leg lf2" x="36" y="${y}" width="6" height="${h}" rx="3" fill="${front}"/>
    </g>`;
  const birdLegs = (x1, x2, y = 44, c = '#e6a23c') => `
    <g class="legs">
      <path class="leg lb" d="M${x1} ${y} v8 l-3 2 M${x1} ${y + 8} l3 2" stroke="${c}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path class="leg lf" d="M${x2} ${y} v8 l-3 2 M${x2} ${y + 8} l3 2" stroke="${c}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`;

  const ART = {
    cat: `
      <path class="tail" d="M14 38 C6 36 4 27 9 20" stroke="#d48f58" stroke-width="5" fill="none" stroke-linecap="round"/>
      ${legs('#d48f58')}
      <ellipse cx="27" cy="38" rx="15" ry="10" fill="#e9a86a"/>
      <ellipse cx="31" cy="42" rx="9" ry="5" fill="#f6dcc0"/>
      ${legsFront('#e9a86a')}
      <g class="head">
        <path d="M31 18 L32 5 L41 13 Z" fill="#e9a86a"/><path d="M33 15 L33.5 8.5 L38.5 13 Z" fill="#f2b9a8"/>
        <path d="M45 12 L53 4 L54 17 Z" fill="#e9a86a"/><path d="M47 12 L52 7.5 L52.5 15 Z" fill="#f2b9a8"/>
        <circle cx="42" cy="24" r="13.5" fill="#e9a86a"/>
        <path d="M40 11.6 v3.6 M43.8 11.2 v3.6" stroke="#c97c45" stroke-width="1.6" stroke-linecap="round"/>
        <ellipse cx="48" cy="29" rx="5.4" ry="3.8" fill="#f6dcc0"/>
        ${eyes(38, 23, 47, 22.5)}
        <path d="M48.4 26.5 h2 l-1 1.2 z" fill="#d8737a"/>
        <path d="M49.4 27.8 q-1 1.6 -2.4 .8 M49.4 27.8 q1 1.6 2.4 .8" stroke="#8a5a3c" stroke-width=".8" fill="none" stroke-linecap="round"/>
        <path d="M53 28 l5 -1 M53 30 l5 1" stroke="#8a5a3c" stroke-width=".6" stroke-linecap="round"/>
        ${cheeks(36, 52, 28)}
      </g>`,
    fox: `
      <g class="tail"><path d="M15 37 C1 40 -1 25 8 17 C11 26 17 30 15 37 Z" fill="#e07b3d"/><path d="M8 17 C5 20 5 24 6.5 27 C9 24 10 20.5 8 17 Z" fill="#fff6ea"/></g>
      ${legs('#4b3326')}
      <ellipse cx="27" cy="38" rx="15" ry="10" fill="#e07b3d"/>
      <ellipse cx="35" cy="41" rx="7" ry="5.5" fill="#fff6ea"/>
      ${legsFront('#5a3a2a')}
      <g class="head">
        <path d="M31 19 L31.5 2 L41 12 Z" fill="#e07b3d"/><path d="M31.3 8 L31.5 2 L35 5.6 Z" fill="#4b3326"/>
        <path d="M45 12 L54 2 L54.5 18 Z" fill="#e07b3d"/><path d="M51 5.5 L54 2 L54.2 8 Z" fill="#4b3326"/>
        <circle cx="42" cy="24" r="13.5" fill="#e07b3d"/>
        <path d="M40 27 Q50 21 57 27 Q50 34 40 31 Z" fill="#fff6ea"/>
        <circle cx="56.6" cy="26.8" r="1.7" fill="#2f2a24"/>
        ${eyes(38, 22.5, 47, 22)}
        <path d="M51 30.5 q1.5 1.2 3 0" stroke="#8a5a3c" stroke-width=".8" fill="none" stroke-linecap="round"/>
        ${cheeks(35.5, 50, 28)}
      </g>`,
    hedgehog: `
      ${legs('#6b4a35', 44, 7)}
      <path d="M7 45 C5 31 15 19 29 19 C39 19 45 25 45 32 L46 45 Z" fill="#8a6a4f"/>
      <path d="M7 45 L3 39 L8 37 L4 31 L10 30 L8 24 L14 25 L14 18 L20 21 L22 14 L26 19 L30 13 L32 19 L37 14 L38 21 L43 18 L42 25 L47 26 L44 31 Z" fill="#7b5b44"/>
      ${legsFront('#6b4a35', 45, 7)}
      <g class="head">
        <circle cx="42" cy="26.5" r="2.6" fill="#e2b98f"/>
        <circle cx="45" cy="34" r="10" fill="#f0d6b0"/>
        <ellipse cx="53.5" cy="36" rx="5.5" ry="3.8" fill="#f0d6b0"/>
        <circle cx="58.6" cy="35.4" r="1.7" fill="#2f2a24"/>
        ${eyes(43, 32, 49, 31.5)}
        ${cheeks(42, 52.5, 38)}
      </g>`,
    dog: `
      <path class="tail wag" d="M13 35 C8 31 8 25 11 21" stroke="#c98a52" stroke-width="5" fill="none" stroke-linecap="round"/>
      ${legs('#c98a52')}
      <ellipse cx="27" cy="38" rx="15" ry="10" fill="#d9a066"/>
      <ellipse cx="34" cy="41" rx="7.5" ry="5.5" fill="#fbf1e2"/>
      ${legsFront('#d9a066')}
      <g class="head">
        <ellipse cx="50" cy="13" rx="4" ry="6.5" transform="rotate(30 50 13)" fill="#8f5b34"/>
        <circle cx="42" cy="24" r="13.5" fill="#d9a066"/>
        <ellipse cx="49" cy="29.5" rx="6.5" ry="4.8" fill="#fbf1e2"/>
        <ellipse cx="54" cy="27.3" rx="2.2" ry="1.7" fill="#2f2a24"/>
        ${eyes(38, 22.5, 47, 22)}
        <path d="M50 31.5 q1.6 1.4 3.2 0" stroke="#8a5a3c" stroke-width=".8" fill="none" stroke-linecap="round"/>
        <ellipse cx="32" cy="24" rx="4.6" ry="8.5" transform="rotate(18 32 24)" fill="#8f5b34"/>
        ${cheeks(37, 52, 28.5)}
      </g>`,
    panda: `
      <circle class="tail" cx="12.5" cy="34" r="3" fill="#2f2a24"/>
      ${legs('#2f2a24')}
      <ellipse cx="27" cy="38" rx="15" ry="10" fill="#f8f4ec"/>
      <path d="M30 29 Q38 31 40 40 Q34 44 28 43 Q27 35 30 29 Z" fill="#2f2a24"/>
      ${legsFront('#2f2a24')}
      <g class="head">
        <circle cx="32" cy="13" r="4.8" fill="#2f2a24"/><circle cx="51" cy="11.5" r="4.8" fill="#2f2a24"/>
        <circle cx="42" cy="24" r="13.8" fill="#f8f4ec"/>
        <ellipse cx="38" cy="23.5" rx="3.6" ry="4.6" transform="rotate(20 38 23.5)" fill="#2f2a24"/>
        <ellipse cx="47.5" cy="23" rx="3.7" ry="4.7" transform="rotate(-18 47.5 23)" fill="#2f2a24"/>
        <g class="eyes"><circle class="eye" cx="38.6" cy="23.2" r="1.3" fill="#fff"/><circle class="eye" cx="47.2" cy="22.7" r="1.35" fill="#fff"/></g>
        <ellipse cx="49.5" cy="29" rx="2" ry="1.4" fill="#2f2a24"/>
        <path d="M49.5 30.2 q-1.2 1.3 -2.4 .5 M49.5 30.2 q1.2 1.3 2.4 .5" stroke="#2f2a24" stroke-width=".8" fill="none" stroke-linecap="round"/>
        ${cheeks(35, 54, 29)}
      </g>`,
    chick: `
      ${birdLegs(27, 34)}
      <path class="tail" d="M18 30 L9 22 L14 31 L7 30 L16 36 Z" fill="#f4efe6" stroke="#e2d8c8" stroke-width=".6"/>
      <ellipse cx="30" cy="35" rx="14" ry="11.5" fill="#fbf8f2"/>
      <ellipse cx="27" cy="35" rx="7.5" ry="5" fill="#ece4d6"/>
      <g class="head">
        <path d="M38 15 q1.5 -4.5 3.6 -1 q1.6 -4.5 3.6 -.6 q2.2 -3.2 3.2 1.5 l-1 3 h-8.5 z" fill="#d9493a"/>
        <circle cx="44" cy="22" r="8.5" fill="#fbf8f2"/>
        <path d="M51.6 20.4 l6 2.1 l-6 2.2 z" fill="#f0b23c"/>
        <ellipse cx="51" cy="27.4" rx="1.8" ry="2.6" fill="#d9493a"/>
        ${eye1(47, 20.5)}
        ${cheek(46, 25.5)}
      </g>`,
    rabbit: `
      <circle class="tail" cx="13.5" cy="33" r="4.6" fill="#fbf8f2"/>
      ${legs('#a59d95', 42, 9)}
      <ellipse cx="27" cy="38" rx="15" ry="10" fill="#bdb6ae"/>
      <ellipse cx="32" cy="42" rx="8" ry="5" fill="#ece6de"/>
      ${legsFront('#bdb6ae', 43, 9)}
      <g class="head">
        <ellipse cx="37" cy="9" rx="3.6" ry="11" transform="rotate(-14 37 9)" fill="#bdb6ae"/><ellipse cx="37" cy="10" rx="1.8" ry="8" transform="rotate(-14 37 10)" fill="#f2b9b0"/>
        <ellipse cx="46" cy="8" rx="3.6" ry="11" transform="rotate(12 46 8)" fill="#bdb6ae"/><ellipse cx="46" cy="9" rx="1.8" ry="8" transform="rotate(12 46 9)" fill="#f2b9b0"/>
        <circle cx="42" cy="25" r="12.5" fill="#bdb6ae"/>
        <ellipse cx="49" cy="29" rx="5" ry="3.6" fill="#ece6de"/>
        <path d="M50.4 26.6 h2 l-1 1.2 z" fill="#d8737a"/>
        ${eyes(38, 23, 47, 22.5)}
        ${cheeks(36, 52, 28.5)}
      </g>`,
    duck: `
      ${birdLegs(27, 33, 45, '#f08c3a')}
      <path class="tail" d="M17 32 l-7 -5 l3 7 z" fill="#efc24f"/>
      <ellipse cx="30" cy="37" rx="13.5" ry="10" fill="#f6d36b"/>
      <ellipse cx="27" cy="36" rx="7" ry="4.5" fill="#efc24f"/>
      <g class="head">
        <path d="M40 15 q2 -4.5 4 0" stroke="#efc24f" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        <circle cx="42" cy="24" r="10" fill="#f6d36b"/>
        <ellipse cx="52.6" cy="26" rx="6" ry="2.8" fill="#f08c3a"/>
        ${eye1(45, 22)}
        ${cheek(44, 27)}
      </g>`,
    penguin: `
      <g class="legs"><ellipse class="leg lb" cx="28" cy="52" rx="4.6" ry="2.2" fill="#f08c3a"/><ellipse class="leg lf" cx="37" cy="52" rx="4.6" ry="2.2" fill="#f08c3a"/></g>
      <ellipse cx="32" cy="32" rx="13" ry="19" fill="#2f3440"/>
      <ellipse cx="35.5" cy="36" rx="8.5" ry="13.5" fill="#fbf8f2"/>
      <path class="tail" d="M21 30 q-7 7 -3 15 q5 -5 4.5 -13 z" fill="#262a34"/>
      <g class="head">
        ${eye1(39, 20)}
        <path d="M43.5 21.6 l7 1.7 l-7 1.8 z" fill="#f08c3a"/>
        ${cheek(38.5, 25.5)}
      </g>`,
  };
  const NAMES = { cat: 'котик', fox: 'лисёнок', hedgehog: 'ёжик', dog: 'пёсик', panda: 'панда', chick: 'цыплёнок', rabbit: 'зайчик', duck: 'утёнок', penguin: 'пингвин' };
  const SPEED = { hedgehog: 24, panda: 30, penguin: 22, duck: 30, chick: 34 };

  /* ---------------------------------------------------------------- Дракон: чёрный, с объёмом */

  const DRAGON = `
    <svg viewBox="0 0 120 100" class="dragon-svg" aria-hidden="true">
      <defs>
        <radialGradient id="dg-body" cx="40%" cy="28%" r="78%"><stop offset="0" stop-color="#5d5f6e"/><stop offset=".45" stop-color="#26272f"/><stop offset="1" stop-color="#09090c"/></radialGradient>
        <radialGradient id="dg-head" cx="46%" cy="24%" r="80%"><stop offset="0" stop-color="#6b6d7e"/><stop offset=".5" stop-color="#2a2b34"/><stop offset="1" stop-color="#0a0a0e"/></radialGradient>
        <linearGradient id="dg-belly" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5c4b3c"/><stop offset="1" stop-color="#221a15"/></linearGradient>
        <linearGradient id="dg-wing" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#561a1f"/><stop offset=".55" stop-color="#250a0f"/><stop offset="1" stop-color="#0c0507"/></linearGradient>
        <linearGradient id="dg-horn" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#9c8a70"/><stop offset="1" stop-color="#f3e9d4"/></linearGradient>
        <radialGradient id="dg-eye"><stop offset="0" stop-color="#fff7b8"/><stop offset=".45" stop-color="#ffb02e"/><stop offset="1" stop-color="#d4380d"/></radialGradient>
        <radialGradient id="dg-glow"><stop offset="0" stop-color="#ff9a2e" stop-opacity=".75"/><stop offset="1" stop-color="#ff5a1e" stop-opacity="0"/></radialGradient>
        <linearGradient id="dg-shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      </defs>
      <ellipse class="d-shadow" cx="58" cy="94" rx="36" ry="4.5" fill="#000" opacity=".22"/>
      <path class="d-tail" d="M42 76 C26 84 10 80 6 68 C4 61 9 56 14 55 C11 62 14 70 25 72 C33 73 38 70 42 66 Z" fill="url(#dg-body)"/>
      <path d="M14 55 L2 47 L17 50 Z" fill="#17171c" stroke="#6a1d22" stroke-width=".9"/>
      <g class="wing wb">
        <path d="M58 50 L44 20 L14 10 Q22 22 18 30 Q28 31 29 38 Q39 40 42 47 Z" fill="url(#dg-wing)"/>
        <path d="M58 50 L44 20 L14 10 M44 20 L18 30 M44 20 L29 38" stroke="#2c2c34" stroke-width="2" fill="none" stroke-linecap="round"/>
      </g>
      <ellipse cx="46" cy="76" rx="11" ry="10" fill="url(#dg-body)"/>
      <ellipse cx="46" cy="85" rx="8" ry="3.4" fill="#141418"/>
      <path d="M41 86 l-3 3.5 M45.5 87 l-1 4 M50 86 l1.5 3.5" stroke="#ddd1ba" stroke-width="1.6" stroke-linecap="round"/>
      <g class="d-body">
        <ellipse cx="60" cy="66" rx="24" ry="17" fill="url(#dg-body)"/>
        <path d="M58 54 C66 52 76 58 78 68 C78 78 70 82 62 80 C60 72 58 62 58 54 Z" fill="url(#dg-belly)"/>
        <path d="M61 59 q8 -1 13 4 M60.5 65 q9 -1 16 3 M61 71 q8 0 15 2.5 M62 76.5 q6 .5 11 1.5" stroke="#806a54" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".8"/>
        <ellipse cx="54" cy="56" rx="15" ry="5" fill="url(#dg-shine)" opacity=".55"/>
        <path d="M38 60 l4 -7 l3 6 l4 -8 l3 7 l4 -8 l3 7" fill="#121216" stroke="#3a3a44" stroke-width=".6"/>
      </g>
      <path d="M70 72 C76 76 76 84 72 88 L64 88 C66 82 66 77 70 72 Z" fill="url(#dg-body)"/>
      <path d="M64 88 l-2 3.5 M68 88.5 l-.5 4 M72 88 l1.5 3.5" stroke="#ddd1ba" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M66 60 C66 48 72 40 80 36 L88 42 C82 46 78 54 77 64 Z" fill="url(#dg-body)"/>
      <path d="M69 45 l-5 -4 l6 0 M73 40.5 l-4 -5.5 l6 1.5" fill="#121216"/>
      <g class="wing wf">
        <path d="M60 52 L48 24 L22 16 Q29 27 26 34 Q35 35 36 41 Q44 43 46 49 Z" fill="url(#dg-wing)"/>
        <path d="M60 52 L48 24 L22 16 M48 24 L26 34 M48 24 L36 41" stroke="#36363f" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        <circle cx="48" cy="24" r="1.8" fill="#ddd1ba"/>
      </g>
      <g class="d-head-pose"><g class="d-head">
        <path d="M80 26 L69 12 L80 20 Z" fill="url(#dg-horn)"/>
        <path class="d-jaw" d="M84 39 C90 43.5 100 43.5 108 39.5 L106 36.5 C99 38.5 91 38.5 86 36.5 Z" fill="#17171c"/>
        <path class="d-roar" d="M86 37 C94 42.5 102 42.5 108 38.5 C102 40 94 40 86 37 Z" fill="#7a1810"/>
        <path d="M76 32 C78 22 90 19 99 24 L109 29 C112 31 112 35 108 37 L96 39 C88 41 80 40 77 37 Z" fill="url(#dg-head)"/>
        <path d="M84 22 L75 5 L88 19 Z" fill="url(#dg-horn)"/>
        <path d="M85.5 25.6 q6 -3.4 11.5 -.3" stroke="#060608" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        <ellipse cx="89" cy="23.6" rx="7" ry="2.2" fill="url(#dg-shine)" opacity=".7"/>
        <g class="eyes">
          <circle cx="91" cy="28.8" r="5.5" fill="url(#dg-glow)"/>
          <path class="eye" d="M87.4 29.2 q3.6 -3.3 7.2 -.4 q-3.6 2.3 -7.2 .4 z" fill="url(#dg-eye)"/>
          <ellipse cx="91.6" cy="28.8" rx=".6" ry="1.5" fill="#2a0a05"/>
        </g>
        <path class="d-shut" d="M87.4 29.4 q3.6 1.6 7.2 -.2" stroke="#b9a98f" stroke-width="1" fill="none" stroke-linecap="round"/>
        <circle cx="106.6" cy="31" r="1.05" fill="#ff6a2a" opacity=".85"/>
        <path class="d-mouth" d="M92 37.5 q8 1 15 -1" stroke="#060608" stroke-width="1.1" fill="none" stroke-linecap="round"/>
        <path class="d-teeth" d="M96 37.7 l1 2 l1 -1.9 M100.2 37.5 l1 2 l1 -2" fill="#f1e9d6"/>
      </g></g>
    </svg>
    <span class="d-smoke" aria-hidden="true"><i></i><i></i><i></i></span>`;

  const GHOST = '<svg viewBox="0 0 24 28"><path d="M3 12 a9 9 0 0 1 18 0 v13 l-3 -2 l-3 2 l-3 -2 l-3 2 l-3 -2 l-3 2 z" fill="#fffaf2" stroke="#d9cbb6"/><circle cx="9" cy="12" r="1.3" fill="#2f2a24"/><circle cx="15" cy="12" r="1.3" fill="#2f2a24"/><ellipse cx="12" cy="16.5" rx="1.6" ry="1.1" fill="#2f2a24"/></svg>';
  const HEART = '<svg viewBox="0 0 16 14"><path d="M8 13 C3 9 0 6.6 0 3.8 A3.7 3.7 0 0 1 8 2.4 A3.7 3.7 0 0 1 16 3.8 C16 6.6 13 9 8 13 Z" fill="#e0475c"/></svg>';

  /* ---------------------------------------------------------------- Слои */

  let on = false;
  let role = 'guest';
  let ground = null;   // фиксированный слой у нижнего края экрана
  let sky = null;      // слой в координатах страницы — для дракона
  const pets = [];
  let respawnTimer = 0;
  let idleTimer = 0;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  /* ---------------------------------------------------------------- Поведение зверьков */

  function makePet(kind, fromEdge) {
    const W = window.innerWidth;
    const p = { kind, x: fromEdge ? (Math.random() < 0.5 ? -60 : W + 10) : rnd(40, W - 100), dir: 1, timer: 0, dead: false, sleeping: false };
    p.el = el('div', 'pet pet-' + kind);
    p.el.title = NAMES[kind];
    p.el.innerHTML = `<div class="pet-flip"><div class="pet-hop"><svg viewBox="0 0 64 56" aria-hidden="true">${ART[kind]}</svg></div></div>`;
    p.el.style.transform = `translateX(${p.x}px)`;
    p.el.addEventListener('click', (ev) => { ev.stopPropagation(); petHappy(p); });
    ground.appendChild(p.el);
    pets.push(p);
    p.timer = setTimeout(() => petStep(p), fromEdge ? 100 : rnd(300, 2500));
    return p;
  }

  function face(p, dir) {
    p.dir = dir;
    p.el.classList.toggle('left', dir < 0);
  }

  function petStep(p) {
    if (p.dead || !on) return;
    clearTimeout(p.timer);
    if (p.sleeping) return;
    const W = window.innerWidth;
    const r = Math.random();
    if (r < 0.62) {
      const to = Math.max(10, Math.min(W - 70, p.x + rnd(-1, 1) * rnd(120, W * 0.5)));
      const dist = Math.abs(to - p.x);
      const speed = SPEED[p.kind] || rnd(38, 55);
      const dur = Math.max(0.6, dist / speed);
      face(p, to >= p.x ? 1 : -1);
      p.el.classList.add('walking');
      p.el.classList.remove('sit');
      p.el.style.transition = `transform ${dur}s linear`;
      p.x = to;
      p.el.style.transform = `translateX(${to}px)`;
      p.timer = setTimeout(() => { p.el.classList.remove('walking'); p.timer = setTimeout(() => petStep(p), rnd(600, 2200)); }, dur * 1000);
    } else if (r < 0.88) {
      p.el.classList.add('sit');
      if (Math.random() < 0.4) face(p, -p.dir);
      p.timer = setTimeout(() => { p.el.classList.remove('sit'); petStep(p); }, rnd(2500, 6000));
    } else {
      petNap(p, rnd(7000, 14000));
    }
  }

  function petNap(p, ms) {
    p.sleeping = true;
    p.el.classList.remove('walking');
    p.el.classList.add('sit', 'sleep');
    p.timer = setTimeout(() => petWake(p), ms);
  }
  function petWake(p) {
    if (!p.sleeping || p.dead) return;
    p.sleeping = false;
    p.el.classList.remove('sleep');
    p.timer = setTimeout(() => petStep(p), rnd(400, 1500));
  }

  // Клик или копирование: зверёк подпрыгивает и показывает пузырь с сердечком
  function petHappy(p) {
    if (p.dead) return;
    if (p.sleeping) petWake(p);
    const hop = p.el.querySelector('.pet-hop');
    hop.classList.remove('jump');
    void hop.offsetWidth;
    hop.classList.add('jump');
    const old = p.el.querySelector('.pet-bubble');
    if (old) old.remove();
    const b = el('span', 'pet-bubble', HEART);
    p.el.appendChild(b);
    setTimeout(() => b.remove(), 1800);
  }

  function petsAlive() { return pets.filter((p) => !p.dead); }

  function spawnPets(fromEdge) {
    const kinds = Object.keys(ART).sort(() => Math.random() - 0.5);
    const n = isSmall() ? 4 : kinds.length;
    kinds.slice(0, n).forEach((k, i) => setTimeout(() => on && makePet(k, fromEdge), fromEdge ? i * 600 : 0));
  }

  function killPet(p) {
    p.dead = true;
    clearTimeout(p.timer);
    const r = p.el.getBoundingClientRect();
    p.el.classList.remove('walking');
    p.el.style.transition = 'none';
    p.el.classList.add('burnt');
    setTimeout(() => {
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const puff = el('span', 'poof');
      puff.style.left = cx + 'px';
      puff.style.top = cy + 'px';
      document.body.appendChild(puff);
      for (let i = 0; i < 10; i++) {
        const a = el('span', 'ash');
        a.style.left = cx + rnd(-14, 14) + 'px';
        a.style.top = cy + rnd(-6, 10) + 'px';
        document.body.appendChild(a);
        a.animate([{ transform: 'translate(0,0)', opacity: 0.9 }, { transform: `translate(${rnd(-18, 18)}px, ${rnd(14, 34)}px) rotate(${rnd(-90, 90)}deg)`, opacity: 0 }],
          { duration: rnd(700, 1200), easing: 'ease-in', fill: 'forwards' }).finished.then(() => a.remove()).catch(() => a.remove());
      }
      const ghost = el('span', 'ghost', GHOST);
      ghost.style.left = cx + 'px';
      ghost.style.top = r.top + 'px';
      document.body.appendChild(ghost);
      p.el.remove();
      setTimeout(() => puff.remove(), 900);
      setTimeout(() => ghost.remove(), 2600);
    }, 550);
    pets.splice(pets.indexOf(p), 1);
  }

  /* ---------------------------------------------------------------- Дракон: положение и позы */

  const D = { el: null, x: 0, y: 0, dir: 1, seq: 0, pose: 'asleep', anim: null, home: 0, busy: false, armedUntil: 0, nextFlight: 0, bottom: false };
  const DW = () => (isSmall() ? 86 : 132);
  const DH = () => (isSmall() ? 72 : 110);

  function makeDragon() {
    D.el = el('div', 'dragon asleep', `<div class="dragon-flip">${DRAGON}</div>`);
    D.el.title = 'Дракон Суфлёра';
    sky.appendChild(D.el);
    let lastClick = 0;
    let single = 0;
    D.el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (role !== 'owner') return;
      const now = Date.now();
      if (now - lastClick < 320) {
        clearTimeout(single);
        lastClick = 0;
        dragonDouble();
      } else {
        lastClick = now;
        single = setTimeout(dragonSingle, 330);
      }
    });
    const s = sleepSpot();
    setPos(s.x, s.y);
  }

  // Где дракон спит: справа от вкладок, если там есть место, иначе — на краю шапки
  function sleepSpot() {
    const sx = window.scrollX;
    const sy = window.scrollY;
    const tabs = document.querySelector('.tabs');
    const app = document.querySelector('.app');
    const top = document.querySelector('.topbar');
    const w = DW();
    const h = DH();
    if (tabs && app && !tabs.closest('[hidden]')) {
      const tr = tabs.getBoundingClientRect();
      const ar = app.getBoundingClientRect();
      const free = ar.right - 24 - tr.right;
      if (free > w + 40) {
        let x = ar.right - 24 - w - 20 + D.home;
        x = Math.max(tr.right + 10, Math.min(ar.right - 24 - w, x));
        return { x: x + sx, y: tr.bottom - h + 8 + sy };
      }
    }
    const r = top ? top.getBoundingClientRect() : { right: window.innerWidth - 20, bottom: 70 };
    const x = Math.max(6, Math.min(window.innerWidth - w - 6, r.right - w - 30 + D.home));
    return { x: x + sx, y: r.bottom - h * 0.5 + sy };
  }

  // Свободная полоса для полёта: поле справа от сайта (или слева, если справа тесно)
  function lane() {
    const W = window.innerWidth;
    const w = DW();
    const app = document.querySelector('.app');
    const ar = app ? app.getBoundingClientRect() : { left: 0, right: W };
    const right = W - ar.right;
    if (right >= w + 10) return { x: ar.right + (right - w) / 2, side: 1 };
    if (ar.left >= w + 10) return { x: (ar.left - w) / 2, side: -1 };
    return { x: W - w - 6, side: 1 };
  }

  function setPos(x, y) {
    D.x = x;
    D.y = y;
    D.el.style.transform = `translate(${x}px, ${y}px)`;
  }
  function setPose(p) {
    D.pose = p;
    D.el.classList.remove('asleep', 'flying', 'glide', 'spread', 'sitting', 'roar');
    D.el.classList.add(p);
  }
  function faceD(dir) {
    D.dir = dir;
    D.el.classList.toggle('left', dir < 0);
  }
  // Движение по точкам. r — наклон корпуса (нос вниз при снижении).
  function path(points, ms, easing) {
    const kf = [{ x: D.x, y: D.y, r: 0 }, ...points].map((p) => ({ transform: `translate(${p.x}px, ${p.y}px) rotate(${p.r || 0}deg)` }));
    if (D.anim) D.anim.cancel();
    const a = D.el.animate(kf, { duration: ms, easing: easing || 'ease-in-out', fill: 'forwards' });
    D.anim = a;
    const last = points[points.length - 1];
    D.x = last.x;
    D.y = last.y;
    return a.finished.then(() => { D.el.style.transform = `translate(${D.x}px, ${D.y}px)`; a.cancel(); }).catch(() => {});
  }
  const tilt = (deg) => deg * D.dir;

  /* ---------------------------------------------------------------- Дракон: полёты */

  async function takeOff(tok) {
    setPose('spread');
    await wait(500);
    if (tok !== D.seq) return false;
    setPose('flying');
    D.el.classList.add('fast');
    await path([{ x: D.x, y: D.y - 26, r: tilt(-6) }], 650, 'ease-out');
    D.el.classList.remove('fast');
    return tok === D.seq;
  }

  async function landHere(tok) {
    setPose('spread');
    await wait(420);
    if (tok !== D.seq) return;
    setPose('sitting');
    D.el.classList.add('touchdown');
    setTimeout(() => D.el && D.el.classList.remove('touchdown'), 500);
  }

  async function goSleep(tok) {
    if (D.pose === 'sitting' || D.pose === 'asleep') { if (!(await takeOff(tok))) return; }
    setPose('flying');
    const s = sleepSpot();
    faceD(s.x >= D.x ? 1 : -1);
    const upY = Math.min(D.y, s.y) - 50;
    await path([
      { x: D.x + (s.x - D.x) * 0.15, y: D.y + (upY - D.y) * 0.6, r: tilt(-8) },
      { x: D.x + (s.x - D.x) * 0.55, y: upY, r: tilt(-2) },
    ], 1700, 'ease-in-out');
    if (tok !== D.seq) return;
    setPose('glide');
    await path([{ x: s.x, y: s.y - 14, r: tilt(4) }], 1100, 'ease-in-out');
    if (tok !== D.seq) return;
    setPose('flying');
    await path([{ x: s.x, y: s.y, r: 0 }], 450, 'ease-out');
    if (tok !== D.seq) return;
    await landHere(tok);
    await wait(700);
    if (tok !== D.seq) return;
    setPose('asleep');
    D.bottom = false;
    D.busy = false;
  }

  // Полёт админа/владельца: взлёт → в свободное поле → снижение с настоящими взмахами → посадка внизу
  async function flight() {
    if (D.busy || !on) return;
    D.busy = true;
    const tok = ++D.seq;
    const sx = window.scrollX;
    const sy = window.scrollY;
    const H = window.innerHeight;
    const L = lane();
    const lx = L.x + sx;
    setPose('sitting');
    await wait(600);
    if (tok !== D.seq) return;
    faceD(lx >= D.x ? 1 : -1);
    if (!(await takeOff(tok))) return;
    // разворот и набор высоты над полем
    const topY = sy + 24;
    await path([
      { x: D.x + (lx - D.x) * 0.35, y: Math.max(topY, D.y - 70), r: tilt(-10) },
      { x: D.x + (lx - D.x) * 0.8, y: topY + 10, r: tilt(-3) },
      { x: lx, y: topY, r: 0 },
    ], 2400, 'ease-in-out');
    if (tok !== D.seq) return;
    // снижение по полю: крылья раскрыты, лёгкая «змейка», потом частые взмахи перед землёй
    faceD(-L.side);
    const groundY = sy + H - DH() - 4;
    const span = groundY - topY;
    setPose('glide');
    await path([
      { x: lx - 16 * L.side, y: topY + span * 0.25, r: tilt(7) },
      { x: lx + 12 * L.side, y: topY + span * 0.5, r: tilt(-4) },
      { x: lx - 6 * L.side, y: topY + span * 0.68, r: tilt(5) },
    ], 3000, 'ease-in-out');
    if (tok !== D.seq) return;
    setPose('flying');
    await path([{ x: lx, y: groundY - 18, r: tilt(-4) }, { x: lx, y: groundY, r: 0 }], 1700, 'ease-out');
    if (tok !== D.seq) return;
    D.bottom = true;
    await landHere(tok);
    await sitAndLook(tok, rnd(7000, 11000));
    if (tok !== D.seq) return;
    await goSleep(tok);
  }

  async function sitAndLook(tok, ms) {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      await wait(rnd(1300, 2500));
      if (tok !== D.seq) return;
      if (Math.random() < 0.45) faceD(-D.dir);
      D.el.style.setProperty('--hr', rnd(-14, 12).toFixed(0) + 'deg');
      if (Math.random() < 0.3) puffSmoke();
    }
    D.el.style.setProperty('--hr', '0deg');
  }

  function puffSmoke() {
    if (!D.el) return;
    D.el.classList.remove('smoking');
    void D.el.offsetWidth;
    D.el.classList.add('smoking');
  }

  function scheduleFlight() {
    clearTimeout(D.nextFlight);
    if (!on || (role !== 'admin' && role !== 'owner')) return;
    D.nextFlight = setTimeout(async () => {
      if (!D.busy && !document.hidden) await flight();
      scheduleFlight();
    }, rnd(40000, 80000));
  }

  /* ---------------------------------------------------------------- Дракон: владелец */

  // Один клик: перепрыгнуть на соседнее место
  async function dragonSingle() {
    if (D.busy) return;
    D.busy = true;
    const tok = ++D.seq;
    const wasAsleep = D.pose === 'asleep';
    const W = window.innerWidth;
    const sx = window.scrollX;
    let nx = D.x + (Math.random() < 0.5 ? -1 : 1) * rnd(60, 130);
    nx = Math.max(sx + 6, Math.min(sx + W - DW() - 6, nx));
    faceD(nx >= D.x ? 1 : -1);
    setPose('spread');
    await path([{ x: (D.x + nx) / 2, y: D.y - 34, r: tilt(-8) }, { x: nx, y: D.y, r: 0 }], 750, 'ease-in-out');
    if (tok !== D.seq) return;
    await landHere(tok);
    if (!D.bottom) {
      D.home += nx - sleepSpot().x;
      D.home = Math.max(-500, Math.min(500, D.home));
    }
    if (wasAsleep && !D.bottom) { await wait(600); if (tok === D.seq) setPose('asleep'); }
    D.busy = false;
  }

  // Двойной клик: спуститься вниз. Ещё двойной в течение 5 с — огонь по зверькам.
  async function dragonDouble() {
    if (D.bottom && Date.now() < D.armedUntil) { attack(); return; }
    if (D.bottom) { const tok = ++D.seq; D.busy = true; await goSleep(tok); return; }
    if (D.busy) return;
    D.busy = true;
    const tok = ++D.seq;
    if (!(await takeOff(tok))) return;
    const groundY = window.scrollY + window.innerHeight - DH() - 4;
    setPose('flying');
    await path([{ x: D.x, y: D.y + (groundY - D.y) * 0.6, r: tilt(6) }, { x: D.x, y: groundY, r: 0 }], 1900, 'ease-in-out');
    if (tok !== D.seq) return;
    D.bottom = true;
    await landHere(tok);
    D.armedUntil = Date.now() + 5000;
    D.el.classList.add('armed');
    puffSmoke();
    await wait(5000);
    if (D.el) D.el.classList.remove('armed');
    if (tok !== D.seq) return;
    await sitAndLook(tok, rnd(5000, 8000));
    if (tok !== D.seq) return;
    await goSleep(tok);
  }

  // Огонь: поток раскалённых клубов от пасти к цели. Каждый клуб растёт, остывает (белый → жёлтый → красный)
  // и в конце превращается в дым. Плюс жар и искры у цели.
  function breathFire(mx, my, tx, ty, ms = 640) {
    const dx = tx - mx;
    const dy = ty - my;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const start = performance.now();
    const timer = setInterval(() => {
      const t0 = performance.now() - start;
      if (t0 > ms) { clearInterval(timer); return; }
      for (let k = 0; k < 3; k++) {
        const p = el('span', 'fp');
        const size = rnd(22, 32);
        p.style.width = p.style.height = size + 'px';
        p.style.left = mx + 'px';
        p.style.top = my + 'px';
        document.body.appendChild(p);
        const spread = rnd(-1, 1) * Math.min(34, len * 0.16);
        const over = rnd(1.0, 1.12);
        const life = rnd(360, 480);
        const at = (f, s) => `translate(calc(-50% + ${dx * f * over + nx * spread * f}px), calc(-50% + ${dy * f * over + ny * spread * f - (f > 0.7 ? (f - 0.7) * 30 : 0)}px)) scale(${s})`;
        p.animate([
          { transform: at(0, 0.55), opacity: 1, filter: 'blur(2px) brightness(1.3) saturate(1.1)' },
          { transform: at(0.35, 1.2), opacity: 1, filter: 'blur(3.5px) brightness(1.15)', offset: 0.3 },
          { transform: at(0.75, 2.0), opacity: 0.85, filter: 'blur(4px) brightness(.85) saturate(1.3)', offset: 0.7 },
          { transform: at(1, 2.6), opacity: 0, filter: 'blur(7px) brightness(.45) saturate(.6)' },
        ], { duration: life, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' }).finished.then(() => p.remove()).catch(() => p.remove());
      }
    }, 16);
    // сплошное раскалённое ядро струи под клубами
    const core = el('span', 'fire-core');
    core.style.left = mx + 'px';
    core.style.top = my + 'px';
    core.style.width = len * 0.8 + 'px';
    document.body.appendChild(core);
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    core.animate([
      { transform: `rotate(${ang}deg) scaleX(0)`, opacity: 0.9 },
      { transform: `rotate(${ang}deg) scaleX(1)`, opacity: 1, offset: 0.3 },
      { transform: `rotate(${ang}deg) scaleX(1)`, opacity: 0.9, offset: 0.85 },
      { transform: `rotate(${ang}deg) scaleX(.6)`, opacity: 0 },
    ], { duration: ms + 150, easing: 'ease-out', fill: 'forwards' }).finished.then(() => core.remove()).catch(() => core.remove());
    // свечение у пасти
    const mouth = el('span', 'fire-mouth');
    mouth.style.left = mx + 'px';
    mouth.style.top = my + 'px';
    document.body.appendChild(mouth);
    setTimeout(() => mouth.remove(), ms + 200);
    // жар и искры у цели
    setTimeout(() => {
      const heat = el('span', 'fire-heat');
      heat.style.left = tx + 'px';
      heat.style.top = ty + 'px';
      document.body.appendChild(heat);
      setTimeout(() => heat.remove(), 1100);
      for (let i = 0; i < 16; i++) {
        const e = el('span', 'ember');
        e.style.left = tx + rnd(-10, 10) + 'px';
        e.style.top = ty + rnd(-8, 8) + 'px';
        document.body.appendChild(e);
        const vx = rnd(-50, 50);
        const vy = rnd(-64, -16);
        e.animate([
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${vx * 0.6}px, ${vy}px) scale(.8)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${vx}px, ${vy * 0.4 + 26}px) scale(.3)`, opacity: 0 },
        ], { duration: rnd(600, 1100), delay: i * 22, easing: 'ease-out', fill: 'both' }).finished.then(() => e.remove()).catch(() => e.remove());
      }
      for (let i = 0; i < 6; i++) {
        const s = el('span', 'fire-smoke');
        s.style.left = tx + rnd(-14, 14) + 'px';
        s.style.top = ty + rnd(-6, 6) + 'px';
        document.body.appendChild(s);
        s.animate([
          { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.55, offset: 0.25 },
          { transform: `translate(calc(-50% + ${rnd(-14, 14)}px), calc(-50% - ${rnd(40, 70)}px)) scale(2.2)`, opacity: 0 },
        ], { duration: rnd(1300, 1900), delay: 250 + i * 90, easing: 'ease-out', fill: 'both' }).finished.then(() => s.remove()).catch(() => s.remove());
      }
    }, 200);
  }

  async function attack() {
    const tok = ++D.seq;
    D.busy = true;
    D.armedUntil = 0;
    D.el.classList.remove('armed');
    setPose('sitting');
    const dragonCx = () => { const r = D.el.getBoundingClientRect(); return r.left + r.width / 2; };
    const targets = petsAlive().slice().sort((a, b) => Math.abs(a.x - dragonCx()) - Math.abs(b.x - dragonCx()));
    for (const p of targets) {
      if (tok !== D.seq) return;
      if (p.dead) continue;
      const pr = p.el.getBoundingClientRect();
      faceD(pr.left + pr.width / 2 >= dragonCx() ? 1 : -1);
      await wait(260);
      if (tok !== D.seq) return;
      setPose('roar');
      await wait(120);
      const dr = D.el.getBoundingClientRect();
      const mx = D.dir > 0 ? dr.left + dr.width * 0.9 : dr.left + dr.width * 0.1;
      const my = dr.top + dr.height * 0.385;
      breathFire(mx, my, pr.left + pr.width / 2, pr.top + pr.height * 0.55);
      await wait(380);
      killPet(p);
      await wait(520);
      setPose('sitting');
      await wait(200);
    }
    if (tok !== D.seq) return;
    puffSmoke();
    clearTimeout(respawnTimer);
    respawnTimer = setTimeout(() => { if (on) spawnPets(true); }, 30000);
    await wait(900);
    await goSleep(tok);
  }

  // Владелец: голова следит за мышкой, если она рядом
  let lookRaf = 0;
  let lastPt = null;
  function onPointer(ev) {
    if (role !== 'owner' || !D.el) return;
    lastPt = ev;
    if (lookRaf) return;
    lookRaf = requestAnimationFrame(() => {
      lookRaf = 0;
      if (!D.el) return;
      const r = D.el.getBoundingClientRect();
      const hx = r.left + r.width * (D.dir > 0 ? 0.75 : 0.25);
      const hy = r.top + r.height * 0.3;
      const dx = lastPt.clientX - hx;
      const dy = lastPt.clientY - hy;
      const near = Math.hypot(dx, dy) < 240;
      D.el.classList.toggle('peek', near);
      if (!near) { D.el.style.setProperty('--hr', '0deg'); return; }
      if (!D.busy && D.pose !== 'flying' && D.pose !== 'glide' && dx * D.dir < -40) faceD(dx > 0 ? 1 : -1);
      const ang = (Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI;
      D.el.style.setProperty('--hr', Math.max(-26, Math.min(26, ang)).toFixed(0) + 'deg');
    });
  }

  /* ---------------------------------------------------------------- Включение / выключение */

  function resetDragon() {
    if (!D.el) return;
    D.seq++;
    if (D.anim) D.anim.cancel();
    D.busy = false;
    D.bottom = false;
    D.armedUntil = 0;
    D.el.classList.remove('armed', 'peek', 'left', 'fast', 'touchdown');
    D.el.style.setProperty('--hr', '0deg');
    setPose('asleep');
    const s = sleepSpot();
    setPos(s.x, s.y);
  }

  function applyRole() {
    if (!on || !D.el) return;
    D.el.classList.toggle('owner', role === 'owner');
    resetDragon();
    scheduleFlight();
  }

  function onCopied() {
    const alive = petsAlive();
    if (alive.length) petHappy(alive[Math.floor(Math.random() * alive.length)]);
  }

  // Долго никто не печатает и не двигает мышь — зверьки засыпают
  function poke() {
    clearTimeout(idleTimer);
    petsAlive().forEach((p) => { if (p.sleeping && p.longNap) { p.longNap = false; petWake(p); } });
    idleTimer = setTimeout(() => petsAlive().forEach((p) => { if (!p.sleeping) { p.longNap = true; petNap(p, 10 * 60 * 1000); } }), 90000);
  }

  let resizeT = 0;
  function onResize() {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (!on) return;
      const W = window.innerWidth;
      petsAlive().forEach((p) => { if (p.x > W - 70) { p.x = W - 80; p.el.style.transition = 'none'; p.el.style.transform = `translateX(${p.x}px)`; } });
      if (D.el && !D.busy) { const s = sleepSpot(); setPos(s.x, s.y); }
    }, 200);
  }

  function start() {
    if (on) return;
    on = true;
    ground = el('div', 'pets-ground');
    sky = el('div', 'pets-sky');
    document.body.appendChild(ground);
    document.body.appendChild(sky);
    spawnPets(false);
    makeDragon();
    applyRole();
    poke();
    document.addEventListener('sufler:copied', onCopied);
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', poke, { passive: true });
    window.addEventListener('keydown', poke);
    window.addEventListener('resize', onResize);
  }

  function stop() {
    if (!on) return;
    on = false;
    pets.splice(0).forEach((p) => clearTimeout(p.timer));
    clearTimeout(respawnTimer);
    clearTimeout(idleTimer);
    clearTimeout(D.nextFlight);
    D.seq++;
    if (ground) ground.remove();
    if (sky) sky.remove();
    D.el = null;
    document.removeEventListener('sufler:copied', onCopied);
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('pointerdown', poke);
    window.removeEventListener('keydown', poke);
    window.removeEventListener('resize', onResize);
  }

  function enabled() {
    try { const v = localStorage.getItem(KEY); return v == null ? !reduced : v === '"on"'; } catch (e) { return !reduced; }
  }
  function setEnabled(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v ? 'on' : 'off')); } catch (e) { /* ничего */ }
    if (v) start(); else stop();
  }

  window.SuflerPets = {
    init() { if (enabled()) start(); },
    setRole(r) { role = r || 'guest'; applyRole(); },
    enabled,
    toggle() { const v = !on; setEnabled(v); if (v) applyRole(); return v; },
    _test: { flight: () => flight(), double: () => dragonDouble(), single: () => dragonSingle(), fire: (a, b, c, d) => breathFire(a, b, c, d, 2500) },
  };
})();
