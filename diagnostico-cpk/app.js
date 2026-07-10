'use strict';

/* ── BENCHMARKS ─────────────────────────────────────────────────────────── */
const BM = {
  comb: {
    controlConsumo: 0.065, // 5–8% (Cobli/GolFleet/MiX Telematics)
    ecodriving:     0.10,  // 8–15% (Volvo Trucks BR / Scania Brasil / ICCT)
  },
  mant: {
    ratioIdealCorr: 0.20, // máx 20% corretiva (Geotab Brasil / CNT)
    excessoCorr:    0.30, // +30% custo corretiva>prev (Geotab / ANFAVEA)
    semPlano:       0.25, // sem plano = +25% (NTC&Logística)
    parcial:        0.12,
    quebras:        0.08,
  },
  pneu: {
    semRecap:    0.38, // 35–40% mais caro sem recapagem (Bandag/Bridgestone)
    umaRecap:    0.17, // com 1 vs 2 recapagens (Bandag)
    pressao_comb: 0.03, // +3% combustível com pressão errada (ANIP/Mercedes-Benz)
    pressao_pneu: 0.12,
    rodizio:      0.15, // +20% vida útil (ProLog App)
    alinhamento:  0.12, // +15–20% vida útil (ProLog App)
  },
  cpk: { // CPK parcial combustível+manutenção+pneus ≈ 58–69% do total
    Leve:   { min: 0.70, max: 1.30, label: 'VUC / Furgão' },
    Média:  { min: 1.20, max: 2.10, label: 'Toco / Truck' },
    Pesada: { min: 2.00, max: 3.60, label: 'Carreta / Bitrem' },
  },
};

/* ── FORM STATE ─────────────────────────────────────────────────────────── */
const state = {
  frota:      null, // Leve | Média | Pesada
  veiculos:   0,
  km_mes:     0,
  comb_litros: 0,
  comb_preco:  0,
  comb_controle: null,  // sim | nao
  comb_eco:      null,  // sim | nao
  mant_plano:    null,  // sim | parcial | nao
  mant_tipo:     null,  // prev | mista | corr
  mant_custo:    0,
  pneu_custo:    0,
  pneu_recap:    null,  // duas | uma | nao
  pneu_pressao:  null,  // sim | nao
  pneu_rodizio:  null,  // sim | nao
  pneu_alinham:  null,  // sim | nao
  nome:          null,
  whatsapp:      null,
};

/* ── NAVIGATION ─────────────────────────────────────────────────────────── */
let currentStep = 0; // 0=landing, 1-6=form steps, 7=result
const TOTAL_STEPS = 6;

