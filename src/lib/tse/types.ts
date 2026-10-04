export type CargoKey = "presidente" | "governador" | "senador" | "depfed" | "depest";

export const CARGO_KEYS: CargoKey[] = ["presidente", "governador", "senador", "depfed", "depest"];

export const CARGO_LABEL: Record<CargoKey, string> = {
  presidente: "Presidente",
  governador: "Governador",
  senador: "Senado",
  depfed: "Deputado Federal",
  depest: "Deputado Estadual",
};

export const isProporcional = (c: CargoKey) => c === "depfed" || c === "depest";

export interface Candidato {
  id: string; // sqcand
  numero: string;
  nome: string; // nome de urna
  nomeCompleto: string;
  partido: string; // sigla
  agremiacao: string; // id da agremiação (federação/partido isolado/coligação)
  agremiacaoNome: string;
  votos: number;
  pct: number; // % sobre válidos (0–100)
  eleito: boolean;
  segundoTurno: boolean;
  situacao: string; // texto do TSE ("Eleito", "2º turno", "Não eleito", "Eleito por QP"...)
  valido: boolean;
  vice?: string;
  foto?: string;
}

export interface Agremiacao {
  id: string;
  nome: string;
  tipo: "federacao" | "partido" | "coligacao";
  partidos: string[];
  votosNominais: number;
  votosLegenda: number;
  votos: number;
}

export interface Corrida {
  cargo: CargoKey;
  abrangencia: string; // "br" ou UF minúscula
  vagas: number;
  atualizadoEm: string | null; // "dd/mm/aaaa hh:mm:ss" (horário de Brasília)
  final: boolean;
  status: "aguardando" | "apurando" | "final";
  secoes: { total: number; totalizadas: number; pct: number };
  eleitorado: {
    total: number;
    apurado: number;
    comparecimento: number;
    pctComparecimento: number;
    abstencao: number;
    pctAbstencao: number;
  };
  votos: {
    total: number;
    validos: number;
    brancos: number;
    nulos: number;
    pctBrancos: number;
    pctNulos: number;
  };
  candidatos: Candidato[];
  agremiacoes: Agremiacao[];
  /** total de candidatos antes do corte (listas proporcionais são truncadas na API) */
  totalCandidatos: number;
  fonte: "tse" | "simulacao";
}

/** Resumo enxuto por UF, usado no mapa e nas grades */
export interface ResumoUF {
  uf: string;
  pct: number; // % seções totalizadas
  final: boolean;
  status: Corrida["status"];
  vagas: number;
  lideres: Pick<Candidato, "id" | "numero" | "nome" | "partido" | "votos" | "pct" | "eleito" | "segundoTurno" | "situacao" | "foto">[];
  validos: number;
  atualizadoEm: string | null;
  erro?: string;
  /** modelo de probabilidade (governador): chance do líder vencer no 1º turno etc. */
  proj?: { numero: string; pMaioria: number; pPrimeiro: number; proj: number; p05: number; p95: number; pSegundoTurno: number };
}

export interface Panorama {
  cargo: CargoKey;
  fonte: Corrida["fonte"];
  geradoEm: string;
  /** ISO — quando a apuração começa (17h de Brasília; na simulação, o início do relógio simulado) */
  inicioApuracao: string;
  nacional?: Corrida; // só presidente
  ufs: ResumoUF[];
}

export interface Assento {
  partido: string;
  cadeiras: number;
  votos: number;
}

export interface Bancada {
  cargo: CargoKey;
  abrangencia: string;
  fonte: Corrida["fonte"];
  oficial: boolean; // true = situação do TSE; false = projeção pelas regras do quociente
  totalVagas: number;
  pctApurado: number;
  partidos: Assento[];
  porUF?: Record<string, Assento[]>;
  eleitos: Eleito[];
  geradoEm: string;
}

export type Eleito = Pick<Candidato, "id" | "nome" | "partido" | "votos" | "pct" | "numero" | "foto"> & {
  uf?: string;
};
