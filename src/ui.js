import { SYSTEMS, LEVELS, TIERS } from './systems.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initUI(api) {
  const input = $('search-input');
  const results = $('search-results');
  const info = $('info');
  const hoverEl = $('hover');
  const tiersEl = $('tiers');
  const barLine = $('bar-line');
  const barText = $('bar-text');
  let resultItems = [];
  let active = -1;

  // ----- systems -----
  function renderSystems() {
    const counts = {};
    for (const s of api.structures.values()) counts[s.system] = (counts[s.system] ?? 0) + 1;
    $('system-list').innerHTML = Object.entries(SYSTEMS).map(([key, sys]) => `
      <li>
        <label class="system">
          <input type="checkbox" data-system="${key}" ${api.systems[key] ? 'checked' : ''} />
          <span class="swatch" style="--c:${sys.color}"></span>
          <span class="system-name">${sys.label}</span>
          <span class="system-count">${counts[key] ?? 0}</span>
        </label>
      </li>`).join('');
    $('system-list').querySelectorAll('input').forEach((cb) =>
      cb.addEventListener('change', () => api.setSystem(cb.dataset.system, cb.checked)));
  }

  // ----- search -----
  function renderResults() {
    const q = input.value;
    resultItems = api.search(q);
    active = resultItems.length ? 0 : -1;
    input.setAttribute('aria-expanded', String(!!q.trim()));
    if (!q.trim()) { results.hidden = true; return; }
    results.hidden = false;
    if (!resultItems.length) {
      results.innerHTML = `<li class="empty">No structure named “${esc(q.trim())}” in this model set. Try a broader word, like “rib” or “lobe”.</li>`;
      return;
    }
    results.innerHTML = resultItems.map((s, i) => `
      <li role="option" id="opt-${i}" data-i="${i}" aria-selected="${i === active}">
        <span class="swatch" style="--c:${SYSTEMS[s.system].color}"></span>
        <span class="r-name">${highlight(s.name, q)}</span>
        <span class="r-meta">${SYSTEMS[s.system].label}</span>
      </li>`).join('');
    input.setAttribute('aria-activedescendant', 'opt-0');
  }

  function setActive(i) {
    active = (i + resultItems.length) % resultItems.length;
    results.querySelectorAll('[role=option]').forEach((li, j) => li.setAttribute('aria-selected', String(j === active)));
    input.setAttribute('aria-activedescendant', `opt-${active}`);
  }

  function choose(i) {
    const s = resultItems[i];
    if (!s) return;
    api.select(s, { fly: true });
    input.value = '';
    renderResults();
    input.blur();
  }

  input.addEventListener('input', renderResults);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && resultItems.length) { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp' && resultItems.length) { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { input.value = ''; renderResults(); input.blur(); }
  });
  results.addEventListener('pointerdown', (e) => {
    const li = e.target.closest('[data-i]');
    if (li) { e.preventDefault(); choose(+li.dataset.i); }
  });
  input.addEventListener('blur', () => setTimeout(() => { results.hidden = true; }, 120));
  input.addEventListener('focus', () => { if (input.value.trim()) results.hidden = false; });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea') || api.state.quiz) return;
    if (e.key === '/') { e.preventDefault(); input.focus(); }
    else if (e.key === 'Escape') api.select(null);
    else if (e.key.toLowerCase() === 'f') api.frame();
  });

  // ----- info panel -----
  function showInfo(s) {
    const hidden = api.hiddenCount();
    if (!s) {
      info.innerHTML = `
        <p class="hint">Click a structure, or search for one, to see what it is and where it sits.
        Zoom in to reveal finer parts and their names.</p>
        ${hidden ? `<button type="button" class="link-btn" data-act="show-all">Show ${hidden} hidden structure${hidden > 1 ? 's' : ''}</button>` : ''}`;
    } else {
      const sys = SYSTEMS[s.system];
      const [x, y, z] = s.size.map((v) => (v * 100).toFixed(1));
      info.innerHTML = `
        <h2 class="sel-name">${esc(s.name)}</h2>
        <dl class="facts">
          <div><dt>System</dt><dd><span class="swatch" style="--c:${sys.color}"></span>${sys.label}</dd></div>
          <div><dt>Scale</dt><dd>${LEVELS[s.level]}</dd></div>
          ${s.partOf ? `<div><dt>Part of</dt><dd>${esc(s.partOf)}</dd></div>` : ''}
          <div><dt>Side</dt><dd>${s.side}</dd></div>
          <div><dt>Extent</dt><dd class="num">${x} × ${y} × ${z} cm <span class="muted">(width × height × depth)</span></dd></div>
          <div><dt>FMA ID</dt><dd class="num">${esc(s.id.replace(/nsn$/, ''))}</dd></div>
        </dl>
        <div class="actions">
          <button type="button" data-act="frame">Frame</button>
          <button type="button" data-act="isolate" aria-pressed="${api.state.isolated}">${api.state.isolated ? 'Show surroundings' : 'Isolate'}</button>
          <button type="button" data-act="hide">Hide</button>
        </div>
        ${hidden ? `<button type="button" class="link-btn" data-act="show-all">Show ${hidden} hidden structure${hidden > 1 ? 's' : ''}</button>` : ''}`;
    }
  }
  info.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'frame') api.frame();
    else if (act === 'isolate') api.isolate();
    else if (act === 'hide') api.hide();
    else if (act === 'show-all') api.showAll();
  });

  // ----- hover tooltip -----
  function hover(s, x, y) {
    if (!s || s === api.state.selected || api.state.quizHideNames) { hoverEl.hidden = true; return; }
    const r = $('stage').getBoundingClientRect();
    hoverEl.hidden = false;
    hoverEl.textContent = s.name;
    hoverEl.style.transform = `translate(${x - r.left + 14}px, ${y - r.top + 16}px)`;
  }

  // ----- scale widget -----
  tiersEl.innerHTML = TIERS.map((t, i) => `<li data-i="${i}">${t.name}</li>`).join('');
  const NICE = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1];
  let lastTier = -1;
  let lastBar = '';
  function updateScale(viewH, pxPerM, tier) {
    if (tier !== lastTier) {
      lastTier = tier;
      tiersEl.querySelectorAll('li').forEach((li, i) => li.classList.toggle('is-current', i === tier));
    }
    const len = NICE.find((m) => m * pxPerM >= 64) ?? 1;
    const px = Math.round(len * pxPerM);
    const text = len >= 1 ? `${len} m` : len >= 0.01 ? `${Math.round(len * 100)} cm` : `${Math.round(len * 1000)} mm`;
    const key = `${px}|${text}`;
    if (key !== lastBar) {
      lastBar = key;
      barLine.style.width = `${px}px`;
      barText.textContent = text;
    }
  }

  function syncSystems() {
    document.querySelectorAll('[data-system]').forEach((cb) => { cb.checked = api.systems[cb.dataset.system]; });
  }

  return {
    ready() {
      $('count').textContent = `${api.structures.size} structures, real scan-based models`;
      renderSystems();
      showInfo(null);
    },
    showInfo,
    hover,
    updateScale,
    syncSystems,
    syncHidden() { showInfo(api.state.selected); },
  };
}

function highlight(name, q) {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let out = esc(name);
  for (const w of words) {
    const re = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
    out = out.replace(re, '<mark>$1</mark>');
  }
  return out;
}
