// Reactions from Mullins Ch 8–11 slides (cross-checked against the course
// knowledge graph): the rest of the alkene additions, alkene oxidation and
// reduction, alkynes, and radical halogenation.
// Geometry format is documented at the top of engine.js.

const at = (c, deg, r = 66) => {
  const a = (deg * Math.PI) / 180;
  return [Math.round(c[0] + r * Math.cos(a)), Math.round(c[1] + r * Math.sin(a))];
};

/* ---------------- Alkene additions ---------------- */

const oxymercuration = (() => {
  const C2 = [420, 260], C1 = [490, 260], W0 = [400, 400], W1 = [400, 380];
  const sub = { H2: at(C2, -130, 62), C3: at(C2, 170, 68), H1a: at(C1, -20, 62), H1b: at(C1, 40, 62) };
  const water = (o) => ({ Ow: o, Hw1: at(o, 150, 52), Hw2: at(o, 30, 52) });
  const Hg = [455, 190], Xa = [455, 118], Ow3 = at(C2, 90, 72), Xb3 = [560, 410];
  return {
    atoms: { C1: 'C', C2: 'C', C3: 'CH3', H1a: 'H', H1b: 'H', H2: 'H', Hg: 'Hg', Xa: 'OAc', Xb: 'OAc', Ow: 'O', Hw1: 'H', Hw2: 'H', Hd: 'H' },
    states: [
      {
        title: 'Hg²⁺ meets the π bond', text: 'Mercury(II) acetate is the electrophile. The π electrons attack Hg as one acetate leaves.',
        pos: { C2, C1, ...sub, Hg: [455, 165], Xa: [375, 120], Xb: [540, 115], ...water(W0) },
        bonds: 'C2=C1 C1-H1a C1-H1b C2-H2 C2-C3 Hg-Xa Hg-Xb Ow-Hw1 Ow-Hw2',
        lp: { Ow: [-90, 90] },
        tags: [[455, 60, 'Hg(OAc)₂, H₂O', 'note']],
        arrows: [
          { from: 'bond:C2-C1', to: 'Hg', bend: -1, why: 'π electrons attack mercury, the electrophile.' },
          { from: 'bond:Hg-Xb', to: 'Xb', bend: 1, why: 'One Hg–OAc bond breaks; acetate leaves with both electrons.' },
        ],
      },
      {
        title: 'Mercurinium ion', text: 'Hg bridges both carbons, like a bromonium ion. No free carbocation, so no rearrangement. C2 is more substituted, so it carries more δ+.',
        pos: { C2, C1, ...sub, Hg, Xa, Xb: [620, 140], ...water(W1) },
        bonds: 'C2-C1 C1-H1a C1-H1b C2-H2 C2-C3 C1-Hg C2-Hg Hg-Xa Ow-Hw1 Ow-Hw2',
        lp: { Ow: [-82, 90] }, charge: { Hg: [1, 0], Xb: [-1, -45] },
        tags: [[448, 300, 'δ+', 'delta']],
        arrows: [
          { from: 'lp:Ow:0', to: 'C2', bend: 1, why: 'Water attacks C2, the more substituted carbon, from the face opposite Hg.' },
          { from: 'bond:C2-Hg', to: 'Hg', bend: -1, why: 'The C2–Hg bond opens; its electrons return to mercury.' },
        ],
      },
      {
        title: 'Deprotonate', text: 'Acetate (or water) removes a proton from the oxonium ion.',
        pos: { C2, C1, ...sub, Hg, Xa, Xb: Xb3, Ow: Ow3, Hw1: at(Ow3, 145, 52), Hw2: at(Ow3, 35, 52) },
        bonds: 'C2-C1 C1-H1a C1-H1b C2-H2 C2-C3 C1-Hg Hg-Xa C2-Ow Ow-Hw1 Ow-Hw2',
        lp: { Ow: [90], Xb: [-155] }, charge: { Ow: [1, -10], Xb: [-1, -70] },
        arrows: [
          { from: 'lp:Xb:0', to: 'Hw2', bend: 1, why: 'Acetate’s lone pair takes the proton.' },
          { from: 'bond:Ow-Hw2', to: 'Ow', bend: -1, why: 'The O–H electrons stay on oxygen, cancelling its + charge.' },
        ],
      },
      {
        title: 'Organomercury alcohol', text: 'OH sits on the more substituted carbon (Markovnikov) and HgOAc on the other; they added anti.',
        pos: { C2, C1, ...sub, Hg, Xa, Xb: Xb3, Ow: Ow3, Hw1: at(Ow3, 145, 52), Hw2: at(Xb3, -155, 55) },
        bonds: 'C2-C1 C1-H1a C1-H1b C2-H2 C2-C3 C1-Hg Hg-Xa C2-Ow Ow-Hw1 Xb-Hw2',
        lp: { Ow: [25, 85] },
        tags: [[455, 60, 'next: NaBH₄', 'note']],
      },
      {
        title: 'Demercuration (NaBH₄)', text: 'NaBH₄ swaps C–HgOAc for C–H. Net result: Markovnikov alcohol with no rearrangement.',
        pos: { C2, C1, ...sub, Hd: at(C1, -110, 62), Xb: Xb3, Ow: Ow3, Hw1: at(Ow3, 145, 52), Hw2: at(Xb3, -155, 55) },
        bonds: 'C2-C1 C1-H1a C1-H1b C2-H2 C2-C3 C1-Hd C2-Ow Ow-Hw1 Xb-Hw2',
        lp: { Ow: [25, 85] },
        tags: [[420, 455, 'Markovnikov alcohol · no shift', 'key']],
      },
    ],
  };
})();

const hydroboration = (() => {
  const C2 = [420, 260], C1 = [490, 260], B0 = [500, 150], B1 = [490, 180], B2 = at(C1, -90, 72);
  return {
    atoms: { C1: 'C', C2: 'C', C3: 'CH3', H1a: 'H', H1b: 'H', H2: 'H', B: 'B', Hb1: 'H', Hb2: 'H', Hb3: 'H', Oh: 'OH' },
    states: [
      {
        title: 'B–H meets the π bond', text: 'Boron has an empty p orbital, so BH₃ is an electrophile. It lines up with B over the less hindered CH₂ carbon.',
        pos: { C2, C1, H1a: at(C1, -30, 62), H1b: at(C1, 40, 62), H2: at(C2, -150, 62), C3: at(C2, 140, 68), B: B0, Hb1: [430, 150], Hb2: at(B0, -40, 58), Hb3: at(B0, -120, 58) },
        bonds: 'C2=C1 C1-H1a C1-H1b C2-H2 C2-C3 B-Hb1 B-Hb2 B-Hb3',
        tags: [[455, 60, 'BH₃·THF', 'note']],
        arrows: [
          { from: 'bond:C2-C1', to: 'B', bend: -1, why: 'π electrons flow into boron’s empty p orbital, starting the C1–B bond.' },
          { from: 'bond:B-Hb1', to: 'C2', bend: -1, why: 'At the same moment H moves from B to C2 with its bonding pair (as a hydride).' },
        ],
      },
      {
        title: 'Four-centre transition state ‡', text: 'C–B and C–H form while the π and B–H bonds break, all in one step. No carbocation, so no rearrangement.',
        pos: { C2, C1, H1a: at(C1, -20, 62), H1b: at(C1, 50, 62), H2: at(C2, -160, 62), C3: at(C2, 130, 68), B: B1, Hb1: [425, 180], Hb2: at(B1, -30, 58), Hb3: at(B1, -110, 58) },
        bonds: 'C2-C1 C1~B C2~Hb1 B~Hb1 C1-H1a C1-H1b C2-H2 C2-C3 B-Hb2 B-Hb3',
        tags: [[590, 160, '‡', 'key'], [400, 300, 'δ+', 'delta'], [525, 200, 'δ−', 'delta']],
      },
      {
        title: 'Alkylborane', text: 'H and B added to the same face (syn), with B on the less substituted carbon. R–BH₂ reacts twice more to give R₃B.',
        pos: { C2, C1, H1a: at(C1, 10, 62), H1b: at(C1, 80, 62), H2: at(C2, 180, 62), C3: at(C2, 120, 68), B: B2, Hb1: at(C2, -90, 62), Hb2: at(B2, -130, 58), Hb3: at(B2, -40, 58) },
        bonds: 'C2-C1 C1-B C2-Hb1 C1-H1a C1-H1b C2-H2 C2-C3 B-Hb2 B-Hb3',
        tags: [[455, 60, 'next: H₂O₂, NaOH', 'note']],
      },
      {
        title: 'Oxidation (H₂O₂, NaOH)', text: 'Hydroperoxide replaces boron with OH in the same position and on the same face. Net: anti-Markovnikov alcohol, syn addition.',
        pos: { C2, C1, H1a: at(C1, 10, 62), H1b: at(C1, 80, 62), H2: at(C2, 180, 62), C3: at(C2, 120, 68), Oh: at(C1, -90, 70), Hb1: at(C2, -90, 62) },
        bonds: 'C2-C1 C1-Oh C2-Hb1 C1-H1a C1-H1b C2-H2 C2-C3',
        tags: [[455, 400, 'anti-Markovnikov alcohol · no shift', 'key']],
      },
    ],
  };
})();

