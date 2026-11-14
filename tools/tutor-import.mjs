#!/usr/bin/env node
// Merge a Body Atlas quiz export into claude-tutor's progress data.
//
//   node tools/tutor-import.mjs <export.json> [--topic <slug>] [--dry-run]
//
// Writes ~/.claude/learning/progress/<slug>.json in claude-tutor's schema
// (topic, quizzes, weakAreas, strongAreas, overallScore, spacedRepetition):
// appends the export's quiz, recomputes weak/strong areas and overall score from
// all quizzes, and updates SM-2 spaced repetition per concept, using the same
// rules as the plugin's dashboard (validate.js). Also updates index.json.
// The previous progress file is kept as <slug>.json.bak.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const dryRun = args.includes('--dry-run');
if (!file) {
  console.error('Usage: node tools/tutor-import.mjs <body-atlas-quiz-*.json> [--topic <slug>] [--dry-run]');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
if (data.schema !== 'body-atlas-quiz/1' || !data.tutorQuiz) {
  console.error(`${file} is not a Body Atlas quiz export (schema body-atlas-quiz/1).`);
  process.exit(1);
}
const slug = (flag('topic') ?? data.topic ?? 'body-atlas').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const dir = path.join(os.homedir(), '.claude', 'learning');
const progressPath = path.join(dir, 'progress', `${slug}.json`);
const indexPath = path.join(dir, 'index.json');
const readJSON = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);

const progress = readJSON(progressPath, { topic: slug, quizzes: [], weakAreas: [], strongAreas: [], overallScore: 0, spacedRepetition: {} });
progress.quizzes ??= [];
progress.spacedRepetition ??= {};

// Don't import the same export twice.
const sig = (qz) => JSON.stringify([qz.date, qz.score, qz.total, qz.questions]);
if (progress.quizzes.some((qz) => sig(qz) === sig(data.tutorQuiz))) {
  console.log(`Already imported into ${progressPath}; nothing to do.`);
  process.exit(0);
}
progress.quizzes.push(data.tutorQuiz);

// SM-2, as in claude-tutor's dashboard: correct = quality 5, incorrect = 0.
function updateSM2(existing, correct) {
  const quality = correct ? 5 : 0;
  let ef = existing?.easeFactor || 2.5;
  let interval = existing?.intervalDays || 1;
  let reps = existing?.repetitions || 0;
  if (quality >= 3) {
    reps += 1;
    interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(interval * ef);
  } else {
    reps = 0;
    interval = 1;
  }
  ef = Math.max(1.3, ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const next = new Date();
  next.setDate(next.getDate() + interval);
  return { easeFactor: Math.round(ef * 100) / 100, intervalDays: interval, nextReview: next.toLocaleDateString('sv-SE'), repetitions: reps };
}

// One review per concept per import: it counts as recalled only if every
// attempt at it in this export was correct.
const perConcept = new Map();
for (const q of data.tutorQuiz.questions) perConcept.set(q.concept, (perConcept.get(q.concept) ?? true) && q.correct);
for (const [concept, ok] of perConcept) progress.spacedRepetition[concept] = updateSM2(progress.spacedRepetition[concept], ok);

const stats = {};
for (const qz of progress.quizzes) for (const q of qz.questions ?? []) {
  const s = (stats[q.concept] ??= { correct: 0, total: 0 });
  s.total++;
  if (q.correct) s.correct++;
}
const entries = Object.entries(stats);
progress.weakAreas = entries.filter(([, s]) => s.correct / s.total < 0.5).map(([c]) => c);
progress.strongAreas = entries.filter(([, s]) => s.correct / s.total >= 0.8).map(([c]) => c);
const tot = entries.reduce((n, [, s]) => n + s.total, 0);
progress.overallScore = Math.round((entries.reduce((n, [, s]) => n + s.correct, 0) / Math.max(1, tot)) * 100);

// Only the fields claude-tutor allows, in its order.
const out = {
  topic: progress.topic ?? slug,
  quizzes: progress.quizzes,
  weakAreas: progress.weakAreas,
  strongAreas: progress.strongAreas,
  overallScore: progress.overallScore,
  spacedRepetition: progress.spacedRepetition,
};

const index = readJSON(indexPath, { topics: {} });
index.topics ??= {};
const today = new Date().toLocaleDateString('sv-SE');
const entry = index.topics[slug] ?? {
  displayName: 'Body Atlas anatomy', planFile: null, progressFile: `progress/${slug}.json`, created: today,
  level: data.tutorQuiz.difficulty, modulesCompleted: 0, modulesTotal: 0,
};
Object.assign(entry, { quizzesTaken: out.quizzes.length, overallScore: out.overallScore, lastActivity: today });
index.topics[slug] = entry;

const missed = [...perConcept].filter(([, ok]) => !ok).map(([c]) => c);
console.log(`Topic: ${slug}${fs.existsSync(progressPath) ? '' : ' (new progress file)'}`);
console.log(`This quiz: ${data.tutorQuiz.score}/${data.tutorQuiz.total}, ${perConcept.size} concepts, ${missed.length} missed`);
if (missed.length) console.log(`  missed: ${missed.join(', ')}`);
console.log(`Overall: ${out.overallScore}% over ${out.quizzes.length} quizzes; ${out.weakAreas.length} weak, ${out.strongAreas.length} strong areas`);

if (dryRun) {
  console.log('\n--dry-run: nothing written.');
  process.exit(0);
}
fs.mkdirSync(path.dirname(progressPath), { recursive: true });
if (fs.existsSync(progressPath)) fs.copyFileSync(progressPath, `${progressPath}.bak`);
fs.writeFileSync(progressPath, JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`\nWrote ${progressPath}\nUpdated ${indexPath}`);
