'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const model = require('../model.js');

function all(classification) {
  return Object.fromEntries(model.QUESTIONS.map((question) => [
    question.key,
    { classification, notes: '' }
  ]));
}

test('defines four pillars with six questions each', () => {
  assert.equal(model.PILLARS.length, 4);
  assert.equal(model.QUESTIONS.length, 24);
  model.PILLARS.forEach((pillar) => assert.equal(pillar.questions.length, 6));
});

test('uses the D/E/N/NA scale and expected scores', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(model.CLASSIFICATIONS).map(([key, value]) => [key, value.score])),
    { D: 3, E: 1, N: 0, NA: null }
  );
});

test('shows conditional fuel question only when vehicle control exists', () => {
  assert.equal(model.isVisible(
    model.QUESTIONS.find((question) => question.key === 'fuel_odometer'),
    { fuel_vehicle: { classification: 'N' } }
  ), false);
  assert.equal(model.isVisible(
    model.QUESTIONS.find((question) => question.key === 'fuel_odometer'),
    { fuel_vehicle: { classification: 'E' } }
  ), true);
});

test('normalizes hidden conditional answers to NA', () => {
  const answers = all('D');
  answers.fuel_vehicle.classification = 'N';
  answers.fuel_odometer = { classification: 'D', notes: 'valor antigo' };
  const normalized = model.normalizeAnswers(answers);
  assert.equal(normalized.fuel_odometer.classification, 'NA');
  assert.equal(normalized.fuel_odometer.hidden, true);
});

test('maps maturity averages to levels zero through three', () => {
  assert.equal(model.levelFromAverage(0.74), 0);
  assert.equal(model.levelFromAverage(0.75), 1);
  assert.equal(model.levelFromAverage(1.75), 2);
  assert.equal(model.levelFromAverage(2.6), 3);
});

test('evaluates all documented answers as maturity three', () => {
  const result = model.evaluate(all('D'));
  assert.deepEqual(result.pillars.map((pillar) => pillar.level), [3, 3, 3, 3]);
  assert.equal(result.strengths.length, 5);
});

test('excludes NA answers from the average', () => {
  const answers = all('NA');
  answers.fuel_spend.classification = 'D';
  const fuel = model.evaluate(answers).pillars.find((pillar) => pillar.key === 'fuel');
  assert.equal(fuel.average, 3);
  assert.equal(fuel.level, 3);
  assert.equal(fuel.applicableCount, 1);
});

test('reports missing visible questions and ignores hidden ones', () => {
  const answers = {
    fuel_vehicle: { classification: 'N' },
    maintenance_history: { classification: 'N' },
    tires_inventory: { classification: 'N' },
    drivers_code: { classification: 'N' }
  };
  const status = model.completeness(answers);
  assert.equal(status.visible, 19);
  assert.equal(status.answered, 4);
  assert.equal(status.missing.some((question) => question.key === 'fuel_odometer'), false);
});

test('prioritizes the lowest scoring pillar and produces practical gaps', () => {
  const answers = all('D');
  model.PILLARS.find((pillar) => pillar.key === 'maintenance').questions.forEach((question) => {
    answers[question.key].classification = 'N';
  });
  const result = model.evaluate(answers);
  assert.equal(result.priority.key, 'maintenance');
  assert.equal(result.gaps[0].pillar, 'Manutenção');
  assert.match(result.disclaimer, /preliminar/i);
});

test('serializes every answer with ownership and no extra personal data', () => {
  const rows = model.toRows('diagnostic-id', 'owner-id', all('D'));
  assert.equal(rows.length, 24);
  assert.equal(rows[0].owner_id, 'owner-id');
  assert.equal(rows[0].diagnostic_id, 'diagnostic-id');
  assert.deepEqual(
    Object.keys(rows[0]).sort(),
    ['answer_payload', 'classification', 'diagnostic_id', 'maturity_score', 'notes', 'owner_id', 'pillar', 'question_key'].sort()
  );
});
