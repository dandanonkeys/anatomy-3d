import { CELL_TYPES } from './systems.js';

const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KIND_LABEL = { landmark: 'Bone landmark', joint: 'Joint', region: 'Bone region', suture: 'Suture' };

export function initUI(api) {
  const input = $('search-input');
  const results = $('search-results');
  const info = $('info');
  const hoverEl = $('hover');
  const tiersEl = $('tiers');
  const barLine = $('bar-line');
  const barText = $('bar-text');
  const tabs = document.querySelectorAll('[data-world]');
  let resultItems = [];
  let active = -1;

  const sysDef = (s) => api.systemDefs[s.system] ?? { label: s.system, color: '#999' };
  const metaLabel = (s) => (s.members ? 'Group' : s.kind ? `${KIND_LABEL[s.kind]}, approx.` : sysDef(s).label);

  // ----- world tabs -----
  tabs.forEach((t) => t.addEventListener('click', () => api.setWorld(t.dataset.world)));
  function setWorld(w) {
    tabs.forEach((t) => {
      const on = t.dataset.world === w.id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    document.body.dataset.world = w.id;
    $('systems-h').textContent = w.radio ? 'Cell types' : 'Systems';
    input.placeholder = w.radio ? 'Find a cell part, e.g. mitochondria' : 'Find a structure, e.g. femur';
    input.value = '';
    renderResults();
    renderSystems();
    renderTiers();
    showInfo(null);
    refreshCounts();
  }

  // ----- systems / cell types -----
  function renderSystems() {
    const w = api.worldDef;
    const counts = {};
    for (const s of api.structures.values()) if (!s.kind && !s.members) counts[s.system] = (counts[s.system] ?? 0) + 1;
    $('system-list').innerHTML = Object.entries(api.systemDefs).map(([key, sys]) => `
      <li>
        <label class="system">
          <input type="${w.radio ? 'radio' : 'checkbox'}" name="sys" data-system="${key}" ${api.systems[key] ? 'checked' : ''} />
          <span class="swatch" style="--c:${sys.color}"></span>
          <span class="system-name">${sys.label}</span>
          <span class="system-count">${counts[key] ?? ''}</span>
        </label>
      </li>`).join('');
    $('system-list').querySelectorAll('input').forEach((cb) =>
      cb.addEventListener('change', () => api.setSystem(cb.dataset.system, cb.checked)));
  }

  function refreshCounts() {
    const w = api.worldDef;
    let n = 0, lm = 0;
    for (const s of api.structures.values()) { if (s.kind) lm++; else if (!s.members) n++; }
    $('count').textContent = w.radio
      ? `${Object.keys(CELL_TYPES).length} cell types, ${n} labelled parts. Schematic models.`
      : `${n.toLocaleString()} structures${lm ? `, ${lm} bone landmarks and joints` : ''}`;
    if (!w.radio) {
      const counts = {};
      for (const s of api.structures.values()) if (!s.kind && !s.members) counts[s.system] = (counts[s.system] ?? 0) + 1;
      document.querySelectorAll('.system-count').forEach((el) => {
        const key = el.parentElement.querySelector('input').dataset.system;
        el.textContent = counts[key] ?? '';
      });
    }
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
      results.innerHTML = `<li class="empty">Nothing named “${esc(q.trim())}” here. Try a broader word${api.worldDef.radio ? ', or switch to the Body tab' : ', like “rib” or “lobe”, or check the Cells tab'}.</li>`;
      return;
    }
    results.innerHTML = resultItems.map((s, i) => `
      <li role="option" id="opt-${i}" data-i="${i}" aria-selected="${i === active}">
        <span class="swatch${s.kind ? ' is-ring' : ''}" style="--c:${sysDef(s).color}"></span>
        <span class="r-name">${highlight(s.name, q)}</span>
        <span class="r-meta">${metaLabel(s)}</span>
      </li>`).join('');
    input.setAttribute('aria-activedescendant', 'opt-0');
  }

  function setActive(i) {
    active = (i + resultItems.length) % resultItems.length;
    results.querySelectorAll('[role=option]').forEach((li, j) => li.setAttribute('aria-selected', String(j === active)));
    input.setAttribute('aria-activedescendant', `opt-${active}`);
  }

  async function choose(i) {
    const s = resultItems[i];
    if (!s) return;
    input.value = '';
    renderResults();
    input.blur();
    await api.ensureLoaded(s);
    api.select(s, { fly: true });
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
    if (e.target.matches('input, textarea, select') || api.state.quiz) return;
    if (e.key === '/') { e.preventDefault(); input.focus(); }
    else if (e.key === 'Escape') api.select(null);
    else if (e.key.toLowerCase() === 'f') api.frame();
    else if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) api.setWorld(api.world === 'body' ? 'cells' : 'body');
  });

  // ----- info panel -----
  function extent(s) {
    if (!s.size || !s.size.some((v) => v > 0)) return '';
    const m = api.worldDef.unitM;
    const um = m < 1e-3;
    const f = (v) => (um ? (v * m * 1e6).toFixed(v * m * 1e6 < 10 ? 1 : 0) : (v * 100).toFixed(1));
    return `<div><dt>Extent</dt><dd class="num">${s.size.map(f).join(' × ')} ${um ? 'µm' : 'cm'} <span class="muted">(width × height × depth)</span></dd></div>`;
  }

  function definition(s) {
    const d = api.details(s);
    if (s.desc) return `<p class="desc">${esc(s.desc)}</p>`;
    if (!d?.def) return '';
    const text = d.def.replace(/\s*https?:\/\/\S+\s*$/, '');
    const url = d.def.match(/https?:\/\/\S+\s*$/)?.[0]?.trim();
    const short = text.length > 520 ? `${text.slice(0, 500).replace(/\s+\S*$/, '')}…` : text;
    return `<p class="desc">${esc(short)}</p><p class="src">From Wikipedia via Z-Anatomy${url ? `, <a href="${esc(url)}" target="_blank" rel="noopener">source</a>` : ''} (CC BY-SA).</p>`;
  }

  function oianBlock(s) {
    const e = api.oianFor(s);
    if (!e) return '';
    const row = (k, v) => (v ? `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>` : '');
    return `
      <section class="oian" aria-label="Course OIAN">
        <h3>From your course OIAN table${e.muscle && stripCase(e.muscle) !== stripCase(s.name) ? `: ${esc(e.muscle)}` : ''}</h3>
        <dl class="facts">${row('Origin', e.origin)}${row('Insertion', e.insertion)}${row('Action', e.action)}${row('Nerve', e.innervation)}</dl>
      </section>`;
  }

  function showInfo(s) {
    const hidden = api.hiddenCount();
    const showAll = hidden ? `<button type="button" class="link-btn" data-act="show-all">Show ${hidden} hidden structure${hidden > 1 ? 's' : ''}</button>` : '';
    if (!s) {
      info.innerHTML = api.worldDef.radio
        ? `<p class="hint">Pick a cell type, then click a part or search for it. Zoom in to reveal organelles and the structures inside them.</p>
           <p class="hint schematic-note">These cells are schematic: shapes and sizes follow textbook descriptions, not microscope data.</p>${showAll}`
        : `<p class="hint">Click a structure, or search for one, to see what it is and where it sits. Zoom in to reveal finer parts and their names.</p>${showAll}`;
      return;
    }
    const sys = sysDef(s);
    const lv = api.levels[s.level];
    const cell = api.cellFor(s);
    const isPoint = !!s.kind && !s.members;
    const marks = !isPoint && s.mesh ? api.landmarksOf(s) : [];
    const lat = api.details(s)?.latin;
    info.innerHTML = `
      <h2 class="sel-name">${esc(s.name)}</h2>
      ${s.schematic ? '<p class="tag">Schematic model</p>' : ''}
      ${isPoint ? '<p class="tag">Approximate position, placed by rule on the bone</p>' : ''}
      <dl class="facts">
        ${lat ? `<div><dt>Latin</dt><dd><i>${esc(lat)}</i></dd></div>` : ''}
        <div><dt>${api.worldDef.radio ? 'Cell' : 'System'}</dt><dd><span class="swatch" style="--c:${sys.color}"></span>${sys.label}</dd></div>
        ${s.members ? `<div><dt>Group</dt><dd>${s.members.length} structures, both sides</dd></div>` : ''}
        ${isPoint ? `<div><dt>Type</dt><dd>${KIND_LABEL[s.kind]}</dd></div>` : `<div><dt>Scale</dt><dd>${lv ?? ''}</dd></div>`}
        ${s.partOf ? `<div><dt>${isPoint ? 'On' : 'Part of'}</dt><dd>${s.bone ? `<button type="button" class="inline-link" data-act="bone">${esc(s.partOf)}</button>` : esc(s.partOf)}</dd></div>` : ''}
        ${s.side && !api.worldDef.radio ? `<div><dt>Side</dt><dd>${s.side}</dd></div>` : ''}
        ${s.count ? `<div><dt>Count</dt><dd>${s.count} in this model</dd></div>` : ''}
        ${s.each ? `<div><dt>Size</dt><dd>Each ${esc(s.each)}</dd></div>` : isPoint ? '' : extent(s)}
        ${s.fma ? `<div><dt>Source</dt><dd>BodyParts3D, FMA ID ${esc(s.fma.replace(/nsn$/, ''))}</dd></div>` : s.source === 'Z-Anatomy' ? '<div><dt>Source</dt><dd>Z-Anatomy</dd></div>' : ''}
      </dl>
      ${definition(s)}
      ${oianBlock(s)}
      ${s.members ? `<details class="members"><summary>Members</summary><p>${s.members.map((m) => esc(m.name)).join(', ')}</p></details>` : ''}
      ${marks.length ? `<div class="marks"><h3>Landmarks on this bone <span class="muted">(approximate)</span></h3><div class="chips">${marks.map((m) => `<button type="button" class="chip" data-mark="${esc(m.id)}">${esc(m.name.replace(/\s*\(.*\)$/, ''))}</button>`).join('')}</div></div>` : ''}
      <div class="actions">
        <button type="button" data-act="frame">Frame</button>
        ${isPoint ? '' : `<button type="button" data-act="isolate" aria-pressed="${api.state.isolated}">${api.state.isolated ? 'Show surroundings' : 'Isolate'}</button>
        <button type="button" data-act="hide">Hide</button>`}
        ${cell ? `<button type="button" class="q-primary" data-act="cells" data-cell="${cell}">View cells: ${esc(CELL_TYPES[cell].label)}</button>` : ''}
      </div>
      ${showAll}`;
  }

  info.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act], [data-mark]');
    if (!el) return;
    const act = el.dataset.act;
    if (el.dataset.mark) api.select(api.structures.get(el.dataset.mark), { fly: true });
    else if (act === 'frame') api.frame();
    else if (act === 'isolate') api.isolate();
    else if (act === 'hide') api.hide();
    else if (act === 'show-all') api.showAll();
    else if (act === 'bone') api.select(api.state.selected.bone, { fly: true });
    else if (act === 'cells') api.viewCells(el.dataset.cell);
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
  function renderTiers() {
    tiersEl.innerHTML = api.tiers.map((t, i) => `<li data-i="${i}">${t.name}</li>`).join('');
    lastTier = -1;
  }
  const NICE = [];
  for (let e = -7; e <= 0; e++) for (const m of [1, 2, 5]) NICE.push(m * 10 ** e);
  let lastTier = -1;
  let lastBar = '';
  function updateScale(viewH, pxPerM, tier) {
    if (tier !== lastTier) {
      lastTier = tier;
      tiersEl.querySelectorAll('li').forEach((li, i) => li.classList.toggle('is-current', i === tier));
    }
    const len = NICE.find((m) => m * pxPerM >= 64) ?? 1;
    const px = Math.round(len * pxPerM);
    const text = len >= 1 ? `${len} m` : len >= 0.01 ? `${Math.round(len * 100)} cm` : len >= 1e-3 ? `${Math.round(len * 1000)} mm`
      : len >= 1e-6 ? `${+(len * 1e6).toPrecision(2)} µm` : `${Math.round(len * 1e9)} nm`;
    const key = `${px}|${text}`;
    if (key !== lastBar) {
      lastBar = key;
      barLine.style.width = `${px}px`;
      barText.textContent = text;
    }
  }

  function syncSystems() {
    document.querySelectorAll('[data-system]').forEach((cb) => { cb.checked = !!api.systems[cb.dataset.system]; });
  }

  renderTiers();
  return {
    ready() { renderSystems(); refreshCounts(); showInfo(null); },
    setWorld,
    refreshCounts,
    refreshInfo() { showInfo(api.state.selected); },
    showInfo,
    hover,
    updateScale,
    syncSystems,
    syncHidden() { showInfo(api.state.selected); },
  };
}

const stripCase = (s) => s.toLowerCase().replace(/^(left|right)\s+/, '').replace(/[^a-z]/g, '');

function highlight(name, q) {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let out = esc(name);
  for (const w of words) {
    const re = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
    out = out.replace(re, '<mark>$1</mark>');
  }
  return out;
}
