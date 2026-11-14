// Concept library: quick explanations + animated mechanisms.
// Geometry format is documented at the top of engine.js.

import { MORE_CONCEPTS } from './more-reactions.js';

// Point at distance r from atom position c, at angle deg (0 = right, 90 = down).
const at = (c, deg, r = 66) => {
  const a = (deg * Math.PI) / 180;
  return [Math.round(c[0] + r * Math.cos(a)), Math.round(c[1] + r * Math.sin(a))];
};

/* ---------------- Foundations ---------------- */

const curvedArrows = (() => {
  const O0 = [250, 220], O1 = [250, 215];
  return {
    atoms: { Ha: 'H', O: 'O', Hb: 'H', Cl: 'Cl' },
    states: [
      {
        title: 'Read the arrows', text: 'Each arrow starts at electrons (a lone pair or a bond) and ends where those electrons go.',
        pos: { O: O0, Ha: at(O0, 180, 58), Hb: [390, 220], Cl: [480, 220] },
        bonds: 'Ha-O Hb-Cl', lp: { O: [0, -90, 90], Cl: [0, -90, 90] }, charge: { O: [-1, -135] },
        arrows: [
          { from: 'lp:O:0', to: 'Hb', bend: 1, why: 'Tail on hydroxide’s lone pair, head on the H it will bond to.' },
          { from: 'bond:Hb-Cl', to: 'Cl', bend: -1, why: 'Tail on the H–Cl bond, head on Cl: the bond breaks and both electrons go to Cl.' },
        ],
      },
      {
        title: 'Result', text: 'A new O–H bond and a chloride ion. The proton moved; the electrons that held it stayed on Cl.',
        pos: { O: O1, Ha: at(O1, 150, 58), Hb: at(O1, 30, 58), Cl: [500, 220] },
        bonds: 'Ha-O Hb-O', lp: { O: [-55, -125], Cl: [0, -90, 90, 180] }, charge: { Cl: [-1, -45] },
      },
    ],
  };
})();

const nucElec = (() => {
  const C = [470, 220], O = [280, 220];
  return {
    atoms: { Ho: 'H', O: 'O', C: 'C', Br: 'Br', H1: 'H', H2: 'H', H3: 'H' },
    states: [
      {
        title: 'Electron rich → electron poor', text: 'The nucleophile’s lone pair attacks the δ+ carbon. Arrows always point from the nucleophile to the electrophile.',
        pos: { O, Ho: at(O, 180, 56), C, Br: at(C, 0, 78), H1: at(C, -125, 64), H2: at(C, 160, 64), H3: at(C, 110, 64) },
        bonds: 'Ho-O C-Br C-H1 C>H2 C:H3', lp: { O: [0, -90, 90], Br: [0, -90, 90] }, charge: { O: [-1, -135] },
        tags: [[500, 188, 'δ+', 'delta'], [548, 186, 'δ−', 'delta'], [265, 160, 'nucleophile', 'key'], [520, 120, 'electrophile', 'key']],
        arrows: [{ from: 'lp:O:0', to: 'C', bend: 0.7, why: 'Lone pair (nucleophile) → δ+ carbon (electrophile).' }],
      },
    ],
  };
})();

const cationStability = (() => {
  const atoms = {}, pos = {}, tags = [];
  let bonds = '';
  const sets = [
    ['methyl', ['H', 'H', 'H']],
    ['1°', ['CH3', 'H', 'H']],
    ['2°', ['CH3', 'H', 'H3C']],
    ['3°', ['CH3', 'CH3', 'H3C']],
  ];
  const charge = {};
  sets.forEach(([name, subs], i) => {
    const c = [150 + i * 190, 210], id = `C${i}`;
    atoms[id] = 'C'; pos[id] = c; charge[id] = [1, 90];
    [-90, 30, 150].forEach((deg, j) => {
      const sid = `S${i}${j}`;
      atoms[sid] = subs[j];
      pos[sid] = at(c, deg, subs[j] === 'H' ? 58 : 66);
      bonds += ` ${id}-${sid}`;
    });
    tags.push([c[0], 315, name, 'key']);
  });
  tags.push([150, 352, 'least stable', 'note'], [720, 352, 'most stable', 'note'], [435, 352, '→ each alkyl group donates electron density →', 'note']);
  return {
    atoms,
    states: [{ title: 'Stability order', text: 'More alkyl groups on C⁺ means more stability: 3° > 2° > 1° > methyl.', pos, bonds, charge, tags }],
  };
})();

/* ---------------- Substitution ---------------- */

const sn2 = (() => {
  const C = [470, 220];
  return {
    atoms: { Ho: 'H', O: 'O', C: 'C', Br: 'Br', H: 'H', Me: 'CH3', Et: 'Et' },
    states: [
      {
        title: 'Backside attack', text: 'Hydroxide approaches from the side opposite Br, the only side where C–Br’s empty antibonding orbital is reachable.',
        pos: { O: [280, 220], Ho: [224, 220], C, Br: at(C, 0, 78), H: at(C, -125, 64), Me: at(C, 160, 68), Et: at(C, 110, 68) },
        bonds: 'Ho-O C-Br C-H C>Me C:Et', lp: { O: [0, -90, 90], Br: [0, -90, 90] }, charge: { O: [-1, -135] },
        tags: [[500, 188, 'δ+', 'delta']],
        arrows: [
          { from: 'lp:O:0', to: 'C', bend: 0.6, why: 'Nucleophile’s lone pair forms the new C–O bond.' },
          { from: 'bond:C-Br', to: 'Br', bend: -1, why: 'At the same moment, the C–Br electrons leave with bromide.' },
        ],
      },
      {
        title: 'Transition state ‡', text: 'One step, no intermediate. O–C forms while C–Br breaks; the three other groups flatten into a plane.',
        pos: { O: [360, 220], Ho: [304, 220], C, Br: [590, 220], H: at(C, -90, 64), Me: at(C, 140, 66), Et: at(C, 60, 66) },
        bonds: 'Ho-O O~C C~Br C-H C>Me C:Et', lp: { O: [-90, 90], Br: [0, -90, 90] },
        tags: [[360, 186, 'δ−', 'delta'], [590, 186, 'δ−', 'delta'], [270, 248, '[', 'bracket'], [672, 248, ']', 'bracket'], [690, 132, '‡', 'key']],
      },
      {
        title: 'Inversion', text: 'The groups flip like an umbrella in the wind (Walden inversion): R becomes S here, if nothing else changes priority.',
        pos: { O: [400, 220], Ho: [344, 220], C, Br: [660, 220], H: at(C, -55, 64), Me: at(C, 20, 68), Et: at(C, 70, 68) },
        bonds: 'Ho-O O-C C-H C>Me C:Et', lp: { O: [-90, 90], Br: [0, -90, 90, 180] }, charge: { Br: [-1, -45] },
      },
    ],
  };
})();

