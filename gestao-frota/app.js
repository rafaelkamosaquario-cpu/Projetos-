/* ── STORAGE ─────────────────────────────────────────────────────────────── */
const STORAGE_KEY = 'frotabot_gestao_v1';
let DB = null;

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function todayISO() { return new Date().toISOString().slice(0, 10); }

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupted data, fall through to seed */ }
  return seedDB();
}

function saveDB() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
}

function emptyDB() {
  return { veiculos: [], motoristas: [], abastecimentos: [], manutencoes: [], pneus: [], viagens: [], custos: [] };
}

function seedDB() {
  const db = emptyDB();
  const v1 = uid(), v2 = uid(), v3 = uid();
  const m1 = uid(), m2 = uid();
  const addMonths = (n) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };

  db.veiculos = [
    { id: v1, placa: 'ABC1D23', tipo: 'Caminhão', marca: 'Volvo', modelo: 'FH 540', ano: 2020, km: 182400, status: 'ativo', vencDocumento: addMonths(2) },
    { id: v2, placa: 'XYZ9E87', tipo: 'Cavalo Mecânico', marca: 'Scania', modelo: 'R450', ano: 2019, km: 245100, status: 'ativo', vencDocumento: addMonths(0) },
    { id: v3, placa: 'JKL4F56', tipo: 'Van', marca: 'Mercedes', modelo: 'Sprinter', ano: 2022, km: 58300, status: 'manutencao', vencDocumento: addMonths(6) },
  ];
  db.motoristas = [
    { id: m1, nome: 'Carlos Pereira', cnh: '12345678900', vencCnh: addMonths(1), telefone: '(11) 98888-1234', status: 'ativo' },
    { id: m2, nome: 'Marcos Silva', cnh: '98765432100', vencCnh: addMonths(8), telefone: '(11) 97777-5678', status: 'ativo' },
  ];

  const thisMonth = todayISO().slice(0, 7);
  const lastMonth = addMonths(-1).slice(0, 7);
  db.abastecimentos = [
    { id: uid(), data: `${thisMonth}-05`, veiculoId: v1, combustivel: 'Diesel S10', posto: 'Posto Rota Norte', litros: 320, valor: 1980 },
    { id: uid(), data: `${thisMonth}-14`, veiculoId: v2, combustivel: 'Diesel S10', posto: 'Posto BR Express', litros: 410, valor: 2550 },
    { id: uid(), data: `${lastMonth}-20`, veiculoId: v1, combustivel: 'Diesel S10', posto: 'Posto Rota Norte', litros: 300, valor: 1850 },
  ];
  db.manutencoes = [
    { id: uid(), veiculoId: v3, tipo: 'corretiva', servico: 'Troca de embreagem', dataAgendada: `${thisMonth}-10`, dataRealizada: '', valor: 2400, status: 'pendente' },
    { id: uid(), veiculoId: v1, tipo: 'preventiva', servico: 'Revisão de freios', dataAgendada: `${lastMonth}-22`, dataRealizada: `${lastMonth}-22`, valor: 680, status: 'concluida' },
    { id: uid(), veiculoId: v2, tipo: 'preventiva', servico: 'Troca de óleo e filtros', dataAgendada: `${thisMonth}-25`, dataRealizada: '', valor: 520, status: 'agendada' },
  ];
  db.pneus = [
    { id: uid(), identificacao: 'PN-001', veiculoId: v1, aro: 22.5, valorCompra: 1850, kmInstalacao: 150000, kmRodado: 32400, recapagens: 0, status: 'em_uso' },
    { id: uid(), identificacao: 'PN-002', veiculoId: v2, aro: 22.5, valorCompra: 1750, kmInstalacao: 200000, kmRodado: 45100, recapagens: 1, status: 'em_uso' },
  ];
  db.viagens = [
    { id: uid(), saida: `${thisMonth}-03`, veiculoId: v1, motoristaId: m1, origem: 'São Paulo', destino: 'Curitiba', kmRodado: 850, frete: 4200, status: 'concluida' },
    { id: uid(), saida: `${thisMonth}-18`, veiculoId: v2, motoristaId: m2, origem: 'Campinas', destino: 'Rio de Janeiro', kmRodado: 950, frete: 5100, status: 'em_andamento' },
  ];
  db.custos = [
    { id: uid(), data: `${thisMonth}-08`, veiculoId: v1, tipo: 'Pedágio', fornecedor: 'ViaFácil', valor: 320 },
    { id: uid(), data: `${thisMonth}-12`, veiculoId: v2, tipo: 'Seguro', fornecedor: 'Porto Seguro', valor: 890 },
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  return db;
}

