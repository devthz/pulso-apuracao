import "server-only";
import { after } from "next/server";
import { UFS } from "../ufs";
import { CACHE_TTL_S, FASE_FORCADA, INICIO_2T, INICIO_APURACAO, MODO_DADOS, urlFoto, urlResultado, type Turno } from "./config";
import { corridaSimulada, corridaSimuladaFinal, inicioSimulacao } from "./demo";
import { normalizar, type RawUnificado } from "./normalize";
import { projetar, type Projecao } from "./projecao";
import { contarPorPartido, eleitosMajoritario, paraEleito, projetarCadeiras, somarAssentos } from "./seats";
import type { Agremiacao, Bancada, Candidato, CargoKey, Corrida, Panorama, ResumoUF } from "./types";

import { AindaNaoPublicado } from "./erros";
export { AindaNaoPublicado };

type Modo = "tse" | "simulacao";

/* ---------- cache em memória: stale-while-revalidate + requisições condicionais (ETag) ----------
 * - Resposta sempre imediata: se o dado está "velho", devolvemos o último bom e atualizamos em segundo plano.
 * - Revalidação com If-None-Match / If-Modified-Since: quando nada mudou o TSE responde 304 (sem corpo),
 *   então dá para consultar a cada poucos segundos sem baixar arquivos grandes de novo.
 * - 404 (ainda não publicado) fica um tempo em cache: muitos 404 seguidos bloqueiam o IP no TSE.
 */
interface Entrada {
  em: number; // última vez que confirmamos o dado com o TSE
  valor?: Corrida;
  etag?: string;
  lastMod?: string;
  emVoo?: Promise<Corrida>;
  naoPublicadoAte?: number;
}
const g = globalThis as unknown as { __pulsoCache2?: Map<string, Entrada>; __pulsoFila?: { ativos: number; espera: (() => void)[] } };
const cache = (g.__pulsoCache2 ??= new Map());
const fila = (g.__pulsoFila ??= { ativos: 0, espera: [] });
const MAX_PARALELO = 16; // o TSE bloqueia IPs acima de 100 req/s; ficamos bem abaixo
const TTL_MS = CACHE_TTL_S * 1000;
const TTL_404_MS = 10_000;

async function comVaga<T>(fn: () => Promise<T>): Promise<T> {
  if (fila.ativos >= MAX_PARALELO) await new Promise<void>((r) => fila.espera.push(r));
  fila.ativos++;
  try {
    return await fn();
  } finally {
    fila.ativos--;
    fila.espera.shift()?.();
  }
}

async function atualizar(e: Entrada, cargo: CargoKey, abr: string, turno: Turno): Promise<Corrida> {
  const url = urlResultado(cargo, abr, turno);
  return comVaga(async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15_000);
    try {
      const headers: Record<string, string> = {
        "user-agent": "pulso-apuracao/1.1",
        accept: "application/json",
        "cache-control": "no-cache", // pede à CDN do TSE a versão mais nova
      };
      if (e.valor && e.etag) headers["if-none-match"] = e.etag;
      if (e.valor && e.lastMod) headers["if-modified-since"] = e.lastMod;
      const res = await fetch(url, { cache: "no-store", signal: ctrl.signal, headers });
      if (res.status === 304 && e.valor) {
        e.em = Date.now();
        return e.valor;
      }
      if (res.status === 404) {
        e.naoPublicadoAte = Date.now() + TTL_404_MS;
        throw new AindaNaoPublicado(`TSE ainda não publicou ${abr}/${cargo}`);
      }
      if (!res.ok) throw new Error(`TSE respondeu ${res.status} para ${url}`);
      const raw = (await res.json()) as RawUnificado;
      const nova = normalizar(raw, cargo, abr, turno);
      // nunca regride: se a CDN entregar uma cópia mais antiga, mantém a que já temos
      if (e.valor && nova.secoes.totalizadas < e.valor.secoes.totalizadas && !nova.final) {
        e.em = Date.now();
        return e.valor;
      }
      e.valor = nova;
      e.etag = res.headers.get("etag") ?? undefined;
      e.lastMod = res.headers.get("last-modified") ?? undefined;
      e.em = Date.now();
      e.naoPublicadoAte = undefined;
      return nova;
    } finally {
      clearTimeout(t);
    }
  });
}

