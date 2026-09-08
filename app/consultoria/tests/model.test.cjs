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

test('stores vehicle details and reconciles question two with question one', () => {
  const answers = all('D');
  answers.fuel_spend.details = {
    reference_month: '2026-08',
    monthly_spend: 200000,
    monthly_liters: 30000
  };
  answers.fuel_vehicle.details = {
    fleet_vehicle_count: 40,
    tracked_vehicle_count: 36,
    total_refuels: 520,
    linked_refuels: 490,
    identifier_methods: ['plate', 'internal_code', 'invalid'],
    generic_entries: 'partial',
    six_month_history: 'D',
    annual_history: 'E',
    data_sources: ['fuel_card', 'erp'],
    vehicles: [
      {
        identifier_type: 'plate',
        identifier: 'ABC-1D23',
        initial_odometer: 250000,
        final_odometer: 261500,
        refuel_count: 14,
        liters: 3100,
        spend: 18600,
        ignored_field: 'não deve persistir'
      },
      {
        identifier_type: 'fleet_number',
        identifier: 'FROTA-018',
        initial_odometer: 100000,
        final_odometer: 108000,
        mileage_adjustment: -100,
        refuel_count: 10,
        liters: 2200,
        spend: 13420
      }
    ],
    unassigned_explanation: 'Geradores e lançamentos pendentes.',
    ignored_field: 'não deve persistir'
  };

  const snapshot = model.evaluate(answers).fuelVehicle;
  assert.equal(snapshot.reference_month, '2026-08');
  assert.equal(snapshot.vehicle_coverage_percentage, 90);
  assert.equal(snapshot.refuel_traceability_percentage, 94.23);
  assert.equal(snapshot.vehicles[0].mileage, 11500);
  assert.equal(snapshot.vehicles[0].average_price, 6);
  assert.equal(snapshot.vehicles[0].consumption_km_l, 3.71);
  assert.equal(snapshot.vehicles[0].cost_per_km, 1.62);
  assert.equal(snapshot.vehicles[1].mileage, 7900);
  assert.equal(snapshot.registered_vehicle_liters, 5300);
  assert.equal(snapshot.registered_vehicle_spend, 32020);
  assert.equal(snapshot.liters_difference, 24700);
  assert.equal(snapshot.spend_difference, 167980);
  assert.equal(snapshot.liters_traceability_percentage, 17.67);
  assert.equal(snapshot.spend_traceability_percentage, 16.01);
  assert.deepEqual(snapshot.identifier_methods, ['plate', 'internal_code']);
  assert.equal(snapshot.ignored_field, undefined);

  const row = model.toRows('diagnostic-id', 'owner-id', answers)
    .find((entry) => entry.question_key === 'fuel_vehicle');
  assert.equal(row.answer_payload.details.vehicles[0].identifier, 'ABC-1D23');
  assert.equal(row.answer_payload.details.vehicles[0].ignored_field, undefined);
  assert.equal(row.answer_payload.details.unassigned_explanation, 'Geradores e lançamentos pendentes.');
});
