import { SYSTEMS, LEVELS } from './systems.js';

// Quiz mode. Two question types:
//   find: "Find the X". Click it (or use ←/→ and Enter). Checked against the target.
//   name: a structure is highlighted with labels hidden. Type its name.
// Results are kept in localStorage and export as JSON for the claude-tutor
// plugin (see tools/tutor-import.mjs and the README).

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LOG_KEY = 'bodyAtlas.quizLog';
const SETTINGS_KEY = 'bodyAtlas.quizSettings';
const REASK_GAP = 3; // a missed structure comes back after this many questions

const store = {
  get(k, fallback) { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked: keep in memory */ } },
};

// ---------- name matching ----------
const FILLER = /\b(the|a|an|of|bone|muscle|m)\b/g;

export function normalize(name, ignoreSide) {
  let n = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  if (ignoreSide) n = n.replace(/\b(left|right)\b/g, ' ');
  return n.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
}

function lev(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

function close(a, b) {
  if (!a || !b) return false;
  const sorted = (x) => x.split(' ').sort().join(' ');
  const len = Math.max(a.length, b.length);
  const tol = len < 5 ? 0 : len < 9 ? 1 : Math.min(3, Math.floor(len / 8) + 1);
  return Math.min(lev(a, b), lev(sorted(a), sorted(b))) <= tol;
}

/** 'correct' | 'side' (right structure, wrong or missing side) | 'wrong' */
export function checkName(answer, target, ignoreSide) {
  if (close(normalize(answer, ignoreSide), normalize(target, ignoreSide))) return 'correct';
  if (!ignoreSide && close(normalize(answer, true), normalize(target, true))) return 'side';
  return 'wrong';
}

export function conceptOf(name, ignoreSide) {
  if (!ignoreSide) return name;
  const n = name.replace(/\b(left|right)\b\s*/gi, '').replace(/\s+/g, ' ').trim();
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const today = () => new Date().toLocaleDateString('sv-SE');

// ---------- quiz ----------
export function initQuiz(api) {
  const app = $('app');
  const stage = $('stage');
  const panel = $('quiz');
  const banner = $('quiz-banner');
  const cursorEl = $('quiz-cursor');
  const modeBtns = document.querySelectorAll('[data-mode]');

  const defaults = { types: ['find', 'name'], systems: ['skeletal'], levels: [1], ignoreSide: true, length: 10, topic: 'anatomy-physiology-1' };
  const settings = { ...defaults, ...store.get(SETTINGS_KEY, {}) };
  let log = store.get(LOG_KEY, []);
  let q = null; // current session
  let saved = null; // explore-mode state to restore

  function pool() {
    const groups = new Map();
    for (const s of api.structures.values()) {
      if (s.hidden || !settings.systems.includes(s.system) || !settings.levels.includes(s.level)) continue;
      const c = conceptOf(s.name, settings.ignoreSide);
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(s);
    }
    return groups;
  }

  // ----- enter / leave -----
  function setMode(mode) {
    const on = mode === 'quiz';
    if (on === !!api.state.quiz) return;
    modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    app.classList.toggle('quiz-on', on);
    if (on) {
      saved = { systems: { ...api.systems }, isolated: api.state.isolated };
      api.state.quiz = true;
      api.select(null);
      renderSetup();
    } else {
      if (q && q.attempts.length) finish(true);
      endQuestion();
      q = null;
      api.state.quiz = false;
      api.onPick = null;
      setAsking(false);
      banner.hidden = true;
      api.select(null);
      for (const [k, v] of Object.entries(saved.systems)) api.setSystem(k, v);
      api.home();
    }
  }
  modeBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  function setAsking(on) {
    api.state.quizHideNames = on;
    stage.classList.toggle('quiz-asking', on);
  }

  // ----- setup screen -----
  function renderSetup() {
    const groups = pool();
    const counts = {};
    for (const s of api.structures.values()) if (!s.hidden) counts[s.system] = (counts[s.system] ?? 0) + 1;
    const chk = (name, value, on, label, extra = '') => `
      <label class="q-opt"><input type="checkbox" name="${name}" value="${value}" ${on ? 'checked' : ''}/>${label}${extra}</label>`;
    panel.innerHTML = `
      <h2>Question types</h2>
      <div class="q-group">
        ${chk('types', 'find', settings.types.includes('find'), 'Find the structure', '<span class="muted">click it</span>')}
        ${chk('types', 'name', settings.types.includes('name'), 'Name this structure', '<span class="muted">type it</span>')}
      </div>
      <h2>Systems</h2>
      <div class="q-group q-cols">
        ${Object.entries(SYSTEMS).map(([k, sys]) => chk('systems', k, settings.systems.includes(k),
          `<span class="swatch" style="--c:${sys.color}"></span>${sys.label}`, `<span class="muted num">${counts[k] ?? 0}</span>`)).join('')}
      </div>
      <h2>Scale level</h2>
      <div class="q-group">
        ${Object.entries(LEVELS).map(([k, l]) => chk('levels', k, settings.levels.includes(+k), `${k} · ${l}`)).join('')}
      </div>
      <div class="q-group">
        ${chk('ignoreSide', '1', settings.ignoreSide, 'Ignore left / right', '<span class="muted">either side counts</span>')}
        <label class="q-opt q-select">Questions
          <select name="length">
            ${[10, 20, 50, 0].map((n) => `<option value="${n}" ${settings.length === n ? 'selected' : ''}>${n || 'No limit'}</option>`).join('')}
          </select>
        </label>
      </div>
      <p class="q-pool muted" id="q-pool">${groups.size} structures match.</p>
      <button type="button" class="q-primary" data-q="start" ${groups.size && settings.types.length ? '' : 'disabled'}>Start quiz</button>
      <p class="q-keys muted">Keys: <kbd>Enter</kbd> answer / next · <kbd>←</kbd><kbd>→</kbd> step through structures in “Find” · <kbd>Esc</kbd> end quiz · <kbd>Q</kbd> switch mode.</p>
      ${historyBlock()}`;
  }

  function historyBlock() {
    if (!log.length) return '';
    const sessions = new Set(log.map((a) => a.session)).size;
    return `
      <div class="q-history">
        <h2>Saved results</h2>
        <p class="muted">${log.length} answers from ${sessions} quiz${sessions > 1 ? 'zes' : ''}, kept in this browser.</p>
        <label class="q-opt q-select">claude-tutor topic <input name="topic" value="${esc(settings.topic)}" spellcheck="false"/></label>
        <div class="actions">
          <button type="button" data-q="export-all">Export all</button>
          <button type="button" data-q="clear">Clear</button>
        </div>
      </div>`;
  }

  panel.addEventListener('change', (e) => {
    const t = e.target;
    if (!t.name || q) return;
    if (t.name === 'length') settings.length = +t.value;
    else if (t.name === 'topic') settings.topic = t.value.trim() || defaults.topic;
    else if (t.name === 'ignoreSide') settings.ignoreSide = t.checked;
    else {
      const vals = [...panel.querySelectorAll(`input[name=${t.name}]:checked`)].map((i) => (t.name === 'levels' ? +i.value : i.value));
      settings[t.name] = vals;
    }
    store.set(SETTINGS_KEY, settings);
    const n = pool().size;
    $('q-pool').textContent = !settings.types.length ? 'Pick at least one question type.' : `${n} structure${n === 1 ? '' : 's'} match.`;
    panel.querySelector('[data-q=start]').disabled = !n || !settings.types.length;
  });

  panel.addEventListener('click', (e) => {
    const act = e.target.closest('[data-q]')?.dataset.q;
    if (!act) return;
    if (act === 'start') start();
    else if (act === 'retry-misses') start(q.missed);
    else if (act === 'setup') { q = null; renderSetup(); }
    else if (act === 'next') next();
    else if (act === 'reveal') answer(null);
    else if (act === 'submit') answer($('q-input').value);
    else if (act === 'end') finish();
    else if (act === 'export') download(q.attempts);
    else if (act === 'export-all') download(log);
    else if (act === 'clear') { log = []; store.set(LOG_KEY, log); renderSetup(); }
    else if (act === 'explore') setMode('explore');
  });

  // ----- session -----
  function start(onlyConcepts) {
    const groups = pool();
    let concepts = shuffle([...groups.keys()]);
    if (onlyConcepts?.length) concepts = shuffle(onlyConcepts.filter((c) => groups.has(c)));
    const limit = onlyConcepts ? concepts.length : settings.length || Infinity;
    q = {
      id: new Date().toISOString(), groups, queue: concepts, limit, n: 0,
      attempts: [], missed: [], current: null, startedAt: new Date().toISOString(),
      settings: { ...settings },
    };
    for (const [k] of Object.entries(SYSTEMS)) api.setSystem(k, settings.systems.includes(k));
    api.state.isolated = false;
    next();
  }

  function next() {
    endQuestion();
    if (!q || q.n >= q.limit || !q.queue.length) { finish(); return; }
    const concept = q.queue.shift();
    const members = q.groups.get(concept);
    const target = members[Math.floor(Math.random() * members.length)];
    const type = q.settings.types[Math.floor(Math.random() * q.settings.types.length)];
    q.n++;
    q.current = { concept, target, type, t0: Date.now(), done: false, cursor: -1 };
    api.setSystem(target.system, true);
    target.hidden = false;
    setAsking(true);
    if (type === 'name') {
      api.select(target, { fly: true });
      api.onPick = () => true; // keep the highlight; clicks don't answer
      banner.hidden = false;
      banner.innerHTML = '<span class="q-tag">Name this</span> What is the highlighted structure?';
    } else {
      api.select(null);
      if (target.level === 1) api.home();
      else {
        // Frame the neighbourhood, offset so the target isn't dead centre.
        const R = Math.min(0.6, Math.max(0.1, target.radius * 5));
        const c = target.center.toArray().map((v, i) => v + (Math.random() - 0.5) * R * (i === 2 ? 0 : 0.7));
        api.frameSphere(c, R);
      }
      api.onPick = (s) => { if (s && !q.current.done) answerFind(s); return true; };
      banner.hidden = false;
      banner.innerHTML = `<span class="q-tag">Find</span> ${esc(q.settings.ignoreSide ? conceptOf(target.name, true) : target.name)}`;
    }
    renderQuestion();
  }

  function endQuestion() {
    for (const s of api.structures.values()) s.quizMark = null;
    cursorEl.hidden = true;
    if (q?.current && api.state.hovered === q.current.cursorS) api.state.hovered = null;
  }

  function scoreLine() {
    const right = q.attempts.filter((a) => a.correct).length;
    return `<span class="num">${right}</span> right · <span class="num">${q.attempts.length - right}</span> missed`;
  }

  function renderQuestion(feedback = '') {
    const c = q.current;
    const total = Number.isFinite(q.limit) ? ` of ${q.limit}` : '';
    const prompt = c.type === 'name'
      ? 'Name the highlighted structure.'
      : `Find the <strong>${esc(q.settings.ignoreSide ? conceptOf(c.target.name, true) : c.target.name)}</strong>.`;
    panel.innerHTML = `
      <div class="q-head"><span>Question <span class="num">${q.n}${total}</span></span><span>${scoreLine()}</span></div>
      <p class="q-prompt">${prompt}</p>
      ${c.type === 'name' && !c.done ? `
        <form class="q-answer" data-form>
          <label for="q-input" class="visually-hidden">Structure name</label>
          <input id="q-input" type="text" autocomplete="off" spellcheck="false" placeholder="Type the name, then Enter" />
        </form>` : ''}
      ${c.type === 'find' && !c.done ? `<p class="muted q-hint">Click it in the view, or press <kbd>←</kbd>/<kbd>→</kbd> to step through structures and <kbd>Enter</kbd> to choose.</p>` : ''}
      <div class="q-feedback" aria-live="polite">${feedback}</div>
      <div class="actions">
        ${c.done
          ? '<button type="button" class="q-primary" data-q="next">Next <kbd>Enter</kbd></button>'
          : `${c.type === 'name' ? '<button type="button" class="q-primary" data-q="submit">Check</button>' : ''}<button type="button" data-q="reveal">Don’t know</button>`}
        <button type="button" data-q="end">End quiz</button>
      </div>`;
    const input = $('q-input');
    if (input) input.focus();
    else panel.querySelector('[data-q=next]')?.focus();
  }

  panel.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('q-input').value;
    answer(v.trim() ? v : null);
  });

  function record(correct, answerText) {
    const c = q.current;
    c.done = true;
    const a = {
      ts: new Date().toISOString(), session: q.id, type: c.type, concept: c.concept,
      structure: c.target.name, structureId: c.target.id, system: c.target.system, level: c.target.level,
      answer: answerText, correct, ms: Date.now() - c.t0,
    };
    q.attempts.push(a);
    log.push(a);
    store.set(LOG_KEY, log);
    if (!correct) {
      if (!q.missed.includes(c.concept)) q.missed.push(c.concept);
      // Re-ask later in this session (if there is room).
      if (q.attempts.filter((x) => x.concept === c.concept && !x.correct).length < 2) {
        q.queue.splice(Math.min(REASK_GAP, q.queue.length), 0, c.concept);
        if (Number.isFinite(q.limit) && q.n + q.queue.length > q.limit && q.queue.length > REASK_GAP) q.queue.pop();
      }
    }
    setAsking(false);
    banner.hidden = true;
    api.onPick = () => true;
  }

  function answerFind(s) {
    const c = q.current;
    const ok = s === c.target || (q.settings.ignoreSide && conceptOf(s.name, true) === c.concept);
    record(ok, s.name);
    cursorEl.hidden = true;
    if (!ok) s.quizMark = 'wrong';
    api.select(ok ? s : c.target, { fly: !ok });
    renderQuestion(ok
      ? `<p class="q-ok">Correct: <strong>${esc(s.name)}</strong>.</p>`
      : `<p class="q-bad">Not quite. You chose the <strong>${esc(s.name)}</strong> <span class="q-dot bad"></span>.
         The <strong>${esc(c.target.name)}</strong> <span class="q-dot ok"></span> is highlighted.</p>`);
  }

  function answer(text) {
    const c = q?.current;
    if (!c || c.done) return;
    if (c.type === 'find') {
      record(false, null);
      api.select(c.target, { fly: true });
      renderQuestion(`<p class="q-bad">This is the <strong>${esc(c.target.name)}</strong>.</p>`);
      return;
    }
    const result = text == null ? 'wrong' : checkName(text, c.target.name, q.settings.ignoreSide);
    record(result === 'correct', text);
    api.select(c.target, { fly: false });
    const typed = text == null ? '' : ` You typed “${esc(text)}”.`;
    renderQuestion(result === 'correct'
      ? `<p class="q-ok">Correct: <strong>${esc(c.target.name)}</strong>.</p>`
      : result === 'side'
        ? `<p class="q-bad">Right structure, wrong or missing side: it’s the <strong>${esc(c.target.name)}</strong>.${typed}</p>`
        : `<p class="q-bad">${text == null ? '' : 'Not quite. '}This is the <strong>${esc(c.target.name)}</strong>.${typed}</p>`);
  }

  function finish(silent = false) {
    if (!q) return;
    endQuestion();
    setAsking(false);
    banner.hidden = true;
    api.onPick = null;
    q.endedAt = new Date().toISOString();
    if (silent) return;
    api.select(null);
    const right = q.attempts.filter((a) => a.correct).length;
    const pct = q.attempts.length ? Math.round((right / q.attempts.length) * 100) : 0;
    panel.innerHTML = `
      <h2>Results</h2>
      <p class="q-score"><span class="num">${right}</span> / <span class="num">${q.attempts.length}</span> <span class="muted">(${pct}%)</span></p>
      ${q.missed.length ? `
        <h2>To review</h2>
        <ul class="q-misses">${q.missed.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : q.attempts.length ? '<p>No misses.</p>' : ''}
      <div class="actions">
        ${q.missed.length ? '<button type="button" class="q-primary" data-q="retry-misses">Practise misses</button>' : ''}
        <button type="button" data-q="setup">New quiz</button>
        ${q.attempts.length ? '<button type="button" data-q="export">Export for claude-tutor</button>' : ''}
      </div>
      <p class="muted q-hint">Export saves a JSON file. Merge it into your claude-tutor progress with
      <code>node tools/tutor-import.mjs &lt;file&gt; --topic ${esc(settings.topic)}</code>.</p>`;
    panel.querySelector('.q-primary, [data-q=setup]')?.focus();
  }

  // ----- export -----
  function exportData(attempts) {
    const concepts = {};
    for (const a of attempts) {
      const c = (concepts[a.concept] ??= { attempts: 0, correct: 0, history: [] });
      c.attempts++;
      if (a.correct) c.correct++;
      c.history.push({ ts: a.ts, type: a.type, correct: a.correct });
      c.lastResult = a.correct;
      c.lastSeen = a.ts;
    }
    const maxLevel = Math.max(1, ...attempts.map((a) => a.level));
    const right = attempts.filter((a) => a.correct).length;
    return {
      schema: 'body-atlas-quiz/1',
      exportedAt: new Date().toISOString(),
      topic: settings.topic,
      sessions: [...new Set(attempts.map((a) => a.session))],
      attempts,
      concepts,
      // Drop-in entry for the `quizzes` array of ~/.claude/learning/progress/<topic>.json
      tutorQuiz: {
        date: attempts.length ? new Date(attempts[attempts.length - 1].ts).toLocaleDateString('sv-SE') : today(),
        module: null,
        score: right,
        total: attempts.length,
        difficulty: ['beginner', 'intermediate', 'advanced'][maxLevel - 1],
        questions: attempts.map((a) => ({ format: a.type === 'find' ? 'mcq' : 'fill', concept: a.concept, correct: a.correct })),
      },
    };
  }

  function download(attempts) {
    const data = exportData(attempts);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `body-atlas-quiz-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ----- keyboard -----
  function candidates() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const out = [];
    for (const s of api.structures.values()) {
      // Step only through the quiz's systems and levels, so keyboard users get a short list.
      if (!api.isPickable(s) || !q.settings.systems.includes(s.system) || !q.settings.levels.includes(s.level)) continue;
      const p = api.toScreen(s);
      if (p.z > 1 || p.x < 0 || p.y < 0 || p.x > w || p.y > h) continue;
      out.push({ s, x: p.x, y: p.y });
    }
    return out.sort((a, b) => a.x - b.x || a.y - b.y);
  }

  function moveCursor(dir) {
    const c = q.current;
    const list = candidates();
    if (!list.length) return;
    let i = list.findIndex((x) => x.s === c.cursorS);
    i = i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length;
    c.cursorS = list[i].s;
    api.state.hovered = c.cursorS;
    cursorEl.hidden = false;
    trackCursor();
  }

  function trackCursor() {
    const s = q?.current?.cursorS;
    if (!s || cursorEl.hidden) return;
    const p = api.toScreen(s);
    cursorEl.style.transform = `translate(${p.x}px, ${p.y}px)`;
    api.state.hovered = s;
    requestAnimationFrame(trackCursor);
  }

  document.addEventListener('keydown', (e) => {
    const typing = e.target.matches('input, textarea, select');
    if (!api.state.quiz) {
      if (!typing && e.key.toLowerCase() === 'q' && !e.metaKey && !e.ctrlKey) setMode('quiz');
      return;
    }
    if (typing) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    const c = q?.current;
    if (e.key.toLowerCase() === 'q' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setMode('explore'); }
    else if (e.key === 'Escape') { if (c && !q.endedAt) finish(); }
    else if (!c || q.endedAt) return;
    else if (c.done && (e.key === 'Enter' || e.key.toLowerCase() === 'n')) { e.preventDefault(); next(); }
    else if (c.type === 'find' && !c.done && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); moveCursor(e.key === 'ArrowRight' ? 1 : -1); }
    else if (c.type === 'find' && !c.done && (e.key === 'Enter' || e.key === ' ') && c.cursorS && !e.target.closest('button')) { e.preventDefault(); answerFind(c.cursorS); }
    else if (c.type === 'name' && !c.done && e.key.toLowerCase() === 'f') api.frame(c.target);
  });

  // Scripting / test hooks.
  api.quiz = {
    settings, setMode, start, next, answer, finish,
    get session() { return q; },
    get log() { return log; },
    export: (all = false) => exportData(all ? log : q?.attempts ?? []),
    checkName, normalize, conceptOf,
  };
}
