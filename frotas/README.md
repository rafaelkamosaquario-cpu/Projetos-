# CPK Frotas — Sistema de Gestão de Pneus

Réplica funcional do app **CPK Frotas** (SPA para consultores de gestão de frotas),
reconstruída em **vanilla JS / HTML / CSS** com persistência em **localStorage** —
sem build, sem backend. Abre direto no navegador.

## Como rodar

Abra `frotas/index.html` no navegador (ou sirva a pasta com qualquer servidor
estático). Nenhuma dependência precisa ser instalada.

## Acesso

- Login por **PIN numérico**. PIN padrão: **`2468`** (configurável na constante
  `ACCESS_PIN` no topo de `app.js`).

## Telas (hash-router)

`#/login` · `#/dashboard` · `#/empresas` · `#/veiculos` · `#/pneus` ·
`#/sucatas` · `#/checklists` · `#/proposta`

Todo o sistema gira em torno da **empresa selecionada**: cadastre em *Empresas*,
selecione uma, e as demais telas passam a filtrar os dados dela. Sem empresa,
as telas dependentes mostram o aviso para cadastrar/selecionar uma empresa.

## Cálculo do CPK

`CPK = Custo ÷ (KM Real − KM Inicial)`, calculado em tempo real no formulário de
pneu. Um pneu tem "CPK válido" quando `custo > 0` e `KM Real > KM Inicial`.

## Design system

- Títulos: **Bebas Neue** (fallback Anton) · corpo: **Montserrat**
- Fundo: gradiente 135° `#0B5ED7 → #0E8F6E` (`.bg-gradient-cpk`)
- Cards: `rgba(27,37,47,0.92)`, raio 16px (`.card-premium`)
- Inputs: `#0F1720`, borda branca 15%, raio 10px
- Botão de ação: `#F8D83C` com texto preto (`.btn-cpk`)
- Sidebar: `rgba(0,0,0,0.2)`, 256px, item ativo com destaque dourado

## Correções em relação ao app original analisado

- Item de menu **"Veículos"** (era "MAIS")
- Botão **"Novo Veículo"** (era "Novo," com vírgula solta)
- Campo **"Causa Provável"** na sucata (era "Causa Provac")
- Botão **"Remover"** na proposta (era "Removedor")
- Modal **"Nova Lista de Verificação"** (era "Lista de Verificação Novo")
- **Selects nativos controlados**: o label reflete o valor escolhido e não há
  overlay travando o clique do segundo dropdown; elimina também o
  `NotFoundError: removeChild` observado no fluxo original
- Rótulos dos itens de checklist escritos por extenso (sem truncar)
- `render()` protegido por `try/catch` para não travar em erro pontual

## Estrutura

```
frotas/
├── index.html   # shell + fontes
├── style.css    # design system
├── app.js       # router, CRUD, cálculo de CPK, PDF, WhatsApp
└── README.md
```

> Este app fica **ao lado** do "Diagnóstico Gratuito" na raiz do repositório;
> nenhum dos dois interfere no outro.