const etherAdd = (() => {
  const C2 = [420, 260], C1 = [490, 260], Oa = [560, 120], Ow0 = [420, 135], Ow1 = at(C2, -90, 70);
  const base = { Oa, Ha1: at(Oa, 15, 62), Ha2: at(Oa, -105, 52) };
  return {
    atoms: { C1: 'C', C2: 'C', C3: 'CH3', H1a: 'H', H1b: 'H', H2: 'H', Hx: 'H', Oa: 'O', Ha1: 'CH3', Ha2: 'H', Ow: 'O', Hw1: 'CH3', Hw2: 'H' },
    states: [
      {
        title: 'Protonate the alkene', text: 'Same start as hydration, but in methanol: π electrons take H⁺ from protonated methanol (made by H₂SO₄).',
        pos: { C2, C1, H1a: at(C1, -50, 62), H1b: at(C1, 60, 62), H2: at(C2, -120, 62), C3: at(C2, 120, 68), Hx: at(Oa, 135, 62), ...base, Ow: Ow0, Hw1: at(Ow0, -150, 62), Hw2: at(Ow0, -30, 52) },
        bonds: 'C2=C1 C1-H1a C1-H1b C2-H2 C2-C3 Oa-Hx Oa-Ha1 Oa-Ha2 Ow-Hw1 Ow-Hw2',
        lp: { Oa: [-45], Ow: [90, -90] }, charge: { Oa: [1, 195] },
        arrows: [
          { from: 'bond:C2-C1', to: 'Hx', bend: -1, why: 'π electrons bond to H⁺ at the CH₂ end (Markovnikov).' },
          { from: 'bond:Oa-Hx', to: 'Oa', bend: 1, why: 'The O–H electrons return to oxygen.' },
        ],
      },
      {
        title: 'Alcohol attacks C⁺', text: 'Methanol, the solvent, is the nucleophile instead of water.',
        pos: { C2, C1, H1a: at(C1, 10, 62), H1b: at(C1, 85, 62), H2: at(C2, -120, 62), C3: at(C2, 120, 68), Hx: at(C1, -80, 62), ...base, Ow: Ow0, Hw1: at(Ow0, -150, 62), Hw2: at(Ow0, -30, 52) },
        bonds: 'C2-C1 C1-H1a C1-H1b C2-H2 C2-C3 C1-Hx Oa-Ha1 Oa-Ha2 Ow-Hw1 Ow-Hw2',
        lp: { Oa: [-45, 150], Ow: [90, -90] }, charge: { C2: [1, -55] },
        arrows: [{ from: 'lp:Ow:0', to: 'C2', bend: 0.5, why: 'Lone pair on the alcohol O → empty orbital of C⁺.' }],
      },
      {
        title: 'Deprotonate', text: 'Another methanol takes the proton off the oxonium ion.',
        pos: { C2, C1, H1a: at(C1, 10, 62), H1b: at(C1, 85, 62), H2: at(C2, -160, 62), C3: at(C2, 120, 68), Hx: at(C1, -80, 62), ...base, Ow: Ow1, Hw1: at(Ow1, -150, 62), Hw2: at(Ow1, -30, 52) },
        bonds: 'C2-C1 C1-H1a C1-H1b C2-H2 C2-C3 C1-Hx Oa-Ha1 Oa-Ha2 C2-Ow Ow-Hw1 Ow-Hw2',
        lp: { Oa: [-45, 150], Ow: [-90] }, charge: { Ow: [1, 30] },
        arrows: [
          { from: 'lp:Oa:1', to: 'Hw2', bend: -1, why: 'Methanol (the base) takes the proton.' },
          { from: 'bond:Ow-Hw2', to: 'Ow', bend: -1, why: 'The O–H electrons stay on the ether oxygen.' },
        ],
      },
      {
        title: 'Markovnikov ether', text: 'OCH₃ ends up on the more substituted carbon. The acid is regenerated. Carbocation, so rearrangements are possible.',
        pos: { C2, C1, H1a: at(C1, 10, 62), H1b: at(C1, 85, 62), H2: at(C2, -160, 62), C3: at(C2, 120, 68), Hx: at(C1, -80, 62), ...base, Hw2: at(Oa, 150, 52), Ow: Ow1, Hw1: at(Ow1, -150, 62) },
        bonds: 'C2-C1 C1-H1a C1-H1b C2-H2 C2-C3 C1-Hx Oa-Ha1 Oa-Ha2 Oa-Hw2 C2-Ow Ow-Hw1',
        lp: { Oa: [-45], Ow: [-80, 0] }, charge: { Oa: [1, 80] },
      },
    ],
  };
})();

const halohydrin = (() => {
  const C2 = [410, 260], C1 = [480, 260], W1 = [395, 375], W2 = [560, 410];
  const c2 = { H2: at(C2, -150, 62), C3: at(C2, 150, 68) };
  const c1a = { H1a: at(C1, -30, 62), H1b: at(C1, 30, 62) }, c1b = { H1a: at(C1, -10, 62), H1b: at(C1, 60, 62) };
  const w2 = { Ow2: W2, Hy1: at(W2, -20, 52), Hy2: at(W2, 60, 52) };
  const W0 = [380, 395], Ow3 = at(C2, 90, 72);
  const water = (o) => ({ Ow: o, Hw1: at(o, 150, 52), Hw2: at(o, 30, 52) });
  const Br1 = at(C1, -90, 75);
  return {
    atoms: { C1: 'C', C2: 'C', C3: 'CH3', H1a: 'H', H1b: 'H', H2: 'H', Bra: 'Br', Brb: 'Br', Ow: 'O', Hw1: 'H', Hw2: 'H', Ow2: 'O', Hy1: 'H', Hy2: 'H' },
    states: [
      {
        title: 'Br₂ meets the π bond (in water)', text: 'Same first step as bromination: the alkene attacks Br₂ and a bromonium ion forms.',
        pos: { C2, C1, ...c2, ...c1a, Bra: [445, 165], Brb: [445, 80], ...water(W0), ...w2 },
        bonds: 'C2=C1 C1-H1a C1-H1b C2-H2 C2-C3 Bra-Brb Ow-Hw1 Ow-Hw2 Ow2-Hy1 Ow2-Hy2',
        lp: { Bra: [115, 0, 180], Brb: [-90, 0, 180], Ow: [-80, 90], Ow2: [-150, 150] },
        tags: [[474, 160, 'δ+', 'delta'], [474, 76, 'δ−', 'delta']],
        arrows: [
          { from: 'bond:C2-C1', to: 'Bra', bend: -1, why: 'π electrons attack the near (δ+) bromine.' },
          { from: 'bond:Bra-Brb', to: 'Brb', bend: 1, why: 'Br–Br breaks; the far Br leaves as bromide.' },
          { from: 'lp:Bra:0', to: 'C2', bend: -1, why: 'A lone pair on the near Br bonds back to the other carbon, closing the ring.' },
        ],
      },
      {
        title: 'Water opens the bromonium', text: 'Water is the solvent, so it vastly outnumbers Br⁻. It attacks the more substituted carbon, which carries more of the + charge.',
        pos: { C2, C1, ...c2, ...c1a, Bra: [445, 192], Brb: [640, 250], ...water(W1), ...w2 },
        bonds: 'C2-C1 C1-H1a C1-H1b C2-H2 C2-C3 C1-Bra C2-Bra Ow-Hw1 Ow-Hw2 Ow2-Hy1 Ow2-Hy2',
        lp: { Bra: [-140, -40], Brb: [180, 90, 0, -90], Ow: [-82, 90], Ow2: [-150, 150] }, charge: { Bra: [1, -90], Brb: [-1, -45] },
        arrows: [
          { from: 'lp:Ow:0', to: 'C2', bend: 1, why: 'Water attacks C2 from the bottom face, opposite the bridge.' },
          { from: 'bond:C2-Bra', to: 'Bra', bend: -1, why: 'The C2–Br bond opens; Br stays on C1.' },
        ],
      },
      {
        title: 'Deprotonate', text: 'A second water removes the extra proton from the oxonium ion.',
        pos: { C2, C1, ...c2, ...c1b, Bra: Br1, Brb: [640, 250], ...water(Ow3), ...w2 },
        bonds: 'C2-C1 C1-H1a C1-H1b C2-H2 C2-C3 C1-Bra C2-Ow Ow-Hw1 Ow-Hw2 Ow2-Hy1 Ow2-Hy2',
        lp: { Bra: [0, 180, -90], Brb: [180, 90, 0, -90], Ow: [90], Ow2: [-150, 150] }, charge: { Ow: [1, -30], Brb: [-1, -45] },
        arrows: [
          { from: 'lp:Ow2:0', to: 'Hw2', bend: 1, why: 'Water acts as a base and takes the proton.' },
          { from: 'bond:Ow-Hw2', to: 'Ow', bend: -1, why: 'The O–H electrons stay on oxygen.' },
        ],
      },
      {
        title: 'Bromohydrin', text: 'Br and OH on neighbouring carbons, added anti. OH is on the more substituted carbon.',
        pos: { C2, C1, ...c2, ...c1b, Bra: Br1, Brb: [640, 250], Ow: Ow3, Hw1: at(Ow3, 150, 52), Hw2: at(W2, -150, 52), ...w2 },
        bonds: 'C2-C1 C1-H1a C1-H1b C2-H2 C2-C3 C1-Bra C2-Ow Ow-Hw1 Ow2-Hw2 Ow2-Hy1 Ow2-Hy2',
        lp: { Bra: [0, 180, -90], Brb: [180, 90, 0, -90], Ow: [20, 80], Ow2: [120] }, charge: { Ow2: [1, -85], Brb: [-1, -45] },
        tags: [[445, 470, 'anti · OH on the more substituted C', 'key']],
      },
    ],
  };
})();

/* ---------------- Alkene oxidation & reduction ---------------- */

const epoxidation = (() => {
  const C1 = [410, 280], C2 = [480, 280];
  const sub = { Ha: at(C1, -150, 62), Ma: at(C1, 150, 68), Hb: at(C2, -30, 62), Mb: at(C2, 30, 68) };
  const Cc = [650, 120], Oc = at(Cc, -150, 68);
  return {
    atoms: { C1: 'C', C2: 'C', Ha: 'H', Ma: 'H3C', Hb: 'H', Mb: 'CH3', Ob: 'O', Oa: 'O', Cc: 'C', Oc: 'O', Hp: 'H', R: 'R' },
    states: [
      {
        title: 'Peroxyacid meets the alkene', text: 'mCPBA has a weak O–O bond. Its outer O is electrophilic. Everything happens in one concerted step (the “butterfly”).',
        pos: { C1, C2, ...sub, Ob: [445, 185], Oa: [520, 170], Cc: [560, 105], Oc: [495, 70], Hp: [440, 123], R: at([560, 105], -20, 62) },
        bonds: 'C1=C2 C1-Ha C1-Ma C2-Hb C2-Mb Ob-Oa Oa-Cc Cc=Oc Cc-R Ob-Hp',
        lp: { Ob: [165, 75], Oa: [40, 110], Oc: [-110, -170] },
        tags: [[445, 390, 'cis-2-butene + RCO₃H', 'note']],
        arrows: [
          { from: 'bond:C1-C2', to: 'Ob', bend: 1, why: 'The π bond attacks the outer, electrophilic oxygen.' },
          { from: 'bond:Ob-Oa', to: 'mid:Oa-Cc', bend: -1, why: 'The weak O–O bond breaks; its electrons become a new C=O π bond.' },
          { from: 'bond:Cc-Oc', to: 'Hp', bend: 1, why: 'The old C=O π electrons grab the acidic H.' },
          { from: 'bond:Ob-Hp', to: 'mid:C1-Ob', bend: -1, why: 'The O–H electrons form the second C–O bond, closing the ring.' },
        ],
      },
      {
        title: 'Epoxide + carboxylic acid', text: 'Both C–O bonds formed on the same face: syn addition. No carbocation, so no rearrangement, and cis stays cis.',
        pos: { C1, C2, ...sub, Ob: [445, 215], Cc, Oa: at(Cc, 120, 68), Oc, Hp: at(Oc, 180, 55), R: at(Cc, 0, 62) },
        bonds: 'C1-C2 C1-Ha C1-Ma C2-Hb C2-Mb C1-Ob C2-Ob Oa=Cc Cc-Oc Cc-R Oc-Hp',
        lp: { Ob: [-60, -120], Oa: [60, 180], Oc: [-100, 100] },
        tags: [[445, 390, 'cis-epoxide · syn addition', 'key']],
      },
    ],
  };
})();