/** garante que a atualização em segundo plano termine mesmo depois da resposta (serverless) */
function emSegundoPlano(p: Promise<unknown>) {
  p.catch(() => {});
  try {
    after(() => p.catch(() => {}));
  } catch {
    // fora de uma requisição (build/script): só deixa a promise rodar
  }
}

export async function getCorrida(cargo: CargoKey, abr: string, modo: Modo = MODO_DADOS, turno: Turno = 1): Promise<Corrida> {
  if (modo === "simulacao") return corridaSimulada(cargo, abr, turno);
  // O arquivo "br" do TSE é consolidado com bem menos frequência que os das UFs (no 1º turno chegou a ficar
  // ~50 min atrás). Por isso o total nacional é a SOMA das 27 UFs + exterior, como fazem os outros painéis.
  if (cargo === "presidente" && abr === "br") return getNacionalPresidente(turno);
  return getCorridaArquivo(cargo, abr, turno);
}

async function getCorridaArquivo(cargo: CargoKey, abr: string, turno: Turno = 1): Promise<Corrida> {
  const chave = `${cargo}:${abr}:${turno}`;
  let e = cache.get(chave);
  if (!e) cache.set(chave, (e = { em: 0 }));
  const agora = Date.now();

  if (!e.valor && e.naoPublicadoAte && e.naoPublicadoAte > agora) throw new AindaNaoPublicado(`TSE ainda não publicou ${abr}/${cargo}`);
  if (e.valor && agora - e.em < TTL_MS) return e.valor;

  const entrada = e;
  const voo = (e.emVoo ??= atualizar(entrada, cargo, abr, turno).finally(() => {
    entrada.emVoo = undefined;
  }));
  if (e.valor) {
    // tem dado: responde na hora e atualiza por trás
    emSegundoPlano(voo);
    return e.valor;
  }
  return voo;
}

const brasilia = () =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" }).format(new Date());

/* ---------- total nacional = soma das UFs + exterior ---------- */
const gNac = globalThis as unknown as { __pulsoNac2?: Record<number, { st: number; quando: string }> };
const nacs = (gNac.__pulsoNac2 ??= { 1: { st: -1, quando: "" }, 2: { st: -1, quando: "" } });

