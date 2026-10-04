/**
 * Gerador de apuração SIMULADA (candidatos e partidos fictícios).
 * Serve para desenvolver o visual sem depender do TSE. A apuração "anda" com o relógio:
 * começa do zero quando o servidor sobe e termina em ~DURACAO_MS.
 */
import { UF_MAP, UFS, type Regiao } from "../ufs";
import { projetarCadeiras } from "./seats";
import type { Agremiacao, CargoKey, Candidato, Corrida } from "./types";

const DURACAO_MS = Number(process.env.DEMO_DURACAO_S ?? 480) * 1000;
/** segundos de contagem regressiva antes da apuração simulada começar */
const ATRASO_MS = Number(process.env.DEMO_ATRASO_S ?? 30) * 1000;
const g = globalThis as unknown as { __pulsoInicio?: number };
const inicio = () => (g.__pulsoInicio ??= Date.now() + ATRASO_MS);
export const inicioSimulacao = () => new Date(inicio()).toISOString();

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PARTIDOS = [
  { sg: "PAV", n: "81", nome: "Partido Aurora Viva" },
  { sg: "MNB", n: "82", nome: "Movimento Nova Base" },
  { sg: "PFR", n: "83", nome: "Partido da Frente Renovadora" },
  { sg: "UDC", n: "84", nome: "União Democrática Cidadã" },
  { sg: "PSV", n: "85", nome: "Partido Social Vanguarda" },
  { sg: "AVL", n: "86", nome: "Aliança Liberal" },
  { sg: "PCN", n: "87", nome: "Partido Cívico Nacional" },
  { sg: "MVP", n: "88", nome: "Movimento Verde Popular" },
  { sg: "FPS", n: "89", nome: "Frente Progressista Social" },
  { sg: "ORB", n: "90", nome: "Órbita" },
  { sg: "PDM", n: "91", nome: "Partido Democrata Municipalista" },
  { sg: "SOMOS", n: "92", nome: "Somos" },
  { sg: "PIA", n: "93", nome: "Partido da Integração Amazônica" },
  { sg: "LUZ", n: "94", nome: "Luz" },
  { sg: "MRC", n: "95", nome: "Movimento Renovação Cidadã" },
];
const P = Object.fromEntries(PARTIDOS.map((p) => [p.sg, p]));
// federações fictícias (para exercitar o cálculo por agremiação)
const FEDERACOES: Record<string, string[]> = {
  "Federação Horizonte": ["PAV", "PCN", "MVP"],
  "Federação Travessia": ["PSV", "AVL"],
};
const agremiacaoDe = (sg: string) => {
  for (const [nome, ps] of Object.entries(FEDERACOES)) if (ps.includes(sg)) return { id: nome, nome, tipo: "federacao" as const };
  return { id: sg, nome: P[sg]?.nome ?? sg, tipo: "partido" as const };
};

const NOMES = ["Helena", "Rafael", "Cecília", "Otávio", "Marina", "Jorge", "Lúcia", "Bruno", "Aline", "Caio", "Débora", "Eduardo", "Fernanda", "Gustavo", "Íris", "João", "Karla", "Leandro", "Mirela", "Natan", "Olga", "Paulo", "Quitéria", "Renato", "Sabrina", "Tiago", "Úrsula", "Vinícius", "Wanda", "Yago", "Zilda", "Arthur", "Bianca", "Davi", "Elisa", "Flávia", "Heitor", "Isadora", "Lorenzo", "Maitê"];
const SOBRENOMES = ["Duarte", "Moura", "Prado", "Lins", "Kfouri", "Bastos", "Tavares", "Albuquerque", "Siqueira", "Fontes", "Barreto", "Campello", "Damasceno", "Esteves", "Falcão", "Guedes", "Holanda", "Ibiapina", "Jardim", "Leme", "Macedo", "Nóbrega", "Ornelas", "Pimentel", "Queiroga", "Rezende", "Sampaio", "Teixeira", "Uchoa", "Valadares", "Xavier", "Zanetti", "Aragão", "Brandão", "Coutinho", "Dantas", "Escobar", "Furtado", "Galvão", "Hipólito"];
const nomeFic = (r: () => number) => `${NOMES[Math.floor(r() * NOMES.length)]} ${SOBRENOMES[Math.floor(r() * SOBRENOMES.length)]}`;