const epoxideOpening = (() => {
  const C1 = [410, 260], C2 = [480, 260], Oe0 = [445, 195];
  const s1 = { Ha: at(C1, -150, 62), Ma: at(C1, 150, 68) };
  const s2a = { Hb: at(C2, -30, 62), Mb: at(C2, 30, 68) }, s2b = { Hb: at(C2, -60, 62), Mb: at(C2, 10, 68) };
  const OaA = [445, 75], OaB = [570, 95], OaC = [620, 330], W = [500, 380], Ow3 = at(C2, 90, 72), Oe3 = at(C1, -90, 70);
  const water = (o) => ({ Ow: o, Hw1: at(o, 150, 52), Hw2: at(o, 30, 52) });
  return {
    atoms: { C1: 'C', C2: 'C', Ha: 'H', Ma: 'H3C', Hb: 'H', Mb: 'CH3', Oe: 'O', Hx: 'H', Oa: 'O', Ha1: 'H', Ha2: 'H', Ow: 'O', Hw1: 'H', Hw2: 'H' },
    states: [
      {
        title: 'Protonate the epoxide', text: 'The epoxide O takes H⁺ from H₃O⁺. Now it is a much better leaving group, and the strained ring is ready to open.',
        pos: { C1, C2, ...s1, ...s2a, Oe: Oe0, Oa: OaA, Hx: [445, 130], Ha1: at(OaA, -30, 52), Ha2: at(OaA, -150, 52), ...water(W) },
        bonds: 'C1-C2 C1-Oe C2-Oe C1-Ha C1-Ma C2-Hb C2-Mb Oa-Hx Oa-Ha1 Oa-Ha2 Ow-Hw1 Ow-Hw2',
        lp: { Oe: [-135, -45], Oa: [-90], Ow: [-100, 90] }, charge: { Oa: [1, 150] },
        arrows: [
          { from: 'lp:Oe:0', to: 'Hx', bend: 1, why: 'An epoxide lone pair takes the proton.' },
          { from: 'bond:Oa-Hx', to: 'Oa', bend: 1, why: 'H₃O⁺ becomes water.' },
        ],
      },
      {
        title: 'Backside attack', text: 'Water attacks a ring carbon from the face opposite the O, just like SN2. (If the ring is unsymmetrical, the more substituted carbon is attacked.)',
        pos: { C1, C2, ...s1, ...s2a, Oe: Oe0, Hx: at(Oe0, -90, 55), Oa: OaB, Ha1: at(OaB, -30, 52), Ha2: at(OaB, -150, 52), ...water(W) },
        bonds: 'C1-C2 C1-Oe C2-Oe C1-Ha C1-Ma C2-Hb C2-Mb Oe-Hx Oa-Ha1 Oa-Ha2 Ow-Hw1 Ow-Hw2',
        lp: { Oe: [-15], Oa: [60, 120], Ow: [-100, 90] }, charge: { Oe: [1, -165] },
        arrows: [
          { from: 'lp:Ow:0', to: 'C2', bend: 1, why: 'Water attacks C2 from the bottom, opposite the epoxide O.' },
          { from: 'bond:C2-Oe', to: 'Oe', bend: -1, why: 'The C2–O bond breaks; the ring opens and O stays on C1.' },
        ],
      },
      {
        title: 'Deprotonate', text: 'A water molecule removes the extra proton.',
        pos: { C1, C2, ...s1, ...s2b, Oe: Oe3, Hx: at(Oe3, -30, 55), Oa: OaC, Ha1: at(OaC, -50, 52), Ha2: at(OaC, 50, 52), ...water(Ow3) },
        bonds: 'C1-C2 C1-Oe C2-Ow C1-Ha C1-Ma C2-Hb C2-Mb Oe-Hx Oa-Ha1 Oa-Ha2 Ow-Hw1 Ow-Hw2',
        lp: { Oe: [-130, 170], Oa: [165, -120], Ow: [90] }, charge: { Ow: [1, -30] },
        arrows: [
          { from: 'lp:Oa:0', to: 'Hw2', bend: -1, why: 'Water acts as a base.' },
          { from: 'bond:Ow-Hw2', to: 'Ow', bend: 1, why: 'The O–H electrons stay on the new OH.' },
        ],
      },
      {
        title: 'trans-Diol', text: 'One OH came from the epoxide (top face), one from water (bottom face): anti addition overall. Compare OsO₄, which gives the cis-diol.',
        pos: { C1, C2, ...s1, ...s2b, Oe: Oe3, Hx: at(Oe3, -30, 55), Oa: OaC, Ha1: at(OaC, -50, 52), Ha2: at(OaC, 50, 52), Hw2: at(OaC, 165, 52), Ow: Ow3, Hw1: at(Ow3, 150, 52) },
        bonds: 'C1-C2 C1-Oe C2-Ow C1-Ha C1-Ma C2-Hb C2-Mb Oe-Hx Oa-Ha1 Oa-Ha2 Oa-Hw2 Ow-Hw1',
        lp: { Oe: [-130, 170], Oa: [-120], Ow: [20, 80] }, charge: { Oa: [1, 110] },
        tags: [[445, 450, 'OH up on C1, OH down on C2: trans (anti)', 'key']],
      },
    ],
  };
})();

const dihydroxylation = (() => {
  const C1 = [410, 290], C2 = [480, 290], Os0 = [445, 140], Os1 = [445, 158];
  const sub = { Ha: at(C1, -160, 62), Ma: at(C1, 140, 68), Hb: at(C2, -20, 62), Mb: at(C2, 40, 68) };
  const Oa1 = at(C1, -90, 70), Ob1 = at(C2, -90, 70);
  return {
    atoms: { C1: 'C', C2: 'C', Ha: 'H', Ma: 'H3C', Hb: 'H', Mb: 'CH3', Os: 'Os', Oa: 'O', Ob: 'O', Oc: 'O', Od: 'O', Hc: 'H', Hd: 'H' },
    states: [
      {
        title: 'OsO₄ adds in one step', text: 'Two Os=O oxygens add to both alkene carbons at once through a cyclic, six-electron transition state.',
        pos: { C1, C2, ...sub, Os: Os0, Oa: at(Os0, 135, 68), Ob: at(Os0, 45, 68), Oc: at(Os0, -135, 68), Od: at(Os0, -45, 68) },
        bonds: 'C1=C2 C1-Ha C1-Ma C2-Hb C2-Mb Os=Oa Os=Ob Os=Oc Os=Od',
        lp: { Oa: [180, 90], Ob: [0, 90], Oc: [-150, 135], Od: [-30, 45] },
        arrows: [
          { from: 'bond:C1-C2', to: 'mid:C1-Oa', bend: 1, why: 'π electrons attack one oxygen, forming C1–O.' },
          { from: 'bond:Os-Oa', to: 'Os', bend: -1, why: 'That Os=O π bond shifts its electrons onto osmium.' },
          { from: 'bond:Os-Ob', to: 'mid:Ob-C2', bend: 1, why: 'A second Os=O π bond swings down to form C2–O.' },
        ],
      },
      {
        title: 'Cyclic osmate ester', text: 'Both new C–O bonds are on the same face (syn). Osmium went from +8 to +6.',
        pos: { C1, C2, ...sub, Os: Os1, Oa: Oa1, Ob: Ob1, Oc: at(Os1, -135, 66), Od: at(Os1, -45, 66) },
        bonds: 'C1-C2 C1-Ha C1-Ma C2-Hb C2-Mb C1-Oa C2-Ob Os-Oa Os-Ob Os=Oc Os=Od',
        lp: { Oa: [180, -150], Ob: [0, -30], Oc: [-150, 135], Od: [-30, 45] },
        tags: [[445, 395, 'next: NaHSO₃ / H₂O cleaves the Os–O bonds', 'note']],
      },
      {
        title: 'cis-Diol', text: 'Both OH groups on the same face: syn dihydroxylation. Cold, dilute KMnO₄ (with NaOH) does the same through a manganate ester.',
        pos: { C1, C2, ...sub, Oa: Oa1, Ob: Ob1, Hc: at(Oa1, -120, 55), Hd: at(Ob1, -60, 55) },
        bonds: 'C1-C2 C1-Ha C1-Ma C2-Hb C2-Mb C1-Oa C2-Ob Oa-Hc Ob-Hd',
        lp: { Oa: [170, -40], Ob: [10, -140] },
        tags: [[445, 395, 'both OH on one face: cis (syn) diol', 'key']],
      },
    ],
  };
})();

