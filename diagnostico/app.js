(function () {
  'use strict';

  var STORAGE_KEY = 'rodocore-diagnostico-draft-v2';
  var TOTAL_STEPS = 4;
  var currentStep = 1;
  var latestResult = null;
  var saveTimer = null;

  var form = document.getElementById('diagnostic-form');
  var contactForm = document.getElementById('contact-form');
  var errorBox = document.getElementById('form-error');
  var progressFill = document.getElementById('progress-fill');
  var progressTrack = document.getElementById('progress-track');
  var stepLabel = document.getElementById('step-label');
  var saveStatus = document.getElementById('save-status');
  var previousButton = document.getElementById('previous-button');
  var nextButton = document.getElementById('next-button');
  var draftBanner = document.getElementById('draft-banner');
  var integrationNote = document.getElementById('integration-note');
  var contactSubmit = document.getElementById('contact-submit');

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function (screen) {
      screen.classList.toggle('active', screen.id === id);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function collectAnswers() {
    var answers = {};
    new FormData(form).forEach(function (value, key) {
      answers[key] = String(value);
    });
    return answers;
  }

  function fillForm(answers) {
    Object.keys(answers || {}).forEach(function (name) {
      var controls = form.elements.namedItem(name);
      if (!controls) return;

      if (typeof controls.length === 'number' && !controls.tagName) {
        Array.prototype.forEach.call(controls, function (control) {
          control.checked = control.value === String(answers[name]);
        });
      } else {
        controls.value = String(answers[name]);
      }
    });
    updateConditionalFields();
  }

  function readDraft() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed.version !== 2 || !parsed.answers) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function removeDraft() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      return;
    }
  }

  function saveDraft() {
    window.clearTimeout(saveTimer);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2,
        currentStep: currentStep,
        answers: collectAnswers(),
        savedAt: new Date().toISOString()
      }));
      saveStatus.textContent = 'Rascunho salvo neste dispositivo';
    } catch (error) {
      saveStatus.textContent = 'Não foi possível salvar o rascunho';
    }
  }

  function scheduleSave() {
    saveStatus.textContent = 'Salvando rascunho…';
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveDraft, 180);
  }

  function startCheckup(useDraft) {
    var draft = useDraft ? readDraft() : null;
    form.reset();
    clearErrors();

    if (draft) {
      fillForm(draft.answers);
      currentStep = Math.min(Math.max(Number(draft.currentStep) || 1, 1), TOTAL_STEPS);
    } else {
      removeDraft();
      currentStep = 1;
      updateConditionalFields();
    }

    showStep(currentStep);
    showScreen('checkup');
  }

  function showStep(step) {
    currentStep = Math.min(Math.max(step, 1), TOTAL_STEPS);
    form.querySelectorAll('.form-step').forEach(function (section) {
      var active = Number(section.dataset.step) === currentStep;
      section.hidden = !active;
      section.classList.toggle('active', active);
    });

    var progress = currentStep / TOTAL_STEPS * 100;
    progressFill.style.width = progress + '%';
    progressTrack.setAttribute('aria-valuenow', String(currentStep));
    stepLabel.textContent = 'Etapa ' + currentStep + ' de ' + TOTAL_STEPS;
    previousButton.textContent = currentStep === 1 ? '← Início' : '← Voltar';
    nextButton.textContent = currentStep === TOTAL_STEPS ? 'Ver resultado →' : 'Continuar →';
    clearErrors();

    var heading = form.querySelector('.form-step[data-step="' + currentStep + '"] h2');
    if (heading) {
      heading.tabIndex = -1;
      window.setTimeout(function () {
        heading.focus({ preventScroll: true });
      }, 0);
    }
  }

  function clearErrors() {
    errorBox.hidden = true;
    errorBox.textContent = '';
    form.querySelectorAll('[aria-invalid="true"]').forEach(function (control) {
      control.removeAttribute('aria-invalid');
    });
  }

  function showFieldError(control, message) {
    control.setAttribute('aria-invalid', 'true');
    errorBox.textContent = message;
    errorBox.hidden = false;
    control.focus();
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return false;
  }

  function firstRadioInGroup(section, name) {
    return section.querySelector('input[type="radio"][name="' + name + '"]');
  }

  function validateStep(step) {
    clearErrors();
    var section = form.querySelector('.form-step[data-step="' + step + '"]');
    var processedGroups = {};
    var requiredControls = Array.prototype.slice.call(section.querySelectorAll('[required]'));

    for (var fieldIndex = 0; fieldIndex < requiredControls.length; fieldIndex += 1) {
      var field = requiredControls[fieldIndex];
      if (field.disabled) continue;

      if (field.type === 'radio') {
        if (processedGroups[field.name]) continue;
        processedGroups[field.name] = true;
        if (!section.querySelector('input[name="' + field.name + '"]:checked')) {
          return showFieldError(firstRadioInGroup(section, field.name), 'Responda a pergunta destacada antes de continuar.');
        }
        continue;
      }

      if (!field.value.trim()) {
        return showFieldError(field, 'Preencha "' + field.closest('.field').querySelector('label').textContent.trim() + '".');
      }
      if (!field.checkValidity()) {
        return showFieldError(field, 'Revise o valor informado em "' + field.closest('.field').querySelector('label').textContent.trim() + '".');
      }
    }

    var numericFields = Array.prototype.slice.call(section.querySelectorAll('input[type="number"]:not(:disabled)'));
    for (var numberIndex = 0; numberIndex < numericFields.length; numberIndex += 1) {
      var numeric = numericFields[numberIndex];
      if (numeric.value && !numeric.checkValidity()) {
        return showFieldError(numeric, 'O número informado está fora do intervalo aceito.');
      }
    }

    if (step === 2) {
      var referenceKind = form.elements.fuel_reference_kind.value;
      var fuelQuality = form.elements.fuel_reference_quality.value;
      var efficiencyQuality = form.elements.fleet_efficiency_quality.value;
      if ((referenceKind === 'cost' || referenceKind === 'volume') && (fuelQuality === 'documented' || fuelQuality === 'estimated') && !positiveNumber('fuel_monthly_value')) {
        return showFieldError(form.elements.fuel_monthly_value, 'Informe um valor mensal maior que zero ou marque o dado como não disponível.');
      }
      if ((efficiencyQuality === 'documented' || efficiencyQuality === 'estimated') && !positiveNumber('fleet_efficiency')) {
        return showFieldError(form.elements.fleet_efficiency, 'Informe a média geral ou marque que ela não está disponível.');
      }
    }

    if (step === 3 && needsValue('maintenance_cost_quality') && !positiveNumber('maintenance_monthly_cost')) {
      return showFieldError(form.elements.maintenance_monthly_cost, 'Informe o gasto mensal ou marque que ele não está disponível.');
    }

    if (step === 4 && needsValue('tires_cost_quality') && !positiveNumber('tires_monthly_cost')) {
      return showFieldError(form.elements.tires_monthly_cost, 'Informe o gasto mensal ou marque que ele não está disponível.');
    }

    return true;
  }

  function positiveNumber(name) {
    var control = form.elements[name];
    return control && Number(control.value) > 0 && control.checkValidity();
  }

  function needsValue(qualityName) {
    var value = form.elements[qualityName].value;
    return value === 'documented' || value === 'estimated';
  }

  function updateConditionalFields() {
    var kind = form.elements.fuel_reference_kind.value;
    var fuelValue = form.elements.fuel_monthly_value;
    var fuelQuality = form.elements.fuel_reference_quality;
    var unit = document.getElementById('fuel-value-unit');
    var fuelValueField = document.getElementById('fuel-value-field');
    var referenceUnavailable = kind === 'unknown' || kind === 'na' || kind === '';

    unit.textContent = kind === 'volume' ? 'litros' : 'R$';
    fuelValue.disabled = referenceUnavailable;
    fuelValueField.classList.toggle('disabled', referenceUnavailable);
    if (referenceUnavailable) fuelValue.value = '';

    if (kind === 'unknown') fuelQuality.value = 'unknown';
    if (kind === 'na') fuelQuality.value = 'na';

    toggleNumberByQuality('fleet_efficiency', 'fleet_efficiency_quality');
    toggleNumberByQuality('maintenance_monthly_cost', 'maintenance_cost_quality');
    toggleNumberByQuality('tires_monthly_cost', 'tires_cost_quality');
  }

  function toggleNumberByQuality(numberName, qualityName) {
    var numberControl = form.elements[numberName];
    var quality = form.elements[qualityName].value;
    var disabled = quality === 'unknown' || quality === 'na';
    numberControl.disabled = disabled;
    numberControl.closest('.field').classList.toggle('disabled', disabled);
    if (disabled) numberControl.value = '';
  }

  function nextStep() {
    if (!validateStep(currentStep)) return;
    saveDraft();

    if (currentStep < TOTAL_STEPS) {
      showStep(currentStep + 1);
      return;
    }

    latestResult = window.RodoCoreEngine.evaluate(collectAnswers());
    renderResult(latestResult, collectAnswers());
    showScreen('result');
  }

  function previousStep() {
    saveDraft();
    if (currentStep === 1) {
      showScreen('landing');
      refreshDraftBanner();
      return;
    }
    showStep(currentStep - 1);
  }

  function createTextElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function renderResult(result, answers) {
    document.getElementById('result-profile').textContent =
      (answers.fleet_type || 'Frota') + ' · ' +
      (answers.vehicle_count || '—') + ' veículos · ' +
      (answers.route_profile || 'rota não informada') + ' · ' +
      (answers.cargo_type || 'operação não informada');

    document.getElementById('visibility-level').textContent = result.visibility.level + ' — ' + result.visibility.label;
    document.getElementById('visibility-description').textContent = result.visibility.description;

    var maturityGrid = document.getElementById('maturity-grid');
    maturityGrid.replaceChildren();
    result.pillars.forEach(function (pillar) {
      var card = document.createElement('article');
      card.className = 'maturity-card';
      card.dataset.pillar = pillar.key;

      var header = document.createElement('div');
      header.className = 'maturity-card-header';
      var titleGroup = document.createElement('div');
      titleGroup.appendChild(createTextElement('h3', '', pillar.name));
      titleGroup.appendChild(createTextElement('p', '', pillar.label));
      var score = createTextElement('strong', 'maturity-score', String(pillar.level));
      score.appendChild(createTextElement('small', '', ' / 3'));
      header.appendChild(titleGroup);
      header.appendChild(score);

      var meter = document.createElement('div');
      meter.className = 'maturity-meter';
      meter.setAttribute('aria-label', pillar.name + ': nível ' + pillar.level + ' de 3');
      var meterFill = document.createElement('span');
      meterFill.style.width = pillar.level / 3 * 100 + '%';
      meter.appendChild(meterFill);

      card.appendChild(header);
      card.appendChild(meter);
      card.appendChild(createTextElement('p', 'maturity-description', pillar.description));
      maturityGrid.appendChild(card);
    });

    renderList('controlled-list', result.controlled);
    renderList('estimated-list', result.estimated);
    renderList('attention-list', result.attention);

    document.getElementById('priority-pillar').textContent = result.priority.name;
    document.getElementById('priority-level').textContent = String(result.priority.level);
    document.getElementById('priority-reason').textContent = result.priority.reason;

    var levels = result.pillars.map(function (pillar) {
      return pillar.name + ' ' + pillar.level + '/3';
    }).join(', ');
    var message = 'Olá! Concluí o check-up RodoCore (' + levels + ') e gostaria de conversar sobre o Diagnóstico Executivo.';
    document.getElementById('whatsapp-link').href =
      'https://wa.me/5542998582489?text=' + encodeURIComponent(message);

    configureContactState();
  }

  function renderList(id, items) {
    var list = document.getElementById(id);
    list.replaceChildren();
    items.forEach(function (text) {
      list.appendChild(createTextElement('li', '', text));
    });
  }

  function getPublicConfig() {
    var config = window.RODOCORE_CONFIG || {};
    return {
      supabaseUrl: String(config.supabaseUrl || '').replace(/\/+$/, ''),
      supabaseAnonKey: String(config.supabaseAnonKey || ''),
      leadsTable: /^[a-z][a-z0-9_]*$/.test(String(config.leadsTable || '')) ? String(config.leadsTable) : 'public_diagnostic_leads'
    };
  }

  function isSupabaseConfigured() {
    var config = getPublicConfig();
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl) &&
      config.supabaseAnonKey.length > 20;
  }

  function configureContactState() {
    var configured = isSupabaseConfigured();
    integrationNote.hidden = configured;
    integrationNote.textContent = configured ? '' :
      'A gravação online ainda não está configurada. Nenhum dado será enviado por este formulário; use o atendimento direto pelo WhatsApp.';
    contactSubmit.disabled = !configured;
    contactSubmit.textContent = configured ? 'Solicitar contato' : 'Conexão ainda não disponível';
  }

  function validateContact() {
    var name = contactForm.elements.contact_name;
    var company = contactForm.elements.contact_company;
    var whatsapp = contactForm.elements.contact_whatsapp;
    var consent = contactForm.elements.contact_consent;
    var status = document.getElementById('contact-status');

    [name, company, whatsapp, consent].forEach(function (control) {
      control.removeAttribute('aria-invalid');
    });

    if (name.value.trim().length < 2) {
      return contactError(name, 'Informe seu nome.');
    }
    if (company.value.trim().length < 2) {
      return contactError(company, 'Informe a empresa.');
    }

    var digits = whatsapp.value.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) {
      return contactError(whatsapp, 'Informe um WhatsApp válido, com DDD.');
    }
    if (!consent.checked) {
      return contactError(consent, 'O consentimento é necessário para gravar e usar os dados de contato.');
    }

    status.textContent = '';
    status.className = 'contact-status';
    return true;
  }

  function contactError(control, message) {
    var status = document.getElementById('contact-status');
    control.setAttribute('aria-invalid', 'true');
    status.textContent = message;
    status.className = 'contact-status error';
    control.focus();
    return false;
  }

  async function submitContact(event) {
    event.preventDefault();
    if (!isSupabaseConfigured()) {
      document.getElementById('contact-status').textContent =
        'Seus dados não foram enviados. A conexão ainda não está configurada.';
      document.getElementById('contact-status').className = 'contact-status error';
      return;
    }
    if (!validateContact()) return;

    var config = getPublicConfig();
    var answers = collectAnswers();
    var status = document.getElementById('contact-status');
    contactSubmit.disabled = true;
    contactSubmit.textContent = 'Enviando com segurança…';
    status.textContent = '';
    status.className = 'contact-status';

    var payload = {
      name: contactForm.elements.contact_name.value.trim(),
      company: contactForm.elements.contact_company.value.trim(),
      whatsapp: contactForm.elements.contact_whatsapp.value.replace(/\D/g, ''),
      consent_at: new Date().toISOString(),
      consent_text_version: '2026-08-31-v1',
      source_path: window.location.pathname,
      fleet_type: answers.fleet_type || null,
      vehicle_count: answers.vehicle_count ? Number(answers.vehicle_count) : null,
      visibility_level: latestResult.visibility.level,
      fuel_maturity: latestResult.pillars[0].level,
      maintenance_maturity: latestResult.pillars[1].level,
      tires_maturity: latestResult.pillars[2].level,
      priority_pillar: latestResult.priority.name
    };

    try {
      var response = await window.fetch(
        config.supabaseUrl + '/rest/v1/' + encodeURIComponent(config.leadsTable),
        {
          method: 'POST',
          headers: {
            apikey: config.supabaseAnonKey,
            Authorization: 'Bearer ' + config.supabaseAnonKey,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) throw new Error('contact_insert_failed');

      status.textContent = 'Solicitação registrada com sucesso. A RodoCore poderá responder pelo WhatsApp informado.';
      status.className = 'contact-status success';
      contactForm.reset();
      contactSubmit.textContent = 'Solicitação registrada';
    } catch (error) {
      status.textContent = 'Não foi possível gravar a solicitação. Seus dados não foram salvos; use o atendimento direto pelo WhatsApp.';
      status.className = 'contact-status error';
      contactSubmit.disabled = false;
      contactSubmit.textContent = 'Tentar novamente';
    }
  }

  function formatWhatsapp(event) {
    var digits = event.target.value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) {
      event.target.value = digits;
      return;
    }
    if (digits.length <= 7) {
      event.target.value = '(' + digits.slice(0, 2) + ') ' + digits.slice(2);
      return;
    }
    var split = digits.length === 11 ? 7 : 6;
    event.target.value = '(' + digits.slice(0, 2) + ') ' + digits.slice(2, split) + '-' + digits.slice(split);
  }

  function refreshDraftBanner() {
    var draft = readDraft();
    draftBanner.hidden = !draft;
    document.getElementById('start-button').textContent = draft ? 'Iniciar novo check-up' : 'Iniciar check-up';
  }

  function restartCheckup() {
    removeDraft();
    form.reset();
    contactForm.reset();
    latestResult = null;
    currentStep = 1;
    updateConditionalFields();
    showScreen('landing');
    refreshDraftBanner();
  }

  form.addEventListener('input', scheduleSave);
  form.addEventListener('change', function () {
    updateConditionalFields();
    scheduleSave();
  });
  nextButton.addEventListener('click', nextStep);
  previousButton.addEventListener('click', previousStep);
  contactForm.addEventListener('submit', submitContact);
  contactForm.elements.contact_whatsapp.addEventListener('input', formatWhatsapp);

  document.getElementById('start-button').addEventListener('click', function () {
    startCheckup(false);
  });
  document.getElementById('resume-button').addEventListener('click', function () {
    startCheckup(true);
  });
  document.getElementById('discard-button').addEventListener('click', function () {
    removeDraft();
    refreshDraftBanner();
  });
  document.getElementById('edit-button').addEventListener('click', function () {
    showScreen('checkup');
    showStep(TOTAL_STEPS);
  });
  document.getElementById('print-button').addEventListener('click', function () {
    window.print();
  });
  document.getElementById('restart-button').addEventListener('click', restartCheckup);

  updateConditionalFields();
  configureContactState();
  refreshDraftBanner();
}());