const sn1 = (() => {
  const C = [400, 220];
  const O1a = [600, 215], O1b = [540, 220], O1c = at(C, 0, 72), O2a = [700, 110], O2b = [590, 135];
  const water2 = (o) => ({ O2: o, Hc: at(o, -35, 52), Hd: at(o, -105, 52) });
  return {
    atoms: { C: 'C', M1: 'CH3', M2: 'CH3', M3: 'H3C', Br: 'Br', O1: 'O', Ha: 'H', Hb: 'H', O2: 'O', Hc: 'H', Hd: 'H' },
    states: [
      {
        title: 'Ionization (slow)', text: 'The C–Br bond breaks without help, giving a carbocation. Only the substrate is involved, so rate = k[RX].',
        pos: { C, M1: at(C, -115, 68), M2: at(C, 115, 68), M3: at(C, 180, 70), Br: at(C, 0, 76), O1: O1a, Ha: at(O1a, -35, 52), Hb: at(O1a, 35, 52), ...water2(O2a) },
        bonds: 'C-M1 C-M2 C-M3 C-Br O1-Ha O1-Hb O2-Hc O2-Hd',
        lp: { Br: [-90, 90, 0], O1: [150, -150], O2: [155, 75] },
        tags: [[400, 338, 'slow · rate-determining', 'key']],
        arrows: [{ from: 'bond:C-Br', to: 'Br', bend: -1, why: 'C–Br breaks on its own; bromide leaves with both electrons.' }],
      },
      {
        title: 'Carbocation', text: 'A flat 3° carbocation with an empty p orbital, open to attack from either face.',
        pos: { C, M1: at(C, -120, 68), M2: at(C, 120, 68), M3: at(C, 180, 70), Br: [670, 300], O1: O1b, Ha: at(O1b, -35, 52), Hb: at(O1b, 35, 52), ...water2(O2a) },
        bonds: 'C-M1 C-M2 C-M3 O1-Ha O1-Hb O2-Hc O2-Hd',
        lp: { Br: [0, 90, 180, -90], O1: [150, -150], O2: [155, 75] }, charge: { C: [1, -55], Br: [-1, -45] },
        tags: [[400, 338, 'planar · empty p orbital', 'note']],
        arrows: [{ from: 'lp:O1:0', to: 'C', bend: 1, why: 'Water, a weak nucleophile, gives a lone pair to the empty orbital on C⁺.' }],
      },
      {
        title: 'Oxonium ion', text: 'Oxygen now has three bonds and a + charge. A second water pulls off a proton.',
        pos: { C, M1: at(C, -115, 68), M2: at(C, 115, 68), M3: at(C, 180, 70), Br: [670, 300], O1: O1c, Ha: at(O1c, -50, 52), Hb: at(O1c, 50, 52), ...water2(O2b) },
        bonds: 'C-M1 C-M2 C-M3 C-O1 O1-Ha O1-Hb O2-Hc O2-Hd',
        lp: { Br: [0, 90, 180, -90], O1: [130], O2: [155, 75] }, charge: { O1: [1, -120], Br: [-1, -45] },
        arrows: [
          { from: 'lp:O2:0', to: 'Ha', bend: -1, why: 'A second water acts as a base and grabs the proton.' },
          { from: 'bond:O1-Ha', to: 'O1', bend: 1, why: 'The O–H electrons stay on oxygen, so its + charge goes away.' },
        ],
      },
      {
        title: 'Alcohol + H₃O⁺', text: 'Substitution done. Had C been a stereocenter, attack on both faces of the flat cation gives a racemic mixture.',
        pos: { C, M1: at(C, -115, 68), M2: at(C, 115, 68), M3: at(C, 180, 70), Br: [670, 300], O1: O1c, Ha: at(O2b, 155, 52), Hb: at(O1c, 50, 52), ...water2(O2b) },
        bonds: 'C-M1 C-M2 C-M3 C-O1 O1-Hb O2-Hc O2-Hd O2-Ha',
        lp: { Br: [0, 90, 180, -90], O1: [-60, 125], O2: [60] }, charge: { O2: [1, -150], Br: [-1, -45] },
      },
    ],
  };
})();

/* ---------------- Elimination ---------------- */

