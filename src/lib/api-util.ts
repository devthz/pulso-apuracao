import { NextResponse } from "next/server";
import { MODO_DADOS } from "./tse/config";

export function modoDe(req: Request): "tse" | "simulacao" {
  const m = new URL(req.url).searchParams.get("modo");
  if (m === "simulacao" || m === "demo") return "simulacao";
  if (m === "tse") return "tse";
  return MODO_DADOS;
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
