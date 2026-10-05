import { json, modoDe, turnoDe } from "@/lib/api-util";
import { getProjecaoPresidente } from "@/lib/tse/source";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const p = await getProjecaoPresidente(modoDe(req), turnoDe(req));
  if (!p) return json({ erro: "aguardando" }, 404);
  return json(p);
}