function show(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function startForm() {
  currentStep = 1;
  show('step-1');
  updateTopbar();
}

function goNext() {
  if (!validateStep(currentStep)) return;
  collectStep(currentStep);
  if (currentStep === TOTAL_STEPS) {
    currentStep = 7;
    show('lead-capture');
  } else {
    currentStep++;
    show('step-' + currentStep);
    updateTopbar();
  }
}

function goBack() {
  if (currentStep === 7) {
    currentStep = TOTAL_STEPS;
    show('step-' + TOTAL_STEPS);
    updateTopbar();
    return;
  }
  if (currentStep <= 1) {
    currentStep = 0;
    show('landing');
    return;
  }
  currentStep--;
  show('step-' + currentStep);
  updateTopbar();
}

function restart() {
  currentStep = 0;
  Object.keys(state).forEach(k => {
    state[k] = typeof state[k] === 'number' ? 0 : null;
  });
  show('landing');
}

function submitLead() {
  const nome = (document.getElementById('lead-nome').value || '').trim();
  const wpp  = (document.getElementById('lead-whatsapp').value || '').trim();
  if (!nome) { showError('Informe seu nome.'); return; }
  if (!wpp || wpp.replace(/\D/g, '').length < 10) { showError('Informe um WhatsApp válido.'); return; }
  state.nome     = nome;
  state.whatsapp = wpp;
  buildResult();
  show('result');
  currentStep = 8;
}

function skipLead() {
  state.nome     = null;
  state.whatsapp = null;
  buildResult();
  show('result');
  currentStep = 8;
}

function abrirWhatsApp() {
  const r = window._lastResult;
  const economia = r ? fmt(r.totalEconomia) : '';
  const saudacao = state.nome ? 'Olá, sou ' + state.nome + '.' : 'Olá!';
  const msg = encodeURIComponent(
    saudacao + ' Fiz o diagnóstico da minha frota ' + (state.frota || '') +
    ' (' + state.veiculos + ' veículos) e identifiquei potencial de economia de ' +
    economia + '/mês. Gostaria de conversar sobre como implementar.'
  );
  window.open('https://wa.me/5542998582489?text=' + msg, '_blank');
}

function updateCombPreview() {
  const litros = parseFloat((document.getElementById('comb_litros').value || '').replace(',', '.')) || 0;
  const preco  = parseFloat((document.getElementById('comb_preco').value  || '').replace(',', '.')) || 0;
  const box = document.getElementById('comb-preview-box');
  const txt = document.getElementById('comb-preview-txt');
  if (!box || !txt) return;
  if (litros > 0 && preco > 0 && state.km_mes > 0 && state.veiculos > 0) {
    const custo = (state.km_mes / litros) * preco * state.veiculos;
    txt.textContent = 'Estimativa de combustível: ' + fmt(custo) + '/mês — isso parece correto?';
    box.style.display = '';
  } else {
    box.style.display = 'none';
  }
}

function updateTopbar() {
  const el = document.getElementById('step-counter-' + currentStep);
  if (el) el.textContent = 'Etapa ' + currentStep + ' de ' + TOTAL_STEPS;
  const bar = document.getElementById('progress-bar-' + currentStep);
  if (bar) bar.style.width = ((currentStep / TOTAL_STEPS) * 100) + '%';
}

/* ── VALIDATION ─────────────────────────────────────────────────────────── */
function showError(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 3000);
}

function getRadio(name) {
  const el = document.querySelector('input[name="' + name + '"]:checked');
  return el ? el.value : null;
}

function getNum(id) {
  const el = document.getElementById(id);
  return el ? parseFloat(el.value.replace(',', '.')) || 0 : 0;
}

function validateStep(step) {
  switch (step) {
    case 1:
      if (!getRadio('frota')) { showError('Selecione o tipo de frota.'); return false; }
      if (!getNum('veiculos') || getNum('veiculos') < 1) { showError('Informe a quantidade de veículos.'); return false; }
      if (!getNum('km_mes') || getNum('km_mes') < 1) { showError('Informe a média de km/mês por veículo.'); return false; }
      return true;
    case 2:
      if (!getNum('comb_litros') || getNum('comb_litros') <= 0) { showError('Informe o consumo médio (km/l).'); return false; }
      if (!getNum('comb_preco') || getNum('comb_preco') <= 0) { showError('Informe o preço do combustível.'); return false; }
      if (!getRadio('comb_controle')) { showError('Indique se há controle de consumo.'); return false; }
      if (!getRadio('comb_eco')) { showError('Indique se há política de condução econômica.'); return false; }
      return true;
    case 3:
      if (!getNum('mant_custo') || getNum('mant_custo') <= 0) { showError('Informe o custo mensal de manutenção.'); return false; }
      if (!getRadio('mant_plano')) { showError('Indique o tipo de plano de manutenção.'); return false; }
      if (!getRadio('mant_tipo')) { showError('Indique o perfil de manutenção atual.'); return false; }
      return true;
    case 4:
      if (!getNum('pneu_custo') || getNum('pneu_custo') <= 0) { showError('Informe o custo mensal com pneus.'); return false; }
      if (!getRadio('pneu_recap')) { showError('Indique a política de recapagem.'); return false; }
      return true;
    case 5:
      if (!getRadio('pneu_pressao')) { showError('Indique se há controle de pressão.'); return false; }
      if (!getRadio('pneu_rodizio')) { showError('Indique se há rodízio periódico.'); return false; }
      if (!getRadio('pneu_alinham')) { showError('Indique se há alinhamento periódico.'); return false; }
      return true;
    case 6:
      return true;
    default:
      return true;
  }
}