async function getNacionalPresidente(turno: Turno = 1): Promise<Corrida> {
  const nac = nacs[turno];
  const abrs = [...UFS.map((u) => u.sigla), "zz"];
  const [partes, arquivoBR] = await Promise.all([
    Promise.all(abrs.map((uf) => getCorridaArquivo("presidente", uf, turno).catch(() => null))),
    getCorridaArquivo("presidente", "br", turno).catch(() => null),
  ]);
  const ufs = partes.filter((x): x is Corrida => !!x);
  if (!ufs.length) {
    if (arquivoBR) return arquivoBR;
    throw new AindaNaoPublicado("TSE ainda não publicou o resultado nacional");
  }

  const soma = (f: (c: Corrida) => number) => ufs.reduce((a, c) => a + f(c), 0);
  const ts = soma((c) => c.secoes.total);
  const st = soma((c) => c.secoes.totalizadas);

  // se por algum motivo o arquivo br estiver à frente (ex.: totalização final), usa ele
  if (arquivoBR && (arquivoBR.final || arquivoBR.secoes.totalizadas >= st)) return arquivoBR;

  const validos = soma((c) => c.votos.validos);
  const total = soma((c) => c.votos.total);
  const brancos = soma((c) => c.votos.brancos);
  const nulos = soma((c) => c.votos.nulos);
  const eleitorado = soma((c) => c.eleitorado.total);
  const apurado = soma((c) => c.eleitorado.apurado);
  const comparecimento = soma((c) => c.eleitorado.comparecimento);
  const abstencao = soma((c) => c.eleitorado.abstencao);

  // candidatos: soma de votos por número; metadados (vice, situação) do arquivo br quando houver
  const base = new Map((arquivoBR?.candidatos ?? []).map((c) => [c.numero, c]));
  const cands = new Map<string, Candidato>();
  for (const u of ufs)
    for (const c of u.candidatos) {
      const x = cands.get(c.numero);
      if (x) x.votos += c.votos;
      else {
        const b = base.get(c.numero);
        cands.set(c.numero, {
          ...c,
          ...(b ? { eleito: b.eleito, segundoTurno: b.segundoTurno, situacao: b.situacao, vice: b.vice ?? c.vice } : {}),
          foto: urlFoto("presidente", "br", c.id, turno),
          votos: c.votos,
        });
      }
    }
  const candidatos = [...cands.values()];
  for (const c of candidatos) c.pct = validos && c.valido ? (c.votos / validos) * 100 : 0;
  candidatos.sort((a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome, "pt-BR"));

  const agrs = new Map<string, Agremiacao>();
  for (const u of ufs)
    for (const a of u.agremiacoes) {
      const x = agrs.get(a.id);
      if (x) {
        x.votosNominais += a.votosNominais;
        x.votosLegenda += a.votosLegenda;
        x.votos += a.votos;
      } else agrs.set(a.id, { ...a, partidos: [...a.partidos] });
    }

  // horário: quando o total de seções mudou pela última vez (os "ht" das UFs vêm em fuso local)
  if (st !== nac.st) {
    nac.st = st;
    nac.quando = brasilia().replace(",", "");
  }
  const final = ufs.every((c) => c.final) && ufs.length === abrs.length;

  return {
    cargo: "presidente",
    abrangencia: "br",
    vagas: 1,
    atualizadoEm: nac.quando,
    final,
    status: final ? "final" : st > 0 ? "apurando" : "aguardando",
    secoes: { total: ts, totalizadas: st, pct: ts ? (st / ts) * 100 : 0 },
    eleitorado: {
      total: eleitorado,
      apurado,
      comparecimento,
      pctComparecimento: apurado ? (comparecimento / apurado) * 100 : 0,
      abstencao,
      pctAbstencao: apurado ? (abstencao / apurado) * 100 : 0,
    },
    votos: {
      total,
      validos,
      brancos,
      nulos,
      pctBrancos: total ? (brancos / total) * 100 : 0,
      pctNulos: total ? (nulos / total) * 100 : 0,
    },
    candidatos,
    agremiacoes: [...agrs.values()],
    totalCandidatos: candidatos.length,
    fonte: "tse",
  };
}

function resumir(c: Corrida, n = 4): ResumoUF {
  return {
    uf: c.abrangencia,
    pct: c.secoes.pct,
    final: c.final,
    status: c.status,
    vagas: c.vagas,
    validos: c.votos.validos,
    atualizadoEm: c.atualizadoEm,
    lideres: c.candidatos
      .filter((x) => x.valido)
      .slice(0, n)
      .map(({ id, numero, nome, partido, votos, pct, eleito, segundoTurno, situacao, foto }) => ({
        id, numero, nome, partido, votos, pct, eleito, segundoTurno, situacao, foto,
      })),
  };
}

const resumoVazio = (uf: string, erro: string): ResumoUF => ({
  uf, pct: 0, final: false, status: "aguardando", vagas: 0, validos: 0, atualizadoEm: null, lideres: [], erro,
});