const ELEITORADO_MI: Record<string, number> = {
  sp: 34.6, mg: 16.3, rj: 12.8, ba: 11.3, rs: 8.6, pr: 8.5, pe: 7.0, ce: 6.8, pa: 6.1, sc: 5.6, ma: 4.9,
  go: 4.9, am: 2.7, es: 2.9, pb: 3.0, rn: 2.6, al: 2.4, mt: 2.5, pi: 2.6, df: 2.2, ms: 2.0, se: 1.7,
  ro: 1.3, to: 1.1, ac: 0.6, ap: 0.55, rr: 0.37,
};

function progresso(uf: string) {
  const r = rng("ritmo-" + uf);
  const atraso = r() * 0.12 * DURACAO_MS;
  const vel = 0.72 + r() * 0.6;
  const t = Date.now() - inicio() - atraso;
  const p = Math.max(0, Math.min(1, t / (DURACAO_MS / vel)));
  // curva em S: começa devagar, acelera, desacelera no final
  return p < 1 ? p * p * (3 - 2 * p) : 1;
}

function horaBrasilia() {
  const d = new Date();
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...o }).format(d);
  return `${f({ day: "2-digit", month: "2-digit", year: "numeric" })} ${f({ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`;
}

/* ---------- Presidente ---------- */
const PRESIDENCIAVEIS = [
  { nome: "Helena Duarte", sg: "PAV", base: 38, vies: { Nordeste: 13, Norte: 4, Sul: -7, Sudeste: -2, "Centro-Oeste": -6 } },
  { nome: "Rafael Moura", sg: "MNB", base: 34, vies: { Nordeste: -11, Norte: 3, Sul: 10, Sudeste: 2, "Centro-Oeste": 9 } },
  { nome: "Cecília Prado", sg: "PFR", base: 10, vies: { Sudeste: 3, Sul: 1, Nordeste: -2 } },
  { nome: "Otávio Lins", sg: "UDC", base: 7, vies: { Sudeste: 1, Sul: 2 } },
  { nome: "Marina Kfouri", sg: "PSV", base: 5, vies: { Nordeste: 1 } },
  { nome: "Jorge Bastos", sg: "AVL", base: 3.5, vies: {} },
  { nome: "Lúcia Tavares", sg: "PCN", base: 2.5, vies: {} },
] as const satisfies readonly { nome: string; sg: string; base: number; vies: Partial<Record<Regiao, number>> }[];

interface Spec {
  nome: string;
  sg: string;
  numero: string;
  share: number; // participação final nos votos da agremiação/UF
  deriva: number; // viés das primeiras urnas (em pontos)
}

