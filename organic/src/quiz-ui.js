// Arrow quiz UI: start screen, tap-to-answer loop on the stage, results.
// Grading lives in quiz.js; tap targets come from engine.js targetsFor().
import { targetsFor, ARROW_COLORS } from './engine.js';
import { grade, quizzable, defaultKind, hasFish, matchNames, shuffle, summarize } from './quiz.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const NS = 'http://www.w3.org/2000/svg';
const TAP_PX = 22;                         // tap radius in screen pixels
const SRC_PRI = { lp: 0, rad: 1, bond: 2 };
const DST_PRI = { atom: 0, pair: 1, gap: 1 };
const today = () => new Date().toISOString().slice(0, 10);

// Nearest target within r; ties broken by kind priority, then key, so a tap
// always resolves the same way.
function nearest(list, p, r, pri) {
  let best = null, bd = Infinity;
  for (const t of list) {
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d > r) continue;
    if (!best || d < bd - 0.01 || (Math.abs(d - bd) <= 0.01 && (pri[t.kind] - pri[best.kind] || t.key.localeCompare(best.key)) < 0)) { best = t; bd = d; }
  }
  return best;
}

export function createQuizUI({ player, svg, caption, panel, bar, concepts, trust, addFlag, showScene }) {
  const Q = { active: false, phase: 'setup', picked: [], unmatched: [], skipped: [], items: [], idx: 0, results: [], st: null, kind: 'pair', flagging: null, timer: 0 };
  const byId = (id) => concepts.find((c) => c.id === id);
  const eligible = () => concepts.filter((c) => quizzable(c) && trust(c) !== 'flagged');
  const isProvisional = (c) => trust(c) !== 'verified';
  const item = () => Q.items[Q.idx];
  const cur = () => byId(item().id);
  const hits = player.hitLayer;

  /* ---------------- setup ---------------- */

  function open() {
    Q.active = true;
    if (Q.phase === 'run') return render();
    Q.phase = 'setup';
    showScene(false);
    clearHits();
    caption.innerHTML = '<p class="cap-step">Arrow quiz</p><p class="cap-title">Push the electrons yourself</p><p class="cap-text">Pick mechanisms on the right, then press Start. Each step hides its arrows: tap the electrons that move, then tap where they go.</p>';
    bar.hidden = true;
    renderSetup();
  }

  function close() {
    Q.active = false;
    clearTimeout(Q.timer);
    if (Q.phase === 'run') Q.phase = 'setup';
    Q.st = null;
    clearHits();
    bar.hidden = true;
    player.setView({ hideArrows: false, shown: new Set() });
  }

  const running = () => Q.active && Q.phase === 'run';

  function renderSetup() {
    const checkedCount = eligible().filter((c) => trust(c) === 'checked' || trust(c) === 'verified').length;
    const picked = Q.picked.map(byId);
    const allProv = picked.length && picked.every(isProvisional);
    panel.innerHTML = `<h2 class="sel-name">Arrow quiz</h2>
      <p class="summary">Each step shows the molecules with the arrows hidden. Tap the electrons that move, then where they go. Arrows in a step can be found in any order; you get two tries per arrow.</p>
      <label class="q-label" for="quiz-paste">Paste concept names <span class="muted">(e.g. your due reviews)</span></label>
      <textarea id="quiz-paste" rows="4" placeholder="SN2&#10;E2, hydroboration"></textarea>
      <div class="q-row"><button type="button" data-q="paste">Add pasted</button><button type="button" data-q="random">Random 5</button><button type="button" data-q="checked"${checkedCount ? '' : ' disabled'}>All I've checked (${checkedCount})</button></div>
      ${Q.unmatched.length ? `<p class="q-unmatched"><b>Not found:</b> ${Q.unmatched.map(esc).join(', ')}</p>` : ''}
      ${Q.skipped.length ? `<p class="q-skipped muted"><b>Skipped:</b> ${Q.skipped.map(esc).join(', ')}</p>` : ''}
      <h3>In this quiz (${picked.length})</h3>
      ${picked.length ? `<ol class="q-picked">${picked.map((c) => `<li><span>${esc(c.name)}${isProvisional(c) ? ' <span class="prov">provisional</span>' : ''}</span><button type="button" class="q-x" data-q="remove" data-id="${c.id}" aria-label="Remove ${esc(c.name)}">×</button></li>`).join('')}</ol>` : '<p class="muted q-empty">Nothing picked yet.</p>'}
      ${allProv ? '<p class="q-note">None of these are verified against your notes yet, so every answer key is <b>provisional</b>. If an answer looks wrong, flag it from the results.</p>' : ''}
      <button type="button" class="q-primary" data-q="start"${picked.length ? '' : ' disabled'}>Start quiz${picked.length ? ` · ${picked.length} mechanism${picked.length > 1 ? 's' : ''}` : ''}</button>`;
  }

  function addIds(ids) {
    for (const id of ids) if (!Q.picked.includes(id)) Q.picked.push(id);
  }

  function pastePicked() {
    const text = panel.querySelector('#quiz-paste').value;
    const { matched, unmatched } = matchNames(text, concepts);
    Q.unmatched = unmatched;
    Q.skipped = [];
    const ok = [];
    for (const id of matched) {
      const c = byId(id);
      if (!quizzable(c)) Q.skipped.push(`${c.name} (no arrows to quiz)`);
      else if (trust(c) === 'flagged') Q.skipped.push(`${c.name} (flagged)`);
      else ok.push(id);
    }
    addIds(ok);
    renderSetup();
  }

  /* ---------------- run ---------------- */

  function start() {
    if (!Q.picked.length) return;
    Q.items = Q.picked.map((id) => ({ id, provisional: isProvisional(byId(id)), done: false }));
    Q.idx = 0; Q.results = []; Q.phase = 'run'; Q.flagging = null;
    showScene(true);
    loadItem();
  }

  function loadItem() {
    clearTimeout(Q.timer);
    const c = cur();
    Q.kind = defaultKind(c.mech);
    Q.st = null;
    player.setView({ hideArrows: true, shown: new Set() });
    player.load(c.mech);
  }

  // Called by the app on every player change while the quiz is open.
  function sync(status) {
    if (!running()) return;
    if (status.phase !== 'idle') { clearHits(); return; }
    if (!Q.st || Q.st.index !== status.index) newState(status.index, status.count);
    render();
  }

  function newState(i, count) {
    clearTimeout(Q.timer);
    const c = cur();
    const arrows = c.mech.states[i].arrows || [];
    Q.st = { index: i, last: i >= count - 1, arrows, found: new Set(), tries: {}, sel: null, targets: arrows.length ? targetsFor(c.mech, i) : null, msg: null, done: false };
    player.setView({ shown: new Set() });
    if (!arrows.length) {
      if (!Q.st.last) Q.timer = setTimeout(() => player.next(), 1100);
      else finishItem();
    }
  }

  function finishItem() {
    Q.st.done = true;
    item().done = true;
  }

  function record(n, firstTry, revealed) {
    const c = cur(), s = c.mech.states[Q.st.index];
    Q.results.push({ id: c.id, name: c.name, provisional: item().provisional, step: Q.st.index + 1, stepTitle: s.title, arrow: n + 1, why: Q.st.arrows[n].why, firstTry, revealed });
  }

  function stepComplete() {
    const st = Q.st;
    if (st.found.size < st.arrows.length) return;
    if (st.last) { finishItem(); return; }
    Q.timer = setTimeout(() => { if (Q.st === st) player.next(); }, 1500);
  }

  function submit(dest) {
    const st = Q.st;
    const pick = { from: st.sel.key, to: dest.key, kind: Q.kind };
    const g = grade(st.arrows, st.found, st.tries, pick);
    st.sel = null;
    if (g.result === 'correct') {
      st.found.add(g.arrow);
      record(g.arrow, g.firstTry, false);
      st.msg = { tone: 'ok', text: `✓ Arrow ${g.arrow + 1}: ${st.arrows[g.arrow].why}`, arrow: g.arrow };
    } else if (g.result === 'wrong') {
      st.tries[g.arrow] = g.tries;
      st.msg = { tone: 'bad', text: Q.kind !== st.arrows[g.arrow].kind && hasFish(cur().mech)
        ? 'Not quite. Check the destination and the arrow type (2 e⁻ or 1 e⁻). One more try for these electrons.'
        : 'Right electrons, wrong destination. One more try for these electrons.' };
      flash(dest);
    } else if (g.result === 'reveal') {
      st.tries[g.arrow] = g.tries;
      st.found.add(g.arrow);
      record(g.arrow, false, true);
      st.msg = { tone: 'bad', text: `Here's that arrow: ${st.arrows[g.arrow].why}`, arrow: g.arrow };
    } else {
      st.msg = { tone: 'warn', text: "Those electrons don't move in this step. Pick another source." };
      flash(dest);
    }
    player.setView({ shown: new Set(st.found) });
    stepComplete();
    render();
  }

  function revealOne() {
    const st = Q.st;
    const n = st.arrows.findIndex((_, i) => !st.found.has(i));
    if (n < 0) return;
    st.sel = null;
    st.found.add(n);
    record(n, false, true);
    st.msg = { tone: 'bad', text: `Arrow ${n + 1}: ${st.arrows[n].why}`, arrow: n };
    player.setView({ shown: new Set(st.found) });
    stepComplete();
    render();
  }

  function onPointer(e) {
    if (!running() || player.phase !== 'idle') return;
    const st = Q.st;
    if (!st?.targets || st.done || st.found.size === st.arrows.length) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const r = TAP_PX / ctm.a;
    if (st.sel) {
      if (Math.hypot(p.x - st.sel.x, p.y - st.sel.y) <= r * 0.6) { st.sel = null; st.msg = null; render(); return; }
      const t = nearest(st.targets.dests, p, r, DST_PRI);
      if (!t) { st.msg = { tone: 'warn', text: 'Tap an atom, or the space between two atoms.' }; render(); return; }
      submit(t);
    } else {
      const t = nearest(st.targets.sources, p, r, SRC_PRI);
      if (!t) { st.msg = { tone: 'warn', text: 'Tap a lone pair, a radical electron or a bond.' }; render(); return; }
      st.sel = t; st.msg = null;
      render();
    }
  }
  svg.addEventListener('pointerdown', onPointer);

  /* ---------------- drawing ---------------- */

  function clearHits() { hits.replaceChildren(); }

  function ring(x, y, r, cls) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', r); c.setAttribute('class', cls);
    hits.append(c);
    return c;
  }

  function flash(t) {
    const c = ring(t.x, t.y, 15, 'hit-flash');
    setTimeout(() => c.remove(), 700);
  }

  function drawHits() {
    clearHits();
    const st = Q.st;
    if (!st?.targets || st.done || st.found.size === st.arrows.length) return;
    if (st.sel) {
      for (const t of st.targets.dests) if (t.kind !== 'atom') ring(t.x, t.y, 7, 'hit-gap');
      ring(st.sel.x, st.sel.y, 13, 'hit-sel');
    }
  }

  function render() {
    if (!Q.active) return;
    if (Q.phase === 'setup') return renderSetup();
    if (Q.phase === 'end') return renderEnd();
    const st = Q.st, c = cur();
    if (!st) return;
    const n = Q.items.length, count = c.mech.states.length;
    const s = c.mech.states[st.index];
    const prov = item().provisional ? ' <span class="prov">provisional</span>' : '';
    let prompt;
    if (st.done) prompt = `${esc(s.title)}. ${esc(s.text)}`;
    else if (!st.arrows.length) prompt = 'Watch this step.';
    else if (st.found.size === st.arrows.length) prompt = 'Step complete.';
    else if (st.sel) prompt = 'Now tap where those electrons go: an atom, or the space between two atoms.';
    else prompt = `Tap the electrons that move. ${st.arrows.length > 1 ? `${st.arrows.length} arrows in this step, any order (${st.found.size} found).` : '1 arrow in this step.'}`;
    caption.innerHTML = `<p class="cap-step">Mechanism ${Q.idx + 1} of ${n} · Step ${st.index + 1} of ${count}</p><p class="cap-title">${esc(c.name)}${prov}</p><p class="cap-text">${prompt}</p>`;
    drawHits();

    // stage bar: arrow-type toggle, feedback, actions
    const fishy = hasFish(c.mech);
    const open = st.arrows.length && st.found.size < st.arrows.length && !st.done;
    let h = '';
    if (fishy && open) {
      h += `<div class="kind-toggle" role="group" aria-label="Arrow type">
        <button type="button" data-q="kind" data-kind="pair" aria-pressed="${Q.kind === 'pair'}">2 e⁻ arrow</button>
        <button type="button" data-q="kind" data-kind="fish" aria-pressed="${Q.kind === 'fish'}">1 e⁻ fishhook</button></div>`;
    }
    if (st.msg) {
      const dot = st.msg.arrow !== undefined ? `<span class="q-dot" style="--c:${ARROW_COLORS[st.msg.arrow % ARROW_COLORS.length]}">${st.msg.arrow + 1}</span>` : '';
      h += `<p class="q-msg is-${st.msg.tone}" role="status">${dot}${esc(st.msg.text)}</p>`;
    }
    const btns = [];
    if (st.sel) btns.push('<button type="button" data-q="cancel">Cancel <kbd>Esc</kbd></button>');
    if (open) btns.push('<button type="button" data-q="reveal">Show an arrow</button>');
    if (st.done) btns.push(`<button type="button" class="q-primary" data-q="next">${Q.idx + 1 < n ? 'Next mechanism →' : 'See results'}</button>`);
    if (btns.length) h += `<div class="q-row">${btns.join('')}</div>`;
    bar.innerHTML = h;
    bar.hidden = !h;
    renderRunPanel();
  }

  function renderRunPanel() {
    const sum = summarize(Q.results, Q.items);
    panel.innerHTML = `<h2 class="sel-name">Arrow quiz</h2>
      <p class="q-live"><b>${sum.first}</b> of ${sum.total} arrows first try${sum.revealed ? ` · ${sum.revealed} shown` : ''}</p>
      <ol class="q-progress">${Q.items.map((it, i) => {
        const c = byId(it.id);
        const rs = Q.results.filter((r) => r.id === it.id);
        const mark = it.done ? `${rs.filter((r) => r.firstTry).length}/${rs.length}` : i === Q.idx ? 'now' : '';
        return `<li class="${i === Q.idx ? 'is-current' : ''}${it.done ? ' is-done' : ''}"><span>${esc(c.name)}${it.provisional ? ' <span class="prov">provisional</span>' : ''}</span><span class="q-mark">${mark}</span></li>`;
      }).join('')}</ol>
      <p class="q-help muted">Tap a lone pair, radical electron or bond, then the atom or gap the electrons go to. Tap the same spot again or press <kbd>Esc</kbd> to cancel.${hasFish(cur().mech) ? ' This mechanism has fishhook arrows: set the arrow type before tapping.' : ''}</p>
      <div class="q-row"><button type="button" data-q="end">End quiz</button></div>`;
  }

  /* ---------------- results ---------------- */

  function end() {
    clearTimeout(Q.timer);
    Q.phase = 'end';
    Q.st = null;
    clearHits();
    bar.hidden = true;
    player.setView({ hideArrows: false, shown: new Set() });
    const sum = summarize(Q.results, Q.items);
    caption.innerHTML = `<p class="cap-step">Quiz complete</p><p class="cap-title">${sum.first} of ${sum.total} arrows first try</p><p class="cap-text">${provText(sum)}</p>`;
    renderEnd();
  }

  const provText = (sum) => (sum.provisional
    ? `${sum.provisional === sum.mechanisms ? 'All' : `${sum.provisional} of ${sum.mechanisms}`} mechanism${sum.mechanisms > 1 ? 's' : ''} provisional: answer keys not yet checked against your notes.`
    : 'All answer keys verified against your notes.');

  function renderEnd() {
    const sum = summarize(Q.results, Q.items);
    const misses = Q.results.map((r, i) => ({ ...r, i })).filter((r) => !r.firstTry);
    panel.innerHTML = `<h2 class="sel-name">Quiz results</h2>
      <p class="q-score">${sum.first}/${sum.total} <span class="muted">first try${sum.total ? ` (${sum.pct}%)` : ''}</span></p>
      <p class="q-sub">${sum.revealed} shown · ${sum.mechanisms} mechanism${sum.mechanisms > 1 ? 's' : ''}${Q.items.some((it) => !it.done) ? ` · ${Q.items.filter((it) => !it.done).length} not finished` : ''}</p>
      ${sum.provisional ? `<p class="q-note">${esc(provText(sum))}</p>` : ''}
      <h3>Missed (${misses.length})</h3>
      ${misses.length ? `<ul class="q-misses">${misses.map((r) => `<li>
        <p><b>${esc(r.name)}</b> · Step ${r.step} (${esc(r.stepTitle)}), arrow ${r.arrow}${r.revealed ? ' <span class="prov is-bad">shown</span>' : ''}</p>
        <p class="muted">${esc(r.why)}</p>
        ${Q.flagging === r.i
          ? `<form class="q-flag" data-r="${r.i}"><label class="visually-hidden" for="q-flag-text">What looks wrong?</label><textarea id="q-flag-text" rows="2" placeholder="What looks wrong in this answer?"></textarea><div class="q-row"><button type="submit" class="q-primary">Save flag</button><button type="button" data-q="flag-cancel">Cancel</button></div></form>`
          : r.flagged ? '<p class="q-flagged">⚑ Flagged for review</p>' : `<button type="button" class="q-link" data-q="flag" data-r="${r.i}">⚑ Key looks wrong</button>`}
      </li>`).join('')}</ul>` : '<p class="muted">None. Every arrow first try.</p>'}
      <div class="q-row q-end-actions">
        <button type="button" class="q-primary" data-q="copy">Copy results</button>
        <button type="button" data-q="retry"${misses.length ? '' : ' disabled'}>Retry missed</button>
        <button type="button" data-q="new">New quiz</button>
      </div>
      <p class="copy-status muted" aria-live="polite"></p>`;
  }

  function resultsText() {
    const sum = summarize(Q.results, Q.items);
    const lines = [`# Orgo arrow quiz (${today()})`, '',
      `Score: ${sum.first}/${sum.total} arrows first try (${sum.pct}%) · ${sum.revealed} shown · ${sum.mechanisms} mechanisms (${sum.provisional} provisional)`, '', '## Missed'];
    const misses = Q.results.filter((r) => !r.firstTry);
    if (!misses.length) lines.push('- none');
    for (const r of misses) lines.push(`- ${r.name} · Step ${r.step} (${r.stepTitle}), arrow ${r.arrow}${r.revealed ? ' [shown]' : ''}: ${r.why}`);
    lines.push('', '## By mechanism');
    for (const it of Q.items) {
      const rs = Q.results.filter((r) => r.id === it.id);
      lines.push(`- ${byId(it.id).name}${it.provisional ? ' (provisional)' : ''}: ${it.done ? `${rs.filter((r) => r.firstTry).length}/${rs.length} first try` : 'not finished'}`);
    }
    return lines.join('\n');
  }

  async function copyResults() {
    const text = resultsText();
    const out = panel.querySelector('.copy-status');
    try {
      await navigator.clipboard.writeText(text);
      out.textContent = 'Copied. Paste it into your review app or the chat.';
    } catch {
      out.innerHTML = '<textarea class="report-text" rows="6" readonly></textarea>Copy blocked; select the text above and copy it.';
      const ta = out.querySelector('textarea');
      ta.value = text; ta.focus(); ta.select();
    }
  }

  /* ---------------- events ---------------- */

  function onClick(e) {
    const b = e.target.closest('[data-q]');
    if (!b || !Q.active) return;
    const act = b.dataset.q;
    if (act === 'paste') pastePicked();
    else if (act === 'random') { addIds(shuffle(eligible().map((c) => c.id)).filter((id) => !Q.picked.includes(id)).slice(0, 5)); renderSetup(); }
    else if (act === 'checked') { addIds(eligible().filter((c) => trust(c) === 'checked' || trust(c) === 'verified').map((c) => c.id)); renderSetup(); }
    else if (act === 'remove') { Q.picked = Q.picked.filter((id) => id !== b.dataset.id); renderSetup(); }
    else if (act === 'start') start();
    else if (act === 'kind') { Q.kind = b.dataset.kind; render(); }
    else if (act === 'cancel') { if (Q.st) { Q.st.sel = null; render(); } }
    else if (act === 'reveal') revealOne();
    else if (act === 'next') { if (Q.idx + 1 < Q.items.length) { Q.idx++; loadItem(); } else end(); }
    else if (act === 'end') end();
    else if (act === 'copy') copyResults();
    else if (act === 'retry') {
      const ids = [...new Set(Q.results.filter((r) => !r.firstTry).map((r) => r.id))];
      Q.picked = ids; Q.unmatched = []; Q.skipped = []; start();
    } else if (act === 'new') { Q.phase = 'setup'; Q.picked = []; Q.unmatched = []; Q.skipped = []; open(); }
    else if (act === 'flag') { Q.flagging = +b.dataset.r; renderEnd(); panel.querySelector('#q-flag-text')?.focus(); }
    else if (act === 'flag-cancel') { Q.flagging = null; renderEnd(); }
  }
  panel.addEventListener('click', onClick);
  bar.addEventListener('click', onClick);
  panel.addEventListener('submit', (e) => {
    const form = e.target.closest('.q-flag');
    if (!form) return;
    e.preventDefault();
    const r = Q.results[+form.dataset.r];
    const text = form.querySelector('textarea').value.trim() || 'Answer key looks wrong (from the quiz).';
    addFlag(r.id, `Step ${r.step} (${r.stepTitle}), arrow ${r.arrow}`, text);
    r.flagged = true;
    Q.flagging = null;
    renderEnd();
  });

  return {
    open, close, sync,
    get running() { return running(); },
    escape() { if (running() && Q.st?.sel) { Q.st.sel = null; render(); } },
  };
}
