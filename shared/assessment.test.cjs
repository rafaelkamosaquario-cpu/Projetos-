const test = require('node:test');
const assert = require('node:assert/strict');
const a = require('./assessment');
const model = require('../app/consultoria/model');
const pdf = require('../app/consultoria/pdf');
test('missing is not zero; invalid inputs are not interpreted as valid costs', () => {
  const v = a.normalize({fuel:'', tires:0, maintenance:'1.000,00', total:'-10', drivers:'12500,50'});
  assert.equal(v.fuel,null); assert.equal(v.tires,0); assert.equal(v.maintenance,null);
  assert.equal(v.total,null); assert.equal(v.drivers,12500.5);
});
test('uses total costs, not revenue, and suppresses inconsistent percentages', () => {
  const c = a.calculate({total:100000,revenue:150000,fuel:40000,tires:5000});
  assert.equal(c.rows[0].share,40); assert.equal(c.sum,45000);
  assert.equal(a.calculate({total:100,fuel:200}).rows[0].share,null);
  assert.equal(a.calculate({total:0,fuel:0}).valid,false);
});
test('investment and claims memorandum do not double count operating costs', () => {
  assert.equal(a.calculate({total:100,fuel:40,claims:15,investments:500}).sum,40);
});
test('historical rounded weights preserved, never used to score maturity', () => {
  const sum = a.calculate({}).rows.reduce((n,r)=>n+(r.reference||0),0);
  assert.ok(Math.abs(sum-100.3)<0.001);
  const first = model.evaluate({fuel_spend:{classification:'D',details:{}}});
  const second = model.evaluate({fuel_spend:{classification:'D',details:{assessment:{total:100,fuel:90}}}});
  assert.deepEqual(first.pillars.map(p=>[p.key,p.level,p.counts]),second.pillars.map(p=>[p.key,p.level,p.counts]));
});
test('assessment survives database payload normalization, summary and PDF data', () => {
  const answers = {fuel_spend:{classification:'E',details:{assessment:{total:100000,fuel:40000,owner:'Consultor teste',action:'Conferir notas',quality:'estimated'}}}};
  const rows=model.toRows('diagnostic-test','owner-test',answers);
  const row=rows.find(r=>r.question_key==='fuel_spend');
  const restored=model.normalizeQuestionDetails('fuel_spend',row.answer_payload.details);
  assert.equal(restored.assessment.owner,'Consultor teste');
  const summary=model.evaluate({fuel_spend:{classification:'E',details:restored}});
  assert.equal(pdf.buildReportData({summary}).assessment.fuel,40000);
  assert.ok(a.reportLines(summary.assessment).some(l=>l.includes('Conferir notas')));
});
test('escapes user data and public collection isolates prefixed fields', () => {
  const v=a.fromAnswers({rc_scope:'<img src=x onerror=alert(1)>',contact_name:'private',rc_total:'100'});
  assert.equal(v.contact_name,undefined); assert.equal(v.total,100);
  assert.ok(!a.render(v).includes('<img')); assert.ok(a.render(v).includes('&lt;img'));
  assert.ok(a.render(v).includes('2021')); assert.ok(a.render(v).includes('não são') || a.render(v).includes('Não são'));
});
