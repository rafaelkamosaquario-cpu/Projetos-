'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const pdf = require('../pdf.js');

test('builds safe report data without requiring the browser', () => {
  const data = pdf.buildReportData({
    company: { legal_name: 'Transportes Águia Ltda.', fleet_size: 18 },
    contact: { full_name: 'Responsável Operacional' },
    consultantName: 'Consultor Teste',
    diagnostic: { title: 'Diagnóstico Executivo', completed_at: '2026-09-03T12:00:00Z' },
    summary: { pillars: [], priority: { name: 'Pneus', level: 1 }, gaps: [], strengths: [] }
  });
  assert.equal(data.companyName, 'Transportes Águia Ltda.');
  assert.equal(data.fleetSize, '18');
  assert.equal(data.priority.name, 'Pneus');
  assert.match(data.disclaimer, /preliminar/i);
});

test('creates a stable filename without accents or path characters', () => {
  assert.equal(pdf.fileSafe('Transportes Águia / Matriz'), 'transportes-aguia-matriz');
});