const ozonolysis = (() => {
  const A1 = [410, 290], A2 = [480, 290]; // alkene + molozonide
  const F1 = [380, 280], F2 = [530, 300]; // fragments
  const Z1 = [400, 280], Z2 = [490, 280]; // ozonide
  const P1 = [360, 280], P2 = [580, 280]; // products
  const Fc = at(F2, -110, 70);
  return {
    atoms: { C1: 'C', C2: 'C', Ma: 'H3C', Mb: 'H3C', Hb: 'H', Mc: 'CH3', Oa: 'O', Ob: 'O', Oc: 'O' },
    states: [
      {
        title: 'Ozone adds across the π bond', text: 'O₃ is a 1,3-dipole. Its two ends bond to both alkene carbons in one concerted step.',
        pos: { C1: A1, C2: A2, Ma: at(A1, 150, 68), Mb: at(A1, -150, 68), Hb: at(A2, -30, 62), Mc: at(A2, 30, 68), Oa: [400, 170], Ob: [445, 130], Oc: [490, 170] },
        bonds: 'C1=C2 C1-Ma C1-Mb C2-Hb C2-Mc Oa=Ob Ob-Oc',
        lp: { Oa: [-150, 150], Ob: [-90], Oc: [90, 0, -70] }, charge: { Ob: [1, -30], Oc: [-1, 150] },
        tags: [[445, 60, '1. O₃, −78 °C', 'note']],
        arrows: [
          { from: 'lp:Oc:0', to: 'C2', bend: 1, why: 'The O⁻ end gives a lone pair to C2.' },
          { from: 'bond:C2-C1', to: 'mid:C1-Oa', bend: 1, why: 'The π electrons form a bond from C1 to the other end of ozone.' },
          { from: 'bond:Oa-Ob', to: 'Ob', bend: -1, why: 'The O=O π electrons move onto the central O⁺, neutralising it.' },
        ],
      },
      {
        title: 'Molozonide', text: 'A five-membered ring with two weak O–O bonds. It is unstable and falls apart right away.',
        pos: { C1: A1, C2: A2, Ma: at(A1, 150, 68), Mb: at(A1, -150, 68), Hb: at(A2, -30, 62), Mc: at(A2, 30, 68), Oa: at(A1, -110, 70), Ob: [445, 185], Oc: at(A2, -70, 70) },
        bonds: 'C1-C2 C1-Ma C1-Mb C2-Hb C2-Mc C1-Oa Oa-Ob Ob-Oc Oc-C2',
        lp: { Oa: [180, -110], Ob: [-60, -120], Oc: [0, -70] },
        arrows: [
          { from: 'lp:Oc:0', to: 'mid:Oc-C2', bend: -1, why: 'A lone pair on O makes a C2=O⁺ double bond…' },
          { from: 'bond:C1-C2', to: 'mid:C1-Oa', bend: 1, why: '…the C–C bond breaks and its electrons make C1=O…' },
          { from: 'bond:Oa-Ob', to: 'Ob', bend: 1, why: '…and the weak O–O bond breaks, leaving O⁻.' },
        ],
      },
      {
        title: 'Carbonyl + carbonyl oxide', text: 'The two pieces flip 180° and recombine the other way round.',
        pos: { C1: F1, C2: F2, Ma: at(F1, 170, 68), Mb: at(F1, -120, 68), Hb: at(F2, 10, 62), Mc: at(F2, 130, 68), Oa: at(F1, 40, 70), Oc: Fc, Ob: at(Fc, -170, 66) },
        bonds: 'C1=Oa C1-Ma C1-Mb C2-Hb C2-Mc C2=Oc Oc-Ob',
        lp: { Oa: [-20, 80], Ob: [120, 180, -110], Oc: [-60] }, charge: { Ob: [-1, -60], Oc: [1, -120] },
        arrows: [
          { from: 'lp:Ob:0', to: 'C1', bend: 1, why: 'O⁻ attacks the carbonyl carbon…' },
          { from: 'bond:C1-Oa', to: 'mid:Oa-C2', bend: 1, why: '…the C=O π electrons bond that O to C2…' },
          { from: 'bond:C2-Oc', to: 'Oc', bend: -1, why: '…and the C=O⁺ π electrons return to O, cancelling the charge.' },
        ],
      },
      {
        title: 'Ozonide', text: 'A more stable ring, but it still has an O–O bond. The workup breaks it.',
        pos: { C1: Z1, C2: Z2, Ma: at(Z1, 160, 68), Mb: at(Z1, -150, 68), Hb: at(Z2, -30, 62), Mc: at(Z2, 30, 68), Oa: [445, 320], Ob: [415, 210], Oc: [475, 210] },
        bonds: 'C1-Oa Oa-C2 C2-Oc Oc-Ob Ob-C1 C1-Ma C1-Mb C2-Hb C2-Mc',
        lp: { Oa: [60, 120], Ob: [-110, 180], Oc: [-70, 0] },
        tags: [[445, 60, '2. (CH₃)₂S or Zn/H₂O', 'note']],
      },
      {
        title: 'Two carbonyls', text: 'Reductive workup takes one O away (DMS → DMSO). The C=C has been cut in two: here, a ketone and an aldehyde.',
        pos: { C1: P1, C2: P2, Ma: at(P1, 120, 68), Mb: at(P1, -120, 68), Hb: at(P2, -60, 62), Mc: at(P2, 60, 68), Oa: at(P1, 0, 66), Oc: at(P2, 180, 66) },
        bonds: 'C1=Oa C2=Oc C1-Ma C1-Mb C2-Hb C2-Mc',
        lp: { Oa: [-60, 60], Oc: [120, -120] },
        tags: [[360, 390, 'acetone', 'key'], [580, 390, 'acetaldehyde', 'key']],
      },
    ],
  };
})();

const hydrogenation = (() => {
  const pd = { P1: [340, 400], P2: [410, 400], P3: [480, 400], P4: [550, 400] };
  const surf = 'P1-P2 P2-P3 P3-P4';
  const T = [[445, 450, 'metal surface (Pd/C, Pt or Ni)', 'note']];
  const U1 = [410, 170], U2 = [480, 170], D1 = [410, 270], D2 = [480, 270];
  return {
    atoms: { C1: 'C', C2: 'C', Ma: 'H3C', Ha: 'H', Mb: 'CH3', Hb: 'H', Hx: 'H', Hy: 'H', P1: 'Pd', P2: 'Pd', P3: 'Pd', P4: 'Pd' },
    states: [
      {
        title: 'H₂ meets the catalyst', text: 'The alkene and H₂ both adsorb on the metal surface. Without a catalyst nothing happens.',
        pos: { ...pd, C1: U1, C2: U2, Ma: at(U1, 150, 68), Ha: at(U1, -150, 62), Mb: at(U2, 30, 68), Hb: at(U2, -30, 62), Hx: [420, 300], Hy: [470, 300] },
        bonds: `${surf} C1=C2 C1-Ma C1-Ha C2-Mb C2-Hb Hx-Hy`, tags: T,
      },
      {
        title: 'H atoms on the metal', text: 'H–H splits into H atoms bound to the metal. The alkene lies flat on the surface, one face down.',
        pos: { ...pd, C1: D1, C2: D2, Ma: at(D1, 170, 68), Ha: at(D1, -130, 62), Mb: at(D2, 10, 68), Hb: at(D2, -50, 62), Hx: [410, 345], Hy: [480, 345] },
        bonds: `${surf} C1=C2 C1-Ma C1-Ha C2-Mb C2-Hb P2-Hx P3-Hy`, tags: T,
      },
      {
        title: 'Syn addition', text: 'Both H atoms come from the metal, so both add to the bottom face (syn). The alkene becomes an alkane.',
        pos: { ...pd, C1: D1, C2: D2, Ma: at(D1, -160, 68), Ha: at(D1, -110, 62), Mb: at(D2, -20, 68), Hb: at(D2, -70, 62), Hx: at(D1, 90, 62), Hy: at(D2, 90, 62) },
        bonds: `${surf} C1-C2 C1-Ma C1-Ha C2-Mb C2-Hb C1-Hx C2-Hy`, tags: [...T, [445, 100, 'both H on the same face', 'key']],
      },
    ],
  };
})();

/* ---------------- Alkynes ---------------- */

const acetylide = (() => {
  const Ca = [362, 250], Cb = [432, 250], N0 = [240, 170], N1 = [330, 90], Cx0 = [220, 250], Cx1 = at(Ca, 180, 70);
  const nh = (n) => ({ Nn: n, Hn1: at(n, -150, 52), Hn2: at(n, -30, 52) });
  const chain = { Ca, Cb, Me: at(Cb, 0, 70) };
  return {
    atoms: { Hc: 'H', Ca: 'C', Cb: 'C', Me: 'CH3', Nn: 'N', Hn1: 'H', Hn2: 'H', Cx: 'C', Hx1: 'H', Hx2: 'H', Hx3: 'H', Br: 'Br' },
    states: [
      {
        title: 'Deprotonate the terminal alkyne', text: 'An sp C–H is unusually acidic (pKa ≈ 25). Amide (NH₂⁻, from NaNH₂) is a strong enough base because NH₃ has pKa ≈ 38.',
        pos: { ...chain, Hc: [300, 250], ...nh(N0) },
        bonds: 'Hc-Ca Ca#Cb Cb-Me Nn-Hn1 Nn-Hn2',
        lp: { Nn: [50, 130] }, charge: { Nn: [-1, -90] },
        tags: [[300, 300, 'pKa ≈ 25', 'note'], [240, 95, 'NaNH₂', 'note']],
        arrows: [
          { from: 'lp:Nn:0', to: 'Hc', bend: 1, why: 'Amide’s lone pair takes the terminal H.' },
          { from: 'bond:Hc-Ca', to: 'Ca', bend: -1, why: 'The C–H electrons stay on carbon: an acetylide ion.' },
        ],
      },
      {
        title: 'Acetylide attacks (SN2)', text: 'The acetylide is a strong carbon nucleophile. It attacks the back of a methyl or 1° alkyl halide.',
        pos: { ...chain, ...nh(N1), Hc: at(N1, 90, 52), Cx: Cx0, Br: at(Cx0, 180, 78), Hx1: at(Cx0, -70, 60), Hx2: at(Cx0, 70, 60), Hx3: at(Cx0, -130, 58) },
        bonds: 'Ca#Cb Cb-Me Nn-Hn1 Nn-Hn2 Nn-Hc Cx-Br Cx-Hx1 Cx>Hx2 Cx:Hx3',
        lp: { Ca: [180], Nn: [-90], Br: [180, -90, 90] }, charge: { Ca: [-1, -90] },
        tags: [[220, 340, 'CH₃Br', 'note']],
        arrows: [
          { from: 'lp:Ca:0', to: 'Cx', bend: 0.5, why: 'The acetylide lone pair forms a new C–C bond.' },
          { from: 'bond:Cx-Br', to: 'Br', bend: 1, why: 'Bromide leaves from the opposite side.' },
        ],
      },
      {
        title: 'Longer alkyne', text: 'Propyne became 2-butyne: a new C–C bond. With 2° or 3° halides the acetylide acts as a base instead (E2).',
        pos: { ...chain, ...nh(N1), Hc: at(N1, 90, 52), Cx: Cx1, Br: [150, 360], Hx1: at(Cx1, -120, 60), Hx2: at(Cx1, 120, 60), Hx3: at(Cx1, 180, 58) },
        bonds: 'Cx-Ca Ca#Cb Cb-Me Nn-Hn1 Nn-Hn2 Nn-Hc Cx-Hx1 Cx-Hx2 Cx-Hx3',
        lp: { Nn: [-90], Br: [0, 90, 180, -90] }, charge: { Br: [-1, -45] },
        tags: [[400, 340, 'new C–C bond', 'key']],
      },
    ],
  };
})();

