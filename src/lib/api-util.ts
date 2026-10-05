import { NextResponse } from "next/server";
import { MODO_DADOS } from "./tse/config";

export function modoDe(req: Request): "tse" | "simulacao" {
  const m = new URL(req.url).searchParams.get("modo");
  if (m === "simulacao" || m === "demo") return "simulacao";
  if (m === "tse") return "tse";
  return MODO_DADOS;
}

export function turnoDe(req: Request): 1 | 2 {
  return new URL(req.url).searchParams.get("turno") === "2" ? 2 : 1;
}

export function faseDe(req: Request): "1t" | "entre" | "2t" | undefined {
  const f = new URL(req.url).searchParams.get("fase");
  return f === "1t" || f === "entre" || f === "2t" ? f : undefined;
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      // CDN (Vercel etc.) segura 2s e serve a versão anterior por até 5s enquanto revalida
      "Cache-Control": "public, s-maxage=2, stale-while-revalidate=5",
    },
  });
}
