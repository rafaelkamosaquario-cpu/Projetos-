// Navegação entre páginas
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const pageTitle = document.getElementById('pageTitle');

const titles = {
  dashboard: 'Dashboard',
  empresas: 'Empresas',
  veiculos: 'Veículos',
  motoristas: 'Motoristas',
  manutencao: 'Manutenção',
  documentos: 'Documentos',
  checklists: 'Checklists',
  alertas: 'Alertas',
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

// Toggle sidebar mobile
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// Botão "+ Novo" abre modal baseado na página ativa
document.getElementById('btnAdd').addEventListener('click', () => {
  const activePage = document.querySelector('.nav-item.active').dataset.page;
  const modalMap = {
    empresas: 'modalEmpresa',
    veiculos: 'modalVeiculo',
    motoristas: 'modalMotorista',
    manutencao: 'modalManutencao',
    documentos: 'modalDocumento'
  };
  if (modalMap[activePage]) openModal(modalMap[activePage]);
});

// Modals
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(event, id) {
  if (event.target === document.getElementById(id)) {
    document.getElementById(id).classList.remove('open');
  }
}

function closeModalById(id) {
  document.getElementById(id).classList.remove('open');
}
