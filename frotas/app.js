/* ══════════════════════════════════════════════════════════════════════
   CPK Frotas — app (vanilla JS, hash-router, localStorage)
   Réplica funcional do sistema de gestão de pneus a partir da análise.

   Correções aplicadas em relação ao app original analisado:
     • Item do menu para /veiculos rotulado "Veículos" (era "MAIS")
     • Botão "Novo Veículo" (era "Novo," com vírgula solta)
     • Campo de sucata "Causa Provável" (era "Causa Provac")
     • Botão de proposta "Remover" (era "Removedor")
     • Modal de checklist "Nova Lista de Verificação" (era "Lista de Verificação Novo")
     • Selects nativos controlados: o label reflete o valor escolhido e não há
       overlay travando o clique do segundo dropdown (bug do select customizado)
     • Rótulos dos itens de checklist escritos por extenso (sem truncar)
     • render() protegido por try/catch para não travar a árvore em erro pontual
   ══════════════════════════════════════════════════════════════════════ */

'use strict';

/* PIN de acesso do consultor. No app original vinha do backend;
   aqui é fixo e configurável nesta constante. */
const ACCESS_PIN = '2468';

const STORE_KEY = 'cpk_frotas_data_v1';
const AUTH_KEY  = 'cpk_frotas_auth_v1';

const POSICOES = [
  'Dianteiro Esquerdo', 'Dianteiro Direito',
  'Trativo 1E', 'Trativo 1D', 'Trativo 2E', 'Trativo 2D',
  'Reboque 1E', 'Reboque 1D', 'Reboque 2E', 'Reboque 2D',
  'Estepe'
];

const VIDAS = ['1ª vida', '2ª vida', '3ª vida', 'Recapado'];

const CAUSAS = [
  'Pressão incorreta', 'Baixa calibragem', 'Alinhamento / desgaste irregular',
  'Desgaste irregular', 'Sobrecarga', 'Impacto / buraco', 'Corte lateral',
  'Freio travando', 'Rodízio', 'Falha de pé', 'Desgaste natural',
  'Desgaste prematuro', 'Erro operacional', 'Bolhas sem linha interna',
  'Falha no processo de recapagem', 'Compressão lateral',
  'Conserto fora do limite', 'Outro'
];

const CHECK_ITENS = [
  'Calibração dentro do padrão',
  'Verificação de sulco dentro do padrão',
  'Ausência de corte lateral',
  'Desgaste uniforme',
  'Rodízio em dia',
  'Alinhamento recomendado'
];

const ACOES_PADRAO = [
  'Implementar programa de calibragem diária',
  'Realizar alinhamento e balanceamento preventivo',
  'Estabelecer rodízio sistemático a cada 20.000 km',
  'Treinar motoristas em técnicas de condução que preservam pneus',
  'Instalar sistema de monitoramento de pressão (TPMS)'
];

/* ── Storage ────────────────────────────────────────────────────────── */
const DEFAULT_DB = {
  empresas: [], veiculos: [], pneus: [], sucatas: [], checklists: [],
  propostas: {}, selectedEmpresaId: null
};

let db = loadDB();

function loadDB() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return Object.assign({}, DEFAULT_DB, raw);
  } catch (e) {
    return Object.assign({}, DEFAULT_DB);
  }
}
function saveDB() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
  catch (e) { /* ambiente sem localStorage (ex.: iframe restrito) — mantém em memória */ }
}

/* ── Helpers ────────────────────────────────────────────────────────── */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmtBRL(v) {
  if (v == null || isNaN(v)) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtCPK(v) {
  if (v == null || isNaN(v) || !isFinite(v)) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + '/km';
}
function num(id) {
  const el = document.getElementById(id);
  if (!el) return NaN;
  const v = parseFloat(String(el.value).replace(/\./g, '').replace(',', '.'));
  return isNaN(v) ? NaN : v;
}
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDateBR(iso) {
  if (!iso) return '—';
  const p = String(iso).slice(0, 10).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
}

function maskCNPJ(v) {
  v = v.replace(/\D/g, '').slice(0, 14);
  return v.replace(/^(\d{2})(\d)/, '$1.$2')
          .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
          .replace(/\.(\d{3})(\d)/, '.$1/$2')
          .replace(/(\d{4})(\d)/, '$1-$2');
}
function maskTel(v) {
  v = v.replace(/\D/g, '').slice(0, 11);
  if (v.length <= 10) return v.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return v.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

/* ── CPK ────────────────────────────────────────────────────────────── */
function calcCPK(custo, kmInicial, kmReal) {
  const c = Number(custo), ki = Number(kmInicial), kr = Number(kmReal);
  const rodado = kr - ki;
  if (!(c > 0) || !(rodado > 0)) return null;   // CPK válido = dados suficientes
  return c / rodado;
}
function pneuHasCPK(p) { return calcCPK(p.custo, p.kmInicial, p.kmReal) != null; }

/* ── Selection / data by empresa ────────────────────────────────────── */
function selectedEmpresa() { return db.empresas.find(e => e.id === db.selectedEmpresaId) || null; }
function byEmpresa(list) { return list.filter(x => x.empresaId === db.selectedEmpresaId); }

/* ── Toast ──────────────────────────────────────────────────────────── */
let toastTimer = null;
function toast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = isError ? 'error show' : 'show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 3200);
}

/* ── Auth ───────────────────────────────────────────────────────────── */
function isAuthed() { return sessionStorage.getItem(AUTH_KEY) === '1' || localStorage.getItem(AUTH_KEY) === '1'; }
function login() {
  const pin = val('pin');
  if (pin === ACCESS_PIN) {
    sessionStorage.setItem(AUTH_KEY, '1');
    navigate('dashboard');
  } else {
    toast('PIN incorreto. Tente novamente.', true);
    const el = document.getElementById('pin'); if (el) { el.value = ''; el.focus(); }
  }
}
function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_KEY);
  navigate('login');
}

/* ── Icons (inline SVG, herdam currentColor) ────────────────────────── */
const IC = {
  dash:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
  build: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M6 21V8l6-4 6 4v13"/><path d="M10 21v-6h4v6"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="13" height="10"/><path d="M14 9h4l3 3v4h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
  tire:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg>',
  scrap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  doc:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></svg>',
  edit:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4v16h16v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
  pick:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
  lock:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  plus:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>'
};

/* ── Router ─────────────────────────────────────────────────────────── */
const ROUTES = ['login', 'dashboard', 'empresas', 'veiculos', 'pneus', 'sucatas', 'checklists', 'proposta'];

