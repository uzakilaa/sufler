/*
 * Питомцы Суфлёра: котик, лисёнок, ёжик, пёсик и панда гуляют внизу экрана, а дракон живёт наверху.
 *
 * Дракон по ролям:
 *   гость    — просто спит наверху;
 *   админ    — спит и иногда облетает край экрана: спускается, раскрывает крылья, садится, потом улетает спать;
 *   владелец — всё то же + следит головой за мышкой; клик — пересаживается, двойной клик — спускается вниз,
 *              и если в течение 5 секунд ещё раз дважды кликнуть — сжигает зверьков (мультяшно: пуф и привидение)
 *              и улетает спать. Зверьки возвращаются через полминуты.
 *
 * Всё двигается только трансформами (это дёшево для браузера). Выключается кнопкой «Питомцы» в подвале.
 */
(function () {
  'use strict';

  const KEY = 'sufler.pets';
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const isSmall = () => window.innerWidth < 700;

  /* ---------------------------------------------------------------- Рисунки (все свои, смотрят вправо) */

  const eyes = (x1, y1, x2, y2, c = '#2f2a24') => `
    <g class="eyes">
      <ellipse class="eye" cx="${x1}" cy="${y1}" rx="1.9" ry="2.6" fill="${c}"/>
      <ellipse class="eye" cx="${x2}" cy="${y2}" rx="2" ry="2.7" fill="${c}"/>
      <circle cx="${x1 + 0.6}" cy="${y1 - 0.9}" r=".6" fill="#fff"/><circle cx="${x2 + 0.6}" cy="${y2 - 0.9}" r=".65" fill="#fff"/>
    </g>`;
  const cheeks = (x1, x2, y) => `<ellipse cx="${x1}" cy="${y}" rx="2.4" ry="1.5" fill="#e8907a" opacity=".5"/><ellipse cx="${x2}" cy="${y}" rx="2.4" ry="1.5" fill="#e8907a" opacity=".5"/>`;
  const legs = (back, front, y = 40, h = 11) => `
    <g class="legs">
      <rect class="leg lb" x="16" y="${y}" width="6" height="${h}" rx="3" fill="${back}"/>
      <rect class="leg lf" x="32" y="${y}" width="6" height="${h}" rx="3" fill="${back}"/>
    </g>`;
  const legsFront = (front, y = 41, h = 11) => `
    <g class="legs">
      <rect class="leg lb2" x="20" y="${y}" width="6" height="${h}" rx="3" fill="${front}"/>
      <rect class="leg lf2" x="36" y="${y}" width="6" height="${h}" rx="3" fill="${front}"/>
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
      ${legs('#6b4a35', '#6b4a35', 44, 7)}
      <path d="M7 45 C5 31 15 19 29 19 C39 19 45 25 45 32 L46 45 Z" fill="#8a6a4f"/>
      <path class="spikes" d="M7 45 L3 39 L8 37 L4 31 L10 30 L8 24 L14 25 L14 18 L20 21 L22 14 L26 19 L30 13 L32 19 L37 14 L38 21 L43 18 L42 25 L47 26 L44 31 Z" fill="#7b5b44"/>
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
        <ellipse class="ear-flop" cx="32" cy="24" rx="4.6" ry="8.5" transform="rotate(18 32 24)" fill="#8f5b34"/>
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
  };
  const NAMES = { cat: 'котик', fox: 'лисёнок', hedgehog: 'ёжик', dog: 'пёсик', panda: 'панда' };

  const DRAGON = `
    <svg viewBox="0 0 84 76" class="dragon-svg" aria-hidden="true">
      <path class="d-tail" d="M26 60 C12 66 4 58 7 50 C8 46 6 43 3 42" stroke="#5c8c6b" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M3 42 L-1 36 L7 38 Z" fill="#c9a86a"/>
      <path class="wing wb" d="M40 38 C31 24 22 19 15 21 C19 27 20 31 20 36 C25 34 30 36 32 40 Z" fill="#46745a"/>
      <ellipse cx="30" cy="64" rx="8" ry="6" fill="#5c8c6b"/>
      <g class="d-body">
        <ellipse cx="38" cy="53" rx="17" ry="14" fill="#6e9e7d"/>
        <ellipse cx="44" cy="55" rx="9" ry="11" fill="#f1e3c4"/>
        <path d="M37.5 50 h12 M37 55 h13 M38 60 h11" stroke="#dcc79c" stroke-width="1.2" stroke-linecap="round"/>
        <path d="M24 44 l3 -5 l3 4 l3 -5 l3 4" fill="#f1e3c4"/>
      </g>
      <rect x="44" y="62" width="7" height="9" rx="3.5" fill="#5c8c6b"/><rect x="34" y="63" width="7" height="8" rx="3.5" fill="#5c8c6b"/>
      <path class="wing wf" d="M41 39 C34 26 27 22 21 24 C24 29 25 33 25 37 C29 36 33 38 34 42 Z" fill="#5b8a6c"/>
      <g class="d-head-pose"><g class="d-head">
        <path d="M44 27 l-4 -3 l4 -1 l-2 -4 l5 1" fill="#f1e3c4"/>
        <ellipse cx="56" cy="29" rx="15" ry="13" fill="#6e9e7d"/>
        <ellipse cx="68" cy="33" rx="9.5" ry="7.5" fill="#80ae8e"/>
        <path d="M50 18 L46 6 L55 15 Z" fill="#f1e3c4"/><path d="M58 16 L59 4 L64 15 Z" fill="#f1e3c4"/>
        <circle cx="72.5" cy="31" r="1" fill="#2f4a38"/><circle cx="75" cy="32.4" r="1" fill="#2f4a38"/>
        <g class="eyes"><ellipse class="eye" cx="59" cy="26" rx="2.4" ry="3.2" fill="#2f2a24"/><circle cx="59.8" cy="24.8" r=".8" fill="#fff"/></g>
        <path class="d-shut" d="M56.3 26.5 q2.7 2 5.4 0" stroke="#2f2a24" stroke-width="1.2" fill="none" stroke-linecap="round"/>
        <path class="d-mouth" d="M64 37.2 q4 1.8 8 -.5" stroke="#2f4a38" stroke-width="1" fill="none" stroke-linecap="round"/>
        <ellipse class="d-roar" cx="70" cy="37.5" rx="4" ry="2.6" fill="#8a3b30"/>
        <ellipse cx="61" cy="33" rx="2.6" ry="1.6" fill="#e8907a" opacity=".45"/>
      </g></g>
    </svg>
    <span class="zzz" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></span>`;

  const GHOST = '<svg viewBox="0 0 24 28"><path d="M3 12 a9 9 0 0 1 18 0 v13 l-3 -2 l-3 2 l-3 -2 l-3 2 l-3 -2 l-3 2 z" fill="#fffaf2" stroke="#d9cbb6"/><circle cx="9" cy="12" r="1.3" fill="#2f2a24"/><circle cx="15" cy="12" r="1.3" fill="#2f2a24"/><ellipse cx="12" cy="16.5" rx="1.6" ry="1.1" fill="#2f2a24"/></svg>';

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

  /* ---------------------------------------------------------------- Зверьки */

  function makePet(kind, fromEdge) {
    const W = window.innerWidth;
    const p = { kind, x: fromEdge ? (Math.random() < 0.5 ? -60 : W + 10) : rnd(40, W - 100), dir: 1, timer: 0, dead: false, sleeping: false };
    p.el = el('div', 'pet pet-' + kind);
    p.el.title = NAMES[kind];
    p.el.innerHTML = `<div class="pet-flip"><div class="pet-hop"><svg viewBox="0 0 64 56" aria-hidden="true">${ART[kind]}</svg></div></div>`;
    p.el.style.transform = `translateX(${p.x}px)`;
    p.el.addEventListener('click', (ev) => { ev.stopPropagation(); petHappy(p, true); });
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
      const speed = p.kind === 'hedgehog' ? 26 : p.kind === 'panda' ? 30 : rnd(38, 55);
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

  function petHappy(p, byClick) {
    if (p.dead) return;
    if (p.sleeping) petWake(p);
    const hop = p.el.querySelector('.pet-hop');
    hop.classList.remove('jump');
    void hop.offsetWidth;
    hop.classList.add('jump');
    const r = p.el.getBoundingClientRect();
    const heart = el('span', 'pet-heart', byClick ? '♥' : '✦');
    heart.style.left = r.left + r.width / 2 + 'px';
    heart.style.top = r.top + 'px';
    document.body.appendChild(heart);
    setTimeout(() => heart.remove(), 1200);
  }

  function petsAlive() { return pets.filter((p) => !p.dead); }

  function spawnPets(fromEdge) {
    const kinds = Object.keys(ART).sort(() => Math.random() - 0.5);
    const n = isSmall() ? 3 : 5;
    kinds.slice(0, n).forEach((k, i) => setTimeout(() => on && makePet(k, fromEdge), fromEdge ? i * 700 : 0));
  }

  function killPet(p) {
    p.dead = true;
    clearTimeout(p.timer);
    const r = p.el.getBoundingClientRect();
    p.el.classList.add('burnt');
    const puff = el('span', 'poof');
    puff.style.left = r.left + r.width / 2 + 'px';
    puff.style.top = r.top + r.height / 2 + 'px';
    document.body.appendChild(puff);
    const ghost = el('span', 'ghost', GHOST);
    ghost.style.left = r.left + r.width / 2 + 'px';
    ghost.style.top = r.top + 'px';
    document.body.appendChild(ghost);
    setTimeout(() => { puff.remove(); p.el.remove(); }, 900);
    setTimeout(() => ghost.remove(), 2600);
    pets.splice(pets.indexOf(p), 1);
  }

  /* ---------------------------------------------------------------- Дракон */

  const D = { el: null, x: 0, y: 0, dir: 1, seq: 0, pose: 'asleep', anim: null, home: 0, busy: false, armedUntil: 0, nextFlight: 0, bottom: false };
  const DW = () => (isSmall() ? 62 : 78);
  const DH = () => (isSmall() ? 56 : 70);

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

  // Где дракон спит: справа от вкладок, если там есть место, иначе — на шапке
  function sleepSpot() {
    const sx = window.scrollX;
    const sy = window.scrollY;
    const tabs = document.querySelector('.tabs');
    const app = document.querySelector('.app');
    const top = document.querySelector('.topbar');
    const w = DW();
    const h = DH();
    let x;
    let y;
    if (tabs && app && !tabs.closest('[hidden]')) {
      const tr = tabs.getBoundingClientRect();
      const ar = app.getBoundingClientRect();
      const free = ar.right - 24 - tr.right;
      if (free > w + 40) {
        x = ar.right - 24 - w - 30 + D.home;
        x = Math.max(tr.right + 10, Math.min(ar.right - 24 - w, x));
        y = tr.bottom - h + 4;
        return { x: x + sx, y: y + sy };
      }
    }
    const r = top ? top.getBoundingClientRect() : { right: window.innerWidth - 20, bottom: 70 };
    x = Math.max(10, Math.min(window.innerWidth - w - 10, r.right - w - 40 + D.home));
    y = r.bottom - h * 0.55;
    return { x: x + sx, y: y + sy };
  }

  function setPos(x, y) {
    D.x = x;
    D.y = y;
    D.el.style.transform = `translate(${x}px, ${y}px)`;
  }
  function setPose(p) {
    D.pose = p;
    D.el.classList.remove('asleep', 'flying', 'spread', 'sitting', 'roar');
    D.el.classList.add(p);
  }
  function faceD(dir) {
    D.dir = dir;
    D.el.classList.toggle('left', dir < 0);
  }
  function moveTo(x, y, ms, easing) {
    const from = `translate(${D.x}px, ${D.y}px)`;
    const to = `translate(${x}px, ${y}px)`;
    if (D.anim) D.anim.cancel();
    const a = D.el.animate([{ transform: from }, { transform: to }], { duration: ms, easing: easing || 'ease-in-out', fill: 'forwards' });
    D.anim = a;
    D.x = x;
    D.y = y;
    return a.finished.then(() => { D.el.style.transform = to; a.cancel(); }).catch(() => {});
  }
  // прыжок дугой
  async function hopTo(x, y, ms) {
    const midY = Math.min(D.y, y) - 34;
    const midX = (D.x + x) / 2;
    await moveTo(midX, midY, ms / 2, 'ease-out');
    await moveTo(x, y, ms / 2, 'ease-in');
  }

  async function goSleep(tok) {
    setPose('flying');
    const s = sleepSpot();
    faceD(s.x >= D.x ? 1 : -1);
    await moveTo(D.x + (s.x - D.x) * 0.3, Math.min(D.y, s.y) - 60, 1300, 'ease-out');
    if (tok !== D.seq) return;
    await moveTo(s.x, s.y, 1300, 'ease-in-out');
    if (tok !== D.seq) return;
    setPose('spread');
    await wait(350);
    if (tok !== D.seq) return;
    setPose('asleep');
    D.bottom = false;
    D.busy = false;
  }

  // Облёт края экрана: взлетает, спускается по краю, раскрывает крылья, садится, сидит, улетает спать
  async function flight() {
    if (D.busy || !on) return;
    D.busy = true;
    const tok = ++D.seq;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const sx = window.scrollX;
    const sy = window.scrollY;
    const right = Math.random() < 0.6;
    const edgeX = sx + (right ? W - DW() - 12 : 12);
    setPose('sitting');
    await wait(700);
    if (tok !== D.seq) return;
    setPose('flying');
    faceD(right ? 1 : -1);
    await moveTo(edgeX, Math.max(sy + 8, D.y - 40), 1500);
    if (tok !== D.seq) return;
    faceD(right ? -1 : 1);
    await moveTo(edgeX, sy + H - DH() - 14, 2300, 'ease-in');
    if (tok !== D.seq) return;
    D.bottom = true;
    await landAndSit(tok, rnd(7000, 11000));
    if (tok !== D.seq) return;
    await goSleep(tok);
  }

  async function landAndSit(tok, ms) {
    setPose('spread');
    await wait(650);
    if (tok !== D.seq) return;
    setPose('sitting');
    const until = Date.now() + ms;
    while (Date.now() < until) {
      await wait(rnd(1400, 2600));
      if (tok !== D.seq) return;
      if (Math.random() < 0.5) faceD(-D.dir);
      D.el.style.setProperty('--hr', rnd(-14, 14).toFixed(0) + 'deg');
    }
    D.el.style.setProperty('--hr', '0deg');
  }

  function scheduleFlight() {
    clearTimeout(D.nextFlight);
    if (!on || (role !== 'admin' && role !== 'owner')) return;
    D.nextFlight = setTimeout(async () => {
      if (!D.busy && !document.hidden) await flight();
      scheduleFlight();
    }, rnd(40000, 80000));
  }

  // Владелец, один клик: пересесть на соседнее место
  async function dragonSingle() {
    if (D.busy) return;
    D.busy = true;
    const tok = ++D.seq;
    const wasAsleep = D.pose === 'asleep';
    setPose('sitting');
    const W = window.innerWidth;
    const sx = window.scrollX;
    let nx = D.x + (Math.random() < 0.5 ? -1 : 1) * rnd(60, 130);
    nx = Math.max(sx + 8, Math.min(sx + W - DW() - 8, nx));
    faceD(nx >= D.x ? 1 : -1);
    await hopTo(nx, D.y, 700);
    if (tok !== D.seq) return;
    if (!D.bottom) D.home += nx - sleepSpot().x; // запоминаем новое место сна
    if (!D.bottom) D.home = Math.max(-500, Math.min(500, D.home));
    if (wasAsleep && !D.bottom) { await wait(500); if (tok === D.seq) setPose('asleep'); }
    D.busy = false;
  }

  // Владелец, двойной клик: спуститься вниз. Ещё двойной в течение 5 с — огонь по зверькам.
  async function dragonDouble() {
    if (D.bottom && Date.now() < D.armedUntil) { attack(); return; }
    if (D.bottom) { const tok = ++D.seq; D.busy = true; await goSleep(tok); return; }
    if (D.busy) return;
    D.busy = true;
    const tok = ++D.seq;
    setPose('flying');
    const H = window.innerHeight;
    const sy = window.scrollY;
    await moveTo(D.x, sy + H - DH() - 14, 1500, 'ease-in');
    if (tok !== D.seq) return;
    D.bottom = true;
    setPose('spread');
    await wait(500);
    if (tok !== D.seq) return;
    setPose('sitting');
    D.armedUntil = Date.now() + 5000;
    D.el.classList.add('armed');
    await wait(5000);
    D.el.classList.remove('armed');
    if (tok !== D.seq) return;
    await landAndSit(tok, rnd(5000, 8000));
    if (tok !== D.seq) return;
    await goSleep(tok);
  }

  async function attack() {
    const tok = ++D.seq;
    D.busy = true;
    D.armedUntil = 0;
    D.el.classList.remove('armed');
    setPose('sitting');
    const targets = petsAlive().slice().sort((a, b) => Math.abs(a.x - (D.x - window.scrollX)) - Math.abs(b.x - (D.x - window.scrollX)));
    for (const p of targets) {
      if (tok !== D.seq) return;
      if (p.dead) continue;
      const pr = p.el.getBoundingClientRect();
      const dr = D.el.getBoundingClientRect();
      faceD(pr.left + pr.width / 2 >= dr.left + dr.width / 2 ? 1 : -1);
      await wait(250);
      setPose('roar');
      const mx = D.dir > 0 ? dr.left + dr.width * 0.88 : dr.left + dr.width * 0.12;
      const my = dr.top + dr.height * 0.48;
      for (let i = 0; i < 7; i++) {
        const f = el('span', 'flame');
        f.style.left = mx + 'px';
        f.style.top = my + 'px';
        document.body.appendChild(f);
        const tx = pr.left + pr.width / 2 - mx + rnd(-10, 10);
        const ty = pr.top + pr.height / 2 - my + rnd(-8, 8);
        f.animate([
          { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
          { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1.3)`, opacity: 0.9 },
        ], { duration: 380, delay: i * 45, easing: 'ease-in', fill: 'forwards' }).finished.then(() => f.remove()).catch(() => f.remove());
      }
      await wait(430);
      killPet(p);
      setPose('sitting');
      await wait(350);
    }
    if (tok !== D.seq) return;
    clearTimeout(respawnTimer);
    respawnTimer = setTimeout(() => { if (on) spawnPets(true); }, 30000);
    await wait(600);
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
      const r = D.el.getBoundingClientRect();
      const hx = r.left + r.width * (D.dir > 0 ? 0.7 : 0.3);
      const hy = r.top + r.height * 0.38;
      const dx = lastPt.clientX - hx;
      const dy = lastPt.clientY - hy;
      const near = Math.hypot(dx, dy) < 220;
      D.el.classList.toggle('peek', near);
      if (!near) { D.el.style.setProperty('--hr', '0deg'); return; }
      if (!D.busy && D.pose !== 'flying') {
        if (dx * D.dir < -30) faceD(dx > 0 ? 1 : -1);
      }
      const ang = Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI;
      D.el.style.setProperty('--hr', Math.max(-28, Math.min(28, ang)).toFixed(0) + 'deg');
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
    D.el.classList.remove('armed', 'peek', 'left');
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
    if (alive.length) petHappy(alive[Math.floor(Math.random() * alive.length)], false);
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
    _test: { flight: () => flight(), double: () => dragonDouble(), single: () => dragonSingle() },
  };
})();
