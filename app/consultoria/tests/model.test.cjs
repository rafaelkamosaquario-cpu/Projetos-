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

test('stores maintenance costs and reconciles composition, types and vehicles', () => {
  const answers = all('D');
  answers.maintenance_cost.details = {
    reference_month: '2026-08',
    monthly_total_cost: 100000,
    fleet_vehicle_count: 50,
    maintained_vehicle_count: 20,
    tracked_vehicle_count: 18,
    maintenance_records_count: 30,
    linked_maintenance_records_count: 27,
    identifier_methods: ['plate', 'fleet_number', 'invalid'],
    values_consolidated: 'partial',
    unlinked_costs: 'yes',
    parts_cost: 40000,
    internal_labor_cost: 20000,
    external_services_cost: 15000,
    lubricants_materials_cost: 5000,
    towing_emergency_cost: 2000,
    unrecovered_rework_cost: 3000,
    other_cost: 5000,
    preventive_cost: 30000,
    corrective_cost: 50000,
    predictive_cost: 5000,
    accident_damage_cost: 5000,
    operational_error_cost: 3000,
    warranty_cost: 2000,
    warranty_recovered_cost: 1000,
    downtime_total_hours: 120,
    stopped_vehicle_count: 8,
    vehicle_history_control: 'D',
    preventive_plan_control: 'E',
    downtime_control: 'D',
    flow_separation: 'D',
    warranty_control: 'E',
    six_month_history: 'D',
    six_month_total_cost: 570000,
    annual_history: 'E',
    annual_total_cost: 1180000,
    data_sources: ['erp', 'work_orders', 'invalid'],
    vehicles: [
      {
        identifier_type: 'plate', identifier: 'ABC-1D23', initial_odometer: 250000, final_odometer: 261000,
        maintenance_count: 3, downtime_hours: 36, declared_total_cost: 17000,
        preventive_cost: 5000, corrective_cost: 8000, predictive_cost: 0, accident_damage_cost: 1000,
        operational_error_cost: 2000, warranty_cost: 1000,
        parts_cost: 10000, internal_labor_cost: 2000, external_services_cost: 3000,
        lubricants_materials_cost: 1000, towing_emergency_cost: 0, unrecovered_rework_cost: 0, other_cost: 1000,
        ignored_field: 'não deve persistir'
      },
      {
        identifier_type: 'fleet_number', identifier: 'FROTA-018', initial_odometer: 100000, final_odometer: 108000,
        mileage_adjustment: -200, maintenance_count: 2, downtime_hours: 24, declared_total_cost: 16000,
        preventive_cost: 4000, corrective_cost: 7000, predictive_cost: 1000, accident_damage_cost: 1000,
        operational_error_cost: 2000, warranty_cost: 1000,
        parts_cost: 8000, internal_labor_cost: 1000,
        external_services_cost: 4000, lubricants_materials_cost: 1000, towing_emergency_cost: 1000,
        unrecovered_rework_cost: 0, other_cost: 1000
      }
    ],
    unassigned_explanation: 'Estoque de peças e notas ainda sem rateio.',
    ignored_field: 'não deve persistir'
  };

  const snapshot = model.evaluate(answers).maintenanceCost;
  assert.equal(snapshot.maintained_fleet_percentage, 40);
  assert.equal(snapshot.vehicle_cost_coverage_percentage, 90);
  assert.equal(snapshot.maintenance_record_traceability_percentage, 90);
  assert.equal(snapshot.composition_total, 90000);
  assert.equal(snapshot.composition_difference, 10000);
  assert.equal(snapshot.composition_percentage, 90);
  assert.equal(snapshot.type_total, 95000);
  assert.equal(snapshot.type_difference, 5000);
  assert.equal(snapshot.type_percentage, 95);
  assert.equal(snapshot.warranty_recovery_percentage, 50);
  assert.equal(snapshot.average_downtime_hours, 4);
  assert.equal(snapshot.vehicles[0].mileage, 11000);
  assert.equal(snapshot.vehicles[0].total_cost, 17000);
  assert.equal(snapshot.vehicles[0].flow_total, 17000);
  assert.equal(snapshot.vehicles[0].cost_per_km, 1.55);
  assert.equal(snapshot.vehicles[0].share_of_monthly_cost, 17);
  assert.equal(snapshot.vehicles[1].mileage, 7800);
  assert.equal(snapshot.registered_vehicle_cost, 33000);
  assert.equal(snapshot.registered_vehicle_mileage, 18800);
  assert.equal(snapshot.registered_maintenance_count, 5);
  assert.equal(snapshot.vehicle_cost_difference, 67000);
  assert.equal(snapshot.vehicle_cost_traceability_percentage, 33);
  assert.deepEqual(snapshot.identifier_methods, ['plate', 'fleet_number']);
  assert.deepEqual(snapshot.data_sources, ['erp', 'work_orders']);
  assert.deepEqual(snapshot.warnings, []);
  assert.equal(snapshot.ignored_field, undefined);

  const row = model.toRows('diagnostic-id', 'owner-id', answers)
    .find((entry) => entry.question_key === 'maintenance_cost');
  assert.equal(row.answer_payload.details.vehicles[0].identifier, 'ABC-1D23');
  assert.equal(row.answer_payload.details.vehicles[0].ignored_field, undefined);
  assert.equal(row.answer_payload.details.unassigned_explanation, 'Estoque de peças e notas ainda sem rateio.');
});

