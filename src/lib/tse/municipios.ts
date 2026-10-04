import "server-only";
import { after } from "next/server";
import IDS from "@/data/municipios-ids.json";
import { kvAtivo, kvDel, kvGet, kvSet, kvTrava } from "../kv";
import { UFS } from "../ufs";
import { TSE } from "./config";
import { corridaSimulada } from "./demo";
import { normalizar, type RawUnificado } from "./normalize";

/**
 * Resultado de PRESIDENTE por município.
 *
 * O TSE publica um arquivo por município ({uf}{cod}-c0001-e006257-u.json, ~7 KB), ou seja, ~5.570 arquivos.
 * Para não baixar tudo a cada rodada:
 *  1. lemos o arquivo de acompanhamento de cada UF ({uf}-e006257-ab.json), que diz quantas seções cada
 *     município já totalizou;
 *  2. só baixamos de novo os municípios cujo número de seções mudou;
 *  3. com um limitador de taxa (o TSE bloqueia IPs acima de 100 req/s).
 * A sincronização roda em segundo plano; a API sempre responde na hora com o que já tem.
 * O código IBGE (cdi) vem do arquivo de configuração de municípios do TSE.
 */

export interface MunicipiosPayload {
  fonte: "tse" | "simulacao";
  geradoEm: string;
  carregados: number; // municípios com resultado já lido
  total: number;
  /** número do candidato → [nome de urna, partido] */
  cand: Record<string, [string, string]>;
  /** código IBGE → [seções totalizadas (‰), votos válidos, n1, v1, n2, v2, n3, v3] */
  m: Record<string, (number | string)[]>;
}

interface Mun {
  uf: string;
  cd: string; // código TSE
  cdi: string; // código IBGE
  st: number; // seções totalizadas na última leitura do resultado
  ts: number;
  stAb: number; // seções totalizadas segundo o acompanhamento
  vv: number;
  top: [string, number][];
  lido: boolean;
}

const ele = () => TSE.federal;
const ele6 = () => TSE.federal.padStart(6, "0");
const base = () => `${TSE.base}/${TSE.ciclo}/${ele()}`;

interface Estado {
  muns: Map<string, Mun>; // por código TSE
  cand: Record<string, [string, string]>;
  configEm: number;
  abEtag: Record<string, string>;
  rodando?: Promise<void>;
  ultimaRodada: number;
}
const g = globalThis as unknown as { __pulsoMun?: Estado };
const novoEstado = (): Estado => ({ muns: new Map(), cand: {}, configEm: 0, abEtag: {}, ultimaRodada: 0 });
const S: Estado = (g.__pulsoMun ??= novoEstado());

/* ---------- limitador de taxa: no máximo N requisições por segundo e K simultâneas ---------- */
const MAX_RPS = Number(process.env.TSE_MUN_RPS ?? 30);
const MAX_SIMULT = 8;
let emCurso = 0;
let janela: number[] = [];
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function limitar<T>(fn: () => Promise<T>): Promise<T> {
  for (;;) {
    const agora = Date.now();
    janela = janela.filter((t) => agora - t < 1000);
    if (janela.length < MAX_RPS && emCurso < MAX_SIMULT) break;
    await espera(30);
  }
  janela.push(Date.now());
  emCurso++;
  try {
    return await fn();
  } finally {
    emCurso--;
  }
}

