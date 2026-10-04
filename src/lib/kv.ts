import "server-only";

/**
 * Cliente mínimo do Redis REST da Upstash (o "Upstash for Redis" do Marketplace da Vercel).
 * Sem dependências: só fetch. Se as variáveis não existirem, tudo continua funcionando só em memória.
 */
const URL_KV = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_KV = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const kvAtivo = !!(URL_KV && TOKEN_KV);

async function comando<T = unknown>(args: (string | number)[]): Promise<T | null> {
  if (!kvAtivo) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(URL_KV!, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN_KV}`, "content-type": "application/json" },
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

export const kvGet = (k: string) => comando<string>(["GET", k]);
export const kvSet = (k: string, v: string, exSeg?: number) => comando<string>(exSeg ? ["SET", k, v, "EX", exSeg] : ["SET", k, v]);
/** trava distribuída: devolve true se conseguiu (SET NX EX) */
export const kvTrava = async (k: string, dono: string, exSeg: number) => (await comando<string>(["SET", k, dono, "NX", "EX", exSeg])) === "OK";
export const kvDel = (k: string) => comando<number>(["DEL", k]);