const alkyneHX = (() => {
  const Cb = [420, 260], Ca = [490, 260];
  return {
    atoms: { Me: 'H3C', Cb: 'C', Ca: 'C', Ha: 'H', Hx: 'H', Br: 'Br', Hy: 'H', Br2: 'Br' },
    states: [
      {
        title: 'Protonate the triple bond', text: 'One π bond of the alkyne takes H⁺ from HBr. H goes to the terminal carbon (Markovnikov).',
        pos: { Cb, Ca, Ha: at(Ca, 0, 62), Me: at(Cb, 180, 70), Hx: [490, 165], Br: [490, 85] },
        bonds: 'Me-Cb Cb#Ca Ca-Ha Hx-Br', lp: { Br: [-90, 0, 180] },
        arrows: [
          { from: 'bond:Cb-Ca', to: 'Hx', bend: 1, why: 'π electrons bond to H at the terminal carbon.' },
          { from: 'bond:Hx-Br', to: 'Br', bend: -1, why: 'H–Br breaks; bromide leaves.' },
        ],
      },
      {
        title: 'Vinylic cation', text: 'The + sits on an sp carbon. Vinylic cations are less stable than alkyl ones (sp carbon is more electronegative), but 2° vinylic still beats 1° vinylic.',
        pos: { Cb, Ca, Hx: at(Ca, -60, 62), Ha: at(Ca, 60, 62), Me: at(Cb, 180, 70), Br: [420, 140] },
        bonds: 'Me-Cb Cb=Ca Ca-Ha Ca-Hx', lp: { Br: [90, 0, 180, -90] }, charge: { Cb: [1, 100], Br: [-1, -45] },
        arrows: [{ from: 'lp:Br:0', to: 'Cb', bend: 0.6, why: 'Bromide attacks the vinylic cation.' }],
      },
      {
        title: 'Vinyl bromide (1 eq)', text: 'With one equivalent the reaction stops here: a Markovnikov vinyl halide.',
        pos: { Cb, Ca, Hx: at(Ca, -60, 62), Ha: at(Ca, 60, 62), Me: at(Cb, 120, 70), Br: at(Cb, -120, 76) },
        bonds: 'Me-Cb Cb=Ca Ca-Ha Ca-Hx Cb-Br', lp: { Br: [-150, -50, 150] },
      },
      {
        title: 'Geminal dibromide (2 eq)', text: 'A second HBr adds the same way. The second Br also goes to the carbon that already has Br, because Br’s lone pairs help stabilise that cation.',
        pos: { Cb, Ca, Hx: at(Ca, -90, 62), Ha: at(Ca, 0, 62), Hy: at(Ca, 90, 62), Me: at(Cb, 180, 70), Br: at(Cb, -90, 76), Br2: at(Cb, 90, 76) },
        bonds: 'Me-Cb Cb-Ca Ca-Ha Ca-Hx Ca-Hy Cb-Br Cb-Br2', lp: { Br: [0, 180, -90], Br2: [0, 180, 90] },
        tags: [[455, 420, 'geminal: both Br on one carbon', 'key']],
      },
    ],
  };
})();

const alkyneHydration = (() => {
  const Cb = [420, 270], Ca = [490, 270], Ow0 = [460, 115], Ow1 = [330, 120];
  const O = at(Cb, -120, 68);
  const water = (o) => ({ Ow: o, Hw1: at(o, -150, 52), Hw2: at(o, -30, 52) });
  return {
    atoms: { Ca: 'C', Cb: 'C', Me: 'CH3', Ha1: 'H', Ha2: 'H', O: 'O', Ho: 'H', Ow: 'O', Hw: 'H', Hw1: 'H', Hw2: 'H' },
    states: [
      {
        title: 'Enol from Hg²⁺-catalysed hydration', text: 'H₂SO₄, H₂O and HgSO₄ add water Markovnikov to the alkyne, giving an enol (OH on a C=C carbon). The enol does not survive: acid protonates its CH₂ carbon.',
        pos: { Cb, Ca, Ha1: at(Ca, 45, 62), Ha2: at(Ca, -45, 62), Me: at(Cb, 120, 68), O, Ho: at(O, 180, 52), ...water(Ow0), Hw: at(Ow0, 80, 55) },
        bonds: 'Cb=Ca Ca-Ha1 Ca-Ha2 Cb-Me Cb-O O-Ho Ow-Hw Ow-Hw1 Ow-Hw2',
        lp: { O: [-20, -110], Ow: [-90] }, charge: { Ow: [1, 145] },
        tags: [[455, 400, 'enol', 'key']],
        arrows: [
          { from: 'lp:O:0', to: 'mid:O-Cb', bend: 1, why: 'An O lone pair pushes in toward C=O…' },
          { from: 'bond:Cb-Ca', to: 'Hw', bend: -1, why: '…so the C=C π electrons can take H⁺ at the CH₂ carbon.' },
          { from: 'bond:Ow-Hw', to: 'Ow', bend: 1, why: 'H₃O⁺ becomes water.' },
        ],
      },
      {
        title: 'Protonated ketone', text: 'A resonance-stabilised cation with the + on oxygen. Water removes the O–H proton.',
        pos: { Cb, Ca, Hw: at(Ca, -70, 62), Ha2: at(Ca, 10, 62), Ha1: at(Ca, 80, 62), Me: at(Cb, 120, 68), O, Ho: at(O, 180, 52), ...water(Ow1) },
        bonds: 'Cb-Ca Ca-Ha1 Ca-Ha2 Ca-Hw Cb-Me Cb=O O-Ho Ow-Hw1 Ow-Hw2',
        lp: { O: [-60], Ow: [90, -90] }, charge: { O: [1, -120] },
        arrows: [
          { from: 'lp:Ow:0', to: 'Ho', bend: 1, why: 'Water takes the proton from O.' },
          { from: 'bond:O-Ho', to: 'O', bend: -1, why: 'The O–H electrons stay on oxygen.' },
        ],
      },
      {
        title: 'Methyl ketone', text: 'The keto form wins (C=O is stronger than C=C). Keto and enol are tautomers: constitutional isomers that interconvert in acid or base.',
        pos: { Cb, Ca, Hw: at(Ca, -70, 62), Ha2: at(Ca, 10, 62), Ha1: at(Ca, 80, 62), Me: at(Cb, 120, 68), O, ...water(Ow1), Ho: at(Ow1, 90, 52) },
        bonds: 'Cb-Ca Ca-Ha1 Ca-Ha2 Ca-Hw Cb-Me Cb=O Ow-Hw1 Ow-Hw2 Ow-Ho',
        lp: { O: [-150, -50], Ow: [-90] }, charge: { Ow: [1, 150] },
        tags: [[455, 400, 'ketone (acetone)', 'key']],
      },
    ],
  };
})();

const alkyneHydroboration = (() => {
  const Cb = [420, 260], Ca = [490, 260];
  return {
    atoms: { Me: 'H3C', Cb: 'C', Ca: 'C', Ha: 'H', Hb: 'H', Bx: 'BR2', Ox: 'OH', Oy: 'O', Hc: 'H' },
    states: [
      {
        title: 'Terminal alkyne', text: 'Use a bulky borane, disiamylborane HB(sia)₂ or 9-BBN, so only one B–H adds.',
        pos: { Cb, Ca, Me: at(Cb, 180, 70), Ha: at(Ca, 0, 62) },
        bonds: 'Me-Cb Cb#Ca Ca-Ha', tags: [[455, 360, '1. HB(sia)₂  2. H₂O₂, NaOH', 'note']],
      },
      {
        title: 'Vinylborane', text: 'Same concerted, syn addition as with alkenes. B goes to the terminal (less hindered) carbon.',
        pos: { Cb, Ca, Me: at(Cb, 120, 70), Hb: at(Cb, -120, 62), Bx: at(Ca, -60, 72), Ha: at(Ca, 60, 62) },
        bonds: 'Me-Cb Cb=Ca Ca-Ha Cb-Hb Ca-Bx', tags: [[455, 400, 'H and B syn · B on the end carbon', 'note']],
      },
      {
        title: 'Enol', text: 'H₂O₂/NaOH swaps B for OH. OH on a C=C carbon is an enol, which tautomerises.',
        pos: { Cb, Ca, Me: at(Cb, 120, 70), Hb: at(Cb, -120, 62), Ox: at(Ca, -60, 70), Ha: at(Ca, 60, 62) },
        bonds: 'Me-Cb Cb=Ca Ca-Ha Cb-Hb Ca-Ox', tags: [[455, 400, 'enol', 'note']],
      },
      {
        title: 'Aldehyde', text: 'Tautomerisation gives an aldehyde. Compare HgSO₄/H₂SO₄ on the same alkyne, which gives the methyl ketone.',
        pos: { Cb, Ca, Me: at(Cb, 170, 70), Hb: at(Cb, -100, 62), Hc: at(Cb, 80, 62), Oy: at(Ca, -60, 66), Ha: at(Ca, 60, 62) },
        bonds: 'Me-Cb Cb-Ca Ca-Ha Cb-Hb Cb-Hc Ca=Oy', tags: [[455, 400, 'aldehyde (anti-Markovnikov)', 'key']],
      },
    ],
  };
})();

