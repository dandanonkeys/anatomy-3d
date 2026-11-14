import { CONCEPTS, GROUPS } from './concepts.js';
import { createPlayer, ARROW_COLORS } from './engine.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const SPEEDS = [0.5, 1, 2];
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

const els = {
  list: $('#concept-list'), search: $('#search-input'), notes: $('#notes'), caption: $('#caption'),
  scene: $('#scene'), table: $('#table-view'), legend: $('#legend'), controls: $('#controls'), dots: $('#dots'),
  play: $('[data-act=play]'), speed: $('[data-act=speed]'), prev: $('[data-act=prev]'), next: $('[data-act=next]'),
};

let current = null;
let status = { index: 0, count: 1, playing: false, speed: 1 };

const player = createPlayer(els.scene, { onChange: (s) => { status = s; syncStep(); } });

/* ---------------- menu ---------------- */

function buildMenu() {
  els.list.innerHTML = GROUPS.map((g) => {
    const items = CONCEPTS.filter((c) => c.group === g).map((c) => {
      const steps = c.mech ? c.mech.states.length : 0;
      const meta = c.table ? 'table' : steps > 1 ? `${steps} steps` : 'diagram';
      return `<li><button type="button" class="concept" data-id="${c.id}"><span class="c-name">${esc(c.name)}</span><span class="c-meta">${meta}</span></button></li>`;
    }).join('');
    return `<section class="group" data-group="${esc(g)}"><h2>${esc(g)}</h2><ul>${items}</ul></section>`;
  }).join('') + '<p class="empty muted" hidden>No concept matches.</p>';
}

function filterMenu(q) {
  const needle = q.trim().toLowerCase();
  let any = false;
  for (const sec of els.list.querySelectorAll('.group')) {
    let shown = 0;
    for (const btn of sec.querySelectorAll('.concept')) {
      const c = CONCEPTS.find((x) => x.id === btn.dataset.id);
      const hay = `${c.name} ${c.summary} ${c.group}`.toLowerCase();
      const ok = !needle || hay.includes(needle);
      btn.parentElement.hidden = !ok;
      if (ok) shown++;
    }
    sec.hidden = shown === 0;
    if (shown) any = true;
  }
  els.list.querySelector('.empty').hidden = any;
}

/* ---------------- selection ---------------- */

function select(id, { focusStage = false } = {}) {
  const c = CONCEPTS.find((x) => x.id === id) || CONCEPTS[0];
  current = c;
  for (const b of els.list.querySelectorAll('.concept')) {
    if (b.dataset.id === c.id) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  }
  store.set('orgo:last', c.id);
  if (location.hash.slice(1) !== c.id) history.replaceState(null, '', `#${c.id}`);
  document.title = `${c.name} · Orgo Mechanisms`;

  const isTable = !!c.table;
  els.scene.hidden = isTable;
  els.legend.hidden = isTable;
  els.controls.hidden = isTable;
  els.table.hidden = !isTable;
  renderNotes(c);
  if (isTable) {
    renderTable(c.table);
    els.caption.innerHTML = `<p class="cap-title">${esc(c.name)}</p><p class="cap-text">Compare the four pathways side by side.</p>`;
  } else {
    player.load(c.mech);
  }
  if (focusStage) els.play.focus();
}