export async function getPanorama(cargo: Exclude<CargoKey, "depfed" | "depest">, modo: Modo = MODO_DADOS, turno: Turno = 1): Promise<Panorama> {
  const ufs = await Promise.all(
    UFS.map(async (u) => {
      try {
        const c = await getCorrida(cargo, u.sigla, modo, turno);
        const r = resumir(c);
        if (cargo === "governador" && c.status !== "aguardando") {
          const p = projetarMemo(`gov:${u.sigla}:${modo}:${turno}`, [c], u.sigla, 2000);
          const l = p?.candidatos[0];
          if (p && l)
            r.proj = { numero: l.numero, pMaioria: l.pMaioria, pPrimeiro: l.pPrimeiro, proj: l.proj, p05: l.p05, p95: l.p95, pSegundoTurno: p.pSegundoTurno };
        }
        return r;
      } catch (e) {
        return resumoVazio(u.sigla, e instanceof AindaNaoPublicado ? "aguardando" : "erro");
      }
    }),
  );
  let nacional: Corrida | undefined;
  if (cargo === "presidente") {
    try {
      nacional = await getCorrida("presidente", "br", modo, turno);
    } catch {
      nacional = undefined;
    }
  }
  const inicioApuracao =
    modo === "simulacao" ? inicioSimulacao() : new Date(turno === 2 ? INICIO_2T : INICIO_APURACAO).toISOString();
  return { cargo, fonte: modo, geradoEm: brasilia(), inicioApuracao, nacional, ufs };
}

/* ---------- projeção / probabilidade ---------- */
const gProj = globalThis as unknown as { __pulsoProj?: Map<string, { chave: string; valor: Projecao | null }> };
const memoProj = (gProj.__pulsoProj ??= new Map());
function projetarMemo(id: string, partes: Corrida[], abr: string, sims = 3000) {
  // só recalcula quando os dados mudam
  const chave = partes.map((p) => `${p.abrangencia}${p.secoes.totalizadas}:${p.votos.validos}`).join("|");
  const m = memoProj.get(id);
  if (m && m.chave === chave) return m.valor;
  const valor = projetar(partes, abr, sims);
  memoProj.set(id, { chave, valor });
  return valor;
}

export async function getProjecaoPresidente(modo: Modo = MODO_DADOS, turno: Turno = 1): Promise<Projecao | null> {
  const abrs = [...UFS.map((u) => u.sigla), ...(modo === "tse" ? ["zz"] : [])];
  const partes = (
    await Promise.all(
      abrs.map((uf) =>
        (modo === "simulacao" ? Promise.resolve(corridaSimulada("presidente", uf, turno)) : getCorridaArquivo("presidente", uf, turno)).catch(() => null),
      ),
    )
  ).filter((x): x is Corrida => !!x && x.status !== "aguardando");
  if (!partes.length) return null;
  return projetarMemo(`pres:${modo}:${turno}`, partes, "br", 4000);
}

/* ---------- base do simulador de 2º turno ---------- */
export interface BaseSegundoTurno {
  fonte: Modo;
  geradoEm: string;
  pctApurado: number;
  /** candidatos modelados individualmente (os mais votados no país) */
  candidatos: { numero: string; nome: string; partido: string; foto?: string; votos: number; pct: number }[];
  /** por UF (e exterior): votos projetados para 100% das seções */
  ufs: { uf: string; votos: Record<string, number>; outros: number; brancosNulos: number; abstencao: number; eleitorado: number }[];
}

