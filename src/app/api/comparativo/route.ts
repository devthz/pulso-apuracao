import { json, modoDe } from "@/lib/api-util";
import { getComparativo } from "@/lib/tse/source";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const c = await getComparativo(modoDe(req));
  if (!c) return json({ erro: "aguardando" }, 404);
  return json(c);
}