test('flags inconsistent maintenance totals and odometers', () => {
  const snapshot = model.maintenanceCostSnapshot({
    monthly_total_cost: 1000,
    fleet_vehicle_count: 2,
    maintained_vehicle_count: 3,
    tracked_vehicle_count: 4,
    maintenance_records_count: 2,
    linked_maintenance_records_count: 3,
    parts_cost: 1200,
    preventive_cost: 1200,
    vehicles: [{ initial_odometer: 2000, final_odometer: 1000, parts_cost: 1200 }]
  });
  assert.equal(snapshot.warnings.length, 7);
  assert.match(snapshot.warnings.join(' '), /hodômetro final/i);
  assert.match(snapshot.warnings.join(' '), /custos por veículo supera/i);
});

test('stores tire identification, costs and flows by vehicle', () => {
  const answers = all('D');
  answers.tires_inventory.details = {
    reference_month: '2026-08',
    monthly_total_cost: 70000,
    fleet_vehicle_count: 40,
    active_tire_count: 360,
    identified_tire_count: 330,
    vehicles_with_tire_map_count: 35,
    tire_movements_count: 90,
    linked_tire_movements_count: 84,
    identifier_methods: ['fire_number', 'rfid', 'invalid'],
    vehicle_link_control: 'D',
    movement_history_control: 'E',
    flow_separation: 'D',
    warranty_control: 'E',
    downtime_control: 'D',
    values_consolidated: 'partial',
    unidentified_costs: 'yes',
    new_tire_cost: 25000,
    retread_cost: 15000,
    repair_cost: 5000,
    preventive_service_cost: 3000,
    accident_damage_cost: 5000,
    operational_error_cost: 4000,
    warranty_cost: 2000,
    disposal_cost: 1000,
    warranty_recovered_cost: 1000,
    downtime_total_hours: 90,
    stopped_vehicle_count: 6,
    six_month_history: 'D',
    six_month_total_cost: 410000,
    annual_history: 'E',
    annual_total_cost: 830000,
    data_sources: ['tire_system', 'service_orders', 'invalid'],
    vehicles: [
      {
        identifier_type: 'plate', identifier: 'ABC-1D23', tires_in_operation: 10, identified_tires: 10,
        initial_odometer: 250000, final_odometer: 260000, movement_count: 4, downtime_hours: 8,
        declared_total_cost: 8000, new_tire_cost: 3000, retread_cost: 2000, repair_cost: 500,
        preventive_service_cost: 500, accident_damage_cost: 500, operational_error_cost: 1000,
        warranty_cost: 300, disposal_cost: 200, ignored_field: 'não deve persistir'
      },
      {
        identifier_type: 'fleet_number', identifier: 'FROTA-018', tires_in_operation: 8, identified_tires: 6,
        initial_odometer: 100000, final_odometer: 107000, mileage_adjustment: -100, movement_count: 2,
        downtime_hours: 4, declared_total_cost: 5000, new_tire_cost: 2000, retread_cost: 1500,
        repair_cost: 500, preventive_service_cost: 200, accident_damage_cost: 300,
        operational_error_cost: 300, warranty_cost: 100, disposal_cost: 100
      }
    ],
    unassigned_explanation: 'Pneus em estoque e notas ainda sem rateio.',
    ignored_field: 'não deve persistir'
  };

  const snapshot = model.evaluate(answers).tireInventory;
  assert.equal(snapshot.tire_identification_percentage, 91.67);
  assert.equal(snapshot.vehicle_map_coverage_percentage, 87.5);
  assert.equal(snapshot.movement_traceability_percentage, 93.33);
  assert.equal(snapshot.flow_total, 60000);
  assert.equal(snapshot.flow_difference, 10000);
  assert.equal(snapshot.flow_percentage, 85.71);
  assert.equal(snapshot.warranty_recovery_percentage, 50);
  assert.equal(snapshot.average_downtime_hours, 1);
  assert.equal(snapshot.vehicles[0].identification_percentage, 100);
  assert.equal(snapshot.vehicles[0].mileage, 10000);
  assert.equal(snapshot.vehicles[0].flow_total, 8000);
  assert.equal(snapshot.vehicles[0].total_cost, 8000);
  assert.equal(snapshot.vehicles[0].cost_per_km, 0.8);
  assert.equal(snapshot.vehicles[0].share_of_monthly_cost, 11.43);
  assert.equal(snapshot.vehicles[1].identification_percentage, 75);
  assert.equal(snapshot.vehicles[1].mileage, 6900);
  assert.equal(snapshot.registered_vehicle_cost, 13000);
  assert.equal(snapshot.registered_vehicle_mileage, 16900);
  assert.equal(snapshot.vehicle_cost_difference, 57000);
  assert.equal(snapshot.vehicle_cost_traceability_percentage, 18.57);
  assert.equal(snapshot.fleet_cost_per_km, 4.14);
  assert.deepEqual(snapshot.identifier_methods, ['fire_number', 'rfid']);
  assert.deepEqual(snapshot.data_sources, ['tire_system', 'service_orders']);
  assert.deepEqual(snapshot.warnings, []);
  assert.equal(snapshot.ignored_field, undefined);

  const row = model.toRows('diagnostic-id', 'owner-id', answers)
    .find((entry) => entry.question_key === 'tires_inventory');
  assert.equal(row.answer_payload.details.vehicles[0].identifier, 'ABC-1D23');
  assert.equal(row.answer_payload.details.vehicles[0].ignored_field, undefined);
  assert.equal(row.answer_payload.details.unassigned_explanation, 'Pneus em estoque e notas ainda sem rateio.');
});