/* ── HELPERS ─────────────────────────────────────────────────────────────── */
function fmtMoney(n) { return (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtNum(n, dec = 0) { return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
function fmtDate(iso) { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
function daysUntil(iso) { if (!iso) return null; const ms = new Date(iso) - new Date(todayISO()); return Math.ceil(ms / 86400000); }
function veiculoLabel(id) { const v = DB.veiculos.find(x => x.id === id); return v ? v.placa : '—'; }
function motoristaLabel(id) { const m = DB.motoristas.find(x => x.id === id); return m ? m.nome : '—'; }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = isError ? 'show error' : 'show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ''; }, 2600);
}

/* ── NAVIGATION ──────────────────────────────────────────────────────────── */
const VIEW_META = {
  dashboard:      { title: 'Dashboard', sub: 'Visão geral da sua frota' },
  veiculos:       { title: 'Veículos', sub: 'Cadastro e status da frota' },
  motoristas:     { title: 'Motoristas', sub: 'Cadastro e documentação' },
  abastecimento:  { title: 'Abastecimento', sub: 'Histórico de combustível' },
  manutencao:     { title: 'Manutenção', sub: 'Preventivas e corretivas' },
  pneus:          { title: 'Pneus', sub: 'Controle de vida útil' },
  viagens:        { title: 'Viagens', sub: 'Fretes e rotas' },
  custos:         { title: 'Custos', sub: 'Outras despesas da frota' },
  relatorios:     { title: 'Relatórios', sub: 'Indicadores e tendências' },
};

const RENDERERS = {
  dashboard: renderDashboard,
  veiculos: renderVeiculos,
  motoristas: renderMotoristas,
  abastecimento: renderAbastecimentos,
  manutencao: renderManutencoes,
  pneus: renderPneus,
  viagens: renderViagens,
  custos: renderCustos,
  relatorios: renderRelatorios,
};

function showView(view) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  const meta = VIEW_META[view];
  document.getElementById('topbar-title').textContent = meta.title;
  document.getElementById('topbar-sub').textContent = meta.sub;
  document.getElementById('global-search').value = '';
  RENDERERS[view]();
  toggleSidebar(false);
  window.scrollTo(0, 0);
}

function toggleSidebar(open) {
  document.getElementById('sidebar').classList.toggle('open', open);
  document.getElementById('sidebar-overlay').classList.toggle('open', open);
}

/* ── MODAL ───────────────────────────────────────────────────────────────── */
let _modalSubmit = null;

function openModal(title, bodyHtml, onSubmit) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  _modalSubmit = onSubmit;
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById('modal-form').onsubmit = (e) => {
    e.preventDefault();
    if (_modalSubmit) _modalSubmit();
  };
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.getElementById('modal-form').onsubmit = null;
  _modalSubmit = null;
}

function val(id) { return document.getElementById(id).value.trim(); }
function valNum(id) { return parseFloat(document.getElementById(id).value) || 0; }

function veiculoOptions(selectedId) {
  if (!DB.veiculos.length) return '<option value="">Nenhum veículo cadastrado</option>';
  return DB.veiculos.map(v => `<option value="${v.id}" ${v.id === selectedId ? 'selected' : ''}>${esc(v.placa)} — ${esc(v.marca)} ${esc(v.modelo)}</option>`).join('');
}
function motoristaOptions(selectedId) {
  if (!DB.motoristas.length) return '<option value="">Nenhum motorista cadastrado</option>';
  return DB.motoristas.map(m => `<option value="${m.id}" ${m.id === selectedId ? 'selected' : ''}>${esc(m.nome)}</option>`).join('');
}

/* ── VEÍCULOS ────────────────────────────────────────────────────────────── */
function openVeiculoModal(id = null) {
  const v = id ? DB.veiculos.find(x => x.id === id) : null;
  const body = `
    <div class="form-grid">
      <div class="field"><label class="field-label">Placa</label><input id="f-placa" class="field-input" value="${esc(v?.placa || '')}" placeholder="ABC1D23" required></div>
      <div class="field"><label class="field-label">Tipo</label><input id="f-tipo" class="field-input" value="${esc(v?.tipo || '')}" placeholder="Caminhão, Van..." required></div>
      <div class="field"><label class="field-label">Marca</label><input id="f-marca" class="field-input" value="${esc(v?.marca || '')}" required></div>
      <div class="field"><label class="field-label">Modelo</label><input id="f-modelo" class="field-input" value="${esc(v?.modelo || '')}" required></div>
      <div class="field"><label class="field-label">Ano</label><input id="f-ano" type="number" class="field-input" value="${v?.ano || ''}" required></div>
      <div class="field"><label class="field-label">KM atual</label><input id="f-km" type="number" class="field-input" value="${v?.km || 0}" required></div>
      <div class="field"><label class="field-label">Status</label>
        <select id="f-status" class="field-select">
          <option value="ativo" ${v?.status === 'ativo' ? 'selected' : ''}>Ativo</option>
          <option value="manutencao" ${v?.status === 'manutencao' ? 'selected' : ''}>Em manutenção</option>
          <option value="inativo" ${v?.status === 'inativo' ? 'selected' : ''}>Inativo</option>
        </select>
      </div>
      <div class="field"><label class="field-label">Venc. documentação</label><input id="f-venc" type="date" class="field-input" value="${v?.vencDocumento || ''}"></div>
    </div>`;
  openModal(v ? 'Editar veículo' : 'Novo veículo', body, () => {
    const data = {
      placa: val('f-placa').toUpperCase(), tipo: val('f-tipo'), marca: val('f-marca'), modelo: val('f-modelo'),
      ano: valNum('f-ano'), km: valNum('f-km'), status: val('f-status'), vencDocumento: val('f-venc'),
    };
    if (!data.placa || !data.tipo || !data.marca || !data.modelo) { showToast('Preencha todos os campos obrigatórios', true); return; }
    if (v) Object.assign(v, data); else DB.veiculos.push({ id: uid(), ...data });
    saveDB(); closeModal(); renderVeiculos(); showToast('Veículo salvo com sucesso');
  });
}

function deleteVeiculo(id) {
  if (!confirm('Excluir este veículo? Esta ação não pode ser desfeita.')) return;
  DB.veiculos = DB.veiculos.filter(v => v.id !== id);
  saveDB(); renderVeiculos(); showToast('Veículo excluído');
}

function docBadge(vencIso) {
  if (!vencIso) return '<span class="badge gray">Sem data</span>';
  const d = daysUntil(vencIso);
  if (d < 0) return `<span class="badge red">Vencido</span>`;
  if (d <= 30) return `<span class="badge yellow">Vence em ${d}d</span>`;
  return `<span class="badge green">OK</span>`;
}

function statusBadge(status) {
  const map = {
    ativo: ['green', 'Ativo'], manutencao: ['yellow', 'Em manutenção'], inativo: ['gray', 'Inativo'],
    pendente: ['yellow', 'Pendente'], agendada: ['blue', 'Agendada'], concluida: ['green', 'Concluída'],
    em_uso: ['green', 'Em uso'], descartado: ['gray', 'Descartado'],
    em_andamento: ['blue', 'Em andamento'], cancelada: ['red', 'Cancelada'],
  };
  const [color, label] = map[status] || ['gray', status];
  return `<span class="badge ${color}">${label}</span>`;
}

function renderVeiculos() {
  const list = DB.veiculos;
  document.getElementById('count-veiculos').textContent = `${list.length} veículo${list.length === 1 ? '' : 's'}`;
  const tbody = document.getElementById('tbody-veiculos');
  document.getElementById('empty-veiculos').style.display = list.length ? 'none' : '';
  tbody.innerHTML = list.map(v => `
    <tr>
      <td class="cell-strong">${esc(v.placa)}</td>
      <td>${esc(v.tipo)}</td>
      <td>${esc(v.marca)} ${esc(v.modelo)}</td>
      <td>${v.ano}</td>
      <td>${fmtNum(v.km)} km</td>
      <td>${statusBadge(v.status)}</td>
      <td>${docBadge(v.vencDocumento)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" onclick="openVeiculoModal('${v.id}')" title="Editar">✏️</button>
        <button class="icon-btn danger" onclick="deleteVeiculo('${v.id}')" title="Excluir">🗑</button>
      </div></td>
    </tr>`).join('');
}

/* ── MOTORISTAS ──────────────────────────────────────────────────────────── */
function openMotoristaModal(id = null) {
  const m = id ? DB.motoristas.find(x => x.id === id) : null;
  const body = `
    <div class="form-grid">
      <div class="field full"><label class="field-label">Nome</label><input id="f-nome" class="field-input" value="${esc(m?.nome || '')}" required></div>
      <div class="field"><label class="field-label">CNH</label><input id="f-cnh" class="field-input" value="${esc(m?.cnh || '')}" required></div>
      <div class="field"><label class="field-label">Venc. CNH</label><input id="f-venccnh" type="date" class="field-input" value="${m?.vencCnh || ''}"></div>
      <div class="field"><label class="field-label">Telefone</label><input id="f-tel" class="field-input" value="${esc(m?.telefone || '')}" placeholder="(11) 90000-0000"></div>
      <div class="field"><label class="field-label">Status</label>
        <select id="f-status" class="field-select">
          <option value="ativo" ${m?.status === 'ativo' ? 'selected' : ''}>Ativo</option>
          <option value="inativo" ${m?.status === 'inativo' ? 'selected' : ''}>Inativo</option>
        </select>
      </div>
    </div>`;
  openModal(m ? 'Editar motorista' : 'Novo motorista', body, () => {
    const data = { nome: val('f-nome'), cnh: val('f-cnh'), vencCnh: val('f-venccnh'), telefone: val('f-tel'), status: val('f-status') };
    if (!data.nome || !data.cnh) { showToast('Preencha nome e CNH', true); return; }
    if (m) Object.assign(m, data); else DB.motoristas.push({ id: uid(), ...data });
    saveDB(); closeModal(); renderMotoristas(); showToast('Motorista salvo com sucesso');
  });
}

function deleteMotorista(id) {
  if (!confirm('Excluir este motorista?')) return;
  DB.motoristas = DB.motoristas.filter(m => m.id !== id);
  saveDB(); renderMotoristas(); showToast('Motorista excluído');
}

function renderMotoristas() {
  const list = DB.motoristas;
  document.getElementById('count-motoristas').textContent = `${list.length} motorista${list.length === 1 ? '' : 's'}`;
  const tbody = document.getElementById('tbody-motoristas');
  document.getElementById('empty-motoristas').style.display = list.length ? 'none' : '';
  tbody.innerHTML = list.map(m => `
    <tr>
      <td class="cell-strong">${esc(m.nome)}</td>
      <td>${esc(m.cnh)}</td>
      <td>${fmtDate(m.vencCnh)} ${m.vencCnh ? docBadge(m.vencCnh) : ''}</td>
      <td>${esc(m.telefone) || '—'}</td>
      <td>${statusBadge(m.status)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" onclick="openMotoristaModal('${m.id}')" title="Editar">✏️</button>
        <button class="icon-btn danger" onclick="deleteMotorista('${m.id}')" title="Excluir">🗑</button>
      </div></td>
    </tr>`).join('');
}

/* ── ABASTECIMENTO ───────────────────────────────────────────────────────── */
function openAbastecimentoModal(id = null) {
  const a = id ? DB.abastecimentos.find(x => x.id === id) : null;
  const body = `
    <div class="form-grid">
      <div class="field"><label class="field-label">Data</label><input id="f-data" type="date" class="field-input" value="${a?.data || todayISO()}" required></div>
      <div class="field"><label class="field-label">Veículo</label><select id="f-veiculo" class="field-select">${veiculoOptions(a?.veiculoId)}</select></div>
      <div class="field"><label class="field-label">Combustível</label>
        <select id="f-combustivel" class="field-select">
          <option ${a?.combustivel === 'Diesel S10' ? 'selected' : ''}>Diesel S10</option>
          <option ${a?.combustivel === 'Diesel S500' ? 'selected' : ''}>Diesel S500</option>
          <option ${a?.combustivel === 'Gasolina' ? 'selected' : ''}>Gasolina</option>
          <option ${a?.combustivel === 'Etanol' ? 'selected' : ''}>Etanol</option>
          <option ${a?.combustivel === 'Arla 32' ? 'selected' : ''}>Arla 32</option>
        </select>
      </div>
      <div class="field"><label class="field-label">Posto</label><input id="f-posto" class="field-input" value="${esc(a?.posto || '')}"></div>
      <div class="field"><label class="field-label">Litros</label><input id="f-litros" type="number" step="0.01" class="field-input" value="${a?.litros || ''}" required></div>
      <div class="field"><label class="field-label">Valor total (R$)</label><input id="f-valor" type="number" step="0.01" class="field-input" value="${a?.valor || ''}" required></div>
    </div>`;
  openModal(a ? 'Editar abastecimento' : 'Novo abastecimento', body, () => {
    const data = { data: val('f-data'), veiculoId: val('f-veiculo'), combustivel: val('f-combustivel'), posto: val('f-posto'), litros: valNum('f-litros'), valor: valNum('f-valor') };
    if (!data.data || !data.veiculoId || !data.litros || !data.valor) { showToast('Preencha todos os campos obrigatórios', true); return; }
    if (a) Object.assign(a, data); else DB.abastecimentos.push({ id: uid(), ...data });
    saveDB(); closeModal(); renderAbastecimentos(); showToast('Abastecimento salvo com sucesso');
  });
}

function deleteAbastecimento(id) {
  if (!confirm('Excluir este abastecimento?')) return;
  DB.abastecimentos = DB.abastecimentos.filter(a => a.id !== id);
  saveDB(); renderAbastecimentos(); showToast('Registro excluído');
}

function renderAbastecimentos() {
  const list = [...DB.abastecimentos].sort((a, b) => b.data.localeCompare(a.data));
  document.getElementById('count-abastecimento').textContent = `${list.length} registro${list.length === 1 ? '' : 's'}`;
  const tbody = document.getElementById('tbody-abastecimento');
  document.getElementById('empty-abastecimento').style.display = list.length ? 'none' : '';
  tbody.innerHTML = list.map(a => `
    <tr>
      <td>${fmtDate(a.data)}</td>
      <td class="cell-strong">${esc(veiculoLabel(a.veiculoId))}</td>
      <td>${esc(a.combustivel)}</td>
      <td>${esc(a.posto) || '—'}</td>
      <td>${fmtNum(a.litros, 1)} L</td>
      <td>${fmtMoney(a.valor)}</td>
      <td>${fmtMoney(a.litros ? a.valor / a.litros : 0)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" onclick="openAbastecimentoModal('${a.id}')" title="Editar">✏️</button>
        <button class="icon-btn danger" onclick="deleteAbastecimento('${a.id}')" title="Excluir">🗑</button>
      </div></td>
    </tr>`).join('');
}

/* ── MANUTENÇÃO ──────────────────────────────────────────────────────────── */
function openManutencaoModal(id = null) {
  const m = id ? DB.manutencoes.find(x => x.id === id) : null;
  const body = `
    <div class="form-grid">
      <div class="field"><label class="field-label">Veículo</label><select id="f-veiculo" class="field-select">${veiculoOptions(m?.veiculoId)}</select></div>
      <div class="field"><label class="field-label">Tipo</label>
        <select id="f-tipo" class="field-select">
          <option value="preventiva" ${m?.tipo === 'preventiva' ? 'selected' : ''}>Preventiva</option>
          <option value="corretiva" ${m?.tipo === 'corretiva' ? 'selected' : ''}>Corretiva</option>
        </select>
      </div>
      <div class="field full"><label class="field-label">Serviço</label><input id="f-servico" class="field-input" value="${esc(m?.servico || '')}" required></div>
      <div class="field"><label class="field-label">Data agendada</label><input id="f-agendada" type="date" class="field-input" value="${m?.dataAgendada || ''}"></div>
      <div class="field"><label class="field-label">Data realizada</label><input id="f-realizada" type="date" class="field-input" value="${m?.dataRealizada || ''}"></div>
      <div class="field"><label class="field-label">Valor (R$)</label><input id="f-valor" type="number" step="0.01" class="field-input" value="${m?.valor || ''}"></div>
      <div class="field"><label class="field-label">Status</label>
        <select id="f-status" class="field-select">
          <option value="agendada" ${m?.status === 'agendada' ? 'selected' : ''}>Agendada</option>
          <option value="pendente" ${m?.status === 'pendente' ? 'selected' : ''}>Pendente</option>
          <option value="concluida" ${m?.status === 'concluida' ? 'selected' : ''}>Concluída</option>
        </select>
      </div>
    </div>`;
  openModal(m ? 'Editar manutenção' : 'Nova manutenção', body, () => {
    const data = {
      veiculoId: val('f-veiculo'), tipo: val('f-tipo'), servico: val('f-servico'),
      dataAgendada: val('f-agendada'), dataRealizada: val('f-realizada'), valor: valNum('f-valor'), status: val('f-status'),
    };
    if (!data.veiculoId || !data.servico) { showToast('Preencha veículo e serviço', true); return; }
    if (m) Object.assign(m, data); else DB.manutencoes.push({ id: uid(), ...data });
    saveDB(); closeModal(); renderManutencoes(); showToast('Manutenção salva com sucesso');
  });
}

function deleteManutencao(id) {
  if (!confirm('Excluir este registro de manutenção?')) return;
  DB.manutencoes = DB.manutencoes.filter(m => m.id !== id);
  saveDB(); renderManutencoes(); showToast('Registro excluído');
}

function renderManutencoes() {
  const list = [...DB.manutencoes].sort((a, b) => (b.dataAgendada || '').localeCompare(a.dataAgendada || ''));
  document.getElementById('count-manutencao').textContent = `${list.length} registro${list.length === 1 ? '' : 's'}`;
  const tbody = document.getElementById('tbody-manutencao');
  document.getElementById('empty-manutencao').style.display = list.length ? 'none' : '';
  tbody.innerHTML = list.map(m => `
    <tr>
      <td class="cell-strong">${esc(veiculoLabel(m.veiculoId))}</td>
      <td>${m.tipo === 'corretiva' ? '<span class="badge red">Corretiva</span>' : '<span class="badge blue">Preventiva</span>'}</td>
      <td>${esc(m.servico)}</td>
      <td>${fmtDate(m.dataAgendada)}</td>
      <td>${fmtDate(m.dataRealizada)}</td>
      <td>${fmtMoney(m.valor)}</td>
      <td>${statusBadge(m.status)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" onclick="openManutencaoModal('${m.id}')" title="Editar">✏️</button>
        <button class="icon-btn danger" onclick="deleteManutencao('${m.id}')" title="Excluir">🗑</button>
      </div></td>
    </tr>`).join('');

  const pendentes = DB.manutencoes.filter(m => m.status !== 'concluida').length;
  const badge = document.getElementById('badge-manutencao');
  if (pendentes > 0) { badge.style.display = ''; badge.textContent = pendentes; } else { badge.style.display = 'none'; }
}

/* ── PNEUS ───────────────────────────────────────────────────────────────── */
function openPneuModal(id = null) {
  const p = id ? DB.pneus.find(x => x.id === id) : null;
  const body = `
    <div class="form-grid">
      <div class="field"><label class="field-label">Identificação</label><input id="f-ident" class="field-input" value="${esc(p?.identificacao || '')}" placeholder="PN-001" required></div>
      <div class="field"><label class="field-label">Veículo</label><select id="f-veiculo" class="field-select">${veiculoOptions(p?.veiculoId)}</select></div>
      <div class="field"><label class="field-label">Aro</label><input id="f-aro" type="number" step="0.1" class="field-input" value="${p?.aro || ''}"></div>
      <div class="field"><label class="field-label">Valor de compra (R$)</label><input id="f-valor" type="number" step="0.01" class="field-input" value="${p?.valorCompra || ''}"></div>
      <div class="field"><label class="field-label">KM rodado</label><input id="f-km" type="number" class="field-input" value="${p?.kmRodado || 0}"></div>
      <div class="field"><label class="field-label">Recapagens</label><input id="f-recap" type="number" class="field-input" value="${p?.recapagens || 0}"></div>
      <div class="field"><label class="field-label">Status</label>
        <select id="f-status" class="field-select">
          <option value="em_uso" ${p?.status === 'em_uso' ? 'selected' : ''}>Em uso</option>
          <option value="estoque" ${p?.status === 'estoque' ? 'selected' : ''}>Em estoque</option>
          <option value="descartado" ${p?.status === 'descartado' ? 'selected' : ''}>Descartado</option>
        </select>
      </div>
    </div>`;
  openModal(p ? 'Editar pneu' : 'Novo pneu', body, () => {
    const data = {
      identificacao: val('f-ident'), veiculoId: val('f-veiculo'), aro: valNum('f-aro'),
      valorCompra: valNum('f-valor'), kmRodado: valNum('f-km'), recapagens: valNum('f-recap'), status: val('f-status'),
    };
    if (!data.identificacao) { showToast('Preencha a identificação do pneu', true); return; }
    if (p) Object.assign(p, data); else DB.pneus.push({ id: uid(), ...data });
    saveDB(); closeModal(); renderPneus(); showToast('Pneu salvo com sucesso');
  });
}

function deletePneu(id) {
  if (!confirm('Excluir este pneu?')) return;
  DB.pneus = DB.pneus.filter(p => p.id !== id);
  saveDB(); renderPneus(); showToast('Pneu excluído');
}

function renderPneus() {
  const list = DB.pneus;
  document.getElementById('count-pneus').textContent = `${list.length} pneu${list.length === 1 ? '' : 's'}`;
  const tbody = document.getElementById('tbody-pneus');
  document.getElementById('empty-pneus').style.display = list.length ? 'none' : '';
  tbody.innerHTML = list.map(p => `
    <tr>
      <td class="cell-strong">${esc(p.identificacao)}</td>
      <td>${esc(veiculoLabel(p.veiculoId))}</td>
      <td>${p.aro || '—'}</td>
      <td>${fmtMoney(p.valorCompra)}</td>
      <td>${fmtNum(p.kmRodado)} km</td>
      <td>${p.recapagens}</td>
      <td>${statusBadge(p.status)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" onclick="openPneuModal('${p.id}')" title="Editar">✏️</button>
        <button class="icon-btn danger" onclick="deletePneu('${p.id}')" title="Excluir">🗑</button>
      </div></td>
    </tr>`).join('');
}

/* ── VIAGENS ─────────────────────────────────────────────────────────────── */
function openViagemModal(id = null) {
  const v = id ? DB.viagens.find(x => x.id === id) : null;
  const body = `
    <div class="form-grid">
      <div class="field"><label class="field-label">Saída</label><input id="f-saida" type="date" class="field-input" value="${v?.saida || todayISO()}" required></div>
      <div class="field"><label class="field-label">Veículo</label><select id="f-veiculo" class="field-select">${veiculoOptions(v?.veiculoId)}</select></div>
      <div class="field"><label class="field-label">Motorista</label><select id="f-motorista" class="field-select">${motoristaOptions(v?.motoristaId)}</select></div>
      <div class="field"><label class="field-label">Status</label>
        <select id="f-status" class="field-select">
          <option value="em_andamento" ${v?.status === 'em_andamento' ? 'selected' : ''}>Em andamento</option>
          <option value="concluida" ${v?.status === 'concluida' ? 'selected' : ''}>Concluída</option>
          <option value="cancelada" ${v?.status === 'cancelada' ? 'selected' : ''}>Cancelada</option>
        </select>
      </div>
      <div class="field"><label class="field-label">Origem</label><input id="f-origem" class="field-input" value="${esc(v?.origem || '')}" required></div>
      <div class="field"><label class="field-label">Destino</label><input id="f-destino" class="field-input" value="${esc(v?.destino || '')}" required></div>
      <div class="field"><label class="field-label">KM rodado</label><input id="f-km" type="number" class="field-input" value="${v?.kmRodado || ''}"></div>
      <div class="field"><label class="field-label">Frete (R$)</label><input id="f-frete" type="number" step="0.01" class="field-input" value="${v?.frete || ''}"></div>
    </div>`;
  openModal(v ? 'Editar viagem' : 'Nova viagem', body, () => {
    const data = {
      saida: val('f-saida'), veiculoId: val('f-veiculo'), motoristaId: val('f-motorista'), status: val('f-status'),
      origem: val('f-origem'), destino: val('f-destino'), kmRodado: valNum('f-km'), frete: valNum('f-frete'),
    };
    if (!data.saida || !data.origem || !data.destino) { showToast('Preencha origem, destino e data de saída', true); return; }
    if (v) Object.assign(v, data); else DB.viagens.push({ id: uid(), ...data });
    saveDB(); closeModal(); renderViagens(); showToast('Viagem salva com sucesso');
  });
}

function deleteViagem(id) {
  if (!confirm('Excluir esta viagem?')) return;
  DB.viagens = DB.viagens.filter(v => v.id !== id);
  saveDB(); renderViagens(); showToast('Viagem excluída');
}

function renderViagens() {
  const list = [...DB.viagens].sort((a, b) => b.saida.localeCompare(a.saida));
  document.getElementById('count-viagens').textContent = `${list.length} viagem${list.length === 1 ? '' : 'ns'}`;
  const tbody = document.getElementById('tbody-viagens');
  document.getElementById('empty-viagens').style.display = list.length ? 'none' : '';
  tbody.innerHTML = list.map(v => `
    <tr>
      <td>${fmtDate(v.saida)}</td>
      <td class="cell-strong">${esc(veiculoLabel(v.veiculoId))}</td>
      <td>${esc(motoristaLabel(v.motoristaId))}</td>
      <td>${esc(v.origem)} → ${esc(v.destino)}</td>
      <td>${fmtNum(v.kmRodado)} km</td>
      <td>${fmtMoney(v.frete)}</td>
      <td>${statusBadge(v.status)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" onclick="openViagemModal('${v.id}')" title="Editar">✏️</button>
        <button class="icon-btn danger" onclick="deleteViagem('${v.id}')" title="Excluir">🗑</button>
      </div></td>
    </tr>`).join('');
}

/* ── CUSTOS ──────────────────────────────────────────────────────────────── */
function openCustoModal(id = null) {
  const c = id ? DB.custos.find(x => x.id === id) : null;
  const body = `
    <div class="form-grid">
      <div class="field"><label class="field-label">Data</label><input id="f-data" type="date" class="field-input" value="${c?.data || todayISO()}" required></div>
      <div class="field"><label class="field-label">Veículo</label><select id="f-veiculo" class="field-select">${veiculoOptions(c?.veiculoId)}</select></div>
      <div class="field"><label class="field-label">Tipo</label><input id="f-tipo" class="field-input" value="${esc(c?.tipo || '')}" placeholder="Pedágio, Seguro, Multa..." required></div>
      <div class="field"><label class="field-label">Fornecedor</label><input id="f-fornecedor" class="field-input" value="${esc(c?.fornecedor || '')}"></div>
      <div class="field full"><label class="field-label">Valor (R$)</label><input id="f-valor" type="number" step="0.01" class="field-input" value="${c?.valor || ''}" required></div>
    </div>`;
  openModal(c ? 'Editar custo' : 'Novo custo', body, () => {
    const data = { data: val('f-data'), veiculoId: val('f-veiculo'), tipo: val('f-tipo'), fornecedor: val('f-fornecedor'), valor: valNum('f-valor') };
    if (!data.data || !data.tipo || !data.valor) { showToast('Preencha todos os campos obrigatórios', true); return; }
    if (c) Object.assign(c, data); else DB.custos.push({ id: uid(), ...data });
    saveDB(); closeModal(); renderCustos(); showToast('Custo salvo com sucesso');
  });
}

function deleteCusto(id) {
  if (!confirm('Excluir este custo?')) return;
  DB.custos = DB.custos.filter(c => c.id !== id);
  saveDB(); renderCustos(); showToast('Custo excluído');
}

function renderCustos() {
  const list = [...DB.custos].sort((a, b) => b.data.localeCompare(a.data));
  document.getElementById('count-custos').textContent = `${list.length} registro${list.length === 1 ? '' : 's'}`;
  const tbody = document.getElementById('tbody-custos');
  document.getElementById('empty-custos').style.display = list.length ? 'none' : '';
  tbody.innerHTML = list.map(c => `
    <tr>
      <td>${fmtDate(c.data)}</td>
      <td class="cell-strong">${esc(veiculoLabel(c.veiculoId))}</td>
      <td>${esc(c.tipo)}</td>
      <td>${esc(c.fornecedor) || '—'}</td>
      <td>${fmtMoney(c.valor)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" onclick="openCustoModal('${c.id}')" title="Editar">✏️</button>
        <button class="icon-btn danger" onclick="deleteCusto('${c.id}')" title="Excluir">🗑</button>
      </div></td>
    </tr>`).join('');
}

/* ── DASHBOARD CALCULATIONS ──────────────────────────────────────────────── */
function monthKey(iso) { return iso ? iso.slice(0, 7) : ''; }

function monthTotals(ym) {
  const comb = DB.abastecimentos.filter(a => monthKey(a.data) === ym).reduce((s, a) => s + (a.valor || 0), 0);
  const manutList = DB.manutencoes.filter(m => monthKey(m.dataRealizada || m.dataAgendada) === ym);
  const manutPrev = manutList.filter(m => m.tipo === 'preventiva').reduce((s, m) => s + (m.valor || 0), 0);
  const manutCorr = manutList.filter(m => m.tipo === 'corretiva').reduce((s, m) => s + (m.valor || 0), 0);
  const custos = DB.custos.filter(c => monthKey(c.data) === ym).reduce((s, c) => s + (c.valor || 0), 0);
  const km = DB.viagens.filter(v => monthKey(v.saida) === ym).reduce((s, v) => s + (v.kmRodado || 0), 0);
  return { comb, manutPrev, manutCorr, manut: manutPrev + manutCorr, custos, km, total: comb + manutPrev + manutCorr + custos };
}

function last6Months() {
  const arr = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(d); dt.setMonth(d.getMonth() - i);
    arr.push(dt.toISOString().slice(0, 7));
  }
  return arr;
}