export async function getBaseSegundoTurno(modo: Modo = MODO_DADOS): Promise<BaseSegundoTurno | null> {
  const abrs = [...UFS.map((u) => u.sigla), ...(modo === "tse" ? ["zz"] : [])];
  const partes = (
    await Promise.all(
      abrs.map((uf) => (modo === "simulacao" ? Promise.resolve(corridaSimulada("presidente", uf)) : getCorridaArquivo("presidente", uf)).catch(() => null)),
    )
  ).filter((x): x is Corrida => !!x && x.status !== "aguardando" && x.votos.validos > 0);
  if (!partes.length) return null;

  const tot = new Map<string, { nome: string; partido: string; foto?: string; votos: number }>();
  for (const p of partes)
    for (const c of p.candidatos)
      if (c.valido) {
        const t = tot.get(c.numero) ?? { nome: c.nome, partido: c.partido, foto: urlFoto("presidente", "br", c.id), votos: 0 };
        t.votos += c.votos;
        tot.set(c.numero, t);
      }
  const ordem = [...tot.entries()].sort((a, b) => b[1].votos - a[1].votos);
  const top = ordem.slice(0, 8);
  const vvTotal = partes.reduce((a, p) => a + p.votos.validos, 0);

  const ufs = partes.map((p) => {
    // fator para levar o apurado a 100% das seções (pelo eleitorado já apurado)
    const f = p.final || !p.eleitorado.apurado ? 1 : Math.max(1, p.eleitorado.total / p.eleitorado.apurado);
    const votos: Record<string, number> = {};
    let soma = 0;
    for (const [n] of top) {
      const v = p.candidatos.find((c) => c.numero === n && c.valido)?.votos ?? 0;
      votos[n] = Math.round(v * f);
      soma += v;
    }
    const bn = p.votos.brancos + p.votos.nulos;
    return {
      uf: p.abrangencia,
      votos,
      outros: Math.round(Math.max(0, p.votos.validos - soma) * f),
      brancosNulos: Math.round(bn * f),
      abstencao: Math.round(p.eleitorado.abstencao * f),
      eleitorado: p.eleitorado.total,
    };
  });
  const pct = (partes.reduce((a, p) => a + p.secoes.totalizadas, 0) / Math.max(1, partes.reduce((a, p) => a + p.secoes.total, 0))) * 100;
  return {
    fonte: modo,
    geradoEm: brasilia(),
    pctApurado: pct,
    candidatos: top.map(([numero, t]) => ({ numero, nome: t.nome, partido: t.partido, foto: modo === "tse" ? t.foto : undefined, votos: t.votos, pct: vvTotal ? (t.votos / vvTotal) * 100 : 0 })),
    ufs,
  };
}

/** Bancadas eleitas/projetadas. depfed sem UF = Câmara inteira; senador = 2 vagas por UF. */
export async function getBancada(cargo: "depfed" | "depest" | "senador", abr: string | null, modo: Modo = MODO_DADOS): Promise<Bancada> {
  const alvo = abr ? [abr] : UFS.map((u) => u.sigla);
  const corridas = (
    await Promise.all(
      alvo.map(async (uf) => {
        try {
          return await getCorrida(cargo, uf, modo);
        } catch {
          return null;
        }
      }),
    )
  ).filter((x): x is Corrida => !!x);

  let oficialTudo = corridas.length > 0;
  const porUF: Record<string, ReturnType<typeof contarPorPartido>> = {};
  const eleitos: Bancada["eleitos"] = [];
  let totalVagas = 0;
  let secoes = 0, secoesTot = 0;
  for (const c of corridas) {
    const r = cargo === "senador" ? eleitosMajoritario(c) : projetarCadeiras(c);
    oficialTudo &&= r.oficial;
    porUF[c.abrangencia] = contarPorPartido(r.eleitos);
    eleitos.push(...r.eleitos.map((e) => paraEleito(e, c.abrangencia)));
    totalVagas += c.vagas;
    secoes += c.secoes.totalizadas;
    secoesTot += c.secoes.total;
  }
  eleitos.sort((a, b) => b.votos - a.votos);

  return {
    cargo,
    abrangencia: abr ?? "br",
    fonte: modo,
    oficial: oficialTudo,
    totalVagas,
    pctApurado: secoesTot ? (secoes / secoesTot) * 100 : 0,
    partidos: somarAssentos(Object.values(porUF)),
    porUF,
    eleitos,
    geradoEm: brasilia(),
  };
}

/** Versão enxuta para o cliente: listas proporcionais podem ter milhares de nomes */
export function enxugar(c: Corrida, limite = 120): Corrida {
  if (c.candidatos.length <= limite) return c;
  return { ...c, candidatos: c.candidatos.slice(0, limite) };
}

