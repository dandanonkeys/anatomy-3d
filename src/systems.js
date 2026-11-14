// Two "worlds" share one viewer: the body (Z-Anatomy / BodyParts3D models) and
// a cell library (schematic, procedurally built). Each world has its own
// groups for the panel toggles, scale levels and zoom tiers.

// ---------- body ----------
export const SYSTEMS = {
  skeletal:       { label: 'Skeletal',            color: '#e3d6ba', on: true },
  joints:         { label: 'Joints & ligaments',  color: '#9fb8b2', on: false },
  muscular:       { label: 'Muscular',            color: '#c25a50', on: false },
  nervous:        { label: 'Nervous',             color: '#f0cf6a', on: true },
  cardiovascular: { label: 'Cardiovascular',      color: '#c8303f', on: true },
  lymphatic:      { label: 'Lymphatic',           color: '#7fc28a', on: false },
  respiratory:    { label: 'Respiratory',         color: '#e3a3aa', on: true },
  digestive:      { label: 'Digestive',           color: '#d39352', on: true },
  urinary:        { label: 'Urinary',             color: '#d2b04a', on: true },
  endocrine:      { label: 'Endocrine',           color: '#b58ad6', on: true },
  reproductive:   { label: 'Reproductive',        color: '#d98fb7', on: false },
};

export const LEVELS = {
  1: 'Organ or major structure',
  2: 'Part of a structure',
  3: 'Fine structure',
};

// Zoom tiers by metres of body filling the view height; `levels` = which
// structure levels get labels in that tier.
export const TIERS = [
  { name: 'Whole body', minView: 1.0,  levels: [1] },
  { name: 'Region',     minView: 0.38, levels: [1, 2] },
  { name: 'Organ',      minView: 0.13, levels: [2, 3] },
  { name: 'Detail',     minView: 0,    levels: [2, 3] },
];

// ---------- cells ----------
// Cell models use 1 scene unit = 10 µm.
export const CELL_UNIT_M = 1e-5;

export const CELL_TYPES = {
  animal:     { label: 'Animal cell (generic)', color: '#8fb3d9', on: true },
  neuron:     { label: 'Neuron',                color: '#f0cf6a', on: false },
  muscle:     { label: 'Skeletal muscle fiber', color: '#c25a50', on: false },
  rbc:        { label: 'Red blood cell',        color: '#c8303f', on: false },
  osteocyte:  { label: 'Osteocyte',             color: '#e3d6ba', on: false },
  epithelial: { label: 'Epithelial cell',       color: '#d99aa0', on: false },
  sperm:      { label: 'Sperm cell',            color: '#9fb8b2', on: false },
  egg:        { label: 'Egg cell (oocyte)',     color: '#e8b98a', on: false },
};

export const CELL_LEVELS = {
  1: 'Whole cell or major region',
  2: 'Organelle',
  3: 'Sub-organelle structure',
};

// Cell tiers are relative: view height divided by the size of the cell on show,
// so a 7.5 µm red cell and a 120 µm egg both start at the "Cell" tier.
export const CELL_TIERS = [
  { name: 'Cell',      minView: 0.8,  levels: [1, 2] },
  { name: 'Organelle', minView: 0.22, levels: [2, 3] },
  { name: 'Detail',    minView: 0,    levels: [2, 3] },
];

export function tierFor(viewHeight, tiers = TIERS) {
  return tiers.findIndex((t) => viewHeight >= t.minView);
}