function montarCorrida(
  cargo: CargoKey,
  abr: string,
  vagas: number,
  specs: Spec[],
  opts: { votosPorEleitor?: number; legenda?: Record<string, number> } = {},
): Corrida {
  const ufs = abr === "br" ? UFS.map((u) => u.sigla) : [abr];
  // agregação: para BR somamos as UFs (presidente)
  let eleitorado = 0, apurado = 0, comparecimento = 0, total = 0, brancos = 0, nulos = 0, ts = 0, st = 0;
  const votos = new Map<string, number>();
  for (const uf of ufs) {
    const p = progresso(uf);
    const el = Math.round((ELEITORADO_MI[uf] ?? 1) * 1_000_000);
    const secoes = Math.round(el / 330);
    const r = rng(`${cargo}-${uf}-comp`);
    const tc = 0.76 + r() * 0.08;
    const comp = Math.round(el * tc * p);
    const vpe = opts.votosPorEleitor ?? 1;
    const bn = abr === "br" ? 0.05 : 0.07 + r() * 0.04;
    const vv = Math.round(comp * vpe * (1 - bn));
    eleitorado += el;
    apurado += Math.round(el * p);
    comparecimento += comp;
    total += comp * vpe;
    brancos += Math.round(comp * vpe * bn * 0.38);
    nulos += Math.round(comp * vpe * bn * 0.62);
    ts += secoes;
    st += Math.round(secoes * p);

    const specsUF = abr === "br" ? presidentesUF(uf) : specs;
    const soma = specsUF.reduce((a, s) => a + Math.max(0.05, s.share + s.deriva * (1 - p)), 0);
    for (const s of specsUF) {
      const sh = Math.max(0.05, s.share + s.deriva * (1 - p)) / soma;
      votos.set(s.numero, (votos.get(s.numero) ?? 0) + Math.round(vv * sh));
    }
  }

  const final = st >= ts;
  const agMap = new Map<string, Agremiacao>();
  const candidatos: Candidato[] = specs.map((s) => {
    const ag = agremiacaoDe(s.sg);
    const v = votos.get(s.numero) ?? 0;
    const a = agMap.get(ag.id) ?? { id: ag.id, nome: ag.nome, tipo: ag.tipo, partidos: [], votosNominais: 0, votosLegenda: 0, votos: 0 };
    if (!a.partidos.includes(s.sg)) a.partidos.push(s.sg);
    a.votosNominais += v;
    agMap.set(ag.id, a);
    return {
      id: `${abr}-${cargo}-${s.numero}`,
      numero: s.numero,
      nome: s.nome,
      nomeCompleto: s.nome,
      partido: s.sg,
      agremiacao: ag.id,
      agremiacaoNome: ag.nome,
      votos: v,
      pct: 0,
      eleito: false,
      segundoTurno: false,
      situacao: "",
      valido: true,
    };
  });
  // votos de legenda (proporcional) — tirados dos válidos
  let somaNominal = candidatos.reduce((a, c) => a + c.votos, 0);
  if (opts.legenda) {
    for (const a of agMap.values()) {
      const frac = a.partidos.reduce((x, sg) => x + (opts.legenda![sg] ?? 0), 0) / a.partidos.length;
      a.votosLegenda = Math.round(a.votosNominais * frac);
    }
  }
  for (const a of agMap.values()) a.votos = a.votosNominais + a.votosLegenda;
  const legendaTotal = [...agMap.values()].reduce((x, a) => x + a.votosLegenda, 0);
  somaNominal = somaNominal || 1;
  const vvTotal = somaNominal + legendaTotal;
  for (const c of candidatos) c.pct = vvTotal ? (c.votos / vvTotal) * 100 : 0;
  candidatos.sort((a, b) => b.votos - a.votos);

  const corrida: Corrida = {
    cargo,
    abrangencia: abr,
    vagas,
    atualizadoEm: horaBrasilia(),
    final,
    status: final ? "final" : st > 0 ? "apurando" : "aguardando",
    secoes: { total: ts, totalizadas: st, pct: ts ? (st / ts) * 100 : 0 },
    eleitorado: {
      total: eleitorado,
      apurado,
      comparecimento,
      pctComparecimento: apurado ? (comparecimento / apurado) * 100 : 0,
      abstencao: apurado - comparecimento,
      pctAbstencao: apurado ? ((apurado - comparecimento) / apurado) * 100 : 0,
    },
    votos: {
      total,
      validos: vvTotal,
      brancos,
      nulos,
      pctBrancos: total ? (brancos / total) * 100 : 0,
      pctNulos: total ? (nulos / total) * 100 : 0,
    },
    candidatos,
    agremiacoes: [...agMap.values()],
    totalCandidatos: candidatos.length,
    fonte: "simulacao",
  };

  if (final) aplicarSituacaoFinal(corrida);
  return corrida;
}

function aplicarSituacaoFinal(c: Corrida) {
  const cs = c.candidatos;
  if (c.cargo === "presidente" || c.cargo === "governador") {
    if (cs[0] && cs[0].pct > 50) {
      cs[0].eleito = true;
      cs[0].situacao = "Eleito";
      cs.slice(1).forEach((x) => (x.situacao = "Não eleito"));
    } else {
      cs.slice(0, 2).forEach((x) => ((x.segundoTurno = true), (x.situacao = "2º turno")));
      cs.slice(2).forEach((x) => (x.situacao = "Não eleito"));
    }
  } else if (c.cargo === "senador") {
    cs.forEach((x, i) => {
      x.eleito = i < c.vagas;
      x.situacao = x.eleito ? "Eleito" : "Não eleito";
    });
  } else {
    const { eleitos } = projetarCadeiras(c);
    const ids = new Set(eleitos.map((e) => e.id));
    cs.forEach((x) => {
      x.eleito = ids.has(x.id);
      x.situacao = x.eleito ? "Eleito" : "Não eleito";
    });
  }
}

