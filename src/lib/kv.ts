import "server-only";
import { createClient } from "redis";

/**
 * Armazenamento compartilhado entre as instâncias do servidor.
 * Aceita os dois jeitos que a Vercel oferece:
 *  - Redis (Storage → Redis): variável REDIS_URL, conexão TCP via node-redis;
 *  - Upstash for Redis (Marketplace): KV_REST_API_URL + KV_REST_API_TOKEN, via REST.
 * Sem nenhuma das duas, tudo continua funcionando só em memória.
 */
const REDIS_URL = process.env.REDIS_URL ?? process.env.KV_URL;
const URL_REST = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_REST = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

const usarTCP = !!REDIS_URL && !URL_REST;
export const kvAtivo = usarTCP || !!(URL_REST && TOKEN_REST);

/* ---------- TCP (node-redis): uma conexão por instância, reaproveitada ---------- */
interface Cliente {
  get(k: string): Promise<string | null>;
  set(k: string, v: string, o?: { expiration?: { type: "EX"; value: number }; condition?: "NX" }): Promise<string | null>;
  del(k: string): Promise<number>;
}
const g = globalThis as unknown as { __pulsoRedis?: Promise<Cliente | null> };

function cliente(): Promise<Cliente | null> {
  g.__pulsoRedis ??= (async () => {
    try {
      const c = createClient({
        url: REDIS_URL,
        socket: { connectTimeout: 4000, reconnectStrategy: (n) => (n > 5 ? false : Math.min(n * 200, 2000)) },
      });
      c.on("error", () => {}); // erros de rede não derrubam a função
      await c.connect();
      return c as unknown as Cliente;
    } catch {
      g.__pulsoRedis = undefined; // tenta de novo na próxima
      return null;
    }
  })();
  return g.__pulsoRedis;
}

async function comTimeout<T>(p: Promise<T>, ms = 4000): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]).catch(() => null);
}

/* ---------- REST (Upstash) ---------- */
async function rest<T = unknown>(args: (string | number)[]): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(URL_REST!, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN_REST}`, "content-type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { result?: T; error?: string };
    return j.error ? null : (j.result ?? null);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function kvGet(k: string): Promise<string | null> {
  if (!kvAtivo) return null;
  if (!usarTCP) return rest<string>(["GET", k]);
  const c = await cliente();
  return c ? comTimeout(c.get(k)) : null;
}

export async function kvSet(k: string, v: string, exSeg?: number): Promise<void> {
  if (!kvAtivo) return;
  if (!usarTCP) {
    await rest(exSeg ? ["SET", k, v, "EX", exSeg] : ["SET", k, v]);
    return;
  }
  const c = await cliente();
  if (c) await comTimeout(exSeg ? c.set(k, v, { expiration: { type: "EX", value: exSeg } }) : c.set(k, v));
}

/** trava distribuída: true se conseguiu (SET NX EX) */
export async function kvTrava(k: string, dono: string, exSeg: number): Promise<boolean> {
  if (!kvAtivo) return true;
  if (!usarTCP) return (await rest<string>(["SET", k, dono, "NX", "EX", exSeg])) === "OK";
  const c = await cliente();
  if (!c) return true; // Redis fora do ar: segue sem trava (comportamento de memória)
  return (await comTimeout(c.set(k, dono, { condition: "NX", expiration: { type: "EX", value: exSeg } }))) === "OK";
}

export async function kvDel(k: string): Promise<void> {
  if (!kvAtivo) return;
  if (!usarTCP) {
    await rest(["DEL", k]);
    return;
  }
  const c = await cliente();
  if (c) await comTimeout(c.del(k));
}
