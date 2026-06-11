const API = "https://projetos-production-2a07.up.railway.app";

// ─── USUÁRIOS ───
const usuarios = {
  'rafael@frotabot.com.br': { senha: 'admin123', perfil: 'admin', nome: 'Rafael' },
  'silva@transportadora.com': { senha: 'silva123', perfil: 'cliente', nome: 'Carlos Silva' }
};

let usuarioLogado = null;

// ─── API HELPER ───
async function apiFetch(path, opts = {}) {
  try {
    const res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts
    });
    return await res.json();
  } catch (e) {
    console.error('API error:', e);
    return null;
  }
}

// ─── LOGIN ───
document.getElementById('formLogin').addEventListener('submit', e => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const senha = document.getElementById('loginSenha').value.trim();
  const erro  = document.getElementById('loginErro');
  const user  = usuarios[email];
  if (!user || user.senha !== senha) {
    erro.textContent = 'E-mail ou senha incorretos.';
    erro.style.display = 'block';
    return;
  }
  erro.style.display = 'none';
  usuarioLogado = { ...user, email };
  iniciarPainel();
});

async function iniciarPainel() {
  document.getElementById('telaLogin').style.display = 'none';
  document.getElementById('painelPrincipal').style.display = 'flex';
  document.getElementById('nomeUsuario').textContent = usuarioLogado.nome;
  document.getElementById('perfilUsuario').textContent =
    usuarioLogado.perfil === 'admin' ? 'Administrador' : 'Gestor de Frota';
  document.getElementById('avatarUsuario').textContent =
    usuarioLogado.nome.charAt(0).toUpperCase();
  if (usuarioLogado.perfil === 'cliente') {
    document.querySelectorAll('[data-page="empresas"]').forEach(el => el.style.display = 'none');
  }
  await carregarDashboard();
}

// ─── LOGOUT ───
document.getElementById('btnLogout').addEventListener('click', () => {
  usuarioLogado = null;
  document.getElementById('painelPrincipal').style.display = 'none';
  document.getElementById('telaLogin').style.display = 'flex';
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginSenha').value = '';
});

// ─── NAVEGAÇÃO ───
const navItems  = document.querySelectorAll('.nav-item');
const pages     = document.querySelectorAll('.page');
const pageTitle = document.getElementById('pageTitle');

const titles = {
  dashboard: 'Dashboard', empresas: 'Empresas', veiculos: 'Veículos',
  motoristas: 'Motoristas', manutencao: 'Manutenção', documentos: 'Documentos',
  checklists: 'Checklists', alertas: 'Alertas', relatorios: 'Relatórios',
  configuracoes: 'Configurações'
};

navItems.forEach(item => {
  item.addEventListener('click', async e => {
    e.preventDefault();
    const page = item.dataset.page;
    navItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    pageTitle.textContent = titles[page];
    if (window.innerWidth <= 768) fecharSidebar();
    if (page === 'dashboard')  await carregarDashboard();
    if (page === 'veiculos')   await carregarVeiculos();
    if (page === 'motoristas') await carregarMotoristas();
    if (page === 'manutencao') await carregarManutencoes();
    if (page === 'documentos') await carregarDocumentos();
    if (page === 'checklists') await carregarChecklists();
    if (page === 'relatorios')    await carregarRelatorio();
    if (page === 'configuracoes') await carregarConfiguracoes();
  });
});

function abrirSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarBackdrop').classList.add('open');
}
function fecharSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('open');
}

document.getElementById('menuToggle').addEventListener('click', () => {
  const aberta = document.getElementById('sidebar').classList.contains('open');
  aberta ? fecharSidebar() : abrirSidebar();
});
document.getElementById('sidebarBackdrop').addEventListener('click', fecharSidebar);

// ─── BOTÃO + NOVO ───
document.getElementById('btnAdd').addEventListener('click', () => {
  const activeItem = document.querySelector('.nav-item.active');
  if (!activeItem) return;
  const activePage = activeItem.dataset.page;
  const modalMap = {
    empresas: 'modalEmpresa', veiculos: 'modalVeiculo', motoristas: 'modalMotorista',
    manutencao: 'modalManutencao', documentos: 'modalDocumento'
  };
  if (modalMap[activePage]) openModal(modalMap[activePage]);
});