const e2 = (() => {
  const Cb = [400, 250], Ca = [470, 250], O0 = [400, 105], O1 = [395, 100];
  return {
    atoms: { Ca: 'C', Cb: 'C', Br: 'Br', Hb: 'H', Ha: 'H', Me: 'CH3', H2: 'H', H3: 'H', O: 'O', Ho: 'H' },
    states: [
      {
        title: 'One concerted step', text: 'The base pulls off a β-H while the C=C forms and Br leaves, all at once. H and Br must be anti-periplanar (on opposite sides).',
        pos: { Cb, Ca, Br: at(Ca, 90, 85), Hb: at(Cb, -90, 64), Ha: at(Ca, -50, 62), Me: at(Ca, 25, 70), H2: at(Cb, 150, 62), H3: at(Cb, -150, 62), O: O0, Ho: at(O0, -150, 52) },
        bonds: 'Cb-Ca Ca-Br Cb-Hb Ca-Ha Ca-Me Cb-H2 Cb-H3 O-Ho',
        lp: { O: [90, -40, 165], Br: [0, 180, 90] }, charge: { O: [-1, -90] },
        tags: [[436, 395, 'H and Br anti-periplanar (180°)', 'note']],
        arrows: [
          { from: 'lp:O:0', to: 'Hb', bend: 1, why: 'Strong base takes the β-hydrogen.' },
          { from: 'bond:Cb-Hb', to: 'mid:Cb-Ca', bend: 1, why: 'The C–H electrons move in to make the new π bond.' },
          { from: 'bond:Ca-Br', to: 'Br', bend: -1, why: 'Bromide leaves with the C–Br electrons.' },
        ],
      },
      {
        title: 'Alkene', text: 'Rate = k[RX][base]. With a small base the more substituted (Zaitsev) alkene is usually major; a bulky base like t-BuO⁻ favours the less substituted (Hofmann) alkene.',
        pos: { Cb, Ca, Br: [630, 300], Hb: at(O1, 70, 52), Ha: at(Ca, -60, 62), Me: at(Ca, 60, 68), H2: at(Cb, 120, 62), H3: at(Cb, -120, 62), O: O1, Ho: at(O1, -150, 52) },
        bonds: 'Cb=Ca Ca-Ha Ca-Me Cb-H2 Cb-H3 O-Ho O-Hb',
        lp: { O: [-50, 165], Br: [0, 90, 180, -90] }, charge: { Br: [-1, -45] },
      },
    ],
  };
})();

const e1 = (() => {
  const Ca = [470, 240], Cb = at(Ca, 180, 70), O = [320, 110];
  return {
    atoms: { Ca: 'C', Cb: 'C', Br: 'Br', M1: 'CH3', M2: 'CH3', Hb: 'H', H2: 'H', H3: 'H', O: 'O', Ho1: 'H', Ho2: 'H' },
    states: [
      {
        title: 'Ionization (slow)', text: 'Same first step as SN1: the leaving group departs and a carbocation forms. Rate = k[RX].',
        pos: { Ca, Cb, Br: at(Ca, 0, 76), M1: at(Ca, -90, 66), M2: at(Ca, 90, 66), Hb: at(Cb, -90, 62), H2: at(Cb, 150, 62), H3: at(Cb, -150, 62), O, Ho1: at(O, 180, 52), Ho2: at(O, 110, 52) },
        bonds: 'Ca-Cb Ca-Br Ca-M1 Ca-M2 Cb-Hb Cb-H2 Cb-H3 O-Ho1 O-Ho2',
        lp: { Br: [-90, 90, 0], O: [40, -60] },
        tags: [[470, 360, 'slow · rate-determining', 'key']],
        arrows: [{ from: 'bond:Ca-Br', to: 'Br', bend: -1, why: 'C–Br breaks on its own; bromide leaves.' }],
      },
      {
        title: 'Lose a β-H', text: 'A weak base (often just water or alcohol) removes an H from a carbon next to C⁺.',
        pos: { Ca, Cb, Br: [640, 310], M1: at(Ca, -60, 66), M2: at(Ca, 60, 66), Hb: at(Cb, -90, 62), H2: at(Cb, 150, 62), H3: at(Cb, -150, 62), O, Ho1: at(O, 180, 52), Ho2: at(O, 110, 52) },
        bonds: 'Ca-Cb Ca-M1 Ca-M2 Cb-Hb Cb-H2 Cb-H3 O-Ho1 O-Ho2',
        lp: { Br: [0, 90, 180, -90], O: [40, -60] }, charge: { Ca: [1, 0], Br: [-1, -45] },
        arrows: [
          { from: 'lp:O:0', to: 'Hb', bend: 1, why: 'Water uses a lone pair to take the β-hydrogen.' },
          { from: 'bond:Cb-Hb', to: 'mid:Cb-Ca', bend: 1, why: 'The C–H electrons swing in to form the π bond and cancel C⁺.' },
        ],
      },
      {
        title: 'Alkene', text: 'Heat favours E1 over SN1. Zaitsev product usually wins; watch for rearrangement of the carbocation first.',
        pos: { Ca, Cb, Br: [640, 310], M1: at(Ca, -60, 66), M2: at(Ca, 60, 66), Hb: at(O, 30, 52), H2: at(Cb, 120, 62), H3: at(Cb, -120, 62), O, Ho1: at(O, 180, 52), Ho2: at(O, 110, 52) },
        bonds: 'Ca=Cb Ca-M1 Ca-M2 Cb-H2 Cb-H3 O-Ho1 O-Ho2 O-Hb',
        lp: { Br: [0, 90, 180, -90], O: [-75] }, charge: { O: [1, -15], Br: [-1, -45] },
      },
    ],
  };
})();

/* ---------------- Alkene additions ---------------- */

