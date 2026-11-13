# Design system — Aguiar ERP

## Princípios
- **Marca preservada, uso contido.** Grafite `#1C1917` estrutura a navegação; vermelho `#C8102E` só em ação
  principal, foco e item ativo; bege `#F5F0E8` vira a "temperatura" das superfícies neutras.
- **Dados primeiro.** Números com algarismos tabulares (`.num`), valores financeiros em destaque e
  identificadores (CNPJ, nº de contrato) em Geist Mono.
- **Cores com significado.** Status nunca dependem só da cor: sempre há rótulo e, em listas, um ponto ou faixa.

## Tokens (app/globals.css)
| Grupo | Tokens |
| --- | --- |
| Superfícies | `background`, `card`, `subtle`, `muted`, `border`, `border-strong` |
| Texto | `foreground`, `muted-foreground`, `faint` |
| Ação | `primary` (vermelho), `brand-graphite` |
| Status | `success` (recebido/ativo), `danger` (vencido), `warning` (vence em até 7 dias/suspenso), `info` (implantação), `neutral` (a receber) — cada um com a variação `-soft` |
| Navegação | `sidebar`, `sidebar-elevated`, `sidebar-accent`, `sidebar-border`, `sidebar-muted` |
| Gráficos | `chart-1` (grafite), `chart-2` (vermelho), `success` para "recebido" |

Tipografia: **Geist Sans** (interface) e **Geist Mono** (identificadores), via `next/font`.

## Componentes
- `components/ui` — primitivos (botão, campos, tabela, diálogo, menu, abas, dica, esqueleto, estado vazio).
- `components/dashboard/kpi-card.tsx` — indicador com ícone, número animado e comparação (`Delta`) com o
  mês anterior, calculada sobre dados reais.
- `components/charts` — `TrendChart` (área/barras com tooltip e tabela acessível) e `BarList`.
- `components/layout` — `AppShell` (menu recolhível, estado em cookie), `Sidebar`, `Topbar` (trilha),
  `CommandMenu` (Ctrl/⌘ + K), `MobileNav`.
- `components/finance/status-tabs.tsx` — filtros por situação em abas, mantendo a URL compartilhável.

## Situação das cobranças (utils/receivable-state.ts)
| Situação | Regra | Cor |
| --- | --- | --- |
| Recebido | status `pago` | verde |
| Vencido | em aberto e vencimento antes de hoje | vermelho |
| Vence em breve | em aberto, vence em até 7 dias | amarelo |
| A receber | em aberto, vence depois de 7 dias | neutro |
| Cancelado | status `cancelado` | riscado, neutro |

## Responsividade
- Breakpoints Tailwind: `sm` 640, `md` 768, `lg` 1024 (menu lateral fixo), `xl` 1280, `2xl` 1536.
- Abaixo de `lg` o menu vira gaveta; abaixo de `md`/`lg` as tabelas viram listas em cartões.
- Verificado sem rolagem horizontal em 1920, 1366, 820 (tablet) e 390 px (celular).

## Movimento
Entradas com `fade-up` curto, contagem dos números na primeira exibição, modais com escala suave e
esqueletos de carregamento (`app/(app)/loading.tsx`). Tudo é desligado quando o sistema pede
`prefers-reduced-motion`.

## v0.4 — painel "vitrine"
- **Menu lateral**: item ativo em pílula vermelha com brilho; brilho vermelho discreto ao fundo; seletor "Empresa atual".
- **Topo**: busca global (Ctrl/⌘ + K) que encontra clientes, empresas (por nome ou CNPJ), contratos e módulos;
  sino com as cobranças vencidas e as que vencem em até 7 dias.
- **Dashboard**: banner de boas-vindas com ilustração própria (SVG gerado, sem imagens externas); cartões
  financeiros com mini gráficos de tendência; faixa da carteira de clientes (os 5 indicadores da fundação);
  gráfico com períodos 6 meses / 12 meses / no ano; ações rápidas; resumo por competência; próximos
  vencimentos; indicadores em anel.
- **Indicadores em anel** (período escolhido, vencimentos até hoje):
  - Adimplência = valor vencido e recebido ÷ valor vencido;
  - Inadimplência = valor vencido em aberto ÷ valor vencido;
  - Retenção = contratos ativos ÷ contratos ativos, suspensos e encerrados.
- Todas as séries vêm de `finance_summary` (migration `20261115000100`), calculadas sobre dados reais e sob RLS.