/* ── DATA COLLECTION ────────────────────────────────────────────────────── */
function collectStep(step) {
  switch (step) {
    case 1:
      state.frota    = getRadio('frota');
      state.veiculos = getNum('veiculos');
      state.km_mes   = getNum('km_mes');
      break;
    case 2:
      state.comb_litros  = getNum('comb_litros');
      state.comb_preco   = getNum('comb_preco');
      state.comb_controle = getRadio('comb_controle');
      state.comb_eco      = getRadio('comb_eco');
      break;
    case 3:
      state.mant_custo = getNum('mant_custo');
      state.mant_plano = getRadio('mant_plano');
      state.mant_tipo  = getRadio('mant_tipo');
      break;
    case 4:
      state.pneu_custo = getNum('pneu_custo');
      state.pneu_recap = getRadio('pneu_recap');
      break;
    case 5:
      state.pneu_pressao = getRadio('pneu_pressao');
      state.pneu_rodizio = getRadio('pneu_rodizio');
      state.pneu_alinham = getRadio('pneu_alinham');
      break;
  }
}

/* ── CALCULATIONS ───────────────────────────────────────────────────────── */
function calcCombustivel() {
  const custoAtual = (state.km_mes / state.comb_litros) * state.comb_preco * state.veiculos;
  let economia = 0;
  const atencao = [];

  if (state.comb_controle === 'nao') {
    economia += custoAtual * BM.comb.controlConsumo;
    atencao.push('Sem controle de consumo por veículo – perda de eficiência não identificada');
  }
  if (state.comb_eco === 'nao') {
    economia += custoAtual * BM.comb.ecodriving;
    atencao.push('Sem política de condução econômica – desperdício de combustível');
  }
  return { custoAtual, economia, atencao };
}

function calcManutencao() {
  const custoAtual = state.mant_custo;
  let economia = 0;
  const atencao = [];

  if (state.mant_plano === 'nao') {
    economia += custoAtual * BM.mant.semPlano;
    atencao.push('Sem plano de manutenção definido – custo fora de controle');
  } else if (state.mant_plano === 'parcial') {
    economia += custoAtual * BM.mant.parcial;
  }

  if (state.mant_tipo === 'corr') {
    const excess = custoAtual * BM.mant.excessoCorr;
    economia += excess;
    atencao.push('Manutenção 100% corretiva – custo fora de controle (ideal: máx. 20%)');
  } else if (state.mant_tipo === 'mista') {
    const corrRatio = 0.40;
    if (corrRatio > BM.mant.ratioIdealCorr) {
      const pct = Math.round(corrRatio * 100);
      economia += custoAtual * BM.mant.quebras;
      atencao.push('Manutenção corretiva em ' + pct + '% – custo fora de controle (ideal: máx. 20%)');
    }
  }

  return { custoAtual, economia, atencao };
}

function calcPneus() {
  const custoAtual = state.pneu_custo;
  let economia = 0;
  const atencao = [];

  if (state.pneu_pressao === 'nao') {
    economia += custoAtual * BM.pneu.pressao_pneu;
    atencao.push('Sem controle de pressão – principal causa de desgaste prematuro dos pneus');
  }
  if (state.pneu_rodizio === 'nao') {
    economia += custoAtual * BM.pneu.rodizio;
    atencao.push('Sem rodízio periódico – redução da vida útil dos pneus');
  }
  if (state.pneu_alinham === 'nao') {
    economia += custoAtual * BM.pneu.alinhamento;
    atencao.push('Sem alinhamento periódico – desgaste irregular dos pneus');
  }
  if (state.pneu_recap === 'nao') {
    economia += custoAtual * BM.pneu.semRecap;
    atencao.push('Nenhuma recapagem utilizada – custo altíssimo operando apenas com pneus novos');
  } else if (state.pneu_recap === 'uma') {
    economia += custoAtual * BM.pneu.umaRecap;
  }

  const cap = custoAtual * 0.70;
  if (economia > cap) economia = cap;

  return { custoAtual, economia, atencao };
}