const hbrAdd = (() => {
  const C2 = [420, 250], C1 = [490, 250];
  return {
    atoms: { C1: 'C', C2: 'C', C3: 'CH3', H1a: 'H', H1b: 'H', H2: 'H', Hx: 'H', Br: 'Br' },
    states: [
      {
        title: 'Protonate the π bond', text: 'The alkene is the nucleophile here. Its π electrons take H⁺ from HBr, putting the H on the CH₂ end.',
        pos: { C2, C1, H1a: at(C1, -60, 62), H1b: at(C1, 60, 62), H2: at(C2, -120, 62), C3: at(C2, 120, 68), Hx: [470, 150], Br: [470, 65] },
        bonds: 'C2=C1 C1-H1a C1-H1b C2-H2 C2-C3 Hx-Br', lp: { Br: [-90, 0, 180] },
        tags: [[560, 360, 'slow · rate-determining', 'key']],
        arrows: [
          { from: 'bond:C2-C1', to: 'Hx', bend: 1, why: 'π electrons form a C–H bond to C1, the carbon with more H’s.' },
          { from: 'bond:Hx-Br', to: 'Br', bend: -1, why: 'H–Br breaks; bromide leaves with both electrons.' },
        ],
      },
      {
        title: '2° carbocation', text: 'Putting H on C1 leaves the + on C2, which is secondary and more stable than the 1° alternative. That choice is Markovnikov’s rule.',
        pos: { C2, C1, H1a: at(C1, 10, 62), H1b: at(C1, 85, 62), H2: at(C2, -120, 62), C3: at(C2, 120, 68), Hx: at(C1, -75, 62), Br: [420, 120] },
        bonds: 'C2-C1 C1-H1a C1-H1b C2-H2 C2-C3 C1-Hx', lp: { Br: [90, 0, 180, -90] }, charge: { C2: [1, -65], Br: [-1, -45] },
        arrows: [{ from: 'lp:Br:0', to: 'C2', bend: 0.6, why: 'Bromide attacks the carbocation (fast).' }],
      },
      {
        title: 'Markovnikov product', text: 'H on the less substituted carbon, Br on the more substituted one. A new stereocenter forms as a racemic mixture.',
        pos: { C2, C1, H1a: at(C1, 10, 62), H1b: at(C1, 85, 62), H2: at(C2, 180, 62), C3: at(C2, 120, 68), Hx: at(C1, -75, 62), Br: at(C2, -90, 74) },
        bonds: 'C2-C1 C1-H1a C1-H1b C2-H2 C2-C3 C1-Hx C2-Br', lp: { Br: [0, 180, -90] },
      },
    ],
  };
})();

const hydrideShift = (() => {
  const C2 = [400, 240], C3 = [470, 240], Br0 = [610, 150];
  return {
    atoms: { C1: 'CH3', C2: 'C', H2: 'H', C3: 'C', Hs: 'H', Ma: 'CH3', Mb: 'CH3', Br: 'Br' },
    states: [
      {
        title: '2° carbocation next to a 3° C–H', text: 'The carbocation sits on C2, but the neighbouring carbon C3 is tertiary and carries an H.',
        pos: { C2, C3, H2: at(C2, -120, 62), C1: at(C2, 120, 68), Hs: at(C3, -90, 62), Ma: at(C3, 10, 70), Mb: at(C3, 95, 68), Br: Br0 },
        bonds: 'C2-C3 C2-H2 C2-C1 C3-Hs C3-Ma C3-Mb', lp: { Br: [147, 57, -33, -123] }, charge: { C2: [1, 180], Br: [-1, -45] },
        tags: [[470, 132, 'H on a 3° carbon', 'note'], [400, 360, '2° carbocation', 'key']],
        arrows: [{ from: 'bond:C3-Hs', to: 'C2', bend: -1, why: 'The H moves to C2 together with its bonding pair (a 1,2-hydride shift).' }],
      },
      {
        title: '3° carbocation', text: 'Now the + is on C3, a more stable tertiary carbon. The nucleophile reacts here.',
        pos: { C2, C3, H2: at(C2, -130, 62), C1: at(C2, 120, 68), Hs: at(C2, -60, 62), Ma: at(C3, -70, 68), Mb: at(C3, 70, 68), Br: Br0 },
        bonds: 'C2-C3 C2-H2 C2-C1 C2-Hs C3-Ma C3-Mb', lp: { Br: [147, 57, -33, -123] }, charge: { C3: [1, 5], Br: [-1, -45] },
        tags: [[470, 360, '3° carbocation · more stable', 'key']],
        arrows: [{ from: 'lp:Br:0', to: 'C3', bend: 1, why: 'Bromide attacks the rearranged 3° cation.' }],
      },
      {
        title: 'Rearranged product', text: 'Br ends up on a carbon that was never the original cation. That is the telltale sign of a shift.',
        pos: { C2, C3, H2: at(C2, -130, 62), C1: at(C2, 120, 68), Hs: at(C2, -60, 62), Ma: at(C3, -70, 68), Mb: at(C3, 70, 68), Br: at(C3, 0, 78) },
        bonds: 'C2-C3 C2-H2 C2-C1 C2-Hs C3-Ma C3-Mb C3-Br', lp: { Br: [-90, 90, 0] },
      },
    ],
  };
})();

