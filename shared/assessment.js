(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RodoCoreAssessment = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  var sourceUrl = 'https://www.gov.br/antt/pt-br/acesso-a-informacao/acoes-e-programas/agenda-regulatoria/air/air-elaborados/SEI_ANTT8262322NOTATECNICAANTT.pdf';
  var categories = [
    ['fuel', 'Combustível', 40.3], ['drivers', 'Mão de obra dos motoristas', 21],
    ['tires', 'Pneus e recapagem', 10], ['vehicle_depreciation', 'Depreciação do veículo', 9.1],
    ['maintenance', 'Manutenção', 6.1], ['insurance', 'Seguro de acidente e roubo da composição veicular', 5.3],
    ['trailer_depreciation', 'Depreciação do implemento', 2.1], ['arla', 'ARLA 32', 1.8],
    ['vehicle_capital', 'Remuneração do capital do veículo', 1.4], ['lubricants', 'Lubrificantes', 1],
    ['taxes', 'Tributos / taxas da composição veicular', 1], ['washing', 'Lavagens e graxas', 0.9],
    ['trailer_capital', 'Remuneração do capital do implemento', 0.3],
    ['other', 'Demais custos (pedágio, administração e outros)', null]
  ];
  var texts = [
    ['period', 'Período de competência (ex.: outubro/2026)'],
    ['scope', 'Operação: veículos, carga, rota e distância'],
    ['evidence', 'Fonte dos valores e o que ainda precisa ser conferido'],
    ['driver_feedback', 'O que os motoristas relatam sobre as condições de trabalho?'],
    ['problem', 'Problema prioritário e impacto observado'],
    ['cause', 'Hipótese de causa e como será verificada'],
    ['action', 'Primeira ação combinada'], ['owner', 'Responsável pela ação'],
    ['deadline', 'Prazo combinado'], ['indicator', 'Indicador, valor inicial e unidade'],
    ['target', 'Meta acordada com a empresa (não a referência de mercado)'],
    ['review', 'Data da revisão e resultado medido']
  ];
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function number(v) {
    if (v === '' || v == null || typeof v === 'boolean') return null;
    if (typeof v === 'string' && !/^\d+(?:[.,]\d{1,2})?$/.test(v.trim())) return null;
    var n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) && n >= 0 && n <= 1e12 ? Math.round(n * 100) / 100 : null;
  }
  function normalize(value) {
    var v = value && typeof value === 'object' ? value : {}, out = {version: 1};
    categories.map(function(c){return c[0];}).concat(['total', 'revenue', 'investments', 'claims']).forEach(function(k){out[k] = number(v[k]);});
    texts.forEach(function(f){out[f[0]] = String(v[f[0]] || '').trim().slice(0, 1000);});
    out.quality = ['documented', 'estimated', 'incomplete'].indexOf(v.quality) >= 0 ? v.quality : 'incomplete';
    return out;
  }
  function calculate(value) {
    var v = normalize(value), sum = 0, count = 0;
    categories.forEach(function(c){if(v[c[0]] !== null){sum += v[c[0]];count++;}});
    sum = Math.round(sum * 100) / 100;
    var valid = v.total !== null && v.total > 0 && sum <= v.total + 0.01;
    return {values:v, sum:sum, count:count, valid:valid, overTotal:v.total !== null && sum > v.total + 0.01,
      rows:categories.map(function(c){return {label:c[1], value:v[c[0]], reference:c[2], share:valid && v[c[0]] !== null ? v[c[0]] / v.total * 100 : null};})};
  }
  function format(n, suffix) { return n === null ? 'Não informado' : n.toLocaleString('pt-BR', {minimumFractionDigits:suffix === '%' ? 1 : 2,maximumFractionDigits:2}) + (suffix || ''); }
  function form(value, mode) {
    var v = normalize(value);
    function input(key, label, numeric) {
      var attrs = mode === 'executive' ? ' data-assessment-field="'+key+'"' : ' name="rc_'+key+'"';
      return '<label>'+esc(label)+(numeric ? ' (R$)' : '')+'<input'+attrs+' type="text" '+(numeric ? 'data-assessment-number inputmode="decimal" placeholder="Não informado" maxlength="16"' : 'maxlength="1000"')+' value="'+esc(v[key])+'"></label>';
    }
    return '<details class="rc-assessment"><summary>Composição de custos e plano de ação · opcional</summary><p>Use o mesmo período, conjunto de veículos e regime de competência. Campo vazio significa não informado; zero significa custo confirmado como zero. Informe valores sem separador de milhar, por exemplo 12500,50.</p><p>Não some duas vezes a mesma despesa. Separe pneus de manutenção e ARLA de diesel; em pessoal, considere encargos e benefícios. Aquisição de veículo e amortização do financiamento não substituem depreciação ou remuneração do capital. Se não souber separar, deixe em branco e registre a dúvida.</p><div class="rc-fields">'+texts.slice(0,2).map(function(f){return input(f[0],f[1]);}).join('')+
      '<label>Qualidade da base<select '+(mode === 'executive' ? 'data-assessment-field="quality"' : 'name="rc_quality"')+'>'+[['incomplete','Base incompleta'],['estimated','Valores estimados'],['documented','Valores documentados']].map(function(o){return '<option value="'+o[0]+'"'+(v.quality === o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></label>'+input('total','Custo total do período, incluindo custos econômicos',true)+input('revenue','Faturamento do mesmo período (opcional)',true)+'</div><div class="rc-fields">'+categories.map(function(c){return input(c[0],c[1],true);}).join('')+'</div><p>Memória separada: os valores abaixo não são somados ao custo total. Sinistros podem já estar incluídos nas despesas acima. Investimento não é despesa operacional integral do mês.</p><div class="rc-fields">'+input('claims','Sinistros identificados (valor já incluído nos custos)',true)+input('investments','Investimentos realizados (fora da composição)',true)+'</div><h3>Da investigação à ação</h3><p>Ouvir a operação → validar registros → investigar a causa → combinar ação, responsável e prazo → medir a evolução. As metas dependem da realidade do cliente.</p><div class="rc-fields">'+texts.slice(2).map(function(f){return input(f[0],f[1]);}).join('')+'</div><p>'+(mode === 'executive' ? 'Salvo com o diagnóstico ao responder também a classificação da pergunta de combustível. Não altera sua nota de maturidade.' : 'Esta seção fica no rascunho deste navegador e no resultado impresso. Os valores e o plano não são enviados ao solicitar contato.')+'</p></details>';
  }
  function reportLines(value) {
    var c = calculate(value), v = c.values;
    var lines = ['COMPOSIÇÃO DE CUSTOS E PRIMEIRA AÇÃO', 'Período: '+(v.period || 'não informado')+' | Operação: '+(v.scope || 'não informada'),
      'Qualidade: '+({documented:'documentada',estimated:'estimada',incomplete:'incompleta'}[v.quality]),
      'Custo total informado: '+format(v.total,' reais')+'. Faturamento: '+format(v.revenue,' reais')+'.',
      'Percentuais da empresa = custo da categoria / custo total informado. Não são percentuais do faturamento.',
      c.overTotal ? 'CONFERIR: categorias excedem o total. Percentuais suspensos até corrigir a base.' : !c.valid ? 'Informe um custo total positivo para calcular a composição.' : 'Categorias preenchidas: '+format(c.sum,' reais')+'. Não distribuído: '+format(Math.max(0,v.total-c.sum),' reais')+'.'];
    c.rows.forEach(function(r){lines.push(r.label+': '+format(r.value,' reais')+' | empresa: '+format(r.share,'%')+' | referência histórica: '+(r.reference === null ? 'sem percentual nesta tabela' : format(r.reference,'%')));});
    if(v.total !== null && v.revenue > 0) lines.push('Custo total / faturamento: '+format(v.total / v.revenue * 100,'%')+'. Esta relação não representa saldo de caixa.');
    lines.push('Referência: ANTT, Nota Técnica 5555/2021, tabela 3; transporte lotação, carga geral, percurso de 1.000 km. É uma estrutura modelada histórica, não uma média atual de todas as transportadoras nem uma meta. Os pesos publicados somam 100,3% por arredondamento. Não foram ajustados para 100%.');
    lines.push('Operações florestais, urbanas, fracionadas, distâncias e taxas de ocupação diferentes exigem base própria. Diferenças não demonstram desperdício ou culpa do motorista. Pedágios, administração e outras despesas fora desta estrutura mudam o denominador: a coluna da ANTT é apenas contexto, não comparação direta sem conciliação.');
    lines.push('Sinistros informados (já incluídos): '+format(v.claims,' reais')+'. Investimentos separados: '+format(v.investments,' reais')+'. Sem percentual universal validado para essas categorias.');
    texts.slice(2).forEach(function(f){if(v[f[0]]) lines.push(f[1]+': '+v[f[0]]);});
    lines.push('Acompanhamento proposto: diagnóstico, implantação e medição em 90 dias; visitas e frequência conforme contrato. Separar hipótese de causa de evidência confirmada e economia projetada de resultado medido.');
    return lines;
  }
  function render(value) {
    var c = calculate(value), lines = reportLines(value);
    return '<section class="rc-assessment"><h2>Custos: conhecer antes de definir metas</h2>'+lines.slice(1,6).map(function(l){return '<p>'+esc(l)+'</p>';}).join('')+'<div class="rc-table"><table><caption>Empresa e estrutura histórica ANTT 2021 · bases a validar</caption><thead><tr><th>Categoria</th><th>Empresa (R$)</th><th>% do custo</th><th>ANTT 2021</th></tr></thead><tbody>'+c.rows.map(function(r){return '<tr><th scope="row">'+esc(r.label)+'</th><td>'+format(r.value)+'</td><td>'+format(r.share,'%')+'</td><td>'+(r.reference === null ? 'Sem referência' : format(r.reference,'%'))+'</td></tr>';}).join('')+'</tbody></table></div>'+lines.slice(6+categories.length).map(function(l){return '<p>'+esc(l)+'</p>';}).join('')+'<p><a href="'+sourceUrl+'" target="_blank" rel="noopener">Consultar ANTT: documento e tabela de origem</a></p><details><summary>Outras bases: não misturar percentuais</summary><p>CNI/NTC, março de 2016, lotação, 800 km: fixos 50,9%, variáveis 39,2% e indiretos 9,9%. Combustível 30,8%, manutenção 4,4% e pneus 4% já integram esses grupos; não devem ser somados novamente.</p><p><a target="_blank" rel="noopener" href="https://static.portaldaindustria.com.br/media/filer_public/65/3a/653ac067-f58a-4d73-9434-dc4d464809bf/estudo_transporte_rodoviario_carga.pdf">Estudo CNI, apêndice A, tabela A1 (p. 57)</a>. São referências históricas distintas. Não há composição universal para toda frota.</p></details></section>';
  }
  function fromAnswers(answers) {var v={};Object.keys(answers).forEach(function(k){if(k.indexOf('rc_')===0)v[k.slice(3)] = answers[k];});return normalize(v);}
  function invalidInput(container) {
    return Array.prototype.find.call(container.querySelectorAll('[data-assessment-number]'), function(el){return el.value.trim() && number(el.value) === null;}) || null;
  }
  return {normalize:normalize,calculate:calculate,form:form,render:render,reportLines:reportLines,fromAnswers:fromAnswers,sourceUrl:sourceUrl,invalidInput:invalidInput};
}));