// ─── MODALS ───
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(event, id) {
  if (event.target === document.getElementById(id)) document.getElementById(id).classList.remove('open');
}
function closeModalById(id) { document.getElementById(id).classList.remove('open'); }

// ─── TOAST ───
function showToast(msg, tipo = 'success') {
  const t = document.createElement('div');
  t.textContent = msg;
  const bg = tipo === 'error' ? '#EF4444' : '#22C55E';
  t.style.cssText = `position:fixed;bottom:24px;right:24px;background:${bg};color:#fff;padding:14px 22px;border-radius:10px;font-weight:600;font-size:0.9rem;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.2);`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ─── HELPERS ───
function fmtData(val) {
  return val ? val.split('-').reverse().join('/') : '—';
}
function diasRestantes(val) {
  if (!val) return { dias: 999, cls: 'days-ok', txt: '—' };
  const dias = Math.ceil((new Date(val) - new Date()) / 86400000);
  const cls = dias <= 0 ? 'days-critical' : dias <= 7 ? 'days-critical' : dias <= 15 ? 'days-warn' : 'days-ok';
  const txt = dias <= 0 ? 'Vencido' : `${dias} dias`;
  return { dias, cls, txt };
}

// ─── DASHBOARD ───
async function carregarDashboard() {
  const rel = await apiFetch('/api/relatorio');
  if (!rel) return;
  const cards = document.querySelectorAll('#page-dashboard .metric-value');
  if (cards.length >= 4) {
    cards[0].textContent = '—';
    cards[1].textContent = rel.total_veiculos ?? '0';
    cards[2].textContent = rel.total_motoristas ?? '0';
    const alertas = (rel.manutencoes_proximas_7dias || 0) + (rel.documentos_proximos_30dias || 0);
    cards[3].textContent = alertas;
  }
  const ck = rel.checklists || {};
  const total = ck.total || 0;
  const resp  = ck.respondidos || 0;
  const pct   = total > 0 ? Math.round(resp / total * 100) : 0;
  const progressBar = document.querySelector('#page-dashboard .progress-bar');
  const progressLabel = document.querySelector('#page-dashboard .progress-label');
  const badgeGreen = document.querySelector('#page-dashboard .badge-green');
  if (progressBar)  progressBar.style.width = pct + '%';
  if (progressLabel) progressLabel.textContent = pct + '% de resposta';
  if (badgeGreen)   badgeGreen.textContent = `${resp}/${total} respondidos`;
}

// ─── VEÍCULOS ───
async function carregarVeiculos() {
  const lista = await apiFetch('/api/veiculos');
  if (!lista) return;
  const tbody = document.querySelector('#page-veiculos .data-table tbody');
  tbody.innerHTML = '';
  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9ca3af;">Nenhum veículo cadastrado.</td></tr>';
    return;
  }
  lista.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${v.placa}</strong></td>
      <td>${v.modelo || '—'}</td>
      <td>${v.ano || '—'}</td>
      <td>—</td><td>—</td>
      <td><span class="status-dot green"></span> OK</td>
      <td><button class="btn-sm btn-del" onclick="deletarVeiculo(${v.id}, this)">Excluir</button></td>`;
    tbody.appendChild(tr);
  });
  atualizarSelectVeiculos(lista);
}

function atualizarSelectVeiculos(lista) {
  ['vei-empresa', 'mot-veiculo', 'man-veiculo'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel || id === 'vei-empresa') return;
    const current = sel.value;
    sel.innerHTML = lista.map(v => `<option value="${v.placa}">${v.placa}${v.modelo ? ' — ' + v.modelo : ''}</option>`).join('');
    if (current) sel.value = current;
  });
}

async function deletarVeiculo(id, btn) {
  if (!confirm('Excluir este veículo?')) return;
  await apiFetch(`/api/veiculos/${id}`, { method: 'DELETE' });
  btn.closest('tr').remove();
  showToast('Veículo removido.');
}

// ─── MOTORISTAS ───
async function carregarMotoristas() {
  const lista = await apiFetch('/api/motoristas');
  if (!lista) return;
  const tbody = document.querySelector('#page-motoristas .data-table tbody');
  tbody.innerHTML = '';
  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9ca3af;">Nenhum motorista cadastrado.</td></tr>';
    return;
  }
  lista.forEach(m => {
    const ckBadge = m.checklist_hoje === 'respondido'
      ? '<span class="badge-green">✅ Respondido</span>'
      : m.checklist_hoje === 'pendente'
        ? '<span class="badge-red">❌ Pendente</span>'
        : '<span class="badge-orange">⚠️ Não enviado</span>';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${m.nome}</strong></td>
      <td>${m.whatsapp}</td>
      <td>—</td>
      <td>${m.veiculo_placa || '—'}</td>
      <td>—</td><td>—</td>
      <td>${ckBadge}</td>
      <td><button class="btn-sm btn-del" onclick="deletarMotorista(${m.id}, this)">Excluir</button></td>`;
    tbody.appendChild(tr);
  });
}

