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
navegador ──SWR a cada 5s──> /api/*  (Next.js)  ──cache 4s, stale-while-revalidate + ETag (304)──> resultados.tse.jus.br
```

- Arquivo usado: resultado unificado do leiaute 2026 (`EA20`, `…/dados/{uf}/{uf}-c{cargo}-e{eleição}-u.json`).
- Códigos: eleição federal `6257` (presidente) e estadual `6259` (governador, senador, deputados). Cargos `0001`, `0003`, `0005`, `0006`, `0007` (`0008` distrital no DF).
- O servidor deduplica requisições, responde sempre na hora com o último dado e revalida por trás a cada 4 s usando `If-None-Match`/`If-Modified-Since` (o TSE responde 304 quando nada mudou). 404 fica 10 s em cache para não bloquear o IP no TSE. Respostas da API saem com `s-maxage=2, stale-while-revalidate=5`.
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

### Mapa por município + Redis

O resultado por município exige ~5.570 arquivos do TSE. O servidor lê o acompanhamento de cada UF e só baixa de novo as cidades que avançaram. Para todas as instâncias da Vercel compartilharem esse trabalho, conecte um **Upstash for Redis** (Vercel → Storage → Create Database → Upstash → conectar ao projeto). As variáveis `KV_REST_API_URL`/`KV_REST_API_TOKEN` são criadas sozinhas; uma instância por vez sincroniza (trava no Redis) e as demais leem o retrato pronto.

### Testar no ambiente de simulado do TSE

```bash
TSE_BASE=https://resultados-sim.tse.jus.br/simulado/simulado2026 \
TSE_ELEICAO_FEDERAL=21270 TSE_ELEICAO_ESTADUAL=21272 npm run dev
```

### Fases do site (automático)

| Fase | Quando | Home |
| --- | --- | --- |
| `1t` | até o 1º turno ser decidido | apuração do 1º turno (tudo na home) |
| `entre` | 1º turno decidido (ou a partir de 05/10 6h) | "Rumo ao 2º turno": contagem regressiva, finalistas, simulador, governadores no 2º turno; 1º turno nas abas |
| `2t` | 25/10/2026 a partir das 17h | apuração ao vivo do 2º turno (presidente + governadores); 1º turno nas abas |

Os códigos do 2º turno já estão configurados (federal `6258`, estadual `6260`, conferidos no `cdt2` do `ele-c.json`). Para forçar uma fase: variável `FASE=1t|entre|2t` na Vercel, ou `?fase=entre` na URL para testar (`?modo=simulacao&fase=2t` mostra o 2º turno simulado).

## Créditos

Dados: Tribunal Superior Eleitoral (arquivos públicos de divulgação). Mapa: [svg-maps/brazil](https://github.com/VictorCazanave/svg-maps) de Victor Cazanave, CC BY 4.0. Projeto independente, sem vínculo com a Justiça Eleitoral.
