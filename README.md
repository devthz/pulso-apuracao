# PULSO · Apuração Eleições 2026

Painel dark, em tempo real, da apuração das eleições gerais de 2026 em todo o Brasil — **Presidente, Governadores, Senado, Câmara dos Deputados e Assembleias** — direto dos arquivos públicos do TSE.

Next.js 16 (App Router) · React 19 · Tailwind v4 · Motion · SWR

## Rodar

```bash
npm install
npm run dev            # http://localhost:3000 — dados ao vivo do TSE
```

Ver a apuração **simulada** (candidatos e partidos fictícios, a contagem anda sozinha em ~8 min):

```bash
DATA_MODE=simulacao npm run dev
# ou, com o servidor no modo TSE, abra http://localhost:3000/?modo=simulacao
```

Produção:

```bash
npm run build && npm start
```

### Deploy na Vercel

Importe o repositório e pronto. O `vercel.json` fixa a região `gru1` (São Paulo), perto do TSE. Variáveis opcionais em `.env.example`.

## O que tem

- **Presidente**: duelo dos dois primeiros com % gigante animado, diferença em p.p., "cabo de guerra" com a linha dos 50%, demais candidatos, anel de seções totalizadas, comparecimento/abstenção/brancos/nulos.
- **Mapa do Brasil** interativo: cor do partido de quem lidera em cada UF, intensidade pela margem e pelo % apurado, tooltip com top 3, clique abre o estado.
- **Governadores**: 27 cards com líder, vice-líder e status (apurando / eleito / 2º turno), filtro por região.
- **Senado**: hemiciclo das 54 vagas em jogo + os 2 mais votados de cada UF.
- **Câmara**: hemiciclo de 513 cadeiras com **projeção pelo quociente eleitoral** (QE, QP, sobras 80/20 e maior média) enquanto a apuração corre; troca para o resultado oficial quando o TSE marca os eleitos.
- **Assembleias**: hemiciclo e mais votados por UF (DF = Câmara Legislativa).
- **Página por estado** (`/uf/sp`, `/uf/mg`…): governador, senado, presidente na UF, bancada federal e assembleia, com eleitos.
- Letreiro ao vivo, busca por estado com **⌘K** (ou `/`), relógio de Brasília, contagem regressiva até 17h.

## Como os dados fluem

```
navegador ──SWR a cada 15s──> /api/*  (Next.js)  ──cache 15s + fila de 12 conexões──> resultados.tse.jus.br
```

- Arquivo usado: resultado unificado do leiaute 2026 (`EA20`, `…/dados/{uf}/{uf}-c{cargo}-e{eleição}-u.json`).
- Códigos: eleição federal `6257` (presidente) e estadual `6259` (governador, senador, deputados). Cargos `0001`, `0003`, `0005`, `0006`, `0007` (`0008` distrital no DF).
- O servidor deduplica requisições e guarda cada arquivo por 15 s, então milhares de visitantes geram só algumas requisições ao TSE (que bloqueia IPs acima de 100 req/s e após muitos 404). Respostas da API saem com `s-maxage=10, stale-while-revalidate=30` para a CDN.
- Se o TSE falhar, o último resultado bom continua no ar.
- Percentuais calculados sobre votos válidos (`v.vv`), contando só candidaturas com destinação "Válido". A situação vem do texto `st` do TSE (o campo `e="s"` também marca quem vai ao 2º turno).
- Fotos: `…/{eleição}/fotos/{uf}/{sqcand}.jpeg` (com fallback para iniciais).

Arquivos principais:

| Arquivo | O quê |
| --- | --- |
| `src/lib/tse/config.ts` | URLs, códigos de eleição e cargo |
| `src/lib/tse/normalize.ts` | JSON bruto do TSE → modelo da aplicação |
| `src/lib/tse/seats.ts` | projeção de cadeiras (quociente eleitoral) |
| `src/lib/tse/source.ts` | cache, fila, agregações (panorama, bancadas) |
| `src/lib/tse/demo.ts` | gerador da apuração simulada |
| `src/lib/parties.ts` | cores dos partidos |

### Testar no ambiente de simulado do TSE

```bash
TSE_BASE=https://resultados-sim.tse.jus.br/simulado/simulado2026 \
TSE_ELEICAO_FEDERAL=21270 TSE_ELEICAO_ESTADUAL=21272 npm run dev
```

### 2º turno (25/10)

`TSE_ELEICAO_FEDERAL=6258 TSE_ELEICAO_ESTADUAL=6260` (confirme no `cdt2` de `resultados.tse.jus.br/oficial/comum/config/ele-c.json`).

## Créditos

Dados: Tribunal Superior Eleitoral (arquivos públicos de divulgação). Mapa: [svg-maps/brazil](https://github.com/VictorCazanave/svg-maps) de Victor Cazanave, CC BY 4.0. Projeto independente, sem vínculo com a Justiça Eleitoral.