const lindlar = (() => {
  const Ca = [410, 260], Cb = [480, 260];
  return {
    atoms: { Ma: 'H3C', Ca: 'C', Cb: 'C', Mb: 'CH3', Hx: 'H', Hy: 'H' },
    states: [
      {
        title: 'Alkyne + H₂, Lindlar catalyst', text: 'Lindlar catalyst is “poisoned” palladium (Pd/CaCO₃ with Pb(OAc)₂ and quinoline). It is too weak to reduce an alkene.',
        pos: { Ca, Cb, Ma: at(Ca, 180, 70), Mb: at(Cb, 0, 70), Hx: [415, 160], Hy: [475, 160] },
        bonds: 'Ma-Ca Ca#Cb Cb-Mb Hx-Hy', tags: [[445, 360, 'H₂, Lindlar catalyst', 'note']],
      },
      {
        title: 'cis-Alkene', text: 'Both H atoms come from the catalyst surface on one face, so the alkene is cis (Z). The reaction stops here.',
        pos: { Ca, Cb, Ma: at(Ca, 120, 70), Mb: at(Cb, 60, 70), Hx: at(Ca, -120, 62), Hy: at(Cb, -60, 62) },
        bonds: 'Ma-Ca Ca=Cb Cb-Mb Ca-Hx Cb-Hy', tags: [[445, 390, 'cis (Z)-2-butene', 'key']],
      },
    ],
  };
})();

const dissolvingMetal = (() => {
  const Ca = [410, 260], Cb = [480, 260];
  const Hp1 = [355, 365], N1a = at(Hp1, 160, 62), Na2 = at(Cb, -60, 110), Hp2 = at(Cb, -60, 100);
  return {
    atoms: { Ma: 'H3C', Ca: 'C', Cb: 'C', Mb: 'CH3', Na1: 'Na', Na2: 'Na', Hp1: 'H', N1: 'H2N', Hp2: 'H', N2: 'NH2' },
    states: [
      {
        title: 'Electron transfer', text: 'Na in liquid NH₃ (−33 °C) gives up its single valence electron to the alkyne.',
        pos: { Ca, Cb, Ma: at(Ca, 180, 70), Mb: at(Cb, 0, 70), Na1: [410, 140], Hp1, N1: N1a },
        bonds: 'Ma-Ca Ca#Cb Cb-Mb Hp1-N1', rad: { Na1: [90] },
        tags: [[580, 110, 'Na, NH₃(l)', 'note']],
        arrows: [
          { from: 'rad:Na1:0', to: 'Ca', kind: 'fish', bend: 1, why: 'Sodium’s electron goes to the alkyne.' },
          { from: 'bond:Ca-Cb', to: 'Ca', kind: 'fish', bend: -1, why: 'One π electron pairs with it on C2 (a carbanion); the other stays on C3 (a radical).' },
        ],
      },
      {
        title: 'Radical anion', text: 'The lone pair and the radical repel, so they sit on opposite sides. That sets up the trans product.',
        pos: { Ca, Cb, Ma: at(Ca, -120, 70), Mb: at(Cb, 60, 70), Na1: [300, 150], Hp1, N1: N1a },
        bonds: 'Ma-Ca Ca=Cb Cb-Mb Hp1-N1', lp: { Ca: [120] }, rad: { Cb: [-60] }, charge: { Ca: [-1, 180], Na1: [1, -45] },
        arrows: [
          { from: 'lp:Ca:0', to: 'Hp1', bend: 1, why: 'The carbanion is a strong base and takes H⁺ from NH₃.' },
          { from: 'bond:Hp1-N1', to: 'N1', bend: -1, why: 'The N–H electrons stay on nitrogen.' },
        ],
      },
      {
        title: 'Vinyl radical', text: 'A second Na atom gives another electron.',
        pos: { Ca, Cb, Ma: at(Ca, -120, 70), Mb: at(Cb, 60, 70), Na1: [300, 150], Hp1: at(Ca, 120, 62), N1: [290, 410], Na2 },
        bonds: 'Ma-Ca Ca=Cb Cb-Mb Ca-Hp1', rad: { Cb: [-60], Na2: [120] }, charge: { Na1: [1, -45], N1: [-1, -45] },
        arrows: [{ from: 'rad:Na2:0', to: 'Cb', kind: 'fish', bend: 1, why: 'The electron pairs with the radical electron on C3, making a carbanion.' }],
      },
      {
        title: 'Vinyl anion', text: 'The anion takes a proton from a second NH₃.',
        pos: { Ca, Cb, Ma: at(Ca, -120, 70), Mb: at(Cb, 60, 70), Na1: [300, 150], Hp1: at(Ca, 120, 62), N1: [290, 410], Na2: [650, 230], Hp2, N2: at(Hp2, -30, 62) },
        bonds: 'Ma-Ca Ca=Cb Cb-Mb Ca-Hp1 Hp2-N2', lp: { Cb: [-60] }, charge: { Cb: [-1, 0], Na1: [1, -45], N1: [-1, -45], Na2: [1, -45] },
        arrows: [
          { from: 'lp:Cb:0', to: 'Hp2', bend: -1, why: 'Carbanion takes H⁺ from NH₃.' },
          { from: 'bond:Hp2-N2', to: 'N2', bend: 1, why: 'The N–H electrons stay on nitrogen.' },
        ],
      },
      {
        title: 'trans-Alkene', text: 'The two CH₃ groups end up on opposite sides: trans (E). Compare Lindlar, which gives cis.',
        pos: { Ca, Cb, Ma: at(Ca, -120, 70), Mb: at(Cb, 60, 70), Na1: [300, 150], Hp1: at(Ca, 120, 62), N1: [290, 410], Na2: [650, 230], Hp2: at(Cb, -60, 62), N2: [620, 110] },
        bonds: 'Ma-Ca Ca=Cb Cb-Mb Ca-Hp1 Cb-Hp2', charge: { Na1: [1, -45], N1: [-1, -45], Na2: [1, -45], N2: [-1, -45] },
        tags: [[445, 440, 'trans (E)-2-butene', 'key']],
      },
    ],
  };
})();

/* ---------------- Radicals ---------------- */

const radicalHalogenation = (() => {
  const C2 = [420, 280];
  const prop = { C2, C1: at(C2, 180, 70), C3: at(C2, 0, 70), Hcd: at(C2, 90, 62) };
  const Hab0 = at(C2, -90, 62), BrA = [270, 150], Brc0 = [420, 180];
  return {
    atoms: { C1: 'H3C', C2: 'C', C3: 'CH3', Hab: 'H', Hcd: 'H', Bra: 'Br', Brb: 'Br', Brc: 'Br', Brd: 'Br' },
    states: [
      {
        title: 'Initiation', text: 'Light (hν) or heat splits Br₂ homolytically: one electron goes to each Br.',
        pos: { ...prop, Hab: Hab0, Bra: [380, 120], Brb: [460, 120] },
        bonds: 'C1-C2 C2-C3 C2-Hab C2-Hcd Bra-Brb', lp: { Bra: [180, -90, 90], Brb: [0, -90, 90] },
        tags: [[420, 60, 'Br₂, hν', 'note']],
        arrows: [
          { from: 'bond:Bra-Brb', to: 'Bra', kind: 'fish', bend: -1, why: 'One bonding electron goes to the left Br…' },
          { from: 'bond:Bra-Brb', to: 'Brb', kind: 'fish', bend: 1, why: '…and one to the right Br: two Br• radicals.' },
        ],
      },
      {
        title: 'Propagation 1: H abstraction', text: 'Br• pulls an H atom off the alkane. It takes the H that leaves the most stable radical (here 2°).',
        pos: { ...prop, Hab: Hab0, Bra: [480, 150], Brb: [580, 90] },
        bonds: 'C1-C2 C2-C3 C2-Hab C2-Hcd', rad: { Bra: [130], Brb: [180] }, lp: { Bra: [-150, -50, 40], Brb: [0, -90, 90] },
        arrows: [
          { from: 'rad:Bra:0', to: 'mid:Bra-Hab', kind: 'fish', bend: 1, why: 'Br•’s unpaired electron starts an H–Br bond.' },
          { from: 'bond:C2-Hab', to: 'mid:Bra-Hab', kind: 'fish', bend: -1, why: 'One C–H electron completes it.' },
          { from: 'bond:C2-Hab', to: 'C2', kind: 'fish', bend: 1, why: 'The other stays on carbon: a 2° alkyl radical.' },
        ],
      },
      {
        title: 'Propagation 2: Br transfer', text: 'The carbon radical takes a Br atom from Br₂, making product and a new Br•.',
        pos: { ...prop, Bra: BrA, Hab: at(BrA, 0, 58), Brc: Brc0, Brd: at(Brc0, -40, 78) },
        bonds: 'C1-C2 C2-C3 C2-Hcd Bra-Hab Brc-Brd', rad: { C2: [-90] }, lp: { Bra: [180, -90, 90], Brc: [180, -110, 50], Brd: [-40, 50, -130] },
        arrows: [
          { from: 'rad:C2:0', to: 'mid:C2-Brc', kind: 'fish', bend: 1, why: 'The carbon radical’s electron starts a C–Br bond.' },
          { from: 'bond:Brc-Brd', to: 'mid:C2-Brc', kind: 'fish', bend: 1, why: 'One Br–Br electron completes it.' },
          { from: 'bond:Brc-Brd', to: 'Brd', kind: 'fish', bend: 1, why: 'The other stays on Br: a fresh Br• for the next cycle.' },
        ],
      },
      {
        title: '2-Bromopropane', text: 'The chain repeats until two radicals meet (termination). Bromination is very selective (~97% 2° product); chlorination is not (~60%).',
        pos: { ...prop, Bra: BrA, Hab: at(BrA, 0, 58), Brc: at(C2, -90, 76), Brd: [560, 120] },
        bonds: 'C1-C2 C2-C3 C2-Hcd C2-Brc Bra-Hab', rad: { Brd: [180] }, lp: { Bra: [180, -90, 90], Brc: [-90, 180, 0], Brd: [-90, 90, 0] },
        tags: [[560, 70, 'Br• → next cycle', 'key'], [420, 400, 'major product: Br on the 2° carbon', 'note']],
      },
    ],
  };
})();

