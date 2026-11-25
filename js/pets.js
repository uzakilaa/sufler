/*
 * Питомцы Суфлёра: котик, лисёнок, ёжик, пёсик, панда, цыплёнок, зайчик, утёнок и пингвин гуляют внизу экрана.
 * Клик — подпрыгивают и показывают пузырь с сердечком, после копирования ответа кто-нибудь радуется,
 * если долго ничего не делать — засыпают. По умолчанию выключены, включаются кнопкой «Питомцы» в подвале.
 * Всё двигается трансформами (это дёшево для браузера).
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


  const HEART = '<svg viewBox="0 0 16 14"><path d="M8 13 C3 9 0 6.6 0 3.8 A3.7 3.7 0 0 1 8 2.4 A3.7 3.7 0 0 1 16 3.8 C16 6.6 13 9 8 13 Z" fill="#e0475c"/></svg>';

  /* ---------------------------------------------------------------- Поведение */

  let on = false;
  let ground = null;   // фиксированный слой у нижнего края экрана
  const pets = [];
  let idleTimer = 0;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  function makePet(kind) {
    const W = window.innerWidth;
    const p = { kind, x: rnd(30, W - 80), dir: 1, timer: 0, sleeping: false };
    p.el = el('div', 'pet pet-' + kind);
    p.el.title = NAMES[kind];
    p.el.innerHTML = `<div class="pet-flip"><div class="pet-hop"><svg viewBox="0 0 64 56" aria-hidden="true">${ART[kind]}</svg></div></div>`;
    p.el.style.transform = `translateX(${p.x}px)`;
    p.el.addEventListener('click', (ev) => { ev.stopPropagation(); petHappy(p); });
    ground.appendChild(p.el);
    pets.push(p);
    p.timer = setTimeout(() => petStep(p), rnd(300, 2500));
    return p;
  }

  function face(p, dir) {
    p.dir = dir;
    p.el.classList.toggle('left', dir < 0);
  }

  function petStep(p) {
    if (!on) return;
    clearTimeout(p.timer);
    if (p.sleeping) return;
    const W = window.innerWidth;
    const r = Math.random();
    if (r < 0.62) {
      const to = Math.max(8, Math.min(W - 56, p.x + rnd(-1, 1) * rnd(100, W * 0.45)));
      const dist = Math.abs(to - p.x);
      const speed = (SPEED[p.kind] || rnd(34, 50)) * 0.85;
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
    if (!p.sleeping) return;
    p.sleeping = false;
    p.el.classList.remove('sleep');
    p.timer = setTimeout(() => petStep(p), rnd(400, 1500));
  }

  // Клик или копирование: зверёк подпрыгивает и показывает пузырь с сердечком
  function petHappy(p) {
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

  function spawnPets() {
    const kinds = Object.keys(ART).sort(() => Math.random() - 0.5);
    kinds.slice(0, isSmall() ? 4 : kinds.length).forEach((k) => makePet(k));
  }

  function onCopied() {
    if (pets.length) petHappy(pets[Math.floor(Math.random() * pets.length)]);
  }

  // Долго никто не печатает и не двигает мышь — зверьки засыпают
  function poke() {
    clearTimeout(idleTimer);
    pets.forEach((p) => { if (p.sleeping && p.longNap) { p.longNap = false; petWake(p); } });
    idleTimer = setTimeout(() => pets.forEach((p) => { if (!p.sleeping) { p.longNap = true; petNap(p, 10 * 60 * 1000); } }), 90000);
  }

  let resizeT = 0;
  function onResize() {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      const W = window.innerWidth;
      pets.forEach((p) => { if (p.x > W - 56) { p.x = W - 64; p.el.style.transition = 'none'; p.el.style.transform = `translateX(${p.x}px)`; } });
    }, 200);
  }

  function start() {
    if (on) return;
    on = true;
    ground = el('div', 'pets-ground');
    document.body.appendChild(ground);
    spawnPets();
    poke();
    document.addEventListener('sufler:copied', onCopied);
    window.addEventListener('pointerdown', poke, { passive: true });
    window.addEventListener('keydown', poke);
    window.addEventListener('resize', onResize);
  }

  function stop() {
    if (!on) return;
    on = false;
    pets.splice(0).forEach((p) => clearTimeout(p.timer));
    clearTimeout(idleTimer);
    if (ground) ground.remove();
    document.removeEventListener('sufler:copied', onCopied);
    window.removeEventListener('pointerdown', poke);
    window.removeEventListener('keydown', poke);
    window.removeEventListener('resize', onResize);
  }

  // По умолчанию питомцы выключены: включаются кнопкой «Питомцы» внизу страницы
  function enabled() {
    try { return localStorage.getItem(KEY) === '"on"'; } catch (e) { return false; }
  }
  function setEnabled(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v ? 'on' : 'off')); } catch (e) { /* ничего */ }
    if (v) start(); else stop();
  }

  window.SuflerPets = {
    init() { if (enabled() && !reduced) start(); },
    setRole() { /* у питомцев больше нет поведения по ролям */ },
    enabled,
    toggle() { const v = !on; setEnabled(v); return v; },
  };
})();