const hydration = (() => {
  const C2 = [420, 260], C1 = [490, 260], Oa = [560, 120], Ow0 = [420, 135], Ow1 = at(C2, -90, 70);
  const base = { Oa, Ha1: at(Oa, 15, 52), Ha2: at(Oa, -105, 52) };
  return {
    atoms: { C1: 'C', C2: 'C', C3: 'CH3', H1a: 'H', H1b: 'H', H2: 'H', Hx: 'H', Oa: 'O', Ha1: 'H', Ha2: 'H', Ow: 'O', Hw1: 'H', Hw2: 'H' },
    states: [
      {
        title: 'Protonate the alkene', text: 'Same start as HBr addition: π electrons take H⁺, this time from H₃O⁺.',
        pos: { C2, C1, H1a: at(C1, -50, 62), H1b: at(C1, 60, 62), H2: at(C2, -120, 62), C3: at(C2, 120, 68), Hx: at(Oa, 135, 62), ...base, Ow: Ow0, Hw1: at(Ow0, -150, 52), Hw2: at(Ow0, -30, 52) },
        bonds: 'C2=C1 C1-H1a C1-H1b C2-H2 C2-C3 Oa-Hx Oa-Ha1 Oa-Ha2 Ow-Hw1 Ow-Hw2',
        lp: { Oa: [-45], Ow: [90, -90] }, charge: { Oa: [1, 195] },
        arrows: [
          { from: 'bond:C2-C1', to: 'Hx', bend: -1, why: 'π electrons bond to H⁺ at the CH₂ end (Markovnikov).' },
          { from: 'bond:Oa-Hx', to: 'Oa', bend: 1, why: 'The O–H electrons return to oxygen; H₃O⁺ becomes water.' },
        ],
      },
      {
        title: 'Water attacks C⁺', text: 'A water molecule, a weak nucleophile, gives a lone pair to the 2° carbocation.',
        pos: { C2, C1, H1a: at(C1, 10, 62), H1b: at(C1, 85, 62), H2: at(C2, -120, 62), C3: at(C2, 120, 68), Hx: at(C1, -80, 62), ...base, Ow: Ow0, Hw1: at(Ow0, -150, 52), Hw2: at(Ow0, -30, 52) },
        bonds: 'C2-C1 C1-H1a C1-H1b C2-H2 C2-C3 C1-Hx Oa-Ha1 Oa-Ha2 Ow-Hw1 Ow-Hw2',
        lp: { Oa: [-45, 150], Ow: [90, -90] }, charge: { C2: [1, -55] },
        arrows: [{ from: 'lp:Ow:0', to: 'C2', bend: 0.5, why: 'Lone pair on water → empty orbital of C⁺.' }],
      },
      {
        title: 'Deprotonate', text: 'The oxonium ion loses a proton to water, which turns back into H₃O⁺.',
        pos: { C2, C1, H1a: at(C1, 10, 62), H1b: at(C1, 85, 62), H2: at(C2, -160, 62), C3: at(C2, 120, 68), Hx: at(C1, -80, 62), ...base, Ow: Ow1, Hw1: at(Ow1, -150, 52), Hw2: at(Ow1, -30, 52) },
        bonds: 'C2-C1 C1-H1a C1-H1b C2-H2 C2-C3 C1-Hx Oa-Ha1 Oa-Ha2 C2-Ow Ow-Hw1 Ow-Hw2',
        lp: { Oa: [-45, 150], Ow: [-90] }, charge: { Ow: [1, 30] },
        arrows: [
          { from: 'lp:Oa:1', to: 'Hw2', bend: -1, why: 'Water (the base) takes a proton from the oxonium ion.' },
          { from: 'bond:Ow-Hw2', to: 'Ow', bend: -1, why: 'The O–H electrons stay on the alcohol oxygen.' },
        ],
      },
      {
        title: 'Markovnikov alcohol', text: 'OH ends up on the more substituted carbon. The acid is regenerated, so it is a catalyst. Carbocation, so rearrangements are possible.',
        pos: { C2, C1, H1a: at(C1, 10, 62), H1b: at(C1, 85, 62), H2: at(C2, -160, 62), C3: at(C2, 120, 68), Hx: at(C1, -80, 62), ...base, Hw2: at(Oa, 150, 52), Ow: Ow1, Hw1: at(Ow1, -150, 52) },
        bonds: 'C2-C1 C1-H1a C1-H1b C2-H2 C2-C3 C1-Hx Oa-Ha1 Oa-Ha2 Oa-Hw2 C2-Ow Ow-Hw1',
        lp: { Oa: [-45], Ow: [-80, 0] }, charge: { Oa: [1, 80] },
      },
    ],
  };
})();

const bromination = (() => {
  const C1 = [410, 260], C2 = [480, 260];
  const spread = { H1a: at(C1, -150, 62), H1b: at(C1, 150, 62), H2a: at(C2, -30, 62), H2b: at(C2, 30, 62) };
  return {
    atoms: { C1: 'C', C2: 'C', H1a: 'H', H1b: 'H', H2a: 'H', H2b: 'H', Bra: 'Br', Brb: 'Br' },
    states: [
      {
        title: 'Br₂ meets the π bond', text: 'As Br₂ nears the electron-rich alkene it polarises: the near Br becomes δ+.',
        pos: { C1, C2, ...spread, Bra: [445, 165], Brb: [445, 80] },
        bonds: 'C1=C2 C1-H1a C1-H1b C2-H2a C2-H2b Bra-Brb', lp: { Bra: [115, 0, 180], Brb: [-90, 0, 180] },
        tags: [[474, 160, 'δ+', 'delta'], [474, 76, 'δ−', 'delta']],
        arrows: [
          { from: 'bond:C1-C2', to: 'Bra', bend: -1, why: 'π electrons attack the near (δ+) bromine.' },
          { from: 'bond:Bra-Brb', to: 'Brb', bend: 1, why: 'Br–Br breaks; the far Br leaves as bromide.' },
          { from: 'lp:Bra:0', to: 'C1', bend: -1, why: 'At the same time, a lone pair on the near Br bonds to C1, closing a three-membered ring.' },
        ],
      },
      {
        title: 'Bromonium ion', text: 'Br⁺ bridges both carbons. No open carbocation forms, so there is no rearrangement, and the top face is blocked.',
        pos: { C1, C2, ...spread, Bra: [445, 192], Brb: [640, 250] },
        bonds: 'C1-C2 C1-H1a C1-H1b C2-H2a C2-H2b C1-Bra C2-Bra', lp: { Bra: [-140, -40], Brb: [180, 90, 0, -90] }, charge: { Bra: [1, -90], Brb: [-1, -45] },
        tags: [[445, 350, 'bridged: top face blocked', 'key']],
      },
      {
        title: 'Anti attack', text: 'Bromide has to come in from the bottom face, opposite the bridge, just like SN2 backside attack.',
        pos: { C1, C2, ...spread, Bra: [445, 192], Brb: [500, 385] },
        bonds: 'C1-C2 C1-H1a C1-H1b C2-H2a C2-H2b C1-Bra C2-Bra', lp: { Bra: [-140, -40], Brb: [-100, 0, 180, 90] }, charge: { Bra: [1, -90], Brb: [-1, -45] },
        arrows: [
          { from: 'lp:Brb:0', to: 'C2', bend: 1, why: 'Bromide attacks C2 from the face opposite the bridge.' },
          { from: 'bond:C2-Bra', to: 'Bra', bend: -1, why: 'The C2–Br⁺ bond opens; its electrons go back to Br, which stays on C1.' },
        ],
      },
      {
        title: 'Anti addition', text: 'The two Br atoms end up on opposite faces. On a ring this gives the trans-1,2-dibromide only.',
        pos: { C1, C2, ...spread, Bra: at(C1, -90, 75), Brb: at(C2, 90, 78) },
        bonds: 'C1-C2 C1-H1a C1-H1b C2-H2a C2-H2b C1-Bra C2-Brb', lp: { Bra: [0, 180, -90], Brb: [0, 180, 90] },
        tags: [[445, 400, 'one Br up, one Br down', 'note']],
      },
    ],
  };
})();

