/**
 * Reconstrói, momento a momento, o que o Modelo PULSO teria mostrado na noite do 2º turno.
 *
 * Não gravamos a saída do modelo ao vivo. Mas o TSE publica, para cada seção eleitoral, o horário em que o
 * boletim de urna foi recebido (arquivos "aux" do arquivo-urna). Com uma amostra de seções de cada uma das
 * ~6.300 zonas eleitorais e o resultado final de cada zona, estimamos quanto de cada zona já estava apurado a
 * cada instante e reaplicamos o MESMO modelo (src/lib/tse/projecao.ts) a cada 3 minutos.
 *
 * Entrada: JSON com linhas [uf, mun, zona, nSecoes, secoesTot, eleitorado, comparecimento, validos,
 *          votos13, votos22, brancos, nulos, [horários "dd/mm/aaaa hh:mm:ss" das seções amostradas]]
 * Uso: npx tsx scripts/historico-modelo.ts zonas.json public/historico/presidente-2t.json
 */
import fs from "node:fs";
import { projetar } from "../src/lib/tse/projecao";
import type { Corrida } from "../src/lib/tse/types";

type Linha = [string, string, string, number, number, number, number, number, number, number, number, number, string[]];

const [entrada, saida] = process.argv.slice(2);
const bruto = JSON.parse(fs.readFileSync(entrada, "utf8"));
/** formato agregado: { ufs: [{uf, te, ts}], passos: [{t (min desde 0h), d: [[vv, a, b, c, est, s, bn] por UF]}], totais } */
const agregado = !Array.isArray(bruto) ? (bruto as { ufs: { uf: string; te: number; ts: number }[]; passos: { t: number; d: number[][] }[]; totais: { vv: number; a: number; b: number; ts: number } }) : null;
const linhas = (agregado ? [] : bruto) as Linha[];

const A = { numero: "13", nome: "LULA", partido: "PT" };
const B = { numero: "22", nome: "FLAVIO BOLSONARO", partido: "PL" };

// minutos desde 25/10 00:00 (horário de Brasília)
const min = (s: string) => {
  const m = s.match(/(\d\d)\/(\d\d)\/\d{4} (\d\d):(\d\d):(\d\d)/);
  if (!m) return null;
  const dia = Number(m[1]) - 25;
  return dia * 1440 + Number(m[3]) * 60 + Number(m[4]) + Number(m[5]) / 60;
};

interface Zona {
  uf: string;
  mun: string;
  ts: number;
  te: number;
  c: number;
  vv: number;
  a: number;
  b: number;
  bn: number;
  t: number[]; // horários amostrados (ordenados)
}
const zonas: Zona[] = linhas.map((l) => ({
  uf: l[0],
  mun: l[1],
  ts: l[4],
  te: l[5],
  c: l[6],
  vv: l[7],
  a: l[8],
  b: l[9],
  bn: l[10] + l[11],
  t: l[12].map(min).filter((x): x is number => x != null).sort((p, q) => p - q),
}));

// zonas sem amostra: usa a mediana do município, senão da UF
const mediana = (xs: number[]) => (xs.length ? [...xs].sort((p, q) => p - q)[Math.floor(xs.length / 2)] : null);
const porMun = new Map<string, number[]>();
const porUF = new Map<string, number[]>();
for (const z of zonas)
  for (const t of z.t) {
    (porMun.get(z.uf + z.mun) ?? porMun.set(z.uf + z.mun, []).get(z.uf + z.mun)!).push(t);
    (porUF.get(z.uf) ?? porUF.set(z.uf, []).get(z.uf)!).push(t);
  }
let semAmostra = 0;
for (const z of zonas)
  if (!z.t.length && z.vv > 0) {
    const m = mediana(porMun.get(z.uf + z.mun) ?? []) ?? mediana(porUF.get(z.uf) ?? []);
    if (m != null) z.t = [m];
    semAmostra++;
  }

/** fração apurada da zona no instante t: as seções amostradas são quantis da chegada da zona */
function fracao(z: Zona, t: number) {
  const k = z.t.length;
  if (!k) return 1;
  const larg = Math.max(4, (z.t[k - 1] - z.t[0]) / k); // meia "janela" antes da 1ª e depois da última amostra
  const pts: [number, number][] = [[z.t[0] - larg, 0], ...z.t.map((h, i) => [h, (i + 0.5) / k] as [number, number]), [z.t[k - 1] + larg, 1]];
  if (t <= pts[0][0]) return 0;
  if (t >= pts[pts.length - 1][0]) return 1;
  for (let i = 1; i < pts.length; i++)
    if (t <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return x1 === x0 ? y1 : y0 + ((t - x0) / (x1 - x0)) * (y1 - y0);
    }
  return 1;
}

const todosT = zonas.flatMap((z) => z.t);
const inicio = 17 * 60;
const fim = todosT.length ? Math.ceil((Math.max(...todosT) + 10) / 3) * 3 : inicio;
const ufs = [...new Set(zonas.map((z) => z.uf))];
const tot = (f: (z: Zona) => number) => zonas.reduce((s, z) => s + f(z), 0);
const totais = { vv: tot((z) => z.vv), a: tot((z) => z.a), b: tot((z) => z.b), ts: tot((z) => z.ts) };

