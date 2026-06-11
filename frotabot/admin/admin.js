// ─── USUÁRIOS ───
const usuarios = {
  'rafael@frotabot.com.br': { senha: 'admin123', perfil: 'admin', nome: 'Rafael', empresa: null },
  'silva@transportadora.com': { senha: 'silva123', perfil: 'cliente', nome: 'Carlos Silva', empresa: 'Transportadora Silva' },
  'frota@frotarapida.com': { senha: 'frota123', perfil: 'cliente', nome: 'Marcos Lima', empresa: 'Frota Rápida Ltda' }
};

let usuarioLogado = null;

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

function iniciarPainel() {
  document.getElementById('telaLogin').style.display = 'none';
  document.getElementById('painelPrincipal').style.display = 'flex';
  document.getElementById('nomeUsuario').textContent = usuarioLogado.nome;
  document.getElementById('perfilUsuario').textContent =
    usuarioLogado.perfil === 'admin' ? 'Administrador' : 'Gestor de Frota';
  document.getElementById('avatarUsuario').textContent =
    usuarioLogado.nome.charAt(0).toUpperCase();
  aplicarPerfil();
}

function aplicarPerfil() {
  if (usuarioLogado.perfil === 'cliente') {
    document.querySelectorAll('[data-page="empresas"]').forEach(el => el.style.display = 'none');
    filtrarDadosCliente(usuarioLogado.empresa);
  }
}

function filtrarDadosCliente(empresa) {
  document.querySelectorAll('.data-table tbody tr').forEach(row => {
    let pertence = false;
    row.querySelectorAll('td').forEach(cell => {
      if (cell.textContent.includes(empresa)) pertence = true;
    });
    if (!pertence) row.style.display = 'none';
  });
  document.querySelectorAll('.ck-company').forEach(card => {
    if (!card.textContent.includes(empresa)) card.style.display = 'none';
  });
  document.querySelectorAll('.alert-item').forEach(item => {
    if (!item.textContent.includes(empresa)) item.style.display = 'none';
  });
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
  checklists: 'Checklists', alertas: 'Alertas', relatorios: 'Relatórios'
};

navItems.forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const page = item.dataset.page;
    navItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    pageTitle.textContent = titles[page];
    if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('open');
  });
});

document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ─── BOTÃO + NOVO ───
document.getElementById('btnAdd').addEventListener('click', () => {
  const activePage = document.querySelector('.nav-item.active').dataset.page;
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

// ─── CADASTRO: EMPRESA ───
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
  showToast('✅ Empresa cadastrada com sucesso!');
});

