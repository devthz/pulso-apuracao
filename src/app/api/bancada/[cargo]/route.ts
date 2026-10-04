import { json, modoDe } from "@/lib/api-util";
import { getBancada } from "@/lib/tse/source";
import { isUF } from "@/lib/ufs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ cargo: string }> }) {
  const { cargo } = await params;
  if (cargo !== "depfed" && cargo !== "depest" && cargo !== "senador") return json({ erro: "cargo inválido" }, 400);
  const uf = new URL(req.url).searchParams.get("uf")?.toLowerCase() ?? null;
  if (uf && !isUF(uf)) return json({ erro: "UF inválida" }, 400);
  if (cargo === "depest" && !uf) return json({ erro: "informe ?uf=" }, 400);
  const b = await getBancada(cargo, uf, modoDe(req));
  // a lista de eleitos da Câmara inteira tem 500+ nomes; mantém todos (são poucos KB)
  return json(b);
}