function renderTable(t) {
  const head = t.cols.map((h, i) => (i ? `<th scope="col">${esc(h)}</th>` : '<td></td>')).join('');
  const body = t.rows.map((r) => `<tr>${r.map((v, i) => (i ? `<td>${esc(v)}</td>` : `<th scope="row">${esc(v)}</th>`)).join('')}</tr>`).join('');
  els.table.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderNotes(c) {
  let html = `<h2 class="sel-name">${esc(c.name)}</h2><p class="group-tag">${esc(c.group)}</p>`;
  html += `<p class="summary">${esc(c.summary)}</p>`;
  html += `<h3>Key points</h3><ul class="points">${c.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`;
  if (c.watch) html += `<div class="watch"><h3>Watch out</h3><p>${esc(c.watch)}</p></div>`;
  if (c.mech) {
    const states = c.mech.states;
    html += `<h3>${states.length > 1 ? 'Steps' : 'Diagram'}</h3><ol class="steps">`;
    states.forEach((s, i) => {
      const arrows = (s.arrows || []).map((a, n) => {
        const color = ARROW_COLORS[n % ARROW_COLORS.length];
        const kind = a.kind === 'fish' ? '<span class="kind">1 e⁻</span>' : '';
        return `<li class="arrow-row" data-step="${i}" data-n="${n}" tabindex="0"><span class="n" style="--c:${color}">${n + 1}</span><span>${esc(a.why)}${kind}</span></li>`;
      }).join('');
      html += `<li class="step" data-step="${i}"><button type="button" class="step-head" data-step="${i}"><span class="step-num">${i + 1}</span><span class="step-title">${esc(s.title)}</span></button>`;
      html += `<p class="step-text">${esc(s.text)}</p>${arrows ? `<ol class="arrow-list">${arrows}</ol>` : ''}</li>`;
    });
    html += '</ol>';
  }
  html += '<p class="q-keys muted"><kbd>←</kbd> <kbd>→</kbd> step · <kbd>Space</kbd> play · <kbd>R</kbd> replay arrows · <kbd>/</kbd> search</p>';
  els.notes.innerHTML = html;
  els.notes.scrollTop = 0;
}

/* ---------------- step sync ---------------- */

function syncStep() {
  if (!current?.mech) return;
  const s = current.mech.states[status.index];
  const multi = status.count > 1;
  els.caption.innerHTML = `${multi ? `<p class="cap-step">Step ${status.index + 1} of ${status.count}</p>` : ''}<p class="cap-title">${esc(s.title)}</p><p class="cap-text">${esc(s.text)}</p>`;

  els.dots.innerHTML = Array.from({ length: status.count }, (_, i) =>
    `<li><button type="button" data-step="${i}" aria-label="Step ${i + 1}"${i === status.index ? ' aria-current="step"' : ''}${i < status.index ? ' class="done"' : ''}></button></li>`).join('');

  const atEnd = status.index >= status.count - 1;
  els.play.setAttribute('aria-pressed', String(status.playing));
  els.play.setAttribute('aria-label', status.playing ? 'Pause' : atEnd && multi ? 'Replay from start' : 'Play');
  els.play.querySelector('.play-label').textContent = status.playing ? 'Pause' : atEnd && multi ? 'Replay' : 'Play';
  els.play.disabled = !multi;
  els.prev.disabled = status.index === 0;
  els.next.disabled = atEnd && status.phase === 'idle';
  els.speed.textContent = `${status.speed}×`;

  for (const li of els.notes.querySelectorAll('.step')) {
    const i = +li.dataset.step;
    li.classList.toggle('is-current', i === status.index);
    li.classList.toggle('is-done', i < status.index);
  }
  const cur = els.notes.querySelector('.step.is-current');
  if (cur && status.playing) cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ---------------- events ---------------- */

els.list.addEventListener('click', (e) => {
  const b = e.target.closest('.concept');
  if (b) select(b.dataset.id);
});

els.search.addEventListener('input', () => filterMenu(els.search.value));
els.search.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const first = [...els.list.querySelectorAll('.concept')].find((b) => !b.parentElement.hidden);
    if (first) { select(first.dataset.id); els.search.blur(); }
  } else if (e.key === 'Escape') {
    els.search.value = ''; filterMenu(''); els.search.blur();
  }
});

els.controls.addEventListener('click', (e) => {
  const dot = e.target.closest('#dots button');
  if (dot) { player.goTo(+dot.dataset.step); return; }
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'play') player.toggle();
  else if (act === 'next') player.next();
  else if (act === 'prev') player.prev();
  else if (act === 'replay') player.replay();
  else if (act === 'restart') player.restart();
  else if (act === 'speed') player.setSpeed(SPEEDS[(SPEEDS.indexOf(status.speed) + 1) % SPEEDS.length]);
});

els.notes.addEventListener('click', (e) => {
  const h = e.target.closest('.step-head');
  if (h) player.goTo(+h.dataset.step);
});
// Hover/focus an arrow's explanation → spotlight that arrow on the stage.
const spot = (e) => {
  const row = e.target.closest('.arrow-row');
  if (row && +row.dataset.step === status.index) player.focus(+row.dataset.n);
  else player.focus(null);
};
els.notes.addEventListener('mouseover', spot);
els.notes.addEventListener('focusin', spot);
els.notes.addEventListener('mouseleave', () => player.focus(null));
els.notes.addEventListener('focusout', () => player.focus(null));

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '/') { e.preventDefault(); els.search.focus(); els.search.select(); return; }
  if (!current?.mech) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); player.next(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); player.prev(); }
  else if (e.key === ' ' && !e.target.matches('button')) { e.preventDefault(); player.toggle(); }
  else if (e.key === 'r' || e.key === 'R') player.replay();
  else if (e.key === 'Home') player.restart();
});

window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (id && id !== current?.id) select(id);
});

buildMenu();
select(location.hash.slice(1) || store.get('orgo:last') || CONCEPTS[0].id);
