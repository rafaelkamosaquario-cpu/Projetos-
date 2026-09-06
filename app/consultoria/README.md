# RodoCore Consultoria — Fase 2

Área privada e estática em `/app/consultoria/` para conduzir o diagnóstico
executivo e convertê-lo em um projeto de consultoria.

No GitHub Pages, ela faz parte da mesma central do diagnóstico público:

- Central: `https://rafaelkamosaquario-cpu.github.io/Projetos-/`
- Diagnóstico público: `https://rafaelkamosaquario-cpu.github.io/Projetos-/diagnostico/`
- Diagnóstico executivo: `https://rafaelkamosaquario-cpu.github.io/Projetos-/app/consultoria/`

## Entregue nesta fase

- autenticação por e-mail e senha com Supabase Auth;
- cadastro de empresa e responsável;
- 24 perguntas em quatro pilares: combustível, manutenção, pneus e operação
  dos motoristas;
- classificações D, E, N e NA, com maturidade de 0 a 3;
- perguntas condicionais e observações por resposta;
- detalhamento interativo da Pergunta 01 de combustível, com gasto e volume
  mensal, históricos de 6 e 12 meses, produtos, fontes, pagamentos,
  abastecimento interno e externo e cálculo do preço médio por litro;
- autosave, rascunho e retomada entre dispositivos;
- conclusão preliminar, resumo em PDF e conversão em projeto;
- estrutura privada para perfis, empresas, contatos, diagnósticos, respostas,
  projetos, veículos, motoristas, visitas, achados, evidências, ações e
  indicadores.

Visitas, achados, evidências, ações e indicadores têm estrutura e segurança no
banco, mas sua operação detalhada fica para a Fase 3.

## Arquivos principais

- `index.html`: login, painel, cadastros, diagnóstico, resultado e projetos.
- `styles.css`: identidade RodoCore, acessibilidade e responsividade.
- `model.js`: perguntas, condicionais, maturidade e conclusão preliminar.
- `pdf.js`: relatório executivo gerado localmente no navegador.
- `app.js`: autenticação, persistência, autosave e navegação.
- `supabase/migrations/202609030001_consulting_app_phase2.sql`: modelo privado,
  permissões, RLS, índices e triggers.
- `supabase/tests/consulting_rls.test.sql`: testes pgTAP de privilégios e
  isolamento entre dois usuários.

O frontend reutiliza somente a URL e a chave pública `anon` já configuradas em
`../../diagnostico/config.js`. Nenhuma `service_role`, senha do banco ou
credencial administrativa é usada ou aceita.

## Executar localmente

Na raiz do repositório:

    node app/consultoria/tests/serve.cjs

Abra:

    http://127.0.0.1:8000/app/consultoria/

O endereço local e o endereço final do GitHub Pages precisam estar autorizados
em Authentication > URL Configuration no projeto Supabase para confirmação de
e-mail e retorno da sessão.

## Testes locais

    node --test app/consultoria/tests/*.test.cjs

## Aplicação e validação do banco

1. Aplique a migration no projeto exclusivo `rodocore-consultoria`.
2. Rode `supabase test db` em um ambiente local preparado com Supabase CLI ou
   execute o teste pgTAP em um banco de teste.
3. Confirme que as 13 tabelas possuem `owner_id`, RLS e FORCE RLS.
4. Confirme que `anon` não possui privilégios nas tabelas privadas.
5. Confirme que `authenticated` possui somente `SELECT`, `INSERT` e `UPDATE`
   conforme o arquivo e não possui `DELETE`.
6. Execute o cenário com dois usuários e confirme que nenhum registro de uma
   conta é visível ou alterável pela outra.

## Limites desta entrega

- não há exclusão de registros no cliente;
- não há estimativa automática de economia ou afirmação de desperdício;
- o PDF é preliminar e exige validação de evidências;
- não houve push, merge ou publicação automática.
