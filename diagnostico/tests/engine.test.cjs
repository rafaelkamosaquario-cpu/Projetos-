'use strict';

const assert = require('node:assert/strict');
const engine = require('../engine.js');

function completeAnswers(valueMap) {
  return Object.assign({
    data_granularity: 'compare_action',
    fuel_reference_quality: 'documented',
    fleet_efficiency_quality: 'documented',
    fuel_vehicle_average: 'compare_action',
    fuel_plate_control: 'compare_action',
    fuel_investigation: 'systematic',
    maintenance_cost_quality: 'documented',
    maintenance_by_plate: 'compare_action',
    maintenance_categories: 'complete',
    maintenance_plan: 'managed',
    maintenance_downtime: 'managed',
    maintenance_supplier_control: 'managed',
    tires_cost_quality: 'documented',
    tires_individual_id: 'managed',
    tires_metrics: 'managed',
    tires_routines: 'managed',
    tires_discards: 'managed',
    tires_purchasing: 'evidence'
  }, valueMap || {});
}

const mature = engine.evaluate(completeAnswers());
assert.deepEqual(mature.pillars.map((pillar) => pillar.level), [3, 3, 3]);
assert.equal(mature.visibility.level, 3);
assert.equal(mature.preliminary, true);
assert.ok(mature.attention.length >= 3 && mature.attention.length <= 5);

const absent = engine.evaluate(completeAnswers({
  data_granularity: 'unknown',
  fuel_reference_quality: 'unknown',
  fleet_efficiency_quality: 'unknown',
  fuel_vehicle_average: 'unknown',
  fuel_plate_control: 'unknown',
  fuel_investigation: 'none',
  maintenance_cost_quality: 'unknown',
  maintenance_by_plate: 'unknown',
  maintenance_categories: 'unknown',
  maintenance_plan: 'none',
  maintenance_downtime: 'none',
  maintenance_supplier_control: 'none',
  tires_cost_quality: 'unknown',
  tires_individual_id: 'none',
  tires_metrics: 'none',
  tires_routines: 'none',
  tires_discards: 'none',
  tires_purchasing: 'price_only'
}));
assert.deepEqual(absent.pillars.map((pillar) => pillar.level), [0, 0, 0]);
assert.equal(absent.priority.name, 'Manutenção');
assert.ok(absent.attention.length >= 3 && absent.attention.length <= 5);
assert.ok(absent.pillars.every((pillar) => pillar.classifications.N > 0));

const estimated = engine.evaluate(completeAnswers({
  data_granularity: 'estimate',
  fuel_reference_quality: 'estimated',
  fleet_efficiency_quality: 'estimated',
  fuel_vehicle_average: 'general_estimate',
  fuel_plate_control: 'general_estimate',
  fuel_investigation: 'informal',
  maintenance_cost_quality: 'estimated',
  maintenance_by_plate: 'general_estimate',
  maintenance_categories: 'single_total',
  maintenance_plan: 'partial',
  maintenance_downtime: 'informal',
  maintenance_supplier_control: 'partial',
  tires_cost_quality: 'estimated',
  tires_individual_id: 'partial',
  tires_metrics: 'partial',
  tires_routines: 'partial',
  tires_discards: 'informal',
  tires_purchasing: 'price_mixed'
}));
assert.deepEqual(estimated.pillars.map((pillar) => pillar.level), [1, 1, 1]);
assert.ok(estimated.estimated.length >= 3);
assert.ok(estimated.pillars.every((pillar) => pillar.classifications.E > 0));

const notApplicable = engine.evaluate(completeAnswers({
  tires_cost_quality: 'na',
  tires_individual_id: 'na',
  tires_metrics: 'na',
  tires_routines: 'na',
  tires_discards: 'na',
  tires_purchasing: 'na'
}));
assert.equal(notApplicable.pillars[2].classifications.NA, 6);
assert.equal(notApplicable.pillars[2].level, 0);
assert.ok(Number.isFinite(notApplicable.pillars[2].average));

assert.equal(engine.levelFromAverage(0.74), 0);
assert.equal(engine.levelFromAverage(0.75), 1);
assert.equal(engine.levelFromAverage(1.75), 2);
assert.equal(engine.levelFromAverage(2.6), 3);

console.log('RodoCore engine: 4 cenários e limites de maturidade aprovados.');
