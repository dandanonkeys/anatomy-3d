import { CONCEPTS, GROUPS } from './concepts.js';
import { createPlayer, ARROW_COLORS } from './engine.js';
import { VERIFIED } from './verified.js';
import { createQuizUI } from './quiz-ui.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const SPEEDS = [0.5, 1, 2];
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

// Your own check of each concept against your notes, kept in this browser:
// { [id]: { ok: 'YYYY-MM-DD' | undefined, notes: [{ where, text, at }] } }
const REVIEW_KEY = 'orgo:review';
let review = (() => { try { return JSON.parse(store.get(REVIEW_KEY) || '{}') || {}; } catch { return {}; } })();
const saveReview = () => store.set(REVIEW_KEY, JSON.stringify(review));
const today = () => new Date().toLocaleDateString('sv-SE'); // local YYYY-MM-DD

const TRUST = {
  verified: { mark: '✓', label: 'Verified against notes' },
  checked: { mark: '✓', label: 'Checked by you' },
  flagged: { mark: '⚑', label: 'Flagged' },
  unverified: { mark: '', label: 'Unverified' },
};
function trust(c) {
  const r = review[c.id];
  if (r?.notes?.length) return 'flagged';
  if (VERIFIED[c.id]) return 'verified';
  if (r?.ok) return 'checked';
  return 'unverified';
}

const els = {
  report: $('#report'),
  list: $('#concept-list'), search: $('#search-input'), notes: $('#notes'), caption: $('#caption'),
  scene: $('#scene'), table: $('#table-view'), legend: $('#legend'), controls: $('#controls'), dots: $('#dots'),
  play: $('[data-act=play]'), speed: $('[data-act=speed]'), prev: $('[data-act=prev]'), next: $('[data-act=next]'),
  app: $('#app'), bar: $('#quiz-bar'), modes: $('.mode-switch'),
};

let current = null;
let status = { index: 0, count: 1, playing: false, speed: 1 };
let mode = 'learn';

const player = createPlayer(els.scene, {
  onChange: (s) => { status = s; if (mode === 'quiz') quiz.sync(s); else syncStep(); },
});

const quiz = createQuizUI({
  player, svg: els.scene, caption: els.caption, panel: els.notes, bar: els.bar, concepts: CONCEPTS, trust,
  addFlag: (id, where, text) => updateReview((r) => { r.notes.push({ where: `Quiz · ${where}`, text, at: today() }); r.ok = undefined; }, id),
  showScene: (on) => {
    els.scene.hidden = !on; els.legend.hidden = !on;
    els.table.hidden = true; els.controls.hidden = true;
  },
});

