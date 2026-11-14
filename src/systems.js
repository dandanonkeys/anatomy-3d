// Body systems: display name, base colour, and whether shown on first load.
export const SYSTEMS = {
  skeletal:       { label: 'Skeletal',       color: '#e3d6ba', on: true },
  muscular:       { label: 'Muscular',       color: '#b4524a', on: false },
  cardiovascular: { label: 'Cardiovascular', color: '#a12a3a', on: true },
  respiratory:    { label: 'Respiratory',    color: '#d99aa0', on: true },
  digestive:      { label: 'Digestive',      color: '#c98a4c', on: true },
  urinary:        { label: 'Urinary',        color: '#c6a43c', on: true },
  nervous:        { label: 'Nervous',        color: '#e8c3aa', on: true },
};

// Scale level of a structure (the system itself is the level above these).
export const LEVELS = {
  1: 'Organ or major bone',
  2: 'Part of an organ',
  3: 'Fine structure',
};

// Zoom tiers, chosen by how many metres of body fill the view height.
// `levels` = which structure levels get labels in that tier.
export const TIERS = [
  { name: 'Whole body', minView: 1.0,  levels: [1] },
  { name: 'Region',     minView: 0.38, levels: [1, 2] },
  { name: 'Organ',      minView: 0.13, levels: [2, 3] },
  { name: 'Detail',     minView: 0,    levels: [2, 3] },
];

export function tierFor(viewHeight) {
  return TIERS.findIndex((t) => viewHeight >= t.minView);
}
