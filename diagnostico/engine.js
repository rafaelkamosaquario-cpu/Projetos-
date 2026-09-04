(function (factory) {
  'use strict';

  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.RodoCoreEngine = api;
  }
}(function () {
  'use strict';

  var LEVELS = {
    0: {
      label: 'Sem base confiável',
      description: 'Não conhece ou não registra os dados essenciais deste pilar.'
    },
    1: {
      label: 'Visibilidade parcial',
      description: 'Conhece totais ou trabalha principalmente com estimativas.'
    },
    2: {
      label: 'Controle registrado',
      description: 'Registra por veículo ou item, mas ainda analisa com pouca regularidade.'
    },
    3: {
      label: 'Gestão ativa',
      description: 'Registra, compara, possui responsável e transforma desvios em ação.'
    }
  };

  function item(score, classification, controlled, estimate, attention) {
    return {
      score: score,
      classification: classification,
      controlled: controlled || '',
      estimate: estimate || '',
      attention: attention || ''
    };
  }

  function fourLevel(controlledAtThree, controlledAtTwo, estimateAtOne, attentionAtZero, attentionAtOne) {
    return {
      managed: item(3, 'D', controlledAtThree),
      compare_action: item(3, 'D', controlledAtThree),
      systematic: item(3, 'D', controlledAtThree),
      evidence: item(3, 'D', controlledAtThree),
      complete: item(3, 'D', controlledAtThree),
      recorded: item(2, 'D', controlledAtTwo || controlledAtThree),
      scheduled: item(2, 'D', controlledAtTwo || controlledAtThree),
      comparison: item(2, 'D', controlledAtTwo || controlledAtThree),
      basic: item(2, 'D', controlledAtTwo || controlledAtThree),
      partial: item(1, 'E', '', estimateAtOne, attentionAtOne || attentionAtZero),
      informal: item(1, 'E', '', estimateAtOne, attentionAtOne || attentionAtZero),
      general_estimate: item(1, 'E', '', estimateAtOne, attentionAtOne || attentionAtZero),
      single_total: item(1, 'E', '', estimateAtOne, attentionAtOne || attentionAtZero),
      price_mixed: item(1, 'E', '', estimateAtOne, attentionAtOne || attentionAtZero),
      none: item(0, 'N', '', '', attentionAtZero),
      unknown: item(0, 'N', '', '', attentionAtZero),
      price_only: item(0, 'N', '', '', attentionAtZero),
      na: item(null, 'NA')
    };
  }

  var RULES = {
    fuel_reference_quality: {
      documented: item(2, 'D', 'Referência mensal de combustível apoiada em relatório ou documento.'),
      estimated: item(1, 'E', '', 'Gasto ou volume mensal de combustível informado por estimativa.', 'Confirmar gasto ou volume mensal de combustível em fonte documental.'),
      unknown: item(0, 'N', '', '', 'Levantar gasto ou volume mensal de combustível antes de comparar consumo.'),
      na: item(null, 'NA')
    },
    fleet_efficiency_quality: {
      documented: item(2, 'D', 'Média geral de consumo calculada a partir de registros.'),
      estimated: item(1, 'E', '', 'Média geral de consumo ainda estimada ou apenas informada.', 'Validar a média geral de consumo com abastecimentos e quilometragem.'),
      unknown: item(0, 'N', '', '', 'Calcular uma média geral de consumo com base confiável.'),
      na: item(null, 'NA')
    },
    fuel_vehicle_average: fourLevel(
      'Média por veículo comparada e usada para tratar desvios.',
      'Média por veículo registrada.',
      'Consumo conhecido apenas no total ou por estimativa.',
      'Criar uma referência de consumo por veículo.',
      'Separar a média geral por veículo para localizar diferenças.'
    ),
    fuel_plate_control: fourLevel(
      'Abastecimentos por placa comparados e tratados.',
      'Abastecimentos registrados por placa.',
      'Controle de abastecimento parcial, geral ou manual.',
      'Implantar controle de abastecimento por placa.',
      'Consolidar o controle por placa em uma base analisável.'
    ),
    fuel_investigation: {
      systematic: item(3, 'D', 'Diferenças de consumo investigadas por veículo, rota, carga e fatores operacionais.'),
      occasional: item(2, 'D', 'Diferenças de consumo são investigadas, ainda sem rotina fixa.', '', 'Definir frequência, responsável e registro para investigar diferenças de consumo.'),
      informal: item(1, 'E', '', 'Investigação de consumo depende de percepção informal.', 'Formalizar a investigação de consumo considerando veículo, rota, carga e motorista.'),
      none: item(0, 'N', '', '', 'Investigar diferenças de consumo antes de concluir que existe desvio.'),
      na: item(null, 'NA')
    },
    maintenance_cost_quality: {
      documented: item(2, 'D', 'Gasto mensal de manutenção apoiado em relatório ou documento.'),
      estimated: item(1, 'E', '', 'Gasto mensal de manutenção informado por estimativa.', 'Consolidar o gasto mensal de manutenção em fonte documental.'),
      unknown: item(0, 'N', '', '', 'Levantar o gasto mensal de manutenção e sua composição.'),
      na: item(null, 'NA')
    },
    maintenance_by_plate: fourLevel(
      'Gastos de manutenção por placa comparados e tratados.',
      'Gastos de manutenção registrados por placa.',
      'Manutenção conhecida apenas no total ou por estimativa.',
      'Separar os gastos de manutenção por placa.',
      'Transformar o total geral em histórico por placa.'
    ),
    maintenance_categories: fourLevel(
      'Gastos classificados por natureza, incluindo retrabalho e garantia.',
      'Preventiva e corretiva diferenciadas.',
      'Classificação de manutenção incompleta ou apenas total.',
      'Classificar manutenção por natureza para não misturar causas diferentes.',
      'Ampliar a classificação além do total ou das categorias básicas.'
    ),
    maintenance_plan: fourLevel(
      'Plano preventivo com agenda, responsável e revisão.',
      'Plano preventivo programado.',
      'Plano preventivo parcial ou dependente de lembrança.',
      'Estruturar um plano preventivo por veículo.',
      'Formalizar o plano preventivo com agenda e responsável.'
    ),
    maintenance_downtime: fourLevel(
      'Tempo parado medido, comparado e tratado por causa.',
      'Tempo de veículo parado registrado.',
      'Tempo parado acompanhado informalmente.',
      'Começar a registrar início, fim e causa de cada parada.',
      'Substituir o acompanhamento informal por registro de tempo parado.'
    ),
    maintenance_supplier_control: fourLevel(
      'Fornecedor, orçamento e garantia comparados e acompanhados.',
      'Fornecedor, orçamento e garantia registrados.',
      'Controle parcial de fornecedor, orçamento ou garantia.',
      'Registrar fornecedor, orçamento aprovado e garantia de cada serviço.',
      'Completar o controle de fornecedor, orçamento e garantia.'
    ),
    tires_cost_quality: {
      documented: item(2, 'D', 'Gasto com pneus, recapagens e serviços apoiado em documento.'),
      estimated: item(1, 'E', '', 'Gasto mensal com pneus ainda estimado.', 'Consolidar pneus, recapagens e serviços em uma fonte documental.'),
      unknown: item(0, 'N', '', '', 'Levantar o gasto com pneus, recapagens e serviços.'),
      na: item(null, 'NA')
    },
    tires_individual_id: fourLevel(
      'Pneus identificados individualmente, com histórico analisado.',
      'Pneus identificados individualmente.',
      'Identificação parcial ou baseada em anotações.',
      'Criar identificação individual para cada pneu.',
      'Completar a identificação individual dos pneus.'
    ),
    tires_metrics: fourLevel(
      'Quilometragem, vida e CPK dos pneus comparados e usados na decisão.',
      'Quilometragem, vida e CPK dos pneus registrados.',
      'Indicadores de pneus conhecidos apenas parcialmente ou por estimativa.',
      'Medir quilometragem, vida e CPK de cada pneu.',
      'Completar a medição de quilometragem, vida e CPK.'
    ),
    tires_routines: fourLevel(
      'Calibragem, rodízio, alinhamento e inspeção seguem agenda verificada.',
      'Rotinas de pneus registradas.',
      'Somente parte das rotinas de pneus está definida.',
      'Definir rotinas de calibragem, rodízio, alinhamento e inspeção.',
      'Completar e calendarizar as rotinas de pneus.'
    ),
    tires_discards: fourLevel(
      'Descartes registrados, causas comparadas e ações definidas.',
      'Descartes e causas registrados.',
      'Descartes acompanhados por anotação ou memória.',
      'Registrar cada descarte e sua causa.',
      'Formalizar o registro das causas de descarte.'
    ),
    tires_purchasing: fourLevel(
      'Pneus e recapagens escolhidos por resultado comprovado e CPK.',
      'Desempenho comparado antes da compra.',
      'Decisão de compra ainda orientada principalmente por preço.',
      'Comparar pneus e recapagens pelo resultado, não somente pelo preço.',
      'Incluir desempenho e CPK na decisão de compra.'
    )
  };

  var PILLARS = [
    {
      key: 'fuel',
      name: 'Combustível',
      fields: ['fuel_reference_quality', 'fleet_efficiency_quality', 'fuel_vehicle_average', 'fuel_plate_control', 'fuel_investigation'],
      fallback: 'Validar uma amostra de abastecimentos, quilometragem e médias por placa.'
    },
    {
      key: 'maintenance',
      name: 'Manutenção',
      fields: ['maintenance_cost_quality', 'maintenance_by_plate', 'maintenance_categories', 'maintenance_plan', 'maintenance_downtime', 'maintenance_supplier_control'],
      fallback: 'Validar ordens de serviço, custos por placa, paradas e garantias.'
    },
    {
      key: 'tires',
      name: 'Pneus',
      fields: ['tires_cost_quality', 'tires_individual_id', 'tires_metrics', 'tires_routines', 'tires_discards', 'tires_purchasing'],
      fallback: 'Validar o histórico individual, descartes, rotinas e CPK dos pneus.'
    }
  ];

  var VISIBILITY = {
    compare_action: {
      level: 3,
      label: LEVELS[3].label,
      description: 'Os dados chegam à placa, são comparados e já orientam ações.'
    },
    by_vehicle: {
      level: 2,
      label: LEVELS[2].label,
      description: 'Há informação por veículo, mas a análise ainda não acontece de forma regular.'
    },
    general_total: {
      level: 1,
      label: LEVELS[1].label,
      description: 'A empresa conhece totais gerais, sem detalhamento suficiente por veículo.'
    },
    estimate: {
      level: 1,
      label: LEVELS[1].label,
      description: 'A visão atual depende principalmente de valores estimados ou informados.'
    },
    unknown: {
      level: 0,
      label: LEVELS[0].label,
      description: 'Ainda não existe uma base disponível para enxergar os custos com segurança.'
    }
  };

  function unique(values) {
    return values.filter(function (value, index, all) {
      return Boolean(value) && all.indexOf(value) === index;
    });
  }

  function levelFromAverage(average) {
    if (average < 0.75) return 0;
    if (average < 1.75) return 1;
    if (average < 2.6) return 2;
    return 3;
  }

  function evaluatePillar(pillar, answers) {
    var selected = pillar.fields.map(function (field) {
      var value = answers[field];
      var rule = RULES[field] && RULES[field][value];
      return rule ? {
        field: field,
        score: rule.score,
        classification: rule.classification,
        controlled: rule.controlled,
        estimate: rule.estimate,
        attention: rule.attention
      } : null;
    }).filter(Boolean);

    var applicable = selected.filter(function (entry) {
      return typeof entry.score === 'number';
    });
    var total = applicable.reduce(function (sum, entry) {
      return sum + entry.score;
    }, 0);
    var average = applicable.length ? total / applicable.length : 0;
    var level = levelFromAverage(average);
    var classifications = { D: 0, E: 0, N: 0, NA: 0 };

    selected.forEach(function (entry) {
      classifications[entry.classification] += 1;
    });

    return {
      key: pillar.key,
      name: pillar.name,
      level: level,
      label: LEVELS[level].label,
      description: LEVELS[level].description,
      average: Number(average.toFixed(2)),
      controlled: unique(selected.map(function (entry) { return entry.controlled; })),
      estimated: unique(selected.map(function (entry) { return entry.estimate; })),
      attention: unique(selected.map(function (entry) { return entry.attention; })),
      classifications: classifications,
      fallback: pillar.fallback
    };
  }

  function evaluate(answers) {
    var safeAnswers = answers || {};
    var pillars = PILLARS.map(function (pillar) {
      return evaluatePillar(pillar, safeAnswers);
    });
    var priority = pillars.slice().sort(function (a, b) {
      if (a.level !== b.level) return a.level - b.level;
      if (a.classifications.N !== b.classifications.N) return b.classifications.N - a.classifications.N;
      return PILLARS.findIndex(function (pillar) { return pillar.key === a.key; }) -
        PILLARS.findIndex(function (pillar) { return pillar.key === b.key; });
    })[0];

    var attention = unique(
      priority.attention.concat(
        pillars.filter(function (pillar) { return pillar.key !== priority.key; })
          .reduce(function (all, pillar) { return all.concat(pillar.attention); }, [])
      )
    ).slice(0, 5);

    PILLARS.forEach(function (pillar) {
      if (attention.length < 3 && attention.indexOf(pillar.fallback) === -1) {
        attention.push(pillar.fallback);
      }
    });

    var controlled = unique(pillars.reduce(function (all, pillar) {
      return all.concat(pillar.controlled.map(function (message) {
        return pillar.name + ': ' + message;
      }));
    }, [])).slice(0, 6);

    var estimated = unique(pillars.reduce(function (all, pillar) {
      return all.concat(pillar.estimated.map(function (message) {
        return pillar.name + ': ' + message;
      }));
    }, [])).slice(0, 6);

    if (!controlled.length) {
      controlled.push('Nenhum controle documentado foi identificado nas respostas.');
    }
    if (!estimated.length) {
      estimated.push('Nenhuma resposta foi classificada como estimativa; confirme os documentos na etapa executiva.');
    }

    var visibility = VISIBILITY[safeAnswers.data_granularity] || VISIBILITY.unknown;
    var reason = priority.attention[0] || priority.fallback;

    return {
      visibility: visibility,
      pillars: pillars,
      controlled: controlled,
      estimated: estimated,
      attention: attention.slice(0, 5),
      priority: {
        key: priority.key,
        name: priority.name,
        level: priority.level,
        reason: reason
      },
      preliminary: true
    };
  }

  return {
    LEVELS: LEVELS,
    RULES: RULES,
    evaluate: evaluate,
    levelFromAverage: levelFromAverage
  };
}));
