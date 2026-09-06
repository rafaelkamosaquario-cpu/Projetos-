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
        state.answers[row.question_key] = { classification: row.classification, notes: row.notes || '' };
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
      return '<fieldset class="question-card" data-question-card="' + escapeHtml(question.key) + '"><legend>' +
        String(questionIndex + 1).padStart(2, '0') + '. ' + escapeHtml(question.title) + '</legend><p class="question-help">' +
        escapeHtml(question.help) + '</p><div class="answer-options">' + options + '</div><details class="question-notes"' +
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

  function renderResult(diagnostic) {
    var summary = diagnostic.preliminary_summary && diagnostic.preliminary_summary.pillars ? diagnostic.preliminary_summary : model.evaluate(state.answers);
    var company = companyById(diagnostic.company_id);
    document.getElementById('result-company-name').textContent = (company ? company.trade_name || company.legal_name : 'Empresa') + ' • ' + formatDate(diagnostic.completed_at);
    document.getElementById('maturity-grid').innerHTML = summary.pillars.map(function (pillar) {
      return '<article class="maturity-card"><div class="maturity-top"><h2>' + escapeHtml(pillar.name) + '</h2><strong class="maturity-score">' +
        pillar.level + '/3</strong></div><div class="maturity-bar"><span style="width:' + ((pillar.level / 3) * 100) + '%"></span></div><p><strong>' +
        escapeHtml(pillar.label) + '</strong><br>' + escapeHtml(pillar.description) + '</p></article>';
    }).join('');
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
    elements.diagnosticForm.addEventListener('input', function (event) {
      var key = event.target.dataset.questionKey || event.target.dataset.questionNotes;
      if (!key) {
        if (event.target === elements.generalNotes) {
          state.diagnostic.general_notes = elements.generalNotes.value;
          queueAutosave();
        }
        return;
      }
      state.answers[key] = state.answers[key] || { classification: '', notes: '' };
      if (event.target.dataset.questionKey) {
        state.answers[key].classification = event.target.value;
        var controlsConditional = model.QUESTIONS.some(function (question) {
          return question.condition && question.condition.key === key;
        });
        if (controlsConditional) {
          renderPillarTabs();
          renderQuestions();
        } else {
          renderPillarTabs();
        }
      } else {
        state.answers[key].notes = event.target.value;
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