function calcCPK(custoTotalMes, kmMes, veiculos) {
  const totalKm = kmMes * veiculos;
  return totalKm > 0 ? custoTotalMes / totalKm : 0;
}

/* ── RESULT RENDERING ───────────────────────────────────────────────────── */
function fmt(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDec(val, dec) {
  return val.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtNum(val) {
  return val.toLocaleString('pt-BR');
}

function cpkStatus(cpk) {
  const bm = BM.cpk[state.frota] || BM.cpk['Média'];
  if (cpk <= bm.min) return { label: 'Excelente', cls: 'green' };
  if (cpk <= bm.max) return { label: 'Na média do setor', cls: 'yellow' };
  return { label: 'Acima da média do setor', cls: 'red' };
}

function renderAtencao(items) {
  if (!items.length) return '';
  return items.map(function(txt) {
    return '<div class="attn-item"><span class="attn-dot red"></span><span>' + txt + '</span></div>';
  }).join('');
}

function countUp(id, target, prefix, suffix, duration) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = Date.now();
  function tick() {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(target * ease);
    el.textContent = prefix + fmtNum(current) + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }
  tick();
}

function setGauge(cpkAtual, cpkOtim, bmMin, bmMax) {
  const scale = bmMax * 1.8;
  const clamp = function(v) { return Math.min(Math.max(v / scale * 100, 2), 97); };

  const rangeStart = clamp(bmMin);
  const rangeEnd   = clamp(bmMax);
  const dotAtual   = clamp(cpkAtual);
  const dotOtim    = clamp(cpkOtim);

  const rangeEl = document.getElementById('res-gauge-range');
  if (rangeEl) {
    rangeEl.style.left  = rangeStart + '%';
    rangeEl.style.width = (rangeEnd - rangeStart) + '%';
  }
  const dAtual = document.getElementById('res-gauge-dot-atual');
  if (dAtual) dAtual.style.left = dotAtual + '%';
  const dOtim = document.getElementById('res-gauge-dot-otim');
  if (dOtim) dOtim.style.left = dotOtim + '%';

  setText('res-gauge-min', 'R$ ' + fmtDec(bmMin, 2));
  setText('res-gauge-max', 'R$ ' + fmtDec(bmMax, 2));
}

function setPillarCard(prefix, custo, economia) {
  const pct = custo > 0 ? Math.round((economia / custo) * 100) : 0;
  const barW = Math.min(pct, 100);
  setText(prefix + '-custo', fmt(custo));
  setText(prefix + '-eco',   fmt(economia));
  setText(prefix + '-pct',   pct + '%');
  const bar = document.getElementById(prefix + '-bar');
  if (bar) setTimeout(function() { bar.style.width = barW + '%'; }, 200);
}

function buildResult() {
  const comb = calcCombustivel();
  const mant = calcManutencao();
  const pneu = calcPneus();

  const totalEconomia = comb.economia + mant.economia + pneu.economia;
  const totalAtual    = comb.custoAtual + mant.custoAtual + pneu.custoAtual;
  const cpkAtual      = calcCPK(totalAtual, state.km_mes, state.veiculos);
  const cpkOtim       = calcCPK(totalAtual - totalEconomia, state.km_mes, state.veiculos);
  const cpkBM         = BM.cpk[state.frota] || BM.cpk['Média'];
  const cpkSt         = cpkStatus(cpkAtual);
  const pctEco        = totalAtual > 0 ? Math.round((totalEconomia / totalAtual) * 100) : 0;
  const allAttn       = [].concat(comb.atencao, mant.atencao, pneu.atencao);

  /* fleet summary */
  setText('res-frota-tipo',     state.frota);
  setText('res-frota-veiculos', state.veiculos + ' veíc.');
  setText('res-frota-km',       fmtNum(state.km_mes) + ' km');

  /* hero count-up */
  countUp('res-economia-mes', totalEconomia, 'R$ ', '', 1200);
  setTimeout(function() {
    setText('res-economia-ano', fmt(totalEconomia * 12));
  }, 1200);

  /* CPK */
  setText('res-cpk-atual',  'R$ ' + fmtDec(cpkAtual, 2));
  setText('res-cpk-otim',   'R$ ' + fmtDec(cpkOtim, 2));
  setText('res-cpk-badge',  cpkSt.label);
  setClass('res-cpk-badge', 'badge-pill ' + cpkSt.cls);
  setText('res-bench-range', 'Ref: R$ ' + fmtDec(cpkBM.min, 2) + '–' + fmtDec(cpkBM.max, 2) + '/km (' + cpkBM.label + ')');
  setTimeout(function() { setGauge(cpkAtual, cpkOtim, cpkBM.min, cpkBM.max); }, 100);

  /* pillar cards */
  setPillarCard('res-comb', comb.custoAtual, comb.economia);
  setPillarCard('res-mant', mant.custoAtual, mant.economia);
  setPillarCard('res-pneu', pneu.custoAtual, pneu.economia);

  /* eco total */
  setText('res-eco-mes-big', fmt(totalEconomia));
  setText('res-eco-ano-big', fmt(totalEconomia * 12));
  setText('res-pct-eco', pctEco + '%');
  const ecoBar = document.getElementById('res-eco-bar');
  if (ecoBar) setTimeout(function() { ecoBar.style.width = Math.min(pctEco, 100) + '%'; }, 300);

  /* attention */
  const attnEl = document.getElementById('res-atencao');
  if (attnEl) {
    if (allAttn.length) {
      attnEl.innerHTML = renderAtencao(allAttn);
      document.getElementById('attn-section').style.display = '';
    } else {
      document.getElementById('attn-section').style.display = 'none';
    }
  }

  /* store last result for PDF */
  window._lastResult = { comb, mant, pneu, totalEconomia, totalAtual, cpkAtual, cpkOtim, cpkBM, cpkSt, pctEco, allAttn };

  /* segmented CTA message */
  const v = state.veiculos;
  let ctaMsg = '';
  if      (v >= 50) ctaMsg = 'Para frotas acima de 50 veículos, desenvolvemos um plano de gestão completo com acompanhamento mensal de CPK.';
  else if (v >= 20) ctaMsg = 'Para frotas acima de 20 veículos, criamos um plano de ação personalizado por pilar com metas e cronograma.';
  else if (v >= 5)  ctaMsg = 'Nosso time pode ajudar sua frota a atingir esse potencial com um plano de ação prático e mensurável.';
  else              ctaMsg = 'Mesmo em frotas menores, a otimização de CPK tem retorno rápido. Vamos detalhar as oportunidades identificadas?';
  setText('cta-segment-msg', ctaMsg);
  if (state.nome) setText('cta-greeting', state.nome + ', quer implementar essas melhorias?');
}

/* ── PDF GENERATION ─────────────────────────────────────────────────────── */
function gerarPDF() {
  const r = window._lastResult;
  if (!r) return;
  const hoje = new Date().toLocaleDateString('pt-BR');

  const attnHTML = r.allAttn.length
    ? r.allAttn.map(t => '<li>' + t + '</li>').join('')
    : '<li>Nenhum ponto crítico identificado.</li>';

  const html = '\
<html><head><meta charset="UTF-8">\
<style>\
  @page { size: A4; margin: 18mm 16mm; }\
  body { font-family: Arial, sans-serif; font-size: 12px; color: #0F172A; line-height: 1.5; }\
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563EB; padding-bottom: 10px; margin-bottom: 18px; }\
  .header h1 { font-size: 18px; font-weight: 900; color: #2563EB; margin: 0; }\
  .header p  { font-size: 10px; color: #64748B; margin: 2px 0 0; }\
  .date { font-size: 10px; color: #64748B; text-align: right; }\
  .hero-box { background: #0F172A; color: #fff; border-radius: 8px; padding: 16px 20px; margin-bottom: 14px; text-align: center; }\
  .hero-box .lbl { font-size: 10px; color: rgba(255,255,255,.6); text-transform: uppercase; letter-spacing: .5px; }\
  .hero-box .val { font-size: 32px; font-weight: 900; color: #22C55E; line-height: 1.1; }\
  .hero-box .sub { font-size: 12px; color: rgba(255,255,255,.6); margin-top: 4px; }\
  .strip { display: flex; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 14px; overflow: hidden; }\
  .strip-item { flex: 1; padding: 10px; text-align: center; border-right: 1px solid #E2E8F0; }\
  .strip-item:last-child { border-right: none; }\
  .strip-lbl { font-size: 9px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: .4px; }\
  .strip-val { font-size: 13px; font-weight: 700; color: #0F172A; }\
  .section-title { font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: .5px; margin: 14px 0 8px; }\
  .cpk-row { display: flex; gap: 10px; margin-bottom: 14px; }\
  .cpk-box { flex: 1; border: 1.5px solid #E2E8F0; border-radius: 8px; padding: 12px; text-align: center; }\
  .cpk-box.atual { border-color: #EF4444; }\
  .cpk-box.otim  { border-color: #22C55E; }\
  .cpk-lbl { font-size: 9px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: .4px; }\
  .cpk-val { font-size: 22px; font-weight: 900; color: #0F172A; }\
  .cpk-val.green { color: #16A34A; }\
  .cpk-bench { font-size: 9px; color: #64748B; margin-top: 6px; padding: 6px; background: #F0FDF4; border-radius: 4px; }\
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }\
  th { background: #F8FAFC; font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: .4px; padding: 8px 10px; text-align: left; border-bottom: 1px solid #E2E8F0; }\
  td { padding: 9px 10px; font-size: 12px; border-bottom: 1px solid #F1F5F9; }\
  td.eco { font-weight: 700; color: #16A34A; }\
  td.pct { font-weight: 700; color: #16A34A; text-align: right; }\
  tr.total td { font-weight: 800; border-top: 2px solid #E2E8F0; background: #F8FAFC; }\
  .eco-box { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px; overflow: hidden; }\
  .eco-box .left { float: left; }\
  .eco-box .left .lbl { font-size: 9px; font-weight: 700; color: #16A34A; text-transform: uppercase; letter-spacing: .5px; }\
  .eco-box .left .mes { font-size: 26px; font-weight: 900; color: #16A34A; line-height: 1.1; }\
  .eco-box .left .ano { font-size: 13px; color: #16A34A; }\
  .eco-box .right { float: right; text-align: right; }\
  .eco-box .right .pct-val { font-size: 28px; font-weight: 900; color: #16A34A; line-height: 1; }\
  .eco-box .right .pct-lbl { font-size: 10px; color: #16A34A; opacity: .7; }\
  .attn-list { margin: 0; padding: 0 0 0 16px; }\
  .attn-list li { font-size: 12px; color: #0F172A; margin-bottom: 6px; line-height: 1.45; }\
  .sources { margin-top: 14px; border-top: 1px solid #E2E8F0; padding-top: 10px; }\
  .sources p { font-size: 9px; color: #94A3B8; line-height: 1.6; }\
  .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 8px; }\
</style></head><body>\
<div class="header">\
  <div><h1>Diagnóstico de Custos de Frota</h1><p>Relatório gerado automaticamente com base nos dados informados</p></div>\
  <div class="date">Data: ' + hoje + '</div>\
</div>\
<div class="hero-box">\
  <p class="lbl">Sua frota pode economizar</p>\
  <p class="val">' + fmt(r.totalEconomia) + '</p>\
  <p class="sub">por mês &nbsp;·&nbsp; <strong>' + fmt(r.totalEconomia * 12) + '</strong> por ano</p>\
</div>\
<div class="strip">\
  <div class="strip-item"><div class="strip-lbl">Tipo de frota</div><div class="strip-val">' + state.frota + '</div></div>\
  <div class="strip-item"><div class="strip-lbl">Veículos</div><div class="strip-val">' + state.veiculos + '</div></div>\
  <div class="strip-item"><div class="strip-lbl">km/mês por veículo</div><div class="strip-val">' + fmtNum(state.km_mes) + ' km</div></div>\
  <div class="strip-item"><div class="strip-lbl">km/mês total</div><div class="strip-val">' + fmtNum(state.km_mes * state.veiculos) + ' km</div></div>\
</div>\
<p class="section-title">CPK — Custo por Quilômetro</p>\
<div class="cpk-row">\
  <div class="cpk-box atual"><div class="cpk-lbl">CPK Atual</div><div class="cpk-val">R$ ' + fmtDec(r.cpkAtual, 2) + '</div><div style="font-size:10px;color:#64748B">por km rodado</div></div>\
  <div class="cpk-box otim"><div class="cpk-lbl">CPK Otimizado</div><div class="cpk-val green">R$ ' + fmtDec(r.cpkOtim, 2) + '</div><div style="font-size:10px;color:#16A34A">por km rodado</div></div>\
</div>\
<div class="cpk-bench">Benchmark do setor (' + r.cpkBM.label + '): R$ ' + fmtDec(r.cpkBM.min, 2) + ' – R$ ' + fmtDec(r.cpkBM.max, 2) + ' /km &nbsp;|&nbsp; Situação: <strong>' + r.cpkSt.label + '</strong> &nbsp;|&nbsp; Fonte: ANTT SUROC 1/2024 · NTC&Logística</div>\
<p class="section-title">Detalhamento por pilar</p>\
<table>\
<thead><tr><th>Pilar</th><th>Custo atual / mês</th><th>Potencial de economia</th><th style="text-align:right">Redução</th></tr></thead>\
<tbody>\
<tr><td>Combustível</td><td>' + fmt(r.comb.custoAtual) + '</td><td class="eco">' + fmt(r.comb.economia) + '</td><td class="pct">' + (r.comb.custoAtual > 0 ? Math.round(r.comb.economia / r.comb.custoAtual * 100) : 0) + '%</td></tr>\
<tr><td>Manutenção</td><td>' + fmt(r.mant.custoAtual) + '</td><td class="eco">' + fmt(r.mant.economia) + '</td><td class="pct">' + (r.mant.custoAtual > 0 ? Math.round(r.mant.economia / r.mant.custoAtual * 100) : 0) + '%</td></tr>\
<tr><td>Pneus</td><td>' + fmt(r.pneu.custoAtual) + '</td><td class="eco">' + fmt(r.pneu.economia) + '</td><td class="pct">' + (r.pneu.custoAtual > 0 ? Math.round(r.pneu.economia / r.pneu.custoAtual * 100) : 0) + '%</td></tr>\
<tr class="total"><td><strong>Total</strong></td><td><strong>' + fmt(r.totalAtual) + '</strong></td><td class="eco"><strong>' + fmt(r.totalEconomia) + '</strong></td><td class="pct">' + r.pctEco + '%</td></tr>\
</tbody></table>\
<div class="eco-box">\
  <div class="left"><div class="lbl">Potencial total de redução</div><div class="mes">' + fmt(r.totalEconomia) + '</div><div class="ano">por mês</div></div>\
  <div class="right"><div class="pct-val">' + fmt(r.totalEconomia * 12) + '</div><div class="pct-lbl">por ano</div></div>\
</div>\
<p class="section-title">⚠ Pontos de atenção identificados</p>\
<ul class="attn-list">' + attnHTML + '</ul>\
<div class="sources">\
  <p><strong>Fontes e referências:</strong> ANTT SUROC 1/2024 · NTC&Logística · Geotab Brasil · CNT · ANFAVEA · Bandag · Bridgestone · ANIP · Mercedes-Benz Trucks · Volvo Trucks BR · Scania Brasil · ICCT · ProLog App</p>\
</div>\
<div class="footer">Diagnóstico de Custos de Frota · Gerado em ' + hoje + ' · Os valores são estimativas baseadas em benchmarks do setor</div>\
</body></html>';

  const w = window.open('', '_blank');
  if (!w) { alert('Permita pop-ups para gerar o PDF.'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(function() { w.print(); }, 500);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setClass(id, cls) {
  const el = document.getElementById(id);
  if (el) el.className = cls;
}

/* ── INIT ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  show('landing');
});
