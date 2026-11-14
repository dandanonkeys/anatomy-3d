// node --test tools/atlas-quiz.test.mjs   (also run by `npm test`)
// Grading of typed answers in the Body Atlas quiz (src/quiz.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkName } from '../src/quiz.js';

// [answer, target, ignoreSide, expected]
const cases = [
  ['femur', 'Left femur', true, 'correct'],
  ['femor', 'Left femur', true, 'correct'], // one typo in a 5+ letter word
  ['rib', 'Left rib', true, 'correct'],
  ['rob', 'Left rib', true, 'wrong'], // short words must match exactly
  ['ulna', 'Left radius', true, 'wrong'],
  ['brachii biceps', 'Left biceps brachii muscle', true, 'correct'], // word order, filler "muscle"
  ['right femur', 'Right femur', false, 'correct'],
  ['left femur', 'Right femur', false, 'side'],
  ['femur', 'Right femur', false, 'side'], // side missing when sides count
  ['greater trochanter', 'Greater trochanter (left femur)', true, 'correct'], // landmark context dropped
];

for (const [answer, target, ignoreSide, want] of cases) {
  test(`checkName("${answer}", "${target}", ignoreSide=${ignoreSide}) is ${want}`, () => {
    assert.equal(checkName(answer, target, ignoreSide), want);
  });
}

test('checkName accepts an alias', () => {
  assert.equal(checkName('os coxae', 'Left hip bone', true, ['os coxae']), 'correct');
});
