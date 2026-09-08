(function (factory) {
  'use strict';

  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.RodoCoreConsultingModel = api;
  }
}(function () {
  'use strict';

  var CLASSIFICATIONS = {
    D: { label: 'Documentado', short: 'D', score: 3, tone: 'documented' },
    E: { label: 'Estimado', short: 'E', score: 1, tone: 'estimated' },
    N: { label: 'Não controla', short: 'N', score: 0, tone: 'missing' },
    NA: { label: 'Não se aplica', short: 'NA', score: null, tone: 'neutral' }
  };

  var LEVELS = {
    0: { label: 'Sem base confiável', description: 'Os registros essenciais ainda não sustentam uma leitura segura.' },
    1: { label: 'Visibilidade parcial', description: 'Há informações, mas parte relevante ainda depende de estimativas.' },
    2: { label: 'Controle estruturado', description: 'Os controles existem e precisam ganhar consistência de análise.' },
    3: { label: 'Gestão ativa', description: 'Os dados são documentados e já orientam decisões operacionais.' }
  };

  var FUEL_SPEND_DETAIL_OPTIONS = {
    fuel_types: ['diesel_s10', 'diesel_s500', 'arla32', 'gasoline', 'ethanol', 'other'],
    data_sources: ['fuel_card', 'erp', 'spreadsheet', 'invoices', 'own_tank', 'other'],
    payment_methods: ['fuel_card', 'bank_slip', 'cash', 'pix', 'bank_transfer', 'other']
  };

  var FUEL_SPEND_DETAIL_ENUMS = {
    six_month_history: ['D', 'E', 'N', 'NA'],
    annual_history: ['D', 'E', 'N', 'NA'],
    values_consolidated: ['yes', 'partial', 'no', 'unknown'],
    internal_station: ['yes', 'no', 'unknown'],
    suppliers_registered: ['yes', 'partial', 'no', 'unknown'],
    cheapest_station_tracked: ['yes', 'partial', 'no', 'unknown']
  };

  var FUEL_SPEND_DETAIL_NUMBERS = [
    'monthly_spend', 'monthly_liters',
    'six_month_spend', 'six_month_liters',
    'annual_spend', 'annual_liters',
    'internal_monthly_liters', 'external_monthly_liters'
  ];

  var FUEL_VEHICLE_DETAIL_OPTIONS = {
    identifier_methods: ['plate', 'internal_code', 'fleet_number'],
    data_sources: ['fuel_card', 'erp', 'spreadsheet', 'invoices', 'own_tank', 'other']
  };

  var FUEL_VEHICLE_DETAIL_ENUMS = {
    generic_entries: ['yes', 'partial', 'no', 'unknown'],
    six_month_history: ['D', 'E', 'N', 'NA'],
    annual_history: ['D', 'E', 'N', 'NA']
  };

  var FUEL_VEHICLE_DETAIL_NUMBERS = [
    'fleet_vehicle_count', 'tracked_vehicle_count', 'total_refuels', 'linked_refuels'
  ];

  var FUEL_VEHICLE_TYPES = ['plate', 'internal_code', 'fleet_number'];

  function safeDetailNumber(value) {
    if (value === '' || value === null || value === undefined) return null;
    var number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 1000000000000) return null;
    return Number(number.toFixed(3));
  }

  function safeDetailText(value, limit) {
    return typeof value === 'string' ? value.trim().slice(0, limit) : '';
  }

  function safeSignedDetailNumber(value) {
    if (value === '' || value === null || value === undefined) return null;
    var number = Number(value);
    if (!Number.isFinite(number) || number < -1000000000000 || number > 1000000000000) return null;
    return Number(number.toFixed(3));
  }

  function normalizeFuelSpendDetails(value) {
    var source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    var details = {};

    FUEL_SPEND_DETAIL_NUMBERS.forEach(function (key) {
      var number = safeDetailNumber(source[key]);
      if (number !== null) details[key] = number;
    });

    Object.keys(FUEL_SPEND_DETAIL_OPTIONS).forEach(function (key) {
      var selected = Array.isArray(source[key]) ? source[key].filter(function (entry) {
        return FUEL_SPEND_DETAIL_OPTIONS[key].indexOf(entry) !== -1;
      }) : [];
      if (selected.length) details[key] = selected.filter(function (entry, index, all) {
        return all.indexOf(entry) === index;
      });
    });

    Object.keys(FUEL_SPEND_DETAIL_ENUMS).forEach(function (key) {
      if (FUEL_SPEND_DETAIL_ENUMS[key].indexOf(source[key]) !== -1) details[key] = source[key];
    });

    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(source.reference_month || '')) {
      details.reference_month = source.reference_month;
    }

    [
      ['fuel_type_other', 120],
      ['data_source_other', 240],
      ['payment_other', 240],
      ['external_stations', 1000]
    ].forEach(function (definition) {
      var text = safeDetailText(source[definition[0]], definition[1]);
      if (text) details[definition[0]] = text;
    });

    return details;
  }

  function normalizeFuelVehicleDetails(value) {
    var source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    var details = {};

    FUEL_VEHICLE_DETAIL_NUMBERS.forEach(function (key) {
      var number = safeDetailNumber(source[key]);
      if (number !== null) details[key] = Math.round(number);
    });

    Object.keys(FUEL_VEHICLE_DETAIL_OPTIONS).forEach(function (key) {
      var selected = Array.isArray(source[key]) ? source[key].filter(function (entry) {
        return FUEL_VEHICLE_DETAIL_OPTIONS[key].indexOf(entry) !== -1;
      }) : [];
      if (selected.length) details[key] = selected.filter(function (entry, index, all) {
        return all.indexOf(entry) === index;
      });
    });

    Object.keys(FUEL_VEHICLE_DETAIL_ENUMS).forEach(function (key) {
      if (FUEL_VEHICLE_DETAIL_ENUMS[key].indexOf(source[key]) !== -1) details[key] = source[key];
    });

    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(source.reference_month || '')) {
      details.reference_month = source.reference_month;
    }

    [
      ['data_source_other', 240],
      ['unassigned_explanation', 2000]
    ].forEach(function (definition) {
      var text = safeDetailText(source[definition[0]], definition[1]);
      if (text) details[definition[0]] = text;
    });

    var vehicles = Array.isArray(source.vehicles) ? source.vehicles.slice(0, 200).map(function (vehicle) {
      var raw = vehicle && typeof vehicle === 'object' && !Array.isArray(vehicle) ? vehicle : {};
      var normalized = {};
      var identifier = safeDetailText(raw.identifier, 64);
      if (identifier) normalized.identifier = identifier;
      if (FUEL_VEHICLE_TYPES.indexOf(raw.identifier_type) !== -1) normalized.identifier_type = raw.identifier_type;
      ['initial_odometer', 'final_odometer', 'refuel_count', 'liters', 'spend'].forEach(function (key) {
        var number = safeDetailNumber(raw[key]);
        if (number !== null) normalized[key] = key === 'refuel_count' ? Math.round(number) : number;
      });
      var adjustment = safeSignedDetailNumber(raw.mileage_adjustment);
      if (adjustment !== null) normalized.mileage_adjustment = adjustment;
      return normalized;
    }).filter(function (vehicle) {
      return Object.keys(vehicle).length > 0;
    }) : [];
    if (vehicles.length) details.vehicles = vehicles;

    return details;
  }

  function normalizeQuestionDetails(questionKey, value) {
    if (questionKey === 'fuel_spend') return normalizeFuelSpendDetails(value);
    if (questionKey === 'fuel_vehicle') return normalizeFuelVehicleDetails(value);
    return {};
  }

  function averagePrice(spend, liters) {
    return typeof spend === 'number' && typeof liters === 'number' && liters > 0
      ? Number((spend / liters).toFixed(4))
      : null;
  }

  function fuelSpendSnapshot(value) {
    var details = normalizeQuestionDetails('fuel_spend', value);
    return Object.assign({}, details, {
      monthly_average_price: averagePrice(details.monthly_spend, details.monthly_liters),
      six_month_average_price: averagePrice(details.six_month_spend, details.six_month_liters),
      annual_average_price: averagePrice(details.annual_spend, details.annual_liters),
      has_data: Object.keys(details).length > 0
    });
  }

  function safeRatio(numerator, denominator, multiplier) {
    return typeof numerator === 'number' && typeof denominator === 'number' && denominator > 0
      ? Number(((numerator / denominator) * (multiplier || 1)).toFixed(2))
      : null;
  }

  function vehicleSnapshot(vehicle) {
    var adjustment = typeof vehicle.mileage_adjustment === 'number' ? vehicle.mileage_adjustment : 0;
    var mileage = typeof vehicle.initial_odometer === 'number' && typeof vehicle.final_odometer === 'number'
      ? vehicle.final_odometer - vehicle.initial_odometer + adjustment
      : null;
    if (typeof mileage === 'number' && mileage < 0) mileage = null;
    return Object.assign({}, vehicle, {
      mileage: mileage === null ? null : Number(mileage.toFixed(3)),
      average_price: averagePrice(vehicle.spend, vehicle.liters),
      consumption_km_l: safeRatio(mileage, vehicle.liters),
      cost_per_km: safeRatio(vehicle.spend, mileage)
    });
  }

  function sumVehicleField(vehicles, field) {
    var values = vehicles.filter(function (vehicle) { return typeof vehicle[field] === 'number'; });
    return values.length ? Number(values.reduce(function (sum, vehicle) { return sum + vehicle[field]; }, 0).toFixed(3)) : null;
  }

  function difference(total, allocated) {
    return typeof total === 'number' && typeof allocated === 'number'
      ? Number((total - allocated).toFixed(3))
      : null;
  }

  function fuelVehicleSnapshot(value, fuelSpendValue) {
    var details = normalizeQuestionDetails('fuel_vehicle', value);
    var fuelSpend = fuelSpendSnapshot(fuelSpendValue);
    var vehicles = (details.vehicles || []).map(vehicleSnapshot);
    var vehicleLiters = sumVehicleField(vehicles, 'liters');
    var vehicleSpend = sumVehicleField(vehicles, 'spend');
    var vehicleMileage = sumVehicleField(vehicles, 'mileage');
    var vehicleRefuels = sumVehicleField(vehicles, 'refuel_count');
    return Object.assign({}, details, {
      reference_month: details.reference_month || fuelSpend.reference_month,
      company_monthly_liters: typeof fuelSpend.monthly_liters === 'number' ? fuelSpend.monthly_liters : null,
      company_monthly_spend: typeof fuelSpend.monthly_spend === 'number' ? fuelSpend.monthly_spend : null,
      vehicle_coverage_percentage: safeRatio(details.tracked_vehicle_count, details.fleet_vehicle_count, 100),
      refuel_traceability_percentage: safeRatio(details.linked_refuels, details.total_refuels, 100),
      vehicles: vehicles,
      registered_vehicle_count: vehicles.length,
      registered_vehicle_liters: vehicleLiters,
      registered_vehicle_spend: vehicleSpend,
      registered_vehicle_mileage: vehicleMileage,
      registered_vehicle_refuels: vehicleRefuels,
      liters_difference: difference(fuelSpend.monthly_liters, vehicleLiters),
      spend_difference: difference(fuelSpend.monthly_spend, vehicleSpend),
      liters_traceability_percentage: safeRatio(vehicleLiters, fuelSpend.monthly_liters, 100),
      spend_traceability_percentage: safeRatio(vehicleSpend, fuelSpend.monthly_spend, 100),
      has_data: Object.keys(details).length > 0
    });
  }

  function question(key, pillar, title, help, recommendation, condition) {
    return {
      key: key,
      pillar: pillar,
      title: title,
      help: help,
      recommendation: recommendation,
      condition: condition || null
    };
  }

  var PILLARS = [
    {
      key: 'fuel',
      name: 'Combustível',
      description: 'Consumo, abastecimentos, desvios e resposta operacional.',
      questions: [
        question('fuel_spend', 'fuel', 'O gasto e o volume mensal de combustível são conhecidos?', 'Considere relatório, cartão, ERP ou documento conciliado.', 'Consolidar gasto e volume mensal em uma fonte verificável.'),
        question('fuel_vehicle', 'fuel', 'Os abastecimentos são controlados por veículo?', 'O registro deve permitir chegar à placa ou ao código interno.', 'Separar os abastecimentos por veículo.'),
        question('fuel_odometer', 'fuel', 'Quilometragem e hodômetro são validados no abastecimento?', 'Verifique se divergências ou saltos recebem tratamento.', 'Implantar validação de hodômetro e registrar divergências.', { key: 'fuel_vehicle', in: ['D', 'E'] }),
        question('fuel_average', 'fuel', 'A média de consumo por veículo é calculada e comparada?', 'Considere período, rota, carga e modelo do veículo.', 'Calcular a média por veículo e estabelecer referências comparáveis.'),
        question('fuel_variance', 'fuel', 'Desvios de consumo geram investigação documentada?', 'A investigação deve registrar causa, responsável e desfecho.', 'Criar uma rotina de investigação dos desvios de consumo.'),
        question('fuel_action', 'fuel', 'As análises de combustível resultam em ações acompanhadas?', 'Considere prazos, responsáveis e verificação do resultado.', 'Vincular os desvios a ações com responsável e prazo.')
      ]
    },
    {
      key: 'maintenance',
      name: 'Manutenção',
      description: 'Histórico, planejamento, paradas, garantias e ações.',
      questions: [
        question('maintenance_cost', 'maintenance', 'O custo de manutenção é conhecido por veículo?', 'Inclua peças, mão de obra, serviços externos e retrabalho.', 'Consolidar custos de manutenção por veículo.'),
        question('maintenance_history', 'maintenance', 'Existe histórico de serviços por veículo?', 'O histórico deve permitir consultar data, serviço, custo e quilometragem.', 'Criar um histórico único de serviços por veículo.'),
        question('maintenance_orders', 'maintenance', 'As ordens de serviço têm abertura e encerramento registrados?', 'Considere motivo, aprovação, execução e aceite.', 'Padronizar abertura, aprovação e encerramento das ordens.', { key: 'maintenance_history', in: ['D', 'E'] }),
        question('maintenance_plan', 'maintenance', 'A manutenção preventiva possui plano e agenda?', 'O plano deve considerar tempo, quilometragem ou horímetro.', 'Estruturar um plano preventivo com agenda e responsável.'),
        question('maintenance_downtime', 'maintenance', 'O tempo parado é medido por causa?', 'Considere início, fim, motivo e impacto operacional.', 'Medir o tempo parado e classificar suas causas.'),
        question('maintenance_action', 'maintenance', 'Falhas repetidas e garantias geram ações acompanhadas?', 'Inclua reincidência, fornecedor, garantia, responsável e prazo.', 'Tratar reincidências e garantias por meio de ações formais.')
      ]
    },
    {
      key: 'tires',
      name: 'Pneus',
      description: 'Identificação, vida útil, rotinas, descartes e custo por quilômetro.',
      questions: [
        question('tires_inventory', 'tires', 'Cada pneu possui identificação individual?', 'Use fogo, etiqueta, chip ou outro código rastreável.', 'Implantar identificação individual e inventário de pneus.'),
        question('tires_mileage', 'tires', 'A quilometragem de cada pneu é acompanhada?', 'Considere montagem, desmontagem, rodízio e recapagem.', 'Registrar a quilometragem em cada movimentação do pneu.', { key: 'tires_inventory', in: ['D', 'E'] }),
        question('tires_pressure', 'tires', 'Calibragem, inspeção e rodízio seguem uma rotina?', 'A rotina deve ter frequência, registro e responsável.', 'Formalizar agenda e evidência das rotinas de pneus.'),
        question('tires_discard', 'tires', 'Descartes e suas causas são registrados?', 'Separe desgaste normal, avaria, falha operacional e sucata precoce.', 'Registrar cada descarte com causa padronizada.'),
        question('tires_cpk', 'tires', 'O custo por quilômetro do pneu é calculado?', 'Considere aquisição, recapagens, serviços e vida total.', 'Calcular CPK para comparar marcas, modelos e recapagens.', { key: 'tires_mileage', in: ['D', 'E'] }),
        question('tires_action', 'tires', 'Os indicadores de pneus orientam compra e ações?', 'Considere CPK, descarte precoce, recapabilidade e fornecedor.', 'Usar desempenho e CPK nas decisões de compra e correção.')
      ]
    },
    {
      key: 'drivers',
      name: 'Operação dos motoristas',
      description: 'Vínculo operacional, comportamento, orientação e tratamento de eventos.',
      questions: [
        question('drivers_code', 'drivers', 'Os motoristas são identificados por código interno?', 'Evite CPF, CNH ou outros dados pessoais desnecessários.', 'Adotar código interno para identificar o motorista na operação.'),
        question('drivers_assignment', 'drivers', 'É possível relacionar motorista, veículo e período?', 'O vínculo deve apoiar a análise operacional sem ampliar dados pessoais.', 'Registrar o vínculo operacional entre motorista, veículo e período.', { key: 'drivers_code', in: ['D', 'E'] }),
        question('drivers_behavior', 'drivers', 'Eventos de condução são acompanhados?', 'Considere excesso, marcha lenta, frenagem, rotação e condução econômica.', 'Definir os eventos de condução que serão acompanhados.'),
        question('drivers_feedback', 'drivers', 'Orientações e devolutivas aos motoristas são registradas?', 'Considere tema, data, responsável e aceite da orientação.', 'Registrar orientações e devolutivas de forma objetiva.'),
        question('drivers_incidents', 'drivers', 'Ocorrências operacionais têm causa e tratamento?', 'Inclua avarias, multas, sinistros e desvios relevantes.', 'Classificar ocorrências e documentar o tratamento.'),
        question('drivers_action', 'drivers', 'Indicadores de condução resultam em ações acompanhadas?', 'As ações devem ter responsável, prazo e verificação.', 'Transformar eventos recorrentes em ações com prazo e responsável.')
      ]
    }
  ];

  var QUESTIONS = PILLARS.reduce(function (all, pillar) {
    return all.concat(pillar.questions);
  }, []);

  function classificationOf(answer) {
    if (typeof answer === 'string') return answer;
    return answer && answer.classification;
  }

  function isVisible(questionDefinition, answers) {
    if (!questionDefinition.condition) return true;
    return questionDefinition.condition.in.indexOf(
      classificationOf((answers || {})[questionDefinition.condition.key])
    ) !== -1;
  }

  function visibleQuestions(answers, pillarKey) {
    return QUESTIONS.filter(function (entry) {
      return (!pillarKey || entry.pillar === pillarKey) && isVisible(entry, answers || {});
    });
  }

  function normalizeAnswers(answers) {
    var safe = answers || {};
    var normalized = {};

    QUESTIONS.forEach(function (entry) {
      var current = safe[entry.key] || {};
      var classification = isVisible(entry, safe) ? classificationOf(current) : 'NA';
      normalized[entry.key] = {
        classification: CLASSIFICATIONS[classification] ? classification : '',
        notes: typeof current.notes === 'string' ? current.notes.trim().slice(0, 4000) : '',
        details: normalizeQuestionDetails(entry.key, current.details),
        conditional: Boolean(entry.condition),
        hidden: !isVisible(entry, safe)
      };
    });

    return normalized;
  }

  function levelFromAverage(average) {
    if (average < 0.75) return 0;
    if (average < 1.75) return 1;
    if (average < 2.6) return 2;
    return 3;
  }

  function evaluatePillar(pillar, normalized) {
    var answers = pillar.questions.map(function (entry) {
      var answer = normalized[entry.key];
      var definition = CLASSIFICATIONS[answer.classification];
      return {
        key: entry.key,
        title: entry.title,
        recommendation: entry.recommendation,
        classification: answer.classification,
        score: definition ? definition.score : null,
        notes: answer.notes,
        details: answer.details,
        hidden: answer.hidden
      };
    });
    var applicable = answers.filter(function (entry) {
      return typeof entry.score === 'number';
    });
    var total = applicable.reduce(function (sum, entry) { return sum + entry.score; }, 0);
    var average = applicable.length ? total / applicable.length : 0;
    var level = levelFromAverage(average);
    var counts = { D: 0, E: 0, N: 0, NA: 0 };

    answers.forEach(function (entry) {
      if (counts[entry.classification] !== undefined) counts[entry.classification] += 1;
    });

    return {
      key: pillar.key,
      name: pillar.name,
      level: level,
      label: LEVELS[level].label,
      description: LEVELS[level].description,
      average: Number(average.toFixed(2)),
      applicableCount: applicable.length,
      counts: counts,
      answers: answers
    };
  }

  function unique(values) {
    return values.filter(function (value, index, all) {
      return Boolean(value) && all.indexOf(value) === index;
    });
  }

  function evaluate(answers) {
    var normalized = normalizeAnswers(answers);
    var pillars = PILLARS.map(function (pillar) {
      return evaluatePillar(pillar, normalized);
    });
    var ranked = pillars.slice().sort(function (left, right) {
      if (left.level !== right.level) return left.level - right.level;
      if (left.average !== right.average) return left.average - right.average;
      return PILLARS.findIndex(function (entry) { return entry.key === left.key; }) -
        PILLARS.findIndex(function (entry) { return entry.key === right.key; });
    });
    var priorityPillar = ranked[0];
    var gaps = [];

    ranked.forEach(function (pillar) {
      pillar.answers.forEach(function (answer) {
        if ((answer.classification === 'N' || answer.classification === 'E') && gaps.length < 5) {
          gaps.push({
            pillar: pillar.name,
            question: answer.title,
            classification: answer.classification,
            recommendation: answer.recommendation
          });
        }
      });
    });

    var strengths = unique(pillars.reduce(function (all, pillar) {
      return all.concat(pillar.answers.filter(function (answer) {
        return answer.classification === 'D';
      }).map(function (answer) {
        return pillar.name + ': ' + answer.title;
      }));
    }, [])).slice(0, 5);

    return {
      preliminary: true,
      generatedAt: new Date().toISOString(),
      levels: LEVELS,
      pillars: pillars,
      priority: {
        key: priorityPillar.key,
        name: priorityPillar.name,
        level: priorityPillar.level,
        label: priorityPillar.label
      },
      strengths: strengths,
      gaps: gaps,
      fuelSpend: fuelSpendSnapshot(normalized.fuel_spend && normalized.fuel_spend.details),
      fuelVehicle: fuelVehicleSnapshot(
        normalized.fuel_vehicle && normalized.fuel_vehicle.details,
        normalized.fuel_spend && normalized.fuel_spend.details
      ),
      disclaimer: 'Conclusão preliminar baseada nas respostas informadas. Evidências e impacto financeiro devem ser validados no projeto de consultoria.'
    };
  }

  function completeness(answers) {
    var visible = visibleQuestions(answers || {});
    var answered = visible.filter(function (entry) {
      return Boolean(CLASSIFICATIONS[classificationOf((answers || {})[entry.key])]);
    });
    return {
      visible: visible.length,
      answered: answered.length,
      missing: visible.filter(function (entry) {
        return !CLASSIFICATIONS[classificationOf((answers || {})[entry.key])];
      }),
      complete: visible.length === answered.length
    };
  }

  function toRows(diagnosticId, ownerId, answers) {
    var normalized = normalizeAnswers(answers);
    return QUESTIONS.map(function (entry) {
      var answer = normalized[entry.key];
      var classification = answer.classification;
      if (!classification) return null;
      return {
        owner_id: ownerId,
        diagnostic_id: diagnosticId,
        pillar: entry.pillar,
        question_key: entry.key,
        classification: classification,
        maturity_score: CLASSIFICATIONS[classification].score,
        answer_payload: {
          question: entry.title,
          conditional: answer.conditional,
          hidden: answer.hidden,
          details: answer.details
        },
        notes: answer.notes || null
      };
    }).filter(Boolean);
  }

  return {
    CLASSIFICATIONS: CLASSIFICATIONS,
    LEVELS: LEVELS,
    PILLARS: PILLARS,
    QUESTIONS: QUESTIONS,
    isVisible: isVisible,
    visibleQuestions: visibleQuestions,
    normalizeAnswers: normalizeAnswers,
    normalizeQuestionDetails: normalizeQuestionDetails,
    fuelSpendSnapshot: fuelSpendSnapshot,
    fuelVehicleSnapshot: fuelVehicleSnapshot,
    levelFromAverage: levelFromAverage,
    evaluate: evaluate,
    completeness: completeness,
    toRows: toRows
  };
}));