function currentRoute() {
  const h = (location.hash || '').replace(/^#\/?/, '').split('/')[0];
  return ROUTES.indexOf(h) >= 0 ? h : (isAuthed() ? 'dashboard' : 'login');
}
function navigate(route) {
  if (location.hash === '#/' + route) render();
  else location.hash = '#/' + route;
}
window.addEventListener('hashchange', render);

/* ── Layout ─────────────────────────────────────────────────────────── */
const NAV_ITEMS = [
  ['dashboard',  'Painel',                 IC.dash],
  ['empresas',   'Empresas',               IC.build],
  ['veiculos',   'Veículos',               IC.truck],   // corrigido: era "MAIS"
  ['pneus',      'Pneus',                  IC.tire],
  ['sucatas',    'Sucatas',                IC.scrap],
  ['checklists', 'Listas de Verificação',  IC.check],
  ['proposta',   'Proposta',               IC.doc]
];

function layout(route, content) {
  const emp = selectedEmpresa();
  const nav = NAV_ITEMS.map(([r, label, icon]) =>
    `<a href="#/${r}" class="${r === route ? 'active' : ''}">${icon}<span>${label}</span></a>`
  ).join('');
  const empBox = emp
    ? `<div class="sidebar-empresa"><div class="lbl">Empresa ativa</div><div class="val">${esc(emp.nome)}</div></div>`
    : `<div class="sidebar-empresa"><div class="lbl">Empresa ativa</div><div class="val" style="color:var(--text-dim)">Nenhuma selecionada</div></div>`;
  return `
    <div class="layout">
      <aside class="sidebar">
        <div class="sidebar-brand">CPK Frotas<small>Sistema de Gestão de Pneus</small></div>
        ${empBox}
        <nav class="nav">${nav}</nav>
        <div class="sidebar-foot">
          <button class="btn-logout" onclick="logout()">Sair</button>
        </div>
      </aside>
      <main class="main">${content}</main>
    </div>`;
}

/* Telas que dependem de empresa selecionada */
function requireEmpresa(inner) {
  if (!db.empresas.length) {
    return `<div class="card-premium empty">
        <div class="empty-title">Bem-vindo ao CPK Frotas</div>
        <div class="empty-sub">Cadastre sua primeira empresa para começar o diagnóstico.</div>
        <button class="btn-cpk" onclick="navigate('empresas')">${IC.plus} Cadastrar empresa</button>
      </div>`;
  }
  if (!selectedEmpresa()) {
    return `<div class="card-premium empty">
        <div class="empty-title">Nenhuma empresa selecionada</div>
        <div class="empty-sub">Cadastre uma empresa primeiro na aba Empresas e selecione-a para trabalhar.</div>
        <button class="btn-cpk" onclick="navigate('empresas')">Ir para Empresas</button>
      </div>`;
  }
  return inner();
}

/* ── Render ─────────────────────────────────────────────────────────── */
function render() {
  const app = document.getElementById('app');
  try {
    const route = currentRoute();
    if (!isAuthed()) { app.innerHTML = viewLogin(); afterRender('login'); return; }
    if (route === 'login') { navigate('dashboard'); return; }

    let content = '';
    switch (route) {
      case 'dashboard':  content = viewDashboard(); break;
      case 'empresas':   content = viewEmpresas(); break;
      case 'veiculos':   content = requireEmpresa(viewVeiculos); break;
      case 'pneus':      content = requireEmpresa(viewPneus); break;
      case 'sucatas':    content = requireEmpresa(viewSucatas); break;
      case 'checklists': content = requireEmpresa(viewChecklists); break;
      case 'proposta':   content = requireEmpresa(viewProposta); break;
      default:           content = viewDashboard();
    }
    app.innerHTML = layout(route, content);
    afterRender(route);
  } catch (err) {
    // try/catch para não travar a árvore em um erro pontual de render
    console.error('Erro ao renderizar:', err);
    app.innerHTML = `<div class="layout"><main class="main">
        <div class="card-premium">
          <h1 style="font-size:34px">Ops, algo deu errado</h1>
          <p style="color:var(--text-dim);margin-top:8px">Ocorreu um erro ao montar esta tela. Seus dados estão salvos.</p>
          <button class="btn-cpk" style="margin-top:16px" onclick="navigate('dashboard')">Voltar ao Painel</button>
        </div></main></div>`;
  }
}

function afterRender(route) {
  if (route === 'login') {
    const pin = document.getElementById('pin');
    if (pin) {
      pin.focus();
      pin.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════
   TELAS
   ══════════════════════════════════════════════════════════════════════ */

function viewLogin() {
  return `<div class="login-wrap"><div class="login-card">
      <div class="brand">CPK Frotas</div>
      <div class="brand-sub">Sistema de Gestão de Pneus</div>
      <div class="card-premium">
        <div class="acc-title">Consultor · Acesso</div>
        <div class="acc-sub">Informe seu PIN numérico de acesso</div>
        <div class="field">
          <input id="pin" class="pin-input" type="password" inputmode="numeric"
                 maxlength="8" placeholder="••••" autocomplete="off"
                 oninput="this.value=this.value.replace(/\\D/g,'')">
        </div>
        <button class="btn-cpk" style="width:100%;justify-content:center" onclick="login()">Entrar no Sistema</button>
        <div class="login-note">${IC.lock} Acesso seguro protegido por PIN</div>
      </div>
    </div></div>`;
}

/* ── Dashboard ──────────────────────────────────────────────────────── */
function viewDashboard() {
  if (!db.empresas.length) {
    return `<div class="card-premium empty">
        <div class="empty-title">Bem-vindo ao CPK Frotas</div>
        <div class="empty-sub">Cadastre sua primeira empresa para gerar o diagnóstico da frota.</div>
        <button class="btn-cpk" onclick="navigate('empresas')">${IC.plus} Cadastrar primeira empresa</button>
      </div>`;
  }
  const emp = selectedEmpresa();
  if (!emp) {
    return `<div class="card-premium empty">
        <div class="empty-title">Selecione uma empresa</div>
        <div class="empty-sub">Escolha uma empresa na aba Empresas para ver o painel.</div>
        <button class="btn-cpk" onclick="navigate('empresas')">Ir para Empresas</button>
      </div>`;
  }

  const pneus = byEmpresa(db.pneus);
  const validos = pneus.map(p => calcCPK(p.custo, p.kmInicial, p.kmReal)).filter(v => v != null);
  const cpkMedio = validos.length ? validos.reduce((a, b) => a + b, 0) / validos.length : null;
  const perdido = byEmpresa(db.sucatas).reduce((a, s) => a + (Number(s.valorPerdido) || 0), 0);
  const checks = byEmpresa(db.checklists);
  const pontuacao = checklistScore(checks);

  return `
    <div class="page-head">
      <div>
        <h1>Painel</h1>
        <div class="sub">${esc(emp.nome)} · Diagnóstico de ${fmtDateBR(emp.dataDiagnostico)}</div>
      </div>
      <button class="btn-cpk" onclick="navigate('proposta')">${IC.doc} Gerar Proposta</button>
    </div>
    <div class="grid grid-4">
      <div class="card-premium kpi">
        <div class="kpi-label">CPK médio da frota</div>
        <div class="kpi-value">${fmtCPK(cpkMedio)}</div>
        <div class="kpi-hint">${validos.length} pneu(s) com CPK válido</div>
      </div>
      <div class="card-premium kpi">
        <div class="kpi-label">Perdido total</div>
        <div class="kpi-value">${fmtBRL(perdido)}</div>
        <div class="kpi-hint">${byEmpresa(db.sucatas).length} sucata(s)</div>
      </div>
      <div class="card-premium kpi">
        <div class="kpi-label">Pontuação de checklist</div>
        <div class="kpi-value">${pontuacao == null ? '—' : pontuacao + '%'}</div>
        <div class="kpi-hint">${checks.length} inspeção(ões)</div>
      </div>
      <div class="card-premium kpi">
        <div class="kpi-label">Frota</div>
        <div class="kpi-value">${pneus.length}</div>
        <div class="kpi-hint">pneu(s) em operação</div>
      </div>
    </div>
    ${dashboardRankings()}`;
}

/* Blocos de ranking condicionais: só aparecem quando há pneu com CPK válido.
   Replicam as seções que o app original revela ao existir dados. */
function dashboardRankings() {
  const veics = veiculosRanked();
  const pns = pneusRanked();
  if (!pns.length) return '';   // estado vazio: nenhuma seção de ranking

  const pior = veics[0];
  const destaque = pior ? `
    <div class="card-premium" style="margin-top:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <div class="kpi-label">Veículo com maior CPK</div>
          <div style="font-family:'Bebas Neue','Anton',sans-serif;font-size:34px">${esc(pior.v.placa)}</div>
          <div class="item-meta">${esc(pior.v.modelo)}</div>
        </div>
        <div style="text-align:right">
          <span class="tag" style="background:rgba(239,83,80,.18);border-color:rgba(239,83,80,.5);color:#EF5350">Requer atenção</span>
          <div style="font-family:'Bebas Neue','Anton',sans-serif;font-size:34px;color:var(--cpk-gold);margin-top:6px">${fmtCPK(pior.cpk)}</div>
        </div>
      </div>
    </div>` : '';

  return `${destaque}
    <div class="grid grid-2" style="margin-top:16px">
      ${rankCard('Top 5 Veículos por CPK', veics.slice(0, 5).map(x => [x.v.placa, x.cpk]))}
      ${rankCard('Top 5 Pneus com Maior CPK', pns.slice(0, 5).map(x => [(veiculoPlaca(x.p.veiculoId) || '—') + ' · ' + (x.p.posicao || '—'), x.cpk]))}
    </div>`;
}

function rankCard(titulo, rows) {
  const body = rows.length ? rows.map(([label, cpk], i) =>
    `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border-soft)">
        <span class="tag" style="min-width:26px;text-align:center">${i + 1}</span>
        <span style="flex:1;font-size:14px;font-weight:600">${esc(label)}</span>
        <span class="tag gold">${fmtCPK(cpk)}</span>
      </div>`
  ).join('') : '<div class="item-meta">Sem dados suficientes.</div>';
  return `<div class="card-premium"><h2 style="font-size:22px;margin-bottom:10px">${esc(titulo)}</h2>${body}</div>`;
}

/* CPK por veículo = média dos CPKs válidos dos pneus daquele veículo */
function veiculoCPK(veiculoId) {
  const cpks = byEmpresa(db.pneus).filter(p => p.veiculoId === veiculoId)
    .map(p => calcCPK(p.custo, p.kmInicial, p.kmReal)).filter(v => v != null);
  return cpks.length ? cpks.reduce((a, b) => a + b, 0) / cpks.length : null;
}
function veiculosRanked() {
  return byEmpresa(db.veiculos)
    .map(v => ({ v, cpk: veiculoCPK(v.id) }))
    .filter(x => x.cpk != null)
    .sort((a, b) => b.cpk - a.cpk);
}
function pneusRanked() {
  return byEmpresa(db.pneus)
    .map(p => ({ p, cpk: calcCPK(p.custo, p.kmInicial, p.kmReal) }))
    .filter(x => x.cpk != null)
    .sort((a, b) => b.cpk - a.cpk);
}

function checklistScore(checks) {
  if (!checks.length) return null;
  let total = 0, ok = 0;
  checks.forEach(c => {
    CHECK_ITENS.forEach((_, i) => { total++; if (c.items && c.items[i]) ok++; });
  });
  return total ? Math.round(ok / total * 100) : null;
}

/* ── Empresas ───────────────────────────────────────────────────────── */
function viewEmpresas() {
  const cards = db.empresas.map(e => {
    const sel = e.id === db.selectedEmpresaId;
    return `<div class="card-premium item-card ${sel ? 'selected' : ''}">
        ${sel ? `<div class="badge-check">${IC.pick}</div>` : ''}
        <div class="item-title">${esc(e.nome)}</div>
        <div class="item-meta">CNPJ: ${esc(e.cnpj || '—')}</div>
        <div class="item-meta">${esc(e.telefone || '')}${e.telefone && e.email ? ' · ' : ''}${esc(e.email || '')}</div>
        <div class="item-meta">Diagnóstico: ${fmtDateBR(e.dataDiagnostico)}</div>
        <div class="item-actions">
          <button class="btn-cpk" style="padding:8px 14px" onclick="selecionarEmpresa('${e.id}')">${sel ? 'Selecionada' : 'Selecionar'}</button>
          <button class="btn-icon" title="Editar" onclick="modalEmpresa('${e.id}')">${IC.edit}</button>
          <button class="btn-icon danger" title="Excluir" onclick="excluirEmpresa('${e.id}')">${IC.trash}</button>
        </div>
      </div>`;
  }).join('');

  const body = db.empresas.length
    ? `<div class="grid grid-3">${cards}</div>`
    : `<div class="card-premium empty"><div class="empty-title">Nenhuma empresa</div>
        <div class="empty-sub">Cadastre a primeira empresa para começar.</div></div>`;

  return `<div class="page-head">
      <div><h1>Empresas</h1><div class="sub">Selecione uma empresa para trabalhar com os dados dela.</div></div>
      <button class="btn-cpk" onclick="modalEmpresa()">${IC.plus} Nova Empresa</button>
    </div>${body}`;
}

function selecionarEmpresa(id) {
  db.selectedEmpresaId = id; saveDB();
  toast('Empresa selecionada — agora você está trabalhando com esta empresa.');
  render();
}
function excluirEmpresa(id) {
  const e = db.empresas.find(x => x.id === id);
  if (!e || !confirm('Excluir "' + e.nome + '" e todos os dados vinculados (veículos, pneus, sucatas, checklists)?')) return;
  db.empresas = db.empresas.filter(x => x.id !== id);
  db.veiculos = db.veiculos.filter(x => x.empresaId !== id);
  db.pneus = db.pneus.filter(x => x.empresaId !== id);
  db.sucatas = db.sucatas.filter(x => x.empresaId !== id);
  db.checklists = db.checklists.filter(x => x.empresaId !== id);
  delete db.propostas[id];
  if (db.selectedEmpresaId === id) db.selectedEmpresaId = null;
  saveDB(); toast('Empresa excluída.'); render();
}

/* ── Veículos ───────────────────────────────────────────────────────── */
function viewVeiculos() {
  const list = byEmpresa(db.veiculos);
  const cards = list.map(v =>
    `<div class="card-premium item-card">
        <div class="item-title">${esc(v.placa)}</div>
        <div class="item-meta">${esc(v.modelo)}</div>
        ${v.observacoes ? `<div class="item-meta">${esc(v.observacoes)}</div>` : ''}
        <div class="item-meta"><span class="tag">${byEmpresa(db.pneus).filter(p => p.veiculoId === v.id).length} pneu(s)</span></div>
        <div class="item-actions">
          <button class="btn-icon" title="Editar" onclick="modalVeiculo('${v.id}')">${IC.edit}</button>
          <button class="btn-icon danger" title="Excluir" onclick="excluirVeiculo('${v.id}')">${IC.trash}</button>
        </div>
      </div>`
  ).join('');
  const body = list.length
    ? `<div class="grid grid-3">${cards}</div>`
    : `<div class="card-premium empty"><div class="empty-title">Nenhum veículo</div>
        <div class="empty-sub">Cadastre um veículo para depois vincular pneus a ele.</div></div>`;
  return `<div class="page-head">
      <div><h1>Veículos</h1><div class="sub">${esc(selectedEmpresa().nome)}</div></div>
      <button class="btn-cpk" onclick="modalVeiculo()">${IC.plus} Novo Veículo</button>
    </div>${body}`;
}
function excluirVeiculo(id) {
  const v = db.veiculos.find(x => x.id === id);
  const nPneus = db.pneus.filter(p => p.veiculoId === id).length;
  if (!v || !confirm('Excluir o veículo ' + v.placa + (nPneus ? ' e seus ' + nPneus + ' pneu(s)?' : '?'))) return;
  db.veiculos = db.veiculos.filter(x => x.id !== id);
  db.pneus = db.pneus.filter(p => p.veiculoId !== id);
  saveDB(); toast('Veículo excluído.'); render();
}

/* ── Pneus ──────────────────────────────────────────────────────────── */
let pneuFiltro = { placa: '', medida: '', vida: '' };

function viewPneus() {
  let list = byEmpresa(db.pneus);
  const validos = list.map(p => calcCPK(p.custo, p.kmInicial, p.kmReal)).filter(v => v != null);
  const cpkMedio = validos.length ? validos.reduce((a, b) => a + b, 0) / validos.length : null;

  // filtros
  const placas = [...new Set(list.map(p => veiculoPlaca(p.veiculoId)).filter(Boolean))];
  const medidas = [...new Set(list.map(p => p.medida).filter(Boolean))];
  if (pneuFiltro.placa) list = list.filter(p => veiculoPlaca(p.veiculoId) === pneuFiltro.placa);
  if (pneuFiltro.medida) list = list.filter(p => p.medida === pneuFiltro.medida);
  if (pneuFiltro.vida) list = list.filter(p => p.vida === pneuFiltro.vida);

  const rows = list.map(p => {
    const cpk = calcCPK(p.custo, p.kmInicial, p.kmReal);
    return `<div class="card-premium item-card">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div>
            <div class="item-title">${esc(veiculoPlaca(p.veiculoId) || '—')} · ${esc(p.posicao || '—')}</div>
            <div class="item-meta">${esc(p.marca || '')} ${esc(p.modelo || '')} · ${esc(p.medida || '')} · ${esc(p.vida || '')}</div>
            <div class="item-meta">DOT ${esc(p.dot || '—')} · Série ${esc(p.serie || '—')} · Sulco ${p.sulcoAtual != null && p.sulcoAtual !== '' ? esc(p.sulcoAtual) + 'mm' : '—'} · TWI ${p.twi != null && p.twi !== '' ? esc(p.twi) + 'mm' : '—'}</div>
            <div class="item-meta">Custo ${fmtBRL(p.custo)} · KM ${esc(p.kmInicial || 0)}→${esc(p.kmReal || 0)}</div>
          </div>
          <span class="tag ${cpk != null ? 'gold' : ''}">${cpk != null ? fmtCPK(cpk) : 'CPK inválido'}</span>
        </div>
        <div class="item-actions">
          <button class="btn-icon" title="Editar" onclick="modalPneu('${p.id}')">${IC.edit}</button>
          <button class="btn-icon danger" title="Excluir" onclick="excluirPneu('${p.id}')">${IC.trash}</button>
        </div>
      </div>`;
  }).join('');

  const opt = (arr, sel) => arr.map(x => `<option value="${esc(x)}" ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');

  const body = byEmpresa(db.pneus).length
    ? `<div class="filters">
        <div><label>Placa</label><select onchange="pneuFiltro.placa=this.value;render()"><option value="">Todas</option>${opt(placas, pneuFiltro.placa)}</select></div>
        <div><label>Medida</label><select onchange="pneuFiltro.medida=this.value;render()"><option value="">Todas</option>${opt(medidas, pneuFiltro.medida)}</select></div>
        <div><label>Vida útil</label><select onchange="pneuFiltro.vida=this.value;render()"><option value="">Todas</option>${opt(VIDAS, pneuFiltro.vida)}</select></div>
      </div>
      <div class="grid grid-2">${rows || '<div class="list-note">Nenhum pneu para os filtros selecionados.</div>'}</div>`
    : `<div class="card-premium empty"><div class="empty-title">Nenhum pneu cadastrado</div>
        <div class="empty-sub">Cadastre pneus para calcular o CPK da frota. Cada pneu é vinculado a um veículo e a uma posição de eixo.</div></div>`;

  return `<div class="page-head">
      <div><h1>Pneus</h1><div class="sub">${esc(selectedEmpresa().nome)}</div></div>
      <button class="btn-cpk" onclick="modalPneu()">${IC.plus} Novo Pneu</button>
    </div>
    <div class="grid grid-3" style="margin-bottom:18px">
      <div class="card-premium kpi"><div class="kpi-label">CPK médio da frota</div><div class="kpi-value">${fmtCPK(cpkMedio)}</div></div>
      <div class="card-premium kpi"><div class="kpi-label">Total de pneus</div><div class="kpi-value">${byEmpresa(db.pneus).length}</div></div>
      <div class="card-premium kpi"><div class="kpi-label">Com CPK válido</div><div class="kpi-value">${validos.length}</div></div>
    </div>
    ${topPneusCPK()}${body}`;
}

/* "Top 5 Pneus com Maior CPK (Atenção!)" — só aparece com pneu de CPK válido */
function topPneusCPK() {
  const pns = pneusRanked();
  if (!pns.length) return '';
  return `<div style="margin-bottom:18px">${rankCard('Top 5 Pneus com Maior CPK (Atenção!)',
    pns.slice(0, 5).map(x => [(veiculoPlaca(x.p.veiculoId) || '—') + ' · ' + (x.p.posicao || '—'), x.cpk]))}</div>`;
}
function veiculoPlaca(id) { const v = db.veiculos.find(x => x.id === id); return v ? v.placa : ''; }
function excluirPneu(id) {
  if (!confirm('Excluir este pneu?')) return;
  db.pneus = db.pneus.filter(x => x.id !== id);
  saveDB(); toast('Pneu excluído.'); render();
}

/* ── Sucatas ────────────────────────────────────────────────────────── */
function viewSucatas() {
  const list = byEmpresa(db.sucatas);
  const perdido = list.reduce((a, s) => a + (Number(s.valorPerdido) || 0), 0);
  const rows = list.map(s =>
    `<div class="card-premium item-card">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div>
            <div class="item-title">${esc(s.marca || '')} ${esc(s.modelo || '')}</div>
            <div class="item-meta">${esc(s.medida || '')} · ${esc(s.vida || '')} · Sulco descarte ${s.sulco != null && s.sulco !== '' ? esc(s.sulco) + 'mm' : '—'}</div>
            <div class="item-meta">DOT ${esc(s.dot || '—')} · Série ${esc(s.serie || '—')}</div>
            <div class="item-meta">Causa: ${esc(s.causa || '—')}</div>
            ${s.tratativa ? `<div class="item-meta">Tratativa: ${esc(s.tratativa)}</div>` : ''}
            ${s.foto ? `<img class="foto-preview" src="${s.foto}" alt="foto da sucata">` : ''}
          </div>
          <span class="tag gold">${fmtBRL(s.valorPerdido)}</span>
        </div>
        <div class="item-actions">
          <button class="btn-icon" title="Editar" onclick="modalSucata('${s.id}')">${IC.edit}</button>
          <button class="btn-icon danger" title="Excluir" onclick="excluirSucata('${s.id}')">${IC.trash}</button>
        </div>
      </div>`
  ).join('');
  const body = list.length
    ? `<div class="grid grid-2">${rows}</div>`
    : `<div class="card-premium empty"><div class="empty-title">Nenhuma sucata</div>
        <div class="empty-sub">Registre pneus descartados para acompanhar o prejuízo da frota.</div></div>`;
  return `<div class="page-head">
      <div><h1>Sucatas</h1><div class="sub">${esc(selectedEmpresa().nome)}</div></div>
      <button class="btn-cpk" onclick="modalSucata()">${IC.plus} Nova Sucata</button>
    </div>
    <div class="grid grid-2" style="margin-bottom:18px">
      <div class="card-premium kpi"><div class="kpi-label">Perdido total</div><div class="kpi-value">${fmtBRL(perdido)}</div></div>
      <div class="card-premium kpi"><div class="kpi-label">Total de sucatas</div><div class="kpi-value">${list.length}</div></div>
    </div>${body}`;
}
function excluirSucata(id) {
  if (!confirm('Excluir esta sucata?')) return;
  db.sucatas = db.sucatas.filter(x => x.id !== id);
  saveDB(); toast('Sucata excluída.'); render();
}

/* ── Checklists ─────────────────────────────────────────────────────── */
function viewChecklists() {
  const list = byEmpresa(db.checklists);
  const pontuacao = checklistScore(list);
  const veicInspec = new Set(list.map(c => c.veiculoId)).size;
  const rows = list.map(c => {
    const ok = CHECK_ITENS.filter((_, i) => c.items && c.items[i]).length;
    return `<div class="card-premium item-card">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div>
            <div class="item-title">${esc(veiculoPlaca(c.veiculoId) || c.placa || '—')}</div>
            <div class="item-meta">Data: ${fmtDateBR(c.data)}</div>
            <div class="item-meta">${CHECK_ITENS.map((it, i) => `${(c.items && c.items[i]) ? '✓' : '✕'} ${esc(it)}`).join(' · ')}</div>
          </div>
          <span class="tag gold">${ok}/${CHECK_ITENS.length}</span>
        </div>
        <div class="item-actions">
          <button class="btn-icon" title="Editar" onclick="modalChecklist('${c.id}')">${IC.edit}</button>
          <button class="btn-icon danger" title="Excluir" onclick="excluirChecklist('${c.id}')">${IC.trash}</button>
        </div>
      </div>`;
  }).join('');
  const body = list.length
    ? `<div class="grid grid-2">${rows}</div>`
    : `<div class="card-premium empty"><div class="empty-title">Nenhuma lista de verificação</div>
        <div class="empty-sub">Crie inspeções para medir a conformidade da frota.</div></div>`;
  return `<div class="page-head">
      <div><h1>Listas de Verificação</h1><div class="sub">${esc(selectedEmpresa().nome)}</div></div>
      <button class="btn-cpk" onclick="modalChecklist()">${IC.plus} Nova Lista de Verificação</button>
    </div>
    <div class="grid grid-3" style="margin-bottom:18px">
      <div class="card-premium kpi"><div class="kpi-label">Conformidade geral</div><div class="kpi-value">${pontuacao == null ? '—' : pontuacao + '%'}</div></div>
      <div class="card-premium kpi"><div class="kpi-label">Listas de verificação</div><div class="kpi-value">${list.length}</div></div>
      <div class="card-premium kpi"><div class="kpi-label">Veículos inspecionados</div><div class="kpi-value">${veicInspec}</div></div>
    </div>${body}`;
}
function excluirChecklist(id) {
  if (!confirm('Excluir esta lista de verificação?')) return;
  db.checklists = db.checklists.filter(x => x.id !== id);
  saveDB(); toast('Lista de verificação excluída.'); render();
}

/* ── Proposta ───────────────────────────────────────────────────────── */
function getProposta(empId) {
  if (!db.propostas[empId]) db.propostas[empId] = { acoes: ACOES_PADRAO.slice(), investimento: '' };
  return db.propostas[empId];
}
function viewProposta() {
  const emp = selectedEmpresa();
  const prop = getProposta(emp.id);
  const pneus = byEmpresa(db.pneus);
  const validos = pneus.map(p => calcCPK(p.custo, p.kmInicial, p.kmReal)).filter(v => v != null);
  const cpkMedio = validos.length ? validos.reduce((a, b) => a + b, 0) / validos.length : null;
  const perdido = byEmpresa(db.sucatas).reduce((a, s) => a + (Number(s.valorPerdido) || 0), 0);

  const acoesHtml = prop.acoes.map((a, i) =>
    `<div class="acao-row">
        <input value="${esc(a)}" oninput="atualizarAcao(${i}, this.value)">
        <button class="btn-icon danger" title="Remover" onclick="removerAcao(${i})">${IC.trash}</button>
      </div>`
  ).join('');

  return `<div class="page-head">
      <div><h1>Proposta Comercial</h1><div class="sub">${esc(emp.nome)} · ${fmtDateBR(emp.dataDiagnostico)}</div></div>
    </div>
    <div class="card-premium" style="margin-bottom:16px">
      <h2 style="font-size:24px;margin-bottom:14px">Resumo do Diagnóstico</h2>
      <div class="grid grid-4">
        <div class="kpi"><div class="kpi-label">CPK médio</div><div class="kpi-value">${fmtCPK(cpkMedio)}</div></div>
        <div class="kpi"><div class="kpi-label">Perdido total</div><div class="kpi-value">${fmtBRL(perdido)}</div></div>
        <div class="kpi"><div class="kpi-label">Operação de pneus</div><div class="kpi-value">${pneus.length}</div></div>
        <div class="kpi"><div class="kpi-label">Sucatas</div><div class="kpi-value">${byEmpresa(db.sucatas).length}</div></div>
      </div>
    </div>
    <div class="card-premium" style="margin-bottom:16px">
      <h2 style="font-size:24px;margin-bottom:6px">Ações Recomendadas</h2>
      <p style="color:var(--text-dim);font-size:12px;margin-bottom:14px">Edite, remova ou adicione ações à proposta.</p>
      ${acoesHtml || '<div class="list-note">Nenhuma ação. Adicione a primeira.</div>'}
      <button class="btn-ghost" style="margin-top:6px" onclick="adicionarAcao()">${IC.plus} Adicionar ação</button>
    </div>
    <div class="card-premium" style="margin-bottom:16px">
      <div class="field">
        <label>Investimento sugerido</label>
        <input value="${esc(prop.investimento)}" placeholder="Ex: R$ 15.000,00 ou A definir" oninput="atualizarInvestimento(this.value)">
      </div>
      <div class="list-note" style="margin-top:6px">Ao clicar em "Gerar Relatório PDF" a proposta abre para impressão/salvamento em PDF. Depois, anexe o PDF baixado manualmente na conversa do WhatsApp.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
        <button class="btn-cpk" onclick="gerarPDF()">${IC.doc} Gerar Relatório PDF</button>
        <button class="btn-ghost" onclick="enviarWhatsApp()">Enviar via WhatsApp</button>
      </div>
    </div>`;
}
function atualizarAcao(i, v) { const p = getProposta(db.selectedEmpresaId); p.acoes[i] = v; saveDB(); }
function removerAcao(i) { const p = getProposta(db.selectedEmpresaId); p.acoes.splice(i, 1); saveDB(); render(); }
function adicionarAcao() { const p = getProposta(db.selectedEmpresaId); p.acoes.push(''); saveDB(); render(); }
function atualizarInvestimento(v) { const p = getProposta(db.selectedEmpresaId); p.investimento = v; saveDB(); }

/* ══════════════════════════════════════════════════════════════════════
   MODAIS
   ══════════════════════════════════════════════════════════════════════ */
function openModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`;
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

function selectOptions(arr, sel) {
  return arr.map(x => `<option value="${esc(x)}" ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');
}

/* — Empresa — */
function modalEmpresa(id) {
  const e = id ? db.empresas.find(x => x.id === id) : null;
  openModal(`
    <div class="modal-head"><h2>${e ? 'Editar Empresa' : 'Nova Empresa'}</h2><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <div class="field"><label>Nome da empresa <span class="req">*</span></label><input id="e-nome" value="${esc(e ? e.nome : '')}" placeholder="Ex: Transportadora Silva"></div>
    <div class="row-2">
      <div class="field"><label>CNPJ <span class="req">*</span></label><input id="e-cnpj" value="${esc(e ? e.cnpj : '')}" placeholder="00.000.000/0000-00" oninput="this.value=maskCNPJ(this.value)"></div>
      <div class="field"><label>Telefone</label><input id="e-tel" value="${esc(e ? e.telefone : '')}" placeholder="(00) 00000-0000" oninput="this.value=maskTel(this.value)"></div>
    </div>
    <div class="row-2">
      <div class="field"><label>E-mail</label><input id="e-email" type="email" value="${esc(e ? e.email : '')}" placeholder="contato@empresa.com"></div>
      <div class="field"><label>Data do Diagnóstico</label><input id="e-data" type="date" value="${e ? (e.dataDiagnostico || todayISO()) : todayISO()}"></div>
    </div>
    <div class="modal-foot">
      <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn-cpk" onclick="salvarEmpresa('${e ? e.id : ''}')">Salvar</button>
    </div>`);
}
function salvarEmpresa(id) {
  const nome = val('e-nome'), cnpj = val('e-cnpj');
  if (!nome || !cnpj) { toast('Preencha os campos obrigatórios: nome e CNPJ.', true); return; }
  const rec = { nome, cnpj, telefone: val('e-tel'), email: val('e-email'), dataDiagnostico: val('e-data') || todayISO() };
  if (id) { Object.assign(db.empresas.find(x => x.id === id), rec); toast('Empresa atualizada.'); }
  else {
    rec.id = uid(); db.empresas.push(rec);
    if (!db.selectedEmpresaId) db.selectedEmpresaId = rec.id;
    toast('Empresa cadastrada.');
  }
  saveDB(); closeModal(); render();
}

/* — Veículo — */
function modalVeiculo(id) {
  const v = id ? db.veiculos.find(x => x.id === id) : null;
  openModal(`
    <div class="modal-head"><h2>${v ? 'Editar Veículo' : 'Novo Veículo'}</h2><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <div class="row-2">
      <div class="field"><label>Placa <span class="req">*</span></label><input id="v-placa" value="${esc(v ? v.placa : '')}" placeholder="ABC1D23" style="text-transform:uppercase"></div>
      <div class="field"><label>Modelo <span class="req">*</span></label><input id="v-modelo" value="${esc(v ? v.modelo : '')}" placeholder="Ex: Scania R450"></div>
    </div>
    <div class="field"><label>Observações</label><textarea id="v-obs" placeholder="Observações livres">${esc(v ? v.observacoes : '')}</textarea></div>
    <div class="modal-foot">
      <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn-cpk" onclick="salvarVeiculo('${v ? v.id : ''}')">Salvar</button>
    </div>`);
}
function salvarVeiculo(id) {
  const placa = val('v-placa').toUpperCase(), modelo = val('v-modelo');
  if (!placa || !modelo) { toast('Preencha os campos obrigatórios: placa e modelo.', true); return; }
  const rec = { empresaId: db.selectedEmpresaId, placa, modelo, observacoes: val('v-obs') };
  if (id) { Object.assign(db.veiculos.find(x => x.id === id), rec); toast('Veículo atualizado.'); }
  else { rec.id = uid(); db.veiculos.push(rec); toast('Veículo cadastrado.'); }
  saveDB(); closeModal(); render();
}

/* — Pneu — */
function modalPneu(id) {
  const p = id ? db.pneus.find(x => x.id === id) : null;
  const veics = byEmpresa(db.veiculos);
  if (!veics.length) { toast('Cadastre um veículo antes de cadastrar pneus.', true); return; }
  const veicOpts = veics.map(v => `<option value="${v.id}" ${p && p.veiculoId === v.id ? 'selected' : ''}>${esc(v.placa)} · ${esc(v.modelo)}</option>`).join('');
  openModal(`
    <div class="modal-head"><h2>${p ? 'Editar Pneu' : 'Novo Pneu'}</h2><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <div class="row-2">
      <div class="field"><label>Veículo <span class="req">*</span></label>
        <select id="p-veiculo" onchange="preencherVeiculoPneu()"><option value="">Selecione...</option>${veicOpts}</select></div>
      <div class="field"><label>Posição do pneu <span class="req">*</span></label>
        <select id="p-posicao"><option value="">Selecione...</option>${selectOptions(POSICOES, p ? p.posicao : '')}</select></div>
    </div>
    <div class="row-2">
      <div class="field"><label>Placa do veículo</label><input id="p-placa" readonly value="${esc(p ? veiculoPlaca(p.veiculoId) : '')}"></div>
      <div class="field"><label>Modelo do veículo</label><input id="p-vmodelo" readonly value="${esc(p ? (db.veiculos.find(v => v.id === p.veiculoId) || {}).modelo || '' : '')}"></div>
    </div>
    <div class="row-2">
      <div class="field"><label>Marca do pneu <span class="req">*</span></label><input id="p-marca" value="${esc(p ? p.marca : '')}" placeholder="Ex: Bridgestone"></div>
      <div class="field"><label>Modelo do pneu</label><input id="p-modelo" value="${esc(p ? p.modelo : '')}" placeholder="Ex: R268"></div>
    </div>
    <div class="row-3">
      <div class="field"><label>Medida <span class="req">*</span></label><input id="p-medida" value="${esc(p ? p.medida : '')}" placeholder="295/80R22.5"></div>
      <div class="field"><label>Vida</label><select id="p-vida">${selectOptions(VIDAS, p ? p.vida : '1ª vida')}</select></div>
      <div class="field"><label>DOT de fabricação <span class="req">*</span></label><input id="p-dot" value="${esc(p ? p.dot : '')}" placeholder="Ex: 2523"></div>
    </div>
    <div class="row-2">
      <div class="field"><label>Série do pneu <span class="req">*</span></label><input id="p-serie" value="${esc(p ? p.serie : '')}"></div>
      <div class="field"><label>Custo (R$)</label><input id="p-custo" inputmode="decimal" value="${p ? esc(p.custo) : ''}" oninput="atualizarCPKLive()" placeholder="2000"></div>
    </div>
    <div class="row-2">
      <div class="field"><label>KM inicial</label><input id="p-kmi" inputmode="numeric" value="${p ? esc(p.kmInicial) : ''}" oninput="atualizarCPKLive()" placeholder="0"></div>
      <div class="field"><label>KM real (rodado)</label><input id="p-kmr" inputmode="numeric" value="${p ? esc(p.kmReal) : ''}" oninput="atualizarCPKLive()" placeholder="50000"></div>
    </div>
    <div class="cpk-live"><span class="lbl">CPK Calculado (Custo ÷ (KM Real − KM Inicial))</span><span class="val" id="p-cpk-live">—</span></div>
    <div class="row-2">
      <div class="field"><label>TWI (mm)</label><input id="p-twi" inputmode="decimal" value="${p ? esc(p.twi) : ''}" placeholder="1.6"></div>
      <div class="field"><label>Sulco atual (mm)</label><input id="p-sulco" inputmode="decimal" value="${p ? esc(p.sulcoAtual) : ''}" placeholder="14"></div>
    </div>
    <div class="field"><label>Observações</label><textarea id="p-obs">${esc(p ? p.observacoes : '')}</textarea></div>
    <div class="modal-foot">
      <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn-cpk" onclick="salvarPneu('${p ? p.id : ''}')">Salvar</button>
    </div>`);
  atualizarCPKLive();
}
function preencherVeiculoPneu() {
  const v = db.veiculos.find(x => x.id === val('p-veiculo'));
  document.getElementById('p-placa').value = v ? v.placa : '';
  document.getElementById('p-vmodelo').value = v ? v.modelo : '';
}
function atualizarCPKLive() {
  const cpk = calcCPK(num('p-custo'), num('p-kmi'), num('p-kmr'));
  const el = document.getElementById('p-cpk-live');
  if (el) el.textContent = fmtCPK(cpk);
}
function salvarPneu(id) {
  const veiculoId = val('p-veiculo'), posicao = val('p-posicao');
  const marca = val('p-marca'), medida = val('p-medida'), dot = val('p-dot'), serie = val('p-serie');
  if (!veiculoId || !posicao || !marca || !medida || !dot || !serie) {
    toast('Preencha todos os campos obrigatórios: veículo, posição/eixo, marca, medida, DOT e série.', true);
    return;
  }
  const rec = {
    empresaId: db.selectedEmpresaId, veiculoId, posicao, marca,
    modelo: val('p-modelo'), medida, vida: val('p-vida'), dot, serie,
    custo: num('p-custo') || 0, kmInicial: num('p-kmi') || 0, kmReal: num('p-kmr') || 0,
    twi: val('p-twi'), sulcoAtual: val('p-sulco'), observacoes: val('p-obs')
  };
  if (id) { Object.assign(db.pneus.find(x => x.id === id), rec); toast('Pneu atualizado.'); }
  else { rec.id = uid(); db.pneus.push(rec); toast('Pneu cadastrado.'); }
  saveDB(); closeModal(); render();
}

/* — Sucata — */
function modalSucata(id) {
  const s = id ? db.sucatas.find(x => x.id === id) : null;
  openModal(`
    <div class="modal-head"><h2>${s ? 'Editar Sucata' : 'Nova Sucata'}</h2><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <div class="row-2">
      <div class="field"><label>Marca do pneu</label><input id="s-marca" value="${esc(s ? s.marca : '')}"></div>
      <div class="field"><label>Modelo do pneu</label><input id="s-modelo" value="${esc(s ? s.modelo : '')}"></div>
    </div>
    <div class="row-3">
      <div class="field"><label>Medida</label><input id="s-medida" value="${esc(s ? s.medida : '')}" placeholder="295/80R22.5"></div>
      <div class="field"><label>Vida</label><select id="s-vida">${selectOptions(['Novo'].concat(VIDAS), s ? s.vida : 'Novo')}</select></div>
      <div class="field"><label>Sulco no descarte (mm)</label><input id="s-sulco" inputmode="decimal" value="${s ? esc(s.sulco) : ''}"></div>
    </div>
    <div class="row-2">
      <div class="field"><label>DOT de fabricação</label><input id="s-dot" value="${esc(s ? s.dot : '')}"></div>
      <div class="field"><label>Série do pneu</label><input id="s-serie" value="${esc(s ? s.serie : '')}"></div>
    </div>
    <div class="row-2">
      <div class="field"><label>Valor perdido (R$)</label><input id="s-valor" inputmode="decimal" value="${s ? esc(s.valorPerdido) : ''}" placeholder="1800"></div>
      <div class="field"><label>Causa Provável</label><select id="s-causa">${selectOptions(CAUSAS, s ? s.causa : '')}</select></div>
    </div>
    <div class="field"><label>Tratativa / precauções recomendadas</label><textarea id="s-tratativa">${esc(s ? s.tratativa : '')}</textarea></div>
    <div class="field"><label>Foto da sucata (opcional, máx. 500 KB)</label>
      <input id="s-foto-input" type="file" accept="image/*" onchange="lerFotoSucata(this)">
      <img id="s-foto-preview" class="foto-preview" style="${s && s.foto ? '' : 'display:none'}" src="${s && s.foto ? s.foto : ''}">
    </div>
    <div class="modal-foot">
      <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn-cpk" onclick="salvarSucata('${s ? s.id : ''}')">Salvar</button>
    </div>`);
  _fotoSucata = s ? (s.foto || '') : '';
}
let _fotoSucata = '';
function lerFotoSucata(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  if (f.size > 500 * 1024) { toast('Foto acima de 500 KB. Escolha uma imagem menor.', true); input.value = ''; return; }
  const reader = new FileReader();
  reader.onload = () => {
    _fotoSucata = reader.result;
    const img = document.getElementById('s-foto-preview');
    img.src = reader.result; img.style.display = '';
  };
  reader.readAsDataURL(f);
}
function salvarSucata(id) {
  const rec = {
    empresaId: db.selectedEmpresaId, marca: val('s-marca'), modelo: val('s-modelo'),
    medida: val('s-medida'), vida: val('s-vida'), sulco: val('s-sulco'),
    dot: val('s-dot'), serie: val('s-serie'), valorPerdido: num('s-valor') || 0,
    causa: val('s-causa'), tratativa: val('s-tratativa'), foto: _fotoSucata || ''
  };
  if (!rec.marca && !rec.medida) { toast('Informe ao menos marca e medida do pneu.', true); return; }
  if (id) { Object.assign(db.sucatas.find(x => x.id === id), rec); toast('Sucata atualizada.'); }
  else { rec.id = uid(); db.sucatas.push(rec); toast('Sucata registrada.'); }
  saveDB(); closeModal(); render();
}

/* — Checklist — */
function modalChecklist(id) {
  const c = id ? db.checklists.find(x => x.id === id) : null;
  const veics = byEmpresa(db.veiculos);
  if (!veics.length) { toast('Cadastre um veículo antes de criar uma lista de verificação.', true); return; }
  const veicOpts = veics.map(v => `<option value="${v.id}" ${c && c.veiculoId === v.id ? 'selected' : ''}>${esc(v.placa)} · ${esc(v.modelo)}</option>`).join('');
  const itens = CHECK_ITENS.map((it, i) =>
    `<label class="check-item"><input type="checkbox" id="c-item-${i}" ${c && c.items && c.items[i] ? 'checked' : ''}><span class="ci-label">${esc(it)}</span></label>`
  ).join('');
  openModal(`
    <div class="modal-head"><h2>${c ? 'Editar Lista de Verificação' : 'Nova Lista de Verificação'}</h2><button class="btn-icon" onclick="closeModal()">✕</button></div>
    <div class="row-2">
      <div class="field"><label>Veículo (placa) <span class="req">*</span></label>
        <select id="c-veiculo"><option value="">Selecione...</option>${veicOpts}</select></div>
      <div class="field"><label>Data <span class="req">*</span></label><input id="c-data" type="date" value="${c ? c.data : todayISO()}"></div>
    </div>
    <label style="font-size:12px;font-weight:600;display:block;margin:8px 0 8px">Itens de inspeção</label>
    ${itens}
    <div class="modal-foot">
      <button class="btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn-cpk" onclick="salvarChecklist('${c ? c.id : ''}')">Salvar</button>
    </div>`);
}
function salvarChecklist(id) {
  const veiculoId = val('c-veiculo');
  if (!veiculoId) { toast('Selecione o veículo da inspeção.', true); return; }
  const items = CHECK_ITENS.map((_, i) => { const el = document.getElementById('c-item-' + i); return el ? el.checked : false; });
  const rec = { empresaId: db.selectedEmpresaId, veiculoId, placa: veiculoPlaca(veiculoId), data: val('c-data') || todayISO(), items };
  if (id) { Object.assign(db.checklists.find(x => x.id === id), rec); toast('Lista de verificação atualizada.'); }
  else { rec.id = uid(); db.checklists.push(rec); toast('Lista de verificação criada.'); }
  saveDB(); closeModal(); render();
}

/* ══════════════════════════════════════════════════════════════════════
   PDF & WhatsApp
   ══════════════════════════════════════════════════════════════════════ */
function propostaResumo() {
  const emp = selectedEmpresa();
  const prop = getProposta(emp.id);
  const pneus = byEmpresa(db.pneus);
  const validos = pneus.map(p => calcCPK(p.custo, p.kmInicial, p.kmReal)).filter(v => v != null);
  const cpkMedio = validos.length ? validos.reduce((a, b) => a + b, 0) / validos.length : null;
  const perdido = byEmpresa(db.sucatas).reduce((a, s) => a + (Number(s.valorPerdido) || 0), 0);
  return { emp, prop, pneus, cpkMedio, perdido, sucatas: byEmpresa(db.sucatas).length };
}

function gerarPDF() {
  const r = propostaResumo();
  const acoes = r.prop.acoes.filter(a => a.trim()).map(a => `<li>${esc(a)}</li>`).join('');
  const w = window.open('', '_blank');
  if (!w) { toast('Permita pop-ups para gerar o PDF.', true); return; }
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Proposta — ${esc(r.emp.nome)}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:40px}
      .head{background:linear-gradient(135deg,#0B5ED7,#0E8F6E);color:#fff;padding:26px 30px;border-radius:12px}
      .head h1{margin:0;font-size:30px;letter-spacing:.5px}
      .head p{margin:4px 0 0;opacity:.9}
      h2{margin:26px 0 10px;color:#0B5ED7}
      .kpis{display:flex;gap:14px;margin-top:16px}
      .kpi{flex:1;border:1px solid #ddd;border-radius:10px;padding:14px}
      .kpi .l{font-size:12px;color:#666}
      .kpi .v{font-size:24px;font-weight:800;margin-top:4px}
      ul{padding-left:20px} li{margin:6px 0}
      .inv{background:#F8D83C;color:#111;font-weight:700;padding:12px 16px;border-radius:10px;display:inline-block;margin-top:8px}
      .foot{margin-top:30px;font-size:12px;color:#888;border-top:1px solid #eee;padding-top:12px}
      @media print{body{padding:20px}}
    </style></head><body>
    <div class="head"><h1>CPK Frotas — Proposta Comercial</h1>
      <p>${esc(r.emp.nome)} · CNPJ ${esc(r.emp.cnpj || '—')} · Diagnóstico de ${fmtDateBR(r.emp.dataDiagnostico)}</p></div>
    <h2>Resumo do Diagnóstico</h2>
    <div class="kpis">
      <div class="kpi"><div class="l">CPK médio</div><div class="v">${fmtCPK(r.cpkMedio)}</div></div>
      <div class="kpi"><div class="l">Perdido total</div><div class="v">${fmtBRL(r.perdido)}</div></div>
      <div class="kpi"><div class="l">Pneus em operação</div><div class="v">${r.pneus.length}</div></div>
      <div class="kpi"><div class="l">Sucatas</div><div class="v">${r.sucatas}</div></div>
    </div>
    <h2>Ações Recomendadas</h2>
    <ul>${acoes || '<li>—</li>'}</ul>
    <h2>Investimento Sugerido</h2>
    <div class="inv">${esc(r.prop.investimento || 'A definir')}</div>
    <div class="foot">Gerado por CPK Frotas · Sistema de Gestão de Pneus</div>
    </body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 500);
}

function enviarWhatsApp() {
  const r = propostaResumo();
  const tel = (r.emp.telefone || '').replace(/\D/g, '');
  const linhas = [
    'Olá! Segue o resumo do diagnóstico de frota — *' + r.emp.nome + '*:',
    '',
    '• CPK médio: ' + fmtCPK(r.cpkMedio),
    '• Perdido total: ' + fmtBRL(r.perdido),
    '• Pneus em operação: ' + r.pneus.length,
    '• Sucatas: ' + r.sucatas,
    '',
    'Ações recomendadas:'
  ].concat(r.prop.acoes.filter(a => a.trim()).map(a => '- ' + a));
  linhas.push('', 'Investimento sugerido: ' + (r.prop.investimento || 'A definir'));
  linhas.push('', '(Anexe o PDF da proposta gerado no sistema.)');
  const msg = encodeURIComponent(linhas.join('\n'));
  const base = tel ? 'https://wa.me/55' + tel : 'https://wa.me/';
  window.open(base + '?text=' + msg, '_blank');
}

/* expõe funções para os handlers inline */
Object.assign(window, {
  login, logout, navigate, maskCNPJ, maskTel,
  selecionarEmpresa, excluirEmpresa, modalEmpresa, salvarEmpresa,
  modalVeiculo, salvarVeiculo, excluirVeiculo,
  modalPneu, salvarPneu, excluirPneu, preencherVeiculoPneu, atualizarCPKLive,
  modalSucata, salvarSucata, excluirSucata, lerFotoSucata,
  modalChecklist, salvarChecklist, excluirChecklist,
  atualizarAcao, removerAcao, adicionarAcao, atualizarInvestimento,
  gerarPDF, enviarWhatsApp, closeModal,
  get pneuFiltro() { return pneuFiltro; }
});

/* boot */
render();