async function getJSON<T>(url: string, etagKey?: string): Promise<T | null | "igual"> {
  const headers: Record<string, string> = { accept: "application/json", "user-agent": "pulso-apuracao/1.2" };
  if (etagKey && S.abEtag[etagKey]) headers["if-none-match"] = S.abEtag[etagKey];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await limitar(() => fetch(url, { cache: "no-store", headers, signal: ctrl.signal }));
    if (r.status === 304) return "igual";
    if (!r.ok) return null;
    if (etagKey) {
      const et = r.headers.get("etag");
      if (et) S.abEtag[etagKey] = et;
    }
    return (await r.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function garantirConfig() {
  if (S.muns.size && Date.now() - S.configEm < 3_600_000) return;
  const cm = await getJSON<{ abr: { cd: string; mu: { cd: string; cdi: string; nm: string }[] }[] }>(
    `${base()}/config/mun-e${ele6()}-cm.json`,
  );
  if (!cm || cm === "igual") return;
  for (const a of cm.abr) {
    if (a.cd === "zz") continue;
    for (const m of a.mu) {
      if (!S.muns.has(m.cd))
        S.muns.set(m.cd, { uf: a.cd, cd: m.cd, cdi: m.cdi, st: -1, ts: 0, stAb: 0, vv: 0, top: [], lido: false });
    }
  }
  S.configEm = Date.now();
}

async function lerAcompanhamento(uf: string) {
  const ab = await getJSON<{ abr: { tpabr: string; cdabr: string; s?: { ts?: string; st?: string } }[] }>(
    `${base()}/dados/${uf}/${uf}-e${ele6()}-ab.json`,
    `ab-${uf}`,
  );
  if (!ab || ab === "igual") return;
  for (const a of ab.abr) {
    if (a.tpabr !== "mun") continue;
    const m = S.muns.get(a.cdabr);
    if (!m) continue;
    m.stAb = Number(a.s?.st ?? 0);
    m.ts = Number(a.s?.ts ?? m.ts);
  }
}

async function lerMunicipio(m: Mun) {
  const raw = await getJSON<RawUnificado>(`${base()}/dados/${m.uf}/${m.uf}${m.cd}-c0001-e${ele6()}-u.json`);
  if (!raw || raw === "igual") return;
  const c = normalizar(raw, "presidente", m.uf);
  m.st = c.secoes.totalizadas;
  m.ts = c.secoes.total || m.ts;
  m.vv = c.votos.validos;
  m.top = c.candidatos.filter((x) => x.valido).slice(0, 3).map((x) => [x.numero, x.votos]);
  m.lido = true;
  for (const x of c.candidatos) if (!S.cand[x.numero]) S.cand[x.numero] = [x.nome, x.partido];
}

const ORCAMENTO_MS = 45_000;

/* ---------- persistência compartilhada (Redis) ----------
 * Na Vercel o servidor roda em várias instâncias, e cada uma nasce com a memória vazia.
 * Com Redis: uma instância por vez (trava) sincroniza com o TSE e grava um retrato completo;
 * as outras só leem esse retrato — então qualquer instância responde com o mapa inteiro na hora.
 */
const CHAVE = () => `pulso:mun:${TSE.ciclo}:${ele()}:v1`;
const CHAVE_TRAVA = () => `${CHAVE()}:trava`;
const DONO = Math.random().toString(36).slice(2);
interface Retrato {
  versao: number;
  cand: Record<string, [string, string]>;
  muns: (string | number)[][]; // [cd, cdi, uf, st, ts, stAb, vv, n1, v1, n2, v2, n3, v3]
}
const gk = globalThis as unknown as { __pulsoMunKV?: { versao: number; lidoEm: number; lendo?: Promise<void>; salvoEm: number } };
const K = (gk.__pulsoMunKV ??= { versao: 0, lidoEm: 0, salvoEm: 0 });

function aplicarRetrato(r: Retrato) {
  if (r.versao <= K.versao) return;
  for (const [cd, cdi, uf, st, ts, stAb, vv, ...top] of r.muns) {
    const atual = S.muns.get(String(cd));
    // não regride: mantém o que esta instância tiver de mais novo
    if (atual?.lido && atual.st > Number(st)) continue;
    const t: [string, number][] = [];
    for (let i = 0; i + 1 < top.length; i += 2) t.push([String(top[i]), Number(top[i + 1])]);
    S.muns.set(String(cd), {
      cd: String(cd),
      cdi: String(cdi),
      uf: String(uf),
      st: Number(st),
      ts: Number(ts),
      stAb: Math.max(Number(stAb), atual?.stAb ?? 0),
      vv: Number(vv),
      top: t,
      lido: true,
    });
  }
  Object.assign(S.cand, r.cand);
  K.versao = r.versao;
}

/** lê o retrato do Redis (no máximo a cada 5 s por instância) */
async function hidratar() {
  if (!kvAtivo) return;
  if (Date.now() - K.lidoEm < 5_000) return;
  K.lendo ??= (async () => {
    try {
      const txt = await kvGet(CHAVE());
      if (txt) aplicarRetrato(JSON.parse(txt) as Retrato);
    } catch {
      /* retrato corrompido: ignora */
    } finally {
      K.lidoEm = Date.now();
      K.lendo = undefined;
    }
  })();
  await K.lendo;
}

async function salvar() {
  if (!kvAtivo) return;
  const muns = [...S.muns.values()].filter((m) => m.lido).map((m) => [m.cd, m.cdi, m.uf, m.st, m.ts, m.stAb, m.vv, ...m.top.flat()]);
  const r: Retrato = { versao: Date.now(), cand: S.cand, muns };
  await kvSet(CHAVE(), JSON.stringify(r), 60 * 60 * 24 * 7);
  K.versao = r.versao;
  K.salvoEm = Date.now();
}

async function rodada() {
  const inicio = Date.now();
  await hidratar();
  // com Redis, só uma instância sincroniza por vez
  if (kvAtivo && !(await kvTrava(CHAVE_TRAVA(), DONO, 58))) return;
  try {
    await garantirConfig();
    if (!S.muns.size) return;
    // acompanhamento das 27 UFs (pequeno; com ETag quase sempre volta 304)
    await Promise.all(UFS.map((u) => lerAcompanhamento(u.sigla)));
    // municípios que mudaram (ou nunca lidos com votos), os que nunca foram lidos primeiro
    const fila = [...S.muns.values()]
      .filter((m) => m.stAb > 0 && m.stAb !== m.st)
      .sort((a, b) => Number(a.lido) - Number(b.lido) || b.stAb - b.st - (a.stAb - a.st));
    let i = 0;
    let lidosDesdeSalvar = 0;
    const trabalhadores = Array.from({ length: MAX_SIMULT }, async () => {
      while (i < fila.length && Date.now() - inicio < ORCAMENTO_MS) {
        const m = fila[i++];
        await lerMunicipio(m);
        lidosDesdeSalvar++;
        // na carga inicial (muitos municípios), grava retratos parciais a cada ~15 s
        if (lidosDesdeSalvar > 200 && Date.now() - K.salvoEm > 15_000) {
          lidosDesdeSalvar = 0;
          await salvar();
        }
      }
    });
    await Promise.all(trabalhadores);
    if (fila.length) await salvar();
  } finally {
    if (kvAtivo) await kvDel(CHAVE_TRAVA());
  }
}

function garantirSincronizacao() {
  const agora = Date.now();
  if (!S.rodando && agora - S.ultimaRodada > 8_000) {
    S.rodando = rodada()
      .catch(() => {})
      .finally(() => {
        S.ultimaRodada = Date.now();
        S.rodando = undefined;
      });
  }
  if (S.rodando) {
    const p = S.rodando;
    try {
      after(() => p);
    } catch {
      /* fora de requisição */
    }
  }
}

const brasilia = () =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", timeStyle: "medium" }).format(new Date());

export async function getMunicipios(modo: "tse" | "simulacao"): Promise<MunicipiosPayload> {
  if (modo === "simulacao") return municipiosSimulados();
  // instância nova: pega o retrato compartilhado antes de responder (rápido, ~50 ms)
  await Promise.race([hidratar(), espera(1500)]);
  garantirSincronizacao();
  // nada carregado ainda (primeira vez de todas): espera um pouco a sincronização para já devolver algo
  if (S.rodando && ![...S.muns.values()].some((x) => x.lido)) await Promise.race([S.rodando, espera(6000)]);
  const m: MunicipiosPayload["m"] = {};
  let carregados = 0;
  for (const x of S.muns.values()) {
    if (!x.lido) continue;
    carregados++;
    m[x.cdi] = [x.ts ? Math.round((x.st / x.ts) * 1000) : 0, x.vv, ...x.top.flat()];
  }
  const total = Math.max(S.muns.size, 5570);
  return { fonte: "tse", geradoEm: brasilia(), carregados, total, cand: S.cand, m };
}

/* ---------- simulação: deriva cada município do resultado simulado da UF, com variação local ---------- */
const IBGE_UF: Record<string, string> = {
  "11": "ro", "12": "ac", "13": "am", "14": "rr", "15": "pa", "16": "ap", "17": "to", "21": "ma", "22": "pi", "23": "ce",
  "24": "rn", "25": "pb", "26": "pe", "27": "al", "28": "se", "29": "ba", "31": "mg", "32": "es", "33": "rj", "35": "sp",
  "41": "pr", "42": "sc", "43": "rs", "50": "ms", "51": "mt", "52": "go", "53": "df",
};
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}
function municipiosSimulados(): MunicipiosPayload {
  const porUF = new Map(UFS.map((u) => [u.sigla, corridaSimulada("presidente", u.sigla)]));
  const cand: MunicipiosPayload["cand"] = {};
  const m: MunicipiosPayload["m"] = {};
  let carregados = 0;
  for (const id of IDS as string[]) {
    const c = porUF.get(IBGE_UF[id.slice(0, 2)]);
    if (!c) continue;
    const pUF = c.secoes.pct / 100;
    const p = Math.min(1, Math.max(0, pUF * (0.55 + hash(id + "p") * 0.9)));
    if (p <= 0) continue;
    const vv = Math.round((3000 + hash(id + "v") * 60000) * p);
    const cs = c.candidatos.slice(0, 3);
    const tot = cs.reduce((a, x) => a + x.pct, 0) || 1;
    const shares = cs.map((x, i) => Math.max(1, x.pct + (i < 2 ? (hash(id + i) - 0.5) * 70 : (hash(id + i) - 0.5) * 6)) / tot);
    const soma = shares.reduce((a, b) => a + b, 0);
    const top = cs
      .map((x, i) => [x.numero, Math.round((vv * shares[i]) / soma)] as [string, number])
      .sort((a, b) => b[1] - a[1]);
    for (const x of cs) cand[x.numero] = [x.nome, x.partido];
    m[id] = [Math.round(p * 1000), vv, ...top.flat()];
    carregados++;
  }
  return { fonte: "simulacao", geradoEm: brasilia(), carregados, total: (IDS as string[]).length, cand, m };
}
