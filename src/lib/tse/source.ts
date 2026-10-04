import "server-only";
import { UFS } from "../ufs";
import { CACHE_TTL_S, INICIO_APURACAO, MODO_DADOS, urlResultado } from "./config";
import { corridaSimulada, inicioSimulacao } from "./demo";
import { normalizar, type RawUnificado } from "./normalize";
import { contarPorPartido, eleitosMajoritario, paraEleito, projetarCadeiras, somarAssentos } from "./seats";
import type { Bancada, CargoKey, Corrida, Panorama, ResumoUF } from "./types";

export class AindaNaoPublicado extends Error {}

type Modo = "tse" | "simulacao";

/* ---------- cache em memória + deduplicação de requisições em voo ---------- */
interface Entrada { em: number; valor: Promise<Corrida> }
const g = globalThis as unknown as { __pulsoCache?: Map<string, Entrada>; __pulsoFila?: { ativos: number; espera: (() => void)[] } };
const cache = (g.__pulsoCache ??= new Map());
const fila = (g.__pulsoFila ??= { ativos: 0, espera: [] });
const MAX_PARALELO = 12; // o TSE bloqueia IPs acima de 100 req/s; ficamos bem abaixo

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

async function baixarTSE(cargo: CargoKey, abr: string): Promise<Corrida> {
  const url = urlResultado(cargo, abr);
  return comVaga(async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: ctrl.signal,
        headers: { "user-agent": "pulso-apuracao/1.0", accept: "application/json" },
      });
      if (res.status === 404 || res.status === 403) throw new AindaNaoPublicado(`TSE ainda não publicou ${abr}/${cargo}`);
      if (!res.ok) throw new Error(`TSE respondeu ${res.status} para ${url}`);
      const raw = (await res.json()) as RawUnificado;
      return normalizar(raw, cargo, abr);
    } finally {
      clearTimeout(t);
    }
  });
}

export async function getCorrida(cargo: CargoKey, abr: string, modo: Modo = MODO_DADOS): Promise<Corrida> {
  if (modo === "simulacao") return corridaSimulada(cargo, abr);
  const chave = `${cargo}:${abr}`;
  const agora = Date.now();
  const hit = cache.get(chave);
  // 404 fica menos tempo em cache? Não: ficar batendo em 404 bloqueia o IP no TSE. Mesmo TTL.
  if (hit && agora - hit.em < CACHE_TTL_S * 1000) return hit.valor;
  const valor = baixarTSE(cargo, abr);
  cache.set(chave, { em: agora, valor });
  valor.catch(() => {
    // erros de rede saem do cache mais cedo (mas não 404, para não martelar o TSE)
    setTimeout(() => {
      const e = cache.get(chave);
      if (e?.valor === valor) cache.delete(chave);
    }, 4000);
  });
  // stale-while-error: se falhar e havia valor anterior bom, devolve o anterior
  if (hit) {
    return valor.catch(async (err) => {
      try {
        return await hit.valor;
      } catch {
        throw err;
      }
    });
  }
  return valor;
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
