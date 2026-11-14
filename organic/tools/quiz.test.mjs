// node --test organic/tools/   (also run by `npm run check:orgo`)
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONCEPTS } from '../src/concepts.js';
import { targetsFor } from '../src/engine.js';
import { normFrom, normTo, answersFor, matches, grade, matchNames, quizzable, defaultKind, summarize } from '../src/quiz.js';

/* ---------------- matcher table ---------------- */

test('normalizes equivalent refs to one key', () => {
  assert.equal(normFrom('lp:O:0'), 'lp:O');
  assert.equal(normFrom('lp:O:2'), 'lp:O');
  assert.equal(normFrom('rad:Br:0'), 'rad:Br');
  assert.equal(normFrom('bond:C2-C1'), normFrom('bond:C1-C2'));
  assert.equal(normTo('mid:B-A'), normTo('mid:A-B'));
  assert.equal(normTo('bond:A-B'), normTo('mid:B-A'));
  assert.equal(normTo('C'), 'atom:C');
});

const pair = { from: 'lp:O:0', to: 'C', kind: 'pair', why: '' };
const toGap = { from: 'bond:Cb-Hb', to: 'mid:Cb-Ca', why: '' };
const fish = { from: 'rad:Br:0', to: 'mid:Br-C1', kind: 'fish', why: '' };
const withAlt = { from: 'bond:C1-C2', to: 'H', alt: [{ from: 'bond:C1-C2', to: 'mid:C1-H' }], why: '' };

const cases = [
  ['exact', pair, { from: 'lp:O', to: 'atom:C', kind: 'pair' }, true],
  ['other lone pair on same atom', pair, { from: normFrom('lp:O:2'), to: 'atom:C', kind: 'pair' }, true],
  ['wrong atom', pair, { from: 'lp:O', to: 'atom:Br', kind: 'pair' }, false],
  ['wrong kind (fishhook for a pair arrow)', pair, { from: 'lp:O', to: 'atom:C', kind: 'fish' }, false],
  ['reversed gap pair', toGap, { from: 'bond:Cb|Hb', to: normTo('mid:Ca-Cb'), kind: 'pair' }, true],
  ['bond target counts as gap of same pair', toGap, { from: 'bond:Cb|Hb', to: normTo('bond:Ca-Cb'), kind: 'pair' }, true],
  ['fishhook right', fish, { from: 'rad:Br', to: 'pair:Br|C1', kind: 'fish' }, true],
  ['fishhook toggle left on 2e⁻', fish, { from: 'rad:Br', to: 'pair:Br|C1', kind: 'pair' }, false],
  ['alt answer accepted', withAlt, { from: 'bond:C1|C2', to: 'pair:C1|H', kind: 'pair' }, true],
  ['main answer still accepted with alt', withAlt, { from: 'bond:C1|C2', to: 'atom:H', kind: 'pair' }, true],
];
for (const [name, arrow, pick, want] of cases) test(`matches: ${name}`, () => assert.equal(matches(arrow, pick), want));

test('grade: any order, retry, reveal, stray', () => {
  const arrows = [
    { from: 'lp:O:0', to: 'H', why: '' },
    { from: 'bond:C-H', to: 'mid:C-C2', why: '' },
    { from: 'bond:C2-Br', to: 'Br', why: '' },
  ];
  const found = new Set(), tries = {};
  // second arrow first: fine
  let g = grade(arrows, found, tries, { from: 'bond:C|H', to: 'pair:C|C2', kind: 'pair' });
  assert.deepEqual(g, { result: 'correct', arrow: 1, firstTry: true });
  found.add(1);
  // right source, wrong destination → charged to arrow 0
  g = grade(arrows, found, tries, { from: 'lp:O', to: 'atom:C', kind: 'pair' });
  assert.deepEqual(g, { result: 'wrong', arrow: 0, tries: 1 });
  tries[0] = 1;
  // electrons that don't move here → stray, nobody charged
  g = grade(arrows, found, tries, { from: 'lp:Br', to: 'atom:C', kind: 'pair' });
  assert.deepEqual(g, { result: 'stray' });
  // second wrong on arrow 0 → reveal
  g = grade(arrows, found, tries, { from: 'lp:O', to: 'atom:Br', kind: 'pair' });
  assert.deepEqual(g, { result: 'reveal', arrow: 0, tries: 2 });
  found.add(0);
  // correct after a wrong try is not first-try
  tries[2] = 1;
  g = grade(arrows, found, tries, { from: 'bond:Br|C2', to: 'atom:Br', kind: 'pair' });
  assert.deepEqual(g, { result: 'correct', arrow: 2, firstTry: false });
});

test('grade: wrong kind with right source and destination costs a try', () => {
  const g = grade([fish], new Set(), {}, { from: 'rad:Br', to: 'pair:Br|C1', kind: 'pair' });
  assert.deepEqual(g, { result: 'wrong', arrow: 0, tries: 1 });
});

test('summarize counts first-try, revealed and provisional', () => {
  const s = summarize(
    [{ firstTry: true }, { firstTry: false, revealed: true }, { firstTry: false }, { firstTry: true }],
    [{ provisional: true }, { provisional: false }],
  );
  assert.deepEqual(s, { total: 4, first: 2, revealed: 1, pct: 50, provisional: 1, mechanisms: 2 });
});

test('matchNames: exact, loose, and unmatched are reported', () => {
  const { matched, unmatched } = matchNames('SN2\nhydroboration oxidation, 3. ozonolysis; bromination\nfoo bar reaction', CONCEPTS);
  assert.ok(matched.includes('sn2'));
  assert.ok(matched.includes('ozonolysis'));
  assert.ok(matched.length >= 4, `matched ${matched}`);
  assert.deepEqual(unmatched, ['foo bar reaction']);
});

/* ---------------- answerability over every mechanism ---------------- */

const mechs = CONCEPTS.filter(quizzable);

test('there are quizzable mechanisms', () => assert.ok(mechs.length >= 25, `${mechs.length}`));

for (const c of mechs) {
  test(`answerable: ${c.id}`, () => {
    assert.ok(['pair', 'fish'].includes(defaultKind(c.mech)));
    c.mech.states.forEach((s, si) => {
      const arrows = s.arrows || [];
      if (!arrows.length) return;
      const { sources, dests } = targetsFor(c.mech, si);
      const seen = new Set();
      arrows.forEach((ar, n) => {
        const where = `${c.id} step ${si + 1} arrow ${n + 1}`;
        for (const ans of answersFor(ar)) {
          const src = sources.filter((t) => t.key === ans.from);
          const dst = dests.filter((t) => t.key === ans.to);
          assert.ok(src.length, `${where}: no tap target for source ${ans.from}`);
          assert.equal(dst.length, 1, `${where}: ${dst.length} tap targets for destination ${ans.to}`);
          // Tapping exactly on an answer target must pick that target, not a neighbour.
          for (const t of [...src, ...dst]) {
            const pool = t.kind === 'atom' || t.kind === 'pair' || t.kind === 'gap' ? dests : sources;
            const clash = pool.filter((o) => o !== t && o.key !== t.key && Math.hypot(o.x - t.x, o.y - t.y) < 0.5);
            assert.equal(clash.length, 0, `${where}: ${t.key} sits on top of ${clash.map((o) => o.key)}`);
          }
        }
        const k = answersFor(ar)[0];
        const id = `${k.from}>${k.to}>${k.kind}`;
        assert.ok(!seen.has(id), `${where}: duplicate of another arrow in this step`);
        seen.add(id);
      });
    });
  });
}