function presidentesUF(uf: string): Spec[] {
  const reg = UF_MAP[uf]?.regiao ?? "Sudeste";
  const r = rng("pres-" + uf);
  return PRESIDENCIAVEIS.map((p, i) => ({
    nome: p.nome,
    sg: p.sg,
    numero: P[p.sg].n,
    share: Math.max(0.3, p.base + ((p.vies as Partial<Record<Regiao, number>>)[reg] ?? 0) + (r() - 0.5) * (i < 2 ? 12 : 3)),
    deriva: (r() - 0.5) * (i < 2 ? 8 : 1.5),
  }));
}

function specsMajoritario(cargo: "governador" | "senador", uf: string): Spec[] {
  const r = rng(`${cargo}-${uf}`);
  const n = cargo === "governador" ? 4 + Math.floor(r() * 3) : 6 + Math.floor(r() * 3);
  const partidos = [...PARTIDOS].sort(() => r() - 0.5).slice(0, n);
  const domin = r();
  return partidos.map((p, i) => ({
    nome: nomeFic(r),
    sg: p.sg,
    numero: cargo === "governador" ? p.n : `${p.n}${(i % 9) + 1}`,
    share: i === 0 ? 30 + domin * 35 : Math.max(1, (i === 1 ? 32 : 18 / i) * (0.6 + r() * 0.7)),
    deriva: (r() - 0.5) * 9,
  }));
}

function specsProporcional(cargo: "depfed" | "depest", uf: string, vagas: number): { specs: Spec[]; legenda: Record<string, number> } {
  const r = rng(`${cargo}-${uf}`);
  const nPart = 9 + Math.floor(r() * 6);
  const partidos = [...PARTIDOS].sort(() => r() - 0.5).slice(0, nPart);
  const porPartido = Math.max(5, Math.min(36, Math.round(vagas * 0.5) + 3));
  const specs: Spec[] = [];
  const legenda: Record<string, number> = {};
  partidos.forEach((p, pi) => {
    const forca = Math.pow(0.78, pi) * (0.6 + r() * 0.8);
    legenda[p.sg] = 0.04 + r() * 0.08;
    for (let k = 0; k < porPartido; k++) {
      const peso = forca * Math.pow(0.82, k) * (0.5 + r());
      specs.push({
        nome: nomeFic(r),
        sg: p.sg,
        numero: `${p.n}${String(100 + Math.floor(r() * 899) + (cargo === "depest" ? 1000 : 0)).slice(-3)}${k % 10}`,
        share: peso * 100,
        deriva: (r() - 0.5) * peso * 40,
      });
    }
  });
  // números únicos
  const vistos = new Set<string>();
  for (const s of specs) {
    while (vistos.has(s.numero)) s.numero = String(Number(s.numero) + 1);
    vistos.add(s.numero);
  }
  return { specs, legenda };
}

export function corridaSimulada(cargo: CargoKey, abr: string): Corrida {
  const uf = UF_MAP[abr];
  if (cargo === "presidente") {
    const specs: Spec[] =
      abr === "br"
        ? PRESIDENCIAVEIS.map((p) => ({ nome: p.nome, sg: p.sg, numero: P[p.sg].n, share: p.base, deriva: 0 }))
        : presidentesUF(abr);
    const c = montarCorrida("presidente", abr, 1, specs);
    for (const cand of c.candidatos) {
      const p = PRESIDENCIAVEIS.find((x) => x.nome === cand.nome);
      if (p) cand.vice = `${nomeFic(rng("vice-" + p.nome))}`;
    }
    return c;
  }
  if (!uf) throw new Error("UF inválida");
  if (cargo === "governador") return montarCorrida(cargo, abr, 1, specsMajoritario("governador", abr));
  if (cargo === "senador") return montarCorrida(cargo, abr, 2, specsMajoritario("senador", abr), { votosPorEleitor: 2 });
  const vagas = cargo === "depfed" ? uf.depfed : uf.depest;
  const { specs, legenda } = specsProporcional(cargo, abr, vagas);
  return montarCorrida(cargo, abr, vagas, specs, { legenda });
}