const nbs = (() => {
  const C1 = [350, 290], C2 = [420, 250], C3 = [490, 290];
  const base = { C1, C2, C3, H1a: at(C1, -150, 60), H1b: at(C1, 90, 60), H2: at(C2, -90, 60) };
  const sp3 = { H3b: at(C3, 20, 62), H3c: at(C3, 100, 62) }, sp2 = { H3b: at(C3, -30, 62), H3c: at(C3, 90, 62) };
  const HBr = { Bra: [640, 160], H3a: [582, 160] };
  const Brc0 = at(C1, -90, 95);
  return {
    atoms: { C1: 'C', C2: 'C', C3: 'C', H1a: 'H', H1b: 'H', H2: 'H', H3a: 'H', H3b: 'H', H3c: 'H', Bra: 'Br', Brc: 'Br', Brd: 'Br' },
    states: [
      {
        title: 'Br• takes an allylic H', text: 'NBS keeps Br₂ (and Br•) at a very low level, so Br₂ does not add to the C=C. Br• removes an allylic H instead (the C–H next to the C=C).',
        pos: { ...base, ...sp3, H3a: at(C3, -60, 62), Bra: [585, 175] },
        bonds: 'C1=C2 C2-C3 C1-H1a C1-H1b C2-H2 C3-H3a C3-H3b C3-H3c', rad: { Bra: [140] }, lp: { Bra: [-60, 10, 80] },
        tags: [[585, 110, 'NBS, hν', 'note']],
        arrows: [
          { from: 'rad:Bra:0', to: 'mid:Bra-H3a', kind: 'fish', bend: 1, why: 'Br•’s electron starts an H–Br bond.' },
          { from: 'bond:C3-H3a', to: 'mid:Bra-H3a', kind: 'fish', bend: -1, why: 'One C–H electron completes it.' },
          { from: 'bond:C3-H3a', to: 'C3', kind: 'fish', bend: 1, why: 'The other stays on C3: an allylic radical.' },
        ],
      },
      {
        title: 'Allylic radical (resonance)', text: 'The unpaired electron is shared between C1 and C3 by resonance, which is why allylic H’s are the easiest to remove. These arrows show resonance, not a reaction.',
        pos: { ...base, ...sp2, ...HBr },
        bonds: 'C1=C2 C2-C3 C1-H1a C1-H1b C2-H2 C3-H3b C3-H3c Bra-H3a', rad: { C3: [-80] }, lp: { Bra: [0, -90, 90] },
        arrows: [
          { from: 'rad:C3:0', to: 'mid:C2-C3', kind: 'fish', bend: -1, why: 'The radical electron pairs up to make a C2=C3 π bond…' },
          { from: 'bond:C1-C2', to: 'mid:C2-C3', kind: 'fish', bend: 1, why: '…using one electron from the old π bond…' },
          { from: 'bond:C1-C2', to: 'C1', kind: 'fish', bend: -1, why: '…and the other π electron moves to C1.' },
        ],
      },
      {
        title: 'Br₂ traps the radical', text: 'HBr + NBS make a little Br₂. The radical takes a Br atom from it, at either end of the allylic system.',
        pos: { ...base, ...sp2, ...HBr, Brc: Brc0, Brd: at(Brc0, -120, 78) },
        bonds: 'C1-C2 C2=C3 C1-H1a C1-H1b C2-H2 C3-H3b C3-H3c Bra-H3a Brc-Brd', rad: { C1: [-90] }, lp: { Bra: [0, -90, 90], Brc: [-30, 30, 180], Brd: [-150, -60, 150] },
        arrows: [
          { from: 'rad:C1:0', to: 'mid:C1-Brc', kind: 'fish', bend: 1, why: 'The radical electron on C1 starts a C–Br bond.' },
          { from: 'bond:Brc-Brd', to: 'mid:C1-Brc', kind: 'fish', bend: 1, why: 'One Br–Br electron completes it.' },
          { from: 'bond:Brc-Brd', to: 'Brd', kind: 'fish', bend: 1, why: 'The other stays on Br: Br• keeps the chain going.' },
        ],
      },
      {
        title: 'Allylic bromide', text: 'Br is now on the allylic carbon and the C=C has shifted. With an unsymmetrical alkene the two radical ends differ, so expect a mixture.',
        pos: { ...base, ...sp2, ...HBr, Brc: at(C1, -90, 76), Brd: [250, 120] },
        bonds: 'C1-C2 C2=C3 C1-H1a C1-H1b C2-H2 C3-H3b C3-H3c Bra-H3a C1-Brc', rad: { Brd: [0] }, lp: { Bra: [0, -90, 90], Brc: [-90, 180, 0], Brd: [180, -90, 90] },
        tags: [[420, 400, 'allylic bromide (C=C shifted)', 'key']],
      },
    ],
  };
})();

/* ---------------- Library entries ---------------- */