async function deletarMotorista(id, btn) {
  if (!confirm('Excluir este motorista?')) return;
  await apiFetch(`/api/motoristas/${id}`, { method: 'DELETE' });
  btn.closest('tr').remove();
  showToast('Motorista removido.');
}

// ─── MANUTENÇÕES ───
async function carregarManutencoes() {
  const lista = await apiFetch('/api/manutencoes');
  if (!lista) return;
  const tbody = document.querySelector('#page-manutencao .data-table tbody');
  tbody.innerHTML = '';
  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9ca3af;">Nenhuma manutenção cadastrada.</td></tr>';
    return;
  }
  lista.forEach(m => {
    const d = diasRestantes(m.vencimento);
    const dotCls = d.dias <= 3 ? 'orange' : d.dias <= 7 ? 'yellow' : 'green';
    const statusTxt = m.agendada ? 'Agendado' : d.dias <= 3 ? 'Urgente' : d.dias <= 7 ? 'Atenção' : 'Programado';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${m.veiculo_placa}</strong></td>
      <td>—</td>
      <td>${m.tipo}</td>
      <td>${fmtData(m.vencimento)}</td>
      <td><span class="${d.cls}">${d.txt}</span></td>
      <td><span class="status-dot ${dotCls}"></span> ${statusTxt}</td>
      <td>${m.agendada ? '✅ Sim' : '❌ Não'}</td>`;
    tbody.appendChild(tr);
  });
}

// ─── DOCUMENTOS ───
async function carregarDocumentos() {
  const lista = await apiFetch('/api/documentos');
  if (!lista) return;
  const tbody = document.querySelector('#page-documentos .data-table tbody');
  tbody.innerHTML = '';
  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9ca3af;">Nenhum documento cadastrado.</td></tr>';
    return;
  }
  lista.forEach(d => {
    const dr = diasRestantes(d.vencimento);
    const dotCls = dr.dias <= 0 ? 'red' : dr.dias <= 7 ? 'orange' : dr.dias <= 15 ? 'yellow' : 'green';
    const statusTxt = dr.dias <= 0 ? 'Vencido' : dr.dias <= 7 ? 'Urgente' : dr.dias <= 15 ? 'Atenção' : 'Regular';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.tipo}</td>
      <td>${d.referencia}</td>
      <td>—</td>
      <td>${fmtData(d.vencimento)}</td>
      <td><span class="${dr.cls}">${dr.txt}</span></td>
      <td><span class="status-dot ${dotCls}"></span> ${statusTxt}</td>`;
    tbody.appendChild(tr);
  });
}

