# Referências de custos e primeira ação — 2026-11-01

Componente usado no check-up público e no diagnóstico executivo. Não modifica a pontuação D/E/N/NA, não cria metas automáticas e não comprova perdas ou economia.

## Base e denominador

- ANTT: Nota Técnica 5555/2021, tabela 3. Operação modelada de carga geral lotação, 1.000 km. Pesos publicados preservados (100,3% por arredondamento). Não representa média nacional atual.
- CNI/NTC: estudo Transporte Rodoviário de Carga, apêndice A/tabela A1, março/2016, 800 km. Contexto adicional, sem misturar pesos com ANTT.
- Links integrais no componente e fonte ANTT no PDF executivo.
- Empresa: valor de cada categoria / custo total informado, no mesmo período e escopo. Relação custo/faturamento é separada e não é saldo de caixa.
- Sem índice universal validado para sinistros ou investimentos. Memorandos não se somam ao custo, evitando duplicidade. Seguro não é sinistro. Investimento não é despesa operacional integral.
- Campos vazios são desconhecidos, zero é custo declarado zero. Totais incompatíveis suspendem percentuais. Base parcial é identificada.

## Fluxo e persistência

Público: bloco opcional no final da etapa 4, resultado e impressão. Prefixo `rc_` no rascunho existente. Valores financeiros/plano não integram o payload do lead nem a mensagem WhatsApp. O consentimento existente continua restrito ao contato e ao resumo de maturidade.

Executivo: bloco na primeira pergunta de combustível, após escolher D/E/N/NA. Mesmo dono, permissões e tabelas existentes. Salvo em `diagnostic_answers.answer_payload.details.assessment`; resumo em `executive_diagnostics.preliminary_summary.assessment`. Sem migração ou alteração de registros antigos. Campos recuperados pela normalização existente. PDF contém composição, limites, evidências e primeira ação. Diagnósticos antigos permanecem sem valores novos preenchidos automaticamente.

Roteiro: ouvir empresário e motoristas, validar evidências, registrar problema e hipótese de causa, combinar ação/responsável/prazo, definir indicador/base/meta própria e revisar resultado. É uma primeira ação documentada; não substitui um gerenciador completo de tarefas, visitas ou lembretes. Acompanhamento de 90 dias e frequência de visitas conforme contrato.

## Verificação

`node shared/assessment.test.cjs`
`node diagnostico/tests/engine.test.cjs`
`node app/consultoria/tests/model.test.cjs`
`node app/consultoria/tests/pdf.test.cjs`

Prévia usa apenas dados fictícios. Não submeter leads ou modificar empresas reais durante testes. Arquivos `preview*`, `pdf-test*` e `reference-*` são locais e não entram na publicação.