const radicalHBr = (() => {
  const C2 = [430, 290], C1 = [500, 290];
  const RO = { R: [250, 120], O: [310, 120] };
  return {
    atoms: { R: 'R', O: 'O', H: 'H', Br: 'Br', C1: 'C', C2: 'C', C3: 'CH3', H1a: 'H', H1b: 'H', H2: 'H', Hy: 'H', Bq: 'Br' },
    states: [
      {
        title: 'Initiation', text: 'Peroxide (ROOR) splits with heat or light into RO•. RO• takes an H atom from HBr, making Br•. Fishhooks move one electron each.',
        pos: { ...RO, H: [420, 120], Br: [490, 120], C2, C1, H1a: at(C1, -60, 62), H1b: at(C1, 60, 62), H2: at(C2, -120, 62), C3: at(C2, 120, 68), Hy: [330, 290], Bq: [245, 290] },
        bonds: 'R-O H-Br C2=C1 C1-H1a C1-H1b C2-H2 C2-C3 Hy-Bq',
        rad: { O: [0] }, lp: { O: [-90, 90], Br: [-90, 90, 0], Bq: [-90, 90, 180] },
        tags: [[300, 70, 'from ROOR + heat/light', 'note']],
        arrows: [
          { from: 'rad:O:0', to: 'mid:O-H', kind: 'fish', bend: 1, why: 'The unpaired electron on O goes toward the new O–H bond.' },
          { from: 'bond:H-Br', to: 'mid:O-H', kind: 'fish', bend: 1, why: 'One electron of H–Br joins it to complete the O–H bond.' },
          { from: 'bond:H-Br', to: 'Br', kind: 'fish', bend: 1, why: 'The other H–Br electron stays on Br, giving a bromine radical.' },
        ],
      },
      {
        title: 'Propagation 1', text: 'Br• adds to the CH₂ end so the new radical lands on the more substituted carbon (2° radical, more stable).',
        pos: { ...RO, H: [370, 120], Br: [470, 170], C2, C1, H1a: at(C1, -60, 62), H1b: at(C1, 60, 62), H2: at(C2, -120, 62), C3: at(C2, 120, 68), Hy: [330, 290], Bq: [245, 290] },
        bonds: 'R-O O-H C2=C1 C1-H1a C1-H1b C2-H2 C2-C3 Hy-Bq',
        rad: { Br: [76] }, lp: { O: [-90, 90], Br: [0, 180, -90], Bq: [-90, 90, 180] },
        arrows: [
          { from: 'rad:Br:0', to: 'mid:Br-C1', kind: 'fish', bend: 1, why: 'Br•’s single electron starts the new C–Br bond.' },
          { from: 'bond:C2-C1', to: 'mid:Br-C1', kind: 'fish', bend: 1, why: 'One π electron pairs with it to complete C–Br.' },
          { from: 'bond:C2-C1', to: 'C2', kind: 'fish', bend: 1, why: 'The other π electron stays on C2, now a carbon radical.' },
        ],
      },
      {
        title: 'Propagation 2', text: 'The carbon radical takes an H atom from another HBr, giving product and a fresh Br•.',
        pos: { ...RO, H: [370, 120], Br: at(C1, -90, 75), C2, C1, H1a: at(C1, 0, 62), H1b: at(C1, 90, 62), H2: at(C2, -120, 62), C3: at(C2, 120, 68), Hy: [335, 290], Bq: [250, 290] },
        bonds: 'R-O O-H C1-Br C2-C1 C1-H1a C1-H1b C2-H2 C2-C3 Hy-Bq',
        rad: { C2: [180] }, lp: { O: [-90, 90], Br: [0, 180, -90], Bq: [-90, 90, 180] },
        arrows: [
          { from: 'rad:C2:0', to: 'mid:C2-Hy', kind: 'fish', bend: -1, why: 'The radical electron on C2 starts a C–H bond.' },
          { from: 'bond:Hy-Bq', to: 'mid:C2-Hy', kind: 'fish', bend: -1, why: 'One H–Br electron completes it.' },
          { from: 'bond:Hy-Bq', to: 'Bq', kind: 'fish', bend: -1, why: 'The other stays on Br: a new Br• to keep the chain going.' },
        ],
      },
      {
        title: 'Anti-Markovnikov product', text: 'Br on the less substituted carbon, the opposite of ionic HBr addition. Only HBr does this; HCl and HI do not.',
        pos: { ...RO, H: [370, 120], Br: at(C1, -90, 75), C2, C1, H1a: at(C1, 0, 62), H1b: at(C1, 90, 62), H2: at(C2, -120, 62), C3: at(C2, 120, 68), Hy: at(C2, 180, 62), Bq: [270, 290] },
        bonds: 'R-O O-H C1-Br C2-C1 C1-H1a C1-H1b C2-H2 C2-C3 C2-Hy',
        rad: { Bq: [0] }, lp: { O: [-90, 90], Br: [0, 180, -90], Bq: [-90, 90, 180] },
        tags: [[270, 345, 'Br• → next cycle', 'key']],
      },
    ],
  };
})();

