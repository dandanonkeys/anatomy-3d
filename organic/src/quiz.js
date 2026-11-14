// Arrow quiz: pure grading + session helpers (no DOM, tested in node).
//
// A "pick" is what the student tapped: { from: sourceKey, to: destKey, kind }.
// Keys are normalized so equivalent answers compare equal:
//   lp:O:1        → lp:O          any lone pair on the right atom counts
//   rad:Br:0      → rad:Br
//   bond:C2-C1    → bond:C1|C2    atom order never matters
//   C             → atom:C
//   mid:A-B / bond:A-B → pair:A|B  "between A and B" whether bonded yet or not

const pairOf = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function normFrom(ref) {
  const [t, a] = String(ref).split(':');
  if (t === 'lp' || t === 'rad') return `${t}:${a}`;
  if (t === 'bond') { const [x, y] = a.split('-'); return `bond:${pairOf(x, y)}`; }
  throw new Error(`Unknown arrow source "${ref}"`);
}

export function normTo(ref) {
  const s = String(ref);
  if (s.startsWith('mid:') || s.startsWith('bond:')) { const [x, y] = s.split(':')[1].split('-'); return `pair:${pairOf(x, y)}`; }
  return `atom:${s}`;
}

// Every accepted answer for an arrow: the arrow itself plus its `alt` list.
// An alt may set its own kind; otherwise it inherits the arrow's.
export function answersFor(arrow) {
  const kind = arrow.kind || 'pair';
  return [{ from: arrow.from, to: arrow.to }, ...(arrow.alt || [])]
    .map((a) => ({ from: normFrom(a.from), to: normTo(a.to), kind: a.kind || kind }));
}

export const matches = (arrow, pick) =>
  answersFor(arrow).some((a) => a.from === pick.from && a.to === pick.to && a.kind === pick.kind);

// Grade one attempt against the arrows of a state.
//   found: Set of arrow indexes already answered; tries: { [index]: wrong count }
// Arrows can be answered in any order. A wrong attempt is charged to the first
// unfound arrow whose source the student picked (right electrons, wrong place
// or wrong 1e/2e kind); its second wrong attempt reveals it. Picking electrons
// that don't move in this step is a "stray": flagged, but charged to no arrow.
export function grade(arrows, found, tries, pick) {
  const open = arrows.map((_, i) => i).filter((i) => !found.has(i));
  const hit = open.find((i) => matches(arrows[i], pick));
  if (hit !== undefined) return { result: 'correct', arrow: hit, firstTry: !tries[hit] };
  const charged = open.find((i) => answersFor(arrows[i]).some((a) => a.from === pick.from));
  if (charged === undefined) return { result: 'stray' };
  const n = (tries[charged] || 0) + 1;
  return { result: n >= 2 ? 'reveal' : 'wrong', arrow: charged, tries: n };
}

/* ---------------- sessions ---------------- */

export const quizzable = (c) => !!c.mech && c.mech.states.some((s) => (s.arrows || []).length);

// Most common arrow kind in a mechanism: the 2e⁻/1e⁻ toggle's starting value.
export function defaultKind(mech) {
  let fish = 0, pair = 0;
  for (const s of mech.states) for (const a of s.arrows || []) (a.kind === 'fish' ? fish++ : pair++);
  return fish > pair ? 'fish' : 'pair';
}
export const hasFish = (mech) => mech.states.some((s) => (s.arrows || []).some((a) => a.kind === 'fish'));

const fold = (s) => String(s).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Match pasted names (comma / newline / semicolon separated) to concepts.
// Exact name or id first, then containment, then best word overlap (≥ 60%).
export function matchNames(text, concepts) {
  const names = String(text).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const pool = concepts.map((c) => ({ c, keys: [fold(c.name), fold(c.id)] }));
  const matched = [], unmatched = [];
  for (const raw of names) {
    const n = fold(raw.replace(/^[-*•\d.)\s]+/, ''));
    if (!n) continue;
    let best = pool.find((p) => p.keys.includes(n));
    if (!best && n.length >= 3) best = pool.find((p) => p.keys.some((k) => k.includes(n) || n.includes(k)));
    if (!best) {
      const words = new Set(n.split(' '));
      let top = 0;
      for (const p of pool) {
        const kw = new Set(p.keys[0].split(' '));
        const common = [...words].filter((w) => kw.has(w)).length;
        const score = common / Math.max(words.size, kw.size);
        if (score > top) { top = score; best = p; }
      }
      if (top < 0.6) best = null;
    }
    if (best) { if (!matched.includes(best.c.id)) matched.push(best.c.id); } else unmatched.push(raw);
  }
  return { matched, unmatched };
}

export function shuffle(list, rand = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Totals from per-arrow results: [{ id, firstTry, revealed, ... }] and items [{ id, provisional }]
export function summarize(results, items) {
  const total = results.length;
  const first = results.filter((r) => r.firstTry).length;
  const revealed = results.filter((r) => r.revealed).length;
  const provisional = items.filter((it) => it.provisional).length;
  return { total, first, revealed, pct: total ? Math.round((100 * first) / total) : 0, provisional, mechanisms: items.length };
}