export const MORE_CONCEPTS = [
  {
    id: 'ether', group: 'Alkene additions', name: 'Acid-catalyzed addition of alcohol',
    summary: 'Alkene + ROH with acid (H₂SO₄) → Markovnikov ether. Same three steps as hydration, with the alcohol as the nucleophile.',
    points: [
      'Protonate the alkene → carbocation → ROH attacks → deprotonate.',
      'Markovnikov: OR on the more substituted carbon.',
      'Carbocation, so rearrangements are possible.',
    ],
    watch: 'The solvent decides the nucleophile: H₂O gives an alcohol, CH₃OH gives a methyl ether.',
    mech: etherAdd,
  },
  {
    id: 'oxymercuration', group: 'Alkene additions', name: 'Oxymercuration–demercuration',
    summary: '1. Hg(OAc)₂, H₂O  2. NaBH₄ → Markovnikov alcohol without rearrangement. A bridged mercurinium ion replaces the free carbocation.',
    points: [
      'Mercurinium ion is like a bromonium: no free C⁺, so no shifts.',
      'Water opens it at the more substituted carbon (Markovnikov).',
      'OH and HgOAc add anti; NaBH₄ then replaces HgOAc with H.',
      'In ROH instead of H₂O you get an ether (alkoxymercuration).',
    ],
    watch: 'Choose this over acid-catalyzed hydration whenever the carbocation could rearrange.',
    mech: oxymercuration,
  },
  {
    id: 'hydroboration', group: 'Alkene additions', name: 'Hydroboration–oxidation',
    summary: '1. BH₃·THF  2. H₂O₂, NaOH → anti-Markovnikov alcohol. B and H add in one concerted step, then OH replaces B.',
    points: [
      'Boron is electrophilic (empty p orbital) and goes to the less substituted carbon.',
      'Concerted four-centre step: no carbocation, no rearrangement.',
      'Syn addition: H and OH end up on the same face.',
      'Oxidation keeps the position and configuration of B.',
    ],
    watch: 'Anti-Markovnikov does not mean anti addition. Hydroboration is anti-Markovnikov AND syn.',
    mech: hydroboration,
  },
  {
    id: 'halohydrin', group: 'Alkene additions', name: 'Halohydrin formation',
    summary: 'Br₂ (or Cl₂) in water → halohydrin. Water outcompetes halide and opens the halonium ion at the more substituted carbon.',
    points: [
      'Halonium intermediate: no rearrangement.',
      'OH on the more substituted carbon, X on the less substituted one.',
      'Anti addition: X and OH on opposite faces (trans on a ring).',
      'Competing nucleophiles: in ROH you get an ether (alkoxyhalogenation); with added halide salt, the dihalide.',
    ],
    watch: 'Regiochemistry comes from the δ+ on the bridged ion, not from a free carbocation.',
    mech: halohydrin,
  },
  {
    id: 'hydrogenation', group: 'Alkene oxidation & reduction', name: 'Catalytic hydrogenation',
    summary: 'H₂ with Pd/C (or Pt, Ni) reduces C=C to an alkane. Both H atoms come from the metal surface, so they add syn.',
    points: [
      'Reduction: more C–H bonds.',
      'Syn addition; the exact mechanism on the surface is not fully known.',
      'Alkynes go all the way to alkanes unless the catalyst is poisoned (Lindlar).',
    ],
    watch: 'Stereo only matters if new stereocenters form: syn addition to a substituted alkene gives a specific pair of stereoisomers.',
    mech: hydrogenation,
  },
  {
    id: 'epoxidation', group: 'Alkene oxidation & reduction', name: 'Epoxidation (mCPBA)',
    summary: 'A peroxyacid (mCPBA) transfers its weakly bonded O to the π bond in one concerted step, giving an epoxide.',
    points: [
      'Concerted: π bond breaks and two C–O σ bonds form together.',
      'No carbocation, so no rearrangement.',
      'Syn addition: the alkene’s geometry is kept (cis → cis-epoxide).',
      'By-product: the carboxylic acid (mCBA).',
    ],
    watch: 'Epoxides are strained three-membered rings: acid opens them easily (next concept).',
    mech: epoxidation,
  },
  {
    id: 'epoxide-opening', group: 'Alkene oxidation & reduction', name: 'Epoxide opening → trans-diol',
    summary: '1. mCPBA  2. H₃O⁺ → trans-1,2-diol. Acid protonates the epoxide, then water attacks from the back, like SN2.',
    points: [
      'Protonated epoxide O is a good leaving group.',
      'Water attacks the face opposite the O: anti.',
      'In acid, attack happens at the more substituted carbon.',
      'Overall anti dihydroxylation: the opposite of OsO₄.',
    ],
    watch: 'trans-diol: epoxide then H₃O⁺. cis-diol: OsO₄ or cold KMnO₄.',
    mech: epoxideOpening,
  },
  {
    id: 'dihydroxylation', group: 'Alkene oxidation & reduction', name: 'Syn dihydroxylation (OsO₄)',
    summary: 'OsO₄ (then NaHSO₃) or cold, dilute KMnO₄/NaOH → cis-1,2-diol through a cyclic ester.',
    points: [
      'Concerted cyclic transition state (six electrons).',
      'Both O atoms come from the same reagent, so both add to one face: syn.',
      'Os goes from +8 to +6; NaHSO₃ (or H₂O₂) cleaves the osmate ester.',
      'Hot or acidic KMnO₄ over-oxidises and cleaves the C=C instead.',
    ],
    watch: 'On a ring: OsO₄ → cis-diol; epoxide + H₃O⁺ → trans-diol.',
    mech: dihydroxylation,
  },
  {
    id: 'ozonolysis', group: 'Alkene oxidation & reduction', name: 'Ozonolysis',
    summary: '1. O₃  2. (CH₃)₂S (or Zn/H₂O) cuts the C=C in two, making two C=O groups (aldehydes and/or ketones).',
    points: [
      'O₃ adds to give a molozonide, which falls apart and recombines (180° flip) to the ozonide.',
      'Reductive workup breaks the O–O bond: DMS becomes DMSO.',
      'Each alkene carbon becomes a C=O carbon and keeps its other groups.',
      'Work backwards: join the two C=O carbons with a C=C to find the alkene.',
    ],
    watch: 'A carbon with an H gives an aldehyde; a carbon with two R groups gives a ketone. A ring alkene gives one chain with two C=O.',
    mech: ozonolysis,
  },
  {
    id: 'acetylide', group: 'Alkynes', name: 'Acetylide alkylation',
    summary: '1. NaNH₂  2. R–X turns a terminal alkyne into a longer alkyne. Deprotonate the sp C–H, then do SN2 on an alkyl halide.',
    points: [
      'Terminal alkyne pKa ≈ 25; NH₃ pKa ≈ 38, so NaNH₂ deprotonates completely.',
      'The acetylide is a strong nucleophile and a strong base.',
      'Works with methyl and 1° halides only; 2°/3° give E2.',
      'Forms a new C–C bond: key for synthesis.',
    ],
    watch: 'Hydroxide and alkoxides are too weak to make acetylides (their conjugate acids are more acidic than the alkyne).',
    mech: acetylide,
  },
  {
    id: 'alkyne-hx', group: 'Alkynes', name: 'HX & X₂ addition to alkynes',
    summary: 'HX adds Markovnikov through a vinylic cation. One equivalent gives a vinyl halide; two give a geminal dihalide.',
    points: [
      'Vinylic cation: less stable than an alkyl cation; 2° vinylic ≈ 1° alkyl.',
      'Stoichiometry decides where it stops: 1 eq → alkene, 2 eq → alkane.',
      'Second HX: both X end up on the same carbon (geminal).',
      'X₂ (1 eq) adds anti → (E)-dihaloalkene; 2 eq → tetrahalide.',
      'HBr with peroxides adds anti-Markovnikov, as with alkenes.',
    ],
    watch: 'Geminal = same carbon; vicinal = neighbouring carbons (from X₂ on an alkene).',
    mech: alkyneHX,
  },
  {
    id: 'alkyne-hydration', group: 'Alkynes', name: 'Alkyne hydration & tautomerism',
    summary: 'H₂SO₄, H₂O, HgSO₄ adds water Markovnikov to give an enol, which tautomerises to a ketone.',
    points: [
      'Enol = OH on a C=C carbon; less stable than the keto form.',
      'Tautomers are constitutional isomers in equilibrium (acid or base).',
      'Terminal alkyne → methyl ketone.',
      'Symmetrical internal alkyne → one ketone; unsymmetrical → ~50/50 mixture.',
    ],
    watch: 'Tautomerisation moves an H and a π bond. It is not resonance: atoms move.',
    mech: alkyneHydration,
  },
  {
    id: 'alkyne-hydroboration', group: 'Alkynes', name: 'Alkyne hydroboration–oxidation',
    summary: '1. HB(sia)₂ or 9-BBN  2. H₂O₂, NaOH → anti-Markovnikov enol → aldehyde (from a terminal alkyne).',
    points: [
      'A bulky borane adds only once.',
      'B goes to the terminal carbon, syn addition.',
      'Oxidation gives an enol, which tautomerises to the aldehyde.',
    ],
    watch: 'Terminal alkyne: HgSO₄/H₂SO₄ → methyl ketone; hydroboration → aldehyde.',
    mech: alkyneHydroboration,
  },
  {
    id: 'lindlar', group: 'Alkynes', name: 'Lindlar reduction (cis)',
    summary: 'H₂ with Lindlar catalyst (poisoned Pd) reduces an alkyne to a cis alkene and stops there.',
    points: [
      'Syn addition of two H from the catalyst surface → cis (Z).',
      'Poisoned catalyst cannot reduce the alkene further.',
      'H₂, Pd/C (unpoisoned) goes all the way to the alkane.',
    ],
    watch: 'cis: H₂/Lindlar. trans: Na/NH₃. alkane: H₂/Pd/C.',
    mech: lindlar,
  },
  {
    id: 'dissolving-metal', group: 'Alkynes', name: 'Dissolving-metal reduction (trans)',
    summary: 'Na (or Li) in liquid NH₃ at −33 °C reduces an alkyne to a trans alkene: electron, proton, electron, proton.',
    points: [
      'Na gives single electrons (fishhook arrows); NH₃ gives protons.',
      'Radical anion → vinyl radical → vinyl anion → alkene.',
      'The intermediates prefer the trans geometry, so the product is trans (E).',
    ],
    watch: 'Keep the order straight: e⁻, H⁺, e⁻, H⁺.',
    mech: dissolvingMetal,
  },
  {
    id: 'radical-halogenation', group: 'Radicals', name: 'Free-radical halogenation',
    summary: 'Alkane + X₂ with light or heat → alkyl halide by a radical chain. Alkanes are unreactive, so this is how you make them react.',
    points: [
      'Initiation (X₂ → 2 X•), two propagation steps, then termination (two radicals combine).',
      'Radical stability: 3° > 2° > 1° > methyl, like carbocations.',
      'Bromination is selective (~97% 2-bromopropane); chlorination is not (~60% 2-chloropropane).',
      'Fishhook arrows: one electron each.',
    ],
    watch: 'Counting products: find each different kind of H. Every kind gives a product, but Br picks the most stable radical.',
    mech: radicalHalogenation,
  },
  {
    id: 'nbs', group: 'Radicals', name: 'Allylic bromination (NBS)',
    summary: 'NBS with light or peroxide puts Br on the allylic carbon (next to a C=C) and leaves the double bond in place, possibly shifted.',
    points: [
      'NBS keeps [Br₂] very low, so Br₂ does not add across the C=C.',
      'Br• removes an allylic H: the allylic radical is resonance-stabilised.',
      'Br can end up at either end of the allylic radical, shifting the C=C.',
    ],
    watch: 'Br₂ alone (dark, CH₂Cl₂) adds across the C=C. NBS + hν substitutes at the allylic C–H.',
    mech: nbs,
  },
  {
    id: 'alkene-map', group: 'Choosing', name: 'Alkene reactions at a glance',
    summary: 'For each reagent: where the new groups go, which face they add to, and whether a carbocation can rearrange.',
    points: [
      'Rearrangements only happen when a free carbocation forms.',
      'Bridged ions (halonium, mercurinium) give anti addition.',
      'Concerted reagents (BH₃, mCPBA, OsO₄, H₂/Pd) give syn addition.',
    ],
    watch: 'Markovnikov vs anti-Markovnikov is about position. Syn vs anti is about faces. Answer both.',
    tableCaption: 'Regiochemistry, stereochemistry and rearrangement for every alkene reaction in Ch 8–9.',
    table: {
      cols: ['Reagents', 'Product', 'Regio', 'Stereo', 'Shifts?'],
      rows: [
        ['HX', 'alkyl halide', 'Markovnikov', 'none (racemic)', 'yes'],
        ['HBr, ROOR', 'alkyl bromide', 'anti-Markovnikov', 'none', 'no'],
        ['H₃O⁺ (H₂SO₄, H₂O)', 'alcohol', 'Markovnikov', 'none', 'yes'],
        ['ROH, H⁺', 'ether', 'Markovnikov', 'none', 'yes'],
        ['1. Hg(OAc)₂, H₂O  2. NaBH₄', 'alcohol', 'Markovnikov', 'not controlled', 'no'],
        ['1. BH₃·THF  2. H₂O₂, NaOH', 'alcohol', 'anti-Markovnikov', 'syn', 'no'],
        ['X₂, CH₂Cl₂', 'vicinal dihalide', '–', 'anti', 'no'],
        ['X₂, H₂O', 'halohydrin', 'OH on more subst. C', 'anti', 'no'],
        ['H₂, Pd/C', 'alkane', '–', 'syn', 'no'],
        ['mCPBA', 'epoxide', '–', 'syn', 'no'],
        ['1. mCPBA  2. H₃O⁺', 'trans-diol', '–', 'anti', 'no'],
        ['OsO₄ / cold KMnO₄', 'cis-diol', '–', 'syn', 'no'],
        ['1. O₃  2. (CH₃)₂S', '2 × C=O', 'C=C cleaved', '–', 'no'],
      ],
    },
  },
  {
    id: 'alkyne-map', group: 'Choosing', name: 'Alkyne reactions at a glance',
    summary: 'Every Ch 10 alkyne reaction with its product. Equivalents matter: alkynes can react once or twice.',
    points: [
      '1 equivalent of H₂, HX or X₂ can stop at the alkene stage.',
      'Reduction stereo: Lindlar → cis, Na/NH₃ → trans.',
      'Hydration: HgSO₄ → ketone (Markovnikov); hydroboration → aldehyde (terminal alkyne).',
    ],
    watch: 'For synthesis, plan backwards: which C–C bond can an acetylide make, and which reaction turns the alkyne into the target?',
    tableCaption: 'Reagent → product for every alkyne reaction in Ch 10.',
    table: {
      cols: ['Reagents', 'Product', 'Notes'],
      rows: [
        ['1. NaNH₂  2. R–X', 'longer alkyne', 'SN2: methyl/1° R–X only'],
        ['HX (1 eq)', 'vinyl halide', 'Markovnikov'],
        ['HX (2 eq)', 'geminal dihalide', 'both X on one C'],
        ['X₂ (1 eq)', '(E)-dihaloalkene', 'anti'],
        ['X₂ (2 eq)', 'tetrahalide', ''],
        ['H₂SO₄, H₂O, HgSO₄', 'ketone', 'Markovnikov enol → keto'],
        ['1. HB(sia)₂ or 9-BBN  2. H₂O₂, NaOH', 'aldehyde (terminal)', 'anti-Markovnikov enol → keto'],
        ['H₂, Lindlar', 'cis-alkene', 'syn'],
        ['Na, NH₃(l)', 'trans-alkene', 'e⁻/H⁺/e⁻/H⁺'],
        ['H₂ (2 eq), Pd/C', 'alkane', 'full reduction'],
      ],
    },
  },
];