/* ---------------- Library ---------------- */

export const GROUPS = ['Foundations', 'Substitution', 'Elimination', 'Alkene additions', 'Alkene oxidation & reduction', 'Alkynes', 'Radicals', 'Choosing'];

const BASE_CONCEPTS = [
  {
    id: 'curved-arrows', group: 'Foundations', name: 'Curved arrows',
    summary: 'Curved arrows track electrons, never atoms. The tail sits on a lone pair or a bond; the head shows where those electrons end up: a new bond or a lone pair.',
    points: [
      'Full head = two electrons move (ionic, polar mechanisms).',
      'Half head (fishhook) = one electron moves (radical mechanisms).',
      'Arrows flow from electron rich to electron poor.',
      'Atoms keep their octet: if a bond forms to an atom that is already full, another bond to it must break.',
    ],
    watch: 'Never start an arrow at a positive charge or at an H atom. H⁺ has no electrons to give.',
    mech: curvedArrows,
  },
  {
    id: 'nuc-elec', group: 'Foundations', name: 'Nucleophiles & electrophiles',
    summary: 'A nucleophile has electrons to give (lone pair, π bond, negative charge). An electrophile is electron poor (δ+ carbon, C⁺, H of a strong acid).',
    points: [
      'Nucleophilicity rises with negative charge and polarizability: I⁻ > Br⁻ > Cl⁻ in protic solvent.',
      'Bulky bases (t-BuO⁻, LDA) are strong bases but poor nucleophiles.',
      'Good leaving groups are weak bases: I⁻ > Br⁻ > Cl⁻ ≫ F⁻; OH⁻ is bad unless protonated to H₂O.',
    ],
    watch: 'Basicity and nucleophilicity are related but different: basicity is about H⁺, nucleophilicity is about carbon.',
    mech: nucElec,
  },
  {
    id: 'cation-stability', group: 'Foundations', name: 'Carbocation stability',
    summary: 'Carbocations are stabilised by neighbouring alkyl groups (hyperconjugation and induction), so 3° > 2° > 1° > methyl. Allylic and benzylic cations are extra stable from resonance.',
    points: [
      'Any step that makes a carbocation is usually rate-determining.',
      'Methyl and 1° cations essentially never form in solution, so no SN1/E1 there.',
      'If a 1,2-shift gives a more stable cation, expect it to happen.',
    ],
    watch: 'Radicals follow the same order (3° > 2° > 1°), which is why radical HBr gives the anti-Markovnikov product.',
    mech: cationStability,
  },
  {
    id: 'sn2', group: 'Substitution', name: 'SN2',
    summary: 'Substitution, nucleophilic, bimolecular. One concerted step: the nucleophile attacks from the back as the leaving group leaves, and the carbon inverts.',
    points: [
      'Rate = k[substrate][nucleophile].',
      'Substrate: methyl > 1° > 2°. Never 3° (too crowded).',
      'Strong nucleophile, polar aprotic solvent (acetone, DMSO, DMF).',
      'Stereochem: complete inversion at the carbon attacked.',
    ],
    watch: 'Inversion of geometry doesn’t always flip the R/S label. Re-assign priorities with the new group.',
    mech: sn2,
  },
  {
    id: 'sn1', group: 'Substitution', name: 'SN1',
    summary: 'Substitution, nucleophilic, unimolecular. The leaving group leaves first to make a carbocation; then a weak nucleophile adds, often followed by a proton transfer.',
    points: [
      'Rate = k[substrate]; the nucleophile doesn’t appear.',
      'Substrate: 3° > 2° (also allylic/benzylic). Not methyl or 1°.',
      'Weak nucleophile, polar protic solvent (H₂O, ROH) that stabilises the ions.',
      'Stereochem: racemization (attack on both faces of the flat cation).',
      'Carbocation means rearrangements are possible.',
    ],
    watch: 'When the solvent is the nucleophile (solvolysis), you need an extra deprotonation step at the end.',
    mech: sn1,
  },
  {
    id: 'e2', group: 'Elimination', name: 'E2',
    summary: 'Elimination, bimolecular. One concerted step: a strong base removes a β-H while the C=C forms and the leaving group departs.',
    points: [
      'Rate = k[substrate][base].',
      'Needs a strong base (HO⁻, RO⁻, t-BuO⁻). Works on 1°, 2° and 3°.',
      'H and LG must be anti-periplanar; on cyclohexanes both must be axial.',
      'Small base → Zaitsev (more substituted). Bulky base → Hofmann (less substituted).',
    ],
    watch: 'On a cyclohexane, if there is no axial β-H anti to an axial LG, E2 cannot happen from that chair.',
    mech: e2,
  },
  {
    id: 'e1', group: 'Elimination', name: 'E1',
    summary: 'Elimination, unimolecular. The leaving group leaves to make a carbocation, then a weak base removes a neighbouring H to form the alkene.',
    points: [
      'Rate = k[substrate]. Competes with SN1 (same intermediate).',
      'Substrate: 3° > 2°. Weak base, polar protic solvent, heat.',
      'Zaitsev product usually major.',
      'Carbocation means rearrangements are possible.',
    ],
    watch: 'Alcohols with strong acid (H₂SO₄, heat) go E1 too: protonate OH first so water can leave.',
    mech: e1,
  },
  {
    id: 'hbr', group: 'Alkene additions', name: 'HX addition (Markovnikov)',
    summary: 'The π bond grabs H⁺ to form the more stable carbocation, then the halide adds to it. H goes to the carbon that already has more H’s.',
    points: [
      'Two steps: protonation (slow), then nucleophile attack (fast).',
      'Regiochemistry: Markovnikov, set by carbocation stability.',
      'Stereo: no control (racemic at any new stereocenter).',
      'Rearrangements possible.',
    ],
    watch: 'Markovnikov’s rule is a shortcut. The real reason is always “which carbocation is more stable?”',
    mech: hbrAdd,
  },
  {
    id: 'shift', group: 'Alkene additions', name: 'Carbocation rearrangement',
    summary: 'A carbocation can become more stable when an H (hydride shift) or a CH₃ (methyl shift) on the next carbon moves over with its electron pair.',
    points: [
      'Only 1,2-shifts (from the adjacent carbon).',
      'Happens whenever it gives a more stable cation: 2° → 3°, or 2° → allylic/benzylic.',
      'Shows up in SN1, E1, HX addition, acid-catalysed hydration.',
      'Never in SN2, E2, bromination, hydroboration or oxymercuration (no free carbocation).',
    ],
    watch: 'A 2° → 2° shift gains nothing; it isn’t expected to happen.',
    mech: hydrideShift,
  },
  {
    id: 'hydration', group: 'Alkene additions', name: 'Acid-catalyzed hydration',
    summary: 'Alkene + H₂O with acid (H₃O⁺ / H₂SO₄) → Markovnikov alcohol. Protonate, add water, deprotonate.',
    points: [
      'Three steps; the acid is regenerated (catalyst).',
      'Markovnikov OH; carbocation, so rearrangements possible.',
      'Reverse of E1 dehydration. Excess water pushes toward the alcohol; heat and removing water push toward the alkene.',
    ],
    watch: 'Oxymercuration also gives the Markovnikov alcohol but without rearrangement; hydroboration gives anti-Markovnikov.',
    mech: hydration,
  },
  {
    id: 'bromination', group: 'Alkene additions', name: 'Halogenation (Br₂)',
    summary: 'Br₂ adds across the C=C through a bridged bromonium ion. Bromide opens it from the opposite face, so the two Br add anti.',
    points: [
      'Bromonium (cyclic) intermediate: no carbocation, no rearrangement.',
      'Stereo: anti addition, so cycloalkenes give trans-dihalides.',
      'In water, H₂O opens the bromonium instead → halohydrin (OH on the more substituted C).',
    ],
    watch: 'Draw the bromonium with Br bonded to both carbons and a + on Br, not a free carbocation.',
    mech: bromination,
  },
  {
    id: 'radical-hbr', group: 'Alkene additions', name: 'Radical HBr (peroxides)',
    summary: 'With ROOR, HBr adds anti-Markovnikov through a radical chain. Br• adds first to give the more stable carbon radical, which then takes H from HBr.',
    points: [
      'Initiation → propagation (×2) → termination.',
      'Fishhook arrows: one electron each.',
      'Br goes to the less substituted carbon.',
      'Works for HBr only (not HCl or HI).',
    ],
    watch: 'Look for ROOR, hν or “peroxides” in the conditions. That is your cue to switch to the radical pathway.',
    mech: radicalHBr,
  },
  {
    id: 'choose', group: 'Choosing', name: 'SN1 vs SN2 vs E1 vs E2',
    summary: 'Decide from the substrate first, then the reagent (strong or weak, bulky or not), then the solvent and temperature.',
    points: [
      'Methyl / 1°: SN2, unless the base is bulky (t-BuO⁻) → E2.',
      '2°: strong base → E2; good nucleophile and weak base (I⁻, CN⁻, N₃⁻, RS⁻) in aprotic solvent → SN2; weak nucleophile in protic solvent → SN1/E1.',
      '3°: strong base → E2; weak nucleophile/base → SN1 (+E1, more with heat). Never SN2.',
      'Heat favours elimination.',
    ],
    watch: 'HO⁻ and RO⁻ are both strong nucleophiles and strong bases. On 2° and 3° substrates expect E2 to dominate.',
    table: {
      cols: ['', 'SN2', 'SN1', 'E2', 'E1'],
      rows: [
        ['Steps', 'one, concerted', 'two (C⁺)', 'one, concerted', 'two (C⁺)'],
        ['Rate law', 'k[RX][Nu]', 'k[RX]', 'k[RX][B]', 'k[RX]'],
        ['Substrate', 'Me > 1° > 2°', '3° > 2°', '3° > 2° > 1°', '3° > 2°'],
        ['Reagent', 'strong Nu', 'weak Nu', 'strong base', 'weak base'],
        ['Solvent', 'polar aprotic', 'polar protic', 'varies', 'polar protic'],
        ['Stereo', 'inversion', 'racemization', 'anti-periplanar', 'Zaitsev, mixed'],
        ['Rearranges?', 'no', 'yes', 'no', 'yes'],
      ],
    },
  },
];

export const CONCEPTS = [...BASE_CONCEPTS, ...MORE_CONCEPTS];
