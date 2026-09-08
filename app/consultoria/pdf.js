(function (factory) {
  'use strict';

  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.RodoCoreConsultingPdf = api;
  }
}(function () {
  'use strict';

  var COLORS = {
    navy: [6, 9, 17],
    panel: [16, 25, 39],
    blue: [47, 143, 255],
    green: [46, 204, 113],
    gold: [201, 164, 71],
    text: [31, 39, 51],
    soft: [92, 105, 123],
    pale: [238, 242, 247],
    white: [255, 255, 255]
  };

  function safeText(value, fallback) {
    var text = typeof value === 'string' ? value.trim() : '';
    return text || fallback || '';
  }

  function formatDate(value) {
    var date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) date = new Date();
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(date);
  }

  function fileSafe(value) {
    return safeText(value, 'empresa')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 60) || 'empresa';
  }

  function formatNumber(value, digits) {
    if (value === '' || value === null || value === undefined) return 'não informado';
    var number = Number(value);
    if (!Number.isFinite(number)) return 'não informado';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits === undefined ? 2 : digits
    }).format(number);
  }

  function formatMoney(value) {
    if (value === '' || value === null || value === undefined) return 'não informado';
    var number = Number(value);
    if (!Number.isFinite(number)) return 'não informado';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(number);
  }

  function formatPercent(value) {
    if (value === '' || value === null || value === undefined) return 'não calculado';
    var number = Number(value);
    return Number.isFinite(number) ? formatNumber(number, 2) + '%' : 'não calculado';
  }

  function formatMonth(value) {
    if (!/^\d{4}-\d{2}$/.test(value || '')) return 'não informado';
    var parts = value.split('-');
    return parts[1] + '/' + parts[0];
  }

  function selectedLabels(values, labels, other) {
    var selected = Array.isArray(values) ? values.map(function (value) { return labels[value]; }).filter(Boolean) : [];
    if (safeText(other)) selected.push(safeText(other));
    return selected.length ? selected.join(', ') : 'não informado';
  }

  function buildReportData(input) {
    var source = input || {};
    var summary = source.summary || {};
    return {
      title: 'Diagnóstico Executivo de Gestão de Frota',
      companyName: safeText(source.company && (source.company.trade_name || source.company.legal_name), 'Empresa não informada'),
      legalName: safeText(source.company && source.company.legal_name),
      fleetSize: source.company && source.company.fleet_size ? String(source.company.fleet_size) : 'Não informado',
      contactName: safeText(source.contact && source.contact.full_name, 'Não informado'),
      consultantName: safeText(source.consultantName, 'Consultor RodoCore'),
      completedOn: formatDate(source.diagnostic && (source.diagnostic.completed_at || source.diagnostic.updated_at)),
      diagnosticTitle: safeText(source.diagnostic && source.diagnostic.title, 'Diagnóstico Executivo'),
      generalNotes: safeText(source.diagnostic && source.diagnostic.general_notes),
      pillars: Array.isArray(summary.pillars) ? summary.pillars : [],
      fuelSpend: summary.fuelSpend && typeof summary.fuelSpend === 'object' ? summary.fuelSpend : {},
      fuelVehicle: summary.fuelVehicle && typeof summary.fuelVehicle === 'object' ? summary.fuelVehicle : {},
      maintenanceCost: summary.maintenanceCost && typeof summary.maintenanceCost === 'object' ? summary.maintenanceCost : {},
      priority: summary.priority || {},
      gaps: Array.isArray(summary.gaps) ? summary.gaps : [],
      strengths: Array.isArray(summary.strengths) ? summary.strengths : [],
      disclaimer: safeText(summary.disclaimer, 'Conclusão preliminar; evidências e impactos devem ser validados no projeto de consultoria.')
    };
  }

  function createReport(input, JsPdfClass) {
    var data = buildReportData(input);
    if (!JsPdfClass) throw new Error('Gerador de PDF indisponível.');

    var doc = new JsPdfClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var pageWidth = doc.internal.pageSize.getWidth();
    var pageHeight = doc.internal.pageSize.getHeight();
    var margin = 18;
    var contentWidth = pageWidth - margin * 2;
    var y = 0;

    function setColor(color, fill) {
      if (fill) doc.setFillColor(color[0], color[1], color[2]);
      else doc.setTextColor(color[0], color[1], color[2]);
    }

    function header(label) {
      setColor(COLORS.navy, true);
      doc.rect(0, 0, pageWidth, 28, 'F');
      setColor(COLORS.blue, true);
      doc.rect(0, 27.2, pageWidth, .8, 'F');
      setColor(COLORS.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('RODOCORE', margin, 12);
      setColor(COLORS.blue);
      doc.setFontSize(7.5);
      doc.text('CONSULTORIA EM GESTÃO DE FROTAS', margin, 18);
      setColor(COLORS.white);
      doc.setFont('helvetica', 'normal');
      doc.text(label || 'RELATÓRIO EXECUTIVO', pageWidth - margin, 15, { align: 'right' });
      y = 39;
    }

    function footer() {
      var page = doc.internal.getNumberOfPages();
      setColor(COLORS.soft);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('RodoCore • Diagnóstico preliminar e confidencial', margin, pageHeight - 9);
      doc.text('Página ' + page, pageWidth - margin, pageHeight - 9, { align: 'right' });
    }

    function newPage(label) {
      footer();
      doc.addPage();
      header(label);
    }

    function ensure(space, label) {
      if (y + space > pageHeight - 18) newPage(label);
    }

    function sectionLabel(text, color) {
      ensure(12);
      setColor(color || COLORS.blue);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(String(text).toUpperCase(), margin, y);
      y += 7;
    }

    function paragraph(text, options) {
      var config = options || {};
      var lines = doc.splitTextToSize(safeText(text), config.width || contentWidth);
      var lineHeight = config.lineHeight || 5;
      ensure(lines.length * lineHeight + 2, config.pageLabel);
      setColor(config.color || COLORS.text);
      doc.setFont('helvetica', config.bold ? 'bold' : 'normal');
      doc.setFontSize(config.size || 9);
      doc.text(lines, config.x || margin, y);
      y += lines.length * lineHeight + (config.after === undefined ? 3 : config.after);
    }

    header('CONCLUSÃO PRELIMINAR');
    setColor(COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(doc.splitTextToSize(data.title, contentWidth), margin, y);
    y += 20;
    setColor(COLORS.blue);
    doc.setFontSize(16);
    doc.text(doc.splitTextToSize(data.companyName, contentWidth), margin, y);
    y += 12;

    setColor(COLORS.pale, true);
    doc.roundedRect(margin, y, contentWidth, 28, 2, 2, 'F');
    setColor(COLORS.soft);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('RESPONSÁVEL', margin + 5, y + 7);
    doc.text('CONSULTOR', margin + 63, y + 7);
    doc.text('FROTA', margin + 121, y + 7);
    doc.text('CONCLUSÃO', margin + 146, y + 7);
    setColor(COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(doc.splitTextToSize(data.contactName, 53), margin + 5, y + 14);
    doc.text(doc.splitTextToSize(data.consultantName, 53), margin + 63, y + 14);
    doc.text(data.fleetSize, margin + 121, y + 14);
    doc.text(data.completedOn, margin + 146, y + 14);
    y += 39;

    sectionLabel('Maturidade por pilar');
    data.pillars.forEach(function (pillar, index) {
      var x = margin + (index % 2) * ((contentWidth + 5) / 2);
      if (index > 0 && index % 2 === 0) y += 31;
      setColor(COLORS.panel, true);
      doc.roundedRect(x, y, (contentWidth - 5) / 2, 26, 2, 2, 'F');
      setColor(COLORS.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(safeText(pillar.name), x + 5, y + 8);
      setColor(COLORS.green);
      doc.setFontSize(15);
      doc.text(String(pillar.level) + '/3', x + (contentWidth - 5) / 2 - 5, y + 9, { align: 'right' });
      setColor(COLORS.white);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(doc.splitTextToSize(safeText(pillar.label), (contentWidth - 5) / 2 - 10), x + 5, y + 17);
    });
    if (data.pillars.length) y += 37;

    if (data.fuelSpend.has_data) {
      var fuelLabels = { diesel_s10: 'Diesel S10', diesel_s500: 'Diesel S500', arla32: 'Arla 32', gasoline: 'Gasolina', ethanol: 'Etanol', other: 'Outro' };
      var sourceLabels = { fuel_card: 'cartão de combustível', erp: 'ERP ou sistema', spreadsheet: 'planilha', invoices: 'notas fiscais', own_tank: 'tanque próprio', other: 'outra fonte' };
      var paymentLabels = { fuel_card: 'cartão', bank_slip: 'boleto ou faturado', cash: 'à vista', pix: 'Pix', bank_transfer: 'transferência', other: 'outra forma' };
      var statusLabels = { yes: 'sim', partial: 'parcialmente', no: 'não', unknown: 'não informado', D: 'documentado', E: 'estimado', N: 'não controla', NA: 'não se aplica' };
      sectionLabel('Combustível — gasto e volume', COLORS.blue);
      paragraph(
        'Referência ' + formatMonth(data.fuelSpend.reference_month) +
        ' • Gasto mensal ' + formatMoney(data.fuelSpend.monthly_spend) +
        ' • Volume mensal ' + formatNumber(data.fuelSpend.monthly_liters, 3) + ' litros' +
        ' • Preço médio ' + (typeof data.fuelSpend.monthly_average_price === 'number' ? formatMoney(data.fuelSpend.monthly_average_price) + '/l' : 'não calculado'),
        { size: 8.5, bold: true, after: 3 }
      );
      paragraph(
        'Histórico de 6 meses: ' + (statusLabels[data.fuelSpend.six_month_history] || 'não informado') +
        ' (' + formatMoney(data.fuelSpend.six_month_spend) + ' e ' + formatNumber(data.fuelSpend.six_month_liters, 3) + ' litros). ' +
        'Histórico de 12 meses: ' + (statusLabels[data.fuelSpend.annual_history] || 'não informado') +
        ' (' + formatMoney(data.fuelSpend.annual_spend) + ' e ' + formatNumber(data.fuelSpend.annual_liters, 3) + ' litros).',
        { size: 8, color: COLORS.soft, after: 3 }
      );
      paragraph(
        'Produtos: ' + selectedLabels(data.fuelSpend.fuel_types, fuelLabels, data.fuelSpend.fuel_type_other) +
        '. Fontes: ' + selectedLabels(data.fuelSpend.data_sources, sourceLabels, data.fuelSpend.data_source_other) +
        '. Pagamentos: ' + selectedLabels(data.fuelSpend.payment_methods, paymentLabels, data.fuelSpend.payment_other) +
        '. Consolidação: ' + (statusLabels[data.fuelSpend.values_consolidated] || 'não informado') + '.',
        { size: 8, color: COLORS.soft, after: 5 }
      );
    }

    if (data.fuelVehicle.has_data) {
      var vehicleIdentifierLabels = { plate: 'placa', internal_code: 'código interno', fleet_number: 'número de frota' };
      var vehicleSourceLabels = { fuel_card: 'cartão de combustível', erp: 'ERP ou sistema', spreadsheet: 'planilha', invoices: 'notas fiscais', own_tank: 'tanque próprio', other: 'outra fonte' };
      var vehicleStatusLabels = { yes: 'sim', partial: 'parcialmente', no: 'não', unknown: 'não informado', D: 'documentado', E: 'estimado', N: 'não controla', NA: 'não se aplica' };
      sectionLabel('Combustível — rastreabilidade por veículo', COLORS.blue);
      paragraph(
        'Referência ' + formatMonth(data.fuelVehicle.reference_month) +
        ' • Cobertura da frota ' + formatPercent(data.fuelVehicle.vehicle_coverage_percentage) +
        ' (' + formatNumber(data.fuelVehicle.tracked_vehicle_count, 0) + ' de ' + formatNumber(data.fuelVehicle.fleet_vehicle_count, 0) + ' veículos)' +
        ' • Abastecimentos rastreados ' + formatPercent(data.fuelVehicle.refuel_traceability_percentage),
        { size: 8.5, bold: true, after: 3 }
      );
      paragraph(
        'Volume geral ' + formatNumber(data.fuelVehicle.company_monthly_liters, 3) + ' litros; vinculado aos veículos ' +
        formatNumber(data.fuelVehicle.registered_vehicle_liters, 3) + ' litros; diferença ' +
        formatNumber(data.fuelVehicle.liters_difference, 3) + ' litros; rastreabilidade ' +
        formatPercent(data.fuelVehicle.liters_traceability_percentage) + '. Gasto geral ' +
        formatMoney(data.fuelVehicle.company_monthly_spend) + '; vinculado aos veículos ' +
        formatMoney(data.fuelVehicle.registered_vehicle_spend) + '; diferença ' +
        formatMoney(data.fuelVehicle.spend_difference) + '; rastreabilidade ' +
        formatPercent(data.fuelVehicle.spend_traceability_percentage) + '.',
        { size: 8, color: COLORS.soft, after: 3 }
      );
      paragraph(
        'Identificação: ' + selectedLabels(data.fuelVehicle.identifier_methods, vehicleIdentifierLabels) +
        '. Fontes: ' + selectedLabels(data.fuelVehicle.data_sources, vehicleSourceLabels, data.fuelVehicle.data_source_other) +
        '. Lançamentos sem veículo ou genéricos: ' + (vehicleStatusLabels[data.fuelVehicle.generic_entries] || 'não informado') +
        '. Histórico de 6 meses: ' + (vehicleStatusLabels[data.fuelVehicle.six_month_history] || 'não informado') +
        '. Histórico de 12 meses: ' + (vehicleStatusLabels[data.fuelVehicle.annual_history] || 'não informado') + '.',
        { size: 8, color: COLORS.soft, after: 3 }
      );
      (data.fuelVehicle.vehicles || []).slice(0, 30).forEach(function (vehicle, index) {
        paragraph(
          String(index + 1).padStart(2, '0') + ' · ' + safeText(vehicle.identifier, 'Veículo sem identificação') +
          ' (' + (vehicleIdentifierLabels[vehicle.identifier_type] || 'tipo não informado') + ')' +
          ' — ' + formatNumber(vehicle.mileage, 3) + ' km; ' + formatNumber(vehicle.liters, 3) + ' litros; ' +
          formatMoney(vehicle.spend) + '; ' + formatNumber(vehicle.consumption_km_l, 2) + ' km/l; ' +
          formatMoney(vehicle.cost_per_km) + '/km.',
          { size: 7.7, color: COLORS.text, after: 1.5 }
        );
      });
      if (safeText(data.fuelVehicle.unassigned_explanation)) {
        paragraph('Explicação das diferenças: ' + safeText(data.fuelVehicle.unassigned_explanation), { size: 8, color: COLORS.soft, after: 5 });
      }
    }

    if (data.maintenanceCost.has_data) {
      var maintenanceIdentifierLabels = { plate: 'placa', internal_code: 'código interno', fleet_number: 'número de frota' };
      var maintenanceSourceLabels = {
        erp: 'ERP ou sistema', work_orders: 'ordens de serviço', spreadsheet: 'planilha', invoices: 'notas fiscais',
        workshop_control: 'controle da oficina', accounting: 'financeiro/contabilidade', other: 'outra fonte'
      };
      var maintenanceStatusLabels = { yes: 'sim', partial: 'parcialmente', no: 'não', unknown: 'não informado', D: 'documentado', E: 'estimado', N: 'não controla', NA: 'não se aplica' };
      sectionLabel('Manutenção — custos por veículo', COLORS.blue);
      paragraph(
        'Referência ' + formatMonth(data.maintenanceCost.reference_month) +
        ' • Custo mensal ' + formatMoney(data.maintenanceCost.monthly_total_cost) +
        ' • Frota mantida ' + formatPercent(data.maintenanceCost.maintained_fleet_percentage) +
        ' • Cobertura dos veículos mantidos ' + formatPercent(data.maintenanceCost.vehicle_cost_coverage_percentage) +
        ' • Lançamentos rastreados ' + formatPercent(data.maintenanceCost.maintenance_record_traceability_percentage),
        { size: 8.5, bold: true, after: 3 }
      );
      paragraph(
        'Composição apurada ' + formatMoney(data.maintenanceCost.composition_total) +
        ' (' + formatPercent(data.maintenanceCost.composition_percentage) + ' do total; diferença ' + formatMoney(data.maintenanceCost.composition_difference) + '). ' +
        'Classificação por tipo ' + formatMoney(data.maintenanceCost.type_total) +
        ' (' + formatPercent(data.maintenanceCost.type_percentage) + ' do total; diferença ' + formatMoney(data.maintenanceCost.type_difference) + '). ' +
        'Vinculado aos veículos ' + formatMoney(data.maintenanceCost.registered_vehicle_cost) +
        ' (' + formatPercent(data.maintenanceCost.vehicle_cost_traceability_percentage) + '; diferença ' + formatMoney(data.maintenanceCost.vehicle_cost_difference) + ').',
        { size: 8, color: COLORS.soft, after: 3 }
      );
      paragraph(
        'Composição: peças ' + formatMoney(data.maintenanceCost.parts_cost) +
        '; mão de obra interna ' + formatMoney(data.maintenanceCost.internal_labor_cost) +
        '; serviços externos ' + formatMoney(data.maintenanceCost.external_services_cost) +
        '; lubrificantes e materiais ' + formatMoney(data.maintenanceCost.lubricants_materials_cost) +
        '; guincho e emergência ' + formatMoney(data.maintenanceCost.towing_emergency_cost) +
        '; retrabalho não recuperado ' + formatMoney(data.maintenanceCost.unrecovered_rework_cost) +
        '; outros ' + formatMoney(data.maintenanceCost.other_cost) + '.',
        { size: 8, color: COLORS.soft, after: 3 }
      );
      paragraph(
        'Tipos: preventiva ' + formatMoney(data.maintenanceCost.preventive_cost) +
        '; corretiva ' + formatMoney(data.maintenanceCost.corrective_cost) +
        '; preditiva ' + formatMoney(data.maintenanceCost.predictive_cost) +
        '; acidente ou avaria ' + formatMoney(data.maintenanceCost.accident_damage_cost) + '. ' +
        'Histórico de 6 meses: ' + (maintenanceStatusLabels[data.maintenanceCost.six_month_history] || 'não informado') +
        ' (' + formatMoney(data.maintenanceCost.six_month_total_cost) + '). Histórico de 12 meses: ' +
        (maintenanceStatusLabels[data.maintenanceCost.annual_history] || 'não informado') +
        ' (' + formatMoney(data.maintenanceCost.annual_total_cost) + ').',
        { size: 8, color: COLORS.soft, after: 3 }
      );
      paragraph(
        'Identificação: ' + selectedLabels(data.maintenanceCost.identifier_methods, maintenanceIdentifierLabels) +
        '. Fontes: ' + selectedLabels(data.maintenanceCost.data_sources, maintenanceSourceLabels, data.maintenanceCost.data_source_other) +
        '. Consolidação: ' + (maintenanceStatusLabels[data.maintenanceCost.values_consolidated] || 'não informado') +
        '. Custos sem veículo: ' + (maintenanceStatusLabels[data.maintenanceCost.unlinked_costs] || 'não informado') + '.',
        { size: 8, color: COLORS.soft, after: 3 }
      );
      (data.maintenanceCost.vehicles || []).slice(0, 30).forEach(function (vehicle, index) {
        paragraph(
          String(index + 1).padStart(2, '0') + ' · ' + safeText(vehicle.identifier, 'Veículo sem identificação') +
          ' (' + (maintenanceIdentifierLabels[vehicle.identifier_type] || 'tipo não informado') + ')' +
          ' — ' + formatNumber(vehicle.mileage, 3) + ' km; ' + formatNumber(vehicle.maintenance_count, 0) + ' manutenções/OS; ' +
          formatMoney(vehicle.total_cost) + '; ' + formatMoney(vehicle.cost_per_km) + '/km; ' +
          formatPercent(vehicle.share_of_monthly_cost) + ' do custo mensal.',
          { size: 7.7, color: COLORS.text, after: 1.5 }
        );
      });
      (data.maintenanceCost.warnings || []).forEach(function (warning) {
        paragraph('Conferir: ' + safeText(warning), { size: 8, color: COLORS.gold, after: 2 });
      });
      if (safeText(data.maintenanceCost.unassigned_explanation)) {
        paragraph('Explicação das diferenças: ' + safeText(data.maintenanceCost.unassigned_explanation), { size: 8, color: COLORS.soft, after: 5 });
      }
    }

    sectionLabel('Prioridade inicial', COLORS.gold);
    paragraph(
      safeText(data.priority.name, 'Pilar a validar') + ' — maturidade ' + String(data.priority.level === undefined ? 0 : data.priority.level) + '/3',
      { size: 14, bold: true, after: 4 }
    );
    paragraph('Comece pelas lacunas abaixo, validando evidências antes de estimar qualquer impacto financeiro.', { color: COLORS.soft, after: 5 });

    data.gaps.slice(0, 5).forEach(function (gap, index) {
      ensure(19, 'PRIORIDADES');
      setColor(COLORS.pale, true);
      doc.roundedRect(margin, y - 2, contentWidth, 16, 1.5, 1.5, 'F');
      setColor(COLORS.gold);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(String(index + 1).padStart(2, '0') + '  ' + safeText(gap.pillar).toUpperCase(), margin + 4, y + 3);
      setColor(COLORS.text);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(doc.splitTextToSize(safeText(gap.recommendation), contentWidth - 8), margin + 4, y + 9);
      y += 19;
    });

    newPage('DETALHAMENTO');
    sectionLabel('Leitura por pilar');
    data.pillars.forEach(function (pillar) {
      ensure(33, 'DETALHAMENTO');
      setColor(COLORS.panel, true);
      doc.roundedRect(margin, y - 3, contentWidth, 12, 2, 2, 'F');
      setColor(COLORS.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(safeText(pillar.name), margin + 5, y + 4);
      setColor(COLORS.green);
      doc.text(String(pillar.level) + '/3', pageWidth - margin - 5, y + 4, { align: 'right' });
      y += 15;
      paragraph(safeText(pillar.description), { color: COLORS.soft, size: 8.5, after: 2 });
      var counts = pillar.counts || {};
      paragraph('D ' + (counts.D || 0) + '   •   E ' + (counts.E || 0) + '   •   N ' + (counts.N || 0) + '   •   NA ' + (counts.NA || 0), { size: 8, bold: true, after: 7 });
    });

    sectionLabel('Controles documentados', COLORS.green);
    if (!data.strengths.length) {
      paragraph('Nenhum controle foi classificado como documentado nas respostas.', { color: COLORS.soft });
    } else {
      data.strengths.forEach(function (strength) { paragraph('• ' + strength, { size: 8.5, after: 2 }); });
    }

    if (data.generalNotes) {
      sectionLabel('Observações gerais');
      paragraph(data.generalNotes, { size: 8.5, color: COLORS.soft, pageLabel: 'OBSERVAÇÕES' });
    }

    ensure(34, 'RESSALVA');
    setColor(COLORS.gold, true);
    doc.rect(margin, y, 1.2, 23, 'F');
    setColor([250, 247, 238], true);
    doc.rect(margin + 1.2, y, contentWidth - 1.2, 23, 'F');
    setColor(COLORS.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('RESSALVA TÉCNICA', margin + 6, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.text(doc.splitTextToSize(data.disclaimer, contentWidth - 12), margin + 6, y + 13);
    y += 29;

    footer();
    return { doc: doc, data: data };
  }

  function downloadReport(input) {
    var JsPdfClass = typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF;
    var report = createReport(input, JsPdfClass);
    report.doc.save('rodocore-diagnostico-' + fileSafe(report.data.companyName) + '.pdf');
    return report;
  }

  return {
    buildReportData: buildReportData,
    createReport: createReport,
    downloadReport: downloadReport,
    fileSafe: fileSafe
  };
}));
