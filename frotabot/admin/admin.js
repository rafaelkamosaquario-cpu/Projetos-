// ─── USUÁRIOS (simulação — futuramente vem do banco de dados) ───
const usuarios = {
  'rafael@frotabot.com.br': {
    senha: 'admin123',
    perfil: 'admin',
    nome: 'Rafael',
    empresa: null
  },
  'silva@transportadora.com': {
    senha: 'silva123',
    perfil: 'cliente',
    nome: 'Carlos Silva',
    empresa: 'Transportadora Silva'
  },
  'frota@frotarapida.com': {
    senha: 'frota123',
    perfil: 'cliente',
    nome: 'Marcos Lima',
    empresa: 'Frota Rápida Ltda'
  }
};

// ─── LOGIN ───
let usuarioLogado = null;

document.getElementById('formLogin').addEventListener('submit', e => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const senha = document.getElementById('loginSenha').value.trim();
  const erro  = document.getElementById('loginErro');

  const user = usuarios[email];
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

  // Atualiza nome do usuário no sidebar
  document.getElementById('nomeUsuario').textContent = usuarioLogado.nome;
  document.getElementById('perfilUsuario').textContent =
    usuarioLogado.perfil === 'admin' ? 'Administrador' : 'Gestor de Frota';
  document.getElementById('avatarUsuario').textContent =
    usuarioLogado.nome.charAt(0).toUpperCase();

  aplicarPerfil();
}

function aplicarPerfil() {
  if (usuarioLogado.perfil === 'cliente') {
    // Oculta menu Empresas para cliente
    document.querySelectorAll('[data-page="empresas"]').forEach(el => el.style.display = 'none');

    // Filtra dados pela empresa do cliente
    filtrarDadosCliente(usuarioLogado.empresa);

    // Ajusta dashboard para mostrar nome da empresa
    const titulo = document.querySelector('#page-dashboard .dash-titulo');
    if (titulo) titulo.textContent = usuarioLogado.empresa;
  }
}

function filtrarDadosCliente(empresa) {
  // Filtra tabelas — oculta linhas de outras empresas
  document.querySelectorAll('.data-table tbody tr').forEach(row => {
    const cells = row.querySelectorAll('td');
    let pertence = false;
    cells.forEach(cell => {
      if (cell.textContent.includes(empresa)) pertence = true;
    });
    if (!pertence) row.style.display = 'none';
  });

  // Filtra cards do checklist
  document.querySelectorAll('.ck-company').forEach(card => {
    if (!card.textContent.includes(empresa)) card.style.display = 'none';
  });

  // Filtra alertas
  document.querySelectorAll('.alert-item').forEach(item => {
    if (!item.textContent.includes(empresa)) item.style.display = 'none';
  });

  // Filtra kanban
  document.querySelectorAll('.kanban-card').forEach(card => {
    // Cards do kanban não têm empresa direta — mantém todos visíveis
  });

  // Atualiza métricas do dashboard para cliente
  document.querySelector('#page-dashboard .metric-value:nth-of-type(1)');
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
  dashboard:  'Dashboard',
  empresas:   'Empresas',
  veiculos:   'Veículos',
  motoristas: 'Motoristas',
  manutencao: 'Manutenção',
  documentos: 'Documentos',
  checklists: 'Checklists',
  alertas:    'Alertas',
  relatorios: 'Relatórios'
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
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('open');
    }
  });
});

document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ─── BOTÃO + NOVO ───
document.getElementById('btnAdd').addEventListener('click', () => {
  const activePage = document.querySelector('.nav-item.active').dataset.page;
  const modalMap = {
    empresas:   'modalEmpresa',
    veiculos:   'modalVeiculo',
    motoristas: 'modalMotorista',
    manutencao: 'modalManutencao',
    documentos: 'modalDocumento'
  };
  if (modalMap[activePage]) openModal(modalMap[activePage]);
});

// ─── MODALS ───
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(event, id) {
  if (event.target === document.getElementById(id))
    document.getElementById(id).classList.remove('open');
}
function closeModalById(id) {
  document.getElementById(id).classList.remove('open');
}
