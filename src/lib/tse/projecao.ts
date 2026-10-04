import type { Corrida } from "./types";

/**
 * Modelo de projeção e probabilidade (Monte Carlo).
 *
 * Para cada abrangência (UF, exterior):
 *  - votos que faltam = eleitorado ainda não apurado × comparecimento observado × taxa de votos válidos observada;
 *  - a divisão desses votos segue a do que já foi apurado NAQUELA UF, com incerteza:
 *      desvio local (independente por UF) maior quando pouco foi apurado,
 *      + um desvio nacional correlacionado (todas as UFs puxam para o mesmo lado);
 *  - UF sem nenhum voto apurado usa a divisão nacional, com incerteza grande.
 * Repetimos milhares de vezes e contamos em quantos cenários cada coisa acontece.
 * É uma estimativa estatística — não é resultado oficial.
 */

export interface ProjCandidato {
  numero: string;
  nome: string;
  partido: string;
  atual: number; // % apurado agora
  proj: number; // % projetado (mediana)
  p05: number;
  p95: number;
  pPrimeiro: number; // chance de terminar em 1º (0–1)
  pTop2: number; // chance de terminar entre os 2 primeiros
  pMaioria: number; // chance de passar de 50% dos válidos
}

export interface Projecao {
  abrangencia: string;
  pctApurado: number;
  confianca: "baixa" | "media" | "alta";
  pSegundoTurno: number;
  votosRestantes: number;
  candidatos: ProjCandidato[];
  simulacoes: number;
}

const K = 5; // candidatos modelados individualmente; o resto vira "outros"

function prng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normal(r: () => number) {
  const u = Math.max(1e-12, r());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}
const quantil = (arr: Float64Array, q: number) => {
  const s = Float64Array.from(arr).sort();
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
};