// ─── CADASTRO: VEÍCULO ───
document.getElementById('btnCadVeiculo').addEventListener('click', () => {
  const placa     = document.getElementById('vei-placa').value.trim().toUpperCase();
  const modelo    = document.getElementById('vei-modelo').value.trim();
  const empresa   = document.getElementById('vei-empresa').value;
  const revisao   = document.getElementById('vei-revisao').value;
  const tacografo = document.getElementById('vei-tacografo').value;
  if (!placa) { showToast('Informe a placa do veículo.', 'error'); return; }
  const dTac   = diasRestantes(tacografo);
  const clsTac = dTac.dias <= 0 ? 'date-alert' : dTac.dias <= 15 ? 'date-warn' : 'date-ok';
  const tbody  = document.querySelector('#page-veiculos .data-table tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><strong>${placa}</strong></td>
    <td>${modelo || '—'}</td>
    <td>${empresa}</td>
    <td><span class="date-ok">${fmtData(revisao)}</span></td>
    <td><span class="${clsTac}">${fmtData(tacografo)}</span></td>
    <td><span class="status-dot green"></span> OK</td>
    <td><button class="btn-sm">Ver</button></td>`;
  tbody.appendChild(tr);
  ['vei-placa','vei-modelo','vei-revisao','vei-tacografo','vei-oleo'].forEach(id => document.getElementById(id).value = '');
  closeModalById('modalVeiculo');
  showToast('✅ Veículo cadastrado com sucesso!');
});

// ─── CADASTRO: MOTORISTA ───
document.getElementById('btnCadMotorista').addEventListener('click', () => {
  const nome    = document.getElementById('mot-nome').value.trim();
  const whats   = document.getElementById('mot-whats').value.trim();
  const empresa = document.getElementById('mot-empresa').value;
  const veiculo = document.getElementById('mot-veiculo').value;
  const cnh     = document.getElementById('mot-cnh').value;
  const toxi    = document.getElementById('mot-toxi').value;
  if (!nome) { showToast('Informe o nome do motorista.', 'error'); return; }
  const dCnh  = diasRestantes(cnh);
  const dToxi = diasRestantes(toxi);
  const clsCnh  = dCnh.dias  <= 0 ? 'date-alert' : dCnh.dias  <= 30 ? 'date-warn' : 'date-ok';
  const clsToxi = dToxi.dias <= 0 ? 'date-alert' : dToxi.dias <= 30 ? 'date-warn' : 'date-ok';
  const tbody = document.querySelector('#page-motoristas .data-table tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><strong>${nome}</strong></td>
    <td>${whats || '—'}</td>
    <td>${empresa}</td>
    <td>${veiculo.split(' — ')[0]}</td>
    <td><span class="${clsCnh}">${fmtData(cnh)}</span></td>
    <td><span class="${clsToxi}">${fmtData(toxi)}</span></td>
    <td><span class="badge-orange">⚠️ Não enviado</span></td>`;
  tbody.appendChild(tr);
  ['mot-nome','mot-whats','mot-cnh','mot-toxi'].forEach(id => document.getElementById(id).value = '');
  closeModalById('modalMotorista');
  showToast('✅ Motorista cadastrado com sucesso!');
});

// ─── CADASTRO: MANUTENÇÃO ───
document.getElementById('btnCadManutencao').addEventListener('click', () => {
  const veiculo = document.getElementById('man-veiculo').value;
  const tipo    = document.getElementById('man-tipo').value;
  const data    = document.getElementById('man-data').value;
  if (!data) { showToast('Informe a data de vencimento.', 'error'); return; }
  const d = diasRestantes(data);
  const dotCls    = d.dias <= 3 ? 'orange' : d.dias <= 7 ? 'yellow' : 'green';
  const statusTxt = d.dias <= 3 ? 'Urgente' : d.dias <= 7 ? 'Agendado' : 'Programado';
  const tbody = document.querySelector('#page-manutencao .data-table tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><strong>${veiculo.split(' — ')[0]}</strong></td>
    <td>—</td>
    <td>${tipo}</td>
    <td>${fmtData(data)}</td>
    <td><span class="${d.cls}">${d.txt}</span></td>
    <td><span class="status-dot ${dotCls}"></span> ${statusTxt}</td>
    <td>❌ Não</td>`;
  tbody.appendChild(tr);
  document.getElementById('man-data').value = '';
  closeModalById('modalManutencao');
  showToast('✅ Manutenção cadastrada com sucesso!');
});

// ─── CADASTRO: DOCUMENTO ───
document.getElementById('btnCadDocumento').addEventListener('click', () => {
  const tipo    = document.getElementById('doc-tipo').value;
  const ref     = document.getElementById('doc-ref').value.trim();
  const empresa = document.getElementById('doc-empresa').value;
  const venc    = document.getElementById('doc-venc').value;
  if (!ref) { showToast('Informe o referente (veículo ou motorista).', 'error'); return; }
  const d = diasRestantes(venc);
  const dotCls    = d.dias <= 0 ? 'red' : d.dias <= 7 ? 'orange' : d.dias <= 15 ? 'yellow' : 'green';
  const statusTxt = d.dias <= 0 ? 'Vencido' : d.dias <= 7 ? 'Urgente' : d.dias <= 15 ? 'Atenção' : 'Regular';
  const tbody = document.querySelector('#page-documentos .data-table tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${tipo}</td>
    <td>${ref}</td>
    <td>${empresa}</td>
    <td>${fmtData(venc)}</td>
    <td><span class="${d.cls}">${d.txt}</span></td>
    <td><span class="status-dot ${dotCls}"></span> ${statusTxt}</td>`;
  tbody.appendChild(tr);
  ['doc-ref','doc-venc'].forEach(id => document.getElementById(id).value = '');
  closeModalById('modalDocumento');
  showToast('✅ Documento cadastrado com sucesso!');
});
