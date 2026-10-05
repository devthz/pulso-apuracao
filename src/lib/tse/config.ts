import type { CargoKey } from "./types";

/**
 * Configuração da fonte de dados do TSE.
 * Códigos oficiais do 1º turno de 04/10/2026 (fonte: resultados.tse.jus.br/oficial/comum/config/ele-c.json
 * e "Informações técnicas sobre a divulgação de resultados 2026" do TSE).
 *
 * Para o 2º turno (25/10/2026) troque via variáveis de ambiente:
 *   TSE_ELEICAO_FEDERAL=6258  TSE_ELEICAO_ESTADUAL=6260
 * (confirme no campo `cdt2` do ele-c.json).
 *
 * Para testar no ambiente de simulado do TSE:
 *   TSE_BASE=https://resultados-sim.tse.jus.br/simulado/simulado2026
 *   TSE_ELEICAO_FEDERAL=21270  TSE_ELEICAO_ESTADUAL=21272
 */
export const TSE = {
  base: process.env.TSE_BASE ?? "https://resultados.tse.jus.br/oficial",
  ciclo: process.env.TSE_CICLO ?? "ele2026",
  federal: process.env.TSE_ELEICAO_FEDERAL ?? "6257",
  estadual: process.env.TSE_ELEICAO_ESTADUAL ?? "6259",
  // 2º turno: campo cdt2 do ele-c.json oficial (conferido: 6258 e 6260)
  federal2: process.env.TSE_ELEICAO_FEDERAL_2T ?? "6258",
  estadual2: process.env.TSE_ELEICAO_ESTADUAL_2T ?? "6260",
};

export type Turno = 1 | 2;

/** início da divulgação do 2º turno (25/10/2026, 17h de Brasília) */
export const INICIO_2T = process.env.SEGUNDO_TURNO_INICIO ?? "2026-10-25T17:00:00-03:00";

/** força a fase do site: "1t" | "entre" | "2t" (sem isso, é automática) */
export const FASE_FORCADA = process.env.FASE as "1t" | "entre" | "2t" | undefined;

/** "tse" (padrão) ou "simulacao" (dados fictícios gerados localmente, para desenvolver e demonstrar) */
export const MODO_DADOS: "tse" | "simulacao" =
  process.env.DATA_MODE === "simulacao" || process.env.DATA_MODE === "demo" ? "simulacao" : "tse";

/** início da divulgação dos resultados (fechamento das urnas às 17h de Brasília) */
export const INICIO_APURACAO = process.env.APURACAO_INICIO ?? "2026-10-04T17:00:00-03:00";

/** segundos que uma resposta do TSE fica em cache no servidor */
export const CACHE_TTL_S = Number(process.env.TSE_CACHE_TTL ?? 4);

export function codigoCargo(cargo: CargoKey, uf: string): number {
  switch (cargo) {
    case "presidente":
      return 1;
    case "governador":
      return 3;
    case "senador":
      return 5;
    case "depfed":
      return 6;
    case "depest":
      return uf === "df" ? 8 : 7; // DF elege deputados distritais
  }
}

export function codigoEleicao(cargo: CargoKey, turno: Turno = 1) {
  if (turno === 2) return cargo === "presidente" ? TSE.federal2 : TSE.estadual2;
  return cargo === "presidente" ? TSE.federal : TSE.estadual;
}

export function urlResultado(cargo: CargoKey, abr: string, turno: Turno = 1) {
  const ele = codigoEleicao(cargo, turno);
  const c = String(codigoCargo(cargo, abr)).padStart(4, "0");
  const e = ele.padStart(6, "0");
  return `${TSE.base}/${TSE.ciclo}/${ele}/dados/${abr}/${abr}-c${c}-e${e}-u.json`;
}

export function urlFoto(cargo: CargoKey, abr: string, sqcand: string, turno: Turno = 1) {
  // fotos são publicadas por UF da candidatura; presidente fica em "br"
  return `${TSE.base}/${TSE.ciclo}/${codigoEleicao(cargo, turno)}/fotos/${abr}/${sqcand}.jpeg`;
}