function monthLabel(ym) {
  const [y, m] = ym.split('-');
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${names[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

function renderDashboard() {
  const ym = todayISO().slice(0, 7);
  const prevYm = last6Months()[4];
  const cur = monthTotals(ym);
  const prev = monthTotals(prevYm);
  const frotaAtiva = DB.veiculos.filter(v => v.status === 'ativo').length;
  const cpk = cur.km > 0 ? cur.total / cur.km : 0;
  const cpkPrev = prev.km > 0 ? prev.total / prev.km : 0;

  const delta = (curV, prevV) => {
    if (!prevV) return { dir: 'neutral', txt: '—' };
    const pct = ((curV - prevV) / prevV) * 100;
    if (Math.abs(pct) < 0.5) return { dir: 'neutral', txt: '0%' };
    return { dir: pct > 0 ? 'down' : 'up', txt: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%` };
  };
  const dTotal = delta(cur.total, prev.total);
  const dCpk = delta(cpk, cpkPrev);

  const kpis = [
    { icon: '🚛', color: 'blue', val: frotaAtiva, lbl: 'Veículos ativos', delta: null },
    { icon: '🛣️', color: 'purple', val: `${fmtNum(cur.km)} km`, lbl: 'KM rodado no mês', delta: null },
    { icon: '💰', color: 'orange', val: fmtMoney(cur.total), lbl: 'Custo total no mês', delta: dTotal },
    { icon: '📉', color: 'green', val: fmtMoney(cpk), lbl: 'Custo por KM (CPK)', delta: dCpk },
  ];
  document.getElementById('kpi-grid').innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="kpi-top">
        <div class="kpi-icon ${k.color}">${k.icon}</div>
        ${k.delta ? `<span class="kpi-delta ${k.delta.dir}">${k.delta.txt}</span>` : ''}
      </div>
      <div class="kpi-val">${k.val}</div>
      <div class="kpi-lbl">${k.lbl}</div>
    </div>`).join('');

  renderDonut(cur);
  renderAlerts();
  renderTopVeiculos(ym);
  renderManutRatio(cur);
}

function renderDonut(cur) {
  const slices = [
    { label: 'Combustível', val: cur.comb, color: 'var(--primary)' },
    { label: 'Manutenção', val: cur.manut, color: 'var(--orange)' },
    { label: 'Outros custos', val: cur.custos, color: 'var(--purple)' },
  ];
  const total = slices.reduce((s, x) => s + x.val, 0);
  const wrap = document.getElementById('donut-wrap');
  if (total <= 0) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div>Sem dados de custos neste mês.</div>';
    return;
  }
  let acc = 0;
  const stops = slices.map(s => {
    const start = (acc / total) * 360; acc += s.val;
    const end = (acc / total) * 360;
    return `${s.color} ${start}deg ${end}deg`;
  }).join(', ');
  wrap.innerHTML = `
    <div class="donut" style="background: conic-gradient(${stops});">
      <div class="donut-hole">
        <div class="donut-hole-val">${fmtMoney(total).replace('R$', '').trim()}</div>
        <div class="donut-hole-lbl">total (R$)</div>
      </div>
    </div>
    <div class="donut-legend">
      ${slices.map(s => `
        <div class="donut-legend-item">
          <span class="donut-dot" style="background:${s.color}"></span>
          <span class="donut-legend-name">${s.label}</span>
          <span class="donut-legend-val">${fmtMoney(s.val)}</span>
        </div>`).join('')}
    </div>`;
}

function renderAlerts() {
  const alerts = [];
  DB.veiculos.forEach(v => {
    if (!v.vencDocumento) return;
    const d = daysUntil(v.vencDocumento);
    if (d < 0) alerts.push({ sev: 'danger', icon: '🚨', title: `Documento vencido — ${v.placa}`, sub: `Venceu há ${Math.abs(d)} dia(s)` });
    else if (d <= 30) alerts.push({ sev: 'warn', icon: '⚠️', title: `Documento a vencer — ${v.placa}`, sub: `Vence em ${d} dia(s)` });
  });
  DB.motoristas.forEach(m => {
    if (!m.vencCnh) return;
    const d = daysUntil(m.vencCnh);
    if (d < 0) alerts.push({ sev: 'danger', icon: '🚨', title: `CNH vencida — ${m.nome}`, sub: `Venceu há ${Math.abs(d)} dia(s)` });
    else if (d <= 30) alerts.push({ sev: 'warn', icon: '⚠️', title: `CNH a vencer — ${m.nome}`, sub: `Vence em ${d} dia(s)` });
  });
  DB.manutencoes.forEach(m => {
    if (m.status === 'concluida' || !m.dataAgendada) return;
    const d = daysUntil(m.dataAgendada);
    if (d < 0) alerts.push({ sev: 'danger', icon: '🔧', title: `Manutenção atrasada — ${veiculoLabel(m.veiculoId)}`, sub: `${m.servico} • atrasada ${Math.abs(d)} dia(s)` });
    else if (d <= 7) alerts.push({ sev: 'warn', icon: '🔧', title: `Manutenção próxima — ${veiculoLabel(m.veiculoId)}`, sub: `${m.servico} • em ${d} dia(s)` });
  });

  const box = document.getElementById('alert-list');
  if (!alerts.length) {
    box.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div>Nenhum alerta no momento.</div>';
    return;
  }
  alerts.sort((a, b) => (a.sev === 'danger' ? -1 : 1) - (b.sev === 'danger' ? -1 : 1));
  box.innerHTML = alerts.map(a => `
    <div class="alert-row ${a.sev}">
      <div class="alert-row-icon">${a.icon}</div>
      <div>
        <div class="alert-row-title">${esc(a.title)}</div>
        <div class="alert-row-sub">${esc(a.sub)}</div>
      </div>
    </div>`).join('');
}

function renderTopVeiculos(ym) {
  const costByVeiculo = {};
  const add = (id, val) => { if (!id) return; costByVeiculo[id] = (costByVeiculo[id] || 0) + val; };
  DB.abastecimentos.filter(a => monthKey(a.data) === ym).forEach(a => add(a.veiculoId, a.valor));
  DB.manutencoes.filter(m => monthKey(m.dataRealizada || m.dataAgendada) === ym).forEach(m => add(m.veiculoId, m.valor));
  DB.custos.filter(c => monthKey(c.data) === ym).forEach(c => add(c.veiculoId, c.valor));

  const rows = Object.entries(costByVeiculo).map(([id, val]) => ({ id, val })).sort((a, b) => b.val - a.val).slice(0, 5);
  const box = document.getElementById('top-veiculos-list');
  if (!rows.length) {
    box.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚛</div>Sem custos registrados neste mês.</div>';
    return;
  }
  const max = rows[0].val || 1;
  box.innerHTML = rows.map(r => `
    <div>
      <div class="bar-row-top"><span class="bar-row-name">${esc(veiculoLabel(r.id))}</span><span class="bar-row-val">${fmtMoney(r.val)}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(r.val / max) * 100}%"></div></div>
    </div>`).join('');
}

function renderManutRatio(cur) {
  const total = cur.manutPrev + cur.manutCorr;
  const box = document.getElementById('manut-ratio-box');
  if (total <= 0) {
    box.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔧</div>Sem manutenções registradas neste mês.</div>';
    return;
  }
  const pctCorr = (cur.manutCorr / total) * 100;
  const pctPrev = 100 - pctCorr;
  const onTarget = pctCorr <= 20;
  box.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div>
        <div class="bar-row-top"><span class="bar-row-name">Preventiva</span><span class="bar-row-val">${pctPrev.toFixed(0)}% • ${fmtMoney(cur.manutPrev)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pctPrev}%;background:var(--green)"></div></div>
      </div>
      <div>
        <div class="bar-row-top"><span class="bar-row-name">Corretiva</span><span class="bar-row-val">${pctCorr.toFixed(0)}% • ${fmtMoney(cur.manutCorr)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pctCorr}%;background:var(--red)"></div></div>
      </div>
      <span class="badge ${onTarget ? 'green' : 'red'}" style="align-self:flex-start">${onTarget ? '✓ Dentro da meta (≤20%)' : '✗ Acima da meta (>20%)'}</span>
    </div>`;
}

/* ── RELATÓRIOS ──────────────────────────────────────────────────────────── */
function renderRelatorios() {
  const months = last6Months();
  const data = months.map(ym => ({ ym, ...monthTotals(ym) }));

  const max = Math.max(...data.map(d => d.total), 1);
  const trendBox = document.getElementById('trend-chart');
  trendBox.innerHTML = data.map(d => `
    <div>
      <div class="bar-row-top"><span class="bar-row-name">${monthLabel(d.ym)}</span><span class="bar-row-val">${fmtMoney(d.total)}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(d.total / max) * 100}%"></div></div>
    </div>`).join('');

  const tbody = document.getElementById('tbody-relatorios');
  tbody.innerHTML = data.slice().reverse().map(d => `
    <tr>
      <td class="cell-strong">${monthLabel(d.ym)}</td>
      <td>${fmtMoney(d.comb)}</td>
      <td>${fmtMoney(d.manutPrev)}</td>
      <td>${fmtMoney(d.manutCorr)}</td>
      <td>${fmtMoney(d.custos)}</td>
      <td class="cell-strong">${fmtMoney(d.total)}</td>
      <td>${fmtNum(d.km)} km</td>
      <td>${fmtMoney(d.km ? d.total / d.km : 0)}</td>
    </tr>`).join('');
}

/* ── SEARCH ──────────────────────────────────────────────────────────────── */
function onSearchInput() {
  const term = document.getElementById('global-search').value.trim().toLowerCase();
  const activeView = document.querySelector('.view.active');
  if (!activeView) return;
  const tbody = activeView.querySelector('tbody[id^="tbody-"]');
  if (!tbody) return;
  Array.from(tbody.rows).forEach(row => {
    row.style.display = !term || row.textContent.toLowerCase().includes(term) ? '' : 'none';
  });
}

/* ── EXPORT / IMPORT / RESET ─────────────────────────────────────────────── */
function exportData() {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `frotabot-gestao-${todayISO()}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Dados exportados com sucesso');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const base = emptyDB();
      Object.keys(base).forEach(k => { if (Array.isArray(parsed[k])) base[k] = parsed[k]; });
      DB = base;
      saveDB();
      RENDERERS[currentView()]();
      showToast('Dados importados com sucesso');
    } catch (e) {
      showToast('Arquivo inválido. Verifique o JSON exportado.', true);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function confirmReset() {
  if (!confirm('Isso vai apagar TODOS os dados cadastrados. Deseja continuar?')) return;
  DB = emptyDB();
  saveDB();
  RENDERERS[currentView()]();
  showToast('Todos os dados foram apagados');
}

function currentView() {
  const active = document.querySelector('.view.active');
  return active ? active.id.replace('view-', '') : 'dashboard';
}

/* ── INIT ────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  DB = loadDB();
  renderDashboard();
});