function setMode(m) {
  if (m === mode) return;
  if (mode === 'quiz' && quiz.running && !confirm('Leave the quiz? This session will be discarded.')) return false;
  mode = m;
  els.app.classList.toggle('quiz-on', m === 'quiz');
  for (const b of els.modes.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
  if (m === 'quiz') { player.toggle && status.playing && player.toggle(); quiz.open(); }
  else { quiz.close(); select(current?.id || CONCEPTS[0].id); }
  return true;
}

/* ---------------- menu ---------------- */

function buildMenu() {
  els.list.innerHTML = GROUPS.map((g) => {
    const items = CONCEPTS.filter((c) => c.group === g).map((c) => {
      const steps = c.mech ? c.mech.states.length : 0;
      const meta = c.table ? 'table' : steps > 1 ? `${steps} steps` : 'diagram';
      return `<li><button type="button" class="concept" data-id="${c.id}"><span class="c-name">${esc(c.name)}</span><span class="c-mark" aria-hidden="true"></span><span class="c-meta">${meta}</span></button></li>`;
    }).join('');
    return `<section class="group" data-group="${esc(g)}"><h2>${esc(g)}</h2><ul>${items}</ul></section>`;
  }).join('') + '<p class="empty muted" hidden>No concept matches.</p>';
  refreshTrust();
}

// Menu marks + the progress line in the menu footer.
function refreshTrust() {
  for (const b of els.list.querySelectorAll('.concept')) {
    const t = trust(CONCEPTS.find((x) => x.id === b.dataset.id));
    const mark = b.querySelector('.c-mark');
    mark.textContent = TRUST[t].mark;
    mark.className = `c-mark is-${t}`;
    b.title = TRUST[t].label;
  }
  const count = (t) => CONCEPTS.filter((c) => trust(c) === t).length;
  const touched = Object.values(review).some((r) => r.ok || r.notes?.length);
  els.report.innerHTML = `<h2>Notes check</h2>
    <p class="report-line"><span class="is-verified">${count('verified')} verified</span> · <span class="is-checked">${count('checked')} checked</span> · <span class="is-flagged">${count('flagged')} flagged</span> · ${count('unverified')} to go</p>
    <button type="button" data-review="copy"${touched ? '' : ' disabled'}>Copy review report</button>
    <p class="copy-status muted" aria-live="polite"></p>`;
}

function reportText() {
  const lines = [`# Orgo Mechanisms review (${today()})`, ''];
  const ok = CONCEPTS.filter((c) => review[c.id]?.ok && !review[c.id]?.notes?.length);
  const bad = CONCEPTS.filter((c) => review[c.id]?.notes?.length);
  lines.push('## Matches my notes', ...(ok.length ? ok.map((c) => `- ${c.id} (${c.name}): ${review[c.id].ok}`) : ['- none']), '');
  lines.push('## Something is wrong');
  if (!bad.length) lines.push('- none');
  for (const c of bad) {
    lines.push(`### ${c.id} (${c.name})`);
    for (const n of review[c.id].notes) lines.push(`- ${n.where}: ${n.text}`);
  }
  return lines.join('\n');
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
    els.caption.innerHTML = `<p class="cap-title">${esc(c.name)}</p><p class="cap-text">${esc(c.tableCaption || 'Compare the four pathways side by side.')}</p>`;
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
  let html = `<h2 class="sel-name">${esc(c.name)}</h2><p class="group-tag">${esc(c.group)}</p><div id="review" class="review"></div>`;
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
  renderReview(c);
}

function renderReview(c) {
  const box = els.notes.querySelector('#review');
  if (!box) return;
  const t = trust(c), r = review[c.id] || {};
  const help = {
    verified: `Checked against the course notes on ${VERIFIED[c.id]}.`,
    checked: `You marked this as matching your notes on ${r.ok}. Copy the review report to make it official.`,
    flagged: 'You noted a difference from your notes. Copy the review report so it gets fixed.',
    unverified: 'AI-written and not yet checked against your notes. Trust it less until you do.',
  }[t];
  const notes = (r.notes || []).map((n, i) =>
    `<li><span><b>${esc(n.where)}:</b> ${esc(n.text)}</span><button type="button" class="note-del" data-review="del" data-i="${i}" aria-label="Delete this note">×</button></li>`).join('');
  box.innerHTML = `<div class="trust is-${t}"><span class="trust-badge">${TRUST[t].mark ? `${TRUST[t].mark} ` : ''}${TRUST[t].label}</span><p>${esc(help)}</p></div>
    <div class="review-actions">
      <button type="button" data-review="ok" aria-pressed="${!!r.ok}">✓ Matches my notes</button>
      <button type="button" data-review="flag">⚑ Something's wrong</button>
    </div>
    <form class="flag-form" hidden>
      <label for="flag-text">What differs from your notes? <span class="muted flag-where"></span></label>
      <textarea id="flag-text" rows="3" placeholder="e.g. Br should add anti, arrow 2 should start at the π bond"></textarea>
      <div class="flag-buttons"><button type="submit" class="primary">Save note</button><button type="button" data-review="cancel">Cancel</button></div>
    </form>
    ${notes ? `<ul class="flag-notes">${notes}</ul>` : ''}`;
}

// Where in the concept a flag note points: the step on screen right now.
function currentWhere() {
  if (!current?.mech) return 'table';
  const s = current.mech.states[status.index];
  return `Step ${status.index + 1} (${s.title})`;
}

function updateReview(fn, id = current.id) {
  const r = review[id] || { notes: [] };
  r.notes ||= [];
  fn(r);
  if (!r.ok && !r.notes.length) delete review[id]; else review[id] = r;
  saveReview();
  if (mode === 'learn' && id === current?.id) renderReview(current);
  refreshTrust();
}

async function copyReport() {
  const text = reportText();
  const out = els.report.querySelector('.copy-status');
  try {
    await navigator.clipboard.writeText(text);
    out.textContent = 'Copied. Paste it back into the chat.';
  } catch {
    out.innerHTML = '<textarea class="report-text" rows="6" readonly></textarea>Copy blocked; select the text above and copy it.';
    const ta = out.querySelector('textarea');
    ta.value = text; ta.focus(); ta.select();
  }
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
  if (!b) return;
  if (mode === 'quiz') { current = CONCEPTS.find((c) => c.id === b.dataset.id) || current; setMode('learn'); return; }
  select(b.dataset.id);
});
els.modes.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mode]');
  if (b) setMode(b.dataset.mode);
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
  if (h) { player.goTo(+h.dataset.step); return; }
  const b = e.target.closest('[data-review]');
  if (!b) return;
  const form = els.notes.querySelector('.flag-form');
  const act = b.dataset.review;
  if (act === 'ok') updateReview((r) => { r.ok = r.ok ? undefined : today(); });
  else if (act === 'flag') {
    form.hidden = false;
    form.querySelector('.flag-where').textContent = `· ${currentWhere()}`;
    form.querySelector('textarea').focus();
  } else if (act === 'cancel') form.hidden = true;
  else if (act === 'del') updateReview((r) => { r.notes.splice(+b.dataset.i, 1); });
});
els.notes.addEventListener('submit', (e) => {
  // Only the learn-mode flag form; the quiz panel handles its own forms.
  if (mode !== 'learn' || !e.target.closest('.flag-form')) return;
  e.preventDefault();
  const text = e.target.querySelector('textarea').value.trim();
  if (!text) { e.target.querySelector('textarea').focus(); return; }
  updateReview((r) => { r.notes.push({ where: currentWhere(), text, at: today() }); r.ok = undefined; });
});
els.report.addEventListener('click', (e) => {
  if (e.target.closest('[data-review=copy]')) copyReport();
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
  if (e.key === 'q' || e.key === 'Q') { setMode(mode === 'quiz' ? 'learn' : 'quiz'); return; }
  if (mode === 'quiz') { if (e.key === 'Escape') quiz.escape(); return; }
  if (!current?.mech) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); player.next(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); player.prev(); }
  else if (e.key === ' ' && !e.target.matches('button')) { e.preventDefault(); player.toggle(); }
  else if (e.key === 'r' || e.key === 'R') player.replay();
  else if (e.key === 'Home') player.restart();
});

window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (!id || id === current?.id) return;
  if (mode === 'quiz') { current = CONCEPTS.find((c) => c.id === id) || current; setMode('learn'); return; }
  select(id);
});

buildMenu();
select(location.hash.slice(1) || store.get('orgo:last') || CONCEPTS[0].id);
