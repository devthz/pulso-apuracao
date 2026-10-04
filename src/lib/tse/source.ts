import "server-only";
import { after } from "next/server";
import { UFS } from "../ufs";
import { CACHE_TTL_S, INICIO_APURACAO, MODO_DADOS, urlResultado } from "./config";
import { corridaSimulada, inicioSimulacao } from "./demo";
import { normalizar, type RawUnificado } from "./normalize";
import { contarPorPartido, eleitosMajoritario, paraEleito, projetarCadeiras, somarAssentos } from "./seats";
import type { Bancada, CargoKey, Corrida, Panorama, ResumoUF } from "./types";

export class AindaNaoPublicado extends Error {}

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

async function atualizar(e: Entrada, cargo: CargoKey, abr: string): Promise<Corrida> {
  const url = urlResultado(cargo, abr);
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
      const nova = normalizar(raw, cargo, abr);
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

export async function getCorrida(cargo: CargoKey, abr: string, modo: Modo = MODO_DADOS): Promise<Corrida> {
  if (modo === "simulacao") return corridaSimulada(cargo, abr);
  const chave = `${cargo}:${abr}`;
  let e = cache.get(chave);
  if (!e) cache.set(chave, (e = { em: 0 }));
  const agora = Date.now();

  if (!e.valor && e.naoPublicadoAte && e.naoPublicadoAte > agora) throw new AindaNaoPublicado(`TSE ainda não publicou ${abr}/${cargo}`);
  if (e.valor && agora - e.em < TTL_MS) return e.valor;

  const entrada = e;
  const voo = (e.emVoo ??= atualizar(entrada, cargo, abr).finally(() => {
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

export async function getPanorama(cargo: Exclude<CargoKey, "depfed" | "depest">, modo: Modo = MODO_DADOS): Promise<Panorama> {
  const ufs = await Promise.all(
    UFS.map(async (u) => {
      try {
        return resumir(await getCorrida(cargo, u.sigla, modo));
      } catch (e) {
        return resumoVazio(u.sigla, e instanceof AindaNaoPublicado ? "aguardando" : "erro");
      }
    }),
  );
  let nacional: Corrida | undefined;
  if (cargo === "presidente") {
    try {
      nacional = await getCorrida("presidente", "br", modo);
    } catch {
      nacional = undefined;
    }
  }
  const inicioApuracao = modo === "simulacao" ? inicioSimulacao() : new Date(INICIO_APURACAO).toISOString();
  return { cargo, fonte: modo, geradoEm: brasilia(), inicioApuracao, nacional, ufs };
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
