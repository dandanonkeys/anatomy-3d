#!/usr/bin/env node
// Checks every concept in organic/src/concepts.js.
//
// Errors (exit code 1) are broken data: an arrow pointing at a lone pair,
// bond or atom that does not exist, a bond to an atom that is not drawn,
// a fishhook starting from a lone pair, a duplicate concept id.
//
// Warnings are chemistry that does not add up and needs a human look:
//   - formal charge drawn ≠ formal charge computed from bonds + lone pairs
//   - more than an octet on C/N/O/F, more than 2 electrons on H
//   - an arrow that promises a bond the next step never shows
// A clean run means the data is consistent, NOT that the chemistry is right.
//
// Usage: node organic/tools/validate.mjs [--quiet]   (--quiet hides warnings)

import { CONCEPTS, GROUPS } from '../src/concepts.js';

const quiet = process.argv.includes('--quiet');
const errors = [], warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

// Valence electrons for atoms whose label is a bare element symbol. Group
// labels (CH3, Et, OAc, R …) and metals are skipped by the charge check.
const VALENCE = { H: 1, B: 3, C: 4, N: 5, O: 6, F: 7, Cl: 7, Br: 7, I: 7, S: 6 };
const OCTET = new Set(['C', 'N', 'O', 'F']);

const BOND_RE = /^(\w+)([-=#~>:])(\w+)$/;
const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function parseBonds(str, where) {
  const out = new Map();
  for (const tok of (str || '').trim().split(/\s+/).filter(Boolean)) {
    const m = tok.match(BOND_RE);
    if (!m) { err(where, `unparseable bond "${tok}"`); continue; }
    const [, a, c, b] = m;
    const order = c === '=' ? 2 : c === '#' ? 3 : c === '~' ? 0.5 : 1;
    const k = key(a, b);
    if (out.has(k)) err(where, `bond ${a}-${b} listed twice`);
    out.set(k, { a, b, order, partial: c === '~' });
  }
  return out;
}

const ids = new Set();
for (const c of CONCEPTS) {
  const cw = c.id || '(no id)';
  if (!c.id) err(cw, 'missing id');
  else if (ids.has(c.id)) err(cw, 'duplicate concept id');
  ids.add(c.id);
  if (!GROUPS.includes(c.group)) err(cw, `group "${c.group}" is not in GROUPS`);
  for (const f of ['name', 'summary']) if (!c[f]) err(cw, `missing ${f}`);
  if (!Array.isArray(c.points) || !c.points.length) err(cw, 'missing key points');
  if (!c.mech && !c.table) err(cw, 'has neither mech nor table');
  if (c.table) {
    const n = c.table.cols.length;
    c.table.rows.forEach((r, i) => { if (r.length !== n) err(cw, `table row ${i + 1} has ${r.length} cells, header has ${n}`); });
  }
  if (!c.mech) continue;

  const { atoms, states } = c.mech;
  const parsed = states.map((s, si) => {
    const where = `${cw} step ${si + 1}`;
    const bonds = parseBonds(s.bonds, where);
    for (const id of Object.keys(s.pos || {})) if (!(id in atoms)) err(where, `atom "${id}" has a position but no label in atoms`);
    for (const { a, b } of bonds.values()) for (const id of [a, b]) if (!s.pos?.[id]) err(where, `bond ${a}-${b}: atom "${id}" is not drawn in this step`);
    for (const field of ['lp', 'rad', 'charge']) {
      for (const id of Object.keys(s[field] || {})) if (!s.pos?.[id]) err(where, `${field} on "${id}", which is not drawn in this step`);
    }
    return { s, bonds, where };
  });

  parsed.forEach(({ s, bonds, where }, si) => {
    // ---- formal charge + octet (skip atoms in a transition-state partial bond)
    const order = new Map(), partial = new Set();
    for (const b of bonds.values()) {
      for (const id of [b.a, b.b]) order.set(id, (order.get(id) || 0) + b.order);
      if (b.partial) { partial.add(b.a); partial.add(b.b); }
    }
    for (const id of Object.keys(s.pos || {})) {
      const el = atoms[id];
      if (!(el in VALENCE) || partial.has(id)) continue;
      const lp = (s.lp?.[id] || []).length, rad = (s.rad?.[id] || []).length, bo = order.get(id) || 0;
      const raw = s.charge?.[id];
      const drawn = Array.isArray(raw) ? raw[0] : raw || 0;
      const fc = VALENCE[el] - 2 * lp - rad - bo;
      if (fc !== drawn) warn(where, `${id} (${el}): drawn charge ${drawn}, bonds+lone pairs give ${fc > 0 ? '+' : ''}${fc} [${bo} bonds, ${lp} lp, ${rad} rad]`);
      const e = 2 * bo + 2 * lp + rad;
      if (el === 'H' && e > 2) warn(where, `${id} (H) has ${e} electrons around it`);
      if (OCTET.has(el) && e > 8) warn(where, `${id} (${el}) has ${e} electrons around it (octet broken)`);
    }

    // ---- arrows
    const next = parsed[si + 1];
    const later = next && [...next.bonds.values()].some((b) => b.partial) ? parsed[si + 2] : null;
    const bondIn = (p, a, b) => p?.bonds.get(key(a, b));
    (s.arrows || []).forEach((ar, n) => {
      const aw = `${where} arrow ${n + 1}`;
      const kind = ar.kind || 'pair';
      if (!['pair', 'fish'].includes(kind)) err(aw, `unknown kind "${kind}"`);
      if (!ar.why) err(aw, 'missing explanation (why)');
      const [ft, fa, fb] = String(ar.from).split(':');
      if (ft === 'lp' || ft === 'rad') {
        const list = s[ft]?.[fa];
        if (!list) err(aw, `${ft} source: "${fa}" has no ${ft === 'lp' ? 'lone pairs' : 'radical electrons'}`);
        else if (list[+fb || 0] === undefined) err(aw, `${ft} source: "${fa}" has no ${ft} #${+fb || 0}`);
        if (ft === 'lp' && kind === 'fish') err(aw, 'fishhook (1 electron) drawn from a lone pair');
        if (ft === 'rad' && kind === 'pair') err(aw, 'full arrow (2 electrons) drawn from a single radical electron');
      } else if (ft === 'bond') {
        const [a, b] = fa.split('-');
        if (!bonds.has(key(a, b))) err(aw, `source bond ${fa} does not exist in this step`);
      } else err(aw, `unknown source "${ar.from}"`);

      const to = String(ar.to);
      let forms = null;
      if (to.startsWith('mid:') || to.startsWith('bond:')) {
        const [a, b] = to.split(':')[1].split('-');
        for (const id of [a, b]) if (!s.pos?.[id]) err(aw, `target ${to}: atom "${id}" is not drawn`);
        if (to.startsWith('bond:') && !bonds.has(key(a, b))) err(aw, `target bond ${to.slice(5)} does not exist in this step`);
        forms = [a, b];
      } else if (!s.pos?.[to]) err(aw, `target atom "${to}" is not drawn in this step`);
      else if (ft === 'lp') forms = [fa, to];

      // A lone pair → atom, or anything → mid:A-B, should leave a bond (or a
      // higher bond order) between those atoms in the next step.
      if (forms && next && ft !== 'rad' && kind === 'pair') {
        const before = bondIn(parsed[si], ...forms)?.order || 0;
        const after = Math.max(bondIn(next, ...forms)?.order || 0, bondIn(later, ...forms)?.order || 0);
        if (after <= before) warn(aw, `points to form ${forms.join('–')}, but the next step has no new bond there`);
      }
      // A bond → one of its own atoms should break or lose order.
      if (ft === 'bond' && next && !to.includes(':')) {
        const [a, b] = fa.split('-');
        if (to === a || to === b) {
          const before = bonds.get(key(a, b))?.order || 0;
          const after = Math.min(bondIn(next, a, b)?.order ?? 0, later ? bondIn(later, a, b)?.order ?? 0 : Infinity);
          if (after >= before && kind === 'pair') warn(aw, `breaks ${fa} onto ${to}, but the next step still has that bond`);
        }
      }
    });
  });
}

if (!quiet) for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`\n${CONCEPTS.length} concepts · ${errors.length} error(s) · ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