const pontos: unknown[] = [];
const serie: { pvA: number; atA: number; atB: number }[] = [];
/** somas por UF no instante t (a partir das zonas ou do arquivo já agregado) */
function porUFem(t: number, passo?: { t: number; d: number[][] }) {
  if (agregado && passo)
    return agregado.ufs.map((u, i) => {
      const [vv, a, b, c, est, s, bn] = passo.d[i];
      return { uf: u.uf, te: u.te, ts: u.ts, vv, a, b, c, est, s, bn };
    });
  return ufs.map((uf) => {
    let vv = 0, a = 0, b = 0, c = 0, est = 0, te = 0, ts = 0, s = 0, bn = 0;
    for (const z of zonas) {
      if (z.uf !== uf) continue;
      const f = fracao(z, t);
      te += z.te;
      ts += z.ts;
      vv += f * z.vv;
      a += f * z.a;
      b += f * z.b;
      c += f * z.c;
      est += f * z.te;
      s += f * z.ts;
      bn += f * z.bn;
    }
    return { uf, te, ts, vv, a, b, c, est, s, bn };
  });
}

const instantes = agregado ? agregado.passos.map((p) => p.t) : Array.from({ length: Math.floor((fim - inicio) / 3) + 1 }, (_, k) => inicio + k * 3);
if (agregado) Object.assign(totais, agregado.totais);
for (const [k, t] of instantes.entries()) {
  const partes: Corrida[] = [];
  let st = 0;
  for (const { uf, te, ts, vv, a, b, c, est, s, bn } of porUFem(t, agregado?.passos[k])) {
    st += s;
    if (vv <= 0) continue;
    const cand = (x: typeof A, v: number) => ({
      id: x.numero, numero: x.numero, nome: x.nome, nomeCompleto: x.nome, partido: x.partido, agremiacao: x.numero, agremiacaoNome: x.partido,
      votos: v, pct: (v / vv) * 100, eleito: false, segundoTurno: false, situacao: "", valido: true,
    });
    partes.push({
      cargo: "presidente", abrangencia: uf, vagas: 1, atualizadoEm: null, final: s >= ts - 0.5, status: "apurando",
      secoes: { total: ts, totalizadas: s, pct: (s / ts) * 100 },
      eleitorado: { total: te, apurado: est, comparecimento: c, pctComparecimento: 0, abstencao: est - c, pctAbstencao: 0 },
      votos: { total: vv + bn, validos: vv, brancos: 0, nulos: bn, pctBrancos: 0, pctNulos: 0 },
      candidatos: [cand(A, a), cand(B, b)], agremiacoes: [], totalCandidatos: 2, fonte: "tse",
    });
  }
  const pct = (st / totais.ts) * 100;
  if (!partes.length || pct < 1) continue;
  const p = projetar(partes, "br", 4000);
  if (!p) continue;
  const vvT = partes.reduce((x, q) => x + q.votos.validos, 0);
  const aT = partes.reduce((x, q) => x + q.candidatos[0].votos, 0);
  const bT = partes.reduce((x, q) => x + q.candidatos[1].votos, 0);
  const cA = p.candidatos.find((x) => x.numero === A.numero)!;
  const cB = p.candidatos.find((x) => x.numero === B.numero)!;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  pontos.push({
    h: `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`,
    pct: r2(pct),
    at: { [A.numero]: r2((aT / vvT) * 100), [B.numero]: r2((bT / vvT) * 100) },
    pv: { [A.numero]: r3(cA.pPrimeiro), [B.numero]: r3(cB.pPrimeiro) },
    pj: { [A.numero]: [r2(cA.p05), r2(cA.proj), r2(cA.p95)], [B.numero]: [r2(cB.p05), r2(cB.proj), r2(cB.p95)] },
  });
  serie.push({ pvA: cA.pPrimeiro, atA: aT, atB: bT });
  if (pct >= 99.9) break;
}

// marcos (vencedor final = quem tem mais votos no total)
const ganhaA = totais.a > totais.b;
const pvV = (i: number) => (ganhaA ? serie[i].pvA : 1 - serie[i].pvA);
const liderV = (i: number) => (ganhaA ? serie[i].atA > serie[i].atB : serie[i].atB > serie[i].atA);
const desdeQue = (cond: (i: number) => boolean) => {
  let k: number | undefined;
  for (let i = serie.length - 1; i >= 0; i--) {
    if (!cond(i)) break;
    k = i;
  }
  return k;
};
const marcos = {
  viradaModelo: desdeQue((i) => pvV(i) > 0.5),
  viradaContagem: desdeQue((i) => liderV(i)),
  decisao: desdeQue((i) => pvV(i) >= 0.99),
  final: serie.length - 1,
};

const out = {
  metodo:
    "Reconstrução: o modelo não teve sua saída gravada durante a noite. Para refazer a linha do tempo, usamos o horário em que o TSE recebeu o boletim de urna de uma amostra de seções de cada uma das zonas eleitorais (arquivos públicos do arquivo-urna) e o resultado final de cada zona, estimamos quanto de cada zona estava apurado a cada instante e rodamos o mesmo Modelo PULSO (4.000 simulações) a cada 3 minutos. Os horários são de Brasília e aproximados; o resultado final é o oficial do TSE.",
  gerado: new Date().toISOString(),
  finalistas: [A, B],
  pontos,
  marcos,
  checagem: { zonas: zonas.length, semAmostra, votos: { [A.numero]: totais.a, [B.numero]: totais.b }, validos: totais.vv },
};
fs.mkdirSync(saida.split("/").slice(0, -1).join("/"), { recursive: true });
fs.writeFileSync(saida, JSON.stringify(out));
console.log("pontos", pontos.length, "marcos", marcos, "checagem", out.checagem);
for (const i of [marcos.viradaModelo, marcos.viradaContagem, marcos.decisao].filter((x) => x != null) as number[]) console.log(JSON.stringify(pontos[i]));
