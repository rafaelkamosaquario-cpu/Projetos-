# RodoCore — check-up público

Módulo estático publicado em /diagnostico/. Ele avalia a maturidade dos
controles de combustível, manutenção e pneus sem estimar economia ou afirmar
desperdício.

O módulo compartilha a mesma central e identidade visual da área executiva:

- Central: `https://rafaelkamosaquario-cpu.github.io/Projetos-/`
- Diagnóstico público: `https://rafaelkamosaquario-cpu.github.io/Projetos-/diagnostico/`
- Diagnóstico executivo protegido: `https://rafaelkamosaquario-cpu.github.io/Projetos-/app/consultoria/`

## Estrutura

- index.html: fluxo, perguntas, resultado e captura opcional de contato.
- style.css: identidade visual e responsividade.
- engine.js: regras de classificação D/E/N/NA e maturidade 0–3.
- app.js: navegação, validação, rascunho local, resultado e integração.
- config.js: URL e chave pública (anon) do Supabase exclusivo. Configurado.
- supabase/migrations/: tabela pública de pedidos e política RLS.
- tests/engine.test.cjs: cenários automatizados do motor de maturidade.

Não há build, framework ou dependência de execução. O módulo usa apenas HTML,
CSS e JavaScript nativos.

## Executar localmente

Na raiz do repositório, com Node.js:

    node diagnostico/tests/serve.cjs

Abra http://127.0.0.1:8000/diagnostico/.

Para testar o motor:

    node diagnostico/tests/engine.test.cjs

O rascunho do questionário é salvo no localStorage do navegador. Nome, empresa
e WhatsApp não são incluídos no rascunho.

## Supabase conectado

Projeto exclusivo: `rodocore-consultoria`

- URL pública configurada em `config.js`.
- Migration `202608310001_public_diagnostic_leads.sql` aplicada.
- RLS confirmada como ativa.
- Política `public_diagnostic_leads_insert_with_consent` confirmada para
  `INSERT` de `anon` e `authenticated`.
- `SELECT`, `UPDATE` e `DELETE` confirmados como bloqueados para os dois
  papéis públicos.
- Nenhuma chave `service_role`, senha do banco ou credencial administrativa é
  usada pelo frontend.

### Recriar a configuração em outro projeto

1. Crie um projeto Supabase novo e isolado chamado rodocore-consultoria.
2. No SQL Editor desse projeto, aplique
   supabase/migrations/202608310001_public_diagnostic_leads.sql.
3. Confirme no painel que RLS está ativa na tabela
   public.public_diagnostic_leads.
4. Verifique as permissões:

    select
      has_table_privilege('anon', 'public.public_diagnostic_leads', 'INSERT') as anon_can_insert,
      has_table_privilege('anon', 'public.public_diagnostic_leads', 'SELECT') as anon_can_select,
      has_table_privilege('anon', 'public.public_diagnostic_leads', 'UPDATE') as anon_can_update,
      has_table_privilege('anon', 'public.public_diagnostic_leads', 'DELETE') as anon_can_delete;

O resultado esperado é true, false, false, false.

5. Em config.js, preencha somente:

    window.RODOCORE_CONFIG = {
      supabaseUrl: 'https://SEU-PROJETO.supabase.co',
      supabaseAnonKey: 'SUA_CHAVE_PUBLICA_ANON',
      leadsTable: 'public_diagnostic_leads'
    };

A chave anon é pública por natureza, mas só deve ser ativada depois da RLS.
Nunca use service_role, senha do banco ou token administrativo no frontend.

Se a configuração for removida, o check-up continua funcionando sem captura de
contato: o formulário informa que não há conexão, permanece desabilitado e não
afirma que o contato foi gravado.

### Limite da captura pública

A política permite somente inserção consentida e bloqueia leitura, alteração e
exclusão pelo navegador. Antes de uma campanha com tráfego relevante, considere
adicionar rate limiting ou uma Edge Function para reduzir spam sem ampliar os
privilégios da chave pública.

## Publicação no GitHub Pages

O endereço atual depende da branch gh-pages. Depois de revisão e autorização:

1. integre a branch feature/rodocore-diagnosticos em gh-pages;
2. publique sem alterar a configuração de Pages;
3. valide a home e /diagnostico/;
4. confirme que /frotabot/ e /admin/ continuam inalterados.

Este trabalho não executa push nem publicação automaticamente.
