/* Оболочка сайта лекции: верхняя панель + блоки во фреймах.
   Контракт блока — window.SiteBlock внутри фрейма (см. CONTRACT.md). */
(function () {
  'use strict';

  const BLOCKS = {
    intro:    { src: 'blocks/intro.html',    title: 'Начало',                 pdf: false },
    'title-catboost': { src: 'blocks/title-catboost.html', title: 'Блок 1 · CatBoost с нуля', pdf: true },
    catboost: { src: 'blocks/catboost.html', title: 'Блок 1 · CatBoost с нуля', pdf: true },
    practice: { src: 'blocks/practice.html', title: 'Блок 2 · Промышленная практика', pdf: false },
    'title-case': { src: 'blocks/title-case.html', title: 'Блок 3 · Бизнес-кейс «Взыскание»', pdf: false },
    case:     { src: 'blocks/case.html',     title: 'Блок 3 · Бизнес-кейс «Взыскание»', pdf: false },
    finale:   { src: 'blocks/finale.html',   title: 'Заключение', pdf: false },
  };
  const ORDER = ['intro', 'title-catboost', 'catboost', 'practice', 'title-case', 'case', 'finale'];
  // Вход в блок со вкладки или с карточки плана начинается с его титульного кадра.
  const ENTRY = { catboost: 'title-catboost', case: 'title-case' };

  const $ = id => document.getElementById(id);
  const stage = $('stage'), loading = $('loading'), inblock = $('inblock');
  const secBtn = $('secBtn'), secTitle = $('secTitle'), pos = $('pos');
  const menu = $('menu'), menuList = $('menuList'), menuBlock = $('menuBlock'), backdrop = $('menuBackdrop');
  const pdfBtn = $('pdfBtn');
  const frames = {};          // id -> iframe
  const state = {};           // id -> { ready, current }
  let active = null;

  const api = id => { try { return frames[id] && frames[id].contentWindow && frames[id].contentWindow.SiteBlock || null; } catch (e) { return null; } };
  const focusFrame = () => { const f = frames[active]; if (f) { try { f.contentWindow.focus(); } catch (e) {} } };

  function parseHash() {
    const m = /^#\/([\w-]+)(?:\/(.+))?$/.exec(location.hash);
    if (m && BLOCKS[m[1]]) return { block: m[1], section: m[2] ? decodeURIComponent(m[2]) : null };
    return { block: 'intro', section: null };
  }
  function writeHash() {
    const cur = state[active] && state[active].current;
    const h = '#/' + active + (cur && cur.id ? '/' + encodeURIComponent(cur.id) : '');
    if (location.hash !== h) history.replaceState(null, '', h);
  }

  function ensureFrame(id, section) {
    if (frames[id]) return frames[id];
    const f = document.createElement('iframe');
    f.className = 'stage__frame';
    f.title = BLOCKS[id].title;
    f.setAttribute('allow', 'fullscreen; autoplay');
    f.setAttribute('allowfullscreen', '');
    f.dataset.block = id;
    f.dataset.pending = section || '';
    f.src = BLOCKS[id].src;
    f.hidden = true;
    stage.appendChild(f);
    frames[id] = f;
    state[id] = { ready: false, current: null };
    return f;
  }

  function open(id, section) {
    if (!BLOCKS[id]) return;
    closeMenu();
    const f = ensureFrame(id, section);
    active = id;
    for (const key of Object.keys(frames)) frames[key].hidden = key !== id;
    loading.hidden = state[id].ready;
    if (state[id].ready) {
      if (section) { const a = api(id); if (a) a.go(section); }
      try { f.contentWindow.dispatchEvent(new Event('resize')); } catch (e) {}
      focusFrame();
    } else if (section) {
      f.dataset.pending = section;
    }
    render();
    writeHash();
  }

  function render() {
    const cur = state[active] && state[active].current;
    document.title = BLOCKS[active].title + ' · лекция 17.11.2026';
    document.body.dataset.block = active;
    // Эмблема банка появляется в оформлении только там, где банк уже назван: в блоке 2 и в кейсе.
    // В блоке 2 её впервые показывает пропуск на титульном слайде, поэтому в панели она загорается со следующего слайда.
    const bank = active === 'case' || (active === 'practice' && !!cur && cur.index > 0);
    const brandImg = document.querySelector('.bar__brand img'), icon = document.getElementById('favicon');
    if (brandImg) brandImg.style.display = bank ? '' : 'none';
    if (icon) icon.href = bank ? 'assets/img/emblem.webp' : 'data:,';
    document.querySelectorAll('.tab').forEach(tab => {
      const on = (tab.dataset.open === active || ENTRY[tab.dataset.open] === active) && (!tab.dataset.section || !cur || cur.id === tab.dataset.section);
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-current', on ? 'page' : 'false');
    });
    pdfBtn.hidden = !BLOCKS[active].pdf;
    const a = state[active] && state[active].ready ? api(active) : null;
    const many = a && a.sections().length > 2;
    inblock.hidden = !many;
    if (many && cur) {
      secTitle.textContent = cur.title || 'Содержание';
      pos.textContent = (cur.index + 1) + ' / ' + cur.total;
    }
    // нижняя рейка: где мы и сколько пройдено в блоке
    const where = $('railWhere');
    where.textContent = '';
    const b = document.createElement('b'); b.textContent = BLOCKS[active].title; where.appendChild(b);
    if (cur) where.appendChild(document.createTextNode(' · ' + (cur.title || '') + (cur.total > 2 ? '  (' + (cur.index + 1) + ' из ' + cur.total + ')' : '')));
    $('railFill').style.width = cur && cur.total ? ((cur.index + 1) / cur.total * 100).toFixed(2) + '%' : '0';
    $('prevBtn').classList.toggle('is-end', ORDER.indexOf(active) === 0 && (!cur || cur.index === 0));
  }

  /* --- содержание блока --- */
  function openMenu() {
    const a = api(active); if (!a) return;
    const cur = a.current() || {};
    menuBlock.textContent = BLOCKS[active].title;
    menuList.textContent = '';
    let group = null, n = 0;
    for (const s of a.sections()) {
      if (s.group && s.group !== group) {
        group = s.group;
        const h = document.createElement('div'); h.className = 'menu__group'; h.textContent = group; menuList.appendChild(h);
      }
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'menu__item' + (s.id === cur.id ? ' is-current' : '');
      const no = document.createElement('span'); no.className = 'menu__no'; no.textContent = String(++n).padStart(2, '0');
      const t = document.createElement('span'); t.className = 'menu__text'; t.textContent = s.title;
      b.append(no, t);
      b.addEventListener('click', () => { closeMenu(); a.go(s.id); focusFrame(); });
      menuList.appendChild(b);
    }
    menu.hidden = false; backdrop.hidden = false; secBtn.setAttribute('aria-expanded', 'true');
    const curEl = menuList.querySelector('.is-current'); if (curEl) curEl.scrollIntoView({ block: 'center' });
  }
  function closeMenu() { menu.hidden = true; backdrop.hidden = true; secBtn.setAttribute('aria-expanded', 'false'); }

  // Сквозное листание: шаг → слайд → следующий блок. Одной кнопкой проходится вся лекция.
  function step(dir) {
    const a = api(active); if (!a) return;
    const moved = dir > 0 ? a.next() : a.prev();
    if (moved === false) {
      const target = ORDER[ORDER.indexOf(active) + dir];
      if (target) { open(target, null); return; }
    }
    focusFrame();
  }

  // Клавиши, когда фокус внутри блока: блок листает себя сам, но на своём крайнем слайде не умеет перейти в соседний блок.
  // Поэтому на первом и последнем слайде блока стрелки и пробел ведём через общий step(): шаг внутри слайда или переход в соседний блок.
  function hookKeys(id) {
    let doc; try { doc = frames[id].contentWindow.document; } catch (e) { return; }
    if (!doc || doc.__siteKeys) return;
    doc.__siteKeys = true;
    doc.addEventListener('keydown', event => {
      if (id !== active || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;
      const dir = ['ArrowRight', 'PageDown', ' '].includes(event.key) ? 1 : ['ArrowLeft', 'PageUp'].includes(event.key) ? -1 : 0;
      if (!dir || !ORDER[ORDER.indexOf(id) + dir]) return;
      const el = event.target && event.target.closest ? event.target : null;
      if (el && el.closest('input, textarea, select, [contenteditable="true"], [role="slider"]')) return;
      if (el && event.key === ' ' && el.closest('button, a, summary, [role="button"]')) return;
      // открытое окно внутри блока (записка, словарь, сравнение) — клавиши принадлежат ему
      const win = doc.defaultView;
      if ([...doc.querySelectorAll('[role="dialog"], dialog[open]')].some(d => !d.hidden && d.getClientRects().length && win.getComputedStyle(d).visibility !== 'hidden')) return;
      const a = api(id); if (!a) return;
      let list, cur; try { list = a.sections(); cur = a.current(); } catch (e) { return; }
      const index = list.findIndex(s => s.id === (cur && cur.id));
      if (index !== (dir > 0 ? list.length - 1 : 0)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      step(dir);
    }, true);
  }

  /* --- события --- */
  window.addEventListener('message', event => {
    if (event.origin !== location.origin) return;
    const d = event.data; if (!d || typeof d.type !== 'string' || !d.type.startsWith('siteblock:')) return;
    const id = Object.keys(frames).find(key => frames[key].contentWindow === event.source);
    if (d.type === 'siteblock:open') { open(d.section ? d.target : (ENTRY[d.target] || d.target), d.section || null); return; }
    if (!id) return;
    if (d.type === 'siteblock:ready') {
      state[id].ready = true;
      hookKeys(id);
      const a = api(id);
      const pending = frames[id].dataset.pending;
      if (a && pending) { a.go(pending); frames[id].dataset.pending = ''; }
      if (a) state[id].current = a.current();
      if (id === active) { loading.hidden = true; focusFrame(); render(); writeHash(); }
    } else if (d.type === 'siteblock:change') {
      state[id].current = d.current || (api(id) && api(id).current());
      if (id === active) { render(); writeHash(); }
    }
  });

  document.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => open(el.dataset.section ? el.dataset.open : (ENTRY[el.dataset.open] || el.dataset.open), el.dataset.section || null)));
  secBtn.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
  $('menuClose').addEventListener('click', () => { closeMenu(); focusFrame(); });
  backdrop.addEventListener('click', () => { closeMenu(); focusFrame(); });
  $('prevBtn').addEventListener('click', () => step(-1));
  $('nextBtn').addEventListener('click', () => step(1));
  pdfBtn.addEventListener('click', () => setTimeout(focusFrame, 50));
  $('fsBtn').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    focusFrame();
  });
  document.addEventListener('fullscreenchange', () => document.body.classList.toggle('is-fullscreen', !!document.fullscreenElement));

  // Клавиши, когда фокус на панели, а не во фрейме.
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape' && !menu.hidden) { closeMenu(); focusFrame(); event.preventDefault(); return; }
    if (!menu.hidden) return;
    const tag = event.target && event.target.tagName;
    if (['ArrowRight', 'PageDown'].includes(event.key) || (event.key === ' ' && tag !== 'BUTTON' && tag !== 'A')) { step(1); event.preventDefault(); }
    else if (['ArrowLeft', 'PageUp'].includes(event.key)) { step(-1); event.preventDefault(); }
  });

  window.addEventListener('hashchange', () => {
    const h = parseHash();
    const cur = state[h.block] && state[h.block].current;
    if (h.block !== active || (h.section && (!cur || cur.id !== h.section))) open(h.block, h.section);
  });

  window.SiteShell = { open, blocks: BLOCKS, get active() { return active; } };
  const start = parseHash();
  open(start.block, start.section);
})();
