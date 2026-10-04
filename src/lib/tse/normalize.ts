import { urlFoto } from "./config";
import type { Agremiacao, CargoKey, Candidato, Corrida } from "./types";

/* Formato bruto do arquivo unificado "-u.json" (EA20) do TSE, leiaute 2026.
 * O TSE usa siglas curtas e números como string. Tudo opcional: o normalizador é defensivo. */
type S = string | undefined | null;
interface RawCand {
  n?: S; sqcand?: S; nm?: S; nmu?: S; e?: S; st?: S; dvt?: S; vap?: S; pvap?: S;
  vs?: { tp?: S; nm?: S; nmu?: S; sgp?: S }[];
}
interface RawPar {
  n?: S; sg?: S; nm?: S; nfed?: S; cand?: RawCand[];
  // votos de legenda: o nome exato do campo pode variar entre leiautes; tentamos os conhecidos
  tvl?: S; vl?: S; vlg?: S; tvlg?: S; vleg?: S;
}
interface RawAgr { n?: S; nm?: S; tp?: S; com?: S; par?: RawPar[]; tvl?: S; vl?: S }
interface RawCarg { cd?: S; nmn?: S; nv?: S; agr?: RawAgr[] }
export interface RawUnificado {
  ele?: S; cdabr?: S; dg?: S; hg?: S; dt?: S; ht?: S; tf?: S; md?: S;
  carg?: RawCarg[];
  s?: Record<string, S>;
  e?: Record<string, S>;
  v?: Record<string, S>;
}

const num = (s: S) => {
  if (s == null || s === "") return 0;
  const n = Number(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const pctBr = (s: S) => (s == null || s === "" ? 0 : Number(String(s).replace(",", ".")) || 0);

const tipoAgr = (tp: S): Agremiacao["tipo"] =>
  tp === "f" ? "federacao" : tp === "c" ? "coligacao" : "partido";

export function normalizar(raw: RawUnificado, cargo: CargoKey, abr: string): Corrida {
  const carg = raw.carg?.[0];
  const s = raw.s ?? {};
  const e = raw.e ?? {};
  const v = raw.v ?? {};

  const validos = num(v.vv) || num(v.vvc);
  const candidatos: Candidato[] = [];
  const agremiacoes: Agremiacao[] = [];

  for (const agr of carg?.agr ?? []) {
    const id = String(agr.n ?? agr.nm ?? Math.random());
    const ag: Agremiacao = {
      id,
      nome: String(agr.nm ?? ""),
      tipo: tipoAgr(agr.tp),
      partidos: [],
      votosNominais: 0,
      votosLegenda: 0,
      votos: 0,
    };
    for (const par of agr.par ?? []) {
      const sg = String(par.sg ?? par.n ?? "?").toUpperCase();
      ag.partidos.push(sg);
      ag.votosLegenda += num(par.tvl ?? par.vl ?? par.vlg ?? par.tvlg ?? par.vleg);
      for (const c of par.cand ?? []) {
        const valido = !c.dvt || /^v[aá]lido/i.test(c.dvt);
        const st = String(c.st ?? "");
        const votos = num(c.vap);
        // O TSE marca e="s" também para quem vai ao 2º turno: vale o texto de `st` quando existe.
        const eleito = st ? /^eleito/i.test(st) : c.e === "s";
        const segundoTurno = /2.?º?\s*turno/i.test(st);
        if (valido) ag.votosNominais += votos;
        const vice = c.vs?.find((x) => x.tp === "v");
        candidatos.push({
          id: String(c.sqcand ?? c.n),
          numero: String(c.n ?? ""),
          nome: String(c.nmu ?? c.nm ?? ""),
          nomeCompleto: String(c.nm ?? ""),
          partido: sg,
          agremiacao: id,
          agremiacaoNome: ag.nome,
          votos,
          pct: 0,
          eleito,
          segundoTurno,
          situacao: st,
          valido,
          vice: vice ? String(vice.nmu ?? vice.nm ?? "") : undefined,
          foto: c.sqcand ? urlFoto(cargo, abr, String(c.sqcand)) : undefined,
        });
      }
    }
    if (agr.tvl || agr.vl) ag.votosLegenda = num(agr.tvl ?? agr.vl);
    ag.votos = ag.votosNominais + ag.votosLegenda;
    agremiacoes.push(ag);
  }

  // % sobre votos válidos (os do TSE dividem por vvc, que inclui anulados sub judice)
  const baseValidos = validos || candidatos.filter((c) => c.valido).reduce((a, c) => a + c.votos, 0);
  for (const c of candidatos) c.pct = baseValidos && c.valido ? (c.votos / baseValidos) * 100 : 0;
  candidatos.sort((a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome, "pt-BR"));

  const totalSecoes = num(s.ts);
  const totalizadas = num(s.st);
  const final = raw.tf === "s";
  const status: Corrida["status"] = final ? "final" : totalizadas > 0 ? "apurando" : "aguardando";
  const data = raw.dt && raw.ht ? `${raw.dt} ${raw.ht}` : raw.dg && raw.hg ? `${raw.dg} ${raw.hg}` : null;

  return {
    cargo,
    abrangencia: abr,
    vagas: num(carg?.nv) || 1,
    atualizadoEm: data,
    final,
    status,
    secoes: {
      total: totalSecoes,
      totalizadas,
      pct: pctBr(s.pst) || (totalSecoes ? (totalizadas / totalSecoes) * 100 : 0),
    },
    eleitorado: {
      total: num(e.te),
      apurado: num(e.est),
      comparecimento: num(e.c),
      pctComparecimento: pctBr(e.pc),
      abstencao: num(e.a),
      pctAbstencao: pctBr(e.pa),
    },
    votos: {
      total: num(v.tv),
      validos: baseValidos,
      brancos: num(v.vb),
      nulos: num(v.tvn),
      pctBrancos: pctBr(v.pvb),
      pctNulos: pctBr(v.ptvn),
    },
    candidatos,
    agremiacoes,
    totalCandidatos: candidatos.length,
    fonte: "tse",
  };
}
