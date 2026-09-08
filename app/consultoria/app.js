(function () {
  'use strict';

  var model = window.RodoCoreConsultingModel;
  var pdf = window.RodoCoreConsultingPdf;
  var config = window.RODOCORE_CONFIG || {};
  var state = {
    client: null,
    user: null,
    profile: null,
    companies: [],
    contacts: [],
    diagnostics: [],
    projects: [],
    companyId: '',
    diagnostic: null,
    answers: {},
    pillarIndex: 0,
    authMode: 'login',
    saveTimer: null,
    toastTimer: null,
    loadingUserId: ''
  };

  var elements = {
    boot: document.getElementById('boot-screen'),
    auth: document.getElementById('auth-screen'),
    workspace: document.getElementById('workspace'),
    authForm: document.getElementById('auth-form'),
    authMessage: document.getElementById('auth-message'),
    authSubmit: document.getElementById('auth-submit'),
    displayNameField: document.getElementById('display-name-field'),
    authPassword: document.getElementById('auth-password'),
    sidebar: document.querySelector('.sidebar'),
    menuButton: document.getElementById('menu-button'),
    syncBanner: document.getElementById('sync-banner'),
    companySelector: document.getElementById('company-selector'),
    companyForm: document.getElementById('company-form'),
    companyMessage: document.getElementById('company-message'),
    diagnosticForm: document.getElementById('diagnostic-form'),
    diagnosticMessage: document.getElementById('diagnostic-message'),
    questionList: document.getElementById('question-list'),
    generalNotes: document.getElementById('general-notes'),
    saveIndicator: document.querySelector('.save-indicator'),
    saveStatus: document.getElementById('save-status'),
    toast: document.getElementById('toast')
  };

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function cleanText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function friendlyError(error) {
    var message = error && error.message ? error.message : '';
    if (/invalid login credentials/i.test(message)) return 'E-mail ou senha inválidos.';
    if (/email not confirmed/i.test(message)) return 'Confirme o e-mail antes de entrar.';
    if (/already registered|already been registered/i.test(message)) return 'Este e-mail já possui acesso.';
    if (/password/i.test(message) && /least|short|characters/i.test(message)) return 'A senha deve ter pelo menos 8 caracteres.';
    if (/relation .* does not exist|schema cache/i.test(message)) return 'A estrutura privada da Fase 2 ainda não foi aplicada no Supabase.';
    if (/row-level security|permission denied|42501/i.test(message)) return 'A operação foi bloqueada pelas regras de segurança. Atualize a sessão e tente novamente.';
    if (/failed to fetch|network/i.test(message)) return 'Não foi possível conectar ao Supabase. Verifique a internet e tente novamente.';
    return 'Não foi possível concluir a operação. Tente novamente.';
  }

  function formatDate(value, withTime) {
    if (!value) return 'Sem data';
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sem data';
    return new Intl.DateTimeFormat('pt-BR', withTime ? {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    } : {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(date);
  }

  function initials(name) {
    return cleanText(name).split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) {
      return part.charAt(0).toUpperCase();
    }).join('') || 'RC';
  }

  function companyById(id) {
    return state.companies.find(function (company) { return company.id === id; }) || null;
  }

  function contactForCompany(id) {
    return state.contacts.find(function (contact) {
      return contact.company_id === id && contact.is_primary;
    }) || state.contacts.find(function (contact) { return contact.company_id === id; }) || null;
  }

  function updateDiagnosticInState(diagnostic) {
    state.diagnostics = state.diagnostics.filter(function (entry) { return entry.id !== diagnostic.id; });
    state.diagnostics.unshift(diagnostic);
  }

  function showToast(message) {
    clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    state.toastTimer = setTimeout(function () { elements.toast.hidden = true; }, 3800);
  }

  function showSyncError(message) {
    elements.syncBanner.textContent = message;
    elements.syncBanner.hidden = !message;
  }

  function showAuth() {
    elements.boot.hidden = true;
    elements.workspace.hidden = true;
    elements.auth.hidden = false;
  }

  function showWorkspace() {
    elements.boot.hidden = true;
    elements.auth.hidden = true;
    elements.workspace.hidden = false;
  }

  function showView(name) {
    var target = name;
    if (target === 'diagnostic' && !state.diagnostic) target = 'dashboard';
    document.querySelectorAll('.app-view').forEach(function (view) {
      var active = view.id === target + '-view';
      view.hidden = !active;
      view.classList.toggle('active', active);
    });
    document.querySelectorAll('.nav-item').forEach(function (item) {
      var itemView = item.dataset.view;
      var active = itemView === target || (target === 'result' && itemView === 'diagnostic');
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    elements.sidebar.classList.remove('open');
    elements.menuButton.setAttribute('aria-expanded', 'false');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    var signup = mode === 'signup';
    document.getElementById('login-mode').classList.toggle('active', !signup);
    document.getElementById('signup-mode').classList.toggle('active', signup);
    document.getElementById('login-mode').setAttribute('aria-pressed', String(!signup));
    document.getElementById('signup-mode').setAttribute('aria-pressed', String(signup));
    elements.displayNameField.hidden = !signup;
    document.getElementById('display-name').required = signup;
    elements.authPassword.autocomplete = signup ? 'new-password' : 'current-password';
    document.getElementById('auth-title').textContent = signup ? 'Criar acesso do consultor' : 'Entrar na área privada';
    document.getElementById('auth-subtitle').textContent = signup ? 'Use um e-mail profissional e uma senha exclusiva.' : 'Use o acesso do consultor responsável.';
    elements.authSubmit.textContent = signup ? 'Criar acesso com segurança' : 'Entrar com segurança';
    elements.authMessage.textContent = '';
    elements.authMessage.classList.remove('success');
  }

  function setBusy(button, busy, busyLabel) {
    if (!button) return;
    if (busy) {
      button.dataset.originalLabel = button.textContent;
      button.textContent = busyLabel || 'Salvando…';
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalLabel || button.textContent;
      button.disabled = false;
      delete button.dataset.originalLabel;
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    elements.authMessage.textContent = '';
    elements.authMessage.classList.remove('success');
    if (!elements.authForm.reportValidity()) return;

    var data = new FormData(elements.authForm);
    var email = cleanText(data.get('email')).toLowerCase();
    var password = String(data.get('password') || '');
    setBusy(elements.authSubmit, true, state.authMode === 'signup' ? 'Criando acesso…' : 'Entrando…');

    try {
      if (state.authMode === 'signup') {
        var signupResult = await state.client.auth.signUp({
          email: email,
          password: password,
          options: {
            data: { display_name: cleanText(data.get('display_name')) },
            emailRedirectTo: window.location.href.split('#')[0]
          }
        });
        if (signupResult.error) throw signupResult.error;
        if (!signupResult.data.session) {
          elements.authMessage.textContent = 'Acesso criado. Confirme o e-mail e depois entre nesta página.';
          elements.authMessage.classList.add('success');
          elements.authForm.reset();
        }
      } else {
        var loginResult = await state.client.auth.signInWithPassword({ email: email, password: password });
        if (loginResult.error) throw loginResult.error;
      }
    } catch (error) {
      elements.authMessage.textContent = friendlyError(error);
    } finally {
      setBusy(elements.authSubmit, false);
    }
  }

  async function fetchPrivateData() {
    var results = await Promise.all([
      state.client.from('profiles').select('*').eq('id', state.user.id).maybeSingle(),
      state.client.from('companies').select('*').order('updated_at', { ascending: false }),
      state.client.from('company_contacts').select('*').order('is_primary', { ascending: false }),
      state.client.from('executive_diagnostics').select('*').order('updated_at', { ascending: false }),
      state.client.from('consulting_projects').select('*').order('updated_at', { ascending: false })
    ]);
    var failed = results.find(function (result) { return result.error; });
    if (failed) throw failed.error;
    state.profile = results[0].data;
    state.companies = results[1].data || [];
    state.contacts = results[2].data || [];
    state.diagnostics = results[3].data || [];
    state.projects = results[4].data || [];
    if (!companyById(state.companyId)) state.companyId = state.companies[0] ? state.companies[0].id : '';
  }

  async function handleSession(session) {
    if (!session || !session.user) {
      state.user = null;
      state.loadingUserId = '';
      showAuth();
      return;
    }
    if (state.loadingUserId === session.user.id && !elements.workspace.hidden) return;
    state.loadingUserId = session.user.id;
    state.user = session.user;
    showWorkspace();
    showSyncError('');
    try {
      await fetchPrivateData();
      renderWorkspace();
      showView('dashboard');
    } catch (error) {
      state.companies = [];
      state.contacts = [];
      state.diagnostics = [];
      state.projects = [];
      renderWorkspace();
      showSyncError(friendlyError(error));
    }
  }

  function renderWorkspace() {
    var displayName = state.profile && state.profile.display_name ||
      state.user.user_metadata && state.user.user_metadata.display_name || 'Consultor';
    document.getElementById('user-name').textContent = displayName;
    document.getElementById('user-email').textContent = state.user.email || '';
    document.getElementById('user-initials').textContent = initials(displayName);
    renderCompanySelector();
    renderDashboard();
    renderProjects();
  }

  function renderCompanySelector() {
    elements.companySelector.innerHTML = state.companies.length ? state.companies.map(function (company) {
      return '<option value="' + escapeHtml(company.id) + '">' + escapeHtml(company.trade_name || company.legal_name) + '</option>';
    }).join('') : '<option value="">Cadastre uma empresa</option>';
    elements.companySelector.value = state.companyId;
  }

  function renderDashboard() {
    document.getElementById('metric-companies').textContent = String(state.companies.length);
    document.getElementById('metric-drafts').textContent = String(state.diagnostics.filter(function (entry) { return entry.status === 'draft'; }).length);
    document.getElementById('metric-completed').textContent = String(state.diagnostics.filter(function (entry) { return entry.status === 'completed'; }).length);
    document.getElementById('metric-projects').textContent = String(state.projects.length);
    var list = document.getElementById('diagnostic-list');
    var records = state.diagnostics.slice(0, 6);
    if (!records.length) {
      list.innerHTML = '<div class="empty-state"><strong>Nenhum diagnóstico ainda.</strong><span>Cadastre uma empresa e inicie a primeira avaliação.</span></div>';
      return;
    }
    list.innerHTML = records.map(function (entry) {
      var company = companyById(entry.company_id);
      var status = entry.status === 'completed' ? 'Concluído' : 'Rascunho';
      var action = entry.status === 'completed' ? 'Ver conclusão' : 'Continuar';
      return '<article class="record-card"><div><span class="badge ' + escapeHtml(entry.status) + '">' + status + '</span><h3>' +
        escapeHtml(company && (company.trade_name || company.legal_name) || 'Empresa') +
        '</h3><div class="record-meta"><span>' + escapeHtml(entry.title) + '</span><span>Atualizado ' + formatDate(entry.updated_at, true) +
        '</span></div></div><button class="button button-secondary" type="button" data-open-diagnostic="' + escapeHtml(entry.id) + '">' + action + '</button></article>';
    }).join('');
  }

  function renderProjects() {
    var list = document.getElementById('project-list');
    if (!state.projects.length) {
      list.innerHTML = '<div class="panel empty-state"><strong>Nenhum projeto aberto.</strong><span>Conclua um diagnóstico e use “Criar projeto”.</span></div>';
      return;
    }
    list.innerHTML = state.projects.map(function (project) {
      var company = companyById(project.company_id);
      return '<article class="project-card"><span class="badge">' + escapeHtml(project.status === 'planning' ? 'Planejamento' : project.status) +
        '</span><h2>' + escapeHtml(project.name) + '</h2><p>' + escapeHtml(company && (company.trade_name || company.legal_name) || 'Empresa') +
        '</p><div class="record-meta"><span>Aberto em ' + formatDate(project.created_at) + '</span><span>Origem: ' +
        (project.source_diagnostic_id ? 'diagnóstico' : 'manual') + '</span></div></article>';
    }).join('');
  }

  function openCompanyForm(company) {
    var selected = company || null;
    var contact = selected ? contactForCompany(selected.id) : null;
    elements.companyForm.reset();
    document.getElementById('company-id').value = selected ? selected.id : '';
    document.getElementById('legal-name').value = selected ? selected.legal_name || '' : '';
    document.getElementById('trade-name').value = selected ? selected.trade_name || '' : '';
    document.getElementById('registration-number').value = selected ? selected.registration_number || '' : '';
    document.getElementById('fleet-size').value = selected ? selected.fleet_size || '' : '';
    document.getElementById('company-notes').value = selected ? selected.notes || '' : '';
    document.getElementById('contact-name').value = contact ? contact.full_name || '' : '';
    document.getElementById('contact-title').value = contact ? contact.job_title || '' : '';
    document.getElementById('contact-email').value = contact ? contact.email || '' : '';
    document.getElementById('contact-phone').value = contact ? contact.phone || '' : '';
    elements.companyMessage.textContent = '';
    showView('company');
  }

  async function handleCompanySubmit(event) {
    event.preventDefault();
    elements.companyMessage.textContent = '';
    if (!elements.companyForm.reportValidity()) return;
    var button = document.getElementById('save-company-button');
    var data = new FormData(elements.companyForm);
    var companyId = cleanText(data.get('company_id'));
    var companyPayload = {
      legal_name: cleanText(data.get('legal_name')),
      trade_name: cleanText(data.get('trade_name')) || null,
      registration_number: cleanText(data.get('registration_number')) || null,
      fleet_size: data.get('fleet_size') ? Number(data.get('fleet_size')) : null,
      notes: cleanText(data.get('notes')) || null
    };
    setBusy(button, true, 'Salvando…');
    try {
      var companyResult;
      if (companyId) {
        companyResult = await state.client.from('companies').update(companyPayload).eq('id', companyId).select().single();
      } else {
        companyPayload.owner_id = state.user.id;
        companyResult = await state.client.from('companies').insert(companyPayload).select().single();
      }
      if (companyResult.error) throw companyResult.error;
      companyId = companyResult.data.id;
      var existingContact = contactForCompany(companyId);
      var contactPayload = {
        company_id: companyId,
        full_name: cleanText(data.get('contact_name')),
        job_title: cleanText(data.get('contact_title')) || null,
        email: cleanText(data.get('contact_email')) || null,
        phone: cleanText(data.get('contact_phone')) || null,
        is_primary: true
      };
      var contactResult;
      if (existingContact) {
        contactResult = await state.client.from('company_contacts').update(contactPayload).eq('id', existingContact.id).select().single();
      } else {
        contactPayload.owner_id = state.user.id;
        contactResult = await state.client.from('company_contacts').insert(contactPayload).select().single();
      }
      if (contactResult.error) throw contactResult.error;
      state.companyId = companyId;
      await fetchPrivateData();
      renderWorkspace();
      showView('dashboard');
      showToast('Empresa e responsável salvos.');
    } catch (error) {
      elements.companyMessage.textContent = friendlyError(error);
    } finally {
      setBusy(button, false);
    }
  }

  async function createDiagnostic() {
    if (!state.companyId) {
      openCompanyForm(null);
      elements.companyMessage.textContent = 'Cadastre a empresa antes de iniciar o diagnóstico.';
      return;
    }
    var company = companyById(state.companyId);
    var button = document.getElementById('new-diagnostic-button');
    setBusy(button, true, 'Criando…');
    try {
      var result = await state.client.from('executive_diagnostics').insert({
        owner_id: state.user.id,
        company_id: state.companyId,
        title: 'Diagnóstico Executivo — ' + (company.trade_name || company.legal_name),
        status: 'draft',
        current_step: 0
      }).select().single();
      if (result.error) throw result.error;
      state.diagnostic = result.data;
      updateDiagnosticInState(result.data);
      state.answers = {};
      state.pillarIndex = 0;
      renderDiagnostic();
      showView('diagnostic');
    } catch (error) {
      showSyncError(friendlyError(error));
    } finally {
      setBusy(button, false);
    }
  }

  async function openDiagnostic(id) {
    var diagnostic = state.diagnostics.find(function (entry) { return entry.id === id; });
    if (!diagnostic) return;
    showSyncError('');
    try {
      var result = await state.client.from('diagnostic_answers').select('*').eq('diagnostic_id', id);
      if (result.error) throw result.error;
      state.diagnostic = diagnostic;
      state.companyId = diagnostic.company_id;
      state.answers = {};
      (result.data || []).forEach(function (row) {
        state.answers[row.question_key] = {
          classification: row.classification,
          notes: row.notes || '',
          details: model.normalizeQuestionDetails(
            row.question_key,
            row.answer_payload && row.answer_payload.details
          )
        };
      });
      state.pillarIndex = Math.min(3, Math.max(0, diagnostic.current_step || 0));
      if (diagnostic.status === 'completed') {
        renderResult(diagnostic);
        showView('result');
      } else {
        renderCompanySelector();
        renderDiagnostic();
        showView('diagnostic');
      }
    } catch (error) {
      showSyncError(friendlyError(error));
    }
  }

  function renderPillarTabs() {
    var tabs = document.getElementById('pillar-tabs');
    tabs.innerHTML = model.PILLARS.map(function (pillar, index) {
      var visible = model.visibleQuestions(state.answers, pillar.key);
      var complete = visible.every(function (question) {
        return Boolean(model.CLASSIFICATIONS[state.answers[question.key] && state.answers[question.key].classification]);
      });
      return '<button class="pillar-tab' + (index === state.pillarIndex ? ' active' : '') + (complete ? ' complete' : '') +
        '" type="button" data-pillar-index="' + index + '">' + escapeHtml(pillar.name) + '</button>';
    }).join('');
  }

  function formatDetailNumber(value, maximumFractionDigits) {
    if (value === '' || value === null || value === undefined) return 'Não informado';
    var number = Number(value);
    if (!Number.isFinite(number)) return 'Não informado';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: maximumFractionDigits === undefined ? 2 : maximumFractionDigits
    }).format(number);
  }

  function formatDetailMoney(value) {
    if (value === '' || value === null || value === undefined) return 'Não informado';
    var number = Number(value);
    if (!Number.isFinite(number)) return 'Não informado';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(number);
  }

  function formatReferenceMonth(value) {
    if (!/^\d{4}-\d{2}$/.test(value || '')) return 'Não informado';
    var parts = value.split('-');
    return parts[1] + '/' + parts[0];
  }

  function detailValue(details, key) {
    return details[key] === null || details[key] === undefined ? '' : details[key];
  }

  function renderDetailNumberField(label, key, details, placeholder, step) {
    return '<div class="field"><label for="fuel-detail-' + escapeHtml(key) + '">' + escapeHtml(label) + '</label><input id="fuel-detail-' +
      escapeHtml(key) + '" type="number" min="0" max="1000000000000" step="' + escapeHtml(step || '0.01') + '" inputmode="decimal" ' +
      'data-question-detail="fuel_spend" data-detail-field="' + escapeHtml(key) + '" value="' + escapeHtml(detailValue(details, key)) +
      '" placeholder="' + escapeHtml(placeholder || '') + '"></div>';
  }

  function renderDetailChoices(group, label, options, details) {
    var selected = Array.isArray(details[group]) ? details[group] : [];
    return '<div class="detail-choice-group"><span class="detail-label">' + escapeHtml(label) + '</span><div class="detail-choice-grid">' +
      options.map(function (option) {
        return '<label class="detail-choice"><input type="checkbox" data-question-detail="fuel_spend" data-detail-group="' +
          escapeHtml(group) + '" value="' + escapeHtml(option.value) + '"' + (selected.indexOf(option.value) !== -1 ? ' checked' : '') +
          '><span>' + escapeHtml(option.label) + '</span></label>';
      }).join('') + '</div></div>';
  }

  function renderDetailScale(field, label, details) {
    var labels = { D: 'Documentado', E: 'Estimado', N: 'Não controla', NA: 'Não se aplica' };
    return '<div class="detail-status-group"><span class="detail-label">' + escapeHtml(label) + '</span><div class="detail-scale">' +
      Object.keys(labels).map(function (key) {
        return '<label><input type="radio" name="fuel-spend-' + escapeHtml(field) + '" data-question-detail="fuel_spend" data-detail-field="' +
          escapeHtml(field) + '" value="' + key + '"' + (details[field] === key ? ' checked' : '') + '><span><strong>' + key +
          '</strong>' + escapeHtml(labels[key]) + '</span></label>';
      }).join('') + '</div></div>';
  }

  function renderDetailSelect(label, field, details, options) {
    return '<div class="field"><label for="fuel-detail-' + escapeHtml(field) + '">' + escapeHtml(label) + '</label><select id="fuel-detail-' +
      escapeHtml(field) + '" data-question-detail="fuel_spend" data-detail-field="' + escapeHtml(field) + '"><option value="">Selecione</option>' +
      options.map(function (option) {
        return '<option value="' + escapeHtml(option.value) + '"' + (details[field] === option.value ? ' selected' : '') + '>' +
          escapeHtml(option.label) + '</option>';
      }).join('') + '</select></div>';
  }

  function renderPriceMetric(period, label, value) {
    return '<div class="calculated-metric"><span>' + escapeHtml(label) + '</span><strong data-calculated-price="' + escapeHtml(period) + '">' +
      (typeof value === 'number' ? formatDetailMoney(value) + '/l' : 'Preencha reais e litros') + '</strong></div>';
  }

  function renderFuelSpendDetails(current) {
    if (!model.CLASSIFICATIONS[current.classification]) {
      return '<div class="question-detail-prompt"><strong>Roteiro da visita</strong><span>Selecione D, E, N ou NA para abrir o detalhamento desta pergunta.</span></div>';
    }
    var details = current.details || {};
    var snapshot = model.fuelSpendSnapshot(details);
    var standardOptions = [
      { value: 'yes', label: 'Sim' },
      { value: 'partial', label: 'Parcialmente' },
      { value: 'no', label: 'Não' },
      { value: 'unknown', label: 'Não soube informar' }
    ];
    return '<section class="question-detail-panel" aria-label="Detalhamento do gasto e volume de combustível">' +
      '<header><span>ROTEIRO DA VISITA · PERGUNTA 01</span><h4>Gasto, volume e histórico de combustível</h4><p>Preencha somente o que o cliente conseguir informar. Os cálculos são automáticos e não alteram a classificação escolhida.</p></header>' +
      '<div class="detail-block"><div class="detail-block-title"><span>01</span><div><h5>Referência mensal</h5><p>Registre o gasto e o volume de um mês representativo.</p></div></div>' +
      '<div class="field-grid detail-grid">' +
      renderDetailNumberField('Gasto mensal (R$)', 'monthly_spend', details, 'Ex.: 200000', '0.01') +
      renderDetailNumberField('Volume mensal (litros)', 'monthly_liters', details, 'Ex.: 30000', '0.001') +
      '<div class="field"><label for="fuel-detail-reference-month">Mês e ano de referência</label><input id="fuel-detail-reference-month" type="month" data-question-detail="fuel_spend" data-detail-field="reference_month" value="' + escapeHtml(detailValue(details, 'reference_month')) + '"></div>' +
      renderPriceMetric('monthly', 'Preço médio calculado', snapshot.monthly_average_price) + '</div>' +
      renderDetailChoices('fuel_types', 'Combustíveis e produtos considerados', [
        { value: 'diesel_s10', label: 'Diesel S10' }, { value: 'diesel_s500', label: 'Diesel S500' },
        { value: 'arla32', label: 'Arla 32' }, { value: 'gasoline', label: 'Gasolina' },
        { value: 'ethanol', label: 'Etanol' }, { value: 'other', label: 'Outro' }
      ], details) + '<div class="field"><label for="fuel-detail-fuel-other">Outro combustível ou produto</label><input id="fuel-detail-fuel-other" type="text" maxlength="120" data-question-detail="fuel_spend" data-detail-field="fuel_type_other" value="' + escapeHtml(detailValue(details, 'fuel_type_other')) + '" placeholder="Informe quando necessário"></div></div>' +
      '<div class="detail-block"><div class="detail-block-title"><span>02</span><div><h5>Histórico disponível</h5><p>Compare a informação mensal com os acumulados de seis e doze meses.</p></div></div>' +
      renderDetailScale('six_month_history', 'A empresa possui histórico dos últimos 6 meses?', details) +
      '<div class="field-grid detail-grid">' + renderDetailNumberField('Gasto em 6 meses (R$)', 'six_month_spend', details, 'Total do período', '0.01') +
      renderDetailNumberField('Volume em 6 meses (litros)', 'six_month_liters', details, 'Total do período', '0.001') +
      renderPriceMetric('six_month', 'Preço médio em 6 meses', snapshot.six_month_average_price) + '</div>' +
      renderDetailScale('annual_history', 'A empresa possui histórico dos últimos 12 meses?', details) +
      '<div class="field-grid detail-grid">' + renderDetailNumberField('Gasto em 12 meses (R$)', 'annual_spend', details, 'Total do período', '0.01') +
      renderDetailNumberField('Volume em 12 meses (litros)', 'annual_liters', details, 'Total do período', '0.001') +
      renderPriceMetric('annual', 'Preço médio em 12 meses', snapshot.annual_average_price) + '</div></div>' +
      '<div class="detail-block"><div class="detail-block-title"><span>03</span><div><h5>Fonte e pagamento</h5><p>Identifique de onde vieram os números e como os fornecedores são pagos.</p></div></div>' +
      renderDetailChoices('data_sources', 'Fontes da informação', [
        { value: 'fuel_card', label: 'Cartão de combustível' }, { value: 'erp', label: 'ERP ou sistema' },
        { value: 'spreadsheet', label: 'Planilha' }, { value: 'invoices', label: 'Notas fiscais' },
        { value: 'own_tank', label: 'Controle do tanque próprio' }, { value: 'other', label: 'Outra fonte' }
      ], details) + '<div class="field"><label for="fuel-detail-source-other">Outra fonte</label><input id="fuel-detail-source-other" type="text" maxlength="240" data-question-detail="fuel_spend" data-detail-field="data_source_other" value="' + escapeHtml(detailValue(details, 'data_source_other')) + '"></div>' +
      renderDetailChoices('payment_methods', 'Formas de pagamento', [
        { value: 'fuel_card', label: 'Cartão' }, { value: 'bank_slip', label: 'Boleto ou faturado' },
        { value: 'cash', label: 'À vista' }, { value: 'pix', label: 'Pix' },
        { value: 'bank_transfer', label: 'Transferência' }, { value: 'other', label: 'Outra forma' }
      ], details) + '<div class="field-grid two-columns">' +
      '<div class="field"><label for="fuel-detail-payment-other">Outra forma de pagamento</label><input id="fuel-detail-payment-other" type="text" maxlength="240" data-question-detail="fuel_spend" data-detail-field="payment_other" value="' + escapeHtml(detailValue(details, 'payment_other')) + '"></div>' +
      renderDetailSelect('Gasto, volume e documentos estão consolidados?', 'values_consolidated', details, standardOptions) + '</div></div>' +
      '<div class="detail-block"><div class="detail-block-title"><span>04</span><div><h5>Abastecimento interno e externo</h5><p>Separe o volume do tanque próprio e dos postos externos.</p></div></div>' +
      '<div class="field-grid detail-grid">' + renderDetailSelect('Possui posto ou tanque interno?', 'internal_station', details, [
        { value: 'yes', label: 'Sim' }, { value: 'no', label: 'Não' }, { value: 'unknown', label: 'Não soube informar' }
      ]) + renderDetailNumberField('Volume interno por mês (litros)', 'internal_monthly_liters', details, 'Ex.: 20000', '0.001') +
      renderDetailNumberField('Volume externo por mês (litros)', 'external_monthly_liters', details, 'Ex.: 10000', '0.001') + '</div>' +
      '<div class="field"><label for="fuel-detail-external-stations">Postos externos utilizados</label><textarea id="fuel-detail-external-stations" rows="3" maxlength="1000" data-question-detail="fuel_spend" data-detail-field="external_stations" placeholder="Nome do posto, cidade, fornecedor ou informação de preço.">' + escapeHtml(detailValue(details, 'external_stations')) + '</textarea></div>' +
      '<div class="field-grid two-columns">' + renderDetailSelect('Os postos e fornecedores são cadastrados?', 'suppliers_registered', details, standardOptions) +
      renderDetailSelect('A empresa identifica onde o combustível está mais barato?', 'cheapest_station_tracked', details, standardOptions) + '</div></div></section>';
  }

  function updateFuelSpendCalculations() {
    var answer = state.answers.fuel_spend || {};
    var snapshot = model.fuelSpendSnapshot(answer.details || {});
    [
      ['monthly', snapshot.monthly_average_price],
      ['six_month', snapshot.six_month_average_price],
      ['annual', snapshot.annual_average_price]
    ].forEach(function (entry) {
      var element = elements.questionList.querySelector('[data-calculated-price="' + entry[0] + '"]');
      if (element) element.textContent = typeof entry[1] === 'number' ? formatDetailMoney(entry[1]) + '/l' : 'Preencha reais e litros';
    });
  }

  function formatDetailPercent(value) {
    return typeof value === 'number' ? formatDetailNumber(value, 2) + '%' : 'Não calculado';
  }

  function renderFuelVehicleNumberField(label, key, details, placeholder, step) {
    return '<div class="field"><label for="fuel-vehicle-detail-' + escapeHtml(key) + '">' + escapeHtml(label) + '</label><input id="fuel-vehicle-detail-' +
      escapeHtml(key) + '" type="number" min="0" max="1000000000000" step="' + escapeHtml(step || '1') + '" inputmode="decimal" ' +
      'data-question-detail="fuel_vehicle" data-detail-field="' + escapeHtml(key) + '" value="' + escapeHtml(detailValue(details, key)) +
      '" placeholder="' + escapeHtml(placeholder || '') + '"></div>';
  }

  function renderFuelVehicleChoices(group, label, options, details) {
    var selected = Array.isArray(details[group]) ? details[group] : [];
    return '<div class="detail-choice-group"><span class="detail-label">' + escapeHtml(label) + '</span><div class="detail-choice-grid">' +
      options.map(function (option) {
        return '<label class="detail-choice"><input type="checkbox" data-question-detail="fuel_vehicle" data-detail-group="' +
          escapeHtml(group) + '" value="' + escapeHtml(option.value) + '"' + (selected.indexOf(option.value) !== -1 ? ' checked' : '') +
          '><span>' + escapeHtml(option.label) + '</span></label>';
      }).join('') + '</div></div>';
  }

  function renderFuelVehicleScale(field, label, details) {
    var labels = { D: 'Documentado', E: 'Estimado', N: 'Não controla', NA: 'Não se aplica' };
    return '<div class="detail-status-group"><span class="detail-label">' + escapeHtml(label) + '</span><div class="detail-scale">' +
      Object.keys(labels).map(function (key) {
        return '<label><input type="radio" name="fuel-vehicle-' + escapeHtml(field) + '" data-question-detail="fuel_vehicle" data-detail-field="' +
          escapeHtml(field) + '" value="' + key + '"' + (details[field] === key ? ' checked' : '') + '><span><strong>' + key +
          '</strong>' + escapeHtml(labels[key]) + '</span></label>';
      }).join('') + '</div></div>';
  }

  function renderFuelVehicleSelect(label, field, details, options) {
    return '<div class="field"><label for="fuel-vehicle-detail-' + escapeHtml(field) + '">' + escapeHtml(label) + '</label><select id="fuel-vehicle-detail-' +
      escapeHtml(field) + '" data-question-detail="fuel_vehicle" data-detail-field="' + escapeHtml(field) + '"><option value="">Selecione</option>' +
      options.map(function (option) {
        return '<option value="' + escapeHtml(option.value) + '"' + (details[field] === option.value ? ' selected' : '') + '>' +
          escapeHtml(option.label) + '</option>';
      }).join('') + '</select></div>';
  }

  function renderFuelVehicleMetric(key, label, value) {
    return '<div class="calculated-metric"><span>' + escapeHtml(label) + '</span><strong data-fuel-vehicle-summary="' + escapeHtml(key) + '">' +
      escapeHtml(value) + '</strong></div>';
  }

  function renderVehicleInput(index, label, field, vehicle, options) {
    var config = options || {};
    var min = config.signed ? '' : ' min="0"';
    return '<div class="field"><label for="fuel-vehicle-' + index + '-' + escapeHtml(field) + '">' + escapeHtml(label) + '</label><input id="fuel-vehicle-' +
      index + '-' + escapeHtml(field) + '" type="' + escapeHtml(config.type || 'number') + '"' + min + ' max="1000000000000" step="' +
      escapeHtml(config.step || '0.001') + '" ' + (config.type === 'text' ? 'maxlength="64"' : 'inputmode="decimal"') +
      ' data-question-detail="fuel_vehicle" data-vehicle-index="' + index + '" data-vehicle-field="' + escapeHtml(field) + '" value="' +
      escapeHtml(detailValue(vehicle, field)) + '" placeholder="' + escapeHtml(config.placeholder || '') + '"></div>';
  }

  function renderVehicleSelect(index, label, field, vehicle, options) {
    return '<div class="field"><label for="fuel-vehicle-' + index + '-' + escapeHtml(field) + '">' + escapeHtml(label) + '</label><select id="fuel-vehicle-' +
      index + '-' + escapeHtml(field) + '" data-question-detail="fuel_vehicle" data-vehicle-index="' + index + '" data-vehicle-field="' +
      escapeHtml(field) + '"><option value="">Selecione</option>' + options.map(function (option) {
        return '<option value="' + escapeHtml(option.value) + '"' + (vehicle[field] === option.value ? ' selected' : '') + '>' +
          escapeHtml(option.label) + '</option>';
      }).join('') + '</select></div>';
  }

  function renderVehicleCard(vehicle, index) {
    var vehicleResult = model.fuelVehicleSnapshot({ vehicles: [vehicle] }, {}).vehicles[0] || {};
    var mileageFallback = typeof vehicle.initial_odometer === 'number' && typeof vehicle.final_odometer === 'number'
      ? 'Verifique os hodômetros' : 'Preencha KM inicial e final';
    return '<article class="vehicle-entry" data-fuel-vehicle-card="' + index + '"><header><div><span>VEÍCULO ' +
      String(index + 1).padStart(2, '0') + '</span><strong>' + escapeHtml(vehicle.identifier || 'Identificação pendente') +
      '</strong></div><button class="button button-quiet vehicle-remove" type="button" data-remove-fuel-vehicle="' + index + '">Remover</button></header>' +
      '<div class="field-grid vehicle-entry-grid">' +
      renderVehicleSelect(index, 'Tipo de identificação', 'identifier_type', vehicle, [
        { value: 'plate', label: 'Placa' }, { value: 'internal_code', label: 'Código interno' }, { value: 'fleet_number', label: 'Número de frota' }
      ]) +
      renderVehicleInput(index, 'Placa, código ou número', 'identifier', vehicle, { type: 'text', placeholder: 'Ex.: ABC-1D23 ou FROTA-018' }) +
      renderVehicleInput(index, 'Hodômetro inicial do mês', 'initial_odometer', vehicle, { step: '0.001', placeholder: 'Ex.: 250000' }) +
      renderVehicleInput(index, 'Hodômetro final do mês', 'final_odometer', vehicle, { step: '0.001', placeholder: 'Ex.: 261500' }) +
      renderVehicleInput(index, 'Ajuste de quilometragem', 'mileage_adjustment', vehicle, { step: '0.001', signed: true, placeholder: 'Ex.: 0 ou -120' }) +
      renderVehicleInput(index, 'Quantidade de abastecimentos', 'refuel_count', vehicle, { step: '1', placeholder: 'Ex.: 14' }) +
      renderVehicleInput(index, 'Litros no mês', 'liters', vehicle, { step: '0.001', placeholder: 'Ex.: 3100' }) +
      renderVehicleInput(index, 'Gasto no mês (R$)', 'spend', vehicle, { step: '0.01', placeholder: 'Ex.: 18600' }) + '</div>' +
      '<div class="vehicle-calculation-grid">' +
      '<div><span>KM rodado</span><strong data-fuel-vehicle-card-metric="mileage" data-vehicle-index="' + index + '">' +
        (typeof vehicleResult.mileage === 'number' ? escapeHtml(formatDetailNumber(vehicleResult.mileage, 3)) + ' km' : mileageFallback) + '</strong></div>' +
      '<div><span>Preço médio</span><strong data-fuel-vehicle-card-metric="average_price" data-vehicle-index="' + index + '">' +
        (typeof vehicleResult.average_price === 'number' ? escapeHtml(formatDetailMoney(vehicleResult.average_price)) + '/l' : 'Preencha gasto e litros') + '</strong></div>' +
      '<div><span>Consumo preliminar</span><strong data-fuel-vehicle-card-metric="consumption_km_l" data-vehicle-index="' + index + '">' +
        (typeof vehicleResult.consumption_km_l === 'number' ? escapeHtml(formatDetailNumber(vehicleResult.consumption_km_l, 2)) + ' km/l' : 'Não calculado') + '</strong></div>' +
      '<div><span>Custo preliminar</span><strong data-fuel-vehicle-card-metric="cost_per_km" data-vehicle-index="' + index + '">' +
        (typeof vehicleResult.cost_per_km === 'number' ? escapeHtml(formatDetailMoney(vehicleResult.cost_per_km)) + '/km' : 'Não calculado') + '</strong></div></div></article>';
  }

  function renderFuelVehicleDetails(current) {
    if (!model.CLASSIFICATIONS[current.classification]) {
      return '<div class="question-detail-prompt"><strong>Roteiro da visita</strong><span>Selecione D, E, N ou NA para abrir o detalhamento desta pergunta.</span></div>';
    }
    var details = current.details || {};
    var fuelSpendDetails = state.answers.fuel_spend && state.answers.fuel_spend.details || {};
    var snapshot = model.fuelVehicleSnapshot(details, fuelSpendDetails);
    var vehicles = Array.isArray(details.vehicles) ? details.vehicles : [];
    var standardOptions = [
      { value: 'yes', label: 'Sim' }, { value: 'partial', label: 'Parcialmente' },
      { value: 'no', label: 'Não' }, { value: 'unknown', label: 'Não soube informar' }
    ];
    return '<section class="question-detail-panel" aria-label="Detalhamento dos abastecimentos por veículo">' +
      '<header><span>ROTEIRO DA VISITA · PERGUNTA 02</span><h4>Rastreabilidade por veículo e quilometragem mensal</h4><p>Relacione o total da empresa aos veículos. Os indicadores são preliminares e a validação do hodômetro permanece na Pergunta 03.</p></header>' +
      '<div class="detail-block"><div class="detail-block-title"><span>01</span><div><h5>Cobertura do controle</h5><p>Meça quantos veículos e abastecimentos estão corretamente identificados.</p></div></div>' +
      renderFuelVehicleChoices('identifier_methods', 'Formas de identificação utilizadas', [
        { value: 'plate', label: 'Placa' }, { value: 'internal_code', label: 'Código interno' }, { value: 'fleet_number', label: 'Número de frota' }
      ], details) + '<div class="field-grid detail-grid">' +
      renderFuelVehicleNumberField('Quantidade total de veículos', 'fleet_vehicle_count', details, 'Ex.: 40', '1') +
      renderFuelVehicleNumberField('Veículos com controle individual', 'tracked_vehicle_count', details, 'Ex.: 36', '1') +
      renderFuelVehicleMetric('vehicle_coverage_percentage', 'Cobertura da frota', formatDetailPercent(snapshot.vehicle_coverage_percentage)) +
      renderFuelVehicleSelect('Existem abastecimentos sem placa ou genéricos?', 'generic_entries', details, standardOptions) +
      renderFuelVehicleNumberField('Abastecimentos realizados no mês', 'total_refuels', details, 'Ex.: 520', '1') +
      renderFuelVehicleNumberField('Abastecimentos vinculados corretamente', 'linked_refuels', details, 'Ex.: 490', '1') +
      renderFuelVehicleMetric('refuel_traceability_percentage', 'Abastecimentos rastreados', formatDetailPercent(snapshot.refuel_traceability_percentage)) + '</div>' +
      renderFuelVehicleScale('six_month_history', 'Existe controle por veículo nos últimos 6 meses?', details) +
      renderFuelVehicleScale('annual_history', 'Existe controle por veículo nos últimos 12 meses?', details) +
      renderFuelVehicleChoices('data_sources', 'Fontes utilizadas para localizar o veículo', [
        { value: 'fuel_card', label: 'Cartão de combustível' }, { value: 'erp', label: 'ERP ou sistema' },
        { value: 'spreadsheet', label: 'Planilha' }, { value: 'invoices', label: 'Notas fiscais' },
        { value: 'own_tank', label: 'Controle do tanque próprio' }, { value: 'other', label: 'Outra fonte' }
      ], details) + '<div class="field"><label for="fuel-vehicle-detail-data-source-other">Outra fonte</label><input id="fuel-vehicle-detail-data-source-other" type="text" maxlength="240" data-question-detail="fuel_vehicle" data-detail-field="data_source_other" value="' + escapeHtml(detailValue(details, 'data_source_other')) + '"></div></div>' +
      '<div class="detail-block"><div class="detail-block-title detail-block-title-action"><span>02</span><div><h5>Dados mensais por veículo</h5><p>Adicione quantos veículos forem necessários para validar a rastreabilidade.</p></div><button class="button button-secondary" type="button" data-add-fuel-vehicle' + (vehicles.length >= 200 ? ' disabled' : '') + '>Adicionar veículo</button></div>' +
      '<div class="field-grid detail-grid reconciliation-source">' +
      '<div class="field"><label for="fuel-vehicle-detail-reference-month">Mês e ano analisados</label><input id="fuel-vehicle-detail-reference-month" type="month" data-question-detail="fuel_vehicle" data-detail-field="reference_month" value="' + escapeHtml(snapshot.reference_month || '') + '"></div>' +
      renderFuelVehicleMetric('company_monthly_liters', 'Total da Pergunta 01', typeof snapshot.company_monthly_liters === 'number' ? formatDetailNumber(snapshot.company_monthly_liters, 3) + ' l' : 'Preencha a Pergunta 01') +
      renderFuelVehicleMetric('company_monthly_spend', 'Gasto da Pergunta 01', typeof snapshot.company_monthly_spend === 'number' ? formatDetailMoney(snapshot.company_monthly_spend) : 'Preencha a Pergunta 01') + '</div>' +
      '<div class="vehicle-list-editor">' + (vehicles.length ? vehicles.map(renderVehicleCard).join('') : '<div class="vehicle-empty-state"><strong>Nenhum veículo adicionado</strong><span>Use “Adicionar veículo” para registrar placa ou código, KM, litros e gasto do mês.</span></div>') + '</div></div>' +
      '<div class="detail-block"><div class="detail-block-title"><span>03</span><div><h5>Conferência com a Pergunta 01</h5><p>Compare automaticamente o total geral com a soma dos veículos adicionados.</p></div></div>' +
      '<div class="reconciliation-grid">' +
      renderFuelVehicleMetric('registered_vehicle_liters', 'Litros vinculados aos veículos', typeof snapshot.registered_vehicle_liters === 'number' ? formatDetailNumber(snapshot.registered_vehicle_liters, 3) + ' l' : 'Nenhum volume informado') +
      renderFuelVehicleMetric('liters_difference', 'Diferença de volume', typeof snapshot.liters_difference === 'number' ? formatDetailNumber(snapshot.liters_difference, 3) + ' l' : 'Não calculado') +
      renderFuelVehicleMetric('liters_traceability_percentage', 'Rastreabilidade do volume', formatDetailPercent(snapshot.liters_traceability_percentage)) +
      renderFuelVehicleMetric('registered_vehicle_spend', 'Gasto vinculado aos veículos', typeof snapshot.registered_vehicle_spend === 'number' ? formatDetailMoney(snapshot.registered_vehicle_spend) : 'Nenhum gasto informado') +
      renderFuelVehicleMetric('spend_difference', 'Diferença financeira', typeof snapshot.spend_difference === 'number' ? formatDetailMoney(snapshot.spend_difference) : 'Não calculado') +
      renderFuelVehicleMetric('spend_traceability_percentage', 'Rastreabilidade do gasto', formatDetailPercent(snapshot.spend_traceability_percentage)) + '</div>' +
      '<div class="field"><label for="fuel-vehicle-detail-unassigned-explanation">Explique diferenças ou volumes sem veículo</label><textarea id="fuel-vehicle-detail-unassigned-explanation" rows="3" maxlength="2000" data-question-detail="fuel_vehicle" data-detail-field="unassigned_explanation" placeholder="Ex.: geradores, máquinas, veículos de terceiros, estoque do tanque ou lançamentos pendentes.">' + escapeHtml(detailValue(details, 'unassigned_explanation')) + '</textarea></div></div></section>';
  }

  function updateFuelVehicleCalculations() {
    var answer = state.answers.fuel_vehicle || {};
    var fuelSpend = state.answers.fuel_spend || {};
    var snapshot = model.fuelVehicleSnapshot(answer.details || {}, fuelSpend.details || {});
    var summaryValues = {
      vehicle_coverage_percentage: formatDetailPercent(snapshot.vehicle_coverage_percentage),
      refuel_traceability_percentage: formatDetailPercent(snapshot.refuel_traceability_percentage),
      company_monthly_liters: typeof snapshot.company_monthly_liters === 'number' ? formatDetailNumber(snapshot.company_monthly_liters, 3) + ' l' : 'Preencha a Pergunta 01',
      company_monthly_spend: typeof snapshot.company_monthly_spend === 'number' ? formatDetailMoney(snapshot.company_monthly_spend) : 'Preencha a Pergunta 01',
      registered_vehicle_liters: typeof snapshot.registered_vehicle_liters === 'number' ? formatDetailNumber(snapshot.registered_vehicle_liters, 3) + ' l' : 'Nenhum volume informado',
      liters_difference: typeof snapshot.liters_difference === 'number' ? formatDetailNumber(snapshot.liters_difference, 3) + ' l' : 'Não calculado',
      liters_traceability_percentage: formatDetailPercent(snapshot.liters_traceability_percentage),
      registered_vehicle_spend: typeof snapshot.registered_vehicle_spend === 'number' ? formatDetailMoney(snapshot.registered_vehicle_spend) : 'Nenhum gasto informado',
      spend_difference: typeof snapshot.spend_difference === 'number' ? formatDetailMoney(snapshot.spend_difference) : 'Não calculado',
      spend_traceability_percentage: formatDetailPercent(snapshot.spend_traceability_percentage)
    };
    Object.keys(summaryValues).forEach(function (key) {
      elements.questionList.querySelectorAll('[data-fuel-vehicle-summary="' + key + '"]').forEach(function (element) {
        element.textContent = summaryValues[key];
      });
    });
    var referenceInput = elements.questionList.querySelector('#fuel-vehicle-detail-reference-month');
    if (referenceInput && !(answer.details && answer.details.reference_month) && snapshot.reference_month) {
      referenceInput.value = snapshot.reference_month;
    }
    var rawVehicles = answer.details && Array.isArray(answer.details.vehicles) ? answer.details.vehicles : [];
    rawVehicles.forEach(function (vehicle, index) {
      var calculated = model.fuelVehicleSnapshot({ vehicles: [vehicle] }, {}).vehicles[0] || {};
      var bothOdometers = typeof vehicle.initial_odometer === 'number' && typeof vehicle.final_odometer === 'number';
      var values = {
        mileage: typeof calculated.mileage === 'number' ? formatDetailNumber(calculated.mileage, 3) + ' km' : (bothOdometers ? 'Verifique os hodômetros' : 'Preencha KM inicial e final'),
        average_price: typeof calculated.average_price === 'number' ? formatDetailMoney(calculated.average_price) + '/l' : 'Preencha gasto e litros',
        consumption_km_l: typeof calculated.consumption_km_l === 'number' ? formatDetailNumber(calculated.consumption_km_l, 2) + ' km/l' : 'Não calculado',
        cost_per_km: typeof calculated.cost_per_km === 'number' ? formatDetailMoney(calculated.cost_per_km) + '/km' : 'Não calculado'
      };
      Object.keys(values).forEach(function (metric) {
        var element = elements.questionList.querySelector('[data-fuel-vehicle-card-metric="' + metric + '"][data-vehicle-index="' + index + '"]');
        if (element) element.textContent = values[metric];
      });
    });
  }

  function renderMaintenanceNumberField(label, key, details, placeholder, step) {
    return '<div class="field"><label for="maintenance-cost-detail-' + escapeHtml(key) + '">' + escapeHtml(label) + '</label><input id="maintenance-cost-detail-' +
      escapeHtml(key) + '" type="number" min="0" max="1000000000000" step="' + escapeHtml(step || '0.01') + '" inputmode="decimal" ' +
      'data-question-detail="maintenance_cost" data-detail-field="' + escapeHtml(key) + '" value="' + escapeHtml(detailValue(details, key)) +
      '" placeholder="' + escapeHtml(placeholder || '') + '"></div>';
  }

  function renderMaintenanceChoices(group, label, options, details) {
    var selected = Array.isArray(details[group]) ? details[group] : [];
    return '<div class="detail-choice-group"><span class="detail-label">' + escapeHtml(label) + '</span><div class="detail-choice-grid">' +
      options.map(function (option) {
        return '<label class="detail-choice"><input type="checkbox" data-question-detail="maintenance_cost" data-detail-group="' +
          escapeHtml(group) + '" value="' + escapeHtml(option.value) + '"' + (selected.indexOf(option.value) !== -1 ? ' checked' : '') +
          '><span>' + escapeHtml(option.label) + '</span></label>';
      }).join('') + '</div></div>';
  }

  function renderMaintenanceScale(field, label, details) {
    var labels = { D: 'Documentado', E: 'Estimado', N: 'Não controla', NA: 'Não se aplica' };
    return '<div class="detail-status-group"><span class="detail-label">' + escapeHtml(label) + '</span><div class="detail-scale">' +
      Object.keys(labels).map(function (key) {
        return '<label><input type="radio" name="maintenance-cost-' + escapeHtml(field) + '" data-question-detail="maintenance_cost" data-detail-field="' +
          escapeHtml(field) + '" value="' + key + '"' + (details[field] === key ? ' checked' : '') + '><span><strong>' + key +
          '</strong>' + escapeHtml(labels[key]) + '</span></label>';
      }).join('') + '</div></div>';
  }

  function renderMaintenanceSelect(label, field, details, options) {
    return '<div class="field"><label for="maintenance-cost-detail-' + escapeHtml(field) + '">' + escapeHtml(label) + '</label><select id="maintenance-cost-detail-' +
      escapeHtml(field) + '" data-question-detail="maintenance_cost" data-detail-field="' + escapeHtml(field) + '"><option value="">Selecione</option>' +
      options.map(function (option) {
        return '<option value="' + escapeHtml(option.value) + '"' + (details[field] === option.value ? ' selected' : '') + '>' +
          escapeHtml(option.label) + '</option>';
      }).join('') + '</select></div>';
  }

  function renderMaintenanceMetric(key, label, value) {
    return '<div class="calculated-metric"><span>' + escapeHtml(label) + '</span><strong data-maintenance-cost-summary="' + escapeHtml(key) + '">' +
      escapeHtml(value) + '</strong></div>';
  }

  function renderMaintenanceVehicleInput(index, label, field, vehicle, options) {
    var config = options || {};
    var min = config.signed ? '' : ' min="0"';
    return '<div class="field"><label for="maintenance-vehicle-' + index + '-' + escapeHtml(field) + '">' + escapeHtml(label) + '</label><input id="maintenance-vehicle-' +
      index + '-' + escapeHtml(field) + '" type="' + escapeHtml(config.type || 'number') + '"' + min + ' max="1000000000000" step="' +
      escapeHtml(config.step || '0.01') + '" ' + (config.type === 'text' ? 'maxlength="64"' : 'inputmode="decimal"') +
      ' data-question-detail="maintenance_cost" data-vehicle-index="' + index + '" data-vehicle-field="' + escapeHtml(field) + '" value="' +
      escapeHtml(detailValue(vehicle, field)) + '" placeholder="' + escapeHtml(config.placeholder || '') + '"></div>';
  }

  function renderMaintenanceVehicleSelect(index, label, field, vehicle, options) {
    return '<div class="field"><label for="maintenance-vehicle-' + index + '-' + escapeHtml(field) + '">' + escapeHtml(label) + '</label><select id="maintenance-vehicle-' +
      index + '-' + escapeHtml(field) + '" data-question-detail="maintenance_cost" data-vehicle-index="' + index + '" data-vehicle-field="' +
      escapeHtml(field) + '"><option value="">Selecione</option>' + options.map(function (option) {
        return '<option value="' + escapeHtml(option.value) + '"' + (vehicle[field] === option.value ? ' selected' : '') + '>' +
          escapeHtml(option.label) + '</option>';
      }).join('') + '</select></div>';
  }

  function renderMaintenanceVehicleCard(vehicle, index, monthlyTotalCost) {
    var calculated = model.maintenanceCostSnapshot({ monthly_total_cost: monthlyTotalCost, vehicles: [vehicle] }).vehicles[0] || {};
    var mileageFallback = typeof vehicle.initial_odometer === 'number' && typeof vehicle.final_odometer === 'number'
      ? 'Verifique os hodômetros' : 'Preencha KM inicial e final';
    return '<article class="vehicle-entry" data-maintenance-vehicle-card="' + index + '"><header><div><span>VEÍCULO ' +
      String(index + 1).padStart(2, '0') + '</span><strong>' + escapeHtml(vehicle.identifier || 'Identificação pendente') +
      '</strong></div><button class="button button-quiet vehicle-remove" type="button" data-remove-maintenance-vehicle="' + index + '">Remover</button></header>' +
      '<div class="field-grid vehicle-entry-grid">' +
      renderMaintenanceVehicleSelect(index, 'Tipo de identificação', 'identifier_type', vehicle, [
        { value: 'plate', label: 'Placa' }, { value: 'internal_code', label: 'Código interno' }, { value: 'fleet_number', label: 'Número de frota' }
      ]) +
      renderMaintenanceVehicleInput(index, 'Placa, código ou número', 'identifier', vehicle, { type: 'text', placeholder: 'Ex.: ABC-1D23 ou FROTA-018' }) +
      renderMaintenanceVehicleInput(index, 'Hodômetro inicial do mês', 'initial_odometer', vehicle, { step: '0.001', placeholder: 'Ex.: 250000' }) +
      renderMaintenanceVehicleInput(index, 'Hodômetro final do mês', 'final_odometer', vehicle, { step: '0.001', placeholder: 'Ex.: 261500' }) +
      renderMaintenanceVehicleInput(index, 'Ajuste de quilometragem', 'mileage_adjustment', vehicle, { step: '0.001', signed: true, placeholder: 'Ex.: 0 ou -120' }) +
      renderMaintenanceVehicleInput(index, 'Quantidade de manutenções/OS', 'maintenance_count', vehicle, { step: '1', placeholder: 'Ex.: 3' }) +
      renderMaintenanceVehicleInput(index, 'Peças (R$)', 'parts_cost', vehicle, { placeholder: 'Ex.: 4500' }) +
      renderMaintenanceVehicleInput(index, 'Mão de obra interna (R$)', 'internal_labor_cost', vehicle, { placeholder: 'Ex.: 1200' }) +
      renderMaintenanceVehicleInput(index, 'Serviços externos (R$)', 'external_services_cost', vehicle, { placeholder: 'Ex.: 1800' }) +
      renderMaintenanceVehicleInput(index, 'Lubrificantes e materiais (R$)', 'lubricants_materials_cost', vehicle, { placeholder: 'Ex.: 650' }) +
      renderMaintenanceVehicleInput(index, 'Guincho e emergência (R$)', 'towing_emergency_cost', vehicle, { placeholder: 'Ex.: 0' }) +
      renderMaintenanceVehicleInput(index, 'Retrabalho não recuperado (R$)', 'unrecovered_rework_cost', vehicle, { placeholder: 'Ex.: 0' }) +
      renderMaintenanceVehicleInput(index, 'Outros custos (R$)', 'other_cost', vehicle, { placeholder: 'Ex.: 300' }) + '</div>' +
      '<div class="vehicle-calculation-grid">' +
      '<div><span>KM rodado</span><strong data-maintenance-vehicle-card-metric="mileage" data-vehicle-index="' + index + '">' +
        (typeof calculated.mileage === 'number' ? escapeHtml(formatDetailNumber(calculated.mileage, 3)) + ' km' : mileageFallback) + '</strong></div>' +
      '<div><span>Custo total do veículo</span><strong data-maintenance-vehicle-card-metric="total_cost" data-vehicle-index="' + index + '">' +
        (typeof calculated.total_cost === 'number' ? escapeHtml(formatDetailMoney(calculated.total_cost)) : 'Preencha os custos') + '</strong></div>' +
      '<div><span>Custo de manutenção por KM</span><strong data-maintenance-vehicle-card-metric="cost_per_km" data-vehicle-index="' + index + '">' +
        (typeof calculated.cost_per_km === 'number' ? escapeHtml(formatDetailMoney(calculated.cost_per_km)) + '/km' : 'Não calculado') + '</strong></div>' +
      '<div><span>Participação no custo mensal</span><strong data-maintenance-vehicle-card-metric="share_of_monthly_cost" data-vehicle-index="' + index + '">' +
        escapeHtml(formatDetailPercent(calculated.share_of_monthly_cost)) + '</strong></div></div></article>';
  }

  function renderMaintenanceCostDetails(current) {
    if (!model.CLASSIFICATIONS[current.classification]) {
      return '<div class="question-detail-prompt"><strong>Roteiro da visita</strong><span>Selecione D, E, N ou NA para abrir o detalhamento desta pergunta.</span></div>';
    }
    var details = current.details || {};
    var snapshot = model.maintenanceCostSnapshot(details);
    var vehicles = Array.isArray(details.vehicles) ? details.vehicles : [];
    var standardOptions = [
      { value: 'yes', label: 'Sim' }, { value: 'partial', label: 'Parcialmente' },
      { value: 'no', label: 'Não' }, { value: 'unknown', label: 'Não soube informar' }
    ];
    var warningList = snapshot.warnings.length ? '<div class="detail-warning-list"><strong>Conferências necessárias</strong><ul>' +
      snapshot.warnings.map(function (warning) { return '<li>' + escapeHtml(warning) + '</li>'; }).join('') + '</ul></div>' :
      '<div class="detail-check-ok"><strong>Conferências automáticas sem divergência</strong><span>Os totais preenchidos ainda não apresentam inconsistência matemática.</span></div>';
    return '<section class="question-detail-panel" aria-label="Detalhamento do custo de manutenção por veículo">' +
      '<header><span>ROTEIRO DA VISITA · MANUTENÇÃO · PERGUNTA 01</span><h4>Custo mensal, composição e rastreabilidade por veículo</h4><p>Registre o que o cliente conseguir demonstrar. Os cálculos ajudam a conferir a informação e não alteram a classificação D, E, N ou NA.</p></header>' +
      '<div class="detail-block"><div class="detail-block-title"><span>01</span><div><h5>Referência e cobertura do controle</h5><p>Identifique o custo total do mês e quanto da frota está efetivamente coberto.</p></div></div>' +
      '<div class="field-grid detail-grid">' +
      renderMaintenanceNumberField('Custo total de manutenção no mês (R$)', 'monthly_total_cost', details, 'Ex.: 85000', '0.01') +
      '<div class="field"><label for="maintenance-cost-reference-month">Mês e ano de referência</label><input id="maintenance-cost-reference-month" type="month" data-question-detail="maintenance_cost" data-detail-field="reference_month" value="' + escapeHtml(detailValue(details, 'reference_month')) + '"></div>' +
      renderMaintenanceNumberField('Quantidade total de veículos', 'fleet_vehicle_count', details, 'Ex.: 40', '1') +
      renderMaintenanceNumberField('Veículos com manutenção no mês', 'maintained_vehicle_count', details, 'Ex.: 22', '1') +
      renderMaintenanceMetric('maintained_fleet_percentage', 'Frota que passou por manutenção', formatDetailPercent(snapshot.maintained_fleet_percentage)) +
      renderMaintenanceNumberField('Veículos com custo identificado', 'tracked_vehicle_count', details, 'Ex.: 20', '1') +
      renderMaintenanceMetric('vehicle_cost_coverage_percentage', 'Cobertura dos veículos mantidos', formatDetailPercent(snapshot.vehicle_cost_coverage_percentage)) +
      renderMaintenanceNumberField('Lançamentos ou OS no mês', 'maintenance_records_count', details, 'Ex.: 38', '1') +
      renderMaintenanceNumberField('Lançamentos vinculados ao veículo', 'linked_maintenance_records_count', details, 'Ex.: 35', '1') +
      renderMaintenanceMetric('maintenance_record_traceability_percentage', 'Rastreabilidade dos lançamentos', formatDetailPercent(snapshot.maintenance_record_traceability_percentage)) + '</div>' +
      renderMaintenanceChoices('identifier_methods', 'Formas de identificação utilizadas', [
        { value: 'plate', label: 'Placa' }, { value: 'internal_code', label: 'Código interno' }, { value: 'fleet_number', label: 'Número de frota' }
      ], details) +
      '<div class="field-grid two-columns">' +
      renderMaintenanceSelect('Existem custos sem veículo identificado?', 'unlinked_costs', details, standardOptions) +
      renderMaintenanceSelect('Custos e documentos estão consolidados?', 'values_consolidated', details, standardOptions) + '</div></div>' +
      '<div class="detail-block"><div class="detail-block-title"><span>02</span><div><h5>Composição do custo</h5><p>Separe o valor mensal para descobrir o que está incluído ou esquecido no número informado.</p></div></div>' +
      '<div class="field-grid detail-grid">' +
      renderMaintenanceNumberField('Peças (R$)', 'parts_cost', details, 'Total no mês') +
      renderMaintenanceNumberField('Mão de obra interna (R$)', 'internal_labor_cost', details, 'Total no mês') +
      renderMaintenanceNumberField('Serviços e mão de obra externa (R$)', 'external_services_cost', details, 'Total no mês') +
      renderMaintenanceNumberField('Lubrificantes e materiais (R$)', 'lubricants_materials_cost', details, 'Total no mês') +
      renderMaintenanceNumberField('Guincho e emergência (R$)', 'towing_emergency_cost', details, 'Total no mês') +
      renderMaintenanceNumberField('Retrabalho não recuperado (R$)', 'unrecovered_rework_cost', details, 'Total no mês') +
      renderMaintenanceNumberField('Outros custos (R$)', 'other_cost', details, 'Total no mês') +
      renderMaintenanceMetric('composition_total', 'Soma da composição', typeof snapshot.composition_total === 'number' ? formatDetailMoney(snapshot.composition_total) : 'Não calculada') +
      renderMaintenanceMetric('composition_difference', 'Diferença para o custo mensal', typeof snapshot.composition_difference === 'number' ? formatDetailMoney(snapshot.composition_difference) : 'Não calculada') +
      renderMaintenanceMetric('composition_percentage', 'Custo mensal explicado', formatDetailPercent(snapshot.composition_percentage)) + '</div>' +
      '<div class="field"><label for="maintenance-cost-other-description">Descrição de outros custos</label><textarea id="maintenance-cost-other-description" rows="2" maxlength="500" data-question-detail="maintenance_cost" data-detail-field="other_cost_description" placeholder="Informe o que está incluído em outros custos.">' + escapeHtml(detailValue(details, 'other_cost_description')) + '</textarea></div></div>' +
      '<div class="detail-block"><div class="detail-block-title"><span>03</span><div><h5>Custo por tipo de manutenção</h5><p>Separe preventiva, corretiva, preditiva e ocorrências para orientar a análise.</p></div></div>' +
      '<div class="field-grid detail-grid">' +
      renderMaintenanceNumberField('Preventiva (R$)', 'preventive_cost', details, 'Total no mês') +
      renderMaintenanceNumberField('Corretiva (R$)', 'corrective_cost', details, 'Total no mês') +
      renderMaintenanceNumberField('Preditiva (R$)', 'predictive_cost', details, 'Total no mês') +
      renderMaintenanceNumberField('Acidente ou avaria (R$)', 'accident_damage_cost', details, 'Total no mês') +
      renderMaintenanceMetric('type_total', 'Soma por tipo', typeof snapshot.type_total === 'number' ? formatDetailMoney(snapshot.type_total) : 'Não calculada') +
      renderMaintenanceMetric('type_difference', 'Diferença para o custo mensal', typeof snapshot.type_difference === 'number' ? formatDetailMoney(snapshot.type_difference) : 'Não calculada') +
      renderMaintenanceMetric('type_percentage', 'Custo mensal classificado', formatDetailPercent(snapshot.type_percentage)) + '</div></div>' +
      '<div class="detail-block"><div class="detail-block-title"><span>04</span><div><h5>Histórico e fontes</h5><p>Confirme se o mês representa um controle contínuo e de onde os números foram extraídos.</p></div></div>' +
      renderMaintenanceScale('six_month_history', 'A empresa possui histórico de custos dos últimos 6 meses?', details) +
      '<div class="field-grid two-columns">' + renderMaintenanceNumberField('Custo em 6 meses (R$)', 'six_month_total_cost', details, 'Total do período') +
      renderMaintenanceNumberField('Custo em 12 meses (R$)', 'annual_total_cost', details, 'Total do período') + '</div>' +
      renderMaintenanceScale('annual_history', 'A empresa possui histórico de custos dos últimos 12 meses?', details) +
      renderMaintenanceChoices('data_sources', 'Fontes da informação', [
        { value: 'erp', label: 'ERP ou sistema' }, { value: 'work_orders', label: 'Ordens de serviço' },
        { value: 'spreadsheet', label: 'Planilha' }, { value: 'invoices', label: 'Notas fiscais' },
        { value: 'workshop_control', label: 'Controle da oficina' }, { value: 'accounting', label: 'Financeiro/contabilidade' },
        { value: 'other', label: 'Outra fonte' }
      ], details) + '<div class="field"><label for="maintenance-cost-source-other">Outra fonte</label><input id="maintenance-cost-source-other" type="text" maxlength="240" data-question-detail="maintenance_cost" data-detail-field="data_source_other" value="' + escapeHtml(detailValue(details, 'data_source_other')) + '"></div></div>' +
      '<div class="detail-block"><div class="detail-block-title detail-block-title-action"><span>05</span><div><h5>Custos mensais por veículo</h5><p>Cadastre os veículos necessários para validar custo, quilometragem e participação no total.</p></div><button class="button button-secondary" type="button" data-add-maintenance-vehicle' + (vehicles.length >= 200 ? ' disabled' : '') + '>Adicionar veículo</button></div>' +
      '<div class="vehicle-list-editor">' + (vehicles.length ? vehicles.map(function (vehicle, index) {
        return renderMaintenanceVehicleCard(vehicle, index, details.monthly_total_cost);
      }).join('') : '<div class="vehicle-empty-state"><strong>Nenhum veículo adicionado</strong><span>Use “Adicionar veículo” para registrar identificação, KM e composição do custo.</span></div>') + '</div></div>' +
      '<div class="detail-block"><div class="detail-block-title"><span>06</span><div><h5>Conciliação e evidências</h5><p>Compare o custo declarado com os valores individualizados antes de concluir a leitura.</p></div></div>' +
      '<div class="reconciliation-grid">' +
      renderMaintenanceMetric('monthly_total_cost', 'Custo mensal declarado', typeof snapshot.monthly_total_cost === 'number' ? formatDetailMoney(snapshot.monthly_total_cost) : 'Não informado') +
      renderMaintenanceMetric('registered_vehicle_cost', 'Custo vinculado aos veículos', typeof snapshot.registered_vehicle_cost === 'number' ? formatDetailMoney(snapshot.registered_vehicle_cost) : 'Nenhum custo informado') +
      renderMaintenanceMetric('vehicle_cost_difference', 'Custo ainda não conciliado', typeof snapshot.vehicle_cost_difference === 'number' ? formatDetailMoney(snapshot.vehicle_cost_difference) : 'Não calculado') +
      renderMaintenanceMetric('vehicle_cost_traceability_percentage', 'Rastreabilidade financeira', formatDetailPercent(snapshot.vehicle_cost_traceability_percentage)) +
      renderMaintenanceMetric('registered_vehicle_mileage', 'KM somado dos veículos', typeof snapshot.registered_vehicle_mileage === 'number' ? formatDetailNumber(snapshot.registered_vehicle_mileage, 3) + ' km' : 'Não calculado') +
      renderMaintenanceMetric('registered_maintenance_count', 'Manutenções/OS cadastradas', typeof snapshot.registered_maintenance_count === 'number' ? formatDetailNumber(snapshot.registered_maintenance_count, 0) : 'Não informado') + '</div>' +
      warningList + '<div class="field"><label for="maintenance-cost-unassigned-explanation">Explique diferenças, custos indiretos ou valores sem veículo</label><textarea id="maintenance-cost-unassigned-explanation" rows="3" maxlength="2000" data-question-detail="maintenance_cost" data-detail-field="unassigned_explanation" placeholder="Ex.: estoque de peças, manutenção predial da oficina, nota ainda não rateada, veículo de terceiro ou lançamento pendente.">' + escapeHtml(detailValue(details, 'unassigned_explanation')) + '</textarea></div></div></section>';
  }

  function updateMaintenanceCostCalculations() {
    var answer = state.answers.maintenance_cost || {};
    var snapshot = model.maintenanceCostSnapshot(answer.details || {});
    var values = {
      maintained_fleet_percentage: formatDetailPercent(snapshot.maintained_fleet_percentage),
      vehicle_cost_coverage_percentage: formatDetailPercent(snapshot.vehicle_cost_coverage_percentage),
      maintenance_record_traceability_percentage: formatDetailPercent(snapshot.maintenance_record_traceability_percentage),
      composition_total: typeof snapshot.composition_total === 'number' ? formatDetailMoney(snapshot.composition_total) : 'Não calculada',
      composition_difference: typeof snapshot.composition_difference === 'number' ? formatDetailMoney(snapshot.composition_difference) : 'Não calculada',
      composition_percentage: formatDetailPercent(snapshot.composition_percentage),
      type_total: typeof snapshot.type_total === 'number' ? formatDetailMoney(snapshot.type_total) : 'Não calculada',
      type_difference: typeof snapshot.type_difference === 'number' ? formatDetailMoney(snapshot.type_difference) : 'Não calculada',
      type_percentage: formatDetailPercent(snapshot.type_percentage),
      monthly_total_cost: typeof snapshot.monthly_total_cost === 'number' ? formatDetailMoney(snapshot.monthly_total_cost) : 'Não informado',
      registered_vehicle_cost: typeof snapshot.registered_vehicle_cost === 'number' ? formatDetailMoney(snapshot.registered_vehicle_cost) : 'Nenhum custo informado',
      vehicle_cost_difference: typeof snapshot.vehicle_cost_difference === 'number' ? formatDetailMoney(snapshot.vehicle_cost_difference) : 'Não calculado',
      vehicle_cost_traceability_percentage: formatDetailPercent(snapshot.vehicle_cost_traceability_percentage),
      registered_vehicle_mileage: typeof snapshot.registered_vehicle_mileage === 'number' ? formatDetailNumber(snapshot.registered_vehicle_mileage, 3) + ' km' : 'Não calculado',
      registered_maintenance_count: typeof snapshot.registered_maintenance_count === 'number' ? formatDetailNumber(snapshot.registered_maintenance_count, 0) : 'Não informado'
    };
    Object.keys(values).forEach(function (key) {
      elements.questionList.querySelectorAll('[data-maintenance-cost-summary="' + key + '"]').forEach(function (element) {
        element.textContent = values[key];
      });
    });
    var rawVehicles = answer.details && Array.isArray(answer.details.vehicles) ? answer.details.vehicles : [];
    rawVehicles.forEach(function (vehicle, index) {
      var calculated = model.maintenanceCostSnapshot({ monthly_total_cost: snapshot.monthly_total_cost, vehicles: [vehicle] }).vehicles[0] || {};
      var bothOdometers = typeof vehicle.initial_odometer === 'number' && typeof vehicle.final_odometer === 'number';
      var cardValues = {
        mileage: typeof calculated.mileage === 'number' ? formatDetailNumber(calculated.mileage, 3) + ' km' : (bothOdometers ? 'Verifique os hodômetros' : 'Preencha KM inicial e final'),
        total_cost: typeof calculated.total_cost === 'number' ? formatDetailMoney(calculated.total_cost) : 'Preencha os custos',
        cost_per_km: typeof calculated.cost_per_km === 'number' ? formatDetailMoney(calculated.cost_per_km) + '/km' : 'Não calculado',
        share_of_monthly_cost: formatDetailPercent(calculated.share_of_monthly_cost)
      };
      Object.keys(cardValues).forEach(function (metric) {
        var element = elements.questionList.querySelector('[data-maintenance-vehicle-card-metric="' + metric + '"][data-vehicle-index="' + index + '"]');
        if (element) element.textContent = cardValues[metric];
      });
    });
    var existingChecks = elements.questionList.querySelector('.detail-warning-list, .detail-check-ok');
    if (existingChecks) {
      var replacement = document.createElement('div');
      replacement.innerHTML = snapshot.warnings.length ? '<div class="detail-warning-list"><strong>Conferências necessárias</strong><ul>' +
        snapshot.warnings.map(function (warning) { return '<li>' + escapeHtml(warning) + '</li>'; }).join('') + '</ul></div>' :
        '<div class="detail-check-ok"><strong>Conferências automáticas sem divergência</strong><span>Os totais preenchidos ainda não apresentam inconsistência matemática.</span></div>';
      existingChecks.replaceWith(replacement.firstElementChild);
    }
  }

  function renderQuestions() {
    var pillar = model.PILLARS[state.pillarIndex];
    var questions = model.visibleQuestions(state.answers, pillar.key);
    elements.questionList.innerHTML = questions.map(function (question, questionIndex) {
      var current = state.answers[question.key] || {};
      var options = Object.keys(model.CLASSIFICATIONS).map(function (key) {
        var definition = model.CLASSIFICATIONS[key];
        return '<label class="answer-option ' + definition.tone + '"><input type="radio" name="' + escapeHtml(question.key) +
          '" value="' + key + '" data-question-key="' + escapeHtml(question.key) + '"' + (current.classification === key ? ' checked' : '') +
          '><span><strong>' + key + '</strong>' + escapeHtml(definition.label) + '</span></label>';
      }).join('');
      var detailPanel = question.key === 'fuel_spend' ? renderFuelSpendDetails(current) :
        (question.key === 'fuel_vehicle' ? renderFuelVehicleDetails(current) :
          (question.key === 'maintenance_cost' ? renderMaintenanceCostDetails(current) : ''));
      return '<fieldset class="question-card" data-question-card="' + escapeHtml(question.key) + '"><legend>' +
        String(questionIndex + 1).padStart(2, '0') + '. ' + escapeHtml(question.title) + '</legend><p class="question-help">' +
        escapeHtml(question.help) + '</p><div class="answer-options">' + options + '</div>' + detailPanel + '<details class="question-notes"' +
        (current.notes ? ' open' : '') + '><summary>Adicionar observação</summary><textarea rows="2" maxlength="4000" data-question-notes="' +
        escapeHtml(question.key) + '" placeholder="Evidência, fonte ou ponto a validar.">' + escapeHtml(current.notes || '') + '</textarea></details></fieldset>';
    }).join('');
  }

  function renderDiagnostic() {
    var company = companyById(state.diagnostic.company_id);
    var pillar = model.PILLARS[state.pillarIndex];
    document.getElementById('diagnostic-company-name').textContent = company ? company.trade_name || company.legal_name : 'Empresa';
    document.getElementById('step-title').textContent = pillar.name;
    document.getElementById('step-counter').textContent = 'Pilar ' + (state.pillarIndex + 1) + ' de 4';
    document.querySelector('.progress-track').setAttribute('aria-valuenow', String(state.pillarIndex + 1));
    document.getElementById('progress-fill').style.width = ((state.pillarIndex + 1) * 25) + '%';
    document.getElementById('previous-pillar').disabled = state.pillarIndex === 0;
    document.getElementById('next-pillar').textContent = state.pillarIndex === 3 ? 'Concluir diagnóstico' : 'Salvar e avançar';
    elements.generalNotes.value = state.diagnostic.general_notes || '';
    elements.diagnosticMessage.textContent = '';
    renderPillarTabs();
    renderQuestions();
    setSaveStatus('saved', 'Rascunho sincronizado');
  }

  function setSaveStatus(status, message) {
    elements.saveIndicator.classList.toggle('saving', status === 'saving');
    elements.saveIndicator.classList.toggle('error', status === 'error');
    elements.saveStatus.textContent = message;
  }

  function queueAutosave() {
    if (!state.diagnostic || state.diagnostic.status !== 'draft') return;
    clearTimeout(state.saveTimer);
    setSaveStatus('saving', 'Alterações pendentes');
    state.saveTimer = setTimeout(function () { saveDraft().catch(function () {}); }, 750);
  }

  async function saveDraft() {
    if (!state.diagnostic || state.diagnostic.status !== 'draft') return;
    clearTimeout(state.saveTimer);
    setSaveStatus('saving', 'Sincronizando…');
    var metadata = await state.client.from('executive_diagnostics').update({
      current_step: state.pillarIndex,
      general_notes: elements.generalNotes.value.trim() || null
    }).eq('id', state.diagnostic.id).select().single();
    if (metadata.error) {
      setSaveStatus('error', 'Falha ao salvar');
      throw metadata.error;
    }
    state.diagnostic = metadata.data;
    updateDiagnosticInState(metadata.data);
    var rows = model.toRows(state.diagnostic.id, state.user.id, state.answers);
    if (rows.length) {
      var answersResult = await state.client.from('diagnostic_answers').upsert(rows, {
        onConflict: 'diagnostic_id,question_key'
      });
      if (answersResult.error) {
        setSaveStatus('error', 'Falha ao salvar');
        throw answersResult.error;
      }
    }
    setSaveStatus('saved', 'Salvo às ' + new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date()));
  }

  function validateCurrentPillar() {
    var pillar = model.PILLARS[state.pillarIndex];
    return model.visibleQuestions(state.answers, pillar.key).filter(function (question) {
      return !model.CLASSIFICATIONS[state.answers[question.key] && state.answers[question.key].classification];
    });
  }

  async function goNext() {
    var missing = validateCurrentPillar();
    if (missing.length) {
      elements.diagnosticMessage.textContent = 'Responda todas as perguntas visíveis deste pilar.';
      var first = elements.questionList.querySelector('[data-question-card="' + missing[0].key + '"] input');
      if (first) first.focus();
      return;
    }
    elements.diagnosticMessage.textContent = '';
    var button = document.getElementById('next-pillar');
    setBusy(button, true, state.pillarIndex === 3 ? 'Concluindo…' : 'Salvando…');
    try {
      await saveDraft();
      if (state.pillarIndex < 3) {
        state.pillarIndex += 1;
        state.diagnostic.current_step = state.pillarIndex;
        renderDiagnostic();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        await completeDiagnostic();
      }
    } catch (error) {
      elements.diagnosticMessage.textContent = friendlyError(error);
    } finally {
      setBusy(button, false);
    }
  }

  async function completeDiagnostic() {
    var completion = model.completeness(state.answers);
    if (!completion.complete) {
      var firstMissing = completion.missing[0];
      state.pillarIndex = model.PILLARS.findIndex(function (pillar) { return pillar.key === firstMissing.pillar; });
      renderDiagnostic();
      elements.diagnosticMessage.textContent = 'Há perguntas pendentes antes da conclusão.';
      return;
    }
    var summary = model.evaluate(state.answers);
    var maturity = {};
    summary.pillars.forEach(function (pillar) { maturity[pillar.key] = pillar.level; });
    var result = await state.client.from('executive_diagnostics').update({
      status: 'completed',
      current_step: 3,
      fuel_maturity: maturity.fuel,
      maintenance_maturity: maturity.maintenance,
      tires_maturity: maturity.tires,
      drivers_maturity: maturity.drivers,
      general_notes: elements.generalNotes.value.trim() || null,
      preliminary_summary: summary,
      completed_at: new Date().toISOString()
    }).eq('id', state.diagnostic.id).select().single();
    if (result.error) throw result.error;
    state.diagnostic = result.data;
    updateDiagnosticInState(result.data);
    renderDashboard();
    renderResult(result.data);
    showView('result');
    showToast('Diagnóstico concluído e salvo.');
  }

  function detailLabels(values, labels, other) {
    var list = Array.isArray(values) ? values.map(function (value) { return labels[value]; }).filter(Boolean) : [];
    if (other) list.push(other);
    return list.length ? list.join(', ') : 'Não informado';
  }

  function renderFuelSpendResult(snapshot) {
    var panel = document.getElementById('fuel-spend-summary');
    if (!snapshot || !snapshot.has_data) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    var fuelLabels = {
      diesel_s10: 'Diesel S10', diesel_s500: 'Diesel S500', arla32: 'Arla 32',
      gasoline: 'Gasolina', ethanol: 'Etanol', other: 'Outro'
    };
    var sourceLabels = {
      fuel_card: 'Cartão de combustível', erp: 'ERP ou sistema', spreadsheet: 'Planilha',
      invoices: 'Notas fiscais', own_tank: 'Controle do tanque próprio', other: 'Outra fonte'
    };
    var paymentLabels = {
      fuel_card: 'Cartão', bank_slip: 'Boleto ou faturado', cash: 'À vista',
      pix: 'Pix', bank_transfer: 'Transferência', other: 'Outra forma'
    };
    var statusLabels = { yes: 'Sim', partial: 'Parcialmente', no: 'Não', unknown: 'Não informado', D: 'Documentado', E: 'Estimado', N: 'Não controla', NA: 'Não se aplica' };
    panel.hidden = false;
    panel.innerHTML = '<div class="fuel-result-header"><div><p class="panel-kicker">Pergunta 01 · Combustível</p><h2>Leitura de gasto e volume</h2></div><span class="badge">' +
      escapeHtml(formatReferenceMonth(snapshot.reference_month)) + '</span></div><div class="fuel-result-metrics">' +
      '<div><span>Gasto mensal</span><strong>' + escapeHtml(formatDetailMoney(snapshot.monthly_spend)) + '</strong></div>' +
      '<div><span>Volume mensal</span><strong>' + escapeHtml(formatDetailNumber(snapshot.monthly_liters, 3)) + ' l</strong></div>' +
      '<div><span>Preço médio mensal</span><strong>' + (typeof snapshot.monthly_average_price === 'number' ? escapeHtml(formatDetailMoney(snapshot.monthly_average_price)) + '/l' : 'Não calculado') + '</strong></div>' +
      '<div><span>Histórico de 6 meses</span><strong>' + escapeHtml(statusLabels[snapshot.six_month_history] || 'Não informado') + '</strong><small>' +
        escapeHtml(formatDetailMoney(snapshot.six_month_spend)) + ' · ' + escapeHtml(formatDetailNumber(snapshot.six_month_liters, 3)) + ' l</small></div>' +
      '<div><span>Histórico de 12 meses</span><strong>' + escapeHtml(statusLabels[snapshot.annual_history] || 'Não informado') + '</strong><small>' +
        escapeHtml(formatDetailMoney(snapshot.annual_spend)) + ' · ' + escapeHtml(formatDetailNumber(snapshot.annual_liters, 3)) + ' l</small></div>' +
      '<div><span>Consolidação</span><strong>' + escapeHtml(statusLabels[snapshot.values_consolidated] || 'Não informado') + '</strong></div></div>' +
      '<div class="fuel-result-context"><p><strong>Produtos:</strong> ' + escapeHtml(detailLabels(snapshot.fuel_types, fuelLabels, snapshot.fuel_type_other)) + '</p>' +
      '<p><strong>Fontes:</strong> ' + escapeHtml(detailLabels(snapshot.data_sources, sourceLabels, snapshot.data_source_other)) + '</p>' +
      '<p><strong>Pagamentos:</strong> ' + escapeHtml(detailLabels(snapshot.payment_methods, paymentLabels, snapshot.payment_other)) + '</p>' +
      '<p><strong>Posto interno:</strong> ' + escapeHtml(statusLabels[snapshot.internal_station] || 'Não informado') +
      ' · <strong>Volume interno:</strong> ' + escapeHtml(formatDetailNumber(snapshot.internal_monthly_liters, 3)) + ' l' +
      ' · <strong>Volume externo:</strong> ' + escapeHtml(formatDetailNumber(snapshot.external_monthly_liters, 3)) + ' l</p>' +
      (snapshot.external_stations ? '<p><strong>Postos externos:</strong> ' + escapeHtml(snapshot.external_stations) + '</p>' : '') + '</div>';
  }

  function renderFuelVehicleResult(snapshot) {
    var panel = document.getElementById('fuel-vehicle-summary');
    if (!snapshot || !snapshot.has_data) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    var identifierLabels = { plate: 'Placa', internal_code: 'Código interno', fleet_number: 'Número de frota' };
    var sourceLabels = {
      fuel_card: 'Cartão de combustível', erp: 'ERP ou sistema', spreadsheet: 'Planilha',
      invoices: 'Notas fiscais', own_tank: 'Controle do tanque próprio', other: 'Outra fonte'
    };
    var statusLabels = { yes: 'Sim', partial: 'Parcialmente', no: 'Não', unknown: 'Não informado', D: 'Documentado', E: 'Estimado', N: 'Não controla', NA: 'Não se aplica' };
    var vehicleList = snapshot.vehicles.length ? '<div class="fuel-vehicle-result-list">' + snapshot.vehicles.map(function (vehicle) {
      return '<div><strong>' + escapeHtml(vehicle.identifier || 'Veículo sem identificação') + '</strong><span>' +
        escapeHtml(identifierLabels[vehicle.identifier_type] || 'Identificação não informada') +
        ' · ' + (typeof vehicle.mileage === 'number' ? escapeHtml(formatDetailNumber(vehicle.mileage, 3)) + ' km' : 'KM não calculado') +
        ' · ' + (typeof vehicle.liters === 'number' ? escapeHtml(formatDetailNumber(vehicle.liters, 3)) + ' l' : 'litros não informados') +
        ' · ' + (typeof vehicle.spend === 'number' ? escapeHtml(formatDetailMoney(vehicle.spend)) : 'gasto não informado') + '</span><small>' +
        (typeof vehicle.consumption_km_l === 'number' ? escapeHtml(formatDetailNumber(vehicle.consumption_km_l, 2)) + ' km/l' : 'consumo não calculado') +
        ' · ' + (typeof vehicle.cost_per_km === 'number' ? escapeHtml(formatDetailMoney(vehicle.cost_per_km)) + '/km' : 'custo/km não calculado') + '</small></div>';
    }).join('') + '</div>' : '<p class="muted small">Nenhum veículo individual foi registrado no roteiro.</p>';
    panel.hidden = false;
    panel.innerHTML = '<div class="fuel-result-header"><div><p class="panel-kicker">Pergunta 02 · Combustível</p><h2>Rastreabilidade por veículo</h2></div><span class="badge">' +
      escapeHtml(formatReferenceMonth(snapshot.reference_month)) + '</span></div><div class="fuel-result-metrics">' +
      '<div><span>Cobertura da frota</span><strong>' + escapeHtml(formatDetailPercent(snapshot.vehicle_coverage_percentage)) + '</strong><small>' +
        escapeHtml(formatDetailNumber(snapshot.tracked_vehicle_count, 0)) + ' de ' + escapeHtml(formatDetailNumber(snapshot.fleet_vehicle_count, 0)) + ' veículos</small></div>' +
      '<div><span>Abastecimentos rastreados</span><strong>' + escapeHtml(formatDetailPercent(snapshot.refuel_traceability_percentage)) + '</strong><small>' +
        escapeHtml(formatDetailNumber(snapshot.linked_refuels, 0)) + ' de ' + escapeHtml(formatDetailNumber(snapshot.total_refuels, 0)) + ' lançamentos</small></div>' +
      '<div><span>Volume rastreado</span><strong>' + escapeHtml(formatDetailPercent(snapshot.liters_traceability_percentage)) + '</strong><small>Diferença: ' +
        (typeof snapshot.liters_difference === 'number' ? escapeHtml(formatDetailNumber(snapshot.liters_difference, 3)) + ' l' : 'não calculada') + '</small></div>' +
      '<div><span>Gasto rastreado</span><strong>' + escapeHtml(formatDetailPercent(snapshot.spend_traceability_percentage)) + '</strong><small>Diferença: ' +
        (typeof snapshot.spend_difference === 'number' ? escapeHtml(formatDetailMoney(snapshot.spend_difference)) : 'não calculada') + '</small></div>' +
      '<div><span>Histórico de 6 meses</span><strong>' + escapeHtml(statusLabels[snapshot.six_month_history] || 'Não informado') + '</strong></div>' +
      '<div><span>Histórico de 12 meses</span><strong>' + escapeHtml(statusLabels[snapshot.annual_history] || 'Não informado') + '</strong></div></div>' +
      '<div class="fuel-result-context"><p><strong>Identificação:</strong> ' + escapeHtml(detailLabels(snapshot.identifier_methods, identifierLabels)) + '</p>' +
      '<p><strong>Fontes:</strong> ' + escapeHtml(detailLabels(snapshot.data_sources, sourceLabels, snapshot.data_source_other)) + '</p>' +
      '<p><strong>Lançamentos sem veículo ou genéricos:</strong> ' + escapeHtml(statusLabels[snapshot.generic_entries] || 'Não informado') + '</p>' +
      (snapshot.unassigned_explanation ? '<p><strong>Explicação das diferenças:</strong> ' + escapeHtml(snapshot.unassigned_explanation) + '</p>' : '') + '</div>' + vehicleList;
  }

  function renderMaintenanceCostResult(snapshot) {
    var panel = document.getElementById('maintenance-cost-summary');
    if (!snapshot || !snapshot.has_data) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    var identifierLabels = { plate: 'Placa', internal_code: 'Código interno', fleet_number: 'Número de frota' };
    var sourceLabels = {
      erp: 'ERP ou sistema', work_orders: 'Ordens de serviço', spreadsheet: 'Planilha', invoices: 'Notas fiscais',
      workshop_control: 'Controle da oficina', accounting: 'Financeiro/contabilidade', other: 'Outra fonte'
    };
    var statusLabels = { yes: 'Sim', partial: 'Parcialmente', no: 'Não', unknown: 'Não informado', D: 'Documentado', E: 'Estimado', N: 'Não controla', NA: 'Não se aplica' };
    var vehicleList = snapshot.vehicles.length ? '<div class="fuel-vehicle-result-list">' + snapshot.vehicles.map(function (vehicle) {
      return '<div><strong>' + escapeHtml(vehicle.identifier || 'Veículo sem identificação') + '</strong><span>' +
        escapeHtml(identifierLabels[vehicle.identifier_type] || 'Identificação não informada') +
        ' · ' + (typeof vehicle.mileage === 'number' ? escapeHtml(formatDetailNumber(vehicle.mileage, 3)) + ' km' : 'KM não calculado') +
        ' · ' + (typeof vehicle.maintenance_count === 'number' ? escapeHtml(formatDetailNumber(vehicle.maintenance_count, 0)) + ' manutenções/OS' : 'quantidade não informada') + '</span><small>' +
        (typeof vehicle.total_cost === 'number' ? escapeHtml(formatDetailMoney(vehicle.total_cost)) : 'custo não informado') +
        ' · ' + (typeof vehicle.cost_per_km === 'number' ? escapeHtml(formatDetailMoney(vehicle.cost_per_km)) + '/km' : 'custo/km não calculado') +
        ' · ' + escapeHtml(formatDetailPercent(vehicle.share_of_monthly_cost)) + ' do mês</small></div>';
    }).join('') + '</div>' : '<p class="muted small">Nenhum veículo individual foi registrado no roteiro de manutenção.</p>';
    var warningBlock = snapshot.warnings.length ? '<div class="result-warning"><strong>Conferências pendentes</strong><ul>' +
      snapshot.warnings.map(function (warning) { return '<li>' + escapeHtml(warning) + '</li>'; }).join('') + '</ul></div>' : '';
    panel.hidden = false;
    panel.innerHTML = '<div class="fuel-result-header"><div><p class="panel-kicker">Pergunta 01 · Manutenção</p><h2>Leitura de custos por veículo</h2></div><span class="badge">' +
      escapeHtml(formatReferenceMonth(snapshot.reference_month)) + '</span></div><div class="fuel-result-metrics">' +
      '<div><span>Custo mensal</span><strong>' + escapeHtml(formatDetailMoney(snapshot.monthly_total_cost)) + '</strong></div>' +
      '<div><span>Veículos mantidos</span><strong>' + escapeHtml(formatDetailPercent(snapshot.maintained_fleet_percentage)) + '</strong><small>' +
        escapeHtml(formatDetailNumber(snapshot.maintained_vehicle_count, 0)) + ' de ' + escapeHtml(formatDetailNumber(snapshot.fleet_vehicle_count, 0)) + ' veículos</small></div>' +
      '<div><span>Custos por veículo</span><strong>' + escapeHtml(formatDetailPercent(snapshot.vehicle_cost_coverage_percentage)) + '</strong><small>' +
        escapeHtml(formatDetailNumber(snapshot.tracked_vehicle_count, 0)) + ' de ' + escapeHtml(formatDetailNumber(snapshot.maintained_vehicle_count, 0)) + ' veículos mantidos</small></div>' +
      '<div><span>Lançamentos rastreados</span><strong>' + escapeHtml(formatDetailPercent(snapshot.maintenance_record_traceability_percentage)) + '</strong><small>' +
        escapeHtml(formatDetailNumber(snapshot.linked_maintenance_records_count, 0)) + ' de ' + escapeHtml(formatDetailNumber(snapshot.maintenance_records_count, 0)) + ' lançamentos/OS</small></div>' +
      '<div><span>Custo conciliado por veículo</span><strong>' + escapeHtml(formatDetailPercent(snapshot.vehicle_cost_traceability_percentage)) + '</strong><small>Diferença: ' +
        (typeof snapshot.vehicle_cost_difference === 'number' ? escapeHtml(formatDetailMoney(snapshot.vehicle_cost_difference)) : 'não calculada') + '</small></div>' +
      '<div><span>Composição explicada</span><strong>' + escapeHtml(formatDetailPercent(snapshot.composition_percentage)) + '</strong><small>Soma: ' +
        (typeof snapshot.composition_total === 'number' ? escapeHtml(formatDetailMoney(snapshot.composition_total)) : 'não calculada') + '</small></div>' +
      '<div><span>Preventiva</span><strong>' + escapeHtml(formatDetailMoney(snapshot.preventive_cost)) + '</strong></div>' +
      '<div><span>Corretiva</span><strong>' + escapeHtml(formatDetailMoney(snapshot.corrective_cost)) + '</strong></div>' +
      '<div><span>Histórico</span><strong>6 meses: ' + escapeHtml(statusLabels[snapshot.six_month_history] || 'Não informado') + '</strong><small>12 meses: ' +
        escapeHtml(statusLabels[snapshot.annual_history] || 'Não informado') + '</small></div></div>' +
      '<div class="fuel-result-context"><p><strong>Identificação:</strong> ' + escapeHtml(detailLabels(snapshot.identifier_methods, identifierLabels)) + '</p>' +
      '<p><strong>Fontes:</strong> ' + escapeHtml(detailLabels(snapshot.data_sources, sourceLabels, snapshot.data_source_other)) + '</p>' +
      '<p><strong>Consolidação:</strong> ' + escapeHtml(statusLabels[snapshot.values_consolidated] || 'Não informado') +
      ' · <strong>Custos sem veículo:</strong> ' + escapeHtml(statusLabels[snapshot.unlinked_costs] || 'Não informado') + '</p>' +
      (snapshot.unassigned_explanation ? '<p><strong>Explicação das diferenças:</strong> ' + escapeHtml(snapshot.unassigned_explanation) + '</p>' : '') + '</div>' + warningBlock + vehicleList;
  }

  function renderResult(diagnostic) {
    var summary = diagnostic.preliminary_summary && diagnostic.preliminary_summary.pillars ? diagnostic.preliminary_summary : model.evaluate(state.answers);
    var company = companyById(diagnostic.company_id);
    document.getElementById('result-company-name').textContent = (company ? company.trade_name || company.legal_name : 'Empresa') + ' • ' + formatDate(diagnostic.completed_at);
    document.getElementById('maturity-grid').innerHTML = summary.pillars.map(function (pillar) {
      return '<article class="maturity-card"><div class="maturity-top"><h2>' + escapeHtml(pillar.name) + '</h2><strong class="maturity-score">' +
        pillar.level + '/3</strong></div><div class="maturity-bar"><span style="width:' + ((pillar.level / 3) * 100) + '%"></span></div><p><strong>' +
        escapeHtml(pillar.label) + '</strong><br>' + escapeHtml(pillar.description) + '</p></article>';
    }).join('');
    renderFuelSpendResult(summary.fuelSpend);
    renderFuelVehicleResult(summary.fuelVehicle);
    renderMaintenanceCostResult(summary.maintenanceCost);
    document.getElementById('priority-title').textContent = summary.priority.name + ' — nível ' + summary.priority.level + '/3';
    document.getElementById('priority-copy').textContent = 'Este é o pilar inicial para aprofundar evidências e organizar a primeira frente de trabalho.';
    document.getElementById('gap-list').innerHTML = summary.gaps.length ? summary.gaps.map(function (gap) {
      return '<div class="recommendation"><strong>' + escapeHtml(gap.pillar) + ' · ' + escapeHtml(gap.classification) +
        '</strong><span>' + escapeHtml(gap.recommendation) + '</span></div>';
    }).join('') : '<p class="muted">Nenhuma lacuna foi indicada; valide as evidências documentais.</p>';
    document.getElementById('strength-list').innerHTML = summary.strengths.length ? summary.strengths.map(function (strength) {
      return '<li>' + escapeHtml(strength) + '</li>';
    }).join('') : '<li>Nenhum controle foi classificado como documentado.</li>';
    document.getElementById('result-disclaimer').textContent = summary.disclaimer;
  }

  function downloadPdf() {
    try {
      var company = companyById(state.diagnostic.company_id);
      var contact = contactForCompany(state.diagnostic.company_id);
      var consultantName = state.profile && state.profile.display_name || 'Consultor RodoCore';
      pdf.downloadReport({
        company: company,
        contact: contact,
        consultantName: consultantName,
        diagnostic: state.diagnostic,
        summary: state.diagnostic.preliminary_summary
      });
      showToast('PDF gerado no seu dispositivo.');
    } catch (error) {
      showSyncError('Não foi possível gerar o PDF neste navegador.');
    }
  }

  async function convertToProject() {
    if (!state.diagnostic || state.diagnostic.status !== 'completed') return;
    var existing = state.projects.find(function (project) { return project.source_diagnostic_id === state.diagnostic.id; });
    if (existing) {
      showView('projects');
      showToast('Este diagnóstico já possui um projeto.');
      return;
    }
    var button = document.getElementById('convert-project-button');
    var company = companyById(state.diagnostic.company_id);
    var summary = state.diagnostic.preliminary_summary || {};
    setBusy(button, true, 'Criando projeto…');
    try {
      var result = await state.client.from('consulting_projects').insert({
        owner_id: state.user.id,
        company_id: state.diagnostic.company_id,
        source_diagnostic_id: state.diagnostic.id,
        name: 'Consultoria — ' + (company.trade_name || company.legal_name),
        status: 'planning',
        objective: summary.priority ? 'Aprofundar o pilar ' + summary.priority.name + ' e validar as evidências do diagnóstico executivo.' : 'Validar as evidências do diagnóstico executivo.'
      }).select().single();
      if (result.error) throw result.error;
      state.projects.unshift(result.data);
      renderDashboard();
      renderProjects();
      showView('projects');
      showToast('Projeto criado em planejamento.');
    } catch (error) {
      showSyncError(friendlyError(error));
    } finally {
      setBusy(button, false);
    }
  }

  function bindEvents() {
    document.getElementById('login-mode').addEventListener('click', function () { setAuthMode('login'); });
    document.getElementById('signup-mode').addEventListener('click', function () { setAuthMode('signup'); });
    elements.authForm.addEventListener('submit', handleAuthSubmit);
    document.getElementById('signout-button').addEventListener('click', async function () {
      await state.client.auth.signOut();
      state.diagnostic = null;
      state.answers = {};
    });
    elements.menuButton.addEventListener('click', function () {
      var open = elements.sidebar.classList.toggle('open');
      elements.menuButton.setAttribute('aria-expanded', String(open));
    });
    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.addEventListener('click', function () {
        if (item.dataset.view === 'company') openCompanyForm(companyById(state.companyId));
        else showView(item.dataset.view);
      });
    });
    document.querySelectorAll('[data-view-button]').forEach(function (button) {
      button.addEventListener('click', function () { showView(button.dataset.viewButton); });
    });
    document.querySelectorAll('[data-open-company]').forEach(function (button) {
      button.addEventListener('click', function () { openCompanyForm(null); });
    });
    elements.companySelector.addEventListener('change', function () {
      state.companyId = elements.companySelector.value;
    });
    elements.companyForm.addEventListener('submit', handleCompanySubmit);
    document.getElementById('new-diagnostic-button').addEventListener('click', createDiagnostic);
    document.getElementById('diagnostic-list').addEventListener('click', function (event) {
      var button = event.target.closest('[data-open-diagnostic]');
      if (button) openDiagnostic(button.dataset.openDiagnostic);
    });
    document.getElementById('pillar-tabs').addEventListener('click', function (event) {
      var button = event.target.closest('[data-pillar-index]');
      if (!button) return;
      state.pillarIndex = Number(button.dataset.pillarIndex);
      renderDiagnostic();
      queueAutosave();
    });
    elements.diagnosticForm.addEventListener('click', function (event) {
      var addButton = event.target.closest('[data-add-fuel-vehicle]');
      var removeButton = event.target.closest('[data-remove-fuel-vehicle]');
      var addMaintenanceButton = event.target.closest('[data-add-maintenance-vehicle]');
      var removeMaintenanceButton = event.target.closest('[data-remove-maintenance-vehicle]');
      if (!addButton && !removeButton && !addMaintenanceButton && !removeMaintenanceButton) return;
      var answerKey = addMaintenanceButton || removeMaintenanceButton ? 'maintenance_cost' : 'fuel_vehicle';
      state.answers[answerKey] = state.answers[answerKey] || { classification: '', notes: '', details: {} };
      state.answers[answerKey].details = state.answers[answerKey].details || {};
      var vehicles = Array.isArray(state.answers[answerKey].details.vehicles)
        ? state.answers[answerKey].details.vehicles : [];
      if ((addButton || addMaintenanceButton) && vehicles.length < 200) vehicles.push({});
      if (removeButton) vehicles.splice(Number(removeButton.dataset.removeFuelVehicle), 1);
      if (removeMaintenanceButton) vehicles.splice(Number(removeMaintenanceButton.dataset.removeMaintenanceVehicle), 1);
      state.answers[answerKey].details.vehicles = vehicles;
      renderQuestions();
      queueAutosave();
    });
    elements.diagnosticForm.addEventListener('input', function (event) {
      var key = event.target.dataset.questionKey || event.target.dataset.questionNotes || event.target.dataset.questionDetail;
      if (!key) {
        if (event.target === elements.generalNotes) {
          state.diagnostic.general_notes = elements.generalNotes.value;
          queueAutosave();
        }
        return;
      }
      state.answers[key] = state.answers[key] || { classification: '', notes: '', details: {} };
      if (event.target.dataset.questionKey) {
        state.answers[key].classification = event.target.value;
        var controlsConditional = model.QUESTIONS.some(function (question) {
          return question.condition && question.condition.key === key;
        });
        if (controlsConditional || key === 'fuel_spend' || key === 'maintenance_cost') {
          renderPillarTabs();
          renderQuestions();
        } else {
          renderPillarTabs();
        }
      } else if (event.target.dataset.questionNotes) {
        state.answers[key].notes = event.target.value;
      } else {
        state.answers[key].details = state.answers[key].details || {};
        var details = state.answers[key].details;
        var group = event.target.dataset.detailGroup;
        var field = event.target.dataset.detailField;
        var vehicleIndex = event.target.dataset.vehicleIndex;
        var vehicleField = event.target.dataset.vehicleField;
        if (vehicleIndex !== undefined && vehicleField) {
          details.vehicles = Array.isArray(details.vehicles) ? details.vehicles : [];
          details.vehicles[Number(vehicleIndex)] = details.vehicles[Number(vehicleIndex)] || {};
          details.vehicles[Number(vehicleIndex)][vehicleField] = event.target.type === 'number'
            ? (event.target.value === '' ? '' : Number(event.target.value))
            : event.target.value;
        } else if (group) {
          var selected = Array.isArray(details[group]) ? details[group].slice() : [];
          var optionIndex = selected.indexOf(event.target.value);
          if (event.target.checked && optionIndex === -1) selected.push(event.target.value);
          if (!event.target.checked && optionIndex !== -1) selected.splice(optionIndex, 1);
          details[group] = selected;
        } else if (field) {
          details[field] = event.target.type === 'number'
            ? (event.target.value === '' ? '' : Number(event.target.value))
            : event.target.value;
        }
        updateFuelSpendCalculations();
        updateFuelVehicleCalculations();
        updateMaintenanceCostCalculations();
      }
      queueAutosave();
    });
    document.getElementById('previous-pillar').addEventListener('click', async function () {
      try { await saveDraft(); } catch (error) { elements.diagnosticMessage.textContent = friendlyError(error); return; }
      if (state.pillarIndex > 0) state.pillarIndex -= 1;
      renderDiagnostic();
    });
    document.getElementById('next-pillar').addEventListener('click', goNext);
    document.getElementById('download-pdf-button').addEventListener('click', downloadPdf);
    document.getElementById('convert-project-button').addEventListener('click', convertToProject);
  }

  async function initialize() {
    bindEvents();
    setAuthMode('login');
    var configured = /^https:\/\/.+\.supabase\.co$/i.test(config.supabaseUrl || '') &&
      cleanText(config.supabaseAnonKey).length > 20;
    if (!configured || !window.supabase || !model || !pdf) {
      showAuth();
      elements.authMessage.textContent = 'A configuração pública do Supabase ou uma dependência do aplicativo não foi carregada.';
      elements.authSubmit.disabled = true;
      return;
    }
    state.client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    state.client.auth.onAuthStateChange(function (_event, session) {
      setTimeout(function () { handleSession(session); }, 0);
    });
    var sessionResult = await state.client.auth.getSession();
    if (sessionResult.error) {
      showAuth();
      elements.authMessage.textContent = friendlyError(sessionResult.error);
      return;
    }
    await handleSession(sessionResult.data.session);
  }

  initialize();
}());