/* ---------- fase do site: 1º turno → entre turnos → 2º turno ---------- */
export type Fase = "1t" | "entre" | "2t";
export interface Finalista {
  numero: string;
  nome: string;
  partido: string;
  foto?: string;
  pct: number;
  votos: number;
}
export interface FaseInfo {
  fase: Fase;
  fonte: Modo;
  inicio2t: string;
  /** presidente decidido no 1º turno? */
  presidenteEleito?: Finalista;
  finalistas: Finalista[];
  gov2t: { uf: string; finalistas: Finalista[] }[];
  geradoEm: string;
}

const paraFinalista = (c: Corrida["candidatos"][number]): Finalista => ({
  numero: c.numero,
  nome: c.nome,
  partido: c.partido,
  foto: c.foto,
  pct: c.pct,
  votos: c.votos,
});

/** quem vai ao 2º turno numa corrida majoritária do 1º turno (ou null se ainda não dá para saber / não haverá) */
function finalistasDe(c: Corrida): { eleito?: Finalista; finalistas: Finalista[] } | null {
  const v = c.candidatos.filter((x) => x.valido);
  const eleito = v.find((x) => x.eleito);
  if (eleito) return { eleito: paraFinalista(eleito), finalistas: [] };
  const marcados = v.filter((x) => x.segundoTurno);
  if (marcados.length >= 2) return { finalistas: marcados.slice(0, 2).map(paraFinalista) };
  const quaseFinal = c.final || c.secoes.pct >= 99.9;
  if (!quaseFinal || v.length < 2) return null;
  if (v[0].pct > 50) return { eleito: paraFinalista(v[0]), finalistas: [] };
  return { finalistas: v.slice(0, 2).map(paraFinalista) };
}

const gFase = globalThis as unknown as { __pulsoFase?: Record<string, { em: number; valor: FaseInfo }> };
const cacheFase = (gFase.__pulsoFase ??= {});

export async function getFase(modo: Modo = MODO_DADOS, forcada?: Fase): Promise<FaseInfo> {
  const chave = `${modo}:${forcada ?? FASE_FORCADA ?? ""}`;
  const hit = cacheFase[chave];
  if (hit && Date.now() - hit.em < 20_000) return hit.valor;

  const agora = Date.now();
  const inicio2t = new Date(INICIO_2T).getTime();
  const f0 = forcada ?? FASE_FORCADA;
  // na simulação com fase forçada, usa o 1º turno simulado já 100% apurado
  const usarFinalSim = modo === "simulacao" && !!f0 && f0 !== "1t";
  const pres = usarFinalSim
    ? corridaSimuladaFinal("presidente", "br")
    : await getCorrida("presidente", "br", modo, 1).catch(() => null);
  const fp = pres ? finalistasDe(pres) : null;

  let fase: Fase = f0 ?? "1t";
  if (!f0) {
    if (agora >= inicio2t) fase = "2t";
    else if (fp || agora >= new Date("2026-10-05T06:00:00-03:00").getTime()) fase = "entre";
  }

  const gov2t: FaseInfo["gov2t"] = [];
  if (fase !== "1t") {
    const govs = await Promise.all(
      UFS.map(async (u) => {
        const c = usarFinalSim ? corridaSimuladaFinal("governador", u.sigla) : await getCorrida("governador", u.sigla, modo, 1).catch(() => null);
        const f = c ? finalistasDe(c) : null;
        return f && f.finalistas.length === 2 ? { uf: u.sigla, finalistas: f.finalistas } : null;
      }),
    );
    for (const x of govs) if (x) gov2t.push(x);
  }

  const valor: FaseInfo = {
    fase,
    fonte: modo,
    inicio2t: new Date(INICIO_2T).toISOString(),
    presidenteEleito: fp?.eleito,
    finalistas: fp?.finalistas ?? pres?.candidatos.filter((c) => c.valido).slice(0, 2).map(paraFinalista) ?? [],
    gov2t,
    geradoEm: brasilia(),
  };
  cacheFase[chave] = { em: agora, valor };
  return valor;
}
