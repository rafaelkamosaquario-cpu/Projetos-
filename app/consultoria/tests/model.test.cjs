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

test('stores and summarizes the structured details from fuel question one', () => {
  const answers = all('D');
  answers.fuel_spend.details = {
    monthly_spend: 200000,
    monthly_liters: 30000,
    reference_month: '2026-08',
    six_month_history: 'E',
    six_month_spend: 1180000,
    six_month_liters: 180000,
    annual_history: 'N',
    fuel_types: ['diesel_s10', 'arla32', 'invalid'],
    data_sources: ['fuel_card', 'invoices'],
    payment_methods: ['bank_slip'],
    values_consolidated: 'partial',
    internal_station: 'yes',
    internal_monthly_liters: 20000,
    external_monthly_liters: 10000,
    external_stations: 'Posto Rodovia — unidade matriz',
    ignored_field: 'não deve persistir'
  };

  const result = model.evaluate(answers);
  assert.equal(result.fuelSpend.monthly_average_price, 6.6667);
  assert.equal(result.fuelSpend.reference_month, '2026-08');
  assert.deepEqual(result.fuelSpend.fuel_types, ['diesel_s10', 'arla32']);
  assert.equal(result.fuelSpend.ignored_field, undefined);

  const row = model.toRows('diagnostic-id', 'owner-id', answers)
    .find((entry) => entry.question_key === 'fuel_spend');
  assert.equal(row.answer_payload.details.monthly_spend, 200000);
  assert.equal(row.answer_payload.details.external_stations, 'Posto Rodovia — unidade matriz');
  assert.equal(row.answer_payload.details.ignored_field, undefined);
});