// ─── CHECKLISTS ───
async function carregarChecklists() {
  const rel = await apiFetch('/api/relatorio');
  if (!rel) return;
  const ck = rel.checklists || {};
  const total = ck.total || 0;
  const resp  = ck.respondidos || 0;
  const pct   = total > 0 ? Math.round(resp / total * 100) : 0;
  const bar   = document.querySelector('#page-checklists .progress-bar');
  const lbl   = document.querySelector('#page-checklists .progress-label');
  const badge = document.querySelector('#page-checklists .badge-green');
  if (bar)   bar.style.width = pct + '%';
  if (lbl)   lbl.textContent = pct + '% — ' + new Date().toLocaleDateString('pt-BR');
  if (badge) badge.textContent = `${resp}/${total} respondidos hoje`;
  const motoristas = await apiFetch('/api/motoristas');
  if (!motoristas) return;
  const tbody = document.querySelector('#page-checklists .data-table tbody');
  tbody.innerHTML = '';
  if (motoristas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#9ca3af;">Nenhum motorista cadastrado.</td></tr>';
    return;
  }
  motoristas.forEach(m => {
    const ckBadge = m.checklist_hoje === 'respondido'
      ? '<span class="badge-green">OK ✅</span>'
      : m.checklist_hoje === 'pendente'
        ? '<span class="badge-red">Pendente ❌</span>'
        : '<span class="badge-orange">Não enviado</span>';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.nome}</td>
      <td>${m.veiculo_placa || '—'}</td>
      <td>—</td>
      <td>07:00</td>
      <td>—</td>
      <td>${ckBadge}</td>
      <td>1</td>`;
    tbody.appendChild(tr);
  });
}

// ─── RELATÓRIO ───
async function carregarRelatorio() {
  const rel = await apiFetch('/api/relatorio');
  if (!rel) return;
  const ck = rel.checklists || {};
  const total = ck.total || 0;
  const resp  = ck.respondidos || 0;
  const pct   = total > 0 ? Math.round(resp / total * 100) : 0;
  const cards = document.querySelectorAll('#page-relatorios .metric-value');
  if (cards.length >= 4) {
    cards[0].textContent = pct + '%';
    cards[1].textContent = rel.manutencoes_proximas_7dias || 0;
    cards[2].textContent = rel.documentos_proximos_30dias || 0;
    cards[3].textContent = 'R$ 0';
  }
}

// ─── CADASTRO: EMPRESA (local apenas) ───
document.getElementById('btnCadEmpresa').addEventListener('click', () => {
  const nome  = document.getElementById('emp-nome').value.trim();
  const cnpj  = document.getElementById('emp-cnpj').value.trim();
  const whats = document.getElementById('emp-whats').value.trim();
  const plano = document.getElementById('emp-plano').value;
  if (!nome) { showToast('Informe o nome da empresa.', 'error'); return; }
  const planoNome  = plano.includes('Profissional') ? 'Profissional' : plano.includes('Empresarial') ? 'Empresarial' : 'Starter';
  const planoBadge = planoNome === 'Starter' ? 'badge-orange' : 'badge-blue';
  const tbody = document.querySelector('#page-empresas .data-table tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><strong>${nome}</strong></td>
    <td>${cnpj || '—'}</td>
    <td><span class="${planoBadge}">${planoNome}</span></td>
    <td>0</td>
    <td>${whats || '—'}</td>
    <td><span class="status-dot green"></span> Ativo</td>
    <td><button class="btn-sm">Editar</button></td>`;
  tbody.appendChild(tr);
  ['emp-nome','emp-cnpj','emp-whats'].forEach(id => document.getElementById(id).value = '');
  closeModalById('modalEmpresa');
  showToast('✅ Empresa cadastrada!');
});

// ─── CADASTRO: VEÍCULO → API ───
document.getElementById('btnCadVeiculo').addEventListener('click', async () => {
  const placa  = document.getElementById('vei-placa').value.trim().toUpperCase();
  const modelo = document.getElementById('vei-modelo').value.trim();
  const ano    = document.getElementById('vei-ano') ? document.getElementById('vei-ano').value : null;
  if (!placa) { showToast('Informe a placa do veículo.', 'error'); return; }
  const btn = document.getElementById('btnCadVeiculo');
  btn.disabled = true; btn.textContent = 'Salvando…';
  const res = await apiFetch('/api/veiculos', {
    method: 'POST',
    body: JSON.stringify({ placa, modelo, ano: ano ? parseInt(ano) : null })
  });
  btn.disabled = false; btn.textContent = 'Cadastrar Veículo';
  if (!res || res.erro) { showToast('Erro ao cadastrar veículo.', 'error'); return; }
  ['vei-placa','vei-modelo'].forEach(id => document.getElementById(id).value = '');
  closeModalById('modalVeiculo');
  showToast('✅ Veículo cadastrado com sucesso!');
  await carregarVeiculos();
});

// ─── CADASTRO: MOTORISTA → API ───
document.getElementById('btnCadMotorista').addEventListener('click', async () => {
  const nome        = document.getElementById('mot-nome').value.trim();
  const whats       = document.getElementById('mot-whats').value.trim();
  const veiculoPlaca = document.getElementById('mot-veiculo').value.split(' — ')[0];
  if (!nome)  { showToast('Informe o nome do motorista.', 'error'); return; }
  if (!whats) { showToast('Informe o WhatsApp do motorista.', 'error'); return; }
  const btn = document.getElementById('btnCadMotorista');
  btn.disabled = true; btn.textContent = 'Salvando…';
  const res = await apiFetch('/api/motoristas', {
    method: 'POST',
    body: JSON.stringify({ nome, whatsapp: whats, veiculo_placa: veiculoPlaca || null })
  });
  btn.disabled = false; btn.textContent = 'Cadastrar Motorista';
  if (!res || res.erro) { showToast('Erro ao cadastrar motorista.', 'error'); return; }
  ['mot-nome','mot-whats','mot-cnh','mot-toxi'].forEach(id => document.getElementById(id).value = '');
  closeModalById('modalMotorista');
  showToast('✅ Motorista cadastrado! Ele já pode receber checklists pelo WhatsApp.');
  await carregarMotoristas();
});