export function projetar(partes: Corrida[], abrangencia: string, sims = 3000): Projecao | null {
  const ok = partes.filter((p) => p && p.candidatos.length);
  if (!ok.length) return null;

  // candidatos: os K mais votados no agregado atual
  const totais = new Map<string, { nome: string; partido: string; votos: number }>();
  for (const p of ok)
    for (const c of p.candidatos) {
      if (!c.valido) continue;
      const t = totais.get(c.numero) ?? { nome: c.nome, partido: c.partido, votos: 0 };
      t.votos += c.votos;
      totais.set(c.numero, t);
    }
  const ordem = [...totais.entries()].sort((a, b) => b[1].votos - a[1].votos);
  const top = ordem.slice(0, K).map(([n]) => n);
  const nC = top.length + 1; // + outros

  const vvTotal = ok.reduce((a, p) => a + p.votos.validos, 0);
  const compTotal = ok.reduce((a, p) => a + p.eleitorado.comparecimento, 0);
  const estTotal = ok.reduce((a, p) => a + p.eleitorado.apurado, 0);
  const tc = estTotal ? compTotal / estTotal : 0.78;
  const tv = compTotal ? vvTotal / compTotal : 0.95;
  const sharesNac = new Float64Array(nC);
  for (let i = 0; i < top.length; i++) sharesNac[i] = vvTotal ? (totais.get(top[i])!.votos / vvTotal) : 1 / nC;
  sharesNac[nC - 1] = Math.max(0, 1 - sharesNac.slice(0, nC - 1).reduce((a, b) => a + b, 0));

  // dados por parte
  const P = ok.map((p) => {
    const votos = new Float64Array(nC);
    let somaTop = 0;
    top.forEach((n, i) => {
      const c = p.candidatos.find((x) => x.numero === n && x.valido);
      votos[i] = c?.votos ?? 0;
      somaTop += votos[i];
    });
    votos[nC - 1] = Math.max(0, p.votos.validos - somaTop);
    const vv = p.votos.validos;
    const te = p.eleitorado.total;
    const est = p.final ? te : Math.min(te, p.eleitorado.apurado);
    const turnout = est > 0 && p.eleitorado.comparecimento > 0 ? p.eleitorado.comparecimento / est : tc;
    const taxaV = p.eleitorado.comparecimento > 0 ? vv / p.eleitorado.comparecimento : tv;
    const restante = p.final ? 0 : Math.max(0, (te - est) * turnout * taxaV);
    const fr = te ? Math.max(0, Math.min(1, 1 - est / te)) : 1; // fração do eleitorado ainda não apurada
    const shares = vv > 0 ? Array.from(votos, (v) => v / vv) : Array.from(sharesNac);
    const sigma = vv > 0 ? 0.012 + 0.07 * fr : 0.08;
    return { votos, restante, shares, sigma };
  });
  const restanteTotal = P.reduce((a, p) => a + p.restante, 0);
  const frNac = vvTotal + restanteTotal > 0 ? restanteTotal / (vvTotal + restanteTotal) : 0;
  const sigmaNac = 0.004 + 0.03 * frNac;

  const seed = Math.round(vvTotal) ^ (ok.length * 2654435761);
  const r = prng(seed);
  const finais = Array.from({ length: nC }, () => new Float64Array(sims));
  const primeiro = new Float64Array(nC);
  const top2 = new Float64Array(nC);
  const maioria = new Float64Array(nC);
  let segundo = 0;
  const final = new Float64Array(nC);
  const zNac = new Float64Array(nC);
  const sh = new Float64Array(nC);

  for (let s = 0; s < sims; s++) {
    final.fill(0);
    for (let i = 0; i < nC; i++) zNac[i] = normal(r) * sigmaNac;
    for (const p of P) {
      for (let i = 0; i < nC; i++) final[i] += p.votos[i];
      if (p.restante <= 0) continue;
      let soma = 0;
      for (let i = 0; i < nC; i++) {
        // desvio proporcional ao tamanho do candidato (candidatos pequenos variam menos em pontos absolutos)
        const escala = Math.sqrt(Math.max(0.0025, p.shares[i] * (1 - p.shares[i])) / 0.25);
        sh[i] = Math.max(0, p.shares[i] + (normal(r) * p.sigma + zNac[i]) * escala);
        soma += sh[i];
      }
      for (let i = 0; i < nC; i++) final[i] += (p.restante * sh[i]) / (soma || 1);
    }
    let tot = 0;
    for (let i = 0; i < nC; i++) tot += final[i];
    // ranking só entre candidatos (ignora "outros")
    let a = -1, b = -1;
    for (let i = 0; i < nC - 1; i++) {
      const v = final[i] / tot;
      finais[i][s] = v * 100;
      if (a < 0 || final[i] > final[a]) {
        b = a;
        a = i;
      } else if (b < 0 || final[i] > final[b]) b = i;
      if (v > 0.5) maioria[i]++;
    }
    primeiro[a]++;
    top2[a]++;
    if (b >= 0) top2[b]++;
    if (final[a] / tot <= 0.5) segundo++;
  }

  const pct = ok.reduce((a, p) => a + p.secoes.totalizadas, 0) / Math.max(1, ok.reduce((a, p) => a + p.secoes.total, 0)) * 100;
  const candidatos: ProjCandidato[] = top.map((n, i) => {
    const t = totais.get(n)!;
    return {
      numero: n,
      nome: t.nome,
      partido: t.partido,
      atual: vvTotal ? (t.votos / vvTotal) * 100 : 0,
      proj: quantil(finais[i], 0.5),
      p05: quantil(finais[i], 0.05),
      p95: quantil(finais[i], 0.95),
      pPrimeiro: primeiro[i] / sims,
      pTop2: top2[i] / sims,
      pMaioria: maioria[i] / sims,
    };
  });
  return {
    abrangencia,
    pctApurado: pct,
    confianca: pct < 15 ? "baixa" : pct < 60 ? "media" : "alta",
    pSegundoTurno: segundo / sims,
    votosRestantes: Math.round(restanteTotal),
    candidatos,
    simulacoes: sims,
  };
}
