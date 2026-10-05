import { json, modoDe, turnoDe } from "@/lib/api-util";
import { AindaNaoPublicado, enxugar, getCorrida } from "@/lib/tse/source";
import { CARGO_KEYS, type CargoKey } from "@/lib/tse/types";
import { isUF } from "@/lib/ufs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ cargo: string; abr: string }> }) {
  const { cargo, abr } = await params;
  const uf = abr.toLowerCase();
  if (!CARGO_KEYS.includes(cargo as CargoKey)) return json({ erro: "cargo inválido" }, 400);
  if (!(uf === "br" && cargo === "presidente") && !(uf === "zz" && cargo === "presidente") && !isUF(uf))
    return json({ erro: "abrangência inválida" }, 400);
  try {
    const c = await getCorrida(cargo as CargoKey, uf, modoDe(req), turnoDe(req));
    return json(enxugar(c));
  } catch (e) {
    if (e instanceof AindaNaoPublicado) return json({ erro: "aguardando", mensagem: e.message }, 404);
    return json({ erro: "falha", mensagem: (e as Error).message }, 502);
  }
}