// ─── CADASTRO: MANUTENÇÃO → API ───
document.getElementById('btnCadManutencao').addEventListener('click', async () => {
  const veiculo = document.getElementById('man-veiculo').value.split(' — ')[0];
  const tipo    = document.getElementById('man-tipo').value;
  const data    = document.getElementById('man-data').value;
  if (!data) { showToast('Informe a data de vencimento.', 'error'); return; }
  const btn = document.getElementById('btnCadManutencao');
  btn.disabled = true; btn.textContent = 'Salvando…';
  const res = await apiFetch('/api/manutencoes', {
    method: 'POST',
    body: JSON.stringify({ veiculo_placa: veiculo, tipo, vencimento: data })
  });
  btn.disabled = false; btn.textContent = 'Cadastrar';
  if (!res || res.erro) { showToast(res?.erro || 'Erro ao cadastrar manutenção.', 'error'); return; }
  document.getElementById('man-data').value = '';
  closeModalById('modalManutencao');
  showToast('✅ Manutenção cadastrada com sucesso!');
  await carregarManutencoes();
});

// ─── CADASTRO: DOCUMENTO → API ───
document.getElementById('btnCadDocumento').addEventListener('click', async () => {
  const tipo = document.getElementById('doc-tipo').value;
  const ref  = document.getElementById('doc-ref').value.trim();
  const venc = document.getElementById('doc-venc').value;
  if (!ref)  { showToast('Informe o referente (veículo ou motorista).', 'error'); return; }
  if (!venc) { showToast('Informe a data de vencimento.', 'error'); return; }
  const btn = document.getElementById('btnCadDocumento');
  btn.disabled = true; btn.textContent = 'Salvando…';
  const res = await apiFetch('/api/documentos', {
    method: 'POST',
    body: JSON.stringify({ tipo, referencia: ref, vencimento: venc })
  });
  btn.disabled = false; btn.textContent = 'Cadastrar';
  if (!res || res.erro) { showToast('Erro ao cadastrar documento.', 'error'); return; }
  ['doc-ref','doc-venc'].forEach(id => document.getElementById(id).value = '');
  closeModalById('modalDocumento');
  showToast('✅ Documento cadastrado com sucesso!');
  await carregarDocumentos();
});

// ─── CONFIGURAÇÕES ───
async function carregarConfiguracoes() {
  const cfg = await apiFetch('/api/config');
  if (!cfg) return;
  if (cfg.whatsapp_gestor) document.getElementById('cfg-gestor').value = cfg.whatsapp_gestor;
  if (cfg.horario_checklist) document.getElementById('cfg-horario').value = cfg.horario_checklist;
  if (cfg.perguntas_checklist) document.getElementById('cfg-perguntas').value = cfg.perguntas_checklist;
}

document.getElementById('btnSalvarConfig').addEventListener('click', async () => {
  const gestor   = document.getElementById('cfg-gestor').value.trim();
  const horario  = document.getElementById('cfg-horario').value;
  const perguntas = document.getElementById('cfg-perguntas').value.trim();
  const btn = document.getElementById('btnSalvarConfig');
  btn.disabled = true; btn.textContent = 'Salvando…';
  const res = await apiFetch('/api/config', {
    method: 'POST',
    body: JSON.stringify({
      whatsapp_gestor: gestor,
      horario_checklist: horario,
      perguntas_checklist: perguntas
    })
  });
  btn.disabled = false; btn.textContent = '💾 Salvar Configurações';
  if (!res || res.status !== 'ok') { showToast('Erro ao salvar.', 'error'); return; }
  const status = document.getElementById('cfg-status');
  status.style.display = 'block';
  setTimeout(() => status.style.display = 'none', 3000);
  showToast('✅ Configurações salvas! Bot atualizado.');
});
